import assert from 'node:assert/strict';

globalThis.document = { title: 'Press' };
const { createEditorMainBlocksSession } = await import('../assets/js/editor-main-blocks-session.js');

class FakeRoot {
  constructor() {
    this.hidden = false;
  }
}

function createLinkCardContext() {
  const listeners = [];
  const hydrateCalls = [];
  let entries = [{ location: 'a.md', label: 'Alpha' }];
  return {
    listeners,
    hydrateCalls,
    getCardEntries: () => entries,
    setEntries(next) {
      entries = next;
      listeners.forEach((listener) => listener(entries));
    },
    onCardEntriesChange(listener) {
      listeners.push(listener);
    },
    createHydrateOptions(options) {
      hydrateCalls.push(options);
      return { ...options, fromContext: true };
    }
  };
}

function createFixture() {
  const root = new FakeRoot();
  const created = [];
  const editorCalls = [];
  const previewCalls = [];
  const imageCalls = [];
  const linkCardContext = createLinkCardContext();
  const documentRef = { id: 'document' };
  const windowRef = { id: 'window' };
  const runtime = {
    documentRef,
    windowRef,
    getEditorBaseDir(fallback) {
      return `base:${fallback}`;
    }
  };
  const fakeEditor = {
    setMarkdown(value) {
      editorCalls.push(['setMarkdown', value]);
    },
    setCardEntries(value) {
      editorCalls.push(['setCardEntries', value]);
    },
    requestLayout() {
      editorCalls.push(['requestLayout']);
    },
    focus() {
      editorCalls.push(['focus']);
    }
  };
  const previewSession = {
    applyAssetOverrides(node, path) {
      previewCalls.push({ node, path });
    }
  };
  const imageSession = {
    requestBlocksImageUpload(detail) {
      imageCalls.push(['upload', detail]);
      return 'upload-result';
    },
    canDeleteImageResource(src) {
      imageCalls.push(['can-delete', src]);
      return src === 'local.png';
    },
    requestBlocksImageDelete(detail) {
      imageCalls.push(['delete', detail]);
      return 'delete-result';
    }
  };
  const hydrateCalls = [];
  let editorBody = 'source body';
  const bodyChanges = [];
  const session = createEditorMainBlocksSession({
    runtime,
    root,
    translate: (key) => (key === 'editor.blocks.heading' ? 'Translated heading' : key),
    getContentRoot: () => 'wwwroot',
    getEditorBody: () => editorBody,
    onBodyChange: (body) => bodyChanges.push(body),
    getCurrentMarkdownPath: () => 'post/main.md',
    getSiteConfig: () => ({ title: 'Press' }),
    getPreviewSession: () => previewSession,
    getImageSession: () => imageSession,
    linkCardContext,
    resolveImageSrc: (src) => `resolved:${src}`,
    hydrateLinkCards: (node, options) => hydrateCalls.push({ node, options }),
    createBlocksEditor: (target, options) => {
      created.push({ target, options });
      return fakeEditor;
    }
  });
  return {
    root,
    session,
    created,
    editorCalls,
    previewCalls,
    imageCalls,
    linkCardContext,
    runtime,
    hydrateCalls,
    bodyChanges,
    setEditorBody(value) {
      editorBody = value;
    }
  };
}

{
  const fixture = createFixture();
  const editor = fixture.session.initialize();
  assert.equal(editor, fixture.session.getEditor());
  assert.equal(fixture.created.length, 1);
  const options = fixture.created[0].options;
  assert.equal(options.documentRef, fixture.runtime.documentRef);
  assert.equal(options.windowRef, fixture.runtime.windowRef);
  assert.equal(options.labels.heading, 'Translated heading');
  assert.equal(options.labels.linkTitle, 'Link title');
  assert.equal(options.labels.replaceImage, 'Replace image');
  assert.equal(options.getBaseDir(), 'base:wwwroot/');
  assert.equal(options.resolveImageSrc('image.png'), 'resolved:image.png');
  assert.deepEqual(fixture.editorCalls.shift(), ['setCardEntries', [{ location: 'a.md', label: 'Alpha' }]]);

  options.onChange('updated body');
  assert.deepEqual(fixture.bodyChanges, ['updated body']);

  fixture.session.initialize();
  assert.equal(fixture.created.length, 1, 'initialize should be idempotent');
}

{
  const fixture = createFixture();
  fixture.session.initialize();
  fixture.setEditorBody('latest source');
  assert.equal(fixture.session.syncFromSource(), true);
  assert.deepEqual(fixture.editorCalls.at(-1), ['setMarkdown', 'latest source']);

  assert.equal(fixture.session.syncIfVisible('visible body'), true);
  assert.deepEqual(fixture.editorCalls.at(-1), ['setMarkdown', 'visible body']);
  fixture.root.hidden = true;
  assert.equal(fixture.session.syncIfVisible('hidden body'), false);
  assert.notDeepEqual(fixture.editorCalls.at(-1), ['setMarkdown', 'hidden body']);

  assert.equal(fixture.session.requestLayout(), true);
  assert.deepEqual(fixture.editorCalls.at(-1), ['requestLayout']);
  assert.equal(fixture.session.focus(), true);
  assert.deepEqual(fixture.editorCalls.at(-1), ['focus']);
}

{
  const fixture = createFixture();
  fixture.session.initialize();
  const options = fixture.created[0].options;
  const imageNode = { id: 'image' };
  options.hydrateImages(imageNode);
  assert.deepEqual(fixture.previewCalls.at(-1), { node: imageNode, path: 'post/main.md' });

  const cardNode = { id: 'card' };
  options.hydrateCard(cardNode);
  const hydrateCall = fixture.hydrateCalls.at(-1);
  assert.equal(hydrateCall.node, cardNode);
  assert.equal(hydrateCall.options.fromContext, true);
  assert.deepEqual(hydrateCall.options.siteConfig, { title: 'Press' });
  assert.equal(hydrateCall.options.translate('editor.blocks.heading'), 'Translated heading');
  assert.deepEqual(fixture.previewCalls.at(-1), { node: cardNode, path: 'post/main.md' });
}

{
  const fixture = createFixture();
  fixture.session.initialize();
  const options = fixture.created[0].options;
  assert.equal(options.requestImageUpload({ index: 1 }), 'upload-result');
  assert.equal(options.canDeleteImageResource('local.png'), true);
  assert.equal(options.canDeleteImageResource('remote.png'), false);
  assert.equal(options.requestImageDelete({ src: 'local.png' }), 'delete-result');
  assert.deepEqual(fixture.imageCalls, [
    ['upload', { index: 1 }],
    ['can-delete', 'local.png'],
    ['can-delete', 'remote.png'],
    ['delete', { src: 'local.png' }]
  ]);
}

{
  const fixture = createFixture();
  fixture.session.initialize();
  fixture.linkCardContext.setEntries([{ location: 'b.md', label: 'Beta' }]);
  assert.deepEqual(fixture.editorCalls.at(-1), ['setCardEntries', [{ location: 'b.md', label: 'Beta' }]]);
  fixture.session.setCardEntries(null);
  assert.deepEqual(fixture.editorCalls.at(-1), ['setCardEntries', [{ location: 'b.md', label: 'Beta' }]]);
}
