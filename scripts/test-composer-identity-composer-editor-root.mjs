import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerYamlActionsSource = readIdentitySource('../assets/js/composer-yaml-actions.js');

const composerYamlSiteFeatureSource = readIdentitySource('../assets/js/composer-yaml-site-feature.js');

const composerYamlPanelsControllerSource = readIdentitySource('../assets/js/composer-yaml-panels-controller.js');

const composerMarkdownFeatureSource = readIdentitySource('../assets/js/composer-markdown-feature.js');

const composerModeControllerSource = readIdentitySource('../assets/js/composer-mode-controller.js');

const composerUnsyncedSummarySource = readIdentitySource('../assets/js/composer-unsynced-summary.js');

const composerRuntimeStylesSource = readIdentitySource('../assets/js/composer-runtime-styles.js');

const composerBootstrapSource = readIdentitySource('../assets/js/composer-bootstrap.js');

const composerRuntimeSource = readIdentitySource('../assets/js/composer-runtime.js');

const composerSiteConfigSource = readIdentitySource('../assets/js/composer-site-config.js');

const composerMarkdownActionsUiSource = readIdentitySource('../assets/js/composer-markdown-actions-ui.js');

const composerMarkdownActionsSource = readIdentitySource('../assets/js/composer-markdown-actions.js');

const composerMarkdownSessionSource = readIdentitySource('../assets/js/composer-markdown-session.js');

const editorMainSource = readIdentitySource('../assets/js/editor-main.js');

const editorMainMetadataPanelSource = readIdentitySource('../assets/js/editor-main-metadata-panel.js');

const editorMainPreviewSessionSource = readIdentitySource('../assets/js/editor-main-preview-session.js');

const editorMainPreviewThemePickerSource = readIdentitySource('../assets/js/editor-main-preview-theme-picker.js');

const editorMainPreviewViewportSource = readIdentitySource('../assets/js/editor-main-preview-viewport.js');

const editorMainCurrentFileSessionSource = readIdentitySource('../assets/js/editor-main-current-file-session.js');

const editorMainCurrentFileViewSource = readIdentitySource('../assets/js/editor-main-current-file-view.js');

const editorMainSidebarSessionSource = readIdentitySource('../assets/js/editor-main-sidebar-session.js');

const editorMainToolbarSessionSource = readIdentitySource('../assets/js/editor-main-toolbar-session.js');

// composer-identity-body:start

