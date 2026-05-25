import assert from 'node:assert/strict';
import { createEditorBlocksTableSession } from '../assets/js/editor-blocks-table-session.js';

function classSet(node) {
  return new Set(String(node.className || '').split(/\s+/).filter(Boolean));
}

function parseAttrs(selector) {
  const attrs = [];
  const re = /\[([^=\]]+)="([^"]*)"\]/g;
  let match = re.exec(selector);
  while (match) {
    attrs.push([match[1], match[2]]);
    match = re.exec(selector);
  }
  return attrs;
}

function makeElement(tagName = 'div', className = '') {
  const listeners = new Map();
  const attrs = {};
  const children = [];
  const node = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    className,
    textContent: '',
    value: '',
    disabled: false,
    checked: false,
    spellcheck: false,
    style: {},
    dataset: {},
    attrs,
    children,
    get options() {
      return children.filter(child => child && child.tagName === 'OPTION');
    },
    append(...items) {
      items.flat().forEach(item => {
        if (!item) return;
        item.parentNode = node;
        item.parentElement = node;
        children.push(item);
      });
    },
    appendChild(item) {
      node.append(item);
      return item;
    },
    contains(target) {
      if (!target) return false;
      if (target === node) return true;
      return children.some(child => child && typeof child.contains === 'function' && child.contains(target));
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
        node.dataset[key] = String(value);
      }
    },
    getAttribute(name) {
      return attrs[name] || '';
    },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter(item => item !== handler));
    },
    dispatch(type, event = {}) {
      (listeners.get(type) || []).forEach(handler => handler({
        preventDefault() {},
        stopPropagation() {},
        target: node,
        ...event
      }));
    },
    matches(selector) {
      const classMatch = selector.match(/^\.([A-Za-z0-9_-]+)/);
      if (classMatch && !classSet(node).has(classMatch[1])) return false;
      if (!classMatch && selector.startsWith('.')) return false;
      return parseAttrs(selector).every(([name, value]) => {
        if (name.startsWith('data-')) {
          const key = name.slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
          return String(node.dataset[key] || '') === value;
        }
        return String(attrs[name] || '') === value;
      });
    },
    querySelector(selector) {
      const stack = [...children];
      while (stack.length) {
        const item = stack.shift();
        if (item && item.matches && item.matches(selector)) return item;
        if (item && item.children) stack.push(...item.children);
      }
      return null;
    },
    querySelectorAll(selector) {
      const out = [];
      const stack = [...children];
      while (stack.length) {
        const item = stack.shift();
        if (item && item.matches && item.matches(selector)) out.push(item);
        if (item && item.children) stack.push(...item.children);
      }
      return out;
    },
    focus() {
      node.focused = true;
    },
    select() {
      node.selected = true;
    },
    setRangeText(text) {
      node.value = String(text || '');
    }
  };
  return node;
}

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    }
  };
}

function editableTableData(data = {}) {
  const headers = Array.isArray(data.headers) && data.headers.length ? data.headers.slice() : ['Column 1'];
  const columns = Math.max(headers.length, Array.isArray(data.alignments) ? data.alignments.length : 0, 1);
  const nextHeaders = Array.from({ length: columns }, (_, index) => String(headers[index] || `Column ${index + 1}`));
  const alignments = Array.from({ length: columns }, (_, index) => ['left', 'center', 'right'].includes(data.alignments?.[index]) ? data.alignments[index] : '');
  const rows = (Array.isArray(data.rows) && data.rows.length ? data.rows : [['']])
    .map(row => Array.from({ length: columns }, (_, index) => String(Array.isArray(row) ? row[index] || '' : '')));
  return { headers: nextHeaders, alignments, rows };
}

function tableColumnCount(data = {}) {
  return Math.max(
    Array.isArray(data.headers) ? data.headers.length : 0,
    Array.isArray(data.alignments) ? data.alignments.length : 0,
    Array.isArray(data.rows) && Array.isArray(data.rows[0]) ? data.rows[0].length : 0,
    1
  );
}

