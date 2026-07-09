// Simple i18n helper for Press
// Usage & extension:
// - To change the default language, edit DEFAULT_LANG below (or set <html lang="xx"> in index.html; boot code passes that into initI18n).
// - To add a new UI language, create a file in assets/i18n (for example: assets/i18n/es.js) that mirrors en.js and
//   register it in assets/i18n/languages.json.
// - Content i18n supports a single unified YAML with per-language entries and default fallback.
//   Prefer using one `wwwroot/index.yaml` that stores, per post, a `default` block and optional language blocks
//   (e.g., `en`, `chs`, `ja`) describing `title` and `location`. Missing languages fall back to `default`.
// - Friendly language names come from assets/i18n/languages.json (or the language module's metadata).

import { parseFrontMatter } from './content.js';
import { isEncryptedMarkdown } from './encrypted-content.js';
import { getContentRoot } from './utils.js';
import { parseYAML } from './yaml.js';
import { getThemeRegion } from './theme-regions.js';
import { buildLanguageAvailability } from './language-availability.js';
import enTranslations, { languageMeta as enLanguageMeta } from '../i18n/en.js';

// Content fetch cache modes are normalized by cache-control.js.

// Default language fallback when no user/browser preference is available.
const DEFAULT_LANG = 'en';
const STORAGE_KEY = 'lang';
const FALLBACK_LANGUAGE_LABEL = (enLanguageMeta && enLanguageMeta.label) ? enLanguageMeta.label : 'English';

// Export the default language constant for use by other modules
export { DEFAULT_LANG };

// UI translation bundles are loaded dynamically from assets/i18n.
// Each language module should export a default object that mirrors en.js.
// Missing keys automatically fall back to the default language bundle.
function createI18nTranslations() {
  const bundles = {};
  bundles[DEFAULT_LANG] = cloneI18nBundle(enTranslations);
  return bundles;
}

function createI18nLanguageNames() {
  const names = {};
  names[DEFAULT_LANG] = FALLBACK_LANGUAGE_LABEL;
  return names;
}

function cloneI18nBundle(value) {
  if (Array.isArray(value)) return value.map(cloneI18nBundle);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((key) => {
      out[key] = cloneI18nBundle(value[key]);
    });
    return out;
  }
  return value;
}

async function fetchConfigWithYamlFallbackForRuntime(runtime, names) {
  const candidates = Array.isArray(names) ? names : [String(names || 'site.yaml')];
  for (const name of candidates) {
    try {
      const response = await runtime.getFetch()(name, { cache: 'no-store' });
      if (!response || !response.ok) continue;
      const lower = String(name || '').toLowerCase();
      if (lower.endsWith('.json')) return await response.json();
      if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
        const text = await response.text();
        try { return parseYAML(text); } catch (_) { /* try next */ }
      }
    } catch (_) { /* try next */ }
  }
  return {};
}

// Limit for concurrent front matter fetches when resolving simplified content entries.
// Set to a positive integer to chunk requests; falsy values disable the limit.
const FRONTMATTER_FETCH_BATCH_SIZE = 6;

export const POSTS_METADATA_READY_EVENT = 'ns:posts-metadata-ready';

function createI18nState() {
  return {
    baseDefaultLang: DEFAULT_LANG,
    translations: createI18nTranslations(),
    languageNames: createI18nLanguageNames(),
    languageManifest: [{ value: DEFAULT_LANG, label: FALLBACK_LANGUAGE_LABEL }],
    manifestLoadPromise: null,
    languageModuleUrls: new Map(),
    bundleLoadPromises: new Map(),
    manifestBaseUrl: null,
    frontMatterMetadataCache: new Map(),
    frontMatterPromiseCache: new Map(),
    frontMatterFetchQueue: [],
    frontMatterActiveFetches: 0,
    currentLang: DEFAULT_LANG,
    contentLangs: null
  };
}

function createI18nRuntime(options = {}) {
  const state = createI18nState();
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const navigatorRef = options.navigatorRef || null;
  const localStorageRef = options.localStorageRef || null;
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : null;

  const runtime = {
    state,
    getDocument() {
      return documentRef || (typeof document !== 'undefined' ? document : null);
    },
    getWindow() {
      return windowRef || (typeof window !== 'undefined' ? window : null);
    },
    getNavigator() {
      const win = runtime.getWindow();
      return navigatorRef || (win && win.navigator) || (typeof navigator !== 'undefined' ? navigator : null);
    },
    getLocalStorage() {
      const win = runtime.getWindow();
      return localStorageRef || (win && win.localStorage) || (typeof localStorage !== 'undefined' ? localStorage : null);
    },
    getFetch() {
      if (fetchImpl) return fetchImpl;
      if (typeof fetch === 'function') return fetch;
      throw new Error('I18n fetch is unavailable.');
    },
    createCustomEvent(type, options = {}) {
      const win = runtime.getWindow();
      const CustomEventCtor = (win && win.CustomEvent) || (typeof CustomEvent !== 'undefined' ? CustomEvent : null);
      if (typeof CustomEventCtor === 'function') return new CustomEventCtor(type, options);
      return { type, detail: options.detail };
    }
  };
  return runtime;
}

function interpretTruthyFlag(v) {
  if (v === true) return true;
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on' || s === 'enabled';
}

function normalizeMarkdownPath(path) {
  if (typeof path === 'string') return path.trim();
  return String(path || '').trim();
}

