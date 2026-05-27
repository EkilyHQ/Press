import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPOSER_ACTION_PLAN,
  COMPOSER_ACTION_TYPES,
  getComposerActionPlan,
  validateComposerActionPlan
} from '../assets/js/composer-action-contract.js';
import { createComposerActionDispatcher } from '../assets/js/composer-action-dispatcher.js';

const here = dirname(fileURLToPath(import.meta.url));
const composerSource = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');

assert.deepEqual(
  validateComposerActionPlan(),
  [],
  'composer action plan should validate'
);
assert.deepEqual(
  COMPOSER_ACTION_TYPES,
  COMPOSER_ACTION_PLAN.map(action => action.type),
  'composer action types should mirror the plan'
);
assert.equal(new Set(COMPOSER_ACTION_TYPES).size, COMPOSER_ACTION_TYPES.length);

const expectedActions = [
  'composer.mode.apply',
  'composer.file.select',
  'composer.yaml.changed',
  'composer.yaml.draft.cleared',
  'composer.summary.refresh',
  'composer.system-theme.changed',
  'editor.tree.refresh',
  'markdown.draft.changed',
  'publish.completed'
];
assert.deepEqual(COMPOSER_ACTION_TYPES, expectedActions);

const yamlAction = getComposerActionPlan().find(action => action.type === 'composer.yaml.changed');
assert.deepEqual(yamlAction.effects, [
  'recomputeYamlDiff',
  'applyYamlDiffMarkers',
  'refreshFileDirtyBadges',
  'scheduleYamlAutoDraft',
  'applySiteConfig',
  'refreshUnsyncedSummary',
  'refreshOrderPreview',
  'refreshEditorTree'
]);
assert(yamlAction.requires.includes('stateStore'));
assert(yamlAction.requires.includes('editorTree'));

assert.deepEqual(
  validateComposerActionPlan([
    { type: 'duplicate', label: 'A', effects: ['one'] },
    { type: 'duplicate', label: 'B', effects: ['two'] }
  ]),
  ['composerActionPlan[1].type duplicates duplicate']
);

{
  const calls = [];
  const services = new Set(getComposerActionPlan().flatMap(action => action.requires));
  const effects = new Set(getComposerActionPlan().flatMap(action => action.effects));
  const handlers = Object.fromEntries([...effects].map(effect => [effect, (payload) => {
    calls.push([effect, payload.kind || payload.mode || payload.name || payload.files && payload.files.length || '']);
    return effect;
  }]));
  const dispatcher = createComposerActionDispatcher({
    name: 'test-composer-actions',
    handlers,
    availableServices: services
  });
  assert.equal(dispatcher.assertReady(), true);
  assert.equal(
    dispatcher.dispatch('composer.yaml.changed', { kind: 'site' }),
    'refreshEditorTree'
  );
  assert.deepEqual(
    calls.map(call => call[0]),
    yamlAction.effects,
    'dispatcher should execute action effects in contract order'
  );
  assert.deepEqual(dispatcher.getTraces()[0].type, 'composer.yaml.changed');
  assert.deepEqual(
    dispatcher.getTraces()[0].payload,
    {
      keys: ['kind'],
      values: {
        kind: { type: 'string' }
      }
    },
    'dispatcher traces should keep payload metadata without retaining payload contents'
  );
}

{
  const dispatcher = createComposerActionDispatcher({
    name: 'missing-action-service',
    handlers: {},
    availableServices: []
  });
  assert.throws(
    () => dispatcher.assertReady(),
    /missing-action-service: invalid composer action handlers:/
  );
  assert.throws(
    () => dispatcher.dispatch('missing.action'),
    /missing-action-service: unknown composer action "missing\.action"/
  );
}

{
  const dispatcher = createComposerActionDispatcher({
    name: 'custom-plan',
    maxTraces: 1,
    plan: [
      {
        type: 'custom.action',
        label: 'Custom action',
        requires: ['customService'],
        effects: ['customEffect']
      }
    ],
    handlers: {
      customEffect: (payload) => payload.value
    },
    availableServices: ['customService']
  });
  assert.equal(dispatcher.assertReady(), true);
  assert.equal(dispatcher.dispatch('custom.action', { value: 42 }), 42);
  assert.equal(dispatcher.dispatch('custom.action', { value: 43 }), 43);
  assert.deepEqual(dispatcher.getActionPlan().map(action => action.type), ['custom.action']);
  assert.deepEqual(
    dispatcher.getTraces().map(trace => trace.payload),
    [
      {
        keys: ['value'],
        values: {
          value: { type: 'number' }
        }
      }
    ],
    'dispatcher traces should be bounded for long-lived editor sessions'
  );
  assert.throws(
    () => dispatcher.dispatch('composer.yaml.changed'),
    /custom-plan: unknown composer action "composer\.yaml\.changed"/
  );
}

assert.match(
  composerSource,
  /import \{ createComposerActionDispatcher \} from '\.\/composer-action-dispatcher\.js';/,
  'composer should construct the action dispatcher'
);
assert.match(
  composerSource,
  /function notifyComposerChange\(kind, options = \{\}\) \{\s*return composerActions\.dispatch\('composer\.yaml\.changed'/,
  'YAML changes should dispatch the explicit action contract'
);
assert.match(
  composerSource,
  /function applyMode\(mode, options = \{\}\) \{\s*return composerActions\.dispatch\('composer\.mode\.apply'/,
  'mode changes should dispatch the explicit action contract'
);
assert.match(
  composerSource,
  /function applyLocalPostCommitState\(files = \[\]\) \{\s*return composerActions\.dispatch\('publish\.completed'/,
  'publish completion should dispatch the explicit action contract'
);
assert.match(
  composerSource,
  /function updateUnsyncedSummary\(options = \{\}\) \{\s*return composerActions\.dispatch\('composer\.summary\.refresh'/,
  'summary refresh should dispatch the explicit action contract'
);
assert.match(
  composerSource,
  /function refreshEditorContentTree\(options = \{\}\) \{\s*return composerActions\.dispatch\('editor\.tree\.refresh'/,
  'editor tree refresh should dispatch the explicit action contract'
);

console.log('ok - composer action contract');
