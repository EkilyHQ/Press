import assert from 'node:assert/strict';

import { createComposerEditorShell } from '../assets/js/composer-editor-shell.js';

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

  toggle(name, force) {
    const next = force === undefined ? !this.values.has(name) : !!force;
    if (next) this.values.add(name);
    else this.values.delete(name);
    return next;
  }
}

class FakeStyle {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, value);
  }

  removeProperty(name) {
    this.values.delete(name);
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.attrs = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.style = new FakeStyle();
    this.hidden = false;
    this.scrollTop = 0;
    this.children = [];
  }

  setAttribute(name, value) {
    this.attrs.set(name, String(value));
  }

  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }

  removeAttribute(name) {
    this.attrs.delete(name);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatch(type, event = {}) {
    const handlers = this.listeners.get(type) || [];
    handlers.forEach(handler => handler(event));
  }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
}

function makeDocument(elements = {}) {
  const map = new Map(Object.entries(elements));
  return {
    body: new FakeElement('body'),
    documentElement: { style: new FakeStyle(), clientWidth: 640 },
    visibilityState: 'visible',
    getElementById(id) {
      return map.get(id) || null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    addEventListener() {
      throw new Error('document listener registration should be injected');
    },
    removeEventListener() {
      throw new Error('document listener cleanup should be injected');
    }
  };
}

function listenerHarness() {
  const entries = [];
  return {
    entries,
    add(type, handler, options) {
      const entry = { type, handler, options, disposed: false };
      entries.push(entry);
      return () => {
        entry.disposed = true;
      };
    },
    fire(type, event = {}) {
      entries
        .filter(entry => entry.type === type && !entry.disposed)
        .forEach(entry => entry.handler(event));
    }
  };
}

{
  const resizer = new FakeElement('editorRailResizer');
  const shellEl = new FakeElement('editorAppShell');
  const documentRef = makeDocument({
    editorRailResizer: resizer,
    editorAppShell: shellEl
  });
  const documentListeners = listenerHarness();
  const windowListeners = listenerHarness();
  const writes = [];
  const editorSessionStateStore = {
    readUnscopedNumber(key, fallback) {
      assert.equal(key, 'press_editor_rail_width');
      return fallback;
    },
    writeUnscopedNumber(key, value) {
      writes.push([key, value]);
    }
  };

  const shell = createComposerEditorShell({
    documentRef,
    addDocumentListener: (type, handler, options) => documentListeners.add(type, handler, options),
    addWindowListener: (type, handler, options) => windowListeners.add(type, handler, options),
    matchesMedia: () => false,
    getViewportWidth: () => 900,
    editorSessionStateStore
  });

  shell.initEditorRailResize();
  assert.equal(resizer.getAttribute('aria-valuenow'), '340');
  assert.equal(resizer.getAttribute('aria-valuemax'), '414');
  assert.equal(windowListeners.entries.some(entry => entry.type === 'resize'), true);

  let prevented = false;
  resizer.dispatch('pointerdown', {
    clientX: 100,
    preventDefault() {
      prevented = true;
    }
  });
  assert.equal(prevented, true);
  assert.equal(shellEl.classList.contains('is-resizing-rail'), true);
  assert.equal(documentListeners.entries.filter(entry => entry.type.startsWith('pointer')).length, 3);

  documentListeners.fire('pointermove', { clientX: 300 });
  assert.equal(resizer.getAttribute('aria-valuenow'), '414');
  documentListeners.fire('pointerup');
  assert.equal(shellEl.classList.contains('is-resizing-rail'), false);
  assert.deepEqual(writes, [['press_editor_rail_width', 414]]);
  assert.equal(documentListeners.entries.filter(entry => entry.type.startsWith('pointer')).every(entry => entry.disposed), true);
}

{
  const shellEl = new FakeElement('editorAppShell');
  const scrim = new FakeElement('editorRailScrim');
  const toggleA = new FakeElement('toggle-a');
  const toggleB = new FakeElement('toggle-b');
  const documentRef = makeDocument({
    editorAppShell: shellEl,
    editorRailScrim: scrim
  });
  documentRef.querySelectorAll = selector => (selector === '[data-editor-rail-toggle]' ? [toggleA, toggleB] : []);
  const documentListeners = listenerHarness();
  const windowListeners = listenerHarness();
  let mobile = true;

  const shell = createComposerEditorShell({
    documentRef,
    addDocumentListener: (type, handler, options) => documentListeners.add(type, handler, options),
    addWindowListener: (type, handler, options) => windowListeners.add(type, handler, options),
    matchesMedia: () => mobile
  });

  shell.initMobileEditorRail();
  toggleA.dispatch('click');
  assert.equal(shellEl.classList.contains('is-rail-open'), true);
  assert.equal(toggleA.getAttribute('aria-expanded'), 'true');
  assert.equal(toggleB.getAttribute('aria-expanded'), 'true');
  assert.equal(scrim.hidden, false);

  documentListeners.fire('keydown', { key: 'Escape' });
  assert.equal(shellEl.classList.contains('is-rail-open'), false);

  toggleB.dispatch('click');
  assert.equal(shellEl.classList.contains('is-rail-open'), true);
  mobile = false;
  windowListeners.fire('resize');
  assert.equal(shellEl.classList.contains('is-rail-open'), false);
}

{
  const documentRef = makeDocument();
  const scrollCalls = [];
  const shell = createComposerEditorShell({
    documentRef,
    scrollWindowToTop: behavior => scrollCalls.push(behavior)
  });

  shell.scrollEditorContentToTop('auto');
  assert.deepEqual(scrollCalls, ['auto']);
}

{
  const documentRef = makeDocument();
  const documentListeners = listenerHarness();
  const windowListeners = listenerHarness();
  const persisted = [];
  let visibilityState = 'visible';
  const shell = createComposerEditorShell({
    documentRef,
    addDocumentListener: (type, handler, options) => documentListeners.add(type, handler, options),
    addWindowListener: (type, handler, options) => windowListeners.add(type, handler, options),
    getDocumentVisibilityState: () => visibilityState,
    persistDynamicEditorState: () => persisted.push('persist')
  });

  shell.bindEditorStatePersistenceListeners();
  windowListeners.fire('pagehide');
  visibilityState = 'hidden';
  documentListeners.fire('visibilitychange');
  assert.deepEqual(persisted, ['persist', 'persist']);
}
