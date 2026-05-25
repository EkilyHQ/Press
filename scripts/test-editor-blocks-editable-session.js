import assert from 'node:assert/strict';

import {
  createEditorBlocksEditableSession
} from '../assets/js/editor-blocks-editable-session.js';

const session = createEditorBlocksEditableSession();
const editable = { name: 'editable' };
const otherEditable = { name: 'other' };
let syncCalls = 0;
const sync = () => {
  syncCalls += 1;
};
const fallbackSync = () => {
  syncCalls += 10;
};

assert.equal(session.registerEditable(null, sync), false);
assert.equal(session.getSync(null), null);

assert.equal(session.registerEditable(editable, sync), true);
assert.equal(session.getSync(editable), sync);
assert.equal(session.getSync(otherEditable), null);
assert.equal(session.getSyncOr(otherEditable, fallbackSync), fallbackSync);
assert.equal(session.getSyncOr(editable, fallbackSync), sync);

const boundCalls = [];
const blocksState = {
  setActiveEditing(target, activeSync) {
    boundCalls.push({ target, activeSync });
  }
};

assert.equal(session.bindActiveEditing(blocksState, editable, fallbackSync), sync);
assert.deepEqual(boundCalls.pop(), { target: editable, activeSync: sync });
assert.equal(session.bindActiveEditing(blocksState, otherEditable, fallbackSync), fallbackSync);
assert.deepEqual(boundCalls.pop(), { target: otherEditable, activeSync: fallbackSync });
assert.equal(session.bindActiveEditing(null, editable, fallbackSync), null);

session.registerEditable(editable, null);
assert.equal(session.getSync(editable), null);
assert.equal(session.getSyncOr(editable, fallbackSync), fallbackSync);
session.getSyncOr(editable, fallbackSync)();
assert.equal(syncCalls, 10);

console.log('ok - editor blocks editable session');
