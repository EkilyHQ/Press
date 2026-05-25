const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_SOURCES,
  buildProductState,
  satisfiesSemverRange,
  shouldFailCheck
} = require('./product-state-ledger.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeSources() {
  const sources = clone(DEFAULT_SOURCES);
  sources.systemRelease = 'fixture:system';
  sources.downstream = [
    {
      key: 'yap',
      label: 'YAP starter runtime',
      repository: 'EkilyHQ/YAP',
      source: 'fixture:yap',
      type: 'press-system-manifest'
    },
    {
      key: 'themeStarter',
      label: 'Theme starter marker',
      repository: 'EkilyHQ/Press-Theme-Starter',
      source: 'fixture:starter',
      type: 'press-release-marker'
    }
  ];
  sources.themeDemos = [
    {
      key: 'arcus',
      label: 'Arcus demo runtime',
      repository: 'EkilyHQ/Press-Theme-Arcus',
      source: 'fixture:arcus-demo'
    }
  ];
  sources.catalog = {
    repository: 'EkilyHQ/Press-Theme-Catalog',
    source: 'fixture:catalog'
  };
  sources.connect = {
    label: 'Ekily Connect',
    source: 'fixture:connect'
  };
  return sources;
}

function systemRelease(version = '3.4.51') {
  return {
    schemaVersion: 1,
    name: `v${version}`,
    tag: `v${version}`,
    version,
    publishedAt: '2026-05-25T00:00:00Z',
    upgradeFrom: {
      ranges: ['>=3.4.50 <3.4.51'],
      allowUnknownSource: false
    },
    htmlUrl: `https://github.com/EkilyHQ/Press/releases/tag/v${version}`,
    asset: {
      name: `press-system-v${version}.zip`,
      url: `https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v${version}/press-system-v${version}.zip`,
      size: 100,
      digest: 'sha256:abc123'
    }
  };
}

function pressManifest(version = '3.4.51') {
  return {
    schemaVersion: 1,
    type: 'press-system',
    version,
    tag: `v${version}`
  };
}

function themeRelease(slug, version = '3.4.2', pressRange = '>=3.4.0 <4.0.0') {
  return {
    schemaVersion: 1,
    type: 'press-theme',
    value: slug,
    label: slug.charAt(0).toUpperCase() + slug.slice(1),
    version,
    contractVersion: 1,
    engines: {
      press: pressRange
    },
    asset: {
      name: `press-theme-${slug}-v${version}.zip`,
      url: `https://raw.githubusercontent.com/EkilyHQ/Press-Theme-${slug}/release-artifacts/v${version}/press-theme-${slug}-v${version}.zip`,
      size: 25,
      digest: 'sha256:def456'
    },
    files: ['theme.json', 'theme.css']
  };
}

function makeFixtures(overrides = {}) {
  return {
    'fixture:system': systemRelease(),
    'fixture:yap': pressManifest(),
    'fixture:starter': systemRelease(),
    'fixture:arcus-demo': pressManifest(),
    'fixture:catalog': {
      schemaVersion: 1,
      themes: [
        {
          value: 'arcus',
          label: 'Arcus',
          repo: 'EkilyHQ/Press-Theme-Arcus',
          manifestUrl: 'fixture:theme-arcus'
        }
      ]
    },
    'fixture:theme-arcus': themeRelease('arcus'),
    'fixture:connect': {
      ok: true,
      service: 'ekily-connect',
      version: 'test'
    },
    ...overrides
  };
}

function loader(fixtures) {
  return async (source) => {
    if (Object.prototype.hasOwnProperty.call(fixtures, source)) {
      return { ok: true, source, value: fixtures[source] };
    }
    return { ok: false, source, error: `missing fixture ${source}` };
  };
}

test('semver range helper accepts Press engine compatibility ranges', () => {
  assert.equal(satisfiesSemverRange('3.4.51', '>=3.4.0 <4.0.0'), true);
  assert.equal(satisfiesSemverRange('4.0.0', '>=3.4.0 <4.0.0'), false);
});

test('buildProductState reports ok when all declared and observed facts agree', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures()),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'ok');
  assert.equal(state.pressSystem.version, '3.4.51');
  assert.equal(state.downstream.yap.status, 'ok');
  assert.equal(state.themeDemos.arcus.status, 'ok');
  assert.equal(state.themes.catalog.status, 'ok');
  assert.equal(state.themes.entries[0].status, 'ok');
  assert.equal(state.connect.status, 'ok');
  assert.equal(shouldFailCheck(state), false);
});

test('buildProductState marks downstream version lag as pending, not a new source of truth', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:yap': pressManifest('3.4.50')
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'pending');
  assert.equal(state.downstream.yap.status, 'pending');
  assert.equal(state.downstream.yap.expectedVersion, '3.4.51');
  assert.equal(state.downstream.yap.observedVersion, '3.4.50');
  assert.equal(shouldFailCheck(state), true);
  assert.equal(shouldFailCheck(state, { allowPending: true }), false);
});

test('shouldFailCheck keeps pending and unknown allowances independent', async () => {
  const fixtures = makeFixtures({
    'fixture:yap': pressManifest('3.4.50')
  });
  delete fixtures['fixture:starter'];
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(fixtures),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'unknown');
  assert.equal(state.downstream.yap.status, 'pending');
  assert.equal(state.downstream.themeStarter.status, 'unknown');
  assert.equal(shouldFailCheck(state, { allowUnknown: true }), true);
  assert.equal(shouldFailCheck(state, { allowPending: true }), true);
  assert.equal(shouldFailCheck(state, { allowUnknown: true, allowPending: true }), false);
});

test('buildProductState does not mark downstream manifests ok without an expected Press version', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:system': { ...systemRelease(), version: '', tag: '' },
      'fixture:yap': { schemaVersion: 1, type: 'press-system', version: '', tag: '' },
      'fixture:starter': { version: '', tag: '' },
      'fixture:arcus-demo': { schemaVersion: 1, type: 'press-system', version: '', tag: '' }
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.pressSystem.status, 'drift');
  assert.equal(state.downstream.yap.status, 'unknown');
  assert.equal(state.downstream.themeStarter.status, 'unknown');
  assert.equal(state.themeDemos.arcus.status, 'unknown');
});

test('buildProductState marks incompatible theme release manifests as drift', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:theme-arcus': themeRelease('arcus', '3.4.2', '>=3.3.0 <3.4.0')
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themes.entries[0].status, 'drift');
  assert.match(state.themes.entries[0].problems.join('\n'), /engines\.press/);
  assert.equal(shouldFailCheck(state, { allowPending: true, allowUnknown: true }), true);
});
