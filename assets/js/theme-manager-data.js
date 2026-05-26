import { loadProductState } from './product-state.js';
import { PRESS_GITHUB_PROVIDER } from './provider-adapters.js';
import {
  normalizeThemeCatalog,
  normalizeThemeRegistry
} from './theme-package-core.js';

export const OFFICIAL_THEME_CATALOG_URL = PRESS_GITHUB_PROVIDER.themeCatalogUrl;

const NATIVE_THEME_REGISTRY_FALLBACK = Object.freeze([
  Object.freeze({
    value: 'native',
    label: 'Native',
    builtIn: true,
    removable: false,
    source: Object.freeze({ type: 'builtin' }),
    files: Object.freeze([])
  })
]);

export async function loadThemeManagerRegistry(runtime, options = {}) {
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
    data = NATIVE_THEME_REGISTRY_FALLBACK;
  }
  state.registryCache = normalizeThemeRegistry(data);
  return state.registryCache.slice();
}

export function getThemeManagerOfficialCatalogStatus(runtime) {
  return { error: runtime.state.catalogLoadError };
}

export async function loadThemeManagerOfficialCatalog(runtime, options = {}) {
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

export function getThemeManagerProductStateStatus(runtime) {
  const { productStateCache, productStateLoadError } = runtime.state;
  return {
    status: productStateCache ? productStateCache.status : '',
    error: productStateLoadError
  };
}

export async function loadThemeManagerProductState(runtime, options = {}) {
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
