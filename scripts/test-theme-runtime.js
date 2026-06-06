import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const themeSource = readFileSync(resolve(here, '../assets/js/theme.js'), 'utf8');
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
    addEventListener() {},
    removeEventListener() {},
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

async function freshThemeHelpers() {
  importCounter += 1;
  return import(`../assets/js/theme.js?theme-runtime-test=${importCounter}`);
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

await run('theme controls infer legacy DOM bridge from the active theme context', async () => {
  const { setThemeLayoutContext } = await import('../assets/js/theme-regions.js');
  const { mountThemeControls } = await freshThemeHelpers();
  try {
    let installed = installGlobals({ savedPack: 'arcus' });
    let sidebar = installed.document.createElement('aside');
    sidebar.setAttribute('class', 'sidebar');
    let legacyTools = installed.document.createElement('div');
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
    assert.equal(legacyComponent.getAttribute('contract-version'), '1');
    assert.equal(legacyTools.parentElement, null);
    assert.equal(sidebar.children[0], legacyComponent);

    installed = installGlobals({ savedPack: 'arcus' });
    sidebar = installed.document.createElement('aside');
    sidebar.setAttribute('class', 'sidebar');
    legacyTools = installed.document.createElement('div');
    legacyTools.setAttribute('id', 'tools');
    sidebar.appendChild(legacyTools);
    installed.document.body.appendChild(sidebar);
    setThemeLayoutContext({
      manifest: { contractVersion: 2 },
      theme: { contractVersion: 2 },
      regions: {}
    });

    const currentComponent = mountThemeControls({ variant: 'arcus' });
    assert.equal(currentComponent && currentComponent.tagName, 'PRESS-THEME-CONTROLS');
    assert.equal(currentComponent.getAttribute('contract-version'), '2');
    assert.equal(legacyTools.parentElement, sidebar);
    assert.notEqual(sidebar.children[0], currentComponent);
  } finally {
    setThemeLayoutContext(null);
  }
});

await run('theme controls infer legacy DOM bridge during v1 theme module mount', async () => {
  let mountedComponent = null;
  let legacyTools = null;
  const { mountThemeControls } = await freshThemeHelpers();
  const { document } = installGlobals({
    savedPack: 'legacy',
    manifests: {
      legacy: makeManifest('legacy', ['modules/layout.js'])
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
  assert.equal(mountedComponent.getAttribute('contract-version'), '1');
  assert.equal(legacyTools.parentElement, null);
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
