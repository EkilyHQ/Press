function noop() {}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function defaultContainsNode(root, node) {
  return !!(root && node && (root === node || (root.contains && root.contains(node))));
}

function focusElement(el) {
  if (!el || typeof el.focus !== 'function') return;
  try { el.focus({ preventScroll: true }); }
  catch (_) {
    try { el.focus(); } catch (__) {}
  }
}

function activeElementFrom(runtime) {
  try {
    return runtime && typeof runtime.getActiveElement === 'function'
      ? runtime.getActiveElement()
      : null;
  } catch (_) {
    return null;
  }
}

export function createEditorBlocksActiveSession({
  state = null,
  blocksState = null,
  list = null,
  runtime = null,
  containsNode = defaultContainsNode,
  syncActiveListTypeSelect = noop,
  refreshLinkEditor = noop,
  updateInlineToolbarState = noop,
  syncActiveTableAlignmentFromEditable = noop,
  requestStickyBlockHeadUpdate = noop,
  clearNativeSelection = noop,
  now = () => Date.now()
} = {}) {
  const currentState = () => state || (blocksState && blocksState.state) || { activeIndex: -1 };
  const blockNodes = () => {
    return list && typeof list.querySelectorAll === 'function'
      ? safeArray(list.querySelectorAll('.blocks-block'))
      : [];
  };
  const hasBlocksState = method => !!(blocksState && typeof blocksState[method] === 'function');

  function setActive(index, editable = null, sync = null) {
    if (hasBlocksState('setActiveIndex')) blocksState.setActiveIndex(index);
    const nodes = blockNodes();
    const activeIndex = currentState().activeIndex;
    const activeBlock = nodes[activeIndex] || null;
    if (editable) {
      const activeEditable = hasBlocksState('getActiveEditable') ? blocksState.getActiveEditable() : null;
      if (editable !== activeEditable) {
        if (hasBlocksState('clearInlineState')) blocksState.clearInlineState();
        if (hasBlocksState('clearLinkEditorState')) {
          blocksState.clearLinkEditorState({ clearActiveLink: false, clearHold: false });
        }
      }
      if (hasBlocksState('setActiveEditing')) blocksState.setActiveEditing(editable, sync);
    } else {
      const activeEditable = hasBlocksState('getActiveEditable') ? blocksState.getActiveEditable() : null;
      const keepEditable = activeEditable && activeBlock && containsNode(activeBlock, activeEditable);
      if (!keepEditable) {
        const focused = activeElementFrom(runtime);
        if (focused && activeEditable && containsNode(activeEditable, focused) && typeof focused.blur === 'function') {
          focused.blur();
        }
        if (hasBlocksState('clearActiveEditing')) blocksState.clearActiveEditing();
        if (hasBlocksState('clearLinkEditorState')) blocksState.clearLinkEditorState();
        if (hasBlocksState('clearInlineState')) blocksState.clearInlineState();
      }
    }
    nodes.forEach((el, idx) => {
      if (el && el.classList && typeof el.classList.toggle === 'function') {
        el.classList.toggle('is-active', idx === currentState().activeIndex);
      }
    });
    syncActiveListTypeSelect(nodes);
    refreshLinkEditor();
    updateInlineToolbarState();
    syncActiveTableAlignmentFromEditable(
      activeBlock,
      editable || (hasBlocksState('getActiveEditable') ? blocksState.getActiveEditable() : null) || activeElementFrom(runtime)
    );
    requestStickyBlockHeadUpdate();
  }

  function activateEditableFromPointer(index, editable, sync) {
    if (hasBlocksState('setSelectionActiveRecoverySuppression')) {
      blocksState.setSelectionActiveRecoverySuppression(now() + 180);
    }
    setActive(index, editable, sync);
  }

  function activateNonTextBlockFromPointer(index, blockEl = null) {
    if (hasBlocksState('setSelectionActiveRecoverySuppression')) {
      blocksState.setSelectionActiveRecoverySuppression(now() + 180);
    }
    if (hasBlocksState('setRoutedBlockContainerClickSuppression')) {
      blocksState.setRoutedBlockContainerClickSuppression(now() + 500);
    }
    focusElement(blockEl);
    clearNativeSelection();
    setActive(index);
  }

  return {
    setActive,
    activateEditableFromPointer,
    activateNonTextBlockFromPointer
  };
}
