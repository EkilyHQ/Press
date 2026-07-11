#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareExact,
  compareNoGrowth,
  createBaseline,
  normalizeDiagnostics,
  validateBaseline,
  validateRuleTransition
} from './eslint-debt-policy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const policy = JSON.parse(readFileSync(resolve(here, 'code-quality-policy.json'), 'utf8'));
const records = policy.eslint?.baseline?.excludedRules;
if (!Array.isArray(records) || records.length === 0) {
  throw new Error('code-quality policy must declare excluded ESLint rule records');
}
const reviewedRules = records.map(({ rule }) => rule);
const baselinePath = resolve(here, 'eslint-debt-baseline.json');
const eslintPath = resolve(repoRoot, 'node_modules/eslint/bin/eslint.js');
const args = [eslintPath, '.'];
for (const rule of reviewedRules) args.push('--rule', `${rule}:error`);
args.push('--format', 'json');

function runProbe(cwd) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (![0, 1].includes(result.status)) {
    throw new Error(
      `excluded-rule probe expected ESLint exit 0 or 1, received ${result.status}: ${result.stderr.trim()}`
    );
  }
  const diagnostics = normalizeDiagnostics(JSON.parse(result.stdout), reviewedRules, realpathSync(cwd));
  if (result.status !== (diagnostics.length > 0 ? 1 : 0)) {
    throw new Error(`excluded-rule probe exit ${result.status} did not match ${diagnostics.length} diagnostics`);
  }
  return diagnostics;
}

function scanCommitDiagnostics(commit) {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'press-eslint-debt-base-'));
  try {
    const archive = spawnSync('git', ['archive', '--format=tar', commit], {
      cwd: repoRoot,
      encoding: null,
      maxBuffer: 256 * 1024 * 1024
    });
    if (archive.status !== 0) {
      throw new Error(`cannot archive ESLint debt merge base: ${String(archive.stderr || '').trim()}`);
    }
    const extract = spawnSync('tar', ['-xf', '-', '-C', temporaryRoot], {
      input: archive.stdout,
      encoding: null,
      maxBuffer: 256 * 1024 * 1024
    });
    if (extract.status !== 0) {
      throw new Error(`cannot extract ESLint debt merge base: ${String(extract.stderr || '').trim()}`);
    }
    symlinkSync(resolve(repoRoot, 'node_modules'), resolve(temporaryRoot, 'node_modules'), 'dir');
    return runProbe(temporaryRoot);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

const diagnostics = runProbe(repoRoot);
const writeBaseline = process.argv.slice(2).includes('--write-baseline');
if (writeBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify(createBaseline(diagnostics, reviewedRules), null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${diagnostics.length} exact ESLint debt occurrences.\n`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
validateBaseline(baseline, reviewedRules);
const failures = compareExact(diagnostics, baseline.diagnostics);

const baseRef = String(process.env.CODE_QUALITY_BASE_REF || '').trim();
const declaredHead = String(process.env.CODE_QUALITY_HEAD_SHA || '').trim();
if (declaredHead && !baseRef) {
  throw new Error('CODE_QUALITY_HEAD_SHA requires CODE_QUALITY_BASE_REF');
}
if (baseRef) {
  const resolveCommit = (ref, label) => {
    const result = spawnSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    const commit = result.stdout.trim();
    if (result.status !== 0 || !/^[0-9a-f]{40}$/u.test(commit)) {
      throw new Error(`${label} must resolve to an exact commit`);
    }
    return commit;
  };
  const checkout = resolveCommit('HEAD', 'checkout HEAD');
  const headSha = declaredHead ? resolveCommit(declaredHead, 'CODE_QUALITY_HEAD_SHA') : checkout;
  if (checkout !== headSha) {
    throw new Error(`checked out HEAD ${checkout} does not match CODE_QUALITY_HEAD_SHA ${headSha}`);
  }
  const mergeBase = spawnSync('git', ['merge-base', baseRef, headSha], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  if (mergeBase.status !== 0 || !mergeBase.stdout.trim()) {
    throw new Error(`cannot resolve ESLint debt merge base: ${mergeBase.stderr.trim()}`);
  }
  const mergeBaseSha = mergeBase.stdout.trim();
  const baseBaseline = spawnSync('git', ['show', `${mergeBaseSha}:scripts/eslint-debt-baseline.json`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (baseBaseline.status === 0) {
    const parsedBase = JSON.parse(baseBaseline.stdout);
    validateBaseline(parsedBase, parsedBase.rules);
    failures.push(...validateRuleTransition(parsedBase.rules, reviewedRules));
    failures.push(...compareNoGrowth(diagnostics, parsedBase.diagnostics));
  } else {
    failures.push(...compareNoGrowth(diagnostics, scanCommitDiagnostics(mergeBaseSha)));
  }
}

if (failures.length > 0) {
  throw new Error(`excluded ESLint debt occurrence policy failed:\n- ${failures.join('\n- ')}`);
}

const actualCounts = new Map(reviewedRules.map((rule) => [rule, { diagnostics: 0, files: new Set() }]));
for (const diagnostic of diagnostics) {
  const record = actualCounts.get(diagnostic.rule);
  record.diagnostics += 1;
  record.files.add(diagnostic.path);
}
for (const { rule, observedDiagnostics, observedAffectedFiles } of records) {
  const actual = actualCounts.get(rule);
  if (actual.diagnostics > observedDiagnostics || actual.files.size > observedAffectedFiles) {
    throw new Error(
      `${rule}: exact baseline grew beyond the reviewed ceiling of ${observedDiagnostics} diagnostics in ` +
        `${observedAffectedFiles} files (${actual.diagnostics} diagnostics in ${actual.files.size} files)`
    );
  }
}

process.stdout.write(`Excluded ESLint debt probe passed for ${diagnostics.length} exact reviewed occurrences.\n`);
