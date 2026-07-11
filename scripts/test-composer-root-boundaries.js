import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findEditorContentTreeNode } from '../assets/js/editor-content-tree.js';
import { createComposerEditorTreeState } from '../assets/js/composer-editor-tree-state.js';
import { createComposerMarkdownWorkspaceFacade } from '../assets/js/composer-markdown-workspace-facade.js';
import { createComposerYamlSerialization } from '../assets/js/composer-yaml-serialization.js';

const here = dirname(fileURLToPath(import.meta.url));
const composerSource = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');
const actionEffectsSource = readFileSync(resolve(here, '../assets/js/composer-action-effects.js'), 'utf8');
const markdownWorkspaceFacadeSource = readFileSync(
  resolve(here, '../assets/js/composer-markdown-workspace-facade.js'),
  'utf8'
);
const yamlSiteFeatureSource = readFileSync(resolve(here, '../assets/js/composer-yaml-site-feature.js'), 'utf8');
const yamlSerializationSource = readFileSync(resolve(here, '../assets/js/composer-yaml-serialization.js'), 'utf8');
const editorWorkspaceFeatureSource = readFileSync(
  resolve(here, '../assets/js/composer-editor-workspace-feature.js'),
  'utf8'
);
const editorTreeStateSource = readFileSync(resolve(here, '../assets/js/composer-editor-tree-state.js'), 'utf8');

function parseStaticImportSpecifiers(source) {
  const specifiers = [];
  const pattern = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
  let match = pattern.exec(source);
  while (match) {
    specifiers.push(match[1] || match[2]);
    match = pattern.exec(source);
  }
  return specifiers;
}

const expectedComposerRootFiles = [
  'composer-action-contract.js',
  'composer-action-dispatcher.js',
  'composer-action-effects.js',
  'composer-bootstrap.js',
  'composer-content-mutations.js',
  'composer-content-staging.js',
  'composer-dialogs.js',
  'composer-diff-review-views.js',
  'composer-diff-ui.js',
  'composer-drag-list.js',
  'composer-editor-detail-panel-controller.js',
  'composer-editor-shell.js',
  'composer-editor-tree-state.js',
  'composer-editor-workspace-feature.js',
  'composer-file-panel-controller.js',
  'composer-index-publish-metadata.js',
  'composer-index-tabs-language-menu.js',
  'composer-index-tabs-model.js',
  'composer-index-tabs-ui.js',
  'composer-index-version-list.js',
  'composer-markdown-actions-ui.js',
  'composer-markdown-actions.js',
  'composer-markdown-assets.js',
  'composer-markdown-drafts.js',
  'composer-markdown-feature.js',
  'composer-markdown-loader.js',
  'composer-markdown-save.js',
  'composer-markdown-session.js',
  'composer-markdown-state.js',
  'composer-markdown-workspace-facade.js',
  'composer-markdown-workspace.js',
  'composer-mode-controller.js',
  'composer-notifications.js',
  'composer-order-diff-ui.js',
  'composer-order-preview.js',
  'composer-order-review-view.js',
  'composer-order-visual.js',
  'composer-path-tools.js',
  'composer-post-commit-state.js',
  'composer-publish-flow.js',
  'composer-publish-service.js',
  'composer-publish-settings-ui.js',
  'composer-publish-state-service.js',
  'composer-publish-summary.js',
  'composer-publish-sync-feature.js',
  'composer-remote-sync.js',
  'composer-runtime-styles.js',
  'composer-runtime.js',
  'composer-seo-staging.js',
  'composer-setup-verifier.js',
  'composer-site-config.js',
  'composer-site-model.js',
  'composer-site-settings-config-grids.js',
  'composer-site-settings-controls.js',
  'composer-site-settings-language-menu.js',
  'composer-site-settings-link-list.js',
  'composer-site-settings-localized-fields.js',
  'composer-site-settings-repo-section.js',
  'composer-site-settings-schema.js',
  'composer-site-settings-section-nav.js',
  'composer-site-settings-single-grids.js',
  'composer-site-settings-ui.js',
  'composer-staging.js',
  'composer-sync-commit-controller.js',
  'composer-sync-overlay.js',
  'composer-sync-panel.js',
  'composer-system-panel.js',
  'composer-system-theme-bridge.js',
  'composer-ui-motion.js',
  'composer-unsynced-summary.js',
  'composer-yaml-actions.js',
  'composer-yaml-drafts.js',
  'composer-yaml-panels-controller.js',
  'composer-yaml-serialization.js',
  'composer-yaml-site-feature.js'
];

