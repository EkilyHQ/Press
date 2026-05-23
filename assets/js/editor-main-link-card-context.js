const RESERVED_INDEX_KEYS = new Set(['tag', 'tags', 'image', 'date', 'excerpt', 'thumb', 'cover']);

const fallbackNormalizeLangKey = (value) => String(value || '').trim().toLowerCase() || 'en';
const fallbackGetCurrentLang = () => 'en';
const fallbackGetContentRoot = () => 'wwwroot';
const fallbackMakeHref = (loc) => `?id=${encodeURIComponent(loc)}`;
const noopTranslate = (key) => key;

function uniqueStrings(values) {
  const seen = new Set();
  const output = [];
  (values || []).forEach((value) => {
    const text = value == null ? '' : String(value);
    if (!text || seen.has(text)) return;
    seen.add(text);
    output.push(text);
  });
  return output;
}

function collectAllowedLocations(posts, rawIndex) {
  const allowed = new Set();
  if (posts && typeof posts === 'object') {
    Object.values(posts).forEach((meta) => {
      if (!meta) return;
      if (meta.location) allowed.add(String(meta.location));
      if (Array.isArray(meta.versions)) {
        meta.versions.forEach((version) => {
          if (version && version.location) allowed.add(String(version.location));
        });
      }
    });
  }
  if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
    Object.values(rawIndex).forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      Object.entries(entry).forEach(([key, value]) => {
        if (RESERVED_INDEX_KEYS.has(key)) return;
        if (key === 'location' && typeof value === 'string') {
          allowed.add(String(value));
          return;
        }
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (typeof item === 'string') allowed.add(String(item));
            else if (item && typeof item === 'object' && typeof item.location === 'string') allowed.add(String(item.location));
          });
          return;
        }
        if (value && typeof value === 'object' && typeof value.location === 'string') {
          allowed.add(String(value.location));
          return;
        }
        if (typeof value === 'string') allowed.add(String(value));
      });
    });
  }
  return allowed;
}

function indexPostsByLocation(posts) {
  const byLocation = {};
  Object.entries(posts || {}).forEach(([title, meta]) => {
    if (!meta) return;
    if (meta.location) byLocation[String(meta.location)] = title;
    if (Array.isArray(meta.versions)) {
      meta.versions.forEach((version) => {
        if (version && version.location) byLocation[String(version.location)] = title;
      });
    }
  });
  return byLocation;
}

function collectIndexVariants(entry, normalizeLangKey) {
  const variants = [];
  Object.entries(entry || {}).forEach(([key, value]) => {
    if (RESERVED_INDEX_KEYS.has(key)) return;
    if (key === 'location' && typeof value === 'string') {
      variants.push({ lang: 'default', location: String(value) });
      return;
    }
    const normalizedLang = normalizeLangKey(key);
    if (typeof value === 'string') {
      variants.push({ lang: normalizedLang, location: String(value) });
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') variants.push({ lang: normalizedLang, location: String(item) });
        else if (item && typeof item === 'object' && typeof item.location === 'string') variants.push({ lang: normalizedLang, location: String(item.location) });
      });
    } else if (value && typeof value === 'object' && typeof value.location === 'string') {
      variants.push({ lang: normalizedLang, location: String(value.location) });
    }
  });
  return variants;
}

function buildPickerState(posts, rawIndex, options) {
  const normalizeLangKey = options.normalizeLangKey || fallbackNormalizeLangKey;
  const currentLang = normalizeLangKey((options.getCurrentLang && options.getCurrentLang()) || 'en');
  const byLocation = indexPostsByLocation(posts);
  const alias = new Map();
  const pickerEntries = new Map();

  if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
    Object.entries(rawIndex).forEach(([entryKey, entry]) => {
      if (!entry || typeof entry !== 'object') return;
      const variants = collectIndexVariants(entry, normalizeLangKey);
      if (!variants.length) return;

      const findBy = (langs) => variants.find((variant) => langs.includes(variant.lang));
      const preferred = findBy([currentLang]) || findBy(['en']) || findBy(['default']) || variants[0];
      let canonical = null;
      if (preferred) {
        const refTitle = byLocation[preferred.location];
        const refMeta = refTitle ? posts[refTitle] : null;
        if (refMeta && refMeta.location) canonical = String(refMeta.location);
      }
      if (!canonical && preferred) canonical = preferred.location;
      if (!canonical && variants[0]) canonical = variants[0].location;
      if (!canonical) return;

      variants.forEach((variant) => {
        if (variant.location && variant.location !== canonical) alias.set(variant.location, canonical);
      });

      const displayTitle = byLocation[canonical] || entry.title || entryKey;
      pickerEntries.set(canonical, {
        key: entryKey,
        title: displayTitle || entryKey,
        location: canonical,
        aliases: uniqueStrings(variants.map((variant) => variant.location).filter((loc) => loc && loc !== canonical))
      });
    });
  }

  const entries = Array.from(pickerEntries.values()).map((item) => {
    const tokens = new Set();
    if (item.key) tokens.add(String(item.key));
    if (item.title) tokens.add(String(item.title));
    if (item.location) tokens.add(String(item.location));
    (item.aliases || []).forEach((loc) => {
      if (loc) tokens.add(String(loc));
    });
    return {
      key: item.key,
      title: item.title,
      location: item.location,
      aliases: item.aliases || [],
      search: Array.from(tokens).map((token) => token.toLowerCase()).join(' ')
    };
  }).sort((a, b) => {
    const titleA = (a.title || '').toLowerCase();
    const titleB = (b.title || '').toLowerCase();
    if (titleA === titleB) return (a.key || '').localeCompare(b.key || '');
    return titleA.localeCompare(titleB);
  });

  return { byLocation, alias, entries };
}

