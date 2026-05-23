function noop() {}

function blockData(block) {
  if (!block) return {};
  if (!block.data || typeof block.data !== 'object') block.data = {};
  return block.data;
}

export function createEditorBlocksListSession({
  documentRef = typeof document !== 'undefined' ? document : null,
  root = null,
  state = null,
  blocksState = null,
  editableSession = null,
  selectionSession = null,
  caretSession = null,
  inlineDomSession = null,
  containsNode = (parent, child) => !!(parent && child && parent.contains && parent.contains(child)),
  editableListItems = items => (Array.isArray(items) && items.length ? items : [{ text: '', checked: false }]),
  summarizeListType = (_items, fallback = 'ul') => fallback,
  listVisualMarkerLabels = items => (Array.isArray(items) ? items : []).map(() => '•'),
  effectiveListItemType = (_item, blockListType = 'ul') => blockListType || 'ul',
  itemIndentLevel = item => Math.max(0, Number(item && item.indent) || 0),
  patchListItem = (items, itemIndex, patch = {}) => {
    const next = Array.isArray(items) ? items.slice() : [];
    next[itemIndex] = { ...(next[itemIndex] || {}), ...patch };
    return next;
  },
  setPlainContentEditableValue = (editable, value) => { if (editable) editable.textContent = String(value || ''); },
  editableText = editable => (editable ? String(editable.textContent || '') : ''),
  splitEditableTextAtSelection = editable => ({ before: editableText(editable), after: '' }),
  outdentEmptyListItemForEnter = () => null,
  convertListTailItemAfterEmptyToParagraph = () => null,
  splitListItemsAtEmptyItem = () => null,
  normalizeSplitListStartItems = items => (Array.isArray(items) ? items : []),
  mergeListItemIntoPreviousItem = () => null,
  mergeFirstListItemIntoPreviousBlock = () => null,
  makeBlock = () => null,
  makeSplitListBlock = () => null,
  makeBlankBlock = () => null,
  markDirty = noop,
  render = noop,
  emit = noop,
  updateFromControl = noop,
  insertBlankBlock = noop,
  focusBlockPrimaryEditable = noop,
  removeEmptyBlockWithBackspace = () => false,
  handleCrossBlockArrowNavigation = () => false,
  isEditableSelectionAtStart = () => false,
  isEditableCaretOnEdgeLine = () => false,
  getEditableCaretTextOffset = () => 0,
  caretRectForEditable = () => null,
  placeCaretAtVisualLine = noop,
  placeCaretAtTextOffset = noop,
  placeCaretAtStart = noop,
  placeCaretAtEnd = noop,
  indentListItem = noop,
  setActive = noop,
  activateEditableFromPointer = noop,
  inlineMarksFromPointerEvent = () => ({}),
  inlineMarkedDomRangeFromPointerEvent = () => null,
  updateInlineToolbarState = noop,
  refreshLinkEditor = noop,
  openMathEditorForNode = noop,
  wireInlineEditable = noop,
  queueTask = task => { if (typeof task === 'function') task(); }
} = {}) {
  if (!documentRef) return null;

  const renderBlock = (body, block, index) => {
    if (!body || !block) return;
    const data = blockData(block);
    const items = editableListItems(data.items);
    const listType = data.listType === 'ol' || data.listType === 'task' || data.listType === 'mixed' ? data.listType : 'ul';
    const isTaskList = listType === 'task';
    const listEl = documentRef.createElement(isTaskList ? 'ul' : 'div');
    listEl.className = isTaskList
      ? 'blocks-visual-list blocks-visual-list-task'
      : `blocks-visual-list blocks-visual-list-standard blocks-visual-list-${summarizeListType(items, listType)}`;
    if (!isTaskList) listEl.setAttribute('role', 'list');
    const visualMarkerLabels = listVisualMarkerLabels(items, listType);
    items.forEach((item, itemIndex) => {
      const itemType = effectiveListItemType(item, listType);
      const isTaskItem = itemType === 'task';
      const li = documentRef.createElement(isTaskList ? 'li' : 'div');
      li.className = 'blocks-list-item';
      li.dataset.itemIndex = String(itemIndex);
      li.dataset.listType = itemType;
      if (!isTaskList) li.setAttribute('role', 'listitem');
      const itemIndent = itemIndentLevel(item);
      li.dataset.indent = String(itemIndent);
      if (itemIndent) li.style.marginLeft = `${itemIndent * 1.75}rem`;
      if (isTaskItem) {
        const checkbox = documentRef.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.checked;
        checkbox.addEventListener('change', () => {
          const next = patchListItem(blockData(block).items, itemIndex, { checked: checkbox.checked });
          updateFromControl(block, { items: next });
        });
        li.appendChild(checkbox);
      } else {
        const marker = documentRef.createElement('span');
        marker.className = `blocks-list-marker blocks-list-marker-${itemType}`;
        marker.setAttribute('aria-hidden', 'true');
        marker.textContent = visualMarkerLabels[itemIndex] || (itemType === 'ol' ? '1.' : '•');
        li.appendChild(marker);
      }
      const span = documentRef.createElement('span');
      span.className = 'blocks-rich-editable blocks-list-text';
      span.contentEditable = 'true';
      span.spellcheck = true;
      setPlainContentEditableValue(span, item.text || '');
      const sync = () => {
        const next = patchListItem(blockData(block).items, itemIndex, { text: editableText(span) });
        updateFromControl(block, { items: next });
      };
      if (editableSession && typeof editableSession.registerEditable === 'function') {
        editableSession.registerEditable(span, sync);
      }
      span.addEventListener('input', () => {
        sync();
        updateInlineToolbarState();
      });
      span.addEventListener('keydown', (event) => {
        if (removeEmptyBlockWithBackspace(event, block, index, span, sync)) return;
        if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
          event.preventDefault();
          indentListItem(block, index, event.shiftKey ? -1 : 1);
          return;
        }
        if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          const currentText = editableText(span);
          const currentItems = Array.isArray(blockData(block).items) ? blockData(block).items.slice() : items.slice();
          currentItems[itemIndex] = { ...(currentItems[itemIndex] || {}), text: currentText };
          const outdentedItems = outdentEmptyListItemForEnter(currentItems, itemIndex);
          if (outdentedItems) {
            blocksState.setPendingListFocus({ blockId: block.id, itemIndex, atEnd: false });
            updateFromControl(block, { items: outdentedItems }, true);
            return;
          }
          const trailingParagraph = isEditableSelectionAtStart(span, caretSession)
            ? convertListTailItemAfterEmptyToParagraph(currentItems, itemIndex)
            : null;
          if (trailingParagraph) {
            const currentData = blockData(block);
            const blockAfter = currentData.after != null ? currentData.after : '\n\n';
            const paragraph = makeBlock('paragraph', '', { text: trailingParagraph.text, after: blockAfter, dirty: true });
            if (trailingParagraph.before.length) {
              currentData.items = trailingParagraph.before;
              currentData.after = '\n\n';
              markDirty(block);
              blocksState.replaceBlocks(index, 1, [block, paragraph]);
              render();
              focusBlockPrimaryEditable(paragraph, 0);
            } else {
              blocksState.replaceBlocks(index, 1, [paragraph]);
              render();
              focusBlockPrimaryEditable(paragraph, 0);
            }
            emit();
            return;
          }
          const emptySplit = splitListItemsAtEmptyItem(currentItems, itemIndex);
          if (emptySplit) {
            const splitAfter = normalizeSplitListStartItems(emptySplit.after);
            const currentData = blockData(block);
            const blockAfter = currentData.after != null ? currentData.after : '\n\n';
            if (splitAfter.length) {
              if (emptySplit.before.length) {
                currentData.items = emptySplit.before;
                currentData.after = '\n\n';
                markDirty(block);
                const nextBlock = makeSplitListBlock(block, splitAfter, blockAfter);
                blocksState.replaceBlocks(index, 1, [block, nextBlock], {
                  pendingListFocus: { blockId: nextBlock.id, itemIndex: 0, atEnd: false }
                });
              } else {
                currentData.items = splitAfter;
                currentData.after = blockAfter;
                markDirty(block);
                blocksState.replaceBlocks(index, 1, [block], {
                  pendingListFocus: { blockId: block.id, itemIndex: 0, atEnd: false }
                });
              }
              render();
              emit();
            } else if (emptySplit.before.length) {
              currentData.items = emptySplit.before;
              markDirty(block);
              insertBlankBlock(index + 1, { focus: true });
            } else {
              const blank = makeBlankBlock('\n', { dirty: true });
              blocksState.replaceBlocks(index, 1, [blank]);
              render();
              focusBlockPrimaryEditable(blank, 0);
              emit();
            }
            return;
          }
          const split = splitEditableTextAtSelection(span, selectionSession);
          const next = currentItems;
          next[itemIndex] = { ...next[itemIndex], text: split.before };
          const current = next[itemIndex] || {};
          const currentIndent = itemIndentLevel(current);
          next.splice(itemIndex + 1, 0, {
            text: split.after,
            checked: false,
            indent: currentIndent,
            indentText: typeof current.indentText === 'string' ? current.indentText : '  '.repeat(currentIndent),
            listType: effectiveListItemType(current, listType),
            marker: current.marker,
            delimiter: current.delimiter
          });
          blocksState.setPendingListFocus({ blockId: block.id, itemIndex: itemIndex + 1, caretOffset: 0 });
          updateFromControl(block, { items: next }, true);
          return;
        }
        if ((event.key === 'Backspace' || event.key === 'Delete') && itemIndex > 0 && isEditableSelectionAtStart(span, caretSession)) {
          const currentText = editableText(span);
          const next = Array.isArray(blockData(block).items) ? blockData(block).items.slice() : items.slice();
          next[itemIndex] = { ...(next[itemIndex] || {}), text: currentText };
          const mergedItem = mergeListItemIntoPreviousItem(next, itemIndex);
          if (!mergedItem) return;
          event.preventDefault();
          blocksState.setPendingListFocus({ blockId: block.id, itemIndex: mergedItem.focusItemIndex, caretOffset: mergedItem.caretOffset });
          updateFromControl(block, { items: mergedItem.items.length ? mergedItem.items : [{ text: '', checked: false }] }, true);
          return;
        }
        if (event.key === 'Backspace' && itemIndex === 0 && index > 0 && isEditableSelectionAtStart(span, caretSession)) {
          const currentText = editableText(span);
          const currentItems = Array.isArray(blockData(block).items) ? blockData(block).items.slice() : items.slice();
          currentItems[0] = { ...(currentItems[0] || {}), text: currentText };
          const previous = state && Array.isArray(state.blocks) ? state.blocks[index - 1] || null : null;
          const merged = mergeFirstListItemIntoPreviousBlock(previous, { ...block, data: { ...blockData(block), items: currentItems } }, itemIndex);
          if (!merged) return;
          event.preventDefault();
          const replacement = merged.currentBlock ? [merged.previousBlock, merged.currentBlock] : [merged.previousBlock];
          blocksState.replaceBlocks(index - 1, 2, replacement, {
            pendingListFocus: merged.focus && merged.focus.type === 'list'
              ? { blockId: merged.previousBlock.id, itemIndex: merged.focus.itemIndex, caretOffset: merged.focus.caretOffset }
              : null
          });
          render();
          if (merged.focus && merged.focus.type === 'text') focusBlockPrimaryEditable(merged.previousBlock, merged.focus.caretOffset);
          emit();
          return;
        }
        if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && items.length > 1) {
          const nextIndex = event.key === 'ArrowUp' ? itemIndex - 1 : itemIndex + 1;
          if (nextIndex < 0 || nextIndex >= items.length) {
            handleCrossBlockArrowNavigation(event, index, span);
            return;
          }
          if (!isEditableCaretOnEdgeLine(span, event.key === 'ArrowUp' ? 'up' : 'down', caretSession)) return;
          event.preventDefault();
          const caretOffset = getEditableCaretTextOffset(span, caretSession);
          const caretRect = caretRectForEditable(span, caretSession);
          sync();
          const target = listEl.querySelector(`.blocks-list-item:nth-child(${nextIndex + 1}) .blocks-list-text`);
          if (!target) return;
          try { target.focus(); } catch (_) {}
          placeCaretAtVisualLine(target, caretRect ? caretRect.left : 0, event.key === 'ArrowUp' ? 'last' : 'first', caretOffset, caretSession);
          setActive(index);
          return;
        }
        if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && items.length <= 1) {
          handleCrossBlockArrowNavigation(event, index, span);
        }
      });
      span.addEventListener('focus', () => setActive(index, span, sync));
      span.addEventListener('pointerdown', (event) => {
        if (event && event.button === 0 && event.isPrimary !== false) {
          activateEditableFromPointer(index, span, sync);
        }
      });
      span.addEventListener('click', (event) => {
        const clickedLink = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        const clickedMath = event.target && event.target.closest ? event.target.closest('.press-math[data-tex]') : null;
        if (clickedLink || clickedMath) event.preventDefault();
        setActive(index, span, sync);
        const pointerMarks = inlineMarksFromPointerEvent(event, span, selectionSession);
        const pointerCodeRange = pointerMarks.code ? inlineMarkedDomRangeFromPointerEvent(event, span, 'code', selectionSession, inlineDomSession) : null;
        blocksState.rememberInlineMarks(
          span,
          pointerMarks,
          pointerCodeRange ? { mark: 'code', ...pointerCodeRange } : null
        );
        updateInlineToolbarState();
        if (clickedLink) refreshLinkEditor(clickedLink);
        if (clickedMath) openMathEditorForNode(clickedMath);
      });
      wireInlineEditable(span, index, sync);
      li.appendChild(span);
      if (state && state.pendingListFocus && state.pendingListFocus.blockId === block.id && state.pendingListFocus.itemIndex === itemIndex) {
        queueTask(() => {
          if (!containsNode(root, span)) return;
          const pending = blocksState.takePendingListFocus(block.id, itemIndex);
          try { span.focus(); } catch (_) {}
          if (pending && pending.caretOffset != null) placeCaretAtTextOffset(span, pending.caretOffset, caretSession);
          else if (pending && pending.atEnd) placeCaretAtEnd(span, caretSession);
          else if (pending) placeCaretAtStart(span, caretSession);
          setActive(index, span, sync);
        });
      }
      listEl.appendChild(li);
    });
    body.appendChild(listEl);
  };

  return { renderBlock };
}
