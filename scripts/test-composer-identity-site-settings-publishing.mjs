import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerYamlSiteFeatureSource = readIdentitySource('../assets/js/composer-yaml-site-feature.js');

const composerSiteModelSource = readIdentitySource('../assets/js/composer-site-model.js');

const composerDiffUiSource = readIdentitySource('../assets/js/composer-diff-ui.js');

const composerSiteSettingsUiSource = readIdentitySource('../assets/js/composer-site-settings-ui.js');

const composerSiteSettingsConfigGridsSource = readIdentitySource('../assets/js/composer-site-settings-config-grids.js');

const composerSiteSettingsControlsSource = readIdentitySource('../assets/js/composer-site-settings-controls.js');

const composerSiteSettingsLanguageMenuSource = readIdentitySource(
  '../assets/js/composer-site-settings-language-menu.js'
);

const composerSiteSettingsLinkListSource = readIdentitySource('../assets/js/composer-site-settings-link-list.js');

const composerSiteSettingsLocalizedFieldsSource = readIdentitySource(
  '../assets/js/composer-site-settings-localized-fields.js'
);

const composerSiteSettingsRepoSectionSource = readIdentitySource('../assets/js/composer-site-settings-repo-section.js');

const composerSiteSettingsSchemaSource = readIdentitySource('../assets/js/composer-site-settings-schema.js');

const composerSiteSettingsSectionNavSource = readIdentitySource('../assets/js/composer-site-settings-section-nav.js');

const composerSiteSettingsSingleGridsSource = readIdentitySource('../assets/js/composer-site-settings-single-grids.js');

const composerPathToolsSource = readIdentitySource('../assets/js/composer-path-tools.js');

const composerRuntimeStylesSource = readIdentitySource('../assets/js/composer-runtime-styles.js');

const composerUiMotionSource = readIdentitySource('../assets/js/composer-ui-motion.js');

const publishSettingsSource = readIdentitySource('../assets/js/publish/settings-store.js');

const editorSource = readIdentitySource('../index_editor.html');

const nativeThemeSource = readIdentitySource('../assets/themes/native/theme.css');

const enI18nSource = readIdentitySource('../assets/i18n/en.js');

const chsI18nSource = readIdentitySource('../assets/i18n/chs.js');

const chtTwI18nSource = readIdentitySource('../assets/i18n/cht-tw.js');

const jaI18nSource = readIdentitySource('../assets/i18n/ja.js');

const composerSiteSettingsRuntimeSource = [
  composerSiteSettingsUiSource,
  composerSiteSettingsConfigGridsSource,
  composerSiteSettingsControlsSource,
  composerSiteSettingsLanguageMenuSource,
  composerSiteSettingsLinkListSource,
  composerSiteSettingsLocalizedFieldsSource,
  composerSiteSettingsRepoSectionSource,
  composerSiteSettingsSchemaSource,
  composerSiteSettingsSectionNavSource,
  composerSiteSettingsSingleGridsSource
].join('\n');

const siteSettingsSource = [
  source,
  composerSiteSettingsRuntimeSource,
  composerRuntimeStylesSource,
  composerUiMotionSource
].join('\n');

// composer-identity-body:start

[
  ['English', enI18nSource],
  ['Simplified Chinese', chsI18nSource],
  ['Traditional Chinese', chtTwI18nSource],
  ['Japanese', jaI18nSource]
].forEach(([label, localeSource]) => {
  assert.match(
    localeSource,
    /connectFallbackHint:/,
    `${label} translations should explain when to use the PAT fallback after Connect failures`
  );
});

