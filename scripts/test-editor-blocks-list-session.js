import assert from 'node:assert/strict';
import { createEditorBlocksListSession } from '../assets/js/editor-blocks-list-session.js';

function classSet(node) {
  return new Set(String(node.className || '').split(/\s+/).filter(Boolean));
}

function makeElement(tagName = 'div', className = '') {
  const listeners = new Map();
  const attrs = {};
  const children = [];
  const node = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    className,
    textContent: '',
    contentEditable: '',
    spellcheck: true,
    type: '',
    value: '',
    checked: false,
    dataset: {},
    attrs,
    style: {},
    children,
    focusCalls: [],
    append(...items) {
      items.flat().forEach(item => {
        if (!item) return;
        const next = item.nodeType === 11 ? item.children.slice() : [item];
        next.forEach(child => {
          child.parentNode = node;
          child.parentElement = node;
          children.push(child);
        });
      });
    },
    appendChild(item) {
      node.append(item);
      return item;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
        node.dataset[key] = String(value);
      }
    },
    getAttribute(name) {
      return attrs[name] || '';
    },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatch(type, event = {}) {
      let defaultPrevented = false;
      const dispatched = {
        preventDefault() { defaultPrevented = true; },
        target: node,
        ...event
      };
      const results = (listeners.get(type) || []).map(handler => handler(dispatched));
      return { defaultPrevented, results };
    },
    focus(options) {
      node.focusCalls.push(options || null);
    },
    matches(selector) {
      return matchesSimple(node, selector);
    },
    closest(selector) {
      let current = node;
      while (current) {
        if (current.matches && current.matches(selector)) return current;
        current = current.parentElement || current.parentNode || null;
      }
      return null;
    },
    querySelector(selector) {
      return querySelectorAllFrom(node, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return querySelectorAllFrom(node, selector);
    }
  };
  return node;
}

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    }
  };
}

function matchesSimple(node, selector) {
  let source = String(selector || '').trim();
  if (!source) return false;
  const nth = source.match(/:nth-child\((\d+)\)/);
  if (nth) {
    const expected = Number(nth[1]);
    const siblings = node.parentElement && node.parentElement.children ? node.parentElement.children : [];
    if (siblings.indexOf(node) !== expected - 1) return false;
    source = source.replace(/:nth-child\(\d+\)/, '');
  }
  const attr = source.match(/\[([^=\]]+)="([^"]*)"\]/);
  if (attr) {
    if (String(node[attr[1]] || node.getAttribute?.(attr[1]) || '') !== attr[2]) return false;
    source = source.replace(attr[0], '');
  }
  const tag = source.match(/^[A-Za-z][A-Za-z0-9-]*/);
  if (tag && node.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
  const classes = Array.from(source.matchAll(/\.([A-Za-z0-9_-]+)/g)).map(match => match[1]);
  return classes.every(name => classSet(node).has(name));
}

function matchesSelectorChain(node, parts) {
  if (!node || !matchesSimple(node, parts[parts.length - 1])) return false;
  let current = node.parentElement || node.parentNode || null;
  for (let partIndex = parts.length - 2; partIndex >= 0; partIndex -= 1) {
    while (current && !matchesSimple(current, parts[partIndex])) {
      current = current.parentElement || current.parentNode || null;
    }
    if (!current) return false;
    current = current.parentElement || current.parentNode || null;
  }
  return true;
}

function querySelectorAllFrom(root, selector) {
  const parts = String(selector || '').trim().split(/\s+/).filter(Boolean);
  const out = [];
  const stack = [...(root.children || [])];
  while (stack.length) {
    const child = stack.shift();
    if (matchesSelectorChain(child, parts)) out.push(child);
    if (child.children) stack.push(...child.children);
  }
  return out;
}

