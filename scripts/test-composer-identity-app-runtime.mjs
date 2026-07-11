import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerPublishSyncFeatureSource = readIdentitySource('../assets/js/composer-publish-sync-feature.js');

const composerPublishStateServiceSource = readIdentitySource('../assets/js/composer-publish-state-service.js');

const composerYamlActionsSource = readIdentitySource('../assets/js/composer-yaml-actions.js');

const composerYamlSiteFeatureSource = readIdentitySource('../assets/js/composer-yaml-site-feature.js');

const composerContentStagingSource = readIdentitySource('../assets/js/composer-content-staging.js');

const composerIndexPublishMetadataSource = readIdentitySource('../assets/js/composer-index-publish-metadata.js');

const composerSeoStagingSource = readIdentitySource('../assets/js/composer-seo-staging.js');

const composerMarkdownFeatureSource = readIdentitySource('../assets/js/composer-markdown-feature.js');

const composerEditorWorkspaceFeatureSource = readIdentitySource('../assets/js/composer-editor-workspace-feature.js');

const composerSystemThemeBridgeSource = readIdentitySource('../assets/js/composer-system-theme-bridge.js');

const composerBootstrapSource = readIdentitySource('../assets/js/composer-bootstrap.js');

const composerRuntimeSource = readIdentitySource('../assets/js/composer-runtime.js');

const composerUiMotionSource = readIdentitySource('../assets/js/composer-ui-motion.js');

const composerSiteConfigSource = readIdentitySource('../assets/js/composer-site-config.js');

const editorContentTreeControllerSource = readIdentitySource('../assets/js/editor-content-tree-controller.js');

const composerMarkdownLoaderSource = readIdentitySource('../assets/js/composer-markdown-loader.js');

const editorAppRuntimeSource = readIdentitySource('../assets/js/editor-app-runtime.js');

const editorBootSource = readIdentitySource('../assets/js/editor-boot.js');

const editorBootRuntimeSource = readIdentitySource('../assets/js/editor-boot-runtime.js');

const editorMainSource = readIdentitySource('../assets/js/editor-main.js');

const editorMainScrollSessionSource = readIdentitySource('../assets/js/editor-main-scroll-session.js');

const editorMainShellServiceSource = readIdentitySource('../assets/js/editor-main-shell-service.js');

const editorMainServiceRegistrySource = readIdentitySource('../assets/js/editor-main-service-registry.js');

// composer-identity-body:start

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
  /from '\.\/composer-runtime\.js'/,
  'composer should cache-bust the explicit composer runtime boundary'
);

