import { createBrowserEditorAppRuntime } from './editor-app-runtime.js?v=press-system-v3.4.50';

const POPULATE_EDITOR_LANGUAGE_SELECT_GLOBAL = '__pressPopulateEditorLanguageSelect';
const SOFT_RESET_LANG_GLOBAL = '__press_softResetLang';

export function createEditorBootRuntime(options = {}) {
  const runtime = options.runtime || createBrowserEditorAppRuntime(options);

  function getTranslationElements(root = null) {
    const scope = root && typeof root.querySelectorAll === 'function'
      ? root
      : runtime.documentRef;
    try {
      return scope && typeof scope.querySelectorAll === 'function'
        ? Array.from(scope.querySelectorAll('*'))
        : [];
    } catch (_) {
      return [];
    }
  }

  function setDocumentTitle(value) {
    try {
      if (!runtime.documentRef) return false;
      runtime.documentRef.title = String(value == null ? '' : value);
      return true;
    } catch (_) {
      return false;
    }
  }

  return {
    documentRef: runtime.documentRef,
    windowRef: runtime.windowRef,
    getTranslationElements,
    setDocumentTitle,
    getLanguageSelect: () => runtime.browser.getElementById('editorLangSelect'),
    createOption: () => runtime.browser.createElement('option'),
    onDocumentReady: (handler) => runtime.browser.onDocumentReady(handler),
    onLanguageControlMounted: (handler) => runtime.events.onDocument('press-editor-language-control-mounted', handler),
    onI18nBundleLoaded: (handler) => runtime.events.onWindow('ns:i18n-bundle-loaded', handler),
    emitLanguageApplied: () => runtime.events.emitDocument('press-editor-language-applied'),
    setPopulateLanguageSelect(handler) {
      return runtime.globals.set(POPULATE_EDITOR_LANGUAGE_SELECT_GLOBAL, handler);
    },
    setSoftResetLanguage(handler) {
      return runtime.globals.set(SOFT_RESET_LANG_GLOBAL, handler);
    }
  };
}
