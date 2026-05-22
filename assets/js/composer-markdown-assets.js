import {
  collectLocalMarkdownAssetReferences,
  collectManagedMarkdownReferences,
  listLocalMarkdownAssetReferences,
  resolveLocalMarkdownAssetReference
} from './repository-deletions.js?v=press-system-v3.4.45';

export function createComposerMarkdownAssetManager(options = {}) {
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const translate = typeof options.t === 'function' ? options.t : ((key) => key);
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : ((value) => String(value || '').replace(/[\\]/g, '/'));
  const normalizeMarkdownContent = typeof options.normalizeMarkdownContent === 'function' ? options.normalizeMarkdownContent : ((value) => String(value || ''));
  const getContentRootSafe = typeof options.getContentRootSafe === 'function' ? options.getContentRootSafe : (() => 'wwwroot');
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : (() => null);
  const getDynamicEditorTabs = typeof options.getDynamicEditorTabs === 'function' ? options.getDynamicEditorTabs : (() => new Map());
  const getActiveDynamicTab = typeof options.getActiveDynamicTab === 'function' ? options.getActiveDynamicTab : (() => null);
  const getPrimaryEditorApi = typeof options.getPrimaryEditorApi === 'function' ? options.getPrimaryEditorApi : (() => null);
  const readMarkdownDraftStore = typeof options.readMarkdownDraftStore === 'function' ? options.readMarkdownDraftStore : (() => ({}));
  const writeMarkdownDraftStore = typeof options.writeMarkdownDraftStore === 'function' ? options.writeMarkdownDraftStore : (() => {});
  const getMarkdownDraftEntry = typeof options.getMarkdownDraftEntry === 'function' ? options.getMarkdownDraftEntry : (() => null);
  const findDynamicTabByPath = typeof options.findDynamicTabByPath === 'function' ? options.findDynamicTabByPath : (() => null);
  const scheduleMarkdownDraftSave = typeof options.scheduleMarkdownDraftSave === 'function' ? options.scheduleMarkdownDraftSave : (() => {});
  const updateUnsyncedSummary = typeof options.updateUnsyncedSummary === 'function' ? options.updateUnsyncedSummary : (() => {});
  const showToast = typeof options.showToast === 'function' ? options.showToast : (() => {});

  const markdownAssetStore = new Map();
  const markdownDeletedAssetStore = new Map();

  function ensureMarkdownAssetBucket(path) {
    const norm = normalizeRelPath(path);
    if (!norm) return null;
    let bucket = markdownAssetStore.get(norm);
    if (!bucket) {
      bucket = new Map();
      markdownAssetStore.set(norm, bucket);
    }
    return bucket;
  }

  function getMarkdownAssetBucket(path) {
    const norm = normalizeRelPath(path);
    if (!norm) return null;
    return markdownAssetStore.get(norm) || null;
  }

  function broadcastMarkdownAssetPreview(path) {
    const norm = normalizeRelPath(path);
    if (!norm || !windowRef || typeof windowRef.dispatchEvent !== 'function') return;
    const bucket = getMarkdownAssetBucket(norm);
    const assets = bucket && bucket.size
      ? Array.from(bucket.values()).map(asset => ({
        path: asset.path,
        relativePath: asset.relativePath,
        base64: asset.base64,
        mime: asset.mime
      }))
      : [];
    try {
      const EventCtor = windowRef.CustomEvent || (typeof CustomEvent === 'function' ? CustomEvent : null);
      if (!EventCtor) return;
      windowRef.dispatchEvent(new EventCtor('press-editor-asset-preview', {
        detail: { markdownPath: norm, assets }
      }));
    } catch (_) {
      /* ignore */
    }
  }

  function normalizeAssetDescriptor(asset, markdownPath) {
    if (!asset) return null;
    const commitPath = normalizeRelPath(asset.path || asset.commitPath || '');
    const markdown = normalizeRelPath(markdownPath || asset.markdownPath || '');
    const base64 = typeof asset.base64 === 'string' ? asset.base64.trim() : '';
    if (!commitPath || !markdown || !base64) return null;
    const relativePath = asset.relativePath ? String(asset.relativePath).replace(/[\\]/g, '/') : '';
    const mime = asset.mime ? String(asset.mime) : '';
    const sizeRaw = Number(asset.size);
    const size = Number.isFinite(sizeRaw) ? sizeRaw : 0;
    const fileName = asset.fileName ? String(asset.fileName) : '';
    const originalName = asset.originalName ? String(asset.originalName) : '';
    const addedAtRaw = Number(asset.addedAt);
    const addedAt = Number.isFinite(addedAtRaw) ? addedAtRaw : Date.now();
    return {
      path: commitPath,
      relativePath: relativePath || commitPath,
      base64,
      mime,
      size,
      fileName,
      originalName,
      addedAt,
      markdownPath: markdown
    };
  }

  function normalizeAssetDeletionDescriptor(asset, markdownPath) {
    if (!asset) return null;
    const markdown = normalizeRelPath(markdownPath || asset.markdownPath || '');
    if (!markdown) return null;
    const assetPath = normalizeRelPath(asset.assetPath || asset.path || asset.commitPath || '');
    let relativePath = asset.assetRelativePath || asset.relativePath
      ? String(asset.assetRelativePath || asset.relativePath).replace(/[\\]/g, '/')
      : '';
    if (!relativePath && assetPath) {
      const idx = markdown.lastIndexOf('/');
      const dir = idx >= 0 ? markdown.slice(0, idx) : '';
      const prefix = dir ? `${dir}/assets/` : 'assets/';
      if (!assetPath.startsWith(prefix)) return null;
      relativePath = dir ? assetPath.slice(dir.length + 1) : assetPath;
    }
    const resolved = resolveLocalMarkdownAssetReference(markdown, relativePath, getContentRootSafe());
    if (!resolved) return null;
    if (assetPath && assetPath !== resolved.contentPath) return null;
    return {
      kind: 'asset',
      category: 'content-asset',
      label: resolved.relativePath || asset.label || resolved.contentPath,
      path: resolved.contentPath,
      markdownPath: markdown,
      assetPath: resolved.contentPath,
      assetRelativePath: resolved.relativePath || '',
      state: 'deleted',
      deleted: true
    };
  }

  function importMarkdownAssetsForPath(path, assets = []) {
    const bucket = ensureMarkdownAssetBucket(path);
    if (!bucket) return null;
    bucket.clear();
    if (Array.isArray(assets)) {
      assets.forEach((entry) => {
        const normalized = normalizeAssetDescriptor(entry, path);
        if (normalized) bucket.set(normalized.path, normalized);
      });
    }
    broadcastMarkdownAssetPreview(path);
    return bucket;
  }

  function exportMarkdownAssetBucket(path) {
    const bucket = getMarkdownAssetBucket(path);
    if (!bucket || !bucket.size) return [];
    return Array.from(bucket.values()).map((asset) => ({
      path: asset.path,
      relativePath: asset.relativePath,
      base64: asset.base64,
      mime: asset.mime,
      size: asset.size,
      fileName: asset.fileName,
      originalName: asset.originalName,
      addedAt: asset.addedAt
    }));
  }

  function ensureMarkdownDeletedAssetBucket(path) {
    const norm = normalizeRelPath(path);
    if (!norm) return null;
    let bucket = markdownDeletedAssetStore.get(norm);
    if (!bucket) {
      bucket = new Map();
      markdownDeletedAssetStore.set(norm, bucket);
    }
    return bucket;
  }

  function importMarkdownAssetDeletionsForPath(path, deletedAssets = []) {
    const bucket = ensureMarkdownDeletedAssetBucket(path);
    if (!bucket) return null;
    bucket.clear();
    if (Array.isArray(deletedAssets)) {
      deletedAssets.forEach((entry) => {
        const normalized = normalizeAssetDeletionDescriptor(entry, path);
        if (normalized) bucket.set(normalized.assetPath, normalized);
      });
    }
    return bucket;
  }

  function exportMarkdownAssetDeletionBucket(path) {
    const bucket = markdownDeletedAssetStore.get(normalizeRelPath(path));
    if (!bucket || !bucket.size) return [];
    return Array.from(bucket.values()).map((asset) => ({
      path: asset.assetPath || asset.path,
      relativePath: asset.assetRelativePath || '',
      label: asset.label || asset.assetPath || asset.path,
      state: 'deleted',
      deleted: true
    }));
  }

  function updateMarkdownDraftStoreAssets(path, assets = []) {
    const norm = normalizeRelPath(path);
    if (!norm) return;
    const store = readMarkdownDraftStore();
    const entry = store[norm];
    if (!entry || typeof entry !== 'object') return;
    const list = Array.isArray(assets) ? assets.filter(item => item && item.path && item.base64) : [];
    if (list.length) entry.assets = list;
    else delete entry.assets;
    store[norm] = entry;
    writeMarkdownDraftStore(store);
  }

  function updateMarkdownDraftStoreAssetDeletions(path, deletedAssets = []) {
    const norm = normalizeRelPath(path);
    if (!norm) return;
    const store = readMarkdownDraftStore();
    const entry = (store[norm] && typeof store[norm] === 'object') ? store[norm] : {};
    const list = Array.isArray(deletedAssets)
      ? deletedAssets.map(item => normalizeAssetDeletionDescriptor(item, norm)).filter(Boolean)
      : [];
    if (list.length) {
      entry.deletedAssets = list;
      if (!entry.savedAt) entry.savedAt = Date.now();
    } else {
      delete entry.deletedAssets;
    }
    const hasContent = entry.content != null && normalizeMarkdownContent(entry.content);
    const hasAssets = Array.isArray(entry.assets) && entry.assets.length;
    const hasDeletedAssets = Array.isArray(entry.deletedAssets) && entry.deletedAssets.length;
    if (!hasContent && !hasAssets && !hasDeletedAssets) delete store[norm];
    else store[norm] = entry;
    writeMarkdownDraftStore(store);
  }

  function clearMarkdownAssetDeletionsForPath(path) {
    const norm = normalizeRelPath(path);
    if (!norm) return;
    const bucket = markdownDeletedAssetStore.get(norm);
    if (bucket) bucket.clear();
    markdownDeletedAssetStore.delete(norm);
    updateMarkdownDraftStoreAssetDeletions(norm, []);
  }

  function clearMarkdownAssetsForPath(path) {
    const norm = normalizeRelPath(path);
    if (!norm) return;
    const bucket = markdownAssetStore.get(norm);
    if (bucket) bucket.clear();
    markdownAssetStore.delete(norm);
    clearMarkdownAssetDeletionsForPath(norm);
    updateMarkdownDraftStoreAssets(norm, []);
    broadcastMarkdownAssetPreview(norm);
  }

  function removeMarkdownAsset(path, assetPath) {
    const norm = normalizeRelPath(path);
    const assetKey = normalizeRelPath(assetPath);
    if (!norm || !assetKey) return;
    const bucket = markdownAssetStore.get(norm);
    if (!bucket || !bucket.has(assetKey)) return;
    bucket.delete(assetKey);
    if (!bucket.size) markdownAssetStore.delete(norm);
    updateMarkdownDraftStoreAssets(norm, exportMarkdownAssetBucket(norm));
    broadcastMarkdownAssetPreview(norm);
  }

  function removeMarkdownAssetDeletion(path, assetPath) {
    const norm = normalizeRelPath(path);
    const assetKey = normalizeRelPath(assetPath);
    if (!norm || !assetKey) return;
    const bucket = markdownDeletedAssetStore.get(norm);
    if (!bucket || !bucket.has(assetKey)) return;
    bucket.delete(assetKey);
    if (!bucket.size) markdownDeletedAssetStore.delete(norm);
    updateMarkdownDraftStoreAssetDeletions(norm, exportMarkdownAssetDeletionBucket(norm));
  }

  function stageMarkdownAssetDeletion(path, resolved) {
    const norm = normalizeRelPath(path);
    const assetPath = normalizeRelPath(resolved.contentPath);
    if (!norm || !assetPath) return null;
    const pendingBucket = getMarkdownAssetBucket(norm);
    if (pendingBucket && pendingBucket.has(assetPath)) {
      removeMarkdownAsset(norm, assetPath);
      removeMarkdownAssetDeletion(norm, assetPath);
      updateMarkdownDraftStoreAssetDeletions(norm, exportMarkdownAssetDeletionBucket(norm));
      return { pendingOnly: true, assetPath };
    }
    const bucket = ensureMarkdownDeletedAssetBucket(norm);
    if (!bucket) return null;
    const entry = {
      kind: 'asset',
      category: 'content-asset',
      label: resolved.relativePath || assetPath,
      path: assetPath,
      markdownPath: norm,
      assetPath,
      assetRelativePath: resolved.relativePath || '',
      state: 'deleted',
      deleted: true
    };
    bucket.set(assetPath, entry);
    updateMarkdownDraftStoreAssetDeletions(norm, exportMarkdownAssetDeletionBucket(norm));
    return entry;
  }

  function listMarkdownAssetDeletions(path = '') {
    const norm = normalizeRelPath(path);
    const buckets = norm
      ? [[norm, markdownDeletedAssetStore.get(norm)]]
      : Array.from(markdownDeletedAssetStore.entries());
    const out = [];
    buckets.forEach(([, bucket]) => {
      if (!bucket || !bucket.size) return;
      bucket.forEach((entry) => {
        if (entry && entry.path && entry.deleted) out.push(entry);
      });
    });
    out.sort((a, b) => String(a.path || '').localeCompare(String(b.path || '')));
    return out;
  }

  function countMarkdownAssetDeletions(path) {
    return listMarkdownAssetDeletions(path).length;
  }

  function listMarkdownAssets(path) {
    const bucket = getMarkdownAssetBucket(path);
    if (!bucket || !bucket.size) return [];
    return Array.from(bucket.values());
  }

  function countMarkdownAssets(path) {
    const bucket = getMarkdownAssetBucket(path);
    if (bucket && bucket.size) return bucket.size;
    const entry = getMarkdownDraftEntry(path);
    if (entry && Array.isArray(entry.assets)) return entry.assets.length;
    return 0;
  }

  function isAssetReferencedInContent(content, asset) {
    if (!asset || !asset.relativePath) return false;
    const text = String(content || '');
    if (!text) return false;
    const rel = asset.relativePath;
    if (text.includes(rel)) return true;
    if (!rel.startsWith('./') && text.includes(`./${rel}`)) return true;
    return false;
  }

  function textWithFallback(key, fallback, params) {
    try {
      const translated = translate(key, params);
      if (translated && translated !== key) return translated;
    } catch (_) {}
    return fallback;
  }

  function draftHasAssetDeletions(draft) {
    return !!(draft && Array.isArray(draft.deletedAssets) && draft.deletedAssets.length);
  }

  function knownMarkdownTextForAssetScan(tab, activeTab, activeValue) {
    if (!tab) return '';
    if (tab === activeTab && activeValue != null) return normalizeMarkdownContent(activeValue);
    if (tab.content != null && tab.content !== undefined) return normalizeMarkdownContent(tab.content);
    if (tab.localDraft && tab.localDraft.content != null) return normalizeMarkdownContent(tab.localDraft.content);
    return '';
  }

  function countKnownMarkdownAssetReferences(assetPath, ownerPath) {
    const normalizedAsset = normalizeRelPath(assetPath);
    const owner = normalizeRelPath(ownerPath);
    const contentRoot = getContentRootSafe();
    const counts = { owner: 0, others: 0 };
    if (!normalizedAsset) return counts;
    const seen = new Set();
    let activeTab = null;
    let activeValue = null;
    try {
      activeTab = getActiveDynamicTab();
      const editorApi = getPrimaryEditorApi();
      if (activeTab && editorApi && typeof editorApi.getValue === 'function') {
        activeValue = String(editorApi.getValue() || '');
      }
    } catch (_) {}
    const dynamicEditorTabs = getDynamicEditorTabs();
    if (dynamicEditorTabs && typeof dynamicEditorTabs.forEach === 'function') {
      dynamicEditorTabs.forEach((tab) => {
        const path = normalizeRelPath(tab && tab.path);
        if (!path || seen.has(path)) return;
        seen.add(path);
        const content = knownMarkdownTextForAssetScan(tab, activeTab, activeValue);
        if (!content) return;
        const refs = listLocalMarkdownAssetReferences(content, path, contentRoot)
          .filter(ref => ref && ref.contentPath === normalizedAsset);
        if (!refs.length) return;
        if (path === owner) counts.owner += refs.length;
        else counts.others += refs.length;
      });
    }
    const store = readMarkdownDraftStore();
    if (store && typeof store === 'object') {
      Object.keys(store).forEach((key) => {
        const path = normalizeRelPath(key);
        if (!path || seen.has(path)) return;
        const entry = store[key];
        if (!entry || typeof entry !== 'object') return;
        const content = entry.content != null ? normalizeMarkdownContent(entry.content) : '';
        if (!content && !draftHasAssetDeletions(entry)) return;
        seen.add(path);
        if (!content) return;
        const refs = listLocalMarkdownAssetReferences(content, path, contentRoot)
          .filter(ref => ref && ref.contentPath === normalizedAsset);
        if (!refs.length) return;
        if (path === owner) counts.owner += refs.length;
        else counts.others += refs.length;
      });
    }
    return counts;
  }

  function collectKnownCurrentMarkdownAssetReferenceData(options = {}) {
    const refs = new Set();
    const contentRoot = getContentRootSafe();
    const excluded = new Set((Array.isArray(options.excludeMarkdownPaths) ? options.excludeMarkdownPaths : [])
      .map(path => normalizeRelPath(path))
      .filter(Boolean));
    const seen = new Set();
    let activeTab = null;
    let activeValue = null;
    try {
      activeTab = getActiveDynamicTab();
      const editorApi = getPrimaryEditorApi();
      if (activeTab && editorApi && typeof editorApi.getValue === 'function') {
        activeValue = String(editorApi.getValue() || '');
      }
    } catch (_) {}
    const dynamicEditorTabs = getDynamicEditorTabs();
    if (dynamicEditorTabs && typeof dynamicEditorTabs.forEach === 'function') {
      dynamicEditorTabs.forEach((tab) => {
        const path = normalizeRelPath(tab && tab.path);
        if (!path || excluded.has(path) || seen.has(path)) return;
        const content = knownMarkdownTextForAssetScan(tab, activeTab, activeValue);
        const deletionOnlyDraft = !content && tab && tab.localDraft && draftHasAssetDeletions(tab.localDraft);
        if (!content && !deletionOnlyDraft) return;
        seen.add(path);
        if (content) collectLocalMarkdownAssetReferences(content, path, contentRoot).forEach(ref => refs.add(ref));
      });
    }
    const store = readMarkdownDraftStore();
    if (store && typeof store === 'object') {
      Object.keys(store).forEach((key) => {
        const path = normalizeRelPath(key);
        if (!path || excluded.has(path) || seen.has(path)) return;
        const entry = store[key];
        if (!entry || typeof entry !== 'object') return;
        const content = entry.content != null ? normalizeMarkdownContent(entry.content) : '';
        if (!content && !draftHasAssetDeletions(entry)) return;
        seen.add(path);
        if (!content) return;
        collectLocalMarkdownAssetReferences(content, path, contentRoot).forEach(ref => refs.add(ref));
      });
    }
    return { refs, seen };
  }

  function currentManagedMarkdownPathsForAssetScan(contentRoot = 'wwwroot') {
    const refs = collectManagedMarkdownReferences({
      index: getStateSlice('index') || { __order: [] },
      tabs: getStateSlice('tabs') || { __order: [] },
      contentRoot
    });
    return Array.from(refs).sort((a, b) => a.localeCompare(b));
  }

  async function fetchMarkdownForAssetScan(contentPath, contentRoot = 'wwwroot') {
    const rel = normalizeRelPath(contentPath);
    if (!rel) return { text: '', failed: true };
    const root = String(contentRoot || '').replace(/[\\]/g, '/').replace(/^\/+|\/+$/g, '') || 'wwwroot';
    const path = `${root}/${rel}`.replace(/\/+/g, '/');
    const fetchFn = windowRef && typeof windowRef.fetch === 'function'
      ? windowRef.fetch.bind(windowRef)
      : (typeof fetch === 'function' ? fetch : null);
    if (!fetchFn) return { text: '', failed: true };
    try {
      const resp = await fetchFn(`${path}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!resp.ok) return { text: '', failed: true };
      return { text: normalizeMarkdownContent(await resp.text()), failed: false };
    } catch (_) {
      return { text: '', failed: true };
    }
  }

  async function collectCurrentRepositoryMarkdownAssetReferences(options = {}) {
    const currentRoot = options.currentContentRoot || getContentRootSafe();
    const excluded = new Set((Array.isArray(options.excludeMarkdownPaths) ? options.excludeMarkdownPaths : [])
      .map(path => normalizeRelPath(path))
      .filter(Boolean));
    const data = collectKnownCurrentMarkdownAssetReferenceData({ excludeMarkdownPaths: Array.from(excluded) });
    const refs = data.refs;
    const failures = [];
    for (const markdownPath of currentManagedMarkdownPathsForAssetScan(currentRoot)) {
      const norm = normalizeRelPath(markdownPath);
      if (!norm || excluded.has(norm) || data.seen.has(norm)) continue;
      const result = await fetchMarkdownForAssetScan(norm, currentRoot);
      if (result.failed) {
        failures.push(norm);
        continue;
      }
      collectLocalMarkdownAssetReferences(result.text, norm, currentRoot).forEach(ref => refs.add(ref));
    }
    return { refs, failures };
  }

  function rejectAssetDeleteRequest(event, detail, message) {
    if (detail && typeof detail === 'object') {
      detail.rejected = true;
      detail.message = message;
    }
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
  }

  function handleEditorToastEvent(event) {
    if (!event || !event.detail) return;
    const detail = event.detail;
    const message = detail && detail.message ? String(detail.message) : '';
    if (!message) return;
    const kind = detail && detail.kind ? String(detail.kind) : 'info';
    showToast(kind, message);
  }

  function handleEditorAssetAdded(event) {
    if (!event || !event.detail) return;
    const detail = event.detail;
    const markdownPath = normalizeRelPath(detail.markdownPath || '');
    if (!markdownPath) {
      showToast('warn', translate('editor.toasts.markdownOpenBeforeInsert'));
      return;
    }
    const commitPath = normalizeRelPath(detail.commitPath || detail.assetPath || '');
    const base64 = typeof detail.base64 === 'string' ? detail.base64.trim() : '';
    if (!commitPath || !base64) return;
    const descriptor = normalizeAssetDescriptor({
      path: commitPath,
      relativePath: detail.relativePath || '',
      base64,
      mime: detail.mime || '',
      size: detail.size,
      fileName: detail.fileName || '',
      originalName: detail.originalName || '',
      addedAt: Date.now(),
      markdownPath
    }, markdownPath);
    if (!descriptor) return;
    const bucket = ensureMarkdownAssetBucket(markdownPath);
    bucket.set(descriptor.path, descriptor);
    removeMarkdownAssetDeletion(markdownPath, descriptor.path);
    updateMarkdownDraftStoreAssets(markdownPath, exportMarkdownAssetBucket(markdownPath));
    broadcastMarkdownAssetPreview(markdownPath);
    const tab = findDynamicTabByPath(markdownPath);
    if (tab) {
      tab.pendingAssets = bucket;
      try { scheduleMarkdownDraftSave(tab); }
      catch (_) {}
    }
    const relLabel = descriptor.relativePath || descriptor.path;
    if (!detail.silent) showToast('success', translate('editor.toasts.assetAttached', { label: relLabel }));
    try { updateUnsyncedSummary(); }
    catch (_) {}
  }

  function handleEditorAssetDeleteRequested(event) {
    if (!event || !event.detail) return;
    const detail = event.detail;
    const markdownPath = normalizeRelPath(detail.markdownPath || '');
    const source = detail.src || detail.relativePath || '';
    const resolved = resolveLocalMarkdownAssetReference(markdownPath, source, getContentRootSafe());
    if (!markdownPath || !resolved) {
      rejectAssetDeleteRequest(event, detail, textWithFallback(
        'editor.toasts.assetDeleteUnsupported',
        'Only local assets next to the current Markdown file can be deleted.'
      ));
      return;
    }
    const counts = countKnownMarkdownAssetReferences(resolved.contentPath, markdownPath);
    if (counts.others > 0 || counts.owner > 1) {
      rejectAssetDeleteRequest(event, detail, textWithFallback(
        'editor.toasts.assetDeleteShared',
        'This image resource is still referenced by another known Markdown document or another image block.'
      ));
      return;
    }
    const staged = stageMarkdownAssetDeletion(markdownPath, resolved);
    if (!staged) {
      rejectAssetDeleteRequest(event, detail, textWithFallback(
        'editor.toasts.assetDeleteRejected',
        'This image resource cannot be deleted yet.'
      ));
      return;
    }
    detail.assetPath = resolved.contentPath;
    detail.commitPath = resolved.commitPath;
    detail.relativePath = resolved.relativePath;
    const label = resolved.relativePath || resolved.contentPath;
    if (staged.pendingOnly) {
      showToast('info', textWithFallback('editor.toasts.assetPendingRemoved', `Removed pending image asset ${label}.`, { label }));
    } else {
      showToast('success', textWithFallback('editor.toasts.assetDeleteStaged', `Staged ${label} for deletion.`, { label }));
    }
    try { updateUnsyncedSummary(); }
    catch (_) {}
  }

  function handleEditorAssetDeleteCanceled(event) {
    if (!event || !event.detail) return;
    const detail = event.detail;
    removeMarkdownAssetDeletion(detail.markdownPath || '', detail.assetPath || '');
    try { updateUnsyncedSummary(); }
    catch (_) {}
  }

  function bindEditorAssetEvents() {
    if (!windowRef || typeof windowRef.addEventListener !== 'function') {
      return () => {};
    }
    const listeners = [
      ['press-editor-toast', handleEditorToastEvent],
      ['press-editor-asset-added', handleEditorAssetAdded],
      ['press-editor-asset-delete-requested', handleEditorAssetDeleteRequested],
      ['press-editor-asset-delete-canceled', handleEditorAssetDeleteCanceled]
    ];
    try {
      listeners.forEach(([type, handler]) => windowRef.addEventListener(type, handler));
    } catch (_) {
      return () => {};
    }
    return () => {
      if (typeof windowRef.removeEventListener !== 'function') return;
      listeners.forEach(([type, handler]) => {
        try { windowRef.removeEventListener(type, handler); }
        catch (_) {}
      });
    };
  }

  const dispose = bindEditorAssetEvents();

  return {
    dispose,
    ensureMarkdownAssetBucket,
    normalizeAssetDescriptor,
    normalizeAssetDeletionDescriptor,
    importMarkdownAssetsForPath,
    exportMarkdownAssetBucket,
    importMarkdownAssetDeletionsForPath,
    exportMarkdownAssetDeletionBucket,
    clearMarkdownAssetsForPath,
    removeMarkdownAsset,
    removeMarkdownAssetDeletion,
    listMarkdownAssetDeletions,
    countMarkdownAssetDeletions,
    listMarkdownAssets,
    countMarkdownAssets,
    isAssetReferencedInContent,
    textWithFallback,
    draftHasAssetDeletions,
    collectCurrentRepositoryMarkdownAssetReferences
  };
}
