import { createComposerSiteSettingsControls } from './composer-site-settings-controls.js';
import { createComposerSiteSettingsConfigGrids } from './composer-site-settings-config-grids.js';
import { createComposerSiteSettingsLinkList } from './composer-site-settings-link-list.js';
import { createComposerSiteSettingsLocalizedFields } from './composer-site-settings-localized-fields.js';
import { createComposerSiteSettingsRepoSection } from './composer-site-settings-repo-section.js';
import { createComposerSiteSettingsSchema } from './composer-site-settings-schema.js';
import { createComposerSiteSettingsSingleGrids } from './composer-site-settings-single-grids.js';
import {
  cleanupComposerSiteSettingsSectionNav,
  createComposerSiteSettingsSectionNav
} from './composer-site-settings-section-nav.js';

export function createComposerSiteSettingsUi(options = {}) {
  const noop = () => {};
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const performanceRef = options.performanceRef || null;
  const cssRef = options.cssRef || null;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function' ? options.requestAnimationFrameRef : null;
  const cancelAnimationFrameRef = typeof options.cancelAnimationFrameRef === 'function' ? options.cancelAnimationFrameRef : null;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function' ? options.setTimeoutRef : null;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function' ? options.clearTimeoutRef : null;
  const fetchContent = typeof options.fetchContent === 'function' ? options.fetchContent : null;
  const getComputedStyleRef = typeof options.getComputedStyleRef === 'function' ? options.getComputedStyleRef : null;
  const PREFERRED_LANG_ORDER = Array.isArray(options.preferredLangOrder) ? options.preferredLangOrder : [];
  const LANG_CODE_PATTERN = options.langCodePattern || /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
  const LANGUAGE_POOL_CHANGED_EVENT = options.languagePoolChangedEvent || 'press-composer-language-pool-changed';
  const CONNECT_PUBLISH_PRESETS = Array.isArray(options.connectPublishPresets) ? options.connectPublishPresets : [];
  const ANNOTATE_DISCUSSION_CATEGORY_PRESETS = Array.isArray(options.annotateDiscussionCategoryPresets) ? options.annotateDiscussionCategoryPresets : [];
  const t = typeof options.t === 'function' ? options.t : (key) => key;
  const cloneSiteState = typeof options.cloneSiteState === 'function'
    ? options.cloneSiteState
    : (value) => JSON.parse(JSON.stringify(value || {}));
  const prepareSiteState = typeof options.prepareSiteState === 'function' ? options.prepareSiteState : (value) => value || {};
  const setStateSlice = typeof options.setStateSlice === 'function' ? options.setStateSlice : noop;
  const composerPrefersReducedMotion = typeof options.composerPrefersReducedMotion === 'function' ? options.composerPrefersReducedMotion : () => true;
  const resolveComposerScrollDuration = typeof options.resolveComposerScrollDuration === 'function' ? options.resolveComposerScrollDuration : () => 0;
  const animateComposerViewportScroll = typeof options.animateComposerViewportScroll === 'function' ? options.animateComposerViewportScroll : () => false;
  const cancelComposerSiteScrollAnimation = typeof options.cancelComposerSiteScrollAnimation === 'function' ? options.cancelComposerSiteScrollAnimation : noop;
  const normalizeLangCode = typeof options.normalizeLangCode === 'function' ? options.normalizeLangCode : (code) => String(code || '').trim().toLowerCase();
  const getAvailableLangs = typeof options.getAvailableLangs === 'function' ? options.getAvailableLangs : () => [];
  const displayLangName = typeof options.displayLangName === 'function' ? options.displayLangName : (code) => String(code || '').toUpperCase();
  const escapeHtml = typeof options.escapeHtml === 'function'
    ? options.escapeHtml
    : (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const broadcastLanguagePoolChange = typeof options.broadcastLanguagePoolChange === 'function' ? options.broadcastLanguagePoolChange : noop;
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : noop;
  const syncSiteEditorSingleLabelWidth = typeof options.syncSiteEditorSingleLabelWidth === 'function' ? options.syncSiteEditorSingleLabelWidth : noop;
  const renderPublishTransportSettings = typeof options.renderPublishTransportSettings === 'function' ? options.renderPublishTransportSettings : noop;
  const applyMode = typeof options.applyMode === 'function' ? options.applyMode : noop;
  const safeString = typeof options.safeString === 'function' ? options.safeString : (value) => (value == null ? '' : String(value));

  const requestFrame = (handler) => {
    if (typeof handler !== 'function') return null;
    if (requestAnimationFrameRef) {
      try { return requestAnimationFrameRef(handler); } catch (_) {}
    }
    handler();
    return null;
  };

  const cancelFrame = (id) => {
    if (id == null || !cancelAnimationFrameRef) return;
    try { cancelAnimationFrameRef(id); } catch (_) {}
  };

  const setTimer = (handler, delay = 0) => {
    if (typeof handler !== 'function') return null;
    if (setTimeoutRef) {
      try { return setTimeoutRef(handler, delay); } catch (_) {}
    }
    if ((Number(delay) || 0) <= 0) handler();
    return null;
  };

  const clearTimer = (id) => {
    if (id == null || !clearTimeoutRef) return;
    try { clearTimeoutRef(id); } catch (_) {}
  };

  const getComputedStyleFor = (element) => {
    if (!element) return null;
    try {
      if (getComputedStyleRef) return getComputedStyleRef(element);
    } catch (_) {}
    try {
      return windowRef && typeof windowRef.getComputedStyle === 'function'
        ? windowRef.getComputedStyle(element)
        : null;
    } catch (_) {
      return null;
    }
  };

  function buildSiteUI(root, state) {
    if (!root || !documentRef || typeof documentRef.createElement !== 'function') return;
    try {
      if (typeof root.__pressSiteLanguageMenuCleanup === 'function') root.__pressSiteLanguageMenuCleanup();
    } catch (_) {}
    try { root.__pressSiteLanguageMenuCleanup = null; } catch (_) {}
    try { cleanupComposerSiteSettingsSectionNav(root); } catch (_) {}
    root.innerHTML = '';
    try {
      if (typeof root.__pressSiteSingleLabelWidthCleanup === 'function') root.__pressSiteSingleLabelWidthCleanup();
    } catch (_) {}
    try { root.__pressSiteSingleLabelWidthCleanup = null; } catch (_) {}
    if (!state || typeof state !== 'object') return;
    let site = state.site;
    if (!site || typeof site !== 'object') {
      site = cloneSiteState(prepareSiteState({}));
      state.site = site;
    }
    setStateSlice('site', site);

    const container = documentRef.createElement('div');
    container.className = 'cs-root';
    root.appendChild(container);

    const sectionsMeta = [];
    const languageMenuCleanups = [];
    const cleanupLanguageMenus = () => {
      while (languageMenuCleanups.length) {
        const cleanup = languageMenuCleanups.pop();
        try { cleanup(); } catch (_) {}
      }
    };
    const registerLanguageMenuCleanup = (cleanup) => {
      if (typeof cleanup === 'function') languageMenuCleanups.push(cleanup);
    };
    try { root.__pressSiteLanguageMenuCleanup = cleanupLanguageMenus; } catch (_) {}

    const layout = documentRef.createElement('div');
    layout.className = 'cs-layout';
    container.appendChild(layout);

    const viewport = documentRef.createElement('div');
    viewport.className = 'cs-viewport';
    layout.appendChild(viewport);

    const sectionNav = createComposerSiteSettingsSectionNav({
      root,
      documentRef,
      windowRef,
      performanceRef,
      cssRef,
      sectionsMeta,
      getComputedStyleFor,
      requestFrame,
      cancelFrame,
      setTimer,
      clearTimer,
      composerPrefersReducedMotion,
      resolveComposerScrollDuration,
      animateComposerViewportScroll,
      cancelComposerSiteScrollAnimation
    });
    const {
      getActiveSectionId,
      getPreservedActiveLabel,
      refreshNavDiffState,
      scheduleScrollSync,
      setActiveSection,
      syncFirstSectionId
    } = sectionNav;

    const markDirty = () => {
      setStateSlice('site', site);
      notifyComposerChange('site');
      refreshNavDiffState();
    };

    const ensureLinkList = (key) => {
      if (!Array.isArray(site[key])) site[key] = [];
      return site[key];
    };

    const ensureAnnotate = () => {
      if (!site.annotate || typeof site.annotate !== 'object') {
        site.annotate = { enabled: null, connectBaseUrl: '', discussionCategory: '' };
      }
      if (!Object.prototype.hasOwnProperty.call(site.annotate, 'enabled')) site.annotate.enabled = null;
      if (!Object.prototype.hasOwnProperty.call(site.annotate, 'connectBaseUrl')) site.annotate.connectBaseUrl = '';
      if (!Object.prototype.hasOwnProperty.call(site.annotate, 'discussionCategory')) site.annotate.discussionCategory = '';
      return site.annotate;
    };

    const ensureAssetWarnings = () => {
      if (!site.assetWarnings || typeof site.assetWarnings !== 'object') site.assetWarnings = {};
      if (!site.assetWarnings.largeImage || typeof site.assetWarnings.largeImage !== 'object') {
        site.assetWarnings.largeImage = { enabled: null, thresholdKB: null };
      }
      const largeImage = site.assetWarnings.largeImage;
      if (!Object.prototype.hasOwnProperty.call(largeImage, 'enabled')) largeImage.enabled = null;
      if (!Object.prototype.hasOwnProperty.call(largeImage, 'thresholdKB')) largeImage.thresholdKB = null;
      return site.assetWarnings;
    };

    const {
      createConfigSubsection,
      createField,
      createSection,
      createSingleGridFieldset,
      createSubheadingField,
      createSwitchControl,
      renderSingleTextGrid,
      syncSwitchState
    } = createComposerSiteSettingsControls({
      documentRef,
      viewport,
      sectionsMeta,
      getActiveSectionId,
      getPreservedActiveLabel,
      setActiveSection,
      onDirty: markDirty,
      requestFrame
    });
    const siteSettingsSchema = createComposerSiteSettingsSchema({ t });
    const { createLinkListField } = createComposerSiteSettingsLinkList({
      documentRef,
      createField,
      createSubheadingField,
      ensureLinkList,
      markDirty,
      notifyComposerChange,
      requestFrame,
      t
    });
    const {
      collectLanguageCodes,
      renderIdentityLocalizedGrid,
      renderLocalizedField
    } = createComposerSiteSettingsLocalizedFields({
      documentRef,
      site,
      state,
      createField,
      createSubheadingField,
      markDirty,
      setTimer,
      languagePoolChangedEvent: LANGUAGE_POOL_CHANGED_EVENT,
      preferredLangOrder: PREFERRED_LANG_ORDER,
      langCodePattern: LANG_CODE_PATTERN,
      normalizeLangCode,
      getAvailableLangs,
      displayLangName,
      escapeHtml,
      broadcastLanguagePoolChange,
      registerLanguageMenuCleanup,
      t
    });
    const {
      renderAnnotateGrid,
      renderAssetWarningsGrid,
      renderBehaviorGrid,
      renderPublicChromeGrid,
      renderThemeGrid
    } = createComposerSiteSettingsConfigGrids({
      documentRef,
      site,
      state,
      siteSettingsSchema,
      createSingleGridFieldset,
      createSwitchControl,
      syncSwitchState,
      markDirty,
      ensureAnnotate,
      ensureAssetWarnings,
      collectLanguageCodes,
      normalizeLangCode,
      displayLangName,
      fetchContent,
      applyMode,
      safeString,
      connectPublishPresets: CONNECT_PUBLISH_PRESETS,
      annotateDiscussionCategoryPresets: ANNOTATE_DISCUSSION_CATEGORY_PRESETS,
      t
    });

    const {
      renderIdentityPathGrid,
      renderSeoResourceGrid
    } = createComposerSiteSettingsSingleGrids({
      site,
      siteSettingsSchema,
      renderSingleTextGrid
    });

    createComposerSiteSettingsRepoSection({
      documentRef,
      site,
      siteSettingsSchema,
      createSection,
      markDirty,
      renderPublishTransportSettings,
      t
    });

    const identitySection = createSection(
      siteSettingsSchema.sections.identity.title,
      siteSettingsSchema.sections.identity.description
    );
    renderIdentityLocalizedGrid(identitySection);
    renderIdentityPathGrid(identitySection);

    const seoSection = createSection(
      siteSettingsSchema.sections.seo.title,
      siteSettingsSchema.sections.seo.description
    );
    renderLocalizedField(seoSection, 'siteDescription', {
      label: t('editor.composer.site.fields.siteDescription'),
      description: t('editor.composer.site.fields.siteDescriptionHelp'),
      multiline: true,
      rows: 3,
      ensureDefault: false,
      subheading: true
    });
    renderLocalizedField(seoSection, 'siteKeywords', {
      label: t('editor.composer.site.fields.siteKeywords'),
      description: t('editor.composer.site.fields.siteKeywordsHelp'),
      grid: true,
      ensureDefault: false,
      subheading: true
    });
    createLinkListField(seoSection, 'profileLinks', {
      label: t('editor.composer.site.fields.profileLinks'),
      description: t('editor.composer.site.fields.profileLinksHelp'),
      subheading: true
    });
    renderSeoResourceGrid(seoSection);

    const siteConfigSection = createSection(
      siteSettingsSchema.sections.configuration.title,
      siteSettingsSchema.sections.configuration.description
    );
    const behaviorSubsection = createConfigSubsection(
      siteConfigSection,
      siteSettingsSchema.subsections.behavior.title,
      siteSettingsSchema.subsections.behavior.description
    );
    renderBehaviorGrid(behaviorSubsection);

    const publicChromeSubsection = createConfigSubsection(
      siteConfigSection,
      siteSettingsSchema.subsections.publicChrome.title,
      siteSettingsSchema.subsections.publicChrome.description
    );
    renderPublicChromeGrid(publicChromeSubsection);

    const themeSubsection = createConfigSubsection(
      siteConfigSection,
      siteSettingsSchema.subsections.theme.title,
      siteSettingsSchema.subsections.theme.description
    );
    renderThemeGrid(themeSubsection);

    const commentsSubsection = createConfigSubsection(
      siteConfigSection,
      siteSettingsSchema.subsections.comments.title,
      siteSettingsSchema.subsections.comments.description
    );
    renderAnnotateGrid(commentsSubsection);

    const assetsSubsection = createConfigSubsection(
      siteConfigSection,
      siteSettingsSchema.subsections.assets.title,
      siteSettingsSchema.subsections.assets.description
    );
    renderAssetWarningsGrid(assetsSubsection);

    if (site.__extras && Object.keys(site.__extras).length) {
      const extrasSection = createSection(
        siteSettingsSchema.sections.extras.title,
        siteSettingsSchema.sections.extras.description
      );
      const list = documentRef.createElement('ul');
      list.className = 'cs-extra-list';
      list.dataset.field = '__extras';
      Object.keys(site.__extras).sort().forEach((key) => {
        const item = documentRef.createElement('li');
        item.textContent = key;
        list.appendChild(item);
      });
      extrasSection.appendChild(list);
    }

    syncFirstSectionId();
    syncSiteEditorSingleLabelWidth(root);
    refreshNavDiffState();
    try { scheduleScrollSync(); } catch (_) {}
  }

  return {
    buildSiteUI
  };
}