assert.match(
  source,
  /export function createComposerController\(editorRuntime = createComposerRuntime\(\)\) \{[\s\S]*const composerDocument = editorRuntime\.documentRef;\s*const composerWindow = editorRuntime\.windowRef;[\s\S]*const composerStateStore = editorRuntime\.createStateStore\(\{[\s\S]*kinds: \['index', 'tabs', 'site'\],[\s\S]*defaultKind: 'index'/,
  'composer should create an explicit runtime and route root document/window refs through it'
);

assert.doesNotMatch(
  source,
  /const\s+editorRuntime\s*=\s*createComposerRuntime\(\)/,
  'composer should not create a module-level runtime singleton'
);

assert.match(
  source,
  /const composerLogger = \{[\s\S]*warn: \(\.\.\.args\) => editorRuntime\.warn\(\.\.\.args\),[\s\S]*error: \(\.\.\.args\) => editorRuntime\.error\(\.\.\.args\)[\s\S]*\};/,
  'composer should expose a narrow runtime-backed logger object instead of passing raw console to app services'
);

assert.doesNotMatch(
  source,
  /consoleRef:\s*console|console\.(?:warn|error)/,
  'composer should route logger behavior through the runtime-backed composer logger instead of passing or calling console directly'
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

assert.doesNotMatch(
  source,
  /let allowEditorStatePersist|let hasEditorStateV3Snapshot|let gitHubCommitInFlight|const expandedEditorTreeNodeIds = new Set/,
  'composer app runtime state should not live in module-level mutable variables'
);

assert.match(
  source,
  /function getStateSlice\(kind\) \{\s*return composerStateStore\.getStateSlice\(kind\);\s*\}[\s\S]*function setStateSlice\(kind, value\) \{\s*composerStateStore\.setStateSlice\(kind, value\);\s*\}/,
  'composer state access should be routed through the explicit runtime state store'
);

assert.match(
  source,
  /editorRuntime\.initializeEditorSessionState\(\{[\s\S]*editorSessionStateStore,[\s\S]*editorStateVersion: EDITOR_STATE_VERSION[\s\S]*\}\);\s*const expandedEditorTreeNodeIds = editorRuntime\.getExpandedEditorTreeNodeIds\(\);/,
  'composer should initialize editor session state through the explicit composer runtime'
);

assert.match(
  `${source}\n${composerEditorWorkspaceFeatureSource}\n${composerBootstrapSource}`,
  /getAllowEditorStatePersist: \(\) => editorRuntime\.getAllowEditorStatePersist\(\)[\s\S]*getAllowEditorStatePersist: \(\) => editorRuntime\.getAllowEditorStatePersist\(\)[\s\S]*setAllowEditorStatePersist: \(value\) =>\s*typeof editorRuntime\.setAllowEditorStatePersist === 'function'[\s\S]*editorRuntime\.setAllowEditorStatePersist\(value\)/,
  'composer should route editor-state persistence gates through the explicit composer runtime'
);

assert.match(
  editorAppRuntimeSource,
  /export function createEditorStateStore\([\s\S]*getStateSlice\(kind\)[\s\S]*setStateSlice\(kind, value\)[\s\S]*getRemoteBaseline\(kind\)[\s\S]*setRemoteBaseline\(kind, value\)[\s\S]*getDiff\(kind\)[\s\S]*setDiff\(kind, value\)[\s\S]*export function createEditorAppRuntime/,
  'editor app runtime should expose explicit state, baseline, diff, storage, event, and global-access boundaries'
);

assert.match(
  editorAppRuntimeSource,
  /export function createEditorAppRuntime\(\{[\s\S]*windowRef = null,[\s\S]*documentRef = null,[\s\S]*storage = undefined[\s\S]*export function createBrowserEditorAppRuntime\(options = \{\}\)[\s\S]*createEditorAppRuntime\(\{/,
  'editor app runtime should keep the core constructor explicit and isolate browser global capture behind a named runtime factory'
);

assert.match(
  editorAppRuntimeSource,
  /function onDocumentReady\(handler\)[\s\S]*documentRef\.readyState[\s\S]*DOMContentLoaded[\s\S]*onDocumentReady,/,
  'editor app runtime should own DOM-ready state checks and DOMContentLoaded listener registration'
);

assert.match(
  editorAppRuntimeSource,
  /function getDocumentLang\(\)[\s\S]*documentRef && documentRef\.documentElement[\s\S]*getDocumentLang,/,
  'editor app runtime should own document language reads for browser-facing editor services'
);

assert.doesNotMatch(
  editorAppRuntimeSource,
  /typeof (?:CustomEvent|requestAnimationFrame|cancelAnimationFrame|setTimeout|clearTimeout|getComputedStyle)\b|(^|[^.])\b(?:requestAnimationFrame|cancelAnimationFrame|setTimeout|clearTimeout|getComputedStyle)\s*\(/m,
  'editor app runtime browser facade should use captured refs instead of ambient browser global fallbacks'
);

assert.match(
  editorBootSource,
  /from '\.\/editor-boot-runtime\.js'[\s\S]*export function createEditorBootController\(bootRuntime = createEditorBootRuntime\(\)\)[\s\S]*function start\(\) \{[\s\S]*bootRuntime\.setPopulateLanguageSelect\(populateLanguageSelect\)[\s\S]*bootRuntime\.onLanguageControlMounted\(populateLanguageSelect\)[\s\S]*bootRuntime\.onI18nBundleLoaded\(handleI18nBundleLoaded\)[\s\S]*bootRuntime\.onDocumentReady\(\(\) => \{ bootstrap\(\)\.catch\(\(\) => \{\}\); \}\)[\s\S]*createEditorBootController\(\)\.start\(\);/,
  'editor boot should initialize through an explicit editor boot controller boundary'
);

assert.doesNotMatch(
  editorBootSource,
  /const\s+bootRuntime\s*=\s*createEditorBootRuntime\(\)/,
  'editor boot should not create a module-level boot runtime singleton'
);

assert.match(
  editorBootRuntimeSource,
  /from '\.\/editor-app-runtime\.js'[\s\S]*createBrowserEditorAppRuntime\(options\)[\s\S]*onLanguageControlMounted[\s\S]*onI18nBundleLoaded[\s\S]*emitLanguageApplied[\s\S]*setPopulateLanguageSelect[\s\S]*setSoftResetLanguage/,
  'editor boot runtime should wrap language boot globals and events through the shared app runtime facade'
);

assert.doesNotMatch(
  editorBootSource,
  /\b(?:window|document|CustomEvent)\b|DOMContentLoaded|(?:window|document)\.addEventListener\(/,
  'editor boot should route document/window globals, custom events, and DOM-ready behavior through the boot runtime'
);

assert.match(
  composerRuntimeSource,
  /export function createComposerRuntime\(options = \{\}\)[\s\S]*createBrowserEditorAppRuntime\(options\)[\s\S]*function onDocumentReady\(handler\)[\s\S]*function getLocation\(\)[\s\S]*function getLocationOrigin\(\)[\s\S]*function getLocationHref\(\)[\s\S]*function getDocumentLang\(\)[\s\S]*function getContentRoot\(\)[\s\S]*function setContentRoot\(root\)[\s\S]*function getSiteRepo\(\)[\s\S]*function setSiteRepo\(repo\)[\s\S]*function emitLanguagePoolChanged\(\)[\s\S]*function emitEditorLanguageControlMounted\(\)[\s\S]*function emitSiteConfigChange\(siteConfig\)[\s\S]*function populateEditorLanguageSelect\(\)[\s\S]*function requestFrame\(handler\)[\s\S]*function setTimer\(handler, delay = 0\)[\s\S]*function fetchContent\(url, options\)[\s\S]*function showAlert\(message\)[\s\S]*function openWindow\(href = '', target = '_blank', features\)[\s\S]*function warn\(\.\.\.args\)[\s\S]*function error\(\.\.\.args\)[\s\S]*function confirmAction\(message\)[\s\S]*function getPerformance\(\)[\s\S]*function getCss\(\)[\s\S]*function matchesMedia\(query\)[\s\S]*function getViewportWidth\(\)[\s\S]*function getWindowScroll\(\)[\s\S]*function scrollWindowToTop\(behavior = 'smooth'\)[\s\S]*function getComputedStyle\(element\)[\s\S]*function getResizeObserver\(\)[\s\S]*async function writeClipboardText\(text\)/,
  'composer runtime should own composer-specific DOM ready, content-root, site-repo, app-event, browser scheduling, network, dialog, clipboard, language-control, and browser-global boundaries'
);

assert.doesNotMatch(
  composerRuntimeSource,
  /typeof (?:navigator|fetch|alert|confirm|console|open|location|performance|CSS|ResizeObserver|globalThis)\b|runtime\.windowRef\b|runtime\.browser\.isSecureContext\(|documentRef\.(?:body|createElement|execCommand)|globalThis\.(?:getComputedStyle|location)|windowRef\.(?:fetch|alert|confirm|console|open|location|isSecureContext|performance|CSS|getComputedStyle|ResizeObserver)/,
  'composer runtime should delegate browser global lookup to the shared editor app runtime facade'
);

assert.doesNotMatch(
  composerRuntimeSource,
  /const documentRef = runtime\.documentRef|documentRef\.readyState|DOMContentLoaded|runtime\.events\.onDocument\('DOMContentLoaded'/,
  'composer runtime should delegate DOM-ready state and listener details to the shared editor app runtime facade'
);

assert.doesNotMatch(
  source,
  /window\.__press_site_repo|window\.__press_primary_editor|document\.dispatchEvent\(new CustomEvent\(LANGUAGE_POOL_CHANGED_EVENT\)|localStorage\.getItem\(scopedEditorStorageKey|localStorage\.setItem\(scopedEditorStorageKey|window\.setTimeout|window\.clearTimeout|fetch\(url, options\)|alert\(message\)|window\.confirm\(message\)|navigator\.clipboard|window\.isSecureContext|document\.execCommand\('copy'\)|composerDocument\.documentElement|documentElement\.lang|typeof performance !== 'undefined'|typeof CSS !== 'undefined'/,
  'composer should route browser globals, app events, scoped persisted UI state, timers, fetch, dialogs, clipboard, document language, and browser global objects through the runtime boundary'
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
  composerEditorWorkspaceFeatureSource,
  /editorFileTreeUi = createEditorFileTreeUi\(\{[\s\S]*documentRef,[\s\S]*windowRef,[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\)[\s\S]*\}\);/,
  'editor workspace feature should inject editor file tree scheduling through the runtime boundary'
);

assert.match(
  composerEditorWorkspaceFeatureSource,
  /editorStructurePanelUi = createEditorStructurePanelUi\(\{[\s\S]*documentRef,[\s\S]*windowRef,[\s\S]*consoleRef,[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*alertRef: \(message\) => editorRuntime\.showAlert\(message\),[\s\S]*populateEditorLanguageSelect: \(\) => editorRuntime\.populateEditorLanguageSelect\(\),[\s\S]*emitLanguageControlMounted: \(\) => editorRuntime\.emitEditorLanguageControlMounted\(\)[\s\S]*\}\);/,
  'editor workspace feature should inject editor structure panel frames, alerts, and language-control events through the runtime boundary'
);

assert.match(
  source,
  /from '\.\/composer-system-theme-bridge\.js'/,
  'composer should cache-bust the extracted system/theme bridge boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/system-updates\.js'|from '\.\/theme-manager\.js'|initSystemUpdates|getSystemUpdateCommitFiles|clearSystemUpdateState|initThemeManager|getThemeManagerCommitFiles|clearThemeManagerState/,
  'composer should not import or initialize system/theme managers directly'
);

assert.match(
  `${source}\n${composerBootstrapSource}`,
  /const composerSystemThemeBridge = createComposerSystemThemeBridge\(\{[\s\S]*consoleRef: composerLogger,[\s\S]*localStorageRef: editorRuntime\.storage\.native,[\s\S]*getStateSlice,[\s\S]*setStateSlice,[\s\S]*notifyComposerChange,[\s\S]*updateUnsyncedSummary: \(\) => composerActions\.refreshSystemThemeState\(\{ preserveStructure: true \}\)[\s\S]*refreshEditorContentTree: \(options\) => composerActions\.refreshEditorContentTree\(options\)[\s\S]*\}\);[\s\S]*registerExternalStagingProviders: \(registry\) => composerSystemThemeBridge\.registerStagingProviders\(registry\)[\s\S]*composerSystemThemeBridge\.hasSystemUpdateEntries\(\)[\s\S]*composerSystemThemeBridge\.hasThemeEntries\(\)[\s\S]*composerSystemThemeBridge\.createLifecycleFeature\(\)/,
  'composer should delegate system/theme staging, status, and initialization through bridge lifecycle callbacks'
);

assert.match(
  composerSystemThemeBridgeSource,
  /import \{ createSystemUpdatesController \} from '\.\/system-updates\.js'[\s\S]*import \{ createThemeManagerController \} from '\.\/theme-manager\.js'[\s\S]*export function createComposerSystemThemeBridge\(options = \{\}\)[\s\S]*const localStorageRef = options\.localStorageRef \|\| null;[\s\S]*const themeManager = options\.themeManagerController \|\| createThemeManagerController\(\);[\s\S]*const getStagedThemeCommitFiles = typeof options\.getStagedThemeCommitFiles === 'function'[\s\S]*const systemUpdates = options\.systemUpdatesController \|\| createSystemUpdatesController\(\{[\s\S]*localStorageRef,[\s\S]*getStagedThemeCommitFiles,[\s\S]*getCurrentThemePack[\s\S]*\}\);[\s\S]*function registerStagingProviders\(stagingRegistry\)[\s\S]*id: 'system-updates'[\s\S]*systemUpdates\.clear\(\{ keepStatus: false \}\)[\s\S]*id: 'themes'[\s\S]*themeManager\.clear\(\{ keepStatus: false, keepRegistryCache: true, keepSiteThemeFallback: true \}\)[\s\S]*function init\(\)[\s\S]*systemUpdates\.init\(\{ onStateChange: refreshUnsyncedSummary \}\)[\s\S]*themeManager\.init\(\{[\s\S]*getCurrentThemePack,[\s\S]*setSiteThemePack[\s\S]*function createLifecycleFeature\(\)[\s\S]*name: 'composer\.systemThemeBridge'/,
  'system/theme bridge should own explicit manager controllers, staging providers, and lifecycle initialization'
);

assert.doesNotMatch(
  composerSystemThemeBridgeSource,
  /\|\|\s*console\b/,
  'system/theme bridge should receive logging through explicit composer wiring'
);

assert.match(
  composerPublishSyncFeatureSource,
  /from '\.\/composer-publish-state-service\.js'/,
  'publish/sync feature should own the extracted publish state service boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/composer-staging\.js'|from '\.\/composer-index-publish-metadata\.js'|from '\.\/composer-content-staging\.js'|from '\.\/composer-seo-staging\.js'|from '\.\/composer-post-commit-state\.js'|createStagingRegistry\(|createIndexPublishMetadataEnricher\(|createContentCommitStagingProvider\(|createSeoStagingProvider\(|createPostCommitStateApplier\(|stagingRegistry/,
  'composer should not own publish staging registry, staging providers, or post-commit state applier wiring'
);

assert.match(
  source,
  /const composerPublishSyncFeature = createComposerPublishSyncFeature\(\{[\s\S]*getStateSlice,[\s\S]*getRemoteBaseline: \(\) => composerStateStore\.getRemoteBaseline\(\),[\s\S]*fetchContent: \(url, options\) => editorRuntime\.fetchContent\(url, options\),[\s\S]*getLocationOrigin: \(\) => editorRuntime\.getLocationOrigin\(\),[\s\S]*getDocumentLang: \(\) => editorRuntime\.getDocumentLang\(\),[\s\S]*setRemoteBaselineSlice: \(kind, value\) => composerStateStore\.setRemoteBaseline\(kind, value\),[\s\S]*applyComposerEffectiveSiteConfig: \(site\) => applyComposerEffectiveSiteConfig\(site\),[\s\S]*registerExternalStagingProviders: \(registry\) => composerSystemThemeBridge\.registerStagingProviders\(registry\)[\s\S]*\}\);[\s\S]*function gatherCommitPayload\(options = \{\}\) \{[\s\S]*composerPublishSyncFeature\.gatherCommitPayload\(options\);[\s\S]*function applyLocalPostCommitState\(files = \[\]\) \{[\s\S]*composerActions\.applyLocalPostCommitState\(files\);[\s\S]*function rawApplyLocalPostCommitState\(files = \[\]\) \{[\s\S]*composerPublishSyncFeature\.rawApplyLocalPostCommitState\(files\);[\s\S]*function getTrackedPublishContentRoot\(\) \{[\s\S]*composerPublishSyncFeature\.getTrackedPublishContentRoot\(\);/,
  'composer should reduce publish persistence to explicit publish/sync feature and action-contract callbacks'
);

assert.match(
  composerPublishSyncFeatureSource,
  /createComposerPublishStateService\(\{[\s\S]*prepareIndexState: options\.prepareIndexState,[\s\S]*prepareTabsState: options\.prepareTabsState,[\s\S]*prepareSiteState: options\.prepareSiteState,[\s\S]*deepClone: options\.deepClone/,
  'publish/sync feature should forward all YAML normalizers into post-commit publish state'
);

assert.match(
  composerPublishStateServiceSource,
  /from '\.\/composer-staging\.js'[\s\S]*from '\.\/composer-index-publish-metadata\.js'[\s\S]*from '\.\/composer-content-staging\.js'[\s\S]*from '\.\/composer-seo-staging\.js'[\s\S]*from '\.\/composer-post-commit-state\.js'/,
  'publish state service should cache-bust the staging and post-commit modules it composes'
);

assert.match(
  composerPublishStateServiceSource,
  /export function createComposerPublishStateService\(options = \{\}\)[\s\S]*const stagingRegistry = createStagingRegistryRef\(\)[\s\S]*const indexPublishMetadata = createIndexPublishMetadataEnricherRef\([\s\S]*const contentCommitStagingProvider = createContentCommitStagingProviderRef\([\s\S]*const seoStagingProvider = createSeoStagingProviderRef\([\s\S]*const postCommitStateApplier = createPostCommitStateApplierRef\(\{[\s\S]*applyComposerEffectiveSiteConfig: options\.applyComposerEffectiveSiteConfig[\s\S]*stagingRegistry\.registerStagingProvider\(\{[\s\S]*id: 'content'[\s\S]*options\.registerExternalStagingProviders\(stagingRegistry\)[\s\S]*id: 'seo'[\s\S]*function getStagingSummaryEntries\(context = \{\}\)[\s\S]*function applyLocalPostCommitState\(files = \[\]\)[\s\S]*return \{[\s\S]*gatherCommitPayload,[\s\S]*getTrackedPublishContentRoot,[\s\S]*getStagingSummaryEntries,[\s\S]*applyLocalPostCommitState[\s\S]*\};/,
  'publish state service should own staging assembly, state application, and expose only app-level publish state operations'
);

assert.match(
  composerPublishStateServiceSource,
  /createSeoStagingProviderRef\(\{[\s\S]*fetchImpl: typeof options\.fetchContent === 'function' \? options\.fetchContent : null,[\s\S]*getLocationOrigin: options\.getLocationOrigin \|\| \(\(\) => ''\),[\s\S]*getDocumentLang: options\.getDocumentLang \|\| \(\(\) => ''\),[\s\S]*consoleRef: options\.consoleRef \|\| null[\s\S]*\}\);/,
  'publish state service should pass SEO staging browser effects through explicit app-service callbacks'
);

assert.match(
  composerPublishStateServiceSource,
  /createIndexPublishMetadataEnricherRef\(\{[\s\S]*fetchImpl: typeof options\.fetchContent === 'function' \? options\.fetchContent : null[\s\S]*\}\);[\s\S]*createContentCommitStagingProviderRef\(\{[\s\S]*fetchImpl: typeof options\.fetchContent === 'function' \? options\.fetchContent : null,[\s\S]*consoleRef: options\.consoleRef \|\| null[\s\S]*\}\);/,
  'publish state service should pass content/index staging fetch and logging through explicit app-service callbacks'
);

assert.doesNotMatch(
  composerSeoStagingSource,
  /typeof (?:window|document|fetch)\b|fetchImpl\s*=\s*fetch\b|console\.error|window\.location|document\.documentElement/,
  'SEO staging should receive location, document language, fetch, and logging through explicit callbacks'
);

assert.doesNotMatch(
  [composerIndexPublishMetadataSource, composerContentStagingSource].join('\n'),
  /typeof fetch\b|fetchImpl\s*=\s*fetch\b|:\s*fetch\b|console\.warn/,
  'content and index staging should receive fetch and logging through explicit publish state callbacks'
);

assert.match(
  source,
  /const composerStartupOptions = \{[\s\S]*composerSystemThemeBridge,[\s\S]*function start\(\) \{[\s\S]*assertComposerControllersReady\(\);[\s\S]*return startComposerApp\(composerStartupOptions\);/,
  'composer should pass explicit controller wiring into the focused DOM/bootstrap owner'
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
  /export function startComposerApp\(options = \{\}\)[\s\S]*composerActions\.assertReady\(\);[\s\S]*export function bindComposerMarkdownToolbar\([\s\S]*btnPushMarkdown[\s\S]*export function bindComposerWorkspaceUi\([\s\S]*mountEditorSystemPanels[\s\S]*export async function loadInitialComposerState\([\s\S]*ensureSiteRepo\(\)[\s\S]*fetchTrackedSiteConfig[\s\S]*export function assembleComposerWorkspace\([\s\S]*getLocation\(\)[\s\S]*restoreDynamicEditorState[\s\S]*export async function initializeComposerOnDomReady\(options = \{\}\)[\s\S]*createComposerBootstrapFeatures\(\{[\s\S]*setActiveComposerState[\s\S]*\}\)\.forEach\(\(feature\) => kernel\.registerFeature\(feature\)\);[\s\S]*export function createComposerBootstrapFeatures\(options = \{\}\)[\s\S]*extraFeatures[\s\S]*return features\.concat\(Array\.isArray\(extraFeatures\) \? extraFeatures : \[\]\);[\s\S]*export function initializeComposerApp\(options = \{\}\)[\s\S]*const onDocumentReady =\s*typeof options\.onDocumentReady === 'function'[\s\S]*onDocumentReady\(handler\)/,
  'bootstrap module should own Markdown toolbar binding, initial config loading, workspace assembly, and extension features through runtime callbacks'
);

assert.match(
  composerBootstrapSource,
  /from '\.\/editor-app-kernel\.js'[\s\S]*export function startComposerApp\(options = \{\}\)[\s\S]*composerActions\.assertReady\(\);[\s\S]*initializeComposerAppRef\(appOptions\);[\s\S]*injectRuntimeStyles\(\{ documentRef: appOptions\.documentRef \}\);[\s\S]*export async function initializeComposerOnDomReady\(options = \{\}\)[\s\S]*createEditorAppKernel\(/,
  'composer bootstrap should check action readiness and then use the shared app kernel for DOM workspace phases'
);

assert.doesNotMatch(
  composerBootstrapSource,
  /documentRef\.addEventListener\('DOMContentLoaded'|(^|[^.])\bsetTimeout\s*\(/m,
  'bootstrap module should not rediscover DOM ready or timers outside injected runtime callbacks'
);

assert.doesNotMatch(
  composerBootstrapSource,
  /consoleRef\s*=\s*console|setTimeoutRef\s*=\s*\([^)]*handler/,
  'bootstrap module should receive logging and timer effects through explicit composer runtime wiring'
);

assert.match(
  source,
  /applyComposerEffectiveSiteConfig: \(site\) => applyComposerEffectiveSiteConfig\(site\)/,
  'composer should pass site config application lazily to avoid top-level bootstrap TDZ during module evaluation'
);

assert.match(
  source,
  /from '\.\/composer-ui-motion\.js'/,
  'composer should cache-bust the extracted UI motion boundary'
);

assert.doesNotMatch(
  source,
  /function syncSiteEditorSingleLabelWidth\(root\)|function animateComposerInlineVisibility\(element, show|function slideToggle\(el, toOpen\)|const __activeAnims = new WeakMap\(\)|const composerListTransitions = new WeakMap\(\)/,
  'composer should not own low-level UI motion and measurement helpers'
);

assert.match(
  composerUiMotionSource,
  /export function createComposerUiMotionController\(options = \{\}\)[\s\S]*syncSiteEditorSingleLabelWidth: \(root\) => syncSiteEditorSingleLabelWidth\(runtime, root\),[\s\S]*animateComposerInlineVisibility: \(element, show, methodOptions = \{\}\) => animateComposerInlineVisibility\(runtime, element, show, methodOptions\),[\s\S]*animateComposerListTransition: \(list, previousRect, methodOptions = \{\}\) => animateComposerListTransition\(runtime, list, previousRect, methodOptions\),[\s\S]*animateComposerOrderMainReset: \(host, previousRect, methodOptions = \{\}\) => animateComposerOrderMainReset\(runtime, host, previousRect, methodOptions\),[\s\S]*slideToggle: \(el, toOpen\) => slideToggle\(runtime, el, toOpen\),[\s\S]*function getComposerSlideDurations\(\)/,
  'UI motion module should expose an explicit runtime-bound controller for label measurement, animations, slide toggles, and shared durations'
);

assert.match(
  composerUiMotionSource,
  /function createComposerUiMotionState\(\) \{[\s\S]*reduceMotionQuery: null,[\s\S]*inlineVisibilityAnimations: new WeakMap\(\),[\s\S]*inlineVisibilityFallbacks: new WeakMap\(\),[\s\S]*listTransitions: new WeakMap\(\),[\s\S]*orderMainTransitions: new WeakMap\(\),[\s\S]*siteScrollAnimationId: null,[\s\S]*siteScrollCleanup: null,[\s\S]*activeSlideAnimations: new WeakMap\(\)[\s\S]*state: createComposerUiMotionState\(\)/,
  'UI motion runtime should own animation state registries instead of module-level singletons'
);

assert.doesNotMatch(
  composerUiMotionSource,
  /let composerUiMotionRuntime|configureComposerUiMotionRuntime|let composerReduceMotionQuery|const composerInlineVisibilityAnimations|const composerInlineVisibilityFallbacks|const composerListTransitions|const composerOrderMainTransitions|let composerSiteScrollAnimationId|let composerSiteScrollCleanup|const activeSlideAnimations/,
  'UI motion state registries should stay inside the configured runtime state'
);

assert.match(
  source,
  /const composerUiMotion = createComposerUiMotionController\(\{[\s\S]*documentRef: composerDocument,[\s\S]*windowRef: composerWindow,[\s\S]*requestAnimationFrameRef: \(handler\) => editorRuntime\.requestFrame\(handler\),[\s\S]*cancelAnimationFrameRef: \(id\) => editorRuntime\.cancelFrame\(id\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\),[\s\S]*matchesMedia: \(query\) => editorRuntime\.matchesMedia\(query\),[\s\S]*getComputedStyleRef: \(element\) => editorRuntime\.getComputedStyle\(element\),[\s\S]*performanceRef: editorRuntime\.getPerformance\(\),[\s\S]*ResizeObserverRef: editorRuntime\.getResizeObserver\(\)[\s\S]*\}\);/,
  'composer should create an explicit UI motion controller through the app runtime boundary'
);

assert.doesNotMatch(
  source,
  /configureComposerUiMotionRuntime/,
  'composer should not configure UI motion through a module-level singleton'
);

assert.doesNotMatch(
  composerUiMotionSource,
  /typeof (?:window|document|requestAnimationFrame|cancelAnimationFrame|setTimeout|clearTimeout|performance|ResizeObserver)\b|(^|[^.])\b(?:requestAnimationFrame|cancelAnimationFrame|setTimeout|clearTimeout|getComputedStyle)\s*\(/m,
  'UI motion module should consume browser effects through configured runtime adapters instead of ambient globals'
);

assert.doesNotMatch(
  composerUiMotionSource,
  /windowRef\s*&&\s*(?:typeof windowRef\.(?:requestAnimationFrame|cancelAnimationFrame|setTimeout|clearTimeout|matchMedia|getComputedStyle|ResizeObserver)\b|windowRef\.performance)/,
  'UI motion module should not derive browser effect adapters from windowRef'
);

assert.match(
  source,
  /from '\.\/composer-site-config\.js'/,
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

assert.doesNotMatch(
  composerSiteConfigSource,
  /\bwindowRef\b|CustomEvent|dispatchEvent|__press_content_root|__press_site_repo/,
  'site config module should not retain window/global fallback paths for effective config updates'
);

assert.match(
  source,
  /createComposerSiteConfigController\(\{[\s\S]*runtime: editorRuntime,[\s\S]*deepClone[\s\S]*\}\);/,
  'composer should provide site config runtime callbacks explicitly'
);

assert.match(
  composerEditorWorkspaceFeatureSource,
  /from '\.\/editor-content-tree-controller\.js'/,
  'editor workspace feature should own the extracted editor content tree controller boundary'
);

assert.match(
  composerYamlSiteFeatureSource,
  /from '\.\/composer-yaml-actions\.js'/,
  'YAML/site feature should own the extracted YAML action boundary'
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

assert.match(
  source,
  /composerYamlFeature\.createRuntime\(\{[\s\S]*confirmRef: \(message\) => editorRuntime\.confirmAction\(message\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\)[\s\S]*\}\);/,
  'composer should inject YAML action dialogs and timers through the feature runtime boundary'
);

assert.doesNotMatch(
  composerYamlActionsSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\bsetTimeout\s*\(/m,
  'YAML action controller should use injected confirmation and timer adapters'
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
  composerEditorWorkspaceFeatureSource,
  /let scheduleEditorStatePersistRef = scheduleEditorStatePersistExternal;[\s\S]*let persistSystemTreeExpandedStateRef = persistSystemTreeExpandedStateExternal;[\s\S]*createEditorContentTreeController\(\{[\s\S]*scheduleEditorStatePersist: \(\) => scheduleEditorStatePersistRef\(\),[\s\S]*persistSystemTreeExpandedState: \(\) => persistSystemTreeExpandedStateRef\(\),[\s\S]*const editorShell = createComposerEditorShell\(\{[\s\S]*scheduleEditorStatePersist: scheduleEditorStatePersistFromShell,[\s\S]*scheduleEditorStatePersistRef = scheduleEditorStatePersistFromShell;[\s\S]*persistSystemTreeExpandedStateRef = persistSystemTreeExpandedStateFromShell;/,
  'editor workspace feature should late-bind tree-controller persistence hooks to the editor shell lifecycle callbacks'
);

assert.match(
  composerMarkdownFeatureSource,
  /from '\.\/composer-markdown-loader\.js'/,
  'Markdown feature should cache-bust the extracted Markdown loader boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/composer-markdown-loader\.js'/,
  'composer root should not import the Markdown loader directly after the Markdown feature extraction'
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

assert.doesNotMatch(
  composerMarkdownLoaderSource,
  /typeof fetch\b|(^|[^.])\bfetch\s*\(/m,
  'Markdown loader should receive fetch through explicit runtime wiring'
);

assert.match(
  composerMarkdownFeatureSource,
  /from '\.\/composer-markdown-actions-ui\.js'/,
  'Markdown feature should cache-bust the extracted Markdown actions UI boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/composer-markdown-actions-ui\.js'/,
  'composer root should not import the Markdown actions UI directly after the Markdown feature extraction'
);

assert.doesNotMatch(
  source,
  /MARKDOWN_PUSH_LABEL_KEYS|MARKDOWN_DISCARD_LABEL_KEY|MARKDOWN_SAVE_LABEL_KEY|btn\.setAttribute\('data-protected', protectedState \? 'true' : 'false'\)|const hasLocalChanges = !!\(active && active\.path && \(hasDirty \|\| hasDraftContent\)\);/,
  'Markdown action button labels, tooltips, and DOM state rendering should stay outside the main composer shell'
);

// composer-identity-body:end
