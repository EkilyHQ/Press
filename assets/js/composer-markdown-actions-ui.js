import { EDITOR_SHELL_IDS } from './editor-shell-contract.js';

const MARKDOWN_PUSH_LABEL_KEYS = {
  default: 'editor.composer.markdown.push.labelDefault',
  create: 'editor.composer.markdown.push.labelCreate',
  update: 'editor.composer.markdown.push.labelUpdate'
};

const MARKDOWN_PUSH_TOOLTIP_KEYS = {
  default: 'editor.composer.markdown.push.tooltips.default',
  noRepo: 'editor.composer.markdown.push.tooltips.noRepo',
  noFile: 'editor.composer.markdown.push.tooltips.noFile',
  error: 'editor.composer.markdown.push.tooltips.error',
  checking: 'editor.composer.markdown.push.tooltips.checking',
  loading: 'editor.composer.markdown.push.tooltips.loading',
  create: 'editor.composer.markdown.push.tooltips.create',
  update: 'editor.composer.markdown.push.tooltips.update'
};

const MARKDOWN_DISCARD_LABEL_KEY = 'editor.composer.markdown.discard.label';
const MARKDOWN_DISCARD_BUSY_KEY = 'editor.composer.markdown.discard.busy';

const MARKDOWN_DISCARD_TOOLTIP_KEYS = {
  default: 'editor.composer.markdown.discard.tooltips.default',
  noFile: 'editor.composer.markdown.discard.tooltips.noFile',
  reload: 'editor.composer.markdown.discard.tooltips.reload'
};

const MARKDOWN_SAVE_LABEL_KEY = 'editor.composer.markdown.save.label';
const MARKDOWN_SAVE_BUSY_KEY = 'editor.composer.markdown.save.busy';

const MARKDOWN_SAVE_TOOLTIP_KEYS = {
  default: 'editor.composer.markdown.save.tooltips.default',
  noFile: 'editor.composer.markdown.save.tooltips.noFile',
  empty: 'editor.composer.markdown.save.tooltips.empty',
  clean: 'editor.composer.markdown.save.tooltips.clean'
};

function defaultSetButtonLabel(btn, label) {
  if (!btn) return;
  const span = btn.querySelector ? btn.querySelector('.btn-label') : null;
  if (span) span.textContent = String(label || '');
  else btn.textContent = String(label || '');
}

