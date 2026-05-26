import assert from 'node:assert/strict';

import {
  buildConnectStatusUrl,
  CONNECT_PRODUCT_STATE_PATH
} from '../assets/js/connect-status.js?theme-manager-data-test';
import {
  getThemeManagerOfficialCatalogStatus,
  getThemeManagerProductStateStatus,
  loadThemeManagerOfficialCatalog,
  loadThemeManagerProductState,
  loadThemeManagerRegistry,
  OFFICIAL_THEME_CATALOG_URL
} from '../assets/js/theme-manager-data.js?theme-manager-data-test';

globalThis.window = {
  location: { href: 'https://example.test/', protocol: 'https:' }
};

function createRuntime(fetchImpl) {
  return {
    state: {
      registryCache: null,
      catalogCache: null,
      catalogLoadError: '',
      productStateCache: null,
      productStateLoadError: ''
    },
    getFetch() {
      return fetchImpl;
    }
  };
}

function makeProductState(overrides = {}) {
  return {
    schemaVersion: 1,
    type: 'ekily-product-state',
    generatedAt: '2026-05-27T00:00:00.000Z',
    status: 'ok',
    desired: {
      pressSystem: {
        version: '3.4.96',
        tag: 'v3.4.96',
        runtime: {},
        asset: {}
      }
    },
    pressSystem: { status: 'ok', version: '3.4.96', tag: 'v3.4.96' },
    downstream: {},
    themeDemos: {},
    themes: { catalog: { status: 'ok', count: 0 }, entries: [] },
    connect: { status: 'ok' },
    observed: { checkedAt: '2026-05-27T00:00:00.000Z' },
    verdict: { status: 'ok', converged: true, counts: {}, problems: [] },
    problems: [],
    ...overrides
  };
}

{
  const seen = [];
  const runtime = createRuntime(async (input) => {
    seen.push(String(input || '').split('?')[0]);
    return {
      ok: true,
      json: async () => [
        { value: 'native', label: 'Native' },
        { value: 'arcus', label: 'Arcus', files: ['theme.json'] }
      ]
    };
  });

  const first = await loadThemeManagerRegistry(runtime);
  assert.deepEqual(first.map((entry) => entry.value), ['native', 'arcus']);
  assert.equal(first[0].builtIn, true);
  assert.deepEqual(seen, ['assets/themes/packs.json']);

  seen.length = 0;
  assert.deepEqual((await loadThemeManagerRegistry(runtime)).map((entry) => entry.value), ['native', 'arcus']);
  assert.deepEqual(seen, []);
}

{
  const runtime = createRuntime(async () => ({ ok: false, json: async () => ({}) }));
  const fallback = await loadThemeManagerRegistry(runtime);
  assert.deepEqual(fallback.map((entry) => entry.value), ['native']);
  assert.equal(fallback[0].builtIn, true);
  await assert.rejects(
    () => loadThemeManagerRegistry(createRuntime(async () => ({ ok: false })), { allowFallback: false }),
    /Theme changes were not staged/
  );
}

{
  const seen = [];
  const runtime = createRuntime(async (input) => {
    const url = String(input || '').split('?')[0];
    seen.push(url);
    return {
      ok: true,
      json: async () => ({
        schemaVersion: 1,
        themes: [
          { value: 'arcus', label: 'Arcus', manifestUrl: 'https://example.test/arcus.json' }
        ]
      })
    };
  });

  const catalog = await loadThemeManagerOfficialCatalog(runtime);
  assert.deepEqual(catalog.map((entry) => entry.value), ['arcus']);
  assert.deepEqual(seen, [OFFICIAL_THEME_CATALOG_URL]);
  assert.deepEqual(getThemeManagerOfficialCatalogStatus(runtime), { error: '' });

  seen.length = 0;
  assert.deepEqual((await loadThemeManagerOfficialCatalog(runtime)).map((entry) => entry.value), ['arcus']);
  assert.deepEqual(seen, []);
}

{
  const runtime = createRuntime(async () => ({ ok: false, json: async () => ({}) }));
  assert.deepEqual(await loadThemeManagerOfficialCatalog(runtime, { force: true }), []);
  assert.match(getThemeManagerOfficialCatalogStatus(runtime).error, /unavailable/i);
}

{
  const connectProductStateUrl = buildConnectStatusUrl(CONNECT_PRODUCT_STATE_PATH, { windowRef: globalThis.window });
  const seen = [];
  const runtime = createRuntime(async (input) => {
    const url = String(input || '').split('?')[0];
    seen.push(url);
    return {
      ok: true,
      json: async () => ({
        ok: true,
        productState: makeProductState({ status: 'pending' })
      })
    };
  });

  const productState = await loadThemeManagerProductState(runtime);
  assert.equal(productState.status, 'pending');
  assert.deepEqual(seen, [connectProductStateUrl]);
  assert.equal(getThemeManagerProductStateStatus(runtime).status, 'pending');

  seen.length = 0;
  assert.equal((await loadThemeManagerProductState(runtime)).status, 'pending');
  assert.deepEqual(seen, []);
}

{
  const runtime = createRuntime(async () => ({ ok: false, json: async () => ({}) }));
  assert.equal(await loadThemeManagerProductState(runtime, { force: true }), null);
  assert.match(getThemeManagerProductStateStatus(runtime).error, /unavailable/i);
}
