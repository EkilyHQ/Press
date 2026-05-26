import { createPressMathRenderer } from './math-render.js';
import { createSafeHighlightFragment as createRuntimeSafeHighlightFragment } from './syntax-highlight.js';
import { createEditorBlocksRuntime } from './editor-blocks-runtime.js';
import { createEditorBlocksSessionRegistry } from './editor-blocks-session-registry.js';
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
  editableVisibleText,
  getEditableCaretTextOffset,
  getEditableSelectionOffsets,
  inlineMarkedDomRangeFromPointerEvent,
  inlineMarkedDomRangeFromSelection,
  inlineMarksFromPointerEvent,
  inlineRunsFromDom,
  insertCodeEditableTextAtSelection,
  insertPlainTextIntoEditable,
  isEditableBackspaceAtEmptyStart,
  isEditableCaretOnEdgeLine,
  isEditableSelectionAtStart,
  isEditableSelectionOnBlankLine,
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
  autofixMarkdownSourceBlock,
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
  isBlockEmptyForBackspace,
  isMergeableListBlock,
  itemIndentLevel,
  listBlockItems,
  listVisualMarkerLabels,
  makeBlankBlock,
  makeBlock,
  mergeFirstListItemIntoPreviousBlock,
  mergeListItemIntoPreviousItem,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
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
  splitTextBlockIntoParagraph,
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

function button(label, className = 'blocks-btn', runtime = null) {
  const el = runtime && typeof runtime.createElement === 'function'
    ? runtime.createElement('button')
    : null;
  if (!el) return null;
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}

// Icons are inline Lucide SVG paths (https://lucide.dev, ISC License).
const BLOCK_TYPE_ICON_PATHS = {
  paragraph: '<path d="M13 4v16" /><path d="M17 4v16" /><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />',
  heading: '<path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
  list: '<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />',
  quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" /><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />',
  code: '<path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" />',
  math: '<path d="M4 19h16" /><path d="M8 5h8" /><path d="M9 5c4 4 4 10 0 14" /><path d="M15 5c-4 4-4 10 0 14" />',
  table: '<path d="M3 5h18" /><path d="M3 12h18" /><path d="M3 19h18" /><path d="M5 5v14" /><path d="M12 5v14" /><path d="M19 5v14" />',
  source: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 12.5 8 15l2 2.5" /><path d="m14 12.5 2 2.5-2 2.5" />',
  card: '<path d="M15 18h-5" /><path d="M18 14h-8" /><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" /><rect width="8" height="4" x="10" y="6" rx="1" />',
  blank: '<path d="M5 6h14" /><path d="M5 18h14" /><path d="M12 10v4" /><path d="M10 12h4" />'
};

