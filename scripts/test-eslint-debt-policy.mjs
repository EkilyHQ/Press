#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  compareExact,
  compareNoGrowth,
  createBaseline,
  diagnosticKey,
  normalizeDiagnostics,
  validateBaseline,
  validateRuleTransition
} from './eslint-debt-policy.mjs';

let Linter;
try {
  ({ Linter } = await import('eslint'));
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !/Cannot find package 'eslint'/u.test(error.message)) throw error;
  console.log('SKIP eslint debt policy tests: project dependencies are not installed');
  process.exit(0);
}

const repoRoot = '/repo';

function lintRow(filePath, source, rules) {
  const linter = new Linter({ configType: 'flat' });
  const messages = linter.verify(
    source,
    [
      {
        languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
        rules: Object.fromEntries(rules.map((rule) => [rule, 'error']))
      }
    ],
    { filename: filePath.startsWith('/repo/') ? filePath.slice('/repo/'.length) : filePath }
  );
  return { filePath, source, messages };
}

const rows = [
  {
    filePath: '/repo/assets/example.js',
    source: 'const unused = 1;\n',
    messages: [
      {
        ruleId: 'no-unused-vars',
        severity: 2,
        line: 1,
        column: 7,
        endLine: 1,
        endColumn: 13,
        messageId: 'unusedVar',
        message: "'unused' is assigned a value but never used."
      }
    ]
  }
];
const actualDiagnostics = normalizeDiagnostics(rows, ['no-unused-vars'], repoRoot);
const baseline = createBaseline(actualDiagnostics, ['no-unused-vars']);
const baselineDiagnostics = baseline.diagnostics;
assert.equal(actualDiagnostics.length, 1);
assert.equal(actualDiagnostics[0].path, 'assets/example.js');
assert.equal(actualDiagnostics[0].owner, '<module>');
assert.match(actualDiagnostics[0].fingerprint, /^sha256:[a-f0-9]{64}$/u);
assert.equal(Object.hasOwn(baselineDiagnostics[0], 'line'), false, 'baseline must omit unstable line evidence');
assert.deepEqual(compareExact(actualDiagnostics, baselineDiagnostics), []);
assert.deepEqual(compareNoGrowth([], baselineDiagnostics), [], 'debt removal must be allowed');
assert.deepEqual(
  validateRuleTransition(['no-empty', 'no-unused-vars'], ['no-unused-vars']),
  [],
  'fully cleaned excluded rules may be removed from the head policy'
);
assert.deepEqual(
  validateRuleTransition(['no-unused-vars'], ['no-empty', 'no-unused-vars']),
  ['new excluded ESLint rule requires merge-base rescan and explicit review: no-empty'],
  'new excluded rules must fail closed instead of inheriting an unrelated base baseline'
);

const prefixedRows = structuredClone(rows);
prefixedRows[0].source = `// unrelated file header\n\n${prefixedRows[0].source}`;
prefixedRows[0].messages[0].line += 2;
prefixedRows[0].messages[0].endLine += 2;
const rescannedLineShift = normalizeDiagnostics(prefixedRows, ['no-unused-vars'], repoRoot);
assert.deepEqual(
  compareExact(rescannedLineShift, baselineDiagnostics),
  [],
  'a real rescan after comment-only line shifts must retain occurrence identity'
);

const callbackRules = ['no-unused-vars'];
const firstCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/callback.js', `alpha(() => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
const secondCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/callback.js', `beta(() => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
assert.equal(
  compareNoGrowth(secondCallback, firstCallback).length,
  1,
  'same-position anonymous callback debt moved to another callee must create a new identity'
);

const firstNestedCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/nested-callback.js', `alpha(() => () => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
const secondNestedCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/nested-callback.js', `beta(() => () => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
assert.equal(
  compareNoGrowth(secondNestedCallback, firstNestedCallback).length,
  1,
  'nested anonymous debt must retain every enclosing semantic callback anchor'
);

const firstComputedCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/computed-callback.js', `items[first](() => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
const secondComputedCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/computed-callback.js', `items[second](() => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
assert.equal(
  compareNoGrowth(secondComputedCallback, firstComputedCallback).length,
  1,
  'computed callback callees must include the semantic property expression in identity'
);

const firstCallResultCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/call-result-callback.js', `select(first)(() => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
const secondCallResultCallback = normalizeDiagnostics(
  [
    lintRow('/repo/assets/call-result-callback.js', `select(second)(() => {\n  const unused = 1;\n});\n`, callbackRules)
  ],
  callbackRules,
  repoRoot
);
assert.equal(
  compareNoGrowth(secondCallResultCallback, firstCallResultCallback).length,
  1,
  'call-result callback owners must include semantic arguments passed to the callee factory'
);

