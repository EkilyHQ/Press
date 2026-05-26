import { t } from './i18n.js';
import { createThemeInstallService } from './theme-install-service.js';
import {
  getThemeManagerOfficialCatalogStatus as getOfficialCatalogStatusForRuntime,
  getThemeManagerProductStateStatus as getProductStateStatusForRuntime,
  loadThemeManagerOfficialCatalog as loadOfficialCatalogForRuntime,
  loadThemeManagerProductState as loadProductStateForRuntime,
  loadThemeManagerRegistry as loadRegistryForRuntime
} from './theme-manager-data.js';
import {
  createThemeManagerElements,
  renderThemeManagerAvailableThemes,
  renderThemeManagerInstalledThemes,
  renderThemeManagerPendingFiles,
  setActiveThemeManagerView,
  setThemeManagerBusy as setBusy,
  setThemeManagerStatus as setStatus
} from './theme-manager-view.js';
import {
  collectThemeArchiveEntries,
  normalizeThemeFilePath,
  normalizeThemeReleaseManifest,
  sanitizeThemeSlug,
  verifyThemeAsset
} from './theme-package-core.js';

export {
  collectThemeArchiveEntries,
  normalizeThemeCatalog,
  normalizeThemeFilePath,
  normalizeThemeRegistry,
  normalizeThemeReleaseManifest,
  sanitizeThemeSlug,
  verifyThemeAsset
} from './theme-package-core.js';
export { OFFICIAL_THEME_CATALOG_URL } from './theme-manager-data.js';

function createThemeManagerState() {
  return {
    initialized: false,
    busy: false,
    registryCache: null,
    catalogCache: null,
    catalogLoadError: '',
    productStateCache: null,
    productStateLoadError: '',
    currentSummary: [],
    currentFiles: [],
    currentThemeDigest: '',
    currentThemeSize: 0,
    currentThemeAssetName: '',
    pendingSiteThemeFallback: null,
    listeners: new Set(),
    optionsRef: {
      getCurrentThemePack: null,
      setSiteThemePack: null
    },
    elements: createThemeManagerElements()
  };
}

function createThemeManagerRuntime(options = {}) {
  const state = createThemeManagerState();
  const documentRef = options.documentRef || null;
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : null;
  const runtime = {
    state,
    getDocument() {
      return documentRef || (typeof document !== 'undefined' ? document : null);
    },
    getFetch() {
      if (fetchImpl) return fetchImpl;
      if (typeof fetch === 'function') return fetch;
      throw new Error('Theme manager fetch is unavailable.');
    }
  };
  runtime.installService = createThemeInstallService({
    getFetch: () => runtime.getFetch(),
    loadOfficialThemeCatalog: (loadOptions = {}) => loadOfficialCatalogForRuntime(runtime, loadOptions)
  });
  return runtime;
}

function notifyStateChange(runtime) {
  runtime.state.listeners.forEach((listener) => {
    try { listener(); } catch (_) {}
  });
}

function getCurrentThemePackValue(runtime) {
  const { optionsRef } = runtime.state;
  try {
    return optionsRef.getCurrentThemePack ? sanitizeThemeSlug(optionsRef.getCurrentThemePack()) : '';
  } catch (_) {
    return '';
  }
}

function clearPendingSiteThemeFallback(runtime, options = {}) {
  const state = runtime.state;
  const { optionsRef } = state;
  const pending = state.pendingSiteThemeFallback;
  state.pendingSiteThemeFallback = null;
  if (!pending || options.keep === true) return;
  if (typeof optionsRef.setSiteThemePack !== 'function') return;
  const current = getCurrentThemePackValue(runtime);
  if (!current || current === pending.to) {
    try { optionsRef.setSiteThemePack(pending.from); } catch (_) {}
  }
}

function setActiveSiteThemePack(runtime, value) {
  const { optionsRef } = runtime.state;
  if (typeof optionsRef.setSiteThemePack !== 'function') return false;
  const slug = sanitizeThemeSlug(value);
  try {
    optionsRef.setSiteThemePack(slug);
    return true;
  } catch (_) {
    return false;
  }
}

