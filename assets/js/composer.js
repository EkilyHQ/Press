import './cache-control.js';
import {
  fetchConfigWithYamlFallback,
  parseYAML
} from './yaml.js';
import { escapeHtml } from './utils.js';
import { t, getAvailableLangs, getLanguageLabel } from './i18n.js';
import {
  cloneIndexMetadataValue,
  computeIndexDiff,
  computeIndexSignature,
  computeTabsDiff,
  computeTabsSignature,
  deepClone,
  getIndexVariantLocation,
  isIndexMetadataObject,
  normalizeIndexVariantList,
  prepareIndexState,
  prepareTabsState,
  safeString
} from './composer-index-tabs-model.js';
import {
  cloneSiteState,
  computeSiteDiff,
  computeSiteSignature,
  prepareSiteState,
  toSiteYaml,
  writeYamlValue
} from './composer-site-model.js';
import {
  createScopedStorageKey,
  resolveEditorStorageScope
} from './editor-storage.js';
import { createScopedDraftStore } from './editor-drafts.js';
import { createEditorSessionStateStore } from './editor-session-state.js';
import {
  COMPOSER_RUNTIME_EVENTS,
  createComposerRuntime
} from './composer-runtime.js';
import { createComposerActionEffects } from './composer-action-effects.js';
import { createComposerControllerGraph } from './composer-controller-graph.js';
import { createComposerFilePanelController } from './composer-file-panel-controller.js';
import { createComposerNotificationController } from './composer-notifications.js';
import { createComposerDialogController } from './composer-dialogs.js';
import { createComposerPathTools } from './composer-path-tools.js';
import { createComposerContentMutationController } from './composer-content-mutations.js';
import { createComposerSetupVerifier } from './composer-setup-verifier.js';
import { createComposerModeController, isComposerSystemMode } from './composer-mode-controller.js';
import { createComposerUnsyncedSummaryController } from './composer-unsynced-summary.js';
import { createComposerSystemThemeBridge } from './composer-system-theme-bridge.js';
import {
  createComposerUiMotionController
} from './composer-ui-motion.js';
import {
  applyInferredRepoConfig,
  createComposerSiteConfigController,
  inferRepoConfigFromGitHubPagesUrl
} from './composer-site-config.js';
import { createComposerMarkdownFeature } from './composer-markdown-feature.js';
import { createComposerEditorWorkspaceFeature } from './composer-editor-workspace-feature.js';
import { createComposerYamlSiteFeature } from './composer-yaml-site-feature.js';
import { createComposerPublishSyncFeature } from './composer-publish-sync-feature.js';
import { createComposerMarkdownSessionController } from './composer-markdown-session.js';
import { createComposerMarkdownWorkspaceController } from './composer-markdown-workspace.js';

