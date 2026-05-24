function noop() {}

function safeCall(fn, fallback = null) {
  try { return typeof fn === 'function' ? fn() : fallback; }
  catch (_) { return fallback; }
}

export function createEditorBlocksRuntime({
  documentRef = typeof document !== 'undefined' ? document : null,
  windowRef = typeof window !== 'undefined' ? window : null,
  navigatorRef = typeof navigator !== 'undefined' ? navigator : null
} = {}) {
  function on(target, type, handler, options) {
    try {
      if (!target || typeof target.addEventListener !== 'function') return noop;
      target.addEventListener(type, handler, options);
      return () => {
        try {
          if (typeof target.removeEventListener === 'function') {
            target.removeEventListener(type, handler, options);
          }
        } catch (_) {}
      };
    } catch (_) {
      return noop;
    }
  }

  function requestFrame(fn) {
    const raf = windowRef && typeof windowRef.requestAnimationFrame === 'function'
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
    if (raf) return raf(fn);
    return setTimeout(fn, 0);
  }

  function setTimer(fn, delay = 0) {
    const timer = windowRef && typeof windowRef.setTimeout === 'function'
      ? windowRef.setTimeout.bind(windowRef)
      : (typeof setTimeout === 'function' ? setTimeout : null);
    return timer ? timer(fn, delay) : null;
  }

  function clearTimer(id) {
    if (id == null) return;
    const clear = windowRef && typeof windowRef.clearTimeout === 'function'
      ? windowRef.clearTimeout.bind(windowRef)
      : (typeof clearTimeout === 'function' ? clearTimeout : null);
    if (clear) {
      try { clear(id); } catch (_) {}
    }
  }

  async function writeClipboardText(text) {
    try {
      const clipboard = navigatorRef && navigatorRef.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') return false;
      if (!windowRef || !windowRef.isSecureContext) return false;
      await clipboard.writeText(String(text == null ? '' : text));
      return true;
    } catch (_) {
      return false;
    }
  }

  function translate(key, fallback) {
    return safeCall(() => {
      const translateRef = windowRef && windowRef.__press_t;
      return typeof translateRef === 'function' ? translateRef(key) : fallback;
    }, fallback);
  }

  return {
    documentRef,
    windowRef,
    navigatorRef,
    onDocument: (type, handler, options) => on(documentRef, type, handler, options),
    onWindow: (type, handler, options) => on(windowRef, type, handler, options),
    getElementById: (id) => safeCall(() => documentRef && documentRef.getElementById(id), null),
    createElement: (tagName) => safeCall(() => (
      documentRef && typeof documentRef.createElement === 'function'
        ? documentRef.createElement(tagName)
        : null
    ), null),
    createElementNS: (namespace, tagName) => safeCall(() => (
      documentRef && typeof documentRef.createElementNS === 'function'
        ? documentRef.createElementNS(namespace, tagName)
        : null
    ), null),
    getActiveElement: () => safeCall(() => documentRef && documentRef.activeElement, null),
    getBody: () => safeCall(() => documentRef && documentRef.body, null),
    getDocumentElement: () => safeCall(() => documentRef && documentRef.documentElement, null),
    getScrollingElement: () => safeCall(() => documentRef && documentRef.scrollingElement, null),
    getViewportHeight: () => safeCall(() => (
      windowRef && windowRef.innerHeight
        ? windowRef.innerHeight
        : ((documentRef && documentRef.documentElement && documentRef.documentElement.clientHeight) || 0)
    ), 0),
    getViewportWidth: () => safeCall(() => (
      windowRef && windowRef.innerWidth
        ? windowRef.innerWidth
        : ((documentRef && documentRef.documentElement && documentRef.documentElement.clientWidth) || 0)
    ), 0),
    getComputedStyle: (el) => safeCall(() => (
      windowRef && typeof windowRef.getComputedStyle === 'function'
        ? windowRef.getComputedStyle(el)
        : null
    ), null),
    prefersReducedMotion: () => safeCall(() => (
      !!(windowRef
        && typeof windowRef.matchMedia === 'function'
        && windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ), false),
    requestFrame,
    setTimer,
    clearTimer,
    writeClipboardText,
    translate
  };
}
