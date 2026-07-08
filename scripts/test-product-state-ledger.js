const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_SOURCES,
  buildProductState,
  loadJsonSource,
  satisfiesSemverRange,
  shouldFailCheck
} = require('./product-state-ledger.js');
const {
  buildReleaseIntent
} = require('./release-intent.js');

const THEME_FIXTURES = ['arcus', 'cartograph', 'glasswing', 'solstice'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeSources() {
  const sources = clone(DEFAULT_SOURCES);
  sources.systemRelease = 'fixture:system';
  sources.downstream = sources.downstream.map((source) => ({
    ...source,
    source: source.key === 'themeStarter' ? 'fixture:starter' : 'fixture:yap'
  }));
  sources.themeDemos = sources.themeDemos
    .filter((source) => source.key === 'arcus')
    .map((source) => ({
      ...source,
      source: 'fixture:arcus-demo',
      observedChannels: demoChannels('arcus')
    }));
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

function systemRelease(version = '3.4.131') {
  return {
    schemaVersion: 1,
    name: `v${version}`,
    tag: `v${version}`,
    version,
    publishedAt: '2026-05-25T00:00:00Z',
    upgradeFrom: {
      ranges: ['>=3.4.130 <3.4.131'],
      allowUnknownSource: false
    },
    runtime: {
      manifestPath: 'assets/press-runtime-manifest.json',
      type: 'press-runtime-assets',
      strategy: 'query-param',
      cacheKey: `press-system-v${version}`,
      entryCount: 125,
      edgeCount: 300
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
      url: 'fixture:intent',
      latestPath: 'release-intent.json',
      latestUrl: 'fixture:intent'
    }
  };
}

function pressManifest(version = '3.4.131') {
  return {
    schemaVersion: 1,
    type: 'press-system',
    version,
    tag: `v${version}`
  };
}

function themeRelease(slug, version = '3.4.6', pressRange = '>=3.4.130 <4.0.0', contractVersion = 4) {
  return {
    schemaVersion: 1,
    type: 'press-theme',
    value: slug,
    label: slug.charAt(0).toUpperCase() + slug.slice(1),
    version,
    contractVersion,
    engines: {
      press: pressRange
    },
    release: {
      tag: `v${version}`,
      htmlUrl: `https://github.com/EkilyHQ/Press-Theme-${slug}/releases/tag/v${version}`,
      publishedAt: '2026-05-25T00:00:00Z',
      notes: ''
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

function themeManifest(slug, version = '3.4.6', contractVersion = 4) {
  return {
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    version,
    contractVersion,
    engines: {
      press: '>=3.4.130 <4.0.0'
    }
  };
}

function themePacks(slug, release = themeRelease(slug)) {
  return [
    {
      value: 'native',
      version: '3.4.131',
      builtIn: true
    },
    {
      value: slug,
      label: release.label,
      version: release.version,
      contractVersion: release.contractVersion,
      engines: release.engines,
      source: {
        type: 'official',
        repo: `EkilyHQ/Press-Theme-${release.label}`,
        manifestUrl: `fixture:theme-${slug}`
      },
      release: {
        tag: release.release.tag,
        htmlUrl: release.release.htmlUrl,
        publishedAt: release.release.publishedAt,
        assetName: release.asset.name,
        size: release.asset.size,
        digest: release.asset.digest
      }
    }
  ];
}

function themeDemoLock(slug, release = themeRelease(slug), pressVersion = '3.4.131') {
  return {
    schemaVersion: 1,
    type: 'press-theme-demo-release-lock',
    repository: `EkilyHQ/Press-Theme-${release.label}`,
    slug,
    target: {
      category: 'themeDemo',
      ref: 'demo',
      path: 'demo-release-lock.json',
      type: 'theme-demo-release-lock',
      reconciler: 'theme-demo-release-sync',
      observed: {
        pressSystem: {
          path: 'assets/press-system.json',
          type: 'press-system-manifest'
        },
        themeManifest: {
          path: `assets/themes/${slug}/theme.json`,
          type: 'press-theme-manifest'
        },
        themePacks: {
          path: 'assets/themes/packs.json',
          type: 'press-theme-packs'
        }
      }
    },
    pressSystem: {
      version: pressVersion,
      tag: `v${pressVersion}`,
      sourceKind: 'release-intent',
      asset: {
        name: `press-system-v${pressVersion}.zip`,
        url: `https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v${pressVersion}/press-system-v${pressVersion}.zip`,
        size: 100,
        digest: 'sha256:abc123'
      },
      releaseIntent: {
        type: 'press-release-intent',
        source: 'fixture:intent'
      }
    },
    theme: {
      value: slug,
      label: release.label,
      version: release.version,
      contractVersion: release.contractVersion,
      engines: release.engines,
      release: release.release,
      asset: release.asset,
      releaseManifest: {
        source: `fixture:theme-${slug}`
      }
    }
  };
}

function demoChannels(slug) {
  return {
    themeManifest: {
      ref: 'demo',
      path: `assets/themes/${slug}/theme.json`,
      type: 'press-theme-manifest',
      source: `fixture:${slug}-theme-manifest`
    },
    themePacks: {
      ref: 'demo',
      path: 'assets/themes/packs.json',
      type: 'press-theme-packs',
      source: `fixture:${slug}-packs`
    },
    demoLock: {
      ref: 'demo',
      path: 'demo-release-lock.json',
      type: 'theme-demo-release-lock',
      source: `fixture:${slug}-demo-lock`
    }
  };
}

function releaseIntentFixture(release) {
  const intent = buildReleaseIntent({
    systemRelease: release,
    source: 'fixture:intent',
    latestSource: 'fixture:intent',
    systemReleaseSource: 'fixture:system',
    systemReleaseDigest: 'sha256:system'
  });
  intent.targets.forEach((target) => {
    if (target.key === 'yap') target.observed.source = 'fixture:yap';
    else if (target.key === 'themeStarter') target.observed.source = 'fixture:starter';
    else {
      target.observed.source = `fixture:${target.key}-demo`;
      target.observedChannels = demoChannels(target.key);
    }
  });
  return intent;
}

function makeFixtures(overrides = {}) {
  const release = systemRelease();
  return {
    'fixture:system': release,
    'fixture:intent': releaseIntentFixture(release),
    'fixture:yap': pressManifest(),
    'fixture:starter': systemRelease(),
    'fixture:arcus-demo': pressManifest(),
    'fixture:cartograph-demo': pressManifest(),
    'fixture:glasswing-demo': pressManifest(),
    'fixture:solstice-demo': pressManifest(),
    'fixture:catalog': {
      schemaVersion: 1,
      themes: THEME_FIXTURES.map((slug) => ({
        value: slug,
        label: slug.charAt(0).toUpperCase() + slug.slice(1),
        repo: `EkilyHQ/Press-Theme-${slug.charAt(0).toUpperCase() + slug.slice(1)}`,
        manifestUrl: `fixture:theme-${slug}`
      }))
    },
    ...Object.fromEntries(THEME_FIXTURES.flatMap((slug) => {
      const release = themeRelease(slug);
      return [
        [`fixture:theme-${slug}`, release],
        [`fixture:${slug}-theme-manifest`, themeManifest(slug, release.version, release.contractVersion)],
        [`fixture:${slug}-packs`, themePacks(slug, release)],
        [`fixture:${slug}-demo-lock`, themeDemoLock(slug, release)]
      ];
    })),
    'fixture:connect': {
      ok: true,
      service: 'ekily-connect',
      version: 'test',
      publishTelemetry: {
        schemaVersion: 1,
        status: 'ok',
        window: {
          since: 1779700000,
          until: 1779786400,
          seconds: 86400
        },
        totalEvents: 3,
        grantsIssued: 1,
        publishSuccess: 1,
        publishFailure: 1,
        lastEventAt: 1779780000,
        upstreamFailures: [
          {
            errorCode: 'github_forbidden',
            upstreamStatus: 403,
            upstreamCode: 'github_forbidden',
            count: 1,
            lastAt: 1779780000
          }
        ]
      }
    },
    ...overrides
  };
}

function connectWithTelemetry(publishTelemetry) {
  return {
    ok: true,
    service: 'ekily-connect',
    version: 'test',
    publishTelemetry
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

test('loadJsonSource cache-busts HTTP JSON reads without changing the canonical source', async () => {
  const calls = [];
  const payload = await loadJsonSource('https://example.test/state.json?existing=1', {
    cacheBustToken: 'test-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true })
      };
    }
  });

  assert.deepEqual(payload, { ok: true });
  assert.equal(calls.length, 1);
  const calledUrl = new URL(calls[0].url);
  assert.equal(calledUrl.origin, 'https://example.test');
  assert.equal(calledUrl.pathname, '/state.json');
  assert.equal(calledUrl.searchParams.get('existing'), '1');
  assert.equal(calledUrl.searchParams.get('press_state_cache'), 'test-token');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.headers['Cache-Control'], 'no-cache');
  assert.equal(calls[0].init.headers.Pragma, 'no-cache');
});

test('loadJsonSource preserves signed HTTP source URLs while using no-cache headers', async () => {
  const calls = [];
  await loadJsonSource('https://example.test/state.json?x-amz-signature=abc123&existing=1', {
    cacheBustToken: 'ignored-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true })
      };
    }
  });

  assert.equal(calls.length, 1);
  const calledUrl = new URL(calls[0].url);
  assert.equal(calledUrl.searchParams.get('x-amz-signature'), 'abc123');
  assert.equal(calledUrl.searchParams.get('existing'), '1');
  assert.equal(calledUrl.searchParams.has('press_state_cache'), false);
  assert.equal(calls[0].init.headers['Cache-Control'], 'no-cache');
});

test('loadJsonSource preserves Azure SAS source URLs while using no-cache headers', async () => {
  const calls = [];
  await loadJsonSource('https://example.test/state.json?sv=2026-01-01&sig=sas-signature', {
    cacheBustToken: 'ignored-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true })
      };
    }
  });

  assert.equal(calls.length, 1);
  const calledUrl = new URL(calls[0].url);
  assert.equal(calledUrl.searchParams.get('sig'), 'sas-signature');
  assert.equal(calledUrl.searchParams.has('press_state_cache'), false);
  assert.equal(calls[0].init.headers['Cache-Control'], 'no-cache');
});

