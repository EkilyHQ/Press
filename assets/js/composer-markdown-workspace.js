function noop() {}

export function createComposerMarkdownWorkspaceController({
  getPrimaryEditorApi = () => null,
  getMarkdownSessionController,
  getMarkdownActionsUi,
  getMarkdownLoader,
  getCurrentMode = () => null,
  getTabsEntry = () => ({}),
  getEditorTreeFileNodeByPath = () => null,
  notifyComposerChange = noop,
  updateDynamicTabDirtyState = noop,
  inferMarkdownSourceFromPath = () => '',
  buildCurrentFileBreadcrumb = () => [],
  now = () => Date.now()
} = {}) {
  let detachPrimaryEditorListener = null;
  let detachPrimaryEditorTabsMetadataListener = null;

  const requireSessionController = () => {
    const controller = getMarkdownSessionController && getMarkdownSessionController();
    if (!controller) throw new Error('Markdown session controller is not initialized');
    return controller;
  };

  const requireActionsUi = () => {
    const ui = getMarkdownActionsUi && getMarkdownActionsUi();
    if (!ui) throw new Error('Markdown actions UI is not initialized');
    return ui;
  };

  const requireLoader = () => {
    const loader = getMarkdownLoader && getMarkdownLoader();
    if (!loader) throw new Error('Markdown loader is not initialized');
    return loader;
  };

  function restorePrimaryEditorMarkdownView(editorApi) {
    if (!editorApi) return;
    try {
      if (typeof editorApi.restorePersistedView === 'function') {
        editorApi.restorePersistedView();
        return;
      }
      if (typeof editorApi.setView === 'function') editorApi.setView('edit');
    } catch (_) {}
  }

  function getActiveDynamicTab() {
    return requireSessionController().getActiveDynamicTab();
  }

  function ensurePrimaryEditorListener() {
    if (detachPrimaryEditorListener) return;
    const api = getPrimaryEditorApi();
    if (!api || typeof api.onChange !== 'function') return;
    detachPrimaryEditorListener = api.onChange((value) => {
      const tab = getActiveDynamicTab();
      if (tab) {
        tab.content = value;
        updateDynamicTabDirtyState(tab);
      }
    });
  }

  function getTabsMetadataForPath(path) {
    const node = getEditorTreeFileNodeByPath(path);
    if (!node || node.source !== 'tabs' || !node.key || !node.lang) return { title: '' };
    const entry = getTabsEntry(node.key);
    const langEntry = entry && entry[node.lang] && typeof entry[node.lang] === 'object'
      ? entry[node.lang]
      : {};
    return { title: String(langEntry.title || '') };
  }

  function getTabsMetadataForTab(tab) {
    if (tab && tab.tabsKey && tab.tabsLang) {
      const entry = getTabsEntry(tab.tabsKey);
      const langEntry = entry && entry[tab.tabsLang] && typeof entry[tab.tabsLang] === 'object'
        ? entry[tab.tabsLang]
        : {};
      return { title: String(langEntry.title || '') };
    }
    return getTabsMetadataForPath(tab && tab.path ? tab.path : '');
  }

  function updateTabsEntryTitleFromPath(path, metadata) {
    const node = getEditorTreeFileNodeByPath(path);
    if (!node || node.source !== 'tabs' || !node.key || !node.lang) return false;
    const entry = getTabsEntry(node.key);
    entry[node.lang] = entry[node.lang] && typeof entry[node.lang] === 'object'
      ? entry[node.lang]
      : {};
    const nextTitle = metadata && typeof metadata === 'object'
      ? String(metadata.title || '')
      : '';
    if (String(entry[node.lang].title || '') === nextTitle) return false;
    entry[node.lang].title = nextTitle;
    notifyComposerChange('tabs');
    return true;
  }

  function updateTabsEntryTitleForTab(tab, metadata) {
    if (tab && tab.tabsKey && tab.tabsLang) {
      const entry = getTabsEntry(tab.tabsKey);
      entry[tab.tabsLang] = entry[tab.tabsLang] && typeof entry[tab.tabsLang] === 'object'
        ? entry[tab.tabsLang]
        : {};
      const nextTitle = metadata && typeof metadata === 'object'
        ? String(metadata.title || '')
        : '';
      if (String(entry[tab.tabsLang].title || '') === nextTitle) return false;
      entry[tab.tabsLang].title = nextTitle;
      notifyComposerChange('tabs');
      return true;
    }
    return updateTabsEntryTitleFromPath(tab && tab.path ? tab.path : '', metadata);
  }

  function ensurePrimaryEditorTabsMetadataListener() {
    if (detachPrimaryEditorTabsMetadataListener) return;
    const api = getPrimaryEditorApi();
    if (!api || typeof api.onTabsMetadataChange !== 'function') return;
    detachPrimaryEditorTabsMetadataListener = api.onTabsMetadataChange((metadata) => {
      const tab = getActiveDynamicTab();
      if (tab && tab.source === 'tabs') updateTabsEntryTitleForTab(tab, metadata);
    });
  }

  function detachPrimaryEditorListeners() {
    if (detachPrimaryEditorListener) {
      try { detachPrimaryEditorListener(); } catch (_) {}
      detachPrimaryEditorListener = null;
    }
    if (detachPrimaryEditorTabsMetadataListener) {
      try { detachPrimaryEditorTabsMetadataListener(); } catch (_) {}
      detachPrimaryEditorTabsMetadataListener = null;
    }
  }

  function getDynamicEditorTabs() {
    return requireSessionController().getTabs();
  }

  function getDynamicTabByMode(mode) {
    return requireSessionController().getTab(mode);
  }

  function isDynamicMode(mode) {
    return requireSessionController().isDynamicMode(mode);
  }

  function getFirstDynamicModeId() {
    return requireSessionController().getFirstDynamicModeId();
  }

  function activateDynamicMode(mode) {
    return requireSessionController().activateDynamicMode(mode);
  }

  function clearActiveDynamicMode(mode = null) {
    requireSessionController().clearActiveDynamicMode(mode);
  }

  function persistDynamicEditorState() {
    return requireSessionController().persistEditorState();
  }

  function restoreDynamicEditorState() {
    return requireSessionController().restoreEditorState();
  }

  function setTabLoadingState(tab, isLoading) {
    requireSessionController().setTabLoadingState(tab, isLoading);
  }

  function closeDynamicTab(modeId, options = {}) {
    return requireSessionController().closeDynamicTab(modeId, options);
  }

  function getOrCreateDynamicMode(path, options = {}) {
    return requireSessionController().getOrCreateDynamicMode(path, options);
  }

  function openMarkdownInEditor(path, options = {}) {
    return requireSessionController().openMarkdownInEditor(path, options);
  }

  function findDynamicTabByPath(path) {
    return requireSessionController().findTabByPath(path);
  }

  function updateMarkdownActionsForTab(tab) {
    updateMarkdownPushButton(tab);
    updateMarkdownDiscardButton(tab);
    updateMarkdownSaveButton(tab);
    updateMarkdownProtectionButton(tab);
  }

  const getMarkdownPushButton = () => requireActionsUi().getPushButton();
  const getMarkdownDiscardButton = () => requireActionsUi().getDiscardButton();
  const getMarkdownSaveButton = () => requireActionsUi().getSaveButton();
  const setMarkdownPushButton = (button) => requireActionsUi().setPushButton(button);
  const setMarkdownDiscardButton = (button) => requireActionsUi().setDiscardButton(button);
  const setMarkdownSaveButton = (button) => requireActionsUi().setSaveButton(button);
  const setMarkdownProtectionButton = (button) => requireActionsUi().setProtectionButton(button);
  const getMarkdownPushLabel = (kind) => requireActionsUi().getPushLabel(kind);
  const getMarkdownDiscardLabel = () => requireActionsUi().getDiscardLabel();
  const getMarkdownDiscardBusyLabel = () => requireActionsUi().getDiscardBusyLabel();
  const getMarkdownSaveLabel = () => requireActionsUi().getSaveLabel();
  const getMarkdownSaveBusyLabel = () => requireActionsUi().getSaveBusyLabel();
  const getMarkdownSaveTooltip = (kind) => requireActionsUi().getSaveTooltip(kind);
  const updateMarkdownPushButton = (tab) => requireActionsUi().updatePushButton(tab);
  const updateMarkdownDiscardButton = (tab) => requireActionsUi().updateDiscardButton(tab);
  const updateMarkdownSaveButton = (tab) => requireActionsUi().updateSaveButton(tab);
  const updateMarkdownProtectionButton = (tab) => requireActionsUi().updateProtectionButton(tab);

  function pushEditorCurrentFileInfo(tab) {
    const editorApi = getPrimaryEditorApi();
    if (!editorApi || typeof editorApi.setCurrentFileLabel !== 'function') return;
    const payload = tab
      ? {
          path: tab.path || '',
          source: tab.source || inferMarkdownSourceFromPath(tab.path),
          breadcrumb: buildCurrentFileBreadcrumb(tab),
          status: tab.fileStatus || null,
          dirty: !!tab.isDirty,
          loaded: !!tab.loaded,
          draft: tab.localDraft
            ? {
                savedAt: Number(tab.localDraft.savedAt) || now(),
                conflict: !!tab.draftConflict,
                hasContent: true,
                remoteSignature: tab.localDraft.remoteSignature || ''
              }
            : null
        }
      : { path: '', status: null, dirty: false, draft: null };
    try { editorApi.setCurrentFileLabel(payload); } catch (_) {}
    if (typeof editorApi.setTabsMetadata === 'function') {
      try {
        editorApi.setTabsMetadata(tab && tab.source === 'tabs' ? getTabsMetadataForTab(tab) : null, { silent: true });
      } catch (_) {}
    }
    const activeTab = (tab && tab.mode && tab.mode === getCurrentMode()) ? tab : getActiveDynamicTab();
    updateMarkdownActionsForTab(activeTab);
  }

  function setDynamicTabStatus(tab, status) {
    return requireLoader().setDynamicTabStatus(tab, status);
  }

  async function loadDynamicTabContent(tab) {
    return requireLoader().loadDynamicTabContent(tab);
  }

  return {
    getPrimaryEditorApi,
    restorePrimaryEditorMarkdownView,
    ensurePrimaryEditorListener,
    getTabsMetadataForPath,
    getTabsMetadataForTab,
    updateTabsEntryTitleFromPath,
    updateTabsEntryTitleForTab,
    ensurePrimaryEditorTabsMetadataListener,
    getDynamicEditorTabs,
    getDynamicTabByMode,
    isDynamicMode,
    getFirstDynamicModeId,
    getActiveDynamicTab,
    activateDynamicMode,
    clearActiveDynamicMode,
    persistDynamicEditorState,
    restoreDynamicEditorState,
    setTabLoadingState,
    detachPrimaryEditorListeners,
    updateMarkdownActionsForTab,
    getMarkdownPushButton,
    getMarkdownDiscardButton,
    getMarkdownSaveButton,
    setMarkdownPushButton,
    setMarkdownDiscardButton,
    setMarkdownSaveButton,
    setMarkdownProtectionButton,
    getMarkdownPushLabel,
    getMarkdownDiscardLabel,
    getMarkdownDiscardBusyLabel,
    getMarkdownSaveLabel,
    getMarkdownSaveBusyLabel,
    getMarkdownSaveTooltip,
    updateMarkdownPushButton,
    updateMarkdownDiscardButton,
    updateMarkdownSaveButton,
    updateMarkdownProtectionButton,
    pushEditorCurrentFileInfo,
    setDynamicTabStatus,
    closeDynamicTab,
    getOrCreateDynamicMode,
    loadDynamicTabContent,
    openMarkdownInEditor,
    findDynamicTabByPath
  };
}
