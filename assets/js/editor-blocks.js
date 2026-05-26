import { createPressMathRenderer } from './math-render.js';
import { createSafeHighlightFragment as createRuntimeSafeHighlightFragment } from './syntax-highlight.js';
import { createEditorBlocksRuntime } from './editor-blocks-runtime.js';
import { createEditorBlocksSessionRegistry } from './editor-blocks-session-registry.js';
import { createEditorBlocksBlockActions } from './editor-blocks-block-actions.js';
import { createEditorBlocksControlFactory } from './editor-blocks-control-factory.js';
import { createEditorBlocksLayoutSession } from './editor-blocks-layout-session.js';
import { createEditorBlocksBodySession } from './editor-blocks-body-session.js';
import { createEditorBlocksStateController } from './editor-blocks-state.js';
import { createEditorBlocksMenuSession } from './editor-blocks-menu-session.js';
import { createEditorBlocksHeadSession } from './editor-blocks-head-session.js';
import { createEditorBlocksCommandSession } from './editor-blocks-command-session.js';
import { createEditorBlocksRichTextSession } from './editor-blocks-rich-text-session.js';
import { createEditorBlocksEditableSession } from './editor-blocks-editable-session.js';
import { createEditorBlocksSelectionSession } from './editor-blocks-selection-session.js';
import { CARET_POINT_MEASURE_LIMIT } from './editor-blocks-caret-session.js';
import { createEditorBlocksFocusSession } from './editor-blocks-focus-session.js';
import { createEditorBlocksPointerSession } from './editor-blocks-pointer-session.js';
import { createEditorBlocksActiveSession } from './editor-blocks-active-session.js';
import { createEditorBlocksInlineToolbarSession } from './editor-blocks-inline-toolbar-session.js';
import { createEditorBlocksInlineCommandSession } from './editor-blocks-inline-command-session.js';
import { createEditorBlocksLinkSession } from './editor-blocks-link-session.js';
import { createEditorBlocksMathSession } from './editor-blocks-math-session.js';
import { createEditorBlocksTableSession } from './editor-blocks-table-session.js';
import { createEditorBlocksCardPickerSession } from './editor-blocks-card-picker-session.js';
import { createEditorBlocksImageSession } from './editor-blocks-image-session.js';
import { createEditorBlocksCodeSession } from './editor-blocks-code-session.js';
import { createEditorBlocksSourceSession } from './editor-blocks-source-session.js';
import { createEditorBlocksListSession } from './editor-blocks-list-session.js';
import {
  caretRectForEditable,
  closestElement,
  codeEditableText,
  createCaretSession,
  createInlineDomSession,
  editableText,
  getEditableCaretTextOffset,
  getEditableSelectionOffsets,
  inlineMarkedDomRangeFromPointerEvent,
  inlineMarkedDomRangeFromSelection,
  inlineMarksFromPointerEvent,
  inlineRunsFromDom,
  insertCodeEditableTextAtSelection,
  insertPlainTextIntoEditable,
  isEditableCaretOnEdgeLine,
  isEditableSelectionAtStart,
  linkForTextRange,
  nodeContains,
  placeCaretAtEnd,
  placeCaretAtStart,
  placeCaretAtTextOffset,
  placeCaretAtVisualLine,
  renderInlineRunsInto,
  selectionEditableInRoot,
  selectionLinkInEditable,
  selectionMathInEditable,
  setPlainContentEditableValue,
  shouldInsertBlankBlockOnEnter,
  splitEditableTextAtSelection,
  textareaTextOffsetDetailsFromPoint,
  textRangeForDomNode
} from './editor-blocks-inline-editing-bridge.js';
import {
  applyInlineLinkToRuns,
  applyInlineMathToRuns,
  convertListTailItemAfterEmptyToParagraph,
  defaultListItems,
  editableListItems,
  editableTableData,
  effectiveListItemType,
  inlineMarksAtOffset,
  inlineRangeAnyMarked,
  inlineRangeFullyMarked,
  inlineRangeText,
  inlineRun,
  insertInlineRunsAtRange,
  itemIndentLevel,
  listVisualMarkerLabels,
  makeBlankBlock,
  makeBlock,
  mergeFirstListItemIntoPreviousBlock,
  mergeListItemIntoPreviousItem,
  normalizeEditableMarkdownText,
  normalizeTableAlignment,
  normalizeTableCellValue,
  normalizeListItemType,
  normalizeSplitListStartItems,
  outdentEmptyListItemForEnter,
  parseMarkdownBlocks,
  patchListItem,
  patchListItemType,
  rangeHasInlineText,
  removeInlineMarkAroundOffset,
  removeInlineMarkInRange,
  sanitizeEditorLinkHref,
  sanitizeEditorLinkTitle,
  serializeMarkdownBlocks,
  splitBlankLineUnits,
  splitListItemsAtEmptyItem,
  summarizeListType,
  tableColumnCount,
  toggleInlineMarkOnRuns
} from './editor-blocks-model.js';

