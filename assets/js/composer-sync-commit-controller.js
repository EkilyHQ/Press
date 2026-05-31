import {
  refreshSyncCommitPanelView,
  scheduleSyncCommitPanelRefreshView
} from './composer-sync-panel.js';
import { EDITOR_SHELL_IDS } from './editor-shell-contract.js';

function noop() {}

export function createComposerSyncCommitController({
  documentRef = null,
  t = (key) => key,
  getCurrentMode = () => null,
  computeUnsyncedSummary = () => [],
  gatherCommitPayload = async () => ({ files: [] }),
  resolvePublishTransport = () => ({ type: 'pat' }),
  getMatchingConnectPublishGrant = () => null,
  renderFineGrainedTokenSettings = noop,
  appendGithubCommitSummary = noop,
  getVisibleFineGrainedTokenInput = () => null,
  getFineGrainedTokenValue = () => '',
  setCachedFineGrainedToken = noop,
  ensureConnectPublishGrant = async () => {},
  getActiveSiteRepoConfig = () => ({}),
  showToast = noop,
  performConnectGithubCommit = async () => {},
  performDirectGithubCommit = async () => {},
  switchToPatFallbackAndFocusToken = noop,
  setTimeoutRef = null,
  clearTimeoutRef = null
} = {}) {
  let renderSeq = 0;
  let refreshTimer = 0;

  function appendPublishTransportStatus(host) {
    if (!host || !documentRef || typeof documentRef.createElement !== 'function') return;
    const transport = resolvePublishTransport();
    const note = documentRef.createElement('p');
    note.className = 'muted sync-publish-transport';
    if (transport.type === 'connect') {
      if (transport.invalid) {
        note.textContent = t('editor.composer.github.modal.connectInvalidUrl');
      } else {
        const cached = getMatchingConnectPublishGrant(transport.connect);
        note.textContent = cached
          ? t('editor.composer.github.modal.connectConnected')
          : t('editor.composer.github.modal.connectReady');
      }
    } else {
      note.textContent = t('editor.composer.github.modal.subtitle');
    }
    host.appendChild(note);
  }

  function getSyncCommitPanelHost() {
    if (!documentRef || typeof documentRef.getElementById !== 'function') return null;
    const syncPanel = documentRef.getElementById(EDITOR_SHELL_IDS.modeSync);
    if (!syncPanel) return null;
    let panel = documentRef.getElementById('syncCommitPanel');
    if (!panel) {
      panel = documentRef.createElement('section');
      panel.id = 'syncCommitPanel';
      panel.className = 'sync-commit-panel';
      syncPanel.appendChild(panel);
    }
    return panel;
  }

  async function refresh(options = {}) {
    return refreshSyncCommitPanelView(options, {
      documentRef,
      t,
      getSyncCommitPanelHost,
      nextRenderId: () => {
        renderSeq += 1;
        return renderSeq;
      },
      getRenderId: () => renderSeq,
      computeUnsyncedSummary,
      gatherCommitPayload,
      appendPublishTransportStatus,
      resolvePublishTransport,
      renderFineGrainedTokenSettings,
      appendGithubCommitSummary,
      getVisibleFineGrainedTokenInput,
      getFineGrainedTokenValue,
      setCachedFineGrainedToken,
      ensureConnectPublishGrant,
      getActiveSiteRepoConfig,
      showToast,
      performConnectGithubCommit,
      performDirectGithubCommit,
      switchToPatFallbackAndFocusToken,
      refreshSyncCommitPanel: refresh
    });
  }

  function scheduleRefresh() {
    refreshTimer = scheduleSyncCommitPanelRefreshView({
      currentMode: getCurrentMode(),
      timer: refreshTimer,
      setTimer: (timer) => {
        refreshTimer = timer;
      },
      refreshSyncCommitPanel: refresh,
      setTimeoutRef,
      clearTimeoutRef
    });
    return refreshTimer;
  }

  return {
    refresh,
    scheduleRefresh,
    getSyncCommitPanelHost,
    appendPublishTransportStatus
  };
}
