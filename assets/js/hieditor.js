import { simpleHighlight } from './syntax-highlight.js?v=press-system-v3.4.50';

function escapeHtmlInline(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

// Deterministic, regex-free tag wrapper to avoid ReDoS.
// Walks the string, skips over our highlight markers (__H__...__E__),
// and wraps syntactic tags like <tag ...>...</tag> as a single token.
function wrapTagsNoRegex(input, markFn) {
  const s = String(input || '');
  const out = [];
  let i = 0;
  const len = s.length;
  const MARK_OPEN = '__H__';
  const MARK_CLOSE = '__E__';
  const isNameStart = (ch) => /[A-Za-z_:]/.test(ch);
  while (i < len) {
    // Skip over existing highlight markers entirely so their inner content
    // (which might include < or >) does not interfere with tag detection.
    if (s.startsWith(MARK_OPEN, i)) {
      const end = s.indexOf(MARK_CLOSE, i + MARK_OPEN.length);
      if (end === -1) { out.push(s.slice(i)); break; }
      out.push(s.slice(i, end + MARK_CLOSE.length));
      i = end + MARK_CLOSE.length;
      continue;
    }
    const ch = s[i];
    if (ch !== '<') { out.push(ch); i++; continue; }
    // Potential tag start
    let j = i + 1;
    if (j < len && s[j] === '/') j++;
    if (j >= len || !isNameStart(s[j])) {
      // Not a valid tag name start; treat '<' literally
      out.push('<'); i++; continue;
    }
    // Scan forward to find matching '>' while skipping markers
    let k = j + 1;
    let found = false;
    while (k < len) {
      if (s.startsWith(MARK_OPEN, k)) {
        const end2 = s.indexOf(MARK_CLOSE, k + MARK_OPEN.length);
        if (end2 === -1) { k = len; break; }
        k = end2 + MARK_CLOSE.length;
        continue;
      }
      const c = s[k];
      if (c === '>') { found = true; break; }
      k++;
    }
    if (found) {
      const tag = s.slice(i, k + 1);
      out.push(markFn('tag', tag));
      i = k + 1;
    } else {
      // No closing '>' — not a valid tag; emit '<' and continue
      out.push('<'); i++;
    }
  }
  return out.join('');
}

function xmlFallbackHighlight(raw) {
  const MARK = (t, s) => `__H__${t}__${s}__E__`;
  let tmp = String(raw || '');
  try {
    // PI
    tmp = tmp.replace(/<\?[\s\S]*?\?>/g, (m) => MARK('preprocessor', m));
    // Comments
    tmp = tmp.replace(/<!--[\s\S]*?-->/g, (m) => MARK('comment', m));
    // CDATA
    tmp = tmp.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (m) => MARK('comment', m));
    // Attribute values (keep simple)
    tmp = tmp.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, (m) => MARK('string', m));
    // Dates and times as whole tokens
    tmp = tmp.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (m) => MARK('number', m));
    tmp = tmp.replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, (m) => MARK('number', m));
    // General numbers (integers/decimals)
    tmp = tmp.replace(/\b\d+(?:\.\d+)?\b/g, (m) => MARK('number', m));
    // Tags (keep last so it wraps the "<...>" blocks). Use a linear-time
    // scanner instead of a complex regex to avoid ReDoS.
    tmp = wrapTagsNoRegex(tmp, MARK);
    // Escape and unwrap
    tmp = escapeHtmlInline(tmp);
    // Restrict the type token to letters/dashes so underscores in the
    // content (e.g., markers for other tokens) are not swallowed into the
    // type. This prevents artifacts like "__H" leaking into the output.
    tmp = tmp.replace(/__H__([A-Za-z-]+)__([\s\S]*?)__E__/g, (m, type, content) => `<span class="syntax-${type}">${content}</span>`);
    return tmp;
  } catch (_) { return escapeHtmlInline(raw || ''); }
}

