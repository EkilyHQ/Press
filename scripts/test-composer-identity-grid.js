import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createPublishSettingsStore } from '../assets/js/publish/settings-store.js';
import { createEditorSessionStateStore } from '../assets/js/editor-session-state.js';
import { createStagingRegistry } from '../assets/js/composer-staging.js';
import { resolveEditorStorageScope } from '../assets/js/editor-storage.js';
import {
  applyInferredRepoConfig,
  inferRepoConfigFromGitHubPagesUrl,
  isPlaceholderRepoConfig
} from '../assets/js/composer-site-config.js';

const here = dirname(fileURLToPath(import.meta.url));
const composerPath = resolve(here, '../assets/js/composer.js');
const composerSyncPanelPath = resolve(here, '../assets/js/composer-sync-panel.js');
const composerSyncCommitControllerPath = resolve(here, '../assets/js/composer-sync-commit-controller.js');
const composerSystemPanelPath = resolve(here, '../assets/js/composer-system-panel.js');
const composerPublishServicePath = resolve(here, '../assets/js/composer-publish-service.js');
const composerPublishStateServicePath = resolve(here, '../assets/js/composer-publish-state-service.js');
const composerPublishSettingsUiPath = resolve(here, '../assets/js/composer-publish-settings-ui.js');
const composerPublishSummaryPath = resolve(here, '../assets/js/composer-publish-summary.js');
const composerPublishFlowPath = resolve(here, '../assets/js/composer-publish-flow.js');
const composerNotificationsPath = resolve(here, '../assets/js/composer-notifications.js');
const composerDialogsPath = resolve(here, '../assets/js/composer-dialogs.js');
const composerRemoteSyncPath = resolve(here, '../assets/js/composer-remote-sync.js');
const composerYamlDraftsPath = resolve(here, '../assets/js/composer-yaml-drafts.js');
const composerYamlActionsPath = resolve(here, '../assets/js/composer-yaml-actions.js');
const composerContentStagingPath = resolve(here, '../assets/js/composer-content-staging.js');
const composerIndexPublishMetadataPath = resolve(here, '../assets/js/composer-index-publish-metadata.js');
const composerIndexTabsModelPath = resolve(here, '../assets/js/composer-index-tabs-model.js');
const composerSiteModelPath = resolve(here, '../assets/js/composer-site-model.js');
const composerDiffUiPath = resolve(here, '../assets/js/composer-diff-ui.js');
const composerOrderDiffUiPath = resolve(here, '../assets/js/composer-order-diff-ui.js');
const composerIndexTabsUiPath = resolve(here, '../assets/js/composer-index-tabs-ui.js');
const composerSiteSettingsUiPath = resolve(here, '../assets/js/composer-site-settings-ui.js');
const composerYamlPanelsControllerPath = resolve(here, '../assets/js/composer-yaml-panels-controller.js');
const composerMarkdownAssetsPath = resolve(here, '../assets/js/composer-markdown-assets.js');
const composerEditorShellPath = resolve(here, '../assets/js/composer-editor-shell.js');
const composerPathToolsPath = resolve(here, '../assets/js/composer-path-tools.js');
const composerContentMutationsPath = resolve(here, '../assets/js/composer-content-mutations.js');
const composerSetupVerifierPath = resolve(here, '../assets/js/composer-setup-verifier.js');
const composerModeControllerPath = resolve(here, '../assets/js/composer-mode-controller.js');
const composerUnsyncedSummaryPath = resolve(here, '../assets/js/composer-unsynced-summary.js');
const composerRuntimeStylesPath = resolve(here, '../assets/js/composer-runtime-styles.js');
const composerSystemThemeBridgePath = resolve(here, '../assets/js/composer-system-theme-bridge.js');
const composerBootstrapPath = resolve(here, '../assets/js/composer-bootstrap.js');
const composerRuntimePath = resolve(here, '../assets/js/composer-runtime.js');
const composerServiceRegistryPath = resolve(here, '../assets/js/composer-service-registry.js');
const composerFilePanelControllerPath = resolve(here, '../assets/js/composer-file-panel-controller.js');
const composerEditorDetailPanelControllerPath = resolve(here, '../assets/js/composer-editor-detail-panel-controller.js');
const composerUiMotionPath = resolve(here, '../assets/js/composer-ui-motion.js');
const composerSiteConfigPath = resolve(here, '../assets/js/composer-site-config.js');
const editorContentTreeControllerPath = resolve(here, '../assets/js/editor-content-tree-controller.js');
const composerMarkdownLoaderPath = resolve(here, '../assets/js/composer-markdown-loader.js');
const composerMarkdownActionsUiPath = resolve(here, '../assets/js/composer-markdown-actions-ui.js');
const composerMarkdownActionsPath = resolve(here, '../assets/js/composer-markdown-actions.js');
const composerMarkdownStatePath = resolve(here, '../assets/js/composer-markdown-state.js');
const composerMarkdownDraftsPath = resolve(here, '../assets/js/composer-markdown-drafts.js');
const composerMarkdownSessionPath = resolve(here, '../assets/js/composer-markdown-session.js');
const composerMarkdownWorkspacePath = resolve(here, '../assets/js/composer-markdown-workspace.js');
const editorFileTreeUiPath = resolve(here, '../assets/js/editor-file-tree-ui.js');
const editorStructurePanelUiPath = resolve(here, '../assets/js/editor-structure-panel-ui.js');
const editorStoragePath = resolve(here, '../assets/js/editor-storage.js');
const editorAppRuntimePath = resolve(here, '../assets/js/editor-app-runtime.js');
const publishCommitServicePath = resolve(here, '../assets/js/publish/commit-service.js');
const publishSettingsPath = resolve(here, '../assets/js/publish/settings-store.js');
const connectTransportPath = resolve(here, '../assets/js/publish/transports/connect-transport.js');
const patTransportPath = resolve(here, '../assets/js/publish/transports/github-pat-transport.js');
const propagationWatcherPath = resolve(here, '../assets/js/publish/propagation-watcher.js');
const mainPath = resolve(here, '../assets/main.js');
const hiEditorPath = resolve(here, '../assets/js/hieditor.js');
const editorMainPath = resolve(here, '../assets/js/editor-main.js');
const editorMainRuntimePath = resolve(here, '../assets/js/editor-main-runtime.js');
const editorMainMetadataPanelPath = resolve(here, '../assets/js/editor-main-metadata-panel.js');
const editorMainPreviewSessionPath = resolve(here, '../assets/js/editor-main-preview-session.js');
const editorMainCurrentFileSessionPath = resolve(here, '../assets/js/editor-main-current-file-session.js');
const editorMainSidebarSessionPath = resolve(here, '../assets/js/editor-main-sidebar-session.js');
const editorMainToolbarSessionPath = resolve(here, '../assets/js/editor-main-toolbar-session.js');
const editorMainImageSessionPath = resolve(here, '../assets/js/editor-main-image-session.js');
const editorMainLinkCardContextPath = resolve(here, '../assets/js/editor-main-link-card-context.js');
const editorMainWorkspaceSessionPath = resolve(here, '../assets/js/editor-main-workspace-session.js');
const editorMainBlocksSessionPath = resolve(here, '../assets/js/editor-main-blocks-session.js');
const editorMainDocumentSessionPath = resolve(here, '../assets/js/editor-main-document-session.js');
const editorMainContentServicePath = resolve(here, '../assets/js/editor-main-content-service.js');
const editorMainFileContextServicePath = resolve(here, '../assets/js/editor-main-file-context-service.js');
const editorMainLanguageSessionPath = resolve(here, '../assets/js/editor-main-language-session.js');
const editorMainScrollSessionPath = resolve(here, '../assets/js/editor-main-scroll-session.js');
const editorMainShellServicePath = resolve(here, '../assets/js/editor-main-shell-service.js');
const editorMainServiceRegistryPath = resolve(here, '../assets/js/editor-main-service-registry.js');
const editorBlocksPath = resolve(here, '../assets/js/editor-blocks.js');
const editorBlocksModelPath = resolve(here, '../assets/js/editor-blocks-model.js');
const editorBlocksRuntimePath = resolve(here, '../assets/js/editor-blocks-runtime.js');
const editorBlocksSessionRegistryPath = resolve(here, '../assets/js/editor-blocks-session-registry.js');
const editorBlocksLayoutSessionPath = resolve(here, '../assets/js/editor-blocks-layout-session.js');
const editorBlocksBodySessionPath = resolve(here, '../assets/js/editor-blocks-body-session.js');
const editorBlocksStatePath = resolve(here, '../assets/js/editor-blocks-state.js');
const editorBlocksMenuSessionPath = resolve(here, '../assets/js/editor-blocks-menu-session.js');
const editorBlocksHeadSessionPath = resolve(here, '../assets/js/editor-blocks-head-session.js');
const editorBlocksCommandSessionPath = resolve(here, '../assets/js/editor-blocks-command-session.js');
const editorBlocksRichTextSessionPath = resolve(here, '../assets/js/editor-blocks-rich-text-session.js');
const editorBlocksEditableSessionPath = resolve(here, '../assets/js/editor-blocks-editable-session.js');
const editorBlocksSelectionSessionPath = resolve(here, '../assets/js/editor-blocks-selection-session.js');
const editorBlocksInlineDomSessionPath = resolve(here, '../assets/js/editor-blocks-inline-dom-session.js');
const editorBlocksCaretSessionPath = resolve(here, '../assets/js/editor-blocks-caret-session.js');
const editorBlocksFocusSessionPath = resolve(here, '../assets/js/editor-blocks-focus-session.js');
const editorBlocksPointerSessionPath = resolve(here, '../assets/js/editor-blocks-pointer-session.js');
const editorBlocksActiveSessionPath = resolve(here, '../assets/js/editor-blocks-active-session.js');
const editorBlocksInlineToolbarSessionPath = resolve(here, '../assets/js/editor-blocks-inline-toolbar-session.js');
const editorBlocksLinkSessionPath = resolve(here, '../assets/js/editor-blocks-link-session.js');
const editorBlocksMathSessionPath = resolve(here, '../assets/js/editor-blocks-math-session.js');
const editorBlocksTableSessionPath = resolve(here, '../assets/js/editor-blocks-table-session.js');
const editorBlocksCardPickerSessionPath = resolve(here, '../assets/js/editor-blocks-card-picker-session.js');
const editorBlocksImageSessionPath = resolve(here, '../assets/js/editor-blocks-image-session.js');
const editorBlocksCodeSessionPath = resolve(here, '../assets/js/editor-blocks-code-session.js');
const editorBlocksSourceSessionPath = resolve(here, '../assets/js/editor-blocks-source-session.js');
const editorBlocksListSessionPath = resolve(here, '../assets/js/editor-blocks-list-session.js');
const syntaxHighlightPath = resolve(here, '../assets/js/syntax-highlight.js');
const editorPath = resolve(here, '../index_editor.html');
const nativeBasePath = resolve(here, '../assets/themes/native/base.css');
const nativeThemePath = resolve(here, '../assets/themes/native/theme.css');
const enI18nPath = resolve(here, '../assets/i18n/en.js');
const chsI18nPath = resolve(here, '../assets/i18n/chs.js');
const chtTwI18nPath = resolve(here, '../assets/i18n/cht-tw.js');
const chtHkI18nPath = resolve(here, '../assets/i18n/cht-hk.js');
const jaI18nPath = resolve(here, '../assets/i18n/ja.js');
const languagesManifestPath = resolve(here, '../assets/i18n/languages.json');
const i18nPath = resolve(here, '../assets/js/i18n.js');
const source = readFileSync(composerPath, 'utf8');
const composerSyncPanelSource = readFileSync(composerSyncPanelPath, 'utf8');
const composerSyncCommitControllerSource = readFileSync(composerSyncCommitControllerPath, 'utf8');
const composerSystemPanelSource = readFileSync(composerSystemPanelPath, 'utf8');
const composerPublishServiceSource = readFileSync(composerPublishServicePath, 'utf8');
const composerPublishStateServiceSource = readFileSync(composerPublishStateServicePath, 'utf8');
const composerPublishSettingsUiSource = readFileSync(composerPublishSettingsUiPath, 'utf8');
const composerPublishSummarySource = readFileSync(composerPublishSummaryPath, 'utf8');
const composerPublishFlowSource = readFileSync(composerPublishFlowPath, 'utf8');
const composerNotificationsSource = readFileSync(composerNotificationsPath, 'utf8');
const composerDialogsSource = readFileSync(composerDialogsPath, 'utf8');
const composerRemoteSyncSource = readFileSync(composerRemoteSyncPath, 'utf8');
const composerYamlDraftsSource = readFileSync(composerYamlDraftsPath, 'utf8');
const composerYamlActionsSource = readFileSync(composerYamlActionsPath, 'utf8');
const composerContentStagingSource = readFileSync(composerContentStagingPath, 'utf8');
const composerIndexPublishMetadataSource = readFileSync(composerIndexPublishMetadataPath, 'utf8');
const composerIndexTabsModelSource = readFileSync(composerIndexTabsModelPath, 'utf8');
const composerSiteModelSource = readFileSync(composerSiteModelPath, 'utf8');
const composerDiffUiSource = readFileSync(composerDiffUiPath, 'utf8');
const composerOrderDiffUiSource = readFileSync(composerOrderDiffUiPath, 'utf8');
const composerIndexTabsUiSource = readFileSync(composerIndexTabsUiPath, 'utf8');
const composerSiteSettingsUiSource = readFileSync(composerSiteSettingsUiPath, 'utf8');
const composerYamlPanelsControllerSource = readFileSync(composerYamlPanelsControllerPath, 'utf8');
const composerMarkdownAssetsSource = readFileSync(composerMarkdownAssetsPath, 'utf8');
const composerEditorShellSource = readFileSync(composerEditorShellPath, 'utf8');
const composerPathToolsSource = readFileSync(composerPathToolsPath, 'utf8');
const composerContentMutationsSource = readFileSync(composerContentMutationsPath, 'utf8');
const composerSetupVerifierSource = readFileSync(composerSetupVerifierPath, 'utf8');
const composerModeControllerSource = readFileSync(composerModeControllerPath, 'utf8');
const composerUnsyncedSummarySource = readFileSync(composerUnsyncedSummaryPath, 'utf8');
const composerRuntimeStylesSource = readFileSync(composerRuntimeStylesPath, 'utf8');
const composerSystemThemeBridgeSource = readFileSync(composerSystemThemeBridgePath, 'utf8');
const composerBootstrapSource = readFileSync(composerBootstrapPath, 'utf8');
const composerRuntimeSource = readFileSync(composerRuntimePath, 'utf8');
const composerServiceRegistrySource = readFileSync(composerServiceRegistryPath, 'utf8');
const composerFilePanelControllerSource = readFileSync(composerFilePanelControllerPath, 'utf8');
const composerEditorDetailPanelControllerSource = readFileSync(composerEditorDetailPanelControllerPath, 'utf8');
const composerUiMotionSource = readFileSync(composerUiMotionPath, 'utf8');
const composerSiteConfigSource = readFileSync(composerSiteConfigPath, 'utf8');
const editorContentTreeControllerSource = readFileSync(editorContentTreeControllerPath, 'utf8');
const composerMarkdownLoaderSource = readFileSync(composerMarkdownLoaderPath, 'utf8');
const composerMarkdownActionsUiSource = readFileSync(composerMarkdownActionsUiPath, 'utf8');
const composerMarkdownActionsSource = readFileSync(composerMarkdownActionsPath, 'utf8');
const composerMarkdownStateSource = readFileSync(composerMarkdownStatePath, 'utf8');
const composerMarkdownDraftsSource = readFileSync(composerMarkdownDraftsPath, 'utf8');
const composerMarkdownSessionSource = readFileSync(composerMarkdownSessionPath, 'utf8');
const composerMarkdownWorkspaceSource = readFileSync(composerMarkdownWorkspacePath, 'utf8');
const editorFileTreeUiSource = readFileSync(editorFileTreeUiPath, 'utf8');
const editorStructurePanelUiSource = readFileSync(editorStructurePanelUiPath, 'utf8');
const editorStorageSource = readFileSync(editorStoragePath, 'utf8');
const editorAppRuntimeSource = readFileSync(editorAppRuntimePath, 'utf8');
const publishCommitServiceSource = readFileSync(publishCommitServicePath, 'utf8');
const publishSettingsSource = readFileSync(publishSettingsPath, 'utf8');
const connectTransportSource = readFileSync(connectTransportPath, 'utf8');
const patTransportSource = readFileSync(patTransportPath, 'utf8');
const propagationWatcherSource = readFileSync(propagationWatcherPath, 'utf8');
const mainSource = readFileSync(mainPath, 'utf8');
const hiEditorSource = readFileSync(hiEditorPath, 'utf8');
const editorMainSource = readFileSync(editorMainPath, 'utf8');
const editorMainRuntimeSource = readFileSync(editorMainRuntimePath, 'utf8');
const editorMainMetadataPanelSource = readFileSync(editorMainMetadataPanelPath, 'utf8');
const editorMainPreviewSessionSource = readFileSync(editorMainPreviewSessionPath, 'utf8');
const editorMainCurrentFileSessionSource = readFileSync(editorMainCurrentFileSessionPath, 'utf8');
const editorMainSidebarSessionSource = readFileSync(editorMainSidebarSessionPath, 'utf8');
const editorMainToolbarSessionSource = readFileSync(editorMainToolbarSessionPath, 'utf8');
const editorMainImageSessionSource = readFileSync(editorMainImageSessionPath, 'utf8');
const editorMainLinkCardContextSource = readFileSync(editorMainLinkCardContextPath, 'utf8');
const editorMainWorkspaceSessionSource = readFileSync(editorMainWorkspaceSessionPath, 'utf8');
const editorMainBlocksSessionSource = readFileSync(editorMainBlocksSessionPath, 'utf8');
const editorMainDocumentSessionSource = readFileSync(editorMainDocumentSessionPath, 'utf8');
const editorMainContentServiceSource = readFileSync(editorMainContentServicePath, 'utf8');
const editorMainFileContextServiceSource = readFileSync(editorMainFileContextServicePath, 'utf8');
const editorMainLanguageSessionSource = readFileSync(editorMainLanguageSessionPath, 'utf8');
const editorMainScrollSessionSource = readFileSync(editorMainScrollSessionPath, 'utf8');
const editorMainShellServiceSource = readFileSync(editorMainShellServicePath, 'utf8');
const editorMainServiceRegistrySource = readFileSync(editorMainServiceRegistryPath, 'utf8');
const editorBlocksSource = readFileSync(editorBlocksPath, 'utf8');
const editorBlocksModelSource = readFileSync(editorBlocksModelPath, 'utf8');
const editorBlocksRuntimeSource = readFileSync(editorBlocksRuntimePath, 'utf8');
const editorBlocksSessionRegistrySource = readFileSync(editorBlocksSessionRegistryPath, 'utf8');
const editorBlocksLayoutSessionSource = readFileSync(editorBlocksLayoutSessionPath, 'utf8');
const editorBlocksBodySessionSource = readFileSync(editorBlocksBodySessionPath, 'utf8');
const editorBlocksStateSource = readFileSync(editorBlocksStatePath, 'utf8');
const editorBlocksMenuSessionSource = readFileSync(editorBlocksMenuSessionPath, 'utf8');
const editorBlocksHeadSessionSource = readFileSync(editorBlocksHeadSessionPath, 'utf8');
const editorBlocksCommandSessionSource = readFileSync(editorBlocksCommandSessionPath, 'utf8');
const editorBlocksRichTextSessionSource = readFileSync(editorBlocksRichTextSessionPath, 'utf8');
const editorBlocksEditableSessionSource = readFileSync(editorBlocksEditableSessionPath, 'utf8');
const editorBlocksSelectionSessionSource = readFileSync(editorBlocksSelectionSessionPath, 'utf8');
const editorBlocksInlineDomSessionSource = readFileSync(editorBlocksInlineDomSessionPath, 'utf8');
const editorBlocksCaretSessionSource = readFileSync(editorBlocksCaretSessionPath, 'utf8');
const editorBlocksFocusSessionSource = readFileSync(editorBlocksFocusSessionPath, 'utf8');
const editorBlocksPointerSessionSource = readFileSync(editorBlocksPointerSessionPath, 'utf8');
const editorBlocksActiveSessionSource = readFileSync(editorBlocksActiveSessionPath, 'utf8');
const editorBlocksInlineToolbarSessionSource = readFileSync(editorBlocksInlineToolbarSessionPath, 'utf8');
const editorBlocksLinkSessionSource = readFileSync(editorBlocksLinkSessionPath, 'utf8');
const editorBlocksMathSessionSource = readFileSync(editorBlocksMathSessionPath, 'utf8');
const editorBlocksTableSessionSource = readFileSync(editorBlocksTableSessionPath, 'utf8');
const editorBlocksCardPickerSessionSource = readFileSync(editorBlocksCardPickerSessionPath, 'utf8');
const editorBlocksImageSessionSource = readFileSync(editorBlocksImageSessionPath, 'utf8');
const editorBlocksCodeSessionSource = readFileSync(editorBlocksCodeSessionPath, 'utf8');
const editorBlocksSourceSessionSource = readFileSync(editorBlocksSourceSessionPath, 'utf8');
const editorBlocksListSessionSource = readFileSync(editorBlocksListSessionPath, 'utf8');
const syntaxHighlightSource = readFileSync(syntaxHighlightPath, 'utf8');
const editorSource = readFileSync(editorPath, 'utf8');
const nativeBaseSource = readFileSync(nativeBasePath, 'utf8');
const nativeThemeSource = readFileSync(nativeThemePath, 'utf8');
const i18nSource = readFileSync(i18nPath, 'utf8');
const enI18nSource = readFileSync(enI18nPath, 'utf8');
const chsI18nSource = readFileSync(chsI18nPath, 'utf8');
const chtTwI18nSource = readFileSync(chtTwI18nPath, 'utf8');
const chtHkI18nSource = readFileSync(chtHkI18nPath, 'utf8');
const jaI18nSource = readFileSync(jaI18nPath, 'utf8');
const languagesManifestSource = readFileSync(languagesManifestPath, 'utf8');
const siteSettingsSource = [source, composerSiteSettingsUiSource, composerRuntimeStylesSource, composerUiMotionSource].join('\n');

function extractFunctionBody(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const open = text.indexOf('{', start);
  assert.notEqual(open, -1, `${name} should have a body`);
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  assert.fail(`${name} body should be balanced`);
}

const repoInference = {
  resolveEditorStorageScope,
  inferRepoConfigFromGitHubPagesUrl,
  isPlaceholderRepoConfig,
  applyInferredRepoConfig
};

assert.match(
  editorSource,
  /\.view-toggle \.vt-btn \.vt-dirty-badge\{position:absolute;top:-\.45rem;right:0;min-width:1\.15rem;height:1\.15rem[\s\S]*transform:translateX\(50%\) scale\(\.72\)/,
  'composer file switch dirty indicators should render as right-edge centered numeric badges'
);

assert.doesNotMatch(
  editorSource,
  /\.view-toggle \.vt-btn\.has-draft::before/,
  'composer file switch dirty indicators should not render as inline orange dots'
);

assert.match(
  editorSource,
  /assets\/js\/editor-boot\.js\?v=[\w.-]+/,
  'editor HTML should cache-bust editor boot when asset deletion i18n boundaries change'
);

assert.match(
  source,
  /import \{ escapeHtml \} from '\.\/utils\.js\?v=[\w.-]+';/,
  'composer should import the shared HTML escaper before wiring UI controllers'
);

assert.match(
  editorSource,
  /assets\/js\/editor-main\.js\?v=[\w.-]+/,
  'editor HTML should cache-bust editor-main.js when block editor defaults change'
);

assert.match(
  editorSource,
  /assets\/js\/composer\.js\?v=[\w.-]+/,
  'editor HTML should cache-bust composer.js when version compatibility changes'
);

assert.match(
  editorSource,
  /id="btnProtectMarkdown"[\s\S]*data-i18n="editor\.toolbar\.protection"/,
  'editor toolbar should expose the article protection control'
);

assert.match(
  editorSource,
  /\.composer-protection-modal[\s\S]*\.composer-protection-card[\s\S]*id="btnProtectMarkdown"[^>]+role="switch"/,
  'editor stylesheet should include protected article password dialog and native protected switch state'
);

assert.match(
  editorSource,
  /assets\/js\/editor-main\.js\?v=[\w.-]+/,
  'editor HTML should cache-bust editor-main.js when block editor defaults change'
);

assert.match(
  editorMainBlocksSessionSource,
  /from '\.\/editor-blocks\.js\?v=[\w.-]+'/,
  'editor main blocks session should cache-bust the Markdown blocks editor when math block handling changes'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-model\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks model boundary'
);

assert.match(
  editorBlocksSource,
  /import \{[\s\S]*editableTableData,[\s\S]*normalizeTableAlignment,[\s\S]*normalizeTableCellValue,[\s\S]*tableColumnCount,[\s\S]*\} from '\.\/editor-blocks-model\.js\?v=[\w.-]+'/,
  'blocks editor should import table model helpers from the explicit blocks model boundary before composing the table session'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-runtime\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks runtime boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-session-registry\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks session registry boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-layout-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks layout session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-body-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks body session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-state\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks state controller boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-menu-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks menu session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-head-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks head session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-command-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks command session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-rich-text-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks rich text session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-editable-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks editable session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-selection-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks selection session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-inline-dom-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks inline DOM session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-caret-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks caret session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-focus-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks focus session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-pointer-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks pointer session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-active-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks active session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-inline-toolbar-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks inline toolbar session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-link-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks link session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-math-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks math session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-table-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks table session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-card-picker-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks card picker session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-image-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks image session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-code-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks code session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-source-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks source session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-list-session\.js\?v=[\w.-]+'/,
  'blocks editor should cache-bust the explicit blocks list session boundary'
);

assert.match(
  editorBlocksSource,
  /const blockSessions = createEditorBlocksSessionRegistry\(\);/,
  'blocks editor should create an explicit late-bound session registry at the composition root'
);

assert.doesNotMatch(
  editorBlocksSource,
  /let\s+(?:commandSession|focusSession|pointerSession|activeSession|bodySession|layoutSession|listSession|cardPickerSession)\s*=|let\s+(?:refreshLinkEditor|openLinkEditorForSelection|openMathEditorForSelection|openMathEditorForNode|openMathEditorForBlock|updateInlineToolbarState)\s*=/,
  'blocks editor should not reintroduce ad hoc late-bound session slots at the root'
);

assert.match(
  editorBlocksSessionRegistrySource,
  /const SERVICE_NAMES = \[[\s\S]*'activeSession'[\s\S]*'bodySession'[\s\S]*'cardPickerSession'[\s\S]*'commandSession'[\s\S]*'focusSession'[\s\S]*'inlineToolbarSession'[\s\S]*'layoutSession'[\s\S]*'linkSession'[\s\S]*'listSession'[\s\S]*'mathSession'[\s\S]*'pointerSession'[\s\S]*\];/,
  'blocks session registry should name every allowed late-bound editor blocks dependency'
);

assert.match(
  editorBlocksSessionRegistrySource,
  /focusBlockPrimaryEditable: \(\.\.\.args\) => call\('focusSession', 'focusBlockPrimaryEditable', false, \.\.\.args\),[\s\S]*setCardEntries: \(\.\.\.args\) => handledCall\('cardPickerSession', 'setEntries', \.\.\.args\),[\s\S]*setFocusSession: \(service\) => set\('focusSession', service\),/,
  'blocks session registry should expose explicit setters and behavior proxies instead of anonymous function slots'
);

assert.match(
  editorBlocksSource,
  /const focusSession = blockSessions\.setFocusSession\(createEditorBlocksFocusSession\(\{[\s\S]*state,[\s\S]*caretSession,[\s\S]*editableSession,[\s\S]*blockElements,[\s\S]*editableListItems,[\s\S]*setActive,[\s\S]*activateNonTextBlockFromPointer,/,
  'blocks editor should compose focus, list-item, and cross-block navigation through the focus session boundary'
);

assert.match(
  editorBlocksSource,
  /const pointerSession = blockSessions\.setPointerSession\(createEditorBlocksPointerSession\(\{[\s\S]*blocksState,[\s\S]*caretSession,[\s\S]*selectionSession,[\s\S]*editableSession,[\s\S]*blockElements,[\s\S]*closestElement,[\s\S]*containsNode: nodeContains,[\s\S]*setActive,[\s\S]*activateEditableFromPointer,[\s\S]*activateNonTextBlockFromPointer,/,
  'blocks editor should compose blank-area pointer routing through the pointer session boundary'
);

assert.match(
  editorBlocksSource,
  /const activeSession = blockSessions\.setActiveSession\(createEditorBlocksActiveSession\(\{[\s\S]*state,[\s\S]*blocksState,[\s\S]*list,[\s\S]*runtime,[\s\S]*containsNode: nodeContains,[\s\S]*syncActiveListTypeSelect,[\s\S]*refreshLinkEditor,[\s\S]*updateInlineToolbarState,[\s\S]*syncActiveTableAlignmentFromEditable,[\s\S]*requestStickyBlockHeadUpdate,[\s\S]*clearNativeSelection[\s\S]*\}\)\);/,
  'blocks editor should compose active block state transitions through the active session boundary'
);

assert.match(
  editorBlocksSource,
  /const updateInlineToolbarState = \(\) => \{[\s\S]*blockSessions\.updateInlineToolbarState\(\);[\s\S]*\};[\s\S]*const inlineToolbarSession = blockSessions\.setInlineToolbarSession\(createEditorBlocksInlineToolbarSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*state,[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*root,[\s\S]*list,[\s\S]*menuSession,[\s\S]*selectionSession,[\s\S]*caretSession,[\s\S]*text,[\s\S]*setActive,[\s\S]*applyInlineCommand,[\s\S]*containsNode: nodeContains,[\s\S]*closestElement,[\s\S]*selectionEditableInRoot,[\s\S]*getEditableSelectionOffsets,[\s\S]*inlineRunsFromDom,[\s\S]*hasPendingInlineMarks,[\s\S]*selectionLinkInEditable,[\s\S]*selectionMathInEditable,[\s\S]*inlineRangeFullyMarked,[\s\S]*inlineRangeAnyMarked,[\s\S]*inlineMarksAtOffset,[\s\S]*rangeHasInlineText,[\s\S]*inlineCommandMark[\s\S]*\}\)\);/,
  'blocks editor should compose inline toolbar DOM controls and state through the inline toolbar session boundary'
);

assert.match(
  editorBlocksSource,
  /const richTextSession = createEditorBlocksRichTextSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*selectionSession,[\s\S]*inlineDomSession,[\s\S]*caretSession,[\s\S]*setPlainContentEditableValue,[\s\S]*inlineRunsFromDom,[\s\S]*inlineRun,[\s\S]*insertInlineRunsAtRange,[\s\S]*getEditableSelectionOffsets,[\s\S]*applyRunsToEditable,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*mergeTextBlockWithPreviousOnBackspace,[\s\S]*splitTextBlockAfterCaret,[\s\S]*inlineMarksFromPointerEvent,[\s\S]*inlineMarkedDomRangeFromPointerEvent,[\s\S]*updateInlineToolbarState: \(\) => updateInlineToolbarState\(\),[\s\S]*refreshLinkEditor: link => refreshLinkEditor\(link\),[\s\S]*openMathEditorForNode: node => openMathEditorForNode\(node\)[\s\S]*\}\);[\s\S]*const createRichEditable = \(\.\.\.args\) => richTextSession\?\.createRichEditable\(\.\.\.args\);[\s\S]*const wireInlineEditable = \(\.\.\.args\) => richTextSession\?\.wireInlineEditable\(\.\.\.args\);/,
  'blocks editor should compose rich text editable DOM and input events through the rich text session boundary'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const insertPendingInlineText = \(editable|const wireInlineEditable = \(editable|const createRichEditable = \(tagName|editable\.addEventListener\('beforeinput', \(event\) => \{[\s\S]*insertPendingInlineText/,
  'blocks root should not own rich text editable DOM event wiring'
);

assert.match(
  editorBlocksSource,
  /const refreshLinkEditor = \(explicitLink = null\) => \{[\s\S]*blockSessions\.refreshLinkEditor\(explicitLink\);[\s\S]*\};[\s\S]*const openLinkEditorForSelection = \(\) => \{[\s\S]*blockSessions\.openLinkEditorForSelection\(\);[\s\S]*\};[\s\S]*const linkSession = blockSessions\.setLinkSession\(createEditorBlocksLinkSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*root,[\s\S]*runtime,[\s\S]*blocksState,[\s\S]*selectionSession,[\s\S]*caretSession,[\s\S]*inlineDomSession,[\s\S]*containsNode: nodeContains,[\s\S]*closestElement,[\s\S]*sanitizeLinkHref: sanitizeEditorLinkHref,[\s\S]*sanitizeLinkTitle: sanitizeEditorLinkTitle,[\s\S]*selectionLinkInEditable,[\s\S]*getEditableSelectionOffsets,[\s\S]*applyInlineLinkToRuns,[\s\S]*textRangeForDomNode,[\s\S]*linkForTextRange,[\s\S]*updateInlineToolbarState: \(\) => updateInlineToolbarState\(\),[\s\S]*onDocument,[\s\S]*onWindow[\s\S]*\}\)\);/,
  'blocks editor should compose inline link overlay behavior through the link session boundary'
);

assert.match(
  editorBlocksSource,
  /const openMathEditorForSelection = \(\) => \{[\s\S]*blockSessions\.openMathEditorForSelection\(\);[\s\S]*\};[\s\S]*const openMathEditorForNode = \(mathNode\) => \{[\s\S]*blockSessions\.openMathEditorForNode\(mathNode\);[\s\S]*\};[\s\S]*const openMathEditorForBlock = \(block, blockEl = null\) => \{[\s\S]*blockSessions\.openMathEditorForBlock\(block, blockEl\);[\s\S]*\};[\s\S]*const mathSession = blockSessions\.setMathSession\(createEditorBlocksMathSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*root,[\s\S]*list,[\s\S]*runtime,[\s\S]*blocksState,[\s\S]*selectionSession,[\s\S]*caretSession,[\s\S]*inlineDomSession,[\s\S]*containsNode: nodeContains,[\s\S]*closestElement,[\s\S]*renderMath: renderPressMath,[\s\S]*getMathBlockById: id => state\.blocks\.find[\s\S]*getEditableSelectionOffsets,[\s\S]*caretRectForEditable,[\s\S]*selectionMathInEditable,[\s\S]*applyInlineMathToRuns,[\s\S]*textRangeForDomNode,[\s\S]*updateInlineToolbarState: \(\) => updateInlineToolbarState\(\),[\s\S]*updateFromControl,[\s\S]*onDocument[\s\S]*\}\)\);/,
  'blocks editor should compose inline and display math overlay behavior through the math session boundary'
);

assert.match(
  editorBlocksSource,
  /const tableSession = createEditorBlocksTableSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*runtime,[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*blockElements,[\s\S]*text,[\s\S]*editableTableData,[\s\S]*tableColumnCount,[\s\S]*normalizeTableAlignment,[\s\S]*normalizeTableCellValue,[\s\S]*setActive,[\s\S]*activateEditableFromPointer,[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*updateFromControl,[\s\S]*queueTask: task => queueMicrotask\(task\)[\s\S]*\}\);[\s\S]*syncActiveTableAlignmentFromEditable = \(activeBlock, editable\) => \{[\s\S]*tableSession\?\.syncActiveAlignmentFromEditable\(activeBlock, editable, state\.blocks\);/,
  'blocks editor should compose table DOM, active-cell, and control behavior through the table session boundary'
);

assert.match(
  editorBlocksSource,
  /const codeSession = createEditorBlocksCodeSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*runtime,[\s\S]*editableSession,[\s\S]*text,[\s\S]*selectionSession,[\s\S]*codeEditableText,[\s\S]*insertCodeEditableTextAtSelection,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*updateFromControl,[\s\S]*setActive,[\s\S]*activateEditableFromPointer[\s\S]*\}\);/,
  'blocks editor should compose code block DOM and control behavior through the code session boundary'
);

assert.match(
  editorBlocksSource,
  /const cardPickerSession = blockSessions\.setCardPickerSession\(createEditorBlocksCardPickerSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*runtime,[\s\S]*blocksState,[\s\S]*text,[\s\S]*insertCardBlock: \(data, index\) => blockSessions\.insertCommandBlock\('card', data, \{ index \}\),[\s\S]*requestRender: \(\) => render\(\)[\s\S]*\}\)\);[\s\S]*if \(cardPickerSession\) root\.appendChild\(cardPickerSession\.element\);/,
  'blocks editor should compose article-card picker DOM and result selection through the card picker session boundary'
);

assert.match(
  editorBlocksSource,
  /const handleCrossBlockArrowNavigation = \(event, index, editable = null\) => \{[\s\S]*blockSessions\.handleCrossBlockArrowNavigation\(event, index, editable\)/,
  'blocks editor should delegate cross-block arrow navigation to the focus session'
);

assert.match(
  editorBlocksSource,
  /const routeBlocksCaretFromPointer = \(event\) => \{[\s\S]*blockSessions\.routeBlocksCaretFromPointer\(event\)/,
  'blocks editor should delegate blank-area pointer caret routing to the pointer session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /document\.(?:addEventListener|removeEventListener|createElement|createElementNS|createRange|createTextNode|caretPositionFromPoint|caretRangeFromPoint)|window\.(?:addEventListener|removeEventListener|setTimeout|clearTimeout|requestAnimationFrame|getSelection)|(?<!\.)setTimeout\(|navigator\.clipboard|window\.__press_t|window\.isSecureContext|document\.activeElement|document\.getElementById|\bNodeFilter\b/,
  'blocks editor should route global listeners, DOM factories, clipboard, timers, translation, active-element access, and browser selection/range/caret APIs through explicit runtime boundaries'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksMathSessionSource}`,
  /const inlineDomSession = createInlineDomSession\(selectionSession, runtime\.documentRef\);[\s\S]*renderInlineRunsInto\(editable, runs, inlineDomSession\)[\s\S]*textRangeForDomNode\(editable, mathNode, inlineDomSession\)/,
  'blocks editor should route inline run rendering plus math DOM range mapping through explicit inline DOM session dependencies'
);

assert.match(
  editorBlocksLinkSessionSource,
  /textRangeForDomNode\(editable, link, inlineDomSession\)[\s\S]*linkForTextRange\(editable, linkRange\.start, nextEnd, inlineDomSession\)/,
  'link session should route active link DOM range mapping through the inline DOM session'
);

assert.match(
  editorBlocksInlineDomSessionSource,
  /export function createEditorBlocksInlineDomSession\([\s\S]*function renderInlineRunsInto\(root, runs\)[\s\S]*function textRangeForDomNode\(editable, node\)[\s\S]*function linkForTextRange\(editable, start, end\)[\s\S]*function markedRangeForNode\(editable, node, mark\)[\s\S]*return \{[\s\S]*renderInlineRunsInto,[\s\S]*textRangeForDomNode,[\s\S]*linkForTextRange,[\s\S]*markedRangeForNode/,
  'blocks inline DOM session should own inline node rendering and text-range mapping helpers'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksPointerSessionSource}\n${editorBlocksFocusSessionSource}`,
  /const caretSession = createCaretSession\(selectionSession\);[\s\S]*getEditableSelectionOffsets\(editable, caretSession\)[\s\S]*caretSession\.measuredTextOffsetDetailsFromPoint\(editable, x, y, measureLimit\)[\s\S]*caretSession\.placeAtTextOffset\(editable, measuredDetails\.offset\)[\s\S]*caretSession\.textareaTextOffsetFromPoint\(area, x, y, measureLimit\)[\s\S]*caretSession\.placeAtVisualLine\(editable, x, edge, fallbackOffset\)/,
  'blocks editor should route caret offsets, visual-line placement, and textarea mirror measurement through the caret session'
);

assert.match(
  editorBlocksCaretSessionSource,
  /export function createEditorBlocksCaretSession\([\s\S]*function selectionOffsets\(el\)[\s\S]*function isSelectionOnBlankLine\(el\)[\s\S]*function measuredTextOffsetDetailsFromPoint\(el, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*function textareaTextOffsetDetailsFromPoint\(area, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*function placeAtVisualLine\(el, x, edge, fallbackOffset = 0\)[\s\S]*return \{[\s\S]*selectionOffsets,[\s\S]*isSelectionOnBlankLine,[\s\S]*measuredTextOffsetDetailsFromPoint,[\s\S]*textareaTextOffsetDetailsFromPoint,[\s\S]*placeAtVisualLine/,
  'blocks caret session should own selection offsets, blank visual line detection, text-point measurement, textarea mirror measurement, and visual-line placement'
);

assert.match(
  editorBlocksSource,
  /const blocksState = createEditorBlocksStateController\(\{[\s\S]*parseMarkdownBlocksRef: parseMarkdownBlocks,[\s\S]*serializeMarkdownBlocksRef: serializeMarkdownBlocks,[\s\S]*const state = blocksState\.state;[\s\S]*const markDirty = blocksState\.markDirty;[\s\S]*blocksState\.updateBlockData\(block, patch\)[\s\S]*blocksState\.setMarkdown\(markdown\)/,
  'blocks editor should route common block state commands through the state controller boundary'
);

assert.match(
  editorBlocksStateSource,
  /export function createEditorBlocksStateController\([\s\S]*function setMarkdown\(markdown\)[\s\S]*function insertBlankBlock\(index = state\.blocks\.length, options = \{\}\)[\s\S]*function insertBlock\(type, data = \{\}, index = state\.activeIndex \+ 1\)[\s\S]*function moveBlock\(index, direction\)[\s\S]*function resolveBlockTarget\(target = state\.activeIndex, predicate = \(\) => true\)/,
  'blocks state controller should own markdown reset, insert, move, delete, command menu, card picker, and target-resolution state commands'
);

assert.match(
  editorBlocksRuntimeSource,
  /export function createEditorBlocksRuntime\([\s\S]*async function writeClipboardText\(text\)[\s\S]*function translate\(key, fallback\)[\s\S]*onDocument: \(type, handler, options\)[\s\S]*onWindow: \(type, handler, options\)[\s\S]*createElement: \(tagName\)[\s\S]*createElementNS: \(namespace, tagName\)[\s\S]*writeClipboardText,[\s\S]*translate/,
  'blocks runtime should own global listener, DOM factory, clipboard, timer, viewport, and translation adapters'
);

assert.match(
  editorMainSource,
  /from '\.\/safe-html\.js\?v=[\w.-]+'/,
  'editor preview should import the cache-busted safe HTML helper directly'
);

assert.match(
  editorBlocksSource,
  /from '\.\/math-render\.js\?v=[\w.-]+'/,
  'editor blocks should cache-bust the math renderer when KaTeX support changes'
);

assert.match(
  composerSystemThemeBridgeSource,
  /from '\.\/system-updates\.js\?v=[\w.-]+'/,
  'system/theme bridge should cache-bust system updates when version compatibility changes'
);

assert.match(
  source,
  /from '\.\/encrypted-content\.js\?v=[\w.-]+'/,
  'composer should import encrypted article helpers through the encrypted-articles cache key'
);

assert.match(
  source,
  /from '\.\/composer-index-tabs-model\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted index/tabs model boundary'
);

assert.doesNotMatch(
  source,
  /function prepareIndexState|function prepareTabsState|function computeIndexDiff|function computeTabsDiff/,
  'index.yaml and tabs.yaml normalization and diffing should stay outside the main composer shell'
);

assert.match(
  composerIndexTabsModelSource,
  /export function prepareIndexState\(raw\)[\s\S]*export function prepareTabsState\(raw\)[\s\S]*export function computeIndexDiff\(current, baseline\)[\s\S]*export function computeTabsDiff\(current, baseline\)/,
  'index/tabs model boundary should own index.yaml and tabs.yaml normalization and diffing'
);

assert.match(
  source,
  /from '\.\/composer-site-model\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted site model boundary'
);

assert.doesNotMatch(
  source,
  /function prepareSiteState|function cloneSiteState|function computeSiteDiff|function toSiteYaml/,
  'site.yaml normalization, diffing, and serialization should stay outside the main composer shell'
);

assert.match(
  composerSiteModelSource,
  /export function prepareSiteState\(raw\)[\s\S]*'enableAllPosts', 'disableAllPosts', 'connect'[\s\S]*export function computeSiteDiff\(current, baseline\)[\s\S]*diff\.fields\.annotate[\s\S]*export function toSiteYaml\(data\)/,
  'site model boundary should own site.yaml normalization, diffing, and serialization'
);

assert.match(
  source,
  /from '\.\/composer-diff-ui\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted diff UI boundary'
);

assert.doesNotMatch(
  source,
  /function applySiteDiffMarkers|function applyIndexDiffMarkers|function applyTabsDiffMarkers|function refreshFileDirtyBadges|function computeOrderDiffDetails|function renderComposerInlineSummary|function updateFileDirtyBadge|function buildIndexDiffBadges|function buildTabsDiffBadges/,
  'diff markers, file dirty badges, and inline composer summaries should stay outside the main composer shell'
);

assert.match(
  composerDiffUiSource,
  /export function createComposerDiffUi\(options = \{\}\)[\s\S]*function buildEntryDiffBadges\(kind, info\)[\s\S]*function applySiteDiffMarkers\(diff\)[\s\S]*function refreshFileDirtyBadges\(\)[\s\S]*function computeOrderDiffDetails\(kind\)[\s\S]*function renderComposerInlineSummary\(target, diff, renderOptions = \{\}\)/,
  'diff UI boundary should own composer diff DOM markers, dirty badges, order stats, and inline summaries'
);

assert.match(
  source,
  /from '\.\/composer-order-diff-ui\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted order diff UI boundary'
);

assert.doesNotMatch(
  source,
  /function openComposerDiffModal|function ensureComposerDiffModal|function drawOrderDiffLines|function updateComposerOrderPreview|function applyComposerOrderHover|function bindComposerOrderHover|const ORDER_LINE_COLORS|let composerDiffModal|let composerOrderPreviewState/,
  'order diff modal, hover state, line drawing, and order preview state should stay outside the main composer shell'
);

assert.match(
  composerOrderDiffUiSource,
  /export function createComposerOrderDiffUi\(options = \{\}\)[\s\S]*const setTimeoutRef = typeof options\.setTimeoutRef === 'function'[\s\S]*const requestAnimationFrameRef = typeof options\.requestAnimationFrameRef === 'function'[\s\S]*const addWindowListener = typeof options\.addWindowListener === 'function'[\s\S]*const addDocumentListener = typeof options\.addDocumentListener === 'function'[\s\S]*function ensureComposerDiffModal\(\)[\s\S]*function drawOrderDiffLines\(state\)[\s\S]*function updateComposerOrderPreview\(kind, options = \{\}\)[\s\S]*function closeComposerDiffModalForKind\(kind\)/,
  'order diff UI boundary should own composer review modal, order visual connectors, and order preview state'
);

assert.match(
  source,
  /const composerOrderDiffUi = createComposerOrderDiffUi\(\{[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*cancelAnimationFrameRef: \(id\) => editorRuntime\.cancelFrame\(id\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*addWindowListener: \(type, handler, options\) => editorRuntime\.events\.onWindow\(type, handler, options\),[\s\S]*addDocumentListener: \(type, handler, options\) => editorRuntime\.events\.onDocument\(type, handler, options\),[\s\S]*matchesMedia: \(query\) => editorRuntime\.matchesMedia\(query\),[\s\S]*getComputedStyleRef: \(element\) => editorRuntime\.getComputedStyle\(element\),[\s\S]*ResizeObserverRef: editorRuntime\.getResizeObserver\(\)[\s\S]*\}\);/,
  'composer should inject order diff timers, frames, events, media, style, and observers through the runtime boundary'
);

assert.match(
  source,
  /from '\.\/composer-index-tabs-ui\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted index/tabs list UI boundary'
);

assert.doesNotMatch(
  source,
  /function makeDragList|function buildIndexUI|function buildTabsUI/,
  'index/tabs list rendering and drag UI should stay outside the main composer shell'
);

assert.match(
  composerIndexTabsUiSource,
  /export function createComposerIndexTabsUi\(options = \{\}\)[\s\S]*function makeDragList\(container, onReorder\)[\s\S]*function buildIndexUI\(root, state\)[\s\S]*function buildTabsUI\(root, state\)/,
  'index/tabs list UI boundary should own legacy composer list rendering and drag controls'
);

assert.match(
  source,
  /from '\.\/composer-site-settings-ui\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted Site Settings UI boundary'
);

assert.doesNotMatch(
  source,
  /function buildSiteUI/,
  'Site Settings rendering should stay outside the main composer shell'
);

assert.match(
  composerSiteSettingsUiSource,
  /export function createComposerSiteSettingsUi\(options = \{\}\)[\s\S]*function buildSiteUI\(root, state\)[\s\S]*const renderIdentityLocalizedGrid = \(section\) =>[\s\S]*const renderThemeGrid = \(section\) =>[\s\S]*const renderAssetWarningsGrid = \(section\) =>/,
  'Site Settings UI boundary should own repository, identity, theme, annotate, and asset warning rendering'
);

assert.match(
  source,
  /from '\.\/composer-markdown-assets\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted Markdown asset manager boundary'
);

assert.doesNotMatch(
  source,
  /function ensureMarkdownAssetBucket|function handleEditorAssetAdded|function handleEditorAssetDeleteRequested|function collectCurrentRepositoryMarkdownAssetReferences|const markdownAssetStore|const markdownDeletedAssetStore/,
  'Markdown asset draft maps, editor asset event handlers, and repository asset scans should stay outside the main composer shell'
);

assert.match(
  composerMarkdownAssetsSource,
  /export function createComposerMarkdownAssetManager\(options = \{\}\)[\s\S]*const markdownAssetStore = new Map\(\)[\s\S]*async function collectCurrentRepositoryMarkdownAssetReferences\(options = \{\}\)[\s\S]*function handleEditorAssetAdded\(event\)[\s\S]*function handleEditorAssetDeleteRequested\(event\)/,
  'Markdown asset manager boundary should own pending asset maps, deletion events, and repository reference scans'
);

assert.match(
  source,
  /const \{[\s\S]*ensureMarkdownAssetBucket,[\s\S]*textWithFallback,[\s\S]*collectCurrentRepositoryMarkdownAssetReferences[\s\S]*\} = markdownAssetManager;/,
  'composer should import all remaining Markdown asset adapter helpers from the manager instead of stale local bindings'
);

assert.match(
  composerMarkdownAssetsSource,
  /return \{[\s\S]*ensureMarkdownAssetBucket,[\s\S]*textWithFallback,[\s\S]*collectCurrentRepositoryMarkdownAssetReferences[\s\S]*\};/,
  'Markdown asset manager should expose the adapter helpers still used by composer wiring'
);

assert.match(
  source,
  /from '\.\/composer-editor-shell\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted editor shell boundary'
);

assert.doesNotMatch(
  source,
  /function initEditorRailResize|function initMobileEditorRail|function mountEditorSystemPanels|function bindEditorStatePersistenceListeners|function getEditorContentScrollElement|let editorContentScrollByKey|let editorRailResizeBound|let activeEditorOverlayMode/,
  'editor shell overlay, rail, system panel, and scroll persistence state should stay outside the main composer shell'
);

assert.match(
  composerEditorShellSource,
  /export function createComposerEditorShell\(options = \{\}\)[\s\S]*let editorContentScrollByKey = \{\};[\s\S]*function bindEditorStatePersistenceListeners\(\)[\s\S]*function mountEditorSystemPanels\(\)[\s\S]*function initEditorRailResize\(\)[\s\S]*function initMobileEditorRail\(\)/,
  'editor shell boundary should own system panel mounting, scroll persistence, rail resize, and mobile rail state'
);

assert.match(
  source,
  /from '\.\/composer-path-tools\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted path tools boundary'
);

assert.doesNotMatch(
  source,
  /function normalizeRelPath|function buildDefaultEntryPath|function buildDefaultLanguagePathFromEntry|function buildArticleVersionPath|function getDefaultMarkdownForPath/,
  'composer path normalization, default path, and markdown template rules should stay outside the main composer shell'
);

assert.match(
  composerPathToolsSource,
  /export function createComposerPathTools\(options = \{\}\)[\s\S]*function normalizeRelPath\(path\)[\s\S]*function buildDefaultLanguagePathFromEntry\(kind, key, lang, entry\)[\s\S]*function buildArticleVersionPath\(key, lang, version, entry\)[\s\S]*function getDefaultMarkdownForPath\(relPath\)/,
  'composer path tools boundary should own path normalization, article version paths, and default markdown templates'
);

assert.match(
  source,
  /from '\.\/composer-content-mutations\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted content mutation controller boundary'
);

assert.doesNotMatch(
  source,
  /function validateEntryKey|function renameEditorEntry|function deleteEditorEntry|function addEditorLanguage|function removeEditorLanguage|function addEditorVersion|function removeEditorVersion|function restoreDeletedEditorTreeNode|function moveEditorVersionTo|async function promptArticleVersionValue|async function promptComposerEntryKey|async function addComposerEntry/,
  'content tree write commands should stay outside the main composer shell'
);

assert.match(
  composerContentMutationsSource,
  /export function createComposerContentMutationController\(options = \{\}\)[\s\S]*function renameEditorEntry\(source, oldKey, nextKeyRaw\)[\s\S]*function addEditorLanguage\(source, key, lang\)[\s\S]*function restoreDeletedEditorTreeNode\(node\)[\s\S]*async function addComposerEntry\(kind, anchor\)/,
  'content mutation controller should own entry, language, version, tombstone restore, and add-entry write operations'
);

assert.match(
  source,
  /from '\.\/composer-setup-verifier\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted setup verifier boundary'
);

assert.doesNotMatch(
  source,
  /function buildGhNewLink|function buildGhEditFileLink|async function computeMissingFiles|function openVerifyModal|async function afterAllGood|Verify Setup - Missing Files|Verify Setup – Missing Files/,
  'setup verification scanning, modal rendering, and GitHub link details should stay outside the main composer shell'
);

assert.match(
  composerSetupVerifierSource,
  /export function createComposerSetupVerifier\(options = \{\}\)[\s\S]*async function computeMissingFiles\(preferredKind\)[\s\S]*function openVerifyModal\(missing, targetKind\)[\s\S]*async function afterAllGood\(targetKind\)[\s\S]*function bindVerifySetup\(\)/,
  'setup verifier should own missing-file checks, verify modal rendering, YAML drift handling, and binding'
);

assert.match(
  source,
  /from '\.\/composer-mode-controller\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted mode controller boundary'
);

assert.match(
  source,
  /from '\.\/composer-service-registry\.js\?v=[\w.-]+'/,
  'composer should cache-bust the explicit composer service registry boundary'
);

assert.match(
  source,
  /from '\.\/composer-file-panel-controller\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted file panel controller boundary'
);

assert.match(
  source,
  /const composerFilePanelController = createComposerFilePanelController\(\{[\s\S]*storage: editorRuntime\.storage,[\s\S]*storageKey: scopedEditorStorageKey\(LS_KEYS\.cfile\),[\s\S]*prefersReducedMotion: composerPrefersReducedMotion,[\s\S]*onPanelStateApplied:/,
  'composer should wire the file panel controller as an app-service boundary'
);

assert.doesNotMatch(
  source,
  /let\s+(?:activeComposerFile|composerViewTransition)\s*=|function cancelComposerViewTransition|document\.getElementById\('composerPanels'\)|document\.documentElement\.setAttribute\('data-init-cfile'/,
  'composer should not own file panel state, panel transition state, or init-file DOM toggling directly'
);

assert.match(
  composerFilePanelControllerSource,
  /export function createComposerFilePanelController\(options = \{\}\)[\s\S]*function getInitialComposerFile\(\)[\s\S]*function applyComposerFile\(name, applyOptions = \{\}\)[\s\S]*function setComposerFile\(name, applyOptions = \{\}\)/,
  'file panel controller should own initial file resolution, active file application, persistence, and transitions'
);

assert.match(
  source,
  /from '\.\/composer-editor-detail-panel-controller\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted editor detail panel controller boundary'
);

assert.match(
  source,
  /const editorDetailPanelController = createComposerEditorDetailPanelController\(\{[\s\S]*setSystemPanelVisible: \(visible\) => setEditorSystemPanelVisible\(visible\),[\s\S]*showSystemPanel: \(mode\) => showEditorSystemPanel\(mode\)[\s\S]*\}\);[\s\S]*animateEditorMarkdownPanelContent,[\s\S]*animateEditorStructurePanelContent,[\s\S]*setEditorDetailPanelMode,[\s\S]*setEditorStructurePanelVisible/,
  'composer should wire editor detail panels through a focused controller'
);

assert.doesNotMatch(
  source,
  /function setEditorMarkdownPanelVisible|function setEditorStructurePanelVisible|function setEditorDetailPanelMode|function animateEditorStructurePanelContent|function animateEditorMarkdownPanelContent|document\.getElementById\('editorStructurePanel'\)|document\.getElementById\('editorMarkdownPanel'\)/,
  'composer should not own editor detail panel DOM visibility or animation timers directly'
);

assert.match(
  composerEditorDetailPanelControllerSource,
  /export function createComposerEditorDetailPanelController\(options = \{\}\)[\s\S]*function setEditorDetailPanelMode\(mode\)[\s\S]*function animateEditorStructurePanelContent\(panel = getStructurePanel\(\)\)[\s\S]*function animateEditorMarkdownPanelContent\(panel = getMarkdownPanel\(\)\)/,
  'editor detail panel controller should own panel mode routing and panel content animations'
);

assert.match(
  source,
  /from '\.\/composer-yaml-panels-controller\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted YAML panels controller boundary'
);

assert.match(
  source,
  /const composerYamlPanelsController = createComposerYamlPanelsController\(\{[\s\S]*buildIndexUI: \(root, state\) => composerIndexTabsUi\.buildIndexUI\(root, state\),[\s\S]*buildTabsUI: \(root, state\) => composerIndexTabsUi\.buildTabsUI\(root, state\),[\s\S]*buildSiteUI: \(root, state\) => composerSiteSettingsUi\.buildSiteUI\(root, state\),[\s\S]*updateMarkdownDraftIndicators: \(\) => updateComposerMarkdownDraftIndicators\(\)[\s\S]*\}\);/,
  'composer should wire YAML panel rebuilds through a focused controller'
);

assert.match(
  source,
  /function rebuildIndexUI\(preserveOpen = true\) \{\s*return composerYamlPanelsController\.rebuildIndexUI\(preserveOpen\);\s*\}[\s\S]*function rebuildTabsUI\(preserveOpen = true\) \{\s*return composerYamlPanelsController\.rebuildTabsUI\(preserveOpen\);\s*\}/,
  'composer rebuild wrappers should delegate to the YAML panels controller for early callback wiring'
);

assert.match(
  source,
  /function rebuildSiteUI\(\) \{\s*return composerYamlPanelsController\.rebuildSiteUI\(\);\s*\}/,
  'composer site rebuild wrapper should delegate to the YAML panels controller'
);

assert.doesNotMatch(
  source,
  /function getDynamicTabsContainer|document\.getElementById\('modeDynamicTabs'\)|document\.getElementById\('composerIndex'\)|document\.getElementById\('composerTabs'\)|document\.getElementById\('composerSite'\)/,
  'composer should not own YAML panel root DOM lookups directly'
);

assert.match(
  composerYamlPanelsControllerSource,
  /export function createComposerYamlPanelsController\(options = \{\}\)[\s\S]*function updateDynamicTabsGroupState\(\)[\s\S]*function rebuildIndexUI\(preserveOpen = true\)[\s\S]*function rebuildTabsUI\(preserveOpen = true\)[\s\S]*function rebuildSiteUI\(\)/,
  'YAML panels controller should own dynamic tab group state and YAML panel rebuilds'
);

assert.match(
  source,
  /const composerServices = createComposerServiceRegistry\(\);[\s\S]*composerServices\.setMarkdownDraftController\(createComposerMarkdownDraftController\(\{[\s\S]*composerServices\.setMarkdownLoader\(createComposerMarkdownLoader\(\{[\s\S]*composerServices\.setMarkdownActionsUi\(createComposerMarkdownActionsUi\(\{[\s\S]*composerServices\.setMarkdownSessionController\(createComposerMarkdownSessionController\(\{[\s\S]*composerServices\.setMarkdownWorkspaceController\(createComposerMarkdownWorkspaceController\(\{[\s\S]*composerServices\.setModeController\(createComposerModeController\(\{[\s\S]*composerServices\.setUnsyncedSummaryController\(createComposerUnsyncedSummaryController\(\{/,
  'composer should register late-bound controllers through the explicit composer service registry'
);

assert.doesNotMatch(
  source,
  /let\s+(?:markdownLoader|markdownActionsUi|markdownDraftController|markdownSessionController|markdownWorkspaceController|modeController|unsyncedSummaryController)\s*=|(?:markdownLoader|markdownActionsUi|markdownDraftController|markdownSessionController|markdownWorkspaceController|modeController|unsyncedSummaryController)\s*=\s*create/,
  'composer should not own ad hoc late-bound controller slots at the root'
);

assert.match(
  composerServiceRegistrySource,
  /const SERVICE_NAMES = \[[\s\S]*'markdownActionsUi'[\s\S]*'markdownDraftController'[\s\S]*'markdownLoader'[\s\S]*'markdownSessionController'[\s\S]*'markdownWorkspaceController'[\s\S]*'modeController'[\s\S]*'unsyncedSummaryController'[\s\S]*\];/,
  'composer service registry should name every allowed late-bound composer dependency'
);

assert.match(
  composerServiceRegistrySource,
  /getCurrentMode: \(\) => call\('modeController', 'getCurrentMode', null\),[\s\S]*getMarkdownDraftController: \(\) => requireService\('markdownDraftController', 'Markdown draft controller'\),[\s\S]*getMarkdownWorkspaceController: \(\) => requireService\('markdownWorkspaceController', 'Markdown workspace controller'\),[\s\S]*setModeController: \(service\) => set\('modeController', service\),/,
  'composer service registry should expose explicit service getters and setters instead of anonymous root slots'
);

assert.match(
  source,
  /function applyMode\(mode, options = \{\}\) \{\s*composerServices\.applyMode\(mode, options\);\s*\}/,
  'composer applyMode should delegate through the composer service registry'
);

assert.match(
  composerModeControllerSource,
  /export function createComposerModeController\(options = \{\}\)[\s\S]*function applyMode\(mode, optionsForMode = \{\}\)[\s\S]*getFirstDynamicModeId\(\)[\s\S]*setSystemDetailMode\(nextMode, optionsForMode\)[\s\S]*persistDynamicEditorState\(\)/,
  'mode controller should own mode routing, system detail routing, and mode persistence'
);

assert.match(
  composerModeControllerSource,
  /function applyDynamicMode\(nextMode, optionsForMode, editorApi\)[\s\S]*activateDynamicMode\(nextMode\)[\s\S]*setEditorDetailPanelMode\('markdown'\)[\s\S]*loadDynamicTabContent\(tab\)/,
  'mode controller should own dynamic Markdown activation, panel switching, and lazy content application'
);

assert.match(
  source,
  /from '\.\/composer-unsynced-summary\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted unsynced summary controller boundary'
);

assert.match(
  source,
  /function collectUnsyncedMarkdownEntries\(\) \{\s*return getUnsyncedSummaryController\(\)\.collectUnsyncedMarkdownEntries\(\);\s*\}[\s\S]*function computeUnsyncedSummary\(\) \{\s*return getUnsyncedSummaryController\(\)\.computeUnsyncedSummary\(\);\s*\}[\s\S]*function updateModeDirtyIndicators\(summaryEntries\) \{\s*getUnsyncedSummaryController\(\)\.updateModeDirtyIndicators\(summaryEntries\);\s*\}[\s\S]*function updateUnsyncedSummary\(options = \{\}\) \{\s*return getUnsyncedSummaryController\(\)\.updateUnsyncedSummary\(options\);\s*\}/,
  'composer unsynced summary helpers should delegate to the extracted controller'
);

assert.doesNotMatch(
  source,
  /function getModeTabButton|function getModeTabBaseLabel|function ensureModeTabBadgeElement|function applyModeTabBadgeState|function updateReviewButton|function updateDiscardButtonVisibility/,
  'mode tab badges and review/discard button rendering should stay outside the main composer shell'
);

assert.match(
  composerUnsyncedSummarySource,
  /export function createComposerUnsyncedSummaryController\(options = \{\}\)[\s\S]*function collectUnsyncedMarkdownEntries\(\)[\s\S]*function computeUnsyncedSummary\(\)[\s\S]*function updateModeDirtyIndicators\(summaryEntries\)[\s\S]*function updateUnsyncedSummary\(updateOptions = \{\}\)/,
  'unsynced summary controller should own summary aggregation, mode badges, and review/discard button updates'
);

assert.match(
  source,
  /from '\.\/composer-runtime-styles\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted runtime style boundary'
);

assert.doesNotMatch(
  source,
  /function injectComposerStyles|Minimal styles injected for composer behaviors|const css = `[\s\S]*\.ci-item/,
  'composer should not inline the runtime style sheet'
);

assert.match(
  source,
  /injectComposerRuntimeStyles\(\{ documentRef: composerDocument \}\);/,
  'composer should delegate runtime style injection through the runtime document ref'
);

assert.match(
  composerRuntimeStylesSource,
  /export function injectComposerRuntimeStyles\(options = \{\}\)[\s\S]*composer-runtime-styles[\s\S]*\.ci-item[\s\S]*\.cs-publish-transport-settings[\s\S]*@keyframes nsModalFadeIn/,
  'runtime style module should own composer list, site settings, publish transport, and modal animation styles'
);

assert.match(
  composerRuntimeSource,
  /from '\.\/editor-app-runtime\.js\?v=[\w.-]+'/,
  'composer runtime should cache-bust the shared editor app runtime boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-runtime\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor main runtime boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-metadata-panel\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor main metadata panel boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-preview-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor preview session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-current-file-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor current-file session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-sidebar-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor sidebar session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-toolbar-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor toolbar session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-image-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor image session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-link-card-context\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor link-card context boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-workspace-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor workspace session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-blocks-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor blocks session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-document-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor document session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-content-service\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor content service boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-file-context-service\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor file context service boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-language-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor language session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-scroll-session\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor scroll session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-shell-service\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor shell service boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-service-registry\.js\?v=[\w.-]+'/,
  'editor main should cache-bust the editor service registry boundary'
);

assert.match(
  editorMainSource,
  /const editorMainRuntime = createEditorMainRuntime\(\);\s*const editorMainDocument = editorMainRuntime\.documentRef;\s*const editorMainWindow = editorMainRuntime\.windowRef;[\s\S]*const appServices = createEditorMainServiceRegistry\(\);[\s\S]*const metadataPanel = appServices\.setMetadataPanel\(createEditorMainMetadataPanel\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*documentRef: editorMainDocument,[\s\S]*windowRef: editorMainWindow,[\s\S]*translate: t,[\s\S]*getCurrentLang,[\s\S]*normalizeLangKey,[\s\S]*getContentRoot,[\s\S]*onChange: appServices\.notifyDocumentChange[\s\S]*\}\)\);/,
  'editor main should compose front matter and tabs metadata through the metadata panel session'
);

assert.match(
  editorMainSource,
  /const linkCardContext = createEditorMainLinkCardContext\(\{[\s\S]*getCurrentLang,[\s\S]*normalizeLangKey,[\s\S]*getContentRoot,[\s\S]*fetch: \(url, options\) => editorMainRuntime\.fetchContent\(url, options\),[\s\S]*translate: t,[\s\S]*makeHref: \(loc\) => withLangParam\(`\?id=\$\{encodeURIComponent\(loc\)\}`\)[\s\S]*\}\);/,
  'editor main should compose link-card index state through the explicit link-card context service'
);

assert.match(
  editorMainSource,
  /const shellService = createEditorMainShellService\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*editor,[\s\S]*textarea: ta[\s\S]*\}\);/,
  'editor main should compose layout refresh and editor toasts through the shell service'
);

assert.match(
  editorMainSource,
  /const workspaceSession = appServices\.setWorkspaceSession\(createEditorMainWorkspaceSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*documentRef: editorMainDocument,[\s\S]*forceMarkdownWrap: FORCE_MARKDOWN_WRAP,[\s\S]*editor,[\s\S]*textarea: ta,[\s\S]*getPreviewSession: appServices\.getPreviewSession,[\s\S]*getBlocksEditor: appServices\.getBlocksEditor,[\s\S]*syncBlocksFromSource: appServices\.syncBlocksFromSource,[\s\S]*requestLayout: shellService\.requestLayout[\s\S]*\}\)\);[\s\S]*workspaceSession\.initialize\(\);/,
  'editor main should compose workspace view, wrap, preview button, and empty-state controls through the workspace session'
);

assert.match(
  editorMainSource,
  /const documentSession = appServices\.setDocumentSession\(createEditorMainDocumentSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*editor,[\s\S]*textarea: ta,[\s\S]*metadataPanel,[\s\S]*workspaceSession,[\s\S]*getPreviewSession: appServices\.getPreviewSession,[\s\S]*getBlocksSession: appServices\.getBlocksSession,[\s\S]*requestLayout: shellService\.requestLayout,[\s\S]*setBaseDir: contentService\.setBaseDir,[\s\S]*setCurrentFileLabel: fileContextService\.setCurrentFileLabel[\s\S]*\}\)\);/,
  'editor main should compose document value, input, change listeners, and primary-editor API through the document session'
);

assert.match(
  editorMainSource,
  /const contentService = appServices\.setContentService\(createEditorMainContentService\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*getContentRoot,[\s\S]*fetch: \(url, options\) => editorMainRuntime\.fetchContent\(url, options\),[\s\S]*linkCardContext,[\s\S]*getPreviewSession: appServices\.getPreviewSession,[\s\S]*getDocumentSession: appServices\.getDocumentSession,[\s\S]*getWorkspaceSession: appServices\.getWorkspaceSession,[\s\S]*setCurrentFileLabel: fileContextService\.setCurrentFileLabel[\s\S]*alert: \(message\) => editorMainRuntime\.showAlert\(message\)[\s\S]*\}\)\);/,
  'editor main should compose site config, content loading, and open-markdown orchestration through the content service'
);

assert.match(
  editorMainSource,
  /const fileContextService = createEditorMainFileContextService\(\{[\s\S]*getCurrentFileSession: appServices\.getCurrentFileSession,[\s\S]*getMetadataPanel: appServices\.getMetadataPanel,[\s\S]*getPreviewSession: appServices\.getPreviewSession,[\s\S]*getDocumentSession: appServices\.getDocumentSession[\s\S]*\}\);/,
  'editor main should compose current-file cross-session fan-out through the file context service'
);

assert.match(
  editorMainSource,
  /const languageSession = createEditorMainLanguageSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*getToolbarSession: appServices\.getToolbarSession,[\s\S]*getCurrentFileSession: appServices\.getCurrentFileSession,[\s\S]*getBlocksSession: appServices\.getBlocksSession,[\s\S]*getMetadataPanel: appServices\.getMetadataPanel[\s\S]*\}\);[\s\S]*languageSession\.bind\(\);/,
  'editor main should compose language-event fan-out through the language session'
);

assert.match(
  editorMainSource,
  /const scrollSession = createEditorMainScrollSession\(\{ runtime: editorMainRuntime \}\);[\s\S]*scrollSession\.bind\(\);/,
  'editor main should compose back-to-top scroll UI through the scroll session'
);

assert.match(
  editorMainSource,
  /const currentFileSession = appServices\.setCurrentFileSession\(createEditorMainCurrentFileSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*documentRef: editorMainDocument,[\s\S]*translate: t,[\s\S]*getCurrentLang,[\s\S]*normalizeLangKey,[\s\S]*inferCurrentFileSource: fileContextService\.inferCurrentFileSource,[\s\S]*applyEditorEmptyState: workspaceSession\.applyEditorEmptyState,[\s\S]*onRendered: fileContextService\.handleCurrentFileRendered[\s\S]*\}\)\);/,
  'editor main should compose current file state and header rendering through the current-file session'
);

assert.match(
  editorMainSource,
  /const previewSession = appServices\.setPreviewSession\(createEditorMainPreviewSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*documentRef: editorMainDocument,[\s\S]*windowRef: editorMainWindow,[\s\S]*getContentRoot,[\s\S]*getEditorValue: appServices\.getEditorValue,[\s\S]*getCurrentFileInfo: fileContextService\.getCurrentFileInfo,[\s\S]*getSiteConfig: appServices\.getSiteConfig,[\s\S]*getPostsIndex: \(\) => linkCardContext\.getPostsIndex\(\),[\s\S]*getPostsByLocationTitle: \(\) => linkCardContext\.getPostsByLocationTitle\(\),[\s\S]*isLinkCardReady: \(\) => linkCardContext\.isReady\(\),[\s\S]*getAllowedLocations: \(\) => linkCardContext\.getAllowedLocations\(\),[\s\S]*getLocationAliases: \(\) => linkCardContext\.getLocationAliases\(\),[\s\S]*fetch: \(url, options\) => editorMainRuntime\.fetchContent\(url, options\)[\s\S]*\}\)\);[\s\S]*previewSession\.bind\(\);/,
  'editor main should compose preview overlay, iframe messaging, and asset-preview state through the preview session'
);

assert.match(
  editorMainSource,
  /const sidebarSession = createEditorMainSidebarSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*documentRef: editorMainDocument,[\s\S]*windowRef: editorMainWindow,[\s\S]*normalizeLangKey,[\s\S]*bindCurrentFileElement: fileContextService\.bindCurrentFileElement,[\s\S]*loadSiteConfig: contentService\.loadSiteConfig,[\s\S]*loadIndexData: contentService\.loadIndexData,[\s\S]*loadTabsConfig: contentService\.loadTabsConfig,[\s\S]*onSiteConfigLoaded: contentService\.handleSiteConfigLoaded,[\s\S]*onIndexLoaded: contentService\.handleIndexLoaded,[\s\S]*onOpenMarkdown: contentService\.openMarkdown,[\s\S]*onWarn: contentService\.warn,[\s\S]*alert: contentService\.alert[\s\S]*\}\);[\s\S]*sidebarSession\.initialize\(\);/,
  'editor main should compose file sidebar rendering through the sidebar session and route loading/open actions through the content service'
);

assert.match(
  editorMainSource,
  /const toolbarSession = appServices\.setToolbarSession\(createEditorMainToolbarSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*documentRef: editorMainDocument,[\s\S]*windowRef: editorMainWindow,[\s\S]*translate: t,[\s\S]*getEditorTextarea: documentSession\.getEditorTextarea,[\s\S]*editorToolbarEl,[\s\S]*cardButton,[\s\S]*cardPopover,[\s\S]*cardSearchInput,[\s\S]*cardListEl,[\s\S]*cardEmptyEl,[\s\S]*getCardEntries: \(\) => linkCardContext\.getCardEntries\(\)[\s\S]*\}\)\);[\s\S]*toolbarSession\.bind\(\);/,
  'editor main should compose markdown toolbar and article-card picker through the toolbar session'
);

assert.match(
  editorMainSource,
  /const imageSession = appServices\.setImageSession\(createEditorMainImageSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*windowRef: editorMainWindow,[\s\S]*translate: t,[\s\S]*imageButton,[\s\S]*imageInput,[\s\S]*getCurrentMarkdownPath: fileContextService\.getCurrentMarkdownPath,[\s\S]*getContentRoot,[\s\S]*getEditorTextarea: documentSession\.getEditorTextarea,[\s\S]*getEditorBody: documentSession\.getEditorBody,[\s\S]*buildMarkdown: documentSession\.buildMarkdown,[\s\S]*setValue: documentSession\.setValue,[\s\S]*getBlocksEditor: appServices\.getBlocksEditor,[\s\S]*emitToast: shellService\.emitToast[\s\S]*\}\)\);/,
  'editor main should compose image picker, upload, drop, and block image actions through the image session'
);

assert.match(
  editorMainSource,
  /const blocksSession = appServices\.setBlocksSession\(createEditorMainBlocksSession\(\{[\s\S]*runtime: editorMainRuntime,[\s\S]*root: blocksWrap,[\s\S]*translate: t,[\s\S]*getContentRoot,[\s\S]*getEditorBody: documentSession\.getEditorBody,[\s\S]*onBodyChange: documentSession\.setBodyFromBlocks,[\s\S]*getCurrentMarkdownPath: fileContextService\.getCurrentMarkdownPath,[\s\S]*getSiteConfig: appServices\.getSiteConfig,[\s\S]*getPreviewSession: appServices\.getPreviewSession,[\s\S]*getImageSession: appServices\.getImageSession,[\s\S]*linkCardContext,[\s\S]*resolveImageSrc[\s\S]*\}\)\);[\s\S]*blocksSession\.initialize\(\);/,
  'editor main should compose the Blocks editor through an explicit blocks session service'
);

assert.doesNotMatch(
  editorMainSource,
  /const frontMatterManager = \(\(\) =>|const tabsMetadataManager = \(\(\) =>|function syncFrontMatterLabelWidth|FRONT_MATTER_SECTION_DESCRIPTIONS|buildMarkdownWithFrontMatter|parseMarkdownFrontMatter|resolveFrontMatterBindings/,
  'editor main root should not own front matter or tabs metadata panel internals'
);

assert.doesNotMatch(
  editorMainSource,
  /previewAssetBuckets|previewFrameReady|previewRenderRequestId|previewThemeOverride|PREVIEW_RENDER_MESSAGE|function sanitizePreviewThemePack|function updatePreviewThemeSelect|function renderPreview|const openPreviewOverlay|const startPreviewResize|const flushPendingPreview|const loadPreviewThemeOptions|applyPreviewAssetOverrides\(/,
  'editor main root should not own preview overlay, iframe message, theme selector, or asset override internals'
);

assert.doesNotMatch(
  editorMainSource,
  /let currentFileInfo|let currentFileElRef|STATUS_LABEL_KEYS|STATUS_STATES|normalizeCurrentFileBreadcrumb|normalizeCurrentFilePayload|renderCurrentFileBreadcrumb|renderCurrentFileIndicator|formatRelativeTime|getPlainText/,
  'editor main root should not own current-file state normalization, breadcrumb rendering, draft labels, or header DOM internals'
);

assert.doesNotMatch(
  editorMainSource,
  /initArticleBrowser|renderGroupedIndex|renderGroupedTabs|makeGroupHeader|makeSubHeader|compareVersionDesc|let currentActive|let activeGroup|document\.getElementById\('listIndex'\)|document\.getElementById\('groupTabs'\)|document\.querySelectorAll\('\.sidebar-tab'\)/,
  'editor main root should not own sidebar file tree rendering, filter state, group switching, or active row state'
);

assert.doesNotMatch(
  editorMainSource,
  /lastSelectionRange|suppressSelectionTracking|formattingButtons|cardPopoverOpen|renderCardPickerList|openCardPopover|closeCardPopover|applyInlineFormat|toggleLinePrefix|applyCodeBlockFormat|insertCardLink|BUTTON_DISABLED_HINT_KEYS|applyButtonTooltipState|registerButtonTooltip/,
  'editor main root should not own markdown toolbar selection state, formatting actions, or article-card popover internals'
);

assert.doesNotMatch(
  editorMainSource,
  /pendingBlocksImageInsert|pendingImagePickerToken|openImageInputPicker|readFileAsBase64|slugifyAssetBase|inferAssetExtension|buildAssetFileMeta|computeAssetPaths|insertImageMarkdown|isImageFile|containsImageFile|handleImageFiles|insertImageMarkdownAtSelection|resolveLocalMarkdownAssetReference|new FileReader|new MouseEvent|emitAssetAdded\(|requestAssetDelete\(|emitAssetDeleteCanceled\(/,
  'editor main root should not own image picker, file reading, asset path derivation, markdown insertion, or asset event internals'
);

assert.doesNotMatch(
  editorMainSource,
  /fetchMarkdownForLinkCard|rebuildLinkCardContext|editorAllowedLocations|editorLocationAliasMap|editorPostsByLocationTitle|editorPostsIndexCache|editorPostPickerEntries|editorLinkCardContextListeners|linkCardReady/,
  'editor main root should not own link-card index state, picker entries, alias maps, or context listener fan-out'
);

assert.doesNotMatch(
  editorMainSource,
  /function switchView|let wrapEnabled|const applyEditorEmptyState|const applyWrapState|const handleWrapSelection|wrapToggleButtons\.forEach|const previewOpenButton|document\.querySelectorAll\('\.vt-btn\[data-view\]'\)|document\.querySelector\('\.view-toggle'\)/,
  'editor main root should not own workspace view switching, wrap toggle state, empty-state DOM, or preview button bindings'
);

assert.doesNotMatch(
  editorMainSource,
  /createMarkdownBlocksEditor|hydrateInternalLinkCards|let markdownBlocksEditor|syncMarkdownBlocksFromSource|blockLabelFallbacks|const blockLabels|handleBlocksCardContextUpdate|requestImageUpload: \(detail\) => imageSession\.requestBlocksImageUpload/,
  'editor main root should not own Blocks editor construction, block labels, card-entry fan-out, or block image callback plumbing'
);

assert.doesNotMatch(
  editorMainSource,
  /const changeListeners = new Set|const notifyChange = \(\)|const getEditorBody = \(\)|const getValue = \(\)|const setValue = \(value|const setEditorBodyFromBlocks = \(body\)|const getEditorTextarea = \(\)|const handleInput = \(\)|const primaryEditorApi = \{|registerPrimaryEditorApi\(primaryEditorApi\)/,
  'editor main root should not own document value, input binding, change listeners, or primary-editor API assembly'
);

assert.doesNotMatch(
  editorMainSource,
  /let editorSiteConfig|configureFetchCachePolicy|fetchMergedSiteConfig|fetchConfigWithYamlFallback|loadContentJsonWithRaw|editorMainRuntime\.onSiteConfigChange|const response = await fetch\(url, \{ cache: 'no-store' \}\)|lastSlash = relPath\.lastIndexOf|linkCardContext\.rebuild\(posts, rawIndex\)/,
  'editor main root should not own site config state, content index loading, tabs config loading, or open-markdown persistence orchestration'
);

assert.doesNotMatch(
  editorMainSource,
  /documentRef: document|windowRef: window|window\.alert|localStorage\.(?:getItem|setItem)|window\.__press_editor_base_dir|window\.__press_primary_editor|window\.dispatchEvent\(new CustomEvent\('press-editor-|document\.dispatchEvent\(new CustomEvent\('press-editor-current-file-breadcrumb-select'|window\.(?:addEventListener|removeEventListener|setTimeout|clearTimeout|requestAnimationFrame|cancelAnimationFrame|matchMedia|scrollTo)|document\.(?:addEventListener|removeEventListener)|requestAnimationFrame\(|cancelAnimationFrame\(|setTimeout\(|clearTimeout\(/,
  'editor main should route document/window refs, editor storage, app events, global listeners, timers, animation frames, dialogs, and scroll controls through its runtime boundary'
);

assert.match(
  editorMainRuntimeSource,
  /export function createEditorMainRuntime\(options = \{\}\) \{[\s\S]*function onDocumentReady\(handler\)[\s\S]*readMarkdownEditorView\(\)[\s\S]*persistMarkdownEditorView\(mode\)[\s\S]*readWrapEnabled\(\{ force = false \} = \{\}\)[\s\S]*setEditorBaseDir\(dir, fallback = 'wwwroot\/'\)[\s\S]*registerPrimaryEditorApi\(api\)[\s\S]*function fetchContent\(url, options\)[\s\S]*function showAlert\(message\)[\s\S]*prefersReducedMotion\(\)[\s\S]*requestAssetDelete\(detail\)[\s\S]*emitCurrentFileBreadcrumbSelect\(detail\)[\s\S]*documentRef: runtime\.documentRef,[\s\S]*windowRef: runtime\.windowRef,[\s\S]*onDocumentReady,[\s\S]*onDocument: runtime\.events\.onDocument,[\s\S]*onWindow: runtime\.events\.onWindow,[\s\S]*requestFrame: runtime\.browser\.requestFrame,[\s\S]*setTimer: runtime\.browser\.setTimer,[\s\S]*postMessage: runtime\.browser\.postMessage,[\s\S]*scrollToTop: runtime\.browser\.scrollToTop[\s\S]*fetchContent,[\s\S]*showAlert/,
  'editor main runtime should own storage, browser global, and cross-component event service adapters'
);

assert.match(
  editorMainSource,
  /editorMainRuntime\.onDocumentReady\(\(\) => \{[\s\S]*const ta = editorMainRuntime\.getElementById\('mdInput'\)[\s\S]*const appServices = createEditorMainServiceRegistry\(\);[\s\S]*const previewSession = appServices\.setPreviewSession\(createEditorMainPreviewSession[\s\S]*previewSession\.bind\(\);/,
  'editor main startup should wire the preview session through the editor runtime boundary'
);

assert.match(
  editorMainPreviewSessionSource,
  /onWindow\('press-editor-asset-preview'[\s\S]*onWindow\('message'[\s\S]*onDocument\('keydown'/,
  'editor preview session should own asset-preview, iframe message, and Escape-key event bindings through the runtime boundary'
);

assert.match(
  editorMainSidebarSessionSource,
  /export function createEditorMainSidebarSession\(options = \{\}\) \{[\s\S]*let currentActive = null;[\s\S]*let activeGroup = 'index';[\s\S]*const renderGroupedIndex = \(root, data\) => \{[\s\S]*const renderGroupedTabs = \(root, data\) => \{[\s\S]*const applyFilter = \(term\) => \{[\s\S]*const switchGroup = \(name\) => \{[\s\S]*const initialize = \(\) => \{[\s\S]*bind\(\);[\s\S]*return load\(\);/,
  'editor sidebar session should own file list active state, grouped rendering, filtering, group switching, and initialization'
);

assert.match(
  editorMainToolbarSessionSource,
  /export function createEditorMainToolbarSession\(options = \{\}\) \{[\s\S]*let lastSelectionRange = \{ start: 0, end: 0 \};[\s\S]*let suppressSelectionTracking = false;[\s\S]*let formattingButtons = \[\];[\s\S]*let cardPopoverOpen = false;[\s\S]*function applyButtonTooltipState\(button, disabled\)[\s\S]*const applyInlineFormat = \(prefix, suffix\) => \{[\s\S]*const toggleLinePrefix = \(prefix\) => \{[\s\S]*const applyCodeBlockFormat = \(\) => \{[\s\S]*const insertCardLink = \(entry\) => \{[\s\S]*const renderCardPickerList = \(term = ''\) => \{[\s\S]*const openCardPopover = \(\) => \{[\s\S]*const bind = \(\) => \{[\s\S]*bindCardPicker\(\);[\s\S]*bindFormattingButtons\(\);[\s\S]*bindSelectionTracking\(\);/,
  'editor toolbar session should own selection tracking, markdown formatting actions, and article-card picker lifecycle'
);

assert.match(
  editorMainToolbarSessionSource,
  /const onDocument = typeof runtime\.onDocument === 'function'[\s\S]*const onWindow = typeof runtime\.onWindow === 'function'[\s\S]*const setTimer = typeof runtime\.setTimer === 'function'[\s\S]*const clearTimer = typeof runtime\.clearTimer === 'function'[\s\S]*detachCardMouseDown = onDocument\('mousedown', handleCardOutsideClick, true\);[\s\S]*detachCardResize = onWindow\('resize', handleCardRelayout, true\);/,
  'editor toolbar session should route popover document/window/timer effects through the runtime boundary'
);

assert.match(
  editorMainImageSessionSource,
  /export function createEditorMainImageSession\(options = \{\}\) \{[\s\S]*let pendingBlocksImageInsert = null;[\s\S]*let pendingImagePickerToken = 0;[\s\S]*const readFileAsBase64 = \(file\) => new Promise[\s\S]*const buildAssetFileMeta = \(file\) => \{[\s\S]*const insertImageMarkdown = \(relativePath, altText\) => \{[\s\S]*const handleImageFiles = async \(fileList, opts = \{\}\) => \{[\s\S]*const openImageInputPicker = \(\) => \{[\s\S]*const requestBlocksImageUpload = \(\{ index, replaceIndex, replaceBlockId \} = \{\}\) => \{[\s\S]*const requestBlocksImageDelete = \(\{ index, blockId, src \} = \{\}\) => \{[\s\S]*const bind = \(\) => \{/,
  'editor image session should own picker pending state, file reading, markdown insertion, block image actions, and binding'
);

assert.match(
  editorMainImageSessionSource,
  /import \{ insertImageMarkdownAtSelection \} from '\.\/editor-markdown-ops\.js';[\s\S]*import \{ resolveLocalMarkdownAssetReference \} from '\.\/repository-deletions\.js\?v=[\w.-]+';[\s\S]*const onWindow = typeof runtime\.onWindow === 'function'[\s\S]*const setTimer = typeof runtime\.setTimer === 'function'[\s\S]*runtime\.emitAssetAdded\([\s\S]*runtime\.requestAssetDelete\(detail\)[\s\S]*runtime\.emitAssetDeleteCanceled\(detail\)/,
  'editor image session should route markdown-image operations and asset events through explicit dependencies and runtime services'
);

assert.match(
  editorMainLinkCardContextSource,
  /export function createEditorMainLinkCardContext\(options = \{\}\) \{[\s\S]*let allowedLocations = new Set\(\);[\s\S]*let postsByLocationTitle = \{\};[\s\S]*let locationAliasMap = new Map\(\);[\s\S]*let postsIndexCache = \{\};[\s\S]*let cardEntries = \[\];[\s\S]*let ready = false;[\s\S]*const rebuild = \(posts, rawIndex\) => \{[\s\S]*notifyCardEntries\(\);[\s\S]*createHydrateOptions[\s\S]*onCardEntriesChange/,
  'editor link-card context should own index state, card picker entries, readiness, and subscriber fan-out'
);

assert.match(
  editorMainLinkCardContextSource,
  /collectAllowedLocations\(posts, rawIndex\)[\s\S]*indexPostsByLocation\(posts\)[\s\S]*buildPickerState\(posts, rawIndex, options\)[\s\S]*fetchMarkdown = \(loc\) => \{[\s\S]*`\$\{getContentRoot\(\)\}\/\$\{loc\}`[\s\S]*makeHref/,
  'editor link-card context should centralize content-index normalization, markdown fetching, and link-card hydrate options'
);

assert.match(
  editorMainWorkspaceSessionSource,
  /export function createEditorMainWorkspaceSession\(options = \{\}\) \{[\s\S]*let wrapEnabled = false;[\s\S]*const applyEditorEmptyState = \(isEmpty\) => \{[\s\S]*const applyWrapState = \(value, opts = \{\}\) => \{[\s\S]*const switchView = \(mode\) => \{[\s\S]*const setView = \(mode, opts = \{\}\) => \{[\s\S]*const bind = \(\) => \{[\s\S]*bindWrapToggle\(\);[\s\S]*bindViewToggle\(\);[\s\S]*bindPreviewButton\(\);/,
  'editor workspace session should own wrap state, empty-state DOM, view switching, preview button binding, and workspace event binding'
);

assert.match(
  editorMainWorkspaceSessionSource,
  /readWrapEnabled\(\{ force: forceMarkdownWrap \}\)[\s\S]*persistWrapEnabled\(on\)[\s\S]*readMarkdownEditorView\(\)[\s\S]*persistMarkdownEditorView\(mode\)[\s\S]*getBlocksEditor\(\)[\s\S]*normalizeMarkdownEditorView\(mode\)[\s\S]*getPreviewSession\(\)/,
  'editor workspace session should route storage and cross-session calls through explicit runtime and dependency accessors'
);

assert.match(
  editorMainBlocksSessionSource,
  /import \{ createMarkdownBlocksEditor \} from '\.\/editor-blocks\.js\?v=[\w.-]+';[\s\S]*import \{ hydrateInternalLinkCards \} from '\.\/link-cards\.js\?v=[\w.-]+';[\s\S]*const blockLabelFallbacks = \{/,
  'editor blocks session should own block editor imports and local fallback labels'
);

assert.match(
  editorMainBlocksSessionSource,
  /export function createEditorMainBlocksSession\(options = \{\}\) \{[\s\S]*const createBlocksEditor = typeof options\.createBlocksEditor === 'function'[\s\S]*const hydrateLinkCards = typeof options\.hydrateLinkCards === 'function'[\s\S]*const setCardEntries = \(entries\) => \{[\s\S]*blocksEditor\.setCardEntries\(Array\.isArray\(entries\) \? entries : fallback\);[\s\S]*const bindCardEntries = \(\) => \{[\s\S]*linkCardContext\.onCardEntriesChange\(\(entries\) => setCardEntries\(entries\)\);[\s\S]*const initialize = \(\) => \{[\s\S]*blocksEditor = createBlocksEditor\(root, \{[\s\S]*labels: createBlockLabels\(translate\),[\s\S]*onChange: onBodyChange,[\s\S]*hydrateImages,[\s\S]*hydrateCard,[\s\S]*requestImageUpload,[\s\S]*canDeleteImageResource,[\s\S]*requestImageDelete[\s\S]*\}\);/,
  'editor blocks session should own blocks-editor construction, card entry subscription, hydration, and image callbacks'
);

assert.match(
  editorMainBlocksSessionSource,
  /const syncFromSource = \(\) => \{[\s\S]*blocksEditor\.setMarkdown\(getEditorBody\(\)\);[\s\S]*const syncIfVisible = \(body\) => \{[\s\S]*if \(!root \|\| root\.hidden\) return false;[\s\S]*blocksEditor\.setMarkdown\(body == null \? '' : String\(body\)\);[\s\S]*const requestLayout = \(\) => \{[\s\S]*blocksEditor\.requestLayout\(\);[\s\S]*const focus = \(\) => \{[\s\S]*blocksEditor\.focus\(\);/,
  'editor blocks session should expose source sync, visible sync, layout, and focus as explicit session API'
);

assert.match(
  editorMainDocumentSessionSource,
  /export function createEditorMainDocumentSession\(options = \{\}\) \{[\s\S]*const changeListeners = new Set\(\);[\s\S]*const getEditorTextarea = \(\) => getTextArea\(editor, textarea\);[\s\S]*const getEditorBody = \(\) => \{[\s\S]*const buildMarkdown = \(body\) => \{[\s\S]*const getValue = \(\) => \{[\s\S]*const notifyChange = \(\) => \{[\s\S]*const setValue = \(value, opts = \{\}\) => \{[\s\S]*syncBlocksIfVisible\(bodyText\);[\s\S]*if \(preview\) refreshPreview\(\);[\s\S]*if \(notify\) notifyChange\(\);/,
  'editor document session should own document body/value, change listeners, block sync, and preview refresh'
);

assert.match(
  editorMainDocumentSessionSource,
  /const bindInput = \(\) => \{[\s\S]*input\.addEventListener\('input', handleInput\);[\s\S]*const renderInitial = \(seed = ''\) => \{[\s\S]*setValue\(seed, \{ notify: false \}\);[\s\S]*const createPrimaryEditorApi = \(\) => \(\{[\s\S]*getValue,[\s\S]*setValue: \(value, opts = \{\}\) => setValue\(value, opts\),[\s\S]*setView: \(mode, opts = \{\}\)[\s\S]*setFrontMatterVisible:[\s\S]*onChange,[\s\S]*onTabsMetadataChange:[\s\S]*refreshPreview,[\s\S]*requestLayout:[\s\S]*setWrap:[\s\S]*isWrapEnabled:[\s\S]*const registerPrimaryEditorApi = \(\) => \{[\s\S]*runtime\.registerPrimaryEditorApi\(api\);/,
  'editor document session should own input binding, initial render, and primary-editor API registration'
);

assert.match(
  editorMainContentServiceSource,
  /import \{ configureFetchCachePolicy as configureFetchCachePolicyDefault \} from '\.\/cache-control\.js';[\s\S]*import \{ loadContentJsonWithRaw as loadContentJsonWithRawDefault \} from '\.\/i18n\.js\?v=[\w.-]+';[\s\S]*fetchConfigWithYamlFallbackDefault,[\s\S]*fetchMergedSiteConfigDefault/,
  'editor content service should own the site config and content loading imports'
);

assert.match(
  editorMainContentServiceSource,
  /export function createEditorMainContentService\(options = \{\}\) \{[\s\S]*let siteConfig = \{\};[\s\S]*const getSiteConfig = \(\) => siteConfig \|\| \{\};[\s\S]*const setBaseDir = \(dir\) => \{[\s\S]*runtime\.setEditorBaseDir\(dir, fallback\);[\s\S]*const applySiteConfig = \(nextSiteConfig\) => \{[\s\S]*configureFetchCachePolicy\(siteConfig, \{ context: 'editor' \}\);[\s\S]*previewSession\.handleSiteConfigChange\(\);[\s\S]*const bind = \(\) => \{[\s\S]*runtime\.onSiteConfigChange\(\(event\) => \{/,
  'editor content service should own site config state, cache policy, base-dir updates, and runtime site-config events'
);

assert.match(
  editorMainContentServiceSource,
  /const loadSiteConfig = \(\) => fetchMergedSiteConfig\(\);[\s\S]*const loadIndexData = \(contentRoot\) => loadContentJsonWithRaw\(contentRoot, 'index'\);[\s\S]*const loadTabsConfig = \(contentRoot\) => fetchConfigWithYamlFallback\(\[[\s\S]*`\$\{contentRoot\}\/tabs\.yaml`,[\s\S]*`\$\{contentRoot\}\/tabs\.yml`[\s\S]*const handleIndexLoaded = \(\{ posts, rawIndex \} = \{\}\) => \{[\s\S]*linkCardContext\.rebuild\(posts, rawIndex\);[\s\S]*documentSession\.refreshPreview\(\);/,
  'editor content service should own sidebar-facing site, index, tabs, and link-card refresh services'
);

assert.match(
  editorMainContentServiceSource,
  /const openMarkdown = async \(\{ relPath, url, contentRoot \} = \{\}\) => \{[\s\S]*fetchImpl\(url, \{ cache: 'no-store' \}\);[\s\S]*setBaseDir\(normalizeBaseDir\(contentRoot, relPath\)\);[\s\S]*documentSession\.setValue\(text\);[\s\S]*setCurrentFileLabel\(`\$\{relPath \|\| ''\}`\);[\s\S]*workspaceSession\.setView\('edit'\);[\s\S]*runtime\.scrollToTop\(\{ smooth: true \}\);/,
  'editor content service should own open-markdown fetch, base-dir, document value, current-file, view, and scroll orchestration'
);

assert.match(
  editorMainFileContextServiceSource,
  /export function createEditorMainFileContextService\(options = \{\}\) \{[\s\S]*const inferCurrentFileSource = \(path\) => \{[\s\S]*metadataPanel\.inferCurrentFileSource\(path\);[\s\S]*const getCurrentFileInfo = \(\) => \{[\s\S]*currentFileSession\.getInfo\(\)[\s\S]*const getCurrentMarkdownPath = \(\) => \{[\s\S]*currentFileSession\.getPath\(\)/,
  'editor file context service should own current-file source, info, and path access'
);

assert.match(
  editorMainFileContextServiceSource,
  /const setCurrentFileLabel = \(input\) => \{[\s\S]*currentFileSession\.set\(input\)[\s\S]*metadataPanel\.applyCurrentFileSource\(info && info\.source\);[\s\S]*previewSession\.setCurrentFileInfo\(info\);[\s\S]*previewSession\.refreshAssetOverrides\(\);[\s\S]*documentSession\.refreshPreview\(\);/,
  'editor file context service should own current-file metadata, preview, asset override, and document refresh fan-out'
);

assert.match(
  editorMainFileContextServiceSource,
  /const bindCurrentFileElement = \(el\) => \{[\s\S]*currentFileSession\.bindElement\(el\);[\s\S]*const renderCurrentFile = \(\) => \{[\s\S]*currentFileSession\.render\(\);[\s\S]*const handleCurrentFileRendered = \(\) => \{[\s\S]*previewSession\.updatePathLabel\(\);/,
  'editor file context service should own current-file DOM binding, render relay, and preview path update relay'
);

assert.doesNotMatch(
  editorMainSource,
  /const assignCurrentFileLabel =|const getCurrentMarkdownPath =|const bindCurrentFileElement =|metadataPanel\.applyCurrentFileSource\(info\.source\)|previewSession\.refreshAssetOverrides\(\);/,
  'editor main root should not own current-file path callbacks or cross-session current-file fan-out'
);

assert.match(
  editorMainLanguageSessionSource,
  /export function createEditorMainLanguageSession\(options = \{\}\) \{[\s\S]*const syncLanguage = \(\) => \{[\s\S]*toolbarSession\.syncLanguage\(\);[\s\S]*currentFileSession\.render\(\);[\s\S]*blocksSession\.requestLayout\(\);[\s\S]*metadataPanel\.syncLanguage\(\);[\s\S]*const bind = \(\) => \{[\s\S]*runtime\.onDocument\('press-editor-language-applied', syncLanguage\)/,
  'editor language session should own editor language event subscription and fan-out'
);

assert.match(
  editorMainScrollSessionSource,
  /export function createEditorMainScrollSession\(options = \{\}\) \{[\s\S]*const syncVisibility = \(\) => \{[\s\S]*getScrollY\(runtime\) > threshold[\s\S]*button\.classList\.add\('show'\);[\s\S]*button\.classList\.remove\('show'\);[\s\S]*runtime\.onWindow\('scroll', syncVisibility, \{ passive: true \}\)[\s\S]*button\.addEventListener\('click', clickHandler\);/,
  'editor scroll session should own back-to-top visibility and DOM event binding'
);

assert.match(
  editorMainScrollSessionSource,
  /function getScrollY\(runtime\) \{[\s\S]*runtime\.getPageYOffset\(\)[\s\S]*runtime\.getDocumentElement\(\)[\s\S]*scrollTop[\s\S]*runtime\.scrollToTop\(\{ smooth: true \}\);/,
  'editor scroll session should route page scroll reads and scroll-to-top through the runtime facade'
);

assert.match(
  editorMainShellServiceSource,
  /export function createEditorMainShellService\(options = \{\}\) \{[\s\S]*const requestLayout = \(\) => \{[\s\S]*editor\.refreshLayout\(\);[\s\S]*textarea\.style\.height = '0px';[\s\S]*textarea\.offsetHeight;[\s\S]*textarea\.style\.height = `\$\{textarea\.scrollHeight\}px`;[\s\S]*const emitToast = \(kind, message\) => \{[\s\S]*emitToastImpl\(kind, text\);/,
  'editor shell service should own layout refresh and toast emission helpers'
);

assert.match(
  editorMainServiceRegistrySource,
  /export function createEditorMainServiceRegistry\(\) \{[\s\S]*const services = createEmptyServices\(\);[\s\S]*const get = \(name\) => services\[name\] \|\| null;[\s\S]*const set = \(name, service\) => \{[\s\S]*services\[name\] = service \|\| null;[\s\S]*const call = \(name, method, fallback, \.\.\.args\) => \{[\s\S]*target\[method\]\(\.\.\.args\);/,
  'editor service registry should own safe late-bound service slots and method calls'
);

assert.match(
  editorMainServiceRegistrySource,
  /getBlocksEditor,[\s\S]*getBlocksSession: \(\) => get\('blocksSession'\),[\s\S]*getContentService: \(\) => get\('contentService'\),[\s\S]*getCurrentFileSession: \(\) => get\('currentFileSession'\),[\s\S]*getDocumentSession: \(\) => get\('documentSession'\),[\s\S]*getEditorValue,[\s\S]*getImageSession: \(\) => get\('imageSession'\),[\s\S]*getMetadataPanel: \(\) => get\('metadataPanel'\),[\s\S]*getPreviewSession: \(\) => get\('previewSession'\),[\s\S]*getSiteConfig,[\s\S]*getToolbarSession: \(\) => get\('toolbarSession'\),[\s\S]*getWorkspaceSession: \(\) => get\('workspaceSession'\),/,
  'editor service registry should expose named getters for editor-main cross-session dependencies'
);

assert.doesNotMatch(
  editorMainSource,
  /editorMainRuntime\.onDocument\('press-editor-language-applied'|editorMainRuntime\.onWindow\('scroll'|getPageYOffset\(\)|getDocumentElement\(\)[\s\S]*scrollTop|initBackToTop|const requestLayout =|const emitEditorToast =|let documentSession = null|let previewSession = null|let blocksSession = null|let currentFileSession = null/,
  'editor main root should not own language-event fan-out, back-to-top scroll listeners, shell helpers, or ad hoc late-bound session slots'
);

assert.match(
  source,
  /from '\.\/composer-runtime\.js\?v=[\w.-]+'/,
  'composer should cache-bust the explicit composer runtime boundary'
);

assert.match(
  source,
  /const editorRuntime = createComposerRuntime\(\);\s*const composerDocument = editorRuntime\.documentRef;\s*const composerWindow = editorRuntime\.windowRef;[\s\S]*const composerStateStore = editorRuntime\.createStateStore\(\{[\s\S]*kinds: \['index', 'tabs', 'site'\],[\s\S]*defaultKind: 'index'/,
  'composer should create an explicit runtime and route root document/window refs through it'
);

assert.doesNotMatch(
  source,
  /documentRef: document|windowRef: window|r = document|r = window|injectComposerRuntimeStyles\(\{ documentRef: document \}\)/,
  'composer should not pass direct document/window globals to downstream controllers after runtime creation'
);

assert.doesNotMatch(
  source,
  /let activeComposerState|let remoteBaseline|let composerDiffCache/,
  'composer root state, remote baselines, and diff cache should live behind the runtime state store'
);

assert.match(
  source,
  /function getStateSlice\(kind\) \{\s*return composerStateStore\.getStateSlice\(kind\);\s*\}[\s\S]*function setStateSlice\(kind, value\) \{\s*composerStateStore\.setStateSlice\(kind, value\);\s*\}/,
  'composer state access should be routed through the explicit runtime state store'
);

assert.match(
  editorAppRuntimeSource,
  /export function createEditorStateStore\([\s\S]*getStateSlice\(kind\)[\s\S]*setStateSlice\(kind, value\)[\s\S]*getRemoteBaseline\(kind\)[\s\S]*setRemoteBaseline\(kind, value\)[\s\S]*getDiff\(kind\)[\s\S]*setDiff\(kind, value\)[\s\S]*export function createEditorAppRuntime/,
  'editor app runtime should expose explicit state, baseline, diff, storage, event, and global-access boundaries'
);

assert.match(
  composerRuntimeSource,
  /export function createComposerRuntime\(options = \{\}\)[\s\S]*createEditorAppRuntime\(options\)[\s\S]*function onDocumentReady\(handler\)[\s\S]*function getContentRoot\(\)[\s\S]*function setContentRoot\(root\)[\s\S]*function getSiteRepo\(\)[\s\S]*function setSiteRepo\(repo\)[\s\S]*function emitLanguagePoolChanged\(\)[\s\S]*function emitSiteConfigChange\(siteConfig\)[\s\S]*function requestFrame\(handler\)[\s\S]*function setTimer\(handler, delay = 0\)[\s\S]*function fetchContent\(url, options\)[\s\S]*function showAlert\(message\)[\s\S]*function confirmAction\(message\)[\s\S]*function getPerformance\(\)[\s\S]*function getCss\(\)[\s\S]*function matchesMedia\(query\)[\s\S]*function getComputedStyle\(element\)[\s\S]*function getResizeObserver\(\)[\s\S]*async function writeClipboardText\(text\)/,
  'composer runtime should own composer-specific DOM ready, content-root, site-repo, app-event, browser scheduling, network, dialog, clipboard, and browser-global boundaries'
);

assert.doesNotMatch(
  source,
  /window\.__press_site_repo|window\.__press_primary_editor|document\.dispatchEvent\(new CustomEvent\(LANGUAGE_POOL_CHANGED_EVENT\)|localStorage\.getItem\(scopedEditorStorageKey|localStorage\.setItem\(scopedEditorStorageKey|window\.setTimeout|window\.clearTimeout|fetch\(url, options\)|alert\(message\)|window\.confirm\(message\)|navigator\.clipboard|window\.isSecureContext|document\.execCommand\('copy'\)|typeof performance !== 'undefined'|typeof CSS !== 'undefined'/,
  'composer should route browser globals, app events, scoped persisted UI state, timers, fetch, dialogs, clipboard, and browser global objects through the runtime boundary'
);

assert.match(
  source,
  /async function nsCopyToClipboard\(text\) \{\s*return editorRuntime\.writeClipboardText\(text\);\s*\}/,
  'composer clipboard helper should delegate browser clipboard access to the explicit runtime'
);

assert.match(
  source,
  /setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\)[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\)[\s\S]*fetchContent: \(url, options\) => editorRuntime\.fetchContent\(url, options\)[\s\S]*requestAnimationFrameRef: \(fn\) => editorRuntime\.requestFrame\(fn\)[\s\S]*confirmRef: \(message\) => editorRuntime\.confirmAction\(message\)[\s\S]*performanceRef: editorRuntime\.getPerformance\(\)[\s\S]*cssRef: editorRuntime\.getCss\(\)/,
  'composer app assembly should inject browser capabilities through the explicit runtime adapters'
);

assert.match(
  source,
  /from '\.\/composer-system-theme-bridge\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted system/theme bridge boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/system-updates\.js\?v=|from '\.\/theme-manager\.js\?v=|initSystemUpdates|getSystemUpdateCommitFiles|clearSystemUpdateState|initThemeManager|getThemeManagerCommitFiles|clearThemeManagerState/,
  'composer should not import or initialize system/theme managers directly'
);

assert.match(
  source,
  /const composerSystemThemeBridge = createComposerSystemThemeBridge\(\{[\s\S]*getStateSlice,[\s\S]*setStateSlice,[\s\S]*notifyComposerChange,[\s\S]*updateUnsyncedSummary,[\s\S]*refreshEditorContentTree[\s\S]*\}\);[\s\S]*registerExternalStagingProviders: \(registry\) => composerSystemThemeBridge\.registerStagingProviders\(registry\)[\s\S]*composerSystemThemeBridge\.hasSystemUpdateEntries\(\)[\s\S]*composerSystemThemeBridge\.hasThemeEntries\(\)[\s\S]*initSystemThemeBridge: \(\) => composerSystemThemeBridge\.init\(\)/,
  'composer should delegate system/theme staging, status, and initialization through app-service callbacks'
);

assert.match(
  composerSystemThemeBridgeSource,
  /from '\.\/system-updates\.js\?v=[\w.-]+'[\s\S]*from '\.\/theme-manager\.js\?v=[\w.-]+'[\s\S]*export function createComposerSystemThemeBridge\(options = \{\}\)[\s\S]*function registerStagingProviders\(stagingRegistry\)[\s\S]*id: 'system-updates'[\s\S]*id: 'themes'[\s\S]*function init\(\)[\s\S]*initSystemUpdates\(\{ onStateChange: refreshUnsyncedSummary \}\)[\s\S]*initThemeManager\(\{[\s\S]*getCurrentThemePack,[\s\S]*setSiteThemePack/,
  'system/theme bridge should own manager imports, staging providers, and module initialization'
);

assert.match(
  source,
  /from '\.\/composer-publish-state-service\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted publish state service boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/composer-staging\.js\?v=|from '\.\/composer-index-publish-metadata\.js\?v=|from '\.\/composer-content-staging\.js\?v=|from '\.\/composer-seo-staging\.js\?v=|from '\.\/composer-post-commit-state\.js\?v=|createStagingRegistry\(|createIndexPublishMetadataEnricher\(|createContentCommitStagingProvider\(|createSeoStagingProvider\(|createPostCommitStateApplier\(|stagingRegistry/,
  'composer should not own publish staging registry, staging providers, or post-commit state applier wiring'
);

assert.match(
  source,
  /const composerPublishStateService = createComposerPublishStateService\(\{[\s\S]*getStateSlice,[\s\S]*getRemoteBaseline: \(\) => composerStateStore\.getRemoteBaseline\(\),[\s\S]*setRemoteBaselineSlice: \(kind, value\) => composerStateStore\.setRemoteBaseline\(kind, value\),[\s\S]*applyComposerEffectiveSiteConfig: \(site\) => applyComposerEffectiveSiteConfig\(site\),[\s\S]*registerExternalStagingProviders: \(registry\) => composerSystemThemeBridge\.registerStagingProviders\(registry\)[\s\S]*\}\);[\s\S]*function gatherCommitPayload\(options = \{\}\) \{[\s\S]*composerPublishStateService\.gatherCommitPayload\(\{[\s\S]*setStatus: setSyncOverlayStatus[\s\S]*function applyLocalPostCommitState\(files = \[\]\) \{[\s\S]*composerPublishStateService\.applyLocalPostCommitState\(files\);[\s\S]*function getTrackedPublishContentRoot\(\) \{[\s\S]*composerPublishStateService\.getTrackedPublishContentRoot\(\);/,
  'composer should reduce publish persistence to explicit app-service callbacks'
);

assert.match(
  composerPublishStateServiceSource,
  /from '\.\/composer-staging\.js\?v=[\w.-]+'[\s\S]*from '\.\/composer-index-publish-metadata\.js\?v=[\w.-]+'[\s\S]*from '\.\/composer-content-staging\.js\?v=[\w.-]+'[\s\S]*from '\.\/composer-seo-staging\.js\?v=[\w.-]+'[\s\S]*from '\.\/composer-post-commit-state\.js\?v=[\w.-]+'/,
  'publish state service should cache-bust the staging and post-commit modules it composes'
);

assert.match(
  composerPublishStateServiceSource,
  /export function createComposerPublishStateService\(options = \{\}\)[\s\S]*const stagingRegistry = createStagingRegistryRef\(\)[\s\S]*const indexPublishMetadata = createIndexPublishMetadataEnricherRef\([\s\S]*const contentCommitStagingProvider = createContentCommitStagingProviderRef\([\s\S]*const seoStagingProvider = createSeoStagingProviderRef\([\s\S]*const postCommitStateApplier = createPostCommitStateApplierRef\(\{[\s\S]*applyComposerEffectiveSiteConfig: options\.applyComposerEffectiveSiteConfig[\s\S]*stagingRegistry\.registerStagingProvider\(\{[\s\S]*id: 'content'[\s\S]*options\.registerExternalStagingProviders\(stagingRegistry\)[\s\S]*id: 'seo'[\s\S]*function getStagingSummaryEntries\(context = \{\}\)[\s\S]*function applyLocalPostCommitState\(files = \[\]\)[\s\S]*return \{[\s\S]*gatherCommitPayload,[\s\S]*getTrackedPublishContentRoot,[\s\S]*getStagingSummaryEntries,[\s\S]*applyLocalPostCommitState[\s\S]*\};/,
  'publish state service should own staging assembly, state application, and expose only app-level publish state operations'
);

assert.match(
  source,
  /from '\.\/composer-bootstrap\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted DOM bootstrap and workspace assembly boundary'
);

assert.match(
  composerPublishStateServiceSource,
  /createPostCommitStateApplierRef\(\{[\s\S]*applyComposerEffectiveSiteConfig: options\.applyComposerEffectiveSiteConfig/,
  'publish state service should pass site-config application lazily into post-commit wiring to avoid startup TDZ failures'
);

assert.doesNotMatch(
  source,
  /document\.addEventListener\('DOMContentLoaded'|function bindComposerUI\(/,
  'composer should not own DOMContentLoaded startup or workspace event binding'
);

assert.match(
  composerBootstrapSource,
  /export function bindComposerMarkdownToolbar\([\s\S]*btnPushMarkdown[\s\S]*export function bindComposerWorkspaceUi\([\s\S]*mountEditorSystemPanels[\s\S]*export async function loadInitialComposerState\([\s\S]*ensureSiteRepo\(\)[\s\S]*fetchTrackedSiteConfig[\s\S]*export function assembleComposerWorkspace\([\s\S]*getLocation\(\)[\s\S]*restoreDynamicEditorState[\s\S]*export function initializeComposerApp\(options = \{\}\)[\s\S]*options\.onDocumentReady\(handler\)/,
  'bootstrap module should own startup, Markdown toolbar binding, initial config loading, and workspace assembly through runtime callbacks'
);

assert.match(
  source,
  /applyComposerEffectiveSiteConfig: \(site\) => applyComposerEffectiveSiteConfig\(site\)/,
  'composer should pass site config application lazily to avoid top-level bootstrap TDZ during module evaluation'
);

assert.match(
  source,
  /from '\.\/composer-ui-motion\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted UI motion boundary'
);

assert.doesNotMatch(
  source,
  /function syncSiteEditorSingleLabelWidth\(root\)|function animateComposerInlineVisibility\(element, show|function slideToggle\(el, toOpen\)|const __activeAnims = new WeakMap\(\)|const composerListTransitions = new WeakMap\(\)/,
  'composer should not own low-level UI motion and measurement helpers'
);

assert.match(
  composerUiMotionSource,
  /export function syncSiteEditorSingleLabelWidth\(root\)[\s\S]*export function animateComposerInlineVisibility\(element, show, options = \{\}\)[\s\S]*export function animateComposerListTransition\(list, previousRect, options = \{\}\)[\s\S]*export function animateComposerOrderMainReset\(host, previousRect, options = \{\}\)[\s\S]*export function slideToggle\(el, toOpen\)[\s\S]*export function getComposerSlideDurations\(\)/,
  'UI motion module should own composer label measurement, inline/list/order animations, slide toggles, and shared durations'
);

assert.match(
  source,
  /from '\.\/composer-site-config\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted site config boundary'
);

assert.doesNotMatch(
  source,
  /function inferRepoConfigFromGitHubPagesUrl\(locationLike\)|function applyInferredRepoConfig\(site, inferred\)|let composerSiteLocalOverride|mergeYamlConfig|resolveSiteRepoConfig/,
  'composer should not own GitHub Pages repo inference or site-local config merge helpers'
);

assert.match(
  composerSiteConfigSource,
  /export function inferRepoConfigFromGitHubPagesUrl\(locationLike\)[\s\S]*export function applyInferredRepoConfig\(site, inferred\)[\s\S]*export function createComposerSiteConfigController\(options = \{\}\)[\s\S]*const runtime = options\.runtime \|\| null;[\s\S]*setContentRoot\(root\);[\s\S]*setSiteRepo\(\{[\s\S]*emitSiteConfigChange\(cloneValue\(effective\)\);/,
  'site config module should own Pages repo inference and route effective config globals/events through injected runtime callbacks'
);

assert.match(
  source,
  /from '\.\/editor-content-tree-controller\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted editor content tree controller boundary'
);

assert.match(
  source,
  /from '\.\/composer-yaml-actions\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted YAML action boundary'
);

assert.doesNotMatch(
  source,
  /async function handleComposerRefresh\(btn\)|async function handleComposerDiscard\(btn\)|Refresh failed|Discard failed/,
  'composer should delegate YAML refresh/discard action flows to the extracted action module'
);

assert.match(
  composerYamlActionsSource,
  /export function createComposerYamlActions\(options = \{\}\)[\s\S]*async function handleRefresh\(button = null\)[\s\S]*async function handleDiscard\(button = null\)[\s\S]*return \{[\s\S]*handleDiscard,[\s\S]*handleRefresh/,
  'YAML action module should own refresh and discard flows'
);

assert.doesNotMatch(
  source,
  /let editorContentTree|let activeEditorTreeNodeId|function buildCurrentFileBreadcrumb\(tab\) \{[\s\S]*const ids = \[\];|function handleEditorTreeSelection\(nodeId\) \{[\s\S]*openMarkdownInEditor\(node\.path, \{ node \}\)/,
  'editor content tree state, breadcrumb construction, and selection routing should stay outside the main composer shell'
);

assert.match(
  editorContentTreeControllerSource,
  /export function createEditorContentTreeController\(options = \{\}\)[\s\S]*let tree = \[\];[\s\S]*let activeNodeId = String\(options\.initialActiveNodeId \|\| 'welcome'\)[\s\S]*function buildCurrentFileBreadcrumb\(tab\)[\s\S]*function handleSelection\(nodeId\)/,
  'editor content tree controller should own tree state, active node state, breadcrumbs, and selection routing'
);

assert.match(
  source,
  /from '\.\/composer-markdown-loader\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted Markdown loader boundary'
);

assert.doesNotMatch(
  source,
  /const TAB_STATE_VALUES|const runner = async \(\) => \{[\s\S]*fetch\(url, \{ cache: 'no-store' \}\)|tab\.remoteContent = editorText;[\s\S]*tab\.remoteSignature = remoteSignature;/,
  'Markdown tab loading and remote file-status normalization should stay outside the main composer shell'
);

assert.match(
  composerMarkdownLoaderSource,
  /export function createComposerMarkdownLoader\(options = \{\}\)[\s\S]*function setDynamicTabStatus\(tab, status\)[\s\S]*async function loadDynamicTabContent\(tab\)[\s\S]*fetchContent\(url, \{ cache: 'no-store' \}\)[\s\S]*tab\.remoteContent = editorText;[\s\S]*tab\.remoteSignature = remoteSignature;/,
  'Markdown loader boundary should own remote markdown fetch, encrypted draft merge, and file-status updates'
);

assert.match(
  source,
  /from '\.\/composer-markdown-actions-ui\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted Markdown actions UI boundary'
);

assert.doesNotMatch(
  source,
  /MARKDOWN_PUSH_LABEL_KEYS|MARKDOWN_DISCARD_LABEL_KEY|MARKDOWN_SAVE_LABEL_KEY|btn\.setAttribute\('data-protected', protectedState \? 'true' : 'false'\)|const hasLocalChanges = !!\(active && active\.path && \(hasDirty \|\| hasDraftContent\)\);/,
  'Markdown action button labels, tooltips, and DOM state rendering should stay outside the main composer shell'
);

assert.match(
  composerMarkdownActionsUiSource,
  /const MARKDOWN_PUSH_LABEL_KEYS[\s\S]*export function createComposerMarkdownActionsUi\(options = \{\}\)[\s\S]*function updatePushButton\(tab\)[\s\S]*function updateDiscardButton\(tab\)[\s\S]*function updateSaveButton\(tab\)[\s\S]*function updateProtectionButton\(tab\)/,
  'Markdown actions UI boundary should own Push, Discard, Save, and Protection button state rendering'
);

assert.match(
  source,
  /from '\.\/composer-markdown-actions\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted Markdown actions controller boundary'
);

assert.match(
  source,
  /from '\.\/composer-markdown-workspace\.js\?v=[\w.-]+'/,
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
  /from '\.\/composer-markdown-state\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted Markdown state boundary'
);

assert.doesNotMatch(
  source,
  /function createMarkdownProtectionState|function getMarkdownProtectionState|function computeTextSignature|function bumpMarkdownDraftSaveGeneration|function hasMarkdownDraftContent/,
  'Markdown protection, draft, and text-signature state helpers should stay outside the main composer shell'
);

assert.match(
  composerMarkdownStateSource,
  /from '\.\/composer-markdown-save\.js\?v=[\w.-]+'[\s\S]*export function normalizeMarkdownContent\(text\)[\s\S]*export function computeTextSignature\(text\)[\s\S]*export function createMarkdownProtectionState\(overrides = \{\}\)[\s\S]*export function getMarkdownProtectionState\(tab\)[\s\S]*export function bumpMarkdownDraftSaveGeneration\(tab\)/,
  'Markdown state boundary should own draft normalization, text signatures, protection state, and encrypted-draft save generations'
);

assert.match(
  source,
  /from '\.\/composer-markdown-drafts\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted Markdown drafts boundary'
);

const restoreMarkdownDraftForTabBody = extractFunctionBody(source, 'restoreMarkdownDraftForTab');
const saveMarkdownDraftForTabBody = extractFunctionBody(source, 'saveMarkdownDraftForTab');
const scheduleMarkdownDraftSaveBody = extractFunctionBody(source, 'scheduleMarkdownDraftSave');
const updateDynamicTabDirtyStateBody = extractFunctionBody(source, 'updateDynamicTabDirtyState');

assert.doesNotMatch(
  [
    restoreMarkdownDraftForTabBody,
    saveMarkdownDraftForTabBody,
    scheduleMarkdownDraftSaveBody,
    updateDynamicTabDirtyStateBody
  ].join('\n'),
  /importMarkdownAssetsForPath|prepareMarkdownForProtectedStorage|setTimeout|normalizeMarkdownContent|countMarkdownAssetDeletions/,
  'Markdown draft storage, restore, autosave, and dirty-state lifecycle should stay outside the main composer shell'
);

assert.match(
  composerMarkdownDraftsSource,
  /export function createComposerMarkdownDraftController\(options = \{\}\)[\s\S]*function getDraftEntry\(path\)[\s\S]*function saveDraftEntry\(path, content, remoteSignature = '', assets = \[\], saveOptions = \{\}\)[\s\S]*function restoreDraftForTab\(tab\)[\s\S]*async function saveDraftForTab\(tab, saveOptions = \{\}\)[\s\S]*function updateDynamicTabDirtyState\(tab, dirtyOptions = \{\}\)/,
  'Markdown drafts boundary should own draft store entries, restore/save/clear, autosave, and dirty-state calculation'
);

assert.match(
  source,
  /from '\.\/editor-file-tree-ui\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted editor file tree UI boundary'
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
  source,
  /from '\.\/editor-structure-panel-ui\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted editor structure panel UI boundary'
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
assert.equal(protectedStagedResult.files[0].plaintextContent, 'plain text baseline', 'staging registry should preserve protected markdown plaintext baselines');
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
  readFileSync(resolve(here, '../assets/js/system-updates.js'), 'utf8'),
  /from '\.\/markdown\.js\?v=[\w.-]+'[\s\S]*from '\.\/math-render\.js\?v=[\w.-]+'[\s\S]*from '\.\/safe-html\.js\?v=[\w.-]+'/,
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

assert.match(source, /createEditorSessionStateStore\(\{[\s\S]*scopeKey: scopedEditorStorageKey,[\s\S]*keys: LS_KEYS/, 'editor session state should use site-scoped browser storage');
assert.match(source, /createScopedDraftStore\(\{[\s\S]*storageKey: DRAFT_STORAGE_KEY,[\s\S]*scopeKey: scopedEditorStorageKey[\s\S]*createScopedDraftStore\(\{[\s\S]*storageKey: MARKDOWN_DRAFT_STORAGE_KEY,[\s\S]*scopeKey: scopedEditorStorageKey/, 'composer and markdown draft stores should use site-scoped browser storage');
assert.match(source, /scopedEditorStorageKey\(LS_KEYS\.cfile\)/, 'active composer file storage should remain site-scoped');

assert.match(
  publishSettingsSource,
  /scopeKey[\s\S]*GITHUB_PAT_STORAGE_KEY/,
  'publish settings store should keep the PAT fallback token site-scoped'
);

function createMemoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
    dump: () => Object.fromEntries(data.entries())
  };
}

{
  const localStorage = createMemoryStorage();
  const store = createEditorSessionStateStore({
    storage: localStorage,
    scopeKey: (key) => `${key}:scope`,
    keys: {
      editorState: 'press_composer_editor_state',
      systemTreeExpanded: 'press_editor_system_tree_expanded'
    }
  });
  assert.equal(store.readUnscopedNumber('press_editor_rail_width', 340), 340, 'missing rail width should preserve the default width');
  localStorage.setItem('press_editor_rail_width', '420');
  assert.equal(store.readUnscopedNumber('press_editor_rail_width', 340), 420, 'stored rail width should be restored');
  localStorage.setItem('press_editor_rail_width', 'invalid');
  assert.equal(store.readUnscopedNumber('press_editor_rail_width', 340), 340, 'invalid rail width should fall back to the default width');
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
  assert.equal(store.getStoredConnectPublishSettings().mode, 'pat', 'legacy Connect opt-out should migrate to PAT fallback mode');
  store.setStoredConnectPublishSettings({ baseUrl: 'http://127.0.0.1:8788' });
  assert.equal(store.getStoredConnectPublishSettings().mode, 'pat', 'editing the Connect URL should not silently leave PAT fallback mode');
  store.setStoredConnectPublishSettings({ enabled: true });
  assert.equal(store.getStoredConnectPublishSettings().mode, 'connect', 'enabling Connect should persist Connect as the default publish mode');
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
  /initializeComposerApp\(\{[\s\S]*onDocumentReady: editorRuntime\.onDocumentReady,[\s\S]*ensureSiteRepo: \(\) => editorRuntime\.ensureSiteRepo\(\),[\s\S]*getLocation: \(\) => editorRuntime\.getLocation\(\),[\s\S]*loadDraftSnapshotsIntoState,[\s\S]*applyInferredRepoConfig,[\s\S]*inferRepoConfigFromGitHubPagesUrl,[\s\S]*applyEffectiveSiteConfig: applyComposerEffectiveSiteConfig,[\s\S]*buildSiteUI: \(root, state\) => composerSiteSettingsUi\.buildSiteUI\(root, state\)/,
  'composer should wire inferred starter repository config into the extracted workspace assembly before rendering Site Settings'
);

assert.match(
  composerBootstrapSource,
  /const restoredDrafts = loadDraftSnapshotsIntoState\(state\);[\s\S]*applyInferredRepoConfig\([\s\S]*inferRepoConfigFromGitHubPagesUrl\(getLocation\(\)\)[\s\S]*applyEffectiveSiteConfig\(state\.site\);[\s\S]*buildSiteUI\(getElement\(documentRef, 'composerSite'\), state\);[\s\S]*notifyComposerChange\('site', inferredSiteRepoApplied \? \{\} : \{ skipAutoSave: true \}\);/,
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

assert.match(
  editorMainDocumentSessionSource,
  /setView: \(mode, opts = \{\}\) => \([\s\S]*workspaceSession\.setView\(mode, opts\)[\s\S]*restorePersistedView: \(opts = \{\}\) => \([\s\S]*workspaceSession\.restorePersistedView\(opts\)/,
  'primary editor API should accept blocks mode'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /function restorePrimaryEditorMarkdownView\(editorApi\) \{[\s\S]*typeof editorApi\.restorePersistedView === 'function'[\s\S]*editorApi\.restorePersistedView\(\);[\s\S]*editorApi\.setView\('edit'\);/,
  'Markdown workspace controller should keep the persisted markdown editor view restore helper available for mode routing'
);

assert.match(
  source,
  /function restorePrimaryEditorMarkdownView\(editorApi\) \{ getMarkdownWorkspaceController\(\)\.restorePrimaryEditorMarkdownView\(editorApi\); \}/,
  'composer should route markdown view restoration through the workspace controller'
);

assert.match(
  composerModeControllerSource,
  /function applyDynamicMode\(nextMode, optionsForMode, editorApi\)[\s\S]*restorePrimaryEditorMarkdownView\(editorApi\);/,
  'mode controller should restore the persisted markdown editor view when opening markdown files'
);

assert.match(
  `${editorBlocksModelSource}\n${editorBlocksSource}`,
  /export function parseMarkdownBlocks\(markdown\)[\s\S]*export function serializeMarkdownBlocks\(blocks\)[\s\S]*export function createMarkdownBlocksEditor\(root, options = \{\}\)/,
  'blocks mode should provide model parser/serializer and DOM controller entrypoints'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-toolbar|text\('uploadImage', 'Upload Image'\)|requestImageUpload\(\{ index: state\.activeIndex \+ 1 \}\)/,
  'blocks mode should not render the old top block toolbar or visible upload-image insertion button'
);

assert.match(
  editorBlocksStateSource,
  /function ensureEditableBlankForEmptyDocument\(\) \{[\s\S]*if \(state\.blocks\.length\) return null;[\s\S]*state\.blocks\.push\(block\);[\s\S]*function setMarkdown\(markdown\) \{[\s\S]*state\.blocks = parseMarkdownBlocksRef\(markdown\);[\s\S]*ensureEditableBlankForEmptyDocument\(\);[\s\S]*resetEditorSession\(\);/,
  'blocks mode should materialize a real blank block only for empty documents'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksCommandSessionSource}`,
  /const commandSession = blockSessions\.setCommandSession\(createEditorBlocksCommandSession\(\{[\s\S]*placeCommandBlock,[\s\S]*getCardPickerSession: \(\) => blockSessions\.getCardPickerSession\(\),[\s\S]*insertCardBlock: \(data, index\) => blockSessions\.insertCommandBlock\('card', data, \{ index \}\)[\s\S]*const insertCommandBlock = \(type, data = \{\}, options = \{\}\) => \{[\s\S]*blocksState\.beginCommandBlockInsert\(options\)[\s\S]*placeCommandBlock\(type, cloneCommandData\(data\), insertIndex\)[\s\S]*const openArticleCardCommand = \(\) => \{[\s\S]*const insertIndex = commandInsertIndex\(\);[\s\S]*cardPickerSession\.open\(insertIndex\);/,
  'blank block commands should live behind the command session, replace active blanks, and reuse the article-card picker at that position'
);

assert.match(
  editorBlocksCommandSessionSource,
  /const renderBlankBlock = \(body, block, index\) => \{[\s\S]*editable\.addEventListener\('keydown', \(event\) => \{[\s\S]*isPlainEnter\(event\)[\s\S]*prevent\(event\);[\s\S]*insertBlankBlock\(index \+ 1, \{ focus: true \}\);[\s\S]*removeEmptyBlockWithBackspace/,
  'blank block Enter should be handled inside the command session and create another real blank before browser input can turn the blank into a paragraph'
);

assert.match(
  editorBlocksSource,
  /blank: \(body, block, index\) => blockSessions\.renderBlankBlock\(body, block, index\)/,
  'blocks root should route blank body rendering through the command session renderer passed to the body session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const commandBlocks|openArticleCardCommand|runBlockCommand|createCommandMenuElement|blocks-command-menu-item|blocks-blank-editable/,
  'blocks root should not own slash command menu or blank editable DOM assembly'
);

assert.match(
  editorBlocksCaretSessionSource,
  /function isSelectionOnBlankLine\(el\) \{[\s\S]*const offsets = selectionOffsets\(el\);[\s\S]*!offsets\.collapsed[\s\S]*if \(text\.slice\(lineStart, lineEnd\)\.trim\(\) === ''\) return true;[\s\S]*const caretRect = rectForEditable\(el\);[\s\S]*selectionTools\.createTreeWalker\(el, SHOW_TEXT\)[\s\S]*range\.selectNodeContents\(node\);[\s\S]*const hasTextOnCaretLine = rects\.some[\s\S]*if \(hasTextOnCaretLine\)[\s\S]*return true;/,
  'rich text blocks should detect empty visual lines even when DOM line breaks are not counted by Range.toString offsets'
);

assert.match(
  editorBlocksCaretSessionSource,
  /function shouldInsertBlankBlockOnEnter\(el\) \{[\s\S]*const offsets = selectionOffsets\(el\);[\s\S]*!offsets\.collapsed[\s\S]*const text = editableVisibleText\(el\);[\s\S]*if \(offsets\.start >= text\.length\) return true;[\s\S]*return isSelectionOnBlankLine\(el\);/,
  'plain Enter at the end of a rich text block should insert a real blank block without first creating an empty line'
);

assert.match(
  editorBlocksStateSource,
  /commandMenuInsertIndex: null,[\s\S]*function insertBlankBlock\(index = state\.blocks\.length, options = \{\}\) \{[\s\S]*state\.commandMenuOpen = !!options\.command;[\s\S]*state\.commandMenuInsertIndex = options\.command \? safeIndex : null;[\s\S]*state\.cardPickerOpen = false;[\s\S]*state\.cardPickerInsertIndex = null;[\s\S]*clearActiveEditing\(\);/,
  'blocks state controller should own blank-block command menu state'
);

assert.match(
  editorBlocksSource,
  /const insertBlankBlockAfter = \(index, editable = null, sync = null\) => \{[\s\S]*if \(typeof sync === 'function'\) sync\(\);[\s\S]*insertBlankBlock\(Math\.max\(0, Math\.min\(\(Number\(index\) \|\| 0\) \+ 1, state\.blocks\.length\)\), \{ focus: true \}\);/,
  'Enter should create a focused real blank block after the current block'
);

assert.match(
  editorBlocksRichTextSessionSource,
  /editable\.addEventListener\('keydown', \(event\) => \{[\s\S]*isPlainEnter\(event\)[\s\S]*!\['paragraph', 'quote', 'heading'\]\.includes\(block\?\.type\)[\s\S]*!shouldInsertBlankBlockOnEnter\(editable, caretSession\)[\s\S]*prevent\(event\);[\s\S]*insertBlankBlockAfter\(index, editable, sync\);/,
  'paragraph, quote, and heading Enter handling should exit the block when Enter would create a new empty line'
);

assert.match(
  editorBlocksSource,
  /state\.blocks\.forEach\(\(block, index\) => \{[\s\S]*list\.appendChild\(renderBlockElement\(block, index\)\);[\s\S]*\}\);[\s\S]*blockSessions\.renderCardPicker\(\);/,
  'rendering should use real blank blocks for persistent insertion points without appending a terminal virtual block'
);

assert.match(
  editorBlocksModelSource,
  /export function isBlockEmptyForBackspace\(block\) \{[\s\S]*block\.type === 'blank'[\s\S]*block\.type === 'paragraph'[\s\S]*block\.type === 'heading'[\s\S]*block\.type === 'quote'[\s\S]*block\.type === 'code'[\s\S]*block\.type === 'source'[\s\S]*block\.type === 'image'[\s\S]*block\.type === 'card'[\s\S]*block\.type === 'list'[\s\S]*editableListItems\(data\.items\)\.every\(item => blank\(item && item\.text\) && !item\.checked\);/,
  'empty block backspace detection should cover blank, text, media, card, and list user-authored content'
);

assert.match(
  editorBlocksFocusSessionSource,
  /function focusListItemEditable\(block, itemIndex, options = \{\}\) \{[\s\S]*const items = blockEl\.querySelectorAll\('\.blocks-list-item \.blocks-list-text'\);[\s\S]*else if \(options\.atEnd\) placeEditableAtEnd\(editable\);[\s\S]*function focusPreviousBlockEnd\(index\) \{[\s\S]*if \(target\.type === 'list'\) \{[\s\S]*const itemIndex = listItems\(target\.data && target\.data\.items\)\.length - 1;[\s\S]*focusListItemEditable\(target, itemIndex, \{ atEnd: true \}\);[\s\S]*return;[\s\S]*focusBlockPrimaryEditable\(target\);/,
  'blocks focus session should move focus to the previous block end, including the last list item'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksStateSource}`,
  /const removeEmptyBlockWithBackspace = \(event, block, index, editable = null, sync = null\) => \{[\s\S]*event\.key !== 'Backspace'[\s\S]*index <= 0[\s\S]*isEditableBackspaceAtEmptyStart\(editable, selectionSession\)[\s\S]*isBlockEmptyForBackspace\(block\)[\s\S]*blocksState\.removeBlock\(index\);[\s\S]*render\(\);[\s\S]*focusPreviousBlockEnd\(index\);[\s\S]*emit\(\);[\s\S]*function removeBlock\(index, options = \{\}\) \{[\s\S]*replaceBlocks\(index, 1, \[\], options\)/,
  'Backspace should remove empty non-first real blocks and delegate previous-end focus through the focus session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /renderVirtualBlock|handleTerminalVirtualBackspace|focusTerminalVirtualEditable|ensureTrailingBlankBlock/,
  'terminal virtual block and forced trailing blank runtime should be removed'
);

assert.match(
  `${editorBlocksRichTextSessionSource}\n${editorBlocksListSessionSource}`,
  /createRichEditable[\s\S]*editable\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, editable, sync\)[\s\S]*isPlainEnter\(event\)[\s\S]*span\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, span, sync\)[\s\S]*event\.key === 'Tab'/,
  'empty Backspace handling should run before rich Enter and list row handling'
);

assert.match(
  editorBlocksCodeSessionSource,
  /code\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, code, sync\)[\s\S]*event\.key !== 'Enter'/,
  'code session should run empty Backspace handling before code Enter handling'
);

assert.match(
  editorBlocksSourceSessionSource,
  /area\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, area, sync\)\) return;[\s\S]*handleCrossBlockArrowNavigation\(event, index, area\);/,
  'source session should run empty Backspace handling before source textarea cross-block arrows'
);

assert.match(
  editorMainBlocksSessionSource,
  /function createBlockLabels\(translateImpl\) \{[\s\S]*const translationKey = `editor\.blocks\.\$\{name\}`;[\s\S]*translated = translateImpl\(translationKey\);[\s\S]*translated !== translationKey[\s\S]*: \(blockLabelFallbacks\[name\] \|\| name\);/,
  'block labels should use local fallbacks when i18n returns the key for a missing translation'
);

assert.match(
  editorMainBlocksSessionSource,
  /linkTitle: 'Link title'/,
  'block link title field should have a local fallback label'
);

assert.match(
  editorMainBlocksSessionSource,
  /replaceImage: 'Replace image'/,
  'block replace image button should have a local fallback label'
);

[
  [enI18nSource, /linkTitle: 'Link title'/],
  [chsI18nSource, /linkTitle: '链接标题'/],
  [chtTwI18nSource, /linkTitle: '連結標題'/],
  [jaI18nSource, /linkTitle: 'リンクタイトル'/]
].forEach(([sourceText, pattern]) => {
  assert.match(sourceText, pattern, 'block link title field should have localized labels');
});

assert.match(
  editorBlocksInlineToolbarSessionSource,
  /const directControls = \[[\s\S]*\['B', 'bold', 'inlineBold', 'Bold'\],[\s\S]*\['I', 'italic', 'inlineItalic', 'Italic'\],[\s\S]*\['Link', 'link', 'inlineLink', 'Link'\][\s\S]*const moreControls = \[[\s\S]*\['S', 'strikeThrough', 'inlineStrike', 'Strikethrough'\],[\s\S]*\['`', 'code', 'inlineCode', 'Inline code'\]/,
  'inline toolbar session should keep B/I/Link direct while moving strike and inline code into overflow formatting controls'
);

assert.match(
  editorBlocksInlineToolbarSessionSource,
  /const createCommandButton = \(label, command, key, fallback, index, className = 'blocks-inline-btn'\) => \{[\s\S]*btn\.dataset\.inlineCommand = command[\s\S]*btn\.setAttribute\('aria-pressed', 'false'\)[\s\S]*event\.preventDefault\(\)[\s\S]*if \(btn\.getAttribute\('aria-disabled'\) === 'true'\) return;[\s\S]*applyInlineCommand\(command\)/,
  'inline toolbar session should route direct and overflow formatting commands through the same command button path'
);

assert.match(
  editorBlocksInlineToolbarSessionSource,
  /const createMoreMenu = \(index\) => \{[\s\S]*wrap\.className = 'blocks-inline-more';[\s\S]*const trigger = createButton\(documentRef, 'Aa', 'blocks-inline-btn blocks-inline-more-trigger'\);[\s\S]*trigger\.setAttribute\('aria-haspopup', 'menu'\);[\s\S]*menu\.className = 'blocks-inline-more-menu';[\s\S]*moreControls\.forEach\(\(\[_label, command, key, fallback\]\) => \{[\s\S]*createCommandButton\(text\(key, fallback\), command, key, fallback, index, 'blocks-inline-menu-item'\);[\s\S]*item\.setAttribute\('role', 'menuitem'\);[\s\S]*const createControls = \(index\) => \{[\s\S]*controls\.appendChild\(moreMenu\);/,
  'inline toolbar session should render strike and code as text-label overflow menu items after the direct controls'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksInlineToolbarSessionSource}`,
  /const closeInlineMoreMenu = \(restoreFocus = false\) => \{[\s\S]*menuSession\.closeInlineMenu\(restoreFocus\);[\s\S]*const closeMoreMenu = \(restoreFocus = false\) => \{[\s\S]*menuSession\.closeInlineMenu\(restoreFocus\);[\s\S]*const createMoreMenu = \(index\) => \{[\s\S]*menuSession\.openInlineMenu\(\{ wrap, trigger, menu \}\);[\s\S]*menuSession\.isInlineMenuOpen\(menu\)/,
  'inline more menu DOM handles should be routed through the explicit menu session service'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const inlineControls|const inlineMoreControls|const createInlineCommandButton|const createInlineMoreMenu|const createInlineControls/,
  'blocks editor root should not own inline toolbar control DOM construction'
);

assert.match(
  editorBlocksListSessionSource,
  /const createIndentControls = \(block, index\) => \{[\s\S]*controls\.className = 'blocks-list-indent-controls'[\s\S]*\['←', -1, 'listOutdent'[\s\S]*\['→', 1, 'listIndent'[\s\S]*indentItem\(block, index, delta\)[\s\S]*return controls;/,
  'list session should own outdent and indent buttons for the floating toolbar'
);

assert.match(
  editorBlocksListSessionSource,
  /const indentItem = \(block, index, delta\) => \{[\s\S]*activeListItemIndex\(block, index\)[\s\S]*indent: nextIndent,[\s\S]*indentText: '  '\.repeat\(nextIndent\)[\s\S]*blocksState\.setPendingListFocus\(\{ blockId: block\.id, itemIndex, atEnd: false \}\);[\s\S]*if \(event\.key === 'Tab'[\s\S]*indentItem\(block, index, event\.shiftKey \? -1 : 1\);/,
  'Tab and toolbar list indentation should share the same list session item indentation path'
);

assert.match(
  `${editorBlocksModelSource}\n${editorBlocksSource}\n${editorBlocksInlineToolbarSessionSource}`,
  /function inlineRangeAnyMarked\(runs, start, end, mark\)[\s\S]*next > safeStart && cursor < safeEnd && !!run\[mark\][\s\S]*const shouldApply = command === 'code'[\s\S]*inlineRangeAnyMarked\(runs, start, end, command\)[\s\S]*inlineRangeAnyMarked\(runs, offsets\.start, offsets\.end, mark\)/,
  'B/I/S inline formatting should treat mixed selected ranges as active when any selected text has the mark'
);

assert.match(
  editorBlocksModelSource,
  /function inlineMarksAtOffset\(runs, offset\)[\s\S]*let previous = null;[\s\S]*target === cursor \|\| \(target > cursor && target < next\)[\s\S]*if \(target === next\) previous = run;[\s\S]*previous \|\| safeRuns\[safeRuns\.length - 1\]/,
  'collapsed caret inline formatting should prefer the right-hand run at mark boundaries and only fall back to the previous run at the end'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksRichTextSessionSource}\n${editorBlocksListSessionSource}`,
  /function selectionEditableInRoot\(root, selectionSession = null\)[\s\S]*selectionTools\.getSelectionRange\(root\)[\s\S]*closestElement\(candidate, '\.blocks-rich-editable'\)[\s\S]*const editableSession = createEditorBlocksEditableSession\(\);[\s\S]*const selectionSession = createEditorBlocksSelectionSession\(\{[\s\S]*editableSession\?\.registerEditable\?\.\(editable, sync\);[\s\S]*editableSession\.registerEditable\(span, sync\);/,
  'blocks editor should provide registered editables and a browser-selection lookup for inline toolbar recovery'
);

assert.match(
  editorBlocksInlineToolbarSessionSource,
  /function recoverActiveFromSelection\(nodes\) \{[\s\S]*const selectionEditable = selectionEditableInRoot\(root, selectionSession\);[\s\S]*const canRecoverSelectionActive = !\([\s\S]*blocksState\.selectionActiveRecoverySuppressed\(now\(\)\)[\s\S]*blocksState\.setActiveIndex\(selectionIndex\);[\s\S]*editableSession\.bindActiveEditing\([\s\S]*blocksState,[\s\S]*selectionEditable,[\s\S]*blocksState\.getActiveSync\(\)[\s\S]*\);/,
  'inline toolbar session should recover the active rich editable directly from the browser selection'
);

assert.doesNotMatch(
  editorBlocksSource,
  /editableSyncMap/,
  'blocks editor should not own the editable sync WeakMap directly'
);

assert.match(
  editorBlocksEditableSessionSource,
  /export function createEditorBlocksEditableSession\(\) \{[\s\S]*const editableSyncMap = new WeakMap\(\);[\s\S]*function registerEditable\(editable, sync = null\)[\s\S]*function bindActiveEditing\(blocksState, editable, fallbackSync = null\)/,
  'editable sync WeakMap should live behind an explicit editable session service'
);

assert.match(
  editorBlocksSource,
  /const selectionSession = createEditorBlocksSelectionSession\(\{[\s\S]*documentRef: runtime\.documentRef,[\s\S]*windowRef: runtime\.windowRef[\s\S]*\}\);[\s\S]*selectionSession\.clearSelection\(root\)/,
  'blocks editor should route native selection clearing through the selection session service'
);

assert.match(
  editorBlocksPointerSessionSource,
  /selectionSession\.rangeFromPoint\(editable, targetX, targetY,[\s\S]*containsNode,[\s\S]*textOnly: true[\s\S]*selectionSession\.selectRange\(range, editable\)/,
  'blocks pointer session should route caret recovery through the selection session service'
);

assert.match(
  editorBlocksSelectionSessionSource,
  /export function createEditorBlocksSelectionSession\([\s\S]*function getSelection\(node = null\)[\s\S]*function getSelectionRange\(node = null\)[\s\S]*function selectRange\(range, node = null\)[\s\S]*function rangeFromPoint\(root, x, y, options = \{\}\)[\s\S]*function nodeFromPoint\(event, root = null, fallback = null, options = \{\}\)/,
  'browser selection, range, and point-caret APIs should live behind an explicit blocks selection session'
);

assert.match(
  editorBlocksStateSource,
  /suppressSelectionActiveRecoveryUntil: 0,/,
  'blocks state controller should own pointer selection recovery suppression state'
);

assert.match(
  editorBlocksActiveSessionSource,
  /function activateEditableFromPointer\(index, editable, sync\) \{[\s\S]*blocksState\.setSelectionActiveRecoverySuppression\(now\(\) \+ 180\);[\s\S]*setActive\(index, editable, sync\);/,
  'active session should suppress stale browser selection before editable pointer activation'
);

assert.match(
  editorBlocksInlineToolbarSessionSource,
  /const canRecoverSelectionActive = !\([\s\S]*blocksState\.selectionActiveRecoverySuppressed\(now\(\)\)[\s\S]*if \(!selectionEditable \|\| !canRecoverSelectionActive\) return;/,
  'pointerdown activation should briefly prevent stale browser selection from reselecting the previous block toolbar'
);

assert.match(
  editorBlocksActiveSessionSource,
  /function activateNonTextBlockFromPointer\(index, blockEl = null\) \{[\s\S]*blocksState\.setSelectionActiveRecoverySuppression\(now\(\) \+ 180\);[\s\S]*blocksState\.setRoutedBlockContainerClickSuppression\(now\(\) \+ 500\);[\s\S]*clearNativeSelection\(\);[\s\S]*setActive\(index\);/,
  'non-text block pointer activation should clear stale browser selection before selecting the block'
);

assert.match(
  editorBlocksSource,
  /const activateNonTextBlockFromPointer = \(index, blockEl = null\) => \{[\s\S]*blockSessions\.activateNonTextBlockFromPointer\(index, blockEl\);[\s\S]*\};/,
  'blocks editor should delegate non-text pointer activation to the active session'
);

assert.match(
  editorBlocksStateSource,
  /lastInlineMarks: null,[\s\S]*lastInlineMarkedRange: null,/,
  'blocks state controller should own remembered inline mark fallback state'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksInlineToolbarSessionSource}`,
  /function inlineMarksFromDomNode\(node, editable\)[\s\S]*tag === 'strong' \|\| tag === 'b'[\s\S]*function inlineMarksFromPointerEvent\(event, editable, selectionSession = null\)[\s\S]*selectionTools\.nodeFromPoint\(event, editable, event && event\.target, \{ containsNode: nodeContains \}\)[\s\S]*fallbackMarks && fallbackMarks\[mark\]/,
  'inline toolbar state should fall back to marks from the clicked rich-text DOM path when selection offsets are unavailable or ambiguous'
);

assert.match(
  `${editorBlocksRichTextSessionSource}\n${editorBlocksListSessionSource}`,
  /setActive\(index, editable, sync\);[\s\S]*const pointerMarks = inlineMarksFromPointerEvent\(event, editable, selectionSession\);[\s\S]*blocksState\?\.rememberInlineMarks\?\.\([\s\S]*editable,[\s\S]*pointerMarks,[\s\S]*pointerCodeRange \? \{ mark: 'code', \.\.\.pointerCodeRange \} : null[\s\S]*updateInlineToolbarState\(\);[\s\S]*setActive\(index, span, sync\);[\s\S]*const pointerMarks = inlineMarksFromPointerEvent\(event, span, selectionSession\);[\s\S]*blocksState\.rememberInlineMarks\([\s\S]*span,[\s\S]*pointerMarks,[\s\S]*pointerCodeRange \? \{ mark: 'code', \.\.\.pointerCodeRange \} : null[\s\S]*updateInlineToolbarState\(\);/,
  'paragraph and list rich-text clicks should capture inline marks after activation and refresh the toolbar'
);

assert.match(
  `${editorBlocksRichTextSessionSource}\n${editorBlocksListSessionSource}`,
  /editable\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*activateEditableFromPointer\(index, editable, sync\);[\s\S]*routeDirectQuoteCaretFromPointer\(editable, index, sync, event\);[\s\S]*span\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*activateEditableFromPointer\(index, span, sync\);/,
  'rich and list editable pointerdowns should activate the target block before browser focus/click events can paint a stale toolbar'
);

assert.match(
  editorBlocksCodeSessionSource,
  /code\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*activateEditableFromPointer\(index, code, sync\);/,
  'code session pointerdowns should activate the target block before browser focus/click events can paint a stale toolbar'
);

assert.match(
  editorBlocksSourceSessionSource,
  /area\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*activateEditableFromPointer\(index, area, sync\);/,
  'source session pointerdowns should activate the target block before browser focus/click events can paint a stale toolbar'
);

assert.match(
  editorBlocksSource,
  /if \(\(!offsets \|\| offsets\.collapsed\) && codeRange\) \{[\s\S]*blocksState\.clearInlineState\(\);[\s\S]*removeInlineMarkInRange/,
  'removing remembered inline code should clear stale toolbar mark fallback state'
);

assert.match(
  editorBlocksSource,
  /if \(mark === 'code' && inlineMarksAtOffset\(runs, offsets\.start\)\.code\) \{[\s\S]*blocksState\.clearInlineState\(\);[\s\S]*removeInlineMarkAroundOffset/,
  'removing inline code at a collapsed caret should clear stale toolbar mark fallback state'
);

assert.match(
  editorBlocksSource,
  /const hasPendingInlineMarks = \(\) => blocksState\.hasPendingInlineMarks\(\);[\s\S]*const togglePendingInlineMark = \(kind\) => \{[\s\S]*blocksState\.togglePendingInlineMark\(mark\);[\s\S]*if \(mark === 'code'\) return;[\s\S]*togglePendingInlineMark\(kind\);/,
  'inline code should not be stored as pending formatting for future text input'
);

assert.match(
  editorBlocksInlineToolbarSessionSource,
  /const rememberedCodeRange = hasBlocksState\('rememberedInlineRangeFor'\)[\s\S]*blocksState\.rememberedInlineRangeFor\(editable, 'code'\)[\s\S]*else if \(mark === 'code'\) \{[\s\S]*if \(offsets && offsets\.collapsed\) \{[\s\S]*active = !!\(marks\.code \|\| \(fallbackMarks && fallbackMarks\.code\)\);[\s\S]*disabled = !active;[\s\S]*disabled = !rangeHasInlineText\(runs, offsets\.start, offsets\.end\);[\s\S]*applyButtonState\(btn, active, disabled\);/,
  'inline code toolbar button should be aria-disabled for plain collapsed carets without using native disabled'
);

assert.match(
  editorSource,
  /\.blocks-inline-btn\[aria-disabled="true"\] \{ opacity:\.45; cursor:not-allowed; \}[\s\S]*\.blocks-inline-btn\[aria-disabled="true"\]:hover/,
  'aria-disabled inline buttons should keep a disabled visual affordance without stealing editor focus'
);

assert.match(
  editorBlocksInlineToolbarSessionSource,
  /const activeBlock = nodes\[currentState\(\)\.activeIndex\] \|\| null;[\s\S]*if \(!activeBlock \|\| !activeBlock\.contains\(btn\)\) \{[\s\S]*clearButtonState\(btn\);/,
  'hidden non-active block toolbars should not retain inline formatting active state'
);

assert.match(
  editorBlocksActiveSessionSource,
  /const nodes = blockNodes\(\);[\s\S]*const activeBlock = nodes\[activeIndex\] \|\| null;[\s\S]*const activeEditable = hasBlocksState\('getActiveEditable'\) \? blocksState\.getActiveEditable\(\) : null;[\s\S]*const keepEditable = activeEditable && activeBlock && containsNode\(activeBlock, activeEditable\);[\s\S]*blocksState\.clearActiveEditing\(\);[\s\S]*blocksState\.clearInlineState\(\);[\s\S]*nodes\.forEach\(\(el, idx\) => \{/,
  'container-only block selection should clear stale editable state from another block'
);

assert.match(
  editorBlocksLayoutSessionSource,
  /const editorViewportBottom = \(\) => \{[\s\S]*elementById\('editorContentPane'\)[\s\S]*const updateStickyBlockHead = \(\) => \{[\s\S]*const activeBlock = blockNodes\[state\.activeIndex\] \|\| null;[\s\S]*editorStickyToolbarBottom\(\) \+ gap[\s\S]*const blockTopUnderStickyToolbar = blockRect\.top < stickyTop;[\s\S]*if \(blockTopUnderStickyToolbar\) \{[\s\S]*blockRect\.bottom \+ gap \+ headHeight <= stickyTop[\s\S]*head\.classList\.add\('is-bottom-docked'\);[\s\S]*head\.style\.top = `\$\{Math\.max\(0, blockRect\.height \+ gap\)\}px`;[\s\S]*return;[\s\S]*\}[\s\S]*head\.classList\.add\('is-stuck'\);[\s\S]*head\.style\.top = `\$\{top\}px`;/,
  'active block toolbar should become a non-sticky bottom-docked overlay once the block top is covered'
);

assert.match(
  editorSource,
  /\.blocks-block\.is-active \.blocks-block-head\.is-bottom-docked \{ position:absolute; z-index:105; transform:none; transition:none; \}/,
  'bottom-docked active block toolbar should scroll with the block instead of sticking to the viewport'
);

assert.match(
  editorBlocksLayoutSessionSource,
  /disposers\.push\(addWindow\('scroll', requestStickyBlockHeadUpdate, true\)\);[\s\S]*disposers\.push\(addWindow\('resize', requestStickyBlockHeadUpdate\)\);/,
  'active block toolbar sticky position should refresh on editor pane scroll and viewport resize'
);

assert.match(
  editorBlocksLayoutSessionSource,
  /const findVerticalScrollParent = \(node\) => \{[\s\S]*elementById\('editorContentPane'\)[\s\S]*const forwardBlockHeadWheel = \(event\) => \{[\s\S]*absX > absY[\s\S]*scrollParent\.scrollTop = before \+ deltaY;[\s\S]*safePrevent\(event\);/,
  'active block toolbar wheel forwarding should keep editor content scroll-pane logic in the layout session boundary'
);

assert.match(
  editorBlocksHeadSessionSource,
  /head\.addEventListener\('wheel', forwardBlockHeadWheel, \{ passive: false \}\);/,
  'block head session should bind the forwarded wheel handler on generated block heads'
);

assert.match(
  editorBlocksBodySessionSource,
  /item\.addEventListener\('click', \(event\) => \{[\s\S]*shouldSuppressRoutedBlockContainerClick\(\)[\s\S]*closest\(event\.target, '\.blocks-block-head'\)[\s\S]*setActive\(index\);[\s\S]*\}\);[\s\S]*item\.addEventListener\('focusin', \(\) => setActive\(index\)\);/,
  'block section container clicks should select the block without hijacking toolbar action clicks or routed carets'
);

assert.match(
  editorBlocksStateSource,
  /reorderAnimating: false/,
  'block move animation should guard against overlapping reorder operations'
);

assert.match(
  editorBlocksLayoutSessionSource,
  /const finishBlockReorder = \(\) => \{[\s\S]*state\.reorderAnimating = false;[\s\S]*requestStickyBlockHeadUpdate\(\);[\s\S]*\};/,
  'block move animation should relayout the floating toolbar after the shared block transform finishes'
);

assert.match(
  editorBlocksLayoutSessionSource,
  /const updateStickyBlockHead = \(\) => \{[\s\S]*clearStickyBlockHeads\(head\);[\s\S]*if \(state\.reorderAnimating\) \{[\s\S]*clearStickyBlockHeads\(\);[\s\S]*return;[\s\S]*\}/,
  'active block toolbar should stay inside the moving block while reorder animation is active'
);

assert.match(
  editorBlocksLayoutSessionSource,
  /const captureBlockRects = \(indexes = null\) => \{[\s\S]*const allowed = Array\.isArray\(indexes\) \? new Set\(indexes\) : null;[\s\S]*if \(allowed && !allowed\.has\(index\)\) return;[\s\S]*const id = el\?\.dataset \? el\.dataset\.blockId : '';[\s\S]*rects\.set\(id, el\.getBoundingClientRect\(\)\);[\s\S]*return rects;/,
  'block move animation should key before-rect snapshots by stable block ids for only the affected indexes'
);

assert.match(
  editorBlocksLayoutSessionSource,
  /const animateBlockReorder = \(beforeRects\) => \{[\s\S]*const before = id \? beforeRects\.get\(id\) : null;[\s\S]*const after = el\.getBoundingClientRect\(\);[\s\S]*const dx = before\.left - after\.left;[\s\S]*const dy = before\.top - after\.top;[\s\S]*item\.el\.style\.transition = 'none';[\s\S]*item\.el\.style\.transform = `translate3d\(\$\{item\.dx\}px, \$\{item\.dy\}px, 0\)`;[\s\S]*requestFrame\(\(\) => \{[\s\S]*item\.el\.style\.transition = '';[\s\S]*item\.el\.style\.transform = 'translate3d\(0, 0, 0\)';[\s\S]*setTimer\(finish, 360\)/,
  'block move animation should FLIP the final rendered DOM from old coordinates back to zero transform'
);

assert.match(
  editorBlocksLayoutSessionSource,
  /const moveBlock = \(index, direction\) => \{[\s\S]*prefersReducedReorderMotion\(\)[\s\S]*const beforeRects = captureBlockRects\(\[index, targetIndex\]\);[\s\S]*state\.reorderAnimating = true;[\s\S]*const moved = moveBlockInState\(index, direction\);[\s\S]*replaceAdjacentBlockElements\(index, targetIndex\)[\s\S]*emit\(\);[\s\S]*animateBlockReorder\(beforeRects\);/,
  'block move should update state and replace only the adjacent affected DOM nodes before animating'
);

assert.match(
  editorBlocksSource,
  /const layoutSession = blockSessions\.setLayoutSession\(createEditorBlocksLayoutSession\(\{[\s\S]*runtime,[\s\S]*state,[\s\S]*root,[\s\S]*list,[\s\S]*blockElements,[\s\S]*containsNode: nodeContains,[\s\S]*moveBlockInState: \(index, direction\) => blocksState\.moveBlock\(index, direction\),[\s\S]*replaceAdjacentBlockElements: \(index, targetIndex\) => replaceAdjacentBlockElements\(index, targetIndex\),[\s\S]*render: \(\) => render\(\),[\s\S]*emit,[\s\S]*onWindow[\s\S]*\}\)\);[\s\S]*layoutSession\.bind\(\);/,
  'blocks editor should compose sticky/reorder layout through the explicit layout session service'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const animateBlockReorder =|const updateStickyBlockHead =|const findVerticalScrollParent =|const captureBlockRects =|function finishBlockReorder/,
  'blocks root should not own sticky toolbar or block reorder geometry'
);

assert.doesNotMatch(
  editorBlocksSource,
  /moved\.dirty\s*=\s*true/,
  'block reorders should not mark untouched block content dirty'
);

assert.match(
  editorBlocksBodySessionSource,
  /const replaceAdjacentBlockElements = \(index, targetIndex\) => \{[\s\S]*const firstIndex = Math\.min\(index, targetIndex\);[\s\S]*const secondIndex = Math\.max\(index, targetIndex\);[\s\S]*const firstNew = renderBlockElement\(state\.blocks\[firstIndex\], firstIndex\);[\s\S]*const secondNew = renderBlockElement\(state\.blocks\[secondIndex\], secondIndex\);[\s\S]*firstOld\.remove\(\);[\s\S]*secondOld\.remove\(\);[\s\S]*setActive\(state\.activeIndex\);[\s\S]*return true;/,
  'body session should let adjacent move avoid a full list render by replacing only the two swapped block nodes'
);

assert.match(
  editorBlocksBodySessionSource,
  /const renderBlockElement = \(block, index\) => \{[\s\S]*const item = createElement\(doc, 'section'\);[\s\S]*item\.className = `blocks-block blocks-block-\$\{type\}`;[\s\S]*if \(index === state\.activeIndex\) item\.classList\.add\('is-active'\);[\s\S]*item\.dataset\.blockId = block && block\.id \? block\.id : '';/,
  'body session should mark the active block during node creation so the toolbar does not fade out and back in after reorder render'
);

assert.match(
  editorBlocksMenuSessionSource,
  /function createActionControls\(\{[\s\S]*wrap\.className = 'blocks-block-actions';[\s\S]*const trigger = createButton\(documentRef, '\\u22ef', 'blocks-icon-btn blocks-action-trigger'\);[\s\S]*trigger\.setAttribute\('aria-haspopup', 'menu'\);[\s\S]*trigger\.setAttribute\('aria-expanded', 'false'\);[\s\S]*menu\.className = 'blocks-action-menu';[\s\S]*menu\.setAttribute\('role', 'menu'\);/,
  'block reorder and delete actions should live behind a session-owned right-side overflow menu trigger'
);

assert.doesNotMatch(
  editorBlocksStateSource,
  /openActionMenu|openInlineMenu/,
  'blocks model state should not store DOM-backed action or inline menu sessions'
);

assert.match(
  editorBlocksMenuSessionSource,
  /export function createEditorBlocksMenuSession[\s\S]*let actionMenu = null;[\s\S]*let inlineMenu = null;[\s\S]*function closeActionMenu\(restoreFocus = false\)[\s\S]*function closeInlineMenu\(restoreFocus = false\)/,
  'blocks menu overlay lifecycle should live in an explicit DOM-side menu session service'
);

assert.match(
  editorBlocksSource,
  /const menuSession = createEditorBlocksMenuSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*text,[\s\S]*onDocument,[\s\S]*onWindow,[\s\S]*containsNode: nodeContains[\s\S]*\}\);[\s\S]*const closeBlockActionMenu = \(restoreFocus = false\) => \{[\s\S]*menuSession\.closeActionMenu\(restoreFocus\);/,
  'blocks editor should compose action menu DOM and lifecycle through the explicit menu session service'
);

assert.match(
  editorBlocksSource,
  /const headSession = createEditorBlocksHeadSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*text,[\s\S]*createBlockTypeIcon: createBlockTypeIconWithRuntime,[\s\S]*menuSession,[\s\S]*sourceSession,[\s\S]*listSession,[\s\S]*codeSession,[\s\S]*imageSession,[\s\S]*tableSession,[\s\S]*inlineToolbarSession,[\s\S]*createHeadingLevelSelect,[\s\S]*createMathEditButton,[\s\S]*forwardBlockHeadWheel,[\s\S]*alignBlockActionMenu,[\s\S]*setActive,[\s\S]*moveBlock,[\s\S]*insertBlankBlock,[\s\S]*deleteBlockAt[\s\S]*\}\);/,
  'blocks editor should compose block-head controls through an explicit head session service'
);

assert.match(
  editorBlocksSource,
  /const actionMenuBoundaryLeft = \(\) => \{[\s\S]*runtime\.getElementById\('editorContentPane'\)[\s\S]*return Math\.max\(8, Math\.floor\(rect\.left\)\);[\s\S]*const alignBlockActionMenu = \(menu, trigger = null\) => \{[\s\S]*menu\.classList\.remove\('is-open-right'\);[\s\S]*const boundaryLeft = actionMenuBoundaryLeft\(\);[\s\S]*const triggerRect = trigger && trigger\.getBoundingClientRect[\s\S]*const leftSpace = triggerRect \? triggerRect\.right - boundaryLeft : menuRect\.left - boundaryLeft;[\s\S]*if \(leftSpace < menuRect\.width \+ 8\) menu\.classList\.add\('is-open-right'\);/,
  'block action overflow menu should flip right when the button has insufficient left-side room inside the editor content boundary'
);

assert.match(
  editorBlocksMenuSessionSource,
  /makeItem\(text\('moveUp', 'Move up'\), '', index === 0, \(\) => moveBlock\(index, -1\)\);[\s\S]*makeItem\(text\('moveDown', 'Move down'\), '', index >= blockCount - 1, \(\) => moveBlock\(index, 1\)\);[\s\S]*makeItem\(text\('addBefore', 'Add before'\), '', false, \(\) => insertBlankBlock\(index\)\);[\s\S]*makeItem\(text\('addAfter', 'Add after'\), '', false, \(\) => insertBlankBlock\(index \+ 1\)\);[\s\S]*makeItem\(text\('delete', 'Delete'\), 'blocks-action-menu-delete', false, \(\) => deleteBlockAt\(index\)\);/,
  'overflow menu items should preserve move/delete behavior and expose blank insertion before and after the block'
);

assert.match(
  editorBlocksHeadSessionSource,
  /const createActionControls = \(index, blockCount\) => \{[\s\S]*menuSession\?\.createActionControls\?\.\(\{[\s\S]*index,[\s\S]*blockCount,[\s\S]*setActive,[\s\S]*moveBlock,[\s\S]*insertBlankBlock,[\s\S]*deleteBlockAt,[\s\S]*onReposition: \(menu, trigger\) => alignBlockActionMenu\(menu, trigger\)[\s\S]*\}\) \|\| null;/,
  'block head session should mount action controls produced by the menu session'
);

assert.match(
  editorBlocksHeadSessionSource,
  /export function createEditorBlocksHeadSession\(\{[\s\S]*menuSession = null,[\s\S]*sourceSession = null,[\s\S]*listSession = null,[\s\S]*inlineToolbarSession = null,[\s\S]*const createBlockHead = \(\{[\s\S]*head\.className = 'blocks-block-head';[\s\S]*appendIf\(head, createTypeBadge\(block\)\);[\s\S]*head\.addEventListener\('wheel', forwardBlockHeadWheel, \{ passive: false \}\);[\s\S]*appendTypeControls\(head, block, index\);[\s\S]*appendIf\(head, createActionControls\(index, blockCount\)\);/,
  'block head session should own block-head DOM assembly and type-specific toolbar controls'
);

assert.match(
  editorBlocksBodySessionSource,
  /headSession\.createBlockHead\(\{[\s\S]*block,[\s\S]*index,[\s\S]*blockCount: Array\.isArray\(state\.blocks\) \? state\.blocks\.length : 0[\s\S]*\}\)[\s\S]*item\.append\(head, renderBlockBody\(block, index\)\);/,
  'body session should mount a block head produced by the head session'
);

assert.match(
  editorBlocksSource,
  /const bodySession = blockSessions\.setBodySession\(createEditorBlocksBodySession\(\{[\s\S]*headSession,[\s\S]*blockElements,[\s\S]*createRichEditable,[\s\S]*renderMath: renderPressMath,[\s\S]*hydrateCard,[\s\S]*openMathEditorForBlock,[\s\S]*renderers: \{[\s\S]*blank: \(body, block, index\) => blockSessions\.renderBlankBlock\(body, block, index\),[\s\S]*image: \(body, block, index\) => imageSession\?\.renderBlock\(body, block, index\),[\s\S]*source: \(body, block, index\) => sourceSession\?\.renderBlock\(body, block, index\)[\s\S]*\}[\s\S]*\}\)\);/,
  'blocks editor root should compose block body rendering through the body session boundary'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const renderBlockBody =|const renderMathBlock =|const renderCardBlock =|const renderHeadingBlock =/,
  'blocks editor root should not own block body DOM rendering'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const createBlockActionMenu|blocks-action-trigger|blocks-action-menu|blocks-action-menu-item|blocks-action-menu-delete/,
  'blocks editor root should not own block action menu DOM construction'
);

assert.doesNotMatch(
  editorBlocksSource,
  /head\.appendChild\(createHeadingLevelSelect|listSession\?\.createTypeSelect|codeSession\?\.createLanguageInput|imageSession\?\.createMetadataControls|tableSession\?\.createControls|inlineToolbarSession\?\.createControls|menuSession\.createActionControls/,
  'blocks editor root should not assemble block-head toolbar controls directly'
);

assert.match(
  editorBlocksMenuSessionSource,
  /function closeActionMenu\(restoreFocus = false\)[\s\S]*clearRightAlignment: true[\s\S]*const closeFromPointer = \(event\) => \{[\s\S]*containsNode\(wrap, event && event\.target\)[\s\S]*closeActionMenu\(false\);[\s\S]*const closeFromKey = \(event\) => \{[\s\S]*event\.key !== 'Escape'[\s\S]*closeActionMenu\(true\);[\s\S]*onDocument\('mousedown', closeFromPointer, true\)[\s\S]*onWindow\('scroll', reposition, true\)/,
  'overflow menu should close on outside click and Escape while cleaning document and window listeners'
);

assert.doesNotMatch(
  editorBlocksSource,
  /button\('↑'|button\('↓'|button\('×', 'blocks-icon-btn blocks-delete-btn'/,
  'block toolbar should not render direct up, down, or delete icon buttons'
);

assert.doesNotMatch(
  editorBlocksSource,
  /animateAdjacentBlockMove|swappedRect\.left - movedRect\.left|swappedRect\.top - movedRect\.top/,
  'block move animation should not animate stale pre-render DOM nodes to their future positions'
);

assert.match(
  editorBlocksStateSource,
  /suppressNextBlockContainerClickUntil: 0,/,
  'blocks state controller should own routed caret click suppression state'
);

assert.match(
  editorBlocksSource,
  /const shouldSuppressRoutedBlockContainerClick = \(\) => \{[\s\S]*blocksState\.consumeRoutedBlockContainerClickSuppression\(Date\.now\(\)\);[\s\S]*\};/,
  'routed caret pointerdowns should suppress the following container click from clearing activeEditable'
);

assert.match(
  editorBlocksPointerSessionSource,
  /function isBlocksCaretInteractiveTarget\(target\) \{[\s\S]*closestElement\(target, \[[\s\S]*'\.blocks-block-head'[\s\S]*'\.blocks-command-menu'[\s\S]*'\.blocks-link-editor'[\s\S]*'\.blocks-card-preview'[\s\S]*'\.blocks-inspector'[\s\S]*'button'[\s\S]*'input'[\s\S]*'select'[\s\S]*'textarea'[\s\S]*'a\[href\]'[\s\S]*'\.blocks-image-caption'[\s\S]*'\[contenteditable="true"\]'[\s\S]*\]\.join/,
  'blocks caret routing should exclude command menus, link editors, article cards, controls, links, image captions, and native editable targets'
);

assert.match(
  editorBlocksSource,
  /const clearNativeSelection = \(\) => \{[\s\S]*selectionSession\.clearSelection\(root\);[\s\S]*\};/,
  'non-text block selection should be able to clear stale browser text selections'
);

assert.match(
  editorBlocksPointerSessionSource,
  /function routeBlocksCaretFromPointer\(event\) \{[\s\S]*isBlocksCaretInteractiveTarget\(event\.target\)[\s\S]*const imageBlock = closestElement\(event\.target, '\.blocks-block-image'\);[\s\S]*event\.preventDefault\(\);[\s\S]*activateNonTextBlockFromPointer\(imageIndex, imageBlock\);[\s\S]*return true;[\s\S]*const candidate = nearestEditableFromPoint\(event\.clientX, event\.clientY\);/,
  'image block pointerdowns should use non-text block activation before routing a caret to nearby text'
);

assert.match(
  editorBlocksPointerSessionSource,
  /function editableCaretCandidates\(\) \{[\s\S]*querySelectorAll\('\.blocks-list-item \.blocks-list-text'\)[\s\S]*hitTarget: closestElement\(editable, '\.blocks-list-item'\) \|\| editable[\s\S]*querySelectorAll\('\.blocks-rich-editable:not\(\.blocks-list-text\), \.blocks-code-preview code\[contenteditable="true"\], \.blocks-image-caption, \.blocks-source-textarea'\)[\s\S]*sync: editableSync\(editableSession, editable\)/,
  'routed caret candidates should include whole-row list item hit targets, rich text, code editors, image captions, and source markdown textareas with sync callbacks'
);

assert.match(
  editorBlocksPointerSessionSource,
  /editableCaretCandidates\(\)\.forEach\(candidate => \{[\s\S]*nearestRectForPoint\(candidate\.hitTarget \|\| candidate\.editable, x, y\)[\s\S]*best = candidate;/,
  'nearest editable routing should measure list items by their larger hit target while focusing the editable surface'
);

assert.match(
  editorBlocksCaretSessionSource,
  /export const CARET_POINT_MEASURE_LIMIT = 12000;[\s\S]*function measuredTextOffsetDetailsFromPoint\(el, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*selectionTools\.createTreeWalker\(el, SHOW_TEXT\)[\s\S]*let insideTextRect = false;[\s\S]*range\.setStart\(node, i\);[\s\S]*range\.setEnd\(node, i \+ 1\);[\s\S]*x >= rect\.left && x <= rect\.right && y >= rect\.top && y <= rect\.bottom[\s\S]*caretBoundaryDistance\(rect, rect\.left, x, y\)[\s\S]*bestOffset = offset \+ i;[\s\S]*caretBoundaryDistance\(rect, rect\.right, x, y\)[\s\S]*bestOffset = offset \+ i \+ 1;[\s\S]*return \{ offset: bestOffset, distance: bestDistance, insideTextRect, textRectCount \};[\s\S]*function measuredTextOffsetFromPoint\(el, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*return details \? details\.offset : null;/,
  'routed caret fallback should measure text-node character boundaries and report nearest offsets plus text-rect hits'
);

assert.match(
  editorBlocksCaretSessionSource,
  /function textareaTextOffsetDetailsFromPoint\(area, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*const mirror = area\.ownerDocument\.createElement\('div'\);[\s\S]*mirror\.style\.whiteSpace = 'pre-wrap';[\s\S]*mirror\.style\.overflowWrap = 'break-word';[\s\S]*'tabSize'[\s\S]*mirror\.textContent = value;[\s\S]*const details = measuredTextOffsetDetailsFromPoint\(mirror, x, y, limit\);[\s\S]*return \{[\s\S]*\.\.\.details,[\s\S]*offset: Math\.max\(0, Math\.min\(value\.length, details\.offset\)\)[\s\S]*function textareaTextOffsetFromPoint\(area, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*return details \? details\.offset : null;/,
  'routed source markdown textarea focus should use a styled mirror to measure nearest offsets and text-rect hits'
);

assert.match(
  editorBlocksPointerSessionSource,
  /function setContentEditableCaretFromPoint\(editable, x, y, hitTarget = editable\) \{[\s\S]*selectionSession\.rangeFromPoint\(editable, targetX, targetY,[\s\S]*containsNode,[\s\S]*textOnly: true[\s\S]*const hitRect = hitTarget && hitTarget\.getBoundingClientRect \? hitTarget\.getBoundingClientRect\(\) : rect;[\s\S]*caretSession\.measuredTextOffsetDetailsFromPoint\(editable, x, y, measureLimit\)[\s\S]*const pointInsideEditableRect = !rect \|\| \([\s\S]*x >= rect\.left[\s\S]*y <= rect\.bottom[\s\S]*if \(measuredDetails && !measuredDetails\.insideTextRect\) \{[\s\S]*caretSession\.placeAtTextOffset\(editable, measuredDetails\.offset\);[\s\S]*return;[\s\S]*if \(pointInsideEditableRect && setRangeFromPoint\(x, y\)\) return;[\s\S]*if \(measuredDetails\) \{[\s\S]*caretSession\.placeAtTextOffset\(editable, measuredDetails\.offset\);[\s\S]*nearestRectForPoint\(editable, x, y\)[\s\S]*if \(hitRect && y < hitRect\.top \+ \(hitRect\.height \/ 2\)\) \{[\s\S]*caretSession\.placeAtTextOffset\(editable, 0\);/,
  'routed rich/list/code caret placement should use measured offsets before browser APIs for blank line area clicks, then coarse fallback'
);

assert.doesNotMatch(
  editorBlocksSource,
  /pointInsideHitRect[\s\S]{0,160}setRangeFromPoint\(x, y\)/,
  'list item edge clicks should not use the larger list-item hit rectangle for native caret placement'
);

assert.doesNotMatch(
  editorBlocksSource,
  /if \(hitRect && y <= hitRect\.top\)[\s\S]{0,120}placeCaretAtTextOffset\(editable, 0\)[\s\S]{0,120}if \(hitRect && y >= hitRect\.bottom\)[\s\S]{0,120}placeCaretAtEnd\(editable\)/,
  'line-gap clicks should not early-return to editable start/end before measured caret placement'
);

assert.match(
  editorBlocksPointerSessionSource,
  /function setTextareaCaretFromPoint\(area, x, y\) \{[\s\S]*const measuredOffset = caretSession && typeof caretSession\.textareaTextOffsetFromPoint === 'function'[\s\S]*caretSession\.textareaTextOffsetFromPoint\(area, x, y, measureLimit\)[\s\S]*const fallbackOffset = rect && y < rect\.top \+ \(rect\.height \/ 2\) \? 0 : valueLength;[\s\S]*const offset = measuredOffset != null \? measuredOffset : fallbackOffset;[\s\S]*area\.setSelectionRange\(offset, offset\);/,
  'routed source markdown textarea focus should prefer mirror-measured offsets before start/end fallback'
);

assert.match(
  editorBlocksPointerSessionSource,
  /function routeDirectQuoteCaretFromPointer\(editable, index, sync, event\) \{[\s\S]*classList\.contains\('blocks-quote-text'\)[\s\S]*caretSession\.measuredTextOffsetDetailsFromPoint\(editable, event\.clientX, event\.clientY, measureLimit\)[\s\S]*details\.insideTextRect[\s\S]*event\.preventDefault\(\);[\s\S]*suppressRoutedCaretClick\(\);[\s\S]*caretSession\.placeAtTextOffset\(editable, details\.offset\);[\s\S]*activateEditableFromPointer\(index, editable, sync\);/,
  'direct quote edge pointerdowns should prevent native start/end snaps, suppress transient link-editor refreshes, and use the measured nearest offset'
);

assert.match(
  editorBlocksSourceSessionSource,
  /let sourcePointer = null;[\s\S]*area\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*const details = textareaTextOffsetDetailsFromPoint\(area, event\.clientX, event\.clientY, measureLimit, caretSession\);[\s\S]*if \(details && !details\.insideTextRect\) \{[\s\S]*event\.preventDefault\(\);[\s\S]*sourcePointer = \{ x: event\.clientX, y: event\.clientY, moved: false, corrected: true \};[\s\S]*area\.setSelectionRange\(details\.offset, details\.offset\);[\s\S]*sourcePointer = \{ x: event\.clientX, y: event\.clientY, moved: false, corrected: false \};[\s\S]*area\.addEventListener\('pointermove', \(event\) => \{[\s\S]*> 16\) sourcePointer\.moved = true;[\s\S]*area\.addEventListener\('click', \(event\) => \{[\s\S]*if \(!pointer \|\| pointer\.moved \|\| pointer\.corrected\) return;[\s\S]*const details = textareaTextOffsetDetailsFromPoint\(area, event\.clientX, event\.clientY, measureLimit, caretSession\);[\s\S]*if \(!details \|\| details\.insideTextRect\) return;[\s\S]*area\.setSelectionRange\(details\.offset, details\.offset\);[\s\S]*area\.addEventListener\('blur', \(\) => \{ sourcePointer = null; \}\);/,
  'direct source markdown textarea blank-edge pointerdowns should prevent native end snaps while text clicks and drags keep native behavior'
);

assert.match(
  `${editorBlocksPointerSessionSource}\n${editorBlocksSource}`,
  /function routeBlocksCaretFromPointer\(event\) \{[\s\S]*isBlocksCaretInteractiveTarget\(event\.target\)[\s\S]*nearestEditableFromPoint\(event\.clientX, event\.clientY\)[\s\S]*event\.preventDefault\(\);[\s\S]*suppressRoutedCaretClick\(\);[\s\S]*const \{ editable, hitTarget, index, sync \} = candidate;[\s\S]*setTextareaCaretFromPoint\(editable, event\.clientX, event\.clientY\)[\s\S]*setContentEditableCaretFromPoint\(editable, event\.clientX, event\.clientY, hitTarget\)[\s\S]*setActive\(index, editable, sync\);[\s\S]*list\.addEventListener\('pointerdown', routeBlocksCaretFromPointer\);/,
  'blocks list pointerdown should route blank clicks to the nearest editable without dropping active sync or showing a stale link editor'
);

assert.match(
  editorBlocksBodySessionSource,
  /body\.addEventListener\('click', \(event\) => \{[\s\S]*shouldSuppressRoutedBlockContainerClick\(\)[\s\S]*event\.stopPropagation\(\);[\s\S]*setActive\(index\);/,
  'block body click selection should not override a caret that was just routed on pointerdown'
);

assert.doesNotMatch(
  editorBlocksSource,
  /className\s*=\s*['"]blocks-inline-toolbar|execCommand/,
  'blocks mode should not use a standalone inline toolbar or document execCommand'
);

assert.match(
  editorBlocksHeadSessionSource,
  /if \(block\.type === 'paragraph' \|\| block\.type === 'quote' \|\| block\.type === 'list'\) \{[\s\S]*appendIf\(head, inlineToolbarSession\?\.createControls\?\.\(index\)\);[\s\S]*\}/,
  'paragraph, quote, and list blocks should receive inline controls in the floating block toolbar through the inline toolbar session'
);

assert.doesNotMatch(
  editorBlocksHeadSessionSource,
  /block\.type === 'heading'[\s\S]{0,160}createControls/,
  'heading block toolbar should not receive inline formatting controls'
);

assert.match(
  editorBlocksLinkSessionSource,
  /export function createEditorBlocksLinkSession\([\s\S]*const linkEditor = documentRef\.createElement\('div'\);[\s\S]*linkEditor\.className = 'blocks-link-editor'[\s\S]*const linkText = documentRef\.createElement\('input'\);[\s\S]*const linkHref = documentRef\.createElement\('input'\);[\s\S]*const linkTitle = documentRef\.createElement\('input'\);[\s\S]*const unlink = createButton\(documentRef, text\('unlink', 'Unlink'\), 'blocks-inline-btn blocks-unlink-btn'\);/,
  'link session should own inline link editor DOM creation and controls'
);

assert.match(
  editorBlocksMathSessionSource,
  /export function createEditorBlocksMathSession\([\s\S]*const mathEditor = documentRef\.createElement\('div'\);[\s\S]*mathEditor\.className = 'blocks-math-editor'[\s\S]*const mathSource = documentRef\.createElement\('textarea'\);[\s\S]*mathSource\.className = 'blocks-math-source'[\s\S]*const removeMath = createButton\(documentRef, text\('removeMath', 'Remove'\), 'blocks-inline-btn blocks-remove-math-btn'\);/,
  'math session should own inline and display math editor DOM creation and controls'
);

assert.match(
  editorBlocksTableSessionSource,
  /export function createEditorBlocksTableSession\([\s\S]*const createControls = \(block, index\) => \{[\s\S]*blocks-table-align-select[\s\S]*blocks-table-add-row[\s\S]*blocks-table-add-column[\s\S]*blocks-table-delete-row[\s\S]*blocks-table-delete-column/,
  'table session should own table toolbar DOM creation and row, column, and alignment controls'
);

assert.match(
  editorBlocksTableSessionSource,
  /const renderBlock = \(body, block, index\) => \{[\s\S]*blocks-table-cell-input[\s\S]*blocks-table-align-\$\{align \|\| 'default'\}[\s\S]*editableSession\.registerEditable\(input, sync\)[\s\S]*input\.addEventListener\('paste', \(event\) => \{[\s\S]*sync\(\);/,
  'table session should own table cell rendering, editable registration, and paste sanitization'
);

assert.match(
  editorBlocksTableSessionSource,
  /const syncActiveAlignmentFromEditable = \(activeBlock, editable, stateBlocks = \[\]\) => \{[\s\S]*positionFromCellInput\(cell\)[\s\S]*setActivePosition\(block, normalizePosition\(block, position\)\);/,
  'table session should own focused-cell to active-table-position synchronization'
);

assert.match(
  editorBlocksCardPickerSessionSource,
  /export function createEditorBlocksCardPickerSession\([\s\S]*element\.className = 'blocks-card-picker'[\s\S]*search\.className = 'blocks-card-search'[\s\S]*results\.className = 'blocks-card-results'[\s\S]*'blocks-card-result'[\s\S]*item\.addEventListener\('click', \(\) => chooseEntry\(entry\)\)/,
  'card picker session should own article-card picker DOM, search input, results, and result click handling'
);

assert.match(
  editorBlocksCardPickerSessionSource,
  /const open = \(insertIndex\) => \{[\s\S]*if \(!safeArray\(state\.entries\)\.length\) \{[\s\S]*insertCardBlock\(\{[\s\S]*label: 'Article'[\s\S]*forceCard: true[\s\S]*\}, safeIndex\);[\s\S]*blocksState\.openCardPicker\(safeIndex\);[\s\S]*requestRender\(\);/,
  'card picker session should own empty-card fallback and picker open/render orchestration'
);

assert.match(
  editorBlocksStateSource,
  /suppressLinkEditorRefreshUntil: 0,/,
  'blocks state controller should own routed link-editor refresh suppression state'
);

assert.match(
  editorBlocksStateSource,
  /function setCardEntries\(entries = \[\]\) \{[\s\S]*state\.cardEntries = Array\.isArray\(entries\) \? entries\.slice\(\) : \[\];[\s\S]*function getCardPickerState\(\) \{[\s\S]*open: !!state\.cardPickerOpen,[\s\S]*insertIndex: state\.cardPickerInsertIndex,[\s\S]*entries: getCardEntries\(\),[\s\S]*blockCount: state\.blocks\.length/,
  'blocks state controller should expose card picker entries and open state through explicit state APIs'
);

assert.match(
  editorBlocksLinkSessionSource,
  /const refresh = \(explicitLink = null\) => \{[\s\S]*const explicitLinkNode = explicitLink[\s\S]*explicitLink\.matches\('a\[href\]'\)[\s\S]*blocksState\.linkEditorRefreshSuppressed\(now\(\)\)[\s\S]*hide\(\);[\s\S]*return;[\s\S]*const link = explicitLinkNode && editable && containsNode\(editable, explicitLinkNode\)[\s\S]*blocksState\.setActiveLink\(link, explicitLinkNode \? \{ holdUntil: now\(\) \+ 800 \} : \{\}\);/,
  'inline link editor should ignore automatic selection refreshes during routed blank-area caret clicks while still honoring explicit link clicks'
);

assert.match(
  editorBlocksLinkSessionSource,
  /const handleOutsidePointer = \(event\) => \{[\s\S]*if \(linkEditor\.hidden\) return;[\s\S]*isInternalTarget\(target\)[\s\S]*hide\(\);[\s\S]*const bind = \(\) => \{[\s\S]*addRootListener\('keyup', refresh\);[\s\S]*addRootListener\('mouseup', refresh\);[\s\S]*addRootListener\('focusin', refresh\);[\s\S]*onDocument\('pointerdown', handleOutsidePointer, true\)[\s\S]*onDocument\('mousedown', handleOutsidePointer, true\)[\s\S]*onWindow\('resize', refresh\)[\s\S]*onWindow\('scroll', refresh, true\)[\s\S]*onDocument\('selectionchange'/,
  'inline link editor should close from a capture-phase outside pointer or mouse press'
);

assert.match(
  editorBlocksMathSessionSource,
  /const apply = \(\) => \{[\s\S]*mathEditMode\(\) === 'block'[\s\S]*updateFromControl\(block, \{ tex \}\)[\s\S]*mathEditMode\(\) === 'range'[\s\S]*applyInlineMathToRuns\(inlineRunsFromDom\(selection\.editable\), selection\.start, selection\.end, tex\)[\s\S]*textRangeForDomNode\(editable, math, inlineDomSession\)[\s\S]*const openForSelection = \(\) => \{[\s\S]*selectionMathInEditable\(editable, selectionSession\)[\s\S]*getEditableSelectionOffsets\(editable, caretSession\)[\s\S]*const openForBlock = \(block, blockEl = null\) => \{[\s\S]*blocksState\.openBlockMathEditor\(block\.id\)/,
  'math session should own math apply/open behavior across range, DOM, and block modes'
);

assert.match(
  editorBlocksMathSessionSource,
  /const handleOutsidePointer = \(event\) => \{[\s\S]*if \(mathEditor\.hidden\) return;[\s\S]*isInternalTarget\(target\)[\s\S]*hide\(\);[\s\S]*const bind = \(\) => \{[\s\S]*onDocument\('pointerdown', handleOutsidePointer, true\)[\s\S]*onDocument\('mousedown', handleOutsidePointer, true\)/,
  'math editor should close from a capture-phase outside pointer or mouse press through its session boundary'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const linkEditor = document\.createElement\('div'\)|const handleLinkEditorOutsidePointer|const applyLinkEditor = \(\) =>/,
  'blocks editor root should not own link editor overlay DOM, outside-pointer, or apply state'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const mathEditor = document\.createElement\('div'\)|const handleMathEditorOutsidePointer|const applyMathEditor = \(\)|const syncMathNodePreview/,
  'blocks editor root should not own math editor overlay DOM, outside-pointer, or apply state'
);

assert.doesNotMatch(
  editorBlocksSource,
  /function createTableControls|const setTableAlignmentSelectValue|const syncTableAlignmentControlForPosition|const tablePositionFromCellInput|new Event\(/,
  'blocks editor root should not own table toolbar helpers, active-cell DOM mapping, or synthetic DOM events'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const renderCardPicker|blocks-card-search|blocks-card-result|state\.cardEntries/,
  'blocks editor root should not own article-card picker DOM rendering or direct card-entry state'
);

assert.doesNotMatch(
  editorBlocksSource,
  /inlineToolbar\.appendChild\(linkEditor\)|className\s*=\s*['"]blocks-inline-toolbar/,
  'inline link editor should not be placed inside the sticky inline toolbar'
);

assert.match(
  editorBlocksBodySessionSource,
  /createRichEditable\?\.\(`h\$\{level\}`, block, 'text', `blocks-rich-editable blocks-heading-text/,
  'heading blocks should render as real heading elements in the visual canvas'
);

assert.match(
  editorSource,
  /\.blocks-heading-text \{ margin:0; font-family:var\(--serif, var\(--article-serif-stack, Georgia, "Times New Roman", Times, serif\)\);/,
  'heading block spacing should be owned by the outer block rhythm, not an inner heading margin'
);

assert.match(
  editorBlocksSource,
  /const imageSession = createEditorBlocksImageSession\(\{[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*blockElements,[\s\S]*selectionSession,[\s\S]*insertPlainTextIntoEditable,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*updateInlineToolbarState,[\s\S]*updateFromControl,[\s\S]*insertBlock,[\s\S]*deleteBlockAt,[\s\S]*setActive,[\s\S]*resolveAssetSrc,[\s\S]*hydrateImages,[\s\S]*requestImageUpload: options\.requestImageUpload,[\s\S]*canDeleteImageResource: options\.canDeleteImageResource,[\s\S]*requestImageDelete: options\.requestImageDelete/,
  'blocks editor root should compose image DOM/control behavior through the image session boundary'
);

assert.match(
  editorBlocksImageSessionSource,
  /const img = documentRef\.createElement\('img'\);[\s\S]*img\.className = 'blocks-image-preview'[\s\S]*const placeholder = documentRef\.createElement\('div'\);[\s\S]*placeholder\.className = 'blocks-image-placeholder'[\s\S]*const caption = documentRef\.createElement\('figcaption'\);[\s\S]*caption\.className = 'blocks-image-caption';[\s\S]*caption\.contentEditable = 'true';[\s\S]*caption\.dataset\.placeholder = text\('imageAlt', 'Alt text'\);[\s\S]*figure\.append\(img, placeholder, caption\);/,
  'image blocks should render a real image element with an editor-only empty-image placeholder and directly editable caption'
);

assert.match(
  editorBlocksImageSessionSource,
  /const configurePreview = \(figure, img, src\) => \{[\s\S]*img\.onload = \(\) => \{[\s\S]*setPlaceholderVisible\(figure, false\);[\s\S]*img\.onerror = \(\) => \{[\s\S]*setPlaceholderVisible\(figure, true\);[\s\S]*if \(!nextSrc\) \{[\s\S]*img\.removeAttribute\('src'\);[\s\S]*setPlaceholderVisible\(figure, true\);[\s\S]*if \(img\.getAttribute\('src'\) !== nextSrc\) img\.src = nextSrc;/,
  'image preview loading should toggle the placeholder for empty, failed, and loaded sources'
);

assert.match(
  editorBlocksCommandSessionSource,
  /\['image', 'image', 'Image', \{ alt: '', src: '' \}\]/,
  'inserted image blocks should start with an intentionally empty src so the placeholder is visible'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const selectImageBlock = \(event\) => \{[\s\S]*figure\.addEventListener\('pointerdown', selectImageBlock\);[\s\S]*figure\.addEventListener\('click', selectImageBlock\);/,
  'image figures should rely on delegated block pointer routing, not stopped local click handlers'
);

assert.match(
  editorBlocksImageSessionSource,
  /const createMetadataControls = \(block, index\) => \{[\s\S]*controls\.className = 'blocks-image-meta-controls';[\s\S]*const replace = createButton\(documentRef, text\('replaceImage', 'Replace image'\), 'blocks-btn blocks-image-replace'\);[\s\S]*const deleteResource = createButton\(documentRef, text\('deleteImageResource', 'Delete resource'\), 'blocks-btn blocks-image-delete-resource'\);[\s\S]*title\.className = 'blocks-image-title';[\s\S]*updateFromControl\(block, \{ title: inputValue\(title\) \}\);[\s\S]*requestImageUpload\(\{ replaceIndex: index, replaceBlockId: block && block\.id \}\);[\s\S]*canDeleteImageResource\(block && block\.data \? block\.data\.src \|\| '' : '',[\s\S]*requestImageDelete\(\{ index, blockId: block && block\.id, src: block && block\.data \? block\.data\.src \|\| '' : '' \}\);[\s\S]*controls\.append\(title, replace, deleteResource\);/,
  'image metadata controls should keep title/replace controls and expose explicit local resource deletion'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-image-alt|controls\.append\(alt, title, replace\)|alt: inputValue\(alt\)/,
  'image metadata controls should not keep the old toolbar alt-text input'
);

assert.match(
  editorBlocksImageSessionSource,
  /const updateCaptionAlt = \(block, caption\) => \{[\s\S]*const img = blockEl && blockEl\.querySelector \? blockEl\.querySelector\('\.blocks-image-preview'\) : null;[\s\S]*const alt = plainEditableValue\(caption\);[\s\S]*if \(img\) img\.alt = alt;[\s\S]*caption\.classList\.toggle\('is-empty', !alt\);[\s\S]*updateFromControl\(block, \{ alt \}\);[\s\S]*caption\.addEventListener\('input', syncCaption\);/,
  'editable image captions should update block alt text and keep the rendered img alt synchronized'
);

assert.match(
  editorBlocksHeadSessionSource,
  /if \(block\.type === 'image'\) appendIf\(head, imageSession\?\.createMetadataControls\?\.\(block, index\)\);/,
  'image block controls should be appended to the floating block toolbar'
);

assert.match(
  editorBlocksStateSource,
  /function resolveBlockTarget\(target = state\.activeIndex, predicate = \(\) => true\) \{[\s\S]*const expectedBlockId = target && typeof target === 'object' && typeof target\.blockId === 'string'[\s\S]*if \(!Number\.isInteger\(safeIndex\) \|\| safeIndex < 0 \|\| safeIndex >= state\.blocks\.length\) \{[\s\S]*if \(!expectedBlockId\) return null;[\s\S]*state\.blocks\.findIndex\(item => item && item\.id === expectedBlockId\)[\s\S]*if \(expectedBlockId && \(!block \|\| block\.id !== expectedBlockId\)\) \{[\s\S]*if \(!block \|\| !predicate\(block\)\) return null;[\s\S]*return \{ block, index: safeIndex \};/,
  'blocks state controller should resolve block targets by identity and predicate'
);

assert.match(
  editorBlocksImageSessionSource,
  /const resolveImageBlockTarget = \(target\) => \{[\s\S]*return blocksState\.resolveBlockTarget\(target, block => block && block\.type === 'image'\);[\s\S]*const replaceImageBlock = \(src, target\) => \{[\s\S]*const resolved = resolveImageBlockTarget\(target\);[\s\S]*updateFromControl\(block, \{ src \}, true\);[\s\S]*return \{ index: safeIndex \};/,
  'image replacement should validate the target image identity and re-render toolbar controls after updating an existing block'
);

assert.match(
  editorBlocksImageSessionSource,
  /const getImageBlockSource = \(target\) => \{[\s\S]*const resolved = resolveImageBlockTarget\(target\);[\s\S]*const deleteImageBlock = \(target\) => \{[\s\S]*const resolved = resolveImageBlockTarget\(target\);[\s\S]*deleteBlockAt\(resolved\.index\);[\s\S]*return \{ index: resolved\.index, src \};/,
  'image resource deletion should validate identity before removing the image block'
);

assert.doesNotMatch(
  editorBlocksSource,
  /replaceImageBlock\(src, index = state\.activeIndex\) \{[\s\S]*Math\.max\(0, Math\.min/,
  'image replacement should not clamp stale out-of-range indexes onto another block'
);

assert.match(
  editorMainImageSessionSource,
  /const requestBlocksImageUpload = \(\{ index, replaceIndex, replaceBlockId \} = \{\}\) => \{[\s\S]*replaceIndex: Number\.isFinite\(replaceIndex\) \? replaceIndex : null,[\s\S]*replaceBlockId: typeof replaceBlockId === 'string' && replaceBlockId \? replaceBlockId : null[\s\S]*const replaceIndex = blockInsert && Number\.isFinite\(blockInsert\.replaceIndex\)[\s\S]*const replaceBlockId = blockInsert && typeof blockInsert\.replaceBlockId === 'string'[\s\S]*const replaceMarkdown = \(replaceIndex != null \|\| replaceBlockId\)[\s\S]*const result = blocksEditor\.replaceImageBlock\(relativePath, \{ index: replaceIndex, blockId: replaceBlockId \}\);[\s\S]*if \(!result\) return false;[\s\S]*singleImage: !!replaceMarkdown[\s\S]*if \(replaceMarkdown\) imageFileOptions\.insertAbortToast = translate\('editor\.toasts\.imageReplaceTargetMissing'\);/,
  'image upload picker should support replacing one existing image block through an identity-checked target'
);

assert.match(
  editorMainImageSessionSource,
  /import \{ resolveLocalMarkdownAssetReference \} from '\.\/repository-deletions\.js\?v=[\w.-]+';[\s\S]*const canDeleteImageResource = \(src\) => !!resolveCurrentImageResource\(src\);[\s\S]*const requestBlocksImageDelete = \(\{ index, blockId, src \} = \{\}\) => \{[\s\S]*resolveLocalMarkdownAssetReference\(markdownPath, source \|\| src, getContentRoot\(\)\)[\s\S]*runtime\.requestAssetDelete\(detail\)[\s\S]*blocksEditor\.deleteImageBlock\(target\)[\s\S]*runtime\.emitAssetDeleteCanceled\(detail\)/,
  'visual image blocks should request explicit repository asset deletion before removing the block'
);

assert.match(
  editorMainImageSessionSource,
  /let selection;[\s\S]*if \(customInsertMarkdown\) \{[\s\S]*selection = customInsertMarkdown\(paths\.relativePath, meta\.altText\);[\s\S]*if \(selection === false\) \{[\s\S]*if \(opts\.insertAbortToast\) emitToast\('warn', opts\.insertAbortToast\);[\s\S]*continue;[\s\S]*runtime\.emitAssetAdded\(\{/,
  'image uploads should skip asset-added events and success toasts when replacement aborts'
);

assert.match(
  editorMainImageSessionSource,
  /let pendingBlocksImageInsert = null;[\s\S]*let pendingImagePickerToken = 0;[\s\S]*const armImagePickerCancelReset = \(token\) => \{[\s\S]*if \(token !== pendingImagePickerToken\) return;[\s\S]*if \(!hasFiles\) pendingBlocksImageInsert = null;[\s\S]*imageInput\.addEventListener\('cancel', clearIfPickerStillPending, \{ once: true \}\);[\s\S]*imageInput\.addEventListener\('blur', clearIfPickerStillPending, \{ once: true \}\);[\s\S]*const openImageInputPicker = \(\) => \{[\s\S]*pendingImagePickerToken \+= 1;[\s\S]*imageInput\.value = '';[\s\S]*armImagePickerCancelReset\(pickerToken\);[\s\S]*imageInput\.click\(\);/,
  'image picker cancellation should clear stale pending replacement targets'
);

assert.match(
  editorMainImageSessionSource,
  /const handleImageInputChange = \(\) => \{[\s\S]*const blockInsert = pendingBlocksImageInsert;[\s\S]*pendingBlocksImageInsert = null;[\s\S]*pendingImagePickerToken \+= 1;[\s\S]*if \(files && files\.length\) \{[\s\S]*imageInput\.addEventListener\('change', handleImageInputChange\);/,
  'image picker changes should consume the pending replacement target before handling files'
);

assert.match(
  editorMainPreviewSessionSource,
  /const refreshAssetOverrides = \(\) => \{[\s\S]*\['blocks-wrap'\]\.forEach\(\(id\) => \{[\s\S]*const target = getElementById\(id\);[\s\S]*applyAssetOverrides\(target, previewAssetCurrentPath\);[\s\S]*\}\);[\s\S]*\};/,
  'asset preview refresh should update WYSIWYG block images through the preview session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-image-inspector/,
  'image metadata controls should not render as an inspector inside the block body'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-image-src/,
  'image metadata controls should not expose a direct image path input'
);

assert.match(
  editorBlocksListSessionSource,
  /const listEl = documentRef\.createElement\(isTaskList \? 'ul' : 'div'\);[\s\S]*const li = documentRef\.createElement\(isTaskList \? 'li' : 'div'\);[\s\S]*span\.contentEditable = 'true'/,
  'list blocks should render editable list item elements instead of a textarea'
);

assert.match(
  editorBlocksBodySessionSource,
  /const quote = createElement\(doc, 'blockquote'\);[\s\S]*blocks-quote-preview/,
  'quote blocks should render as blockquote elements'
);

assert.match(
  editorBlocksCodeSessionSource,
  /const renderBlock = \(body, block, index\) => \{[\s\S]*const pre = documentRef\.createElement\('pre'\);[\s\S]*const scroll = documentRef\.createElement\('div'\);[\s\S]*scroll\.className = 'blocks-code-scroll';[\s\S]*const gutter = documentRef\.createElement\('div'\);[\s\S]*gutter\.className = 'blocks-code-gutter';[\s\S]*const surface = documentRef\.createElement\('div'\);[\s\S]*surface\.className = 'blocks-code-surface';[\s\S]*const highlight = documentRef\.createElement\('code'\);[\s\S]*highlight\.className = 'blocks-code-highlight language-plain';[\s\S]*const code = documentRef\.createElement\('code'\);[\s\S]*code\.className = 'blocks-code-editable';[\s\S]*code\.contentEditable = 'true'/,
  'code session should render a pre/code editing surface with an owned non-editable scroll wrapper, gutter, and highlight mirror'
);

assert.match(
  editorBlocksCodeSessionSource,
  /const renderGutter = \(gutter, value\) => \{[\s\S]*String\(value == null \? '' : value\)\.split\('\\n'\)\.length[\s\S]*gutter\.replaceChildren\(frag\);[\s\S]*Array\.from\(gutter\.children\)\.forEach/,
  'code block gutters should be rendered from plain line counts without touching code text'
);

assert.doesNotMatch(
  editorBlocksCodeSessionSource,
  /gutter\.style\.width/,
  'code block gutters should not use a fixed inline width that can squeeze two-digit line numbers'
);

assert.match(
  editorBlocksSource,
  /function normalizeCodeEditablePlainText\(value\) \{[\s\S]*\.replace\(\/\\r\\n\/g, '\\n'\)[\s\S]*\.replace\(\/\\r\/g, '\\n'\);[\s\S]*function codeEditableText\(el\) \{[\s\S]*normalizeCodeEditablePlainText\(el\.innerText \|\| el\.textContent \|\| ''\)\.replace\(\/\\n\$\/, ''\);/,
  'code block text extraction should normalize browser Enter separators before syncing'
);

assert.match(
  editorBlocksSource,
  /function insertCodeEditableTextAtSelection\(el, value, selectionSession = null\) \{[\s\S]*const selectionTools = normalizeSelectionSession\(selectionSession\);[\s\S]*const offsets = codeEditableSelectionOffsets\(el, selectionTools\);[\s\S]*el\.textContent = next;[\s\S]*placeCaretAtTextOffset\(el, start \+ insert\.length, selectionTools\);[\s\S]*return next;/,
  'code block controlled text insertion should restore the caret after rewriting Enter text'
);

assert.match(
  editorBlocksCodeSessionSource,
  /const refresh = \(value = codeEditableText\(code\)\) => \{[\s\S]*renderGutter\(gutter, value\);[\s\S]*renderHighlight\(highlight, languageLabel, value, blockData\(block\)\.lang \|\| ''\);[\s\S]*const sync = \(\) => \{[\s\S]*const value = codeEditableText\(code\);[\s\S]*updateFromControl\(block, \{ text: value \}\);[\s\S]*refresh\(value\);[\s\S]*editableSession\.registerEditable\(code, sync\);[\s\S]*code\.addEventListener\('input', sync\);[\s\S]*code\.addEventListener\('keydown', \(event\) => \{[\s\S]*event\.key !== 'Enter'[\s\S]*const value = insertCodeEditableTextAtSelection\(code, '\\n', selectionSession\);[\s\S]*updateFromControl\(block, \{ text: value \}\);[\s\S]*refresh\(value\);[\s\S]*code\.addEventListener\('focus', \(\) => setActive\(index, code, sync\)\);[\s\S]*surface\.append\(highlight, code\);[\s\S]*scroll\.append\(gutter, surface\);[\s\S]*pre\.appendChild\(scroll\);[\s\S]*pre\.appendChild\(languageLabel\);/,
  'code session should sync text, gutter, highlight, and badge without rewriting the editable code node'
);

assert.match(
  editorBlocksHeadSessionSource,
  /if \(block\.type === 'code'\) appendIf\(head, codeSession\?\.createLanguageInput\?\.\(block\)\);/,
  'code block language control should be appended to the floating block toolbar through the code session'
);

assert.match(
  editorBlocksCodeSessionSource,
  /function resolveCodeHighlightLanguage\(language, codeText, detectLanguage = defaultDetectLanguage\) \{[\s\S]*const resolved = CODE_LANGUAGE_ALIASES\.get\(normalized\) \|\| normalized;[\s\S]*CODE_PLAIN_LANGUAGES\.has\(normalized\)[\s\S]*CODE_HIGHLIGHT_LANGUAGES\.has\(resolved\)[\s\S]*const detected = String\(detectLanguage\(String\(codeText \|\| ''\)\) \|\| ''\)\.toLowerCase\(\);[\s\S]*const detectedResolved = CODE_LANGUAGE_ALIASES\.get\(detected\) \|\| detected;[\s\S]*return \{ language: 'plain', label: 'PLAIN', highlight: false \};/,
  'blocks code highlight resolution should support plain flags, aliases, selected languages, and auto-detection'
);

assert.match(
  editorBlocksCodeSessionSource,
  /const createLanguageLabel = \(getCodeText\) => \{[\s\S]*label\.className = 'syntax-language-label blocks-code-language-label';[\s\S]*label\.setAttribute\('role', 'button'\);[\s\S]*runtime\.writeClipboardText\(rawText\)[\s\S]*label\.addEventListener\('mouseenter'[\s\S]*label\.addEventListener\('click', copyCode\);/,
  'code session should render the native-style copy language badge inside the code frame'
);

assert.match(
  editorBlocksCodeSessionSource,
  /const renderHighlight = \(highlight, label, value, language\) => \{[\s\S]*const meta = resolveCodeHighlightLanguage\(language, raw, detectHighlightLanguage\);[\s\S]*highlight\.className = `blocks-code-highlight language-\$\{meta\.language\}`;[\s\S]*highlight\.replaceChildren\(createHighlightFragment\(raw, meta\.highlight \? meta\.language : 'plain'\)\);[\s\S]*label\.dataset\.lang = meta\.label \|\| 'PLAIN';/,
  'code session should render syntax spans only into the non-editable highlight mirror and update the badge label'
);

assert.match(
  editorBlocksCodeSessionSource,
  /const CODE_LANGUAGE_OPTIONS = \[[\s\S]*'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'ini', 'java',[\s\S]*'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'markdown',[\s\S]*'objectivec', 'perl', 'php', 'php-template', 'plaintext', 'python',[\s\S]*'python-repl', 'r', 'ruby', 'rust', 'scss', 'shell', 'sql', 'swift',[\s\S]*'typescript', 'vbnet', 'wasm', 'xml', 'yaml',[\s\S]*'html', 'yml', 'robots'[\s\S]*\];/,
  'code block language selector should expose all Highlight.js common languages plus aliases and plain flags'
);

assert.match(
  editorBlocksCodeSessionSource,
  /const currentLang = String\(data\.lang \|\| ''\)\.trim\(\);[\s\S]*const normalizedLang = currentLang\.toLowerCase\(\);[\s\S]*const resolvedLang = CODE_LANGUAGE_ALIASES\.get\(normalizedLang\) \|\| normalizedLang;[\s\S]*if \(currentLang && !CODE_LANGUAGE_OPTIONS\.includes\(normalizedLang\) && !CODE_LANGUAGE_OPTIONS\.includes\(resolvedLang\)\) \{[\s\S]*appendOption\(currentLang, `Unsupported: \$\{currentLang\}`, true\);[\s\S]*lang\.value = CODE_LANGUAGE_OPTIONS\.includes\(normalizedLang\)[\s\S]*\? normalizedLang[\s\S]*: \(CODE_LANGUAGE_OPTIONS\.includes\(resolvedLang\) \? resolvedLang : currentLang\);/,
  'code block language selector should normalize supported aliases and preserve unsupported legacy language values'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const createCodeLanguageInput =|const createLanguageInput =|const renderGutter =|const createCodeLanguageLabel =|const createLanguageLabel =|const renderHighlight =|function resolveCodeHighlightLanguage|const CODE_LANGUAGE_OPTIONS =/,
  'blocks editor root should not own code block selector, gutter, badge, highlight, or language-resolution helpers'
);

assert.match(
  editorBlocksSource,
  /const autoSizeTextarea = \(area\) => \{[\s\S]*area\.style\.height = `\$\{area\.scrollHeight\}px`;[\s\S]*\};[\s\S]*const sourceSession = createEditorBlocksSourceSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*editableSession,[\s\S]*text,[\s\S]*caretSession,[\s\S]*measureLimit: CARET_POINT_MEASURE_LIMIT,[\s\S]*textareaTextOffsetDetailsFromPoint,[\s\S]*autoSizeTextarea,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*updateFromControl,[\s\S]*setActive,[\s\S]*activateEditableFromPointer,[\s\S]*applyAutofix: index => applySourceAutofix\(index\),/,
  'blocks editor root should compose source Markdown DOM/control behavior through the source session boundary'
);

assert.match(
  editorBlocksSourceSessionSource,
  /const sourceReasonText = \(block\) => \{[\s\S]*sourceReason\.unsupported[\s\S]*const createReasonHelp = \(block, index\) => \{[\s\S]*wrap\.className = 'blocks-source-help-wrap';[\s\S]*help\.setAttribute\('aria-label', message\);[\s\S]*bubble\.className = 'blocks-source-help-bubble';/,
  'source session should own source Markdown reason help DOM and tooltip text'
);

assert.match(
  editorBlocksSourceSessionSource,
  /const canAutofix = \(block\) => !!\(block && block\.type === 'source' && block\.data && block\.data\.sourceReason === 'indentedList'\);[\s\S]*const createAutofixButton = \(block, index\) => \{[\s\S]*createButton\(documentRef, '', 'blocks-source-autofix'\);[\s\S]*icon\.textContent = '\\u2605';[\s\S]*labelSpan\.className = 'blocks-source-autofix-label';[\s\S]*setActive\(index\);[\s\S]*applyAutofix\(index\);/,
  'source session should own source Markdown autofix affordance DOM and dispatch through callbacks'
);

assert.match(
  editorBlocksSourceSessionSource,
  /const renderBlock = \(body, block, index\) => \{[\s\S]*const area = documentRef\.createElement\('textarea'\);[\s\S]*area\.className = 'blocks-textarea blocks-source-textarea';[\s\S]*const sync = \(\) => updateFromControl\(block, \{ text: area\.value \}\);[\s\S]*editableSession\.registerEditable\(area, sync\);[\s\S]*area\.addEventListener\('input', \(\) => \{[\s\S]*sync\(\);[\s\S]*autoSizeTextarea\(area\);[\s\S]*area\.addEventListener\('keydown', \(event\) => \{[\s\S]*removeEmptyBlockWithBackspace\(event, block, index, area, sync\)[\s\S]*handleCrossBlockArrowNavigation\(event, index, area\);/,
  'source session should own source Markdown textarea rendering, editable registration, autosize, sync, and key routing'
);

assert.match(
  editorBlocksHeadSessionSource,
  /const appendSourceControls = \(head, block, index\) => \{[\s\S]*appendIf\(head, sourceSession\?\.createReasonHelp\?\.\(block, index\)\);[\s\S]*if \(sourceSession\?\.canAutofix\?\.\(block\)\) \{[\s\S]*appendIf\(head, sourceSession\.createAutofixButton\?\.\(block, index\)\);/,
  'source block help and autofix controls should be appended to the floating toolbar through the source session'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksBodySessionSource}`,
  /source: \(body, block, index\) => sourceSession\?\.renderBlock\(body, block, index\)[\s\S]*callRenderer\(renderers, 'source', body, block, index\)/,
  'source block body rendering should delegate to the source session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /sourceReasonText|createSourceReasonHelp|sourceAutofixLabel|canAutofixSourceBlock|createSourceAutofixButton|blocks-source-help-wrap|blocks-source-autofix|area\.addEventListener\('input', \(\) => \{[\s\S]*autoSizeTextarea\(area\);/,
  'blocks editor root should not own source Markdown help, autofix, or textarea event wiring'
);

assert.match(
  editorBlocksSource,
  /const listSession = blockSessions\.setListSession\(createEditorBlocksListSession\(\{[\s\S]*documentRef: runtime\.documentRef \|\| root\.ownerDocument,[\s\S]*root,[\s\S]*list,[\s\S]*state,[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*selectionSession,[\s\S]*caretSession,[\s\S]*inlineDomSession,[\s\S]*closestElement,[\s\S]*text,[\s\S]*editableListItems,[\s\S]*defaultListItems,[\s\S]*normalizeListItemType,[\s\S]*patchListItemType,[\s\S]*splitEditableTextAtSelection,[\s\S]*mergeFirstListItemIntoPreviousBlock,[\s\S]*wireInlineEditable,[\s\S]*queueTask: task => queueMicrotask\(task\)[\s\S]*\}\)\);/,
  'blocks editor root should compose list DOM, toolbar, and input behavior through the list session boundary'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksBodySessionSource}`,
  /list: \(body, block, index\) => listSession\?\.renderBlock\(body, block, index\)[\s\S]*type === 'list'[\s\S]*callRenderer\(renderers, 'list', body, block, index\)/,
  'list block body rendering should delegate to the list session'
);

assert.match(
  editorBlocksListSessionSource,
  /const renderBlock = \(body, block, index\) => \{[\s\S]*const listEl = documentRef\.createElement\(isTaskList \? 'ul' : 'div'\);[\s\S]*li\.className = 'blocks-list-item';[\s\S]*span\.className = 'blocks-rich-editable blocks-list-text';[\s\S]*editableSession\.registerEditable\(span, sync\);[\s\S]*span\.addEventListener\('keydown', \(event\) => \{/,
  'list session should own visual list DOM, editable registration, and row key routing'
);

assert.match(
  editorBlocksListSessionSource,
  /if \(state && state\.pendingListFocus && state\.pendingListFocus\.blockId === block\.id[\s\S]*queueTask\(\(\) => \{[\s\S]*blocksState\.takePendingListFocus\(block\.id, itemIndex\);[\s\S]*placeCaretAtTextOffset\(span, pending\.caretOffset, caretSession\);[\s\S]*setActive\(index, span, sync\);/,
  'list session should own pending list focus restoration after rerender'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const listEl = document\.createElement\(isTaskList \? 'ul' : 'div'\)|span\.addEventListener\('keydown', \(event\) => \{[\s\S]*event\.key === 'Tab'|const createListTypeSelect|const createListIndentControls|const updateListType|const indentListItem|const activeListItemIndex|const listTypeControlValue/,
  'blocks editor root should not own visual list DOM, list item keydown wiring, or list toolbar state'
);

assert.doesNotMatch(
  editorBlocksSource,
  /lang\.type = 'text'|updateFromControl\(block, \{ lang: inputValue\(lang\) \}\)/,
  'code block language selector should not keep the old free-text input path'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-code-inspector/,
  'code block language control should not render as a body inspector'
);

assert.match(
  editorBlocksBodySessionSource,
  /const renderCardBlock = \(body, block, index\) => \{[\s\S]*preview\.className = 'blocks-card-preview';[\s\S]*const span = createElement\(doc, 'span'\);[\s\S]*span\.className = 'blocks-card-source';[\s\S]*const link = createElement\(doc, 'a'\);[\s\S]*link\.setAttribute\('href', href\);[\s\S]*link\.setAttribute\('title', 'card'\);[\s\S]*link\.textContent = label;[\s\S]*span\.appendChild\(link\);[\s\S]*preview\.appendChild\(span\);[\s\S]*hydrateCard\(preview\);[\s\S]*item\.tabIndex = -1;/,
  'article-card blocks should keep the preview wrapper while rendering through the body-session card hydration path'
);

assert.match(
  editorBlocksBodySessionSource,
  /preview\.addEventListener\('click', \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*setActive\(index\);/,
  'article-card block clicks should select the block instead of following the hydrated link'
);

assert.match(
  editorBlocksBodySessionSource,
  /preview\.addEventListener\('pointerdown', \(event\) => \{[\s\S]*event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*activateNonTextBlockFromPointer\(index, closest\(preview, '\.blocks-block-card'\)\);/,
  'article-card pointerdowns should clear stale text selection and select the card block before click recovery runs'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-card-inspector|labelInput\.placeholder = text\('cardLabel'|location\.placeholder = text\('cardLocation'/,
  'article-card blocks should not render redundant label or location inspector inputs'
);

assert.match(
  editorBlocksSource,
  /const autoSizeTextarea = \(area\) => \{[\s\S]*area\.style\.height = 'auto';[\s\S]*area\.style\.height = `\$\{area\.scrollHeight\}px`;[\s\S]*\};/,
  'blocks editor root should provide the shared textarea autosize service'
);

assert.match(
  editorBlocksSourceSessionSource,
  /area\.rows = 1;[\s\S]*area\.addEventListener\('input', \(\) => \{[\s\S]*autoSizeTextarea\(area\);[\s\S]*queueTask\(\(\) => autoSizeTextarea\(area\)\);/,
  'source markdown textareas should auto-size to their content from a one-row baseline'
);

assert.match(
  editorBlocksSourceSessionSource,
  /const sync = \(\) => updateFromControl\(block, \{ text: area\.value \}\);[\s\S]*editableSession\.registerEditable\(area, sync\);[\s\S]*area\.addEventListener\('focus', \(\) => \{[\s\S]*setActive\(index, area, sync\);/,
  'source markdown textareas should register active sync for routed caret focus'
);

assert.doesNotMatch(
  editorBlocksSource,
  /area\.value = \(block\.data\.items \|\| \[\]\)\.map\(item => item\.checked/,
  'list blocks should not use a textarea as their primary editing surface'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-list-add|listAddItem/,
  'list blocks should not render a dedicated add item button'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-list-remove|listRemoveItem/,
  'list blocks should not render per-item remove buttons'
);

assert.doesNotMatch(
  extractFunctionBody(editorBlocksSource, 'editableText'),
  /\.trim\(/,
  'editable text sync should preserve leading and trailing markdown whitespace'
);

assert.doesNotMatch(
  extractFunctionBody(editorBlocksSource, 'splitEditableTextAtSelection'),
  /\.trim\(/,
  'splitting editable text should preserve leading and trailing markdown whitespace'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksListSessionSource}`,
  /function splitEditableTextAtSelection\(el, selectionSession = null\) \{[\s\S]*const selectionTools = normalizeSelectionSession\(selectionSession\);[\s\S]*selectionTools\.getSelectionRange\(el\)[\s\S]*beforeRange\.cloneContents\(\)[\s\S]*afterRange\.cloneContents\(\)[\s\S]*span\.addEventListener\('keydown', \(event\) => \{[\s\S]*const split = splitEditableTextAtSelection\(span, selectionSession\);[\s\S]*next\[itemIndex\] = \{ \.\.\.next\[itemIndex\], text: split\.before \};[\s\S]*next\.splice\(itemIndex \+ 1, 0, \{[\s\S]*text: split\.after,[\s\S]*checked: false,[\s\S]*indent: currentIndent,[\s\S]*indentText:[\s\S]*blocksState\.setPendingListFocus\(\{ blockId: block\.id, itemIndex: itemIndex \+ 1, caretOffset: 0 \}\);/,
  'pressing Enter in a visual list item should keep the caret semantic position by focusing the after item'
);

assert.match(
  editorBlocksListSessionSource,
  /outdentEmptyListItemForEnter\(currentItems, itemIndex\)[\s\S]*updateFromControl\(block, \{ items: outdentedItems \}, true\)[\s\S]*isEditableSelectionAtStart\(span, caretSession\)[\s\S]*convertListTailItemAfterEmptyToParagraph\(currentItems, itemIndex\)[\s\S]*makeBlock\('paragraph'[\s\S]*focusBlockPrimaryEditable\(paragraph, 0\)[\s\S]*splitListItemsAtEmptyItem\(currentItems, itemIndex\)[\s\S]*normalizeSplitListStartItems\(emptySplit\.after\)[\s\S]*blocksState\.replaceBlocks\(index, 1, \[block, nextBlock\][\s\S]*insertBlankBlock\(index \+ 1, \{ focus: true \}\)[\s\S]*blocksState\.replaceBlocks\(index, 1, \[blank\]\)[\s\S]*const split = splitEditableTextAtSelection\(span, selectionSession\);/,
  'pressing Enter at a list tail after an inserted empty item should convert the current tail item to a paragraph before normal split'
);

assert.match(
  `${editorBlocksModelSource}\n${editorBlocksListSessionSource}\n${editorBlocksCaretSessionSource}`,
  /export function inlineRenderedTextLength\(markdownText\) \{[\s\S]*parseInlineRuns\(normalizeEditableMarkdownText\(markdownText\)\)[\s\S]*export function mergeListItemIntoPreviousItem\(items, itemIndex\) \{[\s\S]*itemIndentLevel\(previous\) !== itemIndentLevel\(current\)[\s\S]*listItemHasNestedChildren\(source, safeIndex\)[\s\S]*joinMergedEditableText\(previousText, listItemText\(current\)\)[\s\S]*inlineRenderedTextLength\(previousText\) \+ mergedText\.separator\.length[\s\S]*event\.key === 'Backspace' \|\| event\.key === 'Delete'[\s\S]*itemIndex > 0[\s\S]*isEditableSelectionAtStart\(span, caretSession\)[\s\S]*mergeListItemIntoPreviousItem\(next, itemIndex\)[\s\S]*if \(!mergedItem\) return;[\s\S]*blocksState\.setPendingListFocus\(\{ blockId: block\.id, itemIndex: mergedItem\.focusItemIndex, caretOffset: mergedItem\.caretOffset \}\)[\s\S]*function isSelectionAtStart\(el\) \{[\s\S]*selectionTools\.getSelectionRange\(el\)[\s\S]*beforeRange\.cloneContents\(\)/,
  'Backspace or Delete at the start of a non-first visual list item should merge only structurally safe same-level items'
);

assert.match(
  editorBlocksListSessionSource,
  /event\.key === 'Backspace' && itemIndex === 0 && index > 0 && isEditableSelectionAtStart\(span, caretSession\)[\s\S]*mergeFirstListItemIntoPreviousBlock\(previous,[\s\S]*items: currentItems[\s\S]*if \(!merged\) return;[\s\S]*blocksState\.replaceBlocks\(index - 1, 2, replacement,[\s\S]*focusBlockPrimaryEditable\(merged\.previousBlock, merged\.focus\.caretOffset\)/,
  'Backspace at the start of the first visual list item should merge into the previous block only through the safe helper'
);

assert.match(
  editorBlocksSource,
  /mergeTextBlockIntoPrevious\(previous, block\) \|\| mergeTextBlockIntoPreviousList\(previous, block\)[\s\S]*caretOffset: merged\.focusCaretOffset/,
  'Backspace at the start of a text block should support merging into a previous list tail item with safe caret placement'
);

assert.doesNotMatch(
  editorBlocksSource,
  /text: `\$\{(?:previousText|listItemText\(previous\))\}\$\{(?:currentText|listItemText\(current\))\}`/,
  'Backspace merge helpers should not directly concatenate merged text without the safe join helper'
);

assert.doesNotMatch(
  editorBlocksSource,
  /previousText\.length \+ mergedText\.separator\.length/,
  'Backspace merge caret offsets should use rendered inline text length instead of markdown source length'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksListSessionSource}`,
  /function getEditableCaretTextOffset\(el, caretSession = null\) \{[\s\S]*getTextOffset\(el\)[\s\S]*function placeCaretAtVisualLine\(el, x, edge, fallbackOffset = 0, caretSession = null\) \{[\s\S]*placeAtVisualLine\(el, x, edge, fallbackOffset\)[\s\S]*event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'[\s\S]*const nextIndex = event\.key === 'ArrowUp' \? itemIndex - 1 : itemIndex \+ 1;[\s\S]*if \(!isEditableCaretOnEdgeLine\(span, event\.key === 'ArrowUp' \? 'up' : 'down', caretSession\)\) return;[\s\S]*placeCaretAtVisualLine\(target, caretRect \? caretRect\.left : 0, event\.key === 'ArrowUp' \? 'last' : 'first', caretOffset, caretSession\);/,
  'ArrowUp and ArrowDown should cross items only from edge lines and enter multiline targets from the correct visual edge'
);

assert.match(
  editorBlocksStateSource,
  /activeIndex: -1[\s\S]*function resetEditorSession\(\) \{[\s\S]*state\.activeIndex = -1;[\s\S]*function setMarkdown\(markdown\) \{[\s\S]*resetEditorSession\(\);/,
  'blocks mode should start with no selected block so controls are not shown by default'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell \{ position:relative; display:flex; flex-direction:column; gap:\.65rem; padding:0; border-radius:0; background:transparent; color:var\(--text\); \}/,
  'blocks wrapper should remain a visual-free layout container while anchoring floating link controls'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell, \.blocks-list, \.blocks-block, \.blocks-block-body, \.blocks-virtual-block \{ cursor:text; \}/,
  'blocks editing canvas should use the text cursor across blank layout areas'
);

assert.match(
  editorSource,
  /\.blocks-block-head, \.blocks-link-editor, \.blocks-math-editor, \.blocks-image-meta-controls, \.blocks-inspector, \.blocks-card-picker, \.blocks-command-menu, \.blocks-action-menu, \.blocks-inline-more-menu \{ cursor:default; \}/,
  'blocks controls and floating panels should not inherit the canvas text cursor'
);

assert.match(
  editorSource,
  /\.blocks-btn, \.blocks-icon-btn, \.blocks-inline-btn, \.blocks-card-result, \.blocks-command-menu-item, \.blocks-action-menu-item, \.blocks-inline-menu-item \{[^}]*cursor:pointer;/,
  'toolbar buttons, card picker results, block action menu items, and inline menu items should keep pointer cursors'
);

assert.match(
  editorSource,
  /\.blocks-btn, \.blocks-icon-btn, \.blocks-inline-btn, \.blocks-card-result, \.blocks-command-menu-item, \.blocks-action-menu-item, \.blocks-inline-menu-item \{[^}]*border:1px solid var\(--border\); background:var\(--card\);/,
  'floating toolbar buttons should use opaque card backgrounds instead of transparent mixes'
);

assert.match(
  editorSource,
  /\.blocks-rich-editable, \.blocks-code-preview code, \.blocks-block input, \.blocks-block textarea, \.blocks-link-editor input, \.blocks-math-editor textarea, \.blocks-card-search \{ cursor:text; \}/,
  'editable text surfaces and text inputs should keep text cursors'
);

assert.match(
  editorSource,
  /\.blocks-block select \{ cursor:default; \}/,
  'select controls should keep their control cursor semantics'
);

assert.match(
  editorSource,
  /\.markdown-editor-shell\.is-blocks-mode, \.markdown-editor-shell:has\(#blocks-wrap:not\(\[hidden\]\)\) \{ border:0; border-radius:0; background:transparent; box-shadow:none; \}/,
  'markdown editor shell should drop its visual container treatment in blocks mode'
);

assert.match(
  editorMainWorkspaceSessionSource,
  /if \(editorShell\) editorShell\.classList\.toggle\('is-blocks-mode', nextView === 'blocks'\);/,
  'workspace view switching should mark the markdown shell as visual-free only in blocks mode'
);

assert.match(
  editorSource,
  /\.blocks-block \{ position:relative; overflow:visible; \}/,
  'blocks should be layout-only relative containers and must not clip floating controls'
);

assert.match(
  editorSource,
  /\.blocks-list \{ display:block; padding-top:0; \}/,
  'blocks list should use normal article flow instead of flex gap spacing'
);

assert.match(
  editorSource,
  /@container \(min-width: 66\.5rem\) \{[\s\S]*\.editor-workspace:has\(#blocks-wrap:not\(\[hidden\]\)\) \.editor-canvas::after \{[\s\S]*height:50vh;[\s\S]*pointer-events:none;[\s\S]*\}/,
  'two-column visual editor should reserve half a viewport of bottom reading space after the last block'
);

assert.match(
  editorSource,
  /\.blocks-virtual-block \{ position:relative; margin:\.85rem 0 1\.2rem; min-height:2\.2rem; \}[\s\S]*\.blocks-virtual-editable:empty::before \{ content:attr\(data-placeholder\);[\s\S]*\.blocks-command-menu \{ position:absolute; left:0; top:calc\(100% \+ \.35rem\);[\s\S]*\.blocks-command-menu-item \{ display:flex; align-items:center; gap:\.45rem;/,
  'blocks mode should style the bottom virtual block and slash command menu as editor-native controls'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list \{[^}]*gap:3rem/,
  'blocks list should not keep the old oversized editor-only vertical gap'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list \{[^}]*padding-top:2\.5rem/,
  'blocks list should not reserve old top padding for floating block controls'
);

assert.match(
  editorSource,
  /\.blocks-block-paragraph, \.blocks-block-source, \.blocks-block-table \{ margin:\.85rem 0; \}[\s\S]*\.blocks-block-paragraph \+ \.blocks-block-paragraph \{ margin-top:1rem; \}[\s\S]*\.blocks-block-heading \{ --blocks-heading-font-size:1\.65rem; margin:calc\(var\(--blocks-heading-font-size\) \* 1\.2\) 0 calc\(var\(--blocks-heading-font-size\) \* \.5\); \}[\s\S]*\.blocks-block-heading:has\(\.blocks-heading-h1\) \{ --blocks-heading-font-size:2rem; \}[\s\S]*\.blocks-block-heading:has\(\.blocks-heading-h6\) \{ --blocks-heading-font-size:\.92rem; \}[\s\S]*\.blocks-block-list \{ margin:\.8rem 0; \}[\s\S]*\.blocks-block-quote \{ margin:1\.2em 0; \}[\s\S]*\.blocks-block-image, \.blocks-block-card \{ margin:1rem 0; \}[\s\S]*\.blocks-block-code \{ margin:\.75rem 0; \}/,
  'blocks should use Native article rhythm margins per block type'
);

assert.match(
  editorSource,
  /\.blocks-block\.is-reordering \{ z-index:1; transition:transform \.24s cubic-bezier\(\.2,\.8,\.2,1\); will-change:transform; \}/,
  'moved blocks should animate their reorder transform without adding container chrome'
);

assert.match(
  editorSource,
  /\.blocks-block::before \{[^}]*background:color-mix\(in srgb, var\(--primary\) 42%, #60a5fa\);[^}]*opacity:0;[^}]*transition:opacity \.16s ease, background \.16s ease, box-shadow \.16s ease;/,
  'hover block indicator should use a softer default color and fade smoothly'
);

assert.match(
  editorSource,
  /\.blocks-block:hover::before \{ opacity:1; \}[\s\S]*\.blocks-block\.is-active::before \{ opacity:1; background:color-mix\(in srgb, var\(--primary\) 82%, #60a5fa\);/,
  'active block indicator should stay visible with the stronger selected color after hover ends'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block \{[^}]*\b(?:border|background|box-shadow|border-radius)\s*:/,
  'block containers should not draw their own border, background, radius, or shadow'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block\.is-active \{[^}]*\b(?:border|background|box-shadow|outline)\s*:/,
  'active block containers should not draw an outer highlight'
);

assert.match(
  editorSource,
  /\.blocks-block:focus, \.blocks-block:focus-visible \{ outline:none; \}/,
  'programmatically focused block containers should suppress the browser default focus ring'
);

assert.match(
  editorSource,
  /\.blocks-block::before \{ content:""; position:absolute; z-index:40;[\s\S]*left:-\.2rem; width:\.078125rem;[\s\S]*opacity:0; pointer-events:none;[\s\S]*\}/,
  'block hover affordance should use an out-of-flow left glow instead of container chrome'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block::before \{[^}]*\btransform\s*:/,
  'block hover affordance should not shift block layout'
);

assert.match(
  editorSource,
  /\.blocks-block:hover::before \{ opacity:1; \}/,
  'block hover should reveal the left glow cue'
);

assert.match(
  editorSource,
  /\.blocks-block-body \{ display:flex; flex-direction:column; gap:\.7rem; padding:0; \}/,
  'block body should not add outer container padding'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{ position:absolute; top:0; left:\.55rem;[\s\S]*opacity:0; pointer-events:none;[\s\S]*transform:translate3d\(0,-112%,0\) scale\(\.98\);/,
  'block type and action controls should be hidden floating overlays at the outside top-left by default'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{[^}]*height:42px; min-height:42px;[\s\S]*border:1px solid color-mix\(in srgb, var\(--border\) 76%, var\(--text\) 24%\);[\s\S]*border-radius:0; background:var\(--card\);/,
  'block floating toolbar should use a fixed 42px opaque square-corner shell'
);

assert.match(
  editorBlocksSource,
  /const BLOCK_TYPE_ICON_PATHS = \{[\s\S]*paragraph:[\s\S]*heading:[\s\S]*image:[\s\S]*list:[\s\S]*quote:[\s\S]*code:[\s\S]*source:[\s\S]*card:[\s\S]*blank:/,
  'block type icon map should cover every block type shown in the floating toolbar'
);

assert.match(
  editorBlocksSource,
  /function createBlockTypeIcon\(blockType, runtime = null\) \{[\s\S]*runtime\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*svg\.setAttribute\('viewBox', '0 0 24 24'\)[\s\S]*svg\.setAttribute\('aria-hidden', 'true'\)[\s\S]*svg\.setAttribute\('focusable', 'false'\)[\s\S]*svg\.innerHTML = BLOCK_TYPE_ICON_PATHS\[blockType\] \|\| BLOCK_TYPE_ICON_PATHS\.paragraph;/,
  'block type icon helper should create non-focusable inline SVG icons through the runtime with a paragraph fallback'
);

assert.match(
  editorBlocksHeadSessionSource,
  /const createTypeBadge = \(block\) => \{[\s\S]*type\.className = 'blocks-block-type';[\s\S]*const typeLabel = text\(block\.type === 'card' \? 'articleCard' : block\.type, block\.type\);[\s\S]*type\.title = typeLabel;[\s\S]*type\.setAttribute\('role', 'img'\);[\s\S]*type\.setAttribute\('aria-label', typeLabel\);[\s\S]*appendIf\(type, createBlockTypeIcon\(block\.type\)\);/,
  'block type badge should render an accessible SVG icon for every block, including blank blocks'
);

assert.match(
  editorSource,
  /\.blocks-block-type \{ display:inline-flex; align-items:center; justify-content:center; width:1rem; height:1\.65rem; min-width:1rem; padding:0; color:color-mix\(in srgb, var\(--muted\) 78%, var\(--text\)\); \}[\s\S]*\.blocks-block-type svg \{ display:block; width:1rem; height:1rem; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; \}/,
  'block type badge should draw the inline SVG icon without a rounded background chip'
);

assert.match(
  editorSource,
  /\.blocks-block\.is-active \.blocks-block-head \{ opacity:1; pointer-events:auto; transform:translate3d\(0,-112%,0\) scale\(1\); \}/,
  'block controls should appear only for the active block'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{[^}]*flex-wrap:nowrap;[\s\S]*transition:opacity \.16s ease;[^}]*white-space:nowrap; \}[\s\S]*\.blocks-block\.is-active \.blocks-block-head\.is-stuck \{ position:fixed; z-index:135; transform:none; transition:none; max-width:calc\(100vw - 1rem\); \}/,
  'active block controls should stay single-row and avoid transform transitions while sticking under the markdown file toolbar'
);

assert.match(
  editorSource,
  /\.blocks-block-actions \{ position:relative; display:flex; align-items:center; margin-left:\.16rem; padding-left:\.34rem; border-left:1px solid var\(--border\); \}[\s\S]*\.blocks-action-menu \{ position:absolute; right:0; top:calc\(100% \+ \.25rem\);[\s\S]*border:1px solid var\(--border\); border-radius:8px; background:var\(--card\);[\s\S]*\.blocks-action-menu\.is-open-right \{ left:0; right:auto; \}[\s\S]*\.blocks-action-menu\[hidden\] \{ display:none !important; \}/,
  'block action overflow menu should anchor right by default and flip rightward when left space is constrained'
);

assert.match(
  editorSource,
  /\.blocks-action-menu-delete \{ color:color-mix\(in srgb, #dc2626 82%, var\(--text\)\); \}[\s\S]*\.blocks-action-menu-delete:hover:not\(:disabled\), \.blocks-action-menu-delete:focus-visible:not\(:disabled\) \{ background:color-mix\(in srgb, #dc2626 12%, var\(--card\)\);/,
  'delete action inside the overflow menu should retain danger styling'
);

assert.match(
  editorSource,
  /\.blocks-block-head \.blocks-heading-level, \.blocks-block-head \.blocks-list-type-select, \.blocks-block-head \.blocks-code-language[\s\S]*\.blocks-block-head \.blocks-code-language \{ width:8\.5rem; max-width:26vw; cursor:pointer; \}/,
  'code block language selector should use compact floating-toolbar styling'
);

assert.match(
  editorSource,
  /\.blocks-block-head \.blocks-heading-level, \.blocks-block-head \.blocks-list-type-select, \.blocks-block-head \.blocks-code-language, \.blocks-block-head \.blocks-table-align-select, \.blocks-block-head \.blocks-image-meta-controls input, \.blocks-block-head \.blocks-image-replace, \.blocks-block-head \.blocks-image-delete-resource, \.blocks-block-head \.blocks-math-edit \{[^}]*border:1px solid var\(--border\); border-radius:999px; background:var\(--card\);[\s\S]*\.blocks-image-meta-controls \{ display:flex; align-items:center; gap:\.24rem;[\s\S]*\.blocks-block-head \.blocks-image-replace, \.blocks-block-head \.blocks-image-delete-resource \{ white-space:nowrap; cursor:pointer; \}[\s\S]*\.blocks-block-head \.blocks-image-delete-resource:disabled \{ opacity:\.45; cursor:not-allowed; \}/,
  'image metadata fields, replace button, and resource deletion button should use compact floating-toolbar styling'
);

assert.match(
  editorSource,
  /\.blocks-image-figure \{ position:relative; margin:0; display:block; width:100%; \}[\s\S]*\.blocks-image-preview \{ display:block; width:100%; height:auto; border-radius:\.5rem;[\s\S]*\.blocks-image-figure\.is-image-placeholder \{ aspect-ratio:5 \/ 1; min-height:5rem;[\s\S]*\.blocks-image-placeholder::after \{ content:""; position:absolute; inset:0; background:linear-gradient\(to top right,[\s\S]*\.blocks-image-figure\.is-image-placeholder \.blocks-image-placeholder \{ display:flex; \}[\s\S]*\.blocks-image-figure figcaption \{ margin-top:\.5em; min-height:1\.45em; color:var\(--muted\); font-family:var\(--serif,[\s\S]*font-size:\.9em; text-align:center;[\s\S]*\.blocks-image-figure figcaption\.is-empty::before \{ content:attr\(data-placeholder\);/,
  'image block visual styling should mirror native article images and expose a subtle editable empty-caption placeholder'
);

assert.match(
  editorSource,
  /\.blocks-code-preview code\.blocks-code-editable:focus \{ outline:none; box-shadow:none; border-color:inherit; \}/,
  'focused code block editor should not draw an inner highlight border'
);

assert.match(
  editorSource,
  /\.blocks-code-preview \{ margin:0; padding:1rem 1\.1rem; border-radius:0\.5rem; overflow:hidden; background-color:var\(--code-bg\); border:0\.0625rem solid var\(--border\); box-shadow:var\(--shadow\); color:var\(--code-text\); position:relative;[\s\S]*font-size:\.893rem; line-height:1\.55; tab-size:2; \}[\s\S]*\.blocks-code-scroll \{ display:flex; align-items:stretch; min-width:0; width:100%; overflow:auto; overflow-y:hidden; \}[\s\S]*\.blocks-code-gutter \{ flex:0 0 auto; position:sticky; left:0; z-index:1; box-sizing:border-box;[\s\S]*padding-right:\.75rem; margin-right:\.75rem; border-right:1px solid color-mix\(in srgb, var\(--code-text\) 12%, transparent\); background:var\(--code-bg\); color:color-mix\(in srgb, var\(--code-text\) 60%, transparent\);[\s\S]*font:inherit; font-variant-numeric:tabular-nums; \}[\s\S]*\.blocks-code-surface \{ position:relative; flex:1 1 auto;[\s\S]*min-width:max-content; min-height:1\.55em; \}[\s\S]*\.blocks-code-preview code \{ display:block;[\s\S]*min-width:100%; min-height:1\.55em; padding:0;[\s\S]*white-space:pre; font:inherit; line-height:inherit; tab-size:inherit; background:transparent; \}[\s\S]*\.blocks-code-highlight \{ color:inherit; pointer-events:none; user-select:none; \}[\s\S]*\.blocks-code-preview code\.blocks-code-editable \{ position:absolute; inset:0; z-index:2; color:transparent; -webkit-text-fill-color:transparent; caret-color:var\(--code-text\); \}/,
  'blocks code blocks should use native code styling while overlaying a transparent editable layer on a highlight mirror'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-preview code \{[^}]*overflow-x:auto/,
  'editable blocks code should not own horizontal scrolling because browser caret scrolling clips its left edge too early'
);

assert.match(
  editorSource,
  /\.blocks-code-scroll \{[^}]*overflow:auto; overflow-y:hidden; \}[\s\S]*\.blocks-code-gutter \{[^}]*position:sticky; left:0; z-index:1;/,
  'blocks code gutter should stick inside the non-editable scroll wrapper like native preview gutters'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-preview \{[^}]*#020617[^}]*\}/,
  'blocks code preview should not use editor-specific dark mixed backgrounds instead of native code tokens'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-gutter \{[^}]*#020617[^}]*\}/,
  'blocks code gutter should not use editor-specific dark mixed backgrounds instead of native code tokens'
);

assert.match(
  syntaxHighlightSource,
  /export function initSyntaxHighlighting\(root = document\) \{[\s\S]*const scope = root && typeof root\.querySelectorAll === 'function' \? root : document;[\s\S]*const codeBlocks = scope\.querySelectorAll\('pre code'\);[\s\S]*preElement\.classList\.contains\('blocks-code-preview'\)[\s\S]*preElement\.closest\('\.markdown-blocks-shell'\)[\s\S]*codeElement\.isContentEditable \|\| codeElement\.getAttribute\('contenteditable'\) === 'true'/,
  'syntax highlighting should be scoped and skip editable blocks code surfaces'
);

assert.match(
  syntaxHighlightSource,
  /import hljs from '\.\/vendor\/highlightjs\/highlight\.min\.js';[\s\S]*const HIGHLIGHT_LANGUAGES = \[[\s\S]*'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'ini', 'java',[\s\S]*'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'markdown',[\s\S]*'typescript', 'vbnet', 'wasm', 'xml', 'yaml'[\s\S]*\];/,
  'syntax highlighter should use the vendored Highlight.js common bundle and register its common languages'
);

assert.match(
  [mainSource, editorMainSource, editorBlocksSource, hiEditorSource].join('\n'),
  /syntax-highlight\.js\?v=[\w.-]+/,
  'runtime and editor entrypoints should cache-bust the Highlight.js-backed syntax highlighter'
);

assert.match(
  editorMainSource,
  /from '\.\/hieditor\.js\?v=[\w.-]+';/,
  'editor main should cache-bust hi-editor when Highlight.js span output changes'
);

assert.doesNotMatch(
  [mainSource, editorMainSource, editorBlocksSource, hiEditorSource].join('\n'),
  /syntax-highlight\.js(?:['"]|;)|syntax-highlight\.js\?v=blocks-code-gutter-20260505/,
  'runtime and editor entrypoints should not keep stale syntax-highlight module URLs'
);

assert.doesNotMatch(
  syntaxHighlightSource,
  /https?:\/\/|cdnjs|unpkg|jsdelivr|import\(['"][^'"]*highlight/i,
  'syntax highlighter should not load Highlight.js from a CDN or dynamic runtime package path'
);

assert.match(
  syntaxHighlightSource,
  /function highlightWithHighlightJs\(code, language\) \{[\s\S]*hljs\.highlight\(raw, \{ language: normalized, ignoreIllegals: true \}\)\.value[\s\S]*hljs\.highlightAuto\(raw, HIGHLIGHT_LANGUAGES\)\.value/,
  'syntax highlighter should use explicit Highlight.js grammars and common-language auto-detection'
);

assert.match(
  syntaxHighlightSource,
  /function detectLanguage\(code\) \{[\s\S]*const detected = hljs\.highlightAuto\(raw, HIGHLIGHT_LANGUAGES\);[\s\S]*return HIGHLIGHT_LANGUAGE_SET\.has\(language\) \? language : null;[\s\S]*\}/,
  'blank-language code blocks should use Highlight.js auto-detection directly'
);

assert.doesNotMatch(
  syntaxHighlightSource,
  /JSON\.parse|<\[\^>\]\+>|\\bdef\\s\+\\w\+|\\bfunction\\s\+\\w\+|yamlHeader|yamlKey|yamlList/,
  'syntax highlighter should not restore Press deterministic language heuristics ahead of auto-detection'
);

assert.match(
  syntaxHighlightSource,
  /function mapHighlightHtml\(html\) \{[\s\S]*mapHighlightClasses[\s\S]*`<span class="\$\{mapped\.join\(' '\)\}">`[\s\S]*function toSafeFragment\(html\)/,
  'syntax highlighter should map Highlight.js spans before passing markup through the safe fragment path'
);

assert.match(
  syntaxHighlightSource,
  /export function createSafeHighlightFragment\(code, language\) \{[\s\S]*return toSafeFragment\(simpleHighlight\(code \|\| '', language \|\| 'plain'\)\);[\s\S]*\}/,
  'syntax highlighter should expose a safe fragment helper for editor-owned highlight mirrors'
);

assert.ok(
  hiEditorSource.includes("const isClassOk = (cls) => (")
    && hiEditorSource.includes("/^syntax-[a-z-]+$/.test(cls)")
    && hiEditorSource.includes("/^hljs-[A-Za-z0-9_-]+$/.test(cls)")
    && hiEditorSource.includes("/^[A-Za-z]+_+$/.test(cls)"),
  'hi-editor safe renderer should accept Highlight.js classes plus Press syntax classes'
);

assert.match(
  hiEditorSource,
  /if \(markup\.startsWith\('<span', i\)\) \{[\s\S]*split\(\/\\s\+\/\)\.filter\(isClassOk\)[\s\S]*i \+= match\[0\]\.length;[\s\S]*const nextLt = markup\.indexOf\('<', i\);[\s\S]*if \(nextLt === i\) \{[\s\S]*document\.createTextNode\('<'\)[\s\S]*i \+= 1;[\s\S]*continue;[\s\S]*\}/,
  'hi-editor safe renderer should preserve unknown angle brackets as text and never stall on Highlight.js spans'
);

assert.ok(
  hiEditorSource.includes(".replace(/&#x([0-9a-fA-F]+);/g")
    && hiEditorSource.includes(".replace(/&#([0-9]+);/g"),
  'hi-editor safe renderer should decode numeric entities so highlighted mirror text keeps textarea wrapping'
);

assert.match(
  editorSource,
  /\.hi-editor \.hi-ta::selection \{ background: rgba\(9,105,218,0\.24\); color: transparent; -webkit-text-fill-color: transparent; \}/,
  'hi-editor should let the native textarea selection paint visible range highlights'
);

assert.match(
  editorSource,
  /\.hi-editor \.hi-pre code span, \.hi-editor \.hi-pre code span \* \{ font:inherit; font-weight:inherit; font-style:inherit; font-variant:inherit; font-variant-ligatures:inherit; font-variant-numeric:inherit; letter-spacing:inherit; text-decoration:none; \}/,
  'hi-editor highlight tokens should inherit font metrics so native textarea selection aligns with visible text'
);

assert.match(
  hiEditorSource,
  /const hasRangeSelection = selEnd > selStart;[\s\S]*if \(hasRangeSelection\) \{[\s\S]*native textarea paint selection ranges[\s\S]*return;[\s\S]*\}/,
  'hi-editor range selection should use native textarea geometry instead of custom mirror rectangles'
);

assert.doesNotMatch(
  `${hiEditorSource}\n${editorSource}`,
  /hi-selection-range|getSelectionRects|getSelectionConnectorRects|normalizeSelectionRects/,
  'hi-editor should not keep the old custom selection rectangle overlay'
);

assert.match(
  editorBlocksCodeSessionSource,
  /highlight\.replaceChildren\(createHighlightFragment\(raw, meta\.highlight \? meta\.language : 'plain'\)\);/,
  'editor block syntax highlighting should render through the safe highlight fragment helper'
);

assert.match(
  editorSource,
  /\.blocks-rich-editable \{ outline:none; min-height:1\.65em; line-height:1\.65;/,
  'empty rich text blocks should keep one editable line as a pointer target'
);

assert.match(
  editorSource,
  /\.blocks-source-textarea \{ min-height:0; width:100%; resize:none; overflow:hidden; padding-block:0; \}/,
  'source markdown textareas should expand to content without fixed minimum height, internal scrolling, or vertical padding'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-textarea \{[^}]*min-height:/,
  'block textareas should not reserve a fixed minimum height'
);

assert.match(
  editorSource,
  /\.blocks-source-textarea:focus \{ outline:none; box-shadow:none; border-color:color-mix\(in srgb, var\(--border\) 82%, transparent\); \}/,
  'focused source markdown textarea should not draw an inner highlight border'
);

assert.match(
  editorSource,
  /\.blocks-list-item input\[type="checkbox"\] \{[^}]*cursor:pointer; \}/,
  'task-list checkbox controls should keep pointer cursors inside the text-cursor canvas'
);

assert.match(
  editorSource,
  /\.blocks-card-preview a \{ cursor:default; \}/,
  'article card links should not advertise navigation in blocks mode'
);

assert.match(
  editorSource,
  /\.blocks-card-preview \.link-card-wrap \{ margin:0; \}[\s\S]*\.blocks-card-preview \.link-card \{[^}]*border:0\.0625rem solid var\(--border\);[^}]*border-radius:0\.75rem;[^}]*box-shadow:var\(--shadow\);[\s\S]*\.blocks-card-preview \.card-cover-wrap \{[^}]*aspect-ratio:16 \/ 10;[\s\S]*\.blocks-card-preview \.card-title \{[^}]*font-family:var\(--display, var\(--serif\)\);[^}]*font-size:1\.05rem;[\s\S]*\.blocks-card-preview \.card-meta \{[^}]*text-transform:uppercase;/,
  'article-card blocks should mirror the native link-card layout instead of using separate temporary card styling'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-rich-editable:focus,[^{]*\.blocks-code-preview code:focus[^{]*\{ outline:2px solid/,
  'code block editor focus should not share the generic blue focus outline rule'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block:focus-within \.blocks-block-head/,
  'focused stale blocks should not keep a second floating toolbar visible'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell \.blocks-inline-btn\.is-active, \.markdown-blocks-shell \.blocks-inline-btn\[aria-pressed="true"\], \.markdown-blocks-shell \.blocks-inline-menu-item\.is-active, \.markdown-blocks-shell \.blocks-inline-menu-item\[aria-pressed="true"\][\s\S]*background:#1d4ed8 !important;[\s\S]*background-color:#1d4ed8 !important;[\s\S]*border-color:#1e40af !important;[\s\S]*color:#fff !important;[\s\S]*box-shadow:inset[\s\S]*\.blocks-inline-controls, \.blocks-list-indent-controls \{ display:flex; align-items:center; gap:\.2rem; padding-left:\.1rem; \}[\s\S]*\.blocks-inline-controls \{ margin-left:\.16rem; padding-left:\.34rem; border-left:1px solid var\(--border\); \}/,
  'inline formatting controls should use a visible filled active state that overrides theme button resets'
);

assert.match(
  editorSource,
  /\.blocks-inline-more \{ position:relative; display:flex; align-items:center; \}[\s\S]*\.blocks-inline-more-trigger \{ min-width:2rem; font-size:\.78rem; font-weight:750; \}[\s\S]*\.blocks-inline-more-menu \{ position:absolute; right:0; top:calc\(100% \+ \.25rem\);[\s\S]*border:1px solid var\(--border\); border-radius:8px; background:var\(--card\);[\s\S]*\.blocks-inline-more-menu\[hidden\] \{ display:none !important; \}[\s\S]*\.blocks-inline-menu-item \{ width:100%; border:0; background:var\(--card\); border-radius:6px; padding:\.46rem \.58rem; text-align:left; white-space:nowrap; font-weight:700; \}[\s\S]*\.blocks-inline-menu-item\[aria-disabled="true"\] \{ opacity:\.45; cursor:not-allowed; \}/,
  'inline formatting overflow menu should be compact and anchored after the Link button'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-inline-btn\.is-active, \.blocks-inline-btn\[aria-pressed="true"\] \{[^}]*var\(--primary\) 15%/,
  'inline formatting active state should not regress to the barely visible 15% primary tint'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-inline-toolbar/,
  'blocks inline formatting should not keep a sticky standalone toolbar style'
);

assert.match(
  editorSource,
  /\.blocks-visual-list \{ margin:0 0 0 1\.25rem; padding-left:0; font-family:var\(--serif, var\(--article-serif-stack, Georgia, "Times New Roman", Times, serif\)\); font-size:1\.04rem; line-height:1\.75; letter-spacing:\.005em; \}[\s\S]*\.blocks-list-item \{ margin:\.35rem 0; padding:0; line-height:1\.75; \}[\s\S]*\.blocks-list-item:first-child \{ margin-top:0; \}[\s\S]*\.blocks-list-item:last-child \{ margin-bottom:0; \}[\s\S]*\.blocks-visual-list \.blocks-list-item::marker \{ font-family:inherit; font-size:1em; font-weight:400; color:inherit; \}/,
  'visual list rows and markers should mirror native typography without adding outer block-body whitespace'
);

assert.match(
  editorSource,
  /\.blocks-list-text \{ display:inline; min-width:0; vertical-align:baseline; line-height:inherit; padding:0; \}[\s\S]*\.blocks-visual-list-task \.blocks-list-text \{ grid-column:2; display:block; \}/,
  'visual list editable text should not add editor-only padding around native list markers'
);

assert.match(
  editorSource,
  /\.blocks-visual-list-task \{ list-style:none; margin-left:0; padding-left:0; \}[\s\S]*\.blocks-visual-list-task \.blocks-list-item \{ display:grid; grid-template-columns:1\.45rem minmax\(0, 1fr\);/,
  'task-list rows should keep checklist boxes aligned while regular list markers use native spacing'
);

assert.match(
  editorBlocksHeadSessionSource,
  /const appendListControls = \(head, block, index\) => \{[\s\S]*appendIf\(head, listSession\?\.createTypeSelect\?\.\(block, index\)\);[\s\S]*appendIf\(head, listSession\?\.createIndentControls\?\.\(block, index\)\);[\s\S]*\};/,
  'list type and indent controls should be mounted in the floating block toolbar through the list session'
);

assert.match(
  editorBlocksSource,
  /const createHeadingLevelSelect = \(block\) => \{[\s\S]*const select = runtime\.createElement\('select'\);[\s\S]*select\.className = 'blocks-heading-level'[\s\S]*const option = runtime\.createElement\('option'\);[\s\S]*select\.addEventListener\('change', \(\) => updateFromControl\(block, \{ level: Number\(select\.value\) \|\| 2 \}, true\)\);/,
  'heading level select control should preserve its data update behavior'
);

assert.match(
  editorBlocksHeadSessionSource,
  /if \(block\.type === 'heading'\) appendIf\(head, createHeadingLevelSelect\(block\)\);/,
  'heading level control should be mounted in the floating block toolbar through the head session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-heading-controls/,
  'heading level control should not remain as a body control above the heading'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-list-inspector/,
  'list type control should not remain as a body inspector above the list'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list-remove/,
  'visual list CSS should not style removed per-item delete buttons'
);

assert.doesNotMatch(
  editorSource,
  /id="composerOrderInlineMeta"|data-i18n="editor\.composer\.changeSummary"/,
  'composer should not render the inline change summary block above the editor'
);

assert.doesNotMatch(
  editorSource,
  /id="wrapToggle"|data-wrap="(?:on|off)"/,
  'markdown editor should not expose a manual line-wrap toggle'
);

assert.match(
  editorSource,
  /class="editor-app-shell" id="editorAppShell"[\s\S]*class="editor-rail editor-file-tree-pane" id="editorRail"[\s\S]*id="editorFileTree" role="tree"[\s\S]*class="editor-content-pane" id="editorContentPane"[\s\S]*class="editor-content-frame"[\s\S]*class="editor-layout" id="mode-editor"/,
  'editor should render a fixed two-pane app shell with a left rail and a width-limited right content frame'
);

assert.match(
  editorSource,
  /<section class="editor-structure-panel" id="editorStructurePanel"[\s\S]*<div class="editor-panel-head editor-structure-head">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<div class="editor-panel-heading editor-structure-heading">[\s\S]*<div class="editor-panel-actions editor-structure-actions" id="editorStructureActions"><\/div>/,
  'structure panel header should expose a mobile file tree drawer toggle before the shared heading'
);

assert.match(
  editorSource,
  /<section class="editor-markdown-panel" id="editorMarkdownPanel"[\s\S]*<div class="toolbar">[\s\S]*<div class="left-actions">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<span class="current-file" id="currentFile"/,
  'markdown toolbar should keep its visual mobile file tree toggle before the current file breadcrumb'
);

assert.match(
  editorSource,
  /<section class="editor-system-panel" id="editorSystemPanel"[\s\S]*<div class="editor-panel-head editor-structure-head">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<div class="editor-panel-heading editor-structure-heading">[\s\S]*<div class="editor-panel-actions editor-structure-actions" id="editorSystemActions"><\/div>/,
  'system and publish panel header should expose the shared mobile file tree drawer toggle'
);

assert.equal(
  (editorSource.match(/data-editor-rail-toggle/g) || []).length,
  3,
  'editor should render one drawer toggle entry for structure, markdown, and system surfaces'
);

assert.doesNotMatch(
  editorSource,
  /id="editorMobileRailToggle"/,
  'mobile file tree toggles should not depend on one id inside a conditionally hidden panel'
);

assert.doesNotMatch(
  editorSource,
  /localStorage\.getItem\('press_composer_editor_state'\)/,
  'editor entry should default to the Editor file tree instead of restoring the last Site Settings mode'
);

assert.doesNotMatch(
  editorSource,
  /editor-rail-footer|editorRailSettingsToggle|editorRailSettingsMenu|id="editorLangSwitcher"/,
  'editor rail footer settings menu should be removed'
);

assert.match(
  editorStructurePanelUiSource,
  /function appendEditorLanguageControl\(body\) \{[\s\S]*id = 'editorLangSwitcher'[\s\S]*id = 'editorLangSelect'[\s\S]*press-editor-language-control-mounted/,
  'editor language controls should be rendered inside the System structure panel'
);

assert.match(
  editorStructurePanelUiSource,
  /if \(node\.source === 'system'\) \{[\s\S]*appendEditorLanguageControl\(body\);[\s\S]*node\.children\.forEach/,
  'System root panel should include editor language controls before system leaves'
);

assert.match(
  source,
  /themesLabel: treeText\('themes', 'Themes'\),[\s\S]*syncLabel: treeText\('sync', 'Publish'\),/,
  'System tree should expose the Themes and Publish leaves'
);

assert.match(
  editorContentTreeControllerSource,
  /node\.id === 'system:themes'[\s\S]*applyMode\('themes'\);[\s\S]*node\.id === 'system:sync'[\s\S]*applyMode\('sync'\);/,
  'editor content tree controller should route the Themes and Publish leaves'
);

assert.doesNotMatch(
  editorSource,
  /id="global-status"|globalStatusRepo|globalArrowLabel|localDraftSummary|editor-github\.js/,
  'legacy global sync flow widget should be removed from the editor shell'
);

assert.match(
  editorSource,
  /id="mode-sync" hidden aria-hidden="true"/,
  'editor should provide an inline Sync panel host'
);

assert.match(
  editorSource,
  /id="editorModalSyncActions" hidden[\s\S]*id="btnSyncSubmit"[\s\S]*form="syncCommitForm"/,
  'Sync commit submit button should live in the system panel header actions and submit the inline form'
);

assert.doesNotMatch(
  source,
  /global-status|globalStatusRepo|globalArrowLabel|localDraftSummary|attachGlobalStatusCommitHandler|handleGlobalBubbleActivation/,
  'composer should not keep legacy global sync widget wiring'
);

assert.match(
  source,
  /from '\.\/composer-publish-service\.js\?v=[\w.-]+'/,
  'composer should cache-bust the explicit composer publish app-service boundary'
);

assert.doesNotMatch(
  source,
  /let syncCommitPanelRenderSeq|let syncCommitPanelRefreshTimer|function appendPublishTransportStatus|function getSyncCommitPanelHost|createComposerSyncCommitController|createSyncOverlayController|createPublishTransportSettingsUi|createPublishSummaryRenderer|createComposerPublishFlow|createPublishSettingsStore/,
  'composer should not own Sync commit panel rendering or publish control-plane service assembly'
);

assert.match(
  source,
  /const composerPublishService = createComposerPublishService\(\{[\s\S]*scopeKey: scopedEditorStorageKey,[\s\S]*getActiveSiteRepoConfig: \(\) => getActiveSiteRepoConfig\(\),[\s\S]*getTrackedPublishContentRoot: \(\) => getTrackedPublishContentRoot\(\),[\s\S]*gatherCommitPayload: \(options\) => gatherCommitPayload\(options\),[\s\S]*applyLocalPostCommitState: \(files\) => applyLocalPostCommitState\(files\),[\s\S]*computeUnsyncedSummary,[\s\S]*setGitHubCommitInFlight/,
  'composer should pass app callbacks into the publish service instead of assembling the publish control plane itself'
);

assert.match(
  composerPublishServiceSource,
  /from '\.\/composer-sync-commit-controller\.js\?v=[\w.-]+'[\s\S]*from '\.\/composer-sync-overlay\.js\?v=[\w.-]+'[\s\S]*from '\.\/composer-publish-settings-ui\.js\?v=[\w.-]+'[\s\S]*from '\.\/composer-publish-summary\.js\?v=[\w.-]+'[\s\S]*from '\.\/composer-publish-flow\.js\?v=[\w.-]+'[\s\S]*from '\.\/publish\/settings-store\.js\?v=[\w.-]+'/,
  'composer publish service should cache-bust the publish control-plane modules it composes'
);

assert.match(
  composerPublishServiceSource,
  /export function createComposerPublishService\(options = \{\}\)[\s\S]*const publishSettingsStore = createPublishSettingsStoreRef\([\s\S]*const syncOverlayController = createSyncOverlayControllerRef\([\s\S]*const publishTransportUi = createPublishTransportSettingsUiRef\([\s\S]*const publishSummaryRenderer = createPublishSummaryRendererRef\([\s\S]*const publishFlow = createComposerPublishFlowRef\([\s\S]*syncCommitController = createComposerSyncCommitControllerRef\(/,
  'composer publish service should own settings, overlay, transport UI, summary, publish flow, and Sync commit controller assembly'
);

assert.match(
  composerPublishServiceSource,
  /return \{[\s\S]*setSyncOverlayStatus,[\s\S]*startRemoteSyncWatcher,[\s\S]*renderPublishTransportSettings,[\s\S]*refreshSyncCommitPanel,[\s\S]*scheduleSyncCommitPanelRefresh[\s\S]*\};/,
  'composer publish service should expose only app-level publish controls back to composer'
);

assert.match(
  composerSyncCommitControllerSource,
  /export function createComposerSyncCommitController\([\s\S]*function appendPublishTransportStatus\(host\)[\s\S]*function getSyncCommitPanelHost\(\)[\s\S]*panel\.id = 'syncCommitPanel';[\s\S]*async function refresh\(options = \{\}\)[\s\S]*refreshSyncCommitPanelView\(options,[\s\S]*function scheduleRefresh\(\)[\s\S]*scheduleSyncCommitPanelRefreshView/,
  'Sync commit controller should own inline host creation, transport status, render sequencing, and refresh scheduling'
);

assert.match(
  composerSyncPanelSource,
  /export async function refreshSyncCommitPanelView\(options = \{\}, deps = \{\}\) \{[\s\S]*const headerSubmit = documentRef\.getElementById\('btnSyncSubmit'\)[\s\S]*gatherCommitPayload\(\{ cleanupUnusedAssets: false, showSeoStatus: false \}\)[\s\S]*form\.id = 'syncCommitForm';[\s\S]*const btnSubmit = headerSubmit;[\s\S]*appendPublishTransportStatus\(form\);[\s\S]*appendGithubCommitSummary\(summaryBlock, commitFiles, seoFiles, summaryEntries\)[\s\S]*const transport = resolvePublishTransport\(\);[\s\S]*ensureConnectPublishGrant\(transport\.connect, getActiveSiteRepoConfig\(\)\)[\s\S]*performConnectGithubCommit\(transport\.connect, currentSummary\)[\s\S]*performDirectGithubCommit\(transport\.token, currentSummary\);/,
  'inline Sync page commit form should reuse existing payload and route through the selected publish transport'
);

assert.match(
  connectTransportSource,
  /function requestConnectPublishGrant\([\s\S]*windowRef\.open\('', popupName, 'popup,width=520,height=720'\)[\s\S]*link\.referrerPolicy = 'unsafe-url'[\s\S]*link\.click\(\);/,
  'Connect publish authorization should send a full browser Referrer so Connect can bind project Pages paths'
);

assert.match(
  connectTransportSource,
  /async function createConnectPublishCommit\([\s\S]*fetchImpl\(endpoint\.href, \{[\s\S]*referrerPolicy: 'unsafe-url'[\s\S]*Authorization/,
  'Connect publish POST should send a full browser Referrer so grants stay bound to the editor path'
);

assert.match(
  patTransportSource,
  /const additions = [\s\S]*\.filter\(\(file\) => !file\.deleted\)[\s\S]*const deletions = [\s\S]*\.filter\(\(file\) => file && file\.deleted\)[\s\S]*if \(deletions\.length\) fileChanges\.deletions = deletions;[\s\S]*fileChanges/,
  'GitHub commit payload should include deletions as well as additions'
);

assert.doesNotMatch(
  source,
  /async function githubGraphqlRequest|async function createFineGrainedTokenCommit|async function createConnectPublishCommit|function requestConnectPublishGrant/,
  'composer should not directly own Connect or GitHub commit transport implementations'
);

assert.doesNotMatch(
  publishCommitServiceSource,
  /import \{ createFineGrainedTokenCommit \} from '\.\/transports\/github-pat-transport\.js\?v=[\w.-]+'/,
  'publish commit service should not eagerly import the PAT transport on composer startup'
);

assert.match(
  publishCommitServiceSource,
  /await import\('\.\/transports\/github-pat-transport\.js\?v=[\w.-]+'\)[\s\S]*createFineGrainedTokenCommit\(transport && transport\.token/,
  'publish commit service should lazy-load the PAT transport only for PAT publishing'
);

assert.match(
  propagationWatcherSource,
  /export async function waitForRemotePropagation[\s\S]*setCancelHandler\(cancelHandler, true\)[\s\S]*setStatus\('All files confirmed on site\.'\)/,
  'remote propagation checks should live outside composer behind the publish watcher boundary'
);

assert.match(
  source,
  /from '\.\/composer-notifications\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted notification and popup boundary'
);

assert.doesNotMatch(
  source,
  /function ensureToastRoot|function prepareToastStackAnimation|function showToast|function preparePopupWindow|function closePopupWindow|function finalizePopupWindow|function handlePopupBlocked/,
  'toast rendering and popup-window fallback details should stay outside the main composer shell'
);

assert.match(
  composerNotificationsSource,
  /export function createComposerNotificationController\(options = \{\}\)[\s\S]*function ensureToastRoot\(\)[\s\S]*function showToast\(kind, text, toastOptions = \{\}\)[\s\S]*function preparePopupWindow\(\)[\s\S]*function finalizePopupWindow\(win, href\)[\s\S]*function handlePopupBlocked\(href, popupOptions = \{\}\)/,
  'notification boundary should own toast DOM rendering and popup-window fallback behavior'
);

assert.match(
  source,
  /from '\.\/composer-dialogs\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted dialog boundary'
);

assert.doesNotMatch(
  source,
  /discardConfirmElements|addEntryPromptElements|markdownProtectionPasswordDialogElements|function ensureComposerAddEntryPromptElements|function ensureComposerDiscardConfirmElements|function requestMarkdownProtectionPassword|function showComposerAddEntryPrompt|function showComposerDiscardConfirm/,
  'dialog DOM state and overlay implementations should stay outside the main composer shell'
);

assert.match(
  composerDialogsSource,
  /export function createComposerDialogController\(options = \{\}\)[\s\S]*function ensureAddEntryPromptElements\(\)[\s\S]*function showAddEntryPrompt\(anchor, options = \{\}\)[\s\S]*function requestMarkdownProtectionPassword\(options = \{\}\)[\s\S]*function ensureDiscardConfirmElements\(\)[\s\S]*function showDiscardConfirm\(anchor, messageText, options = \{\}\)/,
  'dialog boundary should own add-entry prompts, discard confirmations, and protection password overlays'
);

assert.match(
  source,
  /from '\.\/composer-remote-sync\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted remote sync boundary'
);

assert.doesNotMatch(
  source,
  /async function fetchMarkdownRemoteSnapshot|function applyMarkdownRemoteSnapshot|function startMarkdownSyncWatcher|async function fetchComposerRemoteSnapshot|function applyComposerRemoteSnapshot|function startComposerSyncWatcher/,
  'Markdown and YAML remote snapshot polling should stay outside the main composer shell'
);

assert.match(
  composerRemoteSyncSource,
  /export function createComposerRemoteSyncController\(options = \{\}\)[\s\S]*async function fetchMarkdownRemoteSnapshot\(tab\)[\s\S]*function applyMarkdownRemoteSnapshot\(tab, snapshot, applyOptions = \{\}\)[\s\S]*function startMarkdownSyncWatcher\(tab, watcherOptions = \{\}\)[\s\S]*async function fetchComposerRemoteSnapshot\(kind\)[\s\S]*function applyComposerRemoteSnapshot\(kind, snapshot\)[\s\S]*function startComposerSyncWatcher\(kind, watcherOptions = \{\}\)/,
  'remote sync controller should own Markdown and YAML remote snapshot fetch, apply, and watcher orchestration'
);

assert.match(
  source,
  /from '\.\/composer-yaml-drafts\.js\?v=[\w.-]+'/,
  'composer should cache-bust the extracted YAML draft boundary'
);

assert.doesNotMatch(
  source,
  /let composerDraftMeta|let composerAutoSaveTimers|const composerDraftMeta|const composerAutoSaveTimers/,
  'index/tabs/site draft metadata and timers should stay outside the main composer shell'
);

assert.match(
  composerYamlDraftsSource,
  /export function createComposerYamlDraftController\(options = \{\}\)[\s\S]*const draftMeta = \{ index: null, tabs: null, site: null \};[\s\S]*const autoSaveTimers = \{ index: null, tabs: null, site: null \};[\s\S]*function saveDraftToStorage\(kind, opts = \{\}\)[\s\S]*function scheduleAutoDraft\(kind\)[\s\S]*function loadDraftSnapshotsIntoState\(state\)/,
  'YAML draft controller should own index/tabs/site draft metadata, autosave timers, persistence, and restore'
);

assert.match(
  propagationWatcherSource,
  /files\.forEach\(\(file\) => \{[\s\S]*unique\.push\(\{ \.\.\.file, path: normalized \}\);[\s\S]*if \(file\.deleted\) \{[\s\S]*resp\.status !== 404 && resp\.status !== 410[\s\S]*ok = checked && !stillExists && !indeterminate;/,
  'remote propagation checks should verify deleted commit entries disappear'
);

assert.match(
  composerContentStagingSource,
  /from '\.\/repository-deletions\.js\?v=[\w.-]+';[\s\S]*planManagedContentDeletions\(\{[\s\S]*indexBaseline: remoteBaseline\.index[\s\S]*tabsBaseline: remoteBaseline\.tabs[\s\S]*contentDeletionPlan\.files\.forEach\(addFile\);/,
  'composer should stage repository markdown deletions from article/page tombstones'
);

assert.match(
  composerContentStagingSource,
  /function collectDirtyMarkdownPathsForDeletion\(\) \{[\s\S]*const hasContent = entry\.content != null && normalizeMarkdownContent\(entry\.content\);[\s\S]*const hasAssets = Array\.isArray\(entry\.assets\) && entry\.assets\.length;[\s\S]*const hasDeletedAssets = draftHasAssetDeletions\(entry\);[\s\S]*if \(hasContent \|\| hasAssets \|\| hasDeletedAssets\) paths\.add\(key\);/,
  'repository deletion blockers should treat stored deletion-only asset drafts as pending local draft state'
);

assert.match(
  composerMarkdownAssetsSource,
  /const markdownDeletedAssetStore = new Map\(\);[\s\S]*function normalizeAssetDeletionDescriptor\(asset, markdownPath\) \{[\s\S]*resolveLocalMarkdownAssetReference\(markdown, relativePath, getContentRootSafe\(\)\)[\s\S]*if \(assetPath && assetPath !== resolved\.contentPath\) return null;[\s\S]*function stageMarkdownAssetDeletion\(path, resolved\) \{[\s\S]*bucket\.set\(assetPath, entry\);[\s\S]*updateMarkdownDraftStoreAssetDeletions\(norm, exportMarkdownAssetDeletionBucket\(norm\)\);[\s\S]*function handleEditorAssetDeleteRequested\(event\) \{[\s\S]*resolveLocalMarkdownAssetReference\(markdownPath, source, getContentRootSafe\(\)\)[\s\S]*stageMarkdownAssetDeletion\(markdownPath, resolved\)[\s\S]*windowRef\.addEventListener\(type, handler\)/,
  'Markdown asset manager should stage and persist explicit local markdown asset deletions from visual image blocks'
);

assert.match(
  [composerMarkdownStateSource, composerMarkdownDraftsSource, composerMarkdownLoaderSource].join('\n'),
  /function hasMarkdownDraftContent\(tab\) \{[\s\S]*const deletedAssets = Array\.isArray\(draft\.deletedAssets\) && draft\.deletedAssets\.length;[\s\S]*return !!\(plain \|\| encrypted \|\| deletedAssets\);[\s\S]*async function saveDraftForTab\(tab, saveOptions = \{\}\) \{[\s\S]*const deletedAssets = exportMarkdownAssetDeletionBucket\(tab\.path\);[\s\S]*if \(!text && !deletedAssets\.length\) \{[\s\S]*const assetDeletionDirty = countMarkdownAssetDeletions\(tab\.path\) > 0;[\s\S]*const dirty = normalizedContent !== baseline \|\| protectionChanged \|\| assetDeletionDirty;[\s\S]*tab\.localDraft && draftHasAssetDeletions\(tab\.localDraft\)[\s\S]*tab\.content = normalizeMarkdownContent\(tab\.localDraft\.content \|\| ''\);/,
  'markdown draft persistence should preserve deletion-only asset drafts across empty-body autosaves, reloads, and remote loads'
);

assert.match(
  composerMarkdownAssetsSource,
  /function draftHasAssetDeletions\(draft\) \{[\s\S]*Array\.isArray\(draft\.deletedAssets\) && draft\.deletedAssets\.length/,
  'Markdown asset manager should expose deletion-only draft detection for composer draft persistence'
);

assert.match(
  composerMarkdownAssetsSource,
  /dynamicEditorTabs\.forEach\(\(tab\) => \{[\s\S]*const content = knownMarkdownTextForAssetScan\(tab, activeTab, activeValue\);[\s\S]*const deletionOnlyDraft = !content && tab && tab\.localDraft && draftHasAssetDeletions\(tab\.localDraft\);[\s\S]*if \(!content && !deletionOnlyDraft\) return;[\s\S]*seen\.add\(path\);/,
  'asset reference scan should only mark dynamic markdown paths checked after content or a deletion-only draft is known'
);

assert.match(
  [composerMarkdownAssetsSource, composerContentStagingSource].join('\n'),
  /async function fetchMarkdownForAssetScan\(contentPath, contentRoot = 'wwwroot'\) \{[\s\S]*if \(!resp\.ok\) return \{ text: '', failed: true \};[\s\S]*return \{ text: normalizeMarkdownContent\(await resp\.text\(\)\), failed: false \};[\s\S]*async function collectCurrentRepositoryMarkdownAssetReferences\(options = \{\}\) \{[\s\S]*const failures = \[\];[\s\S]*currentManagedMarkdownPathsForAssetScan\(currentRoot\)[\s\S]*fetchMarkdownForAssetScan\(norm, currentRoot\)[\s\S]*if \(result\.failed\) \{[\s\S]*failures\.push\(norm\);[\s\S]*return \{ refs, failures \};[\s\S]*const assetReferenceScan = await collectCurrentRepositoryMarkdownAssetReferences\(\{[\s\S]*const assetReferenceScanComplete = !\(assetReferenceScan\.failures && assetReferenceScan\.failures\.length\);[\s\S]*if \(assetReferenceScanComplete\) \{[\s\S]*listMarkdownAssetDeletions\(\)\.forEach\(\(asset\) => \{/,
  'commit payload should fail closed and include asset deletions only after scanning current published markdown references'
);

assert.match(
  composerContentStagingSource,
  /async function collectDeletedMarkdownAssetFiles\(markdownDeletionFiles = \[\], options = \{\}\) \{[\s\S]*fetchMarkdownForRepositoryDeletion\(file\)[\s\S]*listLocalMarkdownAssetReferences\(markdown, file\.markdownPath, contentRoot\)[\s\S]*if \(referencedAssets\.has\(resolved\.contentPath\)\) return;[\s\S]*deleted: true[\s\S]*collectDeletedMarkdownAssetFiles\(contentDeletionPlan\.files/,
  'deleting an article or page should also stage same-directory local asset deletions unless known markdown still references them'
);

assert.doesNotMatch(
  composerSyncPanelSource,
  /editor\.composer\.github\.modal\.tokenLabel|sync-token-help|className = 'sync-token-field'/,
  'Sync page should no longer render the fine-grained token settings inline'
);

assert.match(
  editorSource,
  /id="editorFileTree" role="tree"/,
  'editor should render the content file tree as the primary article/page manager'
);

assert.doesNotMatch(
  editorSource,
  /class="editor-tree-head"|id="btnEditorAddArticle"|id="btnEditorAddPage"|data-i18n="editor\.tree\.title"|data-i18n="editor\.tree\.subtitle"/,
  'file tree rail should not render the Content heading, subtitle, or add-entry buttons'
);

assert.doesNotMatch(
  source,
  /btnEditorAddArticle|btnEditorAddPage/,
  'add article/page entry handlers should live in the root structure panels, not the tree rail'
);

assert.match(
  editorStructurePanelUiSource,
  /if \(node\.kind === 'root'\) \{[\s\S]*const add = makeStructureButton\(isPages \? treeText\('addPage', 'Page'\) : treeText\('addArticle', 'Article'\)\);[\s\S]*actions\.appendChild\(add\);/,
  'root structure panels should retain add article/page entry actions'
);

assert.match(
  [
    enI18nSource,
    chsI18nSource,
    chtTwI18nSource,
    jaI18nSource
  ].join('\n'),
  /addArticle: '\+ New article'[\s\S]*addArticle: '\+ 新建文章'[\s\S]*addArticle: '\+ 新增文章'[\s\S]*addArticle: '\+ 新規記事'/,
  'root article actions should be explicit add actions in every UI language'
);

assert.match(
  chtHkI18nSource,
  /import chtTwTranslations from '\.\/cht-tw\.js\?v=[\w.-]+';/,
  'Hong Kong Traditional Chinese should inherit the cache-busted Traditional Chinese asset deletion strings'
);

assert.match(
  languagesManifestSource,
  /"\.\/en\.js\?v=[\w.-]+"[\s\S]*"\.\/chs\.js\?v=[\w.-]+"[\s\S]*"\.\/cht-tw\.js\?v=[\w.-]+"[\s\S]*"\.\/cht-hk\.js\?v=[\w.-]+"[\s\S]*"\.\/ja\.js\?v=[\w.-]+"/,
  'language manifest should cache-bust language bundles changed by editor asset deletion labels'
);

assert.match(
  i18nSource,
  /from '\.\.\/i18n\/en\.js\?v=[\w.-]+'/,
  'default English bundle import should be cache-busted when editor asset deletion labels change'
);

[
  source,
  editorMainSource,
  readFileSync(resolve(here, '../assets/js/editor-boot.js'), 'utf8'),
  readFileSync(resolve(here, '../assets/js/system-updates.js'), 'utf8'),
  readFileSync(resolve(here, '../assets/js/theme.js'), 'utf8'),
  readFileSync(resolve(here, '../assets/js/seo.js'), 'utf8')
].forEach((moduleSource) => {
  assert.doesNotMatch(
    moduleSource,
    /from ['"]\.\/i18n\.js['"]/,
    'runtime modules should import the cache-busted i18n module URL'
  );
});

assert.match(
  editorSource,
  /html, body \{ width: 100%; height: 100%; overflow: hidden; \}[\s\S]*\.editor-page \{ position: fixed; inset: 0;[^}]*overflow: hidden;/,
  'editor page should be fixed to the visible viewport with independent rail and content scrolling'
);

assert.match(
  editorSource,
  /@media \(max-width: 640px\) \{[\s\S]*\.editor-page \{ padding:0; \}/,
  'extra narrow editor page should stay flush to the viewport edge'
);

assert.match(
  editorSource,
  /\.editor-rail-tree-scroll \{[^}]*overflow:auto;[\s\S]*\.editor-content-pane \{[^}]*overflow-x:hidden;[\s\S]*overflow-y:auto;/,
  'editor rail tree and right content pane should scroll independently without page-level horizontal scrolling'
);

assert.match(
  editorSource,
  /\.editor-rail-resizer \{[^}]*cursor:col-resize;[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-rail \{[\s\S]*position:fixed;[\s\S]*transform:translateX\(-102%\);[\s\S]*\.editor-rail-resizer \{\s*display:none;/,
  'editor rail should support desktop resizing and switch to a mobile drawer without the resizer'
);

assert.match(
  editorSource,
  /\.editor-rail \{[\s\S]*border-right:0;[\s\S]*\.editor-rail-resizer::before \{[\s\S]*left:50%;[\s\S]*width:1px;[\s\S]*opacity:\.65;[\s\S]*\.editor-file-tree-pane \{[\s\S]*border-right:0;/,
  'file tree rail should not show a container border, while the resize handle keeps its own one-pixel line'
);

assert.match(
  editorSource,
  /class="editor-modal-layer" id="editorModalLayer" hidden aria-hidden="true"[\s\S]*class="editor-modal-dialog"[\s\S]*id="mode-composer" hidden aria-hidden="true"[\s\S]*id="mode-themes" hidden aria-hidden="true"[\s\S]*id="mode-updates" hidden aria-hidden="true"/,
  'Site Settings, Themes, and System Updates should be mounted inside the hidden editor modal layer'
);

assert.match(
  editorSource,
  /\.editor-workspace \{[\s\S]*grid-template-columns:minmax\(0, 1fr\);[\s\S]*\.editor-workspace-meta \{[\s\S]*grid-column:1;[\s\S]*\.frontmatter-panel \{[\s\S]*position: static;/,
  'front matter panel should always flow below the markdown editor instead of using a side rail'
);

assert.match(
  editorSource,
  /\.editor-markdown-panel > \.toolbar \{[\s\S]*margin-left:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*margin-right:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*padding-left:var\(--editor-content-pane-padding, 1rem\);[\s\S]*padding-right:var\(--editor-content-pane-padding, 1rem\);/,
  'markdown editor topbar should span the content pane while preserving its visual inset with internal padding'
);

assert.match(
  editorSource,
  /\.frontmatter-panel \{[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*\.frontmatter-grid \{[\s\S]*--frontmatter-row-gap: 0\.35rem;[\s\S]*display: flex;[\s\S]*gap: var\(--frontmatter-row-gap\);[\s\S]*\.frontmatter-field \{[\s\S]*padding: 0;[\s\S]*display: grid;[\s\S]*grid-template-columns: var\(--frontmatter-single-label-width, 88px\) minmax\(0, var\(--frontmatter-single-control-width\)\);/,
  'front matter fields should use compact Site Settings-style rows with measured label width'
);

assert.doesNotMatch(
  editorSource,
  /\.frontmatter-field \{[\s\S]*grid-template-columns: minmax\(88px, 88px\) minmax\(0, var\(--frontmatter-single-control-width\)\);/,
  'front matter label column should not stay fixed to the old 88px width'
);

assert.match(
  editorSource,
  /\.frontmatter-section \{[\s\S]*border: 1px solid color-mix\(in srgb, var\(--border\) 96%, transparent\);[\s\S]*background: var\(--card\);[\s\S]*gap: 0\.6rem;[\s\S]*\.frontmatter-section-head \{[\s\S]*align-items: baseline;[\s\S]*\.frontmatter-section-title \{[\s\S]*font-size: 1rem;[\s\S]*\.frontmatter-section-description \{[\s\S]*font-size: 0\.82rem;[\s\S]*text-align: right;/,
  'front matter sections should mirror the Site Settings single-column section card header style'
);

assert.match(
  editorSource,
  /\.editor-workspace-meta::before \{[\s\S]*width:min\(18rem, 62%\);[\s\S]*repeating-linear-gradient\([\s\S]*color-mix\(in srgb, var\(--muted\) 64%, transparent\) 0 \.72rem,[\s\S]*transparent \.72rem 1\.08rem[\s\S]*@container \(min-width: 66\.5rem\) \{[\s\S]*\.editor-workspace-meta::before \{[\s\S]*display:none;/,
  'single-column article editor layout should show a thin decorative dashed divider above the metadata panel and hide it in the two-column rail'
);

assert.match(
  editorSource,
  /\.frontmatter-section\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/,
  'front matter sections should honor hidden state so page files can suppress article-only metadata groups'
);

assert.match(
  editorSource,
  /frontMatterCommonSection[\s\S]*frontmatter-section-head[\s\S]*data-i18n="editor\.frontMatter\.commonDescription"[\s\S]*frontMatterExtraSection[\s\S]*frontmatter-section-head[\s\S]*data-i18n="editor\.frontMatter\.advancedDescription"/,
  'front matter common and advanced sections should include localized section descriptions'
);

assert.match(
  editorMainMetadataPanelSource,
  /head\.className = 'frontmatter-field-head';[\s\S]*labelWrap\.className = 'frontmatter-field-label-wrap';[\s\S]*labelSpan\.className = 'frontmatter-field-title';[\s\S]*controls\.className = 'frontmatter-field-controls';[\s\S]*controls\.appendChild\([\s\S]*entry\.container\.appendChild\(controls\);/,
  'front matter field DOM should include field head, label wrap, and controls wrapper'
);

assert.match(
  editorMainMetadataPanelSource,
  /const clear = \(\) => \{[\s\S]*state = \{[\s\S]*data:\s*\{\}[\s\S]*hasFrontMatter:\s*false[\s\S]*rebuildBindings\(\);[\s\S]*\};[\s\S]*return \{[\s\S]*clear,/,
  'front matter manager should expose a clear helper to reset stale article metadata state'
);

assert.match(
  editorMainMetadataPanelSource,
  /const setFrontMatterVisible = \(visible\) => \{[\s\S]*const nextVisible = !!visible;[\s\S]*const shouldClear = !nextVisible && frontMatterVisible;[\s\S]*frontMatterVisible = nextVisible;[\s\S]*if \(shouldClear && frontMatterManager && typeof frontMatterManager\.clear === 'function'\) frontMatterManager\.clear\(\);[\s\S]*updateMetadataPanelVisibility\(\);[\s\S]*\};/,
  'switching into page metadata mode should clear stale article front matter state only on visibility transitions'
);

assert.match(
  editorMainMetadataPanelSource,
  /function syncFrontMatterLabelWidth\(root\) \{[\s\S]*querySelectorAll\('\.frontmatter-field-title'\)[\s\S]*requestFrame\(measure\)[\s\S]*ResizeObserverRef/,
  'front matter labels should be measured after render and shared through a CSS variable'
);

assert.match(
  editorMainMetadataPanelSource,
  /function syncFrontMatterLabelWidth\(root\) \{[\s\S]*root\.style\.setProperty\('--frontmatter-single-label-width'/,
  'front matter label measurement should write the shared label width CSS variable'
);

assert.match(
  editorMainMetadataPanelSource,
  /const measureLabelText = \(label\) => \{[\s\S]*label\.scrollWidth[\s\S]*probe\.textContent = label\.textContent \|\| '';[\s\S]*probe\.style\.whiteSpace = 'nowrap';/,
  'front matter label measurement should probe intrinsic text width when current layout is constrained'
);

assert.match(
  editorMainMetadataPanelSource,
  /querySelector\('\.frontmatter-help-tooltip'\)[\s\S]*measureLabelText\(label\)[\s\S]*getComputedStyleRef\(target \|\| label\)[\s\S]*gap/,
  'front matter label measurement should use intrinsic label width plus the visible help button and gap'
);

assert.match(
  editorMainLanguageSessionSource,
  /metadataPanel\.syncLanguage\(\);[\s\S]*runtime\.onDocument\('press-editor-language-applied', syncLanguage\)/,
  'front matter labels should resync after editor language changes update localized labels'
);

assert.match(
  editorMainMetadataPanelSource,
  /const updateMetadataPanelVisibility = \(\) => \{[\s\S]*tabsMetadataManager\.setVisible\(tabsMetadataVisible\);[\s\S]*syncFrontMatterLabelWidth\(panel\);/,
  'front matter labels should resync after article/page metadata visibility changes'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /function getTabsMetadataForTab\(tab\) \{[\s\S]*tab\.tabsKey[\s\S]*tab\.tabsLang[\s\S]*getTabsEntry\(tab\.tabsKey\)[\s\S]*entry && entry\[tab\.tabsLang\][\s\S]*title/,
  'tabs metadata reads should prefer the dynamic tab stable identity over path-only lookup'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /function updateTabsEntryTitleForTab\(tab, metadata\) \{[\s\S]*tab\.tabsKey[\s\S]*tab\.tabsLang[\s\S]*getTabsEntry\(tab\.tabsKey\)[\s\S]*entry\[tab\.tabsLang\]\.title = nextTitle;/,
  'tabs metadata writes should target the dynamic tab stable identity instead of the first matching path'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /detachPrimaryEditorTabsMetadataListener = api\.onTabsMetadataChange\(\(metadata\) => \{[\s\S]*if \(tab && tab\.source === 'tabs'\)[\s\S]*updateTabsEntryTitleForTab\(tab, metadata\);/,
  'tabs metadata bridge should write through the active dynamic tab identity'
);

assert.match(
  composerMarkdownSessionSource,
  /const data = \{[\s\S]*path: normalized,[\s\S]*tabsKey:[\s\S]*tabsLang:[\s\S]*editorTreeNodeId:[\s\S]*lookupKey:/,
  'dynamic markdown tabs should persist a stable identity for shared-path tabs content'
);

assert.doesNotMatch(
  editorSource,
  /\.frontmatter-field \+ \.frontmatter-field|frontmatter-pill|frontmatter-field-hint/,
  'front matter should not render per-row separators, key chips, or persistent hint rows'
);

assert.doesNotMatch(
  `${editorSource}\n${editorMainSource}\n${editorMainMetadataPanelSource}`,
  /frontMatterToggle|frontMatterSummary|frontMatterHelp|frontmatter-toggle|class="frontmatter-help"|\.frontmatter-help\s*\{|data-collapsed/,
  'front matter editor should not render the old collapsible heading or helper copy'
);

assert.match(
  editorSource,
  /\.frontmatter-switch \{[\s\S]*border-radius: 999px;[\s\S]*\.frontmatter-switch-input \{[\s\S]*clip-path: inset\(50%\);[\s\S]*\.frontmatter-switch-track \{[\s\S]*width: 2\.4rem;[\s\S]*\.frontmatter-switch\[data-state="on"\] \.frontmatter-switch-thumb \{[\s\S]*transform: translateX\(1\.05rem\);/,
  'front matter boolean fields should render as two-state switch controls'
);

assert.match(
  editorMainMetadataPanelSource,
  /const syncBooleanControl = \(entry, value\) => \{[\s\S]*entry\.input\.setAttribute\('aria-checked', checked \? 'true' : 'false'\);[\s\S]*wrap\.className = 'frontmatter-switch';[\s\S]*checkbox\.setAttribute\('role', 'switch'\);[\s\S]*entry\.switchEl = wrap;/,
  'front matter boolean fields should sync switch state through the existing input binding'
);

assert.doesNotMatch(
  `${editorSource}\n${editorMainSource}\n${editorMainMetadataPanelSource}`,
  /frontmatter-clear|frontmatter-actions|clearEntryValue|editor\.frontMatter\.booleanLabel/,
  'front matter boolean fields should not keep the old checkbox label or clear action'
);

assert.match(
  editorSource,
  /\.frontmatter-panel\[data-frontmatter-visible="false"\]\[data-tabs-visible="false"\] \{ display: none !important; \}/,
  'front matter panel should only fully hide when neither article nor tabs metadata is active'
);

assert.match(
  editorMainMetadataPanelSource,
  /let frontMatterVisible = true;[\s\S]*let tabsMetadataVisible = false;[\s\S]*const inferCurrentFileSource = \(path\) => \{[\s\S]*normalized\.startsWith\('tab\/'\) \? 'tabs' : '';[\s\S]*const setFrontMatterVisible = \(visible\) => \{[\s\S]*const nextVisible = !!visible;[\s\S]*const shouldClear = !nextVisible && frontMatterVisible;[\s\S]*frontMatterVisible = nextVisible;[\s\S]*frontMatterManager\.clear\(\);[\s\S]*const setTabsMetadataVisible = \(visible\) => \{[\s\S]*tabsMetadataVisible = !!visible;[\s\S]*applyCurrentFileSource: \(source\) => \{[\s\S]*setFrontMatterVisible\(actual !== 'tabs'\);[\s\S]*setTabsMetadataVisible\(actual === 'tabs'\);/,
  'metadata panel session should swap between article front matter and tabs metadata visibility by file source'
);

assert.match(
  editorMainFileContextServiceSource,
  /const setCurrentFileLabel = \(input\) => \{[\s\S]*currentFileSession\.set\(input\)[\s\S]*metadataPanel\.applyCurrentFileSource\(info && info\.source\);/,
  'editor file context service should delegate file-source metadata mode changes to the metadata panel session'
);

assert.match(
  editorMainMetadataPanelSource,
  /buildEditorValue: \(body\) => \([\s\S]*frontMatterVisible && frontMatterManager \? frontMatterManager\.buildMarkdown\(body\) : body[\s\S]*setEditorValue: \(value, opts = \{\}\) => \([\s\S]*frontMatterVisible && frontMatterManager[\s\S]*frontMatterManager\.setFromMarkdown\(value, opts\)[\s\S]*String\(value == null \? '' : value\)/,
  'metadata panel session should bypass front matter parsing and rebuilding while the panel is hidden'
);

assert.match(
  editorMainDocumentSessionSource,
  /const getValue = \(\) => \{[\s\S]*metadataPanel\.buildEditorValue\(body\);[\s\S]*const setValue = \(value, opts = \{\}\) => \{[\s\S]*metadataPanel\.setEditorValue\(text, \{ silent: true \}\)/,
  'editor document session should route markdown value front matter handling through the metadata panel session'
);

assert.match(
  editorMainMetadataPanelSource,
  /const createTabsMetadataManager = \(\) => \{[\s\S]*section\.className = 'frontmatter-section';[\s\S]*grid\.className = 'frontmatter-grid';[\s\S]*field\.className = 'frontmatter-field frontmatter-field-text';[\s\S]*field\.dataset\.fieldId = 'tabs-title';[\s\S]*setChangeHandler: \(fn\) => \{[\s\S]*setValue: \(value, opts = \{\}\) => \{[\s\S]*emitChange\(\);/,
  'metadata panel session should define a tabs metadata manager that reuses the frontmatter panel shell and field styling'
);

assert.match(
  editorMainDocumentSessionSource,
  /const createPrimaryEditorApi = \(\) => \(\{[\s\S]*setTabsMetadata: \(value, opts = \{\}\) => \([\s\S]*metadataPanel\.setTabsMetadata\(value, opts\)[\s\S]*onTabsMetadataChange: \(fn\) => \([\s\S]*metadataPanel\.onTabsMetadataChange\(fn\)/,
  'primary editor API should expose tabs metadata setters and change subscriptions through the metadata panel session'
);

assert.match(
  editorContentTreeControllerSource,
  /function inferMarkdownSourceFromPath\(path\) \{[\s\S]*node && node\.source[\s\S]*inferMarkdownSourceFallback\(normalized\);/,
  'editor content tree controller should infer whether an opened markdown file comes from tabs.yaml or index.yaml'
);

assert.match(
  composerMarkdownSessionSource,
  /function deriveDynamicTabIdentity\(path, identityOptions = \{\}\) \{[\s\S]*const explicitLookupKey = String\(opts\.lookupKey \|\| ''\)\.trim\(\);[\s\S]*const source = String\([\s\S]*opts\.source[\s\S]*inferMarkdownSourceFromPath\(normalizedPath\)[\s\S]*const lookupKey = explicitLookupKey \|\| \(\(source === 'tabs' && key && lang\)/,
  'composer should preserve explicit file-source identity and persisted lookup keys for dynamic markdown tabs'
);

assert.match(
  composerIndexTabsUiSource,
  /query\('\.ct-edit', block\)\.addEventListener\('click', \(\) => \{[\s\S]*const rel = normalizeRelPath\(value\.location\);[\s\S]*openMarkdownInEditor\(rel, \{[\s\S]*source: 'tabs',[\s\S]*key: tab,[\s\S]*lang,[\s\S]*editorTreeNodeId: `tabs:\$\{tab\}:\$\{lang\}`[\s\S]*\}\);/,
  'page list edit actions should pass tabs identity when opening the markdown editor'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /if \(!api \|\| typeof api\.onTabsMetadataChange !== 'function'\) return;[\s\S]*detachPrimaryEditorTabsMetadataListener = api\.onTabsMetadataChange\(\(metadata\) => \{[\s\S]*if \(tab && tab\.source === 'tabs'\)[\s\S]*updateTabsEntryTitleForTab\(tab, metadata\);/,
  'Markdown workspace controller should subscribe to tabs metadata changes and write title edits back into tabs state'
);

assert.match(
  editorSource,
  /\.editor-content-shell\.box \{[\s\S]*padding:0;[\s\S]*border:0 !important;[\s\S]*background:transparent;[\s\S]*\.editor-structure-panel \{ min-width:0; border:0; border-radius:0; background:transparent; padding:0; \}/,
  'editor structure view should not render extra outer card containers around the content'
);

assert.match(
  editorSource,
  /\.editor-structure-panel\.is-content-entering \.editor-panel-head,[\s\S]*\.editor-structure-panel\.is-content-entering \.editor-structure-body \{ animation:editor-structure-content-enter \.2s ease-out both; \}[\s\S]*@keyframes editor-structure-content-enter/,
  'editor structure panel content should animate in when the selected tree node changes'
);

assert.match(
  editorSource,
  /\.editor-structure-head \{ display:flex; justify-content:space-between; align-items:center;[\s\S]*\.editor-structure-title-row \{ display:flex; align-items:baseline;[\s\S]*\.editor-structure-kicker \{ display:none !important; \}/,
  'editor structure header should hide the kicker and place the item count beside the title'
);

assert.match(
  editorSource,
  /class="editor-panel-heading editor-structure-heading"[\s\S]*class="editor-structure-title-row"[\s\S]*id="editorStructureTitle"[\s\S]*id="editorStructureMeta"/,
  'editor structure header markup should group the title and metadata in one row'
);

assert.match(
  editorSource,
  /\.editor-markdown-panel\.is-content-entering > \.toolbar,[\s\S]*\.editor-markdown-panel\.is-content-entering \.editor-workspace \{ animation:editor-structure-content-enter \.2s ease-out both; \}/,
  'markdown editor panel should animate in when a file is opened from the tree'
);

assert.match(
  composerEditorDetailPanelControllerSource,
  /function animatePanelContent\(panel, timerKey\) \{[\s\S]*panel\.classList\.remove\('is-content-entering'\);[\s\S]*panel\.getBoundingClientRect\(\);[\s\S]*panel\.classList\.add\('is-content-entering'\);/,
  'editor detail panel controller should restart content transition classes'
);

assert.match(
  editorStructurePanelUiSource,
  /function renderEditorStructurePanel\(node\) \{[\s\S]*const animate = \(\) => animateEditorStructurePanelContent\(panel\);/,
  'structure panel rendering should restart the content transition after replacing panel contents'
);

assert.match(
  composerEditorDetailPanelControllerSource,
  /function animateEditorMarkdownPanelContent\(panel = getMarkdownPanel\(\)\) \{[\s\S]*animatePanelContent\(panel, '__pressMarkdownAnimationTimer'\);/,
  'editor detail panel controller should restart the markdown panel transition class'
);

assert.match(
  composerModeControllerSource,
  /pushEditorCurrentFileInfo\(tab\);\s*animateEditorMarkdownPanelContent\(\);/,
  'opening a markdown file should restart the editor panel transition after current file info is pushed'
);

assert.match(
  hiEditorSource,
  /function findVerticalScrollParent\(node\) \{[\s\S]*document\.getElementById\('editorContentPane'\)[\s\S]*function forwardVerticalWheel\(event\) \{[\s\S]*absX > absY && scroll\.scrollWidth > scroll\.clientWidth \+ 1[\s\S]*scrollParent\.scrollTop = before \+ deltaY;[\s\S]*event\.preventDefault\(\);[\s\S]*scroll\.addEventListener\('wheel', forwardVerticalWheel, \{ passive: false \}\);/,
  'hidden-overflow markdown editor should forward vertical wheel gestures to the right content pane while preserving horizontal code scrolling'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-workspace-meta \{[\s\S]*order:-1;/,
  'front matter panel should not be reordered above the markdown editor on narrow layouts'
);

assert.match(
  editorSource,
  /\.editor-tree-row \{[\s\S]*min-height:1\.75rem[\s\S]*\.editor-tree-toggle \{[\s\S]*min-height:1\.75rem[\s\S]*\.editor-tree-node \{[\s\S]*min-height:1\.75rem/,
  'file tree should use compact file-browser row heights'
);

assert.match(
  editorSource,
  /\.editor-tree-row\.is-expanding \{[^}]*animation:editor-tree-row-enter \.18s ease-out both;[\s\S]*\.editor-tree-row\.is-collapsing \{[^}]*overflow:hidden;[^}]*transition:max-height \.26s ease/,
  'file tree expand and collapse states should animate row entrance and exit'
);

assert.match(
  editorFileTreeUiSource,
  /function animateEditorTreeCollapse\(root, node, row\) \{[\s\S]*collectEditorTreeDescendantRows\(row\)[\s\S]*descendant\.style\.maxHeight = `\$\{height\}px`;[\s\S]*scheduleFrame\(collapseRows\)[\s\S]*scheduleTimeout\(finish, 340\)/,
  'file tree collapse should animate visible descendant rows before refreshing the tree'
);

assert.match(
  editorSource,
  /\.editor-tree-row\[data-kind="root"\] \.editor-tree-node \{[^}]*font-weight:700; \}[\s\S]*\.editor-tree-label \{[^}]*font-weight:400; \}[\s\S]*\.editor-tree-row\[data-kind="root"\] \.editor-tree-label \{ font-weight:700; \}/,
  'file tree root labels should be bold while leaf labels keep normal text weight'
);

assert.match(
  editorSource,
  /\.editor-tree-row\.is-leaf \.editor-tree-node \{ grid-column:1 \/ -1; \}/,
  'file tree leaf nodes should not reserve a separate empty toggle column'
);

assert.doesNotMatch(
  source + editorSource,
  /editor-tree-spacer/,
  'file tree leaf nodes should not render a fake spacer toggle'
);

assert.match(
  editorFileTreeUiSource,
  /const rowIndent = hasChildren[\s\S]*\? Math\.max\(0, depth\) \* 1\.12[\s\S]*: Math\.max\(0, depth - 1\) \* 1\.12 \+ 1\.35;/,
  'file tree leaf rows should align their content with the parent node text instead of a blank toggle'
);

assert.match(
  editorFileTreeUiSource,
  /if \(depth > 0\) \{[\s\S]*guides\.className = 'editor-tree-guides';[\s\S]*for \(let guideIndex = 0; guideIndex < depth; guideIndex \+= 1\) \{[\s\S]*guide\.className = 'editor-tree-guide';[\s\S]*guide\.style\.setProperty\('--tree-guide-index', String\(guideIndex\)\);/,
  'file tree rows should render guide lines for every ancestor depth so outer rails continue through nested rows'
);

assert.match(
  editorFileTreeUiSource,
  /let toggle = null;[\s\S]*if \(hasChildren\) \{[\s\S]*toggle = document\.createElement\('button'\);[\s\S]*if \(toggle\) row\.appendChild\(toggle\);/,
  'file tree should only render expand controls for nodes with children'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-row\.is-selected \{[^}]*background:/,
  'selected file tree rows should not use a full-row highlight background'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-node \{[^}]*border:1px/,
  'file tree nodes should not use button-like blue outlines'
);

assert.match(
  editorSource,
  /#editorFileTree button\.editor-tree-toggle, #editorFileTree button\.editor-tree-node \{ appearance:none !important; border:0 !important; border-color:transparent !important; box-shadow:none !important; outline:0 !important; background:transparent !important; background-image:none !important; color:inherit !important; font-weight:inherit !important; \}/,
  'file tree buttons should override native theme global button borders'
);

assert.match(
  editorSource,
  /#editorFileTree button\.editor-tree-node:hover, #editorFileTree button\.editor-tree-node:focus-visible \{ background:color-mix\(in srgb, var\(--text\) 5%, transparent\) !important; color:inherit !important; box-shadow:none !important; outline:0 !important; \}/,
  'file tree hover and focus states should remain borderless'
);

assert.doesNotMatch(
  editorSource,
  /editor-tree-row\[draggable="true"\]|editor-tree-row\.is-drop-target/,
  'file tree should not expose drag/drop reordering states'
);

assert.doesNotMatch(
  [source, editorFileTreeUiSource].join('\n'),
  /row\.draggable|bindEditorTreeDrag|canMoveEditorTreeNode|moveEditorTreeNode|editorTreeDragNodeId/,
  'file tree rows should not support direct drag/drop reordering'
);

assert.doesNotMatch(
  editorFileTreeUiSource,
  /const states = \[node\.draftState, node\.diffState, node\.fileState\]/,
  'file tree rows should not render the old positional draft/diff/file status dots'
);

assert.match(
  editorFileTreeUiSource,
  /function createEditorTreeStatusElement\(node\) \{[\s\S]*editor-tree-status[\s\S]*editor-tree-change-badge[\s\S]*editor-tree-count-badge[\s\S]*editor-tree-order-badge[\s\S]*editor-tree-spinner/,
  'file tree rows should render readable change, count, order, and checking status elements from one helper'
);

assert.match(
  editorFileTreeUiSource,
  /editor-tree-order-badge[\s\S]*<svg viewBox="0 0 24 24" focusable="false">[\s\S]*M3 9l4 -4l4 4m-4 -4v14[\s\S]*M21 15l-4 4l-4 -4m4 4v-14/,
  'file tree order badges should use an inline arrows-sort SVG icon instead of a text glyph'
);

assert.match(
  editorFileTreeUiSource,
  /status\.setAttribute\('aria-hidden', 'true'\);/,
  'file tree visual status badges should be hidden from assistive tech because the row aria-label carries the summary'
);

assert.match(
  editorFileTreeUiSource,
  /button\.appendChild\(createEditorTreeStatusElement\(node\)\);/,
  'file tree rows should append the unified status element instead of individual status dots'
);

assert.match(
  editorFileTreeUiSource,
  /button\.setAttribute\('aria-label', getEditorTreeAccessibleLabel\(node, labelText, accessiblePath\)\);/,
  'file tree row aria labels should include the computed status summary'
);

assert.match(
  editorContentTreeControllerSource,
  /function handleSelection\(nodeId\) \{[\s\S]*if \(node\.isDeleted\) \{[\s\S]*applyMode\('editor', \{ forceStructure: true \}\);[\s\S]*refresh\(\);[\s\S]*return;[\s\S]*if \(node\.kind === 'file' && node\.path\)/,
  'selecting deleted tombstones should route to the read-only structure panel before file nodes can open markdown'
);

assert.match(
  editorStructurePanelUiSource,
  /function renderEditorStructurePanel\(node\) \{[\s\S]*if \(node\.isDeleted\) \{[\s\S]*renderEditorDeletedPanel\(node, \{ title, kicker, meta, actions, body \}\);[\s\S]*return;[\s\S]*if \(node\.kind === 'root'\)/,
  'deleted tombstones should render a read-only deleted panel before editable entry/language panels are considered'
);

assert.match(
  composerContentMutationsSource,
  /function restoreDeletedEditorTreeNode\(node\) \{[\s\S]*node\.deletedKind[\s\S]*restoreValue[\s\S]*notifyComposerChange\(node\.source\)[\s\S]*refreshEditorContentTree\(\);/,
  'deleted tombstones should have an explicit restore action that writes restored baseline payloads'
);

assert.match(
  editorStructurePanelUiSource,
  /const visibleChildren = node\.children\.filter\(child => !child\.isDeleted\);[\s\S]*visibleChildren\.forEach/,
  'root structure reorder lists should exclude deleted tombstones from draggable current-order rows'
);

const deletedPanelBody = extractFunctionBody(editorStructurePanelUiSource, 'renderEditorDeletedPanel');
assert.doesNotMatch(
  deletedPanelBody,
  /getIndexEntry|getTabsEntry|appendLanguageSelector|addEditorVersion|renderEditorEntryPanel|renderEditorLanguagePanel/,
  'deleted tombstone panel should not call editable entry/language helpers that create missing state as a side effect'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-badge/,
  'editor tree CSS should not keep the old anonymous dot badge styles'
);

assert.match(
  editorSource,
  /\.editor-tree-status \{[\s\S]*\.editor-tree-change-badge \{[\s\S]*\.editor-tree-count-badge \{[\s\S]*\.editor-tree-order-badge \{[\s\S]*\.editor-tree-order-badge svg \{[\s\S]*\.editor-tree-spinner \{/,
  'editor tree CSS should define readable status badges, order badges, and checking spinners'
);

assert.match(
  editorSource,
  /@keyframes editor-tree-spinner-spin[\s\S]*@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.editor-tree-spinner \{ animation:none;/,
  'editor tree checking spinner should stop animating for reduced-motion users'
);

assert.match(
  editorSource,
  /#editorFileTree \.editor-tree-row\.is-selected > button\.editor-tree-node \{ background:color-mix\(in srgb, var\(--primary\) 18%, transparent\) !important;[\s\S]*color:color-mix\(in srgb, var\(--primary\) 86%, var\(--text\)\) !important; \}/,
  'selected file tree state should use a pale file-browser fill on the node button'
);

assert.match(
  editorFileTreeUiSource,
  /function isEditorTreeFileKind\(kind\) \{[\s\S]*kind === 'file' \|\| kind === 'deleted-file'[\s\S]*function createEditorTreeIcon\(node\) \{[\s\S]*const isFile = isEditorTreeFileKind\(node\.kind\);[\s\S]*let iconKind = isFile \? 'document' : 'folder';[\s\S]*node\.id === 'system:site-settings'[\s\S]*iconKind = 'settings';[\s\S]*node\.id === 'system:themes'[\s\S]*iconKind = 'themes';[\s\S]*node\.id === 'system:updates'[\s\S]*iconKind = 'updates';[\s\S]*node\.id === 'system:sync'[\s\S]*iconKind = 'publish';[\s\S]*editor-tree-icon-\$\{iconKind\}/,
  'file tree should render folder/document icons and dedicated system action icons'
);

assert.doesNotMatch(
  editorFileTreeUiSource,
  /className = 'editor-tree-path'/,
  'file tree should keep paths out of visible node text'
);

assert.match(
  editorSource,
  /\.editor-tree-guides \{ position:absolute; inset:-\.12rem 0; pointer-events:none; \}[\s\S]*\.editor-tree-guide \{[\s\S]*left:calc\(\(var\(--tree-guide-index\) \* 1\.12rem\) \+ \.58rem\);[\s\S]*background:color-mix\(in srgb, var\(--border\) 82%, transparent\)/,
  'nested file tree rows should draw subtle vertical guide lines for all ancestor levels'
);

assert.match(
  editorSource,
  /\.editor-tree-row\[data-kind="root"\] \.editor-tree-node \{ padding-left:\.45rem; font-weight:700; \}/,
  'root file tree labels should have enough left inset inside the selected pill'
);

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

assert.doesNotMatch(
  editorSource,
  /id="modeDynamicTabs"/,
  'editor should not render visible dynamic markdown tabs'
);

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
  source,
  /import \{ buildEditorContentTree, findEditorContentTreeNode, flattenEditorContentTree \} from '\.\/editor-content-tree\.js\?v=[\w.-]+';/,
  'composer should use the shared editor content tree model'
);

assert.match(
  composerIndexTabsModelSource,
  /function diffVersionLists\(currentValue, baselineValue\) \{[\s\S]*restoreValue: cloneIndexMetadataValue\(item\)[\s\S]*removed\.push\(\{[\s\S]*value: baseItems\[i\]\.path \|\| '',[\s\S]*restoreValue: baseItems\[i\]\.restoreValue,/,
  'article version diffs should preserve rich baseline metadata for deleted-version restore'
);

assert.match(
  source,
  /from '\.\/composer-markdown-session\.js\?v=[\w.-]+'/,
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

assert.doesNotMatch(
  source,
  /function renderPageLanguageStructure\(key, lang, value\) \{[\s\S]*treeText\('fieldTitle', 'Title'\)/,
  'page structure rows should no longer render a standalone title field label'
);

const initialBootIndex = source.indexOf('Apply initial state as early as possible');
const initialBootBlock = initialBootIndex >= 0
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
  `${editorMainSource}\n${editorMainCurrentFileSessionSource}`,
  /<button type="button" class="cf-breadcrumb-item/,
  'current file breadcrumb should not use native buttons that inherit the bordered toolbar style'
);

assert.doesNotMatch(
  `${editorMainSource}\n${editorMainCurrentFileSessionSource}`,
  /<a href="#" class="cf-breadcrumb-item\$\{currentClass\}"[\s\S]*data-current-file-node-id=/,
  'current file breadcrumb should no longer render clickable links'
);

assert.match(
  editorMainCurrentFileSessionSource,
  /const normalizeCurrentFileBreadcrumb = \(value, fallbackPath = ''\) => \{[\s\S]*const renderCurrentFileBreadcrumb = \(items, fullPath\) => \{[\s\S]*<span class="cf-breadcrumb-item cf-breadcrumb-item-static\$\{currentClass\}"\$\{ariaCurrent\}>/,
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
  /export function showEditorSystemPanel\(mode, deps = \{\}\) \{[\s\S]*mode === 'sync' \? 'sync'[\s\S]*editorSystemActions[\s\S]*editorModalThemeActions[\s\S]*editorModalSyncActions[\s\S]*mode-composer[\s\S]*mode-themes[\s\S]*mode-updates[\s\S]*mode-sync[\s\S]*\['themes', themeActions\][\s\S]*\['sync', syncActions\]/,
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
  /function getEditorRailToggles\(\) \{[\s\S]*documentRef\.querySelectorAll\('\[data-editor-rail-toggle\]'\)[\s\S]*function setEditorRailOpen\(open\) \{[\s\S]*const toggles = getEditorRailToggles\(\);[\s\S]*toggles\.forEach\(\(toggle\) => \{[\s\S]*toggle\.setAttribute\('aria-expanded', shouldOpen \? 'true' : 'false'\);[\s\S]*function initMobileEditorRail\(\) \{[\s\S]*const toggles = getEditorRailToggles\(\);[\s\S]*if \(!toggles\.length\) return;[\s\S]*toggles\.forEach\(\(toggle\) => \{[\s\S]*toggle\.addEventListener\('click', \(\) => \{[\s\S]*setEditorRailOpen\(!isOpen\);/,
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

assert.match(
  siteSettingsSource,
  /const renderIdentityLocalizedGrid = \(section\) => \{/,
  'composer site editor should define a merged identity localized grid renderer'
);

assert.match(
  siteSettingsSource,
  /renderIdentityLocalizedGrid\(identitySection\);/,
  'Identity section should render title and subtitle through the merged grid'
);

assert.match(
  siteSettingsSource,
  /renderIdentityPathGrid\(identitySection\);/,
  'Identity section should render avatar and content root through a compact path grid'
);

assert.match(
  siteSettingsSource,
  /const siteConfigSection = createSection\([\s\S]*sections\.configuration\.title[\s\S]*sections\.configuration\.description[\s\S]*createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.behavior\.title[\s\S]*renderBehaviorGrid\(behaviorSubsection\);/,
  'Behavior settings should render inside the combined Site Configuration section'
);

assert.match(
  siteSettingsSource,
  /createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.theme\.title[\s\S]*renderThemeGrid\(themeSubsection\);/,
  'Theme settings should render inside the combined Site Configuration section'
);

assert.match(
  siteSettingsSource,
  /createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.assets\.title[\s\S]*renderAssetWarningsGrid\(assetsSubsection\);/,
  'Asset warnings should render inside the combined Site Configuration section'
);

assert.match(
  siteSettingsSource,
  /renderSeoResourceGrid\(seoSection\);/,
  'SEO Resource URL should render through the compact grid'
);

assert.match(
  siteSettingsSource,
  /renderLocalizedField\(seoSection, 'siteKeywords'[\s\S]*createLinkListField\(seoSection, 'profileLinks'[\s\S]*renderSeoResourceGrid\(seoSection\);/,
  'SEO section should render Profile links before Resource URL'
);

assert.match(
  siteSettingsSource,
  /createLinkListField\(seoSection, 'profileLinks', \{[\s\S]*subheading: true[\s\S]*\}\);/,
  'SEO Profile links should opt into the shared subsection heading style'
);

assert.match(
  siteSettingsSource,
  /const appendLinkHeader = \(\) => \{[\s\S]*head\.className = 'cs-link-head';[\s\S]*labelTitle\.id = labelTitleId;[\s\S]*hrefTitle\.id = hrefTitleId;[\s\S]*listWrap\.appendChild\(head\);[\s\S]*appendLinkHeader\(\);[\s\S]*list\.forEach/,
  'profile link Name and URL labels should render in a static header outside draggable rows'
);

assert.match(
  siteSettingsSource,
  /const renderRowsAndRefreshDiff = \(\) => \{[\s\S]*renderRows\(\);[\s\S]*notifyComposerChange\('site', \{ skipAutoSave: true \}\);[\s\S]*\};[\s\S]*moveEntry\(index, event\.key === 'ArrowUp' \? index - 1 : index \+ 1, \{ refreshDiff: true \}\);[\s\S]*renderRowsAndRefreshDiff\(\);/,
  'profile link reorders should refresh site diff markers after replacing row DOM'
);

assert.doesNotMatch(
  siteSettingsSource,
  /row\.classList\.add\('cs-link-row--with-title'\)|labelField\.append\(labelTitle, labelInput\)|hrefField\.append\(hrefTitle, hrefInput\)/,
  'profile link draggable rows should not own the static Name and URL labels'
);

assert.match(
  siteSettingsSource,
  /const moveEntry = \(from, to, options = \{\}\) => \{[\s\S]*list\.splice\(to, 0, item\);[\s\S]*markDirty\(\);[\s\S]*if \(options\.refreshDiff\) renderRowsAndRefreshDiff\(\);[\s\S]*else renderRows\(\);[\s\S]*const createDragHandle = \(index\) => \{/,
  'profile links should share one reorder path between drag handles and keyboard movement'
);

assert.match(
  siteSettingsSource,
  /const handle = document\.createElement\('span'\);[\s\S]*handle\.setAttribute\('role', 'button'\);[\s\S]*handle\.className = 'cs-link-drag-handle';[\s\S]*handle\.setAttribute\('aria-label', t\('editor\.composer\.site\.reorderLink'\)\);[\s\S]*handle\.addEventListener\('pointerdown',/,
  'profile links should render a standalone pointer drag handle for reordering'
);

assert.match(
  siteSettingsSource,
  /const createDragPlaceholder = \(row\) => \{[\s\S]*placeholder\.className = 'cs-link-drop-placeholder';[\s\S]*placeholder\.style\.height = `\$\{rowRect\.height\}px`;/,
  'profile link drag should create an in-list placeholder matching the dragged row height'
);

assert.match(
  siteSettingsSource,
  /const animateLinkRows = \(callback\) => \{[\s\S]*getBoundingClientRect\(\)[\s\S]*row\.style\.transform = `translate3d\(0, \$\{previous\.top - next\.top\}px, 0\)`[\s\S]*requestAnimationFrame/,
  'profile link drag should animate non-dragged rows into their preview positions'
);

assert.match(
  siteSettingsSource,
  /const applyDragPreview = \(clientY\) => \{[\s\S]*linkDragState\.dragRow\.style\.transform = `translate3d\(0, \$\{clientY - linkDragState\.startY\}px, 0\)`[\s\S]*animateLinkRows\(\(\) => \{/,
  'profile link drag should move the dragged row with the pointer while previewing the drop position'
);

assert.doesNotMatch(
  siteSettingsSource,
  /className = 'btn-tertiary cs-move'|addEventListener\('click', \(\) => moveEntry\(index, index [-+] 1\)\)/,
  'profile links should not render old up/down reorder buttons'
);

assert.match(
  editorStructurePanelUiSource,
  /function moveStructureRootEntry\(source, from, to\) \{[\s\S]*const order = Array\.isArray\(state\.__order\) \? state\.__order : \[\];[\s\S]*const \[key\] = order\.splice\(from, 1\);[\s\S]*order\.splice\(to, 0, key\);[\s\S]*notifyComposerChange\(source\);[\s\S]*refreshEditorContentTree\(\);/,
  'structure panels should reorder the backing root order and refresh the content tree'
);

assert.match(
  editorStructurePanelUiSource,
  /const dragController = createEditorStructureDragController\(list,[\s\S]*const createStructureDragHandle = \(index, source\) => \{[\s\S]*const labelKey = source === 'tabs' \? 'reorderPage' : 'reorderArticle';[\s\S]*return dragController\.createHandle\(index, treeText\(labelKey, source === 'tabs' \? 'Reorder page' : 'Reorder article'\)\);/,
  'article and page structure rows should render a standalone drag handle with pointer and keyboard reorder hooks'
);

assert.match(
  editorStructurePanelUiSource,
  /const renderStructureDraggableItem = \(child, detail, index, source\) => \{[\s\S]*item\.className = 'editor-structure-item editor-structure-item--draggable';[\s\S]*const handle = createStructureDragHandle\(index, source\);[\s\S]*item\.append\(handle, main, controls\);/,
  'article and page structure rows should compose handle, content, and actions as separate elements'
);

assert.match(
  editorStructurePanelUiSource,
  /const createPlaceholder = \(item\) => \{[\s\S]*placeholder\.className = 'editor-structure-drop-placeholder';[\s\S]*placeholder\.style\.height = `\$\{itemRect\.height\}px`;/,
  'article structure drag should create an in-list placeholder matching the dragged row height'
);

assert.match(
  editorStructurePanelUiSource,
  /const applyDragPreview = \(clientY\) => \{[\s\S]*dragState\.dragItem\.style\.transform = `translate3d\(0, \$\{clientY - dragState\.startY\}px, 0\)`[\s\S]*animateRows\(\(\) => \{/,
  'structure drag should move the dragged row with the pointer while previewing the drop position'
);

assert.match(
  editorStructurePanelUiSource,
  /if \(node\.source === 'index' \|\| node\.source === 'tabs'\) \{[\s\S]*visibleChildren\.forEach\(\(child, index\) => \{[\s\S]*renderStructureDraggableItem\(child, `\$\{child\.children\.length\} \$\{treeText\('languages', 'languages'\)\}`, index, node\.source\)/,
  'articles and pages root panels should both use draggable structure rows for non-deleted current entries'
);

assert.doesNotMatch(
  siteSettingsSource,
  /class="ct-field ct-field-title"|const titleLabel = tComposerLang\('fields\.title'\)|const titleInput = \$\('\.ct-title', block\)|entry\[lang\]\.title = e\.target\.value/,
  'page entry structure rows should no longer render editable title inputs once title moves into the markdown editor metadata panel'
);

assert.doesNotMatch(
  siteSettingsSource,
  /<input class="ct-loc"|const pathPlaceholder = tComposerLang\('placeholders\.tabPath'\)|const locInput = \$\('\.ct-loc', block\)|entry\[lang\]\.location = e\.target\.value/,
  'page entry lists should no longer render editable location inputs for tabs languages'
);

assert.doesNotMatch(
  siteSettingsSource,
  /editor-structure-item[^\\n]*addEventListener\('pointerdown'|item\.setAttribute\('draggable', 'true'\)|className = 'btn-secondary editor-structure-move'/,
  'structure reordering should not start from the whole row or restore legacy move buttons'
);

assert.match(
  siteSettingsSource,
  /renderLocalizedField\(seoSection, 'siteDescription', \{[\s\S]*subheading: true[\s\S]*\}\);[\s\S]*renderLocalizedField\(seoSection, 'siteKeywords', \{[\s\S]*subheading: true[\s\S]*\}\);/,
  'SEO localized fields should opt into the shared subsection heading style'
);

assert.match(
  siteSettingsSource,
  /const field = options\.subheading[\s\S]*createSubheadingField\(section, \{[\s\S]*dataKey: key,[\s\S]*label: options\.label,[\s\S]*description: options\.description[\s\S]*createField\(section, \{/,
  'localized fields should be able to reuse the shared subsection heading renderer'
);

assert.match(
  siteSettingsSource,
  /const createSubheadingField = \(section, config\) => \{[\s\S]*head\.className = 'cs-config-subsection-head'[\s\S]*title\.className = 'cs-config-subsection-title'[\s\S]*description\.className = 'cs-config-subsection-description'/,
  'subheading fields should reuse the same title and description classes as combined configuration subsections'
);

assert.doesNotMatch(
  siteSettingsSource,
  /renderLocalizedField\(identitySection,\s*'siteTitle'/,
  'Identity section should not render siteTitle as a standalone localized field'
);

assert.doesNotMatch(
  siteSettingsSource,
  /renderLocalizedField\(identitySection,\s*'siteSubtitle'/,
  'Identity section should not render siteSubtitle as a standalone localized field'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createTextField\(identitySection,\s*\{\s*dataKey: 'avatar'/,
  'Avatar should not use the tall standalone text field layout'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createTextField\(identitySection,\s*\{\s*dataKey: 'contentRoot'/,
  'Content root should not use the tall standalone text field layout'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createTextField\(seoSection,\s*\{\s*dataKey: 'resourceURL'/,
  'Resource URL should not use the tall standalone text field layout'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-identity-grid/,
  'runtime stylesheet should include identity grid layout rules'
);

assert.match(
  composerRuntimeStylesSource,
  /grid-template-columns:minmax\(88px,max-content\) minmax\(0,1fr\) minmax\(0,3fr\) minmax\(72px,max-content\)/,
  'desktop identity grid should make the title column one quarter of the title/subtitle input area'
);

assert.match(
  siteSettingsSource,
  /siteTitle\|siteSubtitle/,
  'diff and reveal handling should recognize the combined identity field'
);

assert.match(
  siteSettingsSource,
  /const useLocalizedGrid = !!\(options\.grid \|\| options\.multiline\);/,
  'localized fields should have an explicit grid option shared by keywords and multiline fields'
);

assert.match(
  siteSettingsSource,
  /renderLocalizedField\(seoSection, 'siteKeywords', \{[\s\S]*grid: true,[\s\S]*ensureDefault: false/,
  'Site keywords should opt into the aligned localized grid layout'
);

assert.match(
  siteSettingsSource,
  /if \(useLocalizedGrid\) row\.classList\.add\('cs-localized-row--grid'\);[\s\S]*if \(options\.multiline\) row\.classList\.add\('cs-localized-row--multiline'\);/,
  'aligned localized fields should mark grid rows separately from multiline textarea behavior'
);

assert.match(
  siteSettingsSource,
  /list\.className = useLocalizedGrid\s+\? 'cs-localized-list cs-localized-list--grid'\s+: 'cs-localized-list';/,
  'aligned localized fields should mark the list so row spacing can match the identity grid'
);

assert.match(
  siteSettingsSource,
  /\.cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list\{--cs-editor-row-gap:\.35rem;--cs-editor-row-column-gap:\.45rem;--cs-editor-control-height:1\.95rem;--cs-editor-single-control-width:15rem\}/,
  'identity, aligned localized rows, and profile links should share one row rhythm and fixed single-control width contract'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.(?:cs-root|cs-single-grid-fieldset)\{[^}]*--cs-editor-single-label-width/,
  'compact containers should not redeclare the measured label width because that masks the inherited dynamic value'
);

assert.match(
  siteSettingsSource,
  /\.cs-localized-list--grid\{gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-localized-row--grid\{display:grid;grid-template-columns:minmax\(88px,88px\) minmax\(0,1fr\) minmax\(72px,max-content\);align-items:center;column-gap:var\(--cs-editor-row-column-gap\);row-gap:0;min-height:var\(--cs-editor-control-height\);padding:0/,
  'aligned localized rows should use the shared identity row density and reserve aligned input columns'
);

assert.match(
  siteSettingsSource,
  /\.cs-identity-grid\{display:flex;flex-direction:column;gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-identity-row\{display:grid;grid-template-columns:minmax\(88px,max-content\) minmax\(0,1fr\) minmax\(0,3fr\) minmax\(72px,max-content\);align-items:center;gap:var\(--cs-editor-row-column-gap\)\}/,
  'identity rows should consume the same row rhythm contract'
);

assert.match(
  siteSettingsSource,
  /\.cs-localized-row--grid \.cs-lang-chip\{justify-self:end\}/,
  'aligned localized rows should right-align language chips within the language column'
);

assert.match(
  siteSettingsSource,
  /\.cs-identity-lang\{min-width:0;display:flex;align-items:center;justify-content:flex-end\}/,
  'identity localized rows should right-align language chips within the language column'
);

assert.match(
  composerIndexTabsUiSource,
  /const flag = langFlag\(lang\);[\s\S]*const flagSpan = flag \? `<span class="ci-lang-flag" aria-hidden="true">\$\{escapeHtml\(flag\)\}<\/span>` : '';[\s\S]*<strong class="ci-lang-label" aria-label="\$\{safeLabel\}" title="\$\{safeLabel\}">[\s\S]*<span class="ci-lang-code">\$\{escapeHtml\(lang\.toUpperCase\(\)\)\}<\/span>/,
  'index language section headings should show the regional flag before the language code'
);

assert.match(
  siteSettingsSource,
  /\.ci-lang-label\{display:inline-flex;align-items:center;gap:\.35rem;line-height:1\.1;\}[\s\S]*\.ci-lang-label \.ci-lang-flag\{display:inline-grid;place-items:center;width:1\.2em;height:1\.2em;font-size:1rem;line-height:1;\}[\s\S]*\.ci-lang-label \.ci-lang-code\{display:inline-flex;align-items:center;line-height:1\.2;/,
  'index language section flags should be aligned as part of the compact heading label'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.ci-item:hover[\s\S]*transform:translateY\(-1px\)|\.ci-item:hover[\s\S]*--ci-depth-shadow:0 12px 24px|\.ci-item:hover[\s\S]*border-color:color-mix/,
  'composer entry cards should not float, deepen shadow, or recolor border on hover'
);

assert.match(
  siteSettingsSource,
  /\.ci-lang\{border:0;border-radius:0;margin:0;background:transparent;padding:\.65rem 0;\}[\s\S]*\.ci-lang\+\.ci-lang\{border-top:1px solid color-mix\(in srgb, var\(--border\) 82%, transparent\);\}/,
  'index language sections should read as separated rows instead of nested cards'
);

assert.match(
  composerIndexTabsUiSource,
  /<button class="btn-secondary ci-expand"[\s\S]*<\/button>\s*<span class="ci-head-add-lang-slot"><\/span>\s*<button class="btn-secondary ci-del">/,
  'index add-language control should live in the entry header immediately after details'
);

assert.match(
  composerIndexTabsUiSource,
  /const headAddLangSlot = query\('\.ci-head-add-lang-slot', row\);[\s\S]*if \(headAddLangSlot\) headAddLangSlot\.innerHTML = '';[\s\S]*\(headAddLangSlot \|\| bodyInner\)\.appendChild\(addLangWrap\);/,
  'index add-language menu should be mounted into the header slot and refreshed with the body'
);

assert.match(
  composerIndexTabsUiSource,
  /const handle = target\.closest\('\.ci-grip,\.ct-grip'\);[\s\S]*if \(!handle \|\| !container\.contains\(handle\)\) return;[\s\S]*const li = handle\.closest\(keySelector\);/,
  'composer entry reordering should start only from the visible drag handle'
);

assert.doesNotMatch(
  composerIndexTabsUiSource.match(/function makeDragList\(container, onReorder\) \{[\s\S]*?\n  function buildIndexUI\(root, state\) \{/)[0],
  /const li = target\.closest\(keySelector\);/,
  'composer entry reordering should not treat the entire card as a drag source'
);

assert.doesNotMatch(
  composerIndexTabsUiSource.match(/function buildIndexUI\(root, state\) \{[\s\S]*?\n  function buildTabsUI\(root, state\) \{/)[0],
  /bodyInner\.appendChild\(addLangWrap\);/,
  'index add-language control should not render at the bottom of the expanded language list'
);

assert.match(
  siteSettingsSource,
  /const renderIdentityPathGrid = \(section\) => \{/,
  'composer site editor should define a compact identity path grid renderer'
);

assert.match(
  siteSettingsSource,
  /const createSingleGridFieldset = \(section\) => \{/,
  'compact single-value sections should share one reusable grid fieldset renderer'
);

assert.match(
  composerUiMotionSource,
  /export function syncSiteEditorSingleLabelWidth\(root\) \{[\s\S]*querySelectorAll\('\.cs-single-grid-title'\)[\s\S]*requestAnimationFrame[\s\S]*ResizeObserver/,
  'compact single-value labels should be measured once after render and shared through a CSS variable'
);

assert.match(
  siteSettingsSource,
  /label\.scrollWidth[\s\S]*getComputedStyle\(target\)[\s\S]*gap/,
  'compact single-value label measurement should use intrinsic label width instead of the currently constrained grid cell'
);

assert.match(
  siteSettingsSource,
  /target\.querySelector \? target\.querySelector\('\.cs-help-tooltip'\) : null[\s\S]*const tooltipWidth = tooltip \? tooltip\.scrollWidth \|\| 0 : 0;/,
  'compact single-value label measurement should measure only the help icon, not the tooltip wrapper'
);

assert.doesNotMatch(
  siteSettingsSource,
  /querySelector\('\.cs-help-tooltip-wrap'\)[\s\S]*const tooltipWidth = tooltip \? tooltip\.scrollWidth \|\| 0 : 0;/,
  'compact single-value label measurement should not include hidden tooltip bubble width'
);

assert.doesNotMatch(
  siteSettingsSource,
  /function syncSiteEditorSingleLabelWidth\(root\) \{[\s\S]*getBoundingClientRect[\s\S]*root\.style\.setProperty\('--cs-editor-single-label-width'/,
  'compact single-value label measurement should not seed width from constrained layout rects'
);

assert.match(
  siteSettingsSource,
  /buildSiteUI\(root, state\) \{[\s\S]*syncSiteEditorSingleLabelWidth\(root\);[\s\S]*refreshNavDiffState\(\);/,
  'site editor should resync the measured single-label width after rebuilding translated labels'
);

assert.match(
  siteSettingsSource,
  /const renderSingleTextGrid = \(section, items\) => \{[\s\S]*createSingleGridFieldset\(section\)[\s\S]*input\.id = controlId;[\s\S]*input\.addEventListener\('input'/,
  'compact text rows should share one reusable single-grid text renderer'
);

assert.match(
  siteSettingsSource,
  /const renderSeoResourceGrid = \(section\) => \{[\s\S]*dataKey: 'resourceURL'[\s\S]*fields\.resourceURLHelp/,
  'SEO Resource URL compact grid should preserve the field key and help tooltip text'
);

assert.doesNotMatch(
  siteSettingsSource,
  /renderCompactSectionMenu|cs-mobile-section-nav|cs-nav-button/,
  'site settings should not render section navigation controls'
);

assert.match(
  siteSettingsSource,
  /const resolveSiteScrollContainer = \(\) => \{[\s\S]*root \? root\.querySelector\('\.cs-viewport'\)[\s\S]*canOwnScroll[\s\S]*return viewport;[\s\S]*root\.closest\('\.editor-modal-body'\)[\s\S]*return modalBody;[\s\S]*return window;[\s\S]*\};/,
  'site settings scrolling should prefer the internal content viewport before falling back to the modal body'
);

assert.match(
  siteSettingsSource,
  /const scrollContainer = resolveSiteScrollContainer\(\);[\s\S]*scrollContainer\.addEventListener\('scroll', onScroll, \{ passive: true \}\);[\s\S]*scrollContainer\.removeEventListener\('scroll', onScroll, \{ passive: true \}\);/,
  'site section state sync should listen to its resolved scroll container, not only window scroll'
);

assert.match(
  siteSettingsSource,
  /let measuredAnySection = false;[\s\S]*if \(!rect \|\| rect\.height <= 4\) continue;[\s\S]*measuredAnySection = true;[\s\S]*if \(!measuredAnySection\) return;[\s\S]*if \(!candidate\) candidate = sectionsMeta\[0\] \|\| null;/,
  'site section active-state sync should ignore hidden modal measurements instead of falling back to the last section'
);

assert.match(
  siteSettingsSource,
  /const scrollTop = getSiteScrollTop\(scrollContainer\);[\s\S]*if \(scrollTop <= 4\) candidate = sectionsMeta\[0\] \|\| null;/,
  'site section active-state sync should keep the repository section active when the modal body is at the top'
);

assert.match(
  composerEditorShellSource,
  /function resetSiteSettingsNavOnOpen\(\) \{[\s\S]*modalBody\.scrollTop = 0;[\s\S]*root\.__pressSiteFirstSectionId[\s\S]*setActive\(firstSectionId,[\s\S]*scrollViewport: false[\s\S]*activateFirst\(\);[\s\S]*requestAnimationFrame/,
  'opening Site Settings should reset the shell modal body and left navigation to the first section'
);

assert.match(
  siteSettingsSource,
  /const renderBehaviorGrid = \(section\) => \{[\s\S]*dataKey: 'defaultLanguage'[\s\S]*dataKey: 'contentOutdatedDays'[\s\S]*dataKey: 'pageSize'[\s\S]*dataKey: 'showAllPosts'[\s\S]*dataKey: 'landingTab'[\s\S]*dataKey: 'cardCoverFallback'[\s\S]*dataKey: 'errorOverlay'/,
  'Behavior compact grid should include all single-value behavior fields'
);

assert.match(
  siteSettingsSource,
  /const renderThemeGrid = \(section\) => \{[\s\S]*dataKey: 'themeMode'[\s\S]*dataKey: 'themePack'[\s\S]*dataKey: 'themeOverride'/,
  'Theme compact grid should include all single-value theme fields'
);

assert.match(
  siteSettingsSource,
  /const renderAssetWarningsGrid = \(section\) => \{[\s\S]*dataKey: 'assetWarnings'[\s\S]*fields\.assetLargeImage[\s\S]*fields\.assetLargeImageThreshold/,
  'Asset warnings compact grid should include the warning toggle and threshold rows'
);

assert.match(
  siteSettingsSource,
  /const renderThemeGrid = \(section\) => \{[\s\S]*fetch\('assets\/themes\/packs\.json', \{ cache: 'no-store' \}\)[\s\S]*applyThemePackOptions\(fallbackThemePacks\);/,
  'Theme compact grid should preserve dynamic theme pack loading with fallback options'
);

assert.match(
  siteSettingsSource,
  /const repoSection = createSection\([\s\S]*sections\.repo\.title[\s\S]*sections\.repo\.description[\s\S]*const identitySection = createSection\(/,
  'Repository should be the first site editor card before Identity'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createField\(repoSection,\s*\{[\s\S]*dataKey: 'repo'[\s\S]*fields\.repo[\s\S]*fields\.repoHelp/,
  'Repository card should not render a duplicate GitHub repository field heading'
);

assert.match(
  composerPublishSettingsUiSource,
  /function renderFineGrainedTokenSettings\(host\) \{[\s\S]*tokenField\.className = 'cs-repo-field-group cs-repo-field-group--token cs-token-field';[\s\S]*field\.className = 'cs-repo-field cs-repo-field--token';[\s\S]*input\.id = 'syncGithubTokenInput';[\s\S]*input\.className = 'cs-input cs-repo-input cs-repo-input--token';[\s\S]*const btnForget = documentRef\.createElement\('span'\);[\s\S]*btnForget\.setAttribute\('role', 'button'\);[\s\S]*btnForget\.className = 'cs-token-clear';[\s\S]*field\.append\(affix, input, btnForget\);[\s\S]*setCachedFineGrainedToken\(input\.value\);[\s\S]*host\.appendChild\(wrapper\);/,
  'fine-grained token settings should reuse the repository field style with a full-width token field'
);

assert.doesNotMatch(
  composerPublishSettingsUiSource.slice(composerPublishSettingsUiSource.indexOf('function renderFineGrainedTokenSettings(host) {'), composerPublishSettingsUiSource.indexOf('function renderPublishTransportSettings(host) {')),
  /documentRef\.createElement\('button'\)|document\.createElement\('button'\)/,
  'token clear control should avoid native button chrome'
);

assert.doesNotMatch(
  composerPublishSettingsUiSource,
  /cs-token-actions/,
  'token clear control should not reserve a separate action row below the input'
);

assert.match(
  composerNotificationsSource,
  /const hasAction = !!\(action && \(action\.href \|\| typeof action\.onClick === 'function'\)\);[\s\S]*const shouldAutoDismiss = toastOptions\.sticky !== true && !hasAction;/,
  'plain info toasts such as Loading config should auto-dismiss unless explicitly sticky or actionable'
);

assert.match(
  siteSettingsSource,
  /repoInputs\.className = 'cs-repo-grid';[\s\S]*repoInputs\.dataset\.field = 'repo';[\s\S]*createRepoFieldGroup\('cs-repo-field-group--owner', t\('editor\.composer\.site\.repoOwner'\), ownerWrap\)[\s\S]*createRepoFieldGroup\('cs-repo-field-group--name', t\('editor\.composer\.site\.repoName'\), repoWrap\)[\s\S]*createRepoFieldGroup\('cs-repo-field-group--branch', t\('editor\.composer\.site\.repoBranch'\), branchWrap\)[\s\S]*repoSection\.appendChild\(repoInputs\);/,
  'Repository inputs should remain diff-addressable while rendering labeled controls directly in the Repository card'
);

assert.match(
  siteSettingsSource,
  /repoSection\.appendChild\(repoInputs\);\s*renderPublishTransportSettings\(repoSection\);/,
  'Repository card should host the browser-local publish transport settings'
);

assert.match(
  composerPublishSettingsUiSource,
  /function getMatchingConnectPublishGrant\(connect, repo = getActiveSiteRepoConfig\(\)\) \{[\s\S]*cached\.baseUrl !== connect\.baseUrl[\s\S]*cached\.owner !== repo\.owner \|\| cached\.name !== repo\.name \|\| cached\.branch !== branch[\s\S]*return cached;/,
  'Connect connected UI should only trust cached grants that match the selected repo, branch, and base URL'
);

assert.match(
  composerPublishSettingsUiSource,
  /function getVisibleFineGrainedTokenInput\(\) \{[\s\S]*documentRef\.querySelectorAll\('#syncGithubTokenInput'\)[\s\S]*offsetParent !== null[\s\S]*function syncFineGrainedTokenInputs\(value, sourceInput = null\) \{[\s\S]*documentRef\.querySelectorAll\('#syncGithubTokenInput'\)[\s\S]*if \(input !== sourceInput\) input\.value = nextValue;[\s\S]*function openSyncPanelForPatFallback\(\) \{[\s\S]*applyMode\('sync', \{ preserveTreeExpansion: true \}\);[\s\S]*showEditorSystemPanel\('sync'\);[\s\S]*function switchToPatFallbackAndFocusToken\(\) \{[\s\S]*setConnectPublishEnabled\(false\);[\s\S]*openSyncPanelForPatFallback\(\);[\s\S]*updatePublishTransportSettingsDomForPatFallback\(\);[\s\S]*refreshSyncCommitPanel\(\{ focusToken: true \}\)[\s\S]*\.then\(\(\) => focusFineGrainedTokenInput\(\)\)[\s\S]*\.catch\(\(\) => focusFineGrainedTokenInput\(\)\);/,
  'Connect failure fallback action should switch to PAT mode through the normal Publish panel path, refresh publish state, and focus the visible PAT token input'
);

assert.match(
  composerPublishSettingsUiSource,
  /input\.addEventListener\('input', \(\) => \{[\s\S]*setCachedFineGrainedToken\(input\.value\);[\s\S]*syncFineGrainedTokenInputs\(input\.value, input\);[\s\S]*const clearToken = \(\) => \{[\s\S]*clearCachedFineGrainedToken\(\);[\s\S]*syncFineGrainedTokenInputs\(''\);/,
  'Multiple PAT token inputs should stay synchronized so clearing one cannot resurrect a stale session token'
);

assert.match(
  composerSyncPanelSource,
  /const showError = \(message, errorOptions = \{\}\) => \{[\s\S]*sync-commit-error-hint[\s\S]*connectFallbackHint[\s\S]*sync-connect-fallback-action[\s\S]*switchToPatFallbackAndFocusToken\(\);/,
  'inline Connect authorization errors should render an explicit PAT fallback action'
);

assert.match(
  editorSource,
  /\.sync-commit-error\s*\{[\s\S]*display:flex;[\s\S]*\.sync-commit-error\[hidden\]\s*\{[\s\S]*display:none !important;/,
  'sync commit fallback errors should still obey the hidden attribute after flex styling'
);

assert.match(
  composerPublishFlowSource,
  /let connectFallbackActionAvailable = false;[\s\S]*const \{ files \} = await gatherCommitPayload\(\{ showSeoStatus: true \}\);[\s\S]*connectFallbackActionAvailable = true;[\s\S]*await publishStagedCommit\(\{[\s\S]*transport,[\s\S]*getCachedGrant: getCachedConnectPublishGrant[\s\S]*connectFallbackActionAvailable = false;[\s\S]*if \(transport && transport\.type === 'connect' && connectFallbackActionAvailable\) \{[\s\S]*toastOptions\.action = \{[\s\S]*connectFallback[\s\S]*switchToPatFallbackAndFocusToken\(\);[\s\S]*showToast\('error', message, toastOptions\);/,
  'Only Connect authorization and publish failures should expose a toast action that switches to PAT fallback'
);

[
  ['English', enI18nSource],
  ['Simplified Chinese', chsI18nSource],
  ['Traditional Chinese', chtTwI18nSource],
  ['Japanese', jaI18nSource]
].forEach(([label, localeSource]) => {
  assert.match(
    localeSource,
    /connectFallbackHint:/,
    `${label} translations should explain when to use the PAT fallback after Connect failures`
  );
});

assert.match(
  publishSettingsSource,
  /const CONNECT_PUBLISH_ENABLED_STORAGE_KEY = 'press_connect_publish_enabled';[\s\S]*const PUBLISH_TRANSPORT_MODE_STORAGE_KEY = 'press_publish_transport_mode';[\s\S]*const CONNECT_PUBLISH_PRESETS = \[[\s\S]*https:\/\/connect-8mr\.pages\.dev[\s\S]*http:\/\/127\.0\.0\.1:8788/,
  'Connect publish settings should keep legacy storage compatibility while defaulting to a transport mode key'
);

assert.match(
  siteSettingsSource,
  /const ANNOTATE_DISCUSSION_CATEGORY_PRESETS = \[[\s\S]*value: 'General'[\s\S]*renderAnnotateGrid[\s\S]*type: 'url'[\s\S]*listId: 'siteAnnotateConnectBaseUrlPresets'[\s\S]*options: CONNECT_PUBLISH_PRESETS[\s\S]*listId: 'siteAnnotateDiscussionCategoryPresets'[\s\S]*options: ANNOTATE_DISCUSSION_CATEGORY_PRESETS/,
  'Annotate settings should expose editable datalist inputs for Connect URL and Discussion category'
);

assert.match(
  publishSettingsSource,
  /function normalizeConnectPublishBaseUrl\(value\) \{[\s\S]*const url = new URL\(rawBaseUrl\);[\s\S]*url\.protocol !== 'https:' && !\(url\.protocol === 'http:' && isLocalhostHost\(url\.hostname\)\)[\s\S]*return url\.origin;/,
  'Connect publish URL normalization should require absolute HTTPS or localhost HTTP URLs'
);

assert.match(
  publishSettingsSource,
  /mode: 'connect'[\s\S]*const modeRaw = storage\.getItem\(scopedKey\(PUBLISH_TRANSPORT_MODE_STORAGE_KEY\)\)[\s\S]*enabledRaw === '0'[\s\S]*mode = 'pat'[\s\S]*function resolvePublishTransport/,
  'Publish transport should default to Connect while preserving legacy opt-out to PAT fallback'
);

assert.doesNotMatch(
  [source, composerSiteModelSource].join('\n'),
  /function connectForOutput|snapshot\.connect|diff\.fields\.connect|getUseFineGrainedTokenFallback|CONNECT_PUBLISH_FALLBACK_STORAGE_KEY/,
  'site.yaml connect output, diffing, and PAT fallback storage should be removed'
);

assert.match(
  composerDiffUiSource,
  /function applySiteDiffMarkers\(diff\) \{[\s\S]*const lang = el\.getAttribute\('data-lang'\);[\s\S]*const subfield = el\.getAttribute\('data-subfield'\);[\s\S]*const hasChangedDescendant = \(el\) =>[\s\S]*if \(hasChangedDescendant\(el\)\) \{/,
  'Site editor diff markers should support control-level language and subfield matching'
);

assert.match(
  composerDiffUiSource,
  /if \(info\.type === 'object' && info\.fields\) \{\s*return subfield \? !!info\.fields\[subfield\] : false;\s*\}/,
  'Object field diffs should only match controls that declare a changed subfield'
);

assert.match(
  composerDiffUiSource,
  /if \(info\.type === 'list' && info\.entries\) \{\s*if \(index != null && subfield\) return !!\(info\.entries\[index\] && info\.entries\[index\]\[subfield\]\);\s*return true;\s*\}/,
  'List field diffs should preserve field-level markers when removed rows have no remaining controls'
);

assert.match(
  siteSettingsSource,
  /input\.dataset\.field = key;[\s\S]*input\.dataset\.lang = lang;/,
  'Localized site inputs should carry field and language diff metadata'
);

assert.match(
  siteSettingsSource,
  /input\.dataset\.field = key;[\s\S]*input\.dataset\.lang = lang;[\s\S]*input\.dataset\.subfield = key;/,
  'Identity grid inputs should carry field, language, and subfield diff metadata'
);

assert.match(
  siteSettingsSource,
  /ownerWrap\.dataset\.field = 'repo';[\s\S]*ownerWrap\.dataset\.subfield = 'owner';[\s\S]*repoWrap\.dataset\.field = 'repo';[\s\S]*repoWrap\.dataset\.subfield = 'name';[\s\S]*branchWrap\.dataset\.field = 'repo';[\s\S]*branchWrap\.dataset\.subfield = 'branch';/,
  'Repository diff metadata should target the specific owner, repo name, or branch pill'
);

assert.match(
  siteSettingsSource,
  /labelInput\.dataset\.field = key;[\s\S]*labelInput\.dataset\.index = String\(index\);[\s\S]*labelInput\.dataset\.subfield = 'label';[\s\S]*hrefInput\.dataset\.field = key;[\s\S]*hrefInput\.dataset\.index = String\(index\);[\s\S]*hrefInput\.dataset\.subfield = 'href';/,
  'Profile link diff metadata should target the specific label or URL input'
);

assert.doesNotMatch(
  composerRuntimeStylesSource,
  /\.cs-field\[data-diff="changed"\],\.cs-repo-grid\[data-diff="changed"\],\.cs-extra-list\[data-diff="changed"\],\.cs-single-grid-row\[data-diff="changed"\]\{background:/,
  'Site editor changed-state highlights should not tint whole field containers'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-field\[data-diff="changed"\] \.cs-input,\.cs-field\[data-diff="changed"\] \.cs-select,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-input,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-select[\s\S]*\{background:color-mix\(in srgb,#f59e0b 10%, transparent\);border-color:color-mix\(in srgb,#f59e0b 45%, var\(--border\)\)\}/,
  'Site editor changed-state highlights should tint changed text and select controls'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-field\[data-diff="changed"\] \.cs-empty\{background:color-mix\(in srgb,#f59e0b 10%, var\(--card\)\);border-color:color-mix\(in srgb,#f59e0b 45%, var\(--border\)\)/,
  'Site editor changed-state highlights should tint empty placeholders for changed list fields'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-repo-grid\[data-diff="changed"\] \.cs-repo-field,[\s\S]*\.cs-extra-list\[data-diff="changed"\] li[\s\S]*background:color-mix\(in srgb,#f59e0b 10%, transparent\)/,
  'Site editor changed-state highlights should tint changed repository fields and read-only key rows'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-field\[data-diff="changed"\] \.cs-switch-track,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-switch-track[\s\S]*background:color-mix\(in srgb,#f59e0b 18%, var\(--card\)\)/,
  'Site editor changed-state highlights should tint changed switch tracks'
);

assert.doesNotMatch(
  composerRuntimeStylesSource,
  /\[data-diff="changed"\][^{]*\{[^}]*box-shadow:inset[^}]*\}/,
  'Site editor changed-state highlights should not add inset bars'
);

assert.doesNotMatch(
  source,
  /\[data-diff="changed"\][^{]*\{[^}]*padding-left:[^}]*\}/,
  'Site editor changed-state highlights should not add left padding that shifts fields'
);

assert.match(
  siteSettingsSource,
  /const siteConfigSection = createSection\([\s\S]*renderBehaviorGrid\(behaviorSubsection\);[\s\S]*renderThemeGrid\(themeSubsection\);[\s\S]*renderAssetWarningsGrid\(assetsSubsection\);[\s\S]*const extrasSection = createSection\(/,
  'Site editor should combine Behavior, Theme, and Asset warnings before Other keys'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createField\(extrasSection,\s*\{[\s\S]*dataKey: '__extras'[\s\S]*fields\.extras[\s\S]*fields\.extrasHelp/,
  'Other keys should not render a duplicate Preserved keys field heading'
);

assert.match(
  siteSettingsSource,
  /list\.className = 'cs-extra-list';[\s\S]*list\.dataset\.field = '__extras';[\s\S]*extrasSection\.appendChild\(list\);/,
  'Other keys list should remain diff-addressable while rendering directly in the card'
);

assert.doesNotMatch(
  siteSettingsSource,
  /const behaviorSection = createSection\([\s\S]*const themeSection = createSection\([\s\S]*const assetsSection = createSection\(/,
  'Behavior, Theme, and Asset warnings should not render as separate top-level cards'
);

assert.match(
  siteSettingsSource,
  /field\.className = 'cs-field cs-single-grid-fieldset';/,
  'avatar and content root should share one compact fieldset instead of separate tall fields'
);

assert.match(
  siteSettingsSource,
  /row\.dataset\.field = item\.dataKey;/,
  'each compact identity path row should keep its own data-field for diff and reveal handling'
);

assert.doesNotMatch(
  siteSettingsSource,
  /input\.dataset\.autofocus = '';/,
  'compact identity path inputs should not steal section navigation focus and scroll gestures'
);

assert.match(
  siteSettingsSource,
  /tooltip\.className = 'cs-help-tooltip';[\s\S]*tooltipBubble\.setAttribute\('role', 'tooltip'\);/,
  'compact identity path labels should expose their help text through an accessible tooltip'
);

assert.match(
  siteSettingsSource,
  /label\.className = 'cs-single-grid-title';[\s\S]*labelCell\.appendChild\(label\);[\s\S]*labelCell\.appendChild\(tooltipWrap\);/,
  'compact single-grid rows should place help tooltip buttons between the label text and the control'
);

assert.match(
  siteSettingsSource,
  /\.cs-single-grid-label\{display:inline-flex;align-items:center;justify-content:flex-end;gap:\.35rem;/,
  'compact single-grid label cells should right-align the label and trailing help icon'
);

assert.match(
  siteSettingsSource,
  /\.cs-single-grid\{display:grid;grid-template-columns:var\(--cs-editor-single-label-width,88px\) minmax\(0,var\(--cs-editor-single-control-width\)\);column-gap:var\(--cs-editor-row-column-gap\);row-gap:var\(--cs-editor-row-gap\);align-items:center;justify-content:start\}[\s\S]*\.cs-single-grid-row\{display:grid;grid-template-columns:subgrid;grid-column:1\/-1;align-items:center;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0/,
  'compact identity path rows should use one measured label column and a fixed-width control column'
);

assert.match(
  siteSettingsSource,
  /\.cs-link-list\{display:flex;flex-direction:column;gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-link-row\{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0\}[\s\S]*\.cs-link-row \+ \.cs-link-row\{margin-top:0\}/,
  'profile link rows should use the same vertical row rhythm as localized grid rows'
);

assert.match(
  siteSettingsSource,
  /\.cs-link-row\{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0\}[\s\S]*\.cs-link-field--label\{flex:1 1 0\}[\s\S]*\.cs-link-field--href\{flex:3 1 0\}/,
  'profile link label and URL fields should keep a 1:3 width ratio with the same horizontal gap as identity grid columns'
);

assert.match(
  siteSettingsSource,
  /\.cs-config-subsection \+ \.cs-config-subsection\{border-top:1px solid color-mix\(in srgb,var\(--border\) 82%, transparent\);margin-top:\.35rem;padding-top:\.95rem\}/,
  'combined Site Configuration subsections should be separated by the same divider rhythm as large cards'
);

assert.match(
  siteSettingsSource,
  /\.cs-config-subsection-title\{margin:0;font-size:\.84rem;font-weight:600;color:color-mix\(in srgb,var\(--text\) 76%, transparent\)\}[\s\S]*\.cs-config-subsection-description\{margin:0;font-size:\.8rem;color:color-mix\(in srgb,var\(--muted\) 88%, transparent\);flex:1 1 auto;text-align:left\}/,
  'combined Site Configuration subsection headings should use the smaller field-heading rhythm instead of top-level section titles'
);

assert.match(
  siteSettingsSource,
  /\.cs-config-subsection\{display:flex;flex-direction:column;gap:\.4rem\}[\s\S]*\.cs-config-subsection > \.cs-config-subsection-head \+ \.cs-field\{padding-top:0\}/,
  'combined Site Configuration subsection content should sit as close to its heading as SEO subheading content'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createConfigSubsection[\s\S]*document\.createElement\('h4'\)/,
  'combined Site Configuration subsection labels should not render as document headings'
);

assert.match(
  siteSettingsSource,
  /\.cs-single-grid-control \.cs-input,.cs-single-grid-control \.cs-select\{width:100%;min-width:0\}/,
  'compact grid controls should fill the shared control column'
);

assert.match(
  siteSettingsSource,
  /\.cs-layout\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:1rem;align-items:start\}/,
  'site settings should use a single-column layout without the old section navigation rail'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.cs-nav|\.cs-mobile-section|cs-nav-button|cs-mobile-section-menu-item/,
  'site settings CSS should not keep removed section navigation selectors'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.editor-modal-body\.is-composer-overlay\{overflow:hidden\}/,
  'site settings overlay should keep the modal body scrollable so the section navigation remains visible'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.editor-modal-body\.is-composer-overlay[\s\S]*\.cs-layout\{height:100%;min-height:0\}/,
  'site settings overlay should not force a full-height composer layout that can collapse the left navigation'
);

assert.doesNotMatch(
  nativeThemeSource,
  /cs-nav-button|cs-mobile-section-nav-toggle|cs-mobile-section-menu-item/,
  'native theme button reset should not carry exceptions for removed site section navigation buttons'
);

assert.match(
  siteSettingsSource,
  /\.cs-help-tooltip-wrap:hover \.cs-help-tooltip-bubble,.cs-help-tooltip:focus-visible \+ \.cs-help-tooltip-bubble\{opacity:1;transform:translateY\(0\);pointer-events:auto\}/,
  'compact identity path help should appear as a hover/focus tooltip'
);

assert.match(
  editorSource,
  /\.editor-mobile-rail-toggle \{[\s\S]*display:none;[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-mobile-rail-toggle \{\s*display:inline-flex;/,
  'mobile layout should expose a file tree drawer toggle only on small screens'
);

assert.match(
  editorSource,
  /@media \(max-width: 640px\) \{[\s\S]*\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:0px;[\s\S]*\.editor-markdown-panel > \.toolbar \{[\s\S]*display:grid;[\s\S]*grid-template-columns:auto minmax\(0, 1fr\);[\s\S]*column-gap:\.5rem;[\s\S]*\.editor-markdown-panel > \.toolbar \.left-actions \{[\s\S]*grid-column:1;[\s\S]*flex:0 0 auto;[\s\S]*flex-wrap:nowrap;[\s\S]*\.editor-markdown-panel > \.toolbar \.right-actions \{[\s\S]*grid-column:2;[\s\S]*flex-wrap:wrap;[\s\S]*justify-content:flex-end;[\s\S]*justify-self:end;[\s\S]*max-width:100%;[\s\S]*\.editor-markdown-panel > \.toolbar \.editor-mobile-rail-toggle \{[\s\S]*flex:0 0 auto;[\s\S]*\.editor-markdown-panel > \.toolbar \.current-file \{[\s\S]*display:none;/,
  'extra narrow markdown toolbar should hide the breadcrumb and right-align editor controls beside the drawer toggle'
);

assert.match(
  editorSource,
  /--editor-article-main-width: 45rem;[\s\S]*--editor-properties-width: 20rem;[\s\S]*--editor-article-gap: 1\.5rem;[\s\S]*--editor-content-frame-max-width: calc\(var\(--editor-article-main-width\) \+ var\(--editor-article-gap\) \+ var\(--editor-properties-width\)\);[\s\S]*--editor-page-max-width: calc\(var\(--editor-rail-width, 340px\) \+ 6px \+ var\(--editor-content-frame-max-width\)\);/,
  'editor page width should be derived from the rail width plus the shared content frame width'
);

assert.match(
  editorSource,
  /\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:1rem;[\s\S]*padding:var\(--editor-content-pane-padding\);[\s\S]*\.toolbar \{[\s\S]*top:calc\(var\(--editor-content-pane-padding, 0px\) \* -1\);[\s\S]*background:color-mix\(in srgb, var\(--bg\) 96%, var\(--card\) 4%\);[\s\S]*\.editor-markdown-panel > \.toolbar \{[\s\S]*margin-top:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*\.editor-tools \{[\s\S]*top:calc\(var\(--editor-toolbar-offset, 0px\) - var\(--editor-content-pane-padding, 0px\)\);[\s\S]*background:color-mix\(in srgb, var\(--card\) 96%, var\(--text\) 4%\);[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:\.75rem;/,
  'markdown file toolbar should stick flush to the editor content pane top while preserving pane padding'
);

assert.match(
  composerPathToolsSource,
  /function buildDefaultEntryPath\(kind, key, lang\) \{[\s\S]*const baseFolder = normalizedKind === 'tabs' \? 'tab' : 'post';[\s\S]*normalizedKind === 'tabs'[\s\S]*`\$\{baseFolder\}\/\$\{safeKey\}\/v1\.0\.0`[\s\S]*`\$\{baseFolder\}\/v1\.0\.0`[\s\S]*return `\$\{folder\}\/\$\{filename\}`;/,
  'new article defaults should place the first markdown file inside a v1.0.0 directory'
);

assert.match(
  composerContentMutationsSource,
  /async function promptArticleVersionValue\(key, lang, entry, anchor\) \{[\s\S]*showComposerAddEntryPrompt\(anchor, \{[\s\S]*editor\.composer\.versionPrompt\.placeholder[\s\S]*if \(!isComposerVersionTag\(value\)\)[\s\S]*normalizeComposerVersionTag\(value\)[\s\S]*editor\.composer\.versionPrompt\.errorDuplicate/,
  'adding an article version should prompt for a v-prefixed version string before creating the new path'
);

assert.match(
  composerPathToolsSource,
  /function normalizeComposerVersionPaths\(value\) \{[\s\S]*Array\.isArray\(value\)[\s\S]*getIndexVariantLocation\(item\)[\s\S]*const normalized = getIndexVariantLocation\(value\);[\s\S]*return normalized \? \[normalized\] : \[\];[\s\S]*function collectComposerArticleVersions\(paths\) \{[\s\S]*const arr = normalizeComposerVersionPaths\(paths\);/,
  'legacy scalar and rich article language paths should be normalized before version dedupe runs'
);

assert.match(
  composerContentMutationsSource,
  /async function promptArticleVersionValue\(key, lang, entry, anchor\) \{[\s\S]*const arr = normalizeComposerVersionPaths\(entry && entry\[lang\]\);[\s\S]*const existingVersions = collectComposerArticleVersions\(arr\);/,
  'article version prompt should use normalized version paths from the extracted path tools'
);

assert.match(
  composerPathToolsSource,
  /function findExplicitArticleVersionSegmentIndex\(segments\) \{[\s\S]*if \(parts\.length < 3\) return -1;[\s\S]*parts\[0\][\s\S]*!== 'post'[\s\S]*const candidateIndex = parts\.length - 1;[\s\S]*if \(!isComposerVersionSegment\(parts\[candidateIndex\]\)\) return -1;[\s\S]*return candidateIndex;[\s\S]*function buildDefaultLanguagePathFromEntry\(kind, key, lang, entry\) \{[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*segments\[versionIndex\] = 'v1\.0\.0'[\s\S]*else segments\.push\('v1\.0\.0'\);/,
  'adding a new article language should rewrite only an explicit post/<key>/<version>/<file> version folder'
);

assert.match(
  composerPathToolsSource,
  /function buildArticleVersionPath\(key, lang, version, entry\) \{[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*segments\[versionIndex\] = normalizedVersion[\s\S]*else segments\.push\(normalizedVersion\);/,
  'adding a version should replace only an explicit post/<key>/<version>/<file> version folder'
);

assert.match(
  composerPathToolsSource,
  /function extractVersionFromPath\(relPath\) \{[\s\S]*const segments = normalized\.split\('\/'\);[\s\S]*segments\.pop\(\);[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*return versionIndex >= 0 \? String\(segments\[versionIndex\] \|\| ''\) : '';/,
  'article version extraction should ignore legacy root-style keys that only look like versions'
);

assert.doesNotMatch(
  source,
  /<input class="ci-path" type="text" placeholder="\$\{escapeHtml\(pathPlaceholder\)\}" value="\$\{escapeHtml\(p \|\| ''\)\}" \/>/,
  'article version cards should not render an editable path input in the composer list'
);

assert.doesNotMatch(
  source,
  /const input = document\.createElement\('input'\);[\s\S]*input\.setAttribute\('aria-label', treeText\('location', 'Location'\)\);[\s\S]*main\.appendChild\(label\);[\s\S]*main\.appendChild\(input\);/,
  'article language structure panel should not render an editable location input for version rows'
);

assert.doesNotMatch(
  source,
  /function renderPageLanguageStructure\(key, lang, value\) \{[\s\S]*const titleInput = document\.createElement\('input'\);[\s\S]*const pathInput = document\.createElement\('input'\);[\s\S]*controls\.appendChild\(titleInput\);[\s\S]*controls\.appendChild\(pathInput\);/,
  'page structure rows should not render editable title or location inputs'
);

assert.doesNotMatch(
  editorSource,
  /#mode-composer > \.editor-main > \.toolbar|<section class="box editor-main" style="grid-column: 1 \/ -1;">|class="site-settings-title"/,
  'site settings modal should not render a redundant inner card toolbar'
);

assert.match(
  editorSource,
  /class="editor-modal-header-actions" id="editorModalComposerActions" hidden[\s\S]*id="btnRefresh"[\s\S]*id="btnDiscard"/,
  'site settings refresh and discard controls should live in the modal header action slot'
);

assert.match(
  editorSource,
  /class="editor-modal-header-actions" id="editorModalUpdateActions" hidden[\s\S]*id="btnSystemSelect"[\s\S]*id="systemUpdateFileInput"/,
  'system update archive picker should live in the modal header action slot'
);

assert.match(
  editorSource,
  /class="editor-modal-header-actions" id="editorModalThemeActions" hidden[\s\S]*id="btnThemeImport"[\s\S]*id="themeImportFileInput"/,
  'theme ZIP picker should live in the modal header action slot'
);

assert.doesNotMatch(
  editorSource,
  /<section class="box updates-main"|class="updates-title"/,
  'system updates modal should not render a redundant inner card or duplicate content title'
);

assert.match(
  editorSource,
  /<header class="editor-modal-header">\s*<button type="button" class="btn-secondary editor-modal-close" id="editorModalClose"[\s\S]*<h2 id="editorModalTitle"><\/h2>/,
  'modal close button should sit to the left of the title for macOS-style chrome'
);

assert.match(
  editorSource,
  /\.editor-modal-header-actions \.btn-secondary,\s*\.editor-modal-header-actions \.btn-primary \{\s*height:2rem;\s*padding:0 \.65rem;[\s\S]*\.editor-modal-close \{[\s\S]*height:2rem;/,
  'modal header action buttons should match the close button height'
);

assert.match(
  editorSource,
  /\.editor-modal-layer\[hidden\],[\s\S]*\.editor-overlay-panel\[hidden\] \{[\s\S]*display:none !important;[\s\S]*\.editor-modal-body \{[\s\S]*overflow:auto;/,
  'modal layer should hide by default and scroll its own body when content is tall'
);

assert.doesNotMatch(
  siteSettingsSource,
  /cs-multiline-preview|preview = document\.createElement\('button'\)/,
  'collapsed multiline fields should not swap in a preview button'
);

assert.match(
  siteSettingsSource,
  /input\.addEventListener\('pointerdown', expandMultiline\);[\s\S]*input\.addEventListener\('focus', expandMultiline\);[\s\S]*input\.addEventListener\('focusin', expandMultiline\);/,
  'the textarea itself should expand from direct pointer and focus interaction'
);

assert.match(
  siteSettingsSource,
  /list\.querySelectorAll\('\.cs-localized-row--multiline\.is-expanded'\)\.forEach/,
  'expanding a multiline localized row should collapse other expanded rows in the same field'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-localized-row--multiline textarea\.cs-localized-textarea\{box-sizing:border-box;display:block;height:var\(--cs-editor-control-height\);min-height:var\(--cs-editor-control-height\);max-height:var\(--cs-editor-control-height\);padding-block:0;line-height:calc\(var\(--cs-editor-control-height\) - 2px\);resize:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:height \.18s ease/,
  'collapsed multiline textareas should keep the real control but use input-like vertical centering'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-localized-row--multiline\.is-expanded,.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\)\{align-items:start\}[\s\S]*\.cs-localized-row--multiline\.is-expanded \.cs-remove-lang,.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\) \.cs-remove-lang\{align-self:start\}[\s\S]*\.cs-localized-row--multiline\.is-expanded textarea\.cs-localized-textarea\{height:4\.6rem;min-height:4\.6rem;max-height:12rem;padding-block:\.3rem;line-height:1\.25;resize:vertical;overflow:auto;white-space:pre-wrap\}[\s\S]*\.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\) textarea\.cs-localized-textarea\{height:4\.6rem;min-height:4\.6rem;max-height:12rem;padding-block:\.3rem;line-height:1\.25;resize:vertical;overflow:auto;white-space:pre-wrap/,
  'focused multiline textareas should animate open without replacing the control'
);
