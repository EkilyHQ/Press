import { renderPressMath } from './math-render.js?v=press-system-v3.4.50';
import { createEditorBlocksRuntime } from './editor-blocks-runtime.js?v=press-system-v3.4.50';
import { createEditorBlocksSessionRegistry } from './editor-blocks-session-registry.js?v=press-system-v3.4.50';
import { createEditorBlocksLayoutSession } from './editor-blocks-layout-session.js?v=press-system-v3.4.50';
import { createEditorBlocksBodySession } from './editor-blocks-body-session.js?v=press-system-v3.4.50';
import { createEditorBlocksStateController } from './editor-blocks-state.js?v=press-system-v3.4.50';
import { createEditorBlocksMenuSession } from './editor-blocks-menu-session.js?v=press-system-v3.4.50';
import { createEditorBlocksHeadSession } from './editor-blocks-head-session.js?v=press-system-v3.4.50';
import { createEditorBlocksCommandSession } from './editor-blocks-command-session.js?v=press-system-v3.4.50';
import { createEditorBlocksRichTextSession } from './editor-blocks-rich-text-session.js?v=press-system-v3.4.50';
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
import { createEditorBlocksImageSession } from './editor-blocks-image-session.js?v=press-system-v3.4.50';
import { createEditorBlocksCodeSession } from './editor-blocks-code-session.js?v=press-system-v3.4.50';
import { createEditorBlocksSourceSession } from './editor-blocks-source-session.js?v=press-system-v3.4.50';
import { createEditorBlocksListSession } from './editor-blocks-list-session.js?v=press-system-v3.4.50';
import {
  applyInlineLinkToRuns,
  applyInlineMathToRuns,
  appendInlineRun,
  autofixMarkdownSourceBlock,
  convertListTailItemAfterEmptyToParagraph,
  defaultListItems,
  editableListItems,
  editableTableData,
  effectiveListItemType,
  inlineMarksAtOffset,
  inlineRangeAnyMarked,
  inlineRangeFullyMarked,
  inlineRangeText,
  inlineRun,
  insertInlineRunsAtRange,
  isBlockEmptyForBackspace,
  isMergeableListBlock,
  itemIndentLevel,
  linkTitleForRun,
  listBlockItems,
  listVisualMarkerLabels,
  makeBlankBlock,
  makeBlock,
  mergeFirstListItemIntoPreviousBlock,
  mergeInlineRuns,
  mergeListItemIntoPreviousItem,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
  normalizeEditableMarkdownText,
  normalizeTableAlignment,
  normalizeTableCellValue,
  normalizeListItemType,
  normalizeSplitListStartItems,
  outdentEmptyListItemForEnter,
  parseInlineRuns,
  parseMarkdownBlocks,
  patchListItem,
  patchListItemType,
  rangeHasInlineText,
  removeInlineMarkAroundOffset,
  removeInlineMarkInRange,
  sanitizeEditorLinkHref,
  sanitizeEditorLinkTitle,
  serializeInlineRuns,
  serializeMarkdownBlocks,
  splitBlankLineUnits,
  splitListItemsAtEmptyItem,
  splitTextBlockIntoParagraph,
  summarizeListType,
  tableColumnCount,
  toggleInlineMarkOnRuns
} from './editor-blocks-model.js?v=press-system-v3.4.50';

