import { createComposerSyncCommitController } from './composer-sync-commit-controller.js?v=press-system-v3.4.50';
import { createSyncOverlayController } from './composer-sync-overlay.js?v=press-system-v3.4.50';
import { createPublishTransportSettingsUi } from './composer-publish-settings-ui.js?v=press-system-v3.4.50';
import { createPublishSummaryRenderer } from './composer-publish-summary.js?v=press-system-v3.4.50';
import { createComposerPublishFlow } from './composer-publish-flow.js?v=press-system-v3.4.50';
import { createPublishSettingsStore } from './publish/settings-store.js?v=press-system-v3.4.50';

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
    windowRef,
    translate: t
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
    windowRef,
    t,
    publishSettingsStore,
    getActiveSiteRepoConfig: options.getActiveSiteRepoConfig || (() => ({})),
    applyMode: options.applyMode || noop,
    showEditorSystemPanel: options.showEditorSystemPanel || noop,
    refreshSyncCommitPanel,
    scheduleSyncCommitPanelRefresh
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
    windowRef,
    t
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
    windowRef,
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
    switchToPatFallbackAndFocusToken
  });

  return {
    setSyncOverlayStatus,
    startRemoteSyncWatcher,
    renderPublishTransportSettings,
    refreshSyncCommitPanel,
    scheduleSyncCommitPanelRefresh
  };
}
