import { createComposerPublishStateService } from './composer-publish-state-service.js';
import { createComposerPublishService } from './composer-publish-service.js';
import { createComposerRemoteSyncController } from './composer-remote-sync.js';

const noop = () => {};

export function createComposerPublishSyncFeature(options = {}) {
  const editorRuntime = options.editorRuntime || {};
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const consoleRef = options.consoleRef || { error: noop, warn: noop };
  const t = typeof options.t === 'function' ? options.t : (key) => String(key || '');
  const showToast = typeof options.showToast === 'function' ? options.showToast : noop;

  const composerPublishService = createComposerPublishService({
    documentRef,
    windowRef,
    t,
    fetchContent: options.fetchContent,
    requestAnimationFrameRef: options.requestAnimationFrameRef,
    setTimeoutRef: options.setTimeoutRef,
    clearTimeoutRef: options.clearTimeoutRef,
    matchesMedia: options.matchesMedia,
    scopeKey: options.scopeKey,
    getActiveSiteRepoConfig: options.getActiveSiteRepoConfig,
    getTrackedPublishContentRoot: options.getTrackedPublishContentRoot,
    gatherCommitPayload: options.gatherCommitPayload,
    applyLocalPostCommitState: options.applyLocalPostCommitState,
    getCurrentMode: options.getCurrentMode,
    computeUnsyncedSummary: options.computeUnsyncedSummary,
    applyMode: options.applyMode,
    showEditorSystemPanel: options.showEditorSystemPanel,
    showToast,
    consoleRef,
    setGitHubCommitInFlight: options.setGitHubCommitInFlight
  });
  const {
    setSyncOverlayStatus,
    startRemoteSyncWatcher,
    renderPublishTransportSettings,
    refreshSyncCommitPanel,
    scheduleSyncCommitPanelRefresh
  } = composerPublishService;

  const composerPublishStateService = createComposerPublishStateService({
    safeString: options.safeString,
    normalizeRelPath: options.normalizeRelPath,
    normalizeMarkdownContent: options.normalizeMarkdownContent,
    isIndexMetadataObject: options.isIndexMetadataObject,
    cloneIndexMetadataValue: options.cloneIndexMetadataValue,
    getIndexVariantLocation: options.getIndexVariantLocation,
    normalizeIndexVariantList: options.normalizeIndexVariantList,
    prepareIndexState: options.prepareIndexState,
    deepClone: options.deepClone,
    sortLangKeys: options.sortLangKeys,
    extractVersionFromPath: options.extractVersionFromPath,
    findDynamicTabByPath: options.findDynamicTabByPath,
    getLockedEncryptedMarkdownDraft: options.getLockedEncryptedMarkdownDraft,
    getMarkdownProtectionState: options.getMarkdownProtectionState,
    getContentRootSafe: options.getContentRootSafe,
    getDynamicEditorTabs: options.getDynamicEditorTabs,
    flushMarkdownDraft: options.flushMarkdownDraft,
    getStateSlice: options.getStateSlice,
    getRemoteBaseline: options.getRemoteBaseline,
    getComposerDiffCache: options.getComposerDiffCache,
    setComposerDiff: options.setComposerDiff,
    collectCurrentRepositoryMarkdownAssetReferences: options.collectCurrentRepositoryMarkdownAssetReferences,
    collectUnsyncedMarkdownEntries: options.collectUnsyncedMarkdownEntries,
    getPrimaryEditorApi: options.getPrimaryEditorApi,
    getActiveDynamicTab: options.getActiveDynamicTab,
    getCurrentMode: options.getCurrentMode,
    readMarkdownDraftStore: options.readMarkdownDraftStore,
    isEncryptedMarkdownDraftEntry: options.isEncryptedMarkdownDraftEntry,
    prepareMarkdownForProtectedStorage: options.prepareMarkdownForProtectedStorage,
    listMarkdownAssets: options.listMarkdownAssets,
    isAssetReferencedInContent: options.isAssetReferencedInContent,
    removeMarkdownAsset: options.removeMarkdownAsset,
    toIndexYaml: options.toIndexYaml,
    toTabsYaml: options.toTabsYaml,
    toSiteYaml: options.toSiteYaml,
    setStateSlice: options.setStateSlice,
    computeIndexDiff: options.computeIndexDiff,
    recomputeDiff: options.recomputeDiff,
    listMarkdownAssetDeletions: options.listMarkdownAssetDeletions,
    draftHasAssetDeletions: options.draftHasAssetDeletions,
    textWithFallback: options.textWithFallback,
    getRemoteBaselineSite: options.getRemoteBaselineSite,
    cloneSiteState: options.cloneSiteState,
    fetchContent: options.fetchContent,
    getLocationOrigin: options.getLocationOrigin,
    getDocumentLang: options.getDocumentLang,
    consoleRef,
    setRemoteBaselineSlice: options.setRemoteBaselineSlice,
    notifyComposerChange: options.notifyComposerChange,
    clearDraftStorage: options.clearDraftStorage,
    applyComposerEffectiveSiteConfig: options.applyComposerEffectiveSiteConfig,
    updateDynamicTabDirtyState: options.updateDynamicTabDirtyState,
    updateComposerMarkdownDraftIndicators: options.updateComposerMarkdownDraftIndicators,
    updateMarkdownPushButton: options.updateMarkdownPushButton,
    updateMarkdownDiscardButton: options.updateMarkdownDiscardButton,
    updateMarkdownSaveButton: options.updateMarkdownSaveButton,
    updateMarkdownProtectionButton: options.updateMarkdownProtectionButton,
    clearMarkdownDraftEntry: options.clearMarkdownDraftEntry,
    clearMarkdownAssetsForPath: options.clearMarkdownAssetsForPath,
    computeTextSignature: options.computeTextSignature,
    setMarkdownProtectionState: options.setMarkdownProtectionState,
    createMarkdownProtectionState: options.createMarkdownProtectionState,
    setDynamicTabStatus: options.setDynamicTabStatus,
    scheduleMarkdownDraftSave: options.scheduleMarkdownDraftSave,
    removeMarkdownAssetDeletion: options.removeMarkdownAssetDeletion,
    updateUnsyncedSummary: options.updateUnsyncedSummary,
    registerExternalStagingProviders: options.registerExternalStagingProviders,
    basenameFromPath: options.basenameFromPath
  });

  const remoteSyncController = createComposerRemoteSyncController({
    t,
    fetchContent: options.fetchContent,
    getContentRootSafe: options.getContentRootSafe,
    normalizeRelPath: options.normalizeRelPath,
    normalizeMarkdownContent: options.normalizeMarkdownContent,
    computeTextSignature: options.computeTextSignature,
    parseEncryptedMarkdownEnvelope: options.parseEncryptedMarkdownEnvelope,
    createMarkdownProtectionState: options.createMarkdownProtectionState,
    getMarkdownProtectionState: options.getMarkdownProtectionState,
    setMarkdownProtectionState: options.setMarkdownProtectionState,
    isMarkdownTabProtected: options.isMarkdownTabProtected,
    hasMarkdownDraftContent: options.hasMarkdownDraftContent,
    setDynamicTabStatus: options.setDynamicTabStatus,
    updateDynamicTabDirtyState: options.updateDynamicTabDirtyState,
    updateComposerMarkdownDraftIndicators: options.updateComposerMarkdownDraftIndicators,
    getCurrentMode: options.getCurrentMode,
    getPrimaryEditorApi: options.getPrimaryEditorApi,
    basenameFromPath: options.basenameFromPath,
    startRemoteSyncWatcher,
    showToast,
    updateMarkdownPushButton: options.updateMarkdownPushButton,
    updateMarkdownDiscardButton: options.updateMarkdownDiscardButton,
    updateMarkdownSaveButton: options.updateMarkdownSaveButton,
    updateMarkdownProtectionButton: options.updateMarkdownProtectionButton,
    parseYAML: options.parseYAML,
    prepareIndexState: options.prepareIndexState,
    prepareTabsState: options.prepareTabsState,
    prepareSiteState: options.prepareSiteState,
    cloneSiteState: options.cloneSiteState,
    deepClone: options.deepClone,
    setRemoteBaseline: options.setRemoteBaseline,
    notifyComposerChange: options.notifyComposerChange,
    clearDraftStorage: options.clearDraftStorage,
    updateUnsyncedSummary: options.updateUnsyncedSummary,
    closeComposerDiffModalForKind: options.closeComposerDiffModalForKind
  });
  const {
    startMarkdownSyncWatcher,
    fetchComposerRemoteSnapshot,
    applyComposerRemoteSnapshot,
    startComposerSyncWatcher
  } = remoteSyncController;

  function gatherCommitPayload(payloadOptions = {}) {
    return composerPublishStateService.gatherCommitPayload({
      ...payloadOptions,
      setStatus: setSyncOverlayStatus
    });
  }

  return {
    setSyncOverlayStatus,
    startRemoteSyncWatcher,
    renderPublishTransportSettings,
    refreshSyncCommitPanel,
    scheduleSyncCommitPanelRefresh,
    getTrackedPublishContentRoot: () => composerPublishStateService.getTrackedPublishContentRoot(),
    gatherCommitPayload,
    getStagingSummaryEntries: (context = {}) => composerPublishStateService.getStagingSummaryEntries(context),
    rawApplyLocalPostCommitState: (files = []) => composerPublishStateService.applyLocalPostCommitState(files),
    startMarkdownSyncWatcher,
    fetchComposerRemoteSnapshot,
    applyComposerRemoteSnapshot,
    startComposerSyncWatcher
  };
}
