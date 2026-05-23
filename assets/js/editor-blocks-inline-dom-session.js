function fallbackNodeContains(root, node) {
  try { return !!(root && node && (root === node || root.contains(node))); }
  catch (_) { return false; }
}

function fallbackMergeInlineRuns(runs) {
  return Array.isArray(runs) ? runs : [];
}

function ownerDocumentFor(node, fallbackDocument) {
  return (node && node.ownerDocument) || fallbackDocument || null;
}

function closestElement(node, selector) {
  let current = node && node.nodeType === 1 ? node : node && node.parentElement;
  while (current) {
    if (current.matches && current.matches(selector)) return current;
    current = current.parentElement;
  }
  return null;
}

export function createEditorBlocksInlineDomSession({
  documentRef = typeof document !== 'undefined' ? document : null,
  selectionSession = null,
  mergeInlineRuns = fallbackMergeInlineRuns,
  sanitizeLinkHref = (value) => String(value == null ? '' : value),
  linkTitleForRun = (run) => String(run && run.linkTitle != null ? run.linkTitle : ''),
  renderMath = null,
  nodeContains = fallbackNodeContains
} = {}) {
  function createElement(root, tagName) {
    const doc = ownerDocumentFor(root, documentRef);
    try { return doc && typeof doc.createElement === 'function' ? doc.createElement(tagName) : null; }
    catch (_) { return null; }
  }

  function createTextNode(root, value) {
    if (selectionSession && typeof selectionSession.createTextNode === 'function') {
      return selectionSession.createTextNode(root, value);
    }
    const doc = ownerDocumentFor(root, documentRef);
    try { return doc && typeof doc.createTextNode === 'function' ? doc.createTextNode(String(value == null ? '' : value)) : null; }
    catch (_) { return null; }
  }

  function createRange(root) {
    if (selectionSession && typeof selectionSession.createRange === 'function') {
      return selectionSession.createRange(root);
    }
    const doc = ownerDocumentFor(root, documentRef);
    try { return doc && typeof doc.createRange === 'function' ? doc.createRange() : null; }
    catch (_) { return null; }
  }

  function appendInlineNode(parent, run) {
    if (!parent) return;
    if (run && run.math) {
      const span = createElement(parent, 'span');
      if (!span) return;
      span.className = 'press-math press-math-inline blocks-inline-math';
      span.contentEditable = 'false';
      span.dataset.tex = String(run.text || '');
      span.setAttribute('data-tex', String(run.text || ''));
      span.setAttribute('role', 'button');
      span.setAttribute('tabindex', '-1');
      span.textContent = String(run.text || '');
      parent.appendChild(span);
      return;
    }
    const textNode = createTextNode(parent, String(run && run.text != null ? run.text : ''));
    if (!textNode) return;
    let node = textNode;
    const wrap = (tagName, attrs = {}) => {
      const el = createElement(parent, tagName);
      if (!el) return;
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
      el.appendChild(node);
      node = el;
    };
    if (run && run.code) {
      wrap('code');
    } else {
      if (run && run.italic) wrap('em');
      if (run && run.bold) wrap('strong');
      if (run && run.strike) wrap('s');
      if (run && run.link) wrap('a', { href: sanitizeLinkHref(run.link), title: linkTitleForRun(run) });
    }
    parent.appendChild(node);
  }

  function renderInlineRunsInto(root, runs) {
    if (!root) return;
    root.innerHTML = '';
    mergeInlineRuns(runs).forEach(run => {
      const lines = String(run.text || '').split('\n');
      lines.forEach((line, index) => {
        if (index > 0) {
          const br = createElement(root, 'br');
          if (br) root.appendChild(br);
        }
        if (line) appendInlineNode(root, { ...run, text: line });
      });
    });
    try {
      if (typeof renderMath === 'function') renderMath(root);
    } catch (_) {}
  }

  function textRangeForDomNode(editable, node) {
    try {
      if (!editable || !node || !nodeContains(editable, node)) return null;
      if (node.nodeType === 1 && node.matches && node.matches('.press-math[data-tex]')) {
        let start = 0;
        let found = false;
        const count = (current) => {
          if (!current || found) return;
          if (current === node) {
            found = true;
            return;
          }
          if (current.nodeType === 3) {
            start += String(current.nodeValue || '').length;
            return;
          }
          if (current.nodeType !== 1) return;
          const tag = String(current.tagName || '').toLowerCase();
          if (tag === 'br') {
            start += 1;
            return;
          }
          if (current.matches && current.matches('.press-math[data-tex]')) {
            start += String(current.getAttribute('data-tex') || current.dataset.tex || '').length;
            return;
          }
          Array.from(current.childNodes || []).forEach(count);
          if (tag === 'div') start += 1;
        };
        Array.from(editable.childNodes || []).forEach(count);
        if (found) {
          const length = String(node.getAttribute('data-tex') || node.dataset.tex || '').length;
          return length > 0 ? { start, end: start + length } : null;
        }
      }
      const beforeRange = createRange(editable);
      const nodeRange = createRange(editable);
      if (!beforeRange || !nodeRange) return null;
      beforeRange.selectNodeContents(editable);
      beforeRange.setEndBefore(node);
      nodeRange.selectNodeContents(node);
      const start = String(beforeRange.toString() || '').length;
      const length = String(nodeRange.toString() || '').length;
      if (length <= 0) return null;
      return { start, end: start + length };
    } catch (_) {
      return null;
    }
  }

  function linkForTextRange(editable, start, end) {
    try {
      const safeStart = Math.max(0, Number(start) || 0);
      const safeEnd = Math.max(safeStart, Number(end) || 0);
      return Array.from(editable ? editable.querySelectorAll('a') : []).find(link => {
        const range = textRangeForDomNode(editable, link);
        return range && range.start === safeStart && range.end === safeEnd;
      }) || null;
    } catch (_) {
      return null;
    }
  }

  function markedRangeForNode(editable, node, mark) {
    const command = mark === 'strikeThrough' ? 'strike' : mark;
    if (command === 'code') {
      const code = closestElement(node, 'code');
      return code && nodeContains(editable, code) ? textRangeForDomNode(editable, code) : null;
    }
    if (command === 'math') {
      const math = closestElement(node, '.press-math[data-tex]');
      return math && nodeContains(editable, math) ? textRangeForDomNode(editable, math) : null;
    }
    return null;
  }

  return {
    renderInlineRunsInto,
    textRangeForDomNode,
    linkForTextRange,
    markedRangeForNode
  };
}