function applySummary(runtime, summary, files, meta = {}) {
  const state = runtime.state;
  state.currentSummary = Array.isArray(summary) ? summary.slice() : [];
  state.currentFiles = Array.isArray(files) ? files.slice() : [];
  state.currentThemeDigest = meta.digest || '';
  state.currentThemeSize = Number.isFinite(meta.size) ? meta.size : 0;
  state.currentThemeAssetName = meta.assetName || '';
  renderThemeManagerPendingFiles(runtime);
  notifyStateChange(runtime);
}

async function stageThemeArchiveWithRuntime(runtime, buffer, fileName, options = {}) {
  const state = runtime.state;
  const releaseManifest = options.releaseManifest || null;
  const registry = await loadRegistryForRuntime(runtime, { force: true, allowFallback: false });
  const staged = await runtime.installService.stageThemeArchive({
    buffer,
    fileName,
    registry,
    releaseManifest,
    source: options.source,
    allowBuiltInUpdate: options.allowBuiltInUpdate
  });
  state.registryCache = staged.registry;
  applySummary(runtime, staged.summary, staged.files, staged.meta);
  const hadPendingSiteThemeFallback = !!state.pendingSiteThemeFallback;
  clearPendingSiteThemeFallback(runtime);
  const shouldActivate = options.activate !== false;
  const activated = shouldActivate && !hadPendingSiteThemeFallback && setActiveSiteThemePack(runtime, staged.archive.slug);
  setStatus(
    runtime,
    `${staged.previous ? 'Updated' : 'Installed'} ${staged.nextEntry.label}. Review and publish the staged theme files${activated ? ' and site.yaml theme setting' : ''}.`,
    { tone: 'success' }
  );
  renderThemeManager(runtime);
  return { archive: staged.archive, registry: staged.registry, files: staged.files };
}

async function stageCatalogThemeWithRuntime(runtime, catalogEntry, options = {}) {
  const state = runtime.state;
  const registry = await loadRegistryForRuntime(runtime, { force: true, allowFallback: false });
  const staged = await runtime.installService.stageCatalogTheme({ catalogEntry, registry });
  state.registryCache = staged.registry;
  applySummary(runtime, staged.summary, staged.files, staged.meta);
  const hadPendingSiteThemeFallback = !!state.pendingSiteThemeFallback;
  clearPendingSiteThemeFallback(runtime);
  const shouldActivate = options.activate !== false;
  const activated = shouldActivate && !hadPendingSiteThemeFallback && setActiveSiteThemePack(runtime, staged.archive.slug);
  setStatus(
    runtime,
    `${staged.previous ? 'Updated' : 'Installed'} ${staged.nextEntry.label}. Review and publish the staged theme files${activated ? ' and site.yaml theme setting' : ''}.`,
    { tone: 'success' }
  );
  renderThemeManager(runtime);
  return { archive: staged.archive, registry: staged.registry, files: staged.files };
}

async function stageThemeUninstallWithRuntime(runtime, slug) {
  const state = runtime.state;
  const { optionsRef } = state;
  clearPendingSiteThemeFallback(runtime);
  const registry = await loadRegistryForRuntime(runtime, { force: true, allowFallback: false });
  const staged = await runtime.installService.stageUninstall({
    slug,
    registry,
    currentThemePack: getCurrentThemePackValue(runtime)
  });
  try {
    if (staged.siteThemeFallback && typeof optionsRef.setSiteThemePack === 'function') {
      state.pendingSiteThemeFallback = staged.siteThemeFallback;
      optionsRef.setSiteThemePack('native');
    }
  } catch (_) {}
  state.registryCache = staged.registry;
  applySummary(runtime, staged.summary, staged.files);
  setStatus(runtime, `Uninstalled ${staged.entry.label}. Publish to delete the theme files.`, { tone: 'success' });
  renderThemeManager(runtime);
  return { registry: staged.registry, files: staged.files };
}

