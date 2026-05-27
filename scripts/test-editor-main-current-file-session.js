import assert from 'node:assert/strict';

import { createEditorMainCurrentFileSession } from '../assets/js/editor-main-current-file-session.js';

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.parentElement = null;
    this.textContent = '';
    this._innerHTML = '';
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
  }

  get innerHTML() {
    return this._innerHTML;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value ?? ''));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  contains(target) {
    if (target === this) return true;
    return this.children.some((child) => child.contains(target));
  }
}

class FakeDocument {
  constructor(currentFileEl) {
    this.currentFileEl = currentFileEl;
    this.body = new FakeElement();
    this.body.children.push(currentFileEl);
    currentFileEl.parentElement = this.body;
  }

  getElementById(id) {
    return id === 'currentFile' ? this.currentFileEl : null;
  }
}

const translate = (key, params = {}) => {
  const map = {
    'editor.currentFile.status.checking': 'Checking',
    'editor.currentFile.meta.checkingStarted': `Checking started ${params.time || ''}`,
    'editor.currentFile.draft.available': 'Draft available',
    'editor.currentFile.draft.conflict': 'Conflict'
  };
  return map[key] || key;
};

{
  const currentFileEl = new FakeElement();
  const documentRef = new FakeDocument(currentFileEl);
  const emptyStates = [];
  const rendered = [];
  const session = createEditorMainCurrentFileSession({
    runtime: { getElementById: (id) => documentRef.getElementById(id) },
    documentRef,
    translate,
    getCurrentLang: () => 'en',
    normalizeLangKey: (value) => String(value || '').trim().toLowerCase(),
    applyEditorEmptyState: (empty) => emptyStates.push(empty),
    onRendered: (info) => rendered.push(info)
  });

  const info = session.set({
    path: 'tab/home.md',
    breadcrumb: [{ label: ' Home ', nodeId: 123, path: 'tab/home.md' }],
    status: { state: 'CHECKING', checkedAt: '1700000000123' },
    dirty: true,
    loaded: true,
    draft: { hasContent: true, savedAt: 'not-a-date' }
  });

  assert.equal(info.path, 'tab/home.md');
  assert.equal(info.source, 'tabs');
  assert.deepEqual(info.breadcrumb, [{ label: 'Home', nodeId: '123', path: 'tab/home.md' }]);
  assert.deepEqual(info.status, { state: 'checking', checkedAt: 1700000000123 });
  assert.deepEqual(info.draft, { savedAt: null, conflict: false, hasContent: true });
  assert.equal(info.draftState, 'saved');
  assert.equal(info.dirty, true);
  assert.equal(info.loaded, true);
  assert.equal(session.getPath(), 'tab/home.md');
  assert.equal(currentFileEl.getAttribute('data-file-state'), 'checking');
  assert.equal(currentFileEl.getAttribute('data-dirty'), '1');
  assert.equal(currentFileEl.getAttribute('data-draft-state'), 'saved');
  assert.equal(emptyStates.at(-1), false);
  assert.equal(rendered.at(-1), info);

  const articleInfo = session.set('post/article.md');
  assert.equal(articleInfo.source, 'article');
  assert.deepEqual(articleInfo.breadcrumb, [{ label: 'post/article.md', nodeId: '', path: 'post/article.md' }]);
  assert.equal(session.getPath(), 'post/article.md');

  const emptyInfo = session.set(null);
  assert.equal(emptyInfo.path, '');
  assert.equal(emptyStates.at(-1), true);
}
