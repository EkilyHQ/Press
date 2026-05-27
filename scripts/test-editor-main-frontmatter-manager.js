import assert from 'node:assert/strict';

import { createEditorMainFrontMatterManager } from '../assets/js/editor-main-frontmatter-manager.js';

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

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.value = '';
    this.checked = false;
    this.indeterminate = false;
    this.type = '';
    this.rows = 0;
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

  appendChild(child) {
    if (!child) return child;
    child.parentElement = this;
    if (!child.ownerDocument) child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  append(...items) {
    items.forEach((item) => this.appendChild(item));
  }

  setAttribute(name, value) {
    const text = String(value ?? '');
    this.attributes.set(name, text);
    if (name === 'id') this.id = text;
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = text;
    }
  }

  getAttribute(name) {
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return Object.prototype.hasOwnProperty.call(this.dataset, key) ? this.dataset[key] : null;
    }
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  emit(type) {
    (this.listeners.get(type) || []).forEach((handler) => handler({ type, target: this }));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      if (!node) return;
      if (selector.startsWith('.') && node.classList && node.classList.contains(selector.slice(1))) found.push(node);
      if (!selector.startsWith('.') && !selector.startsWith('#') && node.tagName === selector.toLowerCase()) found.push(node);
      (node.children || []).forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.body = new FakeElement('body', this);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  setElement(id, element) {
    element.id = id;
    element.ownerDocument = this;
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  querySelector(selector) {
    const idMatch = String(selector || '').match(/^#([A-Za-z0-9_-]+)\s+(\.[A-Za-z0-9_-]+)$/);
    if (idMatch) {
      const root = this.getElementById(idMatch[1]);
      return root ? root.querySelector(idMatch[2]) : null;
    }
    return this.body.querySelector(selector);
  }
}

function findField(root, fieldId) {
  const stack = [...(root.children || [])];
  while (stack.length) {
    const node = stack.shift();
    if (node && node.dataset && node.dataset.fieldId === fieldId) return node;
    stack.push(...(node.children || []));
  }
  return null;
}

function createFixture() {
  const documentRef = new FakeDocument();
  const panel = documentRef.setElement('frontMatterPanel', documentRef.createElement('section'));
  panel.dataset.state = 'loading';
  const body = documentRef.setElement('frontMatterBody', documentRef.createElement('div'));
  const commonSection = documentRef.setElement('frontMatterCommonSection', documentRef.createElement('section'));
  const commonDescription = documentRef.createElement('p');
  commonDescription.className = 'frontmatter-section-description';
  const commonFields = documentRef.setElement('frontMatterCommonFields', documentRef.createElement('div'));
  commonSection.append(commonDescription, commonFields);
  const extraSection = documentRef.setElement('frontMatterExtraSection', documentRef.createElement('section'));
  const extraDescription = documentRef.createElement('p');
  extraDescription.className = 'frontmatter-section-description';
  const extraFields = documentRef.setElement('frontMatterExtraFields', documentRef.createElement('div'));
  extraSection.append(extraDescription, extraFields);
  const empty = documentRef.setElement('frontMatterEmpty', documentRef.createElement('div'));
  body.append(commonSection, extraSection, empty);
  panel.appendChild(body);
  documentRef.body.appendChild(panel);

  const syncedRoots = [];
  const manager = createEditorMainFrontMatterManager({
    documentRef,
    getElementById: id => documentRef.getElementById(id),
    querySelector: selector => documentRef.querySelector(selector),
    translate: (key, fallback) => fallback || key,
    translateWithLocaleFallback: key => `copy:${key}`,
    syncLabelWidth: root => syncedRoots.push(root)
  });
  return { documentRef, panel, commonDescription, commonFields, extraDescription, extraFields, empty, syncedRoots, manager };
}

{
  const fixture = createFixture();
  const { panel, commonDescription, commonFields, extraDescription, extraFields, empty, syncedRoots, manager } = fixture;

  assert.equal(manager.panel, panel);
  assert.equal(panel.dataset.state, 'ready');
  assert.ok(commonFields.children.length > 0);
  assert.ok(extraFields.children.length > 0);
  assert.equal(commonDescription.textContent, 'copy:editor.frontMatter.commonDescription');
  assert.equal(extraDescription.textContent, 'copy:editor.frontMatter.advancedDescription');
  assert.equal(empty.hidden, false);
  assert.ok(syncedRoots.includes(panel));

  const titleField = findField(panel, 'title');
  const draftField = findField(panel, 'draft');
  const dateField = findField(panel, 'date');
  assert.ok(titleField);
  assert.ok(draftField);
  assert.ok(dateField);
  assert.equal(titleField.querySelector('.frontmatter-field-head') != null, true);
  assert.equal(titleField.querySelector('.frontmatter-field-title').textContent, 'Title');
  assert.equal(draftField.querySelector('input').getAttribute('role'), 'switch');
}

{
  const fixture = createFixture();
  const { panel, empty, manager } = fixture;
  const changes = [];
  manager.setChangeHandler(() => changes.push(manager.buildMarkdown('Body')));

  const body = manager.setFromMarkdown('---\ntitle: Old title\ndate: 2026-05-26\ndraft: true\n---\nBody', { silent: true });
  assert.equal(body, 'Body');
  assert.deepEqual(changes, []);

  const titleInput = findField(panel, 'title').querySelector('input');
  const dateInput = findField(panel, 'date').querySelector('input');
  const draftInput = findField(panel, 'draft').querySelector('input');
  const draftSwitch = findField(panel, 'draft').querySelector('.frontmatter-switch');
  assert.equal(titleInput.value, 'Old title');
  assert.equal(dateInput.value, '2026-05-26');
  assert.equal(draftInput.checked, true);
  assert.equal(draftInput.getAttribute('aria-checked'), 'true');
  assert.equal(draftSwitch.dataset.state, 'on');
  assert.equal(empty.hidden, true);

  titleInput.value = 'New title';
  titleInput.emit('input');
  assert.equal(changes.length, 1);
  assert.match(changes[0], /title: New title/);

  draftInput.checked = false;
  draftInput.emit('change');
  assert.equal(draftInput.getAttribute('aria-checked'), 'false');
  assert.equal(draftSwitch.dataset.state, 'off');

  const rebuilt = manager.buildMarkdown('Updated body');
  assert.match(rebuilt, /title: New title/);
  assert.match(rebuilt, /draft: false/);
  assert.match(rebuilt, /Updated body$/);

  manager.clear();
  assert.equal(empty.hidden, false);
  assert.equal(titleInput.value, '');
  assert.equal(draftInput.checked, false);
}

{
  const documentRef = new FakeDocument();
  const manager = createEditorMainFrontMatterManager({
    documentRef,
    getElementById: id => documentRef.getElementById(id)
  });

  assert.equal(manager, null);
}
