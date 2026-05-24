import assert from 'node:assert/strict';

import {
  createComposerModeController,
  getComposerSystemModeNodeId,
  isComposerSystemMode
} from '../assets/js/composer-mode-controller.js';

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
    toggle(value, force) {
      const next = typeof force === 'boolean' ? force : !values.has(value);
      if (next) values.add(value);
      else values.delete(value);
      return next;
    }
  };
}

function createModeTab(mode, options = {}) {
  return {
    dataset: { mode },
    classList: createClassList(options.dynamic ? ['mode-tab', 'dynamic-mode'] : ['mode-tab']),
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
  };
}

function createDocumentRef(buttons = []) {
  const layout = {
    style: {},
    classList: createClassList()
  };
  const documentElement = {
    removed: [],
    removeAttribute(name) {
      this.removed.push(name);
    }
  };
  return {
    layout,
    documentElement,
    querySelector(selector) {
      if (selector === '#mode-editor') return layout;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.mode-tab') return buttons;
      return [];
    }
  };
}

function createHarness(options = {}) {
  const calls = [];
  const buttons = [
    createModeTab('editor'),
    createModeTab('composer'),
    createModeTab('themes'),
    createModeTab('updates'),
    createModeTab('sync'),
    createModeTab('md-1', { dynamic: true })
  ];
  const documentRef = createDocumentRef(buttons);
  const dynamicTabs = options.dynamicTabs || new Map();
  let activeTreeNodeId = options.activeTreeNodeId || 'welcome';
  const editorApi = options.editorApi || {
    value: 'editor-value',
    requestedLayouts: 0,
    getValue() {
      return this.value;
    },
    setValue(value, opts) {
      calls.push(['setValue', value, opts && opts.notify]);
      this.value = value;
    },
    setBaseDir(value) {
      calls.push(['setBaseDir', value]);
      this.baseDir = value;
    },
    setView(value) {
      calls.push(['setView', value]);
      this.view = value;
    },
    focus() {
      calls.push(['focus']);
    },
    requestLayout() {
      calls.push(['requestLayout']);
      this.requestedLayouts += 1;
    }
  };
  const controller = createComposerModeController({
    documentRef,
    requestAnimationFrameRef: (handler) => {
      calls.push(['raf']);
      handler();
      return 1;
    },
    getDynamicEditorTabs: () => dynamicTabs,
    isDynamicMode: (mode) => dynamicTabs.has(mode),
    getFirstDynamicModeId: () => Array.from(dynamicTabs.keys())[0] || '',
    getActiveTreeNodeId: () => activeTreeNodeId,
    setActiveTreeNodeId: (nodeId) => {
      activeTreeNodeId = nodeId || 'welcome';
      calls.push(['setActiveTreeNodeId', activeTreeNodeId]);
      return activeTreeNodeId;
    },
    getEditorTreeNodeById: (nodeId) => ({ id: nodeId, source: String(nodeId || '').startsWith('system:') ? 'system' : 'index' }),
    expandEditorAncestors: (node) => calls.push(['expandEditorAncestors', node && node.id]),
    selectEditorTreeNodeForTab: (tab, selectionOptions) => calls.push(['selectEditorTreeNodeForTab', tab && tab.path, selectionOptions && selectionOptions.expandAncestors]),
    getPrimaryEditorApi: () => editorApi,
    restorePrimaryEditorMarkdownView: () => calls.push(['restorePrimaryEditorMarkdownView']),
    ensurePrimaryEditorListener: () => calls.push(['ensurePrimaryEditorListener']),
    ensurePrimaryEditorTabsMetadataListener: () => calls.push(['ensurePrimaryEditorTabsMetadataListener']),
    getDynamicTabByMode: (mode) => dynamicTabs.get(mode) || null,
    activateDynamicMode: (mode) => {
      calls.push(['activateDynamicMode', mode]);
      return dynamicTabs.get(mode) || null;
    },
    clearActiveDynamicMode: () => calls.push(['clearActiveDynamicMode']),
    setEditorDetailPanelMode: (mode) => calls.push(['setEditorDetailPanelMode', mode]),
    pushEditorCurrentFileInfo: (tab) => calls.push(['pushEditorCurrentFileInfo', tab ? tab.path : null]),
    refreshEditorContentTree: (refreshOptions) => calls.push(['refreshEditorContentTree', refreshOptions && refreshOptions.preserveStructure]),
    captureEditorContentScroll: (mode) => calls.push(['captureEditorContentScroll', mode]),
    restoreEditorContentScrollForMode: (mode) => calls.push(['restoreEditorContentScrollForMode', mode]),
    scrollEditorContentToTop: (behavior) => calls.push(['scrollEditorContentToTop', behavior]),
    scheduleEditorStatePersist: () => calls.push(['scheduleEditorStatePersist']),
    persistDynamicEditorState: () => calls.push(['persistDynamicEditorState']),
    computeBaseDirForPath: (path) => String(path || '').split('/').slice(0, -1).join('/'),
    animateEditorMarkdownPanelContent: () => calls.push(['animateEditorMarkdownPanelContent']),
    updateDynamicTabDirtyState: (tab, dirtyOptions) => calls.push(['updateDynamicTabDirtyState', tab && tab.path, dirtyOptions && dirtyOptions.autoSave]),
    setTabLoadingState: (tab, isLoading) => calls.push(['setTabLoadingState', tab && tab.path, isLoading]),
    loadDynamicTabContent: async (tab) => {
      calls.push(['loadDynamicTabContent', tab && tab.path]);
      return options.loadText || 'remote markdown';
    },
    alertRef: (message) => calls.push(['alert', message]),
    consoleRef: { error: (...args) => calls.push(['error', ...args]) }
  });
  return { calls, buttons, controller, documentRef, dynamicTabs, editorApi, getActiveTreeNodeId: () => activeTreeNodeId };
}

