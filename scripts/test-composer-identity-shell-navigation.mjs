import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerSystemPanelSource = readIdentitySource('../assets/js/composer-system-panel.js');

const composerIndexTabsModelSource = readIdentitySource('../assets/js/composer-index-tabs-model.js');

const composerDiffUiSource = readIdentitySource('../assets/js/composer-diff-ui.js');

const composerEditorWorkspaceFeatureSource = readIdentitySource('../assets/js/composer-editor-workspace-feature.js');

const composerEditorShellSource = readIdentitySource('../assets/js/composer-editor-shell.js');

const composerModeControllerSource = readIdentitySource('../assets/js/composer-mode-controller.js');

const composerBootstrapSource = readIdentitySource('../assets/js/composer-bootstrap.js');

const composerEditorTreeStateSource = readIdentitySource('../assets/js/composer-editor-tree-state.js');

const editorContentTreeControllerSource = readIdentitySource('../assets/js/editor-content-tree-controller.js');

const composerMarkdownSessionSource = readIdentitySource('../assets/js/composer-markdown-session.js');

const composerMarkdownWorkspaceSource = readIdentitySource('../assets/js/composer-markdown-workspace.js');

const editorMainSource = readIdentitySource('../assets/js/editor-main.js');

const editorMainCurrentFileSessionSource = readIdentitySource('../assets/js/editor-main-current-file-session.js');

const editorMainCurrentFileViewSource = readIdentitySource('../assets/js/editor-main-current-file-view.js');

const editorSource = readIdentitySource('../index_editor.html');

const enI18nSource = readIdentitySource('../assets/i18n/en.js');

const chsI18nSource = readIdentitySource('../assets/i18n/chs.js');

const chtTwI18nSource = readIdentitySource('../assets/i18n/cht-tw.js');

const chtHkI18nSource = readIdentitySource('../assets/i18n/cht-hk.js');

const jaI18nSource = readIdentitySource('../assets/i18n/ja.js');

// composer-identity-body:start

