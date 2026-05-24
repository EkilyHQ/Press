import { createEditorAppRuntime } from './editor-app-runtime.js?v=press-system-v3.4.50';

const CONTENT_ROOT_GLOBAL = '__press_content_root';
const SITE_REPO_GLOBAL = '__press_site_repo';

export const COMPOSER_RUNTIME_EVENTS = {
  languagePoolChanged: 'press-composer-language-pool-changed',
  siteConfigChange: 'press-editor-site-config-change'
};

function normalizeContentRoot(value) {
  const root = String(value || 'wwwroot').trim().replace(/[\\]+/g, '/').replace(/^\/+|\/+$/g, '');
  return root || 'wwwroot';
}

function normalizeSiteRepo(repo) {
  const source = repo && typeof repo === 'object' ? repo : {};
  return {
    owner: String(source.owner || ''),
    name: String(source.name || ''),
    branch: String(source.branch || 'main') || 'main'
  };
}

export function createComposerRuntime(options = {}) {
  const runtime = createEditorAppRuntime(options);

  function onDocumentReady(handler) {
    if (typeof handler !== 'function') return () => {};
    const documentRef = runtime.documentRef;
    try {
      if (documentRef && documentRef.readyState && documentRef.readyState !== 'loading') {
        const timer = runtime.browser.setTimer(handler, 0);
        return () => runtime.browser.clearTimer(timer);
      }
    } catch (_) {}
    return runtime.events.onDocument('DOMContentLoaded', handler);
  }

  function getLocation() {
    try {
      return runtime.windowRef && runtime.windowRef.location ? runtime.windowRef.location : null;
    } catch (_) {
      return null;
    }
  }

  function getContentRoot() {
    return normalizeContentRoot(runtime.globals.getString(CONTENT_ROOT_GLOBAL, 'wwwroot'));
  }

  function setContentRoot(root) {
    const normalized = normalizeContentRoot(root);
    runtime.globals.setString(CONTENT_ROOT_GLOBAL, normalized);
    return normalized;
  }

  function getSiteRepo() {
    return normalizeSiteRepo(runtime.globals.getObject(SITE_REPO_GLOBAL));
  }

  function setSiteRepo(repo) {
    const normalized = normalizeSiteRepo(repo);
    runtime.globals.set(SITE_REPO_GLOBAL, normalized);
    return normalized;
  }

  function ensureSiteRepo() {
    const existing = runtime.globals.getObject(SITE_REPO_GLOBAL);
    if (existing) return normalizeSiteRepo(existing);
    return setSiteRepo({});
  }

  function emitLanguagePoolChanged() {
    return runtime.events.emitDocument(COMPOSER_RUNTIME_EVENTS.languagePoolChanged);
  }

  function emitSiteConfigChange(siteConfig) {
    return runtime.events.emitWindow(COMPOSER_RUNTIME_EVENTS.siteConfigChange, { siteConfig });
  }

  function requestFrame(handler) {
    return runtime.browser.requestFrame(handler);
  }

  function cancelFrame(id) {
    return runtime.browser.cancelFrame(id);
  }

  function setTimer(handler, delay = 0) {
    return runtime.browser.setTimer(handler, delay);
  }

  function clearTimer(id) {
    return runtime.browser.clearTimer(id);
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

  function confirmAction(message) {
    try {
      const confirmRef = runtime.windowRef && typeof runtime.windowRef.confirm === 'function'
        ? runtime.windowRef.confirm.bind(runtime.windowRef)
        : (typeof confirm === 'function' ? confirm : null);
      return confirmRef ? !!confirmRef(message) : false;
    } catch (_) {
      return false;
    }
  }

  function getPerformance() {
    try {
      return runtime.windowRef && runtime.windowRef.performance
        ? runtime.windowRef.performance
        : (typeof performance !== 'undefined' ? performance : null);
    } catch (_) {
      return null;
    }
  }

  function getCss() {
    try {
      return runtime.windowRef && runtime.windowRef.CSS
        ? runtime.windowRef.CSS
        : (typeof CSS !== 'undefined' ? CSS : null);
    } catch (_) {
      return null;
    }
  }

  function matchesMedia(query) {
    return runtime.browser.matchesMedia(query);
  }

  function getComputedStyle(element) {
    try {
      const getStyleRef = runtime.windowRef && typeof runtime.windowRef.getComputedStyle === 'function'
        ? runtime.windowRef.getComputedStyle.bind(runtime.windowRef)
        : (typeof globalThis !== 'undefined' && typeof globalThis.getComputedStyle === 'function'
          ? globalThis.getComputedStyle.bind(globalThis)
          : null);
      return getStyleRef && element ? getStyleRef(element) : null;
    } catch (_) {
      return null;
    }
  }

  function getResizeObserver() {
    try {
      return runtime.windowRef && typeof runtime.windowRef.ResizeObserver === 'function'
        ? runtime.windowRef.ResizeObserver
        : (typeof ResizeObserver === 'function' ? ResizeObserver : null);
    } catch (_) {
      return null;
    }
  }

  return {
    ...runtime,
    onDocumentReady,
    getLocation,
    getContentRoot,
    setContentRoot,
    getSiteRepo,
    setSiteRepo,
    ensureSiteRepo,
    emitLanguagePoolChanged,
    emitSiteConfigChange,
    requestFrame,
    cancelFrame,
    setTimer,
    clearTimer,
    fetchContent,
    showAlert,
    confirmAction,
    getPerformance,
    getCss,
    matchesMedia,
    getComputedStyle,
    getResizeObserver
  };
}
