function noopSerialize(blocks) {
  return Array.isArray(blocks) ? blocks.map(block => block && block.raw ? String(block.raw) : '').join('') : '';
}

function defaultMakeBlock(type, raw = '', data = {}) {
  return {
    id: data.id || `block-${Math.random().toString(36).slice(2, 10)}`,
    type: type || 'source',
    raw: String(raw == null ? '' : raw),
    dirty: !!data.dirty,
    data: { ...data, id: undefined }
  };
}

function defaultMakeBlankBlock(after = '\n', data = {}) {
  const block = defaultMakeBlock('blank', '', { ...data, after: after || '\n' });
  block.dirty = !!data.dirty;
  return block;
}

function defaultSplitBlankLineUnits(value) {
  const text = String(value || '');
  if (!text) return [];
  const units = text.match(/[^\n]*\n/g) || [];
  return units.join('') === text ? units : [];
}

function clampIndex(index, length) {
  return Math.max(0, Math.min(Number(index) || 0, Math.max(0, length)));
}

function normalizeBlocks(blocks) {
  if (Array.isArray(blocks)) return blocks.filter(Boolean);
  return blocks ? [blocks] : [];
}

export function createEditorBlocksState() {
  return {
    blocks: [],
    activeIndex: -1,
    activeEditable: null,
    activeSync: null,
    activeLink: null,
    activeLinkHoldUntil: 0,
    linkEditMode: '',
    linkSelection: null,
    activeMath: null,
    activeMathBlockId: '',
    mathEditMode: '',
    mathSelection: null,
    lastInlineMarks: null,
    lastInlineMarkedRange: null,
    pendingInline: {},
    pendingListFocus: null,
    activeTableCell: null,
    suppressNextBlockContainerClickUntil: 0,
    suppressLinkEditorRefreshUntil: 0,
    suppressSelectionActiveRecoveryUntil: 0,
    cardEntries: [],
    cardPickerOpen: false,
    cardPickerInsertIndex: null,
    commandMenuOpen: false,
    commandMenuInsertIndex: null,
    reorderAnimating: false
  };
}

