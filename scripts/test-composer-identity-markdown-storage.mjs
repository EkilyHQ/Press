import assert from 'node:assert/strict';

import { createStagingRegistry } from '../assets/js/composer-staging.js';

import { resolveEditorStorageScope } from '../assets/js/editor-storage.js';

import { createEditorSessionStateStore } from '../assets/js/editor-session-state.js';

import { createPublishSettingsStore } from '../assets/js/publish/settings-store.js';

import {
  inferRepoConfigFromGitHubPagesUrl,
  applyInferredRepoConfig,
  isPlaceholderRepoConfig
} from '../assets/js/composer-site-config.js';

import { readIdentitySource, createMemoryStorage } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerPublishSummarySource = readIdentitySource('../assets/js/composer-publish-summary.js');

const composerContentStagingSource = readIdentitySource('../assets/js/composer-content-staging.js');

const composerIndexPublishMetadataSource = readIdentitySource('../assets/js/composer-index-publish-metadata.js');

const composerMarkdownFeatureSource = readIdentitySource('../assets/js/composer-markdown-feature.js');

const composerEditorWorkspaceFeatureSource = readIdentitySource('../assets/js/composer-editor-workspace-feature.js');

const composerBootstrapSource = readIdentitySource('../assets/js/composer-bootstrap.js');

const composerMarkdownActionsUiSource = readIdentitySource('../assets/js/composer-markdown-actions-ui.js');

const composerMarkdownActionsSource = readIdentitySource('../assets/js/composer-markdown-actions.js');

const composerMarkdownStateSource = readIdentitySource('../assets/js/composer-markdown-state.js');

const composerMarkdownDraftsSource = readIdentitySource('../assets/js/composer-markdown-drafts.js');

const composerMarkdownWorkspaceSource = readIdentitySource('../assets/js/composer-markdown-workspace.js');

const editorFileTreeUiSource = readIdentitySource('../assets/js/editor-file-tree-ui.js');

const editorStructurePanelUiSource = readIdentitySource('../assets/js/editor-structure-panel-ui.js');

const editorStorageSource = readIdentitySource('../assets/js/editor-storage.js');

const publishSettingsSource = readIdentitySource('../assets/js/publish/settings-store.js');

const editorMainRuntimeSource = readIdentitySource('../assets/js/editor-main-runtime.js');

const editorMainWorkspaceSessionSource = readIdentitySource('../assets/js/editor-main-workspace-session.js');

const editorSource = readIdentitySource('../index_editor.html');

const nativeBaseSource = readIdentitySource('../assets/themes/native/base.css');

const repoInference = {
  resolveEditorStorageScope,
  inferRepoConfigFromGitHubPagesUrl,
  isPlaceholderRepoConfig,
  applyInferredRepoConfig
};

// composer-identity-body:start

assert.match(
  composerMarkdownActionsUiSource,
  /const MARKDOWN_PUSH_LABEL_KEYS[\s\S]*export function createComposerMarkdownActionsUi\(options = \{\}\)[\s\S]*function updatePushButton\(tab\)[\s\S]*function updateDiscardButton\(tab\)[\s\S]*function updateSaveButton\(tab\)[\s\S]*function updateProtectionButton\(tab\)/,
  'Markdown actions UI boundary should own Push, Discard, Save, and Protection button state rendering'
);

assert.match(
  composerMarkdownFeatureSource,
  /from '\.\/composer-markdown-actions\.js'/,
  'Markdown feature should cache-bust the extracted Markdown actions controller boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/composer-markdown-actions\.js'/,
  'composer root should not import the Markdown actions controller directly after the Markdown feature extraction'
);

assert.match(
  source,
  /from '\.\/composer-markdown-workspace\.js'/,
  'composer should cache-bust the extracted Markdown workspace controller boundary'
);

