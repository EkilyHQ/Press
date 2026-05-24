import assert from 'node:assert/strict';

import { createEditorBlocksRuntime } from '../assets/js/editor-blocks-runtime.js';

function createTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ handler, options });
    },
    removeEventListener(type, handler, options) {
      const current = listeners.get(type) || [];
      listeners.set(type, current.filter(item => item.handler !== handler || item.options !== options));
    },
    emit(type, event = {}) {
      (listeners.get(type) || []).forEach(item => item.handler({ type, ...event }));
    }
  };
}

function installAmbientGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
  });
  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  };
}

{
  const documentRef = createTarget();
  documentRef.getElementById = id => ({ id });
  documentRef.createElement = tagName => ({ tagName: String(tagName || '').toUpperCase() });
  documentRef.createElementNS = (namespace, tagName) => ({
    namespace,
    tagName: String(tagName || '').toLowerCase()
  });
  documentRef.activeElement = { id: 'active' };
  documentRef.body = { id: 'body' };
  documentRef.documentElement = { id: 'doc' };
  documentRef.scrollingElement = { id: 'scroll' };
  const writes = [];
  const timers = [];
  const windowRef = createTarget();
  windowRef.isSecureContext = true;
  windowRef.innerHeight = 768;
  windowRef.innerWidth = 1024;
  windowRef.__press_t = key => `t:${key}`;
  windowRef.getComputedStyle = el => ({ el, overflowY: 'auto' });
  windowRef.matchMedia = query => ({ matches: query === '(prefers-reduced-motion: reduce)' });
  windowRef.requestAnimationFrame = fn => {
    fn();
    return 17;
  };
  windowRef.setTimeout = (fn, delay) => {
    timers.push(delay);
    fn();
    return 23;
  };
  windowRef.clearTimeout = id => timers.push(`clear:${id}`);
  const runtime = createEditorBlocksRuntime({
    documentRef,
    windowRef,
    navigatorRef: {
      clipboard: {
        writeText(value) {
          writes.push(value);
        }
      }
    }
  });

  let docClicks = 0;
  const detachDoc = runtime.onDocument('click', () => { docClicks += 1; }, true);
  documentRef.emit('click');
  assert.equal(docClicks, 1);
  detachDoc();
  documentRef.emit('click');
  assert.equal(docClicks, 1);

  let resized = false;
  runtime.onWindow('resize', () => { resized = true; })();
  windowRef.emit('resize');
  assert.equal(resized, false);

  assert.equal(runtime.getElementById('editorContentPane').id, 'editorContentPane');
  assert.equal(runtime.createElement('button').tagName, 'BUTTON');
  assert.deepEqual(runtime.createElementNS('urn:test', 'svg'), { namespace: 'urn:test', tagName: 'svg' });
  assert.equal(runtime.getActiveElement().id, 'active');
  assert.equal(runtime.getBody().id, 'body');
  assert.equal(runtime.getDocumentElement().id, 'doc');
  assert.equal(runtime.getScrollingElement().id, 'scroll');
  assert.equal(runtime.getViewportHeight(), 768);
  assert.equal(runtime.getViewportWidth(), 1024);
  assert.equal(runtime.getComputedStyle({}).overflowY, 'auto');
  assert.equal(runtime.prefersReducedMotion(), true);
  assert.equal(runtime.requestFrame(() => {}), 17);
  assert.equal(runtime.setTimer(() => {}, 1200), 23);
  runtime.clearTimer(23);
  assert.equal(timers.includes('clear:23'), true);
  runtime.clearTimer(0);
  assert.equal(timers.includes('clear:0'), true);
  assert.equal(await runtime.writeClipboardText('copy me'), true);
  assert.deepEqual(writes, ['copy me']);
  assert.equal(runtime.translate('code.copy', 'Copy'), 't:code.copy');
}

{
  const runtime = createEditorBlocksRuntime({
    documentRef: null,
    windowRef: { isSecureContext: false },
    navigatorRef: { clipboard: { writeText() { throw new Error('should not write'); } } }
  });
  assert.equal(await runtime.writeClipboardText('x'), false);
  assert.equal(runtime.translate('missing', 'Fallback'), 'Fallback');
  assert.equal(runtime.getElementById('x'), null);
  assert.equal(runtime.createElement('button'), null);
  assert.equal(runtime.createElementNS('urn:test', 'svg'), null);
}

{
  const writes = [];
  const windowRef = {
    isSecureContext: true,
    navigator: {
      clipboard: {
        writeText(value) {
          writes.push(value);
        }
      }
    }
  };
  const runtime = createEditorBlocksRuntime({ windowRef });
  assert.equal(runtime.navigatorRef, windowRef.navigator);
  assert.equal(await runtime.writeClipboardText('from window navigator'), true);
  assert.deepEqual(writes, ['from window navigator']);
}

{
  const ambientCalls = [];
  const restores = [
    installAmbientGlobal('document', {
      getElementById() {
        ambientCalls.push('document');
        return { id: 'ambient' };
      }
    }),
    installAmbientGlobal('window', {
      requestAnimationFrame() {
        ambientCalls.push('window.requestAnimationFrame');
        return 91;
      },
      setTimeout() {
        ambientCalls.push('window.setTimeout');
        return 92;
      },
      clearTimeout() {
        ambientCalls.push('window.clearTimeout');
      },
      getComputedStyle() {
        ambientCalls.push('window.getComputedStyle');
        return { display: 'block' };
      },
      navigator: {
        clipboard: {
          writeText() {
            ambientCalls.push('window.navigator.clipboard.writeText');
          }
        }
      },
      __press_t() {
        ambientCalls.push('window.__press_t');
        return 'ambient';
      }
    }),
    installAmbientGlobal('navigator', {
      clipboard: {
        writeText() {
          ambientCalls.push('navigator.clipboard.writeText');
        }
      }
    }),
    installAmbientGlobal('requestAnimationFrame', () => {
      ambientCalls.push('requestAnimationFrame');
      return 93;
    }),
    installAmbientGlobal('setTimeout', () => {
      ambientCalls.push('setTimeout');
      return 94;
    }),
    installAmbientGlobal('clearTimeout', () => {
      ambientCalls.push('clearTimeout');
    }),
    installAmbientGlobal('getComputedStyle', () => {
      ambientCalls.push('getComputedStyle');
      return { display: 'grid' };
    })
  ];

  try {
    const runtime = createEditorBlocksRuntime();
    assert.equal(runtime.documentRef, null);
    assert.equal(runtime.windowRef, null);
    assert.equal(runtime.navigatorRef, null);
    assert.equal(runtime.getElementById('ambient'), null);
    assert.equal(runtime.getComputedStyle({}), null);
    assert.equal(runtime.requestFrame(() => {}), null);
    assert.equal(runtime.setTimer(() => {}, 5), null);
    runtime.clearTimer(94);
    assert.equal(await runtime.writeClipboardText('ambient'), false);
    assert.equal(runtime.translate('blocks.copy', 'Copy'), 'Copy');
    assert.deepEqual(ambientCalls, []);
  } finally {
    for (const restore of restores.reverse()) restore();
  }
}
