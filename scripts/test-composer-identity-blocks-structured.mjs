import assert from 'node:assert/strict';

import { readIdentitySource, extractFunctionBody } from './composer-identity-test-support.mjs';

const editorMainPreviewAssetsSource = readIdentitySource('../assets/js/editor-main-preview-assets.js');

const editorMainImageSessionSource = readIdentitySource('../assets/js/editor-main-image-session.js');

const editorBlocksSource = readIdentitySource('../assets/js/editor-blocks.js');

const editorBlocksModelSource = readIdentitySource('../assets/js/editor-blocks-model.js');

const editorBlocksInlineModelSource = readIdentitySource('../assets/js/editor-blocks-inline-model.js');

const editorBlocksListModelSource = readIdentitySource('../assets/js/editor-blocks-list-model.js');

const editorBlocksBlockActionsSource = readIdentitySource('../assets/js/editor-blocks-block-actions.js');

const editorBlocksControlFactorySource = readIdentitySource('../assets/js/editor-blocks-control-factory.js');

const editorBlocksBodySessionSource = readIdentitySource('../assets/js/editor-blocks-body-session.js');

const editorBlocksStateSource = readIdentitySource('../assets/js/editor-blocks-state.js');

const editorBlocksHeadSessionSource = readIdentitySource('../assets/js/editor-blocks-head-session.js');

const editorBlocksCommandSessionSource = readIdentitySource('../assets/js/editor-blocks-command-session.js');

const editorBlocksCaretSessionSource = readIdentitySource('../assets/js/editor-blocks-caret-session.js');

const editorBlocksInlineEditingBridgeSource = readIdentitySource('../assets/js/editor-blocks-inline-editing-bridge.js');

const editorBlocksBlockTypeSessionsSource = readIdentitySource('../assets/js/editor-blocks-block-type-sessions.js');

const editorBlocksLinkSessionSource = readIdentitySource('../assets/js/editor-blocks-link-session.js');

const editorBlocksMathSessionSource = readIdentitySource('../assets/js/editor-blocks-math-session.js');

const editorBlocksTableSessionSource = readIdentitySource('../assets/js/editor-blocks-table-session.js');

const editorBlocksCardPickerSessionSource = readIdentitySource('../assets/js/editor-blocks-card-picker-session.js');

const editorBlocksImageSessionSource = readIdentitySource('../assets/js/editor-blocks-image-session.js');

const editorBlocksCodeSessionSource = readIdentitySource('../assets/js/editor-blocks-code-session.js');

const editorBlocksSourceSessionSource = readIdentitySource('../assets/js/editor-blocks-source-session.js');

const editorBlocksListSessionSource = readIdentitySource('../assets/js/editor-blocks-list-session.js');

const editorSource = readIdentitySource('../index_editor.html');

