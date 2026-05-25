import assert from 'node:assert/strict';

import { createEditorMainLanguageSession } from '../assets/js/editor-main-language-session.js';

function createFixture({ throwGetter = false } = {}) {
  const calls = [];
  let languageHandler = null;
  const runtime = {
    onDocument(type, handler) {
      calls.push(['onDocument', type]);
      languageHandler = handler;
      return () => calls.push(['detach', type]);
    }
  };
  const toolbarSession = {
    syncLanguage() {
      calls.push(['toolbar.syncLanguage']);
    }
  };
  const currentFileSession = {
    render() {
      calls.push(['currentFile.render']);
    }
  };
  const blocksSession = {
    requestLayout() {
      calls.push(['blocks.requestLayout']);
    }
  };
  const metadataPanel = {
    syncLanguage() {
      calls.push(['metadata.syncLanguage']);
    }
  };
  const session = createEditorMainLanguageSession({
    runtime,
    getToolbarSession: () => {
      if (throwGetter) throw new Error('boom');
      return toolbarSession;
    },
    getCurrentFileSession: () => currentFileSession,
    getBlocksSession: () => blocksSession,
    getMetadataPanel: () => metadataPanel
  });
  return {
    session,
    calls,
    get languageHandler() {
      return languageHandler;
    }
  };
}

{
  const fixture = createFixture();
  const detach = fixture.session.bind();
  assert.equal(typeof detach, 'function');
  assert.deepEqual(fixture.calls, [['onDocument', 'press-editor-language-applied']]);
  assert.equal(typeof fixture.languageHandler, 'function');
  fixture.languageHandler();
  assert.deepEqual(fixture.calls.slice(1), [
    ['toolbar.syncLanguage'],
    ['currentFile.render'],
    ['blocks.requestLayout'],
    ['metadata.syncLanguage']
  ]);
  detach();
  assert.deepEqual(fixture.calls.at(-1), ['detach', 'press-editor-language-applied']);
}

{
  const fixture = createFixture({ throwGetter: true });
  fixture.session.syncLanguage();
  assert.deepEqual(fixture.calls, [
    ['currentFile.render'],
    ['blocks.requestLayout'],
    ['metadata.syncLanguage']
  ]);
}

{
  const session = createEditorMainLanguageSession({
    runtime: {},
    getToolbarSession: () => null,
    getCurrentFileSession: () => null,
    getBlocksSession: () => null,
    getMetadataPanel: () => null
  });
  assert.doesNotThrow(() => session.syncLanguage());
  assert.equal(typeof session.bind(), 'function');
}
