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
const TOKEN_CLASS_MAP = new Map([
  ['hljs-keyword', 'syntax-keyword'],
  ['hljs-built_in', 'syntax-keyword'],
  ['hljs-literal', 'syntax-keyword'],
  ['hljs-type', 'syntax-keyword'],
  ['hljs-symbol', 'syntax-keyword'],
  ['hljs-name', 'syntax-tag'],
  ['hljs-tag', 'syntax-tag'],
  ['hljs-attr', 'syntax-property'],
  ['hljs-attribute', 'syntax-property'],
  ['hljs-property', 'syntax-property'],
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
  ['hljs-operator', 'syntax-operator'],
  ['hljs-punctuation', 'syntax-punctuation'],
  ['hljs-bullet', 'syntax-punctuation'],
  ['hljs-code', 'syntax-code'],
  ['hljs-emphasis', 'syntax-emphasis'],
  ['hljs-strong', 'syntax-strong'],
  ['hljs-link', 'syntax-link'],
  ['hljs-deletion', 'syntax-deletion'],
  ['hljs-addition', 'syntax-addition'],
  ['hljs-formula', 'syntax-formula']
]);

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
    const value = TOKEN_CLASS_MAP.get(cls);
    if (value && !mapped.includes(value)) mapped.push(value);
  });
  return mapped;
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

function toSafeFragment(html) {
  const allowedTag = 'SPAN';
  const allowedAttr = 'class';
  const classPrefix = 'syntax-';

  try {
    if (typeof window !== 'undefined' && 'Sanitizer' in window && typeof Element.prototype.setHTML === 'function') {
      const s = new window.Sanitizer({
        allowElements: ['span'],
        allowAttributes: {'class': ['span']},
      });
      const tmp = document.createElement('div');
      tmp.setHTML(String(html || ''), { sanitizer: s });
      tmp.querySelectorAll('*').forEach((el) => {
        if (el.tagName !== allowedTag) {
          el.replaceWith(document.createTextNode(el.textContent || ''));
          return;
        }
        const classes = (el.getAttribute('class') || '').split(/\s+/).filter(c => c && c.startsWith(classPrefix));
        if (classes.length) el.setAttribute('class', classes.join(' ')); else el.removeAttribute('class');
        for (const attr of Array.from(el.attributes)) {
          if (attr.name !== allowedAttr) el.removeAttribute(attr.name);
        }
      });
      const frag = document.createDocumentFragment();
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
  const frag = document.createDocumentFragment();
  const stack = [frag];
  let i = 0;
  const len = (html || '').length;
  const src = String(html || '');

  const appendText = (text) => {
    if (!text) return;
    stack[stack.length - 1].appendChild(document.createTextNode(decodeEntities(text)));
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
        classes = raw.split(/\s+/).filter(c => c && c.startsWith(classPrefix));
      }
      const el = document.createElement('span');
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

export function initSyntaxHighlighting(root = document) {
  const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
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
      codeElement.textContent = '';
      codeElement.appendChild(toSafeFragment(highlightedCode));
    }

    if (!preElement.classList.contains('with-code-scroll')) {
      const currentParent = codeElement.parentElement;
      if (!currentParent || !currentParent.classList.contains('code-scroll')) {
        const scrollWrap = document.createElement('div');
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
        gutter = document.createElement('div');
        gutter.className = 'code-gutter';
        gutter.setAttribute('aria-hidden', 'true');
        scrollWrap.insertBefore(gutter, codeElement);
      }

      const trimmed = originalCode.endsWith('\n') ? originalCode.slice(0, -1) : originalCode;
      const lineCount = trimmed ? (trimmed.match(/\n/g) || []).length + 1 : 1;
      const currentCount = gutter.childElementCount;
      if (currentCount !== lineCount) {
        const frag = document.createDocumentFragment();
        for (let i = 1; i <= lineCount; i++) {
          const s = document.createElement('span');
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
      languageLabel = document.createElement('div');
      languageLabel.className = 'syntax-language-label';
      preElement.appendChild(languageLabel);
    }

    const getT = (key, fallback) => {
      try { return (window.__press_t && typeof window.__press_t === 'function') ? window.__press_t(key) : fallback; } catch (_) { return fallback; }
    };
    const TXT_COPY = getT('code.copy', 'Copy');
    const TXT_COPIED = getT('code.copied', 'Copied');
    const TXT_FAILED = getT('code.failed', 'Failed');
    const TXT_ARIA = getT('code.copyAria', 'Copy code');

    const labelLanguage = shouldHighlight ? (detectedLanguage || explicitLanguage || '').toUpperCase() : 'PLAIN';
    languageLabel.dataset.lang = labelLanguage || 'PLAIN';
    languageLabel.setAttribute('role', 'button');
    languageLabel.setAttribute('tabindex', '0');
    languageLabel.setAttribute('aria-label', TXT_ARIA);
    languageLabel.textContent = labelLanguage || 'PLAIN';

    if (!languageLabel.dataset.bound) {
      const copyCode = async () => {
        const rawText = codeElement.textContent || '';
        let ok = false;
        if (navigator.clipboard && window.isSecureContext) {
          try { await navigator.clipboard.writeText(rawText); ok = true; } catch (_) { ok = false; }
        }
        if (!ok) {
          try {
            const ta = document.createElement('textarea');
            ta.value = rawText;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            ok = document.execCommand('copy');
            document.body.removeChild(ta);
          } catch (_) { ok = false; }
        }

        const old = languageLabel.dataset.lang || 'PLAIN';
        languageLabel.classList.add('is-copied');
        languageLabel.textContent = ok ? TXT_COPIED.toUpperCase() : TXT_FAILED.toUpperCase();
        setTimeout(() => {
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

export function createSafeHighlightFragment(code, language) {
  return toSafeFragment(simpleHighlight(code || '', language || 'plain'));
}

export function highlightCode(code, language) {
  return simpleHighlight(code, language);
}

export function applySyntaxHighlighting(code, language) {
  return simpleHighlight(code, language);
}