const INDEX_METADATA_KEYS = new Set([
  'location',
  'path',
  'title',
  'tag',
  'tags',
  'date',
  'image',
  'thumb',
  'cover',
  'excerpt',
  'readTime',
  'readMinutes',
  'minutes',
  'version',
  'versionLabel',
  'ai',
  'aiGenerated',
  'llm',
  'draft',
  'wip',
  'unfinished',
  'inprogress',
  'protected',
  'encryption',
  'versions'
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasIndexVariantMetadata(value) {
  if (!isPlainObject(value)) return false;
  return Object.keys(value).some((key) => INDEX_METADATA_KEYS.has(key) && key !== 'location' && key !== 'path' && key !== 'versions');
}

function hasCompleteIndexVariantMetadata(value) {
  if (!isPlainObject(value)) return false;
  const hasTitle = value.title != null && String(value.title).trim();
  const hasProtectionFlag = value.protected != null || value.encryption != null;
  const protectedValue = interpretTruthyFlag(value.protected) || !!value.encryption;
  const hasCardBody = value.excerpt != null || value.readTime != null || value.readMinutes != null || value.minutes != null;
  return !!hasTitle && hasProtectionFlag && (protectedValue || hasCardBody);
}

function resolveIndexImagePath(image, location) {
  const raw = String(image || '').trim();
  if (!raw) return undefined;
  if (/^(https?:|data:)/i.test(raw) || raw.startsWith('/')) return raw;
  if (!location || raw.includes('/')) return raw;
  const lastSlash = location.lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? location.slice(0, lastSlash + 1) : '';
  return (baseDir + raw).replace(/\\+/g, '/');
}

function normalizeIndexVariant(raw, fallbackTitle, sharedMeta = {}) {
  const source = isPlainObject(raw)
    ? { ...sharedMeta, ...raw }
    : { ...sharedMeta, location: raw };
  const location = normalizeMarkdownPath(source.location || source.path);
  if (!location) return null;
  const item = { location };
  const image = resolveIndexImagePath(source.image || source.cover || source.thumb, location);
  const tag = source.tags != null ? source.tags : source.tag;
  const versionLabel = source.versionLabel != null ? source.versionLabel : source.version;
  const readTime = Number(source.readTime != null ? source.readTime : (source.readMinutes != null ? source.readMinutes : source.minutes));
  if (image) item.image = image;
  if (tag != null) item.tag = tag;
  if (source.date != null && String(source.date).trim()) item.date = source.date;
  if (source.excerpt != null && String(source.excerpt).trim()) item.excerpt = source.excerpt;
  if (versionLabel != null && String(versionLabel).trim()) item.versionLabel = versionLabel;
  if (Number.isFinite(readTime) && readTime > 0) item.readTime = readTime;
  if (interpretTruthyFlag(source.ai || source.aiGenerated || source.llm)) item.ai = true;
  if (interpretTruthyFlag(source.draft || source.wip || source.unfinished || source.inprogress)) item.draft = true;
  if (source.protected != null || source.encryption != null) item.protected = interpretTruthyFlag(source.protected) || !!source.encryption;
  if (source.title != null && String(source.title).trim()) item.__title = String(source.title).trim();
  else if (fallbackTitle && hasIndexVariantMetadata(source)) item.__title = fallbackTitle;
  item.__indexMetadata = hasCompleteIndexVariantMetadata(source);
  return item;
}

function normalizeIndexVariantList(raw, fallbackTitle, sharedMeta = {}) {
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map(item => normalizeIndexVariant(item, fallbackTitle, sharedMeta))
    .filter(Boolean);
}

function isIndexVariantBucket(value) {
  if (typeof value === 'string') return !!normalizeMarkdownPath(value);
  if (Array.isArray(value)) {
    return value.every(item => (
      typeof item === 'string'
      || (isPlainObject(item) && (item.location != null || item.path != null))
    ));
  }
  return isPlainObject(value) && (value.location != null || value.path != null);
}

function isIndexContentEntry(value) {
  if (!isPlainObject(value)) return false;
  if (isIndexVariantBucket(value)) return true;
  return Object.keys(value).some((key) => {
    if (INDEX_METADATA_KEYS.has(key) && key !== 'default') return false;
    return isIndexVariantBucket(value[key]);
  });
}

function getSharedIndexMetadata(entry) {
  const out = {};
  if (!isPlainObject(entry)) return out;
  INDEX_METADATA_KEYS.forEach((key) => {
    if (key === 'location' || key === 'path' || key === 'versions') return;
    if (Object.prototype.hasOwnProperty.call(entry, key)) out[key] = entry[key];
  });
  return out;
}

function getIndexLanguageKeys(entry) {
  if (!isPlainObject(entry)) return [];
  return Object.keys(entry).filter((key) => {
    if (key === 'default') return isIndexVariantBucket(entry[key]);
    if (INDEX_METADATA_KEYS.has(key)) return false;
    return isIndexVariantBucket(entry[key]);
  });
}

function getFrontMatterConcurrencyLimit() {
  if (Number.isFinite(FRONTMATTER_FETCH_BATCH_SIZE) && FRONTMATTER_FETCH_BATCH_SIZE > 0) {
    return FRONTMATTER_FETCH_BATCH_SIZE;
  }
  return Infinity;
}

function assignDefinedMetadataField(out, key, value) {
  if (!out || value === undefined) return;
  out[key] = value;
}

function mergeDefinedMetadata(base, update) {
  const out = { ...(base || {}) };
  if (!update || typeof update !== 'object') return out;
  Object.keys(update).forEach((key) => {
    if (update[key] !== undefined) out[key] = update[key];
  });
  return out;
}

async function performFrontMatterFetch(runtime, markdownPath) {
  const path = normalizeMarkdownPath(markdownPath);
  if (!path) return { location: path };
  try {
    const url = `${getContentRoot()}/${path}`;
    const response = await runtime.getFetch()(url, { cache: 'no-store' });
    if (!response || !response.ok) {
      console.warn(`Failed to load content from ${path}: HTTP ${response ? response.status : 'unknown'}`);
      return { location: path };
    }
    const content = await response.text();
    const { frontMatter } = parseFrontMatter(content);
    const resolveImagePath = (img) => {
      const raw = String(img || '').trim();
      if (!raw) return undefined;
      if (/^(https?:|data:)/i.test(raw) || raw.startsWith('/')) return raw;
      const lastSlash = path.lastIndexOf('/');
      const baseDir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '';
      return (baseDir + raw).replace(/\\+/g, '/');
    };
    const fm = frontMatter || {};
    const isProtected = isEncryptedMarkdown(content) || interpretTruthyFlag(fm.protected);
    const meta = { location: path };
    assignDefinedMetadataField(meta, 'image', resolveImagePath(fm.image) || undefined);
    assignDefinedMetadataField(meta, 'tag', fm.tags || fm.tag || undefined);
    assignDefinedMetadataField(meta, 'date', fm.date || undefined);
    assignDefinedMetadataField(meta, 'excerpt', fm.excerpt || undefined);
    assignDefinedMetadataField(meta, 'versionLabel', fm.version || undefined);
    assignDefinedMetadataField(meta, 'ai', interpretTruthyFlag(fm.ai || fm.aiGenerated || fm.llm) || undefined);
    assignDefinedMetadataField(meta, 'draft', interpretTruthyFlag(fm.draft || fm.wip || fm.unfinished || fm.inprogress) || undefined);
    assignDefinedMetadataField(meta, 'protected', isProtected || undefined);
    assignDefinedMetadataField(meta, '__title', fm.title || undefined);
    return meta;
  } catch (error) {
    console.warn(`Failed to load content from ${path}:`, error);
    return { location: path };
  }
}

function processFrontMatterQueue(runtime) {
  const state = runtime.state;
  const limit = getFrontMatterConcurrencyLimit();
  while (state.frontMatterFetchQueue.length && state.frontMatterActiveFetches < limit) {
    const job = state.frontMatterFetchQueue.shift();
    if (!job || typeof job.resolve !== 'function') {
      continue;
    }
    const path = normalizeMarkdownPath(job.path);
    if (!path) {
      try { job.resolve({ location: path }); } catch (_) {}
      continue;
    }
    state.frontMatterActiveFetches += 1;
    performFrontMatterFetch(runtime, path)
      .then((meta) => {
        const data = meta && meta.location ? meta : { location: path };
        const stable = Object.freeze({ ...data });
        state.frontMatterMetadataCache.set(path, stable);
        try { job.resolve(stable); } catch (_) {}
      })
      .catch((err) => {
        console.warn(`Failed to load content from ${path}:`, err);
        const fallback = Object.freeze({ location: path });
        state.frontMatterMetadataCache.set(path, fallback);
        try { job.resolve(fallback); } catch (_) {}
      })
      .finally(() => {
        state.frontMatterActiveFetches = Math.max(0, state.frontMatterActiveFetches - 1);
        state.frontMatterPromiseCache.delete(path);
        processFrontMatterQueue(runtime);
      });
  }
}

function getFrontMatterMetadata(runtime, path) {
  const state = runtime.state;
  const normalized = normalizeMarkdownPath(path);
  if (!normalized) return Promise.resolve({ location: normalized });
  if (state.frontMatterMetadataCache.has(normalized)) {
    return Promise.resolve(state.frontMatterMetadataCache.get(normalized));
  }
  if (state.frontMatterPromiseCache.has(normalized)) {
    return state.frontMatterPromiseCache.get(normalized);
  }
  const promise = new Promise((resolve) => {
    state.frontMatterFetchQueue.push({ path: normalized, resolve });
    processFrontMatterQueue(runtime);
  });
  state.frontMatterPromiseCache.set(normalized, promise);
  return promise;
}

function emitBundleLoaded(runtime, lang) {
  const windowRef = runtime.getWindow();
  if (!windowRef || typeof windowRef.dispatchEvent !== 'function') return;
  try {
    windowRef.dispatchEvent(runtime.createCustomEvent('ns:i18n-bundle-loaded', { detail: { lang } }));
  } catch (_) { /* ignore */ }
}

function upsertManifestEntry(runtime, value, label, { preferFront = false } = {}) {
  const state = runtime.state;
  if (!value) return;
  const normalized = String(value).toLowerCase();
  const display = label || state.languageNames[normalized] || normalized;
  const idx = state.languageManifest.findIndex((item) => item && item.value === normalized);
  if (idx >= 0) {
    const existing = state.languageManifest[idx];
    if (!existing || existing.label !== display) {
      state.languageManifest[idx] = { value: normalized, label: display };
    }
  } else if (preferFront) {
    state.languageManifest.unshift({ value: normalized, label: display });
  } else {
    state.languageManifest.push({ value: normalized, label: display });
  }
}

async function loadLanguageBundle(runtime, langCode) {
  const state = runtime.state;
  const code = String(langCode || '').toLowerCase();
  if (!code) return null;
  if (state.translations[code]) return state.translations[code];
  if (state.bundleLoadPromises.has(code)) return state.bundleLoadPromises.get(code);
  if (state.manifestLoadPromise) await state.manifestLoadPromise;
  const moduleHref = state.languageModuleUrls.get(code);
  if (!moduleHref) {
    if (code === DEFAULT_LANG) return state.translations[DEFAULT_LANG] || null;
    // Attempt implicit fallback to ./<code>.js relative to manifest when not registered
    if (state.manifestBaseUrl) {
      try {
        const implicitUrl = new URL(`./${code}.js`, state.manifestBaseUrl);
        state.languageModuleUrls.set(code, implicitUrl.href);
        return loadLanguageBundle(runtime, code);
      } catch (_) {
        // ignore
      }
    }
    return null;
  }
  const loader = (async () => {
    try {
      const mod = await import(moduleHref);
      const bundle = (mod && typeof mod.default === 'object') ? mod.default : (mod && typeof mod.translations === 'object' ? mod.translations : null);
      if (!bundle) {
        console.warn(`[i18n] Language module ${moduleHref} did not export a translations object`);
        return null;
      }
      state.translations[code] = cloneI18nBundle(bundle);
      const metaLabel = state.languageNames[code] || mod.languageLabel || (mod.languageMeta && mod.languageMeta.label);
      if (metaLabel) state.languageNames[code] = metaLabel;
      upsertManifestEntry(runtime, code, state.languageNames[code]);
      emitBundleLoaded(runtime, code);
      return state.translations[code];
    } catch (err) {
      console.warn("[i18n] Failed to load language bundle for %s", code, err);
      return null;
    }
  })().finally(() => {
    state.bundleLoadPromises.delete(code);
  });
  state.bundleLoadPromises.set(code, loader);
  return loader;
}

async function ensureLanguageBundlesLoaded(runtime, langToEnsure) {
  const state = runtime.state;
  if (!state.manifestLoadPromise) {
    state.manifestLoadPromise = (async () => {
      const manifestUrl = new URL('../i18n/languages.json', import.meta.url);
      state.manifestBaseUrl = manifestUrl;
      let manifest = [];
      try {
        const resp = await runtime.getFetch()(manifestUrl, { cache: 'no-store' });
        if (resp && resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) manifest = data;
        }
      } catch (err) {
        console.warn('[i18n] Failed to load language manifest', err);
      }
      if (!manifest.length) {
        manifest = [{ value: DEFAULT_LANG, label: 'English', module: './en.js' }];
      }
      const seen = new Set();
      state.languageManifest = [];
      for (const entry of manifest) {
        if (!entry) continue;
        const value = String(entry.value || '').toLowerCase().trim();
        if (!value || seen.has(value)) continue;
        const modulePath = entry.module || `./${value}.js`;
        let moduleUrl = null;
        try {
          moduleUrl = new URL(modulePath, manifestUrl);
        } catch (err) {
          console.warn(`[i18n] Invalid module path for ${value}`, err);
          continue;
        }
        state.languageModuleUrls.set(value, moduleUrl.href);
        if (entry.label) state.languageNames[value] = entry.label;
        upsertManifestEntry(runtime, value, entry.label || value);
        seen.add(value);
      }
      if (!state.languageModuleUrls.has(DEFAULT_LANG)) {
        try {
          const fallbackUrl = new URL('./en.js', manifestUrl);
          state.languageModuleUrls.set(DEFAULT_LANG, fallbackUrl.href);
        } catch (err) {
          console.warn('[i18n] Unable to register fallback English bundle', err);
        }
      }
      if (!state.languageNames[DEFAULT_LANG]) state.languageNames[DEFAULT_LANG] = FALLBACK_LANGUAGE_LABEL;
      upsertManifestEntry(runtime, DEFAULT_LANG, state.languageNames[DEFAULT_LANG] || FALLBACK_LANGUAGE_LABEL || DEFAULT_LANG, { preferFront: true });
      state.languageManifest = state.languageManifest.reduce((acc, entry) => {
        if (!entry || !entry.value) return acc;
        if (acc.find((item) => item.value === entry.value)) return acc;
        acc.push(entry);
        return acc;
      }, []);
  })();
}
  await state.manifestLoadPromise;

  if (!state.translations[DEFAULT_LANG]) {
    await loadLanguageBundle(runtime, DEFAULT_LANG);
  }

  const target = String(langToEnsure || state.currentLang || DEFAULT_LANG).toLowerCase();
  if (target && !state.translations[target]) {
    await loadLanguageBundle(runtime, target);
  }

  return state.translations[target] || state.translations[DEFAULT_LANG] || null;
}

function detectLang(runtime) {
  const windowRef = runtime.getWindow();
  const storage = runtime.getLocalStorage();
  const navigatorRef = runtime.getNavigator();
  try {
    const url = new URL(windowRef && windowRef.location ? windowRef.location.href : '');
    const qp = (url.searchParams.get('lang') || '').trim();
    if (qp) return qp;
  } catch (_) {}
  try {
    const saved = storage && typeof storage.getItem === 'function' ? storage.getItem(STORAGE_KEY) : '';
    if (saved) return saved;
  } catch (_) {}
  const nav = navigatorRef ? (navigatorRef.language || navigatorRef.userLanguage || '') : '';
  return normalizeBrowserLanguage(nav) || DEFAULT_LANG;
}

function normalizeBrowserLanguage(raw) {
  const lower = String(raw || '').trim().toLowerCase();
  if (!lower) return '';
  const chineseBrowserPrefix = String.fromCharCode(122, 104);
  if (lower === chineseBrowserPrefix || lower.startsWith(`${chineseBrowserPrefix}-`)) {
    if (lower.includes('-hk') || lower.includes('-mo')) return 'cht-hk';
    if (lower.includes('-tw') || lower.includes('-hant')) return 'cht-tw';
    return 'chs';
  }
  return lower.slice(0, 2);
}

async function initI18nWithRuntime(runtime, opts = {}) {
  const state = runtime.state;
  const documentRef = runtime.getDocument();
  const storage = runtime.getLocalStorage();
  const desiredInput = (opts.lang || detectLang(runtime) || '').toLowerCase();
  const defaultInput = Object.prototype.hasOwnProperty.call(opts, 'defaultLang')
    ? opts.defaultLang
    : state.baseDefaultLang;
  const def = (defaultInput || DEFAULT_LANG).toLowerCase();
  const desired = desiredInput || def;
  await ensureLanguageBundlesLoaded(runtime, desired);
  state.currentLang = desiredInput || def;
  state.baseDefaultLang = def || DEFAULT_LANG;
  // If translation bundle missing, fall back to default bundle for UI
  if (!state.translations[state.currentLang]) state.currentLang = def;
  // Persist only when allowed (default: true). This enables callers to
  // perform a non-persistent bootstrap before site config is loaded.
  const shouldPersist = (opts && Object.prototype.hasOwnProperty.call(opts, 'persist')) ? !!opts.persist : true;
  if (shouldPersist) {
    try {
      if (storage && typeof storage.setItem === 'function') storage.setItem(STORAGE_KEY, state.currentLang);
    } catch (_) {}
  }
  // Reflect on <html lang>
  if (documentRef && documentRef.documentElement && typeof documentRef.documentElement.setAttribute === 'function') {
    documentRef.documentElement.setAttribute('lang', state.currentLang);
  }
  // Update a few static DOM bits (placeholders, site card)
  applyStaticTranslations(runtime);
  return state.currentLang;
}

function getCurrentLangWithRuntime(runtime) { return runtime.state.currentLang; }

async function ensureLanguageBundleWithRuntime(runtime, langCode) {
  const state = runtime.state;
  const code = String(langCode || '').toLowerCase();
  if (code) {
    await ensureLanguageBundlesLoaded(runtime, code);
    if (state.translations[code]) return state.translations[code];
  }
  await ensureLanguageBundlesLoaded(runtime, state.baseDefaultLang || DEFAULT_LANG);
  return state.translations[code] || state.translations[state.currentLang] || state.translations[DEFAULT_LANG] || null;
}

// Translate helper: fetches a nested value from the current language bundle,
// with graceful fallback to the default language.
function tWithRuntime(runtime, path, vars) {
  const state = runtime.state;
  const segs = String(path || '').split('.');
  const pick = (lang) => segs.reduce((o, k) => (o && o[k] != null ? o[k] : undefined), state.translations[lang] || {});
  let val = pick(state.currentLang);
  if (val == null) val = pick(DEFAULT_LANG);
  if (typeof val === 'function') return val(vars);
  return val != null ? String(val) : path;
}

// (language switcher helpers are defined near the end of the file)

// --- Content loading (unified YAML with language fallback) ---

const NORMALIZED_LANG_ALIASES = new Map([
  ['english', 'en'],
  ['en', 'en'],
  ['中文', 'chs'],
  ['简体中文', 'chs'],
  ['chs', 'chs'],
  ['繁體中文', 'cht-tw'],
  ['繁体中文', 'cht-tw'],
  ['正體中文', 'cht-tw'],
  ['正体中文', 'cht-tw'],
  ['台灣', 'cht-tw'],
  ['臺灣', 'cht-tw'],
  ['cht', 'cht-tw'],
  ['cht-tw', 'cht-tw'],
  ['繁體中文（香港）', 'cht-hk'],
  ['繁体中文（香港）', 'cht-hk'],
  ['香港', 'cht-hk'],
  ['香港繁體', 'cht-hk'],
  ['香港繁体', 'cht-hk'],
  ['粤语', 'cht-hk'],
  ['粵語', 'cht-hk'],
  ['廣東話', 'cht-hk'],
  ['廣州話', 'cht-hk'],
  ['香港話', 'cht-hk'],
  ['cht-hk', 'cht-hk'],
  ['日本語', 'ja'],
  ['にほんご', 'ja'],
  ['ja', 'ja'],
  ['jp', 'ja']
]);

// Normalize common language labels seen in content YAML to Press language codes.
export function normalizeLangKey(k) {
  const raw = String(k || '').trim();
  const lower = raw.toLowerCase();
  if (NORMALIZED_LANG_ALIASES.has(lower)) return NORMALIZED_LANG_ALIASES.get(lower);
  if (/^[a-z]{2,3}(?:-[a-z0-9]+)*$/i.test(raw)) return lower;
  return raw; // fallback to original
}

function addDefaultContentLang(runtime, langsSeen) {
  const state = runtime.state || {};
  const lang = normalizeLangKey(state.baseDefaultLang || 'en');
  if (lang && lang !== 'default') langsSeen.add(lang);
}

// Attempt to transform a unified content JSON object into a flat map
// for the current language with default fallback.
function transformUnifiedContent(runtime, obj, lang) {
  const state = runtime.state;
  const RESERVED = INDEX_METADATA_KEYS;
  const out = {};
  const langsSeen = new Set();
  for (const [key, val] of Object.entries(obj || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    // Collect language variants on this entry
    let chosen = null;
    let title = null;
    let location = null;
    // Gather variant keys excluding reserved
    const variantKeys = Object.keys(val).filter(k => !RESERVED.has(k));
    // Track langs available on this entry
    variantKeys.forEach(k => {
      const nk = normalizeLangKey(k);
      if (nk !== 'default') langsSeen.add(nk);
    });
    // Pick requested language, else default
    const tryPick = (lk) => {
      if (!lk) return null;
      const v = val[lk];
      if (v == null) return null;
      if (typeof v === 'string') return { title: null, location: v };
      if (typeof v === 'object') return { ...v, title: v.title || null, location: v.location || v.path || null };
      return null;
    };
    if (tryPick('default')) addDefaultContentLang(runtime, langsSeen);
    // Try requested lang, then site default, then common English code, then legacy 'default'
    const nlang = normalizeLangKey(lang);
    chosen = tryPick(nlang) || tryPick(state.baseDefaultLang) || tryPick('en') || tryPick('default');
    // If still not chosen, fall back to the first available variant (for single-language entries)
    if (!chosen && variantKeys.length) {
      for (const vk of variantKeys) {
        const pick = tryPick(normalizeLangKey(vk));
        if (pick) { chosen = pick; break; }
      }
    }
    // Fallback to legacy flat shape if not unified
    if (!chosen && 'location' in val) {
      chosen = { title: key, location: String(val.location || '') };
    }
    if (('location' in val || 'path' in val) && (val.location || val.path)) addDefaultContentLang(runtime, langsSeen);
    if (!chosen || !chosen.location) continue;
    title = chosen.title || key;
    location = chosen.location;
    const protectedValue = chosen && chosen.protected != null ? chosen.protected : val.protected;
    const meta = {
      location,
      image: resolveIndexImagePath((chosen && (chosen.image || chosen.cover || chosen.thumb)) || val.image || val.cover || val.thumb, location) || undefined,
      tag: chosen && (chosen.tag != null || chosen.tags != null)
        ? (chosen.tags != null ? chosen.tags : chosen.tag)
        : (val.tag != null ? val.tag : (val.tags != null ? val.tags : undefined)),
      date: (chosen && chosen.date) || val.date || undefined,
      // Prefer language-specific excerpt; fall back to top-level excerpt for legacy data
      excerpt: (chosen && chosen.excerpt) || val.excerpt || undefined,
      readTime: (chosen && chosen.readTime) || val.readTime || undefined,
      versionLabel: (chosen && (chosen.versionLabel || chosen.version)) || val.versionLabel || val.version || undefined,
      protected: interpretTruthyFlag(protectedValue) || undefined,
      title
    };
    out[title] = meta;
  }
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

// Load content metadata from simplified JSON and Markdown front matter
// Supports per-language single path (string) OR multiple versions (array of strings)
function buildEntryFromVariants(rawVariants, fallbackTitle) {
  if (!Array.isArray(rawVariants) || !rawVariants.length) return null;
  const variants = [];
  for (const variant of rawVariants) {
    if (!variant) continue;
    const location = normalizeMarkdownPath(variant.location);
    if (!location) continue;
    const item = {
      location,
      image: variant.image || undefined,
      tag: variant.tag || undefined,
      date: variant.date || undefined,
      excerpt: variant.excerpt || undefined,
      versionLabel: variant.versionLabel || undefined,
      readTime: variant.readTime || undefined,
      ai: variant.ai || undefined,
      draft: variant.draft || undefined,
      protected: variant.protected || undefined
    };
    if (variant.__title) item.__title = variant.__title;
    variants.push(item);
  }
  if (!variants.length) return null;
  const toTime = (d) => {
    const t = new Date(String(d || '')).getTime();
    return Number.isFinite(t) ? t : -Infinity;
  };
  variants.sort((a, b) => toTime(b.date) - toTime(a.date));
  const primary = variants[0];
  if (!primary || !primary.location) return null;
  const resolvedTitle = primary.__title || fallbackTitle;
  const { __title, __indexMetadata: _primaryMetadataIgnored, ...restPrimary } = primary;
  const meta = { ...restPrimary, title: resolvedTitle };
  meta.versions = variants.map((variant) => {
    const { __title: _ignored, __indexMetadata: _metadataIgnored, ...rest } = variant;
    return { ...rest };
  });
  return { title: resolvedTitle, meta };
}

async function loadContentFromFrontMatter(runtime, obj, lang) {
  const state = runtime.state;
  const out = {};
  const langsSeen = new Set();
  const nlang = normalizeLangKey(lang);
  const entries = Object.entries(obj || {});

  for (const [, val] of entries) {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      getIndexLanguageKeys(val).forEach(k => {
        const nk = normalizeLangKey(k);
        if (nk === 'default') addDefaultContentLang(runtime, langsSeen);
        else langsSeen.add(nk);
      });
      if (isIndexVariantBucket(val)) addDefaultContentLang(runtime, langsSeen);
    } else if (isIndexVariantBucket(val)) {
      addDefaultContentLang(runtime, langsSeen);
    }
  }

  const updatePromises = [];

  for (const [key, val] of entries) {
    if (val == null || Array.isArray(val)) continue;

    let chosenBucketKey = null;
    let raw = val;
    const sharedMeta = getSharedIndexMetadata(val);
    const languageKeys = getIndexLanguageKeys(val);
    if (val && typeof val === 'object') {
      if (val[nlang] != null && isIndexVariantBucket(val[nlang])) chosenBucketKey = nlang;
      else if (val[state.baseDefaultLang] != null && isIndexVariantBucket(val[state.baseDefaultLang])) chosenBucketKey = state.baseDefaultLang;
      else if (val['en'] != null && isIndexVariantBucket(val['en'])) chosenBucketKey = 'en';
      else if (val['default'] != null && isIndexVariantBucket(val['default'])) chosenBucketKey = 'default';
      if (!chosenBucketKey) {
        const firstKey = languageKeys[0];
        if (firstKey) chosenBucketKey = firstKey;
      }
      raw = chosenBucketKey ? val[chosenBucketKey] : val;
    }

    const declaredVariants = normalizeIndexVariantList(raw, key, sharedMeta);
    const normalizedPaths = declaredVariants.map(variant => variant.location).filter(Boolean);
    if (!normalizedPaths.length) continue;

    const variantSources = declaredVariants.map((variant) => {
      if (variant.__indexMetadata) return variant;
      const cached = state.frontMatterMetadataCache.get(variant.location);
      return cached ? mergeDefinedMetadata(variant, cached) : variant;
    });
    const placeholderEntry = buildEntryFromVariants(variantSources, key);
    if (!placeholderEntry) continue;

    out[placeholderEntry.title] = placeholderEntry.meta;

    const needsAsync = variantSources.some((variant) => !variant.__indexMetadata && !state.frontMatterMetadataCache.has(variant.location));
    if (!needsAsync) continue;

    const fetchPromises = variantSources.map((variant) =>
      variant.__indexMetadata
        ? Promise.resolve(variant)
        : getFrontMatterMetadata(runtime, variant.location).then(meta => mergeDefinedMetadata(variant, meta)).catch(() => variant)
    );

    const previousTitle = placeholderEntry.title;
    const enrichPromise = Promise.allSettled(fetchPromises).then((settled) => {
      const resolvedVariants = settled.map((result, idx) => {
        if (result.status === 'fulfilled' && result.value && result.value.location) {
          return result.value;
        }
        return variantSources[idx] || { location: normalizedPaths[idx] };
      });
      const finalEntry = buildEntryFromVariants(resolvedVariants, key);
      if (!finalEntry) return;
      const oldKey = previousTitle;
      const newKey = finalEntry.title;
      if (newKey !== oldKey && Object.prototype.hasOwnProperty.call(out, oldKey)) {
        delete out[oldKey];
      }
      out[newKey] = finalEntry.meta;
    }).catch((err) => {
      console.warn(`[i18n] Failed to enrich metadata for ${key}`, err);
    });
    updatePromises.push(enrichPromise);
  }

  if (updatePromises.length) {
    Promise.allSettled(updatePromises).then(() => {
      const windowRef = runtime.getWindow();
      if (!windowRef || typeof windowRef.dispatchEvent !== 'function') return;
      try {
        windowRef.dispatchEvent(runtime.createCustomEvent(POSTS_METADATA_READY_EVENT, {
          detail: {
            entries: out,
            lang: nlang
          }
        }));
      } catch (_) { /* ignore */ }
    });
  }

  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}


// Load unified YAML (`base.yaml`) or simplified content mappings. Legacy
// per-language sidecars are intentionally retired by the content-model clean release.
async function loadContentJsonWithRawWithRuntime(runtime, basePath, baseName) {
  // YAML only (unified or simplified)
  let raw = null;
  try {
    const obj = await fetchConfigWithYamlFallbackForRuntime(runtime, [
      `${basePath}/${baseName}.yaml`,
      `${basePath}/${baseName}.yml`
    ]);
    if (obj && typeof obj === 'object' && Object.keys(obj).length) {
      raw = obj;
      // Heuristic: if any entry contains a `default` or a non-reserved language-like key, treat as unified
      const keys = Object.keys(obj || {});
      let isUnified = false;
      let isSimplified = false;
      
      // Check if it's a simplified format (just path mappings) or unified format
      for (const k of keys) {
        const v = obj[k];
        if (isIndexVariantBucket(v)) {
          isSimplified = true;
          break;
        }
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          // Check for simplified/enriched format (language -> path or metadata mapping)
          const innerKeys = Object.keys(v);
          if (isIndexContentEntry(v)) {
            isSimplified = true;
            break;
          }
          
          // Check for unified format
          if ('default' in v) { isUnified = true; break; }
          if (innerKeys.some(ik => !INDEX_METADATA_KEYS.has(ik))) { isUnified = true; break; }
        }
      }
      
      if (isSimplified) {
        // Handle simplified format - load metadata from front matter
        const current = getCurrentLangWithRuntime(runtime);
        const { entries, availableLangs } = await loadContentFromFrontMatter(runtime, obj, current);
        setContentLangs(runtime, availableLangs);
        return { entries, raw };
      }
      
      if (isUnified) {
        const current = getCurrentLangWithRuntime(runtime);
        const { entries, availableLangs } = transformUnifiedContent(runtime, obj, current);
        // Record available content languages so the dropdown can reflect them
        setContentLangs(runtime, availableLangs);
        return { entries, raw };
      }
    }
  } catch (_) { /* return empty content */ }

  return { entries: {}, raw };
}

async function loadContentJsonWithRuntime(runtime, basePath, baseName) {
  const result = await loadContentJsonWithRawWithRuntime(runtime, basePath, baseName);
  return (result && result.entries) || {};
}

// Transform unified tabs YAML into a flat map: title -> { location }
function transformUnifiedTabs(runtime, obj, lang) {
  const state = runtime.state;
  const out = {};
  const langsSeen = new Set();
  for (const [key, val] of Object.entries(obj || {})) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const variantKeys = Object.keys(val);
    variantKeys.forEach(k => {
      const nk = normalizeLangKey(k);
      if (nk !== 'default') langsSeen.add(nk);
    });
    const tryPick = (lk) => {
      if (!lk) return null;
      const v = val[lk];
      if (v == null) return null;
      if (typeof v === 'string') return { title: null, location: v };
      if (typeof v === 'object') return { title: v.title || null, location: v.location || null };
      return null;
    };
    if (tryPick('default')) addDefaultContentLang(runtime, langsSeen);
    const nlang = normalizeLangKey(lang);
    let chosen = tryPick(nlang) || tryPick(state.baseDefaultLang) || tryPick('en') || tryPick('default');
    // If not found, fall back to the first available variant to ensure visibility
    if (!chosen && variantKeys.length) {
      for (const vk of variantKeys) {
        const pick = tryPick(normalizeLangKey(vk));
        if (pick) { chosen = pick; break; }
      }
    }
    if (!chosen && 'location' in val) chosen = { title: key, location: String(val.location || '') };
    if (('location' in val || 'path' in val) && (val.location || val.path)) addDefaultContentLang(runtime, langsSeen);
    if (!chosen || !chosen.location) continue;
    const title = chosen.title || key;
    // Provide a stable slug derived from the base key so it stays consistent across languages
    const stableSlug = String(key || '').toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || ('t-' + Math.abs(Array.from(String(key||'')).reduce((h,c)=>((h<<5)-h)+c.charCodeAt(0)|0,0)).toString(36));
    out[title] = { location: chosen.location, slug: stableSlug };
  }
  return { entries: out, availableLangs: Array.from(langsSeen).sort() };
}