assert.match(
  publishSettingsSource,
  /const PUBLISH_TRANSPORT_MODE_STORAGE_KEY = 'press_publish_transport_mode';[\s\S]*const CONNECT_PUBLISH_PRESETS = \[[\s\S]*https:\/\/connect-8mr\.pages\.dev[\s\S]*http:\/\/127\.0\.0\.1:8788/,
  'Connect publish settings should keep the current transport key and Connect presets explicit'
);

assert.match(
  publishSettingsSource,
  /CONNECT_PUBLISH_ENABLED_STORAGE_KEY = 'press_connect_publish_enabled'[\s\S]*enabledRaw[\s\S]*migratedLegacyMode[\s\S]*storage\.setItem\(scopedKey\(PUBLISH_TRANSPORT_MODE_STORAGE_KEY\), settings\.mode\)[\s\S]*storage\.removeItem\(scopedKey\(CONNECT_PUBLISH_ENABLED_STORAGE_KEY\)\)/,
  'Recovery should migrate the legacy Connect preference with write-before-delete semantics'
);

assert.match(
  `${composerYamlSiteFeatureSource}\n${siteSettingsSource}`,
  /const ANNOTATE_DISCUSSION_CATEGORY_PRESETS = \[[\s\S]*value: 'General'[\s\S]*renderAnnotateGrid[\s\S]*type: 'url'[\s\S]*listId: 'siteAnnotateConnectBaseUrlPresets'[\s\S]*options: connectPublishPresets[\s\S]*listId: 'siteAnnotateDiscussionCategoryPresets'[\s\S]*options: annotateDiscussionCategoryPresets/,
  'Annotate settings should expose editable datalist inputs for Connect URL and Discussion category'
);

assert.match(
  publishSettingsSource,
  /function normalizeConnectPublishBaseUrl\(value\) \{[\s\S]*const url = new URL\(rawBaseUrl\);[\s\S]*url\.protocol !== 'https:' && !\(url\.protocol === 'http:' && isLocalhostHost\(url\.hostname\)\)[\s\S]*return url\.origin;/,
  'Connect publish URL normalization should require absolute HTTPS or localhost HTTP URLs'
);

assert.match(
  publishSettingsSource,
  /mode: 'connect'[\s\S]*const modeRaw = storage\.getItem\(scopedKey\(PUBLISH_TRANSPORT_MODE_STORAGE_KEY\)\)[\s\S]*modeRaw === 'connect' \|\| modeRaw === 'pat'[\s\S]*function resolvePublishTransport/,
  'Publish transport should default to Connect and prefer the current transport mode key'
);

assert.doesNotMatch(
  [source, composerSiteModelSource].join('\n'),
  /function connectForOutput|snapshot\.connect|diff\.fields\.connect|getUseFineGrainedTokenFallback|CONNECT_PUBLISH_FALLBACK_STORAGE_KEY/,
  'site.yaml connect output, diffing, and PAT fallback storage should be removed'
);

assert.match(
  composerDiffUiSource,
  /function applySiteDiffMarkers\(diff\) \{[\s\S]*const lang = el\.getAttribute\('data-lang'\);[\s\S]*const subfield = el\.getAttribute\('data-subfield'\);[\s\S]*const hasChangedDescendant = \(el\) =>[\s\S]*if \(hasChangedDescendant\(el\)\) \{/,
  'Site editor diff markers should support control-level language and subfield matching'
);

assert.match(
  composerDiffUiSource,
  /if \(info\.type === 'object' && info\.fields\) \{\s*return subfield \? !!info\.fields\[subfield\] : false;\s*\}/,
  'Object field diffs should only match controls that declare a changed subfield'
);

assert.match(
  composerDiffUiSource,
  /if \(info\.type === 'list' && info\.entries\) \{\s*if \(index != null && subfield\) return !!\(info\.entries\[index\] && info\.entries\[index\]\[subfield\]\);\s*return true;\s*\}/,
  'List field diffs should preserve field-level markers when removed rows have no remaining controls'
);

assert.match(
  siteSettingsSource,
  /input\.dataset\.field = key;[\s\S]*input\.dataset\.lang = lang;/,
  'Localized site inputs should carry field and language diff metadata'
);

assert.match(
  siteSettingsSource,
  /input\.dataset\.field = key;[\s\S]*input\.dataset\.lang = lang;[\s\S]*input\.dataset\.subfield = key;/,
  'Identity grid inputs should carry field, language, and subfield diff metadata'
);

assert.match(
  siteSettingsSource,
  /ownerWrap\.dataset\.field = 'repo';[\s\S]*ownerWrap\.dataset\.subfield = 'owner';[\s\S]*repoWrap\.dataset\.field = 'repo';[\s\S]*repoWrap\.dataset\.subfield = 'name';[\s\S]*branchWrap\.dataset\.field = 'repo';[\s\S]*branchWrap\.dataset\.subfield = 'branch';/,
  'Repository diff metadata should target the specific owner, repo name, or branch pill'
);

assert.match(
  siteSettingsSource,
  /labelInput\.dataset\.field = key;[\s\S]*labelInput\.dataset\.index = String\(index\);[\s\S]*labelInput\.dataset\.subfield = 'label';[\s\S]*hrefInput\.dataset\.field = key;[\s\S]*hrefInput\.dataset\.index = String\(index\);[\s\S]*hrefInput\.dataset\.subfield = 'href';/,
  'Profile link diff metadata should target the specific label or URL input'
);

assert.doesNotMatch(
  composerRuntimeStylesSource,
  /\.cs-field\[data-diff="changed"\],\.cs-repo-grid\[data-diff="changed"\],\.cs-extra-list\[data-diff="changed"\],\.cs-single-grid-row\[data-diff="changed"\]\{background:/,
  'Site editor changed-state highlights should not tint whole field containers'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-field\[data-diff="changed"\] \.cs-input,\.cs-field\[data-diff="changed"\] \.cs-select,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-input,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-select[\s\S]*\{background:color-mix\(in srgb,#f59e0b 10%, transparent\);border-color:color-mix\(in srgb,#f59e0b 45%, var\(--border\)\)\}/,
  'Site editor changed-state highlights should tint changed text and select controls'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-field\[data-diff="changed"\] \.cs-empty\{background:color-mix\(in srgb,#f59e0b 10%, var\(--card\)\);border-color:color-mix\(in srgb,#f59e0b 45%, var\(--border\)\)/,
  'Site editor changed-state highlights should tint empty placeholders for changed list fields'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-repo-grid\[data-diff="changed"\] \.cs-repo-field,[\s\S]*\.cs-extra-list\[data-diff="changed"\] li[\s\S]*background:color-mix\(in srgb,#f59e0b 10%, transparent\)/,
  'Site editor changed-state highlights should tint changed repository fields and read-only key rows'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-field\[data-diff="changed"\] \.cs-switch-track,[\s\S]*\.cs-single-grid-row\[data-diff="changed"\] \.cs-switch-track[\s\S]*background:color-mix\(in srgb,#f59e0b 18%, var\(--card\)\)/,
  'Site editor changed-state highlights should tint changed switch tracks'
);

assert.doesNotMatch(
  composerRuntimeStylesSource,
  /\[data-diff="changed"\][^{]*\{[^}]*box-shadow:inset[^}]*\}/,
  'Site editor changed-state highlights should not add inset bars'
);

assert.doesNotMatch(
  source,
  /\[data-diff="changed"\][^{]*\{[^}]*padding-left:[^}]*\}/,
  'Site editor changed-state highlights should not add left padding that shifts fields'
);

assert.match(
  siteSettingsSource,
  /const siteConfigSection = createSection\([\s\S]*renderBehaviorGrid\(behaviorSubsection\);[\s\S]*renderThemeGrid\(themeSubsection\);[\s\S]*renderAssetWarningsGrid\(assetsSubsection\);[\s\S]*const extrasSection = createSection\(/,
  'Site editor should combine Behavior, Theme, and Asset warnings before Other keys'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createField\(extrasSection,\s*\{[\s\S]*dataKey: '__extras'[\s\S]*fields\.extras[\s\S]*fields\.extrasHelp/,
  'Other keys should not render a duplicate Preserved keys field heading'
);

assert.match(
  siteSettingsSource,
  /list\.className = 'cs-extra-list';[\s\S]*list\.dataset\.field = '__extras';[\s\S]*extrasSection\.appendChild\(list\);/,
  'Other keys list should remain diff-addressable while rendering directly in the card'
);

assert.doesNotMatch(
  siteSettingsSource,
  /const behaviorSection = createSection\([\s\S]*const themeSection = createSection\([\s\S]*const assetsSection = createSection\(/,
  'Behavior, Theme, and Asset warnings should not render as separate top-level cards'
);

assert.match(
  siteSettingsSource,
  /field\.className = 'cs-field cs-single-grid-fieldset';/,
  'avatar and content root should share one compact fieldset instead of separate tall fields'
);

assert.match(
  siteSettingsSource,
  /row\.dataset\.field = item\.dataKey;/,
  'each compact identity path row should keep its own data-field for diff and reveal handling'
);

assert.doesNotMatch(
  siteSettingsSource,
  /input\.dataset\.autofocus = '';/,
  'compact identity path inputs should not steal section navigation focus and scroll gestures'
);

assert.match(
  siteSettingsSource,
  /tooltip\.className = 'cs-help-tooltip';[\s\S]*tooltipBubble\.setAttribute\('role', 'tooltip'\);/,
  'compact identity path labels should expose their help text through an accessible tooltip'
);

assert.match(
  siteSettingsSource,
  /label\.className = 'cs-single-grid-title';[\s\S]*labelCell\.appendChild\(label\);[\s\S]*labelCell\.appendChild\(tooltipWrap\);/,
  'compact single-grid rows should place help tooltip buttons between the label text and the control'
);

assert.match(
  siteSettingsSource,
  /\.cs-single-grid-label\{display:inline-flex;align-items:center;justify-content:flex-end;gap:\.35rem;/,
  'compact single-grid label cells should right-align the label and trailing help icon'
);

assert.match(
  siteSettingsSource,
  /\.cs-single-grid\{display:grid;grid-template-columns:var\(--cs-editor-single-label-width,88px\) minmax\(0,var\(--cs-editor-single-control-width\)\);column-gap:var\(--cs-editor-row-column-gap\);row-gap:var\(--cs-editor-row-gap\);align-items:center;justify-content:start\}[\s\S]*\.cs-single-grid-row\{display:grid;grid-template-columns:subgrid;grid-column:1\/-1;align-items:center;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0/,
  'compact identity path rows should use one measured label column and a fixed-width control column'
);

assert.match(
  siteSettingsSource,
  /\.cs-link-list\{display:flex;flex-direction:column;gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-link-row\{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0\}[\s\S]*\.cs-link-row \+ \.cs-link-row\{margin-top:0\}/,
  'profile link rows should use the same vertical row rhythm as localized grid rows'
);

assert.match(
  siteSettingsSource,
  /\.cs-link-row\{display:flex;flex-wrap:wrap;align-items:flex-start;gap:var\(--cs-editor-row-column-gap\);min-height:var\(--cs-editor-control-height\);padding:0\}[\s\S]*\.cs-link-field--label\{flex:1 1 0\}[\s\S]*\.cs-link-field--href\{flex:3 1 0\}/,
  'profile link label and URL fields should keep a 1:3 width ratio with the same horizontal gap as identity grid columns'
);

assert.match(
  siteSettingsSource,
  /\.cs-config-subsection \+ \.cs-config-subsection\{border-top:1px solid color-mix\(in srgb,var\(--border\) 82%, transparent\);margin-top:\.35rem;padding-top:\.95rem\}/,
  'combined Site Configuration subsections should be separated by the same divider rhythm as large cards'
);

assert.match(
  siteSettingsSource,
  /\.cs-config-subsection-title\{margin:0;font-size:\.84rem;font-weight:600;color:color-mix\(in srgb,var\(--text\) 76%, transparent\)\}[\s\S]*\.cs-config-subsection-description\{margin:0;font-size:\.8rem;color:color-mix\(in srgb,var\(--muted\) 88%, transparent\);flex:1 1 auto;text-align:left\}/,
  'combined Site Configuration subsection headings should use the smaller field-heading rhythm instead of top-level section titles'
);

assert.match(
  siteSettingsSource,
  /\.cs-config-subsection\{display:flex;flex-direction:column;gap:\.4rem\}[\s\S]*\.cs-config-subsection > \.cs-config-subsection-head \+ \.cs-field\{padding-top:0\}/,
  'combined Site Configuration subsection content should sit as close to its heading as SEO subheading content'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createConfigSubsection[\s\S]*document\.createElement\('h4'\)/,
  'combined Site Configuration subsection labels should not render as document headings'
);

assert.match(
  siteSettingsSource,
  /\.cs-single-grid-control \.cs-input,.cs-single-grid-control \.cs-select\{width:100%;min-width:0\}/,
  'compact grid controls should fill the shared control column'
);

assert.match(
  siteSettingsSource,
  /\.cs-layout\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:1rem;align-items:start\}/,
  'site settings should use a single-column layout without the old section navigation rail'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.cs-nav|\.cs-mobile-section|cs-nav-button|cs-mobile-section-menu-item/,
  'site settings CSS should not keep removed section navigation selectors'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.editor-modal-body\.is-composer-overlay\{overflow:hidden\}/,
  'site settings overlay should keep the modal body scrollable so the section navigation remains visible'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.editor-modal-body\.is-composer-overlay[\s\S]*\.cs-layout\{height:100%;min-height:0\}/,
  'site settings overlay should not force a full-height composer layout that can collapse the left navigation'
);

assert.doesNotMatch(
  nativeThemeSource,
  /cs-nav-button|cs-mobile-section-nav-toggle|cs-mobile-section-menu-item/,
  'native theme button reset should not carry exceptions for removed site section navigation buttons'
);

assert.match(
  siteSettingsSource,
  /\.cs-help-tooltip-wrap:hover \.cs-help-tooltip-bubble,.cs-help-tooltip:focus-visible \+ \.cs-help-tooltip-bubble\{opacity:1;transform:translateY\(0\);pointer-events:auto\}/,
  'compact identity path help should appear as a hover/focus tooltip'
);

assert.match(
  editorSource,
  /\.editor-mobile-rail-toggle \{[\s\S]*display:none;[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-mobile-rail-toggle \{\s*display:inline-flex;/,
  'mobile layout should expose a file tree drawer toggle only on small screens'
);

assert.match(
  editorSource,
  /@media \(max-width: 640px\) \{[\s\S]*\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:0px;[\s\S]*\.editor-markdown-panel > \.toolbar \{[\s\S]*display:grid;[\s\S]*grid-template-columns:auto minmax\(0, 1fr\);[\s\S]*column-gap:\.5rem;[\s\S]*\.editor-markdown-panel > \.toolbar \.left-actions \{[\s\S]*grid-column:1;[\s\S]*flex:0 0 auto;[\s\S]*flex-wrap:nowrap;[\s\S]*\.editor-markdown-panel > \.toolbar \.right-actions \{[\s\S]*grid-column:2;[\s\S]*flex-wrap:wrap;[\s\S]*justify-content:flex-end;[\s\S]*justify-self:end;[\s\S]*max-width:100%;[\s\S]*\.editor-markdown-panel > \.toolbar \.editor-mobile-rail-toggle \{[\s\S]*flex:0 0 auto;[\s\S]*\.editor-markdown-panel > \.toolbar \.current-file \{[\s\S]*display:none;/,
  'extra narrow markdown toolbar should hide the breadcrumb and right-align editor controls beside the drawer toggle'
);

assert.match(
  editorSource,
  /--editor-article-main-width: 45rem;[\s\S]*--editor-properties-width: 20rem;[\s\S]*--editor-article-gap: 1\.5rem;[\s\S]*--editor-content-frame-max-width: calc\(var\(--editor-article-main-width\) \+ var\(--editor-article-gap\) \+ var\(--editor-properties-width\)\);[\s\S]*--editor-page-max-width: calc\(var\(--editor-rail-width, 340px\) \+ 6px \+ var\(--editor-content-frame-max-width\)\);/,
  'editor page width should be derived from the rail width plus the shared content frame width'
);

assert.match(
  editorSource,
  /\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:1rem;[\s\S]*padding:var\(--editor-content-pane-padding\);[\s\S]*\.toolbar \{[\s\S]*top:calc\(var\(--editor-content-pane-padding, 0px\) \* -1\);[\s\S]*background:color-mix\(in srgb, var\(--bg\) 96%, var\(--card\) 4%\);[\s\S]*\.editor-markdown-panel > \.toolbar \{[\s\S]*margin-top:calc\(var\(--editor-content-pane-padding, 1rem\) \* -1\);[\s\S]*\.editor-tools \{[\s\S]*top:calc\(var\(--editor-toolbar-offset, 0px\) - var\(--editor-content-pane-padding, 0px\)\);[\s\S]*background:color-mix\(in srgb, var\(--card\) 96%, var\(--text\) 4%\);[\s\S]*@media \(max-width: 820px\) \{[\s\S]*\.editor-content-pane \{[\s\S]*--editor-content-pane-padding:\.75rem;/,
  'markdown file toolbar should stick flush to the editor content pane top while preserving pane padding'
);

assert.match(
  composerPathToolsSource,
  /function buildDefaultEntryPath\(kind, key, lang\) \{[\s\S]*const baseFolder = normalizedKind === 'tabs' \? 'tab' : 'post';[\s\S]*normalizedKind === 'tabs'[\s\S]*`\$\{baseFolder\}\/\$\{safeKey\}\/v1\.0\.0`[\s\S]*`\$\{baseFolder\}\/v1\.0\.0`[\s\S]*return `\$\{folder\}\/\$\{filename\}`;/,
  'new article defaults should place the first markdown file inside a v1.0.0 directory'
);

// composer-identity-body:end
