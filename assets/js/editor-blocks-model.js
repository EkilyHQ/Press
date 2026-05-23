// DOM-free Markdown block, inline-run, and editing model helpers for the blocks editor.

export const BLOCK_TYPES = new Set(['paragraph', 'heading', 'image', 'list', 'quote', 'code', 'math', 'card', 'table', 'source', 'blank']);

export function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isFrontMatterFence(line) {
  return /^---\s*$/.test(String(line || ''));
}

function frontMatterLinesHaveKey(lines) {
  return (Array.isArray(lines) ? lines : []).some(line => /^[A-Za-z_][A-Za-z0-9_.-]*\s*:/.test(String(line || '')));
}

function findFrontMatterEndIndex(lines, start) {
  if (!Array.isArray(lines) || !isFrontMatterFence(lines[start])) return -1;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (!isFrontMatterFence(lines[index])) continue;
    return frontMatterLinesHaveKey(lines.slice(start + 1, index)) ? index : -1;
  }
  return -1;
}

function isFrontMatterBlock(raw) {
  const lines = normalizeText(raw).split('\n');
  if (lines.length < 3 || !isFrontMatterFence(lines[0])) return false;
  if (!isFrontMatterFence(lines[lines.length - 1])) return false;
  return frontMatterLinesHaveKey(lines.slice(1, -1));
}

