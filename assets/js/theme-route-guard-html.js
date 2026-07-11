const ROUTE_KEYS = new Set(['tab', 'id']);
const ROUTE_ATTRIBUTES = new Set(['href', 'xlink:href', 'src', 'srcset', 'action', 'poster', 'formaction', 'cite']);
const JAVASCRIPT_TYPES = new Set([
  '',
  'module',
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript'
]);

function safeString(value) {
  return value == null ? '' : String(value);
}

function normalizeBrowserUrlString(value) {
  return safeString(value).replace(/[\t\n\r]/gu, '');
}

function decodeHtmlAttributeValue(value) {
  return safeString(value)
    .replace(/&#(x[0-9a-f]+|\d+);?/giu, (entity, raw) => {
      const code = raw.toLowerCase().startsWith('x') ? Number.parseInt(raw.slice(1), 16) : Number.parseInt(raw, 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/&(Tab|NewLine);/gu, (_, name) => (name === 'Tab' ? '\t' : '\n'))
    .replace(/&(?:amp|equals|quest);?/giu, (entity) => {
      const name = entity.replace(/[&;]/gu, '').toLowerCase();
      if (name === 'amp') return '&';
      if (name === 'equals') return '=';
      if (name === 'quest') return '?';
      return entity;
    });
}

function decodeRouteKey(value) {
  const text = safeString(value).trim();
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function isExternalUrlPrefix(value) {
  const text = normalizeBrowserUrlString(value).trim();
  return /^[a-z][a-z0-9+.-]*:/iu.test(text) || text.startsWith('//');
}

function candidateContainsRelativeRoute(value) {
  const text = normalizeBrowserUrlString(value).trim();
  if (!text || isExternalUrlPrefix(text)) return false;
  const routeQuery = /[?&]([^=&#\s]+)\s*=/gu;
  let match = routeQuery.exec(text);
  while (match) {
    if (ROUTE_KEYS.has(decodeRouteKey(match[1]))) return true;
    match = routeQuery.exec(text);
  }
  return false;
}

function attributeContainsRelativeRoute(name, value) {
  const decoded = decodeHtmlAttributeValue(value);
  if (name === 'srcset') {
    return decoded.split(',').some((candidate) => candidateContainsRelativeRoute(candidate.trim().split(/\s+/u)[0]));
  }
  return candidateContainsRelativeRoute(decoded);
}

function isSpace(char) {
  return Boolean(char && /\s/u.test(char));
}

function findTagEnd(source, start) {
  let quote = '';
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '>') return index;
  }
  return source.length - 1;
}

function parseStartTag(source, start) {
  let index = start + 1;
  while (isSpace(source[index])) index += 1;
  const nameStart = index;
  while (index < source.length && /[A-Za-z0-9:-]/u.test(source[index])) index += 1;
  const name = source.slice(nameStart, index).toLowerCase();
  if (!name) return null;
  const attributes = [];
  while (index < source.length) {
    while (isSpace(source[index]) || source[index] === '/') index += 1;
    if (source[index] === '>') return { name, attributes, end: index };
    if (!source[index]) break;
    const attrStart = index;
    while (index < source.length && !/[\s=/>]/u.test(source[index])) index += 1;
    const attrName = source.slice(attrStart, index).toLowerCase();
    while (isSpace(source[index])) index += 1;
    let value = '';
    if (source[index] === '=') {
      index += 1;
      while (isSpace(source[index])) index += 1;
      const quote = source[index] === '"' || source[index] === "'" ? source[index] : '';
      if (quote) {
        index += 1;
        const valueStart = index;
        while (index < source.length && source[index] !== quote) index += 1;
        value = source.slice(valueStart, index);
        if (source[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (index < source.length && !/[\s>]/u.test(source[index])) index += 1;
        value = source.slice(valueStart, index);
      }
    }
    if (attrName) attributes.push({ name: attrName, value });
  }
  return { name, attributes, end: findTagEnd(source, index) };
}

function findClosingScript(source, start) {
  const lower = source.toLowerCase();
  let index = lower.indexOf('</script', start);
  while (index >= 0) {
    const boundary = source[index + 8];
    if (!boundary || boundary === '>' || isSpace(boundary)) {
      return { start: index, end: findTagEnd(source, index + 8) };
    }
    index = lower.indexOf('</script', index + 8);
  }
  return null;
}

function scriptTypeAllowsScan(attributes) {
  const type = attributes.find((attribute) => attribute.name === 'type');
  const normalized = decodeHtmlAttributeValue(type ? type.value : '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
  return JAVASCRIPT_TYPES.has(normalized);
}

export function isV4HtmlRouteGuardSource(path, source) {
  const normalizedPath = safeString(path).toLowerCase();
  if (/\.(?:html?|svg)$/u.test(normalizedPath)) return true;
  if (normalizedPath && /\.[a-z0-9]+$/u.test(normalizedPath)) return false;
  return /<(?:!--|[A-Za-z][A-Za-z0-9:-]*(?:\s|>|\/))/u.test(safeString(source));
}

export function containsForbiddenV4HtmlRouteConstruction(source, options = {}) {
  const text = safeString(source);
  const scanJavaScript = typeof options.scanJavaScript === 'function' ? options.scanJavaScript : () => false;
  let index = 0;
  while (index < text.length) {
    const open = text.indexOf('<', index);
    if (open < 0) break;
    if (text.startsWith('<!--', open)) {
      const close = text.indexOf('-->', open + 4);
      index = close < 0 ? text.length : close + 3;
      continue;
    }
    if (text[open + 1] === '/' || text[open + 1] === '!' || text[open + 1] === '?') {
      index = findTagEnd(text, open + 1) + 1;
      continue;
    }
    const tag = parseStartTag(text, open);
    if (!tag) {
      index = open + 1;
      continue;
    }
    for (const attribute of tag.attributes) {
      if (
        (ROUTE_ATTRIBUTES.has(attribute.name) || /^data-[a-z0-9_-]*href$/u.test(attribute.name)) &&
        attributeContainsRelativeRoute(attribute.name, attribute.value)
      ) {
        return true;
      }
      if (/^on[a-z][\w:-]*$/u.test(attribute.name) && scanJavaScript(decodeHtmlAttributeValue(attribute.value))) {
        return true;
      }
    }
    if (tag.name === 'script') {
      const closing = findClosingScript(text, tag.end + 1);
      const bodyEnd = closing ? closing.start : text.length;
      if (scriptTypeAllowsScan(tag.attributes) && scanJavaScript(text.slice(tag.end + 1, bodyEnd))) {
        return true;
      }
      index = closing ? closing.end + 1 : text.length;
      continue;
    }
    index = tag.end + 1;
  }
  return false;
}
