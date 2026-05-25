function noop() {}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function createButton(documentRef, label, className) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = className || '';
  button.textContent = label || '';
  return button;
}

function focusAndSelect(target) {
  if (!target) return;
  try { target.focus(); } catch (_) {}
  try { if (typeof target.select === 'function') target.select(); } catch (_) {}
}

function cellSelector(position) {
  return `.blocks-table-cell-input[data-table-section="${position.section}"][data-table-row="${position.row}"][data-table-col="${position.col}"]`;
}

export function createEditorBlocksTableSession({
  documentRef = null,
  runtime = null,
  blocksState = null,
  editableSession = null,
  blockElements = () => [],
  text = (_key, fallback) => fallback,
  editableTableData = data => data || {},
  tableColumnCount = () => 0,
  normalizeTableAlignment = value => String(value || ''),
  normalizeTableCellValue = value => String(value || ''),
  setActive = noop,
  activateEditableFromPointer = noop,
  handleCrossBlockArrowNavigation = () => false,
  updateFromControl = noop,
  queueTask = task => {
    try { queueMicrotask(task); }
    catch (_) { Promise.resolve().then(task); }
  }
} = {}) {
  if (!documentRef) return null;

  const requestFrame = task => {
    if (runtime && typeof runtime.requestFrame === 'function') return runtime.requestFrame(task);
    return queueTask(task);
  };

  const setTimer = task => {
    if (runtime && typeof runtime.setTimer === 'function') return runtime.setTimer(task, 0);
    return queueTask(task);
  };

  const blockElementFor = (block) => {
    const id = block && block.id;
    return safeArray(blockElements()).find(el => el && el.dataset && el.dataset.blockId === id) || null;
  };

  const clampColumn = (table, col) => {
    const count = tableColumnCount(table);
    if (!count) return 0;
    const numeric = Number.isFinite(Number(col)) ? Number(col) : 0;
    return Math.max(0, Math.min(count - 1, numeric));
  };

  const normalizePosition = (block, position) => {
    const table = editableTableData(block && block.data);
    const col = clampColumn(table, position && position.col);
    const bodyRowCount = Array.isArray(table.rows) ? table.rows.length : 0;
    const wantsBody = position && position.section === 'body' && bodyRowCount > 0;
    const rowValue = position && Number.isFinite(Number(position.row)) ? Number(position.row) : 0;
    const row = wantsBody ? Math.max(0, Math.min(bodyRowCount - 1, rowValue)) : 0;
    return {
      section: wantsBody ? 'body' : 'header',
      row,
      col
    };
  };

  const activePositionForBlock = (block) => normalizePosition(
    block,
    blocksState && typeof blocksState.getActiveTableCellForBlock === 'function'
      ? blocksState.getActiveTableCellForBlock(block && block.id)
      : null
  );

  const positionFromCellInput = (input) => {
    if (!input || !(input.matches && input.matches('.blocks-table-cell-input'))) return null;
    return {
      section: input.dataset && input.dataset.tableSection === 'body' ? 'body' : 'header',
      row: Math.max(0, Number(input.dataset && input.dataset.tableRow) || 0),
      col: Math.max(0, Number(input.dataset && input.dataset.tableCol) || 0)
    };
  };

  const setAlignmentSelectValue = (alignment, value) => {
    if (!alignment) return;
    const normalized = normalizeTableAlignment(value);
    alignment.value = normalized;
    safeArray(alignment.options).forEach((option) => {
      option.selected = option.value === normalized;
    });
    if (alignment.value !== normalized) alignment.value = '';
    if (alignment.dataset) alignment.dataset.activeAlignment = normalized;
  };

  const applyAlignmentControlForPosition = (block, position) => {
    const blockEl = blockElementFor(block);
    const alignment = blockEl && typeof blockEl.querySelector === 'function'
      ? blockEl.querySelector('.blocks-table-align-select')
      : null;
    if (!alignment) return;
    const table = editableTableData(block && block.data);
    const normalized = normalizePosition(block, position);
    setAlignmentSelectValue(alignment, table.alignments && table.alignments[normalized.col]);
  };

  const isActivePosition = (block, position) => {
    return !!(blocksState
      && typeof blocksState.activeTableCellMatches === 'function'
      && blocksState.activeTableCellMatches(block && block.id, position));
  };

  const syncAlignmentControlForPosition = (block, position) => {
    const normalized = normalizePosition(block, position);
    const applyIfCurrent = () => {
      if (!isActivePosition(block, normalized)) return;
      applyAlignmentControlForPosition(block, normalized);
    };
    applyAlignmentControlForPosition(block, normalized);
    queueTask(applyIfCurrent);
    requestFrame(applyIfCurrent);
    setTimer(applyIfCurrent);
  };

  const setActivePosition = (block, position) => {
    const normalized = normalizePosition(block, position);
    if (blocksState && typeof blocksState.setActiveTableCell === 'function') {
      blocksState.setActiveTableCell(block && block.id, normalized);
    }
    syncAlignmentControlForPosition(block, normalized);
    return normalized;
  };

  const focusCell = (block, position) => {
    const normalized = setActivePosition(block, position);
    queueTask(() => {
      const blockEl = blockElementFor(block);
      const target = blockEl && typeof blockEl.querySelector === 'function'
        ? blockEl.querySelector(cellSelector(normalized))
        : null;
      focusAndSelect(target);
    });
  };

  const updateBlock = (block, nextData, position) => {
    if (!block) return;
    block.data = editableTableData(nextData);
    const normalized = setActivePosition(block, position);
    updateFromControl(block, block.data, true);
    focusCell(block, normalized);
  };

  const syncActiveAlignmentFromEditable = (activeBlock, editable, stateBlocks = []) => {
    const cell = (editable && editable.matches && editable.matches('.blocks-table-cell-input'))
      ? editable
      : (activeBlock && typeof activeBlock.querySelector === 'function'
        ? activeBlock.querySelector('.blocks-table-cell-input:focus')
        : null);
    const position = positionFromCellInput(cell);
    if (!activeBlock || !position) return;
    const blockId = activeBlock.dataset && activeBlock.dataset.blockId ? activeBlock.dataset.blockId : '';
    const block = safeArray(stateBlocks).find(candidate => candidate && candidate.id === blockId);
    if (!block || block.type !== 'table') return;
    setActivePosition(block, normalizePosition(block, position));
  };

  const createControls = (block, index) => {
    const controls = documentRef.createElement('div');
    controls.className = 'blocks-table-controls';

    const alignment = documentRef.createElement('select');
    alignment.className = 'blocks-table-align-select';
    alignment.title = text('tableAlignment', 'Column alignment');
    alignment.setAttribute('aria-label', text('tableAlignment', 'Column alignment'));
    [
      ['', text('tableAlignDefault', 'Default')],
      ['left', text('tableAlignLeft', 'Left')],
      ['center', text('tableAlignCenter', 'Center')],
      ['right', text('tableAlignRight', 'Right')]
    ].forEach(([value, label]) => {
      const option = documentRef.createElement('option');
      option.value = value;
      option.textContent = label;
      alignment.appendChild(option);
    });

    const syncAlignmentSelect = () => {
      const table = editableTableData(block && block.data);
      const position = activePositionForBlock(block);
      setAlignmentSelectValue(alignment, table.alignments && table.alignments[position.col]);
    };

    alignment.addEventListener('pointerdown', (event) => {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      setActive(index);
      syncAlignmentSelect();
    });
    alignment.addEventListener('focus', () => {
      setActive(index);
      syncAlignmentSelect();
    });
    alignment.addEventListener('change', () => {
      const table = editableTableData(block && block.data);
      const position = activePositionForBlock(block);
      table.alignments[position.col] = normalizeTableAlignment(alignment.value);
      updateBlock(block, table, position);
    });

    const makeButton = (className, label, handler) => {
      const buttonEl = createButton(documentRef, label, `blocks-icon-btn ${className}`);
      buttonEl.title = label;
      buttonEl.setAttribute('aria-label', label);
      buttonEl.addEventListener('pointerdown', (event) => {
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      });
      buttonEl.addEventListener('click', (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (buttonEl.disabled) return;
        setActive(index);
        handler(buttonEl);
      });
      return buttonEl;
    };

    const addRow = makeButton('blocks-table-add-row', text('tableAddRow', 'Add row'), () => {
      const table = editableTableData(block && block.data);
      const position = activePositionForBlock(block);
      const blankRow = Array(tableColumnCount(table)).fill('');
      const insertAt = position.section === 'body' ? position.row + 1 : 0;
      table.rows.splice(insertAt, 0, blankRow);
      updateBlock(block, table, { section: 'body', row: insertAt, col: position.col });
    });

    const addColumn = makeButton('blocks-table-add-column', text('tableAddColumn', 'Add column'), () => {
      const table = editableTableData(block && block.data);
      const position = activePositionForBlock(block);
      const insertAt = position.col + 1;
      table.headers.splice(insertAt, 0, '');
      table.alignments.splice(insertAt, 0, '');
      table.rows = table.rows.map((row) => {
        const nextRow = row.slice();
        nextRow.splice(insertAt, 0, '');
        return nextRow;
      });
      updateBlock(block, table, { ...position, col: insertAt });
    });

    const deleteRow = makeButton('blocks-table-delete-row', text('tableDeleteRow', 'Delete row'), () => {
      const table = editableTableData(block && block.data);
      if (table.rows.length <= 1) return;
      const position = activePositionForBlock(block);
      const removeAt = position.section === 'body' ? position.row : 0;
      table.rows.splice(removeAt, 1);
      const nextRow = Math.max(0, Math.min(table.rows.length - 1, removeAt));
      updateBlock(block, table, { section: 'body', row: nextRow, col: position.col });
    });

    const deleteColumn = makeButton('blocks-table-delete-column', text('tableDeleteColumn', 'Delete column'), () => {
      const table = editableTableData(block && block.data);
      if (tableColumnCount(table) <= 1) return;
      const position = activePositionForBlock(block);
      table.headers.splice(position.col, 1);
      table.alignments.splice(position.col, 1);
      table.rows = table.rows.map((row) => {
        const nextRow = row.slice();
        nextRow.splice(position.col, 1);
        return nextRow;
      });
      const nextCol = Math.max(0, Math.min(tableColumnCount(table) - 1, position.col));
      updateBlock(block, table, { ...position, col: nextCol });
    });

    const updateDisabled = () => {
      const table = editableTableData(block && block.data);
      deleteRow.disabled = table.rows.length <= 1;
      deleteColumn.disabled = tableColumnCount(table) <= 1;
      syncAlignmentSelect();
    };

    controls.addEventListener('pointerdown', updateDisabled);
    controls.addEventListener('focusin', updateDisabled);
    controls.append(alignment, addRow, addColumn, deleteRow, deleteColumn);
    updateDisabled();
    return controls;
  };

  const renderBlock = (body, block, index) => {
    const data = editableTableData(block && block.data);
    block.data = data;
    const wrap = documentRef.createElement('div');
    wrap.className = 'blocks-table-wrap';
    const table = documentRef.createElement('table');
    table.className = 'blocks-table';

    const createCellInput = (section, rowIndex, colIndex, value, isHeader) => {
      const align = normalizeTableAlignment(data.alignments && data.alignments[colIndex]);
      const input = documentRef.createElement('input');
      input.type = 'text';
      input.className = [
        'blocks-table-cell-input',
        isHeader ? 'blocks-table-header-cell' : 'blocks-table-body-cell',
        `blocks-table-align-${align || 'default'}`
      ].join(' ');
      input.value = String(value || '');
      input.spellcheck = true;
      input.dataset.tableSection = section;
      input.dataset.tableRow = String(rowIndex);
      input.dataset.tableCol = String(colIndex);
      input.setAttribute('aria-label', isHeader
        ? `${text('table', 'Table')} ${text('heading', 'Heading')} ${colIndex + 1}`
        : `${text('table', 'Table')} ${rowIndex + 1}, ${colIndex + 1}`);

      const sync = () => {
        const next = editableTableData(block && block.data);
        const cleanValue = normalizeTableCellValue(input.value);
        if (section === 'header') {
          next.headers[colIndex] = cleanValue;
        } else if (next.rows[rowIndex]) {
          next.rows[rowIndex][colIndex] = cleanValue;
        }
        setActivePosition(block, { section, row: rowIndex, col: colIndex });
        updateFromControl(block, next);
      };
      if (editableSession && typeof editableSession.registerEditable === 'function') {
        editableSession.registerEditable(input, sync);
      }
      input.addEventListener('input', sync);
      input.addEventListener('paste', (event) => {
        const pasted = event && event.clipboardData && event.clipboardData.getData('text/plain');
        if (pasted == null) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        const clean = normalizeTableCellValue(pasted);
        if (typeof input.setRangeText === 'function') {
          input.setRangeText(clean, input.selectionStart, input.selectionEnd, 'end');
        } else {
          input.value += clean;
        }
        sync();
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.isComposing) {
          event.preventDefault();
          return;
        }
        handleCrossBlockArrowNavigation(event, index, input);
      });
      input.addEventListener('focus', () => {
        setActivePosition(block, { section, row: rowIndex, col: colIndex });
        setActive(index, input, sync);
      });
      input.addEventListener('pointerdown', (event) => {
        if (event && event.button === 0 && event.isPrimary !== false) {
          setActivePosition(block, { section, row: rowIndex, col: colIndex });
          activateEditableFromPointer(index, input, sync);
        }
      });
      return input;
    };

    const thead = documentRef.createElement('thead');
    const headRow = documentRef.createElement('tr');
    data.headers.forEach((header, colIndex) => {
      const th = documentRef.createElement('th');
      th.appendChild(createCellInput('header', 0, colIndex, header, true));
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = documentRef.createElement('tbody');
    data.rows.forEach((row, rowIndex) => {
      const tr = documentRef.createElement('tr');
      data.headers.forEach((_, colIndex) => {
        const td = documentRef.createElement('td');
        td.appendChild(createCellInput('body', rowIndex, colIndex, row[colIndex] || '', false));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
  };

  return {
    activePositionForBlock,
    createControls,
    focusCell,
    normalizePosition,
    positionFromCellInput,
    renderBlock,
    setActivePosition,
    syncActiveAlignmentFromEditable,
    updateBlock
  };
}