test('loadJsonSource reads raw GitHub JSON through the Contents API raw media type', async () => {
  const calls = [];
  await loadJsonSource('https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/press-system.json', {
    githubToken: 'test-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => pressManifest()
      };
    }
  });

  assert.equal(calls.length, 1);
  const calledUrl = new URL(calls[0].url);
  assert.equal(calledUrl.origin, 'https://api.github.com');
  assert.equal(calledUrl.pathname, '/repos/EkilyHQ/YAP/contents/assets/press-system.json');
  assert.equal(calledUrl.searchParams.get('ref'), 'main');
  assert.equal(calledUrl.searchParams.has('press_state_cache'), false);
  assert.equal(calls[0].init.headers.Accept, 'application/vnd.github.raw+json');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[0].init.headers['X-GitHub-Api-Version'], '2022-11-28');
});

test('loadJsonSource falls back to raw GitHub URLs when the Contents API is unavailable', async () => {
  const calls = [];
  const payload = await loadJsonSource('https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/press-system.json', {
    cacheBustToken: 'fallback-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return { ok: false, status: 403 };
      }
      return {
        ok: true,
        json: async () => pressManifest()
      };
    }
  });

  assert.equal(payload.version, '3.4.131');
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).origin, 'https://api.github.com');
  const fallbackUrl = new URL(calls[1].url);
  assert.equal(fallbackUrl.origin, 'https://raw.githubusercontent.com');
  assert.equal(fallbackUrl.searchParams.get('press_state_cache'), 'fallback-token');
  assert.equal(calls[1].init.headers.Accept, 'application/json');
});

