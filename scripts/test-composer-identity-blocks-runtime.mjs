import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const editorBlocksSource = readIdentitySource('../assets/js/editor-blocks.js');

const editorBlocksRuntimeSource = readIdentitySource('../assets/js/editor-blocks-runtime.js');

const editorBlocksStateSource = readIdentitySource('../assets/js/editor-blocks-state.js');

const editorBlocksCaretSessionSource = readIdentitySource('../assets/js/editor-blocks-caret-session.js');

const editorBlocksFocusSessionSource = readIdentitySource('../assets/js/editor-blocks-focus-session.js');

const editorBlocksPointerSessionSource = readIdentitySource('../assets/js/editor-blocks-pointer-session.js');

const editorBlocksInlineCommandSessionSource = readIdentitySource(
  '../assets/js/editor-blocks-inline-command-session.js'
);

// composer-identity-body:start

assert.match(
  `${editorBlocksSource}\n${editorBlocksInlineCommandSessionSource}\n${editorBlocksPointerSessionSource}\n${editorBlocksFocusSessionSource}`,
  /const caretSession = createCaretSession\(selectionSession, blocksDocument\);[\s\S]*getEditableSelectionOffsets\(editable, caretSession\)[\s\S]*caretSession\.measuredTextOffsetDetailsFromPoint\(editable, x, y, measureLimit\)[\s\S]*caretSession\.placeAtTextOffset\(editable, measuredDetails\.offset\)[\s\S]*caretSession\.textareaTextOffsetFromPoint\(area, x, y, measureLimit\)[\s\S]*caretSession\.placeAtVisualLine\(editable, x, edge, fallbackOffset\)/,
  'blocks editor should route caret offsets, visual-line placement, and textarea mirror measurement through the caret session'
);

assert.match(
  editorBlocksCaretSessionSource,
  /export function createEditorBlocksCaretSession\([\s\S]*function selectionOffsets\(el\)[\s\S]*function isSelectionOnBlankLine\(el\)[\s\S]*function measuredTextOffsetDetailsFromPoint\(el, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*measureTextOffsetDetailsFromPoint\(el, x, y, \{ selectionTools, limit \}\)[\s\S]*function textareaTextOffsetDetailsFromPoint\(area, x, y, limit = CARET_POINT_MEASURE_LIMIT\)[\s\S]*measureTextareaTextOffsetDetailsFromPoint\(area, x, y,[\s\S]*function placeAtVisualLine\(el, x, edge, fallbackOffset = 0\)[\s\S]*return \{[\s\S]*selectionOffsets,[\s\S]*isSelectionOnBlankLine,[\s\S]*measuredTextOffsetDetailsFromPoint,[\s\S]*textareaTextOffsetDetailsFromPoint,[\s\S]*placeAtVisualLine/,
  'blocks caret session should own selection offsets and visual-line placement while delegating low-level measurement geometry'
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
  /export function createEditorBlocksRuntime\([\s\S]*async function writeClipboardText\(text\)[\s\S]*function translate\(key, fallback\)[\s\S]*onDocument: appRuntime\.events\.onDocument,[\s\S]*onWindow: appRuntime\.events\.onWindow,[\s\S]*createElement: appRuntime\.browser\.createElement,[\s\S]*createElementNS: appRuntime\.browser\.createElementNS,[\s\S]*requestFrame: appRuntime\.browser\.requestFrame,[\s\S]*setTimer: appRuntime\.browser\.setTimer,[\s\S]*clearTimer: appRuntime\.browser\.clearTimer,[\s\S]*writeClipboardText,[\s\S]*translate/,
  'blocks runtime should expose listener, DOM factory, clipboard, timer, viewport, and translation adapters through the shared app runtime facade'
);

assert.match(
  editorBlocksRuntimeSource,
  /from '\.\/editor-app-runtime\.js'[\s\S]*const appRuntime = createEditorAppRuntime\(\{ documentRef, windowRef, storage: null \}\)[\s\S]*appRuntime\.browser\.getNavigator\(\)[\s\S]*appRuntime\.browser\.writeClipboardText\(text, blocksNavigatorRef\)[\s\S]*appRuntime\.globals\.get\(TRANSLATE_GLOBAL\)/,
  'blocks runtime should delegate browser globals and clipboard details to the shared editor app runtime facade'
);

assert.doesNotMatch(
  editorBlocksRuntimeSource,
  /documentRef\s*=\s*typeof document|windowRef\s*=\s*typeof window|navigatorRef\s*=\s*typeof navigator|typeof (?:document|window|navigator|requestAnimationFrame|setTimeout|clearTimeout|getComputedStyle)\b|(^|[^.])\b(?:requestAnimationFrame|setTimeout|clearTimeout|getComputedStyle)\s*\(|(?:documentRef|windowRef)\.|(?:documentRef|windowRef)\s*&&/m,
  'blocks runtime should use injected refs instead of ambient browser global fallbacks'
);

assert.doesNotMatch(
  editorBlocksRuntimeSource,
  /navigatorRef && navigatorRef\.clipboard|windowRef && windowRef\.isSecureContext|runtime\.browser\.isSecureContext\(|windowRef\.__press_t|windowRef\.requestAnimationFrame|windowRef\.setTimeout|windowRef\.clearTimeout|windowRef\.getComputedStyle|windowRef\.matchMedia/,
  'blocks runtime should not reimplement clipboard, translation, timer, style, media, or secure-context browser checks outside the shared app runtime'
);

// composer-identity-body:end
