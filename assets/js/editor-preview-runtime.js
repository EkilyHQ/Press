import './components.js';
import { mdParse } from './markdown.js';
import { createContentModel } from './content-model.js';
import { parseFrontMatter } from './content.js';
import { setSafeHtml } from './safe-html.js';
import { hydratePostImages, hydratePostVideos, applyLazyLoadingIn } from './post-render.js';
import { hydrateInternalLinkCards } from './link-cards.js';
import { applyLangHints } from './typography.js';
import { renderPressMath } from './math-render.js';
import { initSyntaxHighlighting } from './syntax-highlight.js';
import { setupAnchors, setupTOC } from './toc.js';
import { initI18n, t, withLangParam } from './i18n.js';
import { renderPostNav } from './post-nav.js';
import { renderTagSidebar } from './tags.js';
import { getArticleTitleFromMain } from './dom-utils.js';
import { createThemeLayoutController, createThemeI18nContext } from './theme-layout.js';
import { createEditorPreviewAppRuntime } from './editor-preview-app-runtime.js';
import { createSiteFeatureContext } from './site-features.js';
import { createThemeRouterHrefHelpers } from './theme-router-helpers.js';

const RENDER_MESSAGE = 'press-editor-preview-render';
const READY_MESSAGE = 'press-editor-preview-ready';
const RENDERED_MESSAGE = 'press-editor-preview-rendered';
const ERROR_MESSAGE = 'press-editor-preview-error';
const NATIVE_STYLE_CACHE_KEY = '';

