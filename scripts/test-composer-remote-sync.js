import assert from 'node:assert/strict';
import { createComposerRemoteSyncController } from '../assets/js/composer-remote-sync.js';

function createResponse(status, text = '') {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text
  };
}

function translate(key, params = {}) {
  if (params.label) return `${key}:${params.label}`;
  if (params.message) return `${key}:${params.message}`;
  return key;
}

function createHarness(options = {}) {
  const fetchQueue = [...(options.fetchQueue || [])];
  const fetchCalls = [];
  const statuses = [];
  const dirtyUpdates = [];
  const indicatorUpdates = [];
  const editorValues = [];
  const protectionUpdates = [];
  const toasts = [];
  const buttonUpdates = [];
  const baselines = {};
  const notifications = [];
  const draftClears = [];
  const unsyncedUpdates = [];
  const diffCloses = [];
  let currentMode = options.currentMode || '';
  let watcherConfig = null;

  const controller = createComposerRemoteSyncController({
    t: translate,
    getContentRootSafe: () => 'wwwroot',
    normalizeRelPath: (value) => String(value || '').replace(/[\\]/g, '/').replace(/^\/+/, ''),
    normalizeMarkdownContent: (value) => String(value == null ? '' : value).replace(/\r\n/g, '\n'),
    computeTextSignature: (value) => `sig:${String(value == null ? '' : value)}`,
    parseEncryptedMarkdownEnvelope: (value) => {
      const text = String(value || '');
      return text.startsWith('ENC:')
        ? { encrypted: true, valid: true, ciphertext: text.slice(4) }
        : { encrypted: false, valid: true };
    },
    createMarkdownProtectionState: () => ({ enabled: false }),
    getMarkdownProtectionState: (tab) => tab.protection || {},
    setMarkdownProtectionState: (tab, state) => {
      tab.protection = state;
      protectionUpdates.push({ tab, state });
    },
    isMarkdownTabProtected: (tab) => !!(tab && tab.protection && tab.protection.enabled),
    hasMarkdownDraftContent: () => !!options.hasDraftContent,
    setDynamicTabStatus: (tab, status) => {
      tab.fileStatus = status;
      statuses.push({ tab, status });
    },
    updateDynamicTabDirtyState: (tab, updateOptions) => dirtyUpdates.push({ tab, options: updateOptions }),
    updateComposerMarkdownDraftIndicators: (updateOptions) => indicatorUpdates.push(updateOptions),
    getCurrentMode: () => currentMode,
    getPrimaryEditorApi: () => ({
      setValue: (value, setOptions) => editorValues.push({ value, options: setOptions })
    }),
    basenameFromPath: (value) => String(value || '').split('/').filter(Boolean).pop() || '',
    startRemoteSyncWatcher: (config) => {
      watcherConfig = config;
      return { config };
    },
    showToast: (type, message, toastOptions) => toasts.push({ type, message, options: toastOptions || {} }),
    updateMarkdownPushButton: (tab) => buttonUpdates.push(['push', tab && tab.path]),
    updateMarkdownDiscardButton: (tab) => buttonUpdates.push(['discard', tab && tab.path]),
    updateMarkdownSaveButton: (tab) => buttonUpdates.push(['save', tab && tab.path]),
    updateMarkdownProtectionButton: (tab) => buttonUpdates.push(['protection', tab && tab.path]),
    fetchContent: async (url, fetchOptions) => {
      fetchCalls.push({ url, options: fetchOptions });
      const next = fetchQueue.shift();
      if (next instanceof Error) throw next;
      if (typeof next === 'function') return next(url, fetchOptions);
      return next || createResponse(404, '');
    },
    parseYAML: (text) => {
      if (String(text || '').trim() === 'invalid') return null;
      return { raw: String(text || '') };
    },
    prepareIndexState: (parsed) => ({ kind: 'index', parsed }),
    prepareTabsState: (parsed) => ({ kind: 'tabs', parsed }),
    prepareSiteState: (parsed) => ({ kind: 'site', parsed }),
    cloneSiteState: (value) => ({ ...value, clonedSite: true }),
    deepClone: (value) => ({ ...value, deepCloned: true }),
    setRemoteBaseline: (kind, value) => {
      baselines[kind] = value;
    },
    notifyComposerChange: (kind, notifyOptions) => notifications.push({ kind, options: notifyOptions }),
    clearDraftStorage: (kind) => draftClears.push(kind),
    updateUnsyncedSummary: () => unsyncedUpdates.push(true),
    closeComposerDiffModalForKind: (kind) => diffCloses.push(kind)
  });

  return {
    controller,
    fetchCalls,
    statuses,
    dirtyUpdates,
    indicatorUpdates,
    editorValues,
    protectionUpdates,
    toasts,
    buttonUpdates,
    baselines,
    notifications,
    draftClears,
    unsyncedUpdates,
    diffCloses,
    get watcherConfig() { return watcherConfig; },
    setCurrentMode: (mode) => {
      currentMode = mode;
    }
  };
}

{
  const harness = createHarness({ fetchQueue: [createResponse(200, 'Hello\r\n')] });
  const snapshot = await harness.controller.fetchMarkdownRemoteSnapshot({ path: '/post/doc.md' });
  assert.equal(harness.fetchCalls[0].url, 'wwwroot/post/doc.md');
  assert.equal(harness.fetchCalls[0].options.cache, 'no-store');
  assert.equal(snapshot.state, 'existing');
  assert.equal(snapshot.content, 'Hello\n');
  assert.equal(snapshot.signature, 'sig:Hello\n');
}

