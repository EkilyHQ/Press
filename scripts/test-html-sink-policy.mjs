import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectHtmlScriptElements,
  collectHtmlStartTags,
  isJavascriptUrlAttributeValue,
  readHtmlAttribute
} from '../assets/js/content-security-policy.mjs';
import {
  dispositionHash,
  scanJavaScriptSource,
  scanRepository,
  verifyInventory,
  verifyPolicyTransition
} from './check-html-sink-policy.mjs';
import { resolveLanguageModuleUrl } from '../assets/js/i18n.js';
import { resolveModuleEntry } from '../assets/js/theme-layout.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

async function read(relativePath) {
  return readFile(path.join(SCRIPT_DIR, relativePath), 'utf8');
}

const unusualScriptElements = collectHtmlScriptElements(
  `<!-- <script>ignored()</script> -->
   <script data-label=">">const marker = '</scriptx>'; safe();</script\t\n data-ignored>
   <script src="./external.js"></script>`,
  'script tokenizer fixture'
);
assert.equal(unusualScriptElements.length, 2, 'comments and tag-like script text must not distort script inventory');
assert.equal(
  unusualScriptElements[0].source,
  "const marker = '</scriptx>'; safe();",
  'script raw text must close only on a boundary-delimited script end tag'
);
assert.match(unusualScriptElements[0].attributes, /data-label=">"/u);
assert.equal(unusualScriptElements[1].attributeMap.has('src'), true);
assert.equal(readHtmlAttribute(' data-src="./not-a-script-source.js"', 'src'), '');
assert.equal(readHtmlAttribute(' data-src="ignored" src="./external.js"', 'src'), './external.js');
assert.equal(readHtmlAttribute(' data-type="module"', 'type'), '');
assert.equal(readHtmlAttribute(' data-type="ignored" type="module"', 'type'), 'module');
assert.equal(readHtmlAttribute(` data-x=" src='fake.js'"`, 'src'), '');
assert.equal(readHtmlAttribute(` data-x=" type='module'"`, 'type'), '');
assert.equal(readHtmlAttribute('\u00a0src="fake.js"', 'src'), '');
assert.equal(readHtmlAttribute('\vtype="module"', 'type'), '');
assert.equal(readHtmlAttribute('<meta data-name="ignored" name="viewport">', 'name'), 'viewport');
assert.deepEqual(
  collectHtmlStartTags(
    '<!-- <meta name="comment"> --><META name="description" content="one > zero"/><script>const fake = \'<meta name="fake">\';</script><style>.x::after { content: \'<meta name="style">\'; }</style><meta data-http-equiv="content-security-policy" name=\'viewport\'>',
    'meta',
    'meta tokenizer fixture'
  ).map(({ tag, attributeMap }) => ({ tag, attributes: Object.fromEntries(attributeMap) })),
  [
    {
      tag: '<META name="description" content="one > zero"/>',
      attributes: { name: 'description', content: 'one > zero' }
    },
    {
      tag: '<meta data-http-equiv="content-security-policy" name=\'viewport\'>',
      attributes: { 'data-http-equiv': 'content-security-policy', name: 'viewport' }
    }
  ],
  'meta collection must parse exact attributes and ignore comments plus raw text'
);
for (const value of [
  'javascript:alert(1)',
  'java&#x73;cript:alert(1)',
  'jav&#97;script&colon;alert(1)',
  'java&#x0a;script:alert(1)',
  'java\tscript:alert(1)',
  '&Tab;javascript:alert(1)'
]) {
  assert.equal(isJavascriptUrlAttributeValue(value), true, value);
}
for (const value of [
  'https://example.test/?next=javascript:alert(1)',
  'java script:alert(1)',
  './javascript:file.js'
]) {
  assert.equal(isJavascriptUrlAttributeValue(value), false, value);
}
assert.deepEqual(
  collectHtmlStartTags(
    '<svg><title><a href="javascript:one">one</a></title><iframe><a href="javascript:two">two</a></iframe><script><a href="javascript:three">three</a></script><style><a href="javascript:four">four</a></style><plaintext><a href="javascript:five">five</a></plaintext><foreignObject><script>const fake = \'<a href="javascript:fake">\';</script></foreignObject></svg>',
    'a',
    'foreign namespace fixture'
  ).map(({ attributeMap }) => attributeMap.get('href')),
  ['javascript:one', 'javascript:two', 'javascript:three', 'javascript:four', 'javascript:five'],
  'conservative collection must not apply HTML raw-text rules inside foreign content'
);
assert.deepEqual(
  collectHtmlStartTags('<svg / ><iframe><a href="javascript:solidus">x</a></iframe></svg>', 'a').map(
    ({ attributeMap }) => attributeMap.get('href')
  ),
  ['javascript:solidus'],
  'a solidus followed by whitespace must not self-close a foreign-content boundary'
);
assert.equal(
  collectHtmlStartTags('<svg/><iframe><a href="javascript:not-an-element">x</a></iframe>', 'a').length,
  0,
  'an immediate solidus must retain the browser self-closing boundary'
);
assert.equal(
  collectHtmlScriptElements('İ<ScRiPt>caseSafe()</ScRiPt data-ignored>', 'case fixture')[0].source,
  'caseSafe()'
);
assert.equal(
  collectHtmlScriptElements(
    '<script data-src="./external.js">inlineSafe()</script>',
    'data src fixture'
  )[0].attributeMap.has('src'),
  false
);
for (const source of ['<!-- x --!><script>danger()</script> -->', '<!--><script>danger()</script> -->']) {
  assert.equal(collectHtmlScriptElements(source, 'comment edge fixture')[0].source, 'danger()');
}
for (const source of [
  '<div foo=bar" ><script>MARK()</script> " >',
  '<div foo" ><script>MARK()</script> " >',
  '<div=" ><script>MARK()</script> " >',
  '<div" ><script>MARK()</script> " >',
  '</div" ><script>MARK()</script> " >'
]) {
  assert.equal(collectHtmlScriptElements(source, 'invalid quote fixture')[0].source, 'MARK()');
}
assert.deepEqual(
  collectHtmlScriptElements(
    '<script>safe()</script foo=bar" ><script>danger()</script> " >',
    'closing tag quote fixture'
  ).map(({ source }) => source),
  ['safe()', 'danger()']
);
assert.throws(() => collectHtmlScriptElements('<script>missing close', 'missing close fixture'), /without an end tag/u);
assert.throws(() => collectHtmlScriptElements('</script>', 'unmatched close fixture'), /unmatched script end tag/u);
assert.throws(() => collectHtmlScriptElements('<!-- missing close', 'comment fixture'), /unterminated HTML comment/u);
assert.throws(
  () => collectHtmlScriptElements('<?x " ><script>danger()</script> " >', 'bogus declaration fixture'),
  /unsupported HTML declaration syntax/u
);

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
const negativeIntervalSource = ['window.set', 'Interval(`execute()`, 0);'].join('');
const negative = scanJavaScriptSource({
  filePath: negativePath,
  source: `${await read('fixtures/html-sink-policy/negative.mjs')}\n${negativeIntervalSource}\n`
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

const documentAliases = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/document-aliases.mjs',
  source: `
    export function writeFrames(frame, markup) {
      const doc = frame.contentDocument;
      const write = doc.write;
      write(markup);
      const { writeln } = frame.ownerDocument;
      consume(writeln);
      frame.ownerDocument.write(markup);
    }
  `
});
assert.deepEqual(
  documentAliases.prohibited.map(({ kind }) => kind).sort(),
  [
    'document.write',
    'document.write-indirect-call',
    'document.write-indirect-reference',
    'document.writeln-indirect-reference'
  ].sort(),
  'document aliases and content/owner document references must remain fail-closed'
);

const mutatedAndForwardedDocuments = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/mutated-and-forwarded-documents.mjs',
  source: `
    let documentAlias = document;
    documentAlias = document;
    documentAlias.write(markup);
    documentAlias = safeObject;
    function forward(documentParameter, markup) {
      documentParameter.writeln(markup);
    }
    forward(document, markup);
  `
});
for (const kind of ['document.write', 'document.writeln']) {
  assert.ok(
    mutatedAndForwardedDocuments.prohibited.some((finding) => finding.kind === kind),
    `mutated aliases and local parameter forwarding must retain ${kind}`
  );
}

const callableAliases = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/callable-aliases.mjs',
  source: `
    export function render(target, parser, range, markup, mime) {
      if (typeof target.insertAdjacentHTML === 'function') consume(target);
      const insert = target.insertAdjacentHTML;
      insert('beforeend', markup);
      const parse = parser.parseFromString;
      parse(markup, 'application/xml');
      parser.parseFromString(markup, mime);
      const { createContextualFragment } = range;
      consume(createContextualFragment);
    }
  `
});
assert.deepEqual(
  callableAliases.prohibited.map(({ kind }) => kind).sort(),
  [
    'DOMParser-indirect-call',
    'DOMParser-unproven-mime',
    'createContextualFragment-indirect-reference',
    'insertAdjacentHTML-indirect-call',
    'insertAdjacentHTML-indirect-reference',
    'parseFromString-indirect-reference'
  ].sort(),
  'native callable aliases and opaque parser MIME values must not bypass the sink gate'
);

const unsafeHtmlApis = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/unsafe-html-apis.mjs',
  source: `
    export function render(target, markup) {
      target.setHTMLUnsafe(markup);
      Document.parseHTMLUnsafe(markup);
      target['setHTMLUnsafe'](markup);
      const unsafe = target.setHTMLUnsafe;
      unsafe(markup);
      const { parseHTMLUnsafe } = Document;
      consume(parseHTMLUnsafe);
      Reflect.get(target, 'setHTMLUnsafe');
    }
  `
});
for (const kind of [
  'setHTMLUnsafe',
  'parseHTMLUnsafe',
  'setHTMLUnsafe-indirect-call',
  'setHTMLUnsafe-indirect-reference',
  'parseHTMLUnsafe-indirect-reference'
]) {
  assert.ok(
    unsafeHtmlApis.prohibited.some((finding) => finding.kind === kind),
    `unsafe HTML APIs must retain ${kind}`
  );
}
const safeHtmlApi = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-html-api.mjs',
  source: `target.setHTML(markup);`
});
assert.deepEqual(safeHtmlApi, { approved: [], prohibited: [] }, 'the built-in sanitizing setHTML API must stay clean');

