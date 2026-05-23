import assert from 'node:assert/strict';

import {
  createEditorMainRuntime,
  normalizeMarkdownEditorView
} from '../assets/js/editor-main-runtime.js';

class FakeCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
    this.cancelable = !!options.cancelable;
    this.defaultPrevented = false;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
}

function createEventTarget() {
  const listeners = new Map();
  const events = [];
  return {
    events,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      if (listeners.has(type)) listeners.get(type).delete(handler);
    },
    dispatchEvent(event) {
      events.push(event);
      const handlers = listeners.get(event.type) || [];
      handlers.forEach((handler) => handler(event));
      return !event.defaultPrevented;
    }
  };
}

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    snapshot() {
      return Object.fromEntries(data.entries());
    }
  };
}

assert.equal(normalizeMarkdownEditorView('edit'), 'edit');
assert.equal(normalizeMarkdownEditorView('source'), 'blocks');

{
  const windowRef = createEventTarget();
  windowRef.CustomEvent = FakeCustomEvent;
  const documentRef = createEventTarget();
  documentRef.readyState = 'complete';
  documentRef.getElementById = id => ({ id });
  documentRef.querySelector = selector => ({ selector });
  documentRef.querySelectorAll = selector => [{ selector }];
  documentRef.documentElement = { scrollTop: 44 };
  const timers = [];
  const messages = [];
  const scrolls = [];
  windowRef.location = { origin: 'https://press.test' };
  windowRef.requestAnimationFrame = (fn) => {
    fn();
    return 17;
  };
  windowRef.cancelAnimationFrame = id => timers.push(`cancel:${id}`);
  windowRef.setTimeout = (fn, delay) => {
    timers.push(delay);
    fn();
    return 23;
  };
  windowRef.clearTimeout = id => timers.push(`clear:${id}`);
  windowRef.matchMedia = query => ({ media: query, matches: query.includes('reduced-motion') });
  windowRef.pageYOffset = 320;
  windowRef.scrollTo = (...args) => scrolls.push(args);
  const storage = createStorage({
    press_editor_markdown_view_v2: 'edit',
    press_editor_wrap_enabled: 'true'
  });
  const runtime = createEditorMainRuntime({ windowRef, documentRef, storage });

  assert.equal(runtime.readMarkdownEditorView(), 'edit');
  assert.equal(runtime.persistMarkdownEditorView('source'), true);
  assert.equal(storage.snapshot().press_editor_markdown_view_v2, 'blocks');
  assert.equal(runtime.readWrapEnabled(), true);
  assert.equal(runtime.readWrapEnabled({ force: true }), true);
  runtime.persistWrapEnabled(false);
  assert.equal(storage.snapshot().press_editor_wrap_enabled, '0');

  let readyCalls = 0;
  const detachReady = runtime.onDocumentReady(() => { readyCalls += 1; });
  assert.equal(readyCalls, 1);
  detachReady();
  assert.equal(timers.includes('clear:23'), true);
  assert.equal(runtime.getElementById('mdInput').id, 'mdInput');
  assert.equal(runtime.querySelector('.view-toggle').selector, '.view-toggle');
  assert.deepEqual(runtime.querySelectorAll('[data-preview-resize]').map(item => item.selector), ['[data-preview-resize]']);
  assert.equal(runtime.getDocumentElement().scrollTop, 44);
  assert.equal(runtime.requestFrame(() => {}), 17);
  runtime.cancelFrame(17);
  assert.equal(timers.includes('cancel:17'), true);
  assert.equal(runtime.setTimer(() => {}, 1200), 23);
  runtime.clearTimer(23);
  assert.equal(timers.includes('clear:23'), true);
  assert.equal(runtime.getLocationOrigin(), 'https://press.test');
  assert.equal(runtime.prefersReducedMotion(), true);
  assert.equal(runtime.getPageYOffset(), 320);
  assert.equal(runtime.scrollToTop({ smooth: true }), true);
  assert.deepEqual(scrolls.at(-1), [{ top: 0, behavior: 'smooth' }]);
  assert.equal(runtime.postMessage({ postMessage: (payload, origin) => messages.push({ payload, origin }) }, { preview: true }), true);
  assert.deepEqual(messages.at(-1), { payload: { preview: true }, origin: 'https://press.test' });

  assert.equal(runtime.setEditorBaseDir('wwwroot\\posts', 'wwwroot/'), 'wwwroot/posts/');
  assert.equal(runtime.getEditorBaseDir('fallback/'), 'wwwroot/posts/');
  assert.equal(runtime.setContentRoot('content'), true);
  assert.equal(windowRef.__press_content_root, 'content');
  assert.equal(runtime.registerPrimaryEditorApi({ id: 'api' }), true);
  assert.equal(windowRef.__press_primary_editor.id, 'api');

  let siteConfigDetail = null;
  const detach = runtime.onSiteConfigChange((event) => {
    siteConfigDetail = event.detail;
  });
  windowRef.dispatchEvent(new FakeCustomEvent(runtime.events.siteConfigChange, { detail: { ok: true } }));
  assert.deepEqual(siteConfigDetail, { ok: true });
  detach();

  windowRef.addEventListener(runtime.events.assetDeleteRequested, (event) => {
    assert.equal(event.cancelable, true);
    event.preventDefault();
  });
  assert.equal(runtime.requestAssetDelete({ assetPath: 'wwwroot/a.png' }), false);

  assert.equal(runtime.emitToast('warn', 'Check this'), true);
  assert.deepEqual(windowRef.events.at(-1).detail, { kind: 'warn', message: 'Check this' });
  assert.equal(runtime.emitToast('info', ''), false);

  assert.equal(runtime.emitAssetAdded({ commitPath: 'wwwroot/a.png' }), true);
  assert.equal(windowRef.events.at(-1).type, runtime.events.assetAdded);
  assert.equal(runtime.emitAssetDeleteCanceled({ commitPath: 'wwwroot/a.png' }), true);
  assert.equal(windowRef.events.at(-1).type, runtime.events.assetDeleteCanceled);
  assert.equal(runtime.emitCurrentFileBreadcrumbSelect({ nodeId: 'tabs:History:en' }), true);
  assert.equal(documentRef.events.at(-1).type, runtime.events.breadcrumbSelect);
}

{
  const runtime = createEditorMainRuntime({
    windowRef: { CustomEvent: FakeCustomEvent },
    documentRef: createEventTarget(),
    storage: createStorage({
      press_editor_markdown_view_v2: 'unexpected',
      press_editor_wrap_enabled: '0'
    })
  });
  assert.equal(runtime.readMarkdownEditorView(), 'blocks');
  assert.equal(runtime.readWrapEnabled(), false);
  assert.equal(runtime.ensureEditorBaseDir('wwwroot/'), 'wwwroot/');
}
