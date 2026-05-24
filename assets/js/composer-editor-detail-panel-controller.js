function noop() {}

function isSystemDetailMode(mode) {
  return mode === 'composer' || mode === 'themes' || mode === 'updates' || mode === 'sync';
}

function getElement(documentRef, id) {
  try {
    return documentRef && typeof documentRef.getElementById === 'function'
      ? documentRef.getElementById(id)
      : null;
  } catch (_) {
    return null;
  }
}

function setPanelVisible(panel, visible) {
  if (!panel) return;
  if (visible) {
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
    return;
  }
  panel.setAttribute('hidden', '');
  panel.setAttribute('aria-hidden', 'true');
}

export function createComposerEditorDetailPanelController(options = {}) {
  const documentRef = options.documentRef || null;
  const setSystemPanelVisible = typeof options.setSystemPanelVisible === 'function'
    ? options.setSystemPanelVisible
    : noop;
  const showSystemPanel = typeof options.showSystemPanel === 'function'
    ? options.showSystemPanel
    : noop;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function'
    ? options.setTimeoutRef
    : () => null;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function'
    ? options.clearTimeoutRef
    : () => {};

  function getStructurePanel() {
    return getElement(documentRef, 'editorStructurePanel');
  }

  function getMarkdownPanel() {
    return getElement(documentRef, 'editorMarkdownPanel');
  }

  function setEditorStructurePanelVisible(visible) {
    setPanelVisible(getStructurePanel(), !!visible);
  }

  function setEditorMarkdownPanelVisible(visible) {
    const panel = getMarkdownPanel();
    setPanelVisible(panel, !!visible);
    if (!visible && panel && panel.classList) panel.classList.remove('is-content-entering');
  }

  function setEditorDetailPanelMode(mode) {
    const showMarkdown = mode === 'markdown';
    const showStructure = mode === 'structure';
    const showSystem = isSystemDetailMode(mode);
    setEditorStructurePanelVisible(showStructure);
    setEditorMarkdownPanelVisible(showMarkdown);
    setSystemPanelVisible(showSystem);
    if (showSystem) showSystemPanel(mode);
  }

  function animatePanelContent(panel, timerKey) {
    if (!panel || !panel.classList) return;
    try {
      const previousTimer = panel[timerKey];
      if (previousTimer) clearTimeoutRef(previousTimer);
    } catch (_) {}
    panel.classList.remove('is-content-entering');
    try { panel.getBoundingClientRect(); } catch (_) {}
    panel.classList.add('is-content-entering');
    try {
      panel[timerKey] = setTimeoutRef(() => {
        panel.classList.remove('is-content-entering');
        panel[timerKey] = null;
      }, 260);
    } catch (_) {}
  }

  function animateEditorStructurePanelContent(panel = getStructurePanel()) {
    animatePanelContent(panel, '__pressStructureAnimationTimer');
  }

  function animateEditorMarkdownPanelContent(panel = getMarkdownPanel()) {
    animatePanelContent(panel, '__pressMarkdownAnimationTimer');
  }

  return {
    animateEditorMarkdownPanelContent,
    animateEditorStructurePanelContent,
    setEditorDetailPanelMode,
    setEditorMarkdownPanelVisible,
    setEditorStructurePanelVisible
  };
}
