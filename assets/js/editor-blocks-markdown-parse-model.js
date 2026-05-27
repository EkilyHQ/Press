// DOM-free Markdown block parsing, classification, and source autofix helpers.

import {
  makeBlankBlock,
  makeBlock,
  normalizeText,
  splitBlankLineUnits
} from './editor-blocks-block-core-model.js';
import {
  dedentIndentedListSource,
  isListItemLine,
  parseListBlock,
  parseListLineInfo
} from './editor-blocks-list-model.js';
import {
  parseTableBlock
} from './editor-blocks-table-model.js';

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

function splitExtraBlankBlocks(after) {
  const units = splitBlankLineUnits(after);
  if (units.length <= 2) return { separator: after || '', blanks: [] };
  return {
    separator: units.slice(0, 2).join(''),
    blanks: units.slice(2)
  };
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

function parseQuoteBlock(raw) {
  const lines = raw.split('\n');
  if (!lines.length || !lines.every(line => line.startsWith('>'))) return null;
  const first = lines[0].slice(1).trim();
  if (/^\[!\w+\]/.test(first)) return null;
  return { text: lines.map(line => line.replace(/^>\s?/, '')).join('\n') };
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
