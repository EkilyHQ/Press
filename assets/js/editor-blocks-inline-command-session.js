function noop() {}

function defaultContainsNode(root, node) {
  return !!(root && node && (root === node || (root.contains && root.contains(node))));
}

function defaultInlineCommandMark(kind) {
  return kind === 'strikeThrough' ? 'strike' : kind;
}

export function createEditorBlocksInlineCommandSession({
  root = null,
  blocksState = null,
  selectionSession = null,
  caretSession = null,
  inlineDomSession = null,
  containsNode = defaultContainsNode,
  renderInlineRunsInto = noop,
  inlineRunsFromDom = () => [],
  getEditableSelectionOffsets = () => null,
  inlineMarkedDomRangeFromSelection = () => null,
  removeInlineMarkAroundOffset = runs => runs,
  removeInlineMarkInRange = runs => runs,
  inlineMarksAtOffset = () => ({}),
  toggleInlineMarkOnRuns = runs => runs,
  placeCaretAtTextOffset = noop,
  syncActiveEditable = noop,
  updateInlineToolbarState = noop,
  openLinkEditorForSelection = noop,
  openMathEditorForSelection = noop
} = {}) {
  const inlineCommandMark = defaultInlineCommandMark;

  const hasBlocksState = method => !!(blocksState && typeof blocksState[method] === 'function');

  const hasPendingInlineMarks = () => (
    hasBlocksState('hasPendingInlineMarks') ? blocksState.hasPendingInlineMarks() : false
  );

  const applyRunsToEditable = (editable, runs, caretOffset = null) => {
    renderInlineRunsInto(editable, runs, inlineDomSession);
    if (caretOffset != null) placeCaretAtTextOffset(editable, caretOffset, caretSession);
    syncActiveEditable();
    updateInlineToolbarState();
  };

  const togglePendingInlineMark = (kind) => {
    const mark = inlineCommandMark(kind);
    if (hasBlocksState('togglePendingInlineMark')) blocksState.togglePendingInlineMark(mark);
    updateInlineToolbarState();
  };

  const applyInlineCommand = (kind) => {
    const editable = hasBlocksState('getActiveEditable') ? blocksState.getActiveEditable() : null;
    if (!editable || !containsNode(root, editable)) return;
    try { editable.focus(); } catch (_) {}
    if (kind === 'link') {
      openLinkEditorForSelection();
      return;
    }
    if (kind === 'math') {
      openMathEditorForSelection();
      return;
    }
    const offsets = getEditableSelectionOffsets(editable, caretSession);
    const runs = inlineRunsFromDom(editable);
    const mark = inlineCommandMark(kind);
    if (mark === 'code') {
      const selectedCodeRange = inlineMarkedDomRangeFromSelection(editable, mark, selectionSession, inlineDomSession);
      const rememberedCodeRange = hasBlocksState('rememberedInlineRangeFor')
        ? blocksState.rememberedInlineRangeFor(editable, mark)
        : null;
      const codeRange = selectedCodeRange || rememberedCodeRange;
      if ((!offsets || offsets.collapsed) && codeRange) {
        if (hasBlocksState('clearInlineState')) blocksState.clearInlineState();
        const nextRuns = removeInlineMarkInRange(runs, codeRange.start, codeRange.end, mark);
        applyRunsToEditable(editable, nextRuns, offsets ? offsets.start : codeRange.start);
        return;
      }
    }
    if (!offsets) return;
    if (offsets.collapsed) {
      if (mark === 'code' && inlineMarksAtOffset(runs, offsets.start).code) {
        if (hasBlocksState('clearInlineState')) blocksState.clearInlineState();
        const nextRuns = removeInlineMarkAroundOffset(runs, offsets.start, mark);
        applyRunsToEditable(editable, nextRuns, offsets.start);
        return;
      }
      if (mark === 'code') return;
      togglePendingInlineMark(kind);
      return;
    }
    if (hasBlocksState('clearPendingInline')) blocksState.clearPendingInline();
    const nextRuns = toggleInlineMarkOnRuns(runs, offsets.start, offsets.end, inlineCommandMark(kind));
    applyRunsToEditable(editable, nextRuns, offsets.end);
  };

  return {
    applyInlineCommand,
    applyRunsToEditable,
    hasPendingInlineMarks,
    inlineCommandMark
  };
}
