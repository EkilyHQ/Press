function noop() {}

function isPlainTextInput(event) {
  return !!event && event.inputType === 'insertText' && event.data != null;
}

function isPlainEnter(event) {
  return !!event
    && event.key === 'Enter'
    && !event.shiftKey
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.isComposing;
}

function prevent(event) {
  try { event?.preventDefault?.(); } catch (_) {}
}

export function createEditorBlocksRichTextSession({
  documentRef = null,
  blocksState = null,
  editableSession = null,
  selectionSession = null,
  inlineDomSession = null,
  caretSession = null,
  setPlainContentEditableValue = (el, value) => { if (el) el.textContent = String(value || ''); },
  editableText = el => String(el?.textContent || ''),
  inlineRunsFromDom = () => [],
  inlineRun = (text, marks = {}) => ({ text, ...marks }),
  insertInlineRunsAtRange = () => [],
  getEditableSelectionOffsets = () => null,
  applyRunsToEditable = noop,
  updateFromControl = noop,
  removeEmptyBlockWithBackspace = () => false,
  mergeTextBlockWithPreviousOnBackspace = () => false,
  handleCrossBlockArrowNavigation = () => false,
  splitTextBlockAfterCaret = () => false,
  shouldInsertBlankBlockOnEnter = () => false,
  insertBlankBlockAfter = noop,
  setActive = noop,
  activateEditableFromPointer = noop,
  routeDirectQuoteCaretFromPointer = () => false,
  inlineMarksFromPointerEvent = () => ({}),
  inlineMarkedDomRangeFromPointerEvent = () => null,
  updateInlineToolbarState = noop,
  refreshLinkEditor = noop,
  openMathEditorForNode = noop
} = {}) {
  if (!documentRef) return null;

  const hasPendingInlineMarks = () => !!blocksState?.hasPendingInlineMarks?.();

  const insertPendingInlineText = (editable, value) => {
    const textValue = String(value || '');
    if (!editable || !textValue || !hasPendingInlineMarks()) return false;
    const offsets = getEditableSelectionOffsets(editable, caretSession);
    if (!offsets) return false;
    const runs = inlineRunsFromDom(editable);
    const insertRun = inlineRun(textValue, blocksState?.pendingInlineForRun?.() || {});
    const nextRuns = insertInlineRunsAtRange(runs, offsets.start, offsets.end, [insertRun]);
    applyRunsToEditable(editable, nextRuns, offsets.start + textValue.length);
    return true;
  };

  const wireInlineEditable = (editable, index, sync) => {
    editable.addEventListener('beforeinput', (event) => {
      if (event.isComposing || !hasPendingInlineMarks()) return;
      if (!isPlainTextInput(event)) return;
      prevent(event);
      setActive(index, editable, sync);
      insertPendingInlineText(editable, event.data);
    });
    editable.addEventListener('paste', (event) => {
      if (!hasPendingInlineMarks()) return;
      const pasted = event.clipboardData && event.clipboardData.getData('text/plain');
      if (!pasted) return;
      prevent(event);
      setActive(index, editable, sync);
      insertPendingInlineText(editable, pasted);
    });
    editable.addEventListener('keyup', () => updateInlineToolbarState());
    editable.addEventListener('mouseup', () => updateInlineToolbarState());
  };

  const createRichEditable = (tagName, block, key, className, index) => {
    const editable = documentRef.createElement(tagName);
    editable.className = className || 'blocks-rich-editable';
    editable.contentEditable = 'true';
    editable.spellcheck = true;
    setPlainContentEditableValue(editable, block?.data?.[key] || '');
    const sync = () => updateFromControl(block, { [key]: editableText(editable) });
    editableSession?.registerEditable?.(editable, sync);
    editable.addEventListener('input', () => {
      sync();
      updateInlineToolbarState();
    });
    editable.addEventListener('keydown', (event) => {
      if (removeEmptyBlockWithBackspace(event, block, index, editable, sync)) return;
      if (mergeTextBlockWithPreviousOnBackspace(event, block, index, editable)) return;
      if (handleCrossBlockArrowNavigation(event, index, editable)) return;
      if (!isPlainEnter(event)) return;
      if (!['paragraph', 'quote', 'heading'].includes(block?.type)) return;
      if (splitTextBlockAfterCaret(event, block, index, editable)) return;
      if (!shouldInsertBlankBlockOnEnter(editable, caretSession)) return;
      prevent(event);
      insertBlankBlockAfter(index, editable, sync);
    });
    editable.addEventListener('focus', () => setActive(index, editable, sync));
    editable.addEventListener('pointerdown', (event) => {
      if (event && event.button === 0 && event.isPrimary !== false) {
        activateEditableFromPointer(index, editable, sync);
      }
      routeDirectQuoteCaretFromPointer(editable, index, sync, event);
    });
    editable.addEventListener('click', (event) => {
      const clickedLink = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      const clickedMath = event.target && event.target.closest ? event.target.closest('.press-math[data-tex]') : null;
      if (clickedLink || clickedMath) prevent(event);
      setActive(index, editable, sync);
      const pointerMarks = inlineMarksFromPointerEvent(event, editable, selectionSession);
      const pointerCodeRange = pointerMarks.code
        ? inlineMarkedDomRangeFromPointerEvent(event, editable, 'code', selectionSession, inlineDomSession)
        : null;
      blocksState?.rememberInlineMarks?.(
        editable,
        pointerMarks,
        pointerCodeRange ? { mark: 'code', ...pointerCodeRange } : null
      );
      updateInlineToolbarState();
      if (clickedLink) refreshLinkEditor(clickedLink);
      if (clickedMath) openMathEditorForNode(clickedMath);
    });
    wireInlineEditable(editable, index, sync);
    return editable;
  };

  return {
    createRichEditable,
    wireInlineEditable
  };
}
