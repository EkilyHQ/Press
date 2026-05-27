import {
  editableListItems,
  isMergeableListBlock,
  listBlockItems
} from './editor-blocks-list-model.js';
import {
  isBlockEmptyForBackspace,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
  splitTextBlockIntoParagraph
} from './editor-blocks-block-flow-model.js';
import {
  makeBlock
} from './editor-blocks-block-core-model.js';
import {
  autofixMarkdownSourceBlock
} from './editor-blocks-markdown-parse-model.js';
import {
  editableVisibleText,
  isEditableBackspaceAtEmptyStart,
  isEditableSelectionAtStart,
  isEditableSelectionOnBlankLine,
  splitEditableTextAtSelection
} from './editor-blocks-inline-editing-bridge.js';

const plainKey = (event, key) => event
  && event.key === key
  && !event.shiftKey
  && !event.altKey
  && !event.ctrlKey
  && !event.metaKey
  && !event.isComposing;

export function createEditorBlocksBlockActions({
  state,
  blocksState,
  blockSessions,
  caretSession,
  selectionSession,
  getEditableSelectionOffsets,
  focusBlockPrimaryEditable,
  focusPreviousBlockEnd,
  render,
  setActive,
  emit,
  queueTask
}) {
  const scheduleTask = typeof queueTask === 'function' ? queueTask : task => queueMicrotask(task);

  const insertBlankBlock = (index = state.blocks.length, options = {}) => {
    const { block } = blocksState.insertBlankBlock(index, options);
    render();
    if (options.command) {
      scheduleTask(() => {
        blockSessions.focusFirstCommandItem(block.id);
      });
    } else if (options.focus !== false) {
      focusBlockPrimaryEditable(block, 0);
    }
    emit();
    return block;
  };

  const insertBlankBlockAfter = (index, editable = null, sync = null) => {
    if (typeof sync === 'function') sync();
    insertBlankBlock(Math.max(0, Math.min((Number(index) || 0) + 1, state.blocks.length)), { focus: true });
  };

  const splitTextBlockAfterCaret = (event, block, index, editable = null) => {
    if (!plainKey(event, 'Enter')) return false;
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
    if (!plainKey(event, 'Backspace')) return false;
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

  const removeEmptyBlockWithBackspace = (event, block, index, editable = null, sync = null) => {
    if (!plainKey(event, 'Backspace')) return false;
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

  const applySourceAutofix = (index) => {
    const block = state.blocks[index];
    const nextBlocks = autofixMarkdownSourceBlock(block);
    if (!nextBlocks.length) return;
    blocksState.replaceBlocks(index, 1, nextBlocks, { activeIndex: index });
    render();
    setActive(index);
    emit();
  };

  return {
    insertBlankBlock,
    insertBlankBlockAfter,
    splitTextBlockAfterCaret,
    mergeTextBlockWithPreviousOnBackspace,
    deleteBlockAt,
    makeSplitListBlock,
    removeEmptyBlockWithBackspace,
    applySourceAutofix
  };
}