function robotsFallbackHighlight(raw) {
  try {
    const lines = String(raw || '').split('\n');
    const spanWrap = (cls, txt) => `<span class="syntax-${cls}">${txt}</span>`;
    const protectedReplaceHTML = (input, regex, wrapFn) => {
      let out = '';
      let i = 0;
      const spanRe = /<span[^>]*>[\s\S]*?<\/span>/gi;
      let m;
      while ((m = spanRe.exec(input)) !== null) {
        const start = m.index;
        const end = spanRe.lastIndex;
        const before = input.slice(i, start);
        out += before.replace(regex, wrapFn);
        out += m[0];
        i = end;
      }
      out += input.slice(i).replace(regex, wrapFn);
      return out;
    };
    const out = lines.map((line) => {
      let esc = escapeHtmlInline(line);
      // Whole-line comments
      if (/^\s*#/.test(line)) {
        return spanWrap('comment', esc);
      }
      // Line-leading directive + first colon
      esc = esc.replace(/^(\s*)([A-Za-z][A-Za-z-]*\s*:)/, (m, g1, g2) => `${g1}${spanWrap('keyword', g2)}`);
      // URLs
      esc = protectedReplaceHTML(esc, /(https?:\/\/[^\s#]+)/gi, (m) => spanWrap('string', m));
      // Numbers
      esc = protectedReplaceHTML(esc, /\b\d+\b/g, (m) => spanWrap('number', m));
      // Wildcards/punctuation
      esc = protectedReplaceHTML(esc, /[/*$]/g, (m) => spanWrap('punctuation', m));
      return esc;
    }).join('\n');
    return out;
  } catch (_) {
    return escapeHtmlInline(raw || '');
  }
}

function yamlFallbackHighlight(raw) {
  try {
    const lines = String(raw || '').split('\n');
    const MARK = (t, s) => `__H__${t}__${s}__E__`;

    // Replace only in regions not already wrapped by markers
    const protectedReplaceRaw = (input, regex, wrapFn) => {
      let out = '';
      let i = 0;
      while (i < input.length) {
        const start = input.indexOf('__H__', i);
        if (start === -1) {
          out += input.slice(i).replace(regex, wrapFn);
          break;
        }
        // Replace in the chunk before the marker
        out += input.slice(i, start).replace(regex, wrapFn);
        // Copy the marked chunk untouched
        const end = input.indexOf('__E__', start + 5);
        if (end === -1) { // malformed marker; append rest
          out += input.slice(start);
          break;
        }
        out += input.slice(start, end + 5);
        i = end + 5;
      }
      return out;
    };

    const out = lines.map((line) => {
      let s = String(line || '');

      // 1) Strings first, on raw text (so quotes are intact)
      s = s.replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, (m) => MARK('string', m));

      // 2) Anchors & aliases (outside strings)
      s = protectedReplaceRaw(s, /(^|\s)[&*][A-Za-z0-9_\-]+/g, (m) => MARK('variables', m));

      // 3) Tags (e.g., !Ref, !!str)
      s = protectedReplaceRaw(s, /(^|\s)!{1,2}[A-Za-z0-9_:\-]+/g, (m) => MARK('preprocessor', m));

      // 4) Key at line start (or after list dash): key:
      s = s.replace(/^(\s*-\s*)?([A-Za-z_][\w\-\.]*|&[A-Za-z0-9_\-]+|\*[A-Za-z0-9_\-]+|"(?:[^"\\]|\\.)*"|'[^']*')\s*:/, (m, g1 = '', g2 = '') => `${g1 || ''}${MARK('property', g2 + ':')}`);

      // 5) Comments from # to EOL (outside strings)
      s = protectedReplaceRaw(s, /(^|\s)#.*$/, (m) => MARK('comment', m));

      // 6) Dates and times (outside strings/comments)
      s = protectedReplaceRaw(s, /\b\d{4}-\d{2}-\d{2}\b/g, (m) => MARK('number', m));
      s = protectedReplaceRaw(s, /\b\d{2}:\d{2}(?::\d{2})?\b/g, (m) => MARK('number', m));

      // 7) Booleans/null
      s = protectedReplaceRaw(s, /\b(true|false|on|off|yes|no|null)\b/gi, (m) => MARK('keyword', m));

      // 8) Numbers
      s = protectedReplaceRaw(s, /\b-?\d+(?:\.\d+)?\b/g, (m) => MARK('number', m));

      // 9) Punctuation (include block scalar indicators | and >)
      s = protectedReplaceRaw(s, /[:{},\[\]\-|>]/g, (m) => MARK('punctuation', m));

      // Escape and unwrap markers into spans
      s = escapeHtmlInline(s);
      // Important: avoid using \w for the type capture; it would greedily
      // consume underscores and break on sequences like __H__number__180__E__
      // by turning the type into "number__180__E". Limit to letters/dashes.
      s = s.replace(/__H__([A-Za-z-]+)__([\s\S]*?)__E__/g, (m, type, content) => `<span class="syntax-${type}">${content}</span>`);
      return s;
    }).join('\n');
    return out;
  } catch (_) { return escapeHtmlInline(raw || ''); }
}

function cleanupMarkerArtifacts(html) {
  if (!html) return html;
  // Convert any leftover marker tokens into spans (defensive guard)
  let out = String(html);
  // Generic: only convert well-formed markers that include an explicit terminator
  out = out.replace(/__H[A-Z]*?__([A-Za-z-]+)__([\s\S]*?)(?:__END__|__E__)/gi, (m, t, c) => `<span class="syntax-${t.toLowerCase()}">${c}</span>`);
  // Specific known forms
  out = out.replace(/__HIGHLIGHTED__(\w+)__([\s\S]*?)__END__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  out = out.replace(/__H__(\w+)__([\s\S]*?)__E__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  out = out.replace(/__HILIGHTED__(\w+)__([\s\S]*?)__/g, (m, t, c) => `<span class="syntax-${t}">${c}</span>`);
  // Remove stray type tokens like __tag__ / __number__ if they remain
  out = out.replace(/__(tag|string|number|comment|operator|punctuation|property|selector|preprocessor|variables|keyword|attributes)__+/gi, '');
  // Absolute safety: strip any remaining start/end tokens so UI never shows raw markers
  out = out.replace(/__H[A-Z_]*__/g, '');
  out = out.replace(/__(?:END|E)__/g, '');
  return out;
}

const editors = new Map();

function getAmbientDocument() {
  try { return typeof document !== 'undefined' ? document : null; }
  catch (_) { return null; }
}

function getAmbientWindow() {
  try { return typeof window !== 'undefined' ? window : null; }
  catch (_) { return null; }
}

function getAmbientNavigator(windowRef) {
  try {
    if (windowRef && windowRef.navigator) return windowRef.navigator;
    return typeof navigator !== 'undefined' ? navigator : null;
  } catch (_) {
    return null;
  }
}

function createHiEditorRuntime(options = {}) {
  const allowAmbient = options.allowAmbient !== false;
  const documentRef = options.documentRef || (allowAmbient ? getAmbientDocument() : null);
  const windowRef = options.windowRef || (allowAmbient ? getAmbientWindow() : null);
  const navigatorRef = options.navigatorRef || (allowAmbient ? getAmbientNavigator(windowRef) : null);
  const setTimeoutRef = typeof options.setTimeoutRef === 'function'
    ? options.setTimeoutRef
    : (allowAmbient && windowRef && typeof windowRef.setTimeout === 'function'
      ? windowRef.setTimeout.bind(windowRef)
      : null);
  const getComputedStyleRef = typeof options.getComputedStyle === 'function'
    ? options.getComputedStyle
    : (allowAmbient && windowRef && typeof windowRef.getComputedStyle === 'function'
      ? windowRef.getComputedStyle.bind(windowRef)
      : null);
  const getResizeObserverRef = typeof options.getResizeObserver === 'function'
    ? options.getResizeObserver
    : (allowAmbient && windowRef && typeof windowRef.ResizeObserver === 'function'
      ? () => windowRef.ResizeObserver
      : () => null);
  const addDocumentListener = typeof options.addDocumentListener === 'function'
    ? options.addDocumentListener
    : (allowAmbient && documentRef && typeof documentRef.addEventListener === 'function'
      ? (type, handler, listenerOptions) => {
        documentRef.addEventListener(type, handler, listenerOptions);
        return () => documentRef.removeEventListener(type, handler, listenerOptions);
      }
      : null);
  const addWindowListener = typeof options.addWindowListener === 'function'
    ? options.addWindowListener
    : (allowAmbient && windowRef && typeof windowRef.addEventListener === 'function'
      ? (type, handler, listenerOptions) => {
        windowRef.addEventListener(type, handler, listenerOptions);
        return () => windowRef.removeEventListener(type, handler, listenerOptions);
      }
      : null);
  const writeClipboardText = typeof options.writeClipboardText === 'function'
    ? options.writeClipboardText
    : null;

  const createElement = (tag) => (
    documentRef && typeof documentRef.createElement === 'function'
      ? documentRef.createElement(tag)
      : null
  );
  const createTextNode = (text) => (
    documentRef && typeof documentRef.createTextNode === 'function'
      ? documentRef.createTextNode(text)
      : null
  );
  const createDocumentFragment = () => (
    documentRef && typeof documentRef.createDocumentFragment === 'function'
      ? documentRef.createDocumentFragment()
      : null
  );

  return {
    documentRef,
    windowRef,
    navigatorRef,
    createElement,
    createTextNode,
    createDocumentFragment,
    getElementById(id) {
      return documentRef && typeof documentRef.getElementById === 'function'
        ? documentRef.getElementById(id)
        : null;
    },
    getBody() {
      return documentRef ? documentRef.body || null : null;
    },
    getDocumentElement() {
      return documentRef ? documentRef.documentElement || null : null;
    },
    getScrollingElement() {
      return documentRef ? documentRef.scrollingElement || null : null;
    },
    getActiveElement() {
      return documentRef ? documentRef.activeElement || null : null;
    },
    execCommand(command) {
      if (!documentRef || typeof documentRef.execCommand !== 'function') return false;
      return documentRef.execCommand(command);
    },
    getComputedStyle(node) {
      return getComputedStyleRef ? getComputedStyleRef(node) : null;
    },
    getViewportHeight() {
      const height = windowRef ? Number(windowRef.innerHeight) : 0;
      return Number.isFinite(height) && height > 0 ? height : 600;
    },
    getResizeObserver() {
      return getResizeObserverRef ? getResizeObserverRef() : null;
    },
    setTimer(handler, delay = 0) {
      return setTimeoutRef ? setTimeoutRef(handler, delay) : null;
    },
    addDocumentListener(type, handler, listenerOptions) {
      return addDocumentListener ? addDocumentListener(type, handler, listenerOptions) : null;
    },
    addWindowListener(type, handler, listenerOptions) {
      return addWindowListener ? addWindowListener(type, handler, listenerOptions) : null;
    },
    async writeClipboardText(text) {
      if (writeClipboardText) return !!(await writeClipboardText(text));
      const clipboard = navigatorRef && navigatorRef.clipboard;
      if (!clipboard || typeof clipboard.writeText !== 'function') return false;
      await clipboard.writeText(text);
      return true;
    }
  };
}

function createLangLabel(runtime, text, onCopy) {
  const el = runtime.createElement('div');
  if (!el) return null;
  el.className = 'syntax-language-label';
  el.dataset.lang = (text || 'PLAIN').toUpperCase();
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', 'Copy code');
  el.textContent = el.dataset.lang;
  const copy = async () => {
    const ok = await (async () => {
      try {
        const txt = onCopy ? onCopy() : '';
        if (await runtime.writeClipboardText(txt)) return true;
      } catch (_) {}
      try {
        const ta = runtime.createElement('textarea');
        const body = runtime.getBody();
        if (!ta || !body) return false;
        ta.value = onCopy ? onCopy() : '';
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        body.appendChild(ta);
        ta.focus(); ta.select(); const ok2 = runtime.execCommand('copy');
        body.removeChild(ta); return ok2;
      } catch (_) { return false; }
    })();
    const old = el.dataset.lang || 'PLAIN';
    el.classList.add('is-copied');
    el.textContent = ok ? 'COPIED' : 'FAILED';
    runtime.setTimer(() => { el.classList.remove('is-copied'); el.textContent = old; }, 1000);
  };
  el.addEventListener('mouseenter', () => { el.classList.add('is-hover'); el.textContent = 'COPY'; });
  el.addEventListener('mouseleave', () => { el.classList.remove('is-hover'); el.textContent = el.dataset.lang || 'PLAIN'; });
  el.addEventListener('click', copy);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); } });
  return el;
}

function renderHighlight(codeEl, gutterEl, value, language, options = {}) {
  const runtime = options.runtime || createHiEditorRuntime(options);
  const raw = String(value || '');
  let html;
  if ((language || '').toLowerCase() === 'robots') {
    // Force robots-specific highlighter for reliable result
    html = robotsFallbackHighlight(raw);
    if (!/syntax-\w+/.test(html)) html = escapeHtmlInline(raw);
  } else if ((language || '').toLowerCase() === 'yaml' || (language || '').toLowerCase() === 'yml') {
    // YAML tends to be whitespace-sensitive; use robust fallback
    html = yamlFallbackHighlight(raw);
    if (!/syntax-\w+/.test(html)) html = escapeHtmlInline(raw);
  } else {
    // Update highlighted HTML; rely on main highlighter. If nothing matched, show plain escaped.
    html = simpleHighlight(raw, language || 'plain') || '';
    if (!/syntax-\w+/.test(html)) {
      html = escapeHtmlInline(raw);
    }
  }
  // Final guard: ensure no marker artifacts leak to UI
  let safeHtml = cleanupMarkerArtifacts(html);
  if (/__H[A-Z_]/.test(safeHtml) || /tag__/.test(safeHtml)) {
    // Fallback to plain escaped if markers still leak
    safeHtml = escapeHtmlInline(raw);
  }
  // Render using a safe DOM builder that only allows highlight span wrappers
  // and decodes entities for text nodes. This avoids interpreting arbitrary HTML.
  (function safeRender(target, markup) {
    // Decode highlighter escapes before inserting text nodes so the mirror
    // keeps the same wrapping geometry as the backing textarea.
    const decode = (s) => String(s || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
        const num = parseInt(hex, 16);
        if (!Number.isFinite(num) || num < 0) return match;
        try { return String.fromCodePoint(num); } catch (_) { return match; }
      })
      .replace(/&#([0-9]+);/g, (match, dec) => {
        const num = parseInt(dec, 10);
        if (!Number.isFinite(num) || num < 0) return match;
        try { return String.fromCodePoint(num); } catch (_) { return match; }
      })
      // Unescape ampersand last to avoid double-unescaping
      .replace(/&amp;/g, '&');
    const root = runtime.createDocumentFragment();
    if (!root) return;
    const stack = [root];
    let i = 0;
    const closeTag = '</span>';
    const isClassOk = (cls) => (
      /^syntax-[a-z-]+$/.test(cls)
      || /^hljs-[A-Za-z0-9_-]+$/.test(cls)
      || /^[A-Za-z]+_+$/.test(cls)
    );
    while (i < markup.length) {
      if (markup.startsWith('<span', i)) {
        const match = markup.slice(i).match(/^<\s*span\b([^>]*)>/i);
        if (match) {
          const clsMatch = (match[1] || '').match(/\bclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
          const classes = clsMatch
            ? (clsMatch[2] || clsMatch[3] || clsMatch[4] || '').split(/\s+/).filter(isClassOk)
            : [];
          if (classes.length) {
            const el = runtime.createElement('span');
            if (!el) {
              const textNode = runtime.createTextNode('<');
              if (textNode) stack[stack.length - 1].appendChild(textNode);
              i += 1;
              continue;
            }
            el.className = classes.join(' ');
            stack[stack.length - 1].appendChild(el);
            stack.push(el);
            i += match[0].length;
            continue;
          }
        }
        // Not a valid allowed opener; treat '<' as text and keep moving.
        const textNode = runtime.createTextNode('<');
        if (textNode) stack[stack.length - 1].appendChild(textNode);
        i += 1;
        continue;
      }
      if (markup.startsWith(closeTag, i)) {
        if (stack.length > 1) stack.pop();
        i += closeTag.length;
        continue;
      }
      const nextLt = markup.indexOf('<', i);
      if (nextLt === i) {
        const textNode = runtime.createTextNode('<');
        if (textNode) stack[stack.length - 1].appendChild(textNode);
        i += 1;
        continue;
      }
      const end = nextLt === -1 ? markup.length : nextLt;
      const chunk = markup.slice(i, end);
      if (chunk) {
        const textNode = runtime.createTextNode(decode(chunk));
        if (textNode) stack[stack.length - 1].appendChild(textNode);
      }
      i = end;
    }
    // Replace children atomically
    target.replaceChildren(root);
  })(codeEl, safeHtml);
  const lines = raw === '' ? [''] : raw.split('\n');
  const digits = String(lines.length).length;
  const wrapMode = !!(options && options.wrap);
  const entries = [];
  if (!gutterEl) {
    if (wrapMode && typeof options.computeWrapSegments === 'function') {
      let wrapCounts = [];
      try {
        wrapCounts = options.computeWrapSegments(lines, codeEl) || [];
      } catch (_) {
        wrapCounts = [];
      }
      let lineNumber = 1;
      for (let i = 0; i < lines.length; i++) {
        const parsed = parseInt(wrapCounts[i], 10);
        const wrapCount = (Number.isFinite(parsed) && parsed > 0) ? parsed : 1;
        for (let j = 0; j < wrapCount; j++) {
          const isContinuation = j > 0;
          entries.push({
            text: isContinuation ? '-' : String(lineNumber),
            continuation: isContinuation,
            line: lineNumber
          });
        }
        lineNumber += 1;
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        entries.push({ text: String(i + 1), continuation: false, line: i + 1 });
      }
    }
    return { entries, wrapMode };
  }
  const placeholder = (options.wrapPlaceholder != null) ? String(options.wrapPlaceholder) : '-';
  if (wrapMode && typeof options.computeWrapSegments === 'function') {
    let wrapCounts = [];
    try {
      wrapCounts = options.computeWrapSegments(lines, codeEl) || [];
    } catch (_) {
      wrapCounts = [];
    }
    let lineNumber = 1;
    for (let i = 0; i < lines.length; i++) {
      const parsed = parseInt(wrapCounts[i], 10);
      const wrapCount = (Number.isFinite(parsed) && parsed > 0) ? parsed : 1;
      for (let j = 0; j < wrapCount; j++) {
        const isContinuation = j > 0;
        entries.push({
          text: isContinuation ? placeholder : String(lineNumber),
          continuation: isContinuation,
          line: lineNumber
        });
      }
      lineNumber += 1;
    }
  } else {
    for (let i = 0; i < lines.length; i++) {
      entries.push({ text: String(i + 1), continuation: false, line: i + 1 });
    }
  }

  const existing = gutterEl.children;
  if (existing.length !== entries.length) {
    const frag = runtime.createDocumentFragment();
    if (!frag) return { entries, wrapMode };
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const span = runtime.createElement('span');
      if (!span) continue;
      span.textContent = entry.text;
      span.dataset.line = String(entry.line);
      if (entry.continuation) span.classList.add('is-wrap-continued');
      frag.appendChild(span);
    }
    gutterEl.innerHTML = '';
    gutterEl.appendChild(frag);
  } else {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const span = existing[i];
      if (span.textContent !== entry.text) span.textContent = entry.text;
      span.dataset.line = String(entry.line);
      span.classList.toggle('is-wrap-continued', !!entry.continuation);
    }
  }
  gutterEl.dataset.wrapMode = wrapMode ? '1' : '0';
  gutterEl.style.width = `${Math.max(3, digits + 2)}ch`;
  return { entries, wrapMode };
}

function makeEditor(targetTextarea, language, readOnly, options = {}) {
  const runtime = options.runtime || createHiEditorRuntime(options);
  const hiddenTa = targetTextarea; // keep for compatibility; hide it
  if (!runtime.documentRef || !hiddenTa || !hiddenTa.parentNode) return null;
  const id = hiddenTa.id;
  hiddenTa.style.display = 'none';

  const container = runtime.createElement('div');
  if (!container) return null;
  container.className = 'hi-editor with-code-scroll';

  const scroll = runtime.createElement('div');
  if (!scroll) return null;
  scroll.className = 'code-scroll code-with-gutter';
  scroll.style.position = 'relative';

  const gutter = runtime.createElement('div');
  if (!gutter) return null;
  gutter.className = 'code-gutter';
  gutter.setAttribute('aria-hidden', 'true');

  const body = runtime.createElement('div');
  if (!body) return null;
  body.className = 'hi-body';

  const pre = runtime.createElement('pre');
  if (!pre) return null;
  pre.className = 'hi-pre';
  // Background highlight layer for active/selected lines
  const hlLayer = runtime.createElement('div');
  if (!hlLayer) return null;
  hlLayer.className = 'hi-hl-layer';
  const code = runtime.createElement('code');
  if (!code) return null;
  code.className = `language-${(language || 'plain').toLowerCase()}`;
  pre.appendChild(hlLayer);
  pre.appendChild(code);

  const ta = runtime.createElement('textarea');
  if (!ta) return null;
  ta.className = 'hi-ta';
  ta.spellcheck = false;
  ta.autocapitalize = 'off';
  ta.autocorrect = 'off';
  if (readOnly) ta.setAttribute('readonly', 'readonly');

  let softWrap = false;
  let wrapMeasureEl = null;
  let lastWrapWidth = 0;
  let lastRenderMeta = { entries: [], wrapMode: false };

  // Lazily create a hidden measuring block so we can count wrapped segments per line.
  const ensureWrapMeasure = () => {
    if (wrapMeasureEl) return wrapMeasureEl;
    const el = runtime.createElement('div');
    if (!el) return null;
    el.className = 'hi-wrap-measure';
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'pre-wrap';
    el.style.wordBreak = 'break-word';
    el.style.overflowWrap = 'break-word';
    el.style.top = '0';
    el.style.left = '0';
    el.style.padding = '0';
    el.style.margin = '0';
    el.style.border = '0';
    el.style.maxWidth = 'none';
    el.style.minWidth = '0';
    el.style.zIndex = '-1';
    body.appendChild(el);
    wrapMeasureEl = el;
    return wrapMeasureEl;
  };

  const getContentWidth = () => {
    try {
      const taRect = ta.getBoundingClientRect();
      if (taRect && isFinite(taRect.width) && taRect.width > 0) {
        const taStyles = runtime.getComputedStyle(ta);
        if (!taStyles) return taRect.width;
        const paddingLeft = parseFloat(taStyles.paddingLeft) || 0;
        const paddingRight = parseFloat(taStyles.paddingRight) || 0;
        const borderLeft = parseFloat(taStyles.borderLeftWidth) || 0;
        const borderRight = parseFloat(taStyles.borderRightWidth) || 0;
        const inner = taRect.width - paddingLeft - paddingRight - borderLeft - borderRight;
        if (inner > 0) return inner;
      }
    } catch (_) { /* noop */ }
    const codeRect = code.getBoundingClientRect();
    if (codeRect && isFinite(codeRect.width) && codeRect.width > 0) return codeRect.width;
    const bodyRect = body.getBoundingClientRect();
    if (bodyRect && isFinite(bodyRect.width) && bodyRect.width > 0) return bodyRect.width;
    return 0;
  };

  const computeWrapSegments = (lines) => {
    if (!lines || !lines.length) return [1];
    const measure = ensureWrapMeasure();
    if (!measure) return lines.map(() => 1);
    const codeStyles = runtime.getComputedStyle(code);
    if (!codeStyles) return lines.map(() => 1);
    const targetWidth = getContentWidth();
    if (!targetWidth || !isFinite(targetWidth)) {
      return lines.map(() => 1);
    }
    lastWrapWidth = targetWidth;
    measure.style.width = `${targetWidth}px`;
    measure.style.fontFamily = codeStyles.fontFamily;
    measure.style.fontSize = codeStyles.fontSize;
    measure.style.fontWeight = codeStyles.fontWeight;
    measure.style.fontStyle = codeStyles.fontStyle;
    measure.style.letterSpacing = codeStyles.letterSpacing;
    measure.style.lineHeight = codeStyles.lineHeight;
    measure.style.tabSize = codeStyles.getPropertyValue('tab-size') || codeStyles.tabSize || '4';
    measure.style.MozTabSize = measure.style.tabSize;
    measure.style.whiteSpace = 'pre-wrap';
    measure.style.wordBreak = 'break-word';
    measure.style.overflowWrap = codeStyles.overflowWrap || 'break-word';
    let lineHeight = parseFloat(codeStyles.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
      const taStyles = runtime.getComputedStyle(ta);
      const alt = taStyles ? parseFloat(taStyles.lineHeight) : 0;
      if (Number.isFinite(alt) && alt > 0) lineHeight = alt;
    }
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = DEFAULT_LINE_HEIGHT;
    const tabSizeVal = parseInt(measure.style.tabSize, 10);
    const tabReplacement = ' '.repeat((Number.isFinite(tabSizeVal) && tabSizeVal > 0) ? Math.min(tabSizeVal, 16) : 4);
    const counts = [];
    for (let i = 0; i < lines.length; i++) {
      const rawLine = String(lines[i] || '');
      // Replace tabs with spaces to mirror tab-size in measurement context.
      const sample = rawLine.indexOf('\t') === -1 ? rawLine : rawLine.replace(/\t/g, tabReplacement);
      measure.textContent = sample.length ? sample : ' ';
      const height = measure.scrollHeight;
      const segments = Math.max(1, Math.round((height + 0.01) / lineHeight));
      counts.push(segments);
    }
    measure.textContent = '';
    return counts;
  };

  const renderEditor = () => {
    const meta = renderHighlight(code, gutter, ta.value, language, {
      runtime,
      wrap: softWrap,
      wrapPlaceholder: '-',
      computeWrapSegments: softWrap ? computeWrapSegments : null
    });
    if (meta && Array.isArray(meta.entries)) {
      lastRenderMeta = meta;
    } else {
      lastRenderMeta = { entries: [], wrapMode: !!(meta && meta.wrapMode) };
    }
  };

  const applyWrapMode = () => {
    const on = softWrap;
    try { ta.setAttribute('wrap', on ? 'soft' : 'off'); }
    catch (_) {}
    ta.style.whiteSpace = on ? 'pre-wrap' : 'pre';
    ta.style.wordBreak = on ? 'break-word' : 'normal';
    ta.style.overflowX = 'hidden';
    code.style.whiteSpace = on ? 'pre-wrap' : 'pre';
    code.style.wordBreak = on ? 'break-word' : 'normal';
    code.style.minWidth = on ? '0' : '100%';
    code.style.width = on ? '100%' : '';
    container.classList.toggle('is-wrap', on);
    scroll.style.overflowX = on ? 'hidden' : 'auto';
  };

  body.appendChild(pre);
  body.appendChild(ta);
  scroll.appendChild(gutter);
  scroll.appendChild(body);
  container.appendChild(scroll);
  const label = createLangLabel(runtime, language || 'plain', () => ta.value || '');
  if (label) container.appendChild(label);

  applyWrapMode();

  // Insert after hidden textarea
  hiddenTa.parentNode.insertBefore(container, hiddenTa.nextSibling);

  // Initialize with current value
  ta.value = hiddenTa.value || '';
  renderEditor();

  const DEFAULT_LINE_HEIGHT = 20;
  const lineMetricCache = { lineH: DEFAULT_LINE_HEIGHT, padTop: 0 };

  // Auto-resize to fit content height (no inner scrollbar)
  const applyHeights = () => {
    // Robust auto-resize (also shrinks after large deletions)
    // Collapse first to force reflow, then grow to scrollHeight
    ta.style.height = '0px';
    // Force reflow to ensure scrollHeight is recalculated
    // eslint-disable-next-line no-unused-expressions
    ta.offsetHeight;
    const minH = 0; // grow exactly with content height
    let h = Math.max(minH, ta.scrollHeight);
    if (h <= 32) {
      // Hidden containers report 0 scrollHeight; estimate from line count instead
      const metrics = getLineMetrics();
      const lines = (ta.value.match(/\n/g) || []).length + 1;
      const fallback = (metrics.padTop * 2) + metrics.lineH * Math.max(1, lines);
      h = Math.max(h, fallback);
    }
    ta.style.height = h + 'px';
    body.style.height = h + 'px';
    pre.style.height = h + 'px';
    // Ensure transforms are reset (no scroll-based sync)
    pre.style.transform = 'none';
    gutter.style.transform = 'none';
  };

  const refreshLayout = () => {
    applyHeights();
    updateActiveLines();
  };

  // Keep gutter continuation markers in sync when the editor width changes.
  const handleWrapResize = () => {
    const width = getContentWidth();
    if (!width || !isFinite(width)) return;
    if (!softWrap) {
      lastWrapWidth = width;
      return;
    }
    if (Math.abs(width - lastWrapWidth) < 0.5) return;
    lastWrapWidth = width;
    renderEditor();
    refreshLayout();
  };

  const ResizeObserverCtor = runtime.getResizeObserver();
  if (typeof ResizeObserverCtor === 'function') {
    const ro = new ResizeObserverCtor((entries) => {
      for (const entry of entries) {
        if (!entry || entry.target !== body) continue;
        handleWrapResize();
      }
    });
    try { ro.observe(body); }
    catch (_) {}
  } else {
    runtime.addWindowListener('resize', () => {
      handleWrapResize();
    });
  }

  function getLineMetrics() {
    try {
      // Prefer code element metrics for exact alignment with rendered lines
      const cs = runtime.getComputedStyle(code);
      if (!cs) return { lineH: lineMetricCache.lineH || DEFAULT_LINE_HEIGHT, padTop: lineMetricCache.padTop || 0 };
      let lineH = parseFloat(cs.lineHeight);
      if (!lineH || !isFinite(lineH) || lineH <= 0) {
        const fs = parseFloat(cs.fontSize);
        if (fs && isFinite(fs) && fs > 0) lineH = fs * 1.55;
      }
      if (!lineH || !isFinite(lineH) || lineH <= 0) {
        lineH = lineMetricCache.lineH || DEFAULT_LINE_HEIGHT;
      }
      const csPre = runtime.getComputedStyle(pre);
      let padTop = csPre ? parseFloat(csPre.paddingTop) : 0;
      if (!isFinite(padTop) || padTop < 0) padTop = lineMetricCache.padTop || 0;
      lineMetricCache.lineH = lineH;
      lineMetricCache.padTop = padTop;
      return { lineH, padTop };
    } catch (_) {
      return { lineH: lineMetricCache.lineH || DEFAULT_LINE_HEIGHT, padTop: lineMetricCache.padTop || 0 };
    }
  }

  function findVerticalScrollParent(node) {
    let el = node && node.parentElement;
    const bodyNode = runtime.getBody();
    const docEl = runtime.getDocumentElement();
    while (el && el !== bodyNode && el !== docEl) {
      try {
        const cs = runtime.getComputedStyle(el);
        if (/(auto|scroll|overlay)/.test(cs.overflowY || '') && el.scrollHeight > el.clientHeight + 1) {
          return el;
        }
      } catch (_) { /* noop */ }
      el = el.parentElement;
    }
    return runtime.getElementById('editorContentPane') || runtime.getScrollingElement() || runtime.getDocumentElement();
  }

  function getWheelDeltaY(event, scrollParent) {
    let deltaY = event && Number.isFinite(event.deltaY) ? event.deltaY : 0;
    if (!deltaY) return 0;
    if (event.deltaMode === 1) {
      deltaY *= getLineMetrics().lineH || DEFAULT_LINE_HEIGHT;
    } else if (event.deltaMode === 2) {
      deltaY *= (scrollParent && scrollParent.clientHeight) || runtime.getViewportHeight();
    }
    return deltaY;
  }

  function forwardVerticalWheel(event) {
    if (!event || !event.deltaY) return;
    const absX = Math.abs(event.deltaX || 0);
    const absY = Math.abs(event.deltaY || 0);
    if (absX > absY && scroll.scrollWidth > scroll.clientWidth + 1) return;
    const scrollParent = findVerticalScrollParent(container);
    if (!scrollParent) return;
    const deltaY = getWheelDeltaY(event, scrollParent);
    if (!deltaY) return;
    const before = scrollParent.scrollTop;
    scrollParent.scrollTop = before + deltaY;
    if (scrollParent.scrollTop !== before) {
      event.preventDefault();
    }
  }

  function updateActiveLines() {
    try {
      const value = ta.value || '';
      const selStart = ta.selectionStart || 0;
      const selEnd = ta.selectionEnd || selStart;
      // Compute start/end line numbers (1-based)
      const beforeStart = value.slice(0, selStart);
      const beforeEnd = value.slice(0, selEnd);
      const startLine = (beforeStart.match(/\n/g) || []).length + 1;
      const endLine = (beforeEnd.match(/\n/g) || []).length + 1;
      const from = Math.min(startLine, endLine);
      const to = Math.max(startLine, endLine);
      // Update gutter classes and ensure exact line-height match
      const spans = gutter.querySelectorAll('span');
      const metrics = getLineMetrics();
      const lh = metrics.lineH;
      const padTop = metrics.padTop;
      let entries = (lastRenderMeta && Array.isArray(lastRenderMeta.entries)) ? lastRenderMeta.entries : [];
      if (!entries.length || entries.length !== spans.length) {
        entries = Array.from(spans, (span, idx) => {
          const parsed = parseInt(span.dataset.line || '', 10);
          return { line: Number.isFinite(parsed) ? parsed : (idx + 1) };
        });
      }
      let startRow = -1;
      let endRow = -1;
      for (let i = 0; i < entries.length; i++) {
        const lineNo = Number.isFinite(entries[i]?.line) ? entries[i].line : (i + 1);
        if (lineNo >= from && startRow === -1) startRow = i;
        if (lineNo >= from && lineNo <= to) endRow = i;
        if (lineNo > to) break;
      }
      if (startRow === -1) startRow = Math.max(0, from - 1);
      if (endRow === -1) endRow = Math.max(startRow, Math.min(spans.length - 1, to - 1));
      spans.forEach((s, idx) => {
        const lineNo = Number.isFinite(entries[idx]?.line) ? entries[idx].line : (idx + 1);
        const isActive = lineNo >= from && lineNo <= to;
        if (isActive) s.classList.add('is-active');
        else s.classList.remove('is-active');
        s.style.lineHeight = `${lh}px`;
      });
      hlLayer.innerHTML = '';
      if (!spans.length) return;
      const hasRangeSelection = selEnd > selStart;
      if (hasRangeSelection) {
        // Let the native textarea paint selection ranges; it uses the same
        // soft-wrap geometry as the caret and avoids mirror-layer drift.
        return;
      }
      const clampedStart = Math.max(0, Math.min(startRow, spans.length - 1));
      const clampedEnd = Math.max(clampedStart, Math.min(endRow, spans.length - 1));
      const block = runtime.createElement('div');
      if (!block) return;
      block.className = 'hi-hl-line';
      block.style.top = `${padTop + clampedStart * lh}px`;
      block.style.height = `${Math.max(1, (clampedEnd - clampedStart + 1)) * lh}px`;
      hlLayer.appendChild(block);
    } catch (_) { /* noop */ }
  }

  // Sync: editor -> hidden textarea
  const onInput = () => {
    hiddenTa.value = ta.value;
    renderEditor();
    refreshLayout();
  };
  ta.addEventListener('input', onInput);
  // No internal scrollbars; height grows with content
  ta.style.overflow = 'hidden';
  scroll.addEventListener('wheel', forwardVerticalWheel, { passive: false });
  refreshLayout();

  // Caret/selection changes
  const onSelChange = () => { updateActiveLines(); };
  ta.addEventListener('keyup', onSelChange);
  ta.addEventListener('click', onSelChange);
  ta.addEventListener('select', onSelChange);
  runtime.addDocumentListener('selectionchange', () => {
    if (runtime.getActiveElement() === ta) updateActiveLines();
  });
  ta.addEventListener('keydown', (e) => {
    // defer until after key processes
    runtime.setTimer(updateActiveLines, 0);
  });

  // Public API
  const api = {
    setValue(text) { ta.value = String(text || ''); hiddenTa.value = ta.value; renderEditor(); refreshLayout(); },
    getValue() { return ta.value || ''; },
    setWrap(value) {
      const next = !!value;
      if (next === softWrap) {
        applyWrapMode();
        renderEditor();
        refreshLayout();
        updateActiveLines();
        return;
      }
      softWrap = next;
      applyWrapMode();
      renderEditor();
      refreshLayout();
      updateActiveLines();
    },
    isWrapEnabled() { return softWrap; },
    refreshLayout,
    el: container,
    textarea: ta
  };
  editors.set(id, api);
  return api;
}

export function initSeoEditors(options = {}) {
  const runtime = createHiEditorRuntime(options);
  const targets = [
    { id: 'sitemapOutput', lang: 'xml', readOnly: false },
    { id: 'robotsOutput', lang: 'robots', readOnly: false },
    { id: 'metaOutput', lang: 'html', readOnly: false },
    { id: 'configOutput', lang: 'yaml', readOnly: true }
  ];
  targets.forEach(t => {
    const ta = runtime.getElementById(t.id);
    if (ta && !editors.has(t.id)) makeEditor(ta, t.lang, t.readOnly, { ...options, runtime });
  });
}

export function setEditorValue(id, text) {
  const runtime = createHiEditorRuntime();
  const ed = editors.get(id); if (ed) ed.setValue(text); else { const ta = runtime.getElementById(id); if (ta) ta.value = text; }
}
export function getEditorValue(id) {
  const runtime = createHiEditorRuntime();
  const ed = editors.get(id); if (ed) return ed.getValue(); const ta = runtime.getElementById(id); return ta ? (ta.value || '') : '';
}
export function toggleEditorWrap(id, value) {
  const ed = editors.get(id);
  if (!ed) return;
  if (typeof value === 'boolean') {
    ed.setWrap(value);
    return;
  }
  ed.setWrap(false);
}

// Expose to window for other modules
try {
  const ambientWindow = getAmbientWindow();
  if (ambientWindow) {
    ambientWindow.__seoInitEditors = initSeoEditors;
    ambientWindow.__seoEditorSet = setEditorValue;
    ambientWindow.__seoEditorGet = getEditorValue;
    ambientWindow.__seoEditorToggleWrap = toggleEditorWrap;
  }
} catch (_) {}

// Generic creator for external pages (e.g., Markdown editor)
// Accepts a textarea element or its id; returns the editor API
export function createHiEditor(target, lang = 'plain', readOnly = false, options = {}) {
  try {
    const runtime = createHiEditorRuntime(options);
    const el = (typeof target === 'string') ? runtime.getElementById(target) : target;
    if (!el) return null;
    return makeEditor(el, lang, readOnly, { ...options, runtime });
  } catch (_) { return null; }
}