const opaqueComputedSinks = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/opaque-computed-sinks.mjs',
  source: `
    export function render(element, property, method, markup) {
      element[property] = markup;
      for (element[property] of values) consume(element);
      for (element[property] in values) consume(element);
      for ({ value: element[property] } of values) consume(element);
      element[method](markup);
      const invoke = element[method];
      invoke(markup);
      element[method].call(element, markup);
      element[method].bind(element);
      element[method]\`<p>markup</p>\`;
      new element[method](markup);
      element['innerHTML'] = markup;
      element['insertAdjacentHTML']('beforeend', markup);
    }
  `
});
assert.deepEqual(
  opaqueComputedSinks.approved.map(({ kind }) => kind).sort(),
  [
    'computed-property-control',
    'computed-property-control',
    'computed-property-control',
    'computed-property-control',
    'computed-property-control',
    'computed-property-control',
    'computed-property-control',
    'computed-property-control',
    'computed-property-control',
    'computed-property-control',
    'innerHTML-write',
    'insertAdjacentHTML'
  ].sort(),
  'opaque computed operations must enter the exact uncertainty inventory while static sinks retain exact kinds'
);
assert.deepEqual(
  opaqueComputedSinks.approved
    .filter(({ kind }) => kind === 'computed-property-control')
    .map(({ operation }) => operation)
    .sort(),
  [
    'html-assignment-unproven-property',
    'html-assignment-unproven-property',
    'html-assignment-unproven-property',
    'html-assignment-unproven-property',
    'html-call-unproven-property',
    'html-call-unproven-property',
    'html-call-unproven-property',
    'html-call-unproven-property',
    'html-call-unproven-property',
    'html-call-unproven-property'
  ].sort(),
  'direct, loop-target, aliased, call, bind, tag, and constructor computed operations must remain explicit uncertainty controls'
);
assert.equal(opaqueComputedSinks.prohibited.length, 0);
const safeComputedProperties = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-computed-properties.mjs',
  source: `
    export function render(element, text) {
      element['textContent'] = text;
      for (element['textContent'] of values) consume(element);
      for (element['textContent'] in values) consume(element);
      element['focus']();
      element['tag']\`static\`;
      new element['Widget']();
      element.textContent = text;
      element.focus();
    }
  `
});
assert.deepEqual(safeComputedProperties, { approved: [], prohibited: [] }, 'static safe properties must remain clean');

const wrappedOpaqueComputedSinks = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/wrapped-opaque-computed-sinks.mjs',
  source: `
    export async function render(target, method, markup, flag, fallback) {
      (0, target[method])(markup);
      (flag ? target[method] : fallback)(markup);
      (target[method] || fallback)(markup);
      const awaited = await target[method];
      awaited(markup);
      const { [method]: destructured } = target;
      destructured(markup);
      let assigned;
      assigned = target[method];
      assigned(markup);
      (0, target[method])\`markup\`;
      (flag ? target[method] : fallback)\`markup\`;
      new (0, target[method])(markup);
      new (flag ? target[method] : fallback)(markup);
      Reflect.apply(target[method], target, [markup]);
      Reflect.construct(target[method], [markup]);
      Function.prototype.call.call(target[method], target, markup);
      Function.prototype.apply.call(target[method], target, [markup]);
      const forwarded = target[method];
      Function.prototype.call.call(forwarded, target, markup);
    }
  `
});
const wrappedComputedControls = wrappedOpaqueComputedSinks.approved.filter(
  ({ kind }) => kind === 'computed-property-control'
);
assert.equal(
  wrappedComputedControls.length,
  16,
  'wrapped calls, aliases, tags, and constructors must each retain one computed-property control'
);
assert.equal(
  new Set(wrappedComputedControls.map(({ line, column, operation }) => `${line}:${column}:${operation}`)).size,
  wrappedComputedControls.length,
  'each wrapped computed operation must be recorded exactly once at its own boundary'
);
assert.ok(
  wrappedOpaqueComputedSinks.approved
    .filter(({ kind }) => kind === 'computed-property-control')
    .every(({ operation }) => operation === 'html-call-unproven-property'),
  'wrapped computed callable controls must retain their call uncertainty operation'
);
assert.equal(wrappedOpaqueComputedSinks.prohibited.length, 0);
const mutatedHigherOrderWrappers = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/mutated-higher-order-wrappers.mjs',
  source: `
    let apply = Reflect.apply;
    apply = Reflect.apply;
    apply(target[method], target, [markup]);
    let construct = Reflect.construct;
    construct = Reflect.construct;
    construct(target[method], [markup]);
    let call = Function.prototype.call;
    call = Function.prototype.call;
    call.call(target[method], target, markup);
  `
});
assert.equal(
  mutatedHigherOrderWrappers.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  3,
  'mutated Reflect and Function.prototype wrapper aliases must retain one computed-call control each'
);
assert.equal(mutatedHigherOrderWrappers.prohibited.length, 0);
const forwardedComputedParameters = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/forwarded-computed-parameters.mjs',
  source: `
    function direct(fn) { fn(markup); }
    function alias(fn) { const run = fn; run(markup); }
    function reflect(fn) { Reflect.apply(fn, target, [markup]); }
    function construct(fn) { new fn(markup); }
    function tag(fn) { fn\`markup\`; }
    direct(target[method]);
    alias(target[method]);
    reflect(target[method]);
    construct(target[method]);
    tag(target[method]);
  `
});
assert.equal(
  forwardedComputedParameters.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  5,
  'computed callables forwarded through local parameters must retain direct, alias, Reflect, new, and tag controls'
);
const forwardedComputedCallForms = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/forwarded-computed-call-forms.mjs',
  source: `
    function invoke(fn) { fn(markup); }
    invoke.call(null, target[method]);
    invoke.apply(null, [target[method]]);
    invoke.bind(null, target[method])();
    Reflect.apply(invoke, null, [target[method]]);
    Reflect.construct(invoke, [target[method]]);
    Function.prototype.call.call(invoke, null, target[method]);
    invoke(...[target[method]]);
  `
});
assert.equal(
  forwardedComputedCallForms.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  1,
  'all local wrapper call forms must converge on the same callable-parameter control'
);
for (const [label, invocation] of [
  ['Function apply', 'invoke.apply(null, [target[method], ...rest]);'],
  ['Reflect apply', 'Reflect.apply(invoke, null, [target[method], ...rest]);']
]) {
  const visibleApplyPrefix = scanJavaScriptSource({
    filePath: `scripts/fixtures/html-sink-policy/${label.toLowerCase().replaceAll(' ', '-')}-visible-prefix.mjs`,
    source: `
      function invoke(fn) { fn(markup); }
      const rest = getArguments();
      ${invocation}
    `
  });
  assert.equal(
    visibleApplyPrefix.approved.filter(({ kind }) => kind === 'computed-property-control').length,
    1,
    `${label} must preserve a position-stable argument prefix before an opaque spread`
  );
  assert.equal(visibleApplyPrefix.prohibited.length, 0);
}
const safeVisibleApplyPrefixes = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-visible-apply-prefixes.mjs',
  source: `
    function invoke(fn) { fn(markup); }
    const rest = getArguments();
    invoke.apply(null, [safe, ...rest]);
    Reflect.apply(invoke, null, [safe, ...rest]);
  `
});
assert.deepEqual(
  safeVisibleApplyPrefixes,
  { approved: [], prohibited: [] },
  'safe visible prefixes before opaque spreads must stay clean'
);
const forwardedSafeParameters = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/forwarded-safe-parameters.mjs',
  source: `
    function direct(fn) { fn(markup); }
    function alias(fn) { const run = fn; run(markup); }
    function reflect(fn) { Reflect.apply(fn, target, [markup]); }
    function construct(fn) { new fn(markup); }
    function tag(fn) { fn\`markup\`; }
    direct(safe);
    alias(safe);
    reflect(safe);
    construct(Safe);
    tag(safe);
  `
});
assert.deepEqual(forwardedSafeParameters, { approved: [], prohibited: [] }, 'safe forwarded callables must stay clean');
const forwardedComputedMethods = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/forwarded-computed-methods.mjs',
  source: `
    const handlers = {
      invoke(fn) { fn(markup); },
      arrow: (fn) => fn(markup)
    };
    class Handler {
      invoke(fn) { fn(markup); }
      arrow = (fn) => fn(markup);
    }
    handlers.invoke(target[method]);
    handlers.arrow(target[method]);
    new Handler().invoke(target[method]);
    new Handler().arrow(target[method]);
  `
});
assert.equal(
  forwardedComputedMethods.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  4,
  'object and class methods must propagate computed callable arguments only into their callable parameters'
);
const installedComputedMethods = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/installed-computed-methods.mjs',
  source: `
    const assigned = {};
    assigned.invoke = function (fn) { fn(markup); };
    assigned.invoke(target[method]);
    const extended = {};
    Object.assign(extended, { invoke(fn) { fn(markup); } });
    extended.invoke(target[method]);
    function Handler() {}
    Handler.prototype.invoke = function (fn) { fn(markup); };
    new Handler().invoke(target[method]);
  `,
  sourceType: 'script'
});
assert.equal(
  installedComputedMethods.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  3,
  'assigned, extended, and prototype-installed local wrappers must retain their callable controls'
);
const forwardedSafeMethods = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/forwarded-safe-methods.mjs',
  source: `
    const handlers = { invoke(fn) { fn(markup); } };
    class Handler { invoke(fn) { fn(markup); } }
    handlers.invoke(safe);
    new Handler().invoke(safe);
  `
});
assert.deepEqual(forwardedSafeMethods, { approved: [], prohibited: [] }, 'safe method forwarding must stay clean');
const safeWrappedProperties = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-wrapped-properties.mjs',
  source: `
    export async function render(target, fallback, flag) {
      (0, target['focus'])();
      (flag ? target['focus'] : fallback)();
      (target['focus'] || fallback)();
      const awaited = await target['focus'];
      awaited();
      const { ['focus']: destructured } = target;
      destructured();
      (0, target['tag'])\`static\`;
      new (flag ? target['Widget'] : fallback)();
      Reflect.apply(target['focus'], target, []);
      Reflect.construct(target['Widget'], []);
      Function.prototype.call.call(target['focus'], target);
      Function.prototype.apply.call(target['focus'], target, []);
    }
  `
});
assert.deepEqual(safeWrappedProperties, { approved: [], prohibited: [] }, 'static wrapped properties must stay clean');

