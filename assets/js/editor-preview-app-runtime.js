import { createBrowserEditorAppRuntime } from './editor-app-runtime.js?v=press-system-v3.4.50';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';
const THEME_PACK_HREF_GLOBAL = '__themePackHref';

function normalizeRequestId(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function setDocumentTheme(documentElement, dark) {
  try {
    if (!documentElement) return false;
    if (dark) documentElement.setAttribute('data-theme', 'dark');
    else documentElement.removeAttribute('data-theme');
    return true;
  } catch (_) {
    return false;
  }
}

export function createEditorPreviewAppRuntime(options = {}) {
  const runtime = createBrowserEditorAppRuntime(options);
  let activeThemePack = '';
  let latestRenderRequestId = 0;

  function getParentWindow() {
    return runtime.globals.get('parent') || null;
  }

  function postToParent(payload) {
    return runtime.browser.postMessage(
      getParentWindow(),
      payload,
      runtime.browser.getLocationOrigin()
    );
  }

  function onRenderMessage(handler) {
    return runtime.events.onWindow('message', handler);
  }

  function isTrustedMessageEvent(event) {
    return !!event && event.origin === runtime.browser.getLocationOrigin();
  }

  function beginRender(requestId) {
    latestRenderRequestId = normalizeRequestId(requestId);
    return latestRenderRequestId;
  }

  function isCurrentRender(requestId) {
    return normalizeRequestId(requestId) === latestRenderRequestId;
  }

  function shouldResetThemePack(pack) {
    return activeThemePack !== String(pack || '');
  }

  function setActiveThemePack(pack) {
    activeThemePack = String(pack || '');
    return activeThemePack;
  }

  function getActiveThemePack() {
    return activeThemePack;
  }

  function applyColorMode(siteConfig = {}) {
    const documentElement = runtime.browser.getDocumentElement();
    const mode = String(siteConfig.themeMode || '').toLowerCase();
    if (mode === 'dark') return setDocumentTheme(documentElement, true);
    if (mode === 'light') return setDocumentTheme(documentElement, false);
    if (mode === 'auto') {
      return setDocumentTheme(documentElement, runtime.browser.matchesMedia(DARK_SCHEME_QUERY));
    }
    return setDocumentTheme(documentElement, runtime.storage.getItem('theme') === 'dark');
  }

  function applyThemeStyleLinks({ primary = '', extraHrefs = [], pack = '' } = {}) {
    const primaryHref = String(primary || '');
    if (!primaryHref) return false;
    const themePack = String(pack || '');
    try {
      const link = runtime.browser.getElementById('theme-pack');
      if (link && typeof link.getAttribute === 'function' && typeof link.setAttribute === 'function') {
        if (link.getAttribute('href') !== primaryHref) link.setAttribute('href', primaryHref);
      }
      runtime.globals.setString(THEME_PACK_HREF_GLOBAL, primaryHref);
    } catch (_) {}
    try {
      runtime.browser.querySelectorAll('link[data-theme-pack-extra-style]').forEach((node) => {
        if (node && typeof node.remove === 'function') node.remove();
      });
      const head = runtime.documentRef && runtime.documentRef.head;
      if (!head || typeof head.appendChild !== 'function') return true;
      extraHrefs.forEach((href, index) => {
        const extraHref = String(href || '');
        if (!extraHref) return;
        const link = runtime.browser.createElement('link');
        if (!link) return;
        link.rel = 'stylesheet';
        link.href = extraHref;
        if (typeof link.setAttribute === 'function') {
          link.setAttribute('data-theme-pack-extra-style', `${themePack}:${index + 1}`);
        }
        head.appendChild(link);
      });
    } catch (_) {}
    return true;
  }

  function querySelector(selector) {
    return runtime.browser.querySelector(selector);
  }

  function getBody() {
    return runtime.browser.getBody();
  }

  function getThemeLayoutPackFallback() {
    const body = getBody();
    try {
      return body && body.dataset ? String(body.dataset.themeLayout || '') : '';
    } catch (_) {
      return '';
    }
  }

  function getPreviewStatusElement({ fallbackToBody = false } = {}) {
    const status = runtime.browser.getElementById('editorPreviewStatus');
    if (status || !fallbackToBody) return status;
    return getBody();
  }

  async function fetchText(filename) {
    try {
      const response = await runtime.browser.fetchContent(String(filename || ''), { cache: 'no-store' });
      return response && response.ok ? response.text() : '';
    } catch (_) {
      return '';
    }
  }

  async function writeClipboardText(text) {
    return runtime.browser.writeClipboardText(text);
  }

  return {
    documentRef: runtime.documentRef,
    windowRef: runtime.windowRef,
    setTimer: runtime.browser.setTimer,
    writeClipboardText,
    getNodeFilter: runtime.browser.getNodeFilter,
    postToParent,
    onRenderMessage,
    isTrustedMessageEvent,
    beginRender,
    isCurrentRender,
    shouldResetThemePack,
    setActiveThemePack,
    getActiveThemePack,
    applyColorMode,
    applyThemeStyleLinks,
    querySelector,
    getBody,
    getThemeLayoutPackFallback,
    getPreviewStatusElement,
    fetchText,
    warn: runtime.browser.warn
  };
}
