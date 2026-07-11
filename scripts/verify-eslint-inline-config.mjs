import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eslint = new ESLint({ cwd: repoRoot });
const virtualFile = path.join(repoRoot, 'scripts', 'inline-config-policy-probe.mjs');

const [suppressionAttempt] = await eslint.lintText('// eslint-disable-next-line no-undef\nmissingReference();\n', {
  filePath: virtualFile
});
assert.ok(
  suppressionAttempt.messages.some((message) => message.ruleId === 'no-undef' && message.severity === 2),
  'the real project config must report no-undef even behind a used eslint-disable-next-line directive'
);
assert.deepEqual(
  suppressionAttempt.suppressedMessages,
  [],
  'the real project config must not place diagnostics into ESLint suppressedMessages'
);

const [clean] = await eslint.lintText('const answer = 42;\nconsole.log(answer);\n', { filePath: virtualFile });
assert.equal(clean.errorCount, 0, 'the inline-config probe clean sample must have zero errors');
assert.equal(clean.warningCount, 0, 'the inline-config probe clean sample must have zero warnings');

console.log('ESLint inline configuration policy passed.');
