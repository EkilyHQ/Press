import { createComposerSiteSettingsControls } from './composer-site-settings-controls.js';
import { createComposerSiteSettingsConfigGrids } from './composer-site-settings-config-grids.js';
import { createComposerSiteSettingsLanguageMenu } from './composer-site-settings-language-menu.js';
import { createComposerSiteSettingsLinkList } from './composer-site-settings-link-list.js';
import { createComposerSiteSettingsSchema } from './composer-site-settings-schema.js';

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
  const isLanguageCode = typeof options.isLanguageCode === 'function' ? options.isLanguageCode : (value) => LANG_CODE_PATTERN.test(String(value || '').trim());
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
    root.innerHTML = '';
    try {
      if (typeof root.__pressSiteCompactNavCleanup === 'function') root.__pressSiteCompactNavCleanup();
    } catch (_) {}
    try { root.__pressSiteCompactNavCleanup = null; } catch (_) {}
    try {
      if (typeof root.__pressSiteNavOrientationCleanup === 'function') root.__pressSiteNavOrientationCleanup();
    } catch (_) {}
    try { root.__pressSiteNavOrientationCleanup = null; } catch (_) {}
    try {
      if (typeof root.__pressSiteScrollSyncCleanup === 'function') root.__pressSiteScrollSyncCleanup();
    } catch (_) {}
    try { root.__pressSiteScrollSyncCleanup = null; } catch (_) {}
    try {
      if (typeof root.__pressSiteSingleLabelWidthCleanup === 'function') root.__pressSiteSingleLabelWidthCleanup();
    } catch (_) {}
    try { root.__pressSiteSingleLabelWidthCleanup = null; } catch (_) {}
    try {
      if (typeof root.__pressSiteNavFocusHandler === 'function') root.removeEventListener('focusin', root.__pressSiteNavFocusHandler);
    } catch (_) {}
    try { root.__pressSiteNavFocusHandler = null; } catch (_) {}
    try { root.__pressSiteNavRefresh = null; } catch (_) {}
    try { root.__pressSiteNavSetActive = null; } catch (_) {}
    try { root.__pressSiteFirstSectionId = null; } catch (_) {}
    try { root.__pressSiteRevealField = null; } catch (_) {}
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
    let activeSectionId = '';
    const rootHadVisibleLayout = (() => {
      try { return !!(root.getClientRects && root.getClientRects().length); }
      catch (_) { return false; }
    })();
    const preservedActiveLabel = (() => {
      if (!rootHadVisibleLayout) return '';
      try { return String(root.__pressSiteActiveSection || '').trim(); }
      catch (_) { return ''; }
    })();

    const getNow = () => {
      if (performanceRef && typeof performanceRef.now === 'function') {
        try { return performanceRef.now(); } catch (_) {}
      }
      try { return Date.now(); } catch (_) { return 0; }
    };

    let scrollSyncHandle = null;
    let scrollSyncHandleType = '';
    let scrollSyncLockUntil = 0;

    const escapeFieldKey = (value) => {
      const raw = value == null ? '' : String(value);
      try {
        if (cssRef && typeof cssRef.escape === 'function') return cssRef.escape(raw);
      } catch (_) {}
      return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    };

    const layout = documentRef.createElement('div');
    layout.className = 'cs-layout';
    container.appendChild(layout);

    const viewport = documentRef.createElement('div');
    viewport.className = 'cs-viewport';
    layout.appendChild(viewport);

    const resolveViewportAnchorTop = () => {
      if (!windowRef || !documentRef) return 0;
      let toolbarOffset = 0;
      try {
        const docStyles = getComputedStyleFor(documentRef.documentElement);
        const parsedToolbar = parseFloat(docStyles && docStyles.getPropertyValue('--editor-toolbar-offset'));
        if (Number.isFinite(parsedToolbar)) toolbarOffset = Math.max(parsedToolbar, 0);
      } catch (_) {}

      let desiredTop = Math.max(toolbarOffset + 12, 12);
      try {
        const scrollContainer = resolveSiteScrollContainer();
        if (scrollContainer && scrollContainer !== windowRef && typeof scrollContainer.getBoundingClientRect === 'function') {
          const containerRect = scrollContainer.getBoundingClientRect();
          if (containerRect && Number.isFinite(containerRect.top)) {
            desiredTop = Math.max(containerRect.top + 12, 12);
          }
        }
      } catch (_) {}
      return desiredTop;
    };

    const resolveSiteScrollContainer = () => {
      if (!windowRef || !documentRef) return null;
      try {
        const viewport = root ? root.querySelector('.cs-viewport') : null;
        if (viewport) {
          const styles = getComputedStyleFor(viewport);
          const overflowY = styles ? String(styles.overflowY || '') : '';
          const canOwnScroll = /(auto|scroll|overlay)/.test(overflowY)
            && (!viewport.getClientRects || viewport.getClientRects().length > 0);
          if (canOwnScroll) return viewport;
        }
      } catch (_) {}
      try {
        const modalBody = root && typeof root.closest === 'function' ? root.closest('.editor-modal-body') : null;
        if (modalBody) return modalBody;
      } catch (_) {}
      let node = root && root.parentElement ? root.parentElement : null;
      while (node && node !== documentRef.body && node !== documentRef.documentElement) {
        try {
          const styles = getComputedStyleFor(node);
          const overflowY = styles ? String(styles.overflowY || '') : '';
          const canScroll = /(auto|scroll|overlay)/.test(overflowY)
            && (node.scrollHeight || 0) > (node.clientHeight || 0) + 1;
          if (canScroll) return node;
        } catch (_) {}
        node = node.parentElement;
      }
      return windowRef;
    };

    const getSiteScrollTop = (scrollContainer) => {
      if (!scrollContainer || scrollContainer === windowRef) {
        return windowRef.pageYOffset || documentRef.documentElement.scrollTop || 0;
      }
      return scrollContainer.scrollTop || 0;
    };

    const getSiteViewportHeight = (scrollContainer) => {
      if (!scrollContainer || scrollContainer === windowRef) {
        return windowRef.innerHeight || documentRef.documentElement.clientHeight || 0;
      }
      return scrollContainer.clientHeight || windowRef.innerHeight || documentRef.documentElement.clientHeight || 0;
    };

    const scrollSiteContainerTo = (scrollContainer, targetY, behavior) => {
      if (!scrollContainer || scrollContainer === windowRef) {
        if (typeof windowRef.scrollTo === 'function') {
          try {
            windowRef.scrollTo({ top: targetY, behavior });
          } catch (_) {
            windowRef.scrollTo(0, targetY);
          }
        }
        return;
      }
      if (typeof scrollContainer.scrollTo === 'function') {
        try {
          scrollContainer.scrollTo({ top: targetY, behavior });
        } catch (_) {
          scrollContainer.scrollTo(0, targetY);
        }
      } else {
        scrollContainer.scrollTop = targetY;
      }
    };

    function setActiveSection(sectionId, options = {}) {
      if (!sectionId || !sectionsMeta.length) return;
      let resolved = false;
      let focusTarget = null;
      let activeMeta = null;
      const shouldScroll = options && options.scrollViewport !== false;
      const skipScrollLock = !!(options && options.skipScrollLock);
      sectionsMeta.forEach((meta) => {
        if (!meta || !meta.section) return;
        const isActive = meta.id === sectionId;
        if (isActive) {
          activeSectionId = sectionId;
          resolved = true;
          activeMeta = meta;
          try { meta.section.removeAttribute('hidden'); } catch (_) {}
          meta.section.classList.add('is-active');
          meta.section.setAttribute('aria-hidden', 'false');
          try { root.__pressSiteActiveSection = meta.label || ''; } catch (_) {}
          if (options.focusPanel) {
            const focusable = meta.section.querySelector('[data-autofocus], input:not([type="hidden"]), select, textarea, button:not([type="hidden"]), [tabindex]:not([tabindex="-1"])');
            if (focusable && typeof focusable.focus === 'function') focusTarget = focusable;
          }
        } else {
          try { meta.section.removeAttribute('hidden'); } catch (_) {}
          meta.section.classList.remove('is-active');
          try { meta.section.removeAttribute('aria-hidden'); } catch (_) {}
        }
      });
      if (!resolved) return;
      let focusCommitted = false;
      const commitFocus = (delay = 0) => {
        if (!focusTarget || focusCommitted) return;
        focusCommitted = true;
        const target = focusTarget;
        const schedule = () => {
          if (!target || typeof target.focus !== 'function') return;
          if (activeSectionId !== sectionId) return;
          const applyFocus = () => {
            try {
              target.focus({ preventScroll: true });
            } catch (_) {
              try { target.focus(); } catch (_) {}
            }
          };
          try {
            requestFrame(applyFocus);
          } catch (_) {
            applyFocus();
          }
        };
        const ms = Math.max(0, Number(delay) || 0);
        if (ms > 0) {
          setTimer(schedule, ms);
        } else {
          schedule();
        }
        focusTarget = null;
      };

      if (shouldScroll && activeMeta && windowRef) {
        const executeScroll = () => {
          try {
            const scrollContainer = resolveSiteScrollContainer();
            const sectionRect = activeMeta.section.getBoundingClientRect();
            const desiredTop = resolveViewportAnchorTop();
            const delta = sectionRect.top - desiredTop;
            if (Math.abs(delta) > 4) {
              const behavior = options.scrollBehavior || 'smooth';
              const prefersReduced = composerPrefersReducedMotion();
              const targetY = getSiteScrollTop(scrollContainer) + delta;
              const resolvedDuration = resolveComposerScrollDuration(options.scrollDuration);
              if (!skipScrollLock) {
                const now = getNow();
                const lockDuration = behavior === 'smooth' ? resolvedDuration + 160 : 140;
                scrollSyncLockUntil = now + Math.max(lockDuration, 140);
              }

              if (scrollContainer === windowRef && !prefersReduced && behavior !== 'auto' && behavior !== 'instant') {
                const animated = animateComposerViewportScroll(targetY, resolvedDuration, () => commitFocus(48));
                if (animated) return;
              }

              cancelComposerSiteScrollAnimation();
              scrollSiteContainerTo(scrollContainer, targetY, behavior);

              if (!prefersReduced && behavior === 'smooth') commitFocus(resolvedDuration + 64);
              else commitFocus(0);
              return;
            }

            commitFocus(0);
          } catch (_) {
            commitFocus(0);
          }
        };

        try {
          requestFrame(executeScroll);
        } catch (_) {
          executeScroll();
        }
      } else {
        commitFocus(0);
      }
    }

    function refreshNavDiffState() {
      // Section navigation was removed; diff state is surfaced in the system tree instead.
    }

    function cancelScheduledScrollSync() {
      if (scrollSyncHandle == null) return;
      if (scrollSyncHandleType === 'raf') cancelFrame(scrollSyncHandle);
      else if (scrollSyncHandleType === 'timeout') clearTimer(scrollSyncHandle);
      scrollSyncHandle = null;
      scrollSyncHandleType = '';
    }

    function runScrollSync() {
      scrollSyncHandle = null;
      scrollSyncHandleType = '';
      if (!windowRef) return;
      const now = getNow();
      if (now < scrollSyncLockUntil) {
        const delay = Math.max(24, Math.min(240, scrollSyncLockUntil - now + 16));
        scrollSyncHandleType = 'timeout';
        scrollSyncHandle = setTimer(() => {
          scrollSyncHandle = null;
          scrollSyncHandleType = '';
          runScrollSync();
        }, delay);
      } else {
        if (!sectionsMeta.length) return;
        const scrollContainer = resolveSiteScrollContainer();
        const anchorTop = resolveViewportAnchorTop();
        const scrollTop = getSiteScrollTop(scrollContainer);
        const viewportHeight = getSiteViewportHeight(scrollContainer);
        const tolerance = Math.max(48, Math.min(viewportHeight * 0.25 || 0, 180));
        let candidate = null;
        let measuredAnySection = false;

        for (let i = 0; i < sectionsMeta.length; i += 1) {
          const meta = sectionsMeta[i];
          if (!meta || !meta.section) continue;
          const rect = meta.section.getBoundingClientRect();
          if (!rect || rect.height <= 4) continue;
          measuredAnySection = true;
          if (rect.top <= anchorTop + tolerance) {
            candidate = meta;
            continue;
          }
          if (!candidate) candidate = meta;
          break;
        }

        if (!measuredAnySection) return;
        if (scrollTop <= 4) candidate = sectionsMeta[0] || null;
        if (!candidate) candidate = sectionsMeta[0] || null;
        if (!candidate || candidate.id === activeSectionId) return;
        setActiveSection(candidate.id, { focusPanel: false, scrollViewport: false, skipScrollLock: true });
      }
    }

    function scheduleScrollSync() {
      if (!windowRef) return;
      if (scrollSyncHandle != null) return;
      const runner = () => {
        scrollSyncHandle = null;
        scrollSyncHandleType = '';
        runScrollSync();
      };
      try {
        scrollSyncHandleType = 'raf';
        scrollSyncHandle = requestFrame(() => runner());
      } catch (_) {
        scrollSyncHandleType = 'timeout';
        scrollSyncHandle = setTimer(runner, 66);
      }
    }

    const revealField = (fieldKey, options = {}) => {
      if (!fieldKey) return null;
      const selector = `[data-field="${escapeFieldKey(fieldKey)}"]`;
      let fieldEl = null;
      try { fieldEl = root.querySelector(selector); }
      catch (_) { fieldEl = null; }
      if (!fieldEl) {
        try {
          fieldEl = Array.from(root.querySelectorAll('[data-field]')).find((candidate) => {
            const raw = candidate && candidate.getAttribute ? candidate.getAttribute('data-field') : '';
            return String(raw || '').split('|').map(item => item.trim()).includes(String(fieldKey));
          }) || null;
        } catch (_) {
          fieldEl = null;
        }
      }
      if (!fieldEl) return null;
      const section = typeof fieldEl.closest === 'function' ? fieldEl.closest('.cs-section') : null;
      if (!section) return fieldEl;
      const meta = sectionsMeta.find((item) => item.section === section);
      if (meta) {
        setActiveSection(meta.id, { focusPanel: false, scrollViewport: false });
        if (options.scroll !== false) {
          try {
            const behavior = options.behavior || 'smooth';
            requestFrame(() => {
              try { fieldEl.scrollIntoView({ block: 'start', behavior }); }
              catch (_) { fieldEl.scrollIntoView(); }
            });
          } catch (_) {
            try { fieldEl.scrollIntoView(); } catch (_) {}
          }
        }
        if (options.focus !== false) {
          let focusTarget = null;
          try {
            focusTarget = fieldEl.querySelector(`[data-site-identity-field="${escapeFieldKey(fieldKey)}"]`);
          } catch (_) {
            focusTarget = null;
          }
          if (!focusTarget) {
            focusTarget = fieldEl.querySelector('[data-autofocus], input:not([type="hidden"]), select, textarea, button:not([type="hidden"]), [tabindex]:not([tabindex="-1"])') || fieldEl;
          }
          try {
            requestFrame(() => {
              if (typeof focusTarget.focus === 'function') {
                try { focusTarget.focus({ preventScroll: options.scroll !== false }); }
                catch (_) { focusTarget.focus(); }
              }
            });
          } catch (_) {
            try { focusTarget.focus(); } catch (_) {}
          }
        }
      }
      return fieldEl;
    };

    const focusHandler = (event) => {
      const target = event && event.target;
      if (!target || typeof target.closest !== 'function') return;
      const section = target.closest('.cs-section');
      if (!section) return;
      const meta = sectionsMeta.find((item) => item.section === section);
      if (meta && meta.id !== activeSectionId) {
        setActiveSection(meta.id, { focusPanel: false, scrollViewport: false, skipScrollLock: true });
      }
    };

    try { root.addEventListener('focusin', focusHandler); } catch (_) {}
    try { root.__pressSiteNavFocusHandler = focusHandler; } catch (_) {}
    try { root.__pressSiteRevealField = revealField; } catch (_) {}

    if (windowRef && typeof windowRef.addEventListener === 'function') {
      const onScroll = () => scheduleScrollSync();
      const onResize = () => scheduleScrollSync();
      const scrollContainer = resolveSiteScrollContainer();
      let passiveScrollListener = false;
      try {
        windowRef.addEventListener('scroll', onScroll, { passive: true });
        passiveScrollListener = true;
      } catch (_) {
        try { windowRef.addEventListener('scroll', onScroll); } catch (_) {}
      }
      let passiveContainerScrollListener = false;
      if (scrollContainer && scrollContainer !== windowRef && typeof scrollContainer.addEventListener === 'function') {
        try {
          scrollContainer.addEventListener('scroll', onScroll, { passive: true });
          passiveContainerScrollListener = true;
        } catch (_) {
          try { scrollContainer.addEventListener('scroll', onScroll); } catch (_) {}
        }
      }
      try { windowRef.addEventListener('resize', onResize); } catch (_) {}
      const cleanup = () => {
        try {
          if (passiveScrollListener) windowRef.removeEventListener('scroll', onScroll, { passive: true });
        } catch (_) {}
        try { windowRef.removeEventListener('scroll', onScroll); } catch (_) {}
        try {
          if (scrollContainer && scrollContainer !== windowRef && typeof scrollContainer.removeEventListener === 'function') {
            if (passiveContainerScrollListener) scrollContainer.removeEventListener('scroll', onScroll, { passive: true });
            else scrollContainer.removeEventListener('scroll', onScroll);
          }
        } catch (_) {}
        try { windowRef.removeEventListener('resize', onResize); } catch (_) {}
        cancelScheduledScrollSync();
      };
      try { root.__pressSiteScrollSyncCleanup = cleanup; }
      catch (_) { cleanup(); }
    }

    try { root.__pressSiteNavRefresh = refreshNavDiffState; } catch (_) {}
    try { root.__pressSiteNavSetActive = setActiveSection; } catch (_) {}
    try { root.__pressSiteFirstSectionId = sectionsMeta[0] && sectionsMeta[0].id ? sectionsMeta[0].id : ''; } catch (_) {}

    const markDirty = () => {
      setStateSlice('site', site);
      notifyComposerChange('site');
      refreshNavDiffState();
    };

    const ensureLocalized = (key, ensureDefault = true) => {
      if (!site[key] || typeof site[key] !== 'object') {
        site[key] = ensureDefault ? { default: '' } : {};
      }
      if (ensureDefault && !Object.prototype.hasOwnProperty.call(site[key], 'default')) site[key].default = '';
      return site[key];
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

    const collectLanguageCodes = () => {
      const codes = new Set();
      const add = (value) => {
        const normalized = normalizeLangCode(value);
        if (!normalized) return;
        codes.add(normalized);
      };
      const addFromEntry = (entry) => {
        if (!entry || typeof entry !== 'object') return;
        Object.keys(entry).forEach((key) => {
          if (!isLanguageCode(key)) return;
          add(key);
        });
      };

      try {
        const langs = typeof getAvailableLangs === 'function' ? getAvailableLangs() : [];
        if (Array.isArray(langs)) langs.forEach(add);
      } catch (_) {}
      if (site && site.defaultLanguage) add(site.defaultLanguage);

      if (state && state.index && typeof state.index === 'object') {
        Object.keys(state.index).forEach((key) => {
          if (key === '__order') return;
          addFromEntry(state.index[key]);
        });
      }

      if (state && state.tabs && typeof state.tabs === 'object') {
        Object.keys(state.tabs).forEach((key) => {
          if (key === '__order') return;
          addFromEntry(state.tabs[key]);
        });
      }

      if (site && typeof site === 'object') {
        Object.keys(site).forEach((key) => {
          const value = site[key];
          if (!value || typeof value !== 'object' || Array.isArray(value)) return;
          addFromEntry(value);
        });
      }

      const ordered = Array.from(codes);
      ordered.sort((a, b) => {
        const ia = PREFERRED_LANG_ORDER.indexOf(a);
        const ib = PREFERRED_LANG_ORDER.indexOf(b);
        if (ia !== -1 || ib !== -1) {
          const pa = ia === -1 ? PREFERRED_LANG_ORDER.length + 1 : ia;
          const pb = ib === -1 ? PREFERRED_LANG_ORDER.length + 1 : ib;
          return pa - pb;
        }
        return a.localeCompare(b);
      });
      return ordered;
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
      getActiveSectionId: () => activeSectionId,
      getPreservedActiveLabel: () => preservedActiveLabel,
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
    const createLanguageMenu = (config = {}) => {
      const languageMenu = createComposerSiteSettingsLanguageMenu({
        documentRef,
        setTimer,
        languagePoolChangedEvent: LANGUAGE_POOL_CHANGED_EVENT,
        preferredLangOrder: PREFERRED_LANG_ORDER,
        langCodePattern: LANG_CODE_PATTERN,
        normalizeLangCode,
        getAvailableLangs,
        collectLanguageCodes,
        displayLangName,
        escapeHtml,
        t,
        ...config
      });
      registerLanguageMenuCleanup(languageMenu.cleanup);
      return languageMenu;
    };

    const renderLocalizedField = (section, key, options = {}) => {
      ensureLocalized(key, options.ensureDefault !== false);
      const useLocalizedGrid = !!(options.grid || options.multiline);
      const field = options.subheading
        ? createSubheadingField(section, {
          dataKey: key,
          label: options.label,
          description: options.description
        })
        : createField(section, {
          dataKey: key,
          label: options.label,
          description: options.description
        });
      const list = documentRef.createElement('div');
      list.className = useLocalizedGrid
        ? 'cs-localized-list cs-localized-list--grid'
        : 'cs-localized-list';
      field.appendChild(list);
      const controls = documentRef.createElement('div');
      controls.className = 'cs-field-controls';
      field.appendChild(controls);
      const languageMenu = createLanguageMenu({
        getUsedLangs: () => Object.keys(ensureLocalized(key, options.ensureDefault !== false) || {}),
        onSelectLanguage: (code) => {
          const localized = ensureLocalized(key, options.ensureDefault !== false);
          if (Object.prototype.hasOwnProperty.call(localized, code)) return false;
          localized[code] = '';
          markDirty();
          renderRows();
          broadcastLanguagePoolChange();
          return true;
        }
      });
      controls.appendChild(languageMenu.addWrap);

      const renderRows = () => {
        list.innerHTML = '';
        const localized = ensureLocalized(key, options.ensureDefault !== false);
        const langs = Object.keys(localized || {});
        if (options.ensureDefault !== false && !langs.includes('default')) langs.push('default');
        langs.sort((a, b) => {
          if (a === 'default') return -1;
          if (b === 'default') return 1;
          return a.localeCompare(b);
        });
        langs.forEach((lang) => {
          if (!localized && lang !== 'default') return;
          if (options.ensureDefault !== false && !Object.prototype.hasOwnProperty.call(localized, lang)) localized[lang] = '';
          const row = documentRef.createElement('div');
          row.className = 'cs-localized-row';
          if (useLocalizedGrid) row.classList.add('cs-localized-row--grid');
          if (options.multiline) row.classList.add('cs-localized-row--multiline');
          row.dataset.lang = lang;
          const badge = documentRef.createElement('span');
          badge.className = 'cs-lang-chip';
          badge.textContent = lang === 'default'
            ? t('editor.composer.site.languageDefault')
            : lang.toUpperCase();
          row.appendChild(badge);
          const inputWrap = documentRef.createElement('div');
          inputWrap.className = options.multiline
            ? 'cs-localized-input cs-localized-input--multiline'
            : 'cs-localized-input';
          const input = documentRef.createElement(options.multiline ? 'textarea' : 'input');
          if (!options.multiline) input.type = 'text';
          else input.rows = options.rows || 3;
          input.className = options.multiline ? 'cs-input cs-localized-textarea' : 'cs-input';
          input.dataset.field = key;
          input.dataset.lang = lang;
          if (options.placeholder) input.placeholder = options.placeholder;
          input.value = localized[lang] || '';
          if (options.multiline) {
            const expandMultiline = () => {
              list.querySelectorAll('.cs-localized-row--multiline.is-expanded').forEach((expandedRow) => {
                if (expandedRow !== row) expandedRow.classList.remove('is-expanded');
              });
              row.classList.add('is-expanded');
            };
            input.addEventListener('pointerdown', expandMultiline);
            input.addEventListener('focus', expandMultiline);
            input.addEventListener('focusin', expandMultiline);
            input.addEventListener('blur', () => {
              setTimer(() => {
                if (documentRef.activeElement !== input) row.classList.remove('is-expanded');
              }, 0);
            });
            input.addEventListener('keydown', (event) => {
              if (event.key !== 'Escape') return;
              event.preventDefault();
              row.classList.remove('is-expanded');
              input.blur();
            });
          }
          input.addEventListener('input', () => {
            ensureLocalized(key, options.ensureDefault !== false)[lang] = input.value;
            markDirty();
          });
          inputWrap.appendChild(input);
          row.appendChild(inputWrap);
          if (lang !== 'default' || options.allowDefaultDelete) {
            const removeBtn = documentRef.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-tertiary cs-remove-lang';
            removeBtn.textContent = t('editor.composer.site.removeLanguage');
            removeBtn.addEventListener('click', () => {
              const localizedMap = ensureLocalized(key, options.ensureDefault !== false);
              delete localizedMap[lang];
              markDirty();
              renderRows();
              broadcastLanguagePoolChange();
            });
            row.appendChild(removeBtn);
          }
          list.appendChild(row);
        });
        if (!list.children.length) {
          const empty = documentRef.createElement('div');
          empty.className = 'cs-empty';
          empty.textContent = t('editor.composer.site.noLanguages');
          list.appendChild(empty);
        }
        languageMenu.refreshMenu();
      };

      renderRows();
    };

    const renderIdentityLocalizedGrid = (section) => {
      const titleLabel = t('editor.composer.site.fields.siteTitle');
      const subtitleLabel = t('editor.composer.site.fields.siteSubtitle');
      ensureLocalized('siteTitle', true);
      ensureLocalized('siteSubtitle', true);
      const field = documentRef.createElement('div');
      field.className = 'cs-field cs-identity-fieldset';
      field.dataset.field = 'siteTitle|siteSubtitle';
      field.setAttribute('role', 'group');
      field.setAttribute('aria-label', `${titleLabel} / ${subtitleLabel}`);
      section.appendChild(field);
      const grid = documentRef.createElement('div');
      grid.className = 'cs-identity-grid';
      field.appendChild(grid);
      const controls = documentRef.createElement('div');
      controls.className = 'cs-field-controls';
      field.appendChild(controls);

      const sortLangs = (langs) => {
        const ordered = Array.from(new Set(langs.filter(Boolean)));
        ordered.sort((a, b) => {
          if (a === 'default') return -1;
          if (b === 'default') return 1;
          const ia = PREFERRED_LANG_ORDER.indexOf(a);
          const ib = PREFERRED_LANG_ORDER.indexOf(b);
          if (ia !== -1 || ib !== -1) {
            const pa = ia === -1 ? PREFERRED_LANG_ORDER.length + 1 : ia;
            const pb = ib === -1 ? PREFERRED_LANG_ORDER.length + 1 : ib;
            return pa - pb;
          }
          return a.localeCompare(b);
        });
        return ordered;
      };

      const collectUsedLangs = () => {
        const title = ensureLocalized('siteTitle', true);
        const subtitle = ensureLocalized('siteSubtitle', true);
        return sortLangs(['default', ...Object.keys(title || {}), ...Object.keys(subtitle || {})]);
      };

      const languageMenu = createLanguageMenu({
        getUsedLangs: collectUsedLangs,
        onSelectLanguage: (code) => {
          const title = ensureLocalized('siteTitle', true);
          const subtitle = ensureLocalized('siteSubtitle', true);
          let changed = false;
          if (!Object.prototype.hasOwnProperty.call(title, code)) {
            title[code] = '';
            changed = true;
          }
          if (!Object.prototype.hasOwnProperty.call(subtitle, code)) {
            subtitle[code] = '';
            changed = true;
          }
          if (!changed) return false;
          markDirty();
          renderRows();
          broadcastLanguagePoolChange();
          return true;
        }
      });
      controls.appendChild(languageMenu.addWrap);

      const appendHeader = () => {
        const header = documentRef.createElement('div');
        header.className = 'cs-identity-row cs-identity-head';
        const langSpacer = documentRef.createElement('span');
        langSpacer.className = 'cs-identity-head-spacer';
        langSpacer.setAttribute('aria-hidden', 'true');
        const titleHead = documentRef.createElement('span');
        titleHead.className = 'cs-identity-column-title';
        titleHead.textContent = titleLabel;
        const subtitleHead = documentRef.createElement('span');
        subtitleHead.className = 'cs-identity-column-title';
        subtitleHead.textContent = subtitleLabel;
        const actionSpacer = documentRef.createElement('span');
        actionSpacer.className = 'cs-identity-head-spacer';
        actionSpacer.setAttribute('aria-hidden', 'true');
        header.append(langSpacer, titleHead, subtitleHead, actionSpacer);
        grid.appendChild(header);
      };

      const appendInput = (row, lang, key, labelText, value) => {
        const cell = documentRef.createElement('label');
        cell.className = 'cs-identity-field';
        const mobileLabel = documentRef.createElement('span');
        mobileLabel.className = 'cs-identity-cell-label';
        mobileLabel.textContent = labelText;
        const input = documentRef.createElement('input');
        input.type = 'text';
        input.className = 'cs-input';
        input.dataset.field = key;
        input.dataset.lang = lang;
        input.dataset.subfield = key;
        input.dataset.siteIdentityField = key;
        input.value = value || '';
        input.addEventListener('input', () => {
          ensureLocalized(key, true)[lang] = input.value;
          markDirty();
        });
        cell.append(mobileLabel, input);
        row.appendChild(cell);
      };

      const renderRows = () => {
        grid.innerHTML = '';
        appendHeader();
        const title = ensureLocalized('siteTitle', true);
        const subtitle = ensureLocalized('siteSubtitle', true);
        const langs = collectUsedLangs();
        langs.forEach((lang) => {
          if (!Object.prototype.hasOwnProperty.call(title, lang)) title[lang] = '';
          if (!Object.prototype.hasOwnProperty.call(subtitle, lang)) subtitle[lang] = '';
          const row = documentRef.createElement('div');
          row.className = 'cs-identity-row';
          row.dataset.lang = lang;
          const langCell = documentRef.createElement('div');
          langCell.className = 'cs-identity-lang';
          const badge = documentRef.createElement('span');
          badge.className = 'cs-lang-chip';
          badge.textContent = lang === 'default'
            ? t('editor.composer.site.languageDefault')
            : lang.toUpperCase();
          langCell.appendChild(badge);
          row.appendChild(langCell);
          appendInput(row, lang, 'siteTitle', titleLabel, title[lang] || '');
          appendInput(row, lang, 'siteSubtitle', subtitleLabel, subtitle[lang] || '');
          const actions = documentRef.createElement('div');
          actions.className = 'cs-identity-actions';
          if (lang !== 'default') {
            const removeBtn = documentRef.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn-tertiary cs-remove-lang cs-identity-remove';
            removeBtn.textContent = t('editor.composer.site.removeLanguage');
            removeBtn.addEventListener('click', () => {
              const titleMapNext = ensureLocalized('siteTitle', true);
              const subtitleMapNext = ensureLocalized('siteSubtitle', true);
              delete titleMapNext[lang];
              delete subtitleMapNext[lang];
              markDirty();
              renderRows();
              broadcastLanguagePoolChange();
            });
            actions.appendChild(removeBtn);
          }
          row.appendChild(actions);
          grid.appendChild(row);
        });
        languageMenu.refreshMenu();
      };

      renderRows();
    };

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

    syncSiteEditorSingleLabelWidth(root);
    refreshNavDiffState();
    try { scheduleScrollSync(); } catch (_) {}
  }

  return {
    buildSiteUI
  };
}