export function createEditorMainLinkCardContext(options = {}) {
  const normalizeLangKey = typeof options.normalizeLangKey === 'function' ? options.normalizeLangKey : fallbackNormalizeLangKey;
  const getCurrentLang = typeof options.getCurrentLang === 'function' ? options.getCurrentLang : fallbackGetCurrentLang;
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : fallbackGetContentRoot;
  const fetchRef = typeof options.fetch === 'function' ? options.fetch : null;
  const makeHref = typeof options.makeHref === 'function' ? options.makeHref : fallbackMakeHref;
  const translate = typeof options.translate === 'function' ? options.translate : noopTranslate;
  const listeners = new Set();

  let allowedLocations = new Set();
  let postsByLocationTitle = {};
  let locationAliasMap = new Map();
  let postsIndexCache = {};
  let cardEntries = [];
  let ready = false;

  const getCardEntries = () => cardEntries.map((entry) => ({
    ...entry,
    aliases: Array.isArray(entry.aliases) ? [...entry.aliases] : []
  }));

  const notifyCardEntries = () => {
    const entries = getCardEntries();
    listeners.forEach((listener) => {
      try { listener(entries); }
      catch (_) { /* noop */ }
    });
  };

  const fetchMarkdown = (loc) => {
    if (!loc || !fetchRef) return Promise.resolve('');
    try {
      const url = `${getContentRoot()}/${loc}`;
      return Promise.resolve(fetchRef(url, { cache: 'no-store' }))
        .then((response) => (response && response.ok) ? response.text() : '')
        .catch(() => '');
    } catch (_) {
      return Promise.resolve('');
    }
  };

  const rebuild = (posts, rawIndex) => {
    try {
      const nextPosts = posts || {};
      const nextAllowedLocations = collectAllowedLocations(nextPosts, rawIndex);
      const pickerState = buildPickerState(nextPosts, rawIndex, {
        normalizeLangKey,
        getCurrentLang
      });

      allowedLocations = nextAllowedLocations;
      postsByLocationTitle = pickerState.byLocation;
      locationAliasMap = pickerState.alias;
      postsIndexCache = nextPosts;
      cardEntries = pickerState.entries;
      ready = true;
      notifyCardEntries();
      return getSnapshot();
    } catch (_) {
      allowedLocations = allowedLocations || new Set();
      return getSnapshot();
    }
  };

  const getSnapshot = () => ({
    ready,
    allowedLocations,
    locationAliasMap,
    postsByLocationTitle,
    postsIndexCache,
    cardEntries: getCardEntries()
  });

  const createHydrateOptions = (overrides = {}) => {
    const active = ready;
    return {
      allowedLocations: active ? allowedLocations : null,
      locationAliasMap: active ? locationAliasMap : new Map(),
      postsByLocationTitle: active ? postsByLocationTitle : {},
      postsIndexCache: active ? postsIndexCache : {},
      siteConfig: overrides.siteConfig || {},
      fetchMarkdown,
      translate: typeof overrides.translate === 'function' ? overrides.translate : translate,
      makeHref: typeof overrides.makeHref === 'function' ? overrides.makeHref : makeHref
    };
  };

  return {
    rebuild,
    fetchMarkdown,
    createHydrateOptions,
    onCardEntriesChange(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    getSnapshot,
    getCardEntries,
    isReady: () => ready,
    getAllowedLocations: () => allowedLocations,
    getLocationAliases: () => locationAliasMap,
    getPostsByLocationTitle: () => postsByLocationTitle,
    getPostsIndex: () => postsIndexCache
  };
}
