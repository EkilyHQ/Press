import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const editorMainBlocksSessionSource = readIdentitySource('../assets/js/editor-main-blocks-session.js');

const editorBlocksSource = readIdentitySource('../assets/js/editor-blocks.js');

const editorBlocksModelSource = readIdentitySource('../assets/js/editor-blocks-model.js');

const editorBlocksBlockCoreModelSource = readIdentitySource('../assets/js/editor-blocks-block-core-model.js');

const editorBlocksMarkdownParseModelSource = readIdentitySource('../assets/js/editor-blocks-markdown-parse-model.js');

const editorBlocksMarkdownSerializeModelSource = readIdentitySource(
  '../assets/js/editor-blocks-markdown-serialize-model.js'
);

const editorBlocksTableModelSource = readIdentitySource('../assets/js/editor-blocks-table-model.js');

const editorBlocksBlockFlowModelSource = readIdentitySource('../assets/js/editor-blocks-block-flow-model.js');

const editorBlocksSessionRegistrySource = readIdentitySource('../assets/js/editor-blocks-session-registry.js');

const editorBlocksBlockActionsSource = readIdentitySource('../assets/js/editor-blocks-block-actions.js');

const editorBlocksControlFactorySource = readIdentitySource('../assets/js/editor-blocks-control-factory.js');

const editorBlocksInlineDomSessionSource = readIdentitySource('../assets/js/editor-blocks-inline-dom-session.js');

const editorBlocksCaretSessionSource = readIdentitySource('../assets/js/editor-blocks-caret-session.js');

const editorBlocksCaretMeasurementSource = readIdentitySource('../assets/js/editor-blocks-caret-measurement.js');

const editorBlocksInlineEditingBridgeSource = readIdentitySource('../assets/js/editor-blocks-inline-editing-bridge.js');

const editorBlocksFocusPointerSessionsSource = readIdentitySource(
  '../assets/js/editor-blocks-focus-pointer-sessions.js'
);

const editorBlocksInlineSessionsSource = readIdentitySource('../assets/js/editor-blocks-inline-sessions.js');

const editorBlocksBlockTypeSessionsSource = readIdentitySource('../assets/js/editor-blocks-block-type-sessions.js');

const editorBlocksInlineCommandSessionSource = readIdentitySource(
  '../assets/js/editor-blocks-inline-command-session.js'
);

const editorBlocksLinkSessionSource = readIdentitySource('../assets/js/editor-blocks-link-session.js');

const editorBlocksMathSessionSource = readIdentitySource('../assets/js/editor-blocks-math-session.js');

const editorSource = readIdentitySource('../index_editor.html');

// composer-identity-body:start

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
  /assets\/js\/editor-boot\.js/,
  'editor HTML should cache-bust editor boot when asset deletion i18n boundaries change'
);

assert.match(
  source,
  /import \{ escapeHtml \} from '\.\/utils\.js';/,
  'composer should import the shared HTML escaper before wiring UI controllers'
);

assert.match(
  editorSource,
  /assets\/js\/editor-main\.js/,
  'editor HTML should cache-bust editor-main.js when block editor defaults change'
);

assert.match(
  editorSource,
  /assets\/js\/composer\.js/,
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
  /assets\/js\/editor-main\.js/,
  'editor HTML should cache-bust editor-main.js when block editor defaults change'
);

assert.match(
  editorMainBlocksSessionSource,
  /from '\.\/editor-blocks\.js'/,
  'editor main blocks session should cache-bust the Markdown blocks editor when math block handling changes'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-block-core-model\.js'/,
  'blocks editor should cache-bust the explicit blocks core model boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-markdown-parse-model\.js'/,
  'blocks editor should cache-bust the explicit Markdown parse model boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-markdown-serialize-model\.js'/,
  'blocks editor should cache-bust the explicit Markdown serialize model boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-inline-model\.js'/,
  'blocks editor should cache-bust the explicit blocks inline model boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-list-model\.js'/,
  'blocks editor should cache-bust the explicit blocks list model boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /from '\.\/editor-blocks-table-model\.js'/,
  'blocks block-type session assembly should cache-bust the explicit blocks table model boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-block-flow-model\.js'/,
  'blocks editor should cache-bust the explicit blocks block-flow model boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-inline-sessions\.js'/,
  'blocks editor should cache-bust the explicit inline sessions assembly boundary'
);

assert.match(
  editorBlocksInlineEditingBridgeSource,
  /from '\.\/editor-blocks-inline-model\.js'/,
  'blocks inline editing bridge should consume inline run parsing and serialization through the inline model boundary'
);

assert.match(
  editorBlocksBlockActionsSource,
  /from '\.\/editor-blocks-list-model\.js'/,
  'blocks block actions should consume list block helpers through the list model boundary'
);

assert.match(
  editorBlocksBlockActionsSource,
  /from '\.\/editor-blocks-block-flow-model\.js'/,
  'blocks block actions should consume Backspace and Enter flow helpers through the block-flow model boundary'
);

