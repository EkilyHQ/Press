import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const editorMainBlocksSessionSource = readIdentitySource('../assets/js/editor-main-blocks-session.js');

const editorBlocksSource = readIdentitySource('../assets/js/editor-blocks.js');

const editorBlocksInlineModelSource = readIdentitySource('../assets/js/editor-blocks-inline-model.js');

const editorBlocksLayoutSessionSource = readIdentitySource('../assets/js/editor-blocks-layout-session.js');

const editorBlocksBodySessionSource = readIdentitySource('../assets/js/editor-blocks-body-session.js');

const editorBlocksStateSource = readIdentitySource('../assets/js/editor-blocks-state.js');

const editorBlocksMenuSessionSource = readIdentitySource('../assets/js/editor-blocks-menu-session.js');

const editorBlocksHeadSessionSource = readIdentitySource('../assets/js/editor-blocks-head-session.js');

const editorBlocksRichTextSessionSource = readIdentitySource('../assets/js/editor-blocks-rich-text-session.js');

const editorBlocksEditableSessionSource = readIdentitySource('../assets/js/editor-blocks-editable-session.js');

const editorBlocksSelectionSessionSource = readIdentitySource('../assets/js/editor-blocks-selection-session.js');

const editorBlocksCaretSessionSource = readIdentitySource('../assets/js/editor-blocks-caret-session.js');

const editorBlocksCaretMeasurementSource = readIdentitySource('../assets/js/editor-blocks-caret-measurement.js');

const editorBlocksInlineEditingBridgeSource = readIdentitySource('../assets/js/editor-blocks-inline-editing-bridge.js');

const editorBlocksPointerSessionSource = readIdentitySource('../assets/js/editor-blocks-pointer-session.js');

const editorBlocksFocusPointerSessionsSource = readIdentitySource(
  '../assets/js/editor-blocks-focus-pointer-sessions.js'
);

const editorBlocksActiveSessionSource = readIdentitySource('../assets/js/editor-blocks-active-session.js');

const editorBlocksInlineToolbarSessionSource = readIdentitySource(
  '../assets/js/editor-blocks-inline-toolbar-session.js'
);

const editorBlocksInlineCommandSessionSource = readIdentitySource(
  '../assets/js/editor-blocks-inline-command-session.js'
);

const editorBlocksLinkSessionSource = readIdentitySource('../assets/js/editor-blocks-link-session.js');

const editorBlocksCodeSessionSource = readIdentitySource('../assets/js/editor-blocks-code-session.js');

const editorBlocksSourceSessionSource = readIdentitySource('../assets/js/editor-blocks-source-session.js');

const editorBlocksListSessionSource = readIdentitySource('../assets/js/editor-blocks-list-session.js');

const editorSource = readIdentitySource('../index_editor.html');

// composer-identity-body:start

assert.match(
  `${editorBlocksInlineModelSource}\n${editorBlocksSource}\n${editorBlocksInlineToolbarSessionSource}`,
  /function inlineRangeAnyMarked\(runs, start, end, mark\)[\s\S]*next > safeStart && cursor < safeEnd && !!run\[mark\][\s\S]*const shouldApply = command === 'code'[\s\S]*inlineRangeAnyMarked\(runs, start, end, command\)[\s\S]*inlineRangeAnyMarked\(runs, offsets\.start, offsets\.end, mark\)/,
  'B/I/S inline formatting should treat mixed selected ranges as active when any selected text has the mark'
);

assert.match(
  editorBlocksInlineModelSource,
  /function inlineMarksAtOffset\(runs, offset\)[\s\S]*let previous = null;[\s\S]*target === cursor \|\| \(target > cursor && target < next\)[\s\S]*if \(target === next\) previous = run;[\s\S]*previous \|\| safeRuns\[safeRuns\.length - 1\]/,
  'collapsed caret inline formatting should prefer the right-hand run at mark boundaries and only fall back to the previous run at the end'
);