export function createComposerMarkdownActionsUi(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const documentRef = opts.documentRef || null;
  const t = typeof opts.translate === 'function' ? opts.translate : (key) => String(key || '');
  const getCurrentMode = typeof opts.getCurrentMode === 'function' ? opts.getCurrentMode : () => null;
  const getActiveDynamicTab = typeof opts.getActiveDynamicTab === 'function' ? opts.getActiveDynamicTab : () => null;
  const getActiveSiteRepoConfig = typeof opts.getActiveSiteRepoConfig === 'function'
    ? opts.getActiveSiteRepoConfig
    : () => ({ owner: '', name: '' });
  const hasMarkdownDraftContent = typeof opts.hasMarkdownDraftContent === 'function' ? opts.hasMarkdownDraftContent : () => false;
  const getManualMarkdownSaveState = typeof opts.getManualMarkdownSaveState === 'function'
    ? opts.getManualMarkdownSaveState
    : () => ({ canSave: false, reason: 'clean' });
  const isMarkdownTabProtected = typeof opts.isMarkdownTabProtected === 'function' ? opts.isMarkdownTabProtected : () => false;
  const setButtonLabel = typeof opts.setButtonLabel === 'function' ? opts.setButtonLabel : defaultSetButtonLabel;

  let pushButton = null;
  let discardButton = null;
  let saveButton = null;
  let protectionButton = null;

  const queryButton = (id) => {
    if (!documentRef || typeof documentRef.getElementById !== 'function') return null;
    return documentRef.getElementById(id);
  };

  const getPushLabel = (kind) => {
    const key = MARKDOWN_PUSH_LABEL_KEYS[kind] || MARKDOWN_PUSH_LABEL_KEYS.default;
    return t(key);
  };
  const getPushTooltip = (kind) => {
    const key = MARKDOWN_PUSH_TOOLTIP_KEYS[kind] || MARKDOWN_PUSH_TOOLTIP_KEYS.default;
    return t(key);
  };
  const getDiscardLabel = () => t(MARKDOWN_DISCARD_LABEL_KEY);
  const getDiscardBusyLabel = () => t(MARKDOWN_DISCARD_BUSY_KEY);
  const getDiscardTooltip = (kind) => {
    const key = MARKDOWN_DISCARD_TOOLTIP_KEYS[kind] || MARKDOWN_DISCARD_TOOLTIP_KEYS.default;
    return t(key);
  };
  const getSaveLabel = () => t(MARKDOWN_SAVE_LABEL_KEY);
  const getSaveBusyLabel = () => t(MARKDOWN_SAVE_BUSY_KEY);
  const getSaveTooltip = (kind) => {
    const key = MARKDOWN_SAVE_TOOLTIP_KEYS[kind] || MARKDOWN_SAVE_TOOLTIP_KEYS.default;
    return t(key);
  };
  const getProtectionLabel = (tab) => isMarkdownTabProtected(tab)
    ? t('editor.composer.markdown.protection.labelProtected')
    : t('editor.composer.markdown.protection.labelUnprotected');
  const getProtectionTooltip = (tab) => isMarkdownTabProtected(tab)
    ? t('editor.composer.markdown.protection.tooltipProtected')
    : t('editor.composer.markdown.protection.tooltipUnprotected');

  const resolveActiveTab = (tab) => (tab && tab.mode && tab.mode === getCurrentMode())
    ? tab
    : getActiveDynamicTab();

  function updatePushButton(tab) {
    if (!pushButton) pushButton = queryButton(EDITOR_SHELL_IDS.btnPushMarkdown);
    if (!pushButton) return;

    const btn = pushButton;
    const repo = getActiveSiteRepoConfig() || {};
    const hasRepo = !!(repo.owner && repo.name);

    const active = resolveActiveTab(tab);
    const hasDraftContent = hasMarkdownDraftContent(active);
    const hasDirty = !!(active && active.isDirty);
    const hasLocalChanges = !!(active && active.path && (hasDirty || hasDraftContent));

    if (!hasLocalChanges) {
      try { btn.classList.remove('is-busy'); } catch (_) {}
      btn.hidden = true;
      btn.setAttribute('aria-hidden', 'true');
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.removeAttribute('aria-busy');
      btn.removeAttribute('data-state');
      btn.removeAttribute('title');
      return;
    }

    btn.hidden = false;
    btn.removeAttribute('aria-hidden');
    btn.removeAttribute('aria-busy');

    const state = active && active.fileStatus && active.fileStatus.state
      ? String(active.fileStatus.state)
      : '';

    let label = getPushLabel('default');
    if (state === 'missing') label = getPushLabel('create');
    else if (state) label = getPushLabel('update');
    else if (active && active.path) label = getPushLabel('update');

    let disabled = false;
    let tooltip = '';

    if (!hasRepo) {
      disabled = true;
      tooltip = getPushTooltip('noRepo');
    } else if (!active || !active.path) {
      disabled = true;
      tooltip = getPushTooltip('noFile');
    } else if (state === 'error') {
      disabled = true;
      tooltip = getPushTooltip('error');
    } else if (!active.loaded) {
      tooltip = active.pending
        ? getPushTooltip('checking')
        : getPushTooltip('loading');
    } else {
      tooltip = state === 'missing'
        ? getPushTooltip('create')
        : getPushTooltip('update');
    }

    const busy = btn.classList.contains('is-busy');
    if (busy) disabled = true;

    btn.disabled = disabled;
    btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (!busy && label) setButtonLabel(btn, label);
    if (tooltip) btn.title = tooltip;
    else btn.removeAttribute('title');
    btn.setAttribute('aria-label', tooltip || label);

    if (state) btn.setAttribute('data-state', state);
    else btn.removeAttribute('data-state');
  }

  function updateDiscardButton(tab) {
    if (!discardButton) discardButton = queryButton(EDITOR_SHELL_IDS.btnDiscardMarkdown);
    if (!discardButton) return;

    const btn = discardButton;
    const active = resolveActiveTab(tab);
    const hasBusy = btn.classList.contains('is-busy');

    const hasDraftContent = hasMarkdownDraftContent(active);
    const dirty = !!(active && active.isDirty);
    const hasLocalChanges = !!(active && active.path && active.mode === getCurrentMode() && (dirty || hasDraftContent));

    if (!hasLocalChanges) {
      if (!hasBusy) setButtonLabel(btn, getDiscardLabel());
      try { btn.classList.remove('is-busy'); } catch (_) {}
      btn.hidden = false;
      btn.removeAttribute('aria-hidden');
      btn.disabled = true;
      btn.setAttribute('aria-disabled', 'true');
      btn.removeAttribute('aria-busy');
      const tooltip = active && active.path
        ? t('editor.toasts.noLocalMarkdownChanges')
        : getDiscardTooltip('noFile');
      if (tooltip) btn.title = tooltip;
      else btn.removeAttribute('title');
      btn.setAttribute('aria-label', tooltip || getDiscardLabel());
      return;
    }

    btn.hidden = false;
    btn.removeAttribute('aria-hidden');
    btn.removeAttribute('aria-busy');

    let disabled = false;
    let tooltip = getDiscardTooltip('default');

    if (!active || !active.path) {
      disabled = true;
      tooltip = getDiscardTooltip('noFile');
    } else if (!active.loaded && !active.pending) {
      tooltip = getDiscardTooltip('reload');
    }

    if (hasBusy) disabled = true;

    btn.disabled = disabled;
    btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (!hasBusy) setButtonLabel(btn, getDiscardLabel());
    if (tooltip) btn.title = tooltip;
    else btn.removeAttribute('title');
    btn.setAttribute('aria-label', tooltip || getDiscardLabel());
  }

  function updateSaveButton(tab) {
    if (!saveButton) saveButton = queryButton(EDITOR_SHELL_IDS.btnSaveMarkdown);
    if (!saveButton) return;

    const btn = saveButton;
    const active = resolveActiveTab(tab);
    const hasBusy = btn.classList.contains('is-busy');

    const hasActive = !!(active && active.path && active.mode === getCurrentMode());
    const saveState = hasActive
      ? getManualMarkdownSaveState(active.content, active.isDirty)
      : null;

    let disabled = false;
    let tooltip = getSaveTooltip('default');

    if (!hasActive) {
      tooltip = getSaveTooltip('noFile');
    } else if (!saveState.canSave) {
      tooltip = getSaveTooltip(saveState.reason);
    }

    if (hasBusy) disabled = true;

    btn.hidden = false;
    btn.removeAttribute('aria-hidden');
    btn.disabled = disabled;
    btn.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (!hasBusy) setButtonLabel(btn, getSaveLabel());
    if (tooltip) btn.title = tooltip;
    else btn.removeAttribute('title');
    btn.setAttribute('aria-label', tooltip || getSaveLabel());
  }

  function updateProtectionButton(tab) {
    if (!protectionButton) protectionButton = queryButton(EDITOR_SHELL_IDS.btnProtectMarkdown);
    if (!protectionButton) return;

    const btn = protectionButton;
    const active = resolveActiveTab(tab);
    const hasActive = !!(active && active.path && active.mode === getCurrentMode());
    const protectedState = hasActive && isMarkdownTabProtected(active);
    const label = hasActive
      ? getProtectionLabel(active)
      : t('editor.composer.markdown.protection.label');
    const tooltip = hasActive
      ? getProtectionTooltip(active)
      : t('editor.composer.markdown.protection.tooltipNoFile');
    const switchEl = btn.closest ? btn.closest('.frontmatter-switch') : null;

    btn.hidden = false;
    btn.removeAttribute('aria-hidden');
    btn.disabled = !hasActive;
    if ('checked' in btn) btn.checked = protectedState;
    btn.setAttribute('aria-disabled', hasActive ? 'false' : 'true');
    btn.setAttribute('aria-checked', protectedState ? 'true' : 'false');
    btn.setAttribute('data-protected', protectedState ? 'true' : 'false');
    btn.dataset.state = protectedState ? 'on' : 'off';
    btn.classList.toggle('is-protected', protectedState);
    if (switchEl) {
      switchEl.dataset.state = protectedState ? 'on' : 'off';
      switchEl.classList.toggle('is-protected', protectedState);
      switchEl.classList.toggle('is-disabled', !hasActive);
      if (tooltip) switchEl.title = tooltip;
      else switchEl.removeAttribute('title');
    }
    setButtonLabel(switchEl || btn, label);
    if (tooltip) btn.title = tooltip;
    else btn.removeAttribute('title');
    btn.setAttribute('aria-label', tooltip || label);
  }

  return {
    setPushButton: (button) => { pushButton = button || null; },
    setDiscardButton: (button) => { discardButton = button || null; },
    setSaveButton: (button) => { saveButton = button || null; },
    setProtectionButton: (button) => { protectionButton = button || null; },
    getPushButton: () => pushButton,
    getDiscardButton: () => discardButton,
    getSaveButton: () => saveButton,
    getProtectionButton: () => protectionButton,
    getPushLabel,
    getPushTooltip,
    getDiscardLabel,
    getDiscardBusyLabel,
    getDiscardTooltip,
    getSaveLabel,
    getSaveBusyLabel,
    getSaveTooltip,
    getProtectionLabel,
    getProtectionTooltip,
    updatePushButton,
    updateDiscardButton,
    updateSaveButton,
    updateProtectionButton
  };
}
