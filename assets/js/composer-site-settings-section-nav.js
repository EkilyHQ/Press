import { EDITOR_SHELL_SELECTORS } from './editor-shell-contract.js';

const noop = () => {};

export function cleanupComposerSiteSettingsSectionNav(root) {
  if (!root) return;
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
    if (typeof root.__pressSiteNavFocusHandler === 'function') root.removeEventListener('focusin', root.__pressSiteNavFocusHandler);
  } catch (_) {}
  try { root.__pressSiteNavFocusHandler = null; } catch (_) {}
  try { root.__pressSiteNavRefresh = null; } catch (_) {}
  try { root.__pressSiteNavSetActive = null; } catch (_) {}
  try { root.__pressSiteFirstSectionId = null; } catch (_) {}
  try { root.__pressSiteRevealField = null; } catch (_) {}
}

export function createComposerSiteSettingsSectionNav(options = {}) {
  const root = options.root || null;
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const performanceRef = options.performanceRef || null;
  const cssRef = options.cssRef || null;
  const sectionsMeta = Array.isArray(options.sectionsMeta) ? options.sectionsMeta : [];
  const getComputedStyleFor = typeof options.getComputedStyleFor === 'function'
    ? options.getComputedStyleFor
    : () => null;
  const requestFrame = typeof options.requestFrame === 'function'
    ? options.requestFrame
    : (handler) => {
      if (typeof handler === 'function') handler();
      return null;
    };
  const cancelFrame = typeof options.cancelFrame === 'function' ? options.cancelFrame : noop;
  const setTimer = typeof options.setTimer === 'function'
    ? options.setTimer
    : (handler) => {
      if (typeof handler === 'function') handler();
      return null;
    };
  const clearTimer = typeof options.clearTimer === 'function' ? options.clearTimer : noop;
  const composerPrefersReducedMotion = typeof options.composerPrefersReducedMotion === 'function'
    ? options.composerPrefersReducedMotion
    : () => true;
  const resolveComposerScrollDuration = typeof options.resolveComposerScrollDuration === 'function'
    ? options.resolveComposerScrollDuration
    : () => 0;
  const animateComposerViewportScroll = typeof options.animateComposerViewportScroll === 'function'
    ? options.animateComposerViewportScroll
    : () => false;
  const cancelComposerSiteScrollAnimation = typeof options.cancelComposerSiteScrollAnimation === 'function'
    ? options.cancelComposerSiteScrollAnimation
    : noop;

  let activeSectionId = '';
  const rootHadVisibleLayout = (() => {
    try { return !!(root && root.getClientRects && root.getClientRects().length); }
    catch (_) { return false; }
  })();
  const preservedActiveLabel = (() => {
    if (!rootHadVisibleLayout || !root) return '';
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

  const syncFirstSectionId = () => {
    if (!root) return '';
    const firstSectionId = sectionsMeta[0] && sectionsMeta[0].id ? sectionsMeta[0].id : '';
    try { root.__pressSiteFirstSectionId = firstSectionId; } catch (_) {}
    return firstSectionId;
  };

  const resolveSiteScrollContainer = () => {
    if (!windowRef || !documentRef || !root) return null;
    try {
      const viewport = root ? root.querySelector(EDITOR_SHELL_SELECTORS.composerSiteViewportElement) : null;
      if (viewport) {
        const styles = getComputedStyleFor(viewport);
        const overflowY = styles ? String(styles.overflowY || '') : '';
        const canOwnScroll = /(auto|scroll|overlay)/.test(overflowY)
          && (!viewport.getClientRects || viewport.getClientRects().length > 0);
        if (canOwnScroll) return viewport;
      }
    } catch (_) {}
    try {
      const modalBody = root && typeof root.closest === 'function' ? root.closest(EDITOR_SHELL_SELECTORS.editorModalBody) : null;
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

  function setActiveSection(sectionId, methodOptions = {}) {
    syncFirstSectionId();
    if (!sectionId || !sectionsMeta.length) return;
    let resolved = false;
    let focusTarget = null;
    let activeMeta = null;
    const shouldScroll = methodOptions && methodOptions.scrollViewport !== false;
    const skipScrollLock = !!(methodOptions && methodOptions.skipScrollLock);
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
        if (methodOptions.focusPanel) {
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
            const behavior = methodOptions.scrollBehavior || 'smooth';
            const prefersReduced = composerPrefersReducedMotion();
            const targetY = getSiteScrollTop(scrollContainer) + delta;
            const resolvedDuration = resolveComposerScrollDuration(methodOptions.scrollDuration);
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

  const revealField = (fieldKey, methodOptions = {}) => {
    if (!fieldKey || !root) return null;
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
      if (methodOptions.scroll !== false) {
        try {
          const behavior = methodOptions.behavior || 'smooth';
          requestFrame(() => {
            try { fieldEl.scrollIntoView({ block: 'start', behavior }); }
            catch (_) { fieldEl.scrollIntoView(); }
          });
        } catch (_) {
          try { fieldEl.scrollIntoView(); } catch (_) {}
        }
      }
      if (methodOptions.focus !== false) {
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
              try { focusTarget.focus({ preventScroll: methodOptions.scroll !== false }); }
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
  syncFirstSectionId();

  return {
    getActiveSectionId: () => activeSectionId,
    getPreservedActiveLabel: () => preservedActiveLabel,
    refreshNavDiffState,
    scheduleScrollSync,
    setActiveSection,
    syncFirstSectionId
  };
}
