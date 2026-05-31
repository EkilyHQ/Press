import { createComposerYamlSerialization } from './composer-yaml-serialization.js';
import { createComposerDiffUi } from './composer-diff-ui.js';
import { createComposerOrderDiffUi } from './composer-order-diff-ui.js';
import { createComposerIndexTabsUi } from './composer-index-tabs-ui.js';
import { createComposerSiteSettingsUi } from './composer-site-settings-ui.js';
import { createComposerYamlPanelsController } from './composer-yaml-panels-controller.js';
import { createComposerYamlActions } from './composer-yaml-actions.js';
import { createComposerYamlDraftController } from './composer-yaml-drafts.js';
import {
  CONNECT_PUBLISH_PRESETS
} from './publish/settings-store.js';

const ANNOTATE_DISCUSSION_CATEGORY_PRESETS = [
  { value: 'General', label: 'General' }
];

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

const noop = () => {};

export function createComposerYamlSiteFeature(options = {}) {
  const editorRuntime = options.editorRuntime || {};
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const consoleRef = options.consoleRef || { error: noop, warn: noop };
  const preferredLangOrder = Array.isArray(options.preferredLangOrder) ? options.preferredLangOrder : [];
  const langCodePattern = options.langCodePattern || /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
  const languagePoolChangedEvent = options.languagePoolChangedEvent || 'press-composer-language-pool-changed';
  const t = typeof options.t === 'function' ? options.t : (key) => String(key || '');
  const tComposer = typeof options.tComposer === 'function' ? options.tComposer : (suffix, params) => t(`editor.composer.${suffix}`, params);
  const tComposerDiff = typeof options.tComposerDiff === 'function' ? options.tComposerDiff : (suffix, params) => t(`editor.composer.diff.${suffix}`, params);
  const tComposerLang = typeof options.tComposerLang === 'function' ? options.tComposerLang : (suffix, params) => t(`editor.composer.languages.${suffix}`, params);
  const tComposerEntryRow = typeof options.tComposerEntryRow === 'function' ? options.tComposerEntryRow : (suffix, params) => t(`editor.composer.entryRow.${suffix}`, params);
  const normalizeLangCode = typeof options.normalizeLangCode === 'function' ? options.normalizeLangCode : (code) => String(code || '').trim().toLowerCase();
  const isLanguageCode = typeof options.isLanguageCode === 'function' ? options.isLanguageCode : (value) => langCodePattern.test(String(value || '').trim());
  const getLanguageLabel = typeof options.getLanguageLabel === 'function' ? options.getLanguageLabel : () => '';
  const isIndexMetadataObject = typeof options.isIndexMetadataObject === 'function' ? options.isIndexMetadataObject : (value) => !!value && typeof value === 'object' && !Array.isArray(value);
  const writeYamlValue = typeof options.writeYamlValue === 'function' ? options.writeYamlValue : noop;
  const escapeHtml = typeof options.escapeHtml === 'function' ? options.escapeHtml : (value) => String(value ?? '');
  const safeString = typeof options.safeString === 'function' ? options.safeString : (value) => (value == null ? '' : String(value));

  const serialization = createComposerYamlSerialization({
    preferredLangOrder,
    normalizeLangCode,
    getLanguageLabel,
    isIndexMetadataObject,
    writeYamlValue
  });
  const {
    displayLangName,
    langFlag,
    sortLangKeys,
    toIndexYaml,
    toTabsYaml
  } = serialization;

  function createRuntime(runtimeOptions = {}) {
    const composerYamlDraftController = createComposerYamlDraftController({
      draftStore: runtimeOptions.draftStore,
      getStateSlice: runtimeOptions.getStateSlice,
      setStateSlice: runtimeOptions.setStateSlice,
      getComposerDiff: runtimeOptions.getComposerDiff,
      computeBaselineSignature: runtimeOptions.computeBaselineSignature,
      prepareIndexState: runtimeOptions.prepareIndexState,
      prepareTabsState: runtimeOptions.prepareTabsState,
      cloneSiteState: runtimeOptions.cloneSiteState,
      updateUnsyncedSummary: runtimeOptions.updateUnsyncedSummary,
      setTimeoutRef: runtimeOptions.setTimeoutRef,
      clearTimeoutRef: runtimeOptions.clearTimeoutRef
    });

    const composerDiffUi = createComposerDiffUi({
      documentRef,
      t,
      tComposer,
      tComposerDiff,
      tComposerLang,
      escapeHtml,
      siteFieldLabelMap: SITE_FIELD_LABEL_MAP,
      getStateSlice: runtimeOptions.getStateSlice,
      getRemoteBaseline: runtimeOptions.getRemoteBaseline,
      getComposerDiff: runtimeOptions.getComposerDiff,
      recomputeDiff: runtimeOptions.recomputeDiff,
      getActiveComposerFile: runtimeOptions.getActiveComposerFile,
      animateInlineVisibility: runtimeOptions.animateInlineVisibility
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

    const composerOrderDiffUi = createComposerOrderDiffUi({
      documentRef,
      tComposer,
      tComposerDiff,
      truncateText: runtimeOptions.truncateText,
      getStateSlice: runtimeOptions.getStateSlice,
      getRemoteBaseline: runtimeOptions.getRemoteBaseline,
      getComposerDiff: runtimeOptions.getComposerDiff,
      recomputeDiff: runtimeOptions.recomputeDiff,
      computeOrderDiffDetails,
      buildEntryDiffBadges,
      renderOrderStatsChips,
      renderComposerInlineSummary,
      captureElementRect: runtimeOptions.captureElementRect,
      animateListTransition: runtimeOptions.animateListTransition,
      cancelOrderMainTransition: runtimeOptions.cancelOrderMainTransition,
      animateOrderMainReset: runtimeOptions.animateOrderMainReset,
      animateInlineVisibility: runtimeOptions.animateInlineVisibility,
      cssEscape: runtimeOptions.cssEscape,
      getComposerViewTransition: runtimeOptions.getComposerViewTransition,
      getSlideDurations: runtimeOptions.getSlideDurations,
      requestAnimationFrameRef: runtimeOptions.requestAnimationFrameRef,
      cancelAnimationFrameRef: runtimeOptions.cancelAnimationFrameRef,
      setTimeoutRef: runtimeOptions.setTimeoutRef,
      clearTimeoutRef: runtimeOptions.clearTimeoutRef,
      addWindowListener: runtimeOptions.addWindowListener,
      addDocumentListener: runtimeOptions.addDocumentListener,
      matchesMedia: runtimeOptions.matchesMedia,
      getComputedStyleRef: runtimeOptions.getComputedStyleRef,
      ResizeObserverRef: runtimeOptions.ResizeObserverRef,
      consoleRef
    });
    const {
      openComposerDiffModal,
      scheduleComposerOrderPreviewRelayout,
      updateComposerOrderPreview,
      setComposerOrderPreviewActiveKind,
      getComposerOrderPreviewActiveKind,
      closeComposerDiffModalForKind
    } = composerOrderDiffUi;

    const composerIndexTabsUi = createComposerIndexTabsUi({
      documentRef,
      requestAnimationFrameRef: runtimeOptions.requestAnimationFrameRef,
      setTimeoutRef: runtimeOptions.setTimeoutRef,
      addWindowListener: runtimeOptions.addWindowListener,
      addDocumentListener: runtimeOptions.addDocumentListener,
      getWindowScroll: runtimeOptions.getWindowScroll,
      alertRef: runtimeOptions.alertRef,
      getComputedStyleRef: runtimeOptions.getComputedStyleRef,
      preferredLangOrder,
      query: runtimeOptions.query,
      escapeHtml,
      tComposer,
      tComposerLang,
      tComposerEntryRow,
      treeText: runtimeOptions.treeText,
      displayLangName,
      langFlag,
      sortLangKeys,
      normalizeRelPath: runtimeOptions.normalizeRelPath,
      normalizeIndexVariantList: runtimeOptions.normalizeIndexVariantList,
      getIndexVariantLocation: runtimeOptions.getIndexVariantLocation,
      extractVersionFromPath: runtimeOptions.extractVersionFromPath,
      buildDefaultLanguagePathFromEntry: runtimeOptions.buildDefaultLanguagePathFromEntry,
      buildArticleVersionPath: runtimeOptions.buildArticleVersionPath,
      promptArticleVersionValue: runtimeOptions.promptArticleVersionValue,
      openMarkdownInEditor: runtimeOptions.openMarkdownInEditor,
      notifyComposerChange: runtimeOptions.notifyComposerChange,
      broadcastLanguagePoolChange: runtimeOptions.broadcastLanguagePoolChange,
      updateComposerMarkdownDraftIndicators: runtimeOptions.updateComposerMarkdownDraftIndicators,
      updateComposerDraftContainerState: runtimeOptions.updateComposerDraftContainerState,
      scheduleComposerOrderPreviewRelayout,
      getComposerOrderPreviewActiveKind,
      updateComposerOrderPreview,
      cancelListTransition: runtimeOptions.cancelListTransition,
      slideToggle: runtimeOptions.slideToggle
    });

    const composerSiteSettingsUi = createComposerSiteSettingsUi({
      documentRef,
      windowRef,
      performanceRef: runtimeOptions.performanceRef,
      cssRef: runtimeOptions.cssRef,
      requestAnimationFrameRef: runtimeOptions.requestAnimationFrameRef,
      cancelAnimationFrameRef: runtimeOptions.cancelAnimationFrameRef,
      setTimeoutRef: runtimeOptions.setTimeoutRef,
      clearTimeoutRef: runtimeOptions.clearTimeoutRef,
      fetchContent: runtimeOptions.fetchContent,
      getComputedStyleRef: runtimeOptions.getComputedStyleRef,
      preferredLangOrder,
      langCodePattern,
      languagePoolChangedEvent,
      t,
      cloneSiteState: runtimeOptions.cloneSiteState,
      prepareSiteState: runtimeOptions.prepareSiteState,
      setStateSlice: runtimeOptions.setStateSlice,
      composerPrefersReducedMotion: runtimeOptions.composerPrefersReducedMotion,
      resolveComposerScrollDuration: runtimeOptions.resolveComposerScrollDuration,
      animateComposerViewportScroll: runtimeOptions.animateComposerViewportScroll,
      cancelComposerSiteScrollAnimation: runtimeOptions.cancelComposerSiteScrollAnimation,
      normalizeLangCode,
      isLanguageCode,
      getAvailableLangs: runtimeOptions.getAvailableLangs,
      displayLangName,
      escapeHtml,
      broadcastLanguagePoolChange: runtimeOptions.broadcastLanguagePoolChange,
      notifyComposerChange: runtimeOptions.notifyComposerChange,
      syncSiteEditorSingleLabelWidth: runtimeOptions.syncSiteEditorSingleLabelWidth,
      renderPublishTransportSettings: runtimeOptions.renderPublishTransportSettings,
      applyMode: runtimeOptions.applyMode,
      safeString,
      connectPublishPresets: CONNECT_PUBLISH_PRESETS,
      annotateDiscussionCategoryPresets: ANNOTATE_DISCUSSION_CATEGORY_PRESETS
    });

    function buildIndexUI(root, state) {
      return composerIndexTabsUi.buildIndexUI(root, state);
    }

    function buildTabsUI(root, state) {
      return composerIndexTabsUi.buildTabsUI(root, state);
    }

    function buildSiteUI(root, state) {
      return composerSiteSettingsUi.buildSiteUI(root, state);
    }

    const composerYamlPanelsController = createComposerYamlPanelsController({
      documentRef,
      cssEscape: runtimeOptions.cssEscape,
      clearInlineSlideStyles: runtimeOptions.clearInlineSlideStyles,
      getActiveState: runtimeOptions.getActiveState,
      buildIndexUI,
      buildTabsUI,
      buildSiteUI,
      notifyComposerChange: runtimeOptions.notifyComposerChange,
      updateMarkdownDraftIndicators: () => runtimeOptions.updateComposerMarkdownDraftIndicators()
    });

    function getComposerDraftMeta(kind) {
      return composerYamlDraftController.getDraftMeta(kind);
    }

    function hasAnyComposerDraftMeta() {
      return composerYamlDraftController.hasAnyDraftMeta();
    }

    function rawScheduleYamlAutoDraft(kind) {
      composerYamlDraftController.scheduleAutoDraft(kind);
    }

    function rawClearDraftStorage(kind) {
      composerYamlDraftController.clearDraftStorage(kind);
    }

    function rawApplyYamlDiffMarkers(kind) {
      const diff = runtimeOptions.getComposerDiff(kind) || runtimeOptions.recomputeDiff(kind);
      if (kind === 'tabs') applyTabsDiffMarkers(diff);
      else if (kind === 'site') applySiteDiffMarkers(diff);
      else applyIndexDiffMarkers(diff);
      return diff;
    }

    function rawApplySiteConfigForYamlChange(kind) {
      if (kind === 'site') {
        try { runtimeOptions.applyEffectiveSiteConfig(runtimeOptions.getStateSlice('site') || {}); } catch (_) {}
      }
    }

    function rawRefreshOrderPreviewForYamlChange(kind) {
      if ((kind === 'index' || kind === 'tabs') && getComposerOrderPreviewActiveKind() === kind) updateComposerOrderPreview(kind);
    }

    function rebuildIndexUI(preserveOpen = true) {
      return composerYamlPanelsController.rebuildIndexUI(preserveOpen);
    }

    function rebuildTabsUI(preserveOpen = true) {
      return composerYamlPanelsController.rebuildTabsUI(preserveOpen);
    }

    function rebuildSiteUI() {
      return composerYamlPanelsController.rebuildSiteUI();
    }

    function loadDraftSnapshotsIntoState(state) {
      return composerYamlDraftController.loadDraftSnapshotsIntoState(state);
    }

    const composerYamlActions = createComposerYamlActions({
      consoleRef,
      confirmRef: runtimeOptions.confirmRef,
      t,
      fetchConfigWithYamlFallback: runtimeOptions.fetchConfigWithYamlFallback,
      fetchTrackedSiteConfig: runtimeOptions.fetchTrackedSiteConfig,
      getActiveComposerFile: runtimeOptions.getActiveComposerFile,
      getContentRootSafe: runtimeOptions.getContentRootSafe,
      prepareIndexState: runtimeOptions.prepareIndexState,
      prepareTabsState: runtimeOptions.prepareTabsState,
      prepareSiteState: runtimeOptions.prepareSiteState,
      cloneSiteState: runtimeOptions.cloneSiteState,
      deepClone: runtimeOptions.deepClone,
      computeBaselineSignature: runtimeOptions.computeBaselineSignature,
      getComposerDiff: runtimeOptions.getComposerDiff,
      getRemoteBaseline: runtimeOptions.getRemoteBaselineForKind,
      setRemoteBaseline: runtimeOptions.setRemoteBaseline,
      setStateSlice: runtimeOptions.setStateSlice,
      applyEffectiveSiteConfig: runtimeOptions.applyEffectiveSiteConfig,
      rebuildIndexUI,
      rebuildTabsUI,
      rebuildSiteUI,
      notifyComposerChange: runtimeOptions.notifyComposerChange,
      showStatus: runtimeOptions.showStatus,
      getDraftMeta: getComposerDraftMeta,
      clearAutoDraftTimer: (kind) => composerYamlDraftController.clearAutoDraftTimer(kind),
      clearDraftStorage: runtimeOptions.clearDraftStorage,
      showDiscardConfirm: runtimeOptions.showDiscardConfirm,
      setTimeoutRef: runtimeOptions.setTimeoutRef
    });
    const {
      handleDiscard: handleComposerDiscard,
      handleRefresh: handleComposerRefresh
    } = composerYamlActions;

    return {
      applySiteDiffMarkers,
      applyIndexDiffMarkers,
      applyTabsDiffMarkers,
      buildEntryDiffBadges,
      computeOrderDiffDetails,
      refreshFileDirtyBadges,
      refreshComposerInlineMeta,
      renderComposerInlineSummary,
      renderOrderStatsChips,
      openComposerDiffModal,
      scheduleComposerOrderPreviewRelayout,
      updateComposerOrderPreview,
      setComposerOrderPreviewActiveKind,
      getComposerOrderPreviewActiveKind,
      closeComposerDiffModalForKind,
      getComposerDraftMeta,
      hasAnyComposerDraftMeta,
      rawScheduleYamlAutoDraft,
      rawClearDraftStorage,
      rawApplyYamlDiffMarkers,
      rawApplySiteConfigForYamlChange,
      rawRefreshOrderPreviewForYamlChange,
      buildIndexUI,
      buildTabsUI,
      buildSiteUI,
      rebuildIndexUI,
      rebuildTabsUI,
      rebuildSiteUI,
      loadDraftSnapshotsIntoState,
      handleComposerDiscard,
      handleComposerRefresh,
      updateDynamicTabsGroupState: () => composerYamlPanelsController.updateDynamicTabsGroupState()
    };
  }

  return {
    displayLangName,
    langFlag,
    sortLangKeys,
    toIndexYaml,
    toTabsYaml,
    createRuntime
  };
}
