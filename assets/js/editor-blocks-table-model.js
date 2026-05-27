// DOM-free pipe-table parsing, serialization, and editing helpers.

const TABLE_ALIGNMENTS = new Set(['', 'left', 'center', 'right']);

function normalizeTableText(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function lineWithoutTerminator(line) {
  return String(line || '').replace(/\n$/, '');
}

function isBlankLine(line) {
  return /^\s*\n?$/.test(line || '');
}

export function normalizeTableAlignment(value) {
  const align = String(value || '').trim().toLowerCase();
  return TABLE_ALIGNMENTS.has(align) ? align : '';
}

export function normalizeTableCellValue(value) {
  return String(value == null ? '' : value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, ' ')
    .trim();
}

function splitPipeTableRow(line) {
  const text = lineWithoutTerminator(line).trim();
  if (!text.startsWith('|') || !text.endsWith('|')) return null;
  if (/\\\|/.test(text)) return null;
  return text.slice(1, -1).split('|').map(cell => String(cell || '').trim());
}

function parsePipeTableSeparatorCells(cells) {
  if (!Array.isArray(cells) || !cells.length) return null;
  const alignments = [];
  for (const cell of cells) {
    const match = String(cell || '').trim().match(/^(:)?-{3,}(:)?$/);
    if (!match) return null;
    const left = !!match[1];
    const right = !!match[2];
    alignments.push(left && right ? 'center' : (right ? 'right' : (left ? 'left' : '')));
  }
  return alignments;
}

export function parseTableBlock(raw) {
  const lines = normalizeTableText(raw).split('\n');
  if (lines.length < 3 || lines.some(line => isBlankLine(line))) return null;
  const headers = splitPipeTableRow(lines[0]);
  if (!headers || !headers.length) return null;
  const alignments = parsePipeTableSeparatorCells(splitPipeTableRow(lines[1]));
  if (!alignments || alignments.length !== headers.length) return null;
  const rows = [];
  for (const line of lines.slice(2)) {
    const cells = splitPipeTableRow(line);
    if (!cells || cells.length > headers.length) return null;
    rows.push([...cells, ...Array(Math.max(0, headers.length - cells.length)).fill('')]);
  }
  if (!rows.length) return null;
  return { headers, alignments, rows };
}

export function tableColumnCount(data = {}) {
  const headers = Array.isArray(data.headers) ? data.headers : [];
  const alignments = Array.isArray(data.alignments) ? data.alignments : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return Math.max(
    1,
    headers.length,
    alignments.length,
    ...rows.map(row => Array.isArray(row) ? row.length : 0)
  );
}

export function editableTableData(data = {}) {
  const columns = tableColumnCount(data);
  const hasHeaders = Array.isArray(data.headers) && data.headers.length;
  const headers = Array.from({ length: columns }, (_, index) => (
    hasHeaders ? normalizeTableCellValue(data.headers[index] || '') : `Column ${index + 1}`
  ));
  const alignments = Array.from({ length: columns }, (_, index) => normalizeTableAlignment(Array.isArray(data.alignments) ? data.alignments[index] : ''));
  const rawRows = Array.isArray(data.rows) && data.rows.length ? data.rows : [Array(columns).fill('')];
  const rows = rawRows.map(row => Array.from({ length: columns }, (_, index) => normalizeTableCellValue(Array.isArray(row) ? row[index] : '')));
  return { headers, alignments, rows };
}

function tableSeparatorCell(align) {
  const normalized = normalizeTableAlignment(align);
  if (normalized === 'left') return ':---';
  if (normalized === 'center') return ':---:';
  if (normalized === 'right') return '---:';
  return '---';
}

function serializeTableRow(cells) {
  return `| ${cells.map(cell => normalizeTableCellValue(cell)).join(' | ')} |`;
}

export function serializeTable(data = {}) {
  const table = editableTableData(data);
  return [
    serializeTableRow(table.headers),
    serializeTableRow(table.alignments.map(tableSeparatorCell)),
    ...table.rows.map(serializeTableRow)
  ].join('\n');
}
