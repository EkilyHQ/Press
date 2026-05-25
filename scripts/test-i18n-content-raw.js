import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const i18nSource = readFileSync(resolve(here, '../assets/js/i18n.js'), 'utf8');

[
  ['base default language', /^let\s+baseDefaultLang\b/m],
  ['translation bundles', /^const\s+translations\s*=/m],
  ['language names', /^const\s+languageNames\s*=/m],
  ['language manifest', /^let\s+languageManifest\b/m],
  ['manifest promise', /^let\s+manifestLoadPromise\b/m],
  ['language module URL cache', /^const\s+languageModuleUrls\s*=/m],
  ['bundle promise cache', /^const\s+bundleLoadPromises\s*=/m],
  ['manifest base URL', /^let\s+manifestBaseUrl\b/m],
  ['front matter metadata cache', /^const\s+frontMatterMetadataCache\s*=/m],
  ['front matter promise cache', /^const\s+frontMatterPromiseCache\s*=/m],
  ['front matter fetch queue', /^const\s+frontMatterFetchQueue\s*=/m],
  ['front matter active fetches', /^let\s+frontMatterActiveFetches\b/m],
  ['current language', /^let\s+currentLang\b/m],
  ['content languages', /^let\s+__contentLangs\b/m]
].forEach(([label, pattern]) => {
  assert.doesNotMatch(i18nSource, pattern, `${label} should live in i18n runtime state, not module-level mutable state`);
});

assert.match(
  i18nSource,
  /function createI18nState\(\)[\s\S]*baseDefaultLang:[\s\S]*frontMatterMetadataCache:[\s\S]*currentLang:[\s\S]*contentLangs:/,
  'i18n should keep language and content caches in explicit runtime state'
);
assert.match(
  i18nSource,
  /export function createI18nController\(options = \{\}\)[\s\S]*const runtime = createI18nRuntime\(options\)[\s\S]*init\(initOptions = \{\}\)[\s\S]*loadContentJsonWithRaw\(basePath, baseName\)[\s\S]*getTranslations\(\)/,
  'i18n should expose an explicit controller while preserving compatibility wrappers'
);
assert.match(
  i18nSource,
  /async function fetchConfigWithYamlFallbackForRuntime\(runtime, names\)[\s\S]*runtime\.getFetch\(\)\(name, \{ cache: 'no-store' \}\)/,
  'i18n content YAML loading should use the runtime fetch adapter'
);

globalThis.document = globalThis.document || {
  documentElement: { setAttribute() {}, getAttribute() { return 'en'; } },
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
const windowListeners = new Map();
globalThis.window = globalThis.window || {
  location: { href: 'https://example.test/', pathname: '/' },
  addEventListener(type, listener, options = {}) {
    const key = String(type || '');
    const list = windowListeners.get(key) || [];
    list.push({ listener, once: !!(options && options.once) });
    windowListeners.set(key, list);
  },
  removeEventListener(type, listener) {
    const key = String(type || '');
    const list = windowListeners.get(key) || [];
    windowListeners.set(key, list.filter(item => item.listener !== listener));
  },
  dispatchEvent(event) {
    const key = String(event && event.type || '');
    const list = (windowListeners.get(key) || []).slice();
    list.forEach((item) => {
      try { item.listener(event); } catch (_) {}
    });
    windowListeners.set(key, (windowListeners.get(key) || []).filter(item => !item.once));
    return true;
  }
};
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: 'en-US' },
    configurable: true
  });
} catch (_) {}
globalThis.localStorage = globalThis.localStorage || {
  getItem() { return null; },
  setItem() {},
  removeItem() {}
};

const requests = [];

