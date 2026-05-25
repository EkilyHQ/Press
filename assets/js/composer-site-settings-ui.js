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

    const createSection = (title, description) => {
      const section = documentRef.createElement('section');
      section.className = 'cs-section';
      section.setAttribute('role', 'tabpanel');
      section.setAttribute('aria-hidden', 'false');
      const sectionId = `cs-section-${sectionsMeta.length + 1}`;
      section.id = sectionId;
      if (title || description) {
        const head = documentRef.createElement('div');
        head.className = 'cs-section-head';
        let heading = null;
        if (title) {
          heading = documentRef.createElement('h3');
          heading.className = 'cs-section-title';
          heading.textContent = title;
          head.appendChild(heading);
        }
        if (description) {
          const desc = documentRef.createElement('p');
          desc.className = 'cs-section-description';
          desc.textContent = description;
          head.appendChild(desc);
        }
        section.appendChild(head);
      }
      viewport.appendChild(section);

      const labelText = (() => {
        if (title && String(title).trim()) return String(title).trim();
        const fromHeading = section.querySelector('.cs-section-title');
        return fromHeading && fromHeading.textContent ? fromHeading.textContent.trim() : `Section ${sectionsMeta.length + 1}`;
      })();

      const meta = { id: sectionId, section, label: labelText };
      sectionsMeta.push(meta);

      const shouldRestore = preservedActiveLabel && labelText === preservedActiveLabel;
      if (!activeSectionId || shouldRestore) {
        setActiveSection(sectionId, { scrollViewport: false });
      }

      return section;
    };

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

    const createField = (section, config) => {
      const field = documentRef.createElement('div');
      field.className = 'cs-field';
      if (config.dataKey) field.dataset.field = config.dataKey;
      const head = documentRef.createElement('div');
      head.className = 'cs-field-head';
      const labelWrap = documentRef.createElement('div');
      labelWrap.className = 'cs-field-label-wrap';
      head.appendChild(labelWrap);
      const labelEl = documentRef.createElement('label');
      labelEl.className = 'cs-field-label';
      labelEl.textContent = config.label || '';
      labelWrap.appendChild(labelEl);
      if (config.action) {
        config.action.classList.add('cs-field-action');
        head.appendChild(config.action);
      }
      field.appendChild(head);
      field.__csHead = head;
      field.__csLabel = labelEl;
      field.__csLabelWrap = labelWrap;
      const inlineDescription = config.inlineDescription !== false;
      if (config.description) {
        const desc = documentRef.createElement('p');
        desc.className = 'cs-field-help';
        desc.textContent = config.description;
        field.__csHelp = desc;
        if (inlineDescription && labelWrap) {
          field.classList.add('cs-field-inline-help');
          labelWrap.appendChild(desc);
        } else {
          field.appendChild(desc);
        }
      }
      section.appendChild(field);
      return field;
    };

    const createSubheadingField = (section, config) => {
      const field = documentRef.createElement('div');
      field.className = 'cs-field cs-subheading-field';
      if (config.dataKey) field.dataset.field = config.dataKey;
      if (config.label || config.description) {
        const head = documentRef.createElement('div');
        head.className = 'cs-config-subsection-head';
        if (config.label) {
          const title = documentRef.createElement('div');
          title.className = 'cs-config-subsection-title';
          title.textContent = config.label;
          head.appendChild(title);
        }
        if (config.description) {
          const description = documentRef.createElement('p');
          description.className = 'cs-config-subsection-description';
          description.textContent = config.description;
          head.appendChild(description);
        }
        field.appendChild(head);
      }
      section.appendChild(field);
      return field;
    };

    const createConfigSubsection = (section, title, description) => {
      const block = documentRef.createElement('div');
      block.className = 'cs-config-subsection';
      if (title || description) {
        const head = documentRef.createElement('div');
        head.className = 'cs-config-subsection-head';
        if (title) {
          const heading = documentRef.createElement('div');
          heading.className = 'cs-config-subsection-title';
          heading.textContent = title;
          head.appendChild(heading);
        }
        if (description) {
          const desc = documentRef.createElement('p');
          desc.className = 'cs-config-subsection-description';
          desc.textContent = description;
          head.appendChild(desc);
        }
        block.appendChild(head);
      }
      section.appendChild(block);
      return block;
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
      const addWrap = documentRef.createElement('div');
      addWrap.className = 'cs-add-lang has-menu';
      controls.appendChild(addWrap);

      const addBtn = documentRef.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-secondary cs-add-lang';
      addBtn.textContent = t('editor.composer.site.addLanguage');
      addBtn.setAttribute('aria-haspopup', 'listbox');
      addBtn.setAttribute('aria-expanded', 'false');
      addWrap.appendChild(addBtn);

      const menu = documentRef.createElement('div');
      menu.className = 'press-menu';
      menu.setAttribute('role', 'listbox');
      menu.hidden = true;
      addWrap.appendChild(menu);

      const refreshMenu = () => {
        const localized = ensureLocalized(key, options.ensureDefault !== false);
        const used = new Set(Object.keys(localized || {}));
        used.add('default');

        const supportedSet = new Set();
        const addSupported = (code) => {
          const normalized = normalizeLangCode(code);
          if (!normalized) return;
          supportedSet.add(normalized);
        };

        try {
          const availableLangs = getAvailableLangs();
          if (Array.isArray(availableLangs)) availableLangs.forEach(addSupported);
        } catch (_) {}

        if (Array.isArray(PREFERRED_LANG_ORDER)) {
          PREFERRED_LANG_ORDER.forEach(addSupported);
        }

        try {
          collectLanguageCodes().forEach(addSupported);
        } catch (_) {}

        const supported = Array.from(supportedSet);
        supported.sort((a, b) => {
          const ia = PREFERRED_LANG_ORDER.indexOf(a);
          const ib = PREFERRED_LANG_ORDER.indexOf(b);
          if (ia !== -1 || ib !== -1) {
            const pa = ia === -1 ? PREFERRED_LANG_ORDER.length + 1 : ia;
            const pb = ib === -1 ? PREFERRED_LANG_ORDER.length + 1 : ib;
            return pa - pb;
          }
          return a.localeCompare(b);
        });

        // Filter only valid language codes that match LANG_CODE_PATTERN
        const available = supported.filter((code) => !used.has(code) && LANG_CODE_PATTERN.test(code));

        menu.innerHTML = available
          .map((code) =>
            `<button type="button" role="option" class="press-menu-item" data-lang="${escapeHtml(code)}">${escapeHtml(displayLangName(code))}</button>`
          )
          .join('');
        if (!available.length) {
          addBtn.setAttribute('disabled', '');
          addWrap.classList.add('is-disabled');
          addWrap.hidden = true;
          addWrap.setAttribute('aria-hidden', 'true');
          addWrap.style.display = 'none';
          if (!menu.hidden) closeMenu();
          return;
        }

        addBtn.removeAttribute('disabled');
        addWrap.classList.remove('is-disabled');
        addWrap.hidden = false;
        addWrap.removeAttribute('aria-hidden');
        addWrap.style.removeProperty('display');
      };

      if (documentRef && documentRef.addEventListener) {
        documentRef.addEventListener(LANGUAGE_POOL_CHANGED_EVENT, refreshMenu);
      }

      const closeMenu = () => {
        if (menu.hidden) return;
        const finish = () => {
          menu.hidden = true;
          addBtn.classList.remove('is-open');
          addWrap.classList.remove('is-open');
          addBtn.setAttribute('aria-expanded', 'false');
          if (documentRef && typeof documentRef.removeEventListener === 'function') {
            documentRef.removeEventListener('mousedown', onDocDown, true);
            documentRef.removeEventListener('keydown', onKeyDown, true);
          }
          menu.classList.remove('is-closing');
        };
        try {
          menu.classList.add('is-closing');
          const onEnd = () => { menu.removeEventListener('animationend', onEnd); finish(); };
          menu.addEventListener('animationend', onEnd, { once: true });
          setTimer(finish, 180);
        } catch (_) {
          finish();
        }
      };

      const openMenu = () => {
        refreshMenu();
        if (!menu.innerHTML.trim() || addWrap.hidden) return;
        if (!menu.hidden) return;
        menu.hidden = false;
        try { menu.classList.remove('is-closing'); } catch (_) {}
        addBtn.classList.add('is-open');
        addWrap.classList.add('is-open');
        addBtn.setAttribute('aria-expanded', 'true');
        try { menu.querySelector('.press-menu-item')?.focus(); } catch (_) {}
        if (documentRef && typeof documentRef.addEventListener === 'function') {
          documentRef.addEventListener('mousedown', onDocDown, true);
          documentRef.addEventListener('keydown', onKeyDown, true);
        }
        menu.querySelectorAll('.press-menu-item').forEach((item) => {
          item.addEventListener('click', () => {
            const code = normalizeLangCode(item.getAttribute('data-lang'));
            if (!code) return;
            const localized = ensureLocalized(key, options.ensureDefault !== false);
            if (Object.prototype.hasOwnProperty.call(localized, code)) return;
            localized[code] = '';
            markDirty();
            closeMenu();
            renderRows();
            broadcastLanguagePoolChange();
          });
        });
      };

      const onDocDown = (event) => {
        if (!addWrap.contains(event.target)) closeMenu();
      };

      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMenu();
        }
      };

      addBtn.addEventListener('click', () => {
        if (addBtn.hasAttribute('disabled')) return;
        if (addBtn.classList.contains('is-open')) closeMenu();
        else openMenu();
      });

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
        refreshMenu();
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
      const addWrap = documentRef.createElement('div');
      addWrap.className = 'cs-add-lang has-menu';
      controls.appendChild(addWrap);

      const addBtn = documentRef.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-secondary cs-add-lang';
      addBtn.textContent = t('editor.composer.site.addLanguage');
      addBtn.setAttribute('aria-haspopup', 'listbox');
      addBtn.setAttribute('aria-expanded', 'false');
      addWrap.appendChild(addBtn);

      const menu = documentRef.createElement('div');
      menu.className = 'press-menu';
      menu.setAttribute('role', 'listbox');
      menu.hidden = true;
      addWrap.appendChild(menu);

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

      const refreshMenu = () => {
        const used = new Set(collectUsedLangs());
        used.add('default');

        const supportedSet = new Set();
        const addSupported = (code) => {
          const normalized = normalizeLangCode(code);
          if (!normalized) return;
          supportedSet.add(normalized);
        };

        try {
          const availableLangs = getAvailableLangs();
          if (Array.isArray(availableLangs)) availableLangs.forEach(addSupported);
        } catch (_) {}

        if (Array.isArray(PREFERRED_LANG_ORDER)) {
          PREFERRED_LANG_ORDER.forEach(addSupported);
        }

        try {
          collectLanguageCodes().forEach(addSupported);
        } catch (_) {}

        const available = sortLangs(Array.from(supportedSet))
          .filter((code) => !used.has(code) && LANG_CODE_PATTERN.test(code));

        menu.innerHTML = available
          .map((code) =>
            `<button type="button" role="option" class="press-menu-item" data-lang="${escapeHtml(code)}">${escapeHtml(displayLangName(code))}</button>`
          )
          .join('');
        if (!available.length) {
          addBtn.setAttribute('disabled', '');
          addWrap.classList.add('is-disabled');
          addWrap.hidden = true;
          addWrap.setAttribute('aria-hidden', 'true');
          addWrap.style.display = 'none';
          if (!menu.hidden) closeMenu();
          return;
        }

        addBtn.removeAttribute('disabled');
        addWrap.classList.remove('is-disabled');
        addWrap.hidden = false;
        addWrap.removeAttribute('aria-hidden');
        addWrap.style.removeProperty('display');
      };

      if (documentRef && documentRef.addEventListener) {
        documentRef.addEventListener(LANGUAGE_POOL_CHANGED_EVENT, refreshMenu);
      }

      const closeMenu = () => {
        if (menu.hidden) return;
        const finish = () => {
          menu.hidden = true;
          addBtn.classList.remove('is-open');
          addWrap.classList.remove('is-open');
          addBtn.setAttribute('aria-expanded', 'false');
          if (documentRef && typeof documentRef.removeEventListener === 'function') {
            documentRef.removeEventListener('mousedown', onDocDown, true);
            documentRef.removeEventListener('keydown', onKeyDown, true);
          }
          menu.classList.remove('is-closing');
        };
        try {
          menu.classList.add('is-closing');
          const onEnd = () => { menu.removeEventListener('animationend', onEnd); finish(); };
          menu.addEventListener('animationend', onEnd, { once: true });
          setTimer(finish, 180);
        } catch (_) {
          finish();
        }
      };

      const openMenu = () => {
        refreshMenu();
        if (!menu.innerHTML.trim() || addWrap.hidden) return;
        if (!menu.hidden) return;
        menu.hidden = false;
        try { menu.classList.remove('is-closing'); } catch (_) {}
        addBtn.classList.add('is-open');
        addWrap.classList.add('is-open');
        addBtn.setAttribute('aria-expanded', 'true');
        try { menu.querySelector('.press-menu-item')?.focus(); } catch (_) {}
        if (documentRef && typeof documentRef.addEventListener === 'function') {
          documentRef.addEventListener('mousedown', onDocDown, true);
          documentRef.addEventListener('keydown', onKeyDown, true);
        }
        menu.querySelectorAll('.press-menu-item').forEach((item) => {
          item.addEventListener('click', () => {
            const code = normalizeLangCode(item.getAttribute('data-lang'));
            if (!code) return;
            const title = ensureLocalized('siteTitle', true);
            const subtitle = ensureLocalized('siteSubtitle', true);
            if (!Object.prototype.hasOwnProperty.call(title, code)) title[code] = '';
            if (!Object.prototype.hasOwnProperty.call(subtitle, code)) subtitle[code] = '';
            markDirty();
            closeMenu();
            renderRows();
            broadcastLanguagePoolChange();
          });
        });
      };

      const onDocDown = (event) => {
        if (!addWrap.contains(event.target)) closeMenu();
      };

      const onKeyDown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeMenu();
        }
      };

      addBtn.addEventListener('click', () => {
        if (addBtn.hasAttribute('disabled')) return;
        if (addBtn.classList.contains('is-open')) closeMenu();
        else openMenu();
      });

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
        refreshMenu();
      };

      renderRows();
    };

    const createTextField = (section, config) => {
      const field = createField(section, {
        dataKey: config.dataKey,
        label: config.label,
        description: config.description
      });
      const control = documentRef.createElement('div');
      control.className = 'cs-field-controls';
      const input = documentRef.createElement(config.multiline ? 'textarea' : 'input');
      if (!config.multiline) input.type = config.type || 'text';
      else input.rows = config.rows || 3;
      input.className = 'cs-input';
      input.dataset.field = config.dataKey;
      input.value = config.get() || '';
      if (config.placeholder) input.placeholder = config.placeholder;
      input.addEventListener('input', () => {
        config.set(config.multiline ? input.value : input.value);
        markDirty();
      });
      control.appendChild(input);
      if (config.trailing) control.appendChild(config.trailing);
      field.appendChild(control);
      return input;
    };

    const createSingleGridFieldset = (section) => {
      const field = documentRef.createElement('div');
      field.className = 'cs-field cs-single-grid-fieldset';
      const grid = documentRef.createElement('div');
      grid.className = 'cs-single-grid';
      field.appendChild(grid);
      section.appendChild(field);

      const addRow = (item, index = grid.children.length) => {
        const row = documentRef.createElement('div');
        row.className = 'cs-single-grid-row';
        row.dataset.field = item.dataKey;

        const controlId = `cs-single-grid-${item.dataKey}-${index}`;
        const tooltipId = `cs-single-grid-help-${item.dataKey}-${index}`;

        const labelCell = documentRef.createElement('div');
        labelCell.className = 'cs-single-grid-label';

        const tooltipWrap = documentRef.createElement('span');
        tooltipWrap.className = 'cs-help-tooltip-wrap';
        const tooltip = documentRef.createElement('button');
        tooltip.type = 'button';
        tooltip.className = 'cs-help-tooltip';
        tooltip.textContent = '?';
        tooltip.setAttribute('aria-label', `${item.label}: ${item.description}`);
        tooltip.setAttribute('aria-describedby', tooltipId);
        const tooltipBubble = documentRef.createElement('span');
        tooltipBubble.id = tooltipId;
        tooltipBubble.className = 'cs-help-tooltip-bubble';
        tooltipBubble.setAttribute('role', 'tooltip');
        tooltipBubble.textContent = item.description;
        const label = documentRef.createElement('label');
        label.className = 'cs-single-grid-title';
        label.htmlFor = controlId;
        label.textContent = item.label;
        labelCell.appendChild(label);
        tooltipWrap.appendChild(tooltip);
        tooltipWrap.appendChild(tooltipBubble);
        labelCell.appendChild(tooltipWrap);
        row.appendChild(labelCell);

        const controlCell = documentRef.createElement('div');
        controlCell.className = 'cs-single-grid-control';
        row.appendChild(controlCell);
        grid.appendChild(row);

        return { row, controlCell, controlId, label };
      };

      return { field, grid, addRow };
    };

    const renderSingleTextGrid = (section, items) => {
      const { addRow } = createSingleGridFieldset(section);
      items.forEach((item, index) => {
        const { controlCell, controlId } = addRow(item, index);
        const input = documentRef.createElement('input');
        input.id = controlId;
        input.type = item.type || 'text';
        input.className = 'cs-input';
        input.dataset.field = item.dataKey;
        input.value = item.get() || '';
        input.placeholder = item.placeholder || '';
        input.addEventListener('input', () => {
          item.set(input.value);
          markDirty();
        });
        controlCell.appendChild(input);
      });
    };

    const renderIdentityPathGrid = (section) => {
      const items = [
        {
          dataKey: 'avatar',
          label: t('editor.composer.site.fields.avatar'),
          description: t('editor.composer.site.fields.avatarHelp'),
          placeholder: 'assets/avatar.png',
          get: () => site.avatar,
          set: (value) => { site.avatar = value; }
        },
        {
          dataKey: 'contentRoot',
          label: t('editor.composer.site.fields.contentRoot'),
          description: t('editor.composer.site.fields.contentRootHelp'),
          placeholder: 'wwwroot',
          get: () => site.contentRoot,
          set: (value) => { site.contentRoot = value; }
        }
      ];

      renderSingleTextGrid(section, items);
    };

    const renderSeoResourceGrid = (section) => {
      renderSingleTextGrid(section, [
        {
          dataKey: 'resourceURL',
          label: t('editor.composer.site.fields.resourceURL'),
          description: t('editor.composer.site.fields.resourceURLHelp'),
          placeholder: 'https://example.com/',
          get: () => site.resourceURL,
          set: (value) => { site.resourceURL = value; }
        }
      ]);
    };

    const createNumberField = (section, config) => {
      const field = createField(section, {
        dataKey: config.dataKey,
        label: config.label,
        description: config.description
      });
      const control = documentRef.createElement('div');
      control.className = 'cs-field-controls';
      const input = documentRef.createElement('input');
      input.type = 'number';
      input.className = 'cs-input cs-input-small';
      input.dataset.field = config.dataKey;
      if (config.min != null) input.min = String(config.min);
      if (config.max != null) input.max = String(config.max);
      if (config.step != null) input.step = String(config.step);
      const value = config.get();
      input.value = value != null && !Number.isNaN(value) ? String(value) : '';
      input.placeholder = config.placeholder || '';
      input.addEventListener('input', () => {
        const raw = input.value.trim();
        if (!raw) config.set(null);
        else config.set(Number(raw));
        markDirty();
      });
      control.appendChild(input);
      if (config.trailing) control.appendChild(config.trailing);
      field.appendChild(control);
      return input;
    };

    const createSwitchControl = (field, labelText, options = {}) => {
      const controls = documentRef.createElement('div');
      controls.className = 'cs-field-controls cs-field-controls-inline';
      if (Array.isArray(options.classes)) controls.classList.add(...options.classes);
      const target = options.target || field;
      const toggle = documentRef.createElement('label');
      toggle.className = 'cs-switch';
      toggle.dataset.state = 'off';
      const checkbox = documentRef.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'cs-switch-input';
      checkbox.setAttribute('role', 'switch');
      checkbox.setAttribute('aria-checked', 'false');
      const track = documentRef.createElement('span');
      track.className = 'cs-switch-track';
      const thumb = documentRef.createElement('span');
      thumb.className = 'cs-switch-thumb';
      track.appendChild(thumb);
      toggle.appendChild(checkbox);
      toggle.appendChild(track);
      const accessibleLabel = labelText || (field && field.__csLabel ? field.__csLabel.textContent : '');
      if (accessibleLabel) checkbox.setAttribute('aria-label', accessibleLabel);
      controls.appendChild(toggle);
      target.appendChild(controls);
      return { controls, toggle, checkbox };
    };

    const syncSwitchState = (checkbox, toggle, value, allowMixed = false) => {
      if (allowMixed && (value === null || value === undefined)) {
        checkbox.indeterminate = true;
        checkbox.checked = false;
        checkbox.setAttribute('aria-checked', 'mixed');
        toggle.dataset.state = 'mixed';
        return;
      }
      checkbox.indeterminate = false;
      const isOn = allowMixed ? value === true : !!value;
      checkbox.checked = isOn;
      checkbox.setAttribute('aria-checked', isOn ? 'true' : 'false');
      toggle.dataset.state = isOn ? 'on' : 'off';
    };

    const createTriStateCheckbox = (section, config) => {
      const field = createField(section, {
        dataKey: config.dataKey,
        label: config.label,
        description: config.description,
        inlineDescription: false
      });
      const head = field.__csHead || field.querySelector('.cs-field-head');
      const labelWrap = field.__csLabelWrap || head;
      if (labelWrap) labelWrap.classList.add('cs-field-label-with-switch');
      const { toggle, checkbox } = createSwitchControl(field, config.checkboxLabel || config.label, {
        target: labelWrap || head || field,
        classes: ['cs-field-head-switch']
      });
      toggle.dataset.field = config.dataKey;

      const sync = () => {
        const value = config.get();
        syncSwitchState(checkbox, toggle, value, true);
      };

      checkbox.addEventListener('change', () => {
        config.set(checkbox.checked);
        syncSwitchState(checkbox, toggle, checkbox.checked, true);
        markDirty();
      });
      sync();
    };

    const createToggleField = (section, config) => {
      const field = createField(section, {
        dataKey: config.dataKey,
        label: config.label,
        description: config.description,
        inlineDescription: false
      });
      const head = field.__csHead || field.querySelector('.cs-field-head');
      const labelWrap = field.__csLabelWrap || head;
      if (labelWrap) labelWrap.classList.add('cs-field-label-with-switch');
      const { toggle, checkbox } = createSwitchControl(field, config.checkboxLabel || config.label, {
        target: labelWrap || head || field,
        classes: ['cs-field-head-switch']
      });
      toggle.dataset.field = config.dataKey;

      const sync = () => {
        syncSwitchState(checkbox, toggle, config.get(), false);
      };

      checkbox.addEventListener('change', () => {
        config.set(checkbox.checked);
        syncSwitchState(checkbox, toggle, checkbox.checked, false);
        markDirty();
      });

      sync();
      return {
        checkbox,
        field,
        control: toggle
      };
    };

    const createSelectField = (section, config) => {
      const field = createField(section, {
        dataKey: config.dataKey,
        label: config.label,
        description: config.description
      });
      const control = documentRef.createElement('div');
      control.className = 'cs-field-controls';
      const select = documentRef.createElement('select');
      select.className = 'cs-select';
      select.dataset.field = config.dataKey;
      (config.options || []).forEach((opt) => {
        const option = documentRef.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });
      const ensureSelection = () => {
        const options = Array.from(select.options);
        if (!options.length) {
          const currentRaw = config.get();
          const current = currentRaw == null ? '' : String(currentRaw);
          if (current) {
            select.value = current;
          }
          return current;
        }
        const available = new Set(options.map((opt) => opt.value));
        const currentRaw = config.get();
        const current = currentRaw == null ? '' : String(currentRaw);
        if (current && available.has(current)) {
          select.value = current;
          return current;
        }
        const fallback = (() => {
          if (config.defaultValue != null && available.has(config.defaultValue)) {
            return config.defaultValue;
          }
          return options.length ? options[0].value : '';
        })();
        select.value = fallback;
        if (fallback && fallback !== current) {
          config.set(fallback);
          markDirty();
          return fallback;
        }
        if (!fallback && current) {
          config.set('');
          markDirty();
        }
        return fallback;
      };
      ensureSelection();
      select.addEventListener('change', () => {
        const next = select.value;
        config.set(next);
        markDirty();
      });
      control.appendChild(select);
      field.appendChild(control);
      return select;
    };

    const renderBehaviorGrid = (section) => {
      const { addRow } = createSingleGridFieldset(section);
      const rows = [];
      const addBehaviorRow = (item) => {
        const row = addRow(item, rows.length);
        rows.push(row);
        return row;
      };

      const createSelectRow = (item) => {
        const { controlCell, controlId } = addBehaviorRow(item);
        const select = documentRef.createElement('select');
        select.id = controlId;
        select.className = 'cs-select';
        select.dataset.field = item.dataKey;
        controlCell.appendChild(select);
        return select;
      };

      const defaultLanguageSelect = createSelectRow({
        dataKey: 'defaultLanguage',
        label: t('editor.composer.site.fields.defaultLanguage'),
        description: t('editor.composer.site.fields.defaultLanguageHelp')
      });

      const applyDefaultLanguageOptions = () => {
        const codes = collectLanguageCodes();
        const seen = new Set();
        const appendOption = (value, label) => {
          const option = documentRef.createElement('option');
          option.value = value;
          option.textContent = label;
          defaultLanguageSelect.appendChild(option);
          seen.add(value);
        };

        defaultLanguageSelect.innerHTML = '';
        appendOption('', t('editor.composer.site.languageAutoOption'));
        codes.forEach((code) => {
          if (!seen.has(code)) appendOption(code, displayLangName(code));
        });
        const current = normalizeLangCode(site.defaultLanguage);
        if (current && !seen.has(current)) {
          appendOption(current, displayLangName(current));
        }
        const nextValue = current && seen.has(current) ? current : '';
        defaultLanguageSelect.value = nextValue;
      };

      defaultLanguageSelect.addEventListener('change', () => {
        site.defaultLanguage = normalizeLangCode(defaultLanguageSelect.value);
        markDirty();
      });
      applyDefaultLanguageOptions();

      const createNumberRow = (item) => {
        const { controlCell, controlId } = addBehaviorRow(item);
        const input = documentRef.createElement('input');
        input.id = controlId;
        input.type = 'number';
        input.className = 'cs-input';
        input.dataset.field = item.dataKey;
        if (item.min != null) input.min = String(item.min);
        const value = item.get();
        input.value = value != null && !Number.isNaN(value) ? String(value) : '';
        input.addEventListener('input', () => {
          const raw = input.value.trim();
          item.set(raw ? Number(raw) : null);
          markDirty();
        });
        controlCell.appendChild(input);
        return input;
      };

      createNumberRow({
        dataKey: 'contentOutdatedDays',
        label: t('editor.composer.site.fields.contentOutdatedDays'),
        description: t('editor.composer.site.fields.contentOutdatedDaysHelp'),
        min: 0,
        get: () => site.contentOutdatedDays,
        set: (value) => { site.contentOutdatedDays = value == null || Number.isNaN(value) ? null : value; }
      });

      createNumberRow({
        dataKey: 'pageSize',
        label: t('editor.composer.site.fields.pageSize'),
        description: t('editor.composer.site.fields.pageSizeHelp'),
        min: 1,
        get: () => site.pageSize,
        set: (value) => { site.pageSize = value == null || Number.isNaN(value) ? null : value; }
      });

      const createToggleRow = (item, allowMixed = false) => {
        const { row, controlCell } = addBehaviorRow(item);
        const { toggle, checkbox } = createSwitchControl(row, item.checkboxLabel || item.label, {
          target: controlCell,
          classes: ['cs-single-grid-switch']
        });
        toggle.dataset.field = item.dataKey;
        const sync = () => {
          syncSwitchState(checkbox, toggle, item.get(), allowMixed);
        };
        checkbox.addEventListener('change', () => {
          item.set(checkbox.checked);
          syncSwitchState(checkbox, toggle, checkbox.checked, allowMixed);
          markDirty();
        });
        sync();
        return { checkbox, row, control: toggle };
      };

      const showAllPostsField = createToggleRow({
        dataKey: 'showAllPosts',
        label: t('editor.composer.site.fields.showAllPosts'),
        description: t('editor.composer.site.fields.showAllPostsHelp'),
        checkboxLabel: t('editor.composer.site.toggleEnabled'),
        get: () => site.showAllPosts === true,
        set: (value) => { site.showAllPosts = !!value; }
      });

      const landingTabSelect = createSelectRow({
        dataKey: 'landingTab',
        label: t('editor.composer.site.fields.landingTab'),
        description: t('editor.composer.site.fields.landingTabHelp')
      });

      const getTabLabel = (slug) => {
        if (!state.tabs || typeof state.tabs !== 'object') return slug;
        const entry = state.tabs[slug];
        if (!entry || typeof entry !== 'object') return slug;
        const pickTitle = () => {
          const def = entry.default;
          if (def && typeof def === 'object' && def.title) return String(def.title).trim();
          for (const key of Object.keys(entry)) {
            if (key === '__order') continue;
            const val = entry[key];
            if (val && typeof val === 'object' && val.title) {
              const title = String(val.title).trim();
              if (title) return title;
            }
          }
          return '';
        };
        const title = pickTitle();
        if (!title) return slug;
        if (title.toLowerCase() === String(slug).toLowerCase()) return title;
        return `${title} (${slug})`;
      };

      const renderLandingOptions = () => {
        const seen = new Set();
        let firstOption = null;
        const addOption = (value, label) => {
          if (value === '' || seen.has(value)) return;
          const option = documentRef.createElement('option');
          option.value = value;
          option.textContent = label;
          landingTabSelect.appendChild(option);
          seen.add(value);
          if (firstOption == null) firstOption = value;
        };

        const current = site.landingTab || '';
        landingTabSelect.innerHTML = '';
        const order = state.tabs && Array.isArray(state.tabs.__order) ? state.tabs.__order : [];
        order.forEach((slug) => {
          if (!slug) return;
          addOption(slug, getTabLabel(slug));
        });
        const allowPosts = site.showAllPosts === true || current === 'posts';
        if (allowPosts) {
          addOption('posts', t('editor.composer.site.fields.landingTabAllPostsOption'));
        }
        if (current && !seen.has(current)) addOption(current, current);
        const nextValue = seen.has(current) ? current : firstOption || '';
        landingTabSelect.value = nextValue;
        if (nextValue && nextValue !== site.landingTab) {
          site.landingTab = nextValue;
          markDirty();
        }
      };

      landingTabSelect.addEventListener('change', () => {
        const value = landingTabSelect.value;
        if (value && site.landingTab !== value) {
          site.landingTab = value;
          markDirty();
        }
      });

      renderLandingOptions();
      showAllPostsField.checkbox.addEventListener('change', () => {
        if (site.showAllPosts !== true && site.landingTab === 'posts') {
          site.landingTab = '';
        }
        renderLandingOptions();
      });

      createToggleRow({
        dataKey: 'cardCoverFallback',
        label: t('editor.composer.site.fields.cardCoverFallback'),
        description: t('editor.composer.site.fields.cardCoverFallbackHelp'),
        checkboxLabel: t('editor.composer.site.toggleEnabled'),
        get: () => site.cardCoverFallback,
        set: (value) => { site.cardCoverFallback = value; }
      }, true);

      createToggleRow({
        dataKey: 'errorOverlay',
        label: t('editor.composer.site.fields.errorOverlay'),
        description: t('editor.composer.site.fields.errorOverlayHelp'),
        checkboxLabel: t('editor.composer.site.toggleEnabled'),
        get: () => site.errorOverlay,
        set: (value) => { site.errorOverlay = value; }
      }, true);
    };

    const renderThemeGrid = (section) => {
      const { addRow } = createSingleGridFieldset(section);
      const rows = [];
      const addThemeRow = (item) => {
        const row = addRow(item, rows.length);
        rows.push(row);
        return row;
      };

      const createSelectRow = (item) => {
        const { controlCell, controlId } = addThemeRow(item);
        const select = documentRef.createElement('select');
        select.id = controlId;
        select.className = 'cs-select';
        select.dataset.field = item.dataKey;
        (item.options || []).forEach((opt) => {
          const option = documentRef.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        });

        const ensureSelection = () => {
          const options = Array.from(select.options);
          if (!options.length) {
            const currentRaw = item.get();
            const current = currentRaw == null ? '' : String(currentRaw);
            if (current) select.value = current;
            return current;
          }
          const available = new Set(options.map((opt) => opt.value));
          const currentRaw = item.get();
          const current = currentRaw == null ? '' : String(currentRaw);
          if (current && available.has(current)) {
            select.value = current;
            return current;
          }
          const fallback = item.defaultValue != null && available.has(item.defaultValue)
            ? item.defaultValue
            : (options.length ? options[0].value : '');
          select.value = fallback;
          if (fallback && fallback !== current) {
            item.set(fallback);
            markDirty();
          } else if (!fallback && current) {
            item.set('');
            markDirty();
          }
          return fallback;
        };

        ensureSelection();
        select.addEventListener('change', () => {
          item.set(select.value);
          markDirty();
        });
        controlCell.appendChild(select);
        return select;
      };

      createSelectRow({
        dataKey: 'themeMode',
        label: t('editor.composer.site.fields.themeMode'),
        description: t('editor.composer.site.fields.themeModeHelp'),
        get: () => site.themeMode || '',
        set: (value) => { site.themeMode = value == null ? '' : value; },
        defaultValue: 'auto',
        options: [
          { value: 'user', label: 'user' },
          { value: 'auto', label: 'auto' },
          { value: 'light', label: 'light' },
          { value: 'dark', label: 'dark' }
        ]
      });

      const sanitizeThemePackValue = (value) => {
        return safeString(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      };
      const normalizeThemePackList = (list) => {
        const normalized = [];
        const seen = new Set();
        (Array.isArray(list) ? list : []).forEach((item) => {
          if (!item) return;
          const packValue = sanitizeThemePackValue(item.value);
          if (!packValue || seen.has(packValue)) return;
          seen.add(packValue);
          normalized.push({
            value: packValue,
            label: safeString(item.label || item.value || packValue) || packValue
          });
        });
        return normalized;
      };

      const themePackSelect = createSelectRow({
        dataKey: 'themePack',
        label: t('editor.composer.site.fields.themePack'),
        description: t('editor.composer.site.fields.themePackHelp'),
        get: () => sanitizeThemePackValue(site.themePack),
        set: (value) => { site.themePack = sanitizeThemePackValue(value); },
        defaultValue: 'native',
        options: []
      });

      const fallbackThemePacks = [
        { value: 'native', label: 'Native' },
        { value: 'github', label: 'GitHub' },
        { value: 'apple', label: 'Apple' },
        { value: 'openai', label: 'OpenAI' }
      ];

      const applyThemePackOptions = (options) => {
        const normalized = normalizeThemePackList(options);
        const selectOptions = normalized.length ? normalized : normalizeThemePackList(fallbackThemePacks);
        const current = sanitizeThemePackValue(site.themePack);
        const seen = new Set();
        const appendOption = (value, label) => {
          const option = documentRef.createElement('option');
          option.value = value;
          option.textContent = safeString(label || value) || value;
          themePackSelect.appendChild(option);
          seen.add(value);
        };
        themePackSelect.innerHTML = '';
        let firstOption = null;
        selectOptions.forEach(({ value, label }) => {
          appendOption(value, label);
          if (firstOption == null) firstOption = value;
        });
        if (current && !seen.has(current)) {
          appendOption(current, current);
          if (firstOption == null) firstOption = current;
        }
        const nextValue = current && seen.has(current) ? current : firstOption || '';
        themePackSelect.value = nextValue;
      };

      applyThemePackOptions(fallbackThemePacks);
      const themePackRequest = fetchContent
        ? fetchContent('assets/themes/packs.json', { cache: 'no-store' })
        : Promise.reject(new Error('Theme pack fetch is not available in this runtime.'));
      themePackRequest
        .then((response) => (response && response.ok ? response.json() : Promise.reject()))
        .then((list) => {
          if (!Array.isArray(list) || !normalizeThemePackList(list).length) throw new Error('empty theme pack list');
          applyThemePackOptions(list);
        })
        .catch(() => {
          applyThemePackOptions(fallbackThemePacks);
        });

      const manageThemesRow = addThemeRow({
        dataKey: 'manageThemes',
        label: 'Manage themes',
        description: 'Theme Manager.'
      });
      const manageThemesButton = documentRef.createElement('button');
      manageThemesButton.type = 'button';
      manageThemesButton.className = 'btn-secondary';
      manageThemesButton.textContent = 'Manage themes';
      manageThemesButton.addEventListener('click', () => applyMode('themes'));
      manageThemesRow.controlCell.appendChild(manageThemesButton);

      const { row, controlCell } = addThemeRow({
        dataKey: 'themeOverride',
        label: t('editor.composer.site.fields.themeOverride'),
        description: t('editor.composer.site.fields.themeOverrideHelp'),
        checkboxLabel: t('editor.composer.site.toggleEnabled')
      });
      const { toggle, checkbox } = createSwitchControl(row, t('editor.composer.site.toggleEnabled'), {
        target: controlCell,
        classes: ['cs-single-grid-switch']
      });
      toggle.dataset.field = 'themeOverride';
      checkbox.addEventListener('change', () => {
        site.themeOverride = checkbox.checked;
        syncSwitchState(checkbox, toggle, checkbox.checked, true);
        markDirty();
      });
      syncSwitchState(checkbox, toggle, site.themeOverride, true);
    };

    const renderAnnotateGrid = (section) => {
      const annotate = ensureAnnotate();
      const { addRow } = createSingleGridFieldset(section);
      const rows = [];
      const addAnnotateRow = (item) => {
        const row = addRow(item, rows.length);
        rows.push(row);
        return row;
      };

      const { row: enabledRow, controlCell: enabledControl } = addAnnotateRow({
        dataKey: 'annotate',
        label: t('editor.composer.site.fields.annotateEnabled'),
        description: t('editor.composer.site.fields.annotateEnabledHelp'),
        checkboxLabel: t('editor.composer.site.toggleEnabled')
      });
      const { toggle, checkbox } = createSwitchControl(
        enabledRow,
        t('editor.composer.site.toggleEnabled'),
        {
          target: enabledControl,
          classes: ['cs-single-grid-switch']
        }
      );
      toggle.dataset.field = 'annotate';
      toggle.dataset.subfield = 'enabled';
      checkbox.addEventListener('change', () => {
        annotate.enabled = checkbox.checked;
        syncSwitchState(checkbox, toggle, checkbox.checked, true);
        markDirty();
      });
      syncSwitchState(checkbox, toggle, annotate.enabled, true);

      const createTextRow = (item) => {
        const { controlCell, controlId } = addAnnotateRow(item);
        const input = documentRef.createElement('input');
        input.id = controlId;
        input.type = item.type || 'text';
        input.className = 'cs-input';
        input.dataset.field = 'annotate';
        input.dataset.subfield = item.subfield;
        input.value = item.get() || '';
        input.placeholder = item.placeholder || '';
        if (item.listId) input.setAttribute('list', item.listId);
        input.spellcheck = false;
        input.autocomplete = 'off';
        input.addEventListener('input', () => {
          item.set(input.value);
          markDirty();
        });
        controlCell.appendChild(input);
        if (item.listId && Array.isArray(item.options)) {
          const list = documentRef.createElement('datalist');
          list.id = item.listId;
          item.options.forEach((entry) => {
            const option = documentRef.createElement('option');
            option.value = entry.value;
            option.label = entry.label || entry.value;
            list.appendChild(option);
          });
          controlCell.appendChild(list);
        }
        return input;
      };

      createTextRow({
        dataKey: 'annotate',
        subfield: 'connectBaseUrl',
        label: t('editor.composer.site.fields.annotateConnectBaseUrl'),
        description: t('editor.composer.site.fields.annotateConnectBaseUrlHelp'),
        type: 'url',
        listId: 'siteAnnotateConnectBaseUrlPresets',
        options: CONNECT_PUBLISH_PRESETS,
        placeholder: CONNECT_PUBLISH_PRESETS[0].value,
        get: () => annotate.connectBaseUrl,
        set: (value) => { annotate.connectBaseUrl = value; }
      });

      createTextRow({
        dataKey: 'annotate',
        subfield: 'discussionCategory',
        label: t('editor.composer.site.fields.annotateDiscussionCategory'),
        description: t('editor.composer.site.fields.annotateDiscussionCategoryHelp'),
        listId: 'siteAnnotateDiscussionCategoryPresets',
        options: ANNOTATE_DISCUSSION_CATEGORY_PRESETS,
        placeholder: 'General',
        get: () => annotate.discussionCategory,
        set: (value) => { annotate.discussionCategory = value; }
      });
    };

    const renderAssetWarningsGrid = (section) => {
      const warnings = ensureAssetWarnings();
      const { addRow } = createSingleGridFieldset(section);
      const rows = [];
      const addAssetRow = (item) => {
        const row = addRow(item, rows.length);
        rows.push(row);
        return row;
      };

      const { row: largeImageRow, controlCell: largeImageControl } = addAssetRow({
        dataKey: 'assetWarnings',
        label: t('editor.composer.site.fields.assetLargeImage'),
        description: t('editor.composer.site.fields.assetLargeImageHelp'),
        checkboxLabel: t('editor.composer.site.toggleEnabled')
      });
      const { toggle, checkbox } = createSwitchControl(
        largeImageRow,
        t('editor.composer.site.toggleEnabled'),
        {
          target: largeImageControl,
          classes: ['cs-single-grid-switch']
        }
      );
      toggle.dataset.field = 'assetWarnings';
      toggle.dataset.subfield = 'enabled';
      checkbox.addEventListener('change', () => {
        warnings.largeImage.enabled = checkbox.checked;
        syncSwitchState(checkbox, toggle, checkbox.checked, true);
        markDirty();
      });
      syncSwitchState(checkbox, toggle, warnings.largeImage.enabled, true);

      const { controlCell: thresholdControl, controlId: thresholdId } = addAssetRow({
        dataKey: 'assetWarnings',
        label: t('editor.composer.site.fields.assetLargeImageThreshold'),
        description: t('editor.composer.site.fields.assetLargeImageThresholdHelp')
      });
      const thresholdInput = documentRef.createElement('input');
      thresholdInput.id = thresholdId;
      thresholdInput.type = 'number';
      thresholdInput.className = 'cs-input';
      thresholdInput.dataset.field = 'assetWarnings';
      thresholdInput.dataset.subfield = 'thresholdKB';
      thresholdInput.min = '1';
      const threshold = warnings.largeImage.thresholdKB;
      thresholdInput.value = threshold != null && !Number.isNaN(threshold) ? String(threshold) : '';
      thresholdInput.addEventListener('input', () => {
        const raw = thresholdInput.value.trim();
        warnings.largeImage.thresholdKB = raw ? Number(raw) : null;
        markDirty();
      });
      thresholdControl.appendChild(thresholdInput);
    };

    const createLinkListField = (section, key, config) => {
      const list = ensureLinkList(key);
      const field = config.subheading
        ? createSubheadingField(section, {
          dataKey: key,
          label: config.label,
          description: config.description
        })
        : createField(section, {
          dataKey: key,
          label: config.label,
          description: config.description
        });
      const listWrap = documentRef.createElement('div');
      listWrap.className = 'cs-link-list';
      field.appendChild(listWrap);
      const controls = documentRef.createElement('div');
      controls.className = 'cs-field-controls';
      field.appendChild(controls);
      const addBtn = documentRef.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-secondary cs-add-link';
      addBtn.textContent = t('editor.composer.site.addLink');
      controls.appendChild(addBtn);

      const renderRowsAndRefreshDiff = () => {
        renderRows();
        try { notifyComposerChange('site', { skipAutoSave: true }); } catch (_) {}
      };

      const moveEntry = (from, to, options = {}) => {
        if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
        markDirty();
        if (options.refreshDiff) renderRowsAndRefreshDiff();
        else renderRows();
        return true;
      };

      let linkDragState = null;

      const getAnimatedLinkRows = () => Array.from(listWrap.querySelectorAll('.cs-link-row:not(.is-dragging)'));

      const animateLinkRows = (callback) => {
        const previousRects = new Map();
        getAnimatedLinkRows().forEach((row) => {
          previousRects.set(row, row.getBoundingClientRect());
        });

        callback();

        getAnimatedLinkRows().forEach((row) => {
          const previous = previousRects.get(row);
          if (!previous) return;
          const next = row.getBoundingClientRect();
          const deltaY = previous.top - next.top;
          if (!deltaY) return;
          row.style.transition = 'none';
          row.style.transform = `translate3d(0, ${previous.top - next.top}px, 0)`;
          requestFrame(() => {
            row.style.transition = 'transform .18s cubic-bezier(.2,.8,.2,1)';
            row.style.transform = '';
          });
        });
      };

      const createDragPlaceholder = (row) => {
        const rowRect = row.getBoundingClientRect();
        const placeholder = documentRef.createElement('div');
        placeholder.className = 'cs-link-drop-placeholder';
        placeholder.style.height = `${rowRect.height}px`;
        return placeholder;
      };

      const getDropIndex = () => {
        if (!linkDragState || !linkDragState.placeholder) return -1;
        const rows = Array.from(listWrap.children)
          .filter((node) => node === linkDragState.placeholder || (node !== linkDragState.dragRow && node.classList?.contains('cs-link-row')));
        return rows.indexOf(linkDragState.placeholder);
      };

      const moveListEntry = (from, to) => {
        if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
        const [item] = list.splice(from, 1);
        list.splice(to, 0, item);
        markDirty();
        return true;
      };

      const applyDragPreview = (clientY) => {
        if (!linkDragState) return;
        linkDragState.dragRow.style.transform = `translate3d(0, ${clientY - linkDragState.startY}px, 0)`;
        const rows = getAnimatedLinkRows();
        let nextNode = null;
        for (const row of rows) {
          const rect = row.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;
          if (clientY < midpoint) {
            nextNode = row;
            break;
          }
        }
        if (nextNode === linkDragState.placeholder.nextSibling) return;
        animateLinkRows(() => {
          listWrap.insertBefore(linkDragState.placeholder, nextNode);
        });
      };

      const updateDragRowState = () => {
        listWrap.querySelectorAll('.cs-link-row').forEach((row) => {
          row.classList.toggle('is-dragging', !!linkDragState && row === linkDragState.dragRow);
        });
      };

      const endDrag = () => {
        documentRef.removeEventListener('pointermove', handleDragPointerMove, true);
        documentRef.removeEventListener('pointerup', endDrag, true);
        documentRef.removeEventListener('pointercancel', endDrag, true);
        if (linkDragState) {
          const { fromIndex, dragRow, placeholder } = linkDragState;
          const toIndex = getDropIndex();
          dragRow.classList.remove('is-dragging');
          dragRow.style.position = '';
          dragRow.style.left = '';
          dragRow.style.top = '';
          dragRow.style.width = '';
          dragRow.style.zIndex = '';
          dragRow.style.transform = '';
          if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
          moveListEntry(fromIndex, toIndex);
          renderRowsAndRefreshDiff();
        }
        linkDragState = null;
        updateDragRowState();
      };

      const handleDragPointerMove = (event) => {
        if (!linkDragState) return;
        event.preventDefault();
        applyDragPreview(event.clientY);
      };

      const createDragHandle = (index) => {
        const handle = documentRef.createElement('span');
        handle.setAttribute('role', 'button');
        handle.tabIndex = 0;
        handle.className = 'cs-link-drag-handle';
        handle.setAttribute('aria-label', t('editor.composer.site.reorderLink'));
        handle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
        handle.addEventListener('pointerdown', (event) => {
          if (event.button != null && event.button !== 0) return;
          event.preventDefault();
          const row = handle.closest('.cs-link-row');
          if (!row) return;
          const rowRect = row.getBoundingClientRect();
          const placeholder = createDragPlaceholder(row);
          listWrap.insertBefore(placeholder, row);
          linkDragState = {
            fromIndex: index,
            dragRow: row,
            placeholder,
            startY: event.clientY
          };
          row.classList.add('is-dragging');
          row.style.position = 'fixed';
          row.style.left = `${rowRect.left}px`;
          row.style.top = `${rowRect.top}px`;
          row.style.width = `${rowRect.width}px`;
          row.style.zIndex = '1000';
          row.style.transform = 'translate3d(0, 0, 0)';
          updateDragRowState();
          documentRef.addEventListener('pointermove', handleDragPointerMove, true);
          documentRef.addEventListener('pointerup', endDrag, true);
          documentRef.addEventListener('pointercancel', endDrag, true);
        });
        handle.addEventListener('keydown', (event) => {
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
          event.preventDefault();
          moveEntry(index, event.key === 'ArrowUp' ? index - 1 : index + 1, { refreshDiff: true });
        });
        return handle;
      };

      const renderRows = () => {
        listWrap.innerHTML = '';
        if (!list.length) {
          const empty = documentRef.createElement('div');
          empty.className = 'cs-empty';
          empty.textContent = t('editor.composer.site.noLinks');
          listWrap.appendChild(empty);
          return;
        }
        const labelTitleId = `${key}-label-title`;
        const hrefTitleId = `${key}-href-title`;
        const appendLinkHeader = () => {
          const head = documentRef.createElement('div');
          head.className = 'cs-link-head';
          const handleSpacer = documentRef.createElement('span');
          handleSpacer.className = 'cs-link-head-spacer';
          handleSpacer.setAttribute('aria-hidden', 'true');
          const labelTitle = documentRef.createElement('span');
          labelTitle.id = labelTitleId;
          labelTitle.className = 'cs-link-field-title cs-link-field-title--label';
          labelTitle.textContent = t('editor.composer.site.linkLabelTitle');
          const hrefTitle = documentRef.createElement('span');
          hrefTitle.id = hrefTitleId;
          hrefTitle.className = 'cs-link-field-title cs-link-field-title--href';
          hrefTitle.textContent = t('editor.composer.site.linkHrefTitle');
          const actionSpacer = documentRef.createElement('span');
          actionSpacer.className = 'cs-link-head-actions';
          actionSpacer.setAttribute('aria-hidden', 'true');
          head.append(handleSpacer, labelTitle, hrefTitle, actionSpacer);
          listWrap.appendChild(head);
        };
        appendLinkHeader();
        list.forEach((item, index) => {
          const row = documentRef.createElement('div');
          row.className = 'cs-link-row';
          row.dataset.index = String(index);

          const dragHandle = createDragHandle(index);

          const labelField = documentRef.createElement('div');
          labelField.className = 'cs-link-field cs-link-field--label';
          if (index > 0) {
            labelField.classList.add('cs-link-field--compact');
          }
          const labelInputId = `${key}-label-${index}`;
          const labelInput = documentRef.createElement('input');
          labelInput.type = 'text';
          labelInput.id = labelInputId;
          labelInput.className = 'cs-input';
          labelInput.dataset.field = key;
          labelInput.dataset.index = String(index);
          labelInput.dataset.subfield = 'label';
          labelInput.placeholder = t('editor.composer.site.linkLabelPlaceholder');
          labelInput.setAttribute('aria-labelledby', labelTitleId);
          labelInput.value = item && item.label ? item.label : '';
          labelInput.addEventListener('input', () => {
            list[index].label = labelInput.value;
            markDirty();
          });
          labelField.append(labelInput);

          const hrefField = documentRef.createElement('div');
          hrefField.className = 'cs-link-field cs-link-field--href';
          if (index > 0) {
            hrefField.classList.add('cs-link-field--compact');
          }
          const hrefInputId = `${key}-href-${index}`;
          const hrefInput = documentRef.createElement('input');
          hrefInput.type = 'text';
          hrefInput.id = hrefInputId;
          hrefInput.className = 'cs-input';
          hrefInput.dataset.field = key;
          hrefInput.dataset.index = String(index);
          hrefInput.dataset.subfield = 'href';
          hrefInput.placeholder = t('editor.composer.site.linkHrefPlaceholder');
          hrefInput.setAttribute('aria-labelledby', hrefTitleId);
          hrefInput.value = item && item.href ? item.href : '';
          hrefInput.addEventListener('input', () => {
            list[index].href = hrefInput.value;
            markDirty();
          });
          hrefField.append(hrefInput);
          const actions = documentRef.createElement('div');
          actions.className = 'cs-link-actions';
          const removeBtn = documentRef.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn-tertiary cs-remove-link';
          removeBtn.textContent = t('editor.composer.site.removeLink');
          removeBtn.addEventListener('click', () => {
            list.splice(index, 1);
            markDirty();
            renderRowsAndRefreshDiff();
          });
          actions.append(removeBtn);
          row.append(dragHandle, labelField, hrefField, actions);
          listWrap.appendChild(row);
        });
      };

      addBtn.addEventListener('click', () => {
        list.push({ label: '', href: '' });
        markDirty();
        renderRowsAndRefreshDiff();
      });

      renderRows();
    };

    const repoSection = createSection(
      t('editor.composer.site.sections.repo.title'),
      t('editor.composer.site.sections.repo.description')
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
      t('editor.composer.site.sections.identity.title'),
      t('editor.composer.site.sections.identity.description')
    );
    renderIdentityLocalizedGrid(identitySection);
    renderIdentityPathGrid(identitySection);

    const seoSection = createSection(
      t('editor.composer.site.sections.seo.title'),
      t('editor.composer.site.sections.seo.description')
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
      t('editor.composer.site.sections.configuration.title'),
      t('editor.composer.site.sections.configuration.description')
    );
    const behaviorSubsection = createConfigSubsection(
      siteConfigSection,
      t('editor.composer.site.sections.behavior.title'),
      t('editor.composer.site.sections.behavior.description')
    );
    renderBehaviorGrid(behaviorSubsection);

    const themeSubsection = createConfigSubsection(
      siteConfigSection,
      t('editor.composer.site.sections.theme.title'),
      t('editor.composer.site.sections.theme.description')
    );
    renderThemeGrid(themeSubsection);

    const commentsSubsection = createConfigSubsection(
      siteConfigSection,
      t('editor.composer.site.sections.comments.title'),
      t('editor.composer.site.sections.comments.description')
    );
    renderAnnotateGrid(commentsSubsection);

    const assetsSubsection = createConfigSubsection(
      siteConfigSection,
      t('editor.composer.site.sections.assets.title'),
      t('editor.composer.site.sections.assets.description')
    );
    renderAssetWarningsGrid(assetsSubsection);

    if (site.__extras && Object.keys(site.__extras).length) {
      const extrasSection = createSection(
        t('editor.composer.site.sections.extras.title'),
        t('editor.composer.site.sections.extras.description')
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