for (const [label, source] of [
  ['sequence eval', `(0, eval)('alert(1)');`],
  ['conditional eval', `(flag ? eval : safe)('alert(1)');`],
  ['assigned eval', `let run; run = eval; run('alert(1)');`],
  ['destructured eval', `const { eval: run } = globalThis; run('alert(1)');`],
  ['Reflect.apply eval', `Reflect.apply(eval, globalThis, ['alert(1)']);`],
  ['prototype call eval', `Function.prototype.call.call(eval, globalThis, 'alert(1)');`],
  ['Reflect prototype call eval', `Reflect.apply(Function.prototype.call, eval, [globalThis, 'alert(1)']);`],
  ['sequence Function call', `(0, Function)('return 1');`],
  ['sequence Function constructor', `new (0, Function)('return 1');`],
  ['conditional Function constructor', `new (flag ? Function : Safe)('return 1');`],
  ['assigned Function', `let Build; Build = Function; new Build('return 1');`],
  ['destructured Function', `const { Function: Build } = globalThis; new Build('return 1');`],
  ['Reflect.construct Function', `Reflect.construct(Function, ['return 1']);`],
  ['arrow constructor', `(() => {}).constructor('return 1')();`],
  ['async constructor', `(async () => {}).constructor('return 1')();`],
  ['Function prototype constructor', `Function.prototype.constructor('return 1')();`],
  ['Reflect arrow constructor', `Reflect.apply((() => {}).constructor, null, ['return 1'])();`],
  ['class constructor', `class C {} C.constructor('return 1')();`],
  ['Array constructor', `Array.constructor('return 1')();`],
  ['Object constructor', `Object.constructor('return 1')();`],
  ['timer constructor', `setTimeout.constructor('return 1')();`]
]) {
  const result = scanJavaScriptSource({
    filePath: `scripts/fixtures/html-sink-policy/${label.replaceAll(' ', '-')}.mjs`,
    source
  });
  assert.ok(result.prohibited.length > 0, `${label} must fail closed`);
}
const safeCallableWrappers = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-callable-wrappers.mjs',
  source: `
    (0, safe)('text');
    (flag ? safe : fallback)('text');
    Reflect.apply(safe, globalThis, ['text']);
    Reflect.construct(Safe, ['text']);
  `
});
assert.deepEqual(safeCallableWrappers, { approved: [], prohibited: [] }, 'ordinary callable wrappers must stay clean');

const callableStorageAndConstructorEdges = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/callable-storage-and-constructor-edges.mjs',
  source: `
    const box = { run: eval };
    box.build = Function;
    Object.defineProperty(box, 'later', { value: setTimeout });
    Reflect.get(() => {}, 'constructor')('return 42')();
    Function\`return 42\`()
  `
});
for (const kind of [
  'eval-indirect-storage',
  'Function-indirect-storage',
  'setTimeout-indirect-storage',
  'Function-constructor-direct-call',
  'Function-constructor-tag'
]) {
  assert.ok(
    callableStorageAndConstructorEdges.prohibited.some((finding) => finding.kind === kind),
    `global callable storage and constructor edges must retain ${kind}`
  );
}
const returnedCallableEdges = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/returned-callable-edges.mjs',
  source: `
    function identity(fn) { return fn; }
    identity(target[method])(markup);
    identity(eval)(source);
    identity(Function)('return 1');
    identity(setTimeout)('alert(1)', 0);
    const holder = {
      getComputed() { return target[method]; },
      get run() { return eval; }
    };
    holder.getComputed()(markup);
    holder.run(source);
  `
});
assert.equal(
  returnedCallableEdges.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  2,
  'local function and method returns must preserve computed callable provenance'
);
for (const kind of ['eval-direct-call', 'Function-constructor-direct-call', 'setTimeout-string']) {
  assert.ok(
    returnedCallableEdges.prohibited.some((finding) => finding.kind === kind),
    `returned dangerous callables must retain ${kind}`
  );
}

const dangerousPrototypeForwarding = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/dangerous-prototype-forwarding.mjs',
  source: `
    eval.call.call(eval, null, source);
    eval.apply.call(eval, null, [source]);
    eval.call.apply(eval, [null, source]);
    Reflect.apply(eval.call, eval, [null, source]);
    eval.bind.call(eval, null, source)();
    Function.call.call(Function, null, 'return 1');
    setTimeout.call.call(setTimeout, null, 'alert(1)', 0);
  `
});
assert.ok(
  dangerousPrototypeForwarding.prohibited.filter(({ kind }) => kind.startsWith('eval-')).length >= 5,
  'dangerous callable prototype forwarding must remain visible in every call/apply/bind form'
);
assert.ok(
  dangerousPrototypeForwarding.prohibited.some(({ kind }) => kind.startsWith('Function-constructor-')) &&
    dangerousPrototypeForwarding.prohibited.some(({ kind }) => kind === 'setTimeout-string'),
  'Function and timer prototype forwarding must retain their concrete hazards'
);
const safePrototypeForwarding = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-prototype-forwarding.mjs',
  source: `safe.call.call(safe, null, value); Reflect.apply(safe.call, safe, [null, value]);`
});
assert.deepEqual(
  safePrototypeForwarding,
  { approved: [], prohibited: [] },
  'ordinary prototype forwarding must stay clean'
);
const shadowedCallableNames = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/shadowed-callable-storage.mjs',
  sourceType: 'script',
  source: `
    function store(eval, Function, setTimeout) {
      const box = { run: eval };
      box.build = Function;
      box.later = setTimeout;
      return box;
    }
  `
});
assert.deepEqual(shadowedCallableNames, { approved: [], prohibited: [] }, 'shadowed callable names must stay clean');

const destructuredCallableContainers = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/destructured-callable-containers.mjs',
  source: `
    const [run] = [eval];
    run(source);
    const [Build] = [Function];
    new Build(source);
    const [later] = [setTimeout];
    later('alert(1)');
    const [dynamic] = [target[method]];
    dynamic(markup);
    const { invoke } = { invoke: target[method] };
    invoke(markup);
  `
});
for (const kind of ['eval-direct-call', 'new-Function', 'setTimeout-string']) {
  assert.ok(
    destructuredCallableContainers.prohibited.some((finding) => finding.kind === kind),
    `literal container destructuring must retain ${kind}`
  );
}
assert.equal(
  destructuredCallableContainers.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  2,
  'array and object literal destructuring must retain computed callable controls at invocation'
);
const assignedDestructuredCallables = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/assigned-destructured-callables.mjs',
  source: `
    let objectRun;
    ({ run: objectRun } = { run: target[method] });
    objectRun(markup);
    let arrayRun;
    [arrayRun] = [target[method]];
    arrayRun(markup);
    let nestedRun;
    ({ nested: { run: nestedRun } } = { nested: { run: target[method] } });
    nestedRun(markup);
  `
});
assert.equal(
  assignedDestructuredCallables.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  3,
  'destructuring assignments must project object, array, and nested callable values'
);
const safeDestructuredCallable = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-destructured-callable.mjs',
  source: `const [run] = [() => {}]; const { invoke } = { invoke: () => {} }; run(); invoke();`
});
assert.deepEqual(
  safeDestructuredCallable,
  { approved: [], prohibited: [] },
  'safe literal destructuring must stay clean'
);

const classFieldCallableStorage = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/class-field-callable-storage.mjs',
  source: `
    class Handler {
      run = eval;
      static Build = Function;
      dynamic = target[method];
      safe = () => {};
    }
    new Handler().dynamic(markup);
    new Handler().safe(markup);
  `
});
for (const kind of ['eval-indirect-storage', 'Function-indirect-storage']) {
  assert.ok(
    classFieldCallableStorage.prohibited.some((finding) => finding.kind === kind),
    `class fields must retain ${kind}`
  );
}
assert.equal(
  classFieldCallableStorage.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  1,
  'an invoked computed class field must retain one call-boundary control while a safe arrow stays clean'
);

for (const [label, source] of [
  ['timeout call', `setTimeout.call(globalThis, 'alert(1)', 0);`],
  ['interval apply', `setInterval.apply(globalThis, ['alert(1)', 0]);`],
  ['timeout bind', `setTimeout.bind(globalThis, 'alert(1)', 0)();`],
  ['timeout Reflect.apply', `Reflect.apply(setTimeout, globalThis, ['alert(1)', 0]);`],
  ['assigned timeout', `let later; later = setTimeout; later('alert(1)', 0);`],
  ['destructured timeout', `const { setTimeout: later } = globalThis; later('alert(1)', 0);`],
  ['sequence timeout', `(0, setTimeout)('alert(1)', 0);`],
  ['new timeout', `new setTimeout('alert(1)', 0);`],
  ['new interval', `new setInterval('alert(1)', 0);`],
  ['prototype timeout', `Function.prototype.call.call(setTimeout, globalThis, 'alert(1)', 0);`]
]) {
  const result = scanJavaScriptSource({
    filePath: `scripts/fixtures/html-sink-policy/${label.replaceAll(' ', '-')}.mjs`,
    source
  });
  assert.ok(result.prohibited.length > 0, `${label} must fail closed`);
}
const safeTimerWrappers = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-timer-wrappers.mjs',
  source: `
    setTimeout.call(globalThis, () => {}, 0);
    Reflect.apply(setInterval, globalThis, [() => {}, 0]);
    setTimeout.bind(globalThis)(() => {}, 0);
    new setTimeout(() => {}, 0);
    function withDefault(later = setTimeout) { later(() => {}, 0); }
    let assigned;
    assigned = setTimeout;
    assigned(() => {}, 0);
    const { setTimeout: destructured } = globalThis;
    destructured(() => {}, 0);
  `
});
assert.deepEqual(safeTimerWrappers, { approved: [], prohibited: [] }, 'callable timer wrappers must stay clean');

const immediateAssignedComputedCall = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/immediate-assigned-computed-call.mjs',
  source: `let assigned; (assigned = target[method])(markup);`
});
assert.equal(
  immediateAssignedComputedCall.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  1,
  'an immediately invoked computed assignment must retain exactly one call-boundary control'
);

