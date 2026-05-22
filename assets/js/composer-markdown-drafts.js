import {
  bumpMarkdownDraftSaveGeneration,
  getMarkdownDraftSaveGeneration,
  hasMarkdownDraftContent,
  isEncryptedMarkdownDraftEntry,
  normalizeMarkdownContent
} from './composer-markdown-state.js?v=press-system-v3.4.45';

const noop = () => {};

function valuesFromCollection(collection) {
  if (!collection) return [];
  if (collection instanceof Map) return Array.from(collection.values());
  if (Array.isArray(collection)) return collection;
  if (typeof collection.values === 'function') {
    try { return Array.from(collection.values()); }
    catch (_) {}
  }
  return [];
}

export function createComposerMarkdownDraftController(options = {}) {
  const draftStore = options.markdownDraftStore || null;
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : (value) => String(value || '').replace(/[\\]/g, '/');
  const normalizeAssetDescriptor = typeof options.normalizeAssetDescriptor === 'function' ? options.normalizeAssetDescriptor : () => null;
  const normalizeAssetDeletionDescriptor = typeof options.normalizeAssetDeletionDescriptor === 'function' ? options.normalizeAssetDeletionDescriptor : () => null;
  const importMarkdownAssetsForPath = typeof options.importMarkdownAssetsForPath === 'function' ? options.importMarkdownAssetsForPath : () => null;
  const importMarkdownAssetDeletionsForPath = typeof options.importMarkdownAssetDeletionsForPath === 'function' ? options.importMarkdownAssetDeletionsForPath : noop;
  const exportMarkdownAssetBucket = typeof options.exportMarkdownAssetBucket === 'function' ? options.exportMarkdownAssetBucket : () => [];
  const exportMarkdownAssetDeletionBucket = typeof options.exportMarkdownAssetDeletionBucket === 'function' ? options.exportMarkdownAssetDeletionBucket : () => [];
  const clearMarkdownAssetsForPath = typeof options.clearMarkdownAssetsForPath === 'function' ? options.clearMarkdownAssetsForPath : noop;
  const ensureMarkdownAssetBucket = typeof options.ensureMarkdownAssetBucket === 'function' ? options.ensureMarkdownAssetBucket : () => null;
  const countMarkdownAssetDeletions = typeof options.countMarkdownAssetDeletions === 'function' ? options.countMarkdownAssetDeletions : () => 0;
  const prepareMarkdownForProtectedStorage = typeof options.prepareMarkdownForProtectedStorage === 'function'
    ? options.prepareMarkdownForProtectedStorage
    : async (_tab, text) => ({ content: normalizeMarkdownContent(text), encrypted: false });
  const getMarkdownProtectionState = typeof options.getMarkdownProtectionState === 'function' ? options.getMarkdownProtectionState : () => ({});
  const setMarkdownProtectionState = typeof options.setMarkdownProtectionState === 'function' ? options.setMarkdownProtectionState : noop;
  const getDynamicEditorTabs = typeof options.getDynamicEditorTabs === 'function' ? options.getDynamicEditorTabs : () => [];
  const getCurrentMode = typeof options.getCurrentMode === 'function' ? options.getCurrentMode : () => null;
  const pushEditorCurrentFileInfo = typeof options.pushEditorCurrentFileInfo === 'function' ? options.pushEditorCurrentFileInfo : noop;
  const updateMarkdownPushButton = typeof options.updateMarkdownPushButton === 'function' ? options.updateMarkdownPushButton : noop;
  const updateComposerMarkdownDraftIndicators = typeof options.updateComposerMarkdownDraftIndicators === 'function' ? options.updateComposerMarkdownDraftIndicators : noop;
  const refreshEditorContentTree = typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : noop;
  const updateUnsyncedSummary = typeof options.updateUnsyncedSummary === 'function' ? options.updateUnsyncedSummary : noop;
  const showToast = typeof options.showToast === 'function' ? options.showToast : noop;
  const t = typeof options.t === 'function' ? options.t : (key) => String(key || '');
  const consoleRef = options.consoleRef || console;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function' ? options.setTimeoutRef : setTimeout;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function' ? options.clearTimeoutRef : clearTimeout;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();

  function readDraftStore() {
    return draftStore && typeof draftStore.read === 'function' ? draftStore.read() : {};
  }

  function writeDraftStore(store) {
    if (draftStore && typeof draftStore.write === 'function') draftStore.write(store);
  }

  function getDraftEntry(path) {
    const norm = normalizeRelPath(path);
    if (!norm) return null;
    const store = readDraftStore();
    const entry = store[norm];
    if (!entry || typeof entry !== 'object') return null;
    const content = entry.content != null ? normalizeMarkdownContent(entry.content) : '';
    const savedAt = Number(entry.savedAt);
    const remoteSignature = entry.remoteSignature ? String(entry.remoteSignature) : '';
    const assets = Array.isArray(entry.assets)
      ? entry.assets.map(item => normalizeAssetDescriptor(item, norm)).filter(Boolean)
      : [];
    const deletedAssets = Array.isArray(entry.deletedAssets)
      ? entry.deletedAssets.map(item => normalizeAssetDeletionDescriptor(item, norm)).filter(Boolean)
      : [];
    return {
      path: norm,
      content,
      savedAt: Number.isFinite(savedAt) ? savedAt : now(),
      remoteSignature,
      assets,
      deletedAssets,
      encrypted: isEncryptedMarkdownDraftEntry(entry),
      protected: isEncryptedMarkdownDraftEntry(entry)
    };
  }

  function saveDraftEntry(path, content, remoteSignature = '', assets = [], saveOptions = {}) {
    const norm = normalizeRelPath(path);
    if (!norm) return null;
    const text = normalizeMarkdownContent(content);
    const store = readDraftStore();
    const savedAt = now();
    const existing = store[norm] && typeof store[norm] === 'object' ? store[norm] : {};
    const assetList = Array.isArray(assets)
      ? assets.map(item => normalizeAssetDescriptor(item, norm)).filter(Boolean)
      : [];
    const deletedAssetList = exportMarkdownAssetDeletionBucket(norm).length
      ? exportMarkdownAssetDeletionBucket(norm)
      : (Array.isArray(existing.deletedAssets)
        ? existing.deletedAssets.map(item => normalizeAssetDeletionDescriptor(item, norm)).filter(Boolean)
        : []);
    store[norm] = {
      content: text,
      savedAt,
      remoteSignature: String(remoteSignature || ''),
      assets: assetList
    };
    if (deletedAssetList.length) store[norm].deletedAssets = deletedAssetList;
    if (saveOptions && (saveOptions.encrypted === true || saveOptions.protected === true)) {
      store[norm].encrypted = true;
      store[norm].protected = true;
      store[norm].format = 'press-encrypted-markdown-v1';
    }
    writeDraftStore(store);
    return {
      path: norm,
      content: text,
      savedAt,
      remoteSignature: String(remoteSignature || ''),
      assets: assetList,
      deletedAssets: deletedAssetList,
      encrypted: !!(saveOptions && (saveOptions.encrypted === true || saveOptions.protected === true)),
      protected: !!(saveOptions && (saveOptions.encrypted === true || saveOptions.protected === true))
    };
  }

  function clearDraftEntry(path) {
    const norm = normalizeRelPath(path);
    if (!norm) return;
    if (draftStore && typeof draftStore.removeEntry === 'function') draftStore.removeEntry(norm);
    clearMarkdownAssetsForPath(norm);
  }

  function restoreDraftForTab(tab) {
    if (!tab || !tab.path) return false;
    try { clearTimeoutRef(tab.markdownDraftTimer); } catch (_) {}
    tab.markdownDraftTimer = null;
    const entry = getDraftEntry(tab.path);
    if (!entry) {
      tab.localDraft = null;
      tab.draftConflict = false;
      return false;
    }
    const assetsBucket = importMarkdownAssetsForPath(tab.path, entry.assets || []);
    importMarkdownAssetDeletionsForPath(tab.path, entry.deletedAssets || []);
    tab.localDraft = {
      content: entry.encrypted ? '' : entry.content,
      encryptedContent: entry.encrypted ? entry.content : '',
      encrypted: !!entry.encrypted,
      protected: !!entry.protected,
      decrypted: !entry.encrypted,
      savedAt: entry.savedAt,
      remoteSignature: entry.remoteSignature || '',
      manual: !!entry.manual,
      assets: exportMarkdownAssetBucket(tab.path),
      deletedAssets: exportMarkdownAssetDeletionBucket(tab.path)
    };
    if (entry.encrypted) {
      setMarkdownProtectionState(tab, {
        ...getMarkdownProtectionState(tab),
        enabled: true,
        encryptedDraft: true
      });
    } else {
      tab.content = entry.content;
    }
    tab.draftConflict = false;
    tab.isDirty = true;
    tab.pendingAssets = assetsBucket || ensureMarkdownAssetBucket(tab.path);
    if (entry.encrypted) {
      if (tab.button) {
        try { tab.button.setAttribute('data-dirty', '1'); } catch (_) {}
        try { tab.button.setAttribute('data-draft-state', 'saved'); } catch (_) {}
      }
      updateComposerMarkdownDraftIndicators({ path: tab.path });
      try { updateUnsyncedSummary(); } catch (_) {}
      return true;
    }
    updateDynamicTabDirtyState(tab, { autoSave: false });
    return true;
  }

  async function saveDraftForTab(tab, saveOptions = {}) {
    if (!tab || !tab.path) return null;
    const saveGeneration = getMarkdownDraftSaveGeneration(tab);
    const text = normalizeMarkdownContent(tab.content || '');
    const remoteSig = tab.remoteSignature || '';
    const deletedAssets = exportMarkdownAssetDeletionBucket(tab.path);
    if (!text && !deletedAssets.length) {
      bumpMarkdownDraftSaveGeneration(tab);
      clearDraftEntry(tab.path);
      tab.localDraft = null;
      tab.draftConflict = false;
      updateComposerMarkdownDraftIndicators({ path: tab.path });
      try { updateUnsyncedSummary(); } catch (_) {}
      return null;
    }
    const assets = exportMarkdownAssetBucket(tab.path);
    const prepared = await prepareMarkdownForProtectedStorage(tab, text, {
      reason: saveOptions && saveOptions.reason ? saveOptions.reason : 'draft'
    });
    if (saveGeneration !== getMarkdownDraftSaveGeneration(tab)) return null;
    const saved = saveDraftEntry(tab.path, prepared.content, remoteSig, assets, {
      encrypted: prepared.encrypted,
      protected: prepared.encrypted
    });
    if (saved) {
      tab.localDraft = {
        content: text,
        encryptedContent: saved.encrypted ? saved.content : '',
        encrypted: !!saved.encrypted,
        protected: !!saved.protected,
        decrypted: true,
        savedAt: saved.savedAt,
        remoteSignature: saved.remoteSignature,
        manual: !!saveOptions.markManual,
        assets: saved.assets || [],
        deletedAssets: saved.deletedAssets || []
      };
      updateComposerMarkdownDraftIndicators({ path: tab.path });
      try { updateUnsyncedSummary(); } catch (_) {}
    }
    return saved;
  }

  function clearDraftForTab(tab) {
    if (!tab || !tab.path) return;
    bumpMarkdownDraftSaveGeneration(tab);
    try {
      if (tab.markdownDraftTimer) {
        clearTimeoutRef(tab.markdownDraftTimer);
        tab.markdownDraftTimer = null;
      }
    } catch (_) {
      tab.markdownDraftTimer = null;
    }
    clearDraftEntry(tab.path);
    tab.localDraft = null;
    tab.draftConflict = false;
    tab.isDirty = false;
    tab.pendingAssets = ensureMarkdownAssetBucket(tab.path);
    if (tab.button) {
      try { tab.button.removeAttribute('data-dirty'); } catch (_) {}
      try { tab.button.removeAttribute('data-draft-state'); } catch (_) {}
    }
    updateComposerMarkdownDraftIndicators({ path: tab.path });
    try { updateUnsyncedSummary(); } catch (_) {}
  }

  function scheduleDraftSave(tab) {
    if (!tab) return;
    if (tab.markdownDraftTimer) {
      clearTimeoutRef(tab.markdownDraftTimer);
      tab.markdownDraftTimer = null;
    }
    tab.markdownDraftTimer = setTimeoutRef(() => {
      tab.markdownDraftTimer = null;
      if (!tab.isDirty) {
        clearDraftForTab(tab);
        return;
      }
      saveDraftForTab(tab)
        .then(() => {
          if (getCurrentMode() === tab.mode) pushEditorCurrentFileInfo(tab);
        })
        .catch((err) => {
          if (consoleRef && typeof consoleRef.error === 'function') consoleRef.error('Failed to save markdown draft', err);
          showToast('error', t('editor.composer.markdown.save.toastError'));
        });
    }, 720);
  }

  async function flushDraft(tab) {
    if (!tab) return null;
    if (tab.markdownDraftTimer) {
      clearTimeoutRef(tab.markdownDraftTimer);
      tab.markdownDraftTimer = null;
      if (tab.isDirty) return saveDraftForTab(tab);
    }
    return null;
  }

  function updateDynamicTabDirtyState(tab, dirtyOptions = {}) {
    if (!tab || !tab.path) return;
    const normalizedContent = normalizeMarkdownContent(tab.content || '');
    const baseline = normalizeMarkdownContent(tab.remoteContent || '');
    const protection = getMarkdownProtectionState(tab);
    const protectionChanged = protection.enabled !== protection.encryptedRemote || protection.passwordChanged;
    const assetDeletionDirty = countMarkdownAssetDeletions(tab.path) > 0;
    const dirty = normalizedContent !== baseline || protectionChanged || assetDeletionDirty;
    tab.isDirty = dirty;

    let conflict = false;
    if (dirty) {
      conflict = !!(tab.localDraft
        && tab.localDraft.remoteSignature
        && tab.remoteSignature
        && tab.localDraft.remoteSignature !== tab.remoteSignature);
      if (dirtyOptions.autoSave !== false) scheduleDraftSave(tab);
    } else {
      clearDraftForTab(tab);
    }
    tab.draftConflict = conflict;

    const btn = tab.button;
    if (btn) {
      if (dirty) btn.setAttribute('data-dirty', '1');
      else btn.removeAttribute('data-dirty');
      if (conflict) btn.setAttribute('data-draft-state', 'conflict');
      else if (tab.localDraft) btn.setAttribute('data-draft-state', 'saved');
      else btn.removeAttribute('data-draft-state');
    }

    if (getCurrentMode() === tab.mode) pushEditorCurrentFileInfo(tab);
    else updateMarkdownPushButton(tab);

    updateComposerMarkdownDraftIndicators({ path: tab.path });
    refreshEditorContentTree({ preserveStructure: getCurrentMode() === tab.mode });
    try { updateUnsyncedSummary(); } catch (_) {}
  }

  function hasUnsavedDrafts() {
    for (const tab of valuesFromCollection(getDynamicEditorTabs())) {
      if (!tab) continue;
      if (tab.isDirty) return true;
      if (hasMarkdownDraftContent(tab)) return true;
    }
    try {
      const store = readDraftStore();
      if (store && Object.keys(store).length) return true;
    } catch (_) {}
    return false;
  }

  function flushAllDrafts() {
    valuesFromCollection(getDynamicEditorTabs()).forEach(tab => { flushDraft(tab); });
  }

  function handleBeforeUnload(event) {
    try { flushAllDrafts(); } catch (_) {}
    void event;
  }

  function collectDraftStates() {
    const map = new Map();
    valuesFromCollection(getDynamicEditorTabs()).forEach(tab => {
      if (!tab || !tab.path) return;
      const norm = normalizeRelPath(tab.path);
      if (!norm) return;
      if (tab.draftConflict) map.set(norm, 'conflict');
      else if (tab.isDirty) map.set(norm, 'dirty');
      else if (tab.localDraft) map.set(norm, 'saved');
    });
    return map;
  }

  return {
    readDraftStore,
    writeDraftStore,
    getDraftEntry,
    saveDraftEntry,
    clearDraftEntry,
    restoreDraftForTab,
    saveDraftForTab,
    clearDraftForTab,
    scheduleDraftSave,
    flushDraft,
    updateDynamicTabDirtyState,
    hasUnsavedDrafts,
    handleBeforeUnload,
    collectDraftStates
  };
}
