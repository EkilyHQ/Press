const ORDER_LINE_COLORS = ['#2563eb', '#ec4899', '#f97316', '#10b981', '#8b5cf6', '#f59e0b', '#22d3ee'];

export function createComposerOrderVisual(options = {}) {
  const documentRef = options.documentRef || null;
  const tComposerDiff = typeof options.tComposerDiff === 'function' ? options.tComposerDiff : (suffix) => suffix;
  const getComputedStyleRef = typeof options.getComputedStyleRef === 'function'
    ? options.getComputedStyleRef
    : () => null;

  function getComposerOrderHoverContainer(element) {
    if (!element || typeof element.closest !== 'function') return null;
    return element.closest('.composer-order-visual, .composer-order-host');
  }

  function applyComposerOrderHover(container, key) {
    if (!container) return;
    const state = container.__pressOrderHoverState || (container.__pressOrderHoverState = {});
    const normalizedKey = typeof key === 'string' ? key : '';
    let svg = state.svg;
    if (!svg || !svg.isConnected) {
      svg = container.querySelector('svg.composer-order-lines');
      if (svg) state.svg = svg;
    }
    const pathMap = state.pathMap instanceof Map ? state.pathMap : null;
    const leftMap = state.leftMap instanceof Map ? state.leftMap : null;
    const prevLeft = state.activeLeft;
    const nextLeft = normalizedKey && leftMap ? leftMap.get(normalizedKey) || null : null;
    if (prevLeft && prevLeft !== nextLeft) {
      try { prevLeft.classList.remove('is-hovered'); } catch (_) {}
    }
    if (nextLeft && nextLeft !== prevLeft) {
      try { nextLeft.classList.add('is-hovered'); } catch (_) {}
    }
    state.activeLeft = nextLeft || null;

    state.currentKey = normalizedKey;

    const activePathKey = (pathMap && normalizedKey && pathMap.has(normalizedKey)) ? normalizedKey : '';

    if (!svg) return;

    if (!pathMap) {
      if (normalizedKey) svg.classList.add('is-hovering');
      else svg.classList.remove('is-hovering');
      return;
    }

    pathMap.forEach((paths, pathKey) => {
      const isActive = !!activePathKey && pathKey === activePathKey;
      if (!Array.isArray(paths)) return;
      paths.forEach(path => {
        if (!path || !path.classList) return;
        if (isActive) path.classList.add('is-active');
        else path.classList.remove('is-active');
      });
    });

    if (activePathKey) svg.classList.add('is-hovering');
    else svg.classList.remove('is-hovering');
  }

  function bindComposerOrderHover(element, key) {
    if (!element) return;
    const hoverKey = typeof key === 'string' ? key : (element.getAttribute && element.getAttribute('data-key')) || '';
    const existing = element.__pressOrderHoverBound;
    if (existing && existing.key === hoverKey) return;
    if (existing) {
      element.removeEventListener('mouseenter', existing.enter);
      element.removeEventListener('mouseleave', existing.leave);
      element.removeEventListener('focusin', existing.enter);
      element.removeEventListener('focusout', existing.leave);
    }
    const handleEnter = () => {
      const container = getComposerOrderHoverContainer(element);
      if (!container) return;
      applyComposerOrderHover(container, hoverKey);
    };
    const handleLeave = () => {
      const container = getComposerOrderHoverContainer(element);
      if (!container) return;
      applyComposerOrderHover(container, '');
    };
    element.addEventListener('mouseenter', handleEnter);
    element.addEventListener('mouseleave', handleLeave);
    element.addEventListener('focusin', handleEnter);
    element.addEventListener('focusout', handleLeave);
    element.__pressOrderHoverBound = { key: hoverKey, enter: handleEnter, leave: handleLeave };
  }

  function buildOrderDiffItem(entry, side) {
    const item = documentRef.createElement('div');
    item.className = 'composer-order-item';
    item.dataset.status = entry.status || 'same';
    item.dataset.side = side;
    item.setAttribute('data-key', entry.key || '');

    const idxEl = documentRef.createElement('span');
    idxEl.className = 'composer-order-index';
    idxEl.textContent = `#${entry.index + 1}`;
    item.appendChild(idxEl);

    const keyEl = documentRef.createElement('span');
    keyEl.className = 'composer-order-key';
    const keyText = entry.key || tComposerDiff('order.emptyKey');
    keyEl.textContent = keyText;
    keyEl.title = keyText;
    item.appendChild(keyEl);

    const badgeEl = documentRef.createElement('span');
    badgeEl.className = 'composer-order-badge';
    let badgeText = '';
    if (entry.status === 'moved') {
      if (side === 'before') {
        badgeText = tComposerDiff('order.badges.to', { index: (entry.toIndex == null ? entry.index : entry.toIndex) + 1 });
      } else {
        badgeText = tComposerDiff('order.badges.from', { index: (entry.fromIndex == null ? entry.index : entry.fromIndex) + 1 });
      }
    } else if (entry.status === 'removed') {
      badgeText = tComposerDiff('order.badges.removed');
    } else if (entry.status === 'added') {
      badgeText = tComposerDiff('order.badges.added');
    }
    if (badgeText) {
      badgeEl.textContent = badgeText;
    } else {
      badgeEl.classList.add('is-hidden');
    }
    item.appendChild(badgeEl);
    bindComposerOrderHover(item, entry.key);
    return item;
  }

  function drawOrderDiffLines(state) {
    const ctx = state;
    if (!ctx || typeof ctx !== 'object' || !ctx.container) return;
    const { container, svg, connectors, leftMap, rightMap } = ctx;
    if (!container || !svg) return;

    const hoverState = container.__pressOrderHoverState || (container.__pressOrderHoverState = {});
    hoverState.svg = svg;
    if (leftMap instanceof Map) hoverState.leftMap = leftMap;
    if (rightMap instanceof Map) hoverState.rightMap = rightMap;

    if (leftMap && typeof leftMap.forEach === 'function') {
      leftMap.forEach(el => {
        if (!el || !el.style) return;
        el.style.removeProperty('min-height');
        el.style.removeProperty('height');
        el.style.removeProperty('margin-top');
        el.style.removeProperty('margin-bottom');
      });
    }

    const rect = container.getBoundingClientRect();
    const width = container.clientWidth;
    const height = Math.max(container.scrollHeight, rect.height);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const existingPathCache = (svg.__pressPathCache instanceof Map) ? svg.__pressPathCache : new Map();
    const nextPathCache = new Map();

    const offsetX = rect.left;
    const offsetY = rect.top;
    const scrollTop = container.scrollTop || 0;

    const segments = Array.isArray(connectors) ? connectors : [];
    let movedIdx = 0;
    let fallbackHeight = 0;
    let fallbackMarginTop = '';
    let fallbackMarginBottom = '';
    const layoutSegments = [];
    const pathMap = new Map();
    segments.forEach(info => {
      const leftEl = leftMap.get(info.key);
      const rightRow = rightMap.get(info.key);
      if (!leftEl) return;

      let anchor = null;
      if (rightRow && typeof rightRow.querySelector === 'function') {
        anchor = rightRow.querySelector('.ci-head, .ct-head');
      }
      if (!anchor) anchor = rightRow || null;

      const rowRect = rightRow && typeof rightRow.getBoundingClientRect === 'function'
        ? rightRow.getBoundingClientRect()
        : null;
      const anchorRect = anchor && typeof anchor.getBoundingClientRect === 'function'
        ? anchor.getBoundingClientRect()
        : rowRect;
      const cs = rightRow ? getComputedStyleRef(rightRow) : null;

      if (leftEl.style) {
        const anchorHeight = anchorRect && typeof anchorRect.height === 'number' ? anchorRect.height : 0;
        const rowHeight = rowRect && typeof rowRect.height === 'number' ? rowRect.height : 0;
        const heightPx = Math.max(anchorHeight, rowHeight, 0);
        const heightValue = `${heightPx}px`;
        leftEl.style.height = heightValue;
        leftEl.style.minHeight = heightValue;
        if (heightPx > fallbackHeight) fallbackHeight = heightPx;
        if (cs) {
          leftEl.style.marginTop = cs.marginTop;
          leftEl.style.marginBottom = cs.marginBottom;
          if (!fallbackMarginTop) fallbackMarginTop = cs.marginTop;
          if (!fallbackMarginBottom) fallbackMarginBottom = cs.marginBottom;
        }
      }

      if (!anchorRect || !anchor) return;

      let anchorCenter = null;
      if (anchorRect && rowRect) {
        anchorCenter = (anchorRect.top - rowRect.top) + (anchorRect.height / 2);
      } else if (anchorRect) {
        anchorCenter = anchorRect.height / 2;
      } else if (rowRect) {
        anchorCenter = rowRect.height / 2;
      }

      layoutSegments.push({ info, leftEl, rightEl: anchor, rightRect: anchorRect, rightRow, anchorCenter });
    });

    if (fallbackHeight > 0 && leftMap && typeof leftMap.forEach === 'function') {
      leftMap.forEach(el => {
        if (!el || !el.style) return;
        const status = (el.dataset && typeof el.dataset.status === 'string')
          ? el.dataset.status
          : '';
        if (status === 'removed') return;
        const fallbackValue = `${fallbackHeight}px`;
        if (!el.style.minHeight) {
          el.style.minHeight = fallbackValue;
        }
        if (!el.style.height) {
          el.style.height = fallbackValue;
        }
        if (fallbackMarginTop !== '' && !el.style.marginTop) {
          el.style.marginTop = fallbackMarginTop;
        }
        if (fallbackMarginBottom !== '' && !el.style.marginBottom) {
          el.style.marginBottom = fallbackMarginBottom;
        }
      });
    }

    layoutSegments.forEach(segment => {
      const { info, leftEl, rightEl, rightRect, rightRow, anchorCenter } = segment;
      const lRect = leftEl.getBoundingClientRect();
      const row = rightRow && typeof rightRow.getBoundingClientRect === 'function' ? rightRow : null;
      const rowRect = row ? row.getBoundingClientRect() : null;
      const anchorEl = rightEl && typeof rightEl.getBoundingClientRect === 'function' ? rightEl : row;
      let rRect = anchorEl ? anchorEl.getBoundingClientRect() : null;
      if (!rRect && rightRect) rRect = rightRect;
      const baseRect = rowRect || rRect || rightRect;
      if (!rRect || !baseRect) return;

      let anchorOffset = anchorCenter;
      if (anchorOffset == null) {
        if (rowRect) {
          anchorOffset = (rRect.top - rowRect.top) + (rRect.height / 2);
        } else {
          anchorOffset = rRect.height / 2;
        }
      }

      const clampOffset = (offset, size) => {
        if (offset == null) return 0;
        if (size == null || size <= 0) return Math.max(offset, 0);
        if (offset < 0) return 0;
        if (offset > size) return size;
        return offset;
      };

      const leftOffset = clampOffset(anchorOffset, lRect.height || anchorOffset);
      const rightOffset = clampOffset(anchorOffset, baseRect.height || anchorOffset);

      let startX = (lRect.right - offsetX);
      const startY = (lRect.top - offsetY) + leftOffset + scrollTop;
      let endX = (rRect.left - offsetX);
      const endY = (baseRect.top - offsetY) + rightOffset + scrollTop;
      if (endX <= startX) {
        const mid = (startX + endX) / 2;
        startX = mid - 1;
        endX = mid + 1;
      }
      const curve = Math.max(36, (endX - startX) * 0.35);
      const pathKey = `${info.key || ''}::${info.fromIndex ?? ''}::${info.toIndex ?? ''}`;
      const cached = existingPathCache.get(pathKey);
      let path = cached && cached.path ? cached.path : null;
      if (!path || !path.isConnected) {
        path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('composer-order-path');
      }

      const status = (info && typeof info.status === 'string' && info.status) ? info.status : 'same';
      let strokeColor;
      if (status === 'same') {
        strokeColor = '#94a3b8';
      } else if (cached && cached.color) {
        strokeColor = cached.color;
      } else {
        strokeColor = ORDER_LINE_COLORS[movedIdx % ORDER_LINE_COLORS.length];
        movedIdx += 1;
      }

      path.setAttribute('d', `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`);
      path.dataset.status = status;
      if (info.key) path.dataset.key = info.key;
      else path.removeAttribute('data-key');
      path.dataset.pathKey = pathKey;
      path.setAttribute('stroke', strokeColor);
      svg.appendChild(path);

      const key = info.key || '';
      if (!pathMap.has(key)) pathMap.set(key, []);
      pathMap.get(key).push(path);

      nextPathCache.set(pathKey, { path, color: strokeColor, key });
    });

    existingPathCache.forEach((entry, cacheKey) => {
      if (!nextPathCache.has(cacheKey)) {
        const el = entry && entry.path;
        if (el && el.parentNode === svg) {
          svg.removeChild(el);
        }
      }
    });

    svg.__pressPathCache = nextPathCache;

    hoverState.pathMap = pathMap;
    if (typeof hoverState.currentKey === 'string' && hoverState.currentKey) {
      applyComposerOrderHover(container, hoverState.currentKey);
    } else {
      applyComposerOrderHover(container, '');
    }
  }

  return {
    applyComposerOrderHover,
    bindComposerOrderHover,
    buildOrderDiffItem,
    drawOrderDiffLines
  };
}
