// Safe URL and rendered-Markdown HTML helpers.
// Content root helper: default to 'wwwroot' but allow runtime override via window.__press_content_root
export function getContentRoot() {
  try {
    const raw = (typeof window !== 'undefined' && window.__press_content_root) ? String(window.__press_content_root) : 'wwwroot';
    return raw.replace(/^\/+|\/+$/g, '');
  } catch (_) {
    return 'wwwroot';
  }
}

function decodeUrlEntitiesForSchemeCheck(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };
  return String(value || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][\w:-]*);/g, (match, entity) => {
    if (!entity) return match;
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const codePoint = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      if (!Number.isFinite(codePoint) || codePoint < 0) return match;
      try { return String.fromCodePoint(codePoint); } catch (_) { return match; }
    }
    const decoded = named[entity.toLowerCase()];
    return typeof decoded === 'string' ? decoded : match;
  });
}

function normalizeUrlForSchemeCheck(value) {
  return decodeUrlEntitiesForSchemeCheck(value).replace(/[\u0000-\u0020\u007f]+/g, '');
}

function getUrlSchemeFromNormalized(value) {
  const proto = String(value || '').toLowerCase().match(/^([a-z][a-z0-9+.-]*):/);
  return proto ? proto[1] : '';
}

function getUrlSchemeForCheck(value) {
  return getUrlSchemeFromNormalized(normalizeUrlForSchemeCheck(value));
}

function getWindowProtocol() {
  try {
    const protocol = window && window.location && window.location.protocol;
    return protocol || 'https:';
  } catch (_) {
    return 'https:';
  }
}

function getDocumentBaseUri() {
  try {
    if (typeof document !== 'undefined' && document.baseURI) return document.baseURI;
  } catch (_) {}
  try {
    if (typeof location !== 'undefined' && location.origin) return `${location.origin}/`;
  } catch (_) {}
  return 'https://example.test/';
}

export function sanitizeUrl(url) {
  const s = String(url || '').trim();
  const p = getUrlSchemeForCheck(s);
  if (!p) return s; // relative URL
  return ['http', 'https', 'mailto', 'tel'].includes(p) ? s : '#';
}

function sanitizeUrlForDomAttribute(url) {
  const s = String(url || '').trim();
  const normalized = normalizeUrlForSchemeCheck(s);
  const p = getUrlSchemeFromNormalized(normalized);
  if (!p) return s;
  return ['http', 'https', 'mailto', 'tel'].includes(p) ? normalized : '#';
}

// Stricter URL sanitizer for image/media attributes.
// Allows only: relative URLs, http(s), blob:, and data:image/* (excluding SVG).
export function sanitizeImageUrl(url) {
  try {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const protocolRelative = raw.startsWith('//') ? `${getWindowProtocol()}${raw}` : raw;
    const normalized = normalizeUrlForSchemeCheck(protocolRelative);
    const scheme = getUrlSchemeFromNormalized(normalized);
    if (!scheme) return protocolRelative; // relative URL

    if (scheme === 'http' || scheme === 'https' || scheme === 'blob') {
      try { return new URL(normalized, getDocumentBaseUri()).href; } catch (_) { return normalized; }
    }

    if (scheme === 'data') {
      const body = normalized.slice(normalized.indexOf(':') + 1);
      const match = body.match(/^image\/([A-Za-z0-9.+-]+)[;,]/);
      if (!match) return '';
      const type = (match[1] || '').toLowerCase();
      const allowed = new Set(['png', 'jpeg', 'jpg', 'gif', 'webp', 'avif', 'bmp', 'x-icon']);
      return allowed.has(type) ? normalized : '';
    }

    return '';
  } catch (_) {
    return '';
  }
}

export function resolveImageSrc(src, baseDir) {
  const s = String(src || '').trim();
  if (!s) return '';
  if (getUrlSchemeForCheck(s)) return sanitizeUrl(s);
  if (s.startsWith('/') || s.startsWith('#')) return s;

  const stripSlashes = (val) => String(val || '').replace(/^\/+|\/+$/g, '');
  const normalizedBase = stripSlashes(baseDir);
  const normalizedRoot = stripSlashes(getContentRoot());
  const candidate = s.replace(/^\/+/, '');

  // Already normalized relative to either the active base directory or content root
  if (normalizedBase && candidate.startsWith(`${normalizedBase}/`)) return candidate;
  if (normalizedRoot && candidate.startsWith(`${normalizedRoot}/`)) return candidate;

  const base = (normalizedBase ? `${normalizedBase}/` : '');
  try {
    const u = new URL(candidate, `${location.origin}/${base}`);
    return u.pathname.replace(/^\/+/, '');
  } catch (_) {
    return `${base}${candidate}`.replace(/\/+/, '/');
  }
}

// Tags and attributes emitted by the Markdown renderer itself. User-authored
// tags are escaped before rendering and are not admitted through this path.
const __NS_RENDERED_MARKDOWN_TAGS = new Set([
  'a','blockquote','br','code','del','div','em','h1','h2','h3','h4','h5','h6',
  'hr','img','input','label','li','ol','p','pre','source','span','strong',
  'table','tbody','td','th','thead','tr','ul','video'
]);
const __NS_RENDERED_MARKDOWN_VOID_TAGS = new Set(['br','hr','img','input','source']);
const __NS_RENDERED_MARKDOWN_GLOBAL_ATTRS = new Set(['aria-hidden','aria-label','class','data-callout','for','id','role','title']);
const __NS_RENDERED_MARKDOWN_TAG_ATTRS = {
  a: new Set(['href']),
  code: new Set(['class']),
  div: new Set(['class','data-callout','role']),
  h1: new Set(['id']),
  h2: new Set(['id']),
  h3: new Set(['id']),
  h4: new Set(['id']),
  h5: new Set(['id']),
  h6: new Set(['id']),
  img: new Set(['alt','src','title']),
  input: new Set(['checked','disabled','id','type']),
  label: new Set(['for']),
  ol: new Set(['start']),
  pre: new Set(['class']),
  source: new Set(['src','type']),
  span: new Set(['aria-hidden','class']),
  video: new Set(['aria-label','class','controls','playsinline','poster','preload','title'])
};