const firstTrailingCallbackArgument = normalizeDiagnostics(
  [
    lintRow('/repo/assets/trailing-callback.js', `alpha(() => {\n  const unused = 1;\n}, safeOption);\n`, callbackRules)
  ],
  callbackRules,
  repoRoot
);
const secondTrailingCallbackArgument = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/trailing-callback.js',
      `alpha(() => {\n  const unused = 1;\n}, changedOption);\n`,
      callbackRules
    )
  ],
  callbackRules,
  repoRoot
);
assert.equal(
  compareNoGrowth(secondTrailingCallbackArgument, firstTrailingCallbackArgument).length,
  1,
  'callback owners must include semantic arguments after the callback'
);

const exportedFunctionDebt = normalizeDiagnostics(
  [lintRow('/repo/assets/semantic-sibling.js', `export function alpha() {\n  const unused = 1;\n}\n`, callbackRules)],
  callbackRules,
  repoRoot
);
const prefixedExportedFunctionDebt = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/semantic-sibling.js',
      `export function unrelated() {}\n\nexport function alpha() {\n  const unused = 1;\n}\n`,
      callbackRules
    )
  ],
  callbackRules,
  repoRoot
);
assert.deepEqual(
  compareExact(prefixedExportedFunctionDebt, exportedFunctionDebt),
  [],
  'unrelated earlier AST siblings must not renumber stable diagnostic identities'
);

const targetCallbackDebt = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/semantic-call-sibling.js',
      `alpha('target', () => {\n  const unused = 1;\n});\n`,
      callbackRules
    )
  ],
  callbackRules,
  repoRoot
);
const prefixedTargetCallbackDebt = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/semantic-call-sibling.js',
      `alpha('unrelated', () => {});\nalpha('target', () => {\n  const unused = 1;\n});\n`,
      callbackRules
    )
  ],
  callbackRules,
  repoRoot
);
assert.deepEqual(
  compareExact(prefixedTargetCallbackDebt, targetCallbackDebt),
  [],
  'same-callee siblings with different semantic arguments must not renumber a stable callback identity'
);

const firstRepeatedCallbackDebt = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/repeated-call-sibling.js',
      `alpha('target', () => {\n  const unused = 1;\n});\nalpha('target', () => {});\n`,
      callbackRules
    )
  ],
  callbackRules,
  repoRoot
);
const secondRepeatedCallbackDebt = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/repeated-call-sibling.js',
      `alpha('target', () => {});\nalpha('target', () => {\n  const unused = 1;\n});\n`,
      callbackRules
    )
  ],
  callbackRules,
  repoRoot
);
assert.equal(
  compareNoGrowth(secondRepeatedCallbackDebt, firstRepeatedCallbackDebt).length,
  1,
  'truly repeated semantic call sites must retain a local ordinal that detects same-count debt moves'
);

const doubleQuotedCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/quoted-callback.js', `alpha("click", () => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
const singleQuotedCallback = normalizeDiagnostics(
  [lintRow('/repo/assets/quoted-callback.js', `alpha('click', () => {\n  const unused = 1;\n});\n`, callbackRules)],
  callbackRules,
  repoRoot
);
assert.deepEqual(
  compareExact(singleQuotedCallback, doubleQuotedCallback),
  [],
  'quote-only formatting of preceding callback arguments must retain semantic identity'
);

const expandedCatch = normalizeDiagnostics(
  [lintRow('/repo/assets/empty-catch.js', 'try { run(); } catch (_) {\n}\n', ['no-empty'])],
  ['no-empty'],
  repoRoot
);
const compactCatch = normalizeDiagnostics(
  [lintRow('/repo/assets/empty-catch.js', 'try { run(); } catch (_) {}\n', ['no-empty'])],
  ['no-empty'],
  repoRoot
);
assert.deepEqual(
  compareExact(compactCatch, expandedCatch),
  [],
  'Prettier-only empty-block formatting must retain semantic diagnostic identity'
);

const targetTryDebt = normalizeDiagnostics(
  [lintRow('/repo/assets/try-sibling.js', 'try { work(); } catch (_) {}\n', ['no-empty'])],
  ['no-empty'],
  repoRoot
);
const prefixedTargetTryDebt = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/try-sibling.js',
      'try { unrelated(); } catch (error) { report(error); }\ntry { work(); } catch (_) {}\n',
      ['no-empty']
    )
  ],
  ['no-empty'],
  repoRoot
);
assert.deepEqual(
  compareExact(prefixedTargetTryDebt, targetTryDebt),
  [],
  'an unrelated clean try sibling must not renumber an existing empty-catch identity'
);

