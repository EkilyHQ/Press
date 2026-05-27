import { createSafeHighlightFragment as createRuntimeSafeHighlightFragment } from './syntax-highlight.js';
import { createEditorBlocksCardPickerSession } from './editor-blocks-card-picker-session.js';
import { createEditorBlocksImageSession } from './editor-blocks-image-session.js';
import { createEditorBlocksCodeSession } from './editor-blocks-code-session.js';
import { createEditorBlocksTableSession } from './editor-blocks-table-session.js';
import { createEditorBlocksSourceSession } from './editor-blocks-source-session.js';
import { createEditorBlocksListSession } from './editor-blocks-list-session.js';
import {
  caretRectForEditable,
  codeEditableText,
  getEditableCaretTextOffset,
  inlineMarkedDomRangeFromPointerEvent,
  inlineMarksFromPointerEvent,
  insertCodeEditableTextAtSelection,
  insertPlainTextIntoEditable,
  isEditableCaretOnEdgeLine,
  isEditableSelectionAtStart,
  placeCaretAtEnd,
  placeCaretAtStart,
  placeCaretAtTextOffset,
  placeCaretAtVisualLine,
  splitEditableTextAtSelection,
  textareaTextOffsetDetailsFromPoint
} from './editor-blocks-inline-editing-bridge.js';
import {
  editableListItems,
  effectiveListItemType,
  itemIndentLevel,
  listVisualMarkerLabels,
  mergeListItemIntoPreviousItem,
  normalizeListItemType,
  normalizeSplitListStartItems,
  outdentEmptyListItemForEnter,
  patchListItem,
  patchListItemType,
  splitListItemsAtEmptyItem,
  summarizeListType,
  convertListTailItemAfterEmptyToParagraph
} from './editor-blocks-list-model.js';
import {
  editableTableData,
  normalizeTableAlignment,
  normalizeTableCellValue,
  tableColumnCount
} from './editor-blocks-table-model.js';
import {
  mergeFirstListItemIntoPreviousBlock
} from './editor-blocks-block-flow-model.js';

function registerSession(blockSessions, methodName, session) {
  if (blockSessions && typeof blockSessions[methodName] === 'function') {
    return blockSessions[methodName](session);
  }
  return session;
}

