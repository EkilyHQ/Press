import { normalizeDateInputValue } from './editor-markdown-ops.js';
import {
  FRONT_MATTER_FIELD_DEFS,
  buildMarkdownWithFrontMatter,
  cloneFrontMatterData,
  parseMarkdownFrontMatter,
  resolveFrontMatterBindings,
  valueIsPresent
} from './frontmatter-document.js';

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

function createElement(documentRef, tagName) {
  if (!documentRef || typeof documentRef.createElement !== 'function') return null;
  return documentRef.createElement(tagName);
}

export function createEditorMainFrontMatterManager(options = {}) {
  const documentRef = options.documentRef || null;
  const getElementById = typeof options.getElementById === 'function' ? options.getElementById : () => null;
  const querySelector = typeof options.querySelector === 'function' ? options.querySelector : () => null;
  const translate = typeof options.translate === 'function' ? options.translate : ((key, fallback) => fallback || key);
  const translateWithLocaleFallback = typeof options.translateWithLocaleFallback === 'function'
    ? options.translateWithLocaleFallback
    : (key, fallbacks = {}) => fallbacks.en || key;
  const syncLabelWidth = typeof options.syncLabelWidth === 'function' ? options.syncLabelWidth : () => {};

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
    syncLabelWidth(panel);
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
    syncLabelWidth(panel);
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
  syncLabelWidth(panel);

  return {
    panel,
    setChangeHandler: (fn) => { changeHandler = typeof fn === 'function' ? fn : () => {}; },
    setFromMarkdown,
    buildMarkdown,
    clear,
    updateSummary,
    applySectionDescriptions,
    syncLabelWidth: () => syncLabelWidth(panel)
  };
}
