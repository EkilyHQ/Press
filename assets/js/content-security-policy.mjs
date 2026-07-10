const COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES = Object.freeze([
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http: https:",
  "media-src 'self' data: blob: http: https:",
  "font-src 'self' data: blob: http: https:"
]);

const REMOTE_CONNECT_SOURCES = "'self' https: http://localhost:* http://127.0.0.1:*";
const ASCII_WHITESPACE = new Set(['\t', '\n', '\f', '\r', ' ']);
const INVALID_ATTRIBUTE_NAME_CHARACTERS = new Set(["'", '"', '<', '>', '\0']);
const INVALID_UNQUOTED_ATTRIBUTE_VALUE_CHARACTERS = new Set(["'", '"', '`', '=', '<', '>', '\0']);

function isTagNameBoundary(char) {
  return char === '>' || char === '/' || ASCII_WHITESPACE.has(char);
}

function startsWithTagName(text, offset, name) {
  const candidate = text.slice(offset, offset + name.length);
  return candidate.toLowerCase() === name && isTagNameBoundary(text[offset + name.length]);
}

function isAsciiWhitespace(char) {
  return ASCII_WHITESPACE.has(char);
}

export function parseHtmlAttributes(source, label = 'HTML tag') {
  let text = String(source || '');
  if (text.startsWith('<')) {
    const nameStart = text[1] === '/' ? 2 : 1;
    const end = findTagEnd(text, nameStart, label, 'tag-name');
    if (end !== text.length - 1) throw new Error(`${label} contains content after its closing bracket`);
    let nameEnd = nameStart;
    while (nameEnd < end && !isAsciiWhitespace(text[nameEnd]) && !['/', '>'].includes(text[nameEnd])) {
      nameEnd += 1;
    }
    if (nameEnd === nameStart) throw new Error(`${label} does not contain a tag name`);
    text = text.slice(nameEnd, end);
  }
  const attributes = new Map();
  let cursor = 0;
  while (cursor < text.length) {
    while (cursor < text.length && isAsciiWhitespace(text[cursor])) cursor += 1;
    if (cursor >= text.length) break;
    if (text[cursor] === '/') {
      cursor += 1;
      while (cursor < text.length && isAsciiWhitespace(text[cursor])) cursor += 1;
      if (cursor !== text.length) throw new Error(`${label} contains content after a self-closing marker`);
      break;
    }

    const nameStart = cursor;
    while (cursor < text.length && !isAsciiWhitespace(text[cursor]) && text[cursor] !== '=' && text[cursor] !== '/') {
      if (INVALID_ATTRIBUTE_NAME_CHARACTERS.has(text[cursor])) {
        throw new Error(`${label} contains a malformed attribute name`);
      }
      cursor += 1;
    }
    if (cursor === nameStart) throw new Error(`${label} contains an empty attribute name`);
    const name = text.slice(nameStart, cursor).toLowerCase();
    while (cursor < text.length && isAsciiWhitespace(text[cursor])) cursor += 1;

    let value = '';
    if (text[cursor] === '=') {
      cursor += 1;
      while (cursor < text.length && isAsciiWhitespace(text[cursor])) cursor += 1;
      if (cursor >= text.length) throw new Error(`${label} contains an attribute without a value`);
      const quote = text[cursor] === '"' || text[cursor] === "'" ? text[cursor] : '';
      if (quote) {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < text.length && text[cursor] !== quote) cursor += 1;
        if (cursor >= text.length) throw new Error(`${label} contains an unterminated quoted attribute`);
        value = text.slice(valueStart, cursor);
        cursor += 1;
      } else {
        const valueStart = cursor;
        while (cursor < text.length && !isAsciiWhitespace(text[cursor])) {
          if (INVALID_UNQUOTED_ATTRIBUTE_VALUE_CHARACTERS.has(text[cursor])) {
            throw new Error(`${label} contains a malformed unquoted value`);
          }
          cursor += 1;
        }
        value = text.slice(valueStart, cursor);
        if (!value) throw new Error(`${label} contains an empty unquoted value`);
      }
    }
    if (!attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
}

export function readHtmlAttribute(source, name) {
  return parseHtmlAttributes(source).get(String(name || '').toLowerCase()) || '';
}

function skipHtmlComment(text, offset, label) {
  if (text[offset] === '>') return offset + 1;
  const normalEnd = text.indexOf('-->', offset);
  const bangEnd = text.indexOf('--!>', offset);
  const ends = [normalEnd, bangEnd].filter((index) => index >= 0);
  if (ends.length === 0) throw new Error(`${label} contains an unterminated HTML comment`);
  const end = Math.min(...ends);
  const nested = text.indexOf('<!--', offset);
  if (nested >= 0 && nested < end) throw new Error(`${label} contains an unsupported nested HTML comment`);
  return end + (end === bangEnd ? 4 : 3);
}

function findTagEnd(text, offset, label, initialState = 'before-attribute') {
  let cursor = offset;
  let state = initialState;
  while (cursor < text.length) {
    const char = text[cursor];
    if (state === 'tag-name') {
      if (isAsciiWhitespace(char)) state = 'before-attribute';
      else if (char === '>') return cursor;
      else if (char === '/') state = 'self-closing';
      cursor += 1;
      continue;
    }
    if (state === 'before-attribute') {
      if (isAsciiWhitespace(char)) cursor += 1;
      else if (char === '>') return cursor;
      else if (char === '/') {
        state = 'self-closing';
        cursor += 1;
      } else {
        state = 'attribute-name';
      }
      continue;
    }
    if (state === 'attribute-name') {
      if (isAsciiWhitespace(char)) state = 'after-attribute-name';
      else if (char === '=') state = 'before-attribute-value';
      else if (char === '>') return cursor;
      else if (char === '/') state = 'self-closing';
      cursor += 1;
      continue;
    }
    if (state === 'after-attribute-name') {
      if (isAsciiWhitespace(char)) cursor += 1;
      else if (char === '=') {
        state = 'before-attribute-value';
        cursor += 1;
      } else if (char === '>') return cursor;
      else if (char === '/') {
        state = 'self-closing';
        cursor += 1;
      } else {
        state = 'attribute-name';
      }
      continue;
    }
    if (state === 'before-attribute-value') {
      if (isAsciiWhitespace(char)) cursor += 1;
      else if (char === '"') {
        state = 'double-quoted-value';
        cursor += 1;
      } else if (char === "'") {
        state = 'single-quoted-value';
        cursor += 1;
      } else if (char === '>') return cursor;
      else state = 'unquoted-value';
      continue;
    }
    if (state === 'double-quoted-value' || state === 'single-quoted-value') {
      const quote = state === 'double-quoted-value' ? '"' : "'";
      if (char === quote) state = 'after-quoted-value';
      cursor += 1;
      continue;
    }
    if (state === 'after-quoted-value') {
      if (isAsciiWhitespace(char)) {
        state = 'before-attribute';
        cursor += 1;
      } else if (char === '/') {
        state = 'self-closing';
        cursor += 1;
      } else if (char === '>') return cursor;
      else state = 'before-attribute';
      continue;
    }
    if (state === 'unquoted-value') {
      if (isAsciiWhitespace(char)) state = 'before-attribute';
      else if (char === '>') return cursor;
      cursor += 1;
      continue;
    }
    if (state === 'self-closing') {
      if (char === '>') return cursor;
      state = 'before-attribute';
      continue;
    }
  }
  throw new Error(`${label} contains an unterminated HTML tag`);
}

function findScriptEndTag(text, offset, label) {
  let cursor = offset;
  while (cursor < text.length) {
    const start = text.indexOf('<', cursor);
    if (start < 0) throw new Error(`${label} contains a script element without an end tag`);
    if (text[start + 1] === '/' && startsWithTagName(text, start + 2, 'script')) {
      return {
        start,
        end: findTagEnd(text, start + '</script'.length, label)
      };
    }
    cursor = start + 1;
  }
  throw new Error(`${label} contains a script element without an end tag`);
}

export function collectHtmlScriptElements(source, label = 'HTML') {
  const text = String(source || '');
  const elements = [];
  let cursor = 0;
  while (cursor < text.length) {
    const tagStart = text.indexOf('<', cursor);
    if (tagStart < 0) break;
    if (text.startsWith('<!--', tagStart)) {
      cursor = skipHtmlComment(text, tagStart + 4, label);
      continue;
    }
    if (text.slice(tagStart, tagStart + '<!doctype html>'.length).toLowerCase() === '<!doctype html>') {
      cursor = tagStart + '<!doctype html>'.length;
      continue;
    }
    if (text[tagStart + 1] === '!' || text[tagStart + 1] === '?') {
      throw new Error(`${label} contains unsupported HTML declaration syntax`);
    }
    if (startsWithTagName(text, tagStart + 1, 'script')) {
      const nameEnd = tagStart + 1 + 'script'.length;
      const openEnd = findTagEnd(text, nameEnd, label);
      const close = findScriptEndTag(text, openEnd + 1, label);
      const rawAttributes = text.slice(nameEnd, openEnd);
      elements.push({
        attributes: rawAttributes,
        attributeMap: parseHtmlAttributes(rawAttributes, `${label} script tag`),
        source: text.slice(openEnd + 1, close.start),
        start: tagStart,
        end: close.end + 1
      });
      cursor = close.end + 1;
      continue;
    }
    if (text[tagStart + 1] === '/' && startsWithTagName(text, tagStart + 2, 'script')) {
      throw new Error(`${label} contains an unmatched script end tag`);
    }
    const next = text[tagStart + 1] || '';
    if (!/[A-Za-z!?/]/u.test(next)) {
      cursor = tagStart + 1;
      continue;
    }
    const nameStart = text[tagStart + 1] === '/' ? tagStart + 2 : tagStart + 1;
    cursor = findTagEnd(text, nameStart, label, 'tag-name') + 1;
  }
  return elements;
}

export const EDITOR_INLINE_SCRIPT_SHA256_SOURCES = Object.freeze([
  'sha256-7fumrKYNuNbU1bMOp1lfrFwq59C4I7qICkA4xSNfefQ=',
  'sha256-78pVE5dzddjfImBn8Dh7Xu8/uUk4AqWtBgr0ofkwahs='
]);

function buildContentSecurityPolicy({ connectSources, frameSources, inlineScriptSources = [] }) {
  const scriptSources = ["'self'", ...inlineScriptSources.map((source) => `'${source}'`)].join(' ');
  return [
    COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES[0],
    COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES[1],
    COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES[2],
    `script-src ${scriptSources}`,
    ...COMMON_CONTENT_SECURITY_POLICY_DIRECTIVES.slice(3),
    `connect-src ${connectSources}`,
    `frame-src ${frameSources}`,
    "worker-src 'none'",
    "form-action 'self'"
  ].join('; ');
}

export const PUBLIC_CONTENT_SECURITY_POLICY = buildContentSecurityPolicy({
  connectSources: REMOTE_CONNECT_SOURCES,
  frameSources: "'none'"
});

export const EDITOR_CONTENT_SECURITY_POLICY = buildContentSecurityPolicy({
  connectSources: REMOTE_CONNECT_SOURCES,
  frameSources: "'self'",
  inlineScriptSources: EDITOR_INLINE_SCRIPT_SHA256_SOURCES
});

export const EDITOR_PREVIEW_CONTENT_SECURITY_POLICY = buildContentSecurityPolicy({
  connectSources: "'self'",
  frameSources: "'none'"
});

export const MATERIALIZED_CONTENT_SECURITY_POLICIES = Object.freeze({
  'index.html': PUBLIC_CONTENT_SECURITY_POLICY,
  'index_editor.html': EDITOR_CONTENT_SECURITY_POLICY,
  'index_editor_preview.html': EDITOR_PREVIEW_CONTENT_SECURITY_POLICY
});
