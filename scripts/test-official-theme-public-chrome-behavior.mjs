import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSiteFeatureContext } from '../assets/js/site-features.js';

const here = dirname(fileURLToPath(import.meta.url));
const pressRoot = resolve(here, '..');

class TestElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.dataset = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.innerHTML = '';
    this.textContent = '';
  }

  appendChild(child) {
    if (!child) return child;
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, ref) {
    const index = this.children.indexOf(ref);
    if (index < 0) return this.appendChild(child);
    child.parentElement = this;
    this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    if (child) child.parentElement = null;
    return child;
  }

  setAttribute(name, value = '') {
    const key = String(name);
    const str = String(value);
    this.attributes.set(key, str);
    if (key === 'id') this.id = str;
    if (key === 'class') this.className = str;
    if (key === 'hidden') this.hidden = true;
    if (key.startsWith('data-')) {
      const dataKey = key.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      this.dataset[dataKey] = str;
    }
  }

  getAttribute(name) {
    const key = String(name);
    if (this.attributes.has(key)) return this.attributes.get(key);
    return null;
  }

  removeAttribute(name) {
    const key = String(name);
    this.attributes.delete(key);
    if (key === 'hidden') this.hidden = false;
  }

  addEventListener() {}
  removeEventListener() {}

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  matches() {
    return false;
  }

  scrollIntoView() {}
}

class TestDocument {
  constructor() {
    this.body = new TestElement('body');
    this.documentElement = new TestElement('html');
    this.defaultView = createTestWindow();
  }

  createElement(tagName) {
    return new TestElement(tagName);
  }

  getElementById() {
    return null;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

function createTestWindow() {
  return {
    location: { href: 'https://example.test/', search: '' },
    history: { replaceState() {}, pushState() {} },
    matchMedia: () => ({ matches: false }),
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    setTimeout,
    clearTimeout
  };
}

function disabledFeatureContext() {
  return createSiteFeatureContext({
    features: {
      tags: { enabled: false },
      toc: { enabled: false },
      postMeta: { enabled: false },
      search: { enabled: false }
    }
  });
}

function tagsOffPostMetaOnContext() {
  return createSiteFeatureContext({
    features: {
      tags: { enabled: false },
      toc: { enabled: false },
      postMeta: { enabled: true },
      search: { enabled: false }
    }
  });
}

function resolveThemeInteractionsPath(slug) {
  const installed = resolve(pressRoot, 'assets/themes', slug, 'modules/interactions.js');
  if (existsSync(installed)) return installed;
  const repoNames = {
    arcus: 'Press-Theme-Arcus',
    cartograph: 'Press-Theme-Cartograph',
    glasswing: 'Press-Theme-Glasswing',
    solstice: 'Press-Theme-Solstice'
  };
  const repoName = repoNames[slug];
  if (!repoName) return '';
  const sibling = resolve(pressRoot, '..', repoName, 'theme/modules/interactions.js');
  return existsSync(sibling) ? sibling : '';
}

async function mountTheme(slug) {
  const sourcePath = resolveThemeInteractionsPath(slug);
  if (!sourcePath) return null;
  globalThis.document = new TestDocument();
  globalThis.window = globalThis.document.defaultView;
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const tempRoot = mkdtempSync(resolve(tmpdir(), `press-theme-${slug}-`));
  const tempModuleDir = resolve(tempRoot, 'assets/themes', slug, 'modules');
  mkdirSync(tempModuleDir, { recursive: true });
  mkdirSync(resolve(tempRoot, 'assets'), { recursive: true });
  symlinkSync(resolve(pressRoot, 'assets/js'), resolve(tempRoot, 'assets/js'), 'dir');
  writeFileSync(
    resolve(tempModuleDir, 'interactions.js'),
    readFileSync(sourcePath, 'utf8')
  );
  const moduleUrl = pathToFileURL(resolve(tempModuleDir, 'interactions.js')).href;
  const module = await import(`${moduleUrl}?public-chrome-behavior=${Date.now()}-${Math.random()}`);
  return module.mount({
    document: globalThis.document,
    window: globalThis.window,
    features: disabledFeatureContext(),
    i18n: {
      t: (key) => key,
      withLangParam: (href) => href,
      getCurrentLang: () => 'en'
    }
  });
}

async function assertThemeChromeDisabled(slug) {
  const api = await mountTheme(slug);
  if (!api) return false;
  const main = new TestElement('main');
  const toc = new TestElement('press-toc');
  const features = disabledFeatureContext();
  const entry = ['Feature post', {
    location: 'post/example.md',
    date: '2026-01-01',
    tag: ['alpha', 'beta'],
    excerpt: 'Summary'
  }];

  assert.equal(api.views.posts({
    container: main,
    pageEntries: [entry],
    page: 1,
    totalPages: 1,
    siteConfig: {},
    features
  }), true);
  assert.doesNotMatch(main.innerHTML, /<template data-slot="tags">[\s\S]*alpha[\s\S]*<\/template>/, `${slug} posts cards should hide tags`);

  assert.equal(api.views.search({
    container: main,
    entries: [entry],
    query: 'Feature',
    page: 1,
    totalPages: 1,
    siteConfig: {},
    features
  }), true);
  assert.doesNotMatch(main.innerHTML, /<template data-slot="tags">[\s\S]*alpha[\s\S]*<\/template>/, `${slug} search cards should hide tags`);

  api.views.post({
    containers: { mainElement: main },
    markdownHtml: '<p>Body</p>',
    fallbackTitle: 'Feature post',
    postMetadata: entry[1],
    markdown: '# Feature post',
    postId: 'post/example.md',
    siteConfig: {},
    features,
    utilities: {}
  });
  assert.doesNotMatch(main.innerHTML, /article__meta-line/, `${slug} post view should hide date metadata`);
  assert.doesNotMatch(main.innerHTML, /alpha|beta/, `${slug} post view should hide article tags`);

  api.views.post({
    containers: { mainElement: main },
    markdownHtml: '<p>Body</p>',
    fallbackTitle: 'Feature post',
    postMetadata: entry[1],
    markdown: '# Feature post',
    postId: 'post/example.md',
    siteConfig: {},
    features: tagsOffPostMetaOnContext(),
    utilities: {}
  });
  assert.match(main.innerHTML, /post-meta-card/, `${slug} post view should keep post meta when only tags are disabled`);
  assert.doesNotMatch(main.innerHTML, /alpha|beta/, `${slug} post meta card should hide tags when tags are disabled`);

  assert.equal(api.views.tab({
    containers: { mainElement: main, tocElement: toc },
    title: 'About',
    markdownHtml: '<h2 id="overview">Overview</h2>',
    tocHtml: '<a href="#overview">Overview</a>',
    features,
    utilities: {}
  }), true);
  assert.equal(toc.hidden, true, `${slug} static tab should hide TOC`);
  assert.equal(toc.innerHTML, '', `${slug} static tab should clear TOC`);
  return true;
}

const testedSlugs = [];
for (const slug of ['arcus', 'solstice']) {
  if (await assertThemeChromeDisabled(slug)) testedSlugs.push(slug);
}

console.log(`ok - official theme public chrome behavior${testedSlugs.length ? ` (${testedSlugs.join(', ')})` : ' (external theme fixtures unavailable)'}`);
