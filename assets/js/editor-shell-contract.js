export const EDITOR_SHELL_IDS = Object.freeze({
  btnAddItem: 'btnAddItem',
  btnDiscard: 'btnDiscard',
  btnDiscardMarkdown: 'btnDiscardMarkdown',
  btnProtectMarkdown: 'btnProtectMarkdown',
  btnPushMarkdown: 'btnPushMarkdown',
  btnRefresh: 'btnRefresh',
  btnReview: 'btnReview',
  btnSaveMarkdown: 'btnSaveMarkdown',
  btnSystemDownload: 'btnSystemDownload',
  btnSystemSelect: 'btnSystemSelect',
  btnThemeClearStaged: 'btnThemeClearStaged',
  btnThemeImport: 'btnThemeImport',
  btnThemeImportInline: 'btnThemeImportInline',
  btnThemeRefreshCatalog: 'btnThemeRefreshCatalog',
  ciList: 'ciList',
  composerOrderInlineMeta: 'composerOrderInlineMeta',
  composerIndexHost: 'composerIndexHost',
  composerIndex: 'composerIndex',
  composerSiteHost: 'composerSiteHost',
  composerSite: 'composerSite',
  composerTabsHost: 'composerTabsHost',
  composerTabs: 'composerTabs',
  ctList: 'ctList',
  editorAppShell: 'editorAppShell',
  editorContentPane: 'editorContentPane',
  editorModalComposerActions: 'editorModalComposerActions',
  editorModalLayer: 'editorModalLayer',
  editorModalSyncActions: 'editorModalSyncActions',
  editorModalThemeActions: 'editorModalThemeActions',
  editorModalTitle: 'editorModalTitle',
  editorModalUpdateActions: 'editorModalUpdateActions',
  editorRailResizer: 'editorRailResizer',
  editorRailScrim: 'editorRailScrim',
  editorSystemActions: 'editorSystemActions',
  editorSystemBody: 'editorSystemBody',
  editorSystemKicker: 'editorSystemKicker',
  editorSystemMeta: 'editorSystemMeta',
  editorSystemPanel: 'editorSystemPanel',
  editorSystemTitle: 'editorSystemTitle',
  modeComposer: 'mode-composer',
  modeEditor: 'mode-editor',
  modeSync: 'mode-sync',
  modeThemes: 'mode-themes',
  modeUpdates: 'mode-updates',
  systemUpdateAssetMeta: 'systemUpdateAssetMeta',
  systemUpdateCurrentVersion: 'systemUpdateCurrentVersion',
  systemUpdateDownloadLink: 'systemUpdateDownloadLink',
  systemUpdateFileInput: 'systemUpdateFileInput',
  systemUpdateFileList: 'systemUpdateFileList',
  systemUpdateFileSection: 'systemUpdateFileSection',
  systemUpdateReleaseMeta: 'systemUpdateReleaseMeta',
  systemUpdateReleaseNotes: 'systemUpdateReleaseNotes',
  systemUpdateReleasePublished: 'systemUpdateReleasePublished',
  systemUpdateStatus: 'systemUpdateStatus',
  systemUpdateTargetVersion: 'systemUpdateTargetVersion',
  themeImportFileInput: 'themeImportFileInput',
  themeManagerAvailableList: 'themeManagerAvailableList',
  themeManagerFileList: 'themeManagerFileList',
  themeManagerInstalledList: 'themeManagerInstalledList',
  themeManagerPendingSection: 'themeManagerPendingSection',
  themeManagerStatus: 'themeManagerStatus'
});

export const EDITOR_SHELL_SELECTORS = Object.freeze({
  composerSiteViewport: '#composerSite .cs-viewport',
  composerSiteViewportElement: '.cs-viewport',
  composerFileTabs: 'a.vt-btn[data-cfile]',
  editorModalBody: '.editor-modal-body',
  editorModalDialog: '.editor-modal-dialog',
  editorRailTreeScroll: '.editor-rail-tree-scroll',
  editorRailToggle: '[data-editor-rail-toggle]',
  modeTabs: '.mode-tab',
  themeManagerPanels: '[data-theme-manager-panel]',
  themeManagerTabs: '[data-theme-manager-view]'
});

