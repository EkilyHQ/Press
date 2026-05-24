import assert from 'node:assert/strict';

import { waitForRemotePropagation } from '../assets/js/publish/propagation-watcher.js';

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
  const result = await waitForRemotePropagation([
    { path: 'wwwroot/post/entry/main_en.md', content: '# Entry\n' }
  ], {
    contentRoot: 'wwwroot',
    now: () => 123,
    sleepMs: async () => {
      throw new Error('matching files should not wait');
    },
    fetchImpl(url, options) {
      urls.push([url, options]);
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('# Entry\n')
      });
    }
  });

  assert.deepEqual(result, { canceled: false, timedOut: false });
  assert.deepEqual(urls, [['post/entry/main_en.md?ts=123', { cache: 'no-store' }]]);
}

{
  const result = await waitForRemotePropagation([
    { path: 'wwwroot/media/logo.bin', binary: true, base64: 'SGk=' }
  ], {
    contentRoot: 'wwwroot',
    now: () => 456,
    sleepMs: async () => {
      throw new Error('matching binary files should not wait');
    },
    fetchImpl() {
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new Uint8Array([72, 105]).buffer)
      });
    }
  });

  assert.deepEqual(result, { canceled: false, timedOut: false });
}

{
  const checked = [];
  const result = await waitForRemotePropagation([
    { path: 'wwwroot/post/deleted/main_en.md', deleted: true }
  ], {
    contentRoot: 'wwwroot',
    now: () => 789,
    sleepMs: async () => {
      throw new Error('confirmed deletions should not wait');
    },
    fetchImpl(url) {
      checked.push(url);
      return Promise.resolve({ ok: false, status: 404 });
    }
  });

  assert.deepEqual(result, { canceled: false, timedOut: false });
  assert.deepEqual(checked, [
    'post/deleted/main_en.md?ts=789',
    'wwwroot/post/deleted/main_en.md?ts=789'
  ]);
}

{
  const ambientCalls = [];
  const restores = [
    installAmbientGlobal('window', {
      __press_content_root: 'ambient-root'
    }),
    installAmbientGlobal('fetch', () => {
      ambientCalls.push('fetch');
      return Promise.resolve({ ok: true, text: () => Promise.resolve('ambient') });
    }),
    installAmbientGlobal('setTimeout', () => {
      ambientCalls.push('setTimeout');
      return 1;
    }),
    installAmbientGlobal('btoa', () => {
      ambientCalls.push('btoa');
      return 'ambient';
    })
  ];
  try {
    const result = await waitForRemotePropagation([
      { path: 'wwwroot/post/ambient/main_en.md', content: 'body' }
    ], {
      contentRoot: 'wwwroot',
      now: () => 321,
      sleepMs: async () => {},
      fetchImpl() {
        return Promise.resolve({ ok: true, text: () => Promise.resolve('body') });
      }
    });

    assert.deepEqual(result, { canceled: false, timedOut: false });
    assert.deepEqual(ambientCalls, [], 'propagation watcher should use injected browser effects only');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
}