test('loadJsonSource falls back to raw GitHub URLs when Contents API auth is rejected', async () => {
  const calls = [];
  await loadJsonSource('https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/press-system.json', {
    cacheBustToken: 'auth-fallback-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return { ok: false, status: 401 };
      }
      return {
        ok: true,
        json: async () => pressManifest()
      };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).origin, 'https://api.github.com');
  const fallbackUrl = new URL(calls[1].url);
  assert.equal(fallbackUrl.origin, 'https://raw.githubusercontent.com');
  assert.equal(fallbackUrl.searchParams.get('press_state_cache'), 'auth-fallback-token');
});

test('loadJsonSource falls back to raw GitHub URLs when the Contents API fetch throws', async () => {
  const calls = [];
  await loadJsonSource('https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/press-system.json', {
    cacheBustToken: 'throw-fallback-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        throw new Error('api unavailable');
      }
      return {
        ok: true,
        json: async () => pressManifest()
      };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).origin, 'https://api.github.com');
  const fallbackUrl = new URL(calls[1].url);
  assert.equal(fallbackUrl.origin, 'https://raw.githubusercontent.com');
  assert.equal(fallbackUrl.searchParams.get('press_state_cache'), 'throw-fallback-token');
});

test('loadJsonSource falls back to raw GitHub URLs when the Contents API has a server error', async () => {
  const calls = [];
  await loadJsonSource('https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/press-system.json', {
    cacheBustToken: 'server-fallback-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) {
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        json: async () => pressManifest()
      };
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0].url).origin, 'https://api.github.com');
  const fallbackUrl = new URL(calls[1].url);
  assert.equal(fallbackUrl.origin, 'https://raw.githubusercontent.com');
  assert.equal(fallbackUrl.searchParams.get('press_state_cache'), 'server-fallback-token');
});

