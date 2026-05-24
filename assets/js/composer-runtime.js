import { createBrowserEditorAppRuntime } from './editor-app-runtime.js?v=press-system-v3.4.50';

const CONTENT_ROOT_GLOBAL = '__press_content_root';
const SITE_REPO_GLOBAL = '__press_site_repo';
const POPULATE_EDITOR_LANGUAGE_SELECT_GLOBAL = '__pressPopulateEditorLanguageSelect';

export const COMPOSER_RUNTIME_EVENTS = {
  languagePoolChanged: 'press-composer-language-pool-changed',
  siteConfigChange: 'press-editor-site-config-change',
  editorLanguageControlMounted: 'press-editor-language-control-mounted'
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
  const runtime = createBrowserEditorAppRuntime(options);
  const clipboardNavigatorRef = options.navigatorRef || null;

  function onDocumentReady(handler) {
    return runtime.browser.onDocumentReady(handler);
  }

  function getLocation() {
    return runtime.browser.getLocation();
  }

  function getLocationOrigin() {
    return runtime.browser.getLocationOrigin();
  }

  function getLocationHref() {
    return runtime.browser.getLocationHref();
  }

  function getDocumentLang() {
    return runtime.browser.getDocumentLang();
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

  function emitEditorLanguageControlMounted() {
    return runtime.events.emitDocument(COMPOSER_RUNTIME_EVENTS.editorLanguageControlMounted);
  }

  function emitSiteConfigChange(siteConfig) {
    return runtime.events.emitWindow(COMPOSER_RUNTIME_EVENTS.siteConfigChange, { siteConfig });
  }

  function populateEditorLanguageSelect() {
    return runtime.globals.call(POPULATE_EDITOR_LANGUAGE_SELECT_GLOBAL);
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
    return runtime.browser.fetchContent(url, options);
  }

  function showAlert(message) {
    return runtime.browser.showAlert(message);
  }

  function openWindow(href = '', target = '_blank', features) {
    return runtime.browser.openWindow(href, target, features);
  }

  function warn(...args) {
    return runtime.browser.warn(...args);
  }

  function error(...args) {
    return runtime.browser.error(...args);
  }

  function confirmAction(message) {
    return runtime.browser.confirmAction(message);
  }

  function getPerformance() {
    return runtime.browser.getPerformance();
  }

  function getCss() {
    return runtime.browser.getCss();
  }

  function matchesMedia(query) {
    return runtime.browser.matchesMedia(query);
  }

  function getViewportWidth() {
    return runtime.browser.getViewportWidth();
  }

  function getViewportSize() {
    return runtime.browser.getViewportSize();
  }

  function getWindowScroll() {
    return runtime.browser.getWindowScroll();
  }

  function scrollWindowToTop(behavior = 'smooth') {
    return runtime.browser.scrollToTop({
      smooth: behavior !== 'auto' && behavior !== 'instant'
    });
  }

  function getComputedStyle(element) {
    return runtime.browser.getComputedStyle(element);
  }

  function getResizeObserver() {
    return runtime.browser.getResizeObserver();
  }

  async function writeClipboardText(text) {
    return runtime.browser.writeClipboardText(text, clipboardNavigatorRef);
  }

  return {
    ...runtime,
    onDocumentReady,
    getLocation,
    getLocationOrigin,
    getLocationHref,
    getDocumentLang,
    getContentRoot,
    setContentRoot,
    getSiteRepo,
    setSiteRepo,
    ensureSiteRepo,
    emitLanguagePoolChanged,
    emitEditorLanguageControlMounted,
    emitSiteConfigChange,
    populateEditorLanguageSelect,
    requestFrame,
    cancelFrame,
    setTimer,
    clearTimer,
    fetchContent,
    showAlert,
    openWindow,
    warn,
    error,
    confirmAction,
    getPerformance,
    getCss,
    matchesMedia,
    getViewportSize,
    getViewportWidth,
    getWindowScroll,
    scrollWindowToTop,
    getComputedStyle,
    getResizeObserver,
    writeClipboardText
  };
}