[enI18nSource, chsI18nSource, chtTwI18nSource, chtHkI18nSource, jaI18nSource].forEach((i18nText, index) => {
  assert.match(
    i18nText,
    /status:\s*\{[\s\S]*added:[\s\S]*modified:[\s\S]*deleted:[\s\S]*checking:[\s\S]*changedCount:[\s\S]*changedSummary:[\s\S]*orderChanged:[\s\S]*deletedSummary:/,
    `locale ${index} should expose editor tree status badge text`
  );
});

[enI18nSource, chsI18nSource, chtTwI18nSource, jaI18nSource].forEach((i18nText, index) => {
  assert.match(
    i18nText,
    /replaceImage:[\s\S]*deleteImageResource:/,
    `locale ${index} should expose image replacement and resource deletion toolbar text`
  );
  assert.match(
    i18nText,
    /assetDeleteUnsupported:[\s\S]*assetDeleteShared:[\s\S]*assetDeleteRejected:[\s\S]*assetPendingRemoved:[\s\S]*assetDeleteStaged:/,
    `locale ${index} should expose image resource deletion toast text`
  );
});

assert.doesNotMatch(editorSource, /id="modeDynamicTabs"/, 'editor should not render visible dynamic markdown tabs');

assert.doesNotMatch(
  editorSource,
  /data-cfile="index"|data-cfile="tabs"|id="btnAddItem"/,
  'site settings should not expose Articles/Pages file switching or Add Post Entry controls'
);

assert.match(
  composerDiffUiSource,
  /function getComposerDiffChangeCount\(diff\) \{[\s\S]*Object\.keys\(diff\.fields\)[\s\S]*Object\.keys\(diff\.keys\)[\s\S]*diff\.orderChanged/,
  'composer file dirty badges should derive a numeric count from the current diff'
);

assert.match(
  composerDiffUiSource,
  /function updateFileDirtyBadge\(kind\) \{[\s\S]*const changeCount = getComposerDiffChangeCount\(diff\);[\s\S]*badge\.textContent = displayValue;[\s\S]*el\.dataset\.dirtyCount = String\(changeCount\);/,
  'composer file switch dirty badges should render the change count into the button'
);

assert.match(
  composerEditorWorkspaceFeatureSource,
  /import \{ findEditorContentTreeNode, flattenEditorContentTree \} from '\.\/editor-content-tree\.js';/,
  'editor workspace feature should use the shared editor content tree navigation helpers'
);

assert.match(
  composerEditorTreeStateSource,
  /import \{ buildEditorContentTree \} from '\.\/editor-content-tree\.js';/,
  'composer editor tree state should own shared tree construction'
);

assert.match(
  composerIndexTabsModelSource,
  /function diffVersionLists\(currentValue, baselineValue\) \{[\s\S]*restoreValue: cloneIndexMetadataValue\(item\)[\s\S]*removed\.push\(\{[\s\S]*value: baseItems\[i\]\.path \|\| '',[\s\S]*restoreValue: baseItems\[i\]\.restoreValue,/,
  'article version diffs should preserve rich baseline metadata for deleted-version restore'
);

assert.match(
  source,
  /from '\.\/composer-markdown-session\.js'/,
  'composer should cache-bust the extracted Markdown session boundary'
);

assert.doesNotMatch(
  source,
  /const dynamicEditorTabs = new Map\(\)|const dynamicEditorTabsByLookupKey = new Map\(\)|let dynamicTabCounter|let activeDynamicMode = null|let activeMarkdownDocument = null|function deriveDynamicTabIdentity/,
  'dynamic markdown tab maps, active document state, and identity derivation should stay outside the main composer shell'
);

assert.match(
  composerMarkdownSessionSource,
  /export function createComposerMarkdownSessionController\(options = \{\}\)[\s\S]*const tabs = new Map\(\);[\s\S]*const tabsByLookupKey = new Map\(\);[\s\S]*let activeDynamicMode = null;[\s\S]*let activeMarkdownDocument = null;[\s\S]*function deriveDynamicTabIdentity\(path, identityOptions = \{\}\)/,
  'Markdown session controller should own dynamic tabs, active document state, and stable identity derivation'
);

assert.match(
  source,
  /createComposerMarkdownSessionController\(\{[\s\S]*requestAnimationFrameRef: \(fn\) => editorRuntime\.requestFrame\(fn\),[\s\S]*alertRef: \(message\) => editorRuntime\.showAlert\(message\),[\s\S]*confirmRef: \(message\) => editorRuntime\.confirmAction\(message\),[\s\S]*consoleRef: composerLogger,/,
  'composer should inject Markdown session frames, dialogs, and logging through the runtime boundary'
);

assert.doesNotMatch(
  composerMarkdownSessionSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\brequestAnimationFrame\s*\(/m,
  'Markdown session controller should use injected frame and dialog adapters'
);

assert.doesNotMatch(
  source,
  /function renderPageLanguageStructure\(key, lang, value\) \{[\s\S]*treeText\('fieldTitle', 'Title'\)/,
  'page structure rows should no longer render a standalone title field label'
);

const initialBootIndex = source.indexOf('Apply initial state as early as possible');

const initialBootBlock =
  initialBootIndex >= 0
    ? source.slice(initialBootIndex, source.indexOf('// Robust clipboard helper', initialBootIndex))
    : '';

assert.doesNotMatch(
  initialBootBlock,
  /applyMode\('composer'\)/,
  'initial editor boot should not force Site Settings before the file tree is rendered'
);

assert.match(
  composerMarkdownSessionSource,
  /function getOrCreateDynamicMode\(path, tabOptions = \{\}\) \{[\s\S]*const identity = deriveDynamicTabIdentity\(path, tabOptions\);[\s\S]*const existing = tabsByLookupKey\.get\(identity\.lookupKey\);[\s\S]*button: null,[\s\S]*tabs\.set\(modeId, data\);[\s\S]*tabsByLookupKey\.set\(identity\.lookupKey, modeId\);/,
  'markdown document state should no longer create visible dynamic tab buttons'
);

assert.match(
  composerMarkdownSessionSource,
  /function openMarkdownInEditor\(path, openOptions = \{\}\) \{[\s\S]*flushMarkdownDraft\(active\);[\s\S]*const modeId = getOrCreateDynamicMode\(path, openOptions\);[\s\S]*applyMode\(modeId\);/,
  'switching files from the tree should flush the current markdown draft before opening the next file'
);

assert.match(
  composerMarkdownSessionSource,
  /function persistEditorState\(\) \{[\s\S]*const open = valuesFromMap\(tabs\)[\s\S]*lookupKey: tab\.lookupKey \|\| tab\.path,[\s\S]*path: tab\.path,[\s\S]*activeLookupKey: active && \(active\.lookupKey \|\| active\.path\) \? \(active\.lookupKey \|\| active\.path\) : null,[\s\S]*activePath: active && active\.path \? active\.path : null,[\s\S]*expandedNodeIds: getExpandedNodeIdsSnapshot\(\),/,
  'dynamic markdown session state should persist opened files with stable lookup keys, plus active file identity and exact tree expansion'
);

assert.match(
  composerMarkdownSessionSource,
  /function restoreEditorState\(\) \{[\s\S]*const open = Array\.isArray\(data\.open\) \? data\.open : \[\];[\s\S]*const lookupKey = item && typeof item === 'object'[\s\S]*const path = item && typeof item === 'object'[\s\S]*getOrCreateDynamicMode\(path, \{[\s\S]*source:[\s\S]*key:[\s\S]*lang:[\s\S]*editorTreeNodeId:[\s\S]*lookupKey[\s\S]*\}\);[\s\S]*restoreExpandedNodeIds\(data\.expandedNodeIds\);[\s\S]*const activeLookupKey = String\(data\.activeLookupKey \|\| ''\)\.trim\(\);[\s\S]*const activePath = data\.activePath \? normalizeRelPath\(data\.activePath\) : '';[\s\S]*if \(\(isV3 \? data\.mode === 'markdown' : true\) && \(activeLookupKey \|\| activePath\)\) \{[\s\S]*const modeId = \(activeLookupKey && tabsByLookupKey\.get\(activeLookupKey\)\)[\s\S]*\|\| \(activePath && tabsByLookupKey\.get\(activePath\)\)[\s\S]*\|\| \(activePath \? getOrCreateDynamicMode\(activePath\) : null\);[\s\S]*applyMode\(modeId, \{ preserveTreeExpansion: true, restoreScroll: true \}\);/,
  'dynamic markdown session restore should recreate open files and active file identity with stable lookup keys'
);

assert.match(
  composerBootstrapSource,
  /refreshEditorContentTree\(\);\s*const restoredEditorState = restoreDynamicEditorState\(\);\s*if \(!restoredEditorState\) applyMode\('editor'\);\s*setAllowEditorStatePersist\(true\);/,
  'editor boot should restore dynamic markdown session state before falling back to the file tree'
);

assert.match(
  editorSource,
  /\.current-file \.cf-breadcrumb \{[\s\S]*gap:\.35rem;[\s\S]*\.current-file \.cf-breadcrumb-separator \{[\s\S]*margin:0 -\.35rem;[\s\S]*\.current-file \.cf-breadcrumb-item \{[\s\S]*color:#57606a;[\s\S]*\.current-file \.cf-breadcrumb-item-current \{[\s\S]*background:transparent;[\s\S]*color:var\(--text\);/,
  'current file indicator should render static gray breadcrumbs with a darker current item'
);

assert.doesNotMatch(
  `${editorMainSource}\n${editorMainCurrentFileSessionSource}\n${editorMainCurrentFileViewSource}`,
  /<button type="button" class="cf-breadcrumb-item/,
  'current file breadcrumb should not use native buttons that inherit the bordered toolbar style'
);

assert.doesNotMatch(
  `${editorMainSource}\n${editorMainCurrentFileSessionSource}\n${editorMainCurrentFileViewSource}`,
  /<a href="#" class="cf-breadcrumb-item\$\{currentClass\}"[\s\S]*data-current-file-node-id=/,
  'current file breadcrumb should no longer render clickable links'
);

assert.match(
  editorMainCurrentFileViewSource,
  /export function normalizeCurrentFileBreadcrumb\(value, fallbackPath = ''\) \{[\s\S]*const renderCurrentFileBreadcrumb = \(items, fullPath\) => \{[\s\S]*<span class="cf-breadcrumb-item cf-breadcrumb-item-static\$\{currentClass\}"\$\{ariaCurrent\}>/,
  'current file indicator should normalize and emit static breadcrumb entries'
);

assert.match(
  editorContentTreeControllerSource,
  /function buildCurrentFileBreadcrumb\(tab\) \{[\s\S]*ids\.push\('articles', `index:\$\{node\.key\}`, `index:\$\{node\.key\}:\$\{node\.lang\}`, node\.id\);/,
  'editor content tree controller should pass abstract article/page breadcrumb segments to the editor header'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /breadcrumb: buildCurrentFileBreadcrumb\(tab\),/,
  'Markdown workspace should include the current file breadcrumb in the editor header payload'
);

assert.match(
  source,
  /press-editor-current-file-breadcrumb-select[\s\S]*handleEditorTreeSelection\(nodeId\);/,
  'composer should route current-file breadcrumb clicks through the editor tree selection handler'
);

assert.match(
  composerModeControllerSource,
  /function applyMode\(mode, optionsForMode = \{\}\) \{[\s\S]*mode === 'editor' && getDynamicEditorTabs\(\)\.size && !optionsForMode\.forceStructure/,
  'editor structure selection should be able to bypass dynamic markdown document restoration through the mode controller'
);

assert.match(
  composerSystemPanelSource,
  /export function showEditorSystemPanel\(mode, deps = \{\}\) \{[\s\S]*mode === 'sync' \? 'sync'[\s\S]*EDITOR_SHELL_IDS\.editorSystemActions[\s\S]*EDITOR_SHELL_IDS\.editorModalThemeActions[\s\S]*EDITOR_SHELL_IDS\.editorModalSyncActions[\s\S]*EDITOR_SHELL_IDS\.modeComposer[\s\S]*EDITOR_SHELL_IDS\.modeThemes[\s\S]*EDITOR_SHELL_IDS\.modeUpdates[\s\S]*EDITOR_SHELL_IDS\.modeSync[\s\S]*\['themes', themeActions\][\s\S]*\['sync', syncActions\]/,
  'Site Settings, Themes, Press Updates, and Sync should render through the inline system panel'
);

const showEditorSystemPanelBody = composerSystemPanelSource;

assert.doesNotMatch(
  showEditorSystemPanelBody,
  /actions\.innerHTML = ''/,
  'switching inline system panels should not destroy migrated action buttons'
);

assert.match(
  showEditorSystemPanelBody,
  /if \(actionSet\.parentElement !== actions\) actions\.appendChild\(actionSet\);[\s\S]*actionSet\.hidden = !active;/,
  'inline system panel actions should be reparented without deleting the ZIP selection button'
);

assert.match(
  composerModeControllerSource,
  /export function isComposerSystemMode\(value\) \{[\s\S]*value === 'composer' \|\| value === 'themes' \|\| value === 'updates' \|\| value === 'sync'[\s\S]*function setSystemDetailMode\(nextMode, optionsForMode = \{\}\)[\s\S]*setEditorDetailPanelMode\(nextMode\);[\s\S]*function normalizeMode\(candidate\) \{[\s\S]*isComposerSystemMode\(candidate\)/,
  'opening Site Settings, Themes, Press Updates, or Sync should switch to the inline system detail panel through the mode controller'
);

const refreshEditorContentTreeBody = source.slice(
  source.indexOf('function refreshEditorContentTree(options = {}) {'),
  source.indexOf('function handleEditorTreeSelection(nodeId)')
);

assert.doesNotMatch(
  refreshEditorContentTreeBody,
  /currentMode === 'composer' \|\| currentMode === 'updates'[\s\S]*setEditorDetailPanelMode\(currentMode\)/,
  'refreshing tree badges while editing site settings should not replay the inline system panel animation'
);

assert.match(
  composerEditorShellSource,
  /function initEditorRailResize\(\) \{[\s\S]*EDITOR_RAIL_WIDTH_KEY[\s\S]*pointerdown[\s\S]*setEditorRailWidth\([^)]*\{ persist: true \}/,
  'desktop editor rail shell module should be resizable and persist its width'
);

assert.match(
  composerEditorShellSource,
  /function getEditorRailToggles\(\) \{[\s\S]*documentRef\.querySelectorAll\(EDITOR_SHELL_SELECTORS\.editorRailToggle\)[\s\S]*function setEditorRailOpen\(open\) \{[\s\S]*const toggles = getEditorRailToggles\(\);[\s\S]*toggles\.forEach\(\(toggle\) => \{[\s\S]*toggle\.setAttribute\('aria-expanded', shouldOpen \? 'true' : 'false'\);[\s\S]*function initMobileEditorRail\(\) \{[\s\S]*const toggles = getEditorRailToggles\(\);[\s\S]*if \(!toggles\.length\) return;[\s\S]*toggles\.forEach\(\(toggle\) => \{[\s\S]*toggle\.addEventListener\('click', \(\) => \{[\s\S]*setEditorRailOpen\(!isOpen\);/,
  'mobile editor rail shell module should bind every shared drawer toggle and sync expanded state'
);

assert.match(
  editorContentTreeControllerSource,
  /function handleSelection\(nodeId\) \{[\s\S]*applyMode\('editor', \{ forceStructure: true \}\);[\s\S]*refresh\(\);/,
  'editor content tree controller should hide the markdown editor and show the structure panel for non-file tree nodes'
);

assert.doesNotMatch(
  source,
  /dataset\.fileLabel/,
  'composer file switch dirty labels should not cache translated tab text across language changes'
);

assert.match(
  source,
  /function refreshEditorLanguageUi\(\) \{[\s\S]*refreshFileDirtyBadges\(\);[\s\S]*refreshEditorContentTree\([\s\S]*editorRuntime\.events\.onDocument\('press-editor-language-applied', refreshEditorLanguageUi\)/,
  'composer file switch dirty labels and tree panels should be recomputed after editor language changes'
);

// composer-identity-body:end
