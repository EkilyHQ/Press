export function isComposerSystemMode(value) {
  return value === 'composer' || value === 'themes' || value === 'updates' || value === 'sync';
}

export function getComposerSystemModeNodeId(value) {
  if (value === 'themes') return 'system:themes';
  if (value === 'updates') return 'system:updates';
  if (value === 'sync') return 'system:sync';
  return 'system:site-settings';
}

export function createComposerModeController(options = {}) {
  const documentRef = options.documentRef || null;
  const getDynamicEditorTabs = typeof options.getDynamicEditorTabs === 'function' ? options.getDynamicEditorTabs : (() => new Map());
  const isDynamicMode = typeof options.isDynamicMode === 'function' ? options.isDynamicMode : (() => false);
  const getFirstDynamicModeId = typeof options.getFirstDynamicModeId === 'function' ? options.getFirstDynamicModeId : (() => '');
  const getActiveTreeNodeId = typeof options.getActiveTreeNodeId === 'function' ? options.getActiveTreeNodeId : (() => 'welcome');
  const setActiveTreeNodeId = typeof options.setActiveTreeNodeId === 'function' ? options.setActiveTreeNodeId : ((nodeId) => nodeId || 'welcome');
  const getEditorTreeNodeById = typeof options.getEditorTreeNodeById === 'function' ? options.getEditorTreeNodeById : (() => null);
  const expandEditorAncestors = typeof options.expandEditorAncestors === 'function' ? options.expandEditorAncestors : (() => {});
  const selectEditorTreeNodeForTab = typeof options.selectEditorTreeNodeForTab === 'function' ? options.selectEditorTreeNodeForTab : (() => {});
  const getPrimaryEditorApi = typeof options.getPrimaryEditorApi === 'function' ? options.getPrimaryEditorApi : (() => null);
  const restorePrimaryEditorMarkdownView = typeof options.restorePrimaryEditorMarkdownView === 'function' ? options.restorePrimaryEditorMarkdownView : (() => {});
  const ensurePrimaryEditorListener = typeof options.ensurePrimaryEditorListener === 'function' ? options.ensurePrimaryEditorListener : (() => {});
  const ensurePrimaryEditorTabsMetadataListener = typeof options.ensurePrimaryEditorTabsMetadataListener === 'function' ? options.ensurePrimaryEditorTabsMetadataListener : (() => {});
  const getDynamicTabByMode = typeof options.getDynamicTabByMode === 'function' ? options.getDynamicTabByMode : (() => null);
  const activateDynamicMode = typeof options.activateDynamicMode === 'function' ? options.activateDynamicMode : (() => null);
  const clearActiveDynamicMode = typeof options.clearActiveDynamicMode === 'function' ? options.clearActiveDynamicMode : (() => {});
  const setEditorDetailPanelMode = typeof options.setEditorDetailPanelMode === 'function' ? options.setEditorDetailPanelMode : (() => {});
  const pushEditorCurrentFileInfo = typeof options.pushEditorCurrentFileInfo === 'function' ? options.pushEditorCurrentFileInfo : (() => {});
  const refreshEditorContentTree = typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : (() => {});
  const captureEditorContentScroll = typeof options.captureEditorContentScroll === 'function' ? options.captureEditorContentScroll : (() => {});
  const restoreEditorContentScrollForMode = typeof options.restoreEditorContentScrollForMode === 'function' ? options.restoreEditorContentScrollForMode : (() => {});
  const scrollEditorContentToTop = typeof options.scrollEditorContentToTop === 'function' ? options.scrollEditorContentToTop : (() => {});
  const scheduleEditorStatePersist = typeof options.scheduleEditorStatePersist === 'function' ? options.scheduleEditorStatePersist : (() => {});
  const persistDynamicEditorState = typeof options.persistDynamicEditorState === 'function' ? options.persistDynamicEditorState : (() => {});
  const computeBaseDirForPath = typeof options.computeBaseDirForPath === 'function' ? options.computeBaseDirForPath : (() => '');
  const animateEditorMarkdownPanelContent = typeof options.animateEditorMarkdownPanelContent === 'function' ? options.animateEditorMarkdownPanelContent : (() => {});
  const updateDynamicTabDirtyState = typeof options.updateDynamicTabDirtyState === 'function' ? options.updateDynamicTabDirtyState : (() => {});
  const setTabLoadingState = typeof options.setTabLoadingState === 'function' ? options.setTabLoadingState : (() => {});
  const loadDynamicTabContent = typeof options.loadDynamicTabContent === 'function' ? options.loadDynamicTabContent : (() => Promise.resolve(''));
  const alertRef = typeof options.alertRef === 'function' ? options.alertRef : (() => {});
  const consoleRef = options.consoleRef || null;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function'
    ? options.requestAnimationFrameRef
    : (handler) => {
      if (typeof handler === 'function') handler();
      return 0;
    };

  let currentMode = options.initialMode || null;

  function getCurrentMode() {
    return currentMode;
  }

  function query(selector) {
    try { return documentRef ? documentRef.querySelector(selector) : null; }
    catch (_) { return null; }
  }

  function queryAll(selector) {
    try { return documentRef ? Array.from(documentRef.querySelectorAll(selector)) : []; }
    catch (_) { return []; }
  }

  function requestFrame(handler) {
    try {
      requestAnimationFrameRef(handler);
    } catch (_) {}
  }

  function scheduleEditorLayoutRefresh(editorApi, nextMode) {
    if (!editorApi || typeof editorApi.requestLayout !== 'function') return;
    requestFrame(() => {
      if (currentMode !== nextMode) return;
      try { editorApi.requestLayout(); } catch (_) {}
    });
  }

  function setEditorModeLayoutState(nextMode) {
    const showEditor = nextMode === 'editor' || isComposerSystemMode(nextMode) || isDynamicMode(nextMode);
    try {
      const layout = query('#mode-editor');
      if (layout) {
        layout.style.display = showEditor ? '' : 'none';
        layout.classList.toggle('is-dynamic', isDynamicMode(nextMode));
      }
    } catch (_) {}
    return showEditor;
  }

  function updateModeTabSelection(nextMode) {
    const isDynamic = isDynamicMode(nextMode);
    queryAll('.mode-tab').forEach((button) => {
      const baseMode = button && button.dataset ? button.dataset.mode : '';
      if (isComposerSystemMode(baseMode)) {
        const active = nextMode === baseMode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
        return;
      }
      const targetMode = button.classList.contains('dynamic-mode')
        ? nextMode
        : (isDynamic ? 'editor' : nextMode);
      const active = button.dataset && button.dataset.mode === targetMode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function setSystemDetailMode(nextMode, optionsForMode = {}) {
    clearActiveDynamicMode();
    const activeSystemNodeId = setActiveTreeNodeId(getComposerSystemModeNodeId(nextMode));
    if (!optionsForMode.preserveTreeExpansion) {
      expandEditorAncestors(getEditorTreeNodeById(activeSystemNodeId) || { id: activeSystemNodeId, source: 'system' });
    }
    setEditorDetailPanelMode(nextMode);
    pushEditorCurrentFileInfo(null);
    refreshEditorContentTree({ preserveStructure: true });
    if (optionsForMode.restoreScroll) restoreEditorContentScrollForMode(nextMode);
  }

  function refreshCurrentMode(nextMode, optionsForMode = {}) {
    try {
      const layout = query('#mode-editor');
      if (layout) layout.classList.toggle('is-dynamic', isDynamicMode(nextMode));
    } catch (_) {}
    if (nextMode === 'editor' && optionsForMode.forceStructure) {
      clearActiveDynamicMode();
      setEditorDetailPanelMode('structure');
      pushEditorCurrentFileInfo(null);
      refreshEditorContentTree();
      if (optionsForMode.restoreScroll) restoreEditorContentScrollForMode(nextMode);
    } else if (isComposerSystemMode(nextMode)) {
      setSystemDetailMode(nextMode, optionsForMode);
    } else if (isDynamicMode(nextMode)) {
      const tab = activateDynamicMode(nextMode);
      if (tab) {
        try { selectEditorTreeNodeForTab(tab, { expandAncestors: !optionsForMode.preserveTreeExpansion }); } catch (_) {}
      }
      setEditorDetailPanelMode('markdown');
      if (optionsForMode.restoreScroll) restoreEditorContentScrollForMode(nextMode);
    }
    scheduleEditorStatePersist();
  }

  function applyDynamicMode(nextMode, optionsForMode, editorApi) {
    const tab = activateDynamicMode(nextMode);
    ensurePrimaryEditorListener();
    ensurePrimaryEditorTabsMetadataListener();
    setEditorDetailPanelMode('markdown');
    if (!tab || !editorApi) return;
    try { selectEditorTreeNodeForTab(tab, { expandAncestors: !optionsForMode.preserveTreeExpansion }); } catch (_) {}
    restorePrimaryEditorMarkdownView(editorApi);
    try {
      const baseDir = computeBaseDirForPath(tab.path);
      tab.baseDir = baseDir;
      editorApi.setBaseDir(baseDir);
    } catch (_) {}
    pushEditorCurrentFileInfo(tab);
    animateEditorMarkdownPanelContent();

    const applyContent = (text) => {
      tab.content = String(text || '');
      if (currentMode === nextMode) {
        editorApi.setValue(tab.content, { notify: false });
        scheduleEditorLayoutRefresh(editorApi, nextMode);
        try { editorApi.focus(); } catch (_) {}
        if (optionsForMode.restoreScroll) restoreEditorContentScrollForMode(nextMode);
        else scrollEditorContentToTop('smooth');
        updateDynamicTabDirtyState(tab, { autoSave: false });
      }
    };

    if (tab.loaded || (tab.localDraft && tab.localDraft.content)) {
      applyContent(tab.content);
      return;
    }

    setTabLoadingState(tab, true);
    Promise.resolve(loadDynamicTabContent(tab)).then((text) => {
      setTabLoadingState(tab, false);
      if (currentMode !== nextMode) return;
      applyContent(text);
    }).catch((err) => {
      setTabLoadingState(tab, false);
      if (currentMode === nextMode) {
        try { consoleRef.error('Composer editor: failed to load markdown', err); } catch (_) {}
        const message = (tab.fileStatus && tab.fileStatus.message)
          ? tab.fileStatus.message
          : (err && err.message) ? err.message : 'Unknown error';
        alertRef(`Failed to load file\n${tab.path}\n${message}`);
      }
    });
  }

  function applyEditorStructureMode(nextMode, optionsForMode, editorApi) {
    clearActiveDynamicMode();
    setEditorDetailPanelMode('structure');
    if (editorApi) {
      try { editorApi.setView('edit'); } catch (_) {}
      scheduleEditorLayoutRefresh(editorApi, nextMode);
    }
    pushEditorCurrentFileInfo(null);
    refreshEditorContentTree();
    if (optionsForMode.restoreScroll) restoreEditorContentScrollForMode(nextMode);
  }

  function applyFallbackStructureMode(nextMode, optionsForMode) {
    clearActiveDynamicMode();
    setEditorDetailPanelMode('structure');
    pushEditorCurrentFileInfo(null);
    if (optionsForMode.restoreScroll) restoreEditorContentScrollForMode(nextMode);
  }

  function normalizeMode(candidate) {
    if (candidate === 'editor' || isComposerSystemMode(candidate) || isDynamicMode(candidate)) {
      return candidate;
    }
    return 'editor';
  }

  function applyMode(mode, optionsForMode = {}) {
    if (mode === 'editor' && getDynamicEditorTabs().size && !optionsForMode.forceStructure && getActiveTreeNodeId() !== 'welcome') {
      const firstDynamicMode = getFirstDynamicModeId();
      if (firstDynamicMode) {
        applyMode(firstDynamicMode, optionsForMode);
        return;
      }
    }

    const nextMode = normalizeMode(mode || 'editor');
    const previousMode = currentMode;
    if (previousMode === nextMode) {
      refreshCurrentMode(nextMode, optionsForMode);
      return;
    }

    if (previousMode) captureEditorContentScroll(previousMode);

    const editorApi = getPrimaryEditorApi();
    if (previousMode && isDynamicMode(previousMode) && editorApi && typeof editorApi.getValue === 'function') {
      const prevTab = getDynamicTabByMode(previousMode);
      if (prevTab) {
        try {
          prevTab.content = String(editorApi.getValue() || '');
        } catch (_) {}
      }
    }

    currentMode = nextMode;
    const showEditor = setEditorModeLayoutState(nextMode);
    updateModeTabSelection(nextMode);
    if (showEditor) scheduleEditorLayoutRefresh(editorApi, nextMode);

    if (isDynamicMode(nextMode)) {
      applyDynamicMode(nextMode, optionsForMode, editorApi);
    } else if (nextMode === 'editor') {
      applyEditorStructureMode(nextMode, optionsForMode, editorApi);
    } else if (isComposerSystemMode(nextMode)) {
      setSystemDetailMode(nextMode, optionsForMode);
      if (!optionsForMode.restoreScroll) scrollEditorContentToTop('smooth');
    } else {
      applyFallbackStructureMode(nextMode, optionsForMode);
    }

    try {
      if (documentRef && documentRef.documentElement) documentRef.documentElement.removeAttribute('data-init-mode');
    } catch (_) {}

    persistDynamicEditorState();
  }

  return {
    getCurrentMode,
    applyMode,
    isSystemMode: isComposerSystemMode,
    getSystemModeNodeId: getComposerSystemModeNodeId
  };
}
