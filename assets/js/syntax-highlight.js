import hljs from './vendor/highlightjs/highlight.min.js';

const HIGHLIGHT_LANGUAGES = [
  'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'ini', 'java',
  'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'markdown',
  'objectivec', 'perl', 'php', 'php-template', 'plaintext', 'python',
  'python-repl', 'r', 'ruby', 'rust', 'scss', 'shell', 'sql', 'swift',
  'typescript', 'vbnet', 'wasm', 'xml', 'yaml'
];
const HIGHLIGHT_LANGUAGE_SET = new Set(HIGHLIGHT_LANGUAGES);
const PLAIN_LANGUAGES = new Set(['plain', 'text', 'raw', 'none', 'nohighlight', 'plaintext']);
const LANGUAGE_ALIASES = new Map([
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['sh', 'bash'],
  ['zsh', 'bash'],
  ['html', 'xml'],
  ['htm', 'xml'],
  ['yml', 'yaml'],
  ['md', 'markdown'],
  ['plain', 'plaintext'],
  ['text', 'plaintext'],
  ['raw', 'plaintext'],
  ['none', 'plaintext'],
  ['nohighlight', 'plaintext']
]);
const HIGHLIGHT_CLASS_ALLOWLIST = new Set([
  'class_',
  'constant_',
  'dispatch_',
  'escape_',
  'function_',
  'hljs-addition',
  'hljs-attr',
  'hljs-attribute',
  'hljs-built_in',
  'hljs-bullet',
  'hljs-char',
  'hljs-class',
  'hljs-code',
  'hljs-comment',
  'hljs-deletion',
  'hljs-doctag',
  'hljs-emphasis',
  'hljs-function',
  'hljs-keyword',
  'hljs-label',
  'hljs-link',
  'hljs-literal',
  'hljs-meta',
  'hljs-name',
  'hljs-number',
  'hljs-operator',
  'hljs-params',
  'hljs-property',
  'hljs-punctuation',
  'hljs-quote',
  'hljs-regexp',
  'hljs-section',
  'hljs-selector-attr',
  'hljs-selector-class',
  'hljs-selector-id',
  'hljs-selector-pseudo',
  'hljs-selector-tag',
  'hljs-string',
  'hljs-strong',
  'hljs-subst',
  'hljs-symbol',
  'hljs-tag',
  'hljs-template-variable',
  'hljs-title',
  'hljs-type',
  'hljs-variable',
  'inherited__',
  'invoke__',
  'language_',
  'prompt_'
]);
const TOKEN_CLASS_MAP = new Map([
  ['hljs-keyword', 'syntax-keyword'],
  ['hljs-built_in', 'syntax-keyword'],
  ['hljs-literal', 'syntax-keyword'],
  ['hljs-type', 'syntax-keyword'],
  ['hljs-symbol', 'syntax-keyword'],
  ['hljs-class', 'syntax-keyword'],
  ['hljs-function', 'syntax-keyword'],
  ['hljs-name', 'syntax-tag'],
  ['hljs-tag', 'syntax-tag'],
  ['hljs-attr', 'syntax-property'],
  ['hljs-attribute', 'syntax-property'],
  ['hljs-property', 'syntax-property'],
  ['hljs-params', 'syntax-property'],
  ['hljs-variable', 'syntax-variables'],
  ['hljs-template-variable', 'syntax-variables'],
  ['hljs-selector-tag', 'syntax-selector'],
  ['hljs-selector-id', 'syntax-selector'],
  ['hljs-selector-class', 'syntax-selector'],
  ['hljs-selector-attr', 'syntax-selector'],
  ['hljs-selector-pseudo', 'syntax-selector'],
  ['hljs-string', 'syntax-string'],
  ['hljs-regexp', 'syntax-string'],
  ['hljs-subst', 'syntax-string'],
  ['hljs-title', 'syntax-title'],
  ['hljs-section', 'syntax-title'],
  ['hljs-number', 'syntax-number'],
  ['hljs-comment', 'syntax-comment'],
  ['hljs-quote', 'syntax-comment'],
  ['hljs-doctag', 'syntax-preprocessor'],
  ['hljs-meta', 'syntax-preprocessor'],
  ['hljs-meta-keyword', 'syntax-preprocessor'],
  ['hljs-meta-string', 'syntax-string'],
  ['hljs-label', 'syntax-preprocessor'],
  ['hljs-operator', 'syntax-operator'],
  ['hljs-punctuation', 'syntax-punctuation'],
  ['hljs-bullet', 'syntax-punctuation'],
  ['hljs-char', 'syntax-string'],
  ['hljs-code', 'syntax-code'],
  ['hljs-emphasis', 'syntax-emphasis'],
  ['hljs-strong', 'syntax-strong'],
  ['hljs-link', 'syntax-link'],
  ['hljs-deletion', 'syntax-deletion'],
  ['hljs-addition', 'syntax-addition'],
  ['hljs-formula', 'syntax-formula']
]);

