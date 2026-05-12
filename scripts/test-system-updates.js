import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { zipSync, strToU8 } from '../assets/js/vendor/fflate.browser.js';
import {
  satisfiesSemverRange,
  setPressSystemManifestForTests
} from '../assets/js/press-version.js?v=press-system-v3.4.4';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
}
globalThis.document = {
  title: 'Press',
  baseURI: 'https://example.test/',
  documentElement: { setAttribute() {} },
  querySelectorAll: () => []
};
globalThis.window = {
  location: { href: 'https://example.test/', protocol: 'https:' },
  dispatchEvent() {}
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};

const {
  analyzeArchive,
  collectSystemUpdateArchiveEntries,
  clearSystemUpdateState,
  getDisplayReleaseNotes,
  getSystemUpdateCommitFiles,
  normalizeSystemReleaseManifest,
  selectSystemUpdateAsset,
  stageLatestSystemUpdate,
  verifySystemUpdateAsset
} = await import('../assets/js/system-updates.js?system-updates-test');

function makeZip(files) {
  const entries = {};
  Object.entries(files).forEach(([path, content]) => {
    entries[path] = strToU8(String(content));
  });
  return zipSync(entries).buffer;
}

async function sha256(buffer) {
  const digest = await webcrypto.subtle.digest('SHA-256', buffer);
  return Buffer.from(digest).toString('hex');
}

function jsonResponse(data, options = {}) {
  const {
    ok = true,
    status = ok ? 200 : 500,
    headers = {}
  } = options;
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    ok,
    status,
    headers: {
      get(name) {
        return normalizedHeaders[String(name || '').toLowerCase()] || null;
      }
    },
    json: async () => data,
    arrayBuffer: async () => new ArrayBuffer(0)
  };
}

function arrayBufferResponse(buffer, options = {}) {
  const {
    ok = true,
    status = ok ? 200 : 500
  } = options;
  return {
    ok,
    status,
    headers: { get: () => null },
    json: async () => ({}),
    arrayBuffer: async () => buffer
  };
}

function setDefaultCurrentPressSystemForTests() {
  setPressSystemManifestForTests({
    schemaVersion: 1,
    type: 'press-system',
    version: '3.3.64',
    tag: 'v3.3.64',
    upgradeFrom: {
      ranges: ['>=3.3.0 <3.4.0'],
      allowUnknownSource: true,
      message: ''
    }
  });
}

