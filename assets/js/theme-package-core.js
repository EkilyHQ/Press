import { loadPressSystemManifest, satisfiesSemverRange } from './press-version.js';
import {
  PRESS_THEME_CONTRACT,
  getDefaultThemeStyles,
  getRequiredThemeComponents,
  getRequiredThemeContentShapes,
  getRequiredThemeRegions,
  getRequiredThemeViews,
  getOptionalThemeViews,
  getThemeArchiveAllowedExtensions,
  getThemeTextExtensions,
  isPressThemeContractVersionSupported
} from './theme-contract-surface.mjs';
import { unzipSync, strFromU8 } from './vendor/fflate.browser.js';

export const REQUIRED_THEME_CONTRACT_VERSION = PRESS_THEME_CONTRACT.contractVersion;

const THEME_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const THEME_RELEASE_ASSET_PATTERN = /^press-theme-[a-z0-9_-]+-v\d+\.\d+\.\d+\.zip$/i;
const THEME_ARCHIVE_ALLOWED_EXTENSIONS = new Set(getThemeArchiveAllowedExtensions());
const THEME_TEXT_EXTENSIONS = new Set(getThemeTextExtensions());
const DEFAULT_THEME_STYLES = getDefaultThemeStyles();
const REQUIRED_THEME_VIEWS = getRequiredThemeViews();
const OPTIONAL_THEME_VIEWS = getOptionalThemeViews();
const REQUIRED_THEME_REGIONS = getRequiredThemeRegions();
const REQUIRED_THEME_COMPONENTS = getRequiredThemeComponents();
const REQUIRED_THEME_CONTENT_SHAPES = getRequiredThemeContentShapes();
const ROUTE_HELPER_CONTRACT_VERSION = 4;
const STRING_LITERAL_PATTERN = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;
const ROUTE_QUERY_PATTERN = /[?&](?:tab|id)\s*=/g;
const ROUTE_KEY_OBJECT_INIT_PATTERN = /(?:^|[,{]\s*)(?:(['"`])(?:tab|id)\1|(?:tab|id))\s*:/;
const ROUTE_KEY_OBJECT_SHORTHAND_PATTERN = /(?:^|[,{]\s*)(?:tab|id)\s*(?=[,}])/;
const ROUTE_KEY_ARRAY_INIT_PATTERN = /\[\s*(['"`])(?:tab|id)\1\s*,/;
const SPLIT_ROUTE_QUERY_LITERAL_PATTERN = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?[?&])\1\s*\+\s*(?:(['"`])(?:tab|id)\s*=\3|(['"`])(?:tab|id)\4\s*\+\s*(['"`])=\5)/g;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/;
const MEMBER_EXPRESSION_PATTERN_SOURCE = `(?:this|${IDENTIFIER_PATTERN.source})(?:\\s*\\.\\s*${IDENTIFIER_PATTERN.source})+`;
const ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE = `(?:"(?:tab|id)"|'(?:tab|id)'|\`(?:tab|id)\`)`;

export function getBuffer(view) {
  if (view instanceof Uint8Array) {
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  if (view instanceof ArrayBuffer) return view.slice(0);
  if (view && view.buffer instanceof ArrayBuffer) {
    const buf = view.buffer;
    const { byteOffset = 0, byteLength = buf.byteLength } = view;
    return buf.slice(byteOffset, byteOffset + byteLength);
  }
  return new ArrayBuffer(0);
}

export async function digestSha256(buffer) {
  if (!(buffer instanceof ArrayBuffer)) buffer = getBuffer(buffer);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const view = new DataView(hash);
  const parts = [];
  for (let i = 0; i < view.byteLength; i += 4) {
    parts.push(('00000000' + view.getUint32(i).toString(16)).slice(-8));
  }
  return parts.join('');
}

export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function safeString(value) {
  return value == null ? '' : String(value);
}

function extname(path) {
  const clean = safeString(path).toLowerCase();
  const last = clean.split('/').pop() || '';
  const idx = last.lastIndexOf('.');
  return idx >= 0 ? last.slice(idx) : '';
}

function isThemeTextPath(path) {
  return THEME_TEXT_EXTENSIONS.has(extname(path));
}

function isExternalUrlPrefix(value) {
  const prefix = safeString(value).trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(prefix) || prefix.startsWith('//');
}

function routeCandidatePrefix(content, queryIndex) {
  const before = safeString(content).slice(0, queryIndex);
  const boundaries = ['"', "'", '`', ' ', '\n', '\r', '\t', '(', '[', '{', '=', '>'];
  let boundary = -1;
  boundaries.forEach((candidate) => {
    const index = before.lastIndexOf(candidate);
    if (index > boundary) boundary = index;
  });
  return before.slice(boundary + 1).trim();
}

function stripWrappingParentheses(value) {
  let text = safeString(value).trim();
  let changed = true;
  while (changed && text.startsWith('(') && text.endsWith(')')) {
    changed = false;
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '(') depth += 1;
      else if (ch === ')') {
        depth -= 1;
        if (depth === 0 && i === text.length - 1) {
          text = text.slice(1, -1).trim();
          changed = true;
          break;
        }
        if (depth === 0) break;
      }
    }
  }
  return text;
}

function routeGuardPreviousTokenAllowsRegex(source, index) {
  const text = safeString(source);
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i -= 1;
  if (i < 0) return true;
  const ch = text[i];
  if (/[({\[=,:;!?&|+*%~^<>-]/.test(ch)) return true;
  const word = text.slice(0, i + 1).match(/([A-Za-z_$][\w$]*)$/);
  return Boolean(word && /^(?:return|throw|case|typeof|delete|void|new|yield|await|else|do|in|instanceof)$/.test(word[1]));
}

function routeGuardRegexLiteralEnd(source, start) {
  const text = safeString(source);
  let escaped = false;
  let inClass = false;
  for (let i = start + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      continue;
    }
    if (ch === ']' && inClass) {
      inClass = false;
      continue;
    }
    if (ch === '/' && !inClass) {
      let end = i + 1;
      while (/[A-Za-z]/.test(text[end] || '')) end += 1;
      return end;
    }
    if (ch === '\n' || ch === '\r') return start + 1;
  }
  return start + 1;
}

function stripCommentsForRouteGuard(source) {
  const text = safeString(source);
  let out = '';
  let quote = '';
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] || '';
    if (quote) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && next !== '/' && next !== '*' && routeGuardPreviousTokenAllowsRegex(text, i)) {
      const end = routeGuardRegexLiteralEnd(text, i);
      out += text.slice(i, end);
      i = end - 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      out += '  ';
      i += 1;
      while (i + 1 < text.length && text[i + 1] !== '\n' && text[i + 1] !== '\r') {
        out += ' ';
        i += 1;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 1;
      while (i + 1 < text.length) {
        const blockCh = text[i + 1];
        const blockNext = text[i + 2] || '';
        if (blockCh === '*' && blockNext === '/') {
          out += '  ';
          i += 2;
          break;
        }
        out += blockCh === '\n' || blockCh === '\r' ? blockCh : ' ';
        i += 1;
      }
      continue;
    }
    if (ch === '<' && text.slice(i, i + 4) === '<!--') {
      out += '    ';
      i += 3;
      while (i + 1 < text.length) {
        if (text.slice(i + 1, i + 4) === '-->') {
          out += '   ';
          i += 3;
          break;
        }
        const htmlCh = text[i + 1];
        out += htmlCh === '\n' || htmlCh === '\r' ? htmlCh : ' ';
        i += 1;
      }
      continue;
    }
    out += ch;
  }
  return out;
}

function stripHtmlCommentsForRouteGuard(source) {
  return safeString(source).replace(/<!--[\s\S]*?-->/g, (match) => (
    match.replace(/[^\n\r]/g, ' ')
  ));
}

function containsRelativePressRouteLiteral(content) {
  const value = safeString(content);
  ROUTE_QUERY_PATTERN.lastIndex = 0;
  let match = ROUTE_QUERY_PATTERN.exec(value);
  while (match) {
    const queryIndex = match[0].startsWith('?')
      ? match.index
      : value.lastIndexOf('?', match.index);
    const prefix = queryIndex >= 0 ? routeCandidatePrefix(value, queryIndex) : '';
    if (!isExternalUrlPrefix(prefix)) return true;
    match = ROUTE_QUERY_PATTERN.exec(value);
  }
  return false;
}

function stringLiteralIsExternalUrlConstructorArg(source, literalMatch, externalAliases = new Set()) {
  const text = safeString(source);
  const before = text.slice(0, literalMatch.index);
  const callMatch = before.match(/\bnew\s+URL\s*\(\s*(?:\(\s*)*$/);
  if (!callMatch) return false;
  const callPrefixIndex = before.length - callMatch[0].length;
  const argsStart = callPrefixIndex + callMatch[0].indexOf('(') + 1;
  const parsed = extractCallArgs(text, argsStart);
  const parts = splitTopLevelArgs(parsed.args);
  return parts.length > 1
    && expressionIsStaticRelativeUrl(parts[0])
    && expressionIsExternalUrl(parts[1], externalAliases);
}

function containsForbiddenRouteLiteral(source, externalAliases = new Set()) {
  const text = safeString(source);
  STRING_LITERAL_PATTERN.lastIndex = 0;
  let match = STRING_LITERAL_PATTERN.exec(text);
  while (match) {
    if (containsRelativePressRouteLiteral(match[2])
      && !stringLiteralIsExternalUrlConstructorArg(text, match, externalAliases)
      && !stringLiteralHasExternalRouteContext(text, match, externalAliases)) {
      return true;
    }
    match = STRING_LITERAL_PATTERN.exec(text);
  }
  return false;
}

function containsForbiddenHtmlRouteAttribute(source) {
  const text = safeString(source);
  const re = /\b(?:href|src|action|poster|formaction|cite|data-[a-z0-9_-]*href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`<>]+))/gi;
  let match = re.exec(text);
  while (match) {
    const value = match[1] || match[2] || match[3] || '';
    if (containsRelativePressRouteLiteral(decodeHtmlAttributeValue(value))) return true;
    match = re.exec(text);
  }
  return false;
}

function decodeHtmlAttributeValue(value) {
  return safeString(value)
    .replace(/&#(x[0-9a-f]+|\d+);?/gi, (_, raw) => {
      const code = raw.toLowerCase().startsWith('x')
        ? Number.parseInt(raw.slice(1), 16)
        : Number.parseInt(raw, 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _;
    })
    .replace(/&(?:amp|equals|quest);?/gi, (entity) => {
      const key = entity.replace(/[&;]/g, '').toLowerCase();
      if (key === 'amp') return '&';
      if (key === 'equals') return '=';
      if (key === 'quest') return '?';
      return entity;
    });
}

function shouldScanHtmlRouteAttributes(path, source) {
  const clean = safeString(path).toLowerCase();
  if (/\.(?:html?|svg)$/i.test(clean)) return true;
  if (clean) return false;
  return /<\s*[a-z][\s\S]*?\b(?:href|src|action|poster|formaction|cite|data-[a-z0-9_-]*href)\s*=/i.test(safeString(source));
}

function shouldScanExecutableRouteCode(path) {
  const clean = safeString(path).toLowerCase();
  return !clean || /\.(?:js|mjs)$/i.test(clean);
}

function stringLiteralHasExternalRouteContext(source, literalMatch, externalAliases = new Set()) {
  const text = safeString(source);
  const content = safeString(literalMatch && literalMatch[2]);
  if ((literalMatch && literalMatch[1]) === '`' && templateRouteContentHasExternalPrefix(text, content, externalAliases)) return true;
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = text.slice(0, literalMatch.index);
  const literalPrefix = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\+\s*$/);
  if (literalPrefix && isExternalUrlPrefix(literalPrefix[2])) return true;
  const aliasPrefix = before.match(/\b([A-Za-z_$][\w$]*)\s*\+\s*$/);
  return Boolean(aliasPrefix && externalAliases.has(aliasPrefix[1]));
}

function escapeRegExp(value) {
  return safeString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expressionReferencePattern(expression) {
  const text = safeString(expression).trim();
  const parts = text.split(/\s*\.\s*/).filter(Boolean);
  if (parts.length && parts.every((part, index) => (
    part === 'this' ? index === 0 : new RegExp(`^${IDENTIFIER_PATTERN.source}$`).test(part)
  ))) {
    return `\\b${parts.map(escapeRegExp).join('\\s*\\.\\s*')}`;
  }
  return `\\b${escapeRegExp(text)}`;
}

function collectRouteKeyAliases(source) {
  const text = safeString(source);
  const aliases = new Set();
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])(tab|id)\2\s*;?/g;
  let match = re.exec(text);
  while (match) {
    aliases.add(match[1]);
    match = re.exec(text);
  }
  const defaultRe = /\bexport\s+default\s*(?:\(\s*)*(['"`])(tab|id)\1(?:\s*\))*\s*;?/g;
  match = defaultRe.exec(text);
  while (match) {
    aliases.add('default');
    match = defaultRe.exec(text);
  }
  const defaultIdentifierRe = /\bexport\s+default\s*(?:\(\s*)*([A-Za-z_$][\w$]*)(?:\s*\))*\s*;?/g;
  match = defaultIdentifierRe.exec(text);
  while (match) {
    if (aliases.has(match[1])) aliases.add('default');
    match = defaultIdentifierRe.exec(text);
  }
  const localDefaultExportRe = /\bexport\s*\{([\s\S]*?)\}/g;
  match = localDefaultExportRe.exec(text);
  while (match) {
    const after = text.slice(localDefaultExportRe.lastIndex);
    if (/^\s*from\b/.test(after)) {
      match = localDefaultExportRe.exec(text);
      continue;
    }
    (match[1] || '').split(',').forEach((part) => {
      const spec = part.trim();
      const alias = spec.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (alias && alias[2] === 'default' && aliases.has(alias[1])) aliases.add('default');
    });
    match = localDefaultExportRe.exec(text);
  }
  return aliases;
}

function collectExternalUrlAliases(source) {
  const text = safeString(source);
  const aliases = new Set();
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])((?:\\[\s\S]|(?!\2)[\s\S])*?)\2\s*;?/g;
  let match = re.exec(text);
  while (match) {
    if (isExternalUrlPrefix(match[3])) aliases.add(match[1]);
    match = re.exec(text);
  }
  const staticRelativeAliases = collectStaticRelativeUrlAliases(text);
  const urlRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URL\\s*\\(`, 'g');
  match = urlRe.exec(text);
  while (match) {
    const parsed = extractCallArgs(text, urlRe.lastIndex);
    if (urlConstructorArgsAreExternal(parsed.args, aliases, staticRelativeAliases)) aliases.add(match[1]);
    if (parsed.end > urlRe.lastIndex) urlRe.lastIndex = parsed.end;
    match = urlRe.exec(text);
  }
  const defaultRe = /\bexport\s+default\s*(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*;?/g;
  match = defaultRe.exec(text);
  while (match) {
    if (isExternalUrlPrefix(match[2])) aliases.add('default');
    match = defaultRe.exec(text);
  }
  const defaultIdentifierRe = /\bexport\s+default\s*(?:\(\s*)*([A-Za-z_$][\w$]*)(?:\s*\))*\s*;?/g;
  match = defaultIdentifierRe.exec(text);
  while (match) {
    if (aliases.has(match[1])) aliases.add('default');
    match = defaultIdentifierRe.exec(text);
  }
  const localDefaultExportRe = /\bexport\s*\{([\s\S]*?)\}/g;
  match = localDefaultExportRe.exec(text);
  while (match) {
    const after = text.slice(localDefaultExportRe.lastIndex);
    if (/^\s*from\b/.test(after)) {
      match = localDefaultExportRe.exec(text);
      continue;
    }
    (match[1] || '').split(',').forEach((part) => {
      const spec = part.trim();
      const alias = spec.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (alias && alias[2] === 'default' && aliases.has(alias[1])) aliases.add('default');
    });
    match = localDefaultExportRe.exec(text);
  }
  return aliases;
}

function collectStaticRelativeUrlAliases(source) {
  const text = safeString(source);
  const aliases = new Set();
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])((?:\\[\s\S]|(?!\2)[\s\S])*?)\2\s*;?/g;
  let match = re.exec(text);
  while (match) {
    if (!isExternalUrlPrefix(match[3])) aliases.add(match[1]);
    match = re.exec(text);
  }
  const defaultRe = /\bexport\s+default\s*(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*;?/g;
  match = defaultRe.exec(text);
  while (match) {
    if (!isExternalUrlPrefix(match[2])) aliases.add('default');
    match = defaultRe.exec(text);
  }
  const defaultIdentifierRe = /\bexport\s+default\s*(?:\(\s*)*([A-Za-z_$][\w$]*)(?:\s*\))*\s*;?/g;
  match = defaultIdentifierRe.exec(text);
  while (match) {
    if (aliases.has(match[1])) aliases.add('default');
    match = defaultIdentifierRe.exec(text);
  }
  const localDefaultExportRe = /\bexport\s*\{([\s\S]*?)\}/g;
  match = localDefaultExportRe.exec(text);
  while (match) {
    const after = text.slice(localDefaultExportRe.lastIndex);
    if (/^\s*from\b/.test(after)) {
      match = localDefaultExportRe.exec(text);
      continue;
    }
    (match[1] || '').split(',').forEach((part) => {
      const spec = part.trim();
      const alias = spec.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (alias && alias[2] === 'default' && aliases.has(alias[1])) aliases.add('default');
    });
    match = localDefaultExportRe.exec(text);
  }
  return aliases;
}

function collectNamedImports(source) {
  const text = safeString(source);
  const imports = [];
  const defaultRe = /\bimport\s+([A-Za-z_$][\w$]*)(?:\s*,\s*\{[\s\S]*?\})?\s*from\s*(['"])([^'"]+)\2/g;
  let defaultMatch = defaultRe.exec(text);
  while (defaultMatch) {
    imports.push({ importedName: 'default', localName: defaultMatch[1], specifier: defaultMatch[3] });
    defaultMatch = defaultRe.exec(text);
  }
  const mixedNamedRe = /\bimport\s+[A-Za-z_$][\w$]*\s*,\s*\{([\s\S]*?)\}\s*from\s*(['"])([^'"]+)\2/g;
  let mixedMatch = mixedNamedRe.exec(text);
  while (mixedMatch) {
    (mixedMatch[1] || '').split(',').forEach((part) => {
      const spec = part.trim();
      if (!spec) return;
      const alias = spec.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (alias) {
        imports.push({ importedName: alias[1], localName: alias[2], specifier: mixedMatch[3] });
      } else if (/^[A-Za-z_$][\w$]*$/.test(spec)) {
        imports.push({ importedName: spec, localName: spec, specifier: mixedMatch[3] });
      }
    });
    mixedMatch = mixedNamedRe.exec(text);
  }
  const re = /\bimport\s*\{([\s\S]*?)\}\s*from\s*(['"])[^'"]+\2/g;
  let match = re.exec(text);
  while (match) {
    const specifier = (match[0].match(/\bfrom\s*(['"])([^'"]+)\1/) || [])[2] || '';
    (match[1] || '').split(',').forEach((part) => {
      const spec = part.trim();
      if (!spec) return;
      const alias = spec.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (alias) {
        imports.push({ importedName: alias[1], localName: alias[2], specifier });
      } else if (/^[A-Za-z_$][\w$]*$/.test(spec)) {
        imports.push({ importedName: spec, localName: spec, specifier });
      }
    });
    match = re.exec(text);
  }
  return imports;
}

function collectLocalBindingNames(source) {
  const text = safeString(source);
  const bindings = new Set();
  addLocalDeclarationBindings(bindings, text, { topLevelOnly: true });
  const functionRe = /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)\s*\{/g;
  let match = functionRe.exec(text);
  while (match) {
    const body = extractBlockText(text, functionRe.lastIndex - 1);
    if (routeGuardBodyLooksRelevant(body)) {
      addBindingNamesFromPattern(bindings, match[1]);
      addLocalDeclarationBindings(bindings, body, { topLevelOnly: true });
    }
    match = functionRe.exec(text);
  }
  const arrowRe = /(?:^|[^\w$])(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g;
  match = arrowRe.exec(text);
  while (match) {
    const body = extractBlockText(text, arrowRe.lastIndex - 1);
    if (routeGuardBodyLooksRelevant(body)) {
      addBindingNamesFromPattern(bindings, match[1]);
      addLocalDeclarationBindings(bindings, body, { topLevelOnly: true });
    }
    match = arrowRe.exec(text);
  }
  const expressionArrowRe = /(?:^|[^\w$])(?:async\s*)?\(([^)]*)\)\s*=>\s*(?!\s*\{)/g;
  match = expressionArrowRe.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, expressionArrowRe.lastIndex);
    if (routeGuardBodyLooksRelevant(expression)) addBindingNamesFromPattern(bindings, match[1]);
    expressionArrowRe.lastIndex += expression.length;
    match = expressionArrowRe.exec(text);
  }
  const singleArrowRe = /(?:^|[^\w$])(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  match = singleArrowRe.exec(text);
  while (match) {
    const body = extractBlockText(text, singleArrowRe.lastIndex - 1);
    if (routeGuardBodyLooksRelevant(body)) {
      bindings.add(match[1]);
      addLocalDeclarationBindings(bindings, body, { topLevelOnly: true });
    }
    match = singleArrowRe.exec(text);
  }
  const singleExpressionArrowRe = /(?:^|[^\w$])(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>\s*(?!\s*\{)/g;
  match = singleExpressionArrowRe.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, singleExpressionArrowRe.lastIndex);
    if (routeGuardBodyLooksRelevant(expression)) bindings.add(match[1]);
    singleExpressionArrowRe.lastIndex += expression.length;
    match = singleExpressionArrowRe.exec(text);
  }
  const methodRe = /(?:^|[,{]\s*)(?:async\s+)?[A-Za-z_$][\w$]*\s*\(([^)]*)\)\s*\{/g;
  match = methodRe.exec(text);
  while (match) {
    const body = extractBlockText(text, methodRe.lastIndex - 1);
    if (routeGuardBodyLooksRelevant(body)) {
      addBindingNamesFromPattern(bindings, match[1]);
      addLocalDeclarationBindings(bindings, body, { topLevelOnly: true });
    }
    match = methodRe.exec(text);
  }
  return bindings;
}

function addLocalDeclarationBindings(bindings, source, options = {}) {
  const text = safeString(source);
  const declarationRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  let match = declarationRe.exec(text);
  while (match) {
    if (!options.topLevelOnly || braceDepthAt(text, match.index) === 0) bindings.add(match[1]);
    match = declarationRe.exec(text);
  }
  const destructuredRe = /\b(?:const|let|var)\s*\{([\s\S]*?)\}/g;
  match = destructuredRe.exec(text);
  while (match) {
    if (!options.topLevelOnly || braceDepthAt(text, match.index) === 0) addBindingNamesFromPattern(bindings, match[1]);
    match = destructuredRe.exec(text);
  }
}

function addBindingNamesFromPattern(bindings, pattern) {
  const text = safeString(pattern);
  text.split(',').forEach((part) => {
    const clean = part.trim().replace(/^[{\[]\s*|\s*[}\]]$/g, '');
    const simple = clean.match(/^([A-Za-z_$][\w$]*)$/);
    if (simple) {
      bindings.add(simple[1]);
      return;
    }
    const defaulted = clean.match(/^([A-Za-z_$][\w$]*)\s*=/);
    if (defaulted) {
      bindings.add(defaulted[1]);
      return;
    }
    const alias = clean.match(/^[A-Za-z_$][\w$]*\s*:\s*([A-Za-z_$][\w$]*)(?:\s*=.*)?$/);
    if (alias) bindings.add(alias[1]);
  });
  const shorthandRe = /(?:^|[,\{\[]\s*)([A-Za-z_$][\w$]*)(?:\s*=\s*[^,\}\]]+)?\s*(?=[,\}\]])/g;
  let match = shorthandRe.exec(text);
  while (match) {
    bindings.add(match[1]);
    match = shorthandRe.exec(text);
  }
}

function routeGuardBodyLooksRelevant(body) {
  return /\b(?:new\s+URL|URLSearchParams|searchParams|location)\b|[?&](?:tab|id)=/.test(safeString(body));
}

function braceDepthAt(source, index) {
  const text = safeString(source).slice(0, Math.max(0, index));
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && depth > 0) depth -= 1;
  }
  return depth;
}

function blockStackAt(source, index) {
  const text = safeString(source);
  const stack = [];
  let quote = '';
  let escaped = false;
  for (let i = 0; i < Math.min(text.length, Math.max(0, index)); i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') stack.push(i);
    else if (ch === '}' && stack.length) stack.pop();
  }
  return stack;
}

function extractBlockText(source, openBraceIndex) {
  return extractBlockSpan(source, openBraceIndex).body;
}

function topLevelRouteGuardSource(source) {
  const text = safeString(source);
  let out = '';
  let quote = '';
  let escaped = false;
  let regex = false;
  let inClass = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] || '';
    if (quote) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (regex) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '[') inClass = true;
      else if (ch === ']' && inClass) inClass = false;
      else if (ch === '/' && !inClass) regex = false;
      continue;
    }
    if (ch === '/' && next === '/') {
      out += '  ';
      i += 1;
      while (i + 1 < text.length && text[i + 1] !== '\n' && text[i + 1] !== '\r') {
        out += ' ';
        i += 1;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 1;
      while (i + 1 < text.length) {
        if (text[i + 1] === '*' && text[i + 2] === '/') {
          out += '  ';
          i += 2;
          break;
        }
        const blockCh = text[i + 1];
        out += blockCh === '\n' || blockCh === '\r' ? blockCh : ' ';
        i += 1;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && routeGuardPreviousTokenAllowsRegex(text, i)) {
      regex = true;
      inClass = false;
      out += ch;
      continue;
    }
    if (ch === '{') {
      const span = extractBlockSpan(text, i);
      out += ' '.repeat(Math.max(1, span.end - i));
      i = span.end - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function extractBlockSpan(source, openBraceIndex) {
  const text = safeString(source);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let regex = false;
  let inClass = false;
  for (let i = openBraceIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] || '';
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (regex) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '[') inClass = true;
      else if (ch === ']' && inClass) inClass = false;
      else if (ch === '/' && !inClass) regex = false;
      continue;
    }
    if (ch === '/' && next === '/') {
      i += 1;
      while (i + 1 < text.length && text[i + 1] !== '\n' && text[i + 1] !== '\r') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 1;
      while (i + 1 < text.length) {
        if (text[i + 1] === '*' && text[i + 2] === '/') {
          i += 2;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '/' && routeGuardPreviousTokenAllowsRegex(text, i)) {
      regex = true;
      inClass = false;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return { body: text.slice(openBraceIndex + 1, i), end: i + 1 };
    }
  }
  return { body: text.slice(openBraceIndex + 1), end: text.length };
}

function normalizeRouteGuardContext(contextSource, fallbackSource = '', fallbackPath = '') {
  if (contextSource && typeof contextSource === 'object' && Array.isArray(contextSource.files)) {
    const files = contextSource.files.map((file) => ({
      path: safeString(file && file.path).replace(/\\+/g, '/'),
      source: stripCommentsForRouteGuard(file && file.source)
    }));
    return {
      path: safeString(contextSource.path || fallbackPath).replace(/\\+/g, '/'),
      files,
      source: files.map((file) => file.source).join('\n')
    };
  }
  return {
    path: safeString(fallbackPath).replace(/\\+/g, '/'),
    files: [],
    source: safeString(contextSource || fallbackSource)
  };
}

function resolveImportPath(fromPath, specifier) {
  const spec = safeString(specifier).trim();
  if (!spec.startsWith('.')) return '';
  const fromDir = safeString(fromPath).split('/').slice(0, -1).join('/');
  const normalized = `${fromDir ? `${fromDir}/` : ''}${spec}`.split('/');
  const out = [];
  normalized.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') out.pop();
    else out.push(part);
  });
  const joined = out.join('/');
  return /\.[a-z0-9]+$/i.test(joined) ? joined : `${joined}.js`;
}

function collectContextFileAliases(file, collector, context, seen = new Set(), cache = new Map()) {
  const key = `${file.path}:${collector.name || 'collector'}`;
  if (cache.has(key)) return new Set(cache.get(key));
  if (seen.has(key)) return new Set();
  seen.add(key);
  const out = new Set(collector(file.source));
  const importedAliases = new Set();
  collectNamedImports(file.source).forEach(({ importedName, localName, specifier }) => {
    const targetPath = resolveImportPath(file.path, specifier);
    const target = targetPath ? context.files.find((entry) => entry.path === targetPath) : null;
    if (!target) return;
    const targetAliases = collectContextFileAliases(target, collector, context, seen, cache);
    if (targetAliases.has(importedName)) importedAliases.add(localName);
  });
  const exportableAliases = new Set([...out, ...importedAliases]);
  const reExportRe = /\bexport\s*\{([\s\S]*?)\}\s*from\s*(['"])([^'"]+)\2/g;
  let match = reExportRe.exec(file.source);
  while (match) {
    const targetPath = resolveImportPath(file.path, match[3]);
    const target = targetPath ? context.files.find((entry) => entry.path === targetPath) : null;
    if (!target) {
      match = reExportRe.exec(file.source);
      continue;
    }
    const targetAliases = collectContextFileAliases(target, collector, context, seen, cache);
    (match[1] || '').split(',').forEach((part) => {
      const spec = part.trim();
      if (!spec) return;
      const alias = spec.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      const importedName = alias ? alias[1] : spec;
      const exportedName = alias ? alias[2] : spec;
      if (/^[A-Za-z_$][\w$]*$/.test(importedName) && targetAliases.has(importedName)) out.add(exportedName);
    });
    match = reExportRe.exec(file.source);
  }
  const localExportRe = /\bexport\s*\{([\s\S]*?)\}/g;
  match = localExportRe.exec(file.source);
  while (match) {
    const after = file.source.slice(localExportRe.lastIndex);
    if (!/^\s*from\b/.test(after)) {
      (match[1] || '').split(',').forEach((part) => {
        const spec = part.trim();
        if (!spec) return;
        const alias = spec.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
        const localName = alias ? alias[1] : spec;
        const exportedName = alias ? alias[2] : spec;
        if (/^[A-Za-z_$][\w$]*$/.test(localName) && exportableAliases.has(localName)) out.add(exportedName);
      });
    }
    match = localExportRe.exec(file.source);
  }
  const starRe = /\bexport\s+\*\s+from\s*(['"])([^'"]+)\1/g;
  match = starRe.exec(file.source);
  while (match) {
    const targetPath = resolveImportPath(file.path, match[2]);
    const target = targetPath ? context.files.find((entry) => entry.path === targetPath) : null;
    if (target) {
      const targetAliases = collectContextFileAliases(target, collector, context, seen, cache);
      targetAliases.forEach((alias) => out.add(alias));
    }
    match = starRe.exec(file.source);
  }
  seen.delete(key);
  cache.set(key, out);
  return out;
}

function mergeImportedContextAliases(localAliases, collector, source, context, options = {}) {
  const out = new Set(localAliases || []);
  const imports = collectNamedImports(source);
  const shadowed = options.shadow === false ? new Set() : collectLocalBindingNames(source);
  imports.forEach(({ importedName, localName, specifier }) => {
    const targetPath = resolveImportPath(context.path, specifier);
    const target = targetPath ? context.files.find((file) => file.path === targetPath) : null;
    if (!target) return;
    const contextAliases = collectContextFileAliases(target, collector, context);
    if (contextAliases.has(importedName) && !shadowed.has(localName)) out.add(localName);
  });
  return out;
}

function sourceArgIsRouteKey(arg, aliases) {
  const value = safeString(arg).trim();
  return new RegExp(`^(?:${routeKeyExpressionPattern(aliases)})$`).test(value);
}

function propertyAccessorPattern(name) {
  const escaped = escapeRegExp(name);
  return `(?:\\s*\\?\\.\\s*${escaped}|\\s*\\.\\s*${escaped}|\\s*\\?\\.\\s*\\[\\s*["'\`]${escaped}["'\`]\\s*\\]|\\s*\\[\\s*["'\`]${escaped}["'\`]\\s*\\])`;
}

function routeKeyWritePattern(owner, property = '') {
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? propertyAccessorPattern(property) : '';
  const mutator = `(?:${propertyAccessorPattern('set')}|${propertyAccessorPattern('append')})`;
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  return new RegExp(`${ownerPattern}${suffix}${mutator}\\s*(?:\\?\\.\\s*)?\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*,`, 'g');
}

function collectBoundRouteMutators(source, owner, property = '') {
  const text = safeString(source);
  const out = new Set();
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? propertyAccessorPattern(property) : '';
  const target = `${ownerPattern}${suffix}`;
  const mutator = `(?:${propertyAccessorPattern('set')}|${propertyAccessorPattern('append')})`;
  const re = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*${target}${mutator}\\s*\\.\\s*bind\\s*\\(\\s*${target}\\s*\\)`, 'g');
  let match = re.exec(text);
  while (match) {
    out.add(match[1]);
    match = re.exec(text);
  }
  return out;
}

function containsRouteKeyWriteForOwner(source, owner, aliases, property = '') {
  const text = safeString(source);
  const re = routeKeyWritePattern(owner, property);
  let match = re.exec(text);
  while (match) {
    if (sourceArgIsRouteKey(match[1], aliases)) return true;
    match = re.exec(text);
  }
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  for (const mutator of collectBoundRouteMutators(text, owner, property)) {
    const mutatorRe = new RegExp(`(?:^|[^\\w$.])${escapeRegExp(mutator)}\\s*(?:\\?\\.\\s*)?\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*,`, 'g');
    match = mutatorRe.exec(text);
    while (match) {
      if (sourceArgIsRouteKey(match[1], aliases)) return true;
      match = mutatorRe.exec(text);
    }
  }
  return false;
}

function collectUrlSearchParamsConstructors(source) {
  const text = safeString(source);
  const out = [];
  const seen = new Set();
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+URLSearchParams\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+URLSearchParams\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_PATTERN_SOURCE})\\s*=\\s*(?:\\(\\s*)*new\\s+URLSearchParams\\s*\\(`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const parsed = extractCallArgs(text, re.lastIndex);
      const key = `${match[1]}:${parsed.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ name: match[1], args: parsed.args || '' });
      }
      if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
      match = re.exec(text);
    }
  });
  return out;
}

function collectUrlSearchParamsVariables(source) {
  return new Set(collectUrlSearchParamsConstructors(source).map((item) => item.name));
}

function collectUrlSearchParamsInitializers(source) {
  return collectUrlSearchParamsConstructors(source);
}

function extractCallArgs(source, argsStart) {
  const text = safeString(source);
  let depth = 1;
  let quote = '';
  let escaped = false;
  for (let i = argsStart; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return { args: text.slice(argsStart, i), end: i + 1 };
      }
    }
  }
  return { args: text.slice(argsStart), end: text.length };
}

function extractAssignmentExpression(source, valueStart) {
  const text = safeString(source);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = valueStart; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth > 0) depth -= 1;
      continue;
    }
    if (depth === 0 && (ch === ';' || ch === '\n' || ch === '\r')) {
      return text.slice(valueStart, i);
    }
  }
  return text.slice(valueStart);
}

function splitTopLevelArgs(args) {
  const text = safeString(args);
  const out = [];
  let depth = 0;
  let quote = '';
  let escaped = false;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth > 0) depth -= 1;
      continue;
    }
    if (depth === 0 && ch === ',') {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

function aliasAlternation(aliases) {
  return Array.from(aliases || []).map(escapeRegExp).join('|');
}

function aliasExpressionPattern(aliases) {
  const aliasPattern = aliasAlternation(aliases);
  return aliasPattern ? `(?:${aliasPattern}|\\(\\s*(?:${aliasPattern})\\s*\\))` : '';
}

function routeKeyExpressionPattern(aliases = new Set()) {
  const aliasExpression = aliasExpressionPattern(aliases);
  const core = aliasExpression
    ? `(?:${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE}|${aliasExpression})`
    : ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE;
  return `(?:\\(\\s*)*${core}(?:\\s*\\))*`;
}

function urlSearchParamsInitializerHasRouteKey(args, aliases = new Set()) {
  const text = stripWrappingParentheses(args);
  if (text.startsWith('{')) {
    if (ROUTE_KEY_OBJECT_INIT_PATTERN.test(text) || ROUTE_KEY_OBJECT_SHORTHAND_PATTERN.test(text)) return true;
    const routeKeyExpression = routeKeyExpressionPattern(aliases);
    return new RegExp(`(?:^|[,\\{]\\s*)\\[\\s*(?:${routeKeyExpression})\\s*\\]\\s*:`).test(text);
  }
  if (text.startsWith('[')) {
    if (ROUTE_KEY_ARRAY_INIT_PATTERN.test(text)) return true;
    const routeKeyExpression = routeKeyExpressionPattern(aliases);
    return new RegExp(`\\[\\s*(?:${routeKeyExpression})\\s*,`).test(text);
  }
  if (/^(['"`])(?:tab|id)\s*=/.test(text)) return true;
  if (/^(['"`])(?:tab|id)\1\s*\+\s*(['"`])=\2/.test(text)) return true;
  const routeKeyExpression = routeKeyExpressionPattern(aliases);
  return new RegExp(`^(?:${routeKeyExpression})\\s*\\+\\s*(['"\`])=\\1`).test(text)
    || new RegExp(`^\`\\s*\\$\\{\\s*(?:${routeKeyExpression})\\s*\\}\\s*=`).test(text);
}

function collectParamsSerializationAliases(source, name) {
  const text = safeString(source);
  const namePattern = expressionReferencePattern(name);
  const aliases = new Set();
  const sourcePattern = `${namePattern}(?:\\s*\\.\\s*toString\\s*\\(\\s*\\))?`;
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*${sourcePattern}\\s*;?`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*${sourcePattern}\\s*;?`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      if (match[1] !== name) aliases.add(match[1]);
      match = re.exec(text);
    }
  });
  return aliases;
}

function containsRelativeParamsSerialization(source, name, seen = new Set(), externalAliases = null) {
  const text = safeString(source);
  if (seen.has(name)) return false;
  seen.add(name);
  const namePattern = expressionReferencePattern(name);
  const concatRe = new RegExp(`(['"\`])((?:\\\\[\\s\\S]|(?!\\1)[\\s\\S])*?[?&])\\1\\s*\\+\\s*${namePattern}(?:\\b|\\s*\\.\\s*toString\\s*\\()`, 'g');
  let match = concatRe.exec(text);
  while (match) {
    const content = match[2];
    const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
    const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
    if (!isExternalUrlPrefix(prefix) && !inlineParamsConcatHasExternalPrefix(text, match, externalAliases)) return true;
    match = concatRe.exec(text);
  }
  const templateRe = new RegExp(`\`((?:\\\\[\\s\\S]|(?!\`)[\\s\\S])*?[?&])\\$\\{\\s*${namePattern}(?:\\s*\\.\\s*toString\\s*\\(\\s*\\))?\\s*\\}`, 'g');
  match = templateRe.exec(text);
  while (match) {
    if (!templateRouteContentHasExternalPrefix(text, match[1], externalAliases)) return true;
    match = templateRe.exec(text);
  }
  const locationSearchRe = new RegExp(`${locationSearchWritePattern(collectLocationAliases(text)).source}\\s*${namePattern}(?:\\b|\\s*\\.\\s*toString\\s*\\()`, 'g');
  if (locationSearchRe.test(text)) return true;
  for (const alias of collectParamsSerializationAliases(text, name)) {
    if (containsRelativeParamsSerialization(text, alias, seen, externalAliases)) return true;
  }
  return false;
}

function containsForbiddenUrlSearchParamsVariable(source, aliases, externalAliases = null) {
  const text = safeString(source);
  const vars = collectUrlSearchParamsVariables(text);
  for (const name of vars) {
    if (containsRouteKeyWriteForOwner(text, name, aliases) && containsRelativeParamsSerialization(text, name, new Set(), externalAliases)) {
      return true;
    }
  }
  return false;
}

function containsForbiddenUrlSearchParamsInitializer(source, aliases = new Set(), externalAliases = null) {
  const text = safeString(source);
  const initializers = collectUrlSearchParamsInitializers(text);
  for (const { name, args } of initializers) {
    if (urlSearchParamsInitializerHasRouteKey(args, aliases) && containsRelativeParamsSerialization(text, name, new Set(), externalAliases)) {
      return true;
    }
  }
  return false;
}

function collectRouteQueryAliases(source, aliases = new Set()) {
  const text = safeString(source);
  const out = new Set();
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=`, 'g'),
    new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_PATTERN_SOURCE})\\s*=`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const expression = extractAssignmentExpression(text, re.lastIndex);
      if (urlSearchParamsInitializerHasRouteKey(stripWrappingParentheses(expression), aliases)) out.add(match[1]);
      match = re.exec(text);
    }
  });
  return out;
}

function expressionIsQueryAliasReference(expression, queryAliases = new Set()) {
  const patterns = Array.from(queryAliases || []).map((alias) => `(?:\\(\\s*)*${expressionReferencePattern(alias)}(?:\\s*\\))*`);
  if (!patterns.length) return false;
  return new RegExp(`^(?:${patterns.join('|')})(?:\\s*\\.\\s*toString\\s*\\(\\s*\\))?$`).test(safeString(expression).trim());
}

function containsRelativeQueryAliasSerialization(source, queryAliases = new Set(), externalAliases = null) {
  for (const alias of queryAliases || []) {
    if (containsRelativeParamsSerialization(source, alias, new Set(), externalAliases)) return true;
  }
  return false;
}

function inlineParamsConcatHasExternalPrefix(text, literalMatch, externalAliases = null) {
  const content = safeString(literalMatch[2]);
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = safeString(text).slice(0, literalMatch.index);
  const literalPrefix = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\+\s*$/);
  if (literalPrefix && isExternalUrlPrefix(literalPrefix[2])) return true;
  const aliasPrefix = before.match(/\b([A-Za-z_$][\w$]*)\s*\+\s*$/);
  if (aliasPrefix) {
    const aliases = externalAliases || collectExternalUrlAliases(text);
    if (aliases.has(aliasPrefix[1])) return true;
  }
  return false;
}

function templateRouteContentHasExternalPrefix(source, content, externalAliases = null) {
  const value = safeString(content);
  const queryIndex = Math.max(value.lastIndexOf('?'), value.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(value, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const beforeQuery = queryIndex >= 0 ? value.slice(0, queryIndex).trim() : '';
  const aliasPrefix = beforeQuery.match(/^\$\{\s*([A-Za-z_$][\w$]*)\s*\}/);
  if (!aliasPrefix) return false;
  const aliases = externalAliases || collectExternalUrlAliases(source);
  return aliases.has(aliasPrefix[1]);
}

function inlineUrlSearchParamsHasRelativeSink(source, callStart, externalAliases = null) {
  const text = safeString(source);
  const before = text.slice(0, callStart);
  const concat = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?[?&])\1\s*\+\s*\(?\s*$/);
  if (concat) {
    concat.index = before.length - concat[0].length;
    return !inlineParamsConcatHasExternalPrefix(text, concat, externalAliases);
  }
  const template = before.match(/`((?:\\[\s\S]|(?!`)[\s\S])*?[?&])\$\{\s*$/);
  if (template) {
    return !templateRouteContentHasExternalPrefix(text, template[1], externalAliases);
  }
  return new RegExp(`${locationSearchWritePattern(collectLocationAliases(text)).source}\\s*$`).test(before);
}

function containsForbiddenInlineUrlSearchParamsInitializer(source, aliases = new Set(), externalAliases = null) {
  const text = safeString(source);
  const re = /\bnew\s+URLSearchParams\s*\(/g;
  let match = re.exec(text);
  while (match) {
    const parsed = extractCallArgs(text, re.lastIndex);
    if (urlSearchParamsInitializerHasRouteKey(parsed.args, aliases)
      && inlineUrlSearchParamsHasRelativeSink(text, match.index, externalAliases)) {
      return true;
    }
    if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
    match = re.exec(text);
  }
  return false;
}

function splitRouteQueryHasExternalPrefix(text, match, externalAliases = null) {
  const content = safeString(match[2]);
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = safeString(text).slice(0, match.index);
  const literalPrefix = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\+\s*$/);
  if (literalPrefix && isExternalUrlPrefix(literalPrefix[2])) return true;
  const aliasPrefix = before.match(/\b([A-Za-z_$][\w$]*)\s*\+\s*$/);
  if (aliasPrefix) {
    const aliases = externalAliases || collectExternalUrlAliases(text);
    if (aliases.has(aliasPrefix[1])) return true;
  }
  return false;
}

function containsForbiddenSplitRouteQueryLiteral(source, externalAliases = null) {
  const text = safeString(source);
  SPLIT_ROUTE_QUERY_LITERAL_PATTERN.lastIndex = 0;
  let match = SPLIT_ROUTE_QUERY_LITERAL_PATTERN.exec(text);
  while (match) {
    if (!splitRouteQueryHasExternalPrefix(text, match, externalAliases)) return true;
    match = SPLIT_ROUTE_QUERY_LITERAL_PATTERN.exec(text);
  }
  return false;
}

function containsForbiddenRouteKeyAliasConstruction(source, aliases = new Set(), externalAliases = null) {
  const routeKeyExpression = routeKeyExpressionPattern(aliases);
  const text = safeString(source);
  const concatRe = new RegExp(`(['"\`])((?:\\\\[\\s\\S]|(?!\\1)[\\s\\S])*?[?&])\\1\\s*\\+\\s*(?:${routeKeyExpression})\\s*\\+\\s*(['"\`])=\\3`, 'g');
  let match = concatRe.exec(text);
  while (match) {
    if (!inlineParamsConcatHasExternalPrefix(text, match, externalAliases)) return true;
    match = concatRe.exec(text);
  }
  const templateRe = new RegExp(`\`((?:\\\\[\\s\\S]|(?!\`)[\\s\\S])*?[?&])\\$\\{\\s*(?:${routeKeyExpression})\\s*\\}\\s*=`, 'g');
  match = templateRe.exec(text);
  while (match) {
    if (!templateRouteContentHasExternalPrefix(text, match[1], externalAliases)) return true;
    match = templateRe.exec(text);
  }
  return false;
}

function expressionIsExternalUrl(value, aliases = new Set()) {
  const text = stripWrappingParentheses(value);
  const match = text.match(/^(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/);
  if (match) {
    if (isExternalUrlPrefix(match[2]) || aliases.has(match[2])) return true;
    const aliasExpression = aliasExpressionPattern(aliases);
    return match[1] === '`' && aliasExpression
      ? new RegExp(`^\\s*\\$\\{\\s*(?:${aliasExpression})\\s*\\}`).test(match[2])
      : false;
  }
  if (aliases.has(text)) return true;
  const aliasExpression = aliasExpressionPattern(aliases);
  if (!aliasExpression) return false;
  return new RegExp(`^(?:${aliasExpression})\\s*\\+`).test(text)
    || new RegExp(`^\`\\s*\\$\\{\\s*(?:${aliasExpression})\\s*\\}`).test(text);
}

function expressionIsStaticRelativeUrl(value, aliases = new Set()) {
  const text = stripWrappingParentheses(value);
  const aliasExpression = aliasExpressionPattern(aliases);
  if (aliasExpression && new RegExp(`^(?:${aliasExpression})$`).test(text)) return true;
  const match = text.match(/^(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1$/);
  if (match) return !isExternalUrlPrefix(match[2]);
  const concatPrefix = text.match(/^(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\+/);
  return Boolean(concatPrefix && !isExternalUrlPrefix(concatPrefix[2]));
}

function urlConstructorArgsAreExternal(args, aliases = new Set(), staticRelativeAliases = new Set()) {
  const parts = splitTopLevelArgs(args);
  if (expressionIsExternalUrl(parts[0], aliases)) return true;
  return parts.length > 1
    && expressionIsStaticRelativeUrl(parts[0], staticRelativeAliases)
    && expressionIsExternalUrl(parts[1], aliases);
}

function collectRouteUrlVariables(source, externalAliases = collectExternalUrlAliases(source), staticRelativeAliases = collectStaticRelativeUrlAliases(source)) {
  const text = safeString(source);
  const out = new Set();
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URL\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URL\\s*\\(`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const parsed = extractCallArgs(text, re.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases)) out.add(match[1]);
      if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
      match = re.exec(text);
    }
  });
  return out;
}

function collectLocationAliases(source) {
  const text = safeString(source);
  const out = new Set();
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:window\\s*\\.\\s*)?location\\b`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:window\\s*\\.\\s*)?location\\b`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      out.add(match[1]);
      match = re.exec(text);
    }
  });
  const destructureRe = /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*window\b/g;
  let destructure = destructureRe.exec(text);
  while (destructure) {
    const body = destructure[1] || '';
    const aliasRe = /(?:^|,)\s*location\s*:\s*([A-Za-z_$][\w$]*)/g;
    let alias = aliasRe.exec(body);
    while (alias) {
      out.add(alias[1]);
      alias = aliasRe.exec(body);
    }
    destructure = destructureRe.exec(text);
  }
  return out;
}

function locationSearchWritePattern(locationAliases = new Set()) {
  const aliasPatterns = Array.from(locationAliases || []).map(expressionReferencePattern);
  const ownerPattern = aliasPatterns.length
    ? `(?:\\b(?:window\\s*\\.\\s*)?location|${aliasPatterns.join('|')})`
    : '\\b(?:window\\s*\\.\\s*)?location';
  const searchProperty = `(?:\\.\\s*search|\\[\\s*(['"\`])search\\1\\s*\\])`;
  return new RegExp(`${ownerPattern}\\s*${searchProperty}\\s*(?:\\+=|=(?!=|>))`, 'g');
}

function containsForbiddenRouteUrlMutation(source, aliases, externalAliases, staticRelativeAliases) {
  const text = safeString(source);
  const vars = collectRouteUrlVariables(text, externalAliases, staticRelativeAliases);
  for (const name of vars) {
    if (containsRouteKeyWriteForOwner(text, name, aliases, 'searchParams')) return true;
    const paramsAliases = collectSearchParamsAliasesForRouteUrl(text, name);
    for (const paramsAlias of paramsAliases) {
      if (containsRouteKeyWriteForOwner(text, paramsAlias, aliases)) return true;
    }
  }
  return false;
}

function containsForbiddenInlineRouteUrlCallbackMutation(source, aliases, externalAliases, staticRelativeAliases) {
  const text = safeString(source);
  const callbackMutatesRouteUrl = (body, owner) => {
    if (containsRouteKeyWriteForOwner(body, owner, aliases, 'searchParams')) return true;
    const paramsAliases = collectSearchParamsAliasesForRouteUrl(body, owner);
    for (const paramsAlias of paramsAliases) {
      if (containsRouteKeyWriteForOwner(body, paramsAlias, aliases)) return true;
    }
    return false;
  };
  const containingBlockSpan = (index) => {
    const stack = [];
    let quote = '';
    let escaped = false;
    for (let i = 0; i < Math.max(0, index); i += 1) {
      const ch = text[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '{') stack.push(i);
      else if (ch === '}' && stack.length) stack.pop();
    }
    const open = stack.length ? stack[stack.length - 1] : -1;
    if (open < 0) return { start: 0, end: text.length };
    const span = extractBlockSpan(text, open);
    return { start: open + 1, end: Math.max(open + 1, span.end - 1) };
  };
  const argsAreRelative = (argsStart) => {
    const parsed = extractCallArgs(text, argsStart);
    return {
      relative: !urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases),
      end: parsed.end
    };
  };
  const expressionIsRelativeNewUrl = (expression) => {
    let value = safeString(expression).trim();
    while (value.startsWith('(')) {
      const parsed = extractCallArgs(value, 1);
      if (value.slice(parsed.end).trim()) break;
      value = parsed.args.trim();
    }
    const match = value.match(/^new\s+URL\s*\(/);
    if (!match) return false;
    const parsed = extractCallArgs(value, match[0].length);
    return !urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases);
  };
  const applyArrayFirstArgIsRelativeNewUrl = (expression) => {
    const value = safeString(expression).trim();
    if (!value.startsWith('[')) return false;
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let i = 0; i < value.length; i += 1) {
      const ch = value[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '[') depth += 1;
      else if (ch === ']') {
        depth -= 1;
        if (depth === 0) {
          const args = splitTopLevelArgs(value.slice(1, i));
          return expressionIsRelativeNewUrl(args[0] || '');
        }
      }
    }
    return false;
  };
  const callbackOwnerIndexes = (paramsText, body) => {
    const out = [];
    splitTopLevelArgs(paramsText).forEach((param, ownerIndex) => {
      const simple = safeString(param).trim().match(/^([A-Za-z_$][\w$]*)$/);
      if (simple && callbackMutatesRouteUrl(body, simple[1])) out.push(ownerIndex);
    });
    return out;
  };
  const callbackInvocationArgs = (method, argsText) => {
    const parts = splitTopLevelArgs(argsText);
    if (method === 'direct') return parts;
    if (method === 'call') return parts.slice(1);
    const arrayArg = safeString(parts[1] || '').trim();
    if (!arrayArg.startsWith('[')) return [];
    const close = arrayArg.lastIndexOf(']');
    return splitTopLevelArgs(close >= 0 ? arrayArg.slice(1, close) : arrayArg.slice(1));
  };
  const inlineCallbackInvocationIsForbidden = (paramsText, body, method, argsStart) => {
    const parsed = extractCallArgs(text, argsStart);
    const actualArgs = callbackInvocationArgs(method, parsed.args);
    return {
      end: parsed.end,
      forbidden: callbackOwnerIndexes(paramsText, body).some((ownerIndex) => expressionIsRelativeNewUrl(actualArgs[ownerIndex] || ''))
    };
  };
  const callIsShadowedInNestedScope = (name, scope, scopedCallIndex) => {
    const globalCallIndex = scope.start + scopedCallIndex;
    const rootName = safeString(name).split(/\s*\.\s*/).filter(Boolean)[0] || '';
    if (!rootName) return false;
    const before = text.slice(scope.start, globalCallIndex);
    const scopeStack = blockStackAt(text, scope.start);
    const callStack = blockStackAt(text, globalCallIndex);
    const stackIsCallAncestor = (stack) => (
      stack.length > scopeStack.length
      && stack.length <= callStack.length
      && stack.every((open, index) => callStack[index] === open)
    );
    const shadowRe = new RegExp(`\\b(?:const|let|var|function)\\s+${escapeRegExp(rootName)}\\b`, 'g');
    let shadow = shadowRe.exec(before);
    while (shadow) {
      if (stackIsCallAncestor(blockStackAt(text, scope.start + shadow.index))) return true;
      shadow = shadowRe.exec(before);
    }
    return false;
  };
  const callbackCallSuffix = new RegExp(`^\\s*\\)\\s*(?:(?:\\?\\.\\s*)?\\(|(?:\\?\\.\\s*)?\\.\\s*(call|apply)\\s*(?:\\?\\.\\s*)?\\(|\\?\\.\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\]\\s*(?:\\?\\.\\s*)?\\(|\\[\\s*["'\`](call|apply)["'\`]\\s*\\]\\s*(?:\\?\\.\\s*)?\\()`);
  const re = new RegExp(`\\(\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*\\(([\\s\\S]*?)\\)\\s*\\)\\s*\\(\\s*new\\s+URL\\s*\\(`, 'g');
  let match = re.exec(text);
  while (match) {
    const parsed = argsAreRelative(re.lastIndex);
    if (parsed.relative && callbackMutatesRouteUrl(match[2] || '', match[1])) {
      return true;
    }
    if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
    match = re.exec(text);
  }
  const callRe = new RegExp(`\\(\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*\\(([\\s\\S]*?)\\)\\s*\\)\\s*\\.\\s*call\\s*\\(\\s*[\\s\\S]*?,\\s*new\\s+URL\\s*\\(`, 'g');
  match = callRe.exec(text);
  while (match) {
    const parsed = argsAreRelative(callRe.lastIndex);
    if (parsed.relative && callbackMutatesRouteUrl(match[2] || '', match[1])) return true;
    if (parsed.end > callRe.lastIndex) callRe.lastIndex = parsed.end;
    match = callRe.exec(text);
  }
  const applyRe = new RegExp(`\\(\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*\\(([\\s\\S]*?)\\)\\s*\\)\\s*\\.\\s*apply\\s*\\(\\s*[\\s\\S]*?,\\s*\\[\\s*new\\s+URL\\s*\\(`, 'g');
  match = applyRe.exec(text);
  while (match) {
    const parsed = argsAreRelative(applyRe.lastIndex);
    if (parsed.relative && callbackMutatesRouteUrl(match[2] || '', match[1])) return true;
    if (parsed.end > applyRe.lastIndex) applyRe.lastIndex = parsed.end;
    match = applyRe.exec(text);
  }
  const expressionMethodRe = /\(\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\(/g;
  match = expressionMethodRe.exec(text);
  while (match) {
    const bodyParsed = extractCallArgs(text, expressionMethodRe.lastIndex);
    const suffix = text.slice(bodyParsed.end).match(callbackCallSuffix);
    if (suffix) {
      const argsStart = bodyParsed.end + suffix[0].length;
      const parsed = inlineCallbackInvocationIsForbidden(match[1], bodyParsed.args, suffix[1] || suffix[2] || suffix[3] || 'direct', argsStart);
      if (parsed.forbidden) return true;
      if (parsed.end > expressionMethodRe.lastIndex) expressionMethodRe.lastIndex = parsed.end;
    } else if (bodyParsed.end > expressionMethodRe.lastIndex) {
      expressionMethodRe.lastIndex = bodyParsed.end;
    }
    match = expressionMethodRe.exec(text);
  }
  const blockArrowRe = new RegExp(`\\(\\s*(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENTIFIER_PATTERN.source}))\\s*=>\\s*\\{`, 'g');
  match = blockArrowRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, blockArrowRe.lastIndex - 1);
    const suffix = text.slice(span.end).match(callbackCallSuffix);
    if (suffix) {
      const parsed = inlineCallbackInvocationIsForbidden(match[1] || match[2], span.body, suffix[1] || suffix[2] || suffix[3] || 'direct', span.end + suffix[0].length);
      if (parsed.forbidden) return true;
      if (parsed.end > blockArrowRe.lastIndex) blockArrowRe.lastIndex = parsed.end;
    }
    match = blockArrowRe.exec(text);
  }
  const functionRe = new RegExp(`\\(\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  match = functionRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, functionRe.lastIndex - 1);
    const suffix = text.slice(span.end).match(callbackCallSuffix);
    if (suffix) {
      const parsed = inlineCallbackInvocationIsForbidden(match[1], span.body, suffix[1] || suffix[2] || suffix[3] || 'direct', span.end + suffix[0].length);
      if (parsed.forbidden) return true;
      if (parsed.end > functionRe.lastIndex) functionRe.lastIndex = parsed.end;
    }
    match = functionRe.exec(text);
  }
  const mutators = [];
  const addMutator = (name, owner, body, index, scope = null, ownerIndex = 0) => {
    if (!callbackMutatesRouteUrl(body, owner)) return;
    mutators.push({ name, scope: scope || containingBlockSpan(index), ownerIndex });
  };
  const addMutatorsForParams = (name, paramsText, body, index, scope = null) => {
    splitTopLevelArgs(paramsText).forEach((param, ownerIndex) => {
      const simple = safeString(param).trim().match(/^([A-Za-z_$][\w$]*)$/);
      if (simple) addMutator(name, simple[1], body, index, scope, ownerIndex);
    });
  };
  const mutatorExpressionArrowRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*`, 'g');
  match = mutatorExpressionArrowRe.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, mutatorExpressionArrowRe.lastIndex);
    addMutator(match[1], match[2], expression, match.index);
    mutatorExpressionArrowRe.lastIndex += expression.length;
    match = mutatorExpressionArrowRe.exec(text);
  }
  const mutatorArrowRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*\\{`, 'g');
  match = mutatorArrowRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, mutatorArrowRe.lastIndex - 1);
    addMutator(match[1], match[2], span.body, match.index);
    match = mutatorArrowRe.exec(text);
  }
  const mutatorFunctionExpressionRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)\\s*\\{`, 'g');
  match = mutatorFunctionExpressionRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, mutatorFunctionExpressionRe.lastIndex - 1);
    addMutator(match[1], match[2], span.body, match.index);
    match = mutatorFunctionExpressionRe.exec(text);
  }
  const mutatorFunctionRe = new RegExp(`\\bfunction\\s+(${IDENTIFIER_PATTERN.source})\\s*\\(\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)\\s*\\{`, 'g');
  match = mutatorFunctionRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, mutatorFunctionRe.lastIndex - 1);
    addMutator(match[1], match[2], span.body, match.index);
    match = mutatorFunctionRe.exec(text);
  }
  const mutatorParenthesizedArrowRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>\\s*`, 'g');
  match = mutatorParenthesizedArrowRe.exec(text);
  while (match) {
    if (text[mutatorParenthesizedArrowRe.lastIndex] === '{') {
      const span = extractBlockSpan(text, mutatorParenthesizedArrowRe.lastIndex);
      addMutatorsForParams(match[1], match[2], span.body, match.index);
    } else {
      const expression = extractAssignmentExpression(text, mutatorParenthesizedArrowRe.lastIndex);
      addMutatorsForParams(match[1], match[2], expression, match.index);
      mutatorParenthesizedArrowRe.lastIndex += expression.length;
    }
    match = mutatorParenthesizedArrowRe.exec(text);
  }
  const mutatorFunctionExpressionParamsRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  match = mutatorFunctionExpressionParamsRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, mutatorFunctionExpressionParamsRe.lastIndex - 1);
    addMutatorsForParams(match[1], match[2], span.body, match.index);
    match = mutatorFunctionExpressionParamsRe.exec(text);
  }
  const mutatorFunctionParamsRe = new RegExp(`\\bfunction\\s+(${IDENTIFIER_PATTERN.source})\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  match = mutatorFunctionParamsRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, mutatorFunctionParamsRe.lastIndex - 1);
    addMutatorsForParams(match[1], match[2], span.body, match.index);
    match = mutatorFunctionParamsRe.exec(text);
  }
  const objectLiteralRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*\\{`, 'g');
  match = objectLiteralRe.exec(text);
  while (match) {
    const objectName = match[1];
    const objectScope = containingBlockSpan(match.index);
    const objectSpan = extractBlockSpan(text, objectLiteralRe.lastIndex - 1);
    const objectBodyStart = objectLiteralRe.lastIndex;
    const methodRe = new RegExp(`\\b(${IDENTIFIER_PATTERN.source})\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
    let method = methodRe.exec(objectSpan.body);
    while (method) {
      const methodOpenBrace = objectBodyStart + methodRe.lastIndex - 1;
      const methodSpan = extractBlockSpan(text, methodOpenBrace);
      addMutatorsForParams(`${objectName}.${method[1]}`, method[2], methodSpan.body, match.index, objectScope);
      methodRe.lastIndex = Math.max(methodRe.lastIndex, methodSpan.end - objectBodyStart);
      method = methodRe.exec(objectSpan.body);
    }
    if (objectSpan.end > objectLiteralRe.lastIndex) objectLiteralRe.lastIndex = objectSpan.end;
    match = objectLiteralRe.exec(text);
  }
  for (let i = 0; i < mutators.length; i += 1) {
    const { name, scope, ownerIndex } = mutators[i];
    const scopedText = text.slice(scope.start, scope.end);
    const bindRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*${expressionReferencePattern(name)}${propertyAccessorPattern('bind')}\\s*(?:\\?\\.\\s*)?\\(`, 'g');
    let bind = bindRe.exec(scopedText);
    while (bind) {
      const parsed = extractCallArgs(scopedText, bindRe.lastIndex);
      const boundArgs = splitTopLevelArgs(parsed.args).slice(1);
      if (expressionIsRelativeNewUrl(boundArgs[ownerIndex] || '')
        && !callIsShadowedInNestedScope(name, scope, bind.index)) return true;
      const remainingOwnerIndex = ownerIndex - boundArgs.length;
      if (remainingOwnerIndex >= 0) mutators.push({ name: bind[1], scope, ownerIndex: remainingOwnerIndex });
      if (parsed.end > bindRe.lastIndex) bindRe.lastIndex = parsed.end;
      bind = bindRe.exec(scopedText);
    }
  }
  for (const { name, scope, ownerIndex } of mutators) {
    const scopedText = text.slice(scope.start, scope.end);
    const calleePattern = expressionReferencePattern(name);
    const directCallRe = new RegExp(`(^|[^\\w$.])${calleePattern}\\s*(?:\\?\\.\\s*)?\\(`, 'g');
    match = directCallRe.exec(scopedText);
    while (match) {
      const parsed = extractCallArgs(scopedText, directCallRe.lastIndex);
      const parts = splitTopLevelArgs(parsed.args);
      if (expressionIsRelativeNewUrl(parts[ownerIndex] || '')
        && !callIsShadowedInNestedScope(name, scope, match.index)) return true;
      if (parsed.end > directCallRe.lastIndex) directCallRe.lastIndex = parsed.end;
      match = directCallRe.exec(scopedText);
    }
    const methodCallRe = new RegExp(`${calleePattern}(?:\\s*(?:\\?\\.\\s*)?\\.\\s*(call|apply)|\\s*\\?\\.\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\]|\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\])\\s*(?:\\?\\.\\s*)?\\(`, 'g');
    match = methodCallRe.exec(scopedText);
    while (match) {
      const method = match[1] || match[2] || match[3];
      const parsed = extractCallArgs(scopedText, methodCallRe.lastIndex);
      const parts = splitTopLevelArgs(parsed.args);
      const applyArgs = method === 'apply' ? splitTopLevelArgs((parts[1] || '').trim().replace(/^\[\s*|\s*\]$/g, '')) : [];
      const relative = method === 'apply'
        ? expressionIsRelativeNewUrl(applyArgs[ownerIndex] || '')
        : expressionIsRelativeNewUrl(parts[ownerIndex + 1] || '');
      if (relative && !callIsShadowedInNestedScope(name, scope, match.index)) return true;
      if (parsed.end > methodCallRe.lastIndex) methodCallRe.lastIndex = parsed.end;
      match = methodCallRe.exec(scopedText);
    }
  }
  return false;
}

function collectSearchParamsAliasesForRouteUrl(source, owner) {
  const text = safeString(source);
  const out = new Set();
  const ownerPattern = expressionReferencePattern(owner);
  const searchParamsAccess = propertyAccessorPattern('searchParams');
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*${ownerPattern}${searchParamsAccess}(?:\\s*\\))*`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*${ownerPattern}${searchParamsAccess}(?:\\s*\\))*`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      out.add(match[1]);
      match = re.exec(text);
    }
  });
  const destructureRe = new RegExp(`\\b(?:const|let|var)\\s*\\{([\\s\\S]*?)\\}\\s*=\\s*${ownerPattern}\\b`, 'g');
  let destructure = destructureRe.exec(text);
  while (destructure) {
    const body = destructure[1] || '';
    const aliasRe = /(?:^|,)\s*searchParams\s*:\s*([A-Za-z_$][\w$]*)/g;
    let alias = aliasRe.exec(body);
    while (alias) {
      out.add(alias[1]);
      alias = aliasRe.exec(body);
    }
    if (/(?:^|,)\s*searchParams\s*(?:,|$)/.test(body)) out.add('searchParams');
    destructure = destructureRe.exec(text);
  }
  return out;
}

function collectInlineUrlSearchParamsAliases(source) {
  const text = safeString(source);
  const out = new Set();
  const searchParamsAccess = propertyAccessorPattern('searchParams');
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+URL\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+URL\\s*\\(`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const parsed = extractCallArgs(text, re.lastIndex);
      const suffix = text.slice(parsed.end).match(new RegExp(`^\\s*(?:\\))*${searchParamsAccess}`));
      if (suffix) out.add(match[1]);
      if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
      match = re.exec(text);
    }
  });
  const destructureRe = /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*new\s+URL\s*\(/g;
  let destructure = destructureRe.exec(text);
  while (destructure) {
    const parsed = extractCallArgs(text, destructureRe.lastIndex);
    const body = destructure[1] || '';
    const aliasRe = /(?:^|,)\s*searchParams\s*:\s*([A-Za-z_$][\w$]*)/g;
    let alias = aliasRe.exec(body);
    while (alias) {
      out.add(alias[1]);
      alias = aliasRe.exec(body);
    }
    if (/(?:^|,)\s*searchParams\s*(?:,|$)/.test(body)) out.add('searchParams');
    if (parsed.end > destructureRe.lastIndex) destructureRe.lastIndex = parsed.end;
    destructure = destructureRe.exec(text);
  }
  return out;
}

function containsForbiddenLocationSearchAssignment(source, aliases = new Set()) {
  const text = safeString(source);
  const queryAliases = collectRouteQueryAliases(text, aliases);
  const re = locationSearchWritePattern(collectLocationAliases(text));
  let match = re.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, re.lastIndex);
    if (urlSearchParamsInitializerHasRouteKey(expression, aliases)
      || expressionIsQueryAliasReference(expression, queryAliases)) return true;
    match = re.exec(text);
  }
  return false;
}

function containsForbiddenExecutableRouteCode(text, aliases, externalAliases, staticRelativeAliases) {
  const inlineSearchParamsAliases = collectInlineUrlSearchParamsAliases(text);
  const queryAliases = collectRouteQueryAliases(text, aliases);
  return containsForbiddenRouteLiteral(text, externalAliases)
    || containsForbiddenLocationSearchAssignment(text, aliases)
    || containsRelativeQueryAliasSerialization(text, queryAliases, externalAliases)
    || containsForbiddenUrlSearchParamsInitializer(text, aliases, externalAliases)
    || containsForbiddenInlineUrlSearchParamsInitializer(text, aliases, externalAliases)
    || containsForbiddenSplitRouteQueryLiteral(text, externalAliases)
    || containsForbiddenRouteKeyAliasConstruction(text, aliases, externalAliases)
    || containsForbiddenUrlSearchParamsVariable(text, aliases, externalAliases)
    || containsForbiddenRouteUrlMutation(text, aliases, externalAliases, staticRelativeAliases)
    || containsForbiddenInlineRouteUrlCallbackMutation(text, aliases, externalAliases, staticRelativeAliases)
    || Array.from(inlineSearchParamsAliases).some((name) => (
      containsRouteKeyWriteForOwner(text, name, aliases) && containsRelativeParamsSerialization(text, name, new Set(), externalAliases)
    ));
}

function routeBodyShadowsExternalAlias(params, body, externalAliases, shadowCandidates) {
  if (!shadowCandidates || !shadowCandidates.size || !routeGuardBodyLooksRelevant(body)) return null;
  const bindings = new Set();
  const bodyExternalAliases = collectExternalUrlAliases(topLevelRouteGuardSource(body));
  addBindingNamesFromPattern(bindings, params);
  addLocalDeclarationBindings(bindings, body, { topLevelOnly: true });
  let shadowed = false;
  const scopedExternalAliases = new Set(externalAliases);
  bindings.forEach((name) => {
    if (shadowCandidates.has(name) && !bodyExternalAliases.has(name)) {
      scopedExternalAliases.delete(name);
      shadowed = true;
    }
  });
  return shadowed ? scopedExternalAliases : null;
}

function containsForbiddenShadowedExternalAliasRouteCode(source, aliases, externalAliases, shadowCandidates, staticRelativeAliases) {
  const text = safeString(source);
  const scanBody = (params, body) => {
    const scopedExternalAliases = routeBodyShadowsExternalAlias(params, body, externalAliases, shadowCandidates);
    return scopedExternalAliases
      ? containsForbiddenExecutableRouteCode(body, aliases, scopedExternalAliases, staticRelativeAliases)
      : false;
  };
  const catchParamsBeforeBlock = (openBraceIndex) => {
    const before = text.slice(0, openBraceIndex);
    const match = before.match(/\bcatch\s*\(([^)]*)\)\s*$/);
    return match ? match[1] : '';
  };
  const loopParamsBeforeBlock = (openBraceIndex) => {
    const before = text.slice(0, openBraceIndex);
    const loop = before.match(/\bfor\s*(?:await\s*)?\(([\s\S]*)\)\s*$/);
    if (!loop) return '';
    const declaration = loop[1].match(/^\s*(?:const|let|var)\s+([\s\S]*?)(?:\s+(?:of|in)\b|[;=]|$)/);
    return declaration ? declaration[1] : '';
  };
  const functionRe = /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)\s*\{/g;
  let match = functionRe.exec(text);
  while (match) {
    if (scanBody(match[1], extractBlockText(text, functionRe.lastIndex - 1))) return true;
    match = functionRe.exec(text);
  }
  const arrowRe = /(?:^|[^\w$])(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g;
  match = arrowRe.exec(text);
  while (match) {
    if (scanBody(match[1], extractBlockText(text, arrowRe.lastIndex - 1))) return true;
    match = arrowRe.exec(text);
  }
  const expressionArrowRe = /(?:^|[^\w$])(?:async\s*)?\(([^)]*)\)\s*=>\s*(?!\s*\{)/g;
  match = expressionArrowRe.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, expressionArrowRe.lastIndex);
    if (scanBody(match[1], expression)) return true;
    expressionArrowRe.lastIndex += expression.length;
    match = expressionArrowRe.exec(text);
  }
  const singleArrowRe = /(?:^|[^\w$])(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  match = singleArrowRe.exec(text);
  while (match) {
    if (scanBody(match[1], extractBlockText(text, singleArrowRe.lastIndex - 1))) return true;
    match = singleArrowRe.exec(text);
  }
  const singleExpressionArrowRe = /(?:^|[^\w$])(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>\s*(?!\s*\{)/g;
  match = singleExpressionArrowRe.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, singleExpressionArrowRe.lastIndex);
    if (scanBody(match[1], expression)) return true;
    singleExpressionArrowRe.lastIndex += expression.length;
    match = singleExpressionArrowRe.exec(text);
  }
  const methodRe = /(?:^|[,{]\s*)(?:async\s+)?[A-Za-z_$][\w$]*\s*\(([^)]*)\)\s*\{/g;
  match = methodRe.exec(text);
  while (match) {
    if (scanBody(match[1], extractBlockText(text, methodRe.lastIndex - 1))) return true;
    match = methodRe.exec(text);
  }
  const blockRe = /\{/g;
  match = blockRe.exec(text);
  while (match) {
    const params = catchParamsBeforeBlock(match.index) || loopParamsBeforeBlock(match.index);
    if (scanBody(params, extractBlockText(text, match.index))) return true;
    match = blockRe.exec(text);
  }
  return false;
}

function containsForbiddenV4RouteConstruction(source, contextSource = source) {
  const rawText = safeString(source);
  const text = stripCommentsForRouteGuard(rawText);
  const context = normalizeRouteGuardContext(contextSource, text);
  const aliases = mergeImportedContextAliases(collectRouteKeyAliases(text), collectRouteKeyAliases, text, context, { shadow: false });
  const localExternalAliases = collectExternalUrlAliases(text);
  const importedExternalAliases = mergeImportedContextAliases(new Set(), collectExternalUrlAliases, text, context, { shadow: false });
  const externalAliases = new Set([...localExternalAliases, ...importedExternalAliases]);
  const staticRelativeAliases = mergeImportedContextAliases(collectStaticRelativeUrlAliases(text), collectStaticRelativeUrlAliases, text, context, { shadow: false });
  const hasForbiddenCode = shouldScanExecutableRouteCode(context.path) && (
    containsForbiddenExecutableRouteCode(text, aliases, externalAliases, staticRelativeAliases)
    || containsForbiddenShadowedExternalAliasRouteCode(text, aliases, externalAliases, externalAliases, staticRelativeAliases)
  );
  return hasForbiddenCode
    || (shouldScanHtmlRouteAttributes(context.path, rawText)
      && containsForbiddenHtmlRouteAttribute(stripHtmlCommentsForRouteGuard(rawText)));
}

export function normalizeDigest(value, options = {}) {
  const raw = safeString(value).trim().toLowerCase();
  if (!raw) {
    if (options.required) throw new Error('Theme release manifest asset digest is required.');
    return '';
  }
  const hex = raw.startsWith('sha256:') ? raw.slice(7) : raw;
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new Error('Theme release manifest asset digest must be a SHA-256 hash.');
  }
  return `sha256:${hex}`;
}

export function normalizeThemeEngines(input, options = {}) {
  const engines = input && typeof input === 'object' ? input : {};
  const press = safeString(engines.press || '').trim();
  if (!press && options.required) throw new Error('Theme manifest engines.press is required.');
  return press ? { press } : {};
}

export async function assertThemePressCompatibility(label, engines) {
  const normalized = normalizeThemeEngines(engines, { required: true });
  const current = await loadPressSystemManifest();
  if (!satisfiesSemverRange(current.version, normalized.press)) {
    throw new Error(`${label || 'Theme'} supports Press ${normalized.press}, but this site is running ${current.tag}.`);
  }
}

export function sanitizeThemeSlug(value) {
  const slug = safeString(value).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
  if (!THEME_SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid theme slug: ${safeString(value) || '(empty)'}`);
  }
  return slug;
}

export function normalizeThemeFilePath(path) {
  const raw = safeString(path).replace(/\\+/g, '/');
  if (!raw || raw.endsWith('/')) return '';
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  const clean = raw.replace(/^\/+/, '');
  const parts = clean.split('/');
  if (parts.some((part) => !part || part === '..' || part === '.')) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  if (clean !== 'theme.json' && clean.endsWith('/theme.json')) {
    throw new Error('Theme ZIP must contain exactly one theme.json at the theme root.');
  }
  if (clean !== 'theme.json' && !THEME_ARCHIVE_ALLOWED_EXTENSIONS.has(extname(clean))) {
    throw new Error(`Unsupported theme archive file type: ${clean}`);
  }
  return clean;
}

function validateRawThemeArchivePath(path) {
  const raw = safeString(path).replace(/\\+/g, '/');
  if (!raw || raw.endsWith('/')) return '';
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  const parts = raw.split('/');
  if (parts.some((part) => !part || part === '..' || part === '.')) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  return raw;
}

function stripCommonArchiveRoot(entries) {
  const paths = entries.map((name) => safeString(name).replace(/\\+/g, '/'));
  if (!paths.length) return [];
  const segments = paths.map((p) => p.split('/'));
  if (!segments.every((parts) => parts.length > 1)) return paths;
  const root = segments[0][0];
  if (!segments.every((parts) => parts[0] === root)) return paths;
  return segments.map((parts) => parts.slice(1).join('/'));
}

export function normalizeFileList(files) {
  const normalized = [];
  const seen = new Set();
  (Array.isArray(files) ? files : []).forEach((file) => {
    const path = normalizeThemeFilePath(file);
    if (!path || seen.has(path)) return;
    seen.add(path);
    normalized.push(path);
  });
  normalized.sort((a, b) => a.localeCompare(b));
  return normalized;
}

function requireThemeObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Theme manifest ${label} must be an object.`);
  }
  return value;
}

function requireThemeString(value, label) {
  const text = safeString(value).trim();
  if (!text) throw new Error(`Theme manifest ${label} is required.`);
  return text;
}

function requireThemeStringList(owner, key, label) {
  if (!Array.isArray(owner && owner[key])) {
    throw new Error(`Theme manifest ${label} must be an array.`);
  }
  const seen = new Set();
  return owner[key].map((item) => {
    const value = requireThemeString(item, label);
    if (seen.has(value)) throw new Error(`Theme manifest ${label} contains duplicate value: ${value}`);
    seen.add(value);
    return value;
  });
}

function validateThemeManifestFiles(themeManifest, availablePaths) {
  let styles = [];
  if (themeManifest.styles != null) {
    styles = requireThemeStringList(themeManifest, 'styles', 'styles');
  }
  if (!styles.length) styles = DEFAULT_THEME_STYLES;
  const modules = requireThemeStringList(themeManifest, 'modules', 'modules');
  if (!modules.length) throw new Error('Theme manifest modules must not be empty.');

  const normalizedModules = new Set();
  styles.forEach((entry) => {
    const path = normalizeThemeFilePath(entry);
    if (extname(path) !== '.css') throw new Error(`Theme manifest styles entry must be a CSS file: ${entry}`);
    if (!availablePaths.has(path)) throw new Error(`Theme manifest styles references missing file: ${path}`);
  });
  modules.forEach((entry) => {
    const path = normalizeThemeFilePath(entry);
    if (extname(path) !== '.js') throw new Error(`Theme manifest modules entry must be a JS file: ${entry}`);
    if (!availablePaths.has(path)) throw new Error(`Theme manifest modules references missing file: ${path}`);
    normalizedModules.add(path);
  });
  return normalizedModules;
}

function validateThemeViewDeclaration(views, view, modules) {
  const declaration = requireThemeObject(views[view], `views.${view}`);
  const modulePath = normalizeThemeFilePath(requireThemeString(declaration.module, `views.${view}.module`));
  requireThemeString(declaration.handler, `views.${view}.handler`);
  if (!modules.has(modulePath)) {
    throw new Error(`Theme manifest views.${view}.module must be listed in modules: ${modulePath}`);
  }
}

function validateThemeManifestContract(themeManifest, availablePaths) {
  requireThemeObject(themeManifest, 'theme.json');
  requireThemeString(themeManifest.name, 'name');
  requireThemeString(themeManifest.version, 'version');
  normalizeThemeEngines(themeManifest.engines, { required: true });
  const contractVersion = Number(themeManifest.contractVersion);
  if (!isPressThemeContractVersionSupported(contractVersion)) {
    throw new Error(`Theme contractVersion ${contractVersion || '(missing)'} is not supported.`);
  }

  const modules = validateThemeManifestFiles(themeManifest, availablePaths);
  const views = requireThemeObject(themeManifest.views, 'views');
  REQUIRED_THEME_VIEWS.forEach((view) => {
    validateThemeViewDeclaration(views, view, modules);
  });
  OPTIONAL_THEME_VIEWS.forEach((view) => {
    if (views[view] != null) validateThemeViewDeclaration(views, view, modules);
  });

  const regions = requireThemeObject(themeManifest.regions, 'regions');
  REQUIRED_THEME_REGIONS.forEach((region) => {
    requireThemeObject(regions[region], `regions.${region}`);
  });

  const components = new Set(requireThemeStringList(themeManifest, 'components', 'components'));
  REQUIRED_THEME_COMPONENTS.forEach((component) => {
    if (!components.has(component)) throw new Error(`Theme manifest components must include ${component}.`);
  });

  if (!Object.prototype.hasOwnProperty.call(themeManifest, 'scrollContainer')) {
    throw new Error('Theme manifest scrollContainer is required.');
  }
  requireThemeObject(themeManifest.configSchema, 'configSchema');
  const content = requireThemeObject(themeManifest.content, 'content');
  const shapes = new Set(requireThemeStringList(content, 'shapes', 'content.shapes'));
  REQUIRED_THEME_CONTENT_SHAPES.forEach((shape) => {
    if (!shapes.has(shape)) throw new Error(`Theme manifest content.shapes must include ${shape}.`);
  });

  return contractVersion;
}

function validateThemeRouteHelperContract(entries, contractVersion) {
  if (Number(contractVersion) < ROUTE_HELPER_CONTRACT_VERSION) return;
  const routeGuardFiles = entries
    .filter((entry) => entry && entry.path && isThemeTextPath(entry.path) && entry.path !== 'theme.json')
    .map((entry) => ({ path: entry.path, source: strFromU8(entry.data) }));
  entries.forEach((entry) => {
    if (!entry || !entry.path || !isThemeTextPath(entry.path)) return;
    if (entry.path === 'theme.json') return;
    const source = strFromU8(entry.data);
    if (containsForbiddenV4RouteConstruction(source, { path: entry.path, files: routeGuardFiles })) {
      throw new Error(`Theme contractVersion 4 requires router href helpers instead of public route construction in ${entry.path}.`);
    }
  });
}

function normalizeRegistrySource(input, fallbackType) {
  const source = input && typeof input === 'object' ? input : {};
  const type = safeString(source.type || fallbackType || 'manual').trim().toLowerCase() || 'manual';
  const normalized = { type };
  if (source.repo) normalized.repo = safeString(source.repo).trim();
  if (source.manifestUrl) normalized.manifestUrl = safeString(source.manifestUrl).trim();
  if (source.url) normalized.url = safeString(source.url).trim();
  return normalized;
}

export function normalizeRegistryRelease(input) {
  const release = input && typeof input === 'object' ? input : {};
  const normalized = {};
  if (release.tag) normalized.tag = safeString(release.tag).trim();
  if (release.name) normalized.name = safeString(release.name).trim();
  if (release.htmlUrl) normalized.htmlUrl = safeString(release.htmlUrl).trim();
  if (release.publishedAt) normalized.publishedAt = safeString(release.publishedAt).trim();
  if (release.assetName) normalized.assetName = safeString(release.assetName).trim();
  if (release.size != null && Number.isFinite(Number(release.size))) normalized.size = Number(release.size);
  if (release.digest) normalized.digest = normalizeDigest(release.digest);
  if (release.installedAt) normalized.installedAt = safeString(release.installedAt).trim();
  return normalized;
}

export function normalizeThemeRegistry(input) {
  const normalized = [];
  const seen = new Set();
  (Array.isArray(input) ? input : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const value = sanitizeThemeSlug(entry.value);
    if (seen.has(value)) return;
    seen.add(value);
    const builtIn = value === 'native' || entry.builtIn === true;
    const contractVersion = Number(entry.contractVersion);
    const item = {
      value,
      label: safeString(entry.label || entry.name || value) || value,
      version: safeString(entry.version || ''),
      contractVersion: Number.isFinite(contractVersion) && contractVersion > 0 ? Math.floor(contractVersion) : 0,
      engines: normalizeThemeEngines(entry.engines),
      builtIn,
      removable: builtIn ? false : entry.removable !== false,
      source: normalizeRegistrySource(entry.source, builtIn ? 'builtin' : 'manual'),
      release: normalizeRegistryRelease(entry.release),
      files: normalizeFileList(entry.files)
    };
    if (builtIn) {
      item.contractVersion = REQUIRED_THEME_CONTRACT_VERSION;
      item.source = { type: 'builtin' };
      item.removable = false;
    }
    normalized.push(item);
  });
  if (!seen.has('native')) {
    normalized.unshift({
      value: 'native',
      label: 'Native',
      version: '',
      contractVersion: REQUIRED_THEME_CONTRACT_VERSION,
      engines: {},
      builtIn: true,
      removable: false,
      source: { type: 'builtin' },
      release: {},
      files: []
    });
  }
  return normalized;
}

export function normalizeThemeCatalog(input) {
  const themes = Array.isArray(input) ? input : (input && Array.isArray(input.themes) ? input.themes : []);
  const normalized = [];
  const seen = new Set();
  themes.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const value = sanitizeThemeSlug(entry.value || entry.slug);
    if (seen.has(value)) return;
    const manifestUrl = safeString(entry.manifestUrl || entry.releaseManifestUrl).trim();
    if (!manifestUrl) throw new Error(`Official theme catalog entry ${value} is missing manifestUrl.`);
    seen.add(value);
    normalized.push({
      value,
      label: safeString(entry.label || entry.name || value) || value,
      repo: safeString(entry.repo || '').trim(),
      manifestUrl,
      description: safeString(entry.description || '').trim()
    });
  });
  return normalized;
}

