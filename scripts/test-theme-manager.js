import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from '../assets/js/vendor/fflate.browser.js';
import { setPressSystemManifestForTests } from '../assets/js/press-version.js';
import { PRODUCT_STATE_URL } from '../assets/js/product-state.js?product-state-test';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
}
globalThis.document = {
  title: 'Press',
  baseURI: 'https://example.test/',
  documentElement: { setAttribute() {} },
  querySelectorAll: () => [],
  getElementById: () => null
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
  analyzeThemeArchive,
  clearThemeManagerState,
  collectThemeArchiveEntries,
  createThemeManagerController,
  getOfficialThemeCatalogStatus,
  getThemeManagerProductStateStatus,
  getThemeManagerCommitFiles,
  handleImportFile,
  initThemeManager,
  loadThemeManagerProductState,
  loadOfficialThemeCatalog,
  normalizeThemeCatalog,
  normalizeThemeRegistry,
  normalizeThemeReleaseManifest,
  OFFICIAL_THEME_CATALOG_URL,
  sanitizeThemeSlug,
  stageCatalogTheme,
  stageThemeUninstall,
  verifyThemeAsset
} = await import('../assets/js/theme-manager.js?theme-manager-test');

const themeManagerSource = readFileSync(new URL('../assets/js/theme-manager.js', import.meta.url), 'utf8');

function makeZip(files) {
  const entries = {};
  Object.entries(files).forEach(([path, content]) => {
    entries[path] = content instanceof Uint8Array ? content : strToU8(String(content));
  });
  return zipSync(entries).buffer;
}

async function sha256(buffer) {
  const digest = await webcrypto.subtle.digest('SHA-256', buffer);
  return Buffer.from(digest).toString('hex');
}

function makeThemeManifest({
  name = 'Test',
  version = '1.0.0',
  contractVersion = 1,
  engines = { press: '>=3.4.0 <4.0.0' },
  styles = ['theme.css'],
  modules = ['modules/layout.js'],
  overrides = {}
} = {}) {
  return {
    name,
    version,
    contractVersion,
    engines,
    styles,
    modules,
    views: {
      post: { module: modules[0], handler: 'post' },
      posts: { module: modules[0], handler: 'posts' },
      search: { module: modules[0], handler: 'search' },
      tab: { module: modules[0], handler: 'tab' },
      error: { module: modules[0], handler: 'error' },
      loading: { module: modules[0], handler: 'loading' }
    },
    regions: {
      main: { required: true },
      toc: {},
      search: {},
      nav: {},
      tags: {},
      footer: { required: true }
    },
    components: ['press-search', 'press-toc', 'press-post-card'],
    scrollContainer: false,
    configSchema: { type: 'object', additionalProperties: true },
    content: { shapes: ['rawMarkdown', 'html', 'blocks', 'tocTree', 'headings', 'metadata', 'assets', 'links'] },
    ...overrides
  };
}

function makeThemeZip({ slug = 'test', name = 'Test', version = '1.0.0', contractVersion = 1, files = {} } = {}) {
  const manifest = makeThemeManifest({ name, version, contractVersion });
  return makeZip({
    [`press-theme-${slug}/theme.json`]: JSON.stringify(manifest, null, 2),
    [`press-theme-${slug}/theme.css`]: ':root{color-scheme:light;}',
    [`press-theme-${slug}/modules/layout.js`]: 'export default { mount() {}, views: {}, components: {}, effects: {} };',
    ...Object.fromEntries(Object.entries(files).map(([path, content]) => [`press-theme-${slug}/${path}`, content]))
  });
}

function mockFetchRegistry(registry, options = {}) {
  const textFiles = options.textFiles || {};
  const binaryFiles = options.binaryFiles || {};
  const catalog = options.catalog || { schemaVersion: 1, themes: [] };
  const jsonFiles = options.jsonFiles || {};
  globalThis.fetch = async (input) => {
    const url = String(input || '').split('?')[0];
    if (url === 'assets/themes/packs.json') {
      return { ok: true, json: async () => registry };
    }
    if (url === 'assets/press-system.json') {
      return {
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          type: 'press-system',
          version: '3.4.0',
          tag: 'v3.4.0',
          upgradeFrom: { ranges: ['>=3.3.0 <3.4.0'], allowUnknownSource: true, message: '' }
        })
      };
    }
    if (url === OFFICIAL_THEME_CATALOG_URL) {
      if (options.catalogFailure) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => catalog };
    }
    if (url === PRODUCT_STATE_URL) {
      if (options.productStateFailure) {
        return { ok: false, json: async () => ({}) };
      }
      if (options.productState) {
        return { ok: true, json: async () => options.productState };
      }
    }
    if (Object.prototype.hasOwnProperty.call(jsonFiles, url)) {
      return { ok: true, json: async () => jsonFiles[url] };
    }
    if (Object.prototype.hasOwnProperty.call(textFiles, url)) {
      const value = String(textFiles[url]);
      return {
        ok: true,
        text: async () => value,
        arrayBuffer: async () => Buffer.from(value).buffer
      };
    }
    if (Object.prototype.hasOwnProperty.call(binaryFiles, url)) {
      return {
        ok: true,
        arrayBuffer: async () => binaryFiles[url]
      };
    }
    return {
      ok: false,
      text: async () => '',
      arrayBuffer: async () => new ArrayBuffer(0)
    };
  };
}

