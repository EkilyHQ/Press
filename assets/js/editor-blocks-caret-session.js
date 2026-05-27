import { createEditorBlocksSelectionSession } from './editor-blocks-selection-session.js';
import {
  CARET_POINT_MEASURE_LIMIT,
  CARET_TEXT_NODE_FILTER,
  measuredTextOffsetDetailsFromPoint as measureTextOffsetDetailsFromPoint,
  measuredTextOffsetFromPoint as measureTextOffsetFromPoint,
  textareaTextOffsetDetailsFromPoint as measureTextareaTextOffsetDetailsFromPoint,
  textareaTextOffsetFromPoint as measureTextareaTextOffsetFromPoint,
  visualLineRects as measureVisualLineRects
} from './editor-blocks-caret-measurement.js';

export { CARET_POINT_MEASURE_LIMIT } from './editor-blocks-caret-measurement.js';

function createFallbackSelectionSession() {
  return createEditorBlocksSelectionSession();
}

function normalizeSelectionSession(selectionSession) {
  return selectionSession && typeof selectionSession.getSelectionRange === 'function'
    ? selectionSession
    : createFallbackSelectionSession();
}

function defaultContains(root, node) {
  try { return !!(root && node && (root === node || root.contains(node))); }
  catch (_) { return false; }
}

function defaultSerializeInlineDom(root) {
  return String(root && root.textContent != null ? root.textContent : '');
}

function defaultEditableVisibleText(el) {
  return String(el && el.textContent != null ? el.textContent : '').replace(/\u00a0/g, ' ');
}