async function run(name, fn) {
  setDefaultCurrentPressSystemForTests();
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

await run('selects the dedicated Press system release asset', async () => {
  const asset = selectSystemUpdateAsset({
    assets: [
      { name: 'source.zip', browser_download_url: 'https://example.test/source.zip' },
      { name: 'press-system-v3.3.5.zip', browser_download_url: 'https://example.test/system.zip' }
    ]
  });

  assert.equal(asset.name, 'press-system-v3.3.5.zip');
  assert.equal(asset.url, 'https://example.test/system.zip');
  assert.equal(selectSystemUpdateAsset({
    assets: [{ name: 'Press-v3.3.5-source.zip', browser_download_url: 'https://example.test/source.zip' }]
  }), null);
});

await run('matches Press SemVer ranges', async () => {
  assert.equal(satisfiesSemverRange('3.4.0', '>=3.4.0 <4.0.0'), true);
  assert.equal(satisfiesSemverRange('v3.5.1', '3.4.0 || >=3.5.0 <4.0.0'), true);
  assert.equal(satisfiesSemverRange('3.3.64', '>=3.4.0 <4.0.0'), false);
});

await run('verifies release asset size and digest before archive comparison', async () => {
  const buffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html>' });
  const digest = await sha256(buffer);

  await verifySystemUpdateAsset(buffer, {
    name: 'press-system-v3.3.5.zip',
    size: buffer.byteLength,
    digest: `sha256:${digest}`
  }, 'press-system-v3.3.5.zip');

  await assert.rejects(
    () => verifySystemUpdateAsset(buffer, {
      name: 'press-system-v3.3.5.zip',
      size: buffer.byteLength,
      digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    }, 'press-system-v3.3.5.zip'),
    /sha-?256|digest|hash/i
  );
});

await run('normalizes static system release manifests', async () => {
  const release = normalizeSystemReleaseManifest({
    schemaVersion: 1,
    name: 'v3.3.5',
    tag: 'v3.3.5',
    version: '3.3.5',
    publishedAt: '2026-04-29T08:18:39Z',
    notes: 'Release notes',
    upgradeFrom: {
      ranges: ['>=3.3.0 <3.3.5'],
      allowUnknownSource: true,
      message: ''
    },
    htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
    asset: {
      name: 'press-system-v3.3.5.zip',
      url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
      size: 123,
      digest: 'sha256:535de2ddd3c612310760365196c21bb7ab7a5ffacbebb0dcdbd17f59bedc861a'
    }
  });

  assert.equal(release.tag, 'v3.3.5');
  assert.equal(release.version, '3.3.5');
  assert.deepEqual(release.upgradeFrom.ranges, ['>=3.3.0 <3.3.5']);
  assert.equal(release.asset.name, 'press-system-v3.3.5.zip');
  assert.throws(
    () => normalizeSystemReleaseManifest({
      schemaVersion: 1,
      name: 'v3.3.5',
      tag: 'v3.3.5',
      publishedAt: '2026-04-29T08:18:39Z',
      notes: '',
      htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5'
    }),
    /manifest/i
  );
  assert.throws(
    () => normalizeSystemReleaseManifest({
      schemaVersion: 1,
      name: 'v3.3.5',
      tag: 'v3.3.5',
      publishedAt: '2026-04-29T08:18:39Z',
      notes: '',
      htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
      asset: {
        name: 'Press-v3.3.5-source.zip',
        url: 'https://github.com/EkilyHQ/Press/archive/refs/tags/v3.3.5.zip',
        size: 123,
        digest: 'sha256:535de2ddd3c612310760365196c21bb7ab7a5ffacbebb0dcdbd17f59bedc861a'
      }
    }),
    /manifest/i
  );
});

await run('hides stale release notes when no Press system package is attached', async () => {
  const stalePackageName = `${String.fromCharCode(110, 97, 110, 111)}site-system-v3.3.36.zip`;
  assert.equal(getDisplayReleaseNotes({
    name: 'v3.3.36',
    notes: `Use \`${stalePackageName}\`.`,
    asset: null
  }), '');

  assert.equal(getDisplayReleaseNotes({
    name: 'v3.3.37',
    notes: 'Use `press-system-v3.3.37.zip`.',
    asset: { name: 'press-system-v3.3.37.zip' }
  }), 'Use `press-system-v3.3.37.zip`.');
});

await run('uses the static manifest artifact when the GitHub API tag matches', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const buffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>manifest</p>' });
  const digest = await sha256(buffer);
  let apiCalls = 0;
  let manifestCalls = 0;

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      apiCalls += 1;
      return jsonResponse({
        name: 'v3.3.5',
        tag_name: 'v3.3.5',
        assets: [{
          name: 'press-system-v3.3.5.zip',
          browser_download_url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
          size: buffer.byteLength,
          digest: `sha256:${digest}`
        }]
      });
    }
    if (url === 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json') {
      manifestCalls += 1;
      return jsonResponse({
        schemaVersion: 1,
        name: 'v3.3.5',
        tag: 'v3.3.5',
        publishedAt: '2026-04-29T08:18:39Z',
        notes: 'Manifest release notes',
        htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
        asset: {
          name: 'press-system-v3.3.5.zip',
          url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
          size: buffer.byteLength,
          digest: `sha256:${digest}`
        }
      });
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await analyzeArchive(buffer, 'press-system-v3.3.5.zip');

  assert.equal(apiCalls, 1);
  assert.equal(manifestCalls, 1);
  delete globalThis.fetch;
});

await run('uses GitHub API metadata when the static manifest is stale', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const oldBuffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>old</p>' });
  const newBuffer = makeZip({ 'press-system-v3.3.6/index.html': '<!doctype html><p>new</p>' });
  const oldDigest = await sha256(oldBuffer);
  const newDigest = await sha256(newBuffer);
  const oldAssetUrl = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.3.5/press-system-v3.3.5.zip';
  let oldAssetCalls = 0;

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      return jsonResponse({
        name: 'v3.3.6',
        tag_name: 'v3.3.6',
        assets: [{
          name: 'press-system-v3.3.6.zip',
          browser_download_url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.6/press-system-v3.3.6.zip',
          size: newBuffer.byteLength,
          digest: `sha256:${newDigest}`
        }]
      });
    }
    if (url === 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json') {
      return jsonResponse({
        schemaVersion: 1,
        name: 'v3.3.5',
        tag: 'v3.3.5',
        publishedAt: '2026-04-29T08:18:39Z',
        notes: 'Old manifest release notes',
        htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
        asset: {
          name: 'press-system-v3.3.5.zip',
          url: oldAssetUrl,
          size: oldBuffer.byteLength,
          digest: `sha256:${oldDigest}`
        }
      });
    }
    if (url === oldAssetUrl) {
      oldAssetCalls += 1;
      return arrayBufferResponse(oldBuffer);
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await analyzeArchive(newBuffer, 'press-system-v3.3.6.zip');
  assert.deepEqual(getSystemUpdateCommitFiles().map((file) => file.path), ['index.html']);
  assert.equal(oldAssetCalls, 0);
  await assert.rejects(
    () => stageLatestSystemUpdate(),
    /download|下载|ダウンロード/i
  );
  assert.equal(oldAssetCalls, 0);
  delete globalThis.fetch;
});

