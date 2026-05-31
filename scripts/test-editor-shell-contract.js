import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EDITOR_SHELL_IDS,
  EDITOR_SHELL_SELECTORS,
  countEditorShellSelector,
  validateEditorShellContract
} from '../assets/js/editor-shell-contract.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

const editorHtml = read('index_editor.html');
const composerBootstrap = read('assets/js/composer-bootstrap.js');
const composerContentMutations = read('assets/js/composer-content-mutations.js');
const composerDiffUi = read('assets/js/composer-diff-ui.js');
const composerEditorShell = read('assets/js/composer-editor-shell.js');
const composerFilePanel = read('assets/js/composer-file-panel-controller.js');
const composerIndexTabsUi = read('assets/js/composer-index-tabs-ui.js');
const composerMarkdownActionsUi = read('assets/js/composer-markdown-actions-ui.js');
const composerModeController = read('assets/js/composer-mode-controller.js');
const composerOrderPreview = read('assets/js/composer-order-preview.js');
const composerSiteSettingsSectionNav = read('assets/js/composer-site-settings-section-nav.js');
const composerSyncCommitController = read('assets/js/composer-sync-commit-controller.js');
const composerSystemPanel = read('assets/js/composer-system-panel.js');
const composerUnsyncedSummary = read('assets/js/composer-unsynced-summary.js');
const composerYamlPanels = read('assets/js/composer-yaml-panels-controller.js');
const themeManager = read('assets/js/theme-manager.js');
const systemUpdates = read('assets/js/system-updates.js');
const shellContract = read('assets/js/editor-shell-contract.js');

assert.deepEqual(
  validateEditorShellContract(editorHtml),
  [],
  'static editor shell should satisfy the shared JS selector contract'
);

assert.equal(EDITOR_SHELL_IDS.btnPushMarkdown, 'btnPushMarkdown');
assert.equal(EDITOR_SHELL_IDS.modeThemes, 'mode-themes');
assert.equal(EDITOR_SHELL_SELECTORS.composerFileTabs, 'a.vt-btn[data-cfile]');
assert.equal(countEditorShellSelector(editorHtml, EDITOR_SHELL_SELECTORS.themeManagerTabs) >= 2, true);

