import assert from 'node:assert/strict';
import { createComposerYamlPanelsController } from '../assets/js/composer-yaml-panels-controller.js';

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
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
}

class FakeElement {
  constructor(id, options = {}) {
    this.id = id;
    this.attrs = {};
    this.children = [];
    this.classList = new FakeClassList(options.classes || []);
    this.dataset = { ...(options.dataset || {}) };
    this.hidden = false;
    this.style = {};
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
    if (name === 'data-key') this.dataset.key = String(value);
  }

  getAttribute(name) {
    if (name === 'data-key') return this.dataset.key || '';
    return this.attrs[name] || null;
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  matches(selector) {
    if (selector === '.mode-tab.dynamic-mode') {
      return this.classList.contains('mode-tab') && this.classList.contains('dynamic-mode');
    }
    const dataKeyMatch = selector.match(/^(\.[a-z0-9_-]+)\[data-key="([^"]+)"\]$/i);
    if (dataKeyMatch) {
      return this.classList.contains(dataKeyMatch[1].slice(1)) && this.dataset.key === dataKeyMatch[2];
    }
    const classParts = selector.match(/^\.[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/i);
    if (classParts) {
      return selector.split('.').filter(Boolean).every(name => this.classList.contains(name));
    }
    return false;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      if (node.matches && node.matches(selector)) matches.push(node);
      (node.children || []).forEach(visit);
    };
    this.children.forEach(visit);
    return matches;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  addElement(element) {
    this.elements.set(element.id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }
}

function createEntry(className, key, bodyClass, buttonClass, isOpen = false) {
  const row = new FakeElement(`row-${key}`, {
    classes: isOpen ? [className, 'is-open'] : [className],
    dataset: { key }
  });
  row.appendChild(new FakeElement(`body-${key}`, { classes: [bodyClass] }));
  row.appendChild(new FakeElement(`button-${key}`, { classes: [buttonClass] }));
  return row;
}

{
  const documentRef = new FakeDocument();
  const container = documentRef.addElement(new FakeElement('modeDynamicTabs'));
  const controller = createComposerYamlPanelsController({ documentRef });

  assert.equal(controller.updateDynamicTabsGroupState(), false);
  assert.equal(container.hidden, true);
  assert.equal(container.attrs['aria-hidden'], 'true');

  container.appendChild(new FakeElement('dynamic-tab', { classes: ['mode-tab', 'dynamic-mode'] }));
  assert.equal(controller.updateDynamicTabsGroupState(), true);
  assert.equal(container.hidden, false);
  assert.equal(container.attrs['aria-hidden'], undefined);
}

{
  const documentRef = new FakeDocument();
  const indexRoot = documentRef.addElement(new FakeElement('composerIndex'));
  indexRoot.appendChild(createEntry('ci-item', 'post-one', 'ci-body', 'ci-expand', true));
  indexRoot.appendChild(createEntry('ci-item', 'post-two', 'ci-body', 'ci-expand', false));

  const calls = [];
  const controller = createComposerYamlPanelsController({
    documentRef,
    getActiveState: () => ({ index: true }),
    buildIndexUI(root, state) {
      calls.push(['buildIndex', state.index]);
      root.children = [
        createEntry('ci-item', 'post-one', 'ci-body', 'ci-expand', false),
        createEntry('ci-item', 'post-three', 'ci-body', 'ci-expand', false)
      ];
    },
    notifyComposerChange: (kind, options) => calls.push(['notify', kind, options && options.skipAutoSave]),
    updateMarkdownDraftIndicators: () => calls.push(['drafts']),
    clearInlineSlideStyles: (body) => calls.push(['clear', body.id])
  });

  assert.equal(controller.rebuildIndexUI(), true);
  const reopened = indexRoot.querySelector('.ci-item[data-key="post-one"]');
  assert.equal(reopened.classList.contains('is-open'), true);
  assert.equal(reopened.querySelector('.ci-body').style.display, 'block');
  assert.equal(reopened.querySelector('.ci-body').dataset.open, '1');
  assert.equal(reopened.querySelector('.ci-expand').attrs['aria-expanded'], 'true');
  assert.deepEqual(calls, [
    ['buildIndex', true],
    ['clear', 'body-post-one'],
    ['notify', 'index', true],
    ['drafts']
  ]);
}

{
  const documentRef = new FakeDocument();
  const tabsRoot = documentRef.addElement(new FakeElement('composerTabs'));
  tabsRoot.appendChild(createEntry('ct-item', 'about', 'ct-body', 'ct-expand', true));
  const siteRoot = documentRef.addElement(new FakeElement('composerSite'));
  const calls = [];
  const controller = createComposerYamlPanelsController({
    documentRef,
    getActiveState: () => ({ site: true }),
    buildTabsUI(root) {
      calls.push(['buildTabs']);
      root.children = [createEntry('ct-item', 'about', 'ct-body', 'ct-expand', false)];
    },
    buildSiteUI(root, state) {
      calls.push(['buildSite', root.id, state.site]);
    },
    notifyComposerChange: (kind, options) => calls.push(['notify', kind, options && options.skipAutoSave]),
    updateMarkdownDraftIndicators: () => calls.push(['drafts'])
  });

  assert.equal(controller.rebuildTabsUI(), true);
  assert.equal(tabsRoot.querySelector('.ct-item[data-key="about"]').classList.contains('is-open'), true);
  assert.equal(controller.rebuildSiteUI(), true);
  assert.deepEqual(calls, [
    ['buildTabs'],
    ['notify', 'tabs', true],
    ['drafts'],
    ['buildSite', 'composerSite', true],
    ['notify', 'site', true]
  ]);
}