await run('uses newer fetchable manifest metadata when the GitHub API lags', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const oldBuffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>old</p>' });
  const newBuffer = makeZip({ 'press-system-v3.3.6/index.html': '<!doctype html><p>new</p>' });
  const oldDigest = await sha256(oldBuffer);
  const newDigest = await sha256(newBuffer);
  const newAssetUrl = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.3.6/press-system-v3.3.6.zip';
  let newAssetCalls = 0;

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      return jsonResponse({
        name: 'v3.3.5',
        tag_name: 'v3.3.5',
        assets: [{
          name: 'press-system-v3.3.5.zip',
          browser_download_url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
          size: oldBuffer.byteLength,
          digest: `sha256:${oldDigest}`
        }]
      });
    }
    if (url === 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json') {
      return jsonResponse({
        schemaVersion: 1,
        name: 'v3.3.6',
        tag: 'v3.3.6',
        publishedAt: '2026-04-29T08:18:39Z',
        notes: 'New manifest release notes',
        htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.6',
        asset: {
          name: 'press-system-v3.3.6.zip',
          url: newAssetUrl,
          size: newBuffer.byteLength,
          digest: `sha256:${newDigest}`
        }
      });
    }
    if (url === newAssetUrl) {
      newAssetCalls += 1;
      return arrayBufferResponse(newBuffer);
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await stageLatestSystemUpdate();

  assert.equal(newAssetCalls, 1);
  assert.deepEqual(getSystemUpdateCommitFiles().map((file) => file.path), ['index.html']);
  delete globalThis.fetch;
});

await run('falls back to the GitHub API when the static manifest is unavailable', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const buffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>api</p>' });
  const digest = await sha256(buffer);
  let apiCalls = 0;
  let manifestCalls = 0;

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      apiCalls += 1;
      return jsonResponse({
        name: 'v3.3.5',
        tag_name: 'v3.3.5',
        assets: [{
          name: 'press-system-v3.3.5.zip',
          browser_download_url: 'https://example.test/press-system-v3.3.5.zip',
          size: buffer.byteLength,
          digest: `sha256:${digest}`
        }]
      });
    }
    if (url === 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json') {
      manifestCalls += 1;
      return jsonResponse({ message: 'not found' }, { ok: false, status: 404 });
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await analyzeArchive(buffer, 'press-system-v3.3.5.zip');

  assert.ok(manifestCalls >= 1);
  assert.equal(apiCalls, 1);
  delete globalThis.fetch;
});

await run('uses the static manifest digest when verifying a selected archive', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const buffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>manifest</p>' });

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      return jsonResponse({ message: 'rate limited' }, {
        ok: false,
        status: 429
      });
    }
    if (url === 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json') {
      return jsonResponse({
        schemaVersion: 1,
        name: 'v3.3.5',
        tag: 'v3.3.5',
        publishedAt: '2026-04-29T08:18:39Z',
        notes: 'Manifest release notes',
        htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
        asset: {
          name: 'press-system-v3.3.5.zip',
          url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
          size: buffer.byteLength,
          digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
        }
      });
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await assert.rejects(
    () => analyzeArchive(buffer, 'press-system-v3.3.5.zip'),
    /sha-?256|digest|hash/i
  );
  delete globalThis.fetch;
});