const PREFERRED_LANG_ORDER = ['en', 'chs', 'cht-tw', 'cht-hk', 'ja'];
const LANG_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
const LANGUAGE_POOL_CHANGED_EVENT = COMPOSER_RUNTIME_EVENTS.languagePoolChanged;
export function createComposerController(editorRuntime = createComposerRuntime()) {
  const composerDocument = editorRuntime.documentRef;
  const composerWindow = editorRuntime.windowRef;
  const composerLogger = {
    warn: (...args) => editorRuntime.warn(...args),
    error: (...args) => editorRuntime.error(...args)
  };
  const composerUiMotion = createComposerUiMotionController({
    documentRef: composerDocument,
    windowRef: composerWindow,
    requestAnimationFrameRef: (handler) => editorRuntime.requestFrame(handler),
    cancelAnimationFrameRef: (id) => editorRuntime.cancelFrame(id),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    matchesMedia: (query) => editorRuntime.matchesMedia(query),
    getComputedStyleRef: (element) => editorRuntime.getComputedStyle(element),
    performanceRef: editorRuntime.getPerformance(),
    ResizeObserverRef: editorRuntime.getResizeObserver()
  });
  const {
    animateComposerInlineVisibility,
    animateComposerListTransition,
    animateComposerOrderMainReset,
    animateComposerViewportScroll,
    cancelComposerOrderMainTransition,
    cancelComposerSiteScrollAnimation,
    cancelListTransition,
    captureElementRect,
    clearInlineSlideStyles,
    composerPrefersReducedMotion,
    getComposerSlideDurations,
    resolveComposerScrollDuration,
    slideToggle,
    syncSiteEditorSingleLabelWidth
  } = composerUiMotion;

  // Utility helpers
  const $ = (selector, root = composerDocument) => {
    try {
      return root && typeof root.querySelector === 'function'
        ? root.querySelector(selector)
        : null;
    } catch (_) {
      return null;
    }
  };
  const $$ = (selector, root = composerDocument) => {
    try {
      return root && typeof root.querySelectorAll === 'function'
        ? Array.from(root.querySelectorAll(selector))
        : [];
    } catch (_) {
      return [];
    }
  };

  const composerPathTools = createComposerPathTools({
    getContentRoot: () => editorRuntime.getContentRoot(),
    preferredLangOrder: PREFERRED_LANG_ORDER,
    getIndexVariantLocation,
    isIndexMetadataObject,
    getIndexEntry
  });
  const {
    normalizeRelPath,
    basenameFromPath,
    dirnameFromPath,
    extractVersionFromPath,
    getContentRootSafe,
    computeBaseDirForPath,
    getDefaultComposerLanguage,
    buildDefaultEntryPath,
    normalizeComposerVersionTag,
    normalizeComposerVersionPaths,
    isComposerVersionTag,
    buildDefaultLanguagePathFromEntry,
    buildArticleVersionPath,
    collectComposerArticleVersions,
    makeDefaultMdTemplate,
    getDefaultMarkdownForPath
  } = composerPathTools;

  function broadcastLanguagePoolChange() {
    editorRuntime.emitLanguagePoolChanged();
  }

  function normalizeLangCode(code) {
    if (!code) return '';
    return String(code).trim().toLowerCase();
  }

  function isLanguageCode(value) {
    return LANG_CODE_PATTERN.test(String(value || '').trim());
  }
  const tComposer = (suffix, params) => t(`editor.composer.${suffix}`, params);
  const tComposerDiff = (suffix, params) => t(`editor.composer.diff.${suffix}`, params);
  const tComposerLang = (suffix, params) => t(`editor.composer.languages.${suffix}`, params);
  const tComposerEntryRow = (suffix, params) => t(`editor.composer.entryRow.${suffix}`, params);
  const composerYamlFeature = createComposerYamlSiteFeature({
    editorRuntime,
    documentRef: composerDocument,
    windowRef: composerWindow,
    consoleRef: composerLogger,
    preferredLangOrder: PREFERRED_LANG_ORDER,
    langCodePattern: LANG_CODE_PATTERN,
    languagePoolChangedEvent: LANGUAGE_POOL_CHANGED_EVENT,
    t,
    tComposer,
    tComposerDiff,
    tComposerLang,
    tComposerEntryRow,
    normalizeLangCode,
    getLanguageLabel,
    isIndexMetadataObject,
    writeYamlValue,
    escapeHtml,
    safeString,
    isLanguageCode
  });
  const {
    displayLangName,
    langFlag,
    sortLangKeys,
    toIndexYaml,
    toTabsYaml
  } = composerYamlFeature;
  let composerYamlRuntime = null;

  // --- Persisted UI state keys ---
  const LS_KEYS = {
    cfile: 'press_composer_file',           // 'index' | 'tabs' | 'site'
    editorState: 'press_composer_editor_state', // persisted dynamic editor info
    systemTreeExpanded: 'press_editor_system_tree_expanded'
  };
  const EDITOR_STATE_VERSION = 3;

  const EDITOR_STORAGE_SCOPE = (() => {
    try { return resolveEditorStorageScope(editorRuntime.getLocation()); }
    catch (_) { return 'unknown'; }
  })();

  function scopedEditorStorageKey(key) {
    return createScopedStorageKey(EDITOR_STORAGE_SCOPE, key);
  }

  const composerStateStore = editorRuntime.createStateStore({
    kinds: ['index', 'tabs', 'site'],
    defaultKind: 'index'
  });

  const composerNotifications = createComposerNotificationController({
    documentRef: composerDocument,
    t,
    safeString,
    alertRef: (message) => editorRuntime.showAlert(message),
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    openWindowRef: (href, target, features) => editorRuntime.openWindow(href, target, features),
    consoleRef: composerLogger
  });
  const {
    showToast,
    preparePopupWindow,
    closePopupWindow,
    finalizePopupWindow,
    handlePopupBlocked
  } = composerNotifications;
  const composerDialogs = createComposerDialogController({
    documentRef: composerDocument,
    t,
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    addWindowListener: (type, handler, options) => editorRuntime.events.onWindow(type, handler, options),
    addDocumentListener: (type, handler, options) => editorRuntime.events.onDocument(type, handler, options),
    getViewportSize: () => editorRuntime.getViewportSize(),
    getWindowScroll: () => editorRuntime.getWindowScroll()
  });
  const {
    showAddEntryPrompt: showComposerAddEntryPrompt,
    showDiscardConfirm: showComposerDiscardConfirm,
    requestMarkdownProtectionPassword
  } = composerDialogs;

  const DRAFT_STORAGE_KEY = 'press_composer_drafts_v1';
  const MARKDOWN_DRAFT_STORAGE_KEY = 'press_markdown_editor_drafts_v1';
  const composerDraftStore = createScopedDraftStore({
    storage: editorRuntime.storage,
    storageKey: DRAFT_STORAGE_KEY,
    scopeKey: scopedEditorStorageKey
  });
  const markdownDraftStore = createScopedDraftStore({
    storage: editorRuntime.storage,
    storageKey: MARKDOWN_DRAFT_STORAGE_KEY,
    scopeKey: scopedEditorStorageKey
  });
  const composerControllerGraph = createComposerControllerGraph({
    serviceRegistry: {
      onDiagnostic: (diagnostic) => {
        composerLogger.warn('Composer service diagnostic', diagnostic);
      }
    }
  });
  const {
    composerServices,
    composerServiceLifecycle,
    markdownWorkspace
  } = composerControllerGraph;
  const {
    getMarkdownActionsUi,
    getMarkdownDraftController,
    getMarkdownLoader,
    getMarkdownSessionController,
    getPrimaryEditorApi,
    restorePrimaryEditorMarkdownView,
    ensurePrimaryEditorListener,
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
    loadDynamicTabContent,
    openMarkdownInEditor,
    findDynamicTabByPath
  } = markdownWorkspace;
  const composerMarkdownFeature = createComposerMarkdownFeature({
    editorRuntime,
    documentRef: composerDocument,
    t,
    tComposer,
    consoleRef: composerLogger,
    markdownWorkspace,
    serviceLifecycle: composerServiceLifecycle,
    markdownDraftStore,
    normalizeRelPath,
    dirnameFromPath,
    basenameFromPath,
    getContentRootSafe,
    getStateSlice,
    getCurrentMode: () => getCurrentComposerMode(),
    getActiveSiteRepoConfig,
    getDefaultMarkdownForPath,
    updateUnsyncedSummary: (options) => updateUnsyncedSummary(options),
    refreshEditorContentTree: (options) => refreshEditorContentTree(options),
    showToast,
    requestMarkdownProtectionPassword,
    showComposerDiscardConfirm,
    setButtonLabel,
    getButtonLabel,
    isDynamicMode
  });
  const {
    computeTextSignature,
    createMarkdownProtectionState,
    getLockedEncryptedMarkdownDraft,
    getMarkdownProtectionState,
    hasMarkdownDraftContent,
    isEncryptedMarkdownDraftEntry,
    isMarkdownTabProtected,
    normalizeMarkdownContent,
    parseEncryptedMarkdownEnvelope,
    prepareMarkdownForProtectedStorage,
    setMarkdownProtectionState,
    readMarkdownDraftStore,
    writeMarkdownDraftStore,
    getMarkdownDraftEntry,
    clearMarkdownDraftEntry,
    restoreMarkdownDraftForTab,
    clearMarkdownDraftForTab,
    scheduleMarkdownDraftSave,
    flushMarkdownDraft,
    updateDynamicTabDirtyState,
    hasUnsavedMarkdownDrafts,
    collectDynamicMarkdownDraftStates,
    updateComposerDraftContainerState,
    updateComposerMarkdownDraftIndicators,
    ensureMarkdownAssetBucket,
    importMarkdownAssetsForPath,
    exportMarkdownAssetBucket,
    importMarkdownAssetDeletionsForPath,
    exportMarkdownAssetDeletionBucket,
    clearMarkdownAssetsForPath,
    removeMarkdownAsset,
    removeMarkdownAssetDeletion,
    listMarkdownAssetDeletions,
    countMarkdownAssetDeletions,
    listMarkdownAssets,
    countMarkdownAssets,
    isAssetReferencedInContent,
    textWithFallback,
    draftHasAssetDeletions,
    collectCurrentRepositoryMarkdownAssetReferences
  } = composerMarkdownFeature;
  const composerSystemThemeBridge = createComposerSystemThemeBridge({
    consoleRef: composerLogger,
    getStateSlice,
    setStateSlice,
    notifyComposerChange,
    updateUnsyncedSummary: () => composerActions.refreshSystemThemeState({ preserveStructure: true }),
    refreshEditorContentTree: (options) => composerActions.refreshEditorContentTree(options)
  });
  const composerPublishSyncFeature = createComposerPublishSyncFeature({
    editorRuntime,
    documentRef: composerDocument,
    windowRef: composerWindow,
    consoleRef: composerLogger,
    t,
    showToast,
    safeString,
    normalizeRelPath,
    normalizeMarkdownContent,
    isIndexMetadataObject,
    cloneIndexMetadataValue,
    getIndexVariantLocation,
    normalizeIndexVariantList,
    prepareIndexState,
    prepareTabsState,
    prepareSiteState,
    deepClone,
    sortLangKeys,
    extractVersionFromPath,
    findDynamicTabByPath,
    getLockedEncryptedMarkdownDraft,
    getMarkdownProtectionState,
    getContentRootSafe,
    getDynamicEditorTabs: () => getDynamicEditorTabs(),
    flushMarkdownDraft,
    getStateSlice,
    getRemoteBaseline: () => composerStateStore.getRemoteBaseline(),
    getComposerDiffCache: () => composerStateStore.getDiffCache(),
    setComposerDiff: (kind, diff) => composerStateStore.setDiff(kind, diff),
    collectCurrentRepositoryMarkdownAssetReferences,
    collectUnsyncedMarkdownEntries,
    getPrimaryEditorApi,
    getActiveDynamicTab,
    getCurrentMode: () => getCurrentComposerMode(),
    readMarkdownDraftStore,
    isEncryptedMarkdownDraftEntry,
    prepareMarkdownForProtectedStorage,
    listMarkdownAssets,
    isAssetReferencedInContent,
    removeMarkdownAsset,
    toIndexYaml,
    toTabsYaml,
    toSiteYaml,
    setStateSlice,
    computeIndexDiff,
    recomputeDiff,
    listMarkdownAssetDeletions,
    draftHasAssetDeletions,
    textWithFallback,
    getRemoteBaselineSite: () => composerStateStore.getRemoteBaseline('site'),
    cloneSiteState,
    fetchContent: (url, options) => editorRuntime.fetchContent(url, options),
    getLocationOrigin: () => editorRuntime.getLocationOrigin(),
    getDocumentLang: () => editorRuntime.getDocumentLang(),
    setRemoteBaselineSlice: (kind, value) => composerStateStore.setRemoteBaseline(kind, value),
    notifyComposerChange,
    clearDraftStorage,
    applyComposerEffectiveSiteConfig: (site) => applyComposerEffectiveSiteConfig(site),
    updateComposerMarkdownDraftIndicators,
    updateMarkdownPushButton,
    updateMarkdownDiscardButton,
    updateMarkdownSaveButton,
    updateMarkdownProtectionButton,
    clearMarkdownDraftEntry,
    clearMarkdownAssetsForPath,
    computeTextSignature,
    setMarkdownProtectionState,
    createMarkdownProtectionState,
    setDynamicTabStatus,
    scheduleMarkdownDraftSave,
    updateDynamicTabDirtyState,
    removeMarkdownAssetDeletion,
    updateUnsyncedSummary,
    registerExternalStagingProviders: (registry) => composerSystemThemeBridge.registerStagingProviders(registry),
    parseEncryptedMarkdownEnvelope,
    isMarkdownTabProtected,
    hasMarkdownDraftContent,
    parseYAML,
    scopeKey: scopedEditorStorageKey,
    getActiveSiteRepoConfig: () => getActiveSiteRepoConfig(),
    getTrackedPublishContentRoot: () => getTrackedPublishContentRoot(),
    gatherCommitPayload: (options) => gatherCommitPayload(options),
    applyLocalPostCommitState: (files) => applyLocalPostCommitState(files),
    computeUnsyncedSummary,
    applyMode: (mode, options) => applyMode(mode, options),
    showEditorSystemPanel: (mode) => showEditorSystemPanel(mode),
    setGitHubCommitInFlight: (value) => editorRuntime.setGitHubCommitInFlight(value),
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    matchesMedia: (query) => editorRuntime.matchesMedia(query),
    basenameFromPath,
    closeComposerDiffModalForKind: (kind) => closeComposerDiffModalForKind(kind)
  });
  const {
    startRemoteSyncWatcher,
    renderPublishTransportSettings,
    refreshSyncCommitPanel,
    scheduleSyncCommitPanelRefresh,
    startMarkdownSyncWatcher,
    fetchComposerRemoteSnapshot,
    applyComposerRemoteSnapshot,
    startComposerSyncWatcher
  } = composerPublishSyncFeature;
  const editorSessionStateStore = createEditorSessionStateStore({
    storage: editorRuntime.storage,
    scopeKey: scopedEditorStorageKey,
    keys: LS_KEYS
  });
  editorRuntime.initializeEditorSessionState({
    editorSessionStateStore,
    editorStateVersion: EDITOR_STATE_VERSION
  });
  const expandedEditorTreeNodeIds = editorRuntime.getExpandedEditorTreeNodeIds();
  const markdownActionsController = composerMarkdownFeature.createActionsController({
    preparePopupWindow,
    closePopupWindow,
    finalizePopupWindow,
    handlePopupBlocked,
    startMarkdownSyncWatcher,
    nsCopyToClipboard
  });
  const {
    manualSaveActiveMarkdown,
    handleMarkdownProtectionButton,
    openMarkdownPushOnGitHub,
    discardMarkdownLocalChanges
  } = markdownActionsController;
  const composerEditorWorkspaceFeature = createComposerEditorWorkspaceFeature({
    editorRuntime,
    documentRef: composerDocument,
    windowRef: composerWindow,
    consoleRef: composerLogger,
    editorSessionStateStore,
    expandedEditorTreeNodeIds,
    preferredLangs: PREFERRED_LANG_ORDER,
    treeText,
    welcomeText,
    t,
    tComposer,
    normalizeRelPath,
    normalizeLangCode,
    normalizeIndexVariantList,
    getIndexVariantLocation,
    extractVersionFromPath,
    basenameFromPath,
    displayLangName,
    sortLangKeys,
    getStateSlice,
    getIndexEntry,
    getTabsEntry,
    notifyComposerChange,
    getCurrentMode: () => getCurrentComposerMode(),
    isDynamicMode,
    applyMode: (mode, options) => applyMode(mode, options),
    openMarkdownInEditor: (path, options) => openMarkdownInEditor(path, options),
    getDynamicEditorTabs: () => getDynamicEditorTabs(),
    persistDynamicEditorState,
    getActiveComposerFile,
    applyComposerFile,
    refreshSyncCommitPanel,
    readMarkdownDraftStore,
    collectDynamicMarkdownDraftStates,
    getMarkdownSessionController,
    getComposerDiff: (kind) => composerStateStore.getDiff(kind),
    getRemoteBaseline: (kind) => composerStateStore.getRemoteBaseline(kind),
    recomputeDiff,
    getComposerDraftMeta,
    hasSystemUpdateEntries: () => composerSystemThemeBridge.hasSystemUpdateEntries(),
    hasThemeEntries: () => composerSystemThemeBridge.hasThemeEntries(),
    addComposerEntry: (kind, anchor) => addComposerEntry(kind, anchor),
    deleteEditorEntry: (source, key) => deleteEditorEntry(source, key),
    addEditorLanguage: (source, key, lang) => addEditorLanguage(source, key, lang),
    removeEditorLanguage: (source, key, lang) => removeEditorLanguage(source, key, lang),
    addEditorVersion: (key, lang, anchor) => addEditorVersion(key, lang, anchor),
    removeEditorVersion: (key, lang, index) => removeEditorVersion(key, lang, index),
    moveEditorVersionTo: (key, lang, from, to) => moveEditorVersionTo(key, lang, from, to),
    restoreDeletedEditorTreeNode: (node) => restoreDeletedEditorTreeNode(node)
  });
  const {
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
    persistSystemTreeExpandedState,
    scheduleEditorStatePersist,
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
  } = composerEditorWorkspaceFeature;
  composerServiceLifecycle.setMarkdownSessionController(createComposerMarkdownSessionController({
    editorStateVersion: EDITOR_STATE_VERSION,
    editorSessionStateStore,
    normalizeRelPath,
    normalizeLangCode,
    inferMarkdownSourceFromPath,
    basenameFromPath,
    computeBaseDirForPath,
    createMarkdownProtectionState,
    ensureMarkdownAssetBucket,
    restoreMarkdownDraftForTab,
    loadDynamicTabContent,
    flushMarkdownDraft,
    clearMarkdownDraftForTab,
    hasMarkdownDraftContent,
    getAllowEditorStatePersist: () => editorRuntime.getAllowEditorStatePersist(),
    getCurrentMode: () => getCurrentComposerMode(),
    captureEditorContentScroll,
    getActiveNodeId: () => editorContentTreeController.getActiveNodeId(),
    getExpandedNodeIdsSnapshot: () => editorContentTreeController.getExpandedNodeIdsSnapshot(),
    getEditorRailScrollTop,
    getEditorContentScrollSnapshot,
    setEditorContentScrollByKey,
    restoreExpandedNodeIds: (ids) => editorContentTreeController.restoreExpandedNodeIds(ids),
    setActiveNodeIdIfExists: (nodeId) => editorContentTreeController.setActiveNodeIdIfExists(nodeId),
    setEditorRailScrollTop,
    restoreEditorContentScrollForMode,
    requestAnimationFrameRef: (fn) => editorRuntime.requestFrame(fn),
    applyMode: (mode, options) => applyMode(mode, options),
    selectEditorTreeNodeByPath,
    showComposerDiscardConfirm,
    t,
    alertRef: (message) => editorRuntime.showAlert(message),
    confirmRef: (message) => editorRuntime.confirmAction(message),
    consoleRef: composerLogger,
    updateDynamicTabsGroupState,
    detachPrimaryEditorListeners,
    updateMarkdownActionsForTab,
    updateComposerMarkdownDraftIndicators
  }));
  composerServiceLifecycle.setMarkdownWorkspaceController(createComposerMarkdownWorkspaceController({
    getPrimaryEditorApi: () => editorRuntime.globals.getPrimaryEditorApi(),
    getMarkdownSessionController,
    getMarkdownActionsUi,
    getMarkdownLoader,
    getCurrentMode: () => getCurrentComposerMode(),
    getTabsEntry,
    getEditorTreeFileNodeByPath,
    notifyComposerChange,
    updateDynamicTabDirtyState,
    inferMarkdownSourceFromPath,
    buildCurrentFileBreadcrumb
  }));
  composerServiceLifecycle.setModeController(createComposerModeController({
    documentRef: composerDocument,
    getDynamicEditorTabs: () => getDynamicEditorTabs(),
    isDynamicMode,
    getFirstDynamicModeId,
    getActiveTreeNodeId: () => editorContentTreeController.getActiveNodeId(),
    setActiveTreeNodeId: (nodeId) => editorContentTreeController.setActiveNodeId(nodeId),
    getEditorTreeNodeById,
    expandEditorAncestors,
    selectEditorTreeNodeForTab,
    getPrimaryEditorApi,
    restorePrimaryEditorMarkdownView,
    ensurePrimaryEditorListener,
    ensurePrimaryEditorTabsMetadataListener,
    getDynamicTabByMode,
    activateDynamicMode,
    clearActiveDynamicMode,
    setEditorDetailPanelMode,
    pushEditorCurrentFileInfo,
    refreshEditorContentTree,
    captureEditorContentScroll,
    restoreEditorContentScrollForMode,
    scrollEditorContentToTop,
    scheduleEditorStatePersist,
    persistDynamicEditorState,
    computeBaseDirForPath,
    animateEditorMarkdownPanelContent,
    updateDynamicTabDirtyState,
    setTabLoadingState,
    loadDynamicTabContent,
    requestAnimationFrameRef: (handler) => editorRuntime.requestFrame(handler),
    alertRef: (message) => editorRuntime.showAlert(message),
    consoleRef: composerLogger
  }));

  function getCurrentComposerMode() {
    return composerServices.getCurrentMode();
  }

  function shouldPreserveEditorStructureForMode(mode) {
    return !!(mode && (isDynamicMode(mode) || isComposerSystemMode(mode)));
  }

  function updateDynamicTabsGroupState() {
    return composerYamlRuntime.updateDynamicTabsGroupState();
  }

  const composerFilePanelController = createComposerFilePanelController({
    documentRef: composerDocument,
    storage: editorRuntime.storage,
    storageKey: scopedEditorStorageKey(LS_KEYS.cfile),
    t,
    prefersReducedMotion: composerPrefersReducedMotion,
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    onPanelStateApplied: (normalized) => {
      try {
        if (normalized === 'site') setComposerOrderPreviewActiveKind('index');
        else setComposerOrderPreviewActiveKind(normalized);
      } catch (_) {}
      const summaryOptions = normalized === 'site' ? { immediate: true } : undefined;
      try { updateUnsyncedSummary(summaryOptions); } catch (_) {}
    }
  });
  const composerSiteConfigController = createComposerSiteConfigController({
    runtime: editorRuntime,
    deepClone
  });
  const {
    applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,
    fetchTrackedSiteConfig: fetchComposerTrackedSiteConfig,
    resolveActiveSiteRepoConfig
  } = composerSiteConfigController;

  composerYamlRuntime = composerYamlFeature.createRuntime({
    draftStore: composerDraftStore,
    getStateSlice,
    setStateSlice,
    getActiveState: () => composerStateStore.getActiveState(),
    getComposerDiff: (kind) => composerStateStore.getDiff(kind),
    getRemoteBaseline: () => composerStateStore.getRemoteBaseline(),
    getRemoteBaselineForKind: (kind) => composerStateStore.getRemoteBaseline(kind),
    setRemoteBaseline: (kind, value) => composerStateStore.setRemoteBaseline(kind, value),
    computeBaselineSignature,
    recomputeDiff,
    prepareIndexState,
    prepareTabsState,
    prepareSiteState,
    cloneSiteState,
    deepClone,
    updateUnsyncedSummary,
    applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,
    fetchTrackedSiteConfig: fetchComposerTrackedSiteConfig,
    fetchConfigWithYamlFallback,
    getActiveComposerFile,
    getContentRootSafe,
    truncateText,
    cssEscape,
    clearInlineSlideStyles,
    treeText,
    normalizeRelPath,
    normalizeIndexVariantList,
    getIndexVariantLocation,
    extractVersionFromPath,
    buildDefaultLanguagePathFromEntry,
    buildArticleVersionPath,
    promptArticleVersionValue: (...args) => promptArticleVersionValue(...args),
    openMarkdownInEditor: (path, options) => openMarkdownInEditor(path, options),
    notifyComposerChange,
    broadcastLanguagePoolChange,
    updateComposerMarkdownDraftIndicators,
    updateComposerDraftContainerState,
    captureElementRect,
    animateListTransition: animateComposerListTransition,
    cancelOrderMainTransition: cancelComposerOrderMainTransition,
    animateOrderMainReset: animateComposerOrderMainReset,
    animateInlineVisibility: animateComposerInlineVisibility,
    getComposerViewTransition: () => composerFilePanelController.getComposerViewTransition(),
    getSlideDurations: getComposerSlideDurations,
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    cancelAnimationFrameRef: (id) => editorRuntime.cancelFrame(id),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    addWindowListener: (type, handler, options) => editorRuntime.events.onWindow(type, handler, options),
    addDocumentListener: (type, handler, options) => editorRuntime.events.onDocument(type, handler, options),
    matchesMedia: (query) => editorRuntime.matchesMedia(query),
    getComputedStyleRef: (element) => editorRuntime.getComputedStyle(element),
    ResizeObserverRef: editorRuntime.getResizeObserver(),
    getWindowScroll: () => editorRuntime.getWindowScroll(),
    alertRef: (message) => editorRuntime.showAlert(message),
    confirmRef: (message) => editorRuntime.confirmAction(message),
    query: $,
    performanceRef: editorRuntime.getPerformance(),
    cssRef: editorRuntime.getCss(),
    fetchContent: (url, options) => editorRuntime.fetchContent(url, options),
    composerPrefersReducedMotion,
    resolveComposerScrollDuration,
    animateComposerViewportScroll,
    cancelComposerSiteScrollAnimation,
    getAvailableLangs,
    syncSiteEditorSingleLabelWidth,
    renderPublishTransportSettings,
    applyMode: (mode, options) => applyMode(mode, options),
    safeString,
    showStatus,
    clearDraftStorage,
    showDiscardConfirm: showComposerDiscardConfirm,
    cancelListTransition,
    slideToggle
  });
  const {
    applySiteDiffMarkers,
    applyIndexDiffMarkers,
    applyTabsDiffMarkers,
    buildEntryDiffBadges,
    computeOrderDiffDetails,
    refreshFileDirtyBadges,
    refreshComposerInlineMeta,
    renderComposerInlineSummary,
    renderOrderStatsChips,
    openComposerDiffModal,
    scheduleComposerOrderPreviewRelayout,
    updateComposerOrderPreview,
    setComposerOrderPreviewActiveKind,
    getComposerOrderPreviewActiveKind,
    closeComposerDiffModalForKind,
    rawScheduleYamlAutoDraft,
    rawClearDraftStorage,
    rawApplyYamlDiffMarkers,
    rawApplySiteConfigForYamlChange,
    rawRefreshOrderPreviewForYamlChange,
    buildIndexUI,
    buildTabsUI,
    buildSiteUI,
    rebuildIndexUI,
    rebuildTabsUI,
    rebuildSiteUI,
    loadDraftSnapshotsIntoState,
    handleComposerDiscard,
    handleComposerRefresh
  } = composerYamlRuntime;
  composerServiceLifecycle.setUnsyncedSummaryController(createComposerUnsyncedSummaryController({
    documentRef: composerDocument,
    getDynamicEditorTabs: () => getDynamicEditorTabs(),
    normalizeRelPath,
    normalizeMarkdownContent,
    hasMarkdownDraftContent,
    readMarkdownDraftStore,
    importMarkdownAssetsForPath,
    importMarkdownAssetDeletionsForPath,
    countMarkdownAssets,
    countMarkdownAssetDeletions,
    listMarkdownAssetDeletions,
    getComposerDiffCache: () => composerStateStore.getDiffCache(),
    getStagingSummaryEntries: () => getStagingSummaryEntries(),
    getActiveComposerFile,
    getComposerDraftMeta,
    hasUnsavedComposerChanges,
    hasAnyComposerDraftMeta,
    hasUnsavedMarkdownDrafts,
    refreshEditorContentTree,
    shouldPreserveEditorStructure: () => shouldPreserveEditorStructureForMode(getCurrentComposerMode()),
    refreshComposerInlineMeta,
    scheduleSyncCommitPanelRefresh
  }));

  function getActiveComposerFile() {
    return composerFilePanelController.getActiveComposerFile();
  }

  function setButtonLabel(btn, label) {
    if (!btn) return;
    const span = btn.querySelector('.btn-label');
    if (span) span.textContent = String(label || '');
    else btn.textContent = String(label || '');
  }

  function getButtonLabel(btn) {
    if (!btn) return '';
    const span = btn.querySelector('.btn-label');
    if (span) return span.textContent || '';
    return btn.textContent || '';
  }

  function truncateText(value, max = 60) {
    const str = safeString(value);
    if (str.length <= max) return str;
    return `${str.slice(0, Math.max(0, max - 1))}…`;
  }

  function getComposerDraftMeta(kind) {
    return composerYamlRuntime.getComposerDraftMeta(kind);
  }

  function hasAnyComposerDraftMeta() {
    return composerYamlRuntime.hasAnyComposerDraftMeta();
  }

  function hasUnsavedComposerChanges() {
    try {
      if (composerStateStore.hasDiff('index')) return true;
    } catch (_) {}
    try {
      if (composerStateStore.hasDiff('tabs')) return true;
    } catch (_) {}
    try {
      if (composerStateStore.hasDiff('site')) return true;
    } catch (_) {}
    return false;
  }

  function cssEscape(value) {
    try {
      const cssRef = editorRuntime.getCss();
      if (cssRef && typeof cssRef.escape === 'function') return cssRef.escape(value);
    } catch (_) {}
    return safeString(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function getStateSlice(kind) {
    return composerStateStore.getStateSlice(kind);
  }

  function setStateSlice(kind, value) {
    composerStateStore.setStateSlice(kind, value);
  }

  function computeBaselineSignature(kind) {
    if (kind === 'tabs') return computeTabsSignature(composerStateStore.getRemoteBaseline('tabs'));
    if (kind === 'site') return computeSiteSignature(composerStateStore.getRemoteBaseline('site'));
    return computeIndexSignature(composerStateStore.getRemoteBaseline('index'));
  }

  function recomputeDiff(kind) {
    const slice = getStateSlice(kind) || { __order: [] };
    let baselineSlice;
    let diff;
    if (kind === 'tabs') {
      baselineSlice = composerStateStore.getRemoteBaseline('tabs');
      diff = computeTabsDiff(slice, baselineSlice);
    } else if (kind === 'site') {
      baselineSlice = composerStateStore.getRemoteBaseline('site');
      diff = computeSiteDiff(slice, baselineSlice);
    } else {
      baselineSlice = composerStateStore.getRemoteBaseline('index');
      diff = computeIndexDiff(slice, baselineSlice);
    }
    composerStateStore.setDiff(kind, diff);
    return diff;
  }

  function refreshEditorLanguageUi() {
    refreshFileDirtyBadges();
    try {
      refreshEditorContentTree({
        preserveStructure: shouldPreserveEditorStructureForMode(getCurrentComposerMode())
      });
    } catch (_) {}
  }

  editorRuntime.events.onDocument('press-editor-language-applied', refreshEditorLanguageUi);

  function getUnsyncedSummaryController() {
    return composerServices.getUnsyncedSummaryController();
  }

  function collectUnsyncedMarkdownEntries() {
    return getUnsyncedSummaryController().collectUnsyncedMarkdownEntries();
  }

  function computeUnsyncedSummary() {
    return getUnsyncedSummaryController().computeUnsyncedSummary();
  }

  function updateModeDirtyIndicators(summaryEntries) {
    getUnsyncedSummaryController().updateModeDirtyIndicators(summaryEntries);
  }

  function rawUpdateUnsyncedSummary(options = {}) {
    return getUnsyncedSummaryController().updateUnsyncedSummary(options);
  }

  function updateUnsyncedSummary(options = {}) {
    return composerActions.updateUnsyncedSummary(options);
  }

  async function gatherCommitPayload(options = {}) {
    return composerPublishSyncFeature.gatherCommitPayload(options);
  }

  function getStagingSummaryEntries(context = {}) {
    return composerPublishSyncFeature.getStagingSummaryEntries(context);
  }

  function applyLocalPostCommitState(files = []) {
    return composerActions.applyLocalPostCommitState(files);
  }

  function rawApplyLocalPostCommitState(files = []) {
    return composerPublishSyncFeature.rawApplyLocalPostCommitState(files);
  }

  function getActiveSiteRepoConfig() {
    const site = getStateSlice('site');
    return resolveActiveSiteRepoConfig(site, editorRuntime.getSiteRepo());
  }

  const composerContentMutations = createComposerContentMutationController({
    documentRef: composerDocument,
    t,
    treeText,
    showToast,
    getStateSlice,
    getIndexEntry,
    getTabsEntry,
    notifyComposerChange,
    refreshEditorContentTree,
    rebuildIndexUI,
    rebuildTabsUI,
    scheduleComposerOrderPreviewRelayout,
    showComposerAddEntryPrompt,
    editorContentTreeController,
    normalizeLangCode,
    normalizeRelPath,
    deepClone,
    normalizeIndexVariantList,
    getIndexVariantLocation,
    isIndexMetadataObject,
    buildDefaultLanguagePathFromEntry,
    buildDefaultEntryPath,
    buildArticleVersionPath,
    getDefaultComposerLanguage,
    normalizeComposerVersionPaths,
    collectComposerArticleVersions,
    isComposerVersionTag,
    normalizeComposerVersionTag,
    displayLangName,
    cssEscape,
    clearInlineSlideStyles,
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    confirmRef: (message) => editorRuntime.confirmAction(message),
    consoleRef: composerLogger
  });
  const {
    addComposerEntry,
    addEditorLanguage,
    addEditorVersion,
    deleteEditorEntry,
    moveEditorVersionTo,
    promptArticleVersionValue,
    removeEditorLanguage,
    removeEditorVersion,
    restoreDeletedEditorTreeNode
  } = composerContentMutations;

  const composerSetupVerifier = createComposerSetupVerifier({
    runtime: editorRuntime,
    documentRef: composerDocument,
    consoleRef: composerLogger,
    t,
    getState: () => composerStateStore.getActiveState(),
    getActiveComposerFile,
    getActiveSiteRepoConfig,
    sortLangKeys,
    normalizeComposerVersionPaths,
    extractVersionFromPath,
    makeDefaultMdTemplate,
    toTabsYaml,
    toIndexYaml,
    nsCopyToClipboard,
    preparePopupWindow,
    closePopupWindow,
    finalizePopupWindow,
    handlePopupBlocked,
    showToast,
    fetchComposerRemoteSnapshot,
    applyComposerRemoteSnapshot,
    clearDraftStorage,
    updateUnsyncedSummary,
    startComposerSyncWatcher,
    getMarkdownPushLabel,
    getContentRoot: () => editorRuntime.getContentRoot(),
    fetchRef: (url, options) => editorRuntime.fetchContent(url, options),
    matchesMedia: (query) => editorRuntime.matchesMedia(query),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay)
  });
  const { bindVerifySetup } = composerSetupVerifier;

  function rawRecomputeYamlDiff(kind) {
    return recomputeDiff(kind);
  }

  const composerActions = createComposerActionEffects({
    applyMode: rawApplyMode,
    selectComposerFile: rawSelectComposerFile,
    recomputeYamlDiff: rawRecomputeYamlDiff,
    applyYamlDiffMarkers: rawApplyYamlDiffMarkers,
    refreshFileDirtyBadges,
    scheduleYamlAutoDraft: rawScheduleYamlAutoDraft,
    applySiteConfigForYamlChange: rawApplySiteConfigForYamlChange,
    refreshUnsyncedSummary: rawUpdateUnsyncedSummary,
    refreshOrderPreviewForYamlChange: rawRefreshOrderPreviewForYamlChange,
    refreshEditorTree: rawRefreshEditorContentTree,
    clearYamlDraftStorage: rawClearDraftStorage,
    applyLocalPostCommitState: rawApplyLocalPostCommitState,
    getCurrentMode: getCurrentComposerMode,
    shouldPreserveEditorStructureForMode
  });

  function clearDraftStorage(kind) {
    return composerActions.clearDraftStorage(kind);
  }

  function notifyComposerChange(kind, options = {}) {
    return composerActions.notifyComposerChange(kind, options);
  }

  function getTrackedPublishContentRoot() {
    return composerPublishSyncFeature.getTrackedPublishContentRoot();
  }

  function rawApplyMode(mode, options = {}) {
    composerServices.applyMode(mode, options);
  }

  function applyMode(mode, options = {}) {
    return composerActions.applyMode(mode, options);
  }

  function getInitialComposerFile() {
    return composerFilePanelController.getInitialComposerFile();
  }

  function rawSelectComposerFile(name, options = {}) {
    if (options && options.persist === false) {
      return composerFilePanelController.applyComposerFile(name, options);
    }
    return composerFilePanelController.setComposerFile(name, options);
  }

  function applyComposerFile(name, options = {}) {
    return composerActions.applyComposerFile(name, options);
  }

  // Apply initial state as early as possible to avoid flash on reload
  (() => {
    try { applyMode('editor'); } catch (_) {}
    try { applyComposerFile(getInitialComposerFile(), { immediate: true, force: true }); } catch (_) {}
    try { updateDynamicTabsGroupState(); } catch (_) {}
  })();

  // Robust clipboard helper available to all composer flows
  async function nsCopyToClipboard(text) {
    return editorRuntime.writeClipboardText(text);
  }

  function treeText(key, fallback, params) {
    const fullKey = `editor.tree.${key}`;
    const value = t(fullKey, params);
    return value && value !== fullKey ? value : fallback;
  }

  function welcomeText(key, fallback, params) {
    const fullKey = `editor.welcome.${key}`;
    const value = t(fullKey, params);
    return value && value !== fullKey ? value : fallback;
  }

  function refreshEditorContentTree(options = {}) {
    return composerActions.refreshEditorContentTree(options);
  }

  editorRuntime.events.onDocument('press-editor-current-file-breadcrumb-select', (event) => {
    const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : {};
    const nodeId = String(detail.nodeId || '').trim();
    if (!nodeId) return;
    handleEditorTreeSelection(nodeId);
  });

  function getIndexEntry(key) {
    const state = getStateSlice('index') || {};
    if (!state[key] || typeof state[key] !== 'object') state[key] = {};
    return state[key];
  }

  function getTabsEntry(key) {
    const state = getStateSlice('tabs') || {};
    if (!state[key] || typeof state[key] !== 'object') state[key] = {};
    return state[key];
  }

  function showStatus(msg, kind = 'info') {
    if (msg) {
      const type = typeof kind === 'string' ? kind : 'info';
      showToast(type, msg);
    }
    updateUnsyncedSummary();
  }

  function rebuildSiteUI() {
    return composerYamlRuntime.rebuildSiteUI();
  }

  const composerStartup = composerControllerGraph.createStartup({
    editorRuntime,
    documentRef: composerDocument,
    windowRef: composerWindow,
    consoleRef: composerLogger,
    composerStateStore,
    composerActions,
    composerSystemThemeBridge,
    markdownToolbar: {
      t,
      setMarkdownPushButton,
      setMarkdownSaveButton,
      setMarkdownProtectionButton,
      setMarkdownDiscardButton,
      getMarkdownPushButton,
      getActiveDynamicTab,
      getButtonLabel,
      getMarkdownPushLabel,
      setButtonLabel,
      showToast,
      openMarkdownPushOnGitHub,
      updateMarkdownPushButton,
      updateMarkdownProtectionButton,
      manualSaveActiveMarkdown,
      handleMarkdownProtectionButton,
      discardMarkdownLocalChanges,
      updateMarkdownSaveButton,
      updateMarkdownDiscardButton
    },
    initialState: {
      t,
      fetchTrackedSiteConfig: fetchComposerTrackedSiteConfig,
      applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,
      fetchConfigWithYamlFallback,
      prepareSiteState,
      prepareIndexState,
      prepareTabsState,
      cloneSiteState,
      deepClone,
      getActiveDynamicTab,
      updateMarkdownPushButton,
      showStatus
    },
    workspace: {
      t,
      loadDraftSnapshotsIntoState,
      applyInferredRepoConfig,
      inferRepoConfigFromGitHubPagesUrl,
      applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,
      updateMarkdownPushButton,
      getActiveDynamicTab,
      showStatus,
      buildIndexUI,
      buildTabsUI,
      buildSiteUI,
      notifyComposerChange,
      refreshEditorContentTree,
      restoreDynamicEditorState,
      applyMode,
      persistDynamicEditorState
    },
    workspaceUi: {
      mountEditorSystemPanels,
      initEditorOverlay,
      initEditorRailResize,
      initMobileEditorRail,
      bindEditorStatePersistenceListeners,
      openEditorOverlay,
      applyMode,
      setComposerFile: (name, options = {}) => {
        composerActions.selectComposerFile(name, options);
      },
      getInitialComposerFile,
      getActiveComposerFile,
      addComposerEntry,
      handleComposerDiscard,
      handleComposerRefresh,
      computeUnsyncedSummary,
      openComposerDiffModal,
      bindVerifySetup
    }
  });

  function start() {
    return composerStartup.start();
  }

  return { start };
}

createComposerController().start();
