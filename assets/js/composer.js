import './cache-control.js';
import { getManualMarkdownSaveState } from './composer-markdown-save.js';
import {
  fetchConfigWithYamlFallback,
  fetchSiteLocalOverride,
  fetchTrackedSiteConfig,
  mergeYamlConfig,
  resolveSiteRepoConfig,
  parseYAML
} from './yaml.js';
import { escapeHtml } from './utils.js?v=press-system-v3.4.46';
import { t, getAvailableLangs, getLanguageLabel } from './i18n.js?v=press-system-v3.4.46';
import { initSystemUpdates, getSystemUpdateSummaryEntries, getSystemUpdateCommitFiles, clearSystemUpdateState } from './system-updates.js?v=press-system-v3.4.46';
import { initThemeManager, getThemeManagerSummaryEntries, getThemeManagerCommitFiles, clearThemeManagerState } from './theme-manager.js?v=press-system-v3.4.46';
import { buildEditorContentTree, findEditorContentTreeNode, flattenEditorContentTree } from './editor-content-tree.js?v=press-system-v3.4.46';
import {
  decryptMarkdownDocument,
  encryptMarkdownDocument,
  parseEncryptedMarkdownEnvelope
} from './encrypted-content.js?v=press-system-v3.4.46';
import { createStagingRegistry } from './composer-staging.js?v=press-system-v3.4.46';
import { createIndexPublishMetadataEnricher } from './composer-index-publish-metadata.js?v=press-system-v3.4.46';
import { createContentCommitStagingProvider } from './composer-content-staging.js?v=press-system-v3.4.46';
import { createSeoStagingProvider } from './composer-seo-staging.js?v=press-system-v3.4.46';
import { createPostCommitStateApplier } from './composer-post-commit-state.js?v=press-system-v3.4.46';
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
} from './composer-index-tabs-model.js?v=press-system-v3.4.46';
import {
  cloneSiteState,
  computeSiteDiff,
  computeSiteSignature,
  prepareSiteState,
  toSiteYaml,
  writeYamlValue
} from './composer-site-model.js?v=press-system-v3.4.46';
import {
  createScopedStorageKey,
  resolveEditorStorageScope
} from './editor-storage.js?v=press-system-v3.4.46';
import { createScopedDraftStore } from './editor-drafts.js?v=press-system-v3.4.46';
import { createEditorSessionStateStore } from './editor-session-state.js?v=press-system-v3.4.46';
import {
  refreshSyncCommitPanelView,
  scheduleSyncCommitPanelRefreshView
} from './composer-sync-panel.js?v=press-system-v3.4.46';
import { createSyncOverlayController } from './composer-sync-overlay.js?v=press-system-v3.4.46';
import { createPublishTransportSettingsUi } from './composer-publish-settings-ui.js?v=press-system-v3.4.46';
import { createPublishSummaryRenderer } from './composer-publish-summary.js?v=press-system-v3.4.46';
import { createComposerPublishFlow } from './composer-publish-flow.js?v=press-system-v3.4.46';
import { createComposerNotificationController } from './composer-notifications.js?v=press-system-v3.4.46';
import { createComposerDialogController } from './composer-dialogs.js?v=press-system-v3.4.46';
import { createComposerRemoteSyncController } from './composer-remote-sync.js?v=press-system-v3.4.46';
import { createComposerDiffUi } from './composer-diff-ui.js?v=press-system-v3.4.46';
import { createComposerOrderDiffUi } from './composer-order-diff-ui.js?v=press-system-v3.4.46';
import { createComposerIndexTabsUi } from './composer-index-tabs-ui.js?v=press-system-v3.4.46';
import { createComposerSiteSettingsUi } from './composer-site-settings-ui.js?v=press-system-v3.4.46';
import { createComposerMarkdownAssetManager } from './composer-markdown-assets.js?v=press-system-v3.4.46';
import { createComposerEditorShell } from './composer-editor-shell.js?v=press-system-v3.4.46';
import { createComposerPathTools } from './composer-path-tools.js?v=press-system-v3.4.46';
import { createComposerContentMutationController } from './composer-content-mutations.js?v=press-system-v3.4.46';
import { createComposerSetupVerifier } from './composer-setup-verifier.js?v=press-system-v3.4.46';
import { createComposerModeController, isComposerSystemMode } from './composer-mode-controller.js?v=press-system-v3.4.46';
import { createComposerUnsyncedSummaryController } from './composer-unsynced-summary.js?v=press-system-v3.4.46';
import { createEditorContentTreeController } from './editor-content-tree-controller.js?v=press-system-v3.4.46';
import { createComposerMarkdownLoader } from './composer-markdown-loader.js?v=press-system-v3.4.46';
import { createComposerMarkdownActionsUi } from './composer-markdown-actions-ui.js?v=press-system-v3.4.46';
import { createComposerMarkdownActionsController } from './composer-markdown-actions.js?v=press-system-v3.4.46';
import { createComposerMarkdownDraftController } from './composer-markdown-drafts.js?v=press-system-v3.4.46';
import { createComposerMarkdownSessionController } from './composer-markdown-session.js?v=press-system-v3.4.46';
import { createComposerYamlDraftController } from './composer-yaml-drafts.js?v=press-system-v3.4.46';
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
} from './composer-markdown-state.js?v=press-system-v3.4.46';
import { createEditorFileTreeUi } from './editor-file-tree-ui.js?v=press-system-v3.4.46';
import { createEditorStructurePanelUi } from './editor-structure-panel-ui.js?v=press-system-v3.4.46';
import {
  CONNECT_PUBLISH_PRESETS,
  createPublishSettingsStore
} from './publish/settings-store.js?v=press-system-v3.4.46';

// Utility helpers
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const PREFERRED_LANG_ORDER = ['en', 'chs', 'cht-tw', 'cht-hk', 'ja'];
const LANG_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
const LANGUAGE_POOL_CHANGED_EVENT = 'press-composer-language-pool-changed';
const composerPathTools = createComposerPathTools({
  windowRef: window,
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
  if (typeof document === 'undefined' || typeof document.dispatchEvent !== 'function') return;
  try {
    document.dispatchEvent(new CustomEvent(LANGUAGE_POOL_CHANGED_EVENT));
  } catch (_) {}
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
  try { return resolveEditorStorageScope(window.location); }
  catch (_) { return 'unknown'; }
})();

function scopedEditorStorageKey(key) {
  return createScopedStorageKey(EDITOR_STORAGE_SCOPE, key);
}

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
  storage: window.localStorage,
  storageKey: DRAFT_STORAGE_KEY,
  scopeKey: scopedEditorStorageKey
});
const markdownDraftStore = createScopedDraftStore({
  storage: window.localStorage,
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
  getRemoteBaseline: () => remoteBaseline,
  getComposerDiffCache: () => composerDiffCache,
  setComposerDiff: (kind, diff) => {
    composerDiffCache[kind] = diff;
  },
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
  getRemoteBaselineSite: () => remoteBaseline.site,
  cloneSiteState,
  isIndexMetadataObject,
  getIndexVariantLocation
});
let markdownLoader = null;
let markdownActionsUi = null;
let markdownDraftController = null;
let markdownSessionController = null;
let modeController = null;
let unsyncedSummaryController = null;
const postCommitStateApplier = createPostCommitStateApplier({
  stagingRegistry,
  getStateSlice,
  getRemoteBaseline: () => remoteBaseline,
  setRemoteBaselineSlice: (kind, value) => {
    remoteBaseline[kind] = value;
  },
  deepClone,
  prepareIndexState,
  prepareTabsState,
  prepareSiteState,
  cloneSiteState,
  notifyComposerChange,
  clearDraftStorage,
  getContentRootSafe,
  applyComposerEffectiveSiteConfig,
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
stagingRegistry.registerStagingProvider({
  id: 'system-updates',
  getSummaryEntries: () => getSystemUpdateSummaryEntries().map(entry => ({ ...entry, kind: 'system' })),
  getCommitFiles: () => getSystemUpdateCommitFiles().map(entry => ({ ...entry, kind: 'system' })),
  clear: () => clearSystemUpdateState({ keepStatus: false })
});
stagingRegistry.registerStagingProvider({
  id: 'themes',
  getSummaryEntries: () => getThemeManagerSummaryEntries().map(entry => ({ ...entry, kind: 'system', category: 'theme' })),
  getCommitFiles: () => getThemeManagerCommitFiles().map(entry => ({ ...entry, kind: 'system', category: 'theme' })),
  clear: () => clearThemeManagerState({ keepStatus: false, keepRegistryCache: true, keepSiteThemeFallback: true })
});
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
  storage: window.localStorage,
  scopeKey: scopedEditorStorageKey,
  keys: LS_KEYS
});

let detachPrimaryEditorListener = null;
let detachPrimaryEditorTabsMetadataListener = null;
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
  setRemoteBaseline: (kind, value) => {
    remoteBaseline[kind] = value;
  },
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

let activeComposerState = null;
let remoteBaseline = { index: null, tabs: null, site: null };
let composerSiteLocalOverride = {};
let composerDiffCache = { index: null, tabs: null, site: null };
let activeComposerFile = 'index';
let composerViewTransition = null;

const composerYamlDraftController = createComposerYamlDraftController({
  draftStore: composerDraftStore,
  getStateSlice,
  setStateSlice,
  getComposerDiff: (kind) => composerDiffCache[kind],
  computeBaselineSignature,
  prepareIndexState,
  prepareTabsState,
  cloneSiteState,
  updateUnsyncedSummary,
  setTimeoutRef: (handler, delay) => window.setTimeout(handler, delay),
  clearTimeoutRef: (id) => window.clearTimeout(id)
});

let composerReduceMotionQuery = null;
const composerInlineVisibilityAnimations = new WeakMap();
const composerInlineVisibilityFallbacks = new WeakMap();
const composerListTransitions = new WeakMap();
const composerOrderMainTransitions = new WeakMap();
let composerSiteScrollAnimationId = null;
let composerSiteScrollCleanup = null;

function syncSiteEditorSingleLabelWidth(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  try {
    if (typeof root.__pressSiteSingleLabelWidthCleanup === 'function') root.__pressSiteSingleLabelWidthCleanup();
  } catch (_) {}
  try { root.__pressSiteSingleLabelWidthCleanup = null; } catch (_) {}

  const labels = Array.from(root.querySelectorAll('.cs-single-grid-title'));
  if (!labels.length) {
    try { root.style.removeProperty('--cs-editor-single-label-width'); } catch (_) {}
    return;
  }

  let frame = 0;
  let observer = null;
  const requestFrame = (fn) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(fn);
    }
    if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn);
    return setTimeout(fn, 0);
  };
  const cancelFrame = (id) => {
    if (!id) return;
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(id);
      return;
    }
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
    else clearTimeout(id);
  };
  const measure = () => {
    frame = 0;
    let width = 88;
    labels.forEach((label) => {
      const cell = label.closest ? label.closest('.cs-single-grid-label') : label;
      const target = cell || label;
      let measured = 0;
      try {
        const tooltip = target.querySelector ? target.querySelector('.cs-help-tooltip') : null;
        const tooltipWidth = tooltip ? tooltip.scrollWidth || 0 : 0;
        const labelWidth = label.scrollWidth || 0;
        const targetStyle = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
          ? window.getComputedStyle(target)
          : null;
        const gap = targetStyle ? parseFloat(targetStyle.gap || targetStyle.columnGap || '0') || 0 : 0;
        measured = labelWidth + tooltipWidth + gap;
      } catch (_) {
        try {
          const tooltip = target.querySelector ? target.querySelector('.cs-help-tooltip') : null;
          measured = (label.scrollWidth || 0) + (tooltip ? tooltip.scrollWidth || 0 : 0);
        } catch (_) {}
      }
      width = Math.max(width, measured);
    });
    try { root.style.setProperty('--cs-editor-single-label-width', `${Math.ceil(width)}px`); } catch (_) {}
  };
  const schedule = () => {
    if (frame) return;
    frame = requestFrame(measure);
  };

  if (typeof ResizeObserver === 'function') {
    try {
      observer = new ResizeObserver(schedule);
      observer.observe(root);
      labels.forEach((label) => {
        const cell = label.closest ? label.closest('.cs-single-grid-label') : label;
        observer.observe(cell || label);
      });
    } catch (_) {
      observer = null;
    }
  }

  try {
    if (document.fonts && typeof document.fonts.ready?.then === 'function') document.fonts.ready.then(schedule).catch(() => {});
  } catch (_) {}
  schedule();

  root.__pressSiteSingleLabelWidthCleanup = () => {
    cancelFrame(frame);
    frame = 0;
    try { if (observer) observer.disconnect(); } catch (_) {}
    observer = null;
  };
}

function applyComposerEffectiveSiteConfig(siteConfig) {
  const tracked = siteConfig && typeof siteConfig === 'object' ? siteConfig : {};
  const effective = mergeYamlConfig(tracked, composerSiteLocalOverride);
  const root = (effective && effective.contentRoot) ? String(effective.contentRoot) : 'wwwroot';
  try {
    window.__press_content_root = root;
  } catch (_) {}
  try {
    const repo = (effective && effective.repo) || {};
    window.__press_site_repo = {
      owner: String(repo.owner || ''),
      name: String(repo.name || ''),
      branch: String(repo.branch || 'main')
    };
  } catch (_) {
    try {
      window.__press_site_repo = { owner: '', name: '', branch: 'main' };
    } catch (_) {}
  }
  try {
    window.dispatchEvent(new CustomEvent('press-editor-site-config-change', {
      detail: { siteConfig: deepClone(effective) }
    }));
  } catch (_) {}
  return effective;
}

