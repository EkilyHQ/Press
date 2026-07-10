import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanJavaScriptSource, scanRepository, verifyInventory } from './check-html-sink-policy.mjs';
import { resolveLanguageModuleUrl } from '../assets/js/i18n.js';
import { resolveModuleEntry } from '../assets/js/theme-layout.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

async function read(relativePath) {
  return readFile(path.join(SCRIPT_DIR, relativePath), 'utf8');
}

const languageManifestUrl = new URL('https://example.test/assets/i18n/languages.json');
assert.equal(
  resolveLanguageModuleUrl('./ja.js', languageManifestUrl)?.href,
  'https://example.test/assets/i18n/ja.js',
  'same-origin JavaScript language bundles must remain loadable'
);
assert.equal(
  resolveLanguageModuleUrl('https://cdn.example.test/ja.js', languageManifestUrl),
  null,
  'cross-origin language bundle modules must be rejected'
);
assert.equal(
  resolveLanguageModuleUrl('./ja.json', languageManifestUrl),
  null,
  'non-JavaScript language bundle modules must be rejected'
);
assert.equal(
  resolveLanguageModuleUrl('https://user:secret@example.test/assets/i18n/ja.js', languageManifestUrl),
  null,
  'credential-bearing language bundle URLs must be rejected'
);
assert.equal(
  resolveModuleEntry('example', 'modules/layout.js', { version: '1.2.3' }),
  '../themes/example/modules/layout.js?v=1.2.3',
  'safe same-origin theme module entries must remain loadable'
);
for (const unsafeEntry of [
  '../escape.js',
  './modules/layout.js',
  '/modules/layout.js',
  'modules/layout.mjs',
  'modules/layout.json',
  'modules/%2e%2e/escape.js',
  'https://example.test/module.js',
  'modules/layout.js?next=../escape.js'
]) {
  assert.equal(resolveModuleEntry('example', unsafeEntry, { version: '1.2.3' }), '', unsafeEntry);
}
assert.equal(resolveModuleEntry('..', 'modules/layout.js', { version: '1.2.3' }), '', 'unsafe theme pack');

const positivePath = 'scripts/fixtures/html-sink-policy/positive.mjs';
const positive = scanJavaScriptSource({
  filePath: positivePath,
  source: await read('fixtures/html-sink-policy/positive.mjs')
});
assert.deepEqual(
  positive.approved.map(({ kind }) => kind).sort(),
  ['dynamic-import', 'innerHTML-write', 'insertAdjacentHTML', 'serializer-read'],
  'reviewed HTML rendering, serializer reads, functional timers, and literal imports must remain classifiable'
);
assert.equal(positive.prohibited.length, 0, 'legitimate controls must not be reported as prohibited sinks');

const negativePath = 'scripts/fixtures/html-sink-policy/negative.mjs';
const negative = scanJavaScriptSource({
  filePath: negativePath,
  source: await read('fixtures/html-sink-policy/negative.mjs')
});
assert.deepEqual(
  negative.prohibited.map(({ kind }) => kind).sort(),
  [
    'DOMParser-text-html',
    'DOMParser-unproven-mime',
    'Function-constructor-call',
    'createContextualFragment',
    'document.write',
    'eval',
    'new-Function',
    'non-literal-dynamic-import',
    'outerHTML-write',
    'setInterval-string',
    'setInterval-unproven-callback',
    'setTimeout-string',
    'setTimeout-unproven-callback',
    'srcdoc-setAttribute',
    'srcdoc-write'
  ].sort(),
  'computed properties and every prohibited executable HTML sink class must be detected'
);
assert.equal(negative.approved.length, 0, 'prohibited fixture must not enter the approved baseline');

const shadowedBindings = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/shadowed-bindings.mjs',
  source: `
    const callback = () => {};
    const mime = 'application/xml';
    function run(callback, mime, parser, html) {
      setTimeout(callback, 0);
      parser.parseFromString(html, mime);
    }
    run('alert(1)', 'text/html', new DOMParser(), payload);
  `
});
assert.deepEqual(
  shadowedBindings.prohibited.map(({ kind }) => kind).sort(),
  ['DOMParser-unproven-mime', 'setTimeout-unproven-callback'],
  'nearest lexical parameters must shadow unrelated safe-looking outer bindings'
);

