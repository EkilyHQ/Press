function asFunction(value) {
  return typeof value === 'function' ? value : null;
}

function boolFrom(fn, fallback = true) {
  try {
    return fn ? fn() !== false : fallback;
  } catch (_) {
    return fallback;
  }
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function appendParam(parts, key, value) {
  const clean = text(value);
  if (!clean) return;
  parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(clean)}`);
}

function appendNumericParam(parts, key, value) {
  if (value == null || value === '') return;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return;
  parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(Math.floor(number))}`);
}

function buildHref(base, parts) {
  return parts.length ? `${base}&${parts.join('&')}` : base;
}

export function createThemeRouterHrefHelpers(options = {}) {
  const withLangParam = asFunction(options.withLangParam) || ((href) => href);
  const getHomeSlug = asFunction(options.getHomeSlug) || (() => '');
  const postsEnabled = asFunction(options.postsEnabled) || (() => true);
  const searchEnabled = asFunction(options.searchEnabled) || (() => true);
  const tagsEnabled = asFunction(options.tagsEnabled) || (() => true);

  const applyLanguage = (href) => {
    const value = text(href);
    if (!value) return null;
    try { return withLangParam(value); } catch (_) { return value; }
  };

  const helpers = {
    getTabHref(slug, params = {}) {
      const cleanSlug = text(slug);
      if (!cleanSlug) return null;
      if (cleanSlug === 'posts') return helpers.getPostsHref(params);
      if (cleanSlug === 'search') return helpers.getSearchHref(params);
      return applyLanguage(`?tab=${encodeURIComponent(cleanSlug)}`);
    },
    getPostHref(location) {
      const cleanLocation = text(location);
      return cleanLocation ? applyLanguage(`?id=${encodeURIComponent(cleanLocation)}`) : null;
    },
    getPostsHref(params = {}) {
      if (!boolFrom(postsEnabled, true)) return null;
      const parts = [];
      appendNumericParam(parts, 'page', params && params.page);
      return applyLanguage(buildHref('?tab=posts', parts));
    },
    getSearchHref(params = {}) {
      if (!boolFrom(searchEnabled, true)) return null;
      const source = params && typeof params === 'object' ? params : {};
      const parts = [];
      appendParam(parts, 'q', source.q != null ? source.q : source.query);
      if (boolFrom(tagsEnabled, true)) appendParam(parts, 'tag', source.tag != null ? source.tag : source.tagFilter);
      appendNumericParam(parts, 'page', source.page);
      return applyLanguage(buildHref('?tab=search', parts));
    },
    getHomeHref() {
      return helpers.getTabHref(getHomeSlug());
    }
  };

  return helpers;
}
