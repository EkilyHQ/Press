export const CARET_POINT_MEASURE_LIMIT = 12000;
export const CARET_TEXT_NODE_FILTER = 4;

const TEXTAREA_MIRROR_STYLE_PROPS = [
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'lineHeight',
  'letterSpacing',
  'tabSize',
  'textTransform',
  'textIndent',
  'textAlign',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth'
];

export function caretBoundaryDistance(rect, boundaryX, x, y) {
  if (!rect) return Number.POSITIVE_INFINITY;
  const dx = Number(x) - boundaryX;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return (dx * dx) + (dy * dy * 4);
}

export function measuredTextOffsetDetailsFromPoint(el, x, y, options = {}) {
  const {
    selectionTools = null,
    limit = CARET_POINT_MEASURE_LIMIT
  } = options;
  try {
    if (!el || !selectionTools) return null;
    const walker = selectionTools.createTreeWalker(el, CARET_TEXT_NODE_FILTER);
    const range = selectionTools.createRange(el);
    if (!walker || !range) return null;
    let node = walker.nextNode();
    let offset = 0;
    let bestOffset = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let insideTextRect = false;
    let textRectCount = 0;
    while (node) {
      const value = String(node.nodeValue || '');
      if (offset + value.length > limit) {
        range.detach && range.detach();
        return null;
      }
      for (let i = 0; i < value.length; i += 1) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rects = Array.from(range.getClientRects ? range.getClientRects() : [])
          .filter(rect => rect && rect.width >= 0 && rect.height > 0);
        rects.forEach(rect => {
          textRectCount += 1;
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) insideTextRect = true;
          const startDistance = caretBoundaryDistance(rect, rect.left, x, y);
          if (startDistance < bestDistance) {
            bestDistance = startDistance;
            bestOffset = offset + i;
          }
          const endDistance = caretBoundaryDistance(rect, rect.right, x, y);
          if (endDistance < bestDistance) {
            bestDistance = endDistance;
            bestOffset = offset + i + 1;
          }
        });
      }
      offset += value.length;
      node = walker.nextNode();
    }
    range.detach && range.detach();
    if (offset === 0) return { offset: 0, distance: 0, insideTextRect: false, textRectCount: 0 };
    if (bestOffset == null) return null;
    return { offset: bestOffset, distance: bestDistance, insideTextRect, textRectCount };
  } catch (_) {
    return null;
  }
}

export function measuredTextOffsetFromPoint(el, x, y, options = {}) {
  const details = measuredTextOffsetDetailsFromPoint(el, x, y, options);
  return details ? details.offset : null;
}

export function textareaTextOffsetDetailsFromPoint(area, x, y, options = {}) {
  const {
    selectionTools = null,
    documentRef = null,
    createSessionElement = null,
    getSessionBody = null,
    limit = CARET_POINT_MEASURE_LIMIT
  } = options;
  const value = String(area && area.value != null ? area.value : '');
  const body = typeof getSessionBody === 'function'
    ? getSessionBody()
    : documentRef && documentRef.body;
  if (!area || !body || !selectionTools) return null;
  if (!value) return { offset: 0, distance: 0, insideTextRect: false, textRectCount: 0 };
  if (value.length > limit) return null;
  const rect = area.getBoundingClientRect ? area.getBoundingClientRect() : null;
  if (!rect) return null;
  const computed = selectionTools.getComputedStyle(area);
  const mirror = typeof createSessionElement === 'function'
    ? createSessionElement('div')
    : documentRef && typeof documentRef.createElement === 'function'
      ? documentRef.createElement('div')
      : null;
  if (!mirror) return null;
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.position = 'fixed';
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  mirror.style.width = `${rect.width}px`;
  mirror.style.minHeight = `${rect.height}px`;
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.zIndex = '-1';
  mirror.style.overflow = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.wordBreak = computed ? computed.wordBreak : 'normal';
  mirror.style.boxSizing = computed ? computed.boxSizing : 'border-box';
  TEXTAREA_MIRROR_STYLE_PROPS.forEach(prop => {
    if (computed && computed[prop]) mirror.style[prop] = computed[prop];
  });
  mirror.textContent = value;
  body.appendChild(mirror);
  const details = measuredTextOffsetDetailsFromPoint(mirror, x, y, { selectionTools, limit });
  mirror.remove();
  if (!details) return null;
  return {
    ...details,
    offset: Math.max(0, Math.min(value.length, details.offset))
  };
}

export function textareaTextOffsetFromPoint(area, x, y, options = {}) {
  const details = textareaTextOffsetDetailsFromPoint(area, x, y, options);
  return details ? details.offset : null;
}

export function visualLineRects(el, options = {}) {
  const { selectionTools = null } = options;
  try {
    if (!el || !selectionTools) return [];
    const walker = selectionTools.createTreeWalker(el, CARET_TEXT_NODE_FILTER);
    const range = selectionTools.createRange(el);
    if (!walker || !range) return [];
    const lines = [];
    const lineTolerance = 2;
    let node = walker.nextNode();
    while (node) {
      const value = String(node.nodeValue || '');
      for (let i = 0; i < value.length; i += 1) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rects = Array.from(range.getClientRects ? range.getClientRects() : [])
          .filter(rect => rect && rect.height > 0 && rect.width >= 0);
        rects.forEach(rect => {
          const mid = rect.top + (rect.height / 2);
          let line = lines.find(item => Math.abs(item.mid - mid) <= Math.max(lineTolerance, rect.height * 0.35));
          if (!line) {
            line = {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
              height: rect.height,
              mid,
              count: 0
            };
            lines.push(line);
          } else {
            line.top = Math.min(line.top, rect.top);
            line.bottom = Math.max(line.bottom, rect.bottom);
            line.left = Math.min(line.left, rect.left);
            line.right = Math.max(line.right, rect.right);
            line.height = Math.max(line.height, rect.height);
            line.mid = line.top + ((line.bottom - line.top) / 2);
          }
          line.count += 1;
        });
      }
      node = walker.nextNode();
    }
    range.detach && range.detach();
    return lines
      .filter(line => line && line.count > 0)
      .sort((a, b) => a.top - b.top);
  } catch (_) {
    return [];
  }
}