assert.match(
  `${editorBlocksInlineEditingBridgeSource}\n${editorBlocksSource}\n${editorBlocksRichTextSessionSource}\n${editorBlocksListSessionSource}`,
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
  /const explicitDocumentRef = options\.documentRef \|\| null;[\s\S]*const explicitWindowRef = options\.windowRef \|\| null;[\s\S]*documentRef: explicitDocumentRef,[\s\S]*windowRef: explicitWindowRef,[\s\S]*const blocksDocument = runtime\.documentRef \|\| explicitDocumentRef \|\| null;[\s\S]*const blocksWindow = runtime\.windowRef \|\| explicitWindowRef \|\| null;[\s\S]*const selectionSession = createEditorBlocksSelectionSession\(\{[\s\S]*documentRef: blocksDocument,[\s\S]*windowRef: blocksWindow[\s\S]*\}\);[\s\S]*selectionSession\.clearSelection\(root\)/,
  'blocks editor should route native selection clearing through the selection session service'
);

assert.doesNotMatch(
  editorBlocksSource,
  /root\.ownerDocument|ownerDocument\.defaultView|documentRef\.defaultView/,
  'blocks editor should not derive browser document/window refs from the root element'
);

assert.match(
  editorMainBlocksSessionSource,
  /blocksEditor = createBlocksEditor\(root, \{[\s\S]*documentRef: runtime\.documentRef \|\| null,[\s\S]*windowRef: runtime\.windowRef \|\| null,[\s\S]*labels: createBlockLabels\(translate\),/,
  'editor-main blocks session should pass explicit runtime document/window refs into the Blocks editor'
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

assert.doesNotMatch(
  editorBlocksSelectionSessionSource,
  /ownerDocument|defaultView|typeof window/,
  'blocks selection session should not derive document/window APIs from ownerDocument/defaultView'
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
  `${editorBlocksInlineEditingBridgeSource}\n${editorBlocksInlineToolbarSessionSource}`,
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
  editorBlocksInlineCommandSessionSource,
  /if \(\(!offsets \|\| offsets\.collapsed\) && codeRange\) \{[\s\S]*blocksState\.clearInlineState\(\);[\s\S]*removeInlineMarkInRange/,
  'removing remembered inline code should clear stale toolbar mark fallback state'
);

assert.match(
  editorBlocksInlineCommandSessionSource,
  /if \(mark === 'code' && inlineMarksAtOffset\(runs, offsets\.start\)\.code\) \{[\s\S]*blocksState\.clearInlineState\(\);[\s\S]*removeInlineMarkAroundOffset/,
  'removing inline code at a collapsed caret should clear stale toolbar mark fallback state'
);

assert.match(
  editorBlocksInlineCommandSessionSource,
  /const hasPendingInlineMarks = \(\) => \([\s\S]*hasBlocksState\('hasPendingInlineMarks'\) \? blocksState\.hasPendingInlineMarks\(\) : false[\s\S]*const togglePendingInlineMark = \(kind\) => \{[\s\S]*const mark = inlineCommandMark\(kind\);[\s\S]*hasBlocksState\('togglePendingInlineMark'\)[\s\S]*blocksState\.togglePendingInlineMark\(mark\);[\s\S]*if \(mark === 'code'\) return;[\s\S]*togglePendingInlineMark\(kind\);/,
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
  /const menuSession = createEditorBlocksMenuSession\(\{[\s\S]*documentRef: blocksDocument,[\s\S]*text,[\s\S]*onDocument,[\s\S]*onWindow,[\s\S]*containsNode: nodeContains[\s\S]*\}\);[\s\S]*const closeBlockActionMenu = \(restoreFocus = false\) => \{[\s\S]*menuSession\.closeActionMenu\(restoreFocus\);/,
  'blocks editor should compose action menu DOM and lifecycle through the explicit menu session service'
);

assert.match(
  editorBlocksSource,
  /const headSession = createEditorBlocksHeadSession\(\{[\s\S]*documentRef: blocksDocument,[\s\S]*text,[\s\S]*createBlockTypeIcon,[\s\S]*menuSession,[\s\S]*sourceSession,[\s\S]*listSession,[\s\S]*codeSession,[\s\S]*imageSession,[\s\S]*tableSession,[\s\S]*inlineToolbarSession,[\s\S]*createHeadingLevelSelect,[\s\S]*createMathEditButton,[\s\S]*forwardBlockHeadWheel,[\s\S]*alignBlockActionMenu,[\s\S]*setActive,[\s\S]*moveBlock,[\s\S]*insertBlankBlock,[\s\S]*deleteBlockAt[\s\S]*\}\);/,
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
  /const bodySession = blockSessions\.setBodySession\(createEditorBlocksBodySession\(\{[\s\S]*headSession,[\s\S]*blockElements,[\s\S]*createRichEditable,[\s\S]*renderMath: renderMathWithRuntime,[\s\S]*hydrateCard,[\s\S]*openMathEditorForBlock,[\s\S]*renderers: \{[\s\S]*blank: \(body, block, index\) => blockSessions\.renderBlankBlock\(body, block, index\),[\s\S]*\.\.\.blockTypeRenderers[\s\S]*\}[\s\S]*\}\)\);/,
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
  editorBlocksFocusPointerSessionsSource,
  /const shouldSuppressRoutedBlockContainerClick = \(\) => \{[\s\S]*blocksState\.consumeRoutedBlockContainerClickSuppression\(Date\.now\(\)\)\);[\s\S]*\};/,
  'routed caret pointerdowns should suppress the following container click from clearing activeEditable through the focus/pointer wiring boundary'
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
  editorBlocksCaretMeasurementSource,
  /export const CARET_POINT_MEASURE_LIMIT = 12000;[\s\S]*export function measuredTextOffsetDetailsFromPoint\(el, x, y, options = \{\}\)[\s\S]*selectionTools\.createTreeWalker\(el, CARET_TEXT_NODE_FILTER\)[\s\S]*let insideTextRect = false;[\s\S]*range\.setStart\(node, i\);[\s\S]*range\.setEnd\(node, i \+ 1\);[\s\S]*x >= rect\.left && x <= rect\.right && y >= rect\.top && y <= rect\.bottom[\s\S]*caretBoundaryDistance\(rect, rect\.left, x, y\)[\s\S]*bestOffset = offset \+ i;[\s\S]*caretBoundaryDistance\(rect, rect\.right, x, y\)[\s\S]*bestOffset = offset \+ i \+ 1;[\s\S]*return \{ offset: bestOffset, distance: bestDistance, insideTextRect, textRectCount \};[\s\S]*export function measuredTextOffsetFromPoint\(el, x, y, options = \{\}\)[\s\S]*return details \? details\.offset : null;/,
  'routed caret fallback should measure text-node character boundaries and report nearest offsets plus text-rect hits'
);

assert.match(
  editorBlocksCaretMeasurementSource,
  /export function textareaTextOffsetDetailsFromPoint\(area, x, y, options = \{\}\)[\s\S]*const body = typeof getSessionBody === 'function'[\s\S]*const mirror = typeof createSessionElement === 'function'[\s\S]*mirror\.style\.whiteSpace = 'pre-wrap';[\s\S]*mirror\.style\.overflowWrap = 'break-word';[\s\S]*TEXTAREA_MIRROR_STYLE_PROPS\.forEach[\s\S]*mirror\.textContent = value;[\s\S]*const details = measuredTextOffsetDetailsFromPoint\(mirror, x, y, \{ selectionTools, limit \}\);[\s\S]*return \{[\s\S]*\.\.\.details,[\s\S]*offset: Math\.max\(0, Math\.min\(value\.length, details\.offset\)\)[\s\S]*export function textareaTextOffsetFromPoint\(area, x, y, options = \{\}\)[\s\S]*return details \? details\.offset : null;/,
  'routed source markdown textarea focus should use a styled mirror to measure nearest offsets and text-rect hits'
);

assert.doesNotMatch(
  `${editorBlocksCaretSessionSource}\n${editorBlocksCaretMeasurementSource}`,
  /ownerDocument\.createElement/,
  'blocks caret session should use its explicit documentRef for temporary DOM measurement nodes'
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

// composer-identity-body:end
