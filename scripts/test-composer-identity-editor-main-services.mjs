import assert from 'node:assert/strict';

import { readIdentitySource, extractFunctionBody } from './composer-identity-test-support.mjs';

const editorContentTreeControllerSource = readIdentitySource('../assets/js/editor-content-tree-controller.js');

const editorFileTreeUiSource = readIdentitySource('../assets/js/editor-file-tree-ui.js');

const editorStructurePanelUiSource = readIdentitySource('../assets/js/editor-structure-panel-ui.js');

const hiEditorSource = readIdentitySource('../assets/js/hieditor.js');

const editorMainSource = readIdentitySource('../assets/js/editor-main.js');

const editorMainRuntimeSource = readIdentitySource('../assets/js/editor-main-runtime.js');

const editorMainMetadataPanelSource = readIdentitySource('../assets/js/editor-main-metadata-panel.js');

const editorMainPreviewSessionSource = readIdentitySource('../assets/js/editor-main-preview-session.js');

const editorMainPreviewAssetsSource = readIdentitySource('../assets/js/editor-main-preview-assets.js');

const editorMainCurrentFileSessionSource = readIdentitySource('../assets/js/editor-main-current-file-session.js');

const editorMainCurrentFileViewSource = readIdentitySource('../assets/js/editor-main-current-file-view.js');

const editorMainSidebarSessionSource = readIdentitySource('../assets/js/editor-main-sidebar-session.js');

const editorMainSidebarFileTreeSource = readIdentitySource('../assets/js/editor-main-sidebar-file-tree.js');

const editorMainToolbarSessionSource = readIdentitySource('../assets/js/editor-main-toolbar-session.js');

const editorMainToolbarCardPickerSource = readIdentitySource('../assets/js/editor-main-toolbar-card-picker.js');

const editorMainToolbarTextActionsSource = readIdentitySource('../assets/js/editor-main-toolbar-text-actions.js');

const editorMainImageSessionSource = readIdentitySource('../assets/js/editor-main-image-session.js');

const editorMainLinkCardContextSource = readIdentitySource('../assets/js/editor-main-link-card-context.js');

const editorMainWorkspaceSessionSource = readIdentitySource('../assets/js/editor-main-workspace-session.js');

const editorMainBlocksSessionSource = readIdentitySource('../assets/js/editor-main-blocks-session.js');

const editorMainDocumentSessionSource = readIdentitySource('../assets/js/editor-main-document-session.js');

const editorMainContentServiceSource = readIdentitySource('../assets/js/editor-main-content-service.js');

const editorMainFileContextServiceSource = readIdentitySource('../assets/js/editor-main-file-context-service.js');

const editorMainLanguageSessionSource = readIdentitySource('../assets/js/editor-main-language-session.js');

// composer-identity-body:start

