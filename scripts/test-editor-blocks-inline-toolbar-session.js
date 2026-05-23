import assert from 'node:assert/strict';
import { createEditorBlocksInlineToolbarSession } from '../assets/js/editor-blocks-inline-toolbar-session.js';

function makeClassList() {
  const classes = new Set();
  return {
    classes,
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    toggle(name, enabled) {
      if (enabled) classes.add(name);
      else classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

function makeElement(tagName = 'div') {
  const attrs = {};
  const listeners = {};
  const children = [];
  const element = {
    tagName: String(tagName).toUpperCase(),
    type: '',
    className: '',
    textContent: '',
    title: '',
    hidden: false,
    disabled: false,
    tabIndex: 0,
    dataset: {},
    attrs,
    children,
    classList: makeClassList(),
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete attrs[name];
    },
    getAttribute(name) {
      return attrs[name] || null;
    },
    addEventListener(type, handler) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    dispatch(type, event = {}) {
      const dispatched = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...event
      };
      (listeners[type] || []).forEach(handler => handler(dispatched));
      return dispatched;
    },
    appendChild(child) {
      children.push(child);
      child.parentNode = element;
      return child;
    },
    append(...nodes) {
      nodes.forEach(node => element.appendChild(node));
    },
    querySelectorAll(selector) {
      const out = [];
      const matches = (node) => {
        if (selector === '[data-inline-command]') return !!(node.dataset && node.dataset.inlineCommand);
        if (selector.startsWith('.')) return String(node.className || '').split(/\s+/).includes(selector.slice(1));
        if (selector === 'button') return node.tagName === 'BUTTON';
        return false;
      };
      const visit = (node) => {
        if (matches(node)) out.push(node);
        (node.children || []).forEach(visit);
      };
      children.forEach(visit);
      return out;
    }
  };
  return element;
}

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    }
  };
}

function makeButton(command) {
  const attrs = {};
  return {
    dataset: { inlineCommand: command },
    classList: makeClassList(),
    disabled: null,
    tabIndex: null,
    attrs,
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    removeAttribute(name) {
      delete attrs[name];
    },
    getAttribute(name) {
      return attrs[name] || null;
    }
  };
}

function makeBlock(name, buttons = []) {
  return {
    name,
    classList: makeClassList(),
    contains(node) {
      return buttons.includes(node);
    }
  };
}

function makeHarness({
  activeIndex = 0,
  activeEditable = null,
  selectionEditable = null,
  selectionSuppressed = false,
  offsets = null,
  marks = {},
  fallbackMarks = null,
  rememberedCodeRange = null,
  pending = false,
  pendingMarks = {},
  fullyMarked = () => false,
  anyMarked = () => false,
  hasText = () => false,
  now = () => 1000
} = {}) {
  const calls = [];
  const bold = makeButton('bold');
  const italic = makeButton('italic');
  const code = makeButton('code');
  const link = makeButton('link');
  const math = makeButton('math');
  const blockOne = makeBlock('block-one', [bold, code, link, math]);
  const blockTwo = makeBlock('block-two', [italic]);
  const state = { activeIndex };
  let currentActiveEditable = activeEditable;
  const blocksState = {
    state,
    setActiveIndex(index) {
      state.activeIndex = index;
      calls.push(['setActiveIndex', index]);
    },
    selectionActiveRecoverySuppressed(value) {
      calls.push(['selectionActiveRecoverySuppressed', value]);
      return selectionSuppressed;
    },
    getActiveSync() {
      calls.push(['getActiveSync']);
      return 'sync';
    },
    getActiveEditable() {
      calls.push(['getActiveEditable']);
      return currentActiveEditable;
    },
    pendingInlineMark(mark) {
      calls.push(['pendingInlineMark', mark]);
      return pendingMarks[mark] || null;
    },
    rememberedInlineMarksFor(editable) {
      calls.push(['rememberedInlineMarksFor', editable && editable.name]);
      return fallbackMarks;
    },
    rememberedInlineRangeFor(editable, mark) {
      calls.push(['rememberedInlineRangeFor', editable && editable.name, mark]);
      return rememberedCodeRange;
    }
  };
  const session = createEditorBlocksInlineToolbarSession({
    state,
    blocksState,
    editableSession: {
      bindActiveEditing(_blocksState, editable, fallbackSync) {
        currentActiveEditable = editable;
        calls.push(['bindActiveEditing', editable && editable.name, fallbackSync]);
      }
    },
    root: {
      querySelectorAll(selector) {
        assert.equal(selector, '[data-inline-command]');
        return [bold, italic, code, link, math];
      },
      contains(node) {
        return !!node;
      }
    },
    list: {
      querySelectorAll(selector) {
        assert.equal(selector, '.blocks-block');
        return [blockOne, blockTwo];
      }
    },
    selectionSession: { selection: true },
    caretSession: { caret: true },
    containsNode(root, node) {
      return !!(root && node);
    },
    closestElement(node, selector) {
      assert.equal(selector, '.blocks-block');
      return node && node.block ? node.block : null;
    },
    selectionEditableInRoot() {
      return selectionEditable;
    },
    getEditableSelectionOffsets(editable, caretSession) {
      calls.push(['getEditableSelectionOffsets', editable && editable.name, !!caretSession]);
      return offsets;
    },
    inlineRunsFromDom(editable) {
      calls.push(['inlineRunsFromDom', editable && editable.name]);
      return [{ text: 'abc' }];
    },
    hasPendingInlineMarks() {
      calls.push(['hasPendingInlineMarks']);
      return pending;
    },
    selectionLinkInEditable() {
      return pendingMarks.__selectionLink || null;
    },
    selectionMathInEditable() {
      return pendingMarks.__selectionMath || null;
    },
    inlineRangeFullyMarked: fullyMarked,
    inlineRangeAnyMarked: anyMarked,
    inlineMarksAtOffset() {
      return marks;
    },
    rangeHasInlineText: hasText,
    inlineCommandMark(command) {
      return command === 'strikeThrough' ? 'strike' : command;
    },
    now
  });
  return {
    session,
    calls,
    state,
    blocks: [blockOne, blockTwo],
    buttons: { bold, italic, code, link, math }
  };
}

