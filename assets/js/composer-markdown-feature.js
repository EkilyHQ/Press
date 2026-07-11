import { getManualMarkdownSaveState } from './composer-markdown-save.js';
import {
  decryptMarkdownDocument,
  encryptMarkdownDocument,
  parseEncryptedMarkdownEnvelope
} from './encrypted-content.js';
import { createComposerMarkdownAssetManager } from './composer-markdown-assets.js';
import { createComposerMarkdownActionsUi } from './composer-markdown-actions-ui.js';
import { createComposerMarkdownActionsController } from './composer-markdown-actions.js';
import { createComposerMarkdownDraftController } from './composer-markdown-drafts.js';
import { createComposerMarkdownLoader } from './composer-markdown-loader.js';
import {
  computeTextSignature,
  createDiscardedMarkdownProtectionState,
  createMarkdownProtectionState,
  getLockedEncryptedMarkdownDraft,
  getMarkdownProtectionState,
  hasMarkdownDraftContent,
  isEncryptedMarkdownDraftEntry,
  isMarkdownTabProtected,
  normalizeMarkdownContent,
  setMarkdownProtectionState
} from './composer-markdown-state.js';

const noop = () => {};

function safeCall(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  try {
    return fn(...args);
  } catch (_) {
    return undefined;
  }
}

