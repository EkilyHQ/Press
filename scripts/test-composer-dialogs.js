import assert from 'node:assert/strict';
import { createComposerDialogController } from '../assets/js/composer-dialogs.js';

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  add(...names) {
    names.forEach((name) => this.values.add(name));
    this.element.className = Array.from(this.values).join(' ');
  }

  remove(...names) {
    names.forEach((name) => this.values.delete(name));
    this.element.className = Array.from(this.values).join(' ');
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName, ownerDocument = null) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.eventListeners = {};
    this.hidden = false;
    this.id = '';
    this.className = '';
    this.classList = new FakeClassList(this);
    this.textContent = '';
    this.type = '';
    this.value = '';
    this.placeholder = '';
    this.autocomplete = '';
    this.autocapitalize = '';
    this.spellcheck = true;
    this.offsetWidth = 180;
    this.offsetHeight = 72;
  }

  get isConnected() {
    if (this === this.ownerDocument?.body) return true;
    return !!(this.parentNode && this.parentNode.isConnected);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  appendChild(child) {
    child.parentNode = this;
    if (!child.ownerDocument) child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  addEventListener(type, handler) {
    if (!this.eventListeners[type]) this.eventListeners[type] = new Set();
    this.eventListeners[type].add(handler);
  }

  removeEventListener(type, handler) {
    if (this.eventListeners[type]) this.eventListeners[type].delete(handler);
  }

  dispatch(type, extra = {}) {
    const event = {
      target: this,
      key: '',
      shiftKey: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...extra
    };
    (this.eventListeners[type] || []).forEach((handler) => handler(event));
    return event;
  }

  click() {
    return this.dispatch('click');
  }

  focus() {
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  select() {
    this.selected = true;
  }

  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains(target));
  }

  getBoundingClientRect() {
    return { top: 20, left: 30, right: 210, bottom: 60, width: 180, height: 40 };
  }
}

function find(root, predicate) {
  if (!root) return null;
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

function createFakeDocument() {
  const documentRef = {
    activeElement: null,
    documentElement: { clientWidth: 960, clientHeight: 640 },
    eventListeners: {},
    createElement(tagName) {
      return new FakeElement(tagName, documentRef);
    },
    getElementById(id) {
      return find(this.body, (node) => node.id === id);
    },
    addEventListener(type, handler) {
      if (!this.eventListeners[type]) this.eventListeners[type] = new Set();
      this.eventListeners[type].add(handler);
    },
    removeEventListener(type, handler) {
      if (this.eventListeners[type]) this.eventListeners[type].delete(handler);
    }
  };
  documentRef.body = new FakeElement('body', documentRef);
  return documentRef;
}

function findByClass(root, className) {
  return find(root, (node) => String(node.className || '').split(/\s+/).includes(className));
}

function createController() {
  const documentRef = createFakeDocument();
  const controller = createComposerDialogController({
    documentRef,
    setTimeoutRef: (fn) => {
      fn();
      return 1;
    },
    clearTimeoutRef: () => {},
    requestAnimationFrameRef: (fn) => {
      fn();
      return 1;
    },
    addWindowListener: () => () => {},
    getViewportSize: () => ({ width: 960, height: 640 }),
    getWindowScroll: () => ({ x: 0, y: 0 }),
    t: (key, params = {}) => {
      if (key === 'editor.composer.addEntryPrompt.message') return `Add ${params.label}`;
      return key;
    }
  });
  return { controller, documentRef };
}

{
  const { controller, documentRef } = createController();
  const anchor = documentRef.createElement('button');
  documentRef.body.appendChild(anchor);
  const resultPromise = controller.showAddEntryPrompt(anchor, {
    existingKeys: ['existing'],
    typeLabel: 'article'
  });
  const input = documentRef.getElementById('composerAddEntryKeyInput');
  const prompt = documentRef.getElementById('composerAddEntryPrompt');
  const confirm = findByClass(prompt, 'composer-confirm-confirm');
  const error = documentRef.getElementById('composerAddEntryPromptError');

  assert.equal(anchor.getAttribute('aria-expanded'), 'true');
  assert.equal(input.getAttribute('aria-invalid'), 'false');
  assert.equal(documentRef.activeElement, input);

  confirm.click();
  assert.equal(error.textContent, 'editor.composer.addEntryPrompt.errorEmpty');
  assert.equal(input.getAttribute('aria-invalid'), 'true');

  input.value = 'existing';
  input.dispatch('input');
  confirm.click();
  assert.equal(error.textContent, 'editor.composer.addEntryPrompt.errorDuplicate');

  input.value = 'new-entry';
  input.dispatch('input');
  confirm.click();
  assert.deepEqual(await resultPromise, { confirmed: true, value: 'new-entry' });
  assert.equal(anchor.getAttribute('aria-expanded'), 'false');
}

{
  const { controller, documentRef } = createController();
  const anchor = documentRef.createElement('button');
  documentRef.body.appendChild(anchor);
  const resultPromise = controller.showAddEntryPrompt(anchor, {
    validate: (value) => ({ ok: true, value: `v${value}` })
  });
  const input = documentRef.getElementById('composerAddEntryKeyInput');
  const prompt = documentRef.getElementById('composerAddEntryPrompt');
  input.value = '1.0.0';
  findByClass(prompt, 'composer-confirm-confirm').click();
  assert.deepEqual(await resultPromise, { confirmed: true, value: 'v1.0.0' });
}

{
  const { controller, documentRef } = createController();
  const anchor = documentRef.createElement('button');
  documentRef.body.appendChild(anchor);
  const resultPromise = controller.showDiscardConfirm(anchor, 'Discard draft?');
  const prompt = documentRef.getElementById('composerDiscardConfirm');
  assert.equal(prompt.hidden, false);
  assert.equal(anchor.getAttribute('aria-expanded'), 'true');
  findByClass(prompt, 'composer-confirm-confirm').click();
  assert.equal(await resultPromise, true);
  assert.equal(anchor.getAttribute('aria-expanded'), 'false');
}

{
  const { controller, documentRef } = createController();
  const resultPromise = controller.requestMarkdownProtectionPassword({ confirm: true });
  const password = documentRef.getElementById('composerMarkdownProtectionPasswordInput');
  const confirmation = documentRef.getElementById('composerMarkdownProtectionPasswordConfirm');
  const overlay = documentRef.getElementById('composerMarkdownProtectionPasswordDialog');
  const error = documentRef.getElementById('composerMarkdownProtectionPasswordError');
  const confirm = findByClass(overlay, 'composer-confirm-confirm');

  assert.equal(password.type, 'password');
  assert.equal(password.getAttribute('data-1p-ignore'), 'true');
  assert.equal(password.getAttribute('data-lpignore'), 'true');
  assert.equal(confirmation.getAttribute('data-1p-ignore'), 'true');
  assert.equal(confirmation.getAttribute('data-lpignore'), 'true');

  password.value = 'secret';
  confirmation.value = 'different';
  confirm.click();
  assert.equal(error.textContent, 'editor.composer.markdown.protection.passwordMismatch');
  assert.equal(confirmation.getAttribute('aria-invalid'), 'true');

  confirmation.value = 'secret';
  confirm.click();
  assert.equal(await resultPromise, 'secret');
  assert.equal(overlay.hidden, true);
}

console.log('composer dialogs tests passed');
