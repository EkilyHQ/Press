import assert from 'node:assert/strict';
import { createEditorBlocksSourceSession } from '../assets/js/editor-blocks-source-session.js';

function classSet(node) {
  return new Set(String(node.className || '').split(/\s+/).filter(Boolean));
}

function syncClassName(node, set) {
  node.className = Array.from(set).join(' ');
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
    value: '',
    title: '',
    type: '',
    rows: 0,
    spellcheck: true,
    dataset: {},
    attrs,
    children,
    focusCalls: [],
    selectionStart: 0,
    selectionEnd: 0,
    classList: {
      add(name) {
        const set = classSet(node);
        set.add(name);
        syncClassName(node, set);
      },
      remove(name) {
        const set = classSet(node);
        set.delete(name);
        syncClassName(node, set);
      },
      contains(name) {
        return classSet(node).has(name);
      }
    },
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
      let stopped = 0;
      const results = (listeners.get(type) || []).map(handler => handler({
        preventDefault() { defaultPrevented = true; },
        stopPropagation() { stopped += 1; },
        target: node,
        ...event
      }));
      return { defaultPrevented, stopped, results };
    },
    focus(options) {
      node.focusCalls.push(options || null);
    },
    setSelectionRange(start, end) {
      node.selectionStart = start;
      node.selectionEnd = end;
    },
    matches(selector) {
      const tagMatch = selector.match(/^[A-Za-z][A-Za-z0-9-]*/);
      if (tagMatch && node.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) return false;
      const classMatches = Array.from(selector.matchAll(/\.([A-Za-z0-9_-]+)/g)).map(match => match[1]);
      return classMatches.every(cls => classSet(node).has(cls));
    },
    querySelector(selector) {
      const stack = [...children];
      while (stack.length) {
        const item = stack.shift();
        if (item && item.matches && item.matches(selector)) return item;
        if (item && item.children) stack.push(...item.children);
      }
      return null;
    },
    querySelectorAll(selector) {
      const out = [];
      const stack = [...children];
      while (stack.length) {
        const item = stack.shift();
        if (item && item.matches && item.matches(selector)) out.push(item);
        if (item && item.children) stack.push(...item.children);
      }
      return out;
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

const documentRef = makeDocumentRef();
const registered = [];
const updates = [];
const active = [];
const pointerActivations = [];
const autofix = [];
const queued = [];
const autoSized = [];
const delegated = [];
const measures = [];
const measureResults = [];
const caretSession = { name: 'caret-session' };
const sourceBlock = {
  id: 'source-1',
  type: 'source',
  raw: '    - one\n    - two',
  data: { text: '    - one\n    - two', sourceReason: 'indentedList' }
};

const session = createEditorBlocksSourceSession({
  documentRef,
  editableSession: {
    registerEditable(editable, sync) {
      registered.push({ editable, sync });
    }
  },
  text(key, fallback) {
    if (key === 'sourceReason.indentedList') return 'Indented list source';
    if (key === 'sourceAutofix.indentedList') return 'Convert indented list';
    return fallback;
  },
  caretSession,
  measureLimit: 1234,
  textareaTextOffsetDetailsFromPoint(area, x, y, limit, caretTools) {
    measures.push({ area, x, y, limit, caretTools });
    return measureResults.length ? measureResults.shift() : null;
  },
  autoSizeTextarea(area) {
    autoSized.push(area.value);
  },
  removeEmptyBlockWithBackspace(event, block, index, area, sync) {
    delegated.push(['backspace', event.key, block.id, index, area.value, typeof sync]);
    return !!event.consumeBackspace;
  },
  handleCrossBlockArrowNavigation(event, index, area) {
    delegated.push(['arrow', event.key, index, area.value]);
    return true;
  },
  updateFromControl(block, patch) {
    updates.push({ block, patch });
    block.data = { ...(block.data || {}), ...patch };
  },
  setActive(index, editable = null, sync = null) {
    active.push({ index, editable, sync });
  },
  activateEditableFromPointer(index, editable, sync) {
    pointerActivations.push({ index, editable, sync });
  },
  applyAutofix(index) {
    autofix.push(index);
  },
  queueTask(task) {
    queued.push(task);
  }
});

assert.ok(session, 'source session should be created when a document is available');

const help = session.createReasonHelp(sourceBlock, 4);
const helpButton = help.querySelector('.blocks-source-help');
const bubble = help.querySelector('.blocks-source-help-bubble');
assert.equal(help.className, 'blocks-source-help-wrap');
assert.equal(helpButton.textContent, '?');
assert.equal(helpButton.getAttribute('aria-label'), 'Indented list source');
assert.equal(helpButton.getAttribute('aria-describedby'), 'blocks-source-help-source-1');
assert.equal(bubble.id, 'blocks-source-help-source-1');
assert.equal(bubble.getAttribute('role'), 'tooltip');
assert.equal(bubble.textContent, 'Indented list source');

assert.equal(session.canAutofix(sourceBlock), true);
assert.equal(session.canAutofix({ type: 'source', data: { sourceReason: 'html' } }), false);
assert.equal(session.canAutofix({ type: 'paragraph', data: { sourceReason: 'indentedList' } }), false);

const autofixButton = session.createAutofixButton(sourceBlock, 4);
assert.equal(autofixButton.className, 'blocks-source-autofix');
assert.equal(autofixButton.title, 'Convert indented list');
assert.equal(autofixButton.getAttribute('aria-label'), 'Convert indented list');
assert.equal(autofixButton.children[0].textContent, '\u2605');
assert.equal(autofixButton.querySelector('.blocks-source-autofix-label').textContent, 'Autofix');
const click = autofixButton.dispatch('click');
assert.equal(click.defaultPrevented, true);
assert.equal(click.stopped, 1);
assert.deepEqual(active.at(-1), { index: 4, editable: null, sync: null });
assert.deepEqual(autofix, [4]);

const body = documentRef.createElement('div');
session.renderBlock(body, sourceBlock, 7);
const area = body.querySelector('textarea.blocks-source-textarea');
assert.ok(area, 'source session should render a source textarea');
assert.equal(area.className, 'blocks-textarea blocks-source-textarea');
assert.equal(area.spellcheck, false);
assert.equal(area.rows, 1);
assert.equal(area.value, '    - one\n    - two');
assert.equal(registered.length, 1);
assert.equal(registered[0].editable, area);
assert.equal(queued.length, 1);
queued[0]();
assert.deepEqual(autoSized.at(-1), '    - one\n    - two');

area.value = 'raw **markdown**';
area.dispatch('input');
assert.deepEqual(updates.at(-1).patch, { text: 'raw **markdown**' });
assert.equal(autoSized.at(-1), 'raw **markdown**');

area.dispatch('keydown', { key: 'Backspace', consumeBackspace: true });
assert.equal(delegated.at(-1)[0], 'backspace');
area.dispatch('keydown', { key: 'ArrowDown' });
assert.deepEqual(delegated.at(-2).slice(0, 2), ['backspace', 'ArrowDown']);
assert.deepEqual(delegated.at(-1), ['arrow', 'ArrowDown', 7, 'raw **markdown**']);

area.dispatch('focus');
assert.equal(active.at(-1).index, 7);
assert.equal(active.at(-1).editable, area);

measureResults.push({ offset: 5, insideTextRect: false });
const pointerDown = area.dispatch('pointerdown', { button: 0, isPrimary: true, clientX: 10, clientY: 20 });
assert.equal(pointerDown.defaultPrevented, true);
assert.equal(pointerActivations.at(-1).index, 7);
assert.equal(pointerActivations.at(-1).editable, area);
assert.equal(measures.at(-1).limit, 1234);
assert.equal(measures.at(-1).caretTools, caretSession);
assert.equal(area.focusCalls.at(-1).preventScroll, true);
assert.equal(area.selectionStart, 5);
assert.equal(area.selectionEnd, 5);
assert.equal(active.at(-1).index, 7);
assert.equal(active.at(-1).editable, area);
assert.equal(autoSized.at(-1), 'raw **markdown**');

measureResults.push({ offset: 1, insideTextRect: true });
const nativePointerDown = area.dispatch('pointerdown', { button: 0, isPrimary: true, clientX: 2, clientY: 3 });
assert.equal(nativePointerDown.defaultPrevented, false);
measureResults.push({ offset: 9, insideTextRect: false });
area.dispatch('click', { clientX: 2, clientY: 3 });
assert.equal(area.selectionStart, 9);
assert.equal(active.at(-1).index, 7);

measureResults.push({ offset: 3, insideTextRect: true });
area.dispatch('pointerdown', { button: 0, isPrimary: true, clientX: 1, clientY: 1 });
area.dispatch('pointermove', { clientX: 20, clientY: 20 });
const measureCountBeforeDragClick = measures.length;
area.dispatch('click', { clientX: 20, clientY: 20 });
assert.equal(measures.length, measureCountBeforeDragClick, 'drag clicks should not correct source textarea selection');

const rawBody = documentRef.createElement('div');
session.renderBlock(rawBody, { id: 'source-2', type: 'source', raw: '<div>raw</div>', data: {} }, 1);
assert.equal(rawBody.querySelector('.blocks-source-textarea').value, '<div>raw</div>');
