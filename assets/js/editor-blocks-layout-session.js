function noop() {}

function safeCall(fn, fallback = null) {
  try { return typeof fn === 'function' ? fn() : fallback; }
  catch (_) { return fallback; }
}

function safePrevent(event) {
  try { event?.preventDefault?.(); } catch (_) {}
}

function safeDispose(dispose) {
  try { if (typeof dispose === 'function') dispose(); } catch (_) {}
}

export function createEditorBlocksLayoutSession({
  runtime = {},
  state = {},
  root = null,
  list = null,
  blockElements = () => [],
  containsNode = (parent, child) => !!(parent && child && parent.contains && parent.contains(child)),
  moveBlockInState = () => false,
  replaceAdjacentBlockElements = () => false,
  render = noop,
  emit = noop,
  onWindow = null
} = {}) {
  const currentBlockCount = () => (Array.isArray(state.blocks) ? state.blocks.length : 0);
  const requestFrame = fn => (
    runtime && typeof runtime.requestFrame === 'function'
      ? runtime.requestFrame(fn)
      : 0
  );
  const setTimer = (fn, delay) => (
    runtime && typeof runtime.setTimer === 'function'
      ? runtime.setTimer(fn, delay)
      : null
  );
  const clearTimer = id => {
    if (runtime && typeof runtime.clearTimer === 'function') runtime.clearTimer(id);
  };
  const viewportWidth = () => (
    runtime && typeof runtime.getViewportWidth === 'function'
      ? runtime.getViewportWidth()
      : 0
  );
  const viewportHeight = () => (
    runtime && typeof runtime.getViewportHeight === 'function'
      ? runtime.getViewportHeight()
      : 0
  );
  const computedStyle = el => (
    runtime && typeof runtime.getComputedStyle === 'function'
      ? runtime.getComputedStyle(el)
      : null
  );
  const elementById = id => (
    runtime && typeof runtime.getElementById === 'function'
      ? runtime.getElementById(id)
      : null
  );
  const documentElement = () => (
    runtime && typeof runtime.getDocumentElement === 'function'
      ? runtime.getDocumentElement()
      : null
  );
  const bodyElement = () => (
    runtime && typeof runtime.getBody === 'function'
      ? runtime.getBody()
      : null
  );
  const scrollingElement = () => (
    runtime && typeof runtime.getScrollingElement === 'function'
      ? runtime.getScrollingElement()
      : null
  );
  const prefersReducedReorderMotion = () => (
    runtime && typeof runtime.prefersReducedMotion === 'function'
      ? !!runtime.prefersReducedMotion()
      : false
  );

  const finishBlockReorder = () => {
    state.reorderAnimating = false;
    requestStickyBlockHeadUpdate();
  };

  const captureBlockRects = (indexes = null) => {
    const allowed = Array.isArray(indexes) ? new Set(indexes) : null;
    const rects = new Map();
    blockElements().forEach((el, index) => {
      if (allowed && !allowed.has(index)) return;
      const id = el?.dataset ? el.dataset.blockId : '';
      if (id && el.getBoundingClientRect) rects.set(id, el.getBoundingClientRect());
    });
    return rects;
  };

  const animateBlockReorder = (beforeRects) => {
    try {
      if (!beforeRects || !beforeRects.size) {
        finishBlockReorder();
        return;
      }
      const moves = blockElements().map((el) => {
        const id = el?.dataset ? el.dataset.blockId : '';
        const before = id ? beforeRects.get(id) : null;
        if (!before || !el.getBoundingClientRect) return null;
        const after = el.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
        return { el, dx, dy };
      }).filter(Boolean);
      if (!moves.length) {
        finishBlockReorder();
        return;
      }
      let remaining = moves.length;
      let finished = false;
      let fallbackTimer = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimer(fallbackTimer);
        moves.forEach((item) => {
          item.el.removeEventListener('transitionend', item.done);
          item.el.classList.remove('is-reordering');
          item.el.style.transition = '';
          item.el.style.transform = '';
        });
        finishBlockReorder();
      };
      moves.forEach((item) => {
        item.done = (event) => {
          if (event && event.target !== item.el) return;
          item.el.removeEventListener('transitionend', item.done);
          remaining -= 1;
          if (remaining <= 0) finish();
        };
        item.el.classList.add('is-reordering');
        item.el.style.transition = 'none';
        item.el.style.transform = `translate3d(${item.dx}px, ${item.dy}px, 0)`;
        item.el.addEventListener('transitionend', item.done);
      });
      safeCall(() => list?.getBoundingClientRect?.(), null);
      requestFrame(() => {
        moves.forEach((item) => {
          item.el.style.transition = '';
          item.el.style.transform = 'translate3d(0, 0, 0)';
        });
      });
      fallbackTimer = setTimer(finish, 360);
    } catch (_) {
      finishBlockReorder();
    }
  };

  const commitBlockMove = (index, direction) => {
    if (!moveBlockInState(index, direction)) return;
    render();
    emit();
  };

  const moveBlock = (index, direction) => {
    try {
      const targetIndex = index + direction;
      const shouldMoveNow = !Number.isInteger(index)
        || !Number.isInteger(targetIndex)
        || targetIndex < 0
        || index < 0
        || targetIndex >= currentBlockCount();
      if (shouldMoveNow) return;
      if (state.reorderAnimating || prefersReducedReorderMotion()) {
        if (!state.reorderAnimating) commitBlockMove(index, direction);
        return;
      }
      const beforeRects = captureBlockRects([index, targetIndex]);
      state.reorderAnimating = true;
      const moved = moveBlockInState(index, direction);
      if (!moved) {
        finishBlockReorder();
        return;
      }
      if (!replaceAdjacentBlockElements(index, targetIndex)) {
        render();
        finishBlockReorder();
        emit();
        return;
      }
      emit();
      animateBlockReorder(beforeRects);
    } catch (_) {
      finishBlockReorder();
      commitBlockMove(index, direction);
    }
  };

  const clearStickyBlockHeads = (except = null) => {
    Array.from(list?.querySelectorAll?.('.blocks-block-head.is-stuck, .blocks-block-head.is-bottom-docked') || []).forEach(head => {
      if (head === except) return;
      head.classList.remove('is-stuck');
      head.classList.remove('is-bottom-docked');
      head.style.removeProperty('top');
      head.style.removeProperty('left');
      head.style.removeProperty('width');
    });
  };

  const editorStickyToolbarBottom = () => {
    try {
      const panel = root?.closest ? root.closest('#editorMarkdownPanel') : null;
      const fileToolbar = panel
        ? panel.querySelector(':scope > .toolbar')
        : elementById('editorMarkdownPanel')?.querySelector?.(':scope > .toolbar');
      const rect = fileToolbar?.getBoundingClientRect ? fileToolbar.getBoundingClientRect() : null;
      if (rect && rect.height > 0) return rect.bottom;
    } catch (_) {}
    try {
      const styles = computedStyle(documentElement());
      const offset = parseFloat(styles?.getPropertyValue?.('--editor-toolbar-offset'));
      if (Number.isFinite(offset)) return offset;
    } catch (_) {}
    return 0;
  };

  const editorViewportBottom = () => {
    try {
      const pane = elementById('editorContentPane');
      const rect = pane?.getBoundingClientRect ? pane.getBoundingClientRect() : null;
      if (rect && rect.height > 0) return rect.bottom;
    } catch (_) {}
    return viewportHeight();
  };

  const findVerticalScrollParent = (node) => {
    let el = node?.parentElement;
    const body = bodyElement();
    const doc = documentElement();
    while (el && el !== body && el !== doc) {
      try {
        const cs = computedStyle(el);
        if (/(auto|scroll|overlay)/.test(cs?.overflowY || '') && el.scrollHeight > el.clientHeight + 1) return el;
      } catch (_) {}
      el = el.parentElement;
    }
    return elementById('editorContentPane') || scrollingElement() || doc;
  };

  const wheelDeltaYForScroll = (event, scrollParent) => {
    let deltaY = event && Number.isFinite(event.deltaY) ? event.deltaY : 0;
    if (!deltaY) return 0;
    if (event.deltaMode === 1) deltaY *= 16;
    else if (event.deltaMode === 2) deltaY *= (scrollParent && scrollParent.clientHeight) || viewportHeight() || 600;
    return deltaY;
  };

  const forwardBlockHeadWheel = (event) => {
    if (!event || !event.deltaY) return;
    const absX = Math.abs(event.deltaX || 0);
    const absY = Math.abs(event.deltaY || 0);
    if (absX > absY) return;
    const scrollParent = findVerticalScrollParent(root);
    if (!scrollParent) return;
    const deltaY = wheelDeltaYForScroll(event, scrollParent);
    if (!deltaY) return;
    const before = scrollParent.scrollTop;
    scrollParent.scrollTop = before + deltaY;
    if (scrollParent.scrollTop !== before) safePrevent(event);
  };

  const updateStickyBlockHead = () => {
    const blockNodes = Array.from(list?.querySelectorAll?.('.blocks-block') || []);
    const activeBlock = blockNodes[state.activeIndex] || null;
    const head = activeBlock?.querySelector ? activeBlock.querySelector('.blocks-block-head') : null;
    clearStickyBlockHeads(head);
    if (state.reorderAnimating) {
      clearStickyBlockHeads();
      return;
    }
    if (!activeBlock || !head || !containsNode(root, activeBlock) || root?.hidden) {
      clearStickyBlockHeads();
      return;
    }

    const wasPositioned = head.classList.contains('is-stuck') || head.classList.contains('is-bottom-docked');
    if (wasPositioned) {
      head.classList.remove('is-stuck');
      head.classList.remove('is-bottom-docked');
      head.style.removeProperty('top');
      head.style.removeProperty('left');
      head.style.removeProperty('width');
    }

    const blockRect = activeBlock.getBoundingClientRect ? activeBlock.getBoundingClientRect() : null;
    if (!blockRect || blockRect.width <= 0 || blockRect.height <= 0) return;
    const headHeight = head.offsetHeight || 0;
    const headWidth = head.offsetWidth || 0;
    if (headHeight <= 0 || headWidth <= 0) return;

    const gap = 8;
    const stickyTop = editorStickyToolbarBottom() + gap;
    const viewportBottom = editorViewportBottom();
    const naturalTop = blockRect.top + (head.offsetTop || 0) - (headHeight * 1.12);
    const blockBottomLimit = blockRect.bottom - headHeight - gap;
    const blockTopUnderStickyToolbar = blockRect.top < stickyTop;
    if (viewportBottom <= stickyTop) return;
    if (blockTopUnderStickyToolbar) {
      if (blockRect.bottom + gap + headHeight <= stickyTop) return;
      head.classList.add('is-bottom-docked');
      head.style.top = `${Math.max(0, blockRect.height + gap)}px`;
      return;
    }
    if (blockRect.bottom <= stickyTop) return;

    const margin = 8;
    const left = Math.max(margin, Math.min(blockRect.left + (head.offsetLeft || 0), viewportWidth() - headWidth - margin));
    const viewportBottomLimit = Math.max(stickyTop, viewportBottom - headHeight - gap);
    const top = Math.min(viewportBottomLimit, blockBottomLimit, Math.max(stickyTop, naturalTop));
    head.classList.add('is-stuck');
    head.style.top = `${top}px`;
    head.style.left = `${left}px`;
  };

  let stickyBlockHeadFrame = 0;
  const requestStickyBlockHeadUpdate = () => {
    if (stickyBlockHeadFrame) return;
    const run = () => {
      stickyBlockHeadFrame = 0;
      updateStickyBlockHead();
    };
    stickyBlockHeadFrame = requestFrame(run) || 1;
  };

  const bind = () => {
    const disposers = [];
    const addWindow = typeof onWindow === 'function'
      ? onWindow
      : (type, handler, options) => (runtime && typeof runtime.onWindow === 'function' ? runtime.onWindow(type, handler, options) : noop);
    disposers.push(addWindow('scroll', requestStickyBlockHeadUpdate, true));
    disposers.push(addWindow('resize', requestStickyBlockHeadUpdate));
    return () => {
      disposers.splice(0).forEach(safeDispose);
    };
  };

  return {
    bind,
    forwardBlockHeadWheel,
    moveBlock,
    requestStickyBlockHeadUpdate
  };
}
