import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

const components = read('assets/js/components.js');
const main = read('assets/main.js');
const indexHtml = read('index.html');
const indexEditorHtml = read('index_editor.html');
const indexEditorPreviewHtml = read('index_editor_preview.html');
const composer = read('assets/js/composer.js');
const editorMain = read('assets/js/editor-main.js');
const editorPreviewRuntime = read('assets/js/editor-preview-runtime.js');
const search = read('assets/js/search.js');
const theme = read('assets/js/theme.js');
const themeBoot = read('assets/js/theme-boot.js');
const toc = read('assets/js/toc.js');
const linkCards = read('assets/js/link-cards.js');
const nativeSearch = read('assets/themes/native/modules/search-box.js');
const nativeToc = read('assets/themes/native/modules/toc.js');
const nativeInteractions = read('assets/themes/native/modules/interactions.js');
const themeLayout = read('assets/js/theme-layout.js');
const postCardHtml = read('assets/js/post-card-html.js');
const mathRender = read('assets/js/math-render.js');
const editorBlocks = read('assets/js/editor-blocks.js');
const syntaxHighlight = read('assets/js/syntax-highlight.js');
const highlightJsBundle = read('assets/js/vendor/highlightjs/highlight.min.js');
const nativeCss = read('assets/themes/native/base.css');
const languageManifest = read('assets/i18n/languages.json');

assert.match(components, /arcus-tools__groups[\s\S]*arcus-tool[\s\S]*solstice-tools[\s\S]*solstice-tool/, 'theme controls should preserve legacy Arcus and Solstice control classes for already-installed themes');
assert.doesNotMatch(components, /\bcartograph\b/i, 'core UI components should not hard-code non-legacy external theme variants');

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `missing start marker: ${startNeedle}`);
  const bodyStart = start + startNeedle.length;
  const end = source.indexOf(endNeedle, bodyStart);
  assert.notEqual(end, -1, `missing end marker: ${endNeedle}`);
  return source.slice(bodyStart, end);
}

