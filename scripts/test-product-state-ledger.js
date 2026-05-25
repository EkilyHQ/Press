const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_SOURCES,
  buildProductState,
  loadJsonSource,
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

  assert.equal(payload.version, '3.4.51');
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
