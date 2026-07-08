const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildReleaseIntent,
  releaseIntentToProductStateSources,
  validateReleaseIntent
} = require('./release-intent.js');
const {
  getReleaseTargets
} = require('./release-targets.js');

function systemRelease(version = '3.4.62') {
  return {
    schemaVersion: 1,
    name: `v${version}`,
    tag: `v${version}`,
    version,
    publishedAt: '2026-05-26T00:00:00Z',
    upgradeFrom: {
      ranges: ['>=3.4.61 <3.4.62'],
      allowUnknownSource: false
    },
    themeContractUpgrade: {
      requiresInstalledThemeContractVersion: 4,
      message: 'Update installed themes to contract v4 first.'
    },
    contentModelUpgrade: {
      requiresUnifiedIndexTabs: true,
      message: 'Publish content model migration first.'
    },
    runtime: {
      manifestPath: 'assets/press-runtime-manifest.json',
      type: 'press-runtime-assets',
      strategy: 'query-param',
      cacheKey: `press-system-v${version}`,
      entryCount: 247,
      edgeCount: 298
    },
    htmlUrl: `https://github.com/EkilyHQ/Press/releases/tag/v${version}`,
    asset: {
      name: `press-system-v${version}.zip`,
      url: `https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v${version}/press-system-v${version}.zip`,
      size: 100,
      digest: 'sha256:abc123'
    },
    intent: {
      type: 'press-release-intent',
      path: `v${version}/release-intent.json`,
      url: `https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v${version}/release-intent.json`,
      latestPath: 'release-intent.json',
      latestUrl: 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/release-intent.json'
    }
  };
}

test('buildReleaseIntent freezes Press release targets and artifact metadata', () => {
  const release = systemRelease();
  const intent = buildReleaseIntent({
    systemRelease: release,
    source: release.intent.url,
    latestSource: release.intent.latestUrl,
    systemReleaseSource: 'dist/system-release.json',
    systemReleaseDigest: 'sha256:system',
    createdAt: '2026-05-26T00:00:00Z'
  });

  assert.equal(intent.schemaVersion, 1);
  assert.equal(intent.type, 'press-release-intent');
  assert.equal(intent.version, '3.4.62');
  assert.equal(intent.tag, 'v3.4.62');
  assert.equal(intent.source, release.intent.url);
  assert.equal(intent.latestSource, release.intent.latestUrl);
  assert.equal(intent.systemRelease.path, 'system-release.json');
  assert.equal(intent.systemRelease.digest, 'sha256:system');
  assert.deepEqual(intent.pressSystem.themeContractUpgrade, release.themeContractUpgrade);
  assert.deepEqual(intent.pressSystem.contentModelUpgrade, release.contentModelUpgrade);
  assert.deepEqual(intent.targets.map((target) => target.key), getReleaseTargets().map((target) => target.key));
  assert.equal(intent.targets[0].expected.version, '3.4.62');
  assert.equal(intent.targets[0].observed.source, 'https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/press-system.json');
  assert.equal(intent.targets[0].reconciler.idempotent, true);
  assert.deepEqual(validateReleaseIntent(intent, { systemRelease: release }), []);
});

test('buildReleaseIntent can point immutable intents at tag-scoped system release manifests', () => {
  const release = systemRelease();
  const intent = buildReleaseIntent({
    systemRelease: release,
    source: release.intent.url,
    systemReleasePath: `${release.tag}/system-release.json`,
    systemReleaseSource: `https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/${release.tag}/system-release.json`,
    systemReleaseDigest: 'sha256:system'
  });

  assert.equal(intent.systemRelease.path, 'v3.4.62/system-release.json');
  assert.equal(intent.systemRelease.source, 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.4.62/system-release.json');
  assert.deepEqual(validateReleaseIntent(intent, { systemRelease: release }), []);
});

test('validateReleaseIntent compares theme upgrade metadata structurally', () => {
  const release = systemRelease();
  const intent = buildReleaseIntent({ systemRelease: release });
  intent.pressSystem.themeContractUpgrade = {
    message: 'Update installed themes to contract v4 first.',
    requiresInstalledThemeContractVersion: 4
  };

  assert.deepEqual(validateReleaseIntent(intent, { systemRelease: release }), []);
});

test('validateReleaseIntent compares content-model upgrade metadata structurally', () => {
  const release = systemRelease();
  const intent = buildReleaseIntent({ systemRelease: release });
  intent.pressSystem.contentModelUpgrade = {
    message: 'Publish content model migration first.',
    requiresUnifiedIndexTabs: true
  };

  assert.deepEqual(validateReleaseIntent(intent, { systemRelease: release }), []);
});

test('releaseIntentToProductStateSources derives downstream observation sources from intent targets', () => {
  const intent = buildReleaseIntent({
    systemRelease: systemRelease(),
    source: 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.4.62/release-intent.json'
  });
  const sources = releaseIntentToProductStateSources(intent);

  assert.deepEqual(sources.downstream.map((source) => source.key), ['yap', 'themeStarter']);
  assert.deepEqual(sources.themeDemos.map((source) => source.key), [
    'arcus',
    'cartograph',
    'glasswing',
    'solstice'
  ]);
  assert.equal(sources.downstream[0].reconciler.kind, 'press-runtime-sync');
  assert.equal(sources.themeDemos[0].reconciler.kind, 'theme-demo-runtime-sync');
});

test('validateReleaseIntent rejects release/system mismatches', () => {
  const release = systemRelease();
  const intent = buildReleaseIntent({ systemRelease: release });
  intent.pressSystem.asset.digest = 'sha256:other';
  intent.targets[0].expected.version = '3.4.61';

  const failures = validateReleaseIntent(intent, { systemRelease: release }).join('\n');
  assert.match(failures, /asset must match system-release\.json/u);
  assert.match(failures, /expected must match release intent version and tag/u);
});
