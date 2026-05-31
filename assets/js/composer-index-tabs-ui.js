import { createComposerDragList } from './composer-drag-list.js';
import { createComposerIndexTabsLanguageMenu } from './composer-index-tabs-language-menu.js';
import { createComposerIndexVersionList } from './composer-index-version-list.js';
import { EDITOR_SHELL_IDS } from './editor-shell-contract.js';

export function createComposerIndexTabsUi(options = {}) {
  const documentRef = options.documentRef || null;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function' ? options.requestAnimationFrameRef : null;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function' ? options.setTimeoutRef : null;
  const alertRef = typeof options.alertRef === 'function' ? options.alertRef : null;
  const getComputedStyleRef = typeof options.getComputedStyleRef === 'function' ? options.getComputedStyleRef : null;
  const addWindowListener = typeof options.addWindowListener === 'function' ? options.addWindowListener : () => () => {};
  const addDocumentListener = typeof options.addDocumentListener === 'function' ? options.addDocumentListener : () => () => {};
  const getWindowScroll = typeof options.getWindowScroll === 'function' ? options.getWindowScroll : () => ({ x: 0, y: 0 });
  const preferredLangOrder = Array.isArray(options.preferredLangOrder) ? options.preferredLangOrder.slice() : [];
  const query = typeof options.query === 'function'
    ? options.query
    : (selector, root = documentRef) => root && typeof root.querySelector === 'function' ? root.querySelector(selector) : null;
  const escapeHtml = typeof options.escapeHtml === 'function' ? options.escapeHtml : (value) => String(value ?? '');
  const tComposer = typeof options.tComposer === 'function' ? options.tComposer : (key) => key;
  const tComposerLang = typeof options.tComposerLang === 'function' ? options.tComposerLang : (key) => key;
  const tComposerEntryRow = typeof options.tComposerEntryRow === 'function' ? options.tComposerEntryRow : (key) => key;
  const treeText = typeof options.treeText === 'function' ? options.treeText : (key, fallback) => fallback || key;
  const displayLangName = typeof options.displayLangName === 'function' ? options.displayLangName : (code) => String(code || '').toUpperCase();
  const langFlag = typeof options.langFlag === 'function' ? options.langFlag : () => '';
  const sortLangKeys = typeof options.sortLangKeys === 'function' ? options.sortLangKeys : (value) => Object.keys(value || {}).sort();
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : (value) => String(value || '').trim();
  const normalizeIndexVariantList = typeof options.normalizeIndexVariantList === 'function' ? options.normalizeIndexVariantList : (value) => Array.isArray(value) ? value.slice() : (value ? [value] : []);
  const getIndexVariantLocation = typeof options.getIndexVariantLocation === 'function' ? options.getIndexVariantLocation : (value) => typeof value === 'string' ? value : '';
  const extractVersionFromPath = typeof options.extractVersionFromPath === 'function' ? options.extractVersionFromPath : () => '';
  const buildDefaultLanguagePathFromEntry = typeof options.buildDefaultLanguagePathFromEntry === 'function' ? options.buildDefaultLanguagePathFromEntry : () => '';
  const buildArticleVersionPath = typeof options.buildArticleVersionPath === 'function' ? options.buildArticleVersionPath : () => '';
  const promptArticleVersionValue = typeof options.promptArticleVersionValue === 'function' ? options.promptArticleVersionValue : async () => '';
  const openMarkdownInEditor = typeof options.openMarkdownInEditor === 'function' ? options.openMarkdownInEditor : () => {};
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : () => {};
  const broadcastLanguagePoolChange = typeof options.broadcastLanguagePoolChange === 'function' ? options.broadcastLanguagePoolChange : () => {};
  const updateComposerMarkdownDraftIndicators = typeof options.updateComposerMarkdownDraftIndicators === 'function' ? options.updateComposerMarkdownDraftIndicators : () => {};
  const updateComposerDraftContainerState = typeof options.updateComposerDraftContainerState === 'function' ? options.updateComposerDraftContainerState : () => {};
  const scheduleComposerOrderPreviewRelayout = typeof options.scheduleComposerOrderPreviewRelayout === 'function' ? options.scheduleComposerOrderPreviewRelayout : () => {};
  const getComposerOrderPreviewActiveKind = typeof options.getComposerOrderPreviewActiveKind === 'function' ? options.getComposerOrderPreviewActiveKind : () => '';
  const updateComposerOrderPreview = typeof options.updateComposerOrderPreview === 'function' ? options.updateComposerOrderPreview : () => {};
  const cancelListTransition = typeof options.cancelListTransition === 'function' ? options.cancelListTransition : () => {};
  const slideToggle = typeof options.slideToggle === 'function' ? options.slideToggle : (el, open) => {
    if (!el) return;
    el.style.display = open ? 'block' : 'none';
    el.dataset.open = open ? '1' : '0';
  };
  const languageMenu = createComposerIndexTabsLanguageMenu({
    documentRef,
    setTimeoutRef,
    addDocumentListener,
    query,
    escapeHtml,
    displayLangName
  });
  const dragList = createComposerDragList({
    documentRef,
    requestAnimationFrameRef,
    addWindowListener,
    getWindowScroll,
    getComputedStyleRef,
    cancelListTransition
  });
  const { makeDragList } = dragList;
  const indexVersionList = createComposerIndexVersionList({
    documentRef,
    requestAnimationFrameRef,
    query,
    escapeHtml,
    tComposerLang,
    treeText,
    normalizeIndexVariantList,
    getIndexVariantLocation,
    extractVersionFromPath,
    buildArticleVersionPath,
    promptArticleVersionValue,
    openMarkdownInEditor,
    showMarkdownOpenAlert,
    updateComposerMarkdownDraftIndicators,
    updateComposerDraftContainerState
  });

  function showMarkdownOpenAlert() {
    const message = tComposer('markdown.openBeforeEditor');
    try {
      if (alertRef) alertRef(message);
    } catch (_) {}
  }

  function buildIndexUI(root, state) {
    if (!root || !documentRef || typeof documentRef.createElement !== 'function') return;
    root.innerHTML = '';
    const list = documentRef.createElement('div');
    list.id = EDITOR_SHELL_IDS.ciList;
    root.appendChild(list);

    const markDirty = () => { try { notifyComposerChange('index'); } catch (_) {} };

    const order = state.index.__order;
    order.forEach((key) => {
      const entry = state.index[key] || {};
      const row = documentRef.createElement('div');
      row.className = 'ci-item';
      row.setAttribute('data-key', key);
      row.setAttribute('draggable', 'true');
      const langCount = Object.keys(entry).length;
      const langCountText = tComposerLang('count', { count: langCount });
      const detailsLabel = tComposerEntryRow('details');
      const deleteLabel = tComposerEntryRow('delete');
      const gripHint = tComposerEntryRow('gripHint');
      row.innerHTML = `
        <div class="ci-head">
          <span class="ci-grip" title="${escapeHtml(gripHint)}" aria-hidden="true">⋮⋮</span>
          <strong class="ci-key">${escapeHtml(key)}</strong>
          <span class="ci-meta">${escapeHtml(langCountText)}</span>
          <span class="ci-diff" aria-live="polite"></span>
          <span class="ci-actions">
            <button class="btn-secondary ci-expand" aria-expanded="false"><span class="caret" aria-hidden="true"></span>${escapeHtml(detailsLabel)}</button>
            <span class="ci-head-add-lang-slot"></span>
            <button class="btn-secondary ci-del">${escapeHtml(deleteLabel)}</button>
          </span>
        </div>
        <div class="ci-body"><div class="ci-body-inner"></div></div>
      `;
      list.appendChild(row);

      const body = query('.ci-body', row);
      const bodyInner = query('.ci-body-inner', row);
      const headAddLangSlot = query('.ci-head-add-lang-slot', row);
      const btnExpand = query('.ci-expand', row);
      const btnDel = query('.ci-del', row);
      if (btnExpand) btnExpand.setAttribute('title', detailsLabel);
      if (btnDel) {
        btnDel.setAttribute('title', deleteLabel);
        btnDel.setAttribute('aria-label', deleteLabel);
      }

      body.dataset.open = '0';
      body.style.display = 'none';

      const renderBody = () => {
        bodyInner.innerHTML = '';
        if (headAddLangSlot) headAddLangSlot.innerHTML = '';
        const langs = sortLangKeys(entry);
        const addVersionLabel = tComposerLang('addVersion');
        const removeLangLabel = tComposerLang('removeLanguage');
        langs.forEach((lang) => {
          const block = documentRef.createElement('div');
          block.className = 'ci-lang';
          block.dataset.lang = lang;
          const flag = langFlag(lang);
          const langLabel = displayLangName(lang);
          const safeLabel = escapeHtml(langLabel || '');
          const flagSpan = flag ? `<span class="ci-lang-flag" aria-hidden="true">${escapeHtml(flag)}</span>` : '';
          block.innerHTML = `
            <div class="ci-lang-head">
              <strong class="ci-lang-label" aria-label="${safeLabel}" title="${safeLabel}">
                ${flagSpan}
                <span class="ci-lang-code">${escapeHtml(lang.toUpperCase())}</span>
              </strong>
              <span class="ci-lang-actions">
                <button type="button" class="btn-secondary ci-lang-addver">${escapeHtml(addVersionLabel)}</button>
                <button type="button" class="btn-secondary ci-lang-del">${escapeHtml(removeLangLabel)}</button>
              </span>
            </div>
            <div class="ci-ver-list"></div>
            <div class="ci-ver-removed" data-role="removed" hidden></div>
          `;
          indexVersionList.mountIndexVersionList({
            block,
            row,
            entry,
            lang,
            key,
            value: entry[lang],
            markDirty
          });
          query('.ci-lang-del', block).addEventListener('click', () => {
            delete entry[lang];
            const meta = row.querySelector('.ci-meta');
            if (meta) meta.textContent = tComposerLang('count', { count: Object.keys(entry).length });
            renderBody();
            broadcastLanguagePoolChange();
            markDirty();
          });
          bodyInner.appendChild(block);
        });

        const available = preferredLangOrder.filter(l => !entry[l]);
        if (available.length > 0) {
          const addLangLabel = tComposerLang('addLanguage');
          const addLangWrap = languageMenu.createLanguageMenu({
            tagName: 'span',
            wrapperClass: 'ci-add-lang',
            buttonClass: 'ci-add-lang-btn',
            menuClass: 'ci-lang-menu',
            label: addLangLabel,
            available,
            onSelect: (code, menuApi) => {
              if (!code || entry[code]) return;
              const defaultPath = buildDefaultLanguagePathFromEntry('index', key, code, entry);
              entry[code] = defaultPath ? [defaultPath] : [''];
              const meta = row.querySelector('.ci-meta');
              if (meta) meta.textContent = tComposerLang('count', { count: Object.keys(entry).length });
              menuApi.closeMenu();
              renderBody();
              broadcastLanguagePoolChange();
              markDirty();
            }
          });
          if (addLangWrap) (headAddLangSlot || bodyInner).appendChild(addLangWrap);
        }
        updateComposerDraftContainerState(row);
      };
      renderBody();

      btnExpand.addEventListener('click', () => {
        const isOpen = body.dataset.open === '1';
        const next = !isOpen;
        row.classList.toggle('is-open', next);
        btnExpand.setAttribute('aria-expanded', String(next));
        slideToggle(body, next);
        scheduleComposerOrderPreviewRelayout('index');
      });
      btnDel.addEventListener('click', () => {
        const i = state.index.__order.indexOf(key);
        if (i >= 0) state.index.__order.splice(i, 1);
        delete state.index[key];
        row.remove();
        markDirty();
      });
    });

    makeDragList(list, (newOrder) => {
      state.index.__order = newOrder;
      markDirty();
    });

    try {
      if (getComposerOrderPreviewActiveKind() === 'index') updateComposerOrderPreview('index');
    } catch (_) {}
  }

  function buildTabsUI(root, state) {
    if (!root || !documentRef || typeof documentRef.createElement !== 'function') return;
    root.innerHTML = '';
    const list = documentRef.createElement('div');
    list.id = EDITOR_SHELL_IDS.ctList;
    root.appendChild(list);

    const markDirty = () => { try { notifyComposerChange('tabs'); } catch (_) {} };

    const order = state.tabs.__order;
    order.forEach((tab) => {
      const entry = state.tabs[tab] || {};
      const row = documentRef.createElement('div');
      row.className = 'ct-item';
      row.setAttribute('data-key', tab);
      row.setAttribute('draggable', 'true');
      const langCount = Object.keys(entry).length;
      const langCountText = tComposerLang('count', { count: langCount });
      const detailsLabel = tComposerEntryRow('details');
      const deleteLabel = tComposerEntryRow('delete');
      const gripHint = tComposerEntryRow('gripHint');
      row.innerHTML = `
        <div class="ct-head">
          <span class="ct-grip" title="${escapeHtml(gripHint)}" aria-hidden="true">⋮⋮</span>
          <strong class="ct-key">${escapeHtml(tab)}</strong>
          <span class="ct-meta">${escapeHtml(langCountText)}</span>
          <span class="ct-diff" aria-live="polite"></span>
          <span class="ct-actions">
            <button class="btn-secondary ct-expand" aria-expanded="false"><span class="caret" aria-hidden="true"></span>${escapeHtml(detailsLabel)}</button>
            <button class="btn-secondary ct-del">${escapeHtml(deleteLabel)}</button>
          </span>
        </div>
        <div class="ct-body"><div class="ct-body-inner"></div></div>
      `;
      list.appendChild(row);

      const body = query('.ct-body', row);
      const bodyInner = query('.ct-body-inner', row);
      const btnExpand = query('.ct-expand', row);
      const btnDel = query('.ct-del', row);
      if (btnExpand) btnExpand.setAttribute('title', detailsLabel);
      if (btnDel) {
        btnDel.setAttribute('title', deleteLabel);
        btnDel.setAttribute('aria-label', deleteLabel);
      }

      body.dataset.open = '0';
      body.style.display = 'none';

      const renderBody = () => {
        bodyInner.innerHTML = '';
        const langs = sortLangKeys(entry);
        const editLabel = tComposerLang('actions.edit');
        const openLabel = tComposerLang('actions.open');
        const removeLangLabel = tComposerLang('removeLanguage');
        const addLangLabel = tComposerLang('addLanguage');
        langs.forEach((lang) => {
          const value = entry[lang] || { title: '', location: '' };
          const flag = langFlag(lang);
          const langLabel = displayLangName(lang);
          const safeLabel = escapeHtml(langLabel || '');
          const flagSpan = flag ? `<span class="ct-lang-flag" aria-hidden="true">${escapeHtml(flag)}</span>` : '';
          const block = documentRef.createElement('div');
          block.className = 'ct-lang';
          block.dataset.lang = lang;
          const initialPath = normalizeRelPath(value.location);
          if (initialPath) block.dataset.mdPath = initialPath;
          else delete block.dataset.mdPath;
          block.innerHTML = `
            <div class="ct-lang-label" aria-label="${safeLabel}" title="${safeLabel}">
              <span class="ct-draft-indicator" aria-hidden="true" hidden></span>
              ${flagSpan}
              <span class="ct-lang-code" aria-hidden="true">${escapeHtml(lang.toUpperCase())}</span>
            </div>
            <div class="ct-lang-main">
              <div class="ct-field ct-field-location"><span class="ct-field-label">${escapeHtml(value.location || '')}</span></div>
              <div class="ct-lang-actions">
                <button type="button" class="btn-secondary ct-edit" title="${escapeHtml(openLabel)}">${escapeHtml(editLabel)}</button>
                <button type="button" class="btn-secondary ct-lang-del">${escapeHtml(removeLangLabel)}</button>
              </div>
            </div>
          `;
          const langRemoveBtn = query('.ct-lang-del', block);
          if (langRemoveBtn) {
            langRemoveBtn.setAttribute('title', removeLangLabel);
            langRemoveBtn.setAttribute('aria-label', removeLangLabel);
          }
          updateComposerMarkdownDraftIndicators({ element: block, path: initialPath });
          query('.ct-edit', block).addEventListener('click', () => {
            const rel = normalizeRelPath(value.location);
            if (!rel) {
              showMarkdownOpenAlert();
              return;
            }
            openMarkdownInEditor(rel, {
              source: 'tabs',
              key: tab,
              lang,
              editorTreeNodeId: `tabs:${tab}:${lang}`
            });
          });
          query('.ct-lang-del', block).addEventListener('click', () => {
            delete entry[lang];
            const meta = row.querySelector('.ct-meta');
            if (meta) meta.textContent = tComposerLang('count', { count: Object.keys(entry).length });
            renderBody();
            broadcastLanguagePoolChange();
            markDirty();
          });
          bodyInner.appendChild(block);
        });

        const available = preferredLangOrder.filter(l => !entry[l]);
        if (available.length > 0) {
          const addLangWrap = languageMenu.createLanguageMenu({
            tagName: 'div',
            wrapperClass: 'ct-add-lang',
            buttonClass: 'ct-add-lang-btn',
            menuClass: 'ct-lang-menu',
            label: addLangLabel,
            available,
            onSelect: (code, menuApi) => {
              if (!code || entry[code]) return;
              const defaultLocation = buildDefaultLanguagePathFromEntry('tabs', tab, code, entry);
              entry[code] = {
                title: String(tab || ''),
                location: defaultLocation || ''
              };
              const meta = row.querySelector('.ct-meta');
              if (meta) meta.textContent = tComposerLang('count', { count: Object.keys(entry).length });
              menuApi.closeMenu();
              renderBody();
              broadcastLanguagePoolChange();
              markDirty();
            }
          });
          if (addLangWrap) bodyInner.appendChild(addLangWrap);
        }
        updateComposerDraftContainerState(row);
      };
      renderBody();

      btnExpand.addEventListener('click', () => {
        const isOpen = body.dataset.open === '1';
        const next = !isOpen;
        row.classList.toggle('is-open', next);
        btnExpand.setAttribute('aria-expanded', String(next));
        slideToggle(body, next);
        scheduleComposerOrderPreviewRelayout('tabs');
      });
      btnDel.addEventListener('click', () => {
        const i = state.tabs.__order.indexOf(tab);
        if (i >= 0) state.tabs.__order.splice(i, 1);
        delete state.tabs[tab];
        row.remove();
        markDirty();
      });
    });

    makeDragList(list, (newOrder) => {
      state.tabs.__order = newOrder;
      markDirty();
    });

    try {
      if (getComposerOrderPreviewActiveKind() === 'tabs') updateComposerOrderPreview('tabs');
    } catch (_) {}
  }

  return {
    buildIndexUI,
    buildTabsUI
  };
}
