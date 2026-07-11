import assert from 'node:assert/strict';

import { readIdentitySource } from './composer-identity-test-support.mjs';

const source = readIdentitySource('../assets/js/composer.js');

const composerSyncPanelSource = readIdentitySource('../assets/js/composer-sync-panel.js');

const composerPublishSettingsUiSource = readIdentitySource('../assets/js/composer-publish-settings-ui.js');

const composerPublishFlowSource = readIdentitySource('../assets/js/composer-publish-flow.js');

const composerNotificationsSource = readIdentitySource('../assets/js/composer-notifications.js');

const composerYamlSiteFeatureSource = readIdentitySource('../assets/js/composer-yaml-site-feature.js');

const composerDragListSource = readIdentitySource('../assets/js/composer-drag-list.js');

const composerIndexTabsUiSource = readIdentitySource('../assets/js/composer-index-tabs-ui.js');

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

const composerEditorShellSource = readIdentitySource('../assets/js/composer-editor-shell.js');

const composerRuntimeStylesSource = readIdentitySource('../assets/js/composer-runtime-styles.js');

const composerUiMotionSource = readIdentitySource('../assets/js/composer-ui-motion.js');

const editorStructurePanelUiSource = readIdentitySource('../assets/js/editor-structure-panel-ui.js');

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
  `${composerYamlSiteFeatureSource}\n${siteSettingsSource}`,
  /const renderIdentityLocalizedGrid = \(section\) => \{/,
  'composer site editor should define a merged identity localized grid renderer'
);

assert.match(
  `${siteSettingsSource}\n${composerYamlSiteFeatureSource}`,
  /renderIdentityLocalizedGrid\(identitySection\);/,
  'Identity section should render title and subtitle through the merged grid'
);

assert.match(
  siteSettingsSource,
  /renderIdentityPathGrid\(identitySection\);/,
  'Identity section should render avatar and content root through a compact path grid'
);

