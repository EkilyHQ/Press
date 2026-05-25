import { createStagingRegistry } from './composer-staging.js?v=press-system-v3.4.51';
import { createIndexPublishMetadataEnricher } from './composer-index-publish-metadata.js?v=press-system-v3.4.51';
import { createContentCommitStagingProvider } from './composer-content-staging.js?v=press-system-v3.4.51';
import { createSeoStagingProvider } from './composer-seo-staging.js?v=press-system-v3.4.51';
import { createPostCommitStateApplier } from './composer-post-commit-state.js?v=press-system-v3.4.51';

function noop() {}

export function createComposerPublishStateService(options = {}) {
  const createStagingRegistryRef = options.createStagingRegistry || createStagingRegistry;
  const createIndexPublishMetadataEnricherRef = options.createIndexPublishMetadataEnricher || createIndexPublishMetadataEnricher;
  const createContentCommitStagingProviderRef = options.createContentCommitStagingProvider || createContentCommitStagingProvider;
  const createSeoStagingProviderRef = options.createSeoStagingProvider || createSeoStagingProvider;
  const createPostCommitStateApplierRef = options.createPostCommitStateApplier || createPostCommitStateApplier;
  const getStateSlice = options.getStateSlice || (() => null);
  const getContentRootSafe = options.getContentRootSafe || (() => 'wwwroot');
  const safeString = options.safeString || ((value) => String(value == null ? '' : value));

  const stagingRegistry = createStagingRegistryRef();
  const indexPublishMetadata = createIndexPublishMetadataEnricherRef({
    safeString,
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
    getContentRootSafe,
    fetchImpl: typeof options.fetchContent === 'function' ? options.fetchContent : null
  });

  const contentCommitStagingProvider = createContentCommitStagingProviderRef({
    getDynamicEditorTabs: options.getDynamicEditorTabs || (() => new Map()),
    flushMarkdownDraft: options.flushMarkdownDraft || (async () => null),
    getStateSlice,
    getContentRootSafe,
    getRemoteBaseline: options.getRemoteBaseline || (() => ({})),
    getComposerDiffCache: options.getComposerDiffCache || (() => ({})),
    setComposerDiff: options.setComposerDiff || noop,
    collectCurrentRepositoryMarkdownAssetReferences: options.collectCurrentRepositoryMarkdownAssetReferences || (async () => ({ refs: new Set(), failures: [] })),
    collectUnsyncedMarkdownEntries: options.collectUnsyncedMarkdownEntries || (() => []),
    getPrimaryEditorApi: options.getPrimaryEditorApi || (() => null),
    getActiveDynamicTab: options.getActiveDynamicTab || (() => null),
    getCurrentMode: options.getCurrentMode || (() => ''),
    readMarkdownDraftStore: options.readMarkdownDraftStore || (() => ({})),
    normalizeRelPath: options.normalizeRelPath,
    findDynamicTabByPath: options.findDynamicTabByPath || (() => null),
    getLockedEncryptedMarkdownDraft: options.getLockedEncryptedMarkdownDraft || (() => ''),
    normalizeMarkdownContent: options.normalizeMarkdownContent,
    isEncryptedMarkdownDraftEntry: options.isEncryptedMarkdownDraftEntry || (() => false),
    prepareMarkdownForProtectedStorage: options.prepareMarkdownForProtectedStorage || (async (_tab, text) => ({ content: text, encrypted: false })),
    listMarkdownAssets: options.listMarkdownAssets || (() => []),
    isAssetReferencedInContent: options.isAssetReferencedInContent || (() => true),
    removeMarkdownAsset: options.removeMarkdownAsset || noop,
    enrichIndexStateForPublish: indexPublishMetadata.enrichIndexStateForPublish,
    toIndexYaml: options.toIndexYaml || (() => ''),
    toTabsYaml: options.toTabsYaml || (() => ''),
    toSiteYaml: options.toSiteYaml || (() => ''),
    setStateSlice: options.setStateSlice || noop,
    computeIndexDiff: options.computeIndexDiff || (() => null),
    recomputeDiff: options.recomputeDiff || (() => null),
    listMarkdownAssetDeletions: options.listMarkdownAssetDeletions || (() => []),
    safeString,
    draftHasAssetDeletions: options.draftHasAssetDeletions || (() => false),
    textWithFallback: options.textWithFallback || ((_key, fallback) => fallback),
    fetchImpl: typeof options.fetchContent === 'function' ? options.fetchContent : null,
    consoleRef: options.consoleRef || null
  });

  const seoStagingProvider = createSeoStagingProviderRef({
    getStateSlice,
    getContentRootSafe,
    getRemoteBaselineSite: options.getRemoteBaselineSite || (() => null),
    cloneSiteState: options.cloneSiteState,
    isIndexMetadataObject: options.isIndexMetadataObject,
    getIndexVariantLocation: options.getIndexVariantLocation,
    fetchImpl: typeof options.fetchContent === 'function' ? options.fetchContent : null,
    getLocationOrigin: options.getLocationOrigin || (() => ''),
    getDocumentLang: options.getDocumentLang || (() => ''),
    consoleRef: options.consoleRef || null
  });

  const postCommitStateApplier = createPostCommitStateApplierRef({
    stagingRegistry,
    getStateSlice,
    getRemoteBaseline: options.getRemoteBaseline || (() => ({})),
    setRemoteBaselineSlice: options.setRemoteBaselineSlice || noop,
    deepClone: options.deepClone,
    prepareIndexState: options.prepareIndexState,
    prepareTabsState: options.prepareTabsState,
    prepareSiteState: options.prepareSiteState,
    cloneSiteState: options.cloneSiteState,
    notifyComposerChange: options.notifyComposerChange || noop,
    clearDraftStorage: options.clearDraftStorage || noop,
    getContentRootSafe,
    applyComposerEffectiveSiteConfig: options.applyComposerEffectiveSiteConfig || ((state) => state),
    safeString,
    updateComposerMarkdownDraftIndicators: options.updateComposerMarkdownDraftIndicators || noop,
    updateMarkdownPushButton: options.updateMarkdownPushButton || noop,
    updateMarkdownDiscardButton: options.updateMarkdownDiscardButton || noop,
    updateMarkdownSaveButton: options.updateMarkdownSaveButton || noop,
    updateMarkdownProtectionButton: options.updateMarkdownProtectionButton || noop,
    getActiveDynamicTab: options.getActiveDynamicTab || (() => null),
    normalizeRelPath: options.normalizeRelPath,
    clearMarkdownDraftEntry: options.clearMarkdownDraftEntry || noop,
    clearMarkdownAssetsForPath: options.clearMarkdownAssetsForPath || noop,
    findDynamicTabByPath: options.findDynamicTabByPath || (() => null),
    computeTextSignature: options.computeTextSignature,
    setMarkdownProtectionState: options.setMarkdownProtectionState || noop,
    createMarkdownProtectionState: options.createMarkdownProtectionState || (() => ({})),
    setDynamicTabStatus: options.setDynamicTabStatus || noop,
    normalizeMarkdownContent: options.normalizeMarkdownContent,
    getMarkdownProtectionState: options.getMarkdownProtectionState || (() => ({})),
    scheduleMarkdownDraftSave: options.scheduleMarkdownDraftSave || noop,
    updateDynamicTabDirtyState: options.updateDynamicTabDirtyState || noop,
    removeMarkdownAsset: options.removeMarkdownAsset || noop,
    removeMarkdownAssetDeletion: options.removeMarkdownAssetDeletion || noop,
    updateUnsyncedSummary: options.updateUnsyncedSummary || noop
  });

  stagingRegistry.registerStagingProvider({
    id: 'content',
    required: true,
    getCommitFiles: (context = {}) => contentCommitStagingProvider.getCommitFiles(context)
  });
  if (typeof options.registerExternalStagingProviders === 'function') {
    options.registerExternalStagingProviders(stagingRegistry);
  }
  stagingRegistry.registerStagingProvider({
    id: 'seo',
    async getCommitFiles(context = {}) {
      if (context.showSeoStatus && typeof context.setStatus === 'function') {
        try { context.setStatus('Generating SEO files...'); } catch (_) {}
      }
      return seoStagingProvider.getCommitFiles(context);
    }
  });

  async function gatherCommitPayload(context = {}) {
    const { showSeoStatus = false } = context;
    const providerResult = await stagingRegistry.getCommitFiles({
      ...context,
      showSeoStatus,
      setStatus: context.setStatus
    });
    const files = Array.isArray(providerResult.files) ? providerResult.files : [];
    const seoFiles = files.filter(file => file && file.kind === 'seo');
    return { files, seoFiles, warnings: providerResult.warnings || [] };
  }

  function getTrackedPublishContentRoot() {
    const site = getStateSlice('site') || {};
    const root = safeString(site.contentRoot || 'wwwroot')
      .replace(/[\\]/g, '/')
      .replace(/\/+$/g, '');
    return root || 'wwwroot';
  }

  function getStagingSummaryEntries(context = {}) {
    return stagingRegistry.getSummaryEntries(context);
  }

  function applyLocalPostCommitState(files = []) {
    return postCommitStateApplier.apply(files);
  }

  return {
    gatherCommitPayload,
    getTrackedPublishContentRoot,
    getStagingSummaryEntries,
    applyLocalPostCommitState
  };
}
