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

function queryAll(documentRef, selector) {
  try {
    return documentRef && typeof documentRef.querySelectorAll === 'function'
      ? Array.from(documentRef.querySelectorAll(selector))
      : [];
  } catch (_) {
    return [];
  }
}

function setToolbarBusyState(button, busy, text, setButtonLabel = noop) {
  if (!button) return;
  if (busy) {
    button.classList.add('is-busy');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.setAttribute('aria-disabled', 'true');
    if (text) setButtonLabel(button, text);
    return;
  }
  button.classList.remove('is-busy');
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.setAttribute('aria-disabled', 'false');
  if (text) setButtonLabel(button, text);
}

export function bindComposerMarkdownToolbar({
  documentRef,
  t = (key) => key,
  setMarkdownPushButton = noop,
  setMarkdownSaveButton = noop,
  setMarkdownProtectionButton = noop,
  setMarkdownDiscardButton = noop,
  getMarkdownPushButton = () => null,
  getActiveDynamicTab = () => null,
  getButtonLabel = () => '',
  getMarkdownPushLabel = () => '',
  setButtonLabel = noop,
  showToast = noop,
  openMarkdownPushOnGitHub = noop,
  updateMarkdownPushButton = noop,
  updateMarkdownProtectionButton = noop,
  manualSaveActiveMarkdown = noop,
  handleMarkdownProtectionButton = noop,
  discardMarkdownLocalChanges = noop,
  updateMarkdownSaveButton = noop,
  updateMarkdownDiscardButton = noop
} = {}) {
  const pushBtn = getElement(documentRef, 'btnPushMarkdown');
  if (pushBtn) {
    setMarkdownPushButton(pushBtn);
    pushBtn.addEventListener('click', async (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      const active = getActiveDynamicTab();
      if (!active) {
        showToast('info', t('editor.toasts.markdownOpenBeforePush'));
        return;
      }

      const button = getMarkdownPushButton();
      const originalLabel = getButtonLabel(button) || getMarkdownPushLabel('default');
      setToolbarBusyState(button, true, t('editor.composer.remoteWatcher.preparing'), setButtonLabel);
      try {
        await openMarkdownPushOnGitHub(active);
      } finally {
        setToolbarBusyState(button, false, originalLabel, setButtonLabel);
        updateMarkdownPushButton(active);
        updateMarkdownProtectionButton(active);
      }
    });
    updateMarkdownPushButton(getActiveDynamicTab());
  }

  const saveBtn = getElement(documentRef, 'btnSaveMarkdown');
  if (saveBtn) {
    setMarkdownSaveButton(saveBtn);
    saveBtn.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      manualSaveActiveMarkdown(saveBtn);
    });
    updateMarkdownSaveButton(getActiveDynamicTab());
  }

  const protectBtn = getElement(documentRef, 'btnProtectMarkdown');
  if (protectBtn) {
    setMarkdownProtectionButton(protectBtn);
    protectBtn.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      handleMarkdownProtectionButton(protectBtn);
    });
    updateMarkdownProtectionButton(getActiveDynamicTab());
  }

  const discardBtn = getElement(documentRef, 'btnDiscardMarkdown');
  if (discardBtn) {
    setMarkdownDiscardButton(discardBtn);
    discardBtn.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      discardMarkdownLocalChanges(null, discardBtn);
    });
    updateMarkdownDiscardButton(getActiveDynamicTab());
  }
}

