import assert from 'node:assert/strict';
import { createEditorBlocksFocusSession } from '../assets/js/editor-blocks-focus-session.js';

function makeEditable(name, options = {}) {
  const calls = [];
  return {
    name,
    value: options.value || '',
    calls,
    focus(arg) {
      calls.push(['focus', arg && arg.preventScroll === true]);
    },
    matches(selector) {
      if (selector === 'textarea') return !!options.textarea;
      if (selector.includes('.blocks-list-text')) return !!options.listText;
      if (selector.includes('.blocks-table-cell-input')) return !!options.tableCell;
      return !!options.primary;
    },
    setSelectionRange(start, end) {
      calls.push(['setSelectionRange', start, end]);
    },
    getBoundingClientRect() {
      return options.rect || { left: 20, top: 0, right: 120, bottom: 20, height: 20, width: 100 };
    }
  };
}

function makeBlockElement(id, {
  primary = null,
  listTexts = [],
  tableCells = [],
  rect = null
} = {}) {
  const body = {
    querySelector(selector) {
      return selector.includes('.blocks-rich-editable') ? primary : null;
    }
  };
  return {
    dataset: { blockId: id },
    focusCalls: [],
    focus(arg) {
      this.focusCalls.push(arg && arg.preventScroll === true);
    },
    querySelector(selector) {
      if (selector === '.blocks-block-body') return body;
      if (selector.includes('.blocks-rich-editable:not')) return primary;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.blocks-list-item .blocks-list-text') return listTexts;
      if (selector === '.blocks-table-cell-input') return tableCells;
      return [];
    },
    getBoundingClientRect() {
      return rect || { left: 5, top: 0, right: 80, bottom: 20, height: 20, width: 75 };
    }
  };
}

function makeHarness({ blocks, elements, queueImmediate = true, caretOverrides = {} }) {
  const queued = [];
  const activeCalls = [];
  const toolbarCalls = [];
  const caretCalls = [];
  const sync = { flush: true };
  const caretSession = {
    placeAtTextOffset(editable, offset) {
      caretCalls.push(['placeAtTextOffset', editable.name, offset]);
    },
    placeAtEnd(editable) {
      caretCalls.push(['placeAtEnd', editable.name]);
    },
    placeAtStart(editable) {
      caretCalls.push(['placeAtStart', editable.name]);
    },
    isEditableOnEdgeLine(editable, direction) {
      caretCalls.push(['isEditableOnEdgeLine', editable.name, direction]);
      return true;
    },
    isTextareaOnEdgeLine(editable, direction) {
      caretCalls.push(['isTextareaOnEdgeLine', editable.name, direction]);
      return true;
    },
    rectForEditable(editable) {
      caretCalls.push(['rectForEditable', editable.name]);
      return { left: 44, top: 0, right: 45, bottom: 20, height: 20, width: 1 };
    },
    placeAtVisualLine(editable, x, edge, fallbackOffset) {
      caretCalls.push(['placeAtVisualLine', editable.name, x, edge, fallbackOffset]);
    },
    placeTextareaAtVisualLine(editable, x, edge, fallbackOffset) {
      caretCalls.push(['placeTextareaAtVisualLine', editable.name, x, edge, fallbackOffset]);
    },
    ...caretOverrides
  };
  const session = createEditorBlocksFocusSession({
    state: { blocks },
    caretSession,
    editableSession: {
      getSync(editable) {
        return editable ? sync : null;
      }
    },
    blockElements: () => elements,
    editableListItems: value => Array.isArray(value) ? value : [],
    setActive(index, editable = null, activeSync = null) {
      activeCalls.push({ index, editable: editable ? editable.name : null, sync: activeSync });
    },
    onInlineToolbarUpdate() {
      toolbarCalls.push('update');
    },
    queueTask(task) {
      if (queueImmediate) task();
      else queued.push(task);
    }
  });
  return { session, queued, activeCalls, toolbarCalls, caretCalls, sync };
}

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run('primary editable focus resolves block DOM and caret offset through the session', () => {
  const editable = makeEditable('body', { primary: true });
  const blockEl = makeBlockElement('a', { primary: editable });
  const { session, activeCalls, caretCalls, sync } = makeHarness({
    blocks: [{ id: 'a', type: 'paragraph' }],
    elements: [blockEl]
  });

  session.focusBlockPrimaryEditable({ id: 'a' }, 3);

  assert.deepEqual(editable.calls, [['focus', true]]);
  assert.deepEqual(caretCalls, [['placeAtTextOffset', 'body', 3]]);
  assert.deepEqual(activeCalls, [{ index: 0, editable: 'body', sync }]);
});

