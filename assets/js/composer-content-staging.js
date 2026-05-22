import { createCommitFileCollector } from './composer-staging.js?v=press-system-v3.4.41';
import {
  listLocalMarkdownAssetReferences,
  planManagedContentDeletions
} from './repository-deletions.js?v=press-system-v3.4.41';

export function createContentCommitStagingProvider({
  getDynamicEditorTabs = () => new Map(),
  flushMarkdownDraft = async () => null,
  getStateSlice = () => null,
  getContentRootSafe = () => 'wwwroot',
  getRemoteBaseline = () => ({}),
  getComposerDiffCache = () => ({}),
  setComposerDiff = () => {},
  collectCurrentRepositoryMarkdownAssetReferences = async () => ({ refs: new Set(), failures: [] }),
  collectUnsyncedMarkdownEntries = () => [],
  getPrimaryEditorApi = () => null,
  getActiveDynamicTab = () => null,
  getCurrentMode = () => '',
  readMarkdownDraftStore = () => ({}),
  normalizeRelPath = (value) => String(value || '').replace(/\\+/g, '/').replace(/^\/+/, ''),
  findDynamicTabByPath = () => null,
  getLockedEncryptedMarkdownDraft = () => '',
  normalizeMarkdownContent = (value) => String(value == null ? '' : value).replace(/\r\n?/g, '\n'),
  isEncryptedMarkdownDraftEntry = () => false,
  prepareMarkdownForProtectedStorage = async (tab, text) => ({ content: text, encrypted: false }),
  listMarkdownAssets = () => [],
  isAssetReferencedInContent = () => true,
  removeMarkdownAsset = () => {},
  enrichIndexStateForPublish = async (state) => state,
  toIndexYaml = () => '',
  toTabsYaml = () => '',
  toSiteYaml = () => '',
  setStateSlice = () => {},
  computeIndexDiff = () => null,
  recomputeDiff = () => null,
  listMarkdownAssetDeletions = () => [],
  safeString = (value) => String(value == null ? '' : value),
  draftHasAssetDeletions = () => false,
  textWithFallback = (key, fallback) => fallback,
  fetchImpl = fetch
} = {}) {
  function collectDirtyMarkdownPathsForDeletion() {
    const paths = new Set();
    const dynamicEditorTabs = getDynamicEditorTabs();
    if (dynamicEditorTabs && typeof dynamicEditorTabs.forEach === 'function') {
      dynamicEditorTabs.forEach((tab) => {
        if (!tab || !tab.path) return;
        if (tab.isDirty || (tab.localDraft && (normalizeMarkdownContent(tab.localDraft.content || '') || normalizeMarkdownContent(tab.localDraft.encryptedContent || '') || draftHasAssetDeletions(tab.localDraft)))) {
          paths.add(tab.path);
        }
      });
    }
    try {
      const store = readMarkdownDraftStore();
      if (store && typeof store === 'object') {
        Object.keys(store).forEach((key) => {
          const entry = store[key];
          if (!entry || typeof entry !== 'object') return;
          const hasContent = entry.content != null && normalizeMarkdownContent(entry.content);
          const hasAssets = Array.isArray(entry.assets) && entry.assets.length;
          const hasDeletedAssets = draftHasAssetDeletions(entry);
          if (hasContent || hasAssets || hasDeletedAssets) paths.add(key);
        });
      }
    } catch (_) {}
    return Array.from(paths);
  }

  function formatRepositoryDeletionBlockers(blocked = []) {
    const paths = (Array.isArray(blocked) ? blocked : [])
      .map(item => item && item.path ? String(item.path) : '')
      .filter(Boolean);
    if (!paths.length) {
      return textWithFallback(
        'editor.toasts.repositoryDeletionDraftsPending',
        'Unable to delete files while local drafts are still pending.'
      );
    }
    const sample = paths.slice(0, 5).join(', ');
    const remaining = paths.length > 5 ? paths.length - 5 : 0;
    const fallbackSuffix = remaining ? `, +${remaining} more` : '';
    return textWithFallback(
      'editor.toasts.repositoryDeletionDraftsBlocked',
      `Publish blocked because deleted files still have local drafts: ${sample}${fallbackSuffix}. Restore, publish, or discard those drafts before deleting the files.`,
      { sample, remaining }
    );
  }

  async function fetchMarkdownForRepositoryDeletion(file) {
    const path = file && file.path ? String(file.path).replace(/\\+/g, '/').replace(/^\/+/, '') : '';
    if (!path) return '';
    try {
      const resp = await fetchImpl(`${path}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!resp.ok) return '';
      return normalizeMarkdownContent(await resp.text());
    } catch (_) {
      return '';
    }
  }

  async function collectDeletedMarkdownAssetFiles(markdownDeletionFiles = [], options = {}) {
    const contentRoot = options.contentRoot || 'wwwroot';
    const referencedAssets = options.referencedAssets instanceof Set ? options.referencedAssets : new Set();
    const out = [];
    const seen = new Set();
    for (const file of Array.isArray(markdownDeletionFiles) ? markdownDeletionFiles : []) {
      if (!file || !file.deleted || !file.markdownPath) continue;
      const markdown = await fetchMarkdownForRepositoryDeletion(file);
      if (!markdown) continue;
      listLocalMarkdownAssetReferences(markdown, file.markdownPath, contentRoot).forEach((resolved) => {
        if (!resolved || !resolved.contentPath || !resolved.commitPath) return;
        if (referencedAssets.has(resolved.contentPath)) return;
        if (seen.has(resolved.commitPath)) return;
        seen.add(resolved.commitPath);
        out.push({
          kind: 'asset',
          category: 'content-asset',
          label: resolved.relativePath || resolved.contentPath,
          path: resolved.commitPath,
          markdownPath: resolved.markdownPath,
          assetPath: resolved.contentPath,
          assetRelativePath: resolved.relativePath || '',
          state: 'deleted',
          deleted: true
        });
      });
    }
    return out;
  }

  async function getCommitFiles(options = {}) {
    const { cleanupUnusedAssets = true } = options;
    const collector = createCommitFileCollector();
    const { addFile } = collector;
    const dynamicEditorTabs = getDynamicEditorTabs();

    try {
      const tabValues = dynamicEditorTabs && typeof dynamicEditorTabs.values === 'function'
        ? Array.from(dynamicEditorTabs.values())
        : [];
      const flushes = tabValues.map((tab) => (
        flushMarkdownDraft(tab).catch((err) => {
          console.warn('Failed to flush markdown draft before commit', err);
          return null;
        })
      ));
      await Promise.all(flushes);
    } catch (_) { /* ignore */ }

    const remoteBaseline = getRemoteBaseline() || {};
    const composerDiffCache = getComposerDiffCache() || {};
    const siteState = getStateSlice('site');
    let root;
    if (siteState && Object.prototype.hasOwnProperty.call(siteState, 'contentRoot')) {
      root = safeString(siteState.contentRoot);
    }
    if (!root) {
      root = getContentRootSafe();
    }
    const normalizedRoot = String(root || '')
      .replace(/\\+/g, '/').replace(/\/?$/, '');
    const rootPrefix = normalizedRoot ? `${normalizedRoot}/` : '';
    const baselineRoot = (() => {
      const baselineSite = remoteBaseline && remoteBaseline.site && typeof remoteBaseline.site === 'object'
        ? remoteBaseline.site
        : {};
      const raw = Object.prototype.hasOwnProperty.call(baselineSite, 'contentRoot')
        ? safeString(baselineSite.contentRoot)
        : '';
      return String(raw || 'wwwroot').replace(/\\+/g, '/').replace(/\/?$/, '');
    })();
    const pendingMarkdownByPath = new Map();

    if (composerDiffCache.tabs && composerDiffCache.tabs.hasChanges) {
      const state = getStateSlice('tabs') || { __order: [] };
      const yaml = toTabsYaml(state);
      addFile({ kind: 'tabs', label: 'tabs.yaml', path: `${rootPrefix}tabs.yaml`, content: yaml });
    }
    if (composerDiffCache.site && composerDiffCache.site.hasChanges) {
      const state = getStateSlice('site') || {};
      const yaml = toSiteYaml(state);
      addFile({ kind: 'site', label: 'site.yaml', path: 'site.yaml', content: yaml });
    }

    const contentDeletionPlan = planManagedContentDeletions({
      index: getStateSlice('index') || { __order: [] },
      tabs: getStateSlice('tabs') || { __order: [] },
      indexBaseline: remoteBaseline.index || { __order: [] },
      tabsBaseline: remoteBaseline.tabs || { __order: [] },
      indexDiff: composerDiffCache.index,
      tabsDiff: composerDiffCache.tabs,
      contentRoot: normalizedRoot || 'wwwroot',
      currentContentRoot: normalizedRoot || 'wwwroot',
      baselineContentRoot: baselineRoot || 'wwwroot',
      dirtyMarkdownPaths: collectDirtyMarkdownPathsForDeletion()
    });
    if (contentDeletionPlan.blocked.length) {
      throw new Error(formatRepositoryDeletionBlockers(contentDeletionPlan.blocked));
    }
    contentDeletionPlan.files.forEach(addFile);
    const assetReferenceScan = await collectCurrentRepositoryMarkdownAssetReferences({
      excludeMarkdownPaths: contentDeletionPlan.files.map(file => file && file.markdownPath).filter(Boolean),
      currentContentRoot: normalizedRoot || 'wwwroot',
      baselineContentRoot: baselineRoot || 'wwwroot'
    });
    const referencedAssetPaths = assetReferenceScan.refs;
    const assetReferenceScanComplete = !(assetReferenceScan.failures && assetReferenceScan.failures.length);
    if (assetReferenceScanComplete) {
      const deletedMarkdownAssetFiles = await collectDeletedMarkdownAssetFiles(contentDeletionPlan.files, {
        contentRoot: baselineRoot || 'wwwroot',
        referencedAssets: referencedAssetPaths
      });
      deletedMarkdownAssetFiles.forEach(addFile);
    } else {
      console.warn('Skipping repository asset deletions because some current markdown files could not be checked.', assetReferenceScan.failures);
    }

    const markdownEntries = collectUnsyncedMarkdownEntries();
    if (markdownEntries && markdownEntries.length) {
      const editorApi = getPrimaryEditorApi();
      const activeTab = getActiveDynamicTab();
      let activeValue = null;
      if (editorApi && typeof editorApi.getValue === 'function' && activeTab && activeTab.mode === getCurrentMode()) {
        try { activeValue = String(editorApi.getValue() || ''); }
        catch (_) { activeValue = null; }
      }
      const draftStore = readMarkdownDraftStore();
      for (const entry of markdownEntries) {
        const rel = normalizeRelPath(entry.path);
        if (!rel) continue;
        const repoPath = `${rootPrefix}${rel}`;
        const tab = findDynamicTabByPath(rel);
        let text = '';
        let alreadyEncrypted = false;
        if (tab) {
          const lockedEncryptedDraft = getLockedEncryptedMarkdownDraft(tab);
          if (lockedEncryptedDraft) {
            text = lockedEncryptedDraft;
            alreadyEncrypted = true;
          } else if (tab === activeTab && activeValue != null) {
            tab.content = activeValue;
            text = normalizeMarkdownContent(tab.content);
          } else if (tab.content != null && tab.content !== undefined) {
            text = normalizeMarkdownContent(tab.content);
          } else if (tab.localDraft && tab.localDraft.content != null) {
            text = normalizeMarkdownContent(tab.localDraft.content);
          }
        } else if (draftStore && draftStore[rel] && typeof draftStore[rel] === 'object') {
          const draft = draftStore[rel];
          if (draft.content != null) text = normalizeMarkdownContent(draft.content);
          alreadyEncrypted = isEncryptedMarkdownDraftEntry(draft);
        }
        const prepared = alreadyEncrypted
          ? { content: text, encrypted: true }
          : await prepareMarkdownForProtectedStorage(tab, text, { reason: 'commit' });
        pendingMarkdownByPath.set(rel, {
          content: prepared.content,
          plaintextContent: prepared.encrypted && !alreadyEncrypted ? text : '',
          protected: !!prepared.encrypted
        });
        addFile({
          kind: 'markdown',
          label: rel,
          path: repoPath,
          content: prepared.content,
          plaintextContent: prepared.encrypted && !alreadyEncrypted ? text : '',
          markdownPath: rel,
          state: entry.state || '',
          protected: !!prepared.encrypted
        });

        const assets = listMarkdownAssets(rel);
        if (assets.length) {
          const normalizedText = normalizeMarkdownContent(text);
          const unusedAssets = [];
          assets.forEach((asset) => {
            if (!asset || !asset.path || !asset.base64) return;
            const commitPath = `${rootPrefix}${asset.path}`.replace(/\\+/g, '/');
            if (!alreadyEncrypted && !isAssetReferencedInContent(normalizedText, asset)) {
              unusedAssets.push(asset.path);
              return;
            }
            addFile({
              kind: 'asset',
              label: asset.relativePath || asset.path,
              path: commitPath,
              base64: asset.base64,
              binary: true,
              mime: asset.mime || 'application/octet-stream',
              size: Number.isFinite(asset.size) ? asset.size : 0,
              markdownPath: rel,
              assetPath: asset.path,
              assetRelativePath: asset.relativePath || ''
            });
          });
          if (cleanupUnusedAssets && unusedAssets.length) {
            unusedAssets.forEach((assetPath) => {
              removeMarkdownAsset(rel, assetPath);
            });
          }
        }
      }
    }

    const originalIndexDiff = composerDiffCache.index || recomputeDiff('index');
    const indexState = getStateSlice('index') || { __order: [] };
    let indexYaml = toIndexYaml(indexState);
    let indexMetadataChanged = false;
    if ((originalIndexDiff && originalIndexDiff.hasChanges) || pendingMarkdownByPath.size > 0) {
      const enrichedIndexState = await enrichIndexStateForPublish(indexState, {
        contentRoot: normalizedRoot || 'wwwroot',
        pendingMarkdownByPath
      });
      const enrichedIndexYaml = toIndexYaml(enrichedIndexState);
      indexMetadataChanged = enrichedIndexYaml !== indexYaml;
      if (indexMetadataChanged) {
        setStateSlice('index', enrichedIndexState);
        const nextIndexDiff = computeIndexDiff(enrichedIndexState, remoteBaseline.index);
        setComposerDiff('index', nextIndexDiff);
        indexYaml = enrichedIndexYaml;
      }
    }
    if ((originalIndexDiff && originalIndexDiff.hasChanges) || indexMetadataChanged) {
      addFile({ kind: 'index', label: 'index.yaml', path: `${rootPrefix}index.yaml`, content: indexYaml });
    }

    const assetDeletionRefs = referencedAssetPaths;
    if (assetReferenceScanComplete) {
      listMarkdownAssetDeletions().forEach((asset) => {
        if (!asset || !asset.assetPath || !asset.deleted) return;
        if (assetDeletionRefs.has(asset.assetPath)) return;
        const commitPath = `${rootPrefix}${asset.assetPath}`.replace(/\\+/g, '/');
        addFile({
          ...asset,
          label: asset.assetRelativePath || asset.label || asset.assetPath,
          path: commitPath,
          deleted: true,
          state: 'deleted'
        });
      });
    }

    return collector.getFiles();
  }

  return {
    getCommitFiles
  };
}
