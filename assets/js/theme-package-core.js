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
  const callMatch = before.match(/\bnew\s+URL\s*\(\s*$/);
  if (!callMatch) return false;
  const callPrefixIndex = before.length - callMatch[0].length;
  const argsStart = callPrefixIndex + callMatch[0].lastIndexOf('(') + 1;
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

function stringLiteralHasExternalRouteContext(source, literalMatch, externalAliases = new Set()) {
  const text = safeString(source);
  const content = safeString(literalMatch && literalMatch[2]);
  if ((literalMatch && literalMatch[1]) === '`' && templateRouteContentHasExternalPrefix(text, content)) return true;
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
  return aliases;
}

function sourceArgIsRouteKey(arg, aliases) {
  const value = safeString(arg).trim();
  return new RegExp(`^(?:${routeKeyExpressionPattern(aliases)})$`).test(value);
}

function routeKeyWritePattern(owner, property = '') {
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? `\\s*\\.\\s*${escapeRegExp(property)}` : '';
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  return new RegExp(`${ownerPattern}${suffix}\\s*\\.\\s*(?:set|append)\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*,`, 'g');
}

function containsRouteKeyWriteForOwner(source, owner, aliases, property = '') {
  const text = safeString(source);
  const re = routeKeyWritePattern(owner, property);
  let match = re.exec(text);
  while (match) {
    if (sourceArgIsRouteKey(match[1], aliases)) return true;
    match = re.exec(text);
  }
  return false;
}

function collectUrlSearchParamsConstructors(source) {
  const text = safeString(source);
  const out = [];
  const seen = new Set();
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URLSearchParams\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URLSearchParams\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_PATTERN_SOURCE})\\s*=\\s*new\\s+URLSearchParams\\s*\\(`, 'g')
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
  const text = safeString(args).trim();
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

function containsRelativeParamsSerialization(source, name) {
  const text = safeString(source);
  const namePattern = expressionReferencePattern(name);
  const concatRe = new RegExp(`(['"\`])((?:\\\\[\\s\\S]|(?!\\1)[\\s\\S])*?[?&])\\1\\s*\\+\\s*${namePattern}(?:\\b|\\s*\\.\\s*toString\\s*\\()`, 'g');
  let match = concatRe.exec(text);
  while (match) {
    const content = match[2];
    const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
    const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
    if (!isExternalUrlPrefix(prefix) && !inlineParamsConcatHasExternalPrefix(text, match)) return true;
    match = concatRe.exec(text);
  }
  const templateRe = new RegExp(`\`((?:\\\\[\\s\\S]|(?!\`)[\\s\\S])*?[?&])\\$\\{\\s*${namePattern}(?:\\s*\\.\\s*toString\\s*\\(\\s*\\))?\\s*\\}`, 'g');
  match = templateRe.exec(text);
  while (match) {
    if (!templateRouteContentHasExternalPrefix(text, match[1])) return true;
    match = templateRe.exec(text);
  }
  const locationSearchRe = new RegExp(`${locationSearchWritePattern(collectLocationAliases(text)).source}\\s*${namePattern}(?:\\b|\\s*\\.\\s*toString\\s*\\()`, 'g');
  if (locationSearchRe.test(text)) return true;
  return false;
}

function containsForbiddenUrlSearchParamsVariable(source, aliases) {
  const text = safeString(source);
  const vars = collectUrlSearchParamsVariables(text);
  for (const name of vars) {
    if (containsRouteKeyWriteForOwner(text, name, aliases) && containsRelativeParamsSerialization(text, name)) {
      return true;
    }
  }
  return false;
}

function containsForbiddenUrlSearchParamsInitializer(source, aliases = new Set()) {
  const text = safeString(source);
  const initializers = collectUrlSearchParamsInitializers(text);
  for (const { name, args } of initializers) {
    if (urlSearchParamsInitializerHasRouteKey(args, aliases) && containsRelativeParamsSerialization(text, name)) {
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
      if (urlSearchParamsInitializerHasRouteKey(expression, aliases)) out.add(match[1]);
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

function inlineParamsConcatHasExternalPrefix(text, literalMatch) {
  const content = safeString(literalMatch[2]);
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = safeString(text).slice(0, literalMatch.index);
  const literalPrefix = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\+\s*$/);
  if (literalPrefix && isExternalUrlPrefix(literalPrefix[2])) return true;
  const aliasPrefix = before.match(/\b([A-Za-z_$][\w$]*)\s*\+\s*$/);
  if (aliasPrefix) {
    const externalAliases = collectExternalUrlAliases(text);
    if (externalAliases.has(aliasPrefix[1])) return true;
  }
  return false;
}

function templateRouteContentHasExternalPrefix(source, content) {
  const value = safeString(content);
  const queryIndex = Math.max(value.lastIndexOf('?'), value.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(value, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const beforeQuery = queryIndex >= 0 ? value.slice(0, queryIndex).trim() : '';
  const aliasPrefix = beforeQuery.match(/^\$\{\s*([A-Za-z_$][\w$]*)\s*\}/);
  if (!aliasPrefix) return false;
  const aliases = collectExternalUrlAliases(source);
  return aliases.has(aliasPrefix[1]);
}

function inlineUrlSearchParamsHasRelativeSink(source, callStart) {
  const text = safeString(source);
  const before = text.slice(0, callStart);
  const concat = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?[?&])\1\s*\+\s*\(?\s*$/);
  if (concat) {
    concat.index = before.length - concat[0].length;
    return !inlineParamsConcatHasExternalPrefix(text, concat);
  }
  const template = before.match(/`((?:\\[\s\S]|(?!`)[\s\S])*?[?&])\$\{\s*$/);
  if (template) {
    return !templateRouteContentHasExternalPrefix(text, template[1]);
  }
  return /\b(?:window\s*\.\s*)?location\s*\.\s*search\s*=\s*$/.test(before);
}

function containsForbiddenInlineUrlSearchParamsInitializer(source, aliases = new Set()) {
  const text = safeString(source);
  const re = /\bnew\s+URLSearchParams\s*\(/g;
  let match = re.exec(text);
  while (match) {
    const parsed = extractCallArgs(text, re.lastIndex);
    if (urlSearchParamsInitializerHasRouteKey(parsed.args, aliases)
      && inlineUrlSearchParamsHasRelativeSink(text, match.index)) {
      return true;
    }
    if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
    match = re.exec(text);
  }
  return false;
}

function splitRouteQueryHasExternalPrefix(text, match) {
  const content = safeString(match[2]);
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = safeString(text).slice(0, match.index);
  const literalPrefix = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\+\s*$/);
  if (literalPrefix && isExternalUrlPrefix(literalPrefix[2])) return true;
  const aliasPrefix = before.match(/\b([A-Za-z_$][\w$]*)\s*\+\s*$/);
  if (aliasPrefix) {
    const aliases = collectExternalUrlAliases(text);
    if (aliases.has(aliasPrefix[1])) return true;
  }
  return false;
}

function containsForbiddenSplitRouteQueryLiteral(source) {
  const text = safeString(source);
  SPLIT_ROUTE_QUERY_LITERAL_PATTERN.lastIndex = 0;
  let match = SPLIT_ROUTE_QUERY_LITERAL_PATTERN.exec(text);
  while (match) {
    if (!splitRouteQueryHasExternalPrefix(text, match)) return true;
    match = SPLIT_ROUTE_QUERY_LITERAL_PATTERN.exec(text);
  }
  return false;
}

function containsForbiddenRouteKeyAliasConstruction(source, aliases = new Set()) {
  const routeKeyExpression = routeKeyExpressionPattern(aliases);
  const text = safeString(source);
  const concatRe = new RegExp(`(['"\`])((?:\\\\[\\s\\S]|(?!\\1)[\\s\\S])*?[?&])\\1\\s*\\+\\s*(?:${routeKeyExpression})\\s*\\+\\s*(['"\`])=\\3`, 'g');
  let match = concatRe.exec(text);
  while (match) {
    if (!inlineParamsConcatHasExternalPrefix(text, match)) return true;
    match = concatRe.exec(text);
  }
  const templateRe = new RegExp(`\`((?:\\\\[\\s\\S]|(?!\`)[\\s\\S])*?[?&])\\$\\{\\s*(?:${routeKeyExpression})\\s*\\}\\s*=`, 'g');
  match = templateRe.exec(text);
  while (match) {
    if (!templateRouteContentHasExternalPrefix(text, match[1])) return true;
    match = templateRe.exec(text);
  }
  return false;
}

function expressionIsExternalUrl(value, aliases = new Set()) {
  const text = safeString(value).trim();
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
  const text = safeString(value).trim();
  const aliasExpression = aliasExpressionPattern(aliases);
  if (aliasExpression && new RegExp(`^(?:${aliasExpression})$`).test(text)) return true;
  const match = text.match(/^(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1$/);
  return Boolean(match && !isExternalUrlPrefix(match[2]));
}

function urlConstructorArgsAreExternal(args, aliases = new Set(), staticRelativeAliases = new Set()) {
  const parts = splitTopLevelArgs(args);
  if (expressionIsExternalUrl(parts[0], aliases)) return true;
  return parts.length > 1
    && expressionIsStaticRelativeUrl(parts[0], staticRelativeAliases)
    && expressionIsExternalUrl(parts[1], aliases);
}

function collectRouteUrlVariables(source) {
  const text = safeString(source);
  const out = new Set();
  const aliases = collectExternalUrlAliases(text);
  const staticRelativeAliases = collectStaticRelativeUrlAliases(text);
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URL\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URL\\s*\\(`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const parsed = extractCallArgs(text, re.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, aliases, staticRelativeAliases)) out.add(match[1]);
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
  return out;
}

function locationSearchWritePattern(locationAliases = new Set()) {
  const aliasPatterns = Array.from(locationAliases || []).map(expressionReferencePattern);
  const ownerPattern = aliasPatterns.length
    ? `(?:\\b(?:window\\s*\\.\\s*)?location|${aliasPatterns.join('|')})`
    : '\\b(?:window\\s*\\.\\s*)?location';
  return new RegExp(`${ownerPattern}\\s*\\.\\s*search\\s*(?:\\+=|=(?!=|>))`, 'g');
}

function containsForbiddenRouteUrlMutation(source, aliases) {
  const text = safeString(source);
  const vars = collectRouteUrlVariables(text);
  for (const name of vars) {
    if (containsRouteKeyWriteForOwner(text, name, aliases, 'searchParams')) return true;
    const paramsAliases = collectSearchParamsAliasesForRouteUrl(text, name);
    for (const paramsAlias of paramsAliases) {
      if (containsRouteKeyWriteForOwner(text, paramsAlias, aliases)) return true;
    }
  }
  return false;
}

function collectSearchParamsAliasesForRouteUrl(source, owner) {
  const text = safeString(source);
  const out = new Set();
  const ownerPattern = expressionReferencePattern(owner);
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*${ownerPattern}\\s*\\.\\s*searchParams\\b(?:\\s*\\))*`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*${ownerPattern}\\s*\\.\\s*searchParams\\b(?:\\s*\\))*`, 'g')
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
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+URL\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+URL\\s*\\(`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const parsed = extractCallArgs(text, re.lastIndex);
      const suffix = text.slice(parsed.end).match(/^\s*(?:\))*\s*\.\s*searchParams\b/);
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

function containsForbiddenV4RouteConstruction(source) {
  const text = safeString(source);
  const aliases = collectRouteKeyAliases(text);
  const externalAliases = collectExternalUrlAliases(text);
  const inlineSearchParamsAliases = collectInlineUrlSearchParamsAliases(text);
  return containsForbiddenRouteLiteral(text, externalAliases)
    || containsForbiddenLocationSearchAssignment(text, aliases)
    || containsForbiddenUrlSearchParamsInitializer(text, aliases)
    || containsForbiddenInlineUrlSearchParamsInitializer(text, aliases)
    || containsForbiddenSplitRouteQueryLiteral(text)
    || containsForbiddenRouteKeyAliasConstruction(text, aliases)
    || containsForbiddenUrlSearchParamsVariable(text, aliases)
    || containsForbiddenRouteUrlMutation(text, aliases)
    || Array.from(inlineSearchParamsAliases).some((name) => (
      containsRouteKeyWriteForOwner(text, name, aliases) && containsRelativeParamsSerialization(text, name)
    ));
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
  entries.forEach((entry) => {
    if (!entry || !entry.path || !isThemeTextPath(entry.path)) return;
    if (entry.path === 'theme.json') return;
    const source = strFromU8(entry.data);
    if (containsForbiddenV4RouteConstruction(source)) {
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