await run('downloads the manifest asset and stages system files', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const buffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>downloaded</p>' });
  const digest = await sha256(buffer);
  const assetUrl = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.3.5/press-system-v3.3.5.zip';
  let apiCalls = 0;
  let assetCalls = 0;

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      apiCalls += 1;
      return jsonResponse({
        name: 'v3.3.5',
        tag_name: 'v3.3.5',
        assets: [{
          name: 'press-system-v3.3.5.zip',
          browser_download_url: 'https://github.com/EkilyHQ/Press/releases/download/v3.3.5/press-system-v3.3.5.zip',
          size: buffer.byteLength,
          digest: `sha256:${digest}`
        }]
      });
    }
    if (url === 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json') {
      return jsonResponse({
        schemaVersion: 1,
        name: 'v3.3.5',
        tag: 'v3.3.5',
        publishedAt: '2026-04-29T08:18:39Z',
        notes: 'Manifest release notes',
        htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
        asset: {
          name: 'press-system-v3.3.5.zip',
          url: assetUrl,
          size: buffer.byteLength,
          digest: `sha256:${digest}`
        }
      });
    }
    if (url === assetUrl) {
      assetCalls += 1;
      return arrayBufferResponse(buffer);
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await stageLatestSystemUpdate();

  const files = getSystemUpdateCommitFiles();
  assert.equal(apiCalls, 1);
  assert.equal(assetCalls, 1);
  assert.deepEqual(files.map((file) => file.path), ['index.html']);
  assert.equal(files[0].kind, 'system');
  delete globalThis.fetch;
});

await run('keeps manual fallback available when automatic download fails', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const assetUrl = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.3.5/press-system-v3.3.5.zip';

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url === 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json') {
      return jsonResponse({
        schemaVersion: 1,
        name: 'v3.3.5',
        tag: 'v3.3.5',
        publishedAt: '2026-04-29T08:18:39Z',
        notes: 'Manifest release notes',
        htmlUrl: 'https://github.com/EkilyHQ/Press/releases/tag/v3.3.5',
        asset: {
          name: 'press-system-v3.3.5.zip',
          url: assetUrl,
          size: 123,
          digest: 'sha256:535de2ddd3c612310760365196c21bb7ab7a5ffacbebb0dcdbd17f59bedc861a'
        }
      });
    }
    if (url === assetUrl) {
      return arrayBufferResponse(new ArrayBuffer(0), { ok: false, status: 503 });
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await assert.rejects(
    () => stageLatestSystemUpdate(),
    /download|下载|ダウンロード/i
  );
  assert.deepEqual(getSystemUpdateCommitFiles(), []);
  delete globalThis.fetch;
});

await run('normalizes a rooted system update archive to safe site-relative paths', async () => {
  const buffer = makeZip({
    'press-system-v3.3.5/index.html': '<!doctype html>',
    'press-system-v3.3.5/assets/press-system.json': '{"schemaVersion":1,"type":"press-system","version":"3.3.5","tag":"v3.3.5","upgradeFrom":{"ranges":[">=3.3.0 <3.3.5"],"allowUnknownSource":true,"message":""}}',
    'press-system-v3.3.5/assets/js/system-updates.js': 'export {};',
    'press-system-v3.3.5/assets/themes/native/theme.json': '{"name":"Native","contractVersion":1}'
  });

  const entries = collectSystemUpdateArchiveEntries(buffer);

  assert.deepEqual(entries.map((entry) => entry.path).sort(), [
    'assets/js/system-updates.js',
    'assets/press-system.json',
    'assets/themes/native/theme.json',
    'index.html'
  ]);
});

await run('allows bootstrap system updates when current version is unknown', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  setPressSystemManifestForTests(null);
  const buffer = makeZip({
    'press-system-v3.4.0/index.html': '<!doctype html><p>bootstrap</p>',
    'press-system-v3.4.0/assets/press-system.json': JSON.stringify({
      schemaVersion: 1,
      type: 'press-system',
      version: '3.4.0',
      tag: 'v3.4.0',
      upgradeFrom: {
        ranges: ['>=3.3.0 <3.4.0'],
        allowUnknownSource: true,
        message: ''
      }
    })
  });

  globalThis.fetch = async () => ({
    ok: false,
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0)
  });

  await analyzeArchive(buffer, 'press-system-v3.4.0.zip');
  assert.deepEqual(getSystemUpdateCommitFiles().map((file) => file.path).sort(), [
    'assets/press-system.json',
    'index.html'
  ]);
  delete globalThis.fetch;
});

await run('blocks system updates outside the declared source range', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  setPressSystemManifestForTests({
    schemaVersion: 1,
    type: 'press-system',
    version: '3.4.0',
    tag: 'v3.4.0',
    upgradeFrom: { ranges: ['>=3.3.0 <3.4.0'], allowUnknownSource: true, message: '' }
  });
  const buffer = makeZip({
    'press-system-v4.0.0/index.html': '<!doctype html><p>major</p>',
    'press-system-v4.0.0/assets/press-system.json': JSON.stringify({
      schemaVersion: 1,
      type: 'press-system',
      version: '4.0.0',
      tag: 'v4.0.0',
      upgradeFrom: {
        ranges: ['>=3.5.0 <4.0.0'],
        allowUnknownSource: false,
        message: ''
      }
    })
  });

  globalThis.fetch = async () => ({
    ok: false,
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0)
  });

  await assert.rejects(
    () => analyzeArchive(buffer, 'press-system-v4.0.0.zip'),
    /intermediate|source range|不能|直接更新|中間|Press/i
  );
  assert.deepEqual(getSystemUpdateCommitFiles(), []);
  delete globalThis.fetch;
  setPressSystemManifestForTests(null);
});

