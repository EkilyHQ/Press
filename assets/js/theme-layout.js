import {
  clearPendingThemePack,
  commitThemePack,
  getRequestedThemePack,
  setThemePackStylesheet,
  suppressThemePack
} from './theme.js';
import {
  t,
  withLangParam,
  getCurrentLang,
  switchLanguage,
  ensureLanguageBundle,
  getAvailableLangs,
  getLanguageLabel
} from './i18n.js';
import {
  createThemeRegionController,
  createThemeRegionRegistry,
  ensureThemeRegionRegistry,
  getDefaultThemeRegionController,
  mergeThemeRegions,
} from './theme-regions.js';
import {
  PRESS_THEME_CONTRACT,
  isPressThemeContractVersionSupported,
  getDefaultThemeStyles,
  getRequiredThemeContentShapes
} from './theme-contract-surface.mjs';

function createThemeLayoutState(options = {}) {
  return {
    activePack: null,
    layoutPromise: null,
    layoutMountGeneration: 0,
    latestLayoutOptions: null,
    regionController: options.regionController || getDefaultThemeRegionController()
  };
}

const defaultThemeLayoutState = createThemeLayoutState();

const DEFAULT_PACK = 'native';
const CONTRACT_VERSION = PRESS_THEME_CONTRACT.contractVersion;
const DEFAULT_THEME_STYLES = getDefaultThemeStyles();
const REQUIRED_CONTENT_SHAPES = getRequiredThemeContentShapes();
const NATIVE_MODULE_CACHE_KEY = '';
const NATIVE_STYLE_CACHE_KEY = '';

const EFFECT_VIEW_NAMES = {
  renderPostView: 'post',
  renderIndexView: 'posts',
  renderSearchResults: 'search',
  renderStaticTabView: 'tab',
  renderErrorState: 'error',
  renderPostLoadingState: 'loading',
  renderStaticTabLoadingState: 'loading'
};

const FALLBACK_MANIFEST = {
  modules: [
    'modules/layout.js',
    'modules/nav-tabs.js',
    'modules/interactions.js',
    'modules/mainview.js',
    'modules/search-box.js',
    'modules/site-card.js',
    'modules/tag-filter.js',
    'modules/toc.js',
    'modules/footer.js'
  ]
};

function isThemeDevMode() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('themeDev') === '1' || params.has('themeDev')) return true;
  } catch (_) {}
  try {
    if (window.__press_themeDevMode === true) return true;
  } catch (_) {}
  try {
    return window.localStorage && window.localStorage.getItem('press_theme_dev_mode') === '1';
  } catch (_) {
    return false;
  }
}

function themeDevWarn(...args) {
  if (!isThemeDevMode()) return;
  try { console.warn('[theme-dev]', ...args); } catch (_) {}
}

