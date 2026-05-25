function normalizeTarget(target) {
  if (target === 'tabs') return 'tabs';
  if (target === 'site') return 'site';
  return 'index';
}

function getTargetFileBase(target) {
  const safeTarget = normalizeTarget(target);
  if (safeTarget === 'tabs') return 'tabs';
  if (safeTarget === 'site') return 'site';
  return 'index';
}

function getTargetLabel(target) {
  return `${getTargetFileBase(target)}.yaml`;
}

function noop() {}

export function createComposerYamlActions(options = {}) {
  const consoleRef = options.consoleRef || { error: noop, warn: noop };
  const confirmRef = typeof options.confirmRef === 'function'
    ? options.confirmRef
    : () => true;
  const t = typeof options.t === 'function' ? options.t : (key, params = {}) => {
    if (params && params.label) return `${key}:${params.label}`;
    if (params && params.name) return `${key}:${params.name}`;
    return key;
  };
  const fetchConfigWithYamlFallback = typeof options.fetchConfigWithYamlFallback === 'function'
    ? options.fetchConfigWithYamlFallback
    : async () => null;
  const fetchTrackedSiteConfig = typeof options.fetchTrackedSiteConfig === 'function'
    ? options.fetchTrackedSiteConfig
    : async () => ({});
  const getActiveComposerFile = typeof options.getActiveComposerFile === 'function'
    ? options.getActiveComposerFile
    : () => 'index';
  const getContentRootSafe = typeof options.getContentRootSafe === 'function'
    ? options.getContentRootSafe
    : () => 'wwwroot';
  const prepareIndexState = typeof options.prepareIndexState === 'function' ? options.prepareIndexState : (value) => value || {};
  const prepareTabsState = typeof options.prepareTabsState === 'function' ? options.prepareTabsState : (value) => value || {};
  const prepareSiteState = typeof options.prepareSiteState === 'function' ? options.prepareSiteState : (value) => value || {};
  const cloneSiteState = typeof options.cloneSiteState === 'function' ? options.cloneSiteState : (value) => value || {};
  const deepClone = typeof options.deepClone === 'function'
    ? options.deepClone
    : (value) => JSON.parse(JSON.stringify(value));
  const computeBaselineSignature = typeof options.computeBaselineSignature === 'function' ? options.computeBaselineSignature : () => '';
  const getComposerDiff = typeof options.getComposerDiff === 'function' ? options.getComposerDiff : () => null;
  const getRemoteBaseline = typeof options.getRemoteBaseline === 'function' ? options.getRemoteBaseline : () => null;
  const setRemoteBaseline = typeof options.setRemoteBaseline === 'function' ? options.setRemoteBaseline : () => {};
  const setStateSlice = typeof options.setStateSlice === 'function' ? options.setStateSlice : () => {};
  const applyEffectiveSiteConfig = typeof options.applyEffectiveSiteConfig === 'function' ? options.applyEffectiveSiteConfig : () => {};
  const rebuildIndexUI = typeof options.rebuildIndexUI === 'function' ? options.rebuildIndexUI : () => {};
  const rebuildTabsUI = typeof options.rebuildTabsUI === 'function' ? options.rebuildTabsUI : () => {};
  const rebuildSiteUI = typeof options.rebuildSiteUI === 'function' ? options.rebuildSiteUI : () => {};
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : () => {};
  const showStatus = typeof options.showStatus === 'function' ? options.showStatus : () => {};
  const getDraftMeta = typeof options.getDraftMeta === 'function' ? options.getDraftMeta : () => null;
  const clearAutoDraftTimer = typeof options.clearAutoDraftTimer === 'function' ? options.clearAutoDraftTimer : () => {};
  const clearDraftStorage = typeof options.clearDraftStorage === 'function' ? options.clearDraftStorage : () => {};
  const showDiscardConfirm = typeof options.showDiscardConfirm === 'function' ? options.showDiscardConfirm : async () => true;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function'
    ? options.setTimeoutRef
    : () => null;

  function prepareRemoteSnapshot(target, remote) {
    const safeTarget = normalizeTarget(target);
    if (safeTarget === 'tabs') return prepareTabsState(remote || {});
    if (safeTarget === 'site') return cloneSiteState(prepareSiteState(remote || {}));
    return prepareIndexState(remote || {});
  }

  async function fetchRemoteSnapshot(target) {
    const safeTarget = normalizeTarget(target);
    if (safeTarget === 'site') return fetchTrackedSiteConfig();
    const contentRoot = getContentRootSafe();
    const fileBase = getTargetFileBase(safeTarget);
    return fetchConfigWithYamlFallback([`${contentRoot}/${fileBase}.yaml`, `${contentRoot}/${fileBase}.yml`]);
  }

  function setButtonBusy(button, isBusy, label) {
    if (!button) return;
    button.disabled = !!isBusy;
    if (isBusy) {
      button.classList.add('is-busy');
      button.setAttribute('aria-busy', 'true');
    } else {
      button.classList.remove('is-busy');
      button.removeAttribute('aria-busy');
    }
    button.textContent = label;
  }

  function rebuildTargetUi(target) {
    const safeTarget = normalizeTarget(target);
    if (safeTarget === 'tabs') rebuildTabsUI();
    else if (safeTarget === 'site') rebuildSiteUI();
    else rebuildIndexUI();
  }

  function cloneForState(target, value) {
    return normalizeTarget(target) === 'site' ? cloneSiteState(value) : deepClone(value);
  }

  async function handleRefresh(button = null) {
    const target = normalizeTarget(getActiveComposerFile());
    const fileBase = getTargetFileBase(target);
    try {
      setButtonBusy(button, true, t('editor.composer.refreshing'));
      const remote = await fetchRemoteSnapshot(target);
      const prepared = prepareRemoteSnapshot(target, remote || {});
      const baselineSignatureBefore = computeBaselineSignature(target);
      setRemoteBaseline(target, prepared);
      const diffBefore = getComposerDiff(target);
      const hadLocalChanges = !!(diffBefore && diffBefore.hasChanges);
      if (!hadLocalChanges) {
        setStateSlice(target, deepClone(prepared));
        if (target === 'site') applyEffectiveSiteConfig(prepared);
        rebuildTargetUi(target);
        showStatus(
          t('editor.composer.statusMessages.refreshSuccess', {
            name: `${fileBase}.yaml`
          })
        );
      } else {
        notifyComposerChange(target, { skipAutoSave: true });
        const baselineSignatureAfter = computeBaselineSignature(target);
        if (baselineSignatureAfter !== baselineSignatureBefore) {
          showStatus(t('editor.composer.statusMessages.remoteUpdated'));
        } else {
          showStatus(t('editor.composer.statusMessages.remoteUnchanged'));
        }
      }
    } catch (err) {
      consoleRef.error('Refresh failed', err);
      showStatus(t('editor.composer.statusMessages.refreshFailed'));
    } finally {
      setButtonBusy(button, false, t('editor.composer.refresh'));
      setTimeoutRef(() => { showStatus(''); }, 2000);
    }
  }

  async function requestDiscardConfirmation(button, promptMessage) {
    try {
      return await showDiscardConfirm(button, promptMessage);
    } catch (err) {
      consoleRef.warn('Custom discard prompt failed, falling back to native confirm', err);
      return confirmRef(promptMessage);
    }
  }

  async function handleDiscard(button = null) {
    const target = normalizeTarget(getActiveComposerFile());
    const label = getTargetLabel(target);
    const diff = getComposerDiff(target);
    const meta = getDraftMeta(target);
    const hasChanges = !!(diff && diff.hasChanges);
    const hasDraft = !!meta;
    if (!hasChanges && !hasDraft) return;

    const promptMessage = t('editor.composer.discardConfirm.messageReload', { label });
    const proceed = await requestDiscardConfirmation(button, promptMessage);
    if (!proceed) return;

    try {
      setButtonBusy(button, true, t('editor.composer.discardConfirm.discarding'));

      let prepared = null;
      let fetchedFresh = false;
      try {
        const remote = await fetchRemoteSnapshot(target);
        if (remote != null) {
          prepared = prepareRemoteSnapshot(target, remote);
          fetchedFresh = true;
        }
      } catch (err) {
        consoleRef.warn('Discard: failed to fetch fresh remote snapshot', err);
      }

      if (!prepared) {
        const baseline = getRemoteBaseline(target);
        if (target === 'site') prepared = baseline ? cloneSiteState(baseline) : cloneSiteState(prepareSiteState({}));
        else prepared = baseline ? deepClone(baseline) : { __order: [] };
      }

      const normalized = cloneForState(target, prepared);
      setRemoteBaseline(target, cloneForState(target, prepared));
      setStateSlice(target, normalized);
      if (target === 'site') applyEffectiveSiteConfig(normalized);

      clearAutoDraftTimer(target);
      rebuildTargetUi(target);
      clearDraftStorage(target);

      const msg = fetchedFresh
        ? t('editor.composer.discardConfirm.successFresh', { label })
        : t('editor.composer.discardConfirm.successCached', { label });
      showStatus(msg);
      setTimeoutRef(() => { showStatus(''); }, 2000);
    } catch (err) {
      consoleRef.error('Discard failed', err);
      showStatus(t('editor.composer.discardConfirm.failed'));
      setTimeoutRef(() => { showStatus(''); }, 2000);
    } finally {
      setButtonBusy(button, false, t('editor.composer.discardConfirm.discard'));
    }
  }

  return {
    handleDiscard,
    handleRefresh
  };
}