const reflectiveWrites = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/reflective-writes.mjs',
  source: `
    export function reflect(target, markup) {
      const reflectSet = Reflect.set;
      reflectSet(target, 'innerHTML', markup);
      const reflectGet = Reflect.get;
      consume(reflectGet(target, 'insertAdjacentHTML'));
      consume(Reflect.get(Object, 'assign'));
      consume(Reflect.get(Reflect, 'set'));
      const payload = { innerHTML: markup };
      const spreadPayload = { ...payload };
      const assign = Object.assign;
      assign(target, spreadPayload);
      assign(otherTarget, spreadPayload);
      Object.defineProperty(target, 'outerHTML', { value: markup });
      const descriptors = { srcdoc: { value: markup } };
      Object.defineProperties(target, descriptors);
      const { defineProperties } = Object;
      consume(defineProperties);
    }
  `
});
assert.deepEqual(
  reflectiveWrites.prohibited.map(({ kind }) => kind).sort(),
  [
    'Object.assign-innerHTML',
    'Object.assign-innerHTML',
    'Object.assign-indirect-reference',
    'Object.assign-indirect-reference',
    'Object.defineProperties-indirect-reference',
    'Object.defineProperties-srcdoc',
    'Object.defineProperty-outerHTML',
    'Reflect.get-indirect-reference',
    'Reflect.set-indirect-reference',
    'Reflect.set-indirect-reference',
    'Reflect.set-innerHTML',
    'insertAdjacentHTML-indirect-reference'
  ].sort(),
  'helper aliases, const/spread payloads, repeated call sites, and defineProperties must remain visible'
);

const mutatedAndInjectedReflectionHelpers = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/mutated-and-injected-reflection-helpers.mjs',
  source: `
    let O = Object;
    O = Object;
    O.assign(target, { innerHTML: markup });
    let R = Reflect;
    R = Reflect;
    R.set(target, 'outerHTML', markup);
    export function injected(O, R, target, markup) {
      O.assign(target, { srcdoc: markup });
      R.set(target, 'innerHTML', markup);
    }
  `
});
for (const kind of [
  'Object.assign-innerHTML',
  'Reflect.set-outerHTML',
  'Object.assign-srcdoc-unproven-owner',
  'Reflect.set-innerHTML-unproven-owner'
]) {
  assert.ok(
    mutatedAndInjectedReflectionHelpers.prohibited.some((finding) => finding.kind === kind),
    `mutated and injected reflection helpers must retain ${kind}`
  );
}

const unownedOpaqueReflectionHelpers = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/unowned-opaque-reflection-helpers.mjs',
  source: `
    export function reflect(R, O, target, key, markup, payload, descriptors) {
      R.set(target, key, markup);
      R.get(target, key);
      O.assign(target, payload);
      O.defineProperty(target, key, { value: markup });
      O.defineProperties(target, descriptors);
    }
  `
});
for (const kind of [
  'Reflect.set-unproven-property-unproven-owner',
  'Reflect.get-unproven-property-unproven-owner',
  'Object.assign-unproven-payload-unproven-owner',
  'Object.defineProperty-unproven-property-unproven-owner',
  'Object.defineProperties-unproven-descriptors-unproven-owner'
]) {
  assert.ok(
    unownedOpaqueReflectionHelpers.prohibited.some((finding) => finding.kind === kind),
    `unknown helper receivers and opaque arguments must retain ${kind}`
  );
}
const wrappedUnownedReflectionHelpers = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/wrapped-unowned-reflection-helpers.mjs',
  source: `
    export function reflect(O, target, key, markup, payload) {
      O.assign.call(O, target, { innerHTML: markup });
      O.assign.apply(O, [target, { srcdoc: markup }]);
      O.defineProperty.bind(O, target, key, { value: markup })();
      Reflect.apply(O.assign, O, [target, payload]);
    }
  `
});
for (const kind of [
  'Object.assign-innerHTML-unproven-owner',
  'Object.assign-srcdoc-unproven-owner',
  'Object.defineProperty-unproven-property-unproven-owner',
  'Object.assign-unproven-payload-unproven-owner'
]) {
  assert.ok(
    wrappedUnownedReflectionHelpers.prohibited.some((finding) => finding.kind === kind),
    `wrapped injected reflection helpers must retain ${kind}`
  );
}

const reflectionCallForms = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/reflection-call-forms.mjs',
  source: `
    const assignArgs = [target, { srcdoc: markup }];
    const boundAssign = Object.assign.bind(Object);
    const boundSet = Reflect.set.bind(Reflect, target, 'innerHTML');
    export function reflect(target, markup, opaqueArgs) {
      Object.assign.call(Object, target, { innerHTML: markup });
      Object.assign.apply(Object, assignArgs);
      Object.assign.apply(Object, opaqueArgs);
      Reflect.set.call(Reflect, target, 'outerHTML', markup);
      Object.defineProperties.call(Object, target, { srcdoc: { value: markup } });
      boundAssign(target, { srcdoc: markup });
      boundSet(markup);
    }
  `
});
for (const kind of [
  'Object.assign-bind',
  'Object.assign-call',
  'Object.assign-apply',
  'Object.assign-opaque-apply',
  'Object.assign-innerHTML',
  'Object.assign-srcdoc',
  'Object.defineProperties-call',
  'Object.defineProperties-srcdoc',
  'Reflect.set-bind',
  'Reflect.set-call',
  'Reflect.set-innerHTML',
  'Reflect.set-outerHTML'
]) {
  assert.ok(
    reflectionCallForms.prohibited.some((finding) => finding.kind === kind),
    `${kind} must remain visible through bind/call/apply normalization`
  );
}

const safeReflectionCall = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/reflection-call-swap.mjs',
  source: 'Object.assign.call(Object, target, { textContent: markup });'
}).prohibited.find(({ kind }) => kind === 'Object.assign-call');
const dangerousReflectionCall = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/reflection-call-swap.mjs',
  source: 'Object.assign.call(Object, target, { innerHTML: markup });'
}).prohibited.find(({ kind }) => kind === 'Object.assign-call');
assert.notEqual(
  safeReflectionCall.semanticFingerprint,
  dangerousReflectionCall.semanticFingerprint,
  'whole-call identity must bind reflection payload semantics'
);

const opaqueReflection = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/opaque-reflection.mjs',
  source: `
    export function reflect(target, key, markup, payload, descriptors) {
      Reflect.set(target, key, markup);
      Reflect.get(target, key);
      Object.assign(target, payload);
      Object.defineProperty(target, key, { value: markup });
      Object.defineProperties(target, descriptors);
    }
  `
});
assert.deepEqual(
  opaqueReflection.prohibited.map(({ kind }) => kind).sort(),
  [
    'Object.assign-unproven-payload',
    'Object.defineProperties-unproven-descriptors',
    'Object.defineProperty-unproven-property',
    'Reflect.get-unproven-property',
    'Reflect.set-unproven-property'
  ].sort(),
  'opaque reflective keys, payloads, and descriptors must fail closed as whole calls'
);

const reflectedHelperRetrieval = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/reflected-helper-retrieval.mjs',
  source: `
    export function reflect(target, markup) {
      Reflect.get(Object, 'assign')(target, { innerHTML: markup });
      const assign = Reflect.get(Object, 'assign');
      assign(target, { srcdoc: markup });
      const set = Reflect.get(Reflect, 'set');
      set(target, 'outerHTML', markup);
      Reflect.get(Object, 'keys')(target);
    }
  `
});
for (const kind of ['Object.assign-innerHTML', 'Object.assign-srcdoc', 'Reflect.set-outerHTML']) {
  assert.ok(
    reflectedHelperRetrieval.prohibited.some((finding) => finding.kind === kind),
    `${kind} must remain visible through static Reflect.get helper retrieval`
  );
}
assert.equal(
  reflectedHelperRetrieval.prohibited.some((finding) => finding.evidence.includes("Reflect.get(Object, 'keys')")),
  false,
  'non-reflective Object helpers retrieved through Reflect.get must remain a clean negative control'
);

