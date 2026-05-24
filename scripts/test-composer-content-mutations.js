import assert from 'node:assert/strict';
import { createComposerContentMutationController } from '../assets/js/composer-content-mutations.js';

function createHarness(overrides = {}) {
  const state = {
    index: { __order: ['alpha'], alpha: { en: ['post/alpha/v1.0.0/en.md'] } },
    tabs: { __order: ['home'], home: { en: { title: 'Home', location: 'tab/home/v1.0.0/en.md' } } }
  };
  const calls = [];
  const expanded = new Set();
  const active = { nodeId: '' };
  const promptValues = Array.isArray(overrides.promptValues) ? overrides.promptValues.slice() : ['new-post'];

  const controller = createComposerContentMutationController({
    documentRef: null,
    t: (key, params = {}) => {
      if (key.endsWith('.errorDuplicate')) return `duplicate ${params.version}`;
      return key;
    },
    treeText: (key, fallback) => fallback || key,
    showToast: (kind, message) => calls.push(['toast', kind, message]),
    getStateSlice: (kind) => state[kind],
    getIndexEntry: (key) => {
      if (!state.index[key]) state.index[key] = {};
      return state.index[key];
    },
    getTabsEntry: (key) => {
      if (!state.tabs[key]) state.tabs[key] = {};
      return state.tabs[key];
    },
    notifyComposerChange: (kind) => calls.push(['notify', kind]),
    refreshEditorContentTree: () => calls.push(['refresh']),
    rebuildIndexUI: () => calls.push(['rebuildIndex']),
    rebuildTabsUI: () => calls.push(['rebuildTabs']),
    scheduleComposerOrderPreviewRelayout: (kind) => calls.push(['relayout', kind]),
    showComposerAddEntryPrompt: async (_anchor, options = {}) => {
      calls.push(['prompt', options]);
      const next = promptValues.shift();
      if (next && typeof next === 'object') return next;
      return { confirmed: !!next, value: next || '' };
    },
    editorContentTreeController: {
      setActiveNodeId: (nodeId) => { active.nodeId = nodeId; calls.push(['active', nodeId]); },
      addExpandedNodeId: (nodeId) => { expanded.add(nodeId); calls.push(['expand', nodeId]); }
    },
    normalizeLangCode: (value) => String(value || '').trim().toLowerCase(),
    normalizeRelPath: (value) => String(value || '').replace(/^\/+/, ''),
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    normalizeIndexVariantList: (value) => (Array.isArray(value) ? value.slice() : (value ? [value] : [])),
    getIndexVariantLocation: (value) => (value && typeof value === 'object' ? value.location : String(value || '')),
    isIndexMetadataObject: (value) => !!(value && typeof value === 'object' && !Array.isArray(value)),
    buildDefaultLanguagePathFromEntry: (kind, key, lang) => `${kind}/${key}/v1.0.0/${lang}.md`,
    buildDefaultEntryPath: (kind, key, lang) => `${kind}/${key}/v1.0.0/${lang}.md`,
    buildArticleVersionPath: (key, lang, version) => `post/${key}/${version}/${lang}.md`,
    getDefaultComposerLanguage: () => 'en',
    normalizeComposerVersionPaths: (value) => (Array.isArray(value) ? value.slice() : (value ? [value] : [])),
    collectComposerArticleVersions: (paths) => new Set(paths.map((path) => {
      const parts = String(path || '').split('/');
      return String(parts.at(-2) || '').toLowerCase();
    }).filter(Boolean)),
    isComposerVersionTag: (value) => /^v\d+\.\d+\.\d+$/.test(String(value || '')),
    normalizeComposerVersionTag: (value) => String(value || '').trim().toLowerCase(),
    displayLangName: (value) => String(value || '').toUpperCase(),
    requestAnimationFrameRef: (callback) => {
      calls.push(['raf']);
      callback();
      return 1;
    },
    confirmRef: () => overrides.confirmResult !== false,
    consoleRef: { warn: (...args) => calls.push(['warn', args]) },
    ...overrides.options
  });

  return { active, calls, controller, expanded, state };
}

