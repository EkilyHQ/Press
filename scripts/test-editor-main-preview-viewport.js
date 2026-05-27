import assert from 'node:assert/strict';

import { createEditorMainPreviewViewport } from '../assets/js/editor-main-preview-viewport.js';

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
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {};
    this.classList = new FakeClassList();
    this.rect = { width: 720, height: 480, left: 0, top: 0 };
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value ?? ''));
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

  getBoundingClientRect() {
    return this.rect;
  }
}

function createHarness() {
  const elements = new Map();
  const handles = [];
  const documentHandlers = new Map();
  const detached = [];
  const viewport = createEditorMainPreviewViewport({
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => selector === '[data-preview-resize]' ? handles : [],
    onDocument: (type, handler, options) => {
      documentHandlers.set(type, { handler, options });
      return () => detached.push(type);
    }
  });
  return {
    elements,
    handles,
    documentHandlers,
    detached,
    viewport,
    setElement(id, element) {
      elements.set(id, element);
      return element;
    },
    addHandle(side) {
      const handle = new FakeElement('button');
      handle.setAttribute('data-preview-resize', side);
      handles.push(handle);
      return handle;
    }
  };
}

{
  const harness = createHarness();
  const sizer = harness.setElement('previewFrameSizer', new FakeElement('div'));
  const shell = harness.setElement('previewViewportShell', new FakeElement('div'));
  shell.rect.width = 900;

  harness.viewport.setWidth(200);
  assert.equal(sizer.style.width, '360px');

  harness.viewport.setWidth(500.4);
  assert.equal(sizer.style.width, '500px');

  harness.viewport.setWidth(2000);
  assert.equal(sizer.style.width, '864px');
}

{
  const harness = createHarness();
  const sizer = harness.setElement('previewFrameSizer', new FakeElement('div'));
  const frame = harness.setElement('previewFrame', new FakeElement('iframe'));
  sizer.style.width = '640px';
  sizer.classList.add('is-resizing');
  frame.style.pointerEvents = 'none';

  harness.viewport.reset();

  assert.equal(sizer.style.width, '');
  assert.equal(sizer.classList.contains('is-resizing'), false);
  assert.equal(frame.style.pointerEvents, '');
}

{
  const harness = createHarness();
  const sizer = harness.setElement('previewFrameSizer', new FakeElement('div'));
  const shell = harness.setElement('previewViewportShell', new FakeElement('div'));
  const frame = harness.setElement('previewFrame', new FakeElement('iframe'));
  shell.rect.width = 900;
  sizer.rect.width = 500;
  let prevented = false;

  harness.viewport.startResize({
    clientX: 100,
    preventDefault: () => { prevented = true; }
  }, 'right');

  assert.equal(prevented, true);
  assert.equal(sizer.classList.contains('is-resizing'), true);
  assert.equal(frame.style.pointerEvents, 'none');
  assert.deepEqual(
    Array.from(harness.documentHandlers.entries()).map(([type, item]) => [type, item.options || null]),
    [
      ['pointermove', null],
      ['pointerup', { once: true }],
      ['pointercancel', { once: true }]
    ]
  );

  harness.documentHandlers.get('pointermove').handler({ clientX: 160 });
  assert.equal(sizer.style.width, '620px');

  harness.documentHandlers.get('pointerup').handler();
  assert.deepEqual(harness.detached, ['pointermove', 'pointerup', 'pointercancel']);
  assert.equal(sizer.classList.contains('is-resizing'), false);
  assert.equal(frame.style.pointerEvents, '');
}

{
  const harness = createHarness();
  const sizer = harness.setElement('previewFrameSizer', new FakeElement('div'));
  const shell = harness.setElement('previewViewportShell', new FakeElement('div'));
  shell.rect.width = 900;
  sizer.rect.width = 500;
  const handle = harness.addHandle('left');

  harness.viewport.bind();
  handle.dispatch('pointerdown', { clientX: 100, preventDefault() {} });
  harness.documentHandlers.get('pointermove').handler({ clientX: 130 });

  assert.equal(sizer.style.width, '440px');
}
