import { createComposerSiteSettingsLanguageMenu } from './composer-site-settings-language-menu.js';

const noop = () => {};

const createDefaultEscapeHtml = () => (value) =>
  String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));

export function createComposerSiteSettingsLocalizedFields(options = {}) {
  const documentRef = options.documentRef || null;
  const site = options.site && typeof options.site === 'object' ? options.site : {};
  const state = options.state && typeof options.state === 'object' ? options.state : {};
  const createField = typeof options.createField === 'function' ? options.createField : noop;
  const createSubheadingField = typeof options.createSubheadingField === 'function' ? options.createSubheadingField : noop;
  const markDirty = typeof options.markDirty === 'function' ? options.markDirty : noop;
  const setTimer = typeof options.setTimer === 'function'
    ? options.setTimer
    : (handler, delay = 0) => {
      if ((Number(delay) || 0) <= 0 && typeof handler === 'function') handler();
      return null;
    };
  const languagePoolChangedEvent = options.languagePoolChangedEvent || 'press-composer-language-pool-changed';
  const preferredLangOrder = Array.isArray(options.preferredLangOrder) ? options.preferredLangOrder : [];
  const langCodePattern = options.langCodePattern || /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
  const normalizeLangCode = typeof options.normalizeLangCode === 'function'
    ? options.normalizeLangCode
    : (code) => String(code || '').trim().toLowerCase();
  const getAvailableLangs = typeof options.getAvailableLangs === 'function' ? options.getAvailableLangs : () => [];
  const displayLangName = typeof options.displayLangName === 'function' ? options.displayLangName : (code) => String(code || '').toUpperCase();
  const escapeHtml = typeof options.escapeHtml === 'function' ? options.escapeHtml : createDefaultEscapeHtml();
  const broadcastLanguagePoolChange = typeof options.broadcastLanguagePoolChange === 'function'
    ? options.broadcastLanguagePoolChange
    : noop;
  const registerLanguageMenuCleanup = typeof options.registerLanguageMenuCleanup === 'function'
    ? options.registerLanguageMenuCleanup
    : noop;
  const t = typeof options.t === 'function' ? options.t : (key) => key;

  const isLanguageCode = typeof options.isLanguageCode === 'function'
    ? options.isLanguageCode
    : (value) => {
      try { langCodePattern.lastIndex = 0; } catch (_) {}
      try { return langCodePattern.test(String(value || '').trim()); }
      catch (_) { return false; }
    };

  const sortLanguageCodes = (codes, options = {}) => {
    const ordered = Array.from(new Set((codes || []).filter(Boolean)));
    ordered.sort((a, b) => {
      if (options.defaultFirst !== false) {
        if (a === 'default') return -1;
        if (b === 'default') return 1;
      }
      const ia = preferredLangOrder.indexOf(a);
      const ib = preferredLangOrder.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        const pa = ia === -1 ? preferredLangOrder.length + 1 : ia;
        const pb = ib === -1 ? preferredLangOrder.length + 1 : ib;
        return pa - pb;
      }
      return a.localeCompare(b);
    });
    return ordered;
  };

  const sortLocalizedFieldLangs = (langs) => {
    const ordered = Array.from(new Set((langs || []).filter(Boolean)));
    ordered.sort((a, b) => {
      if (a === 'default') return -1;
      if (b === 'default') return 1;
      return a.localeCompare(b);
    });
    return ordered;
  };

  const ensureLocalized = (key, ensureDefault = true) => {
    if (!site[key] || typeof site[key] !== 'object') {
      site[key] = ensureDefault ? { default: '' } : {};
    }
    if (ensureDefault && !Object.prototype.hasOwnProperty.call(site[key], 'default')) site[key].default = '';
    return site[key];
  };

  const collectLanguageCodes = () => {
    const codes = new Set();
    const add = (value) => {
      const normalized = normalizeLangCode(value);
      if (!normalized) return;
      codes.add(normalized);
    };
    const addFromEntry = (entry) => {
      if (!entry || typeof entry !== 'object') return;
      Object.keys(entry).forEach((key) => {
        if (!isLanguageCode(key)) return;
        add(key);
      });
    };

    try {
      const langs = typeof getAvailableLangs === 'function' ? getAvailableLangs() : [];
      if (Array.isArray(langs)) langs.forEach(add);
    } catch (_) {}
    if (site && site.defaultLanguage) add(site.defaultLanguage);

    if (state && state.index && typeof state.index === 'object') {
      Object.keys(state.index).forEach((key) => {
        if (key === '__order') return;
        addFromEntry(state.index[key]);
      });
    }

    if (state && state.tabs && typeof state.tabs === 'object') {
      Object.keys(state.tabs).forEach((key) => {
        if (key === '__order') return;
        addFromEntry(state.tabs[key]);
      });
    }

    if (site && typeof site === 'object') {
      Object.keys(site).forEach((key) => {
        const value = site[key];
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        addFromEntry(value);
      });
    }

    return sortLanguageCodes(Array.from(codes), { defaultFirst: false });
  };

  const createLanguageMenu = (config = {}) => {
    const languageMenu = createComposerSiteSettingsLanguageMenu({
      documentRef,
      setTimer,
      languagePoolChangedEvent,
      preferredLangOrder,
      langCodePattern,
      normalizeLangCode,
      getAvailableLangs,
      collectLanguageCodes,
      displayLangName,
      escapeHtml,
      t,
      ...config
    });
    registerLanguageMenuCleanup(languageMenu.cleanup);
    return languageMenu;
  };

  const renderLocalizedField = (section, key, fieldOptions = {}) => {
    ensureLocalized(key, fieldOptions.ensureDefault !== false);
    const useLocalizedGrid = !!(fieldOptions.grid || fieldOptions.multiline);
    const field = fieldOptions.subheading
      ? createSubheadingField(section, {
        dataKey: key,
        label: fieldOptions.label,
        description: fieldOptions.description
      })
      : createField(section, {
        dataKey: key,
        label: fieldOptions.label,
        description: fieldOptions.description
      });
    const list = documentRef.createElement('div');
    list.className = useLocalizedGrid
      ? 'cs-localized-list cs-localized-list--grid'
      : 'cs-localized-list';
    field.appendChild(list);
    const controls = documentRef.createElement('div');
    controls.className = 'cs-field-controls';
    field.appendChild(controls);
    const languageMenu = createLanguageMenu({
      getUsedLangs: () => Object.keys(ensureLocalized(key, fieldOptions.ensureDefault !== false) || {}),
      onSelectLanguage: (code) => {
        const localized = ensureLocalized(key, fieldOptions.ensureDefault !== false);
        if (Object.prototype.hasOwnProperty.call(localized, code)) return false;
        localized[code] = '';
        markDirty();
        renderRows();
        broadcastLanguagePoolChange();
        return true;
      }
    });
    controls.appendChild(languageMenu.addWrap);

    const renderRows = () => {
      list.innerHTML = '';
      const localized = ensureLocalized(key, fieldOptions.ensureDefault !== false);
      const langs = Object.keys(localized || {});
      if (fieldOptions.ensureDefault !== false && !langs.includes('default')) langs.push('default');
      sortLocalizedFieldLangs(langs).forEach((lang) => {
        if (!localized && lang !== 'default') return;
        if (fieldOptions.ensureDefault !== false && !Object.prototype.hasOwnProperty.call(localized, lang)) localized[lang] = '';
        const row = documentRef.createElement('div');
        row.className = 'cs-localized-row';
        if (useLocalizedGrid) row.classList.add('cs-localized-row--grid');
        if (fieldOptions.multiline) row.classList.add('cs-localized-row--multiline');
        row.dataset.lang = lang;
        const badge = documentRef.createElement('span');
        badge.className = 'cs-lang-chip';
        badge.textContent = lang === 'default'
          ? t('editor.composer.site.languageDefault')
          : lang.toUpperCase();
        row.appendChild(badge);
        const inputWrap = documentRef.createElement('div');
        inputWrap.className = fieldOptions.multiline
          ? 'cs-localized-input cs-localized-input--multiline'
          : 'cs-localized-input';
        const input = documentRef.createElement(fieldOptions.multiline ? 'textarea' : 'input');
        if (!fieldOptions.multiline) input.type = 'text';
        else input.rows = fieldOptions.rows || 3;
        input.className = fieldOptions.multiline ? 'cs-input cs-localized-textarea' : 'cs-input';
        input.dataset.field = key;
        input.dataset.lang = lang;
        if (fieldOptions.placeholder) input.placeholder = fieldOptions.placeholder;
        input.value = localized[lang] || '';
        if (fieldOptions.multiline) {
          const expandMultiline = () => {
            list.querySelectorAll('.cs-localized-row--multiline.is-expanded').forEach((expandedRow) => {
              if (expandedRow !== row) expandedRow.classList.remove('is-expanded');
            });
            row.classList.add('is-expanded');
          };
          input.addEventListener('pointerdown', expandMultiline);
          input.addEventListener('focus', expandMultiline);
          input.addEventListener('focusin', expandMultiline);
          input.addEventListener('blur', () => {
            setTimer(() => {
              if (documentRef.activeElement !== input) row.classList.remove('is-expanded');
            }, 0);
          });
          input.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            row.classList.remove('is-expanded');
            input.blur();
          });
        }
        input.addEventListener('input', () => {
          ensureLocalized(key, fieldOptions.ensureDefault !== false)[lang] = input.value;
          markDirty();
        });
        inputWrap.appendChild(input);
        row.appendChild(inputWrap);
        if (lang !== 'default' || fieldOptions.allowDefaultDelete) {
          const removeBtn = documentRef.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn-tertiary cs-remove-lang';
          removeBtn.textContent = t('editor.composer.site.removeLanguage');
          removeBtn.addEventListener('click', () => {
            const localizedMap = ensureLocalized(key, fieldOptions.ensureDefault !== false);
            delete localizedMap[lang];
            markDirty();
            renderRows();
            broadcastLanguagePoolChange();
          });
          row.appendChild(removeBtn);
        }
        list.appendChild(row);
      });
      if (!list.children.length) {
        const empty = documentRef.createElement('div');
        empty.className = 'cs-empty';
        empty.textContent = t('editor.composer.site.noLanguages');
        list.appendChild(empty);
      }
      languageMenu.refreshMenu();
    };

    renderRows();
  };

  const renderIdentityLocalizedGrid = (section) => {
    const titleLabel = t('editor.composer.site.fields.siteTitle');
    const subtitleLabel = t('editor.composer.site.fields.siteSubtitle');
    ensureLocalized('siteTitle', true);
    ensureLocalized('siteSubtitle', true);
    const field = documentRef.createElement('div');
    field.className = 'cs-field cs-identity-fieldset';
    field.dataset.field = 'siteTitle|siteSubtitle';
    field.setAttribute('role', 'group');
    field.setAttribute('aria-label', `${titleLabel} / ${subtitleLabel}`);
    section.appendChild(field);
    const grid = documentRef.createElement('div');
    grid.className = 'cs-identity-grid';
    field.appendChild(grid);
    const controls = documentRef.createElement('div');
    controls.className = 'cs-field-controls';
    field.appendChild(controls);

    const collectUsedLangs = () => {
      const title = ensureLocalized('siteTitle', true);
      const subtitle = ensureLocalized('siteSubtitle', true);
      return sortLanguageCodes(['default', ...Object.keys(title || {}), ...Object.keys(subtitle || {})]);
    };

    const languageMenu = createLanguageMenu({
      getUsedLangs: collectUsedLangs,
      onSelectLanguage: (code) => {
        const title = ensureLocalized('siteTitle', true);
        const subtitle = ensureLocalized('siteSubtitle', true);
        let changed = false;
        if (!Object.prototype.hasOwnProperty.call(title, code)) {
          title[code] = '';
          changed = true;
        }
        if (!Object.prototype.hasOwnProperty.call(subtitle, code)) {
          subtitle[code] = '';
          changed = true;
        }
        if (!changed) return false;
        markDirty();
        renderRows();
        broadcastLanguagePoolChange();
        return true;
      }
    });
    controls.appendChild(languageMenu.addWrap);

    const appendHeader = () => {
      const header = documentRef.createElement('div');
      header.className = 'cs-identity-row cs-identity-head';
      const langSpacer = documentRef.createElement('span');
      langSpacer.className = 'cs-identity-head-spacer';
      langSpacer.setAttribute('aria-hidden', 'true');
      const titleHead = documentRef.createElement('span');
      titleHead.className = 'cs-identity-column-title';
      titleHead.textContent = titleLabel;
      const subtitleHead = documentRef.createElement('span');
      subtitleHead.className = 'cs-identity-column-title';
      subtitleHead.textContent = subtitleLabel;
      const actionSpacer = documentRef.createElement('span');
      actionSpacer.className = 'cs-identity-head-spacer';
      actionSpacer.setAttribute('aria-hidden', 'true');
      header.append(langSpacer, titleHead, subtitleHead, actionSpacer);
      grid.appendChild(header);
    };

    const appendInput = (row, lang, key, labelText, value) => {
      const cell = documentRef.createElement('label');
      cell.className = 'cs-identity-field';
      const mobileLabel = documentRef.createElement('span');
      mobileLabel.className = 'cs-identity-cell-label';
      mobileLabel.textContent = labelText;
      const input = documentRef.createElement('input');
      input.type = 'text';
      input.className = 'cs-input';
      input.dataset.field = key;
      input.dataset.lang = lang;
      input.dataset.subfield = key;
      input.dataset.siteIdentityField = key;
      input.value = value || '';
      input.addEventListener('input', () => {
        ensureLocalized(key, true)[lang] = input.value;
        markDirty();
      });
      cell.append(mobileLabel, input);
      row.appendChild(cell);
    };

    const renderRows = () => {
      grid.innerHTML = '';
      appendHeader();
      const title = ensureLocalized('siteTitle', true);
      const subtitle = ensureLocalized('siteSubtitle', true);
      const langs = collectUsedLangs();
      langs.forEach((lang) => {
        if (!Object.prototype.hasOwnProperty.call(title, lang)) title[lang] = '';
        if (!Object.prototype.hasOwnProperty.call(subtitle, lang)) subtitle[lang] = '';
        const row = documentRef.createElement('div');
        row.className = 'cs-identity-row';
        row.dataset.lang = lang;
        const langCell = documentRef.createElement('div');
        langCell.className = 'cs-identity-lang';
        const badge = documentRef.createElement('span');
        badge.className = 'cs-lang-chip';
        badge.textContent = lang === 'default'
          ? t('editor.composer.site.languageDefault')
          : lang.toUpperCase();
        langCell.appendChild(badge);
        row.appendChild(langCell);
        appendInput(row, lang, 'siteTitle', titleLabel, title[lang] || '');
        appendInput(row, lang, 'siteSubtitle', subtitleLabel, subtitle[lang] || '');
        const actions = documentRef.createElement('div');
        actions.className = 'cs-identity-actions';
        if (lang !== 'default') {
          const removeBtn = documentRef.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'btn-tertiary cs-remove-lang cs-identity-remove';
          removeBtn.textContent = t('editor.composer.site.removeLanguage');
          removeBtn.addEventListener('click', () => {
            const titleMapNext = ensureLocalized('siteTitle', true);
            const subtitleMapNext = ensureLocalized('siteSubtitle', true);
            delete titleMapNext[lang];
            delete subtitleMapNext[lang];
            markDirty();
            renderRows();
            broadcastLanguagePoolChange();
          });
          actions.appendChild(removeBtn);
        }
        row.appendChild(actions);
        grid.appendChild(row);
      });
      languageMenu.refreshMenu();
    };

    renderRows();
  };

  return {
    collectLanguageCodes,
    renderIdentityLocalizedGrid,
    renderLocalizedField
  };
}
