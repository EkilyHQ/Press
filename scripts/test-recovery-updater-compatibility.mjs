import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = realpathSync(resolve(here, '..'));
const defaultHistoricalTags = ['v3.4.64', ...Array.from({ length: 26 }, (_, index) => `v3.4.${108 + index}`)];
const recoveryVersion = String(process.env.PRESS_UPDATER_COMPAT_TARGET_VERSION || '3.4.134').trim();
const expectedUpgradeRange = String(
  process.env.PRESS_UPDATER_COMPAT_EXPECTED_RANGE || `>=3.4.64 <${recoveryVersion}`
).trim();
const compatibilityLabel = String(process.env.PRESS_UPDATER_COMPAT_LABEL || 'recovery updater compatibility').trim();
const recoveryTag = `v${recoveryVersion}`;
// Every published source in the declared Recovery support interval is tested.
// Code-blob sampling is insufficient because the same updater implementation
// can behave differently when paired with a different installed manifest.
const historicalTags = process.env.PRESS_UPDATER_COMPAT_SOURCE_TAGS
  ? process.env.PRESS_UPDATER_COMPAT_SOURCE_TAGS.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
  : defaultHistoricalTags;
const archiveName = `press-system-${recoveryTag}.zip`;
const archiveUrl = `https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/${recoveryTag}/${archiveName}`;
const manifestUrl = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json';
const maxBuffer = 128 * 1024 * 1024;

assert.match(recoveryVersion, /^\d+\.\d+\.\d+$/u, 'compatibility target must be an exact semantic version');
assert(expectedUpgradeRange, 'compatibility proof must declare the expected upgrade range');
assert(compatibilityLabel, 'compatibility proof must declare a label');
assert(historicalTags.length > 0, 'compatibility proof must declare at least one frozen source tag');
historicalTags.forEach((tag) => {
  assert.match(tag, /^v\d+\.\d+\.\d+$/u, `invalid compatibility source tag: ${tag}`);
});

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: options.encoding,
    env: options.env || process.env,
    input: options.input,
    maxBuffer,
    stdio: options.stdio
  });
}

function isShallowCheckout() {
  return String(run('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' })).trim() === 'true';
}

function hasGitObject(spec) {
  const result = spawnSync('git', ['cat-file', '-e', spec], {
    cwd: repoRoot,
    stdio: 'ignore'
  });
  return result.status === 0;
}

function exactArrayBuffer(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function responseFromBuffer(value, { status = 200 } = {}) {
  const buffer = Buffer.from(value);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => '' },
    async arrayBuffer() {
      return exactArrayBuffer(buffer);
    },
    async json() {
      return JSON.parse(buffer.toString('utf8'));
    },
    async text() {
      return buffer.toString('utf8');
    }
  };
}

function missingResponse(status = 404) {
  return responseFromBuffer('', { status });
}

function extractHistoricalRuntime(tag, destination) {
  const archive = run('git', [
    'archive',
    '--format=tar',
    tag,
    '--',
    'assets/js',
    'assets/i18n',
    'assets/press-system.json'
  ]);
  run('tar', ['-xf', '-', '-C', destination], { input: archive });
  writeFileSync(join(destination, 'package.json'), '{"type":"module"}\n');
}