const opaqueAndMutatedBindings = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/opaque-and-mutated-bindings.mjs',
  source: `
    import importedCallback from './callback.js';
    const outerCallback = () => {};
    function withLetShadow() {
      let outerCallback;
      setTimeout(outerCallback, 0);
    }
    function withDestructuring({ callback }) {
      setTimeout(callback, 0);
    }
    let changedCallback = () => {};
    changedCallback = importedCallback;
    setTimeout(changedCallback, 0);
    setTimeout(importedCallback, 0);
    let forOfCallback = () => {};
    for (forOfCallback of ['alert(1)']) {}
    setTimeout(forOfCallback, 0);
    let forInCallback = () => {};
    for (forInCallback in { 'alert(1)': true }) {}
    setTimeout(forInCallback, 0);
    let destructuredLoopCallback = () => {};
    for ([destructuredLoopCallback] of [['alert(1)']]) {}
    setTimeout(destructuredLoopCallback, 0);
  `
});
assert.deepEqual(
  opaqueAndMutatedBindings.prohibited.map(({ kind }) => kind),
  Array(7).fill('setTimeout-unproven-callback'),
  'let shadows, destructured parameters, assignments, loop mutations, and imports must remain fail-closed timer callbacks'
);

const stableLetAndVarBindings = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/stable-let-and-var-bindings.mjs',
  source: `
    function renderWithLet(target, payload) {
      let property = 'innerHTML';
      target[property] = payload;
    }
    function replaceWithVar(target, payload) {
      var property = 'outerHTML';
      target[property] = payload;
    }
  `
});
assert.deepEqual(
  stableLetAndVarBindings.approved.map(({ kind }) => kind),
  ['innerHTML-write'],
  'unmutated initialized let bindings must retain definite reviewed sinks'
);
assert.deepEqual(
  stableLetAndVarBindings.prohibited.map(({ kind }) => kind),
  ['outerHTML-write'],
  'unmutated initialized var bindings must retain definite prohibited sinks'
);

const scopedComputedProperties = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/scoped-computed-properties.mjs',
  source: `
    export function render(target, payload) {
      const property = 'innerHTML';
      target[property] = payload;
    }
    export function replace(target, payload) {
      const property = 'outerHTML';
      target[property] = payload;
    }
  `
});
assert.deepEqual(
  scopedComputedProperties.approved.map(({ kind }) => kind),
  ['innerHTML-write'],
  'same-named constants in separate lexical scopes must retain the reviewed innerHTML occurrence'
);
assert.deepEqual(
  scopedComputedProperties.prohibited.map(({ kind }) => kind),
  ['outerHTML-write'],
  'same-named constants in separate lexical scopes must retain the prohibited outerHTML occurrence'
);

const policy = JSON.parse(await read('html-sink-policy.json'));
const inventory = await scanRepository();
assert.deepEqual(verifyInventory(inventory, policy), [], 'the versioned exact-fingerprint inventory must match');

const unapprovedPath = 'scripts/fixtures/html-sink-policy/unapproved-markup.mjs';
const unapproved = scanJavaScriptSource({
  filePath: unapprovedPath,
  source: await read('fixtures/html-sink-policy/unapproved-markup.mjs')
});
assert.deepEqual(
  unapproved.approved.map(({ kind }) => kind).sort(),
  [
    'innerHTML-write',
    'innerHTML-write',
    'innerHTML-write',
    'innerHTML-write',
    'insertAdjacentHTML',
    'insertAdjacentHTML'
  ].sort(),
  'dot, computed-property, and insertAdjacentHTML markup writes must all enter the review inventory'
);
assert.equal(unapproved.prohibited.length, 0, 'review-required markup is distinct from inherently forbidden sinks');
const additionalSink = structuredClone(inventory);
additionalSink.approved.push(...unapproved.approved);
const additionalErrors = verifyInventory(additionalSink, policy);
assert.equal(
  additionalErrors.filter((message) => message.includes('unapproved sink fingerprint')).length,
  6,
  'each new markup occurrence must be rejected by its own exact fingerprint'
);

