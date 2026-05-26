import { t } from './i18n.js';
import { getProductStateThemeEntry, loadProductState } from './product-state.js';
import { PRESS_GITHUB_PROVIDER } from './provider-adapters.js';
import { createThemeInstallService } from './theme-install-service.js';
import {
  collectThemeArchiveEntries,
  normalizeThemeCatalog,
  normalizeThemeFilePath,
  normalizeThemeRegistry,
  normalizeThemeReleaseManifest,
  safeString,
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

export const OFFICIAL_THEME_CATALOG_URL = PRESS_GITHUB_PROVIDER.themeCatalogUrl;

function createThemeManagerElements() {
  return {
    root: null,
    status: null,
    tabs: null,
    views: null,
    installedList: null,
    availableList: null,
    pendingSection: null,
    pendingList: null,
    fileInput: null,
    headerImportButton: null,
    inlineImportButton: null,
    refreshCatalogButton: null,
    clearButton: null
  };
}

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
    loadOfficialThemeCatalog: (loadOptions = {}) => loadOfficialThemeCatalogWithRuntime(runtime, loadOptions)
  });
  return runtime;
}

function notifyStateChange(runtime) {
  runtime.state.listeners.forEach((listener) => {
    try { listener(); } catch (_) {}
  });
}

function setStatus(runtime, text, options = {}) {
  const { elements } = runtime.state;
  if (!elements.status) return;
  elements.status.textContent = text ? safeString(text) : '';
  elements.status.dataset.tone = options.tone || 'info';
}

