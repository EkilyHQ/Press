import assert from 'node:assert/strict';

import { createEditorMainFileContextService } from '../assets/js/editor-main-file-context-service.js';

function createFixture({ missingCurrentFile = false, throwGetter = false } = {}) {
  const calls = [];
  const currentFileSession = {
    bindElement(el) {
      calls.push(['current.bindElement', el]);
    },
    getInfo() {
      calls.push(['current.getInfo']);
      return { path: 'post/main/v1.0.0/main_en.md', source: 'article' };
    },
    getPath() {
      calls.push(['current.getPath']);
      return 'post/main/v1.0.0/main_en.md';
    },
    render() {
      calls.push(['current.render']);
    },
    set(input) {
      calls.push(['current.set', input]);
      const path = typeof input === 'string' ? input : input.path;
      return { path, source: path.startsWith('tab/') ? 'tabs' : 'article' };
    }
  };
  const metadataPanel = {
    inferCurrentFileSource(path) {
      calls.push(['metadata.infer', path]);
      return String(path || '').startsWith('tab/') ? 'tabs' : 'article';
    },
    applyCurrentFileSource(source) {
      calls.push(['metadata.applySource', source]);
    }
  };
  const previewSession = {
    setCurrentFileInfo(info) {
      calls.push(['preview.setCurrentFileInfo', info]);
    },
    refreshAssetOverrides() {
      calls.push(['preview.refreshAssetOverrides']);
    },
    updatePathLabel() {
      calls.push(['preview.updatePathLabel']);
    }
  };
  const documentSession = {
    refreshPreview() {
      calls.push(['document.refreshPreview']);
    }
  };
  const service = createEditorMainFileContextService({
    getCurrentFileSession: () => {
      if (throwGetter) throw new Error('boom');
      return missingCurrentFile ? null : currentFileSession;
    },
    getMetadataPanel: () => metadataPanel,
    getPreviewSession: () => previewSession,
    getDocumentSession: () => documentSession
  });
  return { service, calls };
}

{
  const fixture = createFixture();
  assert.equal(fixture.service.inferCurrentFileSource('tab/about/en.md'), 'tabs');
  assert.deepEqual(fixture.calls, [['metadata.infer', 'tab/about/en.md']]);
}

{
  const fixture = createFixture();
  const element = { id: 'currentFile' };
  assert.equal(fixture.service.bindCurrentFileElement(element), true);
  assert.equal(fixture.service.getCurrentMarkdownPath(), 'post/main/v1.0.0/main_en.md');
  assert.deepEqual(fixture.service.getCurrentFileInfo(), {
    path: 'post/main/v1.0.0/main_en.md',
    source: 'article'
  });
  assert.equal(fixture.service.renderCurrentFile(), true);
  assert.deepEqual(fixture.calls, [
    ['current.bindElement', element],
    ['current.getPath'],
    ['current.getInfo'],
    ['current.render']
  ]);
}

{
  const fixture = createFixture();
  const info = fixture.service.setCurrentFileLabel('tab/about/en.md');
  assert.deepEqual(info, { path: 'tab/about/en.md', source: 'tabs' });
  assert.deepEqual(fixture.calls, [
    ['current.set', 'tab/about/en.md'],
    ['metadata.applySource', 'tabs'],
    ['preview.setCurrentFileInfo', { path: 'tab/about/en.md', source: 'tabs' }],
    ['preview.refreshAssetOverrides'],
    ['document.refreshPreview']
  ]);
}

{
  const fixture = createFixture();
  assert.equal(fixture.service.handleCurrentFileRendered(), true);
  assert.deepEqual(fixture.calls, [['preview.updatePathLabel']]);
}

{
  const fixture = createFixture({ missingCurrentFile: true });
  const info = fixture.service.setCurrentFileLabel({ path: 'post/demo.md' });
  assert.deepEqual(info, { path: 'post/demo.md', source: 'article' });
  assert.equal(fixture.service.bindCurrentFileElement({}), false);
  assert.equal(fixture.service.getCurrentMarkdownPath(), '');
  assert.deepEqual(fixture.service.getCurrentFileInfo(), {});
  assert.equal(fixture.service.renderCurrentFile(), false);
  assert.deepEqual(fixture.calls, [
    ['metadata.infer', 'post/demo.md'],
    ['metadata.applySource', 'article'],
    ['preview.setCurrentFileInfo', { path: 'post/demo.md', source: 'article' }],
    ['preview.refreshAssetOverrides'],
    ['document.refreshPreview']
  ]);
}

{
  const fixture = createFixture({ throwGetter: true });
  assert.equal(fixture.service.getCurrentMarkdownPath(), '');
  assert.deepEqual(fixture.service.getCurrentFileInfo(), {});
  assert.equal(fixture.service.bindCurrentFileElement({}), false);
  assert.equal(fixture.service.renderCurrentFile(), false);
}