const documentRef = makeDocumentRef();
const root = documentRef.createElement('div');
const registered = [];
const updates = [];
const active = [];
const pointerActivations = [];
const inlineRemembered = [];
const toolbarUpdates = [];
const queued = [];
const wired = [];
const pending = [];
const crossBlockArrows = [];
const visualCaret = [];
const textCarets = [];
const startCarets = [];
const endCarets = [];
const focusedBlocks = [];
const renders = [];
const emitted = [];
const marks = [];
const links = [];
let activeEditable = null;
let removeEmpty = () => false;
let atStart = () => false;
let edgeLine = () => false;
let splitSelection = () => ({ before: 'one', after: 'after' });
let outdentResult = null;
let emptySplitResult = null;
let trailingParagraph = null;
let mergeItemResult = null;
let mergeFirstResult = null;
const state = { blocks: [], pendingListFocus: null };
const block = {
  id: 'list-1',
  type: 'list',
  data: {
    listType: 'mixed',
    items: [
      { text: 'one', listType: 'ul', indent: 0 },
      { text: 'done', listType: 'task', checked: false, indent: 1 }
    ]
  }
};
state.blocks = [{ id: 'intro', type: 'paragraph', data: { text: 'Intro' } }, block];

const blocksState = {
  getActiveEditable() {
    return activeEditable;
  },
  setPendingListFocus(value) {
    pending.push(value);
    state.pendingListFocus = value;
  },
  replaceBlocks(...args) {
    pending.push(['replace', args]);
  },
  rememberInlineMarks(editable, rememberedMarks, range) {
    inlineRemembered.push({ editable, rememberedMarks, range });
  },
  takePendingListFocus(blockId, itemIndex) {
    pending.push(['take', blockId, itemIndex]);
    const value = state.pendingListFocus;
    state.pendingListFocus = null;
    return value;
  }
};

