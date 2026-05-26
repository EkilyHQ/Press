import { createEditorBlocksSelectionSession } from './editor-blocks-selection-session.js';
import { CARET_POINT_MEASURE_LIMIT, createEditorBlocksCaretSession } from './editor-blocks-caret-session.js';
import { createEditorBlocksInlineDomSession } from './editor-blocks-inline-dom-session.js';
import {
  appendInlineRun,
  linkTitleForRun,
  mergeInlineRuns,
  normalizeEditableMarkdownText,
  parseInlineRuns,
  sanitizeEditorLinkHref,
  serializeInlineRuns
} from './editor-blocks-model.js';

function createFallbackSelectionSession(documentRef = null) {
  let windowRef = null;
  try { windowRef = documentRef && documentRef.defaultView ? documentRef.defaultView : null; }
  catch (_) { windowRef = null; }
  return createEditorBlocksSelectionSession({ documentRef, windowRef });
}

function normalizeSelectionSession(selectionSession, documentRef = null) {
  return selectionSession && typeof selectionSession.getSelectionRange === 'function'
    ? selectionSession
    : createFallbackSelectionSession(documentRef);
}

export function nodeContains(root, node) {
  try { return !!(root && node && (root === node || root.contains(node))); }
  catch (_) { return false; }
}

export function closestElement(node, selector) {
  try {
    const start = node && node.nodeType === 1 ? node : node && node.parentElement;
    return start && start.closest ? start.closest(selector) : null;
  } catch (_) {
    return null;
  }
}

export function createInlineDomSession(selectionSession = null, documentRef = null, renderMath = null) {
  return createEditorBlocksInlineDomSession({
    documentRef,
    selectionSession: normalizeSelectionSession(selectionSession, documentRef),
    mergeInlineRuns,
    sanitizeLinkHref: sanitizeEditorLinkHref,
    linkTitleForRun,
    renderMath,
    nodeContains
  });
}

function normalizeInlineDomSession(inlineDomSession) {
  return inlineDomSession && typeof inlineDomSession.renderInlineRunsInto === 'function'
    ? inlineDomSession
    : createInlineDomSession();
}

export function createCaretSession(selectionSession = null, documentRef = null) {
  return createEditorBlocksCaretSession({
    documentRef,
    selectionSession: normalizeSelectionSession(selectionSession, documentRef),
    nodeContains,
    serializeInlineDom,
    editableVisibleText
  });
}

function normalizeCaretSession(caretSessionOrSelectionSession) {
  if (caretSessionOrSelectionSession && typeof caretSessionOrSelectionSession.selectionOffsets === 'function') {
    return caretSessionOrSelectionSession;
  }
  if (caretSessionOrSelectionSession && typeof caretSessionOrSelectionSession.getSelectionRange === 'function') {
    return createCaretSession(caretSessionOrSelectionSession);
  }
  return createCaretSession();
}

export function renderInlineRunsInto(root, runs, inlineDomSession = null) {
  normalizeInlineDomSession(inlineDomSession).renderInlineRunsInto(root, runs);
}