assert.match(composerBootstrap, /from '\.\/editor-shell-contract\.js'/);
assert.match(composerBootstrap, /EDITOR_SHELL_IDS\.btnPushMarkdown/);
assert.match(composerBootstrap, /EDITOR_SHELL_SELECTORS\.composerFileTabs/);
assert.doesNotMatch(
  composerBootstrap,
  /getElementById\('(?:btnPushMarkdown|btnSaveMarkdown|btnProtectMarkdown|btnDiscardMarkdown|composerIndex|composerTabs|composerSite)'/,
  'composer bootstrap should bind stable shell nodes through shared shell ids'
);

assert.match(composerFilePanel, /from '\.\/editor-shell-contract\.js'/);
assert.match(composerFilePanel, /EDITOR_SHELL_SELECTORS\.composerFileTabs/);
assert.match(composerFilePanel, /EDITOR_SHELL_IDS\.composerIndexHost/);
assert.doesNotMatch(
  composerFilePanel,
  /'a\.vt-btn\[data-cfile\]'|getElement\(documentRef, '(?:btnAddItem|composerIndex|composerTabs|composerSite|composerIndexHost|composerTabsHost|composerSiteHost)'/,
  'composer file panel should bind shell nodes through shared shell ids and selectors'
);

assert.match(composerMarkdownActionsUi, /from '\.\/editor-shell-contract\.js'/);
assert.match(composerMarkdownActionsUi, /EDITOR_SHELL_IDS\.btnPushMarkdown/);
assert.doesNotMatch(
  composerMarkdownActionsUi,
  /queryButton\('(?:btnPushMarkdown|btnDiscardMarkdown|btnSaveMarkdown|btnProtectMarkdown)'/,
  'composer Markdown actions UI should bind toolbar buttons through shared shell ids'
);

assert.match(composerUnsyncedSummary, /from '\.\/editor-shell-contract\.js'/);
assert.match(composerUnsyncedSummary, /EDITOR_SHELL_IDS\.btnReview/);
assert.match(composerUnsyncedSummary, /EDITOR_SHELL_SELECTORS\.modeTabs/);
assert.doesNotMatch(
  composerUnsyncedSummary,
  /getElementById\('(?:btnReview|btnDiscard)'|querySelector\(`\.mode-tab/,
  'composer unsynced summary should bind shell controls through shared shell ids and selectors'
);

[
  ['composer content mutations', composerContentMutations],
  ['composer diff UI', composerDiffUi],
  ['composer editor shell', composerEditorShell],
  ['composer index/tabs UI', composerIndexTabsUi],
  ['composer mode controller', composerModeController],
  ['composer order preview', composerOrderPreview],
  ['composer site settings section nav', composerSiteSettingsSectionNav],
  ['composer sync commit controller', composerSyncCommitController],
  ['composer system panel', composerSystemPanel],
  ['composer YAML panels', composerYamlPanels]
].forEach(([label, source]) => {
  assert.match(source, /from '\.\/editor-shell-contract\.js'/, `${label} should import shared shell ids/selectors`);
  assert.doesNotMatch(
    source,
    /'(?:composerIndex|composerTabs|composerSite|composerIndexHost|composerTabsHost|composerSiteHost|mode-editor|mode-composer|mode-themes|mode-updates|mode-sync|editorSystemPanel|editorSystemTitle|editorSystemKicker|editorSystemMeta|editorSystemActions|editorSystemBody|editorModalComposerActions|editorModalThemeActions|editorModalUpdateActions|editorModalSyncActions|editorModalLayer|editorModalTitle|editorRailResizer|editorAppShell|editorRailScrim|editorContentPane|ciList|ctList|composerOrderInlineMeta)'|"(?:composerIndex|composerTabs|composerSite|composerIndexHost|composerTabsHost|composerSiteHost|mode-editor|mode-composer|mode-themes|mode-updates|mode-sync|editorSystemPanel|editorSystemTitle|editorSystemKicker|editorSystemMeta|editorSystemActions|editorSystemBody|editorModalComposerActions|editorModalThemeActions|editorModalUpdateActions|editorModalSyncActions|editorModalLayer|editorModalTitle|editorRailResizer|editorAppShell|editorRailScrim|editorContentPane|ciList|ctList|composerOrderInlineMeta)"|a\.vt-btn\[data-cfile\]|\.editor-modal-body|\.cs-viewport|queryAll\('\.mode-tab|query\('#mode/,
    `${label} should not embed stable editor shell ids/selectors directly`
  );
});

assert.match(themeManager, /from '\.\/editor-shell-contract\.js'/);
assert.match(themeManager, /EDITOR_SHELL_IDS\.themeManagerStatus/);
assert.match(themeManager, /EDITOR_SHELL_SELECTORS\.themeManagerTabs/);
assert.doesNotMatch(
  themeManager,
  /getElementById\('(?:mode-themes|themeManagerStatus|btnThemeImport)'|querySelectorAll\('\[data-theme-manager-view\]'/,
  'Theme Manager should bind shell nodes through shared shell ids and selectors'
);

assert.match(systemUpdates, /from '\.\/editor-shell-contract\.js'/);
assert.match(systemUpdates, /EDITOR_SHELL_IDS\.systemUpdateStatus/);
assert.doesNotMatch(
  systemUpdates,
  /getElementById\('(?:mode-updates|systemUpdateStatus|btnSystemSelect)'/,
  'System Updates should bind shell nodes through shared shell ids'
);

assert.deepEqual(
  validateEditorShellContract('<div id="btnPushMarkdown"></div>', {
    ids: [{ key: 'missing', id: 'missingNode' }],
    selectors: [{ key: 'modes', selector: EDITOR_SHELL_SELECTORS.modeTabs, minCount: 1 }]
  }),
  [
    'editor shell id "missingNode" expected once, found 0',
    'editor shell selector ".mode-tab" expected at least 1, found 0'
  ],
  'shell contract validation should report missing ids and selector groups'
);

assert.match(
  shellContract,
  /export const EDITOR_SHELL_REQUIRED_IDS[\s\S]*export function validateEditorShellContract/,
  'shell contract should keep required ids/selectors and validation in one module'
);

console.log('ok - editor shell contract');