function asStringList(value) {
  return Array.isArray(value) ? value.map(item => String(item || '').trim()).filter(Boolean) : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function refreshThemeLayoutRuntimeContext(context, options = {}, regionController = null) {
  if (!context || typeof context !== 'object') return context;
  if (options && Object.prototype.hasOwnProperty.call(options, 'features')) {
    context.features = options.features || null;
  }
  if (options && Object.prototype.hasOwnProperty.call(options, 'router')) {
    context.router = options.router || null;
  }
  if (regionController && typeof regionController.setThemeLayoutContext === 'function') {
    regionController.setThemeLayoutContext(context);
  }
  return context;
}

export function createThemeI18nContext() {
  return {
    t,
    withLangParam,
    getCurrentLang,
    switchLanguage,
    ensureLanguageBundle,
    getAvailableLangs,
    getLanguageLabel,
    lang: typeof getCurrentLang === 'function' ? getCurrentLang() : ''
  };
}

function validateManifestContract(pack, manifest) {
  if (!isThemeDevMode()) return;
  const contractVersion = manifest && manifest.contractVersion;
  if (!isPressThemeContractVersionSupported(contractVersion)) {
    themeDevWarn(`Theme "${pack}" declares unsupported contract version`, contractVersion);
  }
  if (!manifest.version) {
    themeDevWarn(`Theme "${pack}" has no top-level version field in theme.json.`);
  }
  ['styles', 'modules', 'components'].forEach((key) => {
    if (manifest[key] != null && !Array.isArray(manifest[key])) {
      themeDevWarn(`Theme "${pack}" ${key} should be an array.`);
    }
  });
  if (!asObject(manifest.views)) {
    themeDevWarn(`Theme "${pack}" should declare top-level views.`);
  }
  if (!asObject(manifest.regions)) {
    themeDevWarn(`Theme "${pack}" should declare top-level regions.`);
  }
  if (!manifest.content) {
    themeDevWarn(`Theme "${pack}" should declare supported content shapes.`);
    return;
  }
  const content = manifest.content;
  if (content && typeof content === 'object') {
    const shapes = asStringList(content.shapes || content.provides || []);
    REQUIRED_CONTENT_SHAPES.forEach((shape) => {
      if (shapes.length && !shapes.includes(shape)) {
        themeDevWarn(`Theme "${pack}" content.shapes should include "${shape}".`);
      }
    });
    if (content.markdown && content.markdown !== 'html') {
      themeDevWarn(`Theme "${pack}" content.markdown should currently be "html".`);
    }
    if (content.toc && content.toc !== 'html') {
      themeDevWarn(`Theme "${pack}" content.toc should currently be "html".`);
    }
  }
}

function getDeclaredRegionNames(manifest) {
  const topLevel = manifest && manifest.regions;
  if (Array.isArray(topLevel)) return asStringList(topLevel);
  if (topLevel && typeof topLevel === 'object') return Object.keys(topLevel).filter(Boolean);
  return [];
}

function getManifestCacheKey(pack, manifest) {
  if (pack === DEFAULT_PACK) return NATIVE_STYLE_CACHE_KEY;
  const version = manifest && manifest.version ? String(manifest.version).trim() : '';
  return version || '';
}

function safeThemeAssetPath(pack, entry, extension, manifest) {
  const safeEntry = String(entry || '').replace(/^[./]+/, '').trim();
  if (!safeEntry || safeEntry.includes('..') || safeEntry.includes('\\') || !safeEntry.endsWith(extension)) {
    return '';
  }
  const href = `assets/themes/${encodeURIComponent(pack)}/${safeEntry}`;
  const cacheKey = getManifestCacheKey(pack, manifest);
  return cacheKey ? `${href}?v=${encodeURIComponent(cacheKey)}` : href;
}

function applyManifestStyles(pack, manifest) {
  const styles = asStringList(manifest && manifest.styles);
  const declared = styles.length ? styles : DEFAULT_THEME_STYLES;
  const hrefs = declared.map((entry) => safeThemeAssetPath(pack, entry, '.css', manifest)).filter(Boolean);
  if (!hrefs.length) return;
  const primary = hrefs[0];
  try {
    const link = document.getElementById('theme-pack');
    if (link && link.getAttribute('href') !== primary) link.setAttribute('href', primary);
    try { window.__themePackHref = primary; } catch (_) {}
  } catch (_) {}
  try {
    document.querySelectorAll('link[data-theme-pack-extra-style]').forEach((node) => node.remove());
    hrefs.slice(1).forEach((href, index) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-theme-pack-extra-style', `${pack}:${index + 1}`);
      document.head.appendChild(link);
    });
  } catch (_) {}
}

function getThemeRegionController(options = {}) {
  const state = getThemeLayoutState(options);
  return state.regionController || getDefaultThemeRegionController();
}

