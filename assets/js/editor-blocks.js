import { createPressMathRenderer } from './math-render.js';
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
import { createEditorBlocksEditableSession } from './editor-blocks-editable-session.js';
import { createEditorBlocksSelectionSession } from './editor-blocks-selection-session.js';
import { CARET_POINT_MEASURE_LIMIT } from './editor-blocks-caret-session.js';
import { createEditorBlocksFocusPointerSessions } from './editor-blocks-focus-pointer-sessions.js';
import { createEditorBlocksActiveSession } from './editor-blocks-active-session.js';
import { createEditorBlocksInlineSessions } from './editor-blocks-inline-sessions.js';
import { createEditorBlocksBlockTypeSessions } from './editor-blocks-block-type-sessions.js';
import {
  closestElement,
  createCaretSession,
  createInlineDomSession,
  editableText,
  getEditableSelectionOffsets,
  nodeContains,
  placeCaretAtTextOffset,
  setPlainContentEditableValue
} from './editor-blocks-inline-editing-bridge.js';
import {
  normalizeEditableMarkdownText
} from './editor-blocks-inline-model.js';
import {
  defaultListItems,
  editableListItems
} from './editor-blocks-list-model.js';
import {
  makeBlankBlock,
  makeBlock,
  splitBlankLineUnits
} from './editor-blocks-block-core-model.js';
import {
  parseMarkdownBlocks
} from './editor-blocks-markdown-parse-model.js';
import {
  serializeMarkdownBlocks
} from './editor-blocks-markdown-serialize-model.js';

export {
  applyInlineLinkToRuns,
  applyInlineMathToRuns,
  inlineRenderedTextLength,
  insertInlineRunsAtRange,
  parseInlineRuns,
  removeInlineMarkAroundOffset,
  serializeInlineRuns,
  toggleInlineMarkOnRuns
} from './editor-blocks-inline-model.js';

export {
  convertListTailItemAfterEmptyToParagraph,
  listVisualMarkerLabels,
  mergeListItemIntoPreviousItem,
  normalizeSplitListStartItems,
  outdentEmptyListItemForEnter,
  patchListItem,
  patchListItemType,
  splitListItemsAtEmptyItem
} from './editor-blocks-list-model.js';

export {
  isBlockEmptyForBackspace,
  joinMergedEditableText,
  mergeFirstListItemIntoPreviousBlock,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
  splitTextBlockIntoParagraph
} from './editor-blocks-block-flow-model.js';

export {
  autofixMarkdownSourceBlock,
  parseMarkdownBlocks
} from './editor-blocks-markdown-parse-model.js';

export {
  serializeMarkdownBlocks
} from './editor-blocks-markdown-serialize-model.js';

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

  const syncActiveListTypeSelect = (blockNodes = null) => {
    blockSessions.syncActiveTypeSelect(blockNodes);
  };

  const refreshLinkEditor = (explicitLink = null) => {
    blockSessions.refreshLinkEditor(explicitLink);
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

  const {
    handleCrossBlockArrowNavigation,
    routeBlocksCaretFromPointer,
    shouldSuppressRoutedBlockContainerClick
  } = createEditorBlocksFocusPointerSessions({
    state,
    blocksState,
    blockSessions,
    caretSession,
    editableSession,
    selectionSession,
    blockElements,
    closestElement,
    containsNode: nodeContains,
    editableListItems,
    setActive,
    activateEditableFromPointer,
    activateNonTextBlockFromPointer,
    autoSizeTextarea: area => autoSizeTextarea(area),
    updateInlineToolbarState: () => updateInlineToolbarState(),
    queueTask: task => queueMicrotask(task),
    measureLimit: CARET_POINT_MEASURE_LIMIT
  });

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

  const {
    inlineToolbarSession,
    createRichEditable,
    wireInlineEditable
  } = createEditorBlocksInlineSessions({
    documentRef: blocksDocument,
    root,
    list,
    runtime,
    state,
    blocksState,
    blockSessions,
    editableSession,
    selectionSession,
    caretSession,
    inlineDomSession,
    menuSession,
    text,
    renderMath: renderMathWithRuntime,
    containsNode: nodeContains,
    closestElement,
    setActive,
    setPlainContentEditableValue: setPlainContentEditableValueWithRuntime,
    editableText,
    getEditableSelectionOffsets,
    placeCaretAtTextOffset,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    refreshLinkEditor: link => refreshLinkEditor(link),
    openMathEditorForNode: node => openMathEditorForNode(node),
    updateFromControl,
    removeEmptyBlockWithBackspace,
    mergeTextBlockWithPreviousOnBackspace,
    handleCrossBlockArrowNavigation,
    splitTextBlockAfterCaret,
    insertBlankBlockAfter,
    activateEditableFromPointer,
    onDocument,
    onWindow
  });

  const {
    imageSession,
    codeSession,
    tableSession,
    sourceSession,
    listSession,
    syncActiveTableAlignmentFromEditable,
    renderers: blockTypeRenderers
  } = createEditorBlocksBlockTypeSessions({
    documentRef: blocksDocument,
    windowRef: blocksWindow,
    runtime,
    root,
    list,
    state,
    blocksState,
    blockSessions,
    editableSession,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: nodeContains,
    closestElement,
    text,
    blockElements,
    updateFromControl,
    insertBlock,
    deleteBlockAt,
    setActive,
    activateEditableFromPointer,
    handleCrossBlockArrowNavigation,
    removeEmptyBlockWithBackspace,
    applySourceAutofix: index => applySourceAutofix(index),
    autoSizeTextarea,
    resolveAssetSrc,
    hydrateImages,
    requestImageUpload: options.requestImageUpload,
    canDeleteImageResource: options.canDeleteImageResource,
    requestImageDelete: options.requestImageDelete,
    render,
    emit,
    focusBlockPrimaryEditable,
    defaultListItems,
    setPlainContentEditableValue: setPlainContentEditableValueWithRuntime,
    editableText,
    makeBlock,
    makeBlankBlock,
    makeSplitListBlock,
    markDirty,
    insertBlankBlock,
    updateInlineToolbarState,
    refreshLinkEditor,
    openMathEditorForNode,
    wireInlineEditable,
    measureLimit: CARET_POINT_MEASURE_LIMIT,
    queueTask: task => queueMicrotask(task)
  });

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
      ...blockTypeRenderers
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
