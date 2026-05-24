import assert from 'node:assert/strict';

import { createEditorMainToolbarSession } from '../assets/js/editor-main-toolbar-session.js';

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
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.disabled = false;
    this.hidden = false;
    this.focusCount = 0;
    this.scrollTop = 0;
    this.offsetWidth = 120;
    this.textContent = '';
    this._className = '';
    this.classList = new FakeClassList(this);
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
    const text = String(value ?? '');
    this.attributes.set(name, text);
    if (name === 'hidden') this.hidden = true;
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = text;
    }
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'hidden') this.hidden = false;
  }

  getAttribute(name) {
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return Object.prototype.hasOwnProperty.call(this.dataset, key) ? this.dataset[key] : null;
    }
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

  dispatchEvent(event) {
    this.dispatchedEvents = this.dispatchedEvents || [];
    this.dispatchedEvents.push(event);
    (this.listeners.get(event.type) || []).forEach((handler) => handler(event));
    return !event.defaultPrevented;
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
    const result = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        if (child.matches(selector)) result.push(child);
        visit(child);
      });
    };
    visit(this);
    return result;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, bottom: 32, width: 420 };
  }
}

class FakeTextarea extends FakeElement {
  constructor(value = '') {
    super('textarea');
    this.value = value;
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  setRangeText(text, start, end, selectionMode = 'preserve') {
    this.value = `${this.value.slice(0, start)}${text}${this.value.slice(end)}`;
    if (selectionMode === 'end') {
      const position = start + String(text).length;
      this.setSelectionRange(position, position);
    }
  }
}

class FakeDocument {
  constructor(elements = {}) {
    this.elements = new Map(Object.entries(elements));
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  createDocumentFragment() {
    const fragment = new FakeElement('#fragment');
    fragment.nodeType = 11;
    return fragment;
  }
}

function createRuntime(elements) {
  const calls = [];
  return {
    calls,
    getElementById: (id) => elements.get(id) || null,
    onDocument: (type, handler, options) => {
      calls.push(['onDocument', type, options]);
      return () => calls.push(['detachDocument', type]);
    },
    onWindow: (type, handler, options) => {
      calls.push(['onWindow', type, options]);
      return () => calls.push(['detachWindow', type]);
    },
    setTimer: (handler, delay) => {
      calls.push(['setTimer', delay]);
      if (typeof handler === 'function') handler();
      return `timer:${delay}`;
    },
    clearTimer: (id) => calls.push(['clearTimer', id]),
    createEvent: (type, options) => ({ type, options })
  };
}

{
  const bold = new FakeElement('button');
  bold.textContent = 'Bold';
  const textarea = new FakeTextarea('hello world');
  textarea.setSelectionRange(0, 5);
  const elements = new Map([['btnFmtBold', bold]]);
  const runtime = createRuntime(elements);
  const session = createEditorMainToolbarSession({
    runtime,
    documentRef: new FakeDocument(Object.fromEntries(elements)),
    getEditorTextarea: () => textarea,
    translate: (key) => key
  });

  session.bind();
  bold.click();

  assert.equal(textarea.value, '**hello** world');
  assert.equal(textarea.selectionStart, 0);
  assert.equal(textarea.selectionEnd, 9);
  assert.deepEqual(textarea.dispatchedEvents, [
    { type: 'input', options: { bubbles: true, cancelable: true } }
  ]);
}

{
  const toolbar = new FakeElement('div');
  const cardButton = new FakeElement('button');
  const popover = new FakeElement('div');
  popover.setAttribute('hidden', '');
  const search = new FakeElement('input');
  const list = new FakeElement('div');
  const empty = new FakeElement('div');
  const textarea = new FakeTextarea('');
  textarea.setSelectionRange(0, 0);
  const entries = [{
    key: 'Post',
    title: 'Title',
    location: 'post/main.md',
    search: 'post title'
  }];
  const elements = new Map([
    ['editorToolbar', toolbar],
    ['btnInsertCard', cardButton],
    ['editorCardPicker', popover],
    ['cardPickerSearch', search],
    ['cardPickerList', list],
    ['cardPickerEmpty', empty]
  ]);
  const runtime = createRuntime(elements);
  const session = createEditorMainToolbarSession({
    runtime,
    documentRef: new FakeDocument(Object.fromEntries(elements)),
    getEditorTextarea: () => textarea,
    editorToolbarEl: toolbar,
    cardButton,
    cardPopover: popover,
    cardSearchInput: search,
    cardListEl: list,
    cardEmptyEl: empty,
    getCardEntries: () => entries,
    translate: (key) => key
  });

  session.bind();
  assert.equal(cardButton.disabled, false);
  cardButton.click();

  assert.equal(popover.hidden, false);
  assert.equal(popover.classList.contains('is-visible'), true);
  assert.equal(search.focusCount, 1);
  assert.deepEqual(runtime.calls.filter(([name]) => name === 'onDocument' || name === 'onWindow'), [
    ['onDocument', 'mousedown', true],
    ['onDocument', 'keydown', true],
    ['onWindow', 'resize', true],
    ['onWindow', 'scroll', true]
  ]);
  assert.deepEqual(runtime.calls.filter(([name]) => name === 'setTimer'), [
    ['setTimer', 0]
  ]);

  const firstCard = list.querySelector('.card-picker-item');
  assert.ok(firstCard);
  firstCard.click();

  assert.equal(textarea.value, '[Post](?id=post/main.md)');
  assert.deepEqual(textarea.dispatchedEvents.at(-1), {
    type: 'input',
    options: { bubbles: true, cancelable: true }
  });
  assert.equal(popover.hidden, true);
  assert.deepEqual(runtime.calls.filter(([name]) => name === 'setTimer'), [
    ['setTimer', 0],
    ['setTimer', 360]
  ]);
}
