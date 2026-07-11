import assert from 'node:assert/strict';

import { readIdentitySource, extractFunctionBody } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerEditorTreeStateSource = readIdentitySource('../assets/js/composer-editor-tree-state.js');

const editorContentTreeControllerSource = readIdentitySource('../assets/js/editor-content-tree-controller.js');

const editorStructurePanelUiSource = readIdentitySource('../assets/js/editor-structure-panel-ui.js');

const editorPreviewRuntimeSource = readIdentitySource('../assets/js/editor-preview-runtime.js');

const editorPreviewAppRuntimeSource = readIdentitySource('../assets/js/editor-preview-app-runtime.js');

const themeLayoutSource = readIdentitySource('../assets/js/theme-layout.js');

const themeRegionsSource = readIdentitySource('../assets/js/theme-regions.js');

const typographySource = readIdentitySource('../assets/js/typography.js');

const mainSource = readIdentitySource('../assets/main.js');

const hiEditorSource = readIdentitySource('../assets/js/hieditor.js');

const editorMainSource = readIdentitySource('../assets/js/editor-main.js');

const editorMainPreviewSessionSource = readIdentitySource('../assets/js/editor-main-preview-session.js');

const editorMainWorkspaceSessionSource = readIdentitySource('../assets/js/editor-main-workspace-session.js');

const editorBlocksSource = readIdentitySource('../assets/js/editor-blocks.js');

const editorBlocksBlockFlowModelSource = readIdentitySource('../assets/js/editor-blocks-block-flow-model.js');

const editorBlocksControlFactorySource = readIdentitySource('../assets/js/editor-blocks-control-factory.js');

const editorBlocksStateSource = readIdentitySource('../assets/js/editor-blocks-state.js');

const editorBlocksHeadSessionSource = readIdentitySource('../assets/js/editor-blocks-head-session.js');

const editorBlocksInlineEditingBridgeSource = readIdentitySource('../assets/js/editor-blocks-inline-editing-bridge.js');

const editorBlocksCodeSessionSource = readIdentitySource('../assets/js/editor-blocks-code-session.js');

const editorBlocksListSessionSource = readIdentitySource('../assets/js/editor-blocks-list-session.js');

const syntaxHighlightSource = readIdentitySource('../assets/js/syntax-highlight.js');

const editorSource = readIdentitySource('../index_editor.html');

// composer-identity-body:start

assert.doesNotMatch(
  `${editorBlocksSource}\n${editorBlocksBlockFlowModelSource}`,
  /text: `\$\{(?:previousText|listItemText\(previous\))\}\$\{(?:currentText|listItemText\(current\))\}`/,
  'Backspace merge helpers should not directly concatenate merged text without the safe join helper'
);

assert.doesNotMatch(
  `${editorBlocksSource}\n${editorBlocksBlockFlowModelSource}`,
  /previousText\.length \+ mergedText\.separator\.length/,
  'Backspace merge caret offsets should use rendered inline text length instead of markdown source length'
);

