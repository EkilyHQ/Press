export const PUBLIC_LANGUAGE_POLICIES = Object.freeze(['ui', 'content', 'explicit']);

const DEFAULT_LANGUAGE = 'en';
const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;

const LANGUAGE_ALIASES = new Map([
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

const CONTENT_METADATA_KEYS = new Set([
  '__order',
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
  'versions',
  'ai',
  'aiGenerated',
  'llm',
  'draft',
  'wip',
  'unfinished',
  'inprogress',
  'protected',
  'encryption',
  'slug'
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function uniqueList(values) {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const normalized = normalizeLanguageCode(value && typeof value === 'object' ? (value.value || value.code || value.lang) : value);
    if (!normalized || seen.has(normalized)) return;
    out.push(normalized);
    seen.add(normalized);
  });
  return out;
}

export function normalizeLanguageCode(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (LANGUAGE_ALIASES.has(lower)) return LANGUAGE_ALIASES.get(lower);
  if (LANGUAGE_CODE_PATTERN.test(raw)) return lower;
  return lower;
}

function isLanguageKey(key) {
  const normalized = normalizeLanguageCode(key);
  return !!normalized && (normalized === 'default' || LANGUAGE_CODE_PATTERN.test(normalized));
}

function hasContentLocation(value) {
  if (typeof value === 'string') return !!value.trim();
  if (Array.isArray(value)) return value.some(hasContentLocation);
  if (!isPlainObject(value)) return false;
  if (value.location != null && String(value.location).trim()) return true;
  if (value.path != null && String(value.path).trim()) return true;
  return false;
}

function addContentLang(langs, key, value, defaultLanguage = DEFAULT_LANGUAGE) {
  if (CONTENT_METADATA_KEYS.has(key)) return;
  if (!isLanguageKey(key)) return;
  if (!hasContentLocation(value)) return;
  const lang = normalizeLanguageCode(key);
  if (lang === 'default') {
    const defaultLang = normalizeLanguageCode(defaultLanguage) || DEFAULT_LANGUAGE;
    if (defaultLang && defaultLang !== 'default') langs.add(defaultLang);
  } else if (lang) {
    langs.add(lang);
  }
}

function collectEntryLanguages(entry, langs, defaultLanguage = DEFAULT_LANGUAGE) {
  if (!isPlainObject(entry)) return;
  if (hasContentLocation(entry.location || entry.path ? entry : null)) {
    const defaultLang = normalizeLanguageCode(defaultLanguage) || DEFAULT_LANGUAGE;
    if (defaultLang && defaultLang !== 'default') langs.add(defaultLang);
  }
  Object.entries(entry).forEach(([key, value]) => addContentLang(langs, key, value, defaultLanguage));
}

export function collectContentLanguages(indexState = {}, tabsState = {}, options = {}) {
  const langs = new Set();
  const defaultLanguage = normalizeLanguageCode(options.defaultLanguage || options.defaultLang || DEFAULT_LANGUAGE) || DEFAULT_LANGUAGE;
  const collectFromState = (state) => {
    if (!isPlainObject(state)) return;
    Object.entries(state).forEach(([key, entry]) => {
      if (key === '__order') return;
      collectEntryLanguages(entry, langs, defaultLanguage);
    });
  };
  collectFromState(indexState);
  collectFromState(tabsState);
  return Array.from(langs).sort();
}

export function normalizePublicLanguageSettings(value = {}) {
  const source = isPlainObject(value) ? value : {};
  const policyRaw = normalizeLanguageCode(source.public || source.mode || '');
  const policy = PUBLIC_LANGUAGE_POLICIES.includes(policyRaw) ? policyRaw : 'ui';
  const listSource = Array.isArray(source.publicList)
    ? source.publicList
    : (Array.isArray(source.list) ? source.list : []);
  return {
    public: policy,
    publicList: policy === 'explicit' ? uniqueList(listSource) : []
  };
}

export function publicLanguageSettingsForOutput(settings = {}) {
  const normalized = normalizePublicLanguageSettings(settings);
  if (normalized.public === 'ui') return null;
  const out = { public: normalized.public };
  if (normalized.public === 'explicit' && normalized.publicList.length) out.publicList = normalized.publicList;
  return out;
}

function orderLikeUi(languages, uiLanguages) {
  const input = uniqueList(languages);
  const ui = uniqueList(uiLanguages);
  const inputSet = new Set(input);
  const ordered = ui.filter((lang) => inputSet.has(lang));
  input.forEach((lang) => {
    if (!ordered.includes(lang)) ordered.push(lang);
  });
  return ordered;
}

function fallbackPublicLanguage(siteConfig = {}, uiLanguages = []) {
  const ui = uniqueList(uiLanguages);
  const defaultLang = normalizeLanguageCode(siteConfig.defaultLanguage || siteConfig.defaultLang || '');
  if (defaultLang && ui.includes(defaultLang)) return defaultLang;
  if (ui.includes(DEFAULT_LANGUAGE)) return DEFAULT_LANGUAGE;
  return ui[0] || defaultLang || DEFAULT_LANGUAGE;
}

function warning(code, data = {}) {
  return { code, severity: 'warning', ...data };
}

export function buildLanguageAvailability(options = {}) {
  const siteConfig = isPlainObject(options.siteConfig) ? options.siteConfig : {};
  const uiLanguages = uniqueList(options.uiLanguages);
  const defaultLang = normalizeLanguageCode(siteConfig.defaultLanguage || siteConfig.defaultLang || '');
  const derivedContentLanguages = collectContentLanguages(options.indexState, options.tabsState, {
    defaultLanguage: defaultLang || DEFAULT_LANGUAGE
  });
  const contentLanguages = uniqueList(
    Array.isArray(options.contentLanguages) && options.contentLanguages.length
      ? options.contentLanguages
      : derivedContentLanguages
  );
  const settings = normalizePublicLanguageSettings(siteConfig.languages);
  const uiSet = new Set(uiLanguages);
  const contentSet = new Set(contentLanguages);
  const warnings = [];
  let publicLanguages = [];

  if (settings.public === 'content') {
    publicLanguages = orderLikeUi(contentLanguages.filter((lang) => uiSet.has(lang)), uiLanguages);
  } else if (settings.public === 'explicit') {
    publicLanguages = settings.publicList.filter((lang) => uiSet.has(lang));
    settings.publicList.forEach((lang) => {
      if (!uiSet.has(lang)) warnings.push(warning('public-language-missing-ui', { language: lang }));
    });
  } else {
    publicLanguages = uiLanguages.slice();
  }

  contentLanguages.forEach((lang) => {
    if (!uiSet.has(lang)) warnings.push(warning('content-language-missing-ui', { language: lang }));
  });

  if (defaultLang && contentLanguages.length && !contentSet.has(defaultLang)) {
    warnings.push(warning('default-language-missing-content', { language: defaultLang }));
  }

  if (settings.public !== 'content' && contentLanguages.length) {
    publicLanguages.forEach((lang) => {
      if (!contentSet.has(lang)) warnings.push(warning('public-language-missing-content', { language: lang }));
    });
  }

  if (!publicLanguages.length) {
    publicLanguages = [fallbackPublicLanguage(siteConfig, uiLanguages)];
    warnings.push(warning('public-language-empty-fallback', { language: publicLanguages[0] }));
  }

  const features = isPlainObject(siteConfig.features) ? siteConfig.features : {};
  const switcher = features.languageSwitcher;
  const switcherEnabled = isPlainObject(switcher)
    ? switcher.enabled !== false
    : switcher !== false;
  if (switcherEnabled && publicLanguages.length < 2) {
    warnings.push(warning('language-switcher-single-language', { count: publicLanguages.length }));
  }

  return {
    uiLanguages,
    contentLanguages,
    publicLanguages: uniqueList(publicLanguages),
    policy: settings.public,
    publicList: settings.publicList,
    warnings
  };
}