function stageSiteThemePack(runtime, value, label) {
  const slug = sanitizeThemeSlug(value);
  clearPendingSiteThemeFallback(runtime);
  if (!setActiveSiteThemePack(runtime, slug)) return;
  setStatus(runtime, `Using ${label || slug}. Review and publish site.yaml.`, { tone: 'success' });
  notifyStateChange(runtime);
  renderThemeManager(runtime);
}

async function renderThemeManager(runtime, options = {}) {
  if (!runtime.state.elements.root) return;
  const [registry, catalog, productState] = await Promise.all([
    loadRegistryForRuntime(runtime, options),
    loadOfficialCatalogForRuntime(runtime, options),
    loadProductStateForRuntime(runtime, options)
  ]);
  renderThemeManagerInstalledThemes(runtime, registry, catalog, productState, {
    getCurrentThemePack: () => getCurrentThemePackValue(runtime) || 'native',
    onUseTheme: (entry) => stageSiteThemePack(runtime, entry.value, entry.label || entry.value),
    onUpdateTheme: async (catalogEntry, entry) => {
      setBusy(runtime, true);
      try {
        setStatus(runtime, `Downloading ${catalogEntry.label}...`);
        await stageCatalogThemeWithRuntime(runtime, catalogEntry, { activate: getCurrentThemePackValue(runtime) === entry.value });
      } catch (err) {
        console.error('Theme update failed', err);
        setStatus(runtime, err && err.message ? err.message : 'Theme update failed.', { tone: 'error' });
      } finally {
        setBusy(runtime, false);
      }
    },
    onUninstallTheme: async (entry) => {
      setBusy(runtime, true);
      try {
        await stageThemeUninstallWithRuntime(runtime, entry.value);
      } catch (err) {
        console.error('Theme uninstall failed', err);
        setStatus(runtime, err && err.message ? err.message : 'Theme uninstall failed.', { tone: 'error' });
      } finally {
        setBusy(runtime, false);
      }
    }
  });
  renderThemeManagerAvailableThemes(runtime, registry, catalog, productState, {
    onInstallTheme: async (entry, actionMeta = {}) => {
      setBusy(runtime, true);
      try {
        setStatus(runtime, `Downloading ${entry.label}...`);
        await stageCatalogThemeWithRuntime(runtime, entry, {
          activate: !actionMeta.installed || getCurrentThemePackValue(runtime) === entry.value
        });
      } catch (err) {
        console.error('Theme install failed', err);
        setStatus(runtime, err && err.message ? err.message : 'Theme install failed.', { tone: 'error' });
      } finally {
        setBusy(runtime, false);
      }
    }
  });
  renderThemeManagerPendingFiles(runtime);
}

async function handleImportFileWithRuntime(runtime, file) {
  if (!file) return;
  setBusy(runtime, true);
  try {
    setStatus(runtime, `Reading ${file.name}...`);
    const buffer = await file.arrayBuffer();
    await stageThemeArchiveWithRuntime(runtime, buffer, file.name);
    setActiveThemeManagerView(runtime, 'installed');
  } catch (err) {
    console.error('Theme import failed', err);
    setStatus(runtime, err && err.message ? err.message : 'Theme import failed.', { tone: 'error' });
  } finally {
    setBusy(runtime, false);
  }
}

function openImportPicker(runtime) {
  const { elements, busy } = runtime.state;
  if (elements.fileInput && !busy) elements.fileInput.click();
}

