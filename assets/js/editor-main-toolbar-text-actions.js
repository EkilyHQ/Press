export function createEditorMainToolbarTextActions(options = {}) {
  const getEditorTextarea = typeof options.getEditorTextarea === 'function' ? options.getEditorTextarea : () => null;
  const createInputEvent = typeof options.createInputEvent === 'function' ? options.createInputEvent : () => null;

  let lastSelectionRange = { start: 0, end: 0 };
  let suppressSelectionTracking = false;

  const dispatchInputEvent = (textarea) => {
    if (!textarea || typeof textarea.dispatchEvent !== 'function') return;
    const event = createInputEvent();
    if (event) textarea.dispatchEvent(event);
  };

  const isCaretOnEmptyLine = (textarea, selection) => {
    if (!textarea || !selection) return false;
    const { start, end } = selection;
    if (end !== start) return false;
    const value = textarea.value || '';
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', start);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd);
    return line.trim().length === 0;
  };

  const getNormalizedSelection = () => {
    const textarea = getEditorTextarea();
    if (!textarea) return { start: 0, end: 0 };
    let start = textarea.selectionStart ?? 0;
    let end = textarea.selectionEnd ?? start;
    if (end < start) { const tmp = start; start = end; end = tmp; }
    return { start, end };
  };

  const recordSelection = () => {
    if (suppressSelectionTracking) return false;
    const textarea = getEditorTextarea();
    if (!textarea) return false;
    lastSelectionRange = getNormalizedSelection();
    return true;
  };

  const restoreSelection = () => {
    const textarea = getEditorTextarea();
    if (!textarea) return null;
    suppressSelectionTracking = true;
    try {
      try { textarea.focus(); }
      catch (_) {}
      if (lastSelectionRange) {
        const { start, end } = lastSelectionRange;
        if (typeof start === 'number' && typeof end === 'number') {
          try { textarea.setSelectionRange(start, end); }
          catch (_) {}
        }
      }
    } finally {
      suppressSelectionTracking = false;
    }
    return textarea;
  };

  const applyInlineFormat = (prefix, suffix) => {
    const textarea = restoreSelection();
    if (!textarea) return false;
    const { start, end } = getNormalizedSelection();
    if (end <= start) return false;
    const value = textarea.value || '';
    const selected = value.slice(start, end);
    const startTag = String(prefix ?? '');
    const endTag = String(suffix ?? '');
    let replacement;
    if (
      selected.startsWith(startTag)
      && selected.endsWith(endTag)
      && selected.length >= startTag.length + endTag.length
    ) {
      replacement = selected.slice(startTag.length, selected.length - endTag.length);
    } else {
      replacement = `${startTag}${selected}${endTag}`;
    }
    textarea.setRangeText(replacement, start, end, 'end');
    const newEnd = start + replacement.length;
    textarea.setSelectionRange(start, newEnd);
    dispatchInputEvent(textarea);
    recordSelection();
    return true;
  };

  const toggleLinePrefix = (prefix) => {
    const textarea = restoreSelection();
    if (!textarea) return false;
    const normalizedPrefix = String(prefix ?? '');
    const selection = getNormalizedSelection();
    let { start, end } = selection;
    const wasCollapsed = end <= start;
    const wasCaretOnEmptyLine = wasCollapsed && isCaretOnEmptyLine(textarea, selection);
    const value = textarea.value || '';
    if (end <= start) {
      if (!wasCaretOnEmptyLine) return false;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = value.length;
      start = lineStart;
      end = lineEnd;
    }
    if (end < start) return false;
    const blockStart = value.lastIndexOf('\n', start - 1) + 1;
    let blockEnd = value.indexOf('\n', end);
    if (blockEnd === -1) blockEnd = value.length;
    const block = value.slice(blockStart, blockEnd);
    const lines = block.split('\n');
    const shouldRemove = lines.every(line => {
      const indentMatch = line.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      return line.slice(indent.length).startsWith(normalizedPrefix);
    });
    const updated = lines.map(line => {
      const indentMatch = line.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      const content = line.slice(indent.length);
      if (shouldRemove) {
        if (content.startsWith(normalizedPrefix)) {
          return indent + content.slice(normalizedPrefix.length);
        }
        return line;
      }
      if (content.startsWith(normalizedPrefix)) return line;
      if (!content) return indent + normalizedPrefix;
      return indent + normalizedPrefix + content;
    });
    const replacement = updated.join('\n');
    textarea.setSelectionRange(blockStart, blockEnd);
    textarea.setRangeText(replacement, blockStart, blockEnd, 'end');
    const newEnd = blockStart + replacement.length;
    if (wasCaretOnEmptyLine && wasCollapsed && !shouldRemove) {
      const firstLine = replacement.split('\n', 1)[0] || '';
      const indentMatch = firstLine.match(/^\s*/);
      const indentLength = indentMatch ? indentMatch[0].length : 0;
      const caretOffset = indentLength + normalizedPrefix.length;
      const caretPos = blockStart + caretOffset;
      textarea.setSelectionRange(caretPos, caretPos);
    } else {
      textarea.setSelectionRange(blockStart, newEnd);
    }
    dispatchInputEvent(textarea);
    recordSelection();
    return true;
  };

  const applyCodeBlockFormat = () => {
    const textarea = restoreSelection();
    if (!textarea) return false;
    const selection = getNormalizedSelection();
    let { start, end } = selection;
    const value = textarea.value || '';
    if (end <= start) {
      if (!isCaretOnEmptyLine(textarea, selection)) return false;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = value.length;
      const beforeChar = lineStart > 0 ? value.charAt(lineStart - 1) : '';
      const afterChar = lineEnd < value.length ? value.charAt(lineEnd) : '';
      const prefix = beforeChar && beforeChar !== '\n' ? '\n' : '';
      const suffix = afterChar && afterChar !== '\n' ? '\n' : '';
      const block = '```\n\n```';
      textarea.setSelectionRange(lineStart, lineEnd);
      textarea.setRangeText(`${prefix}${block}${suffix}`, lineStart, lineEnd, 'end');
      const caretPos = lineStart + prefix.length + 4;
      textarea.setSelectionRange(caretPos, caretPos);
      dispatchInputEvent(textarea);
      recordSelection();
      return true;
    }
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    let block = `\`\`\`\n${selected}\n\`\`\``;
    let prefixAdded = false;
    let suffixAdded = false;
    if (start > 0 && !before.endsWith('\n')) {
      block = `\n${block}`;
      prefixAdded = true;
    }
    if (after && !after.startsWith('\n')) {
      block = `${block}\n`;
      suffixAdded = true;
    }
    textarea.setRangeText(block, start, end, 'end');
    const selectionStart = start + (prefixAdded ? 1 : 0);
    const selectionEnd = start + block.length - (suffixAdded ? 1 : 0);
    textarea.setSelectionRange(selectionStart, Math.max(selectionStart, selectionEnd));
    dispatchInputEvent(textarea);
    recordSelection();
    return true;
  };

  const insertCardLink = (entry) => {
    if (!entry || !entry.location) return false;
    const location = String(entry.location).trim();
    if (!location) return false;
    const textarea = restoreSelection();
    if (!textarea) return false;
    const value = textarea.value || '';
    const { start, end } = getNormalizedSelection();
    const safeStart = Math.max(0, Math.min(start, value.length));
    const safeEnd = Math.max(0, Math.min(end, value.length));
    const hasSelection = safeEnd > safeStart;
    const fallbackLabel = entry.key || entry.title || location;
    let linkLabel = fallbackLabel;
    if (hasSelection) {
      const selected = value.slice(safeStart, safeEnd);
      if (selected.trim()) linkLabel = selected;
    }
    const linkMarkdown = `[${linkLabel}](?id=${location})`;
    let insertText = linkMarkdown;
    let selectionStart = safeStart;
    let selectionEnd = safeStart + linkMarkdown.length;
    if (!hasSelection) {
      const before = value.slice(0, safeStart);
      const after = value.slice(safeStart);
      const needsLeading = safeStart > 0 && !before.endsWith('\n');
      const needsTrailing = after && !after.startsWith('\n');
      const leading = needsLeading ? '\n' : '';
      const trailing = needsTrailing ? '\n' : '';
      insertText = `${leading}${linkMarkdown}${trailing}`;
      selectionStart = safeStart + leading.length;
      selectionEnd = selectionStart + linkMarkdown.length;
    }
    textarea.setSelectionRange(safeStart, safeEnd);
    textarea.setRangeText(insertText, safeStart, safeEnd, 'end');
    textarea.setSelectionRange(selectionStart, selectionEnd);
    dispatchInputEvent(textarea);
    recordSelection();
    return true;
  };

  return {
    applyCodeBlockFormat,
    applyInlineFormat,
    getLastSelection: () => lastSelectionRange || { start: 0, end: 0 },
    getNormalizedSelection,
    insertCardLink,
    isCaretOnEmptyLine,
    recordSelection,
    restoreSelection,
    toggleLinePrefix
  };
}
