import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
let importCounter = 0;

class TestElement {
  constructor(tagName) {
    this.tagName = String(tagName || '').toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.textContent = '';
    this.rel = '';
    this.href = '';
  }

  appendChild(child) {
    if (!child) return child;
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    const key = String(name);
    const str = String(value);
    this.attributes.set(key, str);
    if (key === 'id') this.id = str;
    if (key === 'class') this.className = str;
    if (key.startsWith('data-')) {
      const dataKey = key.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      this.dataset[dataKey] = str;
    }
    if (key === 'href') this.href = str;
  }

  getAttribute(name) {
    const key = String(name);
    if (key === 'href' && this.href) return this.href;
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }

  matches(selector) {
    const raw = String(selector || '').trim();
    if (!raw) return false;
    if (raw.startsWith('#')) return this.id === raw.slice(1);
    if (raw.startsWith('.')) return this.className.split(/\s+/).includes(raw.slice(1));
    const dataAttr = raw.match(/^([a-z]+)?\[data-([a-z0-9-]+)(?:=["']?([^"'\]]+)["']?)?\]$/i);
    if (dataAttr) {
      const [, tag, dataName, expected] = dataAttr;
      if (tag && this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
      const key = dataName.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (!Object.prototype.hasOwnProperty.call(this.dataset, key)) return false;
      return expected == null || this.dataset[key] === expected;
    }
    return this.tagName.toLowerCase() === raw.toLowerCase();
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (child.matches(selector)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class TestDocument {
  constructor() {
    this.documentElement = new TestElement('html');
    this.head = new TestElement('head');
    this.body = new TestElement('body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    const themeLink = this.createElement('link');
    themeLink.id = 'theme-pack';
    themeLink.setAttribute('id', 'theme-pack');
    this.head.appendChild(themeLink);
  }

  createElement(tagName) {
    return new TestElement(tagName);
  }

  getElementById(id) {
    return this.documentElement.querySelector(`#${id}`);
  }

  querySelectorAll(selector) {
    return this.documentElement.querySelectorAll(selector);
  }

  querySelector(selector) {
    return this.documentElement.querySelector(selector);
  }
}

function createLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function makeManifest(pack, modules) {
  return {
    name: pack,
    version: '1.0.0',
    contractVersion: 1,
    styles: ['theme.css', 'extra.css'],
    modules,
    views: { post: {}, posts: {}, search: {}, tab: {} },
    regions: { main: {}, toc: {}, search: {}, nav: {}, tags: {}, footer: {} },
    components: ['press-search', 'press-toc', 'press-post-card'],
    content: { shapes: ['rawMarkdown', 'html', 'blocks', 'tocTree', 'headings', 'metadata', 'assets', 'links'] }
  };
}

function installGlobals({ savedPack = 'native', manifests = {} } = {}) {
  const document = new TestDocument();
  const localStorage = createLocalStorage({ themePack: savedPack });
  globalThis.document = document;
  globalThis.localStorage = localStorage;
  globalThis.window = {
    location: { href: 'https://example.test/', search: '' },
    localStorage,
    matchMedia: () => ({ matches: false }),
    __press_themeDevMode: false
  };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.fetch = async (input) => {
    const url = String(input || '').split('?')[0];
    const match = url.match(/^assets\/themes\/([^/]+)\/theme\.json$/);
    if (match) {
      const pack = decodeURIComponent(match[1]);
      const manifest = manifests[pack] || makeManifest(pack, ['modules/missing.js']);
      return { ok: true, json: async () => manifest };
    }
    return { ok: false, json: async () => ({}) };
  };
  return { document, localStorage };
}

async function freshThemeLayout() {
  importCounter += 1;
  return import(`../assets/js/theme-layout.js?theme-runtime-test=${importCounter}`);
}

async function withQuietConsole(fn) {
  const originalError = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = originalError;
  }
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } finally {
    delete globalThis.fetch;
    delete globalThis.window;
    delete globalThis.document;
    delete globalThis.localStorage;
  }
}

await run('external theme fallback does not rewrite the saved pack', async () => {
  const { localStorage, document } = installGlobals({
    savedPack: 'broken',
    manifests: {
      broken: makeManifest('broken', ['modules/missing.js']),
      native: makeManifest('native', ['modules/missing-native.js'])
    }
  });
  const { ensureThemeLayout } = await freshThemeLayout();
  await withQuietConsole(() => ensureThemeLayout());
  assert.equal(localStorage.getItem('themePack'), 'broken');
  assert.equal(document.body.dataset.themeLayout, 'native');
});

await run('external theme fallback clears partial DOM and extra styles', async () => {
  const themeDir = resolve(repoRoot, 'assets/themes/broken/modules');
  mkdirSync(themeDir, { recursive: true });
  writeFileSync(resolve(themeDir, 'layout.js'), `
export function mount() {
  const root = document.createElement('div');
  root.className = 'broken-shell';
  root.setAttribute('data-theme-root', 'container');
  document.body.appendChild(root);
  return { regions: { main: root } };
}
`);
  try {
    const { document } = installGlobals({
      savedPack: 'broken',
      manifests: {
        broken: makeManifest('broken', ['modules/layout.js', 'modules/missing.js']),
        native: makeManifest('native', ['modules/missing-native.js'])
      }
    });
    const { ensureThemeLayout } = await freshThemeLayout();
    await withQuietConsole(() => ensureThemeLayout());
    assert.equal(document.body.dataset.themeLayout, 'native');
    assert.equal(document.body.querySelector('.broken-shell'), null);
    assert.equal(document.querySelectorAll('link[data-theme-pack-extra-style]').length, 0);
  } finally {
    rmSync(resolve(repoRoot, 'assets/themes/broken'), { recursive: true, force: true });
  }
});