const session = createEditorBlocksListSession({
  documentRef,
  root,
  list: root,
  state,
  blocksState,
  editableSession: {
    registerEditable(editable, sync) {
      registered.push({ editable, sync });
    }
  },
  selectionSession: { name: 'selection' },
  caretSession: { name: 'caret' },
  inlineDomSession: { name: 'inline-dom' },
  containsNode(parent, child) {
    return parent === root && !!child;
  },
  editableListItems(items) {
    return Array.isArray(items) && items.length ? items : [{ text: '', checked: false }];
  },
  defaultListItems() {
    return [{ text: 'List item', checked: false, listType: 'ul' }];
  },
  text(key, fallback) {
    if (key === 'unordered') return 'Bulleted';
    if (key === 'ordered') return 'Numbered';
    if (key === 'task') return 'Checklist';
    return fallback;
  },
  summarizeListType() {
    return 'mixed';
  },
  listVisualMarkerLabels(items) {
    return items.map((_, index) => `${index + 1}.`);
  },
  effectiveListItemType(item, fallback) {
    return item && item.listType ? item.listType : fallback;
  },
  normalizeListItemType(value) {
    if (value === 'ol' || value === 'task') return value;
    return 'ul';
  },
  itemIndentLevel(item) {
    return Math.max(0, Number(item && item.indent) || 0);
  },
  patchListItemType(items, itemIndex, nextType) {
    const next = Array.isArray(items) ? items.slice() : [];
    next[itemIndex] = { ...(next[itemIndex] || {}), listType: nextType };
    return { items: next };
  },
  patchListItem(items, itemIndex, patch) {
    const next = Array.isArray(items) ? items.slice() : [];
    next[itemIndex] = { ...(next[itemIndex] || {}), ...patch };
    return next;
  },
  setPlainContentEditableValue(editable, value) {
    editable.textContent = String(value || '');
  },
  editableText(editable) {
    return String(editable && editable.textContent || '');
  },
  splitEditableTextAtSelection(editable, selectionSession) {
    return splitSelection(editable, selectionSession);
  },
  outdentEmptyListItemForEnter() {
    return outdentResult;
  },
  convertListTailItemAfterEmptyToParagraph() {
    return trailingParagraph;
  },
  splitListItemsAtEmptyItem() {
    return emptySplitResult;
  },
  normalizeSplitListStartItems(items) {
    return Array.isArray(items) ? items : [];
  },
  mergeListItemIntoPreviousItem() {
    return mergeItemResult;
  },
  mergeFirstListItemIntoPreviousBlock() {
    return mergeFirstResult;
  },
  makeBlock(type, raw, data) {
    return { id: `made-${type}`, type, raw, data };
  },
  makeSplitListBlock(originalBlock, items, after) {
    return { id: 'split-list', type: 'list', data: { ...(originalBlock.data || {}), items, after } };
  },
  makeBlankBlock(after, data) {
    return { id: 'blank-1', type: 'blank', data: { after, ...data } };
  },
  markDirty(dirtyBlock) {
    dirtyBlock.dirty = true;
  },
  render() {
    renders.push('render');
  },
  emit() {
    emitted.push('emit');
  },
  updateFromControl(targetBlock, patch, renderAfter = false) {
    updates.push({ targetBlock, patch, renderAfter });
    targetBlock.data = { ...(targetBlock.data || {}), ...patch };
  },
  insertBlankBlock(index, options) {
    pending.push(['insertBlankBlock', index, options]);
  },
  focusBlockPrimaryEditable(targetBlock, caretOffset = null) {
    focusedBlocks.push({ targetBlock, caretOffset });
  },
  removeEmptyBlockWithBackspace(event, targetBlock, index, editable, sync) {
    return removeEmpty(event, targetBlock, index, editable, sync);
  },
  handleCrossBlockArrowNavigation(event, index, editable) {
    crossBlockArrows.push({ key: event.key, index, editable });
    return true;
  },
  isEditableSelectionAtStart(editable) {
    return atStart(editable);
  },
  isEditableCaretOnEdgeLine(editable, direction) {
    return edgeLine(editable, direction);
  },
  getEditableCaretTextOffset() {
    return 3;
  },
  caretRectForEditable() {
    return { left: 42 };
  },
  placeCaretAtVisualLine(editable, left, edge, fallbackOffset) {
    visualCaret.push({ editable, left, edge, fallbackOffset });
  },
  placeCaretAtTextOffset(editable, offset) {
    textCarets.push({ editable, offset });
  },
  placeCaretAtStart(editable) {
    startCarets.push(editable);
  },
  placeCaretAtEnd(editable) {
    endCarets.push(editable);
  },
  setActive(index, editable = null, sync = null) {
    active.push({ index, editable, sync });
  },
  activateEditableFromPointer(index, editable, sync) {
    pointerActivations.push({ index, editable, sync });
  },
  inlineMarksFromPointerEvent(event, editable) {
    marks.push({ event, editable });
    return { code: true };
  },
  inlineMarkedDomRangeFromPointerEvent() {
    return { start: 1, end: 4 };
  },
  updateInlineToolbarState() {
    toolbarUpdates.push('toolbar');
  },
  refreshLinkEditor(link) {
    links.push(link);
  },
  openMathEditorForNode(math) {
    marks.push({ math });
  },
  wireInlineEditable(editable, index, sync) {
    wired.push({ editable, index, sync });
  },
  queueTask(task) {
    queued.push(task);
  }
});

assert.ok(session, 'list session should be created when a document is available');

const body = documentRef.createElement('div');
session.renderBlock(body, block, 1);
root.appendChild(body);

