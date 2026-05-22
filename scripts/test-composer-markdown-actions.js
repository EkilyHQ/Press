import assert from 'node:assert/strict';
import { createComposerMarkdownActionsController } from '../assets/js/composer-markdown-actions.js';

function makeClassList() {
  const classes = new Set();
  return {
    classes,
    add(name) {
      classes.add(String(name));
    },
    remove(name) {
      classes.delete(String(name));
    },
    contains(name) {
      return classes.has(String(name));
    }
  };
}

function makeButton(label = 'Initial') {
  const attrs = new Map();
  return {
    attrs,
    classList: makeClassList(),
    disabled: false,
    label,
    setAttribute(name, value) {
      attrs.set(String(name), String(value));
    },
    removeAttribute(name) {
      attrs.delete(String(name));
    },
    closest(selector) {
      return selector === 'button' ? this : null;
    }
  };
}

function makeBaseOptions(overrides = {}) {
  const calls = [];
  const translate = (key, data) => (data && data.label ? `${key}:${data.label}` : key);
  const saveButton = makeButton('Save');
  const discardButton = makeButton('Discard');
  return {
    calls,
    windowRef: {
      confirm() {
        calls.push(['confirm']);
        return true;
      }
    },
    t: translate,
    getCurrentMode: () => 'markdown-1',
    getActiveDynamicTab: () => null,
    getActiveSiteRepoConfig: () => ({ owner: 'EkilyHQ', name: 'Press', branch: 'main' }),
    getContentRootSafe: () => 'wwwroot',
    normalizeRelPath: (value) => String(value || '').replace(/^\/+/, ''),
    dirnameFromPath: (value) => {
      const text = String(value || '');
      const index = text.lastIndexOf('/');
      return index >= 0 ? text.slice(0, index) : '';
    },
    basenameFromPath: (value) => {
      const text = String(value || '');
      const index = text.lastIndexOf('/');
      return index >= 0 ? text.slice(index + 1) : text;
    },
    encodeGitHubPath: (value) => String(value || ''),
    getPrimaryEditorApi: () => null,
    loadDynamicTabContent: async (tab) => {
      calls.push(['load', tab.path]);
      tab.loaded = true;
    },
    getManualMarkdownSaveState: (content, isDirty) => ({ canSave: !!content && !!isDirty, reason: isDirty ? 'default' : 'clean' }),
    getMarkdownSaveTooltip: (kind) => `save:${kind}`,
    updateMarkdownSaveButton: (tab) => calls.push(['update-save', tab && tab.path]),
    getMarkdownSaveButton: () => saveButton,
    getButtonLabel: (button) => button && button.label,
    getMarkdownSaveLabel: () => 'Save',
    getMarkdownSaveBusyLabel: () => 'Saving',
    setButtonLabel: (button, text) => {
      button.label = text;
      calls.push(['label', text]);
    },
    saveMarkdownDraftForTab: async (tab, options) => {
      calls.push(['save-draft', tab.path, options && options.markManual]);
      return { path: tab.path };
    },
    pushEditorCurrentFileInfo: (tab) => calls.push(['push-info', tab.path]),
    showToast: (kind, message) => calls.push(['toast', kind, message]),
    updateMarkdownDiscardButton: (tab) => calls.push(['update-discard', tab && tab.path]),
    updateMarkdownPushButton: (tab) => calls.push(['update-push', tab && tab.path]),
    updateMarkdownProtectionButton: (tab) => calls.push(['update-protection', tab && tab.path]),
    updateUnsyncedSummary: () => calls.push(['update-unsynced']),
    requestMarkdownProtectionPassword: async () => 'pw',
    getMarkdownProtectionState: (tab) => tab.protection || { enabled: false },
    setMarkdownProtectionState: (tab, state) => {
      tab.protection = state;
      calls.push(['set-protection', state.enabled, state.passwordChanged]);
    },
    updateDynamicTabDirtyState: (tab, options) => calls.push(['dirty-state', tab.path, options && options.autoSave]),
    showComposerDiscardConfirm: async () => true,
    preparePopupWindow: () => ({ popup: true }),
    closePopupWindow: () => calls.push(['close-popup']),
    finalizePopupWindow: (_popup, href) => {
      calls.push(['open-popup', href]);
      return true;
    },
    handlePopupBlocked: (href) => calls.push(['blocked', href]),
    computeTextSignature: (text) => `sig:${text.length}`,
    startMarkdownSyncWatcher: (tab, payload) => calls.push(['watch', tab.path, payload.expectedSignature, payload.isCreate]),
    prepareMarkdownForProtectedStorage: async (_tab, text) => ({ content: `prepared:${text}` }),
    nsCopyToClipboard: (text) => calls.push(['copy', text]),
    normalizeMarkdownContent: (text) => String(text || '').replace(/\r\n/g, '\n'),
    createDiscardedMarkdownProtectionState: () => ({ enabled: false }),
    hasMarkdownDraftContent: (tab) => !!(tab.localDraft && tab.localDraft.content),
    clearMarkdownDraftForTab: (tab) => {
      tab.localDraft = null;
      calls.push(['clear-draft', tab.path]);
    },
    getMarkdownDiscardButton: () => discardButton,
    getMarkdownDiscardLabel: () => 'Discard',
    getMarkdownDiscardBusyLabel: () => 'Discarding',
    ...overrides
  };
}

