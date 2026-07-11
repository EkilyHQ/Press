import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerModeControllerSource = readIdentitySource('../assets/js/composer-mode-controller.js');

const composerMarkdownWorkspaceSource = readIdentitySource('../assets/js/composer-markdown-workspace.js');

const editorMainBlocksSessionSource = readIdentitySource('../assets/js/editor-main-blocks-session.js');

const editorMainDocumentSessionSource = readIdentitySource('../assets/js/editor-main-document-session.js');

const editorBlocksSource = readIdentitySource('../assets/js/editor-blocks.js');

const editorBlocksMarkdownParseModelSource = readIdentitySource('../assets/js/editor-blocks-markdown-parse-model.js');

const editorBlocksMarkdownSerializeModelSource = readIdentitySource(
  '../assets/js/editor-blocks-markdown-serialize-model.js'
);

const editorBlocksBlockFlowModelSource = readIdentitySource('../assets/js/editor-blocks-block-flow-model.js');

const editorBlocksBlockActionsSource = readIdentitySource('../assets/js/editor-blocks-block-actions.js');

const editorBlocksStateSource = readIdentitySource('../assets/js/editor-blocks-state.js');

const editorBlocksCommandSessionSource = readIdentitySource('../assets/js/editor-blocks-command-session.js');

const editorBlocksRichTextSessionSource = readIdentitySource('../assets/js/editor-blocks-rich-text-session.js');

const editorBlocksCaretSessionSource = readIdentitySource('../assets/js/editor-blocks-caret-session.js');

const editorBlocksFocusSessionSource = readIdentitySource('../assets/js/editor-blocks-focus-session.js');

const editorBlocksBlockTypeSessionsSource = readIdentitySource('../assets/js/editor-blocks-block-type-sessions.js');

const editorBlocksInlineToolbarSessionSource = readIdentitySource(
  '../assets/js/editor-blocks-inline-toolbar-session.js'
);

const editorBlocksCodeSessionSource = readIdentitySource('../assets/js/editor-blocks-code-session.js');

const editorBlocksSourceSessionSource = readIdentitySource('../assets/js/editor-blocks-source-session.js');

const editorBlocksListSessionSource = readIdentitySource('../assets/js/editor-blocks-list-session.js');

const enI18nSource = readIdentitySource('../assets/i18n/en.js');

const chsI18nSource = readIdentitySource('../assets/i18n/chs.js');

const chtTwI18nSource = readIdentitySource('../assets/i18n/cht-tw.js');

const jaI18nSource = readIdentitySource('../assets/i18n/ja.js');

// composer-identity-body:start

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
  /const markdownWorkspace = createComposerMarkdownWorkspaceFacade\(\{[\s\S]*getController: \(\) => markdownWorkspaceController[\s\S]*\}\);[\s\S]*restorePrimaryEditorMarkdownView,[\s\S]*= markdownWorkspace;/,
  'composer should route markdown view restoration through the workspace facade'
);

assert.match(
  composerModeControllerSource,
  /function applyDynamicMode\(nextMode, optionsForMode, editorApi\)[\s\S]*restorePrimaryEditorMarkdownView\(editorApi\);/,
  'mode controller should restore the persisted markdown editor view when opening markdown files'
);

