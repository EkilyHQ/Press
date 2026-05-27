export function createComposerOrderReviewView(options = {}) {
  const documentRef = options.documentRef || null;
  const tComposerDiff = typeof options.tComposerDiff === 'function'
    ? options.tComposerDiff
    : (suffix) => suffix;
  const computeOrderDiffDetails = typeof options.computeOrderDiffDetails === 'function'
    ? options.computeOrderDiffDetails
    : () => ({ beforeEntries: [], afterEntries: [], connectors: [], stats: { moved: 0, added: 0, removed: 0 } });
  const renderOrderStatsChips = typeof options.renderOrderStatsChips === 'function'
    ? options.renderOrderStatsChips
    : () => {};
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function'
    ? options.requestAnimationFrameRef
    : () => null;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function'
    ? options.setTimeoutRef
    : () => null;
  const orderVisual = options.orderVisual || {};
  const applyComposerOrderHover = typeof orderVisual.applyComposerOrderHover === 'function'
    ? orderVisual.applyComposerOrderHover
    : () => {};
  const buildOrderDiffItem = typeof orderVisual.buildOrderDiffItem === 'function'
    ? orderVisual.buildOrderDiffItem
    : () => null;
  const drawOrderDiffLinesForState = typeof orderVisual.drawOrderDiffLines === 'function'
    ? orderVisual.drawOrderDiffLines
    : () => {};

  let elements = null;
  let orderState = null;

  function mount(target) {
    if (elements) return elements;
    if (!documentRef || !target) return null;

    const statsWrap = documentRef.createElement('div');
    statsWrap.className = 'composer-order-stats';

    const body = documentRef.createElement('div');
    body.className = 'composer-order-body';

    const viz = documentRef.createElement('div');
    viz.className = 'composer-order-visual';

    const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('composer-order-lines');
    svg.setAttribute('aria-hidden', 'true');

    const columns = documentRef.createElement('div');
    columns.className = 'composer-order-columns';

    const beforeCol = documentRef.createElement('div');
    beforeCol.className = 'composer-order-column composer-order-before';
    const beforeTitle = documentRef.createElement('div');
    beforeTitle.className = 'composer-order-column-title';
    beforeTitle.textContent = tComposerDiff('order.remoteTitle');
    const beforeList = documentRef.createElement('div');
    beforeList.className = 'composer-order-list';
    beforeCol.appendChild(beforeTitle);
    beforeCol.appendChild(beforeList);

    const afterCol = documentRef.createElement('div');
    afterCol.className = 'composer-order-column composer-order-after';
    const afterTitle = documentRef.createElement('div');
    afterTitle.className = 'composer-order-column-title';
    afterTitle.textContent = tComposerDiff('order.currentTitle');
    const afterList = documentRef.createElement('div');
    afterList.className = 'composer-order-list';
    afterCol.appendChild(afterTitle);
    afterCol.appendChild(afterList);

    const emptyNotice = documentRef.createElement('div');
    emptyNotice.className = 'composer-order-empty';
    emptyNotice.textContent = tComposerDiff('order.empty');

    columns.appendChild(beforeCol);
    columns.appendChild(afterCol);
    viz.appendChild(svg);
    viz.appendChild(columns);
    viz.appendChild(emptyNotice);
    body.appendChild(viz);
    target.appendChild(statsWrap);
    target.appendChild(body);

    elements = {
      statsWrap,
      body,
      viz,
      svg,
      beforeTitle,
      beforeList,
      afterTitle,
      afterList,
      emptyNotice
    };
    return elements;
  }

  function clear() {
    orderState = null;
  }

  function drawLines(state) {
    const ctx = state && typeof state === 'object' && state.container ? state : orderState;
    drawOrderDiffLinesForState(ctx);
  }

  function render(kind, options = {}) {
    const view = elements || mount(options.target || null);
    if (!view) return;
    const details = computeOrderDiffDetails(kind);
    const { beforeEntries, afterEntries, connectors, stats } = details;

    view.beforeList.innerHTML = '';
    view.afterList.innerHTML = '';
    while (view.svg.firstChild) view.svg.removeChild(view.svg.firstChild);

    const leftMap = new Map();
    beforeEntries.forEach(entry => {
      const item = buildOrderDiffItem(entry, 'before');
      if (!item) return;
      leftMap.set(entry.key, item);
      view.beforeList.appendChild(item);
    });

    const rightMap = new Map();
    afterEntries.forEach(entry => {
      const item = buildOrderDiffItem(entry, 'after');
      if (!item) return;
      rightMap.set(entry.key, item);
      view.afterList.appendChild(item);
    });

    const hoverState = view.viz.__pressOrderHoverState || {};
    if (hoverState.activeLeft && !hoverState.activeLeft.isConnected) {
      try { hoverState.activeLeft.classList.remove('is-hovered'); } catch (_) {}
      hoverState.activeLeft = null;
    }
    hoverState.leftMap = leftMap;
    hoverState.rightMap = rightMap;
    hoverState.svg = view.svg;
    hoverState.pathMap = null;
    view.viz.__pressOrderHoverState = hoverState;

    const hasItems = beforeEntries.length || afterEntries.length;
    if (hasItems) {
      view.emptyNotice.hidden = true;
      view.emptyNotice.style.display = 'none';
      view.emptyNotice.setAttribute('aria-hidden', 'true');
    } else {
      view.emptyNotice.hidden = false;
      view.emptyNotice.style.display = 'flex';
      view.emptyNotice.setAttribute('aria-hidden', 'false');
    }
    view.viz.classList.toggle('is-empty', !hasItems);

    renderOrderStatsChips(view.statsWrap, stats, { emptyLabel: tComposerDiff('orderStats.empty') });

    orderState = hasItems
      ? { container: view.viz, svg: view.svg, connectors, leftMap, rightMap }
      : null;
    if (!hasItems) {
      applyComposerOrderHover(view.viz, '');
    }
    if (options.layout !== false) {
      drawLines();
      requestAnimationFrameRef(drawLines);
      setTimeoutRef(drawLines, 120);
    }
  }

  function refreshLocale() {
    if (!elements) return;
    elements.beforeTitle.textContent = tComposerDiff('order.remoteTitle');
    elements.afterTitle.textContent = tComposerDiff('order.currentTitle');
    elements.emptyNotice.textContent = tComposerDiff('order.empty');
  }

  function getElements() {
    return elements;
  }

  return {
    mount,
    render,
    clear,
    drawLines,
    refreshLocale,
    getElements
  };
}