assert.match(
  siteSettingsSource,
  /const siteConfigSection = createSection\([\s\S]*sections\.configuration\.title[\s\S]*sections\.configuration\.description[\s\S]*createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.behavior\.title[\s\S]*renderBehaviorGrid\(behaviorSubsection\);/,
  'Behavior settings should render inside the combined Site Configuration section'
);

assert.match(
  siteSettingsSource,
  /createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.theme\.title[\s\S]*renderThemeGrid\(themeSubsection\);/,
  'Theme settings should render inside the combined Site Configuration section'
);

assert.match(
  siteSettingsSource,
  /createConfigSubsection\(\s*siteConfigSection,[\s\S]*sections\.assets\.title[\s\S]*renderAssetWarningsGrid\(assetsSubsection\);/,
  'Asset warnings should render inside the combined Site Configuration section'
);

assert.match(
  siteSettingsSource,
  /renderSeoResourceGrid\(seoSection\);/,
  'SEO Resource URL should render through the compact grid'
);

assert.match(
  siteSettingsSource,
  /renderLocalizedField\(seoSection, 'siteKeywords'[\s\S]*createLinkListField\(seoSection, 'profileLinks'[\s\S]*renderSeoResourceGrid\(seoSection\);/,
  'SEO section should render Profile links before Resource URL'
);

assert.match(
  siteSettingsSource,
  /createLinkListField\(seoSection, 'profileLinks', \{[\s\S]*subheading: true[\s\S]*\}\);/,
  'SEO Profile links should opt into the shared subsection heading style'
);

assert.match(
  siteSettingsSource,
  /const appendLinkHeader = \(\) => \{[\s\S]*head\.className = 'cs-link-head';[\s\S]*labelTitle\.id = labelTitleId;[\s\S]*hrefTitle\.id = hrefTitleId;[\s\S]*listWrap\.appendChild\(head\);[\s\S]*appendLinkHeader\(\);[\s\S]*list\.forEach/,
  'profile link Name and URL labels should render in a static header outside draggable rows'
);

assert.match(
  siteSettingsSource,
  /const renderRowsAndRefreshDiff = \(\) => \{[\s\S]*renderRows\(\);[\s\S]*notifyComposerChange\('site', \{ skipAutoSave: true \}\);[\s\S]*\};[\s\S]*moveEntry\(index, event\.key === 'ArrowUp' \? index - 1 : index \+ 1, \{ refreshDiff: true \}\);[\s\S]*renderRowsAndRefreshDiff\(\);/,
  'profile link reorders should refresh site diff markers after replacing row DOM'
);

assert.doesNotMatch(
  siteSettingsSource,
  /row\.classList\.add\('cs-link-row--with-title'\)|labelField\.append\(labelTitle, labelInput\)|hrefField\.append\(hrefTitle, hrefInput\)/,
  'profile link draggable rows should not own the static Name and URL labels'
);

assert.match(
  siteSettingsSource,
  /const moveEntry = \(from, to, options = \{\}\) => \{[\s\S]*list\.splice\(to, 0, item\);[\s\S]*markDirty\(\);[\s\S]*if \(options\.refreshDiff\) renderRowsAndRefreshDiff\(\);[\s\S]*else renderRows\(\);[\s\S]*const createDragHandle = \(index\) => \{/,
  'profile links should share one reorder path between drag handles and keyboard movement'
);

assert.match(
  siteSettingsSource,
  /const handle = documentRef\.createElement\('span'\);[\s\S]*handle\.setAttribute\('role', 'button'\);[\s\S]*handle\.className = 'cs-link-drag-handle';[\s\S]*handle\.setAttribute\('aria-label', t\('editor\.composer\.site\.reorderLink'\)\);[\s\S]*handle\.addEventListener\('pointerdown',/,
  'profile links should render a standalone pointer drag handle for reordering'
);

assert.match(
  siteSettingsSource,
  /const createDragPlaceholder = \(row\) => \{[\s\S]*placeholder\.className = 'cs-link-drop-placeholder';[\s\S]*placeholder\.style\.height = `\$\{rowRect\.height\}px`;/,
  'profile link drag should create an in-list placeholder matching the dragged row height'
);

assert.match(
  siteSettingsSource,
  /const animateLinkRows = \(callback\) => \{[\s\S]*getBoundingClientRect\(\)[\s\S]*row\.style\.transform = `translate3d\(0, \$\{previous\.top - next\.top\}px, 0\)`[\s\S]*requestFrame/,
  'profile link drag should animate non-dragged rows into their preview positions'
);

assert.match(
  siteSettingsSource,
  /const applyDragPreview = \(clientY\) => \{[\s\S]*linkDragState\.dragRow\.style\.transform = `translate3d\(0, \$\{clientY - linkDragState\.startY\}px, 0\)`[\s\S]*animateLinkRows\(\(\) => \{/,
  'profile link drag should move the dragged row with the pointer while previewing the drop position'
);

assert.doesNotMatch(
  siteSettingsSource,
  /className = 'btn-tertiary cs-move'|addEventListener\('click', \(\) => moveEntry\(index, index [-+] 1\)\)/,
  'profile links should not render old up/down reorder buttons'
);

assert.match(
  editorStructurePanelUiSource,
  /function moveStructureRootEntry\(source, from, to\) \{[\s\S]*const order = Array\.isArray\(state\.__order\) \? state\.__order : \[\];[\s\S]*const \[key\] = order\.splice\(from, 1\);[\s\S]*order\.splice\(to, 0, key\);[\s\S]*notifyComposerChange\(source\);[\s\S]*refreshEditorContentTree\(\);/,
  'structure panels should reorder the backing root order and refresh the content tree'
);

assert.match(
  editorStructurePanelUiSource,
  /const dragController = createEditorStructureDragController\(list,[\s\S]*const createStructureDragHandle = \(index, source\) => \{[\s\S]*const labelKey = source === 'tabs' \? 'reorderPage' : 'reorderArticle';[\s\S]*return dragController\.createHandle\(index, treeText\(labelKey, source === 'tabs' \? 'Reorder page' : 'Reorder article'\)\);/,
  'article and page structure rows should render a standalone drag handle with pointer and keyboard reorder hooks'
);

assert.match(
  editorStructurePanelUiSource,
  /const renderStructureDraggableItem = \(child, detail, index, source\) => \{[\s\S]*item\.className = 'editor-structure-item editor-structure-item--draggable';[\s\S]*const handle = createStructureDragHandle\(index, source\);[\s\S]*item\.append\(handle, main, controls\);/,
  'article and page structure rows should compose handle, content, and actions as separate elements'
);

assert.match(
  editorStructurePanelUiSource,
  /const createPlaceholder = \(item\) => \{[\s\S]*placeholder\.className = 'editor-structure-drop-placeholder';[\s\S]*placeholder\.style\.height = `\$\{itemRect\.height\}px`;/,
  'article structure drag should create an in-list placeholder matching the dragged row height'
);

assert.match(
  editorStructurePanelUiSource,
  /const applyDragPreview = \(clientY\) => \{[\s\S]*dragState\.dragItem\.style\.transform = `translate3d\(0, \$\{clientY - dragState\.startY\}px, 0\)`[\s\S]*animateRows\(\(\) => \{/,
  'structure drag should move the dragged row with the pointer while previewing the drop position'
);

assert.match(
  editorStructurePanelUiSource,
  /if \(node\.source === 'index' \|\| node\.source === 'tabs'\) \{[\s\S]*visibleChildren\.forEach\(\(child, index\) => \{[\s\S]*renderStructureDraggableItem\(child, `\$\{child\.children\.length\} \$\{treeText\('languages', 'languages'\)\}`, index, node\.source\)/,
  'articles and pages root panels should both use draggable structure rows for non-deleted current entries'
);

assert.doesNotMatch(
  siteSettingsSource,
  /class="ct-field ct-field-title"|const titleLabel = tComposerLang\('fields\.title'\)|const titleInput = \$\('\.ct-title', block\)|entry\[lang\]\.title = e\.target\.value/,
  'page entry structure rows should no longer render editable title inputs once title moves into the markdown editor metadata panel'
);

assert.doesNotMatch(
  siteSettingsSource,
  /<input class="ct-loc"|const pathPlaceholder = tComposerLang\('placeholders\.tabPath'\)|const locInput = \$\('\.ct-loc', block\)|entry\[lang\]\.location = e\.target\.value/,
  'page entry lists should no longer render editable location inputs for tabs languages'
);

assert.doesNotMatch(
  siteSettingsSource,
  /editor-structure-item[^\\n]*addEventListener\('pointerdown'|item\.setAttribute\('draggable', 'true'\)|className = 'btn-secondary editor-structure-move'/,
  'structure reordering should not start from the whole row or restore legacy move buttons'
);

assert.match(
  siteSettingsSource,
  /renderLocalizedField\(seoSection, 'siteDescription', \{[\s\S]*subheading: true[\s\S]*\}\);[\s\S]*renderLocalizedField\(seoSection, 'siteKeywords', \{[\s\S]*subheading: true[\s\S]*\}\);/,
  'SEO localized fields should opt into the shared subsection heading style'
);

assert.match(
  siteSettingsSource,
  /const field = fieldOptions\.subheading[\s\S]*createSubheadingField\(section, \{[\s\S]*dataKey: key,[\s\S]*label: fieldOptions\.label,[\s\S]*description: fieldOptions\.description[\s\S]*createField\(section, \{/,
  'localized fields should be able to reuse the shared subsection heading renderer'
);

assert.match(
  composerSiteSettingsControlsSource,
  /const createSubheadingField = \(section, config = \{\}\) => \{[\s\S]*head\.className = 'cs-config-subsection-head'[\s\S]*title\.className = 'cs-config-subsection-title'[\s\S]*description\.className = 'cs-config-subsection-description'/,
  'subheading fields should reuse the same title and description classes as combined configuration subsections'
);

assert.doesNotMatch(
  siteSettingsSource,
  /renderLocalizedField\(identitySection,\s*'siteTitle'/,
  'Identity section should not render siteTitle as a standalone localized field'
);

assert.doesNotMatch(
  siteSettingsSource,
  /renderLocalizedField\(identitySection,\s*'siteSubtitle'/,
  'Identity section should not render siteSubtitle as a standalone localized field'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createTextField\(identitySection,\s*\{\s*dataKey: 'avatar'/,
  'Avatar should not use the tall standalone text field layout'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createTextField\(identitySection,\s*\{\s*dataKey: 'contentRoot'/,
  'Content root should not use the tall standalone text field layout'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createTextField\(seoSection,\s*\{\s*dataKey: 'resourceURL'/,
  'Resource URL should not use the tall standalone text field layout'
);

assert.match(
  composerRuntimeStylesSource,
  /\.cs-identity-grid/,
  'runtime stylesheet should include identity grid layout rules'
);

assert.match(
  composerRuntimeStylesSource,
  /grid-template-columns:minmax\(88px,max-content\) minmax\(0,1fr\) minmax\(0,3fr\) minmax\(72px,max-content\)/,
  'desktop identity grid should make the title column one quarter of the title/subtitle input area'
);

assert.match(
  siteSettingsSource,
  /siteTitle\|siteSubtitle/,
  'diff and reveal handling should recognize the combined identity field'
);

assert.match(
  siteSettingsSource,
  /const useLocalizedGrid = !!\(fieldOptions\.grid \|\| fieldOptions\.multiline\);/,
  'localized fields should have an explicit grid option shared by keywords and multiline fields'
);

assert.match(
  siteSettingsSource,
  /renderLocalizedField\(seoSection, 'siteKeywords', \{[\s\S]*grid: true,[\s\S]*ensureDefault: false/,
  'Site keywords should opt into the aligned localized grid layout'
);

assert.match(
  siteSettingsSource,
  /if \(useLocalizedGrid\) row\.classList\.add\('cs-localized-row--grid'\);[\s\S]*if \(fieldOptions\.multiline\) row\.classList\.add\('cs-localized-row--multiline'\);/,
  'aligned localized fields should mark grid rows separately from multiline textarea behavior'
);

assert.match(
  siteSettingsSource,
  /list\.className = useLocalizedGrid\s+\? 'cs-localized-list cs-localized-list--grid'\s+: 'cs-localized-list';/,
  'aligned localized fields should mark the list so row spacing can match the identity grid'
);

assert.match(
  siteSettingsSource,
  /\.cs-identity-grid,.cs-localized-list--grid,.cs-single-grid-fieldset,.cs-link-list\{--cs-editor-row-gap:\.35rem;--cs-editor-row-column-gap:\.45rem;--cs-editor-control-height:1\.95rem;--cs-editor-single-control-width:15rem\}/,
  'identity, aligned localized rows, and profile links should share one row rhythm and fixed single-control width contract'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.(?:cs-root|cs-single-grid-fieldset)\{[^}]*--cs-editor-single-label-width/,
  'compact containers should not redeclare the measured label width because that masks the inherited dynamic value'
);

assert.match(
  siteSettingsSource,
  /\.cs-localized-list--grid\{gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-localized-row--grid\{display:grid;grid-template-columns:minmax\(88px,88px\) minmax\(0,1fr\) minmax\(72px,max-content\);align-items:center;column-gap:var\(--cs-editor-row-column-gap\);row-gap:0;min-height:var\(--cs-editor-control-height\);padding:0/,
  'aligned localized rows should use the shared identity row density and reserve aligned input columns'
);

assert.match(
  siteSettingsSource,
  /\.cs-identity-grid\{display:flex;flex-direction:column;gap:var\(--cs-editor-row-gap\)\}[\s\S]*\.cs-identity-row\{display:grid;grid-template-columns:minmax\(88px,max-content\) minmax\(0,1fr\) minmax\(0,3fr\) minmax\(72px,max-content\);align-items:center;gap:var\(--cs-editor-row-column-gap\)\}/,
  'identity rows should consume the same row rhythm contract'
);

assert.match(
  siteSettingsSource,
  /\.cs-localized-row--grid \.cs-lang-chip\{justify-self:end\}/,
  'aligned localized rows should right-align language chips within the language column'
);

assert.match(
  siteSettingsSource,
  /\.cs-identity-lang\{min-width:0;display:flex;align-items:center;justify-content:flex-end\}/,
  'identity localized rows should right-align language chips within the language column'
);

assert.match(
  composerIndexTabsUiSource,
  /const flag = langFlag\(lang\);[\s\S]*const flagSpan = flag \? `<span class="ci-lang-flag" aria-hidden="true">\$\{escapeHtml\(flag\)\}<\/span>` : '';[\s\S]*<strong class="ci-lang-label" aria-label="\$\{safeLabel\}" title="\$\{safeLabel\}">[\s\S]*<span class="ci-lang-code">\$\{escapeHtml\(lang\.toUpperCase\(\)\)\}<\/span>/,
  'index language section headings should show the regional flag before the language code'
);

assert.match(
  siteSettingsSource,
  /\.ci-lang-label\{display:inline-flex;align-items:center;gap:\.35rem;line-height:1\.1;\}[\s\S]*\.ci-lang-label \.ci-lang-flag\{display:inline-grid;place-items:center;width:1\.2em;height:1\.2em;font-size:1rem;line-height:1;\}[\s\S]*\.ci-lang-label \.ci-lang-code\{display:inline-flex;align-items:center;line-height:1\.2;/,
  'index language section flags should be aligned as part of the compact heading label'
);

assert.doesNotMatch(
  siteSettingsSource,
  /\.ci-item:hover[\s\S]*transform:translateY\(-1px\)|\.ci-item:hover[\s\S]*--ci-depth-shadow:0 12px 24px|\.ci-item:hover[\s\S]*border-color:color-mix/,
  'composer entry cards should not float, deepen shadow, or recolor border on hover'
);

assert.match(
  siteSettingsSource,
  /\.ci-lang\{border:0;border-radius:0;margin:0;background:transparent;padding:\.65rem 0;\}[\s\S]*\.ci-lang\+\.ci-lang\{border-top:1px solid color-mix\(in srgb, var\(--border\) 82%, transparent\);\}/,
  'index language sections should read as separated rows instead of nested cards'
);

assert.match(
  composerIndexTabsUiSource,
  /<button class="btn-secondary ci-expand"[\s\S]*<\/button>\s*<span class="ci-head-add-lang-slot"><\/span>\s*<button class="btn-secondary ci-del">/,
  'index add-language control should live in the entry header immediately after details'
);

assert.match(
  composerIndexTabsUiSource,
  /const headAddLangSlot = query\('\.ci-head-add-lang-slot', row\);[\s\S]*if \(headAddLangSlot\) headAddLangSlot\.innerHTML = '';[\s\S]*\(headAddLangSlot \|\| bodyInner\)\.appendChild\(addLangWrap\);/,
  'index add-language menu should be mounted into the header slot and refreshed with the body'
);

assert.match(
  composerDragListSource,
  /const handleSelector = dragOptions\.handleSelector \|\| '\.ci-grip,\.ct-grip';[\s\S]*const handle = target\.closest\(handleSelector\);[\s\S]*if \(!handle \|\| !container\.contains\(handle\)\) return;[\s\S]*const item = handle\.closest\(keySelector\);/,
  'composer entry reordering should start only from the visible drag handle'
);

assert.doesNotMatch(
  composerDragListSource.match(
    /function makeDragList\(container, onReorder, dragOptions = \{\}\) \{[\s\S]*?container\.addEventListener\('pointerdown', onPointerDown\);/
  )[0],
  /const (?:li|item) = target\.closest\(keySelector\);/,
  'composer entry reordering should not treat the entire card as a drag source'
);

assert.doesNotMatch(
  composerIndexTabsUiSource.match(
    /function buildIndexUI\(root, state\) \{[\s\S]*?\n {2}function buildTabsUI\(root, state\) \{/
  )[0],
  /bodyInner\.appendChild\(addLangWrap\);/,
  'index add-language control should not render at the bottom of the expanded language list'
);

assert.match(
  composerSiteSettingsSingleGridsSource,
  /renderIdentityPathGrid: \(section\) => renderSchemaTextGrid\(section, schemaFields\.identityPaths\)/,
  'composer site editor should define compact identity path grid rendering in the single-grids boundary'
);

assert.match(
  siteSettingsSource,
  /const createSingleGridFieldset = \(section\) => \{/,
  'compact single-value sections should share one reusable grid fieldset renderer'
);

assert.match(
  composerUiMotionSource,
  /function syncSiteEditorSingleLabelWidth\(runtime, root\) \{[\s\S]*querySelectorAll\('\.cs-single-grid-title'\)[\s\S]*requestFrame\(runtime, measure\)[\s\S]*ResizeObserverRef/,
  'compact single-value labels should be measured once after render and shared through a CSS variable'
);

assert.match(
  composerUiMotionSource,
  /label\.scrollWidth[\s\S]*getComputedStyleFor\(runtime, target\)[\s\S]*gap/,
  'compact single-value label measurement should use intrinsic label width instead of the currently constrained grid cell'
);

assert.match(
  composerUiMotionSource,
  /target\.querySelector \? target\.querySelector\('\.cs-help-tooltip'\) : null[\s\S]*const tooltipWidth = tooltip \? tooltip\.scrollWidth \|\| 0 : 0;/,
  'compact single-value label measurement should measure only the help icon, not the tooltip wrapper'
);

assert.doesNotMatch(
  composerUiMotionSource,
  /querySelector\('\.cs-help-tooltip-wrap'\)[\s\S]*const tooltipWidth = tooltip \? tooltip\.scrollWidth \|\| 0 : 0;/,
  'compact single-value label measurement should not include hidden tooltip bubble width'
);

assert.doesNotMatch(
  composerUiMotionSource,
  /function syncSiteEditorSingleLabelWidth\(runtime, root\) \{[\s\S]*getBoundingClientRect[\s\S]*root\.style\.setProperty\('--cs-editor-single-label-width'/,
  'compact single-value label measurement should not seed width from constrained layout rects'
);

assert.match(
  siteSettingsSource,
  /buildSiteUI\(root, state\) \{[\s\S]*syncSiteEditorSingleLabelWidth\(root\);[\s\S]*refreshNavDiffState\(\);/,
  'site editor should resync the measured single-label width after rebuilding translated labels'
);

assert.match(
  siteSettingsSource,
  /const renderSingleTextGrid = \(section, items\) => \{[\s\S]*createSingleGridFieldset\(section\)[\s\S]*input\.id = controlId;[\s\S]*input\.addEventListener\('input'/,
  'compact text rows should share one reusable single-grid text renderer'
);

assert.match(
  composerSiteSettingsSchemaSource,
  /seoResources: \[[\s\S]*field\('resourceURL', 'resourceURL', 'resourceURLHelp'/,
  'SEO Resource URL compact grid should preserve the field key and help tooltip text'
);

assert.doesNotMatch(
  siteSettingsSource,
  /renderCompactSectionMenu|cs-mobile-section-nav|cs-nav-button/,
  'site settings should not render section navigation controls'
);

assert.match(
  siteSettingsSource,
  /const resolveSiteScrollContainer = \(\) => \{[\s\S]*root \? root\.querySelector\(EDITOR_SHELL_SELECTORS\.composerSiteViewportElement\)[\s\S]*canOwnScroll[\s\S]*return viewport;[\s\S]*root\.closest\(EDITOR_SHELL_SELECTORS\.editorModalBody\)[\s\S]*return modalBody;[\s\S]*return windowRef;[\s\S]*\};/,
  'site settings scrolling should prefer the internal content viewport before falling back to the modal body'
);

assert.match(
  siteSettingsSource,
  /const scrollContainer = resolveSiteScrollContainer\(\);[\s\S]*scrollContainer\.addEventListener\('scroll', onScroll, \{ passive: true \}\);[\s\S]*scrollContainer\.removeEventListener\('scroll', onScroll, \{ passive: true \}\);/,
  'site section state sync should listen to its resolved scroll container, not only window scroll'
);

assert.match(
  siteSettingsSource,
  /let measuredAnySection = false;[\s\S]*if \(!rect \|\| rect\.height <= 4\) continue;[\s\S]*measuredAnySection = true;[\s\S]*if \(!measuredAnySection\) return;[\s\S]*if \(!candidate\) candidate = sectionsMeta\[0\] \|\| null;/,
  'site section active-state sync should ignore hidden modal measurements instead of falling back to the last section'
);

assert.match(
  siteSettingsSource,
  /const scrollTop = getSiteScrollTop\(scrollContainer\);[\s\S]*if \(scrollTop <= 4\) candidate = sectionsMeta\[0\] \|\| null;/,
  'site section active-state sync should keep the repository section active when the modal body is at the top'
);

assert.match(
  composerEditorShellSource,
  /function resetSiteSettingsNavOnOpen\(\) \{[\s\S]*modalBody\.scrollTop = 0;[\s\S]*root\.__pressSiteFirstSectionId[\s\S]*setActive\(firstSectionId,[\s\S]*scrollViewport: false[\s\S]*activateFirst\(\);[\s\S]*requestAnimationFrame/,
  'opening Site Settings should reset the shell modal body and left navigation to the first section'
);

assert.match(
  composerSiteSettingsSchemaSource,
  /behavior: \{[\s\S]*defaultLanguage: field\('defaultLanguage'[\s\S]*publicLanguages: field\('publicLanguages'[\s\S]*publicLanguageList: field\('publicLanguageList'[\s\S]*contentOutdatedDays: field\('contentOutdatedDays'[\s\S]*pageSize: field\('pageSize'[\s\S]*landingTab: field\('landingTab'[\s\S]*cardCoverFallback: field\('cardCoverFallback'[\s\S]*errorOverlay: field\('errorOverlay'/,
  'Behavior compact grid should include language policy and all single-value behavior fields'
);

assert.match(
  composerSiteSettingsSchemaSource,
  /publicChrome: \{[\s\S]*search: field\('searchFeature'[\s\S]*editorEntry: field\('editorEntryFeature'[\s\S]*visitorThemeControls: field\('visitorThemeControlsFeature'[\s\S]*languageSwitcher: field\('languageSwitcherFeature'[\s\S]*allPosts: field\('allPostsFeature'[\s\S]*footerNav: field\('footerNavFeature'[\s\S]*profileLinks: field\('profileLinksFeature'[\s\S]*tags: field\('tagsFeature'[\s\S]*toc: field\('tocFeature'[\s\S]*postMeta: field\('postMetaFeature'[\s\S]*comments: field\('commentsFeature'/,
  'Public chrome compact grid should include all public feature toggles'
);

assert.match(
  siteSettingsSource,
  /const renderPublicChromeGrid = \(section\) => \{[\s\S]*publicChromeHomeWarning[\s\S]*SITE_FEATURE_KEYS\.forEach\(\(key\) => \{[\s\S]*toggle\.dataset\.field = 'features';[\s\S]*toggle\.dataset\.subfield = key;/,
  'Public chrome grid should render feature toggles from the centralized feature key list with object diff markers'
);

assert.match(
  siteSettingsSource,
  /const tabHasReachableLocation = \(slug\) => \{[\s\S]*typeof value\.location === 'string' && value\.location\.trim\(\)[\s\S]*const hasStaticTab = order\.some\(slug => tabHasReachableLocation\(slug\)\);/,
  'Public chrome home warning should count only tabs with reachable locations'
);

assert.match(
  siteSettingsSource,
  /const renderThemeGrid = \(section\) => \{[\s\S]*dataKey: 'themeMode'[\s\S]*dataKey: 'themePack'[\s\S]*dataKey: 'themeOverride'/,
  'Theme compact grid should include all single-value theme fields'
);

assert.match(
  siteSettingsSource,
  /from '\.\/theme-settings\.js';[\s\S]*const themeSettingsBlock = documentRef\.createElement\('div'\)[\s\S]*setThemeSettingOverride\(site, pack, field\.key, value, field\)[\s\S]*resolveThemeSettings\(\{ pack, manifest, siteConfig: site \}\)/,
  'Theme compact grid should render current theme settings from the shared theme settings contract'
);

assert.match(
  siteSettingsSource,
  /themeSettingValueSignature[\s\S]*field\.defaultValue === undefined[\s\S]*unsetOption\.value = '';[\s\S]*option\.value = String\(index\);[\s\S]*option\.dataset\.valueSignature = themeSettingValueSignature\(optionData\.value\);[\s\S]*select\.value === ''[\s\S]*commitValue\(undefined\);[\s\S]*const selectedIndex = Number\(select\.value\);[\s\S]*commitValue\(selected \? selected\.value : select\.value\);/,
  'Theme settings select controls should preserve mixed scalar option types'
);

assert.match(
  siteSettingsSource,
  /input\.type === 'number' \|\| input\.type === 'range'[\s\S]*input\.value === '' \? undefined : Number\(input\.value\)[\s\S]*commitValue\(nextValue\);/,
  'Theme settings numeric controls should allow optional overrides to be cleared'
);

assert.match(
  siteSettingsSource,
  /field\.control === 'text' && field\.defaultValue === undefined && input\.value === '' \? undefined : input\.value[\s\S]*commitValue\(nextValue\);/,
  'Theme settings optional text controls should allow blank values to clear persisted overrides'
);

assert.match(
  siteSettingsSource,
  /field\.control === 'boolean'[\s\S]*field\.defaultValue === undefined[\s\S]*unsetButton\.textContent = 'Not set';[\s\S]*commitValue\(undefined\);[\s\S]*syncSwitchState\(checkbox, toggle, false, false\);/,
  'Theme settings optional boolean controls should expose an unset path'
);

assert.match(
  siteSettingsSource,
  /\(field\.control === 'color' \|\| field\.control === 'range'\) && field\.defaultValue === undefined[\s\S]*unsetButton\.textContent = 'Not set';[\s\S]*unsetButton\.addEventListener\('click', \(\) => commitValue\(undefined\)\);/,
  'Theme settings optional color and range controls should expose an unset path'
);

assert.match(
  siteSettingsSource,
  /const renderAssetWarningsGrid = \(section\) => \{[\s\S]*dataKey: 'assetWarnings'[\s\S]*fields\.assetLargeImage[\s\S]*fields\.assetLargeImageThreshold/,
  'Asset warnings compact grid should include the warning toggle and threshold rows'
);

assert.match(
  siteSettingsSource,
  /const renderThemeGrid = \(section\) => \{[\s\S]*fetchContent\('assets\/themes\/packs\.json', \{ cache: 'no-store' \}\)[\s\S]*applyThemePackOptions\(fallbackThemePacks\);/,
  'Theme compact grid should preserve dynamic theme pack loading with fallback options'
);

assert.match(
  composerSiteSettingsUiSource,
  /createComposerSiteSettingsRepoSection\(\{[\s\S]*siteSettingsSchema,[\s\S]*createSection,[\s\S]*renderPublishTransportSettings,[\s\S]*\}\);[\s\S]*const identitySection = createSection\(/,
  'Repository should be the first site editor card before Identity'
);

assert.doesNotMatch(
  siteSettingsSource,
  /createField\(repoSection,\s*\{[\s\S]*dataKey: 'repo'[\s\S]*fields\.repo[\s\S]*fields\.repoHelp/,
  'Repository card should not render a duplicate GitHub repository field heading'
);

assert.match(
  composerPublishSettingsUiSource,
  /function renderFineGrainedTokenSettings\(host\) \{[\s\S]*tokenField\.className = 'cs-repo-field-group cs-repo-field-group--token cs-token-field';[\s\S]*field\.className = 'cs-repo-field cs-repo-field--token';[\s\S]*input\.id = 'syncGithubTokenInput';[\s\S]*input\.className = 'cs-input cs-repo-input cs-repo-input--token';[\s\S]*const btnForget = documentRef\.createElement\('span'\);[\s\S]*btnForget\.setAttribute\('role', 'button'\);[\s\S]*btnForget\.className = 'cs-token-clear';[\s\S]*field\.append\(affix, input, btnForget\);[\s\S]*setCachedFineGrainedToken\(input\.value\);[\s\S]*host\.appendChild\(wrapper\);/,
  'fine-grained token settings should reuse the repository field style with a full-width token field'
);

assert.doesNotMatch(
  composerPublishSettingsUiSource.slice(
    composerPublishSettingsUiSource.indexOf('function renderFineGrainedTokenSettings(host) {'),
    composerPublishSettingsUiSource.indexOf('function renderPublishTransportSettings(host) {')
  ),
  /documentRef\.createElement\('button'\)|document\.createElement\('button'\)/,
  'token clear control should avoid native button chrome'
);

assert.doesNotMatch(
  composerPublishSettingsUiSource,
  /cs-token-actions/,
  'token clear control should not reserve a separate action row below the input'
);

assert.match(
  composerNotificationsSource,
  /const hasAction = !!\(action && \(action\.href \|\| typeof action\.onClick === 'function'\)\);[\s\S]*const shouldAutoDismiss = toastOptions\.sticky !== true && !hasAction;/,
  'plain info toasts such as Loading config should auto-dismiss unless explicitly sticky or actionable'
);

assert.match(
  composerSiteSettingsRepoSectionSource,
  /repoInputs\.className = 'cs-repo-grid';[\s\S]*repoInputs\.dataset\.field = 'repo';[\s\S]*createRepoFieldGroup\('cs-repo-field-group--owner', t\('editor\.composer\.site\.repoOwner'\), ownerWrap\)[\s\S]*createRepoFieldGroup\('cs-repo-field-group--name', t\('editor\.composer\.site\.repoName'\), repoWrap\)[\s\S]*createRepoFieldGroup\('cs-repo-field-group--branch', t\('editor\.composer\.site\.repoBranch'\), branchWrap\)[\s\S]*repoSection\.appendChild\(repoInputs\);/,
  'Repository inputs should remain diff-addressable while rendering labeled controls directly in the Repository card'
);

assert.match(
  composerSiteSettingsRepoSectionSource,
  /repoSection\.appendChild\(repoInputs\);\s*renderPublishTransportSettings\(repoSection\);/,
  'Repository card should host the browser-local publish transport settings'
);

assert.match(
  composerPublishSettingsUiSource,
  /function getMatchingConnectPublishGrant\(connect, repo = getActiveSiteRepoConfig\(\)\) \{[\s\S]*cached\.baseUrl !== connect\.baseUrl[\s\S]*cached\.owner !== repo\.owner \|\| cached\.name !== repo\.name \|\| cached\.branch !== branch[\s\S]*return cached;/,
  'Connect connected UI should only trust cached grants that match the selected repo, branch, and base URL'
);

assert.match(
  composerPublishSettingsUiSource,
  /function getVisibleFineGrainedTokenInput\(\) \{[\s\S]*documentRef\.querySelectorAll\('#syncGithubTokenInput'\)[\s\S]*offsetParent !== null[\s\S]*function syncFineGrainedTokenInputs\(value, sourceInput = null\) \{[\s\S]*documentRef\.querySelectorAll\('#syncGithubTokenInput'\)[\s\S]*if \(input !== sourceInput\) input\.value = nextValue;[\s\S]*function openSyncPanelForPatFallback\(\) \{[\s\S]*applyMode\('sync', \{ preserveTreeExpansion: true \}\);[\s\S]*showEditorSystemPanel\('sync'\);[\s\S]*function switchToPatFallbackAndFocusToken\(\) \{[\s\S]*setConnectPublishEnabled\(false\);[\s\S]*openSyncPanelForPatFallback\(\);[\s\S]*updatePublishTransportSettingsDomForPatFallback\(\);[\s\S]*refreshSyncCommitPanel\(\{ focusToken: true \}\)[\s\S]*\.then\(\(\) => focusFineGrainedTokenInput\(\)\)[\s\S]*\.catch\(\(\) => focusFineGrainedTokenInput\(\)\);/,
  'Connect failure fallback action should switch to PAT mode through the normal Publish panel path, refresh publish state, and focus the visible PAT token input'
);

assert.match(
  composerPublishSettingsUiSource,
  /input\.addEventListener\('input', \(\) => \{[\s\S]*setCachedFineGrainedToken\(input\.value\);[\s\S]*syncFineGrainedTokenInputs\(input\.value, input\);[\s\S]*const clearToken = \(\) => \{[\s\S]*clearCachedFineGrainedToken\(\);[\s\S]*syncFineGrainedTokenInputs\(''\);/,
  'Multiple PAT token inputs should stay synchronized so clearing one cannot resurrect a stale session token'
);

assert.match(
  composerSyncPanelSource,
  /const showError = \(message, errorOptions = \{\}\) => \{[\s\S]*sync-commit-error-hint[\s\S]*connectFallbackHint[\s\S]*sync-connect-fallback-action[\s\S]*switchToPatFallbackAndFocusToken\(\);/,
  'inline Connect authorization errors should render an explicit PAT fallback action'
);

assert.match(
  editorSource,
  /\.sync-commit-error\s*\{[\s\S]*display:flex;[\s\S]*\.sync-commit-error\[hidden\]\s*\{[\s\S]*display:none !important;/,
  'sync commit fallback errors should still obey the hidden attribute after flex styling'
);

assert.match(
  composerPublishFlowSource,
  /let connectFallbackActionAvailable = false;[\s\S]*const payload = await gatherCommitPayload\(\{ showSeoStatus: true \}\);[\s\S]*const files = Array\.isArray\(payload && payload\.files\) \? payload\.files : \[\];[\s\S]*connectFallbackActionAvailable = true;[\s\S]*publishResult = await publishStagedCommit\(\{[\s\S]*transport,[\s\S]*getCachedGrant: getCachedConnectPublishGrant[\s\S]*connectFallbackActionAvailable = false;[\s\S]*if \(transport && transport\.type === 'connect' && connectFallbackActionAvailable\) \{[\s\S]*toastOptions\.action = \{[\s\S]*connectFallback[\s\S]*switchToPatFallbackAndFocusToken\(\);[\s\S]*showToast\('error', message, toastOptions\);/,
  'Only Connect authorization and publish failures should expose a toast action that switches to PAT fallback'
);

// composer-identity-body:end