function setBusy(runtime, value) {
  const state = runtime.state;
  const { elements } = state;
  state.busy = !!value;
  [elements.headerImportButton, elements.inlineImportButton, elements.refreshCatalogButton, elements.clearButton]
    .forEach((button) => {
      if (!button) return;
      button.disabled = state.busy;
      button.dataset.state = state.busy ? 'busy' : 'idle';
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
  renderPendingFiles(runtime);
  notifyStateChange(runtime);
}

async function loadRegistry(runtime, options = {}) {
  const state = runtime.state;
  if (state.registryCache && !options.force) return state.registryCache.slice();
  let data = null;
  try {
    const response = await runtime.getFetch()('assets/themes/packs.json', { cache: 'no-store' });
    if (!response || !response.ok) throw new Error('Unable to load installed themes.');
    data = await response.json();
  } catch (err) {
    if (options.allowFallback === false) {
      const error = new Error('Unable to load installed theme registry. Theme changes were not staged.');
      error.cause = err;
      throw error;
    }
    data = [{ value: 'native', label: 'Native', builtIn: true, removable: false, source: { type: 'builtin' }, files: [] }];
  }
  state.registryCache = normalizeThemeRegistry(data);
  return state.registryCache.slice();
}

function getOfficialThemeCatalogStatusWithRuntime(runtime) {
  return { error: runtime.state.catalogLoadError };
}

function getProductStateStatusWithRuntime(runtime) {
  const { productStateCache, productStateLoadError } = runtime.state;
  return {
    status: productStateCache ? productStateCache.status : '',
    error: productStateLoadError
  };
}

async function loadOfficialThemeCatalogWithRuntime(runtime, options = {}) {
  const state = runtime.state;
  if (state.catalogCache && !options.force) return state.catalogCache.slice();
  state.catalogLoadError = '';
  try {
    const response = await runtime.getFetch()(OFFICIAL_THEME_CATALOG_URL, { cache: 'no-store' });
    if (!response || !response.ok) throw new Error('Unable to load theme catalog.');
    state.catalogCache = normalizeThemeCatalog(await response.json());
  } catch (err) {
    state.catalogCache = [];
    state.catalogLoadError = err && err.message ? `Official theme catalog is unavailable: ${err.message}` : 'Official theme catalog is unavailable.';
  }
  return state.catalogCache.slice();
}

async function loadProductStateWithRuntime(runtime, options = {}) {
  const state = runtime.state;
  if (state.productStateCache && !options.force) return state.productStateCache;
  state.productStateLoadError = '';
  try {
    state.productStateCache = await loadProductState({ fetchImpl: runtime.getFetch() });
  } catch (err) {
    state.productStateCache = null;
    state.productStateLoadError = err && err.message ? `Product state is unavailable: ${err.message}` : 'Product state is unavailable.';
  }
  return state.productStateCache;
}

async function stageThemeArchiveWithRuntime(runtime, buffer, fileName, options = {}) {
  const state = runtime.state;
  const releaseManifest = options.releaseManifest || null;
  const registry = await loadRegistry(runtime, { force: true, allowFallback: false });
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
  const registry = await loadRegistry(runtime, { force: true, allowFallback: false });
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
  const registry = await loadRegistry(runtime, { force: true, allowFallback: false });
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

function clearElement(node) {
  if (node) node.innerHTML = '';
}

function makeButton(runtime, label, className, onClick) {
  const documentRef = runtime.getDocument();
  if (!documentRef) return null;
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = className || 'btn-secondary';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function stageSiteThemePack(runtime, value, label) {
  const slug = sanitizeThemeSlug(value);
  clearPendingSiteThemeFallback(runtime);
  if (!setActiveSiteThemePack(runtime, slug)) return;
  setStatus(runtime, `Using ${label || slug}. Review and publish site.yaml.`, { tone: 'success' });
  notifyStateChange(runtime);
  renderThemeManager(runtime);
}

function renderPendingFiles(runtime) {
  const { elements, currentFiles } = runtime.state;
  const documentRef = runtime.getDocument();
  if (!elements.pendingSection || !elements.pendingList) return;
  clearElement(elements.pendingList);
  const files = currentFiles.slice();
  elements.pendingSection.hidden = !files.length;
  elements.pendingSection.setAttribute('aria-hidden', files.length ? 'false' : 'true');
  files.forEach((file) => {
    if (!documentRef) return;
    const item = documentRef.createElement('li');
    item.className = 'updates-file-item';
    const name = documentRef.createElement('span');
    name.className = 'updates-file-name';
    name.textContent = file.path || file.label || '';
    const badge = documentRef.createElement('span');
    badge.className = 'updates-file-badge';
    badge.textContent = file.deleted ? 'deleted' : (file.state || 'modified');
    item.appendChild(name);
    item.appendChild(badge);
    elements.pendingList.appendChild(item);
  });
}

function formatThemeProductStateMeta(productState, slug) {
  const entry = getProductStateThemeEntry(productState, slug);
  if (!entry) return '';
  return [
    `release ${entry.status}`,
    entry.version ? `v${entry.version}` : ''
  ].filter(Boolean).join(' ');
}

function buildThemeManagerMeta(parts, productState, slug) {
  return [
    ...parts,
    formatThemeProductStateMeta(productState, slug)
  ].filter(Boolean).join(' · ');
}

function renderProductStateNotice(runtime, target, productState) {
  const { productStateLoadError } = runtime.state;
  const documentRef = runtime.getDocument();
  if (!target || !documentRef) return;
  const message = productStateLoadError || (productState && productState.status !== 'ok' ? `Product state: ${productState.status}` : '');
  if (!message) return;
  const notice = documentRef.createElement('p');
  notice.className = 'muted';
  notice.textContent = message;
  target.appendChild(notice);
}

function renderInstalledThemes(runtime, registry, catalog, productState) {
  const { elements } = runtime.state;
  const documentRef = runtime.getDocument();
  if (!elements.installedList) return;
  clearElement(elements.installedList);
  renderProductStateNotice(runtime, elements.installedList, productState);
  const currentThemePack = getCurrentThemePackValue(runtime) || 'native';
  registry.forEach((entry) => {
    if (!documentRef) return;
    const row = documentRef.createElement('div');
    row.className = 'theme-manager-row';
    const body = documentRef.createElement('div');
    body.className = 'theme-manager-row-body';
    const title = documentRef.createElement('strong');
    title.textContent = entry.label || entry.value;
    const meta = documentRef.createElement('span');
    meta.className = 'muted';
    meta.textContent = buildThemeManagerMeta([
      entry.value,
      entry.version ? `v${entry.version}` : '',
      entry.builtIn ? 'built-in' : (entry.source && entry.source.type ? entry.source.type : '')
    ], productState, entry.value);
    body.appendChild(title);
    body.appendChild(meta);
    const actions = documentRef.createElement('div');
    actions.className = 'theme-manager-row-actions';
    if (entry.value !== currentThemePack) {
      const button = makeButton(runtime, 'Use theme', 'btn-secondary', () => {
        if (runtime.state.busy) return;
        stageSiteThemePack(runtime, entry.value, entry.label || entry.value);
      });
      if (button) actions.appendChild(button);
    }
    const catalogEntry = catalog.find((item) => item.value === entry.value);
    if (!entry.builtIn && catalogEntry) {
      const button = makeButton(runtime, 'Update', 'btn-secondary', async () => {
        if (runtime.state.busy) return;
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
      });
      if (button) actions.appendChild(button);
    }
    if (!entry.builtIn && entry.removable !== false) {
      const button = makeButton(runtime, 'Uninstall', 'btn-secondary', async () => {
        if (runtime.state.busy) return;
        setBusy(runtime, true);
        try {
          await stageThemeUninstallWithRuntime(runtime, entry.value);
        } catch (err) {
          console.error('Theme uninstall failed', err);
          setStatus(runtime, err && err.message ? err.message : 'Theme uninstall failed.', { tone: 'error' });
        } finally {
          setBusy(runtime, false);
        }
      });
      if (button) actions.appendChild(button);
    }
    row.appendChild(body);
    row.appendChild(actions);
    elements.installedList.appendChild(row);
  });
}

function renderAvailableThemes(runtime, registry, catalog, productState) {
  const { elements, catalogLoadError } = runtime.state;
  const documentRef = runtime.getDocument();
  if (!elements.availableList) return;
  clearElement(elements.availableList);
  renderProductStateNotice(runtime, elements.availableList, productState);
  if (!catalog.length) {
    if (!documentRef) return;
    const empty = documentRef.createElement('p');
    empty.className = 'muted';
    empty.textContent = catalogLoadError || 'No official themes are available.';
    elements.availableList.appendChild(empty);
    return;
  }
  const installed = new Set(registry.map((entry) => entry.value));
  catalog.forEach((entry) => {
    if (!documentRef) return;
    const row = documentRef.createElement('div');
    row.className = 'theme-manager-row';
    const body = documentRef.createElement('div');
    body.className = 'theme-manager-row-body';
    const title = documentRef.createElement('strong');
    title.textContent = entry.label || entry.value;
    const meta = documentRef.createElement('span');
    meta.className = 'muted';
    meta.textContent = buildThemeManagerMeta([entry.value, entry.repo || '', entry.description || ''], productState, entry.value);
    body.appendChild(title);
    body.appendChild(meta);
    const actions = documentRef.createElement('div');
    actions.className = 'theme-manager-row-actions';
    const button = makeButton(runtime, installed.has(entry.value) ? 'Update' : 'Install', 'btn-primary', async () => {
      if (runtime.state.busy) return;
      setBusy(runtime, true);
      try {
        setStatus(runtime, `Downloading ${entry.label}...`);
        await stageCatalogThemeWithRuntime(runtime, entry, {
          activate: !installed.has(entry.value) || getCurrentThemePackValue(runtime) === entry.value
        });
      } catch (err) {
        console.error('Theme install failed', err);
        setStatus(runtime, err && err.message ? err.message : 'Theme install failed.', { tone: 'error' });
      } finally {
        setBusy(runtime, false);
      }
    });
    if (button) actions.appendChild(button);
    row.appendChild(body);
    row.appendChild(actions);
    elements.availableList.appendChild(row);
  });
}

async function renderThemeManager(runtime, options = {}) {
  if (!runtime.state.elements.root) return;
  const [registry, catalog, productState] = await Promise.all([
    loadRegistry(runtime, options),
    loadOfficialThemeCatalogWithRuntime(runtime, options),
    loadProductStateWithRuntime(runtime, options)
  ]);
  renderInstalledThemes(runtime, registry, catalog, productState);
  renderAvailableThemes(runtime, registry, catalog, productState);
  renderPendingFiles(runtime);
}

function setActiveThemeManagerView(runtime, view) {
  const { elements } = runtime.state;
  const next = view === 'available' || view === 'import' ? view : 'installed';
  if (elements.tabs) {
    elements.tabs.forEach((button) => {
      const active = button.dataset.themeManagerView === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }
  if (elements.views) {
    elements.views.forEach((panel) => {
      const active = panel.dataset.themeManagerPanel === next;
      panel.hidden = !active;
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }
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
      return loadOfficialThemeCatalogWithRuntime(runtime, loadOptions);
    },
    getOfficialCatalogStatus() {
      return getOfficialThemeCatalogStatusWithRuntime(runtime);
    },
    loadProductState(loadOptions = {}) {
      return loadProductStateWithRuntime(runtime, loadOptions);
    },
    getProductStateStatus() {
      return getProductStateStatusWithRuntime(runtime);
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
