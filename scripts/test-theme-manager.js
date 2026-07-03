import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from '../assets/js/vendor/fflate.browser.js';
import { setPressSystemManifestForTests } from '../assets/js/press-version.js';
import { buildConnectStatusUrl, CONNECT_PRODUCT_STATE_PATH } from '../assets/js/connect-status.js?connect-status-test';
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
const themeManagerDataSource = readFileSync(new URL('../assets/js/theme-manager-data.js', import.meta.url), 'utf8');
const themeManagerStagingSource = readFileSync(new URL('../assets/js/theme-manager-staging.js', import.meta.url), 'utf8');
const themeManagerViewSource = readFileSync(new URL('../assets/js/theme-manager-view.js', import.meta.url), 'utf8');
const themePackageCoreSource = readFileSync(new URL('../assets/js/theme-package-core.js', import.meta.url), 'utf8');
const themeInstallServiceSource = readFileSync(new URL('../assets/js/theme-install-service.js', import.meta.url), 'utf8');

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
  contractVersion = 4,
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

function makeThemeZip({ slug = 'test', name = 'Test', version = '1.0.0', contractVersion = 4, files = {} } = {}) {
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
  assert.equal(typeof controller.dispose, 'function');
  assert.equal(typeof controller.analyzeArchive, 'function');
  assert.equal(typeof controller.handleImportFile, 'function');
  assert.equal(typeof controller.loadOfficialCatalog, 'function');
  assert.equal(typeof controller.getOfficialCatalogStatus, 'function');
  assert.equal(typeof controller.loadProductState, 'function');
  assert.equal(typeof controller.getProductStateStatus, 'function');
  assert.equal(typeof controller.stageCatalogTheme, 'function');
  assert.equal(typeof controller.stageUninstall, 'function');
});

await run('disposes theme manager DOM listeners', async () => {
  const documentRef = makeThemeManagerDocument();
  const controller = createThemeManagerController({ documentRef });
  controller.init();
  assert.equal(typeof documentRef.elements.btnThemeImport.listeners.click, 'function');
  assert.equal(typeof documentRef.elements.themeImportFileInput.listeners.change, 'function');
  assert.equal(controller.dispose(), true);
  assert.equal(documentRef.elements.btnThemeImport.listeners.click, null);
  assert.equal(documentRef.elements.themeImportFileInput.listeners.change, null);
});