export {
  applyInlineLinkToRuns,
  applyInlineMathToRuns,
  autofixMarkdownSourceBlock,
  convertListTailItemAfterEmptyToParagraph,
  inlineRenderedTextLength,
  insertInlineRunsAtRange,
  isBlockEmptyForBackspace,
  joinMergedEditableText,
  listVisualMarkerLabels,
  mergeFirstListItemIntoPreviousBlock,
  mergeListItemIntoPreviousItem,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
  normalizeSplitListStartItems,
  outdentEmptyListItemForEnter,
  parseInlineRuns,
  parseMarkdownBlocks,
  patchListItem,
  patchListItemType,
  removeInlineMarkAroundOffset,
  serializeInlineRuns,
  serializeMarkdownBlocks,
  splitListItemsAtEmptyItem,
  splitTextBlockIntoParagraph,
  toggleInlineMarkOnRuns
} from './editor-blocks-model.js';

export function createMarkdownBlocksEditor(root, options = {}) {
  if (!root) return null;
  const labels = options.labels || {};
  const text = (key, fallback) => labels[key] || fallback;
  const explicitDocumentRef = options.documentRef || null;
  const explicitWindowRef = options.windowRef || null;
  const runtime = options.runtime && typeof options.runtime.onDocument === 'function'
    ? options.runtime
    : createEditorBlocksRuntime({
        documentRef: explicitDocumentRef,
        windowRef: explicitWindowRef,
        navigatorRef: options.navigatorRef
      });
  const blocksDocument = runtime.documentRef || explicitDocumentRef || null;
  const blocksWindow = runtime.windowRef || explicitWindowRef || null;
  const renderMathWithRuntime = createPressMathRenderer({
    documentRef: blocksDocument,
    windowRef: blocksWindow
  });
  const runtimeDisposables = new Set();
  const trackRuntimeDisposer = (dispose) => {
    if (typeof dispose !== 'function') return () => {};
    let active = true;
    runtimeDisposables.add(dispose);
    return () => {
      if (!active) return;
      active = false;
      runtimeDisposables.delete(dispose);
      try { dispose(); } catch (_) {}
    };
  };
  const onDocument = (type, handler, listenerOptions) => trackRuntimeDisposer(runtime.onDocument(type, handler, listenerOptions));
  const onWindow = (type, handler, listenerOptions) => trackRuntimeDisposer(runtime.onWindow(type, handler, listenerOptions));
  const blocksState = createEditorBlocksStateController({
    parseMarkdownBlocksRef: parseMarkdownBlocks,
    serializeMarkdownBlocksRef: serializeMarkdownBlocks,
    makeBlockRef: makeBlock,
    makeBlankBlockRef: makeBlankBlock,
    splitBlankLineUnitsRef: splitBlankLineUnits
  });
  const state = blocksState.state;
  const menuSession = createEditorBlocksMenuSession({
    documentRef: blocksDocument,
    text,
    onDocument,
    onWindow,
    containsNode: nodeContains
  });
  const editableSession = createEditorBlocksEditableSession();
  const selectionSession = createEditorBlocksSelectionSession({
    documentRef: blocksDocument,
    windowRef: blocksWindow
  });
  const inlineDomSession = createInlineDomSession(selectionSession, blocksDocument, renderMathWithRuntime);
  const caretSession = createCaretSession(selectionSession, blocksDocument);
  const setPlainContentEditableValueWithRuntime = (el, value) => setPlainContentEditableValue(el, value, inlineDomSession);

  root.classList.add('markdown-blocks-shell');
  root.innerHTML = '';

  const list = runtime.createElement('div');
  if (!list) return null;
  list.className = 'blocks-list';
  list.setAttribute('aria-label', text('listAria', 'Markdown blocks'));

  root.appendChild(list);

  const markDirty = blocksState.markDirty;

  const emit = () => {
    if (typeof options.onChange === 'function') {
      options.onChange(blocksState.serialize());
    }
  };

  const updateFromControl = (block, patch, renderAfter = false) => {
    if (!block) return;
    blocksState.updateBlockData(block, patch);
    if (renderAfter) render();
    emit();
  };

  const blockElements = () => Array.from(list.children).filter(el => el && el.classList && el.classList.contains('blocks-block'));
  const blockSessions = createEditorBlocksSessionRegistry();

  const focusBlockPrimaryEditable = (block, caretOffset = null) => {
    blockSessions.focusBlockPrimaryEditable(block, caretOffset);
  };

  const focusListItemEditable = (block, itemIndex, options = {}) => {
    blockSessions.focusListItemEditable(block, itemIndex, options);
  };

  const focusPreviousBlockEnd = (index) => {
    blockSessions.focusPreviousBlockEnd(index);
  };

  const setActive = (index, editable = null, sync = null) => {
    blockSessions.setActive(index, editable, sync);
  };

  const blockActions = createEditorBlocksBlockActions({
    state,
    blocksState,
    blockSessions,
    caretSession,
    selectionSession,
    getEditableSelectionOffsets,
    focusBlockPrimaryEditable,
    focusPreviousBlockEnd,
    render: () => render(),
    setActive,
    emit,
    queueTask: task => queueMicrotask(task)
  });

  const {
    insertBlankBlock,
    insertBlankBlockAfter,
    splitTextBlockAfterCaret,
    mergeTextBlockWithPreviousOnBackspace,
    deleteBlockAt,
    makeSplitListBlock,
    removeEmptyBlockWithBackspace,
    applySourceAutofix
  } = blockActions;

  const clearNativeSelection = () => {
    selectionSession.clearSelection(root);
  };

  const requestStickyBlockHeadUpdate = () => {
    blockSessions.requestStickyBlockHeadUpdate();
  };
  const forwardBlockHeadWheel = (event) => {
    blockSessions.forwardBlockHeadWheel(event);
  };
  const moveBlock = (index, direction) => {
    blockSessions.moveBlock(index, direction);
  };

  const replaceAdjacentBlockElements = (index, targetIndex) => {
    return blockSessions.replaceAdjacentBlockElements(index, targetIndex);
  };

  const closeBlockActionMenu = (restoreFocus = false) => {
    menuSession.closeActionMenu(restoreFocus);
  };

  const closeInlineMoreMenu = (restoreFocus = false) => {
    menuSession.closeInlineMenu(restoreFocus);
  };

  const resetTransientBlockMenus = () => {
    blocksState.resetTransientMenus();
  };

  const actionMenuBoundaryLeft = () => {
    try {
      const pane = runtime.getElementById('editorContentPane');
      const rect = (pane && pane.getBoundingClientRect && pane.getBoundingClientRect())
        || (root && root.getBoundingClientRect && root.getBoundingClientRect())
        || null;
      if (rect && Number.isFinite(rect.left)) return Math.max(8, Math.floor(rect.left));
    } catch (_) {}
    return 8;
  };

  const alignBlockActionMenu = (menu, trigger = null) => {
    try {
      if (!menu || menu.hidden) return;
      menu.classList.remove('is-open-right');
      const boundaryLeft = actionMenuBoundaryLeft();
      const menuRect = menu.getBoundingClientRect();
      const triggerRect = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : null;
      const leftSpace = triggerRect ? triggerRect.right - boundaryLeft : menuRect.left - boundaryLeft;
      if (leftSpace < menuRect.width + 8) menu.classList.add('is-open-right');
    } catch (_) {}
  };

  const syncActiveEditable = () => {
    try {
      blocksState.invokeActiveSync();
    } catch (_) {}
  };

  const syncActiveListTypeSelect = (blockNodes = null) => {
    blockSessions.syncActiveTypeSelect(blockNodes);
  };

  const refreshLinkEditor = (explicitLink = null) => {
    blockSessions.refreshLinkEditor(explicitLink);
  };

  const openMathEditorForSelection = () => {
    blockSessions.openMathEditorForSelection();
  };

  const openMathEditorForNode = (mathNode) => {
    blockSessions.openMathEditorForNode(mathNode);
  };

  const openMathEditorForBlock = (block, blockEl = null) => {
    blockSessions.openMathEditorForBlock(block, blockEl);
  };

  const activateEditableFromPointer = (index, editable, sync) => {
    blockSessions.activateEditableFromPointer(index, editable, sync);
  };

  const activateNonTextBlockFromPointer = (index, blockEl = null) => {
    blockSessions.activateNonTextBlockFromPointer(index, blockEl);
  };

  const blockControls = createEditorBlocksControlFactory({
    runtime,
    text,
    updateFromControl,
    blockElements,
    setActive,
    openMathEditorForBlock
  });
  const {
    autoSizeTextarea,
    createBlockTypeIcon,
    createHeadingLevelSelect,
    createMathEditButton
  } = blockControls;

  const focusSession = blockSessions.setFocusSession(createEditorBlocksFocusSession({
    state,
    caretSession,
    editableSession,
    blockElements,
    editableListItems,
    setActive,
    activateNonTextBlockFromPointer,
    onInlineToolbarUpdate: () => {
      try { updateInlineToolbarState(); } catch (_) {}
    },
    queueTask: task => queueMicrotask(task)
  }));

  const pointerSession = blockSessions.setPointerSession(createEditorBlocksPointerSession({
    blocksState,
    caretSession,
    selectionSession,
    editableSession,
    blockElements,
    closestElement,
    containsNode: nodeContains,
    setActive,
    activateEditableFromPointer,
    activateNonTextBlockFromPointer,
    onInlineToolbarUpdate: () => {
      try { updateInlineToolbarState(); } catch (_) {}
    },
    autoSizeTextarea: area => autoSizeTextarea(area),
    measureLimit: CARET_POINT_MEASURE_LIMIT
  }));

  const shouldSuppressRoutedBlockContainerClick = () => {
    return blocksState.consumeRoutedBlockContainerClickSuppression(Date.now());
  };

  const isBlocksCaretInteractiveTarget = (target) => {
    return blockSessions.isBlocksCaretInteractiveTarget(target);
  };

  const blockNavigationTarget = (index, edge = 'first') => {
    return blockSessions.blockNavigationTarget(index, edge);
  };

  const focusBlockNavigationTarget = (target, direction, x, fallbackOffset = 0) => {
    return blockSessions.focusBlockNavigationTarget(target, direction, x, fallbackOffset);
  };

  const handleCrossBlockArrowNavigation = (event, index, editable = null) => {
    return blockSessions.handleCrossBlockArrowNavigation(event, index, editable);
  };

  const setContentEditableCaretFromPoint = (editable, x, y, hitTarget = editable) => {
    blockSessions.setContentEditableCaretFromPoint(editable, x, y, hitTarget);
  };

  const setTextareaCaretFromPoint = (area, x, y) => {
    blockSessions.setTextareaCaretFromPoint(area, x, y);
  };

  const routeDirectQuoteCaretFromPointer = (editable, index, sync, event) => {
    return blockSessions.routeDirectQuoteCaretFromPointer(editable, index, sync, event);
  };

  const routeBlocksCaretFromPointer = (event) => {
    blockSessions.routeBlocksCaretFromPointer(event);
  };

  list.addEventListener('pointerdown', routeBlocksCaretFromPointer);
  const layoutSession = blockSessions.setLayoutSession(createEditorBlocksLayoutSession({
    runtime,
    state,
    root,
    list,
    blockElements,
    containsNode: nodeContains,
    moveBlockInState: (index, direction) => blocksState.moveBlock(index, direction),
    replaceAdjacentBlockElements: (index, targetIndex) => replaceAdjacentBlockElements(index, targetIndex),
    render: () => render(),
    emit,
    onWindow
  }));
  layoutSession.bind();

  const getBaseDir = () => {
    try {
      if (typeof options.getBaseDir === 'function') return options.getBaseDir() || '';
    } catch (_) {}
    return '';
  };

  const resolveAssetSrc = (src) => {
    try {
      if (typeof options.resolveImageSrc === 'function') return options.resolveImageSrc(src, getBaseDir());
    } catch (_) {}
    return String(src || '').trim();
  };

  const hydrateImages = (node) => {
    try {
      if (typeof options.hydrateImages === 'function') options.hydrateImages(node);
    } catch (_) {}
  };

  const hydrateCard = (node) => {
    try {
      if (typeof options.hydrateCard === 'function') options.hydrateCard(node);
    } catch (_) {}
  };

  const insertBlock = (type, data = {}, index = state.activeIndex + 1) => {
    const { block, index: safeIndex } = blocksState.insertBlock(type, data, index);
    render();
    setActive(safeIndex);
    emit();
    return block;
  };

  const placeCommandBlock = (type, data = {}, index = state.blocks.length) => {
    const { block, index: safeIndex } = blocksState.placeCommandBlock(type, data, index);
    render();
    setActive(safeIndex);
    emit();
    return block;
  };

  const updateInlineToolbarState = () => {
    blockSessions.updateInlineToolbarState();
  };

  const openLinkEditorForSelection = () => {
    blockSessions.openLinkEditorForSelection();
  };

  const commandSession = blockSessions.setCommandSession(createEditorBlocksCommandSession({
    documentRef: blocksDocument,
    state,
    blocksState,
    list,
    editableSession,
    text,
    createBlockTypeIcon,
    defaultListItems,
    normalizeEditableMarkdownText,
    editableText,
    closeBlockActionMenu,
    closeInlineMoreMenu,
    placeCommandBlock,
    render,
    emit,
    focusBlockPrimaryEditable,
    insertBlankBlock,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    setActive,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    getCardPickerSession: () => blockSessions.getCardPickerSession(),
    queueTask: task => queueMicrotask(task)
  }));

  const cardPickerSession = blockSessions.setCardPickerSession(createEditorBlocksCardPickerSession({
    documentRef: blocksDocument,
    runtime,
    blocksState,
    text,
    insertCardBlock: (data, index) => blockSessions.insertCommandBlock('card', data, { index }),
    requestRender: () => render()
  }));
  if (cardPickerSession) root.appendChild(cardPickerSession.element);

  const inlineCommandSession = createEditorBlocksInlineCommandSession({
    root,
    blocksState,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: nodeContains,
    renderInlineRunsInto,
    inlineRunsFromDom,
    getEditableSelectionOffsets,
    inlineMarkedDomRangeFromSelection,
    removeInlineMarkAroundOffset,
    removeInlineMarkInRange,
    inlineMarksAtOffset,
    toggleInlineMarkOnRuns,
    placeCaretAtTextOffset,
    syncActiveEditable,
    updateInlineToolbarState,
    openLinkEditorForSelection,
    openMathEditorForSelection
  });
  const {
    applyInlineCommand,
    applyRunsToEditable,
    hasPendingInlineMarks,
    inlineCommandMark
  } = inlineCommandSession;

  const linkSession = blockSessions.setLinkSession(createEditorBlocksLinkSession({
    documentRef: blocksDocument,
    root,
    runtime,
    blocksState,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: nodeContains,
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
    syncActiveEditable,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    onDocument,
    onWindow
  }));

  const mathSession = blockSessions.setMathSession(createEditorBlocksMathSession({
    documentRef: blocksDocument,
    root,
    list,
    runtime,
    blocksState,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: nodeContains,
    closestElement,
    text,
    renderMath: renderMathWithRuntime,
    getMathBlockById: id => state.blocks.find(block => block && block.id === id && block.type === 'math') || null,
    getEditableSelectionOffsets,
    caretRectForEditable,
    selectionMathInEditable,
    inlineRunsFromDom,
    applyInlineMathToRuns,
    renderInlineRunsInto,
    textRangeForDomNode,
    syncActiveEditable,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    updateFromControl,
    onDocument
  }));

  const inlineToolbarSession = blockSessions.setInlineToolbarSession(createEditorBlocksInlineToolbarSession({
    documentRef: blocksDocument,
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
    containsNode: nodeContains,
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
  if (linkSession) {
    root.appendChild(linkSession.element);
    linkSession.bind();
  }
  if (mathSession) {
    root.appendChild(mathSession.element);
    mathSession.bind();
  }

  const richTextSession = createEditorBlocksRichTextSession({
    documentRef: blocksDocument,
    blocksState,
    editableSession,
    selectionSession,
    inlineDomSession,
    caretSession,
    setPlainContentEditableValue: setPlainContentEditableValueWithRuntime,
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
    routeDirectQuoteCaretFromPointer,
    inlineMarksFromPointerEvent,
    inlineMarkedDomRangeFromPointerEvent,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    refreshLinkEditor: link => refreshLinkEditor(link),
    openMathEditorForNode: node => openMathEditorForNode(node)
  });

  const createRichEditable = (...args) => richTextSession?.createRichEditable(...args);
  const wireInlineEditable = (...args) => richTextSession?.wireInlineEditable(...args);

  const imageSession = createEditorBlocksImageSession({
    documentRef: blocksDocument,
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
    requestImageUpload: options.requestImageUpload,
    canDeleteImageResource: options.canDeleteImageResource,
    requestImageDelete: options.requestImageDelete
  });

  const codeSession = createEditorBlocksCodeSession({
    documentRef: blocksDocument,
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
    createHighlightFragment: (code, language) => createRuntimeSafeHighlightFragment(code, language, {
      documentRef: blocksDocument,
      windowRef: blocksWindow,
      allowAmbient: false
    })
  });

  const tableSession = createEditorBlocksTableSession({
    documentRef: blocksDocument,
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
    queueTask: task => queueMicrotask(task)
  });

  const syncActiveTableAlignmentFromEditable = (activeBlock, editable) => {
    tableSession?.syncActiveAlignmentFromEditable(activeBlock, editable, state.blocks);
  };

  const activeSession = blockSessions.setActiveSession(createEditorBlocksActiveSession({
    state,
    blocksState,
    list,
    runtime,
    containsNode: nodeContains,
    syncActiveListTypeSelect,
    refreshLinkEditor,
    updateInlineToolbarState,
    syncActiveTableAlignmentFromEditable,
    requestStickyBlockHeadUpdate,
    clearNativeSelection
  }));

  const sourceSession = createEditorBlocksSourceSession({
    documentRef: blocksDocument,
    editableSession,
    text,
    caretSession,
    measureLimit: CARET_POINT_MEASURE_LIMIT,
    textareaTextOffsetDetailsFromPoint,
    autoSizeTextarea,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    updateFromControl,
    setActive,
    activateEditableFromPointer,
    applyAutofix: index => applySourceAutofix(index),
    queueTask: task => queueMicrotask(task)
  });

  const listSession = blockSessions.setListSession(createEditorBlocksListSession({
    documentRef: blocksDocument,
    root,
    list,
    state,
    blocksState,
    editableSession,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: nodeContains,
    closestElement,
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
    setPlainContentEditableValue: setPlainContentEditableValueWithRuntime,
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
    insertBlankBlock,
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
    queueTask: task => queueMicrotask(task)
  }));

  const headSession = createEditorBlocksHeadSession({
    documentRef: blocksDocument,
    text,
    createBlockTypeIcon,
    menuSession,
    sourceSession,
    listSession,
    codeSession,
    imageSession,
    tableSession,
    inlineToolbarSession,
    createHeadingLevelSelect,
    createMathEditButton,
    forwardBlockHeadWheel,
    alignBlockActionMenu,
    setActive,
    moveBlock,
    insertBlankBlock,
    deleteBlockAt
  });

  const bodySession = blockSessions.setBodySession(createEditorBlocksBodySession({
    documentRef: blocksDocument,
    state,
    list,
    text,
    headSession,
    blockElements,
    closestElement,
    createRichEditable,
    renderMath: renderMathWithRuntime,
    hydrateCard,
    setActive,
    activateNonTextBlockFromPointer,
    openMathEditorForBlock,
    shouldSuppressRoutedBlockContainerClick,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    renderers: {
      blank: (body, block, index) => blockSessions.renderBlankBlock(body, block, index),
      image: (body, block, index) => imageSession?.renderBlock(body, block, index),
      table: (body, block, index) => tableSession?.renderBlock(body, block, index),
      list: (body, block, index) => listSession?.renderBlock(body, block, index),
      code: (body, block, index) => codeSession?.renderBlock(body, block, index),
      source: (body, block, index) => sourceSession?.renderBlock(body, block, index)
    }
  }));

  const renderBlockElement = (block, index) => bodySession.renderBlockElement(block, index);

  function render() {
    closeBlockActionMenu(false);
    closeInlineMoreMenu(false);
    list.innerHTML = '';
    state.blocks.forEach((block, index) => {
      list.appendChild(renderBlockElement(block, index));
    });
    blockSessions.renderCardPicker();
    setActive(state.activeIndex);
    requestStickyBlockHeadUpdate();
  }

  const api = {
    setMarkdown(markdown) {
      blocksState.setMarkdown(markdown);
      render();
    },
    getMarkdown() {
      return blocksState.serialize();
    },
    insertImageBlock(src, alt, index = state.activeIndex + 1) {
      return imageSession ? imageSession.insertImageBlock(src, alt, index) : null;
    },
    replaceImageBlock(src, target = state.activeIndex) {
      return imageSession ? imageSession.replaceImageBlock(src, target) : null;
    },
    getImageBlockSource(target = state.activeIndex) {
      return imageSession ? imageSession.getImageBlockSource(target) : '';
    },
    deleteImageBlock(target = state.activeIndex) {
      return imageSession ? imageSession.deleteImageBlock(target) : null;
    },
    setCardEntries(entries) {
      if (!blockSessions.setCardEntries(entries)) blocksState.setCardEntries(entries);
    },
    focus() {
      const active = list.querySelector('.blocks-block.is-active [contenteditable="true"], .blocks-block.is-active .blocks-image-caption, .blocks-block.is-active input, .blocks-block.is-active textarea');
      try { if (active) active.focus(); } catch (_) {}
    },
    requestLayout() {
      render();
    },
    dispose() {
      closeBlockActionMenu(false);
      closeInlineMoreMenu(false);
      Array.from(runtimeDisposables).forEach((dispose) => {
        try { dispose(); } catch (_) {}
      });
      runtimeDisposables.clear();
    }
  };

  api.setMarkdown('');
  return api;
}