function makeHarness() {
  const calls = [];
  const documentRef = makeDocumentRef();
  const block = {
    id: 'table-1',
    type: 'table',
    data: {
      headers: ['A', 'B'],
      alignments: ['', 'center'],
      rows: [['1', '2'], ['3', '4']]
    }
  };
  const blockEl = makeElement('section', 'blocks-block blocks-block-table');
  blockEl.dataset.blockId = block.id;
  let activeCell = null;
  const blocksState = {
    getActiveTableCellForBlock(blockId) {
      return activeCell && activeCell.blockId === blockId ? { ...activeCell } : null;
    },
    setActiveTableCell(blockId, position) {
      activeCell = { blockId, ...position };
      calls.push(['setActiveTableCell', blockId, position]);
    },
    activeTableCellMatches(blockId, position) {
      return !!activeCell
        && activeCell.blockId === blockId
        && activeCell.section === position.section
        && activeCell.row === position.row
        && activeCell.col === position.col;
    }
  };
  const session = createEditorBlocksTableSession({
    documentRef,
    runtime: {
      requestFrame(fn) {
        calls.push(['requestFrame']);
        fn();
      },
      setTimer(fn, delay) {
        calls.push(['setTimer', delay]);
        fn();
      }
    },
    blocksState,
    editableSession: {
      registerEditable(input, sync) {
        input._sync = sync;
        calls.push(['registerEditable', input.dataset.tableSection, input.dataset.tableRow, input.dataset.tableCol]);
      }
    },
    blockElements() {
      return [blockEl];
    },
    text(_key, fallback) {
      return fallback;
    },
    editableTableData,
    tableColumnCount,
    normalizeTableAlignment(value) {
      return ['left', 'center', 'right'].includes(value) ? value : '';
    },
    normalizeTableCellValue(value) {
      return String(value || '').replace(/[\r\n|]+/g, ' ').replace(/\s+/g, ' ').trim();
    },
    setActive(index, input) {
      calls.push(['setActive', index, input && input.className]);
    },
    activateEditableFromPointer(index, input) {
      calls.push(['activateEditableFromPointer', index, input && input.dataset.tableCol]);
    },
    handleCrossBlockArrowNavigation(event, index, input) {
      calls.push(['handleCrossBlockArrowNavigation', event.key, index, input && input.dataset.tableCol]);
      return false;
    },
    updateFromControl(nextBlock, patch, renderAfter = false) {
      nextBlock.data = editableTableData(patch);
      calls.push(['updateFromControl', nextBlock.id, JSON.parse(JSON.stringify(nextBlock.data)), renderAfter]);
    },
    queueTask(fn) {
      calls.push(['queueTask']);
      fn();
    }
  });
  const body = makeElement('div', 'blocks-block-body');
  session.renderBlock(body, block, 2);
  const controls = session.createControls(block, 2);
  blockEl.append(controls, body);
  return { block, blockEl, body, calls, controls, session };
}

{
  const h = makeHarness();
  const cell = h.blockEl.querySelector('.blocks-table-cell-input[data-table-section="body"][data-table-row="0"][data-table-col="1"]');
  assert.ok(cell, 'body cell should render with table position data attributes');
  cell.value = '  next | cell\nvalue ';
  cell.dispatch('input');
  assert.equal(h.block.data.rows[0][1], 'next cell value');
  assert.ok(h.calls.some(call => call[0] === 'setActiveTableCell' && call[2].section === 'body' && call[2].col === 1));
  assert.ok(h.calls.some(call => call[0] === 'updateFromControl' && call[3] === false));
}

{
  const h = makeHarness();
  const cell = h.blockEl.querySelector('.blocks-table-cell-input[data-table-section="header"][data-table-row="0"][data-table-col="0"]');
  cell.dispatch('paste', {
    clipboardData: { getData: () => ' Pasted | Header\n' }
  });
  assert.equal(h.block.data.headers[0], 'Pasted Header');
}

{
  const h = makeHarness();
  const align = h.blockEl.querySelector('.blocks-table-align-select');
  h.session.setActivePosition(h.block, { section: 'body', row: 0, col: 1 });
  assert.equal(align.dataset.activeAlignment, 'center');
  align.value = 'right';
  align.dispatch('change');
  assert.equal(h.block.data.alignments[1], 'right');
  assert.ok(h.calls.some(call => call[0] === 'updateFromControl' && call[3] === true));
}

{
  const h = makeHarness();
  h.session.setActivePosition(h.block, { section: 'body', row: 0, col: 0 });
  h.blockEl.querySelector('.blocks-table-add-row').dispatch('click');
  assert.equal(h.block.data.rows.length, 3);
  assert.deepEqual(h.block.data.rows[1], ['', '']);
  h.blockEl.querySelector('.blocks-table-add-column').dispatch('click');
  assert.equal(h.block.data.headers.length, 3);
  assert.equal(h.block.data.rows[0].length, 3);
  h.blockEl.querySelector('.blocks-table-delete-column').dispatch('click');
  assert.equal(h.block.data.headers.length, 2);
  h.blockEl.querySelector('.blocks-table-delete-row').dispatch('click');
  assert.equal(h.block.data.rows.length, 2);
}

{
  const h = makeHarness();
  const cell = h.blockEl.querySelector('.blocks-table-cell-input[data-table-section="body"][data-table-row="1"][data-table-col="1"]');
  h.session.syncActiveAlignmentFromEditable(h.blockEl, cell, [h.block]);
  const align = h.blockEl.querySelector('.blocks-table-align-select');
  assert.equal(align.dataset.activeAlignment, 'center');
  assert.ok(h.calls.some(call => call[0] === 'setActiveTableCell' && call[2].row === 1 && call[2].col === 1));
}
