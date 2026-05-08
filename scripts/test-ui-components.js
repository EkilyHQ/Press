import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

const components = read('assets/js/components.js');
const main = read('assets/main.js');
const indexHtml = read('index.html');
const composer = read('assets/js/composer.js');
const search = read('assets/js/search.js');
const theme = read('assets/js/theme.js');
const toc = read('assets/js/toc.js');
const linkCards = read('assets/js/link-cards.js');
const nativeSearch = read('assets/themes/native/modules/search-box.js');
const nativeToc = read('assets/themes/native/modules/toc.js');
const nativeInteractions = read('assets/themes/native/modules/interactions.js');
const themeLayout = read('assets/js/theme-layout.js');
const postCardHtml = read('assets/js/post-card-html.js');
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
assert.match(main, /from '\.\/js\/markdown\.js\?v=markdown-safety-20260508';/, 'main should cache-bust markdown parser when sanitizer boundaries change');
assert.match(main, /from '\.\/js\/theme-layout\.js\?v=encrypted-demo-20260508';/, 'main should cache-bust theme layout when native module cache keys change');
assert.match(main, /from '\.\/js\/theme\.js\?v=encrypted-demo-20260508';/, 'main should cache-bust theme helpers when native stylesheet cache keys change');
assert.match(main, /from '\.\/js\/i18n\.js\?v=encrypted-demo-20260508';/, 'main should use the same versioned i18n module instance as shared UI modules');
assert.match(main, /from '\.\/js\/link-cards\.js\?v=encrypted-demo-20260508';/, 'main should cache-bust internal link cards when protected preview handling changes');
assert.match(main, /from '\.\/js\/seo\.js\?v=encrypted-demo-20260508';/, 'main should cache-bust SEO helpers after their i18n dependency changes');
assert.match(main, /from '\.\/js\/toc\.js\?v=encrypted-demo-20260508';/, 'main should cache-bust TOC helpers after their i18n dependency changes');
assert.match(main, /from '\.\/js\/tags\.js\?v=encrypted-demo-20260508';/, 'main should cache-bust tag helpers after their i18n dependency changes');
assert.match(composer, /from '\.\/i18n\.js\?v=encrypted-demo-20260508';/, 'composer should share the encrypted-articles i18n cache key');
assert.match(composer, /from '\.\/seo\.js\?v=encrypted-demo-20260508';/, 'composer should cache-bust SEO helpers after their i18n dependency changes');
assert.match(composer, /from '\.\/system-updates\.js\?v=encrypted-demo-20260508';/, 'composer should cache-bust system updates after their i18n dependency changes');
assert.match(composer, /from '\.\/theme-manager\.js\?v=encrypted-demo-20260508';/, 'composer should cache-bust theme manager after its i18n dependency changes');
assert.match(composer, /from '\.\/encrypted-content\.js\?v=encrypted-demo-20260508';/, 'composer should use the encrypted markdown envelope helpers for protected editor flows');
assert.match(themeLayout, /from '\.\/i18n\.js\?v=encrypted-demo-20260508';/, 'theme layout should share the encrypted-articles i18n cache key');
assert.match(languageManifest, /en\.js\?v=encrypted-demo-20260508/, 'language manifest should cache-bust bundles when protected article strings change');
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
assert.match(themeLayout, /NATIVE_MODULE_CACHE_KEY = 'encrypted-demo-20260508'/, 'theme layout should cache-bust native modules when protected article boundaries change');
assert.match(themeLayout, /from '\.\/theme\.js\?v=encrypted-demo-20260508';/, 'theme layout should cache-bust theme helper imports');
assert.match(theme, /NATIVE_STYLE_CACHE_KEY = 'encrypted-demo-20260508'/, 'theme loader should cache-bust native stylesheet changes');
assert.match(themeLayout, /NATIVE_STYLE_CACHE_KEY = 'encrypted-demo-20260508'/, 'theme layout should cache-bust manifest-applied native stylesheet changes');
assert.match(read('assets/themes/native/theme.css'), /@import "\.\/base\.css\?v=encrypted-demo-20260508";/, 'native theme.css should cache-bust the imported base stylesheet');
assert.match(themeLayout, /appendImportCacheKey\(safeEntry, NATIVE_MODULE_CACHE_KEY\)/, 'theme layout should apply the native module cache key at import time');
assert.match(indexHtml, /src="assets\/main\.js\?v=encrypted-demo-20260508"/, 'index should bump the main module URL when runtime imports change');
assert.match(composer, /src="assets\/main\.js\?v=encrypted-demo-20260508"/, 'composer export template should use the same main module URL as index');
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
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/theme\.js\?v=encrypted-demo-20260508'/, 'native interactions should cache-bust theme helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/tags\.js\?v=encrypted-demo-20260508'/, 'native interactions should cache-bust tag helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/templates\.js\?v=encrypted-demo-20260508'/, 'native interactions should cache-bust template helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/errors\.js\?v=encrypted-demo-20260508'/, 'native interactions should cache-bust error helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/post-nav\.js\?v=encrypted-demo-20260508'/, 'native interactions should cache-bust post navigation helper imports');
assert.match(nativeInteractions, /from '\.\.\/\.\.\/\.\.\/js\/link-cards\.js\?v=encrypted-demo-20260508'/, 'native interactions should cache-bust internal link-card hydration');
assert.match(nativeInteractions, /if \(meta && meta\.protected\) \{[\s\S]*ui\.protectedExcerpt[\s\S]*updateMasonryItem[\s\S]*return;/, 'native cards should not fetch protected article bodies for previews and should refresh masonry spans');
assert.match(linkCards, /if \(meta && meta\.protected\) return;/, 'internal link cards should not fetch protected article bodies when public metadata marks protection');
assert.match(linkCards, /stripEncryptedBodyForPublicUse\(rawMarkdown\)/, 'internal link cards should strip encrypted bodies before extracting public metadata');

assert.match(nativeCss, /press-search\.box,[\s\S]*press-theme-controls\.box,[\s\S]*press-toc\.box\s*\{\s*display: block;/, 'native component hosts should preserve block layout');
assert.match(nativeCss, /\.protected-post-excerpt[\s\S]*color: var\(--text\);/, 'native locked article panel should style the public excerpt separately from the generic unlock copy');

console.log('ok - ui component boundaries');
