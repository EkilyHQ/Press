export function createComposerIndexVersionList(options = {}) {
  const documentRef = options.documentRef || null;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function' ? options.requestAnimationFrameRef : null;
  const query = typeof options.query === 'function'
    ? options.query
    : (selector, root = documentRef) => root && typeof root.querySelector === 'function' ? root.querySelector(selector) : null;
  const escapeHtml = typeof options.escapeHtml === 'function' ? options.escapeHtml : value => String(value ?? '');
  const tComposerLang = typeof options.tComposerLang === 'function' ? options.tComposerLang : key => key;
  const treeText = typeof options.treeText === 'function' ? options.treeText : (_key, fallback) => fallback || _key;
  const normalizeIndexVariantList = typeof options.normalizeIndexVariantList === 'function' ? options.normalizeIndexVariantList : value => Array.isArray(value) ? value.slice() : (value ? [value] : []);
  const getIndexVariantLocation = typeof options.getIndexVariantLocation === 'function' ? options.getIndexVariantLocation : value => typeof value === 'string' ? value : '';
  const extractVersionFromPath = typeof options.extractVersionFromPath === 'function' ? options.extractVersionFromPath : () => '';
  const buildArticleVersionPath = typeof options.buildArticleVersionPath === 'function' ? options.buildArticleVersionPath : () => '';
  const promptArticleVersionValue = typeof options.promptArticleVersionValue === 'function' ? options.promptArticleVersionValue : async () => '';
  const openMarkdownInEditor = typeof options.openMarkdownInEditor === 'function' ? options.openMarkdownInEditor : () => {};
  const showMarkdownOpenAlert = typeof options.showMarkdownOpenAlert === 'function' ? options.showMarkdownOpenAlert : () => {};
  const updateComposerMarkdownDraftIndicators = typeof options.updateComposerMarkdownDraftIndicators === 'function' ? options.updateComposerMarkdownDraftIndicators : () => {};
  const updateComposerDraftContainerState = typeof options.updateComposerDraftContainerState === 'function' ? options.updateComposerDraftContainerState : () => {};

  function requestFrame(callback) {
    if (typeof callback !== 'function') return null;
    if (requestAnimationFrameRef) {
      try { return requestAnimationFrameRef(callback); } catch (_) {}
    }
    callback();
    return null;
  }

  function mountIndexVersionList(options = {}) {
    const { block, row, entry, lang, key, value, markDirty } = options;
    if (!block || !row || !entry || !lang || !documentRef || typeof documentRef.createElement !== 'function') return;
    const verList = query('.ci-ver-list', block);
    if (!verList) return;

    const arr = normalizeIndexVariantList(value);
    const editLabel = tComposerLang('actions.edit');
    const openLabel = tComposerLang('actions.open');
    const moveUpLabel = tComposerLang('actions.moveUp');
    const moveDownLabel = tComposerLang('actions.moveDown');
    const removeLabel = tComposerLang('actions.remove');
    let verIds = arr.map(() => Math.random().toString(36).slice(2));

    const snapRects = () => {
      const map = new Map();
      verList.querySelectorAll('.ci-ver-item').forEach((element) => {
        const id = element.getAttribute('data-id');
        if (!id) return;
        map.set(id, element.getBoundingClientRect());
      });
      return map;
    };

    const animateFrom = (prev) => {
      if (!prev) return;
      verList.querySelectorAll('.ci-ver-item').forEach((element) => {
        const id = element.getAttribute('data-id');
        const previousRect = id && prev.get(id);
        if (!previousRect) return;
        const nextRect = element.getBoundingClientRect();
        const dx = previousRect.left - nextRect.left;
        const dy = previousRect.top - nextRect.top;
        if (!dx && !dy) return;
        try {
          element.animate([
            { transform: `translate(${dx}px, ${dy}px)` },
            { transform: 'translate(0, 0)' }
          ], { duration: 360, easing: 'ease', composite: 'replace' });
        } catch (_) {
          element.style.transition = 'none';
          element.style.transform = `translate(${dx}px, ${dy}px)`;
          requestFrame(() => {
            element.style.transition = 'transform 360ms ease';
            element.style.transform = '';
            const clear = () => {
              element.style.transition = '';
              element.removeEventListener('transitionend', clear);
            };
            element.addEventListener('transitionend', clear);
          });
        }
      });
    };

    const renderVersions = (prevRects = null) => {
      verList.innerHTML = '';
      arr.forEach((pathValue, index) => {
        const id = verIds[index] || (verIds[index] = Math.random().toString(36).slice(2));
        const versionRow = documentRef.createElement('div');
        versionRow.className = 'ci-ver-item';
        versionRow.setAttribute('data-id', id);
        versionRow.dataset.lang = lang;
        versionRow.dataset.index = String(index);
        const normalizedPath = getIndexVariantLocation(pathValue);
        versionRow.dataset.value = normalizedPath || '';
        if (normalizedPath) versionRow.dataset.mdPath = normalizedPath;
        else delete versionRow.dataset.mdPath;
        versionRow.innerHTML = `
          <span class="ci-draft-indicator" aria-hidden="true" hidden></span>
          <span class="ci-ver-label">${escapeHtml(extractVersionFromPath(normalizedPath) || `${treeText('version', 'Version')} ${index + 1}`)}</span>
          <span class="ci-ver-actions">
            <button type="button" class="btn-secondary ci-edit" title="${escapeHtml(openLabel)}">${escapeHtml(editLabel)}</button>
            <button type="button" class="btn-secondary ci-up" title="${escapeHtml(moveUpLabel)}" aria-label="${escapeHtml(moveUpLabel)}"><span aria-hidden="true">↑</span></button>
            <button type="button" class="btn-secondary ci-down" title="${escapeHtml(moveDownLabel)}" aria-label="${escapeHtml(moveDownLabel)}"><span aria-hidden="true">↓</span></button>
            <button type="button" class="btn-secondary ci-remove" title="${escapeHtml(removeLabel)}" aria-label="${escapeHtml(removeLabel)}"><span aria-hidden="true">✕</span></button>
          </span>
        `;
        const up = query('.ci-up', versionRow);
        const down = query('.ci-down', versionRow);
        if (index === 0) up.setAttribute('disabled', '');
        else up.removeAttribute('disabled');
        if (index === arr.length - 1) down.setAttribute('disabled', '');
        else down.removeAttribute('disabled');
        updateComposerMarkdownDraftIndicators({ element: versionRow, path: normalizedPath });
        query('.ci-edit', versionRow).addEventListener('click', () => {
          const rel = getIndexVariantLocation(arr[index]);
          if (!rel) {
            showMarkdownOpenAlert();
            return;
          }
          openMarkdownInEditor(rel);
        });
        up.addEventListener('click', () => {
          if (index <= 0) return;
          const prev = snapRects();
          [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
          [verIds[index - 1], verIds[index]] = [verIds[index], verIds[index - 1]];
          entry[lang] = arr.slice();
          renderVersions(prev);
          if (typeof markDirty === 'function') markDirty();
        });
        down.addEventListener('click', () => {
          if (index >= arr.length - 1) return;
          const prev = snapRects();
          [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
          [verIds[index + 1], verIds[index]] = [verIds[index], verIds[index + 1]];
          entry[lang] = arr.slice();
          renderVersions(prev);
          if (typeof markDirty === 'function') markDirty();
        });
        query('.ci-remove', versionRow).addEventListener('click', () => {
          const prev = snapRects();
          arr.splice(index, 1);
          verIds.splice(index, 1);
          entry[lang] = arr.slice();
          renderVersions(prev);
          if (typeof markDirty === 'function') markDirty();
        });
        verList.appendChild(versionRow);
      });
      animateFrom(prevRects);
      updateComposerDraftContainerState(verList.closest('.ci-item'));
    };

    renderVersions();

    const addVersionButton = query('.ci-lang-addver', block);
    if (addVersionButton) {
      addVersionButton.addEventListener('click', async (event) => {
        const version = await promptArticleVersionValue(key, lang, entry, event.currentTarget);
        if (!version) return;
        const prev = snapRects();
        arr.push(buildArticleVersionPath(key, lang, version, entry));
        verIds.push(Math.random().toString(36).slice(2));
        entry[lang] = arr.slice();
        renderVersions(prev);
        if (typeof markDirty === 'function') markDirty();
      });
    }
  }

  return { mountIndexVersionList };
}