await run('preserves custom upgradeFrom block messages', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  setPressSystemManifestForTests({
    schemaVersion: 1,
    type: 'press-system',
    version: '3.4.0',
    tag: 'v3.4.0',
    upgradeFrom: { ranges: ['>=3.3.0 <3.4.0'], allowUnknownSource: true, message: '' }
  });
  const buffer = makeZip({
    'press-system-v4.0.0/index.html': '<!doctype html><p>major</p>',
    'press-system-v4.0.0/assets/press-system.json': JSON.stringify({
      schemaVersion: 1,
      type: 'press-system',
      version: '4.0.0',
      tag: 'v4.0.0',
      upgradeFrom: {
        ranges: ['>=3.5.0 <4.0.0'],
        allowUnknownSource: false,
        message: 'Update to v3.5.x first.'
      }
    })
  });

  globalThis.fetch = async () => ({
    ok: false,
    json: async () => ({}),
    arrayBuffer: async () => new ArrayBuffer(0)
  });

  await assert.rejects(
    () => analyzeArchive(buffer, 'press-system-v4.0.0.zip'),
    /Update to v3\.5\.x first\./
  );
  assert.deepEqual(getSystemUpdateCommitFiles(), []);
  delete globalThis.fetch;
  setPressSystemManifestForTests(null);
});

await run('rejects system packages that would overwrite external theme directories', async () => {
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/assets/themes/arcus/theme.css': 'body{}'
    })),
    /unsafe|system update/i
  );
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/assets/themes/solstice/theme.json': '{}'
    })),
    /unsafe|system update/i
  );
});

await run('rejects system packages that would overwrite installed theme registry state', async () => {
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/assets/themes/packs.json': '[]'
    })),
    /unsafe|system update/i
  );
});

await run('allows only native under assets/themes', async () => {
  const buffer = makeZip({
    'press-system-v3.3.5/assets/themes/native/theme.css': 'body{}'
  });
  const entries = collectSystemUpdateArchiveEntries(buffer);
  assert.deepEqual(entries.map((entry) => entry.path).sort(), [
    'assets/themes/native/theme.css'
  ]);
});

await run('rejects system packages that would overwrite the external official catalog', async () => {
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/assets/themes/catalog.json': '{"themes":[]}'
    })),
    /unsafe|system update/i
  );
});

await run('rejects archives that would overwrite user content or site config', async () => {
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/wwwroot/index.yaml': 'posts: []'
    })),
    /unsafe|system update/i
  );

  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/site.yaml': 'contentRoot: wwwroot'
    })),
    /unsafe|system update/i
  );
});

await run('rejects path traversal entries before comparing files', async () => {
  assert.throws(
    () => collectSystemUpdateArchiveEntries(makeZip({
      'press-system-v3.3.5/../site.yaml': 'contentRoot: wwwroot'
    })),
    /unsafe|system update/i
  );
});

await run('does not poison expected release digest from a selected local archive', async () => {
  clearSystemUpdateState({ clearReleaseCache: true, keepStatus: true });
  const wrongBuffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>wrong</p>' });
  const rightBuffer = makeZip({ 'press-system-v3.3.5/index.html': '<!doctype html><p>right</p>' });
  let releaseCalls = 0;

  globalThis.fetch = async (input) => {
    const url = String(input || '');
    if (url.includes('/repos/EkilyHQ/Press/releases/latest')) {
      releaseCalls += 1;
      return {
        ok: true,
        json: async () => ({
          name: 'v3.3.5',
          tag_name: 'v3.3.5',
          assets: [{
            name: 'press-system-v3.3.5.zip',
            browser_download_url: 'https://example.test/press-system-v3.3.5.zip',
            size: 0,
            digest: ''
          }]
        })
      };
    }
    return {
      ok: false,
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };

  await analyzeArchive(wrongBuffer, 'press-system-v3.3.5.zip');
  await analyzeArchive(rightBuffer, 'press-system-v3.3.5.zip');

  assert.equal(releaseCalls, 1);
  delete globalThis.fetch;
});