export function makeBlock(type, raw, data = {}) {
  const safeType = BLOCK_TYPES.has(type) ? type : 'source';
  const id = data.id || `block-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    type: safeType,
    raw: String(raw == null ? '' : raw),
    dirty: !!data.dirty,
    data: { ...data, id: undefined }
  };
}

function isBlankLine(line) {
  return /^\s*\n?$/.test(line || '');
}

function splitMarkdownLines(text) {
  const input = normalizeText(text);
  if (!input) return [];
  const matches = input.match(/[^\n]*(?:\n|$)/g) || [];
  return matches.filter((line, index) => !(line === '' && index === matches.length - 1));
}

function detachBlockTerminator(raw, after) {
  if (raw.endsWith('\n')) {
    return { raw: raw.slice(0, -1), after: `\n${after || ''}` };
  }
  return { raw, after: after || '' };
}

export function splitBlankLineUnits(value) {
  const text = String(value || '');
  if (!text) return [];
  const units = text.match(/[^\n]*\n/g) || [];
  return units.join('') === text ? units : [];
}

function splitExtraBlankBlocks(after) {
  const units = splitBlankLineUnits(after);
  if (units.length <= 2) return { separator: after || '', blanks: [] };
  return {
    separator: units.slice(0, 2).join(''),
    blanks: units.slice(2)
  };
}

export function makeBlankBlock(after = '\n', data = {}) {
  const block = makeBlock('blank', '', { ...data, after: after || '\n' });
  block.dirty = !!data.dirty;
  return block;
}

function lineWithoutTerminator(line) {
  return String(line || '').replace(/\n$/, '');
}

function parseFenceStartLine(line) {
  const trimmed = lineWithoutTerminator(line).trimStart();
  const match = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
  if (!match) return null;
  const marker = match[1] || '';
  return { marker, char: marker[0], length: marker.length, info: match[2] || '' };
}

function isFenceStartLine(line) {
  return !!parseFenceStartLine(line);
}

function isFenceEndLine(line, fence) {
  if (!fence || !fence.char || !fence.length) return false;
  const marker = fence.char === '`' ? '`' : '~';
  const text = lineWithoutTerminator(line).trimStart();
  const re = new RegExp(`^${marker}{${fence.length},}\\s*$`);
  return re.test(text);
}

function isHeadingLine(line) {
  return /^(#{1,6})\s+.+$/.test(lineWithoutTerminator(line));
}

function isListItemLine(line) {
  const text = lineWithoutTerminator(line);
  return /^([ \t]*)([-*])\s+\[([ xX])\]\s+.+$/.test(text)
    || /^([ \t]*)([-*+])\s+.+$/.test(text)
    || /^([ \t]*)(\d{1,9})([\.)])\s+.+$/.test(text);
}

function isQuoteLine(line) {
  return lineWithoutTerminator(line).startsWith('>');
}

function isStandaloneMediaLine(line) {
  const text = lineWithoutTerminator(line);
  const trimmed = text.trim();
  return trimmed === text && !!(parseImageBlock(trimmed) || parseCardBlock(trimmed));
}

function isDisplayMathFenceLine(line) {
  return lineWithoutTerminator(line).trim() === '$$';
}

function startsMarkdownBlock(line) {
  return isFenceStartLine(line)
    || isDisplayMathFenceLine(line)
    || isHeadingLine(line)
    || isListItemLine(line)
    || isQuoteLine(line)
    || isStandaloneMediaLine(line);
}

function extractChunks(markdown) {
  const lines = splitMarkdownLines(markdown);
  const chunks = [];
  let index = 0;
  let leading = '';

  while (index < lines.length && isBlankLine(lines[index])) {
    leading += lines[index];
    index += 1;
  }

  while (index < lines.length) {
    const start = index;
    const first = lines[index] || '';
    const trimmed = first.trimStart();
    const frontMatterEnd = !chunks.length && !leading && start === 0 ? findFrontMatterEndIndex(lines, start) : -1;

    if (frontMatterEnd >= 0) {
      index = frontMatterEnd + 1;
    } else if (isFenceStartLine(first)) {
      const fence = parseFenceStartLine(first);
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index] || '';
        index += 1;
        if (isFenceEndLine(candidate, fence)) break;
      }
    } else if (isDisplayMathFenceLine(first)) {
      index += 1;
      while (index < lines.length) {
        const candidate = lines[index] || '';
        index += 1;
        if (isDisplayMathFenceLine(candidate)) break;
      }
    } else if (isHeadingLine(first) || isStandaloneMediaLine(first)) {
      index += 1;
    } else if (isListItemLine(first)) {
      index += 1;
      while (index < lines.length && !isBlankLine(lines[index]) && isListItemLine(lines[index])) index += 1;
    } else if (isQuoteLine(first)) {
      index += 1;
      while (index < lines.length && !isBlankLine(lines[index]) && isQuoteLine(lines[index])) index += 1;
    } else {
      index += 1;
      while (index < lines.length && !isBlankLine(lines[index]) && !startsMarkdownBlock(lines[index])) index += 1;
    }

    let raw = lines.slice(start, index).join('');
    let after = '';
    while (index < lines.length && isBlankLine(lines[index])) {
      after += lines[index];
      index += 1;
    }

    const detached = detachBlockTerminator(raw, after);
    chunks.push({
      raw: detached.raw,
      after: detached.after,
      before: chunks.length ? '' : leading
    });
    leading = '';
  }

  if (leading && !chunks.length) chunks.push({ raw: leading, after: '', before: '' });
  return chunks;
}

function parseImageBlock(raw) {
  const match = raw.match(/^!\[([^\]\n]*)\]\(([^)\s]*)(?:\s+"([^"\n]*)")?\)$/);
  if (!match) return null;
  return { alt: match[1] || '', src: match[2] || '', title: match[3] || '' };
}

function parseCardBlock(raw) {
  const match = raw.match(/^\[([^\]\n]+)\]\(\?id=([^) \n]+)(?:\s+"([^"\n]*)")?\)$/);
  if (!match) return null;
  const title = match[3] || '';
  return {
    label: match[1] || '',
    location: decodeCardLocation(match[2] || ''),
    title,
    forceCard: /\b(card|preview)\b/i.test(title)
  };
}

function decodeCardLocation(value) {
  const raw = String(value || '');
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    return raw;
  }
}

function parseCodeBlock(raw) {
  const lines = raw.split('\n');
  if (lines.length < 2) return null;
  const open = parseFenceStartLine(lines[0]);
  if (!open) return null;
  if (!isFenceEndLine(lines[lines.length - 1], open)) return null;
  return {
    lang: (open.info || '').trim(),
    text: lines.slice(1, -1).join('\n')
  };
}

function parseMathBlock(raw) {
  const lines = normalizeText(raw).split('\n');
  if (lines.length < 2) return null;
  if (!isDisplayMathFenceLine(lines[0])) return null;
  if (!isDisplayMathFenceLine(lines[lines.length - 1])) return null;
  return {
    tex: lines.slice(1, -1).join('\n')
  };
}

function indentationColumn(value) {
  return String(value || '').replace(/\t/g, '    ').length;
}

export function normalizeStandardListType(value, fallback = 'ul') {
  if (value === 'ol') return 'ol';
  if (value === 'ul') return 'ul';
  return fallback === 'ol' ? 'ol' : 'ul';
}

export function normalizeListItemType(value, fallback = 'ul') {
  if (value === 'task') return 'task';
  if (fallback === 'task' && value !== 'ol' && value !== 'ul') return 'task';
  return normalizeStandardListType(value, fallback);
}

export function effectiveListItemType(item, blockListType = 'ul') {
  return normalizeListItemType(item && item.listType, blockListType);
}

export function summarizeListType(items, fallback = 'ul') {
  const safeItems = Array.isArray(items) ? items : [];
  const types = new Set(safeItems.map(item => effectiveListItemType(item, fallback)));
  if (types.size > 1) return 'mixed';
  if (types.has('task')) return 'task';
  return types.has('ol') ? 'ol' : 'ul';
}

export function itemIndentLevel(item) {
  return Math.max(0, Number(item && item.indent) || 0);
}

function itemIndentText(item) {
  return item && typeof item.indentText === 'string'
    ? item.indentText
    : '  '.repeat(itemIndentLevel(item));
}

function nextOrderedListNumber(item, counters) {
  const key = String(itemIndentLevel(item));
  const explicit = Number(item && item.number);
  if (explicit > 0) {
    counters[key] = explicit;
    return explicit;
  }
  const next = Math.max(0, Number(counters[key]) || 0) + 1;
  counters[key] = next;
  return next;
}

function resetOrderedListNumber(item, counters) {
  counters[String(itemIndentLevel(item))] = 0;
}

function resetNestedOrderedListNumbers(item, counters) {
  const indent = itemIndentLevel(item);
  Object.keys(counters || {}).forEach(key => {
    if ((Number(key) || 0) > indent) delete counters[key];
  });
}

function parseListLineInfo(line) {
  const text = String(line || '');
  let match = text.match(/^([ \t]*)([-*])\s+\[([ xX])\]\s+(.+)$/);
  if (match) return { kind: 'task', indentColumn: indentationColumn(match[1]) };
  match = text.match(/^([ \t]*)([-*+])\s+(.+)$/);
  if (match) return { kind: 'ul', indentColumn: indentationColumn(match[1]) };
  match = text.match(/^([ \t]*)(\d{1,9})([\.)])\s+(.+)$/);
  if (match) return { kind: 'ol', indentColumn: indentationColumn(match[1]) };
  return null;
}

function parseListBlock(raw) {
  const lines = raw.split('\n');
  if (!lines.length) return null;
  const items = [];
  for (const line of lines) {
    let match = line.match(/^([ \t]*)([-*])\s+\[([ xX])\]\s+(.+)$/);
    if (match) {
      items.push({
        listType: 'task',
        checked: match[3].toLowerCase() === 'x',
        text: match[4] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1]),
        marker: match[2] || '-'
      });
      continue;
    }
    match = line.match(/^([ \t]*)([-*+])\s+(.+)$/);
    if (match) {
      items.push({
        listType: 'ul',
        text: match[3] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1]),
        marker: match[2] || '-'
      });
      continue;
    }
    match = line.match(/^([ \t]*)(\d{1,9})([\.)])\s+(.+)$/);
    if (match) {
      items.push({
        listType: 'ol',
        number: Number(match[2]),
        delimiter: match[3] || '.',
        text: match[4] || '',
        indentText: match[1] || '',
        indentColumn: indentationColumn(match[1])
      });
      continue;
    }
    return null;
  }
  const indentColumns = [...new Set(items.map(item => item.indentColumn || 0))].sort((a, b) => a - b);
  if (indentColumns[0] !== 0) return null;
  items.forEach(item => {
    item.indent = Math.max(0, indentColumns.indexOf(item.indentColumn || 0));
    delete item.indentColumn;
  });
  return items.length ? { listType: summarizeListType(items), items } : null;
}

function parseQuoteBlock(raw) {
  const lines = raw.split('\n');
  if (!lines.length || !lines.every(line => line.startsWith('>'))) return null;
  const first = lines[0].slice(1).trim();
  if (/^\[!\w+\]/.test(first)) return null;
  return { text: lines.map(line => line.replace(/^>\s?/, '')).join('\n') };
}

const TABLE_ALIGNMENTS = new Set(['', 'left', 'center', 'right']);

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

function parseTableBlock(raw) {
  const lines = normalizeText(raw).split('\n');
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

function maskInlineCodeSpans(raw) {
  const text = String(raw || '');
  let output = '';
  let index = 0;
  while (index < text.length) {
    if (text[index] !== '`') {
      output += text[index];
      index += 1;
      continue;
    }

    const start = index;
    while (index < text.length && text[index] === '`') index += 1;
    const marker = text.slice(start, index);
    const close = text.indexOf(marker, index);
    if (close < 0) {
      output += marker;
      continue;
    }

    const end = close + marker.length;
    output += ' '.repeat(end - start);
    index = end;
  }
  return output;
}

function riskyParagraphReason(raw) {
  if (!raw.trim()) return '';
  const visible = maskInlineCodeSpans(raw);
  const listLines = normalizeText(visible).split('\n').filter(line => !isBlankLine(line));
  const listInfos = listLines.map(parseListLineInfo);
  if (listInfos.length && listInfos.every(Boolean)) {
    const indentColumns = [...new Set(listInfos.map(item => item.indentColumn || 0))].sort((a, b) => a - b);
    const kinds = new Set(listInfos.map(item => item.kind));
    if (kinds.size > 1) return 'mixedList';
    if (indentColumns[0] !== 0) return 'indentedList';
  }
  if (/^\|/.test(visible.trimStart())) return 'table';
  if (/\n\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*(?:\n|$)/.test(visible)) return 'table';
  if (/^\s+[-*+]\s+/m.test(visible) || /^\s+\d{1,9}[\.)]\s+/m.test(visible)) return 'indentedList';
  if (/!\[[^\]]*\]\([^)]+\)/.test(visible)) return 'image';
  if (/<[A-Za-z][^>]*>/.test(visible)) return 'rawHtml';
  return '';
}

