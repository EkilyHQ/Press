import { ensurePublishGrant, publishCommit as publishStagedCommit } from './publish/commit-service.js?v=press-system-v3.4.52';
import { waitForRemotePropagation as waitForPublishedFiles } from './publish/propagation-watcher.js?v=press-system-v3.4.52';

function resolveAmbientFunction(name) {
  try {
    const scope = typeof globalThis === 'object' ? globalThis : null;
    const value = scope ? scope[name] : null;
    return typeof value === 'function' ? value.bind(scope) : null;
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
    try {
      const { files } = await gatherCommitPayload({ showSeoStatus: true });
      if (!files.length) {
        hideSyncOverlay();
        showToast('info', t('editor.toasts.noPendingChanges'));
        return;
      }

      const headline = `chore: sync ${files.length === 1 ? 'draft' : 'drafts'} via Press`;
      if (transport && transport.type === 'connect') {
        connectFallbackActionAvailable = true;
        await publishStagedCommit({
          transport,
          repo: { owner, name, branch },
          headline,
          files,
          contentRoot: getTrackedPublishContentRoot(),
          getCachedGrant: getCachedConnectPublishGrant,
          setCachedGrant: setCachedConnectPublishGrant,
          windowRef,
          documentRef,
          fetchImpl: fetchRef,
          translate: t,
          onStatus: setSyncOverlayStatus
        });
        connectFallbackActionAvailable = false;
      } else {
        await publishStagedCommit({
          transport,
          repo: { owner, name, branch },
          headline,
          files,
          fetchImpl: fetchRef,
          translate: t,
          onStatus: setSyncOverlayStatus
        });
      }

      setSyncOverlayStatus('Updating editor state…');
      applyLocalPostCommitState(files);

      const fileCount = files.length;
      const summaryLabel = fileCount === 1 ? describeSummaryEntry(summaryEntries[0] || files[0]) : `${fileCount} files`;
      setSyncOverlayMessage(`Commit pushed for ${summaryLabel}. Waiting for the site to update… This can take a few minutes. If you stop waiting, the commit stays on GitHub but the live site might not show the changes yet.`);
      const propagationResult = await waitForRemotePropagation(files);

      hideSyncOverlay();
      if (propagationResult && propagationResult.canceled) {
        showToast('info', t('editor.toasts.siteWaitStopped'));
      } else if (propagationResult && propagationResult.timedOut) {
        showToast('warning', t('editor.toasts.siteWaitTimedOut'));
      } else {
        showToast('success', t('editor.toasts.commitSuccess', { count: fileCount }));
      }
    } catch (err) {
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
