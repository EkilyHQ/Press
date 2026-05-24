import assert from 'node:assert/strict';
import { createComposerPublishService } from '../assets/js/composer-publish-service.js';

const calls = [];
const documentRef = { id: 'document' };
const windowRef = {
  id: 'window'
};
const fetchContent = (...args) => {
  calls.push(['runtime:fetch', args.length]);
};
const requestAnimationFrameRef = () => 1;
const setTimeoutRef = () => 2;
const clearTimeoutRef = () => {};
const matchesMedia = () => false;
const publishSettingsStore = { id: 'settings-store' };
const overlayController = {
  show(options) {
    calls.push(['overlay:show', options && options.title]);
  },
  hide() {
    calls.push(['overlay:hide']);
  },
  setMessage(message) {
    calls.push(['overlay:message', message]);
  },
  setStatus(status) {
    calls.push(['overlay:status', status]);
  },
  setCancelHandler(handler) {
    calls.push(['overlay:cancel', typeof handler]);
  },
  startRemoteWatcher(config) {
    calls.push(['overlay:watcher', config && config.title]);
    return { watched: true };
  }
};
const publishTransportUi = {
  setCachedFineGrainedToken(token) {
    calls.push(['token:set', token]);
  },
  clearCachedFineGrainedToken() {
    calls.push(['token:clear']);
  },
  getFineGrainedTokenValue() {
    return 'pat-token';
  },
  getCachedConnectPublishGrant() {
    return { token: 'grant' };
  },
  setCachedConnectPublishGrant(grant) {
    calls.push(['grant:set', grant && grant.token]);
  },
  clearCachedConnectPublishGrant() {
    calls.push(['grant:clear']);
  },
  getMatchingConnectPublishGrant(connect) {
    return connect && connect.baseUrl ? { token: 'matching' } : null;
  },
  resolvePublishTransport() {
    return { type: 'connect', connect: { baseUrl: 'https://connect.example' } };
  },
  getVisibleFineGrainedTokenInput() {
    return { id: 'syncGithubTokenInput' };
  },
  renderFineGrainedTokenSettings(host) {
    calls.push(['render:token', host]);
  },
  renderPublishTransportSettings(host) {
    calls.push(['render:transport', host]);
    return { host };
  },
  switchToPatFallbackAndFocusToken() {
    calls.push(['fallback:pat']);
  }
};
const publishSummaryRenderer = {
  describeSummaryEntry(entry) {
    return entry && entry.path || '';
  },
  appendGithubCommitSummary(host, files) {
    calls.push(['summary:append', host, files.length]);
  }
};
const publishFlow = {
  performDirectGithubCommit(token, entries) {
    calls.push(['commit:pat', token, entries.length]);
  },
  performConnectGithubCommit(connect, entries) {
    calls.push(['commit:connect', connect.baseUrl, entries.length]);
  },
  ensureConnectPublishGrant(connect, repo) {
    calls.push(['grant:ensure', connect.baseUrl, repo.name]);
  }
};
const syncCommitController = {
  refresh(options) {
    calls.push(['sync:refresh', options && options.focusToken]);
    return { refreshed: true };
  },
  scheduleRefresh() {
    calls.push(['sync:schedule']);
    return 42;
  }
};