function buildRecoveryArchive(outputDirectory) {
  const worktreeManifest = JSON.parse(readFileSync(join(repoRoot, 'assets/press-system.json'), 'utf8'));
  const usesRecoveryWorktree = worktreeManifest.version === recoveryVersion;
  let sourceRoot = repoRoot;
  let attachedRecoveryWorktree = false;
  try {
    if (!usesRecoveryWorktree) {
      assert.equal(
        hasGitObject(`${recoveryTag}^{commit}`),
        true,
        `published recovery verification requires ${recoveryTag}`
      );
      sourceRoot = join(outputDirectory, 'recovery-source');
      run('git', ['worktree', 'add', '--detach', sourceRoot, recoveryTag]);
      attachedRecoveryWorktree = true;
    }

    const manifest = JSON.parse(readFileSync(join(sourceRoot, 'assets/press-system.json'), 'utf8'));
    assert.equal(manifest.version, recoveryVersion, `recovery source must target version ${recoveryVersion}`);
    assert.equal(manifest.tag, recoveryTag, `recovery source must target tag ${recoveryTag}`);
    assert.equal(manifest.securityUpdate, false, 'recovery release must remain classified as an ordinary release');
    assert.deepEqual(
      manifest.upgradeFrom && manifest.upgradeFrom.ranges,
      [expectedUpgradeRange],
      'recovery archive must directly admit the full supported source interval'
    );
    assert.equal(manifest.upgradeFrom && manifest.upgradeFrom.allowUnknownSource, false);
    assert.equal(
      Object.prototype.hasOwnProperty.call(manifest, 'themeContractUpgrade'),
      false,
      'recovery archive must not retain a theme cleanup prerequisite'
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(manifest, 'contentModelUpgrade'),
      false,
      'recovery archive must not retain a content cleanup prerequisite'
    );

    run('bash', [join(sourceRoot, 'scripts/package-system-release.sh'), recoveryTag, outputDirectory], {
      cwd: sourceRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PRESS_PACKAGE_SOURCE: usesRecoveryWorktree ? 'worktree' : 'head'
      }
    });

    const archivePath = join(outputDirectory, archiveName);
    assert.equal(existsSync(archivePath), true, `expected recovery archive at ${archivePath}`);
    return {
      archive: readFileSync(archivePath),
      manifest
    };
  } finally {
    if (attachedRecoveryWorktree) {
      run('git', ['worktree', 'remove', '--force', sourceRoot]);
    }
  }
}