function initThemeManagerWithRuntime(runtime, options = {}) {
  const state = runtime.state;
  const { elements, optionsRef } = state;
  const documentRef = runtime.getDocument();
  if (options && typeof options.onStateChange === 'function') state.listeners.add(options.onStateChange);
  if (options && typeof options.getCurrentThemePack === 'function') optionsRef.getCurrentThemePack = options.getCurrentThemePack;
  if (options && typeof options.setSiteThemePack === 'function') optionsRef.setSiteThemePack = options.setSiteThemePack;
  if (state.initialized) return;
  state.initialized = true;

  if (documentRef && typeof documentRef.getElementById === 'function') {
    elements.root = documentRef.getElementById('mode-themes');
    elements.status = documentRef.getElementById('themeManagerStatus');
    elements.tabs = typeof documentRef.querySelectorAll === 'function'
      ? Array.from(documentRef.querySelectorAll('[data-theme-manager-view]'))
      : [];
    elements.views = typeof documentRef.querySelectorAll === 'function'
      ? Array.from(documentRef.querySelectorAll('[data-theme-manager-panel]'))
      : [];
    elements.installedList = documentRef.getElementById('themeManagerInstalledList');
    elements.availableList = documentRef.getElementById('themeManagerAvailableList');
    elements.pendingSection = documentRef.getElementById('themeManagerPendingSection');
    elements.pendingList = documentRef.getElementById('themeManagerFileList');
    elements.fileInput = documentRef.getElementById('themeImportFileInput');
    elements.headerImportButton = documentRef.getElementById('btnThemeImport');
    elements.inlineImportButton = documentRef.getElementById('btnThemeImportInline');
    elements.refreshCatalogButton = documentRef.getElementById('btnThemeRefreshCatalog');
    elements.clearButton = documentRef.getElementById('btnThemeClearStaged');
  }

  elements.tabs.forEach((button) => {
    button.addEventListener('click', () => setActiveThemeManagerView(runtime, button.dataset.themeManagerView));
  });
  if (elements.headerImportButton) elements.headerImportButton.addEventListener('click', () => openImportPicker(runtime));
  if (elements.inlineImportButton) elements.inlineImportButton.addEventListener('click', () => openImportPicker(runtime));
  if (elements.fileInput) {
    elements.fileInput.addEventListener('change', (event) => {
      const input = event && event.target ? event.target : elements.fileInput;
      const file = input && input.files && input.files[0] ? input.files[0] : null;
      if (input) input.value = '';
      handleImportFileWithRuntime(runtime, file);
    });
  }
  if (elements.refreshCatalogButton) {
    elements.refreshCatalogButton.addEventListener('click', async () => {
      if (runtime.state.busy) return;
      setBusy(runtime, true);
      try {
        await renderThemeManager(runtime, { force: true });
        if (runtime.state.catalogLoadError) {
          setStatus(runtime, runtime.state.catalogLoadError, { tone: 'error' });
        } else if (runtime.state.productStateLoadError) {
          setStatus(runtime, runtime.state.productStateLoadError, { tone: 'error' });
        } else {
          setStatus(runtime, 'Theme catalog refreshed.', { tone: 'success' });
        }
      } catch (err) {
        setStatus(runtime, err && err.message ? err.message : 'Unable to refresh theme catalog.', { tone: 'error' });
      } finally {
        setBusy(runtime, false);
      }
    });
  }
  if (elements.clearButton) {
    elements.clearButton.addEventListener('click', () => clearThemeManagerStateWithRuntime(runtime, { keepStatus: false }));
  }

  setActiveThemeManagerView(runtime, 'installed');
  setStatus(runtime, 'No theme changes are staged.');
  renderThemeManager(runtime).catch((err) => {
    console.error('Failed to initialize theme manager', err);
    setStatus(runtime, err && err.message ? err.message : 'Failed to load themes.', { tone: 'error' });
  });
}

function getThemeManagerSummaryEntriesWithRuntime(runtime) {
  return runtime.state.currentSummary.slice();
}

function getThemeManagerCommitFilesWithRuntime(runtime) {
  return runtime.state.currentFiles.slice();
}

