export function animateEditorSystemPanelContent({
  windowRef = null,
  documentRef = null,
  setTimeoutRef = null,
  clearTimeoutRef = null
} = {}) {
  if (!documentRef || typeof documentRef.getElementById !== 'function') return;
  const panel = documentRef.getElementById('editorSystemPanel');
  if (!panel) return;
  const setTimer = typeof setTimeoutRef === 'function'
    ? setTimeoutRef
    : (handler, delay) => (windowRef && typeof windowRef.setTimeout === 'function'
      ? windowRef.setTimeout(handler, delay)
      : null);
  const clearTimer = typeof clearTimeoutRef === 'function'
    ? clearTimeoutRef
    : (id) => {
      if (id == null) return;
      if (windowRef && typeof windowRef.clearTimeout === 'function') windowRef.clearTimeout(id);
    };
  try {
    const previousTimer = panel.__pressSystemAnimationTimer;
    if (previousTimer) clearTimer(previousTimer);
  } catch (_) {}
  panel.classList.remove('is-content-entering');
  try { panel.getBoundingClientRect(); } catch (_) {}
  panel.classList.add('is-content-entering');
  try {
    panel.__pressSystemAnimationTimer = setTimer(() => {
      panel.classList.remove('is-content-entering');
      panel.__pressSystemAnimationTimer = null;
    }, 260);
  } catch (_) {}
}

export function showEditorSystemPanel(mode, deps = {}) {
  const {
    documentRef = null,
    windowRef = null,
    setTimeoutRef = null,
    clearTimeoutRef = null,
    treeText = (_key, fallback) => fallback,
    mountEditorSystemPanels = () => {},
    setEditorSystemPanelVisible = () => {},
    getActiveComposerFile = () => '',
    applyComposerFile = () => {},
    resetSiteSettingsNavOnOpen = () => {},
    refreshSyncCommitPanel = () => {},
    animatePanel = () => animateEditorSystemPanelContent({
      documentRef,
      windowRef,
      setTimeoutRef,
      clearTimeoutRef
    })
  } = deps;
  if (!documentRef || typeof documentRef.getElementById !== 'function') return;
  const nextMode = mode === 'sync' ? 'sync' : (mode === 'updates' ? 'updates' : (mode === 'themes' ? 'themes' : 'composer'));
  mountEditorSystemPanels();
  const panel = documentRef.getElementById('editorSystemPanel');
  const title = documentRef.getElementById('editorSystemTitle');
  const kicker = documentRef.getElementById('editorSystemKicker');
  const meta = documentRef.getElementById('editorSystemMeta');
  const actions = documentRef.getElementById('editorSystemActions');
  const composerActions = documentRef.getElementById('editorModalComposerActions');
  const themeActions = documentRef.getElementById('editorModalThemeActions');
  const updateActions = documentRef.getElementById('editorModalUpdateActions');
  const syncActions = documentRef.getElementById('editorModalSyncActions');
  const composerPanel = documentRef.getElementById('mode-composer');
  const themesPanel = documentRef.getElementById('mode-themes');
  const updatesPanel = documentRef.getElementById('mode-updates');
  const syncPanel = documentRef.getElementById('mode-sync');
  if (!panel) return;

  setEditorSystemPanelVisible(true);
  if (kicker) kicker.textContent = treeText('system', 'System');
  if (title) {
    title.textContent = nextMode === 'sync'
      ? treeText('sync', 'Publish')
      : (nextMode === 'updates'
        ? treeText('pressUpdates', 'Press Updates')
        : (nextMode === 'themes'
          ? treeText('themes', 'Themes')
          : treeText('siteSettings', 'Site Settings')));
  }
  if (meta) {
    meta.textContent = nextMode === 'sync'
      ? treeText('syncMeta', 'Publish local changes to GitHub.')
      : (nextMode === 'updates'
        ? treeText('systemUpdatesMeta', 'Review and apply Press updates.')
        : (nextMode === 'themes'
          ? treeText('themesMeta', 'Theme packs.')
          : treeText('siteSettingsMeta', 'Edit site.yaml settings.')));
  }

  if (actions) {
    [
      ['composer', composerActions],
      ['themes', themeActions],
      ['updates', updateActions],
      ['sync', syncActions]
    ].forEach(([key, actionSet]) => {
      if (!actionSet) return;
      if (actionSet.parentElement !== actions) actions.appendChild(actionSet);
      const active = key === nextMode;
      actionSet.hidden = !active;
      actionSet.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
  }

  [
    ['composer', composerPanel],
    ['themes', themesPanel],
    ['updates', updatesPanel],
    ['sync', syncPanel]
  ].forEach(([key, modePanel]) => {
    const active = key === nextMode;
    if (!modePanel) return;
    modePanel.hidden = !active;
    modePanel.setAttribute('aria-hidden', active ? 'false' : 'true');
    modePanel.style.display = active ? '' : 'none';
  });

  if (nextMode === 'composer') {
    try {
      if (getActiveComposerFile() !== 'site') applyComposerFile('site', { force: true, immediate: true });
    } catch (_) {}
    resetSiteSettingsNavOnOpen();
  } else if (nextMode === 'sync') {
    refreshSyncCommitPanel();
  }
  animatePanel();
}
