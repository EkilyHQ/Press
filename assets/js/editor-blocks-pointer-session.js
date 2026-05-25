function noop() {}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function isTextarea(editable) {
  return !!(editable && editable.matches && editable.matches('textarea'));
}

function focusElement(el) {
  if (!el || typeof el.focus !== 'function') return;
  try { el.focus({ preventScroll: true }); }
  catch (_) {
    try { el.focus(); } catch (__) {}
  }
}

function editableSync(editableSession, editable) {
  try {
    return editableSession && typeof editableSession.getSync === 'function'
      ? editableSession.getSync(editable) || null
      : null;
  } catch (_) {
    return null;
  }
}

function defaultClosestElement(target, selector) {
  let node = target || null;
  while (node) {
    try {
      if (node.matches && node.matches(selector)) return node;
    } catch (_) {}
    node = node.parentElement || null;
  }
  return null;
}

export function createEditorBlocksPointerSession({
  blocksState = null,
  caretSession = null,
  selectionSession = null,
  editableSession = null,
  blockElements = () => [],
  closestElement = defaultClosestElement,
  containsNode = (root, node) => !!(root && node && (root === node || (root.contains && root.contains(node)))),
  setActive = noop,
  activateEditableFromPointer = null,
  activateNonTextBlockFromPointer = null,
  onInlineToolbarUpdate = noop,
  autoSizeTextarea = noop,
  now = () => Date.now(),
  measureLimit = 12000
} = {}) {
  const getBlockElements = () => safeArray(blockElements());

  function isBlocksCaretInteractiveTarget(target) {
    return !!closestElement(target, [
      '.blocks-block-head',
      '.blocks-command-menu',
      '.blocks-link-editor',
      '.blocks-card-picker',
      '.blocks-card-preview',
      '.blocks-inspector',
      'button',
      'input',
      'select',
      'textarea',
      'label',
      'a[href]',
      '.blocks-image-caption',
      '[contenteditable="true"]'
    ].join(','));
  }

  function rectDistanceSquared(rect, x, y) {
    if (!rect) return Number.POSITIVE_INFINITY;
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    return (dx * dx) + (dy * dy);
  }

  function nearestRectForPoint(el, x, y) {
    const rects = safeArray(el && el.getClientRects ? el.getClientRects() : [])
      .filter(rect => rect && (rect.width > 0 || rect.height > 0));
    if (!rects.length && el && el.getBoundingClientRect) rects.push(el.getBoundingClientRect());
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    rects.forEach(rect => {
      const distance = rectDistanceSquared(rect, x, y);
      if (distance < bestDistance) {
        best = rect;
        bestDistance = distance;
      }
    });
    return best;
  }

  function editableCaretCandidates() {
    const candidates = [];
    getBlockElements().forEach((blockEl, index) => {
      if (!blockEl || !blockEl.querySelectorAll) return;
      const listTexts = blockEl.querySelectorAll('.blocks-list-item .blocks-list-text');
      safeArray(listTexts).forEach(editable => {
        candidates.push({
          editable,
          hitTarget: closestElement(editable, '.blocks-list-item') || editable,
          index,
          sync: editableSync(editableSession, editable)
        });
      });
      const editables = blockEl.querySelectorAll('.blocks-rich-editable:not(.blocks-list-text), .blocks-code-preview code[contenteditable="true"], .blocks-image-caption, .blocks-source-textarea');
      safeArray(editables).forEach(editable => {
        candidates.push({
          editable,
          hitTarget: editable,
          index,
          sync: editableSync(editableSession, editable)
        });
      });
    });
    return candidates;
  }

  function nearestEditableFromPoint(x, y) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    editableCaretCandidates().forEach(candidate => {
      const rect = nearestRectForPoint(candidate.hitTarget || candidate.editable, x, y);
      const distance = rectDistanceSquared(rect, x, y);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    });
    return best;
  }

  function setContentEditableCaretFromPoint(editable, x, y, hitTarget = editable) {
    const setRangeFromPoint = (targetX, targetY) => {
      const range = selectionSession && typeof selectionSession.rangeFromPoint === 'function'
        ? selectionSession.rangeFromPoint(editable, targetX, targetY, {
          containsNode,
          textOnly: true
        })
        : null;
      if (!range) return false;
      range.collapse(true);
      return !!(selectionSession && typeof selectionSession.selectRange === 'function' && selectionSession.selectRange(range, editable));
    };
    const rect = editable && editable.getBoundingClientRect ? editable.getBoundingClientRect() : null;
    const hitRect = hitTarget && hitTarget.getBoundingClientRect ? hitTarget.getBoundingClientRect() : rect;
    const measuredDetails = caretSession && typeof caretSession.measuredTextOffsetDetailsFromPoint === 'function'
      ? caretSession.measuredTextOffsetDetailsFromPoint(editable, x, y, measureLimit)
      : null;
    const pointInsideEditableRect = !rect || (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    );
    if (measuredDetails && !measuredDetails.insideTextRect) {
      caretSession && caretSession.placeAtTextOffset(editable, measuredDetails.offset);
      return;
    }
    if (pointInsideEditableRect && setRangeFromPoint(x, y)) return;
    if (measuredDetails) {
      caretSession && caretSession.placeAtTextOffset(editable, measuredDetails.offset);
      return;
    }
    const nearestRect = nearestRectForPoint(editable, x, y);
    if (nearestRect) {
      const targetX = Math.max(nearestRect.left + 1, Math.min(Number(x) || nearestRect.left, nearestRect.right - 1));
      const targetY = nearestRect.top + (nearestRect.height / 2);
      if (setRangeFromPoint(targetX, targetY)) return;
    }
    if (hitRect && y < hitRect.top + (hitRect.height / 2)) {
      caretSession && caretSession.placeAtTextOffset(editable, 0);
    } else if (caretSession && typeof caretSession.placeAtEnd === 'function') {
      caretSession.placeAtEnd(editable);
    }
  }

  function setTextareaCaretFromPoint(area, x, y) {
    try {
      const rect = area.getBoundingClientRect ? area.getBoundingClientRect() : null;
      const valueLength = String(area.value || '').length;
      const measuredOffset = caretSession && typeof caretSession.textareaTextOffsetFromPoint === 'function'
        ? caretSession.textareaTextOffsetFromPoint(area, x, y, measureLimit)
        : null;
      const fallbackOffset = rect && y < rect.top + (rect.height / 2) ? 0 : valueLength;
      const offset = measuredOffset != null ? measuredOffset : fallbackOffset;
      area.setSelectionRange(offset, offset);
      autoSizeTextarea(area);
    } catch (_) {}
  }

  function suppressRoutedCaretClick() {
    const suppressUntil = now() + 500;
    if (blocksState && typeof blocksState.setRoutedBlockContainerClickSuppression === 'function') {
      blocksState.setRoutedBlockContainerClickSuppression(suppressUntil);
    }
    if (blocksState && typeof blocksState.setLinkEditorRefreshSuppression === 'function') {
      blocksState.setLinkEditorRefreshSuppression(suppressUntil);
    }
  }

  function routeDirectQuoteCaretFromPointer(editable, index, sync, event) {
    if (!event || event.defaultPrevented || event.button !== 0 || event.isPrimary === false) return false;
    if (!editable || !(editable.classList && editable.classList.contains('blocks-quote-text'))) return false;
    const details = caretSession && typeof caretSession.measuredTextOffsetDetailsFromPoint === 'function'
      ? caretSession.measuredTextOffsetDetailsFromPoint(editable, event.clientX, event.clientY, measureLimit)
      : null;
    if (!details || details.insideTextRect) return false;
    event.preventDefault();
    suppressRoutedCaretClick();
    focusElement(editable);
    if (caretSession && typeof caretSession.placeAtTextOffset === 'function') {
      caretSession.placeAtTextOffset(editable, details.offset);
    }
    if (typeof activateEditableFromPointer === 'function') {
      activateEditableFromPointer(index, editable, sync);
    } else {
      setActive(index, editable, sync);
    }
    onInlineToolbarUpdate();
    return true;
  }

  function routeBlocksCaretFromPointer(event) {
    if (!event || event.defaultPrevented || event.button !== 0) return false;
    if (event.isPrimary === false) return false;
    if (isBlocksCaretInteractiveTarget(event.target)) return false;
    const imageBlock = closestElement(event.target, '.blocks-block-image');
    if (imageBlock) {
      const imageIndex = getBlockElements().indexOf(imageBlock);
      if (imageIndex >= 0) {
        event.preventDefault();
        if (typeof activateNonTextBlockFromPointer === 'function') {
          activateNonTextBlockFromPointer(imageIndex, imageBlock);
        } else {
          setActive(imageIndex);
        }
        return true;
      }
    }
    const candidate = nearestEditableFromPoint(event.clientX, event.clientY);
    if (!candidate || !candidate.editable) return false;
    event.preventDefault();
    suppressRoutedCaretClick();
    const { editable, hitTarget, index, sync } = candidate;
    focusElement(editable);
    if (isTextarea(editable)) {
      setTextareaCaretFromPoint(editable, event.clientX, event.clientY);
    } else {
      setContentEditableCaretFromPoint(editable, event.clientX, event.clientY, hitTarget);
    }
    setActive(index, editable, sync);
    return true;
  }

  return {
    isBlocksCaretInteractiveTarget,
    rectDistanceSquared,
    nearestRectForPoint,
    editableCaretCandidates,
    nearestEditableFromPoint,
    setContentEditableCaretFromPoint,
    setTextareaCaretFromPoint,
    routeDirectQuoteCaretFromPointer,
    routeBlocksCaretFromPointer
  };
}
