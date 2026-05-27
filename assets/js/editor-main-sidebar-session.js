import { createEditorMainSidebarFileTree } from './editor-main-sidebar-file-tree.js';

function fallbackNormalizeLangKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getElement(documentRef, runtime, id) {
  if (runtime && typeof runtime.getElementById === 'function') {
    return runtime.getElementById(id);
  }
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

export function createEditorMainSidebarSession(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const normalizeLangKey = typeof options.normalizeLangKey === 'function'
    ? options.normalizeLangKey
    : fallbackNormalizeLangKey;
  const loadSiteConfig = typeof options.loadSiteConfig === 'function'
    ? options.loadSiteConfig
    : async () => ({});
  const loadIndexData = typeof options.loadIndexData === 'function'
    ? options.loadIndexData
    : async () => ({ raw: {}, entries: {} });
  const loadTabsConfig = typeof options.loadTabsConfig === 'function'
    ? options.loadTabsConfig
    : async () => ({});
  const bindCurrentFileElement = typeof options.bindCurrentFileElement === 'function'
    ? options.bindCurrentFileElement
    : () => {};
  const onSiteConfigLoaded = typeof options.onSiteConfigLoaded === 'function'
    ? options.onSiteConfigLoaded
    : () => {};
  const onIndexLoaded = typeof options.onIndexLoaded === 'function'
    ? options.onIndexLoaded
    : () => {};
  const onOpenMarkdown = typeof options.onOpenMarkdown === 'function'
    ? options.onOpenMarkdown
    : async () => {};
  const onWarn = typeof options.onWarn === 'function'
    ? options.onWarn
    : () => {};
  const showAlert = typeof options.alert === 'function'
    ? options.alert
    : () => {};

  let listIndex = null;
  let listTabs = null;
  let statusEl = null;
  let searchInput = null;
  let sideTabs = [];
  let groupIndex = null;
  let groupTabs = null;
  let contentRoot = 'wwwroot';
  let bound = false;

  const setStatus = (message) => {
    if (statusEl) statusEl.textContent = message || '';
  };

  const fileTree = createEditorMainSidebarFileTree({
    runtime,
    documentRef,
    normalizeLangKey,
    getContentRoot: () => contentRoot,
    setStatus,
    onOpenMarkdown,
    onWarn,
    alert: showAlert
  });

  const bind = () => {
    if (bound || !documentRef) return;
    listIndex = getElement(documentRef, runtime, 'listIndex');
    listTabs = getElement(documentRef, runtime, 'listTabs');
    statusEl = getElement(documentRef, runtime, 'sidebarStatus');
    searchInput = getElement(documentRef, runtime, 'fileSearch');
    groupIndex = getElement(documentRef, runtime, 'groupIndex');
    groupTabs = getElement(documentRef, runtime, 'groupTabs');
    const currentFileEl = getElement(documentRef, runtime, 'currentFile');
    sideTabs = Array.from(documentRef.querySelectorAll('.sidebar-tab'));
    bindCurrentFileElement(currentFileEl);
    if (runtime && typeof runtime.ensureEditorBaseDir === 'function') {
      runtime.ensureEditorBaseDir(`${contentRoot}/`);
    }
    fileTree.bind({
      listIndex,
      listTabs,
      searchInput,
      sideTabs,
      groupIndex,
      groupTabs
    });
    bound = true;
  };

  const load = async () => {
    let site = {};
    try {
      setStatus('Loading site config...');
      site = await loadSiteConfig();
      contentRoot = site && site.contentRoot ? String(site.contentRoot) : 'wwwroot';
    } catch (_) {
      site = {};
      contentRoot = 'wwwroot';
    }
    onSiteConfigLoaded({ siteConfig: site || {}, contentRoot });

    try {
      setStatus('Loading index...');
      const indexResult = await loadIndexData(contentRoot);
      const rawIndex = (indexResult && indexResult.raw) || {};
      const posts = (indexResult && indexResult.entries) || {};
      fileTree.renderIndex(rawIndex);
      onIndexLoaded({ posts, rawIndex, contentRoot });
    } catch (error) {
      onWarn('Failed to load index data', error);
    }

    try {
      setStatus('Loading tabs...');
      const tabs = await loadTabsConfig(contentRoot);
      fileTree.renderTabs(tabs);
    } catch (error) {
      onWarn('Failed to load tabs.yaml', error);
    }

    setStatus('');
  };

  const initialize = () => {
    bind();
    return load();
  };

  return {
    applyFilter: fileTree.applyFilter,
    bind,
    getContentRoot: () => contentRoot,
    initialize,
    load,
    renderIndex: fileTree.renderIndex,
    renderTabs: fileTree.renderTabs,
    switchGroup: fileTree.switchGroup
  };
}