export function createEditorBlocksStateController({
  parseMarkdownBlocksRef = () => [],
  serializeMarkdownBlocksRef = noopSerialize,
  makeBlockRef = defaultMakeBlock,
  makeBlankBlockRef = defaultMakeBlankBlock,
  splitBlankLineUnitsRef = defaultSplitBlankLineUnits
} = {}) {
  const state = createEditorBlocksState();
  const makeBlock = typeof makeBlockRef === 'function' ? makeBlockRef : defaultMakeBlock;
  const makeBlankBlock = typeof makeBlankBlockRef === 'function' ? makeBlankBlockRef : defaultMakeBlankBlock;
  const splitBlankLineUnits = typeof splitBlankLineUnitsRef === 'function'
    ? splitBlankLineUnitsRef
    : defaultSplitBlankLineUnits;

  function markDirty(block) {
    if (!block) return null;
    block.data = block.data || {};
    block.dirty = true;
    if (block.data.after == null) block.data.after = '\n\n';
    return block;
  }

  function updateBlockData(block, patch = {}) {
    if (!block) return null;
    block.data = block.data || {};
    Object.assign(block.data, patch || {});
    return markDirty(block);
  }

  function clearActiveEditing() {
    state.activeEditable = null;
    state.activeSync = null;
  }

  function getActiveEditable() {
    return state.activeEditable;
  }

  function getActiveSync() {
    return state.activeSync;
  }

  function setActiveEditing(editable = null, sync = null) {
    state.activeEditable = editable || null;
    state.activeSync = sync || null;
    return {
      editable: state.activeEditable,
      sync: state.activeSync
    };
  }

  function invokeActiveSync() {
    if (typeof state.activeSync !== 'function') return false;
    state.activeSync();
    return true;
  }

  function resetTransientMenus({ clearActive = true } = {}) {
    state.commandMenuOpen = false;
    state.commandMenuInsertIndex = null;
    state.cardPickerOpen = false;
    state.cardPickerInsertIndex = null;
    if (clearActive) clearActiveEditing();
  }

  function clampActiveIndex(index) {
    const maxIndex = state.blocks.length - 1;
    const numericIndex = Number.isFinite(Number(index)) ? Number(index) : -1;
    return maxIndex >= 0 ? Math.max(-1, Math.min(numericIndex, maxIndex)) : -1;
  }

  function setActiveIndex(index) {
    state.activeIndex = clampActiveIndex(index);
    return state.activeIndex;
  }

  function setPendingListFocus(focus = null) {
    state.pendingListFocus = focus && typeof focus === 'object' ? { ...focus } : null;
    return state.pendingListFocus;
  }

  function takePendingListFocus(blockId, itemIndex) {
    const pending = state.pendingListFocus;
    if (!pending || pending.blockId !== blockId || pending.itemIndex !== itemIndex) return null;
    state.pendingListFocus = null;
    return pending;
  }

  function setActiveTableCell(blockId = '', position = null) {
    if (!blockId || !position) {
      state.activeTableCell = null;
      return null;
    }
    const row = Number.isFinite(Number(position.row)) ? Number(position.row) : 0;
    const col = Number.isFinite(Number(position.col)) ? Number(position.col) : 0;
    state.activeTableCell = {
      blockId: String(blockId),
      section: position.section === 'body' ? 'body' : 'header',
      row: Math.max(0, row),
      col: Math.max(0, col)
    };
    return { ...state.activeTableCell };
  }

  function clearActiveTableCell() {
    state.activeTableCell = null;
  }

  function getActiveTableCell() {
    return state.activeTableCell ? { ...state.activeTableCell } : null;
  }

  function getActiveTableCellForBlock(blockId = '') {
    return state.activeTableCell && state.activeTableCell.blockId === String(blockId || '')
      ? { ...state.activeTableCell }
      : null;
  }

  function activeTableCellMatches(blockId = '', position = null) {
    const active = getActiveTableCellForBlock(blockId);
    return !!active
      && !!position
      && active.section === position.section
      && active.row === position.row
      && active.col === position.col;
  }

  function setSelectionActiveRecoverySuppression(until) {
    state.suppressSelectionActiveRecoveryUntil = Number(until) || 0;
    return state.suppressSelectionActiveRecoveryUntil;
  }

  function selectionActiveRecoverySuppressed(now) {
    if (!state.suppressSelectionActiveRecoveryUntil) return false;
    if ((Number(now) || 0) <= state.suppressSelectionActiveRecoveryUntil) return true;
    state.suppressSelectionActiveRecoveryUntil = 0;
    return false;
  }

  function setRoutedBlockContainerClickSuppression(until) {
    state.suppressNextBlockContainerClickUntil = Number(until) || 0;
    return state.suppressNextBlockContainerClickUntil;
  }

  function consumeRoutedBlockContainerClickSuppression(now) {
    if (!state.suppressNextBlockContainerClickUntil) return false;
    if ((Number(now) || 0) > state.suppressNextBlockContainerClickUntil) {
      state.suppressNextBlockContainerClickUntil = 0;
      return false;
    }
    state.suppressNextBlockContainerClickUntil = 0;
    return true;
  }

  function resetEditorSession() {
    state.activeIndex = -1;
    clearActiveEditing();
    clearLinkEditorState();
    clearMathEditorState();
    clearInlineState();
    clearActiveTableCell();
    resetTransientMenus({ clearActive: false });
  }

  function clearLinkEditorState({ clearActiveLink = true, clearHold = true } = {}) {
    if (clearActiveLink) state.activeLink = null;
    if (clearHold) state.activeLinkHoldUntil = 0;
    state.linkEditMode = '';
    state.linkSelection = null;
  }

  function getLinkEditMode() {
    return state.linkEditMode;
  }

  function getLinkSelection() {
    return state.linkSelection;
  }

  function updateLinkSelection(patch = {}) {
    if (!state.linkSelection) return null;
    state.linkSelection = { ...state.linkSelection, ...(patch || {}) };
    return state.linkSelection;
  }

  function getActiveLink() {
    return state.activeLink;
  }

  function getActiveLinkHoldUntil() {
    return state.activeLinkHoldUntil;
  }

  function setActiveLink(link = null, options = {}) {
    state.activeLink = link || null;
    if (Object.prototype.hasOwnProperty.call(options || {}, 'holdUntil')) {
      state.activeLinkHoldUntil = Number(options.holdUntil) || 0;
    }
    return state.activeLink;
  }

  function clearActiveLink() {
    state.activeLink = null;
    state.activeLinkHoldUntil = 0;
  }

  function openDomLinkEditor(link = null, { holdUntil } = {}) {
    setActiveLink(link, { holdUntil });
    state.linkEditMode = 'dom';
    state.linkSelection = null;
    return state.activeLink;
  }

  function openLinkSelectionEditor(mode, selection = null) {
    state.activeLink = null;
    state.linkEditMode = mode || '';
    state.linkSelection = selection ? { ...selection } : null;
    return state.linkSelection;
  }

  function setLinkEditorRefreshSuppression(until) {
    state.suppressLinkEditorRefreshUntil = Number(until) || 0;
    return state.suppressLinkEditorRefreshUntil;
  }

  function linkEditorRefreshSuppressed(now) {
    if (!state.suppressLinkEditorRefreshUntil) return false;
    if ((Number(now) || 0) < state.suppressLinkEditorRefreshUntil) return true;
    state.suppressLinkEditorRefreshUntil = 0;
    return false;
  }

  function clearMathEditorState() {
    state.activeMath = null;
    state.activeMathBlockId = '';
    state.mathEditMode = '';
    state.mathSelection = null;
  }

  function getMathEditMode() {
    return state.mathEditMode;
  }

  function getMathSelection() {
    return state.mathSelection;
  }

  function updateMathSelection(patch = {}) {
    if (!state.mathSelection) return null;
    state.mathSelection = { ...state.mathSelection, ...(patch || {}) };
    return state.mathSelection;
  }

  function getActiveMath() {
    return state.activeMath;
  }

  function clearActiveMath() {
    state.activeMath = null;
  }

  function getActiveMathBlockId() {
    return state.activeMathBlockId;
  }

  function openInlineMathEditor(mathNode = null, selection = null) {
    state.activeMath = mathNode || null;
    state.activeMathBlockId = '';
    state.mathEditMode = 'range';
    state.mathSelection = selection ? { ...selection } : null;
    return state.mathSelection;
  }

  function openBlockMathEditor(blockId = '') {
    state.activeMath = null;
    state.activeMathBlockId = String(blockId || '');
    state.mathEditMode = 'block';
    state.mathSelection = null;
    return state.activeMathBlockId;
  }

  function hasPendingInlineMarks() {
    return !!(state.pendingInline.bold
      || state.pendingInline.italic
      || state.pendingInline.strike
      || state.pendingInline.link);
  }

  function pendingInlineMark(mark) {
    return state.pendingInline[mark];
  }

  function pendingInlineForRun() {
    return { ...state.pendingInline };
  }

  function setPendingInlinePatch(patch = {}) {
    state.pendingInline = { ...state.pendingInline, ...(patch || {}) };
    return state.pendingInline;
  }

  function clearPendingInline() {
    state.pendingInline = {};
    return state.pendingInline;
  }

  function clearRememberedInlineMarks() {
    state.lastInlineMarks = null;
    state.lastInlineMarkedRange = null;
  }

  function clearInlineState() {
    clearPendingInline();
    clearRememberedInlineMarks();
  }

  function togglePendingInlineMark(mark) {
    if (mark === 'code') return state.pendingInline;
    state.pendingInline = {
      ...state.pendingInline,
      code: false,
      [mark]: !state.pendingInline[mark]
    };
    return state.pendingInline;
  }

  function rememberInlineMarks(editable, marks = {}, markedRange = null) {
    state.lastInlineMarks = editable ? { editable, marks: { ...(marks || {}) } } : null;
    state.lastInlineMarkedRange = editable && markedRange ? { editable, ...markedRange } : null;
    return {
      marks: state.lastInlineMarks,
      range: state.lastInlineMarkedRange
    };
  }

  function rememberedInlineMarksFor(editable) {
    return state.lastInlineMarks && state.lastInlineMarks.editable === editable
      ? state.lastInlineMarks.marks
      : null;
  }

  function rememberedInlineRangeFor(editable, mark) {
    return state.lastInlineMarkedRange
      && state.lastInlineMarkedRange.editable === editable
      && state.lastInlineMarkedRange.mark === mark
      ? state.lastInlineMarkedRange
      : null;
  }

  function ensureSeparatorBeforeBlank(index) {
    const previous = Number.isInteger(index) ? state.blocks[index - 1] : null;
    if (!previous || previous.type === 'blank') return false;
    previous.data = previous.data || {};
    const after = String(previous.data.after != null ? previous.data.after : '\n\n');
    if (splitBlankLineUnits(after).length >= 2) return false;
    previous.data.after = '\n\n';
    previous.dirty = true;
    return true;
  }

  function ensureEditableBlankForEmptyDocument() {
    if (state.blocks.length) return null;
    const block = makeBlankBlock('\n', { dirty: true });
    state.blocks.push(block);
    return block;
  }

  function setMarkdown(markdown) {
    state.blocks = parseMarkdownBlocksRef(markdown);
    ensureEditableBlankForEmptyDocument();
    resetEditorSession();
    return state.blocks;
  }

  function serialize() {
    return serializeMarkdownBlocksRef(state.blocks);
  }

  function insertBlankBlock(index = state.blocks.length, options = {}) {
    const safeIndex = clampIndex(index, state.blocks.length);
    ensureSeparatorBeforeBlank(safeIndex);
    const block = makeBlankBlock('\n', { dirty: true });
    state.blocks.splice(safeIndex, 0, block);
    state.commandMenuOpen = !!options.command;
    state.commandMenuInsertIndex = options.command ? safeIndex : null;
    state.cardPickerOpen = false;
    state.cardPickerInsertIndex = null;
    clearActiveEditing();
    return { block, index: safeIndex };
  }

  function insertBlock(type, data = {}, index = state.activeIndex + 1) {
    const safeIndex = clampIndex(index, state.blocks.length);
    const block = makeBlock(type, '', { after: '\n\n', dirty: true, ...data });
    block.dirty = true;
    state.blocks.splice(safeIndex, 0, block);
    return { block, index: safeIndex };
  }

  function replaceBlocks(index, deleteCount = 1, blocks = [], options = {}) {
    const safeIndex = clampIndex(index, state.blocks.length);
    const safeDeleteCount = Math.max(0, Math.min(Number(deleteCount) || 0, state.blocks.length - safeIndex));
    const replacements = normalizeBlocks(blocks);
    state.blocks.splice(safeIndex, safeDeleteCount, ...replacements);
    if (options.resetTransient !== false) resetTransientMenus();
    if (Object.prototype.hasOwnProperty.call(options, 'pendingListFocus')) {
      setPendingListFocus(options.pendingListFocus);
    }
    if (Object.prototype.hasOwnProperty.call(options, 'activeIndex')) {
      setActiveIndex(options.activeIndex);
    }
    return {
      index: safeIndex,
      deleteCount: safeDeleteCount,
      blocks: replacements
    };
  }

  function removeBlock(index, options = {}) {
    const result = replaceBlocks(index, 1, [], options);
    if (result.deleteCount < 1) return null;
    if (!Object.prototype.hasOwnProperty.call(options, 'activeIndex')) {
      setActiveIndex(Math.min(result.index, state.blocks.length - 1));
    }
    return {
      index: result.index,
      activeIndex: state.activeIndex
    };
  }

  function placeCommandBlock(type, data = {}, index = state.blocks.length) {
    const safeIndex = clampIndex(index, state.blocks.length);
    const block = makeBlock(type, '', { after: '\n\n', dirty: true, ...data });
    block.dirty = true;
    if (state.blocks[safeIndex] && state.blocks[safeIndex].type === 'blank') {
      state.blocks.splice(safeIndex, 1, block);
      return { block, index: safeIndex, replacedBlank: true };
    }
    return { ...insertBlock(type, data, safeIndex), replacedBlank: false };
  }

  function moveBlock(index, direction) {
    const sourceIndex = Number(index);
    const targetIndex = sourceIndex + Number(direction || 0);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= state.blocks.length || targetIndex >= state.blocks.length) return null;
    const [moved] = state.blocks.splice(sourceIndex, 1);
    state.blocks.splice(targetIndex, 0, moved);
    state.activeIndex = targetIndex;
    return { targetIndex, block: moved };
  }

  function deleteBlock(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.blocks.length) return null;
    const [block] = state.blocks.splice(index, 1);
    state.activeIndex = Math.min(index, state.blocks.length - 1);
    return { block, index, activeIndex: state.activeIndex };
  }

  function openCommandMenu(insertIndex = state.blocks.length) {
    state.cardPickerOpen = false;
    state.cardPickerInsertIndex = null;
    state.commandMenuOpen = true;
    state.commandMenuInsertIndex = clampIndex(insertIndex, state.blocks.length);
    return state.commandMenuInsertIndex;
  }

  function closeCommandMenu() {
    if (!state.commandMenuOpen) return null;
    state.commandMenuOpen = false;
    const restoreIndex = state.commandMenuInsertIndex;
    state.commandMenuInsertIndex = null;
    return restoreIndex;
  }

  function beginCommandBlockInsert(options = {}) {
    const insertIndex = Number.isInteger(options.index)
      ? options.index
      : (Number.isInteger(state.commandMenuInsertIndex) ? state.commandMenuInsertIndex : state.blocks.length);
    state.commandMenuOpen = false;
    state.commandMenuInsertIndex = null;
    state.cardPickerOpen = false;
    state.cardPickerInsertIndex = null;
    return clampIndex(insertIndex, state.blocks.length);
  }

  function openCardPicker(insertIndex = state.blocks.length) {
    state.commandMenuOpen = false;
    state.commandMenuInsertIndex = null;
    state.cardPickerInsertIndex = clampIndex(insertIndex, state.blocks.length);
    state.cardPickerOpen = true;
    return state.cardPickerInsertIndex;
  }

  function closeCardPicker() {
    state.cardPickerOpen = false;
    state.cardPickerInsertIndex = null;
  }

  function setCardEntries(entries = []) {
    state.cardEntries = Array.isArray(entries) ? entries.slice() : [];
    return state.cardEntries.slice();
  }

  function getCardEntries() {
    return state.cardEntries.slice();
  }

  function getCardPickerState() {
    return {
      open: !!state.cardPickerOpen,
      insertIndex: state.cardPickerInsertIndex,
      entries: getCardEntries(),
      blockCount: state.blocks.length
    };
  }

  function resolveBlockTarget(target = state.activeIndex, predicate = () => true) {
    const targetIndex = target && typeof target === 'object' ? target.index : target;
    const expectedBlockId = target && typeof target === 'object' && typeof target.blockId === 'string'
      ? target.blockId
      : '';
    let safeIndex = Number.isInteger(targetIndex) ? targetIndex : state.activeIndex;
    if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= state.blocks.length) {
      if (!expectedBlockId) return null;
      safeIndex = state.blocks.findIndex(item => item && item.id === expectedBlockId);
      if (safeIndex < 0) return null;
    }
    let block = state.blocks[safeIndex];
    if (expectedBlockId && (!block || block.id !== expectedBlockId)) {
      safeIndex = state.blocks.findIndex(item => item && item.id === expectedBlockId);
      if (safeIndex < 0) return null;
      block = state.blocks[safeIndex];
    }
    if (!block || !predicate(block)) return null;
    return { block, index: safeIndex };
  }

  return {
    state,
    markDirty,
    updateBlockData,
    setActiveIndex,
    getActiveEditable,
    getActiveSync,
    setActiveEditing,
    clearActiveEditing,
    invokeActiveSync,
    resetTransientMenus,
    clearLinkEditorState,
    getLinkEditMode,
    getLinkSelection,
    updateLinkSelection,
    getActiveLink,
    getActiveLinkHoldUntil,
    setActiveLink,
    clearActiveLink,
    openDomLinkEditor,
    openLinkSelectionEditor,
    setLinkEditorRefreshSuppression,
    linkEditorRefreshSuppressed,
    clearMathEditorState,
    getMathEditMode,
    getMathSelection,
    updateMathSelection,
    getActiveMath,
    clearActiveMath,
    getActiveMathBlockId,
    openInlineMathEditor,
    openBlockMathEditor,
    hasPendingInlineMarks,
    pendingInlineMark,
    pendingInlineForRun,
    setPendingInlinePatch,
    clearPendingInline,
    clearRememberedInlineMarks,
    clearInlineState,
    togglePendingInlineMark,
    rememberInlineMarks,
    rememberedInlineMarksFor,
    rememberedInlineRangeFor,
    setPendingListFocus,
    takePendingListFocus,
    setActiveTableCell,
    clearActiveTableCell,
    getActiveTableCell,
    getActiveTableCellForBlock,
    activeTableCellMatches,
    setSelectionActiveRecoverySuppression,
    selectionActiveRecoverySuppressed,
    setRoutedBlockContainerClickSuppression,
    consumeRoutedBlockContainerClickSuppression,
    ensureSeparatorBeforeBlank,
    ensureEditableBlankForEmptyDocument,
    setMarkdown,
    serialize,
    insertBlankBlock,
    insertBlock,
    replaceBlocks,
    removeBlock,
    placeCommandBlock,
    moveBlock,
    deleteBlock,
    openCommandMenu,
    closeCommandMenu,
    beginCommandBlockInsert,
    openCardPicker,
    closeCardPicker,
    setCardEntries,
    getCardEntries,
    getCardPickerState,
    resolveBlockTarget
  };
}
