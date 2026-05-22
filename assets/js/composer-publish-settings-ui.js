import {
  CONNECT_PUBLISH_PRESETS,
  getDefaultConnectPublishBaseUrl,
  normalizeConnectPublishBaseUrl
} from './publish/settings-store.js?v=press-system-v3.4.27';

export function createPublishTransportSettingsUi({
  documentRef = document,
  windowRef = window,
  t = (key) => key,
  publishSettingsStore,
  getActiveSiteRepoConfig = () => ({}),
  applyMode = () => {},
  showEditorSystemPanel = () => {},
  refreshSyncCommitPanel = () => {},
  scheduleSyncCommitPanelRefresh = () => {}
} = {}) {
  function getCachedFineGrainedToken() {
    return publishSettingsStore.getCachedFineGrainedToken();
  }

  function setCachedFineGrainedToken(token) {
    publishSettingsStore.setCachedFineGrainedToken(token);
  }

  function clearCachedFineGrainedToken() {
    publishSettingsStore.clearCachedFineGrainedToken();
  }

  function getFineGrainedTokenValue() {
    const input = getVisibleFineGrainedTokenInput();
    const value = input && typeof input.value === 'string' ? input.value.trim() : '';
    return value || getCachedFineGrainedToken();
  }

  function getStoredConnectPublishSettings() {
    return publishSettingsStore.getStoredConnectPublishSettings();
  }

  function setStoredConnectPublishSettings(next) {
    return publishSettingsStore.setStoredConnectPublishSettings(next);
  }

  function getConnectPublishSettings() {
    const settings = getStoredConnectPublishSettings();
    const enabledInput = documentRef.getElementById('syncConnectPublishEnabledInput');
    if (enabledInput) {
      settings.enabled = !!enabledInput.checked;
      settings.mode = settings.enabled ? 'connect' : 'pat';
    }
    const baseInput = documentRef.getElementById('syncConnectBaseUrlInput');
    if (baseInput && typeof baseInput.value === 'string') settings.baseUrl = baseInput.value.trim();
    return settings;
  }

  function setConnectPublishEnabled(enabled) {
    return setStoredConnectPublishSettings({
      ...getStoredConnectPublishSettings(),
      enabled: !!enabled,
      mode: enabled ? 'connect' : 'pat'
    });
  }

  function setConnectPublishBaseUrl(baseUrl) {
    return setStoredConnectPublishSettings({
      ...getStoredConnectPublishSettings(),
      baseUrl
    });
  }

  function getVisibleFineGrainedTokenInput() {
    const inputs = Array.from(documentRef.querySelectorAll('#syncGithubTokenInput'));
    return inputs.find(input => input && input.offsetParent !== null) || inputs[0] || null;
  }

  function syncFineGrainedTokenInputs(value, sourceInput = null) {
    const nextValue = typeof value === 'string' ? value : '';
    documentRef.querySelectorAll('#syncGithubTokenInput').forEach(input => {
      if (input !== sourceInput) input.value = nextValue;
      const wrapper = input.closest ? input.closest('.cs-token-settings') : null;
      const clear = wrapper && wrapper.querySelector ? wrapper.querySelector('.cs-token-clear') : null;
      if (!clear) return;
      const hasValue = !!String(input.value || '').trim();
      clear.setAttribute('aria-disabled', hasValue ? 'false' : 'true');
      clear.tabIndex = hasValue ? 0 : -1;
    });
  }

  function focusFineGrainedTokenInput() {
    const input = getVisibleFineGrainedTokenInput();
    if (!input || typeof input.focus !== 'function') return false;
    try { input.focus({ preventScroll: true }); }
    catch (_) { input.focus(); }
    return true;
  }

  function updatePublishTransportSettingsDomForPatFallback() {
    const enabledInput = documentRef.getElementById('syncConnectPublishEnabledInput');
    if (!enabledInput) return;
    enabledInput.checked = false;
    const method = enabledInput.closest ? enabledInput.closest('.cs-publish-method-switch') : null;
    if (method) method.dataset.state = 'off';
    const methodText = method && method.querySelector ? method.querySelector('.cs-switch-label') : null;
    if (methodText) methodText.textContent = t('editor.composer.github.modal.publishMethodPat');
    const wrapper = enabledInput.closest ? enabledInput.closest('.cs-publish-transport-settings') : null;
    const connectPanel = wrapper && wrapper.querySelector ? wrapper.querySelector('.cs-connect-publish-settings') : null;
    const patPanel = wrapper && wrapper.querySelector ? wrapper.querySelector('.cs-pat-publish-settings') : null;
    if (connectPanel) connectPanel.hidden = true;
    if (patPanel) patPanel.hidden = false;
  }

  function openSyncPanelForPatFallback() {
    try {
      applyMode('sync', { preserveTreeExpansion: true });
      return;
    } catch (_) {}
    try { showEditorSystemPanel('sync'); } catch (_) {}
  }

  function switchToPatFallbackAndFocusToken() {
    setConnectPublishEnabled(false);
    openSyncPanelForPatFallback();
    updatePublishTransportSettingsDomForPatFallback();
    try {
      refreshSyncCommitPanel({ focusToken: true })
        .then(() => focusFineGrainedTokenInput())
        .catch(() => focusFineGrainedTokenInput());
    } catch (_) {}
    const focusLater = () => {
      if (focusFineGrainedTokenInput()) return;
      openSyncPanelForPatFallback();
      updatePublishTransportSettingsDomForPatFallback();
      focusFineGrainedTokenInput();
    };
    try {
      windowRef.requestAnimationFrame(() => windowRef.requestAnimationFrame(focusLater));
    } catch (_) {
      windowRef.setTimeout(focusLater, 0);
    }
    windowRef.setTimeout(focusLater, 120);
  }

  function getCachedConnectPublishGrant() {
    return publishSettingsStore.getCachedConnectPublishGrant();
  }

  function setCachedConnectPublishGrant(grant) {
    publishSettingsStore.setCachedConnectPublishGrant(grant);
  }

  function clearCachedConnectPublishGrant() {
    publishSettingsStore.clearCachedConnectPublishGrant();
  }

  function getMatchingConnectPublishGrant(connect, repo = getActiveSiteRepoConfig()) {
    const cached = getCachedConnectPublishGrant();
    if (!cached || !connect || !connect.baseUrl || !repo || !repo.owner || !repo.name) return null;
    const branch = repo.branch || 'main';
    if (cached.baseUrl !== connect.baseUrl) return null;
    if (cached.owner !== repo.owner || cached.name !== repo.name || cached.branch !== branch) return null;
    return cached;
  }

  function resolvePublishTransport() {
    return publishSettingsStore.resolvePublishTransport(getConnectPublishSettings());
  }

  function renderFineGrainedTokenSettings(host) {
    if (!host) return null;
    const wrapper = documentRef.createElement('div');
    wrapper.className = 'cs-token-settings';

    const tokenField = documentRef.createElement('label');
    tokenField.className = 'cs-repo-field-group cs-repo-field-group--token cs-token-field';
    const title = documentRef.createElement('span');
    title.className = 'cs-repo-field-title';
    title.textContent = t('editor.composer.github.modal.tokenLabel');
    const field = documentRef.createElement('div');
    field.className = 'cs-repo-field cs-repo-field--token';
    const affix = documentRef.createElement('span');
    affix.className = 'cs-repo-affix cs-repo-icon-affix cs-token-affix';
    affix.setAttribute('aria-hidden', 'true');
    affix.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" focusable="false"><path d="M10.5 0a5.499 5.499 0 1 1-1.288 10.848l-.932.932a.749.749 0 0 1-.53.22H7v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22H5v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22h-2A1.75 1.75 0 0 1 0 14.25v-2c0-.199.079-.389.22-.53l4.932-4.932A5.5 5.5 0 0 1 10.5 0Zm-4 5.5c-.001.431.069.86.205 1.269a.75.75 0 0 1-.181.768L1.5 12.56v1.69c0 .138.112.25.25.25h1.69l.06-.06v-1.19a.75.75 0 0 1 .75-.75h1.19l.06-.06v-1.19a.75.75 0 0 1 .75-.75h1.19l1.023-1.025a.75.75 0 0 1 .768-.18A4 4 0 1 0 6.5 5.5ZM11 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"></path></svg>';
    const input = documentRef.createElement('input');
    input.id = 'syncGithubTokenInput';
    input.type = 'password';
    input.className = 'cs-input cs-repo-input cs-repo-input--token';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = getCachedFineGrainedToken();
    const btnForget = documentRef.createElement('span');
    btnForget.setAttribute('role', 'button');
    btnForget.tabIndex = input.value ? 0 : -1;
    btnForget.className = 'cs-token-clear';
    btnForget.textContent = '×';
    btnForget.setAttribute('aria-label', t('editor.composer.github.modal.forget'));
    btnForget.setAttribute('aria-disabled', input.value ? 'false' : 'true');
    field.append(affix, input, btnForget);
    tokenField.append(title, field);
    wrapper.appendChild(tokenField);

    const help = documentRef.createElement('p');
    help.className = 'muted sync-token-help cs-token-help';
    help.innerHTML = t('editor.composer.github.modal.helpHtml');
    wrapper.appendChild(help);

    input.addEventListener('input', () => {
      setCachedFineGrainedToken(input.value);
      syncFineGrainedTokenInputs(input.value, input);
    });

    const clearToken = () => {
      if (btnForget.getAttribute('aria-disabled') === 'true') return;
      clearCachedFineGrainedToken();
      syncFineGrainedTokenInputs('');
      try { input.focus({ preventScroll: true }); }
      catch (_) { input.focus(); }
    };

    btnForget.addEventListener('click', clearToken);
    btnForget.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      clearToken();
    });

    host.appendChild(wrapper);
    return { wrapper, input, btnForget };
  }

  function renderPublishTransportSettings(host) {
    if (!host) return null;
    const settings = getConnectPublishSettings();
    const wrapper = documentRef.createElement('div');
    wrapper.className = 'cs-publish-transport-settings';

    const header = documentRef.createElement('div');
    header.className = 'cs-publish-transport-header';
    const title = documentRef.createElement('span');
    title.className = 'cs-publish-transport-title';
    title.textContent = t('editor.composer.github.modal.connectTitle');

    const method = documentRef.createElement('label');
    method.className = 'cs-switch cs-publish-method-switch';
    method.dataset.state = settings.enabled ? 'on' : 'off';
    const enabledInput = documentRef.createElement('input');
    enabledInput.type = 'checkbox';
    enabledInput.id = 'syncConnectPublishEnabledInput';
    enabledInput.className = 'cs-switch-input';
    enabledInput.checked = !!settings.enabled;
    const track = documentRef.createElement('span');
    track.className = 'cs-switch-track';
    track.setAttribute('aria-hidden', 'true');
    const thumb = documentRef.createElement('span');
    thumb.className = 'cs-switch-thumb';
    track.appendChild(thumb);
    const methodText = documentRef.createElement('span');
    methodText.className = 'cs-switch-label';
    methodText.textContent = settings.enabled
      ? t('editor.composer.github.modal.publishMethodConnect')
      : t('editor.composer.github.modal.publishMethodPat');
    method.append(enabledInput, track, methodText);
    header.append(title, method);
    wrapper.appendChild(header);

    const connectPanel = documentRef.createElement('div');
    connectPanel.className = 'cs-connect-publish-settings';
    connectPanel.hidden = !settings.enabled;

    const connectField = documentRef.createElement('label');
    connectField.className = 'cs-repo-field-group cs-repo-field-group--connect cs-connect-url-field';
    const connectTitle = documentRef.createElement('span');
    connectTitle.className = 'cs-repo-field-title';
    connectTitle.textContent = t('editor.composer.github.modal.connectBaseUrlLabel');
    const field = documentRef.createElement('div');
    field.className = 'cs-repo-field cs-repo-field--connect-url';
    const affix = documentRef.createElement('span');
    affix.className = 'cs-repo-affix cs-repo-icon-affix';
    affix.setAttribute('aria-hidden', 'true');
    affix.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" focusable="false"><path d="M7.75 0a.75.75 0 0 1 .75.75V3h2.75A2.75 2.75 0 0 1 14 5.75v4.5A2.75 2.75 0 0 1 11.25 13H8.5v2.25a.75.75 0 0 1-1.5 0V13H4.75A2.75 2.75 0 0 1 2 10.25v-4.5A2.75 2.75 0 0 1 4.75 3H7V.75A.75.75 0 0 1 7.75 0ZM4.75 4.5c-.69 0-1.25.56-1.25 1.25v4.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25v-4.5c0-.69-.56-1.25-1.25-1.25h-6.5Z"></path></svg>';
    const input = documentRef.createElement('input');
    input.id = 'syncConnectBaseUrlInput';
    input.type = 'url';
    input.className = 'cs-input cs-repo-input cs-repo-input--connect-url';
    input.setAttribute('list', 'syncConnectBaseUrlPresets');
    input.placeholder = getDefaultConnectPublishBaseUrl();
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.value = settings.baseUrl || getDefaultConnectPublishBaseUrl();
    const presetList = documentRef.createElement('datalist');
    presetList.id = 'syncConnectBaseUrlPresets';
    CONNECT_PUBLISH_PRESETS.forEach((preset) => {
      const option = documentRef.createElement('option');
      option.value = preset.value;
      option.label = preset.label;
      presetList.appendChild(option);
    });
    field.append(affix, input);
    connectField.append(connectTitle, field);
    connectPanel.append(connectField, presetList);

    const state = documentRef.createElement('p');
    state.className = 'muted cs-connect-publish-grant';
    connectPanel.appendChild(state);

    const help = documentRef.createElement('p');
    help.className = 'muted cs-connect-help';
    help.textContent = t('editor.composer.github.modal.connectBaseUrlHelp');
    connectPanel.appendChild(help);

    const patPanel = documentRef.createElement('div');
    patPanel.className = 'cs-pat-publish-settings';
    patPanel.hidden = !!settings.enabled;
    renderFineGrainedTokenSettings(patPanel);

    const updateConnectState = () => {
      const current = getConnectPublishSettings();
      const baseUrl = normalizeConnectPublishBaseUrl(current.baseUrl);
      state.classList.toggle('is-error', current.enabled && !baseUrl);
      if (!current.enabled) {
        state.textContent = '';
      } else if (!baseUrl) {
        state.textContent = t('editor.composer.github.modal.connectInvalidUrl');
      } else {
        const cached = getMatchingConnectPublishGrant({ baseUrl });
        state.textContent = cached
          ? t('editor.composer.github.modal.connectConnected')
          : t('editor.composer.github.modal.connectHelp', { baseUrl });
      }
    };

    input.addEventListener('input', () => {
      setConnectPublishBaseUrl(input.value);
      updateConnectState();
      scheduleSyncCommitPanelRefresh();
    });

    enabledInput.addEventListener('change', () => {
      setConnectPublishEnabled(enabledInput.checked);
      method.dataset.state = enabledInput.checked ? 'on' : 'off';
      methodText.textContent = enabledInput.checked
        ? t('editor.composer.github.modal.publishMethodConnect')
        : t('editor.composer.github.modal.publishMethodPat');
      connectPanel.hidden = !enabledInput.checked;
      patPanel.hidden = enabledInput.checked;
      updateConnectState();
      scheduleSyncCommitPanelRefresh();
    });

    updateConnectState();
    wrapper.append(connectPanel, patPanel);
    host.appendChild(wrapper);
    return { wrapper, enabledInput, input };
  }

  return {
    getCachedFineGrainedToken,
    setCachedFineGrainedToken,
    clearCachedFineGrainedToken,
    getFineGrainedTokenValue,
    getStoredConnectPublishSettings,
    setStoredConnectPublishSettings,
    getConnectPublishSettings,
    setConnectPublishEnabled,
    getCachedConnectPublishGrant,
    setCachedConnectPublishGrant,
    clearCachedConnectPublishGrant,
    getMatchingConnectPublishGrant,
    resolvePublishTransport,
    getVisibleFineGrainedTokenInput,
    renderFineGrainedTokenSettings,
    renderPublishTransportSettings,
    switchToPatFallbackAndFocusToken
  };
}
