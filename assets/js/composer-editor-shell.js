import {
  animateEditorSystemPanelContent as animateSystemPanelContent,
  showEditorSystemPanel as showComposerSystemPanel
} from './composer-system-panel.js?v=press-system-v3.4.38';

export function createComposerEditorShell(options = {}) {
  const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const editorSessionStateStore = options.editorSessionStateStore;
  const expandedEditorTreeNodeIds = options.expandedEditorTreeNodeIds || new Set();
  const treeText = typeof options.treeText === 'function' ? options.treeText : ((key, fallback) => fallback || key);
  const getCurrentMode = typeof options.getCurrentMode === 'function' ? options.getCurrentMode : (() => null);
  const getDynamicEditorTabs = typeof options.getDynamicEditorTabs === 'function' ? options.getDynamicEditorTabs : (() => new Map());
  const isDynamicMode = typeof options.isDynamicMode === 'function' ? options.isDynamicMode : (() => false);
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : ((value) => String(value || '').replace(/[\\]/g, '/'));
  const getAllowEditorStatePersist = typeof options.getAllowEditorStatePersist === 'function' ? options.getAllowEditorStatePersist : (() => true);
  const persistDynamicEditorState = typeof options.persistDynamicEditorState === 'function' ? options.persistDynamicEditorState : (() => {});
  const getActiveComposerFile = typeof options.getActiveComposerFile === 'function' ? options.getActiveComposerFile : (() => 'index');
  const applyComposerFile = typeof options.applyComposerFile === 'function' ? options.applyComposerFile : (() => {});
  const refreshSyncCommitPanel = typeof options.refreshSyncCommitPanel === 'function' ? options.refreshSyncCommitPanel : (() => {});
  const applyMode = typeof options.applyMode === 'function' ? options.applyMode : (() => {});

  let editorRailResizeBound = false;
  let editorMobileRailBound = false;
  let editorStatePersistTimer = 0;
  let editorStateScrollBound = false;
  let editorContentScrollByKey = {};

  const EDITOR_RAIL_WIDTH_KEY = 'press_editor_rail_width';
  const EDITOR_RAIL_DEFAULT_WIDTH = 340;
  const EDITOR_RAIL_MIN_WIDTH = 280;
  const EDITOR_RAIL_MAX_WIDTH = 520;
  const EDITOR_SCROLL_SAVE_DELAY = 120;

  function getEditorContentPane() {
    try { return documentRef ? documentRef.getElementById('editorContentPane') : null; }
    catch (_) { return null; }
  }

  function normalizeEditorScrollTop(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.round(numeric));
  }

  function normalizeEditorScrollMap(value) {
    const out = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
    Object.entries(value).forEach(([key, top]) => {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) return;
      out[normalizedKey] = normalizeEditorScrollTop(top);
    });
    return out;
  }

  function setEditorContentScrollByKey(value) {
    editorContentScrollByKey = normalizeEditorScrollMap(value);
  }

  function getEditorContentScrollSnapshot() {
    return { ...editorContentScrollByKey };
  }

  function getEditorRailScrollElement() {
    try { return documentRef ? documentRef.querySelector('.editor-rail-tree-scroll') : null; }
    catch (_) { return null; }
  }

  function getEditorRailScrollTop() {
    const rail = getEditorRailScrollElement();
    try { return rail ? normalizeEditorScrollTop(rail.scrollTop || 0) : 0; }
    catch (_) { return 0; }
  }

  function setEditorRailScrollTop(top) {
    const rail = getEditorRailScrollElement();
    if (!rail) return;
    try { rail.scrollTop = normalizeEditorScrollTop(top); } catch (_) {}
  }

  function getEditorContentScrollKey(mode = getCurrentMode()) {
    if (mode && isDynamicMode(mode)) {
      const dynamicEditorTabs = getDynamicEditorTabs();
      const tab = dynamicEditorTabs && typeof dynamicEditorTabs.get === 'function'
        ? dynamicEditorTabs.get(mode)
        : null;
      const path = tab && tab.path ? normalizeRelPath(tab.path) : '';
      return path ? `markdown:${path}` : 'markdown';
    }
    if (mode === 'composer') return 'composer';
    if (mode === 'themes') return 'themes';
    if (mode === 'updates') return 'updates';
    if (mode === 'sync') return 'sync';
    return 'structure';
  }

  function getEditorContentScrollElement(mode = getCurrentMode()) {
    try {
      if (documentRef && mode === 'composer') {
        const siteViewport = documentRef.querySelector('#composerSite .cs-viewport');
        if (siteViewport && siteViewport.getClientRects && siteViewport.getClientRects().length) {
          return siteViewport;
        }
      }
    } catch (_) {}
    return getEditorContentPane();
  }

  function getEditorContentScrollTop(mode = getCurrentMode()) {
    const scroller = getEditorContentScrollElement(mode);
    try { return scroller ? normalizeEditorScrollTop(scroller.scrollTop || 0) : 0; }
    catch (_) { return 0; }
  }

  function setEditorContentScrollTopForMode(mode, top) {
    const scroller = getEditorContentScrollElement(mode);
    if (!scroller) return false;
    try {
      scroller.scrollTop = normalizeEditorScrollTop(top);
      return true;
    } catch (_) {
      return false;
    }
  }

  function captureEditorContentScroll(mode = getCurrentMode()) {
    const key = getEditorContentScrollKey(mode);
    if (!key) return;
    editorContentScrollByKey[key] = getEditorContentScrollTop(mode);
  }

  function restoreEditorContentScrollForMode(mode = getCurrentMode()) {
    const key = getEditorContentScrollKey(mode);
    if (!key || !Object.prototype.hasOwnProperty.call(editorContentScrollByKey, key)) return;
    const top = editorContentScrollByKey[key];
    const apply = () => setEditorContentScrollTopForMode(mode, top);
    try {
      const raf = windowRef && typeof windowRef.requestAnimationFrame === 'function'
        ? windowRef.requestAnimationFrame.bind(windowRef)
        : requestAnimationFrame;
      raf(() => raf(apply));
    } catch (_) {
      setTimeout(apply, 0);
    }
  }

  function scrollEditorContentToTop(behavior = 'smooth') {
    const currentMode = getCurrentMode();
    const pane = getEditorContentScrollElement(currentMode) || getEditorContentPane();
    if (pane && typeof pane.scrollTo === 'function') {
      try {
        pane.scrollTo({ top: 0, behavior });
        captureEditorContentScroll(currentMode);
        return;
      } catch (_) {
        try {
          pane.scrollTop = 0;
          captureEditorContentScroll(currentMode);
          return;
        } catch (__) {}
      }
    }
    if (windowRef && typeof windowRef.scrollTo === 'function') {
      try { windowRef.scrollTo({ top: 0, behavior }); }
      catch (_) { try { windowRef.scrollTo(0, 0); } catch (__) {} }
    }
  }

  function persistSystemTreeExpandedState() {
    if (!editorSessionStateStore || typeof editorSessionStateStore.writeLegacySystemTreeExpanded !== 'function') return;
    editorSessionStateStore.writeLegacySystemTreeExpanded(expandedEditorTreeNodeIds.has('system'));
  }

  function scheduleEditorStatePersist() {
    if (!getAllowEditorStatePersist()) return;
    try {
      if (editorStatePersistTimer && windowRef) windowRef.clearTimeout(editorStatePersistTimer);
      editorStatePersistTimer = windowRef
        ? windowRef.setTimeout(() => {
          editorStatePersistTimer = 0;
          persistDynamicEditorState();
        }, EDITOR_SCROLL_SAVE_DELAY)
        : setTimeout(() => {
          editorStatePersistTimer = 0;
          persistDynamicEditorState();
        }, EDITOR_SCROLL_SAVE_DELAY);
    } catch (_) {
      persistDynamicEditorState();
    }
  }

  function bindEditorStatePersistenceListeners() {
    if (editorStateScrollBound || !documentRef) return;
    editorStateScrollBound = true;
    const onScroll = (event) => {
      const target = event && event.target;
      try {
        if (target === getEditorRailScrollElement()) {
          scheduleEditorStatePersist();
          return;
        }
        const currentMode = getCurrentMode();
        if (target === getEditorContentPane() || target === getEditorContentScrollElement(currentMode)) {
          captureEditorContentScroll(currentMode);
          scheduleEditorStatePersist();
        }
      } catch (_) {}
    };
    try { documentRef.addEventListener('scroll', onScroll, true); } catch (_) {}
    try {
      if (windowRef) windowRef.addEventListener('pagehide', () => persistDynamicEditorState());
    } catch (_) {}
    try {
      documentRef.addEventListener('visibilitychange', () => {
        if (documentRef.visibilityState === 'hidden') persistDynamicEditorState();
      });
    } catch (_) {}
  }

  function mountEditorSystemPanels() {
    if (!documentRef) return;
    const body = documentRef.getElementById('editorSystemBody');
    if (!body || body.__pressSystemPanelsMounted) return;
    body.__pressSystemPanelsMounted = true;
    const composerPanel = documentRef.getElementById('mode-composer');
    const themesPanel = documentRef.getElementById('mode-themes');
    const updatesPanel = documentRef.getElementById('mode-updates');
    let syncPanel = documentRef.getElementById('mode-sync');
    if (!syncPanel) {
      syncPanel = documentRef.createElement('div');
      syncPanel.id = 'mode-sync';
      syncPanel.className = 'sync-layout editor-overlay-panel';
      syncPanel.hidden = true;
      syncPanel.setAttribute('aria-hidden', 'true');
    }
    if (composerPanel) body.appendChild(composerPanel);
    if (themesPanel) body.appendChild(themesPanel);
    if (updatesPanel) body.appendChild(updatesPanel);
    if (syncPanel) body.appendChild(syncPanel);
  }

  function setEditorSystemPanelVisible(visible) {
    if (!documentRef) return;
    const panel = documentRef.getElementById('editorSystemPanel');
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

  function animateEditorSystemPanelContent() {
    animateSystemPanelContent({ windowRef, documentRef });
  }

  function resetSiteSettingsNavOnOpen() {
    if (!documentRef) return;
    const root = documentRef.getElementById('composerSite');
    if (!root) return;
    try {
      const viewport = root.querySelector('.cs-viewport');
      if (viewport) viewport.scrollTop = 0;
    } catch (_) {}
    try {
      const modalBody = typeof root.closest === 'function' ? root.closest('.editor-modal-body') : null;
      if (modalBody) modalBody.scrollTop = 0;
    } catch (_) {}
    const firstSectionId = (() => {
      try { return String(root.__pressSiteFirstSectionId || '').trim(); }
      catch (_) { return ''; }
    })();
    const setActive = (() => {
      try { return typeof root.__pressSiteNavSetActive === 'function' ? root.__pressSiteNavSetActive : null; }
      catch (_) { return null; }
    })();
    if (!firstSectionId || !setActive) return;
    const activateFirst = () => {
      try {
        setActive(firstSectionId, {
          focusPanel: false,
          scrollViewport: false,
          skipScrollLock: true
        });
      } catch (_) {}
    };
    activateFirst();
    try {
      const raf = windowRef && typeof windowRef.requestAnimationFrame === 'function'
        ? windowRef.requestAnimationFrame.bind(windowRef)
        : requestAnimationFrame;
      raf(() => raf(activateFirst));
    } catch (_) {
      activateFirst();
    }
  }

  function showEditorSystemPanel(mode) {
    return showComposerSystemPanel(mode, {
      documentRef,
      treeText,
      mountEditorSystemPanels,
      setEditorSystemPanelVisible,
      getActiveComposerFile,
      applyComposerFile,
      resetSiteSettingsNavOnOpen,
      refreshSyncCommitPanel,
      animatePanel: animateEditorSystemPanelContent
    });
  }

  function syncEditorOverlayUi() {
    if (!documentRef) return;
    const layer = documentRef.getElementById('editorModalLayer');
    const dialog = documentRef.querySelector('.editor-modal-dialog');
    const title = documentRef.getElementById('editorModalTitle');
    const modalBody = documentRef.querySelector('.editor-modal-body');
    if (layer) {
      layer.hidden = true;
      layer.setAttribute('aria-hidden', 'true');
    }
    if (title) title.textContent = '';
    if (dialog) dialog.removeAttribute('aria-label');
    if (modalBody) {
      modalBody.classList.remove('is-composer-overlay');
      modalBody.classList.remove('is-updates-overlay');
    }

    try {
      documentRef.body.classList.toggle('press-editor-modal-open', false);
    } catch (_) {}
  }

  function openEditorOverlay(mode, trigger = null) {
    const nextMode = mode === 'updates' ? 'updates' : (mode === 'themes' ? 'themes' : mode === 'composer' ? 'composer' : null);
    if (!nextMode) return;
    applyMode(nextMode, { trigger });
  }

  function initEditorOverlay() {
    if (!documentRef) return;
    syncEditorOverlayUi();
  }

  function computeEditorRailMaxWidth() {
    let viewportLimit = EDITOR_RAIL_MAX_WIDTH;
    try {
      if (windowRef && Number.isFinite(windowRef.innerWidth)) {
        viewportLimit = Math.min(EDITOR_RAIL_MAX_WIDTH, windowRef.innerWidth * 0.46);
      }
    } catch (_) {}
    return Math.max(EDITOR_RAIL_MIN_WIDTH, viewportLimit);
  }

  function clampEditorRailWidth(value) {
    const numeric = Number(value);
    const fallback = EDITOR_RAIL_DEFAULT_WIDTH;
    const width = Number.isFinite(numeric) ? numeric : fallback;
    return Math.max(EDITOR_RAIL_MIN_WIDTH, Math.min(computeEditorRailMaxWidth(), width));
  }

  function setEditorRailWidth(value, options = {}) {
    const width = clampEditorRailWidth(value);
    try {
      if (documentRef) documentRef.documentElement.style.setProperty('--editor-rail-width', `${Math.round(width)}px`);
    } catch (_) {}
    const resizer = documentRef ? documentRef.getElementById('editorRailResizer') : null;
    if (resizer) {
      resizer.setAttribute('aria-valuemin', String(EDITOR_RAIL_MIN_WIDTH));
      resizer.setAttribute('aria-valuemax', String(Math.round(computeEditorRailMaxWidth())));
      resizer.setAttribute('aria-valuenow', String(Math.round(width)));
    }
    if (options.persist && editorSessionStateStore && typeof editorSessionStateStore.writeUnscopedNumber === 'function') {
      editorSessionStateStore.writeUnscopedNumber(EDITOR_RAIL_WIDTH_KEY, width);
    }
    return width;
  }

  function initEditorRailResize() {
    if (editorRailResizeBound || !documentRef) return;
    const resizer = documentRef.getElementById('editorRailResizer');
    const shell = documentRef.getElementById('editorAppShell');
    if (!resizer || !shell) return;
    editorRailResizeBound = true;

    let stored = EDITOR_RAIL_DEFAULT_WIDTH;
    if (editorSessionStateStore && typeof editorSessionStateStore.readUnscopedNumber === 'function') {
      stored = editorSessionStateStore.readUnscopedNumber(EDITOR_RAIL_WIDTH_KEY, EDITOR_RAIL_DEFAULT_WIDTH);
    }
    setEditorRailWidth(stored, { persist: false });

    const isMobile = () => {
      try {
        return !!(windowRef && windowRef.matchMedia && windowRef.matchMedia('(max-width: 820px)').matches);
      } catch (_) {
        return false;
      }
    };

    let dragState = null;
    const finishDrag = () => {
      if (!dragState) return;
      const width = dragState.width;
      dragState = null;
      shell.classList.remove('is-resizing-rail');
      try { documentRef.body.style.removeProperty('cursor'); } catch (_) {}
      setEditorRailWidth(width, { persist: true });
      documentRef.removeEventListener('pointermove', onMove);
      documentRef.removeEventListener('pointerup', finishDrag);
      documentRef.removeEventListener('pointercancel', finishDrag);
    };
    const onMove = (event) => {
      if (!dragState || isMobile()) return;
      const delta = Number(event.clientX) - dragState.startX;
      dragState.width = setEditorRailWidth(dragState.startWidth + delta, { persist: false });
    };

    resizer.addEventListener('pointerdown', (event) => {
      if (isMobile()) return;
      event.preventDefault();
      dragState = {
        startX: Number(event.clientX) || 0,
        startWidth: setEditorRailWidth(resizer.getAttribute('aria-valuenow') || EDITOR_RAIL_DEFAULT_WIDTH, { persist: false }),
        width: EDITOR_RAIL_DEFAULT_WIDTH
      };
      dragState.width = dragState.startWidth;
      shell.classList.add('is-resizing-rail');
      try { documentRef.body.style.cursor = 'col-resize'; } catch (_) {}
      documentRef.addEventListener('pointermove', onMove);
      documentRef.addEventListener('pointerup', finishDrag);
      documentRef.addEventListener('pointercancel', finishDrag);
    });

    resizer.addEventListener('keydown', (event) => {
      if (isMobile()) return;
      let delta = 0;
      if (event.key === 'ArrowLeft') delta = -16;
      else if (event.key === 'ArrowRight') delta = 16;
      else if (event.key === 'Home') {
        event.preventDefault();
        setEditorRailWidth(EDITOR_RAIL_DEFAULT_WIDTH, { persist: true });
        return;
      } else {
        return;
      }
      event.preventDefault();
      const current = Number(resizer.getAttribute('aria-valuenow')) || EDITOR_RAIL_DEFAULT_WIDTH;
      setEditorRailWidth(current + delta, { persist: true });
    });

    if (windowRef) {
      windowRef.addEventListener('resize', () => {
        const current = Number(resizer.getAttribute('aria-valuenow')) || EDITOR_RAIL_DEFAULT_WIDTH;
        setEditorRailWidth(current, { persist: false });
      });
    }
  }

  function isEditorMobileRailLayout() {
    try {
      return !!(windowRef && windowRef.matchMedia && windowRef.matchMedia('(max-width: 820px)').matches);
    } catch (_) {
      return false;
    }
  }

  function getEditorRailToggles() {
    if (!documentRef) return [];
    return Array.from(documentRef.querySelectorAll('[data-editor-rail-toggle]'));
  }

  function setEditorRailOpen(open) {
    if (!documentRef) return;
    const shell = documentRef.getElementById('editorAppShell');
    const toggles = getEditorRailToggles();
    const scrim = documentRef.getElementById('editorRailScrim');
    if (!shell) return;
    const shouldOpen = !!open && isEditorMobileRailLayout();
    shell.classList.toggle('is-rail-open', shouldOpen);
    toggles.forEach((toggle) => {
      toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    });
    if (scrim) {
      scrim.hidden = !shouldOpen;
      scrim.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    }
  }

  function closeEditorRailDrawer() {
    setEditorRailOpen(false);
  }

  function initMobileEditorRail() {
    if (editorMobileRailBound || !documentRef) return;
    const toggles = getEditorRailToggles();
    const scrim = documentRef.getElementById('editorRailScrim');
    if (!toggles.length) return;
    editorMobileRailBound = true;
    toggles.forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const shell = documentRef.getElementById('editorAppShell');
        const isOpen = !!(shell && shell.classList.contains('is-rail-open'));
        setEditorRailOpen(!isOpen);
      });
    });
    if (scrim) scrim.addEventListener('click', closeEditorRailDrawer);
    documentRef.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeEditorRailDrawer();
    });
    if (windowRef) {
      windowRef.addEventListener('resize', () => {
        if (!isEditorMobileRailLayout()) closeEditorRailDrawer();
      });
    }
  }

  return {
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
  };
}