function createBlockTypeIcon(blockType, runtime = null) {
  const svg = runtime && typeof runtime.createElementNS === 'function'
    ? runtime.createElementNS('http://www.w3.org/2000/svg', 'svg')
    : null;
  if (!svg) return null;
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = BLOCK_TYPE_ICON_PATHS[blockType] || BLOCK_TYPE_ICON_PATHS.paragraph;
  return svg;
}

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
  const createBlockTypeIconWithRuntime = (blockType) => createBlockTypeIcon(blockType, runtime);

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

  const insertBlankBlock = (index = state.blocks.length, options = {}) => {
    const { block, index: safeIndex } = blocksState.insertBlankBlock(index, options);
    render();
    if (options.command) {
      queueMicrotask(() => {
        blockSessions.focusFirstCommandItem(block.id);
      });
    } else if (options.focus !== false) {
      focusBlockPrimaryEditable(block, 0);
    }
    emit();
    return block;
  };

  const focusBlockPrimaryEditable = (block, caretOffset = null) => {
    blockSessions.focusBlockPrimaryEditable(block, caretOffset);
  };

  const focusListItemEditable = (block, itemIndex, options = {}) => {
    blockSessions.focusListItemEditable(block, itemIndex, options);
  };

  const focusPreviousBlockEnd = (index) => {
    blockSessions.focusPreviousBlockEnd(index);
  };

  const insertBlankBlockAfter = (index, editable = null, sync = null) => {
    if (typeof sync === 'function') sync();
    insertBlankBlock(Math.max(0, Math.min((Number(index) || 0) + 1, state.blocks.length)), { focus: true });
  };

  const splitTextBlockAfterCaret = (event, block, index, editable = null) => {
    if (!event || event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
    if (!block || !['paragraph', 'quote', 'heading'].includes(block.type)) return false;
    const offsets = getEditableSelectionOffsets(editable, caretSession);
    if (!offsets || !offsets.collapsed) return false;
    const currentText = editableVisibleText(editable);
    if (offsets.start >= currentText.length || isEditableSelectionOnBlankLine(editable, caretSession)) return false;
    const split = splitEditableTextAtSelection(editable, selectionSession);
    if (!split.after) return false;
    const nextBlocks = splitTextBlockIntoParagraph(block, split.before, split.after);
    if (!nextBlocks) return false;
    event.preventDefault();
    blocksState.replaceBlocks(index, 1, nextBlocks);
    render();
    focusBlockPrimaryEditable(nextBlocks[1], 0);
    emit();
    return true;
  };

  const mergeTextBlockWithPreviousOnBackspace = (event, block, index, editable = null) => {
    if (!event || event.key !== 'Backspace' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
    if (!Number.isInteger(index) || index <= 0) return false;
    if (!editable || !isEditableSelectionAtStart(editable, caretSession)) return false;
    if (isBlockEmptyForBackspace(block)) return false;
    const previous = state.blocks[index - 1] || null;
    const previousItems = isMergeableListBlock(previous) ? listBlockItems(previous) : [];
    const previousListItemIndex = previousItems.length - 1;
    const merged = mergeTextBlockIntoPrevious(previous, block) || mergeTextBlockIntoPreviousList(previous, block);
    if (!merged) return false;
    event.preventDefault();
    blocksState.replaceBlocks(index - 1, 2, [merged], {
      pendingListFocus: merged.type === 'list' ? {
        blockId: merged.id,
        itemIndex: Number.isInteger(merged.focusItemIndex) ? merged.focusItemIndex : previousListItemIndex,
        caretOffset: merged.focusCaretOffset
      } : null
    });
    render();
    if (merged.type !== 'list') focusBlockPrimaryEditable(merged, merged.focusCaretOffset);
    emit();
    return true;
  };

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

  const deleteBlockAt = (index) => {
    const deleted = blocksState.deleteBlock(index);
    if (!deleted) return;
    render();
    setActive(deleted.activeIndex);
    emit();
  };

  const makeSplitListBlock = (block, items, after = '\n\n') => {
    const data = block && block.data ? block.data : {};
    return makeBlock('list', '', {
      dirty: true,
      listType: data.listType === 'ol' || data.listType === 'task' || data.listType === 'mixed' ? data.listType : 'ul',
      items: Array.isArray(items) ? items.slice() : editableListItems(items).slice(),
      after: after || '\n\n'
    });
  };

  const resetTransientBlockMenus = () => {
    blocksState.resetTransientMenus();
  };

  const removeEmptyBlockWithBackspace = (event, block, index, editable = null, sync = null) => {
    if (!event || event.key !== 'Backspace' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
    if (!Number.isInteger(index) || index <= 0) return false;
    if (editable && !isEditableBackspaceAtEmptyStart(editable, selectionSession)) return false;
    if (typeof sync === 'function') sync();
    if (!isBlockEmptyForBackspace(block)) return false;
    event.preventDefault();
    blocksState.removeBlock(index);
    render();
    focusPreviousBlockEnd(index);
    emit();
    return true;
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

  const applySourceAutofix = (index) => {
    const block = state.blocks[index];
    const nextBlocks = autofixMarkdownSourceBlock(block);
    if (!nextBlocks.length) return;
    blocksState.replaceBlocks(index, 1, nextBlocks, { activeIndex: index });
    render();
    setActive(index);
    emit();
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

  const setActive = (index, editable = null, sync = null) => {
    blockSessions.setActive(index, editable, sync);
  };

  const activateEditableFromPointer = (index, editable, sync) => {
    blockSessions.activateEditableFromPointer(index, editable, sync);
  };

  const activateNonTextBlockFromPointer = (index, blockEl = null) => {
    blockSessions.activateNonTextBlockFromPointer(index, blockEl);
  };

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
    createBlockTypeIcon: createBlockTypeIconWithRuntime,
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

  const inlineCommandMark = (kind) => (kind === 'strikeThrough' ? 'strike' : kind);
  const hasPendingInlineMarks = () => blocksState.hasPendingInlineMarks();

  const applyRunsToEditable = (editable, runs, caretOffset = null) => {
    renderInlineRunsInto(editable, runs, inlineDomSession);
    if (caretOffset != null) placeCaretAtTextOffset(editable, caretOffset, caretSession);
    syncActiveEditable();
    updateInlineToolbarState();
  };

  const togglePendingInlineMark = (kind) => {
    const mark = inlineCommandMark(kind);
    blocksState.togglePendingInlineMark(mark);
    updateInlineToolbarState();
  };

  const applyInlineCommand = (kind) => {
    const editable = blocksState.getActiveEditable();
    if (!editable || !nodeContains(root, editable)) return;
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
      const rememberedCodeRange = blocksState.rememberedInlineRangeFor(editable, mark);
      const codeRange = selectedCodeRange || rememberedCodeRange;
      if ((!offsets || offsets.collapsed) && codeRange) {
        blocksState.clearInlineState();
        const nextRuns = removeInlineMarkInRange(runs, codeRange.start, codeRange.end, mark);
        applyRunsToEditable(editable, nextRuns, offsets ? offsets.start : codeRange.start);
        return;
      }
    }
    if (!offsets) return;
    if (offsets.collapsed) {
      if (mark === 'code' && inlineMarksAtOffset(runs, offsets.start).code) {
        blocksState.clearInlineState();
        const nextRuns = removeInlineMarkAroundOffset(runs, offsets.start, mark);
        applyRunsToEditable(editable, nextRuns, offsets.start);
        return;
      }
      if (mark === 'code') return;
      togglePendingInlineMark(kind);
      return;
    }
    blocksState.clearPendingInline();
    const nextRuns = toggleInlineMarkOnRuns(runs, offsets.start, offsets.end, inlineCommandMark(kind));
    applyRunsToEditable(editable, nextRuns, offsets.end);
  };

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

  const createHeadingLevelSelect = (block) => {
    const select = runtime.createElement('select');
    if (!select) return null;
    select.className = 'blocks-heading-level';
    select.title = text('headingLevel', 'Heading level');
    [1, 2, 3, 4, 5, 6].forEach(level => {
      const option = runtime.createElement('option');
      if (!option) return;
      option.value = String(level);
      option.textContent = `H${level}`;
      select.appendChild(option);
    });
    select.value = String(block.data.level || 2);
    select.addEventListener('change', () => updateFromControl(block, { level: Number(select.value) || 2 }, true));
    return select;
  };

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

  const createMathEditButton = (block, index) => {
    const edit = button(text('editMath', 'Edit math'), 'blocks-btn blocks-math-edit', runtime);
    if (!edit) return null;
    edit.title = text('editMath', 'Edit math');
    edit.setAttribute('aria-label', text('editMath', 'Edit math'));
    edit.addEventListener('mousedown', (event) => event.preventDefault());
    edit.addEventListener('click', () => {
      setActive(index);
      const blockEl = blockElements()[index] || null;
      openMathEditorForBlock(block, blockEl);
    });
    return edit;
  };

  const autoSizeTextarea = (area) => {
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };

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
    createBlockTypeIcon: createBlockTypeIconWithRuntime,
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
