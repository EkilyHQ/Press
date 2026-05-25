function resolveTarget(getter) {
  if (typeof getter !== 'function') return null;
  try { return getter() || null; }
  catch (_) { return null; }
}

function fallbackInferSource(path) {
  const normalized = String(path || '').replace(/[\\]+/g, '/').replace(/^\/+/, '').toLowerCase();
  if (normalized.startsWith('tab/')) return 'tabs';
  return normalized ? 'article' : '';
}

function fallbackCurrentFileInfo(input, inferSource) {
  if (input && typeof input === 'object') {
    const path = input.path != null ? String(input.path || '').trim() : '';
    const source = input.source != null && String(input.source || '').trim()
      ? String(input.source || '').trim().toLowerCase()
      : inferSource(path);
    return { ...input, path, source };
  }
  const path = String(input || '').trim();
  return { path, source: inferSource(path) };
}

export function createEditorMainFileContextService(options = {}) {
  const getCurrentFileSession = options.getCurrentFileSession || (() => null);
  const getMetadataPanel = options.getMetadataPanel || (() => null);
  const getPreviewSession = options.getPreviewSession || (() => null);
  const getDocumentSession = options.getDocumentSession || (() => null);

  const inferCurrentFileSource = (path) => {
    const metadataPanel = resolveTarget(getMetadataPanel);
    if (metadataPanel && typeof metadataPanel.inferCurrentFileSource === 'function') {
      return metadataPanel.inferCurrentFileSource(path);
    }
    return fallbackInferSource(path);
  };

  const getCurrentFileInfo = () => {
    const currentFileSession = resolveTarget(getCurrentFileSession);
    return currentFileSession && typeof currentFileSession.getInfo === 'function'
      ? currentFileSession.getInfo()
      : {};
  };

  const getCurrentMarkdownPath = () => {
    const currentFileSession = resolveTarget(getCurrentFileSession);
    return currentFileSession && typeof currentFileSession.getPath === 'function'
      ? currentFileSession.getPath()
      : '';
  };

  const bindCurrentFileElement = (el) => {
    const currentFileSession = resolveTarget(getCurrentFileSession);
    if (currentFileSession && typeof currentFileSession.bindElement === 'function') {
      currentFileSession.bindElement(el);
      return true;
    }
    return false;
  };

  const renderCurrentFile = () => {
    const currentFileSession = resolveTarget(getCurrentFileSession);
    if (currentFileSession && typeof currentFileSession.render === 'function') {
      currentFileSession.render();
      return true;
    }
    return false;
  };

  const handleCurrentFileRendered = () => {
    const previewSession = resolveTarget(getPreviewSession);
    if (previewSession && typeof previewSession.updatePathLabel === 'function') {
      previewSession.updatePathLabel();
      return true;
    }
    return false;
  };

  const setCurrentFileLabel = (input) => {
    const currentFileSession = resolveTarget(getCurrentFileSession);
    const info = currentFileSession && typeof currentFileSession.set === 'function'
      ? currentFileSession.set(input)
      : fallbackCurrentFileInfo(input, inferCurrentFileSource);

    const metadataPanel = resolveTarget(getMetadataPanel);
    if (metadataPanel && typeof metadataPanel.applyCurrentFileSource === 'function') {
      metadataPanel.applyCurrentFileSource(info && info.source);
    }

    const previewSession = resolveTarget(getPreviewSession);
    if (previewSession && typeof previewSession.setCurrentFileInfo === 'function') {
      previewSession.setCurrentFileInfo(info);
    }
    if (previewSession && typeof previewSession.refreshAssetOverrides === 'function') {
      previewSession.refreshAssetOverrides();
    }

    const documentSession = resolveTarget(getDocumentSession);
    if (documentSession && typeof documentSession.refreshPreview === 'function') {
      documentSession.refreshPreview();
    }

    return info;
  };

  return {
    bindCurrentFileElement,
    getCurrentFileInfo,
    getCurrentMarkdownPath,
    handleCurrentFileRendered,
    inferCurrentFileSource,
    renderCurrentFile,
    setCurrentFileLabel
  };
}