function clearThemeManagerStateWithRuntime(runtime, options = {}) {
  const state = runtime.state;
  clearPendingSiteThemeFallback(runtime, { keep: options && options.keepSiteThemeFallback === true });
  applySummary(runtime, [], []);
  state.currentThemeDigest = '';
  state.currentThemeSize = 0;
  state.currentThemeAssetName = '';
  if (options && options.keepRegistryCache !== true) {
    state.registryCache = null;
    if (options.keepCatalogCache !== true) {
      state.catalogCache = null;
      state.catalogLoadError = '';
    }
    if (options.keepProductStateCache !== true) {
      state.productStateCache = null;
      state.productStateLoadError = '';
    }
    renderThemeManager(runtime, { force: true }).catch(() => {});
  }
  if (options && options.keepStatus !== true) {
    try {
      const key = 'editor.themeManager.status.idle';
      const label = t(key);
      setStatus(runtime, label && label !== key ? label : 'No theme changes are staged.');
    } catch (_) {
      setStatus(runtime, 'No theme changes are staged.');
    }
  }
}

function analyzeThemeArchiveWithRuntime(runtime, buffer, fileName = '', options = {}) {
  return stageThemeArchiveWithRuntime(runtime, buffer, fileName, options);
}

export function createThemeManagerController(options = {}) {
  const runtime = createThemeManagerRuntime(options);
  return {
    init(initOptions = {}) {
      return initThemeManagerWithRuntime(runtime, initOptions);
    },
    getSummaryEntries() {
      return getThemeManagerSummaryEntriesWithRuntime(runtime);
    },
    getCommitFiles() {
      return getThemeManagerCommitFilesWithRuntime(runtime);
    },
    clear(clearOptions = {}) {
      return clearThemeManagerStateWithRuntime(runtime, clearOptions);
    },
    analyzeArchive(buffer, fileName = '', analyzeOptions = {}) {
      return analyzeThemeArchiveWithRuntime(runtime, buffer, fileName, analyzeOptions);
    },
    handleImportFile(file) {
      return handleImportFileWithRuntime(runtime, file);
    },
    loadOfficialCatalog(loadOptions = {}) {
      return loadOfficialCatalogForRuntime(runtime, loadOptions);
    },
    getOfficialCatalogStatus() {
      return getOfficialCatalogStatusForRuntime(runtime);
    },
    loadProductState(loadOptions = {}) {
      return loadProductStateForRuntime(runtime, loadOptions);
    },
    getProductStateStatus() {
      return getProductStateStatusForRuntime(runtime);
    },
    stageCatalogTheme(catalogEntry, stageOptions = {}) {
      return stageCatalogThemeWithRuntime(runtime, catalogEntry, stageOptions);
    },
    stageUninstall(slug) {
      return stageThemeUninstallWithRuntime(runtime, slug);
    }
  };
}

const defaultThemeManagerController = createThemeManagerController();

export function initThemeManager(options = {}) {
  return defaultThemeManagerController.init(options);
}

export function getThemeManagerSummaryEntries() {
  return defaultThemeManagerController.getSummaryEntries();
}

export function getThemeManagerCommitFiles() {
  return defaultThemeManagerController.getCommitFiles();
}

export function clearThemeManagerState(options = {}) {
  return defaultThemeManagerController.clear(options);
}

export function analyzeThemeArchive(buffer, fileName = '', options = {}) {
  return defaultThemeManagerController.analyzeArchive(buffer, fileName, options);
}

export function handleImportFile(file) {
  return defaultThemeManagerController.handleImportFile(file);
}

export function loadOfficialThemeCatalog(options = {}) {
  return defaultThemeManagerController.loadOfficialCatalog(options);
}

export function getOfficialThemeCatalogStatus() {
  return defaultThemeManagerController.getOfficialCatalogStatus();
}

export function loadThemeManagerProductState(options = {}) {
  return defaultThemeManagerController.loadProductState(options);
}

export function getThemeManagerProductStateStatus() {
  return defaultThemeManagerController.getProductStateStatus();
}

export function stageCatalogTheme(catalogEntry, options = {}) {
  return defaultThemeManagerController.stageCatalogTheme(catalogEntry, options);
}

export function stageThemeUninstall(slug) {
  return defaultThemeManagerController.stageUninstall(slug);
}
