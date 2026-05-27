// DOM-free visual-list parsing, serialization, and editing helpers.

import {
  inlineRenderedTextLength,
  normalizeEditableMarkdownText
} from './editor-blocks-inline-model.js';

function lineWithoutTerminator(line) {
  return String(line || '').replace(/\n$/, '');
}

export function indentationColumn(value) {
  return String(value || '').replace(/\t/g, '    ').length;
}

export function isListItemLine(line) {
  const text = lineWithoutTerminator(line);
  return /^([ \t]*)([-*])\s+\[([ xX])\]\s+.+$/.test(text)
    || /^([ \t]*)([-*+])\s+.+$/.test(text)
    || /^([ \t]*)(\d{1,9})([\.)])\s+.+$/.test(text);
}

export function normalizeStandardListType(value, fallback = 'ul') {
  if (value === 'ol') return 'ol';
  if (value === 'ul') return 'ul';
  return fallback === 'ol' ? 'ol' : 'ul';
}

export function normalizeListItemType(value, fallback = 'ul') {
  if (value === 'task') return 'task';
  if (fallback === 'task' && value !== 'ol' && value !== 'ul') return 'task';
  return normalizeStandardListType(value, fallback);
}

export function effectiveListItemType(item, blockListType = 'ul') {
  return normalizeListItemType(item && item.listType, blockListType);
}

export function summarizeListType(items, fallback = 'ul') {
  const safeItems = Array.isArray(items) ? items : [];
  const types = new Set(safeItems.map(item => effectiveListItemType(item, fallback)));
  if (types.size > 1) return 'mixed';
  if (types.has('task')) return 'task';
  return types.has('ol') ? 'ol' : 'ul';
}

export function itemIndentLevel(item) {
  return Math.max(0, Number(item && item.indent) || 0);
}

function itemIndentText(item) {
  return item && typeof item.indentText === 'string'
    ? item.indentText
    : '  '.repeat(itemIndentLevel(item));
}

function nextOrderedListNumber(item, counters) {
  const key = String(itemIndentLevel(item));
  const explicit = Number(item && item.number);
  if (explicit > 0) {
    counters[key] = explicit;
    return explicit;
  }
  const next = Math.max(0, Number(counters[key]) || 0) + 1;
  counters[key] = next;
  return next;
}

function resetOrderedListNumber(item, counters) {
  counters[String(itemIndentLevel(item))] = 0;
}

function resetNestedOrderedListNumbers(item, counters) {
  const indent = itemIndentLevel(item);
  Object.keys(counters || {}).forEach(key => {
    if ((Number(key) || 0) > indent) delete counters[key];
  });
}

export function parseListLineInfo(line) {
  const text = String(line || '');
  let match = text.match(/^([ \t]*)([-*])\s+\[([ xX])\]\s+(.+)$/);
  if (match) return { kind: 'task', indentColumn: indentationColumn(match[1]) };
  match = text.match(/^([ \t]*)([-*+])\s+(.+)$/);
  if (match) return { kind: 'ul', indentColumn: indentationColumn(match[1]) };
  match = text.match(/^([ \t]*)(\d{1,9})([\.)])\s+(.+)$/);
  if (match) return { kind: 'ol', indentColumn: indentationColumn(match[1]) };
  return null;
}

export function parseListBlock(raw) {
  const lines = String(raw || '').split('\n');
  if (!lines.length) return null;
  const items = [];
  for (const line of lines) {
    let match = line.match(/^([ \t]*)([-*])\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      items.push({
        listType: 'task',
        checked: match[3].toLowerCase() === 'x',
        text: match[4] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1]),
        marker: match[2] || '-'
      });
      continue;
    }
    match = line.match(/^([ \t]*)([-*+])\s+(.+)$/);
    if (match) {
      items.push({
        listType: 'ul',
        text: match[3] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1]),
        marker: match[2] || '-'
      });
      continue;
    }
    match = line.match(/^([ \t]*)(\d{1,9})([\.)])\s+(.+)$/);
    if (match) {
      items.push({
        listType: 'ol',
        number: Number(match[2]),
        delimiter: match[3] || '.',
        text: match[4] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1])
      });
      continue;
    }
    return null;
  }
  const indentColumns = [...new Set(items.map(item => item.indentColumn || 0))].sort((a, b) => a - b);
  if (indentColumns[0] !== 0) return null;
  items.forEach(item => {
    item.indent = Math.max(0, indentColumns.indexOf(item.indentColumn || 0));
    delete item.indentColumn;
  });
  return items.length ? { listType: summarizeListType(items), items } : null;
}

