function noop() {}

function identityTranslate(key) {
  return String(key || '');
}

function setButtonBusyState(button, busy, text, setButtonLabel) {
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

export function createComposerMarkdownActionsController(options = {}) {
  const consoleRef = options.consoleRef || { error: noop, warn: noop };
  const confirmRef = typeof options.confirmRef === 'function'
    ? options.confirmRef
    : () => true;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function'
    ? options.clearTimeoutRef
    : () => {};
  const t = typeof options.t === 'function' ? options.t : identityTranslate;
  const showToast = typeof options.showToast === 'function' ? options.showToast : noop;
  const setButtonLabel = typeof options.setButtonLabel === 'function' ? options.setButtonLabel : noop;
  const getButtonLabel = typeof options.getButtonLabel === 'function' ? options.getButtonLabel : () => '';
  const getCurrentMode = typeof options.getCurrentMode === 'function' ? options.getCurrentMode : () => null;

  function getActiveTab() {
    return typeof options.getActiveDynamicTab === 'function' ? options.getActiveDynamicTab() : null;
  }

  function syncEditorValueToTab(tab) {
    const editorApi = typeof options.getPrimaryEditorApi === 'function' ? options.getPrimaryEditorApi() : null;
    if (editorApi && typeof editorApi.getValue === 'function' && getCurrentMode() === tab.mode) {
      try { tab.content = String(editorApi.getValue() || ''); }
      catch (_) {}
    }
  }

  async function ensureTabContentLoaded(tab, logMessage, updateButton) {
    try {
      if (tab.pending) await tab.pending;
      else if (!tab.loaded && typeof options.loadDynamicTabContent === 'function') await options.loadDynamicTabContent(tab);
      return true;
    } catch (err) {
      consoleRef.error(logMessage, err);
      showToast('error', t('editor.toasts.unableLoadLatestMarkdown'));
      if (typeof updateButton === 'function') updateButton(tab);
      return false;
    }
  }

  async function manualSaveActiveMarkdown(triggerButton) {
    const active = getActiveTab();
    if (!active || !active.path) {
      showToast('info', options.getMarkdownSaveTooltip('noFile'));
      options.updateMarkdownSaveButton(null);
      return;
    }

    const saveState = options.getManualMarkdownSaveState(active.content, active.isDirty);
    if (!saveState.canSave) {
      showToast('info', options.getMarkdownSaveTooltip(saveState.reason));
      options.updateMarkdownSaveButton(active);
      return;
    }

    const button = triggerButton || options.getMarkdownSaveButton();
    const originalLabel = button ? (getButtonLabel(button) || options.getMarkdownSaveLabel()) : '';
    setButtonBusyState(button, true, options.getMarkdownSaveBusyLabel(), setButtonLabel);

    try {
      if (active.markdownDraftTimer) {
        try { clearTimeoutRef(active.markdownDraftTimer); }
        catch (_) {}
        active.markdownDraftTimer = null;
      }

      const saved = await options.saveMarkdownDraftForTab(active, { markManual: true });
      if (saved) {
        options.pushEditorCurrentFileInfo(active);
        showToast('success', t('editor.composer.markdown.save.toastSuccess'));
      } else {
        showToast('info', options.getMarkdownSaveTooltip('empty'));
      }
    } catch (err) {
      consoleRef.error('Manual markdown save failed', err);
      showToast('error', t('editor.composer.markdown.save.toastError'));
    } finally {
      setButtonBusyState(button, false, originalLabel || options.getMarkdownSaveLabel(), setButtonLabel);
      options.updateMarkdownSaveButton(active);
      options.updateMarkdownDiscardButton(active);
      options.updateMarkdownPushButton(active);
      options.updateMarkdownProtectionButton(active);
      try { options.updateUnsyncedSummary(); }
      catch (_) {}
    }
  }

  async function handleMarkdownProtectionButton(anchor) {
    const active = getActiveTab();
    if (!active || !active.path) {
      showToast('info', t('editor.composer.markdown.protection.tooltipNoFile'));
      options.updateMarkdownProtectionButton(null);
      return;
    }
    syncEditorValueToTab(active);
    const loaded = await ensureTabContentLoaded(
      active,
      'Failed to load markdown before changing protection',
      options.updateMarkdownProtectionButton
    );
    if (!loaded) return;

    const currentProtection = options.getMarkdownProtectionState(active);
    if (!currentProtection.enabled) {
      const password = await options.requestMarkdownProtectionPassword({
        title: t('editor.composer.markdown.protection.enableTitle'),
        message: t('editor.composer.markdown.protection.enableMessage'),
        confirmLabel: t('editor.composer.markdown.protection.enable'),
        confirm: true
      });
      if (!password) return;
      options.setMarkdownProtectionState(active, {
        ...currentProtection,
        enabled: true,
        password,
        passwordChanged: true
      });
      options.updateDynamicTabDirtyState(active);
      options.updateMarkdownProtectionButton(active);
      showToast('success', t('editor.composer.markdown.protection.enabledToast'));
      return;
    }

    const changePassword = await options.showComposerDiscardConfirm(anchor, t('editor.composer.markdown.protection.changePrompt'), {
      confirmLabel: t('editor.composer.markdown.protection.changePassword'),
      cancelLabel: t('editor.composer.markdown.protection.disable')
    });
    if (changePassword) {
      const password = await options.requestMarkdownProtectionPassword({
        title: t('editor.composer.markdown.protection.changeTitle'),
        message: t('editor.composer.markdown.protection.changeMessage'),
        confirmLabel: t('editor.composer.markdown.protection.changePassword'),
        confirm: true
      });
      if (!password) return;
      options.setMarkdownProtectionState(active, {
        ...currentProtection,
        enabled: true,
        password,
        passwordChanged: true
      });
      options.updateDynamicTabDirtyState(active);
      options.updateMarkdownProtectionButton(active);
      showToast('success', t('editor.composer.markdown.protection.passwordChangedToast'));
      return;
    }

    const disable = await options.showComposerDiscardConfirm(anchor, t('editor.composer.markdown.protection.disableConfirm'), {
      confirmLabel: t('editor.composer.markdown.protection.disable'),
      cancelLabel: t('editor.composer.dialogs.cancel')
    });
    if (!disable) return;
    options.setMarkdownProtectionState(active, {
      ...currentProtection,
      enabled: false,
      password: '',
      passwordChanged: false
    });
    options.updateDynamicTabDirtyState(active);
    options.updateMarkdownProtectionButton(active);
    showToast('success', t('editor.composer.markdown.protection.disabledToast'));
  }

  async function openMarkdownPushOnGitHub(tab) {
    if (!tab || !tab.path) {
      showToast('info', t('editor.toasts.markdownOpenBeforePush'));
      return;
    }

    const { owner, name, branch } = options.getActiveSiteRepoConfig();
    if (!owner || !name) {
      showToast('info', t('editor.toasts.repoConfigMissing'));
      return;
    }

    const root = options.getContentRootSafe();
    const rel = options.normalizeRelPath(tab.path);
    if (!rel) {
      showToast('error', t('editor.toasts.invalidMarkdownPath'));
      return;
    }

    const popup = options.preparePopupWindow();

    try {
      if (tab.pending) {
        await tab.pending;
      } else if (!tab.loaded) {
        await options.loadDynamicTabContent(tab);
      }
    } catch (err) {
      options.closePopupWindow(popup);
      consoleRef.error('Failed to prepare markdown before pushing to GitHub', err);
      showToast('error', t('editor.toasts.unableLoadLatestMarkdown'));
      options.updateMarkdownPushButton(tab);
      return;
    }

    if (!tab.loaded) {
      options.closePopupWindow(popup);
      showToast('error', t('editor.toasts.markdownNotReady'));
      return;
    }

    const contentPath = `${root}/${rel}`.replace(/[\\]+/g, '/').replace(/^\/+/g, '');
    const encodedContentPath = options.encodeGitHubPath(contentPath);
    const folder = options.dirnameFromPath(rel);
    const fullFolder = [root, folder].filter(Boolean).join('/');
    const encodedFolder = options.encodeGitHubPath(fullFolder);
    const filename = options.basenameFromPath(rel) || 'main.md';

    const base = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
    const branchPart = encodeURIComponent(branch);
    const remoteState = tab.fileStatus && tab.fileStatus.state ? String(tab.fileStatus.state) : '';
    const isCreate = remoteState === 'missing';

    let href = '';
    if (isCreate) {
      href = encodedFolder
        ? `${base}/new/${branchPart}/${encodedFolder}?filename=${encodeURIComponent(filename)}`
        : `${base}/new/${branchPart}?filename=${encodeURIComponent(filename)}`;
    } else {
      href = encodedContentPath
        ? `${base}/edit/${branchPart}/${encodedContentPath}`
        : `${base}/edit/${branchPart}`;
    }

    if (!href) {
      options.closePopupWindow(popup);
      showToast('error', t('editor.toasts.unableResolveGithubFile'));
      return;
    }

    syncEditorValueToTab(tab);

    const plaintextContent = options.normalizeMarkdownContent(tab.content != null ? String(tab.content) : '');
    let preparedContent = '';
    try {
      const prepared = await options.prepareMarkdownForProtectedStorage(tab, plaintextContent, {
        reason: 'github-edit'
      });
      preparedContent = prepared.content;
    } catch (err) {
      options.closePopupWindow(popup);
      consoleRef.error('Failed to prepare protected markdown for GitHub edit', err);
      showToast('error', t('editor.composer.markdown.protection.prepareFailed'));
      options.updateMarkdownPushButton(tab);
      return;
    }

    try { options.nsCopyToClipboard(preparedContent); }
    catch (_) {}

    const expectedSignature = options.computeTextSignature(preparedContent);
    const successMessage = isCreate
      ? t('editor.composer.markdown.toastCopiedCreate')
      : t('editor.composer.markdown.toastCopiedUpdate');
    const blockedMessage = isCreate
      ? t('editor.composer.markdown.blockedCreate')
      : t('editor.composer.markdown.blockedUpdate');

    const startWatcher = () => {
      options.startMarkdownSyncWatcher(tab, {
        expectedSignature,
        isCreate,
        plaintextContent,
        label: filename || tab.path || t('editor.composer.markdown.fileFallback')
      });
    };

    const opened = options.finalizePopupWindow(popup, href);
    if (opened) {
      showToast('info', successMessage);
      startWatcher();
    } else {
      options.closePopupWindow(popup);
      options.handlePopupBlocked(href, {
        message: blockedMessage,
        actionLabel: t('editor.toasts.openGithubAction'),
        onRetry: () => {
          showToast('info', successMessage);
          startWatcher();
        }
      });
    }

    options.updateMarkdownPushButton(tab);
    options.updateMarkdownProtectionButton(tab);
  }

  async function discardMarkdownLocalChanges(tab, anchor) {
    const active = (tab && tab.path) ? tab : getActiveTab();
    if (!active || !active.path) {
      showToast('info', t('editor.toasts.markdownOpenBeforeDiscard'));
      options.updateMarkdownDiscardButton(null);
      options.updateMarkdownSaveButton(null);
      return;
    }

    const hasDraftContent = options.hasMarkdownDraftContent(active);
    const dirty = !!active.isDirty;
    if (!dirty && !hasDraftContent) {
      showToast('info', t('editor.toasts.noLocalMarkdownChanges'));
      options.updateMarkdownDiscardButton(active);
      options.updateMarkdownSaveButton(active);
      return;
    }

    const label = active.path || t('editor.composer.markdown.currentFile');
    const trigger = anchor && typeof anchor.closest === 'function' ? anchor.closest('button') : anchor;
    const control = trigger || options.getMarkdownDiscardButton();
    const promptMessage = t('editor.composer.discardConfirm.messageSimple', { label });

    let proceed = true;
    try {
      proceed = await options.showComposerDiscardConfirm(control, promptMessage, {
        confirmLabel: t('editor.composer.discardConfirm.discard'),
        cancelLabel: t('editor.composer.dialogs.cancel')
      });
    } catch (err) {
      consoleRef.warn('Markdown discard prompt failed, falling back to native confirm', err);
      proceed = confirmRef(promptMessage);
    }
    if (!proceed) return;

    const button = control || options.getMarkdownDiscardButton();
    const originalLabel = getButtonLabel(button) || options.getMarkdownDiscardLabel();
    setButtonBusyState(button, true, options.getMarkdownDiscardBusyLabel(), setButtonLabel);

    try {
      if (active.pending) {
        try { await active.pending; }
        catch (_) {}
      } else if (!active.loaded) {
        try { await options.loadDynamicTabContent(active); }
        catch (err) { consoleRef.warn('Discard: failed to refresh markdown before reset', err); }
      }

      try {
        if (active.markdownDraftTimer) {
          clearTimeoutRef(active.markdownDraftTimer);
          active.markdownDraftTimer = null;
        }
      } catch (_) {}

      const baseline = options.normalizeMarkdownContent(active.remoteContent != null ? active.remoteContent : '');
      const protection = options.getMarkdownProtectionState(active);
      options.setMarkdownProtectionState(active, options.createDiscardedMarkdownProtectionState(protection));
      active.content = baseline;
      options.clearMarkdownDraftForTab(active);
      active.isDirty = false;
      active.draftConflict = false;

      const editorApi = typeof options.getPrimaryEditorApi === 'function' ? options.getPrimaryEditorApi() : null;
      if (editorApi && getCurrentMode() === active.mode) {
        editorApi.setValue(baseline, { notify: true });
        try { editorApi.focus(); } catch (_) {}
      } else {
        options.updateDynamicTabDirtyState(active, { autoSave: false });
      }

      showToast('success', t('editor.toasts.discardSuccess', { label }));
    } catch (err) {
      consoleRef.error('Failed to discard markdown changes', err);
      showToast('error', t('editor.toasts.discardFailed'));
    } finally {
      setButtonBusyState(button, false, originalLabel || options.getMarkdownDiscardLabel(), setButtonLabel);
      options.updateMarkdownDiscardButton(active);
      options.updateMarkdownPushButton(active);
      options.updateMarkdownSaveButton(active);
    }
  }

  return {
    manualSaveActiveMarkdown,
    handleMarkdownProtectionButton,
    openMarkdownPushOnGitHub,
    discardMarkdownLocalChanges
  };
}