{
  const documentRef = makeDocumentRef();
  const calls = [];
  let openMenu = null;
  const session = createEditorBlocksInlineToolbarSession({
    documentRef,
    text(key, fallback) {
      if (key === 'inlineToolbarAria') return 'Inline tools';
      if (key === 'inlineMore') return 'More';
      if (key === 'inlineStrike') return 'Strike';
      if (key === 'inlineCode') return 'Code';
      return fallback;
    },
    setActive(index) {
      calls.push(['setActive', index]);
    },
    applyInlineCommand(command) {
      calls.push(['applyInlineCommand', command]);
    },
    menuSession: {
      openInlineMenu(handles) {
        openMenu = handles.menu;
        calls.push(['openInlineMenu', handles.wrap.className, handles.trigger.textContent, handles.menu.className]);
      },
      closeInlineMenu(restoreFocus) {
        calls.push(['closeInlineMenu', restoreFocus]);
        openMenu = null;
      },
      isInlineMenuOpen(menu) {
        return menu === openMenu;
      }
    }
  });

  const controls = session.createControls(3);
  assert.equal(controls.className, 'blocks-inline-controls');
  assert.equal(controls.getAttribute('role'), 'toolbar');
  assert.equal(controls.getAttribute('aria-label'), 'Inline tools');
  const commandButtons = controls.querySelectorAll('[data-inline-command]');
  assert.equal(commandButtons.length, 6);
  assert.deepEqual(commandButtons.map(btn => btn.dataset.inlineCommand), ['bold', 'italic', 'link', 'math', 'strikeThrough', 'code']);
  assert.equal(commandButtons[2].title, 'Link');
  assert.equal(commandButtons[4].textContent, 'Strike');
  assert.equal(commandButtons[0].dispatch('mousedown').defaultPrevented, true);
  commandButtons[0].dispatch('click');
  assert.deepEqual(calls.slice(-2), [['setActive', 3], ['applyInlineCommand', 'bold']]);
  commandButtons[0].setAttribute('aria-disabled', 'true');
  const disabledCallCount = calls.length;
  commandButtons[0].dispatch('click');
  assert.equal(calls.length, disabledCallCount, 'disabled inline command buttons should not run commands');
  const moreWrap = controls.querySelectorAll('.blocks-inline-more')[0];
  const moreTrigger = controls.querySelectorAll('.blocks-inline-more-trigger')[0];
  const moreMenu = controls.querySelectorAll('.blocks-inline-more-menu')[0];
  assert.ok(moreWrap);
  assert.ok(moreTrigger);
  assert.equal(moreTrigger.getAttribute('aria-haspopup'), 'menu');
  assert.equal(moreMenu.getAttribute('role'), 'menu');
  moreTrigger.dispatch('click');
  assert.deepEqual(calls.slice(-2), [['setActive', 3], ['openInlineMenu', 'blocks-inline-more', 'Aa', 'blocks-inline-more-menu']]);
  moreTrigger.dispatch('click');
  assert.deepEqual(calls.slice(-2), [['setActive', 3], ['closeInlineMenu', false]]);
  moreTrigger.dispatch('click');
  commandButtons[4].dispatch('click');
  assert.deepEqual(calls.slice(-3), [['setActive', 3], ['applyInlineCommand', 'strikeThrough'], ['closeInlineMenu', false]]);
  session.closeMoreMenu(true);
  assert.deepEqual(calls.at(-1), ['closeInlineMenu', true]);
}