assert.deepEqual(
  readdirSync(resolve(here, '../assets/js'))
    .filter((name) => /^composer-[^/]+\.(?:js|mjs)$/.test(name))
    .sort(),
  expectedComposerRootFiles,
  'new root composer-* modules require an explicit ownership decision instead of extending the flat namespace'
);

assert.ok(
  composerSource.split(/\r?\n/).length <= 1350,
  'composer root should stay below the feature-composition line budget'
);
assert.ok(
  parseStaticImportSpecifiers(composerSource).length <= 32,
  'composer root should stay below the static import budget'
);

assert.match(composerSource, /from '\.\/composer-action-effects\.js'/);
assert.match(composerSource, /from '\.\/composer-bootstrap\.js'/);
assert.match(composerSource, /from '\.\/composer-markdown-workspace-facade\.js'/);
assert.match(composerSource, /from '\.\/composer-yaml-site-feature\.js'/);
assert.match(yamlSiteFeatureSource, /from '\.\/composer-yaml-serialization\.js'/);
assert.match(composerSource, /from '\.\/composer-editor-workspace-feature\.js'/);
assert.match(editorWorkspaceFeatureSource, /from '\.\/composer-editor-tree-state\.js'/);
assert.doesNotMatch(composerSource, /createComposerActionDispatcher|composerActions\.dispatch\('/);
assert.doesNotMatch(
  composerSource,
  /composer-(?:app-services|controller-graph|lifecycle|root-contract|service-registry)\.js/,
  'composer root should not depend on the removed generic meta-framework'
);
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
  assert.doesNotMatch(composerSource, new RegExp(`function ${name}\\b`), `composer root should not own ${name}`);
});

