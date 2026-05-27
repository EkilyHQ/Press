function noop() {}

export function bindEventEffect(target, type, handler, options) {
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

export function createStorageEffects(storage) {
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

export function resolveStorageEffect(windowRef, name = 'localStorage') {
  try {
    return windowRef && windowRef[name] ? windowRef[name] : null;
  } catch (_) {
    return null;
  }
}

export function createEventEffects({ documentRef = null, windowRef = null } = {}) {
  function createCustomEvent(type, detail, eventOptions = {}) {
    const CustomEventCtor = windowRef && typeof windowRef.CustomEvent === 'function'
      ? windowRef.CustomEvent
      : null;
    if (CustomEventCtor) return new CustomEventCtor(type, { ...eventOptions, detail });
    return { type, detail };
  }

  function emit(target, type, detail, eventOptions) {
    try {
      if (!target || typeof target.dispatchEvent !== 'function') return false;
      return target.dispatchEvent(createCustomEvent(type, detail, eventOptions));
    } catch (_) {
      return false;
    }
  }

  return {
    on: bindEventEffect,
    onDocument: (type, handler, options) => bindEventEffect(documentRef, type, handler, options),
    onWindow: (type, handler, options) => bindEventEffect(windowRef, type, handler, options),
    emit,
    emitDocument: (type, detail, options) => emit(documentRef, type, detail, options),
    emitWindow: (type, detail, options) => emit(windowRef, type, detail, options)
  };
}

export function createDomEffects({ documentRef = null } = {}) {
  return {
    on: bindEventEffect,
    getElementById(id) {
      try {
        return documentRef && typeof documentRef.getElementById === 'function'
          ? documentRef.getElementById(id)
          : null;
      } catch (_) {
        return null;
      }
    },
    querySelector(selector) {
      try {
        return documentRef && typeof documentRef.querySelector === 'function'
          ? documentRef.querySelector(selector)
          : null;
      } catch (_) {
        return null;
      }
    },
    querySelectorAll(selector) {
      try {
        return documentRef && typeof documentRef.querySelectorAll === 'function'
          ? Array.from(documentRef.querySelectorAll(selector))
          : [];
      } catch (_) {
        return [];
      }
    }
  };
}
