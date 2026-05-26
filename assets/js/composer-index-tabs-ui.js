import { createComposerIndexTabsLanguageMenu } from './composer-index-tabs-language-menu.js';

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

  function requestFrame(callback) {
    if (typeof callback !== 'function') return null;
    if (requestAnimationFrameRef) {
      try { return requestAnimationFrameRef(callback); } catch (_) {}
    }
    callback();
    return null;
  }

  function getComputedStyleFor(element) {
    if (!element) return null;
    try {
      if (getComputedStyleRef) return getComputedStyleRef(element);
    } catch (_) {}
    return null;
  }

  function showMarkdownOpenAlert() {
    const message = tComposer('markdown.openBeforeEditor');
    try {
      if (alertRef) alertRef(message);
    } catch (_) {}
  }

  function makeDragList(container, onReorder) {
    const keySelector = '[data-key]';
    const getKey = (el) => el && el.getAttribute && el.getAttribute('data-key');
    const childItems = () => Array.from(container.querySelectorAll(keySelector));

    let dragging = null;
    let placeholder = null;
    let offsetX = 0;
    let offsetY = 0;
    let dragOriginParent = null;
    let dragOriginNext = null;
    let disposePointerMove = null;
    let disposePointerUp = null;

    const clearDragListeners = () => {
      if (typeof disposePointerMove === 'function') disposePointerMove();
      if (typeof disposePointerUp === 'function') disposePointerUp();
      disposePointerMove = null;
      disposePointerUp = null;
    };

    const snapshotRects = () => {
      const map = new Map();
      childItems().forEach(el => { map.set(getKey(el), el.getBoundingClientRect()); });
      return map;
    };

    const animateFrom = (prevRects) => {
      childItems().forEach((el) => {
        if (el === dragging) return;
        const key = getKey(el);
        const prev = prevRects.get(key);
        if (!prev) return;
        const now = el.getBoundingClientRect();
        const dx = prev.left - now.left;
        const dy = prev.top - now.top;
        if (!dx && !dy) return;
        try {
          el.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' }
          ], { duration: 360, easing: 'ease', composite: 'replace' });
        } catch (_) {
          el.style.transition = 'none';
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          requestFrame(() => {
            el.style.transition = 'transform 360ms ease';
            el.style.transform = '';
            const clear = () => {
              el.style.transition = '';
              el.removeEventListener('transitionend', clear);
            };
            el.addEventListener('transitionend', clear);
          });
        }
      });
    };

    const getAfterByY = (c, y) => {
      const els = [...c.querySelectorAll(`${keySelector}:not(.dragging)`)];
      return els.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    };

    const onPointerMove = (event) => {
      if (!dragging) return;
      dragging.style.left = (event.pageX - offsetX) + 'px';
      dragging.style.top = (event.pageY - offsetY) + 'px';

      const prev = snapshotRects();
      const after = getAfterByY(container, event.clientY);
      if (after == null) container.appendChild(placeholder);
      else container.insertBefore(placeholder, after);
      animateFrom(prev);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      const origin = dragging.getBoundingClientRect();
      const target = placeholder.getBoundingClientRect();
      const dx = origin.left - target.left;
      const dy = origin.top - target.top;

      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(dragging, placeholder);
        placeholder.remove();
      }
      placeholder = null;
      dragOriginParent = null;
      dragOriginNext = null;

      dragging.style.position = '';
      dragging.style.left = '';
      dragging.style.top = '';
      dragging.style.width = '';
      dragging.style.height = '';
      dragging.style.zIndex = '';
      dragging.style.pointerEvents = '';
      dragging.style.willChange = '';
      dragging.style.margin = dragging.dataset.nsDragPrevMargin || '';
      dragging.style.transform = dragging.dataset.nsDragPrevTransform || '';
      delete dragging.dataset.nsDragPrevMargin;
      delete dragging.dataset.nsDragPrevTransform;
      dragging.classList.remove('dragging');

      try {
        dragging.animate([
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' }
        ], { duration: 360, easing: 'ease' });
      } catch (_) {
        dragging.style.transition = 'none';
        dragging.style.transform = `translate(${dx}px, ${dy}px)`;
        requestFrame(() => {
          dragging.style.transition = 'transform 360ms ease';
          dragging.style.transform = '';
          const clear = () => {
            dragging.style.transition = '';
            dragging.removeEventListener('transitionend', clear);
          };
          dragging.addEventListener('transitionend', clear);
        });
      }

      container.classList.remove('is-dragging-list');
      if (documentRef && documentRef.body) documentRef.body.classList.remove('press-noselect');
      clearDragListeners();

      const order = childItems().map(el => el.dataset.key);
      if (onReorder) onReorder(order);
      dragging = null;
    };

    const onPointerDown = (event) => {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      const target = event.target;
      const handle = target.closest('.ci-grip,.ct-grip');
      if (!handle || !container.contains(handle)) return;
      if (target.closest('button, input, textarea, select, a')) return;
      const li = handle.closest(keySelector);
      if (!li || !container.contains(li)) return;

      event.preventDefault();

      dragging = li;
      cancelListTransition(container);
      container.style.transform = 'none';
      container.style.filter = 'none';
      if (container.style.opacity && container.style.opacity !== '1') container.style.opacity = '';

      const initialRect = li.getBoundingClientRect();
      const styles = getComputedStyleFor(li) || { margin: '' };

      dragOriginParent = li.parentNode;
      dragOriginNext = li.nextSibling;

      placeholder = documentRef.createElement('div');
      placeholder.className = 'drag-placeholder';
      placeholder.style.height = initialRect.height + 'px';
      placeholder.style.margin = styles.margin;
      dragOriginParent.insertBefore(placeholder, dragOriginNext);

      li.dataset.nsDragPrevMargin = styles.margin;
      li.dataset.nsDragPrevTransform = li.style.transform || '';
      li.style.margin = '0';
      li.style.transform = 'none';

      const rect = li.getBoundingClientRect();
      const scroll = getWindowScroll() || {};
      const scrollX = Number.isFinite(Number(scroll.x)) ? Number(scroll.x) : 0;
      const scrollY = Number.isFinite(Number(scroll.y)) ? Number(scroll.y) : 0;
      offsetX = event.pageX - (rect.left + scrollX);
      offsetY = event.pageY - (rect.top + scrollY);

      li.style.width = rect.width + 'px';
      li.style.height = rect.height + 'px';
      li.style.position = 'absolute';
      li.style.left = (rect.left + scrollX) + 'px';
      li.style.top = (rect.top + scrollY) + 'px';
      li.style.zIndex = '2147483646';
      li.style.pointerEvents = 'none';
      li.style.willChange = 'transform, top, left';
      li.classList.add('dragging');
      container.classList.add('is-dragging-list');
      if (documentRef && documentRef.body) {
        documentRef.body.classList.add('press-noselect');
        documentRef.body.appendChild(li);
      }

      try { handle.setPointerCapture(event.pointerId); } catch (_) {}
      clearDragListeners();
      disposePointerMove = addWindowListener('pointermove', onPointerMove);
      disposePointerUp = addWindowListener('pointerup', onPointerUp, { once: true });
    };

    container.addEventListener('dragstart', (event) => event.preventDefault());
    container.addEventListener('pointerdown', onPointerDown);
  }

  function buildIndexUI(root, state) {
    if (!root || !documentRef || typeof documentRef.createElement !== 'function') return;
    root.innerHTML = '';
    const list = documentRef.createElement('div');
    list.id = 'ciList';
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
        const editLabel = tComposerLang('actions.edit');
        const openLabel = tComposerLang('actions.open');
        const moveUpLabel = tComposerLang('actions.moveUp');
        const moveDownLabel = tComposerLang('actions.moveDown');
        const removeLabel = tComposerLang('actions.remove');
        langs.forEach((lang) => {
          const block = documentRef.createElement('div');
          block.className = 'ci-lang';
          block.dataset.lang = lang;
          const flag = langFlag(lang);
          const langLabel = displayLangName(lang);
          const safeLabel = escapeHtml(langLabel || '');
          const flagSpan = flag ? `<span class="ci-lang-flag" aria-hidden="true">${escapeHtml(flag)}</span>` : '';
          const val = entry[lang];
          const arr = normalizeIndexVariantList(val);
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
          const verList = query('.ci-ver-list', block);
          let verIds = arr.map(() => Math.random().toString(36).slice(2));

          const snapRects = () => {
            const map = new Map();
            verList.querySelectorAll('.ci-ver-item').forEach((el) => {
              const id = el.getAttribute('data-id');
              if (!id) return;
              map.set(id, el.getBoundingClientRect());
            });
            return map;
          };

          const animateFrom = (prev) => {
            if (!prev) return;
            verList.querySelectorAll('.ci-ver-item').forEach((el) => {
              const id = el.getAttribute('data-id');
              const r0 = id && prev.get(id);
              if (!r0) return;
              const r1 = el.getBoundingClientRect();
              const dx = r0.left - r1.left;
              const dy = r0.top - r1.top;
              if (!dx && !dy) return;
              try {
                el.animate([
                  { transform: `translate(${dx}px, ${dy}px)` },
                  { transform: 'translate(0, 0)' }
                ], { duration: 360, easing: 'ease', composite: 'replace' });
              } catch (_) {
                el.style.transition = 'none';
                el.style.transform = `translate(${dx}px, ${dy}px)`;
                requestFrame(() => {
                  el.style.transition = 'transform 360ms ease';
                  el.style.transform = '';
                  const clear = () => {
                    el.style.transition = '';
                    el.removeEventListener('transitionend', clear);
                  };
                  el.addEventListener('transitionend', clear);
                });
              }
            });
          };

          const renderVers = (prevRects = null) => {
            verList.innerHTML = '';
            arr.forEach((p, i) => {
              const id = verIds[i] || (verIds[i] = Math.random().toString(36).slice(2));
              const row = documentRef.createElement('div');
              row.className = 'ci-ver-item';
              row.setAttribute('data-id', id);
              row.dataset.lang = lang;
              row.dataset.index = String(i);
              const normalizedPath = getIndexVariantLocation(p);
              row.dataset.value = normalizedPath || '';
              if (normalizedPath) row.dataset.mdPath = normalizedPath;
              else delete row.dataset.mdPath;
              row.innerHTML = `
                <span class="ci-draft-indicator" aria-hidden="true" hidden></span>
                <span class="ci-ver-label">${escapeHtml(extractVersionFromPath(normalizedPath) || `${treeText('version', 'Version')} ${i + 1}`)}</span>
                <span class="ci-ver-actions">
                  <button type="button" class="btn-secondary ci-edit" title="${escapeHtml(openLabel)}">${escapeHtml(editLabel)}</button>
                  <button type="button" class="btn-secondary ci-up" title="${escapeHtml(moveUpLabel)}" aria-label="${escapeHtml(moveUpLabel)}"><span aria-hidden="true">↑</span></button>
                  <button type="button" class="btn-secondary ci-down" title="${escapeHtml(moveDownLabel)}" aria-label="${escapeHtml(moveDownLabel)}"><span aria-hidden="true">↓</span></button>
                  <button type="button" class="btn-secondary ci-remove" title="${escapeHtml(removeLabel)}" aria-label="${escapeHtml(removeLabel)}"><span aria-hidden="true">✕</span></button>
                </span>
              `;
              const up = query('.ci-up', row);
              const down = query('.ci-down', row);
              if (i === 0) up.setAttribute('disabled', '');
              else up.removeAttribute('disabled');
              if (i === arr.length - 1) down.setAttribute('disabled', '');
              else down.removeAttribute('disabled');
              updateComposerMarkdownDraftIndicators({ element: row, path: normalizedPath });
              query('.ci-edit', row).addEventListener('click', () => {
                const rel = getIndexVariantLocation(arr[i]);
                if (!rel) {
                  showMarkdownOpenAlert();
                  return;
                }
                openMarkdownInEditor(rel);
              });
              up.addEventListener('click', () => {
                if (i <= 0) return;
                const prev = snapRects();
                [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                [verIds[i - 1], verIds[i]] = [verIds[i], verIds[i - 1]];
                entry[lang] = arr.slice();
                renderVers(prev);
                markDirty();
              });
              down.addEventListener('click', () => {
                if (i >= arr.length - 1) return;
                const prev = snapRects();
                [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
                [verIds[i + 1], verIds[i]] = [verIds[i], verIds[i + 1]];
                entry[lang] = arr.slice();
                renderVers(prev);
                markDirty();
              });
              query('.ci-remove', row).addEventListener('click', () => {
                const prev = snapRects();
                arr.splice(i, 1);
                verIds.splice(i, 1);
                entry[lang] = arr.slice();
                renderVers(prev);
                markDirty();
              });
              verList.appendChild(row);
            });
            animateFrom(prevRects);
            updateComposerDraftContainerState(verList.closest('.ci-item'));
          };
          renderVers();
          query('.ci-lang-addver', block).addEventListener('click', async (event) => {
            const version = await promptArticleVersionValue(key, lang, entry, event.currentTarget);
            if (!version) return;
            const prev = snapRects();
            arr.push(buildArticleVersionPath(key, lang, version, entry));
            verIds.push(Math.random().toString(36).slice(2));
            entry[lang] = arr.slice();
            renderVers(prev);
            markDirty();
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
    list.id = 'ctList';
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