function clearFailedThemeArtifacts(pack, options = {}) {
  try {
    document.querySelectorAll('link[data-theme-pack-extra-style]').forEach((node) => node.remove());
  } catch (_) {}
  try {
    const failedPrefix = `assets/themes/${encodeURIComponent(pack)}/`;
    const link = document.getElementById('theme-pack');
    const href = link ? String(link.getAttribute('href') || '') : '';
    if (link && href.includes(failedPrefix)) setThemePackStylesheet(DEFAULT_PACK, { allowSuppressed: true });
  } catch (_) {}
  try {
    document.querySelectorAll('[data-theme-root]').forEach((node) => node.remove());
  } catch (_) {}
  try { delete document.body.dataset.themeLayout; } catch (_) {}
  try { getThemeRegionController(options).setThemeLayoutContext(null); } catch (_) {}
}

function clearMountedThemeArtifacts(options = {}) {
  try {
    document.querySelectorAll('link[data-theme-pack-extra-style]').forEach((node) => node.remove());
  } catch (_) {}
  try {
    document.querySelectorAll('[data-theme-root]').forEach((node) => node.remove());
  } catch (_) {}
  try { delete document.body.dataset.themeLayout; } catch (_) {}
  try { getThemeRegionController(options).setThemeLayoutContext(null); } catch (_) {}
}

function getThemeLayoutState(options = {}) {
  return options && options.themeLayoutState ? options.themeLayoutState : defaultThemeLayoutState;
}

function getMountGeneration(options = {}) {
  const state = getThemeLayoutState(options);
  const generation = Number(options.mountGeneration);
  return Number.isFinite(generation) ? generation : state.layoutMountGeneration;
}

function isCurrentMountGeneration(generation, options = {}) {
  return Number(generation) === getThemeLayoutState(options).layoutMountGeneration;
}

function warnUndeclaredRegions(pack, manifest, regions) {
  if (!isThemeDevMode()) return;
  const declared = new Set(getDeclaredRegionNames(manifest));
  if (!declared.size || !regions || typeof regions !== 'object') return;
  Object.keys(regions).forEach((key) => {
    if (!declared.has(key)) {
      themeDevWarn(`Theme "${pack}" returned undeclared region "${key}".`);
    }
  });
}

function warnMissingRegions(pack, manifest, context) {
  if (!isThemeDevMode()) return;
  const regions = ensureThemeRegionRegistry(context && context.regions);
  getDeclaredRegionNames(manifest).forEach((key) => {
    const region = regions.get(key);
    if (!region) {
      themeDevWarn(`Theme "${pack}" declares missing mounted region "${key}".`);
    }
  });
}

function createThemeApi(pack, manifest) {
  const api = {
    name: String((manifest && manifest.name) || pack || ''),
    version: String((manifest && manifest.version) || ''),
    contractVersion: firstDefined(manifest && manifest.contractVersion, CONTRACT_VERSION),
    manifest,
    mount: null,
    unmount: null,
    regions: asObject(manifest && manifest.regions) || {},
    views: {},
    components: {},
    effects: {}
  };

  const declaredViews = asObject(manifest && manifest.views);
  if (declaredViews) {
    Object.keys(declaredViews).forEach((key) => { api.views[key] = null; });
  }

  return api;
}

function mergeFunctionMap(target, source) {
  if (!target || !source || typeof source !== 'object') return target;
  Object.entries(source).forEach(([key, value]) => {
    if (typeof value === 'function') target[key] = value;
  });
  return target;
}

function mergeThemeApi(target, source) {
  if (!target || !source || typeof source !== 'object') return target;
  if (typeof source.mount === 'function') target.mount = source.mount;
  if (typeof source.unmount === 'function') target.unmount = source.unmount;
  if (source.regions && typeof source.regions === 'object') {
    target.regions = { ...target.regions, ...source.regions };
  }
  mergeFunctionMap(target.views, source.views);
  mergeFunctionMap(target.components, source.components);
  mergeFunctionMap(target.effects, source.effects);
  return target;
}

