import assert from 'node:assert/strict';
import { createComposerMarkdownLoader } from '../assets/js/composer-markdown-loader.js';

function normalizeMarkdownContent(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function computeTextSignature(value) {
  const normalized = normalizeMarkdownContent(value);
  return `${normalized.length}:${normalized}`;
}

function makeButton() {
  const attrs = new Map();
  return {
    attrs,
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    removeAttribute(name) {
      attrs.delete(name);
    }
  };
}

function makeLoader(overrides = {}) {
  const dirtyCalls = [];
  const refreshCalls = [];
  const currentFilePushes = [];
  const protectionStates = [];
  let protectedState = overrides.protectedState || { enabled: false };

  const loader = createComposerMarkdownLoader({
    getContentRootSafe: () => 'wwwroot',
    normalizeRelPath: (path) => String(path || '').replace(/^\/+/, ''),
    normalizeMarkdownContent,
    computeTextSignature,
    parseEncryptedMarkdownEnvelope: overrides.parseEncryptedMarkdownEnvelope || (() => ({ encrypted: false })),
    decryptProtectedMarkdownForTab: overrides.decryptProtectedMarkdownForTab || (async (markdown) => normalizeMarkdownContent(markdown)),
    isMarkdownTabProtected: () => !!protectedState.enabled,
    setMarkdownProtectionState: (tab, state) => {
      protectedState = { ...state };
      tab.protection = protectedState;
      protectionStates.push({ tab, state: protectedState });
    },
    createMarkdownProtectionState: () => ({ enabled: false }),
    draftHasAssetDeletions: (draft) => Array.isArray(draft && draft.deletedAssets) && draft.deletedAssets.length > 0,
    getDefaultMarkdownForPath: (path) => `# Default for ${path}\n`,
    updateDynamicTabDirtyState: (tab, options) => dirtyCalls.push({ tab, options }),
    getCurrentMode: () => overrides.currentMode || 'editor-tab-1',
    pushEditorCurrentFileInfo: (tab) => currentFilePushes.push(tab),
    refreshEditorContentTree: (options) => refreshCalls.push(options),
    fetchContent: overrides.fetchContent || (async () => ({ status: 404, ok: false })),
    now: overrides.now || (() => 1234),
    draftProtectionTitle: () => 'Draft title',
    draftProtectionMessage: () => 'Draft message',
    openProtectionTitle: () => 'Open title',
    openProtectionMessage: () => 'Open message'
  });

  return {
    loader,
    dirtyCalls,
    refreshCalls,
    currentFilePushes,
    protectionStates
  };
}

{
  const button = makeButton();
  const tab = { mode: 'editor-tab-1', button };
  const { loader, refreshCalls, currentFilePushes } = makeLoader();

  loader.setDynamicTabStatus(tab, {
    state: 'MISSING',
    checkedAt: new Date(42),
    message: 'File not found',
    code: '404'
  });

  assert.deepEqual(tab.fileStatus, {
    state: 'missing',
    checkedAt: 42,
    message: 'File not found',
    code: 404
  });
  assert.equal(button.attrs.get('data-file-state'), 'missing');
  assert.equal(button.attrs.get('data-checked-at'), '42');
  assert.equal(currentFilePushes.length, 1);
  assert.deepEqual(refreshCalls, [{ preserveStructure: true }]);
}

{
  const tab = { mode: 'editor-tab-1', path: 'post/missing.md', button: makeButton() };
  const { loader, dirtyCalls, protectionStates } = makeLoader({
    fetchContent: async (url, options) => {
      assert.equal(url, 'wwwroot/post/missing.md');
      assert.deepEqual(options, { cache: 'no-store' });
      return { status: 404, ok: false };
    }
  });

  const content = await loader.loadDynamicTabContent(tab);

  assert.equal(content, '# Default for post/missing.md\n');
  assert.equal(tab.content, '# Default for post/missing.md\n');
  assert.equal(tab.remoteContent, '');
  assert.equal(tab.remoteSignature, '0:');
  assert.equal(tab.loaded, true);
  assert.equal(tab.pending, null);
  assert.equal(tab.fileStatus.state, 'missing');
  assert.equal(tab.fileStatus.code, 404);
  assert.deepEqual(dirtyCalls.map((entry) => entry.options), [{ autoSave: true }]);
  assert.equal(protectionStates.length, 1);
  assert.deepEqual(tab.protection, { enabled: false });
}

{
  const tab = {
    mode: 'editor-tab-1',
    path: 'post/protected.md',
    button: makeButton(),
    localDraft: {
      encryptedContent: 'draft-cipher'
    }
  };
  const decryptCalls = [];
  const { loader, dirtyCalls } = makeLoader({
    parseEncryptedMarkdownEnvelope: (text) => ({ encrypted: text === 'remote-cipher' }),
    decryptProtectedMarkdownForTab: async (markdown, targetTab, options) => {
      decryptCalls.push({ markdown, targetTab, options });
      return markdown === 'remote-cipher' ? 'Remote plain\n' : 'Draft plain\n';
    },
    fetchContent: async () => ({
      status: 200,
      ok: true,
      text: async () => 'remote-cipher'
    })
  });

  const content = await loader.loadDynamicTabContent(tab);

  assert.equal(content, 'Draft plain\n');
  assert.equal(tab.content, 'Draft plain\n');
  assert.equal(tab.remoteContent, 'Remote plain\n');
  assert.equal(tab.remoteSignature, '13:remote-cipher');
  assert.equal(tab.localDraft.content, 'Draft plain\n');
  assert.equal(tab.localDraft.decrypted, true);
  assert.deepEqual(decryptCalls.map((entry) => entry.options), [
    {
      remote: true,
      draft: false,
      remoteSignature: '13:remote-cipher',
      title: 'Open title',
      message: 'Open message'
    },
    {
      draft: true,
      remote: false,
      remoteSignature: '13:remote-cipher',
      title: 'Draft title',
      message: 'Draft message'
    }
  ]);
  assert.equal(tab.fileStatus.state, 'existing');
  assert.equal(tab.fileStatus.code, 200);
  assert.deepEqual(dirtyCalls.map((entry) => entry.options), [{ autoSave: false }]);
}

console.log('ok - composer markdown loader');
