export function createComposerDragList(options = {}) {
  const documentRef = options.documentRef || null;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function' ? options.requestAnimationFrameRef : null;
  const addWindowListener = typeof options.addWindowListener === 'function' ? options.addWindowListener : () => () => {};
  const getWindowScroll = typeof options.getWindowScroll === 'function' ? options.getWindowScroll : () => ({ x: 0, y: 0 });
  const getComputedStyleRef = typeof options.getComputedStyleRef === 'function' ? options.getComputedStyleRef : null;
  const cancelListTransition = typeof options.cancelListTransition === 'function' ? options.cancelListTransition : () => {};

  function requestFrame(callback) {
    if (typeof callback !== 'function') return null;
    if (requestAnimationFrameRef) {
      try { return requestAnimationFrameRef(callback); } catch (_) {}
    }
    callback();
    return null;
  }

  function getComputedStyleFor(element) {
    if (!element) return null;
    try {
      if (getComputedStyleRef) return getComputedStyleRef(element);
    } catch (_) {}
    return null;
  }

  function makeDragList(container, onReorder, dragOptions = {}) {
    if (!container || !documentRef || typeof documentRef.createElement !== 'function') return;
    const keySelector = dragOptions.keySelector || '[data-key]';
    const handleSelector = dragOptions.handleSelector || '.ci-grip,.ct-grip';
    const getKey = el => el && el.getAttribute && el.getAttribute('data-key');
    const childItems = () => Array.from(container.querySelectorAll(keySelector));

    let dragging = null;
    let placeholder = null;
    let offsetX = 0;
    let offsetY = 0;
    let disposePointerMove = null;
    let disposePointerUp = null;

    const clearDragListeners = () => {
      if (typeof disposePointerMove === 'function') disposePointerMove();
      if (typeof disposePointerUp === 'function') disposePointerUp();
      disposePointerMove = null;
      disposePointerUp = null;
    };

    const snapshotRects = () => {
      const map = new Map();
      childItems().forEach(el => { map.set(getKey(el), el.getBoundingClientRect()); });
      return map;
    };

    const animateFrom = (prevRects) => {
      childItems().forEach((el) => {
        if (el === dragging) return;
        const key = getKey(el);
        const prev = prevRects.get(key);
        if (!prev) return;
        const now = el.getBoundingClientRect();
        const dx = prev.left - now.left;
        const dy = prev.top - now.top;
        if (!dx && !dy) return;
        try {
          el.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' }
          ], { duration: 360, easing: 'ease', composite: 'replace' });
        } catch (_) {
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          requestFrame(() => {
            el.style.transition = 'transform 360ms ease';
            el.style.transform = '';
            const clear = () => {
              el.style.transition = '';
              el.removeEventListener('transitionend', clear);
            };
            el.addEventListener('transitionend', clear);
          });
        }
      });
    };

    const getAfterByY = (targetContainer, y) => {
      const elements = [...targetContainer.querySelectorAll(`${keySelector}:not(.dragging)`)];
      return elements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    const onPointerMove = (event) => {
      if (!dragging) return;
      dragging.style.left = (event.pageX - offsetX) + 'px';
      dragging.style.top = (event.pageY - offsetY) + 'px';

      const prev = snapshotRects();
      const after = getAfterByY(container, event.clientY);
      if (after == null) container.appendChild(placeholder);
      else container.insertBefore(placeholder, after);
      animateFrom(prev);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      const origin = dragging.getBoundingClientRect();
      const target = placeholder.getBoundingClientRect();
      const dx = origin.left - target.left;
      const dy = origin.top - target.top;

      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(dragging, placeholder);
        placeholder.remove();
      }
      placeholder = null;

      dragging.style.position = '';
      dragging.style.left = '';
      dragging.style.top = '';
      dragging.style.width = '';
      dragging.style.height = '';
      dragging.style.zIndex = '';
      dragging.style.pointerEvents = '';
      dragging.style.willChange = '';
      dragging.style.margin = dragging.dataset.nsDragPrevMargin || '';
      dragging.style.transform = dragging.dataset.nsDragPrevTransform || '';
      delete dragging.dataset.nsDragPrevMargin;
      delete dragging.dataset.nsDragPrevTransform;
      dragging.classList.remove('dragging');

      try {
        dragging.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' }
        ], { duration: 360, easing: 'ease' });
      } catch (_) {
        dragging.style.transition = 'none';
        dragging.style.transform = `translate(${dx}px, ${dy}px)`;
        requestFrame(() => {
          dragging.style.transition = 'transform 360ms ease';
          dragging.style.transform = '';
          const clear = () => {
            dragging.style.transition = '';
            dragging.removeEventListener('transitionend', clear);
          };
          dragging.addEventListener('transitionend', clear);
        });
      }

      container.classList.remove('is-dragging-list');
      if (documentRef && documentRef.body) documentRef.body.classList.remove('press-noselect');
      clearDragListeners();

      const order = childItems().map(el => el.dataset.key);
      if (onReorder) onReorder(order);
      dragging = null;
    };

    const onPointerDown = (event) => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      const target = event.target;
      const handle = target.closest(handleSelector);
      if (!handle || !container.contains(handle)) return;
      if (target.closest('button, input, textarea, select, a')) return;
      const item = handle.closest(keySelector);
      if (!item || !container.contains(item)) return;

      event.preventDefault();

      dragging = item;
      cancelListTransition(container);
      container.style.transform = 'none';
      container.style.filter = 'none';
      if (container.style.opacity && container.style.opacity !== '1') container.style.opacity = '';

      const initialRect = item.getBoundingClientRect();
      const styles = getComputedStyleFor(item) || { margin: '' };
      const dragOriginParent = item.parentNode;
      const dragOriginNext = item.nextSibling;

      placeholder = documentRef.createElement('div');
      placeholder.className = 'drag-placeholder';
      placeholder.style.height = initialRect.height + 'px';
      placeholder.style.margin = styles.margin;
      dragOriginParent.insertBefore(placeholder, dragOriginNext);

      item.dataset.nsDragPrevMargin = styles.margin;
      item.dataset.nsDragPrevTransform = item.style.transform || '';
      item.style.margin = '0';
      item.style.transform = 'none';

      const rect = item.getBoundingClientRect();
      const scroll = getWindowScroll() || {};
      const scrollX = Number.isFinite(Number(scroll.x)) ? Number(scroll.x) : 0;
      const scrollY = Number.isFinite(Number(scroll.y)) ? Number(scroll.y) : 0;
      offsetX = event.pageX - (rect.left + scrollX);
      offsetY = event.pageY - (rect.top + scrollY);

      item.style.width = rect.width + 'px';
      item.style.height = rect.height + 'px';
      item.style.position = 'absolute';
      item.style.left = (rect.left + scrollX) + 'px';
      item.style.top = (rect.top + scrollY) + 'px';
      item.style.zIndex = '2147483646';
      item.style.pointerEvents = 'none';
      item.style.willChange = 'transform, top, left';
      item.classList.add('dragging');
      container.classList.add('is-dragging-list');
      if (documentRef && documentRef.body) {
        documentRef.body.classList.add('press-noselect');
        documentRef.body.appendChild(item);
      }

      try { handle.setPointerCapture(event.pointerId); } catch (_) {}
      clearDragListeners();
      disposePointerMove = addWindowListener('pointermove', onPointerMove);
      disposePointerUp = addWindowListener('pointerup', onPointerUp, { once: true });
    };

    container.addEventListener('dragstart', event => event.preventDefault());
    container.addEventListener('pointerdown', onPointerDown);
  }

  return { makeDragList };
}