export function bindComposerWorkspaceUi({
  documentRef,
  consoleRef = console,
  mountEditorSystemPanels = noop,
  initEditorOverlay = noop,
  initEditorRailResize = noop,
  initMobileEditorRail = noop,
  bindEditorStatePersistenceListeners = noop,
  openEditorOverlay = noop,
  applyMode = noop,
  initSystemThemeBridge = noop,
  setComposerFile = noop,
  getInitialComposerFile = () => 'index',
  getActiveComposerFile = () => 'index',
  addComposerEntry = noop,
  handleComposerDiscard = noop,
  handleComposerRefresh = noop,
  computeUnsyncedSummary = () => [],
  openComposerDiffModal = noop,
  bindVerifySetup = noop
} = {}) {
  mountEditorSystemPanels();
  initEditorOverlay();
  initEditorRailResize();
  initMobileEditorRail();
  bindEditorStatePersistenceListeners();

  queryAll(documentRef, '.mode-tab').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const mode = btn.dataset && btn.dataset.mode;
      if (mode === 'composer' || mode === 'themes' || mode === 'updates' || mode === 'sync') {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        openEditorOverlay(mode, btn);
        return;
      }
      applyMode(mode);
    });
  });
  initSystemThemeBridge();

  queryAll(documentRef, 'a.vt-btn[data-cfile]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setComposerFile(link.dataset && link.dataset.cfile);
    });
  });
  setComposerFile(getInitialComposerFile(), { immediate: true });

  const btnAddItem = getElement(documentRef, 'btnAddItem');
  if (btnAddItem) {
    btnAddItem.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      const kind = getActiveComposerFile();
      const anchor = event && event.currentTarget ? event.currentTarget : btnAddItem;
      Promise.resolve(addComposerEntry(kind, anchor)).catch((err) => {
        if (consoleRef && typeof consoleRef.error === 'function') {
          consoleRef.error('Failed to launch add entry prompt', err);
        }
      });
    });
  }

  const btnDiscard = getElement(documentRef, 'btnDiscard');
  if (btnDiscard) btnDiscard.addEventListener('click', () => handleComposerDiscard(btnDiscard));

  const btnRefresh = getElement(documentRef, 'btnRefresh');
  if (btnRefresh) btnRefresh.addEventListener('click', () => handleComposerRefresh(btnRefresh));

  const btnReview = getElement(documentRef, 'btnReview');
  if (btnReview) {
    btnReview.addEventListener('click', () => {
      const datasetKind = btnReview.dataset && btnReview.dataset.kind;
      const preferred = datasetKind === 'tabs' ? 'tabs' : datasetKind === 'index' ? 'index' : null;
      if (preferred) {
        openComposerDiffModal(preferred);
        return;
      }
      const summaryEntries = computeUnsyncedSummary();
      const activeKind = getActiveComposerFile();
      const normalizedActive = activeKind === 'tabs' ? 'tabs' : 'index';
      const entry = summaryEntries.find(item => item && item.kind === normalizedActive);
      if (entry) openComposerDiffModal(entry.kind);
    });
  }

  bindVerifySetup();
}

export async function loadInitialComposerState({
  windowRef,
  consoleRef = console,
  t = (key) => key,
  fetchTrackedSiteConfig,
  applyEffectiveSiteConfig,
  fetchConfigWithYamlFallback,
  prepareSiteState,
  prepareIndexState,
  prepareTabsState,
  cloneSiteState,
  deepClone,
  setRemoteBaseline,
  getActiveDynamicTab = () => null,
  updateMarkdownPushButton = noop,
  showStatus = noop
} = {}) {
  try {
    if (windowRef && (!windowRef.__press_site_repo || typeof windowRef.__press_site_repo !== 'object')) {
      windowRef.__press_site_repo = { owner: '', name: '', branch: 'main' };
    }
  } catch (_) {}

  const state = { index: {}, tabs: {}, site: {} };
  showStatus(t('editor.composer.statusMessages.loadingConfig'));
  try {
    const site = await fetchTrackedSiteConfig();
    const effectiveSite = applyEffectiveSiteConfig(site);
    const root = effectiveSite && effectiveSite.contentRoot ? String(effectiveSite.contentRoot) : 'wwwroot';
    updateMarkdownPushButton(getActiveDynamicTab());
    const remoteSite = prepareSiteState(site || {});
    const [idx, tbs] = await Promise.all([
      fetchConfigWithYamlFallback([`${root}/index.yaml`, `${root}/index.yml`]),
      fetchConfigWithYamlFallback([`${root}/tabs.yaml`, `${root}/tabs.yml`])
    ]);
    const remoteIndex = prepareIndexState(idx || {});
    const remoteTabs = prepareTabsState(tbs || {});
    setRemoteBaseline('index', deepClone(remoteIndex));
    setRemoteBaseline('tabs', deepClone(remoteTabs));
    setRemoteBaseline('site', cloneSiteState(remoteSite));
    state.index = deepClone(remoteIndex);
    state.tabs = deepClone(remoteTabs);
    state.site = cloneSiteState(remoteSite);
  } catch (err) {
    if (consoleRef && typeof consoleRef.warn === 'function') {
      consoleRef.warn('Composer: failed to load configs', err);
    }
    setRemoteBaseline('index', { __order: [] });
    setRemoteBaseline('tabs', { __order: [] });
    setRemoteBaseline('site', cloneSiteState(prepareSiteState({})));
    state.index = { __order: [] };
    state.tabs = { __order: [] };
    state.site = cloneSiteState(prepareSiteState({}));
    updateMarkdownPushButton(getActiveDynamicTab());
  }

  return state;
}

