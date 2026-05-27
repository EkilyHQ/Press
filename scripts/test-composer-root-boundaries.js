import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findEditorContentTreeNode } from '../assets/js/editor-content-tree.js';
import { createComposerEditorTreeState } from '../assets/js/composer-editor-tree-state.js';
import { createComposerMarkdownWorkspaceFacade } from '../assets/js/composer-markdown-workspace-facade.js';
import { createComposerYamlSerialization } from '../assets/js/composer-yaml-serialization.js';

const here = dirname(fileURLToPath(import.meta.url));
const composerSource = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');
const actionEffectsSource = readFileSync(resolve(here, '../assets/js/composer-action-effects.js'), 'utf8');
const markdownWorkspaceFacadeSource = readFileSync(resolve(here, '../assets/js/composer-markdown-workspace-facade.js'), 'utf8');
const yamlSerializationSource = readFileSync(resolve(here, '../assets/js/composer-yaml-serialization.js'), 'utf8');
const editorTreeStateSource = readFileSync(resolve(here, '../assets/js/composer-editor-tree-state.js'), 'utf8');

assert.match(composerSource, /from '\.\/composer-action-effects\.js'/);
assert.match(composerSource, /from '\.\/composer-markdown-workspace-facade\.js'/);
assert.match(composerSource, /from '\.\/composer-yaml-serialization\.js'/);
assert.match(composerSource, /from '\.\/composer-editor-tree-state\.js'/);
assert.doesNotMatch(composerSource, /createComposerActionDispatcher|composerActions\.dispatch\('/);
assert.doesNotMatch(composerSource, /import \{ buildEditorContentTree/);
[
  'sortLangKeys',
  'toIndexYaml',
  'toTabsYaml',
  'collectEditorDraftStatusMap',
  'collectEditorFileStatusMap',
  'collectEditorDiffStatusMap',
  'findDynamicTabByPath',
  'getPrimaryEditorApi'
].forEach((name) => {
  assert.doesNotMatch(
    composerSource,
    new RegExp(`function ${name}\\b`),
    `composer root should not own ${name}`
  );
});

assert.match(actionEffectsSource, /createComposerActionDispatcher/);
assert.match(actionEffectsSource, /COMPOSER_ACTION_EFFECT_SERVICES/);
assert.match(actionEffectsSource, /notifyComposerChange: \(kind, actionOptions = \{\}\) => dispatch\.dispatch\('composer\.yaml\.changed'/);
assert.match(markdownWorkspaceFacadeSource, /getMarkdownWorkspaceController\(\)\.openMarkdownInEditor/);
assert.match(yamlSerializationSource, /function toIndexYaml\(data\)/);
assert.match(editorTreeStateSource, /function collectEditorDiffStatusMap\(\)/);

{
  const serializer = createComposerYamlSerialization({
    preferredLangOrder: ['en', 'chs', 'ja'],
    normalizeLangCode: value => String(value || '').trim().toLowerCase(),
    getLanguageLabel: code => ({ en: 'English', chs: 'Chinese' })[code] || '',
    isIndexMetadataObject: value => !!value && typeof value === 'object' && !Array.isArray(value),
    writeYamlValue: (lines, indent, value) => {
      const prefix = '  '.repeat(indent);
      lines.push(`${prefix}location: ${value.location || ''}`);
    }
  });
  assert.deepEqual(serializer.sortLangKeys({ ja: true, chs: true, en: true, de: true }), ['en', 'chs', 'ja', 'de']);
  assert.equal(serializer.displayLangName('en'), 'English');
  assert.equal(serializer.displayLangName('ja'), 'JA');
  assert.notEqual(serializer.langFlag('en'), '');
  assert.match(
    serializer.toIndexYaml({
      __order: ['post'],
      post: {
        chs: ['wwwroot/post/chs.md'],
        en: ['wwwroot/post/en.md']
      }
    }),
    /post:\n  en: wwwroot\/post\/en\.md\n  chs: wwwroot\/post\/chs\.md\n/
  );
  assert.match(
    serializer.toTabsYaml({
      __order: ['about'],
      about: {
        en: { title: 'About "Us"', location: 'wwwroot/about.md' }
      }
    }),
    /about:\n  en:\n    title: "About \\"Us\\""\n    location: wwwroot\/about\.md\n/
  );
}

{
  const workspaceCalls = [];
  const workspaceController = {
    getPrimaryEditorApi: () => ({ id: 'primary' }),
    restorePrimaryEditorMarkdownView: editorApi => workspaceCalls.push(['restore', editorApi.id]),
    ensurePrimaryEditorListener: () => workspaceCalls.push(['ensurePrimary']),
    ensurePrimaryEditorTabsMetadataListener: () => workspaceCalls.push(['ensureTabsMetadata']),
    getDynamicEditorTabs: () => [{ mode: 'markdown:one' }],
    getDynamicTabByMode: mode => ({ mode }),
    isDynamicMode: mode => String(mode).startsWith('markdown:'),
    getFirstDynamicModeId: () => 'markdown:one',
    getActiveDynamicTab: () => ({ mode: 'markdown:one' }),
    activateDynamicMode: mode => workspaceCalls.push(['activate', mode]),
    clearActiveDynamicMode: mode => workspaceCalls.push(['clear', mode]),
    persistDynamicEditorState: () => 'persisted',
    restoreDynamicEditorState: () => 'restored',
    setTabLoadingState: (tab, isLoading) => workspaceCalls.push(['loading', tab.mode, isLoading]),
    detachPrimaryEditorListeners: () => workspaceCalls.push(['detach']),
    updateMarkdownActionsForTab: tab => workspaceCalls.push(['actions', tab.mode]),
    getMarkdownPushButton: () => 'push',
    getMarkdownDiscardButton: () => 'discard',
    getMarkdownSaveButton: () => 'save',
    setMarkdownPushButton: button => workspaceCalls.push(['setPush', button]),
    setMarkdownDiscardButton: button => workspaceCalls.push(['setDiscard', button]),
    setMarkdownSaveButton: button => workspaceCalls.push(['setSave', button]),
    setMarkdownProtectionButton: button => workspaceCalls.push(['setProtection', button]),
    getMarkdownPushLabel: kind => `push:${kind}`,
    getMarkdownDiscardLabel: () => 'discard label',
    getMarkdownDiscardBusyLabel: () => 'discard busy',
    getMarkdownSaveLabel: () => 'save label',
    getMarkdownSaveBusyLabel: () => 'save busy',
    getMarkdownSaveTooltip: kind => `save:${kind}`,
    updateMarkdownPushButton: tab => workspaceCalls.push(['updatePush', tab.mode]),
    updateMarkdownDiscardButton: tab => workspaceCalls.push(['updateDiscard', tab.mode]),
    updateMarkdownSaveButton: tab => workspaceCalls.push(['updateSave', tab.mode]),
    updateMarkdownProtectionButton: tab => workspaceCalls.push(['updateProtection', tab.mode]),
    pushEditorCurrentFileInfo: tab => workspaceCalls.push(['fileInfo', tab.mode]),
    setDynamicTabStatus: (tab, status) => `${tab.mode}:${status}`,
    closeDynamicTab: (modeId, options = {}) => ({ modeId, options }),
    getOrCreateDynamicMode: path => `markdown:${path}`,
    loadDynamicTabContent: tab => `loaded:${tab.mode}`,
    openMarkdownInEditor: path => `opened:${path}`,
    findDynamicTabByPath: path => ({ path })
  };
  const services = {
    getMarkdownSessionController: () => ({ id: 'session' }),
    getMarkdownActionsUi: () => ({ id: 'actions' }),
    getMarkdownLoader: () => ({ id: 'loader' }),
    getMarkdownDraftController: () => ({ id: 'draft' }),
    getMarkdownWorkspaceController: () => workspaceController
  };
  const facade = createComposerMarkdownWorkspaceFacade({ services });
  assert.deepEqual(facade.getPrimaryEditorApi(), { id: 'primary' });
  assert.equal(facade.getMarkdownDraftController().id, 'draft');
  assert.equal(facade.setDynamicTabStatus({ mode: 'markdown:one' }, 'dirty'), 'markdown:one:dirty');
  assert.equal(facade.openMarkdownInEditor('wwwroot/post/a.md'), 'opened:wwwroot/post/a.md');
  assert.deepEqual(facade.findDynamicTabByPath('wwwroot/post/a.md'), { path: 'wwwroot/post/a.md' });
}

{
  const treeState = createComposerEditorTreeState({
    preferredLangs: ['en', 'chs'],
    normalizeRelPath: value => String(value || '').replace(/^\.\//, ''),
    treeText: (_key, fallback) => fallback,
    getStateSlice: kind => ({
      index: {
        __order: ['post'],
        post: { en: ['wwwroot/post/a.md'] }
      },
      tabs: {
        __order: ['about'],
        about: { en: { title: 'About', location: 'wwwroot/about.md' } }
      }
    })[kind],
    readMarkdownDraftStore: () => ({
      './wwwroot/post/a.md': { content: '# Draft' },
      './wwwroot/post/empty.md': { content: '' }
    }),
    collectDynamicMarkdownDraftStates: () => new Map([['wwwroot/about.md', 'unsaved']]),
    getMarkdownSessionController: () => ({
      collectFileStatusMap: () => new Map([['wwwroot/post/a.md', 'checking']])
    }),
    getComposerDiff: kind => ({
      index: { keys: { post: { state: 'modified', langs: { en: { state: 'modified' } } } } },
      tabs: { addedKeys: ['about'] },
      site: { hasChanges: true }
    })[kind] || null,
    getRemoteBaseline: () => null,
    getComposerDraftMeta: kind => (kind === 'site' ? { savedAt: 1 } : null),
    hasSystemUpdateEntries: () => true,
    hasThemeEntries: () => true
  });

  assert.deepEqual(
    [...treeState.collectEditorDraftStatusMap().entries()],
    [
      ['wwwroot/post/a.md', 'saved'],
      ['wwwroot/about.md', 'unsaved']
    ]
  );
  assert.deepEqual([...treeState.collectEditorFileStatusMap().entries()], [['wwwroot/post/a.md', 'checking']]);
  const diffEntries = treeState.collectEditorDiffStatusMap();
  assert.equal(diffEntries.get('index:post'), 'modified');
  assert.equal(diffEntries.get('index:post:en'), 'modified');
  assert.equal(diffEntries.get('tabs:about'), 'added');
  assert.equal(diffEntries.get('system:site-settings'), 'modified');
  assert.equal(diffEntries.get('system:updates'), 'modified');
  assert.equal(diffEntries.get('system:themes'), 'modified');

  const tree = treeState.buildCurrentEditorTree();
  assert.deepEqual(tree.map(node => node.id), ['welcome', 'system', 'articles', 'pages']);
  assert.equal(findEditorContentTreeNode(tree, 'index:post:en:0').draftState, 'saved');
  assert.equal(findEditorContentTreeNode(tree, 'index:post:en:0').fileState, 'checking');
  assert.equal(findEditorContentTreeNode(tree, 'system:themes').diffState, 'modified');
}

console.log('ok - composer root boundaries');
