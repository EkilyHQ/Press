import assert from 'node:assert/strict';

import {
  createEditorBlocksMenuSession
} from '../assets/js/editor-blocks-menu-session.js';

function makeClassList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    }
  };
}

function makeElement({ focusable = false } = {}) {
  const attributes = new Map();
  const listeners = new Map();
  return {
    type: '',
    className: '',
    textContent: '',
    title: '',
    disabled: false,
    hidden: true,
    focused: false,
    parentNode: null,
    dataset: {},
    classList: makeClassList(),
    children: new Set(),
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    contains(target) {
      return target === this || this.children.has(target);
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatch(type, event = {}) {
      const dispatched = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...event
      };
      (listeners.get(type) || []).forEach(handler => handler(dispatched));
      return dispatched;
    },
    appendChild(child) {
      this.children.add(child);
      child.parentNode = this;
      return child;
    },
    append(...nodes) {
      nodes.forEach(node => this.appendChild(node));
    },
    focus: focusable ? function focus() {
      this.focused = true;
    } : undefined,
    querySelector(selector = '') {
      if (focusable && !this.children.size) return this;
      const matches = (node) => {
        if (!selector) return false;
        if (selector === '.blocks-action-menu-item:not(:disabled)') {
          return String(node.className || '').split(/\s+/).includes('blocks-action-menu-item') && !node.disabled;
        }
        if (selector === '.blocks-inline-menu-item:not(:disabled)') {
          return String(node.className || '').split(/\s+/).includes('blocks-inline-menu-item') && !node.disabled;
        }
        if (selector.startsWith('.')) return String(node.className || '').split(/\s+/).includes(selector.slice(1));
        return false;
      };
      const stack = Array.from(this.children);
      while (stack.length) {
        const node = stack.shift();
        if (matches(node)) return node;
        stack.push(...Array.from(node.children || []));
      }
      return focusable ? this : null;
    },
    querySelectorAll(selector = '') {
      const matches = (node) => {
        if (selector.startsWith('.')) return String(node.className || '').split(/\s+/).includes(selector.slice(1));
        if (selector === 'button') return node.type === 'button';
        return false;
      };
      const out = [];
      const stack = Array.from(this.children);
      while (stack.length) {
        const node = stack.shift();
        if (matches(node)) out.push(node);
        stack.push(...Array.from(node.children || []));
      }
      return out;
    }
  };
}

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement({ focusable: String(tagName).toLowerCase() === 'button' });
    }
  };
}

function createListenerHarness() {
  const listeners = [];
  const calls = [];
  return {
    listeners,
    calls,
    onDocument(type, handler, options) {
      const record = { target: 'document', type, handler, options, disposed: false };
      listeners.push(record);
      return () => {
        record.disposed = true;
        calls.push(`dispose:${record.target}:${record.type}`);
      };
    },
    onWindow(type, handler, options) {
      const record = { target: 'window', type, handler, options, disposed: false };
      listeners.push(record);
      return () => {
        record.disposed = true;
        calls.push(`dispose:${record.target}:${record.type}`);
      };
    }
  };
}

