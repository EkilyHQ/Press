import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateBaselineTransition } from './format-baseline-policy.mjs';
import { TYPESCRIPT_COMPILER_OPTION_RECORD, validateDiagnosticEntries } from './typescript-debt-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_DEV_DEPENDENCIES = {
  '@eslint/js': '10.0.1',
  eslint: '10.6.0',
  globals: '17.7.0',
  prettier: '3.9.4',
  typescript: '5.9.3'
};
const EXPECTED_EXCLUDED_ESLINT_RULES = [
  'no-control-regex',
  'no-empty',
  'no-regex-spaces',
  'no-unused-vars',
  'no-useless-assignment',
  'no-useless-escape',
  'preserve-caught-error'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function requireNonEmptyStrings(values, label) {
  assert.ok(Array.isArray(values) && values.length > 0, `${label} must be a non-empty array`);
  for (const value of values) {
    assert.equal(typeof value, 'string', `${label} entries must be strings`);
    assert.ok(value.trim().length >= 12, `${label} entries must contain reviewable evidence`);
  }
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

const packageJson = readJson('package.json');
assert.equal(packageJson.private, true, 'the Press development package must remain private');
assert.deepEqual(packageJson.engines, { node: '>=22.18.0 <23' }, 'quality tooling must stay on the CI Node line');
assert.equal(packageJson.packageManager, 'npm@10.9.3', 'the lockfile owner must use a pinned npm version');
assert.deepEqual(
  packageJson.devDependencies,
  EXPECTED_DEV_DEPENDENCIES,
  'quality-tool dependencies must stay minimal and exactly pinned'
);
for (const [name, version] of Object.entries(packageJson.devDependencies)) {
  assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must use an exact semantic version`);
}
assert.equal(packageJson.scripts?.lint, 'eslint . --max-warnings 0', 'ESLint must enforce a zero-warning baseline');
assert.equal(
  packageJson.scripts?.['lint:debt-probe'],
  'node scripts/probe-eslint-debt.mjs',
  'excluded ESLint rules must retain an executable evidence probe'
);
assert.equal(
  packageJson.scripts?.['format:check'],
  'node scripts/check-format.mjs',
  'format checks must use the incremental baseline guard'
);
assert.equal(
  packageJson.scripts?.['types:probe:test'],
  'node scripts/test-typescript-debt-probe.mjs',
  'TypeScript debt transition policy must retain focused tests'
);
assert.equal(
  packageJson.scripts?.['types:probe'],
  'node scripts/probe-typescript-debt.mjs',
  'TypeScript debt must retain a project-owned compiler API probe'
);
assert.equal(
  packageJson.scripts?.['security:html-sinks'],
  'node scripts/check-html-sink-policy.mjs',
  'HTML and executable sink growth must retain an AST-based policy guard'
);
assert.equal(
  packageJson.scripts?.quality,
  'node scripts/test-code-quality-config.mjs && npm run lint && npm run lint:debt-probe && npm run types:probe:test && npm run types:probe && npm run format:check && npm run vendor:check && npm run security:html-sinks',
  'the quality gate must cover lint, type debt, formatting, vendored dependency provenance, and sink policy'
);

const packageLock = readJson('package-lock.json');
assert.deepEqual(
  packageLock.packages?.['']?.devDependencies,
  EXPECTED_DEV_DEPENDENCIES,
  'the lockfile root must exactly match the project development dependencies'
);
assert.deepEqual(packageLock.packages?.['node_modules/typescript'], {
  version: '5.9.3',
  resolved: 'https://registry.npmjs.org/typescript/-/typescript-5.9.3.tgz',
  integrity: 'sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==',
  dev: true,
  license: 'Apache-2.0',
  bin: {
    tsc: 'bin/tsc',
    tsserver: 'bin/tsserver'
  },
  engines: {
    node: '>=14.17'
  }
});

const htmlSinkPolicy = readJson('scripts/html-sink-policy.json');
assert.equal(htmlSinkPolicy.schemaVersion, 1, 'the HTML sink policy must use schema version 1');
assert.equal(
  htmlSinkPolicy.decision,
  'accepted-baseline-with-zero-growth',
  'the HTML sink baseline must retain its reviewed no-growth disposition'
);
assert.deepEqual(htmlSinkPolicy.expected, {
  dynamicImports: 12,
  innerHTMLEmptyWrites: 65,
  innerHTMLWrites: 112,
  insertAdjacentHTML: 2,
  prohibited: 0,
  serializerReads: 4,
  timerCallbackControls: 8
});
assert.equal(htmlSinkPolicy.approved.length, 138, 'all approved sink occurrences must retain exact fingerprints');

const workflow = read('.github/workflows/code-quality.yml');
assert.match(workflow, /^name: Code Quality$/m, 'the code-quality workflow must have a stable name');
assert.match(workflow, /^ {2}push:\n {4}branches:\n {6}- main$/m, 'the workflow must run on pushes to main');
assert.match(
  workflow,
  /^ {2}pull_request:\n {4}branches:\n {6}- main$/m,
  'the workflow must run on pull requests targeting main'
);
assert.match(workflow, /^ {2}workflow_dispatch:$/m, 'the workflow must support manual dispatch');
assert.match(workflow, /^ {2}schedule:\n {4}- cron: '[^']+ [^']+ \* \* [0-6]'$/m, 'the workflow must run weekly');
assert.match(workflow, /^permissions:\n {2}contents: read$/m, 'the workflow must use read-only repository permissions');
assert.doesNotMatch(workflow, /(?:write-all|contents:\s*write)/, 'the workflow must not grant write permissions');
assert.match(workflow, /^concurrency:\n {2}group: code-quality-/m, 'the workflow must define a concurrency group');
assert.match(workflow, /cancel-in-progress:/, 'the workflow must define a cancellation policy');
assert.match(workflow, /uses: actions\/checkout@v6/, 'the workflow must use the pinned checkout major');
assert.match(workflow, /fetch-depth: 0/, 'the baseline comparison requires complete Git history');
assert.match(workflow, /persist-credentials: false/, 'checkout credentials must not persist');
assert.match(
  workflow,
  /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/,
  'quality checks must inspect the exact pull-request head rather than a synthetic merge commit'
);
assert.match(workflow, /uses: actions\/setup-node@v6/, 'the workflow must use the pinned setup-node major');
assert.match(workflow, /node-version: 22\.18\.0/, 'the workflow must use the repository Node version');
assert.match(workflow, /npm_config_audit: 'false'/, 'npm audit must not add network work to the gate');
assert.match(workflow, /npm_config_fund: 'false'/, 'npm funding notices must be disabled');
assert.match(workflow, /npm_config_update_notifier: 'false'/, 'npm update notices must be disabled');
assert.match(
  workflow,
  /run: npm ci --ignore-scripts/,
  'quality dependencies must install from the lockfile without scripts'
);
assert.match(workflow, /run: npm run quality/, 'the workflow must run the complete quality gate');
assert.equal(
  workflow.includes('eslint-suppressions'),
  false,
  'the workflow must not restore a bulk-suppression baseline'
);
assert.match(
  workflow,
  /CODE_QUALITY_BASE_REF: \$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.before \|\| github\.sha \}\}/,
  'quality checks must receive the exact base ref tip for PR, push, and snapshot contexts'
);
assert.match(
  workflow,
  /CODE_QUALITY_HEAD_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/,
  'quality checks must receive the exact checked-out head SHA'
);
assert.match(
  workflow,
  /git merge-base "\$CODE_QUALITY_BASE_REF" "\$CODE_QUALITY_HEAD_SHA"/,
  'quality cleanup must derive the same merge base used by the formatter gate'
);
assert.match(
  workflow,
  /git diff --check "\$quality_base_sha" "\$CODE_QUALITY_HEAD_SHA"/,
  'quality cleanup must reject whitespace errors over the merge-base range'
);
assert.equal(
  countMatches(workflow, /git status --porcelain --untracked-files=all/g),
  3,
  'the workflow must check cleanliness before install, after install, and after quality checks'
);
assert.match(
  workflow,
  /- name: Verify quality gate cleanup\n {8}if: always\(\)/,
  'the final cleanup check must run even after a failed quality command'
);

for (const workflowPath of [
  '.github/workflows/code-quality.yml',
  '.github/workflows/full-test-suite.yml',
  '.github/workflows/main-guard.yml',
  '.github/workflows/pages.yml',
  '.github/workflows/product-state.yml',
  '.github/workflows/system-release.yml'
]) {
  const source = read(workflowPath);
  assert.match(source, /uses: actions\/setup-node@v6/, `${workflowPath} must pin the Node setup action`);
  assert.match(source, /node-version: 22\.18\.0/, `${workflowPath} must pin the repository Node version`);
}

const retiredModuleFlag = ['--experimental', 'default', 'type=module'].join('-');
for (const activePath of [
  'BRANCHING.md',
  'README.md',
  'scripts/run-tests.mjs',
  'scripts/test-frontmatter-roundtrip.sh',
  'scripts/test-manifest.json',
  'wwwroot/post/theme-contract/theme-contract_en.md'
]) {
  assert.equal(
    read(activePath).includes(retiredModuleFlag),
    false,
    `${activePath} must not use the retired module flag`
  );
}

const eslintConfig = read('eslint.config.mjs');
for (const ignoredPath of [
  'assets/js/vendor/**',
  'dist/**',
  'node_modules/**',
  'release-artifacts/**',
  'scripts/fixtures/**'
]) {
  assert.ok(eslintConfig.includes(`'${ignoredPath}'`), `ESLint must ignore ${ignoredPath}`);
}
assert.match(eslintConfig, /js\.configs\.recommended/, 'ESLint recommended rules must remain enabled');
assert.match(
  eslintConfig,
  /reportUnusedDisableDirectives:\s*'error'/,
  'stale ESLint disable directives must fail the gate'
);
for (const rule of EXPECTED_EXCLUDED_ESLINT_RULES) {
  const escapedRule = rule.replaceAll('-', '\\-');
  assert.match(
    eslintConfig,
    new RegExp(`['"]${escapedRule}['"]\\s*:\\s*['"]off['"]`),
    `${rule} must be explicitly disabled rather than bulk-suppressed`
  );
}
const disabledRules = [...eslintConfig.matchAll(/['"]([^'"]+)['"]\s*:\s*['"]off['"]/g)].map((match) => match[1]).sort();
assert.deepEqual(
  disabledRules,
  EXPECTED_EXCLUDED_ESLINT_RULES,
  'ESLint must not silently expand the reviewed excluded-rule set'
);
assert.equal(
  fs.existsSync(path.join(ROOT, 'eslint-suppressions.json')),
  false,
  'the repository must not carry an ESLint bulk-suppression file'
);
assert.equal(
  JSON.stringify(packageJson).includes('eslint-suppressions'),
  false,
  'package scripts must not depend on ESLint bulk suppressions'
);

const policy = readJson('scripts/code-quality-policy.json');
assert.equal(policy.schemaVersion, 1, 'the code-quality policy must use schema version 1');
assert.equal(
  policy.eslint?.baseline?.decision,
  'accepted-no-action',
  'noisy rules must be excluded through an explicit reviewed decision'
);
const excludedRuleRecords = policy.eslint?.baseline?.excludedRules;
assert.ok(Array.isArray(excludedRuleRecords), 'the policy must list each excluded ESLint rule');
assert.deepEqual(
  excludedRuleRecords.map(({ rule }) => rule).sort(),
  EXPECTED_EXCLUDED_ESLINT_RULES,
  'the policy must not silently expand the excluded ESLint rule set'
);
for (const { rule, evidence, observedDiagnostics, observedAffectedFiles } of excludedRuleRecords) {
  assert.equal(typeof evidence, 'string', `${rule} exclusion evidence must be a string`);
  assert.ok(evidence.trim().length >= 24, `${rule} exclusion must retain reviewable evidence`);
  assert.ok(Number.isInteger(observedDiagnostics) && observedDiagnostics > 0, `${rule} must record diagnostics`);
  assert.ok(Number.isInteger(observedAffectedFiles) && observedAffectedFiles > 0, `${rule} must record files`);
}
assert.equal(policy.eslint?.baseline?.observedAtCommit, '40d441f84ff17fd2a0edf17d00d27f42e62a8390');
assert.equal(policy.eslint?.baseline?.probeCommand, 'node scripts/probe-eslint-debt.mjs');
const eslintDebtProbe = read('scripts/probe-eslint-debt.mjs');
for (const token of ['observedDiagnostics', 'observedAffectedFiles', 'unexpected rule']) {
  assert.match(eslintDebtProbe, new RegExp(token), `ESLint debt probe must enforce ${token}`);
}
assert.equal(
  policy.eslint?.noGrowth?.mechanism,
  'zero-baseline',
  'all enabled recommended rules must enforce a zero-error baseline'
);
assert.equal(
  policy.eslint?.noGrowth?.command,
  'eslint . --max-warnings 0',
  'the policy and package script must share the zero-warning command'
);
assert.equal(policy.prettier?.baseline?.file, 'scripts/prettier-baseline.json');
assert.equal(
  policy.prettier?.noGrowth?.mechanism,
  'merge-base-shrinking-file-baseline',
  'formatting debt must shrink from the real merge base when a legacy file is touched'
);
assert.equal(
  policy.prettier?.noGrowth?.baseRefEnvironmentVariable,
  'CODE_QUALITY_BASE_REF',
  'the policy and workflow must share the exact-base environment contract'
);
assert.equal(
  policy.prettier?.noGrowth?.headShaEnvironmentVariable,
  'CODE_QUALITY_HEAD_SHA',
  'the policy and workflow must share the exact-head environment contract'
);
const formatCheck = read('scripts/check-format.mjs');
assert.match(
  formatCheck,
  /gitText\(\['merge-base', baseTip, head\]\)/,
  'format baseline comparison must resolve the real merge base instead of comparing the moving base tip'
);
assert.match(formatCheck, /CODE_QUALITY_HEAD_SHA/, 'format checks must verify the exact checked-out head');
assert.match(formatCheck, /--find-renames=100%/, 'only exact-content renames may transfer baseline ownership');
assert.deepEqual(
  evaluateBaselineTransition({
    baseFiles: ['legacy.js'],
    headFiles: ['legacy.js'],
    changes: [{ status: 'M', oldPath: 'legacy.js', newPath: 'legacy.js' }]
  }),
  [{ code: 'touched-baseline-retained', file: 'legacy.js' }],
  'touching a legacy file must remove it from the baseline'
);
assert.deepEqual(
  evaluateBaselineTransition({
    baseFiles: ['legacy.js'],
    headFiles: ['renamed.js'],
    changes: [{ status: 'R100', oldPath: 'legacy.js', newPath: 'renamed.js' }]
  }),
  [],
  'an exact-content rename may transfer an existing baseline entry'
);
assert.deepEqual(
  evaluateBaselineTransition({
    baseFiles: ['legacy.js'],
    headFiles: ['new.js'],
    changes: [{ status: 'A', oldPath: 'new.js', newPath: 'new.js' }]
  }),
  [{ code: 'baseline-growth', file: 'new.js' }],
  'new files must never enter the historical baseline'
);
assert.deepEqual(
  evaluateBaselineTransition({
    baseFiles: ['legacy.js'],
    headFiles: [],
    changes: [{ status: 'M', oldPath: 'legacy.js', newPath: 'legacy.js' }]
  }),
  [],
  'formatting a touched legacy file may remove it from the baseline'
);
const prettierBaseline = readJson('scripts/prettier-baseline.json');
assert.equal(prettierBaseline.schemaVersion, 1, 'the Prettier baseline must use schema version 1');
assert.ok(Array.isArray(prettierBaseline.files), 'the Prettier baseline must publish a file list');
assert.deepEqual(
  prettierBaseline.files,
  [...new Set(prettierBaseline.files)].sort(),
  'the Prettier baseline must contain unique, sorted paths'
);
for (const file of prettierBaseline.files) {
  assert.equal(typeof file, 'string', 'Prettier baseline entries must be strings');
  assert.ok(file.length > 0 && !path.isAbsolute(file) && !file.startsWith('../'));
  assert.equal(file.includes('\\'), false, `Prettier baseline path must use forward slashes: ${file}`);
}
assert.equal(
  policy.prettier?.baseline?.initialFiles,
  prettierBaseline.files.length,
  'the policy must publish the initial formatting-debt count'
);
assert.equal(
  policy.types?.decision,
  'accepted-baseline-with-zero-growth',
  'the current type-debt decision must be executable and growth-blocking'
);
assert.deepEqual(policy.types?.baseline, {
  file: 'scripts/typescript-debt-baseline.json',
  probeCommand: 'node scripts/probe-typescript-debt.mjs',
  writeCommand: 'node scripts/probe-typescript-debt.mjs --write-baseline'
});
assert.equal(policy.types?.evidence?.typescriptVersion, '5.9.3');
assert.match(policy.types?.evidence?.command || '', /node scripts\/probe-typescript-debt\.mjs/);
assert.equal(policy.types?.evidence?.explicitInputFiles, 228);
assert.ok(
  Number.isInteger(policy.types?.evidence?.diagnostics) && policy.types.evidence.diagnostics > 0,
  'the type-checking decision must record the measured diagnostic count'
);
assert.ok(
  Number.isInteger(policy.types?.evidence?.files) && policy.types.evidence.files > 0,
  'the type-checking decision must record the measured file count'
);
assert.equal(policy.types?.evidence?.firstPartyDiagnostics, 905);
assert.equal(policy.types?.evidence?.firstPartyFiles, 83);
assert.equal(policy.types?.evidence?.transitiveVendorDiagnostics, 565);
assert.equal(policy.types?.evidence?.transitiveVendorFiles, 4);
assert.ok(
  typeof policy.types?.evidence?.reason === 'string' && policy.types.evidence.reason.trim().length >= 40,
  'the type-checking decision must retain an evidence-backed rationale'
);
assert.deepEqual(policy.types?.noGrowth, {
  mechanism: 'exact-head-multiset-with-merge-base-zero-growth',
  baseRefEnvironmentVariable: 'CODE_QUALITY_BASE_REF',
  headShaEnvironmentVariable: 'CODE_QUALITY_HEAD_SHA',
  policy:
    'The checked-in baseline must exactly match the current deterministic root graph and diagnostics. CI rejects every new path/code/message key and any count growth relative to the merge base; intentional reductions are persisted only through the reviewed --write-baseline workflow.'
});
assert.deepEqual(policy.types?.suppressions, {
  decision: 'prohibited-zero-baseline',
  directives: ['@ts-ignore', '@ts-expect-error', '@ts-nocheck'],
  scanner: 'TypeScript SourceFile commentDirectives/checkJsDirective',
  count: 0,
  policy:
    'Every tracked probe root and every repository-local assets/js source loaded into the TypeScript program is parsed with TypeScript semantics. Real suppression comments fail closed; identical text in strings or ordinary prose is not a directive.'
});
requireNonEmptyStrings(policy.types?.revisitWhen, 'types.revisitWhen');

const typescriptBaseline = readJson('scripts/typescript-debt-baseline.json');
assert.equal(typescriptBaseline.schemaVersion, 1, 'the TypeScript debt baseline must use schema version 1');
assert.equal(typescriptBaseline.typescriptVersion, '5.9.3', 'the baseline must match the locked compiler');
assert.deepEqual(
  typescriptBaseline.compilerOptions,
  TYPESCRIPT_COMPILER_OPTION_RECORD,
  'the baseline must publish the exact compiler API options'
);
assert.deepEqual(typescriptBaseline.roots, {
  scope: 'Git-tracked non-vendor assets/js .js/.mjs files',
  count: 228,
  hashAlgorithm: 'sha256-lf-path-list-v1',
  sha256: '06562c8d4e201ee73a6973d704d788f93f7ab2e55c4235e7ccc2a5da017f5378'
});
assert.deepEqual(typescriptBaseline.suppressions, {
  decision: 'prohibited-zero-baseline',
  scanner: 'TypeScript SourceFile commentDirectives/checkJsDirective',
  scannedFiles: 232,
  tsIgnore: 0,
  tsExpectError: 0,
  tsNocheck: 0,
  total: 0
});
assert.deepEqual(typescriptBaseline.summary, {
  diagnostics: 1470,
  files: 87,
  firstPartyDiagnostics: 905,
  firstPartyFiles: 83,
  transitiveVendorDiagnostics: 565,
  transitiveVendorFiles: 4,
  globalDiagnostics: 0
});
validateDiagnosticEntries(typescriptBaseline.diagnosticMultiset);
assert.equal(
  typescriptBaseline.diagnosticMultiset.reduce((sum, entry) => sum + entry.count, 0),
  typescriptBaseline.summary.diagnostics,
  'the TypeScript aggregate count must equal its deterministic diagnostic multiset'
);
assert.equal(policy.types.evidence.diagnostics, typescriptBaseline.summary.diagnostics);
assert.equal(policy.types.evidence.files, typescriptBaseline.summary.files);
assert.equal(policy.types.evidence.firstPartyDiagnostics, typescriptBaseline.summary.firstPartyDiagnostics);
assert.equal(policy.types.evidence.firstPartyFiles, typescriptBaseline.summary.firstPartyFiles);
assert.equal(policy.types.evidence.transitiveVendorDiagnostics, typescriptBaseline.summary.transitiveVendorDiagnostics);
assert.equal(policy.types.evidence.transitiveVendorFiles, typescriptBaseline.summary.transitiveVendorFiles);
const typescriptProbe = read('scripts/probe-typescript-debt.mjs');
for (const token of [
  "git', ['ls-files'",
  'ts.createProgram',
  'ts.getPreEmitDiagnostics',
  'CODE_QUALITY_BASE_REF',
  'CODE_QUALITY_HEAD_SHA',
  "gitText(['merge-base'",
  '--write-baseline',
  'formatBaselineJson(actual)',
  'collectTypeScriptSuppressions',
  'assertNoTypeScriptSuppressions',
  'assertNoGrowth'
]) {
  assert.ok(typescriptProbe.includes(token), `TypeScript debt probe must retain ${token}`);
}

const gitignore = read('.gitignore').split(/\r?\n/);
assert.ok(gitignore.includes('node_modules/'), 'project-local dependencies must remain ignored');
assert.ok(gitignore.includes('/dist/'), 'generated release and Pages output must remain ignored');

console.log('Code quality configuration checks passed.');
