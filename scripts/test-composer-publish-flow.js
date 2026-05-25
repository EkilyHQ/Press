import assert from 'node:assert/strict';

import { createComposerPublishFlow } from '../assets/js/composer-publish-flow.js';

function installAmbientGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
  });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
}

{
  const urls = [];
  const delays = [];
  let now = 5000;
  const restores = [
    installAmbientGlobal('fetch', (url) => {
      urls.push(url);
      const text = urls.length <= 2 ? 'old body' : 'body';
      return Promise.resolve({ ok: true, text: () => Promise.resolve(text) });
    }),
    installAmbientGlobal('setTimeout', (handler, delay) => {
      delays.push(delay);
      now += delay;
      handler();
      return delays.length;
    })
  ];
  try {
    const publishFlow = createComposerPublishFlow({
      getTrackedPublishContentRoot: () => 'wwwroot'
    });
    const result = await publishFlow.waitForRemotePropagation([
      { path: 'wwwroot/post/default/main_en.md', content: 'body' }
    ]);
    assert.deepEqual(result, { canceled: false, timedOut: false });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  assert.equal(urls.length, 3);
  assert.equal(delays.length, 30);
  assert.match(urls[0], /^post\/default\/main_en\.md\?ts=\d+$/);
  assert.match(urls[1], /^wwwroot\/post\/default\/main_en\.md\?ts=\d+$/);
  assert.match(urls[2], /^post\/default\/main_en\.md\?ts=\d+$/);
}