await run('exposes theme manager through an explicit controller facade', async () => {
  const controller = createThemeManagerController();
  assert.equal(typeof controller.init, 'function');
  assert.equal(typeof controller.getSummaryEntries, 'function');
  assert.equal(typeof controller.getCommitFiles, 'function');
  assert.equal(typeof controller.clear, 'function');
  assert.equal(typeof controller.analyzeArchive, 'function');
  assert.equal(typeof controller.handleImportFile, 'function');
  assert.equal(typeof controller.loadOfficialCatalog, 'function');
  assert.equal(typeof controller.getOfficialCatalogStatus, 'function');
  assert.equal(typeof controller.loadProductState, 'function');
  assert.equal(typeof controller.getProductStateStatus, 'function');
  assert.equal(typeof controller.stageCatalogTheme, 'function');
  assert.equal(typeof controller.stageUninstall, 'function');
});

await run('scopes theme manager state to controller instances', async () => {
  for (const name of [
    'initialized',
    'busy',
    'registryCache',
    'catalogCache',
    'catalogLoadError',
    'productStateCache',
    'productStateLoadError',
    'currentSummary',
    'currentFiles',
    'currentThemeDigest',
    'currentThemeSize',
    'currentThemeAssetName',
    'pendingSiteThemeFallback'
  ]) {
    assert.doesNotMatch(
      themeManagerSource,
      new RegExp(`^let\\s+${name}\\b`, 'm'),
      `theme manager should not keep ${name} as module-level mutable state`
    );
  }
  assert.doesNotMatch(
    themeManagerSource,
    /^const\s+listeners\s*=\s*new\s+Set\(/m,
    'theme manager should not keep listener state at module scope'
  );
  assert.doesNotMatch(
    themeManagerSource,
    /^const\s+optionsRef\s*=\s*\{/m,
    'theme manager should not keep option callbacks at module scope'
  );
  assert.doesNotMatch(
    themeManagerSource,
    /^const\s+elements\s*=\s*\{/m,
    'theme manager should not keep element refs at module scope'
  );
  assert.match(
    themeManagerSource,
    /function createThemeManagerState\(\)[\s\S]*function createThemeManagerRuntime\(options = \{\}\)[\s\S]*export function createThemeManagerController\(options = \{\}\)/,
    'theme manager should create explicit controller runtime state'
  );

  setPressSystemManifestForTests({
    schemaVersion: 1,
    type: 'press-system',
    version: '3.4.0',
    tag: 'v3.4.0',
    upgradeFrom: { ranges: ['>=3.3.0 <3.4.0'], allowUnknownSource: true, message: '' }
  });
  try {
    const fetchFor = () => async (input) => {
      const url = String(input || '').split('?')[0];
      if (url === 'assets/themes/packs.json') {
        return { ok: true, json: async () => [{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }] };
      }
      return {
        ok: false,
        text: async () => '',
        arrayBuffer: async () => new ArrayBuffer(0)
      };
    };

    const firstController = createThemeManagerController({ fetchImpl: fetchFor('first') });
    const secondController = createThemeManagerController({ fetchImpl: fetchFor('second') });
    await firstController.analyzeArchive(makeThemeZip({ slug: 'alpha', name: 'Alpha' }), 'press-theme-alpha-v1.0.0.zip');
    await secondController.analyzeArchive(makeThemeZip({ slug: 'beta', name: 'Beta' }), 'press-theme-beta-v1.0.0.zip');

    assert(firstController.getCommitFiles().some((file) => file.path === 'assets/themes/alpha/theme.json'));
    assert(!firstController.getCommitFiles().some((file) => file.path === 'assets/themes/beta/theme.json'));
    assert(secondController.getCommitFiles().some((file) => file.path === 'assets/themes/beta/theme.json'));
    assert(!secondController.getCommitFiles().some((file) => file.path === 'assets/themes/alpha/theme.json'));
    assert.deepEqual(getThemeManagerCommitFiles(), []);
  } finally {
    setPressSystemManifestForTests(null);
  }
});

function themeTextFiles(slug, files) {
  const out = {};
  (Array.isArray(files) ? files : []).forEach((file) => {
    const path = `assets/themes/${slug}/${file}`;
    out[path] = file.endsWith('.json') ? '{}' : '';
  });
  return out;
}

function makeElement(tagName = 'div') {
  const element = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    dataset: {},
    style: {},
    attributes: {},
    listeners: {},
    className: '',
    textContent: '',
    hidden: false,
    disabled: false,
    type: '',
    value: '',
    files: [],
    classList: {
      toggle() {}
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    click() {
      if (this.listeners.click) this.listeners.click({ target: this });
    }
  };
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return '';
    },
    set() {
      this.children = [];
      this.textContent = '';
    }
  });
  return element;
}