assert.match(
  editorBlocksBlockActionsSource,
  /from '\.\/editor-blocks-block-core-model\.js'[\s\S]*from '\.\/editor-blocks-markdown-parse-model\.js'/,
  'blocks block actions should consume block creation and source autofix through explicit model boundaries'
);

assert.match(
  editorBlocksModelSource,
  /export \{[\s\S]*applyInlineLinkToRuns,[\s\S]*parseInlineRuns,[\s\S]*serializeInlineRuns,[\s\S]*toggleInlineMarkOnRuns[\s\S]*\} from '\.\/editor-blocks-inline-model\.js';/,
  'blocks model should keep backward-compatible inline exports while delegating inline logic to the inline model boundary'
);

assert.match(
  editorBlocksModelSource,
  /export \{(?=[\s\S]*parseListBlock)(?=[\s\S]*serializeList)(?=[\s\S]*mergeListItemIntoPreviousItem)[\s\S]*\} from '\.\/editor-blocks-list-model\.js';/,
  'blocks model should keep backward-compatible list exports while delegating list logic to the list model boundary'
);

assert.match(
  editorBlocksModelSource,
  /export \{(?=[\s\S]*parseTableBlock)(?=[\s\S]*serializeTable)(?=[\s\S]*editableTableData)[\s\S]*\} from '\.\/editor-blocks-table-model\.js';/,
  'blocks model should keep backward-compatible table exports while delegating table logic to the table model boundary'
);

assert.match(
  editorBlocksModelSource,
  /export \{(?=[\s\S]*isBlockEmptyForBackspace)(?=[\s\S]*splitTextBlockIntoParagraph)(?=[\s\S]*mergeTextBlockIntoPrevious)(?=[\s\S]*mergeFirstListItemIntoPreviousBlock)[\s\S]*\} from '\.\/editor-blocks-block-flow-model\.js';/,
  'blocks model should keep backward-compatible block-flow exports while delegating Enter and Backspace editing logic to the block-flow model boundary'
);

assert.match(
  editorBlocksModelSource,
  /export \{(?=[\s\S]*BLOCK_TYPES)(?=[\s\S]*makeBlock)(?=[\s\S]*makeBlankBlock)(?=[\s\S]*splitBlankLineUnits)[\s\S]*\} from '\.\/editor-blocks-block-core-model\.js';/,
  'blocks model should keep backward-compatible block core exports while delegating block object shape to the core boundary'
);

assert.match(
  editorBlocksModelSource,
  /export \{(?=[\s\S]*autofixMarkdownSourceBlock)(?=[\s\S]*parseMarkdownBlocks)[\s\S]*\} from '\.\/editor-blocks-markdown-parse-model\.js';[\s\S]*export \{(?=[\s\S]*serializeMarkdownBlocks)[\s\S]*\} from '\.\/editor-blocks-markdown-serialize-model\.js';/,
  'blocks model should keep backward-compatible Markdown parse and serialize exports while delegating those internals'
);

assert.doesNotMatch(
  editorBlocksModelSource,
  /function parseInlineRunsInternal|function inlineMarkedRangeAtOffset|function escapeMarkdownInline|function serializeInlineRun/,
  'blocks model should not re-own inline Markdown parser, serializer, or run mutation internals'
);

assert.doesNotMatch(
  editorBlocksModelSource,
  /function parseListBlock|function serializeList|function parseListLineInfo|function dedentIndentedListSource|function mergeListItemIntoPreviousItem/,
  'blocks model should not re-own visual-list parser, serializer, source autofix, or item merge internals'
);

assert.doesNotMatch(
  editorBlocksModelSource,
  /function parseTableBlock|function serializeTable|function splitPipeTableRow|function parsePipeTableSeparatorCells|function tableSeparatorCell|function serializeTableRow/,
  'blocks model should not re-own pipe-table parser, serializer, or formatting internals'
);

assert.doesNotMatch(
  editorBlocksModelSource,
  /function isBlockEmptyForBackspace|function splitTextBlockIntoParagraph|function joinMergedEditableText|function mergeTextBlockIntoPrevious|function mergeTextBlockIntoPreviousList|function mergeFirstListItemIntoPreviousBlock/,
  'blocks model should not re-own block-flow Backspace, Enter, split, or cross-block merge internals'
);

assert.doesNotMatch(
  editorBlocksModelSource,
  /function makeBlock|function makeBlankBlock|function parseMarkdownBlocks|function classifyChunk|function riskyParagraphReason|function autofixMarkdownSourceBlock|function serializeMarkdownBlocks|function serializeBlock/,
  'blocks model facade should not re-own block core, Markdown parsing, source autofix, or serialization internals'
);

assert.doesNotMatch(
  editorBlocksBlockCoreModelSource,
  /\b(?:document|window|localStorage|CustomEvent|addEventListener|querySelector|createElement|ownerDocument)\b/,
  'blocks core model should stay DOM-free'
);

assert.doesNotMatch(
  editorBlocksMarkdownParseModelSource,
  /\b(?:document|window|localStorage|CustomEvent|addEventListener|querySelector|createElement|ownerDocument)\b/,
  'blocks Markdown parse model should stay DOM-free'
);

