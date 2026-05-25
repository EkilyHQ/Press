export function createComposerUnsyncedSummaryController(options = {}) {
  const documentRef = options.documentRef || null;
  const getDynamicEditorTabs = typeof options.getDynamicEditorTabs === 'function' ? options.getDynamicEditorTabs : (() => new Map());
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : ((value) => String(value || '').trim());
  const normalizeMarkdownContent = typeof options.normalizeMarkdownContent === 'function' ? options.normalizeMarkdownContent : ((value) => String(value || ''));
  const hasMarkdownDraftContent = typeof options.hasMarkdownDraftContent === 'function' ? options.hasMarkdownDraftContent : (() => false);
  const readMarkdownDraftStore = typeof options.readMarkdownDraftStore === 'function' ? options.readMarkdownDraftStore : (() => ({}));
  const importMarkdownAssetsForPath = typeof options.importMarkdownAssetsForPath === 'function' ? options.importMarkdownAssetsForPath : (() => {});
  const importMarkdownAssetDeletionsForPath = typeof options.importMarkdownAssetDeletionsForPath === 'function' ? options.importMarkdownAssetDeletionsForPath : (() => {});
  const countMarkdownAssets = typeof options.countMarkdownAssets === 'function' ? options.countMarkdownAssets : (() => 0);
  const countMarkdownAssetDeletions = typeof options.countMarkdownAssetDeletions === 'function' ? options.countMarkdownAssetDeletions : (() => 0);
  const listMarkdownAssetDeletions = typeof options.listMarkdownAssetDeletions === 'function' ? options.listMarkdownAssetDeletions : (() => []);
  const getComposerDiffCache = typeof options.getComposerDiffCache === 'function' ? options.getComposerDiffCache : (() => ({}));
  const getStagingSummaryEntries = typeof options.getStagingSummaryEntries === 'function' ? options.getStagingSummaryEntries : (() => []);
  const getActiveComposerFile = typeof options.getActiveComposerFile === 'function' ? options.getActiveComposerFile : (() => 'index');
  const getComposerDraftMeta = typeof options.getComposerDraftMeta === 'function' ? options.getComposerDraftMeta : (() => null);
  const hasUnsavedComposerChanges = typeof options.hasUnsavedComposerChanges === 'function' ? options.hasUnsavedComposerChanges : (() => false);
  const hasAnyComposerDraftMeta = typeof options.hasAnyComposerDraftMeta === 'function' ? options.hasAnyComposerDraftMeta : (() => false);
  const hasUnsavedMarkdownDrafts = typeof options.hasUnsavedMarkdownDrafts === 'function' ? options.hasUnsavedMarkdownDrafts : (() => false);
  const refreshEditorContentTree = typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : (() => {});
  const shouldPreserveEditorStructure = typeof options.shouldPreserveEditorStructure === 'function' ? options.shouldPreserveEditorStructure : (() => false);
  const refreshComposerInlineMeta = typeof options.refreshComposerInlineMeta === 'function' ? options.refreshComposerInlineMeta : (() => {});
  const scheduleSyncCommitPanelRefresh = typeof options.scheduleSyncCommitPanelRefresh === 'function' ? options.scheduleSyncCommitPanelRefresh : (() => {});

  function collectUnsyncedMarkdownEntries() {
    const entries = [];
    const seen = new Set();

    getDynamicEditorTabs().forEach((tab) => {
      if (!tab || !tab.path) return;
      const path = normalizeRelPath(tab.path);
      if (!path || seen.has(path)) return;
      const hasDraftContent = hasMarkdownDraftContent(tab);
      const hasDirtyChanges = !!tab.isDirty;
      const assetDeletionCount = countMarkdownAssetDeletions(path);
      if (!hasDirtyChanges && !hasDraftContent && !assetDeletionCount) return;
      let state = '';
      if (tab.draftConflict) state = 'conflict';
      else if (hasDirtyChanges) state = 'dirty';
      else if (hasDraftContent) state = 'saved';
      const entry = {
        kind: 'markdown',
        label: path,
        path,
        state,
      };
      const assetCount = countMarkdownAssets(path);
      if (assetCount) entry.assetCount = assetCount;
      if (assetDeletionCount) entry.assetDeletionCount = assetDeletionCount;
      entries.push(entry);
      seen.add(path);
    });

    const store = readMarkdownDraftStore();
    if (store && typeof store === 'object') {
      Object.keys(store).forEach((key) => {
        const path = normalizeRelPath(key);
        if (!path || seen.has(path)) return;
        const entry = store[key];
        if (!entry || typeof entry !== 'object') return;
        const content = entry.content != null ? normalizeMarkdownContent(entry.content) : '';
        importMarkdownAssetsForPath(path, entry.assets || []);
        importMarkdownAssetDeletionsForPath(path, entry.deletedAssets || []);
        const assetDeletionCount = countMarkdownAssetDeletions(path);
        if (!content && !assetDeletionCount) return;
        const item = {
          kind: 'markdown',
          label: path,
          path,
          state: 'saved',
        };
        const assetCount = countMarkdownAssets(path);
        if (assetCount) item.assetCount = assetCount;
        if (assetDeletionCount) item.assetDeletionCount = assetDeletionCount;
        entries.push(item);
        seen.add(path);
      });
    }

    entries.sort((a, b) => {
      try { return a.label.localeCompare(b.label); }
      catch (_) { return 0; }
    });
    return entries;
  }

  function computeUnsyncedSummary() {
    const entries = [];
    const diffCache = getComposerDiffCache() || {};
    const indexDiff = diffCache.index;
    const tabsDiff = diffCache.tabs;
    const siteDiff = diffCache.site;
    if (indexDiff && indexDiff.hasChanges) {
      entries.push({
        kind: 'index',
        label: 'index.yaml',
        hasOrderChange: !!indexDiff.orderChanged,
        hasContentChange: Object.keys(indexDiff.keys || {}).length > 0
          || indexDiff.addedKeys.length > 0
          || indexDiff.removedKeys.length > 0
      });
    }
    if (tabsDiff && tabsDiff.hasChanges) {
      entries.push({
        kind: 'tabs',
        label: 'tabs.yaml',
        hasOrderChange: !!tabsDiff.orderChanged,
        hasContentChange: Object.keys(tabsDiff.keys || {}).length > 0
          || tabsDiff.addedKeys.length > 0
          || tabsDiff.removedKeys.length > 0
      });
    }
    if (siteDiff && siteDiff.hasChanges) {
      entries.push({
        kind: 'site',
        label: 'site.yaml',
        hasContentChange: true
      });
    }
    entries.push(...getStagingSummaryEntries());
    const markdownEntries = collectUnsyncedMarkdownEntries();
    if (markdownEntries.length) entries.push(...markdownEntries);
    const assetDeletionEntries = listMarkdownAssetDeletions();
    if (assetDeletionEntries.length) entries.push(...assetDeletionEntries);
    return entries;
  }

  function getModeTabButton(mode) {
    try {
      return documentRef ? documentRef.querySelector(`.mode-tab[data-mode="${mode}"]:not(.dynamic-mode)`) : null;
    } catch (_) {
      return null;
    }
  }

  function getModeTabBaseLabel(btn) {
    if (!btn) return '';
    if (btn.dataset && btn.dataset.tabLabel) return btn.dataset.tabLabel;
    const attr = btn.getAttribute('data-tab-label');
    if (attr) {
      const trimmed = attr.trim();
      if (btn.dataset) btn.dataset.tabLabel = trimmed;
      return trimmed;
    }
    if (btn.dataset && btn.dataset.baseLabel) return btn.dataset.baseLabel;
    const fallback = (btn.textContent || '').trim();
    if (fallback) {
      if (btn.dataset) btn.dataset.baseLabel = fallback;
      return fallback;
    }
    const mode = (btn.getAttribute('data-mode') || '').trim();
    if (!mode) return '';
    const formatted = mode.charAt(0).toUpperCase() + mode.slice(1);
    if (btn.dataset) btn.dataset.baseLabel = formatted;
    return formatted;
  }

  function ensureModeTabBadgeElement(btn) {
    if (!btn) return null;
    let badge = btn.querySelector('.mode-tab-badge');
    if (!badge && documentRef) {
      badge = documentRef.createElement('span');
      badge.className = 'mode-tab-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.hidden = true;
      btn.appendChild(badge);
    }
    return badge;
  }

  function applyModeTabBadgeState(mode, count) {
    const btn = getModeTabButton(mode);
    if (!btn) return;
    const baseLabel = getModeTabBaseLabel(btn);
    const badge = ensureModeTabBadgeElement(btn);
    if (baseLabel && btn.dataset) btn.dataset.tabLabel = baseLabel;

    let numericCount = 0;
    if (typeof count === 'number' && Number.isFinite(count)) {
      numericCount = Math.max(0, Math.floor(count));
    } else {
      const parsed = parseInt(count, 10);
      numericCount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    }

    if (numericCount > 0) {
      const displayValue = numericCount > 99 ? '99+' : String(numericCount);
      if (badge) {
        badge.textContent = displayValue;
        badge.hidden = false;
      }
      btn.setAttribute('data-dirty', '1');
      if (btn.dataset) btn.dataset.badgeCount = String(numericCount);
      if (baseLabel) {
        const accessibleCount = numericCount > 99 ? 'more than 99' : String(numericCount);
        const changeLabel = numericCount === 1 ? 'pending change' : 'pending changes';
        btn.setAttribute('aria-label', `${baseLabel} (${accessibleCount} ${changeLabel})`);
      }
    } else {
      if (badge) {
        badge.hidden = true;
        badge.textContent = '';
      }
      btn.removeAttribute('data-dirty');
      if (btn.dataset) delete btn.dataset.badgeCount;
      if (baseLabel) {
        btn.setAttribute('aria-label', baseLabel);
      } else {
        btn.removeAttribute('aria-label');
      }
    }
  }

  function updateModeDirtyIndicators(summaryEntries) {
    let entries = Array.isArray(summaryEntries) ? summaryEntries : null;
    if (!entries) {
      if (summaryEntries && typeof summaryEntries === 'object') entries = [summaryEntries];
      else {
        try { entries = computeUnsyncedSummary(); }
        catch (_) { entries = []; }
      }
    }

    let composerCount = 0;
    let editorCount = 0;
    let updatesCount = 0;
    let themesCount = 0;

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.kind === 'index' || entry.kind === 'tabs' || entry.kind === 'site') composerCount += 1;
      else if (entry.kind === 'markdown') editorCount += 1;
      else if (entry.kind === 'system' && entry.category === 'theme') themesCount += 1;
      else if (entry.kind === 'system') updatesCount += 1;
    }

    if (!composerCount) {
      try {
        if (hasUnsavedComposerChanges()) composerCount = Math.max(composerCount, 1);
        else if (hasAnyComposerDraftMeta()) composerCount = Math.max(composerCount, 1);
      } catch (_) { /* ignore */ }
    }

    if (!editorCount && !Array.isArray(summaryEntries)) {
      try {
        if (hasUnsavedMarkdownDrafts()) editorCount = Math.max(editorCount, 1);
      } catch (_) { editorCount = 0; }
    }

    applyModeTabBadgeState('composer', composerCount);
    applyModeTabBadgeState('editor', editorCount);
    applyModeTabBadgeState('themes', themesCount);
    applyModeTabBadgeState('updates', updatesCount);
    try {
      refreshEditorContentTree({ preserveStructure: shouldPreserveEditorStructure() });
    } catch (_) {}
  }

  function updateReviewButton(summaryEntries = []) {
    const btn = documentRef ? documentRef.getElementById('btnReview') : null;
    if (!btn) return;
    const activeKind = getActiveComposerFile();
    const normalizedKind = activeKind === 'tabs' ? 'tabs' : (activeKind === 'site' ? 'site' : 'index');
    if (normalizedKind === 'site') {
      btn.hidden = true;
      btn.style.display = 'none';
      btn.removeAttribute('data-kind');
      btn.setAttribute('aria-hidden', 'true');
      btn.removeAttribute('title');
      btn.removeAttribute('aria-label');
      return;
    }
    const targetEntry = summaryEntries.find(entry => entry && entry.kind === normalizedKind);
    if (targetEntry) {
      btn.hidden = false;
      btn.style.display = '';
      btn.dataset.kind = targetEntry.kind === 'tabs' ? 'tabs' : 'index';
      btn.setAttribute('aria-hidden', 'false');
      const label = targetEntry.label || (targetEntry.kind === 'tabs' ? 'tabs.yaml' : 'index.yaml');
      const description = `Review changes for ${label}`;
      btn.setAttribute('aria-label', description);
      btn.title = description;
    } else {
      btn.hidden = true;
      btn.style.display = 'none';
      btn.removeAttribute('data-kind');
      btn.setAttribute('aria-hidden', 'true');
      btn.removeAttribute('title');
      btn.removeAttribute('aria-label');
    }
  }

  function updateDiscardButtonVisibility() {
    const btn = documentRef ? documentRef.getElementById('btnDiscard') : null;
    if (!btn) return;
    const activeKind = getActiveComposerFile();
    const normalizedKind = activeKind === 'tabs' ? 'tabs' : activeKind === 'site' ? 'site' : 'index';
    const diff = (getComposerDiffCache() || {})[normalizedKind];
    const meta = getComposerDraftMeta(normalizedKind);
    const hasLocalChanges = !!(diff && diff.hasChanges);
    const hasDraft = !!meta;
    const shouldShow = hasLocalChanges || hasDraft;
    btn.hidden = !shouldShow;
    btn.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
    btn.style.display = shouldShow ? '' : 'none';
  }

  function updateUnsyncedSummary(updateOptions = {}) {
    const summaryEntries = computeUnsyncedSummary();
    updateDiscardButtonVisibility();
    updateReviewButton(summaryEntries.length ? summaryEntries : []);
    updateModeDirtyIndicators(summaryEntries);
    refreshComposerInlineMeta(updateOptions);
    scheduleSyncCommitPanelRefresh();
    return summaryEntries;
  }

  return {
    collectUnsyncedMarkdownEntries,
    computeUnsyncedSummary,
    updateModeDirtyIndicators,
    updateUnsyncedSummary
  };
}
