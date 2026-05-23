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
  const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : fallbackGetContentRoot;
  const getEditorValue = typeof options.getEditorValue === 'function' ? options.getEditorValue : () => '';
  const getCurrentFileInfo = typeof options.getCurrentFileInfo === 'function' ? options.getCurrentFileInfo : () => ({});
  const getSiteConfig = typeof options.getSiteConfig === 'function' ? options.getSiteConfig : () => ({});
  const getPostsIndex = typeof options.getPostsIndex === 'function' ? options.getPostsIndex : () => ({});
  const getPostsByLocationTitle = typeof options.getPostsByLocationTitle === 'function' ? options.getPostsByLocationTitle : () => ({});
  const isLinkCardReady = typeof options.isLinkCardReady === 'function' ? options.isLinkCardReady : () => false;
  const getAllowedLocations = typeof options.getAllowedLocations === 'function' ? options.getAllowedLocations : () => [];
  const getLocationAliases = typeof options.getLocationAliases === 'function' ? options.getLocationAliases : () => [];
  const fetchImpl = typeof options.fetch === 'function'
    ? options.fetch
    : (typeof fetch === 'function' ? fetch : null);
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
      : (windowRef && typeof windowRef.requestAnimationFrame === 'function' ? windowRef.requestAnimationFrame(fn) : 0)
  );
  const cancelFrame = (id) => {
    if (!id) return;
    if (typeof runtime.cancelFrame === 'function') {
      runtime.cancelFrame(id);
      return;
    }
    try { if (windowRef && typeof windowRef.cancelAnimationFrame === 'function') windowRef.cancelAnimationFrame(id); } catch (_) {}
  };
  const setTimer = (fn, delay) => (
    typeof runtime.setTimer === 'function'
      ? runtime.setTimer(fn, delay)
      : (windowRef && typeof windowRef.setTimeout === 'function' ? windowRef.setTimeout(fn, delay) : 0)
  );
  const clearTimer = (id) => {
    if (!id) return;
    if (typeof runtime.clearTimer === 'function') {
      runtime.clearTimer(id);
      return;
    }
    try { if (windowRef && typeof windowRef.clearTimeout === 'function') windowRef.clearTimeout(id); } catch (_) {}
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
      : (windowRef && windowRef.location ? windowRef.location.origin : '')
  );
  const getEditorBaseDir = () => (
    typeof runtime.getEditorBaseDir === 'function'
      ? runtime.getEditorBaseDir(`${getContentRoot()}/`)
      : `${getContentRoot()}/`
  );
  const prefersReducedMotion = () => (
    typeof runtime.prefersReducedMotion === 'function' ? runtime.prefersReducedMotion() : false
  );

  const previewAssetBuckets = new Map();
  let previewAssetCurrentPath = '';
  let previewFrameReady = false;
  let previewRenderRequestId = 0;
  let previewThemeOverride = '';
  let previewThemeOptions = [{ value: 'native', label: 'Native' }];
  let previewOverlayFrame = 0;
  let previewOverlayCloseTimer = 0;

  const getContentRootPrefix = () => {
    try {
      const raw = String(getContentRoot() || '').trim();
      if (!raw) return '';
      return raw
        .replace(/[\\]/g, '/')
        .replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  };

  const safePreviewMime = (mime) => {
    try {
      const raw = String(mime || '').trim().toLowerCase();
      if (!raw) return 'image/png';
      return raw.startsWith('image/') ? raw : 'image/png';
    } catch (_) {
      return 'image/png';
    }
  };

  const makePreviewDataUrl = (base64, mime) => {
    try {
      const data = String(base64 || '').trim();
      if (!data) return '';
      const type = safePreviewMime(mime);
      return `data:${type};base64,${data}`;
    } catch (_) {
      return '';
    }
  };

  const normalizePreviewKey = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(data:|blob:)/i.test(raw)) return raw;
    let input = raw;
    try {
      if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
        const href = windowRef && windowRef.location ? windowRef.location.href : 'http://localhost/';
        const url = new URL(input, href);
        input = url.pathname || '';
      }
    } catch (_) {}
    return input
      .replace(/^[?#]+/, '')
      .replace(/[\\]/g, '/')
      .replace(/\/+/, '/')
      .replace(/^\.\/+/, '')
      .replace(/^\/+/, '');
  };

  const normalizePreviewPath = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const cleaned = raw.replace(/[\\]/g, '/');
    const parts = cleaned.split('/');
    const stack = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (stack.length) stack.pop();
        continue;
      }
      stack.push(part);
    }
    let normalized = stack.join('/');
    const prefix = getContentRootPrefix();
    if (prefix) {
      if (normalized === prefix) return '';
      if (normalized.startsWith(`${prefix}/`)) {
        normalized = normalized.slice(prefix.length + 1);
      }
    }
    return normalized;
  };

  const buildPreviewKeysForAsset = (asset) => {
    const keys = new Set();
    const commit = normalizePreviewKey(asset && (asset.path || asset.commitPath));
    const rel = normalizePreviewKey(asset && asset.relativePath);
    const prefix = getContentRootPrefix();
    const join = (base, suffix) => {
      if (!base) return suffix;
      return `${base}/${suffix}`.replace(/\/+/, '/');
    };
    if (commit) {
      keys.add(commit);
      if (prefix) keys.add(join(prefix, commit));
    }
    if (rel) {
      keys.add(rel);
      if (prefix) keys.add(join(prefix, rel));
    }
    return Array.from(keys).filter(Boolean);
  };

  const updatePreviewAssetBucket = (path, assets) => {
    const norm = normalizePreviewPath(path);
    if (!norm) {
      if (path) previewAssetBuckets.delete(norm);
      return;
    }
    let bucket = previewAssetBuckets.get(norm);
    if (!bucket) {
      bucket = new Map();
      previewAssetBuckets.set(norm, bucket);
    }
    const list = Array.isArray(assets) ? assets : [];
    if (!list.length) {
      bucket.clear();
      previewAssetBuckets.delete(norm);
      return;
    }
    const keep = new Set();
    list.forEach((asset) => {
      if (!asset) return;
      const base64 = typeof asset.base64 === 'string' ? asset.base64.trim() : '';
      if (!base64) return;
      const url = makePreviewDataUrl(base64, asset.mime);
      if (!url) return;
      const keys = buildPreviewKeysForAsset(asset);
      if (!keys.length) return;
      keys.forEach((key) => {
        if (!key) return;
        bucket.set(key, { url, mime: safePreviewMime(asset.mime) });
        keep.add(key);
      });
    });
    Array.from(bucket.keys()).forEach((key) => {
      if (!keep.has(key)) bucket.delete(key);
    });
    if (!bucket.size) previewAssetBuckets.delete(norm);
  };

  const lookupPreviewAsset = (bucket, key) => {
    if (!bucket || !key) return null;
    const direct = bucket.get(key);
    if (direct) return direct;
    const prefix = getContentRootPrefix();
    if (prefix && key.startsWith(`${prefix}/`)) {
      const trimmed = key.slice(prefix.length + 1);
      return bucket.get(trimmed) || null;
    }
    return null;
  };

  const applyAssetOverrides = (container, markdownPath) => {
    const normPath = normalizePreviewPath(markdownPath || previewAssetCurrentPath);
    if (!normPath) return;
    const bucket = previewAssetBuckets.get(normPath);
    if (!bucket || !bucket.size) return;
    const root = typeof container === 'string'
      ? (documentRef && typeof documentRef.querySelector === 'function' ? documentRef.querySelector(container) : null)
      : container;
    if (!root) return;

    const rewriteAttr = (node, attr) => {
      if (!node) return;
      const raw = node.getAttribute(attr);
      if (!raw) return;
      const key = normalizePreviewKey(raw);
      if (!key) return;
      const asset = lookupPreviewAsset(bucket, key);
      if (!asset || !asset.url) return;
      if (node.getAttribute(attr) === asset.url) return;
      node.setAttribute(attr, asset.url);
    };

    const rewriteSrcset = (node, attr) => {
      if (!node) return;
      const raw = node.getAttribute(attr);
      if (!raw) return;
      const parts = raw.split(',');
      let changed = false;
      const next = parts.map((part) => {
        const seg = part.trim();
        if (!seg) return '';
        const bits = seg.split(/\s+/);
        const url = bits.shift();
        const asset = lookupPreviewAsset(bucket, normalizePreviewKey(url));
        if (asset && asset.url) {
          changed = true;
          return [asset.url, ...bits].join(' ');
        }
        return seg;
      });
      if (changed) node.setAttribute(attr, next.filter(Boolean).join(', '));
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
      rewriteSrcset(video, 'srcset');
    });
  };

  const refreshAssetOverrides = () => {
    ['blocks-wrap'].forEach((id) => {
      const target = getElementById(id);
      if (!target) return;
      applyAssetOverrides(target, previewAssetCurrentPath);
    });
  };

  const collectPreviewAssetOverrides = (markdownPath) => {
    const normPath = normalizePreviewPath(markdownPath || previewAssetCurrentPath);
    if (!normPath) return [];
    const bucket = previewAssetBuckets.get(normPath);
    if (!bucket || !bucket.size) return [];
    return Array.from(bucket.entries())
      .map(([key, value]) => ({
        key,
        url: value && value.url ? String(value.url) : '',
        mime: value && value.mime ? String(value.mime) : ''
      }))
      .filter((item) => item.key && item.url);
  };

  const sanitizePreviewThemePack = (value) => {
    const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return clean || 'native';
  };

  const getSitePreviewThemePack = () => {
    const siteConfig = getSiteConfig() || {};
    return sanitizePreviewThemePack(siteConfig && siteConfig.themePack ? siteConfig.themePack : 'native');
  };

  const getActivePreviewThemePack = () => {
    return sanitizePreviewThemePack(previewThemeOverride || getSitePreviewThemePack());
  };

  const updatePreviewThemeSelect = () => {
    try {
      const select = getElementById('previewThemeSelect');
      if (!select) return;
      const active = getActivePreviewThemePack();
      const options = Array.isArray(previewThemeOptions) && previewThemeOptions.length
        ? previewThemeOptions
        : [{ value: 'native', label: 'Native' }];
      const seen = new Set();
      select.innerHTML = '';
      options.forEach((item) => {
        const value = sanitizePreviewThemePack(item && item.value);
        if (!value || seen.has(value)) return;
        seen.add(value);
        const option = documentRef.createElement('option');
        option.value = value;
        option.textContent = String((item && item.label) || value);
        select.appendChild(option);
      });
      if (!seen.has(active)) {
        const option = documentRef.createElement('option');
        option.value = active;
        option.textContent = active;
        select.appendChild(option);
      }
      select.value = active;
    } catch (_) {}
  };

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
    return {
      type: PREVIEW_RENDER_MESSAGE,
      requestId: ++previewRenderRequestId,
      themePack: getActivePreviewThemePack(),
      markdown: mdText == null ? '' : String(mdText),
      baseDir: getEditorBaseDir(),
      currentPath: previewAssetCurrentPath || '',
      siteConfig: getSiteConfig() || {},
      metadata: { location: previewAssetCurrentPath || '' },
      postsIndex: getPostsIndex() || {},
      postsByLocationTitle: getPostsByLocationTitle() || {},
      allowedLocations: linkCardsReady ? safeList(getAllowedLocations()) : [],
      locationAliases: linkCardsReady ? safeEntries(getLocationAliases()) : [],
      assetOverrides: collectPreviewAssetOverrides(previewAssetCurrentPath)
    };
  };

  const render = (mdText) => {
    try {
      updatePreviewThemeSelect();
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

  const resetPreviewViewportWidth = () => {
    const previewFrameSizer = getElementById('previewFrameSizer');
    const previewFrame = getElementById('previewFrame');
    if (!previewFrameSizer) return;
    previewFrameSizer.style.width = '';
    previewFrameSizer.classList.remove('is-resizing');
    if (previewFrame) previewFrame.style.pointerEvents = '';
  };

  const setPreviewViewportWidth = (width) => {
    const previewFrameSizer = getElementById('previewFrameSizer');
    const previewViewportShell = getElementById('previewViewportShell');
    if (!previewFrameSizer || !previewViewportShell) return;
    const shellRect = previewViewportShell.getBoundingClientRect();
    const handleSpace = 36;
    const maxWidth = Math.max(0, (shellRect.width || 0) - handleSpace);
    if (!maxWidth) return;
    const minWidth = Math.min(360, maxWidth);
    const clamped = Math.max(minWidth, Math.min(maxWidth, width));
    previewFrameSizer.style.width = `${Math.round(clamped)}px`;
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
    resetPreviewViewportWidth();
    previewWrap.hidden = false;
    previewWrap.removeAttribute('aria-hidden');
    previewWrap.classList.remove('is-closing');
    previewWrap.classList.remove('is-open');
    previewOverlayFrame = requestFrame(() => {
      previewOverlayFrame = 0;
      previewWrap.classList.add('is-open');
    });
    updatePreviewThemeSelect();
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
      resetPreviewViewportWidth();
      return;
    }
    previewWrap.classList.add('is-closing');
    previewOverlayCloseTimer = setTimer(() => {
      previewOverlayCloseTimer = 0;
      previewWrap.hidden = true;
      previewWrap.classList.remove('is-closing');
      resetPreviewViewportWidth();
    }, PREVIEW_OVERLAY_CLOSE_MS);
  };

  const startPreviewResize = (event, side) => {
    const previewFrameSizer = getElementById('previewFrameSizer');
    const previewViewportShell = getElementById('previewViewportShell');
    const previewFrame = getElementById('previewFrame');
    if (!previewFrameSizer || !previewViewportShell) return;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const startX = event && Number.isFinite(event.clientX) ? event.clientX : 0;
    const startRect = previewFrameSizer.getBoundingClientRect();
    const startWidth = startRect.width || 0;
    const direction = side === 'left' ? -1 : 1;
    previewFrameSizer.classList.add('is-resizing');
    if (previewFrame) previewFrame.style.pointerEvents = 'none';

    const handleMove = (moveEvent) => {
      const currentX = moveEvent && Number.isFinite(moveEvent.clientX) ? moveEvent.clientX : startX;
      const delta = currentX - startX;
      setPreviewViewportWidth(startWidth + (delta * direction * 2));
    };
    let detachMove = noop;
    let detachUp = noop;
    let detachCancel = noop;
    const handleEnd = () => {
      detachMove();
      detachUp();
      detachCancel();
      previewFrameSizer.classList.remove('is-resizing');
      if (previewFrame) previewFrame.style.pointerEvents = '';
    };

    detachMove = onDocument('pointermove', handleMove);
    detachUp = onDocument('pointerup', handleEnd, { once: true });
    detachCancel = onDocument('pointercancel', handleEnd, { once: true });
  };

  const flushPendingPreview = () => {
    try {
      const previewFrame = getElementById('previewFrame');
      if (!previewFrame || !previewFrame.contentWindow || !previewFrame.__pressPendingPreviewPayload) return;
      if (!previewFrameReady) return;
      postMessage(previewFrame.contentWindow, previewFrame.__pressPendingPreviewPayload);
    } catch (_) {}
  };

  const loadPreviewThemeOptions = () => {
    if (!fetchImpl) {
      updatePreviewThemeSelect();
      return;
    }
    const normalizeThemeOptions = (lists) => {
      const normalized = [];
      const seen = new Set();
      lists.forEach((list) => {
        (Array.isArray(list) ? list : []).forEach((item) => {
          const value = sanitizePreviewThemePack(item && item.value);
          if (!value || seen.has(value)) return;
          seen.add(value);
          normalized.push({ value, label: String((item && item.label) || value) });
        });
      });
      return normalized;
    };
    const fetchThemeList = (path, optional = false) => fetchImpl(path, { cache: 'no-store' })
      .then((response) => {
        if (response && response.ok) return response.json();
        if (optional) return [];
        return Promise.reject(new Error(`Unable to load ${path}`));
      })
      .catch((err) => {
        if (optional) return [];
        throw err;
      });
    Promise.all([
      fetchThemeList('assets/themes/packs.json'),
      fetchThemeList('assets/themes/packs.local.json', true)
    ])
      .then((lists) => {
        const normalized = normalizeThemeOptions(lists);
        if (normalized.length) previewThemeOptions = normalized;
        updatePreviewThemeSelect();
      })
      .catch(() => { updatePreviewThemeSelect(); });
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
      try { console.warn('Editor preview render failed', detail.message || detail); } catch (_) {}
    }
  };

  const handleAssetPreviewEvent = (event) => {
    if (!event || !event.detail) return;
    const detail = event.detail;
    const markdownPath = normalizePreviewPath(detail.markdownPath || detail.path || '');
    updatePreviewAssetBucket(markdownPath, detail.assets || []);
    if (!markdownPath) {
      refreshAssetOverrides();
      renderCurrent();
      return;
    }
    if (markdownPath === normalizePreviewPath(previewAssetCurrentPath)) {
      refreshAssetOverrides();
      renderCurrent();
    }
  };

  const handleSiteConfigChange = () => {
    if (!previewThemeOverride) updatePreviewThemeSelect();
    renderCurrent();
  };

  const bind = () => {
    const previewFrame = getElementById('previewFrame');
    const previewThemeSelect = getElementById('previewThemeSelect');
    const closePreviewButton = getElementById('btnClosePreview');
    if (previewFrame) {
      previewFrame.addEventListener('load', () => {
        previewFrameReady = false;
        setTimer(flushPendingPreview, 0);
      });
    }

    onWindow('press-editor-asset-preview', handleAssetPreviewEvent);
    onWindow('message', handlePreviewMessage);
    if (previewThemeSelect) {
      previewThemeSelect.addEventListener('change', () => {
        previewThemeOverride = sanitizePreviewThemePack(previewThemeSelect.value || 'native');
        updatePreviewThemeSelect();
        renderCurrent();
      });
    }
    if (closePreviewButton) {
      closePreviewButton.addEventListener('click', () => {
        close();
      });
    }
    querySelectorAll('[data-preview-resize]').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        startPreviewResize(event, handle.getAttribute('data-preview-resize') || 'right');
      });
    });
    onDocument('keydown', (event) => {
      const previewWrap = getElementById('preview-wrap');
      if (!event || event.key !== 'Escape') return;
      if (!previewWrap || previewWrap.hidden) return;
      event.preventDefault();
      close();
    });
    loadPreviewThemeOptions();
  };

  return {
    bind,
    render,
    open,
    close,
    applyAssetOverrides,
    refreshAssetOverrides,
    handleAssetPreviewEvent,
    handleSiteConfigChange,
    updateThemeSelect: updatePreviewThemeSelect,
    updatePathLabel,
    hasThemeOverride: () => !!previewThemeOverride,
    normalizePath: normalizePreviewPath,
    setCurrentFileInfo: (info) => {
      previewAssetCurrentPath = normalizePreviewPath(info && info.path ? info.path : '');
      updatePathLabel();
    },
    getCurrentPath: () => previewAssetCurrentPath
  };
}
