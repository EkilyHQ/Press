export async function refreshSyncCommitPanelView(options = {}, deps = {}) {
  const {
    documentRef = null,
    t = (key) => key,
    getSyncCommitPanelHost,
    nextRenderId,
    getRenderId,
    computeUnsyncedSummary,
    gatherCommitPayload,
    appendPublishTransportStatus,
    resolvePublishTransport,
    renderFineGrainedTokenSettings,
    appendGithubCommitSummary,
    getVisibleFineGrainedTokenInput,
    getFineGrainedTokenValue,
    setCachedFineGrainedToken,
    ensureConnectPublishGrant,
    getActiveSiteRepoConfig,
    showToast,
    performConnectGithubCommit,
    performDirectGithubCommit,
    switchToPatFallbackAndFocusToken,
    refreshSyncCommitPanel
  } = deps;
  if (!documentRef || typeof documentRef.getElementById !== 'function' || typeof documentRef.createElement !== 'function') {
    return null;
  }
  const panel = getSyncCommitPanelHost();
  if (!panel) return null;
  const headerSubmit = documentRef.getElementById('btnSyncSubmit');
  if (headerSubmit) {
    headerSubmit.disabled = true;
    headerSubmit.removeAttribute('aria-busy');
  }
  const renderId = nextRenderId();
  panel.innerHTML = '';
  const loading = documentRef.createElement('p');
  loading.className = 'muted sync-commit-loading';
  loading.textContent = t('editor.status.checkingDrafts');
  panel.appendChild(loading);

  const summaryEntries = computeUnsyncedSummary();
  let commitPayload;
  try {
    commitPayload = await gatherCommitPayload({ cleanupUnusedAssets: false, showSeoStatus: false });
  } catch (err) {
    if (renderId !== getRenderId()) return null;
    panel.innerHTML = '';
    const error = documentRef.createElement('p');
    error.className = 'sync-commit-error';
    error.textContent = err && err.message ? err.message : t('editor.toasts.githubCommitFailed');
    panel.appendChild(error);
    return null;
  }
  if (renderId !== getRenderId()) return null;

  const commitFiles = Array.isArray(commitPayload.files) ? commitPayload.files : [];
  const seoFiles = Array.isArray(commitPayload.seoFiles) ? commitPayload.seoFiles : [];
  const hasPending = commitFiles.length || summaryEntries.length;

  panel.innerHTML = '';
  const form = documentRef.createElement('form');
  form.id = 'syncCommitForm';
  form.className = 'sync-commit-form comp-guide';
  form.setAttribute('novalidate', 'novalidate');

  const errorText = documentRef.createElement('div');
  errorText.className = 'sync-commit-error';
  errorText.hidden = true;
  form.appendChild(errorText);

  const btnSubmit = headerSubmit;
  if (btnSubmit) {
    btnSubmit.disabled = !hasPending;
    btnSubmit.textContent = t('editor.composer.github.modal.submit');
  }

  const summaryBlock = documentRef.createElement('div');
  summaryBlock.className = 'sync-commit-summary';
  appendPublishTransportStatus(form);
  if (resolvePublishTransport().type === 'pat') {
    renderFineGrainedTokenSettings(form);
  }
  appendGithubCommitSummary(summaryBlock, commitFiles, seoFiles, summaryEntries);
  form.appendChild(summaryBlock);

  panel.appendChild(form);

  const showError = (message, errorOptions = {}) => {
    errorText.textContent = '';
    const text = documentRef.createElement('span');
    text.className = 'sync-commit-error-text';
    text.textContent = message;
    errorText.appendChild(text);
    if (errorOptions && errorOptions.connectFallback) {
      const hint = documentRef.createElement('span');
      hint.className = 'sync-commit-error-hint';
      hint.textContent = t('editor.composer.github.modal.connectFallbackHint');
      const action = documentRef.createElement('button');
      action.type = 'button';
      action.className = 'btn-tertiary sync-connect-fallback-action';
      action.textContent = t('editor.composer.github.modal.connectFallback');
      action.addEventListener('click', () => {
        errorText.hidden = true;
        switchToPatFallbackAndFocusToken();
      });
      errorText.append(hint, action);
    }
    errorText.hidden = false;
  };

  form.addEventListener('submit', async (event) => {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    errorText.hidden = true;
    const currentSummary = computeUnsyncedSummary();
    if (!currentSummary.length && !commitFiles.length) {
      showToast('info', t('editor.composer.noLocalChangesToCommit'));
      refreshSyncCommitPanel();
      return;
    }
    const transport = resolvePublishTransport();
    if (transport.type === 'pat') {
      const input = getVisibleFineGrainedTokenInput();
      const value = getFineGrainedTokenValue();
      if (!value) {
        showError(t('editor.composer.github.modal.errorRequired'));
        if (input && input.offsetParent) {
          try { input.focus({ preventScroll: true }); }
          catch (_) { input.focus(); }
        }
        return;
      }
      setCachedFineGrainedToken(value);
      transport.token = value;
    } else {
      if (transport.invalid || !transport.connect) {
        showError(t('editor.composer.github.modal.connectInvalidUrl'));
        const input = documentRef.getElementById('syncConnectBaseUrlInput');
        if (input && input.offsetParent) {
          try { input.focus({ preventScroll: true }); }
          catch (_) { input.focus(); }
        }
        return;
      }
      try {
        await ensureConnectPublishGrant(transport.connect, getActiveSiteRepoConfig());
      } catch (err) {
        showError(err && err.message ? err.message : t('editor.composer.github.modal.connectAuthorizationFailed'), {
          connectFallback: true
        });
        return;
      }
    }
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.setAttribute('aria-busy', 'true');
    }
    try {
      if (transport.type === 'connect') await performConnectGithubCommit(transport.connect, currentSummary);
      else await performDirectGithubCommit(transport.token, currentSummary);
    } finally {
      if (btnSubmit) btnSubmit.removeAttribute('aria-busy');
      refreshSyncCommitPanel();
    }
  });

  if (options.focusToken) {
    const input = getVisibleFineGrainedTokenInput();
    if (input && typeof input.focus === 'function') {
      try { input.focus({ preventScroll: true }); }
      catch (_) { input.focus(); }
    }
  }
  return { panel, input: getVisibleFineGrainedTokenInput(), form };
}

export function scheduleSyncCommitPanelRefreshView({
  currentMode,
  windowRef = null,
  timer,
  setTimer = () => {},
  refreshSyncCommitPanel = () => {}
} = {}) {
  if (currentMode !== 'sync') return timer || 0;
  try {
    if (timer && windowRef && typeof windowRef.clearTimeout === 'function') windowRef.clearTimeout(timer);
    if (windowRef && typeof windowRef.setTimeout === 'function') {
      const nextTimer = windowRef.setTimeout(() => {
        setTimer(0);
        refreshSyncCommitPanel();
      }, 120);
      setTimer(nextTimer);
      return nextTimer;
    }
  } catch (_) {
  }
  refreshSyncCommitPanel();
  setTimer(0);
  return 0;
}
