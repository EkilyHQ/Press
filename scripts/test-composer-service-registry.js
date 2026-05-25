import assert from 'node:assert/strict';
import { COMPOSER_SERVICE_PLAN, COMPOSER_SERVICE_SLOTS } from '../assets/js/composer-app-services.js';
import { createComposerServiceRegistry } from '../assets/js/composer-service-registry.js';

const registry = createComposerServiceRegistry();

assert.deepEqual(
  Object.keys(registry),
  [
    'applyMode',
    'getCurrentMode',
    'getMarkdownActionsUi',
    'getMarkdownDraftController',
    'getMarkdownLoader',
    'getMarkdownSessionController',
    'getMarkdownWorkspaceController',
    'getUnsyncedSummaryController',
    'setMarkdownActionsUi',
    'setMarkdownDraftController',
    'setMarkdownLoader',
    'setMarkdownSessionController',
    'setMarkdownWorkspaceController',
    'setModeController',
    'setUnsyncedSummaryController'
  ],
  'composer service registry should expose only named composer service slots'
);
assert.deepEqual(
  COMPOSER_SERVICE_SLOTS,
  COMPOSER_SERVICE_PLAN.map(entry => entry.slot),
  'composer service plan should be the registry slot source of truth'
);
COMPOSER_SERVICE_PLAN.forEach((entry) => {
  assert.equal(typeof registry[entry.setter], 'function', `${entry.setter} should be exposed`);
});

assert.equal(registry.getCurrentMode(), null, 'missing mode controller should read as no active mode');
assert.equal(registry.applyMode('site'), false, 'missing mode controller should ignore apply requests');

assert.throws(
  () => registry.getMarkdownDraftController(),
  /Markdown draft controller is not initialized/,
  'required service getters should fail clearly before initialization'
);

const draftController = { readDraftStore: () => ({ draft: true }) };
const workspaceController = { getPrimaryEditorApi: () => ({ ready: true }) };
const modeCalls = [];
const modeController = {
  getCurrentMode: () => 'site',
  applyMode(mode, options = {}) {
    modeCalls.push([mode, options.preserveTreeExpansion === true]);
  }
};

assert.equal(registry.setMarkdownDraftController(draftController), draftController);
assert.equal(registry.setMarkdownWorkspaceController(workspaceController), workspaceController);
assert.equal(registry.setModeController(modeController), modeController);

assert.equal(registry.getMarkdownDraftController(), draftController);
assert.equal(registry.getMarkdownWorkspaceController(), workspaceController);
assert.equal(registry.getCurrentMode(), 'site');
assert.equal(registry.applyMode('sync', { preserveTreeExpansion: true }), false);
assert.deepEqual(modeCalls, [['sync', true]]);

registry.setModeController(null);
assert.equal(registry.getCurrentMode(), null, 'clearing a service should restore fallback behavior');