{
  const tab = {
    mode: 'markdown-1',
    path: 'post/doc.md',
    content: 'Body',
    isDirty: true,
    markdownDraftTimer: setTimeout(() => {}, 1000)
  };
  const options = makeBaseOptions({ getActiveDynamicTab: () => tab });
  const controller = createComposerMarkdownActionsController(options);

  await controller.manualSaveActiveMarkdown();

  assert.equal(tab.markdownDraftTimer, null);
  assert.equal(options.getMarkdownSaveButton().disabled, false);
  assert.equal(options.getMarkdownSaveButton().label, 'Save');
  assert(options.calls.some(call => call[0] === 'save-draft' && call[1] === 'post/doc.md' && call[2] === true));
  assert(options.calls.some(call => call[0] === 'push-info' && call[1] === 'post/doc.md'));
  assert(options.calls.some(call => call[0] === 'toast' && call[1] === 'success'));
}

{
  const tab = {
    mode: 'markdown-1',
    path: 'post/new.md',
    content: 'Draft',
    loaded: true,
    fileStatus: { state: 'missing' }
  };
  const options = makeBaseOptions({
    getPrimaryEditorApi: () => ({
      getValue: () => 'Editor Draft'
    })
  });
  const controller = createComposerMarkdownActionsController(options);

  await controller.openMarkdownPushOnGitHub(tab);

  assert.equal(tab.content, 'Editor Draft');
  assert(options.calls.some(call => call[0] === 'copy' && call[1] === 'prepared:Editor Draft'));
  assert(options.calls.some(call => call[0] === 'open-popup' && call[1].includes('/new/main/wwwroot/post?filename=new.md')));
  assert(options.calls.some(call => call[0] === 'watch' && call[1] === 'post/new.md' && call[2] === 'sig:21' && call[3] === true));
}

{
  const tab = {
    mode: 'markdown-1',
    path: 'post/doc.md',
    content: 'Existing',
    loaded: true,
    fileStatus: { state: 'tracked' }
  };
  const options = makeBaseOptions();
  const controller = createComposerMarkdownActionsController(options);

  await controller.openMarkdownPushOnGitHub(tab);

  assert(options.calls.some(call => call[0] === 'open-popup' && call[1].endsWith('/edit/main/wwwroot/post/doc.md')));
  assert(options.calls.some(call => call[0] === 'watch' && call[1] === 'post/doc.md' && call[3] === false));
}

{
  const tab = {
    mode: 'markdown-1',
    path: 'post/blocked.md',
    content: 'Blocked',
    loaded: true,
    fileStatus: { state: 'tracked' }
  };
  const options = makeBaseOptions({
    finalizePopupWindow: (_popup, href) => {
      options.calls.push(['open-popup', href]);
      return false;
    },
    handlePopupBlocked: (href, payload) => {
      options.calls.push(['blocked', href, payload && payload.actionLabel]);
      if (payload && typeof payload.onRetry === 'function') payload.onRetry();
    }
  });
  const controller = createComposerMarkdownActionsController(options);

  await controller.openMarkdownPushOnGitHub(tab);

  assert(options.calls.some(call => call[0] === 'close-popup'));
  assert(options.calls.some(call => call[0] === 'blocked' && call[1].endsWith('/edit/main/wwwroot/post/blocked.md')));
  assert(options.calls.some(call => call[0] === 'watch' && call[1] === 'post/blocked.md'));
}

