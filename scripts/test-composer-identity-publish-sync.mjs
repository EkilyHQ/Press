import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerSyncPanelSource = readIdentitySource('../assets/js/composer-sync-panel.js');

const composerSyncCommitControllerSource = readIdentitySource('../assets/js/composer-sync-commit-controller.js');

const composerPublishSyncFeatureSource = readIdentitySource('../assets/js/composer-publish-sync-feature.js');

const composerPublishServiceSource = readIdentitySource('../assets/js/composer-publish-service.js');

const composerSyncOverlaySource = readIdentitySource('../assets/js/composer-sync-overlay.js');

const composerPublishSettingsUiSource = readIdentitySource('../assets/js/composer-publish-settings-ui.js');

const composerPublishSummarySource = readIdentitySource('../assets/js/composer-publish-summary.js');

const composerPublishFlowSource = readIdentitySource('../assets/js/composer-publish-flow.js');

const composerNotificationsSource = readIdentitySource('../assets/js/composer-notifications.js');

const composerDialogsSource = readIdentitySource('../assets/js/composer-dialogs.js');

const composerRemoteSyncSource = readIdentitySource('../assets/js/composer-remote-sync.js');

const composerYamlSiteFeatureSource = readIdentitySource('../assets/js/composer-yaml-site-feature.js');

const composerDiffUiSource = readIdentitySource('../assets/js/composer-diff-ui.js');

const composerPathToolsSource = readIdentitySource('../assets/js/composer-path-tools.js');

const composerContentMutationsSource = readIdentitySource('../assets/js/composer-content-mutations.js');

const composerModeControllerSource = readIdentitySource('../assets/js/composer-mode-controller.js');

const composerUnsyncedSummarySource = readIdentitySource('../assets/js/composer-unsynced-summary.js');

const composerFilePanelControllerSource = readIdentitySource('../assets/js/composer-file-panel-controller.js');

const composerEditorDetailPanelControllerSource = readIdentitySource(
  '../assets/js/composer-editor-detail-panel-controller.js'
);

const publishCommitServiceSource = readIdentitySource('../assets/js/publish/commit-service.js');

const connectTransportSource = readIdentitySource('../assets/js/publish/transports/connect-transport.js');

const patTransportSource = readIdentitySource('../assets/js/publish/transports/github-pat-transport.js');

const propagationWatcherSource = readIdentitySource('../assets/js/publish/propagation-watcher.js');

// composer-identity-body:start

assert.match(
  composerPublishSyncFeatureSource,
  /from '\.\/composer-publish-service\.js'/,
  'publish/sync feature should own the explicit composer publish app-service boundary'
);

assert.doesNotMatch(
  source,
  /let syncCommitPanelRenderSeq|let syncCommitPanelRefreshTimer|function appendPublishTransportStatus|function getSyncCommitPanelHost|createComposerSyncCommitController|createSyncOverlayController|createPublishTransportSettingsUi|createPublishSummaryRenderer|createComposerPublishFlow|createPublishSettingsStore/,
  'composer should not own Sync commit panel rendering or publish control-plane service assembly'
);