assert.match(
  `${editorBlocksMarkdownParseModelSource}\n${editorBlocksMarkdownSerializeModelSource}\n${editorBlocksSource}`,
  /export function parseMarkdownBlocks\(markdown\)[\s\S]*export function serializeMarkdownBlocks\(blocks\)[\s\S]*export function createMarkdownBlocksEditor\(root, options = \{\}\)/,
  'blocks mode should provide delegated parser/serializer and DOM controller entrypoints'
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
  `${editorBlocksSource}\n${editorBlocksBlockTypeSessionsSource}\n${editorBlocksCommandSessionSource}`,
  /const commandSession = blockSessions\.setCommandSession\(createEditorBlocksCommandSession\(\{[\s\S]*placeCommandBlock,[\s\S]*getCardPickerSession: \(\) => blockSessions\.getCardPickerSession\(\),[\s\S]*insertCardBlock: \(data, index\) => blockSessions\?\.insertCommandBlock\?\.\('card', data, \{ index \}\) \|\| null[\s\S]*const insertCommandBlock = \(type, data = \{\}, options = \{\}\) => \{[\s\S]*blocksState\.beginCommandBlockInsert\(options\)[\s\S]*placeCommandBlock\(type, cloneCommandData\(data\), insertIndex\)[\s\S]*const openArticleCardCommand = \(\) => \{[\s\S]*const insertIndex = commandInsertIndex\(\);[\s\S]*cardPickerSession\.open\(insertIndex\);/,
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
  /function isSelectionOnBlankLine\(el\) \{[\s\S]*const offsets = selectionOffsets\(el\);[\s\S]*!offsets\.collapsed[\s\S]*if \(text\.slice\(lineStart, lineEnd\)\.trim\(\) === ''\) return true;[\s\S]*const caretRect = rectForEditable\(el\);[\s\S]*selectionTools\.createTreeWalker\(el, CARET_TEXT_NODE_FILTER\)[\s\S]*range\.selectNodeContents\(node\);[\s\S]*const hasTextOnCaretLine = rects\.some[\s\S]*if \(hasTextOnCaretLine\)[\s\S]*return true;/,
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
  editorBlocksBlockActionsSource,
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
  editorBlocksBlockFlowModelSource,
  /export function isBlockEmptyForBackspace\(block\) \{[\s\S]*block\.type === 'blank'[\s\S]*block\.type === 'paragraph'[\s\S]*block\.type === 'heading'[\s\S]*block\.type === 'quote'[\s\S]*block\.type === 'code'[\s\S]*block\.type === 'source'[\s\S]*block\.type === 'image'[\s\S]*block\.type === 'card'[\s\S]*block\.type === 'list'[\s\S]*editableListItems\(data\.items\)\.every\(item => blank\(item && item\.text\) && !item\.checked\);/,
  'empty block backspace detection should cover blank, text, media, card, and list user-authored content'
);

assert.match(
  editorBlocksFocusSessionSource,
  /function focusListItemEditable\(block, itemIndex, options = \{\}\) \{[\s\S]*const items = blockEl\.querySelectorAll\('\.blocks-list-item \.blocks-list-text'\);[\s\S]*else if \(options\.atEnd\) placeEditableAtEnd\(editable\);[\s\S]*function focusPreviousBlockEnd\(index\) \{[\s\S]*if \(target\.type === 'list'\) \{[\s\S]*const itemIndex = listItems\(target\.data && target\.data\.items\)\.length - 1;[\s\S]*focusListItemEditable\(target, itemIndex, \{ atEnd: true \}\);[\s\S]*return;[\s\S]*focusBlockPrimaryEditable\(target\);/,
  'blocks focus session should move focus to the previous block end, including the last list item'
);

assert.match(
  `${editorBlocksBlockActionsSource}\n${editorBlocksStateSource}`,
  /const removeEmptyBlockWithBackspace = \(event, block, index, editable = null, sync = null\) => \{[\s\S]*!plainKey\(event, 'Backspace'\)[\s\S]*index <= 0[\s\S]*isEditableBackspaceAtEmptyStart\(editable, selectionSession\)[\s\S]*isBlockEmptyForBackspace\(block\)[\s\S]*blocksState\.removeBlock\(index\);[\s\S]*render\(\);[\s\S]*focusPreviousBlockEnd\(index\);[\s\S]*emit\(\);[\s\S]*function removeBlock\(index, options = \{\}\) \{[\s\S]*replaceBlocks\(index, 1, \[\], options\)/,
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
  /const indentItem = \(block, index, delta\) => \{[\s\S]*activeListItemIndex\(block, index\)[\s\S]*indent: nextIndent,[\s\S]*indentText: ' {2}'\.repeat\(nextIndent\)[\s\S]*blocksState\.setPendingListFocus\(\{ blockId: block\.id, itemIndex, atEnd: false \}\);[\s\S]*if \(event\.key === 'Tab'[\s\S]*indentItem\(block, index, event\.shiftKey \? -1 : 1\);/,
  'Tab and toolbar list indentation should share the same list session item indentation path'
);

// composer-identity-body:end
