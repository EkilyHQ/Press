import assert from 'node:assert/strict';
import {
  buildLanguageAvailability,
  collectContentLanguages,
  normalizePublicLanguageSettings,
  publicLanguageSettingsForOutput
} from '../assets/js/language-availability.js';

const uiLanguages = ['en', 'chs', 'cht-tw', 'cht-hk', 'ja'];
const bilingualIndex = {
  demo: {
    default: 'post/demo.md',
    en: 'post/demo.md',
    chs: { location: 'post/demo.chs.md', title: 'Demo' }
  },
  flat: {
    location: 'post/flat.md',
    title: 'Flat entry',
    tag: 'release'
  }
};
const bilingualTabs = {
  About: {
    default: { title: 'About', location: 'about.md' },
    en: { title: 'About', location: 'about.md' },
    chs: { title: '关于', location: 'about.chs.md' }
  }
};

assert.deepEqual(
  collectContentLanguages(bilingualIndex, bilingualTabs, { defaultLanguage: 'en' }),
  ['chs', 'en'],
  'content language collection should map default and flat content to the default language'
);

const contentPolicy = buildLanguageAvailability({
  siteConfig: {
    defaultLanguage: 'en',
    languages: { public: 'content' }
  },
  uiLanguages,
  indexState: bilingualIndex,
  tabsState: bilingualTabs
});
assert.deepEqual(contentPolicy.publicLanguages, ['en', 'chs']);
assert.equal(
  contentPolicy.warnings.some(entry => entry.language === 'ja' && entry.code === 'public-language-missing-content'),
  false,
  'content policy should not advertise or warn for UI-only languages'
);

const defaultAndChineseIndex = {
  demo: {
    default: 'post/demo.md',
    chs: 'post/demo.chs.md'
  },
  flat: {
    location: 'post/flat.md',
    title: 'Flat entry'
  }
};
const defaultAndChinesePolicy = buildLanguageAvailability({
  siteConfig: {
    defaultLanguage: 'en',
    languages: { public: 'content' }
  },
  uiLanguages,
  indexState: defaultAndChineseIndex,
  tabsState: {}
});
assert.deepEqual(
  defaultAndChinesePolicy.publicLanguages,
  ['en', 'chs'],
  'content policy should include default/flat entries as default-language content'
);

const compatiblePolicy = buildLanguageAvailability({
  siteConfig: { defaultLanguage: 'en' },
  uiLanguages,
  indexState: bilingualIndex,
  tabsState: bilingualTabs
});
assert.deepEqual(compatiblePolicy.publicLanguages, uiLanguages);
assert.equal(
  compatiblePolicy.warnings.some(entry => entry.language === 'ja' && entry.code === 'public-language-missing-content'),
  true,
  'default compatible policy should keep UI languages public but warn when content is missing'
);

const explicitPolicy = buildLanguageAvailability({
  siteConfig: {
    defaultLanguage: 'en',
    languages: { public: 'explicit', publicList: ['en', 'ja', 'fr'] }
  },
  uiLanguages,
  indexState: bilingualIndex,
  tabsState: bilingualTabs
});
assert.deepEqual(explicitPolicy.publicLanguages, ['en', 'ja']);
assert.equal(
  explicitPolicy.warnings.some(entry => entry.code === 'public-language-missing-ui' && entry.language === 'fr'),
  true,
  'explicit public languages should warn and drop codes without UI bundles'
);
assert.equal(
  explicitPolicy.warnings.some(entry => entry.code === 'public-language-missing-content' && entry.language === 'ja'),
  true,
  'explicit public languages should warn when advertised content is absent'
);

const fallbackPolicy = buildLanguageAvailability({
  siteConfig: {
    defaultLanguage: 'chs',
    languages: { public: 'content' },
    features: { languageSwitcher: { enabled: true } }
  },
  uiLanguages,
  indexState: {},
  tabsState: {}
});
assert.deepEqual(fallbackPolicy.publicLanguages, ['chs']);
assert.equal(
  fallbackPolicy.warnings.some(entry => entry.code === 'public-language-empty-fallback' && entry.language === 'chs'),
  true,
  'empty content policy should fall back to defaultLanguage when the UI supports it'
);
assert.equal(
  fallbackPolicy.warnings.some(entry => entry.code === 'language-switcher-single-language'),
  true,
  'enabled language switcher should warn when fewer than two public languages are resolved'
);

assert.deepEqual(
  normalizePublicLanguageSettings({ public: 'explicit', publicList: ['EN', ' ja ', 'EN'] }),
  { public: 'explicit', publicList: ['en', 'ja'] }
);
assert.deepEqual(publicLanguageSettingsForOutput({ public: 'ui', publicList: [] }), null);
assert.deepEqual(publicLanguageSettingsForOutput({ public: 'ui', publicList: ['en', 'chs'] }), null);
assert.deepEqual(publicLanguageSettingsForOutput({ public: 'content' }), { public: 'content' });