assert.match(
  source,
  /const composerPublishSyncFeature = createComposerPublishSyncFeature\(\{[\s\S]*fetchContent: \(url, options\) => editorRuntime\.fetchContent\(url, options\),[\s\S]*scopeKey: scopedEditorStorageKey,[\s\S]*getActiveSiteRepoConfig: \(\) => getActiveSiteRepoConfig\(\),[\s\S]*getTrackedPublishContentRoot: \(\) => getTrackedPublishContentRoot\(\),[\s\S]*gatherCommitPayload: \(options\) => gatherCommitPayload\(options\),[\s\S]*applyLocalPostCommitState: \(files\) => applyLocalPostCommitState\(files\),[\s\S]*computeUnsyncedSummary,[\s\S]*setGitHubCommitInFlight: \(value\) => editorRuntime\.setGitHubCommitInFlight\(value\)/,
  'composer should pass app callbacks into the publish/sync feature instead of assembling the publish control plane itself'
);

assert.match(
  source,
  /const composerPublishSyncFeature = createComposerPublishSyncFeature\(\{[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\),[\s\S]*matchesMedia: \(query\) => editorRuntime\.matchesMedia\(query\),/,
  'composer should inject publish/sync timer, frame, and media adapters through the feature runtime'
);

assert.match(
  composerPublishServiceSource,
  /from '\.\/composer-sync-commit-controller\.js'[\s\S]*from '\.\/composer-sync-overlay\.js'[\s\S]*from '\.\/composer-publish-settings-ui\.js'[\s\S]*from '\.\/composer-publish-summary\.js'[\s\S]*from '\.\/composer-publish-flow\.js'[\s\S]*from '\.\/publish\/settings-store\.js'/,
  'composer publish service should cache-bust the publish control-plane modules it composes'
);

assert.match(
  composerPublishServiceSource,
  /export function createComposerPublishService\(options = \{\}\)[\s\S]*const publishSettingsStore = createPublishSettingsStoreRef\([\s\S]*const syncOverlayController = createSyncOverlayControllerRef\([\s\S]*const publishTransportUi = createPublishTransportSettingsUiRef\([\s\S]*const publishSummaryRenderer = createPublishSummaryRendererRef\([\s\S]*const publishFlow = createComposerPublishFlowRef\([\s\S]*syncCommitController = createComposerSyncCommitControllerRef\(/,
  'composer publish service should own settings, overlay, transport UI, summary, publish flow, and Sync commit controller assembly'
);

assert.match(
  composerPublishServiceSource,
  /const syncOverlayController = createSyncOverlayControllerRef\(\{[\s\S]*documentRef,[\s\S]*translate: t,[\s\S]*requestAnimationFrameRef,[\s\S]*setTimeoutRef,[\s\S]*clearTimeoutRef[\s\S]*\}\);/,
  'publish service should inject explicit frame and timer adapters into the Sync overlay controller'
);

assert.match(
  composerPublishServiceSource,
  /const publishSummaryRenderer = createPublishSummaryRendererRef\(\{[\s\S]*documentRef,[\s\S]*t,[\s\S]*matchesMedia,[\s\S]*setTimeoutRef[\s\S]*\}\);/,
  'publish service should inject explicit media and timer adapters into the publish summary renderer'
);

assert.match(
  composerPublishServiceSource,
  /const publishTransportUi = createPublishTransportSettingsUiRef\(\{[\s\S]*documentRef,[\s\S]*t,[\s\S]*publishSettingsStore,[\s\S]*refreshSyncCommitPanel,[\s\S]*scheduleSyncCommitPanelRefresh,[\s\S]*requestAnimationFrameRef,[\s\S]*setTimeoutRef[\s\S]*\}\);/,
  'publish service should inject explicit frame and timer adapters into the publish transport settings UI'
);

assert.match(
  composerPublishServiceSource,
  /syncCommitController = createComposerSyncCommitControllerRef\(\{[\s\S]*documentRef,[\s\S]*t,[\s\S]*setTimeoutRef,[\s\S]*clearTimeoutRef[\s\S]*\}\);/,
  'publish service should inject explicit timer adapters into the Sync commit controller'
);

assert.doesNotMatch(
  [composerSyncOverlaySource, composerPublishSummarySource, composerSyncPanelSource].join('\n'),
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\b(?:setTimeout|clearTimeout|requestAnimationFrame)\s*\(/m,
  'publish/sync overlay, summary, and refresh panel should use injected runtime timer, frame, and media adapters'
);

assert.doesNotMatch(
  composerPublishSettingsUiSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\b(?:setTimeout|requestAnimationFrame)\s*\(/m,
  'publish transport settings UI should use injected runtime frame and timer adapters instead of deriving them from windowRef'
);

assert.doesNotMatch(
  [
    composerPublishServiceSource,
    composerSyncOverlaySource,
    composerPublishSettingsUiSource,
    composerPublishSummarySource,
    composerPublishFlowSource,
    composerSyncCommitControllerSource
  ].join('\n'),
  /(?:documentRef|windowRef)\s*=\s*(?:document|window)\b|typeof (?:document|window|fetch)\s|fetchImpl:\s*fetch\b|windowRef\.fetch|console\.error/,
  'publish service modules should receive browser refs and fetch from the explicit composer runtime instead of discovering globals themselves'
);

assert.match(
  composerPublishServiceSource,
  /return \{[\s\S]*setSyncOverlayStatus,[\s\S]*startRemoteSyncWatcher,[\s\S]*renderPublishTransportSettings,[\s\S]*refreshSyncCommitPanel,[\s\S]*scheduleSyncCommitPanelRefresh[\s\S]*\};/,
  'composer publish service should expose only app-level publish controls back to composer'
);

assert.match(
  composerSyncCommitControllerSource,
  /export function createComposerSyncCommitController\([\s\S]*function appendPublishTransportStatus\(host\)[\s\S]*function getSyncCommitPanelHost\(\)[\s\S]*panel\.id = 'syncCommitPanel';[\s\S]*async function refresh\(options = \{\}\)[\s\S]*refreshSyncCommitPanelView\(options,[\s\S]*function scheduleRefresh\(\)[\s\S]*scheduleSyncCommitPanelRefreshView/,
  'Sync commit controller should own inline host creation, transport status, render sequencing, and refresh scheduling'
);

assert.match(
  composerSyncPanelSource,
  /export async function refreshSyncCommitPanelView\(options = \{\}, deps = \{\}\) \{[\s\S]*const headerSubmit = documentRef\.getElementById\('btnSyncSubmit'\)[\s\S]*gatherCommitPayload\(\{ cleanupUnusedAssets: false, showSeoStatus: false \}\)[\s\S]*form\.id = 'syncCommitForm';[\s\S]*const btnSubmit = headerSubmit;[\s\S]*appendPublishTransportStatus\(form\);[\s\S]*appendGithubCommitSummary\(summaryBlock, commitFiles, seoFiles, summaryEntries\)[\s\S]*const transport = resolvePublishTransport\(\);[\s\S]*ensureConnectPublishGrant\(transport\.connect, getActiveSiteRepoConfig\(\)\)[\s\S]*performConnectGithubCommit\(transport\.connect, currentSummary\)[\s\S]*performDirectGithubCommit\(transport\.token, currentSummary\);/,
  'inline Sync page commit form should reuse existing payload and route through the selected publish transport'
);

assert.match(
  connectTransportSource,
  /function requestConnectPublishGrant\([\s\S]*windowRef\.open\('', popupName, 'popup,width=520,height=720'\)[\s\S]*link\.referrerPolicy = 'unsafe-url'[\s\S]*link\.click\(\);/,
  'Connect publish authorization should send a full browser Referrer so Connect can bind project Pages paths'
);

assert.match(
  connectTransportSource,
  /async function createConnectPublishCommit\([\s\S]*const fetchRef = resolveFetch\(fetchImpl\);[\s\S]*fetchRef\(endpoint\.href, \{[\s\S]*referrerPolicy: 'unsafe-url'[\s\S]*Authorization/,
  'Connect publish POST should send a full browser Referrer so grants stay bound to the editor path'
);

assert.match(
  patTransportSource,
  /const additions = [\s\S]*\.filter\(\(file\) => !file\.deleted\)[\s\S]*const deletions = [\s\S]*\.filter\(\(file\) => file && file\.deleted\)[\s\S]*if \(deletions\.length\) fileChanges\.deletions = deletions;[\s\S]*fileChanges/,
  'GitHub commit payload should include deletions as well as additions'
);

assert.doesNotMatch(
  source,
  /async function githubGraphqlRequest|async function createFineGrainedTokenCommit|async function createConnectPublishCommit|function requestConnectPublishGrant/,
  'composer should not directly own Connect or GitHub commit transport implementations'
);

assert.doesNotMatch(
  publishCommitServiceSource,
  /import \{ createFineGrainedTokenCommit \} from '\.\/transports\/github-pat-transport\.js'/,
  'publish commit service should not eagerly import the PAT transport on composer startup'
);

assert.match(
  publishCommitServiceSource,
  /await import\('\.\/transports\/github-pat-transport\.js'\)[\s\S]*createFineGrainedTokenCommit\(transport && transport\.token/,
  'publish commit service should lazy-load the PAT transport only for PAT publishing'
);

assert.doesNotMatch(
  publishCommitServiceSource,
  /windowRef\s*=\s*window|documentRef\s*=\s*document|fetchImpl\s*=\s*fetch/,
  'publish commit service should not default to ambient browser refs or fetch'
);

assert.match(
  composerPublishFlowSource,
  /publishResult = await publishStagedCommit\(\{[\s\S]*transport,[\s\S]*repo,[\s\S]*fetchImpl: fetchRef,[\s\S]*onStatus: handlePublishStatus,[\s\S]*onPublishState: handlePublishState[\s\S]*\}\);[\s\S]*publishResult = await publishStagedCommit\(\{[\s\S]*transport,[\s\S]*repo,[\s\S]*fetchImpl: fetchRef,[\s\S]*onStatus: handlePublishStatus,[\s\S]*onPublishState: handlePublishState/,
  'composer publish flow should pass runtime fetch and publish-state callbacks into both Connect and PAT commit transports'
);

assert.doesNotMatch(
  connectTransportSource,
  /fetchImpl\s*=\s*fetch|windowRef\s*=\s*window|documentRef\s*=\s*document/,
  'Connect publish transport should require injected fetch and browser refs'
);

assert.doesNotMatch(
  patTransportSource,
  /typeof window|\bbtoa\b|fetchImpl\s*=\s*fetch/,
  'PAT publish transport should avoid browser base64 helpers and ambient fetch defaults'
);

assert.match(
  propagationWatcherSource,
  /export async function waitForRemotePropagation[\s\S]*setCancelHandler\(cancelHandler, true\)[\s\S]*setStatus\('All files confirmed on site\.'\)/,
  'remote propagation checks should live outside composer behind the publish watcher boundary'
);

assert.match(
  composerPublishFlowSource,
  /function waitForRemotePropagation\(files = \[\]\) \{[\s\S]*waitForPublishedFiles\(files, \{[\s\S]*fetchImpl: fetchRef,[\s\S]*contentRoot: getTrackedPublishContentRoot\(\),[\s\S]*sleepMs,[\s\S]*setStatus: setSyncOverlayStatus,[\s\S]*setCancelHandler: setSyncOverlayCancelHandler/,
  'composer publish flow should inject fetch, content root, and runtime sleep into the propagation watcher'
);

assert.doesNotMatch(
  propagationWatcherSource,
  /\bwindowRef\b|options\.windowRef|typeof window|__press_content_root|fetchImpl\s*\|\|\s*fetch|(^|[^.])\bfetch\s*\(|(^|[^.])\bsetTimeout\s*\(|\bbtoa\b|console\.error/m,
  'remote propagation watcher should not rediscover window, fetch, content-root globals, timers, or browser base64 helpers'
);

assert.match(
  source,
  /from '\.\/composer-notifications\.js'/,
  'composer should cache-bust the extracted notification and popup boundary'
);

assert.doesNotMatch(
  source,
  /function ensureToastRoot|function prepareToastStackAnimation|function showToast|function preparePopupWindow|function closePopupWindow|function finalizePopupWindow|function handlePopupBlocked/,
  'toast rendering and popup-window fallback details should stay outside the main composer shell'
);

assert.match(
  composerNotificationsSource,
  /export function createComposerNotificationController\(options = \{\}\)[\s\S]*function ensureToastRoot\(\)[\s\S]*function showToast\(kind, text, toastOptions = \{\}\)[\s\S]*function preparePopupWindow\(\)[\s\S]*function finalizePopupWindow\(win, href\)[\s\S]*function handlePopupBlocked\(href, popupOptions = \{\}\)/,
  'notification boundary should own toast DOM rendering and popup-window fallback behavior'
);

assert.match(
  source,
  /const composerNotifications = createComposerNotificationController\(\{[\s\S]*documentRef: composerDocument,[\s\S]*alertRef: \(message\) => editorRuntime\.showAlert\(message\),[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*openWindowRef: \(href, target, features\) => editorRuntime\.openWindow\(href, target, features\),[\s\S]*consoleRef: composerLogger[\s\S]*\}\);/,
  'composer should inject notification alerts, timers, frames, and popup windows through the runtime composition root'
);

assert.doesNotMatch(
  source,
  /composerWindow\.open/,
  'composer popup creation should route through the explicit runtime facade instead of calling composerWindow.open directly'
);

assert.doesNotMatch(
  composerNotificationsSource,
  /windowRef\.(?:alert|requestAnimationFrame|setTimeout|open)|options\.windowRef|alertRef\s*=\s*[\s\S]*windowRef/m,
  'notification boundary should not fall back to ambient window APIs for alerts, timers, frames, or popups'
);

assert.match(source, /from '\.\/composer-dialogs\.js'/, 'composer should cache-bust the extracted dialog boundary');

assert.doesNotMatch(
  source,
  /discardConfirmElements|addEntryPromptElements|markdownProtectionPasswordDialogElements|function ensureComposerAddEntryPromptElements|function ensureComposerDiscardConfirmElements|function requestMarkdownProtectionPassword|function showComposerAddEntryPrompt|function showComposerDiscardConfirm/,
  'dialog DOM state and overlay implementations should stay outside the main composer shell'
);

assert.match(
  composerDialogsSource,
  /export function createComposerDialogController\(options = \{\}\)[\s\S]*function ensureAddEntryPromptElements\(\)[\s\S]*function showAddEntryPrompt\(anchor, options = \{\}\)[\s\S]*function requestMarkdownProtectionPassword\(options = \{\}\)[\s\S]*function ensureDiscardConfirmElements\(\)[\s\S]*function showDiscardConfirm\(anchor, messageText, options = \{\}\)/,
  'dialog boundary should own add-entry prompts, discard confirmations, and protection password overlays'
);

assert.match(
  source,
  /const composerDialogs = createComposerDialogController\(\{[\s\S]*documentRef: composerDocument,[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\),[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*addWindowListener: \(type, handler, options\) => editorRuntime\.events\.onWindow\(type, handler, options\),[\s\S]*addDocumentListener: \(type, handler, options\) => editorRuntime\.events\.onDocument\(type, handler, options\),[\s\S]*getViewportSize: \(\) => editorRuntime\.getViewportSize\(\),[\s\S]*getWindowScroll: \(\) => editorRuntime\.getWindowScroll\(\)[\s\S]*\}\);/,
  'composer should inject dialog timers, frames, document/window listeners, viewport size, and scroll state through the runtime composition root'
);

assert.doesNotMatch(
  composerDialogsSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b/,
  'dialog boundary should not read window refs directly after receiving runtime adapters'
);

assert.doesNotMatch(
  composerDialogsSource,
  /documentRef\.(?:addEventListener|removeEventListener)\(/,
  'dialog boundary should route document-level listeners through the runtime adapter'
);

assert.doesNotMatch(
  [
    composerNotificationsSource,
    composerDialogsSource,
    composerDiffUiSource,
    composerUnsyncedSummarySource,
    composerPathToolsSource,
    composerFilePanelControllerSource,
    composerEditorDetailPanelControllerSource,
    composerModeControllerSource,
    composerContentMutationsSource
  ].join('\n'),
  /(?:documentRef|windowRef)\s*=\s*options\.(?:documentRef|windowRef)\s*\|\|\s*\(typeof (?:document|window)|typeof (?:document|window|requestAnimationFrame|setTimeout|clearTimeout|structuredClone|CSS)\b|\|\|\s*console\b|(^|[^.])\b(?:setTimeout|clearTimeout|requestAnimationFrame)\s*\(/m,
  'composer shell/control controllers should receive browser refs, timers, CSS, cloning, and logging through explicit runtime wiring instead of discovering globals themselves'
);

assert.match(
  composerPublishSyncFeatureSource,
  /from '\.\/composer-remote-sync\.js'/,
  'publish/sync feature should own the extracted remote sync boundary'
);

assert.doesNotMatch(
  source,
  /async function fetchMarkdownRemoteSnapshot|function applyMarkdownRemoteSnapshot|function startMarkdownSyncWatcher|async function fetchComposerRemoteSnapshot|function applyComposerRemoteSnapshot|function startComposerSyncWatcher/,
  'Markdown and YAML remote snapshot polling should stay outside the main composer shell'
);

assert.match(
  composerRemoteSyncSource,
  /export function createComposerRemoteSyncController\(options = \{\}\)[\s\S]*async function fetchMarkdownRemoteSnapshot\(tab\)[\s\S]*function applyMarkdownRemoteSnapshot\(tab, snapshot, applyOptions = \{\}\)[\s\S]*function startMarkdownSyncWatcher\(tab, watcherOptions = \{\}\)[\s\S]*async function fetchComposerRemoteSnapshot\(kind\)[\s\S]*function applyComposerRemoteSnapshot\(kind, snapshot\)[\s\S]*function startComposerSyncWatcher\(kind, watcherOptions = \{\}\)/,
  'remote sync controller should own Markdown and YAML remote snapshot fetch, apply, and watcher orchestration'
);

assert.doesNotMatch(
  composerRemoteSyncSource,
  /typeof fetch\b|(^|[^.])\bfetch\s*\(/m,
  'remote sync controller should receive fetch through explicit runtime wiring'
);

assert.match(
  composerYamlSiteFeatureSource,
  /from '\.\/composer-yaml-drafts\.js'/,
  'YAML/site feature should own the extracted YAML draft boundary'
);

assert.doesNotMatch(
  source,
  /let composerDraftMeta|let composerAutoSaveTimers|const composerDraftMeta|const composerAutoSaveTimers/,
  'index/tabs/site draft metadata and timers should stay outside the main composer shell'
);

// composer-identity-body:end
