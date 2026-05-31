import assert from 'node:assert/strict';

import { createComposerLifecycle } from '../assets/js/composer-lifecycle.js';

const calls = [];
const lifecycle = createComposerLifecycle({
  documentRef: { id: 'document' },
  onDocumentReady(handler) {
    calls.push(['ready']);
    handler();
  },
  composerServiceLifecycle: {
    assertReady() {
      calls.push(['services-ready']);
    }
  },
  composerActions: {
    assertReady() {
      calls.push(['actions-ready']);
    }
  },
  bootstrapOptions: {
    marker: 'bootstrap'
  },
  initializeComposerApp(options = {}) {
    calls.push(['bootstrap', options.marker || '']);
    options.onDocumentReady(() => calls.push(['handler']));
    const handler = () => 'bootstrapped';
    handler.dispose = () => {
      calls.push(['bootstrap-dispose']);
      return true;
    };
    return handler;
  },
  injectRuntimeStyles({ documentRef }) {
    calls.push(['styles', documentRef.id]);
  }
});

let bootstrapOptions = null;
lifecycle.registerFeature({
  name: 'test.captureBootstrap',
  requires: ['composerDomBootstrap'],
  provides: ['testCapture'],
  start(context) {
    bootstrapOptions = context.bootstrapOptions;
    calls.push(['capture', typeof context.bootstrapHandler]);
  }
});

const result = await lifecycle.start();
assert.ok(result.context.bootstrapHandler, 'composer lifecycle should retain the DOM bootstrap handler');
assert.equal(bootstrapOptions.marker, 'bootstrap');
assert.deepEqual(calls, [
  ['services-ready'],
  ['actions-ready'],
  ['bootstrap', 'bootstrap'],
  ['ready'],
  ['handler'],
  ['styles', 'document'],
  ['capture', 'function']
]);

assert.deepEqual(
  lifecycle.getLifecyclePlan().map(feature => feature.name),
  [
    'composer.controllerServices',
    'composer.domBootstrap',
    'composer.runtimeStyles',
    'test.captureBootstrap'
  ],
  'composer lifecycle should expose an explicit controller/bootstrap/styles plan'
);

assert.equal(await result.dispose(), true);
assert.equal(calls.at(-1)[0], 'bootstrap-dispose');

console.log('ok - composer lifecycle');
