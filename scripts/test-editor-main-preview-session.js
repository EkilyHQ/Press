import assert from 'node:assert/strict';

import { createEditorMainPreviewSession } from '../assets/js/editor-main-preview-session.js';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(name) {
    this.values.add(name);
  }

  remove(name) {
    this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.classList = new FakeClassList();
    this.hidden = false;
    this.textContent = '';
    this.focusCount = 0;
    this._innerHTML = '';
    this.rect = { width: 720, height: 480, left: 0, top: 0 };
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    if (!child) return child;
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value ?? ''));
    if (name === 'hidden') this.hidden = true;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'hidden') this.hidden = false;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatch(type, overrides = {}) {
    const event = { type, target: this, ...overrides };
    (this.listeners.get(type) || []).forEach((handler) => handler(event));
    return event;
  }

  focus() {
    this.focusCount += 1;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  querySelectorAll(selector) {
    const wantedTag = String(selector || '').toLowerCase();
    const found = [];
    const visit = (node) => {
      if (!node) return;
      if (wantedTag && node.tagName === wantedTag) found.push(node);
      (node.children || []).forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  setElement(id, element) {
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

function createRuntime(documentRef, overrides = {}) {
  const windowHandlers = new Map();
  const documentHandlers = new Map();
  const messages = [];
  const calls = [];
  const runtime = {
    getElementById: id => documentRef.getElementById(id),
    querySelectorAll: selector => documentRef.querySelectorAll(selector),
    requestFrame: (handler) => {
      calls.push(['requestFrame']);
      if (typeof handler === 'function') handler();
      return 'frame:1';
    },
    cancelFrame: id => calls.push(['cancelFrame', id]),
    setTimer: (handler, delay) => {
      calls.push(['setTimer', delay]);
      if (typeof handler === 'function') handler();
      return `timer:${delay}`;
    },
    clearTimer: id => calls.push(['clearTimer', id]),
    onWindow: (type, handler, options) => {
      if (!windowHandlers.has(type)) windowHandlers.set(type, []);
      windowHandlers.get(type).push(handler);
      calls.push(['onWindow', type, options || null]);
      return () => calls.push(['detachWindow', type]);
    },
    onDocument: (type, handler, options) => {
      if (!documentHandlers.has(type)) documentHandlers.set(type, []);
      documentHandlers.get(type).push(handler);
      calls.push(['onDocument', type, options || null]);
      return () => calls.push(['detachDocument', type]);
    },
    postMessage: (target, payload) => {
      messages.push({ target, payload });
      return true;
    },
    getLocationOrigin: () => 'https://press.test',
    getLocationHref: () => 'https://press.test/index_editor.html',
    getEditorBaseDir: () => 'wwwroot/',
    prefersReducedMotion: () => false,
    ...overrides
  };
  return { runtime, windowHandlers, documentHandlers, messages, calls };
}

{
  const documentRef = new FakeDocument();
  const blocksWrap = documentRef.setElement('blocks-wrap', new FakeElement('div'));
  const img = new FakeElement('img');
  img.setAttribute('src', 'https://press.test/wwwroot/docs/assets/hero.png');
  blocksWrap.appendChild(img);
  const harness = createRuntime(documentRef);
  const session = createEditorMainPreviewSession({
    runtime: harness.runtime,
    documentRef,
    getContentRoot: () => 'wwwroot'
  });

  session.setCurrentFileInfo({ path: 'docs/post.md' });
  session.handleAssetPreviewEvent({
    detail: {
      markdownPath: 'docs/post.md',
      assets: [
        {
          path: 'docs/assets/hero.png',
          base64: 'QUJD',
          mime: 'image/png'
        }
      ]
    }
  });

  assert.equal(img.getAttribute('src'), 'data:image/png;base64,QUJD');
}

{
  const documentRef = new FakeDocument();
  const frameWindow = { id: 'preview-frame-window' };
  const previewFrame = documentRef.setElement('previewFrame', new FakeElement('iframe'));
  previewFrame.contentWindow = frameWindow;
  const harness = createRuntime(documentRef);
  const warnings = [];
  const session = createEditorMainPreviewSession({
    runtime: harness.runtime,
    documentRef,
    getContentRoot: () => 'wwwroot',
    getEditorValue: () => '# Hello',
    consoleRef: {
      warn: (...args) => warnings.push(args)
    }
  });

  session.bind();
  previewFrame.__pressPendingPreviewPayload = { type: 'pending-preview' };
  const [handleMessage] = harness.windowHandlers.get('message') || [];
  assert.equal(typeof handleMessage, 'function');

  handleMessage({
    origin: 'https://other.test',
    source: frameWindow,
    data: { type: 'press-editor-preview-ready' }
  });
  handleMessage({
    origin: 'https://press.test',
    source: { id: 'other-window' },
    data: { type: 'press-editor-preview-ready' }
  });
  assert.equal(harness.messages.length, 0);

  handleMessage({
    origin: 'https://press.test',
    source: frameWindow,
    data: { type: 'press-editor-preview-ready' }
  });
  assert.deepEqual(harness.messages, [
    { target: frameWindow, payload: { type: 'pending-preview' } }
  ]);

  handleMessage({
    origin: 'https://press.test',
    source: frameWindow,
    data: { type: 'press-editor-preview-error', message: 'render failed' }
  });
  assert.deepEqual(warnings, [
    ['Editor preview render failed', 'render failed']
  ]);
}
