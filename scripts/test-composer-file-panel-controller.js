import assert from 'node:assert/strict';
import { createComposerFilePanelController } from '../assets/js/composer-file-panel-controller.js';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    if (force) this.add(value);
    else this.remove(value);
  }
}

class FakeElement {
  constructor(id, dataset = {}) {
    this.id = id;
    this.dataset = { ...dataset };
    this.classList = new FakeClassList();
    this.style = {};
    this.attrs = {};
    this.listeners = new Map();
    this.hidden = false;
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type);
    if (handlers) handlers.delete(handler);
  }

  dispatch(type, event = {}) {
    const handlers = Array.from(this.listeners.get(type) || []);
    handlers.forEach(handler => handler({
      target: this,
      propertyName: 'opacity',
      ...event
    }));
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.selectors = new Map();
    this.documentElement = new FakeElement('html');
  }

  addElement(element) {
    this.elements.set(element.id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  setSelector(selector, elements) {
    this.selectors.set(selector, elements);
  }

  querySelectorAll(selector) {
    return this.selectors.get(selector) || [];
  }
}

function createStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    read(key) {
      return map.get(key);
    }
  };
}

function createPanelDocument() {
  const documentRef = new FakeDocument();
  const indexLink = new FakeElement('fileIndex', { cfile: 'index' });
  const tabsLink = new FakeElement('fileTabs', { cfile: 'tabs' });
  const siteLink = new FakeElement('fileSite', { cfile: 'site' });
  documentRef.setSelector('a.vt-btn[data-cfile]', [indexLink, tabsLink, siteLink]);
  [
    'btnAddItem',
    'composerPanels',
    'composerIndexHost',
    'composerTabsHost',
    'composerSiteHost',
    'composerIndex',
    'composerTabs',
    'composerSite'
  ].forEach(id => documentRef.addElement(new FakeElement(id)));
  return {
    documentRef,
    indexLink,
    tabsLink,
    siteLink,
    addButton: documentRef.getElementById('btnAddItem'),
    panels: documentRef.getElementById('composerPanels'),
    indexHost: documentRef.getElementById('composerIndexHost'),
    tabsHost: documentRef.getElementById('composerTabsHost'),
    siteHost: documentRef.getElementById('composerSiteHost'),
    indexPanel: documentRef.getElementById('composerIndex'),
    tabsPanel: documentRef.getElementById('composerTabs'),
    sitePanel: documentRef.getElementById('composerSite')
  };
}

{
  const storage = createStorage({ 'scope:cfile': 'tabs' });
  const ui = createPanelDocument();
  const applied = [];
  const controller = createComposerFilePanelController({
    documentRef: ui.documentRef,
    storage,
    storageKey: 'scope:cfile',
    t: key => `label:${key}`,
    prefersReducedMotion: () => true,
    onPanelStateApplied: kind => applied.push(kind)
  });

  assert.equal(
    controller.getInitialComposerFile(),
    'site',
    'default startup should preserve the existing Site Settings initial panel behavior'
  );

  controller.applyComposerFile('tabs', { immediate: true, force: true });
  assert.equal(controller.getActiveComposerFile(), 'tabs');
  assert.equal(ui.tabsLink.classList.contains('active'), true);
  assert.equal(ui.indexLink.classList.contains('active'), false);
  assert.equal(ui.addButton.hidden, false);
  assert.equal(ui.addButton.attrs['data-i18n'], 'editor.composer.addTab');
  assert.equal(ui.addButton.textContent, 'label:editor.composer.addTab');
  assert.equal(ui.indexHost.style.display, 'none');
  assert.equal(ui.tabsHost.style.display, '');
  assert.equal(ui.siteHost.style.display, 'none');
  assert.equal(ui.tabsPanel.style.display, 'block');
  assert.equal(ui.documentRef.documentElement.attrs['data-init-cfile'], 'tabs');
  assert.deepEqual(applied, ['tabs']);

  controller.setComposerFile('site', { immediate: true });
  assert.equal(storage.read('scope:cfile'), 'site');
  assert.equal(ui.siteLink.classList.contains('active'), true);
  assert.equal(ui.addButton.hidden, true);
  assert.equal(ui.addButton.style.display, 'none');
  assert.equal(ui.documentRef.documentElement.attrs['data-init-cfile'], 'site');

  controller.setComposerFile('index', { immediate: true });
  assert.equal(storage.read('scope:cfile'), 'index');
  assert.equal(ui.indexLink.classList.contains('active'), true);
  assert.equal(ui.addButton.attrs['data-i18n'], 'editor.composer.addPost');
  assert.equal(ui.documentRef.documentElement.attrs['data-init-cfile'], undefined);
}

{
  const ui = createPanelDocument();
  const frames = [];
  const timers = [];
  const cleared = [];
  const applied = [];
  const controller = createComposerFilePanelController({
    documentRef: ui.documentRef,
    storage: createStorage(),
    storageKey: 'scope:cfile',
    requestAnimationFrameRef: callback => {
      frames.push(callback);
      return frames.length;
    },
    setTimeoutRef: (handler, delay) => {
      const id = timers.length + 1;
      timers.push({ id, handler, delay });
      return id;
    },
    clearTimeoutRef: id => cleared.push(id),
    prefersReducedMotion: () => false,
    onPanelStateApplied: kind => applied.push(kind)
  });

  controller.applyComposerFile('tabs', { force: true });
  assert.equal(controller.getComposerViewTransition().panels, ui.panels);
  assert.equal(ui.panels.classList.contains('is-transitioning'), true);
  assert.equal(ui.panels.classList.contains('is-hidden'), false);

  frames.shift()();
  assert.equal(ui.panels.classList.contains('is-hidden'), true);
  assert.equal(timers[0].delay, 280);

  ui.panels.dispatch('transitionend');
  assert.deepEqual(applied, ['tabs']);
  assert.equal(cleared.includes(timers[0].id), true);

  frames.shift()();
  assert.equal(ui.panels.classList.contains('is-hidden'), false);
  assert.equal(timers[1].delay, 280);

  ui.panels.dispatch('transitionend');
  assert.equal(controller.getComposerViewTransition(), null);
  assert.equal(ui.panels.classList.contains('is-transitioning'), false);
}
