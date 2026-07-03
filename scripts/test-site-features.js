import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SITE_FEATURE_KEYS,
  createSiteFeatureContext,
  isSiteFeatureEnabled,
  resolveSiteFeatures,
  siteFeatureSettingsForOutput
} from '../assets/js/site-features.js';
import {
  computeSiteDiff,
  prepareSiteState,
  toSiteYaml
} from '../assets/js/composer-site-model.js';
import { renderPostMetaCard } from '../assets/js/templates.js';
import { mount as mountNativeTheme } from '../assets/themes/native/modules/interactions.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

const defaults = resolveSiteFeatures({});
assert.deepEqual(Object.keys(defaults), SITE_FEATURE_KEYS);
SITE_FEATURE_KEYS.forEach((key) => {
  assert.equal(defaults[key], true, `${key} should default to enabled`);
});

assert.equal(resolveSiteFeatures({ showAllPosts: false }).allPosts, false);
assert.equal(resolveSiteFeatures({ enableAllPosts: true }).allPosts, true);
assert.equal(resolveSiteFeatures({ disableAllPosts: true }).allPosts, false);
assert.equal(
  resolveSiteFeatures({ showAllPosts: false, features: { allPosts: { enabled: true } } }).allPosts,
  true,
  'features.allPosts.enabled should override legacy showAllPosts'
);
assert.equal(
  resolveSiteFeatures({ disableAllPosts: true, features: { allPosts: { enabled: false } } }).allPosts,
  false,
  'features.allPosts.enabled should override legacy disableAllPosts'
);

assert.equal(isSiteFeatureEnabled({ features: { search: { enabled: false } } }, 'search'), false);
assert.equal(isSiteFeatureEnabled({ features: { search: { enabled: true } } }, 'search'), true);
assert.equal(createSiteFeatureContext({ features: { comments: { enabled: false } } }).isEnabled('comments'), false);
assert.deepEqual(siteFeatureSettingsForOutput({ search: false, footerNav: true }), {
  search: { enabled: false },
  footerNav: { enabled: true }
});

const state = prepareSiteState({
  siteTitle: 'Feature site',
  features: {
    search: { enabled: false },
    editorEntry: { enabled: false },
    allPosts: { enabled: true }
  },
  showAllPosts: false
});
assert.equal(state.features.search, false);
assert.equal(state.features.editorEntry, false);
assert.equal(state.features.allPosts, true);

const yaml = toSiteYaml(state);
assert.match(yaml, /^features:\n/m, 'site.yaml output should include feature settings');
assert.match(yaml, /search:\n\s+enabled: false/, 'site.yaml output should serialize disabled search');
assert.match(yaml, /editorEntry:\n\s+enabled: false/, 'site.yaml output should serialize disabled editor entry');
assert.match(yaml, /allPosts:\n\s+enabled: true/, 'site.yaml output should serialize feature allPosts precedence');

const diff = computeSiteDiff(
  prepareSiteState({ features: { search: { enabled: false } } }),
  prepareSiteState({})
);
assert.equal(diff.hasChanges, true);
assert.equal(diff.fields.features.fields.search, true);

