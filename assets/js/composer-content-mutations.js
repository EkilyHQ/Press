export function createComposerContentMutationController(options = {}) {
  const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const t = typeof options.t === 'function' ? options.t : (key) => key;
  const treeText = typeof options.treeText === 'function' ? options.treeText : (_key, fallback) => fallback;
  const showToast = typeof options.showToast === 'function' ? options.showToast : () => {};

  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => null;
  const getIndexEntry = typeof options.getIndexEntry === 'function' ? options.getIndexEntry : () => ({});
  const getTabsEntry = typeof options.getTabsEntry === 'function' ? options.getTabsEntry : () => ({});
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : () => {};
  const refreshEditorContentTree = typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : () => {};
  const rebuildIndexUI = typeof options.rebuildIndexUI === 'function' ? options.rebuildIndexUI : () => {};
  const rebuildTabsUI = typeof options.rebuildTabsUI === 'function' ? options.rebuildTabsUI : () => {};
  const scheduleComposerOrderPreviewRelayout = typeof options.scheduleComposerOrderPreviewRelayout === 'function'
    ? options.scheduleComposerOrderPreviewRelayout
    : () => {};
  const showComposerAddEntryPrompt = typeof options.showComposerAddEntryPrompt === 'function'
    ? options.showComposerAddEntryPrompt
    : async () => ({ confirmed: false, value: '' });
  const editorContentTreeController = options.editorContentTreeController || {};

  const normalizeLangCode = typeof options.normalizeLangCode === 'function' ? options.normalizeLangCode : (value) => String(value || '').trim().toLowerCase();
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : (value) => String(value || '').replace(/^\/+/, '');
  const deepClone = typeof options.deepClone === 'function'
    ? options.deepClone
    : (value) => {
        try {
          if (typeof structuredClone === 'function') return structuredClone(value);
        } catch (_) {}
        try { return JSON.parse(JSON.stringify(value)); }
        catch (_) { return value; }
      };
  const normalizeIndexVariantList = typeof options.normalizeIndexVariantList === 'function' ? options.normalizeIndexVariantList : (value) => (Array.isArray(value) ? value.slice() : (value ? [value] : []));
  const getIndexVariantLocation = typeof options.getIndexVariantLocation === 'function' ? options.getIndexVariantLocation : (value) => String(value || '');
  const isIndexMetadataObject = typeof options.isIndexMetadataObject === 'function' ? options.isIndexMetadataObject : (value) => !!(value && typeof value === 'object' && !Array.isArray(value));
  const buildDefaultLanguagePathFromEntry = typeof options.buildDefaultLanguagePathFromEntry === 'function' ? options.buildDefaultLanguagePathFromEntry : () => '';
  const buildDefaultEntryPath = typeof options.buildDefaultEntryPath === 'function' ? options.buildDefaultEntryPath : () => '';
  const buildArticleVersionPath = typeof options.buildArticleVersionPath === 'function' ? options.buildArticleVersionPath : () => '';
  const getDefaultComposerLanguage = typeof options.getDefaultComposerLanguage === 'function' ? options.getDefaultComposerLanguage : () => 'en';
  const normalizeComposerVersionPaths = typeof options.normalizeComposerVersionPaths === 'function' ? options.normalizeComposerVersionPaths : normalizeIndexVariantList;
  const collectComposerArticleVersions = typeof options.collectComposerArticleVersions === 'function' ? options.collectComposerArticleVersions : () => new Set();
  const isComposerVersionTag = typeof options.isComposerVersionTag === 'function' ? options.isComposerVersionTag : () => true;
  const normalizeComposerVersionTag = typeof options.normalizeComposerVersionTag === 'function' ? options.normalizeComposerVersionTag : (value) => String(value || '').trim();
  const displayLangName = typeof options.displayLangName === 'function' ? options.displayLangName : (value) => String(value || '').toUpperCase();
  const cssEscape = typeof options.cssEscape === 'function'
    ? options.cssEscape
    : (value) => {
        try {
          if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
        } catch (_) {}
        return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
      };
  const clearInlineSlideStyles = typeof options.clearInlineSlideStyles === 'function' ? options.clearInlineSlideStyles : () => {};
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function'
    ? options.requestAnimationFrameRef
    : (callback) => {
        if (windowRef && typeof windowRef.requestAnimationFrame === 'function') return windowRef.requestAnimationFrame(callback);
        callback();
        return 0;
      };
  const confirmRef = typeof options.confirmRef === 'function'
    ? options.confirmRef
    : (message) => {
        if (windowRef && typeof windowRef.confirm === 'function') return windowRef.confirm(message);
        return true;
      };

  function setActiveNodeId(nodeId) {
    if (editorContentTreeController && typeof editorContentTreeController.setActiveNodeId === 'function') {
      editorContentTreeController.setActiveNodeId(nodeId);
    }
  }

  function addExpandedNodeId(nodeId) {
    if (editorContentTreeController && typeof editorContentTreeController.addExpandedNodeId === 'function') {
      editorContentTreeController.addExpandedNodeId(nodeId);
    }
  }

  function validateEntryKey(value) {
    const key = String(value || '').trim();
    if (!key) return '';
    return /^[A-Za-z0-9_-]+$/.test(key) ? key : '';
  }

  function renameEditorEntry(source, oldKey, nextKeyRaw) {
    const nextKey = validateEntryKey(nextKeyRaw);
    if (!nextKey || nextKey === oldKey) return false;
    const state = getStateSlice(source) || {};
    if (Object.prototype.hasOwnProperty.call(state, nextKey)) {
      showToast('warn', treeText('duplicateKey', 'That key already exists.'));
      return false;
    }
    state[nextKey] = state[oldKey];
    delete state[oldKey];
    if (Array.isArray(state.__order)) state.__order = state.__order.map(key => (key === oldKey ? nextKey : key));
    notifyComposerChange(source);
    setActiveNodeId(`${source}:${nextKey}`);
    refreshEditorContentTree();
    return true;
  }

  function deleteEditorEntry(source, key) {
    const state = getStateSlice(source) || {};
    const label = source === 'tabs' ? treeText('page', 'page') : treeText('article', 'article');
    const message = treeText('deleteEntryConfirm', `Delete this ${label}?`, { label: key });
    let ok = true;
    try { ok = confirmRef(message); } catch (_) {}
    if (!ok) return false;
    delete state[key];
    if (Array.isArray(state.__order)) state.__order = state.__order.filter(item => item !== key);
    notifyComposerChange(source);
    setActiveNodeId(source === 'tabs' ? 'pages' : 'articles');
    refreshEditorContentTree();
    return true;
  }

  function addEditorLanguage(source, key, lang) {
    const code = normalizeLangCode(lang);
    if (!code) return false;
    if (source === 'tabs') {
      const entry = getTabsEntry(key);
      if (entry[code]) return false;
      entry[code] = { title: key, location: buildDefaultLanguagePathFromEntry('tabs', key, code, entry) };
      notifyComposerChange('tabs');
      setActiveNodeId(`tabs:${key}`);
    } else {
      const entry = getIndexEntry(key);
      if (entry[code]) return false;
      entry[code] = [buildDefaultLanguagePathFromEntry('index', key, code, entry)];
      notifyComposerChange('index');
      setActiveNodeId(`index:${key}:${code}`);
    }
    addExpandedNodeId(`${source}:${key}`);
    refreshEditorContentTree();
    return true;
  }

  function removeEditorLanguage(source, key, lang) {
    const entry = source === 'tabs' ? getTabsEntry(key) : getIndexEntry(key);
    if (!entry[lang]) return false;
    const message = treeText('deleteLanguageConfirm', 'Remove this language?', { lang: lang.toUpperCase() });
    let ok = true;
    try { ok = confirmRef(message); } catch (_) {}
    if (!ok) return false;
    delete entry[lang];
    notifyComposerChange(source);
    setActiveNodeId(`${source}:${key}`);
    refreshEditorContentTree();
    return true;
  }

  function addEditorVersion(key, lang, anchor = null) {
    const entry = getIndexEntry(key);
    const arr = normalizeIndexVariantList(entry[lang]);
    return promptArticleVersionValue(key, lang, entry, anchor).then((version) => {
      if (!version) return false;
      arr.push(buildArticleVersionPath(key, lang, version, entry));
      entry[lang] = arr;
      notifyComposerChange('index');
      addExpandedNodeId(`index:${key}`);
      addExpandedNodeId(`index:${key}:${lang}`);
      setActiveNodeId(`index:${key}:${lang}`);
      refreshEditorContentTree();
      return true;
    });
  }

  function removeEditorVersion(key, lang, index) {
    const entry = getIndexEntry(key);
    const arr = normalizeIndexVariantList(entry[lang]);
    if (!arr[index]) return false;
    arr.splice(index, 1);
    entry[lang] = arr;
    notifyComposerChange('index');
    setActiveNodeId(`index:${key}:${lang}`);
    refreshEditorContentTree();
    return true;
  }

  function normalizeRestoreIndex(value, length) {
    const raw = Number(value);
    if (!Number.isFinite(raw)) return length;
    return Math.max(0, Math.min(Math.trunc(raw), length));
  }

  function ensureRestoredEntryOrder(source, key, restoreOrderIndex, options = {}) {
    const state = getStateSlice(source);
    if (!state || !key) return null;
    if (!Array.isArray(state.__order)) state.__order = Object.keys(state).filter(item => item && item !== '__order' && item !== key);
    if (state.__order.includes(key) && !options.reposition) return state;
    state.__order = state.__order.filter(item => item !== key);
    state.__order.splice(normalizeRestoreIndex(restoreOrderIndex, state.__order.length), 0, key);
    return state;
  }

  function ensureRestoredEntry(source, key, restoreOrderIndex) {
    const state = ensureRestoredEntryOrder(source, key, restoreOrderIndex);
    if (!state) return null;
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) state[key] = {};
    return state[key];
  }

  function restoreDeletedEditorTreeNode(node) {
    if (!node || !node.isDeleted || (node.source !== 'index' && node.source !== 'tabs')) return false;
    const state = getStateSlice(node.source);
    if (!state || !node.key) return false;
    const restoreValue = deepClone(node.restoreValue);
    let nextNodeId = '';

    if (node.deletedKind === 'entry') {
      state[node.key] = restoreValue && typeof restoreValue === 'object' && !Array.isArray(restoreValue) ? restoreValue : {};
      ensureRestoredEntryOrder(node.source, node.key, node.restoreOrderIndex, { reposition: true });
      nextNodeId = `${node.source}:${node.key}`;
    } else if (node.deletedKind === 'language') {
      const entry = ensureRestoredEntry('index', node.key, node.restoreOrderIndex);
      if (!entry || !node.lang) return false;
      entry[node.lang] = restoreValue == null ? [] : restoreValue;
      nextNodeId = `index:${node.key}:${node.lang}`;
    } else if (node.deletedKind === 'version') {
      const entry = ensureRestoredEntry('index', node.key, node.restoreOrderIndex);
      if (!entry || !node.lang) return false;
      const path = getIndexVariantLocation(restoreValue) || normalizeRelPath(node.path);
      if (!path) return false;
      const arr = normalizeIndexVariantList(entry[node.lang]);
      let targetIndex = arr.findIndex(item => getIndexVariantLocation(item) === path);
      if (targetIndex === -1) {
        targetIndex = normalizeRestoreIndex(node.restoreIndex, arr.length);
        arr.splice(targetIndex, 0, isIndexMetadataObject(restoreValue) ? restoreValue : path);
      }
      entry[node.lang] = arr;
      nextNodeId = `index:${node.key}:${node.lang}:${targetIndex}`;
    } else if (node.deletedKind === 'page-language') {
      const entry = ensureRestoredEntry('tabs', node.key, node.restoreOrderIndex);
      if (!entry || !node.lang) return false;
      entry[node.lang] = restoreValue == null ? { title: node.key, location: normalizeRelPath(node.path) } : restoreValue;
      nextNodeId = `tabs:${node.key}:${node.lang}`;
    } else {
      return false;
    }

    addExpandedNodeId(node.source === 'tabs' ? 'pages' : 'articles');
    addExpandedNodeId(`${node.source}:${node.key}`);
    if (node.source === 'index' && node.lang) addExpandedNodeId(`index:${node.key}:${node.lang}`);
    setActiveNodeId(nextNodeId || `${node.source}:${node.key}`);
    notifyComposerChange(node.source);
    refreshEditorContentTree();
    return true;
  }

  function moveEditorVersion(key, lang, index, delta) {
    return moveEditorVersionTo(key, lang, index, index + delta);
  }

  function moveEditorVersionTo(key, lang, from, to) {
    const entry = getIndexEntry(key);
    const arr = normalizeIndexVariantList(entry[lang]);
    if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return false;
    const [path] = arr.splice(from, 1);
    arr.splice(to, 0, path);
    entry[lang] = arr;
    notifyComposerChange('index');
    setActiveNodeId(`index:${key}:${lang}`);
    refreshEditorContentTree();
    return true;
  }

  async function promptArticleVersionValue(key, lang, entry, anchor) {
    const arr = normalizeComposerVersionPaths(entry && entry[lang]);
    const existingVersions = collectComposerArticleVersions(arr);
    const langLabel = displayLangName(lang);
    const result = await showComposerAddEntryPrompt(anchor, {
      typeLabel: t('editor.composer.versionPrompt.label'),
      confirmLabel: t('editor.composer.versionPrompt.confirm'),
      placeholder: t('editor.composer.versionPrompt.placeholder'),
      message: t('editor.composer.versionPrompt.message', { key, lang: langLabel }),
      hint: t('editor.composer.versionPrompt.hint'),
      validate: (value) => {
        if (!value) return { ok: false, error: t('editor.composer.versionPrompt.errorEmpty') };
        if (!isComposerVersionTag(value)) return { ok: false, error: t('editor.composer.versionPrompt.errorInvalid') };
        const normalizedVersion = normalizeComposerVersionTag(value);
        if (existingVersions.has(normalizedVersion.toLowerCase())) {
          return { ok: false, error: t('editor.composer.versionPrompt.errorDuplicate', { version: normalizedVersion }) };
        }
        return { ok: true, value: normalizedVersion };
      }
    });
    return result && result.confirmed ? String(result.value || '').trim() : '';
  }

  async function promptComposerEntryKey(kind, anchor) {
    const normalized = kind === 'tabs' ? 'tabs' : 'index';
    const slice = getStateSlice(normalized) || {};
    const existing = new Set();
    try {
      const order = Array.isArray(slice.__order) ? slice.__order : [];
      order.forEach((key) => {
        const normalizedKey = String(key || '').trim();
        if (normalizedKey) existing.add(normalizedKey);
      });
    } catch (_) {}
    try {
      Object.keys(slice || {}).forEach((key) => {
        if (key === '__order') return;
        const normalizedKey = String(key || '').trim();
        if (normalizedKey) existing.add(normalizedKey);
      });
    } catch (_) {}

    const typeKey = normalized === 'tabs' ? 'tab' : 'post';
    const typeLabel = t(`editor.composer.entryKinds.${typeKey}.label`);
    const confirmLabel = t(`editor.composer.entryKinds.${typeKey}.confirm`);
    const placeholder = t(`editor.composer.entryKinds.${typeKey}.placeholder`);
    const message = t(`editor.composer.entryKinds.${typeKey}.message`);

    try {
      const result = await showComposerAddEntryPrompt(anchor, {
        typeLabel,
        confirmLabel,
        placeholder,
        existingKeys: existing,
        message
      });
      if (!result || !result.confirmed) return '';
      return String(result.value || '').trim();
    } catch (err) {
      const consoleRef = options.consoleRef || console;
      if (consoleRef && typeof consoleRef.warn === 'function') consoleRef.warn('Failed to capture new entry key', err);
      return '';
    }
  }

  function focusComposerEntry(kind, key) {
    const normalized = kind === 'tabs' ? 'tabs' : 'index';
    const root = documentRef
      ? documentRef.getElementById(normalized === 'tabs' ? 'composerTabs' : 'composerIndex')
      : null;
    if (!root) return;
    const selector = normalized === 'tabs' ? `.ct-item[data-key="${cssEscape(key)}"]` : `.ci-item[data-key="${cssEscape(key)}"]`;
    const row = root.querySelector(selector);
    if (!row) return;
    const body = row.querySelector(normalized === 'tabs' ? '.ct-body' : '.ci-body');
    const expandBtn = row.querySelector(normalized === 'tabs' ? '.ct-expand' : '.ci-expand');
    if (body) {
      body.style.display = 'block';
      body.dataset.open = '1';
      clearInlineSlideStyles(body);
    }
    if (expandBtn) expandBtn.setAttribute('aria-expanded', 'true');
    row.classList.add('is-open');

    const preferredFocus = row.querySelector(normalized === 'tabs' ? '.ct-edit' : '.ci-lang-addver, .ci-edit');
    const fallbackFocus = row.querySelector('input, textarea, button');
    const target = preferredFocus || fallbackFocus;
    if (target && typeof target.focus === 'function') {
      try { target.focus(); } catch (_) {}
    }
    try { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}

    scheduleComposerOrderPreviewRelayout(normalized);
  }

  async function addComposerEntry(kind, anchor) {
    const normalized = kind === 'tabs' ? 'tabs' : 'index';
    const slice = getStateSlice(normalized);
    if (!slice) return '';
    if (!Array.isArray(slice.__order)) slice.__order = [];

    let key = '';
    try {
      key = await promptComposerEntryKey(normalized, anchor);
    } catch (err) {
      const consoleRef = options.consoleRef || console;
      if (consoleRef && typeof consoleRef.warn === 'function') consoleRef.warn('Failed to add composer entry', err);
      return '';
    }
    if (!key) return '';
    if (slice.__order.includes(key)) return '';

    if (normalized === 'tabs') {
      slice[key] = (slice[key] && typeof slice[key] === 'object') ? slice[key] : {};
      const lang = getDefaultComposerLanguage();
      if (lang && !slice[key][lang]) {
        const defaultPath = buildDefaultEntryPath('tabs', key, lang);
        slice[key][lang] = { title: key, location: defaultPath };
      }
    } else {
      slice[key] = (slice[key] && typeof slice[key] === 'object') ? slice[key] : {};
      const lang = getDefaultComposerLanguage();
      if (lang && !slice[key][lang]) {
        const defaultPath = buildDefaultEntryPath('index', key, lang);
        slice[key][lang] = [defaultPath];
      }
    }

    slice.__order.unshift(key);

    if (normalized === 'index') {
      rebuildIndexUI();
      notifyComposerChange('index');
    } else {
      rebuildTabsUI();
      notifyComposerChange('tabs');
    }

    requestAnimationFrameRef(() => focusComposerEntry(normalized, key));

    const message = normalized === 'tabs'
      ? `Tab entry "${key}" added. Fill in the details below.`
      : `Post entry "${key}" added. Fill in the details below.`;
    try { showToast('info', message); } catch (_) {}
    refreshEditorContentTree();
    return key;
  }

  return {
    addComposerEntry,
    addEditorLanguage,
    addEditorVersion,
    deleteEditorEntry,
    focusComposerEntry,
    moveEditorVersion,
    moveEditorVersionTo,
    promptArticleVersionValue,
    promptComposerEntryKey,
    removeEditorLanguage,
    removeEditorVersion,
    renameEditorEntry,
    restoreDeletedEditorTreeNode,
    validateEntryKey
  };
}
