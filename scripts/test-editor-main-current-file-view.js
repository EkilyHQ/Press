import assert from 'node:assert/strict';

import { createEditorMainCurrentFileView, normalizeCurrentFileBreadcrumb } from '../assets/js/editor-main-current-file-view.js';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName || 'div').toLowerCase();
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
    this.textContent = '';
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
    this.body = new FakeElement('body');
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
    'editor.currentFile.status.existing': 'Existing',
    'editor.currentFile.status.missing': 'Missing',
    'editor.currentFile.status.error': 'Error',
    'editor.currentFile.meta.lastChecked': `Last checked ${params.time || ''}`,
    'editor.currentFile.draft.justNow': 'just now',
    'editor.currentFile.draft.savedHtml': `Saved ${params.time || ''}`,
    'editor.currentFile.draft.savedConflictHtml': `Conflict saved ${params.time || ''}`,
    'editor.currentFile.draft.conflict': 'Conflict',
    'editor.currentFile.draft.available': 'Draft available',
    'editor.currentFile.draft.saved': 'Saved'
  };
  return map[key] || key;
};

assert.deepEqual(
  normalizeCurrentFileBreadcrumb([{ label: ' Article ', nodeId: 12, path: 'post/a.md' }, { label: '' }], 'fallback.md'),
  [{ label: 'Article', nodeId: '12', path: 'post/a.md' }]
);
assert.deepEqual(
  normalizeCurrentFileBreadcrumb(null, 'fallback.md'),
  [{ label: 'fallback.md', nodeId: '', path: 'fallback.md' }]
);

{
  const currentFileEl = new FakeElement('span');
  const documentRef = new FakeDocument(currentFileEl);
  const emptyStates = [];
  const rendered = [];
  const view = createEditorMainCurrentFileView({
    runtime: { getElementById: (id) => documentRef.getElementById(id) },
    documentRef,
    translate,
    getCurrentLang: () => 'en',
    normalizeLangKey: (value) => String(value || '').trim().toLowerCase(),
    applyEditorEmptyState: (empty) => emptyStates.push(empty),
    onRendered: (info) => rendered.push(info)
  });

  const info = {
    path: 'post/<unsafe>.md',
    source: 'article',
    breadcrumb: [
      { label: 'Post & <Unsafe>', nodeId: 'articles', path: 'post' },
      { label: 'Draft', nodeId: 'draft', path: 'post/<unsafe>.md' }
    ],
    status: { state: 'error', checkedAt: 1700000000123, message: 'Not <Found>', code: 404 },
    dirty: true,
    draft: { savedAt: Date.now() - 10_000, conflict: false, hasContent: true },
    draftState: 'saved',
    loaded: true
  };
  view.render(info);

  assert.equal(emptyStates.at(-1), false);
  assert.equal(rendered.at(-1), info);
  assert.match(currentFileEl.innerHTML, /Post &amp; &lt;Unsafe&gt;/);
  assert.match(currentFileEl.innerHTML, /cf-breadcrumb-item-static/);
  assert.doesNotMatch(currentFileEl.innerHTML, /<button|<a href|data-current-file-node-id/);
  assert.match(currentFileEl.innerHTML, /Saved just now/);
  assert.equal(currentFileEl.getAttribute('data-file-state'), 'error');
  assert.equal(currentFileEl.getAttribute('data-last-checked'), '1700000000123');
  assert.equal(currentFileEl.getAttribute('data-dirty'), '1');
  assert.equal(currentFileEl.getAttribute('data-draft-state'), 'saved');
  assert.match(currentFileEl.getAttribute('title'), /Post & <Unsafe>\/Draft/);
  assert.match(currentFileEl.getAttribute('title'), /post\/<unsafe>\.md/);
  assert.match(currentFileEl.getAttribute('title'), /Error \(Not <Found> · HTTP 404\)/);

  view.render({ path: '', source: '', breadcrumb: [], status: null, dirty: false, draft: null, draftState: '', loaded: false });
  assert.equal(emptyStates.at(-1), true);
  assert.equal(currentFileEl.textContent, '');
  assert.equal(currentFileEl.getAttribute('data-file-state'), null);
  assert.equal(currentFileEl.getAttribute('data-last-checked'), null);
  assert.equal(currentFileEl.getAttribute('data-dirty'), null);
  assert.equal(currentFileEl.getAttribute('data-draft-state'), null);
  assert.equal(currentFileEl.getAttribute('title'), null);
}
