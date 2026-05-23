import assert from 'node:assert/strict';

import { createComposerMarkdownWorkspaceController } from '../assets/js/composer-markdown-workspace.js';

function createSession(activeTab) {
  const tabs = new Map([[activeTab.mode, activeTab]]);
  return {
    getTabs: () => tabs,
    getTab: mode => tabs.get(mode) || null,
    isDynamicMode: mode => tabs.has(mode),
    getFirstDynamicModeId: () => tabs.keys().next().value || null,
    getActiveDynamicTab: () => activeTab,
    activateDynamicMode: mode => tabs.get(mode) || null,
    clearActiveDynamicMode: () => {},
    persistEditorState: () => true,
    restoreEditorState: () => true,
    setTabLoadingState: (tab, value) => { tab.loading = value; },
    closeDynamicTab: async () => true,
    getOrCreateDynamicMode: path => `mode:${path}`,
    openMarkdownInEditor: path => `opened:${path}`,
    findTabByPath: path => Array.from(tabs.values()).find(tab => tab.path === path) || null
  };
}

function createActionsUi(calls) {
  return {
    getPushButton: () => ({ id: 'push' }),
    getDiscardButton: () => ({ id: 'discard' }),
    getSaveButton: () => ({ id: 'save' }),
    setPushButton: button => calls.push(['setPush', button.id]),
    setDiscardButton: button => calls.push(['setDiscard', button.id]),
    setSaveButton: button => calls.push(['setSave', button.id]),
    setProtectionButton: button => calls.push(['setProtect', button.id]),
    getPushLabel: kind => `push:${kind}`,
    getDiscardLabel: () => 'discard',
    getDiscardBusyLabel: () => 'discard busy',
    getSaveLabel: () => 'save',
    getSaveBusyLabel: () => 'save busy',
    getSaveTooltip: kind => `save:${kind}`,
    updatePushButton: tab => calls.push(['updatePush', tab && tab.path]),
    updateDiscardButton: tab => calls.push(['updateDiscard', tab && tab.path]),
    updateSaveButton: tab => calls.push(['updateSave', tab && tab.path]),
    updateProtectionButton: tab => calls.push(['updateProtect', tab && tab.path])
  };
}

{
  const calls = [];
  const activeTab = {
    mode: 'editor-tab-1',
    path: 'tab/about/main_en.md',
    source: 'tabs',
    tabsKey: 'about',
    tabsLang: 'en',
    fileStatus: { state: 'existing' },
    isDirty: true,
    loaded: true,
    localDraft: { savedAt: 12, remoteSignature: 'remote' },
    draftConflict: false
  };
  let onChange = null;
  let onTabsMetadataChange = null;
  const editorApi = {
    onChange(handler) {
      onChange = handler;
      return () => calls.push(['detachChange']);
    },
    onTabsMetadataChange(handler) {
      onTabsMetadataChange = handler;
      return () => calls.push(['detachMetadata']);
    },
    setCurrentFileLabel(payload) {
      calls.push(['fileInfo', payload]);
    },
    setTabsMetadata(metadata, options) {
      calls.push(['tabsMetadata', metadata, options]);
    }
  };
  const tabsEntry = { en: { title: 'About' } };
  const controller = createComposerMarkdownWorkspaceController({
    getPrimaryEditorApi: () => editorApi,
    getMarkdownSessionController: () => createSession(activeTab),
    getMarkdownActionsUi: () => createActionsUi(calls),
    getMarkdownLoader: () => ({
      setDynamicTabStatus(tab, status) {
        tab.fileStatus = status;
        return status;
      },
      loadDynamicTabContent: async tab => {
        tab.loaded = true;
        return 'loaded';
      }
    }),
    getCurrentMode: () => activeTab.mode,
    getTabsEntry: key => {
      assert.equal(key, 'about');
      return tabsEntry;
    },
    getEditorTreeFileNodeByPath: path => path === activeTab.path
      ? { source: 'tabs', key: 'about', lang: 'en' }
      : null,
    notifyComposerChange: kind => calls.push(['notify', kind]),
    updateDynamicTabDirtyState: tab => calls.push(['dirty', tab.content]),
    inferMarkdownSourceFromPath: () => 'tabs',
    buildCurrentFileBreadcrumb: tab => ['Pages', tab.path],
    now: () => 99
  });

  controller.ensurePrimaryEditorListener();
  onChange('# Updated');
  assert.equal(activeTab.content, '# Updated');
  assert.deepEqual(calls.find(call => call[0] === 'dirty'), ['dirty', '# Updated']);

  controller.ensurePrimaryEditorTabsMetadataListener();
  onTabsMetadataChange({ title: 'About Press' });
  assert.equal(tabsEntry.en.title, 'About Press');
  assert.deepEqual(calls.find(call => call[0] === 'notify'), ['notify', 'tabs']);

  controller.pushEditorCurrentFileInfo(activeTab);
  const fileInfo = calls.find(call => call[0] === 'fileInfo')[1];
  assert.equal(fileInfo.path, activeTab.path);
  assert.deepEqual(fileInfo.breadcrumb, ['Pages', activeTab.path]);
  assert.deepEqual(fileInfo.draft, {
    savedAt: 12,
    conflict: false,
    hasContent: true,
    remoteSignature: 'remote'
  });
  assert.deepEqual(
    calls.find(call => call[0] === 'tabsMetadata'),
    ['tabsMetadata', { title: 'About Press' }, { silent: true }]
  );
  assert.equal(calls.filter(call => call[0].startsWith('update')).length >= 4, true);

  assert.equal(controller.getMarkdownPushLabel('create'), 'push:create');
  assert.equal(controller.setDynamicTabStatus(activeTab, { state: 'missing' }).state, 'missing');
  assert.equal(await controller.loadDynamicTabContent(activeTab), 'loaded');
  assert.equal(controller.openMarkdownInEditor(activeTab.path), `opened:${activeTab.path}`);
  assert.equal(controller.findDynamicTabByPath(activeTab.path), activeTab);

  controller.detachPrimaryEditorListeners();
  assert.equal(calls.some(call => call[0] === 'detachChange'), true);
  assert.equal(calls.some(call => call[0] === 'detachMetadata'), true);
}
