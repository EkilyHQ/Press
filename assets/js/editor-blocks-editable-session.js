function isObjectLike(value) {
  return (value && typeof value === 'object') || typeof value === 'function';
}

function normalizeSync(sync) {
  return typeof sync === 'function' ? sync : null;
}

export function createEditorBlocksEditableSession() {
  const editableSyncMap = new WeakMap();

  function registerEditable(editable, sync = null) {
    if (!isObjectLike(editable)) return false;
    editableSyncMap.set(editable, normalizeSync(sync));
    return true;
  }

  function getSync(editable) {
    if (!isObjectLike(editable)) return null;
    return normalizeSync(editableSyncMap.get(editable));
  }

  function getSyncOr(editable, fallback = null) {
    return getSync(editable) || normalizeSync(fallback);
  }

  function bindActiveEditing(blocksState, editable, fallbackSync = null) {
    if (!blocksState || typeof blocksState.setActiveEditing !== 'function') return null;
    const sync = getSyncOr(editable, fallbackSync);
    blocksState.setActiveEditing(editable, sync);
    return sync;
  }

  return {
    registerEditable,
    getSync,
    getSyncOr,
    bindActiveEditing
  };
}
