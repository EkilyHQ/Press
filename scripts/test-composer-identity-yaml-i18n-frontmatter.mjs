import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerSyncPanelSource = readIdentitySource('../assets/js/composer-sync-panel.js');

const composerYamlDraftsSource = readIdentitySource('../assets/js/composer-yaml-drafts.js');

const composerContentStagingSource = readIdentitySource('../assets/js/composer-content-staging.js');

const composerMarkdownAssetsSource = readIdentitySource('../assets/js/composer-markdown-assets.js');

const composerMarkdownLoaderSource = readIdentitySource('../assets/js/composer-markdown-loader.js');

const composerMarkdownStateSource = readIdentitySource('../assets/js/composer-markdown-state.js');

const composerMarkdownDraftsSource = readIdentitySource('../assets/js/composer-markdown-drafts.js');

const editorStructurePanelUiSource = readIdentitySource('../assets/js/editor-structure-panel-ui.js');

const propagationWatcherSource = readIdentitySource('../assets/js/publish/propagation-watcher.js');

const editorMainSource = readIdentitySource('../assets/js/editor-main.js');

const editorMainFrontMatterManagerSource = readIdentitySource('../assets/js/editor-main-frontmatter-manager.js');

const editorSource = readIdentitySource('../index_editor.html');

const i18nSource = readIdentitySource('../assets/js/i18n.js');

const enI18nSource = readIdentitySource('../assets/i18n/en.js');

const chsI18nSource = readIdentitySource('../assets/i18n/chs.js');

const chtTwI18nSource = readIdentitySource('../assets/i18n/cht-tw.js');

const chtHkI18nSource = readIdentitySource('../assets/i18n/cht-hk.js');

const jaI18nSource = readIdentitySource('../assets/i18n/ja.js');

const languagesManifestSource = readIdentitySource('../assets/i18n/languages.json');

// composer-identity-body:start

assert.match(
  composerYamlDraftsSource,
  /export function createComposerYamlDraftController\(options = \{\}\)[\s\S]*const draftMeta = \{ index: null, tabs: null, site: null \};[\s\S]*const autoSaveTimers = \{ index: null, tabs: null, site: null \};[\s\S]*function saveDraftToStorage\(kind, opts = \{\}\)[\s\S]*function scheduleAutoDraft\(kind\)[\s\S]*function loadDraftSnapshotsIntoState\(state\)/,
  'YAML draft controller should own index/tabs/site draft metadata, autosave timers, persistence, and restore'
);

assert.match(
  source,
  /composerYamlFeature\.createRuntime\(\{[\s\S]*setTimeoutRef: \(handler, delay\) => editorRuntime\.setTimer\(handler, delay\),[\s\S]*clearTimeoutRef: \(id\) => editorRuntime\.clearTimer\(id\)[\s\S]*\}\);/,
  'composer should inject YAML draft autosave timers through the feature runtime boundary'
);

