import './cache-control.js';
import { getManualMarkdownSaveState } from './composer-markdown-save.js';
import {
  fetchConfigWithYamlFallback,
  parseYAML
} from './yaml.js';
import { escapeHtml } from './utils.js';
import { t, getAvailableLangs, getLanguageLabel } from './i18n.js';
import { findEditorContentTreeNode, flattenEditorContentTree } from './editor-content-tree.js';
import {
  decryptMarkdownDocument,
  encryptMarkdownDocument,
  parseEncryptedMarkdownEnvelope
} from './encrypted-content.js';
import { createComposerPublishStateService } from './composer-publish-state-service.js';
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
import { createComposerServiceRegistry } from './composer-service-registry.js';
import { createComposerServiceLifecycle } from './composer-app-services.js';
import { createComposerActionEffects } from './composer-action-effects.js';
import { createComposerMarkdownWorkspaceFacade } from './composer-markdown-workspace-facade.js';
import { createComposerYamlSerialization } from './composer-yaml-serialization.js';
import { createComposerEditorTreeState } from './composer-editor-tree-state.js';
import { createComposerFilePanelController } from './composer-file-panel-controller.js';
import { createComposerPublishService } from './composer-publish-service.js';
import { createComposerNotificationController } from './composer-notifications.js';
import { createComposerDialogController } from './composer-dialogs.js';
import { createComposerRemoteSyncController } from './composer-remote-sync.js';
import { createComposerDiffUi } from './composer-diff-ui.js';
import { createComposerOrderDiffUi } from './composer-order-diff-ui.js';
import { createComposerIndexTabsUi } from './composer-index-tabs-ui.js';
import { createComposerSiteSettingsUi } from './composer-site-settings-ui.js';
import { createComposerYamlPanelsController } from './composer-yaml-panels-controller.js';
import { createComposerMarkdownAssetManager } from './composer-markdown-assets.js';
import { createComposerEditorShell } from './composer-editor-shell.js';
import { createComposerEditorDetailPanelController } from './composer-editor-detail-panel-controller.js';
import { createComposerPathTools } from './composer-path-tools.js';
import { createComposerContentMutationController } from './composer-content-mutations.js';
import { createComposerSetupVerifier } from './composer-setup-verifier.js';
import { createComposerModeController, isComposerSystemMode } from './composer-mode-controller.js';
import { createComposerUnsyncedSummaryController } from './composer-unsynced-summary.js';
import { injectComposerRuntimeStyles } from './composer-runtime-styles.js';
import { createComposerSystemThemeBridge } from './composer-system-theme-bridge.js';
import {
  bindComposerWorkspaceUi,
  initializeComposerApp
} from './composer-bootstrap.js';
import {
  createComposerUiMotionController
} from './composer-ui-motion.js';
import {
  applyInferredRepoConfig,
  createComposerSiteConfigController,
  inferRepoConfigFromGitHubPagesUrl
} from './composer-site-config.js';
import { createComposerYamlActions } from './composer-yaml-actions.js';
import { createEditorContentTreeController } from './editor-content-tree-controller.js';
import { createComposerMarkdownLoader } from './composer-markdown-loader.js';
import { createComposerMarkdownActionsUi } from './composer-markdown-actions-ui.js';
import { createComposerMarkdownActionsController } from './composer-markdown-actions.js';
import { createComposerMarkdownDraftController } from './composer-markdown-drafts.js';
import { createComposerMarkdownSessionController } from './composer-markdown-session.js';
import { createComposerMarkdownWorkspaceController } from './composer-markdown-workspace.js';
import { createComposerYamlDraftController } from './composer-yaml-drafts.js';
import {
  computeTextSignature,
  createDiscardedMarkdownProtectionState,
  createMarkdownProtectionState,
  getLockedEncryptedMarkdownDraft,
  getMarkdownProtectionState,
  hasMarkdownDraftContent,
  isEncryptedMarkdownDraftEntry,
  isMarkdownTabProtected,
  normalizeMarkdownContent,
  setMarkdownProtectionState
} from './composer-markdown-state.js';
import { createEditorFileTreeUi } from './editor-file-tree-ui.js';
import { createEditorStructurePanelUi } from './editor-structure-panel-ui.js';
import {
  CONNECT_PUBLISH_PRESETS
} from './publish/settings-store.js';

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
  const composerYamlSerialization = createComposerYamlSerialization({
    preferredLangOrder: PREFERRED_LANG_ORDER,
    normalizeLangCode,
    getLanguageLabel,
    isIndexMetadataObject,
    writeYamlValue
  });
  const {
    displayLangName,
    langFlag,
    sortLangKeys,
    toIndexYaml,
    toTabsYaml
  } = composerYamlSerialization;

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

  const composerPublishService = createComposerPublishService({
    documentRef: composerDocument,
    windowRef: composerWindow,
    t,
    fetchContent: (url, options) => editorRuntime.fetchContent(url, options),
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    matchesMedia: (query) => editorRuntime.matchesMedia(query),
    scopeKey: scopedEditorStorageKey,
    getActiveSiteRepoConfig: () => getActiveSiteRepoConfig(),
    getTrackedPublishContentRoot: () => getTrackedPublishContentRoot(),
    gatherCommitPayload: (options) => gatherCommitPayload(options),
    applyLocalPostCommitState: (files) => applyLocalPostCommitState(files),
    getCurrentMode: () => getCurrentComposerMode(),
    computeUnsyncedSummary,
    applyMode: (mode, options) => applyMode(mode, options),
    showEditorSystemPanel: (mode) => showEditorSystemPanel(mode),
    showToast,
    consoleRef: composerLogger,
    setGitHubCommitInFlight: (value) => editorRuntime.setGitHubCommitInFlight(value)
  });
  const {
    setSyncOverlayStatus,
    startRemoteSyncWatcher,
    renderPublishTransportSettings,
    refreshSyncCommitPanel,
    scheduleSyncCommitPanelRefresh
  } = composerPublishService;

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
  const composerServices = createComposerServiceRegistry();
  const composerServiceLifecycle = createComposerServiceLifecycle(composerServices);
  const markdownWorkspace = createComposerMarkdownWorkspaceFacade({ services: composerServices });
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
  const markdownAssetManager = createComposerMarkdownAssetManager({
    t,
    normalizeRelPath,
    normalizeMarkdownContent,
    emitMarkdownAssetPreview: (detail) => editorRuntime.events.emitWindow('press-editor-asset-preview', detail),
    addWindowListener: (type, handler, options) => editorRuntime.events.onWindow(type, handler, options),
    fetchContent: (url, options) => editorRuntime.fetchContent(url, options),
    getContentRootSafe,
    getStateSlice,
    getDynamicEditorTabs: () => getDynamicEditorTabs(),
    getActiveDynamicTab,
    getPrimaryEditorApi,
    readMarkdownDraftStore,
    writeMarkdownDraftStore,
    getMarkdownDraftEntry,
    findDynamicTabByPath,
    scheduleMarkdownDraftSave,
    updateUnsyncedSummary,
    showToast
  });
  const {
    ensureMarkdownAssetBucket,
    normalizeAssetDescriptor,
    normalizeAssetDeletionDescriptor,
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
  } = markdownAssetManager;
  const composerSystemThemeBridge = createComposerSystemThemeBridge({
    consoleRef: composerLogger,
    getStateSlice,
    setStateSlice,
    notifyComposerChange,
    updateUnsyncedSummary: () => composerActions.refreshSystemThemeState({ preserveStructure: true }),
    refreshEditorContentTree: (options) => composerActions.refreshEditorContentTree(options)
  });
  const composerPublishStateService = createComposerPublishStateService({
    safeString,
    normalizeRelPath,
    normalizeMarkdownContent,
    isIndexMetadataObject,
    cloneIndexMetadataValue,
    getIndexVariantLocation,
    normalizeIndexVariantList,
    prepareIndexState,
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
    consoleRef: composerLogger,
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
    registerExternalStagingProviders: (registry) => composerSystemThemeBridge.registerStagingProviders(registry)
  });
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
  composerServiceLifecycle.setMarkdownDraftController(createComposerMarkdownDraftController({
    markdownDraftStore,
    normalizeRelPath,
    normalizeAssetDescriptor,
    normalizeAssetDeletionDescriptor,
    importMarkdownAssetsForPath,
    importMarkdownAssetDeletionsForPath,
    exportMarkdownAssetBucket,
    exportMarkdownAssetDeletionBucket,
    clearMarkdownAssetsForPath,
    ensureMarkdownAssetBucket,
    countMarkdownAssetDeletions,
    prepareMarkdownForProtectedStorage,
    getMarkdownProtectionState,
    setMarkdownProtectionState,
    getDynamicEditorTabs: () => getDynamicEditorTabs(),
    getCurrentMode: () => getCurrentComposerMode(),
    pushEditorCurrentFileInfo,
    updateMarkdownPushButton,
    updateComposerMarkdownDraftIndicators,
    refreshEditorContentTree: () => {},
    updateUnsyncedSummary: () => composerActions.refreshMarkdownDraftState({ preserveStructure: true }),
    showToast,
    t,
    consoleRef: composerLogger,
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id)
  }));
  composerServiceLifecycle.setMarkdownLoader(createComposerMarkdownLoader({
    getContentRootSafe,
    normalizeRelPath,
    normalizeMarkdownContent,
    computeTextSignature,
    parseEncryptedMarkdownEnvelope,
    decryptProtectedMarkdownForTab,
    isMarkdownTabProtected,
    setMarkdownProtectionState,
    createMarkdownProtectionState,
    draftHasAssetDeletions,
    getDefaultMarkdownForPath,
    updateDynamicTabDirtyState,
    getCurrentMode: () => getCurrentComposerMode(),
    pushEditorCurrentFileInfo,
    refreshEditorContentTree,
    fetchContent: (url, options) => editorRuntime.fetchContent(url, options),
    draftProtectionTitle: () => t('editor.composer.markdown.protection.draftTitle'),
    draftProtectionMessage: () => t('editor.composer.markdown.protection.draftMessage'),
    openProtectionTitle: () => t('editor.composer.markdown.protection.openTitle'),
    openProtectionMessage: () => t('editor.composer.markdown.protection.openMessage')
  }));
  composerServiceLifecycle.setMarkdownActionsUi(createComposerMarkdownActionsUi({
    documentRef: composerDocument,
    translate: t,
    getCurrentMode: () => getCurrentComposerMode(),
    getActiveDynamicTab,
    getActiveSiteRepoConfig,
    hasMarkdownDraftContent,
    getManualMarkdownSaveState,
    isMarkdownTabProtected,
    setButtonLabel
  }));
  const remoteSyncController = createComposerRemoteSyncController({
    t,
    fetchContent: (url, options) => editorRuntime.fetchContent(url, options),
    getContentRootSafe,
    normalizeRelPath,
    normalizeMarkdownContent,
    computeTextSignature,
    parseEncryptedMarkdownEnvelope,
    createMarkdownProtectionState,
    getMarkdownProtectionState,
    setMarkdownProtectionState,
    isMarkdownTabProtected,
    hasMarkdownDraftContent,
    setDynamicTabStatus,
    updateDynamicTabDirtyState,
    updateComposerMarkdownDraftIndicators,
    getCurrentMode: () => getCurrentComposerMode(),
    getPrimaryEditorApi,
    basenameFromPath,
    startRemoteSyncWatcher,
    showToast,
    updateMarkdownPushButton,
    updateMarkdownDiscardButton,
    updateMarkdownSaveButton,
    updateMarkdownProtectionButton,
    parseYAML,
    prepareIndexState,
    prepareTabsState,
    prepareSiteState,
    cloneSiteState,
    deepClone,
    setRemoteBaseline: (kind, value) => composerStateStore.setRemoteBaseline(kind, value),
    notifyComposerChange,
    clearDraftStorage,
    updateUnsyncedSummary,
    closeComposerDiffModalForKind: (kind) => closeComposerDiffModalForKind(kind)
  });
  const {
    startMarkdownSyncWatcher,
    fetchComposerRemoteSnapshot,
    applyComposerRemoteSnapshot,
    startComposerSyncWatcher
  } = remoteSyncController;
  const markdownActionsController = createComposerMarkdownActionsController({
    consoleRef: composerLogger,
    confirmRef: (message) => editorRuntime.confirmAction(message),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    t,
    getCurrentMode: () => getCurrentComposerMode(),
    getActiveDynamicTab,
    getActiveSiteRepoConfig,
    getContentRootSafe,
    normalizeRelPath,
    dirnameFromPath,
    basenameFromPath,
    getPrimaryEditorApi,
    loadDynamicTabContent,
    getManualMarkdownSaveState,
    getMarkdownSaveTooltip,
    updateMarkdownSaveButton,
    getMarkdownSaveButton,
    getButtonLabel,
    getMarkdownSaveLabel,
    getMarkdownSaveBusyLabel,
    setButtonLabel,
    saveMarkdownDraftForTab,
    pushEditorCurrentFileInfo,
    showToast,
    updateMarkdownDiscardButton,
    updateMarkdownPushButton,
    updateMarkdownProtectionButton,
    updateUnsyncedSummary,
    requestMarkdownProtectionPassword,
    getMarkdownProtectionState,
    setMarkdownProtectionState,
    updateDynamicTabDirtyState,
    showComposerDiscardConfirm,
    preparePopupWindow,
    closePopupWindow,
    finalizePopupWindow,
    handlePopupBlocked,
    computeTextSignature,
    startMarkdownSyncWatcher,
    prepareMarkdownForProtectedStorage,
    nsCopyToClipboard,
    normalizeMarkdownContent,
    createDiscardedMarkdownProtectionState,
    hasMarkdownDraftContent,
    clearMarkdownDraftForTab,
    getMarkdownDiscardButton,
    getMarkdownDiscardLabel,
    getMarkdownDiscardBusyLabel
  });
  const {
    manualSaveActiveMarkdown,
    handleMarkdownProtectionButton,
    openMarkdownPushOnGitHub,
    discardMarkdownLocalChanges
  } = markdownActionsController;
  const editorContentTreeController = createEditorContentTreeController({
    documentRef: composerDocument,
    expandedNodeIds: expandedEditorTreeNodeIds,
    normalizePath: normalizeRelPath,
    flattenTree: flattenEditorContentTree,
    findNode: findEditorContentTreeNode,
    buildTree: () => buildCurrentEditorTree(),
    getCurrentMode: () => getCurrentComposerMode(),
    isDynamicMode,
    renderFileTree: (treeEl) => editorFileTreeUi.renderEditorFileTree(treeEl),
    renderStructurePanel: (node) => editorStructurePanelUi.renderEditorStructurePanel(node),
    setEditorDetailPanelMode: (mode) => setEditorDetailPanelMode(mode),
    setStructurePanelVisible: (visible) => setEditorStructurePanelVisible(visible),
    applyMode: (mode, options) => applyMode(mode, options),
    openMarkdownInEditor: (path, options) => openMarkdownInEditor(path, options),
    scrollEditorContentToTop: (behavior) => scrollEditorContentToTop(behavior),
    closeEditorRailDrawer: () => closeEditorRailDrawer(),
    scheduleEditorStatePersist: () => scheduleEditorStatePersist(),
    persistSystemTreeExpandedState: () => persistSystemTreeExpandedState(),
    inferMarkdownSourceFallback: (path) => (String(path || '').toLowerCase().startsWith('tab/') ? 'tabs' : 'index')
  });
  const editorShell = createComposerEditorShell({
    documentRef: composerDocument,
    requestAnimationFrameRef: (handler) => editorRuntime.requestFrame(handler),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    addWindowListener: (type, handler, options) => editorRuntime.events.onWindow(type, handler, options),
    addDocumentListener: (type, handler, options) => editorRuntime.events.onDocument(type, handler, options),
    matchesMedia: (query) => editorRuntime.matchesMedia(query),
    getViewportWidth: () => editorRuntime.getViewportWidth(),
    scrollWindowToTop: (behavior) => editorRuntime.scrollWindowToTop(behavior),
    getDocumentVisibilityState: () => (composerDocument ? composerDocument.visibilityState : ''),
    editorSessionStateStore,
    expandedEditorTreeNodeIds,
    treeText,
    getCurrentMode: () => getCurrentComposerMode(),
    getDynamicEditorTabs: () => getDynamicEditorTabs(),
    isDynamicMode,
    normalizeRelPath,
    getAllowEditorStatePersist: () => editorRuntime.getAllowEditorStatePersist(),
    persistDynamicEditorState,
    getActiveComposerFile,
    applyComposerFile,
    refreshSyncCommitPanel,
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
    persistSystemTreeExpandedState,
    scheduleEditorStatePersist,
    captureEditorContentScroll,
    restoreEditorContentScrollForMode,
    scrollEditorContentToTop,
    getEditorRailScrollTop,
    setEditorRailScrollTop,
    setEditorContentScrollByKey,
    getEditorContentScrollSnapshot
  } = editorShell;
  const editorDetailPanelController = createComposerEditorDetailPanelController({
    documentRef: composerDocument,
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
    return composerYamlPanelsController.updateDynamicTabsGroupState();
  }

  const ANNOTATE_DISCUSSION_CATEGORY_PRESETS = [
    { value: 'General', label: 'General' }
  ];

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

  const composerYamlDraftController = createComposerYamlDraftController({
    draftStore: composerDraftStore,
    getStateSlice,
    setStateSlice,
    getComposerDiff: (kind) => composerStateStore.getDiff(kind),
    computeBaselineSignature,
    prepareIndexState,
    prepareTabsState,
    cloneSiteState,
    updateUnsyncedSummary,
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id)
  });

  const SITE_FIELD_LABEL_MAP = {
    siteTitle: { i18nKey: 'editor.composer.site.fields.siteTitle' },
    siteSubtitle: { i18nKey: 'editor.composer.site.fields.siteSubtitle' },
    siteDescription: { i18nKey: 'editor.composer.site.fields.siteDescription' },
    siteKeywords: { i18nKey: 'editor.composer.site.fields.siteKeywords' },
    avatar: { i18nKey: 'editor.composer.site.fields.avatar' },
    resourceURL: { i18nKey: 'editor.composer.site.fields.resourceURL' },
    contentRoot: { i18nKey: 'editor.composer.site.fields.contentRoot' },
    profileLinks: { i18nKey: 'editor.composer.site.fields.profileLinks' },
    contentOutdatedDays: { i18nKey: 'editor.composer.site.fields.contentOutdatedDays' },
    cardCoverFallback: { i18nKey: 'editor.composer.site.fields.cardCoverFallback' },
    errorOverlay: { i18nKey: 'editor.composer.site.fields.errorOverlay' },
    pageSize: { i18nKey: 'editor.composer.site.fields.pageSize' },
    defaultLanguage: { i18nKey: 'editor.composer.site.fields.defaultLanguage' },
    themeMode: { i18nKey: 'editor.composer.site.fields.themeMode' },
    themePack: { i18nKey: 'editor.composer.site.fields.themePack' },
    themeOverride: { i18nKey: 'editor.composer.site.fields.themeOverride' },
    showAllPosts: { i18nKey: 'editor.composer.site.fields.showAllPosts' },
    landingTab: { i18nKey: 'editor.composer.site.fields.landingTab' },
    repo: { i18nKey: 'editor.composer.site.fields.repo' },
    annotate: { i18nKey: 'editor.composer.site.sections.comments.title', fallback: 'Comments' },
    assetWarnings: { i18nKey: 'editor.composer.site.sections.assets.title', fallback: 'Asset warnings' },
    __extras: { i18nKey: 'editor.composer.site.fields.extras', fallback: 'Extras' }
  };

  const composerDiffUi = createComposerDiffUi({
    documentRef: composerDocument,
    t,
    tComposer,
    tComposerDiff,
    tComposerLang,
    escapeHtml,
    siteFieldLabelMap: SITE_FIELD_LABEL_MAP,
    getStateSlice,
    getRemoteBaseline: () => composerStateStore.getRemoteBaseline(),
    getComposerDiff: (kind) => composerStateStore.getDiff(kind),
    recomputeDiff,
    getActiveComposerFile,
    animateInlineVisibility: animateComposerInlineVisibility
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
    renderOrderStatsChips
  } = composerDiffUi;
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
    return composerYamlDraftController.getDraftMeta(kind);
  }

  function hasAnyComposerDraftMeta() {
    return composerYamlDraftController.hasAnyDraftMeta();
  }

  async function requestPasswordForProtectedMarkdown(tab, options = {}) {
    const protection = getMarkdownProtectionState(tab);
    if (protection.password) return protection.password;
    const opts = options && typeof options === 'object' ? options : {};
    const password = await requestMarkdownProtectionPassword({
      title: opts.title || t('editor.composer.markdown.protection.openTitle'),
      message: opts.message || t('editor.composer.markdown.protection.openMessage'),
      confirmLabel: opts.confirmLabel || t('editor.composer.markdown.protection.unlock'),
      confirm: false
    });
    if (!password) throw new Error(t('editor.composer.markdown.protection.passwordRequiredOpen'));
    protection.password = password;
    protection.enabled = true;
    return password;
  }

  async function decryptProtectedMarkdownForTab(markdown, tab, options = {}) {
    const envelope = parseEncryptedMarkdownEnvelope(markdown);
    if (!envelope.encrypted) return normalizeMarkdownContent(markdown);
    if (!envelope.valid) {
      throw new Error(envelope.error || t('editor.composer.markdown.protection.invalidEnvelope'));
    }
    const opts = options && typeof options === 'object' ? options : {};
    const protection = getMarkdownProtectionState(tab);
    let lastError = null;
    for (;;) {
      let password = protection.password;
      if (!password) {
        password = await requestPasswordForProtectedMarkdown(tab, {
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel
        });
      }
      try {
        const decrypted = await decryptMarkdownDocument(markdown, password);
        setMarkdownProtectionState(tab, {
          enabled: true,
          password,
          encryptedRemote: opts.remote === true ? true : !!protection.encryptedRemote,
          encryptedDraft: opts.draft === true,
          passwordChanged: false,
          remoteSignature: opts.remoteSignature || protection.remoteSignature || '',
          remoteCiphertext: envelope.ciphertext || protection.remoteCiphertext || ''
        });
        return normalizeMarkdownContent(decrypted);
      } catch (err) {
        lastError = err;
        protection.password = '';
        showToast('error', t('editor.composer.markdown.protection.unlockFailed'));
      }
    }
    throw lastError || new Error(t('editor.composer.markdown.protection.unlockFailed'));
  }

  async function prepareMarkdownForProtectedStorage(tab, markdown, options = {}) {
    const text = normalizeMarkdownContent(markdown || '');
    if (!isMarkdownTabProtected(tab)) {
      return { content: text, encrypted: false };
    }
    const protection = getMarkdownProtectionState(tab);
    let password = protection.password;
    if (!password) {
      password = await requestMarkdownProtectionPassword({
        title: t('editor.composer.markdown.protection.passwordTitle'),
        message: t('editor.composer.markdown.protection.passwordMessage'),
        confirmLabel: t('editor.composer.markdown.protection.keepEncrypted'),
        confirm: false
      });
      if (!password) throw new Error(t('editor.composer.markdown.protection.passwordRequired'));
      protection.password = password;
    }
    const encrypted = await encryptMarkdownDocument(text, password);
    return {
      content: normalizeMarkdownContent(encrypted.markdown),
      encrypted: true,
      metadata: encrypted.metadata
    };
  }

  function readMarkdownDraftStore() {
    return getMarkdownDraftController().readDraftStore();
  }

  function writeMarkdownDraftStore(store) {
    getMarkdownDraftController().writeDraftStore(store);
  }

  function getMarkdownDraftEntry(path) {
    return getMarkdownDraftController().getDraftEntry(path);
  }

  function clearMarkdownDraftEntry(path) {
    getMarkdownDraftController().clearDraftEntry(path);
  }

  function restoreMarkdownDraftForTab(tab) {
    return getMarkdownDraftController().restoreDraftForTab(tab);
  }

  async function saveMarkdownDraftForTab(tab, options = {}) {
    return getMarkdownDraftController().saveDraftForTab(tab, options);
  }

  function clearMarkdownDraftForTab(tab) {
    getMarkdownDraftController().clearDraftForTab(tab);
  }

  function scheduleMarkdownDraftSave(tab) {
    getMarkdownDraftController().scheduleDraftSave(tab);
  }

  async function flushMarkdownDraft(tab) {
    return getMarkdownDraftController().flushDraft(tab);
  }

  function updateDynamicTabDirtyState(tab, options = {}) {
    getMarkdownDraftController().updateDynamicTabDirtyState(tab, options);
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

  function hasUnsavedMarkdownDrafts() {
    return getMarkdownDraftController().hasUnsavedDrafts();
  }

  function handleBeforeUnload(event) {
    getMarkdownDraftController().handleBeforeUnload(event);
  }

  editorRuntime.events.onWindow('beforeunload', handleBeforeUnload);



  function cssEscape(value) {
    try {
      const cssRef = editorRuntime.getCss();
      if (cssRef && typeof cssRef.escape === 'function') return cssRef.escape(value);
    } catch (_) {}
    return safeString(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function collectDynamicMarkdownDraftStates() {
    return getMarkdownDraftController().collectDraftStates();
  }

  function getDraftIndicatorMessage(state) {
    if (!state) return '';
    const suffix = `markdown.draftIndicator.${state}`;
    const value = tComposer(suffix);
    const fallbackKey = `editor.composer.${suffix}`;
    if (!value || value === fallbackKey) return '';
    return value;
  }

  function updateComposerDraftContainerState(container) {
    if (!container) return;
    let childState = '';
    if (container.querySelector('.ct-lang[data-draft-state="conflict"], .ci-ver-item[data-draft-state="conflict"]')) {
      childState = 'conflict';
    } else if (container.querySelector('.ct-lang[data-draft-state="dirty"], .ci-ver-item[data-draft-state="dirty"]')) {
      childState = 'dirty';
    } else {
      childState = '';
    }
    if (childState) container.setAttribute('data-child-draft', childState);
    else container.removeAttribute('data-child-draft');
  }

  function updateComposerMarkdownDraftContainerState(container) {
    updateComposerDraftContainerState(container);
  }

  function applyComposerDraftIndicatorState(el, state) {
    if (!el) return;
    const indicator = el.querySelector('.ct-draft-indicator, .ci-draft-indicator');
    const value = state ? String(state) : '';
    if (value) el.setAttribute('data-draft-state', value);
    else el.removeAttribute('data-draft-state');
    if (!indicator) return;
    if (value) {
      indicator.hidden = false;
      indicator.dataset.state = value;
      const label = getDraftIndicatorMessage(value);
      if (label) {
        indicator.setAttribute('title', label);
        indicator.setAttribute('aria-label', label);
        indicator.setAttribute('role', 'img');
      } else {
        indicator.removeAttribute('title');
        indicator.removeAttribute('aria-label');
        indicator.removeAttribute('role');
      }
    } else {
      indicator.hidden = true;
      indicator.dataset.state = '';
      indicator.removeAttribute('title');
      indicator.removeAttribute('aria-label');
      indicator.removeAttribute('role');
    }
    updateComposerDraftContainerState(el.closest('.ct-item, .ci-item'));
  }

  function updateComposerMarkdownDraftIndicators(options = {}) {
    const store = options.store || readMarkdownDraftStore();
    const overrides = options.overrideMap || collectDynamicMarkdownDraftStates();
    const normalizedPath = options.path ? normalizeRelPath(options.path) : '';
    const selectors = ['.ct-lang', '.ci-ver-item'];

    const updateElement = (el) => {
      if (!el) return;
      const raw = el.dataset ? el.dataset.mdPath : '';
      const path = normalizeRelPath(raw);
      if (path) el.dataset.mdPath = path;
      else delete el.dataset.mdPath;
      let state = '';
      if (path) {
        if (overrides && overrides.has(path)) {
          state = overrides.get(path) || '';
        } else if (store && Object.prototype.hasOwnProperty.call(store, path)) {
          state = 'saved';
        }
      }
      applyComposerDraftIndicatorState(el, state);
    };

    if (options.element) {
      updateElement(options.element);
    }

    if (normalizedPath) {
      selectors.forEach(sel => {
        const query = `${sel}[data-md-path="${cssEscape(normalizedPath)}"]`;
        $$(query).forEach(el => {
          if (options.element && el === options.element) return;
          updateElement(el);
        });
      });
      return;
    }

    if (options.element) return;

    selectors.forEach(sel => {
      $$( `${sel}[data-md-path]` ).forEach(updateElement);
    });
    refreshEditorContentTree({ preserveStructure: isDynamicMode(getCurrentComposerMode()) });
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
    return composerPublishStateService.gatherCommitPayload({
      ...options,
      setStatus: setSyncOverlayStatus
    });
  }

  function getStagingSummaryEntries(context = {}) {
    return composerPublishStateService.getStagingSummaryEntries(context);
  }

  function applyLocalPostCommitState(files = []) {
    return composerActions.applyLocalPostCommitState(files);
  }

  function rawApplyLocalPostCommitState(files = []) {
    return composerPublishStateService.applyLocalPostCommitState(files);
  }

  function getActiveSiteRepoConfig() {
    const site = getStateSlice('site');
    return resolveActiveSiteRepoConfig(site, editorRuntime.getSiteRepo());
  }

  const composerOrderDiffUi = createComposerOrderDiffUi({
    documentRef: composerDocument,
    tComposer,
    tComposerDiff,
    truncateText,
    getStateSlice,
    getRemoteBaseline: () => composerStateStore.getRemoteBaseline(),
    getComposerDiff: (kind) => composerStateStore.getDiff(kind),
    recomputeDiff,
    computeOrderDiffDetails,
    buildEntryDiffBadges,
    renderOrderStatsChips,
    renderComposerInlineSummary,
    captureElementRect,
    animateListTransition: animateComposerListTransition,
    cancelOrderMainTransition: cancelComposerOrderMainTransition,
    animateOrderMainReset: animateComposerOrderMainReset,
    animateInlineVisibility: animateComposerInlineVisibility,
    cssEscape,
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
    consoleRef: composerLogger
  });
  const {
    openComposerDiffModal,
    scheduleComposerOrderPreviewRelayout,
    updateComposerOrderPreview,
    setComposerOrderPreviewActiveKind,
    getComposerOrderPreviewActiveKind,
    closeComposerDiffModalForKind
  } = composerOrderDiffUi;

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

  const composerIndexTabsUi = createComposerIndexTabsUi({
    documentRef: composerDocument,
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    addWindowListener: (type, handler, options) => editorRuntime.events.onWindow(type, handler, options),
    addDocumentListener: (type, handler, options) => editorRuntime.events.onDocument(type, handler, options),
    getWindowScroll: () => editorRuntime.getWindowScroll(),
    alertRef: (message) => editorRuntime.showAlert(message),
    getComputedStyleRef: (element) => editorRuntime.getComputedStyle(element),
    preferredLangOrder: PREFERRED_LANG_ORDER,
    query: $,
    escapeHtml,
    tComposer,
    tComposerLang,
    tComposerEntryRow,
    treeText,
    displayLangName,
    langFlag,
    sortLangKeys,
    normalizeRelPath,
    normalizeIndexVariantList,
    getIndexVariantLocation,
    extractVersionFromPath,
    buildDefaultLanguagePathFromEntry,
    buildArticleVersionPath,
    promptArticleVersionValue,
    openMarkdownInEditor: (path, options) => openMarkdownInEditor(path, options),
    notifyComposerChange,
    broadcastLanguagePoolChange,
    updateComposerMarkdownDraftIndicators,
    updateComposerDraftContainerState,
    scheduleComposerOrderPreviewRelayout,
    getComposerOrderPreviewActiveKind,
    updateComposerOrderPreview,
    cancelListTransition,
    slideToggle
  });

  const composerSiteSettingsUi = createComposerSiteSettingsUi({
    documentRef: composerDocument,
    windowRef: composerWindow,
    performanceRef: editorRuntime.getPerformance(),
    cssRef: editorRuntime.getCss(),
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    cancelAnimationFrameRef: (id) => editorRuntime.cancelFrame(id),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    clearTimeoutRef: (id) => editorRuntime.clearTimer(id),
    fetchContent: (url, options) => editorRuntime.fetchContent(url, options),
    getComputedStyleRef: (element) => editorRuntime.getComputedStyle(element),
    preferredLangOrder: PREFERRED_LANG_ORDER,
    langCodePattern: LANG_CODE_PATTERN,
    languagePoolChangedEvent: LANGUAGE_POOL_CHANGED_EVENT,
    t,
    cloneSiteState,
    prepareSiteState,
    setStateSlice,
    composerPrefersReducedMotion,
    resolveComposerScrollDuration,
    animateComposerViewportScroll,
    cancelComposerSiteScrollAnimation,
    normalizeLangCode,
    isLanguageCode,
    getAvailableLangs,
    displayLangName,
    escapeHtml,
    broadcastLanguagePoolChange,
    notifyComposerChange,
    syncSiteEditorSingleLabelWidth,
    renderPublishTransportSettings,
    applyMode: (mode, options) => applyMode(mode, options),
    safeString,
    connectPublishPresets: CONNECT_PUBLISH_PRESETS,
    annotateDiscussionCategoryPresets: ANNOTATE_DISCUSSION_CATEGORY_PRESETS
  });

  const composerYamlPanelsController = createComposerYamlPanelsController({
    documentRef: composerDocument,
    cssEscape,
    clearInlineSlideStyles,
    getActiveState: () => composerStateStore.getActiveState(),
    buildIndexUI: (root, state) => composerIndexTabsUi.buildIndexUI(root, state),
    buildTabsUI: (root, state) => composerIndexTabsUi.buildTabsUI(root, state),
    buildSiteUI: (root, state) => composerSiteSettingsUi.buildSiteUI(root, state),
    notifyComposerChange,
    updateMarkdownDraftIndicators: () => updateComposerMarkdownDraftIndicators()
  });

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

  function rawScheduleYamlAutoDraft(kind) {
    composerYamlDraftController.scheduleAutoDraft(kind);
  }

  function rawClearDraftStorage(kind) {
    composerYamlDraftController.clearDraftStorage(kind);
  }

  function rawRecomputeYamlDiff(kind) {
    return recomputeDiff(kind);
  }

  function rawApplyYamlDiffMarkers(kind) {
    const diff = composerStateStore.getDiff(kind) || recomputeDiff(kind);
    if (kind === 'tabs') applyTabsDiffMarkers(diff);
    else if (kind === 'site') applySiteDiffMarkers(diff);
    else applyIndexDiffMarkers(diff);
    return diff;
  }

  function rawApplySiteConfigForYamlChange(kind) {
    if (kind === 'site') {
      try { applyComposerEffectiveSiteConfig(getStateSlice('site') || {}); } catch (_) {}
    }
  }

  function rawRefreshOrderPreviewForYamlChange(kind) {
    if ((kind === 'index' || kind === 'tabs') && getComposerOrderPreviewActiveKind() === kind) updateComposerOrderPreview(kind);
  }

  function rebuildIndexUI(preserveOpen = true) {
    return composerYamlPanelsController.rebuildIndexUI(preserveOpen);
  }

  function rebuildTabsUI(preserveOpen = true) {
    return composerYamlPanelsController.rebuildTabsUI(preserveOpen);
  }

  function loadDraftSnapshotsIntoState(state) {
    return composerYamlDraftController.loadDraftSnapshotsIntoState(state);
  }

  const composerYamlActions = createComposerYamlActions({
    consoleRef: composerLogger,
    confirmRef: (message) => editorRuntime.confirmAction(message),
    t,
    fetchConfigWithYamlFallback,
    fetchTrackedSiteConfig: fetchComposerTrackedSiteConfig,
    getActiveComposerFile,
    getContentRootSafe,
    prepareIndexState,
    prepareTabsState,
    prepareSiteState,
    cloneSiteState,
    deepClone,
    computeBaselineSignature,
    getComposerDiff: (kind) => composerStateStore.getDiff(kind),
    getRemoteBaseline: (kind) => composerStateStore.getRemoteBaseline(kind),
    setRemoteBaseline: (kind, value) => composerStateStore.setRemoteBaseline(kind, value),
    setStateSlice,
    applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,
    rebuildIndexUI,
    rebuildTabsUI,
    rebuildSiteUI,
    notifyComposerChange,
    showStatus,
    getDraftMeta: getComposerDraftMeta,
    clearAutoDraftTimer: (kind) => composerYamlDraftController.clearAutoDraftTimer(kind),
    clearDraftStorage,
    showDiscardConfirm: showComposerDiscardConfirm,
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay)
  });
  const {
    handleDiscard: handleComposerDiscard,
    handleRefresh: handleComposerRefresh
  } = composerYamlActions;

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
    return composerPublishStateService.getTrackedPublishContentRoot();
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

  const composerEditorTreeState = createComposerEditorTreeState({
    preferredLangs: PREFERRED_LANG_ORDER,
    normalizeRelPath,
    treeText,
    getStateSlice,
    readMarkdownDraftStore,
    collectDynamicMarkdownDraftStates,
    getMarkdownSessionController,
    getComposerDiff: (kind) => composerStateStore.getDiff(kind),
    getRemoteBaseline: (kind) => composerStateStore.getRemoteBaseline(kind),
    recomputeDiff,
    getComposerDraftMeta,
    hasSystemUpdateEntries: () => composerSystemThemeBridge.hasSystemUpdateEntries(),
    hasThemeEntries: () => composerSystemThemeBridge.hasThemeEntries()
  });
  const {
    buildCurrentEditorTree
  } = composerEditorTreeState;

  const editorFileTreeUi = createEditorFileTreeUi({
    documentRef: composerDocument,
    windowRef: composerWindow,
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay),
    treeText,
    getEditorContentTree: () => editorContentTreeController.getTree(),
    getActiveNodeId: () => editorContentTreeController.getActiveNodeId(),
    expandedNodeIds: editorContentTreeController.getExpandedNodeIds(),
    handleEditorTreeSelection: (nodeId) => editorContentTreeController.handleSelection(nodeId),
    persistSystemTreeExpandedState: () => persistSystemTreeExpandedState(),
    refreshEditorContentTree: (options) => editorContentTreeController.refresh(options),
    scheduleEditorStatePersist: () => scheduleEditorStatePersist()
  });

  const editorStructurePanelUi = createEditorStructurePanelUi({
    documentRef: composerDocument,
    windowRef: composerWindow,
    consoleRef: composerLogger,
    requestAnimationFrameRef: (callback) => editorRuntime.requestFrame(callback),
    alertRef: (message) => editorRuntime.showAlert(message),
    populateEditorLanguageSelect: () => editorRuntime.populateEditorLanguageSelect(),
    emitLanguageControlMounted: () => editorRuntime.emitEditorLanguageControlMounted(),
    preferredLangOrder: PREFERRED_LANG_ORDER,
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
    refreshEditorContentTree: (options) => editorContentTreeController.refresh(options),
    setEditorDetailPanelMode: (mode) => setEditorDetailPanelMode(mode),
    animateEditorStructurePanelContent: (panel) => animateEditorStructurePanelContent(panel),
    setActiveEditorTreeNodeId: (nodeId) => { editorContentTreeController.setActiveNodeId(nodeId); },
    handleEditorTreeSelection: (nodeId) => editorContentTreeController.handleSelection(nodeId),
    openMarkdownInEditor: (path, options) => openMarkdownInEditor(path, options),
    addComposerEntry: (kind, anchor) => addComposerEntry(kind, anchor),
    deleteEditorEntry: (source, key) => deleteEditorEntry(source, key),
    addEditorLanguage: (source, key, lang) => addEditorLanguage(source, key, lang),
    removeEditorLanguage: (source, key, lang) => removeEditorLanguage(source, key, lang),
    addEditorVersion: (key, lang, anchor) => addEditorVersion(key, lang, anchor),
    removeEditorVersion: (key, lang, index) => removeEditorVersion(key, lang, index),
    moveEditorVersionTo: (key, lang, from, to) => moveEditorVersionTo(key, lang, from, to),
    restoreDeletedEditorTreeNode: (node) => restoreDeletedEditorTreeNode(node)
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

  function selectEditorTreeNodeByPath(path, options = {}) {
    return editorContentTreeController.selectNodeByPath(path, options);
  }

  function selectEditorTreeNodeForTab(tab, options = {}) {
    return editorContentTreeController.selectNodeForTab(tab, options);
  }

  function rawRefreshEditorContentTree(options = {}) {
    editorContentTreeController.refresh(options);
  }

  function refreshEditorContentTree(options = {}) {
    return composerActions.refreshEditorContentTree(options);
  }

  function handleEditorTreeSelection(nodeId) {
    editorContentTreeController.handleSelection(nodeId);
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
    return composerYamlPanelsController.rebuildSiteUI();
  }

  function start() {
    composerServiceLifecycle.assertReady();
    composerActions.assertReady();
    initializeComposerApp({
      documentRef: composerDocument,
      onDocumentReady: editorRuntime.onDocumentReady,
      setActiveComposerState: (state) => {
        composerStateStore.setActiveState(state);
      },
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
        ensureSiteRepo: () => editorRuntime.ensureSiteRepo(),
        windowRef: composerWindow,
        consoleRef: composerLogger,
        t,
        fetchTrackedSiteConfig: fetchComposerTrackedSiteConfig,
        applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,
        fetchConfigWithYamlFallback,
        prepareSiteState,
        prepareIndexState,
        prepareTabsState,
        cloneSiteState,
        deepClone,
        setRemoteBaseline: (kind, value) => {
          composerStateStore.setRemoteBaseline(kind, value);
        },
        getActiveDynamicTab,
        updateMarkdownPushButton,
        showStatus
      },
      workspace: {
        documentRef: composerDocument,
        windowRef: composerWindow,
        getLocation: () => editorRuntime.getLocation(),
        t,
        loadDraftSnapshotsIntoState,
        applyInferredRepoConfig,
        inferRepoConfigFromGitHubPagesUrl,
        applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,
        updateMarkdownPushButton,
        getActiveDynamicTab,
        showStatus,
        bindWorkspaceUi: () => bindComposerWorkspaceUi({
          documentRef: composerDocument,
          consoleRef: composerLogger,
          mountEditorSystemPanels,
          initEditorOverlay,
          initEditorRailResize,
          initMobileEditorRail,
          bindEditorStatePersistenceListeners,
          openEditorOverlay,
          applyMode,
          initSystemThemeBridge: () => composerSystemThemeBridge.init(),
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
        }),
        buildIndexUI: (root, state) => composerIndexTabsUi.buildIndexUI(root, state),
        buildTabsUI: (root, state) => composerIndexTabsUi.buildTabsUI(root, state),
        buildSiteUI: (root, state) => composerSiteSettingsUi.buildSiteUI(root, state),
        notifyComposerChange,
        refreshEditorContentTree,
        restoreDynamicEditorState,
        applyMode,
        setAllowEditorStatePersist: (value) => editorRuntime.setAllowEditorStatePersist(value),
        persistDynamicEditorState,
        setTimeoutRef: (handler, delay) => editorRuntime.setTimer(handler, delay)
      }
    });

    injectComposerRuntimeStyles({ documentRef: composerDocument });
  }

  return { start };
}

createComposerController().start();