export function createEditorBlocksCaretSession({
  documentRef = null,
  selectionSession = null,
  nodeContains = defaultContains,
  serializeInlineDom = defaultSerializeInlineDom,
  editableVisibleText = defaultEditableVisibleText
} = {}) {
  const selectionTools = normalizeSelectionSession(selectionSession);

  const createSessionElement = (tagName) => {
    try {
      return documentRef && typeof documentRef.createElement === 'function'
        ? documentRef.createElement(tagName)
        : null;
    } catch (_) {
      return null;
    }
  };

  const getSessionBody = () => {
    try {
      return documentRef && documentRef.body ? documentRef.body : null;
    } catch (_) {
      return null;
    }
  };

  function textOffsetForDomPosition(root, container, offset) {
    let total = 0;
    let found = false;
    const countNode = (node) => {
      if (!node || found) return;
      if (node === container) {
        if (node.nodeType === 3) {
          total += Math.max(0, Math.min(String(node.nodeValue || '').length, Number(offset) || 0));
        } else if (node.nodeType === 1) {
          const children = Array.from(node.childNodes || []);
          children.slice(0, Math.max(0, Math.min(children.length, Number(offset) || 0))).forEach(countWholeNode);
        }
        found = true;
        return;
      }
      countWholeNode(node);
    };
    const countWholeNode = (node) => {
      if (!node || found) return;
      if (node === container) {
        countNode(node);
        return;
      }
      if (node.nodeType === 3) {
        total += String(node.nodeValue || '').length;
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = String(node.tagName || '').toLowerCase();
      if (tag === 'br') {
        total += 1;
        return;
      }
      if (node.matches && node.matches('.press-math[data-tex]')) {
        total += String(node.getAttribute('data-tex') || node.dataset.tex || '').length;
        return;
      }
      Array.from(node.childNodes || []).forEach(countNode);
      if (!found && tag === 'div') total += 1;
    };
    Array.from(root && root.childNodes ? root.childNodes : []).forEach(countNode);
    return found ? total : null;
  }

  function selectionOffsets(el) {
    try {
      const range = selectionTools.getSelectionRange(el);
      if (!el || !range) return null;
      if (!nodeContains(el, range.startContainer) || !nodeContains(el, range.endContainer)) return null;
      const customStart = textOffsetForDomPosition(el, range.startContainer, range.startOffset);
      const customEnd = textOffsetForDomPosition(el, range.endContainer, range.endOffset);
      let start = customStart;
      let end = customEnd;
      if (start == null || end == null) {
        const startRange = selectionTools.createRange(el);
        const endRange = selectionTools.createRange(el);
        if (!startRange || !endRange) return null;
        startRange.selectNodeContents(el);
        startRange.setEnd(range.startContainer, range.startOffset);
        endRange.selectNodeContents(el);
        endRange.setEnd(range.endContainer, range.endOffset);
        start = String(startRange.toString() || '').length;
        end = String(endRange.toString() || '').length;
      }
      return { start, end, collapsed: start === end, text: String(range.toString() || ''), range };
    } catch (_) {
      return null;
    }
  }

  function isSelectionAtStart(el) {
    try {
      const range = selectionTools.getSelectionRange(el);
      if (!el || !range) return false;
      if (!range.collapsed || !nodeContains(el, range.startContainer)) return false;
      const beforeRange = selectionTools.createRange(el);
      if (!beforeRange) return false;
      beforeRange.selectNodeContents(el);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      return serializeInlineDom(beforeRange.cloneContents()).trim() === '';
    } catch (_) {
      return false;
    }
  }

  function rectForEditable(el) {
    try {
      const range = selectionTools.getSelectionRange(el);
      if (!el || !range) return null;
      if (!range.collapsed || !nodeContains(el, range.startContainer)) return null;
      const rect = range.getBoundingClientRect && range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) return rect;
      const restoreRange = range.cloneRange();
      const markerRange = range.cloneRange();
      const marker = createSessionElement('span');
      if (!marker) return null;
      marker.textContent = '\u200b';
      markerRange.insertNode(marker);
      const markerRect = marker.getBoundingClientRect();
      marker.remove();
      selectionTools.selectRange(restoreRange, el);
      return markerRect;
    } catch (_) {
      return null;
    }
  }

  function isSelectionOnBlankLine(el) {
    try {
      const offsets = selectionOffsets(el);
      if (!offsets || !offsets.collapsed) return false;
      const text = editableVisibleText(el);
      const lineStart = text.lastIndexOf('\n', Math.max(0, offsets.start - 1)) + 1;
      const nextBreak = text.indexOf('\n', offsets.start);
      const lineEnd = nextBreak >= 0 ? nextBreak : text.length;
      if (text.slice(lineStart, lineEnd).trim() === '') return true;

      const caretRect = rectForEditable(el);
      if (!caretRect) return false;
      const tolerance = Math.max(2, caretRect.height * 0.35);
      const caretMid = caretRect.top + (caretRect.height / 2);
      const walker = selectionTools.createTreeWalker(el, CARET_TEXT_NODE_FILTER);
      const range = selectionTools.createRange(el);
      if (!walker || !range) return false;
      let node = walker.nextNode();
      while (node) {
        if (/\S/.test(String(node.nodeValue || ''))) {
          range.selectNodeContents(node);
          const rects = Array.from(range.getClientRects ? range.getClientRects() : []);
          const hasTextOnCaretLine = rects.some(rect => rect
            && rect.height > 0
            && caretMid >= rect.top - tolerance
            && caretMid <= rect.bottom + tolerance);
          if (hasTextOnCaretLine) {
            range.detach && range.detach();
            return false;
          }
        }
        node = walker.nextNode();
      }
      range.detach && range.detach();
      return true;
    } catch (_) {
      return false;
    }
  }

  function shouldInsertBlankBlockOnEnter(el) {
    try {
      const offsets = selectionOffsets(el);
      if (!offsets || !offsets.collapsed) return false;
      const text = editableVisibleText(el);
      if (offsets.start >= text.length) return true;
      return isSelectionOnBlankLine(el);
    } catch (_) {
      return false;
    }
  }

  function placeAtEnd(el) {
    try {
      if (!el) return;
      const range = selectionTools.createRange(el);
      if (!range) return;
      range.selectNodeContents(el);
      range.collapse(false);
      selectionTools.selectRange(range, el);
    } catch (_) {}
  }

  function placeAtStart(el) {
    try {
      if (!el) return;
      const range = selectionTools.createRange(el);
      if (!range) return;
      range.selectNodeContents(el);
      range.collapse(true);
      selectionTools.selectRange(range, el);
    } catch (_) {}
  }

  function getTextOffset(el) {
    try {
      const range = selectionTools.getSelectionRange(el);
      if (!el || !range) return 0;
      if (!range.collapsed || !nodeContains(el, range.startContainer)) return 0;
      const beforeRange = selectionTools.createRange(el);
      if (!beforeRange) return 0;
      beforeRange.selectNodeContents(el);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      return String(beforeRange.toString() || '').length;
    } catch (_) {
      return 0;
    }
  }

  function placeAtTextOffset(el, offset) {
    try {
      if (!el) return;
      const targetOffset = Math.max(0, Number(offset) || 0);
      const walker = selectionTools.createTreeWalker(el, CARET_TEXT_NODE_FILTER);
      if (!walker) return;
      let node = walker.nextNode();
      let remaining = targetOffset;
      while (node) {
        const length = String(node.nodeValue || '').length;
        if (remaining <= length) {
          const range = selectionTools.createRange(el);
          if (!range) return;
          range.setStart(node, remaining);
          range.collapse(true);
          selectionTools.selectRange(range, el);
          return;
        }
        remaining -= length;
        node = walker.nextNode();
      }
      placeAtEnd(el);
    } catch (_) {}
  }

  function measuredTextOffsetDetailsFromPoint(el, x, y, limit = CARET_POINT_MEASURE_LIMIT) {
    return measureTextOffsetDetailsFromPoint(el, x, y, { selectionTools, limit });
  }

  function measuredTextOffsetFromPoint(el, x, y, limit = CARET_POINT_MEASURE_LIMIT) {
    return measureTextOffsetFromPoint(el, x, y, { selectionTools, limit });
  }

  function textareaTextOffsetDetailsFromPoint(area, x, y, limit = CARET_POINT_MEASURE_LIMIT) {
    return measureTextareaTextOffsetDetailsFromPoint(area, x, y, {
      selectionTools,
      documentRef,
      createSessionElement,
      getSessionBody,
      limit
    });
  }

  function textareaTextOffsetFromPoint(area, x, y, limit = CARET_POINT_MEASURE_LIMIT) {
    return measureTextareaTextOffsetFromPoint(area, x, y, {
      selectionTools,
      documentRef,
      createSessionElement,
      getSessionBody,
      limit
    });
  }

  function visualLineRects(el) {
    return measureVisualLineRects(el, { selectionTools });
  }

  function isEditableOnEdgeLine(el, direction) {
    try {
      const caretRect = rectForEditable(el);
      if (!caretRect) return true;
      const lineRects = visualLineRects(el);
      if (lineRects.length <= 1) return true;
      const tolerance = Math.max(3, caretRect.height * 0.6);
      const caretTop = caretRect.top;
      if (direction === 'up') return Math.abs(caretTop - lineRects[0].top) <= tolerance;
      return Math.abs(caretTop - lineRects[lineRects.length - 1].top) <= tolerance;
    } catch (_) {
      return true;
    }
  }

  function isTextareaOnEdgeLine(area, direction) {
    try {
      if (!area) return false;
      const start = Number(area.selectionStart);
      const end = Number(area.selectionEnd);
      if (start !== end) return false;
      const text = String(area.value || '');
      const before = text.slice(0, Math.max(0, start));
      const lineIndex = before.split('\n').length - 1;
      const lineCount = text.split('\n').length;
      if (direction === 'up') return lineIndex <= 0;
      return lineIndex >= lineCount - 1;
    } catch (_) {
      return false;
    }
  }

  function placeAtVisualLine(el, x, edge, fallbackOffset = 0) {
    try {
      const lineRects = visualLineRects(el);
      if (!lineRects.length) {
        placeAtTextOffset(el, fallbackOffset);
        return;
      }
      const line = edge === 'last' ? lineRects[lineRects.length - 1] : lineRects[0];
      const targetX = Math.max(line.left + 1, Math.min(Number(x) || line.left, line.right - 1));
      const targetY = line.top + (line.height / 2);
      const range = selectionTools.rangeFromPoint(el, targetX, targetY, { containsNode: nodeContains });
      if (!range) {
        placeAtTextOffset(el, fallbackOffset);
        return;
      }
      range.collapse(true);
      selectionTools.selectRange(range, el);
    } catch (_) {
      placeAtTextOffset(el, fallbackOffset);
    }
  }

  function placeTextareaAtVisualLine(area, x, edge, fallbackOffset = 0) {
    try {
      if (!area) return;
      const rect = area.getBoundingClientRect ? area.getBoundingClientRect() : null;
      const computed = selectionTools.getComputedStyle(area);
      const lineHeight = computed ? parseFloat(computed.lineHeight) : 0;
      const usableLineHeight = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 18;
      const targetY = rect
        ? (edge === 'last' ? rect.bottom - (usableLineHeight / 2) : rect.top + (usableLineHeight / 2))
        : 0;
      const measured = rect ? textareaTextOffsetFromPoint(area, x, targetY, CARET_POINT_MEASURE_LIMIT) : null;
      const offset = measured == null ? Math.max(0, Number(fallbackOffset) || 0) : measured;
      try { area.setSelectionRange(offset, offset); } catch (_) {}
    } catch (_) {
      const offset = Math.max(0, Number(fallbackOffset) || 0);
      try { area.setSelectionRange(offset, offset); } catch (__) {}
    }
  }

  return {
    textOffsetForDomPosition,
    selectionOffsets,
    isSelectionAtStart,
    isSelectionOnBlankLine,
    shouldInsertBlankBlockOnEnter,
    placeAtEnd,
    placeAtStart,
    getTextOffset,
    placeAtTextOffset,
    measuredTextOffsetDetailsFromPoint,
    measuredTextOffsetFromPoint,
    textareaTextOffsetDetailsFromPoint,
    textareaTextOffsetFromPoint,
    rectForEditable,
    visualLineRects,
    isEditableOnEdgeLine,
    isTextareaOnEdgeLine,
    placeAtVisualLine,
    placeTextareaAtVisualLine
  };
}
