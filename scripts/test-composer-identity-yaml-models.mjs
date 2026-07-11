import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerSyncPanelSource = readIdentitySource('../assets/js/composer-sync-panel.js');

const composerSystemPanelSource = readIdentitySource('../assets/js/composer-system-panel.js');

const composerYamlSiteFeatureSource = readIdentitySource('../assets/js/composer-yaml-site-feature.js');

const composerIndexTabsModelSource = readIdentitySource('../assets/js/composer-index-tabs-model.js');

const composerSiteModelSource = readIdentitySource('../assets/js/composer-site-model.js');

const composerDiffUiSource = readIdentitySource('../assets/js/composer-diff-ui.js');

const composerDiffReviewViewsSource = readIdentitySource('../assets/js/composer-diff-review-views.js');

const composerOrderDiffUiSource = readIdentitySource('../assets/js/composer-order-diff-ui.js');

const composerOrderPreviewSource = readIdentitySource('../assets/js/composer-order-preview.js');

const composerOrderReviewViewSource = readIdentitySource('../assets/js/composer-order-review-view.js');

const composerOrderVisualSource = readIdentitySource('../assets/js/composer-order-visual.js');

const composerDragListSource = readIdentitySource('../assets/js/composer-drag-list.js');

const composerIndexVersionListSource = readIdentitySource('../assets/js/composer-index-version-list.js');

const composerIndexTabsUiSource = readIdentitySource('../assets/js/composer-index-tabs-ui.js');

const composerIndexTabsLanguageMenuSource = readIdentitySource('../assets/js/composer-index-tabs-language-menu.js');

const composerSiteSettingsUiSource = readIdentitySource('../assets/js/composer-site-settings-ui.js');

const composerSiteSettingsConfigGridsSource = readIdentitySource('../assets/js/composer-site-settings-config-grids.js');

const composerSiteSettingsControlsSource = readIdentitySource('../assets/js/composer-site-settings-controls.js');

const composerSiteSettingsLocalizedFieldsSource = readIdentitySource(
  '../assets/js/composer-site-settings-localized-fields.js'
);

const composerSiteSettingsRepoSectionSource = readIdentitySource('../assets/js/composer-site-settings-repo-section.js');

const composerSiteSettingsSingleGridsSource = readIdentitySource('../assets/js/composer-site-settings-single-grids.js');

const composerMarkdownFeatureSource = readIdentitySource('../assets/js/composer-markdown-feature.js');

const composerEditorShellSource = readIdentitySource('../assets/js/composer-editor-shell.js');

// composer-identity-body:start

assert.match(
  composerMarkdownFeatureSource,
  /from '\.\/encrypted-content\.js'/,
  'Markdown feature should import encrypted article helpers through the encrypted-articles cache key'
);

assert.match(
  source,
  /from '\.\/composer-index-tabs-model\.js'/,
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
  /from '\.\/composer-site-model\.js'/,
  'composer should cache-bust the extracted site model boundary'
);

assert.doesNotMatch(
  source,
  /function prepareSiteState|function cloneSiteState|function computeSiteDiff|function toSiteYaml/,
  'site.yaml normalization, diffing, and serialization should stay outside the main composer shell'
);

assert.match(
  composerSiteModelSource,
  /export function prepareSiteState\(raw\)[\s\S]*site\.themeSettings = normalizeThemeSettingsMap\(src\.themeSettings\)[\s\S]*site\.features = normalizeSiteFeatureSettings\(src\.features\)[\s\S]*'themeSettings'[\s\S]*'enableAllPosts', 'disableAllPosts', 'features', 'connect'[\s\S]*export function computeSiteDiff\(current, baseline\)[\s\S]*diff\.fields\.features[\s\S]*diff\.fields\.themeSettings[\s\S]*diff\.fields\.annotate[\s\S]*export function toSiteYaml\(data\)[\s\S]*'themeMode', 'themePack', 'themeOverride', 'themeSettings'/,
  'site model boundary should own site.yaml normalization, diffing, and serialization'
);