function isFlatTabsEntry(value) {
  if (typeof value === 'string') return !!String(value).trim();
  return isPlainObject(value) && (value.location != null || value.path != null);
}

function transformFlatTabs(obj) {
  const out = {};
  for (const [title, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const location = value.trim();
      if (location) out[title] = location;
      continue;
    }
    if (isPlainObject(value)) {
      const location = value.location != null ? value.location : value.path;
      if (location == null || !String(location).trim()) continue;
      out[title] = {
        ...value,
        location: String(location).trim()
      };
      delete out[title].path;
    }
  }
  return out;
}

// Load unified tabs YAML and the supported base flat tabs shape. Legacy
// per-language sidecars are migrated by the transition editor release and are
// not read by the clean runtime.
async function loadTabsJsonWithRuntime(runtime, basePath, baseName) {
  try {
    const obj = await fetchConfigWithYamlFallbackForRuntime(runtime, [
      `${basePath}/${baseName}.yaml`,
      `${basePath}/${baseName}.yml`
    ]);
    if (obj && typeof obj === 'object') {
      let isUnified = false;
      for (const [k, v] of Object.entries(obj || {})) {
        if (isFlatTabsEntry(v)) continue;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if ('default' in v) { isUnified = true; break; }
          const inner = Object.keys(v);
          if (inner.some(ik => !['location'].includes(ik))) { isUnified = true; break; }
        }
      }
      if (isUnified) {
        const current = getCurrentLangWithRuntime(runtime);
        const { entries, availableLangs } = transformUnifiedTabs(runtime, obj, current);
        setContentLangs(runtime, availableLangs);
        return entries;
      }
      const entries = transformFlatTabs(obj);
      if (entries && Object.keys(entries).length) {
        setContentLangs(runtime, [normalizeLangKey(runtime.state.baseDefaultLang || 'en')]);
      }
      return entries;
    }
  } catch (_) { /* return empty tabs */ }
  return {};
}

