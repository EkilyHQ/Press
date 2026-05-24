function noopContains(root, node) {
  try { return !!(root && node && (root === node || root.contains(node))); }
  catch (_) { return false; }
}

function safeCall(fn, fallback = null) {
  try { return typeof fn === 'function' ? fn() : fallback; }
  catch (_) { return fallback; }
}

export function createEditorBlocksSelectionSession({
  documentRef = null,
  windowRef = null
} = {}) {
  function ownerDocumentFor(node = null) {
    return (node && node.ownerDocument) || documentRef || null;
  }

  function ownerWindowFor(node = null) {
    const doc = ownerDocumentFor(node);
    return windowRef || (doc && doc.defaultView) || null;
  }

  function getSelection(node = null) {
    const win = ownerWindowFor(node);
    return safeCall(() => win && typeof win.getSelection === 'function' ? win.getSelection() : null, null);
  }

  function getSelectionRange(node = null) {
    const selection = getSelection(node);
    if (!selection || !selection.rangeCount || typeof selection.getRangeAt !== 'function') return null;
    return safeCall(() => selection.getRangeAt(0), null);
  }

  function createRange(node = null) {
    const doc = ownerDocumentFor(node);
    return safeCall(() => doc && typeof doc.createRange === 'function' ? doc.createRange() : null, null);
  }

  function createTextNode(node, value) {
    const doc = ownerDocumentFor(node);
    return safeCall(() => doc && typeof doc.createTextNode === 'function'
      ? doc.createTextNode(String(value == null ? '' : value))
      : null, null);
  }

  function createTreeWalker(root, whatToShow) {
    const doc = ownerDocumentFor(root);
    return safeCall(() => doc && typeof doc.createTreeWalker === 'function'
      ? doc.createTreeWalker(root, whatToShow)
      : null, null);
  }

  function getComputedStyle(el) {
    const win = ownerWindowFor(el);
    return safeCall(() => win && typeof win.getComputedStyle === 'function' ? win.getComputedStyle(el) : null, null);
  }

  function selectRange(range, node = null) {
    const selection = getSelection(node);
    if (!selection || !range) return false;
    return !!safeCall(() => {
      if (typeof selection.removeAllRanges === 'function') selection.removeAllRanges();
      if (typeof selection.addRange === 'function') selection.addRange(range);
      return true;
    }, false);
  }

  function clearSelection(node = null) {
    const selection = getSelection(node);
    if (!selection || typeof selection.removeAllRanges !== 'function') return false;
    return !!safeCall(() => {
      selection.removeAllRanges();
      return true;
    }, false);
  }

  function rangeFromPoint(root, x, y, options = {}) {
    const doc = ownerDocumentFor(root);
    const containsNode = typeof options.containsNode === 'function' ? options.containsNode : noopContains;
    const textOnly = !!options.textOnly;
    const targetX = Number(x) || 0;
    const targetY = Number(y) || 0;
    return safeCall(() => {
      let range = null;
      if (doc && typeof doc.caretPositionFromPoint === 'function') {
        const position = doc.caretPositionFromPoint(targetX, targetY);
        if (position && (!root || containsNode(root, position.offsetNode))) {
          if (!textOnly || (position.offsetNode && position.offsetNode.nodeType === 3)) {
            range = createRange(root);
            if (range && typeof range.setStart === 'function') range.setStart(position.offsetNode, position.offset);
          }
        }
      }
      if (!range && doc && typeof doc.caretRangeFromPoint === 'function') {
        const pointRange = doc.caretRangeFromPoint(targetX, targetY);
        if (pointRange && (!root || containsNode(root, pointRange.startContainer))) {
          if (!textOnly || (pointRange.startContainer && pointRange.startContainer.nodeType === 3)) {
            range = pointRange;
          }
        }
      }
      return range || null;
    }, null);
  }

  function nodeFromPoint(event, root = null, fallback = null, options = {}) {
    if (!event) return fallback;
    const range = rangeFromPoint(root, event.clientX, event.clientY, options);
    return range && range.startContainer ? range.startContainer : fallback;
  }

  return {
    getSelection,
    getSelectionRange,
    createRange,
    createTextNode,
    createTreeWalker,
    getComputedStyle,
    selectRange,
    clearSelection,
    rangeFromPoint,
    nodeFromPoint
  };
}