function makeSourceBlock(raw, data = {}, sourceReason = 'unsupported') {
  return makeBlock('source', raw, { ...data, sourceReason });
}

function classifyChunk(raw, data = {}) {
  const text = String(raw || '');
  const trimmed = text.trim();
  if (!trimmed) return makeSourceBlock(text, data, 'blank');
  if (isFrontMatterBlock(text)) return makeSourceBlock(text, data, 'frontMatter');

  const code = parseCodeBlock(text);
  if (code) return makeBlock('code', text, { ...data, ...code });
  if (parseFenceStartLine(trimmed.split('\n')[0])) return makeSourceBlock(text, data, 'unclosedFence');

  const math = parseMathBlock(text);
  if (math) return makeBlock('math', text, { ...data, ...math });
  if (isDisplayMathFenceLine(trimmed.split('\n')[0])) return makeSourceBlock(text, data, 'unclosedMath');

  const heading = text.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    return makeBlock('heading', text, { ...data, level: heading[1].length, text: heading[2] || '' });
  }

  const image = parseImageBlock(trimmed);
  if (image && trimmed === text) return makeBlock('image', text, { ...data, ...image });

  const card = parseCardBlock(trimmed);
  if (card && trimmed === text) return makeBlock('card', text, { ...data, ...card });

  const table = parseTableBlock(text);
  if (table) return makeBlock('table', text, { ...data, ...table });

  const quote = parseQuoteBlock(text);
  if (quote) return makeBlock('quote', text, { ...data, ...quote });
  if (text.trimStart().startsWith('>')) return makeSourceBlock(text, data, 'callout');

  const list = parseListBlock(text);
  if (list) return makeBlock('list', text, { ...data, ...list });

  const reason = riskyParagraphReason(text);
  if (reason) return makeSourceBlock(text, data, reason);
  return makeBlock('paragraph', text, { ...data, text });
}

export function parseMarkdownBlocks(markdown) {
  const blocks = [];
  extractChunks(markdown).forEach(chunk => {
    const leadingUnits = splitBlankLineUnits(chunk.before || '');
    leadingUnits.forEach(unit => {
      blocks.push(makeBlankBlock(unit));
    });
    const rawBlankUnits = splitBlankLineUnits(chunk.raw || '');
    if (rawBlankUnits.length && rawBlankUnits.join('') === String(chunk.raw || '')) {
      rawBlankUnits.forEach(unit => {
        blocks.push(makeBlankBlock(unit));
      });
      return;
    }
    const extra = splitExtraBlankBlocks(chunk.after || '');
    blocks.push(classifyChunk(chunk.raw, {
      before: leadingUnits.length ? '' : (chunk.before || ''),
      after: extra.separator
    }));
    extra.blanks.forEach(unit => {
      blocks.push(makeBlankBlock(unit));
    });
  });
  return blocks;
}

function removeIndentColumns(line, columns) {
  const target = Math.max(0, Number(columns) || 0);
  if (!target) return String(line || '');
  const text = String(line || '');
  let index = 0;
  let removed = 0;
  while (index < text.length && removed < target) {
    const char = text[index];
    if (char === ' ') {
      index += 1;
      removed += 1;
      continue;
    }
    if (char === '\t') {
      if (removed + 4 > target) break;
      index += 1;
      removed += 4;
      continue;
    }
    break;
  }
  return text.slice(index);
}

function dedentIndentedListSource(raw) {
  const lines = normalizeText(raw).split('\n');
  const indents = [];
  lines.forEach(line => {
    const match = String(line || '').match(/^([ \t]+)(?:[-*]\s+\[[ xX]\]\s+|[-*+]\s+|\d{1,9}[\.)]\s+)/);
    if (match) indents.push(indentationColumn(match[1] || ''));
  });
  const minIndent = indents.length ? Math.min(...indents) : 0;
  if (minIndent <= 0) return '';
  return lines.map(line => removeIndentColumns(line, minIndent)).join('\n');
}

function sourceBlockText(block) {
  if (!block || typeof block !== 'object') return '';
  const data = block.data || {};
  return String(data.text != null ? data.text : block.raw || '');
}

export function autofixMarkdownSourceBlock(block) {
  if (!block || block.type !== 'source') return [];
  const data = block.data || {};
  const reason = String(data.sourceReason || '');
  let fixed = '';
  if (reason === 'indentedList') fixed = dedentIndentedListSource(sourceBlockText(block));
  if (!fixed) return [];

  const nextBlocks = parseMarkdownBlocks(fixed);
  if (!nextBlocks.length || nextBlocks.some(next => next.type === 'source')) return [];
  nextBlocks.forEach((next, index) => {
    next.dirty = true;
    next.data = next.data || {};
    if (index === 0) next.data.before = data.before || '';
    if (index === nextBlocks.length - 1) next.data.after = data.after != null ? data.after : '\n\n';
  });
  return nextBlocks;
}

function escapeMarkdownInline(value) {
  const text = String(value == null ? '' : value).replace(/\u00a0/g, ' ');
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, (match, offset) => shouldEscapePlainUnderscore(text, offset) ? '\\_' : match)
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function codeSpanFenceForText(value) {
  const runs = String(value == null ? '' : value).match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(1, longest + 1));
}

function serializeMarkdownCodeSpan(value) {
  const text = String(value == null ? '' : value).replace(/\u00a0/g, ' ');
  const fence = codeSpanFenceForText(text);
  const body = text.startsWith('`') || text.endsWith('`') ? ` ${text} ` : text;
  return `${fence}${body}${fence}`;
}

function normalizeMarkdownCodeSpanText(value) {
  const text = String(value == null ? '' : value).replace(/\n/g, ' ');
  if (text.length >= 2 && text.startsWith(' ') && text.endsWith(' ') && /\S/.test(text)) {
    return text.slice(1, -1);
  }
  return text;
}

export function sanitizeEditorLinkHref(value) {
  const href = String(value == null ? '' : value).trim();
  const protocol = href.toLowerCase().match(/^([a-z][a-z0-9+.-]*):/);
  if (!protocol) return href;
  return ['http', 'https', 'mailto', 'tel'].includes(protocol[1]) ? href : '#';
}

