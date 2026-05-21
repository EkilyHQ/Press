export function animateEditorSystemPanelContent({
  windowRef = window,
  documentRef = document
} = {}) {
  const panel = documentRef.getElementById('editorSystemPanel');
  if (!panel) return;
  try {
    const previousTimer = panel.__pressSystemAnimationTimer;
    if (previousTimer) windowRef.clearTimeout(previousTimer);
  } catch (_) {}
  panel.classList.remove('is-content-entering');
  try { panel.getBoundingClientRect(); } catch (_) {}
  panel.classList.add('is-content-entering');
  try {
    panel.__pressSystemAnimationTimer = windowRef.setTimeout(() => {
      panel.classList.remove('is-content-entering');
      panel.__pressSystemAnimationTimer = null;
    }, 260);
  } catch (_) {}
}

export function showEditorSystemPanel(mode, deps = {}) {
  const {
    documentRef = document,
    treeText = (_key, fallback) => fallback,
    mountEditorSystemPanels = () => {},
    setEditorSystemPanelVisible = () => {},
    getActiveComposerFile = () => '',
    applyComposerFile = () => {},
    resetSiteSettingsNavOnOpen = () => {},
    refreshSyncCommitPanel = () => {},
    animatePanel = () => animateEditorSystemPanelContent({ documentRef })
  } = deps;
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