const service = createComposerPublishService({
  documentRef,
  windowRef,
  fetchContent,
  requestAnimationFrameRef,
  setTimeoutRef,
  clearTimeoutRef,
  matchesMedia,
  t: (key) => key,
  scopeKey: (key) => `scope:${key}`,
  getActiveSiteRepoConfig: () => ({ owner: 'EkilyHQ', name: 'Press', branch: 'main' }),
  getTrackedPublishContentRoot: () => 'wwwroot',
  gatherCommitPayload: async () => ({ files: [{ path: 'site.yaml' }] }),
  applyLocalPostCommitState: (files) => calls.push(['post-commit', files.length]),
  getCurrentMode: () => 'sync',
  computeUnsyncedSummary: () => [{ kind: 'site', label: 'site.yaml' }],
  applyMode: (mode) => calls.push(['mode', mode]),
  showEditorSystemPanel: (mode) => calls.push(['system-panel', mode]),
  showToast: (kind, message) => calls.push(['toast', kind, message]),
  consoleRef: { error: (...args) => calls.push(['console:error', args.length]) },
  setGitHubCommitInFlight: (value) => calls.push(['in-flight', !!value]),
  createPublishSettingsStore(options) {
    assert.equal(options.windowRef, windowRef);
    assert.equal(options.scopeKey('key'), 'scope:key');
    calls.push(['factory:settings']);
    return publishSettingsStore;
  },
  createSyncOverlayController(options) {
    assert.equal(options.documentRef, documentRef);
    assert.equal(options.translate('x'), 'x');
    assert.equal(options.requestAnimationFrameRef, requestAnimationFrameRef);
    assert.equal(options.setTimeoutRef, setTimeoutRef);
    assert.equal(options.clearTimeoutRef, clearTimeoutRef);
    calls.push(['factory:overlay']);
    return overlayController;
  },
  createPublishTransportSettingsUi(options) {
    assert.equal(options.publishSettingsStore, publishSettingsStore);
    assert.equal(typeof options.refreshSyncCommitPanel, 'function');
    assert.equal(typeof options.scheduleSyncCommitPanelRefresh, 'function');
    calls.push(['factory:transport-ui']);
    return publishTransportUi;
  },
  createPublishSummaryRenderer(options) {
    assert.equal(options.documentRef, documentRef);
    assert.equal(options.matchesMedia, matchesMedia);
    assert.equal(options.setTimeoutRef, setTimeoutRef);
    calls.push(['factory:summary']);
    return publishSummaryRenderer;
  },
  createComposerPublishFlow(options) {
    assert.equal(options.fetchImpl, fetchContent);
    assert.equal(options.getCachedConnectPublishGrant, publishTransportUi.getCachedConnectPublishGrant);
    assert.equal(options.clearCachedFineGrainedToken, publishTransportUi.clearCachedFineGrainedToken);
    assert.equal(options.showSyncOverlay, overlayController.show);
    assert.equal(options.describeSummaryEntry, publishSummaryRenderer.describeSummaryEntry);
    assert.equal(options.switchToPatFallbackAndFocusToken, publishTransportUi.switchToPatFallbackAndFocusToken);
    assert.equal(typeof options.consoleRef.error, 'function');
    calls.push(['factory:flow']);
    return publishFlow;
  },
  createComposerSyncCommitController(options) {
    assert.equal(options.resolvePublishTransport, publishTransportUi.resolvePublishTransport);
    assert.equal(options.renderFineGrainedTokenSettings, publishTransportUi.renderFineGrainedTokenSettings);
    assert.equal(options.appendGithubCommitSummary, publishSummaryRenderer.appendGithubCommitSummary);
    assert.equal(options.ensureConnectPublishGrant, publishFlow.ensureConnectPublishGrant);
    assert.equal(options.performConnectGithubCommit, publishFlow.performConnectGithubCommit);
    assert.equal(options.performDirectGithubCommit, publishFlow.performDirectGithubCommit);
    assert.equal(options.setTimeoutRef, setTimeoutRef);
    assert.equal(options.clearTimeoutRef, clearTimeoutRef);
    calls.push(['factory:sync-controller']);
    return syncCommitController;
  }
});

assert.deepEqual(
  Object.keys(service).sort(),
  [
    'refreshSyncCommitPanel',
    'renderPublishTransportSettings',
    'scheduleSyncCommitPanelRefresh',
    'setSyncOverlayStatus',
    'startRemoteSyncWatcher'
  ],
  'publish service should expose only the app-level publish controls composer needs'
);

service.renderPublishTransportSettings('settings-host');
assert.deepEqual(calls.at(-1), ['render:transport', 'settings-host']);

service.setSyncOverlayStatus('checking');
assert.deepEqual(calls.at(-1), ['overlay:status', 'checking']);

assert.deepEqual(await service.refreshSyncCommitPanel({ focusToken: true }), { refreshed: true });
assert.deepEqual(calls.at(-1), ['sync:refresh', true]);
assert.equal(service.scheduleSyncCommitPanelRefresh(), 42);
assert.deepEqual(calls.at(-1), ['sync:schedule']);

assert.deepEqual(service.startRemoteSyncWatcher({ title: 'remote' }), { watched: true });
assert.deepEqual(calls.at(-1), ['overlay:watcher', 'remote']);

assert.equal(
  calls.some(call => call[0] === 'factory:flow') && calls.some(call => call[0] === 'factory:sync-controller'),
  true,
  'publish service should own publish flow and Sync commit controller assembly'
);