function __press_isAllowedAttr(tag, attr) {
  if (!attr) return false;
  const a = String(attr).toLowerCase();
  if (a.startsWith('on')) return false;
  if (__NS_RENDERED_MARKDOWN_GLOBAL_ATTRS.has(a)) return true;
  const spec = __NS_RENDERED_MARKDOWN_TAG_ATTRS[tag];
  return !!(spec && spec.has(a));
}

function __press_rewriteHref(val, baseDir) {
  const s = String(val || '').trim();
  if (!s) return s;
  if (s.startsWith('#') || s.startsWith('?')) return s;
  const scheme = getUrlSchemeForCheck(s);
  const checked = sanitizeUrlForDomAttribute(s);
  if (checked === '#') return '#';
  if (scheme) return checked;
  if (s.startsWith('/')) return s;
  return resolveImageSrc(s, baseDir);
}

function __press_rewriteSrc(val, baseDir) {
  const s = String(val || '').trim();
  if (!s) return s;
  const scheme = getUrlSchemeForCheck(s);
  if (scheme) return sanitizeImageUrl(s) || '#';
  if (s.startsWith('/') || s.startsWith('#')) return s;
  return resolveImageSrc(s, baseDir);
}

// Safely set controlled renderer markup into a target element without using innerHTML.
export function setSafeHtml(target, html, baseDir, options = {}) {
  if (!target) return;
  const input = String(html || '');
  const opts = options && typeof options === 'object' ? options : {};
  if (!opts.alreadySanitized) {
    try { target.textContent = input; } catch (_) {}
    return;
  }
  // Build a DOM fragment by tokenizing the renderer output and creating
  // elements/attributes programmatically.
  try {
    const safeHtml = input;

    // Minimal HTML entity unescape for attribute values we set via setAttribute.
    const unescapeHtml = (s) => String(s || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');

    // Decode HTML entities for text nodes so Markdown entities render as characters.
    const decodeEntities = (() => {
      const NAMED_ENTITIES = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
        nbsp: '\u00A0',
      };

      return (s) => {
        const str = String(s || '');
        if (!str) return '';

        return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][\w:-]*);/g, (m, entity) => {
          if (!entity) return m;
          if (entity[0] === '#') {
            const isHex = entity[1] === 'x' || entity[1] === 'X';
            const num = isHex ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            if (!Number.isFinite(num) || num < 0) return m;
            try {
              return String.fromCodePoint(num);
            } catch (_) {
              return m;
            }
          }

          const named = NAMED_ENTITIES[entity.toLowerCase()];
          return typeof named === 'string' ? named : m;
        });
      };
    })();

    const frag = document.createDocumentFragment();
    const stack = [];

    const appendNode = (node) => {
      const parent = stack.length ? stack[stack.length - 1] : frag;
      parent.appendChild(node);
    };

    // Tokenize tags. Any unexpected tag is preserved as text.
    const tagRe = /<\/?([a-zA-Z][\w:-]*)\b([^>]*)>/g;
    let last = 0;
    let m;
    while ((m = tagRe.exec(safeHtml))) {
      // Text before the tag
      const text = safeHtml.slice(last, m.index);
      if (text) appendNode(document.createTextNode(decodeEntities(text)));
      last = tagRe.lastIndex;

      const raw = m[0];
      const tag = (m[1] || '').toLowerCase();
      const attrs = m[2] || '';
      const isClose = /^<\//.test(raw);
      const isVoid = __NS_RENDERED_MARKDOWN_VOID_TAGS.has(tag);

      if (isClose) {
        // Pop to the nearest matching tag if present
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tagName && stack[i].tagName.toLowerCase() === tag) {
            stack.length = i; // pop everything after i
            break;
          }
        }
        continue;
      }

      if (!__NS_RENDERED_MARKDOWN_TAGS.has(tag)) {
        appendNode(document.createTextNode(raw));
        continue;
      }

      const el = document.createElement(tag);

      // Apply allowed attributes with URL rewriting
      const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
      let a;
      while ((a = attrRe.exec(attrs))) {
        const name = (a[1] || '').toLowerCase();
        if (!name || name.startsWith('on')) continue;
        if (!__press_isAllowedAttr(tag, name)) continue;
        const rawVal = a[3] ?? a[4] ?? a[5] ?? '';
        let val = unescapeHtml(rawVal);
        if (name === 'href') val = __press_rewriteHref(val, baseDir);
        else if (name === 'src' || name === 'poster') val = __press_rewriteSrc(val, baseDir);
        try { el.setAttribute(name, val); } catch (_) {}
      }

      appendNode(el);
      if (!isVoid) stack.push(el);
    }
    // Remainder after the last tag
    const tail = safeHtml.slice(last);
    if (tail) appendNode(document.createTextNode(decodeEntities(tail)));

    target.replaceChildren(frag);
  } catch (_) {
    // Last resort: never inject as HTML; show as text
    try { target.textContent = input; } catch (__) {}
  }
}
