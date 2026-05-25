import assert from 'node:assert/strict';
import { createEditorBlocksActiveSession } from '../assets/js/editor-blocks-active-session.js';

function makeClassList(name) {
  return {
    toggles: [],
    toggle(className, enabled) {
      this.toggles.push([name, className, enabled]);
    }
  };
}

function makeBlock(name, children = []) {
  return {
    name,
    children,
    classList: makeClassList(name),
    focusCalls: [],
    focus(arg) {
      this.focusCalls.push(arg && arg.preventScroll === true);
    },
    contains(node) {
      return node === this || children.includes(node);
    },
    querySelector() {
      return null;
    }
  };
}

function makeEditable(name, block = null) {
  return {
    name,
    block,
    blurred: 0,
    blur() {
      this.blurred += 1;
    },
    matches() {
      return false;
    },
    contains(node) {
      return node === this || node?.parentEditable === this;
    }
  };
}

function makeHarness({ now = () => 1000 } = {}) {
  const calls = [];
  const state = {
    blocks: [{ id: 'one' }, { id: 'two' }],
    activeIndex: 0
  };
  const editableOne = makeEditable('editable-one');
  const editableTwo = makeEditable('editable-two');
  const focusedChild = {
    name: 'focused-child',
    parentEditable: editableOne,
    blurred: 0,
    blur() {
      this.blurred += 1;
    }
  };
  const blockOne = makeBlock('block-one', [editableOne]);
  const blockTwo = makeBlock('block-two', [editableTwo]);
  editableOne.block = blockOne;
  editableTwo.block = blockTwo;
  let activeEditable = null;
  let activeSync = null;
  let activeElement = null;
  const blocksState = {
    state,
    setActiveIndex(index) {
      state.activeIndex = Math.max(-1, Math.min(Number(index) || 0, state.blocks.length - 1));
      calls.push(['activeIndex', state.activeIndex]);
    },
    getActiveEditable() {
      calls.push(['getActiveEditable', activeEditable && activeEditable.name]);
      return activeEditable;
    },
    setActiveEditing(editable, sync) {
      activeEditable = editable || null;
      activeSync = sync || null;
      calls.push(['setActiveEditing', activeEditable && activeEditable.name, activeSync]);
    },
    clearActiveEditing() {
      activeEditable = null;
      activeSync = null;
      calls.push(['clearActiveEditing']);
    },
    clearLinkEditorState(options) {
      calls.push(['clearLinkEditorState', options || null]);
    },
    clearInlineState() {
      calls.push(['clearInlineState']);
    },
    setSelectionActiveRecoverySuppression(value) {
      calls.push(['selectionSuppression', value]);
    },
    setRoutedBlockContainerClickSuppression(value) {
      calls.push(['routedSuppression', value]);
    }
  };
  const session = createEditorBlocksActiveSession({
    state,
    blocksState,
    list: {
      querySelectorAll(selector) {
        assert.equal(selector, '.blocks-block');
        return [blockOne, blockTwo];
      }
    },
    runtime: {
      getActiveElement() {
        calls.push(['getActiveElement', activeElement && activeElement.name]);
        return activeElement;
      }
    },
    containsNode(root, node) {
      return !!(root && node && (root === node || (root.contains && root.contains(node))));
    },
    syncActiveListTypeSelect(nodes) {
      calls.push(['syncActiveListTypeSelect', nodes.map(node => node.name)]);
    },
    refreshLinkEditor() {
      calls.push(['refreshLinkEditor']);
    },
    updateInlineToolbarState() {
      calls.push(['updateInlineToolbarState']);
    },
    syncActiveTableAlignmentFromEditable(activeBlock, editable) {
      calls.push(['syncActiveTableAlignmentFromEditable', activeBlock && activeBlock.name, editable && editable.name]);
    },
    requestStickyBlockHeadUpdate() {
      calls.push(['requestStickyBlockHeadUpdate']);
    },
    clearNativeSelection() {
      calls.push(['clearNativeSelection']);
    },
    now
  });
  return {
    session,
    calls,
    state,
    blocksState,
    blockOne,
    blockTwo,
    editableOne,
    editableTwo,
    focusedChild,
    get activeEditable() {
      return activeEditable;
    },
    set activeEditable(value) {
      activeEditable = value;
    },
    get activeSync() {
      return activeSync;
    },
    set activeElement(value) {
      activeElement = value;
    }
  };
}

