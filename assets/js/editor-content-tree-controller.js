export function createEditorContentTreeController(options = {}) {
  const documentRef = options.documentRef || null;
  const expandedNodeIds = options.expandedNodeIds instanceof Set ? options.expandedNodeIds : new Set();
  const normalizePath = typeof options.normalizePath === 'function' ? options.normalizePath : ((value) => String(value || '').trim());
  const flattenTree = typeof options.flattenTree === 'function' ? options.flattenTree : ((nodes) => {
    const out = [];
    const walk = (node) => {
      if (!node) return;
      out.push(node);
      (node.children || []).forEach(walk);
    };
    (Array.isArray(nodes) ? nodes : []).forEach(walk);
    return out;
  });
  const findNode = typeof options.findNode === 'function'
    ? options.findNode
    : ((nodes, id) => flattenTree(nodes).find(node => node && node.id === id) || null);
  const buildTree = typeof options.buildTree === 'function' ? options.buildTree : (() => []);
  const getCurrentMode = typeof options.getCurrentMode === 'function' ? options.getCurrentMode : (() => '');
  const isDynamicMode = typeof options.isDynamicMode === 'function' ? options.isDynamicMode : (() => false);
  const renderFileTree = typeof options.renderFileTree === 'function' ? options.renderFileTree : (() => {});
  const renderStructurePanel = typeof options.renderStructurePanel === 'function' ? options.renderStructurePanel : (() => {});
  const setEditorDetailPanelMode = typeof options.setEditorDetailPanelMode === 'function' ? options.setEditorDetailPanelMode : (() => {});
  const setStructurePanelVisible = typeof options.setStructurePanelVisible === 'function' ? options.setStructurePanelVisible : (() => {});
  const applyMode = typeof options.applyMode === 'function' ? options.applyMode : (() => {});
  const openMarkdownInEditor = typeof options.openMarkdownInEditor === 'function' ? options.openMarkdownInEditor : (() => {});
  const scrollEditorContentToTop = typeof options.scrollEditorContentToTop === 'function' ? options.scrollEditorContentToTop : (() => {});
  const closeEditorRailDrawer = typeof options.closeEditorRailDrawer === 'function' ? options.closeEditorRailDrawer : (() => {});
  const scheduleEditorStatePersist = typeof options.scheduleEditorStatePersist === 'function' ? options.scheduleEditorStatePersist : (() => {});
  const persistSystemTreeExpandedState = typeof options.persistSystemTreeExpandedState === 'function' ? options.persistSystemTreeExpandedState : (() => {});
  const inferMarkdownSourceFallback = typeof options.inferMarkdownSourceFallback === 'function'
    ? options.inferMarkdownSourceFallback
    : ((path) => (String(path || '').toLowerCase().startsWith('tab/') ? 'tabs' : 'index'));
  const treeElementId = String(options.treeElementId || 'editorFileTree');

  let tree = [];
  let activeNodeId = String(options.initialActiveNodeId || 'welcome') || 'welcome';

  function getTree() {
    return tree;
  }

  function getActiveNodeId() {
    return activeNodeId || 'welcome';
  }

  function setActiveNodeId(nodeId) {
    const next = String(nodeId || '').trim();
    activeNodeId = next || 'welcome';
    return activeNodeId;
  }

  function getExpandedNodeIds() {
    return expandedNodeIds;
  }

  function getExpandedNodeIdsSnapshot() {
    return Array.from(expandedNodeIds).filter(Boolean);
  }

  function addExpandedNodeId(nodeId) {
    const next = String(nodeId || '').trim();
    if (next) expandedNodeIds.add(next);
  }

  function restoreExpandedNodeIds(nodeIds) {
    expandedNodeIds.clear();
    (Array.isArray(nodeIds) ? nodeIds : []).forEach((item) => {
      const id = String(item || '').trim();
      if (id) expandedNodeIds.add(id);
    });
  }

  function getNodeById(nodeId) {
    return findNode(tree, nodeId);
  }

  function getActiveNode() {
    return getNodeById(activeNodeId)
      || getNodeById('welcome')
      || getNodeById('articles')
      || (tree[0] || null);
  }

  function getFileNodeByPath(path) {
    const normalized = normalizePath(path);
    if (!normalized) return null;
    return flattenTree(tree).find(item => item && item.kind === 'file' && item.path === normalized) || null;
  }

  function getFileNodeForTab(tab) {
    if (tab && tab.editorTreeNodeId) {
      const byId = getNodeById(tab.editorTreeNodeId);
      if (byId && byId.kind === 'file') return byId;
    }
    if (tab && tab.tabsKey && tab.tabsLang) {
      const byIdentity = getNodeById(`tabs:${tab.tabsKey}:${tab.tabsLang}`);
      if (byIdentity && byIdentity.kind === 'file') return byIdentity;
    }
    return getFileNodeByPath(tab && tab.path ? tab.path : '');
  }

  function inferMarkdownSourceFromPath(path) {
    const normalized = normalizePath(path);
    if (!normalized) return '';
    try {
      const node = flattenTree(tree)
        .find(item => item && item.kind === 'file' && item.path === normalized);
      if (node && node.source) return String(node.source);
    } catch (_) {}
    return inferMarkdownSourceFallback(normalized);
  }

  function buildCurrentFileBreadcrumb(tab) {
    if (!tab || !tab.path) return [];
    const normalizedPath = normalizePath(tab.path);
    const node = getFileNodeForTab(tab);
    if (!node) return normalizedPath ? [{ label: normalizedPath, path: normalizedPath }] : [];
    const ids = [];
    if (node.source === 'tabs') {
      ids.push('pages', `tabs:${node.key}`, node.id);
    } else {
      ids.push('articles', `index:${node.key}`, `index:${node.key}:${node.lang}`, node.id);
    }
    return ids
      .map((id) => {
        const crumbNode = getNodeById(id);
        if (!crumbNode) return null;
        return {
          label: crumbNode.label || crumbNode.key || crumbNode.id,
          nodeId: crumbNode.id,
          path: crumbNode.path || ''
        };
      })
      .filter(item => item && item.label);
  }

  function expandAncestors(node) {
    if (!node) return;
    if (node.id === 'welcome' || node.source === 'welcome') return;
    if (node.source === 'system' || node.id === 'system') {
      expandedNodeIds.add('system');
      persistSystemTreeExpandedState();
      return;
    }
    if (node.id === 'articles' || node.id === 'pages') {
      expandedNodeIds.add(node.id);
      return;
    }
    const parts = String(node.id || '').split(':');
    const root = parts[0] === 'tabs' ? 'pages' : 'articles';
    expandedNodeIds.add(root);
    if (parts.length >= 2) expandedNodeIds.add(`${parts[0]}:${parts[1]}`);
    if (parts.length >= 3 && parts[0] === 'index') expandedNodeIds.add(`${parts[0]}:${parts[1]}:${parts[2]}`);
  }

  function refresh(optionsForRefresh = {}) {
    const treeEl = documentRef && typeof documentRef.getElementById === 'function'
      ? documentRef.getElementById(treeElementId)
      : null;
    if (!treeEl) return;
    const currentMode = getCurrentMode();
    const preserveStructure = !!optionsForRefresh.preserveStructure
      || !!(currentMode && (
        isDynamicMode(currentMode)
        || currentMode === 'composer'
        || currentMode === 'themes'
        || currentMode === 'updates'
        || currentMode === 'sync'
      ));
    tree = buildTree();
    if (!findNode(tree, activeNodeId)) activeNodeId = 'welcome';
    renderFileTree(treeEl);
    if (preserveStructure) {
      if (currentMode && isDynamicMode(currentMode)) setEditorDetailPanelMode('markdown');
      return;
    }
    renderStructurePanel(getActiveNode());
  }

  function selectNodeByPath(path, selectionOptions = {}) {
    const normalized = normalizePath(path);
    if (!normalized) return null;
    const node = flattenTree(tree).find(item => item && item.path === normalized);
    if (!node) return null;
    activeNodeId = node.id;
    if (!selectionOptions || selectionOptions.expandAncestors !== false) expandAncestors(node);
    const currentMode = getCurrentMode();
    refresh({ preserveStructure: currentMode && isDynamicMode(currentMode) });
    return node;
  }

  function selectNodeForTab(tab, selectionOptions = {}) {
    const node = getFileNodeForTab(tab);
    if (node && node.id) {
      activeNodeId = node.id;
      if (!selectionOptions || selectionOptions.expandAncestors !== false) expandAncestors(node);
      const currentMode = getCurrentMode();
      refresh({ preserveStructure: currentMode && isDynamicMode(currentMode) });
      return node;
    }
    return selectNodeByPath(tab && tab.path ? tab.path : '', selectionOptions);
  }

  function setActiveNodeIdIfExists(nodeId) {
    const next = String(nodeId || '').trim();
    if (!next) return false;
    activeNodeId = next;
    if (!findNode(tree, activeNodeId)) activeNodeId = 'welcome';
    refresh({ preserveStructure: true });
    return true;
  }

  function handleSelection(nodeId) {
    const node = findNode(tree, nodeId);
    if (!node) return;
    activeNodeId = node.id;
    expandAncestors(node);
    if (node.source === 'welcome' || node.id === 'welcome') {
      applyMode('editor', { forceStructure: true });
      setStructurePanelVisible(true);
      refresh();
      scrollEditorContentToTop('smooth');
      closeEditorRailDrawer();
      scheduleEditorStatePersist();
      return;
    }
    if (node.source === 'system') {
      refresh({ preserveStructure: true });
      if (node.id === 'system:site-settings') {
        applyMode('composer');
      } else if (node.id === 'system:themes') {
        applyMode('themes');
      } else if (node.id === 'system:updates') {
        applyMode('updates');
      } else if (node.id === 'system:sync') {
        applyMode('sync');
      } else {
        applyMode('editor', { forceStructure: true });
        setStructurePanelVisible(true);
        refresh();
      }
      scrollEditorContentToTop('smooth');
      closeEditorRailDrawer();
      scheduleEditorStatePersist();
      return;
    }
    if (node.isDeleted) {
      applyMode('editor', { forceStructure: true });
      setStructurePanelVisible(true);
      refresh();
      scrollEditorContentToTop('smooth');
      closeEditorRailDrawer();
      scheduleEditorStatePersist();
      return;
    }
    if (node.kind === 'file' && node.path) {
      refresh({ preserveStructure: true });
      openMarkdownInEditor(node.path, { node });
      closeEditorRailDrawer();
      scheduleEditorStatePersist();
      return;
    }
    applyMode('editor', { forceStructure: true });
    setStructurePanelVisible(true);
    refresh();
    scrollEditorContentToTop('smooth');
    closeEditorRailDrawer();
    scheduleEditorStatePersist();
  }

  return {
    getTree,
    getActiveNodeId,
    setActiveNodeId,
    setActiveNodeIdIfExists,
    getExpandedNodeIds,
    getExpandedNodeIdsSnapshot,
    addExpandedNodeId,
    restoreExpandedNodeIds,
    getNodeById,
    getActiveNode,
    getFileNodeByPath,
    getFileNodeForTab,
    inferMarkdownSourceFromPath,
    buildCurrentFileBreadcrumb,
    expandAncestors,
    refresh,
    selectNodeByPath,
    selectNodeForTab,
    handleSelection
  };
}
