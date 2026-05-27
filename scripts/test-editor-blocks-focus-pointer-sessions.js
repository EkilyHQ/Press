import assert from 'node:assert/strict';
import { createEditorBlocksFocusPointerSessions } from '../assets/js/editor-blocks-focus-pointer-sessions.js';

const calls = [];
let sawSuppressionTime = false;

const fakeFocus = {
  blockNavigationTarget(index, edge) {
    return { index, edge };
  },
  focusBlockNavigationTarget(target, direction, x, fallbackOffset) {
    return { target, direction, x, fallbackOffset };
  },
  handleCrossBlockArrowNavigation(event, index, editable) {
    return { event, index, editable };
  }
};

const fakePointer = {
  isBlocksCaretInteractiveTarget(target) {
    return target === 'interactive';
  },
  routeBlocksCaretFromPointer(event) {
    return event === 'pointer';
  },
  routeDirectQuoteCaretFromPointer(editable, index, sync, event) {
    return { editable, index, sync, event };
  },
  setContentEditableCaretFromPoint(editable, x, y, hitTarget) {
    return { editable, x, y, hitTarget };
  },
  setTextareaCaretFromPoint(area, x, y) {
    return { area, x, y };
  }
};

const blockSessions = {
  setFocusSession(session) {
    calls.push('focus');
    return { ...session, ...fakeFocus };
  },
  setPointerSession(session) {
    calls.push('pointer');
    return { ...session, ...fakePointer };
  }
};

const focusPointer = createEditorBlocksFocusPointerSessions({
  blockSessions,
  blocksState: {
    consumeRoutedBlockContainerClickSuppression(value) {
      sawSuppressionTime = Number.isFinite(value);
      return true;
    }
  },
  queueTask: task => task()
});

assert.deepEqual(calls, ['focus', 'pointer']);
assert.ok(focusPointer.focusSession, 'focus session should be exposed for registry consumers');
assert.ok(focusPointer.pointerSession, 'pointer session should be exposed for registry consumers');

assert.deepEqual(
  focusPointer.blockNavigationTarget(2, 'last'),
  { index: 2, edge: 'last' }
);
assert.deepEqual(
  focusPointer.focusBlockNavigationTarget('target', 'previous', 42, 7),
  { target: 'target', direction: 'previous', x: 42, fallbackOffset: 7 }
);
assert.deepEqual(
  focusPointer.handleCrossBlockArrowNavigation('event', 3, 'editable'),
  { event: 'event', index: 3, editable: 'editable' }
);

assert.equal(focusPointer.isBlocksCaretInteractiveTarget('interactive'), true);
assert.equal(focusPointer.routeBlocksCaretFromPointer('pointer'), true);
assert.deepEqual(
  focusPointer.routeDirectQuoteCaretFromPointer('editable', 4, 'sync', 'event'),
  { editable: 'editable', index: 4, sync: 'sync', event: 'event' }
);
assert.deepEqual(
  focusPointer.setContentEditableCaretFromPoint('editable', 10, 20, 'hit'),
  { editable: 'editable', x: 10, y: 20, hitTarget: 'hit' }
);
assert.deepEqual(
  focusPointer.setTextareaCaretFromPoint('area', 5, 6),
  { area: 'area', x: 5, y: 6 }
);

assert.equal(focusPointer.shouldSuppressRoutedBlockContainerClick(), true);
assert.equal(sawSuppressionTime, true);
