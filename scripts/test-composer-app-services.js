import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPOSER_SERVICE_PLAN,
  COMPOSER_SERVICE_SLOTS,
  createComposerServiceLifecycle,
  getComposerServiceLifecyclePlan
} from '../assets/js/composer-app-services.js';
import { createComposerServiceRegistry } from '../assets/js/composer-service-registry.js';
import { runEditorFeatureLifecycle } from '../assets/js/editor-app-kernel.js';

const here = dirname(fileURLToPath(import.meta.url));
const composerSource = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');
const registrySource = readFileSync(resolve(here, '../assets/js/composer-service-registry.js'), 'utf8');

const expectedSlots = [
  'markdownDraftController',
  'markdownLoader',
  'markdownActionsUi',
  'markdownSessionController',
  'markdownWorkspaceController',
  'modeController',
  'unsyncedSummaryController'
];
const expectedSetters = [
  'setMarkdownDraftController',
  'setMarkdownLoader',
  'setMarkdownActionsUi',
  'setMarkdownSessionController',
  'setMarkdownWorkspaceController',
  'setModeController',
  'setUnsyncedSummaryController'
];

assert.deepEqual(COMPOSER_SERVICE_SLOTS, expectedSlots);
assert.deepEqual(COMPOSER_SERVICE_PLAN.map(entry => entry.slot), expectedSlots);
assert.deepEqual(COMPOSER_SERVICE_PLAN.map(entry => entry.setter), expectedSetters);
assert.deepEqual(getComposerServiceLifecyclePlan().map(entry => entry.slot), expectedSlots);
assert.equal(new Set(COMPOSER_SERVICE_SLOTS).size, COMPOSER_SERVICE_SLOTS.length);

await runEditorFeatureLifecycle(
  getComposerServiceLifecyclePlan().map(entry => ({
    name: `composer.service.${entry.slot}`,
    provides: [entry.slot],
    requires: entry.requires
  })),
  { name: 'composer-service-plan' }
);

{
  const registry = createComposerServiceRegistry();
  const lifecycle = createComposerServiceLifecycle(registry, { name: 'test-composer-services' });
  assert.throws(
    () => lifecycle.assertReady(),
    /test-composer-services: missing composer services: markdownDraftController, markdownLoader, markdownActionsUi, markdownSessionController, markdownWorkspaceController, modeController, unsyncedSummaryController/
  );
  assert.throws(
    () => lifecycle.setMarkdownLoader({}),
    /test-composer-services: composer service "markdownLoader" requires "markdownDraftController" first/
  );
  assert.throws(
    () => lifecycle.setMarkdownDraftController(null),
    /test-composer-services: composer service "markdownDraftController" cannot be null or undefined/
  );
  assert.throws(
    () => lifecycle.setMarkdownDraftController(undefined),
    /test-composer-services: composer service "markdownDraftController" cannot be null or undefined/
  );
  assert.deepEqual(lifecycle.getInitializedSlots(), []);

  const services = Object.fromEntries(expectedSlots.map(slot => [slot, { slot }]));
  expectedSetters.forEach((setter, index) => {
    assert.equal(lifecycle[setter](services[expectedSlots[index]]), services[expectedSlots[index]]);
  });
  assert.deepEqual(lifecycle.getInitializedSlots(), expectedSlots);
  assert.equal(lifecycle.assertReady(), true);
  assert.equal(registry.getMarkdownDraftController(), services.markdownDraftController);
  assert.equal(registry.getMarkdownLoader(), services.markdownLoader);
  assert.equal(registry.getMarkdownActionsUi(), services.markdownActionsUi);
  assert.equal(registry.getMarkdownSessionController(), services.markdownSessionController);
  assert.equal(registry.getMarkdownWorkspaceController(), services.markdownWorkspaceController);
  assert.equal(registry.getUnsyncedSummaryController(), services.unsyncedSummaryController);
  assert.throws(
    () => lifecycle.setMarkdownDraftController({}),
    /test-composer-services: composer service "markdownDraftController" is already initialized/
  );
}

{
  const registry = {};
  const lifecycle = createComposerServiceLifecycle(registry, { name: 'missing-setter-test' });
  assert.throws(
    () => lifecycle.setMarkdownDraftController({}),
    /missing-setter-test: registry is missing setter "setMarkdownDraftController"/
  );
}

{
  const registry = {
    setMarkdownDraftController: () => null
  };
  const lifecycle = createComposerServiceLifecycle(registry, { name: 'rejecting-registry-test' });
  assert.throws(
    () => lifecycle.setMarkdownDraftController({}),
    /rejecting-registry-test: registry rejected composer service "markdownDraftController"/
  );
  assert.deepEqual(lifecycle.getInitializedSlots(), []);
}

assert.match(
  registrySource,
  /import \{ COMPOSER_SERVICE_PLAN, COMPOSER_SERVICE_SLOTS \} from '\.\/composer-app-services\.js';/,
  'composer service registry should read slot metadata from the service lifecycle plan'
);

assert.match(
  composerSource,
  /const composerServices = createComposerServiceRegistry\(\);\s*const composerServiceLifecycle = createComposerServiceLifecycle\(composerServices\);/,
  'composer should create a lifecycle wrapper for late-bound app services'
);

expectedSetters.forEach((setter) => {
  assert.match(
    composerSource,
    new RegExp(`composerServiceLifecycle\\.${setter}\\(`),
    `composer should register ${setter} through the lifecycle wrapper`
  );
  assert.doesNotMatch(
    composerSource,
    new RegExp(`composerServices\\.${setter}\\(`),
    `composer should not bypass the lifecycle wrapper for ${setter}`
  );
});

const actualSetterOrder = [...composerSource.matchAll(/composerServiceLifecycle\.(set[A-Za-z]+)\(/g)]
  .map(match => match[1])
  .filter(setter => expectedSetters.includes(setter));
assert.deepEqual(actualSetterOrder, expectedSetters);
assert.match(
  composerSource,
  /function start\(\) \{\s*composerServiceLifecycle\.assertReady\(\);[\s\S]*initializeComposerApp\(/,
  'composer should assert service readiness before bootstrap starts'
);

console.log('ok - composer app services');