const alphaTryDebt = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/try-swap.js',
      'try { alpha(); } catch (_) {}\ntry { beta(); } catch (error) { report(error); }\n',
      ['no-empty']
    )
  ],
  ['no-empty'],
  repoRoot
);
const betaTryDebt = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/try-swap.js',
      'try { alpha(); } catch (error) { report(error); }\ntry { beta(); } catch (_) {}\n',
      ['no-empty']
    )
  ],
  ['no-empty'],
  repoRoot
);
assert.equal(
  compareNoGrowth(betaTryDebt, alphaTryDebt).length,
  1,
  'moving an empty catch between semantically distinct try operations must create a new identity'
);

const assignmentFactory = (factory) =>
  normalizeDiagnostics(
    [
      lintRow(
        '/repo/assets/assignment-source.js',
        `export function load() {\n  let store = ${factory}();\n  store = finalFactory();\n  return store;\n}\n`,
        ['no-useless-assignment']
      )
    ],
    ['no-useless-assignment'],
    repoRoot
  );
assert.equal(
  compareNoGrowth(assignmentFactory('newFactory'), assignmentFactory('oldFactory')).length,
  1,
  'same-slot dead assignments must bind the complete initializer semantics'
);

const parenthesizedAssignment = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/assignment-source.js',
      `export function load() {\n  let store = ((oldFactory()));\n  store = finalFactory();\n  return store;\n}\n`,
      ['no-useless-assignment']
    )
  ],
  ['no-useless-assignment'],
  repoRoot
);
assert.deepEqual(
  compareExact(parenthesizedAssignment, assignmentFactory('oldFactory')),
  [],
  'redundant formatter-only parenthesis metadata must not change assignment identity'
);

const expandedEmptyCatch = normalizeDiagnostics(
  [
    lintRow(
      '/repo/assets/empty-catch-owner.js',
      `const clear = () => {\n  try {\n    run();\n  } catch (_) {}\n  ;\n};\n`,
      ['no-empty']
    )
  ],
  ['no-empty'],
  repoRoot
);
const compactEmptyCatchOwner = normalizeDiagnostics(
  [
    lintRow('/repo/assets/empty-catch-owner.js', `const clear = () => {\n  try {\n    run();\n  } catch (_) {}\n};\n`, [
      'no-empty'
    ])
  ],
  ['no-empty'],
  repoRoot
);
assert.deepEqual(
  compareExact(compactEmptyCatchOwner, expandedEmptyCatch),
  [],
  'formatter removal of semicolon-only empty statements must retain owner identity'
);

const replaced = [{ ...baselineDiagnostics[0], fingerprint: `sha256:${'a'.repeat(64)}` }];
assert.equal(compareNoGrowth(replaced, baselineDiagnostics).length, 1, 'source replacement must not pass');
assert.notEqual(diagnosticKey(replaced[0]), diagnosticKey(baselineDiagnostics[0]));

const tamperedMessage = [{ ...baselineDiagnostics[0], message: 'forged message evidence' }];
assert.equal(compareExact(actualDiagnostics, tamperedMessage).length, 2, 'message evidence must be part of identity');

assert.doesNotThrow(() => validateBaseline(baseline, ['no-unused-vars']));
const unstableEvidenceBaseline = structuredClone(baseline);
unstableEvidenceBaseline.diagnostics[0].line = 999999;
assert.throws(
  () => validateBaseline(unstableEvidenceBaseline, ['no-unused-vars']),
  /must not store unstable line evidence/u,
  'stored line evidence must not be accepted as unauthenticated baseline data'
);
const duplicateBaseline = structuredClone(baseline);
duplicateBaseline.diagnostics.push(structuredClone(duplicateBaseline.diagnostics[0]));
assert.throws(
  () => validateBaseline(duplicateBaseline, ['no-unused-vars']),
  /must be unique/u,
  'duplicate diagnostic identities must not enter the baseline'
);
const occurrenceGapBaseline = structuredClone(baseline);
occurrenceGapBaseline.diagnostics[0].occurrence = 2;
assert.throws(
  () => validateBaseline(occurrenceGapBaseline, ['no-unused-vars']),
  /contiguous from 1/u,
  'duplicate occurrence evidence must be contiguous from one'
);
assert.throws(
  () => normalizeDiagnostics(rows, ['no-empty'], repoRoot),
  /unexpected rule no-unused-vars/u,
  'the probe must fail closed on diagnostics outside the reviewed rule set'
);

process.stdout.write('ESLint debt occurrence policy tests passed.\n');
