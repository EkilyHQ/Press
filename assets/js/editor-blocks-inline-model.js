// DOM-free inline Markdown run parsing, serialization, and mutation helpers.

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

export function inlineRenderedTextLength(markdownText) {
  return parseInlineRuns(normalizeEditableMarkdownText(markdownText))
    .reduce((total, run) => total + String(run && run.text != null ? run.text : '').length, 0);
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
