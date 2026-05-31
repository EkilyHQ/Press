import { ensurePublishGrant, publishCommit as publishStagedCommit } from './publish/commit-service.js';
import { waitForRemotePropagation as waitForPublishedFiles } from './publish/propagation-watcher.js';
import {
  createPublishReceipt,
  createPublishReceiptStore,
  PUBLISH_STATES,
  transitionPublishReceipt
} from './publish/publish-receipt.js';

function resolveAmbientFunction(name) {
  try {
    const scope = typeof globalThis === 'object' ? globalThis : null;
    const value = scope ? scope[name] : null;
    return typeof value === 'function' ? value.bind(scope) : null;
  } catch (_) {
    return null;
  }
}

function resolveReceiptStorage(windowRef) {
  try {
    if (windowRef && windowRef.localStorage) return windowRef.localStorage;
  } catch (_) {
    return null;
  }
  try {
    const scope = typeof globalThis === 'object' ? globalThis : null;
    return scope && scope.localStorage ? scope.localStorage : null;
  } catch (_) {
    return null;
  }
}

export function createComposerPublishFlow({
  windowRef = null,
  documentRef = null,
  fetchImpl = null,
  t = (key) => key,
  getActiveSiteRepoConfig = () => ({}),
  getTrackedPublishContentRoot = () => 'wwwroot',
  gatherCommitPayload = async () => ({ files: [] }),
  applyLocalPostCommitState = () => {},
  setTimeoutRef = null,
  getCachedConnectPublishGrant = () => null,
  setCachedConnectPublishGrant = () => {},
  clearCachedConnectPublishGrant = () => {},
  clearCachedFineGrainedToken = () => {},
  showSyncOverlay = () => {},
  hideSyncOverlay = () => {},
  setSyncOverlayStatus = () => {},
  setSyncOverlayMessage = () => {},
  setSyncOverlayCancelHandler = () => {},
  showToast = () => {},
  describeSummaryEntry = (entry) => entry && (entry.label || entry.path || entry.kind) || '',
  switchToPatFallbackAndFocusToken = () => {},
  setGitHubCommitInFlight = () => {},
  publishReceiptStore = null,
  onPublishReceipt = () => {},
  createPublishRunId = null,
  now = null,
  consoleRef = null
} = {}) {
  const fetchRef = typeof fetchImpl === 'function'
    ? fetchImpl
    : resolveAmbientFunction('fetch');
  const timerRef = typeof setTimeoutRef === 'function'
    ? setTimeoutRef
    : resolveAmbientFunction('setTimeout');
  const sleepMs = (ms) => new Promise((resolve) => {
    const timeout = Math.max(0, Number(ms) || 0);
    if (timerRef) timerRef(resolve, timeout);
    else resolve();
  });
  const receiptStore = publishReceiptStore || createPublishReceiptStore({
    storage: resolveReceiptStorage(windowRef)
  });

  function savePublishReceipt(receipt) {
    if (!receipt) return;
    if (receiptStore && typeof receiptStore.save === 'function') receiptStore.save(receipt);
    if (typeof onPublishReceipt === 'function') onPublishReceipt(receipt);
  }

  async function waitForRemotePropagation(files = []) {
    return waitForPublishedFiles(files, {
      fetchImpl: fetchRef,
      contentRoot: getTrackedPublishContentRoot(),
      sleepMs,
      setStatus: setSyncOverlayStatus,
      setCancelHandler: setSyncOverlayCancelHandler
    });
  }

  async function performPublishCommit(transport, summaryEntries = []) {
    const { owner, name, branch } = getActiveSiteRepoConfig();
    if (!owner || !name) {
      throw new Error('GitHub repository information is missing in site.yaml.');
    }

    setGitHubCommitInFlight(true);

    showSyncOverlay({
      title: 'Synchronizing with GitHub…',
      message: 'Preparing commit…',
      status: 'Gathering local changes…',
      cancelable: false
    });

    let connectFallbackActionAvailable = false;
    let publishReceipt = null;
    const setPublishReceiptState = (state, patch = {}) => {
      if (!publishReceipt) return;
      publishReceipt = transitionPublishReceipt(publishReceipt, state, patch, { now });
      savePublishReceipt(publishReceipt);
    };
    const handlePublishStatus = (message) => {
      setSyncOverlayStatus(message);
    };
    const handlePublishState = (state) => {
      setPublishReceiptState(state);
    };
    try {
      const { files } = await gatherCommitPayload({ showSeoStatus: true });
      if (!files.length) {
        hideSyncOverlay();
        showToast('info', t('editor.toasts.noPendingChanges'));
        return;
      }

      const headline = `chore: sync ${files.length === 1 ? 'draft' : 'drafts'} via Press`;
      const repo = { owner, name, branch };
      const contentRoot = getTrackedPublishContentRoot();
      publishReceipt = createPublishReceipt({
        repo,
        transport,
        contentRoot,
        headline,
        files,
        now,
        runId: typeof createPublishRunId === 'function'
          ? createPublishRunId({ repo, transport, headline, files })
          : null
      });
      savePublishReceipt(publishReceipt);
      let publishResult = null;
      if (transport && transport.type === 'connect') {
        connectFallbackActionAvailable = true;
        publishResult = await publishStagedCommit({
          transport,
          repo,
          headline,
          files,
          contentRoot,
          getCachedGrant: getCachedConnectPublishGrant,
          setCachedGrant: setCachedConnectPublishGrant,
          windowRef,
          documentRef,
          fetchImpl: fetchRef,
          translate: t,
          onStatus: handlePublishStatus,
          onPublishState: handlePublishState
        });
        connectFallbackActionAvailable = false;
      } else {
        publishResult = await publishStagedCommit({
          transport,
          repo,
          headline,
          files,
          fetchImpl: fetchRef,
          translate: t,
          onStatus: handlePublishStatus,
          onPublishState: handlePublishState
        });
      }

      setPublishReceiptState(PUBLISH_STATES.COMMITTED, { publishResult });
      setPublishReceiptState(PUBLISH_STATES.APPLYING_LOCAL_STATE);
      setSyncOverlayStatus('Updating editor state…');
      applyLocalPostCommitState(files);

      const fileCount = files.length;
      const summaryLabel = fileCount === 1 ? describeSummaryEntry(summaryEntries[0] || files[0]) : `${fileCount} files`;
      setPublishReceiptState(PUBLISH_STATES.OBSERVING_PROPAGATION);
      setSyncOverlayMessage(`Commit accepted for ${summaryLabel}. Press recorded a local publish receipt and is checking the live site… This can take a few minutes. If you stop waiting, the commit stays on GitHub but the live site might not show the changes yet.`);
      const propagationResult = await waitForRemotePropagation(files);
      setPublishReceiptState(propagationResult && propagationResult.canceled
        ? PUBLISH_STATES.CANCELED
        : propagationResult && propagationResult.timedOut
          ? PUBLISH_STATES.TIMED_OUT
          : PUBLISH_STATES.OBSERVED, {
        propagation: propagationResult
      });

      hideSyncOverlay();
      if (propagationResult && propagationResult.canceled) {
        showToast('info', t('editor.toasts.siteWaitStopped'));
      } else if (propagationResult && propagationResult.timedOut) {
        showToast('warning', t('editor.toasts.siteWaitTimedOut'));
      } else {
        showToast('success', t('editor.toasts.commitSuccess', { count: fileCount }));
      }
      return publishReceipt;
    } catch (err) {
      if (transport && transport.type === 'connect' && err && err.pendingPublishResult) {
        connectFallbackActionAvailable = false;
        setPublishReceiptState(PUBLISH_STATES.TIMED_OUT, {
          publishResult: err.pendingPublishResult,
          error: err
        });
        hideSyncOverlay();
        showToast('warning', err.message || t('editor.composer.github.modal.connectPublishTimedOut'), {
          duration: 9000
        });
        return publishReceipt;
      }
      setPublishReceiptState(PUBLISH_STATES.FAILED, { error: err });
      hideSyncOverlay();
      let message = err && err.message ? err.message : t('editor.toasts.githubCommitFailed');
      if (err && err.status === 401) {
        if (transport && transport.type === 'connect') {
          clearCachedConnectPublishGrant();
        } else {
          clearCachedFineGrainedToken();
          message = t('editor.toasts.githubTokenRejected');
        }
      }
      if (consoleRef && typeof consoleRef.error === 'function') {
        consoleRef.error('Press GitHub commit failed', err);
      }
      const toastOptions = { duration: 5200 };
      if (transport && transport.type === 'connect' && connectFallbackActionAvailable) {
        toastOptions.duration = 9000;
        toastOptions.action = {
          label: t('editor.composer.github.modal.connectFallback'),
          onClick: (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            switchToPatFallbackAndFocusToken();
          }
        };
      }
      showToast('error', message, toastOptions);
      return publishReceipt;
    } finally {
      setGitHubCommitInFlight(false);
    }
  }

  async function performDirectGithubCommit(token, summaryEntries = []) {
    return performPublishCommit({
      type: 'pat',
      token
    }, summaryEntries);
  }

  async function performConnectGithubCommit(connect, summaryEntries = []) {
    return performPublishCommit({
      type: 'connect',
      connect
    }, summaryEntries);
  }

  async function ensureConnectPublishGrant(connect, repo) {
    return ensurePublishGrant({
      connect,
      repo,
      getCachedGrant: getCachedConnectPublishGrant,
      setCachedGrant: setCachedConnectPublishGrant,
      windowRef,
      documentRef,
      translate: t
    });
  }

  return {
    waitForRemotePropagation,
    performDirectGithubCommit,
    performConnectGithubCommit,
    ensureConnectPublishGrant
  };
}
