import assert from 'node:assert/strict';

import { createComposerSyncCommitController } from '../assets/js/composer-sync-commit-controller.js';

class FakeElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.attrs = {};
    this.className = '';
    this.textContent = '';
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this.offsetParent = {};
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach(child => this.appendChild(child));
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  async dispatch(type, event = {}) {
    const handlers = this.listeners.get(type) || [];
    for (const handler of handlers) {
      await handler({
        preventDefault() {},
        ...event
      });
    }
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  focus() {
    this.focused = true;
  }

  set innerHTML(_value) {
    this.children = [];
    this.textContent = '';
  }

  get innerHTML() {
    return this.children.map(child => child.textContent || '').join('');
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  addElement(element) {
    if (element.id) this.elements.set(element.id, element);
    return element;
  }

  createElement(tagName) {
    return new FakeElement('', tagName);
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }
}

{
  const documentRef = new FakeDocument();
  const syncHost = documentRef.addElement(new FakeElement('mode-sync', 'section'));
  const headerSubmit = documentRef.addElement(new FakeElement('btnSyncSubmit', 'button'));
  const calls = [];
  const controller = createComposerSyncCommitController({
    documentRef,
    setTimeoutRef(handler) {
      calls.push(['setTimeout']);
      return 9;
    },
    clearTimeoutRef() {
      calls.push(['clearTimeout']);
    },
    t: key => key,
    getCurrentMode: () => 'sync',
    computeUnsyncedSummary: () => [{ kind: 'site', label: 'site.yaml' }],
    gatherCommitPayload: async () => ({ files: [{ path: 'site.yaml' }], seoFiles: [] }),
    resolvePublishTransport: () => ({ type: 'connect', connect: { baseUrl: 'https://connect.example' } }),
    getMatchingConnectPublishGrant: () => ({ token: 'cached' }),
    appendGithubCommitSummary: (host, files, seoFiles, entries) => {
      calls.push(['summary', files.length, seoFiles.length, entries.length]);
      const item = documentRef.createElement('p');
      item.textContent = 'summary';
      host.appendChild(item);
    },
    ensureConnectPublishGrant: async () => calls.push(['grant']),
    performConnectGithubCommit: async (_connect, entries) => calls.push(['connectCommit', entries.length]),
    showToast: (kind, message) => calls.push(['toast', kind, message])
  });

  const result = await controller.refresh();
  assert.equal(result.panel.id, 'syncCommitPanel');
  assert.equal(syncHost.children[0].id, 'syncCommitPanel', 'controller should create the inline Sync commit host');
  assert.equal(headerSubmit.disabled, false, 'header submit should be enabled when pending changes exist');
  assert.equal(
    result.form.children.some(child => child.className === 'muted sync-publish-transport' && child.textContent === 'editor.composer.github.modal.connectConnected'),
    true,
    'controller should render the selected publish transport status'
  );
  assert.deepEqual(calls.find(call => call[0] === 'summary'), ['summary', 1, 0, 1]);

  await result.form.dispatch('submit');
  assert.deepEqual(calls.find(call => call[0] === 'grant'), ['grant']);
  assert.deepEqual(calls.find(call => call[0] === 'connectCommit'), ['connectCommit', 1]);
}

{
  const documentRef = new FakeDocument();
  const calls = [];
  const controller = createComposerSyncCommitController({
    documentRef,
    setTimeoutRef(handler) {
      calls.push(['setTimeout']);
      handler();
      return 11;
    },
    clearTimeoutRef() {
      calls.push(['clearTimeout']);
    },
    getCurrentMode: () => 'composer',
    gatherCommitPayload: async () => calls.push(['refresh'])
  });

  assert.equal(controller.scheduleRefresh(), 0, 'non-Sync modes should not schedule commit panel refreshes');
  assert.deepEqual(calls, []);
}
