import { createEditorAppRuntime } from './editor-app-runtime.js?v=press-system-v3.4.50';

const LS_WRAP_KEY = 'press_editor_wrap_enabled';
const LS_VIEW_KEY = 'press_editor_markdown_view_v2';
const EDITOR_BASE_DIR_GLOBAL = '__press_editor_base_dir';
const CONTENT_ROOT_GLOBAL = '__press_content_root';
const PRIMARY_EDITOR_GLOBAL = '__press_primary_editor';

const EVENT_NAMES = {
  assetAdded: 'press-editor-asset-added',
  assetDeleteCanceled: 'press-editor-asset-delete-canceled',
  assetDeleteRequested: 'press-editor-asset-delete-requested',
  breadcrumbSelect: 'press-editor-current-file-breadcrumb-select',
  siteConfigChange: 'press-editor-site-config-change',
  toast: 'press-editor-toast'
};

export function normalizeMarkdownEditorView(mode) {
  if (mode === 'edit') return 'edit';
  return 'blocks';
}

function normalizeEditorBaseDir(dir, fallback = 'wwwroot/') {
  const fallbackDir = String(fallback || 'wwwroot/')
    .replace(/[\\]+/g, '/')
    .replace(/\/?$/, '/');
  const raw = (dir == null ? '' : String(dir)).trim();
  return raw
    ? raw.replace(/[\\]+/g, '/').replace(/\/?$/, '/')
    : fallbackDir;
}

function parseWrapState(raw) {
  if (!raw) return false;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  try { return Boolean(JSON.parse(raw)); }
  catch (_) { return false; }
}

export function createEditorMainRuntime(options = {}) {
  const runtime = createEditorAppRuntime(options);

  function onDocumentReady(handler) {
    if (typeof handler !== 'function') return () => {};
    const documentRef = runtime.documentRef;
    try {
      if (documentRef && documentRef.readyState && documentRef.readyState !== 'loading') {
        const timer = runtime.browser.setTimer(handler, 0);
        return () => { runtime.browser.clearTimer(timer); };
      }
    } catch (_) {}
    return runtime.events.onDocument('DOMContentLoaded', handler);
  }

  function readMarkdownEditorView() {
    return normalizeMarkdownEditorView(runtime.storage.getItem(LS_VIEW_KEY));
  }

  function persistMarkdownEditorView(mode) {
    return runtime.storage.setItem(LS_VIEW_KEY, normalizeMarkdownEditorView(mode));
  }

  function readWrapEnabled({ force = false } = {}) {
    if (force) return true;
    return parseWrapState(runtime.storage.getItem(LS_WRAP_KEY));
  }

  function persistWrapEnabled(on) {
    return runtime.storage.setItem(LS_WRAP_KEY, on ? '1' : '0');
  }

  function setContentRoot(contentRoot) {
    return runtime.globals.setString(CONTENT_ROOT_GLOBAL, contentRoot || 'wwwroot');
  }

  function getEditorBaseDir(fallback = 'wwwroot/') {
    const current = runtime.globals.getString(EDITOR_BASE_DIR_GLOBAL, '');
    return current ? String(current) : normalizeEditorBaseDir('', fallback);
  }

  function setEditorBaseDir(dir, fallback = 'wwwroot/') {
    const normalized = normalizeEditorBaseDir(dir, fallback);
    runtime.globals.setString(EDITOR_BASE_DIR_GLOBAL, normalized);
    return normalized;
  }

  function ensureEditorBaseDir(fallback = 'wwwroot/') {
    const current = runtime.globals.getString(EDITOR_BASE_DIR_GLOBAL, '');
    if (current) return current;
    return setEditorBaseDir('', fallback);
  }

  function registerPrimaryEditorApi(api) {
    return runtime.globals.set(PRIMARY_EDITOR_GLOBAL, api);
  }

  function onSiteConfigChange(handler) {
    return runtime.events.onWindow(EVENT_NAMES.siteConfigChange, handler);
  }

  function fetchContent(url, options) {
    try {
      const fetchRef = runtime.windowRef && typeof runtime.windowRef.fetch === 'function'
        ? runtime.windowRef.fetch.bind(runtime.windowRef)
        : (typeof fetch === 'function' ? fetch : null);
      if (!fetchRef) return Promise.reject(new Error('Fetch is not available in this runtime.'));
      return fetchRef(url, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function showAlert(message) {
    try {
      const alertRef = runtime.windowRef && typeof runtime.windowRef.alert === 'function'
        ? runtime.windowRef.alert.bind(runtime.windowRef)
        : (typeof alert === 'function' ? alert : null);
      if (!alertRef) return false;
      alertRef(message);
      return true;
    } catch (_) {
      return false;
    }
  }

  function prefersReducedMotion() {
    return runtime.browser.matchesMedia('(prefers-reduced-motion: reduce)');
  }

  function emitToast(kind, message) {
    const text = message == null ? '' : String(message);
    if (!text) return false;
    return runtime.events.emitWindow(EVENT_NAMES.toast, { kind: kind || 'info', message: text });
  }

  function requestAssetDelete(detail) {
    return runtime.events.emitWindow(EVENT_NAMES.assetDeleteRequested, detail, { cancelable: true });
  }

  function emitAssetDeleteCanceled(detail) {
    return runtime.events.emitWindow(EVENT_NAMES.assetDeleteCanceled, detail);
  }

  function emitAssetAdded(detail) {
    return runtime.events.emitWindow(EVENT_NAMES.assetAdded, detail);
  }

  function emitCurrentFileBreadcrumbSelect(detail) {
    return runtime.events.emitDocument(EVENT_NAMES.breadcrumbSelect, detail);
  }

  return {
    documentRef: runtime.documentRef,
    windowRef: runtime.windowRef,
    events: EVENT_NAMES,
    readMarkdownEditorView,
    persistMarkdownEditorView,
    readWrapEnabled,
    persistWrapEnabled,
    onDocumentReady,
    onDocument: runtime.events.onDocument,
    onWindow: runtime.events.onWindow,
    getElementById: runtime.browser.getElementById,
    querySelector: runtime.browser.querySelector,
    querySelectorAll: runtime.browser.querySelectorAll,
    getDocumentElement: runtime.browser.getDocumentElement,
    requestFrame: runtime.browser.requestFrame,
    cancelFrame: runtime.browser.cancelFrame,
    setTimer: runtime.browser.setTimer,
    clearTimer: runtime.browser.clearTimer,
    createEvent: runtime.browser.createEvent,
    createMouseEvent: runtime.browser.createMouseEvent,
    getFileReader: runtime.browser.getFileReader,
    postMessage: runtime.browser.postMessage,
    getLocationOrigin: runtime.browser.getLocationOrigin,
    getLocationHref: runtime.browser.getLocationHref,
    getPageYOffset: runtime.browser.getPageYOffset,
    scrollToTop: runtime.browser.scrollToTop,
    prefersReducedMotion,
    setContentRoot,
    getEditorBaseDir,
    setEditorBaseDir,
    ensureEditorBaseDir,
    registerPrimaryEditorApi,
    onSiteConfigChange,
    fetchContent,
    showAlert,
    emitToast,
    requestAssetDelete,
    emitAssetDeleteCanceled,
    emitAssetAdded,
    emitCurrentFileBreadcrumbSelect
  };
}