export function inlineRunsFromDom(root) {
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

export function serializeInlineDom(root) {
  return serializeInlineRuns(inlineRunsFromDom(root));
}

export function setPlainContentEditableValue(el, value, inlineDomSession = null) {
  if (!el) return;
  renderInlineRunsInto(el, parseInlineRuns(value), inlineDomSession);
}

export function insertPlainTextIntoEditable(editable, text, selectionSession = null) {
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

export function editableText(el) {
  if (!el) return '';
  return normalizeEditableMarkdownText(serializeInlineDom(el));
}

export function editableVisibleText(el) {
  return String(el && el.textContent != null ? el.textContent : '').replace(/\u00a0/g, ' ');
}

export function splitEditableTextAtSelection(el, selectionSession = null) {
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

export function isEditableSelectionAtStart(el, caretSession = null) {
  return normalizeCaretSession(caretSession).isSelectionAtStart(el);
}

export function isEditableSelectionOnBlankLine(el, caretSession = null) {
  return normalizeCaretSession(caretSession).isSelectionOnBlankLine(el);
}

export function shouldInsertBlankBlockOnEnter(el, caretSession = null) {
  return normalizeCaretSession(caretSession).shouldInsertBlankBlockOnEnter(el);
}

export function placeCaretAtEnd(el, caretSession = null) {
  normalizeCaretSession(caretSession).placeAtEnd(el);
}

export function placeCaretAtStart(el, caretSession = null) {
  normalizeCaretSession(caretSession).placeAtStart(el);
}

export function getEditableCaretTextOffset(el, caretSession = null) {
  return normalizeCaretSession(caretSession).getTextOffset(el);
}

export function placeCaretAtTextOffset(el, offset, caretSession = null) {
  normalizeCaretSession(caretSession).placeAtTextOffset(el, offset);
}

export function measuredTextOffsetDetailsFromPoint(el, x, y, limit = CARET_POINT_MEASURE_LIMIT, caretSession = null) {
  return normalizeCaretSession(caretSession).measuredTextOffsetDetailsFromPoint(el, x, y, limit);
}

export function measuredTextOffsetFromPoint(el, x, y, limit = CARET_POINT_MEASURE_LIMIT, caretSession = null) {
  return normalizeCaretSession(caretSession).measuredTextOffsetFromPoint(el, x, y, limit);
}

export function textareaTextOffsetDetailsFromPoint(area, x, y, limit = CARET_POINT_MEASURE_LIMIT, caretSession = null) {
  return normalizeCaretSession(caretSession).textareaTextOffsetDetailsFromPoint(area, x, y, limit);
}

export function textareaTextOffsetFromPoint(area, x, y, limit = CARET_POINT_MEASURE_LIMIT, caretSession = null) {
  return normalizeCaretSession(caretSession).textareaTextOffsetFromPoint(area, x, y, limit);
}

export function caretRectForEditable(el, caretSession = null) {
  return normalizeCaretSession(caretSession).rectForEditable(el);
}

export function editableVisualLineRects(el, caretSession = null) {
  return normalizeCaretSession(caretSession).visualLineRects(el);
}

export function isEditableCaretOnEdgeLine(el, direction, caretSession = null) {
  return normalizeCaretSession(caretSession).isEditableOnEdgeLine(el, direction);
}

export function placeCaretAtVisualLine(el, x, edge, fallbackOffset = 0, caretSession = null) {
  normalizeCaretSession(caretSession).placeAtVisualLine(el, x, edge, fallbackOffset);
}

export function normalizeCodeEditablePlainText(value) {
  return String(value == null ? '' : value)
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

export function codeEditableText(el) {
  if (!el) return '';
  return normalizeCodeEditablePlainText(el.innerText || el.textContent || '').replace(/\n$/, '');
}

export function isEditableBackspaceAtEmptyStart(editable, selectionSession = null) {
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

export function codeEditableSelectionOffsets(el, selectionSession = null) {
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

export function insertCodeEditableTextAtSelection(el, value, selectionSession = null) {
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

export function selectionEditableInRoot(root, selectionSession = null) {
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

export function inlineMarksFromDomNode(node, editable) {
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

export function inlineMarksFromPointerEvent(event, editable, selectionSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  const node = selectionTools.nodeFromPoint(event, editable, event && event.target, { containsNode: nodeContains });
  return inlineMarksFromDomNode(node, editable);
}

export function textRangeForDomNode(editable, node, inlineDomSession = null) {
  return normalizeInlineDomSession(inlineDomSession).textRangeForDomNode(editable, node);
}

export function linkForTextRange(editable, start, end, inlineDomSession = null) {
  return normalizeInlineDomSession(inlineDomSession).linkForTextRange(editable, start, end);
}

export function inlineMarkedDomRangeFromNode(editable, node, mark, inlineDomSession = null) {
  return normalizeInlineDomSession(inlineDomSession).markedRangeForNode(editable, node, mark);
}

export function inlineMarkedDomRangeFromSelection(editable, mark, selectionSession = null, inlineDomSession = null) {
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

export function inlineMarkedDomRangeFromPointerEvent(event, editable, mark, selectionSession = null, inlineDomSession = null) {
  const selectionTools = normalizeSelectionSession(selectionSession);
  const node = selectionTools.nodeFromPoint(event, editable, event && event.target, { containsNode: nodeContains });
  return inlineMarkedDomRangeFromNode(editable, node, mark, inlineDomSession);
}

export function selectionLinkInEditable(editable, selectionSession = null) {
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

export function selectionMathInEditable(editable, selectionSession = null) {
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

export function editableTextOffsetForDomPosition(root, container, offset, caretSession = null) {
  return normalizeCaretSession(caretSession).textOffsetForDomPosition(root, container, offset);
}

export function getEditableSelectionOffsets(el, caretSession = null) {
  return normalizeCaretSession(caretSession).selectionOffsets(el);
}
