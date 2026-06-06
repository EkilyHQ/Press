export function createEditorSessionStateStore({
  storage,
  scopeKey,
  keys = {}
} = {}) {
  const scoped = (key) => (typeof scopeKey === 'function' ? scopeKey(key) : key);

  function getItem(key) {
    try { return storage && storage.getItem ? storage.getItem(scoped(key)) : ''; }
    catch (_) { return ''; }
  }

  function readJson(key) {
    try {
      const raw = getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      if (storage && storage.setItem) {
        return storage.setItem(scoped(key), JSON.stringify(value)) !== false;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  return {
    readEditorState: () => readJson(keys.editorState),
    writeEditorState: (state) => writeJson(keys.editorState, state),
    readUnscopedNumber(key, fallback = 0) {
      try {
        const raw = storage && storage.getItem ? storage.getItem(key) : null;
        if (raw == null || raw === '') return fallback;
        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
      } catch (_) {
        return fallback;
      }
    },
    writeUnscopedNumber(key, value) {
      try {
        if (storage && storage.setItem) storage.setItem(key, String(Math.round(Number(value) || 0)));
      } catch (_) {}
    }
  };
}
