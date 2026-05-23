import './cache-control.js';
import { getManualMarkdownSaveState } from './composer-markdown-save.js';
import {
  fetchConfigWithYamlFallback,
  parseYAML
} from './yaml.js';
import { escapeHtml } from './utils.js?v=press-system-v3.4.50';
import { t, getAvailableLangs, getLanguageLabel } from './i18n.js?v=press-system-v3.4.50';
import { buildEditorContentTree, findEditorContentTreeNode, flattenEditorContentTree } from './editor-content-tree.js?v=press-system-v3.4.50';
import {
  decryptMarkdownDocument,
  encryptMarkdownDocument,
  parseEncryptedMarkdownEnvelope
} from './encrypted-content.js?v=press-system-v3.4.50';
import { createStagingRegistry } from './composer-staging.js?v=press-system-v3.4.50';
import { createIndexPublishMetadataEnricher } from './composer-index-publish-metadata.js?v=press-system-v3.4.50';
import { createContentCommitStagingProvider } from './composer-content-staging.js?v=press-system-v3.4.50';
import { createSeoStagingProvider } from './composer-seo-staging.js?v=press-system-v3.4.50';
import { createPostCommitStateApplier } from './composer-post-commit-state.js?v=press-system-v3.4.50';
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
} from './composer-index-tabs-model.js?v=press-system-v3.4.50';
import {
  cloneSiteState,
  computeSiteDiff,
  computeSiteSignature,
  prepareSiteState,
  toSiteYaml,
  writeYamlValue
} from './composer-site-model.js?v=press-system-v3.4.50';
import {
  createScopedStorageKey,
  resolveEditorStorageScope
} from './editor-storage.js?v=press-system-v3.4.50';
import { createScopedDraftStore } from './editor-drafts.js?v=press-system-v3.4.50';
import { createEditorSessionStateStore } from './editor-session-state.js?v=press-system-v3.4.50';
import {
  COMPOSER_RUNTIME_EVENTS,
  createComposerRuntime
} from './composer-runtime.js?v=press-system-v3.4.50';
import { createComposerSyncCommitController } from './composer-sync-commit-controller.js?v=press-system-v3.4.50';
import { createSyncOverlayController } from './composer-sync-overlay.js?v=press-system-v3.4.50';
import { createPublishTransportSettingsUi } from './composer-publish-settings-ui.js?v=press-system-v3.4.50';
import { createPublishSummaryRenderer } from './composer-publish-summary.js?v=press-system-v3.4.50';
import { createComposerPublishFlow } from './composer-publish-flow.js?v=press-system-v3.4.50';
import { createComposerNotificationController } from './composer-notifications.js?v=press-system-v3.4.50';
import { createComposerDialogController } from './composer-dialogs.js?v=press-system-v3.4.50';
import { createComposerRemoteSyncController } from './composer-remote-sync.js?v=press-system-v3.4.50';
import { createComposerDiffUi } from './composer-diff-ui.js?v=press-system-v3.4.50';
import { createComposerOrderDiffUi } from './composer-order-diff-ui.js?v=press-system-v3.4.50';
import { createComposerIndexTabsUi } from './composer-index-tabs-ui.js?v=press-system-v3.4.50';
import { createComposerSiteSettingsUi } from './composer-site-settings-ui.js?v=press-system-v3.4.50';
import { createComposerMarkdownAssetManager } from './composer-markdown-assets.js?v=press-system-v3.4.50';
import { createComposerEditorShell } from './composer-editor-shell.js?v=press-system-v3.4.50';
import { createComposerPathTools } from './composer-path-tools.js?v=press-system-v3.4.50';
import { createComposerContentMutationController } from './composer-content-mutations.js?v=press-system-v3.4.50';
import { createComposerSetupVerifier } from './composer-setup-verifier.js?v=press-system-v3.4.50';
import { createComposerModeController, isComposerSystemMode } from './composer-mode-controller.js?v=press-system-v3.4.50';
import { createComposerUnsyncedSummaryController } from './composer-unsynced-summary.js?v=press-system-v3.4.50';
import { injectComposerRuntimeStyles } from './composer-runtime-styles.js?v=press-system-v3.4.50';
import { createComposerSystemThemeBridge } from './composer-system-theme-bridge.js?v=press-system-v3.4.50';
import {
  bindComposerWorkspaceUi,
  initializeComposerApp
} from './composer-bootstrap.js?v=press-system-v3.4.50';
import {
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
} from './composer-ui-motion.js?v=press-system-v3.4.50';
import {
  applyInferredRepoConfig,
  createComposerSiteConfigController,
  inferRepoConfigFromGitHubPagesUrl
} from './composer-site-config.js?v=press-system-v3.4.50';
import { createComposerYamlActions } from './composer-yaml-actions.js?v=press-system-v3.4.50';
import { createEditorContentTreeController } from './editor-content-tree-controller.js?v=press-system-v3.4.50';
import { createComposerMarkdownLoader } from './composer-markdown-loader.js?v=press-system-v3.4.50';
import { createComposerMarkdownActionsUi } from './composer-markdown-actions-ui.js?v=press-system-v3.4.50';
import { createComposerMarkdownActionsController } from './composer-markdown-actions.js?v=press-system-v3.4.50';
import { createComposerMarkdownDraftController } from './composer-markdown-drafts.js?v=press-system-v3.4.50';
import { createComposerMarkdownSessionController } from './composer-markdown-session.js?v=press-system-v3.4.50';
import { createComposerMarkdownWorkspaceController } from './composer-markdown-workspace.js?v=press-system-v3.4.50';
import { createComposerYamlDraftController } from './composer-yaml-drafts.js?v=press-system-v3.4.50';
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
} from './composer-markdown-state.js?v=press-system-v3.4.50';
import { createEditorFileTreeUi } from './editor-file-tree-ui.js?v=press-system-v3.4.50';
import { createEditorStructurePanelUi } from './editor-structure-panel-ui.js?v=press-system-v3.4.50';
import {
  CONNECT_PUBLISH_PRESETS,
  createPublishSettingsStore
} from './publish/settings-store.js?v=press-system-v3.4.50';

