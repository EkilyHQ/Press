import assert from 'node:assert/strict';
import { createComposerMarkdownActionsUi } from '../assets/js/composer-markdown-actions-ui.js';

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
    },
    toggle(name, force) {
      const key = String(name);
      const shouldAdd = force === undefined ? !classes.has(key) : !!force;
      if (shouldAdd) classes.add(key);
      else classes.delete(key);
      return shouldAdd;
    }
  };
}

function makeButton(options = {}) {
  const attrs = new Map();
  const label = options.label === false ? null : { textContent: '' };
  const button = {
    attrs,
    dataset: {},
    classList: makeClassList(),
    hidden: false,
    disabled: false,
    checked: false,
    title: '',
    textContent: '',
    label,
    setAttribute(name, value) {
      attrs.set(String(name), String(value));
    },
    removeAttribute(name) {
      attrs.delete(String(name));
      if (name === 'title') this.title = '';
    },
    querySelector(selector) {
      return selector === '.btn-label' ? label : null;
    },
    closest(selector) {
      return selector === '.frontmatter-switch' ? (options.switchEl || null) : null;
    }
  };
  return button;
}

function makeDocument(buttons) {
  return {
    getElementById(id) {
      return buttons[id] || null;
    }
  };
}

function translate(key) {
  return `T:${key}`;
}

{
  const pushButton = makeButton();
  const ui = createComposerMarkdownActionsUi({
    documentRef: makeDocument({ btnPushMarkdown: pushButton }),
    translate,
    getCurrentMode: () => 'editor-tab-1',
    getActiveDynamicTab: () => ({ mode: 'editor-tab-1', path: 'post/doc.md', loaded: true, isDirty: false }),
    getActiveSiteRepoConfig: () => ({ owner: 'EkilyHQ', name: 'Press' }),
    hasMarkdownDraftContent: () => false
  });

  ui.updatePushButton();

  assert.equal(pushButton.hidden, true);
  assert.equal(pushButton.disabled, true);
  assert.equal(pushButton.attrs.get('aria-hidden'), 'true');
  assert.equal(pushButton.attrs.get('aria-disabled'), 'true');
  assert.equal(pushButton.attrs.has('data-state'), false);
}

{
  const pushButton = makeButton();
  const tab = {
    mode: 'editor-tab-1',
    path: 'post/new.md',
    loaded: true,
    isDirty: true,
    fileStatus: { state: 'missing' }
  };
  const ui = createComposerMarkdownActionsUi({
    documentRef: makeDocument({ btnPushMarkdown: pushButton }),
    translate,
    getCurrentMode: () => 'editor-tab-1',
    getActiveDynamicTab: () => tab,
    getActiveSiteRepoConfig: () => ({ owner: '', name: '' }),
    hasMarkdownDraftContent: () => false
  });

  ui.updatePushButton(tab);

  assert.equal(pushButton.hidden, false);
  assert.equal(pushButton.disabled, true);
  assert.equal(pushButton.label.textContent, 'T:editor.composer.markdown.push.labelCreate');
  assert.equal(pushButton.title, 'T:editor.composer.markdown.push.tooltips.noRepo');
  assert.equal(pushButton.attrs.get('aria-label'), 'T:editor.composer.markdown.push.tooltips.noRepo');
  assert.equal(pushButton.attrs.get('data-state'), 'missing');
}

{
  const saveButton = makeButton();
  const tab = { mode: 'editor-tab-1', path: 'post/doc.md', content: 'body', isDirty: false };
  const ui = createComposerMarkdownActionsUi({
    documentRef: makeDocument({ btnSaveMarkdown: saveButton }),
    translate,
    getCurrentMode: () => 'editor-tab-1',
    getActiveDynamicTab: () => tab,
    getManualMarkdownSaveState: () => ({ canSave: false, reason: 'clean' })
  });

  ui.updateSaveButton(tab);

  assert.equal(saveButton.disabled, false);
  assert.equal(saveButton.label.textContent, 'T:editor.composer.markdown.save.label');
  assert.equal(saveButton.title, 'T:editor.composer.markdown.save.tooltips.clean');
}

{
  const discardButton = makeButton();
  const tab = {
    mode: 'editor-tab-1',
    path: 'post/doc.md',
    loaded: false,
    pending: null,
    isDirty: true
  };
  const ui = createComposerMarkdownActionsUi({
    documentRef: makeDocument({ btnDiscardMarkdown: discardButton }),
    translate,
    getCurrentMode: () => 'editor-tab-1',
    getActiveDynamicTab: () => tab,
    hasMarkdownDraftContent: () => false
  });

  ui.updateDiscardButton(tab);

  assert.equal(discardButton.disabled, false);
  assert.equal(discardButton.label.textContent, 'T:editor.composer.markdown.discard.label');
  assert.equal(discardButton.title, 'T:editor.composer.markdown.discard.tooltips.reload');
}

{
  const switchEl = makeButton();
  const protectionButton = makeButton({ switchEl });
  const tab = { mode: 'editor-tab-1', path: 'post/protected.md' };
  const ui = createComposerMarkdownActionsUi({
    documentRef: makeDocument({ btnProtectMarkdown: protectionButton }),
    translate,
    getCurrentMode: () => 'editor-tab-1',
    getActiveDynamicTab: () => tab,
    isMarkdownTabProtected: () => true
  });

  ui.updateProtectionButton(tab);

  assert.equal(protectionButton.disabled, false);
  assert.equal(protectionButton.checked, true);
  assert.equal(protectionButton.attrs.get('aria-checked'), 'true');
  assert.equal(protectionButton.attrs.get('data-protected'), 'true');
  assert.equal(protectionButton.dataset.state, 'on');
  assert.equal(protectionButton.classList.contains('is-protected'), true);
  assert.equal(switchEl.dataset.state, 'on');
  assert.equal(switchEl.classList.contains('is-protected'), true);
  assert.equal(switchEl.classList.contains('is-disabled'), false);
  assert.equal(switchEl.label.textContent, 'T:editor.composer.markdown.protection.labelProtected');
}

console.log('ok - composer markdown actions UI');
