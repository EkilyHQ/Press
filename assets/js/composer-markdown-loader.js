export const TAB_STATE_VALUES = new Set(['checking', 'existing', 'missing', 'error']);

const noop = () => {};

function defaultFetchContent(url, options) {
  if (typeof fetch !== 'function') throw new Error('fetch unavailable');
  return fetch(url, options);
}

function normalizeStatusTimestamp(value) {
  let checkedAt = value;
  if (checkedAt instanceof Date) checkedAt = checkedAt.getTime();
  if (checkedAt != null && !Number.isFinite(checkedAt)) checkedAt = Number(checkedAt);
  if (Number.isFinite(checkedAt)) return Math.max(0, Math.floor(checkedAt));
  return null;
}

function normalizeContentFallback(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function resolveOptionValue(value) {
  return typeof value === 'function' ? value() : value;
}

export function createComposerMarkdownLoader(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const getContentRootSafe = typeof opts.getContentRootSafe === 'function' ? opts.getContentRootSafe : () => '';
  const normalizeRelPath = typeof opts.normalizeRelPath === 'function' ? opts.normalizeRelPath : (path) => String(path || '');
  const normalizeMarkdownContent = typeof opts.normalizeMarkdownContent === 'function' ? opts.normalizeMarkdownContent : normalizeContentFallback;
  const computeTextSignature = typeof opts.computeTextSignature === 'function'
    ? opts.computeTextSignature
    : (text) => `${normalizeMarkdownContent(text).length}:0`;
  const parseEncryptedMarkdownEnvelope = typeof opts.parseEncryptedMarkdownEnvelope === 'function'
    ? opts.parseEncryptedMarkdownEnvelope
    : () => ({ encrypted: false });
  const decryptProtectedMarkdownForTab = typeof opts.decryptProtectedMarkdownForTab === 'function'
    ? opts.decryptProtectedMarkdownForTab
    : async (markdown) => normalizeMarkdownContent(markdown);
  const isMarkdownTabProtected = typeof opts.isMarkdownTabProtected === 'function' ? opts.isMarkdownTabProtected : () => false;
  const setMarkdownProtectionState = typeof opts.setMarkdownProtectionState === 'function' ? opts.setMarkdownProtectionState : noop;
  const createMarkdownProtectionState = typeof opts.createMarkdownProtectionState === 'function'
    ? opts.createMarkdownProtectionState
    : () => ({});
  const draftHasAssetDeletions = typeof opts.draftHasAssetDeletions === 'function' ? opts.draftHasAssetDeletions : () => false;
  const getDefaultMarkdownForPath = typeof opts.getDefaultMarkdownForPath === 'function' ? opts.getDefaultMarkdownForPath : () => '';
  const updateDynamicTabDirtyState = typeof opts.updateDynamicTabDirtyState === 'function' ? opts.updateDynamicTabDirtyState : noop;
  const getCurrentMode = typeof opts.getCurrentMode === 'function' ? opts.getCurrentMode : () => null;
  const pushEditorCurrentFileInfo = typeof opts.pushEditorCurrentFileInfo === 'function' ? opts.pushEditorCurrentFileInfo : noop;
  const refreshEditorContentTree = typeof opts.refreshEditorContentTree === 'function' ? opts.refreshEditorContentTree : noop;
  const fetchContent = typeof opts.fetchContent === 'function' ? opts.fetchContent : defaultFetchContent;
  const getNow = typeof opts.now === 'function' ? opts.now : () => Date.now();

  function setDynamicTabStatus(tab, status) {
    if (!tab) return;
    const next = status && typeof status === 'object' ? { ...status } : {};
    const rawState = String(next.state || '').trim().toLowerCase();
    const state = TAB_STATE_VALUES.has(rawState) ? rawState : '';
    const checkedAt = normalizeStatusTimestamp(next.checkedAt);

    const normalized = {
      state,
      checkedAt,
    };
    if (next.message) normalized.message = String(next.message || '');
    if (next.code != null) normalized.code = Number(next.code);

    tab.fileStatus = normalized;

    const btn = tab.button;
    if (btn) {
      if (state) btn.setAttribute('data-file-state', state);
      else btn.removeAttribute('data-file-state');
      if (checkedAt != null) btn.setAttribute('data-checked-at', String(checkedAt));
      else btn.removeAttribute('data-checked-at');
    }

    if (getCurrentMode() === tab.mode) pushEditorCurrentFileInfo(tab);
    refreshEditorContentTree({ preserveStructure: getCurrentMode() === tab.mode });
  }

  async function loadDynamicTabContent(tab) {
    if (!tab) return '';
    if (tab.loaded && typeof tab.content === 'string') return tab.content;
    if (tab.pending) return tab.pending;

    const root = getContentRootSafe();
    const rel = normalizeRelPath(tab.path);
    if (!rel) throw new Error('Invalid markdown path');
    const url = `${root}/${rel}`.replace(/[\\]/g, '/');

    const runner = async () => {
      setDynamicTabStatus(tab, { state: 'checking', checkedAt: getNow(), message: 'Checking file\u2026' });

      let res;
      try {
        res = await fetchContent(url, { cache: 'no-store' });
      } catch (err) {
        setDynamicTabStatus(tab, {
          state: 'error',
          checkedAt: getNow(),
          message: err && err.message ? err.message : 'Network error'
        });
        throw err;
      }

      const checkedAt = getNow();

      if (res.status === 404) {
        tab.remoteContent = '';
        tab.remoteSignature = computeTextSignature('');
        if (tab.localDraft && tab.localDraft.encryptedContent) {
          tab.content = await decryptProtectedMarkdownForTab(tab.localDraft.encryptedContent, tab, {
            draft: true,
            remote: false,
            remoteSignature: tab.remoteSignature,
            title: resolveOptionValue(opts.draftProtectionTitle),
            message: resolveOptionValue(opts.draftProtectionMessage)
          });
          tab.localDraft.content = tab.content;
          tab.localDraft.decrypted = true;
        } else if (tab.localDraft && draftHasAssetDeletions(tab.localDraft)) {
          tab.content = normalizeMarkdownContent(tab.localDraft.content || '');
        } else if (!tab.localDraft || !tab.localDraft.content) {
          const template = getDefaultMarkdownForPath(rel);
          tab.content = template || '';
          setMarkdownProtectionState(tab, createMarkdownProtectionState());
        }
        tab.loaded = true;
        setDynamicTabStatus(tab, {
          state: 'missing',
          checkedAt,
          message: 'File not found on server',
          code: 404
        });
        updateDynamicTabDirtyState(tab, { autoSave: !tab.localDraft });
        return tab.content;
      }

      if (!res.ok) {
        const err = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        setDynamicTabStatus(tab, {
          state: 'error',
          checkedAt,
          message: err.message || `HTTP ${res.status}`,
          code: res.status
        });
        throw err;
      }

      const text = normalizeMarkdownContent(await res.text());
      const remoteEnvelope = parseEncryptedMarkdownEnvelope(text);
      const remoteSignature = computeTextSignature(text);
      let editorText = text;
      if (remoteEnvelope.encrypted) {
        editorText = await decryptProtectedMarkdownForTab(text, tab, {
          remote: true,
          draft: false,
          remoteSignature,
          title: resolveOptionValue(opts.openProtectionTitle),
          message: resolveOptionValue(opts.openProtectionMessage)
        });
      } else if (!isMarkdownTabProtected(tab)) {
        setMarkdownProtectionState(tab, createMarkdownProtectionState());
      }
      tab.remoteContent = editorText;
      tab.remoteSignature = remoteSignature;
      if (tab.localDraft && tab.localDraft.encryptedContent) {
        tab.content = await decryptProtectedMarkdownForTab(tab.localDraft.encryptedContent, tab, {
          draft: true,
          remote: false,
          remoteSignature,
          title: resolveOptionValue(opts.draftProtectionTitle),
          message: resolveOptionValue(opts.draftProtectionMessage)
        });
        tab.localDraft.content = tab.content;
        tab.localDraft.decrypted = true;
      } else if (tab.localDraft && draftHasAssetDeletions(tab.localDraft)) {
        tab.content = normalizeMarkdownContent(tab.localDraft.content || '');
      } else if (!tab.localDraft || !tab.localDraft.content) {
        tab.content = editorText;
      }
      tab.loaded = true;
      setDynamicTabStatus(tab, {
        state: 'existing',
        checkedAt,
        code: res.status
      });
      updateDynamicTabDirtyState(tab, { autoSave: !tab.localDraft });
      return tab.content;
    };

    tab.pending = runner().catch((err) => {
      tab.loaded = false;
      setDynamicTabStatus(tab, {
        state: 'error',
        checkedAt: getNow(),
        message: err && err.message ? err.message : 'Unable to load markdown'
      });
      throw err;
    }).finally(() => {
      tab.pending = null;
    });

    return tab.pending;
  }

  return {
    setDynamicTabStatus,
    loadDynamicTabContent
  };
}