function inferRepoConfigFromGitHubPagesUrl(locationLike) {
  let protocol = '';
  let hostname = '';
  let pathname = '';

  try {
    if (typeof locationLike === 'string') {
      const url = new URL(locationLike);
      protocol = url.protocol;
      hostname = url.hostname;
      pathname = url.pathname;
    } else if (locationLike && typeof locationLike === 'object') {
      if (locationLike.href) {
        const url = new URL(String(locationLike.href));
        protocol = url.protocol;
        hostname = url.hostname;
        pathname = url.pathname;
      } else {
        protocol = String(locationLike.protocol || '');
        hostname = String(locationLike.hostname || '');
        pathname = String(locationLike.pathname || '');
      }
    }
  } catch (_) {
    return null;
  }

  if (protocol !== 'https:') return null;
  const host = String(hostname || '').trim().toLowerCase();
  const suffix = '.github.io';
  if (!host.endsWith(suffix)) return null;
  const owner = host.slice(0, -suffix.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(owner)) return null;

  const path = String(pathname || '');
  const rawSegments = path.split('/').filter(Boolean);
  const firstSegment = rawSegments[0] || '';
  const isRootIndexFile = rawSegments.length === 1
    && (firstSegment === 'index.html' || firstSegment === 'index_editor.html')
    && !path.endsWith('/');
  let name = '';
  if (!firstSegment || isRootIndexFile) {
    name = `${owner}.github.io`;
  } else {
    try {
      name = decodeURIComponent(firstSegment);
    } catch (_) {
      return null;
    }
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return null;

  return { owner, name, branch: 'main' };
}

function isPlaceholderRepoConfig(repo) {
  const source = repo && typeof repo === 'object' ? repo : {};
  const owner = String(source.owner || '').trim();
  const name = String(source.name || '').trim();
  const ownerIsPlaceholder = owner === '' || owner === 'OWNER';
  const nameIsPlaceholder = name === '' || name === 'REPOSITORY';
  return ownerIsPlaceholder && nameIsPlaceholder;
}

function isSameRepoConfig(repo, inferred) {
  const source = repo && typeof repo === 'object' ? repo : {};
  const inferredSource = inferred && typeof inferred === 'object' ? inferred : {};
  const owner = String(source.owner || '').trim().toLowerCase();
  const name = String(source.name || '').trim().toLowerCase();
  const inferredOwner = String(inferredSource.owner || '').trim().toLowerCase();
  const inferredName = String(inferredSource.name || '').trim().toLowerCase();
  return !!owner && !!name && owner === inferredOwner && name === inferredName;
}

function shouldAutofillRepoFromPages(site) {
  const extras = site && site.__extras && typeof site.__extras === 'object' ? site.__extras : {};
  const value = extras.repoAutofillFromPages;
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

function clearRepoAutofillFromPagesMarker(site) {
  if (!site.__extras || typeof site.__extras !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(site.__extras, 'repoAutofillFromPages')) {
    delete site.__extras.repoAutofillFromPages;
  }
}

function applyInferredRepoConfig(site, inferred) {
  if (!site || typeof site !== 'object') return false;
  if (!inferred || typeof inferred !== 'object') return false;
  const owner = String(inferred.owner || '').trim();
  const name = String(inferred.name || '').trim();
  const branch = String(inferred.branch || 'main').trim() || 'main';
  if (!owner || !name) return false;

  const repo = site.repo && typeof site.repo === 'object' ? site.repo : {};
  const canAutofill = isPlaceholderRepoConfig(repo)
    || (shouldAutofillRepoFromPages(site) && !isSameRepoConfig(repo, inferred));
  if (!canAutofill) return false;

  const previousOwner = String(repo.owner || '').trim();
  const previousName = String(repo.name || '').trim();
  const previousBranch = String(repo.branch || '').trim();
  site.repo = repo;
  repo.owner = owner;
  repo.name = name;
  if (!previousBranch) repo.branch = branch;
  clearRepoAutofillFromPagesMarker(site);

  return previousOwner !== String(repo.owner || '').trim()
    || previousName !== String(repo.name || '').trim()
    || previousBranch !== String(repo.branch || '').trim();
}

async function fetchComposerTrackedSiteConfig() {
  const tracked = await fetchTrackedSiteConfig();
  composerSiteLocalOverride = await fetchSiteLocalOverride();
  applyComposerEffectiveSiteConfig(tracked || {});
  return tracked || {};
}

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
  getRemoteBaseline: () => remoteBaseline,
  getComposerDiff: (kind) => composerDiffCache[kind],
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
  getComposerDiffCache: () => composerDiffCache,
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

function composerPrefersReducedMotion() {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    if (!composerReduceMotionQuery) composerReduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return !!composerReduceMotionQuery.matches;
  } catch (_) {
    return false;
  }
}

function cancelComposerSiteScrollAnimation() {
  try {
    if (composerSiteScrollAnimationId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(composerSiteScrollAnimationId);
    }
  } catch (_) {}
  composerSiteScrollAnimationId = null;
  if (typeof composerSiteScrollCleanup === 'function') {
    try { composerSiteScrollCleanup(); }
    catch (_) {}
  }
  composerSiteScrollCleanup = null;
}

function createCubicBezierEasing(mX1, mY1, mX2, mY2) {
  const NEWTON_ITERATIONS = 8;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_PRECISION = 1e-7;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const SPLINE_TABLE_SIZE = 11;
  const SAMPLE_STEP_SIZE = 1 / (SPLINE_TABLE_SIZE - 1);

  const sampleValues = new Float32Array(SPLINE_TABLE_SIZE);

  const calcBezier = (t, a1, a2) => (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + (3 * a1)) * t;
  const getSlope = (t, a1, a2) => (3 * (1 - 3 * a2 + 3 * a1) * t + 2 * (3 * a2 - 6 * a1)) * t + (3 * a1);

  for (let i = 0; i < SPLINE_TABLE_SIZE; i += 1) {
    sampleValues[i] = calcBezier(i * SAMPLE_STEP_SIZE, mX1, mX2);
  }

  const binarySubdivide = (x, lowerBound, upperBound) => {
    let currentX = 0;
    let currentT = 0;
    let i = 0;
    do {
      currentT = lowerBound + (upperBound - lowerBound) / 2;
      currentX = calcBezier(currentT, mX1, mX2) - x;
      if (currentX > 0) {
        upperBound = currentT;
      } else {
        lowerBound = currentT;
      }
      i += 1;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  };

  const newtonRaphsonIterate = (x, guessT) => {
    for (let i = 0; i < NEWTON_ITERATIONS; i += 1) {
      const slope = getSlope(guessT, mX1, mX2);
      if (Math.abs(slope) < NEWTON_MIN_SLOPE) return guessT;
      const currentX = calcBezier(guessT, mX1, mX2) - x;
      guessT -= currentX / slope;
    }
    return guessT;
  };

  return (x) => {
    if (mX1 === mY1 && mX2 === mY2) return x;
    let currentSample = 0;
    const lastSample = SPLINE_TABLE_SIZE - 1;
    for (; currentSample !== lastSample && sampleValues[currentSample] <= x; currentSample += 1);
    currentSample -= 1;

    const segmentStart = sampleValues[currentSample];
    const segmentEnd = sampleValues[currentSample + 1];
    const segmentInterval = segmentEnd - segmentStart;
    const dist = segmentInterval > 0 ? (x - segmentStart) / segmentInterval : 0;
    const guessForT = currentSample * SAMPLE_STEP_SIZE + dist * SAMPLE_STEP_SIZE;

    const initialSlope = getSlope(guessForT, mX1, mX2);
    const tCandidate = initialSlope >= NEWTON_MIN_SLOPE
      ? newtonRaphsonIterate(x, guessForT)
      : initialSlope === 0
        ? guessForT
        : binarySubdivide(x, currentSample * SAMPLE_STEP_SIZE, (currentSample + 1) * SAMPLE_STEP_SIZE);

    return calcBezier(tCandidate, mY1, mY2);
  };
}

const easeOutComposerScroll = (t) => Math.min(1, Math.max(0, t));

function resolveComposerScrollDuration(duration) {
  const maxDuration = 1600;
  const minDuration = 120;
  const fallbackDuration = 720;
  const numeric = Number(duration);
  if (Number.isFinite(numeric)) return Math.min(maxDuration, Math.max(minDuration, numeric));
  return fallbackDuration;
}

function animateComposerViewportScroll(targetY, duration, onComplete) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof window.requestAnimationFrame !== 'function' || typeof window.scrollTo !== 'function') return false;

  const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const distance = targetY - startY;
  if (Math.abs(distance) < 0.5) {
    try { window.scrollTo(0, targetY); } catch (_) {}
    if (typeof onComplete === 'function') {
      try { onComplete(); } catch (_) {}
    }
    return true;
  }

  const resolvedDuration = resolveComposerScrollDuration(duration);

  const startTime = (() => {
    try {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
      }
    } catch (_) {}
    return Date.now();
  })();

  cancelComposerSiteScrollAnimation();

  let restoreScrollBehavior = null;
  const rootEl = typeof document !== 'undefined' ? document.documentElement : null;
  if (rootEl && rootEl.style) {
    try {
      const previousBehavior = rootEl.style.scrollBehavior || '';
      const hadInlineBehavior = previousBehavior !== '';
      rootEl.style.scrollBehavior = 'auto';
      restoreScrollBehavior = () => {
        if (!rootEl || !rootEl.style) return;
        if (hadInlineBehavior) rootEl.style.scrollBehavior = previousBehavior;
        else rootEl.style.removeProperty('scroll-behavior');
      };
    } catch (_) {
      restoreScrollBehavior = null;
    }
  }

  if (typeof restoreScrollBehavior === 'function') {
    composerSiteScrollCleanup = () => {
      if (typeof restoreScrollBehavior === 'function') {
        try { restoreScrollBehavior(); }
        catch (_) {}
      }
      restoreScrollBehavior = null;
    };
  } else {
    composerSiteScrollCleanup = null;
  }

  const finalize = (shouldInvokeCallback) => {
    composerSiteScrollAnimationId = null;
    if (typeof composerSiteScrollCleanup === 'function') {
      try { composerSiteScrollCleanup(); }
      catch (_) {}
    }
    composerSiteScrollCleanup = null;
    if (shouldInvokeCallback && typeof onComplete === 'function') {
      try { onComplete(); } catch (_) {}
    }
  };

  const step = (timestamp) => {
    const now = (() => {
      if (typeof timestamp === 'number') return timestamp;
      try {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
          return performance.now();
        }
      } catch (_) {}
      return Date.now();
    })();

    const progress = Math.min(1, (now - startTime) / resolvedDuration);
    const eased = easeOutComposerScroll(progress);
    const nextY = startY + (distance * eased);
    try { window.scrollTo(0, nextY); } catch (_) {}

    if (progress < 1) {
      try {
        composerSiteScrollAnimationId = window.requestAnimationFrame(step);
        return;
      } catch (_) {}
    }

    finalize(true);
  };

  try {
    composerSiteScrollAnimationId = window.requestAnimationFrame(step);
    return true;
  } catch (_) {
    finalize(false);
    return false;
  }
}

function parseCssDuration(value, fallback) {
  const defaultValue = typeof fallback === 'number' ? fallback : 0;
  if (value == null) return defaultValue;
  const trimmed = String(value).trim();
  if (!trimmed) return defaultValue;
  const unit = trimmed.endsWith('ms') ? 'ms' : (trimmed.endsWith('s') ? 's' : '');
  const numeric = parseFloat(trimmed);
  if (Number.isNaN(numeric)) return defaultValue;
  if (unit === 's') return numeric * 1000;
  return numeric;
}

function getComposerInlineAnimConfig() {
  const defaults = { durationIn: 480, durationOut: 380, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' };
  if (typeof window === 'undefined' || typeof document === 'undefined') return defaults;
  try {
    const styles = getComputedStyle(document.documentElement);
    const durationIn = parseCssDuration(styles.getPropertyValue('--composer-inline-duration-in'), defaults.durationIn);
    const durationOut = parseCssDuration(styles.getPropertyValue('--composer-inline-duration-out'), defaults.durationOut);
    const easing = (styles.getPropertyValue('--composer-inline-ease') || '').trim() || defaults.easing;
    return { durationIn, durationOut, easing };
  } catch (_) {
    return defaults;
  }
}

function cancelInlineVisibilityAnimation(element) {
  if (!element) return;
  const active = composerInlineVisibilityAnimations.get(element);
  if (active && typeof active.cancel === 'function') {
    try { active.cancel(); } catch (_) {}
  }
  if (active) composerInlineVisibilityAnimations.delete(element);
  const fallback = composerInlineVisibilityFallbacks.get(element);
  if (fallback != null) {
    clearTimeout(fallback);
    composerInlineVisibilityFallbacks.delete(element);
  }
  if (element.dataset && element.dataset.animState && !element.hidden) delete element.dataset.animState;
}

function animateComposerInlineVisibility(element, show, options = {}) {
  if (!element) return;
  const reduceMotion = composerPrefersReducedMotion();
  const config = getComposerInlineAnimConfig();
  const duration = show ? config.durationIn : config.durationOut;
  const immediate = !!options.immediate || reduceMotion || duration <= 0;
  const force = !!options.force;
  const onFinish = typeof options.onFinish === 'function' ? options.onFinish : null;
  const finish = () => { if (onFinish) { try { onFinish(); } catch (_) {} } };

  if (!force) {
    if (show && !element.hidden) {
      element.setAttribute('aria-hidden', 'false');
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      finish();
      return;
    }
    if (!show && element.hidden) {
      element.setAttribute('aria-hidden', 'true');
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      finish();
      return;
    }
  }

  cancelInlineVisibilityAnimation(element);

  if (immediate) {
    element.hidden = !show;
    element.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (element.dataset && element.dataset.animState) delete element.dataset.animState;
    finish();
    return;
  }

  const keyframesIn = [
    { opacity: 0, transform: 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)' }
  ];
  const keyframesOut = [
    { opacity: 1, transform: 'translateY(0)' },
    { opacity: 0, transform: 'translateY(-10px)' }
  ];

  const runFallback = () => {
    if (show) {
      element.hidden = false;
      element.setAttribute('aria-hidden', 'false');
      if (element.dataset) element.dataset.animState = 'enter';
    } else if (element.dataset) {
      element.dataset.animState = 'exit';
    }
    const timer = window.setTimeout(() => {
      if (!show) {
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
      } else {
        element.setAttribute('aria-hidden', 'false');
      }
      if (element.dataset && element.dataset.animState) delete element.dataset.animState;
      composerInlineVisibilityFallbacks.delete(element);
      finish();
    }, duration);
    composerInlineVisibilityFallbacks.set(element, timer);
  };

  if (typeof element.animate === 'function') {
    try {
      if (show) {
        element.hidden = false;
        element.setAttribute('aria-hidden', 'false');
        if (element.dataset) element.dataset.animState = 'enter';
        const animation = element.animate(keyframesIn, { duration, easing: config.easing, fill: 'both' });
        composerInlineVisibilityAnimations.set(element, animation);
        const finalize = () => {
          const active = composerInlineVisibilityAnimations.get(element);
          if (active !== animation) return;
          composerInlineVisibilityAnimations.delete(element);
          if (element.dataset && element.dataset.animState === 'enter') delete element.dataset.animState;
          finish();
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
      if (element.dataset) element.dataset.animState = 'exit';
      const animation = element.animate(keyframesOut, { duration, easing: config.easing, fill: 'both' });
      composerInlineVisibilityAnimations.set(element, animation);
      const finalize = () => {
        const active = composerInlineVisibilityAnimations.get(element);
        if (active !== animation) return;
        composerInlineVisibilityAnimations.delete(element);
        element.hidden = true;
        element.setAttribute('aria-hidden', 'true');
        if (element.dataset && element.dataset.animState === 'exit') delete element.dataset.animState;
        finish();
      };
      animation.finished.then(finalize).catch(finalize);
      animation.addEventListener('cancel', finalize, { once: true });
      return;
    } catch (_) {
      cancelInlineVisibilityAnimation(element);
    }
  }

  runFallback();
}

function captureElementRect(element) {
  if (!element || typeof element.getBoundingClientRect !== 'function') return null;
  try {
    const rect = element.getBoundingClientRect();
    return rect ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height } : null;
  } catch (_) {
    return null;
  }
}

function cancelListTransition(list) {
  if (!list) return;
  const active = composerListTransitions.get(list);
  if (!active) return;
  composerListTransitions.delete(list);
  if (active.animation && typeof active.animation.cancel === 'function') {
    try { active.animation.cancel(); } catch (_) {}
  }
  if (active.timer != null) clearTimeout(active.timer);
  if (active.restoreTransition != null) list.style.transition = active.restoreTransition;
  list.style.transform = 'none';
  list.style.filter = 'none';
  if (list.style.opacity && list.style.opacity !== '1') list.style.opacity = '';
  delete list.dataset.animating;
}

function animateComposerListTransition(list, previousRect, options = {}) {
  if (!list || !previousRect || composerPrefersReducedMotion()) return;
  const immediate = !!options.immediate;
  const forceFallback = immediate || !!options.forceFallback;
  const onMeasured = typeof options.onMeasured === 'function' ? options.onMeasured : null;
  cancelListTransition(list);
  const run = () => {
    if (!list.isConnected) return;
    let nextRect = captureElementRect(list);
    if (!nextRect) return;
    if (onMeasured) {
      try {
        const override = onMeasured(nextRect);
        if (override && typeof override === 'object') nextRect = override;
      }
      catch (_) {}
    }
    const dx = previousRect.left - nextRect.left;
    const dy = previousRect.top - nextRect.top;
    const sx = nextRect.width ? previousRect.width / nextRect.width : 1;
    const sy = nextRect.height ? previousRect.height / nextRect.height : 1;
    const transforms = [];
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) transforms.push(`translate(${dx}px, ${dy}px)`);
    if (Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) transforms.push(`scale(${sx}, ${sy})`);
    if (!transforms.length) return;
    const { durationIn, easing } = getComposerInlineAnimConfig();
    if (durationIn <= 0) return;
    const keyframes = [
      { transform: transforms.join(' '), filter: 'brightness(0.96)', opacity: 0.98 },
      { transform: 'none', filter: 'none', opacity: 1 }
    ];
    list.dataset.animating = 'true';
    if (!forceFallback && typeof list.animate === 'function') {
      let animation = null;
      try {
        animation = list.animate(keyframes, { duration: durationIn, easing, fill: 'both' });
      } catch (_) {
        animation = null;
      }
      if (animation) {
        composerListTransitions.set(list, { animation });
        const finalize = () => {
          const active = composerListTransitions.get(list);
          if (!active || active.animation !== animation) return;
          composerListTransitions.delete(list);
          delete list.dataset.animating;
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
    }
    const previousTransition = list.style.transition;
    const transformsValue = transforms.join(' ');
    list.style.transition = 'none';
    list.style.transform = transformsValue;
    list.style.filter = 'brightness(0.96)';
    list.style.opacity = '0.98';
    requestAnimationFrame(() => {
      list.style.transition = `transform ${durationIn}ms ${easing}, filter ${durationIn}ms ${easing}, opacity ${durationIn}ms ${easing}`;
      list.style.transform = 'none';
      list.style.filter = 'none';
      list.style.opacity = '';
    });
    const timer = window.setTimeout(() => {
      const active = composerListTransitions.get(list);
      if (!active || active.timer !== timer) return;
      list.style.transition = previousTransition;
      composerListTransitions.delete(list);
      delete list.dataset.animating;
    }, durationIn + 40);
    composerListTransitions.set(list, { timer, restoreTransition: previousTransition });
  };

  if (immediate) run();
  else requestAnimationFrame(run);
}

function cancelComposerOrderMainTransition(main) {
  if (!main) return;
  const active = composerOrderMainTransitions.get(main);
  if (!active) return;
  composerOrderMainTransitions.delete(main);
  if (active.animation && typeof active.animation.cancel === 'function') {
    try { active.animation.cancel(); } catch (_) {}
  }
  if (active.timer != null) clearTimeout(active.timer);
  if (active.restoreTransition != null) main.style.transition = active.restoreTransition;
  main.style.transform = 'none';
  main.style.filter = 'none';
  if (main.style.opacity && main.style.opacity !== '1') main.style.opacity = '';
  delete main.dataset.orderMainAnimating;
}

function animateComposerOrderMainReset(host, previousRect, options = {}) {
  if (!host || !previousRect) return;
  const main = host.querySelector('.composer-order-main');
  if (!main || !main.isConnected) return;
  cancelComposerOrderMainTransition(main);

  const reduceMotion = composerPrefersReducedMotion();
  const { durationOut, easing } = getComposerInlineAnimConfig();
  const duration = typeof durationOut === 'number' ? durationOut : 0;
  const immediate = !!options.immediate || reduceMotion || duration <= 0;
  if (immediate) return;

  const run = () => {
    if (!main.isConnected) return;
    const nextRect = captureElementRect(main);
    if (!nextRect) return;

    const dx = previousRect.left - nextRect.left;
    const dy = previousRect.top - nextRect.top;
    const sx = nextRect.width ? previousRect.width / nextRect.width : 1;
    const sy = nextRect.height ? previousRect.height / nextRect.height : 1;

    const transforms = [];
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) transforms.push(`translate(${dx}px, ${dy}px)`);
    if (Math.abs(sx - 1) > 0.02 || Math.abs(sy - 1) > 0.02) transforms.push(`scale(${sx}, ${sy})`);
    if (!transforms.length) return;

    const keyframes = [
      { transform: transforms.join(' '), filter: 'brightness(0.97)', opacity: 0.99 },
      { transform: 'none', filter: 'none', opacity: 1 }
    ];

    main.dataset.orderMainAnimating = 'true';

    if (typeof main.animate === 'function') {
      let animation = null;
      try {
        animation = main.animate(keyframes, { duration, easing, fill: 'both' });
      } catch (_) {
        animation = null;
      }
      if (animation) {
        composerOrderMainTransitions.set(main, { animation });
        const finalize = () => {
          const active = composerOrderMainTransitions.get(main);
          if (!active || active.animation !== animation) return;
          composerOrderMainTransitions.delete(main);
          delete main.dataset.orderMainAnimating;
        };
        animation.finished.then(finalize).catch(finalize);
        animation.addEventListener('cancel', finalize, { once: true });
        return;
      }
    }

    const previousTransition = main.style.transition;
    const transformsValue = transforms.join(' ');
    main.style.transition = 'none';
    main.style.transform = transformsValue;
    main.style.filter = 'brightness(0.97)';
    main.style.opacity = '0.99';
    requestAnimationFrame(() => {
      if (!main.isConnected) return;
      main.style.transition = `transform ${duration}ms ${easing}, filter ${duration}ms ${easing}, opacity ${duration}ms ${easing}`;
      main.style.transform = 'none';
      main.style.filter = 'none';
      main.style.opacity = '';
    });
    const timer = window.setTimeout(() => {
      const active = composerOrderMainTransitions.get(main);
      if (!active || active.timer !== timer) return;
      main.style.transition = previousTransition;
      composerOrderMainTransitions.delete(main);
      delete main.dataset.orderMainAnimating;
    }, duration + 40);
    composerOrderMainTransitions.set(main, { timer, restoreTransition: previousTransition });
  };

  requestAnimationFrame(run);
}

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
    if (composerDiffCache && composerDiffCache.index && composerDiffCache.index.hasChanges) return true;
  } catch (_) {}
  try {
    if (composerDiffCache && composerDiffCache.tabs && composerDiffCache.tabs.hasChanges) return true;
  } catch (_) {}
  try {
    if (composerDiffCache && composerDiffCache.site && composerDiffCache.site.hasChanges) return true;
  } catch (_) {}
  return false;
}

