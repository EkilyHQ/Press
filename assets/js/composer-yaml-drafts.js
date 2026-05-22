const DRAFT_KINDS = ['index', 'tabs', 'site'];

function normalizeKind(kind) {
  if (kind === 'tabs') return 'tabs';
  if (kind === 'site') return 'site';
  return 'index';
}

export function createComposerYamlDraftController(options = {}) {
  const draftStore = options.draftStore || null;
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => null;
  const setStateSlice = typeof options.setStateSlice === 'function' ? options.setStateSlice : () => {};
  const getComposerDiff = typeof options.getComposerDiff === 'function' ? options.getComposerDiff : () => null;
  const computeBaselineSignature = typeof options.computeBaselineSignature === 'function' ? options.computeBaselineSignature : () => '';
  const prepareIndexState = typeof options.prepareIndexState === 'function' ? options.prepareIndexState : (value) => value;
  const prepareTabsState = typeof options.prepareTabsState === 'function' ? options.prepareTabsState : (value) => value;
  const cloneSiteState = typeof options.cloneSiteState === 'function' ? options.cloneSiteState : (value) => value;
  const updateUnsyncedSummary = typeof options.updateUnsyncedSummary === 'function' ? options.updateUnsyncedSummary : () => {};
  const setTimeoutRef = typeof options.setTimeoutRef === 'function' ? options.setTimeoutRef : setTimeout;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function' ? options.clearTimeoutRef : clearTimeout;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();

  const draftMeta = { index: null, tabs: null, site: null };
  const autoSaveTimers = { index: null, tabs: null, site: null };

  function readDraftStore() {
    return draftStore && typeof draftStore.read === 'function' ? draftStore.read() : {};
  }

  function writeDraftStore(store) {
    if (draftStore && typeof draftStore.write === 'function') draftStore.write(store);
  }

  function removeDraftEntry(kind) {
    const safeKind = normalizeKind(kind);
    if (draftStore && typeof draftStore.removeEntry === 'function') {
      draftStore.removeEntry(safeKind);
      return;
    }
    const store = readDraftStore();
    if (store && Object.prototype.hasOwnProperty.call(store, safeKind)) {
      delete store[safeKind];
      writeDraftStore(store);
    }
  }

  function prepareSnapshot(kind, value) {
    const safeKind = normalizeKind(kind);
    if (safeKind === 'tabs') return prepareTabsState(value || {});
    if (safeKind === 'site') return cloneSiteState(value || {});
    return prepareIndexState(value || {});
  }

  function getDraftMeta(kind) {
    return draftMeta[normalizeKind(kind)] || null;
  }

  function hasDraftMeta(kind) {
    return !!getDraftMeta(kind);
  }

  function hasAnyDraftMeta() {
    return DRAFT_KINDS.some((kind) => !!draftMeta[kind]);
  }

  function clearAutoDraftTimer(kind) {
    const safeKind = normalizeKind(kind);
    if (!autoSaveTimers[safeKind]) return;
    clearTimeoutRef(autoSaveTimers[safeKind]);
    autoSaveTimers[safeKind] = null;
  }

  function clearDraftStorage(kind) {
    const safeKind = normalizeKind(kind);
    removeDraftEntry(safeKind);
    draftMeta[safeKind] = null;
  }

  function saveDraftToStorage(kind, opts = {}) {
    const safeKind = normalizeKind(kind);
    const slice = getStateSlice(safeKind);
    if (!slice) return null;
    const snapshot = prepareSnapshot(safeKind, slice);
    const store = readDraftStore();
    const savedAt = now();
    const baseSignature = computeBaselineSignature(safeKind);
    store[safeKind] = { savedAt, data: snapshot, baseSignature };
    writeDraftStore(store);
    draftMeta[safeKind] = { savedAt, baseSignature, lastManual: !!(opts && opts.manual) };
    updateUnsyncedSummary();

    return draftMeta[safeKind];
  }

  function scheduleAutoDraft(kind) {
    const safeKind = normalizeKind(kind);
    clearAutoDraftTimer(safeKind);
    const diff = getComposerDiff(safeKind);
    if (!diff || !diff.hasChanges) {
      clearDraftStorage(safeKind);
      updateUnsyncedSummary();
      return;
    }
    autoSaveTimers[safeKind] = setTimeoutRef(() => {
      autoSaveTimers[safeKind] = null;
      saveDraftToStorage(safeKind, { manual: false });
    }, 800);
  }

  function loadDraftSnapshotsIntoState(state) {
    const restored = [];
    const targetState = state && typeof state === 'object' ? state : {};
    const store = readDraftStore();
    if (!store || typeof store !== 'object') return restored;

    DRAFT_KINDS.forEach((kind) => {
      const entry = store[kind];
      if (!entry || !entry.data) return;
      const snapshot = prepareSnapshot(kind, entry.data);
      targetState[kind] = snapshot;
      setStateSlice(kind, snapshot);
      draftMeta[kind] = {
        savedAt: Number(entry.savedAt) || now(),
        baseSignature: entry.baseSignature ? String(entry.baseSignature) : '',
        lastManual: false
      };
      restored.push(kind);
    });
    return restored;
  }

  function getDraftMetaSnapshot() {
    return {
      index: draftMeta.index ? { ...draftMeta.index } : null,
      tabs: draftMeta.tabs ? { ...draftMeta.tabs } : null,
      site: draftMeta.site ? { ...draftMeta.site } : null
    };
  }

  return {
    readDraftStore,
    writeDraftStore,
    getDraftMeta,
    hasDraftMeta,
    hasAnyDraftMeta,
    getDraftMetaSnapshot,
    clearAutoDraftTimer,
    clearDraftStorage,
    saveDraftToStorage,
    scheduleAutoDraft,
    loadDraftSnapshotsIntoState
  };
}
