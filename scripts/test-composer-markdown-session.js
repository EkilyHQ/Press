import assert from 'node:assert/strict';
import { createComposerMarkdownSessionController } from '../assets/js/composer-markdown-session.js';

function normalizeRelPath(value) {
  return String(value || '').replace(/[\\]/g, '/').replace(/^\/+/, '');
}

function createHarness(overrides = {}) {
  let currentMode = overrides.currentMode || 'editor';
  let storedState = overrides.storedState || null;
  let writtenState = null;
  let confirmResult = overrides.confirmResult !== undefined ? overrides.confirmResult : true;

  const calls = {
    capturedModes: [],
    loadedPaths: [],
    flushedPaths: [],
    clearedPaths: [],
    appliedModes: [],
    selectedPaths: [],
    restoredExpanded: null,
    restoredActiveNode: null,
    railScrolls: [],
    restoredScrollModes: [],
    contentScrollByKey: null,
    groupUpdates: 0,
    detachCount: 0,
    actionTabs: [],
    draftIndicators: []
  };

  const controller = createComposerMarkdownSessionController({
    editorStateVersion: 3,
    editorSessionStateStore: {
      readEditorState: () => storedState,
      writeEditorState: (state) => {
        writtenState = state;
      }
    },
    normalizeRelPath,
    normalizeLangCode: (value) => String(value || '').trim().toLowerCase(),
    inferMarkdownSourceFromPath: (path) => path.includes('/pages/') ? 'pages' : 'index',
    basenameFromPath: (path) => normalizeRelPath(path).split('/').filter(Boolean).pop() || '',
    computeBaseDirForPath: (path) => {
      const norm = normalizeRelPath(path);
      const slash = norm.lastIndexOf('/');
      return slash >= 0 ? norm.slice(0, slash) : '';
    },
    createMarkdownProtectionState: () => ({ locked: false }),
    ensureMarkdownAssetBucket: (path) => ({ markdownPath: normalizeRelPath(path) }),
    restoreMarkdownDraftForTab: (tab) => {
      if (tab.path === 'wwwroot/draft.md') {
        tab.localDraft = { content: 'draft', savedAt: 10 };
        tab.content = 'draft';
      }
    },
    loadDynamicTabContent: async (tab) => {
      calls.loadedPaths.push(tab.path);
      tab.loaded = true;
      tab.content = tab.content || `loaded:${tab.path}`;
      tab.remoteContent = tab.content;
      return tab.content;
    },
    flushMarkdownDraft: (tab) => {
      calls.flushedPaths.push(tab.path);
    },
    clearMarkdownDraftForTab: (tab) => {
      calls.clearedPaths.push(tab.path);
      tab.localDraft = null;
    },
    hasMarkdownDraftContent: (tab) => !!(tab && tab.localDraft && tab.localDraft.content),
    getAllowEditorStatePersist: () => overrides.allowPersist !== false,
    getCurrentMode: () => currentMode,
    captureEditorContentScroll: (mode) => {
      calls.capturedModes.push(mode);
    },
    getActiveNodeId: () => 'index:home:en',
    getExpandedNodeIdsSnapshot: () => ['articles', 'index:home'],
    getEditorRailScrollTop: () => 42,
    getEditorContentScrollSnapshot: () => ({ [currentMode || 'editor']: 17 }),
    setEditorContentScrollByKey: (value) => {
      calls.contentScrollByKey = value;
    },
    restoreExpandedNodeIds: (ids) => {
      calls.restoredExpanded = ids;
    },
    setActiveNodeIdIfExists: (nodeId) => {
      calls.restoredActiveNode = nodeId;
    },
    setEditorRailScrollTop: (value) => {
      calls.railScrolls.push(value);
    },
    restoreEditorContentScrollForMode: (mode) => {
      calls.restoredScrollModes.push(mode);
    },
    requestAnimationFrameRef: (fn) => fn(),
    applyMode: (mode, options) => {
      calls.appliedModes.push({ mode, options });
      currentMode = mode;
    },
    selectEditorTreeNodeByPath: (path) => {
      calls.selectedPaths.push(path);
    },
    showComposerDiscardConfirm: async () => confirmResult,
    t: (key, params) => params && params.label ? `${key}:${params.label}` : key,
    confirmRef: () => confirmResult,
    consoleRef: {
      warn: () => {},
      error: () => {}
    },
    updateDynamicTabsGroupState: () => {
      calls.groupUpdates += 1;
    },
    detachPrimaryEditorListeners: () => {
      calls.detachCount += 1;
    },
    updateMarkdownActionsForTab: (tab) => {
      calls.actionTabs.push(tab ? tab.path : null);
    },
    updateComposerMarkdownDraftIndicators: (payload) => {
      calls.draftIndicators.push(payload);
    }
  });

  return {
    controller,
    calls,
    get currentMode() {
      return currentMode;
    },
    setCurrentMode(value) {
      currentMode = value;
    },
    get writtenState() {
      return writtenState;
    },
    setStoredState(value) {
      storedState = value;
    },
    setConfirmResult(value) {
      confirmResult = value;
    }
  };
}

