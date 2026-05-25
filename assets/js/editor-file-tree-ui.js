export function createEditorFileTreeUi(options = {}) {
  const documentRef = options.documentRef || null;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function' ? options.requestAnimationFrameRef : null;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function' ? options.setTimeoutRef : null;
  const treeText = typeof options.treeText === 'function' ? options.treeText : (key, fallback) => fallback || key;
  const getEditorContentTree = typeof options.getEditorContentTree === 'function' ? options.getEditorContentTree : () => [];
  const getActiveNodeId = typeof options.getActiveNodeId === 'function' ? options.getActiveNodeId : () => '';
  const handleEditorTreeSelection = typeof options.handleEditorTreeSelection === 'function' ? options.handleEditorTreeSelection : () => {};
  const persistSystemTreeExpandedState = typeof options.persistSystemTreeExpandedState === 'function' ? options.persistSystemTreeExpandedState : () => {};
  const refreshEditorContentTree = typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : () => {};
  const scheduleEditorStatePersist = typeof options.scheduleEditorStatePersist === 'function' ? options.scheduleEditorStatePersist : () => {};
  const expandedEditorTreeNodeIds = options.expandedNodeIds instanceof Set ? options.expandedNodeIds : new Set();
  const collapsingEditorTreeNodeIds = new Set();
  let expandingEditorTreeNodeId = null;

  function scheduleFrame(callback) {
    if (requestAnimationFrameRef) {
      requestAnimationFrameRef(callback);
      return;
    }
    scheduleTimeout(callback, 0);
  }

  function scheduleTimeout(callback, delay) {
    if (setTimeoutRef) {
      setTimeoutRef(callback, delay);
      return;
    }
    callback();
  }

  function isEditorTreeFileKind(kind) {
    return kind === 'file' || kind === 'deleted-file';
  }

  function createEditorTreeIcon(node) {
    if (!node || node.kind === 'root') return null;
    const icon = documentRef.createElement('span');
    const isFile = isEditorTreeFileKind(node.kind);
    let iconKind = isFile ? 'document' : 'folder';
    let iconSvg = '';
    if (node.id === 'system:site-settings') {
      iconKind = 'settings';
      iconSvg = '<svg viewBox="0 0 24 24" focusable="false"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    } else if (node.id === 'system:themes') {
      iconKind = 'themes';
      iconSvg = '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 5h16"></path><path d="M4 12h16"></path><path d="M4 19h16"></path><path d="M7 5v14"></path><path d="M17 5v14"></path></svg>';
    } else if (node.id === 'system:updates') {
      iconKind = 'updates';
      iconSvg = '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>';
    } else if (node.id === 'system:sync') {
      iconKind = 'publish';
      iconSvg = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 13v8"></path><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"></path><path d="m8 17 4-4 4 4"></path></svg>';
    }
    icon.className = `editor-tree-icon editor-tree-icon-${iconKind}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = iconSvg || (isFile
      ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 3.75h7.25L18 7.5v12.75H7z"></path><path d="M14.25 3.75V7.5H18"></path><path d="M9.75 12h5.5M9.75 15h5.5"></path></svg>'
      : '<svg viewBox="0 0 24 24" focusable="false"><path d="M3.75 6.75h5.5l1.7 2h9.3v8.5a2 2 0 0 1-2 2H5.75a2 2 0 0 1-2-2z"></path><path d="M3.75 8.75h16.5"></path></svg>');
    return icon;
  }

  function getEditorTreeChangeLabel(state) {
    if (state === 'issue') return treeText('status.issue', 'Issue');
    if (state === 'added') return treeText('status.added', 'Added');
    if (state === 'deleted') return treeText('status.deleted', 'Deleted');
    return treeText('status.modified', 'Modified');
  }

  function getEditorTreeIssueState(node) {
    if (!node) return '';
    if (node.draftState === 'conflict' || node.fileState === 'error' || node.diffState === 'error') return 'issue';
    return '';
  }

  function getEditorTreeCountTone(counts) {
    const safeCounts = counts || {};
    if (safeCounts.deleted) return 'deleted';
    if (safeCounts.added && !safeCounts.modified) return 'added';
    return 'modified';
  }

  function getEditorTreeChangedSummary(counts) {
    const safeCounts = counts || {};
    const parts = [];
    if (safeCounts.added) parts.push(`${safeCounts.added} ${treeText('status.added', 'added').toLowerCase()}`);
    if (safeCounts.modified) parts.push(`${safeCounts.modified} ${treeText('status.modified', 'modified').toLowerCase()}`);
    if (safeCounts.deleted) parts.push(`${safeCounts.deleted} ${treeText('status.deleted', 'deleted').toLowerCase()}`);
    const fallback = parts.length
      ? `${safeCounts.total} changed: ${parts.join(', ')}`
      : `${safeCounts.total || 0} changed`;
    return treeText('status.changedSummary', fallback, {
      total: safeCounts.total || 0,
      added: safeCounts.added || 0,
      modified: safeCounts.modified || 0,
      deleted: safeCounts.deleted || 0
    });
  }

  function getEditorTreeStatusSummaries(node) {
    if (!node) return [];
    const summaries = [];
    const counts = node.changeCounts || {};
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const issueState = getEditorTreeIssueState(node);
    const directBadge = (!hasChildren || node.kind === 'system') && node.changeState;
    if (issueState) {
      summaries.push(getEditorTreeChangeLabel(issueState));
    } else if (directBadge) {
      summaries.push(getEditorTreeChangeLabel(node.changeState));
    } else if (counts.total > 0) {
      summaries.push(getEditorTreeChangedSummary(counts));
    } else if (node.isDeleted) {
      summaries.push(treeText('status.deletedSummary', 'Deleted item'));
    }
    if (node.orderChanged) summaries.push(treeText('status.orderChanged', 'Order changed'));
    if (node.checkingCount > 0) {
      const checking = treeText('status.checking', 'Checking');
      summaries.push(node.checkingCount > 1 ? `${checking} (${node.checkingCount})` : checking);
    }
    return summaries;
  }

  function getEditorTreeAccessibleLabel(node, labelText, accessiblePath) {
    const base = accessiblePath ? `${labelText} - ${accessiblePath}` : labelText;
    const summaries = getEditorTreeStatusSummaries(node);
    return summaries.length ? `${base} - ${summaries.join(', ')}` : base;
  }

  function createEditorTreeStatusElement(node) {
    const status = documentRef.createElement('span');
    status.className = 'editor-tree-status';
    status.setAttribute('aria-hidden', 'true');
    const counts = node.changeCounts ? node.changeCounts : {};
    const hasChildren = !!(Array.isArray(node.children) && node.children.length);
    const issueState = getEditorTreeIssueState(node);
    const directBadge = (!hasChildren || node.kind === 'system') && node.changeState;
    if (issueState) {
      const badge = documentRef.createElement('span');
      badge.className = 'editor-tree-change-badge';
      badge.dataset.state = issueState;
      badge.textContent = getEditorTreeChangeLabel(issueState);
      status.appendChild(badge);
    } else if (directBadge) {
      const badge = documentRef.createElement('span');
      badge.className = 'editor-tree-change-badge';
      badge.dataset.state = node.changeState;
      badge.textContent = getEditorTreeChangeLabel(node.changeState);
      status.appendChild(badge);
    } else if (counts.total > 0) {
      const countBadge = documentRef.createElement('span');
      countBadge.className = 'editor-tree-count-badge';
      countBadge.dataset.state = getEditorTreeCountTone(counts);
      countBadge.textContent = String(counts.total);
      status.appendChild(countBadge);
    }
    if (node.orderChanged) {
      const orderBadge = documentRef.createElement('span');
      orderBadge.className = 'editor-tree-order-badge';
      orderBadge.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 9l4 -4l4 4m-4 -4v14"></path><path d="M21 15l-4 4l-4 -4m4 4v-14"></path></svg>';
      status.appendChild(orderBadge);
    }
    if (node.checkingCount > 0) {
      const spinner = documentRef.createElement('span');
      spinner.className = 'editor-tree-spinner';
      spinner.dataset.count = String(node.checkingCount);
      status.appendChild(spinner);
    }
    if (!status.childElementCount) status.hidden = true;
    return status;
  }

  function getEditorTreeRowDepth(row) {
    const raw = row && row.dataset ? Number(row.dataset.depth) : 0;
    return Number.isFinite(raw) ? raw : 0;
  }

  function collectEditorTreeDescendantRows(row) {
    const rows = [];
    const depth = getEditorTreeRowDepth(row);
    let next = row && row.nextElementSibling ? row.nextElementSibling : null;
    while (next) {
      const nextDepth = getEditorTreeRowDepth(next);
      if (nextDepth <= depth) break;
      rows.push(next);
      next = next.nextElementSibling;
    }
    return rows;
  }

  function animateEditorTreeCollapse(root, node, row) {
    if (!root || !node || !row || !expandedEditorTreeNodeIds.has(node.id)) return false;
    if (collapsingEditorTreeNodeIds.has(node.id)) return true;
    const descendants = collectEditorTreeDescendantRows(row);
    if (!descendants.length) return false;
    collapsingEditorTreeNodeIds.add(node.id);
    row.classList.add('is-collapsing-parent');
    descendants.forEach((descendant) => {
      const height = (() => {
        try {
          const rect = descendant.getBoundingClientRect();
          if (rect && Number.isFinite(rect.height) && rect.height > 0) return rect.height;
        } catch (_) {}
        return descendant.offsetHeight || 28;
      })();
      descendant.classList.add('is-collapsing');
      descendant.style.minHeight = `${height}px`;
      descendant.style.maxHeight = `${height}px`;
      descendant.style.opacity = '1';
      descendant.style.transform = 'translateY(0)';
    });
    try { root.getBoundingClientRect(); } catch (_) {}
    const collapseRows = () => {
      descendants.forEach((descendant) => {
        descendant.style.minHeight = '0px';
        descendant.style.maxHeight = '0px';
        descendant.style.opacity = '0';
        descendant.style.transform = 'translateY(-4px)';
      });
    };
    scheduleFrame(collapseRows);
    const finish = () => {
      if (!collapsingEditorTreeNodeIds.has(node.id)) return;
      collapsingEditorTreeNodeIds.delete(node.id);
      expandedEditorTreeNodeIds.delete(node.id);
      if (node.id === 'system') persistSystemTreeExpandedState();
      refreshEditorContentTree({ preserveStructure: true });
      scheduleEditorStatePersist();
    };
    scheduleTimeout(finish, 340);
    return true;
  }

  function renderEditorFileTree(root) {
    if (!root || !documentRef || typeof documentRef.createElement !== 'function') return;
    root.innerHTML = '';
    const selectedId = getActiveNodeId();
    const expandingNodeId = expandingEditorTreeNodeId;
    const renderNode = (node, depth, ancestorIds = []) => {
      if (!node) return;
      const hasChildren = Array.isArray(node.children) && node.children.length > 0;
      const row = documentRef.createElement('div');
      row.className = 'editor-tree-row';
      row.dataset.nodeId = node.id;
      row.dataset.kind = node.kind || '';
      row.dataset.source = node.source || '';
      row.dataset.depth = String(Math.max(0, depth));
      if (node.isDeleted) row.dataset.deleted = '1';
      row.classList.toggle('is-leaf', !hasChildren);
      const rowIndent = hasChildren
        ? Math.max(0, depth) * 1.12
        : Math.max(0, depth - 1) * 1.12 + 1.35;
      row.style.paddingLeft = `${rowIndent}rem`;
      row.classList.toggle('is-selected', node.id === selectedId);
      if (expandingNodeId && ancestorIds.includes(expandingNodeId)) {
        row.classList.add('is-expanding');
      }

      if (depth > 0) {
        const guides = documentRef.createElement('span');
        guides.className = 'editor-tree-guides';
        guides.setAttribute('aria-hidden', 'true');
        for (let guideIndex = 0; guideIndex < depth; guideIndex += 1) {
          const guide = documentRef.createElement('span');
          guide.className = 'editor-tree-guide';
          guide.style.setProperty('--tree-guide-index', String(guideIndex));
          guides.appendChild(guide);
        }
        row.appendChild(guides);
      }

      let toggle = null;
      if (hasChildren) {
        toggle = documentRef.createElement('button');
        toggle.type = 'button';
        toggle.className = 'editor-tree-toggle';
        toggle.tabIndex = 0;
        toggle.setAttribute('aria-label', treeText('toggle', 'Toggle'));
        toggle.setAttribute('aria-expanded', expandedEditorTreeNodeIds.has(node.id) ? 'true' : 'false');
        const caret = documentRef.createElement('span');
        caret.className = 'editor-tree-caret';
        caret.setAttribute('aria-hidden', 'true');
        toggle.appendChild(caret);
        toggle.addEventListener('click', (event) => {
          event.stopPropagation();
          if (expandedEditorTreeNodeIds.has(node.id)) {
            if (animateEditorTreeCollapse(root, node, row)) return;
            expandedEditorTreeNodeIds.delete(node.id);
          } else {
            expandingEditorTreeNodeId = node.id;
            expandedEditorTreeNodeIds.add(node.id);
          }
          if (node.id === 'system') persistSystemTreeExpandedState();
          refreshEditorContentTree({ preserveStructure: true });
          scheduleEditorStatePersist();
        });
      }

      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'editor-tree-node';
      button.setAttribute('role', 'treeitem');
      button.setAttribute('aria-selected', node.id === selectedId ? 'true' : 'false');
      button.dataset.nodeId = node.id;
      const labelText = node.label || node.id;
      const accessiblePath = node.path || '';
      button.setAttribute('aria-label', getEditorTreeAccessibleLabel(node, labelText, accessiblePath));
      const icon = createEditorTreeIcon(node);
      if (icon) button.appendChild(icon);
      const label = documentRef.createElement('span');
      label.className = 'editor-tree-label';
      label.textContent = labelText;
      button.appendChild(label);
      button.addEventListener('click', () => handleEditorTreeSelection(node.id));
      button.appendChild(createEditorTreeStatusElement(node));
      if (toggle) row.appendChild(toggle);
      row.appendChild(button);
      root.appendChild(row);

      if (hasChildren && expandedEditorTreeNodeIds.has(node.id)) {
        const childAncestors = ancestorIds.concat(node.id);
        node.children.forEach(child => renderNode(child, depth + 1, childAncestors));
      }
    };
    getEditorContentTree().forEach(node => renderNode(node, 0));
    if (expandingNodeId) {
      const clearExpandingRows = () => {
        try {
          root.querySelectorAll('.editor-tree-row.is-expanding').forEach(row => {
            row.classList.remove('is-expanding');
          });
        } catch (_) {}
      };
      scheduleTimeout(clearExpandingRows, 220);
    }
    expandingEditorTreeNodeId = null;
  }

  return {
    renderEditorFileTree
  };
}
