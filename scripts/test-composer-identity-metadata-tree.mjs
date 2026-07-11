import assert from 'node:assert/strict';

import { readIdentitySource, extractFunctionBody } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerIndexTabsUiSource = readIdentitySource('../assets/js/composer-index-tabs-ui.js');

const composerContentMutationsSource = readIdentitySource('../assets/js/composer-content-mutations.js');

const composerModeControllerSource = readIdentitySource('../assets/js/composer-mode-controller.js');

const composerEditorDetailPanelControllerSource = readIdentitySource(
  '../assets/js/composer-editor-detail-panel-controller.js'
);

const editorContentTreeControllerSource = readIdentitySource('../assets/js/editor-content-tree-controller.js');

const composerMarkdownSessionSource = readIdentitySource('../assets/js/composer-markdown-session.js');

const composerMarkdownWorkspaceSource = readIdentitySource('../assets/js/composer-markdown-workspace.js');

const editorFileTreeUiSource = readIdentitySource('../assets/js/editor-file-tree-ui.js');

const editorStructurePanelUiSource = readIdentitySource('../assets/js/editor-structure-panel-ui.js');

const hiEditorSource = readIdentitySource('../assets/js/hieditor.js');

const editorMainSource = readIdentitySource('../assets/js/editor-main.js');

const editorMainMetadataPanelSource = readIdentitySource('../assets/js/editor-main-metadata-panel.js');

const editorMainFrontMatterLabelWidthSource = readIdentitySource('../assets/js/editor-main-frontmatter-label-width.js');

const editorMainFrontMatterManagerSource = readIdentitySource('../assets/js/editor-main-frontmatter-manager.js');

const editorMainTabsMetadataManagerSource = readIdentitySource('../assets/js/editor-main-tabs-metadata-manager.js');

const editorMainDocumentSessionSource = readIdentitySource('../assets/js/editor-main-document-session.js');

const editorMainFileContextServiceSource = readIdentitySource('../assets/js/editor-main-file-context-service.js');

const editorMainLanguageSessionSource = readIdentitySource('../assets/js/editor-main-language-session.js');

const editorSource = readIdentitySource('../index_editor.html');

// composer-identity-body:start

assert.match(
  editorMainMetadataPanelSource,
  /const createFrontMatterManager = \(\) => createEditorMainFrontMatterManager\(\{[\s\S]*documentRef,[\s\S]*getElementById,[\s\S]*querySelector,[\s\S]*translate,[\s\S]*translateWithLocaleFallback,[\s\S]*syncLabelWidth: syncFrontMatterLabelWidth[\s\S]*\}\);/,
  'metadata panel session should compose article front matter through an explicit manager boundary'
);