assert.match(actionEffectsSource, /createComposerActionDispatcher/);
assert.match(actionEffectsSource, /COMPOSER_ACTION_EFFECT_SERVICES/);
assert.match(
  actionEffectsSource,
  /notifyComposerChange: \(kind, actionOptions = \{\}\) => dispatch\.dispatch\('composer\.yaml\.changed'/
);
assert.match(markdownWorkspaceFacadeSource, /getController\(\)/);
assert.match(markdownWorkspaceFacadeSource, /getMarkdownWorkspaceController\(\)\.openMarkdownInEditor/);
assert.match(yamlSerializationSource, /function toIndexYaml\(data\)/);
assert.match(editorTreeStateSource, /function collectEditorDiffStatusMap\(\)/);

{
  const serializer = createComposerYamlSerialization({
    preferredLangOrder: ['en', 'chs', 'ja'],
    normalizeLangCode: (value) =>
      String(value || '')
        .trim()
        .toLowerCase(),
    getLanguageLabel: (code) => ({ en: 'English', chs: 'Chinese' })[code] || '',
    isIndexMetadataObject: (value) => !!value && typeof value === 'object' && !Array.isArray(value),
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
    restorePrimaryEditorMarkdownView: (editorApi) => workspaceCalls.push(['restore', editorApi.id]),
    ensurePrimaryEditorListener: () => workspaceCalls.push(['ensurePrimary']),
    ensurePrimaryEditorTabsMetadataListener: () => workspaceCalls.push(['ensureTabsMetadata']),
    getDynamicEditorTabs: () => [{ mode: 'markdown:one' }],
    getDynamicTabByMode: (mode) => ({ mode }),
    isDynamicMode: (mode) => String(mode).startsWith('markdown:'),
    getFirstDynamicModeId: () => 'markdown:one',
    getActiveDynamicTab: () => ({ mode: 'markdown:one' }),
    activateDynamicMode: (mode) => workspaceCalls.push(['activate', mode]),
    clearActiveDynamicMode: (mode) => workspaceCalls.push(['clear', mode]),
    persistDynamicEditorState: () => 'persisted',
    restoreDynamicEditorState: () => 'restored',
    setTabLoadingState: (tab, isLoading) => workspaceCalls.push(['loading', tab.mode, isLoading]),
    detachPrimaryEditorListeners: () => workspaceCalls.push(['detach']),
    updateMarkdownActionsForTab: (tab) => workspaceCalls.push(['actions', tab.mode]),
    getMarkdownPushButton: () => 'push',
    getMarkdownDiscardButton: () => 'discard',
    getMarkdownSaveButton: () => 'save',
    setMarkdownPushButton: (button) => workspaceCalls.push(['setPush', button]),
    setMarkdownDiscardButton: (button) => workspaceCalls.push(['setDiscard', button]),
    setMarkdownSaveButton: (button) => workspaceCalls.push(['setSave', button]),
    setMarkdownProtectionButton: (button) => workspaceCalls.push(['setProtection', button]),
    getMarkdownPushLabel: (kind) => `push:${kind}`,
    getMarkdownDiscardLabel: () => 'discard label',
    getMarkdownDiscardBusyLabel: () => 'discard busy',
    getMarkdownSaveLabel: () => 'save label',
    getMarkdownSaveBusyLabel: () => 'save busy',
    getMarkdownSaveTooltip: (kind) => `save:${kind}`,
    updateMarkdownPushButton: (tab) => workspaceCalls.push(['updatePush', tab.mode]),
    updateMarkdownDiscardButton: (tab) => workspaceCalls.push(['updateDiscard', tab.mode]),
    updateMarkdownSaveButton: (tab) => workspaceCalls.push(['updateSave', tab.mode]),
    updateMarkdownProtectionButton: (tab) => workspaceCalls.push(['updateProtection', tab.mode]),
    pushEditorCurrentFileInfo: (tab) => workspaceCalls.push(['fileInfo', tab.mode]),
    setDynamicTabStatus: (tab, status) => `${tab.mode}:${status}`,
    closeDynamicTab: (modeId, options = {}) => ({ modeId, options }),
    getOrCreateDynamicMode: (path) => `markdown:${path}`,
    loadDynamicTabContent: (tab) => `loaded:${tab.mode}`,
    openMarkdownInEditor: (path) => `opened:${path}`,
    findDynamicTabByPath: (path) => ({ path })
  };
  const facade = createComposerMarkdownWorkspaceFacade({
    getController: () => workspaceController
  });
  assert.deepEqual(facade.getPrimaryEditorApi(), { id: 'primary' });
  assert.equal(facade.setDynamicTabStatus({ mode: 'markdown:one' }, 'dirty'), 'markdown:one:dirty');
  assert.equal(facade.openMarkdownInEditor('wwwroot/post/a.md'), 'opened:wwwroot/post/a.md');
  assert.deepEqual(facade.findDynamicTabByPath('wwwroot/post/a.md'), { path: 'wwwroot/post/a.md' });
}

{
  const treeState = createComposerEditorTreeState({
    preferredLangs: ['en', 'chs'],
    normalizeRelPath: (value) => String(value || '').replace(/^\.\//, ''),
    treeText: (_key, fallback) => fallback,
    getStateSlice: (kind) =>
      ({
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
    getComposerDiff: (kind) =>
      ({
        index: { keys: { post: { state: 'modified', langs: { en: { state: 'modified' } } } } },
        tabs: { addedKeys: ['about'] },
        site: { hasChanges: true }
      })[kind] || null,
    getRemoteBaseline: () => null,
    getComposerDraftMeta: (kind) => (kind === 'site' ? { savedAt: 1 } : null),
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
  assert.deepEqual(
    tree.map((node) => node.id),
    ['welcome', 'system', 'articles', 'pages']
  );
  assert.equal(findEditorContentTreeNode(tree, 'index:post:en:0').draftState, 'saved');
  assert.equal(findEditorContentTreeNode(tree, 'index:post:en:0').fileState, 'checking');
  assert.equal(findEditorContentTreeNode(tree, 'system:themes').diffState, 'modified');
}

console.log('ok - composer root boundaries');