{
  const selectionEditable = { name: 'selection-editable' };
  const harness = makeHarness({
    activeIndex: 0,
    activeEditable: selectionEditable,
    selectionEditable,
    offsets: { collapsed: true, start: 1, end: 1 },
    marks: { bold: true }
  });
  selectionEditable.block = harness.blocks[1];
  harness.session.update();
  assert.equal(harness.state.activeIndex, 1);
  assert.equal(harness.blocks[0].classList.contains('is-active'), false);
  assert.equal(harness.blocks[1].classList.contains('is-active'), true);
  assert.deepEqual(
    harness.calls.filter(call => ['setActiveIndex', 'bindActiveEditing'].includes(call[0])),
    [
      ['setActiveIndex', 1],
      ['bindActiveEditing', 'selection-editable', 'sync']
    ],
    'toolbar update should recover active editable from the browser selection when not suppressed'
  );
}

{
  const editable = { name: 'active-editable' };
  const harness = makeHarness({
    activeIndex: 0,
    activeEditable: editable,
    selectionEditable: editable,
    selectionSuppressed: true,
    offsets: { collapsed: true, start: 1, end: 1 },
    marks: { code: false },
    fallbackMarks: { code: true },
    rememberedCodeRange: { start: 0, end: 2 }
  });
  editable.block = harness.blocks[1];
  harness.session.update();
  assert.equal(harness.state.activeIndex, 0);
  assert.equal(harness.buttons.code.classList.contains('is-active'), true);
  assert.equal(harness.buttons.code.classList.contains('is-disabled'), false);
  assert.equal(harness.buttons.code.getAttribute('aria-disabled'), null);
  assert.equal(harness.buttons.italic.classList.contains('is-active'), false);
  assert.equal(harness.buttons.italic.getAttribute('aria-pressed'), 'false');
  assert.equal(
    harness.calls.some(call => call[0] === 'bindActiveEditing'),
    false,
    'selection recovery should not run while pointer activation has suppressed it'
  );
}

{
  const editable = { name: 'active-editable' };
  const harness = makeHarness({
    activeIndex: 0,
    activeEditable: editable,
    offsets: { collapsed: true, start: 1, end: 1 },
    marks: {},
    fallbackMarks: null,
    rememberedCodeRange: null
  });
  harness.session.update();
  assert.equal(harness.buttons.code.classList.contains('is-active'), false);
  assert.equal(harness.buttons.code.classList.contains('is-disabled'), true);
  assert.equal(harness.buttons.code.getAttribute('aria-disabled'), 'true');
  assert.equal(harness.buttons.code.disabled, false);
  assert.equal(harness.buttons.code.tabIndex, -1);
}

{
  const editable = { name: 'active-editable' };
  const harness = makeHarness({
    activeIndex: 0,
    activeEditable: editable,
    offsets: { collapsed: false, start: 0, end: 3 },
    fullyMarked(_runs, _start, _end, mark) {
      return mark === 'link';
    },
    anyMarked(_runs, _start, _end, mark) {
      return mark === 'bold';
    },
    hasText() {
      return true;
    }
  });
  harness.session.update();
  assert.equal(harness.buttons.bold.classList.contains('is-active'), true);
  assert.equal(harness.buttons.link.classList.contains('is-active'), true);
  assert.equal(harness.buttons.code.classList.contains('is-disabled'), false);
}

console.log('editor blocks inline toolbar session tests passed');
