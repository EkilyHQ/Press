function noop() {}

function getElement(documentRef, id) {
  try {
    return documentRef && typeof documentRef.getElementById === 'function'
      ? documentRef.getElementById(id)
      : null;
  } catch (_) {
    return null;
  }
}

function queryAll(root, selector) {
  try {
    return root && typeof root.querySelectorAll === 'function'
      ? Array.from(root.querySelectorAll(selector))
      : [];
  } catch (_) {
    return [];
  }
}

function query(root, selector) {
  try {
    return root && typeof root.querySelector === 'function' ? root.querySelector(selector) : null;
  } catch (_) {
    return null;
  }
}

function collectOpenKeys(root, selector) {
  return queryAll(root, selector)
    .map(el => {
      try { return el.getAttribute('data-key'); }
      catch (_) { return ''; }
    })
    .filter(Boolean);
}

export function createComposerYamlPanelsController(options = {}) {
  const documentRef = options.documentRef || null;
  const cssEscape = typeof options.cssEscape === 'function'
    ? options.cssEscape
    : (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const clearInlineSlideStyles = typeof options.clearInlineSlideStyles === 'function'
    ? options.clearInlineSlideStyles
    : noop;
  const getActiveState = typeof options.getActiveState === 'function' ? options.getActiveState : () => ({});
  const buildIndexUI = typeof options.buildIndexUI === 'function' ? options.buildIndexUI : noop;
  const buildTabsUI = typeof options.buildTabsUI === 'function' ? options.buildTabsUI : noop;
  const buildSiteUI = typeof options.buildSiteUI === 'function' ? options.buildSiteUI : noop;
  const notifyComposerChange = typeof options.notifyComposerChange === 'function'
    ? options.notifyComposerChange
    : noop;
  const updateMarkdownDraftIndicators = typeof options.updateMarkdownDraftIndicators === 'function'
    ? options.updateMarkdownDraftIndicators
    : noop;

  function updateDynamicTabsGroupState() {
    const container = getElement(documentRef, 'modeDynamicTabs');
    if (!container) return false;
    const hasTabs = !!query(container, '.mode-tab.dynamic-mode');
    container.hidden = !hasTabs;
    if (hasTabs) container.removeAttribute('aria-hidden');
    else container.setAttribute('aria-hidden', 'true');
    return hasTabs;
  }

  function restoreOpenRows(root, openKeys, config) {
    openKeys.forEach((key) => {
      if (!key) return;
      const row = query(root, `${config.itemSelector}[data-key="${cssEscape(key)}"]`);
      if (!row) return;
      const body = query(row, config.bodySelector);
      const button = query(row, config.buttonSelector);
      row.classList.add('is-open');
      if (body) {
        body.style.display = 'block';
        body.dataset.open = '1';
        clearInlineSlideStyles(body);
      }
      if (button) button.setAttribute('aria-expanded', 'true');
    });
  }

  function rebuildIndexUI(preserveOpen = true) {
    const root = getElement(documentRef, 'composerIndex');
    if (!root) return false;
    const openKeys = preserveOpen ? collectOpenKeys(root, '.ci-item.is-open') : [];
    buildIndexUI(root, getActiveState());
    restoreOpenRows(root, openKeys, {
      itemSelector: '.ci-item',
      bodySelector: '.ci-body',
      buttonSelector: '.ci-expand'
    });
    notifyComposerChange('index', { skipAutoSave: true });
    updateMarkdownDraftIndicators();
    return true;
  }

  function rebuildTabsUI(preserveOpen = true) {
    const root = getElement(documentRef, 'composerTabs');
    if (!root) return false;
    const openKeys = preserveOpen ? collectOpenKeys(root, '.ct-item.is-open') : [];
    buildTabsUI(root, getActiveState());
    restoreOpenRows(root, openKeys, {
      itemSelector: '.ct-item',
      bodySelector: '.ct-body',
      buttonSelector: '.ct-expand'
    });
    notifyComposerChange('tabs', { skipAutoSave: true });
    updateMarkdownDraftIndicators();
    return true;
  }

  function rebuildSiteUI() {
    const root = getElement(documentRef, 'composerSite');
    if (!root) return false;
    buildSiteUI(root, getActiveState());
    notifyComposerChange('site', { skipAutoSave: true });
    return true;
  }

  return {
    rebuildIndexUI,
    rebuildSiteUI,
    rebuildTabsUI,
    updateDynamicTabsGroupState
  };
}
