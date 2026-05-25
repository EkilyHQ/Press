import assert from 'node:assert/strict';

import { createEditorMainDocumentSession } from '../assets/js/editor-main-document-session.js';

class FakeInput {
  constructor() {
    this.value = '';
    this.listeners = new Map();
    this.focusCount = 0;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatch(type) {
    (this.listeners.get(type) || []).forEach((handler) => handler({ type }));
  }

  focus() {
    this.focusCount += 1;
  }
}

function createFixture(options = {}) {
  const input = new FakeInput();
  const calls = [];
  const previewCalls = [];
  const blocksCalls = [];
  const registeredApis = [];
  let body = options.body || '';
  const editor = options.editor === null ? null : {
    textarea: input,
    getValue() {
      return body;
    },
    setValue(value) {
      body = value;
      calls.push(['editor.setValue', value]);
    },
    focus() {
      calls.push(['editor.focus']);
    }
  };
  const metadataPanel = {
    buildEditorValue(value) {
      return options.buildEditorValue ? options.buildEditorValue(value) : `full:${value}`;
    },
    buildMarkdown(value) {
      return `markdown:${value}`;
    },
    setEditorValue(value, opts) {
      calls.push(['metadata.setEditorValue', value, opts]);
      return options.setEditorValue ? options.setEditorValue(value, opts) : `body:${value}`;
    },
    setFrontMatterVisible(value) {
      calls.push(['metadata.setFrontMatterVisible', value]);
      return 'frontmatter-result';
    },
    setTabsMetadata(value, opts) {
      calls.push(['metadata.setTabsMetadata', value, opts]);
      return 'tabs-result';
    },
    onTabsMetadataChange(fn) {
      calls.push(['metadata.onTabsMetadataChange', typeof fn]);
      return () => calls.push(['metadata.unsubscribeTabs']);
    }
  };
  const previewSession = {
    render(value) {
      previewCalls.push(value);
    }
  };
  const blocksSession = {
    syncIfVisible(value) {
      blocksCalls.push(value);
      return true;
    }
  };
  const workspaceSession = {
    setView(mode, opts) {
      calls.push(['workspace.setView', mode, opts]);
      return mode;
    },
    restorePersistedView(opts) {
      calls.push(['workspace.restorePersistedView', opts]);
      return 'blocks';
    },
    getView() {
      calls.push(['workspace.getView']);
      return 'edit';
    },
    setWrap(value, opts) {
      calls.push(['workspace.setWrap', value, opts]);
    },
    isWrapEnabled() {
      calls.push(['workspace.isWrapEnabled']);
      return true;
    }
  };
  const session = createEditorMainDocumentSession({
    runtime: {
      registerPrimaryEditorApi(api) {
        registeredApis.push(api);
      }
    },
    editor,
    textarea: input,
    metadataPanel,
    workspaceSession,
    getPreviewSession: () => previewSession,
    getBlocksSession: () => blocksSession,
    requestLayout: () => calls.push(['requestLayout']),
    setBaseDir: (dir) => calls.push(['setBaseDir', dir]),
    setCurrentFileLabel: (label) => calls.push(['setCurrentFileLabel', label])
  });
  return {
    input,
    calls,
    previewCalls,
    blocksCalls,
    registeredApis,
    session,
    get body() {
      return body;
    },
    set body(value) {
      body = value;
    }
  };
}

{
  const fixture = createFixture();
  const changes = [];
  fixture.session.onChange((value) => changes.push(value));

  assert.equal(fixture.session.setValue('doc'), 'body:doc');
  assert.equal(fixture.body, 'body:doc');
  assert.deepEqual(fixture.blocksCalls, ['body:doc']);
  assert.equal(fixture.previewCalls.at(-1), 'full:body:doc');
  assert.equal(changes.at(-1), 'full:body:doc');
  assert.deepEqual(fixture.calls.slice(0, 3), [
    ['metadata.setEditorValue', 'doc', { silent: true }],
    ['editor.setValue', 'body:doc'],
    ['requestLayout']
  ]);

  const previewCount = fixture.previewCalls.length;
  const changeCount = changes.length;
  fixture.session.setValue('quiet', { preview: false, notify: false });
  assert.equal(fixture.body, 'body:quiet');
  assert.equal(fixture.previewCalls.length, previewCount);
  assert.equal(changes.length, changeCount);
}

{
  const fixture = createFixture();
  const changes = [];
  fixture.session.onChange((value) => changes.push(value));

  assert.equal(fixture.session.setBodyFromBlocks('block body'), 'block body');
  assert.equal(fixture.body, 'block body');
  assert.equal(fixture.previewCalls.at(-1), 'full:block body');
  assert.equal(changes.at(-1), 'full:block body');
}

{
  const fixture = createFixture();
  const changes = [];
  fixture.session.onChange((value) => changes.push(value));
  assert.equal(fixture.session.bindInput(), true);
  assert.equal(fixture.session.bindInput(), false);
  fixture.body = 'typed body';
  fixture.input.dispatch('input');
  assert.equal(fixture.previewCalls.at(-1), 'full:typed body');
  assert.equal(changes.at(-1), 'full:typed body');
}

{
  const fixture = createFixture({
    buildEditorValue: (value) => value,
    setEditorValue: (value) => value
  });
  assert.equal(fixture.session.renderInitial('seed body'), 'seeded');
  assert.equal(fixture.body, 'seed body');
  assert.equal(fixture.previewCalls.at(-1), 'seed body');

  fixture.body = ' existing body ';
  fixture.previewCalls.length = 0;
  assert.equal(fixture.session.renderInitial('seed body'), 'rendered');
  assert.deepEqual(fixture.previewCalls, ['existing body']);
}

{
  const fixture = createFixture();
  const api = fixture.session.registerPrimaryEditorApi();
  assert.equal(fixture.registeredApis[0], api);
  assert.equal(api.getValue(), 'full:');
  api.setValue('api doc');
  assert.equal(fixture.body, 'body:api doc');
  assert.equal(api.focus(), true);
  assert.equal(api.setView('edit', { persist: false }), 'edit');
  assert.equal(api.restorePersistedView({ focus: true }), 'blocks');
  assert.equal(api.getView(), 'edit');
  api.setBaseDir('wwwroot/post/');
  api.setCurrentFileLabel('post/main.md');
  assert.equal(api.setFrontMatterVisible(true), 'frontmatter-result');
  assert.equal(api.setTabsMetadata({ title: 'About' }, { silent: true }), 'tabs-result');
  const unsubscribeTabs = api.onTabsMetadataChange(() => {});
  unsubscribeTabs();
  api.refreshPreview();
  api.requestLayout();
  api.setWrap(true, { persist: false });
  assert.equal(api.isWrapEnabled(), true);
  assert.deepEqual(fixture.calls.filter((call) => call[0] === 'setBaseDir' || call[0] === 'setCurrentFileLabel'), [
    ['setBaseDir', 'wwwroot/post/'],
    ['setCurrentFileLabel', 'post/main.md']
  ]);
}

{
  const fixture = createFixture({ editor: null });
  fixture.input.value = 'textarea body';
  assert.equal(fixture.session.getEditorTextarea(), fixture.input);
  assert.equal(fixture.session.getEditorBody(), 'textarea body');
}