{
  const { calls, controller, state } = createHarness();
  const key = await controller.addComposerEntry('index', null);
  assert.equal(key, 'new-post');
  assert.equal(state.index.__order[0], 'new-post');
  assert.deepEqual(state.index['new-post'].en, ['index/new-post/v1.0.0/en.md']);
  assert.ok(calls.some(([type, kind]) => type === 'rebuildIndex' && kind === undefined));
  assert.ok(calls.some(([type, kind]) => type === 'notify' && kind === 'index'));
  assert.ok(calls.some(([type]) => type === 'refresh'));
}

{
  const { active, calls, controller, state } = createHarness();
  assert.equal(controller.renameEditorEntry('index', 'alpha', 'beta'), true);
  assert.deepEqual(state.index.__order, ['beta']);
  assert.equal(state.index.beta.en[0], 'post/alpha/v1.0.0/en.md');
  assert.equal(state.index.alpha, undefined);
  assert.equal(active.nodeId, 'index:beta');
  assert.ok(calls.some(([type, kind]) => type === 'notify' && kind === 'index'));
}

{
  const { calls, controller, state } = createHarness();
  state.index.beta = { en: ['post/beta/v1.0.0/en.md'] };
  state.index.__order.push('beta');
  assert.equal(controller.renameEditorEntry('index', 'alpha', 'beta'), false);
  assert.deepEqual(state.index.__order, ['alpha', 'beta']);
  assert.ok(calls.some(([type, kind, message]) => type === 'toast' && kind === 'warn' && message === 'That key already exists.'));
}

{
  const { calls, controller, state } = createHarness();
  assert.equal(controller.renameEditorEntry('index', 'alpha', 'alpha'), false);
  assert.equal(controller.renameEditorEntry('index', 'alpha', 'home'), true);
  assert.equal(state.index.home.en[0], 'post/alpha/v1.0.0/en.md');
  assert.equal(calls.filter(([type]) => type === 'toast').length, 0);
}

{
  const { active, controller, expanded, state } = createHarness();
  const restored = controller.restoreDeletedEditorTreeNode({
    isDeleted: true,
    source: 'index',
    deletedKind: 'version',
    key: 'gamma',
    lang: 'en',
    path: 'post/gamma/v2.0.0/en.md',
    restoreIndex: 0,
    restoreOrderIndex: 0,
    restoreValue: { location: 'post/gamma/v2.0.0/en.md', protected: true }
  });
  assert.equal(restored, true);
  assert.equal(state.index.__order[0], 'gamma');
  assert.deepEqual(state.index.gamma.en, [{ location: 'post/gamma/v2.0.0/en.md', protected: true }]);
  assert.ok(expanded.has('articles'));
  assert.ok(expanded.has('index:gamma'));
  assert.ok(expanded.has('index:gamma:en'));
  assert.equal(active.nodeId, 'index:gamma:en:0');
}

{
  const { calls, controller, state } = createHarness({ promptValues: [{ confirmed: true, value: 'v2.0.0' }] });
  const added = await controller.addEditorVersion('alpha', 'en', null);
  assert.equal(added, true);
  assert.equal(state.index.alpha.en.at(-1), 'post/alpha/v2.0.0/en.md');
  const promptOptions = calls.find(([type]) => type === 'prompt')[1];
  assert.deepEqual(promptOptions.validate(''), { ok: false, error: 'editor.composer.versionPrompt.errorEmpty' });
  assert.deepEqual(promptOptions.validate('bad'), { ok: false, error: 'editor.composer.versionPrompt.errorInvalid' });
  assert.deepEqual(promptOptions.validate('v1.0.0'), { ok: false, error: 'duplicate v1.0.0' });
  assert.deepEqual(promptOptions.validate('v3.0.0'), { ok: true, value: 'v3.0.0' });
}

{
  const { active, controller, state } = createHarness();
  assert.equal(controller.addEditorLanguage('tabs', 'home', 'ja'), true);
  assert.deepEqual(state.tabs.home.ja, { title: 'home', location: 'tabs/home/v1.0.0/ja.md' });
  assert.equal(active.nodeId, 'tabs:home');
}

console.log('composer content mutation tests passed');
