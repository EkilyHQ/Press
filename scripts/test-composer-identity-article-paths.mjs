import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

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

const composerContentMutationsSource = readIdentitySource('../assets/js/composer-content-mutations.js');

const composerRuntimeStylesSource = readIdentitySource('../assets/js/composer-runtime-styles.js');

const composerUiMotionSource = readIdentitySource('../assets/js/composer-ui-motion.js');

const editorSource = readIdentitySource('../index_editor.html');

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

assert.match(
  composerContentMutationsSource,
  /async function promptArticleVersionValue\(key, lang, entry, anchor\) \{[\s\S]*showComposerAddEntryPrompt\(anchor, \{[\s\S]*editor\.composer\.versionPrompt\.placeholder[\s\S]*if \(!isComposerVersionTag\(value\)\)[\s\S]*normalizeComposerVersionTag\(value\)[\s\S]*editor\.composer\.versionPrompt\.errorDuplicate/,
  'adding an article version should prompt for a v-prefixed version string before creating the new path'
);

assert.match(
  composerPathToolsSource,
  /function normalizeComposerVersionPaths\(value\) \{[\s\S]*Array\.isArray\(value\)[\s\S]*getIndexVariantLocation\(item\)[\s\S]*const normalized = getIndexVariantLocation\(value\);[\s\S]*return normalized \? \[normalized\] : \[\];[\s\S]*function collectComposerArticleVersions\(paths\) \{[\s\S]*const arr = normalizeComposerVersionPaths\(paths\);/,
  'legacy scalar and rich article language paths should be normalized before version dedupe runs'
);

assert.match(
  composerContentMutationsSource,
  /async function promptArticleVersionValue\(key, lang, entry, anchor\) \{[\s\S]*const arr = normalizeComposerVersionPaths\(entry && entry\[lang\]\);[\s\S]*const existingVersions = collectComposerArticleVersions\(arr\);/,
  'article version prompt should use normalized version paths from the extracted path tools'
);

assert.match(
  composerPathToolsSource,
  /function findExplicitArticleVersionSegmentIndex\(segments\) \{[\s\S]*if \(parts\.length < 3\) return -1;[\s\S]*parts\[0\][\s\S]*!== 'post'[\s\S]*const candidateIndex = parts\.length - 1;[\s\S]*if \(!isComposerVersionSegment\(parts\[candidateIndex\]\)\) return -1;[\s\S]*return candidateIndex;[\s\S]*function buildDefaultLanguagePathFromEntry\(kind, key, lang, entry\) \{[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*segments\[versionIndex\] = 'v1\.0\.0'[\s\S]*else segments\.push\('v1\.0\.0'\);/,
  'adding a new article language should rewrite only an explicit post/<key>/<version>/<file> version folder'
);

assert.match(
  composerPathToolsSource,
  /function buildArticleVersionPath\(key, lang, version, entry\) \{[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*segments\[versionIndex\] = normalizedVersion[\s\S]*else segments\.push\(normalizedVersion\);/,
  'adding a version should replace only an explicit post/<key>/<version>/<file> version folder'
);

assert.match(
  composerPathToolsSource,
  /function extractVersionFromPath\(relPath\) \{[\s\S]*const segments = normalized\.split\('\/'\);[\s\S]*segments\.pop\(\);[\s\S]*const versionIndex = findExplicitArticleVersionSegmentIndex\(segments\);[\s\S]*return versionIndex >= 0 \? String\(segments\[versionIndex\] \|\| ''\) : '';/,
  'article version extraction should ignore legacy root-style keys that only look like versions'
);

assert.doesNotMatch(
  source,
  /<input class="ci-path" type="text" placeholder="\$\{escapeHtml\(pathPlaceholder\)\}" value="\$\{escapeHtml\(p \|\| ''\)\}" \/>/,
  'article version cards should not render an editable path input in the composer list'
);

assert.doesNotMatch(
  source,
  /const input = document\.createElement\('input'\);[\s\S]*input\.setAttribute\('aria-label', treeText\('location', 'Location'\)\);[\s\S]*main\.appendChild\(label\);[\s\S]*main\.appendChild\(input\);/,
  'article language structure panel should not render an editable location input for version rows'
);

assert.doesNotMatch(
  source,
  /function renderPageLanguageStructure\(key, lang, value\) \{[\s\S]*const titleInput = document\.createElement\('input'\);[\s\S]*const pathInput = document\.createElement\('input'\);[\s\S]*controls\.appendChild\(titleInput\);[\s\S]*controls\.appendChild\(pathInput\);/,
  'page structure rows should not render editable title or location inputs'
);

assert.doesNotMatch(
  editorSource,
  /#mode-composer > \.editor-main > \.toolbar|<section class="box editor-main" style="grid-column: 1 \/ -1;">|class="site-settings-title"/,
  'site settings modal should not render a redundant inner card toolbar'
);

assert.match(
  editorSource,
  /class="editor-modal-header-actions" id="editorModalComposerActions" hidden[\s\S]*id="btnRefresh"[\s\S]*id="btnDiscard"/,
  'site settings refresh and discard controls should live in the modal header action slot'
);

assert.match(
  editorSource,
  /class="editor-modal-header-actions" id="editorModalUpdateActions" hidden[\s\S]*id="btnSystemSelect"[\s\S]*id="systemUpdateFileInput"/,
  'system update archive picker should live in the modal header action slot'
);

assert.match(
  editorSource,
  /class="editor-modal-header-actions" id="editorModalThemeActions" hidden[\s\S]*id="btnThemeImport"[\s\S]*id="themeImportFileInput"/,
  'theme ZIP picker should live in the modal header action slot'
);

assert.doesNotMatch(
  editorSource,
  /<section class="box updates-main"|class="updates-title"/,
  'system updates modal should not render a redundant inner card or duplicate content title'
);

assert.match(
  editorSource,
  /<header class="editor-modal-header">\s*<button type="button" class="btn-secondary editor-modal-close" id="editorModalClose"[\s\S]*<h2 id="editorModalTitle"><\/h2>/,
  'modal close button should sit to the left of the title for macOS-style chrome'
);

assert.match(
  editorSource,
  /\.editor-modal-header-actions \.btn-secondary,\s*\.editor-modal-header-actions \.btn-primary \{\s*height:2rem;\s*padding:0 \.65rem;[\s\S]*\.editor-modal-close \{[\s\S]*height:2rem;/,
  'modal header action buttons should match the close button height'
);

assert.match(
  editorSource,
  /\.editor-modal-layer\[hidden\],[\s\S]*\.editor-overlay-panel\[hidden\] \{[\s\S]*display:none !important;[\s\S]*\.editor-modal-body \{[\s\S]*overflow:auto;/,
  'modal layer should hide by default and scroll its own body when content is tall'
);

assert.doesNotMatch(
  siteSettingsSource,
  /cs-multiline-preview|preview = document\.createElement\('button'\)/,
  'collapsed multiline fields should not swap in a preview button'
);

assert.match(
  siteSettingsSource,
  /input\.addEventListener\('pointerdown', expandMultiline\);[\s\S]*input\.addEventListener\('focus', expandMultiline\);[\s\S]*input\.addEventListener\('focusin', expandMultiline\);/,
  'the textarea itself should expand from direct pointer and focus interaction'
);

assert.match(
  siteSettingsSource,
  /list\.querySelectorAll\('\.cs-localized-row--multiline\.is-expanded'\)\.forEach/,
  'expanding a multiline localized row should collapse other expanded rows in the same field'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-localized-row--multiline textarea\.cs-localized-textarea\{box-sizing:border-box;display:block;height:var\(--cs-editor-control-height\);min-height:var\(--cs-editor-control-height\);max-height:var\(--cs-editor-control-height\);padding-block:0;line-height:calc\(var\(--cs-editor-control-height\) - 2px\);resize:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;transition:height \.18s ease/,
  'collapsed multiline textareas should keep the real control but use input-like vertical centering'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-localized-row--multiline\.is-expanded,.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\)\{align-items:start\}[\s\S]*\.cs-localized-row--multiline\.is-expanded \.cs-remove-lang,.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\) \.cs-remove-lang\{align-self:start\}[\s\S]*\.cs-localized-row--multiline\.is-expanded textarea\.cs-localized-textarea\{height:4\.6rem;min-height:4\.6rem;max-height:12rem;padding-block:\.3rem;line-height:1\.25;resize:vertical;overflow:auto;white-space:pre-wrap\}[\s\S]*\.cs-localized-row--multiline:has\(textarea\.cs-localized-textarea:focus\) textarea\.cs-localized-textarea\{height:4\.6rem;min-height:4\.6rem;max-height:12rem;padding-block:\.3rem;line-height:1\.25;resize:vertical;overflow:auto;white-space:pre-wrap/,
  'focused multiline textareas should animate open without replacing the control'
);

// composer-identity-body:end
