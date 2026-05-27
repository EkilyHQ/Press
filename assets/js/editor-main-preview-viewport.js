const noop = () => {};
const PREVIEW_RESIZE_HANDLE_SPACE = 36;

export function createEditorMainPreviewViewport(options = {}) {
  const getElementById = typeof options.getElementById === 'function' ? options.getElementById : () => null;
  const querySelectorAll = typeof options.querySelectorAll === 'function' ? options.querySelectorAll : () => [];
  const onDocument = typeof options.onDocument === 'function' ? options.onDocument : () => noop;

  const getPreviewFrameSizer = () => getElementById('previewFrameSizer');
  const getPreviewFrame = () => getElementById('previewFrame');
  const getPreviewViewportShell = () => getElementById('previewViewportShell');

  const reset = () => {
    const previewFrameSizer = getPreviewFrameSizer();
    const previewFrame = getPreviewFrame();
    if (!previewFrameSizer) return;
    previewFrameSizer.style.width = '';
    previewFrameSizer.classList.remove('is-resizing');
    if (previewFrame) previewFrame.style.pointerEvents = '';
  };

  const setWidth = (width) => {
    const previewFrameSizer = getPreviewFrameSizer();
    const previewViewportShell = getPreviewViewportShell();
    if (!previewFrameSizer || !previewViewportShell) return;
    const shellRect = previewViewportShell.getBoundingClientRect();
    const maxWidth = Math.max(0, (shellRect.width || 0) - PREVIEW_RESIZE_HANDLE_SPACE);
    if (!maxWidth) return;
    const minWidth = Math.min(360, maxWidth);
    const clamped = Math.max(minWidth, Math.min(maxWidth, width));
    previewFrameSizer.style.width = `${Math.round(clamped)}px`;
  };

  const startResize = (event, side) => {
    const previewFrameSizer = getPreviewFrameSizer();
    const previewViewportShell = getPreviewViewportShell();
    const previewFrame = getPreviewFrame();
    if (!previewFrameSizer || !previewViewportShell) return;
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const startX = event && Number.isFinite(event.clientX) ? event.clientX : 0;
    const startRect = previewFrameSizer.getBoundingClientRect();
    const startWidth = startRect.width || 0;
    const direction = side === 'left' ? -1 : 1;
    previewFrameSizer.classList.add('is-resizing');
    if (previewFrame) previewFrame.style.pointerEvents = 'none';

    const handleMove = (moveEvent) => {
      const currentX = moveEvent && Number.isFinite(moveEvent.clientX) ? moveEvent.clientX : startX;
      const delta = currentX - startX;
      setWidth(startWidth + (delta * direction * 2));
    };
    let detachMove = noop;
    let detachUp = noop;
    let detachCancel = noop;
    const handleEnd = () => {
      detachMove();
      detachUp();
      detachCancel();
      previewFrameSizer.classList.remove('is-resizing');
      if (previewFrame) previewFrame.style.pointerEvents = '';
    };

    detachMove = onDocument('pointermove', handleMove);
    detachUp = onDocument('pointerup', handleEnd, { once: true });
    detachCancel = onDocument('pointercancel', handleEnd, { once: true });
  };

  const bind = () => {
    querySelectorAll('[data-preview-resize]').forEach((handle) => {
      if (!handle || typeof handle.addEventListener !== 'function') return;
      handle.addEventListener('pointerdown', (event) => {
        startResize(event, handle.getAttribute('data-preview-resize') || 'right');
      });
    });
  };

  return {
    bind,
    reset,
    setWidth,
    startResize
  };
}
