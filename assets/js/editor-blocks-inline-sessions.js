import { createEditorBlocksRichTextSession } from './editor-blocks-rich-text-session.js';
import { createEditorBlocksInlineToolbarSession } from './editor-blocks-inline-toolbar-session.js';
import { createEditorBlocksInlineCommandSession } from './editor-blocks-inline-command-session.js';
import { createEditorBlocksLinkSession } from './editor-blocks-link-session.js';
import { createEditorBlocksMathSession } from './editor-blocks-math-session.js';
import {
  caretRectForEditable,
  inlineMarkedDomRangeFromPointerEvent,
  inlineMarkedDomRangeFromSelection,
  inlineMarksFromPointerEvent,
  inlineRunsFromDom,
  linkForTextRange,
  renderInlineRunsInto,
  selectionEditableInRoot,
  selectionLinkInEditable,
  selectionMathInEditable,
  shouldInsertBlankBlockOnEnter,
  textRangeForDomNode
} from './editor-blocks-inline-editing-bridge.js';
import {
  applyInlineLinkToRuns,
  applyInlineMathToRuns,
  inlineMarksAtOffset,
  inlineRangeAnyMarked,
  inlineRangeFullyMarked,
  inlineRangeText,
  inlineRun,
  insertInlineRunsAtRange,
  rangeHasInlineText,
  removeInlineMarkAroundOffset,
  removeInlineMarkInRange,
  sanitizeEditorLinkHref,
  sanitizeEditorLinkTitle,
  toggleInlineMarkOnRuns
} from './editor-blocks-inline-model.js';

