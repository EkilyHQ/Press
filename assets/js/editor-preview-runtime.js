import './components.js';
import { mdParse } from './markdown.js?v=press-system-v3.4.3';
import { createContentModel } from './content-model.js';
import { parseFrontMatter } from './content.js';
import { getContentRoot, setSafeHtml } from './safe-html.js?v=press-system-v3.4.3';
import { hydratePostImages, hydratePostVideos, applyLazyLoadingIn } from './post-render.js';
import { hydrateInternalLinkCards } from './link-cards.js?v=press-system-v3.4.3';
import { applyLangHints } from './typography.js';
import { renderPressMath } from './math-render.js?v=press-system-v3.4.3';
import { initSyntaxHighlighting } from './syntax-highlight.js?v=press-system-v3.4.3';
import { setupAnchors, setupTOC } from './toc.js?v=press-system-v3.4.3';
import { initI18n, t, withLangParam } from './i18n.js?v=press-system-v3.4.3';
import { renderPostNav } from './post-nav.js?v=press-system-v3.4.3';
import { renderTagSidebar } from './tags.js?v=press-system-v3.4.3';
import { getArticleTitleFromMain } from './dom-utils.js';
import { ensureThemeLayout, getThemeApiHandler, getThemeLayoutContext, createThemeI18nContext, getThemeRegion } from './theme-layout.js?v=press-system-v3.4.3';

const RENDER_MESSAGE = 'press-editor-preview-render';
const READY_MESSAGE = 'press-editor-preview-ready';
const RENDERED_MESSAGE = 'press-editor-preview-rendered';
const ERROR_MESSAGE = 'press-editor-preview-error';
const NATIVE_STYLE_CACHE_KEY = 'press-system-v3.4.3';

let activePack = '';
let latestRenderRequestId = 0;

function postToParent(payload) {
  try { window.parent.postMessage(payload, window.location.origin); } catch (_) {}
}

function sanitizePack(value) {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function normalizeRequestId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function beginPreviewRender(payload) {
  const requestId = normalizeRequestId(payload && payload.requestId);
  latestRenderRequestId = requestId;
  return requestId;
}

function isCurrentPreviewRender(requestId) {
  return normalizeRequestId(requestId) === latestRenderRequestId;
}

function applyPreviewColorMode(siteConfig = {}) {
  const mode = String(siteConfig.themeMode || '').toLowerCase();
  if (mode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    return;
  }
  if (mode === 'light') {
    document.documentElement.removeAttribute('data-theme');
    return;
  }
  if (mode === 'auto') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    return;
  }
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  } catch (_) {}
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
  const primary = hrefs[0];
  try {
    const link = document.getElementById('theme-pack');
    if (link && link.getAttribute('href') !== primary) link.setAttribute('href', primary);
    window.__themePackHref = primary;
  } catch (_) {}
  try {
    document.querySelectorAll('link[data-theme-pack-extra-style]').forEach((node) => node.remove());
    hrefs.slice(1).forEach((href, index) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-theme-pack-extra-style', `${themePack}:${index + 1}`);
      document.head.appendChild(link);
    });
  } catch (_) {}
}

function regionValue(regions, key) {
  if (!regions || !key) return null;
  try {
    if (typeof regions.get === 'function') return regions.get(key) || null;
  } catch (_) {}
  return regions[key] || null;
}

function getPreviewContainers() {
  const layout = getThemeLayoutContext();
  const regions = layout && layout.regions;
  const main = regionValue(regions, 'main') || document.querySelector('[data-theme-region="main"], .native-mainview');
  const toc = regionValue(regions, 'toc') || document.querySelector('[data-theme-region="toc"]');
  const tags = regionValue(regions, 'tags') || document.querySelector('[data-theme-region="tags"]');
  const search = regionValue(regions, 'search') || document.querySelector('[data-theme-region="search"]');
  const nav = regionValue(regions, 'nav') || document.querySelector('[data-theme-region="nav"]');
  const content = regionValue(regions, 'content') || document.querySelector('.content');
  const sidebar = regionValue(regions, 'sidebar') || document.querySelector('.sidebar');
  const container = regionValue(regions, 'container') || document.querySelector('[data-theme-root="container"], .container');
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
    const handler = getThemeApiHandler(name);
    if (typeof handler === 'function') return handler(params);
  } catch (err) {
    console.warn('[editor-preview] Theme handler failed', name, err);
  }
  return undefined;
}