// Utility helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const PREFERRED_LANG_ORDER = ['en', 'chs', 'cht-tw', 'cht-hk', 'ja'];
const LANG_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
const LANGUAGE_POOL_CHANGED_EVENT = COMPOSER_RUNTIME_EVENTS.languagePoolChanged;
const editorRuntime = createComposerRuntime({
  windowRef: window,
  documentRef: document
});
const composerPathTools = createComposerPathTools({
  windowRef: window,
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
  encodeGitHubPath,
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
  documentRef: document,
  windowRef: window,
  t,
  safeString,
  alertRef: (message) => alert(message),
  consoleRef: console
});
const {
  showToast,
  preparePopupWindow,
  closePopupWindow,
  finalizePopupWindow,
  handlePopupBlocked
} = composerNotifications;
const composerDialogs = createComposerDialogController({
  documentRef: document,
  windowRef: window,
  t
});
const {
  showAddEntryPrompt: showComposerAddEntryPrompt,
  showDiscardConfirm: showComposerDiscardConfirm,
  requestMarkdownProtectionPassword
} = composerDialogs;

const publishSettingsStore = createPublishSettingsStore({
  windowRef: window,
  scopeKey: scopedEditorStorageKey
});
let syncCommitController = null;
const syncOverlayController = createSyncOverlayController({
  documentRef: document,
  windowRef: window,
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
const publishTransportUi = createPublishTransportSettingsUi({
  documentRef: document,
  windowRef: window,
  t,
  publishSettingsStore,
  getActiveSiteRepoConfig: () => getActiveSiteRepoConfig(),
  applyMode: (mode, options) => applyMode(mode, options),
  showEditorSystemPanel: (mode) => showEditorSystemPanel(mode),
  refreshSyncCommitPanel: (options) => refreshSyncCommitPanel(options),
  scheduleSyncCommitPanelRefresh: () => scheduleSyncCommitPanelRefresh()
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
const publishSummaryRenderer = createPublishSummaryRenderer({
  documentRef: document,
  windowRef: window,
  t
});
const {
  describeSummaryEntry,
  appendGithubCommitSummary
} = publishSummaryRenderer;
const publishFlow = createComposerPublishFlow({
  windowRef: window,
  documentRef: document,
  t,
  getActiveSiteRepoConfig: () => getActiveSiteRepoConfig(),
  getTrackedPublishContentRoot: () => getTrackedPublishContentRoot(),
  gatherCommitPayload: (options) => gatherCommitPayload(options),
  applyLocalPostCommitState: (files) => postCommitStateApplier.apply(files),
  getCachedConnectPublishGrant,
  setCachedConnectPublishGrant,
  clearCachedConnectPublishGrant,
  clearCachedFineGrainedToken,
  showSyncOverlay,
  hideSyncOverlay,
  setSyncOverlayStatus,
  setSyncOverlayMessage,
  setSyncOverlayCancelHandler,
  showToast,
  describeSummaryEntry,
  switchToPatFallbackAndFocusToken,
  setGitHubCommitInFlight: (value) => {
    gitHubCommitInFlight = !!value;
  }
});
const {
  performDirectGithubCommit,
  performConnectGithubCommit,
  ensureConnectPublishGrant
} = publishFlow;

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
const markdownAssetManager = createComposerMarkdownAssetManager({
  windowRef: window,
  t,
  normalizeRelPath,
  normalizeMarkdownContent,
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
const stagingRegistry = createStagingRegistry();
const composerSystemThemeBridge = createComposerSystemThemeBridge({
  consoleRef: console,
  getStateSlice,
  setStateSlice,
  notifyComposerChange,
  updateUnsyncedSummary,
  refreshEditorContentTree
});
const indexPublishMetadata = createIndexPublishMetadataEnricher({
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
  getContentRootSafe
});
const contentCommitStagingProvider = createContentCommitStagingProvider({
  getDynamicEditorTabs: () => getDynamicEditorTabs(),
  flushMarkdownDraft,
  getStateSlice,
  getContentRootSafe,
  getRemoteBaseline: () => composerStateStore.getRemoteBaseline(),
  getComposerDiffCache: () => composerStateStore.getDiffCache(),
  setComposerDiff: (kind, diff) => composerStateStore.setDiff(kind, diff),
  collectCurrentRepositoryMarkdownAssetReferences,
  collectUnsyncedMarkdownEntries,
  getPrimaryEditorApi,
  getActiveDynamicTab,
  getCurrentMode: () => getCurrentComposerMode(),
  readMarkdownDraftStore,
  normalizeRelPath,
  findDynamicTabByPath,
  getLockedEncryptedMarkdownDraft,
  normalizeMarkdownContent,
  isEncryptedMarkdownDraftEntry,
  prepareMarkdownForProtectedStorage,
  listMarkdownAssets,
  isAssetReferencedInContent,
  removeMarkdownAsset,
  enrichIndexStateForPublish: indexPublishMetadata.enrichIndexStateForPublish,
  toIndexYaml,
  toTabsYaml,
  toSiteYaml,
  setStateSlice,
  computeIndexDiff,
  recomputeDiff,
  listMarkdownAssetDeletions,
  safeString,
  draftHasAssetDeletions,
  textWithFallback
});
const seoStagingProvider = createSeoStagingProvider({
  getStateSlice,
  getContentRootSafe,
  getRemoteBaselineSite: () => composerStateStore.getRemoteBaseline('site'),
  cloneSiteState,
  isIndexMetadataObject,
  getIndexVariantLocation
});
let markdownLoader = null;
let markdownActionsUi = null;
let markdownDraftController = null;
let markdownSessionController = null;
let markdownWorkspaceController = null;
let modeController = null;
let unsyncedSummaryController = null;
const postCommitStateApplier = createPostCommitStateApplier({
  stagingRegistry,
  getStateSlice,
  getRemoteBaseline: () => composerStateStore.getRemoteBaseline(),
  setRemoteBaselineSlice: (kind, value) => composerStateStore.setRemoteBaseline(kind, value),
  deepClone,
  prepareIndexState,
  prepareTabsState,
  prepareSiteState,
  cloneSiteState,
  notifyComposerChange,
  clearDraftStorage,
  getContentRootSafe,
  applyComposerEffectiveSiteConfig: (site) => applyComposerEffectiveSiteConfig(site),
  safeString,
  updateComposerMarkdownDraftIndicators,
  updateMarkdownPushButton,
  updateMarkdownDiscardButton,
  updateMarkdownSaveButton,
  updateMarkdownProtectionButton,
  getActiveDynamicTab,
  normalizeRelPath,
  clearMarkdownDraftEntry,
  clearMarkdownAssetsForPath,
  findDynamicTabByPath,
  computeTextSignature,
  setMarkdownProtectionState,
  createMarkdownProtectionState,
  setDynamicTabStatus,
  normalizeMarkdownContent,
  getMarkdownProtectionState,
  scheduleMarkdownDraftSave,
  updateDynamicTabDirtyState,
  removeMarkdownAsset,
  removeMarkdownAssetDeletion,
  updateUnsyncedSummary
});
stagingRegistry.registerStagingProvider({
  id: 'content',
  required: true,
  getCommitFiles: (context = {}) => contentCommitStagingProvider.getCommitFiles(context)
});
composerSystemThemeBridge.registerStagingProviders(stagingRegistry);
stagingRegistry.registerStagingProvider({
  id: 'seo',
  async getCommitFiles(context = {}) {
    if (context.showSeoStatus) {
      try {
        if (typeof context.setStatus === 'function') context.setStatus('Generating SEO files…');
      } catch (_) { /* ignore */ }
    }
    return seoStagingProvider.getCommitFiles(context);
  }
});
const editorSessionStateStore = createEditorSessionStateStore({
  storage: editorRuntime.storage,
  scopeKey: scopedEditorStorageKey,
  keys: LS_KEYS
});

let allowEditorStatePersist = false;
const expandedEditorTreeNodeIds = new Set(['articles', 'pages']);
let hasEditorStateV3Snapshot = false;
try {
  const parsedEditorState = editorSessionStateStore.readEditorState();
  hasEditorStateV3Snapshot = !!(parsedEditorState && parsedEditorState.v === EDITOR_STATE_VERSION);
} catch (_) {}
try {
  if (!hasEditorStateV3Snapshot && editorSessionStateStore.readLegacySystemTreeExpanded()) {
    expandedEditorTreeNodeIds.add('system');
  }
} catch (_) {}
markdownDraftController = createComposerMarkdownDraftController({
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
  refreshEditorContentTree,
  updateUnsyncedSummary,
  showToast,
  t,
  consoleRef: console,
  setTimeoutRef: (handler, delay) => window.setTimeout(handler, delay),
  clearTimeoutRef: (id) => window.clearTimeout(id)
});
markdownLoader = createComposerMarkdownLoader({
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
  fetchContent: (url, options) => fetch(url, options),
  draftProtectionTitle: () => t('editor.composer.markdown.protection.draftTitle'),
  draftProtectionMessage: () => t('editor.composer.markdown.protection.draftMessage'),
  openProtectionTitle: () => t('editor.composer.markdown.protection.openTitle'),
  openProtectionMessage: () => t('editor.composer.markdown.protection.openMessage')
});
markdownActionsUi = createComposerMarkdownActionsUi({
  documentRef: document,
  translate: t,
  getCurrentMode: () => getCurrentComposerMode(),
  getActiveDynamicTab,
  getActiveSiteRepoConfig,
  hasMarkdownDraftContent,
  getManualMarkdownSaveState,
  isMarkdownTabProtected,
  setButtonLabel
});
const remoteSyncController = createComposerRemoteSyncController({
  t,
  fetchContent: (url, options) => fetch(url, options),
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
  windowRef: window,
  t,
  getCurrentMode: () => getCurrentComposerMode(),
  getActiveDynamicTab,
  getActiveSiteRepoConfig,
  getContentRootSafe,
  normalizeRelPath,
  dirnameFromPath,
  basenameFromPath,
  encodeGitHubPath,
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
  documentRef: document,
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
  documentRef: document,
  windowRef: window,
  editorSessionStateStore,
  expandedEditorTreeNodeIds,
  treeText,
  getCurrentMode: () => getCurrentComposerMode(),
  getDynamicEditorTabs: () => getDynamicEditorTabs(),
  isDynamicMode,
  normalizeRelPath,
  getAllowEditorStatePersist: () => allowEditorStatePersist,
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
markdownSessionController = createComposerMarkdownSessionController({
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
  getAllowEditorStatePersist: () => allowEditorStatePersist,
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
  requestAnimationFrameRef: (fn) => requestAnimationFrame(fn),
  applyMode: (mode, options) => applyMode(mode, options),
  selectEditorTreeNodeByPath,
  showComposerDiscardConfirm,
  t,
  windowRef: window,
  alertRef: (message) => alert(message),
  consoleRef: console,
  updateDynamicTabsGroupState,
  detachPrimaryEditorListeners,
  updateMarkdownActionsForTab,
  updateComposerMarkdownDraftIndicators
});
markdownWorkspaceController = createComposerMarkdownWorkspaceController({
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
});
modeController = createComposerModeController({
  documentRef: document,
  windowRef: window,
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
  alertRef: (message) => alert(message),
  consoleRef: console
});

function getCurrentComposerMode() {
  return modeController ? modeController.getCurrentMode() : null;
}

function shouldPreserveEditorStructureForMode(mode) {
  return !!(mode && (isDynamicMode(mode) || isComposerSystemMode(mode)));
}

function getDynamicTabsContainer() {
  try {
    return document.getElementById('modeDynamicTabs');
  } catch (_) {
    return null;
  }
}

function updateDynamicTabsGroupState() {
  const container = getDynamicTabsContainer();
  if (!container) return;
  const hasTabs = !!container.querySelector('.mode-tab.dynamic-mode');
  container.hidden = !hasTabs;
  if (hasTabs) container.removeAttribute('aria-hidden');
  else container.setAttribute('aria-hidden', 'true');
}

const ANNOTATE_DISCUSSION_CATEGORY_PRESETS = [
  { value: 'General', label: 'General' }
];

let gitHubCommitInFlight = false;

let activeComposerFile = 'index';
let composerViewTransition = null;
const composerSiteConfigController = createComposerSiteConfigController({
  runtime: editorRuntime,
  windowRef: window,
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
  setTimeoutRef: (handler, delay) => window.setTimeout(handler, delay),
  clearTimeoutRef: (id) => window.clearTimeout(id)
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
  documentRef: document,
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
unsyncedSummaryController = createComposerUnsyncedSummaryController({
  documentRef: document,
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
  getStagingSummaryEntries: () => stagingRegistry.getSummaryEntries(),
  getActiveComposerFile,
  getComposerDraftMeta,
  hasUnsavedComposerChanges,
  hasAnyComposerDraftMeta,
  hasUnsavedMarkdownDrafts,
  refreshEditorContentTree,
  shouldPreserveEditorStructure: () => shouldPreserveEditorStructureForMode(getCurrentComposerMode()),
  refreshComposerInlineMeta,
  scheduleSyncCommitPanelRefresh
});

function getActiveComposerFile() {
  if (activeComposerFile === 'tabs') return 'tabs';
  if (activeComposerFile === 'site') return 'site';
  return 'index';
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

function getMarkdownDraftController() {
  if (!markdownDraftController) throw new Error('Markdown draft controller is not initialized');
  return markdownDraftController;
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
    if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
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
  if (!unsyncedSummaryController) throw new Error('Unsynced summary controller is not initialized');
  return unsyncedSummaryController;
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

function updateUnsyncedSummary(options = {}) {
  return getUnsyncedSummaryController().updateUnsyncedSummary(options);
}

function findDynamicTabByPath(path) {
  return getMarkdownWorkspaceController().findDynamicTabByPath(path);
}

async function gatherCommitPayload(options = {}) {
  const { showSeoStatus = false } = options;
  const providerResult = await stagingRegistry.getCommitFiles({
    ...options,
    showSeoStatus,
    setStatus: setSyncOverlayStatus
  });
  const files = Array.isArray(providerResult.files) ? providerResult.files : [];
  const seoFiles = files.filter(file => file && file.kind === 'seo');
  return { files, seoFiles, warnings: providerResult.warnings || [] };
}

function getSyncCommitController() {
  if (!syncCommitController) throw new Error('Sync commit controller is not initialized');
  return syncCommitController;
}

async function refreshSyncCommitPanel(options = {}) {
  return getSyncCommitController().refresh(options);
}

function scheduleSyncCommitPanelRefresh() {
  return getSyncCommitController().scheduleRefresh();
}

syncCommitController = createComposerSyncCommitController({
  documentRef: document,
  windowRef: window,
  t,
  getCurrentMode: () => getCurrentComposerMode(),
  computeUnsyncedSummary,
  gatherCommitPayload,
  resolvePublishTransport,
  getMatchingConnectPublishGrant,
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
  switchToPatFallbackAndFocusToken
});

function getActiveSiteRepoConfig() {
  const site = getStateSlice('site');
  return resolveActiveSiteRepoConfig(site, editorRuntime.getSiteRepo());
}

const composerOrderDiffUi = createComposerOrderDiffUi({
  documentRef: document,
  windowRef: window,
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
  getComposerViewTransition: () => composerViewTransition,
  getSlideDurations: getComposerSlideDurations
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
  documentRef: document,
  windowRef: window,
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
  requestAnimationFrameRef: (callback) => requestAnimationFrame(callback),
  confirmRef: (message) => window.confirm(message),
  consoleRef: console
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
  documentRef: document,
  windowRef: window,
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
  documentRef: document,
  windowRef: window,
  performanceRef: typeof performance !== 'undefined' ? performance : null,
  cssRef: typeof CSS !== 'undefined' ? CSS : null,
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

const composerSetupVerifier = createComposerSetupVerifier({
  runtime: editorRuntime,
  documentRef: document,
  windowRef: window,
  consoleRef: console,
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
  getContentRoot: () => editorRuntime.getContentRoot()
});
const { bindVerifySetup } = composerSetupVerifier;

function scheduleAutoDraft(kind) {
  composerYamlDraftController.scheduleAutoDraft(kind);
}

function clearDraftStorage(kind) {
  composerYamlDraftController.clearDraftStorage(kind);
}

function notifyComposerChange(kind, options = {}) {
  const diff = recomputeDiff(kind);
  if (kind === 'tabs') applyTabsDiffMarkers(diff);
  else if (kind === 'site') applySiteDiffMarkers(diff);
  else applyIndexDiffMarkers(diff);
  refreshFileDirtyBadges();
  if (!options.skipAutoSave) scheduleAutoDraft(kind);
  if (kind === 'site') {
    try { applyComposerEffectiveSiteConfig(getStateSlice('site') || {}); } catch (_) {}
  }

  updateUnsyncedSummary();
  if ((kind === 'index' || kind === 'tabs') && getComposerOrderPreviewActiveKind() === kind) updateComposerOrderPreview(kind);
  refreshEditorContentTree({
    preserveStructure: shouldPreserveEditorStructureForMode(getCurrentComposerMode())
  });
}

function rebuildIndexUI(preserveOpen = true) {
  const root = document.getElementById('composerIndex');
  if (!root) return;
  const openKeys = preserveOpen
    ? Array.from(root.querySelectorAll('.ci-item.is-open')).map(el => el.getAttribute('data-key')).filter(Boolean)
    : [];
  composerIndexTabsUi.buildIndexUI(root, composerStateStore.getActiveState());
  openKeys.forEach(key => {
    if (!key) return;
    const row = root.querySelector(`.ci-item[data-key="${cssEscape(key)}"]`);
    if (!row) return;
    const body = row.querySelector('.ci-body');
    const btn = row.querySelector('.ci-expand');
    row.classList.add('is-open');
    if (body) {
      body.style.display = 'block';
      body.dataset.open = '1';
      clearInlineSlideStyles(body);
    }
    if (btn) btn.setAttribute('aria-expanded', 'true');
  });
  notifyComposerChange('index', { skipAutoSave: true });
  updateComposerMarkdownDraftIndicators();
}

function rebuildTabsUI(preserveOpen = true) {
  const root = document.getElementById('composerTabs');
  if (!root) return;
  const openKeys = preserveOpen
    ? Array.from(root.querySelectorAll('.ct-item.is-open')).map(el => el.getAttribute('data-key')).filter(Boolean)
    : [];
  composerIndexTabsUi.buildTabsUI(root, composerStateStore.getActiveState());
  openKeys.forEach(key => {
    if (!key) return;
    const row = root.querySelector(`.ct-item[data-key="${cssEscape(key)}"]`);
    if (!row) return;
    const body = row.querySelector('.ct-body');
    const btn = row.querySelector('.ct-expand');
    row.classList.add('is-open');
    if (body) {
      body.style.display = 'block';
      body.dataset.open = '1';
      clearInlineSlideStyles(body);
    }
    if (btn) btn.setAttribute('aria-expanded', 'true');
  });
  notifyComposerChange('tabs', { skipAutoSave: true });
  updateComposerMarkdownDraftIndicators();
}

function loadDraftSnapshotsIntoState(state) {
  return composerYamlDraftController.loadDraftSnapshotsIntoState(state);
}

const composerYamlActions = createComposerYamlActions({
  windowRef: window,
  consoleRef: console,
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
  setTimeoutRef: (handler, delay) => window.setTimeout(handler, delay)
});
const {
  handleDiscard: handleComposerDiscard,
  handleRefresh: handleComposerRefresh
} = composerYamlActions;

function getMarkdownSessionController() {
  if (!markdownSessionController) throw new Error('Markdown session controller is not initialized');
  return markdownSessionController;
}

function getMarkdownActionsUi() {
  if (!markdownActionsUi) throw new Error('Markdown actions UI is not initialized');
  return markdownActionsUi;
}

function getMarkdownLoader() {
  if (!markdownLoader) throw new Error('Markdown loader is not initialized');
  return markdownLoader;
}

function getMarkdownWorkspaceController() {
  if (!markdownWorkspaceController) throw new Error('Markdown workspace controller is not initialized');
  return markdownWorkspaceController;
}

function getPrimaryEditorApi() { return getMarkdownWorkspaceController().getPrimaryEditorApi(); }
function restorePrimaryEditorMarkdownView(editorApi) { getMarkdownWorkspaceController().restorePrimaryEditorMarkdownView(editorApi); }
function ensurePrimaryEditorListener() { getMarkdownWorkspaceController().ensurePrimaryEditorListener(); }
function ensurePrimaryEditorTabsMetadataListener() { getMarkdownWorkspaceController().ensurePrimaryEditorTabsMetadataListener(); }
function getDynamicEditorTabs() { return getMarkdownWorkspaceController().getDynamicEditorTabs(); }
function getDynamicTabByMode(mode) { return getMarkdownWorkspaceController().getDynamicTabByMode(mode); }
function isDynamicMode(mode) { return getMarkdownWorkspaceController().isDynamicMode(mode); }
function getFirstDynamicModeId() { return getMarkdownWorkspaceController().getFirstDynamicModeId(); }
function getActiveDynamicTab() { return getMarkdownWorkspaceController().getActiveDynamicTab(); }
function activateDynamicMode(mode) { return getMarkdownWorkspaceController().activateDynamicMode(mode); }
function clearActiveDynamicMode(mode = null) { getMarkdownWorkspaceController().clearActiveDynamicMode(mode); }
function persistDynamicEditorState() { return getMarkdownWorkspaceController().persistDynamicEditorState(); }
function restoreDynamicEditorState() { return getMarkdownWorkspaceController().restoreDynamicEditorState(); }
function setTabLoadingState(tab, isLoading) { getMarkdownWorkspaceController().setTabLoadingState(tab, isLoading); }
function detachPrimaryEditorListeners() { getMarkdownWorkspaceController().detachPrimaryEditorListeners(); }
function updateMarkdownActionsForTab(tab) { getMarkdownWorkspaceController().updateMarkdownActionsForTab(tab); }
function getMarkdownPushButton() { return getMarkdownWorkspaceController().getMarkdownPushButton(); }
function getMarkdownDiscardButton() { return getMarkdownWorkspaceController().getMarkdownDiscardButton(); }
function getMarkdownSaveButton() { return getMarkdownWorkspaceController().getMarkdownSaveButton(); }
function setMarkdownPushButton(button) { getMarkdownWorkspaceController().setMarkdownPushButton(button); }
function setMarkdownDiscardButton(button) { getMarkdownWorkspaceController().setMarkdownDiscardButton(button); }
function setMarkdownSaveButton(button) { getMarkdownWorkspaceController().setMarkdownSaveButton(button); }
function setMarkdownProtectionButton(button) { getMarkdownWorkspaceController().setMarkdownProtectionButton(button); }
function getMarkdownPushLabel(kind) { return getMarkdownWorkspaceController().getMarkdownPushLabel(kind); }
function getMarkdownDiscardLabel() { return getMarkdownWorkspaceController().getMarkdownDiscardLabel(); }
function getMarkdownDiscardBusyLabel() { return getMarkdownWorkspaceController().getMarkdownDiscardBusyLabel(); }
function getMarkdownSaveLabel() { return getMarkdownWorkspaceController().getMarkdownSaveLabel(); }
function getMarkdownSaveBusyLabel() { return getMarkdownWorkspaceController().getMarkdownSaveBusyLabel(); }
function getMarkdownSaveTooltip(kind) { return getMarkdownWorkspaceController().getMarkdownSaveTooltip(kind); }
function updateMarkdownPushButton(tab) { getMarkdownWorkspaceController().updateMarkdownPushButton(tab); }
function updateMarkdownDiscardButton(tab) { getMarkdownWorkspaceController().updateMarkdownDiscardButton(tab); }
function updateMarkdownSaveButton(tab) { getMarkdownWorkspaceController().updateMarkdownSaveButton(tab); }
function updateMarkdownProtectionButton(tab) { getMarkdownWorkspaceController().updateMarkdownProtectionButton(tab); }
function pushEditorCurrentFileInfo(tab) { getMarkdownWorkspaceController().pushEditorCurrentFileInfo(tab); }
function setDynamicTabStatus(tab, status) { return getMarkdownWorkspaceController().setDynamicTabStatus(tab, status); }
async function closeDynamicTab(modeId, options = {}) { return getMarkdownWorkspaceController().closeDynamicTab(modeId, options); }
function getOrCreateDynamicMode(path, options = {}) { return getMarkdownWorkspaceController().getOrCreateDynamicMode(path, options); }
async function loadDynamicTabContent(tab) { return getMarkdownWorkspaceController().loadDynamicTabContent(tab); }
function openMarkdownInEditor(path, options = {}) { return getMarkdownWorkspaceController().openMarkdownInEditor(path, options); }

function getTrackedPublishContentRoot() {
  const site = getStateSlice('site') || {};
  const root = safeString(site.contentRoot || 'wwwroot')
    .replace(/[\\]/g, '/')
    .replace(/\/+$/g, '');
  return root || 'wwwroot';
}

function applyMode(mode, options = {}) {
  if (!modeController) return;
  modeController.applyMode(mode, options);
}

function getInitialComposerFile() {
  try {
    const v = (editorRuntime.storage.getItem(scopedEditorStorageKey(LS_KEYS.cfile)) || '').toLowerCase();
    if (v === 'site') return v;
  } catch (_) {}
  return 'site';
}

function cancelComposerViewTransition() {
  if (!composerViewTransition) return;
  const { panels, cleanup } = composerViewTransition;
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch (_) {}
  }
  if (panels) {
    panels.classList.remove('is-hidden');
    panels.classList.remove('is-transitioning');
  }
  composerViewTransition = null;
}

function applyComposerFile(name, options = {}) {
  const target = name === 'tabs' ? 'tabs' : (name === 'site' ? 'site' : 'index');
  const force = !!options.force;
  const immediate = !!options.immediate;
  if (!force && activeComposerFile === target) {
    if (immediate) cancelComposerViewTransition();
    return;
  }

  const panels = document.getElementById('composerPanels');
  const reduceMotion = immediate || composerPrefersReducedMotion();

  activeComposerFile = target;

  const updateToggleUi = () => {
    const normalized = getActiveComposerFile();
    try {
      $$('a.vt-btn[data-cfile]').forEach(a => {
        a.classList.toggle('active', a.dataset.cfile === normalized);
      });
    } catch (_) {}
    try {
      const btn = $('#btnAddItem');
      if (btn) {
        if (normalized === 'index') {
          const key = 'editor.composer.addPost';
          btn.hidden = false;
          btn.style.display = '';
          btn.setAttribute('data-i18n', key);
          btn.textContent = t(key);
        } else if (normalized === 'tabs') {
          const key = 'editor.composer.addTab';
          btn.hidden = false;
          btn.style.display = '';
          btn.setAttribute('data-i18n', key);
          btn.textContent = t(key);
        } else {
          btn.hidden = true;
          btn.style.display = 'none';
        }
      }
    } catch (_) {}
  };

  updateToggleUi();

  const applyState = () => {
    const normalized = getActiveComposerFile();
    const showIndex = normalized === 'index';
    const showTabs = normalized === 'tabs';
    const showSite = normalized === 'site';
    try {
      const hostIndex = document.getElementById('composerIndexHost');
      if (hostIndex) hostIndex.style.display = showIndex ? '' : 'none';
    } catch (_) {}
    try {
      const hostTabs = document.getElementById('composerTabsHost');
      if (hostTabs) hostTabs.style.display = showTabs ? '' : 'none';
    } catch (_) {}
    try {
      const hostSite = document.getElementById('composerSiteHost');
      if (hostSite) hostSite.style.display = showSite ? '' : 'none';
    } catch (_) {}
    try { $('#composerIndex').style.display = showIndex ? 'block' : 'none'; } catch (_) {}
    try { $('#composerTabs').style.display = showTabs ? 'block' : 'none'; } catch (_) {}
    try { $('#composerSite').style.display = showSite ? 'block' : 'none'; } catch (_) {}
    // Sync preload attribute to avoid CSS forcing the wrong sub-file
    try {
      if (normalized === 'tabs' || normalized === 'site') document.documentElement.setAttribute('data-init-cfile', normalized);
      else document.documentElement.removeAttribute('data-init-cfile');
    } catch (_) {}

    try {
      if (normalized === 'site') setComposerOrderPreviewActiveKind('index');
      else setComposerOrderPreviewActiveKind(normalized);
    } catch (_) {}
    const summaryOptions = normalized === 'site' ? { immediate: true } : undefined;
    try { updateUnsyncedSummary(summaryOptions); } catch (_) {}
  };

  if (!panels || reduceMotion) {
    cancelComposerViewTransition();
    applyState();
    if (panels) {
      panels.classList.remove('is-hidden');
      panels.classList.remove('is-transitioning');
    }
    return;
  }

  cancelComposerViewTransition();

  const duration = 200;
  const state = { panels };
  composerViewTransition = state;
  let switched = false;
  let finished = false;
  let timerOut = null;
  let timerIn = null;

  const clearTimerOut = () => {
    if (timerOut != null) {
      clearTimeout(timerOut);
      timerOut = null;
    }
  };

  const clearTimerIn = () => {
    if (timerIn != null) {
      clearTimeout(timerIn);
      timerIn = null;
    }
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimerIn();
    panels.classList.remove('is-transitioning');
    panels.classList.remove('is-hidden');
    panels.removeEventListener('transitionend', handleFadeOut);
    panels.removeEventListener('transitionend', handleFadeIn);
    composerViewTransition = null;
  };

  const handleFadeIn = (event) => {
    if (event && (event.target !== panels || event.propertyName !== 'opacity')) return;
    clearTimerIn();
    finish();
  };

  const startFadeIn = () => {
    if (switched) return;
    switched = true;
    panels.removeEventListener('transitionend', handleFadeOut);
    clearTimerOut();
    applyState();
    requestAnimationFrame(() => {
      if (finished) return;
      panels.addEventListener('transitionend', handleFadeIn);
      panels.classList.remove('is-hidden');
      timerIn = window.setTimeout(() => handleFadeIn({ target: panels, propertyName: 'opacity' }), duration + 80);
    });
  };

  const handleFadeOut = (event) => {
    if (event && (event.target !== panels || event.propertyName !== 'opacity')) return;
    startFadeIn();
  };

  state.cleanup = () => {
    clearTimerOut();
    clearTimerIn();
    panels.removeEventListener('transitionend', handleFadeOut);
    panels.removeEventListener('transitionend', handleFadeIn);
  };

  panels.addEventListener('transitionend', handleFadeOut);
  panels.classList.add('is-transitioning');

  requestAnimationFrame(() => {
    if (finished) return;
    panels.classList.add('is-hidden');
    timerOut = window.setTimeout(() => startFadeIn(), duration + 80);
  });
}

// Apply initial state as early as possible to avoid flash on reload
(() => {
  try { applyMode('editor'); } catch (_) {}
  try { applyComposerFile(getInitialComposerFile(), { immediate: true, force: true }); } catch (_) {}
  try { updateDynamicTabsGroupState(); } catch (_) {}
})();

// Robust clipboard helper available to all composer flows
async function nsCopyToClipboard(text) {
  const val = String(text || '');
  // Prefer async Clipboard API when in a secure context
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // Intentionally do not await in callers to better preserve user-activation
      await navigator.clipboard.writeText(val);
      return true;
    }
  } catch (_) { /* fall through to legacy */ }
  // Legacy fallback: temporary textarea + execCommand('copy')
  try {
    const ta = document.createElement('textarea');
    ta.value = val;
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    try { document.body.removeChild(ta); } catch (_) {}
    return ok;
  } catch (_) { return false; }
}

function sortLangKeys(obj) {
  const keys = Object.keys(obj || {});
  return keys.sort((a, b) => {
    const ia = PREFERRED_LANG_ORDER.indexOf(normalizeLangCode(a));
    const ib = PREFERRED_LANG_ORDER.indexOf(normalizeLangCode(b));
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b);
  });
}

// Localized display names for languages in UI menus
function displayLangName(code) {
  const normalized = normalizeLangCode(code);
  if (!normalized) return '';
  try {
    const label = getLanguageLabel(normalized);
    if (label && String(label).trim()) return String(label).trim();
  } catch (_) {}
  return normalized.toUpperCase();
}

function langFlag(code) {
  const c = normalizeLangCode(code);
  if (c === 'en') return '🇺🇸';
  if (c === 'chs') return '🇨🇳';
  if (c === 'cht-tw') return '🇹🇼';
  if (c === 'cht-hk') return '🇭🇰';
  if (c === 'ja') return '🇯🇵';
  return '';
}

function q(s) {
  // Double-quoted YAML scalar with basic escapes
  const str = String(s ?? '');
  return '"' + str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\"/g, '\\"') + '"';
}

function toIndexYaml(data) {
  const lines = [
    '# yaml-language-server: $schema=../assets/schema/index.json',
    ''
  ];
  const keys = data.__order && Array.isArray(data.__order) ? data.__order.slice() : Object.keys(data).filter(k => k !== '__order');
  keys.forEach(key => {
    const entry = data[key];
    if (!entry || typeof entry !== 'object') return;
    lines.push(`${key}:`);
    const langs = sortLangKeys(entry);
    langs.forEach(lang => {
      const v = entry[lang];
      if (Array.isArray(v)) {
        const hasMetadata = v.some(item => isIndexMetadataObject(item));
        if (hasMetadata) {
          lines.push(`  ${lang}:`);
          writeYamlValue(lines, 2, v);
        } else if (v.length <= 1) {
          const one = v[0] ?? '';
          lines.push(`  ${lang}: ${one ? one : '""'}`);
        } else {
          lines.push(`  ${lang}:`);
          v.forEach(p => lines.push(`    - ${p}`));
        }
      } else if (typeof v === 'string') {
        lines.push(`  ${lang}: ${v}`);
      } else if (isIndexMetadataObject(v)) {
        lines.push(`  ${lang}:`);
        writeYamlValue(lines, 2, v);
      }
    });
  });
  return lines.join('\n') + '\n';
}

function toTabsYaml(data) {
  const lines = [
    '# yaml-language-server: $schema=../assets/schema/tabs.json',
    ''
  ];
  const keys = data.__order && Array.isArray(data.__order) ? data.__order.slice() : Object.keys(data).filter(k => k !== '__order');
  keys.forEach(tab => {
    const entry = data[tab];
    if (!entry || typeof entry !== 'object') return;
    lines.push(`${tab}:`);
    const langs = sortLangKeys(entry);
    langs.forEach(lang => {
      const v = entry[lang];
      if (v && typeof v === 'object') {
        const title = v.title ?? '';
        const loc = v.location ?? '';
        lines.push(`  ${lang}:`);
        lines.push(`    title: ${q(title)}`);
        lines.push(`    location: ${loc ? loc : '""'}`);
      }
    });
    lines.push('');
  });
  // Remove extra trailing blank line
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
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

const editorFileTreeUi = createEditorFileTreeUi({
  documentRef: document,
  windowRef: window,
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
  documentRef: document,
  windowRef: window,
  consoleRef: console,
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

function setEditorStructurePanelVisible(visible) {
  const panel = document.getElementById('editorStructurePanel');
  if (!panel) return;
  if (visible) {
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
  } else {
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-hidden', 'true');
  }
}

function setEditorMarkdownPanelVisible(visible) {
  const panel = document.getElementById('editorMarkdownPanel');
  if (!panel) return;
  if (visible) {
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
  } else {
    panel.setAttribute('hidden', '');
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('is-content-entering');
  }
}

function setEditorDetailPanelMode(mode) {
  const showMarkdown = mode === 'markdown';
  const showStructure = mode === 'structure';
  const showSystem = mode === 'composer' || mode === 'themes' || mode === 'updates' || mode === 'sync';
  setEditorStructurePanelVisible(showStructure);
  setEditorMarkdownPanelVisible(showMarkdown);
  setEditorSystemPanelVisible(showSystem);
  if (showSystem) showEditorSystemPanel(mode);
}

function animateEditorStructurePanelContent(panel) {
  if (!panel) return;
  try {
    const previousTimer = panel.__pressStructureAnimationTimer;
    if (previousTimer) window.clearTimeout(previousTimer);
  } catch (_) {}
  panel.classList.remove('is-content-entering');
  try { panel.getBoundingClientRect(); } catch (_) {}
  panel.classList.add('is-content-entering');
  try {
    panel.__pressStructureAnimationTimer = window.setTimeout(() => {
      panel.classList.remove('is-content-entering');
      panel.__pressStructureAnimationTimer = null;
    }, 260);
  } catch (_) {}
}

function animateEditorMarkdownPanelContent() {
  const panel = document.getElementById('editorMarkdownPanel');
  if (!panel) return;
  try {
    const previousTimer = panel.__pressMarkdownAnimationTimer;
    if (previousTimer) window.clearTimeout(previousTimer);
  } catch (_) {}
  panel.classList.remove('is-content-entering');
  try { panel.getBoundingClientRect(); } catch (_) {}
  panel.classList.add('is-content-entering');
  try {
    panel.__pressMarkdownAnimationTimer = window.setTimeout(() => {
      panel.classList.remove('is-content-entering');
      panel.__pressMarkdownAnimationTimer = null;
    }, 260);
  } catch (_) {}
}

function collectEditorDraftStatusMap() {
  const map = new Map();
  try {
    const store = readMarkdownDraftStore();
    Object.keys(store || {}).forEach((key) => {
      const path = normalizeRelPath(key);
      if (path && store[key] && store[key].content) map.set(path, 'saved');
    });
  } catch (_) {}
  try {
    collectDynamicMarkdownDraftStates().forEach((value, key) => {
      if (key && value) map.set(key, value);
    });
  } catch (_) {}
  return map;
}

function collectEditorFileStatusMap() {
  return getMarkdownSessionController().collectFileStatusMap();
}

function collectEditorDiffStatusMap() {
  const map = new Map();
  const add = (id, value) => {
    if (id && value) map.set(id, value);
  };
  const applyDiff = (source, diff) => {
    if (!diff) return;
    (diff.addedKeys || []).forEach(key => add(`${source}:${key}`, 'added'));
    (diff.removedKeys || []).forEach(key => add(`${source}:${key}`, 'removed'));
    Object.keys(diff.keys || {}).forEach((key) => {
      const info = diff.keys[key] || {};
      add(`${source}:${key}`, info.state || 'modified');
      Object.keys(info.langs || {}).forEach((lang) => {
        const detail = info.langs[lang] || {};
        add(`${source}:${key}:${lang}`, detail.state || 'modified');
      });
    });
  };
  applyDiff('index', composerStateStore.getDiff('index'));
  applyDiff('tabs', composerStateStore.getDiff('tabs'));
  try {
    const siteDiff = composerStateStore.getDiff('site') || recomputeDiff('site');
    if (siteDiff && siteDiff.hasChanges) add('system:site-settings', 'modified');
    else if (getComposerDraftMeta('site')) add('system:site-settings', 'saved');
  } catch (_) {
    try {
      if (getComposerDraftMeta('site')) add('system:site-settings', 'saved');
    } catch (__) {}
  }
  try {
    if (composerSystemThemeBridge.hasSystemUpdateEntries()) add('system:updates', 'modified');
  } catch (_) {}
  try {
    if (composerSystemThemeBridge.hasThemeEntries()) add('system:themes', 'modified');
  } catch (_) {}
  return map;
}

function buildCurrentEditorTree() {
  return buildEditorContentTree({
    index: getStateSlice('index') || { __order: [] },
    tabs: getStateSlice('tabs') || { __order: [] }
  }, {
    preferredLangs: PREFERRED_LANG_ORDER,
    welcomeLabel: treeText('welcome', 'Welcome'),
    systemLabel: treeText('system', 'System'),
    siteSettingsLabel: treeText('siteSettings', 'Site Settings'),
    themesLabel: treeText('themes', 'Themes'),
    updatesLabel: treeText('pressUpdates', 'Press Updates'),
    syncLabel: treeText('sync', 'Publish'),
    articlesLabel: treeText('articles', 'Articles'),
    pagesLabel: treeText('pages', 'Pages'),
    draftStates: collectEditorDraftStatusMap(),
    diffStates: collectEditorDiffStatusMap(),
    fileStates: collectEditorFileStatusMap(),
    indexDiff: composerStateStore.getDiff('index') || null,
    tabsDiff: composerStateStore.getDiff('tabs') || null,
    indexBaseline: composerStateStore.getRemoteBaseline('index') || null,
    tabsBaseline: composerStateStore.getRemoteBaseline('tabs') || null
  });
}

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

function refreshEditorContentTree(options = {}) {
  editorContentTreeController.refresh(options);
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
  const root = document.getElementById('composerSite');
  if (!root) return;
  composerSiteSettingsUi.buildSiteUI(root, composerStateStore.getActiveState());
  notifyComposerChange('site', { skipAutoSave: true });
}

initializeComposerApp({
  documentRef: document,
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
    windowRef: window,
    consoleRef: console,
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
    documentRef: document,
    windowRef: window,
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
      documentRef: document,
      consoleRef: console,
      mountEditorSystemPanels,
      initEditorOverlay,
      initEditorRailResize,
      initMobileEditorRail,
      bindEditorStatePersistenceListeners,
      openEditorOverlay,
      applyMode,
      initSystemThemeBridge: () => composerSystemThemeBridge.init(),
      setComposerFile: (name, options = {}) => {
        applyComposerFile(name, options);
        try {
          const normalized = name === 'tabs' ? 'tabs' : (name === 'site' ? 'site' : 'index');
          editorRuntime.storage.setItem(scopedEditorStorageKey(LS_KEYS.cfile), normalized);
        } catch (_) {}
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
    setAllowEditorStatePersist: (value) => {
      allowEditorStatePersist = !!value;
    },
    persistDynamicEditorState,
    setTimeoutRef: (handler, delay) => window.setTimeout(handler, delay)
  }
});

injectComposerRuntimeStyles({ documentRef: document });