function makeThemeManagerDocument() {
  const elements = Object.create(null);
  const register = (id, tagName = 'div') => {
    const element = makeElement(tagName);
    element.id = id;
    elements[id] = element;
    return element;
  };
  register('mode-themes');
  register('themeManagerStatus');
  register('themeManagerInstalledList');
  register('themeManagerAvailableList');
  register('themeManagerPendingSection', 'section');
  register('themeManagerFileList', 'ul');
  register('themeImportFileInput', 'input');
  register('btnThemeImport', 'button');
  register('btnThemeImportInline', 'button');
  register('btnThemeRefreshCatalog', 'button');
  register('btnThemeClearStaged', 'button');
  const tabs = ['installed', 'available', 'import'].map((view) => {
    const button = makeElement('button');
    button.dataset.themeManagerView = view;
    return button;
  });
  const panels = ['installed', 'available', 'import'].map((view) => {
    const panel = makeElement('section');
    panel.dataset.themeManagerPanel = view;
    return panel;
  });
  return {
    elements,
    createElement: makeElement,
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-theme-manager-view]') return tabs;
      if (selector === '[data-theme-manager-panel]') return panels;
      return [];
    }
  };
}

function collectElementText(element) {
  if (!element) return '';
  return [
    element.textContent || '',
    ...element.children.map(collectElementText)
  ].filter(Boolean).join(' ');
}

async function waitFor(predicate) {
  for (let i = 0; i < 10; i += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.equal(predicate(), true);
}

function makeProductState(overrides = {}) {
  return {
    schemaVersion: 1,
    type: 'ekily-product-state',
    generatedAt: '2026-05-25T00:00:00.000Z',
    status: 'ok',
    pressSystem: { status: 'ok', version: '3.4.52', tag: 'v3.4.52' },
    downstream: {},
    themeDemos: {},
    themes: {
      catalog: { status: 'ok', count: 1 },
      entries: []
    },
    connect: { status: 'ok' },
    problems: [],
    ...overrides
  };
}

async function run(name, fn) {
  try {
    clearThemeManagerState({ keepStatus: true });
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  } finally {
    delete globalThis.fetch;
  }
}

await run('normalizes registry and catalog metadata', async () => {
  assert.equal(sanitizeThemeSlug('Arcus Theme'), 'arcus-theme');
  const registry = normalizeThemeRegistry([
    { value: 'native', label: 'Native' },
    { value: 'arcus', label: 'Arcus', files: ['theme.json', 'modules/layout.js'] }
  ]);
  assert.equal(registry[0].value, 'native');
  assert.equal(registry[0].builtIn, true);
  assert.equal(registry[0].removable, false);
  assert.equal(registry[1].removable, true);

  const catalog = normalizeThemeCatalog({
    themes: [{ value: 'arcus', label: 'Arcus', repo: 'EkilyHQ/Press-Theme-Arcus', manifestUrl: 'https://example.test/theme-release.json' }]
  });
  assert.equal(catalog[0].value, 'arcus');
  assert.throws(() => normalizeThemeCatalog({ themes: [{ value: '!!!', manifestUrl: 'https://example.test' }] }), /invalid/i);
});

await run('keeps Press repository installed registry native-only', async () => {
  const packs = JSON.parse(readFileSync(new URL('../assets/themes/packs.json', import.meta.url), 'utf8'));
  assert.deepEqual(packs.map((entry) => entry.value), ['native']);
});

await run('loads official theme catalog from the remote catalog URL', async () => {
  const catalog = {
    schemaVersion: 1,
    themes: [
      { value: 'arcus', label: 'Arcus', repo: 'EkilyHQ/Press-Theme-Arcus', manifestUrl: 'https://example.test/arcus.json' },
      { value: 'cartograph', label: 'Cartograph', repo: 'EkilyHQ/Press-Theme-Cartograph', manifestUrl: 'https://example.test/cartograph.json' },
      { value: 'solstice', label: 'Solstice', repo: 'EkilyHQ/Press-Theme-Solstice', manifestUrl: 'https://example.test/solstice.json' }
    ]
  };
  const seen = [];
  mockFetchRegistry([{ value: 'native', label: 'Native' }], { catalog });
  const loaded = await loadOfficialThemeCatalog({ force: true });
  assert.deepEqual(loaded.map((entry) => entry.value), ['arcus', 'cartograph', 'solstice']);
  globalThis.fetch = async (input) => {
    seen.push(String(input || '').split('?')[0]);
    return { ok: true, json: async () => ({ schemaVersion: 1, themes: [{ value: 'refreshed', manifestUrl: 'https://example.test/refreshed.json' }] }) };
  };
  assert.equal((await loadOfficialThemeCatalog())[0].value, 'arcus');
  assert.equal(seen.length, 0);
  assert.equal((await loadOfficialThemeCatalog({ force: true }))[0].value, 'refreshed');
  assert.deepEqual(seen, [OFFICIAL_THEME_CATALOG_URL]);
});

await run('returns an empty catalog and status when remote catalog fails', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native' }], { catalogFailure: true });
  const loaded = await loadOfficialThemeCatalog({ force: true });
  assert.deepEqual(loaded, []);
  assert.match(getOfficialThemeCatalogStatus().error, /unavailable/i);
});