export {
  applyInlineLinkToRuns,
  applyInlineMathToRuns,
  autofixMarkdownSourceBlock,
  convertListTailItemAfterEmptyToParagraph,
  inlineRenderedTextLength,
  insertInlineRunsAtRange,
  isBlockEmptyForBackspace,
  joinMergedEditableText,
  listVisualMarkerLabels,
  mergeFirstListItemIntoPreviousBlock,
  mergeListItemIntoPreviousItem,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
  normalizeSplitListStartItems,
  outdentEmptyListItemForEnter,
  parseInlineRuns,
  parseMarkdownBlocks,
  patchListItem,
  patchListItemType,
  removeInlineMarkAroundOffset,
  serializeInlineRuns,
  serializeMarkdownBlocks,
  splitListItemsAtEmptyItem,
  splitTextBlockIntoParagraph,
  toggleInlineMarkOnRuns
} from './editor-blocks-model.js?v=press-system-v3.4.50';
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
    documentRef: runtime.documentRef || root.ownerDocument,
    text,
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
  const blockSessions = createEditorBlocksSessionRegistry();

  const insertBlankBlock = (index = state.blocks.length, options = {}) => {
    const { block, index: safeIndex } = blocksState.insertBlankBlock(index, options);
    render();
    if (options.command) {
      queueMicrotask(() => {
        blockSessions.focusFirstCommandItem(block.id);
      });
    } else if (options.focus !== false) {
      focusBlockPrimaryEditable(block, 0);
    }
    emit();
    return block;
  };

  const focusBlockPrimaryEditable = (block, caretOffset = null) => {
    blockSessions.focusBlockPrimaryEditable(block, caretOffset);
  };

  const focusListItemEditable = (block, itemIndex, options = {}) => {
    blockSessions.focusListItemEditable(block, itemIndex, options);
  };

  const focusPreviousBlockEnd = (index) => {
    blockSessions.focusPreviousBlockEnd(index);
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

  const requestStickyBlockHeadUpdate = () => {
    blockSessions.requestStickyBlockHeadUpdate();
  };
  const forwardBlockHeadWheel = (event) => {
    blockSessions.forwardBlockHeadWheel(event);
  };
  const moveBlock = (index, direction) => {
    blockSessions.moveBlock(index, direction);
  };

  const replaceAdjacentBlockElements = (index, targetIndex) => {
    return blockSessions.replaceAdjacentBlockElements(index, targetIndex);
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

  const applySourceAutofix = (index) => {
    const block = state.blocks[index];
    const nextBlocks = autofixMarkdownSourceBlock(block);
    if (!nextBlocks.length) return;
    blocksState.replaceBlocks(index, 1, nextBlocks, { activeIndex: index });
    render();
    setActive(index);
    emit();
  };

  const syncActiveEditable = () => {
    try {
      blocksState.invokeActiveSync();
    } catch (_) {}
  };

  const syncActiveListTypeSelect = (blockNodes = null) => {
    blockSessions.syncActiveTypeSelect(blockNodes);
  };

  const refreshLinkEditor = (explicitLink = null) => {
    blockSessions.refreshLinkEditor(explicitLink);
  };

  const openMathEditorForSelection = () => {
    blockSessions.openMathEditorForSelection();
  };

  const openMathEditorForNode = (mathNode) => {
    blockSessions.openMathEditorForNode(mathNode);
  };

  const openMathEditorForBlock = (block, blockEl = null) => {
    blockSessions.openMathEditorForBlock(block, blockEl);
  };

  const setActive = (index, editable = null, sync = null) => {
    blockSessions.setActive(index, editable, sync);
  };

  const activateEditableFromPointer = (index, editable, sync) => {
    blockSessions.activateEditableFromPointer(index, editable, sync);
  };

  const activateNonTextBlockFromPointer = (index, blockEl = null) => {
    blockSessions.activateNonTextBlockFromPointer(index, blockEl);
  };

  const focusSession = blockSessions.setFocusSession(createEditorBlocksFocusSession({
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
  }));

  const pointerSession = blockSessions.setPointerSession(createEditorBlocksPointerSession({
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
  }));

  const shouldSuppressRoutedBlockContainerClick = () => {
    return blocksState.consumeRoutedBlockContainerClickSuppression(Date.now());
  };

  const isBlocksCaretInteractiveTarget = (target) => {
    return blockSessions.isBlocksCaretInteractiveTarget(target);
  };

  const blockNavigationTarget = (index, edge = 'first') => {
    return blockSessions.blockNavigationTarget(index, edge);
  };

  const focusBlockNavigationTarget = (target, direction, x, fallbackOffset = 0) => {
    return blockSessions.focusBlockNavigationTarget(target, direction, x, fallbackOffset);
  };

  const handleCrossBlockArrowNavigation = (event, index, editable = null) => {
    return blockSessions.handleCrossBlockArrowNavigation(event, index, editable);
  };

  const setContentEditableCaretFromPoint = (editable, x, y, hitTarget = editable) => {
    blockSessions.setContentEditableCaretFromPoint(editable, x, y, hitTarget);
  };

  const setTextareaCaretFromPoint = (area, x, y) => {
    blockSessions.setTextareaCaretFromPoint(area, x, y);
  };

  const routeDirectQuoteCaretFromPointer = (editable, index, sync, event) => {
    return blockSessions.routeDirectQuoteCaretFromPointer(editable, index, sync, event);
  };

  const routeBlocksCaretFromPointer = (event) => {
    blockSessions.routeBlocksCaretFromPointer(event);
  };

  list.addEventListener('pointerdown', routeBlocksCaretFromPointer);
  const layoutSession = blockSessions.setLayoutSession(createEditorBlocksLayoutSession({
    runtime,
    state,
    root,
    list,
    blockElements,
    containsNode: nodeContains,
    moveBlockInState: (index, direction) => blocksState.moveBlock(index, direction),
    replaceAdjacentBlockElements: (index, targetIndex) => replaceAdjacentBlockElements(index, targetIndex),
    render: () => render(),
    emit,
    onWindow
  }));
  layoutSession.bind();

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

  const updateInlineToolbarState = () => {
    blockSessions.updateInlineToolbarState();
  };

  const openLinkEditorForSelection = () => {
    blockSessions.openLinkEditorForSelection();
  };

  const commandSession = blockSessions.setCommandSession(createEditorBlocksCommandSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    state,
    blocksState,
    list,
    editableSession,
    text,
    createBlockTypeIcon,
    defaultListItems,
    normalizeEditableMarkdownText,
    editableText,
    closeBlockActionMenu,
    closeInlineMoreMenu,
    placeCommandBlock,
    render,
    emit,
    focusBlockPrimaryEditable,
    insertBlankBlock,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    setActive,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    getCardPickerSession: () => blockSessions.getCardPickerSession(),
    queueTask: task => queueMicrotask(task)
  }));

  const cardPickerSession = blockSessions.setCardPickerSession(createEditorBlocksCardPickerSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    runtime,
    blocksState,
    text,
    insertCardBlock: (data, index) => blockSessions.insertCommandBlock('card', data, { index }),
    requestRender: () => render()
  }));
  if (cardPickerSession) root.appendChild(cardPickerSession.element);

  const inlineCommandMark = (kind) => (kind === 'strikeThrough' ? 'strike' : kind);
  const hasPendingInlineMarks = () => blocksState.hasPendingInlineMarks();

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

  const linkSession = blockSessions.setLinkSession(createEditorBlocksLinkSession({
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
  }));

  const mathSession = blockSessions.setMathSession(createEditorBlocksMathSession({
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
  }));

  const inlineToolbarSession = blockSessions.setInlineToolbarSession(createEditorBlocksInlineToolbarSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    state,
    blocksState,
    editableSession,
    root,
    list,
    menuSession,
    selectionSession,
    caretSession,
    text,
    setActive,
    applyInlineCommand,
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
  }));
  if (linkSession) {
    root.appendChild(linkSession.element);
    linkSession.bind();
  }
  if (mathSession) {
    root.appendChild(mathSession.element);
    mathSession.bind();
  }

  const richTextSession = createEditorBlocksRichTextSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    blocksState,
    editableSession,
    selectionSession,
    inlineDomSession,
    caretSession,
    setPlainContentEditableValue,
    editableText,
    inlineRunsFromDom,
    inlineRun,
    insertInlineRunsAtRange,
    getEditableSelectionOffsets,
    applyRunsToEditable,
    updateFromControl,
    removeEmptyBlockWithBackspace,
    mergeTextBlockWithPreviousOnBackspace,
    handleCrossBlockArrowNavigation,
    splitTextBlockAfterCaret,
    shouldInsertBlankBlockOnEnter,
    insertBlankBlockAfter,
    setActive,
    activateEditableFromPointer,
    routeDirectQuoteCaretFromPointer,
    inlineMarksFromPointerEvent,
    inlineMarkedDomRangeFromPointerEvent,
    updateInlineToolbarState: () => updateInlineToolbarState(),
    refreshLinkEditor: link => refreshLinkEditor(link),
    openMathEditorForNode: node => openMathEditorForNode(node)
  });

  const createRichEditable = (...args) => richTextSession?.createRichEditable(...args);
  const wireInlineEditable = (...args) => richTextSession?.wireInlineEditable(...args);

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

  const imageSession = createEditorBlocksImageSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    blocksState,
    editableSession,
    blockElements,
    text,
    selectionSession,
    insertPlainTextIntoEditable,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    updateInlineToolbarState,
    updateFromControl,
    insertBlock,
    deleteBlockAt,
    setActive,
    resolveAssetSrc,
    hydrateImages,
    requestImageUpload: options.requestImageUpload,
    canDeleteImageResource: options.canDeleteImageResource,
    requestImageDelete: options.requestImageDelete
  });

  const codeSession = createEditorBlocksCodeSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    runtime,
    editableSession,
    text,
    selectionSession,
    codeEditableText,
    insertCodeEditableTextAtSelection,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    updateFromControl,
    setActive,
    activateEditableFromPointer
  });

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

  const activeSession = blockSessions.setActiveSession(createEditorBlocksActiveSession({
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
  }));

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

  const sourceSession = createEditorBlocksSourceSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    editableSession,
    text,
    caretSession,
    measureLimit: CARET_POINT_MEASURE_LIMIT,
    textareaTextOffsetDetailsFromPoint,
    autoSizeTextarea,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    updateFromControl,
    setActive,
    activateEditableFromPointer,
    applyAutofix: index => applySourceAutofix(index),
    queueTask: task => queueMicrotask(task)
  });

  const listSession = blockSessions.setListSession(createEditorBlocksListSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    root,
    list,
    state,
    blocksState,
    editableSession,
    selectionSession,
    caretSession,
    inlineDomSession,
    containsNode: nodeContains,
    closestElement,
    text,
    editableListItems,
    defaultListItems,
    summarizeListType,
    listVisualMarkerLabels,
    effectiveListItemType,
    itemIndentLevel,
    normalizeListItemType,
    patchListItemType,
    patchListItem,
    setPlainContentEditableValue,
    editableText,
    splitEditableTextAtSelection,
    outdentEmptyListItemForEnter,
    convertListTailItemAfterEmptyToParagraph,
    splitListItemsAtEmptyItem,
    normalizeSplitListStartItems,
    mergeListItemIntoPreviousItem,
    mergeFirstListItemIntoPreviousBlock,
    makeBlock,
    makeSplitListBlock,
    makeBlankBlock,
    markDirty,
    render,
    emit,
    updateFromControl,
    insertBlankBlock,
    focusBlockPrimaryEditable,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    isEditableSelectionAtStart,
    isEditableCaretOnEdgeLine,
    getEditableCaretTextOffset,
    caretRectForEditable,
    placeCaretAtVisualLine,
    placeCaretAtTextOffset,
    placeCaretAtStart,
    placeCaretAtEnd,
    setActive,
    activateEditableFromPointer,
    inlineMarksFromPointerEvent,
    inlineMarkedDomRangeFromPointerEvent,
    updateInlineToolbarState,
    refreshLinkEditor,
    openMathEditorForNode,
    wireInlineEditable,
    queueTask: task => queueMicrotask(task)
  }));

  const headSession = createEditorBlocksHeadSession({
    documentRef: runtime.documentRef || root.ownerDocument,
    text,
    createBlockTypeIcon,
    menuSession,
    sourceSession,
    listSession,
    codeSession,
    imageSession,
    tableSession,
    inlineToolbarSession,
    createHeadingLevelSelect,
    createMathEditButton,
    forwardBlockHeadWheel,
    alignBlockActionMenu,
    setActive,
    moveBlock,
    insertBlankBlock,
    deleteBlockAt
  });

  const bodySession = blockSessions.setBodySession(createEditorBlocksBodySession({
    documentRef: runtime.documentRef || root.ownerDocument,
    state,
    list,
    text,
    headSession,
    blockElements,
    closestElement,
    createRichEditable,
    renderMath: renderPressMath,
    hydrateCard,
    setActive,
    activateNonTextBlockFromPointer,
    openMathEditorForBlock,
    shouldSuppressRoutedBlockContainerClick,
    removeEmptyBlockWithBackspace,
    handleCrossBlockArrowNavigation,
    renderers: {
      blank: (body, block, index) => blockSessions.renderBlankBlock(body, block, index),
      image: (body, block, index) => imageSession?.renderBlock(body, block, index),
      table: (body, block, index) => tableSession?.renderBlock(body, block, index),
      list: (body, block, index) => listSession?.renderBlock(body, block, index),
      code: (body, block, index) => codeSession?.renderBlock(body, block, index),
      source: (body, block, index) => sourceSession?.renderBlock(body, block, index)
    }
  }));

  const renderBlockElement = (block, index) => bodySession.renderBlockElement(block, index);

  function render() {
    closeBlockActionMenu(false);
    closeInlineMoreMenu(false);
    list.innerHTML = '';
    state.blocks.forEach((block, index) => {
      list.appendChild(renderBlockElement(block, index));
    });
    blockSessions.renderCardPicker();
    setActive(state.activeIndex);
    requestStickyBlockHeadUpdate();
  }

  const api = {
    setMarkdown(markdown) {
      blocksState.setMarkdown(markdown);
      render();
    },
    getMarkdown() {
      return blocksState.serialize();
    },
    insertImageBlock(src, alt, index = state.activeIndex + 1) {
      return imageSession ? imageSession.insertImageBlock(src, alt, index) : null;
    },
    replaceImageBlock(src, target = state.activeIndex) {
      return imageSession ? imageSession.replaceImageBlock(src, target) : null;
    },
    getImageBlockSource(target = state.activeIndex) {
      return imageSession ? imageSession.getImageBlockSource(target) : '';
    },
    deleteImageBlock(target = state.activeIndex) {
      return imageSession ? imageSession.deleteImageBlock(target) : null;
    },
    setCardEntries(entries) {
      if (!blockSessions.setCardEntries(entries)) blocksState.setCardEntries(entries);
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
