#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateBaselineTransition } from './format-baseline-policy.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const baselinePath = resolve(here, 'prettier-baseline.json');
const baselineRepositoryPath = 'scripts/prettier-baseline.json';
const supportedExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.yaml', '.yml']);
const rootCandidates = new Set([
  '.prettierrc.json',
  'eslint-suppressions.json',
  'eslint.config.mjs',
  'index.html',
  'index_editor.html',
  'index_editor_preview.html',
  'package-lock.json',
  'package.json'
]);
const excludedPrefixes = ['assets/js/vendor/', 'dist/', 'node_modules/', 'release-artifacts/', 'scripts/fixtures/'];

function usage() {
  return [
    'Usage:',
    '  node scripts/check-format.mjs [--base-ref <git-ref>]',
    '  node scripts/check-format.mjs --write-baseline',
    '',
    'Existing unformatted tracked files are recorded in the baseline. New files',
    'must pass Prettier, and a PR may only shrink an established baseline.'
  ].join('\n');
}

function parseArgs(args) {
  const options = {
    baseRef: String(process.env.CODE_QUALITY_BASE_REF || '').trim(),
    help: false,
    writeBaseline: false
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--base-ref') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) throw new Error('--base-ref requires a git ref');
      options.baseRef = value;
      index += 1;
    } else if (arg === '--write-baseline') {
      options.writeBaseline = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (options.writeBaseline && options.baseRef) {
    throw new Error('--write-baseline cannot be combined with --base-ref or CODE_QUALITY_BASE_REF');
  }
  return options;
}

function gitPaths(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  })
    .split('\0')
    .filter(Boolean)
    .sort();
}

function gitNameStatus(base, head) {
  const tokens = execFileSync(
    'git',
    ['diff', '--name-status', '--find-renames=100%', '--diff-filter=ACMRTD', '-z', base, head, '--'],
    {
      cwd: repoRoot,
      maxBuffer: 16 * 1024 * 1024
    }
  )
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  const records = [];
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (/^[RC]/u.test(status)) {
      const oldPath = tokens[index++];
      const newPath = tokens[index++];
      if (!oldPath || !newPath) throw new Error(`invalid git name-status record for ${status}`);
      records.push({ status, oldPath, newPath });
    } else {
      const path = tokens[index++];
      if (!path) throw new Error(`invalid git name-status record for ${status}`);
      records.push({ status, oldPath: path, newPath: path });
    }
  }
  return records;
}

function gitText(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  }).trim();
}

function resolveCommit(ref, label) {
  const resolved = gitText(['rev-parse', '--verify', `${ref}^{commit}`]);
  if (!/^[0-9a-f]{40}$/u.test(resolved)) {
    throw new Error(`${label} must resolve to an exact 40-character commit SHA`);
  }
  return resolved;
}

function resolveComparison(baseRef) {
  const checkout = resolveCommit('HEAD', 'checkout HEAD');
  const declaredHead = String(process.env.CODE_QUALITY_HEAD_SHA || '').trim();
  if (declaredHead && !baseRef) {
    throw new Error('CODE_QUALITY_HEAD_SHA requires CODE_QUALITY_BASE_REF or --base-ref');
  }
  const head = declaredHead ? resolveCommit(declaredHead, 'CODE_QUALITY_HEAD_SHA') : checkout;
  if (checkout !== head) {
    throw new Error(`checked out HEAD ${checkout} does not match CODE_QUALITY_HEAD_SHA ${head}`);
  }
  if (!baseRef) return null;
  const baseTip = resolveCommit(baseRef, 'CODE_QUALITY_BASE_REF');
  return {
    base: resolveCommit(gitText(['merge-base', baseTip, head]), 'quality merge base'),
    head
  };
}

function isCandidate(path) {
  if (excludedPrefixes.some((prefix) => path.startsWith(prefix))) return false;
  if (rootCandidates.has(path)) return true;
  if (path.startsWith('.github/workflows/')) return supportedExtensions.has(extname(path));
  if (!path.startsWith('assets/') && !path.startsWith('packages/') && !path.startsWith('scripts/')) {
    return false;
  }
  return supportedExtensions.has(extname(path));
}

