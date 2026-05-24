import assert from 'node:assert/strict';

import { createEditorMainSidebarSession } from '../assets/js/editor-main-sidebar-session.js';

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

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : !!force;
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    this.sync();
    return shouldAdd;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.open = false;
    this.scrollHeight = 0;
    this.textContent = '';
    this.innerHTML = '';
    this._className = '';
    this.classList = new FakeClassList(this);
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set className(value) {
    this._className = String(value || '');
    this.classList.setFromString(this._className);
  }

  get className() {
    return this._className;
  }

  setAttribute(name, value) {
    const text = String(value ?? '');
    this.attributes.set(name, text);
    if (name === 'hidden') this.hidden = true;
    if (name === 'open') this.open = true;
    if (name === 'class') this.className = text;
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = text;
    }
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'hidden') this.hidden = false;
    if (name === 'open') this.open = false;
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
      const children = [...child.children];
      child.children.length = 0;
      children.forEach((item) => this.appendChild(item));
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

  async dispatch(type, overrides = {}) {
    const event = {
      type,
      defaultPrevented: false,
      isTrusted: true,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...overrides
    };
    const results = (this.listeners.get(type) || []).map((handler) => handler(event));
    await Promise.all(results);
    return event;
  }

  click() {
    return this.dispatch('click');
  }

  getBoundingClientRect() {
    return { width: 0, height: 0, top: 0, left: 0 };
  }

  matches(selector) {
    if (selector === '.file-item:not([style*="display: none"])') {
      return this.classList.contains('file-item') && this.style.display !== 'none';
    }
    if (selector === 'details.file-group') {
      return this.tagName === 'details' && this.classList.contains('file-group');
    }
    if (selector === 'details.file-group[open]') {
      return this.tagName === 'details' && this.classList.contains('file-group') && this.open;
    }
    if (selector.startsWith('.')) {
      return this.classList.contains(selector.slice(1));
    }
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

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super('#document', null);
    this.ownerDocument = this;
    this.nodeType = 9;
    this.elements = new Map();
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createDocumentFragment() {
    const fragment = new FakeElement('#fragment', this);
    fragment.nodeType = 11;
    return fragment;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  addElement(id, { className = '', dataset = {}, tagName = 'div' } = {}) {
    const element = this.createElement(tagName);
    element.id = id;
    element.className = className;
    Object.assign(element.dataset, dataset);
    this.elements.set(id, element);
    this.appendChild(element);
    return element;
  }
}

function createFixture({ alert, onOpenMarkdown } = {}) {
  const documentRef = new FakeDocument();
  const listIndex = documentRef.addElement('listIndex', { className: 'file-list', tagName: 'ul' });
  const listTabs = documentRef.addElement('listTabs', { className: 'file-list', tagName: 'ul' });
  const statusEl = documentRef.addElement('sidebarStatus');
  const searchInput = documentRef.addElement('fileSearch', { tagName: 'input' });
  const groupIndex = documentRef.addElement('groupIndex');
  const groupTabs = documentRef.addElement('groupTabs');
  const currentFile = documentRef.addElement('currentFile');
  documentRef.addElement('tab-index', {
    className: 'sidebar-tab',
    dataset: { target: 'index' },
    tagName: 'button'
  });
  documentRef.addElement('tab-tabs', {
    className: 'sidebar-tab',
    dataset: { target: 'tabs' },
    tagName: 'button'
  });

  const calls = [];
  const alerts = [];
  const warnings = [];
  const runtime = {
    getElementById: (id) => documentRef.getElementById(id),
    requestFrame: (callback) => callback(),
    ensureEditorBaseDir: (dir) => calls.push(['ensureEditorBaseDir', dir])
  };

  const options = {
    runtime,
    documentRef,
    normalizeLangKey: (value) => String(value || '').trim().toLowerCase(),
    bindCurrentFileElement: (element) => calls.push(['bindCurrentFileElement', element === currentFile]),
    loadSiteConfig: async () => ({ contentRoot: 'content' }),
    loadIndexData: async (contentRoot) => {
      calls.push(['loadIndexData', contentRoot]);
      return { raw: { Post: 'docs/post.md' }, entries: { Post: { title: 'Post' } } };
    },
    loadTabsConfig: async (contentRoot) => {
      calls.push(['loadTabsConfig', contentRoot]);
      return {};
    },
    onSiteConfigLoaded: (detail) => calls.push(['onSiteConfigLoaded', detail.contentRoot]),
    onIndexLoaded: (detail) => calls.push(['onIndexLoaded', detail.contentRoot, Object.keys(detail.rawIndex)]),
    onOpenMarkdown: onOpenMarkdown || (async () => {}),
    onWarn: (...args) => warnings.push(args)
  };
  if (alert !== undefined) {
    options.alert = (message) => {
      alerts.push(message);
      alert(message);
    };
  }

  const session = createEditorMainSidebarSession(options);
  return {
    session,
    listIndex,
    listTabs,
    statusEl,
    groupIndex,
    groupTabs,
    searchInput,
    calls,
    alerts,
    warnings
  };
}

{
  const opened = [];
  const fixture = createFixture({
    alert: () => {},
    onOpenMarkdown: async (detail) => {
      opened.push(detail);
      throw new Error('open failed');
    }
  });
  await fixture.session.initialize();
  assert.deepEqual(fixture.calls.slice(0, 5), [
    ['bindCurrentFileElement', true],
    ['ensureEditorBaseDir', 'wwwroot/'],
    ['onSiteConfigLoaded', 'content'],
    ['loadIndexData', 'content'],
    ['onIndexLoaded', 'content', ['Post']]
  ]);
  assert.deepEqual(fixture.calls.at(-1), ['loadTabsConfig', 'content']);
  assert.equal(fixture.groupIndex.hidden, false);
  assert.equal(fixture.groupTabs.hidden, true);
  const items = fixture.listIndex.querySelectorAll('.file-item');
  assert.equal(items.length, 1);
  await items[0].click();
  assert.deepEqual(opened, [{ relPath: 'docs/post.md', url: 'content/docs/post.md', contentRoot: 'content' }]);
  assert.equal(fixture.statusEl.textContent, 'Failed to load: docs/post.md');
  assert.equal(fixture.alerts.length, 1);
  assert.match(fixture.alerts[0], /Failed to load file\ndocs\/post\.md\nError: open failed/);
  assert.equal(fixture.warnings.length, 1);
}

{
  const fixture = createFixture({
    onOpenMarkdown: async () => {
      throw new Error('no injected alert');
    }
  });
  await fixture.session.initialize();
  await fixture.listIndex.querySelectorAll('.file-item')[0].click();
  assert.equal(fixture.statusEl.textContent, 'Failed to load: docs/post.md');
  assert.deepEqual(fixture.alerts, []);
  assert.equal(fixture.warnings.length, 1);
}
