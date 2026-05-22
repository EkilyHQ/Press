import assert from 'node:assert/strict';

import {
  bumpMarkdownDraftSaveGeneration,
  computeTextSignature,
  createDiscardedMarkdownProtectionState,
  createMarkdownProtectionState,
  getLockedEncryptedMarkdownDraft,
  getMarkdownDraftSaveGeneration,
  getMarkdownProtectionState,
  hasMarkdownDraftContent,
  isEncryptedMarkdownDraftEntry,
  isMarkdownTabProtected,
  normalizeMarkdownContent,
  setMarkdownProtectionState
} from '../assets/js/composer-markdown-state.js';

assert.equal(normalizeMarkdownContent('a\r\nb'), 'a\nb', 'Markdown state should reuse draft normalization');
assert.equal(
  computeTextSignature('a\r\nb'),
  computeTextSignature('a\nb'),
  'text signatures should be computed over normalized Markdown'
);
assert.notEqual(
  computeTextSignature('a\nb'),
  computeTextSignature('a\nb\n'),
  'text signatures should change when normalized content changes'
);

const normalizedProtection = createMarkdownProtectionState({
  enabled: 1,
  password: 1234,
  encryptedRemote: 'yes',
  encryptedDraft: 'yes',
  passwordChanged: 'yes',
  remoteSignature: 9876,
  remoteCiphertext: 'cipher'
});
assert.deepEqual(normalizedProtection, {
  enabled: true,
  password: '1234',
  encryptedRemote: true,
  encryptedDraft: true,
  passwordChanged: true,
  remoteSignature: '9876',
  remoteCiphertext: 'cipher'
});

const tab = {};
assert.deepEqual(
  getMarkdownProtectionState(tab),
  createMarkdownProtectionState(),
  'missing tab protection should be initialized'
);
assert.equal(tab.protection.enabled, false, 'initialized protection should be written back to the tab');

const nextProtection = setMarkdownProtectionState(tab, { enabled: true, password: 'secret' });
assert.equal(nextProtection.enabled, true);
assert.equal(nextProtection.password, 'secret');
assert.equal(isMarkdownTabProtected(tab), true);

assert.deepEqual(
  createDiscardedMarkdownProtectionState({
    enabled: true,
    password: 'discard-me',
    encryptedRemote: true,
    encryptedDraft: true,
    passwordChanged: true,
    remoteSignature: '9:f00',
    remoteCiphertext: 'ciphertext'
  }),
  {
    enabled: true,
    password: '',
    encryptedRemote: true,
    encryptedDraft: false,
    passwordChanged: false,
    remoteSignature: '9:f00',
    remoteCiphertext: 'ciphertext'
  },
  'discarding a protected edit should preserve the remote encrypted baseline but clear local credentials'
);
assert.deepEqual(
  createDiscardedMarkdownProtectionState({ enabled: true, password: 'local-only' }),
  createMarkdownProtectionState(),
  'discarding local-only protection should clear protection state'
);

assert.equal(isEncryptedMarkdownDraftEntry({ encrypted: true }), true);
assert.equal(isEncryptedMarkdownDraftEntry({ protected: true }), true);
assert.equal(isEncryptedMarkdownDraftEntry({ encrypted: false, protected: false }), false);

assert.equal(hasMarkdownDraftContent({ localDraft: { content: '' } }), false);
assert.equal(hasMarkdownDraftContent({ localDraft: { encryptedContent: 'cipher' } }), true);
assert.equal(hasMarkdownDraftContent({ localDraft: { deletedAssets: ['assets/a.png'] } }), true);

assert.equal(
  getLockedEncryptedMarkdownDraft({ localDraft: { encrypted: true, decrypted: false, encryptedContent: 'cipher\r\n' } }),
  'cipher\n',
  'locked encrypted drafts should return normalized ciphertext'
);
assert.equal(
  getLockedEncryptedMarkdownDraft({ localDraft: { encrypted: true, decrypted: true, encryptedContent: 'cipher' } }),
  '',
  'decrypted drafts should not be treated as locked ciphertext'
);

const saveTab = { markdownDraftSaveGeneration: 2.6 };
assert.equal(getMarkdownDraftSaveGeneration(saveTab), 2);
assert.equal(bumpMarkdownDraftSaveGeneration(saveTab), 3);
assert.equal(getMarkdownDraftSaveGeneration(saveTab), 3);
assert.equal(bumpMarkdownDraftSaveGeneration(null), 0);
