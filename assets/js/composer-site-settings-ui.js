import { createComposerSiteSettingsControls } from './composer-site-settings-controls.js';
import { createComposerSiteSettingsConfigGrids } from './composer-site-settings-config-grids.js';
import { createComposerSiteSettingsLinkList } from './composer-site-settings-link-list.js';
import { createComposerSiteSettingsLocalizedFields } from './composer-site-settings-localized-fields.js';
import { createComposerSiteSettingsSchema } from './composer-site-settings-schema.js';
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

    const ensureRepo = () => {
      if (!site.repo || typeof site.repo !== 'object') site.repo = { owner: '', name: '', branch: '' };
      return site.repo;
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

    const renderIdentityPathGrid = (section) => {
      const items = siteSettingsSchema.fields.identityPaths.map((item) => ({
        ...item,
        get: () => site[item.dataKey],
        set: (value) => { site[item.dataKey] = value; }
      }));

      renderSingleTextGrid(section, items);
    };

    const renderSeoResourceGrid = (section) => {
      renderSingleTextGrid(section, siteSettingsSchema.fields.seoResources.map((item) => ({
        ...item,
        get: () => site[item.dataKey],
        set: (value) => { site[item.dataKey] = value; }
      })));
    };

    const repoSection = createSection(
      siteSettingsSchema.sections.repo.title,
      siteSettingsSchema.sections.repo.description
    );
    const repo = ensureRepo();
    const repoInputs = documentRef.createElement('div');
    repoInputs.className = 'cs-repo-grid';
    repoInputs.dataset.field = 'repo';

    const createRepoFieldTitle = (text) => {
      const title = documentRef.createElement('span');
      title.className = 'cs-repo-field-title';
      title.textContent = text;
      return title;
    };

    const createRepoFieldGroup = (className, titleText, field) => {
      const group = documentRef.createElement('label');
      group.className = `cs-repo-field-group ${className}`;
      group.append(createRepoFieldTitle(titleText), field);
      return group;
    };

    const createRepoIconAffix = (pathData) => {
      const affix = documentRef.createElement('span');
      affix.className = 'cs-repo-affix cs-repo-icon-affix';
      affix.setAttribute('aria-hidden', 'true');
      affix.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" focusable="false"><path d="${pathData}"></path></svg>`;
      return affix;
    };

    const ownerInput = documentRef.createElement('input');
    ownerInput.type = 'text';
    ownerInput.className = 'cs-input cs-repo-input cs-repo-input--owner';
    ownerInput.placeholder = t('editor.composer.site.repoOwner');
    ownerInput.setAttribute('aria-label', t('editor.composer.site.repoOwner'));
    ownerInput.spellcheck = false;
    ownerInput.value = repo.owner || '';
    ownerInput.addEventListener('input', () => { repo.owner = ownerInput.value; markDirty(); });

    const nameInput = documentRef.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'cs-input cs-repo-input cs-repo-input--name';
    nameInput.placeholder = t('editor.composer.site.repoName');
    nameInput.setAttribute('aria-label', t('editor.composer.site.repoName'));
    nameInput.spellcheck = false;
    nameInput.value = repo.name || '';
    nameInput.addEventListener('input', () => { repo.name = nameInput.value; markDirty(); });

    const branchInput = documentRef.createElement('input');
    branchInput.type = 'text';
    branchInput.className = 'cs-input cs-repo-input cs-repo-input--branch';
    branchInput.placeholder = t('editor.composer.site.repoBranch');
    branchInput.setAttribute('aria-label', t('editor.composer.site.repoBranch'));
    branchInput.spellcheck = false;
    branchInput.value = repo.branch || '';
    branchInput.addEventListener('input', () => { repo.branch = branchInput.value; markDirty(); });

    const ownerWrap = documentRef.createElement('div');
    ownerWrap.className = 'cs-repo-field cs-repo-field--owner';
    ownerWrap.dataset.field = 'repo';
    ownerWrap.dataset.subfield = 'owner';
    const ownerAffix = documentRef.createElement('span');
    ownerAffix.className = 'cs-repo-affix';
    ownerAffix.textContent = t('editor.composer.site.repoOwnerPrefix');
    ownerAffix.setAttribute('aria-hidden', 'true');
    ownerWrap.append(ownerAffix, ownerInput);

    const repoWrap = documentRef.createElement('div');
    repoWrap.className = 'cs-repo-field cs-repo-field--name';
    repoWrap.dataset.field = 'repo';
    repoWrap.dataset.subfield = 'name';
    const repoAffix = createRepoIconAffix('M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z');
    repoWrap.append(repoAffix, nameInput);

    const pathRow = documentRef.createElement('div');
    pathRow.className = 'cs-repo-path';
    const divider = documentRef.createElement('span');
    divider.className = 'cs-repo-divider';
    divider.textContent = '/';
    divider.setAttribute('aria-hidden', 'true');
    pathRow.append(
      createRepoFieldGroup('cs-repo-field-group--owner', t('editor.composer.site.repoOwner'), ownerWrap),
      divider,
      createRepoFieldGroup('cs-repo-field-group--name', t('editor.composer.site.repoName'), repoWrap)
    );

    const branchWrap = documentRef.createElement('div');
    branchWrap.className = 'cs-repo-field cs-repo-field--branch';
    branchWrap.dataset.field = 'repo';
    branchWrap.dataset.subfield = 'branch';
    const branchAffix = createRepoIconAffix('M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z');
    branchWrap.append(branchAffix, branchInput);

    repoInputs.append(
      pathRow,
      createRepoFieldGroup('cs-repo-field-group--branch', t('editor.composer.site.repoBranch'), branchWrap)
    );
    repoSection.appendChild(repoInputs);
    renderPublishTransportSettings(repoSection);

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
