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
  function createRuntimeEvent(type, detail) {
    const CustomEventCtor = windowRef && typeof windowRef.CustomEvent === 'function'
      ? windowRef.CustomEvent
      : (typeof CustomEvent === 'function' ? CustomEvent : null);
    if (CustomEventCtor) return new CustomEventCtor(type, { detail });
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

  function emit(target, type, detail) {
    try {
      if (!target || typeof target.dispatchEvent !== 'function') return false;
      return target.dispatchEvent(createRuntimeEvent(type, detail));
    } catch (_) {
      return false;
    }
  }

  return {
    onDocument: (type, handler, options) => on(documentRef, type, handler, options),
    onWindow: (type, handler, options) => on(windowRef, type, handler, options),
    emitDocument: (type, detail) => emit(documentRef, type, detail),
    emitWindow: (type, detail) => emit(windowRef, type, detail)
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
    globals: createRuntimeGlobals(windowRef),
    createStateStore: createEditorStateStore
  };
}
