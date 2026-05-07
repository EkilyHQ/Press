import assert from 'node:assert/strict';

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
  return { ok: false, status: 404, text: async () => '' };
};

const { initI18n, loadContentJsonWithRaw, getAvailableLangs, getContentLangs, getCurrentLang } = await import('../assets/js/i18n.js');

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

const browserLanguagePrefix = String.fromCharCode(122, 104);
Object.defineProperty(globalThis, 'navigator', {
  value: { language: `${browserLanguagePrefix}-HK` },
  configurable: true
});
await initI18n({ persist: false });
assert.equal(getCurrentLang(), 'cht-hk');

console.log('ok - loadContentJsonWithRaw returns raw index without a duplicate index fetch');