function hasUnsavedMarkdownDrafts() {
  return getMarkdownDraftController().hasUnsavedDrafts();
}

function handleBeforeUnload(event) {
  getMarkdownDraftController().handleBeforeUnload(event);
}

try {
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }
} catch (_) {}



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
  if (!activeComposerState) return null;
  if (kind === 'tabs') return activeComposerState.tabs;
  if (kind === 'site') return activeComposerState.site;
  return activeComposerState.index;
}

function setStateSlice(kind, value) {
  if (!activeComposerState) return;
  if (kind === 'tabs') activeComposerState.tabs = value;
  else if (kind === 'site') activeComposerState.site = value;
  else activeComposerState.index = value;
}

function computeBaselineSignature(kind) {
  if (kind === 'tabs') return computeTabsSignature(remoteBaseline.tabs);
  if (kind === 'site') return computeSiteSignature(remoteBaseline.site);
  return computeIndexSignature(remoteBaseline.index);
}

function recomputeDiff(kind) {
  const slice = getStateSlice(kind) || { __order: [] };
  let baselineSlice;
  let diff;
  if (kind === 'tabs') {
    baselineSlice = remoteBaseline.tabs;
    diff = computeTabsDiff(slice, baselineSlice);
  } else if (kind === 'site') {
    baselineSlice = remoteBaseline.site;
    diff = computeSiteDiff(slice, baselineSlice);
  } else {
    baselineSlice = remoteBaseline.index;
    diff = computeIndexDiff(slice, baselineSlice);
  }
  composerDiffCache[kind] = diff;
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

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('press-editor-language-applied', refreshEditorLanguageUi);
}

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
  return getMarkdownSessionController().findTabByPath(path);
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

let syncCommitPanelRenderSeq = 0;
let syncCommitPanelRefreshTimer = 0;

function appendPublishTransportStatus(host) {
  const transport = resolvePublishTransport();
  const note = document.createElement('p');
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
  const syncPanel = document.getElementById('mode-sync');
  if (!syncPanel) return null;
  let panel = document.getElementById('syncCommitPanel');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'syncCommitPanel';
    panel.className = 'sync-commit-panel';
    syncPanel.appendChild(panel);
  }
  return panel;
}

async function refreshSyncCommitPanel(options = {}) {
  return refreshSyncCommitPanelView(options, {
    documentRef: document,
    t,
    getSyncCommitPanelHost,
    nextRenderId: () => {
      syncCommitPanelRenderSeq += 1;
      return syncCommitPanelRenderSeq;
    },
    getRenderId: () => syncCommitPanelRenderSeq,
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
    refreshSyncCommitPanel
  });
}

function scheduleSyncCommitPanelRefresh() {
  syncCommitPanelRefreshTimer = scheduleSyncCommitPanelRefreshView({
    currentMode: getCurrentComposerMode(),
    windowRef: window,
    timer: syncCommitPanelRefreshTimer,
    setTimer: (timer) => {
      syncCommitPanelRefreshTimer = timer;
    },
    refreshSyncCommitPanel
  });
}

function getActiveSiteRepoConfig() {
  const site = getStateSlice('site');
  const fallback = window.__press_site_repo && typeof window.__press_site_repo === 'object'
    ? window.__press_site_repo
    : {};
  return resolveSiteRepoConfig(site, composerSiteLocalOverride, fallback);
}

const composerOrderDiffUi = createComposerOrderDiffUi({
  documentRef: document,
  windowRef: window,
  tComposer,
  tComposerDiff,
  truncateText,
  getStateSlice,
  getRemoteBaseline: () => remoteBaseline,
  getComposerDiff: (kind) => composerDiffCache[kind],
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
  getSlideDurations: () => ({ open: SLIDE_OPEN_DUR, close: SLIDE_CLOSE_DUR })
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
  documentRef: document,
  windowRef: window,
  consoleRef: console,
  t,
  getState: () => activeComposerState,
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
  getMarkdownPushLabel
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
  composerIndexTabsUi.buildIndexUI(root, activeComposerState);
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
  composerIndexTabsUi.buildTabsUI(root, activeComposerState);
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



async function handleComposerRefresh(btn) {
  const target = getActiveComposerFile();
  const button = btn;
  const resetButton = () => {
    if (!button) return;
    button.disabled = false;
    button.classList.remove('is-busy');
    button.removeAttribute('aria-busy');
    button.textContent = t('editor.composer.refresh');
  };
  try {
    if (button) {
      button.disabled = true;
      button.classList.add('is-busy');
      button.setAttribute('aria-busy', 'true');
      button.textContent = t('editor.composer.refreshing');
    }
    const contentRoot = getContentRootSafe();
    const fileBase = target === 'tabs' ? 'tabs' : target === 'site' ? 'site' : 'index';
    const remote = target === 'site'
      ? await fetchComposerTrackedSiteConfig()
      : await fetchConfigWithYamlFallback([`${contentRoot}/${fileBase}.yaml`, `${contentRoot}/${fileBase}.yml`]);
    let prepared;
    if (target === 'tabs') prepared = prepareTabsState(remote || {});
    else if (target === 'site') prepared = cloneSiteState(prepareSiteState(remote || {}));
    else prepared = prepareIndexState(remote || {});
    const baselineSignatureBefore = computeBaselineSignature(target);
    remoteBaseline[target] = prepared;
    const diffBefore = composerDiffCache[target];
    const hadLocalChanges = diffBefore && diffBefore.hasChanges;
    if (!hadLocalChanges) {
      setStateSlice(target, deepClone(prepared));
      if (target === 'site') applyComposerEffectiveSiteConfig(prepared);
      if (target === 'tabs') rebuildTabsUI();
      else if (target === 'site') rebuildSiteUI();
      else rebuildIndexUI();
      showStatus(
        t('editor.composer.statusMessages.refreshSuccess', {
          name: `${fileBase}.yaml`
        })
      );
    } else {
      notifyComposerChange(target, { skipAutoSave: true });
      const baselineSignatureAfter = computeBaselineSignature(target);
      if (baselineSignatureAfter !== baselineSignatureBefore) {
        showStatus(t('editor.composer.statusMessages.remoteUpdated'));
      } else {
        showStatus(t('editor.composer.statusMessages.remoteUnchanged'));
      }
    }
  } catch (err) {
    console.error('Refresh failed', err);
    showStatus(t('editor.composer.statusMessages.refreshFailed'));
  } finally {
    resetButton();
    setTimeout(() => { showStatus(''); }, 2000);
  }
}

async function handleComposerDiscard(btn) {
  const target = getActiveComposerFile();
  const label = target === 'tabs' ? 'tabs.yaml' : target === 'site' ? 'site.yaml' : 'index.yaml';
  const diff = composerDiffCache[target];
  const meta = getComposerDraftMeta(target);
  const hasChanges = !!(diff && diff.hasChanges);
  const hasDraft = !!meta;
  if (!hasChanges && !hasDraft) {
    return;
  }

  const promptMessage = t('editor.composer.discardConfirm.messageReload', { label });
  let proceed = true;
  try {
    proceed = await showComposerDiscardConfirm(btn, promptMessage);
  } catch (err) {
    console.warn('Custom discard prompt failed, falling back to native confirm', err);
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        proceed = window.confirm(promptMessage);
      }
    } catch (_) {
      proceed = true;
    }
  }
  if (!proceed) return;

  const button = btn;
  const resetButton = () => {
    if (!button) return;
    button.disabled = false;
    button.classList.remove('is-busy');
    button.removeAttribute('aria-busy');
    button.textContent = t('editor.composer.discardConfirm.discard');
  };

  try {
    if (button) {
      button.disabled = true;
      button.classList.add('is-busy');
      button.setAttribute('aria-busy', 'true');
      button.textContent = t('editor.composer.discardConfirm.discarding');
    }

    let prepared = null;
    let fetchedFresh = false;
    try {
      const contentRoot = getContentRootSafe();
      const fileBase = target === 'tabs' ? 'tabs' : target === 'site' ? 'site' : 'index';
      const remote = target === 'site'
        ? await fetchComposerTrackedSiteConfig()
        : await fetchConfigWithYamlFallback([`${contentRoot}/${fileBase}.yaml`, `${contentRoot}/${fileBase}.yml`]);
      if (remote != null) {
        if (target === 'tabs') prepared = prepareTabsState(remote);
        else if (target === 'site') prepared = cloneSiteState(prepareSiteState(remote));
        else prepared = prepareIndexState(remote);
        fetchedFresh = true;
      }
    } catch (err) {
      console.warn('Discard: failed to fetch fresh remote snapshot', err);
    }

    if (!prepared) {
      const baseline = remoteBaseline[target];
      if (target === 'site') prepared = baseline ? cloneSiteState(baseline) : cloneSiteState(prepareSiteState({}));
      else prepared = baseline ? deepClone(baseline) : { __order: [] };
    }

    const normalized = target === 'site' ? cloneSiteState(prepared) : deepClone(prepared);
    remoteBaseline[target] = target === 'site' ? cloneSiteState(prepared) : deepClone(prepared);
    setStateSlice(target, normalized);
    if (target === 'site') applyComposerEffectiveSiteConfig(normalized);

    composerYamlDraftController.clearAutoDraftTimer(target);

    if (target === 'tabs') rebuildTabsUI();
    else if (target === 'site') rebuildSiteUI();
    else rebuildIndexUI();

    clearDraftStorage(target);

    const msg = fetchedFresh
      ? t('editor.composer.discardConfirm.successFresh', { label })
      : t('editor.composer.discardConfirm.successCached', { label });
    showStatus(msg);
    setTimeout(() => { showStatus(''); }, 2000);
  } catch (err) {
    console.error('Discard failed', err);
    showStatus(t('editor.composer.discardConfirm.failed'));
    setTimeout(() => { showStatus(''); }, 2000);
  } finally {
    resetButton();
  }
}

function getPrimaryEditorApi() {
  try {
    const api = window.__press_primary_editor;
    return api && typeof api === 'object' ? api : null;
  } catch (_) {
    return null;
  }
}

function restorePrimaryEditorMarkdownView(editorApi) {
  if (!editorApi) return;
  try {
    if (typeof editorApi.restorePersistedView === 'function') {
      editorApi.restorePersistedView();
      return;
    }
    if (typeof editorApi.setView === 'function') editorApi.setView('edit');
  } catch (_) {}
}

function ensurePrimaryEditorListener() {
  if (detachPrimaryEditorListener) return;
  const api = getPrimaryEditorApi();
  if (!api || typeof api.onChange !== 'function') return;
  detachPrimaryEditorListener = api.onChange((value) => {
    const tab = getActiveDynamicTab();
    if (tab) {
      tab.content = value;
      updateDynamicTabDirtyState(tab);
    }
  });
}

function getTabsMetadataForPath(path) {
  const node = getEditorTreeFileNodeByPath(path);
  if (!node || node.source !== 'tabs' || !node.key || !node.lang) return { title: '' };
  const entry = getTabsEntry(node.key);
  const langEntry = entry && entry[node.lang] && typeof entry[node.lang] === 'object'
    ? entry[node.lang]
    : {};
  return { title: String(langEntry.title || '') };
}

function getTabsMetadataForTab(tab) {
  if (tab && tab.tabsKey && tab.tabsLang) {
    const entry = getTabsEntry(tab.tabsKey);
    const langEntry = entry && entry[tab.tabsLang] && typeof entry[tab.tabsLang] === 'object'
      ? entry[tab.tabsLang]
      : {};
    return { title: String(langEntry.title || '') };
  }
  return getTabsMetadataForPath(tab && tab.path ? tab.path : '');
}

function updateTabsEntryTitleFromPath(path, metadata) {
  const node = getEditorTreeFileNodeByPath(path);
  if (!node || node.source !== 'tabs' || !node.key || !node.lang) return false;
  const entry = getTabsEntry(node.key);
  entry[node.lang] = entry[node.lang] && typeof entry[node.lang] === 'object'
    ? entry[node.lang]
    : {};
  const nextTitle = metadata && typeof metadata === 'object'
    ? String(metadata.title || '')
    : '';
  if (String(entry[node.lang].title || '') === nextTitle) return false;
  entry[node.lang].title = nextTitle;
  notifyComposerChange('tabs');
  return true;
}

