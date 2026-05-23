import { normalizeMarkdownDraftContent } from './composer-markdown-save.js?v=press-system-v3.4.49';

export function normalizeMarkdownContent(text) {
  return normalizeMarkdownDraftContent(text);
}

export function computeTextSignature(text) {
  const normalized = normalizeMarkdownContent(text || '');
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 131 + normalized.charCodeAt(i)) >>> 0;
  }
  return `${normalized.length}:${hash.toString(16)}`;
}

export function createMarkdownProtectionState(overrides = {}) {
  const source = overrides && typeof overrides === 'object' ? overrides : {};
  return {
    enabled: !!source.enabled,
    password: source.password ? String(source.password) : '',
    encryptedRemote: !!source.encryptedRemote,
    encryptedDraft: !!source.encryptedDraft,
    passwordChanged: !!source.passwordChanged,
    remoteSignature: source.remoteSignature ? String(source.remoteSignature) : '',
    remoteCiphertext: source.remoteCiphertext ? String(source.remoteCiphertext) : ''
  };
}

export function getMarkdownProtectionState(tab) {
  if (!tab || typeof tab !== 'object') return createMarkdownProtectionState();
  if (!tab.protection || typeof tab.protection !== 'object') {
    tab.protection = createMarkdownProtectionState();
  } else {
    tab.protection = createMarkdownProtectionState(tab.protection);
  }
  return tab.protection;
}

export function setMarkdownProtectionState(tab, state = {}) {
  if (!tab || typeof tab !== 'object') return createMarkdownProtectionState();
  tab.protection = createMarkdownProtectionState(state);
  return tab.protection;
}

export function createDiscardedMarkdownProtectionState(protection) {
  const current = createMarkdownProtectionState(protection);
  if (!current.encryptedRemote) return createMarkdownProtectionState();
  return createMarkdownProtectionState({
    enabled: true,
    password: '',
    encryptedRemote: true,
    encryptedDraft: false,
    passwordChanged: false,
    remoteSignature: current.remoteSignature,
    remoteCiphertext: current.remoteCiphertext
  });
}

export function isMarkdownTabProtected(tab) {
  if (!tab) return false;
  const protection = getMarkdownProtectionState(tab);
  return !!protection.enabled;
}

export function isEncryptedMarkdownDraftEntry(entry) {
  return !!(entry && typeof entry === 'object' && (entry.encrypted === true || entry.protected === true));
}

export function hasMarkdownDraftContent(tab) {
  if (!tab || !tab.localDraft) return false;
  const draft = tab.localDraft;
  const plain = normalizeMarkdownContent(draft.content || '');
  const encrypted = normalizeMarkdownContent(draft.encryptedContent || '');
  const deletedAssets = Array.isArray(draft.deletedAssets) && draft.deletedAssets.length;
  return !!(plain || encrypted || deletedAssets);
}

export function getLockedEncryptedMarkdownDraft(tab) {
  if (!tab || !tab.localDraft) return '';
  const draft = tab.localDraft;
  if (!draft.encrypted || draft.decrypted) return '';
  return normalizeMarkdownContent(draft.encryptedContent || '');
}

export function getMarkdownDraftSaveGeneration(tab) {
  return Math.max(0, Math.floor(Number(tab && tab.markdownDraftSaveGeneration) || 0));
}

export function bumpMarkdownDraftSaveGeneration(tab) {
  if (!tab || typeof tab !== 'object') return 0;
  const next = getMarkdownDraftSaveGeneration(tab) + 1;
  tab.markdownDraftSaveGeneration = next;
  return next;
}