export function createEditorBlocksInlineSessions(options = {}) {
  const {
    documentRef = null,
    root = null,
    list = null,
    runtime = null,
    state = {},
    blocksState = null,
    blockSessions = null,
    editableSession = null,
    selectionSession = null,
    caretSession = null,
    inlineDomSession = null,
    menuSession = null,
    text = (_key, fallback) => fallback,
    renderMath = null,
    closestElement = null,
    containsNode = null,
    setActive = () => {},
    setPlainContentEditableValue = null,
    editableText = null,
    getEditableSelectionOffsets = null,
    placeCaretAtTextOffset = null,
    syncActiveEditable = null,
    updateInlineToolbarState = null,
    openLinkEditorForSelection = null,
    openMathEditorForSelection = null,
    refreshLinkEditor = null,
    openMathEditorForNode = null,
    updateFromControl = null,
    removeEmptyBlockWithBackspace = null,
    mergeTextBlockWithPreviousOnBackspace = null,
    handleCrossBlockArrowNavigation = null,
    splitTextBlockAfterCaret = null,
    insertBlankBlockAfter = null,
    activateEditableFromPointer = null,
    onDocument = null,
    onWindow = null,
    factories = {}
  } = options;

  const createInlineCommandSession = factories.createInlineCommandSession || createEditorBlocksInlineCommandSession;
  const createLinkSession = factories.createLinkSession || createEditorBlocksLinkSession;
  const createMathSession = factories.createMathSession || createEditorBlocksMathSession;
  const createInlineToolbarSession = factories.createInlineToolbarSession || createEditorBlocksInlineToolbarSession;
  const createRichTextSession = factories.createRichTextSession || createEditorBlocksRichTextSession;
  const refreshToolbar = updateInlineToolbarState || (() => blockSessions?.updateInlineToolbarState?.());
  const syncEditable = syncActiveEditable || (() => {
    try {
      blocksState?.invokeActiveSync?.();
    } catch (_) {}
  });
  const openLinkForSelection = openLinkEditorForSelection || (() => blockSessions?.openLinkEditorForSelection?.());
  const openMathForSelection = openMathEditorForSelection || (() => blockSessions?.openMathEditorForSelection?.());
  const refreshLink = refreshLinkEditor || (link => blockSessions?.refreshLinkEditor?.(link));
  const openMathForNode = openMathEditorForNode || (node => blockSessions?.openMathEditorForNode?.(node));

  const inlineCommandSession = createInlineCommandSession({
    root,
    blocksState,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode,
    renderInlineRunsInto,
    inlineRunsFromDom,
    getEditableSelectionOffsets,
    inlineMarkedDomRangeFromSelection,
    removeInlineMarkAroundOffset,
    removeInlineMarkInRange,
    inlineMarksAtOffset,
    toggleInlineMarkOnRuns,
    placeCaretAtTextOffset,
    syncActiveEditable: syncEditable,
    updateInlineToolbarState: refreshToolbar,
    openLinkEditorForSelection: openLinkForSelection,
    openMathEditorForSelection: openMathForSelection
  });
  const {
    applyInlineCommand = () => {},
    applyRunsToEditable = () => {},
    hasPendingInlineMarks = () => false,
    inlineCommandMark = () => null
  } = inlineCommandSession || {};

  const linkSession = blockSessions?.setLinkSession?.(createLinkSession({
    documentRef,
    root,
    runtime,
    blocksState,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode,
    closestElement,
    text,
    sanitizeLinkHref: sanitizeEditorLinkHref,
    sanitizeLinkTitle: sanitizeEditorLinkTitle,
    selectionLinkInEditable,
    getEditableSelectionOffsets,
    caretRectForEditable,
    inlineRunsFromDom,
    inlineRangeText,
    applyInlineLinkToRuns,
    renderInlineRunsInto,
    textRangeForDomNode,
    linkForTextRange,
    placeCaretAtTextOffset,
    syncActiveEditable: syncEditable,
    updateInlineToolbarState: refreshToolbar,
    onDocument,
    onWindow
  }));

  const mathSession = blockSessions?.setMathSession?.(createMathSession({
    documentRef,
    root,
    list,
    runtime,
    blocksState,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode,
    closestElement,
    text,
    renderMath,
    getMathBlockById: id => (Array.isArray(state.blocks) ? state.blocks : []).find(block => block && block.id === id && block.type === 'math') || null,
    getEditableSelectionOffsets,
    caretRectForEditable,
    selectionMathInEditable,
    inlineRunsFromDom,
    applyInlineMathToRuns,
    renderInlineRunsInto,
    textRangeForDomNode,
    syncActiveEditable: syncEditable,
    updateInlineToolbarState: refreshToolbar,
    updateFromControl,
    onDocument
  }));

  const inlineToolbarSession = blockSessions?.setInlineToolbarSession?.(createInlineToolbarSession({
    documentRef,
    state,
    blocksState,
    editableSession,
    root,
    list,
    menuSession,
    selectionSession,
    caretSession,
    text,
    setActive,
    applyInlineCommand,
    containsNode,
    closestElement,
    selectionEditableInRoot,
    getEditableSelectionOffsets,
    inlineRunsFromDom,
    hasPendingInlineMarks,
    selectionLinkInEditable,
    selectionMathInEditable,
    inlineRangeFullyMarked,
    inlineRangeAnyMarked,
    inlineMarksAtOffset,
    rangeHasInlineText,
    inlineCommandMark
  }));

  if (linkSession?.element) {
    root?.appendChild?.(linkSession.element);
    linkSession.bind?.();
  }
  if (mathSession?.element) {
    root?.appendChild?.(mathSession.element);
    mathSession.bind?.();
  }

  const richTextSession = createRichTextSession({
    documentRef,
    blocksState,
    editableSession,
    selectionSession,
    inlineDomSession,
    caretSession,
    setPlainContentEditableValue,
    editableText,
    inlineRunsFromDom,
    inlineRun,
    insertInlineRunsAtRange,
    getEditableSelectionOffsets,
    applyRunsToEditable,
    updateFromControl,
    removeEmptyBlockWithBackspace,
    mergeTextBlockWithPreviousOnBackspace,
    handleCrossBlockArrowNavigation,
    splitTextBlockAfterCaret,
    shouldInsertBlankBlockOnEnter,
    insertBlankBlockAfter,
    setActive,
    activateEditableFromPointer,
    inlineMarksFromPointerEvent,
    inlineMarkedDomRangeFromPointerEvent,
    updateInlineToolbarState: refreshToolbar,
    refreshLinkEditor: refreshLink,
    openMathEditorForNode: openMathForNode
  });

  return {
    inlineCommandSession,
    linkSession,
    mathSession,
    inlineToolbarSession,
    richTextSession,
    createRichEditable: (...args) => richTextSession?.createRichEditable?.(...args),
    wireInlineEditable: (...args) => richTextSession?.wireInlineEditable?.(...args)
  };
}
