export function createComposerMarkdownWorkspaceFacade(options = {}) {
  const getController =
    typeof options.getController === 'function' ? options.getController : () => options.controller || null;

  function getMarkdownWorkspaceController() {
    const controller = getController();
    if (!controller) throw new Error('Markdown workspace controller is not initialized');
    return controller;
  }

  return {
    getPrimaryEditorApi: () => getMarkdownWorkspaceController().getPrimaryEditorApi(),
    restorePrimaryEditorMarkdownView: (editorApi) =>
      getMarkdownWorkspaceController().restorePrimaryEditorMarkdownView(editorApi),
    ensurePrimaryEditorListener: () => getMarkdownWorkspaceController().ensurePrimaryEditorListener(),
    ensurePrimaryEditorTabsMetadataListener: () =>
      getMarkdownWorkspaceController().ensurePrimaryEditorTabsMetadataListener(),
    getDynamicEditorTabs: () => getMarkdownWorkspaceController().getDynamicEditorTabs(),
    getDynamicTabByMode: (mode) => getMarkdownWorkspaceController().getDynamicTabByMode(mode),
    isDynamicMode: (mode) => getMarkdownWorkspaceController().isDynamicMode(mode),
    getFirstDynamicModeId: () => getMarkdownWorkspaceController().getFirstDynamicModeId(),
    getActiveDynamicTab: () => getMarkdownWorkspaceController().getActiveDynamicTab(),
    activateDynamicMode: (mode) => getMarkdownWorkspaceController().activateDynamicMode(mode),
    clearActiveDynamicMode: (mode = null) => getMarkdownWorkspaceController().clearActiveDynamicMode(mode),
    persistDynamicEditorState: () => getMarkdownWorkspaceController().persistDynamicEditorState(),
    restoreDynamicEditorState: () => getMarkdownWorkspaceController().restoreDynamicEditorState(),
    setTabLoadingState: (tab, isLoading) => getMarkdownWorkspaceController().setTabLoadingState(tab, isLoading),
    detachPrimaryEditorListeners: () => getMarkdownWorkspaceController().detachPrimaryEditorListeners(),
    updateMarkdownActionsForTab: (tab) => getMarkdownWorkspaceController().updateMarkdownActionsForTab(tab),
    getMarkdownPushButton: () => getMarkdownWorkspaceController().getMarkdownPushButton(),
    getMarkdownDiscardButton: () => getMarkdownWorkspaceController().getMarkdownDiscardButton(),
    getMarkdownSaveButton: () => getMarkdownWorkspaceController().getMarkdownSaveButton(),
    setMarkdownPushButton: (button) => getMarkdownWorkspaceController().setMarkdownPushButton(button),
    setMarkdownDiscardButton: (button) => getMarkdownWorkspaceController().setMarkdownDiscardButton(button),
    setMarkdownSaveButton: (button) => getMarkdownWorkspaceController().setMarkdownSaveButton(button),
    setMarkdownProtectionButton: (button) => getMarkdownWorkspaceController().setMarkdownProtectionButton(button),
    getMarkdownPushLabel: (kind) => getMarkdownWorkspaceController().getMarkdownPushLabel(kind),
    getMarkdownDiscardLabel: () => getMarkdownWorkspaceController().getMarkdownDiscardLabel(),
    getMarkdownDiscardBusyLabel: () => getMarkdownWorkspaceController().getMarkdownDiscardBusyLabel(),
    getMarkdownSaveLabel: () => getMarkdownWorkspaceController().getMarkdownSaveLabel(),
    getMarkdownSaveBusyLabel: () => getMarkdownWorkspaceController().getMarkdownSaveBusyLabel(),
    getMarkdownSaveTooltip: (kind) => getMarkdownWorkspaceController().getMarkdownSaveTooltip(kind),
    updateMarkdownPushButton: (tab) => getMarkdownWorkspaceController().updateMarkdownPushButton(tab),
    updateMarkdownDiscardButton: (tab) => getMarkdownWorkspaceController().updateMarkdownDiscardButton(tab),
    updateMarkdownSaveButton: (tab) => getMarkdownWorkspaceController().updateMarkdownSaveButton(tab),
    updateMarkdownProtectionButton: (tab) => getMarkdownWorkspaceController().updateMarkdownProtectionButton(tab),
    pushEditorCurrentFileInfo: (tab) => getMarkdownWorkspaceController().pushEditorCurrentFileInfo(tab),
    setDynamicTabStatus: (tab, status) => getMarkdownWorkspaceController().setDynamicTabStatus(tab, status),
    closeDynamicTab: (modeId, closeOptions = {}) =>
      getMarkdownWorkspaceController().closeDynamicTab(modeId, closeOptions),
    getOrCreateDynamicMode: (path, createOptions = {}) =>
      getMarkdownWorkspaceController().getOrCreateDynamicMode(path, createOptions),
    loadDynamicTabContent: (tab) => getMarkdownWorkspaceController().loadDynamicTabContent(tab),
    openMarkdownInEditor: (path, openOptions = {}) =>
      getMarkdownWorkspaceController().openMarkdownInEditor(path, openOptions),
    findDynamicTabByPath: (path) => getMarkdownWorkspaceController().findDynamicTabByPath(path)
  };
}