const listEl = body.querySelector('.blocks-visual-list');
assert.ok(listEl, 'list session should render a visual list container');
assert.ok(classSet(listEl).has('blocks-visual-list-standard'));
assert.equal(listEl.getAttribute('role'), 'list');
const items = listEl.querySelectorAll('.blocks-list-item');
assert.equal(items.length, 2);
assert.equal(items[0].dataset.itemIndex, '0');
assert.equal(items[0].dataset.listType, 'ul');
assert.equal(items[0].getAttribute('role'), 'listitem');
assert.equal(items[1].dataset.listType, 'task');
assert.equal(items[1].style.marginLeft, '1.75rem');
assert.equal(items[0].querySelector('.blocks-list-marker').textContent, '1.');
const checkbox = items[1].querySelector('input[type="checkbox"]');
assert.ok(checkbox, 'mixed visual lists should render task checkboxes per item type');
const spans = listEl.querySelectorAll('.blocks-list-text');
assert.equal(spans.length, 2);
assert.equal(spans[0].contentEditable, 'true');
assert.equal(spans[0].spellcheck, true);
assert.equal(spans[0].textContent, 'one');
assert.equal(spans[1].textContent, 'done');
assert.equal(registered.length, 2);
assert.equal(wired.length, 2);

spans[0].textContent = 'one edited';
spans[0].dispatch('input');
assert.deepEqual(updates.at(-1).patch.items[0].text, 'one edited');
assert.equal(toolbarUpdates.at(-1), 'toolbar');

checkbox.checked = true;
checkbox.dispatch('change');
assert.equal(updates.at(-1).patch.items[1].checked, true);

removeEmpty = () => true;
const updateCountBeforeBackspace = updates.length;
const consumedBackspace = spans[0].dispatch('keydown', { key: 'Backspace' });
assert.equal(consumedBackspace.defaultPrevented, false);
assert.equal(updates.length, updateCountBeforeBackspace);

removeEmpty = () => false;
const tab = spans[0].dispatch('keydown', { key: 'Tab' });
assert.equal(tab.defaultPrevented, true);
assert.deepEqual(pending.at(-1), { blockId: 'list-1', itemIndex: 0, atEnd: false });
assert.equal(updates.at(-1).patch.items[0].indent, 1);
assert.equal(updates.at(-1).patch.items[0].indentText, '  ');
const shiftTab = spans[0].dispatch('keydown', { key: 'Tab', shiftKey: true });
assert.equal(shiftTab.defaultPrevented, true);
assert.equal(updates.at(-1).patch.items[0].indent, 0);

activeEditable = spans[1];
const typeSelect = session.createTypeSelect(block, 1);
assert.equal(typeSelect.className, 'blocks-list-type-select');
assert.equal(typeSelect.title, 'List type');
assert.equal(typeSelect.value, 'task');
typeSelect.value = 'ol';
typeSelect.dispatch('change');
assert.deepEqual(pending.at(-1), { blockId: 'list-1', itemIndex: 1, atEnd: false });
assert.equal(updates.at(-1).patch.items[1].listType, 'ol');

typeSelect.value = 'ul';
const blockNode = documentRef.createElement('section');
blockNode.className = 'blocks-block';
blockNode.appendChild(typeSelect);
state.activeIndex = 1;
session.syncActiveTypeSelect([null, blockNode]);
assert.equal(typeSelect.value, 'ol');

const indentControls = session.createIndentControls(block, 1);
assert.equal(indentControls.className, 'blocks-list-indent-controls');
assert.equal(indentControls.getAttribute('role'), 'group');
assert.equal(indentControls.getAttribute('aria-label'), 'List indentation');
const indentButtons = indentControls.querySelectorAll('.blocks-list-indent-btn');
assert.equal(indentButtons.length, 2);
indentButtons[1].dispatch('mousedown');
const indentClick = indentButtons[1].dispatch('click');
assert.equal(indentClick.defaultPrevented, false);
assert.equal(active.at(-1).index, 1);
assert.equal(updates.at(-1).patch.items[1].indent, 2);

outdentResult = [{ text: 'one outdented', indent: 0 }];
activeEditable = spans[0];
const outdentEnter = spans[0].dispatch('keydown', { key: 'Enter' });
assert.equal(outdentEnter.defaultPrevented, true);
assert.deepEqual(pending.at(-1), { blockId: 'list-1', itemIndex: 0, atEnd: false });
assert.deepEqual(updates.at(-1), { targetBlock: block, patch: { items: outdentResult }, renderAfter: true });