assert.match(
  `${editorBlocksInlineEditingBridgeSource}\n${editorBlocksListSessionSource}`,
  /function getEditableCaretTextOffset\(el, caretSession = null\) \{[\s\S]*getTextOffset\(el\)[\s\S]*function placeCaretAtVisualLine\(el, x, edge, fallbackOffset = 0, caretSession = null\) \{[\s\S]*placeAtVisualLine\(el, x, edge, fallbackOffset\)[\s\S]*event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'[\s\S]*const nextIndex = event\.key === 'ArrowUp' \? itemIndex - 1 : itemIndex \+ 1;[\s\S]*if \(!isEditableCaretOnEdgeLine\(span, event\.key === 'ArrowUp' \? 'up' : 'down', caretSession\)\) return;[\s\S]*placeCaretAtVisualLine\(target, caretRect \? caretRect\.left : 0, event\.key === 'ArrowUp' \? 'last' : 'first', caretOffset, caretSession\);/,
  'ArrowUp and ArrowDown should cross items only from edge lines and enter multiline targets from the correct visual edge'
);

assert.match(
  editorBlocksStateSource,
  /activeIndex: -1[\s\S]*function resetEditorSession\(\) \{[\s\S]*state\.activeIndex = -1;[\s\S]*function setMarkdown\(markdown\) \{[\s\S]*resetEditorSession\(\);/,
  'blocks mode should start with no selected block so controls are not shown by default'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell \{ position:relative; display:flex; flex-direction:column; gap:\.65rem; padding:0; border-radius:0; background:transparent; color:var\(--text\); \}/,
  'blocks wrapper should remain a visual-free layout container while anchoring floating link controls'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell, \.blocks-list, \.blocks-block, \.blocks-block-body, \.blocks-virtual-block \{ cursor:text; \}/,
  'blocks editing canvas should use the text cursor across blank layout areas'
);

assert.match(
  editorSource,
  /\.blocks-block-head, \.blocks-link-editor, \.blocks-math-editor, \.blocks-image-meta-controls, \.blocks-inspector, \.blocks-card-picker, \.blocks-command-menu, \.blocks-action-menu, \.blocks-inline-more-menu \{ cursor:default; \}/,
  'blocks controls and floating panels should not inherit the canvas text cursor'
);

assert.match(
  editorSource,
  /\.blocks-btn, \.blocks-icon-btn, \.blocks-inline-btn, \.blocks-card-result, \.blocks-command-menu-item, \.blocks-action-menu-item, \.blocks-inline-menu-item \{[^}]*cursor:pointer;/,
  'toolbar buttons, card picker results, block action menu items, and inline menu items should keep pointer cursors'
);

assert.match(
  editorSource,
  /\.blocks-btn, \.blocks-icon-btn, \.blocks-inline-btn, \.blocks-card-result, \.blocks-command-menu-item, \.blocks-action-menu-item, \.blocks-inline-menu-item \{[^}]*border:1px solid var\(--border\); background:var\(--card\);/,
  'floating toolbar buttons should use opaque card backgrounds instead of transparent mixes'
);

assert.match(
  editorSource,
  /\.blocks-rich-editable, \.blocks-code-preview code, \.blocks-block input, \.blocks-block textarea, \.blocks-link-editor input, \.blocks-math-editor textarea, \.blocks-card-search \{ cursor:text; \}/,
  'editable text surfaces and text inputs should keep text cursors'
);

assert.match(
  editorSource,
  /\.blocks-block select \{ cursor:default; \}/,
  'select controls should keep their control cursor semantics'
);

assert.match(
  editorSource,
  /\.markdown-editor-shell\.is-blocks-mode, \.markdown-editor-shell:has\(#blocks-wrap:not\(\[hidden\]\)\) \{ border:0; border-radius:0; background:transparent; box-shadow:none; \}/,
  'markdown editor shell should drop its visual container treatment in blocks mode'
);

assert.match(
  editorMainWorkspaceSessionSource,
  /if \(editorShell\) editorShell\.classList\.toggle\('is-blocks-mode', nextView === 'blocks'\);/,
  'workspace view switching should mark the markdown shell as visual-free only in blocks mode'
);

assert.match(
  editorSource,
  /\.blocks-block \{ position:relative; overflow:visible; \}/,
  'blocks should be layout-only relative containers and must not clip floating controls'
);

assert.match(
  editorSource,
  /\.blocks-list \{ display:block; padding-top:0; \}/,
  'blocks list should use normal article flow instead of flex gap spacing'
);

assert.match(
  editorSource,
  /@container \(min-width: 66\.5rem\) \{[\s\S]*\.editor-workspace:has\(#blocks-wrap:not\(\[hidden\]\)\) \.editor-canvas::after \{[\s\S]*height:50vh;[\s\S]*pointer-events:none;[\s\S]*\}/,
  'two-column visual editor should reserve half a viewport of bottom reading space after the last block'
);

assert.match(
  editorSource,
  /\.blocks-virtual-block \{ position:relative; margin:\.85rem 0 1\.2rem; min-height:2\.2rem; \}[\s\S]*\.blocks-virtual-editable:empty::before \{ content:attr\(data-placeholder\);[\s\S]*\.blocks-command-menu \{ position:absolute; left:0; top:calc\(100% \+ \.35rem\);[\s\S]*\.blocks-command-menu-item \{ display:flex; align-items:center; gap:\.45rem;/,
  'blocks mode should style the bottom virtual block and slash command menu as editor-native controls'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list \{[^}]*gap:3rem/,
  'blocks list should not keep the old oversized editor-only vertical gap'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list \{[^}]*padding-top:2\.5rem/,
  'blocks list should not reserve old top padding for floating block controls'
);

assert.match(
  editorSource,
  /\.blocks-block-paragraph, \.blocks-block-source, \.blocks-block-table \{ margin:\.85rem 0; \}[\s\S]*\.blocks-block-paragraph \+ \.blocks-block-paragraph \{ margin-top:1rem; \}[\s\S]*\.blocks-block-heading \{ --blocks-heading-font-size:1\.65rem; margin:calc\(var\(--blocks-heading-font-size\) \* 1\.2\) 0 calc\(var\(--blocks-heading-font-size\) \* \.5\); \}[\s\S]*\.blocks-block-heading:has\(\.blocks-heading-h1\) \{ --blocks-heading-font-size:2rem; \}[\s\S]*\.blocks-block-heading:has\(\.blocks-heading-h6\) \{ --blocks-heading-font-size:\.92rem; \}[\s\S]*\.blocks-block-list \{ margin:\.8rem 0; \}[\s\S]*\.blocks-block-quote \{ margin:1\.2em 0; \}[\s\S]*\.blocks-block-image, \.blocks-block-card \{ margin:1rem 0; \}[\s\S]*\.blocks-block-code \{ margin:\.75rem 0; \}/,
  'blocks should use Native article rhythm margins per block type'
);

assert.match(
  editorSource,
  /\.blocks-block\.is-reordering \{ z-index:1; transition:transform \.24s cubic-bezier\(\.2,\.8,\.2,1\); will-change:transform; \}/,
  'moved blocks should animate their reorder transform without adding container chrome'
);

assert.match(
  editorSource,
  /\.blocks-block::before \{[^}]*background:color-mix\(in srgb, var\(--primary\) 42%, #60a5fa\);[^}]*opacity:0;[^}]*transition:opacity \.16s ease, background \.16s ease, box-shadow \.16s ease;/,
  'hover block indicator should use a softer default color and fade smoothly'
);

assert.match(
  editorSource,
  /\.blocks-block:hover::before \{ opacity:1; \}[\s\S]*\.blocks-block\.is-active::before \{ opacity:1; background:color-mix\(in srgb, var\(--primary\) 82%, #60a5fa\);/,
  'active block indicator should stay visible with the stronger selected color after hover ends'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block \{[^}]*\b(?:border|background|box-shadow|border-radius)\s*:/,
  'block containers should not draw their own border, background, radius, or shadow'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block\.is-active \{[^}]*\b(?:border|background|box-shadow|outline)\s*:/,
  'active block containers should not draw an outer highlight'
);

assert.match(
  editorSource,
  /\.blocks-block:focus, \.blocks-block:focus-visible \{ outline:none; \}/,
  'programmatically focused block containers should suppress the browser default focus ring'
);

assert.match(
  editorSource,
  /\.blocks-block::before \{ content:""; position:absolute; z-index:40;[\s\S]*left:-\.2rem; width:\.078125rem;[\s\S]*opacity:0; pointer-events:none;[\s\S]*\}/,
  'block hover affordance should use an out-of-flow left glow instead of container chrome'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block::before \{[^}]*\btransform\s*:/,
  'block hover affordance should not shift block layout'
);

assert.match(
  editorSource,
  /\.blocks-block:hover::before \{ opacity:1; \}/,
  'block hover should reveal the left glow cue'
);

assert.match(
  editorSource,
  /\.blocks-block-body \{ display:flex; flex-direction:column; gap:\.7rem; padding:0; \}/,
  'block body should not add outer container padding'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{ position:absolute; top:0; left:\.55rem;[\s\S]*opacity:0; pointer-events:none;[\s\S]*transform:translate3d\(0,-112%,0\) scale\(\.98\);/,
  'block type and action controls should be hidden floating overlays at the outside top-left by default'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{[^}]*height:42px; min-height:42px;[\s\S]*border:1px solid color-mix\(in srgb, var\(--border\) 76%, var\(--text\) 24%\);[\s\S]*border-radius:0; background:var\(--card\);/,
  'block floating toolbar should use a fixed 42px opaque square-corner shell'
);

assert.match(
  editorBlocksControlFactorySource,
  /const BLOCK_TYPE_ICON_PATHS = \{[\s\S]*paragraph:[\s\S]*heading:[\s\S]*image:[\s\S]*list:[\s\S]*quote:[\s\S]*code:[\s\S]*source:[\s\S]*card:[\s\S]*blank:/,
  'block type icon map should cover every block type shown in the floating toolbar'
);

assert.match(
  editorBlocksControlFactorySource,
  /const createBlockTypeIcon = \(blockType\) => \{[\s\S]*runtime\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg', 'svg'\)[\s\S]*svg\.setAttribute\('viewBox', '0 0 24 24'\)[\s\S]*svg\.setAttribute\('aria-hidden', 'true'\)[\s\S]*svg\.setAttribute\('focusable', 'false'\)[\s\S]*svg\.innerHTML = BLOCK_TYPE_ICON_PATHS\[blockType\] \|\| BLOCK_TYPE_ICON_PATHS\.paragraph;/,
  'block type icon helper should create non-focusable inline SVG icons through the runtime with a paragraph fallback'
);

assert.match(
  editorBlocksHeadSessionSource,
  /const createTypeBadge = \(block\) => \{[\s\S]*type\.className = 'blocks-block-type';[\s\S]*const typeLabel = text\(block\.type === 'card' \? 'articleCard' : block\.type, block\.type\);[\s\S]*type\.title = typeLabel;[\s\S]*type\.setAttribute\('role', 'img'\);[\s\S]*type\.setAttribute\('aria-label', typeLabel\);[\s\S]*appendIf\(type, createBlockTypeIcon\(block\.type\)\);/,
  'block type badge should render an accessible SVG icon for every block, including blank blocks'
);

assert.match(
  editorSource,
  /\.blocks-block-type \{ display:inline-flex; align-items:center; justify-content:center; width:1rem; height:1\.65rem; min-width:1rem; padding:0; color:color-mix\(in srgb, var\(--muted\) 78%, var\(--text\)\); \}[\s\S]*\.blocks-block-type svg \{ display:block; width:1rem; height:1rem; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; \}/,
  'block type badge should draw the inline SVG icon without a rounded background chip'
);

assert.match(
  editorSource,
  /\.blocks-block\.is-active \.blocks-block-head \{ opacity:1; pointer-events:auto; transform:translate3d\(0,-112%,0\) scale\(1\); \}/,
  'block controls should appear only for the active block'
);

assert.match(
  editorSource,
  /\.blocks-block-head \{[^}]*flex-wrap:nowrap;[\s\S]*transition:opacity \.16s ease;[^}]*white-space:nowrap; \}[\s\S]*\.blocks-block\.is-active \.blocks-block-head\.is-stuck \{ position:fixed; z-index:135; transform:none; transition:none; max-width:calc\(100vw - 1rem\); \}/,
  'active block controls should stay single-row and avoid transform transitions while sticking under the markdown file toolbar'
);

assert.match(
  editorSource,
  /\.blocks-block-actions \{ position:relative; display:flex; align-items:center; margin-left:\.16rem; padding-left:\.34rem; border-left:1px solid var\(--border\); \}[\s\S]*\.blocks-action-menu \{ position:absolute; right:0; top:calc\(100% \+ \.25rem\);[\s\S]*border:1px solid var\(--border\); border-radius:8px; background:var\(--card\);[\s\S]*\.blocks-action-menu\.is-open-right \{ left:0; right:auto; \}[\s\S]*\.blocks-action-menu\[hidden\] \{ display:none !important; \}/,
  'block action overflow menu should anchor right by default and flip rightward when left space is constrained'
);

assert.match(
  editorSource,
  /\.blocks-action-menu-delete \{ color:color-mix\(in srgb, #dc2626 82%, var\(--text\)\); \}[\s\S]*\.blocks-action-menu-delete:hover:not\(:disabled\), \.blocks-action-menu-delete:focus-visible:not\(:disabled\) \{ background:color-mix\(in srgb, #dc2626 12%, var\(--card\)\);/,
  'delete action inside the overflow menu should retain danger styling'
);

assert.match(
  editorSource,
  /\.blocks-block-head \.blocks-heading-level, \.blocks-block-head \.blocks-list-type-select, \.blocks-block-head \.blocks-code-language[\s\S]*\.blocks-block-head \.blocks-code-language \{ width:8\.5rem; max-width:26vw; cursor:pointer; \}/,
  'code block language selector should use compact floating-toolbar styling'
);

assert.match(
  editorSource,
  /\.blocks-block-head \.blocks-heading-level, \.blocks-block-head \.blocks-list-type-select, \.blocks-block-head \.blocks-code-language, \.blocks-block-head \.blocks-table-align-select, \.blocks-block-head \.blocks-image-meta-controls input, \.blocks-block-head \.blocks-image-replace, \.blocks-block-head \.blocks-image-delete-resource, \.blocks-block-head \.blocks-math-edit \{[^}]*border:1px solid var\(--border\); border-radius:999px; background:var\(--card\);[\s\S]*\.blocks-image-meta-controls \{ display:flex; align-items:center; gap:\.24rem;[\s\S]*\.blocks-block-head \.blocks-image-replace, \.blocks-block-head \.blocks-image-delete-resource \{ white-space:nowrap; cursor:pointer; \}[\s\S]*\.blocks-block-head \.blocks-image-delete-resource:disabled \{ opacity:\.45; cursor:not-allowed; \}/,
  'image metadata fields, replace button, and resource deletion button should use compact floating-toolbar styling'
);

assert.match(
  editorSource,
  /\.blocks-image-figure \{ position:relative; margin:0; display:block; width:100%; \}[\s\S]*\.blocks-image-preview \{ display:block; width:100%; height:auto; border-radius:\.5rem;[\s\S]*\.blocks-image-figure\.is-image-placeholder \{ aspect-ratio:5 \/ 1; min-height:5rem;[\s\S]*\.blocks-image-placeholder::after \{ content:""; position:absolute; inset:0; background:linear-gradient\(to top right,[\s\S]*\.blocks-image-figure\.is-image-placeholder \.blocks-image-placeholder \{ display:flex; \}[\s\S]*\.blocks-image-figure figcaption \{ margin-top:\.5em; min-height:1\.45em; color:var\(--muted\); font-family:var\(--serif,[\s\S]*font-size:\.9em; text-align:center;[\s\S]*\.blocks-image-figure figcaption\.is-empty::before \{ content:attr\(data-placeholder\);/,
  'image block visual styling should mirror native article images and expose a subtle editable empty-caption placeholder'
);

assert.match(
  editorSource,
  /\.blocks-code-preview code\.blocks-code-editable:focus \{ outline:none; box-shadow:none; border-color:inherit; \}/,
  'focused code block editor should not draw an inner highlight border'
);

assert.match(
  editorSource,
  /\.blocks-code-preview \{ margin:0; padding:1rem 1\.1rem; border-radius:0\.5rem; overflow:hidden; background-color:var\(--code-bg\); border:0\.0625rem solid var\(--border\); box-shadow:var\(--shadow\); color:var\(--code-text\); position:relative;[\s\S]*font-size:\.893rem; line-height:1\.55; tab-size:2; \}[\s\S]*\.blocks-code-scroll \{ display:flex; align-items:stretch; min-width:0; width:100%; overflow:auto; overflow-y:hidden; \}[\s\S]*\.blocks-code-gutter \{ flex:0 0 auto; position:sticky; left:0; z-index:1; box-sizing:border-box;[\s\S]*padding-right:\.75rem; margin-right:\.75rem; border-right:1px solid color-mix\(in srgb, var\(--code-text\) 12%, transparent\); background:var\(--code-bg\); color:color-mix\(in srgb, var\(--code-text\) 60%, transparent\);[\s\S]*font:inherit; font-variant-numeric:tabular-nums; \}[\s\S]*\.blocks-code-surface \{ position:relative; flex:1 1 auto;[\s\S]*min-width:max-content; min-height:1\.55em; \}[\s\S]*\.blocks-code-preview code \{ display:block;[\s\S]*min-width:100%; min-height:1\.55em; padding:0;[\s\S]*white-space:pre; font:inherit; line-height:inherit; tab-size:inherit; background:transparent; \}[\s\S]*\.blocks-code-highlight \{ color:inherit; pointer-events:none; user-select:none; \}[\s\S]*\.blocks-code-preview code\.blocks-code-editable \{ position:absolute; inset:0; z-index:2; color:transparent; -webkit-text-fill-color:transparent; caret-color:var\(--code-text\); \}/,
  'blocks code blocks should use native code styling while overlaying a transparent editable layer on a highlight mirror'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-preview code \{[^}]*overflow-x:auto/,
  'editable blocks code should not own horizontal scrolling because browser caret scrolling clips its left edge too early'
);

assert.match(
  editorSource,
  /\.blocks-code-scroll \{[^}]*overflow:auto; overflow-y:hidden; \}[\s\S]*\.blocks-code-gutter \{[^}]*position:sticky; left:0; z-index:1;/,
  'blocks code gutter should stick inside the non-editable scroll wrapper like native preview gutters'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-preview \{[^}]*#020617[^}]*\}/,
  'blocks code preview should not use editor-specific dark mixed backgrounds instead of native code tokens'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-code-gutter \{[^}]*#020617[^}]*\}/,
  'blocks code gutter should not use editor-specific dark mixed backgrounds instead of native code tokens'
);

assert.match(
  syntaxHighlightSource,
  /function createSyntaxHighlightRuntime\(options = \{\}\) \{[\s\S]*const allowAmbient = options\.allowAmbient !== false;[\s\S]*documentRef[\s\S]*windowRef[\s\S]*navigatorRef[\s\S]*async function writeClipboardText\(text\)[\s\S]*export function initSyntaxHighlighting\(root = getAmbientDocument\(\), options = \{\}\) \{[\s\S]*const runtime = createSyntaxHighlightRuntime\(options\);[\s\S]*const scope = root && typeof root\.querySelectorAll === 'function' \? root : documentRef;[\s\S]*const codeBlocks = scope\.querySelectorAll\('pre code'\);[\s\S]*preElement\.classList\.contains\('blocks-code-preview'\)[\s\S]*preElement\.closest\('\.markdown-blocks-shell'\)[\s\S]*codeElement\.isContentEditable \|\| codeElement\.getAttribute\('contenteditable'\) === 'true'/,
  'syntax highlighting should be scoped and skip editable blocks code surfaces'
);

assert.match(
  editorPreviewRuntimeSource,
  /initSyntaxHighlighting\(main, \{[\s\S]*documentRef: previewRuntime\.documentRef,[\s\S]*windowRef: previewRuntime\.windowRef,[\s\S]*setTimer: previewRuntime\.setTimer,[\s\S]*writeClipboardText: \(text\) => previewRuntime\.writeClipboardText\(text\),[\s\S]*translate: t,[\s\S]*allowAmbient: false[\s\S]*\}\);/,
  'editor preview should call syntax highlighting through explicit preview runtime effects'
);

assert.match(
  editorPreviewRuntimeSource,
  /function applyPreviewLangHints\(container\) \{[\s\S]*return applyLangHints\(container, \{[\s\S]*documentRef: previewRuntime\.documentRef,[\s\S]*windowRef: previewRuntime\.windowRef,[\s\S]*nodeFilterRef: previewRuntime\.getNodeFilter\(\),[\s\S]*allowAmbient: false[\s\S]*\}\);[\s\S]*\}[\s\S]*applyLangHints: applyPreviewLangHints[\s\S]*try \{ applyPreviewLangHints\(main\); \}/,
  'editor preview should call typography lang hints through explicit preview runtime effects'
);

assert.match(
  editorPreviewAppRuntimeSource,
  /function writeClipboardText\(text\) \{[\s\S]*return runtime\.browser\.writeClipboardText\(text\);[\s\S]*return \{[\s\S]*setTimer: runtime\.browser\.setTimer,[\s\S]*writeClipboardText,[\s\S]*getNodeFilter: runtime\.browser\.getNodeFilter,/,
  'editor preview app runtime should expose timer, clipboard, and NodeFilter effects for editor render utilities'
);

assert.match(
  editorPreviewAppRuntimeSource,
  /const CONTENT_ROOT_GLOBAL = '__press_content_root';[\s\S]*function normalizeContentRoot\(contentRoot\)[\s\S]*function setContentRoot\(contentRoot\) \{[\s\S]*runtime\.globals\.setString\(CONTENT_ROOT_GLOBAL, normalizeContentRoot\(contentRoot\)\)[\s\S]*function getContentRoot\(\) \{[\s\S]*runtime\.globals\.getString\(CONTENT_ROOT_GLOBAL, 'wwwroot'\)[\s\S]*setContentRoot,[\s\S]*getContentRoot,/,
  'editor preview app runtime should own iframe content-root reads and writes'
);

assert.match(
  editorMainPreviewSessionSource,
  /const getPreviewPayload = \(mdText\) => \{[\s\S]*contentRoot: getContentRoot\(\),[\s\S]*baseDir: getEditorBaseDir\(\)/,
  'editor main preview session should carry the runtime content root into preview render payloads'
);

assert.doesNotMatch(
  editorPreviewRuntimeSource,
  /import \{ getContentRoot, setSafeHtml \} from '\.\/safe-html\.js';/,
  'editor preview runtime should not import ambient safe-html content-root reads'
);

assert.match(
  editorPreviewRuntimeSource,
  /import \{ setSafeHtml \} from '\.\/safe-html\.js';[\s\S]*function getContentRoot\(\) \{[\s\S]*previewRuntime\.getContentRoot\(\)[\s\S]*function applyPreviewContentRoot\(payload = \{\}\) \{[\s\S]*previewRuntime\.setContentRoot\(inferPayloadContentRoot\(payload\)\)[\s\S]*function getImageResolutionOptions\(\) \{[\s\S]*contentRoot: getContentRoot\(\),[\s\S]*origin: previewRuntime\.getLocationOrigin\(\)[\s\S]*function setPreviewSafeHtml\(target, html, baseDir, options = \{\}\)[\s\S]*mdParse\(markdown, baseDir, \{ imageResolution \}\)[\s\S]*setPreviewSafeHtml\(main, output\.post \|\| '', baseDir, \{ alreadySanitized: true, imageResolution \}\)/,
  'editor preview runtime should route content-root and rendered image resolution through its explicit app runtime'
);

assert.match(
  editorPreviewRuntimeSource,
  /import \{ createThemeLayoutController, createThemeI18nContext \} from '\.\/theme-layout\.js';[\s\S]*import \{ createSiteFeatureContext \} from '\.\/site-features\.js';[\s\S]*export function createEditorPreviewRuntimeController\(\s*previewRuntime = createEditorPreviewAppRuntime\(\),\s*themeLayout = createThemeLayoutController\(\)\s*\)[\s\S]*themeLayout\.getThemeLayoutContext\(\)[\s\S]*themeLayout\.getThemeApiHandler\(name\)[\s\S]*function getPreviewThemeRegion\(names\) \{[\s\S]*themeLayout\.getThemeRegion\(names\)[\s\S]*setupAnchors\(\{ getRegion: getPreviewThemeRegion \}\)[\s\S]*setupTOC\(\{ getRegion: getPreviewThemeRegion \}\)[\s\S]*renderTagSidebar\(indexMap, \{[\s\S]*getRegion: getPreviewThemeRegion,[\s\S]*\.\.\.options[\s\S]*\}\)[\s\S]*const features = createSiteFeatureContext\(payload\.siteConfig \|\| \{\}\)[\s\S]*themeLayout\.ensureThemeLayout\(\{[\s\S]*pack: requestedPack,[\s\S]*persist: false,[\s\S]*reset,[\s\S]*features[\s\S]*\}\)[\s\S]*createRuntimeContext\(\{ payload, containers, content, features \}\)[\s\S]*features,[\s\S]*function start\(\) \{[\s\S]*previewRuntime\.onRenderMessage\(\(event\) => \{[\s\S]*previewRuntime\.isTrustedMessageEvent\(event\)[\s\S]*initI18n\(\)[\s\S]*postToParent\(\{ type: READY_MESSAGE \}\)[\s\S]*return \{[\s\S]*renderPreview,[\s\S]*start[\s\S]*\};[\s\S]*createEditorPreviewRuntimeController\(\)\.start\(\);/,
  'editor preview runtime should expose explicit preview and theme-layout controller boundaries before browser startup'
);

assert.doesNotMatch(
  editorPreviewRuntimeSource,
  /const previewRuntime = createEditorPreviewAppRuntime\(\)/,
  'editor preview runtime should not create a module-level preview runtime singleton'
);

assert.match(
  themeLayoutSource,
  /function createThemeLayoutState\(options = \{\}\) \{[\s\S]*activePack: null,[\s\S]*layoutPromise: null,[\s\S]*layoutMountGeneration: 0,[\s\S]*regionController: options\.regionController \|\| getDefaultThemeRegionController\(\)[\s\S]*export function createThemeLayoutController\(\) \{[\s\S]*const themeLayoutState = createThemeLayoutState\(\{ regionController: createThemeRegionController\(\) \}\);[\s\S]*ensureThemeLayout: \(options = \{\}\) => ensureThemeLayoutWithState\(themeLayoutState, options\),[\s\S]*getThemeLayoutContext: \(\) => themeLayoutState\.regionController\.getThemeLayoutContext\(\),[\s\S]*getThemeApiHandler: \(name\) => getThemeApiHandlerWithState\(name, themeLayoutState\),[\s\S]*getThemeRegion: \(names\) => themeLayoutState\.regionController\.getThemeRegion\(names\)/,
  'theme layout should expose an explicit controller with private mount and region state'
);

assert.doesNotMatch(
  themeLayoutSource,
  /^let\s+(?:activePack|layoutPromise|layoutMountGeneration)\b/m,
  'theme layout should not keep active pack, in-flight layout promise, or mount generation as module-level mutable variables'
);

assert.match(
  themeRegionsSource,
  /export function createThemeRegionController\(initialContext = null\) \{[\s\S]*let contextRef = normalizeThemeLayoutContext\(initialContext\);[\s\S]*setThemeLayoutContext\(context\)[\s\S]*getThemeLayoutContext\(\)[\s\S]*getThemeRegion\(names\)[\s\S]*export function getDefaultThemeRegionController\(\)/,
  'theme regions should expose explicit context controllers plus a default compatibility controller'
);

assert.doesNotMatch(
  themeRegionsSource,
  /^let\s+cachedContext\b/m,
  'theme regions should not keep layout context in a module-level mutable variable'
);

assert.match(
  editorPreviewAppRuntimeSource,
  /let activeThemePack = '';[\s\S]*let latestRenderRequestId = 0;[\s\S]*function beginRender\(requestId\)[\s\S]*function isCurrentRender\(requestId\)[\s\S]*function shouldResetThemePack\(pack\)[\s\S]*function setActiveThemePack\(pack\)[\s\S]*return \{[\s\S]*beginRender,[\s\S]*isCurrentRender,[\s\S]*shouldResetThemePack,[\s\S]*setActiveThemePack,/,
  'editor preview app runtime should own active theme and render request state'
);

assert.doesNotMatch(
  editorPreviewRuntimeSource,
  /let\s+(?:activePack|latestRenderRequestId)\s*=/,
  'editor preview runtime should not keep active theme or render request state as module globals'
);

assert.match(
  editorPreviewRuntimeSource,
  /function beginPreviewRender\(payload\) \{[\s\S]*previewRuntime\.beginRender\(payload && payload\.requestId\)[\s\S]*function isCurrentPreviewRender\(requestId\) \{[\s\S]*previewRuntime\.isCurrentRender\(requestId\)[\s\S]*const reset = previewRuntime\.shouldResetThemePack\(requestedPack\);[\s\S]*const activePack = previewRuntime\.setActiveThemePack/,
  'editor preview runtime should route active theme and render request state through the preview runtime'
);

assert.match(
  typographySource,
  /function createLangHintRuntime\(options = \{\}\) \{[\s\S]*const allowAmbient = options\.allowAmbient !== false;[\s\S]*documentRef[\s\S]*windowRef[\s\S]*nodeFilterRef[\s\S]*createTreeWalker\(root, whatToShow, filter\)[\s\S]*export function applyLangHints\(container, options = \{\}\) \{[\s\S]*const runtime = createLangHintRuntime\(options\);/,
  'typography lang hints should expose an injectable runtime boundary'
);

assert.doesNotMatch(
  extractFunctionBody(typographySource, 'applyLangHints'),
  /\bdocument\.|\bwindow\.|\bNodeFilter\b|typeof document|typeof window/,
  'typography lang hints should use injected refs inside the editor-callable apply path'
);

assert.match(
  syntaxHighlightSource,
  /import hljs from '\.\/vendor\/highlightjs\/highlight\.min\.js';[\s\S]*const HIGHLIGHT_LANGUAGES = \[[\s\S]*'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'ini', 'java',[\s\S]*'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'markdown',[\s\S]*'typescript', 'vbnet', 'wasm', 'xml', 'yaml'[\s\S]*\];/,
  'syntax highlighter should use the vendored Highlight.js common bundle and register its common languages'
);

assert.match(
  [mainSource, editorMainSource, editorBlocksSource, hiEditorSource].join('\n'),
  /syntax-highlight\.js/,
  'runtime and editor entrypoints should cache-bust the Highlight.js-backed syntax highlighter'
);

assert.match(
  editorMainSource,
  /from '\.\/hieditor\.js';/,
  'editor main should cache-bust hi-editor when Highlight.js span output changes'
);

assert.doesNotMatch(
  [mainSource, editorMainSource, editorBlocksSource, hiEditorSource].join('\n'),
  /syntax-highlight\.js\?v=blocks-code-gutter-20260505/,
  'runtime and editor entrypoints should not keep stale syntax-highlight module URLs'
);

assert.doesNotMatch(
  syntaxHighlightSource,
  /https?:\/\/|cdnjs|unpkg|jsdelivr|import\(['"][^'"]*highlight/i,
  'syntax highlighter should not load Highlight.js from a CDN or dynamic runtime package path'
);

assert.match(
  syntaxHighlightSource,
  /function highlightWithHighlightJs\(code, language\) \{[\s\S]*hljs\.highlight\(raw, \{ language: normalized, ignoreIllegals: true \}\)\.value[\s\S]*hljs\.highlightAuto\(raw, HIGHLIGHT_LANGUAGES\)\.value/,
  'syntax highlighter should use explicit Highlight.js grammars and common-language auto-detection'
);

assert.match(
  syntaxHighlightSource,
  /function detectLanguage\(code\) \{[\s\S]*const detected = hljs\.highlightAuto\(raw, HIGHLIGHT_LANGUAGES\);[\s\S]*return HIGHLIGHT_LANGUAGE_SET\.has\(language\) \? language : null;[\s\S]*\}/,
  'blank-language code blocks should use Highlight.js auto-detection directly'
);

assert.doesNotMatch(
  syntaxHighlightSource,
  /JSON\.parse|<\[\^>\]\+>|\\bdef\\s\+\\w\+|\\bfunction\\s\+\\w\+|yamlHeader|yamlKey|yamlList/,
  'syntax highlighter should not restore Press deterministic language heuristics ahead of auto-detection'
);

assert.match(
  syntaxHighlightSource,
  /function mapHighlightHtml\(html\) \{[\s\S]*mapHighlightClasses[\s\S]*`<span class="\$\{mapped\.join\(' '\)\}">`[\s\S]*function toSafeFragment\(html, options = \{\}\)/,
  'syntax highlighter should map Highlight.js spans before passing markup through the safe fragment path'
);

assert.match(
  syntaxHighlightSource,
  /export function createSafeHighlightFragment\(code, language, options = \{\}\) \{[\s\S]*return toSafeFragment\(simpleHighlight\(code \|\| '', language \|\| 'plain'\), options\);[\s\S]*\}/,
  'syntax highlighter should expose a safe fragment helper for editor-owned highlight mirrors'
);

assert.ok(
  hiEditorSource.includes('const isClassOk = (cls) => (') &&
    hiEditorSource.includes('/^syntax-[a-z-]+$/.test(cls)') &&
    hiEditorSource.includes('/^hljs-[A-Za-z0-9_-]+$/.test(cls)') &&
    hiEditorSource.includes('/^[A-Za-z]+_+$/.test(cls)'),
  'hi-editor safe renderer should accept Highlight.js classes plus Press syntax classes'
);

assert.match(
  hiEditorSource,
  /if \(markup\.startsWith\('<span', i\)\) \{[\s\S]*split\(\/\\s\+\/\)\.filter\(isClassOk\)[\s\S]*i \+= match\[0\]\.length;[\s\S]*const nextLt = markup\.indexOf\('<', i\);[\s\S]*if \(nextLt === i\) \{[\s\S]*runtime\.createTextNode\('<'\)[\s\S]*i \+= 1;[\s\S]*continue;[\s\S]*\}/,
  'hi-editor safe renderer should preserve unknown angle brackets as text and never stall on Highlight.js spans'
);

assert.ok(
  hiEditorSource.includes('.replace(/&#x([0-9a-fA-F]+);/g') && hiEditorSource.includes('.replace(/&#([0-9]+);/g'),
  'hi-editor safe renderer should decode numeric entities so highlighted mirror text keeps textarea wrapping'
);

assert.match(
  editorSource,
  /\.hi-editor \.hi-ta::selection \{ background: rgba\(9,105,218,0\.24\); color: transparent; -webkit-text-fill-color: transparent; \}/,
  'hi-editor should let the native textarea selection paint visible range highlights'
);

assert.match(
  editorSource,
  /\.hi-editor \.hi-pre code span, \.hi-editor \.hi-pre code span \* \{ font:inherit; font-weight:inherit; font-style:inherit; font-variant:inherit; font-variant-ligatures:inherit; font-variant-numeric:inherit; letter-spacing:inherit; text-decoration:none; \}/,
  'hi-editor highlight tokens should inherit font metrics so native textarea selection aligns with visible text'
);

assert.match(
  hiEditorSource,
  /const hasRangeSelection = selEnd > selStart;[\s\S]*if \(hasRangeSelection\) \{[\s\S]*native textarea paint selection ranges[\s\S]*return;[\s\S]*\}/,
  'hi-editor range selection should use native textarea geometry instead of custom mirror rectangles'
);

assert.doesNotMatch(
  `${hiEditorSource}\n${editorSource}`,
  /hi-selection-range|getSelectionRects|getSelectionConnectorRects|normalizeSelectionRects/,
  'hi-editor should not keep the old custom selection rectangle overlay'
);

assert.match(
  editorBlocksCodeSessionSource,
  /highlight\.replaceChildren\(createHighlightFragment\(raw, meta\.highlight \? meta\.language : 'plain'\)\);/,
  'editor block syntax highlighting should render through the safe highlight fragment helper'
);

assert.match(
  editorSource,
  /\.blocks-rich-editable \{ outline:none; min-height:1\.65em; line-height:1\.65;/,
  'empty rich text blocks should keep one editable line as a pointer target'
);

assert.match(
  editorSource,
  /\.blocks-source-textarea \{ min-height:0; width:100%; resize:none; overflow:hidden; padding-block:0; \}/,
  'source markdown textareas should expand to content without fixed minimum height, internal scrolling, or vertical padding'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-textarea \{[^}]*min-height:/,
  'block textareas should not reserve a fixed minimum height'
);

assert.match(
  editorSource,
  /\.blocks-source-textarea:focus \{ outline:none; box-shadow:none; border-color:color-mix\(in srgb, var\(--border\) 82%, transparent\); \}/,
  'focused source markdown textarea should not draw an inner highlight border'
);

assert.match(
  editorSource,
  /\.blocks-list-item input\[type="checkbox"\] \{[^}]*cursor:pointer; \}/,
  'task-list checkbox controls should keep pointer cursors inside the text-cursor canvas'
);

assert.match(
  editorSource,
  /\.blocks-card-preview a \{ cursor:default; \}/,
  'article card links should not advertise navigation in blocks mode'
);

assert.match(
  editorSource,
  /\.blocks-card-preview \.link-card-wrap \{ margin:0; \}[\s\S]*\.blocks-card-preview \.link-card \{[^}]*border:0\.0625rem solid var\(--border\);[^}]*border-radius:0\.75rem;[^}]*box-shadow:var\(--shadow\);[\s\S]*\.blocks-card-preview \.card-cover-wrap \{[^}]*aspect-ratio:16 \/ 10;[\s\S]*\.blocks-card-preview \.card-title \{[^}]*font-family:var\(--display, var\(--serif\)\);[^}]*font-size:1\.05rem;[\s\S]*\.blocks-card-preview \.card-meta \{[^}]*text-transform:uppercase;/,
  'article-card blocks should mirror the native link-card layout instead of using separate temporary card styling'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-rich-editable:focus,[^{]*\.blocks-code-preview code:focus[^{]*\{ outline:2px solid/,
  'code block editor focus should not share the generic blue focus outline rule'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-block:focus-within \.blocks-block-head/,
  'focused stale blocks should not keep a second floating toolbar visible'
);

assert.match(
  editorSource,
  /\.markdown-blocks-shell \.blocks-inline-btn\.is-active, \.markdown-blocks-shell \.blocks-inline-btn\[aria-pressed="true"\], \.markdown-blocks-shell \.blocks-inline-menu-item\.is-active, \.markdown-blocks-shell \.blocks-inline-menu-item\[aria-pressed="true"\][\s\S]*background:#1d4ed8 !important;[\s\S]*background-color:#1d4ed8 !important;[\s\S]*border-color:#1e40af !important;[\s\S]*color:#fff !important;[\s\S]*box-shadow:inset[\s\S]*\.blocks-inline-controls, \.blocks-list-indent-controls \{ display:flex; align-items:center; gap:\.2rem; padding-left:\.1rem; \}[\s\S]*\.blocks-inline-controls \{ margin-left:\.16rem; padding-left:\.34rem; border-left:1px solid var\(--border\); \}/,
  'inline formatting controls should use a visible filled active state that overrides theme button resets'
);

assert.match(
  editorSource,
  /\.blocks-inline-more \{ position:relative; display:flex; align-items:center; \}[\s\S]*\.blocks-inline-more-trigger \{ min-width:2rem; font-size:\.78rem; font-weight:750; \}[\s\S]*\.blocks-inline-more-menu \{ position:absolute; right:0; top:calc\(100% \+ \.25rem\);[\s\S]*border:1px solid var\(--border\); border-radius:8px; background:var\(--card\);[\s\S]*\.blocks-inline-more-menu\[hidden\] \{ display:none !important; \}[\s\S]*\.blocks-inline-menu-item \{ width:100%; border:0; background:var\(--card\); border-radius:6px; padding:\.46rem \.58rem; text-align:left; white-space:nowrap; font-weight:700; \}[\s\S]*\.blocks-inline-menu-item\[aria-disabled="true"\] \{ opacity:\.45; cursor:not-allowed; \}/,
  'inline formatting overflow menu should be compact and anchored after the Link button'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-inline-btn\.is-active, \.blocks-inline-btn\[aria-pressed="true"\] \{[^}]*var\(--primary\) 15%/,
  'inline formatting active state should not regress to the barely visible 15% primary tint'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-inline-toolbar/,
  'blocks inline formatting should not keep a sticky standalone toolbar style'
);

assert.match(
  editorSource,
  /\.blocks-visual-list \{ margin:0 0 0 1\.25rem; padding-left:0; font-family:var\(--serif, var\(--article-serif-stack, Georgia, "Times New Roman", Times, serif\)\); font-size:1\.04rem; line-height:1\.75; letter-spacing:\.005em; \}[\s\S]*\.blocks-list-item \{ margin:\.35rem 0; padding:0; line-height:1\.75; \}[\s\S]*\.blocks-list-item:first-child \{ margin-top:0; \}[\s\S]*\.blocks-list-item:last-child \{ margin-bottom:0; \}[\s\S]*\.blocks-visual-list \.blocks-list-item::marker \{ font-family:inherit; font-size:1em; font-weight:400; color:inherit; \}/,
  'visual list rows and markers should mirror native typography without adding outer block-body whitespace'
);

assert.match(
  editorSource,
  /\.blocks-list-text \{ display:inline; min-width:0; vertical-align:baseline; line-height:inherit; padding:0; \}[\s\S]*\.blocks-visual-list-task \.blocks-list-text \{ grid-column:2; display:block; \}/,
  'visual list editable text should not add editor-only padding around native list markers'
);

assert.match(
  editorSource,
  /\.blocks-visual-list-task \{ list-style:none; margin-left:0; padding-left:0; \}[\s\S]*\.blocks-visual-list-task \.blocks-list-item \{ display:grid; grid-template-columns:1\.45rem minmax\(0, 1fr\);/,
  'task-list rows should keep checklist boxes aligned while regular list markers use native spacing'
);

assert.match(
  editorBlocksHeadSessionSource,
  /const appendListControls = \(head, block, index\) => \{[\s\S]*appendIf\(head, listSession\?\.createTypeSelect\?\.\(block, index\)\);[\s\S]*appendIf\(head, listSession\?\.createIndentControls\?\.\(block, index\)\);[\s\S]*\};/,
  'list type and indent controls should be mounted in the floating block toolbar through the list session'
);

assert.match(
  editorBlocksControlFactorySource,
  /const createHeadingLevelSelect = \(block\) => \{[\s\S]*runtime\.createElement\('select'\)[\s\S]*select\.className = 'blocks-heading-level'[\s\S]*const option = runtime\.createElement\('option'\);[\s\S]*select\.value = String\(block\?\.data\?\.level \|\| 2\);[\s\S]*select\.addEventListener\('change', \(\) => updateFromControl\(block, \{ level: Number\(select\.value\) \|\| 2 \}, true\)\);/,
  'heading level select control should preserve its data update behavior'
);

assert.match(
  editorBlocksHeadSessionSource,
  /if \(block\.type === 'heading'\) appendIf\(head, createHeadingLevelSelect\(block\)\);/,
  'heading level control should be mounted in the floating block toolbar through the head session'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-heading-controls/,
  'heading level control should not remain as a body control above the heading'
);

assert.doesNotMatch(
  editorBlocksSource,
  /blocks-list-inspector/,
  'list type control should not remain as a body inspector above the list'
);

assert.doesNotMatch(
  editorSource,
  /\.blocks-list-remove/,
  'visual list CSS should not style removed per-item delete buttons'
);

assert.doesNotMatch(
  editorSource,
  /id="composerOrderInlineMeta"|data-i18n="editor\.composer\.changeSummary"/,
  'composer should not render the inline change summary block above the editor'
);

assert.doesNotMatch(
  editorSource,
  /id="wrapToggle"|data-wrap="(?:on|off)"/,
  'markdown editor should not expose a manual line-wrap toggle'
);

assert.match(
  editorSource,
  /class="editor-app-shell" id="editorAppShell"[\s\S]*class="editor-rail editor-file-tree-pane" id="editorRail"[\s\S]*id="editorFileTree" role="tree"[\s\S]*class="editor-content-pane" id="editorContentPane"[\s\S]*class="editor-content-frame"[\s\S]*class="editor-layout" id="mode-editor"/,
  'editor should render a fixed two-pane app shell with a left rail and a width-limited right content frame'
);

assert.match(
  editorSource,
  /<section class="editor-structure-panel" id="editorStructurePanel"[\s\S]*<div class="editor-panel-head editor-structure-head">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<div class="editor-panel-heading editor-structure-heading">[\s\S]*<div class="editor-panel-actions editor-structure-actions" id="editorStructureActions"><\/div>/,
  'structure panel header should expose a mobile file tree drawer toggle before the shared heading'
);

assert.match(
  editorSource,
  /<section class="editor-markdown-panel" id="editorMarkdownPanel"[\s\S]*<div class="toolbar">[\s\S]*<div class="left-actions">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<span class="current-file" id="currentFile"/,
  'markdown toolbar should keep its visual mobile file tree toggle before the current file breadcrumb'
);

assert.match(
  editorSource,
  /<section class="editor-system-panel" id="editorSystemPanel"[\s\S]*<div class="editor-panel-head editor-structure-head">\s*<button type="button" class="editor-mobile-rail-toggle" data-editor-rail-toggle[\s\S]*data-i18n-aria-label="editor\.tree\.aria"[\s\S]*data-i18n-title="editor\.tree\.aria"[\s\S]*<svg class="editor-mobile-rail-icon"[\s\S]*<path d="M9 3v18"><\/path>[\s\S]*<\/button>\s*<div class="editor-panel-heading editor-structure-heading">[\s\S]*<div class="editor-panel-actions editor-structure-actions" id="editorSystemActions"><\/div>/,
  'system and publish panel header should expose the shared mobile file tree drawer toggle'
);

assert.equal(
  (editorSource.match(/data-editor-rail-toggle/g) || []).length,
  3,
  'editor should render one drawer toggle entry for structure, markdown, and system surfaces'
);

assert.doesNotMatch(
  editorSource,
  /id="editorMobileRailToggle"/,
  'mobile file tree toggles should not depend on one id inside a conditionally hidden panel'
);

assert.doesNotMatch(
  editorSource,
  /localStorage\.getItem\('press_composer_editor_state'\)/,
  'editor entry should default to the Editor file tree instead of restoring the last Site Settings mode'
);

assert.doesNotMatch(
  editorSource,
  /editor-rail-footer|editorRailSettingsToggle|editorRailSettingsMenu|id="editorLangSwitcher"/,
  'editor rail footer settings menu should be removed'
);

assert.match(
  editorStructurePanelUiSource,
  /function appendEditorLanguageControl\(body\) \{[\s\S]*id = 'editorLangSwitcher'[\s\S]*id = 'editorLangSelect'[\s\S]*populateEditorLanguageSelect\(\);[\s\S]*emitLanguageControlMounted\(\);/,
  'editor language controls should be rendered inside the System structure panel through injected runtime callbacks'
);

assert.match(
  editorStructurePanelUiSource,
  /if \(node\.source === 'system'\) \{[\s\S]*appendEditorLanguageControl\(body\);[\s\S]*node\.children\.forEach/,
  'System root panel should include editor language controls before system leaves'
);

assert.match(
  composerEditorTreeStateSource,
  /themesLabel: treeText\('themes', 'Themes'\),[\s\S]*syncLabel: treeText\('sync', 'Publish'\),/,
  'System tree should expose the Themes and Publish leaves'
);

assert.match(
  editorContentTreeControllerSource,
  /node\.id === 'system:themes'[\s\S]*applyMode\('themes'\);[\s\S]*node\.id === 'system:sync'[\s\S]*applyMode\('sync'\);/,
  'editor content tree controller should route the Themes and Publish leaves'
);

assert.doesNotMatch(
  editorSource,
  /id="global-status"|globalStatusRepo|globalArrowLabel|localDraftSummary|editor-github\.js/,
  'legacy global sync flow widget should be removed from the editor shell'
);

assert.match(
  editorSource,
  /id="mode-sync" hidden aria-hidden="true"/,
  'editor should provide an inline Sync panel host'
);

assert.match(
  editorSource,
  /id="editorModalSyncActions" hidden[\s\S]*id="btnSyncSubmit"[\s\S]*form="syncCommitForm"/,
  'Sync commit submit button should live in the system panel header actions and submit the inline form'
);

assert.doesNotMatch(
  source,
  /global-status|globalStatusRepo|globalArrowLabel|localDraftSummary|attachGlobalStatusCommitHandler|handleGlobalBubbleActivation/,
  'composer should not keep legacy global sync widget wiring'
);

// composer-identity-body:end
