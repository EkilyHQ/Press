import assert from 'node:assert/strict';

import { createEditorMainImageSession } from '../assets/js/editor-main-image-session.js';

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.dispatched = [];
    this.value = '';
    this.files = [];
    this.clickCount = 0;
    this.focusCount = 0;
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatch(type, overrides = {}) {
    const event = {
      type,
      target: this,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...overrides
    };
    (this.listeners.get(type) || []).forEach((handler) => handler(event));
    return event;
  }

  dispatchEvent(event) {
    this.dispatched.push(event);
    (this.listeners.get(event.type) || []).forEach((handler) => handler(event));
    return !event.defaultPrevented;
  }

  click() {
    this.clickCount += 1;
    if (this.throwOnClick) throw new Error('native click blocked');
  }

  focus() {
    this.focusCount += 1;
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
}

function createFileReader({ base64 = 'QUJD' } = {}) {
  return class FakeFileReader {
    readAsDataURL() {
      this.result = `data:image/png;base64,${base64}`;
      this.onload();
    }
  };
}

function createFixture({
  currentMarkdownPath = 'docs/post.md',
  input = null,
  FileReaderCtor = createFileReader({ base64: 'QUJD' })
} = {}) {
  const imageInput = input || new FakeElement();
  const imageButton = new FakeElement();
  const textarea = new FakeElement();
  textarea.value = 'Before';
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  const calls = [];
  const emittedAssets = [];
  const toasts = [];
  const errors = [];
  const runtime = {
    getFileReader: () => FileReaderCtor,
    createMouseEvent: (type, options) => ({ type, options }),
    onWindow: (type, handler, options) => {
      calls.push(['onWindow', type, options]);
      return () => calls.push(['detachWindow', type]);
    },
    setTimer: (handler, delay) => {
      calls.push(['setTimer', delay]);
      if (typeof handler === 'function') handler();
      return `timer:${delay}`;
    },
    emitAssetAdded: (detail) => {
      emittedAssets.push(detail);
      return true;
    },
    requestAssetDelete: () => false,
    emitAssetDeleteCanceled: (detail) => calls.push(['emitAssetDeleteCanceled', detail])
  };
  const session = createEditorMainImageSession({
    runtime,
    imageButton,
    imageInput,
    translate: (key, params) => (params && params.label ? `${key}:${params.label}` : key),
    getCurrentMarkdownPath: () => currentMarkdownPath,
    getContentRoot: () => 'wwwroot',
    getEditorTextarea: () => textarea,
    getEditorBody: () => textarea.value,
    buildMarkdown: (body) => body,
    setValue: (value, options) => {
      calls.push(['setValue', value, options]);
      textarea.value = value;
    },
    consoleRef: {
      error: (...args) => errors.push(args)
    },
    emitToast: (kind, message) => toasts.push([kind, message])
  });
  return {
    session,
    runtime,
    imageButton,
    imageInput,
    textarea,
    calls,
    emittedAssets,
    toasts,
    errors
  };
}

{
  const fixture = createFixture();
  const file = { name: 'Hero Image.png', type: 'image/png', size: 12 };

  await fixture.session.handleImageFiles([file], { source: 'drop' });

  assert.equal(fixture.emittedAssets.length, 1);
  assert.equal(fixture.emittedAssets[0].markdownPath, 'docs/post.md');
  assert.equal(fixture.emittedAssets[0].base64, 'QUJD');
  assert.equal(fixture.emittedAssets[0].mime, 'image/png');
  assert.equal(fixture.emittedAssets[0].source, 'drop');
  assert.match(fixture.emittedAssets[0].fileName, /^hero-image-[a-z0-9]+(?:-[a-z0-9]+)?\.png$/);
  assert.match(fixture.emittedAssets[0].commitPath, /^docs\/assets\/hero-image-[a-z0-9]+(?:-[a-z0-9]+)?\.png$/);
  assert.match(fixture.emittedAssets[0].relativePath, /^assets\/hero-image-[a-z0-9]+(?:-[a-z0-9]+)?\.png$/);
  assert.match(fixture.textarea.value, /^Before\n\n!\[Hero Image\]\(assets\/hero-image-[a-z0-9]+(?:-[a-z0-9]+)?\.png\)\n?$/);
  assert.deepEqual(fixture.toasts, [
    ['success', `editor.toasts.assetAttached:${fixture.emittedAssets[0].relativePath}`]
  ]);
  assert.deepEqual(fixture.errors, []);
}

{
  const imageInput = new FakeElement();
  imageInput.throwOnClick = true;
  const fixture = createFixture({ input: imageInput });

  fixture.session.openImageInputPicker();

  assert.deepEqual(fixture.calls[0], ['onWindow', 'focus', { once: true }]);
  assert.deepEqual(imageInput.dispatched, [
    { type: 'click', options: { bubbles: true } }
  ]);
}

{
  const fixture = createFixture({ currentMarkdownPath: '' });
  await fixture.session.handleImageFiles([{ name: 'hero.png', type: 'image/png' }]);
  assert.deepEqual(fixture.emittedAssets, []);
  assert.deepEqual(fixture.toasts, [
    ['warn', 'Open a markdown file before inserting images.']
  ]);
}

{
  class FailingFileReader {
    readAsDataURL() {
      this.error = new Error('read failed');
      this.onerror();
    }
  }
  const fixture = createFixture({ FileReaderCtor: FailingFileReader });

  await fixture.session.handleImageFiles([{ name: 'hero.png', type: 'image/png' }]);

  assert.deepEqual(fixture.emittedAssets, []);
  assert.deepEqual(fixture.toasts, [
    ['error', 'read failed']
  ]);
  assert.equal(fixture.errors.length, 1);
  assert.equal(fixture.errors[0][0], 'Failed to read image for insertion');
  assert.equal(fixture.errors[0][1].message, 'read failed');
}
