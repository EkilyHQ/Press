import assert from 'node:assert/strict';

import { createEditorMainToolbarCardPicker } from '../assets/js/editor-main-toolbar-card-picker.js';

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  setFromString(value) {
    this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
  }

  sync() {
    this.owner._className = Array.from(this.values).join(' ');
  }

  add(name) {
    this.values.add(name);
    this.sync();
  }

  remove(name) {
    this.values.delete(name);
    this.sync();
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
    this.classList = new FakeClassList(this);
    this.style = {};
    this.hidden = false;
    this.focusCount = 0;
    this.scrollTop = 0;
    this.offsetWidth = 120;
    this.textContent = '';
    this.value = '';
    this._className = '';
  }

  set className(value) {
    this._className = String(value || '');
    this.classList.setFromString(this._className);
  }

  get className() {
    return this._className;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML || '';
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

  appendChild(child) {
    if (!child) return child;
    if (child.nodeType === 11) {
      [...child.children].forEach((item) => this.appendChild(item));
      child.children.length = 0;
      return child;
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  append(...items) {
    items.forEach((item) => this.appendChild(item));
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    if (!this.listeners.has(type)) return;
    this.listeners.set(type, this.listeners.get(type).filter((item) => item !== handler));
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

  click() {
    return this.dispatch('click');
  }

  focus() {
    this.focusCount += 1;
  }

  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains(target));
  }

  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return this.tagName === selector.toLowerCase();
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (child.matches(selector)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, bottom: 32, width: 420 };
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName);
  }

  createDocumentFragment() {
    const fragment = new FakeElement('#fragment');
    fragment.nodeType = 11;
    return fragment;
  }
}

function createRuntime() {
  const calls = [];
  const documentHandlers = new Map();
  const windowHandlers = new Map();
  const add = (map, type, handler) => {
    if (!map.has(type)) map.set(type, []);
    map.get(type).push(handler);
  };
  return {
    calls,
    documentHandlers,
    windowHandlers,
    onDocument: (type, handler, options) => {
      calls.push(['onDocument', type, options]);
      add(documentHandlers, type, handler);
      return () => calls.push(['detachDocument', type]);
    },
    onWindow: (type, handler, options) => {
      calls.push(['onWindow', type, options]);
      add(windowHandlers, type, handler);
      return () => calls.push(['detachWindow', type]);
    },
    setTimer: (handler, delay) => {
      calls.push(['setTimer', delay]);
      if (typeof handler === 'function') handler();
      return `timer:${delay}`;
    },
    clearTimer: (id) => calls.push(['clearTimer', id])
  };
}

function createHarness(overrides = {}) {
  const toolbar = new FakeElement('div');
  const button = new FakeElement('button');
  const popover = new FakeElement('div');
  popover.setAttribute('hidden', '');
  const search = new FakeElement('input');
  const list = new FakeElement('div');
  const empty = new FakeElement('div');
  const runtime = createRuntime();
  const selected = [];
  let canOpen = overrides.canOpen ?? true;
  const entries = overrides.entries || [
    { key: 'Post', title: 'Title', location: 'post/main.md', search: 'post title' }
  ];
  const picker = createEditorMainToolbarCardPicker({
    runtime,
    documentRef: new FakeDocument(),
    editorToolbarEl: toolbar,
    cardButton: button,
    cardPopover: popover,
    cardSearchInput: search,
    cardListEl: list,
    cardEmptyEl: empty,
    entries,
    canOpen: () => canOpen,
    onSelectEntry: entry => selected.push(entry),
    onEscapeClose: () => selected.push({ key: 'escape' })
  });
  return {
    button,
    empty,
    list,
    picker,
    popover,
    runtime,
    search,
    selected,
    setCanOpen(value) { canOpen = value; }
  };
}

{
  const h = createHarness();
  h.picker.bind();
  h.button.click();

  assert.equal(h.picker.isOpen(), true);
  assert.equal(h.popover.hidden, false);
  assert.equal(h.popover.classList.contains('is-visible'), true);
  assert.equal(h.search.focusCount, 1);
  assert.deepEqual(h.runtime.calls.filter(([name]) => name === 'onDocument' || name === 'onWindow'), [
    ['onDocument', 'mousedown', true],
    ['onDocument', 'keydown', true],
    ['onWindow', 'resize', true],
    ['onWindow', 'scroll', true]
  ]);

  const first = h.list.querySelector('.card-picker-item');
  assert.ok(first);
  first.click();

  assert.equal(h.selected[0].key, 'Post');
  assert.equal(h.popover.hidden, true);
  assert.equal(h.button.getAttribute('aria-expanded'), 'false');
}

{
  const h = createHarness({
    entries: [
      { key: 'Post', title: 'Post', location: 'post.md', search: 'post article' },
      { key: 'Note', title: 'Note', location: 'note.md', search: 'note page' }
    ]
  });
  h.picker.bind();
  h.button.click();
  h.search.value = 'missing';
  h.search.dispatch('input');

  assert.equal(h.empty.hidden, false);
  assert.equal(h.list.querySelectorAll('.card-picker-item').length, 0);

  h.search.value = 'note';
  h.search.dispatch('input');
  assert.equal(h.empty.hidden, true);
  assert.equal(h.list.querySelectorAll('.card-picker-item').length, 1);
}

{
  const h = createHarness({ canOpen: false });
  h.picker.bind();
  h.button.click();
  assert.equal(h.picker.isOpen(), false);
  assert.equal(h.popover.hidden, true);

  h.setCanOpen(true);
  h.button.click();
  assert.equal(h.picker.isOpen(), true);
  h.setCanOpen(false);
  h.picker.update();
  assert.equal(h.picker.isOpen(), false);
  assert.equal(h.popover.hidden, true);
}

{
  const h = createHarness();
  h.picker.bind();
  h.button.click();
  const [handleKeydown] = h.runtime.documentHandlers.get('keydown') || [];
  assert.equal(typeof handleKeydown, 'function');

  const event = { key: 'Escape', defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  handleKeydown(event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(h.popover.hidden, true);
  assert.equal(h.selected.at(-1).key, 'escape');
}
