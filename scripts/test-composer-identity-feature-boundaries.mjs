import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerSystemPanelSource = readIdentitySource('../assets/js/composer-system-panel.js');

const composerYamlSiteFeatureSource = readIdentitySource('../assets/js/composer-yaml-site-feature.js');

const composerSiteSettingsUiSource = readIdentitySource('../assets/js/composer-site-settings-ui.js');

const composerSiteSettingsConfigGridsSource = readIdentitySource('../assets/js/composer-site-settings-config-grids.js');

const composerSiteSettingsControlsSource = readIdentitySource('../assets/js/composer-site-settings-controls.js');

const composerSiteSettingsLanguageMenuSource = readIdentitySource(
  '../assets/js/composer-site-settings-language-menu.js'
);

const composerSiteSettingsLinkListSource = readIdentitySource('../assets/js/composer-site-settings-link-list.js');

const composerSiteSettingsLocalizedFieldsSource = readIdentitySource(
  '../assets/js/composer-site-settings-localized-fields.js'
);

const composerSiteSettingsRepoSectionSource = readIdentitySource('../assets/js/composer-site-settings-repo-section.js');

const composerSiteSettingsSchemaSource = readIdentitySource('../assets/js/composer-site-settings-schema.js');

const composerSiteSettingsSectionNavSource = readIdentitySource('../assets/js/composer-site-settings-section-nav.js');

const composerSiteSettingsSingleGridsSource = readIdentitySource('../assets/js/composer-site-settings-single-grids.js');

const composerYamlPanelsControllerSource = readIdentitySource('../assets/js/composer-yaml-panels-controller.js');

const composerMarkdownAssetsSource = readIdentitySource('../assets/js/composer-markdown-assets.js');

const composerMarkdownFeatureSource = readIdentitySource('../assets/js/composer-markdown-feature.js');

const composerEditorWorkspaceFeatureSource = readIdentitySource('../assets/js/composer-editor-workspace-feature.js');

const composerEditorShellSource = readIdentitySource('../assets/js/composer-editor-shell.js');

const composerPathToolsSource = readIdentitySource('../assets/js/composer-path-tools.js');

const composerContentMutationsSource = readIdentitySource('../assets/js/composer-content-mutations.js');

const composerSetupVerifierSource = readIdentitySource('../assets/js/composer-setup-verifier.js');

const composerFilePanelControllerSource = readIdentitySource('../assets/js/composer-file-panel-controller.js');

const composerEditorDetailPanelControllerSource = readIdentitySource(
  '../assets/js/composer-editor-detail-panel-controller.js'
);

const composerSiteSettingsRuntimeSource = [
  composerSiteSettingsUiSource,
  composerSiteSettingsConfigGridsSource,
  composerSiteSettingsControlsSource,
  composerSiteSettingsLanguageMenuSource,
  composerSiteSettingsLinkListSource,
  composerSiteSettingsLocalizedFieldsSource,
  composerSiteSettingsRepoSectionSource,
  composerSiteSettingsSchemaSource,
  composerSiteSettingsSectionNavSource,
  composerSiteSettingsSingleGridsSource
].join('\n');

// composer-identity-body:start

assert.match(
  composerSiteSettingsLanguageMenuSource,
  /export function createComposerSiteSettingsLanguageMenu\(options = \{\}\)[\s\S]*const collectSupportedLangs = \(\) =>[\s\S]*const refreshMenu = \(\) =>[\s\S]*function openMenu\(\)[\s\S]*function onButtonClick\(\)[\s\S]*const cleanup = \(\) =>/,
  'Site Settings language-menu boundary should own add-language choices, open/close behavior, and cleanup'
);

assert.match(
  composerSiteSettingsLinkListSource,
  /export function createComposerSiteSettingsLinkList\(options = \{\}\)[\s\S]*const createLinkListField = \(section, key, config = \{\}\) =>[\s\S]*const renderRowsAndRefreshDiff = \(\) =>[\s\S]*const createDragHandle = \(index\) =>[\s\S]*function renderRows\(\)/,
  'Site Settings link-list boundary should own profile link rows, diff refresh, and drag handles'
);

