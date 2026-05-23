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
    emitSiteConfigChange
  };
}