await run('keeps theme package and install responsibilities outside the UI controller', async () => {
  assert.match(themeManagerSource, /from '\.\/theme-package-core\.js';/, 'theme manager should consume package rules from the core module');
  assert.match(themeManagerSource, /from '\.\/theme-install-service\.js';/, 'theme manager should consume install staging through the service module');
  assert.match(themeManagerSource, /from '\.\/theme-manager-data\.js';/, 'theme manager should consume registry, catalog, and product-state loading through the data module');
  assert.match(themeManagerSource, /from '\.\/theme-manager-staging\.js';/, 'theme manager should consume theme staging through the staging module');
  assert.match(themePackageCoreSource, /export function collectThemeArchiveEntries/, 'theme package core should own ZIP analysis');
  assert.match(themePackageCoreSource, /export function normalizeThemeReleaseManifest/, 'theme package core should own release manifest normalization');
  assert.match(themeInstallServiceSource, /export function createThemeInstallService/, 'theme install service should expose an explicit service factory');
  assert.match(themeManagerDataSource, /export async function loadThemeManagerRegistry/, 'theme manager data should own registry loading');
  assert.match(themeManagerDataSource, /export async function loadThemeManagerOfficialCatalog/, 'theme manager data should own official catalog loading');
  assert.match(themeManagerDataSource, /export async function loadThemeManagerProductState/, 'theme manager data should own product-state loading');
  assert.match(themeManagerStagingSource, /export async function stageThemeArchiveWithRuntime/, 'theme manager staging should own archive staging orchestration');
  assert.match(themeManagerStagingSource, /export async function stageCatalogThemeWithRuntime/, 'theme manager staging should own catalog staging orchestration');
  assert.match(themeManagerStagingSource, /export async function stageThemeUninstallWithRuntime/, 'theme manager staging should own uninstall staging orchestration');
  assert.match(themeManagerStagingSource, /pendingSiteThemeFallback[\s\S]*setSiteThemePack/, 'theme manager staging should own site theme fallback behavior');
  assert.match(themeInstallServiceSource, /stageThemeArchive/, 'theme install service should own archive staging');
  assert.doesNotMatch(themeManagerSource, /function collectThemeArchiveEntries/, 'theme manager UI controller should not own ZIP analysis');
  assert.doesNotMatch(themeManagerSource, /function buildThemeFileChanges/, 'theme manager UI controller should not own theme file diffing');
  assert.doesNotMatch(themeManagerSource, /function (?:setActiveSiteThemePack|stageThemeArchiveWithRuntime|stageCatalogThemeWithRuntime|stageThemeUninstallWithRuntime|stageSiteThemePack)\(/,
    'theme manager UI controller should not re-own staging and active theme fallback rules');
  assert.doesNotMatch(themeManagerSource, /assets\/themes\/packs\.json|Official theme catalog is unavailable|Product state is unavailable|from '\.\/product-state\.js'/,
    'theme manager UI controller should not re-own registry, catalog, or product-state data loading details');
});

await run('keeps theme manager list rendering in a view boundary', async () => {
  assert.match(themeManagerSource, /from '\.\/theme-manager-view\.js';/, 'theme manager should consume DOM rendering through the view module');
  assert.match(
    themeManagerViewSource,
    /export function createThemeManagerElements\(\)[\s\S]*export function setThemeManagerStatus\(runtime, text, options = \{\}\)[\s\S]*export function setThemeManagerBusy\(runtime, value\)[\s\S]*export function renderThemeManagerPendingFiles\(runtime\)[\s\S]*export function renderThemeManagerInstalledThemes\(runtime, registry, catalog, productState, actions = \{\}\)[\s\S]*export function renderThemeManagerAvailableThemes\(runtime, registry, catalog, productState, actions = \{\}\)[\s\S]*export function setActiveThemeManagerView\(runtime, view\)/,
    'theme manager view should own element slots, status/busy UI, pending files, list rows, and tabs'
  );
  assert.match(
    themeManagerSource,
    /renderThemeManagerInstalledThemes\(runtime, registry, catalog, productState, \{[\s\S]*onUpdateTheme: async \(catalogEntry, entry\) => \{[\s\S]*stageCatalogThemeWithRuntime\(runtime, catalogEntry,[\s\S]*onUninstallTheme: async \(entry\) => \{[\s\S]*stageThemeUninstallWithRuntime\(runtime, entry\.value,[\s\S]*renderThemeManagerAvailableThemes\(runtime, registry, catalog, productState, \{[\s\S]*onInstallTheme: async \(entry, actionMeta = \{\}\) => \{[\s\S]*stageCatalogThemeWithRuntime\(runtime, entry,/,
    'theme manager controller should keep async theme staging behind view action callbacks'
  );
  assert.doesNotMatch(
    themeManagerSource,
    /function (?:clearElement|makeButton|renderPendingFiles|formatThemeProductStateMeta|buildThemeManagerMeta|renderProductStateNotice|renderInstalledThemes|renderAvailableThemes|setActiveThemeManagerView)\(/,
    'theme manager controller should not re-own list rendering or tab DOM helpers'
  );
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
    removeEventListener(type, listener) {
      if (this.listeners[type] === listener) this.listeners[type] = null;
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
    desired: {
      pressSystem: {
        version: '3.4.52',
        tag: 'v3.4.52',
        runtime: { entryCount: 125, edgeCount: 300 },
        asset: { name: 'press-system-v3.4.52.zip', size: 100, digest: 'sha256:test' }
      }
    },
    pressSystem: { status: 'ok', version: '3.4.52', tag: 'v3.4.52' },
    downstream: {},
    themeDemos: {},
    themes: {
      catalog: { status: 'ok', count: 1 },
      entries: []
    },
    connect: { status: 'ok' },
    observed: {
      checkedAt: '2026-05-25T00:00:00.000Z',
      downstream: {},
      themeDemos: {}
    },
    verdict: {
      status: 'ok',
      converged: true,
      counts: { ok: 4, pending: 0, unknown: 0, drift: 0 },
      problemCount: 0,
      blockingProblemCount: 0,
      nonBlockingProblemCount: 0,
      blockingProblems: [],
      nonBlockingProblems: []
    },
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
  const nativeManifest = JSON.parse(readFileSync(new URL('../assets/themes/native/theme.json', import.meta.url), 'utf8'));
  assert.deepEqual(packs.map((entry) => entry.value), ['native']);
  assert.equal(packs[0].version, nativeManifest.version);
  assert.equal(packs[0].contractVersion, nativeManifest.contractVersion);
  assert.equal(packs[0].engines.press, nativeManifest.engines.press);
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
  assert.equal(loaded.desired.pressSystem.tag, 'v3.4.52');
  assert.equal(loaded.observed.checkedAt, '2026-05-25T00:00:00.000Z');
  assert.equal(loaded.verdict.converged, true);
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
  assert.deepEqual(seen, [buildConnectStatusUrl(CONNECT_PRODUCT_STATE_PATH, { windowRef: globalThis.window })]);
});

await run('loads product state through the Connect read-through envelope before raw GitHub state', async () => {
  const connectProductStateUrl = buildConnectStatusUrl(CONNECT_PRODUCT_STATE_PATH, { windowRef: globalThis.window });
  const seen = [];
  globalThis.fetch = async (input) => {
    const url = String(input || '').split('?')[0];
    seen.push(url);
    if (url === connectProductStateUrl) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          productState: makeProductState({ status: 'ok' })
        })
      };
    }
    return { ok: false, json: async () => ({}) };
  };
  const loaded = await loadThemeManagerProductState({ force: true });
  assert.equal(loaded.status, 'ok');
  assert.deepEqual(seen, [connectProductStateUrl]);
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

await run('renders installed legacy themes as contract migration candidates', async () => {
  const documentRef = makeThemeManagerDocument();
  mockFetchRegistry([
    { value: 'native', label: 'Native', builtIn: true, removable: false, contractVersion: 4, files: [] },
    { value: 'arcus', label: 'Arcus', version: '3.4.2', contractVersion: 1, files: ['theme.json'] },
    { value: 'legacy', label: 'Legacy', version: '0.9.0', files: ['theme.json'] },
    { value: 'cartograph', label: 'Cartograph', version: '3.4.3', contractVersion: 2, files: ['theme.json'] }
  ], {
    catalog: {
      schemaVersion: 1,
      themes: [
        { value: 'arcus', label: 'Arcus', repo: 'EkilyHQ/Press-Theme-Arcus', manifestUrl: 'https://example.test/arcus.json' },
        { value: 'cartograph', label: 'Cartograph', repo: 'EkilyHQ/Press-Theme-Cartograph', manifestUrl: 'https://example.test/cartograph.json' }
      ]
    }
  });
  const controller = createThemeManagerController({ documentRef });
  controller.init({
    getCurrentThemePack: () => 'native',
    setSiteThemePack: () => {}
  });
  await waitFor(() => collectElementText(documentRef.elements.themeManagerInstalledList).includes('Arcus'));
  const installedText = collectElementText(documentRef.elements.themeManagerInstalledList);
  assert.match(installedText, /Arcus/);
  assert.match(installedText, /contract v1/i);
  assert.match(installedText, /update before next Press release/i);
  assert.match(installedText, /Legacy/);
  assert.match(installedText, /contract unknown/i);
  assert.match(installedText, /Cartograph/);
  assert.match(installedText, /contract v2/i);
});

await run('normalizes release manifests and rejects unsupported contracts', async () => {
  const manifest = normalizeThemeReleaseManifest({
    schemaVersion: 1,
    type: 'press-theme',
    value: 'arcus',
    label: 'Arcus',
    version: '1.2.3',
    contractVersion: 4,
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
  assert.equal(manifest.contractVersion, 4);
  assert.equal(normalizeThemeReleaseManifest({ ...manifest, contractVersion: 3 }).contractVersion, 3);
  assert.throws(() => normalizeThemeReleaseManifest({ ...manifest, contractVersion: 2 }), /contractVersion/i);
  assert.throws(() => normalizeThemeReleaseManifest({ ...manifest, contractVersion: 1 }), /contractVersion/i);
  assert.throws(() => normalizeThemeReleaseManifest({ ...manifest, contractVersion: 5 }), /contractVersion/i);
  assert.throws(() => normalizeThemeReleaseManifest({ ...manifest, engines: {} }), /engines\.press/i);
});

await run('rejects unsafe and multi-theme ZIP archives', async () => {
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({ 'press-theme-test/../site.yaml': 'contentRoot: wwwroot' })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      '../theme.json': '{"name":"Test","version":"1.0.0","contractVersion":4}',
      '../theme.css': 'body{}'
    })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      './theme.json': '{"name":"Test","version":"1.0.0","contractVersion":4}',
      './theme.css': 'body{}'
    })),
    /unsafe/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-test/theme.json': '{"name":"Test","version":"1.0.0","contractVersion":4}',
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
      'arcus/theme.json': '{"name":"Arcus","contractVersion":4}',
      'solstice/theme.json': '{"name":"Solstice","contractVersion":4}'
    })),
    /theme\.json|single|root/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({ contractVersion: 2 })),
    /contractVersion/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({ contractVersion: 1 })),
    /contractVersion/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({ contractVersion: 5 })),
    /contractVersion/i
  );
});

await run('rejects v4 theme packages with public route literals', async () => {
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/layout.js': 'export default { mount() { return "?tab=posts"; }, views: {}, components: {}, effects: {} };'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/layout.js': 'export default { mount() { return "?lang=en&tab=posts"; }, views: {}, components: {}, effects: {} };'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/views.js': 'export default { render() { return "?lang=en&id=post.md"; } };'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const url = new URL(location.href); url.searchParams.set("id", "post.md"); return { views: {}, components: {}, effects: {} }; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': `export function mount() {
  const url = new URL(
    location.href
  );
  url.searchParams.set("id", "post.md");
  return url.href;
}`
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { let url; url = new URL(location.href); url.searchParams.set("id", "post.md"); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const externalBase = "https://api.example.test"; const url = new URL(location.href, externalBase); url.searchParams.set("id", "post.md"); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URLSearchParams("tab=posts"); return "?" + params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URLSearchParams(); params.set("tab", "posts"); return "?" + params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URLSearchParams({ id: post.location }); return "?" + params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URLSearchParams([["tab", tab]]); return `?${params}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; const url = new URL(location.href); url.searchParams.set(routeKey, "post.md"); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; const url = new URL(location.href); url.searchParams.set((routeKey), "post.md"); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const url = new URL(location.href); url.searchParams.set(("id"), "post.md"); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const url = new URL(location.href); url.searchParams.set((("id")), "post.md"); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; const params = new URLSearchParams([[routeKey, post.location]]); return "?" + params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URLSearchParams("id" + "=" + post.location); return "?" + params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { let params; params = new URLSearchParams({ id: post.location }); return "?" + params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { state.params = new URLSearchParams({ id: post.location }); return "?" + state.params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URLSearchParams(); params.set("tab", "posts"); location.search = params.toString(); }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URLSearchParams(); params.set("id", post.location); location.search += params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URLSearchParams({ id: post.location }); location.search += params.toString(); }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { location.search = "id=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; location.search = `${routeKey}=${post.location}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; location.search += routeKey + "=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; const qs = routeKey + "=" + post.location; location.search = qs; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const loc = location; const routeKey = "id"; const qs = routeKey + "=" + post.location; loc.search = qs; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; window.location["search"] = routeKey + "=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const { location: loc } = window; const routeKey = "id"; const qs = routeKey + "=" + post.location; loc.search = qs; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const loc = location; const routeKey = "id"; loc["search"] = routeKey + "=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const loc = window.location; const params = new URLSearchParams({ id: post.location }); loc.search = params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { let qs; qs = "id=" + post.location; location.search = qs.toString(); }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return "?" + "id=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return "?" + "id" + "=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return "?" + new URLSearchParams({ id: post.location }); }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return "?" + (new URLSearchParams({ id: post.location })); }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return `?${new URLSearchParams({ id: post.location })}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { location.search = new URLSearchParams([["tab", tab]]).toString(); }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': `export function mount() {
  const params = new URLSearchParams({
    id: post.location
  });
  return "?" + params;
}`
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const id = post.location; const params = new URLSearchParams({ id }); return "?" + params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; const params = new URLSearchParams(`${routeKey}=${post.location}`); return `?${params}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; return `?${new URLSearchParams(`${routeKey}=${post.location}`)}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; return `?${new URLSearchParams(`${(routeKey)}=${post.location}`)}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; return "?" + new URLSearchParams((routeKey) + "=" + post.location); }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return "?" + new URLSearchParams(("id") + "=" + post.location); }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const url = new URL(location.href); const params = url.searchParams; params.set("id", post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "tab"; const url = new URL(location.href); let params; params = url.searchParams; params.append(routeKey, "posts"); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const url = new URL(location.href); const params = (url.searchParams); params.set("id", post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const url = new URL(location.href); const { searchParams } = url; searchParams.set("id", post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const url = new URL(location.href); const { searchParams: params } = url; params.set("id", post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const params = new URL(location.href).searchParams; params.set("id", post.location); return "?" + params; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const { searchParams } = new URL(location.href); searchParams.set("id", post.location); return `?${searchParams}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const key = "id";',
        'modules/interactions.js': 'import { key } from "./config.js"; export function mount() { const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export function route(endpoint, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/internal.js': 'export const endpoint = location.href;',
        'modules/interactions.js': 'import { endpoint } from "./internal.js"; export function mount() { const url = new URL(endpoint, window.location.href); url.searchParams.set("id", post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export function route({ endpoint }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export const route = ({ endpoint }, post) => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export default (endpoint, post) => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export const route = ({ endpoint }, post) => endpoint + "?id=" + post.location;'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export default endpoint => endpoint + "?tab=posts";'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export const route = async endpoint => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export function route({ endpoint = location.href }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
        'modules/interactions.js': 'import { endpoint } from "./config.js"; export default { route({ endpoint }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }, views: {}, components: {}, effects: {} };'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const key = "id";',
        'modules/interactions.js': 'import { key } from "./config.js"; function unrelated(key) { return key; } export function mount() { const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const key = "id";',
        'modules/barrel.js': 'export { key } from "./config.js";',
        'modules/interactions.js': 'import { key } from "./barrel.js"; export function mount() { const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const key = "id";',
        'modules/barrel.js': 'import { key } from "./config.js"; export { key };',
        'modules/interactions.js': 'import { key } from "./barrel.js"; export function mount() { const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/config.js': 'export const key = "id";',
        'modules/barrel.js': 'export * from "./config.js";',
        'modules/interactions.js': 'import { key } from "./barrel.js"; export function mount() { const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; return `?${routeKey}=${post.location}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; return `?${(routeKey)}=${post.location}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return `?${("id")}=${post.location}`; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; return "?" + routeKey + "=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { const routeKey = "id"; return "?" + (routeKey) + "=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return "?" + ("id") + "=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.throws(
    () => collectThemeArchiveEntries(makeThemeZip({
      contractVersion: 4,
      files: {
        'modules/interactions.js': 'export function mount() { return "?" + (("id")) + "=" + post.location; }'
      }
    })),
    /router href helpers/i
  );
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/interactions.js': 'export function mount() { const routeKey = "tab"; const url = new URL("https://analytics.example.test/collect"); url.searchParams.set(routeKey, "posts"); url.searchParams.set("utm_source", "press-theme"); return { views: {}, components: {}, effects: {} }; }'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { return "https://example.test/product?id=sku-123"; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const params = new URLSearchParams({ id: "sku-123" }); return "https://example.test/product?" + params; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const params = new URLSearchParams("id=sku-123"); return "https://api.example.test/product?" + params; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const params = new URLSearchParams({ grid: "dense" }); return "https://api.example.test/layout?" + params; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; return externalBase + "?" + "id=" + sku; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; return externalBase + "?id=" + sku; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { return "https://api.example.test/product" + "?tab=posts"; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; return externalBase + "?" + "id" + "=" + sku; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; const routeKey = "id"; return externalBase + "?" + routeKey + "=" + sku; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; const routeKey = "id"; return `${externalBase}?${routeKey}=${sku}`; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { return "https://api.example.test/product?" + new URLSearchParams({ id: "sku-123" }); }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { return `https://api.example.test/product?${new URLSearchParams({ id: "sku-123" })}`; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; const params = new URLSearchParams("id=sku-123"); return externalBase + "?" + params; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; return `${externalBase}?${new URLSearchParams({ id: "sku-123" })}`; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; const url = new URL(externalBase); url.searchParams.set("id", sku); return url.href; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test/product"; const url = new URL(externalBase, window.location.href); url.searchParams.set("id", sku); return url.href; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test"; const url = new URL("/product", externalBase); url.searchParams.set("id", sku); return url.href; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test"; const productPath = "/product"; const url = new URL(productPath, externalBase); url.searchParams.set("id", sku); return url.href; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = new URL("https://api.example.test"); const url = new URL("/product", externalBase); url.searchParams.set("id", sku); return url.href; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/config.js': 'export const endpoint = "https://api.example.test/product"; export const productPath = "/product"; export const externalBase = "https://api.example.test";',
      'modules/layout.js': 'import { endpoint, productPath, externalBase } from "./config.js"; export default { mount() { const url = new URL(endpoint); url.searchParams.set("id", sku); const url2 = new URL(productPath, externalBase); url2.searchParams.set("id", sku); return { url: url.href, url2: url2.href }; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
      'modules/barrel.js': 'export { endpoint } from "./config.js";',
      'modules/layout.js': 'import { endpoint } from "./barrel.js"; export default { mount() { const url = new URL(endpoint); url.searchParams.set("id", sku); return { url: url.href }; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
      'modules/barrel.js': 'import { endpoint } from "./config.js"; export { endpoint };',
      'modules/layout.js': 'import { endpoint } from "./barrel.js"; export default { mount() { const url = new URL(endpoint); url.searchParams.set("id", sku); return { url: url.href }; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
      'modules/barrel.js': 'export * from "./config.js";',
      'modules/layout.js': 'import { endpoint } from "./barrel.js"; export default { mount() { const url = new URL(endpoint); url.searchParams.set("id", sku); return { url: url.href }; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/config.js': 'export const endpoint = "https://api.example.test/product";',
      'modules/layout.js': 'import { endpoint } from "./config.js"; export default { mount() { function helper() { const endpoint = "local"; return endpoint; } const url = new URL(endpoint); url.searchParams.set("id", sku); return { helper: helper(), url: url.href }; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test"; const url = new URL("/product?id=sku-123", externalBase); return url.href; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test"; const url = new URL(externalBase + "/product", window.location.href); url.searchParams.set("id", sku); return url.href; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({
    contractVersion: 4,
    files: {
      'modules/layout.js': 'export default { mount() { const externalBase = "https://api.example.test"; const url = new URL(`${externalBase}/product`, window.location.href); url.searchParams.set("id", sku); return url.href; }, views: {}, components: {}, effects: {} };'
    }
  })));
  assert.doesNotThrow(() => collectThemeArchiveEntries(makeThemeZip({ contractVersion: 3 })));
});

