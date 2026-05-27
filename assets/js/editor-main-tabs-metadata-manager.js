const TABS_METADATA_TITLE_FALLBACK = {
  en: 'Page attributes',
  chs: '页面属性',
  'cht-tw': '頁面屬性',
  'cht-hk': '頁面屬性',
  ja: 'ページ属性'
};

const TABS_METADATA_DESCRIPTION_FALLBACK = {
  en: 'Metadata stored in tabs.yaml for the current page language.',
  chs: '当前页面语言在 tabs.yaml 中保存的元数据。',
  'cht-tw': '目前頁面語言在 tabs.yaml 中儲存的中繼資料。',
  'cht-hk': '目前頁面語言在 tabs.yaml 中儲存的中繼資料。',
  ja: '現在のページ言語について tabs.yaml に保存されるメタデータ。'
};

const TABS_METADATA_TITLE_FIELD_FALLBACK = {
  en: 'Title',
  chs: '标题',
  'cht-tw': '標題',
  'cht-hk': '標題',
  ja: 'タイトル'
};

function createElement(documentRef, tagName) {
  if (!documentRef || typeof documentRef.createElement !== 'function') return null;
  return documentRef.createElement(tagName);
}

export function createEditorMainTabsMetadataManager(options = {}) {
  const documentRef = options.documentRef || null;
  const getElementById = typeof options.getElementById === 'function' ? options.getElementById : () => null;
  const translateWithLocaleFallback = typeof options.translateWithLocaleFallback === 'function'
    ? options.translateWithLocaleFallback
    : (key, fallbacks = {}) => fallbacks.en || key;
  const syncLabelWidth = typeof options.syncLabelWidth === 'function' ? options.syncLabelWidth : () => {};

  const panel = getElementById('frontMatterPanel');
  const body = getElementById('frontMatterBody');
  if (!panel || !body) return null;

  const section = createElement(documentRef, 'div');
  const head = createElement(documentRef, 'div');
  const title = createElement(documentRef, 'h3');
  const description = createElement(documentRef, 'p');
  const grid = createElement(documentRef, 'div');
  const field = createElement(documentRef, 'div');
  const fieldHead = createElement(documentRef, 'div');
  const labelWrap = createElement(documentRef, 'div');
  const label = createElement(documentRef, 'span');
  const controls = createElement(documentRef, 'div');
  const input = createElement(documentRef, 'input');
  if (!section || !head || !title || !description || !grid || !field || !fieldHead || !labelWrap || !label || !controls || !input) {
    return null;
  }

  section.className = 'frontmatter-section';
  section.id = 'tabsMetadataSection';
  section.hidden = true;

  head.className = 'frontmatter-section-head';
  title.className = 'frontmatter-section-title';
  title.textContent = translateWithLocaleFallback('editor.tabsMetadata.title', TABS_METADATA_TITLE_FALLBACK);
  description.className = 'frontmatter-section-description';
  description.textContent = translateWithLocaleFallback(
    'editor.tabsMetadata.description',
    TABS_METADATA_DESCRIPTION_FALLBACK
  );
  head.append(title, description);

  grid.className = 'frontmatter-grid';
  field.className = 'frontmatter-field frontmatter-field-text';
  field.dataset.fieldId = 'tabs-title';
  fieldHead.className = 'frontmatter-field-head';
  labelWrap.className = 'frontmatter-field-label-wrap';
  label.className = 'frontmatter-field-title';
  label.textContent = translateWithLocaleFallback(
    'editor.tabsMetadata.fields.title',
    TABS_METADATA_TITLE_FIELD_FALLBACK
  );
  labelWrap.appendChild(label);
  fieldHead.appendChild(labelWrap);

  controls.className = 'frontmatter-field-controls';
  input.type = 'text';
  controls.appendChild(input);
  field.append(fieldHead, controls);
  grid.appendChild(field);
  section.append(head, grid);
  body.appendChild(section);
  syncLabelWidth(panel);

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
}