const descriptorSetterLookups = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/descriptor-setters.mjs',
  source: `
    export function write(element, markup, property) {
      Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML').set.call(element, markup);
      const outerDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML');
      outerDescriptor.set.call(element, markup);
      Object.getOwnPropertyDescriptor(Element.prototype, property);
      Reflect.getOwnPropertyDescriptor(Element.prototype, 'srcdoc').set.call(element, markup);
      Object.getOwnPropertyDescriptor(Element.prototype, 'textContent').set.call(element, markup);
    }
  `
});
assert.deepEqual(
  descriptorSetterLookups.prohibited.map(({ kind }) => kind).sort(),
  [
    'Object.getOwnPropertyDescriptor-innerHTML-setter-reference',
    'Object.getOwnPropertyDescriptor-outerHTML-setter-reference',
    'Object.getOwnPropertyDescriptor-unproven-property',
    'Reflect.getOwnPropertyDescriptor-srcdoc-setter-reference'
  ].sort(),
  'descriptor-extracted HTML setters and opaque descriptor properties must be classified'
);
const descriptorCallableLookups = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/descriptor-callables.mjs',
  source: `
    Object.getOwnPropertyDescriptor(Range.prototype, 'createContextualFragment').value.call(range, markup);
    Object.getOwnPropertyDescriptors(Element.prototype).setHTMLUnsafe.value.call(element, markup);
    Object.getOwnPropertyDescriptor(Function.prototype, 'constructor').value('return 1')();
    Object.getOwnPropertyDescriptors(globalThis).eval.value(source);
    Object.getOwnPropertyDescriptor(globalThis, 'setTimeout').value('alert(1)', 0);
    Object.getOwnPropertyDescriptors(Document.prototype).write.value.call(document, markup);
  `
});
for (const kind of [
  'Object.getOwnPropertyDescriptor-createContextualFragment-value-reference',
  'Object.getOwnPropertyDescriptors-setHTMLUnsafe-value-reference',
  'Object.getOwnPropertyDescriptor-constructor-value-reference',
  'Object.getOwnPropertyDescriptors-eval-value-reference',
  'Object.getOwnPropertyDescriptor-setTimeout-value-reference',
  'Object.getOwnPropertyDescriptors-write-value-reference'
]) {
  assert.ok(
    descriptorCallableLookups.prohibited.some((finding) => finding.kind === kind),
    `descriptor-extracted callable HTML sinks must retain ${kind}`
  );
}
const descriptorHelperForms = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/descriptor-helper-forms.mjs',
  source: `
    const getDescriptor = Object.getOwnPropertyDescriptor;
    export function capture(target) {
      getDescriptor(target, 'innerHTML');
      Object.getOwnPropertyDescriptor.call(Object, target, 'outerHTML');
      Object.getOwnPropertyDescriptor.apply(Object, [target, 'srcdoc']);
      Object.getOwnPropertyDescriptor.bind(Object, target, 'innerHTML')();
      Reflect.get(Object, 'getOwnPropertyDescriptor')(target, 'innerHTML');
    }
  `
});
for (const kind of [
  'Object.getOwnPropertyDescriptor-innerHTML-setter-reference',
  'Object.getOwnPropertyDescriptor-outerHTML-setter-reference',
  'Object.getOwnPropertyDescriptor-srcdoc-setter-reference',
  'Object.getOwnPropertyDescriptor-apply',
  'Object.getOwnPropertyDescriptor-bind',
  'Object.getOwnPropertyDescriptor-call',
  'Object.getOwnPropertyDescriptor-indirect-reference'
]) {
  assert.ok(
    descriptorHelperForms.prohibited.some((finding) => finding.kind === kind),
    `descriptor helper aliases and invocation forms must retain ${kind}`
  );
}
const boundReflectionHelpers = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/bound-reflection-helpers.mjs',
  source: `
    export function write(target, markup) {
      Object.getOwnPropertyDescriptor.bind(Object, target, 'innerHTML')();
      Reflect.set.bind(Reflect, target, 'outerHTML', markup)();
      Object.assign.bind(Object, target, { srcdoc: markup })();
      Object.defineProperty.bind(Object, target, 'innerHTML', { value: markup })();
      Object.defineProperties.bind(Object, target, { outerHTML: { value: markup } })();
    }
  `
});
for (const kind of [
  'Object.getOwnPropertyDescriptor-innerHTML-setter-reference',
  'Reflect.set-outerHTML',
  'Object.assign-srcdoc',
  'Object.defineProperty-innerHTML',
  'Object.defineProperties-outerHTML'
]) {
  assert.equal(
    boundReflectionHelpers.prohibited.filter((finding) => finding.kind === kind).length,
    1,
    `bound helper invocation must classify ${kind} exactly once`
  );
}
for (const kind of [
  'Object.getOwnPropertyDescriptor-bind',
  'Reflect.set-bind',
  'Object.assign-bind',
  'Object.defineProperty-bind',
  'Object.defineProperties-bind'
]) {
  assert.equal(
    boundReflectionHelpers.prohibited.filter((finding) => finding.kind === kind).length,
    1,
    `bound helper creation must classify ${kind} exactly once`
  );
}
const defaultParameterDescriptorAliases = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/default-parameter-descriptor-aliases.mjs',
  source: `
    export function writeObject({ getOwnPropertyDescriptor: get } = Object, target, markup) {
      get(target, 'innerHTML').set.call(target, markup);
    }
    export function writeReflect({ getOwnPropertyDescriptor: get } = Reflect, target, markup) {
      get(target, 'outerHTML').set.call(target, markup);
    }
  `
});
assert.deepEqual(
  defaultParameterDescriptorAliases.prohibited.map(({ kind }) => kind).sort(),
  ['Object.getOwnPropertyDescriptor-indirect-reference', 'Reflect.getOwnPropertyDescriptor-indirect-reference'].sort(),
  'default-parameter descriptor aliases must fail closed at the destructuring boundary'
);
const defaultValueDescriptorAliases = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/default-value-descriptor-aliases.mjs',
  source: `
    export function write(target, markup, get = Object.getOwnPropertyDescriptor) {
      get(target, 'innerHTML').set.call(target, markup);
    }
    export function duplicate(
      { getOwnPropertyDescriptor: first, getOwnPropertyDescriptor: second } = Object
    ) {
      consume(first, second);
    }
  `
});
assert.equal(
  defaultValueDescriptorAliases.prohibited.filter(
    ({ kind }) => kind === 'Object.getOwnPropertyDescriptor-indirect-reference'
  ).length,
  2,
  'default-value aliases and duplicate destructuring must each emit one boundary finding'
);
assert.equal(
  defaultValueDescriptorAliases.prohibited.filter(
    ({ kind }) => kind === 'Object.getOwnPropertyDescriptor-innerHTML-setter-reference'
  ).length,
  1,
  'a default-value descriptor alias invocation must retain its concrete HTML setter finding'
);
const legacyDescriptorSetters = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/legacy-descriptor-setters.mjs',
  source: `
    export function write(target, markup, property) {
      Object.getOwnPropertyDescriptors(Element.prototype).innerHTML.set.call(target, markup);
      Object.getOwnPropertyDescriptors(Element.prototype).textContent.set.call(target, markup);
      Object.getOwnPropertyDescriptors(Element.prototype);
      Element.prototype.__lookupSetter__('innerHTML').call(target, markup);
      Element.prototype.__lookupSetter__('textContent').call(target, markup);
      Element.prototype.__lookupSetter__(property);
    }
  `
});
assert.deepEqual(
  legacyDescriptorSetters.prohibited.map(({ kind }) => kind).sort(),
  [
    'Object.getOwnPropertyDescriptors-innerHTML-setter-reference',
    'Object.getOwnPropertyDescriptors-unproven-property',
    '__lookupSetter__-innerHTML-setter-reference',
    '__lookupSetter__-unproven-property'
  ].sort(),
  'descriptor maps and legacy setter lookup must classify HTML properties and fail closed on opaque properties'
);
const descriptorMapAliases = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/descriptor-map-aliases.mjs',
  source: `
    const getDescriptors = Object.getOwnPropertyDescriptors;
    export function write(target, markup) {
      const descriptors = Object.getOwnPropertyDescriptors(Element.prototype);
      descriptors.innerHTML.set.call(target, markup);
      getDescriptors(Element.prototype).outerHTML.set.call(target, markup);
      Object.getOwnPropertyDescriptors.bind(Object)(Element.prototype).srcdoc.set.call(target, markup);
      Object.getOwnPropertyDescriptors.apply(Object, [Element.prototype]).innerHTML.set.call(target, markup);
      Reflect.get(Object, 'getOwnPropertyDescriptors')(Element.prototype).outerHTML.set.call(target, markup);
    }
  `
});
for (const [kind, count] of [
  ['Object.getOwnPropertyDescriptors-innerHTML-setter-reference', 2],
  ['Object.getOwnPropertyDescriptors-outerHTML-setter-reference', 2],
  ['Object.getOwnPropertyDescriptors-srcdoc-setter-reference', 1],
  ['Object.getOwnPropertyDescriptors-unproven-property', 1],
  ['Object.getOwnPropertyDescriptors-bind', 1],
  ['Object.getOwnPropertyDescriptors-apply', 1]
]) {
  assert.equal(
    descriptorMapAliases.prohibited.filter((finding) => finding.kind === kind).length,
    count,
    `descriptor-map aliases must retain ${count} exact ${kind} finding(s)`
  );
}
assert.equal(
  descriptorMapAliases.approved.some(({ kind }) => kind === 'serializer-read'),
  false,
  'descriptor-map property accesses must never be misclassified as serializer reads'
);
const safeDescriptorLookups = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-descriptor-lookups.mjs',
  source: `
    Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
    Reflect.getOwnPropertyDescriptor(Element.prototype, 'className');
    Object.getOwnPropertyDescriptors(Element.prototype).textContent;
    Element.prototype.__lookupSetter__('textContent');
  `
});
assert.deepEqual(safeDescriptorLookups, { approved: [], prohibited: [] }, 'safe descriptor lookups must stay clean');

const assignedDocumentAliases = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/assigned-document-aliases.mjs',
  source: `
    export function writeDocuments(frame, markup) {
      let write;
      let writeln;
      ({ write } = document);
      ({ writeln } = frame.ownerDocument);
      write(markup);
      writeln(markup);
    }
  `
});
assert.deepEqual(
  assignedDocumentAliases.prohibited.map(({ kind }) => kind).sort(),
  ['document.write-indirect-reference', 'document.writeln-indirect-reference'],
  'assignment-pattern document aliases must fail closed at the destructuring site'
);

const documentObjectAliases = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/document-object-aliases.mjs',
  source: `
    const { ownerDocument: declaredDocument } = host;
    const { contentDocument: defaultedDocument = host.ownerDocument } = frame;
    const logicalDocument = frame.contentDocument || document;
    const conditionalDocument = flag ? frame.ownerDocument : document;
    const sequenceDocument = (prepare(), frame.ownerDocument);
    const [arrayDocument] = [frame.ownerDocument];
    let assignedDocument;
    assignedDocument = host.ownerDocument;
    let destructuredDocument;
    ({ ownerDocument: destructuredDocument } = host);
    export function writeParameter({ contentDocument: parameterDocument }, markup) {
      declaredDocument.write(markup);
      defaultedDocument.writeln(markup);
      assignedDocument.write(markup);
      destructuredDocument.write(markup);
      parameterDocument.writeln(markup);
      logicalDocument.write(markup);
      conditionalDocument.writeln(markup);
      sequenceDocument.write(markup);
      arrayDocument.write(markup);
    }
    export function writeDefault(documentRef = document, markup) {
      documentRef.write(markup);
    }
  `
});
assert.deepEqual(
  documentObjectAliases.prohibited.map(({ kind }) => kind).sort(),
  [
    'document-object-assignment',
    'document-object-indirect-reference:contentDocument',
    'document-object-indirect-reference:contentDocument',
    'document-object-indirect-reference:ownerDocument',
    'document-object-indirect-reference:ownerDocument',
    'document-object-indirect-reference:value',
    'document-object-indirect-reference:value',
    ...Array(7).fill('document.write'),
    ...Array(3).fill('document.writeln')
  ].sort(),
  'document-object aliases from declarations, parameters, defaults, assignments, and destructuring must fail closed'
);
const restDocumentAlias = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/rest-document-alias.mjs',
  source: `let holder; ({ ...holder } = { doc: document }); holder.doc.write(markup);`
});
assert.ok(
  restDocumentAlias.prohibited.some(({ kind }) => kind === 'document.write'),
  'object-rest assignment must preserve document provenance through a selected member'
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
const duplicateVarBindings = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/duplicate-var-bindings.mjs',
  sourceType: 'script',
  source: `
    var run = target[method];
    var run;
    run(markup);
    function invoke(fn) {
      var fn;
      fn(markup);
    }
    invoke(target[method]);
  `
});
assert.equal(
  duplicateVarBindings.approved.filter(({ kind }) => kind === 'computed-property-control').length,
  2,
  'legal var and parameter redeclarations must merge provenance instead of becoming ambiguous'
);
const safeDuplicateVar = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/safe-duplicate-var.mjs',
  sourceType: 'script',
  source: `var run = () => {}; var run; run();`
});
assert.deepEqual(safeDuplicateVar, { approved: [], prohibited: [] }, 'safe duplicate var bindings must stay clean');

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