await run('rejects invalid theme manifests before staging', async () => {
  mockFetchRegistry([{ value: 'native', label: 'Native', builtIn: true, removable: false, files: [] }]);
  await assert.rejects(
    () => analyzeThemeArchive(makeZip({
      'press-theme-bad/theme.json': JSON.stringify({
        name: 'Bad',
        version: '1.0.0',
        contractVersion: 3,
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
        contractVersion: 3,
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

await run('rejects theme manifests without top-level views', async () => {
  const manifest = makeThemeManifest();
  delete manifest.views;
  assert.throws(
    () => collectThemeArchiveEntries(makeZip({
      'press-theme-test/theme.json': JSON.stringify(manifest, null, 2),
      'press-theme-test/theme.css': ':root{}',
      'press-theme-test/modules/layout.js': 'export default { views: { post() {}, posts() {}, search() {}, tab() {} } };'
    })),
    /views/i
  );
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
    { value: 'cartograph', label: 'Cartograph', version: '1.0.0', contractVersion: 2, files: ['theme.json', 'theme.css', 'modules/layout.js'] }
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
    { value: 'test', label: 'Test', version: '0.9.0', contractVersion: 2, files: ['theme.json', 'theme.css', 'modules/old.js'] }
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
        contractVersion: 2,
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
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 2, removable: true, files: ['theme.json', 'theme.css'] }
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
        contractVersion: 2,
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
        contractVersion: 3,
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
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 2, removable: true, files: ['theme.json', 'theme.css'] }
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
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 2, removable: true, files: ['theme.json', 'theme.css'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css'])
  });
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  assert(getThemeManagerCommitFiles().some((file) => file.path === 'assets/themes/test/theme.json' && file.deleted));
  await assert.rejects(
    () => analyzeThemeArchive(makeThemeZip({ slug: 'replacement', contractVersion: 5 }), 'press-theme-replacement-v1.0.0.zip'),
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
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 2, removable: true, files: ['theme.json', 'theme.css'] }
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
      arrayBuffer: async () => makeThemeZip({ slug: 'bad', contractVersion: 5 })
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
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 2, removable: true, files: ['theme.json', 'theme.css'] }
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
    { value: 'test', label: 'Test', version: '1.0.0', contractVersion: 2, removable: true, files: ['theme.json', 'theme.css'] }
  ], {
    textFiles: themeTextFiles('test', ['theme.json', 'theme.css'])
  });
  await stageThemeUninstall('test');
  assert.equal(themePack, 'native');
  clearThemeManagerState({ keepStatus: true, keepSiteThemeFallback: true });
  assert.equal(themePack, 'native');
  assert.equal(getThemeManagerCommitFiles().length, 0);
});