await run('returns an empty catalog and status when remote catalog is malformed', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native' }], {
    catalog: { schemaVersion: 1, themes: [{ value: 'broken' }] }
  });
  const loaded = await loadOfficialThemeCatalog({ force: true });
  assert.deepEqual(loaded, []);
  assert.match(getOfficialThemeCatalogStatus().error, /manifestUrl/i);
});

await run('deduplicates remote catalog slugs', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native' }], {
    catalog: {
      schemaVersion: 1,
      themes: [
        { value: 'arcus', label: 'Arcus', manifestUrl: 'https://example.test/arcus.json' },
        { value: 'arcus', label: 'Duplicate Arcus', manifestUrl: 'https://example.test/duplicate.json' }
      ]
    }
  });
  const loaded = await loadOfficialThemeCatalog({ force: true });
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].label, 'Arcus');
});

await run('loads and caches the product state ledger', async () => {
  const productState = makeProductState({
    themes: {
      catalog: { status: 'ok', count: 1 },
      entries: [{ slug: 'arcus', label: 'Arcus', status: 'ok', version: '1.2.3' }]
    }
  });
  mockFetchRegistry([{ value: 'native', label: 'Native' }], { productState });
  const loaded = await loadThemeManagerProductState({ force: true });
  assert.equal(loaded.status, 'ok');
  assert.equal(loaded.themes.entries[0].slug, 'arcus');
  assert.equal(getThemeManagerProductStateStatus().status, 'ok');
  const seen = [];
  globalThis.fetch = async (input) => {
    seen.push(String(input || '').split('?')[0]);
    return { ok: true, json: async () => makeProductState({ status: 'pending' }) };
  };
  assert.equal((await loadThemeManagerProductState()).status, 'ok');
  assert.equal(seen.length, 0);
  assert.equal((await loadThemeManagerProductState({ force: true })).status, 'pending');
  assert.deepEqual(seen, [PRODUCT_STATE_URL]);
});

await run('keeps theme manager usable when product state is unavailable', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native' }], { productStateFailure: true });
  const loaded = await loadThemeManagerProductState({ force: true });
  assert.equal(loaded, null);
  assert.match(getThemeManagerProductStateStatus().error, /unavailable/i);
});

await run('renders product-state release metadata for official themes', async () => {
  const documentRef = makeThemeManagerDocument();
  const productState = makeProductState({
    themes: {
      catalog: { status: 'ok', count: 1 },
      entries: [{ slug: 'arcus', label: 'Arcus', status: 'ok', version: '1.2.3' }]
    }
  });
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }], {
    catalog: {
      schemaVersion: 1,
      themes: [
        { value: 'arcus', label: 'Arcus', repo: 'EkilyHQ/Press-Theme-Arcus', manifestUrl: 'https://example.test/arcus.json' }
      ]
    },
    productState
  });
  const controller = createThemeManagerController({ documentRef });
  controller.init({
    getCurrentThemePack: () => 'native',
    setSiteThemePack: () => {}
  });
  await waitFor(() => collectElementText(documentRef.elements.themeManagerAvailableList).includes('release ok v1.2.3'));
  const availableText = collectElementText(documentRef.elements.themeManagerAvailableList);
  assert.match(availableText, /Arcus/);
  assert.match(availableText, /release ok v1\.2\.3/);
});

