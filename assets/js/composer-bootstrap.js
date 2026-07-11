import { createEditorAppKernel } from './editor-app-kernel.js';
import { createDomEffects } from './editor-effects.js';
import { EDITOR_SHELL_IDS, EDITOR_SHELL_SELECTORS } from './editor-shell-contract.js';
import { CONTENT_MODEL_MIGRATION_STATE_KEY, getLegacyContentModelMigrationFiles } from './content-model-migration.js';
import { injectComposerRuntimeStyles } from './composer-runtime-styles.js';

function noop() {}

const NOOP_LOGGER = Object.freeze({
  warn: noop,
  error: noop
});

function createComposerAppOptions(options = {}) {
  const editorRuntime = options.editorRuntime || {};
  const documentRef = options.documentRef || editorRuntime.documentRef || null;
  const windowRef = options.windowRef || editorRuntime.windowRef || null;
  const consoleRef = options.consoleRef || NOOP_LOGGER;
  const composerStateStore = options.composerStateStore || {};
  const composerSystemThemeBridge = options.composerSystemThemeBridge || null;
  const markdownToolbar = options.markdownToolbar || {};
  const initialState = options.initialState || {};
  const workspace = options.workspace || {};
  const workspaceUi = options.workspaceUi || {};
  const extraFeatures = [];

  if (composerSystemThemeBridge && typeof composerSystemThemeBridge.createLifecycleFeature === 'function') {
    extraFeatures.push(composerSystemThemeBridge.createLifecycleFeature());
  }
  if (Array.isArray(options.extraFeatures)) extraFeatures.push(...options.extraFeatures);

  return {
    documentRef,
    onDocumentReady: options.onDocumentReady || editorRuntime.onDocumentReady,
    setActiveComposerState: (state) =>
      typeof composerStateStore.setActiveState === 'function' ? composerStateStore.setActiveState(state) : undefined,
    markdownToolbar: {
      ...markdownToolbar
    },
    initialState: {
      ensureSiteRepo: () =>
        typeof editorRuntime.ensureSiteRepo === 'function' ? editorRuntime.ensureSiteRepo() : undefined,
      windowRef,
      consoleRef,
      ...initialState,
      setRemoteBaseline: (kind, value) =>
        typeof composerStateStore.setRemoteBaseline === 'function'
          ? composerStateStore.setRemoteBaseline(kind, value)
          : undefined
    },
    workspace: {
      documentRef,
      windowRef,
      getLocation: () => (typeof editorRuntime.getLocation === 'function' ? editorRuntime.getLocation() : null),
      bindWorkspaceUi: () =>
        bindComposerWorkspaceUi({
          documentRef,
          consoleRef,
          ...workspaceUi
        }),
      setAllowEditorStatePersist: (value) =>
        typeof editorRuntime.setAllowEditorStatePersist === 'function'
          ? editorRuntime.setAllowEditorStatePersist(value)
          : undefined,
      setTimeoutRef: (handler, delay) =>
        typeof editorRuntime.setTimer === 'function' ? editorRuntime.setTimer(handler, delay) : undefined,
      ...workspace
    },
    extraFeatures
  };
}

export function startComposerApp(options = {}) {
  const composerActions = options.composerActions || null;
  if (!composerActions || typeof composerActions.assertReady !== 'function') {
    throw new Error('Composer startup requires ready action effects');
  }
  composerActions.assertReady();

  const appOptions = createComposerAppOptions(options);
  const initializeComposerAppRef =
    typeof options.initializeComposerApp === 'function' ? options.initializeComposerApp : initializeComposerApp;
  const injectRuntimeStyles =
    typeof options.injectRuntimeStyles === 'function' ? options.injectRuntimeStyles : injectComposerRuntimeStyles;
  const bootstrapHandler = initializeComposerAppRef(appOptions);
  injectRuntimeStyles({ documentRef: appOptions.documentRef });
  return bootstrapHandler;
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
  const effects = createDomEffects({ documentRef });
  const pushBtn = effects.getElementById(EDITOR_SHELL_IDS.btnPushMarkdown);
  if (pushBtn) {
    setMarkdownPushButton(pushBtn);
    effects.on(pushBtn, 'click', async (event) => {
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

  const saveBtn = effects.getElementById(EDITOR_SHELL_IDS.btnSaveMarkdown);
  if (saveBtn) {
    setMarkdownSaveButton(saveBtn);
    effects.on(saveBtn, 'click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      manualSaveActiveMarkdown(saveBtn);
    });
    updateMarkdownSaveButton(getActiveDynamicTab());
  }

  const protectBtn = effects.getElementById(EDITOR_SHELL_IDS.btnProtectMarkdown);
  if (protectBtn) {
    setMarkdownProtectionButton(protectBtn);
    effects.on(protectBtn, 'click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      handleMarkdownProtectionButton(protectBtn);
    });
    updateMarkdownProtectionButton(getActiveDynamicTab());
  }

  const discardBtn = effects.getElementById(EDITOR_SHELL_IDS.btnDiscardMarkdown);
  if (discardBtn) {
    setMarkdownDiscardButton(discardBtn);
    effects.on(discardBtn, 'click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      discardMarkdownLocalChanges(null, discardBtn);
    });
    updateMarkdownDiscardButton(getActiveDynamicTab());
  }
}

