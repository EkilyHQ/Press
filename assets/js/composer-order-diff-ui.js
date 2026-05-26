import { createComposerDiffReviewViews } from './composer-diff-review-views.js';
import { createComposerOrderPreview } from './composer-order-preview.js';
import { createComposerOrderReviewView } from './composer-order-review-view.js';
import { createComposerOrderVisual } from './composer-order-visual.js';

function noop() {}

function normalizeOrderKind(kind) {
  return kind === 'tabs' ? 'tabs' : 'index';
}

export function createComposerOrderDiffUi(options = {}) {
  const documentRef = options.documentRef || null;
  const tComposer = typeof options.tComposer === 'function' ? options.tComposer : (suffix) => suffix;
  const tComposerDiff = typeof options.tComposerDiff === 'function' ? options.tComposerDiff : (suffix) => suffix;
  const truncateText = typeof options.truncateText === 'function' ? options.truncateText : (value) => String(value || '');
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => null;
  const getRemoteBaseline = typeof options.getRemoteBaseline === 'function' ? options.getRemoteBaseline : () => ({ index: null, tabs: null });
  const getComposerDiff = typeof options.getComposerDiff === 'function' ? options.getComposerDiff : () => null;
  const recomputeDiff = typeof options.recomputeDiff === 'function' ? options.recomputeDiff : () => null;
  const computeOrderDiffDetails = typeof options.computeOrderDiffDetails === 'function' ? options.computeOrderDiffDetails : () => ({ beforeEntries: [], afterEntries: [], connectors: [], stats: { moved: 0, added: 0, removed: 0 } });
  const buildEntryDiffBadges = typeof options.buildEntryDiffBadges === 'function' ? options.buildEntryDiffBadges : () => '';
  const renderOrderStatsChips = typeof options.renderOrderStatsChips === 'function' ? options.renderOrderStatsChips : () => {};
  const renderComposerInlineSummary = typeof options.renderComposerInlineSummary === 'function' ? options.renderComposerInlineSummary : () => {};
  const captureElementRect = typeof options.captureElementRect === 'function' ? options.captureElementRect : () => null;
  const animateComposerListTransition = typeof options.animateListTransition === 'function' ? options.animateListTransition : () => {};
  const cancelComposerOrderMainTransition = typeof options.cancelOrderMainTransition === 'function' ? options.cancelOrderMainTransition : () => {};
  const animateComposerOrderMainReset = typeof options.animateOrderMainReset === 'function' ? options.animateOrderMainReset : () => {};
  const animateComposerInlineVisibility = typeof options.animateInlineVisibility === 'function' ? options.animateInlineVisibility : () => {};
  const cssEscape = typeof options.cssEscape === 'function'
    ? options.cssEscape
    : (value) => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const getComposerViewTransition = typeof options.getComposerViewTransition === 'function' ? options.getComposerViewTransition : () => null;
  const getSlideDurations = typeof options.getSlideDurations === 'function' ? options.getSlideDurations : () => ({ open: 420, close: 360 });
  const setTimeoutRef = typeof options.setTimeoutRef === 'function'
    ? options.setTimeoutRef
    : () => null;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function'
    ? options.clearTimeoutRef
    : noop;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function'
    ? options.requestAnimationFrameRef
    : () => null;
  const cancelAnimationFrameRef = typeof options.cancelAnimationFrameRef === 'function'
    ? options.cancelAnimationFrameRef
    : noop;
  const addWindowListener = typeof options.addWindowListener === 'function'
    ? options.addWindowListener
    : () => noop;
  const addDocumentListener = typeof options.addDocumentListener === 'function'
    ? options.addDocumentListener
    : () => noop;
  const matchesMedia = typeof options.matchesMedia === 'function'
    ? options.matchesMedia
    : () => false;
  const getComputedStyleRef = typeof options.getComputedStyleRef === 'function'
    ? options.getComputedStyleRef
    : () => null;
  const ResizeObserverRef = typeof options.ResizeObserverRef === 'function'
    ? options.ResizeObserverRef
    : null;
  const consoleRef = options.consoleRef || null;

  function warn(...args) {
    try {
      if (consoleRef && typeof consoleRef.warn === 'function') consoleRef.warn(...args);
    } catch (_) {}
  }

  let composerDiffModal = null;
  let composerDiffResizeHandler = null;
  let composerDiffResizeDispose = null;

  function openComposerDiffModal(kind, initialTab = 'overview') {
    try {
      const modal = ensureComposerDiffModal();
      modal.open(kind, initialTab);
    } catch (err) {
      warn('Composer: failed to open composer diff modal', err);
    }
  }

  function openOrderDiffModal(kind) {
    openComposerDiffModal(kind, 'order');
  }

  const composerOrderVisual = createComposerOrderVisual({
    documentRef,
    tComposerDiff,
    getComputedStyleRef
  });
  const composerOrderPreview = createComposerOrderPreview({
    documentRef,
    tComposer,
    tComposerDiff,
    getComposerDiff,
    recomputeDiff,
    computeOrderDiffDetails,
    renderComposerInlineSummary,
    captureElementRect,
    animateListTransition: animateComposerListTransition,
    cancelOrderMainTransition: cancelComposerOrderMainTransition,
    animateOrderMainReset: animateComposerOrderMainReset,
    animateInlineVisibility: animateComposerInlineVisibility,
    cssEscape,
    getComposerViewTransition,
    getSlideDurations,
    setTimeoutRef,
    clearTimeoutRef,
    requestAnimationFrameRef,
    cancelAnimationFrameRef,
    addWindowListener,
    ResizeObserverRef,
    openComposerDiffModal,
    orderVisual: composerOrderVisual
  });
  const composerDiffReviewViews = createComposerDiffReviewViews({
    documentRef,
    tComposerDiff,
    truncateText,
    getStateSlice,
    getRemoteBaseline,
    buildEntryDiffBadges
  });
  const {
    renderOverview,
    renderEntries
  } = composerDiffReviewViews;
  const composerOrderReviewView = createComposerOrderReviewView({
    documentRef,
    tComposerDiff,
    computeOrderDiffDetails,
    renderOrderStatsChips,
    requestAnimationFrameRef,
    setTimeoutRef,
    orderVisual: composerOrderVisual
  });


  function ensureComposerDiffModal() {
    if (composerDiffModal) return composerDiffModal;

    const modal = documentRef.createElement('div');
    modal.id = 'composerOrderModal';
    modal.className = 'press-modal composer-order-modal composer-diff-modal';

    const dialog = documentRef.createElement('div');
    dialog.className = 'press-modal-dialog composer-order-dialog composer-diff-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const head = documentRef.createElement('div');
    head.className = 'composer-order-head';
    const title = documentRef.createElement('h2');
    title.id = 'composerOrderTitle';
    title.textContent = tComposerDiff('heading');
    const subtitle = documentRef.createElement('p');
    subtitle.className = 'composer-order-subtitle';
    subtitle.textContent = tComposerDiff('subtitle.default');
    const closeBtn = documentRef.createElement('button');
    closeBtn.className = 'press-modal-close btn-secondary composer-order-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', tComposerDiff('close'));
    closeBtn.textContent = tComposerDiff('close');
    head.appendChild(title);
    head.appendChild(subtitle);
    head.appendChild(closeBtn);

    const tabsWrap = documentRef.createElement('div');
    tabsWrap.className = 'composer-diff-tabs';
    tabsWrap.setAttribute('role', 'tablist');

    const tabDefs = [
      { id: 'overview', labelKey: 'tabs.overview' },
      { id: 'entries', labelKey: 'tabs.entries' },
      { id: 'order', labelKey: 'tabs.order' }
    ];
    const tabDefsById = new Map();
    tabDefs.forEach(def => { tabDefsById.set(def.id, def); });
    const tabButtons = new Map();
    const tabPanels = new Map();

    function handleTabKeydown(ev, currentId) {
      if (!tabDefs.length) return;
      let nextIndex = -1;
      const currentIndex = tabDefs.findIndex(def => def.id === currentId);
      if (ev.key === 'ArrowLeft') {
        nextIndex = (currentIndex <= 0 ? tabDefs.length - 1 : currentIndex - 1);
      } else if (ev.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabDefs.length;
      } else if (ev.key === 'Home') {
        nextIndex = 0;
      } else if (ev.key === 'End') {
        nextIndex = tabDefs.length - 1;
      } else {
        return;
      }
      ev.preventDefault();
      const nextId = tabDefs[nextIndex] && tabDefs[nextIndex].id;
      if (!nextId) return;
      setActiveTab(nextId);
      const btn = tabButtons.get(nextId);
      if (btn) btn.focus();
    }

    tabDefs.forEach((tab, index) => {
      const btn = documentRef.createElement('button');
      btn.type = 'button';
      btn.className = 'composer-diff-tab';
      btn.textContent = tComposerDiff(tab.labelKey);
      btn.dataset.i18nKey = tab.labelKey;
      btn.dataset.tab = tab.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      btn.setAttribute('tabindex', index === 0 ? '0' : '-1');
      btn.addEventListener('click', () => setActiveTab(tab.id));
      btn.addEventListener('keydown', (ev) => handleTabKeydown(ev, tab.id));
      tabButtons.set(tab.id, btn);
      tabsWrap.appendChild(btn);
    });

    const viewsWrap = documentRef.createElement('div');
    viewsWrap.className = 'composer-diff-views';

    function createView(id, extraClass) {
      const view = documentRef.createElement('section');
      view.className = `composer-diff-view ${extraClass}`;
      view.dataset.view = id;
      view.setAttribute('role', 'tabpanel');
      view.setAttribute('tabindex', '0');
      if (id !== 'overview') {
        view.hidden = true;
        view.style.display = 'none';
        view.setAttribute('aria-hidden', 'true');
      } else {
        view.style.display = '';
        view.setAttribute('aria-hidden', 'false');
      }
      tabPanels.set(id, view);
      viewsWrap.appendChild(view);
      return view;
    }

    const viewOverview = createView('overview', 'composer-diff-view-overview');
    const viewEntries = createView('entries', 'composer-diff-view-entries');
    const viewOrder = createView('order', 'composer-diff-view-order');

    const orderViewElements = composerOrderReviewView.mount(viewOrder) || {};

    dialog.setAttribute('aria-labelledby', title.id);
    dialog.appendChild(head);
    dialog.appendChild(tabsWrap);
    dialog.appendChild(viewsWrap);

    modal.appendChild(dialog);
    documentRef.body.appendChild(modal);

    const focusableSelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lastActive = null;
    let activeTab = 'overview';
    let activeKind = 'index';
    let activeDiff = null;

    const subtitleKeys = {
      overview: 'subtitle.overview',
      entries: 'subtitle.entries',
      order: 'subtitle.order'
    };

    function prefersReducedMotion() {
      return matchesMedia('(prefers-reduced-motion: reduce)');
    }

    function closeModal() {
      if (composerDiffResizeHandler) {
        try { composerDiffResizeDispose && composerDiffResizeDispose(); } catch (_) {}
        composerDiffResizeHandler = null;
        composerDiffResizeDispose = null;
      }
      composerOrderReviewView.clear();
      activeDiff = null;
      const reduce = prefersReducedMotion();
      if (reduce) {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        documentRef.body.classList.remove('press-modal-open');
        try { lastActive && lastActive.focus(); } catch (_) {}
        return;
      }
      try { modal.classList.remove('press-anim-in'); } catch (_) {}
      try { modal.classList.add('press-anim-out'); } catch (_) {}
      const finish = () => {
        try { modal.classList.remove('press-anim-out'); } catch (_) {}
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        documentRef.body.classList.remove('press-modal-open');
        try { lastActive && lastActive.focus(); } catch (_) {}
      };
      try {
        const onEnd = () => { dialog.removeEventListener('animationend', onEnd); finish(); };
        dialog.addEventListener('animationend', onEnd, { once: true });
        setTimeoutRef(finish, 220);
      } catch (_) {
        finish();
      }
    }

    function updateSubtitle(tabId) {
      const key = subtitleKeys[tabId] || subtitleKeys.overview;
      subtitle.textContent = tComposerDiff(key);
    }

    function setActiveTab(tabId) {
      if (!tabButtons.has(tabId)) tabId = 'overview';
      activeTab = tabId;
      tabButtons.forEach((btn, id) => {
        const selected = id === tabId;
        btn.classList.toggle('is-active', selected);
        btn.setAttribute('aria-selected', selected ? 'true' : 'false');
        btn.setAttribute('tabindex', selected ? '0' : '-1');
      });
      tabPanels.forEach((panel, id) => {
        const visible = id === tabId;
        panel.hidden = !visible;
        panel.style.display = visible ? '' : 'none';
        panel.classList.toggle('is-active', visible);
        panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
      updateSubtitle(tabId);
      if (tabId === 'order') {
        renderOrder(activeKind);
        if (!composerDiffResizeHandler) {
          composerDiffResizeHandler = () => drawOrderDiffLines();
          composerDiffResizeDispose = addWindowListener('resize', composerDiffResizeHandler);
        }
        requestAnimationFrameRef(() => drawOrderDiffLines());
        setTimeoutRef(drawOrderDiffLines, 140);
      } else if (composerDiffResizeHandler) {
        try { composerDiffResizeDispose && composerDiffResizeDispose(); } catch (_) {}
        composerDiffResizeHandler = null;
        composerDiffResizeDispose = null;
        composerOrderReviewView.clear();
      }
    }

    function renderOrder(kind) {
      const label = kind === 'tabs' ? 'tabs.yaml' : 'index.yaml';
      title.textContent = tComposerDiff('title', { label });
      composerOrderReviewView.render(kind, { layout: activeTab === 'order' });
    }

    function openModal(kind, initialTab = 'overview') {
      lastActive = documentRef.activeElement;
      const reduce = prefersReducedMotion();
      try { modal.classList.remove('press-anim-out'); } catch (_) {}
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      documentRef.body.classList.add('press-modal-open');
      if (!reduce) {
        try {
          modal.classList.add('press-anim-in');
          const onEnd = () => { dialog.removeEventListener('animationend', onEnd); try { modal.classList.remove('press-anim-in'); } catch (_) {}; };
          dialog.addEventListener('animationend', onEnd, { once: true });
        } catch (_) {}
      }
      const safeKind = kind === 'tabs' ? 'tabs' : 'index';
      activeKind = safeKind;
      const label = safeKind === 'tabs' ? 'tabs.yaml' : 'index.yaml';
      title.textContent = tComposerDiff('title', { label });
      activeDiff = getComposerDiff(safeKind) || recomputeDiff(safeKind);
      renderOverview(viewOverview, activeDiff);
      renderEntries(viewEntries, safeKind, activeDiff);
      renderOrder(safeKind);
      const targetTab = tabButtons.has(initialTab) ? initialTab : 'overview';
      setActiveTab(targetTab);
      setTimeoutRef(() => {
        try { closeBtn.focus(); } catch (_) {}
      }, 0);
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('mousedown', (ev) => { if (ev.target === modal) closeModal(); });
    modal.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); closeModal(); return; }
      if (ev.key === 'Tab') {
        const focusables = Array.from(dialog.querySelectorAll(focusableSelector))
          .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (ev.shiftKey && documentRef.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && documentRef.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    });

    composerDiffModal = {
      open: openModal,
      close: closeModal,
      activate: setActiveTab,
      getActiveKind: () => activeKind,
      isOpen: () => modal.classList.contains('is-open') && modal.getAttribute('aria-hidden') !== 'true',
      modal,
      dialog,
      title,
      subtitle,
      views: { overview: viewOverview, entries: viewEntries, order: viewOrder },
      statsWrap: orderViewElements.statsWrap || null,
      beforeList: orderViewElements.beforeList || null,
      afterList: orderViewElements.afterList || null,
      svg: orderViewElements.svg || null,
      emptyNotice: orderViewElements.emptyNotice || null,
      tabsWrap
    };

    const refreshLocale = () => {
      title.textContent = tComposerDiff('heading');
      subtitle.textContent = tComposerDiff(subtitleKeys[activeTab] || subtitleKeys.overview);
      closeBtn.textContent = tComposerDiff('close');
      closeBtn.setAttribute('aria-label', tComposerDiff('close'));
      composerOrderReviewView.refreshLocale();
      tabButtons.forEach((btn, id) => {
        const def = tabDefsById.get(id);
        if (!btn || !def) return;
        btn.textContent = tComposerDiff(def.labelKey);
      });
    };
    if (!modal.__pressLangBound) {
      modal.__pressLangBound = true;
      modal.__pressLangDispose = addDocumentListener('press-editor-language-applied', refreshLocale);
    }

    return composerDiffModal;
  }

  function drawOrderDiffLines(state) {
    if (state && typeof state === 'object' && state.container) {
      composerOrderVisual.drawOrderDiffLines(state);
      return;
    }
    composerOrderReviewView.drawLines();
  }

  function closeComposerDiffModalForKind(kind) {
    const modal = composerDiffModal;
    const safeKind = normalizeOrderKind(kind);
    const matchesKind = modal && typeof modal.getActiveKind === 'function'
      ? modal.getActiveKind() === safeKind
      : true;
    const isOpen = modal && modal.modal && modal.modal.classList
      ? (modal.modal.classList.contains('is-open') && modal.modal.getAttribute('aria-hidden') !== 'true')
      : false;
    if (modal && typeof modal.close === 'function' && matchesKind && isOpen) {
      try { modal.close(); } catch (_) {}
    }
  }

  return {
    openComposerDiffModal,
    openOrderDiffModal,
    scheduleComposerOrderPreviewRelayout: composerOrderPreview.scheduleComposerOrderPreviewRelayout,
    updateComposerOrderPreview: composerOrderPreview.updateComposerOrderPreview,
    setComposerOrderPreviewActiveKind: composerOrderPreview.setComposerOrderPreviewActiveKind,
    getComposerOrderPreviewActiveKind: composerOrderPreview.getComposerOrderPreviewActiveKind,
    closeComposerDiffModalForKind
  };
}