assert.match(components, /class PressSearch extends HTMLElement[\s\S]*dispatchPressEvent\(this, 'press:search'/, 'press-search should own the search input and emit press:search');
assert.match(components, /<input id="\$\{inputId\}" part="input"/, 'press-search should expose its input as a CSS part without a fixed DOM id');
assert.match(components, /const icon = this\.hasAttribute\('icon'\)[\s\S]*const iconHtml = icon \? `<span class="\$\{iconClass\}" part="icon"/, 'press-search should render an icon only when a theme opts in');
assert.match(components, /function ensureShadowRoot[\s\S]*attachShadow\(\{ mode: 'open' \}\)/, 'shared components should offer opt-in shadow roots for real ::part styling');
assert.match(components, /class PressThemeControls extends HTMLElement[\s\S]*'press:theme-pack-change'[\s\S]*'press:language-change'/, 'press-theme-controls should own tool UI events');
assert.match(components, /class PressToc extends HTMLElement[\s\S]*renderToc\(options = \{\}\)[\s\S]*part="toc"[\s\S]*_cleanupListeners/, 'press-toc should render exposed parts and clean up its own listeners');
assert.match(components, /renderToc\(options = \{\}\)[\s\S]*options\.contentRoot[\s\S]*options\.scrollRoot[\s\S]*_scrollRoot\(\)/, 'press-toc should accept region-owned content and scroll roots');
assert.match(components, /class PressPostCard extends HTMLElement[\s\S]*'card-class'[\s\S]*'tags-class'[\s\S]*_captureSlotContent[\s\S]*_shadowSlot[\s\S]*<slot name="\$\{slotName\}"[\s\S]*_renderCard[\s\S]*part="card/, 'press-post-card should render a generic configurable card with slots and parts');
assert.match(components, /class PressPostCard extends HTMLElement[\s\S]*<slot name="meta">[\s\S]*<slot name="tags">[\s\S]*_shadowSlot\('cover'[\s\S]*_shadowSlot\('actions'[\s\S]*_shadowSlot\('footer'/, 'press-post-card should support cover/meta/actions/footer slots in shadow mode');
assert.match(components, /export \{ renderPressPostCardHtml \} from '\.\/post-card-html\.js';/, 'components should re-export the pure press-post-card HTML helper');
assert.match(postCardHtml, /export function renderPressPostCardHtml[\s\S]*Object\.prototype\.hasOwnProperty\.call\(classes, key\)[\s\S]*return ` \$\{attr\}="\$\{safe\(String\(classes\[key\]\)\)\}"/, 'press-post-card helper should preserve explicit empty class attributes');
assert.doesNotMatch(postCardHtml, /\bHTMLElement\b|\bcustomElements\b|\bdocument\b|\bwindow\b|from '\.\/utils\.js'/, 'press-post-card HTML helper should stay browser-global free for Node theme tests');
const primitiveComponents = [
  sliceBetween(components, 'export class PressSearch extends HTMLElement {', '\n\nexport class PressThemeControls'),
  sliceBetween(components, 'export class PressToc extends HTMLElement {', '\n\nexport class PressPostCard'),
  sliceBetween(components, 'export class PressPostCard extends HTMLElement {', '\n\nexport function registerPressComponents')
].join('\n');
assert.doesNotMatch(primitiveComponents, /variant ===|_renderNative|_renderArcus|_renderSolstice|arcus-card|solstice-card|arcus-search|solstice-search/, 'shared primitives should not hard-code shipped theme variants');
assert.match(components, /class PressPostCard extends HTMLElement[\s\S]*dispatchPressEvent\(this, 'press:navigate'/, 'press-post-card should emit press:navigate');
assert.match(components, /class PressPostCard extends HTMLElement[\s\S]*composedPath\(\)[\s\S]*root !== this\.shadowRoot/, 'press-post-card navigation should work from shadow DOM clicks');
assert.match(components, /class PressToc extends HTMLElement[\s\S]*dispatchPressEvent\(this, 'press:navigate'/, 'press-toc should emit press:navigate for heading jumps');
assert.match(components, /defineElement\('press-search'[\s\S]*defineElement\('press-theme-controls'[\s\S]*defineElement\('press-toc'[\s\S]*defineElement\('press-post-card'/, 'all UI components should be registered centrally');

const pressSearchAttributeChanged = sliceBetween(
  components,
  '  attributeChangedCallback(name, oldValue, newValue) {',
  '\n\n  get input()'
);
assert.match(pressSearchAttributeChanged, /if \(name === 'value'\) \{[\s\S]*this\._syncInputState\(\);[\s\S]*return;/, 'press-search should only sync input value for value attribute changes');
const placeholderBranch = pressSearchAttributeChanged.indexOf("if (name === 'placeholder')");
const labelBranch = pressSearchAttributeChanged.indexOf("if (name === 'label')");
assert.notEqual(placeholderBranch, -1, 'press-search should handle placeholder attribute updates separately');
assert.notEqual(labelBranch, -1, 'press-search should handle label attribute updates separately');
assert.doesNotMatch(pressSearchAttributeChanged.slice(placeholderBranch), /this\._syncInputState\(\)/, 'placeholder and label updates should not overwrite the live input value');

const pressTocBindClicks = sliceBetween(
  components,
  '  _bindTocClicks() {',
  '\n    const top = this.querySelector'
);
const tocMapSet = pressTocBindClicks.indexOf('this._idToLink.set(id, anchor)');
const tocBoundGuard = pressTocBindClicks.indexOf("anchor.dataset.pressTocBound === 'true'");
assert.notEqual(tocMapSet, -1, 'press-toc should register anchors in _idToLink');
assert.notEqual(tocBoundGuard, -1, 'press-toc should keep a listener binding guard');
assert.ok(tocMapSet < tocBoundGuard, 'press-toc should rebuild _idToLink before skipping already-bound anchors');

assert.match(main, /import '\.\/js\/components\.js';/, 'main should register custom elements before theme layout mounting');
assert.match(main, /from '\.\/js\/markdown\.js\?v=markdown-security-20260512';/, 'main should cache-bust markdown parser when sanitizer boundaries change');
assert.match(main, /from '\.\/js\/safe-html\.js\?v=katex-math-20260510';/, 'main should cache-bust sanitizer when rendered Markdown allowlist changes');
assert.match(main, /from '\.\/js\/math-render\.js\?v=katex-math-20260510';/, 'main should cache-bust math renderer when KaTeX support changes');
assert.match(mathRender, /querySelectorAll\('\.press-math\[data-tex\]'\)/, 'math renderer should only target parser-generated math nodes');
assert.doesNotMatch(mathRender, /auto-render/i, 'math renderer must not use KaTeX auto-render');
assert.match(mathRender, /vendor\/katex\/[\s\S]*katex\.min\.css[\s\S]*katex\.min\.js/, 'math renderer should load vendored KaTeX core assets');
assert.match(syntaxHighlight, /vendor\/highlightjs\/highlight\.min\.js/, 'syntax highlighter should load the vendored Highlight.js common bundle');
assert.match(highlightJsBundle, /Highlight\.js v11\.11\.1/, 'vendored Highlight.js bundle should stay pinned to the reviewed common browser build');
assert.match(editorBlocks, /from '\.\/math-render\.js\?v=katex-math-20260510';/, 'block editor should reuse the vendored KaTeX math renderer');
assert.match(editorBlocks, /const BLOCK_TYPES = new Set\(\[[^\]]*'math'/, 'block editor should register a math block type');
assert.match(editorBlocks, /\['∑', 'math', 'inlineMath', 'Math'\]/, 'block editor should expose an inline math command');
assert.match(indexEditorHtml, /blocks-math-editor[\s\S]*blocks-math-editor textarea/, 'block editor should include math source popover styling');
assert.match(editorBlocks, /mathSource\.className = 'blocks-math-source'/, 'block editor should create a math source popover field');
assert.match(main, /from '\.\/js\/theme-layout\.js\?v=frontmatter-merge-20260512';/, 'main should cache-bust theme layout when preview theme mount generation changes');
assert.match(main, /from '\.\/js\/theme\.js\?v=frontmatter-merge-20260512';/, 'main should cache-bust theme helpers when local theme overlays change');
assert.match(theme, /fetchThemePackList\('assets\/themes\/packs\.local\.json', true\)/, 'main-site theme controls should allow ignored local theme-pack overlays for development');
assert.match(main, /from '\.\/js\/i18n\.js\?v=frontmatter-merge-20260512';/, 'main should use the same versioned i18n module instance as shared UI modules');
assert.match(main, /from '\.\/js\/link-cards\.js\?v=encrypted-demo-20260508';/, 'main should cache-bust internal link cards when protected preview handling changes');
assert.match(main, /from '\.\/js\/seo\.js\?v=frontmatter-merge-20260512';/, 'main should cache-bust SEO helpers after their i18n dependency changes');
assert.match(main, /from '\.\/js\/toc\.js\?v=frontmatter-merge-20260512';/, 'main should cache-bust TOC helpers after their i18n dependency changes');
assert.match(main, /from '\.\/js\/tags\.js\?v=frontmatter-merge-20260512';/, 'main should cache-bust tag helpers after their i18n dependency changes');
assert.match(main, /from '\.\/js\/errors\.js\?v=frontmatter-merge-20260512';/, 'main should cache-bust error helpers after their i18n dependency changes');
assert.match(main, /from '\.\/js\/post-nav\.js\?v=frontmatter-merge-20260512';/, 'main should cache-bust post navigation helpers after their i18n dependency changes');
assert.match(main, /from '\.\/js\/annotate\.js\?v=katex-math-20260510';/, 'main should cache-bust annotate runtime helpers when comments are mounted');
assert.match(main, /function getRawIndexVariantLocation\(value\)[\s\S]*value\.location \|\| value\.path[\s\S]*function collectRawIndexVariants\(entry, options = \{\}\)/, 'main should read object variant locations from raw index arrays');
assert.match(main, /const pickPreferred = \(entry\) => \{[\s\S]*const variants = collectRawIndexVariants\(entry\);[\s\S]*const cand = findBy\(\[curNorm\]\) \|\| findBy\(\[defNorm\]\)/, 'main should preserve homepage order for object version arrays in raw index data');
assert.match(composer, /from '\.\/i18n\.js\?v=frontmatter-merge-20260512';/, 'composer should share the repository deletion docs i18n cache key');
assert.match(composer, /from '\.\/seo\.js\?v=frontmatter-merge-20260512';/, 'composer should cache-bust SEO helpers after editor i18n dependency changes');
assert.match(composer, /from '\.\/system-updates\.js\?v=frontmatter-merge-20260512';/, 'composer should cache-bust system updates after version compatibility changes');
assert.match(read('assets/js/system-updates.js'), /from '\.\/safe-html\.js\?v=katex-math-20260510';/, 'system updates should cache-bust sanitizer when release notes can contain math');
assert.match(composer, /from '\.\/theme-manager\.js\?v=frontmatter-merge-20260512';/, 'composer should cache-bust theme manager after Press engine compatibility changes');
assert.match(composer, /from '\.\/encrypted-content\.js\?v=encrypted-demo-20260508';/, 'composer should use the encrypted markdown envelope helpers for protected editor flows');
assert.match(themeLayout, /from '\.\/i18n\.js\?v=frontmatter-merge-20260512';/, 'theme layout should share the repository deletion docs i18n cache key');
assert.match(languageManifest, /en\.js\?v=frontmatter-merge-20260512/, 'language manifest should cache-bust bundles when editor asset deletion strings change');
assert.doesNotMatch(
  [main, composer, themeLayout, theme, toc, read('assets/js/seo.js'), read('assets/js/editor-boot.js'), read('assets/js/system-updates.js')].join('\n'),
  /i18n\.js\?v=20260506theme/,
  'runtime/editor modules should not keep the old i18n cache key after protected article string changes'
);
assert.match(main, /parseEncryptedMarkdownEnvelope[\s\S]*renderProtectedPostUnlock[\s\S]*decryptMarkdownDocument/, 'main should gate encrypted articles behind an unlock form before markdown rendering');
assert.match(main, /function isPostProtectedByIndex[\s\S]*protectedByIndex[\s\S]*encryptedEnvelope\.encrypted \|\| protectedByIndex/, 'main should fail closed when public index metadata marks a post protected');
assert.match(main, /protectedPostInvalid[\s\S]*encryptedEnvelope\.encrypted \? markdown : ''[\s\S]*extractSEOFromMarkdown[\s\S]*updateSEO/, 'invalid protected envelopes should replace stale decrypted SEO metadata without body fallback before returning');
assert.match(main, /input\.autocomplete = 'off';[\s\S]*data-1p-ignore[\s\S]*data-lpignore/, 'protected post unlock field should not opt into browser password-manager storage');
assert.match(main, /const excerpt = String\(publicMetadata\.excerpt \|\| ''\)\.trim\(\);[\s\S]*excerptEl\.className = 'protected-post-excerpt';[\s\S]*excerptEl\.textContent = excerpt;/, 'protected post unlock should render public excerpts as text content only');
assert.match(main, /const unlockRequestId = __activePostRequestId;[\s\S]*currentPostname !== postname[\s\S]*displayPost\(postname, \{ markdown \}\)/, 'protected post unlock should ignore stale decrypt completions after navigation');
assert.match(main, /function displayPost\(postname, options = \{\}\)[\s\S]*hasPreloadedMarkdown[\s\S]*Promise\.resolve\(String\(options\.markdown \|\| ''\)\)[\s\S]*getFile\(`\$\{getContentRoot\(\)\}\/\$\{postname\}`\)/, 'protected post unlock should render from the already-loaded encrypted markdown instead of fetching again after successful decrypt');
assert.match(composer, /async function saveMarkdownDraftForTab[\s\S]*prepareMarkdownForProtectedStorage[\s\S]*saveMarkdownDraftEntry\(tab\.path, prepared\.content[\s\S]*encrypted: prepared\.encrypted/, 'protected markdown drafts should be encrypted before entering localStorage');
assert.match(composer, /async function gatherLocalChangesForCommit[\s\S]*await Promise\.all\(flushes\)[\s\S]*prepareMarkdownForProtectedStorage\(tab, text, \{ reason: 'commit' \}\)[\s\S]*protected: !!prepared\.encrypted/, 'protected markdown commit payloads should stage ciphertext instead of editor plaintext');
assert.match(composer, /function getLockedEncryptedMarkdownDraft[\s\S]*!draft\.encrypted \|\| draft\.decrypted[\s\S]*const lockedEncryptedDraft = getLockedEncryptedMarkdownDraft\(tab\)[\s\S]*alreadyEncrypted = true/, 'publish should reuse locked encrypted draft ciphertext instead of treating empty editor content as plaintext');
assert.match(composer, /function bumpMarkdownDraftSaveGeneration[\s\S]*async function saveMarkdownDraftForTab[\s\S]*const saveGeneration = getMarkdownDraftSaveGeneration\(tab\)[\s\S]*if \(saveGeneration !== getMarkdownDraftSaveGeneration\(tab\)\) return null;[\s\S]*function clearMarkdownDraftForTab[\s\S]*bumpMarkdownDraftSaveGeneration\(tab\)/, 'discard and close should cancel in-flight encrypted draft saves before they can rewrite localStorage');
assert.match(composer, /function createDiscardedMarkdownProtectionState\(protection\)[\s\S]*password: ''[\s\S]*remoteSignature: current\.remoteSignature[\s\S]*setMarkdownProtectionState\(active, createDiscardedMarkdownProtectionState\(protection\)\)/, 'discarding a protected markdown edit should clear discarded password changes instead of reusing them on the next save');
assert.match(composer, /Object\.defineProperty\(next, 'plaintextContent'[\s\S]*enumerable: false/, 'protected markdown commit plaintext baselines should stay non-enumerable in memory');
assert.match(composer, /async function openMarkdownPushOnGitHub[\s\S]*const plaintextContent = normalizeMarkdownContent[\s\S]*prepareMarkdownForProtectedStorage\(tab, plaintextContent[\s\S]*nsCopyToClipboard\(preparedContent\)[\s\S]*computeTextSignature\(preparedContent\)/, 'manual GitHub edit flow should copy encrypted markdown and watch the encrypted remote signature');
assert.match(composer, /configureMarkdownPasswordInput[\s\S]*data-1p-ignore[\s\S]*data-lpignore/, 'editor protection password fields should not opt into browser password-manager storage');
assert.match(themeLayout, /NATIVE_MODULE_CACHE_KEY = 'frontmatter-merge-20260512'/, 'theme layout should cache-bust native modules when shared i18n boundaries change');
assert.match(themeLayout, /from '\.\/theme\.js\?v=frontmatter-merge-20260512';/, 'theme layout should cache-bust theme helper imports');
assert.match(theme, /NATIVE_STYLE_CACHE_KEY = 'encrypted-demo-20260508'/, 'theme loader should cache-bust native stylesheet changes');
assert.match(themeLayout, /NATIVE_STYLE_CACHE_KEY = 'encrypted-demo-20260508'/, 'theme layout should cache-bust manifest-applied native stylesheet changes');
assert.match(read('assets/themes/native/theme.css'), /@import "\.\/base\.css\?v=encrypted-demo-20260508";/, 'native theme.css should cache-bust the imported base stylesheet');
assert.match(themeLayout, /const cacheKey = pack === DEFAULT_PACK \? NATIVE_MODULE_CACHE_KEY : getManifestCacheKey\(pack, manifest\);[\s\S]*appendImportCacheKey\(safeEntry, cacheKey\)/, 'theme layout should apply the native module cache key at import time');
assert.match(indexHtml, /src="assets\/main\.js\?v=frontmatter-merge-20260512"/, 'index should bump the main module URL when runtime imports change');
assert.match(composer, /src="assets\/main\.js\?v=frontmatter-merge-20260512"/, 'composer export template should use the same main module URL as index');
assert.match(themeBoot, /pack !== 'native'[\s\S]*return;/, 'theme boot should not eagerly apply unvalidated external theme CSS');
assert.doesNotMatch(themeLayout, /loadThemePack\(DEFAULT_PACK\)/, 'theme layout fallback should not persist Native over a failed external pack');
assert.match(themeLayout, /clearFailedThemeArtifacts\(pack\)/, 'theme layout fallback should clear partial external theme DOM and styles');
assert.match(indexHtml, /src="assets\/js\/theme-boot\.js\?v=theme-switch-fix-20260508"/, 'index should cache-bust theme boot after external fallback changes');
assert.doesNotMatch(indexEditorHtml, /src="assets\/js\/theme-boot\.js/, 'editor shell should not load the site theme boot script');
assert.doesNotMatch(indexEditorHtml, /<link rel="stylesheet" id="theme-pack"/, 'editor shell should not expose a top-level theme-pack stylesheet');
assert.match(indexEditorHtml, /href="assets\/themes\/native\/theme\.css\?v=encrypted-demo-20260508" data-editor-native-theme/, 'editor shell should use the fixed native theme stylesheet');
assert.match(indexEditorHtml, /src="assets\/js\/editor-main\.js\?v=frontmatter-merge-20260512"/, 'editor should cache-bust runtime changes for default blocks view behavior');
assert.match(indexEditorHtml, /id="preview-wrap" class="editor-preview-overlay" hidden[\s\S]*id="previewFrame"[\s\S]*src="index_editor_preview\.html"/, 'editor preview should render through a full-screen overlay iframe');
assert.match(indexEditorHtml, /\.editor-preview-overlay \{[\s\S]*opacity:0[\s\S]*transition:opacity \.22s ease, transform \.26s[\s\S]*\.editor-preview-overlay\.is-open[\s\S]*opacity:1[\s\S]*\.editor-preview-overlay\.is-closing[\s\S]*opacity:0[\s\S]*prefers-reduced-motion: reduce/, 'editor preview overlay should animate open and close while respecting reduced motion');
assert.match(indexEditorHtml, /id="previewThemeSelect"/, 'editor preview should expose a session-only preview theme selector');
assert.match(indexEditorHtml, /id="previewPathLabel"[\s\S]*id="btnClosePreview"[\s\S]*id="previewFrameSizer"[\s\S]*data-preview-resize="left"[\s\S]*data-preview-resize="right"/, 'editor preview overlay should expose path, close, and symmetric resize controls');
assert.match(indexEditorHtml, /\.editor-preview-frame-sizer \{[\s\S]*width:calc\(100% - 36px\)[\s\S]*\.editor-preview-resize-handle-left \{ left:-18px; \}[\s\S]*\.editor-preview-resize-handle-right \{ right:-18px; \}/, 'editor preview resize handles should sit outside the iframe edges');
assert.match(indexEditorHtml, /id="frontMatterExtraSection"[\s\S]*class="frontmatter-grid frontmatter-protection-grid"[\s\S]*class="frontmatter-field frontmatter-field-boolean frontmatter-protection-action"[\s\S]*class="frontmatter-field-title"[\s\S]*class="frontmatter-help-tooltip"[\s\S]*<label class="frontmatter-switch frontmatter-protection-switch"[\s\S]*<input type="checkbox" class="frontmatter-switch-input" id="btnProtectMarkdown" role="switch"[\s\S]*class="frontmatter-switch-track"[\s\S]*id="frontMatterExtraFields"/, 'editor protection action should use a native checkbox switch inside the advanced front matter section');
assert.match(indexEditorPreviewHtml, /<link rel="stylesheet" id="theme-pack">[\s\S]*editor-preview-runtime\.js\?v=frontmatter-merge-20260512/, 'editor preview iframe should own the theme-pack stylesheet and runtime');
assert.match(editorMain, /PREVIEW_RENDER_MESSAGE = 'press-editor-preview-render'[\s\S]*postMessage\(payload, window\.location\.origin\)/, 'editor preview should send render payloads to the iframe runtime');
assert.match(editorMain, /previewThemeOverride[\s\S]*sanitizePreviewThemePack\(previewThemeSelect\.value/, 'editor preview theme selector should use a session-only override');
assert.match(editorMain, /assets\/themes\/packs\.local\.json', true/, 'editor preview selector should allow ignored local theme-pack overlays for development');
assert.match(indexEditorHtml, /class="view-toggle"[^>]*data-view="blocks"[\s\S]*class="vt-btn active" data-view="blocks"[\s\S]*class="vt-btn" data-view="edit"/, 'editor view toggle should put Blocks first and make it the initial default');
assert.match(indexEditorHtml, /\.view-toggle\[data-view="edit"\] \.vt-slider/, 'editor view toggle slider should move right for source edit mode');
assert.match(editorMain, /LS_VIEW_KEY = 'press_editor_markdown_view_v2'[\s\S]*function normalizeMarkdownEditorView\(mode\) \{[\s\S]*if \(mode === 'edit'\) return 'edit';[\s\S]*return 'blocks';/, 'editor should default markdown view selection to blocks and ignore the old edit-first storage key');
assert.doesNotMatch(indexEditorHtml, /class="vt-btn" data-view="preview"/, 'editor preview should not be part of the persisted edit/blocks view toggle');
assert.match(indexEditorHtml, /id="btnOpenPreview"[\s\S]*data-i18n-aria-label="editor\.toolbar\.viewPreview"/, 'editor preview should be exposed as a standalone toolbar button');
assert.match(editorMain, /const previewOpenButton = document\.getElementById\('btnOpenPreview'\);[\s\S]*previewOpenButton\.addEventListener\('click'[\s\S]*openPreviewOverlay\(\);/, 'standalone editor preview button should open the temporary overlay');
assert.doesNotMatch(editorMain, /persistMarkdownEditorView\(.*preview/, 'editor preview overlay should not persist preview as the markdown editor view');
assert.match(editorMain, /const handleSpace = 36;[\s\S]*Math\.max\(0, \(shellRect\.width \|\| 0\) - handleSpace\)[\s\S]*startPreviewResize[\s\S]*delta \* direction \* 2/, 'editor preview overlay should reserve handle space and symmetrically resize the iframe viewport so handles track the pointer');
assert.match(editorMain, /PREVIEW_OVERLAY_CLOSE_MS = 260[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*previewWrap\.classList\.add\('is-open'\)[\s\S]*previewWrap\.classList\.add\('is-closing'\)[\s\S]*setTimeout\(\(\) => \{[\s\S]*previewWrap\.hidden = true;[\s\S]*resetPreviewViewportWidth\(\);[\s\S]*\}, PREVIEW_OVERLAY_CLOSE_MS\)/, 'preview overlay should add open and closing classes before hiding after the close animation');
assert.match(editorPreviewRuntime, /ensureThemeLayout\(\{ pack: requestedPack, persist: false, reset \}\)/, 'editor preview runtime should mount themes without persisting themePack');
assert.match(editorPreviewRuntime, /from '\.\/theme-layout\.js\?v=frontmatter-merge-20260512';/, 'editor preview runtime should cache-bust theme layout generation changes');
assert.match(themeLayout, /let layoutMountGeneration = 0[\s\S]*function isCurrentMountGeneration\(generation\)[\s\S]*if \(!isCurrentMountGeneration\(mountGeneration\)\) return null;[\s\S]*applyManifestStyles\(pack, manifest\)[\s\S]*if \(!isCurrentMountGeneration\(mountGeneration\)\) return null;[\s\S]*setThemeLayoutContext\(context\)/, 'theme layout reset mounts should ignore stale generations before writing DOM or context state');
assert.match(editorPreviewRuntime, /let latestRenderRequestId = 0[\s\S]*function beginPreviewRender\(payload\)[\s\S]*latestRenderRequestId = requestId[\s\S]*function isCurrentPreviewRender\(requestId\)/, 'editor preview runtime should track the latest render request id');
assert.match(editorPreviewRuntime, /const layout = await ensureThemeLayout[\s\S]*if \(!isCurrentPreviewRender\(requestId\)\) return;[\s\S]*await Promise\.resolve\(callThemeEffect\('renderPostView'[\s\S]*if \(!isCurrentPreviewRender\(requestId\)\) return;[\s\S]*setSafeHtml\(main[\s\S]*if \(!isCurrentPreviewRender\(requestId\)\) return;[\s\S]*postToParent\(\{ type: RENDERED_MESSAGE/, 'editor preview runtime should ignore stale async render completions before mutating or reporting rendered state');
assert.match(editorPreviewRuntime, /callThemeEffect\('renderPostView'[\s\S]*markdownHtml: output\.post/, 'editor preview runtime should use full theme post rendering');
assert.match(editorPreviewRuntime, /restorePreviewThemeStyles\(activePack, layout && layout\.manifest\)/, 'editor preview runtime should restore non-persistent theme styles after theme tools render');
assert.doesNotMatch(editorMain, /if \(nextView === 'blocks'\) renderPreview/, 'block mode should not trigger themed preview rendering');
assert.match(indexEditorHtml, /src="assets\/js\/editor-main\.js\?v=frontmatter-merge-20260512"/, 'editor should cache-bust editor-main after default blocks view changes');
assert.match(indexEditorHtml, /src="assets\/js\/composer\.js\?v=rich-index-helpers-20260512"/, 'editor should cache-bust composer after version compatibility changes');
assert.match(composer, /if \('checked' in btn\) btn\.checked = protectedState;[\s\S]*btn\.setAttribute\('aria-checked', protectedState \? 'true' : 'false'\);[\s\S]*switchEl\.dataset\.state = protectedState \? 'on' : 'off';/, 'markdown protection switch should synchronize native checked state and visual switch state');
assert.match(search, /addEventListener\('press:search'[\s\S]*navigateSearch/, 'search routing should listen for press:search');
assert.doesNotMatch(search, /input\.onkeydown\s*=/, 'search.js should not own the component input via onkeydown');
assert.match(read('assets/js/tags.js'), /press:tag-select/, 'tag sidebar should emit press:tag-select');

assert.match(theme, /mountThemeControls\(options = \{\}\)[\s\S]*document\.createElement\('press-theme-controls'\)/, 'core theme controls should mount press-theme-controls');
assert.match(theme, /component\.addEventListener\('press:theme-toggle'[\s\S]*component\.addEventListener\('press:language-reset'/, 'theme control side effects should be event-driven');
assert.doesNotMatch(theme, /import ['"]\.\/components\.js['"]/, 'theme helpers should not top-level import browser-only custom elements');
assert.match(theme, /function ensurePressComponents\(\)[\s\S]*typeof customElements === 'undefined'[\s\S]*import\('\.\/components\.js'\)/, 'theme controls should lazy-load custom elements only in browser environments');
assert.match(theme, /function refreshThemeControlsLanguages\(component\)[\s\S]*component\.setLanguages\(getLanguageOptions\(\), getCurrentLang\(\)\)/, 'theme controls should centralize language option refresh');
assert.match(theme, /ns:i18n-bundle-loaded[\s\S]*refreshThemeControlsLanguages\(component\)/, 'theme controls should refresh language options after async i18n bundle updates');

assert.match(nativeSearch, /createElement\('press-search'\)/, 'native search module should mount press-search');
assert.doesNotMatch(nativeSearch, /setAttribute\('icon'/, 'native search should not opt into a visible search icon');

assert.match(nativeToc, /createElement\('press-toc'\)/, 'native TOC module should mount press-toc');
assert.match(toc, /typeof tocRoot\.enhance === 'function'/, 'legacy setupTOC should delegate to press-toc when present');

assert.match(nativeInteractions, /renderPressPostCardHtml\(/, 'native cards should render through press-post-card');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/theme\.js\?v=frontmatter-merge-20260512'/, 'native interactions should cache-bust theme helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/tags\.js\?v=frontmatter-merge-20260512'/, 'native interactions should cache-bust tag helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/templates\.js\?v=frontmatter-merge-20260512'/, 'native interactions should cache-bust template helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/errors\.js\?v=frontmatter-merge-20260512'/, 'native interactions should cache-bust error helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/post-nav\.js\?v=frontmatter-merge-20260512'/, 'native interactions should cache-bust post navigation helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/link-cards\.js\?v=encrypted-demo-20260508'/, 'native interactions should cache-bust internal link-card hydration');
assert.match(nativeInteractions, /const refreshMasonry = \(el\) => \{[\s\S]*updateMasonryItem/, 'native cards should keep masonry refresh centralized');
assert.match(nativeInteractions, /if \(meta && meta\.protected\) \{[\s\S]*ui\.protectedExcerpt[\s\S]*refreshMasonry\(el\);[\s\S]*return;/, 'native cards should not fetch protected article bodies for previews and should refresh masonry spans');
assert.match(nativeInteractions, /const inlineMinutes = readMinutesFromMeta\(meta\);[\s\S]*const needsExcerpt = !!\(exEl && !inlineExcerpt\);[\s\S]*if \(inlineMinutes > 0\) \{[\s\S]*updateMetaLine\(el, meta, inlineMinutes, false\);[\s\S]*if \(!needsExcerpt\) return;[\s\S]*context\.getFile/, 'native cards should only skip Markdown fetches when index readTime metadata also has an excerpt');
assert.match(nativeInteractions, /const minutes = encrypted \? 0 : \(inlineMinutes > 0 \? inlineMinutes : context\.computeReadTime\(publicMarkdown, 200\)\);/, 'native cards should preserve index readTime when fetching Markdown only to fill a missing excerpt');
assert.match(linkCards, /if \(meta && meta\.protected\) return;/, 'internal link cards should not fetch protected article bodies when public metadata marks protection');
assert.match(linkCards, /stripEncryptedBodyForPublicUse\(rawMarkdown\)/, 'internal link cards should strip encrypted bodies before extracting public metadata');

assert.match(nativeCss, /press-search\.box,[\s\S]*press-theme-controls\.box,[\s\S]*press-toc\.box\s*\{\s*display: block;/, 'native component hosts should preserve block layout');
assert.match(nativeCss, /\.protected-post-excerpt[\s\S]*color: var\(--text\);/, 'native locked article panel should style the public excerpt separately from the generic unlock copy');

console.log('ok - ui component boundaries');
