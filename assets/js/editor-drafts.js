import { readJsonStore, writeJsonStore } from './editor-storage.js?v=press-system-v3.4.47';

export function createScopedDraftStore({
  storage,
  storageKey,
  scopeKey
} = {}) {
  const resolveKey = () => (typeof scopeKey === 'function' ? scopeKey(storageKey) : storageKey);

  function read() {
    return readJsonStore(storage, resolveKey(), {});
  }

  function write(store) {
    writeJsonStore(storage, resolveKey(), store);
  }

  function removeEntry(key) {
    const store = read();
    if (!store || !Object.prototype.hasOwnProperty.call(store, key)) return false;
    delete store[key];
    write(store);
    return true;
  }

  return {
    read,
    write,
    removeEntry
  };
}