assert.match(
  composerYamlSiteFeatureSource,
  /from '\.\/composer-diff-ui\.js'/,
  'YAML/site feature should own the extracted diff UI boundary'
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
  composerYamlSiteFeatureSource,
  /from '\.\/composer-order-diff-ui\.js'/,
  'YAML/site feature should own the extracted order diff UI boundary'
);

assert.match(
  composerOrderDiffUiSource,
  /from '\.\/composer-diff-review-views\.js'/,
  'composer order diff UI should delegate overview and entries review rendering'
);

assert.match(
  composerOrderDiffUiSource,
  /from '\.\/composer-order-visual\.js'/,
  'composer order diff UI should delegate visual connector and hover behavior'
);

assert.match(
  composerOrderDiffUiSource,
  /from '\.\/composer-order-preview\.js'/,
  'composer order diff UI should delegate inline order preview state and layout behavior'
);

assert.match(
  composerOrderDiffUiSource,
  /from '\.\/composer-order-review-view\.js'/,
  'composer order diff UI should delegate order tab DOM and connector layout state'
);

assert.doesNotMatch(
  source,
  /function openComposerDiffModal|function ensureComposerDiffModal|function drawOrderDiffLines|function updateComposerOrderPreview|function applyComposerOrderHover|function bindComposerOrderHover|const ORDER_LINE_COLORS|let composerDiffModal|let composerOrderPreviewState/,
  'order diff modal, hover state, line drawing, and order preview state should stay outside the main composer shell'
);