export function sanitizeEditorLinkTitle(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function escapeMarkdownLinkTitle(value) {
  return sanitizeEditorLinkTitle(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isInlineWordChar(value) {
  return /^[\p{L}\p{N}]$/u.test(String(value || ''));
}

function isIntrawordUnderscore(text, index) {
  return isInlineWordChar(text[index - 1]) && isInlineWordChar(text[index + 1]);
}

function shouldEscapePlainUnderscore(text, index) {
  return !isIntrawordUnderscore(String(text || ''), index);
}

function serializeImage(data = {}) {
  const alt = String(data.alt || '');
  const src = String(data.src || '').trim();
  const title = String(data.title || '').trim();
  return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
}

function serializeCard(data = {}) {
  const label = String(data.label || data.location || 'Article').trim() || 'Article';
  const location = encodeURIComponent(String(data.location || '').trim()).replace(/%2F/g, '/');
  const title = data.forceCard || data.title ? ` "${String(data.title || 'card').trim() || 'card'}"` : '';
  return `[${label}](?id=${location || 'post/example.md'}${title})`;
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

function serializeTable(data = {}) {
  const table = editableTableData(data);
  return [
    serializeTableRow(table.headers),
    serializeTableRow(table.alignments.map(tableSeparatorCell)),
    ...table.rows.map(serializeTableRow)
  ].join('\n');
}

function codeFenceForText(text) {
  const runs = String(text || '').match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function serializeBlock(block) {
  if (!block || typeof block !== 'object') return '';
  if (!block.dirty && typeof block.raw === 'string') return block.raw;
  const data = block.data || {};
  switch (block.type) {
    case 'blank':
      return '';
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(data.level) || 2));
      return `${'#'.repeat(level)} ${String(data.text || '').trim()}`;
    }
    case 'image':
      return serializeImage(data);
    case 'list': {
      const items = Array.isArray(data.items) ? data.items : [];
      const listType = data.listType === 'ol' || data.listType === 'task' || data.listType === 'mixed' ? data.listType : 'ul';
      const orderedCounters = {};
      return items.map((item) => {
        const rawText = String(item && item.text != null ? item.text : '');
        const text = rawText === '' ? 'List item' : rawText;
        const indent = itemIndentText(item);
        const itemType = effectiveListItemType(item, listType);
        resetNestedOrderedListNumbers(item, orderedCounters);
        if (itemType === 'task') {
          const marker = item && /^[-*+]$/.test(item.marker || '') ? item.marker : '-';
          resetOrderedListNumber(item, orderedCounters);
          return `${indent}${marker === '+' ? '-' : marker} [${item && item.checked ? 'x' : ' '}] ${text}`;
        }
        if (itemType === 'ol') {
          const number = nextOrderedListNumber(item, orderedCounters);
          const delimiter = item && /^[.)]$/.test(item.delimiter || '') ? item.delimiter : '.';
          return `${indent}${number}${delimiter} ${text}`;
        }
        const marker = item && /^[-*+]$/.test(item.marker || '') ? item.marker : '-';
        resetOrderedListNumber(item, orderedCounters);
        return `${indent}${marker} ${text}`;
      }).join('\n');
    }
    case 'quote':
      return String(data.text || '').split('\n').map(line => `> ${line}`).join('\n');
    case 'code': {
      const lang = String(data.lang || '').trim();
      const text = String(data.text || '');
      const fence = codeFenceForText(text);
      return `${fence}${lang}\n${text}\n${fence}`;
    }
    case 'math':
      return `$$\n${String(data.tex || '')}\n$$`;
    case 'card':
      return serializeCard(data);
    case 'table':
      return serializeTable(data);
    case 'source':
      return String(data.text != null ? data.text : block.raw || '');
    case 'paragraph':
    default:
      return String(data.text || '');
  }
}

export function serializeMarkdownBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map(block => {
    const before = block && block.data && block.data.before ? String(block.data.before) : '';
    const defaultAfter = block && block.type === 'blank' ? '\n' : '\n\n';
    const after = block && block.data && block.data.after != null ? String(block.data.after) : defaultAfter;
    return `${before}${serializeBlock(block)}${after}`;
  }).join('');
}

export function defaultListItems() {
  return [{ text: 'List item', checked: false, listType: 'ul' }];
}

export function editableListItems(items) {
  return Array.isArray(items) && items.length ? items : defaultListItems();
}

export function isBlockEmptyForBackspace(block) {
  if (!block || typeof block !== 'object') return false;
  const data = block.data || {};
  const blank = (value) => String(value == null ? '' : value).trim() === '';
  if (block.type === 'blank') return true;
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') return blank(data.text);
  if (block.type === 'code' || block.type === 'source') return blank(data.text != null ? data.text : block.raw);
  if (block.type === 'math') return blank(data.tex);
  if (block.type === 'image') return blank(data.src) && blank(data.alt) && blank(data.title);
  if (block.type === 'card') return blank(data.location) && blank(data.label) && blank(data.title);
  if (block.type === 'table') {
    const table = editableTableData(data);
    return table.headers.every(blank) && table.rows.every(row => row.every(blank));
  }
  if (block.type === 'list') {
    return editableListItems(data.items).every(item => blank(item && item.text) && !item.checked);
  }
  return false;
}

export function patchListItem(items, itemIndex, patch = {}) {
  const next = editableListItems(items).slice();
  const safeIndex = Math.max(0, Math.min(Number(itemIndex) || 0, next.length - 1));
  next[safeIndex] = { ...(next[safeIndex] || {}), ...(patch || {}) };
  return next;
}

export function splitListItemsAtEmptyItem(items, itemIndex) {
  const source = Array.isArray(items) && items.length ? items.slice() : editableListItems(items).slice();
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= source.length) return null;
  const current = source[safeIndex] || {};
  if (String(current.text == null ? '' : current.text).trim() !== '') return null;
  if (itemIndentLevel(current) > 0) return null;
  return {
    before: source.slice(0, safeIndex),
    after: source.slice(safeIndex + 1)
  };
}

export function convertListTailItemAfterEmptyToParagraph(items, itemIndex) {
  const source = Array.isArray(items) && items.length ? items.slice() : editableListItems(items).slice();
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex <= 0 || safeIndex !== source.length - 1) return null;
  const previous = source[safeIndex - 1] || {};
  const current = source[safeIndex] || {};
  if (itemIndentLevel(previous) !== 0 || itemIndentLevel(current) !== 0) return null;
  if (String(previous.text == null ? '' : previous.text).trim() !== '') return null;
  const text = normalizeEditableMarkdownText(current.text);
  if (!String(text).trim()) return null;
  return {
    before: source.slice(0, safeIndex - 1),
    text
  };
}

export function outdentEmptyListItemForEnter(items, itemIndex) {
  const source = Array.isArray(items) && items.length ? items.slice() : editableListItems(items).slice();
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= source.length) return null;
  const current = source[safeIndex] || {};
  if (String(current.text == null ? '' : current.text).trim() !== '') return null;
  const currentIndent = itemIndentLevel(current);
  if (currentIndent <= 0) return null;
  const nextIndent = currentIndent - 1;
  const next = source.slice();
  next[safeIndex] = {
    ...current,
    text: '',
    indent: nextIndent,
    indentText: '  '.repeat(nextIndent)
  };
  return next;
}