globalThis.fetch = async (url) => {
  const textUrl = String(url);
  requests.push(textUrl);
  if (textUrl.endsWith('/assets/i18n/languages.json')) {
    return {
      ok: true,
      json: async () => [
        { value: 'en', label: 'English', module: './en.js' },
        { value: 'chs', label: '简体中文', module: './chs.js' },
        { value: 'cht-tw', label: '正體中文（台灣）', module: './cht-tw.js' },
        { value: 'cht-hk', label: '繁體中文（香港）', module: './cht-hk.js' },
        { value: 'ja', label: '日本語', module: './ja.js' }
      ]
    };
  }
  if (textUrl.endsWith('/index.yaml')) {
    return {
      ok: true,
      text: async () => [
        'demo:',
        '  en:',
        '    - post/demo.md',
        'secret:',
        '  en:',
        '    - post/secret.md',
        ''
      ].join('\n')
    };
  }
  if (textUrl.endsWith('/unified.yaml')) {
    return {
      ok: true,
      text: async () => [
        'unified-secret:',
        '  en:',
        '    title: Unified Secret',
        '    location: post/unified-secret.md',
        '    protected: true',
        '    excerpt: Unified public summary.',
        ''
      ].join('\n')
    };
  }
  if (textUrl.endsWith('/rich.yaml')) {
    return {
      ok: true,
      text: async () => [
        'rich:',
        '  en:',
        '    - location: post/rich.md',
        '      title: Rich Title',
        '      date: 2026-04-29',
        '      tags:',
        '        - perf',
        '        - index',
        '      image: hero.jpg',
        '      excerpt: Index summary.',
        '      readTime: 3',
        '      protected: false',
        '    - location: post/rich-old.md',
        '      title: Rich Title',
        '      date: 2026-04-20',
        '      excerpt: Older summary.',
        '      readTime: 2',
        '      protected: false',
        ''
      ].join('\n')
    };
  }
  if (textUrl.endsWith('/partial.yaml')) {
    return {
      ok: true,
      text: async () => [
        'partial:',
        '  en:',
        '    - location: post/partial.md',
        '      title: Declared Title',
        '      image: declared.jpg',
        '      excerpt: Declared summary.',
        '      readTime: 4',
        ''
      ].join('\n')
    };
  }
  if (textUrl.endsWith('/post/demo.md')) {
    return {
      ok: true,
      text: async () => [
        '---',
        'title: Demo Title',
        'date: 2026-04-27',
        '---',
        'Demo body.',
        ''
      ].join('\n')
    };
  }
  if (textUrl.endsWith('/post/secret.md')) {
    return {
      ok: true,
      text: async () => [
        '---',
        'title: Secret Title',
        'date: 2026-04-28',
        'protected: true',
        'excerpt: Public summary only.',
        '---',
        '```press-encrypted-markdown-v1',
        'ciphertext',
        '```',
        ''
      ].join('\n')
    };
  }
  if (textUrl.endsWith('/post/partial.md')) {
    return {
      ok: true,
      text: async () => [
        '---',
        'date: 2026-04-30',
        '---',
        'Partial body.',
        ''
      ].join('\n')
    };
  }
  return { ok: false, status: 404, text: async () => '' };
};

const {
  createI18nController,
  initI18n,
  loadContentJsonWithRaw,
  getAvailableLangs,
  getContentLangs,
  getCurrentLang
} = await import('../assets/js/i18n.js');

await initI18n({ lang: 'en', persist: false });
const metadataReady = new Promise(resolve => {
  window.addEventListener('ns:posts-metadata-ready', event => resolve(event.detail && event.detail.entries), { once: true });
});
const result = await loadContentJsonWithRaw('wwwroot', 'index');

assert.equal(requests.filter(url => url.endsWith('/index.yaml')).length, 1);
assert.deepEqual(result.raw, {
  demo: { en: ['post/demo.md'] },
  secret: { en: ['post/secret.md'] }
});
assert.equal(result.entries.demo.location, 'post/demo.md');
assert.equal(result.entries.secret.location, 'post/secret.md');
assert.deepEqual(getContentLangs(), ['en']);
assert.deepEqual(getAvailableLangs(), ['en', 'chs', 'cht-tw', 'cht-hk', 'ja']);

const enrichedEntries = await metadataReady;
assert.equal(enrichedEntries['Secret Title'].protected, true);
assert.equal(enrichedEntries['Secret Title'].excerpt, 'Public summary only.');
assert.equal(result.entries['Secret Title'].protected, true);

const unified = await loadContentJsonWithRaw('wwwroot', 'unified');
assert.equal(unified.entries['Unified Secret'].protected, true);
assert.equal(unified.entries['Unified Secret'].excerpt, 'Unified public summary.');

const beforeRichRequests = requests.length;
const rich = await loadContentJsonWithRaw('wwwroot', 'rich');
assert.equal(rich.entries['Rich Title'].location, 'post/rich.md');
assert.deepEqual(rich.entries['Rich Title'].tag, ['perf', 'index']);
assert.equal(rich.entries['Rich Title'].image, 'post/hero.jpg');
assert.equal(rich.entries['Rich Title'].excerpt, 'Index summary.');
assert.equal(rich.entries['Rich Title'].readTime, 3);
assert.equal(rich.entries['Rich Title'].versions.length, 2);
assert.equal(
  requests.slice(beforeRichRequests).filter(url => url.endsWith('/post/rich.md') || url.endsWith('/post/rich-old.md')).length,
  0,
  'rich index metadata should not trigger Markdown front matter fetches'
);

