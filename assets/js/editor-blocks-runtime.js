import { createEditorAppRuntime } from './editor-app-runtime.js';

const TRANSLATE_GLOBAL = '__press_t';

export function createEditorBlocksRuntime(options = {}) {
  const documentRef = options && options.documentRef ? options.documentRef : null;
  const windowRef = options && options.windowRef ? options.windowRef : null;
  const appRuntime = createEditorAppRuntime({ documentRef, windowRef, storage: null });
  const blocksNavigatorRef = Object.prototype.hasOwnProperty.call(options || {}, 'navigatorRef')
    ? options.navigatorRef
    : appRuntime.browser.getNavigator();

  async function writeClipboardText(text) {
    return appRuntime.browser.writeClipboardText(text, blocksNavigatorRef);
  }

  function translate(key, fallback) {
    try {
      const translateRef = appRuntime.globals.get(TRANSLATE_GLOBAL);
      return typeof translateRef === 'function' ? translateRef(key) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  return {
    documentRef,
    windowRef,
    navigatorRef: blocksNavigatorRef,
    onDocument: appRuntime.events.onDocument,
    onWindow: appRuntime.events.onWindow,
    getElementById: appRuntime.browser.getElementById,
    createElement: appRuntime.browser.createElement,
    createElementNS: appRuntime.browser.createElementNS,
    getActiveElement: appRuntime.browser.getActiveElement,
    getBody: appRuntime.browser.getBody,
    getDocumentElement: appRuntime.browser.getDocumentElement,
    getScrollingElement: appRuntime.browser.getScrollingElement,
    getViewportHeight: () => appRuntime.browser.getViewportSize().height,
    getViewportWidth: appRuntime.browser.getViewportWidth,
    getComputedStyle: appRuntime.browser.getComputedStyle,
    prefersReducedMotion: () => appRuntime.browser.matchesMedia('(prefers-reduced-motion: reduce)'),
    requestFrame: appRuntime.browser.requestFrame,
    setTimer: appRuntime.browser.setTimer,
    clearTimer: appRuntime.browser.clearTimer,
    writeClipboardText,
    translate
  };
}