export function normalizeThemeReleaseManifest(input) {
  if (!input || typeof input !== 'object') throw new Error('Theme release manifest is missing.');
  if (Number(input.schemaVersion) !== 1 || input.type !== 'press-theme') {
    throw new Error('Theme release manifest must be schemaVersion 1 and type "press-theme".');
  }
  const value = sanitizeThemeSlug(input.value || input.slug);
  const version = safeString(input.version || '').trim();
  if (!version) throw new Error('Theme release manifest version is required.');
  const contractVersion = Number(input.contractVersion);
  if (!isPressThemeContractVersionSupported(contractVersion)) {
    throw new Error(`Theme contractVersion ${contractVersion || '(missing)'} is not supported.`);
  }
  const engines = normalizeThemeEngines(input.engines, { required: true });
  const asset = input.asset && typeof input.asset === 'object' ? input.asset : null;
  if (!asset) throw new Error('Theme release manifest asset is required.');
  const assetName = safeString(asset.name || '').trim();
  if (!THEME_RELEASE_ASSET_PATTERN.test(assetName)) {
    throw new Error('Theme release manifest asset must be a press-theme-<slug>-vX.Y.Z.zip file.');
  }
  const assetSlugMatch = assetName.match(/^press-theme-([a-z0-9_-]+)-v/i);
  if (assetSlugMatch && assetSlugMatch[1].toLowerCase() !== value) {
    throw new Error('Theme release manifest asset name does not match the theme slug.');
  }
  const url = safeString(asset.url || asset.browser_download_url || '').trim();
  if (!url) throw new Error('Theme release manifest asset url is required.');
  const size = Number(asset.size);
  if (!Number.isFinite(size) || size <= 0) throw new Error('Theme release manifest asset size is required.');
  const release = input.release && typeof input.release === 'object' ? input.release : {};
  return {
    schemaVersion: 1,
    type: 'press-theme',
    value,
    label: safeString(input.label || input.name || value) || value,
    version,
    contractVersion,
    engines,
    release: {
      tag: safeString(release.tag || input.tag || '').trim(),
      name: safeString(release.name || input.name || '').trim(),
      htmlUrl: safeString(release.htmlUrl || input.htmlUrl || '').trim(),
      publishedAt: safeString(release.publishedAt || input.publishedAt || '').trim(),
      notes: safeString(release.notes || input.notes || '').trim()
    },
    asset: {
      name: assetName,
      url,
      size,
      digest: normalizeDigest(asset.digest, { required: true })
    },
    files: normalizeFileList(input.files)
  };
}