test('loadJsonSource does not fall back to stale raw GitHub URLs on Contents API 404', async () => {
  const calls = [];
  await assert.rejects(
    loadJsonSource('https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/missing.json', {
      cacheBustToken: 'not-used',
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return { ok: false, status: 404 };
      }
    }),
    /unable to fetch .*: 404/
  );

  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).origin, 'https://api.github.com');
});

test('loadJsonSource leaves ambiguous raw GitHub refs on the raw URL path', async () => {
  const calls = [];
  await loadJsonSource('https://raw.githubusercontent.com/EkilyHQ/YAP/release/3.4/assets/press-system.json', {
    cacheBustToken: 'raw-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => pressManifest()
      };
    }
  });

  assert.equal(calls.length, 1);
  const calledUrl = new URL(calls[0].url);
  assert.equal(calledUrl.origin, 'https://raw.githubusercontent.com');
  assert.equal(calledUrl.pathname, '/EkilyHQ/YAP/release/3.4/assets/press-system.json');
  assert.equal(calledUrl.searchParams.get('press_state_cache'), 'raw-token');
});

test('loadJsonSource does not throw locally for malformed raw GitHub escapes', async () => {
  const calls = [];
  await loadJsonSource('https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/%ZZ.json', {
    cacheBustToken: 'bad-escape-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => pressManifest()
      };
    }
  });

  assert.equal(calls.length, 1);
  const calledUrl = new URL(calls[0].url);
  assert.equal(calledUrl.origin, 'https://raw.githubusercontent.com');
  assert.equal(calledUrl.pathname, '/EkilyHQ/YAP/main/assets/%ZZ.json');
  assert.equal(calledUrl.searchParams.get('press_state_cache'), 'bad-escape-token');
});

