#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const policy = JSON.parse(readFileSync(resolve(here, 'code-quality-policy.json'), 'utf8'));
const records = policy.eslint?.baseline?.excludedRules;
if (!Array.isArray(records) || records.length === 0) {
  throw new Error('code-quality policy must declare excluded ESLint rule records');
}

const eslintPath = resolve(repoRoot, 'node_modules/eslint/bin/eslint.js');
const args = [eslintPath, '.'];
for (const { rule } of records) args.push('--rule', `${rule}:error`);
args.push('--format', 'json');

const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});
if (result.status !== 1) {
  throw new Error(`excluded-rule probe expected ESLint exit 1, received ${result.status}: ${result.stderr.trim()}`);
}

const rows = JSON.parse(result.stdout);
const actual = new Map(records.map(({ rule }) => [rule, { diagnostics: 0, files: new Set() }]));
for (const row of rows) {
  for (const message of row.messages) {
    const record = actual.get(message.ruleId);
    if (!record) throw new Error(`excluded-rule probe produced unexpected rule ${message.ruleId || '(none)'}`);
    record.diagnostics += 1;
    record.files.add(row.filePath);
  }
}

const failures = [];
for (const { rule, observedDiagnostics, observedAffectedFiles } of records) {
  const record = actual.get(rule);
  if (record.diagnostics !== observedDiagnostics || record.files.size !== observedAffectedFiles) {
    failures.push(
      `${rule}: expected ${observedDiagnostics} diagnostics in ${observedAffectedFiles} files, ` +
        `observed ${record.diagnostics} diagnostics in ${record.files.size} files`
    );
  }
}
if (failures.length > 0) {
  throw new Error(
    `excluded ESLint debt changed; fix the new debt or update reviewed evidence:\n- ${failures.join('\n- ')}`
  );
}

process.stdout.write(`Excluded ESLint debt probe passed for ${records.length} reviewed rules.\n`);