assert.doesNotMatch(
  editorBlocksMarkdownSerializeModelSource,
  /\b(?:document|window|localStorage|CustomEvent|addEventListener|querySelector|createElement|ownerDocument)\b/,
  'blocks Markdown serialize model should stay DOM-free'
);

assert.doesNotMatch(
  editorBlocksTableModelSource,
  /\b(?:document|window|localStorage|CustomEvent|addEventListener|querySelector|createElement)\b/,
  'blocks table model should stay DOM-free'
);

assert.doesNotMatch(
  editorBlocksBlockFlowModelSource,
  /\b(?:document|window|localStorage|CustomEvent|addEventListener|querySelector|createElement|ownerDocument)\b/,
  'blocks block-flow model should stay DOM-free'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /import \{[\s\S]*editableTableData,[\s\S]*normalizeTableAlignment,[\s\S]*normalizeTableCellValue,[\s\S]*tableColumnCount,?[\s\S]*\} from '\.\/editor-blocks-table-model\.js'/,
  'blocks block-type session assembly should import table model helpers from the explicit blocks table model boundary before composing the table session'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-runtime\.js'/,
  'blocks editor should cache-bust the explicit blocks runtime boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-session-registry\.js'/,
  'blocks editor should cache-bust the explicit blocks session registry boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-block-actions\.js'/,
  'blocks editor should cache-bust the explicit blocks action coordinator boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-control-factory\.js'/,
  'blocks editor should cache-bust the explicit blocks control factory boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-layout-session\.js'/,
  'blocks editor should cache-bust the explicit blocks layout session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-body-session\.js'/,
  'blocks editor should cache-bust the explicit blocks body session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-state\.js'/,
  'blocks editor should cache-bust the explicit blocks state controller boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-menu-session\.js'/,
  'blocks editor should cache-bust the explicit blocks menu session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-head-session\.js'/,
  'blocks editor should cache-bust the explicit blocks head session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-command-session\.js'/,
  'blocks editor should cache-bust the explicit blocks command session boundary'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /from '\.\/editor-blocks-rich-text-session\.js'/,
  'blocks inline sessions assembly should cache-bust the explicit blocks rich text session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-editable-session\.js'/,
  'blocks editor should cache-bust the explicit blocks editable session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-selection-session\.js'/,
  'blocks editor should cache-bust the explicit blocks selection session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-inline-editing-bridge\.js'/,
  'blocks editor should cache-bust the explicit blocks inline editing bridge boundary'
);

assert.match(
  editorBlocksInlineEditingBridgeSource,
  /from '\.\/editor-blocks-inline-dom-session\.js'/,
  'blocks inline editing bridge should cache-bust the explicit blocks inline DOM session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-caret-session\.js'/,
  'blocks editor should cache-bust the explicit blocks caret session boundary'
);

assert.match(
  editorBlocksCaretSessionSource,
  /from '\.\/editor-blocks-caret-measurement\.js'/,
  'blocks caret session should cache-bust the explicit blocks caret measurement boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-focus-pointer-sessions\.js'/,
  'blocks editor should cache-bust the explicit blocks focus/pointer wiring boundary'
);

assert.match(
  editorBlocksFocusPointerSessionsSource,
  /from '\.\/editor-blocks-focus-session\.js'/,
  'blocks focus/pointer wiring should cache-bust the explicit blocks focus session boundary'
);

assert.match(
  editorBlocksFocusPointerSessionsSource,
  /from '\.\/editor-blocks-pointer-session\.js'/,
  'blocks focus/pointer wiring should cache-bust the explicit blocks pointer session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-active-session\.js'/,
  'blocks editor should cache-bust the explicit blocks active session boundary'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /from '\.\/editor-blocks-inline-toolbar-session\.js'/,
  'blocks inline sessions assembly should cache-bust the explicit blocks inline toolbar session boundary'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /from '\.\/editor-blocks-inline-command-session\.js'/,
  'blocks inline sessions assembly should cache-bust the explicit blocks inline command session boundary'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /from '\.\/editor-blocks-link-session\.js'/,
  'blocks inline sessions assembly should cache-bust the explicit blocks link session boundary'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /from '\.\/editor-blocks-math-session\.js'/,
  'blocks inline sessions assembly should cache-bust the explicit blocks math session boundary'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-block-type-sessions\.js'/,
  'blocks editor should cache-bust the explicit block type sessions assembly boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /from '\.\/editor-blocks-table-session\.js'/,
  'blocks block-type session assembly should cache-bust the explicit blocks table session boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /from '\.\/editor-blocks-card-picker-session\.js'/,
  'blocks block-type session assembly should cache-bust the explicit blocks card picker session boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /from '\.\/editor-blocks-image-session\.js'/,
  'blocks block-type session assembly should cache-bust the explicit blocks image session boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /from '\.\/editor-blocks-code-session\.js'/,
  'blocks block-type session assembly should cache-bust the explicit blocks code session boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /from '\.\/editor-blocks-source-session\.js'/,
  'blocks block-type session assembly should cache-bust the explicit blocks source session boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /from '\.\/editor-blocks-list-session\.js'/,
  'blocks block-type session assembly should cache-bust the explicit blocks list session boundary'
);