test('buildProductState reports ok when all declared and observed facts agree', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures()),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'ok');
  assert.equal(state.pressSystem.version, '3.4.131');
  assert.equal(state.pressSystem.runtime.type, 'press-runtime-assets');
  assert.equal(state.pressSystem.runtime.edgeCount, 300);
  assert.equal(state.releaseIntent.status, 'ok');
  assert.equal(state.releaseIntent.targetCount, 6);
  assert.equal(state.desired.source, 'press-release-intent');
  assert.equal(state.desired.releaseIntent.source, 'fixture:intent');
  assert.equal(state.desired.pressSystem.tag, 'v3.4.131');
  assert.equal(state.desired.pressSystem.asset.digest, 'sha256:abc123');
  assert.equal(state.desired.downstream.yap.expectedVersion, '3.4.131');
  assert.equal(state.desired.downstream.yap.reconciler.eventType, 'press-system-release');
  assert.equal(state.desired.downstream.yap.reconciler.idempotent, true);
  assert.equal(state.desired.downstream.themeStarter.reconciler.kind, 'theme-starter-marker-sync');
  assert.equal(state.desired.themeDemos.arcus.reconciler.kind, 'theme-demo-runtime-sync');
  assert.equal(state.desired.themes.catalog.expectedCount, 4);
  assert.equal(state.desired.themes.entries[0].expectedPressVersion, '3.4.131');
  assert.equal(state.desired.themes.entries[0].expectedContractVersion, 4);
  assert.equal(state.downstream.yap.status, 'ok');
  assert.equal(state.themeDemos.arcus.status, 'ok');
  assert.equal(state.themeDemos.arcus.pressSystem.status, 'ok');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'ok');
  assert.equal(state.themeDemos.arcus.installedTheme.observedVersion, '3.4.6');
  assert.equal(state.themeDemos.arcus.installedTheme.observedDigest, 'sha256:def456');
  assert.equal(state.themes.catalog.status, 'ok');
  assert.equal(state.themes.entries[0].status, 'ok');
  assert.equal(state.connect.status, 'ok');
  assert.equal(state.desired.connect.requiresPublishTelemetry, true);
  assert.equal(state.connect.publishTelemetry.status, 'ok');
  assert.equal(state.connect.publishTelemetry.grantsIssued, 1);
  assert.equal(state.connect.publishTelemetry.upstreamFailures[0].errorCode, 'github_forbidden');
  assert.equal(state.observed.checkedAt, '2026-05-25T00:00:00Z');
  assert.equal(state.observed.downstream.yap.status, 'ok');
  assert.equal(state.verdict.status, 'ok');
  assert.equal(state.verdict.converged, true);
  assert.equal(state.verdict.problemCount, 0);
  assert.equal(state.verdict.counts.pending, 0);
  assert.equal(shouldFailCheck(state), false);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), false);
});

test('buildProductState preserves release upgrade metadata for release intent validation', async () => {
  const release = systemRelease();
  release.themeContractUpgrade = {
    requiresInstalledThemeContractVersion: 4,
    message: 'Update installed themes to contract v4 first.'
  };
  release.contentModelUpgrade = {
    requiresUnifiedIndexTabs: true,
    message: 'Publish content model migration first.'
  };
  const fixtures = makeFixtures({
    'fixture:system': release,
    'fixture:intent': releaseIntentFixture(release)
  });

  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(fixtures),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'ok');
  assert.equal(state.releaseIntent.status, 'ok');
  assert.deepEqual(state.desired.pressSystem.themeContractUpgrade, release.themeContractUpgrade);
  assert.deepEqual(state.observed.pressSystem.themeContractUpgrade, release.themeContractUpgrade);
  assert.deepEqual(state.desired.pressSystem.contentModelUpgrade, release.contentModelUpgrade);
  assert.deepEqual(state.observed.pressSystem.contentModelUpgrade, release.contentModelUpgrade);
});

test('buildProductState blocks convergence when a demo installed theme is stale', async () => {
  const staleManifest = themeManifest('arcus', '3.4.5');
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:arcus-theme-manifest': staleManifest
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themeDemos.arcus.status, 'drift');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'drift');
  assert.match(state.themeDemos.arcus.installedTheme.problems.join('\n'), /demo theme manifest is 3\.4\.5, expected 3\.4\.6/u);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), true);
});

test('buildProductState blocks convergence when demo packs metadata has stale artifact digest', async () => {
  const release = themeRelease('arcus');
  const packs = themePacks('arcus', release);
  packs[1].release.digest = `sha256:${'b'.repeat(64)}`;
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:arcus-packs': packs
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'drift');
  assert.match(state.themeDemos.arcus.installedTheme.problems.join('\n'), /packs registry digest does not match/u);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), true);
});

