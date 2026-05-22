const noop = () => {};

function normalizeKind(kind) {
  if (kind === 'tabs') return 'tabs';
  if (kind === 'site') return 'site';
  return 'index';
}

function yamlBaseName(kind) {
  const safeKind = normalizeKind(kind);
  if (safeKind === 'tabs') return 'tabs';
  if (safeKind === 'site') return 'site';
  return 'index';
}

function yamlLabel(kind) {
  return `${yamlBaseName(kind)}.yaml`;
}

export function createComposerRemoteSyncController(options = {}) {
  const fetchContent = typeof options.fetchContent === 'function'
    ? options.fetchContent
    : (url, fetchOptions) => fetch(url, fetchOptions);
  const getContentRootSafe = typeof options.getContentRootSafe === 'function' ? options.getContentRootSafe : () => 'wwwroot';
  const normalizeRelPath = typeof options.normalizeRelPath === 'function'
    ? options.normalizeRelPath
    : (value) => String(value || '').replace(/[\\]/g, '/').replace(/^\/+/, '');
  const normalizeMarkdownContent = typeof options.normalizeMarkdownContent === 'function'
    ? options.normalizeMarkdownContent
    : (value) => String(value == null ? '' : value).replace(/\r\n/g, '\n');
  const computeTextSignature = typeof options.computeTextSignature === 'function' ? options.computeTextSignature : (value) => String(value == null ? '' : value);
  const parseEncryptedMarkdownEnvelope = typeof options.parseEncryptedMarkdownEnvelope === 'function'
    ? options.parseEncryptedMarkdownEnvelope
    : () => ({ encrypted: false, valid: true });
  const createMarkdownProtectionState = typeof options.createMarkdownProtectionState === 'function' ? options.createMarkdownProtectionState : () => ({});
  const getMarkdownProtectionState = typeof options.getMarkdownProtectionState === 'function' ? options.getMarkdownProtectionState : () => ({});
  const setMarkdownProtectionState = typeof options.setMarkdownProtectionState === 'function' ? options.setMarkdownProtectionState : noop;
  const isMarkdownTabProtected = typeof options.isMarkdownTabProtected === 'function' ? options.isMarkdownTabProtected : () => false;
  const hasMarkdownDraftContent = typeof options.hasMarkdownDraftContent === 'function' ? options.hasMarkdownDraftContent : () => false;
  const setDynamicTabStatus = typeof options.setDynamicTabStatus === 'function' ? options.setDynamicTabStatus : noop;
  const updateDynamicTabDirtyState = typeof options.updateDynamicTabDirtyState === 'function' ? options.updateDynamicTabDirtyState : noop;
  const updateComposerMarkdownDraftIndicators = typeof options.updateComposerMarkdownDraftIndicators === 'function' ? options.updateComposerMarkdownDraftIndicators : noop;
  const getCurrentMode = typeof options.getCurrentMode === 'function' ? options.getCurrentMode : () => null;
  const getPrimaryEditorApi = typeof options.getPrimaryEditorApi === 'function' ? options.getPrimaryEditorApi : () => null;
  const basenameFromPath = typeof options.basenameFromPath === 'function'
    ? options.basenameFromPath
    : (value) => String(value || '').split('/').filter(Boolean).pop() || '';
  const startRemoteSyncWatcher = typeof options.startRemoteSyncWatcher === 'function' ? options.startRemoteSyncWatcher : () => null;
  const showToast = typeof options.showToast === 'function' ? options.showToast : noop;
  const updateMarkdownPushButton = typeof options.updateMarkdownPushButton === 'function' ? options.updateMarkdownPushButton : noop;
  const updateMarkdownDiscardButton = typeof options.updateMarkdownDiscardButton === 'function' ? options.updateMarkdownDiscardButton : noop;
  const updateMarkdownSaveButton = typeof options.updateMarkdownSaveButton === 'function' ? options.updateMarkdownSaveButton : noop;
  const updateMarkdownProtectionButton = typeof options.updateMarkdownProtectionButton === 'function' ? options.updateMarkdownProtectionButton : noop;
  const parseYAML = typeof options.parseYAML === 'function' ? options.parseYAML : () => null;
  const prepareIndexState = typeof options.prepareIndexState === 'function' ? options.prepareIndexState : (value) => value;
  const prepareTabsState = typeof options.prepareTabsState === 'function' ? options.prepareTabsState : (value) => value;
  const prepareSiteState = typeof options.prepareSiteState === 'function' ? options.prepareSiteState : (value) => value;
  const cloneSiteState = typeof options.cloneSiteState === 'function' ? options.cloneSiteState : (value) => value;
  const deepClone = typeof options.deepClone === 'function'
    ? options.deepClone
    : (value) => JSON.parse(JSON.stringify(value));
  const setRemoteBaseline = typeof options.setRemoteBaseline === 'function' ? options.setRemoteBaseline : noop;
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : noop;
  const clearDraftStorage = typeof options.clearDraftStorage === 'function' ? options.clearDraftStorage : noop;
  const updateUnsyncedSummary = typeof options.updateUnsyncedSummary === 'function' ? options.updateUnsyncedSummary : noop;
  const closeComposerDiffModalForKind = typeof options.closeComposerDiffModalForKind === 'function' ? options.closeComposerDiffModalForKind : noop;
  const t = typeof options.t === 'function' ? options.t : (key, params) => {
    if (params && params.label) return `${key}: ${params.label}`;
    if (params && params.message) return `${key}: ${params.message}`;
    return String(key || '');
  };

  function refreshMarkdownActionButtons(tab) {
    updateMarkdownPushButton(tab);
    updateMarkdownDiscardButton(tab);
    updateMarkdownSaveButton(tab);
    updateMarkdownProtectionButton(tab);
  }

  async function fetchMarkdownRemoteSnapshot(tab) {
    if (!tab || !tab.path) return null;
    const root = getContentRootSafe();
    const rel = normalizeRelPath(tab.path);
    if (!rel) return null;
    const url = `${root}/${rel}`.replace(/[\\]/g, '/');
    let res;
    try {
      res = await fetchContent(url, { cache: 'no-store' });
    } catch (err) {
      return {
        state: 'error',
        status: 0,
        message: err && err.message ? err.message : t('editor.composer.remoteWatcher.networkError')
      };
    }

    const checkedAt = Date.now();

    if (res.status === 404) {
      return { state: 'missing', status: 404, content: '', signature: computeTextSignature(''), checkedAt };
    }

    if (!res.ok) {
      return { state: 'error', status: res.status, message: `HTTP ${res.status}`, checkedAt };
    }

    const text = normalizeMarkdownContent(await res.text());
    return {
      state: 'existing',
      status: res.status,
      content: text,
      signature: computeTextSignature(text),
      checkedAt
    };
  }

  function applyMarkdownRemoteSnapshot(tab, snapshot, applyOptions = {}) {
    if (!tab) return;
    const normalized = normalizeMarkdownContent(snapshot && snapshot.content != null ? snapshot.content : '');
    const envelope = parseEncryptedMarkdownEnvelope(normalized);
    const protectedSnapshot = envelope.encrypted;
    const baselineContent = protectedSnapshot
      ? normalizeMarkdownContent((applyOptions && applyOptions.plaintextContent) || tab.content || '')
      : normalized;
    tab.remoteContent = baselineContent;
    tab.remoteSignature = computeTextSignature(normalized);
    tab.loaded = true;
    if (protectedSnapshot) {
      setMarkdownProtectionState(tab, {
        ...getMarkdownProtectionState(tab),
        enabled: true,
        encryptedRemote: true,
        passwordChanged: false,
        remoteSignature: tab.remoteSignature,
        remoteCiphertext: envelope.ciphertext || ''
      });
    } else if (!isMarkdownTabProtected(tab)) {
      setMarkdownProtectionState(tab, createMarkdownProtectionState());
    }

    const stateLabel = snapshot && snapshot.state === 'missing' ? 'missing' : 'existing';
    const statusCode = snapshot && snapshot.status;
    const statusMessage = snapshot && snapshot.state === 'missing'
      ? t('editor.composer.remoteWatcher.fileNotFoundOnServer')
      : t('editor.composer.remoteWatcher.remoteSnapshotUpdated');

    setDynamicTabStatus(tab, {
      state: stateLabel,
      checkedAt: Date.now(),
      code: statusCode,
      message: statusMessage
    });

    if (!hasMarkdownDraftContent(tab)) {
      const currentNormalized = normalizeMarkdownContent(tab.content || '');
      tab.content = currentNormalized;
      if (currentNormalized !== baselineContent) {
        tab.content = baselineContent;
        if (getCurrentMode() === tab.mode) {
          const editorApi = getPrimaryEditorApi();
          if (editorApi && typeof editorApi.setValue === 'function') {
            try { editorApi.setValue(baselineContent, { notify: false }); } catch (_) {}
          }
        }
      }
    }

    updateDynamicTabDirtyState(tab, { autoSave: false });
    updateComposerMarkdownDraftIndicators({ path: tab.path });
  }

  function startMarkdownSyncWatcher(tab, watcherOptions = {}) {
    if (!tab || !tab.path) return null;
    const expectedSignature = watcherOptions.expectedSignature || computeTextSignature(tab.content || '');
    const label = watcherOptions.label || tab.label || basenameFromPath(tab.path) || tab.path;
    const isCreate = !!watcherOptions.isCreate;
    const message = isCreate
      ? t('editor.composer.remoteWatcher.waitingForCreate', { label })
      : t('editor.composer.remoteWatcher.waitingForUpdate', { label });

    const previousStatus = tab.fileStatus && typeof tab.fileStatus === 'object'
      ? { ...tab.fileStatus }
      : null;

    setDynamicTabStatus(tab, {
      state: 'checking',
      checkedAt: Date.now(),
      message: t('editor.composer.remoteWatcher.waitingForCommitStatus')
    });
    updateMarkdownPushButton(tab);

    return startRemoteSyncWatcher({
      title: t('editor.composer.remoteWatcher.checkingRemoteChanges'),
      message,
      initialStatus: t('editor.composer.remoteWatcher.waitingForCommit'),
      cancelLabel: t('editor.composer.remoteWatcher.stopWaiting'),
      fetch: async ({ attempts }) => {
        const snapshot = await fetchMarkdownRemoteSnapshot(tab);
        if (!snapshot) {
          return { done: false, statusMessage: t('editor.composer.remoteWatcher.waitingForRemoteResponse'), retryDelay: 5000 };
        }
        if (snapshot.state === 'error') {
          const msg = snapshot.message
            ? t('editor.composer.remoteWatcher.errorWithDetail', { message: snapshot.message })
            : t('editor.composer.remoteWatcher.remoteCheckFailedRetry');
          return { done: false, statusMessage: msg, retryDelay: 6000 };
        }
        if (snapshot.state === 'missing') {
          const done = expectedSignature === computeTextSignature('');
          const statusMessage = isCreate
            ? t('editor.composer.remoteWatcher.remoteFileNotFoundYet')
            : t('editor.composer.remoteWatcher.remoteFileStillMissing');
          return { done, data: snapshot, statusMessage, retryDelay: 5600 };
        }
        const matches = snapshot.signature === expectedSignature;
        if (matches) {
          return { done: true, data: snapshot, statusMessage: t('editor.composer.remoteWatcher.updateDetectedRefreshing') };
        }
        const waitingStatus = attempts >= 3
          ? t('editor.composer.remoteWatcher.remoteFileDiffersWaiting')
          : t('editor.composer.remoteWatcher.remoteFileExistsDiffersWaiting');
        const response = {
          done: false,
          statusMessage: waitingStatus,
          retryDelay: 5200
        };
        if (attempts === 3) {
          response.message = t('editor.composer.remoteWatcher.mismatchAdvice');
        }
        return response;
      },
      onSuccess: (result) => {
        if (result && result.data) {
          applyMarkdownRemoteSnapshot(tab, result.data, {
            plaintextContent: watcherOptions.plaintextContent || ''
          });
          if (result.mismatch) {
            showToast('warn', t('editor.toasts.remoteMarkdownMismatch'), { duration: 4200 });
          } else {
            showToast('success', t('editor.toasts.markdownSynced'));
          }
        }
        refreshMarkdownActionButtons(tab);
      },
      onCancel: () => {
        const fallbackStatus = (previousStatus && previousStatus.state)
          ? previousStatus
          : { state: isCreate ? 'missing' : 'existing' };
        setDynamicTabStatus(tab, {
          ...fallbackStatus,
          checkedAt: Date.now(),
          message: t('editor.composer.remoteWatcher.remoteCheckCanceled')
        });
        refreshMarkdownActionButtons(tab);
        showToast('info', t('editor.toasts.remoteCheckCanceledUseRefresh'));
      }
    });
  }

  async function fetchComposerRemoteSnapshot(kind) {
    const safeKind = normalizeKind(kind);
    const root = getContentRootSafe();
    const base = yamlBaseName(safeKind);
    const urls = [`${root}/${base}.yaml`, `${root}/${base}.yml`];
    let lastStatus = 404;
    for (const url of urls) {
      let res;
      try {
        res = await fetchContent(url, { cache: 'no-store' });
      } catch (err) {
        return {
          state: 'error',
          status: 0,
          message: err && err.message ? err.message : t('editor.composer.remoteWatcher.networkError')
        };
      }
      lastStatus = res.status;
      if (res.status === 404) continue;
      if (!res.ok) {
        return { state: 'error', status: res.status, message: `HTTP ${res.status}` };
      }
      const text = await res.text();
      let parsed = null;
      try { parsed = parseYAML(text); }
      catch (_) { parsed = null; }
      return {
        state: 'existing',
        status: res.status,
        text,
        parsed,
        signature: computeTextSignature(text)
      };
    }
    return { state: 'missing', status: lastStatus };
  }

  function applyComposerRemoteSnapshot(kind, snapshot) {
    const safeKind = normalizeKind(kind);
    if (!snapshot || snapshot.state !== 'existing') return;
    let parsed = snapshot.parsed;
    if (!parsed || typeof parsed !== 'object') {
      try { parsed = parseYAML(snapshot.text || ''); }
      catch (_) { parsed = null; }
    }
    if (!parsed || typeof parsed !== 'object') {
      showToast('warn', t('editor.toasts.yamlParseFailed', { label: yamlLabel(safeKind) }), { duration: 4200 });
      return;
    }
    let prepared;
    if (safeKind === 'tabs') prepared = prepareTabsState(parsed);
    else if (safeKind === 'site') prepared = cloneSiteState(prepareSiteState(parsed));
    else prepared = prepareIndexState(parsed);
    setRemoteBaseline(safeKind, safeKind === 'site' ? prepared : deepClone(prepared));
    notifyComposerChange(safeKind, { skipAutoSave: true });
  }

  function startComposerSyncWatcher(kind, watcherOptions = {}) {
    const safeKind = normalizeKind(kind);
    const label = yamlLabel(safeKind);
    const expectedText = watcherOptions.expectedText != null ? String(watcherOptions.expectedText) : '';
    const expectedSignature = computeTextSignature(expectedText);
    const message = watcherOptions.message || t('editor.composer.remoteWatcher.waitingForLabel', { label });

    return startRemoteSyncWatcher({
      title: watcherOptions.title || t('editor.composer.remoteWatcher.waitingForGitHub'),
      message,
      initialStatus: watcherOptions.initialStatus || t('editor.composer.remoteWatcher.waitingForCommit'),
      cancelLabel: watcherOptions.cancelLabel || t('editor.composer.remoteWatcher.stopWaiting'),
      fetch: async ({ attempts }) => {
        const snapshot = await fetchComposerRemoteSnapshot(safeKind);
        if (!snapshot) {
          return { done: false, statusMessage: t('editor.composer.remoteWatcher.waitingForRemote'), retryDelay: 5200 };
        }
        if (snapshot.state === 'missing') {
          return { done: false, statusMessage: t('editor.composer.remoteWatcher.yamlNotFoundYet', { label }), retryDelay: 5600 };
        }
        if (snapshot.state === 'error') {
          const msg = snapshot.message
            ? t('editor.composer.remoteWatcher.errorWithDetail', { message: snapshot.message })
            : t('editor.composer.remoteWatcher.remoteCheckFailedRetry');
          return { done: false, statusMessage: msg, retryDelay: 6200 };
        }
        const matches = snapshot.signature === expectedSignature;
        if (matches) {
          return { done: true, data: snapshot, statusMessage: t('editor.composer.remoteWatcher.updateDetectedRefreshing') };
        }
        const waitingStatus = attempts >= 3
          ? t('editor.composer.remoteWatcher.remoteYamlDiffersWaiting')
          : t('editor.composer.remoteWatcher.remoteYamlExistsDiffersWaiting');
        const response = {
          done: false,
          statusMessage: waitingStatus,
          retryDelay: 5400
        };
        if (attempts === 3) {
          response.message = t('editor.composer.remoteWatcher.yamlMismatchAdvice');
        }
        return response;
      },
      onSuccess: (result) => {
        if (result && result.data) {
          applyComposerRemoteSnapshot(safeKind, result.data);
          if (result.mismatch) {
            showToast('warn', t('editor.toasts.yamlUpdatedDifferently', { label }), { duration: 4600 });
          } else {
            clearDraftStorage(safeKind);
            updateUnsyncedSummary();
            closeComposerDiffModalForKind(safeKind);
            showToast('success', t('editor.toasts.yamlSynced', { label }));
          }
        }
      },
      onCancel: () => {
        showToast('info', t('editor.toasts.remoteCheckCanceledClickRefresh'));
      }
    });
  }

  return {
    fetchMarkdownRemoteSnapshot,
    applyMarkdownRemoteSnapshot,
    startMarkdownSyncWatcher,
    fetchComposerRemoteSnapshot,
    applyComposerRemoteSnapshot,
    startComposerSyncWatcher
  };
}