const changedSink = structuredClone(inventory);
changedSink.approved[0].fingerprint = '0'.repeat(64);
const changedErrors = verifyInventory(changedSink, policy);
assert.ok(
  changedErrors.some((message) => message.includes('unapproved sink fingerprint')) &&
    changedErrors.some((message) => message.includes('approved sink changed or disappeared')),
  'changing an approved sink must require an explicit manifest review'
);

function assertMetadataDrift(select, mutate, label) {
  const changed = structuredClone(inventory);
  const occurrence = changed.approved.find(select);
  assert.ok(occurrence, `${label} fixture occurrence must exist`);
  mutate(occurrence);
  const errors = verifyInventory(changed, policy);
  assert.ok(
    errors.some((message) => message.includes('unapproved sink fingerprint')) &&
      errors.some((message) => message.includes('approved sink changed or disappeared')),
    `${label} metadata drift must invalidate the exact occurrence`
  );
}

assertMetadataDrift(
  ({ kind }) => kind === 'innerHTML-write',
  (occurrence) => {
    occurrence.empty = !occurrence.empty;
  },
  'empty classification'
);
assertMetadataDrift(
  ({ kind }) => kind === 'serializer-read',
  (occurrence) => {
    occurrence.property = occurrence.property === 'innerHTML' ? 'outerHTML' : 'innerHTML';
  },
  'serializer property'
);
assertMetadataDrift(
  ({ kind, literal }) => kind === 'dynamic-import' && typeof literal === 'string',
  (occurrence) => {
    occurrence.literal = `${occurrence.literal}?changed`;
  },
  'literal import'
);
assertMetadataDrift(
  ({ kind, argument }) => kind === 'dynamic-import' && typeof argument === 'string',
  (occurrence) => {
    occurrence.argument = `${occurrence.argument}Changed`;
  },
  'non-literal import argument'
);
assertMetadataDrift(
  ({ kind, executableExtensions }) => kind === 'dynamic-import' && Array.isArray(executableExtensions),
  (occurrence) => {
    occurrence.executableExtensions = ['.mjs'];
  },
  'non-literal import extensions'
);
assertMetadataDrift(
  ({ kind, control }) => kind === 'dynamic-import' && control,
  (occurrence) => {
    occurrence.control.fingerprint = '0'.repeat(64);
  },
  'non-literal import control'
);

const reclassifiedPolicy = structuredClone(policy);
reclassifiedPolicy.approved[0].rationale += ' Changed without regeneration.';
assert.throws(
  () => verifyInventory(inventory, reclassifiedPolicy),
  /disposition hash must bind occurrence evidence, metadata, classification, and rationale/u,
  'reclassification must require explicit disposition-hash regeneration'
);

const fabricatedEvidencePolicy = structuredClone(policy);
fabricatedEvidencePolicy.approved[0].evidence = 'fabricated evidence';
assert.throws(
  () => verifyInventory(inventory, fabricatedEvidencePolicy),
  /disposition hash must bind occurrence evidence, metadata, classification, and rationale/u,
  'per-occurrence evidence tampering must invalidate the reviewed disposition'
);

const fabricatedRationalePolicy = structuredClone(policy);
fabricatedRationalePolicy.rationale = 'fabricated top-level rationale';
assert.throws(
  () => verifyInventory(inventory, fabricatedRationalePolicy),
  /sink policy rationale drift/u,
  'top-level accepted-no-action rationale tampering must be rejected'
);

const executableSink = structuredClone(inventory);
executableSink.prohibited.push(negative.prohibited[0]);
assert.ok(
  verifyInventory(executableSink, policy).some((message) => message.includes('prohibited sink')),
  'a prohibited sink must fail even when approved counts remain unchanged'
);

console.log('HTML sink policy tests passed.');
