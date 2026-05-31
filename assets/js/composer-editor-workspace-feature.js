import { findEditorContentTreeNode, flattenEditorContentTree } from './editor-content-tree.js';
import { createComposerEditorTreeState } from './composer-editor-tree-state.js';
import { createComposerEditorShell } from './composer-editor-shell.js';
import { createComposerEditorDetailPanelController } from './composer-editor-detail-panel-controller.js';
import { createEditorContentTreeController } from './editor-content-tree-controller.js';
import { createEditorFileTreeUi } from './editor-file-tree-ui.js';
import { createEditorStructurePanelUi } from './editor-structure-panel-ui.js';

const noop = () => {};

export function createComposerEditorWorkspaceFeature(options = {}) {
  const editorRuntime = options.editorRuntime || {};
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const consoleRef = options.consoleRef || { error: noop, warn: noop };
  const editorSessionStateStore = options.editorSessionStateStore || null;
  const expandedEditorTreeNodeIds = options.expandedEditorTreeNodeIds || new Set();
  const treeText = typeof options.treeText === 'function' ? options.treeText : (_key, fallback) => fallback || '';
  const welcomeText = typeof options.welcomeText === 'function' ? options.welcomeText : (_key, fallback) => fallback || '';
  const t = typeof options.t === 'function' ? options.t : (key) => String(key || '');
  const tComposer = typeof options.tComposer === 'function' ? options.tComposer : (suffix) => `editor.composer.${suffix}`;
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : (value) => String(value || '').replace(/[\\]/g, '/');
  const normalizeIndexVariantList = typeof options.normalizeIndexVariantList === 'function' ? options.normalizeIndexVariantList : (value) => value;
  const getIndexVariantLocation = typeof options.getIndexVariantLocation === 'function' ? options.getIndexVariantLocation : () => '';
  const extractVersionFromPath = typeof options.extractVersionFromPath === 'function' ? options.extractVersionFromPath : () => '';
  const basenameFromPath = typeof options.basenameFromPath === 'function' ? options.basenameFromPath : () => '';
  const displayLangName = typeof options.displayLangName === 'function' ? options.displayLangName : (value) => String(value || '');
  const sortLangKeys = typeof options.sortLangKeys === 'function' ? options.sortLangKeys : (keys) => keys;
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => ({});
  const getIndexEntry = typeof options.getIndexEntry === 'function' ? options.getIndexEntry : () => ({});
  const getTabsEntry = typeof options.getTabsEntry === 'function' ? options.getTabsEntry : () => ({});
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : noop;
  const setEditorDetailPanelModeExternal = typeof options.setEditorDetailPanelMode === 'function' ? options.setEditorDetailPanelMode : noop;
  const getCurrentMode = typeof options.getCurrentMode === 'function' ? options.getCurrentMode : () => '';
  const isDynamicMode = typeof options.isDynamicMode === 'function' ? options.isDynamicMode : () => false;
  const applyMode = typeof options.applyMode === 'function' ? options.applyMode : noop;
  const openMarkdownInEditor = typeof options.openMarkdownInEditor === 'function' ? options.openMarkdownInEditor : noop;
  const scheduleEditorStatePersist = typeof options.scheduleEditorStatePersist === 'function' ? options.scheduleEditorStatePersist : noop;
  const persistSystemTreeExpandedState = typeof options.persistSystemTreeExpandedState === 'function' ? options.persistSystemTreeExpandedState : noop;

  let editorFileTreeUi = null;
  let editorStructurePanelUi = null;
  let buildCurrentEditorTreeRef = () => [];
  let setEditorDetailPanelModeRef = setEditorDetailPanelModeExternal;
  let setEditorStructurePanelVisibleRef = noop;
  let scrollEditorContentToTopRef = noop;
  let closeEditorRailDrawerRef = noop;

  const editorContentTreeController = createEditorContentTreeController({
    documentRef,
    expandedNodeIds: expandedEditorTreeNodeIds,
    normalizePath: normalizeRelPath,
    flattenTree: flattenEditorContentTree,
    findNode: findEditorContentTreeNode,
    buildTree: () => buildCurrentEditorTreeRef(),
    getCurrentMode,
    isDynamicMode,
    renderFileTree: (treeEl) => editorFileTreeUi && editorFileTreeUi.renderEditorFileTree(treeEl),
    renderStructurePanel: (node) => editorStructurePanelUi && editorStructurePanelUi.renderEditorStructurePanel(node),
    setEditorDetailPanelMode: (mode) => setEditorDetailPanelModeRef(mode),
    setStructurePanelVisible: (visible) => setEditorStructurePanelVisibleRef(visible),
    applyMode,
    openMarkdownInEditor,
    scrollEditorContentToTop: (behavior) => scrollEditorContentToTopRef(behavior),
    closeEditorRailDrawer: () => closeEditorRailDrawerRef(),
    scheduleEditorStatePersist,
    persistSystemTreeExpandedState,
    inferMarkdownSourceFallback: (path) => (String(path || '').toLowerCase().startsWith('tab/') ? 'tabs' : 'index')
  });

  const editorShell = createComposerEditorShell({
    documentRef,
    requestAnimationFrameRef: (handler) => editorRuntime.requestFrame(handler),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    addWindowListener: (type, handler, listenerOptions) => editorRuntime.events.onWindow(type, handler, listenerOptions),
    addDocumentListener: (type, handler, listenerOptions) => editorRuntime.events.onDocument(type, handler, listenerOptions),
    matchesMedia: (query) => editorRuntime.matchesMedia(query),
    getViewportWidth: () => editorRuntime.getViewportWidth(),
    scrollWindowToTop: (behavior) => editorRuntime.scrollWindowToTop(behavior),
    getDocumentVisibilityState: () => (documentRef ? documentRef.visibilityState : ''),
    editorSessionStateStore,
    expandedEditorTreeNodeIds,
    treeText,
    getCurrentMode,
    getDynamicEditorTabs: options.getDynamicEditorTabs,
    isDynamicMode,
    normalizeRelPath,
    getAllowEditorStatePersist: () => editorRuntime.getAllowEditorStatePersist(),
    persistDynamicEditorState: options.persistDynamicEditorState,
    getActiveComposerFile: options.getActiveComposerFile,
    applyComposerFile: options.applyComposerFile,
    refreshSyncCommitPanel: options.refreshSyncCommitPanel,
    applyMode
  });
  const {
    mountEditorSystemPanels,
    setEditorSystemPanelVisible,
    showEditorSystemPanel,
    initEditorOverlay,
    openEditorOverlay,
    initEditorRailResize,
    initMobileEditorRail,
    closeEditorRailDrawer,
    bindEditorStatePersistenceListeners,
    persistSystemTreeExpandedState: persistSystemTreeExpandedStateFromShell,
    scheduleEditorStatePersist: scheduleEditorStatePersistFromShell,
    captureEditorContentScroll,
    restoreEditorContentScrollForMode,
    scrollEditorContentToTop,
    getEditorRailScrollTop,
    setEditorRailScrollTop,
    setEditorContentScrollByKey,
    getEditorContentScrollSnapshot
  } = editorShell;
  scrollEditorContentToTopRef = scrollEditorContentToTop;
  closeEditorRailDrawerRef = closeEditorRailDrawer;

  const editorDetailPanelController = createComposerEditorDetailPanelController({
    documentRef,
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    setSystemPanelVisible: (visible) => setEditorSystemPanelVisible(visible),
    showSystemPanel: (mode) => showEditorSystemPanel(mode)
  });
  const {
    animateEditorMarkdownPanelContent,
    animateEditorStructurePanelContent,
    setEditorDetailPanelMode,
    setEditorStructurePanelVisible
  } = editorDetailPanelController;
  setEditorDetailPanelModeRef = setEditorDetailPanelMode;
  setEditorStructurePanelVisibleRef = setEditorStructurePanelVisible;

  const composerEditorTreeState = createComposerEditorTreeState({
    preferredLangs: options.preferredLangs || [],
    normalizeRelPath,
    treeText,
    getStateSlice,
    readMarkdownDraftStore: options.readMarkdownDraftStore,
    collectDynamicMarkdownDraftStates: options.collectDynamicMarkdownDraftStates,
    getMarkdownSessionController: options.getMarkdownSessionController,
    getComposerDiff: options.getComposerDiff,
    getRemoteBaseline: options.getRemoteBaseline,
    recomputeDiff: options.recomputeDiff,
    getComposerDraftMeta: options.getComposerDraftMeta,
    hasSystemUpdateEntries: options.hasSystemUpdateEntries,
    hasThemeEntries: options.hasThemeEntries
  });
  const {
    buildCurrentEditorTree
  } = composerEditorTreeState;
  buildCurrentEditorTreeRef = buildCurrentEditorTree;

  editorFileTreeUi = createEditorFileTreeUi({
    documentRef,
    windowRef,
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    treeText,
    getEditorContentTree: () => editorContentTreeController.getTree(),
    getActiveNodeId: () => editorContentTreeController.getActiveNodeId(),
    expandedNodeIds: editorContentTreeController.getExpandedNodeIds(),
    handleEditorTreeSelection: (nodeId) => editorContentTreeController.handleSelection(nodeId),
    persistSystemTreeExpandedState: () => persistSystemTreeExpandedStateFromShell(),
    refreshEditorContentTree: (refreshOptions) => editorContentTreeController.refresh(refreshOptions),
    scheduleEditorStatePersist: () => scheduleEditorStatePersistFromShell()
  });

  editorStructurePanelUi = createEditorStructurePanelUi({
    documentRef,
    windowRef,
    consoleRef,
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    alertRef: (message) => editorRuntime.showAlert(message),
    populateEditorLanguageSelect: () => editorRuntime.populateEditorLanguageSelect(),
    emitLanguageControlMounted: () => editorRuntime.emitEditorLanguageControlMounted(),
    preferredLangOrder: options.preferredLangs || [],
    treeText,
    welcomeText,
    translate: t,
    tComposer,
    displayLangName,
    sortLangKeys,
    normalizeRelPath,
    normalizeIndexVariantList,
    getIndexVariantLocation,
    extractVersionFromPath,
    basenameFromPath,
    getStateSlice,
    getIndexEntry,
    getTabsEntry,
    notifyComposerChange,
    refreshEditorContentTree: (refreshOptions) => editorContentTreeController.refresh(refreshOptions),
    setEditorDetailPanelMode: (mode) => setEditorDetailPanelMode(mode),
    animateEditorStructurePanelContent: (panel) => animateEditorStructurePanelContent(panel),
    setActiveEditorTreeNodeId: (nodeId) => { editorContentTreeController.setActiveNodeId(nodeId); },
    handleEditorTreeSelection: (nodeId) => editorContentTreeController.handleSelection(nodeId),
    openMarkdownInEditor,
    addComposerEntry: (kind, anchor) => options.addComposerEntry(kind, anchor),
    deleteEditorEntry: (source, key) => options.deleteEditorEntry(source, key),
    addEditorLanguage: (source, key, lang) => options.addEditorLanguage(source, key, lang),
    removeEditorLanguage: (source, key, lang) => options.removeEditorLanguage(source, key, lang),
    addEditorVersion: (key, lang, anchor) => options.addEditorVersion(key, lang, anchor),
    removeEditorVersion: (key, lang, index) => options.removeEditorVersion(key, lang, index),
    moveEditorVersionTo: (key, lang, from, to) => options.moveEditorVersionTo(key, lang, from, to),
    restoreDeletedEditorTreeNode: (node) => options.restoreDeletedEditorTreeNode(node)
  });

  function getActiveEditorTreeNode() {
    return editorContentTreeController.getActiveNode();
  }

  function inferMarkdownSourceFromPath(path) {
    return editorContentTreeController.inferMarkdownSourceFromPath(path);
  }

  function getEditorTreeNodeById(nodeId) {
    return editorContentTreeController.getNodeById(nodeId);
  }

  function getEditorTreeFileNodeByPath(path) {
    return editorContentTreeController.getFileNodeByPath(path);
  }

  function getEditorTreeFileNodeForTab(tab) {
    return editorContentTreeController.getFileNodeForTab(tab);
  }

  function buildCurrentFileBreadcrumb(tab) {
    return editorContentTreeController.buildCurrentFileBreadcrumb(tab);
  }

  function expandEditorAncestors(node) {
    editorContentTreeController.expandAncestors(node);
  }

  function selectEditorTreeNodeByPath(path, selectOptions = {}) {
    return editorContentTreeController.selectNodeByPath(path, selectOptions);
  }

  function selectEditorTreeNodeForTab(tab, selectOptions = {}) {
    return editorContentTreeController.selectNodeForTab(tab, selectOptions);
  }

  function rawRefreshEditorContentTree(refreshOptions = {}) {
    editorContentTreeController.refresh(refreshOptions);
  }

  function handleEditorTreeSelection(nodeId) {
    editorContentTreeController.handleSelection(nodeId);
  }

  return {
    editorContentTreeController,
    buildCurrentEditorTree,
    getActiveEditorTreeNode,
    inferMarkdownSourceFromPath,
    getEditorTreeNodeById,
    getEditorTreeFileNodeByPath,
    getEditorTreeFileNodeForTab,
    buildCurrentFileBreadcrumb,
    expandEditorAncestors,
    selectEditorTreeNodeByPath,
    selectEditorTreeNodeForTab,
    rawRefreshEditorContentTree,
    handleEditorTreeSelection,
    mountEditorSystemPanels,
    setEditorSystemPanelVisible,
    showEditorSystemPanel,
    initEditorOverlay,
    openEditorOverlay,
    initEditorRailResize,
    initMobileEditorRail,
    closeEditorRailDrawer,
    bindEditorStatePersistenceListeners,
    persistSystemTreeExpandedState: persistSystemTreeExpandedStateFromShell,
    scheduleEditorStatePersist: scheduleEditorStatePersistFromShell,
    captureEditorContentScroll,
    restoreEditorContentScrollForMode,
    scrollEditorContentToTop,
    getEditorRailScrollTop,
    setEditorRailScrollTop,
    setEditorContentScrollByKey,
    getEditorContentScrollSnapshot,
    animateEditorMarkdownPanelContent,
    animateEditorStructurePanelContent,
    setEditorDetailPanelMode,
    setEditorStructurePanelVisible
  };
}