await run('normalizes release manifests and rejects contract mismatch', async () => {
  const manifest = normalizeThemeReleaseManifest({
    schemaVersion: 1,
    type: 'press-theme',
    value: 'arcus',
    label: 'Arcus',
    version: '1.2.3',
    contractVersion: 1,
    engines: { press: '>=3.4.0 <4.0.0' },
    release: { tag: 'v1.2.3' },
    asset: {
      name: 'press-theme-arcus-v1.2.3.zip',
      url: 'https://example.test/press-theme-arcus-v1.2.3.zip',
      size: 10,
      digest: 'sha256:535de2ddd3c612310760365196c21bb7ab7a5ffacbebb0dcdbd17f59bedc861a'
    },
    files: ['theme.json', 'theme.css']
  });
  assert.equal(manifest.value, 'arcus');
  assert.equal(manifest.engines.press, '>=3.4.0 <4.0.0');
  assert.throws(() => normalizeThemeReleaseManifest({ ...manifest, contractVersion: 2 }), /contractVersion/i);
  assert.throws(() => normalizeThemeReleaseManifest({ ...manifest, engines: {} }), /engines\.press/i);
});

await run('rejects unsafe and multi-theme ZIP archives', async () => {
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({ 'press-theme-test/../site.yaml': 'contentRoot: wwwroot' })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      '../theme.json': '{"name":"Test","version":"1.0.0","contractVersion":1}',
      '../theme.css': 'body{}'
    })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      './theme.json': '{"name":"Test","version":"1.0.0","contractVersion":1}',
      './theme.css': 'body{}'
    })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-test/theme.json': '{"name":"Test","version":"1.0.0","contractVersion":1}',
      'press-theme-test/modules//layout.js': 'export {};'
    })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({ 'press-theme-test/theme.css': 'body{}' })),
    /theme\.json/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'arcus/theme.json': '{"name":"Arcus","contractVersion":1}',
      'solstice/theme.json': '{"name":"Solstice","contractVersion":1}'
    })),
    /theme\.json|single|root/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({ contractVersion: 2 })),
    /contractVersion/i
  );
});

await run('rejects invalid theme manifests before staging', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }]);
  await assert.rejects(
    () => analyzeThemeArchive(makeZip({
      'press-theme-bad/theme.json': JSON.stringify({
        name: 'Bad',
        version: '1.0.0',
        contractVersion: 1,
        styles: ['theme.css']
      }, null, 2),
      'press-theme-bad/theme.css': ':root{}'
    }), 'press-theme-bad-v1.0.0.zip'),
    /engines|modules|content|views|regions/i
  );
  assert.equal(getThemeManagerCommitFiles().length, 0);

  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-bad/theme.json': JSON.stringify(makeThemeManifest({
        name: 'Bad',
        modules: ['modules/missing.js']
      }), null, 2),
      'press-theme-bad/theme.css': ':root{}'
    })),
    /modules.*missing/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-bad/theme.json': JSON.stringify(makeThemeManifest({
        name: 'Bad',
        styles: ['missing.css']
      }), null, 2),
      'press-theme-bad/modules/layout.js': 'export default {};'
    })),
    /styles.*missing/i
  );
});

await run('blocks manual theme imports without compatible Press engines', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }]);
  await assert.rejects(
    () => analyzeThemeArchive(makeZip({
      'press-theme-missing/theme.json': JSON.stringify(makeThemeManifest({
        name: 'Missing',
        overrides: { engines: undefined }
      }), null, 2),
      'press-theme-missing/theme.css': ':root{}',
      'press-theme-missing/modules/layout.js': 'export default {};'
    }), 'press-theme-missing-v1.0.0.zip'),
    /engines\.press/i
  );
  assert.equal(getThemeManagerCommitFiles().length, 0);

  await assert.rejects(
    () => analyzeThemeArchive(makeZip({
      'press-theme-future/theme.json': JSON.stringify(makeThemeManifest({
        name: 'Future',
        engines: { press: '>=4.0.0 <5.0.0' }
      }), null, 2),
      'press-theme-future/theme.css': ':root{}',
      'press-theme-future/modules/layout.js': 'export default {};'
    }), 'press-theme-future-v1.0.0.zip'),
    /supports Press|running v3\.4\.0/i
  );
  assert.equal(getThemeManagerCommitFiles().length, 0);
});

