const noop = () => {};

function valuesFromMap(map) {
  if (!map || typeof map.values !== 'function') return [];
  try { return Array.from(map.values()); }
  catch (_) { return []; }
}

function normalizeSystemMode(mode) {
  const value = String(mode || '').trim();
  return value === 'composer' || value === 'themes' || value === 'updates' || value === 'sync'
    ? value
    : '';
}

export function createComposerMarkdownSessionController(options = {}) {
  const editorStateVersion = Number(options.editorStateVersion) || 1;
  const editorSessionStateStore = options.editorSessionStateStore || null;
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : (value) => String(value || '').replace(/[\\]/g, '/').replace(/^\/+/, '');
  const normalizeLangCode = typeof options.normalizeLangCode === 'function' ? options.normalizeLangCode : (value) => String(value || '').trim().toLowerCase();
  const inferMarkdownSourceFromPath = typeof options.inferMarkdownSourceFromPath === 'function' ? options.inferMarkdownSourceFromPath : () => '';
  const basenameFromPath = typeof options.basenameFromPath === 'function' ? options.basenameFromPath : (value) => String(value || '').split('/').filter(Boolean).pop() || '';
  const computeBaseDirForPath = typeof options.computeBaseDirForPath === 'function' ? options.computeBaseDirForPath : () => '';
  const createMarkdownProtectionState = typeof options.createMarkdownProtectionState === 'function' ? options.createMarkdownProtectionState : () => ({});
  const ensureMarkdownAssetBucket = typeof options.ensureMarkdownAssetBucket === 'function' ? options.ensureMarkdownAssetBucket : () => null;
  const restoreMarkdownDraftForTab = typeof options.restoreMarkdownDraftForTab === 'function' ? options.restoreMarkdownDraftForTab : noop;
  const loadDynamicTabContent = typeof options.loadDynamicTabContent === 'function' ? options.loadDynamicTabContent : async () => '';
  const flushMarkdownDraft = typeof options.flushMarkdownDraft === 'function' ? options.flushMarkdownDraft : noop;
  const clearMarkdownDraftForTab = typeof options.clearMarkdownDraftForTab === 'function' ? options.clearMarkdownDraftForTab : noop;
  const hasMarkdownDraftContent = typeof options.hasMarkdownDraftContent === 'function' ? options.hasMarkdownDraftContent : () => false;
  const getAllowEditorStatePersist = typeof options.getAllowEditorStatePersist === 'function' ? options.getAllowEditorStatePersist : () => true;
  const getCurrentMode = typeof options.getCurrentMode === 'function' ? options.getCurrentMode : () => null;
  const captureEditorContentScroll = typeof options.captureEditorContentScroll === 'function' ? options.captureEditorContentScroll : noop;
  const getActiveNodeId = typeof options.getActiveNodeId === 'function' ? options.getActiveNodeId : () => '';
  const getExpandedNodeIdsSnapshot = typeof options.getExpandedNodeIdsSnapshot === 'function' ? options.getExpandedNodeIdsSnapshot : () => [];
  const getEditorRailScrollTop = typeof options.getEditorRailScrollTop === 'function' ? options.getEditorRailScrollTop : () => 0;
  const getEditorContentScrollSnapshot = typeof options.getEditorContentScrollSnapshot === 'function' ? options.getEditorContentScrollSnapshot : () => ({});
  const setEditorContentScrollByKey = typeof options.setEditorContentScrollByKey === 'function' ? options.setEditorContentScrollByKey : noop;
  const restoreExpandedNodeIds = typeof options.restoreExpandedNodeIds === 'function' ? options.restoreExpandedNodeIds : noop;
  const setActiveNodeIdIfExists = typeof options.setActiveNodeIdIfExists === 'function' ? options.setActiveNodeIdIfExists : noop;
  const setEditorRailScrollTop = typeof options.setEditorRailScrollTop === 'function' ? options.setEditorRailScrollTop : noop;
  const restoreEditorContentScrollForMode = typeof options.restoreEditorContentScrollForMode === 'function' ? options.restoreEditorContentScrollForMode : noop;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function' ? options.requestAnimationFrameRef : (fn) => setTimeout(fn, 0);
  const applyMode = typeof options.applyMode === 'function' ? options.applyMode : noop;
  const selectEditorTreeNodeByPath = typeof options.selectEditorTreeNodeByPath === 'function' ? options.selectEditorTreeNodeByPath : noop;
  const showComposerDiscardConfirm = typeof options.showComposerDiscardConfirm === 'function' ? options.showComposerDiscardConfirm : null;
  const t = typeof options.t === 'function' ? options.t : (key, params) => {
    if (params && params.label) return `${key}: ${params.label}`;
    return String(key || '');
  };
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const alertRef = typeof options.alertRef === 'function' ? options.alertRef : (message) => {
    if (windowRef && typeof windowRef.alert === 'function') windowRef.alert(message);
  };
  const consoleRef = options.consoleRef || console;
  const updateDynamicTabsGroupState = typeof options.updateDynamicTabsGroupState === 'function' ? options.updateDynamicTabsGroupState : noop;
  const detachPrimaryEditorListeners = typeof options.detachPrimaryEditorListeners === 'function' ? options.detachPrimaryEditorListeners : noop;
  const persistDynamicEditorStateFallback = typeof options.persistDynamicEditorStateFallback === 'function' ? options.persistDynamicEditorStateFallback : null;
  const updateMarkdownActionsForTab = typeof options.updateMarkdownActionsForTab === 'function' ? options.updateMarkdownActionsForTab : noop;
  const updateComposerMarkdownDraftIndicators = typeof options.updateComposerMarkdownDraftIndicators === 'function' ? options.updateComposerMarkdownDraftIndicators : noop;

  const tabs = new Map();
  const tabsByLookupKey = new Map();
  let tabCounter = 0;
  let activeDynamicMode = null;
  let activeMarkdownDocument = null;

  function getTabs() {
    return tabs;
  }

  function getTab(modeId) {
    return tabs.get(modeId) || null;
  }

  function isDynamicMode(mode) {
    return !!(mode && tabs.has(mode));
  }

  function getFirstDynamicModeId() {
    try {
      const first = tabs.keys().next();
      return first && !first.done ? first.value : null;
    } catch (_) {
      return null;
    }
  }

  function getActiveDynamicMode() {
    return activeDynamicMode;
  }

  function getActiveDynamicTab() {
    if (activeMarkdownDocument && activeMarkdownDocument.mode === activeDynamicMode) return activeMarkdownDocument;
    if (!activeDynamicMode) return null;
    return tabs.get(activeDynamicMode) || null;
  }

  function activateDynamicMode(mode) {
    activeDynamicMode = isDynamicMode(mode) ? mode : null;
    activeMarkdownDocument = activeDynamicMode ? (tabs.get(activeDynamicMode) || null) : null;
    return activeMarkdownDocument;
  }

  function clearActiveDynamicMode(mode = null) {
    if (mode && activeDynamicMode !== mode) return;
    activeDynamicMode = null;
    activeMarkdownDocument = null;
  }

  function deriveDynamicTabIdentity(path, identityOptions = {}) {
    const normalizedPath = normalizeRelPath(path);
    const opts = identityOptions && typeof identityOptions === 'object' ? identityOptions : {};
    const node = opts.node && typeof opts.node === 'object' ? opts.node : null;
    const explicitLookupKey = String(opts.lookupKey || '').trim();
    const lookupKeyParts = explicitLookupKey.startsWith('tabs:') ? explicitLookupKey.split(':') : null;
    const source = String(
      opts.source
      || (node && node.source)
      || (lookupKeyParts && lookupKeyParts.length >= 3 ? 'tabs' : '')
      || inferMarkdownSourceFromPath(normalizedPath)
      || ''
    ).trim().toLowerCase();
    const key = String(
      opts.key
      || (node && node.key)
      || (lookupKeyParts && lookupKeyParts.length >= 3 ? lookupKeyParts.slice(1, -1).join(':') : '')
      || ''
    ).trim();
    const lang = normalizeLangCode(
      opts.lang
      || (node && node.lang)
      || (lookupKeyParts && lookupKeyParts.length >= 3 ? lookupKeyParts[lookupKeyParts.length - 1] : '')
    );
    const editorTreeNodeId = String(opts.editorTreeNodeId || opts.nodeId || (node && node.id) || '').trim();
    const lookupKey = explicitLookupKey || ((source === 'tabs' && key && lang)
      ? `tabs:${key}:${lang}`
      : normalizedPath);
    return {
      path: normalizedPath,
      source,
      key,
      lang,
      editorTreeNodeId,
      lookupKey
    };
  }

  function persistEditorState() {
    if (!getAllowEditorStatePersist()) return false;
    try {
      captureEditorContentScroll(getCurrentMode());
      const open = valuesFromMap(tabs)
        .map((tab) => {
          if (!tab || !tab.path) return null;
          return {
            lookupKey: tab.lookupKey || tab.path,
            path: tab.path,
            source: tab.source || '',
            key: tab.tabsKey || '',
            lang: tab.tabsLang || '',
            editorTreeNodeId: tab.editorTreeNodeId || ''
          };
        })
        .filter(Boolean);
      const currentMode = getCurrentMode();
      const active = currentMode && isDynamicMode(currentMode) ? tabs.get(currentMode) : null;
      const systemMode = normalizeSystemMode(currentMode) || 'structure';
      const state = {
        v: editorStateVersion,
        mode: active ? 'markdown' : systemMode,
        activeNodeId: getActiveNodeId() || 'welcome',
        activeLookupKey: active && (active.lookupKey || active.path) ? (active.lookupKey || active.path) : null,
        activePath: active && active.path ? active.path : null,
        open,
        expandedNodeIds: getExpandedNodeIdsSnapshot(),
        railScrollTop: getEditorRailScrollTop(),
        contentScrollByKey: getEditorContentScrollSnapshot(),
        updatedAt: Date.now()
      };
      if (editorSessionStateStore && typeof editorSessionStateStore.writeEditorState === 'function') {
        editorSessionStateStore.writeEditorState(state);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function restoreEditorState() {
    const data = editorSessionStateStore && typeof editorSessionStateStore.readEditorState === 'function'
      ? editorSessionStateStore.readEditorState()
      : null;
    if (!data || typeof data !== 'object') return false;

    const isV3 = data.v === editorStateVersion;
    setEditorContentScrollByKey(data.contentScrollByKey);

    const open = Array.isArray(data.open) ? data.open : [];
    const seen = new Set();
    open.forEach((item) => {
      const lookupKey = item && typeof item === 'object'
        ? String(item.lookupKey || '').trim()
        : '';
      const path = item && typeof item === 'object'
        ? normalizeRelPath(item.path)
        : normalizeRelPath(item);
      const seenKey = lookupKey || path;
      if (!path || !seenKey || seen.has(seenKey)) return;
      seen.add(seenKey);
      getOrCreateDynamicMode(path, {
        source: item && typeof item === 'object' ? item.source : '',
        key: item && typeof item === 'object' ? item.key : '',
        lang: item && typeof item === 'object' ? item.lang : '',
        editorTreeNodeId: item && typeof item === 'object' ? item.editorTreeNodeId : '',
        lookupKey
      });
    });

    if (isV3 && Array.isArray(data.expandedNodeIds)) {
      restoreExpandedNodeIds(data.expandedNodeIds);
    }

    const restoredNodeId = isV3 ? String(data.activeNodeId || '').trim() : '';
    if (restoredNodeId) setActiveNodeIdIfExists(restoredNodeId);

    const finishRestore = (mode) => {
      try {
        setEditorRailScrollTop(data.railScrollTop || 0);
        restoreEditorContentScrollForMode(mode || getCurrentMode());
        requestAnimationFrameRef(() => setEditorRailScrollTop(data.railScrollTop || 0));
      } catch (_) {}
      return true;
    };

    const activeLookupKey = String(data.activeLookupKey || '').trim();
    const activePath = data.activePath ? normalizeRelPath(data.activePath) : '';
    if ((isV3 ? data.mode === 'markdown' : true) && (activeLookupKey || activePath)) {
      const modeId = (activeLookupKey && tabsByLookupKey.get(activeLookupKey))
        || (activePath && tabsByLookupKey.get(activePath))
        || (activePath ? getOrCreateDynamicMode(activePath) : null);
      if (modeId) {
        applyMode(modeId, { preserveTreeExpansion: true, restoreScroll: true });
        return finishRestore(modeId);
      }
    }

    const restoredSystemMode = isV3 ? normalizeSystemMode(data.mode) : '';
    if (restoredSystemMode) {
      applyMode(restoredSystemMode, { preserveTreeExpansion: true, restoreScroll: true });
      return finishRestore(restoredSystemMode);
    }

    applyMode('editor', { forceStructure: true, preserveTreeExpansion: true, restoreScroll: true });
    return finishRestore('editor');
  }

  function setTabLoadingState(tab, isLoading) {
    if (!tab || !tab.button) return;
    try {
      tab.button.classList.toggle('is-busy', !!isLoading);
      if (isLoading) tab.button.setAttribute('data-loading', '1');
      else tab.button.removeAttribute('data-loading');
      tab.button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    } catch (_) {}
  }

  async function closeDynamicTab(modeId, closeOptions = {}) {
    const tab = tabs.get(modeId);
    if (!tab) return false;

    const opts = closeOptions && typeof closeOptions === 'object' ? closeOptions : {};
    const hasLocalDraft = hasMarkdownDraftContent(tab);
    const hasDirty = !!tab.isDirty;

    const resolveAnchor = (candidate) => {
      if (!candidate) return null;
      if (typeof candidate.getBoundingClientRect === 'function') return candidate;
      if (typeof candidate.closest === 'function') {
        const btnEl = candidate.closest('button');
        if (btnEl && typeof btnEl.getBoundingClientRect === 'function') return btnEl;
      }
      return null;
    };

    let anchorEl = resolveAnchor(opts.anchor);
    if (!anchorEl && tab.button && typeof tab.button.getBoundingClientRect === 'function') {
      anchorEl = tab.button;
    }

    if (!opts.force && (hasDirty || hasLocalDraft)) {
      const ref = tab.path || tab.label || t('editor.composer.discardConfirm.closeTabFallback');
      const promptMessage = t('editor.composer.discardConfirm.closeTabMessage', { label: ref });
      let proceed = true;
      const runNativeConfirm = () => {
        try {
          if (windowRef && typeof windowRef.confirm === 'function') return windowRef.confirm(promptMessage);
        } catch (_) {
          return true;
        }
        return true;
      };

      if (anchorEl && showComposerDiscardConfirm) {
        try {
          proceed = await showComposerDiscardConfirm(anchorEl, promptMessage, {
            confirmLabel: t('editor.composer.discardConfirm.discard'),
            cancelLabel: t('editor.composer.dialogs.cancel')
          });
        } catch (err) {
          if (consoleRef && typeof consoleRef.warn === 'function') {
            consoleRef.warn('Markdown tab close prompt failed, falling back to native confirm', err);
          }
          proceed = runNativeConfirm();
        }
      } else {
        proceed = runNativeConfirm();
      }

      if (!proceed) return false;
    }

    clearMarkdownDraftForTab(tab);
    tabs.delete(modeId);
    if (tab.lookupKey) tabsByLookupKey.delete(tab.lookupKey);
    try { tab.button?.remove(); } catch (_) {}
    updateDynamicTabsGroupState();

    const wasActive = getCurrentMode() === modeId;
    clearActiveDynamicMode(modeId);

    if (!tabs.size) detachPrimaryEditorListeners();

    if (wasActive) {
      const remainingModes = Array.from(tabs.keys());
      const fallbackMode = remainingModes.length ? remainingModes[remainingModes.length - 1] : 'editor';
      applyMode(fallbackMode);
    } else {
      persistEditorState();
    }
    updateMarkdownActionsForTab(getActiveDynamicTab());
    updateComposerMarkdownDraftIndicators({ path: tab.path });
    return true;
  }

  function getOrCreateDynamicMode(path, tabOptions = {}) {
    const identity = deriveDynamicTabIdentity(path, tabOptions);
    const normalized = identity.path;
    if (!normalized) return null;
    const existing = tabsByLookupKey.get(identity.lookupKey);
    if (existing) return existing;

    tabCounter += 1;
    const modeId = `editor-tab-${tabCounter}`;
    const label = basenameFromPath(normalized) || normalized;
    const data = {
      mode: modeId,
      path: normalized,
      source: identity.source,
      tabsKey: identity.key || '',
      tabsLang: identity.lang || '',
      editorTreeNodeId: identity.editorTreeNodeId || '',
      lookupKey: identity.lookupKey,
      button: null,
      label,
      baseDir: computeBaseDirForPath(normalized),
      content: '',
      remoteContent: '',
      remoteSignature: '',
      loaded: false,
      pending: null,
      fileStatus: null,
      localDraft: null,
      draftConflict: false,
      markdownDraftTimer: null,
      markdownDraftSaveGeneration: 0,
      isDirty: false,
      protection: createMarkdownProtectionState(),
      pendingAssets: ensureMarkdownAssetBucket(normalized)
    };
    restoreMarkdownDraftForTab(data);
    tabs.set(modeId, data);
    tabsByLookupKey.set(identity.lookupKey, modeId);
    loadDynamicTabContent(data).catch(() => {});
    persistEditorState();
    return modeId;
  }

  function openMarkdownInEditor(path, openOptions = {}) {
    const active = getActiveDynamicTab();
    if (active && active.path && normalizeRelPath(active.path) !== normalizeRelPath(path)) {
      try { flushMarkdownDraft(active); } catch (_) {}
    }
    const modeId = getOrCreateDynamicMode(path, openOptions);
    if (!modeId) {
      alertRef('Unable to open editor tab.');
      return null;
    }
    applyMode(modeId);
    try { selectEditorTreeNodeByPath(path); } catch (_) {}
    return modeId;
  }

  function findTabByPath(path) {
    const normalized = normalizeRelPath(path);
    if (!normalized) return null;
    for (const tab of tabs.values()) {
      if (tab && normalizeRelPath(tab.path) === normalized) return tab;
    }
    return null;
  }

  function collectFileStatusMap() {
    const map = new Map();
    try {
      tabs.forEach((tab) => {
        if (!tab || !tab.path || !tab.fileStatus) return;
        const state = tab.fileStatus.state || '';
        if (state) map.set(normalizeRelPath(tab.path), state);
      });
    } catch (_) {}
    return map;
  }

  return {
    getTabs,
    getTab,
    isDynamicMode,
    getFirstDynamicModeId,
    getActiveDynamicMode,
    getActiveDynamicTab,
    activateDynamicMode,
    clearActiveDynamicMode,
    deriveDynamicTabIdentity,
    persistEditorState,
    restoreEditorState,
    setTabLoadingState,
    closeDynamicTab,
    getOrCreateDynamicMode,
    openMarkdownInEditor,
    findTabByPath,
    collectFileStatusMap
  };
}