assert.doesNotMatch(
  [
    editorMainMetadataPanelSource,
    editorMainPreviewSessionSource,
    editorMainPreviewAssetsSource,
    editorMainCurrentFileSessionSource,
    editorMainCurrentFileViewSource,
    editorMainSidebarSessionSource,
    editorMainSidebarFileTreeSource,
    editorMainToolbarSessionSource,
    editorMainToolbarCardPickerSource,
    editorMainToolbarTextActionsSource,
    editorMainImageSessionSource,
    editorMainWorkspaceSessionSource,
    editorContentTreeControllerSource,
    editorFileTreeUiSource,
    editorStructurePanelUiSource
  ].join('\n'),
  /typeof (?:document|window|globalThis|fetch|FileReader|MouseEvent|Event)\s|options\.(?:documentRef|windowRef) \|\| \(typeof|= document,|= window,/,
  'editor app sessions should receive browser refs from the explicit runtime instead of discovering globals themselves'
);

assert.match(
  editorMainRuntimeSource,
  /export function createEditorMainRuntime\(options = \{\}\) \{[\s\S]*function onDocumentReady\(handler\)[\s\S]*readMarkdownEditorView\(\)[\s\S]*persistMarkdownEditorView\(mode\)[\s\S]*readWrapEnabled\(\{ force = false \} = \{\}\)[\s\S]*setEditorBaseDir\(dir, fallback = 'wwwroot\/'\)[\s\S]*registerPrimaryEditorApi\(api\)[\s\S]*function fetchContent\(url, options\)[\s\S]*function showAlert\(message\)[\s\S]*function warn\(\.\.\.args\)[\s\S]*function error\(\.\.\.args\)[\s\S]*function writeClipboardText\(text\)[\s\S]*prefersReducedMotion\(\)[\s\S]*requestAssetDelete\(detail\)[\s\S]*emitCurrentFileBreadcrumbSelect\(detail\)[\s\S]*documentRef: runtime\.documentRef,[\s\S]*windowRef: runtime\.windowRef,[\s\S]*onDocumentReady,[\s\S]*onDocument: runtime\.events\.onDocument,[\s\S]*onWindow: runtime\.events\.onWindow,[\s\S]*requestFrame: runtime\.browser\.requestFrame,[\s\S]*setTimer: runtime\.browser\.setTimer,[\s\S]*clearTimer: runtime\.browser\.clearTimer,[\s\S]*createEvent: runtime\.browser\.createEvent,[\s\S]*postMessage: runtime\.browser\.postMessage,[\s\S]*getComputedStyle: runtime\.browser\.getComputedStyle,[\s\S]*getResizeObserver: runtime\.browser\.getResizeObserver,[\s\S]*scrollToTop: runtime\.browser\.scrollToTop[\s\S]*fetchContent,[\s\S]*showAlert,[\s\S]*warn,[\s\S]*error,[\s\S]*writeClipboardText/,
  'editor main runtime should own storage, browser global, and cross-component event service adapters'
);

assert.match(
  editorMainRuntimeSource,
  /const hiEditorRegistry = options\.hiEditorRegistry instanceof Map[\s\S]*function getHiEditorRegistry\(\) \{[\s\S]*return hiEditorRegistry;[\s\S]*getHiEditorRegistry,/,
  'editor main runtime should own the primary HiEditor instance registry'
);

assert.match(
  editorMainRuntimeSource,
  /function normalizeContentRoot\(contentRoot\)[\s\S]*function setContentRoot\(contentRoot\) \{[\s\S]*normalizeContentRoot\(contentRoot\)[\s\S]*function getContentRoot\(\) \{[\s\S]*runtime\.globals\.getString\(CONTENT_ROOT_GLOBAL, 'wwwroot'\)[\s\S]*getContentRoot,/,
  'editor main runtime should own editor content-root reads and writes'
);

assert.doesNotMatch(
  editorMainRuntimeSource,
  /typeof (?:fetch|alert|console)\b|runtime\.windowRef && runtime\.windowRef\.(?:fetch|alert|console)|windowRef\.(?:fetch|alert|console)/,
  'editor main runtime should delegate fetch, alert, and logger lookup to the shared editor app runtime facade'
);

assert.doesNotMatch(
  editorMainRuntimeSource,
  /const documentRef = runtime\.documentRef|documentRef\.readyState|DOMContentLoaded|runtime\.events\.onDocument\('DOMContentLoaded'/,
  'editor main runtime should delegate DOM-ready state and listener details to the shared editor app runtime facade'
);

assert.match(
  editorMainSource,
  /export function createEditorMainController\(editorMainRuntime = createEditorMainRuntime\(\)\) \{[\s\S]*function start\(\) \{[\s\S]*editorMainRuntime\.onDocumentReady\(\(\) => \{[\s\S]*const kernel = createEditorAppKernel\(\{[\s\S]*name: 'editor-main'[\s\S]*appServices: createEditorMainServiceRegistry\(\)[\s\S]*createEditorMainFeatures\(\)\.forEach\(feature => kernel\.registerFeature\(feature\)\)[\s\S]*kernel\.run\(\)\.catch[\s\S]*createEditorMainController\(\)\.start\(\);/,
  'editor main startup should wire the preview session through the editor runtime boundary'
);

assert.match(
  editorMainSource,
  /import \{ resolveImageSrc \} from '\.\/safe-html\.js';[\s\S]*const getContentRoot = \(\) => editorMainRuntime\.getContentRoot\(\);[\s\S]*const resolveEditorImageSrc = \(src, baseDir\) => resolveImageSrc\(src, baseDir, \{[\s\S]*contentRoot: editorMainRuntime\.getContentRoot\(\),[\s\S]*origin: editorMainRuntime\.getLocationOrigin\(\)[\s\S]*resolveEditorImageSrc,/,
  'editor main should route content-root and image resolution through the explicit runtime boundary'
);

assert.match(
  editorMainSource,
  /resolveImageSrc: context\.resolveEditorImageSrc/,
  'editor blocks feature should consume the injected editor image resolver'
);

assert.doesNotMatch(
  editorMainSource,
  /import \{ getContentRoot, resolveImageSrc \} from '\.\/safe-html\.js';|getContentRoot, resolveImageSrc/,
  'editor main should not import ambient safe-html content-root reads into the editor app path'
);

assert.match(
  editorMainSource,
  /name: 'editorMain\.editor'[\s\S]*context\.editor = createHiEditor\(dom\.textarea, 'markdown', false, \{[\s\S]*documentRef,[\s\S]*windowRef: runtime\.windowRef,[\s\S]*setTimeoutRef: \(handler, delay\) => runtime\.setTimer\(handler, delay\),[\s\S]*getComputedStyle: \(node\) => runtime\.getComputedStyle\(node\),[\s\S]*getResizeObserver: \(\) => runtime\.getResizeObserver\(\),[\s\S]*addDocumentListener: \(type, handler, options\) => runtime\.onDocument\(type, handler, options\),[\s\S]*addWindowListener: \(type, handler, options\) => runtime\.onWindow\(type, handler, options\),[\s\S]*writeClipboardText: \(text\) => runtime\.writeClipboardText\(text\),[\s\S]*editorRegistry: runtime\.getHiEditorRegistry\(\),[\s\S]*allowAmbient: false[\s\S]*\}\);/,
  'editor main should create the primary HiEditor through explicit runtime refs and browser-effect adapters'
);

assert.match(
  hiEditorSource,
  /function createHiEditorCompatibilityState\(\) \{[\s\S]*legacyEditorRegistry: new Map\(\)[\s\S]*function getLegacyEditorRegistry\(\)[\s\S]*function createHiEditorRuntime\(options = \{\}\) \{[\s\S]*const editorRegistry = options\.editorRegistry instanceof Map[\s\S]*\? options\.editorRegistry[\s\S]*: getLegacyEditorRegistry\(\);[\s\S]*hasEditorApi\(id\)[\s\S]*getEditorApi\(id\)[\s\S]*setEditorApi\(id, api\)/,
  'HiEditor runtime should accept an injected editor registry while preserving the legacy registry path through explicit compatibility state'
);

assert.doesNotMatch(
  extractFunctionBody(hiEditorSource, 'makeEditor'),
  /\blegacyEditorRegistry\b|\beditors\.(?:set|get|has)\(/,
  'primary HiEditor makeEditor path should register instances through its configured runtime registry'
);

assert.doesNotMatch(
  extractFunctionBody(hiEditorSource, 'makeEditor'),
  /\bdocument\.|\bwindow\.|\bnavigator\.|\bsetTimeout\s*\(|\bResizeObserver\b|typeof (?:document|window|navigator)\b/,
  'primary HiEditor makeEditor path should consume injected runtime refs instead of rediscovering browser globals'
);

assert.match(
  editorMainPreviewSessionSource,
  /const consoleRef = options\.consoleRef \|\| null[\s\S]*function warn\(\.\.\.args\)[\s\S]*consoleRef\.warn\(\.\.\.args\)[\s\S]*onWindow\('press-editor-asset-preview'[\s\S]*onWindow\('message'[\s\S]*onDocument\('keydown'/,
  'editor preview session should own preview logging, asset-preview, iframe message, and Escape-key event bindings through explicit dependencies and the runtime boundary'
);

assert.match(
  editorMainPreviewSessionSource,
  /const previewAssets = createEditorMainPreviewAssets\(\{[\s\S]*documentRef,[\s\S]*getContentRoot,[\s\S]*getLocationHref,[\s\S]*getElementById,[\s\S]*onCurrentAssetPreview: \(\) => renderCurrent\(\)[\s\S]*\}\);/,
  'editor preview session should compose asset-preview overrides through the preview asset boundary'
);

assert.doesNotMatch(
  editorMainPreviewSessionSource,
  /const previewAssetBuckets = new Map|safePreviewMime|makePreviewDataUrl|normalizePreviewKey|buildPreviewKeysForAsset|updatePreviewAssetBucket|lookupPreviewAsset|collectPreviewAssetOverrides/,
  'editor preview session should not own preview asset bucket, path, data URL, or DOM rewrite internals'
);

assert.doesNotMatch(
  editorMainPreviewSessionSource,
  /\bwindowRef\b|options\.windowRef|windowRef\.|windowRef &&|typeof window|requestAnimationFrame === 'function'|setTimeout === 'function'|windowRef\.location|console\.warn/,
  'editor preview session should receive frame, timer, location, and warning behavior through explicit runtime adapters'
);

assert.match(
  editorMainSidebarSessionSource,
  /export function createEditorMainSidebarSession\(options = \{\}\) \{[\s\S]*const fileTree = createEditorMainSidebarFileTree\(\{[\s\S]*runtime,[\s\S]*documentRef,[\s\S]*normalizeLangKey,[\s\S]*getContentRoot: \(\) => contentRoot,[\s\S]*setStatus,[\s\S]*onOpenMarkdown,[\s\S]*onWarn,[\s\S]*alert: showAlert[\s\S]*\}\);[\s\S]*fileTree\.bind\(\{[\s\S]*listIndex,[\s\S]*listTabs,[\s\S]*searchInput,[\s\S]*sideTabs,[\s\S]*groupIndex,[\s\S]*groupTabs[\s\S]*\}\);[\s\S]*fileTree\.renderIndex\(rawIndex\);[\s\S]*fileTree\.renderTabs\(tabs\);[\s\S]*const initialize = \(\) => \{[\s\S]*bind\(\);[\s\S]*return load\(\);/,
  'editor sidebar session should compose file tree rendering and keep loading/current-file binding orchestration'
);

assert.match(
  editorMainSidebarFileTreeSource,
  /export function createEditorMainSidebarFileTree\(options = \{\}\) \{[\s\S]*let currentActive = null;[\s\S]*let activeGroup = 'index';[\s\S]*const makeLi = \(label, relPath\) => \{[\s\S]*await onOpenMarkdown\(\{ relPath, url, contentRoot: currentContentRoot\(\) \}\);[\s\S]*const renderGroupedIndex = \(root, data\) => \{[\s\S]*const renderGroupedTabs = \(root, data\) => \{[\s\S]*const applyFilter = \(term\) => \{[\s\S]*const switchGroup = \(name\) => \{[\s\S]*const bind = \(elements = \{\}\) => \{/,
  'editor sidebar file tree boundary should own active row state, grouped rendering, filtering, group switching, and item open behavior'
);

assert.doesNotMatch(
  editorMainSidebarSessionSource,
  /let currentActive = null|let activeGroup = 'index'|const renderGroupedIndex = \(root, data\)|const renderGroupedTabs = \(root, data\)|const applyFilter = \(term\)|const switchGroup = \(name\)|const makeGroupHeader|const makeSubHeader|const compareVersionDesc|const makeLi = \(label, relPath\)/,
  'editor sidebar session should not own file tree row state, grouped rendering, filtering, or row open internals'
);

assert.doesNotMatch(
  [editorMainSidebarSessionSource, editorMainSidebarFileTreeSource].join('\n'),
  /\bwindowRef\b|options\.windowRef|defaultAlert/,
  'editor sidebar session and file tree should receive alert behavior through explicit app-service injection instead of reading window refs'
);

assert.match(
  editorMainToolbarSessionSource,
  /export function createEditorMainToolbarSession\(options = \{\}\) \{[\s\S]*const textActions = createEditorMainToolbarTextActions\(\{[\s\S]*getEditorTextarea,[\s\S]*createInputEvent[\s\S]*\}\);[\s\S]*let formattingButtons = \[\];[\s\S]*let cardInsertionAllowed = false;[\s\S]*const cardPicker = createEditorMainToolbarCardPicker\(\{[\s\S]*runtime,[\s\S]*documentRef,[\s\S]*getEntries: readCardEntries,[\s\S]*canOpen: \(\) => cardInsertionAllowed,[\s\S]*onSelectEntry: \(entry\) => runTextAction\(\(\) => textActions\.insertCardLink\(entry\)\),[\s\S]*onEscapeClose: \(\) => textActions\.restoreSelection\(\)[\s\S]*\}\);[\s\S]*function applyButtonTooltipState\(button, disabled\)[\s\S]*const bind = \(\) => \{[\s\S]*bindCardPicker\(\);[\s\S]*bindFormattingButtons\(\);[\s\S]*bindSelectionTracking\(\);/,
  'editor toolbar session should compose text actions and card picker while owning button tooltip and enabled-state coordination'
);

assert.match(
  editorMainToolbarCardPickerSource,
  /export function createEditorMainToolbarCardPicker\(options = \{\}\) \{[\s\S]*let cardPopoverOpen = false;[\s\S]*const renderCardPickerList = \(term = ''\) => \{[\s\S]*const position = \(anchor = cardButton\) => \{[\s\S]*function handleOutsideClick\(event\)[\s\S]*function handleKeydown\(event\)[\s\S]*function close\(\)[\s\S]*const open = \(\) => \{[\s\S]*const update = \(\) => \{[\s\S]*const bind = \(\) => \{/,
  'editor toolbar card picker boundary should own card picker DOM rendering, popover lifecycle, and watcher binding'
);

assert.match(
  editorMainToolbarTextActionsSource,
  /export function createEditorMainToolbarTextActions\(options = \{\}\) \{[\s\S]*let lastSelectionRange = \{ start: 0, end: 0 \};[\s\S]*let suppressSelectionTracking = false;[\s\S]*const applyInlineFormat = \(prefix, suffix\) => \{[\s\S]*const toggleLinePrefix = \(prefix\) => \{[\s\S]*const applyCodeBlockFormat = \(\) => \{[\s\S]*const insertCardLink = \(entry\) => \{/,
  'editor toolbar text action boundary should own selection tracking and Markdown textarea mutation rules'
);

assert.doesNotMatch(
  editorMainToolbarSessionSource,
  /let lastSelectionRange|let suppressSelectionTracking|const applyInlineFormat = \(prefix, suffix\)|const toggleLinePrefix = \(prefix\)|const applyCodeBlockFormat = \(\)|const insertCardLink = \(entry\)|const dispatchInputEvent = \(textarea\)|const getNormalizedSelection = \(\)/,
  'editor toolbar session should not own Markdown textarea mutation or selection-state internals'
);

assert.doesNotMatch(
  editorMainToolbarSessionSource,
  /let cardPopoverOpen|let cardPopoverClosing|let cardPopoverCloseTimer|let cardPopoverTransitionHandler|detachCardMouseDown|detachCardKeydown|detachCardResize|detachCardScroll|const renderCardPickerList = \(term = ''\)|const positionCardPopover|function closeCardPopover|const openCardPopover|function handleCardOutsideClick|function handleCardKeydown/,
  'editor toolbar session should not own article-card picker DOM, popover, or watcher internals'
);

assert.match(
  editorMainToolbarCardPickerSource,
  /const onDocument = typeof runtime\.onDocument === 'function'[\s\S]*const onWindow = typeof runtime\.onWindow === 'function'[\s\S]*const setTimer = typeof runtime\.setTimer === 'function'[\s\S]*const clearTimer = typeof runtime\.clearTimer === 'function'[\s\S]*detachCardMouseDown = onDocument\('mousedown', handleOutsideClick, true\);[\s\S]*detachCardResize = onWindow\('resize', handleRelayout, true\);/,
  'editor toolbar card picker should route popover document/window/timer effects through the runtime boundary'
);

assert.doesNotMatch(
  [editorMainToolbarSessionSource, editorMainToolbarCardPickerSource].join('\n'),
  /\bwindowRef\b|options\.windowRef|documentRef\.defaultView|windowRef\.|new Event/,
  'editor toolbar session and card picker should not retain direct window refs for timers or input event construction'
);

assert.match(
  editorMainImageSessionSource,
  /export function createEditorMainImageSession\(options = \{\}\) \{[\s\S]*let pendingBlocksImageInsert = null;[\s\S]*let pendingImagePickerToken = 0;[\s\S]*const readFileAsBase64 = \(file\) => new Promise[\s\S]*const buildAssetFileMeta = \(file\) => \{[\s\S]*const insertImageMarkdown = \(relativePath, altText\) => \{[\s\S]*const handleImageFiles = async \(fileList, opts = \{\}\) => \{[\s\S]*const openImageInputPicker = \(\) => \{[\s\S]*const requestBlocksImageUpload = \(\{ index, replaceIndex, replaceBlockId \} = \{\}\) => \{[\s\S]*const requestBlocksImageDelete = \(\{ index, blockId, src \} = \{\}\) => \{[\s\S]*const bind = \(\) => \{/,
  'editor image session should own picker pending state, file reading, markdown insertion, block image actions, and binding'
);

assert.match(
  editorMainImageSessionSource,
  /import \{ insertImageMarkdownAtSelection \} from '\.\/editor-markdown-ops\.js';[\s\S]*import \{ resolveLocalMarkdownAssetReference \} from '\.\/repository-deletions\.js';[\s\S]*const consoleRef = options\.consoleRef \|\| null[\s\S]*const onWindow = typeof runtime\.onWindow === 'function'[\s\S]*const setTimer = typeof runtime\.setTimer === 'function'[\s\S]*runtime\.getFileReader\(\)[\s\S]*runtime\.createMouseEvent\(type, eventOptions\)[\s\S]*function error\(\.\.\.args\)[\s\S]*consoleRef\.error\(\.\.\.args\)[\s\S]*runtime\.emitAssetAdded\([\s\S]*runtime\.requestAssetDelete\(detail\)[\s\S]*runtime\.emitAssetDeleteCanceled\(detail\)/,
  'editor image session should route markdown-image operations, picker effects, and asset events through explicit dependencies and runtime services'
);

assert.doesNotMatch(
  editorMainImageSessionSource,
  /\bwindowRef\b|options\.windowRef|windowRef\.|new MouseEvent|windowRef\.setTimeout|windowRef\.FileReader|windowRef\.MouseEvent|console\.error/,
  'editor image session should not retain direct window refs for timers, FileReader, MouseEvent construction, or error logging'
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
  /import \{ createMarkdownBlocksEditor \} from '\.\/editor-blocks\.js';[\s\S]*import \{ hydrateInternalLinkCards \} from '\.\/link-cards\.js';[\s\S]*const blockLabelFallbacks = \{/,
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
  /import \{ configureFetchCachePolicy as configureFetchCachePolicyDefault \} from '\.\/cache-control\.js';[\s\S]*import \{ loadContentJsonWithRaw as loadContentJsonWithRawDefault \} from '\.\/i18n\.js';[\s\S]*fetchConfigWithYamlFallbackDefault,[\s\S]*fetchMergedSiteConfigDefault/,
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

assert.doesNotMatch(
  editorMainContentServiceSource,
  /fetchImpl\s*=\s*fetch\b|typeof fetch\b|:\s*fetch\b/,
  'editor content service should receive fetch through the explicit editor runtime instead of defaulting to ambient fetch'
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

// composer-identity-body:end