await run('blocks official theme releases outside the current Press engine range', async () => {
  const buffer = makeThemeZip({ slug: 'cataloged', name: 'Cataloged', version: '1.0.0', files: {
    'theme.json': JSON.stringify(makeThemeManifest({
      name: 'Cataloged',
      engines: { press: '>=4.0.0 <5.0.0' }
    }), null, 2)
  } });
  const digest = await sha256(buffer);
  const assetUrl = 'https://example.test/press-theme-cataloged-v1.0.0.zip';
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }], {
    jsonFiles: {
      'https://example.test/cataloged-theme-release.json': {
        schemaVersion: 1,
        type: 'press-theme',
        value: 'cataloged',
        label: 'Cataloged',
        version: '1.0.0',
        contractVersion: 1,
        engines: { press: '>=4.0.0 <5.0.0' },
        asset: {
          name: 'press-theme-cataloged-v1.0.0.zip',
          url: assetUrl,
          size: buffer.byteLength,
          digest: `sha256:${digest}`
        },
        files: ['theme.json', 'theme.css', 'modules/layout.js']
      }
    },
    binaryFiles: {
      [assetUrl]: buffer
    }
  });

  await assert.rejects(
    () => stageCatalogTheme({
      value: 'cataloged',
      label: 'Cataloged',
      repo: 'EkilyHQ/Press-Theme-Cataloged',
      manifestUrl: 'https://example.test/cataloged-theme-release.json'
    }),
    /supports Press|running v3\.4\.0/i
  );
  assert.equal(getThemeManagerCommitFiles().length, 0);
});

await run('accepts theme manifests without optional view states', async () => {
  const manifest = makeThemeManifest({
    overrides: {
      views: {
        post: { module: 'modules/layout.js', handler: 'post' },
        posts: { module: 'modules/layout.js', handler: 'posts' },
        search: { module: 'modules/layout.js', handler: 'search' },
        tab: { module: 'modules/layout.js', handler: 'tab' }
      }
    }
  });
  const archive = collectThemeArchiveEntries(makeZip({
    'press-theme-test/theme.json': JSON.stringify(manifest, null, 2),
    'press-theme-test/theme.css': ':root{}',
    'press-theme-test/modules/layout.js': 'export default {};'
  }));
  assert.equal(archive.slug, 'test');
  assert.equal(archive.files.some((file) => file.path === 'theme.json'), true);
});

await run('accepts theme manifests without top-level views', async () => {
  const manifest = makeThemeManifest();
  delete manifest.views;
  const archive = collectThemeArchiveEntries(makeZip({
    'press-theme-test/theme.json': JSON.stringify(manifest, null, 2),
    'press-theme-test/theme.css': ':root{}',
    'press-theme-test/modules/layout.js': 'export default { views: { post() {}, posts() {}, search() {}, tab() {} } };'
  }));
  assert.equal(archive.slug, 'test');
  assert.equal(archive.files.some((file) => file.path === 'theme.json'), true);
});

await run('accepts theme manifests without explicit styles', async () => {
  const manifest = makeThemeManifest();
  delete manifest.styles;
  const archive = collectThemeArchiveEntries(makeZip({
    'press-theme-test/theme.json': JSON.stringify(manifest, null, 2),
    'press-theme-test/theme.css': ':root{}',
    'press-theme-test/modules/layout.js': 'export default {};'
  }));
  assert.equal(archive.slug, 'test');
  assert.equal(archive.files.some((file) => file.path === 'theme.css'), true);
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-bad/theme.json': JSON.stringify(manifest, null, 2),
      'press-theme-bad/modules/layout.js': 'export default {};'
    })),
    /styles.*missing file: theme\.css/i
  );
});

await run('verifies ZIP size and digest before official install', async () => {
  const buffer = makeThemeZip();
  const digest = await sha256(buffer);
  await verifyThemeAsset(buffer, {
    name: 'press-theme-test-v1.0.0.zip',
    size: buffer.byteLength,
    digest: `sha256:${digest}`
  }, 'press-theme-test-v1.0.0.zip');
  await assert.rejects(
    () => verifyThemeAsset(buffer, {
      name: 'press-theme-test-v1.0.0.zip',
      size: buffer.byteLength + 1,
      digest: `sha256:${digest}`
    }, 'press-theme-test-v1.0.0.zip'),
    /size/i
  );
  await assert.rejects(
    () => verifyThemeAsset(buffer, {
      name: 'press-theme-test-v1.0.0.zip',
      size: buffer.byteLength,
      digest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    }, 'press-theme-test-v1.0.0.zip'),
    /digest|hash/i
  );
});

await run('preserves zero-byte files from theme ZIP archives', async () => {
  const archive = collectThemeArchiveEntries(makeZip({
    'press-theme-test/theme.json': JSON.stringify(makeThemeManifest(), null, 2),
    'press-theme-test/theme.css': '',
    'press-theme-test/modules/layout.js': 'export default {};'
  }));
  const file = archive.files.find((entry) => entry.path === 'theme.css');
  assert(file);
  assert.equal(file.size, 0);
  assert.equal(file.content, '');
});

await run('stages a new theme install as additions plus packs.json', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }]);
  await analyzeThemeArchive(makeThemeZip({ files: { 'modules/layout.js': 'export {};' } }), 'press-theme-test-v1.0.0.zip');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/test/theme.json' && file.state === 'added'));
  assert(files.some((file) => file.path === 'assets/themes/test/modules/layout.js' && file.state === 'added'));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && file.content.includes('"value": "test"')));
});