function updateTabsEntryTitleForTab(tab, metadata) {
  if (tab && tab.tabsKey && tab.tabsLang) {
    const entry = getTabsEntry(tab.tabsKey);
    entry[tab.tabsLang] = entry[tab.tabsLang] && typeof entry[tab.tabsLang] === 'object'
      ? entry[tab.tabsLang]
      : {};
    const nextTitle = metadata && typeof metadata === 'object'
      ? String(metadata.title || '')
      : '';
    if (String(entry[tab.tabsLang].title || '') === nextTitle) return false;
    entry[tab.tabsLang].title = nextTitle;
    notifyComposerChange('tabs');
    return true;
  }
  return updateTabsEntryTitleFromPath(tab && tab.path ? tab.path : '', metadata);
}

function ensurePrimaryEditorTabsMetadataListener() {
  if (detachPrimaryEditorTabsMetadataListener) return;
  const api = getPrimaryEditorApi();
  if (!api || typeof api.onTabsMetadataChange !== 'function') return;
  detachPrimaryEditorTabsMetadataListener = api.onTabsMetadataChange((metadata) => {
    const tab = getActiveDynamicTab();
    if (tab && tab.source === 'tabs') {
      updateTabsEntryTitleForTab(tab, metadata);
    }
  });
}

function getTrackedPublishContentRoot() {
  const site = getStateSlice('site') || {};
  const root = safeString(site.contentRoot || 'wwwroot')
    .replace(/[\\]/g, '/')
    .replace(/\/+$/g, '');
  return root || 'wwwroot';
}

function getMarkdownSessionController() {
  if (!markdownSessionController) throw new Error('Markdown session controller is not initialized');
  return markdownSessionController;
}

function getDynamicEditorTabs() {
  return getMarkdownSessionController().getTabs();
}

function getDynamicTabByMode(mode) {
  return getMarkdownSessionController().getTab(mode);
}

function isDynamicMode(mode) {
  return getMarkdownSessionController().isDynamicMode(mode);
}

function getFirstDynamicModeId() {
  return getMarkdownSessionController().getFirstDynamicModeId();
}

function getActiveDynamicTab() {
  return getMarkdownSessionController().getActiveDynamicTab();
}

function activateDynamicMode(mode) {
  return getMarkdownSessionController().activateDynamicMode(mode);
}

function clearActiveDynamicMode(mode = null) {
  getMarkdownSessionController().clearActiveDynamicMode(mode);
}

function persistDynamicEditorState() {
  return getMarkdownSessionController().persistEditorState();
}

function restoreDynamicEditorState() {
  return getMarkdownSessionController().restoreEditorState();
}

function setTabLoadingState(tab, isLoading) {
  getMarkdownSessionController().setTabLoadingState(tab, isLoading);
}

function detachPrimaryEditorListeners() {
  if (detachPrimaryEditorListener) {
    try { detachPrimaryEditorListener(); } catch (_) {}
    detachPrimaryEditorListener = null;
  }
  if (detachPrimaryEditorTabsMetadataListener) {
    try { detachPrimaryEditorTabsMetadataListener(); } catch (_) {}
    detachPrimaryEditorTabsMetadataListener = null;
  }
}

function updateMarkdownActionsForTab(tab) {
  updateMarkdownPushButton(tab);
  updateMarkdownDiscardButton(tab);
  updateMarkdownSaveButton(tab);
  updateMarkdownProtectionButton(tab);
}

function getMarkdownActionsUi() {
  if (!markdownActionsUi) throw new Error('Markdown actions UI is not initialized');
  return markdownActionsUi;
}

function getMarkdownPushButton() {
  return getMarkdownActionsUi().getPushButton();
}

function getMarkdownDiscardButton() {
  return getMarkdownActionsUi().getDiscardButton();
}

function getMarkdownSaveButton() {
  return getMarkdownActionsUi().getSaveButton();
}

function setMarkdownPushButton(button) {
  getMarkdownActionsUi().setPushButton(button);
}

function setMarkdownDiscardButton(button) {
  getMarkdownActionsUi().setDiscardButton(button);
}

function setMarkdownSaveButton(button) {
  getMarkdownActionsUi().setSaveButton(button);
}

function setMarkdownProtectionButton(button) {
  getMarkdownActionsUi().setProtectionButton(button);
}

function getMarkdownPushLabel(kind) {
  return getMarkdownActionsUi().getPushLabel(kind);
}

function getMarkdownDiscardLabel() {
  return getMarkdownActionsUi().getDiscardLabel();
}

function getMarkdownDiscardBusyLabel() {
  return getMarkdownActionsUi().getDiscardBusyLabel();
}

function getMarkdownSaveLabel() {
  return getMarkdownActionsUi().getSaveLabel();
}

function getMarkdownSaveBusyLabel() {
  return getMarkdownActionsUi().getSaveBusyLabel();
}

function getMarkdownSaveTooltip(kind) {
  return getMarkdownActionsUi().getSaveTooltip(kind);
}

function updateMarkdownPushButton(tab) {
  getMarkdownActionsUi().updatePushButton(tab);
}

function updateMarkdownDiscardButton(tab) {
  getMarkdownActionsUi().updateDiscardButton(tab);
}

function updateMarkdownSaveButton(tab) {
  getMarkdownActionsUi().updateSaveButton(tab);
}

function updateMarkdownProtectionButton(tab) {
  getMarkdownActionsUi().updateProtectionButton(tab);
}

function pushEditorCurrentFileInfo(tab) {
  const editorApi = getPrimaryEditorApi();
  if (!editorApi || typeof editorApi.setCurrentFileLabel !== 'function') return;
  const payload = tab
    ? {
        path: tab.path || '',
        source: tab.source || inferMarkdownSourceFromPath(tab.path),
        breadcrumb: buildCurrentFileBreadcrumb(tab),
        status: tab.fileStatus || null,
        dirty: !!tab.isDirty,
        loaded: !!tab.loaded,
        draft: tab.localDraft
          ? {
              savedAt: Number(tab.localDraft.savedAt) || Date.now(),
              conflict: !!tab.draftConflict,
              hasContent: true,
              remoteSignature: tab.localDraft.remoteSignature || ''
            }
          : null
      }
    : { path: '', status: null, dirty: false, draft: null };
  try { editorApi.setCurrentFileLabel(payload); }
  catch (_) {}
  if (typeof editorApi.setTabsMetadata === 'function') {
    try {
      editorApi.setTabsMetadata(tab && tab.source === 'tabs' ? getTabsMetadataForTab(tab) : null, { silent: true });
    } catch (_) {}
  }
  const activeTab = (tab && tab.mode && tab.mode === getCurrentComposerMode()) ? tab : getActiveDynamicTab();
  updateMarkdownPushButton(activeTab);
  updateMarkdownDiscardButton(activeTab);
  updateMarkdownSaveButton(activeTab);
  updateMarkdownProtectionButton(activeTab);
}

function getMarkdownLoader() {
  if (!markdownLoader) throw new Error('Markdown loader is not initialized');
  return markdownLoader;
}

function setDynamicTabStatus(tab, status) {
  return getMarkdownLoader().setDynamicTabStatus(tab, status);
}

async function closeDynamicTab(modeId, options = {}) {
  return getMarkdownSessionController().closeDynamicTab(modeId, options);
}

function getOrCreateDynamicMode(path, options = {}) {
  return getMarkdownSessionController().getOrCreateDynamicMode(path, options);
}

async function loadDynamicTabContent(tab) {
  return getMarkdownLoader().loadDynamicTabContent(tab);
}

function openMarkdownInEditor(path, options = {}) {
  return getMarkdownSessionController().openMarkdownInEditor(path, options);
}

function applyMode(mode, options = {}) {
  if (!modeController) return;
  modeController.applyMode(mode, options);
}

function getInitialComposerFile() {
  try {
    const v = (localStorage.getItem(scopedEditorStorageKey(LS_KEYS.cfile)) || '').toLowerCase();
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

// Smooth expand/collapse for details panels
const __activeAnims = new WeakMap();
const SLIDE_OPEN_DUR = 420;   // slower, smoother
const SLIDE_CLOSE_DUR = 360;  // slightly faster than open

function parsePx(value) {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

function getSlidePadding(el) {
  const cs = window.getComputedStyle(el);
  return {
    top: parsePx(cs.paddingTop),
    bottom: parsePx(cs.paddingBottom)
  };
}

function clearInlineSlideStyles(el) {
  el.style.overflow = '';
  el.style.height = '';
  el.style.opacity = '';
  el.style.paddingTop = '';
  el.style.paddingBottom = '';
}

function forgetActiveAnim(el, anim) {
  const stored = __activeAnims.get(el);
  if (stored && stored.anim === anim) __activeAnims.delete(el);
}

function finalizeAnimation(el, anim) {
  if (!anim) return;
  try { anim.onfinish = null; } catch (_) {}
  try { anim.oncancel = null; } catch (_) {}
  try { anim.commitStyles(); } catch (_) {}
  try { anim.cancel(); } catch (_) {}
  forgetActiveAnim(el, anim);
}

function slideToggle(el, toOpen) {
  if (!el) return;
  const isReduced = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let computedDisplay = '';
  try { computedDisplay = window.getComputedStyle(el).display; } catch (_) { computedDisplay = el.style.display; }
  const running = __activeAnims.get(el);
  const runningTarget = running && typeof running.target === 'boolean' ? running.target : null;
  const currentState = (runningTarget !== null)
    ? runningTarget
    : (el.dataset.open === '1' ? true : el.dataset.open === '0' ? false : (computedDisplay !== 'none'));
  const open = (typeof toOpen === 'boolean') ? toOpen : !currentState;

  if (runningTarget !== null) {
    if (open === runningTarget) return;
    try { running.anim?.cancel(); } catch (_) {}
    __activeAnims.delete(el);
  } else if (open === currentState) {
    return;
  }

  if (isReduced) {
    el.style.display = open ? 'block' : 'none';
    el.dataset.open = open ? '1' : '0';
    clearInlineSlideStyles(el);
    return;
  }

  if (open) {
    el.dataset.open = '1';
    el.style.display = 'block';
    const pad = getSlidePadding(el);
    const totalEnd = el.scrollHeight;
    const contentTarget = Math.max(0, totalEnd - pad.top - pad.bottom);
    try {
      el.style.overflow = 'hidden';
      el.style.paddingTop = '0px';
      el.style.paddingBottom = '0px';
      el.style.height = '0px';
      el.style.opacity = '0';
      void el.offsetWidth;
      const anim = el.animate([
        { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
        { height: contentTarget + 'px', opacity: 1, paddingTop: pad.top + 'px', paddingBottom: pad.bottom + 'px' }
      ], { duration: SLIDE_OPEN_DUR, easing: 'ease', fill: 'forwards' });
      __activeAnims.set(el, { target: true, anim });
      anim.onfinish = () => {
        finalizeAnimation(el, anim);
        el.dataset.open = '1';
        clearInlineSlideStyles(el);
      };
      anim.oncancel = () => {
        clearInlineSlideStyles(el);
        forgetActiveAnim(el, anim);
      };
    } catch (_) {
      clearInlineSlideStyles(el);
      el.dataset.open = '1';
    }
  } else {
    el.dataset.open = '0';
    const pad = getSlidePadding(el);
    const totalStart = el.scrollHeight;
    const contentStart = Math.max(0, totalStart - pad.top - pad.bottom);
    try {
      el.style.overflow = 'hidden';
      el.style.display = 'block';
      el.style.paddingTop = pad.top + 'px';
      el.style.paddingBottom = pad.bottom + 'px';
      el.style.height = contentStart + 'px';
      el.style.opacity = '1';
      void el.offsetHeight;
      const anim = el.animate([
        { height: contentStart + 'px', opacity: 1, paddingTop: pad.top + 'px', paddingBottom: pad.bottom + 'px' },
        { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }
      ], { duration: SLIDE_CLOSE_DUR, easing: 'ease', fill: 'forwards' });
      __activeAnims.set(el, { target: false, anim });
      anim.onfinish = () => {
        finalizeAnimation(el, anim);
        el.style.display = 'none';
        el.dataset.open = '0';
        clearInlineSlideStyles(el);
      };
      anim.oncancel = () => {
        clearInlineSlideStyles(el);
        forgetActiveAnim(el, anim);
      };
    } catch (_) {
      el.style.display = 'none';
      clearInlineSlideStyles(el);
      el.dataset.open = '0';
    }
  }
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
  applyDiff('index', composerDiffCache.index);
  applyDiff('tabs', composerDiffCache.tabs);
  try {
    const siteDiff = composerDiffCache.site || recomputeDiff('site');
    if (siteDiff && siteDiff.hasChanges) add('system:site-settings', 'modified');
    else if (getComposerDraftMeta('site')) add('system:site-settings', 'saved');
  } catch (_) {
    try {
      if (getComposerDraftMeta('site')) add('system:site-settings', 'saved');
    } catch (__) {}
  }
  try {
    if (getSystemUpdateSummaryEntries().length) add('system:updates', 'modified');
  } catch (_) {}
  try {
    if (getThemeManagerSummaryEntries().length) add('system:themes', 'modified');
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
    indexDiff: composerDiffCache.index || null,
    tabsDiff: composerDiffCache.tabs || null,
    indexBaseline: remoteBaseline.index || null,
    tabsBaseline: remoteBaseline.tabs || null
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

try {
  document.addEventListener('press-editor-current-file-breadcrumb-select', (event) => {
    const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : {};
    const nodeId = String(detail.nodeId || '').trim();
    if (!nodeId) return;
    handleEditorTreeSelection(nodeId);
  });
} catch (_) {}

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

function bindComposerUI(state) {
  mountEditorSystemPanels();
  initEditorOverlay();
  initEditorRailResize();
  initMobileEditorRail();
  bindEditorStatePersistenceListeners();

  // Overlay launchers and legacy mode buttons
  $$('.mode-tab').forEach(btn => {
    btn.addEventListener('click', (event) => {
      const mode = btn.dataset.mode;
      if (mode === 'composer' || mode === 'themes' || mode === 'updates' || mode === 'sync') {
        event.preventDefault();
        openEditorOverlay(mode, btn);
        return;
      }
      applyMode(mode);
    });
  });
  try {
    initSystemUpdates({ onStateChange: () => { try { updateUnsyncedSummary(); } catch (_) {} } });
  } catch (err) {
    console.error('Failed to initialize system updates module', err);
  }
  try {
    initThemeManager({
      onStateChange: () => {
        try { updateUnsyncedSummary(); } catch (_) {}
        try { refreshEditorContentTree({ preserveStructure: true }); } catch (_) {}
      },
      getCurrentThemePack: () => {
        const site = getStateSlice('site') || {};
        return site.themePack || 'native';
      },
      setSiteThemePack: (value) => {
        const site = getStateSlice('site') || {};
        site.themePack = value || 'native';
        setStateSlice('site', site);
        notifyComposerChange('site');
      }
    });
  } catch (err) {
    console.error('Failed to initialize theme manager module', err);
  }

  // File switch (index.yaml <-> tabs.yaml)
  const links = $$('a.vt-btn[data-cfile]');
  const setFile = (name, options = {}) => {
    applyComposerFile(name, options);
    try {
      const normalized = name === 'tabs' ? 'tabs' : (name === 'site' ? 'site' : 'index');
      localStorage.setItem(scopedEditorStorageKey(LS_KEYS.cfile), normalized);
    } catch (_) {}
  };
  links.forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); setFile(a.dataset.cfile); }));
  // Respect persisted selection on load
  setFile(getInitialComposerFile(), { immediate: true });

  // ----- Composer: New Post Wizard -----
  // Legacy wizard removed in favor of inline add buttons.
  (function buildComposerGuide(){
    // Composer wizard removed; direct add buttons handle new entries.
  })();

  // Add item (Post or Tab) directly within the composer lists
  const btnAddItem = document.getElementById('btnAddItem');
  if (btnAddItem) {
    btnAddItem.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      const kind = getActiveComposerFile();
      const anchor = event && event.currentTarget ? event.currentTarget : btnAddItem;
      addComposerEntry(kind, anchor).catch((err) => {
        console.error('Failed to launch add entry prompt', err);
      });
    });
  }


  const btnDiscard = document.getElementById('btnDiscard');
  if (btnDiscard) btnDiscard.addEventListener('click', () => handleComposerDiscard(btnDiscard));

  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.addEventListener('click', () => handleComposerRefresh(btnRefresh));

  const btnReview = document.getElementById('btnReview');
  if (btnReview) {
    btnReview.addEventListener('click', () => {
      const datasetKind = btnReview.dataset && btnReview.dataset.kind;
      const preferred = datasetKind === 'tabs' ? 'tabs' : datasetKind === 'index' ? 'index' : null;
      if (preferred) {
        openComposerDiffModal(preferred);
        return;
      }
      const summaryEntries = computeUnsyncedSummary();
      const activeKind = getActiveComposerFile();
      const normalizedActive = activeKind === 'tabs' ? 'tabs' : 'index';
      const entry = summaryEntries.find(item => item && item.kind === normalizedActive);
      if (entry) openComposerDiffModal(entry.kind);
    });
  }

  bindVerifySetup();
  }

