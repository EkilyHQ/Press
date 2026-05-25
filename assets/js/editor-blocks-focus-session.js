function noop() {}

function defaultQueueTask(task) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task);
    return;
  }
  Promise.resolve().then(task).catch(noop);
}

function blockIdFor(block) {
  if (!block) return '';
  if (typeof block === 'object') return String(block.id || '');
  return String(block);
}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function isTextarea(editable) {
  return !!(editable && editable.matches && editable.matches('textarea'));
}

function focusElement(el) {
  if (!el || typeof el.focus !== 'function') return;
  try { el.focus({ preventScroll: true }); }
  catch (_) {
    try { el.focus(); } catch (__) {}
  }
}

function editableSync(editableSession, editable) {
  try {
    return editableSession && typeof editableSession.getSync === 'function'
      ? editableSession.getSync(editable) || null
      : null;
  } catch (_) {
    return null;
  }
}

function placeTextareaAtOffset(area, offset) {
  try {
    const length = String(area && area.value != null ? area.value : '').length;
    const safeOffset = Math.max(0, Math.min(length, Number(offset) || 0));
    area.setSelectionRange(safeOffset, safeOffset);
  } catch (_) {}
}

export function createEditorBlocksFocusSession({
  state = null,
  blocksState = null,
  caretSession = null,
  editableSession = null,
  blockElements = () => [],
  editableListItems = value => safeArray(value),
  setActive = noop,
  activateNonTextBlockFromPointer = null,
  onInlineToolbarUpdate = noop,
  queueTask = defaultQueueTask
} = {}) {
  const getState = () => state || (blocksState && blocksState.state) || { blocks: [] };
  const getBlocks = () => {
    const current = getState();
    return Array.isArray(current.blocks) ? current.blocks : [];
  };
  const getBlockElements = () => safeArray(blockElements());
  const queue = typeof queueTask === 'function' ? queueTask : defaultQueueTask;
  const listItems = typeof editableListItems === 'function' ? editableListItems : value => safeArray(value);

  function findBlockElement(blockId) {
    if (!blockId) return { blockEl: null, index: -1, nodes: [] };
    const nodes = getBlockElements();
    const blockEl = nodes.find(el => el && el.dataset && el.dataset.blockId === blockId) || null;
    return { blockEl, index: blockEl ? nodes.indexOf(blockEl) : -1, nodes };
  }

  function primaryEditableFor(blockEl) {
    const body = blockEl && blockEl.querySelector ? blockEl.querySelector('.blocks-block-body') : null;
    return body && body.querySelector
      ? body.querySelector('.blocks-rich-editable, .blocks-table-cell-input, .blocks-code-preview code[contenteditable="true"], .blocks-image-caption, .blocks-source-textarea')
      : null;
  }

  function placeEditableAtOffset(editable, caretOffset) {
    if (isTextarea(editable)) {
      placeTextareaAtOffset(editable, caretOffset);
      return;
    }
    if (caretSession && typeof caretSession.placeAtTextOffset === 'function') {
      caretSession.placeAtTextOffset(editable, caretOffset);
    }
  }

  function placeEditableAtEnd(editable) {
    if (caretSession && typeof caretSession.placeAtEnd === 'function') {
      caretSession.placeAtEnd(editable);
    }
  }

  function placeEditableAtStart(editable) {
    if (caretSession && typeof caretSession.placeAtStart === 'function') {
      caretSession.placeAtStart(editable);
    }
  }

  function focusBlockPrimaryEditable(block, caretOffset = null) {
    const blockId = blockIdFor(block);
    if (!blockId) return;
    queue(() => {
      const { blockEl, index } = findBlockElement(blockId);
      if (!blockEl) return;
      const editable = primaryEditableFor(blockEl);
      if (!editable) {
        focusElement(blockEl);
        setActive(index);
        return;
      }
      focusElement(editable);
      if (caretOffset != null) placeEditableAtOffset(editable, caretOffset);
      else placeEditableAtEnd(editable);
      setActive(index, editable, editableSync(editableSession, editable));
    });
  }

  function focusListItemEditable(block, itemIndex, options = {}) {
    const blockId = blockIdFor(block);
    if (!blockId) return;
    queue(() => {
      const { blockEl, index } = findBlockElement(blockId);
      if (!blockEl || !blockEl.querySelectorAll) return;
      const items = blockEl.querySelectorAll('.blocks-list-item .blocks-list-text');
      if (!items.length) {
        focusBlockPrimaryEditable(block, options.caretOffset);
        return;
      }
      const safeIndex = Math.max(0, Math.min(Number(itemIndex) || 0, items.length - 1));
      const editable = items[safeIndex];
      focusElement(editable);
      if (options.caretOffset != null) placeEditableAtOffset(editable, options.caretOffset);
      else if (options.atEnd) placeEditableAtEnd(editable);
      else placeEditableAtStart(editable);
      setActive(index, editable, editableSync(editableSession, editable));
    });
  }

  function focusPreviousBlockEnd(index) {
    const blocks = getBlocks();
    const targetIndex = Math.max(0, Math.min((Number(index) || 0) - 1, blocks.length - 1));
    const target = blocks[targetIndex] || null;
    if (!target) return;
    if (target.type === 'list') {
      const itemIndex = listItems(target.data && target.data.items).length - 1;
      focusListItemEditable(target, itemIndex, { atEnd: true });
      return;
    }
    focusBlockPrimaryEditable(target);
  }

  function blockNavigationTarget(index, edge = 'first') {
    const nodes = getBlockElements();
    const blockEl = nodes[index] || null;
    if (!blockEl || !blockEl.querySelectorAll || !blockEl.querySelector) return null;
    const listTexts = safeArray(blockEl.querySelectorAll('.blocks-list-item .blocks-list-text'));
    const listTarget = listTexts.length ? (edge === 'last' ? listTexts[listTexts.length - 1] : listTexts[0]) : null;
    const tableCells = safeArray(blockEl.querySelectorAll('.blocks-table-cell-input'));
    const tableTarget = tableCells.length ? (edge === 'last' ? tableCells[tableCells.length - 1] : tableCells[0]) : null;
    const editable = listTarget
      || tableTarget
      || blockEl.querySelector('.blocks-rich-editable:not(.blocks-list-text), .blocks-code-preview code[contenteditable="true"], .blocks-image-caption, .blocks-source-textarea');
    if (editable) {
      return {
        blockEl,
        editable,
        index,
        sync: editableSync(editableSession, editable)
      };
    }
    return { blockEl, editable: null, index, sync: null };
  }

  function focusBlockNavigationTarget(target, direction, x, fallbackOffset = 0) {
    if (!target || !target.blockEl) return false;
    const edge = direction === 'up' ? 'last' : 'first';
    const editable = target.editable || null;
    if (!editable) {
      if (typeof activateNonTextBlockFromPointer === 'function') {
        activateNonTextBlockFromPointer(target.index, target.blockEl);
      } else {
        focusElement(target.blockEl);
        setActive(target.index);
      }
      return true;
    }
    focusElement(editable);
    if (isTextarea(editable)) {
      if (caretSession && typeof caretSession.placeTextareaAtVisualLine === 'function') {
        caretSession.placeTextareaAtVisualLine(editable, x, edge, fallbackOffset);
      }
    } else if (caretSession && typeof caretSession.placeAtVisualLine === 'function') {
      caretSession.placeAtVisualLine(editable, x, edge, fallbackOffset);
    }
    setActive(target.index, editable, target.sync);
    onInlineToolbarUpdate();
    return true;
  }

  function handleCrossBlockArrowNavigation(event, index, editable = null) {
    if (!event || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return false;
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
    const direction = event.key === 'ArrowUp' ? 'up' : 'down';
    const blocks = getBlocks();
    if (!Number.isInteger(index) || index < 0 || index >= blocks.length) return false;
    if (editable) {
      const onEdge = isTextarea(editable)
        ? !!(caretSession && typeof caretSession.isTextareaOnEdgeLine === 'function' && caretSession.isTextareaOnEdgeLine(editable, direction))
        : !!(caretSession && typeof caretSession.isEditableOnEdgeLine === 'function' && caretSession.isEditableOnEdgeLine(editable, direction));
      if (!onEdge) return false;
    }
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return false;
    const caretRect = editable && !isTextarea(editable) && caretSession && typeof caretSession.rectForEditable === 'function'
      ? caretSession.rectForEditable(editable)
      : null;
    const editableRect = editable && editable.getBoundingClientRect ? editable.getBoundingClientRect() : null;
    const currentBlock = !editable ? getBlockElements()[index] : null;
    const blockRect = currentBlock && currentBlock.getBoundingClientRect ? currentBlock.getBoundingClientRect() : null;
    const anchorRect = editableRect || blockRect;
    const x = caretRect ? caretRect.left : (anchorRect ? anchorRect.left + 1 : 0);
    const target = blockNavigationTarget(targetIndex, direction === 'up' ? 'last' : 'first');
    if (!target) return false;
    event.preventDefault();
    focusBlockNavigationTarget(target, direction, x);
    return true;
  }

  return {
    focusBlockPrimaryEditable,
    focusListItemEditable,
    focusPreviousBlockEnd,
    blockNavigationTarget,
    focusBlockNavigationTarget,
    handleCrossBlockArrowNavigation
  };
}
