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

function systemRelease(version = '3.4.62', options = {}) {
  const release = {
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
  if (Object.prototype.hasOwnProperty.call(options, 'securityUpdate')) {
    release.securityUpdate = options.securityUpdate;
  }
  return release;
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
  assert.equal(intent.pressSystem.securityUpdate, false);
  assert.deepEqual(intent.pressSystem.themeContractUpgrade, release.themeContractUpgrade);
  assert.deepEqual(intent.pressSystem.contentModelUpgrade, release.contentModelUpgrade);
  assert.deepEqual(intent.targets.map((target) => target.key), getReleaseTargets().map((target) => target.key));
  assert.equal(intent.targets[0].expected.version, '3.4.62');
  assert.equal(intent.targets[0].observed.source, 'https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/press-system.json');
  const arcusTarget = intent.targets.find((target) => target.key === 'arcus');
  assert.equal(arcusTarget.observedChannels.themeManifest.source, 'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Arcus/demo/assets/themes/arcus/theme.json');
  assert.equal(arcusTarget.observedChannels.themePacks.source, 'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Arcus/demo/assets/themes/packs.json');
  assert.equal(arcusTarget.observedChannels.demoLock.source, 'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Arcus/demo/demo-release-lock.json');
  assert.equal(intent.targets[0].reconciler.idempotent, true);
  assert.deepEqual(validateReleaseIntent(intent, { systemRelease: release }), []);
});

test('securityUpdate is explicit from v3.4.134 and propagates into release intent', () => {
  const ordinary = systemRelease('3.4.134', { securityUpdate: false });
  const ordinaryIntent = buildReleaseIntent({ systemRelease: ordinary });
  assert.equal(ordinaryIntent.pressSystem.securityUpdate, false);
  assert.deepEqual(validateReleaseIntent(ordinaryIntent, { systemRelease: ordinary }), []);

  const security = systemRelease('3.4.135', { securityUpdate: true });
  const securityIntent = buildReleaseIntent({ systemRelease: security });
  assert.equal(securityIntent.pressSystem.securityUpdate, true);
  assert.deepEqual(validateReleaseIntent(securityIntent, { systemRelease: security }), []);
});

test('historical missing securityUpdate metadata normalizes to false', () => {
  const release = systemRelease('3.4.133');
  const intent = buildReleaseIntent({ systemRelease: release });

  delete intent.pressSystem.securityUpdate;
  assert.equal(validateReleaseIntent(intent, { systemRelease: release }).some((failure) => (
    failure.includes('securityUpdate')
  )), false);
});

test('v3.4.134 securityUpdate must be explicit and match system-release.json', () => {
  const release = systemRelease('3.4.134', { securityUpdate: false });
  const intent = buildReleaseIntent({ systemRelease: release });

  intent.pressSystem.securityUpdate = true;
  assert.match(
    validateReleaseIntent(intent, { systemRelease: release }).join('\n'),
    /release intent securityUpdate must match system-release\.json/u
  );

  delete intent.pressSystem.securityUpdate;
  delete release.securityUpdate;
  const failures = validateReleaseIntent(intent, { systemRelease: release }).join('\n');
  assert.match(failures, /release intent pressSystem\.securityUpdate must be an explicit boolean/u);
  assert.match(failures, /system-release\.json securityUpdate must be an explicit boolean/u);
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
  assert.equal(sources.themeDemos[0].observedChannels.themeManifest.path, 'assets/themes/arcus/theme.json');
  assert.equal(sources.themeDemos[0].observedChannels.demoLock.type, 'theme-demo-release-lock');
});

test('releaseIntentToProductStateSources restores standard theme demo channels for older intents', () => {
  const intent = buildReleaseIntent({
    systemRelease: systemRelease(),
    source: 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.4.62/release-intent.json'
  });
  intent.targets.forEach((target) => {
    delete target.observedChannels;
  });
  const sources = releaseIntentToProductStateSources(intent);
  const arcus = sources.themeDemos.find((source) => source.key === 'arcus');

  assert.equal(arcus.observedChannels.themeManifest.source, 'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Arcus/demo/assets/themes/arcus/theme.json');
  assert.equal(arcus.observedChannels.themePacks.source, 'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Arcus/demo/assets/themes/packs.json');
  assert.equal(arcus.observedChannels.demoLock.source, 'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Arcus/demo/demo-release-lock.json');
  assert.equal(arcus.observedChannels.demoLock.required, false);
});

test('releaseIntentToProductStateSources restores legacy theme demo channels from the observed source root', () => {
  const intent = buildReleaseIntent({
    systemRelease: systemRelease(),
    rawRoot: 'https://raw.example.test/staging',
    source: 'https://raw.example.test/staging/EkilyHQ/Press/release-artifacts/v3.4.62/release-intent.json'
  });
  intent.targets.forEach((target) => {
    if (target.category === 'themeDemo') delete target.observedChannels;
  });
  const sources = releaseIntentToProductStateSources(intent);
  const arcus = sources.themeDemos.find((source) => source.key === 'arcus');

  assert.equal(arcus.source, 'https://raw.example.test/staging/EkilyHQ/Press-Theme-Arcus/demo/assets/press-system.json');
  assert.equal(arcus.observedChannels.themeManifest.source, 'https://raw.example.test/staging/EkilyHQ/Press-Theme-Arcus/demo/assets/themes/arcus/theme.json');
  assert.equal(arcus.observedChannels.themePacks.source, 'https://raw.example.test/staging/EkilyHQ/Press-Theme-Arcus/demo/assets/themes/packs.json');
  assert.equal(arcus.observedChannels.demoLock.source, 'https://raw.example.test/staging/EkilyHQ/Press-Theme-Arcus/demo/demo-release-lock.json');
  assert.equal(arcus.observedChannels.demoLock.required, false);
});

test('validateReleaseIntent rejects partial theme demo observed channels', () => {
  const release = systemRelease();
  const intent = buildReleaseIntent({ systemRelease: release });
  const arcus = intent.targets.find((target) => target.key === 'arcus');
  arcus.observedChannels = {
    themeManifest: arcus.observedChannels.themeManifest
  };

  const failures = validateReleaseIntent(intent, { systemRelease: release }).join('\n');

  assert.match(failures, /observedChannels must include complete themeManifest, themePacks, and demoLock channels/u);
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