function extractThemeApi(mod) {
  if (!mod || typeof mod !== 'object') return null;
  const explicit = asObject(mod.theme) || asObject(mod.themeApi) || asObject(mod.api);
  const fromDefault = asObject(mod.default);
  const direct = (
    asObject(mod.views)
    || asObject(mod.components)
    || asObject(mod.effects)
    || asObject(mod.regions)
    || typeof mod.mount === 'function'
    || typeof mod.unmount === 'function'
  ) ? mod : null;
  const source = explicit || fromDefault || direct;
  if (!source) return null;
  if (
    typeof source.mount === 'function'
    || typeof source.unmount === 'function'
    || asObject(source.views)
    || asObject(source.components)
    || asObject(source.effects)
    || asObject(source.regions)
  ) {
    return source;
  }
  return null;
}

async function loadManifest(pack) {
  const base = `assets/themes/${encodeURIComponent(pack)}/theme.json`;
  const resp = await fetch(base, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid manifest');
  const list = Array.isArray(data.modules) ? data.modules : [];
  if (!list.length) throw new Error('Empty module list');
  const manifest = { ...data, modules: list.map(x => String(x)) };
  validateManifestContract(pack, manifest);
  return manifest;
}

function appendImportCacheKey(entry, cacheKey) {
  const raw = String(entry || '');
  const key = String(cacheKey || '').trim();
  if (!raw || !key) return raw;
  const hashIndex = raw.indexOf('#');
  const pathAndQuery = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
  const joiner = pathAndQuery.includes('?') ? '&' : '?';
  return `${pathAndQuery}${joiner}v=${encodeURIComponent(key)}${hash}`;
}

function resolveModuleEntry(pack, entry, manifest) {
  const safeEntry = String(entry || '').replace(/^[./]+/, '').trim();
  if (!safeEntry) return '';
  if (safeEntry.includes('..') || safeEntry.includes('\\')) return '';
  const cacheKey = pack === DEFAULT_PACK ? NATIVE_MODULE_CACHE_KEY : getManifestCacheKey(pack, manifest);
  const moduleEntry = pack === DEFAULT_PACK
    ? appendImportCacheKey(safeEntry, cacheKey)
    : appendImportCacheKey(safeEntry, cacheKey);
  return `../themes/${encodeURIComponent(pack)}/${moduleEntry}`;
}

async function loadThemeModule(pack, entry, manifest) {
  const path = resolveModuleEntry(pack, entry, manifest);
  if (!path) return null;
  try {
    if (typeof window !== 'undefined' && typeof window.__pressThemeModuleLoader === 'function') {
      const mod = await window.__pressThemeModuleLoader(path, { pack, entry, manifest });
      return { entry, mod };
    }
  } catch (err) {
    throw err;
  }
  const mod = await import(path);
  return { entry, mod };
}

function createThemeModuleLoadFailure(entry, error) {
  return { entry, error };
}

async function loadThemeModules(pack, manifest, options = {}) {
  const failFast = options.failFast === true;
  return Promise.all(manifest.modules.map(async (entry) => {
    try {
      const loaded = await loadThemeModule(pack, entry, manifest);
      return { entry, loaded };
    } catch (error) {
      if (failFast) throw createThemeModuleLoadFailure(entry, error);
      return { entry, error };
    }
  }));
}

async function mountLoadedModule(pack, entry, mod, context, manifest) {
  if (!mod) return;
  const modApi = extractThemeApi(mod);
  if (modApi) mergeThemeApi(context.theme, modApi);
  const fn = typeof mod.mount === 'function'
    ? mod.mount
    : (modApi && typeof modApi.mount === 'function'
        ? modApi.mount
        : (typeof mod.default === 'function' ? mod.default : null));
  if (!fn) return;
  context.regions = ensureThemeRegionRegistry(context.regions);
  const result = await fn(context);
  if (result && typeof result === 'object') {
    const resultApi = extractThemeApi(result);
    if (resultApi) mergeThemeApi(context.theme, resultApi);
    if (result.regions && typeof result.regions === 'object') {
      warnUndeclaredRegions(pack, manifest, result.regions);
      context.regions = mergeThemeRegions(context.regions, result.regions);
    }
    if (result.document && !context.document) {
      context.document = result.document;
    }
  }
  context.regions = ensureThemeRegionRegistry(context.regions);
}

async function mountPack(pack, allowFallback = true, options = {}) {
  const persist = options.persist !== false;
  const themeLayoutState = getThemeLayoutState(options);
  const regionController = themeLayoutState.regionController || getDefaultThemeRegionController();
  const mountGeneration = getMountGeneration(options);
  let manifest;
  try {
    manifest = await loadManifest(pack);
    if (!isCurrentMountGeneration(mountGeneration, options)) return null;
  } catch (err) {
    if (!isCurrentMountGeneration(mountGeneration, options)) return null;
    console.error(`[theme] Failed to load manifest for "${pack}"`, err);
    if (allowFallback && pack !== DEFAULT_PACK) {
      if (persist) {
        suppressThemePack(pack);
        clearPendingThemePack(pack);
      }
      clearFailedThemeArtifacts(pack, options);
      return mountPack(DEFAULT_PACK, false, options);
    }
    manifest = FALLBACK_MANIFEST;
  }

  let moduleResults;
  try {
    moduleResults = await loadThemeModules(pack, manifest, { failFast: allowFallback && pack !== DEFAULT_PACK });
  } catch (failure) {
    if (!isCurrentMountGeneration(mountGeneration, options)) return null;
    const entry = failure && typeof failure === 'object' && Object.prototype.hasOwnProperty.call(failure, 'entry')
      ? failure.entry
      : '';
    const error = failure && typeof failure === 'object' && Object.prototype.hasOwnProperty.call(failure, 'error')
      ? failure.error
      : failure;
    console.error('[theme] Failed to load module', entry, error);
    if (allowFallback && pack !== DEFAULT_PACK) {
      if (persist) {
        suppressThemePack(pack);
        clearPendingThemePack(pack);
      }
      clearFailedThemeArtifacts(pack, options);
      return mountPack(DEFAULT_PACK, false, options);
    }
    moduleResults = [];
  }
  if (!isCurrentMountGeneration(mountGeneration, options)) return null;

  const loadedModules = [];
  for (const result of moduleResults) {
    if (result.error) {
      console.error('[theme] Failed to load module', result.entry, result.error);
      if (allowFallback && pack !== DEFAULT_PACK) {
        if (persist) {
          suppressThemePack(pack);
          clearPendingThemePack(pack);
        }
        clearFailedThemeArtifacts(pack, options);
        return mountPack(DEFAULT_PACK, false, options);
      }
      continue;
    }
    if (result.loaded) loadedModules.push(result.loaded);
  }

  const context = {
    document: document,
    i18n: createThemeI18nContext(),
    regions: createThemeRegionRegistry(),
    features: options.features || null,
    router: options.router || null,
    pack,
    manifest,
    theme: createThemeApi(pack, manifest),
    utilities: {
      getRegion: (names) => regionController.getThemeRegion(names),
      warn: themeDevWarn
    }
  };

  if (!isCurrentMountGeneration(mountGeneration, options)) return null;
  regionController.setThemeLayoutContext(context);
  applyManifestStyles(pack, manifest);

  for (const { entry, mod } of loadedModules) {
    try {
      if (!isCurrentMountGeneration(mountGeneration, options)) return null;
      await mountLoadedModule(pack, entry, mod, context, manifest);
      if (!isCurrentMountGeneration(mountGeneration, options)) return null;
    } catch (err) {
      if (!isCurrentMountGeneration(mountGeneration, options)) return null;
      console.error('[theme] Failed to mount module', entry, err);
      if (allowFallback && pack !== DEFAULT_PACK) {
        if (persist) {
          suppressThemePack(pack);
          clearPendingThemePack(pack);
        }
        clearFailedThemeArtifacts(pack, options);
        return mountPack(DEFAULT_PACK, false, options);
      }
    }
  }

  if (!isCurrentMountGeneration(mountGeneration, options)) return null;
  document.body.dataset.themeLayout = pack;
  warnMissingRegions(pack, manifest, context);
  regionController.setThemeLayoutContext(context);
  if (persist && pack !== DEFAULT_PACK) {
    commitThemePack(pack, { applyStyles: false });
  }
  return context;
}

async function ensureThemeLayoutWithState(themeLayoutState, options = {}) {
  const requestedPack = options && options.pack ? String(options.pack) : '';
  const pack = requestedPack || getRequestedThemePack();
  let mountGeneration = themeLayoutState.layoutMountGeneration;
  if (options && options.reset) {
    mountGeneration = themeLayoutState.layoutMountGeneration + 1;
    themeLayoutState.layoutMountGeneration = mountGeneration;
    clearMountedThemeArtifacts({ themeLayoutState });
    themeLayoutState.activePack = null;
    themeLayoutState.layoutPromise = null;
    themeLayoutState.latestLayoutOptions = null;
  }
  const cachedContext = themeLayoutState.regionController.getThemeLayoutContext();
  if (cachedContext && document.body.dataset.themeLayout === pack) {
    return refreshThemeLayoutRuntimeContext(cachedContext, options, themeLayoutState.regionController);
  }
  if (themeLayoutState.layoutPromise && themeLayoutState.activePack === pack) {
    const reuseGeneration = mountGeneration;
    themeLayoutState.latestLayoutOptions = options;
    return themeLayoutState.layoutPromise.then((context) => {
      if (!isCurrentMountGeneration(reuseGeneration, { themeLayoutState })) return context;
      return refreshThemeLayoutRuntimeContext(context, themeLayoutState.latestLayoutOptions || options, themeLayoutState.regionController);
    });
  }
  themeLayoutState.activePack = pack;
  themeLayoutState.latestLayoutOptions = options;
  themeLayoutState.layoutPromise = mountPack(pack, true, { ...options, mountGeneration, themeLayoutState }).then((context) => {
    if (!isCurrentMountGeneration(mountGeneration, { themeLayoutState })) return context;
    const resolvedPack = (context && context.pack) || document.body.dataset.themeLayout || DEFAULT_PACK;
    themeLayoutState.activePack = resolvedPack;
    return refreshThemeLayoutRuntimeContext(context, themeLayoutState.latestLayoutOptions || options, themeLayoutState.regionController);
  });
  return themeLayoutState.layoutPromise;
}

export async function ensureThemeLayout(options = {}) {
  return ensureThemeLayoutWithState(defaultThemeLayoutState, options);
}

export function getThemeLayoutContext() {
  return defaultThemeLayoutState.regionController.getThemeLayoutContext();
}

function getThemeApiHandlerWithState(name, themeLayoutState) {
  const hookName = String(name || '').trim();
  if (!hookName) return null;
  const context = themeLayoutState.regionController.getThemeLayoutContext();
  const api = context && context.theme;
  if (api && typeof api === 'object') {
    const viewName = EFFECT_VIEW_NAMES[hookName];
    if (viewName && api.views && typeof api.views[viewName] === 'function') {
      return api.views[viewName];
    }
    if (api.effects && typeof api.effects[hookName] === 'function') {
      return api.effects[hookName];
    }
  }
  return null;
}

export function getThemeApiHandler(name) {
  return getThemeApiHandlerWithState(name, defaultThemeLayoutState);
}

export function getThemeRegion(names) {
  return defaultThemeLayoutState.regionController.getThemeRegion(names);
}

export function createThemeLayoutController() {
  const themeLayoutState = createThemeLayoutState({ regionController: createThemeRegionController() });
  return {
    ensureThemeLayout: (options = {}) => ensureThemeLayoutWithState(themeLayoutState, options),
    getThemeLayoutContext: () => themeLayoutState.regionController.getThemeLayoutContext(),
    getThemeApiHandler: (name) => getThemeApiHandlerWithState(name, themeLayoutState),
    getThemeRegion: (names) => themeLayoutState.regionController.getThemeRegion(names)
  };
}