export function createEditorBlocksBlockTypeSessions(options = {}) {
  const {
    documentRef = null,
    windowRef = null,
    runtime = null,
    root = null,
    list = null,
    state = {},
    blocksState = null,
    blockSessions = null,
    editableSession = null,
    selectionSession = null,
    caretSession = null,
    inlineDomSession = null,
    text = (_key, fallback) => fallback,
    blockElements = () => [],
    updateFromControl = () => {},
    insertBlock = () => null,
    deleteBlockAt = () => null,
    setActive = () => {},
    activateEditableFromPointer = () => {},
    handleCrossBlockArrowNavigation = () => false,
    removeEmptyBlockWithBackspace = () => false,
    applySourceAutofix = () => false,
    autoSizeTextarea = () => {},
    resolveAssetSrc = src => String(src || '').trim(),
    hydrateImages = () => {},
    requestImageUpload = null,
    canDeleteImageResource = null,
    requestImageDelete = null,
    render = () => {},
    emit = () => {},
    focusBlockPrimaryEditable = () => {},
    defaultListItems = null,
    setPlainContentEditableValue = null,
    editableText = null,
    makeBlock = null,
    makeBlankBlock = null,
    makeSplitListBlock = null,
    markDirty = () => {},
    updateInlineToolbarState = () => {},
    refreshLinkEditor = () => {},
    openMathEditorForNode = () => {},
    wireInlineEditable = null,
    measureLimit = 12000,
    queueTask = task => queueMicrotask(task),
    factories = {}
  } = options;

  const createCardPickerSession = factories.createCardPickerSession || createEditorBlocksCardPickerSession;
  const createImageSession = factories.createImageSession || createEditorBlocksImageSession;
  const createCodeSession = factories.createCodeSession || createEditorBlocksCodeSession;
  const createTableSession = factories.createTableSession || createEditorBlocksTableSession;
  const createSourceSession = factories.createSourceSession || createEditorBlocksSourceSession;
  const createListSession = factories.createListSession || createEditorBlocksListSession;
  const createHighlightFragment = factories.createHighlightFragment || createRuntimeSafeHighlightFragment;

  const cardPickerSession = registerSession(blockSessions, 'setCardPickerSession', createCardPickerSession({
    documentRef,
    runtime,
    blocksState,
    text,
    insertCardBlock: (data, index) => blockSessions?.insertCommandBlock?.('card', data, { index }) || null,
    requestRender: () => render()
  }));
  if (cardPickerSession?.element) root?.appendChild?.(cardPickerSession.element);

  const imageSession = createImageSession({
    documentRef,
    blocksState,
    editableSession,
    blockElements,
    text,
    selectionSession,
    insertPlainTextIntoEditable,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    updateInlineToolbarState,
    updateFromControl,
    insertBlock,
    deleteBlockAt,
    setActive,
    resolveAssetSrc,
    hydrateImages,
    requestImageUpload,
    canDeleteImageResource,
    requestImageDelete
  });

  const codeSession = createCodeSession({
    documentRef,
    runtime,
    editableSession,
    text,
    selectionSession,
    codeEditableText,
    insertCodeEditableTextAtSelection,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    updateFromControl,
    setActive,
    activateEditableFromPointer,
    createHighlightFragment: (code, language) => createHighlightFragment(code, language, {
      documentRef,
      windowRef,
      allowAmbient: false
    })
  });

  const tableSession = createTableSession({
    documentRef,
    runtime,
    blocksState,
    editableSession,
    blockElements,
    text,
    editableTableData,
    tableColumnCount,
    normalizeTableAlignment,
    normalizeTableCellValue,
    setActive,
    activateEditableFromPointer,
    handleCrossBlockArrowNavigation,
    updateFromControl,
    queueTask
  });

  const sourceSession = createSourceSession({
    documentRef,
    editableSession,
    text,
    caretSession,
    measureLimit,
    textareaTextOffsetDetailsFromPoint,
    autoSizeTextarea,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    updateFromControl,
    setActive,
    activateEditableFromPointer,
    applyAutofix: applySourceAutofix,
    queueTask
  });

  const listSession = registerSession(blockSessions, 'setListSession', createListSession({
    documentRef,
    root,
    list,
    state,
    blocksState,
    editableSession,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: options.containsNode,
    closestElement: options.closestElement,
    text,
    editableListItems,
    defaultListItems,
    summarizeListType,
    listVisualMarkerLabels,
    effectiveListItemType,
    itemIndentLevel,
    normalizeListItemType,
    patchListItemType,
    patchListItem,
    setPlainContentEditableValue,
    editableText,
    splitEditableTextAtSelection,
    outdentEmptyListItemForEnter,
    convertListTailItemAfterEmptyToParagraph,
    splitListItemsAtEmptyItem,
    normalizeSplitListStartItems,
    mergeListItemIntoPreviousItem,
    mergeFirstListItemIntoPreviousBlock,
    makeBlock,
    makeSplitListBlock,
    makeBlankBlock,
    markDirty,
    render,
    emit,
    updateFromControl,
    insertBlankBlock: options.insertBlankBlock,
    focusBlockPrimaryEditable,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    isEditableSelectionAtStart,
    isEditableCaretOnEdgeLine,
    getEditableCaretTextOffset,
    caretRectForEditable,
    placeCaretAtVisualLine,
    placeCaretAtTextOffset,
    placeCaretAtStart,
    placeCaretAtEnd,
    setActive,
    activateEditableFromPointer,
    inlineMarksFromPointerEvent,
    inlineMarkedDomRangeFromPointerEvent,
    updateInlineToolbarState,
    refreshLinkEditor,
    openMathEditorForNode,
    wireInlineEditable,
    queueTask
  }));

  const syncActiveTableAlignmentFromEditable = (activeBlock, editable) => {
    tableSession?.syncActiveAlignmentFromEditable?.(activeBlock, editable, Array.isArray(state.blocks) ? state.blocks : []);
  };

  return {
    cardPickerSession,
    imageSession,
    codeSession,
    tableSession,
    sourceSession,
    listSession,
    syncActiveTableAlignmentFromEditable,
    renderers: {
      image: (body, block, index) => imageSession?.renderBlock?.(body, block, index),
      table: (body, block, index) => tableSession?.renderBlock?.(body, block, index),
      list: (body, block, index) => listSession?.renderBlock?.(body, block, index),
      code: (body, block, index) => codeSession?.renderBlock?.(body, block, index),
      source: (body, block, index) => sourceSession?.renderBlock?.(body, block, index)
    }
  };
}