// Ensure lang param is included when generating internal links
function withLangParamWithRuntime(runtime, urlStr) {
  const state = runtime.state;
  const windowRef = runtime.getWindow();
  try {
    const url = new URL(urlStr, windowRef && windowRef.location ? windowRef.location.href : undefined);
    url.searchParams.set('lang', state.currentLang);
    return url.search ? `${url.pathname}${url.search}` : url.pathname;
  } catch (_) {
    // Fallback: naive append
    const joiner = urlStr.includes('?') ? '&' : '?';
    return `${urlStr}${joiner}lang=${encodeURIComponent(state.currentLang)}`;
  }
}

// Update static DOM bits outside main render cycle (sidebar card, search placeholder)
function applyStaticTranslations(runtime) {
  const documentRef = runtime.getDocument();
  if (!documentRef) return;
  // Search placeholder
  const search = documentRef.querySelector && documentRef.querySelector('press-search');
  if (search && typeof search.setPlaceholder === 'function') {
    search.setPlaceholder(tWithRuntime(runtime, 'sidebar.searchPlaceholder'));
    return;
  }
  const searchRegion = getThemeRegion('search');
  const input = searchRegion && searchRegion.matches && searchRegion.matches('input')
    ? searchRegion
    : ((searchRegion && searchRegion.input) || (searchRegion && searchRegion.querySelector && searchRegion.querySelector('input[type="search"]')));
  if (input) input.setAttribute('placeholder', tWithRuntime(runtime, 'sidebar.searchPlaceholder'));
}