await run('stages a new theme install as the active site theme', async () => {
  let themePack = 'native';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }]);
  await analyzeThemeArchive(makeThemeZip({ slug: 'cartograph', name: 'Cartograph' }), 'press-theme-cartograph-v1.0.0.zip');
  const files = getThemeManagerCommitFiles();
  assert.equal(themePack, 'cartograph');
  assert(files.some((file) => file.path === 'assets/themes/cartograph/theme.json' && file.state === 'added'));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && file.content.includes('"value": "cartograph"')));
});

await run('staged inactive theme update preserves the current site theme', async () => {
  let themePack = 'native';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'cartograph', label: 'Cartograph', version: '1.0.0', contractVersion: 1, files: ['theme.json', 'theme.css', 'modules/layout.js'] }
  ], {
    textFiles: themeTextFiles('cartograph', ['theme.json', 'theme.css', 'modules/layout.js'])
  });
  await analyzeThemeArchive(
    makeThemeZip({ slug: 'cartograph', name: 'Cartograph', version: '1.1.0' }),
    'press-theme-cartograph-v1.1.0.zip',
    { activate: false }
  );
  assert.equal(themePack, 'native');
  assert(getThemeManagerCommitFiles().some((file) => file.path === 'assets/themes/cartograph/theme.json' && file.state === 'modified'));
});

await run('refuses to stage theme writes when registry cannot be loaded', async () => {
  globalThis.fetch = async (input) => {
    const url = String(input || '').split('?')[0];
    if (url === 'assets/themes/packs.json') {
      return { ok: false, json: async () => [] };
    }
    return { ok: false, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  };
  await assert.rejects(
    () => analyzeThemeArchive(makeThemeZip(), 'press-theme-test-v1.0.0.zip'),
    /registry|not staged/i
  );
  assert.equal(getThemeManagerCommitFiles().length, 0);
});

await run('stages removed old files during theme update', async () => {
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '0.9.0', contractVersion: 1, files: ['theme.json', 'theme.css', 'modules/old.js'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css', 'modules/old.js'])
  });
  await analyzeThemeArchive(makeThemeZip(), 'press-theme-test-v1.0.0.zip');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/test/modules/old.js' && file.deleted));
});

await run('infers old registry file inventory during theme update', async () => {
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'legacy', label: 'Legacy' }
  ], {
    textFiles: {
      'assets/themes/legacy/theme.json': JSON.stringify({
        name: 'Legacy',
        version: '0.9.0',
        contractVersion: 1,
        modules: ['modules/old.js']
      }),
      'assets/themes/legacy/modules/old.js': 'export {};'
    }
  });
  await analyzeThemeArchive(makeZip({
    'press-theme-legacy/theme.json': JSON.stringify(makeThemeManifest({
      name: 'Legacy',
      version: '1.0.0',
      styles: ['main.css'],
      modules: ['modules/new.js']
    }), null, 2),
    'press-theme-legacy/main.css': 'body{}',
    'press-theme-legacy/modules/new.js': 'export {};'
  }), 'press-theme-legacy-v1.0.0.zip');
  const files = getThemeManagerCommitFiles();
  assert(!files.some((file) => file.path === 'assets/themes/legacy/theme.css' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/legacy/modules/old.js' && file.deleted));
});

await run('stages uninstall deletions and falls back current default to native', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css'])
  });
  await stageThemeUninstall('test');
  const files = getThemeManagerCommitFiles();
  assert.equal(themePack, 'native');
  assert(files.some((file) => file.path === 'assets/themes/test/theme.json' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && !file.content.includes('"value": "test"')));
});

await run('infers old registry file inventory during uninstall', async () => {
  initThemeManager({
    getCurrentThemePack: () => 'native',
    setSiteThemePack: () => {}
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'legacy', label: 'Legacy' }
  ], {
    textFiles: {
      'assets/themes/legacy/theme.json': JSON.stringify({
        name: 'Legacy',
        version: '0.9.0',
        contractVersion: 1,
        modules: ['modules/layout.js']
      }),
      'assets/themes/legacy/theme.css': 'body{}',
      'assets/themes/legacy/modules/layout.js': 'export {};'
    }
  });
  await stageThemeUninstall('legacy');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/legacy/theme.json' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/legacy/theme.css' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/legacy/modules/layout.js' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && !file.content.includes('"value": "legacy"')));
});