function getAmbientDocument() {
  try { return typeof document !== 'undefined' ? document : null; }
  catch (_) { return null; }
}

function getAmbientWindow() {
  try { return typeof window !== 'undefined' ? window : null; }
  catch (_) { return null; }
}

function getAmbientNavigator() {
  try { return typeof navigator !== 'undefined' ? navigator : null; }
  catch (_) { return null; }
}

function createSyntaxHighlightRuntime(options = {}) {
  const allowAmbient = options.allowAmbient !== false;
  const documentRef = options.documentRef || options.document || (allowAmbient ? getAmbientDocument() : null);
  const windowRef = options.windowRef || options.window || (allowAmbient ? getAmbientWindow() : null);
  const navigatorRef = Object.prototype.hasOwnProperty.call(options, 'navigatorRef')
    ? options.navigatorRef
    : (allowAmbient ? getAmbientNavigator() : null);

  const createElement = (tagName) => {
    try { return documentRef && typeof documentRef.createElement === 'function' ? documentRef.createElement(tagName) : null; }
    catch (_) { return null; }
  };
  const createTextNode = (text) => {
    try { return documentRef && typeof documentRef.createTextNode === 'function' ? documentRef.createTextNode(text) : null; }
    catch (_) { return null; }
  };
  const createDocumentFragment = () => {
    try { return documentRef && typeof documentRef.createDocumentFragment === 'function' ? documentRef.createDocumentFragment() : null; }
    catch (_) { return null; }
  };
  const setTimer = typeof options.setTimer === 'function'
    ? options.setTimer
    : ((handler, delay = 0) => {
      try {
        return windowRef && typeof windowRef.setTimeout === 'function'
          ? windowRef.setTimeout(handler, delay)
          : null;
      } catch (_) {
        return null;
      }
    });
  const translate = typeof options.translate === 'function'
    ? options.translate
    : ((key, fallback) => {
      try {
        const t = windowRef && windowRef.__press_t;
        return typeof t === 'function' ? t(key) : fallback;
      } catch (_) {
        return fallback;
      }
    });

  async function writeClipboardText(text) {
    if (typeof options.writeClipboardText === 'function') {
      try { return !!(await options.writeClipboardText(text)); }
      catch (_) { return false; }
    }
    const rawText = String(text || '');
    try {
      const clipboard = navigatorRef && navigatorRef.clipboard;
      if (clipboard && typeof clipboard.writeText === 'function' && windowRef && windowRef.isSecureContext) {
        await clipboard.writeText(rawText);
        return true;
      }
    } catch (_) {}
    let textarea = null;
    try {
      textarea = createElement('textarea');
      if (!textarea || !documentRef || !documentRef.body || typeof documentRef.body.appendChild !== 'function') return false;
      textarea.value = rawText;
      if (textarea.style) {
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
      }
      documentRef.body.appendChild(textarea);
      if (typeof textarea.focus === 'function') textarea.focus();
      if (typeof textarea.select === 'function') textarea.select();
      return !!(typeof documentRef.execCommand === 'function' && documentRef.execCommand('copy'));
    } catch (_) {
      return false;
    } finally {
      try {
        if (textarea && documentRef && documentRef.body && typeof documentRef.body.removeChild === 'function') {
          documentRef.body.removeChild(textarea);
        }
      } catch (_) {}
    }
  }

  return {
    __syntaxHighlightRuntime: true,
    documentRef,
    windowRef,
    navigatorRef,
    createElement,
    createTextNode,
    createDocumentFragment,
    setTimer,
    translate,
    writeClipboardText
  };
}