assert.doesNotMatch(
  composerYamlDraftsSource,
  /typeof (?:setTimeout|clearTimeout)\b|(^|[^.])\b(?:setTimeout|clearTimeout)\s*\(/m,
  'YAML drafts should receive autosave timers through explicit runtime wiring'
);

assert.match(
  propagationWatcherSource,
  /files\.forEach\(\(file\) => \{[\s\S]*unique\.push\(\{ \.\.\.file, path: normalized \}\);[\s\S]*if \(file\.deleted\) \{[\s\S]*resp\.status !== 404 && resp\.status !== 410[\s\S]*ok = checked && !stillExists && !indeterminate;/,
  'remote propagation checks should verify deleted commit entries disappear'
);

assert.match(
  composerContentStagingSource,
  /from '\.\/repository-deletions\.js';[\s\S]*planManagedContentDeletions\(\{[\s\S]*indexBaseline: remoteBaseline\.index[\s\S]*tabsBaseline: remoteBaseline\.tabs[\s\S]*contentDeletionPlan\.files\.forEach\(addFile\);/,
  'composer should stage repository markdown deletions from article/page tombstones'
);

assert.match(
  composerContentStagingSource,
  /function collectDirtyMarkdownPathsForDeletion\(\) \{[\s\S]*const hasContent = entry\.content != null && normalizeMarkdownContent\(entry\.content\);[\s\S]*const hasAssets = Array\.isArray\(entry\.assets\) && entry\.assets\.length;[\s\S]*const hasDeletedAssets = draftHasAssetDeletions\(entry\);[\s\S]*if \(hasContent \|\| hasAssets \|\| hasDeletedAssets\) paths\.add\(key\);/,
  'repository deletion blockers should treat stored deletion-only asset drafts as pending local draft state'
);

assert.match(
  composerMarkdownAssetsSource,
  /const markdownDeletedAssetStore = new Map\(\);[\s\S]*function normalizeAssetDeletionDescriptor\(asset, markdownPath\) \{[\s\S]*resolveLocalMarkdownAssetReference\(markdown, relativePath, getContentRootSafe\(\)\)[\s\S]*if \(assetPath && assetPath !== resolved\.contentPath\) return null;[\s\S]*function stageMarkdownAssetDeletion\(path, resolved\) \{[\s\S]*bucket\.set\(assetPath, entry\);[\s\S]*updateMarkdownDraftStoreAssetDeletions\(norm, exportMarkdownAssetDeletionBucket\(norm\)\);[\s\S]*function handleEditorAssetDeleteRequested\(event\) \{[\s\S]*resolveLocalMarkdownAssetReference\(markdownPath, source, getContentRootSafe\(\)\)[\s\S]*stageMarkdownAssetDeletion\(markdownPath, resolved\)[\s\S]*addWindowListener\(type, handler\)/,
  'Markdown asset manager should stage and persist explicit local markdown asset deletions from visual image blocks'
);

assert.match(
  [composerMarkdownStateSource, composerMarkdownDraftsSource, composerMarkdownLoaderSource].join('\n'),
  /function hasMarkdownDraftContent\(tab\) \{[\s\S]*const deletedAssets = Array\.isArray\(draft\.deletedAssets\) && draft\.deletedAssets\.length;[\s\S]*return !!\(plain \|\| encrypted \|\| deletedAssets\);[\s\S]*async function saveDraftForTab\(tab, saveOptions = \{\}\) \{[\s\S]*const deletedAssets = exportMarkdownAssetDeletionBucket\(tab\.path\);[\s\S]*if \(!text && !deletedAssets\.length\) \{[\s\S]*const assetDeletionDirty = countMarkdownAssetDeletions\(tab\.path\) > 0;[\s\S]*const dirty = normalizedContent !== baseline \|\| protectionChanged \|\| assetDeletionDirty;[\s\S]*tab\.localDraft && draftHasAssetDeletions\(tab\.localDraft\)[\s\S]*tab\.content = normalizeMarkdownContent\(tab\.localDraft\.content \|\| ''\);/,
  'markdown draft persistence should preserve deletion-only asset drafts across empty-body autosaves, reloads, and remote loads'
);

assert.match(
  composerMarkdownAssetsSource,
  /function draftHasAssetDeletions\(draft\) \{[\s\S]*Array\.isArray\(draft\.deletedAssets\) && draft\.deletedAssets\.length/,
  'Markdown asset manager should expose deletion-only draft detection for composer draft persistence'
);

assert.match(
  composerMarkdownAssetsSource,
  /dynamicEditorTabs\.forEach\(\(tab\) => \{[\s\S]*const content = knownMarkdownTextForAssetScan\(tab, activeTab, activeValue\);[\s\S]*const deletionOnlyDraft = !content && tab && tab\.localDraft && draftHasAssetDeletions\(tab\.localDraft\);[\s\S]*if \(!content && !deletionOnlyDraft\) return;[\s\S]*seen\.add\(path\);/,
  'asset reference scan should only mark dynamic markdown paths checked after content or a deletion-only draft is known'
);

assert.match(
  [composerMarkdownAssetsSource, composerContentStagingSource].join('\n'),
  /async function fetchMarkdownForAssetScan\(contentPath, contentRoot = 'wwwroot'\) \{[\s\S]*if \(!resp\.ok\) return \{ text: '', failed: true \};[\s\S]*return \{ text: normalizeMarkdownContent\(await resp\.text\(\)\), failed: false \};[\s\S]*async function collectCurrentRepositoryMarkdownAssetReferences\(options = \{\}\) \{[\s\S]*const failures = \[\];[\s\S]*currentManagedMarkdownPathsForAssetScan\(currentRoot\)[\s\S]*fetchMarkdownForAssetScan\(norm, currentRoot\)[\s\S]*if \(result\.failed\) \{[\s\S]*failures\.push\(norm\);[\s\S]*return \{ refs, failures \};[\s\S]*const assetReferenceScan = await collectCurrentRepositoryMarkdownAssetReferences\(\{[\s\S]*const assetReferenceScanComplete = !\(assetReferenceScan\.failures && assetReferenceScan\.failures\.length\);[\s\S]*if \(assetReferenceScanComplete\) \{[\s\S]*listMarkdownAssetDeletions\(\)\.forEach\(\(asset\) => \{/,
  'commit payload should fail closed and include asset deletions only after scanning current published markdown references'
);

assert.match(
  composerContentStagingSource,
  /async function collectDeletedMarkdownAssetFiles\(markdownDeletionFiles = \[\], options = \{\}\) \{[\s\S]*fetchMarkdownForRepositoryDeletion\(file\)[\s\S]*listLocalMarkdownAssetReferences\(markdown, file\.markdownPath, contentRoot\)[\s\S]*if \(referencedAssets\.has\(resolved\.contentPath\)\) return;[\s\S]*deleted: true[\s\S]*collectDeletedMarkdownAssetFiles\(contentDeletionPlan\.files/,
  'deleting an article or page should also stage same-directory local asset deletions unless known markdown still references them'
);

assert.doesNotMatch(
  composerSyncPanelSource,
  /editor\.composer\.github\.modal\.tokenLabel|sync-token-help|className = 'sync-token-field'/,
  'Sync page should no longer render the fine-grained token settings inline'
);

assert.match(
  editorSource,
  /id="editorFileTree" role="tree"/,
  'editor should render the content file tree as the primary article/page manager'
);

assert.doesNotMatch(
  editorSource,
  /class="editor-tree-head"|id="btnEditorAddArticle"|id="btnEditorAddPage"|data-i18n="editor\.tree\.title"|data-i18n="editor\.tree\.subtitle"/,
  'file tree rail should not render the Content heading, subtitle, or add-entry buttons'
);

assert.doesNotMatch(
  source,
  /btnEditorAddArticle|btnEditorAddPage/,
  'add article/page entry handlers should live in the root structure panels, not the tree rail'
);

assert.match(
  editorStructurePanelUiSource,
  /if \(node\.kind === 'root'\) \{[\s\S]*const add = makeStructureButton\(isPages \? treeText\('addPage', 'Page'\) : treeText\('addArticle', 'Article'\)\);[\s\S]*actions\.appendChild\(add\);/,
  'root structure panels should retain add article/page entry actions'
);

assert.match(
  [enI18nSource, chsI18nSource, chtTwI18nSource, jaI18nSource].join('\n'),
  /addArticle: '\+ New article'[\s\S]*addArticle: '\+ 新建文章'[\s\S]*addArticle: '\+ 新增文章'[\s\S]*addArticle: '\+ 新規記事'/,
  'root article actions should be explicit add actions in every UI language'
);

assert.match(
  chtHkI18nSource,
  /import chtTwTranslations from '\.\/cht-tw\.js';/,
  'Hong Kong Traditional Chinese should inherit the cache-busted Traditional Chinese asset deletion strings'
);

assert.match(
  languagesManifestSource,
  /"\.\/en\.js"[\s\S]*"\.\/chs\.js"[\s\S]*"\.\/cht-tw\.js"[\s\S]*"\.\/cht-hk\.js"[\s\S]*"\.\/ja\.js"/,
  'language manifest should cache-bust language bundles changed by editor asset deletion labels'
);

assert.match(
  i18nSource,
  /from '\.\.\/i18n\/en\.js'/,
  'default English bundle import should be cache-busted when editor asset deletion labels change'
);

[
  source,
  editorMainSource,
  readIdentitySource('../assets/js/editor-boot.js'),
  readIdentitySource('../assets/js/system-updates.js'),
  readIdentitySource('../assets/js/theme.js'),
  readIdentitySource('../assets/js/seo.js')
].forEach((moduleSource) => {
  assert.doesNotMatch(
    moduleSource,
    /i18n\.js\?v=20260506theme/,
    'runtime modules should not keep the stale i18n module cache key'
  );
});

assert.match(
  editorSource,
  /html, body \{ width: 100%; height: 100%; overflow: hidden; \}[\s\S]*\.editor-page \{ position: fixed; inset: 0;[^}]*overflow: hidden;/,
  'editor page should be fixed to the visible viewport with independent rail and content scrolling'
);

assert.match(
  editorSource,
  /@media \(max-width: 640px\) \{[\s\S]*\.editor-page \{ padding:0; \}/,
  'extra narrow editor page should stay flush to the viewport edge'
);

assert.match(
  editorSource,
  /\.editor-rail-tree-scroll \{[^}]*overflow:auto;[\s\S]*\.editor-content-pane \{[^}]*overflow-x:hidden;[\s\S]*overflow-y:auto;/,
  'editor rail tree and right content pane should scroll independently without page-level horizontal scrolling'
);

assert.match(
  editorSource,
  /\.editor-rail-resizer \{[^}]*cursor:col-resize;[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-rail \{[\s\S]*position:fixed;[\s\S]*transform:translateX\(-102%\);[\s\S]*\.editor-rail-resizer \{\s*display:none;/,
  'editor rail should support desktop resizing and switch to a mobile drawer without the resizer'
);

assert.match(
  editorSource,
  /\.editor-rail \{[\s\S]*border-right:0;[\s\S]*\.editor-rail-resizer::before \{[\s\S]*left:50%;[\s\S]*width:1px;[\s\S]*opacity:\.65;[\s\S]*\.editor-file-tree-pane \{[\s\S]*border-right:0;/,
  'file tree rail should not show a container border, while the resize handle keeps its own one-pixel line'
);

assert.match(
  editorSource,
  /class="editor-modal-layer" id="editorModalLayer" hidden aria-hidden="true"[\s\S]*class="editor-modal-dialog"[\s\S]*id="mode-composer" hidden aria-hidden="true"[\s\S]*id="mode-themes" hidden aria-hidden="true"[\s\S]*id="mode-updates" hidden aria-hidden="true"/,
  'Site Settings, Themes, and System Updates should be mounted inside the hidden editor modal layer'
);

assert.match(
  editorSource,
  /\.editor-workspace \{[\s\S]*grid-template-columns:minmax\(0, 1fr\);[\s\S]*\.editor-workspace-meta \{[\s\S]*grid-column:1;[\s\S]*\.frontmatter-panel \{[\s\S]*position: static;/,
  'front matter panel should always flow below the markdown editor instead of using a side rail'
);

assert.match(
  editorSource,
  /\.editor-markdown-panel > \.toolbar \{[\s\S]*margin-left:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*margin-right:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*padding-left:var\(--editor-content-pane-padding, 1rem\);[\s\S]*padding-right:var\(--editor-content-pane-padding, 1rem\);/,
  'markdown editor topbar should span the content pane while preserving its visual inset with internal padding'
);

assert.match(
  editorSource,
  /\.frontmatter-panel \{[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*\.frontmatter-grid \{[\s\S]*--frontmatter-row-gap: 0\.35rem;[\s\S]*display: flex;[\s\S]*gap: var\(--frontmatter-row-gap\);[\s\S]*\.frontmatter-field \{[\s\S]*padding: 0;[\s\S]*display: grid;[\s\S]*grid-template-columns: var\(--frontmatter-single-label-width, 88px\) minmax\(0, var\(--frontmatter-single-control-width\)\);/,
  'front matter fields should use compact Site Settings-style rows with measured label width'
);

assert.doesNotMatch(
  editorSource,
  /\.frontmatter-field \{[\s\S]*grid-template-columns: minmax\(88px, 88px\) minmax\(0, var\(--frontmatter-single-control-width\)\);/,
  'front matter label column should not stay fixed to the old 88px width'
);

assert.match(
  editorSource,
  /\.frontmatter-section \{[\s\S]*border: 1px solid color-mix\(in srgb, var\(--border\) 96%, transparent\);[\s\S]*background: var\(--card\);[\s\S]*gap: 0\.6rem;[\s\S]*\.frontmatter-section-head \{[\s\S]*align-items: baseline;[\s\S]*\.frontmatter-section-title \{[\s\S]*font-size: 1rem;[\s\S]*\.frontmatter-section-description \{[\s\S]*font-size: 0\.82rem;[\s\S]*text-align: right;/,
  'front matter sections should mirror the Site Settings single-column section card header style'
);

assert.match(
  editorSource,
  /\.editor-workspace-meta::before \{[\s\S]*width:min\(18rem, 62%\);[\s\S]*repeating-linear-gradient\([\s\S]*color-mix\(in srgb, var\(--muted\) 64%, transparent\) 0 \.72rem,[\s\S]*transparent \.72rem 1\.08rem[\s\S]*@container \(min-width: 66\.5rem\) \{[\s\S]*\.editor-workspace-meta::before \{[\s\S]*display:none;/,
  'single-column article editor layout should show a thin decorative dashed divider above the metadata panel and hide it in the two-column rail'
);

assert.match(
  editorSource,
  /\.frontmatter-section\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/,
  'front matter sections should honor hidden state so page files can suppress article-only metadata groups'
);

assert.match(
  editorSource,
  /frontMatterCommonSection[\s\S]*frontmatter-section-head[\s\S]*data-i18n="editor\.frontMatter\.commonDescription"[\s\S]*frontMatterExtraSection[\s\S]*frontmatter-section-head[\s\S]*data-i18n="editor\.frontMatter\.advancedDescription"/,
  'front matter common and advanced sections should include localized section descriptions'
);

assert.match(
  editorMainFrontMatterManagerSource,
  /head\.className = 'frontmatter-field-head';[\s\S]*labelWrap\.className = 'frontmatter-field-label-wrap';[\s\S]*labelSpan\.className = 'frontmatter-field-title';[\s\S]*controls\.className = 'frontmatter-field-controls';[\s\S]*controls\.appendChild\([\s\S]*entry\.container\.appendChild\(controls\);/,
  'front matter field DOM should include field head, label wrap, and controls wrapper'
);

assert.match(
  editorMainFrontMatterManagerSource,
  /const clear = \(\) => \{[\s\S]*state = \{[\s\S]*data:\s*\{\}[\s\S]*hasFrontMatter:\s*false[\s\S]*rebuildBindings\(\);[\s\S]*\};[\s\S]*return \{[\s\S]*clear,/,
  'front matter manager should expose a clear helper to reset stale article metadata state'
);

// composer-identity-body:end
