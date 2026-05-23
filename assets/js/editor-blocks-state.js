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
    reorderAnimating: false,
    openActionMenu: null,
    openInlineMenu: null
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

  function resetTransientMenus({ clearActive = true } = {}) {
    state.commandMenuOpen = false;
    state.commandMenuInsertIndex = null;
    state.cardPickerOpen = false;
    state.cardPickerInsertIndex = null;
    if (clearActive) clearActiveEditing();
  }

  function resetEditorSession() {
    state.activeIndex = -1;
    clearActiveEditing();
    state.activeLink = null;
    state.activeLinkHoldUntil = 0;
    state.linkEditMode = '';
    state.linkSelection = null;
    state.activeMath = null;
    state.activeMathBlockId = '';
    state.mathEditMode = '';
    state.mathSelection = null;
    state.pendingInline = {};
    state.lastInlineMarks = null;
    state.lastInlineMarkedRange = null;
    state.activeTableCell = null;
    resetTransientMenus({ clearActive: false });
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
    resetTransientMenus,
    ensureSeparatorBeforeBlank,
    ensureEditableBlankForEmptyDocument,
    setMarkdown,
    serialize,
    insertBlankBlock,
    insertBlock,
    placeCommandBlock,
    moveBlock,
    deleteBlock,
    openCommandMenu,
    closeCommandMenu,
    beginCommandBlockInsert,
    openCardPicker,
    closeCardPicker,
    resolveBlockTarget
  };
}
