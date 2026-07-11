#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path, { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  TYPESCRIPT_COMPILER_OPTION_RECORD,
  TYPESCRIPT_DEBT_SCHEMA_VERSION,
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

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const baselineRepositoryPath = 'scripts/typescript-debt-baseline.json';
const baselinePath = resolve(repoRoot, baselineRepositoryPath);
const rootScope = 'Git-tracked non-vendor assets/js .js/.mjs files';
const globalDiagnosticPath = '<global>';

function usage() {
  return [
    'Usage:',
    '  node scripts/probe-typescript-debt.mjs',
    '  node scripts/probe-typescript-debt.mjs --write-baseline',
    '',
    'The normal command requires an exact match with the versioned baseline.',
    'Use --write-baseline only after intentionally reducing the measured debt; CI',
    'still rejects new diagnostic keys or count growth relative to the merge base.'
  ].join('\n');
}

function parseArgs(argv) {
  if (argv.length === 0) return { writeBaseline: false };
  if (argv.length === 1 && argv[0] === '--write-baseline') return { writeBaseline: true };
  throw new Error(usage());
}

function gitText(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options
  }).trim();
}

function listRootFiles() {
  return execFileSync('git', ['ls-files', '-z', '--', 'assets/js'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
    .split('\0')
    .filter((file) => /\.(?:js|mjs)$/.test(file))
    .filter((file) => !file.startsWith('assets/js/vendor/'))
    .sort();
}

function compilerOptions() {
  return {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.Preserve,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts']
  };
}

function normalizeDiagnosticPath(fileName) {
  if (!fileName) return globalDiagnosticPath;
  const absolute = path.isAbsolute(fileName) ? fileName : resolve(repoRoot, fileName);
  const relative = path.relative(repoRoot, absolute).split(path.sep).join('/');
  if (relative === '' || relative === '..' || relative.startsWith('../')) {
    throw new Error(`TypeScript reported a non-repository diagnostic path: ${fileName}`);
  }
  return relative;
}

function flattenMessage(messageText) {
  return ts.flattenDiagnosticMessageText(messageText, '\n').replace(/\s+/g, ' ').trim();
}

function classifyPath(repositoryPath) {
  if (repositoryPath === globalDiagnosticPath) return 'global';
  if (repositoryPath.startsWith('assets/js/vendor/')) return 'transitiveVendor';
  if (repositoryPath.startsWith('assets/js/')) return 'firstParty';
  throw new Error(`TypeScript diagnostic escaped the reviewed assets/js graph: ${repositoryPath}`);
}

function collectBaseline() {
  const rootFiles = listRootFiles();
  const program = ts.createProgram({
    rootNames: rootFiles.map((file) => resolve(repoRoot, file)),
    options: compilerOptions()
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const programSources = program
    .getSourceFiles()
    .map((sourceFile) => {
      const absolute = path.isAbsolute(sourceFile.fileName)
        ? sourceFile.fileName
        : resolve(repoRoot, sourceFile.fileName);
      const repositoryPath = path.relative(repoRoot, absolute).split(path.sep).join('/');
      return { repositoryPath, sourceFile };
    })
    .filter(({ repositoryPath }) => repositoryPath.startsWith('assets/js/'))
    .sort((left, right) => {
      if (left.repositoryPath < right.repositoryPath) return -1;
      if (left.repositoryPath > right.repositoryPath) return 1;
      return 0;
    });
  const programSourcePaths = new Set(programSources.map(({ repositoryPath }) => repositoryPath));
  const missingRoots = rootFiles.filter((rootFile) => !programSourcePaths.has(rootFile));
  if (missingRoots.length > 0) {
    throw new Error(`TypeScript program omitted tracked roots: ${missingRoots.join(', ')}`);
  }
  const suppressions = programSources.flatMap(({ repositoryPath, sourceFile }) =>
    collectTypeScriptSuppressions(sourceFile, repositoryPath)
  );
  assertNoTypeScriptSuppressions(suppressions);
  const records = new Map();
  const affectedFiles = {
    firstParty: new Set(),
    transitiveVendor: new Set()
  };
  const counts = {
    firstParty: 0,
    transitiveVendor: 0,
    global: 0
  };

  for (const diagnostic of diagnostics) {
    const repositoryPath = normalizeDiagnosticPath(diagnostic.file?.fileName);
    const classification = classifyPath(repositoryPath);
    const entry = {
      path: repositoryPath,
      code: diagnostic.code,
      message: flattenMessage(diagnostic.messageText),
      count: 1
    };
    const identity = diagnosticIdentity(entry);
    const previous = records.get(identity);
    if (previous) previous.count += 1;
    else records.set(identity, entry);

    counts[classification] += 1;
    if (classification !== 'global') affectedFiles[classification].add(repositoryPath);
  }

  const diagnosticMultiset = [...records.values()].sort(compareDiagnosticEntries);
  const diagnosticFiles = new Set(
    diagnosticMultiset.map((entry) => entry.path).filter((file) => file !== globalDiagnosticPath)
  );

  return {
    schemaVersion: TYPESCRIPT_DEBT_SCHEMA_VERSION,
    typescriptVersion: ts.version,
    compilerOptions: TYPESCRIPT_COMPILER_OPTION_RECORD,
    roots: {
      scope: rootScope,
      count: rootFiles.length,
      hashAlgorithm: 'sha256-lf-path-list-v1',
      sha256: fingerprintRootFiles(rootFiles)
    },
    suppressions: {
      decision: 'prohibited-zero-baseline',
      scanner: 'TypeScript SourceFile commentDirectives/checkJsDirective',
      scannedFiles: programSources.length,
      tsIgnore: 0,
      tsExpectError: 0,
      tsNocheck: 0,
      total: 0
    },
    summary: {
      diagnostics: diagnostics.length,
      files: diagnosticFiles.size,
      firstPartyDiagnostics: counts.firstParty,
      firstPartyFiles: affectedFiles.firstParty.size,
      transitiveVendorDiagnostics: counts.transitiveVendor,
      transitiveVendorFiles: affectedFiles.transitiveVendor.size,
      globalDiagnostics: counts.global
    },
    diagnosticMultiset
  };
}

function parseBaseline(source, label) {
  let baseline;
  try {
    baseline = JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, { cause: error });
  }
  if (baseline?.schemaVersion !== TYPESCRIPT_DEBT_SCHEMA_VERSION) {
    throw new Error(`${label} must use schema version ${TYPESCRIPT_DEBT_SCHEMA_VERSION}`);
  }
  if (baseline.typescriptVersion !== ts.version) {
    throw new Error(`${label} requires TypeScript ${baseline.typescriptVersion}; installed ${ts.version}`);
  }
  if (!isDeepStrictEqual(baseline.compilerOptions, TYPESCRIPT_COMPILER_OPTION_RECORD)) {
    throw new Error(`${label} compiler options do not match the project-owned probe`);
  }
  if (!baseline.roots || !Number.isInteger(baseline.roots.count) || baseline.roots.count <= 0) {
    throw new Error(`${label} must record a positive root count`);
  }
  if (baseline.roots.scope !== rootScope || baseline.roots.hashAlgorithm !== 'sha256-lf-path-list-v1') {
    throw new Error(`${label} root-set contract is not recognized`);
  }
  if (!/^[0-9a-f]{64}$/.test(baseline.roots.sha256 || '')) {
    throw new Error(`${label} must record a lowercase SHA-256 root hash`);
  }
  if (
    !isDeepStrictEqual(baseline.suppressions, {
      decision: 'prohibited-zero-baseline',
      scanner: 'TypeScript SourceFile commentDirectives/checkJsDirective',
      scannedFiles: baseline.suppressions?.scannedFiles,
      tsIgnore: 0,
      tsExpectError: 0,
      tsNocheck: 0,
      total: 0
    }) ||
    !Number.isInteger(baseline.suppressions.scannedFiles) ||
    baseline.suppressions.scannedFiles < baseline.roots.count
  ) {
    throw new Error(`${label} must retain the zero-suppression TypeScript parser baseline`);
  }
  validateDiagnosticEntries(baseline.diagnosticMultiset);
  const diagnosticCount = baseline.diagnosticMultiset.reduce((sum, entry) => sum + entry.count, 0);
  if (baseline.summary?.diagnostics !== diagnosticCount) {
    throw new Error(`${label} aggregate diagnostic count does not match its multiset`);
  }
  return baseline;
}

function readWorkingBaseline() {
  if (!existsSync(baselinePath)) return null;
  return parseBaseline(readFileSync(baselinePath, 'utf8'), baselineRepositoryPath);
}

function readBaselineAtRef(ref) {
  const result = spawnSync('git', ['show', `${ref}:${baselineRepositoryPath}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status === 0) return parseBaseline(result.stdout, `${baselineRepositoryPath} at ${ref}`);
  if (/does not exist|exists on disk, but not in|Path .* does not exist/.test(result.stderr)) return null;
  throw new Error(`could not read ${baselineRepositoryPath} at ${ref}: ${result.stderr.trim()}`);
}

function resolveComparison() {
  const baseRef = process.env.CODE_QUALITY_BASE_REF?.trim();
  const headRef = process.env.CODE_QUALITY_HEAD_SHA?.trim();
  if (!baseRef && !headRef) return null;
  if (!baseRef || !headRef) {
    throw new Error('CODE_QUALITY_BASE_REF and CODE_QUALITY_HEAD_SHA must be provided together');
  }

  const head = gitText(['rev-parse', headRef]);
  const checkedOutHead = gitText(['rev-parse', 'HEAD']);
  if (head !== checkedOutHead) {
    throw new Error(`TypeScript debt probe expected checked-out head ${head}, observed ${checkedOutHead}`);
  }
  const baseTip = gitText(['rev-parse', baseRef]);
  const mergeBase = gitText(['merge-base', baseTip, head]);
  return { head, mergeBase, baseline: readBaselineAtRef(mergeBase) };
}

function formatViolation({ code, entry, previousCount }) {
  const key = `${entry.path} TS${entry.code}: ${entry.message}`;
  if (code === 'diagnostic-count-growth') return `${key} (${previousCount} -> ${entry.count})`;
  return key;
}

function assertNoGrowth(reference, actual, label) {
  const violations = evaluateDiagnosticTransition({
    baseEntries: reference.diagnosticMultiset,
    headEntries: actual.diagnosticMultiset
  });
  if (violations.length === 0) return;
  const details = violations.slice(0, 20).map(formatViolation);
  const remainder = violations.length > details.length ? `\n- ... ${violations.length - details.length} more` : '';
  throw new Error(
    `TypeScript debt grew relative to ${label}; fix the diagnostics instead of expanding the baseline:\n- ${details.join('\n- ')}${remainder}`
  );
}

function baselineDifference(expected, actual) {
  const parts = [];
  if (!isDeepStrictEqual(expected.roots, actual.roots)) {
    parts.push(
      `root set expected ${expected.roots.count}/${expected.roots.sha256}, observed ${actual.roots.count}/${actual.roots.sha256}`
    );
  }
  if (!isDeepStrictEqual(expected.summary, actual.summary)) {
    parts.push(`summary expected ${JSON.stringify(expected.summary)}, observed ${JSON.stringify(actual.summary)}`);
  }
  const growth = evaluateDiagnosticTransition({
    baseEntries: expected.diagnosticMultiset,
    headEntries: actual.diagnosticMultiset
  });
  if (growth.length > 0) parts.push(`${growth.length} new or growing diagnostic keys`);
  const reductions = evaluateDiagnosticTransition({
    baseEntries: actual.diagnosticMultiset,
    headEntries: expected.diagnosticMultiset
  });
  if (reductions.length > 0) parts.push(`${reductions.length} removed or reduced diagnostic keys`);
  return parts.join('; ') || 'baseline metadata differs';
}

async function writeBaseline(actual, current, comparison) {
  if (current) assertNoGrowth(current, actual, baselineRepositoryPath);
  if (comparison?.baseline) {
    assertNoGrowth(comparison.baseline, actual, `${baselineRepositoryPath} at merge base ${comparison.mergeBase}`);
  }
  writeFileSync(baselinePath, await formatBaselineJson(actual));
  process.stdout.write(
    `Wrote ${baselineRepositoryPath}: ${actual.summary.diagnostics} diagnostics in ${actual.summary.files} files across ${actual.roots.count} roots.\n`
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (ts.version !== '5.9.3') throw new Error(`TypeScript 5.9.3 is required; installed ${ts.version}`);
  const actual = collectBaseline();
  const current = readWorkingBaseline();
  const comparison = resolveComparison();

  if (options.writeBaseline) {
    await writeBaseline(actual, current, comparison);
    return;
  }
  if (!current) throw new Error(`${baselineRepositoryPath} is missing; bootstrap it with --write-baseline`);
  if (!isDeepStrictEqual(current, actual)) {
    throw new Error(
      `TypeScript debt differs from the exact checked-in baseline (${baselineDifference(current, actual)}). ` +
        'Fix new debt, or run --write-baseline only after an intentional reduction.'
    );
  }
  if (comparison?.baseline) {
    assertNoGrowth(comparison.baseline, actual, `${baselineRepositoryPath} at merge base ${comparison.mergeBase}`);
  } else if (comparison) {
    process.stdout.write(`Bootstrapping ${baselineRepositoryPath}; no baseline exists at ${comparison.mergeBase}.\n`);
  }

  process.stdout.write(
    `TypeScript debt probe passed: ${actual.summary.diagnostics} diagnostics in ${actual.summary.files} files ` +
      `(${actual.summary.firstPartyDiagnostics} first-party, ${actual.summary.transitiveVendorDiagnostics} transitive-vendor, ` +
      `${actual.summary.globalDiagnostics} global) across ${actual.roots.count} roots.\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
