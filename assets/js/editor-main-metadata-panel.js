import { normalizeDateInputValue } from './editor-markdown-ops.js';
import {
  FRONT_MATTER_FIELD_DEFS,
  buildMarkdownWithFrontMatter,
  cloneFrontMatterData,
  parseMarkdownFrontMatter,
  resolveFrontMatterBindings,
  valueIsPresent
} from './frontmatter-document.js?v=press-system-v3.4.52';

const fallbackTranslate = (key) => key;
const fallbackGetCurrentLang = () => 'en';
const fallbackNormalizeLangKey = (value) => String(value || '').trim().toLowerCase();
const fallbackGetContentRoot = () => 'wwwroot';

const FRONT_MATTER_SECTION_DESCRIPTIONS = [
  {
    selector: '#frontMatterCommonSection .frontmatter-section-description',
    key: 'editor.frontMatter.commonDescription',
    fallback: {
      en: 'Metadata used by cards, SEO, and article lists.',
      chs: '用于卡片、SEO 与文章列表的常用元数据。',
      'cht-tw': '用於卡片、SEO 與文章列表的常用中繼資料。',
      'cht-hk': '用於卡片、SEO 與文章列表的常用中繼資料。',
      ja: 'カード、SEO、記事一覧で使う基本メタデータ。'
    }
  },
  {
    selector: '#frontMatterExtraSection .frontmatter-section-description',
    key: 'editor.frontMatter.advancedDescription',
    fallback: {
      en: 'Supplemental metadata for sharing images, version badges, and AI labels.',
      chs: '用于分享图片、版本徽标和 AI 标记的补充元数据。',
      'cht-tw': '用於分享圖片、版本徽章與 AI 標記的補充中繼資料。',
      'cht-hk': '用於分享圖片、版本徽章與 AI 標記的補充中繼資料。',
      ja: '共有画像、バージョンバッジ、AI ラベル用の補足メタデータ。'
    }
  }
];

const ensureKeyOrder = (order = [], key) => {
  if (!key) return order;
  if (!order.includes(key)) order.push(key);
  return order;
};