await run('filters explicit registry inventory to existing files during uninstall', async () => {
  initThemeManager({
    getCurrentThemePack: () => 'native',
    setSiteThemePack: () => {}
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    {
      value: 'explicit',
      label: 'Explicit',
      removable: true,
      files: ['theme.json', 'theme.css', 'modules/missing.js', 'modules/present.js']
    }
  ], {
    textFiles: themeTextFiles('explicit', ['theme.json', 'modules/present.js'])
  });
  await stageThemeUninstall('explicit');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/explicit/theme.json' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/explicit/modules/present.js' && file.deleted));
  assert(!files.some((file) => file.path === 'assets/themes/explicit/theme.css' && file.deleted));
  assert(!files.some((file) => file.path === 'assets/themes/explicit/modules/missing.js' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && !file.content.includes('"value": "explicit"')));
});

await run('filters catalog-inferred inventory to existing files during uninstall', async () => {
  initThemeManager({
    getCurrentThemePack: () => 'native',
    setSiteThemePack: () => {}
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'cataloged', label: 'Cataloged' }
  ], {
    catalog: {
      schemaVersion: 1,
      themes: [
        { value: 'cataloged', label: 'Cataloged', manifestUrl: 'https://example.test/cataloged-theme-release.json' }
      ]
    },
    jsonFiles: {
      'https://example.test/cataloged-theme-release.json': {
        schemaVersion: 1,
        type: 'press-theme',
        value: 'cataloged',
        label: 'Cataloged',
        version: '1.0.0',
        contractVersion: 1,
        engines: { press: '>=3.4.0 <4.0.0' },
        asset: {
          name: 'press-theme-cataloged-v1.0.0.zip',
          url: 'https://example.test/press-theme-cataloged-v1.0.0.zip',
          size: 1,
          digest: 'sha256:535de2ddd3c612310760365196c21bb7ab7a5ffacbebb0dcdbd17f59bedc861a'
        },
        files: ['theme.json', 'theme.css', 'modules/missing.js', 'modules/present.js']
      }
    },
    textFiles: {
      'assets/themes/cataloged/theme.json': '',
      'assets/themes/cataloged/modules/present.js': 'export {};'
    }
  });
  await stageThemeUninstall('cataloged');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/cataloged/theme.json' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/cataloged/modules/present.js' && file.deleted));
  assert(!files.some((file) => file.path === 'assets/themes/cataloged/theme.css' && file.deleted));
  assert(!files.some((file) => file.path === 'assets/themes/cataloged/modules/missing.js' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && !file.content.includes('"value": "cataloged"')));
});

await run('clearing uninstall staging restores the previous default theme', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css'])
  });
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  clearThemeManagerState({ keepStatus: true });
  assert.equal(themePack, 'test');
  assert.equal(getThemeManagerCommitFiles().length, 0);
});

await run('failed replacement staging keeps uninstall fallback active', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css'])
  });
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  assert(getThemeManagerCommitFiles().some((file) => file.path === 'assets/themes/test/theme.json' && file.deleted));
  await assert.rejects(
    () => analyzeThemeArchive(makeThemeZip({ slug: 'replacement', contractVersion: 2 }), 'press-theme-replacement-v1.0.0.zip'),
    /contractVersion/i
  );
  assert.equal(themePack, 'native');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/test/theme.json' && file.deleted));
});

await run('failed import keeps existing uninstall staging active', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css'])
  });
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  assert(getThemeManagerCommitFiles().some((file) => file.path === 'assets/themes/test/theme.json' && file.deleted));
  const originalError = console.error;
  console.error = () => {};
  try {
    await handleImportFile({
      name: 'press-theme-bad-v1.0.0.zip',
      arrayBuffer: async () => makeThemeZip({ slug: 'bad', contractVersion: 2 })
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(themePack, 'native');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/test/theme.json' && file.deleted));
  assert(files.some((file) => file.path === 'assets/themes/packs.json' && !file.content.includes('"value": "test"')));
});

await run('successful replacement staging clears uninstall fallback', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css'])
  });
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  await analyzeThemeArchive(makeThemeZip({ slug: 'replacement', name: 'Replacement' }), 'press-theme-replacement-v1.0.0.zip');
  assert.equal(themePack, 'test');
  const files = getThemeManagerCommitFiles();
  assert(files.some((file) => file.path === 'assets/themes/replacement/theme.json' && file.state === 'added'));
  assert(!files.some((file) => file.path === 'assets/themes/test/theme.json' && file.deleted));
});

await run('post-commit theme cleanup keeps the published fallback default', async () => {
  let themePack = 'test';
  initThemeManager({
    getCurrentThemePack: () => themePack,
    setSiteThemePack: (value) => { themePack = value; }
  });
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, files: [] },
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 1, removable: true, files: ['theme.json', 'theme.css'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css'])
  });
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  clearThemeManagerState({ keepStatus: true, keepSiteThemeFallback: true });
  assert.equal(themePack, 'native');
  assert.equal(getThemeManagerCommitFiles().length, 0);
});