outdentResult = null;
splitSelection = () => ({ before: 'before split', after: 'after split' });
spans[0].textContent = 'before splitafter split';
const splitEnter = spans[0].dispatch('keydown', { key: 'Enter' });
assert.equal(splitEnter.defaultPrevented, true);
assert.deepEqual(pending.at(-1), { blockId: 'list-1', itemIndex: 1, caretOffset: 0 });
assert.equal(updates.at(-1).patch.items[0].text, 'before split');
assert.equal(updates.at(-1).patch.items[1].text, 'after split');
assert.equal(updates.at(-1).renderAfter, true);

atStart = () => true;
mergeItemResult = {
  focusItemIndex: 0,
  caretOffset: 5,
  items: [{ text: 'merged', indent: 0 }]
};
const mergeBackspace = spans[1].dispatch('keydown', { key: 'Backspace' });
assert.equal(mergeBackspace.defaultPrevented, true);
assert.deepEqual(pending.at(-1), { blockId: 'list-1', itemIndex: 0, caretOffset: 5 });
assert.deepEqual(updates.at(-1).patch.items, mergeItemResult.items);

mergeItemResult = null;
edgeLine = () => true;
const arrow = spans[0].dispatch('keydown', { key: 'ArrowDown' });
assert.equal(arrow.defaultPrevented, true);
assert.equal(spans[1].focusCalls.length, 1);
assert.deepEqual(visualCaret.at(-1), { editable: spans[1], left: 42, edge: 'first', fallbackOffset: 3 });

spans[0].dispatch('focus');
assert.equal(active.at(-1).index, 1);
assert.equal(active.at(-1).editable, spans[0]);

spans[0].dispatch('pointerdown', { button: 0, isPrimary: true });
assert.equal(pointerActivations.at(-1).index, 1);
assert.equal(pointerActivations.at(-1).editable, spans[0]);

const link = makeElement('a');
const click = spans[0].dispatch('click', {
  target: {
    closest(selector) {
      return selector === 'a[href]' ? link : null;
    }
  }
});
assert.equal(click.defaultPrevented, true);
assert.equal(active.at(-1).editable, spans[0]);
assert.equal(marks.at(-1).editable, spans[0]);
assert.equal(inlineRemembered.at(-1).editable, spans[0]);
assert.deepEqual(inlineRemembered.at(-1).rememberedMarks, { code: true });
assert.deepEqual(inlineRemembered.at(-1).range, { mark: 'code', start: 1, end: 4 });
assert.equal(links.at(-1), link);

const focusBody = documentRef.createElement('div');
const focusBlock = {
  id: 'focus-list',
  type: 'list',
  data: { listType: 'ul', items: [{ text: 'focus me' }] }
};
state.blocks = [focusBlock];
state.pendingListFocus = { blockId: 'focus-list', itemIndex: 0, caretOffset: 2 };
session.renderBlock(focusBody, focusBlock, 0);
const focusSpan = focusBody.querySelector('.blocks-list-text');
assert.equal(queued.length, 1);
queued[0]();
assert.equal(focusSpan.focusCalls.length, 1);
assert.deepEqual(pending.at(-1), ['take', 'focus-list', 0]);
assert.deepEqual(textCarets.at(-1), { editable: focusSpan, offset: 2 });
assert.equal(startCarets.length, 0);
assert.equal(endCarets.length, 0);
assert.equal(active.at(-1).editable, focusSpan);

trailingParagraph = { before: [], text: 'paragraph tail' };
state.blocks = [block];
atStart = () => true;
spans[0].dispatch('keydown', { key: 'Enter' });
assert.equal(renders.at(-1), 'render');
assert.equal(emitted.at(-1), 'emit');
assert.equal(focusedBlocks.at(-1).targetBlock.type, 'paragraph');
assert.equal(focusedBlocks.at(-1).caretOffset, 0);