const manifest = [
  { value: 'en', label: 'English', module: './en.js' },
  { value: 'chs', label: '简体中文', module: './chs.js' },
  { value: 'cht-tw', label: '正體中文（台灣）', module: './cht-tw.js' },
  { value: 'cht-hk', label: '繁體中文（香港）', module: './cht-hk.js' },
  { value: 'ja', label: '日本語', module: './ja.js' }
];

const fetchText = new Map([
  ['assets/i18n/languages.json', JSON.stringify(manifest)],
  ['wwwroot/index.yaml', [
    'demo:',
    '  en: post/demo.md',
    '  chs: post/demo.chs.md',
    ''
  ].join('\n')],
  ['wwwroot/tabs.yaml', [
    'About:',
    '  en:',
    '    title: About',
    '    location: about.md',
    '  chs:',
    '    title: 关于',
    '    location: about.chs.md',
    ''
  ].join('\n')]
]);

globalThis.window = {
  location: {
    href: 'https://example.com/',
    origin: 'https://example.com',
    pathname: '/'
  },
  navigator: { languages: ['en'] },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  addEventListener() {},
  dispatchEvent() {}
};
globalThis.document = {
  documentElement: {
    getAttribute(name) { return name === 'lang' ? 'en' : ''; },
    setAttribute() {}
  },
  querySelector() { return null; }
};
Object.defineProperty(globalThis, 'navigator', {
  value: globalThis.window.navigator,
  configurable: true
});
globalThis.localStorage = globalThis.window.localStorage;
globalThis.fetch = async (url) => {
  const textUrl = String(url || '').replace(/^https?:\/\/[^/]+\//, '');
  const key = Array.from(fetchText.keys()).find(entry => textUrl.endsWith(entry));
  if (!key && textUrl.endsWith('.md')) {
    return {
      ok: true,
      status: 200,
      text: async () => '---\ntitle: Demo\n---\n\nDemo\n'
    };
  }
  if (!key) return { ok: false, status: 404, text: async () => '' };
  const body = fetchText.get(key);
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(body),
    text: async () => body
  };
};

const { generateSitemapData } = await import('../assets/js/seo.js');
const coldSitemapUrls = generateSitemapData(bilingualIndex, bilingualTabs, {
  siteURL: 'https://example.com/',
  defaultLanguage: 'en',
  languages: { public: 'content' }
});
assert.match(
  JSON.stringify(coldSitemapUrls),
  /lang=chs/,
  'sitemap should keep content languages when i18n only exposes its bootstrap language'
);

const coldExplicitSitemapUrls = generateSitemapData({}, {}, {
  siteURL: 'https://example.com/',
  defaultLanguage: 'en',
  languages: { public: 'explicit', publicList: ['en', 'ja'] }
});
assert.match(
  JSON.stringify(coldExplicitSitemapUrls),
  /lang=ja/,
  'cold sitemap generation should keep explicit public homepage languages before i18n loads the manifest'
);

const i18n = await import('../assets/js/i18n.js');
await i18n.initI18n({ lang: 'en', persist: false });
const loadedIndex = await i18n.loadContentJsonWithRaw('wwwroot', 'index');
const loadedTabs = await i18n.loadTabsJson('wwwroot', 'tabs');
assert.deepEqual(i18n.getAvailableLangs(), uiLanguages, 'available languages should remain the UI manifest list');
assert.deepEqual(i18n.getContentLangs(), ['chs', 'en'], 'content languages should reflect loaded index/tabs content');
assert.deepEqual(
  i18n.getPublicLangs({ languages: { public: 'content' }, defaultLanguage: 'en' }),
  ['en', 'chs'],
  'public language API should resolve content-backed public languages'
);

const sitemapUrls = generateSitemapData(loadedIndex.raw, fetchText.size ? bilingualTabs : loadedTabs, {
  siteURL: 'https://example.com/',
  defaultLanguage: 'en',
  languages: { public: 'content' }
});
const sitemapPayload = JSON.stringify(sitemapUrls);
assert.match(sitemapPayload, /lang=chs/, 'sitemap should include content-backed Chinese alternates');
assert.doesNotMatch(sitemapPayload, /lang=ja|cht-tw|cht-hk/, 'sitemap should not expose UI-only languages under content policy');

const defaultTabUrls = generateSitemapData({}, {
  Docs: {
    default: { title: 'Docs', location: 'docs.md' }
  }
}, {
  siteURL: 'https://example.com/',
  defaultLanguage: 'en',
  languages: { public: 'content' }
});
assert.match(
  JSON.stringify(defaultTabUrls),
  /tab=docs&lang=en/,
  'sitemap should include unified default tab buckets as default-language content'
);

const defaultLangAliasUrls = generateSitemapData({}, {
  Docs: {
    default: { title: 'Docs', location: 'docs.md' }
  }
}, {
  siteURL: 'https://example.com/',
  defaultLang: 'chs',
  languages: { public: 'content' }
});
assert.match(
  JSON.stringify(defaultLangAliasUrls),
  /tab=docs&lang=chs/,
  'sitemap should map unified default buckets through the supported defaultLang alias'
);

console.log('ok - language availability policy resolves public languages and warnings');