function setContentLangs(runtime, list) {
  const state = runtime.state;
  try {
    const add = Array.isArray(list) && list.length ? Array.from(new Set(list)) : [];
    if (!state.contentLangs || !state.contentLangs.length) {
      state.contentLangs = add.length ? add : null;
    } else if (add.length) {
      const s = new Set(state.contentLangs);
      add.forEach(x => s.add(x));
      state.contentLangs = Array.from(s);
    }
  } catch (_) { /* ignore */ }
}

function getAvailableLangsWithRuntime(runtime) {
  const state = runtime.state;
  // UI language choices come from the project language manifest. Content
  // languages are intentionally separate: an article may omit variants and
  // rely on the content fallback chain without hiding UI languages.
  const current = getCurrentLangWithRuntime(runtime);
  if (current && !state.translations[current]) {
    ensureLanguageBundleWithRuntime(runtime, current).catch(() => {});
  }
  if (state.languageManifest && state.languageManifest.length) return state.languageManifest.map((entry) => entry.value);
  return Object.keys(state.translations);
}

function getContentLangsWithRuntime(runtime) {
  const contentLangs = runtime.state.contentLangs;
  return contentLangs && contentLangs.length ? contentLangs.slice() : [];
}

function getPublicLangsWithRuntime(runtime, siteConfig = {}, options = {}) {
  const report = buildLanguageAvailability({
    siteConfig,
    uiLanguages: getAvailableLangsWithRuntime(runtime),
    contentLanguages: getContentLangsWithRuntime(runtime),
    indexState: options.indexState,
    tabsState: options.tabsState
  });
  return report.publicLanguages;
}