function parseBaseline(contents, label) {
  let baseline;
  try {
    baseline = JSON.parse(contents);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, { cause: error });
  }
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) {
    throw new Error(`${label} must be an object`);
  }
  if (baseline.schemaVersion !== 1) throw new Error(`${label}.schemaVersion must equal 1`);
  if (!Array.isArray(baseline.files)) throw new Error(`${label}.files must be an array`);
  if (baseline.files.some((path) => typeof path !== 'string' || !path)) {
    throw new Error(`${label}.files must contain only non-empty paths`);
  }
  const sorted = [...baseline.files].sort();
  if (new Set(sorted).size !== sorted.length) throw new Error(`${label}.files must not contain duplicates`);
  if (JSON.stringify(sorted) !== JSON.stringify(baseline.files)) {
    throw new Error(`${label}.files must be sorted`);
  }
  const invalid = sorted.filter((path) => !isCandidate(path));
  if (invalid.length > 0) throw new Error(`${label} contains non-candidate paths: ${invalid.join(', ')}`);
  return { schemaVersion: 1, files: sorted };
}

function loadBaseline() {
  if (!existsSync(baselinePath)) throw new Error(`${baselineRepositoryPath} is missing`);
  return parseBaseline(readFileSync(baselinePath, 'utf8'), baselineRepositoryPath);
}

function loadBaselineAtRef(ref) {
  const result = spawnSync('git', ['show', `${ref}:${baselineRepositoryPath}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status === 0) return parseBaseline(result.stdout, `${ref}:${baselineRepositoryPath}`);
  const error = String(result.stderr || result.stdout || '').trim();
  if (/does not exist in|exists on disk, but not in|path .* does not exist/u.test(error)) return null;
  throw new Error(`cannot read ${baselineRepositoryPath} at ${ref}: ${error || `git exited ${result.status}`}`);
}

async function unformattedPaths(paths, { baseline = false } = {}) {
  const prettier = await import('prettier');
  const config = await prettier.resolveConfig(resolve(repoRoot, 'package.json'), { editorconfig: true });
  const checks = await Promise.all(
    paths.map(async (path) => {
      const absolutePath = resolve(repoRoot, path);
      try {
        const formatted = await prettier.check(readFileSync(absolutePath, 'utf8'), {
          ...(config || {}),
          filepath: absolutePath
        });
        return formatted ? null : path;
      } catch (error) {
        if (baseline) return path;
        throw new Error(`Prettier could not check ${path}: ${error.message}`, { cause: error });
      }
    })
  );
  return checks.filter(Boolean);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const trackedCandidates = gitPaths(['ls-files', '-z']).filter(isCandidate);
  if (options.writeBaseline) {
    const files = await unformattedPaths(trackedCandidates, { baseline: true });
    writeFileSync(baselinePath, `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`);
    process.stdout.write(`Wrote ${baselineRepositoryPath} with ${files.length} existing unformatted files.\n`);
    return;
  }

  const baseline = loadBaseline();
  const trackedSet = new Set(trackedCandidates);
  const stale = baseline.files.filter((path) => !trackedSet.has(path));
  if (stale.length > 0) {
    throw new Error(`remove stale entries from ${baselineRepositoryPath}: ${stale.join(', ')}`);
  }

  const comparison = resolveComparison(options.baseRef);
  if (comparison) {
    const baseBaseline = loadBaselineAtRef(comparison.base);
    if (baseBaseline) {
      const violations = evaluateBaselineTransition({
        baseFiles: baseBaseline.files,
        headFiles: baseline.files,
        changes: gitNameStatus(comparison.base, comparison.head)
      });
      if (violations.length > 0) {
        const details = violations.map(({ code, file }) => `${code}: ${file}`).join(', ');
        throw new Error(`Prettier baseline transition failed relative to ${comparison.base}: ${details}`);
      }
    } else {
      process.stdout.write(`Bootstrapping ${baselineRepositoryPath}; no baseline exists at ${comparison.base}.\n`);
    }
  }

  const allCandidates = gitPaths(['ls-files', '-co', '--exclude-standard', '-z'])
    .filter((path) => existsSync(resolve(repoRoot, path)))
    .filter(isCandidate);
  const baselineSet = new Set(baseline.files);
  const enforced = allCandidates.filter((path) => !baselineSet.has(path));
  const failures = await unformattedPaths(enforced);
  if (failures.length > 0) {
    throw new Error(`Prettier check failed for:\n- ${failures.join('\n- ')}`);
  }
  process.stdout.write(
    `Prettier passed for ${enforced.length} enforced files; ${baseline.files.length} legacy files remain baselined.\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
