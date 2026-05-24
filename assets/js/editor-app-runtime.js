function noop() {}

function normalizeKind(kind, allowedKinds, defaultKind) {
  const value = String(kind || '').toLowerCase();
  return allowedKinds.includes(value) ? value : defaultKind;
}

function createKindRecord(kinds, source = {}, fallback = null) {
  const record = {};
  kinds.forEach((kind) => {
    record[kind] = Object.prototype.hasOwnProperty.call(source, kind)
      ? source[kind]
      : fallback;
  });
  return record;
}

export function createEditorStateStore({
  kinds = ['index', 'tabs', 'site'],
  defaultKind = 'index',
  initialState = null,
  initialBaseline = {},
  initialDiff = {}
} = {}) {
  const allowedKinds = Array.from(new Set(
    kinds.map(kind => String(kind || '').toLowerCase()).filter(Boolean)
  ));
  const fallbackKind = allowedKinds.includes(defaultKind)
    ? defaultKind
    : (allowedKinds[0] || 'state');
  let activeState = initialState;
  const remoteBaseline = createKindRecord(allowedKinds, initialBaseline, null);
  const diffCache = createKindRecord(allowedKinds, initialDiff, null);
  const normalize = (kind) => normalizeKind(kind, allowedKinds, fallbackKind);

  return {
    normalizeKind: normalize,
    getActiveState: () => activeState,
    setActiveState(state) {
      activeState = state || null;
      return activeState;
    },
    getStateSlice(kind) {
      if (!activeState) return null;
      return activeState[normalize(kind)];
    },
    setStateSlice(kind, value) {
      if (!activeState) return;
      activeState[normalize(kind)] = value;
    },
    getRemoteBaseline(kind) {
      if (arguments.length === 0) return remoteBaseline;
      return remoteBaseline[normalize(kind)];
    },
    getRemoteBaselines: () => remoteBaseline,
    setRemoteBaseline(kind, value) {
      remoteBaseline[normalize(kind)] = value;
    },
    getDiff(kind) {
      return diffCache[normalize(kind)];
    },
    getDiffCache: () => diffCache,
    setDiff(kind, value) {
      diffCache[normalize(kind)] = value;
    },
    hasDiff(kind) {
      const diff = diffCache[normalize(kind)];
      return !!(diff && diff.hasChanges);
    }
  };
}

function createRuntimeStorage(storage) {
  return {
    get native() {
      return storage || null;
    },
    getItem(key) {
      try {
        return storage && typeof storage.getItem === 'function'
          ? storage.getItem(key)
          : null;
      } catch (_) {
        return null;
      }
    },
    setItem(key, value) {
      try {
        if (!storage || typeof storage.setItem !== 'function') return false;
        storage.setItem(key, String(value));
        return true;
      } catch (_) {
        return false;
      }
    },
    removeItem(key) {
      try {
        if (!storage || typeof storage.removeItem !== 'function') return false;
        storage.removeItem(key);
        return true;
      } catch (_) {
        return false;
      }
    }
  };
}

function createRuntimeEvents({ documentRef, windowRef } = {}) {
  function createRuntimeEvent(type, detail, eventOptions = {}) {
    const CustomEventCtor = windowRef && typeof windowRef.CustomEvent === 'function'
      ? windowRef.CustomEvent
      : (typeof CustomEvent === 'function' ? CustomEvent : null);
    if (CustomEventCtor) return new CustomEventCtor(type, { ...eventOptions, detail });
    return { type, detail };
  }

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

  function emit(target, type, detail, eventOptions) {
    try {
      if (!target || typeof target.dispatchEvent !== 'function') return false;
      return target.dispatchEvent(createRuntimeEvent(type, detail, eventOptions));
    } catch (_) {
      return false;
    }
  }

  return {
    onDocument: (type, handler, options) => on(documentRef, type, handler, options),
    onWindow: (type, handler, options) => on(windowRef, type, handler, options),
    emitDocument: (type, detail, options) => emit(documentRef, type, detail, options),
    emitWindow: (type, detail, options) => emit(windowRef, type, detail, options)
  };
}

function createRuntimeGlobals(windowRef) {
  function get(name) {
    try {
      return windowRef ? windowRef[name] : undefined;
    } catch (_) {
      return undefined;
    }
  }

  function set(name, value) {
    try {
      if (!windowRef) return false;
      windowRef[name] = value;
      return true;
    } catch (_) {
      return false;
    }
  }

  function getObject(name) {
    const value = get(name);
    return value && typeof value === 'object' ? value : null;
  }

  return {
    get,
    set,
    getObject,
    getString(name, fallback = '') {
      const value = get(name);
      return value == null ? fallback : String(value);
    },
    setString(name, value) {
      return set(name, String(value == null ? '' : value));
    },
    getPressSiteRepo: () => getObject('__press_site_repo') || {},
    getPrimaryEditorApi: () => getObject('__press_primary_editor')
  };
}

