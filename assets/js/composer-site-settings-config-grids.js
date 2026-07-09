import { SITE_FEATURE_KEYS, isSiteFeatureEnabled } from './site-features.js';
import {
  buildLanguageAvailability,
  normalizeLanguageCode,
  normalizePublicLanguageSettings
} from './language-availability.js';
import {
  resolveThemeSettings,
  sanitizeThemeSlug,
  setThemeSettingOverride,
  themeSettingValueSignature
} from './theme-settings.js';

export function createComposerSiteSettingsConfigGrids(options = {}) {
  const noop = () => {};
  const documentRef = options.documentRef || null;
  const site = options.site || {};
  const state = options.state || {};
  const siteSettingsSchema = options.siteSettingsSchema || { fields: {} };
  const createSingleGridFieldset = typeof options.createSingleGridFieldset === 'function'
    ? options.createSingleGridFieldset
    : () => ({ addRow: () => ({ row: null, controlCell: null, controlId: '' }) });
  const createSwitchControl = typeof options.createSwitchControl === 'function'
    ? options.createSwitchControl
    : () => ({ toggle: null, checkbox: null });
  const syncSwitchState = typeof options.syncSwitchState === 'function' ? options.syncSwitchState : noop;
  const markDirty = typeof options.markDirty === 'function' ? options.markDirty : noop;
  const ensureAnnotate = typeof options.ensureAnnotate === 'function' ? options.ensureAnnotate : () => ({});
  const ensureAssetWarnings = typeof options.ensureAssetWarnings === 'function' ? options.ensureAssetWarnings : () => ({ largeImage: {} });
  const collectLanguageCodes = typeof options.collectLanguageCodes === 'function' ? options.collectLanguageCodes : () => [];
  const getAvailableLangs = typeof options.getAvailableLangs === 'function' ? options.getAvailableLangs : () => [];
  const normalizeLangCode = typeof options.normalizeLangCode === 'function'
    ? options.normalizeLangCode
    : (code) => String(code || '').trim().toLowerCase();
  const displayLangName = typeof options.displayLangName === 'function' ? options.displayLangName : (code) => String(code || '').toUpperCase();
  const fetchContent = typeof options.fetchContent === 'function' ? options.fetchContent : null;
  const applyMode = typeof options.applyMode === 'function' ? options.applyMode : noop;
  const safeString = typeof options.safeString === 'function' ? options.safeString : (value) => (value == null ? '' : String(value));
  const connectPublishPresets = Array.isArray(options.connectPublishPresets) ? options.connectPublishPresets : [];
  const annotateDiscussionCategoryPresets = Array.isArray(options.annotateDiscussionCategoryPresets) ? options.annotateDiscussionCategoryPresets : [];
  const t = typeof options.t === 'function' ? options.t : (key) => key;
  let refreshLandingOptions = noop;
  let refreshLanguageAvailabilityWarnings = noop;

  const ensureFeatures = () => {
    if (!site.features || typeof site.features !== 'object' || Array.isArray(site.features)) site.features = {};
    return site.features;
  };

  const getFeatureEnabled = (key) => isSiteFeatureEnabled(site, key);

  const ensureLanguages = () => {
    site.languages = normalizePublicLanguageSettings(site.languages);
    return site.languages;
  };

  const languageWarningText = (entry) => {
    const code = entry && entry.code ? entry.code : '';
    const language = entry && entry.language ? displayLangName(entry.language) : '';
    const count = entry && entry.count != null ? entry.count : 0;
    const key = `editor.composer.site.languageWarnings.${code}`;
    const translated = t(key, { language, count });
    if (translated && translated !== key) return translated;
    if (code === 'public-language-missing-ui') return `Public language ${language} has no UI translation bundle and will not be shown.`;
    if (code === 'content-language-missing-ui') return `Content language ${language} has no UI translation bundle and will not be shown.`;
    if (code === 'default-language-missing-content') return `Default language ${language} has no matching content.`;
    if (code === 'public-language-missing-content') return `Public language ${language} has no matching content.`;
    if (code === 'public-language-empty-fallback') return `No public languages resolved. Falling back to ${language}.`;
    if (code === 'language-switcher-single-language') return 'Language switcher is enabled but fewer than two public languages are available.';
    return code || 'Language availability warning.';
  };

  const setFeatureEnabled = (key, value) => {
    ensureFeatures()[key] = !!value;
    if (key === 'allPosts' && value === false && site.landingTab === 'posts') {
      site.landingTab = '';
    }
  };

  const tabHasReachableLocation = (slug) => {
    const tabs = state.tabs && typeof state.tabs === 'object' ? state.tabs : {};
    const visit = (value) => {
      if (!value) return false;
      if (typeof value === 'string') return !!value.trim();
      if (Array.isArray(value)) return value.some(visit);
      if (typeof value !== 'object') return false;
      if (typeof value.location === 'string' && value.location.trim()) return true;
      return Object.entries(value).some(([key, child]) => key !== 'title' && visit(child));
    };
    return !!(slug && visit(tabs[slug]));
  };

  const renderBehaviorGrid = (section) => {
    const { addRow } = createSingleGridFieldset(section);
    const rows = [];
    const addBehaviorRow = (item) => {
      const row = addRow(item, rows.length);
      rows.push(row);
      return row;
    };

    const createSelectRow = (item) => {
      const { controlCell, controlId } = addBehaviorRow(item);
      const select = documentRef.createElement('select');
      select.id = controlId;
      select.className = 'cs-select';
      select.dataset.field = item.dataKey;
      controlCell.appendChild(select);
      return select;
    };

    const behaviorSchema = siteSettingsSchema.fields.behavior;
    const defaultLanguageSelect = createSelectRow(behaviorSchema.defaultLanguage);

    const applyDefaultLanguageOptions = () => {
      const codes = collectLanguageCodes();
      const seen = new Set();
      const appendOption = (value, label) => {
        const option = documentRef.createElement('option');
        option.value = value;
        option.textContent = label;
        defaultLanguageSelect.appendChild(option);
        seen.add(value);
      };

      defaultLanguageSelect.innerHTML = '';
      appendOption('', t('editor.composer.site.languageAutoOption'));
      codes.forEach((code) => {
        if (!seen.has(code)) appendOption(code, displayLangName(code));
      });
      const current = normalizeLangCode(site.defaultLanguage);
      if (current && !seen.has(current)) {
        appendOption(current, displayLangName(current));
      }
      const nextValue = current && seen.has(current) ? current : '';
      defaultLanguageSelect.value = nextValue;
    };

    defaultLanguageSelect.addEventListener('change', () => {
      site.defaultLanguage = normalizeLangCode(defaultLanguageSelect.value);
      refreshLanguageAvailabilityWarnings();
      markDirty();
    });
    applyDefaultLanguageOptions();

    const publicLanguagesSelect = createSelectRow(behaviorSchema.publicLanguages);
    [
      ['ui', t('editor.composer.site.publicLanguagePolicies.ui')],
      ['content', t('editor.composer.site.publicLanguagePolicies.content')],
      ['explicit', t('editor.composer.site.publicLanguagePolicies.explicit')]
    ].forEach(([value, label]) => {
      const option = documentRef.createElement('option');
      option.value = value;
      option.textContent = label && label !== `editor.composer.site.publicLanguagePolicies.${value}` ? label : value;
      publicLanguagesSelect.appendChild(option);
    });

    const explicitRow = addBehaviorRow(behaviorSchema.publicLanguageList);
    const publicListInput = documentRef.createElement('textarea');
    publicListInput.id = explicitRow.controlId;
    publicListInput.className = 'cs-input';
    publicListInput.rows = 2;
    publicListInput.dataset.field = 'languages';
    publicListInput.dataset.subfield = 'publicList';
    explicitRow.controlCell.appendChild(publicListInput);

    const warningList = documentRef.createElement('ul');
    warningList.className = 'cs-extra-list cs-language-availability-warnings';
    warningList.dataset.field = 'languages';

    const syncPublicLanguageControls = () => {
      const languages = ensureLanguages();
      publicLanguagesSelect.value = languages.public || 'ui';
      publicListInput.value = (languages.publicList || []).join(', ');
      explicitRow.row.hidden = languages.public !== 'explicit';
    };

    refreshLanguageAvailabilityWarnings = () => {
      const report = buildLanguageAvailability({
        siteConfig: site,
        uiLanguages: getAvailableLangs(),
        indexState: state.index,
        tabsState: state.tabs
      });
      warningList.innerHTML = '';
      const warnings = Array.isArray(report.warnings) ? report.warnings : [];
      warnings.forEach((entry) => {
        const item = documentRef.createElement('li');
        item.textContent = languageWarningText(entry);
        warningList.appendChild(item);
      });
      warningList.hidden = !warnings.length;
    };

    publicLanguagesSelect.addEventListener('change', () => {
      const languages = ensureLanguages();
      languages.public = publicLanguagesSelect.value || 'ui';
      if (languages.public !== 'explicit') languages.publicList = [];
      syncPublicLanguageControls();
      refreshLanguageAvailabilityWarnings();
      markDirty();
    });

    publicListInput.addEventListener('input', () => {
      const languages = ensureLanguages();
      languages.publicList = publicListInput.value
        .split(/[\s,]+/)
        .map(value => normalizeLanguageCode(value))
        .filter(Boolean);
      refreshLanguageAvailabilityWarnings();
      markDirty();
    });

    syncPublicLanguageControls();
    refreshLanguageAvailabilityWarnings();
    section.appendChild(warningList);

    const createNumberRow = (item) => {
      const { controlCell, controlId } = addBehaviorRow(item);
      const input = documentRef.createElement('input');
      input.id = controlId;
      input.type = 'number';
      input.className = 'cs-input';
      input.dataset.field = item.dataKey;
      if (item.min != null) input.min = String(item.min);
      const value = item.get();
      input.value = value != null && !Number.isNaN(value) ? String(value) : '';
      input.addEventListener('input', () => {
        const raw = input.value.trim();
        item.set(raw ? Number(raw) : null);
        markDirty();
      });
      controlCell.appendChild(input);
      return input;
    };

    createNumberRow({
      ...behaviorSchema.contentOutdatedDays,
      get: () => site.contentOutdatedDays,
      set: (value) => { site.contentOutdatedDays = value == null || Number.isNaN(value) ? null : value; }
    });

    createNumberRow({
      ...behaviorSchema.pageSize,
      get: () => site.pageSize,
      set: (value) => { site.pageSize = value == null || Number.isNaN(value) ? null : value; }
    });

    const createToggleRow = (item, allowMixed = false) => {
      const { row, controlCell } = addBehaviorRow(item);
      const { toggle, checkbox } = createSwitchControl(row, item.checkboxLabel || item.label, {
        target: controlCell,
        classes: ['cs-single-grid-switch']
      });
      toggle.dataset.field = item.dataKey;
      const sync = () => {
        syncSwitchState(checkbox, toggle, item.get(), allowMixed);
      };
      checkbox.addEventListener('change', () => {
        item.set(checkbox.checked);
        syncSwitchState(checkbox, toggle, checkbox.checked, allowMixed);
        markDirty();
      });
      sync();
      return { checkbox, row, control: toggle };
    };

    const landingTabSelect = createSelectRow(behaviorSchema.landingTab);

    const getTabLabel = (slug) => {
      if (!state.tabs || typeof state.tabs !== 'object') return slug;
      const entry = state.tabs[slug];
      if (!entry || typeof entry !== 'object') return slug;
      const pickTitle = () => {
        const def = entry.default;
        if (def && typeof def === 'object' && def.title) return String(def.title).trim();
        for (const key of Object.keys(entry)) {
          if (key === '__order') continue;
          const val = entry[key];
          if (val && typeof val === 'object' && val.title) {
            const title = String(val.title).trim();
            if (title) return title;
          }
        }
        return '';
      };
      const title = pickTitle();
      if (!title) return slug;
      if (title.toLowerCase() === String(slug).toLowerCase()) return title;
      return `${title} (${slug})`;
    };

    const renderLandingOptions = () => {
      const seen = new Set();
      let firstOption = null;
      const addOption = (value, label) => {
        if (value === '' || seen.has(value)) return;
        const option = documentRef.createElement('option');
        option.value = value;
        option.textContent = label;
        landingTabSelect.appendChild(option);
        seen.add(value);
        if (firstOption == null) firstOption = value;
      };

      const current = site.landingTab || '';
      landingTabSelect.innerHTML = '';
      const order = state.tabs && Array.isArray(state.tabs.__order) ? state.tabs.__order : [];
      order.forEach((slug) => {
        if (!slug || !tabHasReachableLocation(slug)) return;
        addOption(slug, getTabLabel(slug));
      });
      const allowPosts = getFeatureEnabled('allPosts') || current === 'posts';
      if (allowPosts) {
        addOption('posts', t('editor.composer.site.fields.landingTabAllPostsOption'));
      }
      if (current && !seen.has(current)) addOption(current, current);
      const nextValue = seen.has(current) ? current : firstOption || '';
      landingTabSelect.value = nextValue;
      if (nextValue && nextValue !== site.landingTab) {
        site.landingTab = nextValue;
        markDirty();
      }
    };
    refreshLandingOptions = renderLandingOptions;

    landingTabSelect.addEventListener('change', () => {
      const value = landingTabSelect.value;
      if (value && site.landingTab !== value) {
        site.landingTab = value;
        markDirty();
      }
    });
    renderLandingOptions();

    createToggleRow({
      ...behaviorSchema.cardCoverFallback,
      get: () => site.cardCoverFallback,
      set: (value) => { site.cardCoverFallback = value; }
    }, true);

    createToggleRow({
      ...behaviorSchema.errorOverlay,
      get: () => site.errorOverlay,
      set: (value) => { site.errorOverlay = value; }
    }, true);
  };

  const renderPublicChromeGrid = (section) => {
    const schema = siteSettingsSchema.fields.publicChrome || {};
    const { addRow } = createSingleGridFieldset(section);
    const rows = [];
    const homeWarning = documentRef.createElement('p');
    homeWarning.className = 'cs-field-help cs-public-chrome-warning';
    homeWarning.textContent = t('editor.composer.site.fields.publicChromeHomeWarning');
    homeWarning.hidden = true;
    const addFeatureRow = (item) => {
      const row = addRow(item, rows.length);
      rows.push(row);
      return row;
    };
    const updateHomeWarning = () => {
      const order = state.tabs && Array.isArray(state.tabs.__order) ? state.tabs.__order : [];
      const hasStaticTab = order.some(slug => tabHasReachableLocation(slug));
      const hasReachableHome = getFeatureEnabled('allPosts') || hasStaticTab;
      homeWarning.hidden = !!hasReachableHome;
    };
    SITE_FEATURE_KEYS.forEach((key) => {
      const item = schema[key];
      if (!item) return;
      const { row, controlCell } = addFeatureRow(item);
      const { toggle, checkbox } = createSwitchControl(row, item.checkboxLabel || item.label, {
        target: controlCell,
        classes: ['cs-single-grid-switch']
      });
      toggle.dataset.field = 'features';
      toggle.dataset.subfield = key;
      const sync = () => {
        syncSwitchState(checkbox, toggle, getFeatureEnabled(key), false);
      };
      checkbox.addEventListener('change', () => {
        setFeatureEnabled(key, checkbox.checked);
        syncSwitchState(checkbox, toggle, checkbox.checked, false);
        if (key === 'allPosts') refreshLandingOptions();
        if (key === 'languageSwitcher') refreshLanguageAvailabilityWarnings();
        updateHomeWarning();
        markDirty();
      });
      sync();
    });
    section.appendChild(homeWarning);
    updateHomeWarning();
  };

  const renderThemeGrid = (section) => {
    const { addRow } = createSingleGridFieldset(section);
    const rows = [];
    let themeSettingsRenderToken = 0;
    const addThemeRow = (item) => {
      const row = addRow(item, rows.length);
      rows.push(row);
      return row;
    };

    const createSelectRow = (item) => {
      const { controlCell, controlId } = addThemeRow(item);
      const select = documentRef.createElement('select');
      select.id = controlId;
      select.className = 'cs-select';
      select.dataset.field = item.dataKey;
      (item.options || []).forEach((opt) => {
        const option = documentRef.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      });

      const ensureSelection = () => {
        const options = Array.from(select.options);
        if (!options.length) {
          const currentRaw = item.get();
          const current = currentRaw == null ? '' : String(currentRaw);
          if (current) select.value = current;
          return current;
        }
        const available = new Set(options.map((opt) => opt.value));
        const currentRaw = item.get();
        const current = currentRaw == null ? '' : String(currentRaw);
        if (current && available.has(current)) {
          select.value = current;
          return current;
        }
        const fallback = item.defaultValue != null && available.has(item.defaultValue)
          ? item.defaultValue
          : (options.length ? options[0].value : '');
        select.value = fallback;
        if (fallback && fallback !== current) {
          item.set(fallback);
          markDirty();
        } else if (!fallback && current) {
          item.set('');
          markDirty();
        }
        return fallback;
      };

      ensureSelection();
      select.addEventListener('change', () => {
        item.set(select.value);
        markDirty();
      });
      controlCell.appendChild(select);
      return select;
    };

    createSelectRow({
      dataKey: 'themeMode',
      label: t('editor.composer.site.fields.themeMode'),
      description: t('editor.composer.site.fields.themeModeHelp'),
      get: () => site.themeMode || '',
      set: (value) => { site.themeMode = value == null ? '' : value; },
      defaultValue: 'auto',
      options: [
        { value: 'user', label: 'user' },
        { value: 'auto', label: 'auto' },
        { value: 'light', label: 'light' },
        { value: 'dark', label: 'dark' }
      ]
    });

    const sanitizeThemePackValue = (value) => {
      return safeString(value).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    };
    const normalizeThemePackList = (list) => {
      const normalized = [];
      const seen = new Set();
      (Array.isArray(list) ? list : []).forEach((item) => {
        if (!item) return;
        const packValue = sanitizeThemePackValue(item.value);
        if (!packValue || seen.has(packValue)) return;
        seen.add(packValue);
        normalized.push({
          value: packValue,
          label: safeString(item.label || item.value || packValue) || packValue
        });
      });
      return normalized;
    };

    const themePackSelect = createSelectRow({
      dataKey: 'themePack',
      label: t('editor.composer.site.fields.themePack'),
      description: t('editor.composer.site.fields.themePackHelp'),
      get: () => sanitizeThemePackValue(site.themePack),
      set: (value) => { site.themePack = sanitizeThemePackValue(value); },
      defaultValue: 'native',
      options: []
    });

    const themeSettingsBlock = documentRef.createElement('div');
    themeSettingsBlock.className = 'cs-theme-settings';
    themeSettingsBlock.hidden = true;

    const clearThemeSettingsBlock = () => {
      themeSettingsBlock.innerHTML = '';
      themeSettingsBlock.hidden = true;
    };

    const appendThemeSettingsMessage = (message) => {
      themeSettingsBlock.innerHTML = '';
      const note = documentRef.createElement('p');
      note.className = 'cs-field-help cs-theme-settings-warning';
      note.textContent = message;
      themeSettingsBlock.appendChild(note);
      themeSettingsBlock.hidden = false;
    };

    const colorInputValue = (value) => {
      const color = safeString(value).trim();
      const short = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
      if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
      return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#000000';
    };

    const appendThemeSettingsHeader = (pack, manifest, warningCount) => {
      const head = documentRef.createElement('div');
      head.className = 'cs-config-subsection-head';
      const title = documentRef.createElement('div');
      title.className = 'cs-config-subsection-title';
      title.textContent = 'Current theme settings';
      head.appendChild(title);
      const desc = documentRef.createElement('p');
      desc.className = 'cs-config-subsection-description';
      const label = safeString(manifest && manifest.name ? manifest.name : pack) || pack;
      desc.textContent = warningCount
        ? `${label}: ${warningCount} setting warning${warningCount === 1 ? '' : 's'}`
        : label;
      head.appendChild(desc);
      themeSettingsBlock.appendChild(head);
    };

    const renderThemeSettingsFields = (pack, manifest, resolution) => {
      themeSettingsBlock.innerHTML = '';
      const fields = Array.isArray(resolution.fields) ? resolution.fields : [];
      const warnings = Array.isArray(resolution.warnings) ? resolution.warnings : [];
      if (!fields.length && !warnings.length) {
        clearThemeSettingsBlock();
        return;
      }
      appendThemeSettingsHeader(pack, manifest, warnings.length);
      if (warnings.length) {
        const warningList = documentRef.createElement('ul');
        warningList.className = 'cs-extra-list';
        warnings.slice(0, 5).forEach((entry) => {
          const item = documentRef.createElement('li');
          item.textContent = entry && entry.message ? entry.message : String(entry || '');
          warningList.appendChild(item);
        });
        themeSettingsBlock.appendChild(warningList);
      }
      if (fields.length) {
        const { addRow: addSettingRow } = createSingleGridFieldset(themeSettingsBlock);
        fields.forEach((field, index) => {
          const rowConfig = {
            dataKey: `themeSettings-${field.key}`,
            label: field.label || field.key,
            description: field.description || field.key
          };
          const { row, controlCell, controlId } = addSettingRow(rowConfig, index);
          row.dataset.field = 'themeSettings';
          row.dataset.subfield = field.key;
          const currentValue = Object.prototype.hasOwnProperty.call(resolution.settings || {}, field.key)
            ? resolution.settings[field.key]
            : field.defaultValue;
          const commitValue = (value) => {
            const changed = setThemeSettingOverride(site, pack, field.key, value, field);
            if (changed) markDirty();
          };

          if (field.control === 'boolean') {
            const { toggle, checkbox } = createSwitchControl(row, field.label || field.key, {
              target: controlCell,
              classes: ['cs-single-grid-switch']
            });
            toggle.dataset.field = 'themeSettings';
            toggle.dataset.subfield = field.key;
            const initial = currentValue === true;
            syncSwitchState(checkbox, toggle, initial, false);
            checkbox.addEventListener('change', () => {
              commitValue(checkbox.checked);
              syncSwitchState(checkbox, toggle, checkbox.checked, false);
            });
            if (field.defaultValue === undefined) {
              const unsetButton = documentRef.createElement('button');
              unsetButton.type = 'button';
              unsetButton.className = 'btn-secondary btn-compact';
              unsetButton.dataset.field = 'themeSettings';
              unsetButton.dataset.subfield = field.key;
              unsetButton.textContent = 'Not set';
              unsetButton.addEventListener('click', () => {
                commitValue(undefined);
                syncSwitchState(checkbox, toggle, false, false);
              });
              controlCell.appendChild(unsetButton);
            }
            return;
          }

          if (field.control === 'select') {
            const select = documentRef.createElement('select');
            select.id = controlId;
            select.className = 'cs-select';
            select.dataset.field = 'themeSettings';
            select.dataset.subfield = field.key;
            const options = field.options || [];
            const currentSignature = themeSettingValueSignature(currentValue);
            let selectedOptionIndex = -1;
            if (field.defaultValue === undefined) {
              const unsetOption = documentRef.createElement('option');
              unsetOption.value = '';
              unsetOption.dataset.valueSignature = '';
              unsetOption.textContent = 'Not set';
              select.appendChild(unsetOption);
            }
            options.forEach((optionData, index) => {
              const option = documentRef.createElement('option');
              option.value = String(index);
              option.dataset.valueSignature = themeSettingValueSignature(optionData.value);
              option.textContent = safeString(optionData.label || optionData.value);
              if (option.dataset.valueSignature === currentSignature) selectedOptionIndex = index;
              select.appendChild(option);
            });
            if (selectedOptionIndex >= 0) select.value = String(selectedOptionIndex);
            else if (field.defaultValue === undefined) select.value = '';
            select.addEventListener('change', () => {
              if (select.value === '') {
                commitValue(undefined);
                return;
              }
              const selectedIndex = Number(select.value);
              const selected = Number.isInteger(selectedIndex) ? options[selectedIndex] : null;
              commitValue(selected ? selected.value : select.value);
            });
            controlCell.appendChild(select);
            return;
          }

          const input = documentRef.createElement('input');
          input.id = controlId;
          input.className = 'cs-input';
          input.dataset.field = 'themeSettings';
          input.dataset.subfield = field.key;
          if (field.control === 'color') {
            input.type = 'color';
            input.value = colorInputValue(currentValue);
          } else if (field.control === 'range') {
            input.type = 'range';
            if (field.minimum != null && !Number.isNaN(field.minimum)) input.min = String(field.minimum);
            if (field.maximum != null && !Number.isNaN(field.maximum)) input.max = String(field.maximum);
            if (field.step != null && !Number.isNaN(field.step)) input.step = String(field.step);
            input.value = currentValue == null ? '' : String(currentValue);
          } else if (field.control === 'number') {
            input.type = 'number';
            if (field.minimum != null && !Number.isNaN(field.minimum)) input.min = String(field.minimum);
            if (field.maximum != null && !Number.isNaN(field.maximum)) input.max = String(field.maximum);
            if (field.step != null && !Number.isNaN(field.step)) input.step = String(field.step);
            input.value = currentValue == null ? '' : String(currentValue);
          } else {
            input.type = 'text';
            input.value = currentValue == null ? '' : String(currentValue);
          }
          input.addEventListener('input', () => {
            const nextValue = (input.type === 'number' || input.type === 'range')
              ? (input.value === '' ? undefined : Number(input.value))
              : (field.control === 'text' && field.defaultValue === undefined && input.value === '' ? undefined : input.value);
            commitValue(nextValue);
          });
          controlCell.appendChild(input);
          if ((field.control === 'color' || field.control === 'range') && field.defaultValue === undefined) {
            const unsetButton = documentRef.createElement('button');
            unsetButton.type = 'button';
            unsetButton.className = 'btn-secondary btn-compact';
            unsetButton.dataset.field = 'themeSettings';
            unsetButton.dataset.subfield = field.key;
            unsetButton.textContent = 'Not set';
            unsetButton.addEventListener('click', () => commitValue(undefined));
            controlCell.appendChild(unsetButton);
          }
        });
      }
      themeSettingsBlock.hidden = false;
    };

    const renderThemeSettingsForCurrentPack = () => {
      const token = ++themeSettingsRenderToken;
      const pack = sanitizeThemeSlug(sanitizeThemePackValue(site.themePack || themePackSelect.value || 'native') || 'native');
      clearThemeSettingsBlock();
      if (!fetchContent) return;
      fetchContent(`assets/themes/${encodeURIComponent(pack)}/theme.json`, { cache: 'no-store' })
        .then((response) => {
          if (!response || !response.ok) throw new Error(`HTTP ${response && response.status ? response.status : 0}`);
          return response.json();
        })
        .then((manifest) => {
          if (token !== themeSettingsRenderToken) return;
          const resolution = resolveThemeSettings({ pack, manifest, siteConfig: site });
          renderThemeSettingsFields(pack, manifest, resolution);
        })
        .catch((err) => {
          if (token !== themeSettingsRenderToken) return;
          const message = err && err.message ? err.message : 'Theme manifest is unavailable.';
          appendThemeSettingsMessage(`Theme settings are unavailable for ${pack}: ${message}`);
        });
    };

    const fallbackThemePacks = [
      { value: 'native', label: 'Native' },
      { value: 'github', label: 'GitHub' },
      { value: 'apple', label: 'Apple' },
      { value: 'openai', label: 'OpenAI' }
    ];

    const applyThemePackOptions = (options) => {
      const normalized = normalizeThemePackList(options);
      const selectOptions = normalized.length ? normalized : normalizeThemePackList(fallbackThemePacks);
      const current = sanitizeThemePackValue(site.themePack);
      const seen = new Set();
      const appendOption = (value, label) => {
        const option = documentRef.createElement('option');
        option.value = value;
        option.textContent = safeString(label || value) || value;
        themePackSelect.appendChild(option);
        seen.add(value);
      };
      themePackSelect.innerHTML = '';
      let firstOption = null;
      selectOptions.forEach(({ value, label }) => {
        appendOption(value, label);
        if (firstOption == null) firstOption = value;
      });
      if (current && !seen.has(current)) {
        appendOption(current, current);
        if (firstOption == null) firstOption = current;
      }
      const nextValue = current && seen.has(current) ? current : firstOption || '';
      themePackSelect.value = nextValue;
      renderThemeSettingsForCurrentPack();
    };

    applyThemePackOptions(fallbackThemePacks);
    const themePackRequest = fetchContent
      ? fetchContent('assets/themes/packs.json', { cache: 'no-store' })
      : Promise.reject(new Error('Theme pack fetch is not available in this runtime.'));
    themePackRequest
      .then((response) => (response && response.ok ? response.json() : Promise.reject()))
      .then((list) => {
        if (!Array.isArray(list) || !normalizeThemePackList(list).length) throw new Error('empty theme pack list');
        applyThemePackOptions(list);
      })
      .catch(() => {
        applyThemePackOptions(fallbackThemePacks);
      });

    themePackSelect.addEventListener('change', () => {
      renderThemeSettingsForCurrentPack();
    });

    const manageThemesRow = addThemeRow({
      dataKey: 'manageThemes',
      label: 'Manage themes',
      description: 'Theme Manager.'
    });
    const manageThemesButton = documentRef.createElement('button');
    manageThemesButton.type = 'button';
    manageThemesButton.className = 'btn-secondary';
    manageThemesButton.textContent = 'Manage themes';
    manageThemesButton.addEventListener('click', () => applyMode('themes'));
    manageThemesRow.controlCell.appendChild(manageThemesButton);

    const { row, controlCell } = addThemeRow({
      dataKey: 'themeOverride',
      label: t('editor.composer.site.fields.themeOverride'),
      description: t('editor.composer.site.fields.themeOverrideHelp'),
      checkboxLabel: t('editor.composer.site.toggleEnabled')
    });
    const { toggle, checkbox } = createSwitchControl(row, t('editor.composer.site.toggleEnabled'), {
      target: controlCell,
      classes: ['cs-single-grid-switch']
    });
    toggle.dataset.field = 'themeOverride';
    checkbox.addEventListener('change', () => {
      site.themeOverride = checkbox.checked;
      syncSwitchState(checkbox, toggle, checkbox.checked, true);
      markDirty();
    });
    syncSwitchState(checkbox, toggle, site.themeOverride, true);
    section.appendChild(themeSettingsBlock);
    renderThemeSettingsForCurrentPack();
  };

  const renderAnnotateGrid = (section) => {
    const annotate = ensureAnnotate();
    const { addRow } = createSingleGridFieldset(section);
    const rows = [];
    const addAnnotateRow = (item) => {
      const row = addRow(item, rows.length);
      rows.push(row);
      return row;
    };

    const { row: enabledRow, controlCell: enabledControl } = addAnnotateRow({
      dataKey: 'annotate',
      label: t('editor.composer.site.fields.annotateEnabled'),
      description: t('editor.composer.site.fields.annotateEnabledHelp'),
      checkboxLabel: t('editor.composer.site.toggleEnabled')
    });
    const { toggle, checkbox } = createSwitchControl(
      enabledRow,
      t('editor.composer.site.toggleEnabled'),
      {
        target: enabledControl,
        classes: ['cs-single-grid-switch']
      }
    );
    toggle.dataset.field = 'annotate';
    toggle.dataset.subfield = 'enabled';
    checkbox.addEventListener('change', () => {
      annotate.enabled = checkbox.checked;
      syncSwitchState(checkbox, toggle, checkbox.checked, true);
      markDirty();
    });
    syncSwitchState(checkbox, toggle, annotate.enabled, true);

    const createTextRow = (item) => {
      const { controlCell, controlId } = addAnnotateRow(item);
      const input = documentRef.createElement('input');
      input.id = controlId;
      input.type = item.type || 'text';
      input.className = 'cs-input';
      input.dataset.field = 'annotate';
      input.dataset.subfield = item.subfield;
      input.value = item.get() || '';
      input.placeholder = item.placeholder || '';
      if (item.listId) input.setAttribute('list', item.listId);
      input.spellcheck = false;
      input.autocomplete = 'off';
      input.addEventListener('input', () => {
        item.set(input.value);
        markDirty();
      });
      controlCell.appendChild(input);
      if (item.listId && Array.isArray(item.options)) {
        const list = documentRef.createElement('datalist');
        list.id = item.listId;
        item.options.forEach((entry) => {
          const option = documentRef.createElement('option');
          option.value = entry.value;
          option.label = entry.label || entry.value;
          list.appendChild(option);
        });
        controlCell.appendChild(list);
      }
      return input;
    };

    createTextRow({
      dataKey: 'annotate',
      subfield: 'connectBaseUrl',
      label: t('editor.composer.site.fields.annotateConnectBaseUrl'),
      description: t('editor.composer.site.fields.annotateConnectBaseUrlHelp'),
      type: 'url',
      listId: 'siteAnnotateConnectBaseUrlPresets',
      options: connectPublishPresets,
      placeholder: connectPublishPresets[0]?.value || '',
      get: () => annotate.connectBaseUrl,
      set: (value) => { annotate.connectBaseUrl = value; }
    });

    createTextRow({
      dataKey: 'annotate',
      subfield: 'discussionCategory',
      label: t('editor.composer.site.fields.annotateDiscussionCategory'),
      description: t('editor.composer.site.fields.annotateDiscussionCategoryHelp'),
      listId: 'siteAnnotateDiscussionCategoryPresets',
      options: annotateDiscussionCategoryPresets,
      placeholder: 'General',
      get: () => annotate.discussionCategory,
      set: (value) => { annotate.discussionCategory = value; }
    });
  };

  const renderAssetWarningsGrid = (section) => {
    const warnings = ensureAssetWarnings();
    const { addRow } = createSingleGridFieldset(section);
    const rows = [];
    const addAssetRow = (item) => {
      const row = addRow(item, rows.length);
      rows.push(row);
      return row;
    };

    const { row: largeImageRow, controlCell: largeImageControl } = addAssetRow({
      dataKey: 'assetWarnings',
      label: t('editor.composer.site.fields.assetLargeImage'),
      description: t('editor.composer.site.fields.assetLargeImageHelp'),
      checkboxLabel: t('editor.composer.site.toggleEnabled')
    });
    const { toggle, checkbox } = createSwitchControl(
      largeImageRow,
      t('editor.composer.site.toggleEnabled'),
      {
        target: largeImageControl,
        classes: ['cs-single-grid-switch']
      }
    );
    toggle.dataset.field = 'assetWarnings';
    toggle.dataset.subfield = 'enabled';
    checkbox.addEventListener('change', () => {
      warnings.largeImage.enabled = checkbox.checked;
      syncSwitchState(checkbox, toggle, checkbox.checked, true);
      markDirty();
    });
    syncSwitchState(checkbox, toggle, warnings.largeImage.enabled, true);

    const { controlCell: thresholdControl, controlId: thresholdId } = addAssetRow({
      dataKey: 'assetWarnings',
      label: t('editor.composer.site.fields.assetLargeImageThreshold'),
      description: t('editor.composer.site.fields.assetLargeImageThresholdHelp')
    });
    const thresholdInput = documentRef.createElement('input');
    thresholdInput.id = thresholdId;
    thresholdInput.type = 'number';
    thresholdInput.className = 'cs-input';
    thresholdInput.dataset.field = 'assetWarnings';
    thresholdInput.dataset.subfield = 'thresholdKB';
    thresholdInput.min = '1';
    const threshold = warnings.largeImage.thresholdKB;
    thresholdInput.value = threshold != null && !Number.isNaN(threshold) ? String(threshold) : '';
    thresholdInput.addEventListener('input', () => {
      const raw = thresholdInput.value.trim();
      warnings.largeImage.thresholdKB = raw ? Number(raw) : null;
      markDirty();
    });
    thresholdControl.appendChild(thresholdInput);
  };

  return {
    renderPublicChromeGrid,
    renderAnnotateGrid,
    renderAssetWarningsGrid,
    renderBehaviorGrid,
    renderThemeGrid
  };
}
