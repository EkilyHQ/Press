import { createEditorMainPreviewAssets } from './editor-main-preview-assets.js';
import { createEditorMainPreviewThemePicker } from './editor-main-preview-theme-picker.js';
import { createEditorMainPreviewViewport } from './editor-main-preview-viewport.js';

const PREVIEW_RENDER_MESSAGE = 'press-editor-preview-render';
const PREVIEW_READY_MESSAGE = 'press-editor-preview-ready';
const PREVIEW_RENDERED_MESSAGE = 'press-editor-preview-rendered';
const PREVIEW_ERROR_MESSAGE = 'press-editor-preview-error';
const PREVIEW_OVERLAY_CLOSE_MS = 260;

const fallbackGetContentRoot = () => 'wwwroot';
const noop = () => {};

function fallbackElementById(documentRef, id) {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

export function createEditorMainPreviewSession(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : fallbackGetContentRoot;
  const getEditorValue = typeof options.getEditorValue === 'function' ? options.getEditorValue : () => '';
  const getCurrentFileInfo = typeof options.getCurrentFileInfo === 'function' ? options.getCurrentFileInfo : () => ({});
  const getSiteConfig = typeof options.getSiteConfig === 'function' ? options.getSiteConfig : () => ({});
  const getPostsIndex = typeof options.getPostsIndex === 'function' ? options.getPostsIndex : () => ({});
  const getPostsByLocationTitle = typeof options.getPostsByLocationTitle === 'function' ? options.getPostsByLocationTitle : () => ({});
  const isLinkCardReady = typeof options.isLinkCardReady === 'function' ? options.isLinkCardReady : () => false;
  const getAllowedLocations = typeof options.getAllowedLocations === 'function' ? options.getAllowedLocations : () => [];
  const getLocationAliases = typeof options.getLocationAliases === 'function' ? options.getLocationAliases : () => [];
  const consoleRef = options.consoleRef || null;
  const fetchImpl = typeof options.fetch === 'function'
    ? options.fetch
    : null;
  const getElementById = (id) => (
    typeof runtime.getElementById === 'function'
      ? runtime.getElementById(id)
      : fallbackElementById(documentRef, id)
  );
  const querySelectorAll = (selector) => (
    typeof runtime.querySelectorAll === 'function'
      ? runtime.querySelectorAll(selector)
      : (documentRef && typeof documentRef.querySelectorAll === 'function' ? Array.from(documentRef.querySelectorAll(selector)) : [])
  );
  const postMessage = (target, payload) => {
    if (typeof runtime.postMessage === 'function') {
      runtime.postMessage(target, payload);
      return;
    }
    try { if (target && typeof target.postMessage === 'function') target.postMessage(payload, '*'); } catch (_) {}
  };
  const requestFrame = (fn) => (
    typeof runtime.requestFrame === 'function'
      ? runtime.requestFrame(fn)
      : 0
  );
  const cancelFrame = (id) => {
    if (!id) return;
    if (typeof runtime.cancelFrame === 'function') {
      runtime.cancelFrame(id);
      return;
    }
  };
  const setTimer = (fn, delay) => (
    typeof runtime.setTimer === 'function'
      ? runtime.setTimer(fn, delay)
      : null
  );
  const clearTimer = (id) => {
    if (!id) return;
    if (typeof runtime.clearTimer === 'function') {
      runtime.clearTimer(id);
      return;
    }
  };
  const onWindow = (type, handler, opts) => (
    typeof runtime.onWindow === 'function'
      ? runtime.onWindow(type, handler, opts)
      : noop
  );
  const onDocument = (type, handler, opts) => (
    typeof runtime.onDocument === 'function'
      ? runtime.onDocument(type, handler, opts)
      : noop
  );
  const getLocationOrigin = () => (
    typeof runtime.getLocationOrigin === 'function'
      ? runtime.getLocationOrigin()
      : ''
  );
  const getLocationHref = () => (
    typeof runtime.getLocationHref === 'function'
      ? runtime.getLocationHref()
      : ''
  );

  function warn(...args) {
    try {
      if (consoleRef && typeof consoleRef.warn === 'function') consoleRef.warn(...args);
    } catch (_) {}
  }
  const getEditorBaseDir = () => (
    typeof runtime.getEditorBaseDir === 'function'
      ? runtime.getEditorBaseDir(`${getContentRoot()}/`)
      : `${getContentRoot()}/`
  );
  const prefersReducedMotion = () => (
    typeof runtime.prefersReducedMotion === 'function' ? runtime.prefersReducedMotion() : false
  );

  let previewFrameReady = false;
  let previewRenderRequestId = 0;
  let previewOverlayFrame = 0;
  let previewOverlayCloseTimer = 0;
  const previewAssets = createEditorMainPreviewAssets({
    documentRef,
    getContentRoot,
    getLocationHref,
    getElementById,
    onCurrentAssetPreview: () => renderCurrent()
  });
  const previewViewport = createEditorMainPreviewViewport({
    getElementById,
    querySelectorAll,
    onDocument
  });
  const previewThemePicker = createEditorMainPreviewThemePicker({
    documentRef,
    getElementById,
    fetch: fetchImpl,
    getSiteThemePack: () => {
      const siteConfig = getSiteConfig() || {};
      return siteConfig && siteConfig.themePack ? siteConfig.themePack : 'native';
    },
    onChange: () => renderCurrent()
  });

  const safeList = (value) => {
    if (value instanceof Set) return Array.from(value);
    if (Array.isArray(value)) return value;
    return [];
  };

  const safeEntries = (value) => {
    if (value instanceof Map) return Array.from(value.entries());
    if (Array.isArray(value)) return value;
    return [];
  };

  const getPreviewPayload = (mdText) => {
    const linkCardsReady = !!isLinkCardReady();
    const currentPath = previewAssets.getCurrentPath();
    return {
      type: PREVIEW_RENDER_MESSAGE,
      requestId: ++previewRenderRequestId,
      themePack: previewThemePicker.getActiveThemePack(),
      markdown: mdText == null ? '' : String(mdText),
      contentRoot: getContentRoot(),
      baseDir: getEditorBaseDir(),
      currentPath,
      siteConfig: getSiteConfig() || {},
      metadata: { location: currentPath },
      postsIndex: getPostsIndex() || {},
      postsByLocationTitle: getPostsByLocationTitle() || {},
      allowedLocations: linkCardsReady ? safeList(getAllowedLocations()) : [],
      locationAliases: linkCardsReady ? safeEntries(getLocationAliases()) : [],
      assetOverrides: previewAssets.collectAssetOverrides(currentPath)
    };
  };

  const render = (mdText) => {
    try {
      previewThemePicker.updateSelect();
      const previewWrap = getElementById('preview-wrap');
      if (!previewWrap || previewWrap.hidden) return;
      const frame = getElementById('previewFrame');
      if (!frame || !frame.contentWindow) return;
      const payload = getPreviewPayload(mdText);
      frame.__pressPendingPreviewPayload = payload;
      postMessage(frame.contentWindow, payload);
    } catch (_) {}
  };

  const renderCurrent = () => {
    render(getEditorValue());
  };

  const getPreviewPathText = (info = getCurrentFileInfo()) => {
    try {
      const path = info && info.path ? String(info.path) : '';
      const crumbs = info && Array.isArray(info.breadcrumb)
        ? info.breadcrumb
          .map((item) => (item && item.label ? String(item.label).trim() : ''))
          .filter(Boolean)
        : [];
      return crumbs.length ? crumbs.join(' / ') : path;
    } catch (_) {
      return '';
    }
  };

  const updatePathLabel = () => {
    const previewPathLabel = getElementById('previewPathLabel');
    const previewWrap = getElementById('preview-wrap');
    if (previewPathLabel && previewWrap && !previewWrap.hidden) {
      previewPathLabel.textContent = getPreviewPathText() || 'Preview';
    }
  };

  const clearPreviewOverlayAnimation = () => {
    if (previewOverlayFrame) {
      cancelFrame(previewOverlayFrame);
      previewOverlayFrame = 0;
    }
    if (previewOverlayCloseTimer) {
      clearTimer(previewOverlayCloseTimer);
      previewOverlayCloseTimer = 0;
    }
  };

  const open = () => {
    const previewWrap = getElementById('preview-wrap');
    if (!previewWrap) return;
    clearPreviewOverlayAnimation();
    const previewPathLabel = getElementById('previewPathLabel');
    if (previewPathLabel) previewPathLabel.textContent = getPreviewPathText() || 'Preview';
    previewViewport.reset();
    previewWrap.hidden = false;
    previewWrap.removeAttribute('aria-hidden');
    previewWrap.classList.remove('is-closing');
    previewWrap.classList.remove('is-open');
    previewOverlayFrame = requestFrame(() => {
      previewOverlayFrame = 0;
      previewWrap.classList.add('is-open');
    });
    previewThemePicker.updateSelect();
    renderCurrent();
    try { previewWrap.focus && previewWrap.focus(); } catch (_) {}
  };

  const close = () => {
    const previewWrap = getElementById('preview-wrap');
    if (!previewWrap) return;
    clearPreviewOverlayAnimation();
    previewWrap.setAttribute('aria-hidden', 'true');
    previewWrap.classList.remove('is-open');
    if (prefersReducedMotion()) {
      previewWrap.classList.remove('is-closing');
      previewWrap.hidden = true;
      previewViewport.reset();
      return;
    }
    previewWrap.classList.add('is-closing');
    previewOverlayCloseTimer = setTimer(() => {
      previewOverlayCloseTimer = 0;
      previewWrap.hidden = true;
      previewWrap.classList.remove('is-closing');
      previewViewport.reset();
    }, PREVIEW_OVERLAY_CLOSE_MS);
  };

  const flushPendingPreview = () => {
    try {
      const previewFrame = getElementById('previewFrame');
      if (!previewFrame || !previewFrame.contentWindow || !previewFrame.__pressPendingPreviewPayload) return;
      if (!previewFrameReady) return;
      postMessage(previewFrame.contentWindow, previewFrame.__pressPendingPreviewPayload);
    } catch (_) {}
  };

  const handlePreviewMessage = (event) => {
    if (event.origin !== getLocationOrigin()) return;
    const previewFrame = getElementById('previewFrame');
    if (!previewFrame || event.source !== previewFrame.contentWindow) return;
    const detail = event.data && typeof event.data === 'object' ? event.data : {};
    if (detail.type === PREVIEW_READY_MESSAGE) {
      previewFrameReady = true;
      flushPendingPreview();
    } else if (detail.type === PREVIEW_RENDERED_MESSAGE) {
      previewFrameReady = true;
    } else if (detail.type === PREVIEW_ERROR_MESSAGE) {
      previewFrameReady = true;
      warn('Editor preview render failed', detail.message || detail);
    }
  };

  const refreshAssetOverrides = () => previewAssets.refreshAssetOverrides();
  const handleAssetPreviewEvent = (event) => previewAssets.handleAssetPreviewEvent(event);

  const handleSiteConfigChange = () => {
    previewThemePicker.handleSiteConfigChange();
    renderCurrent();
  };

  const bind = () => {
    const previewFrame = getElementById('previewFrame');
    const closePreviewButton = getElementById('btnClosePreview');
    if (previewFrame) {
      previewFrame.addEventListener('load', () => {
        previewFrameReady = false;
        setTimer(flushPendingPreview, 0);
      });
    }

    onWindow('press-editor-asset-preview', handleAssetPreviewEvent);
    onWindow('message', handlePreviewMessage);
    previewThemePicker.bind();
    if (closePreviewButton) {
      closePreviewButton.addEventListener('click', () => {
        close();
      });
    }
    previewViewport.bind();
    onDocument('keydown', (event) => {
      const previewWrap = getElementById('preview-wrap');
      if (!event || event.key !== 'Escape') return;
      if (!previewWrap || previewWrap.hidden) return;
      event.preventDefault();
      close();
    });
  };

  return {
    bind,
    render,
    open,
    close,
    applyAssetOverrides: previewAssets.applyAssetOverrides,
    refreshAssetOverrides,
    handleAssetPreviewEvent,
    handleSiteConfigChange,
    updateThemeSelect: previewThemePicker.updateSelect,
    updatePathLabel,
    hasThemeOverride: previewThemePicker.hasOverride,
    normalizePath: previewAssets.normalizePath,
    setCurrentFileInfo: (info) => {
      previewAssets.setCurrentFileInfo(info);
      updatePathLabel();
    },
    getCurrentPath: previewAssets.getCurrentPath
  };
}