// composer-identity-body:start

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
  editorBlocksBlockTypeSessionsSource,
  /const imageSession = createImageSession\(\{[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*blockElements,[\s\S]*selectionSession,[\s\S]*insertPlainTextIntoEditable,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*updateInlineToolbarState,[\s\S]*updateFromControl,[\s\S]*insertBlock,[\s\S]*deleteBlockAt,[\s\S]*setActive,[\s\S]*resolveAssetSrc,[\s\S]*hydrateImages,[\s\S]*requestImageUpload,[\s\S]*canDeleteImageResource,[\s\S]*requestImageDelete/,
  'blocks block-type session assembly should compose image DOM/control behavior through the image session boundary'
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
  /import \{ resolveLocalMarkdownAssetReference \} from '\.\/repository-deletions\.js';[\s\S]*const canDeleteImageResource = \(src\) => !!resolveCurrentImageResource\(src\);[\s\S]*const requestBlocksImageDelete = \(\{ index, blockId, src \} = \{\}\) => \{[\s\S]*resolveLocalMarkdownAssetReference\(markdownPath, source \|\| src, getContentRoot\(\)\)[\s\S]*runtime\.requestAssetDelete\(detail\)[\s\S]*blocksEditor\.deleteImageBlock\(target\)[\s\S]*runtime\.emitAssetDeleteCanceled\(detail\)/,
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
  editorMainPreviewAssetsSource,
  /const previewAssetBuckets = new Map\(\);[\s\S]*const normalizeKey = \(value\) => \{[\s\S]*const applyAssetOverrides = \(container, markdownPath\) => \{[\s\S]*const refreshAssetOverrides = \(\) => \{[\s\S]*\['blocks-wrap'\]\.forEach\(\(id\) => \{[\s\S]*const target = getElementById\(id\);[\s\S]*applyAssetOverrides\(target, previewAssetCurrentPath\);[\s\S]*\}\);[\s\S]*const collectAssetOverrides = \(markdownPath\) => \{[\s\S]*const handleAssetPreviewEvent = \(event\) => \{/,
  'preview asset boundary should own preview asset buckets, WYSIWYG rewrites, iframe override payloads, and asset-preview events'
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
  editorBlocksInlineEditingBridgeSource,
  /function normalizeCodeEditablePlainText\(value\) \{[\s\S]*\.replace\(\/\\r\\n\/g, '\\n'\)[\s\S]*\.replace\(\/\\r\/g, '\\n'\);[\s\S]*function codeEditableText\(el\) \{[\s\S]*normalizeCodeEditablePlainText\(el\.innerText \|\| el\.textContent \|\| ''\)\.replace\(\/\\n\$\/, ''\);/,
  'code block text extraction should normalize browser Enter separators before syncing'
);

assert.match(
  editorBlocksInlineEditingBridgeSource,
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
  editorBlocksBlockTypeSessionsSource,
  /const sourceSession = createSourceSession\(\{[\s\S]*documentRef,[\s\S]*editableSession,[\s\S]*text,[\s\S]*caretSession,[\s\S]*measureLimit,[\s\S]*textareaTextOffsetDetailsFromPoint,[\s\S]*autoSizeTextarea,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*updateFromControl,[\s\S]*setActive,[\s\S]*activateEditableFromPointer,[\s\S]*applyAutofix: applySourceAutofix,/,
  'blocks block-type session assembly should compose source Markdown DOM/control behavior through the source session boundary'
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
  `${editorBlocksBlockTypeSessionsSource}\n${editorBlocksBodySessionSource}`,
  /source: \(body, block, index\) => sourceSession\?\.renderBlock\?\.\(body, block, index\)[\s\S]*callRenderer\(renderers, 'source', body, block, index\)/,
  'source block body rendering should delegate to the source session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /sourceReasonText|createSourceReasonHelp|sourceAutofixLabel|canAutofixSourceBlock|createSourceAutofixButton|blocks-source-help-wrap|blocks-source-autofix|area\.addEventListener\('input', \(\) => \{[\s\S]*autoSizeTextarea\(area\);/,
  'blocks editor root should not own source Markdown help, autofix, or textarea event wiring'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /const listSession = registerSession\(blockSessions, 'setListSession', createListSession\(\{[\s\S]*documentRef,[\s\S]*root,[\s\S]*list,[\s\S]*state,[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*selectionSession,[\s\S]*caretSession,[\s\S]*inlineDomSession,[\s\S]*closestElement: options\.closestElement,[\s\S]*text,[\s\S]*editableListItems,[\s\S]*defaultListItems,[\s\S]*normalizeListItemType,[\s\S]*patchListItemType,[\s\S]*splitEditableTextAtSelection,[\s\S]*mergeFirstListItemIntoPreviousBlock,[\s\S]*wireInlineEditable,[\s\S]*queueTask[\s\S]*\}\)\);/,
  'blocks block-type session assembly should compose list DOM, toolbar, and input behavior through the list session boundary'
);

assert.match(
  `${editorBlocksBlockTypeSessionsSource}\n${editorBlocksBodySessionSource}`,
  /list: \(body, block, index\) => listSession\?\.renderBlock\?\.\(body, block, index\)[\s\S]*type === 'list'[\s\S]*callRenderer\(renderers, 'list', body, block, index\)/,
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
  editorBlocksControlFactorySource,
  /const autoSizeTextarea = \(area\) => \{[\s\S]*area\.style\.height = 'auto';[\s\S]*area\.style\.height = `\$\{area\.scrollHeight\}px`;[\s\S]*\};/,
  'blocks control factory should provide the shared textarea autosize service'
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
  extractFunctionBody(editorBlocksInlineEditingBridgeSource, 'editableText'),
  /\.trim\(/,
  'editable text sync should preserve leading and trailing markdown whitespace'
);

assert.doesNotMatch(
  extractFunctionBody(editorBlocksInlineEditingBridgeSource, 'splitEditableTextAtSelection'),
  /\.trim\(/,
  'splitting editable text should preserve leading and trailing markdown whitespace'
);

assert.match(
  `${editorBlocksInlineEditingBridgeSource}\n${editorBlocksListSessionSource}`,
  /function splitEditableTextAtSelection\(el, selectionSession = null\) \{[\s\S]*const selectionTools = normalizeSelectionSession\(selectionSession\);[\s\S]*selectionTools\.getSelectionRange\(el\)[\s\S]*beforeRange\.cloneContents\(\)[\s\S]*afterRange\.cloneContents\(\)[\s\S]*span\.addEventListener\('keydown', \(event\) => \{[\s\S]*const split = splitEditableTextAtSelection\(span, selectionSession\);[\s\S]*next\[itemIndex\] = \{ \.\.\.next\[itemIndex\], text: split\.before \};[\s\S]*next\.splice\(itemIndex \+ 1, 0, \{[\s\S]*text: split\.after,[\s\S]*checked: false,[\s\S]*indent: currentIndent,[\s\S]*indentText:[\s\S]*blocksState\.setPendingListFocus\(\{ blockId: block\.id, itemIndex: itemIndex \+ 1, caretOffset: 0 \}\);/,
  'pressing Enter in a visual list item should keep the caret semantic position by focusing the after item'
);

assert.match(
  editorBlocksListSessionSource,
  /outdentEmptyListItemForEnter\(currentItems, itemIndex\)[\s\S]*updateFromControl\(block, \{ items: outdentedItems \}, true\)[\s\S]*isEditableSelectionAtStart\(span, caretSession\)[\s\S]*convertListTailItemAfterEmptyToParagraph\(currentItems, itemIndex\)[\s\S]*makeBlock\('paragraph'[\s\S]*focusBlockPrimaryEditable\(paragraph, 0\)[\s\S]*splitListItemsAtEmptyItem\(currentItems, itemIndex\)[\s\S]*normalizeSplitListStartItems\(emptySplit\.after\)[\s\S]*blocksState\.replaceBlocks\(index, 1, \[block, nextBlock\][\s\S]*insertBlankBlock\(index \+ 1, \{ focus: true \}\)[\s\S]*blocksState\.replaceBlocks\(index, 1, \[blank\]\)[\s\S]*const split = splitEditableTextAtSelection\(span, selectionSession\);/,
  'pressing Enter at a list tail after an inserted empty item should convert the current tail item to a paragraph before normal split'
);

assert.match(
  `${editorBlocksInlineModelSource}\n${editorBlocksListModelSource}\n${editorBlocksModelSource}\n${editorBlocksListSessionSource}\n${editorBlocksCaretSessionSource}`,
  /export function inlineRenderedTextLength\(markdownText\) \{[\s\S]*parseInlineRuns\(normalizeEditableMarkdownText\(markdownText\)\)[\s\S]*export function mergeListItemIntoPreviousItem\(items, itemIndex\) \{[\s\S]*itemIndentLevel\(previous\) !== itemIndentLevel\(current\)[\s\S]*listItemHasNestedChildren\(source, safeIndex\)[\s\S]*joinMergedListItemText\(previousText, listItemText\(current\)\)[\s\S]*inlineRenderedTextLength\(previousText\) \+ mergedText\.separator\.length[\s\S]*event\.key === 'Backspace' \|\| event\.key === 'Delete'[\s\S]*itemIndex > 0[\s\S]*isEditableSelectionAtStart\(span, caretSession\)[\s\S]*mergeListItemIntoPreviousItem\(next, itemIndex\)[\s\S]*if \(!mergedItem\) return;[\s\S]*blocksState\.setPendingListFocus\(\{ blockId: block\.id, itemIndex: mergedItem\.focusItemIndex, caretOffset: mergedItem\.caretOffset \}\)[\s\S]*function isSelectionAtStart\(el\) \{[\s\S]*selectionTools\.getSelectionRange\(el\)[\s\S]*beforeRange\.cloneContents\(\)/,
  'Backspace or Delete at the start of a non-first visual list item should merge only structurally safe same-level items'
);

assert.match(
  editorBlocksListSessionSource,
  /event\.key === 'Backspace' && itemIndex === 0 && index > 0 && isEditableSelectionAtStart\(span, caretSession\)[\s\S]*mergeFirstListItemIntoPreviousBlock\(previous,[\s\S]*items: currentItems[\s\S]*if \(!merged\) return;[\s\S]*blocksState\.replaceBlocks\(index - 1, 2, replacement,[\s\S]*focusBlockPrimaryEditable\(merged\.previousBlock, merged\.focus\.caretOffset\)/,
  'Backspace at the start of the first visual list item should merge into the previous block only through the safe helper'
);

assert.match(
  editorBlocksBlockActionsSource,
  /mergeTextBlockIntoPrevious\(previous, block\) \|\| mergeTextBlockIntoPreviousList\(previous, block\)[\s\S]*caretOffset: merged\.focusCaretOffset/,
  'Backspace at the start of a text block should support merging into a previous list tail item with safe caret placement'
);

// composer-identity-body:end