const ownerBoundSinkA = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/owner-bound.mjs',
  source: 'function renderAlpha(target, markup) { target.innerHTML = markup; }'
}).approved[0];
const ownerBoundSinkB = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/owner-bound.mjs',
  source: 'function renderBeta(target, markup) { target.innerHTML = markup; }'
}).approved[0];
assert.equal(ownerBoundSinkA.fingerprint, ownerBoundSinkB.fingerprint, 'source-only evidence should remain comparable');
assert.notEqual(ownerBoundSinkA.owner, ownerBoundSinkB.owner, 'moving a sink across owners must change identity');

const ownerBoundCommentShift = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/owner-bound.mjs',
  source: 'function renderAlpha(target, markup) { /* unrelated comment */ target.innerHTML = markup; }'
}).approved[0];
assert.equal(
  ownerBoundSinkA.context,
  ownerBoundCommentShift.context,
  'comment-only line or byte shifts must retain structural sink identity'
);

const ownerBoundFormattingShift = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/owner-bound.mjs',
  source: 'function renderAlpha(target, markup) { target.innerHTML=markup; }'
}).approved[0];
assert.notEqual(
  ownerBoundSinkA.fingerprint,
  ownerBoundFormattingShift.fingerprint,
  'exact source evidence should retain formatting differences for audit display'
);
assert.equal(
  ownerBoundSinkA.semanticFingerprint,
  ownerBoundFormattingShift.semanticFingerprint,
  'whitespace-only formatting must retain semantic sink identity'
);
assert.equal(
  ownerBoundSinkA.context,
  ownerBoundFormattingShift.context,
  'whitespace-only formatting must retain structural sink identity'
);

const parenthesizedSerializer = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/serializer-formatting.mjs',
  source: "const html = template ? (template.innerHTML || '') : slotted;"
}).approved[0];
const unparenthesizedSerializer = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/serializer-formatting.mjs',
  source: "const html = template ? template.innerHTML || '' : slotted;"
}).approved[0];
assert.equal(
  parenthesizedSerializer.semanticFingerprint,
  unparenthesizedSerializer.semanticFingerprint,
  'redundant parentheses removed by Prettier must retain serializer identity'
);

const expandedTemplateSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/template-formatting.mjs',
  source: 'target.innerHTML = `<p>\n  ${label}\n</p>`;'
}).approved[0];
const compactTemplateSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/template-formatting.mjs',
  source: 'target.innerHTML = `<p> ${label} </p>`;'
}).approved[0];
assert.notEqual(
  expandedTemplateSink.semanticFingerprint,
  compactTemplateSink.semanticFingerprint,
  'template-literal whitespace is runtime data and must change semantic sink identity'
);
assert.notEqual(
  expandedTemplateSink.fingerprint,
  compactTemplateSink.fingerprint,
  'exact template evidence must still retain the reviewed source bytes'
);

const alphaCallbackSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/callback-bound.mjs',
  source: 'function run(target, markup) { alpha(() => { target.innerHTML = markup; }); }'
}).approved[0];
const betaCallbackSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/callback-bound.mjs',
  source: 'function run(target, markup) { beta(() => { target.innerHTML = markup; }); }'
}).approved[0];
assert.notEqual(
  alphaCallbackSink.context,
  betaCallbackSink.context,
  'same-position sink moves between callback callees must change semantic call-site identity'
);

const safeTrailingCallbackSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/trailing-callback-bound.mjs',
  source: 'function run(target, markup) { alpha(() => { target.innerHTML = markup; }, safeOption); }'
}).approved[0];
const dangerousTrailingCallbackSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/trailing-callback-bound.mjs',
  source: 'function run(target, markup) { alpha(() => { target.innerHTML = markup; }, dangerousOption); }'
}).approved[0];
assert.notEqual(
  safeTrailingCallbackSink.owner,
  dangerousTrailingCallbackSink.owner,
  'callback owners must bind semantic arguments after the callback'
);

const nestedAlphaOwner = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/nested-owner.mjs',
  source: 'function alpha() { function shared(target, markup) { target.innerHTML = markup; } }'
}).approved[0];
const nestedBetaOwner = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/nested-owner.mjs',
  source: 'function beta() { function shared(target, markup) { target.innerHTML = markup; } }'
}).approved[0];
assert.notEqual(
  nestedAlphaOwner.owner,
  nestedBetaOwner.owner,
  'nested sink identity must retain the complete lexical owner chain'
);

function ownedSink(source, filePath = 'scripts/fixtures/html-sink-policy/owner-signature.mjs') {
  return scanJavaScriptSource({ filePath, source }).approved.find(({ kind }) => kind === 'innerHTML-write');
}

const instanceFieldSink = ownedSink(`class View { safe = () => { target.innerHTML = markup; }; }`);
const renamedFieldSink = ownedSink(`class View { dangerous = () => { target.innerHTML = markup; }; }`);
const staticFieldSink = ownedSink(`class View { static safe = () => { target.innerHTML = markup; }; }`);
const computedFieldSink = ownedSink(`class View { [fieldName] = () => { target.innerHTML = markup; }; }`);
for (const changedField of [renamedFieldSink, staticFieldSink, computedFieldSink]) {
  assert.notEqual(
    instanceFieldSink.owner,
    changedField.owner,
    'class field key, static state, and computed key must bind owner identity'
  );
}

const instanceMethodSink = ownedSink(`class View { render() { target.innerHTML = markup; } }`);
const staticMethodSink = ownedSink(`class View { static render() { target.innerHTML = markup; } }`);
const getterMethodSink = ownedSink(`class View { get render() { target.innerHTML = markup; return markup; } }`);
assert.notEqual(
  instanceMethodSink.owner,
  staticMethodSink.owner,
  'instance and static methods must have distinct owners'
);
assert.notEqual(instanceMethodSink.owner, getterMethodSink.owner, 'methods and getters must have distinct owners');
const objectMethodSink = ownedSink(`const view = { render() { target.innerHTML = markup; } };`);
const objectGetterSink = ownedSink(`const view = { get render() { target.innerHTML = markup; return markup; } };`);
assert.notEqual(objectMethodSink.owner, objectGetterSink.owner, 'object methods and getters must have distinct owners');
const objectFunctionPropertySink = ownedSink(`const view = { render: function() { target.innerHTML = markup; } };`);
assert.notEqual(
  objectMethodSink.owner,
  objectFunctionPropertySink.owner,
  'object methods and function-valued properties must have distinct owners'
);

const assignedArrowSink = ownedSink(`view.render = () => { target.innerHTML = markup; };`);
const logicalAssignedArrowSink = ownedSink(`view.render ||= () => { target.innerHTML = markup; };`);
assert.notEqual(
  assignedArrowSink.owner,
  logicalAssignedArrowSink.owner,
  'assignment operators must bind callback owners'
);

const safeTagSink = ownedSink('safeTag`${() => { target.innerHTML = markup; }}`;');
const dangerousTagSink = ownedSink('dangerousTag`${() => { target.innerHTML = markup; }}`;');
assert.notEqual(safeTagSink.context, dangerousTagSink.context, 'tagged-template callback identity must bind its tag');
const safeTagInitializerSink = ownedSink('const value = safeTag`${() => { target.innerHTML = markup; }}`;');
const dangerousTagInitializerSink = ownedSink('const value = dangerousTag`${() => { target.innerHTML = markup; }}`;');
assert.notEqual(
  safeTagInitializerSink.context,
  dangerousTagInitializerSink.context,
  'tagged templates in initializers must bind their tag'
);
const safeTagReturnSink = ownedSink('function render() { return safeTag`${() => { target.innerHTML = markup; }}`; }');
const dangerousTagReturnSink = ownedSink(
  'function render() { return dangerousTag`${() => { target.innerHTML = markup; }}`; }'
);
assert.notEqual(
  safeTagReturnSink.context,
  dangerousTagReturnSink.context,
  'returned tagged templates must bind their tag'
);

const defaultSafeSink = ownedSink(`function render(value = 'safe') { target.innerHTML = markup; }`);
const defaultInputSink = ownedSink(`function render(value = userInput) { target.innerHTML = markup; }`);
const asyncSink = ownedSink(`async function render(value = 'safe') { target.innerHTML = markup; }`);
const generatorSink = ownedSink(`function* render(value = 'safe') { target.innerHTML = markup; }`);
assert.notEqual(defaultSafeSink.owner, defaultInputSink.owner, 'function default parameters must bind owner identity');
assert.notEqual(defaultSafeSink.owner, asyncSink.owner, 'async state must bind function owner identity');
assert.notEqual(defaultSafeSink.owner, generatorSink.owner, 'generator state must bind function owner identity');

const optionalObjectSink = ownedSink(`obj?.register(() => { target.innerHTML = markup; });`);
const optionalCallSink = ownedSink(`obj.register?.(() => { target.innerHTML = markup; });`);
assert.notEqual(
  optionalObjectSink.owner,
  optionalCallSink.owner,
  'optional object access and optional calls must have distinct callback owners'
);

const outerLabelSink = ownedSink(`outer: for (;;) { target.innerHTML = markup; continue outer; }`);
const innerLabelSink = ownedSink(`inner: for (;;) { target.innerHTML = markup; continue inner; }`);
assert.notEqual(outerLabelSink.context, innerLabelSink.context, 'labeled control-flow identity must bind its label');