{
  const harness = createHarness();
  const { controller } = harness;
  const modeA = controller.getOrCreateDynamicMode('/wwwroot/shared.md', {
    source: 'tabs',
    key: 'home',
    lang: 'EN',
    editorTreeNodeId: 'tabs:home:en'
  });
  const duplicate = controller.getOrCreateDynamicMode('wwwroot/shared.md', {
    source: 'tabs',
    key: 'home',
    lang: 'en'
  });
  const modeB = controller.getOrCreateDynamicMode('wwwroot/shared.md', {
    source: 'tabs',
    key: 'home',
    lang: 'chs'
  });

  assert.equal(duplicate, modeA, 'same tabs identity should reuse the existing dynamic mode');
  assert.notEqual(modeB, modeA, 'same path with a different tabs language should keep a separate session');
  assert.equal(controller.getTabs().size, 2);

  const tabA = controller.getTab(modeA);
  assert.equal(tabA.path, 'wwwroot/shared.md');
  assert.equal(tabA.source, 'tabs');
  assert.equal(tabA.tabsKey, 'home');
  assert.equal(tabA.tabsLang, 'en');
  assert.equal(tabA.editorTreeNodeId, 'tabs:home:en');
  assert.equal(tabA.lookupKey, 'tabs:home:en');
  assert.deepEqual(tabA.pendingAssets, { markdownPath: 'wwwroot/shared.md' });
}

{
  const harness = createHarness();
  const { controller, calls } = harness;
  const firstMode = controller.getOrCreateDynamicMode('wwwroot/first.md');
  harness.setCurrentMode(firstMode);
  controller.activateDynamicMode(firstMode);
  const secondMode = controller.openMarkdownInEditor('wwwroot/second.md');

  assert.notEqual(secondMode, firstMode);
  assert.deepEqual(calls.flushedPaths, ['wwwroot/first.md']);
  assert.deepEqual(calls.appliedModes.at(-1), { mode: secondMode, options: undefined });
  assert.deepEqual(calls.selectedPaths, ['wwwroot/second.md']);
}

{
  const harness = createHarness();
  const { controller } = harness;
  const mode = controller.getOrCreateDynamicMode('wwwroot/article.md', {
    source: 'index',
    key: 'article',
    lang: 'en',
    editorTreeNodeId: 'index:article:en'
  });
  harness.setCurrentMode(mode);
  controller.activateDynamicMode(mode);
  assert.equal(controller.persistEditorState(), true);
  assert.equal(harness.writtenState.mode, 'markdown');
  assert.equal(harness.writtenState.activeLookupKey, 'wwwroot/article.md');
  assert.deepEqual(harness.writtenState.open, [{
    lookupKey: 'wwwroot/article.md',
    path: 'wwwroot/article.md',
    source: 'index',
    key: 'article',
    lang: 'en',
    editorTreeNodeId: 'index:article:en'
  }]);
  assert.deepEqual(harness.writtenState.expandedNodeIds, ['articles', 'index:home']);
}

{
  const harness = createHarness({
    storedState: {
      v: 3,
      mode: 'markdown',
      activeNodeId: 'index:restored:en',
      activeLookupKey: 'tabs:home:chs',
      activePath: 'wwwroot/shared.md',
      open: [
        {
          lookupKey: 'tabs:home:en',
          path: 'wwwroot/shared.md',
          source: 'tabs',
          key: 'home',
          lang: 'en',
          editorTreeNodeId: 'tabs:home:en'
        },
        {
          lookupKey: 'tabs:home:chs',
          path: 'wwwroot/shared.md',
          source: 'tabs',
          key: 'home',
          lang: 'chs',
          editorTreeNodeId: 'tabs:home:chs'
        }
      ],
      expandedNodeIds: ['system:site-settings'],
      railScrollTop: 88,
      contentScrollByKey: { 'tabs:home:chs': 24 }
    }
  });
  const { controller, calls } = harness;

  assert.equal(controller.restoreEditorState(), true);
  assert.equal(controller.getTabs().size, 2);
  const restoredTab = Array.from(controller.getTabs().values()).find(tab => tab.lookupKey === 'tabs:home:chs');
  assert.ok(restoredTab, 'restore should recreate the active persisted lookup key');
  assert.deepEqual(calls.restoredExpanded, ['system:site-settings']);
  assert.equal(calls.restoredActiveNode, 'index:restored:en');
  assert.deepEqual(calls.contentScrollByKey, { 'tabs:home:chs': 24 });
  assert.deepEqual(calls.appliedModes.at(-1), {
    mode: restoredTab.mode,
    options: { preserveTreeExpansion: true, restoreScroll: true }
  });
  assert.deepEqual(calls.railScrolls, [88, 88]);
  assert.deepEqual(calls.restoredScrollModes, [restoredTab.mode]);
}

{
  const harness = createHarness({ confirmResult: false });
  const { controller, calls } = harness;
  const mode = controller.getOrCreateDynamicMode('wwwroot/draft.md');
  const tab = controller.getTab(mode);
  tab.isDirty = true;
  harness.setCurrentMode(mode);
  controller.activateDynamicMode(mode);

  const anchor = { getBoundingClientRect: () => ({}) };
  assert.equal(await controller.closeDynamicTab(mode, { anchor }), false);
  assert.equal(controller.getTab(mode), tab, 'cancelled close should keep the tab');

  harness.setConfirmResult(true);
  assert.equal(await controller.closeDynamicTab(mode, { anchor }), true);
  assert.equal(controller.getTab(mode), null);
  assert.deepEqual(calls.clearedPaths, ['wwwroot/draft.md']);
  assert.equal(calls.groupUpdates, 1);
  assert.equal(calls.detachCount, 1);
  assert.equal(calls.appliedModes.at(-1).mode, 'editor');
  assert.deepEqual(calls.actionTabs.at(-1), null);
  assert.deepEqual(calls.draftIndicators.at(-1), { path: 'wwwroot/draft.md' });
}

{
  const harness = createHarness();
  const { controller } = harness;
  const mode = controller.getOrCreateDynamicMode('wwwroot/status.md');
  controller.getTab(mode).fileStatus = { state: 'modified' };
  assert.deepEqual(Array.from(controller.collectFileStatusMap()), [['wwwroot/status.md', 'modified']]);
}

console.log('composer markdown session tests passed');