const STATIC_SHELL_ID_KEYS = Object.freeze([
  'btnDiscard',
  'btnDiscardMarkdown',
  'btnProtectMarkdown',
  'btnRefresh',
  'btnSaveMarkdown',
  'btnSystemDownload',
  'btnSystemSelect',
  'btnThemeClearStaged',
  'btnThemeImport',
  'btnThemeImportInline',
  'btnThemeRefreshCatalog',
  'composerIndex',
  'composerIndexHost',
  'composerSite',
  'composerSiteHost',
  'composerTabs',
  'composerTabsHost',
  'editorAppShell',
  'editorContentPane',
  'editorModalComposerActions',
  'editorModalLayer',
  'editorModalSyncActions',
  'editorModalThemeActions',
  'editorModalTitle',
  'editorModalUpdateActions',
  'editorRailResizer',
  'editorRailScrim',
  'editorSystemActions',
  'editorSystemBody',
  'editorSystemKicker',
  'editorSystemMeta',
  'editorSystemPanel',
  'editorSystemTitle',
  'modeComposer',
  'modeEditor',
  'modeSync',
  'modeThemes',
  'modeUpdates',
  'systemUpdateAssetMeta',
  'systemUpdateCurrentVersion',
  'systemUpdateDownloadLink',
  'systemUpdateFileInput',
  'systemUpdateFileList',
  'systemUpdateFileSection',
  'systemUpdateReleaseMeta',
  'systemUpdateReleaseNotes',
  'systemUpdateReleasePublished',
  'systemUpdateStatus',
  'systemUpdateTargetVersion',
  'themeImportFileInput',
  'themeManagerAvailableList',
  'themeManagerFileList',
  'themeManagerInstalledList',
  'themeManagerPendingSection',
  'themeManagerStatus'
]);

export const EDITOR_SHELL_REQUIRED_IDS = Object.freeze(STATIC_SHELL_ID_KEYS
  .map(key => Object.freeze({ key, id: EDITOR_SHELL_IDS[key] })));

export const EDITOR_SHELL_REQUIRED_SELECTORS = Object.freeze([
  Object.freeze({ key: 'editorRailToggle', selector: EDITOR_SHELL_SELECTORS.editorRailToggle, minCount: 3 }),
  Object.freeze({ key: 'themeManagerPanels', selector: EDITOR_SHELL_SELECTORS.themeManagerPanels, minCount: 2 }),
  Object.freeze({ key: 'themeManagerTabs', selector: EDITOR_SHELL_SELECTORS.themeManagerTabs, minCount: 2 })
]);

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(source, pattern) {
  return (String(source || '').match(pattern) || []).length;
}

function countId(source, id) {
  return countMatches(source, new RegExp(`\\bid=(["'])${escapeRegExp(id)}\\1`, 'g'));
}

function countAttribute(source, attr) {
  return countMatches(source, new RegExp(`\\b${escapeRegExp(attr)}(?:=|\\s|>)`, 'g'));
}

function countClass(source, className) {
  return countMatches(source, new RegExp(`\\bclass=(["'])[^"']*\\b${escapeRegExp(className)}\\b[^"']*\\1`, 'g'));
}

function countComposerFileTabs(source) {
  return countMatches(
    source,
    /<a\b(?=[^>]*\bclass=(["'])[^"']*\bvt-btn\b[^"']*\1)(?=[^>]*\bdata-cfile=)[^>]*>/g
  );
}

export function countEditorShellSelector(source, selector) {
  switch (selector) {
    case EDITOR_SHELL_SELECTORS.composerFileTabs:
      return countComposerFileTabs(source);
    case EDITOR_SHELL_SELECTORS.editorRailToggle:
      return countAttribute(source, 'data-editor-rail-toggle');
    case EDITOR_SHELL_SELECTORS.modeTabs:
      return countClass(source, 'mode-tab');
    case EDITOR_SHELL_SELECTORS.themeManagerPanels:
      return countAttribute(source, 'data-theme-manager-panel');
    case EDITOR_SHELL_SELECTORS.themeManagerTabs:
      return countAttribute(source, 'data-theme-manager-view');
    default:
      return 0;
  }
}

export function validateEditorShellContract(html, contract = {}) {
  const failures = [];
  const ids = Array.isArray(contract.ids) ? contract.ids : EDITOR_SHELL_REQUIRED_IDS;
  const selectors = Array.isArray(contract.selectors) ? contract.selectors : EDITOR_SHELL_REQUIRED_SELECTORS;

  ids.forEach((entry) => {
    const key = String((entry && entry.key) || '').trim();
    const id = String((entry && entry.id) || '').trim();
    if (!key || !id) {
      failures.push('editor shell id contract entries require key and id');
      return;
    }
    const count = countId(html, id);
    if (count !== 1) failures.push(`editor shell id "${id}" expected once, found ${count}`);
  });

  selectors.forEach((entry) => {
    const selector = String((entry && entry.selector) || '').trim();
    const minCount = Number.isFinite(entry && entry.minCount) ? entry.minCount : 1;
    if (!selector) {
      failures.push('editor shell selector contract entries require selector');
      return;
    }
    const count = countEditorShellSelector(html, selector);
    if (count < minCount) failures.push(`editor shell selector "${selector}" expected at least ${minCount}, found ${count}`);
  });

  return failures;
}