assert.match(
  composerOrderDiffUiSource,
  /export function createComposerOrderDiffUi\(options = \{\}\)[\s\S]*const setTimeoutRef = typeof options\.setTimeoutRef === 'function'[\s\S]*const requestAnimationFrameRef = typeof options\.requestAnimationFrameRef === 'function'[\s\S]*const addWindowListener = typeof options\.addWindowListener === 'function'[\s\S]*const addDocumentListener = typeof options\.addDocumentListener === 'function'[\s\S]*const consoleRef = options\.consoleRef \|\| null[\s\S]*const composerOrderVisual = createComposerOrderVisual\([\s\S]*const composerOrderPreview = createComposerOrderPreview\([\s\S]*const composerDiffReviewViews = createComposerDiffReviewViews\([\s\S]*const composerOrderReviewView = createComposerOrderReviewView\([\s\S]*function ensureComposerDiffModal\(\)[\s\S]*function closeComposerDiffModalForKind\(kind\)/,
  'order diff UI boundary should own composer review modal shell while wiring review views, order view, visual, and inline preview boundaries'
);

assert.match(
  composerDiffReviewViewsSource,
  /export function createComposerDiffReviewViews\(options = \{\}\)[\s\S]*function renderOverview\(target, diff\)[\s\S]*function describeEntrySnapshot\(kind, key, source\)[\s\S]*function buildEntryDetails\(kind, key, info, sectionType\)[\s\S]*function renderEntries\(target, kind, diff\)/,
  'diff review views boundary should own overview and entries tab DOM rendering'
);

assert.match(
  composerOrderPreviewSource,
  /export function createComposerOrderPreview\(options = \{\}\)[\s\S]*function scheduleComposerOrderPreviewRelayout\(kind\)[\s\S]*function ensureComposerOrderPreview\(kind\)[\s\S]*function observeComposerOrderRow\(row, kind\)[\s\S]*function updateComposerOrderPreview\(kind, options = \{\}\)[\s\S]*function setComposerOrderPreviewActiveKind\(kind\)/,
  'order preview boundary should own inline preview state, row observers, relayout timers, and active-kind switching'
);

assert.match(
  composerOrderReviewViewSource,
  /export function createComposerOrderReviewView\(options = \{\}\)[\s\S]*function mount\(target\)[\s\S]*function drawLines\(state\)[\s\S]*function render\(kind, options = \{\}\)[\s\S]*function refreshLocale\(\)/,
  'order review view boundary should own order tab DOM, stats, empty state, connector layout state, and locale refresh'
);

assert.match(
  composerOrderVisualSource,
  /export function createComposerOrderVisual\(options = \{\}\)[\s\S]*function applyComposerOrderHover\(container, key\)[\s\S]*function bindComposerOrderHover\(element, key\)[\s\S]*function buildOrderDiffItem\(entry, side\)[\s\S]*function drawOrderDiffLines\(state\)/,
  'order visual boundary should own connector line drawing, item rendering, and hover state'
);

assert.doesNotMatch(
  composerOrderDiffUiSource,
  /const ORDER_LINE_COLORS|function getComposerOrderHoverContainer|function applyComposerOrderHover\(container, key\)|function bindComposerOrderHover\(element, key\)|function buildOrderDiffItem\(entry, side\)[\s\S]*item\.appendChild\(badgeEl\);|function ensureComposerOrderPreview\(kind\)|function updateComposerOrderPreview\(kind, options = \{\}\)|let composerOrderPreviewState|const composerOrderPreviewRelayoutTimers|function renderOverview\(target, diff\)|function describeEntrySnapshot\(kind, key, source\)|function buildEntryDetails\(kind, key, info, sectionType\)|function renderEntries\(target, kind, diff\)|let composerOrderState|className = 'composer-order-stats'|className = 'composer-order-body'|className = 'composer-order-visual'|function renderOrder\(kind\)[\s\S]*const details = computeOrderDiffDetails\(kind\)/,
  'order diff UI should not re-own visual connector, inline preview, review-tab, or order-tab view internals'
);

assert.match(
  source,
  /composerYamlFeature\.createRuntime\(\{[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*cancelAnimationFrameRef: \(id\) => editorRuntime\.cancelFrame\(id\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\),[\s\S]*addWindowListener: \(type, handler, options\) => editorRuntime\.events\.onWindow\(type, handler, options\),[\s\S]*addDocumentListener: \(type, handler, options\) => editorRuntime\.events\.onDocument\(type, handler, options\),[\s\S]*matchesMedia: \(query\) => editorRuntime\.matchesMedia\(query\),[\s\S]*getComputedStyleRef: \(element\) => editorRuntime\.getComputedStyle\(element\),[\s\S]*ResizeObserverRef: editorRuntime\.getResizeObserver\(\),/,
  'composer should inject YAML/site feature timers, frames, events, media, style, and observers through the runtime boundary'
);

assert.doesNotMatch(
  [
    composerOrderDiffUiSource,
    composerDiffReviewViewsSource,
    composerOrderPreviewSource,
    composerOrderReviewViewSource,
    composerOrderVisualSource,
    composerEditorShellSource,
    composerSystemPanelSource,
    composerSyncPanelSource
  ].join('\n'),
  /(?:documentRef|windowRef)\s*=\s*(?:document|window)\b|(?:document|window)\s*=\s*options\.(?:documentRef|windowRef)\s*\|\|\s*\(typeof globalThis|options\.windowRef|windowRef\.|typeof (?:document|window|requestAnimationFrame|setTimeout|clearTimeout)\b|(^|[^.])\b(?:setTimeout|clearTimeout|requestAnimationFrame|cancelAnimationFrame)\s*\(|console\.(?:warn|error|info|log)\s*\(/m,
  'composer order/shell panel modules should receive browser refs and scheduling through explicit runtime wiring instead of rediscovering globals'
);

assert.match(
  composerYamlSiteFeatureSource,
  /from '\.\/composer-index-tabs-ui\.js'/,
  'YAML/site feature should own the extracted index/tabs list UI boundary'
);

assert.match(
  composerIndexTabsUiSource,
  /from '\.\/composer-index-tabs-language-menu\.js'/,
  'index/tabs UI should cache-bust the shared language-menu lifecycle boundary'
);

assert.match(
  composerIndexTabsUiSource,
  /from '\.\/composer-drag-list\.js'/,
  'index/tabs UI should cache-bust the shared drag-list lifecycle boundary'
);

assert.match(
  composerIndexTabsUiSource,
  /from '\.\/composer-index-version-list\.js'/,
  'index/tabs UI should cache-bust the index version-list lifecycle boundary'
);

assert.doesNotMatch(
  source,
  /function makeDragList|function buildIndexUI|function buildTabsUI/,
  'index/tabs list rendering and drag UI should stay outside the main composer shell'
);

assert.match(
  composerIndexTabsUiSource,
  /export function createComposerIndexTabsUi\(options = \{\}\)[\s\S]*const dragList = createComposerDragList\(\{[\s\S]*documentRef,[\s\S]*requestAnimationFrameRef,[\s\S]*addWindowListener,[\s\S]*getWindowScroll,[\s\S]*getComputedStyleRef,[\s\S]*cancelListTransition[\s\S]*\}\);[\s\S]*const \{ makeDragList \} = dragList;[\s\S]*const indexVersionList = createComposerIndexVersionList\(\{[\s\S]*documentRef,[\s\S]*requestAnimationFrameRef,[\s\S]*normalizeIndexVariantList,[\s\S]*getIndexVariantLocation,[\s\S]*promptArticleVersionValue,[\s\S]*showMarkdownOpenAlert,[\s\S]*\}\);[\s\S]*function buildIndexUI\(root, state\)[\s\S]*indexVersionList\.mountIndexVersionList\(\{[\s\S]*block,[\s\S]*row,[\s\S]*entry,[\s\S]*lang,[\s\S]*key,[\s\S]*value: entry\[lang\],[\s\S]*markDirty[\s\S]*\}\);[\s\S]*languageMenu\.createLanguageMenu\(\{[\s\S]*wrapperClass: 'ci-add-lang'[\s\S]*onSelect: \(code, menuApi\) => \{[\s\S]*menuApi\.closeMenu\(\);[\s\S]*function buildTabsUI\(root, state\)[\s\S]*languageMenu\.createLanguageMenu\(\{[\s\S]*wrapperClass: 'ct-add-lang'[\s\S]*onSelect: \(code, menuApi\) => \{[\s\S]*menuApi\.closeMenu\(\);/,
  'index/tabs list UI boundary should own list rendering while delegating shared add-language, drag-list, and index version-list lifecycles'
);

assert.match(
  composerIndexVersionListSource,
  /export function createComposerIndexVersionList\(options = \{\}\)[\s\S]*function requestFrame\(callback\)[\s\S]*function mountIndexVersionList\(options = \{\}\) \{[\s\S]*const arr = normalizeIndexVariantList\(value\);[\s\S]*const snapRects = \(\) => \{[\s\S]*const renderVersions = \(prevRects = null\) => \{[\s\S]*versionRow\.className = 'ci-ver-item';[\s\S]*query\('\.ci-edit', versionRow\)\.addEventListener\('click', \(\) => \{[\s\S]*openMarkdownInEditor\(rel\);[\s\S]*down\.addEventListener\('click', \(\) => \{[\s\S]*entry\[lang\] = arr\.slice\(\);[\s\S]*const addVersionButton = query\('\.ci-lang-addver', block\);[\s\S]*arr\.push\(buildArticleVersionPath\(key, lang, version, entry\)\);/,
  'index version-list helper should own version row rendering, reorder animation, edit opening, removal, and add-version mutations'
);

assert.doesNotMatch(
  composerIndexTabsUiSource,
  /function requestFrame\(callback\)|const snapRects = \(\)|const renderVers|const renderVersions|versionRow\.className = 'ci-ver-item'|query\('\.ci-edit'/,
  'index/tabs list UI should not own index version-row animation, edit, and mutation internals'
);

assert.match(
  composerDragListSource,
  /export function createComposerDragList\(options = \{\}\)[\s\S]*function makeDragList\(container, onReorder, dragOptions = \{\}\) \{[\s\S]*const handle = target\.closest\(handleSelector\);[\s\S]*if \(!handle \|\| !container\.contains\(handle\)\) return;[\s\S]*const item = handle\.closest\(keySelector\);[\s\S]*placeholder = documentRef\.createElement\('div'\);[\s\S]*disposePointerMove = addWindowListener\('pointermove', onPointerMove\);[\s\S]*disposePointerUp = addWindowListener\('pointerup', onPointerUp, \{ once: true \}\);/,
  'shared drag-list helper should own handle-gated pointer drag, placeholder insertion, and window listener lifecycle'
);

assert.doesNotMatch(
  composerIndexTabsUiSource,
  /function makeDragList\(container, onReorder|disposePointerMove|disposePointerUp|drag-placeholder|press-noselect/,
  'index/tabs list UI should not own drag-list pointer lifecycle implementation'
);

assert.match(
  composerIndexTabsLanguageMenuSource,
  /export function createComposerIndexTabsLanguageMenu\(options = \{\}\)[\s\S]*function createLanguageMenu\(\{[\s\S]*wrapperClass = '',[\s\S]*buttonClass = '',[\s\S]*menuClass = '',[\s\S]*available = \[\],[\s\S]*onSelect[\s\S]*function closeMenu\(\)[\s\S]*menu\.classList\.add\('is-closing'\)[\s\S]*addDocumentListener\('mousedown', onDocDown, true\)[\s\S]*addDocumentListener\('keydown', onKeyDown, true\)[\s\S]*onSelect\(code, \{ closeMenu, item, wrap, button: btn, menu \}\);/,
  'index/tabs language-menu helper should own open, close, outside-click, Escape, and select callback lifecycle'
);

assert.doesNotMatch(
  composerIndexTabsUiSource,
  /let disposeDocDown = null|let disposeKeyDown = null|function closeMenu\(\)|function openMenu\(\)|function onDocDown\(event\)|function onKeyDown\(event\)/,
  'index/tabs list UI should not duplicate add-language menu lifecycle in both index and tabs renderers'
);

assert.match(
  source,
  /composerYamlFeature\.createRuntime\(\{[\s\S]*requestAnimationFrameRef: \(callback\) => editorRuntime\.requestFrame\(callback\),[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*addWindowListener: \(type, handler, options\) => editorRuntime\.events\.onWindow\(type, handler, options\),[\s\S]*addDocumentListener: \(type, handler, options\) => editorRuntime\.events\.onDocument\(type, handler, options\),[\s\S]*getComputedStyleRef: \(element\) => editorRuntime\.getComputedStyle\(element\),[\s\S]*getWindowScroll: \(\) => editorRuntime\.getWindowScroll\(\),[\s\S]*alertRef: \(message\) => editorRuntime\.showAlert\(message\),/,
  'composer should inject YAML/site feature frame, timer, event, scroll, dialog, and style effects through the runtime boundary'
);

assert.doesNotMatch(
  `${composerIndexTabsUiSource}\n${composerIndexTabsLanguageMenuSource}\n${composerDragListSource}\n${composerIndexVersionListSource}`,
  /options\.(?:documentRef|windowRef)\s*\|\|\s*\(typeof globalThis|typeof (?:document|window|requestAnimationFrame|setTimeout|clearTimeout|CustomEvent)\b|(^|[^.])\b(?:setTimeout|clearTimeout|requestAnimationFrame|CustomEvent)\s*\(|\bwindowRef\b|documentRef\.(?:addEventListener|removeEventListener)\(|windowRef\.setTimeout|windowRef\.requestAnimationFrame|windowRef\.alert/m,
  'index/tabs UI should receive browser refs, frames, timers, events, scroll, dialogs, and style access through explicit runtime wiring'
);

assert.match(
  composerYamlSiteFeatureSource,
  /from '\.\/composer-site-settings-ui\.js'/,
  'YAML/site feature should own the extracted Site Settings UI boundary'
);

assert.match(
  composerSiteSettingsUiSource,
  /from '\.\/composer-site-settings-controls\.js'/,
  'Site Settings UI should delegate reusable section, field, grid, and switch controls'
);

assert.match(
  composerSiteSettingsUiSource,
  /from '\.\/composer-site-settings-config-grids\.js'/,
  'Site Settings UI should delegate configuration subsection grids'
);

assert.match(
  composerSiteSettingsLocalizedFieldsSource,
  /from '\.\/composer-site-settings-language-menu\.js'/,
  'Site Settings localized-fields boundary should delegate add-language menu behavior and lifecycle cleanup'
);

assert.match(
  composerSiteSettingsUiSource,
  /from '\.\/composer-site-settings-link-list\.js'/,
  'Site Settings UI should delegate profile link list rendering and reordering'
);

assert.match(
  composerSiteSettingsUiSource,
  /from '\.\/composer-site-settings-single-grids\.js'/,
  'Site Settings UI should cache-bust the compact single-grid renderer boundary'
);

assert.match(
  composerSiteSettingsUiSource,
  /from '\.\/composer-site-settings-localized-fields\.js'/,
  'Site Settings UI should delegate localized language-field rendering and language pool collection'
);

assert.match(
  composerSiteSettingsUiSource,
  /from '\.\/composer-site-settings-schema\.js'/,
  'Site Settings UI should consume section and simple-field metadata from a schema boundary'
);

assert.match(
  composerSiteSettingsUiSource,
  /from '\.\/composer-site-settings-section-nav\.js'/,
  'Site Settings UI should delegate active section, scroll sync, and field reveal behavior'
);

assert.doesNotMatch(
  source,
  /function buildSiteUI/,
  'Site Settings rendering should stay outside the main composer shell'
);

assert.match(
  composerSiteSettingsUiSource,
  /export function createComposerSiteSettingsUi\(options = \{\}\)[\s\S]*function buildSiteUI\(root, state\)[\s\S]*createComposerSiteSettingsLocalizedFields\([\s\S]*createComposerSiteSettingsRepoSection\(\{[\s\S]*renderIdentityLocalizedGrid\(identitySection\);[\s\S]*renderBehaviorGrid\(behaviorSubsection\);[\s\S]*renderThemeGrid\(themeSubsection\);[\s\S]*renderAnnotateGrid\(commentsSubsection\);[\s\S]*renderAssetWarningsGrid\(assetsSubsection\);/,
  'Site Settings UI boundary should own top-level section composition while wiring localized-field and configuration grid boundaries'
);

assert.match(
  composerSiteSettingsUiSource,
  /from '\.\/composer-site-settings-repo-section\.js'/,
  'Site Settings UI should cache-bust the repository settings section boundary'
);

assert.match(
  composerSiteSettingsRepoSectionSource,
  /export function ensureComposerSiteSettingsRepo[\s\S]*export function createComposerSiteSettingsRepoSection[\s\S]*repoInputs\.className = 'cs-repo-grid'[\s\S]*repoInputs\.dataset\.field = 'repo'[\s\S]*createRepoFieldGroup\('cs-repo-field-group--owner'[\s\S]*createRepoFieldGroup\('cs-repo-field-group--name'[\s\S]*createRepoFieldGroup\('cs-repo-field-group--branch'[\s\S]*repoSection\.appendChild\(repoInputs\);[\s\S]*renderPublishTransportSettings\(repoSection\);/,
  'repository settings section should own repo field DOM, input bindings, and publish transport slot rendering'
);

assert.doesNotMatch(
  composerSiteSettingsUiSource,
  /cs-repo-grid|createRepoFieldGroup|repoInputs\.dataset\.field|repoSection\.appendChild\(repoInputs\)|renderPublishTransportSettings\(repoSection\)/,
  'Site Settings UI should delegate repository field DOM and publish transport slot rendering'
);

assert.doesNotMatch(
  composerSiteSettingsUiSource,
  /const create(?:Section|Field|SubheadingField|ConfigSubsection|SingleGridFieldset|SwitchControl|LinkListField) = /,
  'Site Settings UI should not re-own reusable control or link-list factories after extraction'
);

assert.doesNotMatch(
  composerSiteSettingsUiSource,
  /className = 'cs-add-lang has-menu'|documentRef\.addEventListener\(LANGUAGE_POOL_CHANGED_EVENT,\s*refreshMenu\)|documentRef\.addEventListener\('mousedown',\s*onDocDown,\s*true\)/,
  'Site Settings UI should not re-own add-language menu DOM or document-level menu listeners'
);

assert.doesNotMatch(
  composerSiteSettingsUiSource,
  /const render(?:Behavior|Theme|Annotate|AssetWarnings)Grid = \(section\) =>/,
  'Site Settings UI should not re-own configuration subsection grid renderers after extraction'
);

assert.match(
  composerSiteSettingsLocalizedFieldsSource,
  /export function createComposerSiteSettingsLocalizedFields\(options = \{\}\)[\s\S]*const collectLanguageCodes = \(\) =>[\s\S]*const renderLocalizedField = \(section, key, fieldOptions = \{\}\) =>[\s\S]*const renderIdentityLocalizedGrid = \(section\) =>/,
  'Site Settings localized-fields boundary should own language collection, localized rows, and merged identity rendering'
);

assert.doesNotMatch(
  composerSiteSettingsUiSource,
  /const ensureLocalized = \(key|const collectLanguageCodes = \(\)|const renderLocalizedField = \(section, key|const renderIdentityLocalizedGrid = \(section\)|cs-localized-row--multiline|siteTitle\|siteSubtitle/,
  'Site Settings UI should not re-own localized field state or identity grid internals after extraction'
);

assert.match(
  composerSiteSettingsConfigGridsSource,
  /export function createComposerSiteSettingsConfigGrids\(options = \{\}\)[\s\S]*const renderBehaviorGrid = \(section\) =>[\s\S]*const renderThemeGrid = \(section\) =>[\s\S]*const renderAnnotateGrid = \(section\) =>[\s\S]*const renderAssetWarningsGrid = \(section\) =>/,
  'Site Settings config-grids boundary should own behavior, theme, annotate, and asset warning renderers'
);

assert.match(
  composerSiteSettingsSingleGridsSource,
  /export function createComposerSiteSettingsSingleGrids\(options = \{\}\)[\s\S]*const schemaFields = siteSettingsSchema\.fields \|\| \{\};[\s\S]*const renderSchemaTextGrid = \(section, fieldGroup = \[\]\) =>[\s\S]*get: \(\) => site\[item\.dataKey\][\s\S]*set: \(value\) => \{ site\[item\.dataKey\] = value; \}[\s\S]*renderIdentityPathGrid: \(section\) => renderSchemaTextGrid\(section, schemaFields\.identityPaths\)[\s\S]*renderSeoResourceGrid: \(section\) => renderSchemaTextGrid\(section, schemaFields\.seoResources\)/,
  'Site Settings single-grids boundary should own schema field binding for identity paths and SEO resource URLs'
);

assert.doesNotMatch(
  composerSiteSettingsUiSource,
  /const render(?:IdentityPath|SeoResource)Grid = \(section\) =>|siteSettingsSchema\.fields\.(?:identityPaths|seoResources)\.map/,
  'Site Settings UI should not re-own compact identity or SEO single-grid item binding after extraction'
);

assert.match(
  composerSiteSettingsControlsSource,
  /export function createComposerSiteSettingsControls\(options = \{\}\)[\s\S]*const createSection = \(title, description\) =>[\s\S]*const createField = \(section, config = \{\}\) =>[\s\S]*const createSingleGridFieldset = \(section\) =>[\s\S]*const renderSingleTextGrid = \(section, items\) =>/,
  'Site Settings controls boundary should own reusable section, field, and compact grid factories'
);

// composer-identity-body:end
