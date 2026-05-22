import { parseEncryptedMarkdownEnvelope } from './encrypted-content.js?v=press-system-v3.4.35';

export function createPostCommitStateApplier({
  stagingRegistry,
  getStateSlice = () => null,
  getRemoteBaseline = () => ({}),
  setRemoteBaselineSlice = () => {},
  deepClone = (value) => JSON.parse(JSON.stringify(value)),
  prepareIndexState = (state) => state || { __order: [] },
  prepareTabsState = (state) => state || { __order: [] },
  prepareSiteState = (state) => state || {},
  cloneSiteState = (state) => ({ ...(state || {}) }),
  notifyComposerChange = () => {},
  clearDraftStorage = () => {},
  getContentRootSafe = () => 'wwwroot',
  applyComposerEffectiveSiteConfig = (state) => state,
  safeString = (value) => String(value == null ? '' : value),
  updateComposerMarkdownDraftIndicators = () => {},
  updateMarkdownPushButton = () => {},
  updateMarkdownDiscardButton = () => {},
  updateMarkdownSaveButton = () => {},
  updateMarkdownProtectionButton = () => {},
  getActiveDynamicTab = () => null,
  normalizeRelPath = (value) => String(value || '').replace(/\\+/g, '/').replace(/^\/+/, ''),
  clearMarkdownDraftEntry = () => {},
  clearMarkdownAssetsForPath = () => {},
  findDynamicTabByPath = () => null,
  computeTextSignature = (value) => String(value || ''),
  setMarkdownProtectionState = () => {},
  createMarkdownProtectionState = () => ({}),
  setDynamicTabStatus = () => {},
  normalizeMarkdownContent = (value) => String(value == null ? '' : value).replace(/\r\n?/g, '\n'),
  getMarkdownProtectionState = () => ({}),
  scheduleMarkdownDraftSave = () => {},
  updateDynamicTabDirtyState = () => {},
  removeMarkdownAsset = () => {},
  removeMarkdownAssetDeletion = () => {},
  updateUnsyncedSummary = () => {}
} = {}) {
  function apply(files = []) {
    if (!Array.isArray(files) || !files.length) return;
    if (stagingRegistry && typeof stagingRegistry.clearCommittedFiles === 'function') {
      stagingRegistry.clearCommittedFiles(files);
    }
    const handledMarkdown = new Set();
    files.forEach((file) => {
      if (!file || !file.kind) return;
      if (file.kind === 'index') {
        const state = getStateSlice('index') || { __order: [] };
        setRemoteBaselineSlice('index', deepClone(prepareIndexState(state)));
        notifyComposerChange('index', { skipAutoSave: true });
        clearDraftStorage('index');
      } else if (file.kind === 'tabs') {
        const state = getStateSlice('tabs') || { __order: [] };
        setRemoteBaselineSlice('tabs', deepClone(prepareTabsState(state)));
        notifyComposerChange('tabs', { skipAutoSave: true });
        clearDraftStorage('tabs');
      } else if (file.kind === 'site') {
        const state = getStateSlice('site');
        const snapshot = state ? cloneSiteState(state) : cloneSiteState(prepareSiteState({}));
        setRemoteBaselineSlice('site', snapshot);

        const previousRoot = getContentRootSafe();
        const effectiveSnapshot = applyComposerEffectiveSiteConfig(snapshot);
        const rawNextRoot = effectiveSnapshot && typeof effectiveSnapshot === 'object' && Object.prototype.hasOwnProperty.call(effectiveSnapshot, 'contentRoot')
          ? safeString(effectiveSnapshot.contentRoot)
          : '';
        const normalizedNextRoot = (rawNextRoot ? rawNextRoot : 'wwwroot').trim().replace(/[\\]/g, '/').replace(/\/?$/, '');
        const rootChanged = normalizedNextRoot !== previousRoot;

        notifyComposerChange('site', { skipAutoSave: true });
        clearDraftStorage('site');

        if (rootChanged) {
          updateComposerMarkdownDraftIndicators();
          updateMarkdownPushButton(getActiveDynamicTab());
          updateMarkdownDiscardButton(getActiveDynamicTab());
          updateMarkdownSaveButton(getActiveDynamicTab());
          updateMarkdownProtectionButton(getActiveDynamicTab());
        }
      } else if (file.kind === 'markdown') {
        const norm = normalizeRelPath(file.markdownPath || file.label || '');
        if (!norm) return;
        handledMarkdown.add(norm);
        if (file.deleted) {
          clearMarkdownDraftEntry(norm);
          clearMarkdownAssetsForPath(norm);
          const tab = findDynamicTabByPath(norm);
          if (tab) {
            tab.remoteContent = '';
            tab.remoteSignature = computeTextSignature('');
            tab.content = '';
            tab.loaded = true;
            tab.localDraft = null;
            tab.draftConflict = false;
            tab.isDirty = false;
            setMarkdownProtectionState(tab, createMarkdownProtectionState());
            setDynamicTabStatus(tab, {
              state: 'missing',
              checkedAt: Date.now(),
              code: 404,
              message: 'Deleted via Press'
            });
          }
          updateComposerMarkdownDraftIndicators({ path: norm });
          return;
        }
        const committedText = normalizeMarkdownContent(file.content || '');
        const tab = findDynamicTabByPath(norm);
        const commitSignature = computeTextSignature(committedText);
        const committedEnvelope = parseEncryptedMarkdownEnvelope(committedText);
        const committedProtected = !!file.protected || committedEnvelope.encrypted;
        const checkedAt = Date.now();
        if (tab) {
          const baselineText = committedProtected
            ? normalizeMarkdownContent(file.plaintextContent || tab.content || '')
            : committedText;
          const currentText = normalizeMarkdownContent(tab.content || '');
          const hasNewerLocalContent = currentText !== baselineText;
          tab.remoteContent = baselineText;
          tab.remoteSignature = commitSignature;
          tab.loaded = true;
          if (committedProtected) {
            setMarkdownProtectionState(tab, {
              ...getMarkdownProtectionState(tab),
              enabled: true,
              encryptedRemote: true,
              passwordChanged: false,
              remoteSignature: commitSignature,
              remoteCiphertext: committedEnvelope.ciphertext || ''
            });
          } else {
            setMarkdownProtectionState(tab, createMarkdownProtectionState());
          }
          if (hasNewerLocalContent) {
            if (tab.localDraft) {
              tab.localDraft = { ...tab.localDraft, remoteSignature: tab.remoteSignature };
            }
            scheduleMarkdownDraftSave(tab);
            updateDynamicTabDirtyState(tab, { autoSave: false });
            setDynamicTabStatus(tab, {
              state: 'existing',
              checkedAt,
              message: 'Local edits pending sync'
            });
          } else {
            clearMarkdownDraftEntry(norm);
            clearMarkdownAssetsForPath(norm);
            tab.content = baselineText;
            tab.localDraft = null;
            tab.draftConflict = false;
            tab.isDirty = false;
            updateDynamicTabDirtyState(tab, { autoSave: false });
            setDynamicTabStatus(tab, {
              state: 'existing',
              checkedAt,
              message: 'Synchronized via Press'
            });
          }
        } else {
          clearMarkdownDraftEntry(norm);
          clearMarkdownAssetsForPath(norm);
        }
        updateComposerMarkdownDraftIndicators({ path: norm });
      }
      else if (file.kind === 'asset') {
        const norm = normalizeRelPath(file.markdownPath || '');
        if (!norm) return;
        const assetPath = normalizeRelPath(file.assetPath || '');
        if (assetPath) {
          removeMarkdownAsset(norm, assetPath);
          removeMarkdownAssetDeletion(norm, assetPath);
        }
        else if (file.path) {
          const withoutRoot = file.path.replace(/^\/?(?:wwwroot\/)?/, '');
          removeMarkdownAsset(norm, normalizeRelPath(withoutRoot));
          removeMarkdownAssetDeletion(norm, normalizeRelPath(withoutRoot));
        }
      }
    });
    updateUnsyncedSummary();
    updateMarkdownPushButton(getActiveDynamicTab());
    updateMarkdownDiscardButton(getActiveDynamicTab());
    updateMarkdownSaveButton(getActiveDynamicTab());
    updateMarkdownProtectionButton(getActiveDynamicTab());
  }

  return {
    apply
  };
}