export function bindComposerWorkspaceUi({
  documentRef,
  consoleRef = null,
  mountEditorSystemPanels = noop,
  initEditorOverlay = noop,
  initEditorRailResize = noop,
  initMobileEditorRail = noop,
  bindEditorStatePersistenceListeners = noop,
  openEditorOverlay = noop,
  applyMode = noop,
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
  const effects = createDomEffects({ documentRef });
  mountEditorSystemPanels();
  initEditorOverlay();
  initEditorRailResize();
  initMobileEditorRail();
  bindEditorStatePersistenceListeners();

  effects.querySelectorAll(EDITOR_SHELL_SELECTORS.modeTabs).forEach((btn) => {
    effects.on(btn, 'click', (event) => {
      const mode = btn.dataset && btn.dataset.mode;
      if (mode === 'composer' || mode === 'themes' || mode === 'updates' || mode === 'sync') {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        openEditorOverlay(mode, btn);
        return;
      }
      applyMode(mode);
    });
  });

  effects.querySelectorAll(EDITOR_SHELL_SELECTORS.composerFileTabs).forEach((link) => {
    effects.on(link, 'click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      setComposerFile(link.dataset && link.dataset.cfile);
    });
  });
  setComposerFile(getInitialComposerFile(), { immediate: true });

  const btnAddItem = effects.getElementById(EDITOR_SHELL_IDS.btnAddItem);
  if (btnAddItem) {
    effects.on(btnAddItem, 'click', (event) => {
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

  const btnDiscard = effects.getElementById(EDITOR_SHELL_IDS.btnDiscard);
  if (btnDiscard) effects.on(btnDiscard, 'click', () => handleComposerDiscard(btnDiscard));

  const btnRefresh = effects.getElementById(EDITOR_SHELL_IDS.btnRefresh);
  if (btnRefresh) effects.on(btnRefresh, 'click', () => handleComposerRefresh(btnRefresh));

  const btnReview = effects.getElementById(EDITOR_SHELL_IDS.btnReview);
  if (btnReview) {
    effects.on(btnReview, 'click', () => {
      const datasetKind = btnReview.dataset && btnReview.dataset.kind;
      const preferred = datasetKind === 'tabs' ? 'tabs' : datasetKind === 'index' ? 'index' : null;
      if (preferred) {
        openComposerDiffModal(preferred);
        return;
      }
      const summaryEntries = computeUnsyncedSummary();
      const activeKind = getActiveComposerFile();
      const normalizedActive = activeKind === 'tabs' ? 'tabs' : 'index';
      const entry = summaryEntries.find((item) => item && item.kind === normalizedActive);
      if (entry) openComposerDiffModal(entry.kind);
    });
  }

  bindVerifySetup();
}

export async function loadInitialComposerState({
  consoleRef = null,
  t = (key) => key,
  ensureSiteRepo = noop,
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
  showStatus = noop,
  loadContentModelMigration = null
} = {}) {
  try {
    ensureSiteRepo();
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
    let migration = null;
    if (typeof loadContentModelMigration === 'function') {
      try {
        migration = await loadContentModelMigration({
          contentRoot: root,
          indexRaw: idx || {},
          tabsRaw: tbs || {},
          defaultLang: String((effectiveSite && effectiveSite.defaultLanguage) || 'en')
        });
      } catch (err) {
        if (consoleRef && typeof consoleRef.warn === 'function') {
          consoleRef.warn('Composer: failed to inspect legacy content model files', err);
        }
        migration = null;
      }
    }
    const hasContentModelMigration = !!(migration && migration.hasLegacyContentModel);
    const migratedIndex = hasContentModelMigration ? prepareIndexState(migration.indexRaw || idx || {}) : remoteIndex;
    const migratedTabs = hasContentModelMigration ? prepareTabsState(migration.tabsRaw || tbs || {}) : remoteTabs;
    setRemoteBaseline('index', deepClone(remoteIndex));
    setRemoteBaseline('tabs', deepClone(remoteTabs));
    setRemoteBaseline('site', cloneSiteState(remoteSite));
    state.index = deepClone(migratedIndex);
    state.tabs = deepClone(migratedTabs);
    state.site = cloneSiteState(remoteSite);
    if (hasContentModelMigration) {
      Object.defineProperty(state, CONTENT_MODEL_MIGRATION_STATE_KEY, {
        value: {
          contentRoot: root,
          legacyFiles: getLegacyContentModelMigrationFiles(migration)
        },
        enumerable: false,
        configurable: true
      });
      showStatus(t('editor.composer.statusMessages.contentModelMigrationReady'));
    }
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
  t = (key) => key,
  state,
  loadDraftSnapshotsIntoState,
  applyInferredRepoConfig,
  inferRepoConfigFromGitHubPagesUrl,
  getLocation = () => null,
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
  setTimeoutRef = null
} = {}) {
  const effects = createDomEffects({ documentRef });
  const scheduleTimer = (handler, delay) => {
    if (typeof setTimeoutRef !== 'function') return false;
    try {
      setTimeoutRef(handler, delay);
      return true;
    } catch (_) {
      return false;
    }
  };

  const restoredDrafts = loadDraftSnapshotsIntoState(state);
  let inferredSiteRepoApplied = false;
  try {
    inferredSiteRepoApplied = applyInferredRepoConfig(state.site, inferRepoConfigFromGitHubPagesUrl(getLocation()));
  } catch (_) {
    inferredSiteRepoApplied = false;
  }
  applyEffectiveSiteConfig(state.site);
  updateMarkdownPushButton(getActiveDynamicTab());

  if (restoredDrafts.length) {
    const label = restoredDrafts
      .map((k) => (k === 'tabs' ? 'tabs.yaml' : k === 'site' ? 'site.yaml' : 'index.yaml'))
      .join(' & ');
    showStatus(t('editor.composer.statusMessages.restoredDraft', { label }));
    scheduleTimer(() => {
      showStatus('');
    }, 1800);
  } else {
    showStatus('');
  }

  bindWorkspaceUi(state);
  buildIndexUI(effects.getElementById(EDITOR_SHELL_IDS.composerIndex), state);
  buildTabsUI(effects.getElementById(EDITOR_SHELL_IDS.composerTabs), state);
  buildSiteUI(effects.getElementById(EDITOR_SHELL_IDS.composerSite), state);

  notifyComposerChange('index', { skipAutoSave: true });
  notifyComposerChange('tabs', { skipAutoSave: true });
  notifyComposerChange('site', inferredSiteRepoApplied ? {} : { skipAutoSave: true });

  refreshEditorContentTree();
  const restoredEditorState = restoreDynamicEditorState();
  if (!restoredEditorState) applyMode('editor');
  setAllowEditorStatePersist(true);
  if (restoredEditorState) {
    if (!scheduleTimer(() => persistDynamicEditorState(), 500)) persistDynamicEditorState();
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
  const { documentRef, setActiveComposerState = noop } = options;

  const context = {
    documentRef,
    result: null,
    state: null
  };
  const kernel = createEditorAppKernel({
    name: 'composer-bootstrap',
    context,
    provides: ['documentRef']
  });

  createComposerBootstrapFeatures({
    ...options,
    setActiveComposerState
  }).forEach((feature) => kernel.registerFeature(feature));

  const runResult = await kernel.run();
  const result = runResult.context.result;
  if (result && typeof result === 'object' && typeof result.dispose !== 'function') {
    Object.defineProperty(result, 'dispose', {
      value: () => runResult.dispose(),
      enumerable: false,
      configurable: true
    });
  }
  return result;
}

export function createComposerBootstrapFeatures(options = {}) {
  const { markdownToolbar, initialState, workspace, extraFeatures, setActiveComposerState = noop } = options;

  const features = [
    {
      name: 'composer.markdownToolbar',
      requires: ['documentRef'],
      provides: ['markdownToolbar'],
      bind(context) {
        bindComposerMarkdownToolbar({
          documentRef: context.documentRef,
          ...(markdownToolbar || {})
        });
        context.markdownToolbar = true;
      }
    },
    {
      name: 'composer.initialState',
      requires: ['markdownToolbar'],
      provides: ['initialComposerState'],
      async start(context) {
        const state = await loadInitialComposerState(initialState || {});
        context.initialComposerState = state;
        setActiveComposerState(state);
      }
    },
    {
      name: 'composer.workspace',
      requires: ['initialComposerState'],
      provides: ['composerWorkspace'],
      start(context) {
        const state = context.initialComposerState || { index: {}, tabs: {}, site: {} };
        const workspaceResult = assembleComposerWorkspace({
          documentRef: context.documentRef,
          state,
          ...(workspace || {})
        });
        context.composerWorkspace = workspaceResult;
        context.result = {
          state,
          ...workspaceResult
        };
      }
    }
  ];
  return features.concat(Array.isArray(extraFeatures) ? extraFeatures : []);
}

export function initializeComposerApp(options = {}) {
  let runPromise = null;
  let readyCleanup = null;
  const handler = () => {
    if (!runPromise) runPromise = initializeComposerOnDomReady(options);
    return runPromise;
  };
  handler.dispose = async () => {
    if (typeof readyCleanup === 'function') {
      try {
        readyCleanup();
      } catch (_) {}
    }
    if (!runPromise) return false;
    const result = await runPromise;
    return result && typeof result.dispose === 'function' ? result.dispose() : false;
  };
  const onDocumentReady =
    typeof options.onDocumentReady === 'function' ? options.onDocumentReady : (readyHandler) => readyHandler();
  readyCleanup = onDocumentReady(handler);
  return handler;
}