export function assembleComposerWorkspace({
  documentRef,
  windowRef,
  t = (key) => key,
  state,
  loadDraftSnapshotsIntoState,
  applyInferredRepoConfig,
  inferRepoConfigFromGitHubPagesUrl,
  applyEffectiveSiteConfig,
  updateMarkdownPushButton = noop,
  getActiveDynamicTab = () => null,
  showStatus = noop,
  bindWorkspaceUi,
  buildIndexUI,
  buildTabsUI,
  buildSiteUI,
  notifyComposerChange,
  refreshEditorContentTree,
  restoreDynamicEditorState,
  applyMode,
  setAllowEditorStatePersist,
  persistDynamicEditorState,
  setTimeoutRef = (handler, delay) => setTimeout(handler, delay)
} = {}) {
  const restoredDrafts = loadDraftSnapshotsIntoState(state);
  let inferredSiteRepoApplied = false;
  try {
    inferredSiteRepoApplied = applyInferredRepoConfig(
      state.site,
      inferRepoConfigFromGitHubPagesUrl(windowRef && windowRef.location)
    );
  } catch (_) {
    inferredSiteRepoApplied = false;
  }
  applyEffectiveSiteConfig(state.site);
  updateMarkdownPushButton(getActiveDynamicTab());

  if (restoredDrafts.length) {
    const label = restoredDrafts
      .map(k => (k === 'tabs' ? 'tabs.yaml' : k === 'site' ? 'site.yaml' : 'index.yaml'))
      .join(' & ');
    showStatus(t('editor.composer.statusMessages.restoredDraft', { label }));
    setTimeoutRef(() => { showStatus(''); }, 1800);
  } else {
    showStatus('');
  }

  bindWorkspaceUi(state);
  buildIndexUI(getElement(documentRef, 'composerIndex'), state);
  buildTabsUI(getElement(documentRef, 'composerTabs'), state);
  buildSiteUI(getElement(documentRef, 'composerSite'), state);

  notifyComposerChange('index', { skipAutoSave: true });
  notifyComposerChange('tabs', { skipAutoSave: true });
  notifyComposerChange('site', inferredSiteRepoApplied ? {} : { skipAutoSave: true });

  refreshEditorContentTree();
  const restoredEditorState = restoreDynamicEditorState();
  if (!restoredEditorState) applyMode('editor');
  setAllowEditorStatePersist(true);
  if (restoredEditorState) {
    try {
      setTimeoutRef(() => persistDynamicEditorState(), 500);
    } catch (_) {
      persistDynamicEditorState();
    }
  } else {
    persistDynamicEditorState();
  }

  return {
    restoredDrafts,
    inferredSiteRepoApplied,
    restoredEditorState
  };
}

export async function initializeComposerOnDomReady(options = {}) {
  const {
    documentRef,
    markdownToolbar,
    initialState,
    workspace,
    setActiveComposerState = noop
  } = options;

  bindComposerMarkdownToolbar({
    documentRef,
    ...(markdownToolbar || {})
  });

  const state = await loadInitialComposerState(initialState || {});
  setActiveComposerState(state);
  const workspaceResult = assembleComposerWorkspace({
    documentRef,
    state,
    ...(workspace || {})
  });
  return {
    state,
    ...workspaceResult
  };
}

export function initializeComposerApp(options = {}) {
  const documentRef = options.documentRef;
  const handler = () => initializeComposerOnDomReady(options);
  documentRef.addEventListener('DOMContentLoaded', handler);
  return handler;
}
