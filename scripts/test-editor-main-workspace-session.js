import assert from 'node:assert/strict';

import { createEditorMainWorkspaceSession } from '../assets/js/editor-main-workspace-session.js';

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

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : !!force;
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.focusCount = 0;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'hidden') this.hidden = true;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'hidden') this.hidden = false;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  toggleAttribute(name, force) {
    const shouldSet = force === undefined ? !this.attributes.has(name) : !!force;
    if (shouldSet) this.setAttribute(name, '');
    else this.removeAttribute(name);
    return shouldSet;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatch(type, overrides = {}) {
    const event = {
      type,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...overrides
    };
    (this.listeners.get(type) || []).forEach((handler) => handler(event));
    return event;
  }

  querySelector(selector) {
    if (selector === '.editor-main') {
      return this.children.find((child) => child.classList.contains('editor-main')) || null;
    }
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '[data-wrap]') {
      return this.children.filter((child) => child.dataset && child.dataset.wrap);
    }
    return [];
  }

  focus() {
    this.focusCount += 1;
  }
}

function createFixture({ forceMarkdownWrap = true } = {}) {
  const elements = new Map();
  const element = (id) => {
    const el = new FakeElement(id);
    elements.set(id, el);
    return el;
  };

  const editorWrap = element('editor-wrap');
  const blocksWrap = element('blocks-wrap');
  blocksWrap.hidden = true;
  blocksWrap.setAttribute('aria-hidden', 'true');
  const editorShell = element('markdownEditorShell');
  const editorToolbar = element('editorToolbar');
  const wrapToggle = element('wrapToggle');
  const wrapOn = new FakeElement('wrap-on');
  wrapOn.dataset.wrap = 'on';
  const wrapOff = new FakeElement('wrap-off');
  wrapOff.dataset.wrap = 'off';
  wrapToggle.children.push(wrapOn, wrapOff);
  const editorLayout = element('mode-editor');
  const editorMain = new FakeElement('editor-main-node');
  editorMain.classList.add('editor-main');
  editorMain.setAttribute('hidden', '');
  editorLayout.children.push(editorMain);
  const editorEmptyState = element('editorEmptyState');
  const editorMarkdownPanel = element('editorMarkdownPanel');
  const previewButton = element('btnOpenPreview');
  const viewToggle = new FakeElement('view-toggle');
  viewToggle.dataset.view = 'blocks';
  const blocksButton = new FakeElement('view-blocks');
  blocksButton.dataset.view = 'blocks';
  blocksButton.classList.add('active');
  const editButton = new FakeElement('view-edit');
  editButton.dataset.view = 'edit';
  const viewButtons = [blocksButton, editButton];

  let persistedView = null;
  let persistedWrap = null;
  let syncCount = 0;
  let editorLayoutCount = 0;
  let previewOpenCount = 0;
  const editorWrapCalls = [];
  const blocksEditor = {
    focusCount: 0,
    layoutCount: 0,
    focus() {
      this.focusCount += 1;
    },
    requestLayout() {
      this.layoutCount += 1;
    }
  };
  const runtime = {
    getElementById: (id) => elements.get(id) || null,
    querySelector: (selector) => {
      if (selector === '.view-toggle') return viewToggle;
      return null;
    },
    querySelectorAll: (selector) => {
      if (selector === '.vt-btn[data-view]') return viewButtons;
      return [];
    },
    readWrapEnabled: ({ force = false } = {}) => (force ? true : false),
    persistWrapEnabled: (on) => {
      persistedWrap = !!on;
      return true;
    },
    readMarkdownEditorView: () => persistedView || 'blocks',
    persistMarkdownEditorView: (mode) => {
      persistedView = mode;
      return true;
    }
  };
  const editor = {
    setWrap(on) {
      editorWrapCalls.push(!!on);
    }
  };
  const session = createEditorMainWorkspaceSession({
    runtime,
    forceMarkdownWrap,
    editor,
    getBlocksEditor: () => blocksEditor,
    syncBlocksFromSource: () => {
      syncCount += 1;
    },
    getPreviewSession: () => ({
      open() {
        previewOpenCount += 1;
      }
    }),
    requestLayout: () => {
      editorLayoutCount += 1;
    }
  });

  return {
    session,
    elements,
    editorWrap,
    blocksWrap,
    editorShell,
    editorToolbar,
    wrapToggle,
    wrapOn,
    wrapOff,
    editorLayout,
    editorMain,
    editorEmptyState,
    editorMarkdownPanel,
    previewButton,
    viewToggle,
    blocksButton,
    editButton,
    blocksEditor,
    editorWrapCalls,
    get persistedView() { return persistedView; },
    get persistedWrap() { return persistedWrap; },
    get syncCount() { return syncCount; },
    get editorLayoutCount() { return editorLayoutCount; },
    get previewOpenCount() { return previewOpenCount; }
  };
}