run('list item focus queues DOM work and lands at the requested item edge', () => {
  const first = makeEditable('first', { listText: true });
  const second = makeEditable('second', { listText: true });
  const blockEl = makeBlockElement('list', { listTexts: [first, second] });
  const { session, queued, activeCalls, caretCalls, sync } = makeHarness({
    blocks: [{ id: 'list', type: 'list', data: { items: [{ text: 'a' }, { text: 'b' }] } }],
    elements: [blockEl],
    queueImmediate: false
  });

  session.focusListItemEditable('list', 1, { atEnd: true });

  assert.equal(queued.length, 1);
  assert.deepEqual(second.calls, []);
  queued.shift()();
  assert.deepEqual(second.calls, [['focus', true]]);
  assert.deepEqual(caretCalls, [['placeAtEnd', 'second']]);
  assert.deepEqual(activeCalls, [{ index: 0, editable: 'second', sync }]);
});

run('previous-block focus uses the last rendered list item for list blocks', () => {
  const first = makeEditable('first', { listText: true });
  const second = makeEditable('second', { listText: true });
  const listEl = makeBlockElement('list', { listTexts: [first, second] });
  const nextEl = makeBlockElement('next', { primary: makeEditable('next', { primary: true }) });
  const { session, queued, activeCalls, caretCalls, sync } = makeHarness({
    blocks: [
      { id: 'list', type: 'list', data: { items: [{ text: 'a' }, { text: 'b' }] } },
      { id: 'next', type: 'paragraph' }
    ],
    elements: [listEl, nextEl],
    queueImmediate: false
  });

  session.focusPreviousBlockEnd(1);
  queued.shift()();

  assert.deepEqual(second.calls, [['focus', true]]);
  assert.deepEqual(caretCalls, [['placeAtEnd', 'second']]);
  assert.deepEqual(activeCalls, [{ index: 0, editable: 'second', sync }]);
});

run('cross-block arrows only leave editables from edge visual lines', () => {
  const current = makeEditable('current', { primary: true });
  const target = makeEditable('target', { primary: true });
  const currentEl = makeBlockElement('a', { primary: current });
  const targetEl = makeBlockElement('b', { primary: target });
  let edge = false;
  const { session, activeCalls, caretCalls, toolbarCalls, sync } = makeHarness({
    blocks: [{ id: 'a', type: 'paragraph' }, { id: 'b', type: 'paragraph' }],
    elements: [currentEl, targetEl],
    caretOverrides: {
      isEditableOnEdgeLine(editable, direction) {
        caretCalls.push(['isEditableOnEdgeLine', editable.name, direction]);
        return edge;
      }
    }
  });
  let prevented = 0;
  const event = {
    key: 'ArrowDown',
    preventDefault() {
      prevented += 1;
    }
  };

  assert.equal(session.handleCrossBlockArrowNavigation(event, 0, current), false);
  assert.equal(prevented, 0);

  edge = true;
  assert.equal(session.handleCrossBlockArrowNavigation(event, 0, current), true);

  assert.equal(prevented, 1);
  assert.deepEqual(target.calls, [['focus', true]]);
  assert.deepEqual(activeCalls, [{ index: 1, editable: 'target', sync }]);
  assert.deepEqual(toolbarCalls, ['update']);
  assert.deepEqual(caretCalls, [
    ['isEditableOnEdgeLine', 'current', 'down'],
    ['isEditableOnEdgeLine', 'current', 'down'],
    ['rectForEditable', 'current'],
    ['placeAtVisualLine', 'target', 44, 'first', 0]
  ]);
});

run('textarea arrows use textarea edge and visual-line caret services', () => {
  const current = makeEditable('source', { textarea: true, value: 'a\nb' });
  const target = makeEditable('next', { textarea: true, value: 'next' });
  const currentEl = makeBlockElement('source', { primary: current });
  const targetEl = makeBlockElement('next', { primary: target });
  const { session, caretCalls } = makeHarness({
    blocks: [{ id: 'source', type: 'source' }, { id: 'next', type: 'source' }],
    elements: [currentEl, targetEl]
  });
  const event = {
    key: 'ArrowDown',
    preventDefault() {}
  };

  assert.equal(session.handleCrossBlockArrowNavigation(event, 0, current), true);
  assert.deepEqual(caretCalls, [
    ['isTextareaOnEdgeLine', 'source', 'down'],
    ['placeTextareaAtVisualLine', 'next', 21, 'first', 0]
  ]);
});