function getPublicLanguageOptionsWithRuntime(runtime, siteConfig = {}, options = {}) {
  return getPublicLangsWithRuntime(runtime, siteConfig, options).map((code) => ({
    value: code,
    label: getLanguageLabelWithRuntime(runtime, code)
  }));
}

function getLanguageLabelWithRuntime(runtime, code) {
  const state = runtime.state;
  const normalized = String(code || '').toLowerCase();
  if (state.languageNames[normalized]) return state.languageNames[normalized];
  const entry = (state.languageManifest || []).find((item) => item.value === normalized);
  if (entry && entry.label) return entry.label;
  return code;
}

// Programmatic language switching used by the sidebar dropdown
function switchLanguageWithRuntime(runtime, langCode) {
  const documentRef = runtime.getDocument();
  const windowRef = runtime.getWindow();
  const storage = runtime.getLocalStorage();
  const code = String(langCode || '').toLowerCase();
  if (!code) return;
  try {
    if (storage && typeof storage.setItem === 'function') storage.setItem(STORAGE_KEY, code);
  } catch (_) {}
  if (documentRef && documentRef.documentElement && typeof documentRef.documentElement.setAttribute === 'function') {
    documentRef.documentElement.setAttribute('lang', code);
  }
  if (!windowRef || !windowRef.location) return;
  try {
    const url = new URL(windowRef.location.href);
    url.searchParams.set('lang', code);
    windowRef.location.assign(url.toString());
  } catch (_) {
    const joiner = windowRef.location.search ? '&' : '?';
    windowRef.location.assign(windowRef.location.pathname + windowRef.location.search + `${joiner}lang=${encodeURIComponent(code)}`);
  }
}

