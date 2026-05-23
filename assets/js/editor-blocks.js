import { renderPressMath } from './math-render.js?v=press-system-v3.4.50';
import { createSafeHighlightFragment, detectLanguage } from './syntax-highlight.js?v=press-system-v3.4.50';
import { createEditorBlocksRuntime } from './editor-blocks-runtime.js?v=press-system-v3.4.50';
import { createEditorBlocksStateController } from './editor-blocks-state.js?v=press-system-v3.4.50';
import { createEditorBlocksMenuSession } from './editor-blocks-menu-session.js?v=press-system-v3.4.50';
import { createEditorBlocksEditableSession } from './editor-blocks-editable-session.js?v=press-system-v3.4.50';
import { createEditorBlocksSelectionSession } from './editor-blocks-selection-session.js?v=press-system-v3.4.50';
import { createEditorBlocksInlineDomSession } from './editor-blocks-inline-dom-session.js?v=press-system-v3.4.50';
import { CARET_POINT_MEASURE_LIMIT, createEditorBlocksCaretSession } from './editor-blocks-caret-session.js?v=press-system-v3.4.50';
import { createEditorBlocksFocusSession } from './editor-blocks-focus-session.js?v=press-system-v3.4.50';
import { createEditorBlocksPointerSession } from './editor-blocks-pointer-session.js?v=press-system-v3.4.50';
import { createEditorBlocksActiveSession } from './editor-blocks-active-session.js?v=press-system-v3.4.50';
import { createEditorBlocksInlineToolbarSession } from './editor-blocks-inline-toolbar-session.js?v=press-system-v3.4.50';
import { createEditorBlocksLinkSession } from './editor-blocks-link-session.js?v=press-system-v3.4.50';
import { createEditorBlocksMathSession } from './editor-blocks-math-session.js?v=press-system-v3.4.50';
import { createEditorBlocksTableSession } from './editor-blocks-table-session.js?v=press-system-v3.4.50';
import { createEditorBlocksCardPickerSession } from './editor-blocks-card-picker-session.js?v=press-system-v3.4.50';

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'image', 'list', 'quote', 'code', 'math', 'card', 'table', 'source', 'blank']);
const CODE_LANGUAGE_OPTIONS = [
  '', 'plain', 'text', 'raw', 'none', 'nohighlight',
  'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'ini', 'java',
  'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'markdown',
  'objectivec', 'perl', 'php', 'php-template', 'plaintext', 'python',
  'python-repl', 'r', 'ruby', 'rust', 'scss', 'shell', 'sql', 'swift',
  'typescript', 'vbnet', 'wasm', 'xml', 'yaml',
  'html', 'yml', 'robots'
];
const CODE_PLAIN_LANGUAGES = new Set(['plain', 'text', 'none', 'raw', 'nohighlight', 'plaintext']);
const CODE_LANGUAGE_ALIASES = new Map([
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['sh', 'bash'],
  ['zsh', 'bash'],
  ['html', 'xml'],
  ['htm', 'xml'],
  ['yml', 'yaml'],
  ['md', 'markdown']
]);
const CODE_HIGHLIGHT_LANGUAGES = new Set(CODE_LANGUAGE_OPTIONS
  .map(value => CODE_LANGUAGE_ALIASES.get(value) || value)
  .filter(value => value && !CODE_PLAIN_LANGUAGES.has(value)));
const fallbackSelectionSession = createEditorBlocksSelectionSession();

function normalizeSelectionSession(selectionSession) {
  return selectionSession && typeof selectionSession.getSelectionRange === 'function'
    ? selectionSession
    : fallbackSelectionSession;
}

function createInlineDomSession(selectionSession = null, documentRef = typeof document !== 'undefined' ? document : null) {
  return createEditorBlocksInlineDomSession({
    documentRef,
    selectionSession: normalizeSelectionSession(selectionSession),
    mergeInlineRuns,
    sanitizeLinkHref: sanitizeEditorLinkHref,
    linkTitleForRun,
    renderMath: renderPressMath,
    nodeContains
  });
}

const fallbackInlineDomSession = createInlineDomSession(fallbackSelectionSession);

function normalizeInlineDomSession(inlineDomSession) {
  return inlineDomSession && typeof inlineDomSession.renderInlineRunsInto === 'function'
    ? inlineDomSession
    : fallbackInlineDomSession;
}

function createCaretSession(selectionSession = null) {
  return createEditorBlocksCaretSession({
    selectionSession: normalizeSelectionSession(selectionSession),
    nodeContains,
    serializeInlineDom,
    editableVisibleText
  });
}

const fallbackCaretSession = createCaretSession(fallbackSelectionSession);

function normalizeCaretSession(caretSessionOrSelectionSession) {
  if (caretSessionOrSelectionSession && typeof caretSessionOrSelectionSession.selectionOffsets === 'function') {
    return caretSessionOrSelectionSession;
  }
  if (caretSessionOrSelectionSession && typeof caretSessionOrSelectionSession.getSelectionRange === 'function') {
    return createCaretSession(caretSessionOrSelectionSession);
  }
  return fallbackCaretSession;
}