{
  const fixture = createFixture();
  fixture.session.initialize();
  assert.deepEqual(fixture.editorWrapCalls, [true]);
  assert.equal(fixture.persistedWrap, null, 'initial wrap sync should not write storage');
  assert.equal(fixture.wrapToggle.getAttribute('data-state'), 'on');
  assert.equal(fixture.wrapOn.classList.contains('active'), true);
  assert.equal(fixture.wrapOn.getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.wrapOff.classList.contains('active'), false);
  assert.equal(fixture.editorLayout.hasAttribute('data-current-file'), false);
  assert.equal(fixture.editorMain.hasAttribute('hidden'), false);
  assert.equal(fixture.editorMarkdownPanel.hasAttribute('hidden'), true);
  assert.equal(fixture.editorEmptyState.hasAttribute('hidden'), true);

  fixture.session.applyEditorEmptyState(false);
  assert.equal(fixture.editorLayout.hasAttribute('data-current-file'), true);
  assert.equal(fixture.editorMarkdownPanel.hasAttribute('hidden'), false);

  fixture.session.setWrap(false);
  assert.deepEqual(fixture.editorWrapCalls, [true, true]);
  assert.equal(fixture.persistedWrap, true, 'forced wrap should persist the effective on state');
  assert.equal(fixture.session.isWrapEnabled(), true);
}

{
  const fixture = createFixture();
  fixture.session.initialize();
  assert.equal(fixture.session.setView('blocks'), 'blocks');
  assert.equal(fixture.syncCount, 1);
  assert.equal(fixture.editorWrap.style.display, 'none');
  assert.equal(fixture.blocksWrap.hidden, false);
  assert.equal(fixture.blocksWrap.hasAttribute('aria-hidden'), false);
  assert.equal(fixture.editorToolbar.hidden, true);
  assert.equal(fixture.editorToolbar.getAttribute('aria-hidden'), 'true');
  assert.equal(fixture.viewToggle.dataset.view, 'blocks');
  assert.equal(fixture.blocksButton.classList.contains('active'), true);
  assert.equal(fixture.editButton.classList.contains('active'), false);
  assert.equal(fixture.blocksEditor.focusCount, 1);
  assert.equal(fixture.blocksEditor.layoutCount, 1);

  assert.equal(fixture.session.setView('edit', { persist: true }), 'edit');
  assert.equal(fixture.editorWrap.style.display, '');
  assert.equal(fixture.blocksWrap.hidden, true);
  assert.equal(fixture.blocksWrap.getAttribute('aria-hidden'), 'true');
  assert.equal(fixture.editorToolbar.hidden, false);
  assert.equal(fixture.editorToolbar.hasAttribute('aria-hidden'), false);
  assert.equal(fixture.viewToggle.dataset.view, 'edit');
  assert.equal(fixture.blocksButton.classList.contains('active'), false);
  assert.equal(fixture.editButton.classList.contains('active'), true);
  assert.equal(fixture.editorLayoutCount, 1);
  assert.equal(fixture.persistedView, 'edit');
  assert.equal(fixture.session.getView(), 'edit');

  assert.equal(fixture.session.setView('preview', { persist: true }), 'preview');
  assert.equal(fixture.previewOpenCount, 1);
  assert.equal(fixture.persistedView, 'edit', 'preview overlay should not persist as an editor view');
}

{
  const fixture = createFixture();
  fixture.session.initialize();
  const event = fixture.editButton.dispatch('click');
  assert.equal(event.defaultPrevented, true);
  assert.equal(fixture.viewToggle.dataset.view, 'edit');
  assert.equal(fixture.persistedView, 'edit');

  const previewEvent = fixture.previewButton.dispatch('click');
  assert.equal(previewEvent.defaultPrevented, true);
  assert.equal(fixture.previewOpenCount, 1);

  fixture.wrapOff.dispatch('keydown', { key: ' ' });
  assert.equal(fixture.persistedWrap, true);
}

{
  const fixture = createFixture({ forceMarkdownWrap: false });
  fixture.session.initialize();
  fixture.wrapOff.dispatch('click');
  assert.equal(fixture.persistedWrap, false);
  assert.equal(fixture.wrapToggle.getAttribute('data-state'), 'off');
  assert.equal(fixture.wrapOff.classList.contains('active'), true);
  assert.equal(fixture.session.isWrapEnabled(), false);
  fixture.session.setView('edit', { persist: true });
  fixture.session.restorePersistedView();
  assert.equal(fixture.viewToggle.dataset.view, 'edit');
}