export function createComposerMarkdownFeature(options = {}) {
  const editorRuntime = options.editorRuntime || {};
  const documentRef = options.documentRef || null;
  const t = typeof options.t === 'function' ? options.t : (key) => String(key || '');
  const tComposer =
    typeof options.tComposer === 'function' ? options.tComposer : (suffix) => `editor.composer.${suffix}`;
  const consoleRef = options.consoleRef || { error: noop, warn: noop };
  const markdownWorkspace = options.markdownWorkspace || {};
  const draftStore = options.markdownDraftStore || null;
  const normalizeRelPath =
    typeof options.normalizeRelPath === 'function'
      ? options.normalizeRelPath
      : (value) => String(value || '').replace(/[\\]/g, '/');
  const dirnameFromPath = typeof options.dirnameFromPath === 'function' ? options.dirnameFromPath : () => '';
  const basenameFromPath = typeof options.basenameFromPath === 'function' ? options.basenameFromPath : () => '';
  const getContentRootSafe = typeof options.getContentRootSafe === 'function' ? options.getContentRootSafe : () => '';
  const getDefaultMarkdownForPath =
    typeof options.getDefaultMarkdownForPath === 'function' ? options.getDefaultMarkdownForPath : () => '';
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => ({});
  const getCurrentMode = typeof options.getCurrentMode === 'function' ? options.getCurrentMode : () => null;
  const getActiveSiteRepoConfig =
    typeof options.getActiveSiteRepoConfig === 'function' ? options.getActiveSiteRepoConfig : () => null;
  const isDynamicMode = typeof options.isDynamicMode === 'function' ? options.isDynamicMode : () => false;
  const updateUnsyncedSummary =
    typeof options.updateUnsyncedSummary === 'function' ? options.updateUnsyncedSummary : noop;
  const refreshEditorContentTree =
    typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : noop;
  const showToast = typeof options.showToast === 'function' ? options.showToast : noop;
  const requestMarkdownProtectionPassword =
    typeof options.requestMarkdownProtectionPassword === 'function'
      ? options.requestMarkdownProtectionPassword
      : async () => '';
  const showComposerDiscardConfirm =
    typeof options.showComposerDiscardConfirm === 'function' ? options.showComposerDiscardConfirm : async () => false;

  let draftController = null;
  let loader = null;
  let actionsUi = null;

  function fetchContent(url, fetchOptions) {
    return typeof editorRuntime.fetchContent === 'function'
      ? editorRuntime.fetchContent(url, fetchOptions)
      : Promise.reject(new Error('Fetch is not available in this runtime.'));
  }

  function getActiveDynamicTab() {
    return typeof markdownWorkspace.getActiveDynamicTab === 'function' ? markdownWorkspace.getActiveDynamicTab() : null;
  }

  function getDynamicEditorTabs() {
    return typeof markdownWorkspace.getDynamicEditorTabs === 'function' ? markdownWorkspace.getDynamicEditorTabs() : [];
  }

  function getPrimaryEditorApi() {
    return typeof markdownWorkspace.getPrimaryEditorApi === 'function' ? markdownWorkspace.getPrimaryEditorApi() : null;
  }

  function loadDynamicTabContent(tab) {
    return loader && typeof loader.loadDynamicTabContent === 'function'
      ? loader.loadDynamicTabContent(tab)
      : Promise.resolve('');
  }

  function setDynamicTabStatus(tab, status) {
    if (loader && typeof loader.setDynamicTabStatus === 'function') loader.setDynamicTabStatus(tab, status);
  }

  function readMarkdownDraftStore() {
    return draftController && typeof draftController.readDraftStore === 'function'
      ? draftController.readDraftStore()
      : {};
  }

  function writeMarkdownDraftStore(store) {
    if (draftController && typeof draftController.writeDraftStore === 'function')
      draftController.writeDraftStore(store);
  }

  function getMarkdownDraftEntry(path) {
    return draftController && typeof draftController.getDraftEntry === 'function'
      ? draftController.getDraftEntry(path)
      : null;
  }

  function clearMarkdownDraftEntry(path) {
    if (draftController && typeof draftController.clearDraftEntry === 'function') draftController.clearDraftEntry(path);
  }

  function restoreMarkdownDraftForTab(tab) {
    return draftController && typeof draftController.restoreDraftForTab === 'function'
      ? draftController.restoreDraftForTab(tab)
      : false;
  }

  function saveMarkdownDraftForTab(tab, saveOptions = {}) {
    return draftController && typeof draftController.saveDraftForTab === 'function'
      ? draftController.saveDraftForTab(tab, saveOptions)
      : Promise.resolve(null);
  }

  function clearMarkdownDraftForTab(tab) {
    if (draftController && typeof draftController.clearDraftForTab === 'function')
      draftController.clearDraftForTab(tab);
  }

  function scheduleMarkdownDraftSave(tab) {
    if (draftController && typeof draftController.scheduleDraftSave === 'function')
      draftController.scheduleDraftSave(tab);
  }

  function flushMarkdownDraft(tab) {
    return draftController && typeof draftController.flushDraft === 'function'
      ? draftController.flushDraft(tab)
      : Promise.resolve(null);
  }

  function updateDynamicTabDirtyState(tab, dirtyOptions = {}) {
    if (draftController && typeof draftController.updateDynamicTabDirtyState === 'function') {
      draftController.updateDynamicTabDirtyState(tab, dirtyOptions);
    }
  }

  function hasUnsavedMarkdownDrafts() {
    return !!(
      draftController &&
      typeof draftController.hasUnsavedDrafts === 'function' &&
      draftController.hasUnsavedDrafts()
    );
  }

  function collectDynamicMarkdownDraftStates() {
    return draftController && typeof draftController.collectDraftStates === 'function'
      ? draftController.collectDraftStates()
      : new Map();
  }

  const markdownAssetManager = createComposerMarkdownAssetManager({
    t,
    normalizeRelPath,
    normalizeMarkdownContent,
    emitMarkdownAssetPreview: (detail) => {
      if (editorRuntime.events && typeof editorRuntime.events.emitWindow === 'function') {
        editorRuntime.events.emitWindow('press-editor-asset-preview', detail);
      }
    },
    addWindowListener: (type, handler, listenerOptions) =>
      editorRuntime.events && typeof editorRuntime.events.onWindow === 'function'
        ? editorRuntime.events.onWindow(type, handler, listenerOptions)
        : noop,
    fetchContent,
    getContentRootSafe,
    getStateSlice,
    getDynamicEditorTabs,
    getActiveDynamicTab,
    getPrimaryEditorApi,
    readMarkdownDraftStore,
    writeMarkdownDraftStore,
    getMarkdownDraftEntry,
    findDynamicTabByPath: (path) =>
      typeof markdownWorkspace.findDynamicTabByPath === 'function'
        ? markdownWorkspace.findDynamicTabByPath(path)
        : null,
    scheduleMarkdownDraftSave,
    updateUnsyncedSummary,
    showToast
  });

  const {
    ensureMarkdownAssetBucket,
    normalizeAssetDescriptor,
    normalizeAssetDeletionDescriptor,
    importMarkdownAssetsForPath,
    exportMarkdownAssetBucket,
    importMarkdownAssetDeletionsForPath,
    exportMarkdownAssetDeletionBucket,
    clearMarkdownAssetsForPath,
    removeMarkdownAsset,
    removeMarkdownAssetDeletion,
    listMarkdownAssetDeletions,
    countMarkdownAssetDeletions,
    listMarkdownAssets,
    countMarkdownAssets,
    isAssetReferencedInContent,
    textWithFallback,
    draftHasAssetDeletions,
    collectCurrentRepositoryMarkdownAssetReferences
  } = markdownAssetManager;

  async function requestPasswordForProtectedMarkdown(tab, passwordOptions = {}) {
    const protection = getMarkdownProtectionState(tab);
    if (protection.password) return protection.password;
    const opts = passwordOptions && typeof passwordOptions === 'object' ? passwordOptions : {};
    const password = await requestMarkdownProtectionPassword({
      title: opts.title || t('editor.composer.markdown.protection.openTitle'),
      message: opts.message || t('editor.composer.markdown.protection.openMessage'),
      confirmLabel: opts.confirmLabel || t('editor.composer.markdown.protection.unlock'),
      confirm: false
    });
    if (!password) throw new Error(t('editor.composer.markdown.protection.passwordRequiredOpen'));
    protection.password = password;
    protection.enabled = true;
    return password;
  }

  async function decryptProtectedMarkdownForTab(markdown, tab, decryptOptions = {}) {
    const envelope = parseEncryptedMarkdownEnvelope(markdown);
    if (!envelope.encrypted) return normalizeMarkdownContent(markdown);
    if (!envelope.valid) {
      throw new Error(envelope.error || t('editor.composer.markdown.protection.invalidEnvelope'));
    }
    const opts = decryptOptions && typeof decryptOptions === 'object' ? decryptOptions : {};
    const protection = getMarkdownProtectionState(tab);
    for (;;) {
      let password = protection.password;
      if (!password) {
        password = await requestPasswordForProtectedMarkdown(tab, {
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel
        });
      }
      try {
        const decrypted = await decryptMarkdownDocument(markdown, password);
        setMarkdownProtectionState(tab, {
          enabled: true,
          password,
          encryptedRemote: opts.remote === true ? true : !!protection.encryptedRemote,
          encryptedDraft: opts.draft === true,
          passwordChanged: false,
          remoteSignature: opts.remoteSignature || protection.remoteSignature || '',
          remoteCiphertext: envelope.ciphertext || protection.remoteCiphertext || ''
        });
        return normalizeMarkdownContent(decrypted);
      } catch (_) {
        protection.password = '';
        showToast('error', t('editor.composer.markdown.protection.unlockFailed'));
      }
    }
  }

  async function prepareMarkdownForProtectedStorage(tab, markdown, storageOptions = {}) {
    const text = normalizeMarkdownContent(markdown || '');
    if (!isMarkdownTabProtected(tab)) {
      return { content: text, encrypted: false };
    }
    const protection = getMarkdownProtectionState(tab);
    let password = protection.password;
    if (!password) {
      password = await requestMarkdownProtectionPassword({
        title: t('editor.composer.markdown.protection.passwordTitle'),
        message: t('editor.composer.markdown.protection.passwordMessage'),
        confirmLabel: t('editor.composer.markdown.protection.keepEncrypted'),
        confirm: false
      });
      if (!password) throw new Error(t('editor.composer.markdown.protection.passwordRequired'));
      protection.password = password;
    }
    const encrypted = await encryptMarkdownDocument(text, password);
    return {
      content: normalizeMarkdownContent(encrypted.markdown),
      encrypted: true,
      metadata: encrypted.metadata
    };
  }

  draftController = createComposerMarkdownDraftController({
    markdownDraftStore: draftStore,
    normalizeRelPath,
    normalizeAssetDescriptor,
    normalizeAssetDeletionDescriptor,
    importMarkdownAssetsForPath,
    importMarkdownAssetDeletionsForPath,
    exportMarkdownAssetBucket,
    exportMarkdownAssetDeletionBucket,
    clearMarkdownAssetsForPath,
    ensureMarkdownAssetBucket,
    countMarkdownAssetDeletions,
    prepareMarkdownForProtectedStorage,
    getMarkdownProtectionState,
    setMarkdownProtectionState,
    getDynamicEditorTabs,
    getCurrentMode,
    pushEditorCurrentFileInfo: (tab) =>
      typeof markdownWorkspace.pushEditorCurrentFileInfo === 'function'
        ? markdownWorkspace.pushEditorCurrentFileInfo(tab)
        : undefined,
    updateMarkdownPushButton: (tab) =>
      typeof markdownWorkspace.updateMarkdownPushButton === 'function'
        ? markdownWorkspace.updateMarkdownPushButton(tab)
        : undefined,
    updateComposerMarkdownDraftIndicators,
    refreshEditorContentTree,
    updateUnsyncedSummary: () => updateUnsyncedSummary({ preserveStructure: true }),
    showToast,
    t,
    consoleRef,
    setTimeoutRef: (handler, delay) =>
      typeof editorRuntime.setTimer === 'function' ? editorRuntime.setTimer(handler, delay) : null,
    clearTimeoutRef: (id) => safeCall(editorRuntime.clearTimer, id)
  });
  loader = createComposerMarkdownLoader({
    getContentRootSafe,
    normalizeRelPath,
    normalizeMarkdownContent,
    computeTextSignature,
    parseEncryptedMarkdownEnvelope,
    decryptProtectedMarkdownForTab,
    isMarkdownTabProtected,
    setMarkdownProtectionState,
    createMarkdownProtectionState,
    draftHasAssetDeletions,
    getDefaultMarkdownForPath,
    updateDynamicTabDirtyState,
    getCurrentMode,
    pushEditorCurrentFileInfo: (tab) =>
      typeof markdownWorkspace.pushEditorCurrentFileInfo === 'function'
        ? markdownWorkspace.pushEditorCurrentFileInfo(tab)
        : undefined,
    refreshEditorContentTree,
    fetchContent,
    draftProtectionTitle: () => t('editor.composer.markdown.protection.draftTitle'),
    draftProtectionMessage: () => t('editor.composer.markdown.protection.draftMessage'),
    openProtectionTitle: () => t('editor.composer.markdown.protection.openTitle'),
    openProtectionMessage: () => t('editor.composer.markdown.protection.openMessage')
  });
  actionsUi = createComposerMarkdownActionsUi({
    documentRef,
    translate: t,
    getCurrentMode,
    getActiveDynamicTab,
    getActiveSiteRepoConfig,
    hasMarkdownDraftContent,
    getManualMarkdownSaveState,
    isMarkdownTabProtected,
    setButtonLabel: options.setButtonLabel
  });
  function handleBeforeUnload(event) {
    if (draftController && typeof draftController.handleBeforeUnload === 'function')
      draftController.handleBeforeUnload(event);
  }
  if (editorRuntime.events && typeof editorRuntime.events.onWindow === 'function') {
    editorRuntime.events.onWindow('beforeunload', handleBeforeUnload);
  }

  function cssEscape(value) {
    try {
      const cssRef = typeof editorRuntime.getCss === 'function' ? editorRuntime.getCss() : null;
      if (cssRef && typeof cssRef.escape === 'function') return cssRef.escape(value);
    } catch (_) {}
    return String(value == null ? '' : value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  function getDraftIndicatorMessage(state) {
    if (!state) return '';
    const suffix = `markdown.draftIndicator.${state}`;
    const value = tComposer(suffix);
    const fallbackKey = `editor.composer.${suffix}`;
    if (!value || value === fallbackKey) return '';
    return value;
  }

  function updateComposerDraftContainerState(container) {
    if (!container) return;
    let childState = '';
    if (container.querySelector('.ct-lang[data-draft-state="conflict"], .ci-ver-item[data-draft-state="conflict"]')) {
      childState = 'conflict';
    } else if (container.querySelector('.ct-lang[data-draft-state="dirty"], .ci-ver-item[data-draft-state="dirty"]')) {
      childState = 'dirty';
    } else {
      childState = '';
    }
    if (childState) container.setAttribute('data-child-draft', childState);
    else container.removeAttribute('data-child-draft');
  }

  function applyComposerDraftIndicatorState(el, state) {
    if (!el) return;
    const indicator = el.querySelector('.ct-draft-indicator, .ci-draft-indicator');
    const value = state ? String(state) : '';
    if (value) el.setAttribute('data-draft-state', value);
    else el.removeAttribute('data-draft-state');
    if (!indicator) return;
    if (value) {
      indicator.hidden = false;
      indicator.dataset.state = value;
      const label = getDraftIndicatorMessage(value);
      if (label) {
        indicator.setAttribute('title', label);
        indicator.setAttribute('aria-label', label);
        indicator.setAttribute('role', 'img');
      } else {
        indicator.removeAttribute('title');
        indicator.removeAttribute('aria-label');
        indicator.removeAttribute('role');
      }
    } else {
      indicator.hidden = true;
      indicator.dataset.state = '';
      indicator.removeAttribute('title');
      indicator.removeAttribute('aria-label');
      indicator.removeAttribute('role');
    }
    updateComposerDraftContainerState(el.closest('.ct-item, .ci-item'));
  }

  function updateComposerMarkdownDraftIndicators(indicatorOptions = {}) {
    const store = indicatorOptions.store || readMarkdownDraftStore();
    const overrides = indicatorOptions.overrideMap || collectDynamicMarkdownDraftStates();
    const normalizedPath = indicatorOptions.path ? normalizeRelPath(indicatorOptions.path) : '';
    const selectors = ['.ct-lang', '.ci-ver-item'];

    const updateElement = (el) => {
      if (!el) return;
      const raw = el.dataset ? el.dataset.mdPath : '';
      const path = normalizeRelPath(raw);
      if (path) el.dataset.mdPath = path;
      else delete el.dataset.mdPath;
      let state = '';
      if (path) {
        if (overrides && overrides.has(path)) {
          state = overrides.get(path) || '';
        } else if (store && Object.prototype.hasOwnProperty.call(store, path)) {
          state = 'saved';
        }
      }
      applyComposerDraftIndicatorState(el, state);
    };

    if (indicatorOptions.element) {
      updateElement(indicatorOptions.element);
    }

    if (normalizedPath) {
      selectors.forEach((sel) => {
        const query = `${sel}[data-md-path="${cssEscape(normalizedPath)}"]`;
        try {
          Array.from(documentRef.querySelectorAll(query)).forEach((el) => {
            if (indicatorOptions.element && el === indicatorOptions.element) return;
            updateElement(el);
          });
        } catch (_) {}
      });
      return;
    }

    if (indicatorOptions.element) return;

    selectors.forEach((sel) => {
      try {
        Array.from(documentRef.querySelectorAll(`${sel}[data-md-path]`)).forEach(updateElement);
      } catch (_) {}
    });
    refreshEditorContentTree({ preserveStructure: isDynamicMode(getCurrentMode()) });
  }

  function createActionsController(actionOptions = {}) {
    return createComposerMarkdownActionsController({
      consoleRef,
      confirmRef: (message) =>
        typeof editorRuntime.confirmAction === 'function' ? editorRuntime.confirmAction(message) : true,
      clearTimeoutRef: (id) => safeCall(editorRuntime.clearTimer, id),
      t,
      getCurrentMode,
      getActiveDynamicTab,
      getActiveSiteRepoConfig,
      getContentRootSafe,
      normalizeRelPath,
      dirnameFromPath,
      basenameFromPath,
      getPrimaryEditorApi,
      loadDynamicTabContent,
      getManualMarkdownSaveState,
      getMarkdownSaveTooltip: markdownWorkspace.getMarkdownSaveTooltip,
      updateMarkdownSaveButton: markdownWorkspace.updateMarkdownSaveButton,
      getMarkdownSaveButton: markdownWorkspace.getMarkdownSaveButton,
      getButtonLabel: options.getButtonLabel,
      getMarkdownSaveLabel: markdownWorkspace.getMarkdownSaveLabel,
      getMarkdownSaveBusyLabel: markdownWorkspace.getMarkdownSaveBusyLabel,
      setButtonLabel: options.setButtonLabel,
      saveMarkdownDraftForTab,
      pushEditorCurrentFileInfo: markdownWorkspace.pushEditorCurrentFileInfo,
      showToast,
      updateMarkdownDiscardButton: markdownWorkspace.updateMarkdownDiscardButton,
      updateMarkdownPushButton: markdownWorkspace.updateMarkdownPushButton,
      updateMarkdownProtectionButton: markdownWorkspace.updateMarkdownProtectionButton,
      updateUnsyncedSummary,
      requestMarkdownProtectionPassword,
      getMarkdownProtectionState,
      setMarkdownProtectionState,
      updateDynamicTabDirtyState,
      showComposerDiscardConfirm,
      preparePopupWindow: actionOptions.preparePopupWindow,
      closePopupWindow: actionOptions.closePopupWindow,
      finalizePopupWindow: actionOptions.finalizePopupWindow,
      handlePopupBlocked: actionOptions.handlePopupBlocked,
      computeTextSignature,
      startMarkdownSyncWatcher: actionOptions.startMarkdownSyncWatcher,
      prepareMarkdownForProtectedStorage,
      nsCopyToClipboard: actionOptions.nsCopyToClipboard,
      normalizeMarkdownContent,
      createDiscardedMarkdownProtectionState,
      hasMarkdownDraftContent,
      clearMarkdownDraftForTab,
      getMarkdownDiscardButton: markdownWorkspace.getMarkdownDiscardButton,
      getMarkdownDiscardLabel: markdownWorkspace.getMarkdownDiscardLabel,
      getMarkdownDiscardBusyLabel: markdownWorkspace.getMarkdownDiscardBusyLabel
    });
  }

  return {
    actionsUi,
    draftController,
    loader,
    createActionsController,
    computeTextSignature,
    createDiscardedMarkdownProtectionState,
    createMarkdownProtectionState,
    decryptProtectedMarkdownForTab,
    getLockedEncryptedMarkdownDraft,
    getMarkdownProtectionState,
    hasMarkdownDraftContent,
    isEncryptedMarkdownDraftEntry,
    isMarkdownTabProtected,
    normalizeMarkdownContent,
    parseEncryptedMarkdownEnvelope,
    prepareMarkdownForProtectedStorage,
    setDynamicTabStatus,
    setMarkdownProtectionState,
    readMarkdownDraftStore,
    writeMarkdownDraftStore,
    getMarkdownDraftEntry,
    clearMarkdownDraftEntry,
    restoreMarkdownDraftForTab,
    saveMarkdownDraftForTab,
    clearMarkdownDraftForTab,
    scheduleMarkdownDraftSave,
    flushMarkdownDraft,
    updateDynamicTabDirtyState,
    hasUnsavedMarkdownDrafts,
    collectDynamicMarkdownDraftStates,
    updateComposerDraftContainerState,
    updateComposerMarkdownDraftContainerState: updateComposerDraftContainerState,
    updateComposerMarkdownDraftIndicators,
    ensureMarkdownAssetBucket,
    normalizeAssetDescriptor,
    normalizeAssetDeletionDescriptor,
    importMarkdownAssetsForPath,
    exportMarkdownAssetBucket,
    importMarkdownAssetDeletionsForPath,
    exportMarkdownAssetDeletionBucket,
    clearMarkdownAssetsForPath,
    removeMarkdownAsset,
    removeMarkdownAssetDeletion,
    listMarkdownAssetDeletions,
    countMarkdownAssetDeletions,
    listMarkdownAssets,
    countMarkdownAssets,
    isAssetReferencedInContent,
    textWithFallback,
    draftHasAssetDeletions,
    collectCurrentRepositoryMarkdownAssetReferences,
    loadDynamicTabContent
  };
}
