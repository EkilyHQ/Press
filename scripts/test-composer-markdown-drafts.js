import assert from 'node:assert/strict';

import { createComposerMarkdownDraftController } from '../assets/js/composer-markdown-drafts.js';
import {
  createMarkdownProtectionState,
  getMarkdownProtectionState,
  setMarkdownProtectionState
} from '../assets/js/composer-markdown-state.js';

function createHarness(overrides = {}) {
  let nowValue = 1700000000000;
  const storeState = {};
  const assetBuckets = new Map();
  const deletedAssetBuckets = new Map();
  const calls = [];
  const tabs = new Map();
  const timers = [];

  const normalizeRelPath = (value) => String(value || '').replace(/[\\]/g, '/').replace(/^\/+/, '');
  const normalizeAssetDescriptor = (asset, markdownPath) => asset && asset.path && asset.base64
    ? {
        path: normalizeRelPath(asset.path),
        relativePath: asset.relativePath || asset.path,
        base64: asset.base64,
        markdownPath: normalizeRelPath(markdownPath)
      }
    : null;
  const normalizeAssetDeletionDescriptor = (asset, markdownPath) => asset && (asset.assetPath || asset.path)
    ? {
        path: normalizeRelPath(asset.assetPath || asset.path),
        assetPath: normalizeRelPath(asset.assetPath || asset.path),
        markdownPath: normalizeRelPath(markdownPath)
      }
    : null;

  const controller = createComposerMarkdownDraftController({
	    markdownDraftStore: {
	      read: () => JSON.parse(JSON.stringify(storeState)),
	      write: (next) => {
	        Object.keys(storeState).forEach((key) => { delete storeState[key]; });
	        Object.assign(storeState, JSON.parse(JSON.stringify(next || {})));
	      },
      removeEntry: (key) => {
        delete storeState[key];
      }
    },
    normalizeRelPath,
    normalizeAssetDescriptor,
    normalizeAssetDeletionDescriptor,
    importMarkdownAssetsForPath: (path, assets) => {
      calls.push(['import-assets', path, assets.length]);
      assetBuckets.set(normalizeRelPath(path), assets.slice());
      return assets.slice();
    },
    importMarkdownAssetDeletionsForPath: (path, assets) => {
      calls.push(['import-deleted-assets', path, assets.length]);
      deletedAssetBuckets.set(normalizeRelPath(path), assets.slice());
    },
    exportMarkdownAssetBucket: (path) => assetBuckets.get(normalizeRelPath(path)) || [],
    exportMarkdownAssetDeletionBucket: (path) => deletedAssetBuckets.get(normalizeRelPath(path)) || [],
    clearMarkdownAssetsForPath: (path) => {
      calls.push(['clear-assets', path]);
      assetBuckets.delete(normalizeRelPath(path));
      deletedAssetBuckets.delete(normalizeRelPath(path));
    },
    ensureMarkdownAssetBucket: (path) => {
      const norm = normalizeRelPath(path);
      if (!assetBuckets.has(norm)) assetBuckets.set(norm, []);
      return assetBuckets.get(norm);
    },
    countMarkdownAssetDeletions: (path) => (deletedAssetBuckets.get(normalizeRelPath(path)) || []).length,
    prepareMarkdownForProtectedStorage: overrides.prepareMarkdownForProtectedStorage || (async (_tab, text) => ({
      content: text,
      encrypted: false
    })),
    getMarkdownProtectionState,
    setMarkdownProtectionState,
    getDynamicEditorTabs: () => tabs,
    getCurrentMode: () => overrides.currentMode || '',
    pushEditorCurrentFileInfo: (tab) => calls.push(['push-current-file', tab && tab.path]),
    updateMarkdownPushButton: (tab) => calls.push(['update-push', tab && tab.path]),
    updateComposerMarkdownDraftIndicators: (options) => calls.push(['draft-indicators', options && options.path]),
    refreshEditorContentTree: (options) => calls.push(['refresh-tree', options && options.preserveStructure]),
    updateUnsyncedSummary: () => calls.push(['update-summary']),
    showToast: (kind, message) => calls.push(['toast', kind, message]),
    t: (key) => key,
    consoleRef: { error: (...args) => calls.push(['console-error', ...args]) },
    setTimeoutRef: (handler, delay) => {
      const timer = { handler, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutRef: (timer) => {
      if (timer) timer.cleared = true;
    },
    now: () => {
      nowValue += 1;
      return nowValue;
    }
  });

  return {
    controller,
    storeState,
    assetBuckets,
    deletedAssetBuckets,
    calls,
    tabs,
    timers,
    normalizeRelPath
  };
}

{
  const { controller, storeState, deletedAssetBuckets } = createHarness();
  deletedAssetBuckets.set('post/a.md', [{ assetPath: 'post/assets/old.png', path: 'post/assets/old.png' }]);
  const saved = controller.saveDraftEntry('post/a.md', 'hello\r\n', '5:abc', [
    { path: 'post/assets/new.png', relativePath: 'assets/new.png', base64: 'abc' }
  ], { encrypted: true });

  assert.equal(saved.content, 'hello\n');
  assert.equal(saved.encrypted, true);
  assert.equal(storeState['post/a.md'].format, 'press-encrypted-markdown-v1');
  assert.equal(storeState['post/a.md'].assets.length, 1);
  assert.equal(storeState['post/a.md'].deletedAssets.length, 1);

  const entry = controller.getDraftEntry('/post/a.md');
  assert.equal(entry.content, 'hello\n');
  assert.equal(entry.encrypted, true);
  assert.equal(entry.assets.length, 1);
  assert.equal(entry.deletedAssets.length, 1);
}

{
  const { controller, storeState, assetBuckets, deletedAssetBuckets, calls } = createHarness();
  storeState['post/draft.md'] = {
    content: 'draft text',
    savedAt: 42,
    remoteSignature: 'remote',
    assets: [{ path: 'post/assets/a.png', base64: 'a' }],
    deletedAssets: [{ assetPath: 'post/assets/old.png' }]
  };
  const tab = {
    path: 'post/draft.md',
    remoteContent: 'remote text',
    remoteSignature: 'remote',
    protection: createMarkdownProtectionState()
  };
  const restored = controller.restoreDraftForTab(tab);

  assert.equal(restored, true);
  assert.equal(tab.content, 'draft text');
  assert.equal(tab.isDirty, true);
  assert.equal(tab.localDraft.content, 'draft text');
  assert.equal(assetBuckets.get('post/draft.md').length, 1);
  assert.equal(deletedAssetBuckets.get('post/draft.md').length, 1);
  assert.ok(calls.some((call) => call[0] === 'refresh-tree'), 'dirty state should refresh the content tree');
}

{
  let resolvePrepare;
  const { controller, storeState } = createHarness({
    prepareMarkdownForProtectedStorage: () => new Promise((resolve) => {
      resolvePrepare = () => resolve({ content: 'encrypted', encrypted: true });
    })
  });
  const tab = {
    path: 'post/protected.md',
    content: 'secret',
    remoteContent: '',
    remoteSignature: 'remote',
    protection: createMarkdownProtectionState({ enabled: true, password: 'pw' })
  };
  const pending = controller.saveDraftForTab(tab);
  controller.clearDraftForTab(tab);
  resolvePrepare();
  const result = await pending;

  assert.equal(result, null, 'clearing a tab should cancel an in-flight protected draft save');
  assert.equal(storeState['post/protected.md'], undefined);
  assert.equal(tab.markdownDraftSaveGeneration, 1);
}

{
  const { controller, calls, timers } = createHarness({ currentMode: 'mode-a' });
  const button = {
    attrs: new Map(),
    setAttribute(name, value) { this.attrs.set(name, String(value)); },
    removeAttribute(name) { this.attrs.delete(name); }
  };
  const tab = {
    mode: 'mode-a',
    path: 'post/dirty.md',
    content: 'changed',
    remoteContent: 'remote',
    remoteSignature: 'remote',
    button,
    protection: createMarkdownProtectionState()
  };
  controller.updateDynamicTabDirtyState(tab);

  assert.equal(tab.isDirty, true);
  assert.equal(button.attrs.get('data-dirty'), '1');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 720);
  assert.ok(calls.some((call) => call[0] === 'push-current-file'), 'active dirty tab should push current-file info');

  tab.content = 'remote';
  controller.updateDynamicTabDirtyState(tab, { autoSave: false });
  assert.equal(tab.isDirty, false);
  assert.equal(button.attrs.has('data-dirty'), false);
}

{
  const { controller, storeState, tabs } = createHarness();
  tabs.set('mode-a', { path: 'post/a.md', isDirty: false, localDraft: null });
  assert.equal(controller.hasUnsavedDrafts(), false);
  tabs.get('mode-a').isDirty = true;
  assert.equal(controller.hasUnsavedDrafts(), true);
  tabs.get('mode-a').isDirty = false;
  storeState['post/b.md'] = { content: 'saved' };
  assert.equal(controller.hasUnsavedDrafts(), true);
}