assert.doesNotMatch(
  source,
  /let detachPrimaryEditorListener|let detachPrimaryEditorTabsMetadataListener|function getTabsMetadataForPath|function updateTabsEntryTitleForTab\(tab, metadata\) \{|setCurrentFileLabel\(payload\)|setTabsMetadata\(tab && tab\.source === 'tabs'/,
  'composer should not own primary editor listeners, tab metadata synchronization, or current-file payload emission'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /export function createComposerMarkdownWorkspaceController\([\s\S]*function ensurePrimaryEditorListener\(\)[\s\S]*function getTabsMetadataForTab\(tab\)[\s\S]*function updateTabsEntryTitleForTab\(tab, metadata\)[\s\S]*function pushEditorCurrentFileInfo\(tab\)[\s\S]*function loadDynamicTabContent\(tab\)/,
  'Markdown workspace controller should own primary editor listeners, dynamic tab adapters, action UI proxying, and current-file payload synchronization'
);

assert.doesNotMatch(
  source,
  /async function manualSaveActiveMarkdown|async function handleMarkdownProtectionButton|async function openMarkdownPushOnGitHub|async function discardMarkdownLocalChanges|const plaintextContent = normalizeMarkdownContent\(tab\.content != null \? String\(tab\.content\) : ''\);[\s\S]*startMarkdownSyncWatcher\(tab,/,
  'Markdown action commands should stay outside the main composer shell'
);

assert.match(
  composerMarkdownActionsSource,
  /export function createComposerMarkdownActionsController\(options = \{\}\)[\s\S]*async function manualSaveActiveMarkdown\(triggerButton\)[\s\S]*async function handleMarkdownProtectionButton\(anchor\)[\s\S]*async function openMarkdownPushOnGitHub\(tab\)[\s\S]*async function discardMarkdownLocalChanges\(tab, anchor\)/,
  'Markdown actions controller should own save, protection, GitHub open, and discard command flows'
);

assert.match(
  source,
  /const markdownActionsController = composerMarkdownFeature\.createActionsController\(\{[\s\S]*preparePopupWindow,[\s\S]*startMarkdownSyncWatcher,[\s\S]*nsCopyToClipboard[\s\S]*\}\);/,
  'composer should delegate Markdown action controller wiring to the Markdown feature boundary'
);

assert.match(
  composerMarkdownFeatureSource,
  /createComposerMarkdownActionsController\(\{[\s\S]*consoleRef,[\s\S]*confirmRef: \(message\) =>\s*typeof editorRuntime\.confirmAction === 'function' \? editorRuntime\.confirmAction\(message\) : true,[\s\S]*clearTimeoutRef: \(id\) => safeCall\(editorRuntime\.clearTimer, id\),/,
  'Markdown feature should inject Markdown action dialogs, logging, and timer clearing through the runtime boundary'
);

assert.doesNotMatch(
  composerMarkdownActionsSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\bclearTimeout\s*\(/m,
  'Markdown actions controller should use injected confirmation and timer-clearing adapters'
);

assert.match(
  composerMarkdownFeatureSource,
  /from '\.\/composer-markdown-state\.js'/,
  'Markdown feature should cache-bust the extracted Markdown state boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/composer-markdown-state\.js'/,
  'composer root should not import the Markdown state boundary directly after the Markdown feature extraction'
);

assert.doesNotMatch(
  source,
  /function createMarkdownProtectionState|function getMarkdownProtectionState|function computeTextSignature|function bumpMarkdownDraftSaveGeneration|function hasMarkdownDraftContent/,
  'Markdown protection, draft, and text-signature state helpers should stay outside the main composer shell'
);

assert.match(
  composerMarkdownStateSource,
  /from '\.\/composer-markdown-save\.js'[\s\S]*export function normalizeMarkdownContent\(text\)[\s\S]*export function computeTextSignature\(text\)[\s\S]*export function createMarkdownProtectionState\(overrides = \{\}\)[\s\S]*export function getMarkdownProtectionState\(tab\)[\s\S]*export function bumpMarkdownDraftSaveGeneration\(tab\)/,
  'Markdown state boundary should own draft normalization, text signatures, protection state, and encrypted-draft save generations'
);

assert.match(
  composerMarkdownFeatureSource,
  /from '\.\/composer-markdown-drafts\.js'/,
  'Markdown feature should cache-bust the extracted Markdown drafts boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/composer-markdown-drafts\.js'/,
  'composer root should not import the Markdown drafts controller directly after the Markdown feature extraction'
);

assert.doesNotMatch(
  source,
  /function restoreMarkdownDraftForTab|function saveMarkdownDraftForTab|function scheduleMarkdownDraftSave|function updateDynamicTabDirtyState/,
  'Markdown draft storage, restore, autosave, and dirty-state lifecycle should stay outside the main composer shell'
);

assert.match(
  composerMarkdownDraftsSource,
  /export function createComposerMarkdownDraftController\(options = \{\}\)[\s\S]*function getDraftEntry\(path\)[\s\S]*function saveDraftEntry\(path, content, remoteSignature = '', assets = \[\], saveOptions = \{\}\)[\s\S]*function restoreDraftForTab\(tab\)[\s\S]*async function saveDraftForTab\(tab, saveOptions = \{\}\)[\s\S]*function updateDynamicTabDirtyState\(tab, dirtyOptions = \{\}\)/,
  'Markdown drafts boundary should own draft store entries, restore/save/clear, autosave, and dirty-state calculation'
);

assert.match(
  composerMarkdownFeatureSource,
  /createComposerMarkdownDraftController\(\{[\s\S]*updateComposerMarkdownDraftIndicators,[\s\S]*refreshEditorContentTree,[\s\S]*updateUnsyncedSummary: \(\) => updateUnsyncedSummary\(\{ preserveStructure: true \}\)/,
  'Markdown feature should pass draft indicator, editor-tree, and summary refresh hooks into the draft boundary'
);

assert.match(
  composerMarkdownDraftsSource,
  /function refreshMarkdownDraftTree\(tab\) \{[\s\S]*refreshEditorContentTree\(\{ preserveStructure: !!\(tab && getCurrentMode\(\) === tab\.mode\) \}\);[\s\S]*async function saveDraftForTab\(tab, saveOptions = \{\}\)[\s\S]*updateComposerMarkdownDraftIndicators\(\{ path: tab\.path \}\);\s*refreshMarkdownDraftTree\(tab\);[\s\S]*function clearDraftForTab\(tab\)[\s\S]*updateComposerMarkdownDraftIndicators\(\{ path: tab\.path \}\);\s*refreshMarkdownDraftTree\(tab\);/,
  'Markdown draft save and clear paths should refresh the editor tree after path-scoped draft indicator updates'
);

assert.match(
  composerMarkdownFeatureSource,
  /createComposerMarkdownDraftController\(\{[\s\S]*consoleRef,[\s\S]*setTimeoutRef: \(handler, delay\) =>\s*typeof editorRuntime\.setTimer === 'function' \? editorRuntime\.setTimer\(handler, delay\) : null,[\s\S]*clearTimeoutRef: \(id\) => safeCall\(editorRuntime\.clearTimer, id\)[\s\S]*\}\)/,
  'Markdown feature should inject Markdown draft logging and autosave timers explicitly'
);

assert.doesNotMatch(
  composerMarkdownDraftsSource,
  /\|\|\s*console\b|typeof (?:setTimeout|clearTimeout)\b|(^|[^.])\b(?:setTimeout|clearTimeout)\s*\(/m,
  'Markdown drafts should receive logging and autosave timers through explicit runtime wiring'
);

assert.match(
  composerEditorWorkspaceFeatureSource,
  /from '\.\/editor-file-tree-ui\.js'/,
  'editor workspace feature should own the extracted editor file tree UI boundary'
);

assert.doesNotMatch(
  source,
  /function renderEditorFileTree|function createEditorTreeIcon|function animateEditorTreeCollapse|function createEditorTreeStatusElement|const collapsingEditorTreeNodeIds|let expandingEditorTreeNodeId/,
  'editor file tree rendering, icons, status badges, and animation state should stay outside the main composer shell'
);

assert.match(
  editorFileTreeUiSource,
  /export function createEditorFileTreeUi\(options = \{\}\)[\s\S]*function createEditorTreeIcon\(node\)[\s\S]*function createEditorTreeStatusElement\(node\)[\s\S]*function animateEditorTreeCollapse\(root, node, row\)[\s\S]*function renderEditorFileTree\(root\)/,
  'editor file tree UI boundary should own tree rendering, collapse animation, status badges, and icons'
);

assert.match(
  composerEditorWorkspaceFeatureSource,
  /from '\.\/editor-structure-panel-ui\.js'/,
  'editor workspace feature should own the extracted editor structure panel UI boundary'
);

assert.doesNotMatch(
  source,
  /function renderEditorStructurePanel|function renderEditorEntryPanel|function renderEditorLanguagePanel|function renderEditorDeletedPanel|function renderEditorWelcomePanel|function createEditorStructureDragController|function appendEditorLanguageControl|function appendLanguageSelector|function makeStructureButton|function renderStructureItem|function availableLanguageCodes|function renderPageLanguageStructure|function moveStructureRootEntry/,
  'editor structure panel rendering and drag UI should stay outside the main composer shell'
);

assert.match(
  editorStructurePanelUiSource,
  /export function createEditorStructurePanelUi\(options = \{\}\)[\s\S]*function createEditorStructureDragController\(list, onMove\)[\s\S]*function renderEditorDeletedPanel\(node, refs\)[\s\S]*function renderEditorWelcomePanel\(refs\)[\s\S]*function renderEditorStructurePanel\(node\)[\s\S]*function renderEditorEntryPanel\(node, refs\)[\s\S]*function renderEditorLanguagePanel\(node, refs\)/,
  'editor structure panel UI boundary should own structure rendering, welcome/deleted panels, and drag controls'
);

assert.doesNotMatch(
  [editorFileTreeUiSource, editorStructurePanelUiSource].join('\n'),
  /const\s+(?:document|window)\s*=|(?:^|[^.])\b(?:setTimeout|requestAnimationFrame|CustomEvent|alert)\s*\(|\bwindow\.__pressPopulateEditorLanguageSelect\b|document\.dispatchEvent/,
  'editor tree and structure UI should use injected refs/adapters for scheduling, alerts, and language-control events'
);

assert.match(
  composerIndexPublishMetadataSource,
  /function getIndexField\(source, keys,[^)]+\)[\s\S]*Object\.prototype\.hasOwnProperty\.call\(input, key\)[\s\S]*function copyExistingIndexFields\(out, existing, keys\)/,
  'index publish metadata enrichment should distinguish omitted front matter from explicit empty fields'
);

assert.match(
  composerIndexPublishMetadataSource,
  /const dateField = getIndexField\(fm, \['date'\][^)]*\);[\s\S]*copyExistingIndexFields\(out, existing, \['date'\]\);[\s\S]*const tagsField = getIndexField\(fm, \['tags', 'tag'\][^)]*\);[\s\S]*copyExistingIndexFields\(out, existing, \['tags', 'tag'\]\);[\s\S]*const imageField = getIndexField\(fm, \['image', 'cover', 'thumb'\][^)]*\);[\s\S]*copyExistingIndexFields\(out, existing, \['image', 'cover', 'thumb'\]\);/,
  'index publish metadata enrichment should preserve curated date, tags, and image fields when front matter omits them'
);

assert.match(
  composerIndexPublishMetadataSource,
  /const aiField = getIndexField\(fm, \['ai', 'aiGenerated', 'llm'\][^)]*\);[\s\S]*copyExistingIndexFields\(out, existing, \['ai', 'aiGenerated', 'llm'\]\);[\s\S]*const draftField = getIndexField\(fm, \['draft', 'wip', 'unfinished', 'inprogress'\][^)]*\);[\s\S]*copyExistingIndexFields\(out, existing, \['draft', 'wip', 'unfinished', 'inprogress'\]\);/,
  'index publish metadata enrichment should preserve AI and draft flags when front matter omits them'
);

assert.match(
  [source, composerMarkdownDraftsSource].join('\n'),
  /const MARKDOWN_DRAFT_STORAGE_KEY = 'press_markdown_editor_drafts_v1';[\s\S]*async function saveDraftForTab\(tab, saveOptions = \{\}\) \{[\s\S]*prepareMarkdownForProtectedStorage\(tab, text[\s\S]*saveDraftEntry\(tab\.path, prepared\.content/,
  'markdown draft persistence should encrypt protected article content before writing draft storage'
);

assert.match(
  composerContentStagingSource,
  /async function getCommitFiles\(options = \{\}\) \{[\s\S]*const prepared = alreadyEncrypted[\s\S]*await prepareMarkdownForProtectedStorage\(tab, text, \{ reason: 'commit' \}\)[\s\S]*content: prepared\.content/,
  'composer commit gathering should stage protected article ciphertext'
);

const protectedPlaintextEntry = {
  kind: 'markdown',
  path: 'wwwroot/post/protected.md',
  content: 'ciphertext'
};

Object.defineProperty(protectedPlaintextEntry, 'plaintextContent', {
  value: 'plain text baseline',
  enumerable: false,
  configurable: true,
  writable: true
});

const protectedStagingRegistry = createStagingRegistry();

protectedStagingRegistry.registerStagingProvider({
  id: 'content',
  getCommitFiles: () => [protectedPlaintextEntry]
});

const protectedStagedResult = await protectedStagingRegistry.getCommitFiles();

assert.equal(
  protectedStagedResult.files[0].plaintextContent,
  'plain text baseline',
  'staging registry should preserve protected markdown plaintext baselines'
);

assert.equal(
  Object.prototype.propertyIsEnumerable.call(protectedStagedResult.files[0], 'plaintextContent'),
  false,
  'staging registry should keep protected plaintext baselines non-enumerable'
);

assert.match(
  [composerMarkdownStateSource, source, composerContentStagingSource].join('\n'),
  /function getLockedEncryptedMarkdownDraft\(tab\) \{[\s\S]*return normalizeMarkdownContent\(draft\.encryptedContent \|\| ''\);[\s\S]*const lockedEncryptedDraft = getLockedEncryptedMarkdownDraft\(tab\);[\s\S]*alreadyEncrypted = true;/,
  'composer commit gathering should preserve locked encrypted draft ciphertext after reload'
);

assert.match(
  [composerMarkdownStateSource, composerMarkdownDraftsSource].join('\n'),
  /function bumpMarkdownDraftSaveGeneration\(tab\) \{[\s\S]*tab\.markdownDraftSaveGeneration = next;[\s\S]*const saveGeneration = getMarkdownDraftSaveGeneration\(tab\);[\s\S]*if \(saveGeneration !== getMarkdownDraftSaveGeneration\(tab\)\) return null;/,
  'composer should cancel stale async encrypted draft saves after discard or tab close'
);

assert.match(
  readIdentitySource('../assets/js/system-updates.js'),
  /from '\.\/markdown\.js'[\s\S]*from '\.\/math-render\.js'[\s\S]*from '\.\/safe-html\.js'/,
  'system update notes should cache-bust Markdown, math renderer, and sanitizer when math rendering changes'
);

assert.notEqual(
  repoInference.resolveEditorStorageScope('https://deemoe404.github.io/test1/index_editor.html'),
  repoInference.resolveEditorStorageScope('https://deemoe404.github.io/test2/index_editor.html'),
  'GitHub project Pages editor state should be scoped by repository path'
);

assert.equal(
  repoInference.resolveEditorStorageScope('https://deemoe404.github.io/index_editor.html'),
  repoInference.resolveEditorStorageScope('https://deemoe404.github.io/index.html'),
  'GitHub user Pages root files should share the user-site storage scope'
);

assert.notEqual(
  repoInference.resolveEditorStorageScope('https://deemoe404.github.io/index.html/'),
  repoInference.resolveEditorStorageScope('https://deemoe404.github.io/index.html'),
  'GitHub project repos named index.html should not share the user-site storage scope'
);

assert.match(
  source,
  /const EDITOR_STORAGE_SCOPE = [\s\S]*resolveEditorStorageScope\(editorRuntime\.getLocation\(\)\)[\s\S]*function scopedEditorStorageKey\(key\) \{[\s\S]*return createScopedStorageKey\(EDITOR_STORAGE_SCOPE, key\);/,
  'composer should derive a site-scoped local storage key suffix through the runtime location boundary'
);

assert.match(
  editorStorageSource,
  /export function createScopedStorageKey\(scope, key\) \{[\s\S]*return `\$\{key\}:\$\{scope \|\| 'unknown'\}`;/,
  'editor storage helper should build scoped local storage keys'
);

assert.match(
  source,
  /createEditorSessionStateStore\(\{[\s\S]*scopeKey: scopedEditorStorageKey,[\s\S]*keys: LS_KEYS/,
  'editor session state should use site-scoped browser storage'
);

assert.match(
  source,
  /createScopedDraftStore\(\{[\s\S]*storageKey: DRAFT_STORAGE_KEY,[\s\S]*scopeKey: scopedEditorStorageKey[\s\S]*createScopedDraftStore\(\{[\s\S]*storageKey: MARKDOWN_DRAFT_STORAGE_KEY,[\s\S]*scopeKey: scopedEditorStorageKey/,
  'composer and markdown draft stores should use site-scoped browser storage'
);

assert.match(
  source,
  /scopedEditorStorageKey\(LS_KEYS\.cfile\)/,
  'active composer file storage should remain site-scoped'
);

assert.match(
  publishSettingsSource,
  /scopeKey[\s\S]*GITHUB_PAT_STORAGE_KEY/,
  'publish settings store should keep the PAT fallback token site-scoped'
);

assert.doesNotMatch(
  publishSettingsSource,
  /typeof window|globalThis/,
  'publish settings store should receive browser storage through explicit window refs instead of ambient globals'
);

{
  const localStorage = createMemoryStorage({
    'press_editor_system_tree_expanded:scope': '1'
  });
  const store = createEditorSessionStateStore({
    storage: localStorage,
    scopeKey: (key) => `${key}:scope`,
    keys: {
      editorState: 'press_composer_editor_state',
      systemTreeExpanded: 'press_editor_system_tree_expanded'
    }
  });
  assert.equal(
    store.readLegacySystemTreeExpanded(),
    true,
    'Recovery should read the legacy system-tree state before a current snapshot exists'
  );
  assert.equal(
    store.writeEditorState({ v: 3, mode: 'editor', expandedNodeIds: ['system'] }),
    true,
    'current editor state should persist through the v3 store'
  );
  assert.equal(
    localStorage.dump()['press_editor_system_tree_expanded:scope'],
    undefined,
    'Recovery should remove the legacy system-tree key only after the current state write succeeds'
  );
  assert.equal(
    store.readUnscopedNumber('press_editor_rail_width', 340),
    340,
    'missing rail width should preserve the default width'
  );
  localStorage.setItem('press_editor_rail_width', '420');
  assert.equal(store.readUnscopedNumber('press_editor_rail_width', 340), 420, 'stored rail width should be restored');
  localStorage.setItem('press_editor_rail_width', 'invalid');
  assert.equal(
    store.readUnscopedNumber('press_editor_rail_width', 340),
    340,
    'invalid rail width should fall back to the default width'
  );
}

{
  const localStorage = createMemoryStorage({
    'press_connect_publish_enabled:scope': '0'
  });
  const sessionStorage = createMemoryStorage();
  const store = createPublishSettingsStore({
    windowRef: { localStorage, sessionStorage },
    scopeKey: (key) => `${key}:scope`
  });
  assert.equal(
    store.getStoredConnectPublishSettings().mode,
    'pat',
    'Recovery should preserve the legacy Connect opt-out'
  );
  assert.equal(
    localStorage.dump()['press_publish_transport_mode:scope'],
    'pat',
    'Recovery should normalize the legacy opt-out into the current transport key'
  );
  assert.equal(
    localStorage.dump()['press_connect_publish_enabled:scope'],
    undefined,
    'Recovery should remove the legacy publish key only after writing the current mode'
  );
  store.setStoredConnectPublishSettings({ baseUrl: 'http://127.0.0.1:8788' });
  assert.equal(
    localStorage.dump()['press_publish_transport_mode:scope'],
    'pat',
    'saving current publish settings should preserve the migrated transport mode'
  );
  assert.equal(
    localStorage.dump()['press_connect_publish_enabled:scope'],
    undefined,
    'saving current publish settings should not restore the retired key'
  );
}

{
  const data = new Map([['press_editor_system_tree_expanded:scope', '1']]);
  const store = createEditorSessionStateStore({
    storage: {
      getItem: (key) => data.get(key) || null,
      setItem: () => false,
      removeItem: (key) => data.delete(key)
    },
    scopeKey: (key) => `${key}:scope`,
    keys: {
      editorState: 'press_composer_editor_state',
      systemTreeExpanded: 'press_editor_system_tree_expanded'
    }
  });
  assert.equal(store.writeEditorState({ v: 3 }), false);
  assert.equal(
    data.get('press_editor_system_tree_expanded:scope'),
    '1',
    'failed current-state writes must preserve the legacy editor key'
  );
}

{
  const data = new Map([['press_connect_publish_enabled:scope', '0']]);
  const localStorage = {
    getItem: (key) => data.get(key) || null,
    setItem(key, value) {
      if (key === 'press_publish_transport_mode:scope') throw new Error('storage full');
      data.set(key, String(value));
    },
    removeItem: (key) => data.delete(key)
  };
  const store = createPublishSettingsStore({
    windowRef: { localStorage, sessionStorage: createMemoryStorage() },
    scopeKey: (key) => `${key}:scope`
  });
  assert.equal(store.getStoredConnectPublishSettings().mode, 'pat');
  assert.equal(
    data.get('press_connect_publish_enabled:scope'),
    '0',
    'failed mode writes must preserve the legacy publish preference'
  );
}

{
  const ambientCalls = [];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem() {
          ambientCalls.push('window.localStorage.getItem');
          return null;
        }
      },
      sessionStorage: {
        getItem() {
          ambientCalls.push('window.sessionStorage.getItem');
          return null;
        }
      }
    }
  });
  try {
    const store = createPublishSettingsStore({ scopeKey: (key) => `${key}:scope` });
    assert.equal(store.getCachedFineGrainedToken(), '');
    store.setCachedFineGrainedToken('memory-token');
    assert.equal(store.getCachedFineGrainedToken(), 'memory-token');
    assert.equal(store.getStoredConnectPublishSettings().mode, 'connect');
    assert.deepEqual(ambientCalls, [], 'publish settings store should not read ambient window storage');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
  }
}

assert.deepEqual(
  repoInference.inferRepoConfigFromGitHubPagesUrl('https://deemoe404.github.io/test1/index_editor.html'),
  { owner: 'deemoe404', name: 'test1', branch: 'main' },
  'GitHub project Pages editor URLs should infer owner and repository'
);

assert.deepEqual(
  repoInference.inferRepoConfigFromGitHubPagesUrl('https://deemoe404.github.io/test1/'),
  { owner: 'deemoe404', name: 'test1', branch: 'main' },
  'GitHub project Pages root URLs should infer owner and repository'
);

assert.deepEqual(
  repoInference.inferRepoConfigFromGitHubPagesUrl('https://deemoe404.github.io/index_editor.html'),
  { owner: 'deemoe404', name: 'deemoe404.github.io', branch: 'main' },
  'GitHub user Pages editor URLs should infer the owner.github.io repository'
);

assert.deepEqual(
  repoInference.inferRepoConfigFromGitHubPagesUrl('https://deemoe404.github.io/index.html'),
  { owner: 'deemoe404', name: 'deemoe404.github.io', branch: 'main' },
  'GitHub user Pages root index URLs should infer the owner.github.io repository'
);

assert.deepEqual(
  repoInference.inferRepoConfigFromGitHubPagesUrl('https://deemoe404.github.io/index.html/'),
  { owner: 'deemoe404', name: 'index.html', branch: 'main' },
  'GitHub project Pages repos named index.html should not be treated as user Pages root files'
);

assert.deepEqual(
  repoInference.inferRepoConfigFromGitHubPagesUrl('https://deemoe404.github.io/index_editor.html/index_editor.html'),
  { owner: 'deemoe404', name: 'index_editor.html', branch: 'main' },
  'GitHub project Pages repos named index_editor.html should not be treated as user Pages root files'
);

assert.equal(
  repoInference.inferRepoConfigFromGitHubPagesUrl('http://localhost:8000/index_editor.html'),
  null,
  'localhost editor URLs should not infer a repository'
);

assert.equal(
  repoInference.inferRepoConfigFromGitHubPagesUrl('https://example.com/index_editor.html'),
  null,
  'custom-domain editor URLs should not infer a repository'
);

{
  const site = { repo: { owner: 'OWNER', name: 'REPOSITORY', branch: '' } };
  assert.equal(
    repoInference.applyInferredRepoConfig(site, { owner: 'deemoe404', name: 'test1', branch: 'main' }),
    true,
    'placeholder starter repositories should accept inferred repo config'
  );
  assert.deepEqual(site.repo, { owner: 'deemoe404', name: 'test1', branch: 'main' });
}

{
  const site = { repo: { owner: '', name: '', branch: 'docs' } };
  assert.equal(
    repoInference.applyInferredRepoConfig(site, { owner: 'deemoe404', name: 'test1', branch: 'main' }),
    true,
    'empty starter repositories should accept inferred owner and name'
  );
  assert.deepEqual(site.repo, { owner: 'deemoe404', name: 'test1', branch: 'docs' });
}

{
  const site = { repo: { owner: 'EkilyHQ', name: 'YAP', branch: 'main' } };
  assert.equal(
    repoInference.applyInferredRepoConfig(site, { owner: 'deemoe404', name: 'test1', branch: 'main' }),
    false,
    'real YAP repository settings should be preserved without an explicit autofill marker'
  );
  assert.deepEqual(site.repo, { owner: 'EkilyHQ', name: 'YAP', branch: 'main' });
}

{
  const site = {
    repo: { owner: 'EkilyHQ', name: 'YAP', branch: 'main' },
    __extras: { repoAutofillFromPages: true }
  };
  assert.equal(
    repoInference.applyInferredRepoConfig(site, { owner: 'deemoe404', name: 'test1', branch: 'main' }),
    true,
    'explicit repo autofill markers should accept inferred repo config on derived Pages sites'
  );
  assert.deepEqual(site.repo, { owner: 'deemoe404', name: 'test1', branch: 'main' });
  assert.deepEqual(site.__extras, {}, 'repo autofill marker should be removed after first use');
}

{
  const site = {
    repo: { owner: 'EkilyHQ', name: 'YAP', branch: 'main' },
    __extras: { repoAutofillFromPages: true }
  };
  assert.equal(
    repoInference.applyInferredRepoConfig(site, { owner: 'ekilyhq', name: 'YAP', branch: 'main' }),
    false,
    'repo autofill markers should not dirty sites when the URL already matches'
  );
  assert.deepEqual(site.repo, { owner: 'EkilyHQ', name: 'YAP', branch: 'main' });
  assert.deepEqual(site.__extras, { repoAutofillFromPages: true });
}

{
  const site = { repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' } };
  assert.equal(
    repoInference.applyInferredRepoConfig(site, { owner: 'deemoe404', name: 'test1', branch: 'main' }),
    false,
    'real configured repositories should not be overwritten'
  );
  assert.deepEqual(site.repo, { owner: 'EkilyHQ', name: 'Press', branch: 'main' });
}

assert.match(
  source,
  /export function createComposerController\(editorRuntime = createComposerRuntime\(\)\)[\s\S]*const composerStartupOptions = \{[\s\S]*loadDraftSnapshotsIntoState,[\s\S]*applyInferredRepoConfig,[\s\S]*inferRepoConfigFromGitHubPagesUrl,[\s\S]*applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,[\s\S]*buildIndexUI,[\s\S]*buildTabsUI,[\s\S]*buildSiteUI,[\s\S]*function start\(\) \{[\s\S]*return startComposerApp\(composerStartupOptions\);[\s\S]*createComposerController\(\)\.start\(\);/,
  'composer should wire inferred starter repository config into the extracted workspace assembly before rendering through YAML feature ports'
);

assert.doesNotMatch(
  source,
  /composerIndexTabsUi|composerSiteSettingsUi/,
  'composer startup should not reference YAML/site feature-private UI instances'
);

assert.match(
  composerBootstrapSource,
  /function createComposerAppOptions\(options = \{\}\)[\s\S]*ensureSiteRepo: \(\) =>\s*typeof editorRuntime\.ensureSiteRepo === 'function'[\s\S]*getLocation: \(\) =>\s*\(?typeof editorRuntime\.getLocation === 'function'[\s\S]*bindWorkspaceUi: \(\) =>\s*bindComposerWorkspaceUi\(\{[\s\S]*setAllowEditorStatePersist: \(value\) =>\s*typeof editorRuntime\.setAllowEditorStatePersist === 'function'[\s\S]*setTimeoutRef: \(handler, delay\) =>\s*typeof editorRuntime\.setTimer === 'function'/,
  'composer bootstrap should own explicit runtime-backed defaults for site repo, location, workspace UI, persistence, and timers'
);

assert.match(
  composerBootstrapSource,
  /const restoredDrafts = loadDraftSnapshotsIntoState\(state\);[\s\S]*applyInferredRepoConfig\([\s\S]*inferRepoConfigFromGitHubPagesUrl\(getLocation\(\)\)[\s\S]*applyEffectiveSiteConfig\(state\.site\);[\s\S]*buildSiteUI\(effects\.getElementById\(EDITOR_SHELL_IDS\.composerSite\), state\);[\s\S]*notifyComposerChange\('site', inferredSiteRepoApplied \? \{\} : \{ skipAutoSave: true \}\);/,
  'composer should mark inferred site repo changes dirty while preserving normal initialization behavior'
);

assert.match(
  composerPublishSummarySource,
  /function openGithubCommitFilePreview\(file, triggerEl\) \{[\s\S]*previewDialog\.appendChild\(head\);[\s\S]*pre\.className = 'github-preview-code';[\s\S]*previewDialog\.appendChild\(pre\);[\s\S]*previewModal\.appendChild\(previewDialog\);/,
  'GitHub pending-file preview should append code directly to the dialog without extra content wrappers'
);

assert.doesNotMatch(
  composerPublishSummarySource,
  /github-preview-body|github-preview-content|github-preview-path/,
  'GitHub pending-file preview should not render the removed body, content, or repeated path wrappers'
);

assert.match(
  nativeBaseSource,
  /\.github-preview-code \{[\s\S]*margin: 0;[\s\S]*white-space: pre-wrap;[\s\S]*word-break: break-word;/,
  'GitHub pending-file preview code block should render directly without owning a nested scroll area'
);

assert.doesNotMatch(
  nativeBaseSource,
  /\.github-preview-code \{[^}]*\b(?:max-height|overflow):/,
  'GitHub pending-file preview should rely on the modal dialog scroll container'
);

assert.match(
  editorSource,
  /class="vt-btn active" data-view="blocks"[\s\S]*class="vt-btn" data-view="edit"[\s\S]*id="blocks-wrap" hidden aria-hidden="true"/,
  'markdown editor should expose Blocks and Editor views with a dedicated blocks surface'
);

assert.match(
  editorMainWorkspaceSessionSource,
  /const switchView = \(mode\) => \{[\s\S]*const nextView = normalizeMarkdownEditorView\(mode\);[\s\S]*nextView === 'blocks'[\s\S]*editorWrap\.style\.display = 'none';[\s\S]*blocksWrap\.hidden = false;[\s\S]*editorToolbar\.hidden = true;[\s\S]*viewToggle\.dataset\.view = 'blocks';/,
  'workspace session view switcher should show blocks mode while hiding source toolbar'
);

assert.match(
  editorMainRuntimeSource,
  /const LS_VIEW_KEY = 'press_editor_markdown_view_v2';[\s\S]*function readMarkdownEditorView\(\) \{[\s\S]*runtime\.storage\.getItem\(LS_VIEW_KEY\)[\s\S]*function persistMarkdownEditorView\(mode\) \{[\s\S]*runtime\.storage\.setItem\(LS_VIEW_KEY, normalizeMarkdownEditorView\(mode\)\);/,
  'editor main runtime should persist the selected source/blocks view'
);

assert.match(
  editorMainWorkspaceSessionSource,
  /const readPersistedView = \(\) => \{[\s\S]*runtime\.readMarkdownEditorView\(\);[\s\S]*const persistView = \(mode\) => \{[\s\S]*runtime\.persistMarkdownEditorView\(mode\);/,
  'workspace session should route markdown view persistence through the runtime boundary'
);

assert.match(
  editorMainWorkspaceSessionSource,
  /const setView = \(mode, opts = \{\}\) => \{[\s\S]*if \(mode === 'preview'\)[\s\S]*const nextView = switchView\(mode\);[\s\S]*if \(opts\.persist\) persistView\(nextView\);[\s\S]*setView\(button\.dataset\.view, \{ persist: true \}\);/,
  'workspace session view switcher clicks should store the selected edit or blocks view'
);

// composer-identity-body:end