export function serializeList(data = {}) {
  const items = Array.isArray(data.items) ? data.items : [];
  const listType = data.listType === 'ol' || data.listType === 'task' || data.listType === 'mixed' ? data.listType : 'ul';
  const orderedCounters = {};
  return items.map((item) => {
    const rawText = String(item && item.text != null ? item.text : '');
    const text = rawText === '' ? 'List item' : rawText;
    const indent = itemIndentText(item);
    const itemType = effectiveListItemType(item, listType);
    resetNestedOrderedListNumbers(item, orderedCounters);
    if (itemType === 'task') {
      const marker = item && /^[-*+]$/.test(item.marker || '') ? item.marker : '-';
      resetOrderedListNumber(item, orderedCounters);
      return `${indent}${marker === '+' ? '-' : marker} [${item && item.checked ? 'x' : ' '}] ${text}`;
    }
    if (itemType === 'ol') {
      const number = nextOrderedListNumber(item, orderedCounters);
      const delimiter = item && /^[.)]$/.test(item.delimiter || '') ? item.delimiter : '.';
      return `${indent}${number}${delimiter} ${text}`;
    }
    const marker = item && /^[-*+]$/.test(item.marker || '') ? item.marker : '-';
    resetOrderedListNumber(item, orderedCounters);
    return `${indent}${marker} ${text}`;
  }).join('\n');
}

export function defaultListItems() {
  return [{ text: 'List item', checked: false, listType: 'ul' }];
}

export function editableListItems(items) {
  return Array.isArray(items) && items.length ? items : defaultListItems();
}

export function patchListItem(items, itemIndex, patch = {}) {
  const next = editableListItems(items).slice();
  const safeIndex = Math.max(0, Math.min(Number(itemIndex) || 0, next.length - 1));
  next[safeIndex] = { ...(next[safeIndex] || {}), ...(patch || {}) };
  return next;
}

export function splitListItemsAtEmptyItem(items, itemIndex) {
  const source = Array.isArray(items) && items.length ? items.slice() : editableListItems(items).slice();
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= source.length) return null;
  const current = source[safeIndex] || {};
  if (String(current.text == null ? '' : current.text).trim() !== '') return null;
  if (itemIndentLevel(current) > 0) return null;
  return {
    before: source.slice(0, safeIndex),
    after: source.slice(safeIndex + 1)
  };
}

export function convertListTailItemAfterEmptyToParagraph(items, itemIndex) {
  const source = Array.isArray(items) && items.length ? items.slice() : editableListItems(items).slice();
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex <= 0 || safeIndex !== source.length - 1) return null;
  const previous = source[safeIndex - 1] || {};
  const current = source[safeIndex] || {};
  if (itemIndentLevel(previous) !== 0 || itemIndentLevel(current) !== 0) return null;
  if (String(previous.text == null ? '' : previous.text).trim() !== '') return null;
  const text = normalizeEditableMarkdownText(current.text);
  if (!String(text).trim()) return null;
  return {
    before: source.slice(0, safeIndex - 1),
    text
  };
}

export function outdentEmptyListItemForEnter(items, itemIndex) {
  const source = Array.isArray(items) && items.length ? items.slice() : editableListItems(items).slice();
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= source.length) return null;
  const current = source[safeIndex] || {};
  if (String(current.text == null ? '' : current.text).trim() !== '') return null;
  const currentIndent = itemIndentLevel(current);
  if (currentIndent <= 0) return null;
  const nextIndent = currentIndent - 1;
  const next = source.slice();
  next[safeIndex] = {
    ...current,
    text: '',
    indent: nextIndent,
    indentText: '  '.repeat(nextIndent)
  };
  return next;
}

export function normalizeSplitListStartItems(items) {
  const source = Array.isArray(items) ? items.slice() : [];
  if (!source.length) return source;
  const baseIndent = itemIndentLevel(source[0]);
  if (baseIndent <= 0) return source;
  return source.map(item => {
    const nextIndent = Math.max(0, itemIndentLevel(item) - baseIndent);
    return {
      ...(item || {}),
      indent: nextIndent,
      indentText: '  '.repeat(nextIndent)
    };
  });
}

export function listVisualMarkerLabels(items, blockListType = 'ul') {
  const listType = blockListType === 'ol' || blockListType === 'task' || blockListType === 'mixed' ? blockListType : 'ul';
  const counters = {};
  return editableListItems(items).map(item => {
    const itemType = effectiveListItemType(item, listType);
    resetNestedOrderedListNumbers(item, counters);
    if (itemType === 'task') {
      resetOrderedListNumber(item, counters);
      return '';
    }
    if (itemType === 'ol') {
      const delimiter = item && /^[.)]$/.test(item.delimiter || '') ? item.delimiter : '.';
      return `${nextOrderedListNumber(item, counters)}${delimiter}`;
    }
    resetOrderedListNumber(item, counters);
    return '•';
  });
}

