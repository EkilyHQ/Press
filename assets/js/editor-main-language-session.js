const noop = () => {};

function resolveTarget(getter) {
  if (typeof getter !== 'function') return null;
  try { return getter() || null; }
  catch (_) { return null; }
}

export function createEditorMainLanguageSession(options = {}) {
  const runtime = options.runtime || {};
  const getToolbarSession = options.getToolbarSession || (() => null);
  const getCurrentFileSession = options.getCurrentFileSession || (() => null);
  const getBlocksSession = options.getBlocksSession || (() => null);
  const getMetadataPanel = options.getMetadataPanel || (() => null);

  const syncLanguage = () => {
    const toolbarSession = resolveTarget(getToolbarSession);
    if (toolbarSession && typeof toolbarSession.syncLanguage === 'function') {
      toolbarSession.syncLanguage();
    }

    const currentFileSession = resolveTarget(getCurrentFileSession);
    if (currentFileSession && typeof currentFileSession.render === 'function') {
      currentFileSession.render();
    }

    const blocksSession = resolveTarget(getBlocksSession);
    if (blocksSession && typeof blocksSession.requestLayout === 'function') {
      blocksSession.requestLayout();
    }

    const metadataPanel = resolveTarget(getMetadataPanel);
    if (metadataPanel && typeof metadataPanel.syncLanguage === 'function') {
      metadataPanel.syncLanguage();
    }
  };

  const bind = () => {
    if (!runtime || typeof runtime.onDocument !== 'function') return noop;
    return runtime.onDocument('press-editor-language-applied', syncLanguage) || noop;
  };

  return {
    bind,
    syncLanguage
  };
}
