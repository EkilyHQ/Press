import { buildEditorContentTree } from './editor-content-tree.js';

export function createComposerEditorTreeState(options = {}) {
  const preferredLangs = Array.isArray(options.preferredLangs) ? options.preferredLangs : [];
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : value => String(value || '').trim();
  const treeText = typeof options.treeText === 'function' ? options.treeText : (_key, fallback) => fallback;
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => null;
  const readMarkdownDraftStore = typeof options.readMarkdownDraftStore === 'function' ? options.readMarkdownDraftStore : () => ({});
  const collectDynamicMarkdownDraftStates = typeof options.collectDynamicMarkdownDraftStates === 'function' ? options.collectDynamicMarkdownDraftStates : () => new Map();
  const getMarkdownSessionController = typeof options.getMarkdownSessionController === 'function' ? options.getMarkdownSessionController : () => null;
  const getComposerDiff = typeof options.getComposerDiff === 'function' ? options.getComposerDiff : () => null;
  const getRemoteBaseline = typeof options.getRemoteBaseline === 'function' ? options.getRemoteBaseline : () => null;
  const recomputeDiff = typeof options.recomputeDiff === 'function' ? options.recomputeDiff : () => null;
  const getComposerDraftMeta = typeof options.getComposerDraftMeta === 'function' ? options.getComposerDraftMeta : () => null;
  const hasSystemUpdateEntries = typeof options.hasSystemUpdateEntries === 'function' ? options.hasSystemUpdateEntries : () => false;
  const hasThemeEntries = typeof options.hasThemeEntries === 'function' ? options.hasThemeEntries : () => false;

  function collectEditorDraftStatusMap() {
    const map = new Map();
    try {
      const store = readMarkdownDraftStore();
      Object.keys(store || {}).forEach((key) => {
        const path = normalizeRelPath(key);
        if (path && store[key] && store[key].content) map.set(path, 'saved');
      });
    } catch (_) {}
    try {
      collectDynamicMarkdownDraftStates().forEach((value, key) => {
        if (key && value) map.set(key, value);
      });
    } catch (_) {}
    return map;
  }

  function collectEditorFileStatusMap() {
    const controller = getMarkdownSessionController();
    return controller && typeof controller.collectFileStatusMap === 'function'
      ? controller.collectFileStatusMap()
      : new Map();
  }

  function collectEditorDiffStatusMap() {
    const map = new Map();
    const add = (id, value) => {
      if (id && value) map.set(id, value);
    };
    const applyDiff = (source, diff) => {
      if (!diff) return;
      (diff.addedKeys || []).forEach(key => add(`${source}:${key}`, 'added'));
      (diff.removedKeys || []).forEach(key => add(`${source}:${key}`, 'removed'));
      Object.keys(diff.keys || {}).forEach((key) => {
        const info = diff.keys[key] || {};
        add(`${source}:${key}`, info.state || 'modified');
        Object.keys(info.langs || {}).forEach((lang) => {
          const detail = info.langs[lang] || {};
          add(`${source}:${key}:${lang}`, detail.state || 'modified');
        });
      });
    };
    applyDiff('index', getComposerDiff('index'));
    applyDiff('tabs', getComposerDiff('tabs'));
    try {
      const siteDiff = getComposerDiff('site') || recomputeDiff('site');
      if (siteDiff && siteDiff.hasChanges) add('system:site-settings', 'modified');
      else if (getComposerDraftMeta('site')) add('system:site-settings', 'saved');
    } catch (_) {
      try {
        if (getComposerDraftMeta('site')) add('system:site-settings', 'saved');
      } catch (__) {}
    }
    try {
      if (hasSystemUpdateEntries()) add('system:updates', 'modified');
    } catch (_) {}
    try {
      if (hasThemeEntries()) add('system:themes', 'modified');
    } catch (_) {}
    return map;
  }

  function buildCurrentEditorTree() {
    return buildEditorContentTree({
      index: getStateSlice('index') || { __order: [] },
      tabs: getStateSlice('tabs') || { __order: [] }
    }, {
      preferredLangs,
      welcomeLabel: treeText('welcome', 'Welcome'),
      systemLabel: treeText('system', 'System'),
      siteSettingsLabel: treeText('siteSettings', 'Site Settings'),
      themesLabel: treeText('themes', 'Themes'),
      updatesLabel: treeText('pressUpdates', 'Press Updates'),
      syncLabel: treeText('sync', 'Publish'),
      articlesLabel: treeText('articles', 'Articles'),
      pagesLabel: treeText('pages', 'Pages'),
      draftStates: collectEditorDraftStatusMap(),
      diffStates: collectEditorDiffStatusMap(),
      fileStates: collectEditorFileStatusMap(),
      indexDiff: getComposerDiff('index') || null,
      tabsDiff: getComposerDiff('tabs') || null,
      indexBaseline: getRemoteBaseline('index') || null,
      tabsBaseline: getRemoteBaseline('tabs') || null
    });
  }

  return {
    buildCurrentEditorTree,
    collectEditorDiffStatusMap,
    collectEditorDraftStatusMap,
    collectEditorFileStatusMap
  };
}