function localHistoricalResponse(root, requestUrl) {
  const clean = String(requestUrl || '')
    .split(/[?#]/u, 1)[0]
    .replace(/^\.?\//u, '');
  if (!clean || clean.startsWith('/') || clean.includes('\\')) return null;
  const candidate = resolve(root, clean);
  const rel = relative(root, candidate);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== candidate) return null;
  try {
    if (!statSync(candidate).isFile()) return null;
    return responseFromBuffer(readFileSync(candidate));
  } catch (_) {
    return null;
  }
}

function createReleaseManifest(archive, upgradeFrom) {
  const digest = createHash('sha256').update(archive).digest('hex');
  return {
    schemaVersion: 1,
    name: `Press ${recoveryTag}`,
    tag: recoveryTag,
    version: recoveryVersion,
    publishedAt: '2026-07-10T00:00:00Z',
    notes: 'Recovery updater compatibility fixture.',
    htmlUrl: `https://github.com/EkilyHQ/Press/releases/tag/${recoveryTag}`,
    upgradeFrom,
    asset: {
      name: archiveName,
      url: archiveUrl,
      size: archive.length,
      digest: `sha256:${digest}`
    }
  };
}

function createFetchFixture({ archive, historicalRoot, releaseManifest }) {
  const calls = [];
  const fetchImpl = async (input) => {
    const url = String(input && input.url ? input.url : input);
    calls.push(url);
    if (url === archiveUrl) return responseFromBuffer(archive);
    if (url === manifestUrl || url.endsWith('/release-artifacts/system-release.json')) {
      return responseFromBuffer(JSON.stringify(releaseManifest));
    }
    if (/\/api\/press\/system-release(?:[/?#]|$)/u.test(url)) return missingResponse();
    if (/api\.github\.com\/repos\/EkilyHQ\/Press\/releases\/latest/u.test(url)) {
      return missingResponse(500);
    }
    return localHistoricalResponse(historicalRoot, url) || missingResponse();
  };
  return { calls, fetchImpl };
}

function stagedFileText(file) {
  if (typeof file.content === 'string') return file.content;
  if (file.base64) return Buffer.from(file.base64, 'base64').toString('utf8');
  return '';
}

async function verifyHistoricalUpdater({ archive, releaseManifest, tag, tempRoot }) {
  const historicalRoot = join(tempRoot, tag);
  mkdirSync(historicalRoot, { recursive: true });
  extractHistoricalRuntime(tag, historicalRoot);

  const sourceManifest = JSON.parse(readFileSync(join(historicalRoot, 'assets/press-system.json'), 'utf8'));
  assert.equal(sourceManifest.tag, tag, `${tag} fixture must retain its tagged source manifest`);

  const updaterUrl = pathToFileURL(join(historicalRoot, 'assets/js/system-updates.js'));
  updaterUrl.searchParams.set('recovery-compat', tag);
  const updater = await import(updaterUrl.href);
  assert.equal(typeof updater.createSystemUpdatesController, 'function', `${tag} must expose its updater controller`);
  assert.equal(typeof updater.verifySystemUpdateAsset, 'function', `${tag} must expose its asset verifier`);
  assert.equal(typeof updater.collectSystemUpdateArchiveEntries, 'function', `${tag} must expose its archive reader`);

  const archiveBuffer = exactArrayBuffer(archive);
  const verification = await updater.verifySystemUpdateAsset(archiveBuffer, releaseManifest.asset);
  assert.equal(verification.size, archive.length, `${tag} must verify the real recovery archive size`);
  assert.equal(
    verification.sha256,
    releaseManifest.asset.digest.replace(/^sha256:/u, ''),
    `${tag} must verify the real recovery archive digest`
  );

  const unpacked = updater.collectSystemUpdateArchiveEntries(archiveBuffer);
  const unpackedPaths = new Set(unpacked.map((entry) => entry.path));
  for (const requiredPath of [
    'index.html',
    'index_editor.html',
    'assets/press-system.json',
    'assets/js/system-updates.js'
  ]) {
    assert.equal(unpackedPaths.has(requiredPath), true, `${tag} must unpack ${requiredPath}`);
  }

  const { calls, fetchImpl } = createFetchFixture({ archive, historicalRoot, releaseManifest });
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const controller = updater.createSystemUpdatesController({ fetchImpl });
    await controller.stageLatest();
    const stagedFiles = controller.getCommitFiles();
    assert(stagedFiles.length > 0, `${tag} must put recovery files into Composer staging`);
    assert(
      stagedFiles.every((file) => updater.isSystemUpdatePath(file.path)),
      `${tag} must stage only Press system paths`
    );

    const stagedManifest = stagedFiles.find((file) => file.path === 'assets/press-system.json');
    assert(stagedManifest, `${tag} must stage the recovery Press manifest`);
    const parsedManifest = JSON.parse(stagedFileText(stagedManifest));
    assert.equal(parsedManifest.version, recoveryVersion);
    assert.equal(parsedManifest.tag, recoveryTag);
    assert.equal(
      calls.filter((url) => url === archiveUrl).length,
      1,
      `${tag} must download the canonical recovery archive exactly once`
    );
    assert(
      calls.some((url) => url === manifestUrl || url.endsWith('/release-artifacts/system-release.json')),
      `${tag} must resolve the browser-readable release manifest`
    );
    console.log(`PASS ${tag} -> ${recoveryTag} (${unpacked.length} unpacked, ${stagedFiles.length} staged)`);
  } finally {
    globalThis.fetch = previousFetch;
  }
}

async function main() {
  const missingTags = historicalTags.filter(
    (tag) =>
      !hasGitObject(`${tag}^{commit}`) ||
      !hasGitObject(`${tag}:assets/js/system-updates.js`) ||
      !hasGitObject(`${tag}:assets/press-system.json`)
  );
  if (missingTags.length > 0) {
    if (isShallowCheckout()) {
      console.log(`SKIP ${compatibilityLabel}: shallow checkout is missing ${missingTags.join(', ')}`);
      return;
    }
    throw new Error(`${compatibilityLabel} requires historical tags: ${missingTags.join(', ')}`);
  }

  const tempRoot = mkdtempSync(join(tmpdir(), 'press-recovery-updater-'));
  try {
    const { archive, manifest } = buildRecoveryArchive(tempRoot);
    const releaseManifest = createReleaseManifest(archive, manifest.upgradeFrom);
    for (const tag of historicalTags) {
      await verifyHistoricalUpdater({ archive, releaseManifest, tag, tempRoot });
    }
    console.log(`PASS ${compatibilityLabel} (${historicalTags.length} frozen updaters)`);
  } finally {
    rmSync(tempRoot, { force: true, recursive: true });
  }
}

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (value) => Buffer.from(String(value), 'binary').toString('base64');
}

await main();
