// Typography utilities
// - applyLangHints: add lang="en" to long Latin tokens inside CJK pages
//   to improve hyphenation without touching code blocks or links.

function getAmbientDocument() {
  try { return typeof document !== 'undefined' ? document : null; }
  catch (_) { return null; }
}

function getAmbientWindow() {
  try { return typeof window !== 'undefined' ? window : null; }
  catch (_) { return null; }
}

function getAmbientNodeFilter(windowRef) {
  try {
    if (windowRef && windowRef.NodeFilter) return windowRef.NodeFilter;
    return typeof NodeFilter !== 'undefined' ? NodeFilter : null;
  } catch (_) {
    return null;
  }
}

function createLangHintRuntime(options = {}) {
  const allowAmbient = options.allowAmbient !== false;
  const documentRef = options.documentRef || options.document || (allowAmbient ? getAmbientDocument() : null);
  const windowRef = options.windowRef || options.window || (allowAmbient ? getAmbientWindow() : null);
  const nodeFilterRef = options.nodeFilterRef || options.NodeFilter || (allowAmbient ? getAmbientNodeFilter(windowRef) : null);
  return {
    documentRef,
    windowRef,
    nodeFilterRef,
    querySelector(selector) {
      try {
        return documentRef && typeof documentRef.querySelector === 'function'
          ? documentRef.querySelector(selector)
          : null;
      } catch (_) {
        return null;
      }
    },
    createTreeWalker(root, whatToShow, filter) {
      try {
        return documentRef && typeof documentRef.createTreeWalker === 'function'
          ? documentRef.createTreeWalker(root, whatToShow, filter)
          : null;
      } catch (_) {
        return null;
      }
    },
    createDocumentFragment() {
      try {
        return documentRef && typeof documentRef.createDocumentFragment === 'function'
          ? documentRef.createDocumentFragment()
          : null;
      } catch (_) {
        return null;
      }
    },
    createElement(tagName) {
      try {
        return documentRef && typeof documentRef.createElement === 'function'
          ? documentRef.createElement(tagName)
          : null;
      } catch (_) {
        return null;
      }
    },
    createTextNode(text) {
      try {
        return documentRef && typeof documentRef.createTextNode === 'function'
          ? documentRef.createTextNode(text)
          : null;
      } catch (_) {
        return null;
      }
    },
    getDocumentLang() {
      try {
        const docEl = documentRef && documentRef.documentElement;
        return (docEl && (docEl.lang || (typeof docEl.getAttribute === 'function' ? docEl.getAttribute('lang') : ''))) || '';
      } catch (_) {
        return '';
      }
    }
  };
}

export function applyLangHints(container, options = {}) {
  try {
    const runtime = createLangHintRuntime(options);
    const { documentRef, nodeFilterRef } = runtime;
    if (!documentRef || !nodeFilterRef) return;
    const root = typeof container === 'string' ? runtime.querySelector(container) : (container || documentRef);
    if (!root) return;
    // Only apply when page lang is CJK or container/ancestors indicate CJK
    const docLang = runtime.getDocumentLang();
    const isCJK = /^(chs|cht|ja)/i.test(docLang);
    if (!isCJK) return;
    // Avoid repeated work
    if (root.__langHintsApplied) return; root.__langHintsApplied = true;
    const SKIP_TAGS = new Set(['CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'SCRIPT', 'STYLE']);
    const MAX_WRAPS = 200; // safety cap
    let wraps = 0;
    const walker = runtime.createTreeWalker(root, nodeFilterRef.SHOW_TEXT, {
      acceptNode(node) {
        try {
          if (!node || !node.nodeValue) return nodeFilterRef.FILTER_REJECT;
          const t = node.nodeValue;
          if (!/[A-Za-z]/.test(t)) return nodeFilterRef.FILTER_REJECT; // no Latin letters
          const p = node.parentElement;
          if (!p || SKIP_TAGS.has(p.tagName)) return nodeFilterRef.FILTER_REJECT;
          const closest = typeof p.closest === 'function' ? p.closest.bind(p) : () => null;
          if (closest('pre, code, kbd, samp, var, .code-scroll, .code-block')) return nodeFilterRef.FILTER_REJECT;
          if (closest('a')) return nodeFilterRef.FILTER_SKIP; // avoid altering links
          return nodeFilterRef.FILTER_ACCEPT;
        } catch { return nodeFilterRef.FILTER_REJECT; }
      }
    });
    if (!walker || typeof walker.nextNode !== 'function') return;
    const re = /([A-Za-z][A-Za-z\-]{4,})/g; // long-ish Latin tokens (>=5 chars incl. hyphen)
    const isLongLatinToken = value => /^[A-Za-z][A-Za-z-]{4,}$/.test(value);
    const batch = [];
    let n;
    while ((n = walker.nextNode())) {
      const text = n.nodeValue;
      re.lastIndex = 0;
      if (!re.test(text)) continue;
      batch.push(n);
      if (batch.length > 2000) break; // hard cap for performance
    }
    for (const node of batch) {
      if (wraps >= MAX_WRAPS) break;
      const text = node.nodeValue;
      const parts = text.split(re);
      if (!parts || parts.length <= 1) continue;
      const frag = runtime.createDocumentFragment();
      if (!frag) continue;
      for (let i = 0; i < parts.length; i++) {
        const s = parts[i];
        if (!s) continue;
        if (isLongLatinToken(s)) {
          const span = runtime.createElement('span');
          if (!span) continue;
          span.setAttribute('lang', 'en');
          span.textContent = s;
          frag.appendChild(span);
          wraps++;
          if (wraps >= MAX_WRAPS) break;
        } else {
          const textNode = runtime.createTextNode(s);
          if (textNode) frag.appendChild(textNode);
        }
      }
      node.parentNode.replaceChild(frag, node);
      if (wraps >= MAX_WRAPS) break;
    }
  } catch (_) { /* noop */ }
}