function createRuntimeBrowser({ documentRef, windowRef } = {}) {
  function requestFrame(fn) {
    const raf = windowRef && typeof windowRef.requestAnimationFrame === 'function'
      ? windowRef.requestAnimationFrame.bind(windowRef)
      : (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
    if (raf) return raf(fn);
    return setTimeout(fn, 0);
  }

  function cancelFrame(id) {
    if (id == null) return;
    const caf = windowRef && typeof windowRef.cancelAnimationFrame === 'function'
      ? windowRef.cancelAnimationFrame.bind(windowRef)
      : (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
    try {
      if (caf) caf(id);
      else clearTimeout(id);
    } catch (_) {}
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

  function createEvent(type, options = {}) {
    const eventType = String(type || '');
    if (!eventType) return null;
    const eventOptions = options && typeof options === 'object' ? options : {};
    try {
      const EventCtor = windowRef && typeof windowRef.Event === 'function'
        ? windowRef.Event
        : null;
      if (EventCtor) return new EventCtor(eventType, eventOptions);
    } catch (_) {}
    try {
      if (documentRef && typeof documentRef.createEvent === 'function') {
        const event = documentRef.createEvent('Event');
        event.initEvent(eventType, !!eventOptions.bubbles, !!eventOptions.cancelable);
        return event;
      }
    } catch (_) {}
    return null;
  }

  function createMouseEvent(type, options = {}) {
    const eventType = String(type || '');
    if (!eventType) return null;
    const eventOptions = options && typeof options === 'object' ? options : {};
    try {
      const MouseEventCtor = windowRef && typeof windowRef.MouseEvent === 'function'
        ? windowRef.MouseEvent
        : null;
      if (MouseEventCtor) return new MouseEventCtor(eventType, eventOptions);
    } catch (_) {}
    return createEvent(eventType, eventOptions);
  }

  function getFileReader() {
    try {
      return windowRef && typeof windowRef.FileReader === 'function' ? windowRef.FileReader : null;
    } catch (_) {
      return null;
    }
  }

  function getNavigator() {
    try {
      return windowRef && windowRef.navigator ? windowRef.navigator : null;
    } catch (_) {
      return null;
    }
  }

  function getLocationOrigin() {
    try {
      return (windowRef && windowRef.location && windowRef.location.origin) || '';
    } catch (_) {
      return '';
    }
  }

  function getLocationHref() {
    try {
      return (windowRef && windowRef.location && windowRef.location.href) || '';
    } catch (_) {
      return '';
    }
  }

  function postMessage(targetWindow, payload, targetOrigin = getLocationOrigin()) {
    try {
      if (!targetWindow || typeof targetWindow.postMessage !== 'function') return false;
      targetWindow.postMessage(payload, targetOrigin || '*');
      return true;
    } catch (_) {
      return false;
    }
  }

  function matchesMedia(query) {
    try {
      return !!(windowRef && typeof windowRef.matchMedia === 'function' && windowRef.matchMedia(query).matches);
    } catch (_) {
      return false;
    }
  }

  function getPageYOffset() {
    try {
      return Number(windowRef && windowRef.pageYOffset) || 0;
    } catch (_) {
      return 0;
    }
  }

  function getWindowScroll() {
    try {
      return {
        x: Number(windowRef && (windowRef.scrollX || windowRef.pageXOffset)) || 0,
        y: Number(windowRef && (windowRef.scrollY || windowRef.pageYOffset)) || 0
      };
    } catch (_) {
      return { x: 0, y: 0 };
    }
  }

  function getViewportSize() {
    let width = 0;
    let height = 0;
    try {
      const windowWidth = Number(windowRef && windowRef.innerWidth);
      if (Number.isFinite(windowWidth) && windowWidth > 0) width = windowWidth;
    } catch (_) {}
    try {
      const windowHeight = Number(windowRef && windowRef.innerHeight);
      if (Number.isFinite(windowHeight) && windowHeight > 0) height = windowHeight;
    } catch (_) {}
    try {
      const docEl = documentRef && documentRef.documentElement;
      if (!width) {
        const docWidth = Number(docEl && docEl.clientWidth);
        if (Number.isFinite(docWidth) && docWidth > 0) width = docWidth;
      }
      if (!height) {
        const docHeight = Number(docEl && docEl.clientHeight);
        if (Number.isFinite(docHeight) && docHeight > 0) height = docHeight;
      }
    } catch (_) {}
    return { width, height };
  }

  function getViewportWidth() {
    return getViewportSize().width;
  }

  function getComputedStyleFor(element) {
    try {
      const getStyle = windowRef && typeof windowRef.getComputedStyle === 'function'
        ? windowRef.getComputedStyle.bind(windowRef)
        : (typeof getComputedStyle === 'function' ? getComputedStyle : null);
      return getStyle && element ? getStyle(element) : null;
    } catch (_) {
      return null;
    }
  }

  function getResizeObserver() {
    try {
      return windowRef && typeof windowRef.ResizeObserver === 'function' ? windowRef.ResizeObserver : null;
    } catch (_) {
      return null;
    }
  }

  function fetchContent(url, options) {
    try {
      const fetchRef = windowRef && typeof windowRef.fetch === 'function'
        ? windowRef.fetch.bind(windowRef)
        : null;
      if (!fetchRef) return Promise.reject(new Error('Fetch is not available in this runtime.'));
      return fetchRef(url, options);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function showAlert(message) {
    try {
      const alertRef = windowRef && typeof windowRef.alert === 'function'
        ? windowRef.alert.bind(windowRef)
        : null;
      if (!alertRef) return false;
      alertRef(message);
      return true;
    } catch (_) {
      return false;
    }
  }

  function confirmAction(message) {
    try {
      const confirmRef = windowRef && typeof windowRef.confirm === 'function'
        ? windowRef.confirm.bind(windowRef)
        : null;
      return confirmRef ? !!confirmRef(message) : false;
    } catch (_) {
      return false;
    }
  }

  function getPerformance() {
    try {
      return windowRef && windowRef.performance ? windowRef.performance : null;
    } catch (_) {
      return null;
    }
  }

  function getCss() {
    try {
      return windowRef && windowRef.CSS ? windowRef.CSS : null;
    } catch (_) {
      return null;
    }
  }

  function scrollToTop({ smooth = true } = {}) {
    try {
      if (!windowRef || typeof windowRef.scrollTo !== 'function') return false;
      if (smooth) windowRef.scrollTo({ top: 0, behavior: 'smooth' });
      else windowRef.scrollTo(0, 0);
      return true;
    } catch (_) {
      try {
        if (windowRef && typeof windowRef.scrollTo === 'function') {
          windowRef.scrollTo(0, 0);
          return true;
        }
      } catch (_) {}
      return false;
    }
  }

  return {
    getElementById: (id) => {
      try { return documentRef && typeof documentRef.getElementById === 'function' ? documentRef.getElementById(id) : null; }
      catch (_) { return null; }
    },
    querySelector: (selector) => {
      try { return documentRef && typeof documentRef.querySelector === 'function' ? documentRef.querySelector(selector) : null; }
      catch (_) { return null; }
    },
    querySelectorAll: (selector) => {
      try { return documentRef && typeof documentRef.querySelectorAll === 'function' ? Array.from(documentRef.querySelectorAll(selector)) : []; }
      catch (_) { return []; }
    },
    getDocumentElement: () => {
      try { return documentRef && documentRef.documentElement ? documentRef.documentElement : null; }
      catch (_) { return null; }
    },
    requestFrame,
    cancelFrame,
    setTimer,
    clearTimer,
    createEvent,
    createMouseEvent,
    getFileReader,
    getNavigator,
    getLocationOrigin,
    getLocationHref,
    postMessage,
    matchesMedia,
    getPageYOffset,
    getWindowScroll,
    getViewportSize,
    getViewportWidth,
    getComputedStyle: getComputedStyleFor,
    getResizeObserver,
    fetchContent,
    showAlert,
    confirmAction,
    getPerformance,
    getCss,
    scrollToTop
  };
}

function resolveWindowStorage(windowRef) {
  try {
    return windowRef && windowRef.localStorage ? windowRef.localStorage : null;
  } catch (_) {
    return null;
  }
}

export function createEditorAppRuntime({
  windowRef = typeof window !== 'undefined' ? window : null,
  documentRef = typeof document !== 'undefined' ? document : null,
  storage = undefined
} = {}) {
  const runtimeStorage = storage === undefined ? resolveWindowStorage(windowRef) : storage;
  return {
    windowRef,
    documentRef,
    storage: createRuntimeStorage(runtimeStorage),
    events: createRuntimeEvents({ documentRef, windowRef }),
    browser: createRuntimeBrowser({ documentRef, windowRef }),
    globals: createRuntimeGlobals(windowRef),
    createStateStore: createEditorStateStore
  };
}