{
  const tab = {
    mode: 'markdown-1',
    path: 'post/fail.md',
    content: 'Secret',
    loaded: true
  };
  const options = makeBaseOptions({
    prepareMarkdownForProtectedStorage: async () => {
      throw new Error('cannot encrypt');
    }
  });
  const controller = createComposerMarkdownActionsController(options);

  const originalConsoleError = console.error;
  const capturedErrors = [];
  console.error = (...args) => {
    capturedErrors.push(args);
  };
  try {
    await controller.openMarkdownPushOnGitHub(tab);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(capturedErrors.length, 1);
  assert(options.calls.some(call => call[0] === 'close-popup'));
  assert(options.calls.some(call => call[0] === 'toast' && call[1] === 'error' && call[2] === 'editor.composer.markdown.protection.prepareFailed'));
  assert(options.calls.some(call => call[0] === 'update-push' && call[1] === 'post/fail.md'));
  assert(!options.calls.some(call => call[0] === 'copy'));
}

{
  const editorEvents = [];
  const tab = {
    mode: 'markdown-1',
    path: 'post/doc.md',
    content: 'Changed',
    remoteContent: 'Remote',
    loaded: true,
    isDirty: true,
    draftConflict: true,
    localDraft: { content: 'Changed' },
    protection: { enabled: true }
  };
  const options = makeBaseOptions({
    getActiveDynamicTab: () => tab,
    getPrimaryEditorApi: () => ({
      setValue(value, opts) {
        editorEvents.push(['setValue', value, opts && opts.notify]);
      },
      focus() {
        editorEvents.push(['focus']);
      }
    })
  });
  const controller = createComposerMarkdownActionsController(options);

  await controller.discardMarkdownLocalChanges();

  assert.equal(tab.content, 'Remote');
  assert.equal(tab.isDirty, false);
  assert.equal(tab.draftConflict, false);
  assert.equal(tab.localDraft, null);
  assert.deepEqual(editorEvents[0], ['setValue', 'Remote', true]);
  assert(options.calls.some(call => call[0] === 'toast' && call[1] === 'success'));
}

{
  const tab = {
    mode: 'markdown-1',
    path: 'post/secure.md',
    content: 'Secret',
    loaded: true,
    protection: { enabled: false }
  };
  const options = makeBaseOptions({ getActiveDynamicTab: () => tab });
  const controller = createComposerMarkdownActionsController(options);

  await controller.handleMarkdownProtectionButton();

  assert.equal(tab.protection.enabled, true);
  assert.equal(tab.protection.password, 'pw');
  assert.equal(tab.protection.passwordChanged, true);
  assert(options.calls.some(call => call[0] === 'dirty-state' && call[1] === 'post/secure.md'));
  assert(options.calls.some(call => call[0] === 'toast' && call[1] === 'success'));
}

{
  const tab = {
    mode: 'markdown-1',
    path: 'post/change-password.md',
    content: 'Secret',
    loaded: true,
    protection: { enabled: true, password: 'old', encryptedRemote: true }
  };
  const options = makeBaseOptions({ getActiveDynamicTab: () => tab });
  const controller = createComposerMarkdownActionsController(options);

  await controller.handleMarkdownProtectionButton();

  assert.equal(tab.protection.enabled, true);
  assert.equal(tab.protection.password, 'pw');
  assert.equal(tab.protection.passwordChanged, true);
  assert(options.calls.some(call => call[0] === 'dirty-state' && call[1] === 'post/change-password.md'));
  assert(options.calls.some(call => call[0] === 'toast' && call[1] === 'success' && call[2] === 'editor.composer.markdown.protection.passwordChangedToast'));
}

{
  const tab = {
    mode: 'markdown-1',
    path: 'post/disable.md',
    content: 'Secret',
    loaded: true,
    protection: { enabled: true, password: 'old', encryptedRemote: true, passwordChanged: true }
  };
  let confirmCount = 0;
  const options = makeBaseOptions({
    getActiveDynamicTab: () => tab,
    showComposerDiscardConfirm: async () => {
      confirmCount += 1;
      return confirmCount === 2;
    }
  });
  const controller = createComposerMarkdownActionsController(options);

  await controller.handleMarkdownProtectionButton();

  assert.equal(confirmCount, 2);
  assert.equal(tab.protection.enabled, false);
  assert.equal(tab.protection.password, '');
  assert.equal(tab.protection.passwordChanged, false);
  assert(options.calls.some(call => call[0] === 'dirty-state' && call[1] === 'post/disable.md'));
  assert(options.calls.some(call => call[0] === 'toast' && call[1] === 'success' && call[2] === 'editor.composer.markdown.protection.disabledToast'));
}

console.log('composer Markdown actions controller tests passed');
