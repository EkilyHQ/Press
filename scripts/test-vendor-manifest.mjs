import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const VENDOR_PREFIX = 'assets/js/vendor/';
const VENDOR_ROOT = path.join(REPO_ROOT, 'assets/js/vendor');
const MANIFEST_PATH = path.join(SCRIPT_DIR, 'vendor-manifest.json');
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const NPM_INTEGRITY_PATTERN = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const NPM_PACKAGE_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ALLOWED_LICENSES = new Set(['BSD-3-Clause', 'MIT']);

const COMPONENT_POLICIES = new Map([
  [
    'acorn',
    {
      name: 'Acorn',
      version: '8.17.0',
      licenseSpdx: 'MIT',
      sourceUrl: 'https://github.com/acornjs/acorn',
      releaseUrl: (version) => `https://github.com/acornjs/acorn/releases/tag/${version}`,
      npmPackage: 'acorn',
      tarballIntegrity:
        'sha512-xRQbDb9BnwDafYNn6Vwl839DYVjqXYb1XVGtWAZ1kcDc6iwAL4hg3B1dZlRiuENFeO2H53gFG3in621AdERVAg==',
      sourcePaths: ['package/dist/acorn.mjs'],
      versionEvidenceKind: 'embedded-version',
      owns: (filePath) => filePath === 'assets/js/vendor/acorn.mjs',
      versionChecks: [
        {
          path: 'assets/js/vendor/acorn.mjs',
          pattern: /var version = ["'](\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)["'];/,
          description: 'Acorn runtime version'
        }
      ]
    }
  ],
  [
    'acorn-walk',
    {
      name: 'acorn-walk',
      version: '8.3.5',
      licenseSpdx: 'MIT',
      sourceUrl: 'https://github.com/acornjs/acorn',
      releaseUrl: (version) => `https://www.npmjs.com/package/acorn-walk/v/${version}`,
      npmPackage: 'acorn-walk',
      tarballIntegrity:
        'sha512-HEHNfbars9v4pgpW6SO1KSPkfoS0xVOM/9UzkJltjlsHZmJasxg8aXkuZa7SMf8vKGIBhpUsPluQSqhJFCqebw==',
      sourcePaths: ['package/dist/walk.mjs'],
      versionEvidenceKind: 'manifest-digest-inventory',
      owns: (filePath) => filePath === 'assets/js/vendor/acorn-walk.mjs',
      versionChecks: []
    }
  ],
  [
    'fflate',
    {
      name: 'fflate',
      version: '0.8.2',
      licenseSpdx: 'MIT',
      sourceUrl: 'https://github.com/101arrowz/fflate',
      releaseUrl: (version) => `https://github.com/101arrowz/fflate/releases/tag/v${version}`,
      npmPackage: 'fflate',
      tarballIntegrity:
        'sha512-cPJU47OaAoCbg0pBvzsgpTPhmhqI5eJjh/JIu8tPj5q+T7iLvW/JAYUqmE7KOB4R1ZyEhzBaIQpQpardBF5z8A==',
      sourcePaths: ['package/esm/browser.js'],
      versionEvidenceKind: 'embedded-version',
      owns: (filePath) => filePath === 'assets/js/vendor/fflate.browser.js',
      versionChecks: [
        {
          path: 'assets/js/vendor/fflate.browser.js',
          pattern: /\/\/ fflate (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/,
          description: 'fflate bundle header version'
        }
      ]
    }
  ],
  [
    'highlightjs',
    {
      name: 'highlight.js',
      version: '11.11.1',
      licenseSpdx: 'BSD-3-Clause',
      sourceUrl: 'https://github.com/highlightjs/highlight.js',
      releaseUrl: (version) => `https://github.com/highlightjs/highlight.js/releases/tag/${version}`,
      npmPackage: '@highlightjs/cdn-assets',
      tarballIntegrity:
        'sha512-VEPdHzwelZ12hEX18BHduqxMZGolcUsrbeokHYxOUIm8X2+M7nx5QPtPeQgRxR9XjhdLv4/7DD5BWOlSrJ3k7Q==',
      sourcePaths: ['package/es/highlight.min.js'],
      versionEvidenceKind: 'embedded-version',
      owns: (filePath) => filePath === 'assets/js/vendor/highlightjs/highlight.min.js',
      versionChecks: [
        {
          path: 'assets/js/vendor/highlightjs/highlight.min.js',
          pattern: /Highlight\.js v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/,
          description: 'highlight.js bundle header version'
        },
        {
          path: 'assets/js/vendor/highlightjs/highlight.min.js',
          pattern: /versionString=["'](\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)["']/,
          description: 'highlight.js runtime version'
        }
      ]
    }
  ],
  [
    'katex',
    {
      name: 'KaTeX',
      version: '0.16.45',
      licenseSpdx: 'MIT',
      sourceUrl: 'https://github.com/KaTeX/KaTeX',
      releaseUrl: (version) => `https://github.com/KaTeX/KaTeX/releases/tag/v${version}`,
      npmPackage: 'katex',
      tarballIntegrity:
        'sha512-pQpZbdBu7wCTmQUh7ufPmLr0pFoObnGUoL/yhtwJDgmmQpbkg/0HSVti25Fu4rmd1oCR6NGWe9vqTWuWv3GcNA==',
      sourcePaths: ['package/dist/fonts/', 'package/dist/katex.min.css', 'package/dist/katex.min.js'],
      versionEvidenceKind: 'embedded-version',
      owns: (filePath) => filePath.startsWith('assets/js/vendor/katex/'),
      versionChecks: [
        {
          path: 'assets/js/vendor/katex/katex.min.js',
          pattern: /version:["'](\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)["']/,
          description: 'KaTeX runtime version'
        },
        {
          path: 'assets/js/vendor/katex/katex.min.css',
          pattern: /\.katex-version:after\{content:["'](\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)["']\}/,
          description: 'KaTeX stylesheet version'
        }
      ]
    }
  ]
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, expectedKeys, label) {
  assert(isPlainObject(value), `${label} must be an object`);
  const actualKeys = Object.keys(value).sort();
  const sortedExpected = [...expectedKeys].sort();
  assert(
    JSON.stringify(actualKeys) === JSON.stringify(sortedExpected),
    `${label} must contain exactly: ${sortedExpected.join(', ')}`
  );
}

function assertNonEmptyString(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
}

function assertSorted(values, label) {
  const sorted = [...values].sort((left, right) => left.localeCompare(right));
  assert(JSON.stringify(values) === JSON.stringify(sorted), `${label} must be sorted`);
}

function assertUnique(values, label) {
  assert(new Set(values).size === values.length, `${label} must be unique`);
}

function formatSetDifference(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((value) => !actualSet.has(value));
  const extra = actual.filter((value) => !expectedSet.has(value));
  const details = [];
  if (missing.length > 0) details.push(`missing: ${missing.join(', ')}`);
  if (extra.length > 0) details.push(`extra: ${extra.join(', ')}`);
  return details.join('; ');
}

function assertSamePaths(expected, actual, label) {
  const same =
    expected.length === actual.length && expected.every((expectedPath, index) => expectedPath === actual[index]);
  assert(same, `${label} (${formatSetDifference(expected, actual) || 'ordering differs'})`);
}

function assertSafeVendorPath(filePath, label) {
  assertNonEmptyString(filePath, label);
  assert(filePath.startsWith(VENDOR_PREFIX), `${label} must be below ${VENDOR_PREFIX}`);
  assert(!path.posix.isAbsolute(filePath), `${label} must be repository-relative`);
  assert(filePath === path.posix.normalize(filePath), `${label} must be normalized`);
  assert(!filePath.split('/').includes('..'), `${label} must not traverse parent directories`);
  assert(!filePath.includes('\\'), `${label} must use POSIX separators`);
}

function assertSafeUpstreamPath(filePath, label) {
  assertNonEmptyString(filePath, label);
  assert(filePath.startsWith('package/'), `${label} must be rooted in the npm tarball's package/ directory`);
  assert(!path.posix.isAbsolute(filePath), `${label} must be tarball-relative`);
  assert(filePath === path.posix.normalize(filePath), `${label} must be normalized`);
  assert(!filePath.split('/').includes('..'), `${label} must not traverse parent directories`);
  assert(!filePath.includes('\\'), `${label} must use POSIX separators`);
}

function assertAuditNote(value, label) {
  assertNonEmptyString(value, label);
  assert(value === value.trim(), `${label} must not have leading or trailing whitespace`);
  assert(value.length >= 20, `${label} must contain an auditable explanation`);
}

function assertCanonicalHttpsUrl(value, label, allowedHosts) {
  assertNonEmptyString(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} must be a valid URL`);
  }
  assert(parsed.protocol === 'https:', `${label} must use HTTPS`);
  assert(allowedHosts.includes(parsed.hostname), `${label} must use one of: ${allowedHosts.join(', ')}`);
  assert(parsed.username === '' && parsed.password === '', `${label} must not contain credentials`);
  assert(parsed.search === '' && parsed.hash === '', `${label} must not contain a query or fragment`);
  assert(value === parsed.href.replace(/\/$/, ''), `${label} must be canonical and omit a trailing slash`);
}

function npmVersionUrl(packageName, version) {
  return `https://www.npmjs.com/package/${packageName}/v/${version}`;
}

function npmTarballUrl(packageName, version) {
  const packageLeaf = packageName.split('/').at(-1);
  return `https://registry.npmjs.org/${packageName}/-/${packageLeaf}-${version}.tgz`;
}

function trackedVendorPaths() {
  const output = execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '-z', '--', 'assets/js/vendor'], {
    encoding: 'utf8'
  });
  return output
    .split('\0')
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

async function diskVendorPaths(directory = VENDOR_ROOT) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) fail(`vendored dependency path must not be a symbolic link: ${absolutePath}`);
    if (entry.isDirectory()) {
      paths.push(...(await diskVendorPaths(absolutePath)));
      continue;
    }
    assert(entry.isFile(), `vendored dependency path must be a regular file: ${absolutePath}`);
    paths.push(path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/'));
  }
  return paths.sort((left, right) => left.localeCompare(right));
}

async function sha256(filePath) {
  const absolutePath = path.join(REPO_ROOT, filePath);
  const stats = await lstat(absolutePath);
  assert(stats.isFile() && !stats.isSymbolicLink(), `vendored dependency must be a regular file: ${filePath}`);
  return createHash('sha256')
    .update(await readFile(absolutePath))
    .digest('hex');
}

async function readManifest() {
  let source;
  try {
    source = await readFile(MANIFEST_PATH, 'utf8');
  } catch (error) {
    fail(`cannot read ${path.relative(REPO_ROOT, MANIFEST_PATH)}: ${error.message}`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`vendor manifest must be valid JSON: ${error.message}`);
  }
}

async function validateManifest(manifest, { allowEmptyDigests = false } = {}) {
  assertExactKeys(manifest, ['schemaVersion', 'generatedBy', 'components'], 'vendor manifest');
  assert(manifest.schemaVersion === 2, 'vendor manifest schemaVersion must be 2');
  assert(
    manifest.generatedBy === 'node scripts/test-vendor-manifest.mjs --write-digests',
    'vendor manifest generatedBy must name the controlled digest update command'
  );
  assert(Array.isArray(manifest.components) && manifest.components.length > 0, 'components must be a non-empty array');

  const componentIds = manifest.components.map((component) => component.id);
  const componentNames = manifest.components.map((component) => component.name);
  assertSorted(componentIds, 'component ids');
  assertUnique(componentIds, 'component ids');
  assertUnique(componentNames, 'component names');
  assertSamePaths(
    [...COMPONENT_POLICIES.keys()],
    componentIds,
    'manifest must contain exactly the supported components'
  );

  const trackedPaths = trackedVendorPaths();
  const diskPaths = await diskVendorPaths();
  assertSamePaths(trackedPaths, diskPaths, 'tracked and on-disk vendor inventories must match exactly');

  const allManifestPaths = [];
  for (const [componentIndex, component] of manifest.components.entries()) {
    const label = `components[${componentIndex}]`;
    assertExactKeys(
      component,
      ['id', 'name', 'version', 'licenseSpdx', 'sourceUrl', 'releaseUrl', 'provenance', 'files'],
      label
    );
    assertNonEmptyString(component.id, `${label}.id`);
    assertNonEmptyString(component.name, `${label}.name`);
    assert(SEMVER_PATTERN.test(component.version), `${label}.version must be a semantic version`);
    assert(ALLOWED_LICENSES.has(component.licenseSpdx), `${label}.licenseSpdx is not allowed`);
    assert(Array.isArray(component.files) && component.files.length > 0, `${label}.files must be a non-empty array`);

    const policy = COMPONENT_POLICIES.get(component.id);
    assert(policy, `${label}.id is unsupported: ${component.id}`);
    assert(component.name === policy.name, `${label}.name must be ${policy.name}`);
    assert(component.version === policy.version, `${label}.version must be ${policy.version}`);
    assert(component.licenseSpdx === policy.licenseSpdx, `${label}.licenseSpdx must be ${policy.licenseSpdx}`);
    assertCanonicalHttpsUrl(component.sourceUrl, `${label}.sourceUrl`, ['github.com']);
    assertCanonicalHttpsUrl(component.releaseUrl, `${label}.releaseUrl`, ['github.com', 'www.npmjs.com']);
    assert(component.sourceUrl === policy.sourceUrl, `${label}.sourceUrl must be ${policy.sourceUrl}`);
    assert(
      component.releaseUrl === policy.releaseUrl(component.version),
      `${label}.releaseUrl must identify the declared version's canonical release`
    );

    const provenanceLabel = `${label}.provenance`;
    const provenance = component.provenance;
    assertExactKeys(
      provenance,
      [
        'npmPackage',
        'npmVersionUrl',
        'tarballUrl',
        'tarballIntegrity',
        'sourcePaths',
        'localCopyNotes',
        'versionEvidence'
      ],
      provenanceLabel
    );
    assert(
      NPM_PACKAGE_PATTERN.test(provenance.npmPackage),
      `${provenanceLabel}.npmPackage must be a canonical npm package name`
    );
    assert(provenance.npmPackage === policy.npmPackage, `${provenanceLabel}.npmPackage must be ${policy.npmPackage}`);
    assertCanonicalHttpsUrl(provenance.npmVersionUrl, `${provenanceLabel}.npmVersionUrl`, ['www.npmjs.com']);
    assert(
      provenance.npmVersionUrl === npmVersionUrl(provenance.npmPackage, component.version),
      `${provenanceLabel}.npmVersionUrl must bind the npm package to the declared version`
    );
    assertCanonicalHttpsUrl(provenance.tarballUrl, `${provenanceLabel}.tarballUrl`, ['registry.npmjs.org']);
    assert(
      provenance.tarballUrl === npmTarballUrl(provenance.npmPackage, component.version),
      `${provenanceLabel}.tarballUrl must bind the registry artifact to the declared package and version`
    );
    assert(
      NPM_INTEGRITY_PATTERN.test(provenance.tarballIntegrity),
      `${provenanceLabel}.tarballIntegrity must be an npm SHA-512 integrity value`
    );
    assert(
      provenance.tarballIntegrity === policy.tarballIntegrity,
      `${provenanceLabel}.tarballIntegrity must match the independently verified npm registry metadata`
    );
    assert(
      Array.isArray(provenance.sourcePaths) && provenance.sourcePaths.length > 0,
      `${provenanceLabel}.sourcePaths must be a non-empty array`
    );
    assertSorted(provenance.sourcePaths, `${provenanceLabel}.sourcePaths`);
    assertUnique(provenance.sourcePaths, `${provenanceLabel}.sourcePaths`);
    for (const [sourceIndex, sourcePath] of provenance.sourcePaths.entries()) {
      assertSafeUpstreamPath(sourcePath, `${provenanceLabel}.sourcePaths[${sourceIndex}]`);
    }
    assertSamePaths(policy.sourcePaths, provenance.sourcePaths, `${provenanceLabel}.sourcePaths must be verified`);
    assertAuditNote(provenance.localCopyNotes, `${provenanceLabel}.localCopyNotes`);
    assertExactKeys(provenance.versionEvidence, ['kind', 'notes'], `${provenanceLabel}.versionEvidence`);
    assert(
      provenance.versionEvidence.kind === policy.versionEvidenceKind,
      `${provenanceLabel}.versionEvidence.kind must be ${policy.versionEvidenceKind}`
    );
    assertAuditNote(provenance.versionEvidence.notes, `${provenanceLabel}.versionEvidence.notes`);
    if (policy.versionEvidenceKind === 'manifest-digest-inventory') {
      assert(policy.versionChecks.length === 0, `${component.id} must not claim a fabricated embedded version check`);
      const evidenceNotes = provenance.versionEvidence.notes.toLowerCase();
      assert(
        evidenceNotes.includes('no embedded version') &&
          evidenceNotes.includes('sha-256') &&
          evidenceNotes.includes('inventory'),
        `${provenanceLabel}.versionEvidence.notes must disclose the missing marker and digest/inventory constraint`
      );
    } else {
      assert(policy.versionChecks.length > 0, `${component.id} must have at least one embedded version check`);
    }

    const componentPaths = component.files.map((file) => file.path);
    assertSorted(componentPaths, `${label}.files paths`);
    assertUnique(componentPaths, `${label}.files paths`);
    const expectedComponentPaths = trackedPaths.filter(policy.owns);
    assertSamePaths(expectedComponentPaths, componentPaths, `${component.id} file ownership must be complete`);

    for (const [fileIndex, file] of component.files.entries()) {
      const fileLabel = `${label}.files[${fileIndex}]`;
      assertExactKeys(file, ['path', 'sha256'], fileLabel);
      assertSafeVendorPath(file.path, `${fileLabel}.path`);
      assert(policy.owns(file.path), `${fileLabel}.path is not owned by ${component.id}`);
      if (allowEmptyDigests) {
        assert(
          file.sha256 === '' || SHA256_PATTERN.test(file.sha256),
          `${fileLabel}.sha256 must be empty or a lowercase SHA-256 digest in write mode`
        );
      } else {
        assert(SHA256_PATTERN.test(file.sha256), `${fileLabel}.sha256 must be a lowercase SHA-256 digest`);
        const actualDigest = await sha256(file.path);
        assert(file.sha256 === actualDigest, `${fileLabel}.sha256 does not match ${file.path}`);
      }
      allManifestPaths.push(file.path);
    }

    for (const versionCheck of policy.versionChecks) {
      assert(componentPaths.includes(versionCheck.path), `${component.id} must own ${versionCheck.path}`);
      const source = await readFile(path.join(REPO_ROOT, versionCheck.path), 'utf8');
      const match = source.match(versionCheck.pattern);
      assert(match, `cannot detect ${versionCheck.description} in ${versionCheck.path}`);
      assert(
        match[1] === component.version,
        `${versionCheck.description} ${match[1]} does not match manifest version ${component.version}`
      );
    }
  }

  assertUnique(allManifestPaths, 'all manifest file paths');
  const sortedManifestPaths = [...allManifestPaths].sort((left, right) => left.localeCompare(right));
  assertSamePaths(trackedPaths, sortedManifestPaths, 'manifest must cover the complete vendor inventory exactly once');
}

async function writeDigests(manifest) {
  await validateManifest(manifest, { allowEmptyDigests: true });
  const digests = [];
  for (const component of manifest.components) {
    for (const file of component.files) digests.push(await sha256(file.path));
  }

  const currentSource = await readFile(MANIFEST_PATH, 'utf8');
  let digestIndex = 0;
  const updatedSource = currentSource.replace(/("sha256"\s*:\s*")[a-f0-9]*(")/g, (match, prefix, suffix) => {
    assert(digestIndex < digests.length, 'vendor manifest contains more SHA-256 fields than registered files');
    const digest = digests[digestIndex];
    digestIndex += 1;
    return `${prefix}${digest}${suffix}`;
  });
  assert(digestIndex === digests.length, 'vendor manifest must contain one SHA-256 field per registered file');

  const updatedManifest = JSON.parse(updatedSource);
  await validateManifest(updatedManifest);

  const temporaryPath = `${MANIFEST_PATH}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryPath, updatedSource, { encoding: 'utf8', mode: 0o644 });
    await rename(temporaryPath, MANIFEST_PATH);
  } finally {
    await rm(temporaryPath, { force: true });
  }
  console.log(
    `Updated SHA-256 digests for ${manifest.components.flatMap((component) => component.files).length} files.`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const writeMode = args.length === 1 && args[0] === '--write-digests';
  if (args.length > 0 && !writeMode) {
    fail('usage: node scripts/test-vendor-manifest.mjs [--write-digests]');
  }

  const manifest = await readManifest();
  if (writeMode) {
    await writeDigests(manifest);
    return;
  }

  await validateManifest(manifest);
  const fileCount = manifest.components.reduce((count, component) => count + component.files.length, 0);
  console.log(`Vendor manifest OK: ${manifest.components.length} components, ${fileCount} files.`);
}

main().catch((error) => {
  console.error(`[vendor-manifest] ${error.message}`);
  process.exitCode = 1;
});
