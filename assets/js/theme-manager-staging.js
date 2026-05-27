import {
  loadThemeManagerRegistry as loadRegistryForRuntime
} from './theme-manager-data.js';
import {
  renderThemeManagerPendingFiles,
  setThemeManagerStatus as setStatus
} from './theme-manager-view.js';
import {
  sanitizeThemeSlug
} from './theme-package-core.js';

export function notifyThemeManagerStateChange(runtime) {
  runtime.state.listeners.forEach((listener) => {
    try { listener(); } catch (_) {}
  });
}

export function getCurrentThemePackValue(runtime) {
  const { optionsRef } = runtime.state;
  try {
    return optionsRef.getCurrentThemePack ? sanitizeThemeSlug(optionsRef.getCurrentThemePack()) : '';
  } catch (_) {
    return '';
  }
}

export function clearPendingSiteThemeFallback(runtime, options = {}) {
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

export function applyThemeManagerSummary(runtime, summary, files, meta = {}) {
  const state = runtime.state;
  state.currentSummary = Array.isArray(summary) ? summary.slice() : [];
  state.currentFiles = Array.isArray(files) ? files.slice() : [];
  state.currentThemeDigest = meta.digest || '';
  state.currentThemeSize = Number.isFinite(meta.size) ? meta.size : 0;
  state.currentThemeAssetName = meta.assetName || '';
  renderThemeManagerPendingFiles(runtime);
  notifyThemeManagerStateChange(runtime);
}

function requestRender(options) {
  if (options && typeof options.requestRender === 'function') options.requestRender();
}

export async function stageThemeArchiveWithRuntime(runtime, buffer, fileName, options = {}) {
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
  applyThemeManagerSummary(runtime, staged.summary, staged.files, staged.meta);
  const hadPendingSiteThemeFallback = !!state.pendingSiteThemeFallback;
  clearPendingSiteThemeFallback(runtime);
  const shouldActivate = options.activate !== false;
  const activated = shouldActivate && !hadPendingSiteThemeFallback && setActiveSiteThemePack(runtime, staged.archive.slug);
  setStatus(
    runtime,
    `${staged.previous ? 'Updated' : 'Installed'} ${staged.nextEntry.label}. Review and publish the staged theme files${activated ? ' and site.yaml theme setting' : ''}.`,
    { tone: 'success' }
  );
  requestRender(options);
  return { archive: staged.archive, registry: staged.registry, files: staged.files };
}

export async function stageCatalogThemeWithRuntime(runtime, catalogEntry, options = {}) {
  const state = runtime.state;
  const registry = await loadRegistryForRuntime(runtime, { force: true, allowFallback: false });
  const staged = await runtime.installService.stageCatalogTheme({ catalogEntry, registry });
  state.registryCache = staged.registry;
  applyThemeManagerSummary(runtime, staged.summary, staged.files, staged.meta);
  const hadPendingSiteThemeFallback = !!state.pendingSiteThemeFallback;
  clearPendingSiteThemeFallback(runtime);
  const shouldActivate = options.activate !== false;
  const activated = shouldActivate && !hadPendingSiteThemeFallback && setActiveSiteThemePack(runtime, staged.archive.slug);
  setStatus(
    runtime,
    `${staged.previous ? 'Updated' : 'Installed'} ${staged.nextEntry.label}. Review and publish the staged theme files${activated ? ' and site.yaml theme setting' : ''}.`,
    { tone: 'success' }
  );
  requestRender(options);
  return { archive: staged.archive, registry: staged.registry, files: staged.files };
}

export async function stageThemeUninstallWithRuntime(runtime, slug, options = {}) {
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
  applyThemeManagerSummary(runtime, staged.summary, staged.files);
  setStatus(runtime, `Uninstalled ${staged.entry.label}. Publish to delete the theme files.`, { tone: 'success' });
  requestRender(options);
  return { registry: staged.registry, files: staged.files };
}

export function stageSiteThemePack(runtime, value, label, options = {}) {
  const slug = sanitizeThemeSlug(value);
  clearPendingSiteThemeFallback(runtime);
  if (!setActiveSiteThemePack(runtime, slug)) return;
  setStatus(runtime, `Using ${label || slug}. Review and publish site.yaml.`, { tone: 'success' });
  notifyThemeManagerStateChange(runtime);
  requestRender(options);
}