assert.match(
  editorBlocksSource,
  /const blockSessions = createEditorBlocksSessionRegistry\(\{[\s\S]*onDiagnostic: typeof options\.onDiagnostic === 'function' \? options\.onDiagnostic : null[\s\S]*\}\);/,
  'blocks editor should create an explicit late-bound session registry at the composition root'
);

assert.match(
  editorBlocksSource,
  /const blockActions = createEditorBlocksBlockActions\(\{[\s\S]*state,[\s\S]*blocksState,[\s\S]*blockSessions,[\s\S]*caretSession,[\s\S]*selectionSession,[\s\S]*getEditableSelectionOffsets,[\s\S]*focusBlockPrimaryEditable,[\s\S]*focusPreviousBlockEnd,[\s\S]*setActive,[\s\S]*emit,[\s\S]*\}\);[\s\S]*insertBlankBlock,[\s\S]*insertBlankBlockAfter,[\s\S]*splitTextBlockAfterCaret,[\s\S]*mergeTextBlockWithPreviousOnBackspace,[\s\S]*deleteBlockAt,[\s\S]*makeSplitListBlock,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*applySourceAutofix/,
  'blocks editor should compose root block mutations through the explicit block action coordinator'
);

assert.match(
  editorBlocksBlockActionsSource,
  /export function createEditorBlocksBlockActions\(\{[\s\S]*const insertBlankBlock = \(index = state\.blocks\.length, options = \{\}\) => \{[\s\S]*const insertBlankBlockAfter = \(index, editable = null, sync = null\) => \{[\s\S]*const splitTextBlockAfterCaret = \(event, block, index, editable = null\) => \{[\s\S]*const mergeTextBlockWithPreviousOnBackspace = \(event, block, index, editable = null\) => \{[\s\S]*const removeEmptyBlockWithBackspace = \(event, block, index, editable = null, sync = null\) => \{[\s\S]*const applySourceAutofix = \(index\) => \{/,
  'blocks action coordinator should own block insertion, split, merge, deletion, and source autofix behavior'
);

assert.match(
  editorBlocksSource,
  /const blockControls = createEditorBlocksControlFactory\(\{[\s\S]*runtime,[\s\S]*text,[\s\S]*updateFromControl,[\s\S]*blockElements,[\s\S]*setActive,[\s\S]*openMathEditorForBlock[\s\S]*\}\);[\s\S]*const \{[\s\S]*autoSizeTextarea,[\s\S]*createBlockTypeIcon,[\s\S]*createHeadingLevelSelect,[\s\S]*createMathEditButton[\s\S]*\} = blockControls;/,
  'blocks editor should compose block control DOM factories through the explicit control factory boundary'
);

assert.match(
  editorBlocksControlFactorySource,
  /const BLOCK_TYPE_ICON_PATHS = \{[\s\S]*paragraph:[\s\S]*heading:[\s\S]*image:[\s\S]*list:[\s\S]*quote:[\s\S]*code:[\s\S]*source:[\s\S]*card:[\s\S]*blank:[\s\S]*export function createEditorBlocksControlFactory\(\{[\s\S]*const createBlockTypeIcon = \(blockType\) => \{[\s\S]*runtime\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*const createHeadingLevelSelect = \(block\) => \{[\s\S]*const createMathEditButton = \(block, index\) => \{[\s\S]*const autoSizeTextarea = \(area\) => \{/,
  'blocks control factory should own block icons, heading select, math edit button, and textarea autosize DOM helpers'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const splitTextBlockAfterCaret = \(event|const mergeTextBlockWithPreviousOnBackspace = \(event|const removeEmptyBlockWithBackspace = \(event|const applySourceAutofix = \(index\) => \{/,
  'blocks root should not own root-local block action implementations'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const BLOCK_TYPE_ICON_PATHS|function createBlockTypeIcon|const createHeadingLevelSelect = \(block\)|const createMathEditButton = \(block, index\)|const autoSizeTextarea = \(area\)|function button\(/,
  'blocks root should not own block control factory implementations'
);

assert.doesNotMatch(
  editorBlocksSource,
  /let\s+(?:commandSession|focusSession|pointerSession|activeSession|bodySession|layoutSession|listSession|cardPickerSession)\s*=|let\s+(?:refreshLinkEditor|openLinkEditorForSelection|openMathEditorForSelection|openMathEditorForNode|openMathEditorForBlock|updateInlineToolbarState)\s*=/,
  'blocks editor should not reintroduce ad hoc late-bound session slots at the root'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const\s+fallback(?:Selection|InlineDom|Caret)Session\s*=/,
  'blocks editor should not keep module-level fallback session singletons'
);

assert.match(
  editorBlocksSource,
  /from '\.\/editor-blocks-inline-editing-bridge\.js'/,
  'blocks editor should import the inline editing bridge boundary'
);

assert.match(
  editorBlocksInlineEditingBridgeSource,
  /function createFallbackSelectionSession\(documentRef = null\) \{[\s\S]*return createEditorBlocksSelectionSession\(\{ documentRef, windowRef \}\);[\s\S]*function normalizeSelectionSession\(selectionSession, documentRef = null\) \{[\s\S]*: createFallbackSelectionSession\(documentRef\);[\s\S]*function normalizeInlineDomSession\(inlineDomSession\) \{[\s\S]*: createInlineDomSession\(\);[\s\S]*function normalizeCaretSession\(caretSessionOrSelectionSession\) \{[\s\S]*return createCaretSession\(\);/,
  'blocks inline editing bridge should create document-aware temporary fallback sessions at call time instead of retaining hidden module state'
);

assert.match(
  editorBlocksInlineEditingBridgeSource,
  /export function createInlineDomSession\(selectionSession = null, documentRef = null, renderMath = null\)[\s\S]*export function createCaretSession\(selectionSession = null, documentRef = null\)[\s\S]*export function inlineRunsFromDom\(root\)[\s\S]*export function splitEditableTextAtSelection\(el, selectionSession = null\)[\s\S]*export function insertCodeEditableTextAtSelection\(el, value, selectionSession = null\)[\s\S]*export function selectionLinkInEditable\(editable, selectionSession = null\)[\s\S]*export function selectionMathInEditable\(editable, selectionSession = null\)/,
  'blocks inline editing bridge should own inline DOM conversion, caret wrappers, code insertion, and active link/math lookup'
);

assert.doesNotMatch(
  editorBlocksSource,
  /function inlineRunsFromDom|function serializeInlineDom|function splitEditableTextAtSelection|function selectionLinkInEditable|function selectionMathInEditable|function insertCodeEditableTextAtSelection|function nodeContains|function closestElement/,
  'blocks editor root should not own inline DOM, caret, selection, or code-editing helper implementations'
);

assert.match(
  editorBlocksCaretSessionSource,
  /function createFallbackSelectionSession\(\) \{[\s\S]*return createEditorBlocksSelectionSession\(\);[\s\S]*function normalizeSelectionSession\(selectionSession\) \{[\s\S]*: createFallbackSelectionSession\(\);/,
  'blocks caret session should create fallback selection tools at caret-session construction time'
);

assert.doesNotMatch(
  editorBlocksCaretSessionSource,
  /const\s+fallbackSelectionSession\s*=/,
  'blocks caret session should not keep a module-level fallback selection singleton'
);

assert.match(
  editorBlocksCaretMeasurementSource,
  /export function measuredTextOffsetDetailsFromPoint[\s\S]*export function textareaTextOffsetDetailsFromPoint[\s\S]*export function visualLineRects/,
  'blocks caret measurement boundary should own point-to-text, textarea mirror, and visual-line geometry'
);

assert.match(
  editorBlocksSessionRegistrySource,
  /const SERVICE_NAMES = \[[\s\S]*'activeSession'[\s\S]*'bodySession'[\s\S]*'cardPickerSession'[\s\S]*'commandSession'[\s\S]*'focusSession'[\s\S]*'inlineToolbarSession'[\s\S]*'layoutSession'[\s\S]*'linkSession'[\s\S]*'listSession'[\s\S]*'mathSession'[\s\S]*'pointerSession'[\s\S]*\];/,
  'blocks session registry should name every allowed late-bound editor blocks dependency'
);

assert.match(
  editorBlocksSessionRegistrySource,
  /export const EDITOR_BLOCKS_SESSION_CALLS = Object\.freeze\(\{[\s\S]*focusBlockPrimaryEditable: Object\.freeze\(\{ slot: 'focusSession', method: 'focusBlockPrimaryEditable', fallback: false \}\)[\s\S]*setCardEntries: Object\.freeze\(\{ slot: 'cardPickerSession', method: 'setEntries', fallback: false, handled: true \}\)[\s\S]*focusBlockPrimaryEditable: \(\.\.\.args\) => call\(EDITOR_BLOCKS_SESSION_CALLS\.focusBlockPrimaryEditable, \.\.\.args\),[\s\S]*setCardEntries: \(\.\.\.args\) => handledCall\(EDITOR_BLOCKS_SESSION_CALLS\.setCardEntries, \.\.\.args\),[\s\S]*setFocusSession: \(service\) => set\('focusSession', service\),/,
  'blocks session registry should expose explicit contract descriptors, setters, and behavior proxies instead of anonymous function slots'
);

assert.match(
  editorBlocksSessionRegistrySource,
  /function createDiagnostic\(entry = \{\}\)[\s\S]*reason[\s\S]*export function createEditorBlocksSessionRegistry\(options = \{\}\)[\s\S]*clearDiagnostics: \(\) => \{[\s\S]*diagnostics\.splice[\s\S]*getDiagnostics: \(\) => diagnostics\.slice\(\)/,
  'blocks session registry should report contract diagnostics instead of silently swallowing session mismatches'
);

assert.match(
  editorBlocksSource,
  /const \{[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*routeBlocksCaretFromPointer,[\s\S]*shouldSuppressRoutedBlockContainerClick[\s\S]*\} = createEditorBlocksFocusPointerSessions\(\{[\s\S]*state,[\s\S]*blocksState,[\s\S]*blockSessions,[\s\S]*caretSession,[\s\S]*editableSession,[\s\S]*selectionSession,[\s\S]*blockElements,[\s\S]*closestElement,[\s\S]*containsNode: nodeContains,[\s\S]*editableListItems,[\s\S]*setActive,[\s\S]*activateEditableFromPointer,[\s\S]*activateNonTextBlockFromPointer,[\s\S]*autoSizeTextarea: area => autoSizeTextarea\(area\),[\s\S]*updateInlineToolbarState: \(\) => updateInlineToolbarState\(\),[\s\S]*queueTask: task => queueMicrotask\(task\),[\s\S]*measureLimit: CARET_POINT_MEASURE_LIMIT/,
  'blocks editor should compose focus and pointer routing through the focus/pointer wiring boundary'
);

assert.match(
  editorBlocksFocusPointerSessionsSource,
  /export function createEditorBlocksFocusPointerSessions\(options = \{\}\)[\s\S]*createEditorBlocksFocusSession\(\{[\s\S]*blocksState,[\s\S]*editableListItems[\s\S]*activateNonTextBlockFromPointer[\s\S]*createEditorBlocksPointerSession\(\{[\s\S]*blocksState,[\s\S]*selectionSession[\s\S]*activateEditableFromPointer[\s\S]*routeBlocksCaretFromPointer: \(\.\.\.args\) => callSession\(pointerSession, 'routeBlocksCaretFromPointer'/,
  'blocks focus/pointer wiring boundary should own focus and pointer session construction plus routed caret proxies'
);

assert.doesNotMatch(
  editorBlocksSource,
  /createEditorBlocksFocusSession\(|createEditorBlocksPointerSession\(|const shouldSuppressRoutedBlockContainerClick = \(\) =>|const routeBlocksCaretFromPointer = \(event\) =>/,
  'blocks editor root should not re-own focus/pointer session construction or routed caret proxy internals'
);

assert.match(
  editorBlocksSource,
  /const caretSession = createCaretSession\(selectionSession, blocksDocument\);/,
  'blocks editor should pass the explicit runtime document into the caret session'
);

assert.match(
  editorBlocksSource,
  /const activeSession = blockSessions\.setActiveSession\(createEditorBlocksActiveSession\(\{[\s\S]*state,[\s\S]*blocksState,[\s\S]*list,[\s\S]*runtime,[\s\S]*containsNode: nodeContains,[\s\S]*syncActiveListTypeSelect,[\s\S]*refreshLinkEditor,[\s\S]*updateInlineToolbarState,[\s\S]*syncActiveTableAlignmentFromEditable,[\s\S]*requestStickyBlockHeadUpdate,[\s\S]*clearNativeSelection[\s\S]*\}\)\);/,
  'blocks editor should compose active block state transitions through the active session boundary'
);

assert.match(
  editorBlocksSource,
  /const \{[\s\S]*inlineToolbarSession,[\s\S]*createRichEditable,[\s\S]*wireInlineEditable[\s\S]*\} = createEditorBlocksInlineSessions\(\{[\s\S]*documentRef: blocksDocument,[\s\S]*root,[\s\S]*list,[\s\S]*runtime,[\s\S]*state,[\s\S]*blocksState,[\s\S]*blockSessions,[\s\S]*editableSession,[\s\S]*selectionSession,[\s\S]*caretSession,[\s\S]*inlineDomSession,[\s\S]*menuSession,[\s\S]*renderMath: renderMathWithRuntime,[\s\S]*refreshLinkEditor: link => refreshLinkEditor\(link\),[\s\S]*openMathEditorForNode: node => openMathEditorForNode\(node\),[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*mergeTextBlockWithPreviousOnBackspace,[\s\S]*insertBlankBlockAfter,[\s\S]*onDocument,[\s\S]*onWindow[\s\S]*\}\);/,
  'blocks editor should compose inline command, popover, toolbar, and rich text sessions through the inline sessions boundary'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /const inlineCommandSession = createInlineCommandSession\(\{[\s\S]*openLinkEditorForSelection: openLinkForSelection,[\s\S]*openMathEditorForSelection: openMathForSelection[\s\S]*const linkSession = blockSessions\?\.setLinkSession\?\.\(createLinkSession\(\{[\s\S]*selectionLinkInEditable[\s\S]*const mathSession = blockSessions\?\.setMathSession\?\.\(createMathSession\(\{[\s\S]*selectionMathInEditable[\s\S]*const inlineToolbarSession = blockSessions\?\.setInlineToolbarSession\?\.\(createInlineToolbarSession\(\{[\s\S]*applyInlineCommand[\s\S]*const richTextSession = createRichTextSession\(\{[\s\S]*applyRunsToEditable/,
  'inline sessions boundary should own inline command, link, math, toolbar, and rich text session construction'
);

assert.match(
  editorBlocksInlineCommandSessionSource,
  /function defaultInlineCommandMark\(kind\)[\s\S]*export function createEditorBlocksInlineCommandSession\(\{[\s\S]*const applyRunsToEditable = \(editable, runs, caretOffset = null\) => \{[\s\S]*renderInlineRunsInto\(editable, runs, inlineDomSession\);[\s\S]*syncActiveEditable\(\);[\s\S]*updateInlineToolbarState\(\);[\s\S]*const applyInlineCommand = \(kind\) => \{[\s\S]*if \(kind === 'link'\) \{[\s\S]*openLinkEditorForSelection\(\);[\s\S]*if \(kind === 'math'\) \{[\s\S]*openMathEditorForSelection\(\);[\s\S]*removeInlineMarkInRange\(runs, codeRange\.start, codeRange\.end, mark\);[\s\S]*removeInlineMarkAroundOffset\(runs, offsets\.start, mark\);[\s\S]*toggleInlineMarkOnRuns\(runs, offsets\.start, offsets\.end, inlineCommandMark\(kind\)\);/,
  'inline command session should own command-to-inline-run mutation, pending mark, and link/math delegation behavior'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const togglePendingInlineMark = \(kind\)|const applyInlineCommand = \(kind\) => \{[\s\S]*toggleInlineMarkOnRuns|const applyRunsToEditable = \(editable, runs, caretOffset = null\) => \{/,
  'blocks editor root should not own inline command mutation internals'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /const richTextSession = createRichTextSession\(\{[\s\S]*documentRef,[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*selectionSession,[\s\S]*inlineDomSession,[\s\S]*caretSession,[\s\S]*setPlainContentEditableValue,[\s\S]*inlineRunsFromDom,[\s\S]*inlineRun,[\s\S]*insertInlineRunsAtRange,[\s\S]*getEditableSelectionOffsets,[\s\S]*applyRunsToEditable,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*mergeTextBlockWithPreviousOnBackspace,[\s\S]*splitTextBlockAfterCaret,[\s\S]*inlineMarksFromPointerEvent,[\s\S]*inlineMarkedDomRangeFromPointerEvent,[\s\S]*updateInlineToolbarState: refreshToolbar,[\s\S]*refreshLinkEditor: refreshLink,[\s\S]*openMathEditorForNode: openMathForNode[\s\S]*\}\);[\s\S]*createRichEditable: \(\.\.\.args\) => richTextSession\?\.createRichEditable\?\.\(\.\.\.args\),[\s\S]*wireInlineEditable: \(\.\.\.args\) => richTextSession\?\.wireInlineEditable\?\.\(\.\.\.args\)/,
  'blocks editor should compose rich text editable DOM and input events through the rich text session boundary'
);

assert.doesNotMatch(
  editorBlocksSource,
  /const insertPendingInlineText = \(editable|const wireInlineEditable = \(editable|const createRichEditable = \(tagName|editable\.addEventListener\('beforeinput', \(event\) => \{[\s\S]*insertPendingInlineText/,
  'blocks root should not own rich text editable DOM event wiring'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /const refreshLink = refreshLinkEditor \|\| \(link => blockSessions\?\.refreshLinkEditor\?\.\(link\)\);[\s\S]*const linkSession = blockSessions\?\.setLinkSession\?\.\(createLinkSession\(\{[\s\S]*documentRef,[\s\S]*root,[\s\S]*runtime,[\s\S]*blocksState,[\s\S]*selectionSession,[\s\S]*caretSession,[\s\S]*inlineDomSession,[\s\S]*containsNode,[\s\S]*closestElement,[\s\S]*sanitizeLinkHref: sanitizeEditorLinkHref,[\s\S]*sanitizeLinkTitle: sanitizeEditorLinkTitle,[\s\S]*selectionLinkInEditable,[\s\S]*getEditableSelectionOffsets,[\s\S]*applyInlineLinkToRuns,[\s\S]*textRangeForDomNode,[\s\S]*linkForTextRange,[\s\S]*updateInlineToolbarState: refreshToolbar,[\s\S]*onDocument,[\s\S]*onWindow[\s\S]*\}\)\);/,
  'blocks editor should compose inline link overlay behavior through the link session boundary'
);

assert.match(
  editorBlocksInlineSessionsSource,
  /const openMathForSelection = openMathEditorForSelection \|\| \(\(\) => blockSessions\?\.openMathEditorForSelection\?\.\(\)\);[\s\S]*const openMathForNode = openMathEditorForNode \|\| \(node => blockSessions\?\.openMathEditorForNode\?\.\(node\)\);[\s\S]*const mathSession = blockSessions\?\.setMathSession\?\.\(createMathSession\(\{[\s\S]*documentRef,[\s\S]*root,[\s\S]*list,[\s\S]*runtime,[\s\S]*blocksState,[\s\S]*selectionSession,[\s\S]*caretSession,[\s\S]*inlineDomSession,[\s\S]*containsNode,[\s\S]*closestElement,[\s\S]*renderMath,[\s\S]*getMathBlockById: id => \(Array\.isArray\(state\.blocks\)[\s\S]*getEditableSelectionOffsets,[\s\S]*caretRectForEditable,[\s\S]*selectionMathInEditable,[\s\S]*applyInlineMathToRuns,[\s\S]*textRangeForDomNode,[\s\S]*updateInlineToolbarState: refreshToolbar,[\s\S]*updateFromControl,[\s\S]*onDocument[\s\S]*\}\)\);/,
  'blocks editor should compose inline and display math overlay behavior through the math session boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /const tableSession = createTableSession\(\{[\s\S]*documentRef,[\s\S]*runtime,[\s\S]*blocksState,[\s\S]*editableSession,[\s\S]*blockElements,[\s\S]*text,[\s\S]*editableTableData,[\s\S]*tableColumnCount,[\s\S]*normalizeTableAlignment,[\s\S]*normalizeTableCellValue,[\s\S]*setActive,[\s\S]*activateEditableFromPointer,[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*updateFromControl,[\s\S]*queueTask[\s\S]*\}\);[\s\S]*syncActiveTableAlignmentFromEditable = \(activeBlock, editable\) => \{[\s\S]*tableSession\?\.syncActiveAlignmentFromEditable\?\.\(activeBlock, editable, Array\.isArray\(state\.blocks\) \? state\.blocks : \[\]\);/,
  'blocks block-type session assembly should compose table DOM, active-cell, and control behavior through the table session boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /const codeSession = createCodeSession\(\{[\s\S]*documentRef,[\s\S]*runtime,[\s\S]*editableSession,[\s\S]*text,[\s\S]*selectionSession,[\s\S]*codeEditableText,[\s\S]*insertCodeEditableTextAtSelection,[\s\S]*removeEmptyBlockWithBackspace,[\s\S]*handleCrossBlockArrowNavigation,[\s\S]*updateFromControl,[\s\S]*setActive,[\s\S]*activateEditableFromPointer,[\s\S]*createHighlightFragment: \(code, language\) => createHighlightFragment\(code, language, \{[\s\S]*documentRef,[\s\S]*windowRef,[\s\S]*allowAmbient: false[\s\S]*\}\)[\s\S]*\}\);/,
  'blocks block-type session assembly should compose code block DOM and control behavior through the code session boundary'
);

assert.match(
  editorBlocksBlockTypeSessionsSource,
  /const cardPickerSession = registerSession\(blockSessions, 'setCardPickerSession', createCardPickerSession\(\{[\s\S]*documentRef,[\s\S]*runtime,[\s\S]*blocksState,[\s\S]*text,[\s\S]*insertCardBlock: \(data, index\) => blockSessions\?\.insertCommandBlock\?\.\('card', data, \{ index \}\) \|\| null,[\s\S]*requestRender: \(\) => render\(\)[\s\S]*\}\)\);[\s\S]*if \(cardPickerSession\?\.element\) root\?\.appendChild\?\.\(cardPickerSession\.element\);/,
  'blocks block-type session assembly should compose article-card picker DOM and result selection through the card picker session boundary'
);

assert.match(
  editorBlocksFocusPointerSessionsSource,
  /handleCrossBlockArrowNavigation: \(\.\.\.args\) => callSession\(focusSession, 'handleCrossBlockArrowNavigation', false, \.\.\.args\)/,
  'blocks focus/pointer wiring should delegate cross-block arrow navigation to the registered focus session'
);

assert.match(
  editorBlocksFocusPointerSessionsSource,
  /routeBlocksCaretFromPointer: \(\.\.\.args\) => callSession\(pointerSession, 'routeBlocksCaretFromPointer', false, \.\.\.args\)/,
  'blocks focus/pointer wiring should delegate blank-area pointer caret routing to the registered pointer session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /document\.(?:addEventListener|removeEventListener|createElement|createElementNS|createRange|createTextNode|caretPositionFromPoint|caretRangeFromPoint)|window\.(?:addEventListener|removeEventListener|setTimeout|clearTimeout|requestAnimationFrame|getSelection)|(?<!\.)setTimeout\(|navigator\.clipboard|window\.__press_t|window\.isSecureContext|document\.activeElement|document\.getElementById|\bNodeFilter\b/,
  'blocks editor should route global listeners, DOM factories, clipboard, timers, translation, active-element access, and browser selection/range/caret APIs through explicit runtime boundaries'
);

assert.match(
  `${editorBlocksSource}\n${editorBlocksInlineCommandSessionSource}\n${editorBlocksMathSessionSource}`,
  /const inlineDomSession = createInlineDomSession\(selectionSession, blocksDocument, renderMathWithRuntime\);[\s\S]*renderInlineRunsInto\(editable, runs, inlineDomSession\)[\s\S]*textRangeForDomNode\(editable, mathNode, inlineDomSession\)/,
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

assert.doesNotMatch(
  editorBlocksInlineDomSessionSource,
  /ownerDocument|defaultView|typeof window/,
  'blocks inline DOM session should not derive document/window APIs from caller node ownerDocument/defaultView'
);

// composer-identity-body:end