assert.doesNotMatch(
  editorMainMetadataPanelSource,
  /FRONT_MATTER_FIELD_DEFS|buildMarkdownWithFrontMatter|parseMarkdownFrontMatter|resolveFrontMatterBindings|normalizeDateInputValue|head\.className = 'frontmatter-field-head'|input\.addEventListener\(entry\.type === 'boolean'/,
  'metadata panel session should not own article front matter document parsing or field DOM internals'
);

assert.match(
  editorMainMetadataPanelSource,
  /const setFrontMatterVisible = \(visible\) => \{[\s\S]*const nextVisible = !!visible;[\s\S]*const shouldClear = !nextVisible && frontMatterVisible;[\s\S]*frontMatterVisible = nextVisible;[\s\S]*if \(shouldClear && frontMatterManager && typeof frontMatterManager\.clear === 'function'\) frontMatterManager\.clear\(\);[\s\S]*updateMetadataPanelVisibility\(\);[\s\S]*\};/,
  'switching into page metadata mode should clear stale article front matter state only on visibility transitions'
);

assert.match(
  editorMainFrontMatterLabelWidthSource,
  /const syncFrontMatterLabelWidth = \(root\) => \{[\s\S]*querySelectorAll\('\.frontmatter-field-title'\)[\s\S]*requestFrame\(measure\)[\s\S]*ResizeObserverRef/,
  'front matter labels should be measured after render and shared through a CSS variable'
);

assert.doesNotMatch(
  editorMainMetadataPanelSource,
  /\bwindowRef\b|options\.windowRef|windowRef\.|typeof window|requestAnimationFrame === 'function'|cancelAnimationFrame === 'function'|getComputedStyle\.bind|windowRef\.ResizeObserver/,
  'metadata panel should receive frame, computed-style, and observer behavior through explicit runtime adapters'
);

assert.doesNotMatch(
  editorMainFrontMatterLabelWidthSource,
  /\bwindowRef\b|options\.windowRef|windowRef\.|typeof window|typeof document|requestAnimationFrame === 'function'|cancelAnimationFrame === 'function'|getComputedStyle\.bind|windowRef\.ResizeObserver/,
  'front matter label-width sync should stay bound to explicit document and browser adapters'
);

assert.doesNotMatch(
  editorMainMetadataPanelSource,
  /ownerDocument|defaultView|typeof document\b/,
  'metadata panel should use its injected documentRef instead of deriving document APIs from DOM nodes'
);

assert.doesNotMatch(
  editorMainFrontMatterManagerSource,
  /\bwindowRef\b|options\.windowRef|windowRef\.|typeof window|typeof document\b|ownerDocument|defaultView/,
  'article front matter manager should stay bound to injected document and translation adapters'
);

assert.match(
  editorMainMetadataPanelSource,
  /createFrontMatterLabelWidthSync\(\{[\s\S]*documentRef,[\s\S]*requestFrame,[\s\S]*cancelFrame,[\s\S]*getComputedStyle: getComputedStyleRef,[\s\S]*ResizeObserver: ResizeObserverRef[\s\S]*\}\);[\s\S]*const \{ syncFrontMatterLabelWidth \} = frontMatterLabelWidthSync;/,
  'metadata panel should compose front matter label-width sync from an explicit layout helper'
);

assert.doesNotMatch(
  editorMainMetadataPanelSource,
  /const measureLabelText|doc\.createElement\('span'\)|__pressFrontMatterLabelWidthCleanup = \(\) =>/,
  'metadata panel should not own front matter label-width measurement lifecycle internals'
);

assert.match(
  editorMainFrontMatterLabelWidthSource,
  /const syncFrontMatterLabelWidth = \(root\) => \{[\s\S]*root\.style\.setProperty\('--frontmatter-single-label-width'/,
  'front matter label measurement should write the shared label width CSS variable'
);

assert.match(
  editorMainFrontMatterLabelWidthSource,
  /const measureLabelText = \(label\) => \{[\s\S]*label\.scrollWidth[\s\S]*probe\.textContent = label\.textContent \|\| '';[\s\S]*probe\.style\.whiteSpace = 'nowrap';/,
  'front matter label measurement should probe intrinsic text width when current layout is constrained'
);

assert.match(
  editorMainFrontMatterLabelWidthSource,
  /querySelector\('\.frontmatter-help-tooltip'\)[\s\S]*measureLabelText\(label\)[\s\S]*getComputedStyleRef\(target \|\| label\)[\s\S]*gap/,
  'front matter label measurement should use intrinsic label width plus the visible help button and gap'
);

assert.match(
  editorMainLanguageSessionSource,
  /metadataPanel\.syncLanguage\(\);[\s\S]*runtime\.onDocument\('press-editor-language-applied', syncLanguage\)/,
  'front matter labels should resync after editor language changes update localized labels'
);

assert.match(
  editorMainMetadataPanelSource,
  /const updateMetadataPanelVisibility = \(\) => \{[\s\S]*tabsMetadataManager\.setVisible\(tabsMetadataVisible\);[\s\S]*syncFrontMatterLabelWidth\(panel\);/,
  'front matter labels should resync after article/page metadata visibility changes'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /function getTabsMetadataForTab\(tab\) \{[\s\S]*tab\.tabsKey[\s\S]*tab\.tabsLang[\s\S]*getTabsEntry\(tab\.tabsKey\)[\s\S]*entry && entry\[tab\.tabsLang\][\s\S]*title/,
  'tabs metadata reads should prefer the dynamic tab stable identity over path-only lookup'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /function updateTabsEntryTitleForTab\(tab, metadata\) \{[\s\S]*tab\.tabsKey[\s\S]*tab\.tabsLang[\s\S]*getTabsEntry\(tab\.tabsKey\)[\s\S]*entry\[tab\.tabsLang\]\.title = nextTitle;/,
  'tabs metadata writes should target the dynamic tab stable identity instead of the first matching path'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /detachPrimaryEditorTabsMetadataListener = api\.onTabsMetadataChange\(\(metadata\) => \{[\s\S]*if \(tab && tab\.source === 'tabs'\)[\s\S]*updateTabsEntryTitleForTab\(tab, metadata\);/,
  'tabs metadata bridge should write through the active dynamic tab identity'
);

assert.match(
  composerMarkdownSessionSource,
  /const data = \{[\s\S]*path: normalized,[\s\S]*tabsKey:[\s\S]*tabsLang:[\s\S]*editorTreeNodeId:[\s\S]*lookupKey:/,
  'dynamic markdown tabs should persist a stable identity for shared-path tabs content'
);

assert.doesNotMatch(
  editorSource,
  /\.frontmatter-field \+ \.frontmatter-field|frontmatter-pill|frontmatter-field-hint/,
  'front matter should not render per-row separators, key chips, or persistent hint rows'
);

assert.doesNotMatch(
  `${editorSource}\n${editorMainSource}\n${editorMainMetadataPanelSource}`,
  /frontMatterToggle|frontMatterSummary|frontMatterHelp|frontmatter-toggle|class="frontmatter-help"|\.frontmatter-help\s*\{|data-collapsed/,
  'front matter editor should not render the old collapsible heading or helper copy'
);

assert.match(
  editorSource,
  /\.frontmatter-switch \{[\s\S]*border-radius: 999px;[\s\S]*\.frontmatter-switch-input \{[\s\S]*clip-path: inset\(50%\);[\s\S]*\.frontmatter-switch-track \{[\s\S]*width: 2\.4rem;[\s\S]*\.frontmatter-switch\[data-state="on"\] \.frontmatter-switch-thumb \{[\s\S]*transform: translateX\(1\.05rem\);/,
  'front matter boolean fields should render as two-state switch controls'
);

assert.match(
  editorMainFrontMatterManagerSource,
  /const syncBooleanControl = \(entry, value\) => \{[\s\S]*entry\.input\.setAttribute\('aria-checked', checked \? 'true' : 'false'\);[\s\S]*wrap\.className = 'frontmatter-switch';[\s\S]*checkbox\.setAttribute\('role', 'switch'\);[\s\S]*entry\.switchEl = wrap;/,
  'front matter boolean fields should sync switch state through the existing input binding'
);

assert.doesNotMatch(
  `${editorSource}\n${editorMainSource}\n${editorMainMetadataPanelSource}`,
  /frontmatter-clear|frontmatter-actions|clearEntryValue|editor\.frontMatter\.booleanLabel/,
  'front matter boolean fields should not keep the old checkbox label or clear action'
);

assert.match(
  editorSource,
  /\.frontmatter-panel\[data-frontmatter-visible="false"\]\[data-tabs-visible="false"\] \{ display: none !important; \}/,
  'front matter panel should only fully hide when neither article nor tabs metadata is active'
);

assert.match(
  editorMainMetadataPanelSource,
  /let frontMatterVisible = true;[\s\S]*let tabsMetadataVisible = false;[\s\S]*const inferCurrentFileSource = \(path\) => \{[\s\S]*normalized\.startsWith\('tab\/'\) \? 'tabs' : '';[\s\S]*const setFrontMatterVisible = \(visible\) => \{[\s\S]*const nextVisible = !!visible;[\s\S]*const shouldClear = !nextVisible && frontMatterVisible;[\s\S]*frontMatterVisible = nextVisible;[\s\S]*frontMatterManager\.clear\(\);[\s\S]*const setTabsMetadataVisible = \(visible\) => \{[\s\S]*tabsMetadataVisible = !!visible;[\s\S]*applyCurrentFileSource: \(source\) => \{[\s\S]*setFrontMatterVisible\(actual !== 'tabs'\);[\s\S]*setTabsMetadataVisible\(actual === 'tabs'\);/,
  'metadata panel session should swap between article front matter and tabs metadata visibility by file source'
);

assert.match(
  editorMainFileContextServiceSource,
  /const setCurrentFileLabel = \(input\) => \{[\s\S]*currentFileSession\.set\(input\)[\s\S]*metadataPanel\.applyCurrentFileSource\(info && info\.source\);/,
  'editor file context service should delegate file-source metadata mode changes to the metadata panel session'
);

assert.match(
  editorMainMetadataPanelSource,
  /buildEditorValue: \(body\) => \([\s\S]*frontMatterVisible && frontMatterManager \? frontMatterManager\.buildMarkdown\(body\) : body[\s\S]*setEditorValue: \(value, opts = \{\}\) => \([\s\S]*frontMatterVisible && frontMatterManager[\s\S]*frontMatterManager\.setFromMarkdown\(value, opts\)[\s\S]*String\(value == null \? '' : value\)/,
  'metadata panel session should bypass front matter parsing and rebuilding while the panel is hidden'
);

assert.match(
  editorMainDocumentSessionSource,
  /const getValue = \(\) => \{[\s\S]*metadataPanel\.buildEditorValue\(body\);[\s\S]*const setValue = \(value, opts = \{\}\) => \{[\s\S]*metadataPanel\.setEditorValue\(text, \{ silent: true \}\)/,
  'editor document session should route markdown value front matter handling through the metadata panel session'
);

assert.match(
  editorMainMetadataPanelSource,
  /const createTabsMetadataManager = \(\) => \{[\s\S]*createEditorMainTabsMetadataManager\(\{[\s\S]*documentRef,[\s\S]*getElementById,[\s\S]*translateWithLocaleFallback,[\s\S]*syncLabelWidth: syncFrontMatterLabelWidth[\s\S]*\}\);[\s\S]*\};/,
  'metadata panel session should compose tabs metadata through an explicit manager boundary'
);

assert.match(
  editorMainTabsMetadataManagerSource,
  /export function createEditorMainTabsMetadataManager\(options = \{\}\) \{[\s\S]*section\.className = 'frontmatter-section';[\s\S]*grid\.className = 'frontmatter-grid';[\s\S]*field\.className = 'frontmatter-field frontmatter-field-text';[\s\S]*field\.dataset\.fieldId = 'tabs-title';[\s\S]*setChangeHandler: \(fn\) => \{[\s\S]*setValue: \(value, opts = \{\}\) => \{[\s\S]*emitChange\(\);/,
  'metadata panel session should define a tabs metadata manager that reuses the frontmatter panel shell and field styling'
);

assert.doesNotMatch(
  editorMainMetadataPanelSource,
  /section\.id = 'tabsMetadataSection'|field\.dataset\.fieldId = 'tabs-title'|input\.addEventListener\('input'/,
  'metadata panel session should not own tabs metadata DOM construction or input event handling'
);

assert.doesNotMatch(
  editorMainTabsMetadataManagerSource,
  /\bwindowRef\b|options\.windowRef|windowRef\.|typeof window|typeof document\b|ownerDocument|defaultView/,
  'tabs metadata manager should stay bound to injected document and translation adapters'
);

assert.match(
  editorMainDocumentSessionSource,
  /const createPrimaryEditorApi = \(\) => \(\{[\s\S]*setTabsMetadata: \(value, opts = \{\}\) => \([\s\S]*metadataPanel\.setTabsMetadata\(value, opts\)[\s\S]*onTabsMetadataChange: \(fn\) => \([\s\S]*metadataPanel\.onTabsMetadataChange\(fn\)/,
  'primary editor API should expose tabs metadata setters and change subscriptions through the metadata panel session'
);

assert.match(
  editorContentTreeControllerSource,
  /function inferMarkdownSourceFromPath\(path\) \{[\s\S]*node && node\.source[\s\S]*inferMarkdownSourceFallback\(normalized\);/,
  'editor content tree controller should infer whether an opened markdown file comes from tabs.yaml or index.yaml'
);

assert.match(
  composerMarkdownSessionSource,
  /function deriveDynamicTabIdentity\(path, identityOptions = \{\}\) \{[\s\S]*const explicitLookupKey = String\(opts\.lookupKey \|\| ''\)\.trim\(\);[\s\S]*const source = String\([\s\S]*opts\.source[\s\S]*inferMarkdownSourceFromPath\(normalizedPath\)[\s\S]*const lookupKey = explicitLookupKey \|\| \(\(source === 'tabs' && key && lang\)/,
  'composer should preserve explicit file-source identity and persisted lookup keys for dynamic markdown tabs'
);

assert.match(
  composerIndexTabsUiSource,
  /query\('\.ct-edit', block\)\.addEventListener\('click', \(\) => \{[\s\S]*const rel = normalizeRelPath\(value\.location\);[\s\S]*openMarkdownInEditor\(rel, \{[\s\S]*source: 'tabs',[\s\S]*key: tab,[\s\S]*lang,[\s\S]*editorTreeNodeId: `tabs:\$\{tab\}:\$\{lang\}`[\s\S]*\}\);/,
  'page list edit actions should pass tabs identity when opening the markdown editor'
);

assert.match(
  composerMarkdownWorkspaceSource,
  /if \(!api \|\| typeof api\.onTabsMetadataChange !== 'function'\) return;[\s\S]*detachPrimaryEditorTabsMetadataListener = api\.onTabsMetadataChange\(\(metadata\) => \{[\s\S]*if \(tab && tab\.source === 'tabs'\)[\s\S]*updateTabsEntryTitleForTab\(tab, metadata\);/,
  'Markdown workspace controller should subscribe to tabs metadata changes and write title edits back into tabs state'
);

assert.match(
  editorSource,
  /\.editor-content-shell\.box \{[\s\S]*padding:0;[\s\S]*border:0 !important;[\s\S]*background:transparent;[\s\S]*\.editor-structure-panel \{ min-width:0; border:0; border-radius:0; background:transparent; padding:0; \}/,
  'editor structure view should not render extra outer card containers around the content'
);

assert.match(
  editorSource,
  /\.editor-structure-panel\.is-content-entering \.editor-panel-head,[\s\S]*\.editor-structure-panel\.is-content-entering \.editor-structure-body \{ animation:editor-structure-content-enter \.2s ease-out both; \}[\s\S]*@keyframes editor-structure-content-enter/,
  'editor structure panel content should animate in when the selected tree node changes'
);

assert.match(
  editorSource,
  /\.editor-structure-head \{ display:flex; justify-content:space-between; align-items:center;[\s\S]*\.editor-structure-title-row \{ display:flex; align-items:baseline;[\s\S]*\.editor-structure-kicker \{ display:none !important; \}/,
  'editor structure header should hide the kicker and place the item count beside the title'
);

assert.match(
  editorSource,
  /class="editor-panel-heading editor-structure-heading"[\s\S]*class="editor-structure-title-row"[\s\S]*id="editorStructureTitle"[\s\S]*id="editorStructureMeta"/,
  'editor structure header markup should group the title and metadata in one row'
);

assert.match(
  editorSource,
  /\.editor-markdown-panel\.is-content-entering > \.toolbar,[\s\S]*\.editor-markdown-panel\.is-content-entering \.editor-workspace \{ animation:editor-structure-content-enter \.2s ease-out both; \}/,
  'markdown editor panel should animate in when a file is opened from the tree'
);

assert.match(
  composerEditorDetailPanelControllerSource,
  /function animatePanelContent\(panel, timerKey\) \{[\s\S]*panel\.classList\.remove\('is-content-entering'\);[\s\S]*panel\.getBoundingClientRect\(\);[\s\S]*panel\.classList\.add\('is-content-entering'\);/,
  'editor detail panel controller should restart content transition classes'
);

assert.match(
  editorStructurePanelUiSource,
  /function renderEditorStructurePanel\(node\) \{[\s\S]*const animate = \(\) => animateEditorStructurePanelContent\(panel\);/,
  'structure panel rendering should restart the content transition after replacing panel contents'
);

assert.match(
  composerEditorDetailPanelControllerSource,
  /function animateEditorMarkdownPanelContent\(panel = getMarkdownPanel\(\)\) \{[\s\S]*animatePanelContent\(panel, '__pressMarkdownAnimationTimer'\);/,
  'editor detail panel controller should restart the markdown panel transition class'
);

assert.match(
  composerModeControllerSource,
  /pushEditorCurrentFileInfo\(tab\);\s*animateEditorMarkdownPanelContent\(\);/,
  'opening a markdown file should restart the editor panel transition after current file info is pushed'
);

assert.match(
  hiEditorSource,
  /function findVerticalScrollParent\(node\) \{[\s\S]*runtime\.getElementById\('editorContentPane'\)[\s\S]*function forwardVerticalWheel\(event\) \{[\s\S]*absX > absY && scroll\.scrollWidth > scroll\.clientWidth \+ 1[\s\S]*scrollParent\.scrollTop = before \+ deltaY;[\s\S]*event\.preventDefault\(\);[\s\S]*scroll\.addEventListener\('wheel', forwardVerticalWheel, \{ passive: false \}\);/,
  'hidden-overflow markdown editor should forward vertical wheel gestures to the right content pane while preserving horizontal code scrolling'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-workspace-meta \{[\s\S]*order:-1;/,
  'front matter panel should not be reordered above the markdown editor on narrow layouts'
);

assert.match(
  editorSource,
  /\.editor-tree-row \{[\s\S]*min-height:1\.75rem[\s\S]*\.editor-tree-toggle \{[\s\S]*min-height:1\.75rem[\s\S]*\.editor-tree-node \{[\s\S]*min-height:1\.75rem/,
  'file tree should use compact file-browser row heights'
);

assert.match(
  editorSource,
  /\.editor-tree-row\.is-expanding \{[^}]*animation:editor-tree-row-enter \.18s ease-out both;[\s\S]*\.editor-tree-row\.is-collapsing \{[^}]*overflow:hidden;[^}]*transition:max-height \.26s ease/,
  'file tree expand and collapse states should animate row entrance and exit'
);

assert.match(
  editorFileTreeUiSource,
  /function animateEditorTreeCollapse\(root, node, row\) \{[\s\S]*collectEditorTreeDescendantRows\(row\)[\s\S]*descendant\.style\.maxHeight = `\$\{height\}px`;[\s\S]*scheduleFrame\(collapseRows\)[\s\S]*scheduleTimeout\(finish, 340\)/,
  'file tree collapse should animate visible descendant rows before refreshing the tree'
);

assert.match(
  editorSource,
  /\.editor-tree-row\[data-kind="root"\] \.editor-tree-node \{[^}]*font-weight:700; \}[\s\S]*\.editor-tree-label \{[^}]*font-weight:400; \}[\s\S]*\.editor-tree-row\[data-kind="root"\] \.editor-tree-label \{ font-weight:700; \}/,
  'file tree root labels should be bold while leaf labels keep normal text weight'
);

assert.match(
  editorSource,
  /\.editor-tree-row\.is-leaf \.editor-tree-node \{ grid-column:1 \/ -1; \}/,
  'file tree leaf nodes should not reserve a separate empty toggle column'
);

assert.doesNotMatch(
  source + editorSource,
  /editor-tree-spacer/,
  'file tree leaf nodes should not render a fake spacer toggle'
);

assert.match(
  editorFileTreeUiSource,
  /const rowIndent = hasChildren[\s\S]*\? Math\.max\(0, depth\) \* 1\.12[\s\S]*: Math\.max\(0, depth - 1\) \* 1\.12 \+ 1\.35;/,
  'file tree leaf rows should align their content with the parent node text instead of a blank toggle'
);

assert.match(
  editorFileTreeUiSource,
  /if \(depth > 0\) \{[\s\S]*guides\.className = 'editor-tree-guides';[\s\S]*for \(let guideIndex = 0; guideIndex < depth; guideIndex \+= 1\) \{[\s\S]*guide\.className = 'editor-tree-guide';[\s\S]*guide\.style\.setProperty\('--tree-guide-index', String\(guideIndex\)\);/,
  'file tree rows should render guide lines for every ancestor depth so outer rails continue through nested rows'
);

assert.match(
  editorFileTreeUiSource,
  /let toggle = null;[\s\S]*if \(hasChildren\) \{[\s\S]*toggle = documentRef\.createElement\('button'\);[\s\S]*if \(toggle\) row\.appendChild\(toggle\);/,
  'file tree should only render expand controls for nodes with children'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-row\.is-selected \{[^}]*background:/,
  'selected file tree rows should not use a full-row highlight background'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-node \{[^}]*border:1px/,
  'file tree nodes should not use button-like blue outlines'
);

assert.match(
  editorSource,
  /#editorFileTree button\.editor-tree-toggle, #editorFileTree button\.editor-tree-node \{ appearance:none !important; border:0 !important; border-color:transparent !important; box-shadow:none !important; outline:0 !important; background:transparent !important; background-image:none !important; color:inherit !important; font-weight:inherit !important; \}/,
  'file tree buttons should override native theme global button borders'
);

assert.match(
  editorSource,
  /#editorFileTree button\.editor-tree-node:hover, #editorFileTree button\.editor-tree-node:focus-visible \{ background:color-mix\(in srgb, var\(--text\) 5%, transparent\) !important; color:inherit !important; box-shadow:none !important; outline:0 !important; \}/,
  'file tree hover and focus states should remain borderless'
);

assert.doesNotMatch(
  editorSource,
  /editor-tree-row\[draggable="true"\]|editor-tree-row\.is-drop-target/,
  'file tree should not expose drag/drop reordering states'
);

assert.doesNotMatch(
  [source, editorFileTreeUiSource].join('\n'),
  /row\.draggable|bindEditorTreeDrag|canMoveEditorTreeNode|moveEditorTreeNode|editorTreeDragNodeId/,
  'file tree rows should not support direct drag/drop reordering'
);

assert.doesNotMatch(
  editorFileTreeUiSource,
  /const states = \[node\.draftState, node\.diffState, node\.fileState\]/,
  'file tree rows should not render the old positional draft/diff/file status dots'
);

assert.match(
  editorFileTreeUiSource,
  /function createEditorTreeStatusElement\(node\) \{[\s\S]*editor-tree-status[\s\S]*editor-tree-change-badge[\s\S]*editor-tree-count-badge[\s\S]*editor-tree-order-badge[\s\S]*editor-tree-spinner/,
  'file tree rows should render readable change, count, order, and checking status elements from one helper'
);

assert.match(
  editorFileTreeUiSource,
  /editor-tree-order-badge[\s\S]*<svg viewBox="0 0 24 24" focusable="false">[\s\S]*M3 9l4 -4l4 4m-4 -4v14[\s\S]*M21 15l-4 4l-4 -4m4 4v-14/,
  'file tree order badges should use an inline arrows-sort SVG icon instead of a text glyph'
);

assert.match(
  editorFileTreeUiSource,
  /status\.setAttribute\('aria-hidden', 'true'\);/,
  'file tree visual status badges should be hidden from assistive tech because the row aria-label carries the summary'
);

assert.match(
  editorFileTreeUiSource,
  /button\.appendChild\(createEditorTreeStatusElement\(node\)\);/,
  'file tree rows should append the unified status element instead of individual status dots'
);

assert.match(
  editorFileTreeUiSource,
  /button\.setAttribute\('aria-label', getEditorTreeAccessibleLabel\(node, labelText, accessiblePath\)\);/,
  'file tree row aria labels should include the computed status summary'
);

assert.match(
  editorContentTreeControllerSource,
  /function handleSelection\(nodeId\) \{[\s\S]*if \(node\.isDeleted\) \{[\s\S]*applyMode\('editor', \{ forceStructure: true \}\);[\s\S]*refresh\(\);[\s\S]*return;[\s\S]*if \(node\.kind === 'file' && node\.path\)/,
  'selecting deleted tombstones should route to the read-only structure panel before file nodes can open markdown'
);

assert.match(
  editorStructurePanelUiSource,
  /function renderEditorStructurePanel\(node\) \{[\s\S]*if \(node\.isDeleted\) \{[\s\S]*renderEditorDeletedPanel\(node, \{ title, kicker, meta, actions, body \}\);[\s\S]*return;[\s\S]*if \(node\.kind === 'root'\)/,
  'deleted tombstones should render a read-only deleted panel before editable entry/language panels are considered'
);

assert.match(
  composerContentMutationsSource,
  /function restoreDeletedEditorTreeNode\(node\) \{[\s\S]*node\.deletedKind[\s\S]*restoreValue[\s\S]*notifyComposerChange\(node\.source\)[\s\S]*refreshEditorContentTree\(\);/,
  'deleted tombstones should have an explicit restore action that writes restored baseline payloads'
);

assert.match(
  editorStructurePanelUiSource,
  /const visibleChildren = node\.children\.filter\(child => !child\.isDeleted\);[\s\S]*visibleChildren\.forEach/,
  'root structure reorder lists should exclude deleted tombstones from draggable current-order rows'
);

const deletedPanelBody = extractFunctionBody(editorStructurePanelUiSource, 'renderEditorDeletedPanel');

assert.doesNotMatch(
  deletedPanelBody,
  /getIndexEntry|getTabsEntry|appendLanguageSelector|addEditorVersion|renderEditorEntryPanel|renderEditorLanguagePanel/,
  'deleted tombstone panel should not call editable entry/language helpers that create missing state as a side effect'
);

assert.doesNotMatch(
  editorSource,
  /\.editor-tree-badge/,
  'editor tree CSS should not keep the old anonymous dot badge styles'
);

assert.match(
  editorSource,
  /\.editor-tree-status \{[\s\S]*\.editor-tree-change-badge \{[\s\S]*\.editor-tree-count-badge \{[\s\S]*\.editor-tree-order-badge \{[\s\S]*\.editor-tree-order-badge svg \{[\s\S]*\.editor-tree-spinner \{/,
  'editor tree CSS should define readable status badges, order badges, and checking spinners'
);

assert.match(
  editorSource,
  /@keyframes editor-tree-spinner-spin[\s\S]*@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.editor-tree-spinner \{ animation:none;/,
  'editor tree checking spinner should stop animating for reduced-motion users'
);

assert.match(
  editorSource,
  /#editorFileTree \.editor-tree-row\.is-selected > button\.editor-tree-node \{ background:color-mix\(in srgb, var\(--primary\) 18%, transparent\) !important;[\s\S]*color:color-mix\(in srgb, var\(--primary\) 86%, var\(--text\)\) !important; \}/,
  'selected file tree state should use a pale file-browser fill on the node button'
);

assert.match(
  editorFileTreeUiSource,
  /function isEditorTreeFileKind\(kind\) \{[\s\S]*kind === 'file' \|\| kind === 'deleted-file'[\s\S]*function createEditorTreeIcon\(node\) \{[\s\S]*const isFile = isEditorTreeFileKind\(node\.kind\);[\s\S]*let iconKind = isFile \? 'document' : 'folder';[\s\S]*node\.id === 'system:site-settings'[\s\S]*iconKind = 'settings';[\s\S]*node\.id === 'system:themes'[\s\S]*iconKind = 'themes';[\s\S]*node\.id === 'system:updates'[\s\S]*iconKind = 'updates';[\s\S]*node\.id === 'system:sync'[\s\S]*iconKind = 'publish';[\s\S]*editor-tree-icon-\$\{iconKind\}/,
  'file tree should render folder/document icons and dedicated system action icons'
);

assert.doesNotMatch(
  editorFileTreeUiSource,
  /className = 'editor-tree-path'/,
  'file tree should keep paths out of visible node text'
);

assert.match(
  editorSource,
  /\.editor-tree-guides \{ position:absolute; inset:-\.12rem 0; pointer-events:none; \}[\s\S]*\.editor-tree-guide \{[\s\S]*left:calc\(\(var\(--tree-guide-index\) \* 1\.12rem\) \+ \.58rem\);[\s\S]*background:color-mix\(in srgb, var\(--border\) 82%, transparent\)/,
  'nested file tree rows should draw subtle vertical guide lines for all ancestor levels'
);

assert.match(
  editorSource,
  /\.editor-tree-row\[data-kind="root"\] \.editor-tree-node \{ padding-left:\.45rem; font-weight:700; \}/,
  'root file tree labels should have enough left inset inside the selected pill'
);

// composer-identity-body:end