assert.equal(isComposerSystemMode('composer'), true);
assert.equal(isComposerSystemMode('themes'), true);
assert.equal(isComposerSystemMode('editor'), false);
assert.equal(getComposerSystemModeNodeId('sync'), 'system:sync');
assert.equal(getComposerSystemModeNodeId('composer'), 'system:site-settings');

{
  const { calls, buttons, controller, documentRef, getActiveTreeNodeId } = createHarness();
  controller.applyMode('themes');

  assert.equal(controller.getCurrentMode(), 'themes', 'system mode should become current mode');
  assert.equal(getActiveTreeNodeId(), 'system:themes', 'system mode should select the matching system tree leaf');
  assert.deepEqual(
    calls.filter(call => call[0] === 'setEditorDetailPanelMode'),
    [['setEditorDetailPanelMode', 'themes']],
    'system mode should show the matching detail panel'
  );
  assert.deepEqual(
    calls.filter(call => call[0] === 'refreshEditorContentTree'),
    [['refreshEditorContentTree', true]],
    'system mode should preserve the structure panel while refreshing the file tree'
  );
  assert.equal(buttons.find(button => button.dataset.mode === 'themes').classList.contains('is-active'), true);
  assert.equal(buttons.find(button => button.dataset.mode === 'editor').attributes['aria-selected'], 'false');
  assert.equal(documentRef.documentElement.removed.includes('data-init-mode'), true);
}

{
  const tab = { mode: 'md-1', path: 'post/demo/doc.md', content: 'draft body', loaded: true };
  const { calls, controller, dynamicTabs, editorApi } = createHarness({
    activeTreeNodeId: 'index:demo:en:0',
    dynamicTabs: new Map([['md-1', tab]])
  });
  controller.applyMode('editor');

  assert.equal(controller.getCurrentMode(), 'md-1', 'editor mode should reopen the first dynamic tab when structure is not forced');
  assert.deepEqual(
    calls.filter(call => call[0] === 'activateDynamicMode'),
    [['activateDynamicMode', 'md-1']],
    'dynamic redirect should activate the tab instead of the structure view'
  );
  assert.equal(editorApi.baseDir, 'post/demo');
  assert.equal(dynamicTabs.get('md-1').content, 'draft body');
  assert.deepEqual(
    calls.filter(call => call[0] === 'updateDynamicTabDirtyState'),
    [['updateDynamicTabDirtyState', 'post/demo/doc.md', false]],
    'loaded dynamic tab application should refresh dirty state without autosave'
  );
}

{
  const firstTab = { mode: 'md-1', path: 'post/first/doc.md', content: 'first body', loaded: true };
  const { controller, dynamicTabs, editorApi } = createHarness({
    activeTreeNodeId: 'index:first:en:0',
    dynamicTabs: new Map([['md-1', firstTab]])
  });
  controller.applyMode('md-1');
  editorApi.value = 'edited current value';
  controller.applyMode('sync');

  assert.equal(dynamicTabs.get('md-1').content, 'edited current value', 'leaving a dynamic tab should capture current editor text');
  assert.equal(controller.getCurrentMode(), 'sync');
}

{
  const tab = { mode: 'md-1', path: 'post/lazy/doc.md', content: '', loaded: false };
  const { calls, controller } = createHarness({
    activeTreeNodeId: 'index:lazy:en:0',
    dynamicTabs: new Map([['md-1', tab]]),
    loadText: 'loaded remote body'
  });
  controller.applyMode('md-1');
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(tab.content, 'loaded remote body', 'unloaded dynamic tabs should apply async Markdown loader content');
  assert.deepEqual(
    calls.filter(call => call[0] === 'setTabLoadingState'),
    [
      ['setTabLoadingState', 'post/lazy/doc.md', true],
      ['setTabLoadingState', 'post/lazy/doc.md', false]
    ],
    'async dynamic tab load should toggle tab loading state'
  );
}
