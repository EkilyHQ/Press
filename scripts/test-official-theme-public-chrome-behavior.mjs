import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSiteFeatureContext } from '../assets/js/site-features.js';

const here = dirname(fileURLToPath(import.meta.url));
const pressRoot = resolve(here, '..');
const fixtureRoot = resolve(here, 'fixtures/official-theme-public-chrome');
const expectedFixtureRepositories = {
  arcus: 'EkilyHQ/Press-Theme-Arcus',
  solstice: 'EkilyHQ/Press-Theme-Solstice'
};

function loadPinnedFixtureSources() {
  const provenancePath = resolve(fixtureRoot, 'provenance.json');
  assert.equal(existsSync(provenancePath), true, 'official theme fixture provenance must exist');
  const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
  assert.equal(provenance.schemaVersion, 1, 'official theme fixture provenance must use schema version 1');
  assert.deepEqual(
    Object.keys(provenance.fixtures || {}).sort(),
    Object.keys(expectedFixtureRepositories).sort(),
    'official theme fixture provenance must cover the tested themes exactly'
  );

  return new Map(Object.entries(expectedFixtureRepositories).map(([slug, repository]) => {
    const record = provenance.fixtures[slug];
    assert.equal(record.repository, repository, `${slug} fixture must name its official repository`);
    assert.equal(record.sourcePath, 'theme/modules/interactions.js', `${slug} fixture must name the interactions source path`);
    assert.match(record.sourceCommit || '', /^[0-9a-f]{40}$/u, `${slug} fixture must pin a full source commit`);
    assert.match(record.sha256 || '', /^[0-9a-f]{64}$/u, `${slug} fixture must pin a SHA-256 digest`);
    assert.equal(
      record.fixturePath,
      `scripts/fixtures/official-theme-public-chrome/${slug}/interactions.js.txt`,
      `${slug} fixture path must stay inside the Press-owned fixture directory`
    );
    const fixturePath = resolve(pressRoot, record.fixturePath);
    assert.equal(existsSync(fixturePath), true, `${slug} pinned fixture must exist`);
    const digest = createHash('sha256').update(readFileSync(fixturePath)).digest('hex');
    assert.equal(digest, record.sha256, `${slug} pinned fixture digest must match provenance`);
    return [slug, fixturePath];
  }));
}

const pinnedFixtureSources = loadPinnedFixtureSources();
const temporaryThemeRoots = new Set();

function cleanupTemporaryThemeRoot(path) {
  if (!path) return;
  rmSync(path, { force: true, recursive: true });
  temporaryThemeRoots.delete(path);
}

process.once('exit', () => {
  temporaryThemeRoots.forEach((path) => cleanupTemporaryThemeRoot(path));
});

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

function resolveThemeInteractionsSource(slug) {
  const repoNames = {
    arcus: 'Press-Theme-Arcus',
    cartograph: 'Press-Theme-Cartograph',
    glasswing: 'Press-Theme-Glasswing',
    solstice: 'Press-Theme-Solstice'
  };
  const repoName = repoNames[slug];
  if (!repoName) throw new Error(`no official theme source mapping for ${slug}`);
  const sibling = resolve(pressRoot, '..', repoName, 'theme/modules/interactions.js');
  if (existsSync(sibling)) return { kind: 'workspace', path: sibling };
  const fixture = pinnedFixtureSources.get(slug);
  if (fixture && existsSync(fixture)) return { kind: 'fixture', path: fixture };
  throw new Error(`no workspace or pinned fixture source available for ${slug}`);
}

async function mountTheme(slug) {
  const source = resolveThemeInteractionsSource(slug);
  globalThis.document = new TestDocument();
  globalThis.window = globalThis.document.defaultView;
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  const tempRoot = mkdtempSync(resolve(tmpdir(), `press-theme-${slug}-`));
  temporaryThemeRoots.add(tempRoot);
  const tempModuleDir = resolve(tempRoot, 'assets/themes', slug, 'modules');
  mkdirSync(tempModuleDir, { recursive: true });
  mkdirSync(resolve(tempRoot, 'assets'), { recursive: true });
  symlinkSync(resolve(pressRoot, 'assets/js'), resolve(tempRoot, 'assets/js'), 'dir');
  writeFileSync(
    resolve(tempModuleDir, 'interactions.js'),
    readFileSync(source.path, 'utf8')
  );
  const moduleUrl = pathToFileURL(resolve(tempModuleDir, 'interactions.js')).href;
  const module = await import(`${moduleUrl}?public-chrome-behavior=${Date.now()}-${Math.random()}`);
  return {
    api: module.mount({
      document: globalThis.document,
      window: globalThis.window,
      features: disabledFeatureContext(),
      i18n: {
        t: (key) => key,
        withLangParam: (href) => href,
        getCurrentLang: () => 'en'
      }
    }),
    cleanup: () => cleanupTemporaryThemeRoot(tempRoot),
    source: source.kind
  };
}

async function assertThemeChromeDisabled(slug) {
  const mounted = await mountTheme(slug);
  const { api } = mounted;
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
  const source = mounted.source;
  mounted.cleanup();
  return source;
}

const testedSources = [];
for (const slug of ['arcus', 'solstice']) {
  testedSources.push(`${slug}:${await assertThemeChromeDisabled(slug)}`);
}

console.log(`ok - official theme public chrome behavior (${testedSources.join(', ')})`);