assert.match(
  composerSiteSettingsSchemaSource,
  /export function createComposerSiteSettingsSchema\(options = \{\}\)[\s\S]*sections: \{[\s\S]*repo: section\('repo'\)[\s\S]*configuration: section\('configuration'\)[\s\S]*fields: \{[\s\S]*identityPaths: \[[\s\S]*field\('avatar', 'avatar', 'avatarHelp'[\s\S]*field\('contentRoot', 'contentRoot', 'contentRootHelp'[\s\S]*behavior: \{[\s\S]*defaultLanguage: field\('defaultLanguage'/,
  'Site Settings schema boundary should own stable section labels and simple field metadata'
);

assert.match(
  composerSiteSettingsSectionNavSource,
  /export function createComposerSiteSettingsSectionNav\(options = \{\}\)[\s\S]*const resolveSiteScrollContainer = \(\) =>[\s\S]*function setActiveSection\(sectionId, methodOptions = \{\}\)[\s\S]*function scheduleScrollSync\(\)[\s\S]*const revealField = \(fieldKey, methodOptions = \{\}\) =>/,
  'Site Settings section-nav boundary should own scroll container resolution, active state, scroll sync, and field reveal'
);

assert.doesNotMatch(
  composerSiteSettingsUiSource,
  /const resolveSiteScrollContainer = \(\)|function setActiveSection\(sectionId|function scheduleScrollSync\(\)|const revealField = \(fieldKey/,
  'Site Settings UI should not re-own section navigation state after extraction'
);

assert.doesNotMatch(
  composerSiteSettingsUiSource,
  /t\('editor\.composer\.site\.sections\.(?:repo|identity|seo|configuration|behavior|publicChrome|theme|comments|assets|extras)\.(?:title|description)'\)|t\('editor\.composer\.site\.fields\.(?:avatar|contentRoot|resourceURL|defaultLanguage|contentOutdatedDays|pageSize|landingTab|cardCoverFallback|errorOverlay|featureSearch|featureEditorEntry|featureVisitorThemeControls|featureLanguageSwitcher|featureAllPosts|featureFooterNav|featureProfileLinks|featureTags|featureToc|featurePostMeta|featureComments)(?:Help)?'\)/,
  'Site Settings UI should not keep stable section and simple field label metadata inline'
);

assert.match(
  source,
  /composerYamlFeature\.createRuntime\(\{[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*cancelAnimationFrameRef: \(id\) => editorRuntime\.cancelFrame\(id\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\),[\s\S]*getComputedStyleRef: \(element\) => editorRuntime\.getComputedStyle\(element\),[\s\S]*performanceRef: editorRuntime\.getPerformance\(\),[\s\S]*cssRef: editorRuntime\.getCss\(\),[\s\S]*fetchContent: \(url, options\) => editorRuntime\.fetchContent\(url, options\),/,
  'composer should inject Site Settings frame, timer, fetch, style, performance, and CSS access through the feature runtime boundary'
);

assert.doesNotMatch(
  composerSiteSettingsRuntimeSource,
  /options\.(?:documentRef|windowRef|performanceRef|cssRef)\s*\|\|\s*\(typeof globalThis|const\s+(?:document|window|performance|CSS)\s*=|typeof (?:document|window|requestAnimationFrame|cancelAnimationFrame|setTimeout|clearTimeout|fetch|CSS|performance)\b|(^|[^.])\b(?:requestAnimationFrame|cancelAnimationFrame|setTimeout|clearTimeout|fetch)\s*\(/m,
  'Site Settings UI should receive browser refs, frames, timers, style, CSS, and fetch through explicit runtime wiring instead of rediscovering globals'
);

assert.match(
  source,
  /from '\.\/composer-markdown-feature\.js'/,
  'composer should cache-bust the extracted Markdown feature boundary'
);

assert.doesNotMatch(
  source,
  /from '\.\/composer-markdown-assets\.js'/,
  'composer root should not import the Markdown asset manager directly after the Markdown feature extraction'
);

assert.match(
  composerMarkdownFeatureSource,
  /from '\.\/composer-markdown-assets\.js'/,
  'Markdown feature should cache-bust the extracted Markdown asset manager boundary'
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
  composerMarkdownFeatureSource,
  /const markdownAssetManager = createComposerMarkdownAssetManager\(\{[\s\S]*emitMarkdownAssetPreview: \(detail\) => \{[\s\S]*editorRuntime\.events\.emitWindow\('press-editor-asset-preview', detail\);[\s\S]*addWindowListener: \(type, handler, listenerOptions\) =>\s*editorRuntime\.events && typeof editorRuntime\.events\.onWindow === 'function'[\s\S]*fetchContent,[\s\S]*\}\);/,
  'Markdown feature should inject Markdown asset preview events, editor asset listeners, and repository fetches through the runtime boundary'
);

assert.doesNotMatch(
  composerMarkdownAssetsSource,
  /options\.windowRef|windowRef\.|\bwindowRef\b|typeof (?:window|CustomEvent|fetch)\b|new CustomEvent|(^|[^.])\bfetch\s*\(/m,
  'Markdown asset manager should receive browser refs, asset preview/events, and fetch through explicit runtime wiring'
);

assert.match(
  source,
  /const \{[\s\S]*ensureMarkdownAssetBucket,[\s\S]*textWithFallback,[\s\S]*collectCurrentRepositoryMarkdownAssetReferences[\s\S]*\} = composerMarkdownFeature;/,
  'composer should import remaining Markdown adapter helpers from the feature port instead of stale local bindings'
);

assert.match(
  composerMarkdownAssetsSource,
  /return \{[\s\S]*ensureMarkdownAssetBucket,[\s\S]*textWithFallback,[\s\S]*collectCurrentRepositoryMarkdownAssetReferences[\s\S]*\};/,
  'Markdown asset manager should expose the adapter helpers still used by composer wiring'
);

assert.match(
  source,
  /from '\.\/composer-editor-workspace-feature\.js'/,
  'composer should cache-bust the editor workspace feature boundary'
);

assert.match(
  composerEditorWorkspaceFeatureSource,
  /from '\.\/composer-editor-shell\.js'/,
  'editor workspace feature should own the extracted editor shell boundary'
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
  composerEditorWorkspaceFeatureSource,
  /const editorShell = createComposerEditorShell\(\{[\s\S]*requestAnimationFrameRef: \(handler\) => editorRuntime\.requestFrame\(handler\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\),[\s\S]*addWindowListener: \(type, handler, listenerOptions\) => editorRuntime\.events\.onWindow\(type, handler, listenerOptions\),[\s\S]*addDocumentListener: \(type, handler, listenerOptions\) => editorRuntime\.events\.onDocument\(type, handler, listenerOptions\),[\s\S]*matchesMedia: \(query\) => editorRuntime\.matchesMedia\(query\),[\s\S]*getViewportWidth: \(\) => editorRuntime\.getViewportWidth\(\),[\s\S]*scrollWindowToTop: \(behavior\) => editorRuntime\.scrollWindowToTop\(behavior\),[\s\S]*getDocumentVisibilityState: \(\) => \(documentRef \? documentRef\.visibilityState : ''\),[\s\S]*\}\);/,
  'editor workspace feature should inject editor shell timers, frames, events, media, viewport, scroll, and visibility through the runtime boundary'
);

assert.doesNotMatch(
  [composerEditorShellSource, composerSystemPanelSource].join('\n'),
  /\bwindowRef\b|typeof window\b|typeof (?:requestAnimationFrame|setTimeout|clearTimeout)\b|(^|[^.])\b(?:setTimeout|clearTimeout|requestAnimationFrame)\s*\(|documentRef\.(?:addEventListener|removeEventListener)\(/m,
  'editor shell and system panel should receive window, scheduling, media, viewport, scroll, and document listener effects through explicit runtime adapters'
);

assert.match(
  source,
  /from '\.\/composer-path-tools\.js'/,
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

assert.doesNotMatch(
  composerPathToolsSource,
  /\bwindowRef\b|options\.windowRef|__press_content_root/,
  'composer path tools should receive content root through callbacks instead of window globals'
);

assert.match(
  source,
  /createComposerPathTools\(\{[\s\S]*getContentRoot: \(\) => editorRuntime\.getContentRoot\(\),[\s\S]*preferredLangOrder: PREFERRED_LANG_ORDER/,
  'composer should inject path-tool content root through the runtime boundary'
);

assert.match(
  source,
  /from '\.\/composer-content-mutations\.js'/,
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
  /const composerContentMutations = createComposerContentMutationController\(\{[\s\S]*documentRef: composerDocument,[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*confirmRef: \(message\) => editorRuntime\.confirmAction\(message\),[\s\S]*consoleRef: composerLogger[\s\S]*\}\);/,
  'composer should inject content-mutation frame scheduling, confirmation, and logging through the runtime boundary'
);

assert.doesNotMatch(
  composerContentMutationsSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\brequestAnimationFrame\s*\(/m,
  'content mutation controller should not retain window fallback access for frames or confirmation'
);

assert.match(
  source,
  /from '\.\/composer-setup-verifier\.js'/,
  'composer should cache-bust the extracted setup verifier boundary'
);

assert.doesNotMatch(
  source,
  /function buildRepositoryNewFileLink|function buildRepositoryEditFileLink|async function computeMissingFiles|function openVerifyModal|async function afterAllGood|Verify Setup - Missing Files|Verify Setup – Missing Files/,
  'setup verification scanning, modal rendering, and repository link details should stay outside the main composer shell'
);

assert.match(
  composerSetupVerifierSource,
  /export function createComposerSetupVerifier\(options = \{\}\)[\s\S]*async function computeMissingFiles\(preferredKind\)[\s\S]*function openVerifyModal\(missing, targetKind\)[\s\S]*async function afterAllGood\(targetKind\)[\s\S]*function bindVerifySetup\(\)/,
  'setup verifier should own missing-file checks, verify modal rendering, YAML drift handling, and binding'
);

assert.match(
  source,
  /const composerSetupVerifier = createComposerSetupVerifier\(\{[\s\S]*runtime: editorRuntime,[\s\S]*documentRef: composerDocument,[\s\S]*getContentRoot: \(\) => editorRuntime\.getContentRoot\(\),[\s\S]*fetchRef: \(url, options\) => editorRuntime\.fetchContent\(url, options\),[\s\S]*matchesMedia: \(query\) => editorRuntime\.matchesMedia\(query\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\)[\s\S]*\}\);/,
  'composer should inject setup verifier DOM, network, media, and timer effects through the runtime boundary'
);

assert.doesNotMatch(
  composerSetupVerifierSource,
  /options\.(?:documentRef|windowRef)\s*\|\|\s*\(typeof (?:document|window)|\|\|\s*console\b|typeof (?:document|window|fetch|setTimeout)\b|windowRef\.(?:fetch|setTimeout|__press_content_root|matchMedia)|(^|[^.])\b(?:fetch|setTimeout)\s*\(/m,
  'setup verifier should receive DOM, content-root, fetch, media, timer, and logging adapters explicitly'
);

assert.match(
  source,
  /from '\.\/composer-mode-controller\.js'/,
  'composer should cache-bust the extracted mode controller boundary'
);

assert.match(
  source,
  /from '\.\/composer-markdown-workspace-facade\.js'/,
  'composer should cache-bust the narrow late-bound Markdown workspace facade'
);

assert.match(
  source,
  /from '\.\/composer-file-panel-controller\.js'/,
  'composer should cache-bust the extracted file panel controller boundary'
);

assert.match(
  source,
  /const composerFilePanelController = createComposerFilePanelController\(\{[\s\S]*documentRef: composerDocument,[\s\S]*storage: editorRuntime\.storage,[\s\S]*storageKey: scopedEditorStorageKey\(LS_KEYS\.cfile\),[\s\S]*prefersReducedMotion: composerPrefersReducedMotion,[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\),[\s\S]*onPanelStateApplied:/,
  'composer should wire the file panel controller with runtime storage, frame, and timer adapters'
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

assert.doesNotMatch(
  composerFilePanelControllerSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\b(?:setTimeout|clearTimeout|requestAnimationFrame)\s*\(/m,
  'file panel controller should use only injected frame and timer adapters'
);

assert.match(
  composerEditorWorkspaceFeatureSource,
  /from '\.\/composer-editor-detail-panel-controller\.js'/,
  'editor workspace feature should own the extracted editor detail panel controller boundary'
);

assert.match(
  composerEditorWorkspaceFeatureSource,
  /const editorDetailPanelController = createComposerEditorDetailPanelController\(\{[\s\S]*documentRef,[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\),[\s\S]*setSystemPanelVisible: \(visible\) => setEditorSystemPanelVisible\(visible\),[\s\S]*showSystemPanel: \(mode\) => showEditorSystemPanel\(mode\)[\s\S]*\}\);[\s\S]*animateEditorMarkdownPanelContent,[\s\S]*animateEditorStructurePanelContent,[\s\S]*setEditorDetailPanelMode,[\s\S]*setEditorStructurePanelVisible/,
  'editor workspace feature should wire editor detail panels through a focused controller with runtime timers'
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

assert.doesNotMatch(
  composerEditorDetailPanelControllerSource,
  /windowRef\.|options\.windowRef|\bwindowRef\b|(^|[^.])\b(?:setTimeout|clearTimeout)\s*\(/m,
  'editor detail panel controller should use only injected timer adapters'
);

assert.match(
  composerYamlSiteFeatureSource,
  /from '\.\/composer-yaml-panels-controller\.js'/,
  'YAML/site feature should own the extracted YAML panels controller boundary'
);

assert.match(
  composerYamlSiteFeatureSource,
  /function buildIndexUI\(root, state\) \{[\s\S]*composerIndexTabsUi\.buildIndexUI\(root, state\);[\s\S]*function buildTabsUI\(root, state\) \{[\s\S]*composerIndexTabsUi\.buildTabsUI\(root, state\);[\s\S]*function buildSiteUI\(root, state\) \{[\s\S]*composerSiteSettingsUi\.buildSiteUI\(root, state\);[\s\S]*const composerYamlPanelsController = createComposerYamlPanelsController\(\{[\s\S]*buildIndexUI,[\s\S]*buildTabsUI,[\s\S]*buildSiteUI,[\s\S]*updateMarkdownDraftIndicators: \(\) => runtimeOptions\.updateComposerMarkdownDraftIndicators\(\)[\s\S]*\}\);/,
  'YAML/site feature should wire YAML panel rebuilds through a focused controller'
);

assert.match(
  source,
  /rebuildIndexUI,[\s\S]*rebuildTabsUI,/,
  'composer should receive rebuild callbacks from the YAML/site feature runtime'
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

// composer-identity-body:end