export function normalizeSplitListStartItems(items) {
  const source = Array.isArray(items) ? items.slice() : [];
  if (!source.length) return source;
  const baseIndent = itemIndentLevel(source[0]);
  if (baseIndent <= 0) return source;
  return source.map(item => {
    const nextIndent = Math.max(0, itemIndentLevel(item) - baseIndent);
    return {
      ...(item || {}),
      indent: nextIndent,
      indentText: '  '.repeat(nextIndent)
    };
  });
}

export function listVisualMarkerLabels(items, blockListType = 'ul') {
  const listType = blockListType === 'ol' || blockListType === 'task' || blockListType === 'mixed' ? blockListType : 'ul';
  const counters = {};
  return editableListItems(items).map(item => {
    const itemType = effectiveListItemType(item, listType);
    resetNestedOrderedListNumbers(item, counters);
    if (itemType === 'task') {
      resetOrderedListNumber(item, counters);
      return '';
    }
    if (itemType === 'ol') {
      const delimiter = item && /^[.)]$/.test(item.delimiter || '') ? item.delimiter : '.';
      return `${nextOrderedListNumber(item, counters)}${delimiter}`;
    }
    resetOrderedListNumber(item, counters);
    return '•';
  });
}

export function patchListItemType(items, itemIndex, nextType, blockListType = 'ul') {
  const normalizedType = normalizeListItemType(nextType);
  const next = editableListItems(items).slice();
  const safeIndex = Math.max(0, Math.min(Number(itemIndex) || 0, next.length - 1));
  const targetIndent = itemIndentLevel(next[safeIndex]);
  let groupStart = 0;
  for (let index = safeIndex - 1; index >= 0; index -= 1) {
    if (itemIndentLevel(next[index]) < targetIndent) {
      groupStart = index + 1;
      break;
    }
  }
  let groupEnd = next.length;
  for (let index = safeIndex + 1; index < next.length; index += 1) {
    if (itemIndentLevel(next[index]) < targetIndent) {
      groupEnd = index;
      break;
    }
  }
  const sameIndentIndexes = next.slice(groupStart, groupEnd)
    .map((item, index) => itemIndentLevel(item) === targetIndent ? index : -1)
    .filter(index => index >= 0)
    .map(index => index + groupStart);
  const typesAtIndent = new Set(sameIndentIndexes.map(index => effectiveListItemType(next[index], blockListType)));
  const targetIndexes = typesAtIndent.size === 1 ? sameIndentIndexes : [safeIndex];

  targetIndexes.forEach(index => {
    const item = next[index] || {};
    next[index] = {
      ...item,
      listType: normalizedType
    };
    if (normalizedType === 'task') next[index].checked = !!(item && item.checked);
    if (normalizedType === 'ul' && !/^[-*+]$/.test(next[index].marker || '')) next[index].marker = '-';
    if (normalizedType === 'ol' && !/^[.)]$/.test(next[index].delimiter || '')) next[index].delimiter = '.';
  });

  return {
    listType: summarizeListType(next, normalizeListItemType(blockListType)),
    items: next
  };
}

export function patchStandardListItemType(items, itemIndex, nextType, blockListType = 'ul') {
  return patchListItemType(items, itemIndex, nextType, blockListType);
}

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[ch]);
}

export function inlineRun(text, marks = {}) {
  const link = marks.link ? sanitizeEditorLinkHref(marks.link) : '';
  const math = !!marks.math;
  const run = {
    text: String(text == null ? '' : text),
    bold: !!marks.bold,
    italic: !!marks.italic,
    strike: !!marks.strike,
    code: !!marks.code,
    math,
    link,
    linkTitle: link ? sanitizeEditorLinkTitle(marks.linkTitle) : ''
  };
  if (run.code || run.math) {
    run.bold = false;
    run.italic = false;
    run.strike = false;
    run.link = '';
    run.linkTitle = '';
    if (run.code) run.math = false;
    if (run.math) run.code = false;
  }
  return run;
}

function sameInlineMarks(a = {}, b = {}) {
  return !!a.bold === !!b.bold
    && !!a.italic === !!b.italic
    && !!a.strike === !!b.strike
    && !!a.code === !!b.code
    && !!a.math === !!b.math
    && String(a.link || '') === String(b.link || '')
    && String(a.linkTitle || '') === String(b.linkTitle || '');
}

export function appendInlineRun(runs, text, marks = {}) {
  const run = inlineRun(text, marks);
  if (!run.text) return runs;
  const previous = runs[runs.length - 1];
  if (previous && sameInlineMarks(previous, run)) {
    previous.text += run.text;
  } else {
    runs.push(run);
  }
  return runs;
}

export function mergeInlineRuns(runs) {
  return (Array.isArray(runs) ? runs : []).reduce((out, run) => {
    appendInlineRun(out, run && run.text, run || {});
    return out;
  }, []);
}

function findUnescaped(input, needle, start = 0) {
  const text = String(input || '');
  let index = Math.max(0, Number(start) || 0);
  while (index < text.length) {
    const found = text.indexOf(needle, index);
    if (found < 0) return -1;
    let slashCount = 0;
    for (let cursor = found - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) slashCount += 1;
    if (slashCount % 2 === 0) return found;
    index = found + needle.length;
  }
  return -1;
}

function isMarkdownEscapablePunctuation(value) {
  return /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/.test(String(value || ''));
}

function findInlineLink(input, start) {
  const text = String(input || '');
  if (text[start] !== '[') return null;
  const labelEnd = findMarkdownLinkLabelEnd(text, start + 1);
  if (labelEnd < 0 || text[labelEnd + 1] !== '(') return null;
  const hrefStart = labelEnd + 2;
  const hrefEnd = findMarkdownLinkDestinationEnd(text, hrefStart);
  if (hrefEnd <= hrefStart) return null;
  const parsed = parseMarkdownLinkDestination(text.slice(hrefStart, hrefEnd));
  if (!parsed) return null;
  return {
    label: text.slice(start + 1, labelEnd),
    href: parsed.href,
    title: parsed.title,
    end: hrefEnd + 1
  };
}

function findInlineMath(input, start) {
  const text = String(input || '');
  if (!text.startsWith('\\(', start)) return null;
  const end = findUnescaped(text, '\\)', start + 2);
  if (end <= start + 2) return null;
  const tex = text.slice(start + 2, end).trim();
  if (!tex) return null;
  return { tex, end: end + 2 };
}

