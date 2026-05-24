import assert from 'node:assert/strict';

import { createEditorPreviewAppRuntime } from '../assets/js/editor-preview-app-runtime.js';

function createWindowRef() {
  const listeners = new Map();
  return {
    listeners,
    parent: {
      messages: [],
      postMessage(payload, origin) {
        this.messages.push({ payload, origin });
      }
    },
    location: { origin: 'https://preview.test' },
    matchMedia(query) {
      return { matches: query === '(prefers-color-scheme: dark)' };
    },
    console: {
      warnings: [],
      warn(...args) {
        this.warnings.push(args);
      }
    },
    localStorage: {
      values: new Map(),
      getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
      },
      setItem(key, value) {
        this.values.set(key, String(value));
      }
    },
    addEventListener(type, handler, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ handler, options });
    },
    removeEventListener(type, handler, options) {
      const current = listeners.get(type) || [];
      listeners.set(type, current.filter(item => item.handler !== handler || item.options !== options));
    },
    fetch(url, options) {
      return Promise.resolve({
        ok: url === 'wwwroot/post.md',
        options,
        text: () => Promise.resolve(url === 'wwwroot/post.md' ? '# Post' : 'ignored')
      });
    }
  };
}

function createDocumentRef() {
  const attrs = new Map();
  return {
    documentElement: {
      attrs,
      setAttribute(name, value) {
        attrs.set(name, String(value));
      },
      removeAttribute(name) {
        attrs.delete(name);
      },
      getAttribute(name) {
        return attrs.has(name) ? attrs.get(name) : null;
      }
    }
  };
}

{
  const windowRef = createWindowRef();
  const documentRef = createDocumentRef();
  const runtime = createEditorPreviewAppRuntime({ windowRef, documentRef });

  assert.equal(runtime.postToParent({ type: 'ready' }), true);
  assert.deepEqual(windowRef.parent.messages, [
    { payload: { type: 'ready' }, origin: 'https://preview.test' }
  ]);

  const events = [];
  const detach = runtime.onRenderMessage(event => events.push(event.data));
  assert.equal(windowRef.listeners.get('message').length, 1);
  windowRef.listeners.get('message')[0].handler({ origin: 'https://preview.test', data: { type: 'render' } });
  assert.deepEqual(events, [{ type: 'render' }]);
  assert.equal(runtime.isTrustedMessageEvent({ origin: 'https://preview.test' }), true);
  assert.equal(runtime.isTrustedMessageEvent({ origin: 'https://elsewhere.test' }), false);
  detach();
  assert.equal(windowRef.listeners.get('message').length, 0);

  runtime.applyColorMode({ themeMode: 'dark' });
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), 'dark');
  runtime.applyColorMode({ themeMode: 'light' });
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), null);
  runtime.applyColorMode({ themeMode: 'auto' });
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), 'dark');
  windowRef.localStorage.setItem('theme', 'light');
  runtime.applyColorMode({});
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), null);
  windowRef.localStorage.setItem('theme', 'dark');
  runtime.applyColorMode({});
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), 'dark');

  runtime.warn('theme failed');
  assert.deepEqual(windowRef.console.warnings, [['theme failed']]);

  assert.equal(await runtime.fetchText('wwwroot/post.md'), '# Post');
  assert.equal(await runtime.fetchText('wwwroot/missing.md'), '');
}

{
  const ambientCalls = [];
  const originals = new Map();
  const hadOriginal = new Map();
  ['window', 'document', 'localStorage', 'fetch'].forEach((name) => {
    hadOriginal.set(name, Object.prototype.hasOwnProperty.call(globalThis, name));
    originals.set(name, globalThis[name]);
  });

  try {
    globalThis.window = {
      parent: {
        postMessage() {
          ambientCalls.push('window.parent.postMessage');
        }
      },
      location: { origin: 'https://ambient.test' },
      addEventListener() {
        ambientCalls.push('window.addEventListener');
      }
    };
    globalThis.document = {
      documentElement: {
        setAttribute() {
          ambientCalls.push('document.documentElement.setAttribute');
        }
      }
    };
    globalThis.localStorage = {
      getItem() {
        ambientCalls.push('localStorage.getItem');
        return 'dark';
      }
    };
    globalThis.fetch = () => {
      ambientCalls.push('fetch');
      return Promise.resolve({ ok: true, text: () => Promise.resolve('ambient') });
    };

    const runtime = createEditorPreviewAppRuntime({ windowRef: {}, documentRef: {}, storage: null });
    assert.equal(runtime.postToParent({ type: 'ambient' }), false);
    assert.equal(runtime.applyColorMode({}), false);
    assert.equal(await runtime.fetchText('ambient.md'), '');
    assert.deepEqual(ambientCalls, []);
  } finally {
    ['window', 'document', 'localStorage', 'fetch'].forEach((name) => {
      if (hadOriginal.get(name)) globalThis[name] = originals.get(name);
      else delete globalThis[name];
    });
  }
}