{
  const harness = createListenerHarness();
  let repositionCalls = 0;
  const session = createEditorBlocksMenuSession({
    onDocument: harness.onDocument,
    onWindow: harness.onWindow
  });
  const wrap = makeElement();
  const trigger = makeElement({ focusable: true });
  const menu = makeElement({ focusable: true });
  const inside = makeElement();
  const outside = makeElement();
  wrap.children.add(inside);

  assert.equal(session.openActionMenu({
    wrap,
    trigger,
    menu,
    onReposition: () => {
      repositionCalls += 1;
    }
  }), true);
  assert.equal(menu.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(wrap.classList.contains('is-open'), true);
  assert.equal(menu.focused, true);
  assert.equal(repositionCalls, 1);
  assert.equal(harness.listeners.length, 4);
  assert.equal(session.isActionMenuOpen(menu), true);

  assert.equal(session.openActionMenu({ wrap, trigger, menu }), false);
  assert.equal(session.isActionMenuOpen(menu), true);

  harness.listeners.find(record => record.target === 'document' && record.type === 'mousedown')
    .handler({ target: inside });
  assert.equal(session.isActionMenuOpen(menu), true);

  harness.listeners.find(record => record.target === 'document' && record.type === 'mousedown')
    .handler({ target: outside });
  assert.equal(session.isActionMenuOpen(menu), false);
  assert.equal(menu.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(wrap.classList.contains('is-open'), false);
  assert.equal(harness.calls.length, 4);
}

{
  const harness = createListenerHarness();
  const session = createEditorBlocksMenuSession({
    onDocument: harness.onDocument,
    onWindow: harness.onWindow
  });
  const wrap = makeElement();
  const trigger = makeElement({ focusable: true });
  const menu = makeElement({ focusable: true });
  let prevented = false;

  assert.equal(session.openInlineMenu({ wrap, trigger, menu }), true);
  assert.equal(menu.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(harness.listeners.length, 2);
  assert.equal(session.isInlineMenuOpen(menu), true);

  harness.listeners.find(record => record.target === 'document' && record.type === 'keydown')
    .handler({
      key: 'Escape',
      preventDefault() {
        prevented = true;
      }
    });
  assert.equal(prevented, true);
  assert.equal(session.isInlineMenuOpen(menu), false);
  assert.equal(menu.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(trigger.focused, true);
  assert.equal(harness.calls.length, 2);
}

{
  const harness = createListenerHarness();
  const session = createEditorBlocksMenuSession({
    onDocument: harness.onDocument,
    onWindow: harness.onWindow
  });
  const actionMenu = makeElement({ focusable: true });
  const actionTrigger = makeElement({ focusable: true });
  const actionWrap = makeElement();
  const inlineMenu = makeElement({ focusable: true });
  const inlineTrigger = makeElement({ focusable: true });
  const inlineWrap = makeElement();

  session.openActionMenu({ wrap: actionWrap, trigger: actionTrigger, menu: actionMenu });
  session.openInlineMenu({ wrap: inlineWrap, trigger: inlineTrigger, menu: inlineMenu });
  assert.equal(session.closeAll(), true);
  assert.equal(session.isActionMenuOpen(actionMenu), false);
  assert.equal(session.isInlineMenuOpen(inlineMenu), false);
  assert.equal(actionMenu.hidden, true);
  assert.equal(inlineMenu.hidden, true);
  assert.equal(session.closeAll(), false);
}

{
  const harness = createListenerHarness();
  const calls = [];
  const session = createEditorBlocksMenuSession({
    documentRef: makeDocumentRef(),
    text(key, fallback) {
      if (key === 'actions') return 'More actions';
      return fallback;
    },
    onDocument: harness.onDocument,
    onWindow: harness.onWindow
  });
  const controls = session.createActionControls({
    index: 1,
    blockCount: 3,
    setActive(index) {
      calls.push(['setActive', index]);
    },
    moveBlock(index, delta) {
      calls.push(['moveBlock', index, delta]);
    },
    insertBlankBlock(index) {
      calls.push(['insertBlankBlock', index]);
    },
    deleteBlockAt(index) {
      calls.push(['deleteBlockAt', index]);
    },
    onReposition(menu, trigger) {
      calls.push(['reposition', menu.className, trigger.className]);
    }
  });
  assert.equal(controls.className, 'blocks-block-actions');
  const trigger = controls.querySelector('.blocks-action-trigger');
  const menu = controls.querySelector('.blocks-action-menu');
  assert.ok(trigger);
  assert.ok(menu);
  assert.equal(trigger.textContent, '\u22ef');
  assert.equal(trigger.title, 'More actions');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'menu');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.getAttribute('role'), 'menu');
  assert.equal(menu.hidden, true);
  const items = controls.querySelectorAll('.blocks-action-menu-item');
  assert.deepEqual(items.map(item => item.textContent), ['Move up', 'Move down', 'Add before', 'Add after', 'Delete']);
  assert.equal(items[0].disabled, false);
  assert.equal(items[1].disabled, false);
  assert.equal(items[4].className.includes('blocks-action-menu-delete'), true);
  assert.equal(trigger.dispatch('mousedown').defaultPrevented, true);
  trigger.dispatch('click');
  assert.equal(session.isActionMenuOpen(menu), true);
  assert.equal(menu.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(calls.slice(-2), [['setActive', 1], ['reposition', 'blocks-action-menu', 'blocks-icon-btn blocks-action-trigger']]);
  items[0].dispatch('click');
  assert.equal(session.isActionMenuOpen(menu), false);
  assert.deepEqual(calls.at(-1), ['moveBlock', 1, -1]);

  trigger.dispatch('click');
  items[3].dispatch('click');
  assert.deepEqual(calls.at(-1), ['insertBlankBlock', 2]);

  trigger.dispatch('click');
  items[4].dispatch('click');
  assert.deepEqual(calls.at(-1), ['deleteBlockAt', 1]);
}

{
  const calls = [];
  const session = createEditorBlocksMenuSession({
    documentRef: makeDocumentRef()
  });
  const controls = session.createActionControls({
    index: 0,
    blockCount: 1,
    moveBlock(index, delta) {
      calls.push(['moveBlock', index, delta]);
    }
  });
  const items = controls.querySelectorAll('.blocks-action-menu-item');
  assert.equal(items[0].disabled, true);
  assert.equal(items[1].disabled, true);
  items[0].dispatch('click');
  items[1].dispatch('click');
  assert.deepEqual(calls, [], 'disabled move actions should not run handlers');
}

console.log('ok - editor blocks menu session');