export function themeFilesFromManifest(manifest) {
  const files = [];
  const add = (value) => {
    if (typeof value !== 'string') return;
    try {
      const normalized = normalizeThemeFilePath(value);
      if (normalized) files.push(normalized);
    } catch (_) {}
  };
  const addList = (list) => {
    (Array.isArray(list) ? list : []).forEach(add);
  };

  add('theme.json');
  const styles = manifest && Array.isArray(manifest.styles)
    ? manifest.styles.map((entry) => safeString(entry).trim()).filter(Boolean)
    : [];
  if (styles.length) addList(styles);
  else addList(DEFAULT_THEME_STYLES);
  addList(manifest && manifest.modules);
  addList(manifest && manifest.files);

  const views = manifest && manifest.views && typeof manifest.views === 'object' ? manifest.views : {};
  Object.values(views).forEach((view) => {
    if (view && typeof view === 'object') add(view.module);
  });

  return normalizeFileList(files);
}

export function collectThemeArchiveEntries(buffer, options = {}) {
  const archive = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(archive || {});
  if (!names.length) throw new Error('Theme ZIP is empty.');

  const rawEntries = names
    .map((name) => ({
      raw: name,
      path: validateRawThemeArchivePath(name),
      data: archive[name]
    }))
    .filter((item) => item.path && !item.path.endsWith('/') && item.data);
  const strippedPaths = stripCommonArchiveRoot(rawEntries.map((entry) => entry.path));
  const entries = rawEntries.map((entry, index) => {
    const path = normalizeThemeFilePath(strippedPaths[index]);
    return { path, data: entry.data };
  }).filter((entry) => entry.path);
  const availablePaths = new Set(entries.map((entry) => entry.path));

  if (!entries.some((entry) => entry.path === 'theme.json')) {
    throw new Error('Theme ZIP must contain theme.json at the theme root.');
  }

  const manifestEntry = entries.find((entry) => entry.path === 'theme.json');
  let themeManifest = null;
  try {
    themeManifest = JSON.parse(strFromU8(manifestEntry.data));
  } catch (err) {
    const error = new Error('Theme ZIP theme.json is not valid JSON.');
    error.cause = err;
    throw error;
  }
  const slugSource = options.expectedSlug || themeManifest.value || themeManifest.slug || themeManifest.name;
  const slug = sanitizeThemeSlug(slugSource);
  if (options.expectedSlug && slug !== sanitizeThemeSlug(options.expectedSlug)) {
    throw new Error('Theme ZIP slug does not match the selected release manifest.');
  }
  const contractVersion = validateThemeManifestContract(themeManifest, availablePaths);
  validateThemeRouteHelperContract(entries, contractVersion);

  const seen = new Set();
  const normalizedEntries = entries.map((entry) => {
    if (seen.has(entry.path)) throw new Error(`Theme ZIP contains duplicate path: ${entry.path}`);
    seen.add(entry.path);
    const bufferValue = getBuffer(entry.data);
    const binary = !isThemeTextPath(entry.path);
    const file = {
      path: entry.path,
      data: entry.data,
      binary,
      size: entry.data.length
    };
    if (binary) file.base64 = bufferToBase64(bufferValue);
    else file.content = strFromU8(entry.data);
    return file;
  });

  return {
    slug,
    label: safeString(themeManifest.name || themeManifest.label || slug) || slug,
    version: safeString(themeManifest.version || ''),
    contractVersion,
    engines: normalizeThemeEngines(themeManifest.engines, { required: true }),
    manifest: themeManifest,
    files: normalizedEntries
  };
}

export async function verifyThemeAsset(buffer, asset, expectedName = '') {
  const normalized = asset && typeof asset === 'object' ? asset : {};
  const expectedSize = Number(normalized.size);
  if (Number.isFinite(expectedSize) && expectedSize > 0 && buffer.byteLength !== expectedSize) {
    throw new Error(`Theme ZIP size mismatch: expected ${expectedSize}, got ${buffer.byteLength}.`);
  }
  const digest = normalizeDigest(normalized.digest, { required: true });
  const actual = await digestSha256(buffer);
  if (digest !== `sha256:${actual}`) {
    throw new Error('Theme ZIP SHA-256 digest mismatch.');
  }
  const name = safeString(normalized.name || '').trim();
  if (expectedName && name && name !== expectedName) {
    throw new Error('Theme ZIP asset name mismatch.');
  }
  return { digest: `sha256:${actual}`, size: buffer.byteLength };
}
