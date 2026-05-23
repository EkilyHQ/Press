function noop() {}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function defaultContainsNode(root, node) {
  return !!(root && node && (root === node || (root.contains && root.contains(node))));
}

function defaultInlineCommandMark(command) {
  return command === 'strikeThrough' ? 'strike' : command;
}

function clearButtonState(btn) {
  btn.classList.remove('is-active');
  btn.classList.remove('is-disabled');
  btn.setAttribute('aria-pressed', 'false');
  btn.disabled = false;
  btn.removeAttribute('aria-disabled');
  btn.tabIndex = 0;
}

function applyButtonState(btn, active, disabled) {
  btn.classList.toggle('is-active', active);
  btn.classList.toggle('is-disabled', disabled);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.disabled = false;
  btn.tabIndex = disabled ? -1 : 0;
  if (disabled) {
    btn.setAttribute('aria-disabled', 'true');
  } else {
    btn.removeAttribute('aria-disabled');
  }
}

export function createEditorBlocksInlineToolbarSession({
  state = null,
  blocksState = null,
  editableSession = null,
  root = null,
  list = null,
  selectionSession = null,
  caretSession = null,
  containsNode = defaultContainsNode,
  closestElement = () => null,
  selectionEditableInRoot = () => null,
  getEditableSelectionOffsets = () => null,
  inlineRunsFromDom = () => [],
  hasPendingInlineMarks = () => false,
  selectionLinkInEditable = () => null,
  selectionMathInEditable = () => null,
  inlineRangeFullyMarked = () => false,
  inlineRangeAnyMarked = () => false,
  inlineMarksAtOffset = () => ({}),
  rangeHasInlineText = () => false,
  inlineCommandMark = defaultInlineCommandMark,
  now = () => Date.now()
} = {}) {
  const currentState = () => state || (blocksState && blocksState.state) || { activeIndex: -1 };
  const toolbarButtons = () => {
    return root && typeof root.querySelectorAll === 'function'
      ? safeArray(root.querySelectorAll('[data-inline-command]'))
      : [];
  };
  const blockNodes = () => {
    return list && typeof list.querySelectorAll === 'function'
      ? safeArray(list.querySelectorAll('.blocks-block'))
      : [];
  };
  const hasBlocksState = method => !!(blocksState && typeof blocksState[method] === 'function');

  function recoverActiveFromSelection(nodes) {
    const selectionEditable = selectionEditableInRoot(root, selectionSession);
    const canRecoverSelectionActive = !(
      hasBlocksState('selectionActiveRecoverySuppressed')
      && blocksState.selectionActiveRecoverySuppressed(now())
    );
    if (!selectionEditable || !canRecoverSelectionActive) return;
    const selectionBlock = closestElement(selectionEditable, '.blocks-block');
    const selectionIndex = nodes.indexOf(selectionBlock);
    if (selectionIndex < 0) return;
    if (hasBlocksState('setActiveIndex')) blocksState.setActiveIndex(selectionIndex);
    if (editableSession && typeof editableSession.bindActiveEditing === 'function') {
      editableSession.bindActiveEditing(
        blocksState,
        selectionEditable,
        hasBlocksState('getActiveSync') ? blocksState.getActiveSync() : null
      );
    }
    nodes.forEach((el, idx) => {
      if (el && el.classList && typeof el.classList.toggle === 'function') {
        el.classList.toggle('is-active', idx === currentState().activeIndex);
      }
    });
  }

  function pendingInlineMark(mark) {
    return hasBlocksState('pendingInlineMark') ? blocksState.pendingInlineMark(mark) : null;
  }

  function update() {
    const buttons = toolbarButtons();
    if (!buttons.length) return;
    const nodes = blockNodes();
    recoverActiveFromSelection(nodes);
    const editable = hasBlocksState('getActiveEditable') ? blocksState.getActiveEditable() : null;
    const activeBlock = nodes[currentState().activeIndex] || null;
    const editableInRoot = editable && containsNode(root, editable);
    const offsets = editableInRoot ? getEditableSelectionOffsets(editable, caretSession) : null;
    const runs = editableInRoot ? inlineRunsFromDom(editable) : [];
    const pending = hasPendingInlineMarks();
    const fallbackMarks = hasBlocksState('rememberedInlineMarksFor')
      ? blocksState.rememberedInlineMarksFor(editable)
      : null;
    const rememberedCodeRange = hasBlocksState('rememberedInlineRangeFor')
      ? blocksState.rememberedInlineRangeFor(editable, 'code')
      : null;
    buttons.forEach(btn => {
      if (!activeBlock || !activeBlock.contains(btn)) {
        clearButtonState(btn);
        return;
      }
      const command = btn.dataset.inlineCommand || '';
      const mark = inlineCommandMark(command);
      let active = false;
      let disabled = false;
      if (offsets && command === 'link') {
        active = !!pendingInlineMark('link')
          || !!selectionLinkInEditable(editable, selectionSession)
          || (!offsets.collapsed && inlineRangeFullyMarked(runs, offsets.start, offsets.end, 'link'));
      } else if (offsets && command === 'math') {
        active = !!selectionMathInEditable(editable, selectionSession)
          || (!offsets.collapsed && inlineRangeFullyMarked(runs, offsets.start, offsets.end, 'math'));
      } else if (mark === 'code') {
        if (offsets && offsets.collapsed) {
          const marks = inlineMarksAtOffset(runs, offsets.start);
          active = !!(marks.code || (fallbackMarks && fallbackMarks.code));
          disabled = !active;
        } else if (offsets) {
          active = inlineRangeFullyMarked(runs, offsets.start, offsets.end, mark);
          disabled = !rangeHasInlineText(runs, offsets.start, offsets.end);
        } else {
          active = !!(fallbackMarks && fallbackMarks.code);
          disabled = !rememberedCodeRange;
        }
      } else if (offsets && offsets.collapsed) {
        const marks = inlineMarksAtOffset(runs, offsets.start);
        active = pending ? !!pendingInlineMark(mark) : !!(marks[mark] || (fallbackMarks && fallbackMarks[mark]));
      } else if (offsets) {
        active = ['bold', 'italic', 'strike'].includes(mark)
          ? inlineRangeAnyMarked(runs, offsets.start, offsets.end, mark)
          : inlineRangeFullyMarked(runs, offsets.start, offsets.end, mark);
      } else if (fallbackMarks && ['bold', 'italic', 'strike', 'code'].includes(mark)) {
        active = !!fallbackMarks[mark];
      }
      applyButtonState(btn, active, disabled);
    });
  }

  return { update };
}