test('buildProductState blocks convergence when demo theme engines drift', async () => {
  const release = themeRelease('arcus');
  const manifest = themeManifest('arcus', release.version, release.contractVersion);
  manifest.engines.press = '>=3.4.0 <3.4.100';
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:arcus-theme-manifest': manifest
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'drift');
  assert.match(state.themeDemos.arcus.installedTheme.problems.join('\n'), /manifest engines\.press does not match/u);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), true);
});

test('buildProductState blocks convergence when demo packs source metadata drifts', async () => {
  const release = themeRelease('arcus');
  const packs = themePacks('arcus', release);
  packs[1].source.repo = 'EkilyHQ/Press-Theme-Stale';
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:arcus-packs': packs
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'drift');
  assert.match(state.themeDemos.arcus.installedTheme.problems.join('\n'), /packs registry source repo does not match/u);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), true);
});

test('buildProductState blocks convergence when demo packs release provenance drifts', async () => {
  const release = themeRelease('arcus');
  const packs = themePacks('arcus', release);
  packs[1].release.htmlUrl = 'https://github.com/EkilyHQ/Press-Theme-Arcus/releases/tag/v3.4.5';
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:arcus-packs': packs
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'drift');
  assert.match(state.themeDemos.arcus.installedTheme.problems.join('\n'), /packs registry release htmlUrl does not match/u);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), true);
});

test('buildProductState blocks convergence when demo lock Press artifact drifts', async () => {
  const release = themeRelease('arcus');
  const lock = themeDemoLock('arcus', release);
  lock.pressSystem.asset.digest = `sha256:${'c'.repeat(64)}`;
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:arcus-demo-lock': lock
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'drift');
  assert.match(state.themeDemos.arcus.installedTheme.problems.join('\n'), /release lock Press asset digest does not match/u);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), true);
});

test('buildProductState blocks convergence when demo release lock is missing', async () => {
  const fixtures = makeFixtures();
  delete fixtures['fixture:arcus-demo-lock'];
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(fixtures),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'drift');
  assert.match(state.themeDemos.arcus.installedTheme.problems.join('\n'), /demo release lock is unreachable/u);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), true);
});

test('buildProductState blocks convergence when demo theme manifest is unreachable', async () => {
  const fixtures = makeFixtures();
  delete fixtures['fixture:arcus-theme-manifest'];
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(fixtures),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themeDemos.arcus.installedTheme.status, 'drift');
  assert.match(state.themeDemos.arcus.installedTheme.problems.join('\n'), /demo theme manifest is unreachable/u);
  assert.equal(shouldFailCheck(state, { requireConverged: true }), true);
});