const seoSource = read('assets/js/seo.js');
assert.match(
  seoSource,
  /if \(isSiteFeatureEnabled\(siteConfig, 'search'\)\) \{[\s\S]*"@type": "SearchAction"/,
  'SEO structured data should only emit SearchAction when search is enabled'
);

const mainSource = read('assets/main.js');
assert.match(mainSource, /function siteFeatureEnabled\(key\) \{[\s\S]*isSiteFeatureEnabled\(siteConfig, key\)/, 'main should resolve features through the site feature resolver');
assert.match(mainSource, /function searchEnabled\(\)[\s\S]*siteFeatureEnabled\('search'\)/, 'main should resolve search through the site feature resolver');
assert.match(mainSource, /function tagNavigationEnabled\(\)[\s\S]*siteFeatureEnabled\('tags'\) && searchEnabled\(\)/, 'tag sidebar navigation should require both tags and search');
assert.match(mainSource, /function postsEnabled\(\)[\s\S]*siteFeatureEnabled\('allPosts'\)/, 'main should resolve All Posts through the site feature resolver');
assert.match(mainSource, /if \(!searchEnabled\(\)\) return displayHomeFallback\(\);/, 'disabled search route should fall back to home');
assert.match(mainSource, /const tagFilter = rawTag && tagNavigationEnabled\(\) \? String\(rawTag\)\.trim\(\) : '';/, 'direct tag routes should be ignored when tag navigation is disabled');
assert.match(
  mainSource,
  /const rawTag = getQueryVariable\('tag'\) \|\| '';[\s\S]*const tag = tagNavigationEnabled\(\) \? rawTag : '';[\s\S]*if \(rawTag && !tagNavigationEnabled\(\) && !q\) \{[\s\S]*displayHomeFallback\(\);[\s\S]*\} else \{[\s\S]*displaySearch\(q\);/,
  'route-level search SEO should ignore disabled tag-only routes and fall back before rendering search metadata'
);
assert.match(
  mainSource,
  /if \(rawTag && !tagNavigationEnabled\(\) && !q\) \{[\s\S]*displayHomeFallback\(\);[\s\S]*\} else \{[\s\S]*\}\s*else if \(tab !== 'posts' && tabsBySlug\[tab\]\)/,
  'disabled tag-only search fallback should stay on the route path so common finalizers still run'
);
assert.doesNotMatch(
  mainSource,
  /if \(rawTag && !tagNavigationEnabled\(\) && !q\) \{[\s\S]*return;[\s\S]*\}\s*renderTabs\('search'/,
  'disabled tag-only search fallback should not return before common route finalizers'
);
assert.match(mainSource, /if \(!query && !tag\) return \[\];/, 'enabled empty search should render an empty search state instead of all posts');
assert.doesNotMatch(mainSource, /if \(!q && !tagFilter\) return displayHomeFallback\(\);/, 'enabled empty search should remain on the search route');
assert.doesNotMatch(mainSource, /if \(!q && !tagFilter\) return displayIndex\(postsIndexCache\);/, 'empty search should not render All Posts directly');
assert.doesNotMatch(mainSource, /Object\.keys\(tabsBySlug \|\| \{\}\)\[0\] \|\| \(searchEnabled\(\) \? 'search' : ''\)/, 'search should not be used as a synthetic home fallback');
assert.match(mainSource, /if \(!postsEnabled\(\) && tab === 'posts'\) tab = homeSlug;/, 'disabled posts route should fall back to home');
assert.match(
  mainSource,
  /callThemeEffect\('setupFooter', \{[\s\S]*features: getSiteFeatureContext\(\)[\s\S]*getHomeSlug: \(\) => getHomeSlug\(\)[\s\S]*postsEnabled: \(\) => postsEnabled\(\)/,
  'late footer setup should receive feature and home helpers'
);

const i18nSource = read('assets/i18n/en.js');
assert.doesNotMatch(
  i18nSource,
  /publicChromeHomeWarning:[^\n]*Search/,
  'home warning copy should not suggest Search as a home fallback'
);

const siteSettingsGridSource = read('assets/js/composer-site-settings-config-grids.js');
assert.match(
  siteSettingsGridSource,
  /const hasStaticTab = order\.some\(slug => tabHasReachableLocation\(slug\)\);[\s\S]*const hasReachableHome = getFeatureEnabled\('allPosts'\) \|\| hasStaticTab;/,
  'editor home warning should match runtime fallback and not treat search as home'
);
assert.match(
  siteSettingsGridSource,
  /const tabHasReachableLocation = \(slug\) => \{[\s\S]*typeof value\.location === 'string' && value\.location\.trim\(\)[\s\S]*\};/,
  'editor home warning should only count tabs with a reachable location'
);
assert.doesNotMatch(
  siteSettingsGridSource,
  /const hasReachableHome = getFeatureEnabled\('allPosts'\) \|\| getFeatureEnabled\('search'\)/,
  'editor home warning should not treat search as a reachable home'
);
assert.match(
  siteSettingsGridSource,
  /toggle\.dataset\.field = 'features';[\s\S]*toggle\.dataset\.subfield = key;/,
  'public chrome toggles should use object diff markers for dirty highlighting'
);
assert.doesNotMatch(
  siteSettingsGridSource,
  /toggle\.dataset\.field = `features\.\$\{key\}\.enabled`;/,
  'public chrome toggles should not use flattened feature paths that diff markers cannot match'
);
assert.match(
  siteSettingsGridSource,
  /let refreshLandingOptions = noop;[\s\S]*refreshLandingOptions = renderLandingOptions;[\s\S]*if \(key === 'allPosts'\) refreshLandingOptions\(\);/,
  'All Posts public chrome changes should refresh landing tab options in the same settings session'
);

const editorPreviewRuntimeSource = read('assets/js/editor-preview-runtime.js');
assert.match(
  editorPreviewRuntimeSource,
  /const features = createSiteFeatureContext\(payload\.siteConfig \|\| \{\}\)[\s\S]*themeLayout\.ensureThemeLayout\(\{[\s\S]*features[\s\S]*const ctx = createRuntimeContext\(\{ payload, containers, content, features \}\)[\s\S]*features,/,
  'editor preview should pass the same feature context to theme layout, ctx, and renderPostView params'
);

const nativeThemeSource = read('assets/themes/native/modules/interactions.js');
assert.match(
  nativeThemeSource,
  /const showTags = featureEnabled\(params, runtimeState, 'tags'\) && featureEnabled\(params, runtimeState, 'search'\);[\s\S]*const tag = showTags && value \? renderTags\(value\.tag\) : '';/,
  'native index cards should hide tag chips when tags or search are disabled'
);
assert.match(
  nativeThemeSource,
  /renderMetaFn\(titleForMeta, metadata, markdown, \{[\s\S]*showTags: featureEnabled\(params, runtimeState, 'tags'\) && featureEnabled\(params, runtimeState, 'search'\)/,
  'native post meta cards should pass the tags and search feature gates into shared meta rendering'
);
assert.match(
  nativeThemeSource,
  /renderPostTOCNative\(\{ tocElement, articleTitle, tocHtml, translate, features: params\.features \}/,
  'native post TOC rendering should use the current render feature context'
);
assert.match(
  nativeThemeSource,
  /try \{ toc\.hidden = false; \} catch \(_\) \{\}[\s\S]*try \{ toc\.removeAttribute\('hidden'\); \} catch \(_\) \{\}[\s\S]*try \{ toc\.setAttribute\('aria-hidden', 'false'\); \} catch \(_\) \{\}/,
  'native post TOC enabled path should clear stale hidden state from prior disabled renders'
);
assert.match(
  nativeThemeSource,
  /if \(!featureEnabled\(params, runtimeState, 'tags'\) \|\| !featureEnabled\(params, runtimeState, 'search'\)\) \{/,
  'native tag sidebar should be hidden when either tags or search is disabled'
);
assert.match(
  nativeThemeSource,
  /if \(activeSlug === 'search' && featureEnabled\(params, runtimeState, 'search'\)\) \{[\s\S]*compact \+= `<a class="tab active" data-slug="search"/,
  'native compact tabs should only render stale search chrome when search is enabled'
);
assert.match(
  nativeThemeSource,
  /else if \(activeSlug && activeSlug !== 'posts' && activeSlug !== 'search'\) \{/,
  'native compact generic tab fallback should not recreate disabled stale search tabs'
);
assert.match(
  nativeThemeSource,
  /if \(toc && !featureEnabled\(params, runtimeState, 'toc'\)\) \{[\s\S]*toc\.setAttribute\('aria-hidden', 'true'\)/,
  'native post loading state should hide TOC chrome when toc is disabled'
);
assert.match(
  nativeThemeSource,
  /const setSeparatorVisible = \(visible\) => \{[\s\S]*parent\.querySelector\('\.footer-sep'\)[\s\S]*setSeparatorVisible\(false\);/,
  'native footer nav should hide its separator when footer nav is disabled'
);
assert.match(
  nativeThemeSource,
  /const showPostMeta = featureEnabled\(params, runtimeState, 'postMeta'\);[\s\S]*const dateLabel = showPostMeta && hasDate \? formatDisplayDate\(value\.date\) : '';[\s\S]*const versionsLabel = showPostMeta && verCount > 1 \? translate\('ui\.versionsCount', verCount\) : '';/,
  'native index cards should hide date and version card metadata when postMeta is disabled'
);
assert.match(
  nativeThemeSource,
  /function afterIndexRenderNative[\s\S]*updateCardMetadata\(params\.entries \|\| \[\], \{[\s\S]*showPostMeta: featureEnabled\(params, runtimeState, 'postMeta'\)/,
  'native after-index metadata hydration should receive the postMeta feature gate'
);
assert.match(
  nativeThemeSource,
  /function afterSearchRenderNative[\s\S]*updateCardMetadata\(params\.entries \|\| \[\], \{[\s\S]*showPostMeta: featureEnabled\(params, runtimeState, 'postMeta'\)/,
  'native after-search metadata hydration should receive the postMeta feature gate'
);

assert.doesNotMatch(
  mainSource,
  /if \(searchEnabled\(\)\) \{\s*callThemeEffect\('updateSearchPlaceholder'/,
  'search placeholder effect should run even when search is disabled so themes can hide search chrome'
);
assert.match(
  mainSource,
  /callThemeEffect\('updateSearchPlaceholder', \{[\s\S]*features: getSiteFeatureContext\(\)[\s\S]*\}\);[\s\S]*try \{ setupSearchForSite\(\); \} catch \(_\) \{\}/,
  'theme search placeholder effect should receive feature context before search binding setup'
);

assert.doesNotMatch(
  renderPostMetaCard('Tagged', { tag: ['alpha', 'beta'] }, '# Tagged', { showTags: false }),
  /alpha|beta/,
  'shared post meta card should hide tags when requested'
);
assert.match(
  renderPostMetaCard('Tagged', { tag: ['alpha'] }, '# Tagged'),
  /alpha/,
  'shared post meta card should keep existing tag behavior by default'
);

class TocProbe {
  constructor() {
    this.hidden = false;
    this.innerHTML = '';
    this.attributes = new Map();
    this.style = {};
  }

  clear() {
    this.innerHTML = '';
  }

  renderToc(options = {}) {
    this.innerHTML = String(options.tocHtml || '');
    return !!this.innerHTML;
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
    if (String(name) === 'hidden') this.hidden = false;
  }

  querySelector(selector = '') {
    const wanted = String(selector || '').trim();
    if (wanted.startsWith('.')) {
      const cls = wanted.slice(1);
      return this.children.find((child) => String(child.className || '').split(/\s+/).includes(cls)) || null;
    }
    return null;
  }

  addEventListener() {}
  removeEventListener() {}
}

class ElementProbe {
  constructor(tagName = 'div') {
    this.innerHTML = '';
    this.textContent = '';
    this.children = [];
    this.childNodes = this.children;
    this.style = {
      setProperty(name, value) {
        this[String(name)] = String(value);
      },
      removeProperty(name) {
        delete this[String(name)];
      }
    };
    this.parentNode = null;
    this.parentElement = null;
    this.clientWidth = 1000;
    this.offsetWidth = 100;
    this.className = '';
    this.tagName = String(tagName || 'div').toUpperCase();
    this.attributes = new Map();
    this.classList = {
      contains: (cls) => String(this.className || '').split(/\s+/).includes(String(cls || '')),
      add: (cls) => {
        const values = new Set(String(this.className || '').split(/\s+/).filter(Boolean));
        values.add(String(cls || ''));
        this.className = Array.from(values).join(' ');
      },
      remove: (cls) => {
        const values = new Set(String(this.className || '').split(/\s+/).filter(Boolean));
        values.delete(String(cls || ''));
        this.className = Array.from(values).join(' ');
      }
    };
  }

  get firstChild() {
    return this.children[0] || null;
  }

  replaceChildren() {
    this.innerHTML = '';
    this.textContent = '';
    this.children = [];
    this.childNodes = this.children;
  }

  appendChild(child) {
    if (child) {
      child.parentNode = this;
      child.parentElement = this;
      this.children.push(child);
    }
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    if (child) {
      child.parentNode = null;
      child.parentElement = null;
    }
    return child;
  }

  insertAdjacentHTML(_position, html) {
    this.innerHTML += String(html || '');
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  matchesSelector(selector = '') {
    const wanted = String(selector || '').trim();
    if (!wanted) return false;
    if (wanted.startsWith('.')) {
      const classes = wanted.slice(1).split('.').filter(Boolean);
      const values = String(this.className || '').split(/\s+/).filter(Boolean);
      return classes.every((cls) => values.includes(cls));
    }
    return String(this.tagName || '').toLowerCase() === wanted.toLowerCase();
  }

  querySelector(selector = '') {
    for (const child of this.children) {
      if (child && typeof child.matchesSelector === 'function' && child.matchesSelector(selector)) return child;
      if (child && typeof child.querySelector === 'function') {
        const found = child.querySelector(selector);
        if (found) return found;
      }
    }
    return null;
  }

  querySelectorAll(selector = '') {
    const results = [];
    for (const child of this.children) {
      if (child && typeof child.matchesSelector === 'function' && child.matchesSelector(selector)) results.push(child);
      if (child && typeof child.querySelectorAll === 'function') {
        results.push(...child.querySelectorAll(selector));
      }
    }
    return results;
  }

  addEventListener() {}
  removeEventListener() {}

  cloneNode() {
    const clone = new ElementProbe(this.tagName);
    clone.innerHTML = this.innerHTML;
    clone.textContent = this.textContent;
    clone.clientWidth = this.clientWidth;
    clone.offsetWidth = this.offsetWidth;
    clone.className = this.className;
    return clone;
  }

  getBoundingClientRect() {
    return { width: this.clientWidth };
  }
}

const tocProbe = new TocProbe();
const mainProbe = new ElementProbe();
const bodyProbe = new ElementProbe();
const fakeDocument = {
  querySelector: () => null,
  createElement: (tagName) => new ElementProbe(tagName),
  body: bodyProbe
};
const nativeApi = mountNativeTheme({
  document: fakeDocument,
  window: {},
  regions: { toc: tocProbe, main: mainProbe },
  i18n: { t: (key) => key }
});
nativeApi.effects.renderPostTOC({
  tocElement: tocProbe,
  tocHtml: '<a href="#intro">Intro</a>',
  features: createSiteFeatureContext({ features: { toc: { enabled: false } } })
});
assert.equal(tocProbe.hidden, true, 'disabled native TOC render should hide the TOC');
assert.equal(tocProbe.innerHTML, '', 'disabled native TOC render should clear content');
nativeApi.effects.renderPostTOC({
  tocElement: tocProbe,
  tocHtml: '<a href="#intro">Intro</a>',
  features: createSiteFeatureContext({ features: { toc: { enabled: true } } })
});
assert.equal(tocProbe.hidden, false, 'enabled native TOC render should clear stale hidden state');
assert.match(tocProbe.innerHTML, /Intro/, 'enabled native TOC render should repopulate content after a disabled render');
assert.equal(tocProbe.attributes.get('aria-hidden'), 'false', 'enabled native TOC render should mark the TOC visible');

tocProbe.innerHTML = '<div class="toc-header">Loading</div>';
tocProbe.hidden = false;
tocProbe.attributes.delete('aria-hidden');
nativeApi.effects.renderPostLoadingState({
  containers: { mainElement: mainProbe, tocElement: tocProbe },
  features: createSiteFeatureContext({ features: { toc: { enabled: false } } }),
  renderSkeletonArticle: () => '<article>Loading</article>',
  ensureAutoHeight() {}
});
assert.equal(tocProbe.hidden, true, 'disabled native post loading state should hide TOC');
assert.equal(tocProbe.innerHTML, '', 'disabled native post loading state should clear stale TOC content');
assert.equal(tocProbe.attributes.get('aria-hidden'), 'true', 'disabled native post loading state should keep TOC aria-hidden');
assert.equal(tocProbe.style.display, 'none', 'disabled native post loading state should hide TOC display');
assert.match(mainProbe.innerHTML, /Loading/, 'disabled native post loading state should still render the main skeleton');
nativeApi.effects.renderPostTOC({
  tocElement: tocProbe,
  tocHtml: '<a href="#intro">Intro</a>',
  features: createSiteFeatureContext({ features: { toc: { enabled: true } } })
});
assert.equal(tocProbe.style.display, '', 'enabled native TOC render should clear stale display:none from disabled loading state');

const footerLeftProbe = new ElementProbe('div');
const footerSepProbe = new ElementProbe('span');
footerSepProbe.className = 'footer-sep';
const footerNavProbe = new ElementProbe('nav');
footerNavProbe.id = 'footerNav';
footerLeftProbe.appendChild(footerSepProbe);
footerLeftProbe.appendChild(footerNavProbe);
fakeDocument.getElementById = (id) => (id === 'footerNav' ? footerNavProbe : null);
nativeApi.effects.renderFooterNav({
  tabsBySlug: { overview: { title: 'Overview' } },
  getHomeSlug: () => 'overview',
  getHomeLabel: () => 'Overview',
  postsEnabled: () => false,
  getQueryVariable: () => '',
  features: createSiteFeatureContext({ features: { footerNav: { enabled: false } } })
});
assert.equal(footerNavProbe.hidden, true, 'disabled native footer nav should hide nav');
assert.equal(footerSepProbe.hidden, true, 'disabled native footer nav should hide the separator');
assert.equal(footerSepProbe.attributes.get('aria-hidden'), 'true', 'disabled native footer nav separator should be aria-hidden');
nativeApi.effects.renderFooterNav({
  tabsBySlug: { overview: { title: 'Overview' } },
  getHomeSlug: () => 'overview',
  getHomeLabel: () => 'Overview',
  postsEnabled: () => false,
  getQueryVariable: () => 'overview',
  withLangParam: (href) => href,
  features: createSiteFeatureContext({ features: { footerNav: { enabled: true } } })
});
assert.equal(footerNavProbe.hidden, false, 'enabled native footer nav should restore nav visibility');
assert.equal(footerSepProbe.hidden, false, 'enabled native footer nav should restore separator visibility');
assert.equal(footerSepProbe.attributes.has('aria-hidden'), false, 'enabled native footer nav should clear separator aria-hidden');
assert.match(footerNavProbe.innerHTML, /Overview/, 'enabled native footer nav should render links after disabled state');

nativeApi.effects.renderIndexView({
  containers: { mainElement: mainProbe },
  pageEntries: [['Product', {
    location: 'product.md',
    date: '2026-07-02',
    versions: [{}, {}],
    draft: true,
    protected: true,
    tag: ['alpha']
  }]],
  totalPages: 1,
  page: 1,
  siteConfig: {},
  features: createSiteFeatureContext({
    features: {
      postMeta: { enabled: false },
      tags: { enabled: false }
    }
  })
});
assert.doesNotMatch(
  mainProbe.innerHTML,
  /2026|versionsCount|draftBadge|protectedBadge|alpha/,
  'disabled native postMeta/tags should hide card metadata and tag labels in index cards'
);

let cardMetaAppended = false;
const cardMetaProbe = {
  textContent: 'Jul 2 • 4 min read',
  querySelector(selector) {
    if (selector !== '.card-date') return null;
    return {
      textContent: 'Jul 2',
      cloneNode() {
        return { textContent: 'Jul 2' };
      }
    };
  },
  appendChild() {
    cardMetaAppended = true;
  }
};
const cardProbe = {
  querySelector(selector) {
    if (selector === '.card-meta') return cardMetaProbe;
    return null;
  }
};
fakeDocument.querySelectorAll = (selector) => (selector === '.index a' ? [cardProbe] : []);
nativeApi.effects.afterIndexRender({
  entries: [['Product', {
    location: 'product.md',
    readTime: 4,
    versions: [{}, {}],
    draft: true
  }]],
  features: createSiteFeatureContext({ features: { postMeta: { enabled: false } } })
});
assert.equal(cardMetaProbe.textContent, '', 'disabled native postMeta should clear hydrated card metadata');
assert.equal(cardMetaAppended, false, 'disabled native postMeta should not append hydrated read-time/version/draft metadata');
cardMetaProbe.textContent = 'Jul 2 • 4 min read';
nativeApi.effects.afterSearchRender({
  entries: [['Product', {
    location: 'product.md',
    readTime: 4,
    versions: [{}, {}],
    draft: true
  }]],
  features: createSiteFeatureContext({ features: { postMeta: { enabled: false } } })
});
assert.equal(cardMetaProbe.textContent, '', 'disabled native postMeta should clear hydrated search card metadata');
assert.equal(cardMetaAppended, false, 'disabled native postMeta should not append hydrated search metadata');

let setupTocCalled = false;
nativeApi.effects.renderPostView({
  containers: { mainElement: mainProbe, tocElement: tocProbe },
  markdownHtml: '<h2 id="intro">Intro</h2>',
  tocHtml: '<a href="#intro">Intro</a>',
  fallbackTitle: 'Intro',
  postMetadata: { title: 'Intro', tag: ['alpha'] },
  markdown: '# Intro',
  siteConfig: {},
  features: createSiteFeatureContext({ features: { toc: { enabled: false } } }),
  utilities: {
    renderPostNav() {},
    hydratePostImages() {},
    hydratePostVideos() {},
    applyLazyLoadingIn() {},
    applyLangHints() {},
    hydrateInternalLinkCards() {},
    setupAnchors() {},
    setupTOC() { setupTocCalled = true; },
    ensureAutoHeight() {}
  }
});
assert.equal(tocProbe.hidden, true, 'native full post render should keep TOC hidden when toc is disabled');
assert.equal(tocProbe.innerHTML, '', 'native full post render should clear TOC content when toc is disabled');
assert.equal(tocProbe.attributes.get('aria-hidden'), 'true', 'native full post render should keep disabled TOC aria-hidden');
assert.equal(setupTocCalled, false, 'native full post render should not run TOC setup when toc is disabled');

const navProbe = new ElementProbe();
bodyProbe.appendChild(navProbe);
const nativeTabsApi = mountNativeTheme({
  document: fakeDocument,
  window: { location: { href: 'https://example.test/?tab=search&q=foo&tag=bar', search: '?tab=search&q=foo&tag=bar' } },
  regions: { nav: navProbe },
  features: createSiteFeatureContext({
    features: {
      search: { enabled: true },
      tags: { enabled: false }
    }
  }),
  i18n: {
    t: (key, value) => (value ? `${key}:${value}` : key),
    withLangParam: (href) => href
  }
});
nativeTabsApi.effects.renderTabs({
  activeSlug: 'search',
  searchQuery: 'foo',
  tabsBySlug: {},
  postsEnabled: () => false,
  getHomeSlug: () => 'overview',
  getHomeLabel: () => 'Overview',
  features: createSiteFeatureContext({
    features: {
      search: { enabled: true },
      tags: { enabled: false }
    }
  })
});
const tabsTrack = navProbe.querySelector('.tabs-track');
const searchTab = tabsTrack && tabsTrack.children.find((child) => child.getAttribute('data-slug') === 'search');
assert.ok(searchTab, 'native search tab should render search tab chrome');
assert.match(searchTab.getAttribute('href') || '', /q=foo/, 'native search tab should preserve q when a stale tag is ignored');
assert.doesNotMatch(`${searchTab.getAttribute('href') || ''} ${searchTab.textContent || ''}`, /tag=bar|ui\.tagSearch:bar/, 'native search tab should ignore stale tag chrome when tags are disabled');

const profileLinksProbe = new ElementProbe();
const nativeLinksApi = mountNativeTheme({
  document: {
    querySelector: (selector) => (selector === '.site-card .social-links' ? profileLinksProbe : null),
    createElement: (tagName) => new ElementProbe(tagName),
    body: new ElementProbe()
  },
  window: {},
  features: createSiteFeatureContext({}),
  i18n: { t: (key) => key }
});
nativeLinksApi.effects.renderSiteLinks({
  config: {
    profileLinks: [
      { label: 'Unsafe', href: 'javascript:alert(1)' },
      { label: 'Mail', href: 'mailto:hello@example.test' }
    ]
  },
  features: createSiteFeatureContext({})
});
assert.match(profileLinksProbe.innerHTML, /href="#"/, 'native profile links should replace unsafe URL schemes');
assert.match(profileLinksProbe.innerHTML, /href="mailto:hello@example.test"/, 'native profile links should preserve safe URL schemes');
assert.doesNotMatch(profileLinksProbe.innerHTML, /javascript:/i, 'native profile links should not render javascript URLs');

console.log('ok - site feature controls resolve and serialize');
