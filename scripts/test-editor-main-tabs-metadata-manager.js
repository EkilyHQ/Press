import assert from 'node:assert/strict';

import { createEditorMainTabsMetadataManager } from '../assets/js/editor-main-tabs-metadata-manager.js';

class FakeElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.listeners = new Map();
    this.className = '';
    this.hidden = false;
    this.id = '';
    this.textContent = '';
    this.type = '';
    this.value = '';
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
      if (selector.startsWith('.') && node.className.split(/\s+/).includes(selector.slice(1))) found.push(node);
      if (selector.startsWith('#') && node.id === selector.slice(1)) found.push(node);
      if (!selector.startsWith('.') && !selector.startsWith('#') && node.tagName === selector.toLowerCase()) found.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
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
}

function createFixture() {
  const documentRef = new FakeDocument();
  const panel = documentRef.setElement('frontMatterPanel', documentRef.createElement('section'));
  const body = documentRef.setElement('frontMatterBody', documentRef.createElement('div'));
  panel.appendChild(body);
  const syncedRoots = [];
  const translated = [];
  const manager = createEditorMainTabsMetadataManager({
    documentRef,
    getElementById: id => documentRef.getElementById(id),
    translateWithLocaleFallback: (key, fallbacks = {}) => {
      translated.push({ key, fallbacks });
      return `copy:${key}`;
    },
    syncLabelWidth: root => syncedRoots.push(root)
  });
  return { documentRef, panel, body, syncedRoots, translated, manager };
}

{
  const fixture = createFixture();
  const { manager, panel, body, syncedRoots, translated } = fixture;

  assert.equal(manager.panel, panel);
  assert.equal(body.children.includes(manager.section), true);
  assert.equal(manager.section.id, 'tabsMetadataSection');
  assert.equal(manager.section.className, 'frontmatter-section');
  assert.equal(manager.section.hidden, true);
  assert.equal(manager.section.querySelector('.frontmatter-section-title').textContent, 'copy:editor.tabsMetadata.title');
  assert.equal(
    manager.section.querySelector('.frontmatter-section-description').textContent,
    'copy:editor.tabsMetadata.description'
  );
  assert.equal(manager.section.querySelector('.frontmatter-field').dataset.fieldId, 'tabs-title');
  assert.equal(manager.section.querySelector('.frontmatter-field-title').textContent, 'copy:editor.tabsMetadata.fields.title');
  assert.deepEqual(
    translated.map(item => item.key),
    ['editor.tabsMetadata.title', 'editor.tabsMetadata.description', 'editor.tabsMetadata.fields.title']
  );
  assert.deepEqual(syncedRoots, [panel]);
}

{
  const { manager } = createFixture();
  const changes = [];
  const input = manager.section.querySelector('input');

  manager.setChangeHandler(value => changes.push(value));
  manager.setValue({ title: 'Existing page' }, { silent: true });
  assert.equal(input.value, 'Existing page');
  assert.deepEqual(changes, []);

  manager.setValue('Programmatic page');
  assert.deepEqual(changes, [{ title: 'Programmatic page' }]);

  input.value = 'Typed page';
  input.emit('input');
  assert.deepEqual(changes.at(-1), { title: 'Typed page' });

  manager.setVisible(true);
  assert.equal(manager.section.hidden, false);
  manager.setVisible(false);
  assert.equal(manager.section.hidden, true);
}

{
  const documentRef = new FakeDocument();
  documentRef.setElement('frontMatterPanel', documentRef.createElement('section'));

  const manager = createEditorMainTabsMetadataManager({
    documentRef,
    getElementById: id => documentRef.getElementById(id)
  });

  assert.equal(manager, null);
}
