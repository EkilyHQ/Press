import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const themeSource = readFileSync(resolve(here, '../assets/js/theme.js'), 'utf8');
const mainSource = readFileSync(resolve(here, '../assets/main.js'), 'utf8');
const themeLayoutSource = readFileSync(resolve(here, '../assets/js/theme-layout.js'), 'utf8');
let importCounter = 0;

assert.doesNotMatch(
  themeSource,
  /^const\s+suppressedThemePacks\s*=\s*new Set\(\)/m,
  'theme-pack suppression state should not be module-level mutable state'
);
assert.match(
  themeSource,
  /function createThemePackState\(\) \{[\s\S]*suppressedThemePacks: new Set\(\)[\s\S]*export function createThemePackController\(\) \{[\s\S]*const runtime = createThemePackRuntime\(\)[\s\S]*isSuppressed\(name\)/,
  'theme-pack suppression state should be scoped to explicit controller runtimes'
);
assert.match(
  mainSource,
  /function reflectActiveThemeConfig\(themeContext = getThemeLayoutContext\(\)\) \{[\s\S]*return callThemeEffect\('reflectThemeConfig', \{[\s\S]*ctx: themeContext \|\| null,[\s\S]*themeSettings: themeContext && themeContext\.themeSettings \? themeContext\.themeSettings : null,/,
  'main boot reflection should preserve resolved theme settings when reflecting theme config'
);
assert.doesNotMatch(
  mainSource,
  /callThemeEffect\('reflectThemeConfig', \{\s*config: siteConfig,\s*features: getSiteFeatureContext\(\),/,
  'main boot reflection should not call reflectThemeConfig without ctx/themeSettings'
);
assert.match(
  mainSource,
  /await ensureThemeLayout\(\{[\s\S]*features: getSiteFeatureContext\(\),[\s\S]*router: createThemeRouterContext\(\),[\s\S]*siteConfig,[\s\S]*reflectThemeConfig: false[\s\S]*\}\);/,
  'main boot should let reflectActiveThemeConfig own the public boot reflect call'
);
assert.match(
  themeLayoutSource,
  /const shouldReflectThemeConfig = !options \|\| options\.reflectThemeConfig !== false;[\s\S]*if \(shouldReflectThemeConfig\) reflectThemeRuntimeConfig\(context, options, resolvedSettings\);/,
  'theme layout runtime refresh should support explicit reflectThemeConfig opt-out'
);

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

  insertBefore(child, ref) {
    if (!child) return child;
    const index = this.children.indexOf(ref);
    if (index < 0) return this.appendChild(child);
    child.parentElement = this;
    this.children.splice(index, 0, child);
    return child;
  }

  replaceChild(child, oldChild) {
    const index = this.children.indexOf(oldChild);
    if (index < 0) return this.appendChild(child);
    if (child) child.parentElement = this;
    if (oldChild) oldChild.parentElement = null;
    this.children[index] = child;
    return oldChild;
  }

  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }

  addEventListener() {}

  removeEventListener() {}

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
    contractVersion: 4,
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
    addEventListener() {},
    removeEventListener() {},
    __press_themeDevMode: false
  };
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.fetch = async (input) => {
    const url = String(input || '').split('?')[0];
    if (url.endsWith('assets/i18n/languages.json')) {
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
    if (url.endsWith('wwwroot/index.yaml')) {
      return {
        ok: true,
        text: async () => [
          'demo:',
          '  en: post/demo.md',
          '  chs: post/demo.chs.md',
          ''
        ].join('\n')
      };
    }
    if (url.endsWith('.md')) {
      return {
        ok: true,
        text: async () => '---\ntitle: Demo\n---\n\nDemo\n'
      };
    }
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

async function freshThemeHelpers() {
  importCounter += 1;
  return import(`../assets/js/theme.js?theme-runtime-test=${importCounter}`);
}

async function freshThemeRouterHelpers() {
  importCounter += 1;
  return import(`../assets/js/theme-router-helpers.js?theme-runtime-test=${importCounter}`);
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

async function waitFor(condition, message) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(message);
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
      native: { ...makeManifest('native', ['modules/missing-native.js']), styles: ['theme.css'] }
    }
  });
  const { ensureThemeLayout } = await freshThemeLayout();
  await withQuietConsole(() => ensureThemeLayout());
  assert.equal(localStorage.getItem('themePack'), 'broken');
  assert.equal(document.body.dataset.themeLayout, 'native');
});

await run('unlocked site defaults do not clear a pending pack switch', async () => {
  const { localStorage } = installGlobals({ savedPack: 'native' });
  localStorage.removeItem('themePack');
  const {
    applyThemeConfig,
    getPendingThemePack,
    getRequestedThemePack,
    requestThemePackSwitch
  } = await freshThemeHelpers();
  requestThemePackSwitch('cartograph');
  applyThemeConfig({ themePack: 'native', themeOverride: false });
  assert.equal(getPendingThemePack(), 'cartograph');
  assert.equal(getRequestedThemePack(), 'cartograph');
});

await run('theme pack controllers isolate suppressed state', async () => {
  installGlobals({ savedPack: 'native' });
  const { createThemePackController, isThemePackSuppressed } = await freshThemeHelpers();
  const first = createThemePackController();
  const second = createThemePackController();
  first.suppress('cartograph');
  assert.equal(first.isSuppressed('cartograph'), true);
  assert.equal(second.isSuppressed('cartograph'), false);
  assert.equal(isThemePackSuppressed('cartograph'), false);
});

await run('cached theme layout contexts refresh public feature context', async () => {
  installGlobals({
    savedPack: 'featurepack',
    manifests: {
      featurepack: makeManifest('featurepack', ['modules/layout.js'])
    }
  });
  window.__pressThemeModuleLoader = async () => ({ mount() {} });
  const { ensureThemeLayout } = await freshThemeLayout();
  const firstFeatures = { flags: { search: true }, isEnabled: (key) => key !== 'search' };
  const secondFeatures = { flags: { search: false }, isEnabled: (key) => key === 'footerNav' };
  const firstRouter = { getHomeHref: () => '?tab=first' };
  const secondRouter = { getHomeHref: () => '?tab=second' };
  const firstSiteConfig = { languages: { public: 'ui' } };
  const secondSiteConfig = { languages: { public: 'content' } };
  const first = await ensureThemeLayout({ pack: 'featurepack', persist: false, reset: true, features: firstFeatures, router: firstRouter, siteConfig: firstSiteConfig });
  assert.equal(first.features, firstFeatures);
  assert.equal(first.router, firstRouter);
  assert.equal(first.siteConfig, firstSiteConfig);
  const second = await ensureThemeLayout({ pack: 'featurepack', persist: false, features: secondFeatures, router: secondRouter, siteConfig: secondSiteConfig });
  assert.equal(second, first);
  assert.equal(second.features, secondFeatures);
  assert.equal(second.router, secondRouter);
  assert.equal(second.siteConfig, secondSiteConfig);
});

await run('in-flight theme layout reuse refreshes public feature context', async () => {
  installGlobals({
    savedPack: 'featurepack',
    manifests: {
      featurepack: makeManifest('featurepack', ['modules/layout.js'])
    }
  });
  let releaseModule = () => {};
  const moduleReady = new Promise((resolve) => { releaseModule = resolve; });
  window.__pressThemeModuleLoader = async () => {
    await moduleReady;
    return {
      mount(ctx) {
        mountedFeatures = ctx && ctx.features;
        mountedRouter = ctx && ctx.router;
      }
    };
  };
  const { ensureThemeLayout, getThemeLayoutContext } = await freshThemeLayout();
  let mountedFeatures = null;
  let mountedRouter = null;
  const firstFeatures = { flags: { search: true }, isEnabled: (key) => key !== 'search' };
  const secondFeatures = { flags: { search: false }, isEnabled: (key) => key === 'footerNav' };
  const firstRouter = { getHomeHref: () => '?tab=first' };
  const secondRouter = { getHomeHref: () => '?tab=second' };
  const firstPromise = ensureThemeLayout({ pack: 'featurepack', persist: false, reset: true, features: firstFeatures, router: firstRouter });
  const secondPromise = ensureThemeLayout({ pack: 'featurepack', persist: false, features: secondFeatures, router: secondRouter });
  releaseModule();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(second, first);
  assert.equal(first.features, secondFeatures);
  assert.equal(first.router, secondRouter);
  assert.equal(mountedFeatures, secondFeatures);
  assert.equal(mountedRouter, secondRouter);
  assert.equal(getThemeLayoutContext().features, secondFeatures);
  assert.equal(getThemeLayoutContext().router, secondRouter);
});

await run('stale in-flight theme layout reuse does not refresh after reset', async () => {
  installGlobals({
    savedPack: 'featurepack',
    manifests: {
      featurepack: makeManifest('featurepack', ['modules/slow.js']),
      otherpack: makeManifest('otherpack', ['modules/fast.js'])
    }
  });
  let releaseSlowModule = () => {};
  const slowModuleReady = new Promise((resolve) => { releaseSlowModule = resolve; });
  window.__pressThemeModuleLoader = async (_path, { entry } = {}) => {
    if (entry === 'modules/slow.js') await slowModuleReady;
    return { mount() {} };
  };
  const { ensureThemeLayout, getThemeLayoutContext } = await freshThemeLayout();
  const staleRouter = { getHomeHref: () => '?tab=stale' };
  const reusedRouter = { getHomeHref: () => '?tab=reused' };
  const currentRouter = { getHomeHref: () => '?tab=current' };
  const staleFeatures = { flags: { search: true }, isEnabled: () => true };
  const reusedFeatures = { flags: { search: false }, isEnabled: () => false };
  const currentFeatures = { flags: { footerNav: true }, isEnabled: (key) => key === 'footerNav' };
  const stalePromise = ensureThemeLayout({ pack: 'featurepack', persist: false, reset: true, features: staleFeatures, router: staleRouter });
  const reusedPromise = ensureThemeLayout({ pack: 'featurepack', persist: false, features: reusedFeatures, router: reusedRouter });
  const current = await ensureThemeLayout({ pack: 'otherpack', persist: false, reset: true, features: currentFeatures, router: currentRouter });
  assert.equal(current.features, currentFeatures);
  assert.equal(current.router, currentRouter);
  releaseSlowModule();
  await Promise.all([stalePromise, reusedPromise]);
  assert.equal(getThemeLayoutContext().pack, 'otherpack');
  assert.equal(getThemeLayoutContext().features, currentFeatures);
  assert.equal(getThemeLayoutContext().router, currentRouter);
});

await run('cached native layout effects use refreshed router context', async () => {
  installGlobals({
    savedPack: 'native',
    manifests: {
      native: makeManifest('native', ['modules/interactions.js'])
    }
  });
  window.__pressThemeModuleLoader = async (_path, { entry } = {}) => {
    if (entry === 'modules/interactions.js') {
      importCounter += 1;
      return import(`../assets/themes/native/modules/interactions.js?theme-runtime-test=${importCounter}`);
    }
    return { mount() {} };
  };
  const { ensureThemeLayout } = await freshThemeLayout();
  const firstRouter = {
    getHomeSlug: () => 'first',
    getHomeLabel: () => 'First',
    postsEnabled: () => false,
    getTabHref: (slug) => `?tab=first-${slug}`,
    getSearchHref: () => null
  };
  const secondRouter = {
    getHomeSlug: () => 'second',
    getHomeLabel: () => 'Second',
    postsEnabled: () => false,
    getTabHref: (slug) => `?tab=second-${slug}`,
    getSearchHref: () => null
  };
  const first = await withQuietConsole(() => ensureThemeLayout({ pack: 'native', persist: false, reset: true, router: firstRouter }));
  const second = await withQuietConsole(() => ensureThemeLayout({ pack: 'native', persist: false, router: secondRouter }));
  assert.equal(second, first);
  window.requestAnimationFrame = () => 0;
  window.cancelAnimationFrame = () => {};
  const nav = document.createElement('nav');
  second.theme.effects.renderTabs({
    nav,
    tabsBySlug: {
      first: { label: 'First' },
      second: { label: 'Second' }
    },
    activeSlug: 'second'
  });
  const track = nav.querySelector('.tabs-track');
  const link = track && track.querySelector('a');
  assert.ok(link);
  assert.equal(link.getAttribute('data-slug'), 'second');
  assert.equal(link.getAttribute('href'), '?tab=second-second');
});

await run('theme router href helpers gate routes and apply language parameters', async () => {
  installGlobals({ savedPack: 'native' });
  const { createThemeRouterHrefHelpers } = await freshThemeRouterHelpers();
  const helpers = createThemeRouterHrefHelpers({
    withLangParam: (href) => `${href}${href.includes('?') ? '&' : '?'}lang=ja`,
    getHomeSlug: () => 'overview',
    postsEnabled: () => false,
    searchEnabled: () => true,
    tagsEnabled: () => false
  });
  assert.equal(helpers.getHomeHref(), '?tab=overview&lang=ja');
  assert.equal(helpers.getTabHref('overview'), '?tab=overview&lang=ja');
  assert.equal(helpers.getPostHref('post/demo.md'), '?id=post%2Fdemo.md&lang=ja');
  assert.equal(helpers.getPostsHref({ page: 2 }), null);
  assert.equal(helpers.getSearchHref({ q: 'press', tag: 'alpha', page: 3 }), '?tab=search&q=press&page=3&lang=ja');
});

await run('theme layout mount context exposes router href helpers', async () => {
  let mountedRouter = null;
  installGlobals({
    savedPack: 'routepack',
    manifests: {
      routepack: makeManifest('routepack', ['modules/layout.js'])
    }
  });
  const router = {
    getHomeHref: () => '?tab=home',
    getTabHref: (slug) => `?tab=${slug}`,
    getPostHref: (loc) => `?id=${loc}`,
    getPostsHref: () => null,
    getSearchHref: () => null
  };
  window.__pressThemeModuleLoader = async () => ({
    mount(ctx) {
      mountedRouter = ctx && ctx.router;
    }
  });
  const { ensureThemeLayout } = await freshThemeLayout();
  await ensureThemeLayout({ pack: 'routepack', persist: false, reset: true, router });
  assert.equal(mountedRouter, router);
  assert.equal(mountedRouter.getHomeHref(), '?tab=home');
});

await run('theme layout reflects config once and honors opt-out', async () => {
  const reflected = [];
  installGlobals({
    savedPack: 'reflectpack',
    manifests: {
      reflectpack: makeManifest('reflectpack', ['modules/layout.js']),
      silentpack: makeManifest('silentpack', ['modules/layout.js'])
    }
  });
  window.__pressThemeModuleLoader = async () => ({
    theme: {
      effects: {
        reflectThemeConfig(payload) {
          reflected.push(payload);
        }
      }
    }
  });
  const { ensureThemeLayout } = await freshThemeLayout();
  await ensureThemeLayout({
    pack: 'reflectpack',
    persist: false,
    reset: true,
    siteConfig: { themePack: 'reflectpack' }
  });
  assert.equal(reflected.length, 1, 'fresh theme layout mount should reflect config once by default');

  await ensureThemeLayout({
    pack: 'silentpack',
    persist: false,
    reset: true,
    siteConfig: { themePack: 'silentpack' },
    reflectThemeConfig: false
  });
  assert.equal(reflected.length, 1, 'reflectThemeConfig false should suppress fresh-mount reflection');

  await ensureThemeLayout({
    pack: 'silentpack',
    persist: false,
    siteConfig: { themePack: 'silentpack' }
  });
  assert.equal(reflected.length, 2, 'cached layout refresh should still reflect when not opted out');
});

await run('theme controls ignore retired legacy DOM bridge hints from the active theme context', async () => {
  const { setThemeLayoutContext } = await import('../assets/js/theme-regions.js');
  const { mountThemeControls } = await freshThemeHelpers();
  try {
    const installed = installGlobals({ savedPack: 'arcus' });
    const sidebar = installed.document.createElement('aside');
    sidebar.setAttribute('class', 'sidebar');
    const legacyTools = installed.document.createElement('div');
    legacyTools.setAttribute('id', 'tools');
    sidebar.appendChild(legacyTools);
    installed.document.body.appendChild(sidebar);
    setThemeLayoutContext({
      manifest: { contractVersion: 1 },
      theme: { contractVersion: 1 },
      regions: {}
    });

    const legacyComponent = mountThemeControls({ variant: 'arcus' });
    assert.equal(legacyComponent && legacyComponent.tagName, 'PRESS-THEME-CONTROLS');
    assert.equal(legacyComponent.getAttribute('contract-version'), null);
    assert.equal(legacyTools.parentElement, sidebar);
    assert.equal(sidebar.children[0], legacyTools);
    assert.equal(sidebar.children[1], legacyComponent);
  } finally {
    setThemeLayoutContext(null);
  }
});

await run('theme controls keep current component contract during legacy theme module mount', async () => {
  let mountedComponent = null;
  let legacyTools = null;
  const { mountThemeControls } = await freshThemeHelpers();
  const { document } = installGlobals({
    savedPack: 'legacy',
    manifests: {
      legacy: { ...makeManifest('legacy', ['modules/layout.js']), contractVersion: 1 }
    }
  });
  window.__pressThemeModuleLoader = async () => ({
    mount() {
      const sidebar = document.createElement('aside');
      sidebar.setAttribute('class', 'sidebar');
      legacyTools = document.createElement('div');
      legacyTools.setAttribute('id', 'tools');
      sidebar.appendChild(legacyTools);
      document.body.appendChild(sidebar);
      mountedComponent = mountThemeControls({ variant: 'arcus' });
    }
  });

  const { ensureThemeLayout } = await freshThemeLayout();
  await ensureThemeLayout({ pack: 'legacy', persist: false, reset: true });
  assert.equal(mountedComponent && mountedComponent.tagName, 'PRESS-THEME-CONTROLS');
  assert.equal(mountedComponent.getAttribute('contract-version'), null);
  assert.equal(legacyTools.parentElement && legacyTools.parentElement.matches('.sidebar'), true);
  assert.notEqual(legacyTools.parentElement.children[0], mountedComponent);
});

await run('theme controls hide language selector until public content languages resolve', async () => {
  const { document } = installGlobals({ savedPack: 'native' });
  const sidebar = document.createElement('aside');
  sidebar.setAttribute('class', 'sidebar');
  const component = document.createElement('press-theme-controls');
  const hiddenRoleCalls = [];
  const languageCalls = [];
  component.setLabels = () => {};
  component.render = () => {};
  component.setCurrentPack = () => {};
  component.setThemePacks = () => {};
  component.setHiddenRoles = (roles) => hiddenRoleCalls.push({ ...roles });
  component.setLanguages = (languages, current) => languageCalls.push({ languages, current });
  sidebar.appendChild(component);
  document.body.appendChild(sidebar);

  const i18n = await import('../assets/js/i18n.js');
  await i18n.initI18n({ lang: 'en', persist: false });
  const { mountThemeControls, refreshLanguageSelector } = await freshThemeHelpers();
  mountThemeControls({
    variant: 'arcus',
    siteConfig: {
      defaultLanguage: 'en',
      languages: { public: 'content' },
      features: { languageSwitcher: { enabled: true } }
    }
  });
  assert.equal(hiddenRoleCalls.at(-1).language, true, 'content policy should hide language controls before content languages resolve');

  await i18n.loadContentJsonWithRaw('wwwroot', 'index');
  refreshLanguageSelector();
  assert.equal(hiddenRoleCalls.at(-1).language, false, 'content policy should show language controls after two public content languages resolve');
  assert.deepEqual(
    languageCalls.at(-1).languages.map(item => item.value),
    ['en', 'chs'],
    'language controls should receive only public content languages'
  );
});

await run('theme controls keep disabled language switcher hidden after refresh', async () => {
  const { document } = installGlobals({ savedPack: 'native' });
  const sidebar = document.createElement('aside');
  sidebar.setAttribute('class', 'sidebar');
  const component = document.createElement('press-theme-controls');
  const hiddenRoleCalls = [];
  component.setLabels = () => {};
  component.render = () => {};
  component.setCurrentPack = () => {};
  component.setThemePacks = () => {};
  component.setHiddenRoles = (roles) => hiddenRoleCalls.push({ ...roles });
  component.setLanguages = () => {};
  sidebar.appendChild(component);
  document.body.appendChild(sidebar);

  const i18n = await import('../assets/js/i18n.js');
  await i18n.initI18n({ lang: 'en', persist: false });
  const { mountThemeControls, refreshLanguageSelector } = await freshThemeHelpers();
  mountThemeControls({
    variant: 'arcus',
    siteConfig: {
      defaultLanguage: 'en',
      languages: { public: 'content' },
      features: { languageSwitcher: { enabled: false } }
    }
  });
  assert.equal(hiddenRoleCalls.at(-1).language, true);

  await i18n.loadContentJsonWithRaw('wwwroot', 'index');
  refreshLanguageSelector();
  assert.equal(hiddenRoleCalls.at(-1).language, true, 'disabled language switcher should stay hidden even after content languages resolve');
});

await run('theme controls keep reset visible for stale non-public language', async () => {
  const { document } = installGlobals({ savedPack: 'native' });
  const sidebar = document.createElement('aside');
  sidebar.setAttribute('class', 'sidebar');
  const component = document.createElement('press-theme-controls');
  const hiddenRoleCalls = [];
  const languageCalls = [];
  component.setLabels = () => {};
  component.render = () => {};
  component.setCurrentPack = () => {};
  component.setThemePacks = () => {};
  component.setHiddenRoles = (roles) => hiddenRoleCalls.push({ ...roles });
  component.setLanguages = (languages, current) => languageCalls.push({ languages, current });
  sidebar.appendChild(component);
  document.body.appendChild(sidebar);

  const i18n = await import('../assets/js/i18n.js');
  await i18n.initI18n({ lang: 'ja', persist: false });
  const { mountThemeControls } = await freshThemeHelpers();
  mountThemeControls({
    variant: 'arcus',
    siteConfig: {
      defaultLanguage: 'en',
      languages: { public: 'explicit', publicList: ['en'] },
      features: { languageSwitcher: { enabled: true } }
    }
  });

  assert.equal(hiddenRoleCalls.at(-1).language, false, 'stale non-public language should keep reset controls visible');
  assert.deepEqual(
    languageCalls.at(-1).languages.map(item => item.value),
    ['en'],
    'single public fallback language should remain the only selectable public language'
  );
  assert.equal(languageCalls.at(-1).current, 'ja');
});

await run('theme modules load in parallel and mount in manifest order', async () => {
  const modules = ['modules/slow.js', 'modules/fast-a.js', 'modules/fast-b.js'];
  const requested = [];
  const mounted = [];
  let releaseSlowModule;
  const slowModuleReady = new Promise((resolve) => { releaseSlowModule = resolve; });
  installGlobals({
    savedPack: 'parallel',
    manifests: {
      parallel: makeManifest('parallel', modules)
    }
  });
  window.__pressThemeModuleLoader = async (path, context) => {
    const entry = context && context.entry ? context.entry : String(path || '');
    requested.push(entry);
    if (entry === 'modules/slow.js') await slowModuleReady;
    return {
      mount() {
        mounted.push(entry);
      }
    };
  };
  const { ensureThemeLayout } = await freshThemeLayout();
  const layoutPromise = ensureThemeLayout({ pack: 'parallel', persist: false });
  await waitFor(
    () => requested.length === modules.length,
    'theme modules should all be requested before the slow module resolves'
  );
  assert.deepEqual(requested, modules);
  assert.deepEqual(mounted, []);
  releaseSlowModule();
  await layoutPromise;
  assert.deepEqual(mounted, modules);
});

await run('theme layout controllers keep in-flight layout state per instance', async () => {
  const requested = [];
  let releaseModule = () => {};
  const moduleReady = new Promise((resolve) => { releaseModule = resolve; });
  installGlobals({
    savedPack: 'isolated',
    manifests: {
      isolated: makeManifest('isolated', ['modules/layout.js'])
    }
  });
  window.__pressThemeModuleLoader = async (path, context) => {
    requested.push(context && context.entry ? context.entry : String(path || ''));
    await moduleReady;
    return { mount() {} };
  };
  const { createThemeLayoutController } = await freshThemeLayout();
  const first = createThemeLayoutController();
  const second = createThemeLayoutController();
  const firstLayout = first.ensureThemeLayout({ pack: 'isolated', persist: false });
  const secondLayout = second.ensureThemeLayout({ pack: 'isolated', persist: false });
  await waitFor(
    () => requested.length === 2,
    'separate theme layout controllers should not share the same in-flight layout promise'
  );
  releaseModule();
  await Promise.all([firstLayout, secondLayout]);
  assert.deepEqual(requested, ['modules/layout.js', 'modules/layout.js']);
});

await run('theme layout controllers keep region contexts per instance', async () => {
  installGlobals({
    savedPack: 'alpha',
    manifests: {
      alpha: makeManifest('alpha', ['modules/layout.js']),
      beta: makeManifest('beta', ['modules/layout.js'])
    }
  });
  window.__pressThemeModuleLoader = async (_path, moduleContext) => ({
    mount(layoutContext) {
      const root = document.createElement('main');
      root.nodeType = 1;
      root.id = `${moduleContext.pack}-main`;
      root.setAttribute('data-theme-root', moduleContext.pack);
      root.setAttribute('data-theme-region', 'main');
      document.body.appendChild(root);
      return {
        regions: { main: root },
        effects: {
          renderPostView() {
            return moduleContext.pack;
          }
        }
      };
    }
  });
  const { createThemeLayoutController, getThemeLayoutContext } = await freshThemeLayout();
  const defaultContextBefore = getThemeLayoutContext();
  const first = createThemeLayoutController();
  const second = createThemeLayoutController();
  await first.ensureThemeLayout({ pack: 'alpha', persist: false, reset: true });
  const firstContext = first.getThemeLayoutContext();
  const firstRegion = first.getThemeRegion('main');
  await second.ensureThemeLayout({ pack: 'beta', persist: false, reset: true });
  assert.equal(first.getThemeLayoutContext(), firstContext);
  assert.equal(first.getThemeRegion('main'), firstRegion);
  assert.equal(first.getThemeApiHandler('renderPostView')(), 'alpha');
  assert.equal(second.getThemeRegion('main').id, 'beta-main');
  assert.equal(second.getThemeApiHandler('renderPostView')(), 'beta');
  assert.notEqual(first.getThemeLayoutContext(), second.getThemeLayoutContext());
  assert.equal(getThemeLayoutContext(), defaultContextBefore);
});

await run('external theme module load failures fall back without waiting for slow modules', async () => {
  const requested = [];
  let slowResolved = false;
  let releaseSlowModule = () => {};
  const slowModuleReady = new Promise((resolve) => {
    releaseSlowModule = () => {
      slowResolved = true;
      resolve({ mount() {} });
    };
  });
  const { document } = installGlobals({
    savedPack: 'broken-slow',
    manifests: {
      'broken-slow': makeManifest('broken-slow', ['modules/missing.js', 'modules/slow.js']),
      native: { ...makeManifest('native', ['modules/native.js']), styles: ['theme.css'] }
    }
  });
  window.__pressThemeModuleLoader = async (path, context) => {
    const entry = context && context.entry ? context.entry : String(path || '');
    requested.push(entry);
    if (entry === 'modules/missing.js') throw new Error('module missing');
    if (entry === 'modules/slow.js') return slowModuleReady;
    if (entry === 'modules/native.js') return { mount() {} };
    throw new Error(`Unexpected module: ${path}`);
  };
  const { ensureThemeLayout } = await freshThemeLayout();
  try {
    await withQuietConsole(() => Promise.race([
      ensureThemeLayout({ pack: 'broken-slow', persist: false }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('fallback waited for slow module')), 30))
    ]));
    assert(requested.includes('modules/missing.js'));
    assert(requested.includes('modules/slow.js'));
    assert.equal(slowResolved, false);
    assert.equal(document.body.dataset.themeLayout, 'native');
  } finally {
    releaseSlowModule();
  }
});

await run('external theme fallback clears partial DOM and extra styles', async () => {
  const loaded = [];
  const { document } = installGlobals({
    savedPack: 'partial',
    manifests: {
      partial: makeManifest('partial', ['modules/layout.js', 'modules/failing.js']),
      native: { ...makeManifest('native', ['modules/missing-native.js']), styles: ['theme.css'] }
    }
  });
  window.__pressThemeModuleLoader = async (path) => {
    loaded.push(String(path || ''));
    if (String(path || '').includes('/partial/modules/layout.js')) {
      return {
        mount() {
          const root = document.createElement('div');
          root.className = 'broken-shell';
          root.setAttribute('data-theme-root', 'container');
          document.body.appendChild(root);
          return { regions: { main: root } };
        }
      };
    }
    if (String(path || '').includes('/partial/modules/failing.js')) {
      return {
        mount() {
          throw new Error('mount failed after partial DOM');
        }
      };
    }
    throw new Error(`Missing module: ${path}`);
  };
  const { ensureThemeLayout } = await freshThemeLayout();
  await withQuietConsole(() => ensureThemeLayout());
  assert(loaded.some((path) => path.includes('/partial/modules/layout.js')));
  assert(loaded.some((path) => path.includes('/partial/modules/failing.js')));
  assert.equal(document.body.dataset.themeLayout, 'native');
  assert.equal(document.body.querySelector('.broken-shell'), null);
  assert.equal(document.querySelectorAll('link[data-theme-pack-extra-style]').length, 0);
});