function findMarkdownLinkLabelEnd(input, start) {
  const text = String(input || '');
  let depth = 0;
  for (let index = Math.max(0, Number(start) || 0); index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '\\') {
      index += 1;
      continue;
    }
    if (ch === '[') {
      depth += 1;
      continue;
    }
    if (ch === ']') {
      if (depth <= 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function findMarkdownLinkDestinationEnd(input, start) {
  const text = String(input || '');
  let depth = 0;
  let quote = '';
  let angle = false;
  for (let index = Math.max(0, Number(start) || 0); index < text.length; index += 1) {
    const ch = text[index];
    if (ch === '\\') {
      index += 1;
      continue;
    }
    if (angle) {
      if (ch === '>') angle = false;
      continue;
    }
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '<') {
      angle = true;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      if (depth <= 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

function parseMarkdownLinkDestination(value) {
  const body = String(value || '').trim();
  if (!body) return null;
  if (body.startsWith('<')) {
    const close = findUnescaped(body, '>', 1);
    if (close <= 1) return null;
    const title = parseMarkdownLinkTitle(body.slice(close + 1).trim());
    if (title == null) return null;
    return { href: body.slice(1, close), title };
  }
  if (!/\s/.test(body)) return { href: body, title: '' };
  const match = body.match(/^(\S+)\s+(.+)$/);
  if (!match) return null;
  const title = parseMarkdownLinkTitle(match[2]);
  return title == null ? null : { href: match[1] || '', title };
}

function parseMarkdownLinkTitle(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/);
  if (!match) return null;
  return match[1] != null ? match[1] : match[2] != null ? match[2] : match[3] || '';
}

function canOpenInlineMarker(text, index, marker) {
  if (marker !== '_') return true;
  return !isInlineWordChar(String(text || '')[index - 1]);
}

function canCloseInlineMarker(text, index, marker) {
  if (marker !== '_') return true;
  return !isInlineWordChar(String(text || '')[index + marker.length]);
}

function findInlineMarkerEnd(text, marker, start) {
  let search = start;
  while (search < text.length) {
    const end = findUnescaped(text, marker, search);
    if (end < 0) return -1;
    if (end > start && canCloseInlineMarker(text, end, marker)) return end;
    search = end + marker.length;
  }
  return -1;
}

function backtickRunLength(text, start) {
  let end = start;
  while (end < text.length && text[end] === '`') end += 1;
  return end - start;
}

function findCodeSpanEnd(text, start, length) {
  let search = start;
  while (search < text.length) {
    if (text[search] !== '`') {
      search += 1;
      continue;
    }
    const candidateLength = backtickRunLength(text, search);
    if (candidateLength === length) return search;
    search += candidateLength;
  }
  return -1;
}

function parseInlineRunsInternal(input, marks = {}) {
  const text = String(input || '');
  const runs = [];
  let index = 0;

  while (index < text.length) {
    if (text[index] === '\\' && index + 1 < text.length) {
      const math = findInlineMath(text, index);
      if (math) {
        appendInlineRun(runs, math.tex, { math: true });
        index = math.end;
        continue;
      }
      if (isMarkdownEscapablePunctuation(text[index + 1])) {
        appendInlineRun(runs, text[index + 1], marks);
        index += 2;
      } else {
        appendInlineRun(runs, text[index], marks);
        index += 1;
      }
      continue;
    }

    const link = findInlineLink(text, index);
    if (link) {
      parseInlineRunsInternal(link.label, { ...marks, link: link.href, linkTitle: link.title }).forEach(run => appendInlineRun(runs, run.text, run));
      index = link.end;
      continue;
    }

    if (text[index] === '`') {
      const fenceLength = backtickRunLength(text, index);
      const end = findCodeSpanEnd(text, index + fenceLength, fenceLength);
      if (end >= index + fenceLength) {
        appendInlineRun(runs, normalizeMarkdownCodeSpanText(text.slice(index + fenceLength, end)), { code: true });
        index = end + fenceLength;
        continue;
      }
    }

    const patterns = [
      ['**', { bold: true }],
      ['~~', { strike: true }],
      ['_', { italic: true }],
      ['*', { italic: true }]
    ];
    let matched = false;
    for (const [marker, patch] of patterns) {
      if (!text.startsWith(marker, index)) continue;
      if (!canOpenInlineMarker(text, index, marker)) continue;
      const end = findInlineMarkerEnd(text, marker, index + marker.length);
      if (end <= index + marker.length) continue;
      const body = text.slice(index + marker.length, end);
      parseInlineRunsInternal(body, { ...marks, ...patch }).forEach(run => appendInlineRun(runs, run.text, run));
      index = end + marker.length;
      matched = true;
      break;
    }
    if (matched) continue;

    appendInlineRun(runs, text[index], marks);
    index += 1;
  }

  return mergeInlineRuns(runs);
}

export function parseInlineRuns(markdown) {
  return parseInlineRunsInternal(String(markdown || ''), {});
}

function escapeMarkdownLinkHref(value) {
  const href = sanitizeEditorLinkHref(value).replace(/\s+/g, '%20');
  const out = [];
  const openIndexes = [];
  for (const ch of href) {
    if (ch === '(') {
      openIndexes.push(out.length);
      out.push(ch);
    } else if (ch === ')') {
      if (openIndexes.length) {
        openIndexes.pop();
        out.push(ch);
      } else {
        out.push('%29');
      }
    } else {
      out.push(ch);
    }
  }
  openIndexes.forEach(index => { out[index] = '%28'; });
  return out.join('');
}

export function linkTitleForRun(run) {
  const explicit = sanitizeEditorLinkTitle(run && run.linkTitle);
  if (explicit) return explicit;
  const fallback = sanitizeEditorLinkTitle(run && run.text);
  return fallback || sanitizeEditorLinkTitle(run && run.link);
}

function serializeInlineRun(run) {
  const text = String(run && run.text != null ? run.text : '');
  if (!text) return '';
  if (run && run.math) return `\\(${text}\\)`;
  if (run && run.code) return serializeMarkdownCodeSpan(text);
  let out = escapeMarkdownInline(text);
  if (run && run.italic) out = `_${out}_`;
  if (run && run.bold) out = `**${out}**`;
  if (run && run.strike) out = `~~${out}~~`;
  if (run && run.link) out = `[${out}](${escapeMarkdownLinkHref(run.link)} "${escapeMarkdownLinkTitle(linkTitleForRun(run))}")`;
  return out;
}

export function serializeInlineRuns(runs) {
  return mergeInlineRuns(runs).map(serializeInlineRun).join('');
}

export function normalizeEditableMarkdownText(value) {
  return String(value == null ? '' : value).replace(/\n{3,}/g, '\n\n');
}

export function splitTextBlockIntoParagraph(block, before, after) {
  if (!block || !['paragraph', 'heading', 'quote'].includes(block.type)) return null;
  const data = block.data && typeof block.data === 'object' ? block.data : {};
  const current = {
    ...block,
    dirty: true,
    data: {
      ...data,
      text: normalizeEditableMarkdownText(before)
    }
  };
  const next = makeBlock('paragraph', '', {
    text: normalizeEditableMarkdownText(after),
    after: '\n\n',
    dirty: true
  });
  next.dirty = true;
  return [current, next];
}

export function isMergeableTextBlock(block) {
  return !!(block && ['paragraph', 'heading', 'quote'].includes(block.type));
}

function textBlockDataText(block) {
  return normalizeEditableMarkdownText(block && block.data ? block.data.text : '');
}

export function joinMergedEditableText(before, after) {
  const left = normalizeEditableMarkdownText(before);
  const right = normalizeEditableMarkdownText(after);
  if (!left) return { text: right, separator: '' };
  if (!right) return { text: left, separator: '' };
  const separator = /\s$/.test(left) || /^\s/.test(right) ? '' : ' ';
  return {
    text: `${left}${separator}${right}`,
    separator
  };
}

export function inlineRenderedTextLength(markdownText) {
  return parseInlineRuns(normalizeEditableMarkdownText(markdownText))
    .reduce((total, run) => total + String(run && run.text != null ? run.text : '').length, 0);
}

export function mergeTextBlockIntoPrevious(previousBlock, currentBlock) {
  if (!isMergeableTextBlock(previousBlock) || !isMergeableTextBlock(currentBlock)) return null;
  const previousText = textBlockDataText(previousBlock);
  const currentText = textBlockDataText(currentBlock);
  const mergedText = joinMergedEditableText(previousText, currentText);
  return {
    ...previousBlock,
    dirty: true,
    focusCaretOffset: inlineRenderedTextLength(previousText) + mergedText.separator.length,
    data: {
      ...(previousBlock.data && typeof previousBlock.data === 'object' ? previousBlock.data : {}),
      text: mergedText.text
    }
  };
}

export function isMergeableListBlock(block) {
  return !!(block && block.type === 'list');
}

export function listBlockItems(block) {
  return editableListItems(block && block.data ? block.data.items : null).slice();
}

function listItemText(item) {
  return normalizeEditableMarkdownText(item && item.text);
}

function listItemHasNestedChildren(items, itemIndex) {
  const source = Array.isArray(items) ? items : [];
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex < 0 || safeIndex >= source.length) return false;
  const currentIndent = itemIndentLevel(source[safeIndex]);
  for (let index = safeIndex + 1; index < source.length; index += 1) {
    const nextIndent = itemIndentLevel(source[index]);
    if (nextIndent <= currentIndent) return false;
    return true;
  }
  return false;
}

export function mergeTextBlockIntoPreviousList(previousBlock, currentBlock) {
  if (!isMergeableListBlock(previousBlock) || !isMergeableTextBlock(currentBlock)) return null;
  const items = listBlockItems(previousBlock);
  if (!items.length) return null;
  const lastIndex = items.length - 1;
  const previousText = listItemText(items[lastIndex]);
  const currentText = textBlockDataText(currentBlock);
  const mergedText = joinMergedEditableText(previousText, currentText);
  items[lastIndex] = {
    ...(items[lastIndex] || {}),
    text: mergedText.text
  };
  return {
    ...previousBlock,
    dirty: true,
    focusItemIndex: lastIndex,
    focusCaretOffset: inlineRenderedTextLength(previousText) + mergedText.separator.length,
    data: {
      ...(previousBlock.data && typeof previousBlock.data === 'object' ? previousBlock.data : {}),
      items
    }
  };
}

export function mergeListItemIntoPreviousItem(items, itemIndex) {
  const source = Array.isArray(items) && items.length ? items.slice() : editableListItems(items).slice();
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex <= 0 || safeIndex >= source.length) return null;
  const previous = source[safeIndex - 1] || {};
  const current = source[safeIndex] || {};
  if (itemIndentLevel(previous) !== itemIndentLevel(current)) return null;
  if (listItemHasNestedChildren(source, safeIndex)) return null;
  const next = source.slice();
  const previousText = listItemText(previous);
  const mergedText = joinMergedEditableText(previousText, listItemText(current));
  const caretOffset = inlineRenderedTextLength(previousText) + mergedText.separator.length;
  next[safeIndex - 1] = {
    ...previous,
    text: mergedText.text
  };
  next.splice(safeIndex, 1);
  return {
    items: next,
    focusItemIndex: safeIndex - 1,
    caretOffset
  };
}

export function mergeFirstListItemIntoPreviousBlock(previousBlock, currentBlock, itemIndex = 0) {
  if (!currentBlock || currentBlock.type !== 'list') return null;
  const safeIndex = Number(itemIndex);
  if (!Number.isInteger(safeIndex) || safeIndex !== 0) return null;
  if (!isMergeableTextBlock(previousBlock) && !isMergeableListBlock(previousBlock)) return null;
  const items = listBlockItems(currentBlock);
  const currentItem = items[0] || {};
  if (itemIndentLevel(currentItem) !== 0 || listItemHasNestedChildren(items, 0)) return null;
  const currentText = listItemText(currentItem);
  const remainingItems = items.slice(1);
  if (isMergeableTextBlock(previousBlock)) {
    const previousText = textBlockDataText(previousBlock);
    const mergedText = joinMergedEditableText(previousText, currentText);
    return {
      previousBlock: {
        ...previousBlock,
        dirty: true,
        data: {
          ...(previousBlock.data && typeof previousBlock.data === 'object' ? previousBlock.data : {}),
          text: mergedText.text
        }
      },
      currentBlock: remainingItems.length
        ? {
            ...currentBlock,
            dirty: true,
            data: {
              ...(currentBlock.data && typeof currentBlock.data === 'object' ? currentBlock.data : {}),
              items: remainingItems
            }
          }
        : null,
      focus: { type: 'text', caretOffset: inlineRenderedTextLength(previousText) + mergedText.separator.length }
    };
  }
  const previousItems = listBlockItems(previousBlock);
  if (!previousItems.length) return null;
  const lastIndex = previousItems.length - 1;
  const previousText = listItemText(previousItems[lastIndex]);
  const mergedText = joinMergedEditableText(previousText, currentText);
  previousItems[lastIndex] = {
    ...(previousItems[lastIndex] || {}),
    text: mergedText.text
  };
  return {
    previousBlock: {
      ...previousBlock,
      dirty: true,
      data: {
        ...(previousBlock.data && typeof previousBlock.data === 'object' ? previousBlock.data : {}),
        items: previousItems
      }
    },
    currentBlock: remainingItems.length
      ? {
          ...currentBlock,
          dirty: true,
          data: {
            ...(currentBlock.data && typeof currentBlock.data === 'object' ? currentBlock.data : {}),
            items: remainingItems
          }
        }
      : null,
    focus: { type: 'list', itemIndex: lastIndex, caretOffset: inlineRenderedTextLength(previousText) + mergedText.separator.length }
  };
}

export function inlineRunsTextLength(runs) {
  return mergeInlineRuns(runs).reduce((total, run) => total + String(run.text || '').length, 0);
}

export function inlineMarksAtOffset(runs, offset) {
  const safeRuns = mergeInlineRuns(runs);
  const target = Math.max(0, Number(offset) || 0);
  let cursor = 0;
  let previous = null;
  for (const run of safeRuns) {
    const length = String(run.text || '').length;
    if (!length) continue;
    const next = cursor + length;
    if (target === cursor || (target > cursor && target < next)) return { ...run, text: '' };
    if (target === next) previous = run;
    cursor += length;
  }
  return { ...(previous || safeRuns[safeRuns.length - 1] || {}), text: '' };
}

function inlineMarkedRangeAtOffset(runs, offset, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  const target = Math.max(0, Number(offset) || 0);
  let cursor = 0;
  const ranges = [];
  mergeInlineRuns(runs).forEach(run => {
    const text = String(run.text || '');
    const length = text.length;
    if (!length) return;
    const next = cursor + length;
    ranges.push({
      start: cursor,
      end: next,
      marked: command === 'link' ? !!run.link : !!run[command]
    });
    cursor = next;
  });

  let index = -1;
  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i];
    if (range.marked && (target === range.start || target === range.end || (target > range.start && target < range.end))) {
      index = i;
      break;
    }
    if (target < range.end) break;
  }
  if (index < 0) return null;
  let startIndex = index;
  let endIndex = index;
  while (startIndex > 0 && ranges[startIndex - 1].marked) startIndex -= 1;
  while (endIndex + 1 < ranges.length && ranges[endIndex + 1].marked) endIndex += 1;
  return { start: ranges[startIndex].start, end: ranges[endIndex].end };
}

export function inlineRangeText(runs, start, end) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  let cursor = 0;
  let out = '';
  mergeInlineRuns(runs).forEach(run => {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (next > safeStart && cursor < safeEnd) {
      out += text.slice(Math.max(0, safeStart - cursor), Math.max(0, safeEnd - cursor));
    }
    cursor = next;
  });
  return out;
}