function resolveSyntaxHighlightRuntime(options = {}) {
  return options && options.__syntaxHighlightRuntime ? options : createSyntaxHighlightRuntime(options);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

function normalizeLanguage(language) {
  const raw = String(language || '').trim().toLowerCase();
  if (!raw) return '';
  return LANGUAGE_ALIASES.get(raw) || raw;
}

function isPlainLanguage(language) {
  return PLAIN_LANGUAGES.has(String(language || '').trim().toLowerCase());
}

function isSupportedHighlightLanguage(language) {
  const normalized = normalizeLanguage(language);
  return !!normalized && HIGHLIGHT_LANGUAGE_SET.has(normalized) && !!hljs.getLanguage(normalized);
}

function robotsHighlight(raw) {
  const input = String(raw || '');
  const lines = input.split('\n');
  return lines.map((line) => {
    const match = line.match(/^(\s*)([A-Za-z][A-Za-z-]*\s*:)([\s\S]*)$/);
    const escaped = escapeHtml(line);
    if (!match) return escaped;
    const prefix = escapeHtml(match[1] || '');
    const directive = escapeHtml(match[2] || '');
    const rest = escapeHtml(match[3] || '')
      .replace(/(https?:\/\/[^\s#]+)/gi, '<span class="syntax-string">$1</span>')
      .replace(/(#.*)$/g, '<span class="syntax-comment">$1</span>');
    return `${prefix}<span class="syntax-keyword">${directive}</span>${rest}`;
  }).join('\n');
}

function mapHighlightClasses(classText) {
  const mapped = [];
  String(classText || '').split(/\s+/).forEach((cls) => {
    if (!cls) return;
    if (HIGHLIGHT_CLASS_ALLOWLIST.has(cls) && !mapped.includes(cls)) mapped.push(cls);
    const value = TOKEN_CLASS_MAP.get(cls);
    if (value && !mapped.includes(value)) mapped.push(value);
  });
  return mapped;
}

function isAllowedHighlightClass(className) {
  const value = String(className || '').trim();
  return value.startsWith('syntax-') || HIGHLIGHT_CLASS_ALLOWLIST.has(value);
}

function mapHighlightHtml(html) {
  const src = String(html || '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const open = src.slice(i).match(/^<\s*span\b([^>]*)>/i);
    if (open) {
      const clsMatch = (open[1] || '').match(/\bclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const mapped = mapHighlightClasses(clsMatch ? (clsMatch[2] || clsMatch[3] || clsMatch[4] || '') : '');
      out += mapped.length ? `<span class="${mapped.join(' ')}">` : '<span>';
      i += open[0].length;
      continue;
    }
    const close = src.slice(i).match(/^<\s*\/\s*span\s*>/i);
    if (close) {
      out += '</span>';
      i += close[0].length;
      continue;
    }
    if (src.charCodeAt(i) === 60 /* '<' */) {
      out += '&lt;';
      i += 1;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

function highlightWithHighlightJs(code, language) {
  const raw = String(code || '');
  const normalized = normalizeLanguage(language);
  if (normalized === 'robots') return robotsHighlight(raw);
  if (isPlainLanguage(language)) return escapeHtml(raw);

  try {
    if (normalized) {
      if (!isSupportedHighlightLanguage(normalized)) return escapeHtml(raw);
      return mapHighlightHtml(hljs.highlight(raw, { language: normalized, ignoreIllegals: true }).value);
    }
    return mapHighlightHtml(hljs.highlightAuto(raw, HIGHLIGHT_LANGUAGES).value);
  } catch (_) {
    return escapeHtml(raw);
  }
}

function simpleHighlight(code, language) {
  return highlightWithHighlightJs(code || '', language || '');
}

function toSafeFragment(html, options = {}) {
  const runtime = resolveSyntaxHighlightRuntime(options);
  const { windowRef } = runtime;
  const allowedTag = 'SPAN';
  const allowedAttr = 'class';

  try {
    const ElementCtor = windowRef && windowRef.Element;
    if (windowRef && 'Sanitizer' in windowRef && ElementCtor && ElementCtor.prototype && typeof ElementCtor.prototype.setHTML === 'function') {
      const s = new windowRef.Sanitizer({
        allowElements: ['span'],
        allowAttributes: {'class': ['span']},
      });
      const tmp = runtime.createElement('div');
      if (!tmp) return runtime.createDocumentFragment();
      tmp.setHTML(String(html || ''), { sanitizer: s });
      tmp.querySelectorAll('*').forEach((el) => {
        if (el.tagName !== allowedTag) {
          const text = runtime.createTextNode(el.textContent || '');
          if (text) el.replaceWith(text);
          return;
        }
        const classes = (el.getAttribute('class') || '').split(/\s+/).filter(isAllowedHighlightClass);
        if (classes.length) el.setAttribute('class', classes.join(' ')); else el.removeAttribute('class');
        for (const attr of Array.from(el.attributes)) {
          if (attr.name !== allowedAttr) el.removeAttribute(attr.name);
        }
      });
      const frag = runtime.createDocumentFragment();
      if (!frag) return null;
      while (tmp.firstChild) frag.appendChild(tmp.firstChild);
      return frag;
    }
  } catch (_) { /* ignore and use manual sanitizer */ }

  const decodeEntities = (t) => String(t || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const num = parseInt(hex, 16);
      if (!Number.isFinite(num) || num < 0) return _;
      try { return String.fromCodePoint(num); } catch (_) { return _; }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      const num = parseInt(dec, 10);
      if (!Number.isFinite(num) || num < 0) return _;
      try { return String.fromCodePoint(num); } catch (_) { return _; }
    })
    .replace(/&amp;/g, '&');
  const frag = runtime.createDocumentFragment();
  if (!frag) return null;
  const stack = [frag];
  let i = 0;
  const len = (html || '').length;
  const src = String(html || '');

  const appendText = (text) => {
    if (!text) return;
    const node = runtime.createTextNode(decodeEntities(text));
    if (node) stack[stack.length - 1].appendChild(node);
  };

  while (i < len) {
    if (src.charCodeAt(i) !== 60 /* '<' */) {
      const nextLt = src.indexOf('<', i);
      const chunk = nextLt === -1 ? src.slice(i) : src.slice(i, nextLt);
      appendText(chunk);
      i = nextLt === -1 ? len : nextLt;
      continue;
    }

    if (/^<\s*\/\s*span\s*>/i.test(src.slice(i))) {
      const m = src.slice(i).match(/^<\s*\/\s*span\s*>/i);
      if (m) {
        if (stack.length > 1) stack.pop(); else appendText(m[0]);
        i += m[0].length;
        continue;
      }
    }

    const open = src.slice(i).match(/^<\s*span\b([^>]*)>/i);
    if (open) {
      const attrText = open[1] || '';
      const clsMatch = attrText.match(/\bclass\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      let classes = [];
      if (clsMatch) {
        const raw = (clsMatch[2] || clsMatch[3] || clsMatch[4] || '').trim();
        classes = raw.split(/\s+/).filter(isAllowedHighlightClass);
      }
      const el = runtime.createElement('span');
      if (!el) {
        appendText(open[0]);
        i += open[0].length;
        continue;
      }
      if (classes.length) el.setAttribute('class', classes.join(' '));
      stack[stack.length - 1].appendChild(el);
      stack.push(el);
      i += open[0].length;
      continue;
    }

    appendText(src[i]);
    i += 1;
  }

  return frag;
}

function detectLanguage(code) {
  const raw = String(code || '');
  if (!raw.trim()) return null;
  try {
    const detected = hljs.highlightAuto(raw, HIGHLIGHT_LANGUAGES);
    const language = normalizeLanguage(detected && detected.language);
    return HIGHLIGHT_LANGUAGE_SET.has(language) ? language : null;
  } catch (_) {
    return null;
  }
}

function getCodeLanguage(codeElement) {
  const classList = Array.from(codeElement.classList || []);
  for (const className of classList) {
    if (className.startsWith('language-')) return className.replace('language-', '');
  }
  return '';
}

export function initSyntaxHighlighting(root = getAmbientDocument(), options = {}) {
  const runtime = createSyntaxHighlightRuntime(options);
  const documentRef = runtime.documentRef;
  const scope = root && typeof root.querySelectorAll === 'function' ? root : documentRef;
  if (!scope || typeof scope.querySelectorAll !== 'function') return;
  const codeBlocks = scope.querySelectorAll('pre code');

  codeBlocks.forEach(codeElement => {
    const preElement = codeElement.closest('pre');
    if (!preElement) return;
    // Skip editor-internal code surfaces. Mutating contenteditable code resets the browser selection.
    if (preElement.classList && preElement.classList.contains('hi-pre')) return;
    if (preElement.classList && preElement.classList.contains('blocks-code-preview')) return;
    if (preElement.closest && preElement.closest('.markdown-blocks-shell')) return;
    if (codeElement.isContentEditable || codeElement.getAttribute('contenteditable') === 'true') return;

    const classList = Array.from(codeElement.classList || []);
    const explicitLanguage = getCodeLanguage(codeElement);
    const hasNoHighlightFlag = (
      preElement.classList.contains('nohighlight') ||
      codeElement.classList.contains('nohighlight') ||
      codeElement.hasAttribute('data-nohighlight') ||
      preElement.hasAttribute('data-nohighlight') ||
      codeElement.classList.contains('plain') ||
      codeElement.classList.contains('text') ||
      classList.includes('language-plain') ||
      classList.includes('language-text') ||
      classList.includes('language-none') ||
      classList.includes('language-raw')
    );

    const originalCode = codeElement.textContent || '';
    const normalizedLanguage = normalizeLanguage(explicitLanguage);
    const detectedLanguage = explicitLanguage ? normalizedLanguage : detectLanguage(originalCode);
    const shouldHighlight = !hasNoHighlightFlag && !isPlainLanguage(normalizedLanguage) && (
      detectedLanguage === 'robots' ||
      isSupportedHighlightLanguage(detectedLanguage)
    );

    if (shouldHighlight) {
      const highlightedCode = simpleHighlight(originalCode, detectedLanguage);
      const fragment = toSafeFragment(highlightedCode, runtime);
      codeElement.textContent = '';
      if (fragment) codeElement.appendChild(fragment);
    }

    if (!preElement.classList.contains('with-code-scroll')) {
      const currentParent = codeElement.parentElement;
      if (!currentParent || !currentParent.classList.contains('code-scroll')) {
        const scrollWrap = runtime.createElement('div');
        if (!scrollWrap) return;
        scrollWrap.className = 'code-scroll';
        preElement.insertBefore(scrollWrap, codeElement);
        scrollWrap.appendChild(codeElement);
      }
      preElement.classList.add('with-code-scroll');
    }

    const scrollWrap = preElement.querySelector('.code-scroll');
    if (scrollWrap && !scrollWrap.classList.contains('code-with-gutter')) {
      scrollWrap.classList.add('code-with-gutter');
    }

    if (scrollWrap) {
      let gutter = scrollWrap.querySelector('.code-gutter');
      if (!gutter) {
        gutter = runtime.createElement('div');
        if (!gutter) return;
        gutter.className = 'code-gutter';
        gutter.setAttribute('aria-hidden', 'true');
        scrollWrap.insertBefore(gutter, codeElement);
      }

      const trimmed = originalCode.endsWith('\n') ? originalCode.slice(0, -1) : originalCode;
      const lineCount = trimmed ? (trimmed.match(/\n/g) || []).length + 1 : 1;
      const currentCount = gutter.childElementCount;
      if (currentCount !== lineCount) {
        const frag = runtime.createDocumentFragment();
        if (!frag) return;
        for (let i = 1; i <= lineCount; i++) {
          const s = runtime.createElement('span');
          if (!s) continue;
          s.textContent = String(i);
          frag.appendChild(s);
        }
        gutter.innerHTML = '';
        gutter.appendChild(frag);
      }

      const digits = String(lineCount).length;
      gutter.style.width = `${Math.max(2, digits + 1)}ch`;
    }

    let languageLabel = preElement.querySelector('.syntax-language-label');
    if (!languageLabel) {
      languageLabel = runtime.createElement('div');
      if (!languageLabel) return;
      languageLabel.className = 'syntax-language-label';
      preElement.appendChild(languageLabel);
    }

    const TXT_COPY = runtime.translate('code.copy', 'Copy');
    const TXT_COPIED = runtime.translate('code.copied', 'Copied');
    const TXT_FAILED = runtime.translate('code.failed', 'Failed');
    const TXT_ARIA = runtime.translate('code.copyAria', 'Copy code');

    const labelLanguage = shouldHighlight ? (detectedLanguage || explicitLanguage || '').toUpperCase() : 'PLAIN';
    languageLabel.dataset.lang = labelLanguage || 'PLAIN';
    languageLabel.setAttribute('role', 'button');
    languageLabel.setAttribute('tabindex', '0');
    languageLabel.setAttribute('aria-label', TXT_ARIA);
    languageLabel.textContent = labelLanguage || 'PLAIN';

    if (!languageLabel.dataset.bound) {
      const copyCode = async () => {
        const rawText = codeElement.textContent || '';
        const ok = await runtime.writeClipboardText(rawText);

        const old = languageLabel.dataset.lang || 'PLAIN';
        languageLabel.classList.add('is-copied');
        languageLabel.textContent = ok ? TXT_COPIED.toUpperCase() : TXT_FAILED.toUpperCase();
        runtime.setTimer(() => {
          languageLabel.classList.remove('is-copied');
          languageLabel.textContent = old;
        }, 1200);
      };

      languageLabel.addEventListener('mouseenter', () => {
        languageLabel.classList.add('is-hover');
        languageLabel.textContent = TXT_COPY.toUpperCase();
      });
      languageLabel.addEventListener('mouseleave', () => {
        languageLabel.classList.remove('is-hover');
        languageLabel.textContent = languageLabel.dataset.lang || 'PLAIN';
      });
      languageLabel.addEventListener('click', copyCode);
      languageLabel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyCode(); }
      });

      languageLabel.dataset.bound = '1';
    }
  });
}

export { simpleHighlight, detectLanguage };

export function createSafeHighlightFragment(code, language, options = {}) {
  return toSafeFragment(simpleHighlight(code || '', language || 'plain'), options);
}

export function highlightCode(code, language) {
  return simpleHighlight(code, language);
}

export function applySyntaxHighlighting(code, language) {
  return simpleHighlight(code, language);
}
