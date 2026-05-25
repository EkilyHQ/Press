import { createComposerSyncCommitController } from './composer-sync-commit-controller.js';
import { createSyncOverlayController } from './composer-sync-overlay.js';
import { createPublishTransportSettingsUi } from './composer-publish-settings-ui.js';
import { createPublishSummaryRenderer } from './composer-publish-summary.js';
import { createComposerPublishFlow } from './composer-publish-flow.js';
import { createPublishSettingsStore } from './publish/settings-store.js';

function noop() {}

export function createComposerPublishService(options = {}) {
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const t = typeof options.t === 'function' ? options.t : (key) => key;
  const createPublishSettingsStoreRef = options.createPublishSettingsStore || createPublishSettingsStore;
  const createSyncOverlayControllerRef = options.createSyncOverlayController || createSyncOverlayController;
  const createPublishTransportSettingsUiRef = options.createPublishTransportSettingsUi || createPublishTransportSettingsUi;
  const createPublishSummaryRendererRef = options.createPublishSummaryRenderer || createPublishSummaryRenderer;
  const createComposerPublishFlowRef = options.createComposerPublishFlow || createComposerPublishFlow;
  const createComposerSyncCommitControllerRef = options.createComposerSyncCommitController || createComposerSyncCommitController;
  const fetchImpl = typeof options.fetchContent === 'function' ? options.fetchContent : null;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function' ? options.requestAnimationFrameRef : null;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function' ? options.setTimeoutRef : null;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function' ? options.clearTimeoutRef : null;
  const matchesMedia = typeof options.matchesMedia === 'function' ? options.matchesMedia : () => false;

  const publishSettingsStore = createPublishSettingsStoreRef({
    windowRef,
    scopeKey: options.scopeKey || ((key) => key)
  });

  let syncCommitController = null;
  function getSyncCommitController() {
    if (!syncCommitController) throw new Error('Sync commit controller is not initialized');
    return syncCommitController;
  }

  async function refreshSyncCommitPanel(refreshOptions = {}) {
    return getSyncCommitController().refresh(refreshOptions);
  }

  function scheduleSyncCommitPanelRefresh() {
    return getSyncCommitController().scheduleRefresh();
  }

  const syncOverlayController = createSyncOverlayControllerRef({
    documentRef,
    translate: t,
    requestAnimationFrameRef,
    setTimeoutRef,
    clearTimeoutRef
  });
  const {
    show: showSyncOverlay,
    hide: hideSyncOverlay,
    setMessage: setSyncOverlayMessage,
    setStatus: setSyncOverlayStatus,
    setCancelHandler: setSyncOverlayCancelHandler,
    startRemoteWatcher: startRemoteSyncWatcher
  } = syncOverlayController;

  const publishTransportUi = createPublishTransportSettingsUiRef({
    documentRef,
    t,
    publishSettingsStore,
    getActiveSiteRepoConfig: options.getActiveSiteRepoConfig || (() => ({})),
    applyMode: options.applyMode || noop,
    showEditorSystemPanel: options.showEditorSystemPanel || noop,
    refreshSyncCommitPanel,
    scheduleSyncCommitPanelRefresh,
    requestAnimationFrameRef,
    setTimeoutRef
  });
  const {
    setCachedFineGrainedToken,
    clearCachedFineGrainedToken,
    getFineGrainedTokenValue,
    getCachedConnectPublishGrant,
    setCachedConnectPublishGrant,
    clearCachedConnectPublishGrant,
    getMatchingConnectPublishGrant,
    resolvePublishTransport,
    getVisibleFineGrainedTokenInput,
    renderFineGrainedTokenSettings,
    renderPublishTransportSettings,
    switchToPatFallbackAndFocusToken
  } = publishTransportUi;

  const publishSummaryRenderer = createPublishSummaryRendererRef({
    documentRef,
    t,
    matchesMedia,
    setTimeoutRef
  });
  const {
    describeSummaryEntry,
    appendGithubCommitSummary
  } = publishSummaryRenderer;

  const publishFlow = createComposerPublishFlowRef({
    windowRef,
    documentRef,
    fetchImpl,
    t,
    getActiveSiteRepoConfig: options.getActiveSiteRepoConfig || (() => ({})),
    getTrackedPublishContentRoot: options.getTrackedPublishContentRoot || (() => 'wwwroot'),
    gatherCommitPayload: options.gatherCommitPayload || (async () => ({ files: [] })),
    applyLocalPostCommitState: options.applyLocalPostCommitState || noop,
    setTimeoutRef,
    getCachedConnectPublishGrant,
    setCachedConnectPublishGrant,
    clearCachedConnectPublishGrant,
    clearCachedFineGrainedToken,
    showSyncOverlay,
    hideSyncOverlay,
    setSyncOverlayStatus,
    setSyncOverlayMessage,
    setSyncOverlayCancelHandler,
    showToast: options.showToast || noop,
    describeSummaryEntry,
    switchToPatFallbackAndFocusToken,
    setGitHubCommitInFlight: options.setGitHubCommitInFlight || noop,
    consoleRef: options.consoleRef || null
  });
  const {
    performDirectGithubCommit,
    performConnectGithubCommit,
    ensureConnectPublishGrant
  } = publishFlow;

  syncCommitController = createComposerSyncCommitControllerRef({
    documentRef,
    t,
    getCurrentMode: options.getCurrentMode || (() => null),
    computeUnsyncedSummary: options.computeUnsyncedSummary || (() => []),
    gatherCommitPayload: options.gatherCommitPayload || (async () => ({ files: [] })),
    resolvePublishTransport,
    getMatchingConnectPublishGrant,
    renderFineGrainedTokenSettings,
    appendGithubCommitSummary,
    getVisibleFineGrainedTokenInput,
    getFineGrainedTokenValue,
    setCachedFineGrainedToken,
    ensureConnectPublishGrant,
    getActiveSiteRepoConfig: options.getActiveSiteRepoConfig || (() => ({})),
    showToast: options.showToast || noop,
    performConnectGithubCommit,
    performDirectGithubCommit,
    switchToPatFallbackAndFocusToken,
    setTimeoutRef,
    clearTimeoutRef
  });

  return {
    setSyncOverlayStatus,
    startRemoteSyncWatcher,
    renderPublishTransportSettings,
    refreshSyncCommitPanel,
    scheduleSyncCommitPanelRefresh
  };
}