export function createI18nController(options = {}) {
  const runtime = createI18nRuntime(options);
  return {
    init(initOptions = {}) {
      return initI18nWithRuntime(runtime, initOptions);
    },
    getCurrentLang() {
      return getCurrentLangWithRuntime(runtime);
    },
    ensureLanguageBundle(langCode) {
      return ensureLanguageBundleWithRuntime(runtime, langCode);
    },
    t(path, vars) {
      return tWithRuntime(runtime, path, vars);
    },
    loadContentJsonWithRaw(basePath, baseName) {
      return loadContentJsonWithRawWithRuntime(runtime, basePath, baseName);
    },
    loadContentJson(basePath, baseName) {
      return loadContentJsonWithRuntime(runtime, basePath, baseName);
    },
    loadTabsJson(basePath, baseName) {
      return loadTabsJsonWithRuntime(runtime, basePath, baseName);
    },
    withLangParam(urlStr) {
      return withLangParamWithRuntime(runtime, urlStr);
    },
    getAvailableLangs() {
      return getAvailableLangsWithRuntime(runtime);
    },
    getContentLangs() {
      return getContentLangsWithRuntime(runtime);
    },
    getPublicLangs(siteConfig = {}, options = {}) {
      return getPublicLangsWithRuntime(runtime, siteConfig, options);
    },
    getPublicLanguageOptions(siteConfig = {}, options = {}) {
      return getPublicLanguageOptionsWithRuntime(runtime, siteConfig, options);
    },
    getLanguageLabel(code) {
      return getLanguageLabelWithRuntime(runtime, code);
    },
    switchLanguage(langCode) {
      return switchLanguageWithRuntime(runtime, langCode);
    },
    getTranslations() {
      return runtime.state.translations;
    }
  };
}

