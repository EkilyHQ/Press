import { getProductStateThemeEntry } from './product-state.js';
import { safeString } from './theme-package-core.js';

export function createThemeManagerElements() {
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

export function setThemeManagerStatus(runtime, text, options = {}) {
  const { elements } = runtime.state;
  if (!elements.status) return;
  elements.status.textContent = text ? safeString(text) : '';
  elements.status.dataset.tone = options.tone || 'info';
}

export function setThemeManagerBusy(runtime, value) {
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

export function renderThemeManagerPendingFiles(runtime) {
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

export function renderThemeManagerInstalledThemes(runtime, registry, catalog, productState, actions = {}) {
  const { elements } = runtime.state;
  const documentRef = runtime.getDocument();
  if (!elements.installedList) return;
  clearElement(elements.installedList);
  renderProductStateNotice(runtime, elements.installedList, productState);
  const currentThemePack = typeof actions.getCurrentThemePack === 'function' ? actions.getCurrentThemePack() || 'native' : 'native';
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
    const rowActions = documentRef.createElement('div');
    rowActions.className = 'theme-manager-row-actions';
    if (entry.value !== currentThemePack) {
      const button = makeButton(runtime, 'Use theme', 'btn-secondary', () => {
        if (runtime.state.busy || typeof actions.onUseTheme !== 'function') return;
        actions.onUseTheme(entry);
      });
      if (button) rowActions.appendChild(button);
    }
    const catalogEntry = catalog.find((item) => item.value === entry.value);
    if (!entry.builtIn && catalogEntry) {
      const button = makeButton(runtime, 'Update', 'btn-secondary', () => {
        if (runtime.state.busy || typeof actions.onUpdateTheme !== 'function') return;
        actions.onUpdateTheme(catalogEntry, entry);
      });
      if (button) rowActions.appendChild(button);
    }
    if (!entry.builtIn && entry.removable !== false) {
      const button = makeButton(runtime, 'Uninstall', 'btn-secondary', () => {
        if (runtime.state.busy || typeof actions.onUninstallTheme !== 'function') return;
        actions.onUninstallTheme(entry);
      });
      if (button) rowActions.appendChild(button);
    }
    row.appendChild(body);
    row.appendChild(rowActions);
    elements.installedList.appendChild(row);
  });
}

export function renderThemeManagerAvailableThemes(runtime, registry, catalog, productState, actions = {}) {
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
    const rowActions = documentRef.createElement('div');
    rowActions.className = 'theme-manager-row-actions';
    const isInstalled = installed.has(entry.value);
    const button = makeButton(runtime, isInstalled ? 'Update' : 'Install', 'btn-primary', () => {
      if (runtime.state.busy || typeof actions.onInstallTheme !== 'function') return;
      actions.onInstallTheme(entry, { installed: isInstalled });
    });
    if (button) rowActions.appendChild(button);
    row.appendChild(body);
    row.appendChild(rowActions);
    elements.availableList.appendChild(row);
  });
}

export function setActiveThemeManagerView(runtime, view) {
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