function normalizeText(value) {
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

function makeBlock(type, raw, data = {}) {
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

function splitBlankLineUnits(value) {
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

function makeBlankBlock(after = '\n', data = {}) {
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

function normalizeStandardListType(value, fallback = 'ul') {
  if (value === 'ol') return 'ol';
  if (value === 'ul') return 'ul';
  return fallback === 'ol' ? 'ol' : 'ul';
}

function normalizeListItemType(value, fallback = 'ul') {
  if (value === 'task') return 'task';
  if (fallback === 'task' && value !== 'ol' && value !== 'ul') return 'task';
  return normalizeStandardListType(value, fallback);
}

function effectiveListItemType(item, blockListType = 'ul') {
  return normalizeListItemType(item && item.listType, blockListType);
}

function summarizeListType(items, fallback = 'ul') {
  const safeItems = Array.isArray(items) ? items : [];
  const types = new Set(safeItems.map(item => effectiveListItemType(item, fallback)));
  if (types.size > 1) return 'mixed';
  if (types.has('task')) return 'task';
  return types.has('ol') ? 'ol' : 'ul';
}

function itemIndentLevel(item) {
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

function normalizeTableAlignment(value) {
  const align = String(value || '').trim().toLowerCase();
  return TABLE_ALIGNMENTS.has(align) ? align : '';
}

function normalizeTableCellValue(value) {
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

function sanitizeEditorLinkHref(value) {
  const href = String(value == null ? '' : value).trim();
  const protocol = href.toLowerCase().match(/^([a-z][a-z0-9+.-]*):/);
  if (!protocol) return href;
  return ['http', 'https', 'mailto', 'tel'].includes(protocol[1]) ? href : '#';
}

function sanitizeEditorLinkTitle(value) {
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

function tableColumnCount(data = {}) {
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

function editableTableData(data = {}) {
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

function defaultListItems() {
  return [{ text: 'List item', checked: false, listType: 'ul' }];
}

function editableListItems(items) {
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

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[ch]);
}

function inlineRun(text, marks = {}) {
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

function appendInlineRun(runs, text, marks = {}) {
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

function mergeInlineRuns(runs) {
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

function linkTitleForRun(run) {
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

function renderInlineRunsInto(root, runs, inlineDomSession = null) {
  normalizeInlineDomSession(inlineDomSession).renderInlineRunsInto(root, runs);
}

function inlineRunsFromDom(root) {
  const runs = [];
  const walk = (node, marks = {}) => {
    if (!node) return;
    if (node.nodeType === 1 && node.matches && node.matches('.press-math[data-tex]')) {
      appendInlineRun(runs, node.getAttribute('data-tex') || node.dataset.tex || '', { math: true });
      return;
    }
    if (node.nodeType === 3) {
      appendInlineRun(runs, node.nodeValue || '', marks);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = String(node.tagName || '').toLowerCase();
    if (tag === 'br') {
      appendInlineRun(runs, '\n', marks);
      return;
    }
    let nextMarks = { ...marks };
    if (tag === 'strong' || tag === 'b') nextMarks.bold = true;
    if (tag === 'em' || tag === 'i') nextMarks.italic = true;
    if (tag === 's' || tag === 'del' || tag === 'strike') nextMarks.strike = true;
    if (tag === 'code') nextMarks = { code: true };
    if (tag === 'a' && !nextMarks.code) {
      nextMarks.link = node.getAttribute('href') || '';
      nextMarks.linkTitle = node.getAttribute('title') || '';
    }
    Array.from(node.childNodes || []).forEach(child => walk(child, nextMarks));
    if (tag === 'div') appendInlineRun(runs, '\n', marks);
  };
  Array.from(root && root.childNodes ? root.childNodes : []).forEach(child => walk(child, {}));
  return mergeInlineRuns(runs);
}

function serializeInlineDom(root) {
  return serializeInlineRuns(inlineRunsFromDom(root));
}

function setPlainContentEditableValue(el, value) {
  if (!el) return;
  renderInlineRunsInto(el, parseInlineRuns(value));
}

function button(label, className = 'blocks-btn') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}

// Icons are inline Lucide SVG paths (https://lucide.dev, ISC License).
const BLOCK_TYPE_ICON_PATHS = {
  paragraph: '<path d="M13 4v16" /><path d="M17 4v16" /><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />',
  heading: '<path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
  list: '<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />',
  quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" /><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />',
  code: '<path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" />',
  math: '<path d="M4 19h16" /><path d="M8 5h8" /><path d="M9 5c4 4 4 10 0 14" /><path d="M15 5c-4 4-4 10 0 14" />',
  table: '<path d="M3 5h18" /><path d="M3 12h18" /><path d="M3 19h18" /><path d="M5 5v14" /><path d="M12 5v14" /><path d="M19 5v14" />',
  source: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 12.5 8 15l2 2.5" /><path d="m14 12.5 2 2.5-2 2.5" />',
  card: '<path d="M15 18h-5" /><path d="M18 14h-8" /><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" /><rect width="8" height="4" x="10" y="6" rx="1" />',
  blank: '<path d="M5 6h14" /><path d="M5 18h14" /><path d="M12 10v4" /><path d="M10 12h4" />'
};

function createBlockTypeIcon(blockType) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.innerHTML = BLOCK_TYPE_ICON_PATHS[blockType] || BLOCK_TYPE_ICON_PATHS.paragraph;
  return svg;
}

function inputValue(input) {
  return input ? String(input.value || '') : '';
}

function plainEditableValue(editable) {
  return String(editable && editable.textContent != null ? editable.textContent : '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n]+/g, ' ');
}

function insertPlainTextIntoEditable(editable, text, selectionSession = null) {
  if (!editable) return false;
  const value = String(text == null ? '' : text);
  const selectionTools = normalizeSelectionSession(selectionSession);
  try {
    const range = selectionTools.getSelectionRange(editable);
    if (!nodeContains(editable, range.startContainer) || !nodeContains(editable, range.endContainer)) return false;
    range.deleteContents();
    const node = selectionTools.createTextNode(editable, value);
    if (!node) return false;
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    return selectionTools.selectRange(range, editable);
  } catch (_) {
    return false;
  }
}

function resolveCodeHighlightLanguage(language, codeText) {
  const raw = String(language || '').trim();
  const normalized = raw.toLowerCase();
  const resolved = CODE_LANGUAGE_ALIASES.get(normalized) || normalized;
  if (CODE_PLAIN_LANGUAGES.has(normalized)) {
    return { language: 'plain', label: 'PLAIN', highlight: false };
  }
  if (CODE_HIGHLIGHT_LANGUAGES.has(resolved)) {
    return { language: resolved, label: resolved.toUpperCase(), highlight: true };
  }
  if (!normalized) {
    const detected = String(detectLanguage(String(codeText || '')) || '').toLowerCase();
    const detectedResolved = CODE_LANGUAGE_ALIASES.get(detected) || detected;
    if (CODE_HIGHLIGHT_LANGUAGES.has(detectedResolved)) {
      return { language: detectedResolved, label: detectedResolved.toUpperCase(), highlight: true };
    }
  }
  return { language: 'plain', label: 'PLAIN', highlight: false };
}

function normalizeEditableMarkdownText(value) {
  return String(value == null ? '' : value).replace(/\n{3,}/g, '\n\n');
}

function editableText(el) {
  if (!el) return '';
  return normalizeEditableMarkdownText(serializeInlineDom(el));
}

function editableVisibleText(el) {
  return String(el && el.textContent != null ? el.textContent : '').replace(/\u00a0/g, ' ');
}

function splitEditableTextAtSelection(el, selectionSession = null) {
  const fallback = editableText(el);
  const selectionTools = normalizeSelectionSession(selectionSession);
  try {
    const range = selectionTools.getSelectionRange(el);
    if (!el || !range) return { before: fallback, after: '' };
    if (!nodeContains(el, range.startContainer) || !nodeContains(el, range.endContainer)) {
      return { before: fallback, after: '' };
    }
    const beforeRange = selectionTools.createRange(el);
    const afterRange = selectionTools.createRange(el);
    if (!beforeRange || !afterRange) return { before: fallback, after: '' };
    beforeRange.selectNodeContents(el);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    afterRange.selectNodeContents(el);
    afterRange.setStart(range.endContainer, range.endOffset);
    return {
      before: normalizeEditableMarkdownText(serializeInlineDom(beforeRange.cloneContents())),
      after: normalizeEditableMarkdownText(serializeInlineDom(afterRange.cloneContents()))
    };
  } catch (_) {
    return { before: fallback, after: '' };
  }
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

function isMergeableTextBlock(block) {
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

function isMergeableListBlock(block) {
  return !!(block && block.type === 'list');
}

function listBlockItems(block) {
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

function isEditableSelectionAtStart(el, caretSession = null) {
  return normalizeCaretSession(caretSession).isSelectionAtStart(el);
}

function isEditableSelectionOnBlankLine(el, caretSession = null) {
  return normalizeCaretSession(caretSession).isSelectionOnBlankLine(el);
}

function shouldInsertBlankBlockOnEnter(el, caretSession = null) {
  return normalizeCaretSession(caretSession).shouldInsertBlankBlockOnEnter(el);
}

function placeCaretAtEnd(el, caretSession = null) {
  normalizeCaretSession(caretSession).placeAtEnd(el);
}

function placeCaretAtStart(el, caretSession = null) {
  normalizeCaretSession(caretSession).placeAtStart(el);
}

function getEditableCaretTextOffset(el, caretSession = null) {
  return normalizeCaretSession(caretSession).getTextOffset(el);
}

function placeCaretAtTextOffset(el, offset, caretSession = null) {
  normalizeCaretSession(caretSession).placeAtTextOffset(el, offset);
}

function measuredTextOffsetDetailsFromPoint(el, x, y, limit = CARET_POINT_MEASURE_LIMIT, caretSession = null) {
  return normalizeCaretSession(caretSession).measuredTextOffsetDetailsFromPoint(el, x, y, limit);
}

function measuredTextOffsetFromPoint(el, x, y, limit = CARET_POINT_MEASURE_LIMIT, caretSession = null) {
  return normalizeCaretSession(caretSession).measuredTextOffsetFromPoint(el, x, y, limit);
}

function textareaTextOffsetDetailsFromPoint(area, x, y, limit = CARET_POINT_MEASURE_LIMIT, caretSession = null) {
  return normalizeCaretSession(caretSession).textareaTextOffsetDetailsFromPoint(area, x, y, limit);
}

function textareaTextOffsetFromPoint(area, x, y, limit = CARET_POINT_MEASURE_LIMIT, caretSession = null) {
  return normalizeCaretSession(caretSession).textareaTextOffsetFromPoint(area, x, y, limit);
}

function caretRectForEditable(el, caretSession = null) {
  return normalizeCaretSession(caretSession).rectForEditable(el);
}

function editableVisualLineRects(el, caretSession = null) {
  return normalizeCaretSession(caretSession).visualLineRects(el);
}

function isEditableCaretOnEdgeLine(el, direction, caretSession = null) {
  return normalizeCaretSession(caretSession).isEditableOnEdgeLine(el, direction);
}

function placeCaretAtVisualLine(el, x, edge, fallbackOffset = 0, caretSession = null) {
  normalizeCaretSession(caretSession).placeAtVisualLine(el, x, edge, fallbackOffset);
}

function normalizeCodeEditablePlainText(value) {
  return String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function codeEditableText(el) {
  if (!el) return '';
  return normalizeCodeEditablePlainText(el.innerText || el.textContent || '').replace(/\n$/, '');
}

function isEditableBackspaceAtEmptyStart(editable, selectionSession = null) {
  if (!editable) return false;
  if (editable.matches && editable.matches('textarea')) {
    try {
      const start = Number(editable.selectionStart);
      const end = Number(editable.selectionEnd);
      return start === 0 && end === 0 && String(editable.value || '').trim() === '';
    } catch (_) {
      return false;
    }
  }
  if (!isEditableSelectionAtStart(editable, selectionSession)) return false;
  const value = editable.classList && editable.classList.contains('blocks-code-editable')
    ? codeEditableText(editable)
    : editableText(editable);
  return String(value || '').trim() === '';
}

function codeEditableSelectionOffsets(el, selectionSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  const fallback = codeEditableText(el).length;
  try {
    const range = selectionTools.getSelectionRange(el);
    if (!el || !range) return { start: fallback, end: fallback };
    if (!nodeContains(el, range.startContainer) || !nodeContains(el, range.endContainer)) {
      return { start: fallback, end: fallback };
    }
    const startRange = selectionTools.createRange(el);
    const endRange = selectionTools.createRange(el);
    if (!startRange || !endRange) return { start: fallback, end: fallback };
    startRange.selectNodeContents(el);
    startRange.setEnd(range.startContainer, range.startOffset);
    endRange.selectNodeContents(el);
    endRange.setEnd(range.endContainer, range.endOffset);
    const start = normalizeCodeEditablePlainText(startRange.toString()).length;
    const end = normalizeCodeEditablePlainText(endRange.toString()).length;
    return {
      start: Math.max(0, Math.min(start, end)),
      end: Math.max(0, Math.max(start, end))
    };
  } catch (_) {
    return { start: fallback, end: fallback };
  }
}

function insertCodeEditableTextAtSelection(el, value, selectionSession = null) {
  const current = codeEditableText(el);
  const selectionTools = normalizeSelectionSession(selectionSession);
  const offsets = codeEditableSelectionOffsets(el, selectionTools);
  const start = Math.max(0, Math.min(offsets.start, current.length));
  const end = Math.max(start, Math.min(offsets.end, current.length));
  const insert = String(value == null ? '' : value);
  const next = `${current.slice(0, start)}${insert}${current.slice(end)}`;
  if (el) {
    el.textContent = next;
    placeCaretAtTextOffset(el, start + insert.length, selectionTools);
  }
  return next;
}

function nodeContains(root, node) {
  try { return !!(root && node && (root === node || root.contains(node))); }
  catch (_) { return false; }
}

function closestElement(node, selector) {
  try {
    const start = node && node.nodeType === 1 ? node : node && node.parentElement;
    return start && start.closest ? start.closest(selector) : null;
  } catch (_) {
    return null;
  }
}

function selectionEditableInRoot(root, selectionSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  try {
    const range = selectionTools.getSelectionRange(root);
    if (!root || !range) return null;
    const candidates = [range.startContainer, range.endContainer, range.commonAncestorContainer];
    for (const candidate of candidates) {
      const editable = closestElement(candidate, '.blocks-rich-editable');
      if (editable && nodeContains(root, editable)) return editable;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function inlineMarksFromDomNode(node, editable) {
  const marks = { bold: false, italic: false, strike: false, code: false, math: false, link: '' };
  try {
    let current = node && node.nodeType === 1 ? node : node && node.parentElement;
    while (current && nodeContains(editable, current)) {
      const tag = String(current.tagName || '').toLowerCase();
      if (current.matches && current.matches('.press-math[data-tex]')) {
        marks.math = true;
        marks.code = false;
        marks.bold = false;
        marks.italic = false;
        marks.strike = false;
        marks.link = '';
      } else if (tag === 'code') {
        marks.code = true;
        marks.math = false;
        marks.bold = false;
        marks.italic = false;
        marks.strike = false;
        marks.link = '';
      } else if (!marks.code) {
        if (tag === 'strong' || tag === 'b') marks.bold = true;
        if (tag === 'em' || tag === 'i') marks.italic = true;
        if (tag === 's' || tag === 'del' || tag === 'strike') marks.strike = true;
        if (tag === 'a') {
          marks.link = current.getAttribute('href') || '';
          marks.linkTitle = current.getAttribute('title') || '';
        }
      }
      if (current === editable) break;
      current = current.parentElement;
    }
  } catch (_) {}
  return marks;
}

function inlineMarksFromPointerEvent(event, editable, selectionSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  const node = selectionTools.nodeFromPoint(event, editable, event && event.target, { containsNode: nodeContains });
  return inlineMarksFromDomNode(node, editable);
}

function textRangeForDomNode(editable, node, inlineDomSession = null) {
  return normalizeInlineDomSession(inlineDomSession).textRangeForDomNode(editable, node);
}

function linkForTextRange(editable, start, end, inlineDomSession = null) {
  return normalizeInlineDomSession(inlineDomSession).linkForTextRange(editable, start, end);
}

function inlineMarkedDomRangeFromNode(editable, node, mark, inlineDomSession = null) {
  return normalizeInlineDomSession(inlineDomSession).markedRangeForNode(editable, node, mark);
}

function inlineMarkedDomRangeFromSelection(editable, mark, selectionSession = null, inlineDomSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  try {
    const range = selectionTools.getSelectionRange(editable);
    if (!editable || !range) return null;
    if (!nodeContains(editable, range.startContainer)) return null;
    return inlineMarkedDomRangeFromNode(editable, range.startContainer, mark, inlineDomSession);
  } catch (_) {
    return null;
  }
}

function inlineMarkedDomRangeFromPointerEvent(event, editable, mark, selectionSession = null, inlineDomSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  const node = selectionTools.nodeFromPoint(event, editable, event && event.target, { containsNode: nodeContains });
  return inlineMarkedDomRangeFromNode(editable, node, mark, inlineDomSession);
}

function selectionLinkInEditable(editable, selectionSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  try {
    const range = selectionTools.getSelectionRange(editable);
    if (!editable || !range) return null;
    if (!nodeContains(editable, range.commonAncestorContainer)) return null;
    const candidates = [range.startContainer, range.endContainer, range.commonAncestorContainer];
    for (const candidate of candidates) {
      const link = closestElement(candidate, 'a[href]');
      if (link && nodeContains(editable, link)) return link;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function selectionMathInEditable(editable, selectionSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  try {
    const range = selectionTools.getSelectionRange(editable);
    if (!editable || !range) return null;
    if (!nodeContains(editable, range.commonAncestorContainer)) return null;
    const candidates = [range.startContainer, range.endContainer, range.commonAncestorContainer];
    for (const candidate of candidates) {
      const math = closestElement(candidate, '.press-math[data-tex]');
      if (math && nodeContains(editable, math)) return math;
    }
    return null;
  } catch (_) {
    return null;
  }
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function inlineRunsTextLength(runs) {
  return mergeInlineRuns(runs).reduce((total, run) => total + String(run.text || '').length, 0);
}

function inlineMarksAtOffset(runs, offset) {
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

function inlineRangeText(runs, start, end) {
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

function rangeHasInlineText(runs, start, end) {
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

function inlineRangeFullyMarked(runs, start, end, mark) {
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

function inlineRangeAnyMarked(runs, start, end, mark) {
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

function removeInlineMarkInRange(runs, start, end, mark) {
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

function editableTextOffsetForDomPosition(root, container, offset, caretSession = null) {
  return normalizeCaretSession(caretSession).textOffsetForDomPosition(root, container, offset);
}

function getEditableSelectionOffsets(el, caretSession = null) {
  return normalizeCaretSession(caretSession).selectionOffsets(el);
}

export function createMarkdownBlocksEditor(root, options = {}) {
  if (!root) return null;
  const labels = options.labels || {};
  const text = (key, fallback) => labels[key] || fallback;
  const runtime = options.runtime && typeof options.runtime.onDocument === 'function'
    ? options.runtime
    : createEditorBlocksRuntime({
        documentRef: options.documentRef || root.ownerDocument,
        windowRef: options.windowRef || (root.ownerDocument && root.ownerDocument.defaultView),
        navigatorRef: options.navigatorRef
      });
  const runtimeDisposables = new Set();
  const trackRuntimeDisposer = (dispose) => {
    if (typeof dispose !== 'function') return () => {};
    let active = true;
    runtimeDisposables.add(dispose);
    return () => {
      if (!active) return;
      active = false;
      runtimeDisposables.delete(dispose);
      try { dispose(); } catch (_) {}
    };
  };
  const onDocument = (type, handler, listenerOptions) => trackRuntimeDisposer(runtime.onDocument(type, handler, listenerOptions));
  const onWindow = (type, handler, listenerOptions) => trackRuntimeDisposer(runtime.onWindow(type, handler, listenerOptions));
  const blocksState = createEditorBlocksStateController({
    parseMarkdownBlocksRef: parseMarkdownBlocks,
    serializeMarkdownBlocksRef: serializeMarkdownBlocks,
    makeBlockRef: makeBlock,
    makeBlankBlockRef: makeBlankBlock,
    splitBlankLineUnitsRef: splitBlankLineUnits
  });
  const state = blocksState.state;
  const menuSession = createEditorBlocksMenuSession({
    onDocument,
    onWindow,
    containsNode: nodeContains
  });
  const editableSession = createEditorBlocksEditableSession();
  const selectionSession = createEditorBlocksSelectionSession({
    documentRef: runtime.documentRef,
    windowRef: runtime.windowRef
  });
  const inlineDomSession = createInlineDomSession(selectionSession, runtime.documentRef);
  const caretSession = createCaretSession(selectionSession);

  root.classList.add('markdown-blocks-shell');
  root.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'blocks-list';
  list.setAttribute('aria-label', text('listAria', 'Markdown blocks'));

  root.appendChild(list);

  const markDirty = blocksState.markDirty;

  const emit = () => {
    if (typeof options.onChange === 'function') {
      options.onChange(blocksState.serialize());
    }
  };

  const updateFromControl = (block, patch, renderAfter = false) => {
    if (!block) return;
    blocksState.updateBlockData(block, patch);
    if (renderAfter) render();
    emit();
  };

  const blockElements = () => Array.from(list.children).filter(el => el && el.classList && el.classList.contains('blocks-block'));

  const insertBlankBlock = (index = state.blocks.length, options = {}) => {
    const { block, index: safeIndex } = blocksState.insertBlankBlock(index, options);
    render();
    if (options.command) {
      queueMicrotask(() => {
        const first = list.querySelector(`.blocks-block[data-block-id="${block.id}"] .blocks-command-menu-item`)
          || list.querySelector('.blocks-command-menu-item');
        try { first?.focus(); } catch (_) {}
      });
    } else if (options.focus !== false) {
      focusBlockPrimaryEditable(block, 0);
    }
    emit();
    return block;
  };

  let focusSession = null;
  let pointerSession = null;
  let activeSession = null;

  const focusBlockPrimaryEditable = (block, caretOffset = null) => {
    focusSession?.focusBlockPrimaryEditable(block, caretOffset);
  };

  const focusListItemEditable = (block, itemIndex, options = {}) => {
    focusSession?.focusListItemEditable(block, itemIndex, options);
  };

  const focusPreviousBlockEnd = (index) => {
    focusSession?.focusPreviousBlockEnd(index);
  };

  const insertBlankBlockAfter = (index, editable = null, sync = null) => {
    if (typeof sync === 'function') sync();
    insertBlankBlock(Math.max(0, Math.min((Number(index) || 0) + 1, state.blocks.length)), { focus: true });
  };

  const splitTextBlockAfterCaret = (event, block, index, editable = null) => {
    if (!event || event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
    if (!block || !['paragraph', 'quote', 'heading'].includes(block.type)) return false;
    const offsets = getEditableSelectionOffsets(editable, caretSession);
    if (!offsets || !offsets.collapsed) return false;
    const currentText = editableVisibleText(editable);
    if (offsets.start >= currentText.length || isEditableSelectionOnBlankLine(editable, caretSession)) return false;
    const split = splitEditableTextAtSelection(editable, selectionSession);
    if (!split.after) return false;
    const nextBlocks = splitTextBlockIntoParagraph(block, split.before, split.after);
    if (!nextBlocks) return false;
    event.preventDefault();
    blocksState.replaceBlocks(index, 1, nextBlocks);
    render();
    focusBlockPrimaryEditable(nextBlocks[1], 0);
    emit();
    return true;
  };

  const mergeTextBlockWithPreviousOnBackspace = (event, block, index, editable = null) => {
    if (!event || event.key !== 'Backspace' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
    if (!Number.isInteger(index) || index <= 0) return false;
    if (!editable || !isEditableSelectionAtStart(editable, caretSession)) return false;
    if (isBlockEmptyForBackspace(block)) return false;
    const previous = state.blocks[index - 1] || null;
    const previousItems = isMergeableListBlock(previous) ? listBlockItems(previous) : [];
    const previousListItemIndex = previousItems.length - 1;
    const merged = mergeTextBlockIntoPrevious(previous, block) || mergeTextBlockIntoPreviousList(previous, block);
    if (!merged) return false;
    event.preventDefault();
    blocksState.replaceBlocks(index - 1, 2, [merged], {
      pendingListFocus: merged.type === 'list' ? {
        blockId: merged.id,
        itemIndex: Number.isInteger(merged.focusItemIndex) ? merged.focusItemIndex : previousListItemIndex,
        caretOffset: merged.focusCaretOffset
      } : null
    });
    render();
    if (merged.type !== 'list') focusBlockPrimaryEditable(merged, merged.focusCaretOffset);
    emit();
    return true;
  };

  const clearNativeSelection = () => {
    selectionSession.clearSelection(root);
  };

  const prefersReducedReorderMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function finishBlockReorder() {
    state.reorderAnimating = false;
    requestStickyBlockHeadUpdate();
  }

  const captureBlockRects = (indexes = null) => {
    const allowed = Array.isArray(indexes) ? new Set(indexes) : null;
    const rects = new Map();
    blockElements().forEach((el, index) => {
      if (allowed && !allowed.has(index)) return;
      const id = el.dataset ? el.dataset.blockId : '';
      if (id && el.getBoundingClientRect) rects.set(id, el.getBoundingClientRect());
    });
    return rects;
  };

  const animateBlockReorder = (beforeRects) => {
    try {
      if (!beforeRects || !beforeRects.size) {
        finishBlockReorder();
        return;
      }
      const moves = blockElements().map((el) => {
        const id = el.dataset ? el.dataset.blockId : '';
        const before = id ? beforeRects.get(id) : null;
        if (!before || !el.getBoundingClientRect) return null;
        const after = el.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
        return { el, dx, dy };
      }).filter(Boolean);
      if (!moves.length) {
        finishBlockReorder();
        return;
      }
      let remaining = moves.length;
      let finished = false;
      let fallbackTimer = null;
      const finish = () => {
        if (finished) return;
        finished = true;
        runtime.clearTimer(fallbackTimer);
        moves.forEach((item) => {
          item.el.removeEventListener('transitionend', item.done);
          item.el.classList.remove('is-reordering');
          item.el.style.transition = '';
          item.el.style.transform = '';
        });
        finishBlockReorder();
      };
      moves.forEach((item) => {
        item.done = (event) => {
          if (event && event.target !== item.el) return;
          item.el.removeEventListener('transitionend', item.done);
          remaining -= 1;
          if (remaining <= 0) finish();
        };
        item.el.classList.add('is-reordering');
        item.el.style.transition = 'none';
        item.el.style.transform = `translate3d(${item.dx}px, ${item.dy}px, 0)`;
        item.el.addEventListener('transitionend', item.done);
      });
      list.getBoundingClientRect();
      runtime.requestFrame(() => {
        moves.forEach((item) => {
          item.el.style.transition = '';
          item.el.style.transform = 'translate3d(0, 0, 0)';
        });
      });
      fallbackTimer = runtime.setTimer(finish, 360);
    } catch (_) {
      finishBlockReorder();
    }
  };

  const moveBlockInState = (index, direction) => {
    return blocksState.moveBlock(index, direction);
  };

  const commitBlockMove = (index, direction) => {
    if (!moveBlockInState(index, direction)) return;
    render();
    emit();
  };

  const moveBlock = (index, direction) => {
    try {
      const targetIndex = index + direction;
      const shouldMoveNow = !Number.isInteger(index)
        || !Number.isInteger(targetIndex)
        || targetIndex < 0
        || index < 0
        || targetIndex >= state.blocks.length;
      if (shouldMoveNow) return;
      if (state.reorderAnimating || prefersReducedReorderMotion()) {
        if (!state.reorderAnimating) commitBlockMove(index, direction);
        return;
      }
      const beforeRects = captureBlockRects([index, targetIndex]);
      state.reorderAnimating = true;
      const moved = moveBlockInState(index, direction);
      if (!moved) {
        finishBlockReorder();
        return;
      }
      if (!replaceAdjacentBlockElements(index, targetIndex)) {
        render();
        finishBlockReorder();
        emit();
        return;
      }
      emit();
      animateBlockReorder(beforeRects);
    } catch (_) {
      finishBlockReorder();
      commitBlockMove(index, direction);
    }
  };

  const closeBlockActionMenu = (restoreFocus = false) => {
    menuSession.closeActionMenu(restoreFocus);
  };

  const closeInlineMoreMenu = (restoreFocus = false) => {
    menuSession.closeInlineMenu(restoreFocus);
  };

  const deleteBlockAt = (index) => {
    const deleted = blocksState.deleteBlock(index);
    if (!deleted) return;
    render();
    setActive(deleted.activeIndex);
    emit();
  };

  const makeSplitListBlock = (block, items, after = '\n\n') => {
    const data = block && block.data ? block.data : {};
    return makeBlock('list', '', {
      dirty: true,
      listType: data.listType === 'ol' || data.listType === 'task' || data.listType === 'mixed' ? data.listType : 'ul',
      items: Array.isArray(items) ? items.slice() : editableListItems(items).slice(),
      after: after || '\n\n'
    });
  };

  const resetTransientBlockMenus = () => {
    blocksState.resetTransientMenus();
  };

  const removeEmptyBlockWithBackspace = (event, block, index, editable = null, sync = null) => {
    if (!event || event.key !== 'Backspace' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return false;
    if (!Number.isInteger(index) || index <= 0) return false;
    if (editable && !isEditableBackspaceAtEmptyStart(editable, selectionSession)) return false;
    if (typeof sync === 'function') sync();
    if (!isBlockEmptyForBackspace(block)) return false;
    event.preventDefault();
    blocksState.removeBlock(index);
    render();
    focusPreviousBlockEnd(index);
    emit();
    return true;
  };

  const actionMenuBoundaryLeft = () => {
    try {
      const pane = runtime.getElementById('editorContentPane');
      const rect = (pane && pane.getBoundingClientRect && pane.getBoundingClientRect())
        || (root && root.getBoundingClientRect && root.getBoundingClientRect())
        || null;
      if (rect && Number.isFinite(rect.left)) return Math.max(8, Math.floor(rect.left));
    } catch (_) {}
    return 8;
  };

  const alignBlockActionMenu = (menu, trigger = null) => {
    try {
      if (!menu || menu.hidden) return;
      menu.classList.remove('is-open-right');
      const boundaryLeft = actionMenuBoundaryLeft();
      const menuRect = menu.getBoundingClientRect();
      const triggerRect = trigger && trigger.getBoundingClientRect ? trigger.getBoundingClientRect() : null;
      const leftSpace = triggerRect ? triggerRect.right - boundaryLeft : menuRect.left - boundaryLeft;
      if (leftSpace < menuRect.width + 8) menu.classList.add('is-open-right');
    } catch (_) {}
  };

  const createBlockActionMenu = (index) => {
    const wrap = document.createElement('div');
    wrap.className = 'blocks-block-actions';
    const trigger = button('⋯', 'blocks-icon-btn blocks-action-trigger');
    const actionsLabel = text('actions', 'More actions');
    trigger.title = actionsLabel;
    trigger.setAttribute('aria-label', actionsLabel);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'blocks-action-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const makeItem = (label, className, disabled, handler) => {
      const item = button(label, `blocks-action-menu-item${className ? ` ${className}` : ''}`);
      item.setAttribute('role', 'menuitem');
      item.disabled = !!disabled;
      item.addEventListener('click', () => {
        if (item.disabled) return;
        closeBlockActionMenu(false);
        handler();
      });
      menu.appendChild(item);
      return item;
    };

    makeItem(text('moveUp', 'Move up'), '', index === 0, () => moveBlock(index, -1));
    makeItem(text('moveDown', 'Move down'), '', index === state.blocks.length - 1, () => moveBlock(index, 1));
    makeItem(text('addBefore', 'Add before'), '', false, () => insertBlankBlock(index));
    makeItem(text('addAfter', 'Add after'), '', false, () => insertBlankBlock(index + 1));
    makeItem(text('delete', 'Delete'), 'blocks-action-menu-delete', false, () => deleteBlockAt(index));

    const openMenu = () => {
      menuSession.openActionMenu({
        wrap,
        trigger,
        menu,
        onReposition: () => alignBlockActionMenu(menu, trigger)
      });
    };

    trigger.addEventListener('mousedown', (event) => event.preventDefault());
    trigger.addEventListener('click', () => {
      setActive(index);
      if (menuSession.isActionMenuOpen(menu)) {
        closeBlockActionMenu(false);
      } else {
        openMenu();
      }
    });

    wrap.append(trigger, menu);
    return wrap;
  };

  const sourceReasonText = (block) => {
    const reason = block && block.data && block.data.sourceReason ? String(block.data.sourceReason) : 'unsupported';
    return text(`sourceReason.${reason}`, text('sourceReason.unsupported', 'This Markdown is kept as source because the block editor cannot safely convert it to a visual block without changing the original structure.'));
  };

  const createSourceReasonHelp = (block, index) => {
    const wrap = document.createElement('span');
    wrap.className = 'blocks-source-help-wrap';
    const help = button('?', 'blocks-source-help');
    const tooltipId = `blocks-source-help-${block && block.id ? block.id : index}`;
    const message = sourceReasonText(block);
    help.setAttribute('aria-label', message);
    help.setAttribute('aria-describedby', tooltipId);
    const bubble = document.createElement('span');
    bubble.id = tooltipId;
    bubble.className = 'blocks-source-help-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = message;
    wrap.append(help, bubble);
    return wrap;
  };

  const sourceAutofixLabel = (block) => {
    const reason = block && block.data && block.data.sourceReason ? String(block.data.sourceReason) : '';
    return text(`sourceAutofix.${reason}`, text('sourceAutofix.unsupported', 'Autofix'));
  };

  const canAutofixSourceBlock = (block) => !!(block && block.type === 'source' && block.data && block.data.sourceReason === 'indentedList');

  const applySourceAutofix = (index) => {
    const block = state.blocks[index];
    const nextBlocks = autofixMarkdownSourceBlock(block);
    if (!nextBlocks.length) return;
    blocksState.replaceBlocks(index, 1, nextBlocks, { activeIndex: index });
    render();
    setActive(index);
    emit();
  };

  const createSourceAutofixButton = (block, index) => {
    const label = sourceAutofixLabel(block);
    const autofix = button('', 'blocks-source-autofix');
    autofix.innerHTML = '<span aria-hidden="true">★</span><span class="blocks-source-autofix-label"></span>';
    const labelSpan = autofix.querySelector('.blocks-source-autofix-label');
    if (labelSpan) labelSpan.textContent = text('sourceAutofix.label', 'Autofix');
    autofix.title = label;
    autofix.setAttribute('aria-label', label);
    autofix.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActive(index);
      applySourceAutofix(index);
    });
    return autofix;
  };

  const syncActiveEditable = () => {
    try {
      blocksState.invokeActiveSync();
    } catch (_) {}
  };

  const clearStickyBlockHeads = (except = null) => {
    Array.from(list.querySelectorAll('.blocks-block-head.is-stuck, .blocks-block-head.is-bottom-docked')).forEach(head => {
      if (head === except) return;
      head.classList.remove('is-stuck');
      head.classList.remove('is-bottom-docked');
      head.style.removeProperty('top');
      head.style.removeProperty('left');
      head.style.removeProperty('width');
    });
  };

  const editorStickyToolbarBottom = () => {
    try {
      const panel = root.closest ? root.closest('#editorMarkdownPanel') : null;
      const fileToolbar = panel ? panel.querySelector(':scope > .toolbar') : document.querySelector('#editorMarkdownPanel > .toolbar');
      const rect = fileToolbar && fileToolbar.getBoundingClientRect ? fileToolbar.getBoundingClientRect() : null;
      if (rect && rect.height > 0) return rect.bottom;
    } catch (_) {}
    try {
      const styles = runtime.getComputedStyle(runtime.getDocumentElement());
      const offset = parseFloat(styles.getPropertyValue('--editor-toolbar-offset'));
      if (Number.isFinite(offset)) return offset;
    } catch (_) {}
    return 0;
  };

  const editorViewportBottom = () => {
    try {
      const pane = runtime.getElementById('editorContentPane');
      const rect = pane && pane.getBoundingClientRect ? pane.getBoundingClientRect() : null;
      if (rect && rect.height > 0) return rect.bottom;
    } catch (_) {}
    return runtime.getViewportHeight();
  };

  const findVerticalScrollParent = (node) => {
    let el = node && node.parentElement;
    const body = runtime.getBody();
    const documentElement = runtime.getDocumentElement();
    while (el && el !== body && el !== documentElement) {
      try {
        const cs = runtime.getComputedStyle(el);
        if (/(auto|scroll|overlay)/.test(cs.overflowY || '') && el.scrollHeight > el.clientHeight + 1) return el;
      } catch (_) {}
      el = el.parentElement;
    }
    return runtime.getElementById('editorContentPane') || runtime.getScrollingElement() || documentElement;
  };

  const wheelDeltaYForScroll = (event, scrollParent) => {
    let deltaY = event && Number.isFinite(event.deltaY) ? event.deltaY : 0;
    if (!deltaY) return 0;
    if (event.deltaMode === 1) deltaY *= 16;
    else if (event.deltaMode === 2) deltaY *= (scrollParent && scrollParent.clientHeight) || window.innerHeight || 600;
    return deltaY;
  };

  const forwardBlockHeadWheel = (event) => {
    if (!event || !event.deltaY) return;
    const absX = Math.abs(event.deltaX || 0);
    const absY = Math.abs(event.deltaY || 0);
    if (absX > absY) return;
    const scrollParent = findVerticalScrollParent(root);
    if (!scrollParent) return;
    const deltaY = wheelDeltaYForScroll(event, scrollParent);
    if (!deltaY) return;
    const before = scrollParent.scrollTop;
    scrollParent.scrollTop = before + deltaY;
    if (scrollParent.scrollTop !== before) event.preventDefault();
  };

  const updateStickyBlockHead = () => {
    const blockNodes = Array.from(list.querySelectorAll('.blocks-block'));
    const activeBlock = blockNodes[state.activeIndex] || null;
    const head = activeBlock ? activeBlock.querySelector('.blocks-block-head') : null;
    clearStickyBlockHeads(head);
    if (state.reorderAnimating) {
      clearStickyBlockHeads();
      return;
    }
    if (!activeBlock || !head || !nodeContains(root, activeBlock) || root.hidden) {
      clearStickyBlockHeads();
      return;
    }

    const wasPositioned = head.classList.contains('is-stuck') || head.classList.contains('is-bottom-docked');
    if (wasPositioned) {
      head.classList.remove('is-stuck');
      head.classList.remove('is-bottom-docked');
      head.style.removeProperty('top');
      head.style.removeProperty('left');
      head.style.removeProperty('width');
    }

    const blockRect = activeBlock.getBoundingClientRect ? activeBlock.getBoundingClientRect() : null;
    if (!blockRect || blockRect.width <= 0 || blockRect.height <= 0) return;
    const headHeight = head.offsetHeight || 0;
    const headWidth = head.offsetWidth || 0;
    if (headHeight <= 0 || headWidth <= 0) return;

    const gap = 8;
    const stickyTop = editorStickyToolbarBottom() + gap;
    const viewportBottom = editorViewportBottom();
    const naturalTop = blockRect.top + (head.offsetTop || 0) - (headHeight * 1.12);
    const blockBottomLimit = blockRect.bottom - headHeight - gap;
    const blockTopUnderStickyToolbar = blockRect.top < stickyTop;
    if (viewportBottom <= stickyTop) return;
    if (blockTopUnderStickyToolbar) {
      if (blockRect.bottom + gap + headHeight <= stickyTop) return;
      head.classList.add('is-bottom-docked');
      head.style.top = `${Math.max(0, blockRect.height + gap)}px`;
      return;
    }
    if (blockRect.bottom <= stickyTop) return;

    const margin = 8;
    const left = Math.max(margin, Math.min(blockRect.left + (head.offsetLeft || 0), window.innerWidth - headWidth - margin));
    const viewportBottomLimit = Math.max(stickyTop, viewportBottom - headHeight - gap);
    const top = Math.min(viewportBottomLimit, blockBottomLimit, Math.max(stickyTop, naturalTop));
    head.classList.add('is-stuck');
    head.style.top = `${top}px`;
    head.style.left = `${left}px`;
  };

  let stickyBlockHeadFrame = 0;
  const requestStickyBlockHeadUpdate = () => {
    if (stickyBlockHeadFrame) return;
    const run = () => {
      stickyBlockHeadFrame = 0;
      updateStickyBlockHead();
    };
    stickyBlockHeadFrame = runtime.requestFrame(run) || 1;
  };

  const activeListItemIndex = (block, index) => {
    const activeBlock = state.blocks[index];
    if (!block || activeBlock !== block) return 0;
    const item = closestElement(blocksState.getActiveEditable(), '.blocks-list-item');
    if (!item) return 0;
    const itemIndex = Number(item.dataset.itemIndex);
    return Number.isFinite(itemIndex) ? itemIndex : 0;
  };

  const listTypeControlValue = (block, index) => {
    if (!block || block.type !== 'list') return 'ul';
    const blockListType = block.data && block.data.listType;
    const items = editableListItems(block.data && block.data.items);
    const itemIndex = Math.max(0, Math.min(activeListItemIndex(block, index), items.length - 1));
    return effectiveListItemType(items[itemIndex], blockListType);
  };

  const syncActiveListTypeSelect = (blockNodes = null) => {
    const block = state.blocks[state.activeIndex];
    if (!block || block.type !== 'list') return;
    const nodes = blockNodes || Array.from(list.querySelectorAll('.blocks-block'));
    const activeBlock = nodes[state.activeIndex] || null;
    const select = activeBlock ? activeBlock.querySelector('.blocks-list-type-select') : null;
    if (select) select.value = listTypeControlValue(block, state.activeIndex);
  };

  const updateListType = (block, index, nextType) => {
    if (!block || block.type !== 'list') return;
    const normalizedType = normalizeListItemType(nextType);
    const items = editableListItems(block.data && block.data.items).slice();
    const itemIndex = Math.max(0, Math.min(activeListItemIndex(block, index), items.length - 1));
    const nextPatch = patchListItemType(items, itemIndex, normalizedType, block.data && block.data.listType);
    blocksState.setPendingListFocus({ blockId: block.id, itemIndex, atEnd: false });
    updateFromControl(block, nextPatch, true);
  };

  const indentListItem = (block, index, delta) => {
    if (!block || block.type !== 'list') return;
    const items = Array.isArray(block.data.items) && block.data.items.length
      ? block.data.items.slice()
      : defaultListItems();
    const itemIndex = Math.max(0, Math.min(activeListItemIndex(block, index), items.length - 1));
    const current = items[itemIndex] || {};
    const currentIndent = Math.max(0, Number(current.indent) || 0);
    const nextIndent = Math.max(0, currentIndent + delta);
    if (nextIndent === currentIndent) return;
    items[itemIndex] = {
      ...current,
      indent: nextIndent,
      indentText: '  '.repeat(nextIndent)
    };
    blocksState.setPendingListFocus({ blockId: block.id, itemIndex, atEnd: false });
    updateFromControl(block, { items }, true);
  };

  let refreshLinkEditor = () => {};
  let openMathEditorForSelection = () => {};
  let openMathEditorForNode = () => {};
  let openMathEditorForBlock = () => {};

  const setActive = (index, editable = null, sync = null) => {
    activeSession?.setActive(index, editable, sync);
  };

  const activateEditableFromPointer = (index, editable, sync) => {
    activeSession?.activateEditableFromPointer(index, editable, sync);
  };

  const activateNonTextBlockFromPointer = (index, blockEl = null) => {
    activeSession?.activateNonTextBlockFromPointer(index, blockEl);
  };

  focusSession = createEditorBlocksFocusSession({
    state,
    caretSession,
    editableSession,
    blockElements,
    editableListItems,
    setActive,
    activateNonTextBlockFromPointer,
    onInlineToolbarUpdate: () => {
      try { updateInlineToolbarState(); } catch (_) {}
    },
    queueTask: task => queueMicrotask(task)
  });

  pointerSession = createEditorBlocksPointerSession({
    blocksState,
    caretSession,
    selectionSession,
    editableSession,
    blockElements,
    closestElement,
    containsNode: nodeContains,
    setActive,
    activateEditableFromPointer,
    activateNonTextBlockFromPointer,
    onInlineToolbarUpdate: () => {
      try { updateInlineToolbarState(); } catch (_) {}
    },
    autoSizeTextarea: area => autoSizeTextarea(area),
    measureLimit: CARET_POINT_MEASURE_LIMIT
  });

  const shouldSuppressRoutedBlockContainerClick = () => {
    return blocksState.consumeRoutedBlockContainerClickSuppression(Date.now());
  };

  const isBlocksCaretInteractiveTarget = (target) => {
    return !!(pointerSession && pointerSession.isBlocksCaretInteractiveTarget(target));
  };

  const blockNavigationTarget = (index, edge = 'first') => {
    return focusSession ? focusSession.blockNavigationTarget(index, edge) : null;
  };

  const focusBlockNavigationTarget = (target, direction, x, fallbackOffset = 0) => {
    return !!(focusSession && focusSession.focusBlockNavigationTarget(target, direction, x, fallbackOffset));
  };

  const handleCrossBlockArrowNavigation = (event, index, editable = null) => {
    return !!(focusSession && focusSession.handleCrossBlockArrowNavigation(event, index, editable));
  };

  const setContentEditableCaretFromPoint = (editable, x, y, hitTarget = editable) => {
    pointerSession?.setContentEditableCaretFromPoint(editable, x, y, hitTarget);
  };

  const setTextareaCaretFromPoint = (area, x, y) => {
    pointerSession?.setTextareaCaretFromPoint(area, x, y);
  };

  const routeDirectQuoteCaretFromPointer = (editable, index, sync, event) => {
    return !!(pointerSession && pointerSession.routeDirectQuoteCaretFromPointer(editable, index, sync, event));
  };

  const routeBlocksCaretFromPointer = (event) => {
    pointerSession?.routeBlocksCaretFromPointer(event);
  };

  list.addEventListener('pointerdown', routeBlocksCaretFromPointer);
  onWindow('scroll', requestStickyBlockHeadUpdate, true);
  onWindow('resize', requestStickyBlockHeadUpdate);

  const getBaseDir = () => {
    try {
      if (typeof options.getBaseDir === 'function') return options.getBaseDir() || '';
    } catch (_) {}
    return '';
  };

  const resolveAssetSrc = (src) => {
    try {
      if (typeof options.resolveImageSrc === 'function') return options.resolveImageSrc(src, getBaseDir());
    } catch (_) {}
    return String(src || '').trim();
  };

  const hydrateImages = (node) => {
    try {
      if (typeof options.hydrateImages === 'function') options.hydrateImages(node);
    } catch (_) {}
  };

  const hydrateCard = (node) => {
    try {
      if (typeof options.hydrateCard === 'function') options.hydrateCard(node);
    } catch (_) {}
  };

  const insertBlock = (type, data = {}, index = state.activeIndex + 1) => {
    const { block, index: safeIndex } = blocksState.insertBlock(type, data, index);
    render();
    setActive(safeIndex);
    emit();
    return block;
  };

  const placeCommandBlock = (type, data = {}, index = state.blocks.length) => {
    const { block, index: safeIndex } = blocksState.placeCommandBlock(type, data, index);
    render();
    setActive(safeIndex);
    emit();
    return block;
  };

  const closeBlockCommandMenu = (restoreFocus = false) => {
    if (!state.commandMenuOpen) return;
    const restoreIndex = blocksState.closeCommandMenu();
    render();
    if (restoreFocus) {
      if (Number.isInteger(restoreIndex) && state.blocks[restoreIndex]) focusBlockPrimaryEditable(state.blocks[restoreIndex], 0);
      else {
        const trailingBlank = state.blocks.slice().reverse().find(block => block && block.type === 'blank');
        if (trailingBlank) focusBlockPrimaryEditable(trailingBlank, 0);
      }
    }
  };

  const openBlockCommandMenu = (insertIndex = state.blocks.length) => {
    closeBlockActionMenu(false);
    closeInlineMoreMenu(false);
    blocksState.openCommandMenu(insertIndex);
    render();
    queueMicrotask(() => {
      const first = list.querySelector(`.blocks-block[data-block-id="${state.blocks[state.commandMenuInsertIndex]?.id || ''}"] .blocks-command-menu-item`)
        || list.querySelector('.blocks-command-menu-item');
      try { first?.focus(); } catch (_) {}
    });
  };

  const insertCommandBlock = (type, data = {}, options = {}) => {
    const insertIndex = blocksState.beginCommandBlockInsert(options);
    const block = placeCommandBlock(type, data, insertIndex);
    if (options.focus) focusBlockPrimaryEditable(block, options.caretOffset);
    return block;
  };

  const cardPickerSession = createEditorBlocksCardPickerSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    runtime,
    blocksState,
    text,
    insertCardBlock: (data, index) => insertCommandBlock('card', data, { index }),
    requestRender: () => render()
  });
  if (cardPickerSession) root.appendChild(cardPickerSession.element);

  const createParagraphFromBlankInput = (value, insertIndex = state.blocks.length) => {
    const textValue = normalizeEditableMarkdownText(value);
    if (!textValue) return;
    insertCommandBlock('paragraph', { text: textValue }, { focus: true, caretOffset: textValue.length, index: insertIndex });
  };

  const inlineCommandMark = (kind) => (kind === 'strikeThrough' ? 'strike' : kind);
  const hasPendingInlineMarks = () => blocksState.hasPendingInlineMarks();
  let updateInlineToolbarState = () => {};
  let openLinkEditorForSelection = () => {};

  const applyRunsToEditable = (editable, runs, caretOffset = null) => {
    renderInlineRunsInto(editable, runs, inlineDomSession);
    if (caretOffset != null) placeCaretAtTextOffset(editable, caretOffset, caretSession);
    syncActiveEditable();
    updateInlineToolbarState();
  };

  const togglePendingInlineMark = (kind) => {
    const mark = inlineCommandMark(kind);
    blocksState.togglePendingInlineMark(mark);
    updateInlineToolbarState();
  };

  const applyInlineCommand = (kind) => {
    const editable = blocksState.getActiveEditable();
    if (!editable || !nodeContains(root, editable)) return;
    try { editable.focus(); } catch (_) {}
    if (kind === 'link') {
      openLinkEditorForSelection();
      return;
    }
    if (kind === 'math') {
      openMathEditorForSelection();
      return;
    }
    const offsets = getEditableSelectionOffsets(editable, caretSession);
    const runs = inlineRunsFromDom(editable);
    const mark = inlineCommandMark(kind);
    if (mark === 'code') {
      const selectedCodeRange = inlineMarkedDomRangeFromSelection(editable, mark, selectionSession, inlineDomSession);
      const rememberedCodeRange = blocksState.rememberedInlineRangeFor(editable, mark);
      const codeRange = selectedCodeRange || rememberedCodeRange;
      if ((!offsets || offsets.collapsed) && codeRange) {
        blocksState.clearInlineState();
        const nextRuns = removeInlineMarkInRange(runs, codeRange.start, codeRange.end, mark);
        applyRunsToEditable(editable, nextRuns, offsets ? offsets.start : codeRange.start);
        return;
      }
    }
    if (!offsets) return;
    if (offsets.collapsed) {
      if (mark === 'code' && inlineMarksAtOffset(runs, offsets.start).code) {
        blocksState.clearInlineState();
        const nextRuns = removeInlineMarkAroundOffset(runs, offsets.start, mark);
        applyRunsToEditable(editable, nextRuns, offsets.start);
        return;
      }
      if (mark === 'code') return;
      togglePendingInlineMark(kind);
      return;
    }
    blocksState.clearPendingInline();
    const nextRuns = toggleInlineMarkOnRuns(runs, offsets.start, offsets.end, inlineCommandMark(kind));
    applyRunsToEditable(editable, nextRuns, offsets.end);
  };

  const inlineControls = [
    ['B', 'bold', 'inlineBold', 'Bold'],
    ['I', 'italic', 'inlineItalic', 'Italic'],
    ['Link', 'link', 'inlineLink', 'Link'],
    ['∑', 'math', 'inlineMath', 'Math']
  ];
  const inlineMoreControls = [
    ['S', 'strikeThrough', 'inlineStrike', 'Strikethrough'],
    ['`', 'code', 'inlineCode', 'Inline code']
  ];

  const createInlineCommandButton = (label, command, key, fallback, index, className = 'blocks-inline-btn') => {
    const btn = button(label, className);
    btn.dataset.inlineCommand = command;
    btn.title = text(key, fallback);
    btn.setAttribute('aria-label', text(key, fallback));
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('mousedown', (event) => event.preventDefault());
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      setActive(index);
      applyInlineCommand(command);
    });
    return btn;
  };

  const createInlineMoreMenu = (index) => {
    const wrap = document.createElement('div');
    wrap.className = 'blocks-inline-more';
    const trigger = button('Aa', 'blocks-inline-btn blocks-inline-more-trigger');
    const moreLabel = text('inlineMore', 'More formatting');
    trigger.title = moreLabel;
    trigger.setAttribute('aria-label', moreLabel);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'blocks-inline-more-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    inlineMoreControls.forEach(([_label, command, key, fallback]) => {
      const item = createInlineCommandButton(text(key, fallback), command, key, fallback, index, 'blocks-inline-menu-item');
      item.setAttribute('role', 'menuitem');
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', () => closeInlineMoreMenu(false));
      menu.appendChild(item);
    });

    const openMenu = () => {
      menuSession.openInlineMenu({ wrap, trigger, menu });
    };

    trigger.addEventListener('mousedown', (event) => event.preventDefault());
    trigger.addEventListener('click', () => {
      setActive(index);
      if (menuSession.isInlineMenuOpen(menu)) {
        closeInlineMoreMenu(false);
      } else {
        openMenu();
      }
    });

    wrap.append(trigger, menu);
    return wrap;
  };

  const createInlineControls = (index) => {
    const controls = document.createElement('div');
    controls.className = 'blocks-inline-controls';
    controls.setAttribute('role', 'toolbar');
    controls.setAttribute('aria-label', text('inlineToolbarAria', 'Inline formatting'));
    inlineControls.forEach(([label, command, key, fallback]) => {
      const btn = createInlineCommandButton(label, command, key, fallback, index);
      controls.appendChild(btn);
    });
    controls.appendChild(createInlineMoreMenu(index));
    return controls;
  };

  const linkSession = createEditorBlocksLinkSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    root,
    runtime,
    blocksState,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: nodeContains,
    closestElement,
    text,
    sanitizeLinkHref: sanitizeEditorLinkHref,
    sanitizeLinkTitle: sanitizeEditorLinkTitle,
    selectionLinkInEditable,
    getEditableSelectionOffsets,
    caretRectForEditable,
    inlineRunsFromDom,
    inlineRangeText,
    applyInlineLinkToRuns,
    renderInlineRunsInto,
    textRangeForDomNode,
    linkForTextRange,
    placeCaretAtTextOffset,
    syncActiveEditable,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    onDocument,
    onWindow
  });
  if (linkSession) {
    refreshLinkEditor = (explicitLink = null) => linkSession.refresh(explicitLink);
    openLinkEditorForSelection = () => linkSession.openForSelection();
  }

  const mathSession = createEditorBlocksMathSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    root,
    list,
    runtime,
    blocksState,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: nodeContains,
    closestElement,
    text,
    renderMath: renderPressMath,
    getMathBlockById: id => state.blocks.find(block => block && block.id === id && block.type === 'math') || null,
    getEditableSelectionOffsets,
    caretRectForEditable,
    selectionMathInEditable,
    inlineRunsFromDom,
    applyInlineMathToRuns,
    renderInlineRunsInto,
    textRangeForDomNode,
    syncActiveEditable,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    updateFromControl,
    onDocument
  });
  if (mathSession) {
    openMathEditorForSelection = () => mathSession.openForSelection();
    openMathEditorForNode = mathNode => mathSession.openForNode(mathNode);
    openMathEditorForBlock = (block, blockEl = null) => mathSession.openForBlock(block, blockEl);
  }

  const inlineToolbarSession = createEditorBlocksInlineToolbarSession({
    state,
    blocksState,
    editableSession,
    root,
    list,
    selectionSession,
    caretSession,
    containsNode: nodeContains,
    closestElement,
    selectionEditableInRoot,
    getEditableSelectionOffsets,
    inlineRunsFromDom,
    hasPendingInlineMarks,
    selectionLinkInEditable,
    selectionMathInEditable,
    inlineRangeFullyMarked,
    inlineRangeAnyMarked,
    inlineMarksAtOffset,
    rangeHasInlineText,
    inlineCommandMark
  });
  updateInlineToolbarState = () => inlineToolbarSession.update();
  if (linkSession) {
    root.appendChild(linkSession.element);
    linkSession.bind();
  }
  if (mathSession) {
    root.appendChild(mathSession.element);
    mathSession.bind();
  }

  const insertPendingInlineText = (editable, value) => {
    const textValue = String(value || '');
    if (!editable || !textValue || !hasPendingInlineMarks()) return false;
    const offsets = getEditableSelectionOffsets(editable, caretSession);
    if (!offsets) return false;
    const runs = inlineRunsFromDom(editable);
    const insertRun = inlineRun(textValue, blocksState.pendingInlineForRun());
    const nextRuns = insertInlineRunsAtRange(runs, offsets.start, offsets.end, [insertRun]);
    applyRunsToEditable(editable, nextRuns, offsets.start + textValue.length);
    return true;
  };

  const wireInlineEditable = (editable, index, sync) => {
    editable.addEventListener('beforeinput', (event) => {
      if (event.isComposing || !hasPendingInlineMarks()) return;
      if (event.inputType !== 'insertText' || event.data == null) return;
      event.preventDefault();
      setActive(index, editable, sync);
      insertPendingInlineText(editable, event.data);
    });
    editable.addEventListener('paste', (event) => {
      if (!hasPendingInlineMarks()) return;
      const pasted = event.clipboardData && event.clipboardData.getData('text/plain');
      if (!pasted) return;
      event.preventDefault();
      setActive(index, editable, sync);
      insertPendingInlineText(editable, pasted);
    });
    editable.addEventListener('keyup', () => updateInlineToolbarState());
    editable.addEventListener('mouseup', () => updateInlineToolbarState());
  };

  const commandBlocks = [
    ['paragraph', 'paragraph', 'Paragraph', { text: 'New paragraph' }],
    ['heading', 'heading', 'Heading', { level: 2, text: 'Heading' }],
    ['image', 'image', 'Image', { alt: '', src: '' }],
    ['table', 'table', 'Table', { headers: ['Column 1', 'Column 2'], alignments: ['', ''], rows: [['', '']] }],
    ['list', 'list', 'List', { listType: 'ul', items: defaultListItems() }],
    ['quote', 'quote', 'Quote', { text: 'Quote' }],
    ['code', 'code', 'Code', { lang: '', text: '' }],
    ['math', 'math', 'Math', { tex: '' }],
    ['source', 'source', 'Markdown', { text: '' }]
  ];

  const openArticleCardCommand = () => {
    const insertIndex = Number.isInteger(state.commandMenuInsertIndex) ? state.commandMenuInsertIndex : state.blocks.length;
    if (cardPickerSession) {
      cardPickerSession.open(insertIndex);
      return;
    }
    insertCommandBlock('card', { label: 'Article', location: '', title: 'card', forceCard: true }, { index: insertIndex });
  };

  const runBlockCommand = (type, data = {}) => {
    const focusTypes = new Set(['paragraph', 'heading', 'table', 'list', 'quote', 'code', 'source']);
    insertCommandBlock(type, data, { focus: focusTypes.has(type) });
  };

  const createCommandMenuElement = (isCommandOpen) => {
    const menu = document.createElement('div');
    menu.className = 'blocks-command-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', text('commandMenuAria', 'Block selector'));
    menu.hidden = !isCommandOpen;
    menu.setAttribute('aria-hidden', isCommandOpen ? 'false' : 'true');
    commandBlocks.forEach(([key, type, fallback, data]) => {
      const itemBtn = button('', 'blocks-command-menu-item');
      itemBtn.dataset.blockCommand = type;
      itemBtn.setAttribute('role', 'menuitem');
      itemBtn.appendChild(createBlockTypeIcon(type));
      const label = document.createElement('span');
      label.textContent = text(key, fallback);
      itemBtn.appendChild(label);
      itemBtn.addEventListener('click', () => runBlockCommand(type, data));
      menu.appendChild(itemBtn);
    });
    const cardBtn = button('', 'blocks-command-menu-item');
    cardBtn.dataset.blockCommand = 'card';
    cardBtn.setAttribute('role', 'menuitem');
    cardBtn.appendChild(createBlockTypeIcon('card'));
    const cardLabel = document.createElement('span');
    cardLabel.textContent = text('articleCard', 'Article Card');
    cardBtn.appendChild(cardLabel);
    cardBtn.addEventListener('click', openArticleCardCommand);
    menu.appendChild(cardBtn);
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeBlockCommandMenu(true);
      }
    });
    return menu;
  };

  const createRichEditable = (tagName, block, key, className, index) => {
    const editable = document.createElement(tagName);
    editable.className = className || 'blocks-rich-editable';
    editable.contentEditable = 'true';
    editable.spellcheck = true;
    setPlainContentEditableValue(editable, block.data[key] || '');
    const sync = () => updateFromControl(block, { [key]: editableText(editable) });
    editableSession.registerEditable(editable, sync);
    editable.addEventListener('input', () => {
      sync();
      updateInlineToolbarState();
    });
    editable.addEventListener('keydown', (event) => {
      if (removeEmptyBlockWithBackspace(event, block, index, editable, sync)) return;
      if (mergeTextBlockWithPreviousOnBackspace(event, block, index, editable)) return;
      if (handleCrossBlockArrowNavigation(event, index, editable)) return;
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      if (!['paragraph', 'quote', 'heading'].includes(block.type)) return;
      if (splitTextBlockAfterCaret(event, block, index, editable)) return;
      if (!shouldInsertBlankBlockOnEnter(editable, caretSession)) return;
      event.preventDefault();
      insertBlankBlockAfter(index, editable, sync);
    });
    editable.addEventListener('focus', () => setActive(index, editable, sync));
    editable.addEventListener('pointerdown', (event) => {
      if (event && event.button === 0 && event.isPrimary !== false) {
        activateEditableFromPointer(index, editable, sync);
      }
      routeDirectQuoteCaretFromPointer(editable, index, sync, event);
    });
    editable.addEventListener('click', (event) => {
      const clickedLink = event.target && event.target.closest ? event.target.closest('a[href]') : null;
      const clickedMath = event.target && event.target.closest ? event.target.closest('.press-math[data-tex]') : null;
      if (clickedLink || clickedMath) event.preventDefault();
      setActive(index, editable, sync);
      const pointerMarks = inlineMarksFromPointerEvent(event, editable, selectionSession);
        const pointerCodeRange = pointerMarks.code ? inlineMarkedDomRangeFromPointerEvent(event, editable, 'code', selectionSession, inlineDomSession) : null;
      blocksState.rememberInlineMarks(
        editable,
        pointerMarks,
        pointerCodeRange ? { mark: 'code', ...pointerCodeRange } : null
      );
      updateInlineToolbarState();
      if (clickedLink) refreshLinkEditor(clickedLink);
      if (clickedMath) openMathEditorForNode(clickedMath);
    });
    wireInlineEditable(editable, index, sync);
    return editable;
  };

  const createHeadingLevelSelect = (block) => {
    const select = document.createElement('select');
    select.className = 'blocks-heading-level';
    select.title = text('headingLevel', 'Heading level');
    [1, 2, 3, 4, 5, 6].forEach(level => {
      const option = document.createElement('option');
      option.value = String(level);
      option.textContent = `H${level}`;
      select.appendChild(option);
    });
    select.value = String(block.data.level || 2);
    select.addEventListener('change', () => updateFromControl(block, { level: Number(select.value) || 2 }, true));
    return select;
  };

  const syncRenderedImageBlock = (block) => {
    const blockEl = blockElements().find(el => el && el.dataset && el.dataset.blockId === block.id);
    if (!blockEl) return;
    const figure = blockEl.querySelector('.blocks-image-figure');
    const img = blockEl.querySelector('.blocks-image-preview');
    const caption = blockEl.querySelector('.blocks-image-figure figcaption');
    if (img) {
      img.alt = block.data.alt || '';
      const nextSrc = resolveAssetSrc(block.data.src || '');
      configureImagePreview(figure, img, nextSrc);
    }
    if (caption) {
      caption.textContent = block.data.alt || '';
      caption.classList.toggle('is-empty', !block.data.alt);
    }
    hydrateImages(blockEl);
  };

  const syncImageAltFromCaption = (block, caption) => {
    const blockEl = blockElements().find(el => el && el.dataset && el.dataset.blockId === block.id);
    const img = blockEl && blockEl.querySelector('.blocks-image-preview');
    const alt = plainEditableValue(caption);
    if (img) img.alt = alt;
    if (caption) caption.classList.toggle('is-empty', !alt);
    updateFromControl(block, { alt });
  };

  const setImagePlaceholderVisible = (figure, visible) => {
    if (!figure) return;
    figure.classList.toggle('is-image-placeholder', !!visible);
  };

  const configureImagePreview = (figure, img, src) => {
    if (!img) return;
    const nextSrc = String(src || '').trim();
    img.dataset.blocksResolvedSrc = nextSrc;
    img.onload = () => {
      if (img.dataset.blocksResolvedSrc !== nextSrc || !nextSrc) return;
      setImagePlaceholderVisible(figure, false);
    };
    img.onerror = () => {
      if (img.dataset.blocksResolvedSrc !== nextSrc) return;
      setImagePlaceholderVisible(figure, true);
    };
    if (!nextSrc) {
      img.removeAttribute('src');
      setImagePlaceholderVisible(figure, true);
      return;
    }
    setImagePlaceholderVisible(figure, false);
    if (img.getAttribute('src') !== nextSrc) img.src = nextSrc;
    if (img.complete && img.naturalWidth === 0) setImagePlaceholderVisible(figure, true);
  };

  const createImageMetadataControls = (block, index) => {
    const controls = document.createElement('div');
    controls.className = 'blocks-image-meta-controls';
    const replace = button(text('replaceImage', 'Replace image'), 'blocks-btn blocks-image-replace');
    replace.title = text('replaceImage', 'Replace image');
    replace.setAttribute('aria-label', text('replaceImage', 'Replace image'));
    const deleteResource = button(text('deleteImageResource', 'Delete resource'), 'blocks-btn blocks-image-delete-resource');
    deleteResource.title = text('deleteImageResource', 'Delete resource');
    deleteResource.setAttribute('aria-label', text('deleteImageResource', 'Delete resource'));
    const title = document.createElement('input');
    title.type = 'text';
    title.className = 'blocks-image-title';
    title.value = block.data.title || '';
    title.placeholder = text('imageTitle', 'Image title');
    title.setAttribute('aria-label', text('imageTitle', 'Image title'));
    const update = () => {
      updateFromControl(block, { title: inputValue(title) });
    };
    title.addEventListener('input', update);
    replace.addEventListener('mousedown', (event) => event.preventDefault());
    replace.addEventListener('click', () => {
      setActive(index);
      if (typeof options.requestImageUpload === 'function') {
        options.requestImageUpload({ replaceIndex: index, replaceBlockId: block.id });
      }
    });
    deleteResource.disabled = !(typeof options.canDeleteImageResource === 'function' && options.canDeleteImageResource(block.data.src || '', {
      index,
      blockId: block.id
    }));
    deleteResource.addEventListener('mousedown', (event) => event.preventDefault());
    deleteResource.addEventListener('click', () => {
      if (deleteResource.disabled) return;
      setActive(index);
      if (typeof options.requestImageDelete === 'function') {
        options.requestImageDelete({ index, blockId: block.id, src: block.data.src || '' });
      }
    });
    controls.append(title, replace, deleteResource);
    return controls;
  };

  const tableSession = createEditorBlocksTableSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    runtime,
    blocksState,
    editableSession,
    blockElements,
    text,
    editableTableData,
    tableColumnCount,
    normalizeTableAlignment,
    normalizeTableCellValue,
    setActive,
    activateEditableFromPointer,
    handleCrossBlockArrowNavigation,
    updateFromControl,
    queueTask: task => queueMicrotask(task)
  });

  const syncActiveTableAlignmentFromEditable = (activeBlock, editable) => {
    tableSession?.syncActiveAlignmentFromEditable(activeBlock, editable, state.blocks);
  };

  activeSession = createEditorBlocksActiveSession({
    state,
    blocksState,
    list,
    runtime,
    containsNode: nodeContains,
    syncActiveListTypeSelect,
    refreshLinkEditor,
    updateInlineToolbarState,
    syncActiveTableAlignmentFromEditable,
    requestStickyBlockHeadUpdate,
    clearNativeSelection
  });

  const renderHeadingBlock = (body, block, index) => {
    const level = Math.max(1, Math.min(6, Number(block.data.level) || 2));
    const heading = createRichEditable(`h${level}`, block, 'text', `blocks-rich-editable blocks-heading-text blocks-heading-h${level}`, index);
    body.appendChild(heading);
  };

  const renderImageBlock = (body, block, index) => {
    const figure = document.createElement('figure');
    figure.className = 'blocks-image-figure';
    const img = document.createElement('img');
    img.className = 'blocks-image-preview';
    img.alt = block.data.alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    const placeholder = document.createElement('div');
    placeholder.className = 'blocks-image-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    const placeholderLabel = document.createElement('span');
    placeholderLabel.className = 'blocks-image-placeholder-label';
    placeholderLabel.textContent = text('image', 'Image');
    placeholder.appendChild(placeholderLabel);
    const resolved = resolveAssetSrc(block.data.src || '');
    configureImagePreview(figure, img, resolved);
    const caption = document.createElement('figcaption');
    caption.className = 'blocks-image-caption';
    caption.contentEditable = 'true';
    caption.spellcheck = true;
    caption.dataset.placeholder = text('imageAlt', 'Alt text');
    caption.setAttribute('aria-label', text('imageAlt', 'Alt text'));
    caption.textContent = block.data.alt || '';
    caption.classList.toggle('is-empty', !block.data.alt);
    const syncCaption = () => syncImageAltFromCaption(block, caption);
    editableSession.registerEditable(caption, syncCaption);
    caption.addEventListener('input', syncCaption);
    caption.addEventListener('paste', (event) => {
      const pasted = event.clipboardData && event.clipboardData.getData('text/plain');
      if (pasted == null) return;
      event.preventDefault();
      if (insertPlainTextIntoEditable(caption, pasted.replace(/[\r\n]+/g, ' '), selectionSession)) syncCaption();
    });
    caption.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        return;
      }
      if (removeEmptyBlockWithBackspace(event, block, index, caption, syncCaption)) return;
      handleCrossBlockArrowNavigation(event, index, caption);
    });
    caption.addEventListener('focus', () => {
      setActive(index, caption, syncCaption);
      updateInlineToolbarState();
    });
    figure.append(img, placeholder, caption);

    body.append(figure);
    hydrateImages(figure);
  };

  const renderTableBlock = (body, block, index) => {
    tableSession?.renderBlock(body, block, index);
  };

  const createListTypeSelect = (block, index) => {
    const select = document.createElement('select');
    select.className = 'blocks-list-type-select';
    select.title = text('listType', 'List type');
    [['ul', text('unordered', 'Bulleted')], ['ol', text('ordered', 'Numbered')], ['task', text('task', 'Checklist')]].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    });
    select.value = listTypeControlValue(block, index);
    select.addEventListener('change', () => updateListType(block, index, select.value));
    return select;
  };

  const createListIndentControls = (block, index) => {
    const controls = document.createElement('div');
    controls.className = 'blocks-list-indent-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', text('listIndentControls', 'List indentation'));
    [
      ['←', -1, 'listOutdent', 'Decrease list indent'],
      ['→', 1, 'listIndent', 'Increase list indent']
    ].forEach(([label, delta, key, fallback]) => {
      const btn = button(label, 'blocks-icon-btn blocks-list-indent-btn');
      btn.title = text(key, fallback);
      btn.setAttribute('aria-label', text(key, fallback));
      btn.addEventListener('mousedown', (event) => event.preventDefault());
      btn.addEventListener('click', () => {
        setActive(index);
        indentListItem(block, index, delta);
      });
      controls.appendChild(btn);
    });
    return controls;
  };

  const createCodeLanguageInput = (block) => {
    const lang = document.createElement('select');
    lang.className = 'blocks-code-language';
    lang.title = text('codeLanguage', 'Language');
    lang.setAttribute('aria-label', text('codeLanguage', 'Language'));
    const currentLang = String(block.data.lang || '').trim();
    const normalizedLang = currentLang.toLowerCase();
    const resolvedLang = CODE_LANGUAGE_ALIASES.get(normalizedLang) || normalizedLang;
    const labels = new Map([
      ['', 'Auto / blank'],
      ['plain', 'plain']
    ]);
    const appendOption = (value, label, unsupported = false) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label || value || 'Auto / blank';
      if (unsupported) {
        option.disabled = true;
        option.dataset.unsupported = 'true';
      }
      lang.appendChild(option);
    };
    CODE_LANGUAGE_OPTIONS.forEach((value) => appendOption(value, labels.get(value) || value));
    if (currentLang && !CODE_LANGUAGE_OPTIONS.includes(normalizedLang) && !CODE_LANGUAGE_OPTIONS.includes(resolvedLang)) {
      appendOption(currentLang, `Unsupported: ${currentLang}`, true);
    }
    lang.value = CODE_LANGUAGE_OPTIONS.includes(normalizedLang)
      ? normalizedLang
      : (CODE_LANGUAGE_OPTIONS.includes(resolvedLang) ? resolvedLang : currentLang);
    lang.addEventListener('change', () => updateFromControl(block, { lang: lang.value }, true));
    return lang;
  };

  const createMathEditButton = (block, index) => {
    const edit = button(text('editMath', 'Edit math'), 'blocks-btn blocks-math-edit');
    edit.title = text('editMath', 'Edit math');
    edit.setAttribute('aria-label', text('editMath', 'Edit math'));
    edit.addEventListener('mousedown', (event) => event.preventDefault());
    edit.addEventListener('click', () => {
      setActive(index);
      const blockEl = blockElements()[index] || null;
      openMathEditorForBlock(block, blockEl);
    });
    return edit;
  };

  const autoSizeTextarea = (area) => {
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };

  const renderCodeGutter = (gutter, value) => {
    if (!gutter) return;
    const lineCount = Math.max(1, String(value == null ? '' : value).split('\n').length);
    if (gutter.childElementCount !== lineCount) {
      const frag = document.createDocumentFragment();
      for (let line = 1; line <= lineCount; line += 1) {
        const span = document.createElement('span');
        span.textContent = String(line);
        frag.appendChild(span);
      }
      gutter.replaceChildren(frag);
    } else {
      Array.from(gutter.children).forEach((span, index) => {
        const label = String(index + 1);
        if (span.textContent !== label) span.textContent = label;
      });
    }
  };

  const codeLabelText = (key, fallback) => {
    return runtime.translate(key, fallback);
  };

  const createCodeLanguageLabel = (getCodeText) => {
    const label = document.createElement('div');
    label.className = 'syntax-language-label blocks-code-language-label';
    label.dataset.lang = 'PLAIN';
    label.textContent = 'PLAIN';
    label.setAttribute('role', 'button');
    label.setAttribute('tabindex', '0');
    label.setAttribute('aria-label', codeLabelText('code.copyAria', 'Copy code'));

    const restoreLabel = () => {
      label.textContent = label.dataset.lang || 'PLAIN';
    };
    const copyCode = async () => {
      const rawText = typeof getCodeText === 'function' ? String(getCodeText() || '') : '';
      const ok = await runtime.writeClipboardText(rawText);
      const old = label.dataset.lang || 'PLAIN';
      label.classList.add('is-copied');
      label.textContent = ok ? codeLabelText('code.copied', 'Copied').toUpperCase() : codeLabelText('code.failed', 'Failed').toUpperCase();
      runtime.setTimer(() => {
        label.classList.remove('is-copied');
        label.textContent = old;
      }, 1200);
    };

    label.addEventListener('mouseenter', () => {
      label.classList.add('is-hover');
      label.textContent = codeLabelText('code.copy', 'Copy').toUpperCase();
    });
    label.addEventListener('mouseleave', () => {
      label.classList.remove('is-hover');
      restoreLabel();
    });
    label.addEventListener('click', copyCode);
    label.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        copyCode();
      }
    });
    return label;
  };

  const renderCodeHighlight = (highlight, label, value, language) => {
    if (!highlight || !label) return;
    const raw = String(value == null ? '' : value);
    const meta = resolveCodeHighlightLanguage(language, raw);
    highlight.className = `blocks-code-highlight language-${meta.language}`;
    highlight.replaceChildren(createSafeHighlightFragment(raw, meta.highlight ? meta.language : 'plain'));
    label.dataset.lang = meta.label || 'PLAIN';
    if (!label.classList.contains('is-hover') && !label.classList.contains('is-copied')) {
      label.textContent = label.dataset.lang;
    }
  };

  const renderListBlock = (body, block, index) => {
    const items = editableListItems(block.data.items);
    const listType = block.data.listType === 'ol' || block.data.listType === 'task' || block.data.listType === 'mixed' ? block.data.listType : 'ul';
    const isTaskList = listType === 'task';
    const listEl = document.createElement(isTaskList ? 'ul' : 'div');
    listEl.className = isTaskList
      ? 'blocks-visual-list blocks-visual-list-task'
      : `blocks-visual-list blocks-visual-list-standard blocks-visual-list-${summarizeListType(items, listType)}`;
    if (!isTaskList) listEl.setAttribute('role', 'list');
    const visualMarkerLabels = listVisualMarkerLabels(items, listType);
    items.forEach((item, itemIndex) => {
      const itemType = effectiveListItemType(item, listType);
      const isTaskItem = itemType === 'task';
      const li = document.createElement(isTaskList ? 'li' : 'div');
      li.className = 'blocks-list-item';
      li.dataset.itemIndex = String(itemIndex);
      li.dataset.listType = itemType;
      if (!isTaskList) li.setAttribute('role', 'listitem');
      const itemIndent = itemIndentLevel(item);
      li.dataset.indent = String(itemIndent);
      if (itemIndent) li.style.marginLeft = `${itemIndent * 1.75}rem`;
      if (isTaskItem) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!item.checked;
        checkbox.addEventListener('change', () => {
          const next = patchListItem(block.data.items, itemIndex, { checked: checkbox.checked });
          updateFromControl(block, { items: next });
        });
        li.appendChild(checkbox);
      } else {
        const marker = document.createElement('span');
        marker.className = `blocks-list-marker blocks-list-marker-${itemType}`;
        marker.setAttribute('aria-hidden', 'true');
        marker.textContent = visualMarkerLabels[itemIndex] || (itemType === 'ol' ? '1.' : '•');
        li.appendChild(marker);
      }
      const span = document.createElement('span');
      span.className = 'blocks-rich-editable blocks-list-text';
      span.contentEditable = 'true';
      span.spellcheck = true;
      setPlainContentEditableValue(span, item.text || '');
      const sync = () => {
        const next = patchListItem(block.data.items, itemIndex, { text: editableText(span) });
        updateFromControl(block, { items: next });
      };
      editableSession.registerEditable(span, sync);
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
          const currentItems = Array.isArray(block.data.items) ? block.data.items.slice() : items.slice();
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
            const blockAfter = block.data && block.data.after != null ? block.data.after : '\n\n';
            const paragraph = makeBlock('paragraph', '', { text: trailingParagraph.text, after: blockAfter, dirty: true });
            if (trailingParagraph.before.length) {
              block.data.items = trailingParagraph.before;
              block.data.after = '\n\n';
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
            const blockAfter = block.data && block.data.after != null ? block.data.after : '\n\n';
            if (splitAfter.length) {
              if (emptySplit.before.length) {
                block.data.items = emptySplit.before;
                block.data.after = '\n\n';
                markDirty(block);
                const nextBlock = makeSplitListBlock(block, splitAfter, blockAfter);
                blocksState.replaceBlocks(index, 1, [block, nextBlock], {
                  pendingListFocus: { blockId: nextBlock.id, itemIndex: 0, atEnd: false }
                });
              } else {
                block.data.items = splitAfter;
                block.data.after = blockAfter;
                markDirty(block);
                blocksState.replaceBlocks(index, 1, [block], {
                  pendingListFocus: { blockId: block.id, itemIndex: 0, atEnd: false }
                });
              }
              render();
              emit();
            } else if (emptySplit.before.length) {
              block.data.items = emptySplit.before;
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
          const next = Array.isArray(block.data.items) ? block.data.items.slice() : items.slice();
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
          const currentItems = Array.isArray(block.data.items) ? block.data.items.slice() : items.slice();
          currentItems[0] = { ...(currentItems[0] || {}), text: currentText };
          const previous = state.blocks[index - 1] || null;
          const merged = mergeFirstListItemIntoPreviousBlock(previous, { ...block, data: { ...(block.data || {}), items: currentItems } }, itemIndex);
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
      if (state.pendingListFocus && state.pendingListFocus.blockId === block.id && state.pendingListFocus.itemIndex === itemIndex) {
        queueMicrotask(() => {
          if (!nodeContains(root, span)) return;
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

  const renderCodeBlock = (body, block, index) => {
    const pre = document.createElement('pre');
    pre.className = 'blocks-code-preview';
    const scroll = document.createElement('div');
    scroll.className = 'blocks-code-scroll';
    const gutter = document.createElement('div');
    gutter.className = 'blocks-code-gutter';
    gutter.setAttribute('aria-hidden', 'true');
    const surface = document.createElement('div');
    surface.className = 'blocks-code-surface';
    const highlight = document.createElement('code');
    highlight.className = 'blocks-code-highlight language-plain';
    highlight.setAttribute('aria-hidden', 'true');
    const code = document.createElement('code');
    code.className = 'blocks-code-editable';
    code.contentEditable = 'true';
    code.spellcheck = false;
    code.textContent = block.data.text || '';
    const languageLabel = createCodeLanguageLabel(() => codeEditableText(code));
    renderCodeGutter(gutter, block.data.text || '');
    renderCodeHighlight(highlight, languageLabel, block.data.text || '', block.data.lang || '');
    const sync = () => {
      const text = codeEditableText(code);
      updateFromControl(block, { text });
      renderCodeGutter(gutter, text);
      renderCodeHighlight(highlight, languageLabel, text, block.data.lang || '');
    };
    editableSession.registerEditable(code, sync);
    code.addEventListener('input', sync);
    code.addEventListener('keydown', (event) => {
      if (removeEmptyBlockWithBackspace(event, block, index, code, sync)) return;
      if (handleCrossBlockArrowNavigation(event, index, code)) return;
      if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      event.preventDefault();
      const text = insertCodeEditableTextAtSelection(code, '\n', selectionSession);
      updateFromControl(block, { text });
      renderCodeGutter(gutter, text);
      renderCodeHighlight(highlight, languageLabel, text, block.data.lang || '');
    });
    code.addEventListener('focus', () => setActive(index, code, sync));
    code.addEventListener('pointerdown', (event) => {
      if (event && event.button === 0 && event.isPrimary !== false) {
        activateEditableFromPointer(index, code, sync);
      }
    });
    surface.append(highlight, code);
    scroll.append(gutter, surface);
    pre.appendChild(scroll);
    pre.appendChild(languageLabel);
    body.appendChild(pre);
  };

  const renderMathBlock = (body, block, index) => {
    const preview = document.createElement('div');
    preview.className = 'blocks-math-preview';
    const math = document.createElement('div');
    math.className = 'press-math press-math-display blocks-display-math';
    math.dataset.tex = block.data.tex || '';
    math.setAttribute('data-tex', block.data.tex || '');
    math.textContent = block.data.tex || text('math', 'Math');
    preview.appendChild(math);
    preview.addEventListener('pointerdown', (event) => {
      if (!event || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      event.stopPropagation();
      activateNonTextBlockFromPointer(index, closestElement(preview, '.blocks-block-math'));
    });
    preview.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActive(index);
      openMathEditorForBlock(block, closestElement(preview, '.blocks-block-math'));
    });
    body.appendChild(preview);
    try { renderPressMath(preview); } catch (_) {}
  };

  const renderCardBlock = (body, block, index) => {
    const preview = document.createElement('div');
    preview.className = 'blocks-card-preview';
    const href = `?id=${encodeURIComponent(String(block.data.location || '').trim())}`;
    const label = String(block.data.label || block.data.location || text('articleCard', 'Article Card')).trim() || text('articleCard', 'Article Card');
    preview.innerHTML = `<span class="blocks-card-source"><a href="${escapeAttribute(href)}" title="card">${escapeHtml(label)}</a></span>`;
    preview.addEventListener('pointerdown', (event) => {
      if (!event || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      event.stopPropagation();
      activateNonTextBlockFromPointer(index, closestElement(preview, '.blocks-block-card'));
    });
    preview.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActive(index);
    });
    body.appendChild(preview);
    hydrateCard(preview);
    preview.querySelectorAll('a[href]').forEach((link) => {
      link.tabIndex = -1;
      link.setAttribute('aria-disabled', 'true');
    });
  };

  const renderBlankBlock = (body, block, index) => {
    const isCommandOpen = state.commandMenuOpen && state.commandMenuInsertIndex === index;
    body.classList.add('blocks-virtual-body');
    const editable = document.createElement('p');
    editable.className = 'blocks-rich-editable blocks-paragraph-text blocks-virtual-editable blocks-blank-editable';
    editable.contentEditable = 'true';
    editable.spellcheck = true;
    editable.setAttribute('aria-label', text('virtualBlockAria', 'New block'));
    editable.dataset.placeholder = text('virtualBlockPlaceholder', 'Type / to chose a block');
    editableSession.registerEditable(editable, null);
    editable.addEventListener('beforeinput', (event) => {
      if (event.isComposing) return;
      if (event.inputType !== 'insertText' || event.data == null) return;
      event.preventDefault();
      if (event.data === '/') {
        openBlockCommandMenu(index);
        return;
      }
      createParagraphFromBlankInput(event.data, index);
    });
    editable.addEventListener('input', () => {
      const value = editableText(editable);
      if (!value) return;
      if (value === '/') {
        editable.textContent = '';
        openBlockCommandMenu(index);
        return;
      }
      createParagraphFromBlankInput(value, index);
    });
    editable.addEventListener('paste', (event) => {
      const pasted = event.clipboardData && event.clipboardData.getData('text/plain');
      if (!pasted) return;
      event.preventDefault();
      createParagraphFromBlankInput(pasted, index);
    });
    editable.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
        event.preventDefault();
        insertBlankBlock(index + 1, { focus: true });
        return;
      }
      if (removeEmptyBlockWithBackspace(event, block, index, editable, null)) return;
      if (handleCrossBlockArrowNavigation(event, index, editable)) return;
      if (event.key === 'Escape' && isCommandOpen) {
        event.preventDefault();
        closeBlockCommandMenu(true);
      }
    });
    editable.addEventListener('focus', () => {
      setActive(index, editable, null);
      updateInlineToolbarState();
    });
    body.append(editable, createCommandMenuElement(isCommandOpen));
  };

  const renderBlockBody = (block, index) => {
    const body = document.createElement('div');
    body.className = 'blocks-block-body blocks-visual-body';
    if (block.type === 'blank') {
      renderBlankBlock(body, block, index);
    } else if (block.type === 'heading') {
      renderHeadingBlock(body, block, index);
    } else if (block.type === 'paragraph') {
      body.appendChild(createRichEditable('p', block, 'text', 'blocks-rich-editable blocks-paragraph-text', index));
    } else if (block.type === 'quote') {
      const quote = document.createElement('blockquote');
      quote.className = 'blocks-quote-preview';
      quote.appendChild(createRichEditable('p', block, 'text', 'blocks-rich-editable blocks-quote-text', index));
      body.appendChild(quote);
    } else if (block.type === 'image') {
      renderImageBlock(body, block, index);
    } else if (block.type === 'table') {
      renderTableBlock(body, block, index);
    } else if (block.type === 'list') {
      renderListBlock(body, block, index);
    } else if (block.type === 'code') {
      renderCodeBlock(body, block, index);
    } else if (block.type === 'math') {
      renderMathBlock(body, block, index);
    } else if (block.type === 'card') {
      renderCardBlock(body, block, index);
    } else {
      const area = document.createElement('textarea');
      area.className = 'blocks-textarea blocks-source-textarea';
      area.spellcheck = false;
      area.rows = 1;
      area.value = block.data.text != null ? block.data.text : block.raw || '';
      const sync = () => updateFromControl(block, { text: area.value });
      let sourcePointer = null;
      editableSession.registerEditable(area, sync);
      area.addEventListener('input', () => {
        sync();
        autoSizeTextarea(area);
      });
      area.addEventListener('keydown', (event) => {
        if (removeEmptyBlockWithBackspace(event, block, index, area, sync)) return;
        handleCrossBlockArrowNavigation(event, index, area);
      });
      area.addEventListener('pointerdown', (event) => {
        if (!event || event.button !== 0 || event.isPrimary === false) return;
        activateEditableFromPointer(index, area, sync);
        const details = textareaTextOffsetDetailsFromPoint(area, event.clientX, event.clientY, CARET_POINT_MEASURE_LIMIT, caretSession);
        if (details && !details.insideTextRect) {
          event.preventDefault();
          sourcePointer = { x: event.clientX, y: event.clientY, moved: false, corrected: true };
          try { area.focus({ preventScroll: true }); }
          catch (_) {
            try { area.focus(); } catch (__) {}
          }
          try {
            area.setSelectionRange(details.offset, details.offset);
            autoSizeTextarea(area);
            setActive(index, area, sync);
          } catch (_) {}
          return;
        }
        sourcePointer = { x: event.clientX, y: event.clientY, moved: false, corrected: false };
      });
      area.addEventListener('pointermove', (event) => {
        if (!sourcePointer) return;
        const dx = event.clientX - sourcePointer.x;
        const dy = event.clientY - sourcePointer.y;
        if ((dx * dx) + (dy * dy) > 16) sourcePointer.moved = true;
      });
      area.addEventListener('click', (event) => {
        const pointer = sourcePointer;
        sourcePointer = null;
        if (!pointer || pointer.moved || pointer.corrected) return;
        const details = textareaTextOffsetDetailsFromPoint(area, event.clientX, event.clientY, CARET_POINT_MEASURE_LIMIT, caretSession);
        if (!details || details.insideTextRect) return;
        try {
          area.setSelectionRange(details.offset, details.offset);
          autoSizeTextarea(area);
          setActive(index, area, sync);
        } catch (_) {}
      });
      area.addEventListener('blur', () => { sourcePointer = null; });
      area.addEventListener('focus', () => {
        autoSizeTextarea(area);
        setActive(index, area, sync);
      });
      queueMicrotask(() => autoSizeTextarea(area));
      body.appendChild(area);
    }
    body.addEventListener('click', (event) => {
      if (shouldSuppressRoutedBlockContainerClick()) {
        event.stopPropagation();
        return;
      }
      setActive(index);
    });
    return body;
  };

  const renderBlockElement = (block, index) => {
    const item = document.createElement('section');
    item.className = `blocks-block blocks-block-${block.type}`;
    if (index === state.activeIndex) item.classList.add('is-active');
    item.dataset.type = block.type;
    item.dataset.blockId = block.id;
    item.tabIndex = -1;
    const head = document.createElement('div');
    head.className = 'blocks-block-head';
    const type = document.createElement('span');
    type.className = 'blocks-block-type';
    const typeLabel = text(block.type === 'card' ? 'articleCard' : block.type, block.type);
    type.title = typeLabel;
    type.setAttribute('role', 'img');
    type.setAttribute('aria-label', typeLabel);
    type.appendChild(createBlockTypeIcon(block.type));
    const actions = createBlockActionMenu(index);
    head.appendChild(type);
    head.addEventListener('wheel', forwardBlockHeadWheel, { passive: false });
    if (block.type === 'source') {
      head.appendChild(createSourceReasonHelp(block, index));
      if (canAutofixSourceBlock(block)) head.appendChild(createSourceAutofixButton(block, index));
    }
    if (block.type === 'heading') {
      head.appendChild(createHeadingLevelSelect(block));
    }
    if (block.type === 'list') {
      head.appendChild(createListTypeSelect(block, index));
      head.appendChild(createListIndentControls(block, index));
    }
    if (block.type === 'code') {
      head.appendChild(createCodeLanguageInput(block));
    }
    if (block.type === 'math') {
      head.appendChild(createMathEditButton(block, index));
    }
    if (block.type === 'image') {
      head.appendChild(createImageMetadataControls(block, index));
    }
    if (block.type === 'table') {
      const controls = tableSession?.createControls(block, index);
      if (controls) head.appendChild(controls);
    }
    if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'list') {
      head.appendChild(createInlineControls(index));
    }
    head.appendChild(actions);
    item.append(head, renderBlockBody(block, index));
    item.addEventListener('click', (event) => {
      if (shouldSuppressRoutedBlockContainerClick()) return;
      if (closestElement(event.target, '.blocks-block-head')) return;
      setActive(index);
    });
    item.addEventListener('focusin', () => setActive(index));
    item.addEventListener('keydown', (event) => {
      if (event.target !== item) return;
      if (removeEmptyBlockWithBackspace(event, block, index)) return;
      handleCrossBlockArrowNavigation(event, index);
    });
    return item;
  };

  const replaceAdjacentBlockElements = (index, targetIndex) => {
    const firstIndex = Math.min(index, targetIndex);
    const secondIndex = Math.max(index, targetIndex);
    const nodes = blockElements();
    const firstOld = nodes[firstIndex];
    const secondOld = nodes[secondIndex];
    if (!firstOld || !secondOld || !firstOld.parentNode || !secondOld.parentNode) return false;
    const firstNew = renderBlockElement(state.blocks[firstIndex], firstIndex);
    const secondNew = renderBlockElement(state.blocks[secondIndex], secondIndex);
    list.insertBefore(firstNew, firstOld);
    firstOld.remove();
    list.insertBefore(secondNew, secondOld);
    secondOld.remove();
    setActive(state.activeIndex);
    return true;
  };

  function render() {
    closeBlockActionMenu(false);
    closeInlineMoreMenu(false);
    list.innerHTML = '';
    state.blocks.forEach((block, index) => {
      list.appendChild(renderBlockElement(block, index));
    });
    cardPickerSession?.render();
    setActive(state.activeIndex);
    requestStickyBlockHeadUpdate();
  }

  const resolveImageBlockTarget = (target = state.activeIndex) => {
    return blocksState.resolveBlockTarget(target, block => block && block.type === 'image');
  };

  const api = {
    setMarkdown(markdown) {
      blocksState.setMarkdown(markdown);
      render();
    },
    getMarkdown() {
      return blocksState.serialize();
    },
    insertImageBlock(src, alt, index = state.activeIndex + 1) {
      const block = insertBlock('image', { src, alt: alt || '', title: '' }, index);
      return { index: state.blocks.indexOf(block) };
    },
    replaceImageBlock(src, target = state.activeIndex) {
      const resolved = resolveImageBlockTarget(target);
      if (!resolved) return null;
      const { block, index: safeIndex } = resolved;
      updateFromControl(block, { src }, true);
      setActive(safeIndex);
      return { index: safeIndex };
    },
    getImageBlockSource(target = state.activeIndex) {
      const resolved = resolveImageBlockTarget(target);
      return resolved ? String((resolved.block.data && resolved.block.data.src) || '') : '';
    },
    deleteImageBlock(target = state.activeIndex) {
      const resolved = resolveImageBlockTarget(target);
      if (!resolved) return null;
      const src = String((resolved.block.data && resolved.block.data.src) || '');
      deleteBlockAt(resolved.index);
      return { index: resolved.index, src };
    },
    setCardEntries(entries) {
      if (cardPickerSession) cardPickerSession.setEntries(entries);
      else blocksState.setCardEntries(entries);
    },
    focus() {
      const active = list.querySelector('.blocks-block.is-active [contenteditable="true"], .blocks-block.is-active .blocks-image-caption, .blocks-block.is-active input, .blocks-block.is-active textarea');
      try { if (active) active.focus(); } catch (_) {}
    },
    requestLayout() {
      render();
    },
    dispose() {
      closeBlockActionMenu(false);
      closeInlineMoreMenu(false);
      Array.from(runtimeDisposables).forEach((dispose) => {
        try { dispose(); } catch (_) {}
      });
      runtimeDisposables.clear();
    }
  };

  api.setMarkdown('');
  return api;
}