function normalizeAssetKey(value) {
  return String(value || '')
    .trim()
    .replace(/[\\]/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}

function applyAssetOverrides(container, payload) {
  const root = container || document;
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

function createRuntimeContext({ payload, containers, content }) {
  const layout = getThemeLayoutContext();
  return {
    document,
    window,
    view: 'post',
    route: { key: payload.currentPath ? `post:${payload.currentPath}` : 'editor-preview', id: payload.currentPath || '' },
    router: {
      getRouteKey: () => (payload.currentPath ? `post:${payload.currentPath}` : 'editor-preview'),
      withLangParam,
      navigate() { return false; }
    },
    i18n: createThemeI18nContext(),
    content,
    regions: layout && layout.regions,
    containers,
    utilities: {
      getRegion: getThemeRegion,
      renderPostNav,
      hydratePostImages,
      hydratePostVideos,
      hydrateInternalLinkCards,
      applyLazyLoadingIn,
      applyLangHints,
      renderPostTOC: () => {},
      renderTagSidebar,
      setupAnchors,
      setupTOC,
      ensureAutoHeight: (el) => {
        if (!el) return;
        try {
          el.style.height = '';
          el.style.minHeight = '';
          el.style.overflow = '';
        } catch (_) {}
      },
      getFile: (filename) => fetch(String(filename || ''), { cache: 'no-store' }).then((resp) => (resp && resp.ok ? resp.text() : '')),
      getContentRoot,
      setSafeHtml
    },
    themeConfig: payload.siteConfig || {},
    manifest: layout && layout.manifest,
    theme: layout && layout.theme
  };
}

async function renderPreview(payload) {
  const requestId = beginPreviewRender(payload);
  const requestedPack = sanitizePack(payload.themePack || (payload.siteConfig && payload.siteConfig.themePack) || 'native');
  applyPreviewColorMode(payload.siteConfig || {});
  try {
    const reset = activePack !== requestedPack;
    const layout = await ensureThemeLayout({ pack: requestedPack, persist: false, reset });
    if (!isCurrentPreviewRender(requestId)) return;
    activePack = (layout && layout.pack) || document.body.dataset.themeLayout || requestedPack;
    const markdown = String(payload.markdown || '');
    const baseDir = String(payload.baseDir || `${getContentRoot()}/`);
    const output = mdParse(markdown, baseDir);
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
    const main = containers.mainElement || document.body;
    const allowedLocations = new Set(Array.isArray(payload.allowedLocations) ? payload.allowedLocations : []);
    const locationAliasMap = new Map(Array.isArray(payload.locationAliases) ? payload.locationAliases : []);
    const ctx = createRuntimeContext({ payload, containers, content });
    const result = await Promise.resolve(callThemeEffect('renderPostView', {
      view: 'post',
      containers,
      ctx,
      content,
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
      document,
      window,
      utilities: {
        renderPostNav,
        hydratePostImages,
        hydratePostVideos,
        hydrateInternalLinkCards,
        applyLazyLoadingIn,
        applyLangHints,
        renderPostTOC: () => {},
        renderTagSidebar,
        getArticleTitleFromMain,
        setupAnchors,
        setupTOC,
        ensureAutoHeight: (el) => {
          if (!el) return;
          try {
            el.style.height = '';
            el.style.minHeight = '';
            el.style.overflow = '';
          } catch (_) {}
        },
        getFile: (filename) => fetch(String(filename || ''), { cache: 'no-store' }).then((resp) => (resp && resp.ok ? resp.text() : '')),
        getContentRoot,
        setSafeHtml,
        withLangParam,
        fetchMarkdown: (loc) => fetch(`${getContentRoot()}/${loc}`, { cache: 'no-store' }).then((resp) => (resp && resp.ok ? resp.text() : '')),
        makeLangHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`)
      }
    }));
    if (!isCurrentPreviewRender(requestId)) return;
    if (!result && main) {
      setSafeHtml(main, output.post || '', baseDir, { alreadySanitized: true });
    }
    if (!isCurrentPreviewRender(requestId)) return;
    applyAssetOverrides(main, payload);
    try { hydratePostImages(main); } catch (_) {}
    try { hydratePostVideos(main); } catch (_) {}
    try { applyLazyLoadingIn(main); } catch (_) {}
    try { applyLangHints(main); } catch (_) {}
    try { renderPressMath(main); } catch (_) {}
    try { initSyntaxHighlighting(main); } catch (_) {}
    if (!isCurrentPreviewRender(requestId)) return;
    restorePreviewThemeStyles(activePack, layout && layout.manifest);
    const status = document.getElementById('editorPreviewStatus');
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
    const status = document.getElementById('editorPreviewStatus') || document.body;
    try { status.hidden = false; } catch (_) {}
    status.textContent = err && err.message ? err.message : 'Preview failed.';
    postToParent({
      type: ERROR_MESSAGE,
      requestId,
      themePack: requestedPack,
      message: status.textContent
    });
  }
}

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const payload = event.data && typeof event.data === 'object' ? event.data : {};
  if (payload.type !== RENDER_MESSAGE) return;
  latestRenderRequestId = normalizeRequestId(payload.requestId);
  renderPreview(payload).catch((err) => {
    if (!isCurrentPreviewRender(payload.requestId)) return;
    postToParent({
      type: ERROR_MESSAGE,
      requestId: payload.requestId,
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
