import assert from 'node:assert/strict';
import {
  EDITOR_BLOCKS_SESSION_CALLS,
  createEditorBlocksSessionRegistry
} from '../assets/js/editor-blocks-session-registry.js';

const diagnostics = [];
const registry = createEditorBlocksSessionRegistry({
  onDiagnostic: diagnostic => diagnostics.push(diagnostic)
});

assert.ok(
  Object.keys(EDITOR_BLOCKS_SESSION_CALLS).includes('focusBlockPrimaryEditable'),
  'blocks session registry should declare dispatch through explicit call descriptors'
);

assert.equal(registry.getFocusSession(), null);
assert.equal(registry.focusBlockPrimaryEditable({ id: 'a' }, 0), false);
assert.equal(registry.blockNavigationTarget(0, 'first'), null);
assert.equal(registry.openMathEditorForSelection(), false);
assert.equal(registry.setCardEntries([]), false);
assert.deepEqual(registry.getDiagnostics(), [], 'missing block sessions before setup should not emit diagnostics');

const focusCalls = [];
const focusSession = {
  focusBlockPrimaryEditable: (...args) => {
    focusCalls.push(['focusBlockPrimaryEditable', ...args]);
  },
  blockNavigationTarget: (...args) => ({ kind: 'target', args }),
  handleCrossBlockArrowNavigation: () => true
};

assert.equal(registry.setFocusSession(focusSession), focusSession);
assert.equal(registry.getFocusSession(), focusSession);
assert.equal(registry.focusBlockPrimaryEditable({ id: 'b' }, 3), false);
assert.deepEqual(focusCalls, [['focusBlockPrimaryEditable', { id: 'b' }, 3]]);
assert.deepEqual(registry.blockNavigationTarget(2, 'last'), { kind: 'target', args: [2, 'last'] });
assert.equal(registry.handleCrossBlockArrowNavigation({ key: 'ArrowUp' }, 1, null), true);

const commandSession = {
  focusFirstCommandItem: id => id === 'blank-1',
  insertCommandBlock: (type, data, options) => ({ type, data, options }),
  renderBlankBlock: (body, block, index) => ({ body, block, index })
};

assert.equal(registry.setCommandSession(commandSession), commandSession);
assert.equal(registry.focusFirstCommandItem('blank-1'), true);
assert.deepEqual(
  registry.insertCommandBlock('card', { location: 'posts/a.md' }, { index: 4 }),
  { type: 'card', data: { location: 'posts/a.md' }, options: { index: 4 } }
);
assert.deepEqual(registry.renderBlankBlock('body', 'block', 5), { body: 'body', block: 'block', index: 5 });

const cardPickerSession = {
  entries: null,
  rendered: 0,
  render() {
    this.rendered += 1;
  },
  setEntries(entries) {
    this.entries = entries;
  }
};

assert.equal(registry.setCardPickerSession(cardPickerSession), cardPickerSession);
assert.equal(registry.renderCardPicker(), false);
assert.equal(cardPickerSession.rendered, 1);
assert.equal(registry.setCardEntries([{ location: 'posts/b.md' }]), true);
assert.deepEqual(cardPickerSession.entries, [{ location: 'posts/b.md' }]);

registry.setCardPickerSession({
  setEntries() {
    throw new Error('failed to set entries');
  }
});
assert.equal(registry.setCardEntries([]), false);
assert.deepEqual(
  registry.getDiagnostics().map(item => ({ slot: item.slot, method: item.method, reason: item.reason, error: item.error })),
  [{ slot: 'cardPickerSession', method: 'setEntries', reason: 'thrown', error: 'failed to set entries' }],
  'handled block session failures should emit structured diagnostics instead of silently degrading'
);
assert.deepEqual(diagnostics, registry.getDiagnostics(), 'blocks registry should notify diagnostic observers');
registry.clearDiagnostics();
assert.deepEqual(registry.getDiagnostics(), [], 'blocks registry diagnostics should be clearable');

registry.setFocusSession({ blockNavigationTarget: () => null });
assert.equal(registry.focusBlockPrimaryEditable({ id: 'c' }, 1), false);
assert.deepEqual(
  registry.getDiagnostics().map(item => ({ slot: item.slot, method: item.method, reason: item.reason })),
  [{ slot: 'focusSession', method: 'focusBlockPrimaryEditable', reason: 'missingMethod' }],
  'registered sessions missing expected methods should emit contract diagnostics'
);

registry.setFocusSession(null);
assert.equal(registry.getFocusSession(), null);
assert.equal(registry.handleCrossBlockArrowNavigation({ key: 'ArrowDown' }, 1, null), false);
