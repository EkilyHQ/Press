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