function showStatus(msg, kind = 'info') {
  if (msg) {
    const type = typeof kind === 'string' ? kind : 'info';
    showToast(type, msg);
  }
  updateUnsyncedSummary();
}

document.addEventListener('DOMContentLoaded', async () => {
  const pushBtn = document.getElementById('btnPushMarkdown');
  if (pushBtn) {
    setMarkdownPushButton(pushBtn);
    pushBtn.addEventListener('click', async (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      const active = getActiveDynamicTab();
      if (!active) {
        showToast('info', t('editor.toasts.markdownOpenBeforePush'));
        return;
      }

      const button = getMarkdownPushButton();
      const originalLabel = getButtonLabel(button) || getMarkdownPushLabel('default');
      const setBusyState = (busy, text) => {
        if (!button) return;
        if (busy) {
          button.classList.add('is-busy');
          button.disabled = true;
          button.setAttribute('aria-busy', 'true');
          button.setAttribute('aria-disabled', 'true');
          if (text) setButtonLabel(button, text);
        } else {
          button.classList.remove('is-busy');
          button.disabled = false;
          button.removeAttribute('aria-busy');
          button.setAttribute('aria-disabled', 'false');
          if (text) setButtonLabel(button, text);
        }
      };

      setBusyState(true, t('editor.composer.remoteWatcher.preparing'));
      try {
        await openMarkdownPushOnGitHub(active);
      } finally {
        setBusyState(false, originalLabel);
        updateMarkdownPushButton(active);
        updateMarkdownProtectionButton(active);
      }
    });
    updateMarkdownPushButton(getActiveDynamicTab());
  }

  const saveBtn = document.getElementById('btnSaveMarkdown');
  if (saveBtn) {
    setMarkdownSaveButton(saveBtn);
    saveBtn.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      manualSaveActiveMarkdown(saveBtn);
    });
    updateMarkdownSaveButton(getActiveDynamicTab());
  }

  const protectBtn = document.getElementById('btnProtectMarkdown');
  if (protectBtn) {
    setMarkdownProtectionButton(protectBtn);
    protectBtn.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      handleMarkdownProtectionButton(protectBtn);
    });
    updateMarkdownProtectionButton(getActiveDynamicTab());
  }

  const discardBtn = document.getElementById('btnDiscardMarkdown');
  if (discardBtn) {
    setMarkdownDiscardButton(discardBtn);
    discardBtn.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      discardMarkdownLocalChanges(null, discardBtn);
    });
    updateMarkdownDiscardButton(getActiveDynamicTab());
  }

  try {
    if (!window.__press_site_repo || typeof window.__press_site_repo !== 'object') {
      window.__press_site_repo = { owner: '', name: '', branch: 'main' };
    }
  } catch (_) {}

  const state = { index: {}, tabs: {}, site: {} };
  showStatus(t('editor.composer.statusMessages.loadingConfig'));
  try {
    const site = await fetchComposerTrackedSiteConfig();
    const effectiveSite = applyComposerEffectiveSiteConfig(site);
    const root = (effectiveSite && effectiveSite.contentRoot) ? String(effectiveSite.contentRoot) : 'wwwroot';
    updateMarkdownPushButton(getActiveDynamicTab());
    const remoteSite = prepareSiteState(site || {});
    const [idx, tbs] = await Promise.all([
      fetchConfigWithYamlFallback([`${root}/index.yaml`, `${root}/index.yml`]),
      fetchConfigWithYamlFallback([`${root}/tabs.yaml`, `${root}/tabs.yml`])
    ]);
    const remoteIndex = prepareIndexState(idx || {});
    const remoteTabs = prepareTabsState(tbs || {});
    remoteBaseline.index = deepClone(remoteIndex);
    remoteBaseline.tabs = deepClone(remoteTabs);
    remoteBaseline.site = cloneSiteState(remoteSite);
    state.index = deepClone(remoteIndex);
    state.tabs = deepClone(remoteTabs);
    state.site = cloneSiteState(remoteSite);
  } catch (e) {
    console.warn('Composer: failed to load configs', e);
    remoteBaseline.index = { __order: [] };
    remoteBaseline.tabs = { __order: [] };
    remoteBaseline.site = cloneSiteState(prepareSiteState({}));
    state.index = { __order: [] };
    state.tabs = { __order: [] };
    state.site = cloneSiteState(prepareSiteState({}));
    updateMarkdownPushButton(getActiveDynamicTab());
  }

  activeComposerState = state;
  const restoredDrafts = loadDraftSnapshotsIntoState(state);
  let inferredSiteRepoApplied = false;
  try {
    inferredSiteRepoApplied = applyInferredRepoConfig(
      state.site,
      inferRepoConfigFromGitHubPagesUrl(window.location)
    );
  } catch (_) {
    inferredSiteRepoApplied = false;
  }
  applyComposerEffectiveSiteConfig(state.site);
  updateMarkdownPushButton(getActiveDynamicTab());

  if (restoredDrafts.length) {
    const label = restoredDrafts.map(k => (k === 'tabs' ? 'tabs.yaml' : k === 'site' ? 'site.yaml' : 'index.yaml')).join(' & ');
    showStatus(t('editor.composer.statusMessages.restoredDraft', { label }));
    setTimeout(() => { showStatus(''); }, 1800);
  } else {
    showStatus('');
  }

  bindComposerUI(state);
  composerIndexTabsUi.buildIndexUI($('#composerIndex'), state);
  composerIndexTabsUi.buildTabsUI($('#composerTabs'), state);
  composerSiteSettingsUi.buildSiteUI($('#composerSite'), state);

  notifyComposerChange('index', { skipAutoSave: true });
  notifyComposerChange('tabs', { skipAutoSave: true });
  notifyComposerChange('site', inferredSiteRepoApplied ? {} : { skipAutoSave: true });

  refreshEditorContentTree();
  const restoredEditorState = restoreDynamicEditorState();
  if (!restoredEditorState) applyMode('editor');
  allowEditorStatePersist = true;
  if (restoredEditorState) {
    try { window.setTimeout(() => persistDynamicEditorState(), 500); }
    catch (_) { persistDynamicEditorState(); }
  } else {
    persistDynamicEditorState();
  }
});

function rebuildSiteUI() {
  const root = document.getElementById('composerSite');
  if (!root) return;
  composerSiteSettingsUi.buildSiteUI(root, activeComposerState);
  notifyComposerChange('site', { skipAutoSave: true });
}