assert.doesNotMatch(
  [
    composerSiteConfigSource,
    composerYamlSiteFeatureSource,
    composerYamlActionsSource,
    composerYamlPanelsControllerSource,
    composerMarkdownFeatureSource,
    composerMarkdownActionsUiSource,
    composerMarkdownActionsSource,
    composerMarkdownSessionSource
  ].join('\n'),
  /(?:documentRef|windowRef)\s*=\s*(?:document|window)\b|(?:documentRef|windowRef)\s*=\s*(?:options|opts)\.(?:documentRef|windowRef)\s*\|\|\s*\(typeof (?:document|window)|typeof (?:document|window|setTimeout|requestAnimationFrame|clearTimeout|CustomEvent)\b|\|\|\s*console\b|(^|[^.])\b(?:setTimeout|clearTimeout|requestAnimationFrame|CustomEvent)\s*\(/m,
  'YAML/Markdown composer controllers should receive browser refs, timers, dialogs, and logging through explicit runtime wiring instead of rediscovering globals'
);

assert.match(
  source,
  /let markdownSessionController = null;[\s\S]*let markdownWorkspaceController = null;[\s\S]*let modeController = null;[\s\S]*let unsyncedSummaryController = null;[\s\S]*createComposerMarkdownWorkspaceFacade\(\{[\s\S]*getController: \(\) => markdownWorkspaceController[\s\S]*const composerMarkdownFeature = createComposerMarkdownFeature\(\{[\s\S]*markdownSessionController = createComposerMarkdownSessionController\(\{[\s\S]*markdownWorkspaceController = createComposerMarkdownWorkspaceController\(\{[\s\S]*modeController = createComposerModeController\(\{[\s\S]*unsyncedSummaryController = createComposerUnsyncedSummaryController\(\{/,
  'composer should make the four genuinely late-bound controller references explicit and keep Markdown internals inside the feature boundary'
);

assert.doesNotMatch(
  composerMarkdownFeatureSource,
  /serviceLifecycle|composerServiceLifecycle|composerServices/,
  'Markdown feature should return its owned controllers directly instead of registering them in a generic service container'
);

assert.doesNotMatch(
  source,
  /composer-(?:app-services|controller-graph|lifecycle|root-contract|service-registry)\.js|composerServiceLifecycle|composerServices/,
  'composer should not retain the generic service-registry, controller-graph, duplicate-lifecycle, or root-contract ceremony'
);

assert.match(
  source,
  /function rawApplyMode\(mode, options = \{\}\) \{[\s\S]*modeController\.applyMode\(mode, options\);[\s\S]*function applyMode\(mode, options = \{\}\) \{\s*return composerActions\.applyMode\(mode, options\);[\s\S]*\}/,
  'composer applyMode should delegate through the action contract into the focused mode controller'
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
  /modeController = createComposerModeController\(\{[\s\S]*documentRef: composerDocument,[\s\S]*requestAnimationFrameRef: \(handler\) => editorRuntime\.requestFrame\(handler\),[\s\S]*alertRef: \(message\) => editorRuntime\.showAlert\(message\),[\s\S]*consoleRef: composerLogger[\s\S]*\}\);/,
  'composer should inject mode-controller frame scheduling, alerts, and logging through the runtime boundary'
);

assert.doesNotMatch(
  composerModeControllerSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\brequestAnimationFrame\s*\(/m,
  'mode controller should use injected frame scheduling instead of window fallback access'
);

assert.match(
  source,
  /from '\.\/composer-unsynced-summary\.js'/,
  'composer should cache-bust the extracted unsynced summary controller boundary'
);

assert.match(
  source,
  /function collectUnsyncedMarkdownEntries\(\) \{\s*return getUnsyncedSummaryController\(\)\.collectUnsyncedMarkdownEntries\(\);\s*\}[\s\S]*function computeUnsyncedSummary\(\) \{\s*return getUnsyncedSummaryController\(\)\.computeUnsyncedSummary\(\);\s*\}[\s\S]*function updateModeDirtyIndicators\(summaryEntries\) \{\s*getUnsyncedSummaryController\(\)\.updateModeDirtyIndicators\(summaryEntries\);\s*\}[\s\S]*function rawUpdateUnsyncedSummary\(options = \{\}\) \{\s*return getUnsyncedSummaryController\(\)\.updateUnsyncedSummary\(options\);\s*\}[\s\S]*function updateUnsyncedSummary\(options = \{\}\) \{\s*return composerActions\.updateUnsyncedSummary\(options\);[\s\S]*\}/,
  'composer unsynced summary helpers should route public refreshes through the action contract and keep raw updates on the extracted controller'
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
  /from '\.\/composer-bootstrap\.js'/,
  'composer should cache-bust the focused bootstrap boundary directly'
);

assert.match(
  composerBootstrapSource,
  /from '\.\/composer-runtime-styles\.js'/,
  'composer bootstrap should cache-bust the extracted runtime style boundary'
);

assert.doesNotMatch(
  source,
  /function injectComposerStyles|Minimal styles injected for composer behaviors|const css = `[\s\S]*\.ci-item/,
  'composer should not inline the runtime style sheet'
);

assert.match(
  composerBootstrapSource,
  /export function startComposerApp\(options = \{\}\)[\s\S]*composerActions\.assertReady\(\);[\s\S]*const bootstrapHandler = initializeComposerAppRef\(appOptions\);[\s\S]*injectRuntimeStyles\(\{ documentRef: appOptions\.documentRef \}\);/,
  'composer should delegate action readiness, DOM bootstrap, and runtime styles to the focused bootstrap owner'
);

assert.match(
  composerRuntimeStylesSource,
  /export function injectComposerRuntimeStyles\(options = \{\}\)[\s\S]*composer-runtime-styles[\s\S]*\.ci-item[\s\S]*\.cs-publish-transport-settings[\s\S]*@keyframes nsModalFadeIn/,
  'runtime style module should own composer list, site settings, publish transport, and modal animation styles'
);

assert.doesNotMatch(
  composerRuntimeStylesSource,
  /options\.documentRef\s*\|\|\s*\(typeof document|typeof document\b|(^|[^.])\bdocument\b/,
  'runtime style injection should consume the explicit runtime document ref without rediscovering document'
);

assert.match(
  composerRuntimeSource,
  /from '\.\/editor-app-runtime\.js'/,
  'composer runtime should cache-bust the shared editor app runtime boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-runtime\.js'/,
  'editor main should cache-bust the editor main runtime boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-metadata-panel\.js'/,
  'editor main should cache-bust the editor main metadata panel boundary'
);

assert.match(
  editorMainMetadataPanelSource,
  /from '\.\/editor-main-frontmatter-label-width\.js'/,
  'metadata panel should cache-bust the front matter label-width sync boundary'
);

assert.match(
  editorMainMetadataPanelSource,
  /from '\.\/editor-main-frontmatter-manager\.js'/,
  'metadata panel should cache-bust the article front matter manager boundary'
);

assert.match(
  editorMainMetadataPanelSource,
  /from '\.\/editor-main-tabs-metadata-manager\.js'/,
  'metadata panel should cache-bust the tabs metadata manager boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-preview-session\.js'/,
  'editor main should cache-bust the editor preview session boundary'
);

assert.match(
  editorMainPreviewSessionSource,
  /from '\.\/editor-main-preview-assets\.js'/,
  'editor preview session should cache-bust the preview asset override boundary'
);

assert.match(
  editorMainPreviewSessionSource,
  /from '\.\/editor-main-preview-theme-picker\.js'/,
  'editor preview session should cache-bust the preview theme picker boundary'
);

assert.match(
  editorMainPreviewThemePickerSource,
  /export function sanitizePreviewThemePack[\s\S]*let themeOverride = ''[\s\S]*fetchThemeList\('assets\/themes\/packs\.json'\)[\s\S]*fetchThemeList\('assets\/themes\/packs\.local\.json', true\)[\s\S]*select\.addEventListener\('change'[\s\S]*themeOverride = sanitizePreviewThemePack\(select\.value \|\| 'native'\)/,
  'editor preview theme picker should own theme sanitization, option loading, local overlays, and selector override state'
);

assert.doesNotMatch(
  editorMainPreviewSessionSource,
  /themeOverride|function sanitizePreviewThemePack|loadPreviewThemeOptions|assets\/themes\/packs\.local\.json/,
  'editor preview session should delegate theme selector state and pack loading to the preview theme picker boundary'
);

assert.match(
  editorMainPreviewSessionSource,
  /from '\.\/editor-main-preview-viewport\.js'/,
  'editor preview session should cache-bust the preview viewport boundary'
);

assert.match(
  editorMainPreviewViewportSource,
  /PREVIEW_RESIZE_HANDLE_SPACE = 36[\s\S]*export function createEditorMainPreviewViewport[\s\S]*onDocument\('pointermove'[\s\S]*onDocument\('pointerup'[\s\S]*onDocument\('pointercancel'[\s\S]*querySelectorAll\('\[data-preview-resize\]'\)/,
  'editor preview viewport should own resize handles, clamp rules, and document pointer cleanup'
);

assert.doesNotMatch(
  editorMainPreviewSessionSource,
  /PREVIEW_RESIZE_HANDLE_SPACE|pointermove|pointercancel/,
  'editor preview session should delegate viewport resize mechanics to the preview viewport boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-current-file-session\.js'/,
  'editor main should cache-bust the editor current-file session boundary'
);

assert.match(
  editorMainCurrentFileSessionSource,
  /from '\.\/editor-main-current-file-view\.js'/,
  'editor current-file session should cache-bust the current-file view boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-sidebar-session\.js'/,
  'editor main should cache-bust the editor sidebar session boundary'
);

assert.match(
  editorMainSidebarSessionSource,
  /from '\.\/editor-main-sidebar-file-tree\.js'/,
  'editor sidebar session should cache-bust the sidebar file tree boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-toolbar-session\.js'/,
  'editor main should cache-bust the editor toolbar session boundary'
);

assert.match(
  editorMainToolbarSessionSource,
  /from '\.\/editor-main-toolbar-text-actions\.js'/,
  'editor toolbar session should cache-bust the toolbar text action boundary'
);

assert.match(
  editorMainToolbarSessionSource,
  /from '\.\/editor-main-toolbar-card-picker\.js'/,
  'editor toolbar session should cache-bust the toolbar card picker boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-image-session\.js'/,
  'editor main should cache-bust the editor image session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-link-card-context\.js'/,
  'editor main should cache-bust the editor link-card context boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-workspace-session\.js'/,
  'editor main should cache-bust the editor workspace session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-blocks-session\.js'/,
  'editor main should cache-bust the editor blocks session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-document-session\.js'/,
  'editor main should cache-bust the editor document session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-content-service\.js'/,
  'editor main should cache-bust the editor content service boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-file-context-service\.js'/,
  'editor main should cache-bust the editor file context service boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-language-session\.js'/,
  'editor main should cache-bust the editor language session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-scroll-session\.js'/,
  'editor main should cache-bust the editor scroll session boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-shell-service\.js'/,
  'editor main should cache-bust the editor shell service boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-main-service-registry\.js'/,
  'editor main should cache-bust the editor service registry boundary'
);

assert.match(
  editorMainSource,
  /from '\.\/editor-app-kernel\.js'/,
  'editor main should use the shared app lifecycle kernel'
);

assert.match(
  editorMainSource,
  /export function createEditorMainFeatures\(\) \{[\s\S]*name: 'editorMain\.metadataPanel'[\s\S]*provides: \['metadataPanel'\][\s\S]*context\.metadataPanel = context\.appServices\.setMetadataPanel\(createEditorMainMetadataPanel\(\{[\s\S]*runtime: context\.runtime,[\s\S]*documentRef: context\.documentRef,[\s\S]*translate: t,[\s\S]*getCurrentLang,[\s\S]*normalizeLangKey,[\s\S]*getContentRoot: context\.getContentRoot,[\s\S]*onChange: context\.appServices\.notifyDocumentChange[\s\S]*\}\)\);/,
  'editor main should compose front matter and tabs metadata through the metadata panel session'
);

assert.doesNotMatch(
  editorMainSource,
  /const\s+editorMainRuntime\s*=\s*createEditorMainRuntime\(\)/,
  'editor main should not create a module-level runtime singleton'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.linkCardContext'[\s\S]*provides: \['linkCardContext'\][\s\S]*context\.linkCardContext = createEditorMainLinkCardContext\(\{[\s\S]*getCurrentLang,[\s\S]*normalizeLangKey,[\s\S]*getContentRoot: context\.getContentRoot,[\s\S]*fetch: \(url, options\) => context\.runtime\.fetchContent\(url, options\),[\s\S]*translate: t,[\s\S]*makeHref: \(loc\) => withLangParam\(`\?id=\$\{encodeURIComponent\(loc\)\}`\)[\s\S]*\}\);/,
  'editor main should compose link-card index state through the explicit link-card context service'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.shellService'[\s\S]*provides: \['shellService'\][\s\S]*context\.shellService = createEditorMainShellService\(\{[\s\S]*runtime: context\.runtime,[\s\S]*editor: context\.editor,[\s\S]*textarea: context\.dom\.textarea[\s\S]*\}\);/,
  'editor main should compose layout refresh and editor toasts through the shell service'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.workspaceSession'[\s\S]*requires: \[[^\]]*'shellService'[\s\S]*provides: \['workspaceSession'\][\s\S]*context\.workspaceSession = context\.appServices\.setWorkspaceSession\(createEditorMainWorkspaceSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*documentRef: context\.documentRef,[\s\S]*forceMarkdownWrap: FORCE_MARKDOWN_WRAP,[\s\S]*editor: context\.editor,[\s\S]*textarea: context\.dom\.textarea,[\s\S]*getPreviewSession: context\.appServices\.getPreviewSession,[\s\S]*getBlocksEditor: context\.appServices\.getBlocksEditor,[\s\S]*syncBlocksFromSource: context\.appServices\.syncBlocksFromSource,[\s\S]*requestLayout: context\.shellService\.requestLayout[\s\S]*name: 'editorMain\.workspaceBinding'[\s\S]*requires: \['workspaceSession'\][\s\S]*context\.workspaceSession\.initialize\(\);/,
  'editor main should compose workspace view, wrap, preview button, and empty-state controls through the workspace session'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.documentSession'[\s\S]*requires: \[[^\]]*'metadataPanel'[\s\S]*'workspaceSession'[\s\S]*'contentService'[\s\S]*provides: \['documentSession'\][\s\S]*context\.documentSession = context\.appServices\.setDocumentSession\(createEditorMainDocumentSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*editor: context\.editor,[\s\S]*textarea: context\.dom\.textarea,[\s\S]*metadataPanel: context\.metadataPanel,[\s\S]*workspaceSession: context\.workspaceSession,[\s\S]*getPreviewSession: context\.appServices\.getPreviewSession,[\s\S]*getBlocksSession: context\.appServices\.getBlocksSession,[\s\S]*requestLayout: context\.shellService\.requestLayout,[\s\S]*setBaseDir: context\.contentService\.setBaseDir,[\s\S]*setCurrentFileLabel: context\.fileContextService\.setCurrentFileLabel[\s\S]*\}\)\);/,
  'editor main should compose document value, input, change listeners, and primary-editor API through the document session'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.contentService'[\s\S]*requires: \[[^\]]*'linkCardContext'[\s\S]*'fileContextService'[\s\S]*provides: \['contentService'\][\s\S]*context\.contentService = context\.appServices\.setContentService\(createEditorMainContentService\(\{[\s\S]*runtime: context\.runtime,[\s\S]*getContentRoot: context\.getContentRoot,[\s\S]*fetch: \(url, options\) => context\.runtime\.fetchContent\(url, options\),[\s\S]*linkCardContext: context\.linkCardContext,[\s\S]*getPreviewSession: context\.appServices\.getPreviewSession,[\s\S]*getDocumentSession: context\.appServices\.getDocumentSession,[\s\S]*getWorkspaceSession: context\.appServices\.getWorkspaceSession,[\s\S]*setCurrentFileLabel: context\.fileContextService\.setCurrentFileLabel,[\s\S]*warn: \(\.\.\.args\) => context\.runtime\.warn\(\.\.\.args\),[\s\S]*alert: \(message\) => context\.runtime\.showAlert\(message\)[\s\S]*\}\)\);/,
  'editor main should compose site config, content loading, and open-markdown orchestration through the content service'
);

assert.doesNotMatch(
  editorMainSource,
  /consoleRef:\s*console|console\.(?:warn|error)/,
  'editor main should route logger behavior through the editor runtime instead of passing or calling console directly'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.fileContextService'[\s\S]*provides: \['fileContextService'\][\s\S]*context\.fileContextService = createEditorMainFileContextService\(\{[\s\S]*getCurrentFileSession: context\.appServices\.getCurrentFileSession,[\s\S]*getMetadataPanel: context\.appServices\.getMetadataPanel,[\s\S]*getPreviewSession: context\.appServices\.getPreviewSession,[\s\S]*getDocumentSession: context\.appServices\.getDocumentSession[\s\S]*\}\);/,
  'editor main should compose current-file cross-session fan-out through the file context service'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.languageSession'[\s\S]*requires: \[[^\]]*'toolbarSession'[\s\S]*'currentFileSession'[\s\S]*'blocksSession'[\s\S]*provides: \['languageSession'\][\s\S]*context\.languageSession = createEditorMainLanguageSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*getToolbarSession: context\.appServices\.getToolbarSession,[\s\S]*getCurrentFileSession: context\.appServices\.getCurrentFileSession,[\s\S]*getBlocksSession: context\.appServices\.getBlocksSession,[\s\S]*getMetadataPanel: context\.appServices\.getMetadataPanel[\s\S]*name: 'editorMain\.languageBinding'[\s\S]*requires: \[[^\]]*'toolbarBinding'[\s\S]*context\.languageSession\.bind\(\);/,
  'editor main should compose language-event fan-out through the language session'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.scrollSession'[\s\S]*provides: \['scrollSession'\][\s\S]*context\.scrollSession = createEditorMainScrollSession\(\{ runtime: context\.runtime \}\);[\s\S]*name: 'editorMain\.scrollBinding'[\s\S]*requires: \[[^\]]*'defaultWorkspaceView'[\s\S]*context\.scrollSession\.bind\(\);/,
  'editor main should compose back-to-top scroll UI through the scroll session'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.currentFileSession'[\s\S]*requires: \[[^\]]*'documentSession'[\s\S]*provides: \['currentFileSession'\][\s\S]*context\.currentFileSession = context\.appServices\.setCurrentFileSession\(createEditorMainCurrentFileSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*documentRef: context\.documentRef,[\s\S]*translate: t,[\s\S]*getCurrentLang,[\s\S]*normalizeLangKey,[\s\S]*inferCurrentFileSource: context\.fileContextService\.inferCurrentFileSource,[\s\S]*applyEditorEmptyState: context\.workspaceSession\.applyEditorEmptyState,[\s\S]*onRendered: context\.fileContextService\.handleCurrentFileRendered[\s\S]*name: 'editorMain\.currentFileRender'[\s\S]*requires: \[[^\]]*'previewBinding'[\s\S]*'linkCardToolbarSync'[\s\S]*context\.fileContextService\.renderCurrentFile\(\);/,
  'editor main should compose current file state and header rendering through the current-file session'
);

assert.match(
  editorMainCurrentFileSessionSource,
  /export function createEditorMainCurrentFileSession\(options = \{\}\) \{[\s\S]*const inferSource = typeof options\.inferCurrentFileSource === 'function'[\s\S]*let currentFileInfo = \{ path: '', source: '', breadcrumb: \[\], status: null, dirty: false, draft: null, draftState: '', loaded: false \};[\s\S]*const currentFileView = createEditorMainCurrentFileView\(\{[\s\S]*runtime,[\s\S]*documentRef,[\s\S]*translate: options\.translate,[\s\S]*getCurrentLang: options\.getCurrentLang,[\s\S]*normalizeLangKey: options\.normalizeLangKey,[\s\S]*applyEditorEmptyState: options\.applyEditorEmptyState,[\s\S]*onRendered: options\.onRendered[\s\S]*\}\);[\s\S]*const normalizeStatusPayload = \(value\) => \{[\s\S]*const normalizeCurrentFilePayload = \(input\) => \{[\s\S]*const render = \(\) => \{[\s\S]*currentFileView\.render\(currentFileInfo\);/,
  'current-file session should own payload normalization and compose header rendering through the view boundary'
);

assert.match(
  editorMainCurrentFileViewSource,
  /export function createEditorMainCurrentFileView\(options = \{\}\) \{[\s\S]*const formatRelativeTime = \(ms\) => \{[\s\S]*const describeStatusLabel = \(status\) => \{[\s\S]*const renderCurrentFileBreadcrumb = \(items, fullPath\) => \{[\s\S]*<span class="cf-breadcrumb-item cf-breadcrumb-item-static\$\{currentClass\}"\$\{ariaCurrent\}>[\s\S]*const bindCurrentFileBreadcrumbEvents = \(el\) => \{[\s\S]*const render = \(info = latestInfo\) => \{/,
  'current-file view should own status/draft formatting, static breadcrumb markup, DOM binding, and render attributes'
);

assert.doesNotMatch(
  editorMainCurrentFileSessionSource,
  /let currentFileElRef|const formatRelativeTime = \(ms\)|const describeStatusLabel = \(status\)|const renderCurrentFileBreadcrumb = \(items, fullPath\)|const bindCurrentFileBreadcrumbEvents = \(el\)|getPlainText|escapeHtml/,
  'current-file session should not own header DOM rendering, draft label formatting, or breadcrumb event internals'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.previewSession'[\s\S]*requires: \[[^\]]*'linkCardContext'[\s\S]*'fileContextService'[\s\S]*provides: \['previewSession'\][\s\S]*context\.previewSession = context\.appServices\.setPreviewSession\(createEditorMainPreviewSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*documentRef: context\.documentRef,[\s\S]*getContentRoot: context\.getContentRoot,[\s\S]*getEditorValue: context\.appServices\.getEditorValue,[\s\S]*getCurrentFileInfo: context\.fileContextService\.getCurrentFileInfo,[\s\S]*getSiteConfig: context\.appServices\.getSiteConfig,[\s\S]*getPostsIndex: \(\) => context\.linkCardContext\.getPostsIndex\(\),[\s\S]*getPostsByLocationTitle: \(\) => context\.linkCardContext\.getPostsByLocationTitle\(\),[\s\S]*isLinkCardReady: \(\) => context\.linkCardContext\.isReady\(\),[\s\S]*getAllowedLocations: \(\) => context\.linkCardContext\.getAllowedLocations\(\),[\s\S]*getLocationAliases: \(\) => context\.linkCardContext\.getLocationAliases\(\),[\s\S]*warn: \(\.\.\.args\) => context\.runtime\.warn\(\.\.\.args\)[\s\S]*fetch: \(url, options\) => context\.runtime\.fetchContent\(url, options\)[\s\S]*name: 'editorMain\.previewBinding'[\s\S]*requires: \[[^\]]*'workspaceBinding'[\s\S]*context\.previewSession\.bind\(\);/,
  'editor main should compose preview overlay, iframe messaging, and asset-preview state through the preview session'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.sidebarSession'[\s\S]*provides: \['sidebarSession'\][\s\S]*context\.sidebarSession = createEditorMainSidebarSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*documentRef: context\.documentRef,[\s\S]*normalizeLangKey,[\s\S]*bindCurrentFileElement: context\.fileContextService\.bindCurrentFileElement,[\s\S]*loadSiteConfig: context\.contentService\.loadSiteConfig,[\s\S]*loadIndexData: context\.contentService\.loadIndexData,[\s\S]*loadTabsConfig: context\.contentService\.loadTabsConfig,[\s\S]*onSiteConfigLoaded: context\.contentService\.handleSiteConfigLoaded,[\s\S]*onIndexLoaded: context\.contentService\.handleIndexLoaded,[\s\S]*onOpenMarkdown: context\.contentService\.openMarkdown,[\s\S]*onWarn: context\.contentService\.warn,[\s\S]*alert: context\.contentService\.alert[\s\S]*name: 'editorMain\.sidebarStartup'[\s\S]*requires: \[[^\]]*'scrollBinding'[\s\S]*context\.sidebarSession\.initialize\(\);/,
  'editor main should compose file sidebar rendering through the sidebar session and route loading/open actions through the content service'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.toolbarSession'[\s\S]*requires: \[[^\]]*'documentSession'[\s\S]*'linkCardContext'[\s\S]*provides: \['toolbarSession'\][\s\S]*context\.toolbarSession = context\.appServices\.setToolbarSession\(createEditorMainToolbarSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*documentRef: context\.documentRef,[\s\S]*translate: t,[\s\S]*getEditorTextarea: context\.documentSession\.getEditorTextarea,[\s\S]*editorToolbarEl: context\.dom\.editorToolbarEl,[\s\S]*cardButton: context\.dom\.cardButton,[\s\S]*cardPopover: context\.dom\.cardPopover,[\s\S]*cardSearchInput: context\.dom\.cardSearchInput,[\s\S]*cardListEl: context\.dom\.cardListEl,[\s\S]*cardEmptyEl: context\.dom\.cardEmptyEl,[\s\S]*getCardEntries: \(\) => context\.linkCardContext\.getCardEntries\(\)[\s\S]*name: 'editorMain\.toolbarBinding'[\s\S]*requires: \[[^\]]*'blocksBinding'[\s\S]*context\.toolbarSession\.bind\(\);/,
  'editor main should compose markdown toolbar and article-card picker through the toolbar session'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.imageSession'[\s\S]*requires: \[[^\]]*'documentSession'[\s\S]*'fileContextService'[\s\S]*'shellService'[\s\S]*provides: \['imageSession'\][\s\S]*context\.imageSession = context\.appServices\.setImageSession\(createEditorMainImageSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*translate: t,[\s\S]*imageButton: context\.dom\.imageButton,[\s\S]*imageInput: context\.dom\.imageInput,[\s\S]*getCurrentMarkdownPath: context\.fileContextService\.getCurrentMarkdownPath,[\s\S]*getContentRoot: context\.getContentRoot,[\s\S]*getEditorTextarea: context\.documentSession\.getEditorTextarea,[\s\S]*getEditorBody: context\.documentSession\.getEditorBody,[\s\S]*buildMarkdown: context\.documentSession\.buildMarkdown,[\s\S]*setValue: context\.documentSession\.setValue,[\s\S]*getBlocksEditor: context\.appServices\.getBlocksEditor,[\s\S]*error: \(\.\.\.args\) => context\.runtime\.error\(\.\.\.args\)[\s\S]*emitToast: context\.shellService\.emitToast[\s\S]*\}\)\);/,
  'editor main should compose image picker, upload, drop, and block image actions through the image session'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.blocksSession'[\s\S]*requires: \[[^\]]*'documentSession'[\s\S]*'previewSession'[\s\S]*'imageSession'[\s\S]*'linkCardContext'[\s\S]*provides: \['blocksSession'\][\s\S]*context\.blocksSession = context\.appServices\.setBlocksSession\(createEditorMainBlocksSession\(\{[\s\S]*runtime: context\.runtime,[\s\S]*root: context\.dom\.blocksWrap,[\s\S]*translate: t,[\s\S]*getContentRoot: context\.getContentRoot,[\s\S]*getEditorBody: context\.documentSession\.getEditorBody,[\s\S]*onBodyChange: context\.documentSession\.setBodyFromBlocks,[\s\S]*getCurrentMarkdownPath: context\.fileContextService\.getCurrentMarkdownPath,[\s\S]*getSiteConfig: context\.appServices\.getSiteConfig,[\s\S]*getPreviewSession: context\.appServices\.getPreviewSession,[\s\S]*getImageSession: context\.appServices\.getImageSession,[\s\S]*linkCardContext: context\.linkCardContext,[\s\S]*resolveImageSrc: context\.resolveEditorImageSrc[\s\S]*name: 'editorMain\.blocksBinding'[\s\S]*requires: \[[^\]]*'contentBinding'[\s\S]*context\.blocksSession\.initialize\(\);/,
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

// composer-identity-body:end
