// DOM-free block editing flow helpers for Enter, Backspace, and cross-block merges.

import {
  inlineRenderedTextLength,
  normalizeEditableMarkdownText
} from './editor-blocks-inline-model.js';
import {
  editableListItems,
  isMergeableListBlock,
  itemIndentLevel,
  listBlockItems,
  listItemHasNestedChildren,
  listItemText
} from './editor-blocks-list-model.js';
import {
  editableTableData
} from './editor-blocks-table-model.js';

function makeFlowBlock(type, raw, data = {}) {
  return {
    id: data.id || `block-${Math.random().toString(36).slice(2, 10)}`,
    type,
    raw: String(raw == null ? '' : raw),
    dirty: !!data.dirty,
    data: { ...data, id: undefined }
  };
}

export function isBlockEmptyForBackspace(block) {
  if (!block || typeof block !== 'object') return false;
  const data = block.data || {};
  const blank = (value) => String(value == null ? '' : value).trim() === '';
  if (block.type === 'blank') return true;
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') return blank(data.text);
  if (block.type === 'code' || block.type === 'source') return blank(data.text != null ? data.text : block.raw);
  if (block.type === 'math') return blank(data.tex);
  if (block.type === 'image') return blank(data.src) && blank(data.alt) && blank(data.title);
  if (block.type === 'card') return blank(data.location) && blank(data.label) && blank(data.title);
  if (block.type === 'table') {
    const table = editableTableData(data);
    return table.headers.every(blank) && table.rows.every(row => row.every(blank));
  }
  if (block.type === 'list') {
    return editableListItems(data.items).every(item => blank(item && item.text) && !item.checked);
  }
  return false;
}

export function splitTextBlockIntoParagraph(block, before, after) {
  if (!block || !['paragraph', 'heading', 'quote'].includes(block.type)) return null;
  const data = block.data && typeof block.data === 'object' ? block.data : {};
  const current = {
    ...block,
    dirty: true,
    data: {
      ...data,
      text: normalizeEditableMarkdownText(before)
    }
  };
  const next = makeFlowBlock('paragraph', '', {
    text: normalizeEditableMarkdownText(after),
    after: '\n\n',
    dirty: true
  });
  next.dirty = true;
  return [current, next];
}

export function isMergeableTextBlock(block) {
  return !!(block && ['paragraph', 'heading', 'quote'].includes(block.type));
}

function textBlockDataText(block) {
  return normalizeEditableMarkdownText(block && block.data ? block.data.text : '');
}

export function joinMergedEditableText(before, after) {
  const left = normalizeEditableMarkdownText(before);
  const right = normalizeEditableMarkdownText(after);
  if (!left) return { text: right, separator: '' };
  if (!right) return { text: left, separator: '' };
  const separator = /\s$/.test(left) || /^\s/.test(right) ? '' : ' ';
  return {
    text: `${left}${separator}${right}`,
    separator
  };
}

export function mergeTextBlockIntoPrevious(previousBlock, currentBlock) {
  if (!isMergeableTextBlock(previousBlock) || !isMergeableTextBlock(currentBlock)) return null;
  const previousText = textBlockDataText(previousBlock);
  const currentText = textBlockDataText(currentBlock);
  const mergedText = joinMergedEditableText(previousText, currentText);
  return {
    ...previousBlock,
    dirty: true,
    focusCaretOffset: inlineRenderedTextLength(previousText) + mergedText.separator.length,
    data: {
      ...(previousBlock.data && typeof previousBlock.data === 'object' ? previousBlock.data : {}),
      text: mergedText.text
    }
  };
}

export function mergeTextBlockIntoPreviousList(previousBlock, currentBlock) {
  if (!isMergeableListBlock(previousBlock) || !isMergeableTextBlock(currentBlock)) return null;
  const items = listBlockItems(previousBlock);
  if (!items.length) return null;
  const lastIndex = items.length - 1;
  const previousText = listItemText(items[lastIndex]);
  const currentText = textBlockDataText(currentBlock);
  const mergedText = joinMergedEditableText(previousText, currentText);
  items[lastIndex] = {
    ...(items[lastIndex] || {}),
    text: mergedText.text
  };
  return {
    ...previousBlock,
    dirty: true,
    focusItemIndex: lastIndex,
    focusCaretOffset: inlineRenderedTextLength(previousText) + mergedText.separator.length,
    data: {
      ...(previousBlock.data && typeof previousBlock.data === 'object' ? previousBlock.data : {}),
      items
    }
  };
}

export function mergeFirstListItemIntoPreviousBlock(previousBlock, currentBlock, itemIndex = 0) {
  if (!currentBlock || currentBlock.type !== 'list') return null;
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex !== 0) return null;
  if (!isMergeableTextBlock(previousBlock) && !isMergeableListBlock(previousBlock)) return null;
  const items = listBlockItems(currentBlock);
  const currentItem = items[0] || {};
  if (itemIndentLevel(currentItem) !== 0 || listItemHasNestedChildren(items, 0)) return null;
  const currentText = listItemText(currentItem);
  const remainingItems = items.slice(1);
  if (isMergeableTextBlock(previousBlock)) {
    const previousText = textBlockDataText(previousBlock);
    const mergedText = joinMergedEditableText(previousText, currentText);
    return {
      previousBlock: {
        ...previousBlock,
        dirty: true,
        data: {
          ...(previousBlock.data && typeof previousBlock.data === 'object' ? previousBlock.data : {}),
          text: mergedText.text
        }
      },
      currentBlock: remainingItems.length
        ? {
            ...currentBlock,
            dirty: true,
            data: {
              ...(currentBlock.data && typeof currentBlock.data === 'object' ? currentBlock.data : {}),
              items: remainingItems
            }
          }
        : null,
      focus: { type: 'text', caretOffset: inlineRenderedTextLength(previousText) + mergedText.separator.length }
    };
  }
  const previousItems = listBlockItems(previousBlock);
  if (!previousItems.length) return null;
  const lastIndex = previousItems.length - 1;
  const previousText = listItemText(previousItems[lastIndex]);
  const mergedText = joinMergedEditableText(previousText, currentText);
  previousItems[lastIndex] = {
    ...(previousItems[lastIndex] || {}),
    text: mergedText.text
  };
  return {
    previousBlock: {
      ...previousBlock,
      dirty: true,
      data: {
        ...(previousBlock.data && typeof previousBlock.data === 'object' ? previousBlock.data : {}),
        items: previousItems
      }
    },
    currentBlock: remainingItems.length
      ? {
          ...currentBlock,
          dirty: true,
          data: {
            ...(currentBlock.data && typeof currentBlock.data === 'object' ? currentBlock.data : {}),
            items: remainingItems
          }
        }
      : null,
    focus: { type: 'list', itemIndex: lastIndex, caretOffset: inlineRenderedTextLength(previousText) + mergedText.separator.length }
  };
}
