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
  return {
    hidden: true,
    focused: false,
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
    focus: focusable ? function focus() {
      this.focused = true;
    } : undefined,
    querySelector() {
      return focusable ? this : null;
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

console.log('ok - editor blocks menu session');