{
  const harness = createHarness({ currentMode: 'markdown:1' });
  const tab = { path: 'post/doc.md', mode: 'markdown:1', content: 'local' };
  harness.controller.applyMarkdownRemoteSnapshot(tab, { state: 'existing', status: 200, content: 'remote' });
  assert.equal(tab.remoteContent, 'remote');
  assert.equal(tab.remoteSignature, 'sig:remote');
  assert.equal(tab.content, 'remote');
  assert.deepEqual(harness.editorValues.at(-1), { value: 'remote', options: { notify: false } });
  assert.equal(harness.statuses.at(-1).status.state, 'existing');
  assert.equal(harness.dirtyUpdates.at(-1).options.autoSave, false);
  assert.deepEqual(harness.indicatorUpdates.at(-1), { path: 'post/doc.md' });
  assert.deepEqual(harness.protectionUpdates.at(-1).state, { enabled: false });
}

{
  const harness = createHarness({ currentMode: 'markdown:2' });
  const tab = { path: 'secret.md', mode: 'markdown:2', content: 'old' };
  harness.controller.applyMarkdownRemoteSnapshot(
    tab,
    { state: 'existing', status: 200, content: 'ENC:ciphertext' },
    { plaintextContent: 'plain text' }
  );
  assert.equal(tab.remoteContent, 'plain text');
  assert.equal(tab.remoteSignature, 'sig:ENC:ciphertext');
  assert.equal(tab.content, 'plain text');
  assert.equal(tab.protection.enabled, true);
  assert.equal(tab.protection.encryptedRemote, true);
  assert.equal(tab.protection.remoteCiphertext, 'ciphertext');
}

{
  const harness = createHarness({ fetchQueue: [createResponse(200, 'published')] });
  const tab = { path: 'post/doc.md', label: 'Doc', mode: 'markdown:3', content: 'published' };
  harness.controller.startMarkdownSyncWatcher(tab);
  assert.equal(harness.statuses[0].status.state, 'checking');
  assert.equal(harness.buttonUpdates[0][0], 'push');
  const result = await harness.watcherConfig.fetch({ attempts: 1 });
  assert.equal(result.done, true);
  harness.watcherConfig.onSuccess(result);
  assert.equal(harness.toasts.at(-1).type, 'success');
  assert.deepEqual(harness.buttonUpdates.slice(-4).map(([name]) => name), ['push', 'discard', 'save', 'protection']);
}

{
  const harness = createHarness();
  const tab = { path: 'new.md', fileStatus: { state: 'missing', message: 'before' }, content: '' };
  harness.controller.startMarkdownSyncWatcher(tab, { isCreate: true });
  harness.watcherConfig.onCancel();
  assert.equal(tab.fileStatus.state, 'missing');
  assert.equal(tab.fileStatus.message, 'editor.composer.remoteWatcher.remoteCheckCanceled');
  assert.equal(harness.toasts.at(-1).message, 'editor.toasts.remoteCheckCanceledUseRefresh');
}

{
  const harness = createHarness({
    fetchQueue: [
      createResponse(404, ''),
      createResponse(200, 'title: Example\n')
    ]
  });
  const snapshot = await harness.controller.fetchComposerRemoteSnapshot('site');
  assert.deepEqual(harness.fetchCalls.map((call) => call.url), ['wwwroot/site.yaml', 'wwwroot/site.yml']);
  assert.equal(snapshot.state, 'existing');
  assert.deepEqual(snapshot.parsed, { raw: 'title: Example\n' });
  assert.equal(snapshot.signature, 'sig:title: Example\n');
}

{
  const harness = createHarness();
  harness.controller.applyComposerRemoteSnapshot('site', {
    state: 'existing',
    text: 'title: Example\n',
    parsed: { raw: 'title: Example\n' }
  });
  assert.deepEqual(harness.baselines.site, {
    kind: 'site',
    parsed: { raw: 'title: Example\n' },
    clonedSite: true
  });
  assert.deepEqual(harness.notifications.at(-1), { kind: 'site', options: { skipAutoSave: true } });
}

{
  const harness = createHarness();
  harness.controller.applyComposerRemoteSnapshot('tabs', {
    state: 'existing',
    text: 'invalid',
    parsed: null
  });
  assert.equal(harness.toasts.at(-1).type, 'warn');
  assert.equal(harness.toasts.at(-1).message, 'editor.toasts.yamlParseFailed:tabs.yaml');
  assert.equal(harness.notifications.length, 0);
}

{
  const harness = createHarness({ fetchQueue: [createResponse(200, 'expected')] });
  harness.controller.startComposerSyncWatcher('tabs', { expectedText: 'expected' });
  const result = await harness.watcherConfig.fetch({ attempts: 1 });
  assert.equal(result.done, true);
  harness.watcherConfig.onSuccess(result);
  assert.deepEqual(harness.baselines.tabs, {
    kind: 'tabs',
    parsed: { raw: 'expected' },
    deepCloned: true
  });
  assert.deepEqual(harness.draftClears, ['tabs']);
  assert.equal(harness.unsyncedUpdates.length, 1);
  assert.deepEqual(harness.diffCloses, ['tabs']);
  assert.equal(harness.toasts.at(-1).message, 'editor.toasts.yamlSynced:tabs.yaml');
}

console.log('composer remote sync tests passed');