export function rangeHasInlineText(runs, start, end) {
  return inlineRangeText(runs, start, end).length > 0;
}

function mutateInlineRunsInRange(runs, start, end, mutator) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  let cursor = 0;
  const out = [];
  mergeInlineRuns(runs).forEach(run => {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (!text || next <= safeStart || cursor >= safeEnd) {
      appendInlineRun(out, text, run);
      cursor = next;
      return;
    }
    const beforeEnd = Math.max(0, safeStart - cursor);
    const selectedStart = Math.max(0, safeStart - cursor);
    const selectedEnd = Math.min(text.length, safeEnd - cursor);
    if (beforeEnd > 0) appendInlineRun(out, text.slice(0, beforeEnd), run);
    if (selectedEnd > selectedStart) {
      const selected = mutator({ ...run, text: text.slice(selectedStart, selectedEnd) });
      appendInlineRun(out, selected.text, selected);
    }
    if (selectedEnd < text.length) appendInlineRun(out, text.slice(selectedEnd), run);
    cursor = next;
  });
  return mergeInlineRuns(out);
}

export function inlineRangeFullyMarked(runs, start, end, mark) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  if (safeEnd <= safeStart) return false;
  let cursor = 0;
  let sawText = false;
  for (const run of mergeInlineRuns(runs)) {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (next > safeStart && cursor < safeEnd) {
      sawText = true;
      if (mark === 'link') {
        if (!run.link) return false;
      } else if (!run[mark]) {
        return false;
      }
    }
    cursor = next;
  }
  return sawText;
}

