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

  function getLocationOrigin() {
    try {
      return (windowRef && windowRef.location && windowRef.location.origin) || '';
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

  function getViewportWidth() {
    try {
      const width = Number(windowRef && windowRef.innerWidth);
      if (Number.isFinite(width) && width > 0) return width;
    } catch (_) {}
    try {
      const width = Number(documentRef && documentRef.documentElement && documentRef.documentElement.clientWidth);
      return Number.isFinite(width) && width > 0 ? width : 0;
    } catch (_) {
      return 0;
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
    getLocationOrigin,
    postMessage,
    matchesMedia,
    getPageYOffset,
    getViewportWidth,
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