function fallbackElementById(documentRef, id) {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

function createElement(documentRef, tagName) {
  if (!documentRef || typeof documentRef.createElement !== 'function') return null;
  return documentRef.createElement(tagName);
}

export function createEditorMainMetadataPanel(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const getElementById = (id) => (
    typeof runtime.getElementById === 'function'
      ? runtime.getElementById(id)
      : fallbackElementById(documentRef, id)
  );
  const querySelector = (selector) => (
    documentRef && typeof documentRef.querySelector === 'function'
      ? documentRef.querySelector(selector)
      : null
  );
  const requestFrame = (fn) => (
    typeof runtime.requestFrame === 'function'
      ? runtime.requestFrame(fn)
      : 0
  );
  const cancelFrame = (id) => {
    if (!id) return;
    if (typeof runtime.cancelFrame === 'function') {
      runtime.cancelFrame(id);
      return;
    }
  };
  const translateImpl = typeof options.translate === 'function' ? options.translate : fallbackTranslate;
  const getCurrentLang = typeof options.getCurrentLang === 'function' ? options.getCurrentLang : fallbackGetCurrentLang;
  const normalizeLang = typeof options.normalizeLangKey === 'function' ? options.normalizeLangKey : fallbackNormalizeLangKey;
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : fallbackGetContentRoot;
  const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
  const getComputedStyleRef = typeof options.getComputedStyle === 'function'
    ? options.getComputedStyle
    : (typeof runtime.getComputedStyle === 'function' ? runtime.getComputedStyle : null);
  const ResizeObserverRef = options.ResizeObserver || (
    typeof runtime.getResizeObserver === 'function' ? runtime.getResizeObserver() : null
  );

  const translate = (key, fallback) => {
    if (!key) return fallback;
    const translated = translateImpl(key);
    if (translated == null || translated === key) return fallback != null ? fallback : key;
    return translated;
  };

  const translateWithLocaleFallback = (key, fallbacks = {}) => {
    const translated = translate(key, null);
    if (translated != null && translated !== key) return translated;
    let lang;
    try {
      lang = normalizeLang(getCurrentLang()) || 'en';
    } catch (_) {
      lang = 'en';
    }
    if (fallbacks[lang]) return fallbacks[lang];
    if (lang === 'cht-hk' && fallbacks['cht-tw']) return fallbacks['cht-tw'];
    if (lang.startsWith('cht') && fallbacks['cht-tw']) return fallbacks['cht-tw'];
    if (lang.startsWith('ch') && fallbacks.chs) return fallbacks.chs;
    if (lang.startsWith('ja') && fallbacks.ja) return fallbacks.ja;
    return fallbacks.en || key;
  };

  function syncFrontMatterLabelWidth(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    try {
      if (typeof root.__pressFrontMatterLabelWidthCleanup === 'function') root.__pressFrontMatterLabelWidthCleanup();
    } catch (_) {}
    try { root.__pressFrontMatterLabelWidthCleanup = null; } catch (_) {}

    const labels = Array.from(root.querySelectorAll('.frontmatter-field-title'));
    if (!labels.length) {
      try { root.style.removeProperty('--frontmatter-single-label-width'); } catch (_) {}
      return;
    }

    let frame = 0;
    let observer = null;
    const measureLabelText = (label) => {
      let width = label.scrollWidth || 0;
      try {
        const doc = documentRef;
        if (!doc || !doc.body) return width;
        const probe = doc.createElement('span');
        probe.textContent = label.textContent || '';
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.pointerEvents = 'none';
        probe.style.whiteSpace = 'nowrap';
        probe.style.left = '-9999px';
        probe.style.top = '0';
        const sourceStyle = getComputedStyleRef ? getComputedStyleRef(label) : null;
        if (sourceStyle) {
          probe.style.fontFamily = sourceStyle.fontFamily;
          probe.style.fontSize = sourceStyle.fontSize;
          probe.style.fontStyle = sourceStyle.fontStyle;
          probe.style.fontWeight = sourceStyle.fontWeight;
          probe.style.letterSpacing = sourceStyle.letterSpacing;
          probe.style.textTransform = sourceStyle.textTransform;
        }
        doc.body.appendChild(probe);
        width = Math.max(width, probe.scrollWidth || Math.ceil(probe.getBoundingClientRect().width) || 0);
        probe.remove();
      } catch (_) {}
      return width;
    };
    const measure = () => {
      frame = 0;
      let width = 88;
      labels.forEach((label) => {
        const target = label.closest ? label.closest('.frontmatter-field-label-wrap') : label;
        let measured = 0;
        try {
          const tooltip = target && target.querySelector ? target.querySelector('.frontmatter-help-tooltip') : null;
          const tooltipWidth = tooltip ? tooltip.scrollWidth || 0 : 0;
          const labelWidth = measureLabelText(label);
          const targetStyle = getComputedStyleRef ? getComputedStyleRef(target || label) : null;
          const gap = targetStyle ? parseFloat(targetStyle.gap || targetStyle.columnGap || '0') || 0 : 0;
          measured = labelWidth + tooltipWidth + gap;
        } catch (_) {
          try {
            const tooltip = target && target.querySelector ? target.querySelector('.frontmatter-help-tooltip') : null;
            measured = measureLabelText(label) + (tooltip ? tooltip.scrollWidth || 0 : 0);
          } catch (_) {}
        }
        width = Math.max(width, measured);
      });
      try { root.style.setProperty('--frontmatter-single-label-width', `${Math.ceil(width)}px`); } catch (_) {}
    };
    const schedule = () => {
      if (frame) return;
      frame = requestFrame(measure);
    };

    if (typeof ResizeObserverRef === 'function') {
      try {
        observer = new ResizeObserverRef(schedule);
        observer.observe(root);
        labels.forEach((label) => {
          const cell = label.closest ? label.closest('.frontmatter-field-label-wrap') : label;
          observer.observe(cell || label);
        });
      } catch (_) {
        observer = null;
      }
    }

    try {
      const fonts = documentRef && documentRef.fonts;
      if (fonts && typeof fonts.ready?.then === 'function') fonts.ready.then(schedule).catch(() => {});
    } catch (_) {}
    schedule();

    root.__pressFrontMatterLabelWidthCleanup = () => {
      cancelFrame(frame);
      frame = 0;
      try { if (observer) observer.disconnect(); } catch (_) {}
      observer = null;
    };
  }

  const createFrontMatterManager = () => {
    const panel = getElementById('frontMatterPanel');
    if (!panel) return null;

    const commonFieldsEl = getElementById('frontMatterCommonFields');
    const extraSection = getElementById('frontMatterExtraSection');
    const extraFieldsEl = getElementById('frontMatterExtraFields');
    const emptyEl = getElementById('frontMatterEmpty');
    const registry = new Map();

    let state = {
      data: {},
      order: [],
      eol: '\n',
      trailingNewline: false,
      bindings: new Map(),
      hasFrontMatter: false,
      document: null
    };
    let suppressEvents = false;
    let changeHandler = () => {};

    const applySectionDescriptions = () => {
      FRONT_MATTER_SECTION_DESCRIPTIONS.forEach((item) => {
        const el = item && item.selector ? querySelector(item.selector) : null;
        if (!el) return;
        el.textContent = translateWithLocaleFallback(item.key, item.fallback);
      });
    };

    const normalizeListInput = (value) => {
      if (Array.isArray(value)) {
        return value
          .map((item) => String(item == null ? '' : item).trim())
          .filter(Boolean);
      }
      return String(value == null ? '' : value)
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);
    };

    const setEntryKey = (entry, key) => {
      if (!entry) return;
      const actual = key || entry.key || (entry.def && entry.def.keys ? entry.def.keys[0] : '');
      entry.key = actual;
      entry.container.dataset.key = actual;
    };

    const syncBooleanControl = (entry, value) => {
      if (!entry || !entry.input || entry.type !== 'boolean') return;
      const checked = value === true;
      entry.input.indeterminate = false;
      entry.input.checked = checked;
      entry.input.setAttribute('aria-checked', checked ? 'true' : 'false');
      if (entry.switchEl) entry.switchEl.dataset.state = checked ? 'on' : 'off';
    };

    const updateFieldEmptyState = (entry) => {
      if (!entry) return;
      const value = state.data[entry.key];
      const empty = !valueIsPresent(value);
      entry.container.dataset.empty = empty ? 'true' : 'false';
      if (!entry.input) return;
      if (entry.type === 'boolean') syncBooleanControl(entry, value);
    };

    const applyValueToEntry = (entry, value) => {
      if (!entry || !entry.input) return;
      suppressEvents = true;
      try {
        if (entry.type === 'boolean') {
          syncBooleanControl(entry, value);
        } else if (entry.type === 'list') {
          const list = Array.isArray(value)
            ? value.map((item) => String(item == null ? '' : item)).filter(Boolean)
            : normalizeListInput(value).map((item) => String(item == null ? '' : item));
          entry.input.value = list.join('\n');
        } else if (entry.type === 'textarea') {
          entry.input.value = value == null ? '' : String(value);
        } else if (entry.type === 'date') {
          entry.input.value = normalizeDateInputValue(value);
        } else {
          entry.input.value = value == null ? '' : String(value);
        }
      } finally {
        suppressEvents = false;
      }
      updateFieldEmptyState(entry);
    };

    const getAlternateAliasKeys = (entry) => {
      if (!entry || !entry.def || !Array.isArray(entry.def.keys)) return [];
      return entry.def.keys.filter((key) => (
        key
        && key !== entry.key
        && Object.prototype.hasOwnProperty.call(state.data, key)
        && valueIsPresent(state.data[key])
      ));
    };

    const updateSummary = () => {
      let count = 0;
      registry.forEach((entry) => {
        if (entry && valueIsPresent(state.data[entry.key])) count += 1;
      });
      if (emptyEl) emptyEl.hidden = count !== 0;
    };

    const triggerChange = () => {
      updateSummary();
      try { changeHandler(); } catch (_) {}
    };

    const rebuildBindings = () => {
      const bindings = resolveFrontMatterBindings(state.data, state.document);
      state.bindings = bindings;
      registry.forEach((entry, defId) => {
        const nextKey = bindings.get(defId) || entry.def.keys[0];
        setEntryKey(entry, nextKey);
        applyValueToEntry(entry, state.data[nextKey]);
      });
      updateSummary();
      syncFrontMatterLabelWidth(panel);
    };

    const setDataValue = (entry, rawValue, opts = {}) => {
      if (!entry) return;
      const key = entry.key;
      if (!key) return;
      if (entry.type === 'boolean') {
        if (rawValue == null) delete state.data[key];
        else state.data[key] = Boolean(rawValue);
      } else if (entry.type === 'list') {
        const list = normalizeListInput(rawValue);
        if (list.length) state.data[key] = list;
        else delete state.data[key];
      } else {
        const str = rawValue == null ? '' : String(rawValue);
        if (str.trim() === '') delete state.data[key];
        else state.data[key] = str;
      }
      if (valueIsPresent(state.data[key])) ensureKeyOrder(state.order, key);
      const shouldRebind = !valueIsPresent(state.data[key]) && getAlternateAliasKeys(entry).length > 0;
      if (shouldRebind) rebuildBindings();
      else updateFieldEmptyState(entry);
      if (!opts.silent) triggerChange();
    };

    const handleInputEvent = (entry) => {
      if (!entry || !entry.input || suppressEvents) return;
      if (entry.type === 'boolean') {
        syncBooleanControl(entry, entry.input.checked);
        setDataValue(entry, entry.input.checked);
      } else {
        setDataValue(entry, entry.input.value);
      }
    };

    const createField = (def, fieldOptions = {}) => {
      const container = createElement(documentRef, 'div');
      if (!container) return null;
      const entry = {
        id: def.id,
        def,
        type: fieldOptions.typeOverride || def.type || 'text',
        section: def.section || 'common',
        container,
        input: null,
        switchEl: null,
        key: def.keys[0]
      };

      const fieldClasses = ['frontmatter-field', `frontmatter-field-${entry.type}`];
      if (def.hintKey) fieldClasses.push('frontmatter-field-inline-help');
      if (entry.type === 'textarea' || entry.type === 'list') fieldClasses.push('frontmatter-field-multiline');
      entry.container.className = fieldClasses.join(' ');
      entry.container.dataset.fieldId = entry.id;
      entry.container.dataset.section = entry.section;

      const head = createElement(documentRef, 'div');
      head.className = 'frontmatter-field-head';
      const labelWrap = createElement(documentRef, 'div');
      labelWrap.className = 'frontmatter-field-label-wrap';
      const labelSpan = createElement(documentRef, 'span');
      labelSpan.className = 'frontmatter-field-title';
      if (def.labelKey) labelSpan.dataset.i18n = def.labelKey;
      labelSpan.textContent = translate(def.labelKey, def.fallbackLabel || def.keys[0]);
      labelWrap.appendChild(labelSpan);
      if (def.hintKey) {
        const hintText = translate(def.hintKey, '');
        const tooltipId = `frontmatter-help-${entry.id}`;
        const tooltipWrap = createElement(documentRef, 'span');
        tooltipWrap.className = 'frontmatter-help-tooltip-wrap';
        const tooltip = createElement(documentRef, 'button');
        tooltip.type = 'button';
        tooltip.className = 'frontmatter-help-tooltip';
        tooltip.textContent = '?';
        tooltip.setAttribute('aria-label', `${labelSpan.textContent}: ${hintText}`);
        tooltip.setAttribute('aria-describedby', tooltipId);
        const tooltipBubble = createElement(documentRef, 'span');
        tooltipBubble.id = tooltipId;
        tooltipBubble.className = 'frontmatter-help-tooltip-bubble';
        tooltipBubble.setAttribute('role', 'tooltip');
        tooltipBubble.textContent = hintText;
        tooltipBubble.dataset.i18n = def.hintKey;
        tooltipWrap.appendChild(tooltip);
        tooltipWrap.appendChild(tooltipBubble);
        labelWrap.appendChild(tooltipWrap);
      }
      head.appendChild(labelWrap);
      entry.container.appendChild(head);

      const controls = createElement(documentRef, 'div');
      controls.className = 'frontmatter-field-controls';
      if (entry.type === 'boolean') {
        const wrap = createElement(documentRef, 'label');
        wrap.className = 'frontmatter-switch';
        wrap.dataset.state = 'off';
        const checkbox = createElement(documentRef, 'input');
        checkbox.type = 'checkbox';
        checkbox.className = 'frontmatter-switch-input';
        checkbox.setAttribute('role', 'switch');
        checkbox.setAttribute('aria-checked', 'false');
        checkbox.setAttribute('aria-label', labelSpan.textContent || translate(def.labelKey, def.fallbackLabel || def.keys[0]));
        const track = createElement(documentRef, 'span');
        track.className = 'frontmatter-switch-track';
        const thumb = createElement(documentRef, 'span');
        thumb.className = 'frontmatter-switch-thumb';
        track.appendChild(thumb);
        wrap.appendChild(checkbox);
        wrap.appendChild(track);
        entry.input = checkbox;
        entry.switchEl = wrap;
        controls.appendChild(wrap);
      } else if (entry.type === 'textarea') {
        const textarea = createElement(documentRef, 'textarea');
        textarea.rows = 3;
        entry.input = textarea;
        controls.appendChild(textarea);
      } else if (entry.type === 'list') {
        const textarea = createElement(documentRef, 'textarea');
        textarea.classList.add('frontmatter-list-input');
        textarea.rows = 4;
        entry.input = textarea;
        controls.appendChild(textarea);
      } else if (entry.type === 'date') {
        const input = createElement(documentRef, 'input');
        input.type = 'date';
        entry.input = input;
        controls.appendChild(input);
      } else {
        const input = createElement(documentRef, 'input');
        input.type = 'text';
        entry.input = input;
        controls.appendChild(input);
      }

      entry.container.appendChild(controls);
      const actualKey = fieldOptions.key || def.keys[0];
      setEntryKey(entry, actualKey);
      if (entry.input) {
        const handler = () => handleInputEvent(entry);
        entry.input.addEventListener(entry.type === 'boolean' ? 'change' : 'input', handler);
      }
      return entry;
    };

    const ensureBaseFields = () => {
      if (registry.size) return;
      if (panel.dataset.state === 'loading') panel.dataset.state = 'ready';
      FRONT_MATTER_FIELD_DEFS.forEach((def) => {
        if (def && def.hidden) return;
        const entry = createField(def, { key: def.keys[0] });
        if (!entry) return;
        registry.set(def.id, entry);
        const parent = entry.section === 'advanced' ? extraFieldsEl : commonFieldsEl;
        if (parent) parent.appendChild(entry.container);
      });
      if (extraSection) extraSection.hidden = false;
      syncFrontMatterLabelWidth(panel);
    };

    const setFromMarkdown = (raw, opts = {}) => {
      ensureBaseFields();
      const parsed = parseMarkdownFrontMatter(raw);
      state = {
        data: cloneFrontMatterData(parsed.frontMatter),
        order: parsed.document && Array.isArray(parsed.document.knownOrder) ? [...parsed.document.knownOrder] : [],
        eol: parsed.eol || '\n',
        trailingNewline: !!parsed.trailingNewline,
        bindings: new Map(),
        hasFrontMatter: !!parsed.hasFrontMatter,
        document: parsed.document || null
      };
      rebuildBindings();
      if (!opts.silent) triggerChange();
      return parsed.content;
    };

    const buildMarkdown = (bodyRaw) => buildMarkdownWithFrontMatter(state.document, bodyRaw, state.data, {
      bindings: state.bindings,
      order: state.order,
      eol: state.eol,
      trailingNewline: state.trailingNewline
    });

    const clear = () => {
      state = {
        data: {},
        order: [],
        eol: '\n',
        trailingNewline: false,
        bindings: new Map(),
        hasFrontMatter: false,
        document: null
      };
      rebuildBindings();
    };

    ensureBaseFields();
    updateSummary();
    applySectionDescriptions();
    syncFrontMatterLabelWidth(panel);

    return {
      panel,
      setChangeHandler: (fn) => { changeHandler = typeof fn === 'function' ? fn : () => {}; },
      setFromMarkdown,
      buildMarkdown,
      clear,
      updateSummary,
      applySectionDescriptions,
      syncLabelWidth: () => syncFrontMatterLabelWidth(panel)
    };
  };

  const createTabsMetadataManager = () => {
    const panel = getElementById('frontMatterPanel');
    const body = getElementById('frontMatterBody');
    if (!panel || !body) return null;

    const section = createElement(documentRef, 'div');
    section.className = 'frontmatter-section';
    section.id = 'tabsMetadataSection';
    section.hidden = true;

    const head = createElement(documentRef, 'div');
    head.className = 'frontmatter-section-head';
    const title = createElement(documentRef, 'h3');
    title.className = 'frontmatter-section-title';
    title.textContent = translateWithLocaleFallback('editor.tabsMetadata.title', {
      en: 'Page attributes',
      chs: '页面属性',
      'cht-tw': '頁面屬性',
      'cht-hk': '頁面屬性',
      ja: 'ページ属性'
    });
    const description = createElement(documentRef, 'p');
    description.className = 'frontmatter-section-description';
    description.textContent = translateWithLocaleFallback('editor.tabsMetadata.description', {
      en: 'Metadata stored in tabs.yaml for the current page language.',
      chs: '当前页面语言在 tabs.yaml 中保存的元数据。',
      'cht-tw': '目前頁面語言在 tabs.yaml 中儲存的中繼資料。',
      'cht-hk': '目前頁面語言在 tabs.yaml 中儲存的中繼資料。',
      ja: '現在のページ言語について tabs.yaml に保存されるメタデータ。'
    });
    head.append(title, description);

    const grid = createElement(documentRef, 'div');
    grid.className = 'frontmatter-grid';
    const field = createElement(documentRef, 'div');
    field.className = 'frontmatter-field frontmatter-field-text';
    field.dataset.fieldId = 'tabs-title';
    const fieldHead = createElement(documentRef, 'div');
    fieldHead.className = 'frontmatter-field-head';
    const labelWrap = createElement(documentRef, 'div');
    labelWrap.className = 'frontmatter-field-label-wrap';
    const label = createElement(documentRef, 'span');
    label.className = 'frontmatter-field-title';
    label.textContent = translateWithLocaleFallback('editor.tabsMetadata.fields.title', {
      en: 'Title',
      chs: '标题',
      'cht-tw': '標題',
      'cht-hk': '標題',
      ja: 'タイトル'
    });
    labelWrap.appendChild(label);
    fieldHead.appendChild(labelWrap);

    const controls = createElement(documentRef, 'div');
    controls.className = 'frontmatter-field-controls';
    const input = createElement(documentRef, 'input');
    input.type = 'text';
    controls.appendChild(input);
    field.append(fieldHead, controls);
    grid.appendChild(field);
    section.append(head, grid);
    body.appendChild(section);
    syncFrontMatterLabelWidth(panel);

    let suppressEvents = false;
    let changeHandler = () => {};
    let state = { title: '' };
    const getState = () => ({ title: state.title || '' });
    const emitChange = () => {
      try { changeHandler(getState()); } catch (_) {}
    };

    input.addEventListener('input', () => {
      if (suppressEvents) return;
      state = { title: input.value };
      emitChange();
    });

    return {
      panel,
      section,
      setVisible: (visible) => {
        section.hidden = !visible;
      },
      setChangeHandler: (fn) => {
        changeHandler = typeof fn === 'function' ? fn : () => {};
      },
      setValue: (value, opts = {}) => {
        const nextTitle = value && typeof value === 'object'
          ? String(value.title || '')
          : String(value || '');
        state = { title: nextTitle };
        suppressEvents = true;
        try {
          input.value = nextTitle;
        } finally {
          suppressEvents = false;
        }
        if (!opts.silent) emitChange();
      }
    };
  };

  const frontMatterManager = createFrontMatterManager();
  const tabsMetadataManager = createTabsMetadataManager();
  const tabsMetadataChangeListeners = new Set();
  let frontMatterVisible = true;
  let tabsMetadataVisible = false;

  const updateMetadataPanelVisibility = () => {
    const panel = (frontMatterManager && frontMatterManager.panel) || (tabsMetadataManager && tabsMetadataManager.panel);
    if (!panel) return;
    const visible = !!frontMatterVisible || !!tabsMetadataVisible;
    panel.hidden = !visible;
    panel.dataset.state = visible ? 'ready' : 'hidden';
    panel.dataset.frontmatterVisible = frontMatterVisible ? 'true' : 'false';
    panel.dataset.tabsMetadataVisible = tabsMetadataVisible ? 'true' : 'false';
    panel.dataset.tabsVisible = tabsMetadataVisible ? 'true' : 'false';
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    panel.style.display = visible ? '' : 'none';
    if (tabsMetadataManager && typeof tabsMetadataManager.setVisible === 'function') {
      tabsMetadataManager.setVisible(tabsMetadataVisible);
    }
    syncFrontMatterLabelWidth(panel);
  };

  const normalizeCurrentFilePathForMode = (path) => {
    const raw = String(path || '').trim().replace(/\\+/g, '/').replace(/^\/+/, '');
    if (!raw) return '';
    const root = String(getContentRoot() || '')
      .trim()
      .replace(/\\+/g, '/')
      .replace(/^\/+|\/+$/g, '');
    if (root && raw.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
      return raw.slice(root.length + 1);
    }
    return raw;
  };

  const inferCurrentFileSource = (path) => {
    const normalized = normalizeCurrentFilePathForMode(path).toLowerCase();
    if (!normalized) return '';
    return normalized.startsWith('tab/') ? 'tabs' : '';
  };

  const setFrontMatterVisible = (visible) => {
    const nextVisible = !!visible;
    const shouldClear = !nextVisible && frontMatterVisible;
    frontMatterVisible = nextVisible;
    if (shouldClear && frontMatterManager && typeof frontMatterManager.clear === 'function') frontMatterManager.clear();
    const commonSection = getElementById('frontMatterCommonSection');
    const extraSection = getElementById('frontMatterExtraSection');
    if (commonSection) commonSection.hidden = !frontMatterVisible;
    if (extraSection) extraSection.hidden = !frontMatterVisible;
    updateMetadataPanelVisibility();
  };

  const setTabsMetadataVisible = (visible) => {
    tabsMetadataVisible = !!visible;
    updateMetadataPanelVisibility();
  };

  if (frontMatterManager) {
    frontMatterManager.setChangeHandler(() => {
      onChange();
    });
  }
  if (tabsMetadataManager) {
    tabsMetadataManager.setChangeHandler((value) => {
      tabsMetadataChangeListeners.forEach((fn) => {
        try { fn(value); } catch (_) {}
      });
    });
  }
  updateMetadataPanelVisibility();

  return {
    panel: (frontMatterManager && frontMatterManager.panel) || (tabsMetadataManager && tabsMetadataManager.panel) || null,
    frontMatterManager,
    tabsMetadataManager,
    inferCurrentFileSource,
    setFrontMatterVisible,
    setTabsMetadataVisible,
    applyCurrentFileSource: (source) => {
      const actual = String(source || '').trim().toLowerCase();
      setFrontMatterVisible(actual !== 'tabs');
      setTabsMetadataVisible(actual === 'tabs');
    },
    buildMarkdown: (body) => (frontMatterManager ? frontMatterManager.buildMarkdown(body) : body),
    buildEditorValue: (body) => (
      frontMatterVisible && frontMatterManager ? frontMatterManager.buildMarkdown(body) : body
    ),
    setEditorValue: (value, opts = {}) => (
      frontMatterVisible && frontMatterManager
        ? frontMatterManager.setFromMarkdown(value, opts)
        : String(value == null ? '' : value)
    ),
    syncLanguage: () => {
      if (!frontMatterManager) return;
      frontMatterManager.updateSummary();
      frontMatterManager.applySectionDescriptions();
      frontMatterManager.syncLabelWidth();
    },
    setTabsMetadata: (value, opts = {}) => {
      if (tabsMetadataManager && typeof tabsMetadataManager.setValue === 'function') {
        tabsMetadataManager.setValue(value, opts);
      }
    },
    onTabsMetadataChange: (fn) => {
      if (typeof fn !== 'function') return () => {};
      tabsMetadataChangeListeners.add(fn);
      return () => { tabsMetadataChangeListeners.delete(fn); };
    },
    isFrontMatterVisible: () => frontMatterVisible,
    isTabsMetadataVisible: () => tabsMetadataVisible
  };
}
