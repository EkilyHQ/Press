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
