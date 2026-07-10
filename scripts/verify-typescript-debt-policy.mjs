import assert from 'node:assert/strict';
import ts from 'typescript';
import {
  compareDiagnosticEntries,
  diagnosticIdentity,
  evaluateDiagnosticTransition,
  fingerprintRootFiles,
  validateDiagnosticEntries
} from './typescript-debt-policy.mjs';
import {
  assertNoTypeScriptSuppressions,
  collectTypeScriptSuppressions,
  formatBaselineJson
} from './typescript-debt-runtime.mjs';

const alpha = {
  path: 'assets/js/a.js',
  code: 7006,
  message: "Parameter 'value' implicitly has an 'any' type.",
  count: 2
};
const beta = { path: 'assets/js/b.js', code: 2339, message: "Property 'value' does not exist.", count: 1 };

assert.equal(
  diagnosticIdentity(alpha),
  JSON.stringify([alpha.path, alpha.code, alpha.message]),
  'diagnostic identity must contain only normalized path, TS code, and flattened message'
);

function suppressionsIn(name, source) {
  const sourceFile = ts.createSourceFile(name, source, ts.ScriptTarget.ES2023, true, ts.ScriptKind.JS);
  return collectTypeScriptSuppressions(sourceFile, name);
}

const realSuppressions = [
  ...suppressionsIn('ignore.js', '// @ts-ignore\nunknownCall();'),
  ...suppressionsIn('expect-error.js', '// @ts-expect-error expected failure\nunknownCall();'),
  ...suppressionsIn('nocheck.js', '// @ts-nocheck\nunknownCall();')
];
assert.deepEqual(
  realSuppressions.map(({ directive }) => directive),
  ['@ts-ignore', '@ts-expect-error', '@ts-nocheck'],
  'the locked TypeScript parser must expose all prohibited suppression directives'
);
assert.throws(
  () => assertNoTypeScriptSuppressions(realSuppressions),
  /ignore\.js:1:1 @ts-ignore[\s\S]*expect-error\.js:1:1 @ts-expect-error[\s\S]*nocheck\.js:1:1 @ts-nocheck/,
  'a real TypeScript suppression comment must fail closed with source locations'
);
assert.deepEqual(
  suppressionsIn(
    'literal.js',
    'const examples = ["@ts-ignore", "@ts-expect-error", "@ts-nocheck"];\n' +
      '// Ordinary prose mentioning @ts-ignore is not a directive.\n'
  ),
  [],
  'directive text in strings or ordinary prose comments must not be misclassified'
);
assert.ok(compareDiagnosticEntries(alpha, beta) < 0, 'diagnostic entries must sort by repository path first');
assert.equal(
  fingerprintRootFiles(['assets/js/a.js', 'assets/js/b.mjs']),
  'dc0df61791777beb352a2e833b67340b265e275c384f57c2b10906a1bb844dfc',
  'root fingerprints must use a stable LF-delimited path list'
);
assert.equal(
  await formatBaselineJson({ schemaVersion: 1, entries: ['a', 'b'] }),
  '{ "schemaVersion": 1, "entries": ["a", "b"] }\n',
  'baseline writes must be deterministic Prettier 3.9.4 JSON'
);

assert.deepEqual(
  evaluateDiagnosticTransition({ baseEntries: [alpha, beta], headEntries: [{ ...alpha, count: 1 }] }),
  [],
  'an explicit baseline rewrite may record diagnostic reductions'
);
assert.deepEqual(
  evaluateDiagnosticTransition({ baseEntries: [alpha], headEntries: [{ ...alpha, count: 3 }] }),
  [{ code: 'diagnostic-count-growth', entry: { ...alpha, count: 3 }, previousCount: 2 }],
  'a known diagnostic key may not grow'
);
assert.deepEqual(
  evaluateDiagnosticTransition({ baseEntries: [alpha], headEntries: [beta] }),
  [{ code: 'new-diagnostic-key', entry: beta }],
  'a new diagnostic key must fail even when the aggregate count does not grow'
);

validateDiagnosticEntries([alpha, beta]);
assert.throws(
  () => validateDiagnosticEntries([beta, alpha]),
  /strictly sorted/,
  'the persisted multiset must be deterministic'
);
assert.throws(
  () => validateDiagnosticEntries([alpha, { ...alpha }]),
  /duplicate diagnostic key/,
  'the persisted multiset must aggregate duplicate keys into counts'
);
assert.throws(
  () => validateDiagnosticEntries([{ ...alpha, message: 'line one\nline two' }]),
  /flattened/,
  'persisted messages must not depend on line endings'
);

console.log('TypeScript debt policy tests passed.');