const partialReady = new Promise(resolve => {
  window.addEventListener('ns:posts-metadata-ready', event => resolve(event.detail && event.detail.entries), { once: true });
});
const partial = await loadContentJsonWithRaw('wwwroot', 'partial');
assert.equal(partial.entries['Declared Title'].image, 'post/declared.jpg');
assert.equal(partial.entries['Declared Title'].excerpt, 'Declared summary.');
const partialEntries = await partialReady;
assert.equal(partialEntries['Declared Title'].image, 'post/declared.jpg');
assert.equal(partialEntries['Declared Title'].excerpt, 'Declared summary.');
assert.equal(partialEntries['Declared Title'].date, '2026-04-30');
assert.equal(partialEntries.partial, undefined);

const browserLanguagePrefix = String.fromCharCode(122, 104);
Object.defineProperty(globalThis, 'navigator', {
  value: { language: `${browserLanguagePrefix}-HK` },
  configurable: true
});
await initI18n({ persist: false });
assert.equal(getCurrentLang(), 'cht-hk');

function makeControllerDocument() {
  const attrs = new Map();
  return {
    documentElement: {
      setAttribute(name, value) {
        attrs.set(String(name), String(value));
      },
      getAttribute(name) {
        return attrs.get(String(name)) || '';
      }
    },
    querySelector() {
      return null;
    }
  };
}

function makeControllerWindow(href) {
  return {
    location: {
      href,
      pathname: '/post/demo.md',
      search: '',
      assign(next) {
        this.href = String(next || '');
      }
    },
    dispatchEvent() {
      return true;
    }
  };
}

function makeControllerStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    }
  };
}

const runtimeRequests = [];
const manifestFetch = async (url) => {
  const textUrl = String(url);
  runtimeRequests.push(textUrl);
  if (textUrl.endsWith('/assets/i18n/languages.json')) {
    return {
      ok: true,
      json: async () => [
        { value: 'en', label: 'English', module: './en.js' },
        { value: 'chs', label: '简体中文', module: './chs.js' }
      ]
    };
  }
  if (textUrl.endsWith('runtime-root/index.yaml')) {
    return {
      ok: true,
      text: async () => [
        'runtime-title:',
        '  en:',
        '    title: Runtime Title',
        '    location: post/runtime.md',
        '    excerpt: Runtime summary.',
        '    protected: false',
        ''
      ].join('\n')
    };
  }
  return { ok: false, status: 404, text: async () => '' };
};

const documentA = makeControllerDocument();
const documentB = makeControllerDocument();
const controllerA = createI18nController({
  documentRef: documentA,
  windowRef: makeControllerWindow('https://example.test/post/demo.md'),
  localStorageRef: makeControllerStorage(),
  navigatorRef: { language: 'en-US' },
  fetchImpl: manifestFetch
});
const controllerB = createI18nController({
  documentRef: documentB,
  windowRef: makeControllerWindow('https://example.test/post/demo.md'),
  localStorageRef: makeControllerStorage(),
  navigatorRef: { language: 'en-US' },
  fetchImpl: manifestFetch
});

await controllerA.init({ lang: 'en', persist: false });
await controllerB.init({ lang: 'chs', persist: false });
controllerA.getTranslations().en.__runtimeProbe = 'alpha';
controllerB.getTranslations().en.__runtimeProbe = 'beta';

assert.equal(controllerA.getCurrentLang(), 'en');
assert.equal(controllerB.getCurrentLang(), 'chs');
assert.equal(documentA.documentElement.getAttribute('lang'), 'en');
assert.equal(documentB.documentElement.getAttribute('lang'), 'chs');
assert.equal(controllerA.t('__runtimeProbe'), 'alpha');
assert.equal(controllerB.t('__runtimeProbe'), 'beta');
assert.equal(controllerA.withLangParam('/post/demo.md'), '/post/demo.md?lang=en');
assert.equal(controllerB.withLangParam('/post/demo.md'), '/post/demo.md?lang=chs');
const runtimeContent = await controllerA.loadContentJsonWithRaw('runtime-root', 'index');
assert.equal(runtimeContent.entries['Runtime Title'].location, 'post/runtime.md');
assert.ok(runtimeRequests.some(url => url.endsWith('runtime-root/index.yaml')));
assert.equal(requests.some(url => url.includes('runtime-root')), false);

console.log('ok - loadContentJsonWithRaw returns raw index without a duplicate index fetch');
