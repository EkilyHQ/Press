import { createEditorAppRuntime } from './editor-app-runtime.js?v=press-system-v3.4.50';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

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
  const runtime = createEditorAppRuntime(options);

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

  async function fetchText(filename) {
    try {
      const response = await runtime.browser.fetchContent(String(filename || ''), { cache: 'no-store' });
      return response && response.ok ? response.text() : '';
    } catch (_) {
      return '';
    }
  }

  return {
    documentRef: runtime.documentRef,
    windowRef: runtime.windowRef,
    postToParent,
    onRenderMessage,
    isTrustedMessageEvent,
    applyColorMode,
    fetchText,
    warn: runtime.browser.warn
  };
}