{
  const harness = makeHarness();
  harness.session.setActive(1);
  assert.equal(harness.state.activeIndex, 1);
  assert.deepEqual(harness.blockOne.classList.toggles.at(-1), ['block-one', 'is-active', false]);
  assert.deepEqual(harness.blockTwo.classList.toggles.at(-1), ['block-two', 'is-active', true]);
  assert.deepEqual(
    harness.calls.filter(call => [
      'syncActiveListTypeSelect',
      'refreshLinkEditor',
      'updateInlineToolbarState',
      'syncActiveTableAlignmentFromEditable',
      'requestStickyBlockHeadUpdate'
    ].includes(call[0])),
    [
      ['syncActiveListTypeSelect', ['block-one', 'block-two']],
      ['refreshLinkEditor'],
      ['updateInlineToolbarState'],
      ['syncActiveTableAlignmentFromEditable', 'block-two', null],
      ['requestStickyBlockHeadUpdate']
    ],
    'setActive should fan out active block UI synchronization through explicit callbacks'
  );
}

{
  const harness = makeHarness();
  harness.activeEditable = harness.editableOne;
  const sync = () => {};
  harness.session.setActive(1, harness.editableTwo, sync);
  assert.equal(harness.activeEditable, harness.editableTwo);
  assert.equal(harness.activeSync, sync);
  assert.deepEqual(
    harness.calls.filter(call => ['clearInlineState', 'clearLinkEditorState', 'setActiveEditing'].includes(call[0])),
    [
      ['clearInlineState'],
      ['clearLinkEditorState', { clearActiveLink: false, clearHold: false }],
      ['setActiveEditing', 'editable-two', sync]
    ],
    'switching editable targets should clear stale inline/link state before binding the next editable'
  );
}

{
  const harness = makeHarness();
  harness.activeEditable = harness.editableTwo;
  harness.session.setActive(1);
  assert.equal(harness.activeEditable, harness.editableTwo);
  assert.equal(
    harness.calls.some(call => call[0] === 'clearActiveEditing'),
    false,
    'container-only activation should keep editable state when the active editable belongs to the selected block'
  );
  assert.deepEqual(
    harness.calls.find(call => call[0] === 'syncActiveTableAlignmentFromEditable'),
    ['syncActiveTableAlignmentFromEditable', 'block-two', 'editable-two']
  );
}

{
  const harness = makeHarness();
  harness.activeEditable = harness.editableOne;
  harness.activeElement = harness.focusedChild;
  harness.session.setActive(1);
  assert.equal(harness.activeEditable, null);
  assert.equal(harness.focusedChild.blurred, 1);
  assert.deepEqual(
    harness.calls.filter(call => ['clearActiveEditing', 'clearLinkEditorState', 'clearInlineState'].includes(call[0])),
    [
      ['clearActiveEditing'],
      ['clearLinkEditorState', null],
      ['clearInlineState']
    ],
    'container-only activation should clear stale editable state from another block'
  );
}

{
  const harness = makeHarness({ now: () => 3000 });
  const sync = () => {};
  harness.session.activateEditableFromPointer(0, harness.editableOne, sync);
  assert.deepEqual(
    harness.calls.filter(call => ['selectionSuppression', 'setActiveEditing'].includes(call[0])),
    [
      ['selectionSuppression', 3180],
      ['setActiveEditing', 'editable-one', sync]
    ],
    'editable pointer activation should suppress stale selection recovery before activating the target'
  );
}

{
  const harness = makeHarness({ now: () => 4000 });
  harness.session.activateNonTextBlockFromPointer(1, harness.blockTwo);
  assert.deepEqual(harness.blockTwo.focusCalls, [true]);
  assert.deepEqual(
    harness.calls.filter(call => [
      'selectionSuppression',
      'routedSuppression',
      'clearNativeSelection',
      'activeIndex'
    ].includes(call[0])),
    [
      ['selectionSuppression', 4180],
      ['routedSuppression', 4500],
      ['clearNativeSelection'],
      ['activeIndex', 1]
    ],
    'non-text pointer activation should suppress stale click/selection state, focus the block, clear selection, and activate it'
  );
}

console.log('editor blocks active session tests passed');
