import assert from 'node:assert/strict';

import { createEditorMainServiceRegistry } from '../assets/js/editor-main-service-registry.js';

{
  const registry = createEditorMainServiceRegistry();
  assert.equal(registry.getDocumentSession(), null);
  assert.equal(registry.getPreviewSession(), null);
  assert.equal(registry.getBlocksSession(), null);
  assert.equal(registry.getCurrentFileSession(), null);
  assert.equal(registry.getMetadataPanel(), null);
  assert.equal(registry.getEditorValue(), '');
  assert.deepEqual(registry.getSiteConfig(), {});
  assert.equal(registry.getBlocksEditor(), null);
  assert.equal(registry.notifyDocumentChange(), false);
  assert.equal(registry.syncBlocksFromSource(), false);
}

{
  const calls = [];
  const documentSession = {
    getValue() {
      calls.push('document.getValue');
      return 'markdown';
    },
    notifyChange() {
      calls.push('document.notifyChange');
      return true;
    }
  };
  const contentService = {
    getSiteConfig() {
      calls.push('content.getSiteConfig');
      return { siteTitle: 'Press' };
    }
  };
  const blocksEditor = { id: 'blocks-editor' };
  const blocksSession = {
    getEditor() {
      calls.push('blocks.getEditor');
      return blocksEditor;
    },
    syncFromSource() {
      calls.push('blocks.syncFromSource');
      return true;
    }
  };

  const registry = createEditorMainServiceRegistry();
  assert.equal(registry.setDocumentSession(documentSession), documentSession);
  assert.equal(registry.setContentService(contentService), contentService);
  assert.equal(registry.setBlocksSession(blocksSession), blocksSession);

  assert.equal(registry.getDocumentSession(), documentSession);
  assert.equal(registry.getEditorValue(), 'markdown');
  assert.deepEqual(registry.getSiteConfig(), { siteTitle: 'Press' });
  assert.equal(registry.getBlocksEditor(), blocksEditor);
  assert.equal(registry.notifyDocumentChange(), true);
  assert.equal(registry.syncBlocksFromSource(), true);
  assert.deepEqual(calls, [
    'document.getValue',
    'content.getSiteConfig',
    'blocks.getEditor',
    'document.notifyChange',
    'blocks.syncFromSource'
  ]);
}

{
  const registry = createEditorMainServiceRegistry();
  const currentFileSession = { id: 'current' };
  const imageSession = { id: 'image' };
  const metadataPanel = { id: 'metadata' };
  const previewSession = { id: 'preview' };
  const toolbarSession = { id: 'toolbar' };
  const workspaceSession = { id: 'workspace' };

  registry.setCurrentFileSession(currentFileSession);
  registry.setImageSession(imageSession);
  registry.setMetadataPanel(metadataPanel);
  registry.setPreviewSession(previewSession);
  registry.setToolbarSession(toolbarSession);
  registry.setWorkspaceSession(workspaceSession);

  assert.equal(registry.getCurrentFileSession(), currentFileSession);
  assert.equal(registry.getImageSession(), imageSession);
  assert.equal(registry.getMetadataPanel(), metadataPanel);
  assert.equal(registry.getPreviewSession(), previewSession);
  assert.equal(registry.getToolbarSession(), toolbarSession);
  assert.equal(registry.getWorkspaceSession(), workspaceSession);
}

{
  const registry = createEditorMainServiceRegistry();
  registry.setDocumentSession({
    getValue() {
      throw new Error('document failed');
    },
    notifyChange() {
      throw new Error('notify failed');
    }
  });
  registry.setContentService({
    getSiteConfig() {
      throw new Error('config failed');
    }
  });
  registry.setBlocksSession({
    getEditor() {
      throw new Error('editor failed');
    },
    syncFromSource() {
      throw new Error('sync failed');
    }
  });

  assert.equal(registry.getEditorValue(), '');
  assert.deepEqual(registry.getSiteConfig(), {});
  assert.equal(registry.getBlocksEditor(), null);
  assert.equal(registry.notifyDocumentChange(), false);
  assert.equal(registry.syncBlocksFromSource(), false);
}

{
  const registry = createEditorMainServiceRegistry();
  const session = { id: 'preview' };
  registry.setPreviewSession(session);
  assert.equal(registry.getPreviewSession(), session);
  registry.setPreviewSession(null);
  assert.equal(registry.getPreviewSession(), null);
}
