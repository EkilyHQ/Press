const noop = () => {};

function getTextArea(editor, textarea) {
  if (editor && editor.textarea) return editor.textarea;
  return textarea || null;
}

function setEditorBody(editor, textarea, value) {
  const text = value == null ? '' : String(value);
  try {
    if (editor && typeof editor.setValue === 'function') {
      editor.setValue(text);
      return text;
    }
  } catch (_) {}
  if (textarea) {
    try { textarea.value = text; } catch (_) {}
  }
  return text;
}

export function createEditorMainDocumentSession(options = {}) {
  const runtime = options.runtime || {};
  const editor = options.editor || null;
  const textarea = options.textarea || null;
  const metadataPanel = options.metadataPanel || {};
  const workspaceSession = options.workspaceSession || {};
  const getPreviewSession = typeof options.getPreviewSession === 'function'
    ? options.getPreviewSession
    : () => null;
  const getBlocksSession = typeof options.getBlocksSession === 'function'
    ? options.getBlocksSession
    : () => null;
  const requestLayout = typeof options.requestLayout === 'function' ? options.requestLayout : noop;
  const setBaseDir = typeof options.setBaseDir === 'function' ? options.setBaseDir : noop;
  const setCurrentFileLabel = typeof options.setCurrentFileLabel === 'function'
    ? options.setCurrentFileLabel
    : noop;

  const changeListeners = new Set();
  let inputBound = false;

  const getEditorTextarea = () => getTextArea(editor, textarea);

  const getEditorBody = () => {
    try {
      if (editor && typeof editor.getValue === 'function') return editor.getValue() || '';
    } catch (_) {}
    if (textarea) {
      try { return textarea.value || ''; } catch (_) {}
    }
    return '';
  };

  const buildMarkdown = (body) => {
    if (metadataPanel && typeof metadataPanel.buildMarkdown === 'function') {
      return metadataPanel.buildMarkdown(body);
    }
    return body == null ? '' : String(body);
  };

  const getValue = () => {
    const body = getEditorBody();
    if (metadataPanel && typeof metadataPanel.buildEditorValue === 'function') {
      return metadataPanel.buildEditorValue(body);
    }
    return buildMarkdown(body);
  };

  const notifyChange = () => {
    const value = getValue();
    changeListeners.forEach((fn) => {
      try { fn(value); } catch (_) {}
    });
  };

  const renderPreviewValue = (value) => {
    const previewSession = getPreviewSession();
    try {
      if (previewSession && typeof previewSession.render === 'function') {
        previewSession.render(value == null ? getValue() : value);
        return true;
      }
    } catch (_) {}
    return false;
  };

  const refreshPreview = () => renderPreviewValue(getValue());

  const syncBlocksIfVisible = (body) => {
    const blocksSession = getBlocksSession();
    if (blocksSession && typeof blocksSession.syncIfVisible === 'function') {
      try { return blocksSession.syncIfVisible(body); } catch (_) {}
    }
    return false;
  };

  const setBodyOnly = (body) => {
    const text = setEditorBody(editor, textarea, body);
    requestLayout();
    return text;
  };

  const setValue = (value, opts = {}) => {
    const text = value == null ? '' : String(value);
    const { preview = true, notify = true } = opts;
    const bodyText = metadataPanel && typeof metadataPanel.setEditorValue === 'function'
      ? metadataPanel.setEditorValue(text, { silent: true })
      : text;
    setBodyOnly(bodyText);
    syncBlocksIfVisible(bodyText);
    if (preview) refreshPreview();
    if (notify) notifyChange();
    return bodyText;
  };

  const setBodyFromBlocks = (body) => {
    const text = setBodyOnly(body);
    refreshPreview();
    notifyChange();
    return text;
  };

  const handleInput = () => {
    refreshPreview();
    notifyChange();
  };

  const bindInput = () => {
    if (inputBound) return false;
    const input = getEditorTextarea();
    if (!input || typeof input.addEventListener !== 'function') return false;
    input.addEventListener('input', handleInput);
    inputBound = true;
    return true;
  };

  const renderInitial = (seed = '') => {
    const initial = (getValue() || '').trim();
    if (!initial) {
      setValue(seed, { notify: false });
      return 'seeded';
    }
    renderPreviewValue(initial);
    return 'rendered';
  };

  const focus = () => {
    try {
      if (editor && typeof editor.focus === 'function') {
        editor.focus();
        return true;
      }
    } catch (_) {}
    const input = getEditorTextarea();
    try {
      if (input && typeof input.focus === 'function') {
        input.focus();
        return true;
      }
    } catch (_) {}
    return false;
  };

  const onChange = (fn) => {
    if (typeof fn !== 'function') return () => {};
    changeListeners.add(fn);
    return () => { changeListeners.delete(fn); };
  };

  const createPrimaryEditorApi = () => ({
    getValue,
    setValue: (value, opts = {}) => setValue(value, opts),
    focus,
    setView: (mode, opts = {}) => (
      typeof workspaceSession.setView === 'function' ? workspaceSession.setView(mode, opts) : undefined
    ),
    restorePersistedView: (opts = {}) => (
      typeof workspaceSession.restorePersistedView === 'function'
        ? workspaceSession.restorePersistedView(opts)
        : undefined
    ),
    getView: () => (
      typeof workspaceSession.getView === 'function' ? workspaceSession.getView() : 'blocks'
    ),
    setBaseDir: (dir) => setBaseDir(dir),
    setCurrentFileLabel: (label) => setCurrentFileLabel(label),
    setFrontMatterVisible: (visible) => (
      typeof metadataPanel.setFrontMatterVisible === 'function'
        ? metadataPanel.setFrontMatterVisible(visible)
        : undefined
    ),
    setTabsMetadata: (value, opts = {}) => (
      typeof metadataPanel.setTabsMetadata === 'function'
        ? metadataPanel.setTabsMetadata(value, opts)
        : undefined
    ),
    onChange,
    onTabsMetadataChange: (fn) => (
      typeof metadataPanel.onTabsMetadataChange === 'function'
        ? metadataPanel.onTabsMetadataChange(fn)
        : () => {}
    ),
    refreshPreview,
    requestLayout: () => { requestLayout(); },
    setWrap: (value, opts = {}) => {
      if (typeof workspaceSession.setWrap === 'function') workspaceSession.setWrap(value, opts);
    },
    isWrapEnabled: () => (
      typeof workspaceSession.isWrapEnabled === 'function' ? workspaceSession.isWrapEnabled() : false
    )
  });

  const registerPrimaryEditorApi = () => {
    const api = createPrimaryEditorApi();
    if (runtime && typeof runtime.registerPrimaryEditorApi === 'function') {
      runtime.registerPrimaryEditorApi(api);
    }
    return api;
  };

  return {
    getEditorTextarea,
    getEditorBody,
    buildMarkdown,
    getValue,
    setValue,
    setBodyFromBlocks,
    notifyChange,
    refreshPreview,
    onChange,
    bindInput,
    renderInitial,
    focus,
    createPrimaryEditorApi,
    registerPrimaryEditorApi
  };
}
