import assert from 'node:assert/strict';
import { createEditorBlocksPointerSession } from '../assets/js/editor-blocks-pointer-session.js';

function makeRect(left, top, right, bottom) {
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function makeEditable(name, options = {}) {
  const calls = [];
  return {
    name,
    value: options.value || '',
    parentElement: options.parentElement || null,
    classList: {
      contains(className) {
        return Array.isArray(options.classes) && options.classes.includes(className);
      }
    },
    calls,
    focus(arg) {
      calls.push(['focus', arg && arg.preventScroll === true]);
    },
    matches(selector) {
      if (selector === 'textarea') return !!options.textarea;
      if (selector === '.blocks-list-item') return !!options.listItem;
      if (selector.includes('.blocks-list-text')) return !!options.listText;
      if (selector.includes('.blocks-source-textarea')) return !!options.textarea;
      if (selector.includes('[contenteditable="true"]')) return !!options.contenteditable;
      if (selector.includes('.blocks-rich-editable')) return !!options.rich;
      if (selector.includes('.blocks-image-caption')) return !!options.caption;
      if (selector.includes('.blocks-block-image')) return !!options.imageBlock;
      return false;
    },
    getClientRects() {
      return options.clientRects || [];
    },
    getBoundingClientRect() {
      return options.rect || makeRect(0, 0, 100, 20);
    },
    setSelectionRange(start, end) {
      calls.push(['setSelectionRange', start, end]);
    }
  };
}

function makeBlockElement(name, {
  listTexts = [],
  editables = [],
  imageBlock = false,
  rect = null
} = {}) {
  const block = {
    name,
    dataset: { blockId: name },
    imageBlock,
    parentElement: null,
    focusCalls: [],
    focus(arg) {
      this.focusCalls.push(arg && arg.preventScroll === true);
    },
    matches(selector) {
      return selector === '.blocks-block-image' ? imageBlock : false;
    },
    querySelectorAll(selector) {
      if (selector === '.blocks-list-item .blocks-list-text') return listTexts;
      if (selector.includes('.blocks-rich-editable:not')) return editables;
      return [];
    },
    getClientRects() {
      return [this.getBoundingClientRect()];
    },
    getBoundingClientRect() {
      return rect || makeRect(0, 0, 100, 20);
    }
  };
  [...listTexts, ...editables].forEach(editable => {
    if (!editable.parentElement) editable.parentElement = block;
  });
  return block;
}

function makeEvent(options = {}) {
  return {
    button: 0,
    clientX: 10,
    clientY: 10,
    defaultPrevented: false,
    isPrimary: true,
    target: options.target || null,
    prevented: 0,
    preventDefault() {
      this.prevented += 1;
      this.defaultPrevented = true;
    },
    ...options
  };
}

function makeHarness({ elements = [], caretOverrides = {}, now = () => 1000 } = {}) {
  const activeCalls = [];
  const activationCalls = [];
  const toolbarCalls = [];
  const autoSizeCalls = [];
  const caretCalls = [];
  const selectionCalls = [];
  const suppressionCalls = [];
  const sync = { sync: true };
  const session = createEditorBlocksPointerSession({
    blocksState: {
      setRoutedBlockContainerClickSuppression(value) {
        suppressionCalls.push(['block', value]);
      },
      setLinkEditorRefreshSuppression(value) {
        suppressionCalls.push(['link', value]);
      }
    },
    caretSession: {
      measuredTextOffsetDetailsFromPoint(editable, x, y, limit) {
        caretCalls.push(['measuredTextOffsetDetailsFromPoint', editable.name, x, y, limit]);
        return { offset: 4, insideTextRect: false };
      },
      placeAtTextOffset(editable, offset) {
        caretCalls.push(['placeAtTextOffset', editable.name, offset]);
      },
      placeAtEnd(editable) {
        caretCalls.push(['placeAtEnd', editable.name]);
      },
      textareaTextOffsetFromPoint(area, x, y, limit) {
        caretCalls.push(['textareaTextOffsetFromPoint', area.name, x, y, limit]);
        return 3;
      },
      ...caretOverrides
    },
    selectionSession: {
      rangeFromPoint(editable, x, y, options) {
        selectionCalls.push(['rangeFromPoint', editable.name, x, y, !!(options && options.textOnly)]);
        return {
          collapse(value) {
            selectionCalls.push(['collapse', value]);
          }
        };
      },
      selectRange(_range, editable) {
        selectionCalls.push(['selectRange', editable.name]);
        return true;
      }
    },
    editableSession: {
      getSync(editable) {
        return editable ? sync : null;
      }
    },
    blockElements: () => elements,
    closestElement(target, selector) {
      const selectors = String(selector || '').split(',').map(item => item.trim()).filter(Boolean);
      let node = target || null;
      while (node) {
        if (node.matches && selectors.some(item => node.matches(item))) return node;
        node = node.parentElement || null;
      }
      return null;
    },
    setActive(index, editable = null, activeSync = null) {
      activeCalls.push({ index, editable: editable ? editable.name : null, sync: activeSync });
    },
    activateEditableFromPointer(index, editable, activeSync) {
      activationCalls.push({ type: 'editable', index, editable: editable ? editable.name : null, sync: activeSync });
    },
    activateNonTextBlockFromPointer(index, blockEl) {
      activationCalls.push({ type: 'non-text', index, block: blockEl ? blockEl.name : null });
    },
    onInlineToolbarUpdate() {
      toolbarCalls.push('update');
    },
    autoSizeTextarea(area) {
      autoSizeCalls.push(area.name);
    },
    now,
    measureLimit: 12000
  });
  return {
    session,
    activeCalls,
    activationCalls,
    toolbarCalls,
    autoSizeCalls,
    caretCalls,
    selectionCalls,
    suppressionCalls,
    sync
  };
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

run('caret routing excludes editor controls and native editable targets', () => {
  const input = makeEditable('input');
  input.matches = selector => selector === 'input';
  const rich = makeEditable('rich');
  rich.matches = selector => selector === '[contenteditable="true"]';
  const plain = makeEditable('plain');
  const { session } = makeHarness();

  assert.equal(session.isBlocksCaretInteractiveTarget(input), true);
  assert.equal(session.isBlocksCaretInteractiveTarget(rich), true);
  assert.equal(session.isBlocksCaretInteractiveTarget(plain), false);
});

run('nearest editable routing measures list items by their larger hit target', () => {
  const listItem = makeEditable('list-item', { listItem: true, rect: makeRect(0, 0, 300, 30) });
  const listText = makeEditable('list-text', {
    listText: true,
    rect: makeRect(40, 0, 100, 20),
    parentElement: listItem
  });
  const paragraph = makeEditable('paragraph', {
    rich: true,
    rect: makeRect(500, 0, 560, 20)
  });
  const block = makeBlockElement('block', { listTexts: [listText], editables: [paragraph] });
  listItem.parentElement = block;
  const { session, sync } = makeHarness({ elements: [block] });

  assert.deepEqual(session.editableCaretCandidates().map(candidate => ({
    editable: candidate.editable.name,
    hitTarget: candidate.hitTarget.name,
    index: candidate.index,
    sync: candidate.sync
  })), [
    { editable: 'list-text', hitTarget: 'list-item', index: 0, sync },
    { editable: 'paragraph', hitTarget: 'paragraph', index: 0, sync }
  ]);
  assert.equal(session.nearestEditableFromPoint(250, 10).editable.name, 'list-text');
});

run('blank container pointerdowns route to nearest contenteditable and suppress stale clicks', () => {
  const editable = makeEditable('paragraph', { rich: true, rect: makeRect(0, 0, 120, 20) });
  const block = makeBlockElement('block', { editables: [editable] });
  const { session, activeCalls, caretCalls, suppressionCalls, sync } = makeHarness({ elements: [block] });
  const event = makeEvent({ target: block, clientX: 10, clientY: 28 });

  assert.equal(session.routeBlocksCaretFromPointer(event), true);

  assert.equal(event.prevented, 1);
  assert.deepEqual(editable.calls, [['focus', true]]);
  assert.deepEqual(caretCalls, [
    ['measuredTextOffsetDetailsFromPoint', 'paragraph', 10, 28, 12000],
    ['placeAtTextOffset', 'paragraph', 4]
  ]);
  assert.deepEqual(suppressionCalls, [['block', 1500], ['link', 1500]]);
  assert.deepEqual(activeCalls, [{ index: 0, editable: 'paragraph', sync }]);
});

run('image block pointerdowns activate non-text blocks before caret routing', () => {
  const imageBlock = makeBlockElement('image', { imageBlock: true });
  const { session, activationCalls } = makeHarness({ elements: [imageBlock] });
  const event = makeEvent({ target: imageBlock });

  assert.equal(session.routeBlocksCaretFromPointer(event), true);

  assert.equal(event.prevented, 1);
  assert.deepEqual(activationCalls, [{ type: 'non-text', index: 0, block: 'image' }]);
});

run('source textarea routing prefers measured offsets and autosizes after placement', () => {
  const area = makeEditable('source', {
    textarea: true,
    value: 'abcdef',
    rect: makeRect(0, 0, 160, 80)
  });
  const block = makeBlockElement('source-block', { editables: [area] });
  const { session, caretCalls, autoSizeCalls } = makeHarness({ elements: [block] });
  const event = makeEvent({ target: block, clientX: 12, clientY: 40 });

  assert.equal(session.routeBlocksCaretFromPointer(event), true);

  assert.deepEqual(caretCalls, [['textareaTextOffsetFromPoint', 'source', 12, 40, 12000]]);
  assert.deepEqual(area.calls, [['focus', true], ['setSelectionRange', 3, 3]]);
  assert.deepEqual(autoSizeCalls, ['source']);
});

run('direct quote edge pointerdowns use measured offsets and refresh inline state', () => {
  const quote = makeEditable('quote', {
    classes: ['blocks-quote-text'],
    rich: true
  });
  const { session, activationCalls, caretCalls, suppressionCalls, toolbarCalls, sync } = makeHarness();
  const event = makeEvent({ target: quote, clientX: 9, clientY: 30 });

  assert.equal(session.routeDirectQuoteCaretFromPointer(quote, 2, sync, event), true);

  assert.equal(event.prevented, 1);
  assert.deepEqual(quote.calls, [['focus', true]]);
  assert.deepEqual(caretCalls, [
    ['measuredTextOffsetDetailsFromPoint', 'quote', 9, 30, 12000],
    ['placeAtTextOffset', 'quote', 4]
  ]);
  assert.deepEqual(suppressionCalls, [['block', 1500], ['link', 1500]]);
  assert.deepEqual(activationCalls, [{ type: 'editable', index: 2, editable: 'quote', sync }]);
  assert.deepEqual(toolbarCalls, ['update']);
});

run('contenteditable routing falls back to browser range placement inside text rects', () => {
  const editable = makeEditable('paragraph', { rich: true, rect: makeRect(0, 0, 120, 40) });
  const { session, caretCalls, selectionCalls } = makeHarness({
    caretOverrides: {
      measuredTextOffsetDetailsFromPoint(node, x, y, limit) {
        caretCalls.push(['measuredTextOffsetDetailsFromPoint', node.name, x, y, limit]);
        return { offset: 2, insideTextRect: true };
      }
    }
  });

  session.setContentEditableCaretFromPoint(editable, 15, 10, editable);

  assert.deepEqual(caretCalls, [['measuredTextOffsetDetailsFromPoint', 'paragraph', 15, 10, 12000]]);
  assert.deepEqual(selectionCalls, [
    ['rangeFromPoint', 'paragraph', 15, 10, true],
    ['collapse', true],
    ['selectRange', 'paragraph']
  ]);
});
