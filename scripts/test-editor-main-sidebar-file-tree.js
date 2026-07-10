import assert from 'node:assert/strict';

import { createEditorMainSidebarFileTree } from '../assets/js/editor-main-sidebar-file-tree.js';

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
    this.scrollHeight = 20;
    this.textContent = '';
    this._innerHTML = '';
    this._className = '';
    this.value = '';
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
    return this._innerHTML;
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
      target: this,
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

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createDocumentFragment() {
    const fragment = new FakeElement('#fragment', this);
    fragment.nodeType = 11;
    return fragment;
  }
}

function createHarness({ openMarkdown } = {}) {
  const documentRef = new FakeDocument();
  const groupIndex = documentRef.createElement('section');
  const groupTabs = documentRef.createElement('section');
  const listIndex = documentRef.createElement('ul');
  const listTabs = documentRef.createElement('ul');
  listIndex.className = 'file-list';
  listTabs.className = 'file-list';
  groupIndex.appendChild(listIndex);
  groupTabs.appendChild(listTabs);
  const searchInput = documentRef.createElement('input');
  const indexTab = documentRef.createElement('button');
  indexTab.dataset.target = 'index';
  const tabsTab = documentRef.createElement('button');
  tabsTab.dataset.target = 'tabs';
  const status = [];
  const warnings = [];
  const alerts = [];
  let contentRoot = 'content';
  const tree = createEditorMainSidebarFileTree({
    runtime: { requestFrame: (callback) => callback() },
    documentRef,
    normalizeLangKey: (value) => String(value || '').trim().toLowerCase(),
    getContentRoot: () => contentRoot,
    setStatus: (message) => status.push(message || ''),
    onOpenMarkdown: openMarkdown || (async () => {}),
    onWarn: (...args) => warnings.push(args),
    alert: (message) => alerts.push(message)
  });
  tree.bind({
    listIndex,
    listTabs,
    searchInput,
    sideTabs: [indexTab, tabsTab],
    groupIndex,
    groupTabs
  });
  return {
    alerts,
    groupIndex,
    groupTabs,
    indexTab,
    listIndex,
    listTabs,
    searchInput,
    setContentRoot(value) { contentRoot = value; },
    status,
    tabsTab,
    tree,
    warnings
  };
}

{
  const h = createHarness();
  h.tree.renderIndex({
    Article: {
      ja: ['posts/article/v1/article_ja.md'],
      en: ['posts/article/v2/article_en.md', 'posts/article/v10/article_en.md']
    },
    About: 'about.md'
  });

  const items = h.listIndex.querySelectorAll('.file-item');
  assert.deepEqual(items.map(item => item.dataset.rel), [
    'posts/article/v10/article_en.md',
    'posts/article/v2/article_en.md',
    'posts/article/v1/article_ja.md',
    'about.md'
  ]);

  h.searchInput.value = 'v10';
  await h.searchInput.dispatch('input');
  assert.equal(items[0].style.display, '');
  assert.equal(items[1].style.display, 'none');
  assert.equal(h.listIndex.querySelector('details.file-group').open, true);
}

{
  const opened = [];
  const h = createHarness({
    openMarkdown: async (detail) => opened.push(detail)
  });
  h.tree.renderIndex({
    First: 'first.md',
    Second: 'second.md'
  });
  const items = h.listIndex.querySelectorAll('.file-item');
  await items[0].click();
  await items[1].click();

  assert.deepEqual(opened, [
    { relPath: 'first.md', url: 'content/first.md', contentRoot: 'content' },
    { relPath: 'second.md', url: 'content/second.md', contentRoot: 'content' }
  ]);
  assert.equal(items[0].classList.contains('is-active'), false);
  assert.equal(items[1].classList.contains('is-active'), true);
  assert.equal(h.status.at(-1), '');
}

{
  const h = createHarness({
    openMarkdown: async () => {
      throw new Error('open failed');
    }
  });
  h.tree.renderIndex({ Broken: 'broken.md' });
  await h.listIndex.querySelector('.file-item').click();

  assert.equal(h.status.at(-1), 'Failed to load: broken.md');
  assert.equal(h.warnings.length, 1);
  assert.match(h.alerts[0], /Failed to load file\nbroken\.md\nError: open failed/);
}

{
  const h = createHarness();
  h.tree.renderTabs({
    Home: {
      chs: { title: 'Home Chinese', location: 'tab/home_chs.md' },
      en: { title: 'Home', location: 'tab/home.md' }
    }
  });
  h.tree.switchGroup('tabs');

  assert.equal(h.groupIndex.hidden, true);
  assert.equal(h.groupTabs.hidden, false);
  assert.equal(h.indexTab.getAttribute('aria-selected'), 'false');
  assert.equal(h.tabsTab.getAttribute('aria-selected'), 'true');
  assert.deepEqual(
    h.listTabs.querySelectorAll('.file-item').map(item => item.dataset.rel),
    ['tab/home.md', 'tab/home_chs.md']
  );
}

{
  const h = createHarness();
  const maliciousTitle = '<img src=x onerror="globalThis.__pressFileTreeXss = true">';
  const maliciousPath = 'posts/\"><svg onload="globalThis.__pressFileTreeXss = true">.md';
  h.tree.renderIndex({
    [maliciousTitle]: maliciousPath
  });

  const item = h.listIndex.querySelector('.file-item');
  assert.equal(item.innerHTML, '');
  assert.equal(
    item.querySelector('.file-label').textContent,
    `${maliciousTitle} - "><svg onload="globalThis.__pressFileTreeXss = true">.md`
  );
  assert.equal(item.querySelector('.file-path').textContent, maliciousPath);
  assert.equal(item.querySelector('img'), null);
  assert.equal(item.querySelector('svg'), null);

  const maliciousTabTitle = '<script>globalThis.__pressFileTreeXss = true</script>';
  const maliciousTabPath = 'tab/\"><img src=x onerror="globalThis.__pressFileTreeXss = true">.md';
  h.tree.renderTabs({
    Unsafe: {
      en: { title: maliciousTabTitle, location: maliciousTabPath }
    }
  });

  const tabItem = h.listTabs.querySelector('.file-item');
  assert.equal(tabItem.innerHTML, '');
  assert.equal(tabItem.querySelector('.file-label').textContent, `EN - ${maliciousTabTitle}`);
  assert.equal(tabItem.querySelector('.file-path').textContent, maliciousTabPath);
  assert.equal(tabItem.querySelector('img'), null);
  assert.equal(tabItem.querySelector('script'), null);
}