// Minimal styles injected for composer behaviors
(function injectComposerStyles(){
  const css = `
  .ci-item,.ct-item{border:1px solid var(--border);border-radius:8px;background:var(--card);margin:.5rem 0;position:relative;filter:none;--ci-hover-tint:var(--primary);--ci-ring-shadow:0 0 0 0 transparent;--ci-depth-shadow:0 1px 2px rgba(15,23,42,0.05);box-shadow:var(--ci-ring-shadow),var(--ci-depth-shadow);}
  .ci-head,.ct-head{display:flex;align-items:center;gap:.5rem;padding:.5rem .6rem;border-bottom:1px solid var(--border);}
  .ci-head,.ct-head{border-bottom:none;}
  .ci-item.is-open .ci-head,.ct-item.is-open .ct-head{border-bottom:1px solid var(--border);}
  .ci-key,.ct-key{transition:color .18s ease;}
  .ci-body,.ct-body{display:none;padding:.5rem .6rem;}
  .ci-body-inner,.ct-body-inner{overflow:visible;}
  .ci-grip,.ct-grip{cursor:grab;user-select:none;opacity:.7}
  .ci-actions,.ct-actions{margin-left:auto;display:inline-flex;gap:.35rem}
  .ci-head-add-lang-slot{display:inline-flex;align-items:center}
  .ci-meta,.ct-meta{color:var(--muted);font-size:.85rem}
  .ci-lang,.ct-lang{border:1px dashed var(--border);border-radius:8px;margin:.4rem 0;background:color-mix(in srgb, var(--text) 3%, transparent);}
  .ci-lang{border:0;border-radius:0;margin:0;background:transparent;padding:.65rem 0;}
  .ci-lang+.ci-lang{border-top:1px solid color-mix(in srgb, var(--border) 82%, transparent);}
  .ct-lang{padding:.0625rem;}
  .ci-lang-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
  .ci-lang-label{display:inline-flex;align-items:center;gap:.35rem;line-height:1.1;}
  .ci-lang-label .ci-lang-flag{display:inline-grid;place-items:center;width:1.2em;height:1.2em;font-size:1rem;line-height:1;}
  .ci-lang-label .ci-lang-code{display:inline-flex;align-items:center;line-height:1.2;font-size:1rem;font-weight:700;letter-spacing:.035em;}
  .ci-lang-actions{margin-left:auto;display:inline-flex;gap:.35rem}
  .ct-lang{display:flex;align-items:stretch;gap:0;overflow:hidden;}
  .ct-lang-label{display:flex;align-items:center;justify-content:center;gap:.3rem;padding:.35rem .6rem;background:color-mix(in srgb, var(--text) 14%, var(--card));color:var(--text);min-width:78px;white-space:nowrap;font-weight:700;border-radius:6px 0 0 6px;}
  .ct-lang-label .ct-lang-flag{font-size:1.25rem;line-height:1;transform:translateY(-1px);}
  .ct-lang-label .ct-lang-code{font-size:.9rem;font-weight:700;letter-spacing:.045em;}
  .ci-item[data-child-draft="dirty"] .ci-key,.ct-item[data-child-draft="dirty"] .ct-key{color:#f97316;}
  .ci-item[data-child-draft="conflict"] .ci-key,.ct-item[data-child-draft="conflict"] .ct-key{color:#ef4444;}
  .ct-draft-indicator,.ci-draft-indicator{display:inline-flex;width:.55rem;height:.55rem;border-radius:999px;background:color-mix(in srgb,var(--muted) 48%, transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--muted) 14%, transparent);flex:0 0 auto;opacity:0;transform:scale(.6);transition:opacity .18s ease, transform .18s ease, background-color .18s ease, box-shadow .18s ease;}
  .ct-draft-indicator[hidden],.ci-draft-indicator[hidden]{display:none;}
  .ct-lang[data-draft-state] .ct-draft-indicator,.ci-ver-item[data-draft-state] .ci-draft-indicator{opacity:1;transform:scale(.95);}
  .ct-lang[data-draft-state="dirty"] .ct-draft-indicator,.ci-ver-item[data-draft-state="dirty"] .ci-draft-indicator{background:#f97316;box-shadow:0 0 0 3px color-mix(in srgb,#f97316 22%, transparent);}
  .ct-lang[data-draft-state="saved"] .ct-draft-indicator,.ci-ver-item[data-draft-state="saved"] .ci-draft-indicator{background:#22c55e;box-shadow:0 0 0 3px color-mix(in srgb,#22c55e 20%, transparent);}
  .ct-lang[data-draft-state="conflict"] .ct-draft-indicator,.ci-ver-item[data-draft-state="conflict"] .ci-draft-indicator{background:#ef4444;box-shadow:0 0 0 3px color-mix(in srgb,#ef4444 25%, transparent);}
  .ct-lang-main{flex:1 1 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:.5rem;align-items:center;padding:.35rem .6rem .35rem .75rem;}
  .ct-field{display:flex;align-items:center;gap:.4rem;font-weight:600;color:color-mix(in srgb, var(--text) 65%, transparent);white-space:nowrap;}
  .ct-field input{flex:1 1 auto;min-width:0;height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem;}
  .ct-lang-actions{display:flex;gap:.35rem;justify-content:flex-end;}
  .ct-lang-actions .btn-secondary{white-space:nowrap;}
  @media (max-width:720px){
    .ct-lang{flex-direction:column;gap:.4rem;}
    .ct-lang-label{justify-content:flex-start;border-radius:6px;}
    .ct-lang-main{grid-template-columns:1fr;padding:.25rem 0 0;}
    .ct-field{white-space:normal;}
    .ct-lang-actions{justify-content:flex-start;}
  }
  .ci-ver-item{display:flex;align-items:center;gap:.55rem;margin:.3rem 0;padding:.4rem .5rem;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:8px;background:color-mix(in srgb,var(--text) 2%, transparent)}
  .ci-ver-label{flex:1 1 auto;min-width:0;font-weight:600;color:var(--text)}
  .ci-ver-actions button:disabled{opacity:.5;cursor:not-allowed}
  /* Add Language row: compact button, keep menu aligned to trigger width */
  .ci-add-lang,.ct-add-lang,.cs-add-lang{display:inline-flex;align-items:center;gap:.5rem;margin-top:.5rem;position:relative;flex:0 0 auto}
  .ci-actions .ci-add-lang{margin-top:0}
  .ci-actions .ci-add-lang .btn-secondary{border-bottom:1px solid var(--border)!important}
  .ci-add-lang .btn-secondary,.ct-add-lang .btn-secondary{justify-content:center;border-bottom:0 !important}
  .ci-add-lang input,.ct-add-lang input{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .ci-add-lang select,.ct-add-lang select{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .has-menu{overflow:visible}
  .has-menu.is-open{z-index:100}
  /* Button when open looks attached to menu */
  .ci-add-lang .btn-secondary.is-open,.ct-add-lang .btn-secondary.is-open{border-bottom-left-radius:0;border-bottom-right-radius:0;background:color-mix(in srgb, var(--text) 5%, var(--card));border-color:color-mix(in srgb, var(--primary) 45%, var(--border));border-bottom:0 !important}
  /* Custom menu popup */
  .press-menu{position:absolute;top:calc(100% - 1px);left:0;right:auto;z-index:101;border:1px solid var(--border);background:var(--card);box-shadow:var(--shadow);width:max-content;min-width:100%;max-width:min(320px,calc(100vw - 3rem));border-top:none;border-bottom-left-radius:8px;border-bottom-right-radius:8px;border-top-left-radius:0;border-top-right-radius:0;transform-origin: top left;}
  .has-menu.is-open > .press-menu{animation: press-menu-in 160ms ease-out both}
  @keyframes press-menu-in{from{opacity:0; transform: translateY(-4px) scale(0.98);} to{opacity:1; transform: translateY(0) scale(1);} }
  /* Closing animation */
  .press-menu.is-closing{animation: press-menu-out 130ms ease-in both !important}
  @keyframes press-menu-out{from{opacity:1; transform: translateY(0) scale(1);} to{opacity:0; transform: translateY(-4px) scale(0.98);} }
  .press-menu .press-menu-item{display:block;width:100%;text-align:left;background:transparent;color:var(--text);border:0 !important;border-bottom:0 !important;padding:.4rem .6rem;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* Only draw a single divider: use top border on following items */
  .press-menu .press-menu-item + .press-menu-item{border-top:1px solid color-mix(in srgb, var(--text) 16%, var(--border))}
  .press-menu .press-menu-item:hover{background:color-mix(in srgb, var(--text) 6%, var(--card))}
  /* Make selects look like secondary buttons */
  .btn-like-select{appearance:none;-webkit-appearance:none;cursor:pointer;padding:.45rem .8rem;height:2.25rem;line-height:1}
  .btn-like-select:focus-visible{outline:2px solid color-mix(in srgb, var(--primary) 45%, transparent); outline-offset:2px}
  .dragging{opacity:.96}
  .drag-placeholder{border:1px dashed var(--border);border-radius:8px;background:transparent}
  .is-dragging-list{touch-action:none}
  body.press-noselect{user-select:none;cursor:grabbing}
  /* Simple badges for verify modal */
  .badge{display:inline-flex;align-items:center;gap:.25rem;border:1px solid var(--border);background:var(--card);color:var(--muted);font-size:.72rem;padding:.05rem .4rem;border-radius:999px}
  .badge-ver{ color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
  .badge-lang{}
  .ci-item.is-dirty{border-color:color-mix(in srgb,#f97316 42%, var(--border));--ci-ring-shadow:0 0 0 2px color-mix(in srgb,#f97316 18%, transparent);--ci-depth-shadow:0 10px 20px color-mix(in srgb,#f97316 16%, transparent);--ci-hover-tint:#f97316;}
  .ci-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 60%, var(--border));--ci-hover-tint:#16a34a;}
  .ci-item[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 60%, var(--border));--ci-hover-tint:#dc2626;}
  .ci-item[data-diff="modified"],.ci-item[data-diff="changed"]{--ci-hover-tint:#f59e0b;}
  .ci-diff{display:inline-flex;gap:.25rem;align-items:center;font-size:.78rem;color:color-mix(in srgb,var(--text) 68%, transparent);}
  .ci-diff-badge{display:inline-flex;align-items:center;gap:.2rem;border:1px solid color-mix(in srgb,var(--border) 70%, transparent);border-radius:999px;padding:.05rem .35rem;line-height:1;background:color-mix(in srgb,var(--text) 4%, transparent);font-size:.72rem;font-weight:600;text-transform:uppercase;color:color-mix(in srgb,var(--text) 80%, transparent);}
  .ci-diff-badge.ci-diff-badge-added{border-color:color-mix(in srgb,#16a34a 45%, var(--border));color:#166534;background:color-mix(in srgb,#16a34a 12%, transparent);}
  .ci-diff-badge.ci-diff-badge-removed{border-color:color-mix(in srgb,#dc2626 45%, var(--border));color:#b91c1c;background:color-mix(in srgb,#dc2626 12%, transparent);}
  .ci-diff-badge.ci-diff-badge-changed{border-color:color-mix(in srgb,#f59e0b 45%, var(--border));color:#b45309;background:color-mix(in srgb,#f59e0b 12%, transparent);}
  .ci-lang[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 10%, var(--card));}
  .ci-lang[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 8%, var(--card));opacity:.9;}
  .ci-lang[data-diff="modified"]{border-color:color-mix(in srgb,#f59e0b 45%, var(--border));}
  .ci-ver-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 60%, var(--border));background:color-mix(in srgb,#16a34a 8%, transparent);}
  .ci-ver-item[data-diff="changed"]{border-color:color-mix(in srgb,#f59e0b 60%, var(--border));background:color-mix(in srgb,#f59e0b 6%, transparent);}
  .ci-ver-item[data-diff="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));border-style:dashed;}
  .ci-ver-removed{margin-top:.2rem;font-size:.78rem;color:#b91c1c;}
  .ct-item.is-dirty{border-color:color-mix(in srgb,#2563eb 42%, var(--border));--ci-ring-shadow:0 0 0 2px color-mix(in srgb,#2563eb 16%, transparent);--ci-depth-shadow:0 10px 20px color-mix(in srgb,#2563eb 14%, transparent);}
  .ct-item[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));}
  .ct-item[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));}
  .ct-diff{display:inline-flex;gap:.25rem;align-items:center;font-size:.78rem;color:color-mix(in srgb,var(--text) 68%, transparent);}
  .ct-diff-badge{display:inline-flex;align-items:center;gap:.2rem;border:1px solid color-mix(in srgb,var(--border) 70%, transparent);border-radius:999px;padding:.05rem .35rem;line-height:1;background:color-mix(in srgb,var(--text) 4%, transparent);font-size:.72rem;font-weight:600;text-transform:uppercase;color:color-mix(in srgb,var(--text) 80%, transparent);}
  .ct-diff-badge.ct-diff-badge-added{border-color:color-mix(in srgb,#16a34a 45%, var(--border));color:#166534;background:color-mix(in srgb,#16a34a 12%, transparent);}
  .ct-diff-badge.ct-diff-badge-removed{border-color:color-mix(in srgb,#dc2626 45%, var(--border));color:#b91c1c;background:color-mix(in srgb,#dc2626 12%, transparent);}
  .ct-diff-badge.ct-diff-badge-changed{border-color:color-mix(in srgb,#2563eb 45%, var(--border));color:#1d4ed8;background:color-mix(in srgb,#2563eb 10%, transparent);}
  .ct-lang[data-diff="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 8%, var(--card));}
  .ct-lang[data-diff="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 6%, var(--card));opacity:.9;}
  .ct-lang[data-diff="modified"]{border-color:color-mix(in srgb,#2563eb 45%, var(--border));}
  .ct-field input[data-diff="changed"]{border-color:color-mix(in srgb,#2563eb 60%, var(--border));background:color-mix(in srgb,#2563eb 6%, transparent);}
  /* Caret arrow for Details buttons */
  .ci-expand .caret,.ct-expand .caret{display:inline-block;width:0;height:0;border-style:solid;border-width:5px 0 5px 7px;border-color:transparent transparent transparent currentColor;margin-right:.35rem;transform:rotate(0deg);transform-origin:50% 50%;transition:transform 480ms cubic-bezier(.45,0,.25,1)}
  .ci-expand[aria-expanded="true"] .caret,.ct-expand[aria-expanded="true"] .caret{transform:rotate(90deg)}
  @media (prefers-reduced-motion: reduce){
    .ci-expand .caret,.ct-expand .caret{transition:none}
  }
  /* Composer Guide */
  .comp-guide{border:1px dashed var(--border);border-radius:8px;background:color-mix(in srgb, var(--text) 3%, transparent);padding:.6rem .6rem .2rem;margin:.6rem 0 .8rem}
  .comp-guide-head{display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem}
  .comp-guide-head .muted{color:var(--muted);font-size:.88rem}
  /* Titlebar-like header inside modal */
  .press-modal-dialog .comp-guide-head{
    display:flex;align-items:center;justify-content:space-between;gap:.6rem;
    background: color-mix(in srgb, var(--text) 6%, var(--card));
    border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, var(--border));
    /* Pull to dialog edges to resemble an app title bar */
    /* Remove top gap by not offsetting beyond dialog top */
    margin: 0 -.85rem .9rem;
    padding: .65rem .85rem;
    border-top-left-radius: 12px; border-top-right-radius: 12px;
    position: sticky; top: 0; z-index: 2;
  }
  .press-modal-dialog .comp-head-left{display:flex;align-items:baseline;gap:.6rem;min-width:0}
  .press-modal-dialog .comp-guide-head strong{font-weight:700}
  .press-modal-dialog .comp-guide-head .muted{opacity:.9}
  .comp-form{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;align-items:end;margin-bottom:.5rem}
  .comp-form label{display:flex;flex-direction:column;gap:.25rem;font-weight:600}
  .comp-form label{position:relative}
  .comp-form input[type=text]{height:2rem;border:1px solid var(--border);border-radius:6px;background:var(--card);color:var(--text);padding:.25rem .4rem}
  .comp-langs{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
  .comp-langs .lab{font-weight:600; margin-right:.25rem}
  .comp-langs label{display:inline-flex;align-items:center;gap:.35rem;border:1px solid var(--border);border-radius:999px;padding:.18rem .5rem;background:var(--card);color:var(--text);cursor:pointer;user-select:none}
  .comp-langs label:hover{background:color-mix(in srgb, var(--text) 5%, transparent)}
  .comp-langs label input{display:none}
  .comp-langs label:has(input:checked){background:color-mix(in srgb, var(--primary) 16%, var(--card));border-color:color-mix(in srgb, var(--primary) 45%, var(--border))}
  .comp-langs label span{font-weight:400;font-size:.85rem}
  /* Disabled states for form + language chips */
  .comp-form input[disabled]{opacity:.6;cursor:not-allowed;background:color-mix(in srgb, var(--text) 4%, var(--card))}
  .comp-langs label:has(input[disabled]){opacity:.5;cursor:not-allowed;pointer-events:none}
  .comp-langs label:has(input[disabled]):hover{background:var(--card)}
  /* Floating bubble over inputs */
  .comp-bubble{position:absolute;bottom:calc(100% + 6px);left:0;z-index:3;padding:.28rem .5rem;border-radius:6px;border:1px solid #fecaca;background:#fee2e2;color:#7f1d1d;font-size:.88rem;line-height:1.2;box-shadow:0 1px 2px rgba(0,0,0,.05);max-width:min(72vw,560px);pointer-events:none}
  .comp-bubble::after{content:'';position:absolute;top:100%;left:14px;border-width:6px;border-style:solid;border-color:#fee2e2 transparent transparent transparent}
  /* Floating variant appended to modal to avoid clipping */
  .comp-bubble.is-floating{position:fixed;z-index:100000;bottom:auto;left:auto}
  .comp-actions{display:flex;gap:.5rem;}
  .comp-steps{margin-top:.25rem}
  /* Divider between form and steps */
  .comp-divider{height:1px;background:var(--border);opacity:.8;margin:1.5rem 0}
  .comp-step{display:grid;grid-template-columns:1.6rem 1fr;column-gap:.6rem;align-items:start;margin:.4rem 0;padding:.4rem;border:1px solid var(--border);border-radius:8px;background:var(--card)}
  .comp-step > .num{grid-column:1}
  .comp-step > .body{grid-column:2}
  .comp-step > .comp-warn{grid-column:1 / -1}
  .comp-step > .comp-ok{grid-column:1 / -1}
  .comp-step .num{flex:0 0 auto;width:1.6rem;height:1.6rem;border-radius:999px;background:color-mix(in srgb, var(--primary) 14%, var(--card));border:1px solid color-mix(in srgb, var(--primary) 36%, var(--border));display:grid;place-items:center;font-weight:700;color:var(--text)}
  .comp-step .title{font-weight:700;margin-bottom:.15rem}
  .comp-step .desc{color:var(--muted);font-size:.92rem;margin:.1rem 0}
  .comp-step .actions{display:flex;gap:.4rem;margin-top:.25rem}
  .comp-step code{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Ubuntu Mono', monospace; background: color-mix(in srgb, var(--text) 10%, transparent); padding: .08rem .35rem; border-radius: 6px; font-size: .9em;}
  /* Footer hint next to Verify */
  .comp-footer .comp-hint{color:var(--muted);font-size:.9rem;align-self:center}
  /* Validation status */
  .comp-step.ok{border-color: color-mix(in srgb, #16a34a 60%, var(--border));}
  .comp-step.err{border-color: color-mix(in srgb, #dc2626 60%, var(--border));}
  .comp-status{margin-top:.2rem;font-size:.9rem;color:var(--muted)}
  .comp-status[data-state="ok"]{color:#16a34a}
  /* Warning area at card bottom */
  .comp-warn{margin:.5rem -.4rem -.4rem -.4rem; padding:.45rem .6rem; border-top:1px solid #fecaca; background:#fee2e2; border-bottom-left-radius:8px; border-bottom-right-radius:8px; color:#7f1d1d}
  .comp-warn .comp-warn-text{font-size:.92rem; line-height:1.35}
  /* Success note at card bottom */
  .comp-ok{margin:.5rem -.4rem -.4rem -.4rem; padding:.45rem .6rem; border-top:1px solid #bbf7d0; background:#dcfce7; border-bottom-left-radius:8px; border-bottom-right-radius:8px; color:#065f46}
  .comp-ok .comp-ok-text{font-size:.92rem; line-height:1.35}
  .btn-compact{height:1.9rem;padding:.2rem .55rem;font-size:.9rem}
  /* Unify button styles inside modal (anchors and buttons) */
  .press-modal-dialog .btn-secondary,
  .press-modal-dialog a.btn-secondary,
  .press-modal-dialog button.btn-secondary {
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    height:2.25rem; padding:.45rem .8rem; border-radius:8px; font-size:.93rem; line-height:1;
    text-decoration:none; border:1px solid var(--border); background:var(--card); color:var(--text);
  }
  .press-modal-dialog a.btn-secondary:visited { color: var(--text); }
  .press-modal-dialog .btn-secondary:hover { background: color-mix(in srgb, var(--text) 5%, var(--card)); }
  /* GitHub green button variant (overrides theme packs) */
  .press-modal-dialog .btn-github,
  .press-modal-dialog a.btn-github,
  .press-modal-dialog button.btn-github {
    background:#428646 !important; color:#ffffff !important; border:1px solid #3d7741 !important; border-radius:8px !important;
  }
  .press-modal-dialog a.btn-github:visited { color:#ffffff !important; }
  .press-modal-dialog .btn-github:hover { background:#3d7741 !important; }
  .press-modal-dialog .btn-github:active { background:#298e46 !important; }
  .press-modal-dialog .btn-secondary[disabled],
  .press-modal-dialog button.btn-secondary[disabled]{opacity:.5;cursor:not-allowed;pointer-events:none;filter:grayscale(25%)}
  .press-modal-dialog .btn-primary,
  .press-modal-dialog a.btn-primary,
  .press-modal-dialog button.btn-primary {
    display:inline-flex; align-items:center; justify-content:center; gap:.35rem;
    height:2.25rem; padding:.45rem .8rem; border-radius:8px; font-size:.93rem; line-height:1;
    text-decoration:none;
  }
  .press-modal-dialog .btn-primary[disabled],
  .press-modal-dialog button.btn-primary[disabled]{opacity:.6;cursor:not-allowed;pointer-events:none;filter:grayscale(25%)}
  .press-modal-dialog a.btn-primary:visited { color: white; }

  /* Simple modal for the Composer wizard */
  .press-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,0.45);backdrop-filter:blur(3px);z-index:9999;padding:1rem}
  .press-modal.is-open{display:flex}
  /* Nudge modal upward on short viewports */
  @media (max-height: 820px){
    .press-modal{align-items:flex-start;padding-top:calc(max(12px, env(safe-area-inset-top)) + 24px)}
  }
  /* Remove top padding so sticky header can sit flush */
  .press-modal-dialog{position:relative;background:var(--card);color:var(--text);border:1px solid color-mix(in srgb, var(--primary) 28%, var(--border));border-radius:12px;box-shadow:0 14px 36px rgba(0,0,0,0.18),0 6px 18px rgba(0,0,0,0.12),0 1px 2px rgba(0,0,0,0.06);width:min(92vw, 760px);max-height:min(90vh, 720px);overflow:auto;padding:0 .85rem .85rem}
  .press-modal-close{position:absolute;top:.5rem;right:.6rem;z-index:3}
  /* When close button is inside the header, make it part of the flow */
  .press-modal-dialog .comp-guide-head .press-modal-close{position:static;top:auto;right:auto;margin-left:auto}
  body.press-modal-open{overflow:hidden}
  .press-modal-dialog .comp-guide{border:none;background:transparent;padding:0;margin:0}

  .composer-diff-tabs{display:flex;flex-wrap:wrap;gap:.35rem;margin:0 -.85rem;padding:0 .85rem .6rem;border-bottom:1px solid color-mix(in srgb,var(--text) 14%, var(--border));background:transparent}
  .composer-diff-tab{position:relative;border:0;background:none;padding:.48rem .92rem;border-radius:999px;font-weight:600;font-size:.93rem;color:color-mix(in srgb,var(--text) 68%, transparent);cursor:pointer;transition:color 160ms ease, background-color 160ms ease, transform 160ms ease}
  .composer-diff-tab.is-active{background:color-mix(in srgb,var(--primary) 18%, transparent);color:color-mix(in srgb,var(--primary) 92%, var(--text));box-shadow:0 6px 16px rgba(37,99,235,0.18)}
  .composer-diff-tab.is-active::after{content:'';position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);width:36%;min-width:24px;height:3px;border-radius:999px;background:color-mix(in srgb,var(--primary) 80%, var(--text));}
  .composer-diff-tab:hover{color:color-mix(in srgb,var(--primary) 94%, var(--text));background:color-mix(in srgb,var(--primary) 12%, transparent)}
  .composer-diff-tab:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .composer-diff-views{padding:.85rem .15rem .35rem}
  .composer-diff-view{display:block}
  .composer-diff-empty{margin:.65rem 0;font-size:.95rem;color:var(--muted)}
  .composer-diff-actions{display:flex;justify-content:flex-end;gap:.6rem;padding:.75rem .85rem .85rem;margin:0;border-top:1px solid color-mix(in srgb,var(--text) 12%, var(--border));background:color-mix(in srgb,var(--text) 2%, var(--card))}
  .composer-diff-actions .btn-secondary{min-width:140px;font-weight:600}
  .composer-diff-overview-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.65rem;margin-bottom:1rem}
  .composer-diff-stat{border:1px solid color-mix(in srgb,var(--text) 14%, var(--border));border-radius:12px;padding:.65rem .75rem;background:color-mix(in srgb,var(--text) 4%, var(--card));display:flex;flex-direction:column;gap:.12rem;min-height:74px}
  .composer-diff-stat-value{font-size:1.6rem;font-weight:700;color:color-mix(in srgb,var(--text) 88%, transparent)}
  .composer-diff-stat[data-id="order"] .composer-diff-stat-value{font-size:1.08rem}
  .composer-diff-stat-label{font-size:.85rem;color:color-mix(in srgb,var(--text) 60%, transparent)}
  .composer-diff-overview-blocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.85rem;margin:.6rem 0 1rem}
  .composer-diff-overview-block{border:1px solid var(--border);border-radius:10px;padding:.65rem .75rem;background:color-mix(in srgb,var(--text) 3%, var(--card))}
  .composer-diff-overview-block h3{margin:0 0 .45rem;font-size:.92rem;color:color-mix(in srgb,var(--text) 80%, transparent)}
  .composer-diff-key-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.28rem}
  .composer-diff-key-list code{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);font-size:.86rem;color:color-mix(in srgb,var(--text) 82%, transparent)}
  .composer-diff-key-more{font-size:.86rem;color:var(--muted)}
  .composer-diff-overview-langs{margin:.4rem 0 0;font-size:.9rem;color:color-mix(in srgb,var(--text) 62%, transparent)}
  .composer-diff-section{margin-bottom:1.05rem}
  .composer-diff-section h3{margin:0 0 .5rem;font-size:.98rem}
  .composer-diff-entry-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.55rem}
  .composer-diff-entry{border:1px solid color-mix(in srgb,var(--text) 14%, var(--border));border-radius:10px;padding:.55rem .75rem;background:color-mix(in srgb,var(--text) 3%, var(--card));display:flex;flex-direction:column;gap:.35rem}
  .composer-diff-entry-key{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace);font-weight:600;font-size:.95rem;color:var(--text)}
  .composer-diff-entry-badges{display:flex;flex-wrap:wrap;gap:.3rem;font-size:.8rem}
  .composer-diff-field-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:.2rem;font-size:.88rem;color:color-mix(in srgb,var(--text) 70%, transparent)}
  .composer-diff-field-list li{display:flex;align-items:flex-start;gap:.35rem}
  .composer-diff-field-list li::before{content:'•';color:color-mix(in srgb,var(--primary) 62%, var(--text));line-height:1.1}
  @media (max-width:640px){
    .composer-diff-tabs{margin:0 0 .6rem;padding:0 0 .6rem}
    .composer-diff-overview-stats{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
    .composer-diff-overview-blocks{grid-template-columns:1fr}
  }
  .composer-order-dialog{width:min(96vw, 880px);max-height:min(90vh, 720px);padding-bottom:1rem}
  .composer-order-head{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin:0 -.85rem .85rem;background:color-mix(in srgb,var(--text) 5%, var(--card));border-bottom:1px solid color-mix(in srgb,var(--text) 14%, var(--border));padding:.75rem .85rem;position:sticky;top:0;z-index:3}
  .composer-order-head h2{margin:0;font-size:1.15rem;font-weight:700;flex:1 1 auto}
  .composer-order-subtitle{margin:0;font-size:.9rem;color:var(--muted);flex-basis:100%;order:3}
  .composer-order-close{margin-left:auto}
  .composer-order-stats{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 .85rem;font-size:.85rem;color:var(--muted)}
  .composer-order-chip{display:inline-flex;align-items:center;gap:.3rem;border-radius:999px;padding:.18rem .55rem;border:1px solid color-mix(in srgb,var(--text) 16%, var(--border));background:color-mix(in srgb,var(--text) 4%, var(--card));font-weight:600;color:color-mix(in srgb,var(--text) 70%, transparent)}
  .composer-order-chip[data-status="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));background:color-mix(in srgb,#2563eb 14%, transparent);color:#1d4ed8}
  .composer-order-chip[data-status="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 12%, transparent);color:#166534}
  .composer-order-chip[data-status="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 12%, transparent);color:#b91c1c}
  .composer-order-chip[data-status="neutral"]{border-style:dashed}
  .composer-order-body{padding:0 0 0}
  .composer-order-visual{position:relative;padding:.4rem 3.4rem 1.9rem}
  .composer-order-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(3.2rem, 8vw, 6.8rem);position:relative;z-index:1}
  .composer-order-column-title{text-transform:uppercase;letter-spacing:.08em;font-weight:700;font-size:.8rem;color:color-mix(in srgb,var(--text) 60%, transparent);margin-bottom:.4rem}
  .composer-order-list{display:flex;flex-direction:column;gap:.45rem;min-height:1.5rem}
  .composer-order-item{display:flex;align-items:center;gap:.55rem;padding:.38rem .6rem;border:1px solid var(--border);border-radius:8px;background:color-mix(in srgb,var(--text) 3%, var(--card));position:relative;box-shadow:0 1px 2px rgba(15,23,42,0.05)}
  .composer-order-item[data-status="moved"]{border-color:color-mix(in srgb,#2563eb 55%, var(--border));background:color-mix(in srgb,#2563eb 11%, transparent)}
  .composer-order-item[data-status="added"]{border-color:color-mix(in srgb,#16a34a 55%, var(--border));background:color-mix(in srgb,#16a34a 10%, transparent)}
  .composer-order-item[data-status="removed"]{border-color:color-mix(in srgb,#dc2626 55%, var(--border));background:color-mix(in srgb,#dc2626 10%, transparent)}
  .composer-order-index{font-weight:700;font-size:.84rem;color:color-mix(in srgb,var(--text) 70%, transparent);min-width:2.3rem}
  .composer-order-key{flex:1 1 auto;min-width:0;font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace);font-size:.9rem;color:var(--text);word-break:break-word}
  .composer-order-badge{margin-left:auto;font-size:.78rem;color:color-mix(in srgb,var(--text) 62%, transparent);font-weight:600}
  .composer-order-badge.is-hidden{display:none}
  .composer-order-lines{position:absolute;inset:0;pointer-events:none;overflow:visible;z-index:0;opacity:0;transition:opacity .18s ease}
  .composer-order-lines.is-hovering{opacity:1}
  .composer-order-path{fill:none;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;opacity:0;transition:opacity .18s ease}
  .composer-order-path.is-active{opacity:.78}
  .composer-order-path[data-status="same"]{stroke:#94a3b8;stroke-dasharray:6 6}
  .composer-order-path[data-status="same"].is-active{opacity:.35}
  .composer-order-item.is-hovered{box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .composer-order-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.95rem;color:var(--muted);pointer-events:none;padding:1rem}
  .composer-order-visual.is-empty .composer-order-lines{display:none}
  .composer-order-visual.is-empty .composer-order-columns{opacity:.15}
  @media (max-width:860px){
    .composer-order-columns{grid-template-columns:1fr;gap:1.8rem}
    .composer-order-lines{display:none}
    .composer-order-visual{padding:.4rem 1.2rem 1.4rem}
    .composer-order-item{padding:.32rem .55rem}
  }

  .btn-tertiary{appearance:none;border:1px solid transparent;background:transparent;color:color-mix(in srgb,var(--primary) 92%, var(--text));font-weight:600;font-size:.9rem;padding:.3rem .6rem;border-radius:8px;cursor:pointer;transition:color .16s ease, background-color .16s ease, border-color .16s ease}
  .btn-tertiary:hover{background:color-mix(in srgb,var(--primary) 12%, transparent);border-color:color-mix(in srgb,var(--primary) 48%, transparent);color:color-mix(in srgb,var(--primary) 98%, var(--text))}
  .btn-tertiary:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .btn-tertiary[disabled]{opacity:.45;cursor:not-allowed;pointer-events:none}

  .composer-site-host{padding:.35rem 0 1.2rem}
  .composer-site-main{width:100%;max-width:none;margin:0;padding:0}
  #composerSite{width:100%}
  .cs-root{display:flex;flex-direction:column;gap:1.1rem;padding:.2rem 0 1.1rem}
  .cs-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:1rem;align-items:start}
  .cs-viewport{min-width:0;display:flex;flex-direction:column;gap:1rem}
  .cs-section{border:1px solid color-mix(in srgb,var(--border) 96%, transparent);border-radius:12px;background:var(--card);box-shadow:0 6px 18px rgba(15,23,42,0.08);padding:.9rem 1rem;display:flex;flex-direction:column;gap:.6rem}
  .cs-section-head{display:flex;align-items:baseline;gap:.65rem;flex-wrap:wrap}
  .cs-section-title{margin:0;font-size:1rem;font-weight:700;color:color-mix(in srgb,var(--text) 90%, transparent)}
  .cs-section-description{margin:0;font-size:.82rem;color:color-mix(in srgb,var(--muted) 88%, transparent);flex:1 1 260px;text-align:right}
  .cs-config-subsection{display:flex;flex-direction:column;gap:.4rem}
  .cs-config-subsection + .cs-config-subsection{border-top:1px solid color-mix(in srgb,var(--border) 82%, transparent);margin-top:.35rem;padding-top:.95rem}
  .cs-config-subsection-head{display:flex;align-items:baseline;gap:.45rem;flex-wrap:wrap;margin-bottom:.05rem}
  .cs-config-subsection-title{margin:0;font-size:.84rem;font-weight:600;color:color-mix(in srgb,var(--text) 76%, transparent)}
  .cs-config-subsection-description{margin:0;font-size:.8rem;color:color-mix(in srgb,var(--muted) 88%, transparent);flex:1 1 auto;text-align:left}
  .cs-config-subsection > .cs-config-subsection-head + .cs-field{padding-top:0}
  .cs-field{margin:0;padding:.6rem 0;display:flex;flex-direction:column;gap:.4rem;position:relative}
  .cs-field + .cs-field{border-top:1px solid color-mix(in srgb,var(--border) 82%, transparent);margin-top:.35rem;padding-top:.95rem}
  .cs-field-head{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}
  .cs-field-inline-help .cs-field-head{align-items:baseline}
  .cs-field-label-wrap{display:flex;align-items:center;gap:.45rem;flex:1 1 auto;min-width:120px}
  .cs-field-inline-help .cs-field-label-wrap{align-items:baseline;gap:.4rem;flex-wrap:wrap}
  .cs-field-label-with-switch{gap:.6rem}
  .cs-field-action{margin-left:auto}
  .cs-field-label{font-weight:600;font-size:.9rem;color:color-mix(in srgb,var(--text) 86%, transparent);flex:0 1 auto;min-width:0}
  .cs-field-help{margin:0;font-size:.8rem;color:color-mix(in srgb,var(--muted) 88%, transparent)}
  .cs-field-inline-help .cs-field-help{flex:1 1 auto;min-width:120px}
  .cs-field-controls{display:flex;flex-wrap:wrap;gap:.4rem;align-items:center}
  .cs-field-controls-inline{flex-wrap:nowrap}
  .cs-field-head-switch{display:flex;align-items:center;gap:.4rem}
  .cs-localized-list{display:flex;flex-direction:column;gap:.35rem}
  .cs-localized-row{display:flex;flex-wrap:wrap;gap:.45rem;padding:.2rem 0}
  .cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list{--cs-editor-row-gap:.35rem;--cs-editor-row-column-gap:.45rem;--cs-editor-control-height:1.95rem;--cs-editor-single-control-width:15rem}
  .cs-localized-list--grid{gap:var(--cs-editor-row-gap)}
  .cs-localized-row--grid{display:grid;grid-template-columns:minmax(88px,88px) minmax(0,1fr) minmax(72px,max-content);align-items:center;column-gap:var(--cs-editor-row-column-gap);row-gap:0;min-height:var(--cs-editor-control-height);padding:0}
  .cs-localized-input{flex:1 1 240px;min-width:180px}
  .cs-localized-row--grid .cs-localized-input{min-width:0}
  .cs-localized-row--grid .cs-lang-chip{justify-self:end}
  .cs-localized-row--multiline textarea.cs-localized-textarea{box-sizing:border-box;display:block;height:var(--cs-editor-control-height);min-height:var(--cs-editor-control-height);max-height:var(--cs-editor-control-height);padding-block:0;line-height:calc(var(--cs-editor-control-height) - 2px);resize:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:height .18s ease,min-height .18s ease,max-height .18s ease,border-color .16s ease,box-shadow .16s ease,background .16s ease}
  .cs-localized-row--multiline.is-expanded,.cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus){align-items:start}
  .cs-localized-row--multiline.is-expanded .cs-remove-lang,.cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus) .cs-remove-lang{align-self:start}
  .cs-localized-row--multiline.is-expanded textarea.cs-localized-textarea{height:4.6rem;min-height:4.6rem;max-height:12rem;padding-block:.3rem;line-height:1.25;resize:vertical;overflow:auto;white-space:pre-wrap}
  .cs-localized-row--multiline:has(textarea.cs-localized-textarea:focus) textarea.cs-localized-textarea{height:4.6rem;min-height:4.6rem;max-height:12rem;padding-block:.3rem;line-height:1.25;resize:vertical;overflow:auto;white-space:pre-wrap}
  .cs-localized-row--grid .cs-remove-lang{align-self:center;margin-left:0;white-space:nowrap}
  .cs-lang-chip{display:inline-flex;align-items:center;gap:.3rem;padding:.18rem .55rem;border-radius:999px;background:color-mix(in srgb,var(--primary) 14%, var(--card));color:color-mix(in srgb,var(--primary) 95%, var(--text));font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
  .cs-identity-grid{display:flex;flex-direction:column;gap:var(--cs-editor-row-gap)}
  .cs-identity-row{display:grid;grid-template-columns:minmax(88px,max-content) minmax(0,1fr) minmax(0,3fr) minmax(72px,max-content);align-items:center;gap:var(--cs-editor-row-column-gap)}
  .cs-identity-head{align-items:end;padding:0 0 .1rem}
  .cs-identity-head-spacer{min-width:1px}
  .cs-identity-column-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-identity-lang{min-width:0;display:flex;align-items:center;justify-content:flex-end}
  .cs-identity-field{min-width:0;display:flex;flex-direction:column;gap:.2rem}
  .cs-identity-field .cs-input{min-width:0}
  .cs-identity-cell-label{display:none;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-identity-actions{display:flex;align-items:center;justify-content:flex-end;min-width:0}
  .cs-identity-remove{width:100%;min-width:72px;margin-left:0;white-space:nowrap}
  .cs-single-grid-fieldset{gap:0}
  .cs-single-grid{display:grid;grid-template-columns:var(--cs-editor-single-label-width,88px) minmax(0,var(--cs-editor-single-control-width));column-gap:var(--cs-editor-row-column-gap);row-gap:var(--cs-editor-row-gap);align-items:center;justify-content:start}
  .cs-single-grid-row{display:grid;grid-template-columns:subgrid;grid-column:1/-1;align-items:center;gap:var(--cs-editor-row-column-gap);min-height:var(--cs-editor-control-height);padding:0;position:relative}
  .cs-single-grid-label{display:inline-flex;align-items:center;justify-content:flex-end;gap:.35rem;min-width:0;font-weight:700;color:color-mix(in srgb,var(--text) 86%, transparent)}
  .cs-single-grid-title{font-size:.84rem;white-space:nowrap}
  .cs-single-grid-control{min-width:0;display:flex;align-items:center}
  .cs-single-grid-control .cs-input,.cs-single-grid-control .cs-select{width:100%;min-width:0}
  .cs-single-grid-switch{margin:0}
  .cs-help-tooltip-wrap{position:relative;display:inline-flex;align-items:center;flex:0 0 auto}
  .cs-help-tooltip{appearance:none;width:1rem;height:1rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--primary) 42%, var(--border));background:color-mix(in srgb,var(--card) 99%, transparent);color:color-mix(in srgb,var(--primary) 88%, var(--text));font-size:.68rem;font-weight:700;line-height:1;display:inline-flex;align-items:center;justify-content:center;padding:0;cursor:help}
  .cs-help-tooltip:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 55%, transparent);outline-offset:2px}
  .cs-help-tooltip-bubble{position:absolute;left:0;bottom:calc(100% + .35rem);width:max-content;max-width:min(20rem,70vw);padding:.38rem .5rem;border:1px solid color-mix(in srgb,var(--border) 88%, transparent);border-radius:8px;background:color-mix(in srgb,var(--card) 99%, transparent);box-shadow:0 10px 24px rgba(15,23,42,0.14);color:color-mix(in srgb,var(--text) 82%, transparent);font-size:.76rem;line-height:1.3;font-weight:500;text-transform:none;letter-spacing:0;opacity:0;transform:translateY(3px);pointer-events:none;transition:opacity .14s ease,transform .14s ease;z-index:20}
  .cs-help-tooltip-wrap:hover .cs-help-tooltip-bubble,.cs-help-tooltip:focus-visible + .cs-help-tooltip-bubble{opacity:1;transform:translateY(0);pointer-events:auto}
  .cs-input{width:100%;min-height:1.95rem;padding:.3rem .5rem;border-radius:8px;border:1px solid color-mix(in srgb,var(--border) 80%, transparent);background:color-mix(in srgb,var(--card) 99%, transparent);color:var(--text);font-size:.84rem;line-height:1.25;font-family:inherit;transition:border-color .16s ease, box-shadow .16s ease, background .16s ease}
  .cs-input:focus{outline:none;border-color:color-mix(in srgb,var(--primary) 55%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  textarea.cs-input{min-height:4.6rem;resize:vertical}
  .cs-input-small{max-width:220px}
  .cs-empty{padding:.7rem .85rem;border:1px dashed color-mix(in srgb,var(--border) 75%, transparent);border-radius:9px;background:color-mix(in srgb,var(--text) 2%, var(--card));color:color-mix(in srgb,var(--muted) 90%, transparent);font-size:.88rem}
  .cs-field[data-diff="changed"] .cs-empty{background:color-mix(in srgb,#f59e0b 10%, var(--card));border-color:color-mix(in srgb,#f59e0b 45%, var(--border));color:color-mix(in srgb,#b45309 72%, var(--text))}
  .cs-add-lang,.cs-add-link{align-self:flex-start}
  .cs-remove-lang,.cs-remove-link{margin-left:auto}
  .cs-select{min-width:200px;padding:.3rem .45rem;border-radius:8px;border:1px solid color-mix(in srgb,var(--border) 80%, transparent);background:color-mix(in srgb,var(--card) 99%, transparent);color:var(--text);font-size:.84rem;line-height:1.25;font-family:inherit;transition:border-color .16s ease, box-shadow .16s ease}
  .cs-select:focus{outline:none;border-color:color-mix(in srgb,var(--primary) 55%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .cs-link-list{display:flex;flex-direction:column;gap:var(--cs-editor-row-gap)}
  .cs-link-head{display:flex;align-items:end;gap:var(--cs-editor-row-column-gap);min-height:1.1rem;padding:0}
  .cs-link-head-spacer{width:1.95rem;flex:0 0 1.95rem}
  .cs-link-head-actions{flex:0 0 72px}
  .cs-link-row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var(--cs-editor-row-column-gap);min-height:var(--cs-editor-control-height);padding:0}
  .cs-link-row.is-dragging{pointer-events:none;border-radius:10px;background:color-mix(in srgb,var(--card) 98%, transparent);box-shadow:0 14px 30px rgba(15,23,42,0.16),0 4px 12px rgba(15,23,42,0.12)}
  .cs-link-row + .cs-link-row{margin-top:0}
  .cs-link-drop-placeholder{border:1px dashed color-mix(in srgb,var(--primary) 48%, var(--border));border-radius:10px;background:color-mix(in srgb,var(--primary) 8%, transparent);min-height:var(--cs-editor-control-height);box-sizing:border-box}
  .cs-link-field{flex:1 1 200px;min-width:160px;display:flex;flex-direction:column;gap:.25rem}
  .cs-link-field--label{flex:1 1 0}
  .cs-link-field--href{flex:3 1 0}
  .cs-link-field--compact{gap:.15rem}
  .cs-link-field-title{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-link-field-title--label{flex:1 1 0;min-width:160px}
  .cs-link-field-title--href{flex:3 1 0;min-width:160px}
  .cs-link-drag-handle{width:1.95rem;min-height:var(--cs-editor-control-height);align-self:flex-end;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:.16rem;padding:.25rem .45rem;border:0;background:transparent;box-shadow:none;border-radius:8px;cursor:grab;touch-action:none;color:color-mix(in srgb,var(--muted) 86%, transparent);box-sizing:border-box;user-select:none}
  .cs-link-drag-handle:hover{background:color-mix(in srgb,var(--text) 4%, transparent)}
  .cs-link-drag-handle:focus-visible{outline:2px solid color-mix(in srgb,var(--primary) 36%, transparent);outline-offset:2px;background:color-mix(in srgb,var(--primary) 8%, transparent)}
  .cs-link-drag-handle:active{cursor:grabbing}
  .cs-link-drag-handle span{display:block;width:.9rem;height:1px;border-radius:999px;background:currentColor}
  .cs-link-row.is-dragging .cs-link-drag-handle{border-color:transparent !important;background:color-mix(in srgb,var(--primary) 12%, transparent);color:color-mix(in srgb,var(--primary) 92%, var(--text))}
  .cs-link-row.is-dragging .cs-input{border-color:color-mix(in srgb,var(--primary) 45%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 14%, transparent)}
  .cs-link-actions{display:flex;gap:.35rem;margin-left:auto;align-self:flex-end;padding-top:0}
  .cs-link-actions .btn-tertiary{min-height:var(--cs-editor-control-height)}
  .cs-remove-link{color:color-mix(in srgb,#dc2626 82%, var(--text))}
  .cs-remove-link:hover{background:color-mix(in srgb,#dc2626 12%, transparent);border-color:color-mix(in srgb,#dc2626 48%, transparent);color:#b91c1c}
  .cs-repo-grid{display:flex;align-items:flex-end;gap:.45rem;flex-wrap:nowrap;margin-top:.35rem}
  .cs-repo-path{display:flex;align-items:flex-end;gap:.35rem;flex:2 1 0;min-width:0;flex-wrap:nowrap}
  .cs-repo-field-group{display:flex;flex-direction:column;gap:.3rem;min-width:0}
  .cs-repo-field-group--owner{flex:1 1 0}
  .cs-repo-field-group--name{flex:1 1 0}
  .cs-repo-field-group--branch{flex:1 1 0}
  .cs-repo-field-title{padding-left:.55rem;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 78%, transparent)}
  .cs-repo-field{display:inline-flex;align-items:center;gap:.35rem;width:100%;padding:.22rem .55rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--border) 78%, transparent);background:color-mix(in srgb,var(--card) 98%, transparent);transition:border-color .16s ease, box-shadow .16s ease}
  .cs-repo-field:focus-within{border-color:color-mix(in srgb,var(--primary) 50%, var(--border));box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 18%, transparent)}
  .cs-repo-field .cs-repo-input{border:0;background:transparent;padding:0;min-height:1.8rem;font-size:.84rem;line-height:1.25;color:var(--text);min-width:0;width:100%;flex:1 1 auto}
  .cs-repo-field .cs-repo-input:focus{outline:none;box-shadow:none}
  .cs-repo-field--owner{min-width:0}
  .cs-repo-field--name{min-width:0}
  .cs-repo-field--branch{min-width:0}
  .cs-repo-affix{font-size:.82rem;font-weight:600;color:color-mix(in srgb,var(--muted) 78%, transparent);text-transform:lowercase;letter-spacing:.04em}
  .cs-repo-icon-affix{width:1rem;height:1rem;display:inline-flex;align-items:center;justify-content:center;flex:0 0 1rem}
  .cs-repo-icon-affix svg{display:block;fill:currentColor}
  .cs-repo-divider{align-self:flex-end;padding-bottom:.48rem;font-size:1.1rem;font-weight:600;color:color-mix(in srgb,var(--muted) 82%, transparent)}
  .cs-publish-transport-settings{margin-top:.75rem;display:flex;flex-direction:column;gap:.6rem;width:100%;padding-top:.75rem;border-top:1px solid color-mix(in srgb,var(--border) 72%, transparent)}
  .cs-publish-transport-header{display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap}
  .cs-publish-transport-title{font-size:.82rem;font-weight:700;color:color-mix(in srgb,var(--text) 88%, transparent)}
  .cs-publish-method-switch{margin-left:auto}
  .cs-connect-publish-settings,.cs-pat-publish-settings{display:flex;flex-direction:column;gap:.45rem;width:100%}
  .cs-connect-publish-settings[hidden],.cs-pat-publish-settings[hidden]{display:none}
  .cs-connect-url-field{width:100%}
  .cs-repo-field--connect-url{width:100%}
  .cs-repo-input--connect-url{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)}
  .cs-connect-publish-grant{margin:0;font-size:.8rem}
  .cs-connect-publish-grant.is-error{color:color-mix(in srgb,#dc2626 88%, var(--text))}
  .cs-connect-help{margin:0;font-size:.8rem}
  .cs-token-settings{margin-top:.35rem;display:flex;flex-direction:column;gap:.45rem;width:100%}
  .cs-token-field{width:100%;max-width:100%}
  .cs-token-field input{min-height:1.8rem;background:transparent}
  .cs-repo-field--token{width:100%}
  .cs-repo-input--token{font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace)}
  .cs-token-affix svg{fill:currentColor}
  .cs-token-clear,.cs-token-clear:hover,.cs-token-clear:focus-visible,.cs-token-clear:active{border:0!important;border-color:transparent!important;background:transparent!important;background-image:none!important;box-shadow:none!important;color:color-mix(in srgb,var(--muted) 84%, transparent);width:1.65rem;height:1.65rem;min-width:1.65rem;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:1.1rem;font-weight:400;line-height:1;cursor:pointer;padding:0;margin:0;text-decoration:none;outline:0;user-select:none}
  .cs-token-clear:hover,.cs-token-clear:focus-visible{background:color-mix(in srgb,var(--text) 6%, transparent)!important;color:color-mix(in srgb,var(--text) 82%, transparent);outline:0}
  .cs-token-clear[aria-disabled="true"]{opacity:.28;cursor:default;pointer-events:none;border:0!important;background:transparent!important;box-shadow:none!important}
  .cs-token-help{margin:0;font-size:.8rem}
  .cs-extra-list{margin:.2rem 0 0;padding-left:1.1rem;color:color-mix(in srgb,var(--muted) 90%, transparent);font-size:.88rem}
  .cs-extra-list li{margin:.2rem 0}
  .cs-switch{display:inline-flex;align-items:center;gap:.45rem;padding:.12rem .2rem;border-radius:999px;cursor:pointer;user-select:none;color:color-mix(in srgb,var(--text) 85%, transparent);transition:color .16s ease}
  .cs-switch-input{position:absolute;opacity:0;width:1px;height:1px;margin:-1px;border:0;padding:0;clip:rect(0 0 0 0);clip-path:inset(50%)}
  .cs-switch-track{position:relative;display:inline-flex;align-items:center;width:2.4rem;height:1.25rem;border-radius:999px;background:color-mix(in srgb,var(--text) 8%, var(--card));border:1px solid color-mix(in srgb,var(--border) 80%, transparent);padding:0 .15rem;transition:background .16s ease,border-color .16s ease}
  .cs-switch-thumb{width:1rem;height:1rem;border-radius:999px;background:color-mix(in srgb,var(--card) 98%, transparent);box-shadow:0 1px 2px rgba(15,23,42,0.2);transform:translateX(0);transition:transform .18s ease,background .18s ease,box-shadow .18s ease}
  .cs-switch[data-state="on"] .cs-switch-track{background:color-mix(in srgb,var(--primary) 45%, var(--card));border-color:color-mix(in srgb,var(--primary) 55%, var(--border))}
  .cs-switch[data-state="on"] .cs-switch-thumb{transform:translateX(1.05rem);background:color-mix(in srgb,var(--primary) 96%, var(--card));box-shadow:0 4px 10px color-mix(in srgb,var(--primary) 35%, transparent)}
  .cs-switch[data-state="mixed"] .cs-switch-track{background:color-mix(in srgb,#f59e0b 35%, var(--card));border-color:color-mix(in srgb,#f59e0b 55%, var(--border))}
  .cs-switch[data-state="mixed"] .cs-switch-thumb{background:color-mix(in srgb,#f59e0b 94%, var(--card));box-shadow:0 3px 8px color-mix(in srgb,#f59e0b 35%, transparent)}
  .cs-switch-input:focus-visible + .cs-switch-track{outline:2px solid color-mix(in srgb,var(--primary) 60%, transparent);outline-offset:2px}
  .cs-input[data-diff="changed"],.cs-select[data-diff="changed"],.cs-field[data-diff="changed"] .cs-input,.cs-field[data-diff="changed"] .cs-select,.cs-single-grid-row[data-diff="changed"] .cs-input,.cs-single-grid-row[data-diff="changed"] .cs-select{background:color-mix(in srgb,#f59e0b 10%, transparent);border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  .cs-repo-field[data-diff="changed"],.cs-repo-grid[data-diff="changed"] .cs-repo-field,.cs-extra-list[data-diff="changed"] li{background:color-mix(in srgb,#f59e0b 10%, transparent);border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  .cs-switch[data-diff="changed"] .cs-switch-track,.cs-field[data-diff="changed"] .cs-switch-track,.cs-single-grid-row[data-diff="changed"] .cs-switch-track{background:color-mix(in srgb,#f59e0b 18%, var(--card));border-color:color-mix(in srgb,#f59e0b 45%, var(--border))}
  @media (max-width:920px){
    .cs-layout{grid-template-columns:minmax(0,1fr);gap:1rem}
  }
  @media (max-width:880px){
    .cs-section{padding:.9rem .9rem}
    .cs-select{min-width:0;width:100%}
    .cs-input-small{max-width:100%}
    .cs-identity-row{grid-template-columns:minmax(74px,max-content) minmax(0,1fr) minmax(0,3fr) minmax(68px,max-content)}
    .cs-link-actions{width:100%;justify-content:flex-end;margin-left:0;align-self:auto;padding-top:.35rem}
  }
  @media (max-width:720px){
    .cs-section-description{text-align:left}
    .cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list{--cs-editor-row-gap:.5rem}
    .cs-repo-grid,.cs-repo-path{flex-wrap:wrap}
    .cs-repo-path,.cs-repo-field-group--branch{flex:1 1 100%}
    .cs-repo-field-group--owner,.cs-repo-field-group--name{flex:1 1 calc(50% - .4rem)}
    .cs-localized-row--grid{grid-template-columns:1fr;gap:.35rem}
    .cs-localized-row--grid .cs-remove-lang{justify-self:flex-start}
    .cs-identity-grid{gap:.5rem}
    .cs-identity-head{display:none}
    .cs-identity-row{grid-template-columns:1fr;align-items:stretch;gap:.4rem;padding:.55rem 0;border-top:1px solid color-mix(in srgb,var(--border) 72%, transparent)}
    .cs-identity-head + .cs-identity-row{border-top:0;padding-top:.1rem}
    .cs-identity-cell-label{display:block}
    .cs-identity-actions{justify-content:flex-start}
    .cs-single-grid{grid-template-columns:1fr;row-gap:.35rem}
    .cs-single-grid-row{grid-template-columns:1fr;align-items:stretch;gap:.35rem;padding:.2rem 0}
  }

  /* Modal animations */
  @keyframes nsModalFadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes nsModalFadeOut { from { opacity: 1 } to { opacity: 0 } }
  @keyframes nsModalSlideIn { from { transform: translateY(10px) scale(.98); opacity: 0 } to { transform: translateY(0) scale(1); opacity: 1 } }
  @keyframes nsModalSlideOut { from { transform: translateY(0) scale(1); opacity: 1 } to { transform: translateY(8px) scale(.98); opacity: 0 } }
  .press-modal.press-anim-in { animation: nsModalFadeIn 160ms ease both; }
  .press-modal.press-anim-out { animation: nsModalFadeOut 160ms ease both; }
  .press-modal.press-anim-in .press-modal-dialog { animation: nsModalSlideIn 200ms cubic-bezier(.2,.95,.4,1) both; }
  .press-modal.press-anim-out .press-modal-dialog { animation: nsModalSlideOut 160ms ease both; }
  @media (prefers-reduced-motion: reduce){
    .press-modal.press-anim-in,
    .press-modal.press-anim-out,
    .press-modal.press-anim-in .press-modal-dialog,
    .press-modal.press-anim-out .press-modal-dialog { animation: none !important; }
  }
  `;
  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
})();