export function createEditorPreviewRuntimeController(
  previewRuntime = createEditorPreviewAppRuntime(),
  themeLayout = createThemeLayoutController()
) {

function postToParent(payload) {
  previewRuntime.postToParent(payload);
}

function sanitizePack(value) {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function beginPreviewRender(payload) {
  return previewRuntime.beginRender(payload && payload.requestId);
}

function isCurrentPreviewRender(requestId) {
  return previewRuntime.isCurrentRender(requestId);
}

function getContentRoot() {
  return previewRuntime.getContentRoot();
}

function inferPayloadContentRoot(payload = {}) {
  if (Object.prototype.hasOwnProperty.call(payload, 'contentRoot')) return payload.contentRoot;
  const baseDir = String(payload.baseDir || '').trim().replace(/[\\]+/g, '/').replace(/^\/+/, '');
  const first = baseDir.split('/').find(Boolean);
  return first || 'wwwroot';
}

function applyPreviewContentRoot(payload = {}) {
  previewRuntime.setContentRoot(inferPayloadContentRoot(payload));
  return getContentRoot();
}

function getImageResolutionOptions() {
  return {
    contentRoot: getContentRoot(),
    origin: previewRuntime.getLocationOrigin()
  };
}

function setPreviewSafeHtml(target, html, baseDir, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const nextOptions = opts.imageResolution && typeof opts.imageResolution === 'object'
    ? opts
    : { ...opts, imageResolution: getImageResolutionOptions() };
  return setSafeHtml(target, html, baseDir, nextOptions);
}

function applyPreviewColorMode(siteConfig = {}) {
  previewRuntime.applyColorMode(siteConfig);
}

function restorePreviewThemeStyles(pack, manifest) {
  const themePack = sanitizePack(pack);
  const styles = Array.isArray(manifest && manifest.styles) && manifest.styles.length
    ? manifest.styles
    : ['theme.css'];
  const hrefs = styles
    .map((entry) => String(entry || '').replace(/^[./]+/, '').trim())
    .filter((entry) => entry && !entry.includes('..') && !entry.includes('\\') && entry.endsWith('.css'))
    .map((entry) => {
      const base = `assets/themes/${encodeURIComponent(themePack)}/${entry}`;
      const version = themePack === 'native' ? NATIVE_STYLE_CACHE_KEY : String((manifest && manifest.version) || '').trim();
      return version ? `${base}?v=${encodeURIComponent(version)}` : base;
  });
  if (!hrefs.length) return;
  previewRuntime.applyThemeStyleLinks({
    primary: hrefs[0],
    extraHrefs: hrefs.slice(1),
    pack: themePack
  });
}

function regionValue(regions, key) {
  if (!regions || !key) return null;
  try {
    if (typeof regions.get === 'function') return regions.get(key) || null;
  } catch (_) {}
  return regions[key] || null;
}

function getPreviewContainers() {
  const layout = themeLayout.getThemeLayoutContext();
  const regions = layout && layout.regions;
  const main = regionValue(regions, 'main') || previewRuntime.querySelector('[data-theme-region="main"], .native-mainview');
  const toc = regionValue(regions, 'toc') || previewRuntime.querySelector('[data-theme-region="toc"]');
  const tags = regionValue(regions, 'tags') || previewRuntime.querySelector('[data-theme-region="tags"]');
  const search = regionValue(regions, 'search') || previewRuntime.querySelector('[data-theme-region="search"]');
  const nav = regionValue(regions, 'nav') || previewRuntime.querySelector('[data-theme-region="nav"]');
  const content = regionValue(regions, 'content') || previewRuntime.querySelector('.content');
  const sidebar = regionValue(regions, 'sidebar') || previewRuntime.querySelector('.sidebar');
  const container = regionValue(regions, 'container') || previewRuntime.querySelector('[data-theme-root="container"], .container');
  return {
    mainElement: main,
    tocElement: toc,
    tagsElement: tags,
    searchElement: search,
    navElement: nav,
    contentElement: content,
    sidebarElement: sidebar,
    containerElement: container
  };
}

function callThemeEffect(name, params) {
  try {
    const handler = themeLayout.getThemeApiHandler(name);
    if (typeof handler === 'function') return handler(params);
  } catch (err) {
    previewRuntime.warn('[editor-preview] Theme handler failed', name, err);
  }
  return undefined;
}

function getPreviewThemeRegion(names) {
  return themeLayout.getThemeRegion(names);
}

function setupPreviewAnchors() {
  return setupAnchors({ getRegion: getPreviewThemeRegion });
}

function setupPreviewTOC() {
  return setupTOC({ getRegion: getPreviewThemeRegion });
}

function renderPreviewPostNav(router, container, postsIndex, postname, options = {}) {
  return renderPostNav(container, postsIndex, postname, {
    router,
    ...options
  });
}

function renderPreviewTagSidebar(indexMap, options = {}) {
  return renderTagSidebar(indexMap, {
    getRegion: getPreviewThemeRegion,
    ...options
  });
}

function normalizeAssetKey(value) {
  return String(value || '')
    .trim()
    .replace(/[\\]/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}

function applyAssetOverrides(container, payload) {
  const root = container || previewRuntime.documentRef;
  const overrides = new Map();
  const contentRoot = normalizeAssetKey(getContentRoot());
  (Array.isArray(payload.assetOverrides) ? payload.assetOverrides : []).forEach((item) => {
    const key = normalizeAssetKey(item && item.key);
    const url = item && item.url ? String(item.url) : '';
    if (!key || !url) return;
    overrides.set(key, url);
    if (contentRoot && key.startsWith(`${contentRoot}/`)) overrides.set(key.slice(contentRoot.length + 1), url);
    if (contentRoot) overrides.set(`${contentRoot}/${key}`, url);
  });
  if (!overrides.size || !root || !root.querySelectorAll) return;
  const lookup = (raw) => overrides.get(normalizeAssetKey(raw)) || '';
  const rewriteAttr = (node, attr) => {
    const next = lookup(node.getAttribute(attr));
    if (next) node.setAttribute(attr, next);
  };
  const rewriteSrcset = (node, attr) => {
    const raw = node.getAttribute(attr);
    if (!raw) return;
    let changed = false;
    const parts = raw.split(',').map((part) => {
      const bits = part.trim().split(/\s+/);
      const url = bits.shift();
      const next = lookup(url);
      if (!next) return part.trim();
      changed = true;
      return [next, ...bits].join(' ');
    });
    if (changed) node.setAttribute(attr, parts.filter(Boolean).join(', '));
  };
  root.querySelectorAll('img').forEach((img) => {
    rewriteAttr(img, 'src');
    rewriteAttr(img, 'data-src');
    rewriteAttr(img, 'data-original');
    rewriteSrcset(img, 'srcset');
  });
  root.querySelectorAll('source').forEach((source) => {
    rewriteAttr(source, 'src');
    rewriteSrcset(source, 'srcset');
  });
  root.querySelectorAll('video').forEach((video) => {
    rewriteAttr(video, 'poster');
    rewriteAttr(video, 'src');
  });
}

function resolvePostMetadata(payload) {
  try {
    const parsed = parseFrontMatter(payload.markdown || '').frontMatter || {};
    if (parsed.tags != null && parsed.tag == null) parsed.tag = parsed.tags;
    if (parsed.version != null && parsed.versionLabel == null) parsed.versionLabel = parsed.version;
    return {
      ...parsed,
      ...(payload.metadata || {}),
      location: payload.currentPath || parsed.location || ''
    };
  } catch (_) {
    return { ...(payload.metadata || {}), location: payload.currentPath || '' };
  }
}

function applyPreviewLangHints(container) {
  return applyLangHints(container, {
    documentRef: previewRuntime.documentRef,
    windowRef: previewRuntime.windowRef,
    nodeFilterRef: previewRuntime.getNodeFilter(),
    allowAmbient: false
  });
}

function previewFeatureEnabled(features, key) {
  if (features && typeof features.isEnabled === 'function') {
    try { return features.isEnabled(key) !== false; } catch (_) {}
  }
  const flags = features && features.flags && typeof features.flags === 'object' ? features.flags : features;
  if (flags && typeof flags === 'object' && Object.prototype.hasOwnProperty.call(flags, key)) {
    return flags[key] !== false;
  }
  return true;
}

function previewPostsEnabled(features) {
  return previewFeatureEnabled(features, 'allPosts');
}

function previewSearchEnabled(features) {
  return previewFeatureEnabled(features, 'search');
}

function resolvePreviewTabsBySlug(payload = {}) {
  const source = payload.tabsBySlug && typeof payload.tabsBySlug === 'object' && !Array.isArray(payload.tabsBySlug)
    ? payload.tabsBySlug
    : {};
  return source;
}

function resolvePreviewLandingSlug(payload = {}) {
  const siteConfig = payload.siteConfig && typeof payload.siteConfig === 'object' ? payload.siteConfig : {};
  const tabsBySlug = resolvePreviewTabsBySlug(payload);
  const wanted = String(siteConfig.landingTab || siteConfig.landing || siteConfig.homeTab || siteConfig.home || '').trim().toLowerCase();
  if (!wanted) return '';
  if (tabsBySlug[wanted]) return wanted;
  for (const [slug, info] of Object.entries(tabsBySlug)) {
    const title = String((info && info.title) || '').trim().toLowerCase();
    if (title && title === wanted) return slug;
  }
  return '';
}

function getPreviewHomeSlug(payload, features) {
  const explicit = resolvePreviewLandingSlug(payload);
  if (explicit) return explicit;
  if (previewPostsEnabled(features)) return 'posts';
  return Object.keys(resolvePreviewTabsBySlug(payload))[0] || '';
}

function getPreviewHomeLabel(payload, features) {
  const slug = getPreviewHomeSlug(payload, features);
  if (slug === 'posts') return t('ui.allPosts');
  if (slug === 'search') return t('ui.searchTab');
  const tabsBySlug = resolvePreviewTabsBySlug(payload);
  return (tabsBySlug[slug] && tabsBySlug[slug].title) || slug;
}

function createPreviewRouterContext(payload, features) {
  const hrefHelpers = createThemeRouterHrefHelpers({
    withLangParam,
    getHomeSlug: () => getPreviewHomeSlug(payload, features),
    postsEnabled: () => previewPostsEnabled(features),
    searchEnabled: () => previewSearchEnabled(features),
    tagsEnabled: () => previewFeatureEnabled(features, 'tags')
  });
  return {
    getRouteKey: () => (payload.currentPath ? `post:${payload.currentPath}` : 'editor-preview'),
    withLangParam,
    getHomeSlug: () => getPreviewHomeSlug(payload, features),
    getHomeLabel: () => getPreviewHomeLabel(payload, features),
    postsEnabled: () => previewPostsEnabled(features),
    searchEnabled: () => previewSearchEnabled(features),
    getHomeHref: hrefHelpers.getHomeHref,
    getTabHref: hrefHelpers.getTabHref,
    getPostHref: hrefHelpers.getPostHref,
    getPostsHref: hrefHelpers.getPostsHref,
    getSearchHref: hrefHelpers.getSearchHref,
    navigate() { return false; }
  };
}

function createRuntimeContext({ payload, containers, content, features }) {
  const layout = themeLayout.getThemeLayoutContext();
  const router = createPreviewRouterContext(payload, features);
  return {
    document: previewRuntime.documentRef,
    window: previewRuntime.windowRef,
    view: 'post',
    route: { key: payload.currentPath ? `post:${payload.currentPath}` : 'editor-preview', id: payload.currentPath || '' },
    router,
    i18n: createThemeI18nContext(),
    features,
    content,
    regions: layout && layout.regions,
    containers,
    utilities: {
      getRegion: getPreviewThemeRegion,
      renderPostNav: (...args) => renderPreviewPostNav(router, args[0], args[1], args[2], args[3] || {}),
      hydratePostImages,
      hydratePostVideos,
      hydrateInternalLinkCards,
      applyLazyLoadingIn,
      applyLangHints: applyPreviewLangHints,
      renderPostTOC: () => {},
      renderTagSidebar: (...args) => {
        if (!previewFeatureEnabled(features, 'tags') || !previewSearchEnabled(features)) return false;
        return renderPreviewTagSidebar(args[0], { router, ...(args[1] || {}) });
      },
      setupAnchors: setupPreviewAnchors,
      setupTOC: setupPreviewTOC,
      ensureAutoHeight: (el) => {
        if (!el) return;
        try {
          el.style.height = '';
          el.style.minHeight = '';
          el.style.overflow = '';
        } catch (_) {}
      },
      getFile: (filename) => previewRuntime.fetchText(filename),
      getContentRoot,
      setSafeHtml: setPreviewSafeHtml
    },
    themeConfig: payload.siteConfig || {},
    manifest: layout && layout.manifest,
    theme: layout && layout.theme
  };
}

async function renderPreview(payload = {}) {
  const requestId = beginPreviewRender(payload);
  const contentRoot = applyPreviewContentRoot(payload);
  const requestedPack = sanitizePack(payload.themePack || (payload.siteConfig && payload.siteConfig.themePack) || 'native');
  applyPreviewColorMode(payload.siteConfig || {});
  try {
    const reset = previewRuntime.shouldResetThemePack(requestedPack);
    const features = createSiteFeatureContext(payload.siteConfig || {});
    const previewRouter = createPreviewRouterContext(payload, features);
    const layout = await themeLayout.ensureThemeLayout({
      pack: requestedPack,
      persist: false,
      reset,
      features,
      router: previewRouter
    });
    if (!isCurrentPreviewRender(requestId)) return;
    const activePack = previewRuntime.setActiveThemePack((layout && layout.pack) || previewRuntime.getThemeLayoutPackFallback() || requestedPack);
    const markdown = String(payload.markdown || '');
    const baseDir = String(payload.baseDir || `${contentRoot}/`);
    const imageResolution = getImageResolutionOptions();
    const output = mdParse(markdown, baseDir, { imageResolution });
    const postMetadata = resolvePostMetadata(payload);
    const fallbackTitle = postMetadata.title || payload.currentPath || 'Preview';
    const content = createContentModel({
      rawMarkdown: markdown,
      html: output.post,
      tocHtml: output.toc,
      metadata: {
        ...postMetadata,
        title: fallbackTitle,
        location: payload.currentPath || postMetadata.location || ''
      },
      baseDir,
      location: payload.currentPath || postMetadata.location || '',
      title: fallbackTitle
    });
    const containers = getPreviewContainers();
    const main = containers.mainElement || previewRuntime.getBody();
    const allowedLocations = new Set(Array.isArray(payload.allowedLocations) ? payload.allowedLocations : []);
    const locationAliasMap = new Map(Array.isArray(payload.locationAliases) ? payload.locationAliases : []);
    const ctx = createRuntimeContext({ payload, containers, content, features });
    const result = await Promise.resolve(callThemeEffect('renderPostView', {
      view: 'post',
      containers,
      ctx,
      content,
      features,
      getHomeSlug: () => getPreviewHomeSlug(payload, features),
      getHomeLabel: () => getPreviewHomeLabel(payload, features),
      postsEnabled: () => previewPostsEnabled(features),
      searchEnabled: () => previewSearchEnabled(features),
      withLangParam,
      markdownHtml: output.post,
      tocHtml: output.toc,
      rawMarkdown: markdown,
      markdown,
      baseDir,
      fallbackTitle,
      postMetadata: content.metadata,
      postId: payload.currentPath || '',
      siteConfig: payload.siteConfig || {},
      postsIndex: payload.postsIndex || {},
      postsByLocationTitle: payload.postsByLocationTitle || {},
      allowedLocations,
      locationAliasMap,
      translate: t,
      document: previewRuntime.documentRef,
      window: previewRuntime.windowRef,
      utilities: {
        renderPostNav: (...args) => renderPreviewPostNav(ctx.router, args[0], args[1], args[2], args[3] || {}),
        hydratePostImages,
        hydratePostVideos,
        hydrateInternalLinkCards,
        applyLazyLoadingIn,
        applyLangHints: applyPreviewLangHints,
        renderPostTOC: () => {},
        renderTagSidebar: (...args) => {
          if (!previewFeatureEnabled(features, 'tags') || !previewSearchEnabled(features)) return false;
          return renderPreviewTagSidebar(args[0], { router: ctx.router, ...(args[1] || {}) });
        },
        getArticleTitleFromMain,
        setupAnchors: setupPreviewAnchors,
        setupTOC: setupPreviewTOC,
        ensureAutoHeight: (el) => {
          if (!el) return;
          try {
            el.style.height = '';
            el.style.minHeight = '';
            el.style.overflow = '';
          } catch (_) {}
        },
        getFile: (filename) => previewRuntime.fetchText(filename),
        getContentRoot,
        setSafeHtml: setPreviewSafeHtml,
        withLangParam,
        fetchMarkdown: (loc) => previewRuntime.fetchText(`${getContentRoot()}/${loc}`),
        makeLangHref: (loc) => (ctx.router && ctx.router.getPostHref(loc))
      }
    }));
    if (!isCurrentPreviewRender(requestId)) return;
    if (!result && main) {
      setPreviewSafeHtml(main, output.post || '', baseDir, { alreadySanitized: true, imageResolution });
    }
    if (!isCurrentPreviewRender(requestId)) return;
    applyAssetOverrides(main, payload);
    try { hydratePostImages(main); } catch (_) {}
    try { hydratePostVideos(main); } catch (_) {}
    try { applyLazyLoadingIn(main); } catch (_) {}
    try { applyPreviewLangHints(main); } catch (_) {}
    try {
      renderPressMath(main, {
        documentRef: previewRuntime.documentRef,
        windowRef: previewRuntime.windowRef
      });
    } catch (_) {}
    try {
      initSyntaxHighlighting(main, {
        documentRef: previewRuntime.documentRef,
        windowRef: previewRuntime.windowRef,
        setTimer: previewRuntime.setTimer,
        writeClipboardText: (text) => previewRuntime.writeClipboardText(text),
        translate: t,
        allowAmbient: false
      });
    } catch (_) {}
    if (!isCurrentPreviewRender(requestId)) return;
    restorePreviewThemeStyles(activePack, layout && layout.manifest);
    const status = previewRuntime.getPreviewStatusElement();
    if (status) status.hidden = true;
    postToParent({ type: RENDERED_MESSAGE, requestId, themePack: activePack });
  } catch (err) {
    if (!isCurrentPreviewRender(requestId)) return;
    if (requestedPack !== 'native') {
      await renderPreview({ ...payload, requestId, themePack: 'native' });
      if (!isCurrentPreviewRender(requestId)) return;
      postToParent({
        type: ERROR_MESSAGE,
        requestId,
        themePack: requestedPack,
        fallbackThemePack: 'native',
        message: err && err.message ? err.message : 'Theme preview failed.'
      });
      return;
    }
    const status = previewRuntime.getPreviewStatusElement({ fallbackToBody: true });
    const message = err && err.message ? err.message : 'Preview failed.';
    if (status) {
      try { status.hidden = false; } catch (_) {}
      try { status.textContent = message; } catch (_) {}
    }
    postToParent({
      type: ERROR_MESSAGE,
      requestId,
      themePack: requestedPack,
      message: status && typeof status.textContent === 'string' ? status.textContent : message
    });
  }
}

  function start() {
    previewRuntime.onRenderMessage((event) => {
      if (!previewRuntime.isTrustedMessageEvent(event)) return;
      const payload = event.data && typeof event.data === 'object' ? event.data : {};
      if (payload.type !== RENDER_MESSAGE) return;
      const requestId = beginPreviewRender(payload);
      renderPreview(payload).catch((err) => {
        if (!isCurrentPreviewRender(requestId)) return;
        postToParent({
          type: ERROR_MESSAGE,
          requestId,
          themePack: payload.themePack || '',
          message: err && err.message ? err.message : 'Preview failed.'
        });
      });
    });

    initI18n()
      .catch(() => {})
      .finally(() => {
        postToParent({ type: READY_MESSAGE });
      });
  }

  return {
    renderPreview,
    start
  };
}

createEditorPreviewRuntimeController().start();