export function patchListItemType(items, itemIndex, nextType, blockListType = 'ul') {
  const normalizedType = normalizeListItemType(nextType);
  const next = editableListItems(items).slice();
  const safeIndex = Math.max(0, Math.min(Number(itemIndex) || 0, next.length - 1));
  const targetIndent = itemIndentLevel(next[safeIndex]);
  let groupStart = 0;
  for (let index = safeIndex - 1; index >= 0; index -= 1) {
    if (itemIndentLevel(next[index]) < targetIndent) {
      groupStart = index + 1;
      break;
    }
  }
  let groupEnd = next.length;
  for (let index = safeIndex + 1; index < next.length; index += 1) {
    if (itemIndentLevel(next[index]) < targetIndent) {
      groupEnd = index;
      break;
    }
  }
  const sameIndentIndexes = next.slice(groupStart, groupEnd)
    .map((item, index) => itemIndentLevel(item) === targetIndent ? index : -1)
    .filter(index => index >= 0)
    .map(index => index + groupStart);
  const typesAtIndent = new Set(sameIndentIndexes.map(index => effectiveListItemType(next[index], blockListType)));
  const targetIndexes = typesAtIndent.size === 1 ? sameIndentIndexes : [safeIndex];

  targetIndexes.forEach(index => {
    const item = next[index] || {};
    next[index] = {
      ...item,
      listType: normalizedType
    };
    if (normalizedType === 'task') next[index].checked = !!(item && item.checked);
    if (normalizedType === 'ul' && !/^[-*+]$/.test(next[index].marker || '')) next[index].marker = '-';
    if (normalizedType === 'ol' && !/^[.)]$/.test(next[index].delimiter || '')) next[index].delimiter = '.';
  });

  return {
    listType: summarizeListType(next, normalizeListItemType(blockListType)),
    items: next
  };
}

export function patchStandardListItemType(items, itemIndex, nextType, blockListType = 'ul') {
  return patchListItemType(items, itemIndex, nextType, blockListType);
}

export function isMergeableListBlock(block) {
  return !!(block && block.type === 'list');
}

export function listBlockItems(block) {
  return editableListItems(block && block.data ? block.data.items : null).slice();
}

export function listItemText(item) {
  return normalizeEditableMarkdownText(item && item.text);
}

export function listItemHasNestedChildren(items, itemIndex) {
  const source = Array.isArray(items) ? items : [];
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= source.length) return false;
  const currentIndent = itemIndentLevel(source[safeIndex]);
  for (let index = safeIndex + 1; index < source.length; index += 1) {
    const nextIndent = itemIndentLevel(source[index]);
    if (nextIndent <= currentIndent) return false;
    return true;
  }
  return false;
}

export function mergeListItemIntoPreviousItem(items, itemIndex) {
  const source = Array.isArray(items) && items.length ? items.slice() : editableListItems(items).slice();
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex <= 0 || safeIndex >= source.length) return null;
  const previous = source[safeIndex - 1] || {};
  const current = source[safeIndex] || {};
  if (itemIndentLevel(previous) !== itemIndentLevel(current)) return null;
  if (listItemHasNestedChildren(source, safeIndex)) return null;
  const next = source.slice();
  const previousText = listItemText(previous);
  const mergedText = joinMergedListItemText(previousText, listItemText(current));
  const caretOffset = inlineRenderedTextLength(previousText) + mergedText.separator.length;
  next[safeIndex - 1] = {
    ...previous,
    text: mergedText.text
  };
  next.splice(safeIndex, 1);
  return {
    items: next,
    focusItemIndex: safeIndex - 1,
    caretOffset
  };
}

function joinMergedListItemText(before, after) {
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

function normalizeListText(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function removeIndentColumns(line, columns) {
  const target = Math.max(0, Number(columns) || 0);
  if (!target) return String(line || '');
  const text = String(line || '');
  let index = 0;
  let removed = 0;
  while (index < text.length && removed < target) {
    const char = text[index];
    if (char === ' ') {
      index += 1;
      removed += 1;
      continue;
    }
    if (char === '\t') {
      if (removed + 4 > target) break;
      index += 1;
      removed += 4;
      continue;
    }
    break;
  }
  return text.slice(index);
}

export function dedentIndentedListSource(raw) {
  const lines = normalizeListText(raw).split('\n');
  const indents = [];
  lines.forEach(line => {
    const match = String(line || '').match(/^([ \t]+)(?:[-*]\s+\[[ xX]\]\s+|[-*+]\s+|\d{1,9}[\.)]\s+)/);
    if (match) indents.push(indentationColumn(match[1] || ''));
  });
  const minIndent = indents.length ? Math.min(...indents) : 0;
  if (minIndent <= 0) return '';
  return lines.map(line => removeIndentColumns(line, minIndent)).join('\n');
}
