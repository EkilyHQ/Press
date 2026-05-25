function noop() {}

function defaultContainsNode(root, node) {
  return !!(root && node && (root === node || (root.contains && root.contains(node))));
}

function inputValue(input) {
  return input ? String(input.value || '') : '';
}

function setHidden(node, hidden) {
  if (!node) return;
  node.hidden = !!hidden;
  node.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function createButton(documentRef, label, className) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = className || '';
  button.textContent = label || '';
  return button;
}

function blockSelector(id) {
  return `.blocks-block[data-block-id="${String(id || '')}"]`;
}

export function createEditorBlocksMathSession({
  documentRef = null,
  root = null,
  list = null,
  runtime = null,
  blocksState = null,
  selectionSession = null,
  caretSession = null,
  inlineDomSession = null,
  containsNode = defaultContainsNode,
  closestElement = () => null,
  text = (_key, fallback) => fallback,
  renderMath = noop,
  getMathBlockById = () => null,
  getEditableSelectionOffsets = () => null,
  caretRectForEditable = () => null,
  selectionMathInEditable = () => null,
  inlineRunsFromDom = () => [],
  applyInlineMathToRuns = runs => runs,
  renderInlineRunsInto = noop,
  textRangeForDomNode = () => null,
  syncActiveEditable = noop,
  updateInlineToolbarState = noop,
  updateFromControl = noop,
  onDocument = () => noop
} = {}) {
  if (!documentRef || !root) return null;

  const mathEditor = documentRef.createElement('div');
  mathEditor.className = 'blocks-math-editor';
  setHidden(mathEditor, true);

  const mathSource = documentRef.createElement('textarea');
  mathSource.className = 'blocks-math-source';
  mathSource.rows = 3;
  mathSource.placeholder = text('mathSource', 'LaTeX source');
  mathSource.setAttribute('aria-label', text('mathSource', 'LaTeX source'));

  const removeMath = createButton(documentRef, text('removeMath', 'Remove'), 'blocks-inline-btn blocks-remove-math-btn');
  removeMath.title = text('removeMath', 'Remove');
  removeMath.setAttribute('aria-label', text('removeMath', 'Remove'));

  mathEditor.append(mathSource, removeMath);

  const activeEditable = () => blocksState && typeof blocksState.getActiveEditable === 'function'
    ? blocksState.getActiveEditable()
    : null;

  const mathEditMode = () => blocksState && typeof blocksState.getMathEditMode === 'function'
    ? blocksState.getMathEditMode()
    : '';

  const activeMathBlockId = () => blocksState && typeof blocksState.getActiveMathBlockId === 'function'
    ? blocksState.getActiveMathBlockId()
    : '';

  const activeMath = () => blocksState && typeof blocksState.getActiveMath === 'function'
    ? blocksState.getActiveMath()
    : null;

  const setTimer = (fn) => {
    if (runtime && typeof runtime.setTimer === 'function') return runtime.setTimer(fn, 0);
    try { fn(); } catch (_) {}
    return null;
  };

  const focusSource = () => {
    setTimer(() => {
      try {
        mathSource.focus();
        mathSource.select();
      } catch (_) {}
    });
  };

  const isFocused = () => {
    try {
      const activeElement = runtime && typeof runtime.getActiveElement === 'function'
        ? runtime.getActiveElement()
        : null;
      return mathEditor.contains(activeElement);
    } catch (_) {
      return false;
    }
  };

  const positionAtRect = (rect) => {
    try {
      if (!rect) return;
      const rootRect = root.getBoundingClientRect();
      const editorRect = mathEditor.getBoundingClientRect();
      const gap = 6;
      const minLeft = 0;
      const maxLeft = Math.max(minLeft, rootRect.width - editorRect.width);
      const nextLeft = Math.min(maxLeft, Math.max(minLeft, rect.left - rootRect.left));
      mathEditor.style.left = `${nextLeft}px`;
      mathEditor.style.top = `${rect.bottom - rootRect.top + gap}px`;
    } catch (_) {}
  };

  const selectionAnchorRect = (editable, offsets) => {
    try {
      const rect = offsets && offsets.range && offsets.range.getBoundingClientRect && offsets.range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) return rect;
      return caretRectForEditable(editable, caretSession);
    } catch (_) {
      return caretRectForEditable(editable, caretSession);
    }
  };

  const hide = () => {
    if (blocksState && typeof blocksState.clearMathEditorState === 'function') {
      blocksState.clearMathEditorState();
    }
    setHidden(mathEditor, true);
  };

  const syncSourceHeight = () => {
    try {
      mathSource.style.height = 'auto';
      mathSource.style.height = `${mathSource.scrollHeight}px`;
    } catch (_) {}
  };

  const syncNodePreview = (node, tex) => {
    if (!node) return;
    const source = String(tex || '');
    try {
      if (node.dataset) {
        node.dataset.pressMathRendered = '';
        node.dataset.tex = source;
      }
      node.setAttribute('data-tex', source);
      node.textContent = source;
      renderMath(node.parentElement || node);
    } catch (_) {}
  };

  const show = (value, rect) => {
    mathSource.value = String(value || '');
    setHidden(mathEditor, false);
    positionAtRect(rect);
    syncSourceHeight();
    focusSource();
  };

  const apply = () => {
    if (!blocksState) return;
    const tex = inputValue(mathSource).trim();
    if (mathEditMode() === 'block') {
      const block = getMathBlockById(activeMathBlockId());
      if (!block) return;
      updateFromControl(block, { tex });
      const blockEl = list && typeof list.querySelector === 'function'
        ? list.querySelector(blockSelector(block.id))
        : null;
      const node = blockEl && typeof blockEl.querySelector === 'function'
        ? blockEl.querySelector('.press-math-display')
        : null;
      syncNodePreview(node, tex);
      return;
    }
    if (mathEditMode() === 'range') {
      const selection = typeof blocksState.getMathSelection === 'function'
        ? blocksState.getMathSelection()
        : null;
      if (!selection || !selection.editable || !containsNode(root, selection.editable)) return;
      const nextRuns = applyInlineMathToRuns(inlineRunsFromDom(selection.editable), selection.start, selection.end, tex);
      const nextEnd = selection.start + tex.length;
      renderInlineRunsInto(selection.editable, nextRuns, inlineDomSession);
      if (typeof blocksState.updateMathSelection === 'function') {
        blocksState.updateMathSelection({ end: nextEnd, text: tex });
      }
      syncActiveEditable();
      updateInlineToolbarState();
      return;
    }
    const math = activeMath();
    const editable = activeEditable();
    if (!math || !editable || !containsNode(editable, math)) return;
    const mathRange = textRangeForDomNode(editable, math, inlineDomSession);
    if (!mathRange) return;
    const nextRuns = applyInlineMathToRuns(inlineRunsFromDom(editable), mathRange.start, mathRange.end, tex);
    renderInlineRunsInto(editable, nextRuns, inlineDomSession);
    if (typeof blocksState.clearActiveMath === 'function') blocksState.clearActiveMath();
    syncActiveEditable();
    updateInlineToolbarState();
  };

  mathSource.addEventListener('input', () => {
    apply();
    syncSourceHeight();
  });
  removeMath.addEventListener('mousedown', (event) => event.preventDefault());
  removeMath.addEventListener('click', () => {
    mathSource.value = '';
    apply();
    hide();
    updateInlineToolbarState();
  });

  const openForNode = (mathNode) => {
    const editable = activeEditable();
    if (!mathNode || !editable || !containsNode(editable, mathNode)) return;
    const mathRange = textRangeForDomNode(editable, mathNode, inlineDomSession);
    if (!mathRange) return;
    const tex = mathNode.getAttribute('data-tex') || (mathNode.dataset && mathNode.dataset.tex) || '';
    const anchorRect = mathNode.getBoundingClientRect();
    if (typeof blocksState.openInlineMathEditor === 'function') {
      blocksState.openInlineMathEditor(mathNode, {
        editable,
        start: mathRange.start,
        end: mathRange.end,
        text: tex,
        anchorRect
      });
    }
    show(tex, anchorRect);
    updateInlineToolbarState();
  };

  const openForSelection = () => {
    const editable = activeEditable();
    if (!editable || !containsNode(root, editable)) return;
    const existingMath = selectionMathInEditable(editable, selectionSession);
    if (existingMath) {
      openForNode(existingMath);
      return;
    }
    const offsets = getEditableSelectionOffsets(editable, caretSession);
    if (!offsets) return;
    const anchorRect = selectionAnchorRect(editable, offsets);
    const initial = offsets.collapsed ? '' : offsets.text;
    if (typeof blocksState.openInlineMathEditor === 'function') {
      blocksState.openInlineMathEditor(null, {
        editable,
        start: offsets.start,
        end: offsets.end,
        text: initial,
        anchorRect
      });
    }
    show(initial, anchorRect);
    updateInlineToolbarState();
  };

  const openForBlock = (block, blockEl = null) => {
    if (!block || block.type !== 'math') return;
    if (typeof blocksState.openBlockMathEditor === 'function') {
      blocksState.openBlockMathEditor(block.id);
    }
    const target = blockEl || (list && typeof list.querySelector === 'function' ? list.querySelector(blockSelector(block.id)) : null);
    const preview = target && typeof target.querySelector === 'function'
      ? target.querySelector('.press-math-display')
      : null;
    show(block.data && block.data.tex ? block.data.tex : '', (preview || target || root).getBoundingClientRect());
  };

  const isInternalTarget = (target) => {
    if (containsNode(mathEditor, target)) return true;
    const math = closestElement(target, '.press-math[data-tex]');
    return !!(math && containsNode(root, math));
  };

  const handleOutsidePointer = (event) => {
    if (mathEditor.hidden) return;
    const target = event && event.target;
    if (!target || isInternalTarget(target)) return;
    hide();
    updateInlineToolbarState();
  };

  const bind = () => {
    const disposers = [];
    disposers.push(onDocument('pointerdown', handleOutsidePointer, true));
    disposers.push(onDocument('mousedown', handleOutsidePointer, true));
    return () => {
      disposers.splice(0).forEach(dispose => {
        try { if (typeof dispose === 'function') dispose(); } catch (_) {}
      });
    };
  };

  return {
    element: mathEditor,
    fields: { source: mathSource, remove: removeMath },
    apply,
    bind,
    hide,
    isFocused,
    openForBlock,
    openForNode,
    openForSelection,
    handleOutsidePointer,
    positionAtRect
  };
}