export function inlineRangeAnyMarked(runs, start, end, mark) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  if (safeEnd <= safeStart) return false;
  let cursor = 0;
  for (const run of mergeInlineRuns(runs)) {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (next > safeStart && cursor < safeEnd && !!run[mark]) return true;
    cursor = next;
  }
  return false;
}

export function removeInlineMarkInRange(runs, start, end, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  return mutateInlineRunsInRange(runs, start, end, run => {
    if (command === 'code' || command === 'math') return inlineRun(run.text, {});
    if (run.code || run.math) return run;
    return inlineRun(run.text, { ...run, [command]: command === 'link' ? '' : false, ...(command === 'link' ? { linkTitle: '' } : {}) });
  });
}

export function toggleInlineMarkOnRuns(runs, start, end, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  if (!['bold', 'italic', 'strike', 'code'].includes(command) || !rangeHasInlineText(runs, start, end)) {
    return mergeInlineRuns(runs);
  }
  const shouldApply = command === 'code'
    ? !inlineRangeFullyMarked(runs, start, end, command)
    : !inlineRangeAnyMarked(runs, start, end, command);
  return mutateInlineRunsInRange(runs, start, end, run => {
    if (command === 'code') return shouldApply ? inlineRun(run.text, { code: true }) : inlineRun(run.text, {});
    if (run.code || run.math) return run;
    return inlineRun(run.text, { ...run, [command]: shouldApply });
  });
}

export function removeInlineMarkAroundOffset(runs, offset, mark) {
  const command = mark === 'strikeThrough' ? 'strike' : mark;
  if (!['bold', 'italic', 'strike', 'code', 'math', 'link'].includes(command)) return mergeInlineRuns(runs);
  const range = inlineMarkedRangeAtOffset(runs, offset, command);
  if (!range) return mergeInlineRuns(runs);
  return removeInlineMarkInRange(runs, range.start, range.end, command);
}

export function insertInlineRunsAtRange(runs, start, end, insertRuns = []) {
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  let cursor = 0;
  let inserted = false;
  const out = [];
  mergeInlineRuns(runs).forEach(run => {
    const text = String(run.text || '');
    const next = cursor + text.length;
    if (next <= safeStart || cursor >= safeEnd) {
      if (!inserted && cursor >= safeEnd) {
        mergeInlineRuns(insertRuns).forEach(insertRun => appendInlineRun(out, insertRun.text, insertRun));
        inserted = true;
      }
      appendInlineRun(out, text, run);
      cursor = next;
      return;
    }
    if (cursor < safeStart) appendInlineRun(out, text.slice(0, safeStart - cursor), run);
    if (!inserted) {
      mergeInlineRuns(insertRuns).forEach(insertRun => appendInlineRun(out, insertRun.text, insertRun));
      inserted = true;
    }
    if (next > safeEnd) appendInlineRun(out, text.slice(safeEnd - cursor), run);
    cursor = next;
  });
  if (!inserted) mergeInlineRuns(insertRuns).forEach(insertRun => appendInlineRun(out, insertRun.text, insertRun));
  return mergeInlineRuns(out);
}

export function applyInlineLinkToRuns(runs, start, end, href, replacementText = null, title = '') {
  const safeHref = sanitizeEditorLinkHref(href);
  const safeTitle = sanitizeEditorLinkTitle(title);
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  if (replacementText != null) {
    const marks = inlineMarksAtOffset(runs, safeEnd > safeStart ? safeStart + 1 : safeStart);
    const replacement = inlineRun(String(replacementText || ''), { ...marks, code: false, link: safeHref, linkTitle: safeTitle });
    return insertInlineRunsAtRange(runs, safeStart, safeEnd, replacement.text ? [replacement] : []);
  }
  return mutateInlineRunsInRange(runs, safeStart, safeEnd, run => {
    if (run.code || run.math) return run;
    return inlineRun(run.text, { ...run, link: safeHref, linkTitle: safeTitle });
  });
}

export function applyInlineMathToRuns(runs, start, end, tex) {
  const source = String(tex == null ? '' : tex).trim();
  const safeStart = Math.max(0, Number(start) || 0);
  const safeEnd = Math.max(safeStart, Number(end) || 0);
  if (!source) return insertInlineRunsAtRange(runs, safeStart, safeEnd, []);
  return insertInlineRunsAtRange(runs, safeStart, safeEnd, [inlineRun(source, { math: true })]);
}