const defaultI18nController = createI18nController();

// Expose default-controller translations for testing/customization.
export const __translations = defaultI18nController.getTranslations();

export function initI18n(opts = {}) {
  return defaultI18nController.init(opts);
}

export function getCurrentLang() {
  return defaultI18nController.getCurrentLang();
}

export function ensureLanguageBundle(langCode) {
  return defaultI18nController.ensureLanguageBundle(langCode);
}

export function t(path, vars) {
  return defaultI18nController.t(path, vars);
}

export function loadContentJsonWithRaw(basePath, baseName) {
  return defaultI18nController.loadContentJsonWithRaw(basePath, baseName);
}

export function loadContentJson(basePath, baseName) {
  return defaultI18nController.loadContentJson(basePath, baseName);
}

export function loadTabsJson(basePath, baseName) {
  return defaultI18nController.loadTabsJson(basePath, baseName);
}

export function withLangParam(urlStr) {
  return defaultI18nController.withLangParam(urlStr);
}

export function getAvailableLangs() {
  return defaultI18nController.getAvailableLangs();
}

export function getContentLangs() {
  return defaultI18nController.getContentLangs();
}

export function getPublicLangs(siteConfig = {}, options = {}) {
  return defaultI18nController.getPublicLangs(siteConfig, options);
}

export function getPublicLanguageOptions(siteConfig = {}, options = {}) {
  return defaultI18nController.getPublicLanguageOptions(siteConfig, options);
}

export function getLanguageLabel(code) {
  return defaultI18nController.getLanguageLabel(code);
}

export function switchLanguage(langCode) {
  return defaultI18nController.switchLanguage(langCode);
}