const stableTrySink = ownedSink(`function render() { try { work(); } catch (_) { target.innerHTML = markup; } }`);
const insertedTrySink = ownedSink(
  `function render() { try { unrelated(); } catch (error) { report(error); } try { work(); } catch (_) { target.innerHTML = markup; } }`
);
assert.equal(
  stableTrySink.context,
  insertedTrySink.context,
  'an unrelated semantic try sibling must not renumber sink identity'
);
const stableTryBlockSink = ownedSink(
  `function render() { try { work(); target.innerHTML = markup; } catch (error) { report(error); } }`
);
const insertedTryBlockSink = ownedSink(
  `function render() { try { unrelated(); work(); target.innerHTML = markup; } catch (error) { report(error); } }`
);
assert.equal(
  stableTryBlockSink.context,
  insertedTryBlockSink.context,
  'an unrelated statement inside a try block must not rename a stable sink'
);
const renamedTryBindingSink = ownedSink(
  `function render() { try { work(); target.innerHTML = markup; } catch (cause) { report(cause); } }`
);
assert.notEqual(
  stableTryBlockSink.context,
  renamedTryBindingSink.context,
  'catch binding changes must remain part of try structure identity'
);
const finalizedTrySink = ownedSink(
  `function render() { try { work(); target.innerHTML = markup; } catch (error) { report(error); } finally { cleanup(); } }`
);
assert.notEqual(
  stableTryBlockSink.context,
  finalizedTrySink.context,
  'finally presence must remain part of try structure identity'
);

const spaceTemplateSink = ownedSink('target.innerHTML = `<a href="java script:alert(1)">x</a>`;');
const tabTemplateSink = ownedSink('target.innerHTML = `<a href="java\tscript:alert(1)">x</a>`;');
assert.notEqual(
  spaceTemplateSink.semanticFingerprint,
  tabTemplateSink.semanticFingerprint,
  'template control whitespace must remain exact semantic data'
);
const staticProducerSink = ownedSink(`function render() { const html = '<p>safe</p>'; target.innerHTML = html; }`);
const dynamicProducerSink = ownedSink(`function render() { const html = userInput; target.innerHTML = html; }`);
assert.notEqual(
  staticProducerSink.producerSemanticFingerprint,
  dynamicProducerSink.producerSemanticFingerprint,
  'simple immutable producer changes must invalidate an HTML disposition'
);
const assignedStaticProducerSink = ownedSink(
  `function render() { let html; html = safeHtml; target.innerHTML = html; }`
);
const assignedDynamicProducerSink = ownedSink(
  `function render() { let html; html = userInput; target.innerHTML = html; }`
);
assert.notEqual(
  assignedStaticProducerSink.producerSemanticFingerprint,
  assignedDynamicProducerSink.producerSemanticFingerprint,
  'mutated local producer assignments must invalidate an HTML disposition'
);
const returnedStaticProducerSink = ownedSink(
  `function build() { return '<p>safe</p>'; } function render() { target.innerHTML = build(); }`
);
const returnedDynamicProducerSink = ownedSink(
  `function build() { return userInput; } function render() { target.innerHTML = build(); }`
);
assert.notEqual(
  returnedStaticProducerSink.producerSemanticFingerprint,
  returnedDynamicProducerSink.producerSemanticFingerprint,
  'local producer helper return changes must invalidate an HTML disposition'
);
const trustedReturnProducerSink = ownedSink(
  `function build() { if (trusted) return safeHtml; return userInput; } function render() { target.innerHTML = build(); }`
);
const invertedReturnProducerSink = ownedSink(
  `function build() { if (!trusted) return safeHtml; return userInput; } function render() { target.innerHTML = build(); }`
);
assert.notEqual(
  trustedReturnProducerSink.producerSemanticFingerprint,
  invertedReturnProducerSink.producerSemanticFingerprint,
  'local producer return control paths must invalidate an HTML disposition'
);
const trustedAssignmentProducerSink = ownedSink(
  `function render() { let html = userInput; if (trusted) html = safeHtml; target.innerHTML = html; }`
);
const invertedAssignmentProducerSink = ownedSink(
  `function render() { let html = userInput; if (!trusted) html = safeHtml; target.innerHTML = html; }`
);
assert.notEqual(
  trustedAssignmentProducerSink.producerSemanticFingerprint,
  invertedAssignmentProducerSink.producerSemanticFingerprint,
  'mutated producer assignment control paths must invalidate an HTML disposition'
);
const nestedStaticProducerSink = ownedSink(
  `function render() { const data = 'safe'; target.innerHTML = \`<p>\${data}</p>\`; }`
);
const nestedDynamicProducerSink = ownedSink(
  `function render() { const data = userInput; target.innerHTML = \`<p>\${data}</p>\`; }`
);
assert.notEqual(
  nestedStaticProducerSink.producerSemanticFingerprint,
  nestedDynamicProducerSink.producerSemanticFingerprint,
  'nested producer bindings must invalidate an HTML disposition'
);
for (const returnedExpression of ['`<p>${x}</p>`', 'String(x)']) {
  const parameterStaticProducerSink = ownedSink(
    `function build(x) { return ${returnedExpression}; } function render() { const data = 'safe'; target.innerHTML = build(data); }`
  );
  const parameterDynamicProducerSink = ownedSink(
    `function build(x) { return ${returnedExpression}; } function render() { const data = userInput; target.innerHTML = build(data); }`
  );
  assert.notEqual(
    parameterStaticProducerSink.producerSemanticFingerprint,
    parameterDynamicProducerSink.producerSemanticFingerprint,
    `nested parameter provenance in ${returnedExpression} must invalidate an HTML disposition`
  );
}
const logicalAssignmentProducerSink = ownedSink(
  `function render() { let html = 'safe'; html ||= userInput; target.innerHTML = html; }`
);
const replacingAssignmentProducerSink = ownedSink(
  `function render() { let html = 'safe'; html = userInput; target.innerHTML = html; }`
);
assert.notEqual(
  logicalAssignmentProducerSink.producerSemanticFingerprint,
  replacingAssignmentProducerSink.producerSemanticFingerprint,
  'producer assignment operators must invalidate an HTML disposition'
);
const assignedSafeLoopProducerSink = ownedSink(
  `function render() { let html = 'safe'; for (html of safeValues) {} target.innerHTML = html; }`
);
const assignedDynamicLoopProducerSink = ownedSink(
  `function render() { let html = 'safe'; for (html of userValues) {} target.innerHTML = html; }`
);
assert.notEqual(
  assignedSafeLoopProducerSink.producerSemanticFingerprint,
  assignedDynamicLoopProducerSink.producerSemanticFingerprint,
  'assigned for-of producer sources must invalidate an HTML disposition'
);
const declaredSafeLoopProducerSink = ownedSink(
  `function render() { for (const html of safeValues) { target.innerHTML = html; } }`
);
const declaredDynamicLoopProducerSink = ownedSink(
  `function render() { for (const html of userValues) { target.innerHTML = html; } }`
);
assert.notEqual(
  declaredSafeLoopProducerSink.producerSemanticFingerprint,
  declaredDynamicLoopProducerSink.producerSemanticFingerprint,
  'declared for-of producer sources must invalidate an HTML disposition'
);
const directParameterStaticSink = ownedSink(`function render(html) { target.innerHTML = html; } render('safe');`);
const directParameterDynamicSink = ownedSink(`function render(html) { target.innerHTML = html; } render(userInput);`);
assert.notEqual(
  directParameterStaticSink.producerSemanticFingerprint,
  directParameterDynamicSink.producerSemanticFingerprint,
  'direct local invocation arguments must bind parameter producer semantics'
);
const memberParameterStaticSink = ownedSink(
  `function render(state) { target.innerHTML = state.html; } render({ html: 'safe', unrelated: 1 });`
);
const memberParameterDynamicSink = ownedSink(
  `function render(state) { target.innerHTML = state.html; } render({ html: userInput, unrelated: 1 });`
);
assert.notEqual(
  memberParameterStaticSink.producerSemanticFingerprint,
  memberParameterDynamicSink.producerSemanticFingerprint,
  'member reads from local invocation arguments must bind the projected producer property'
);
const memberParameterUnrelatedSink = ownedSink(
  `function render(state) { target.innerHTML = state.html; } render({ html: 'safe', unrelated: 2 });`
);
assert.equal(
  memberParameterStaticSink.producerSemanticFingerprint,
  memberParameterUnrelatedSink.producerSemanticFingerprint,
  'unrelated invocation object properties must not rename a projected member producer'
);
const safeCatchProducerSink = ownedSink(
  `function render() { try { throw 'safe'; } catch (html) { target.innerHTML = html; } }`
);
const dynamicCatchProducerSink = ownedSink(
  `function render() { try { throw userInput; } catch (html) { target.innerHTML = html; } }`
);
assert.notEqual(
  safeCatchProducerSink.producerSemanticFingerprint,
  dynamicCatchProducerSink.producerSemanticFingerprint,
  'local throw sources must bind catch-parameter producer semantics'
);
const safeCallbackProducerSink = ownedSink(
  `function withValue(callback) { callback('safe'); } withValue((html) => { target.innerHTML = html; });`
);
const dynamicCallbackProducerSink = ownedSink(
  `function withValue(callback) { callback(userInput); } withValue((html) => { target.innerHTML = html; });`
);
assert.notEqual(
  safeCallbackProducerSink.producerSemanticFingerprint,
  dynamicCallbackProducerSink.producerSemanticFingerprint,
  'single-file higher-order callback arguments must bind producer semantics'
);
const objectThisStaticSink = ownedSink(`const view = { html: 'safe', render() { target.innerHTML = this.html; } };`);
const objectThisDynamicSink = ownedSink(
  `const view = { html: userInput, render() { target.innerHTML = this.html; } };`
);
assert.notEqual(
  objectThisStaticSink.producerSemanticFingerprint,
  objectThisDynamicSink.producerSemanticFingerprint,
  'object-method this member sources must bind producer semantics'
);
const classThisStaticSink = ownedSink(`class View { html = 'safe'; render() { target.innerHTML = this.html; } }`);
const classThisDynamicSink = ownedSink(`class View { html = userInput; render() { target.innerHTML = this.html; } }`);
assert.notEqual(
  classThisStaticSink.producerSemanticFingerprint,
  classThisDynamicSink.producerSemanticFingerprint,
  'class-field this member sources must bind producer semantics'
);
const constructorThisStaticSink = ownedSink(
  `class View { constructor(html) { this.html = html; } render() { target.innerHTML = this.html; } } new View('safe');`
);
const constructorThisDynamicSink = ownedSink(
  `class View { constructor(html) { this.html = html; } render() { target.innerHTML = this.html; } } new View(userInput);`
);
assert.notEqual(
  constructorThisStaticSink.producerSemanticFingerprint,
  constructorThisDynamicSink.producerSemanticFingerprint,
  'constructor-assigned this member sources must bind invocation producer semantics'
);

const guardedSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/guarded-sink.mjs',
  source: 'function render(target, markup) { if (isSanitized(markup)) target.innerHTML = markup; }'
}).approved[0];
const weakenedGuardSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/guarded-sink.mjs',
  source: 'function render(target, markup) { if (true) target.innerHTML = markup; }'
}).approved[0];
assert.notEqual(
  guardedSink.context,
  weakenedGuardSink.context,
  'sink context must bind the semantic control-flow predicate'
);

const computedCallbackSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/computed-callback-bound.mjs',
  source: 'function run(target, markup) { items[first](() => { target.innerHTML = markup; }); }'
}).approved.find(({ kind }) => kind === 'innerHTML-write');
const movedComputedCallbackSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/computed-callback-bound.mjs',
  source: 'function run(target, markup) { items[second](() => { target.innerHTML = markup; }); }'
}).approved.find(({ kind }) => kind === 'innerHTML-write');
assert.notEqual(
  computedCallbackSink.context,
  movedComputedCallbackSink.context,
  'computed callback properties must remain part of semantic call-site identity'
);

const doubleQuotedCallbackSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/quoted-callback-bound.mjs',
  source: 'function run(target, markup) { alpha("click", () => { target.innerHTML = markup; }); }'
}).approved[0];
const singleQuotedCallbackSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/quoted-callback-bound.mjs',
  source: "function run(target, markup) { alpha('click', () => { target.innerHTML = markup; }); }"
}).approved[0];
assert.equal(
  doubleQuotedCallbackSink.context,
  singleQuotedCallbackSink.context,
  'quote-only formatting of callback arguments must retain semantic call-site identity'
);

const ownerRelativeMoved = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/owner-bound.mjs',
  source: 'function renderAlpha(target, markup) { prepare(); target.innerHTML = markup; }'
}).approved[0];
assert.equal(ownerBoundSinkA.owner, ownerRelativeMoved.owner);
assert.equal(
  ownerBoundSinkA.context,
  ownerRelativeMoved.context,
  'unrelated semantic siblings must not renumber a stable sink identity'
);

const orderedSiblingSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/ordered-sibling.mjs',
  source: 'function render(target, first, second) { target.innerHTML = first; target.innerHTML = second; }'
}).approved.find(({ evidence }) => evidence.endsWith('second'));
const reorderedSiblingSink = scanJavaScriptSource({
  filePath: 'scripts/fixtures/html-sink-policy/ordered-sibling.mjs',
  source: 'function render(target, first, second) { target.innerHTML = second; target.innerHTML = first; }'
}).approved.find(({ evidence }) => evidence.endsWith('second'));
assert.notEqual(
  orderedSiblingSink.context,
  reorderedSiblingSink.context,
  'same-target semantic siblings must retain a local ordinal that detects reordering'
);

const policy = JSON.parse(await read('html-sink-policy.json'));
const inventory = await scanRepository();
assert.deepEqual(verifyInventory(inventory, policy), [], 'the versioned exact-fingerprint inventory must match');

const legacyPolicy = structuredClone(policy);
for (const entry of legacyPolicy.approved) {
  delete entry.owner;
  delete entry.context;
}
assert.deepEqual(
  verifyPolicyTransition(legacyPolicy, policy),
  [],
  'the one-time owner-identity migration must preserve every reviewed legacy disposition'
);
const preReflectionLegacyPolicy = structuredClone(legacyPolicy);
preReflectionLegacyPolicy.approved = preReflectionLegacyPolicy.approved.filter(
  ({ kind }) => kind !== 'reflection-control'
);
const baseReflectionInventory = inventory.approved.filter(({ kind }) => kind === 'reflection-control');
assert.deepEqual(
  verifyPolicyTransition(preReflectionLegacyPolicy, policy, baseReflectionInventory),
  [],
  'newly classified reflection controls may bootstrap only when the same exact occurrences existed at merge base'
);
assert.ok(
  verifyPolicyTransition(preReflectionLegacyPolicy, policy, []).some((message) =>
    message.includes('reviewed control bootstrap was not present at merge base')
  ),
  'reflection-control bootstrap must fail without a merge-base source rescan'
);
const preComputedPropertyPolicy = structuredClone(policy);
preComputedPropertyPolicy.approved = preComputedPropertyPolicy.approved.filter(
  ({ kind }) => kind !== 'computed-property-control'
);
const baseComputedPropertyInventory = inventory.approved.filter(({ kind }) => kind === 'computed-property-control');
assert.deepEqual(
  verifyPolicyTransition(preComputedPropertyPolicy, policy, baseComputedPropertyInventory),
  [],
  'computed property uncertainty may bootstrap only from the same exact merge-base operations'
);
assert.ok(
  verifyPolicyTransition(preComputedPropertyPolicy, policy, []).some((message) =>
    message.includes('reviewed control bootstrap was not present at merge base')
  ),
  'computed property bootstrap must fail without an exact merge-base source rescan'
);
const preTimerAliasPolicy = structuredClone(policy);
preTimerAliasPolicy.approved = preTimerAliasPolicy.approved.filter(
  ({ kind }) => kind !== 'timer-callback-alias-control'
);
const baseTimerAliasInventory = inventory.approved.filter(({ kind }) => kind === 'timer-callback-alias-control');
assert.deepEqual(
  verifyPolicyTransition(preTimerAliasPolicy, policy, baseTimerAliasInventory),
  [],
  'timer alias controls may bootstrap only from the same exact merge-base calls'
);
assert.ok(
  verifyPolicyTransition(preTimerAliasPolicy, policy, []).some((message) =>
    message.includes('reviewed control bootstrap was not present at merge base')
  ),
  'timer alias bootstrap must fail without an exact merge-base source rescan'
);
const grownTimerAliasPolicy = structuredClone(policy);
const timerAlias = grownTimerAliasPolicy.approved.find(({ kind }) => kind === 'timer-callback-alias-control');
assert.ok(timerAlias, 'the repository fixture must retain a timer alias control');
grownTimerAliasPolicy.approved.push({
  ...structuredClone(timerAlias),
  context: `${timerAlias.context}:new-call-site`
});
assert.ok(
  verifyPolicyTransition(policy, grownTimerAliasPolicy).some((message) => message.includes('baseline grew')),
  'a new timer alias call site must fail the shrink-only transition'
);
const reclassifiedMigration = structuredClone(policy);
reclassifiedMigration.approved[0].classification = 'static-template';
assert.ok(
  verifyPolicyTransition(legacyPolicy, reclassifiedMigration).length > 0,
  'owner-identity migration must not hide a disposition replacement'
);
const rewrittenDisposition = structuredClone(policy);
const rewrittenEntry = rewrittenDisposition.approved.find(
  ({ empty, kind }) => kind === 'innerHTML-write' && empty === false
);
assert.ok(rewrittenEntry, 'the repository fixture must retain one non-empty HTML disposition');
rewrittenEntry.classification =
  rewrittenEntry.classification === 'static-template' ? 'escaped-ui-template' : 'static-template';
rewrittenEntry.rationale =
  'A syntactically valid but unreviewed replacement rationale must not rewrite an existing disposition.';
rewrittenEntry.dispositionHash = dispositionHash(rewrittenEntry);
assert.deepEqual(
  verifyInventory(inventory, rewrittenDisposition),
  [],
  'the rewritten disposition fixture must remain internally well formed before transition comparison'
);
assert.ok(
  verifyPolicyTransition(policy, rewrittenDisposition).some((message) => message.includes('baseline grew')),
  'an internally consistent classification or rationale rewrite must fail the shrink-only transition'
);
const grownPolicy = structuredClone(policy);
grownPolicy.approved.push(structuredClone(grownPolicy.approved[0]));
assert.ok(
  verifyPolicyTransition(policy, grownPolicy).some((message) => message.includes('baseline grew')),
  'merge-base policy comparison must reject duplicate sink growth'
);
const swappedPolicy = structuredClone(policy);
swappedPolicy.approved[0].owner = `${swappedPolicy.approved[0].owner}:replacement`;
assert.ok(
  verifyPolicyTransition(policy, swappedPolicy).some((message) => message.includes('baseline grew')),
  'same-count owner replacement must not pass no-growth'
);
const reducedPolicy = structuredClone(policy);
reducedPolicy.approved.pop();
assert.deepEqual(verifyPolicyTransition(policy, reducedPolicy), [], 'reviewed sink removal must remain allowed');

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
changedSink.approved[0].semanticFingerprint = '0'.repeat(64);
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
    occurrence.owner = `${occurrence.owner}:moved`;
  },
  'sink owner'
);
assertMetadataDrift(
  ({ kind }) => kind === 'innerHTML-write',
  (occurrence) => {
    occurrence.context = `${occurrence.context}:moved`;
  },
  'sink owner-relative context'
);
assertMetadataDrift(
  ({ kind }) => kind === 'innerHTML-write',
  (occurrence) => {
    occurrence.empty = !occurrence.empty;
  },
  'empty classification'
);
assertMetadataDrift(
  ({ empty, kind, producerSemanticFingerprint }) =>
    kind === 'innerHTML-write' && empty === false && typeof producerSemanticFingerprint === 'string',
  (occurrence) => {
    occurrence.producerSemanticFingerprint = '0'.repeat(64);
  },
  'HTML producer semantics'
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
const rehashedFabricatedEvidencePolicy = structuredClone(policy);
rehashedFabricatedEvidencePolicy.approved[0].evidence = 'fabricated evidence';
rehashedFabricatedEvidencePolicy.approved[0].dispositionHash = dispositionHash(
  rehashedFabricatedEvidencePolicy.approved[0]
);
const fabricatedEvidenceErrors = verifyInventory(inventory, rehashedFabricatedEvidencePolicy);
assert.ok(
  fabricatedEvidenceErrors.some((message) => message.includes('unapproved sink fingerprint')) &&
    fabricatedEvidenceErrors.some((message) => message.includes('approved sink changed or disappeared')),
  'rehashed fabricated evidence must still fail the live inventory comparison'
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