test('buildProductState preserves legacy theme-starter reconciler fallback', async () => {
  const sources = makeSources();
  delete sources.downstream[1].eventType;
  delete sources.downstream[1].reconciler;
  const release = systemRelease();
  delete release.intent;
  const state = await buildProductState({
    sources,
    loadJson: loader(makeFixtures({
      'fixture:system': release
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.desired.source, 'press-system-release');
  assert.equal(state.releaseIntent.required, false);
  assert.equal(state.desired.downstream.themeStarter.reconciler.kind, 'theme-starter-marker-sync');
  assert.equal(state.desired.downstream.themeStarter.reconciler.eventType, 'press-system-release');
});

test('buildProductState marks invalid release intent as drift', async () => {
  const intent = releaseIntentFixture(systemRelease());
  intent.targets[0].expected.version = '3.4.50';

  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:intent': intent
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.releaseIntent.status, 'drift');
  assert.match(state.releaseIntent.problems.join('\n'), /expected must match release intent version and tag/u);
  assert.equal(shouldFailCheck(state, { allowPending: true, allowUnknown: true }), true);
});

test('buildProductState records canonical release intent source even when loaded from a local file', async () => {
  const intent = releaseIntentFixture(systemRelease());
  intent.source = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.4.131/release-intent.json';
  intent.latestSource = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/release-intent.json';
  intent.systemRelease.source = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.4.131/system-release.json';

  const state = await buildProductState({
    sources: makeSources(),
    releaseIntentSource: 'fixture:intent-local',
    loadJson: loader(makeFixtures({
      'fixture:intent-local': intent
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.releaseIntent.source, intent.source);
  assert.equal(state.desired.generatedFrom.source, intent.source);
  assert.equal(state.desired.releaseIntent.source, intent.source);
  assert.equal(state.desired.releaseIntent.latestSource, intent.latestSource);
  assert.equal(state.pressSystem.source, intent.systemRelease.source);
  assert.equal(state.observed.pressSystem.source, intent.systemRelease.source);
});

test('buildProductState marks missing Connect publish telemetry as drift', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:connect': {
        ok: true,
        service: 'ekily-connect',
        version: 'test'
      }
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.connect.status, 'drift');
  assert.equal(state.connect.publishTelemetry.status, 'drift');
  assert.match(state.problems.map((problem) => problem.code).join('\n'), /publish_telemetry_invalid/);
  assert.equal(shouldFailCheck(state), true);
});

test('buildProductState marks Connect publish telemetry migration and unknown states as drift', async () => {
  const baseTelemetry = makeFixtures()['fixture:connect'].publishTelemetry;
  const cases = [
    {
      telemetry: {
        ...clone(baseTelemetry),
        status: 'unknown'
      },
      message: /status must be ok/
    },
    {
      telemetry: {
        schemaVersion: 0,
        status: 'unknown',
        migrationRequired: true,
        window: {
          since: 1779700000,
          until: 1779786400,
          seconds: 86400
        },
        totalEvents: 3,
        lastEventAt: 1779780000,
        reason: 'publish_telemetry_migration_required'
      },
      message: /migration must be applied/
    }
  ];

  for (const scenario of cases) {
    const state = await buildProductState({
      sources: makeSources(),
      loadJson: loader(makeFixtures({
        'fixture:connect': connectWithTelemetry(scenario.telemetry)
      })),
      generatedAt: '2026-05-25T00:00:00Z'
    });

    assert.equal(state.status, 'drift');
    assert.equal(state.connect.status, 'drift');
    assert.match(state.problems.map((problem) => problem.message).join('\n'), scenario.message);
  }
});

test('buildProductState rejects impossible Connect publish telemetry shapes', async () => {
  const baseTelemetry = makeFixtures()['fixture:connect'].publishTelemetry;
  const cases = [
    {
      telemetry: {
        ...clone(baseTelemetry),
        window: {
          since: 1779700000,
          until: 1779786400,
          seconds: 10
        }
      },
      message: /window/
    },
    {
      telemetry: {
        ...clone(baseTelemetry),
        totalEvents: 2,
        grantsIssued: 1,
        publishSuccess: 1,
        publishFailure: 1
      },
      message: /cannot exceed totalEvents/
    },
    {
      telemetry: {
        ...clone(baseTelemetry),
        upstreamFailures: [
          {
            errorCode: 'github_forbidden',
            upstreamStatus: 'not-a-status',
            upstreamCode: 'github_forbidden',
            count: 1,
            lastAt: 1779780000
          }
        ]
      },
      message: /upstream failure entries/
    },
    {
      telemetry: {
        ...clone(baseTelemetry),
        publishFailure: 0
      },
      message: /upstream failure counts/
    }
  ];

  for (const scenario of cases) {
    const state = await buildProductState({
      sources: makeSources(),
      loadJson: loader(makeFixtures({
        'fixture:connect': connectWithTelemetry(scenario.telemetry)
      })),
      generatedAt: '2026-05-25T00:00:00Z'
    });

    assert.equal(state.status, 'drift');
    assert.equal(state.connect.publishTelemetry.status, 'drift');
    assert.match(state.problems.map((problem) => problem.message).join('\n'), scenario.message);
  }
});

test('buildProductState marks a release without runtime asset graph metadata as drift', async () => {
  const release = systemRelease();
  delete release.runtime;
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:system': release
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.pressSystem.status, 'drift');
  assert.match(state.problems.map((problem) => problem.code).join('\n'), /system_release_invalid_runtime_graph/);
  assert.equal(shouldFailCheck(state), true);
});

test('buildProductState marks downstream version lag as pending, not a new source of truth', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:yap': pressManifest('3.4.130')
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'pending');
  assert.equal(state.downstream.yap.status, 'pending');
  assert.equal(state.downstream.yap.expectedVersion, '3.4.131');
  assert.equal(state.downstream.yap.observedVersion, '3.4.130');
  assert.equal(state.desired.downstream.yap.expectedTag, 'v3.4.131');
  assert.equal(state.observed.downstream.yap.observedVersion, '3.4.130');
  assert.equal(state.verdict.status, 'pending');
  assert.equal(state.verdict.converged, false);
  assert.equal(state.verdict.counts.pending, 1);
  assert.equal(state.verdict.nonBlockingProblemCount, 1);
  assert.equal(shouldFailCheck(state), true);
  assert.equal(shouldFailCheck(state, { allowPending: true }), false);
  assert.equal(shouldFailCheck(state, { allowPending: true, requireConverged: true }), true);
});

test('shouldFailCheck keeps pending and unknown allowances independent', async () => {
  const fixtures = makeFixtures({
    'fixture:yap': pressManifest('3.4.130')
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

test('buildProductState rejects transition theme contract v3 after cleanup', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:theme-arcus': themeRelease('arcus', '3.4.2', '>=3.4.0 <4.0.0', 3)
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.themes.entries[0].contractVersion, 3);
  assert.equal(state.status, 'drift');
  assert.equal(state.themes.entries[0].status, 'drift');
  assert.match(state.themes.entries[0].problems.join('\n'), /supported contractVersion/);

  const cleanupRelease = systemRelease('3.4.131');
  const cleanupFixtures = {
    'fixture:system': cleanupRelease,
    'fixture:intent': releaseIntentFixture(cleanupRelease),
    'fixture:yap': pressManifest('3.4.131'),
    'fixture:starter': systemRelease('3.4.131'),
    'fixture:arcus-demo': pressManifest('3.4.131')
  };
  const v4State = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      ...cleanupFixtures,
      'fixture:theme-arcus': themeRelease('arcus', '3.4.2', '>=3.4.130 <4.0.0', 4)
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(v4State.themes.entries[0].contractVersion, 4);
  assert.notEqual(v4State.themes.entries[0].status, 'drift');

  const tooWideV4State = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      ...cleanupFixtures,
      'fixture:theme-arcus': themeRelease('arcus', '3.4.2', '>=3.4.0 <4.0.0', 4)
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(tooWideV4State.themes.entries[0].contractVersion, 4);
  assert.equal(tooWideV4State.themes.entries[0].status, 'drift');
  assert.match(tooWideV4State.themes.entries[0].problems.join('\n'), /before 3\.4\.130/);
});

test('buildProductState rejects transition theme contract v2 after cleanup', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:theme-arcus': themeRelease('arcus', '3.4.2', '>=3.4.0 <4.0.0', 2)
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.themes.entries[0].contractVersion, 2);
  assert.equal(state.status, 'drift');
  assert.equal(state.themes.entries[0].status, 'drift');
  assert.match(state.themes.entries[0].problems.join('\n'), /supported contractVersion/);
});

test('buildProductState rejects legacy theme contract versions', async () => {
  const state = await buildProductState({
    sources: makeSources(),
    loadJson: loader(makeFixtures({
      'fixture:theme-arcus': themeRelease('arcus', '3.4.2', '>=3.4.0 <4.0.0', 1)
    })),
    generatedAt: '2026-05-25T00:00:00Z'
  });

  assert.equal(state.status, 'drift');
  assert.equal(state.themes.entries[0].status, 'drift');
  assert.match(state.themes.entries[0].problems.join('\n'), /supported contractVersion/);
});
