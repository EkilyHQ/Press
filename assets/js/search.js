import { getThemeRegion } from './theme-regions.js';

const SEARCH_BOUND = Symbol('pressSearchBound');
const SEARCH_EVENTS_BOUND = Symbol('pressSearchEventsBound');

function markSearchEventsBound(root) {
  try {
    if (root[SEARCH_EVENTS_BOUND]) return false;
    root[SEARCH_EVENTS_BOUND] = true;
    return true;
  } catch (_) {
    return false;
  }
}

function searchFeatureEnabled(options = {}) {
  try {
    if (typeof options.isSearchEnabled === 'function') return options.isSearchEnabled() !== false;
  } catch (_) {}
  return true;
}

function resolveHomeSlug(options = {}) {
  try {
    if (typeof options.getHomeSlug === 'function') {
      const slug = String(options.getHomeSlug() || '').trim();
      if (slug) return slug;
    }
  } catch (_) {}
  try {
    if (typeof window.__press_get_home_slug === 'function') {
      const slug = String(window.__press_get_home_slug() || '').trim();
      if (slug) return slug;
    }
  } catch (_) {}
  return 'posts';
}

function navigateHome(options = {}) {
  const homeSlug = resolveHomeSlug(options);
  const url = new URL(window.location.href);
  url.searchParams.delete('q');
  url.searchParams.delete('tag');
  url.searchParams.delete('id');
  url.searchParams.delete('page');
  if (homeSlug) url.searchParams.set('tab', homeSlug);
  else url.searchParams.delete('tab');
  history.pushState({}, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function navigateSearch(query, options = {}) {
  if (!searchFeatureEnabled(options)) {
    navigateHome(options);
    return;
  }
  const q = String(query || '').trim();
  const url = new URL(window.location.href);
  if (q) {
    url.searchParams.set('tab', 'search');
    url.searchParams.set('q', q);
    url.searchParams.delete('tag');
    url.searchParams.delete('id');
    url.searchParams.delete('page');
  } else {
    navigateHome(options);
    return;
  }
  history.pushState({}, '', url.toString());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function bindSearchEvents(root = document, options = {}) {
  if (!searchFeatureEnabled(options)) return;
  if (!root || typeof root.addEventListener !== 'function' || !markSearchEventsBound(root)) return;
  root.addEventListener('press:search', (event) => {
    const detail = event && event.detail ? event.detail : {};
    navigateSearch(detail.query || '', options);
  });
}

export function setupSearch(options = {}) {
  if (!searchFeatureEnabled(options)) return false;
  bindSearchEvents(document, options);

  const search = getThemeRegion('search');
  const input = search && search.matches && search.matches('input')
    ? search
    : ((search && search.input) || (search && search.querySelector && search.querySelector('input[type="search"]')));
  if (!input || input.closest('press-search') || input[SEARCH_BOUND]) return;
  input[SEARCH_BOUND] = true;
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') navigateSearch(input.value, options);
  });
  return true;
}
