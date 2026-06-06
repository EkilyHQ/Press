import { parseYAML } from './yaml.js';

export const CONTENT_MODEL_MIGRATION_STATE_KEY = '__contentModelMigration';
export const CONTENT_MODEL_MIGRATION_KIND = 'content-model-migration';

const DEFAULT_CONTENT_LANGUAGES = ['en', 'chs', 'cht-tw', 'cht-hk', 'ja'];
const LEGACY_CONTENT_BASES = ['index', 'tabs'];
const LEGACY_CONTENT_EXTENSIONS = ['yaml', 'yml'];
const LANGUAGE_MANIFEST_PATH = 'assets/i18n/languages.json';
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
  'versions',
  'summary'
]);

function safeString(value) {
  return value == null ? '' : String(value);
}

function deepClone(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_) {}
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return value; }
}

export function normalizeContentRoot(value) {
  const root = safeString(value || 'wwwroot')
    .replace(/[\\]/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/');
  return root || 'wwwroot';
}

function normalizeLanguageCode(value) {
  return safeString(value).trim().toLowerCase();
}

export function getLegacyContentLanguageCandidates(options = {}) {
  const provided = Array.isArray(options.languages) ? options.languages : [];
  const registered = Array.isArray(options.registeredLanguages) ? options.registeredLanguages : [];
  const values = [
    options.defaultLang || 'en',
    options.currentLang,
    ...DEFAULT_CONTENT_LANGUAGES,
    ...registered,
    ...provided
  ];
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const normalized = normalizeLanguageCode(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

async function loadRegisteredLanguages(fetchImpl, manifestPath = LANGUAGE_MANIFEST_PATH) {
  if (typeof fetchImpl !== 'function') return [];
  try {
    const response = await fetchImpl(manifestPath, { cache: 'no-store' });
    if (!response || !response.ok) return [];
    let data = null;
    if (typeof response.json === 'function') {
      try { data = await response.json(); }
      catch (_) { data = null; }
    }
    if (!data && typeof response.text === 'function') {
      try { data = JSON.parse(await response.text()); }
      catch (_) { data = null; }
    }
    if (!Array.isArray(data)) return [];
    return data
      .map(entry => normalizeLanguageCode(entry && (entry.value || entry.code || entry.lang || entry.language)))
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

export function listLegacyContentModelPaths(options = {}) {
  const root = normalizeContentRoot(options.contentRoot);
  const languages = getLegacyContentLanguageCandidates(options);
  const paths = [];
  for (const base of LEGACY_CONTENT_BASES) {
    for (const lang of languages) {
      for (const ext of LEGACY_CONTENT_EXTENSIONS) {
        paths.push({
          base,
          lang,
          path: `${root}/${base}.${lang}.${ext}`
        });
      }
    }
  }
  return paths;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isIndexVariantBucket(value) {
  if (typeof value === 'string') return !!value.trim();
  if (Array.isArray(value)) {
    return value.every(item => (
      typeof item === 'string'
      || (isPlainObject(item) && (item.location != null || item.path != null))
    ));
  }
  return isPlainObject(value) && (value.location != null || value.path != null);
}

function isUnifiedIndexEntry(value, languageSet) {
  if (!isPlainObject(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'default')) return true;
  if (isIndexVariantBucket(value)) return false;
  return Object.keys(value).some((key) => {
    if (INDEX_METADATA_KEYS.has(key)) return false;
    return languageSet.has(normalizeLanguageCode(key)) || isIndexVariantBucket(value[key]);
  });
}

function isUnifiedTabsEntry(value, languageSet) {
  if (!isPlainObject(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'default')) return true;
  if (Object.prototype.hasOwnProperty.call(value, 'location') || Object.prototype.hasOwnProperty.call(value, 'path')) return false;
  return Object.keys(value).some(key => languageSet.has(normalizeLanguageCode(key)));
}

function normalizeIndexDefaultValue(key, value) {
  if (isPlainObject(value) && value.title == null && key) {
    return { title: key, ...deepClone(value) };
  }
  return deepClone(value);
}

function normalizeTabsDefaultValue(key, value) {
  return normalizeLegacyTabsValue(key, value);
}

function cloneRawConfig(raw, options = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { __order: [] };
  const base = options.base === 'tabs' ? 'tabs' : 'index';
  const defaultLang = normalizeLanguageCode(options.defaultLang || 'en') || 'en';
  const languageSet = new Set(getLegacyContentLanguageCandidates(options));
  const cloned = deepClone(raw) || {};
  if (!Array.isArray(cloned.__order)) {
    cloned.__order = Object.keys(cloned).filter(key => key !== '__order');
  }
  Object.keys(cloned).forEach((key) => {
    if (key === '__order') return;
    const value = cloned[key];
    if (base === 'tabs') {
      if (!isUnifiedTabsEntry(value, languageSet)) {
        cloned[key] = { [defaultLang]: normalizeTabsDefaultValue(key, value) };
      }
      return;
    }
    if (!isUnifiedIndexEntry(value, languageSet)) {
      cloned[key] = { [defaultLang]: normalizeIndexDefaultValue(key, value) };
    }
  });
  return cloned;
}

function addOrderedKey(raw, key) {
  if (!key) return;
  if (!Array.isArray(raw.__order)) raw.__order = [];
  if (!raw.__order.includes(key)) raw.__order.push(key);
}

function orderedLegacyEntries(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const order = Array.isArray(parsed.__order) ? parsed.__order.filter(key => typeof key === 'string' && key) : [];
  const seen = new Set();
  const keys = [];
  order.forEach((key) => {
    if (key === '__order' || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  });
  Object.keys(parsed).forEach((key) => {
    if (key === '__order' || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  });
  return keys.map(key => [key, parsed[key]]);
}

function ensureUnifiedEntry(raw, key) {
  if (!raw[key] || typeof raw[key] !== 'object' || Array.isArray(raw[key])) raw[key] = {};
  addOrderedKey(raw, key);
  return raw[key];
}

function getIndexValueLocation(value) {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const location = getIndexValueLocation(item);
      if (location) return location;
    }
    return '';
  }
  if (isPlainObject(value)) return safeString(value.location != null ? value.location : value.path).trim();
  return '';
}

function getTabsValueLocation(value) {
  if (typeof value === 'string') return value.trim();
  if (isPlainObject(value)) return safeString(value.location != null ? value.location : value.path).trim();
  return '';
}

function findExistingKeyByLocation(raw, location, getLocation) {
  const target = safeString(location).trim();
  if (!target) return '';
  const orderedKeys = Array.isArray(raw.__order) ? raw.__order : [];
  for (const key of orderedKeys) {
    if (key === '__order' || !raw[key] || typeof raw[key] !== 'object') continue;
    for (const value of Object.values(raw[key])) {
      if (getLocation(value) === target) return key;
    }
  }
  return '';
}

function findExistingKeyByPosition(raw, position) {
  const orderedKeys = Array.isArray(raw.__order) ? raw.__order.filter(key => key && key !== '__order') : [];
  return orderedKeys[position] || '';
}

function chooseMergeKey(raw, key, value, position, getLocation) {
  if (raw[key] && typeof raw[key] === 'object' && !Array.isArray(raw[key])) return key;
  return findExistingKeyByLocation(raw, getLocation(value), getLocation)
    || findExistingKeyByPosition(raw, position)
    || key;
}

function normalizeLegacyIndexValue(stableKey, sourceKey, value) {
  if (isPlainObject(value)) {
    const out = deepClone(value) || {};
    if (sourceKey !== stableKey && out.title == null) out.title = sourceKey;
    return out;
  }
  if (sourceKey !== stableKey) {
    return {
      title: sourceKey,
      location: safeString(value)
    };
  }
  return deepClone(value);
}

function mergeLegacyIndex(raw, lang, parsed) {
  orderedLegacyEntries(parsed).forEach(([key, value], position) => {
    const stableKey = chooseMergeKey(raw, key, value, position, getIndexValueLocation);
    const entry = ensureUnifiedEntry(raw, stableKey);
    if (Object.prototype.hasOwnProperty.call(entry, lang)) return;
    entry[lang] = normalizeLegacyIndexValue(stableKey, key, value);
  });
}

function normalizeLegacyTabsValue(key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const title = safeString(value.title || key);
    const location = safeString(value.location != null ? value.location : value.path);
    return { title, location };
  }
  return {
    title: safeString(key),
    location: safeString(value)
  };
}

function mergeLegacyTabs(raw, lang, parsed) {
  orderedLegacyEntries(parsed).forEach(([key, value], position) => {
    const stableKey = chooseMergeKey(raw, key, value, position, getTabsValueLocation);
    const entry = ensureUnifiedEntry(raw, stableKey);
    if (Object.prototype.hasOwnProperty.call(entry, lang)) return;
    entry[lang] = normalizeLegacyTabsValue(key, value);
  });
}

function legacyFileEntry(path) {
  const label = path.split('/').pop() || path;
  return {
    kind: CONTENT_MODEL_MIGRATION_KIND,
    category: 'legacy-content-model',
    label,
    path,
    state: 'deleted',
    deleted: true
  };
}

async function fetchYamlObject(fetchImpl, path) {
  try {
    const response = await fetchImpl(path, { cache: 'no-store' });
    if (!response || !response.ok) return { found: false, value: {} };
    const text = await response.text();
    const parsed = parseYAML(text);
    return {
      found: true,
      value: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    };
  } catch (_) {
    return { found: false, value: {} };
  }
}

export async function loadLegacyContentModelMigration(options = {}) {
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : null;
  const contentRoot = normalizeContentRoot(options.contentRoot);
  const registeredLanguages = await loadRegisteredLanguages(fetchImpl, options.languageManifestPath);
  const languageOptions = {
    languages: options.languages,
    registeredLanguages,
    currentLang: options.currentLang,
    defaultLang: options.defaultLang
  };
  const indexRaw = cloneRawConfig(options.indexRaw, { ...languageOptions, base: 'index' });
  const tabsRaw = cloneRawConfig(options.tabsRaw, { ...languageOptions, base: 'tabs' });
  const legacyFiles = [];
  if (!fetchImpl) {
    return {
      hasLegacyContentModel: false,
      contentRoot,
      indexRaw,
      tabsRaw,
      legacyFiles
    };
  }

  for (const candidate of listLegacyContentModelPaths({
    contentRoot,
    ...languageOptions
  })) {
    const result = await fetchYamlObject(fetchImpl, candidate.path);
    if (!result.found) continue;
    legacyFiles.push(legacyFileEntry(candidate.path));
    if (candidate.base === 'tabs') mergeLegacyTabs(tabsRaw, candidate.lang, result.value);
    else mergeLegacyIndex(indexRaw, candidate.lang, result.value);
  }

  return {
    hasLegacyContentModel: legacyFiles.length > 0,
    contentRoot,
    indexRaw,
    tabsRaw,
    legacyFiles
  };
}

export function getLegacyContentModelMigrationFiles(migration) {
  const files = Array.isArray(migration && migration.legacyFiles)
    ? migration.legacyFiles
    : (Array.isArray(migration && migration.files) ? migration.files : []);
  return files
    .filter(file => file && file.path)
    .map(file => ({
      ...file,
      kind: file.kind || CONTENT_MODEL_MIGRATION_KIND,
      category: file.category || 'legacy-content-model',
      state: 'deleted',
      deleted: true,
      path: safeString(file.path).replace(/[\\]/g, '/').replace(/^\/+/, '')
    }));
}
