import { EDITOR_SHELL_IDS } from './editor-shell-contract.js';

function noop() {}

function normalizeOrderKind(kind) {
  return kind === 'tabs' ? 'tabs' : 'index';
}

export function createComposerOrderPreview(options = {}) {
  const documentRef = options.documentRef || null;
  const tComposer = typeof options.tComposer === 'function' ? options.tComposer : (suffix) => suffix;
  const tComposerDiff = typeof options.tComposerDiff === 'function' ? options.tComposerDiff : (suffix) => suffix;
  const getComposerDiff = typeof options.getComposerDiff === 'function' ? options.getComposerDiff : () => null;
  const recomputeDiff = typeof options.recomputeDiff === 'function' ? options.recomputeDiff : () => null;
  const computeOrderDiffDetails = typeof options.computeOrderDiffDetails === 'function'
    ? options.computeOrderDiffDetails
    : () => ({ beforeEntries: [], afterEntries: [], connectors: [], stats: { moved: 0, added: 0, removed: 0 } });
  const renderComposerInlineSummary = typeof options.renderComposerInlineSummary === 'function'
    ? options.renderComposerInlineSummary
    : noop;
  const captureElementRect = typeof options.captureElementRect === 'function' ? options.captureElementRect : () => null;
  const animateComposerListTransition = typeof options.animateListTransition === 'function'
    ? options.animateListTransition
    : noop;
  const cancelComposerOrderMainTransition = typeof options.cancelOrderMainTransition === 'function'
    ? options.cancelOrderMainTransition
    : noop;
  const animateComposerOrderMainReset = typeof options.animateOrderMainReset === 'function'
    ? options.animateOrderMainReset
    : noop;
  const animateComposerInlineVisibility = typeof options.animateInlineVisibility === 'function'
    ? options.animateInlineVisibility
    : noop;
  const cssEscape = typeof options.cssEscape === 'function'
    ? options.cssEscape
    : (value) => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const getComposerViewTransition = typeof options.getComposerViewTransition === 'function'
    ? options.getComposerViewTransition
    : () => null;
  const getSlideDurations = typeof options.getSlideDurations === 'function'
    ? options.getSlideDurations
    : () => ({ open: 420, close: 360 });
  const setTimeoutRef = typeof options.setTimeoutRef === 'function' ? options.setTimeoutRef : () => null;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function' ? options.clearTimeoutRef : noop;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function'
    ? options.requestAnimationFrameRef
    : () => null;
  const cancelAnimationFrameRef = typeof options.cancelAnimationFrameRef === 'function'
    ? options.cancelAnimationFrameRef
    : noop;
  const addWindowListener = typeof options.addWindowListener === 'function' ? options.addWindowListener : () => noop;
  const ResizeObserverRef = typeof options.ResizeObserverRef === 'function' ? options.ResizeObserverRef : null;
  const openComposerDiffModal = typeof options.openComposerDiffModal === 'function' ? options.openComposerDiffModal : noop;
  const orderVisual = options.orderVisual && typeof options.orderVisual === 'object' ? options.orderVisual : {};
  const applyComposerOrderHover = typeof orderVisual.applyComposerOrderHover === 'function'
    ? orderVisual.applyComposerOrderHover
    : noop;
  const bindComposerOrderHover = typeof orderVisual.bindComposerOrderHover === 'function'
    ? orderVisual.bindComposerOrderHover
    : noop;
  const buildOrderDiffItem = typeof orderVisual.buildOrderDiffItem === 'function'
    ? orderVisual.buildOrderDiffItem
    : () => null;
  const drawOrderDiffLines = typeof orderVisual.drawOrderDiffLines === 'function'
    ? orderVisual.drawOrderDiffLines
    : noop;

  let composerOrderPreviewElements = { index: null, tabs: null };
  let composerOrderPreviewState = { index: null, tabs: null };
  let composerOrderPreviewActiveKind = 'index';
  let composerOrderPreviewResizeHandler = null;
  let composerOrderPreviewResizeDispose = null;
  const composerOrderPreviewRelayoutTimers = { index: null, tabs: null };

  function scheduleComposerOrderPreviewRelayout(kind) {
    const normalized = normalizeOrderKind(kind);
    const timers = composerOrderPreviewRelayoutTimers[normalized];
    if (timers) {
      if (timers.raf != null) {
        cancelAnimationFrameRef(timers.raf);
      }
      if (timers.timeout != null) {
        clearTimeoutRef(timers.timeout);
      }
    }

    const pending = { raf: null, timeout: null };
    const run = () => {
      const active = composerOrderPreviewState && composerOrderPreviewState[normalized];
      if (active) drawOrderDiffLines(active);
    };
    const finalize = () => { composerOrderPreviewRelayoutTimers[normalized] = null; };

    const durations = getSlideDurations();
    const delayBase = Math.max(durations.open, durations.close, 260) + 80;

    const scheduleTrailing = () => {
      pending.timeout = setTimeoutRef(() => {
        pending.timeout = null;
        run();
        finalize();
      }, delayBase);
    };

    const state = composerOrderPreviewState && composerOrderPreviewState[normalized];
    if (!state) {
      finalize();
      return;
    }

    pending.raf = requestAnimationFrameRef(() => {
      pending.raf = null;
      run();
      scheduleTrailing();
    });

    composerOrderPreviewRelayoutTimers[normalized] = pending;
  }

  function ensureComposerOrderPreview(kind) {
    const normalized = normalizeOrderKind(kind);
    if (!composerOrderPreviewElements) composerOrderPreviewElements = { index: null, tabs: null };
    if (composerOrderPreviewElements[normalized]) return composerOrderPreviewElements[normalized];

    const host = documentRef.querySelector(`.composer-order-host[data-kind="${normalized}"]`);
    if (!host) return null;
    const root = host.querySelector('.composer-order-inline');
    if (!root) return null;

    let svg = host.querySelector('svg.composer-order-inline-lines');
    if (!svg) {
      svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('composer-order-lines', 'composer-order-inline-lines');
      svg.setAttribute('aria-hidden', 'true');
      host.appendChild(svg);
    }

    const meta = documentRef.getElementById(EDITOR_SHELL_IDS.composerOrderInlineMeta);
    const statsWrap = meta ? meta.querySelector('.composer-order-inline-stats') : null;
    const list = root.querySelector('.composer-order-inline-list');
    const emptyNotice = root.querySelector('.composer-order-inline-empty');
    const kindLabel = meta ? meta.querySelector('.composer-order-inline-kind') : null;
    const title = meta ? meta.querySelector('.composer-order-inline-title') : null;
    const openBtn = meta ? meta.querySelector('.composer-order-inline-open') : null;

    if (openBtn && !openBtn.__pressBound) {
      openBtn.__pressBound = true;
      openBtn.addEventListener('click', () => {
        const target = openBtn.dataset && openBtn.dataset.kind ? openBtn.dataset.kind : normalized;
        openComposerDiffModal(target, 'overview');
      });
    }

    if (ResizeObserverRef && !host.__pressOrderResizeObserver) {
      try {
        const ro = new ResizeObserverRef(() => {
          const state = composerOrderPreviewState && composerOrderPreviewState[normalized];
          if (state) drawOrderDiffLines(state);
        });
        ro.observe(host);
        host.__pressOrderResizeObserver = ro;
      } catch (_) {}
    }

    if (!composerOrderPreviewResizeHandler) {
      composerOrderPreviewResizeHandler = () => {
        if (!composerOrderPreviewState) return;
        ['index', 'tabs'].forEach(key => {
          const state = composerOrderPreviewState[key];
          if (state) drawOrderDiffLines(state);
        });
      };
      composerOrderPreviewResizeDispose = addWindowListener('resize', composerOrderPreviewResizeHandler);
    }

    const preview = { host, root, list, statsWrap, emptyNotice, svg, kindLabel, openBtn, title, meta };
    composerOrderPreviewElements[normalized] = preview;
    return preview;
  }

  function observeComposerOrderRow(row, kind) {
    if (!row || !ResizeObserverRef) return;
    const normalized = normalizeOrderKind(kind);
    const existing = row.__pressOrderResize;
    if (existing && existing.kind === normalized) return;
    try {
      if (existing && existing.observer) {
        existing.observer.disconnect();
      }
    } catch (_) {}
    try {
      const observer = new ResizeObserverRef(() => {
        scheduleComposerOrderPreviewRelayout(normalized);
      });
      observer.observe(row);
      row.__pressOrderResize = { observer, kind: normalized };
    } catch (_) {}
  }

  function updateComposerOrderPreview(kind, options = {}) {
    const normalized = normalizeOrderKind(kind);
    const preview = ensureComposerOrderPreview(normalized);
    if (!preview) return;
    composerOrderPreviewActiveKind = normalized;

    const { host, root, list, statsWrap, emptyNotice, svg, kindLabel, openBtn, title, meta } = preview;
    const label = normalized === 'tabs' ? 'tabs.yaml' : 'index.yaml';
    const allowReveal = options.reveal !== false;
    const primaryList = normalized === 'tabs'
      ? documentRef.getElementById(EDITOR_SHELL_IDS.ctList)
      : documentRef.getElementById(EDITOR_SHELL_IDS.ciList);
    const primaryListRectBefore = captureElementRect(primaryList);
    let listAnimationScheduled = false;
    const collapseImmediately = !!options.collapseImmediately
      || !!(getComposerViewTransition()
        && getComposerViewTransition().panels
        && getComposerViewTransition().panels.classList.contains('is-hidden'));
    const runListAnimation = (opts = {}) => {
      if (listAnimationScheduled) return;
      listAnimationScheduled = true;
      if (!primaryList || !primaryListRectBefore) return;
      const originalOnMeasured = typeof opts.onMeasured === 'function' ? opts.onMeasured : null;
      const config = { ...opts };
      config.onMeasured = (rect) => {
        if (originalOnMeasured) {
          try {
            const result = originalOnMeasured(rect);
            if (result && typeof result === 'object') return result;
          }
          catch (_) {}
        }
        return rect;
      };
      animateComposerListTransition(primaryList, primaryListRectBefore, config);
    };
    const applyInlineActive = (value) => {
      if (!host) return;
      host.dataset.inlineActive = value ? 'true' : 'false';
    };

    if (title) title.textContent = tComposerDiff('inline.title');
    if (kindLabel) kindLabel.textContent = label;
    if (meta) meta.dataset.kind = normalized;
    if (root) {
      root.dataset.kind = normalized;
      root.setAttribute('aria-label', tComposerDiff('inline.ariaOrder', { label }));
    }
    if (host) host.dataset.kind = normalized;
    if (openBtn) {
      openBtn.dataset.kind = normalized;
      openBtn.setAttribute('aria-label', tComposerDiff('inline.openAria', { label }));
    }

    const diff = getComposerDiff(normalized) || recomputeDiff(normalized);

    const details = computeOrderDiffDetails(normalized) || {};
    const beforeEntries = Array.isArray(details.beforeEntries) ? details.beforeEntries : [];
    const afterEntries = Array.isArray(details.afterEntries) ? details.afterEntries : [];
    const connectors = Array.isArray(details.connectors) ? details.connectors : [];
    const stats = details.stats || { moved: 0, added: 0, removed: 0 };

    if (statsWrap) {
      renderComposerInlineSummary(statsWrap, diff, { orderStats: stats });
    }

    if (list) {
      list.innerHTML = '';
    }

    const leftMap = new Map();
    beforeEntries.forEach(entry => {
      const item = buildOrderDiffItem(entry, 'before');
      if (!item) return;
      item.classList.add('composer-order-inline-item');
      leftMap.set(entry.key, item);
      if (list) list.appendChild(item);
    });

    const main = host ? host.querySelector('.composer-order-main') : null;
    if (main) cancelComposerOrderMainTransition(main);
    const mainRectBefore = main ? captureElementRect(main) : null;
    const rightMap = new Map();
    if (main) {
      const selector = normalized === 'tabs' ? '.ct-item' : '.ci-item';
      afterEntries.forEach(entry => {
        if (!entry || !entry.key) return;
        const row = main.querySelector(`${selector}[data-key="${cssEscape(entry.key)}"]`);
        if (!row) return;
        rightMap.set(entry.key, row);
        bindComposerOrderHover(row, entry.key);
        observeComposerOrderRow(row, normalized);
      });
    }

    if (svg) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    const hasBaseline = leftMap.size > 0;
    const hasOrderChanges = (stats.moved || stats.added || stats.removed) > 0;
    const hasDiffChanges = !!(diff && diff.hasChanges);

    if (host) {
      const hoverState = host.__pressOrderHoverState || {};
      if (hoverState.activeLeft && !hoverState.activeLeft.isConnected) {
        try { hoverState.activeLeft.classList.remove('is-hovered'); } catch (_) {}
        hoverState.activeLeft = null;
      }
      hoverState.leftMap = leftMap;
      hoverState.rightMap = rightMap;
      hoverState.svg = svg;
      if (!hasOrderChanges) hoverState.pathMap = null;
      host.__pressOrderHoverState = hoverState;
    }

    if (emptyNotice) {
      if (!hasBaseline) {
        emptyNotice.hidden = !hasOrderChanges;
        emptyNotice.setAttribute('aria-hidden', hasOrderChanges ? 'false' : 'true');
        if (hasOrderChanges && stats.added && !hasBaseline) {
          emptyNotice.textContent = tComposerDiff('order.inlineAllNew');
        } else {
          emptyNotice.textContent = tComposer('inlineEmpty');
        }
      } else {
        emptyNotice.hidden = true;
        emptyNotice.setAttribute('aria-hidden', 'true');
      }
    }

    if (!hasDiffChanges) {
      if (meta) {
        animateComposerInlineVisibility(meta, false, collapseImmediately ? { immediate: true } : undefined);
      }
      if (host) host.dataset.state = 'clean';

      let collapseApplied = false;
      const finalizeCollapse = () => {
        if (collapseApplied) return;
        collapseApplied = true;
        applyInlineActive(false);
        animateComposerOrderMainReset(host, mainRectBefore, { immediate: collapseImmediately });
        runListAnimation({ immediate: true });
      };

      if (root) {
        root.dataset.state = 'clean';
        const collapseOptions = collapseImmediately
          ? { onFinish: finalizeCollapse, immediate: true }
          : { onFinish: finalizeCollapse };
        animateComposerInlineVisibility(root, false, collapseOptions);
      } else {
        finalizeCollapse();
      }

      if (svg) svg.style.display = 'none';
      if (host) {
        const hoverState = host.__pressOrderHoverState || {};
        hoverState.pathMap = null;
        hoverState.currentKey = '';
        host.__pressOrderHoverState = hoverState;
        applyComposerOrderHover(host, '');
      }
      composerOrderPreviewState[normalized] = null;
      return;
    }

    if (meta) {
      if (allowReveal) animateComposerInlineVisibility(meta, true);
      else meta.setAttribute('aria-hidden', meta.hidden ? 'true' : 'false');
    }

    if (host) host.dataset.state = 'changed';

    const inlineShouldShow = hasOrderChanges && allowReveal;
    if (inlineShouldShow) {
      applyInlineActive(true);
      if (root) {
        root.dataset.state = 'changed';
        animateComposerInlineVisibility(root, true);
      }
      runListAnimation();
    } else {
      let collapseApplied = false;
      const finalizeCollapse = () => {
        if (collapseApplied) return;
        collapseApplied = true;
        applyInlineActive(false);
        animateComposerOrderMainReset(host, mainRectBefore, { immediate: collapseImmediately });
        runListAnimation({ immediate: true });
      };
      if (root) {
        root.dataset.state = hasOrderChanges ? 'changed' : 'clean';
        const collapseOptions = collapseImmediately
          ? { onFinish: finalizeCollapse, immediate: true }
          : { onFinish: finalizeCollapse };
        animateComposerInlineVisibility(root, false, collapseOptions);
      } else {
        finalizeCollapse();
      }
    }

    const state = hasOrderChanges && svg && (leftMap.size || connectors.length)
      ? { container: host, svg, connectors, leftMap, rightMap }
      : null;
    composerOrderPreviewState[normalized] = state;
    if (svg) svg.style.display = state ? '' : 'none';
    if (!state && host) {
      const hoverState = host.__pressOrderHoverState || {};
      hoverState.pathMap = null;
      hoverState.currentKey = '';
      host.__pressOrderHoverState = hoverState;
      applyComposerOrderHover(host, '');
    }
    if (state) {
      if (host && host.__pressOrderHoverState && typeof host.__pressOrderHoverState.currentKey === 'string') {
        applyComposerOrderHover(host, host.__pressOrderHoverState.currentKey);
      }
      drawOrderDiffLines(state);
      requestAnimationFrameRef(() => drawOrderDiffLines(state));
      setTimeoutRef(() => drawOrderDiffLines(state), 120);
    }
  }

  function setComposerOrderPreviewActiveKind(kind) {
    const normalized = normalizeOrderKind(kind);
    if (composerOrderPreviewActiveKind === normalized) {
      updateComposerOrderPreview(normalized);
      return;
    }
    composerOrderPreviewActiveKind = normalized;
    updateComposerOrderPreview(normalized);
  }

  function getComposerOrderPreviewActiveKind() {
    return composerOrderPreviewActiveKind;
  }

  return {
    scheduleComposerOrderPreviewRelayout,
    updateComposerOrderPreview,
    setComposerOrderPreviewActiveKind,
    getComposerOrderPreviewActiveKind
  };
}
