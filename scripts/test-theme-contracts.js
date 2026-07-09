import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  PRESS_THEME_CONTRACT,
  getDefaultThemeStyles,
  getOptionalThemeViews,
  getRequiredThemeComponents,
  getRequiredThemeContentShapes,
  getRequiredThemeManifestFields,
  getRequiredThemeRegions,
  getRequiredThemeViews
} from '../assets/js/theme-contract-surface.mjs';
import {
  containsForbiddenV4RouteConstruction as containsForbiddenV4RouteConstructionExport,
  validateThemeConfigSchema
} from '../assets/js/theme-package-core.js';
import { containsForbiddenV4RouteConstructionAst } from '../assets/js/theme-route-guard.js';

const root = process.cwd();
const themesDir = path.join(root, 'assets', 'themes');
const schemaPath = path.join(root, 'assets', 'schema', 'theme.json');
const failures = [];

const REQUIRED_VIEWS = [...getRequiredThemeViews(), ...getOptionalThemeViews()];
const REQUIRED_REGIONS = getRequiredThemeRegions();
const REQUIRED_CONTENT_SHAPES = getRequiredThemeContentShapes();
const REQUIRED_COMPONENTS = getRequiredThemeComponents();
const REQUIRED_MANIFEST_FIELDS = getRequiredThemeManifestFields();
const DEFAULT_THEME_STYLES = getDefaultThemeStyles();
const REQUIRED_STYLE_TOKENS = ['--press-color-text', '--press-color-surface', '--press-font-body', '--press-radius-card', '--press-space-page'];
const STRING_LITERAL_PATTERN = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;
const ROUTE_QUERY_PATTERN = /[?&]([^=&#\s]+)\s*=/g;
const ROUTE_KEY_OBJECT_INIT_PATTERN = /(?:^|[,{]\s*)(?:(['"`])(?:tab|id)\1|(?:tab|id))\s*:/;
const ROUTE_KEY_OBJECT_SHORTHAND_PATTERN = /(?:^|[,{]\s*)(?:tab|id)\s*(?=[,}])/;
const ROUTE_KEY_ARRAY_INIT_PATTERN = /\[\s*(['"`])(?:tab|id)\1\s*,/;
const SPLIT_ROUTE_QUERY_LITERAL_PATTERN = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?[?&])\1\s*\+\s*(?:\(\s*)*(?:(['"`])(?:tab|id)\s*=|(['"`])(?:tab|id)\4\s*\+\s*(?:\(\s*)*(['"`])=\5)/g;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/;
const MEMBER_EXPRESSION_PATTERN_SOURCE = `(?:this|${IDENTIFIER_PATTERN.source})(?:\\s*\\.\\s*${IDENTIFIER_PATTERN.source})+`;
const STATIC_MEMBER_STRING_PATTERN_SOURCE = `(?:"(?:\\\\[\\s\\S]|[^"\\\\])*"|'(?:\\\\[\\s\\S]|[^'\\\\])*'|\`(?:\\\\[\\s\\S]|[^\`\\\\])*\`)`;
const STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE = `(?:${IDENTIFIER_PATTERN.source}|${STATIC_MEMBER_STRING_PATTERN_SOURCE}|\\[\\s*${STATIC_MEMBER_STRING_PATTERN_SOURCE}\\s*\\])`;
const MEMBER_EXPRESSION_WITH_STATIC_KEYS_PATTERN_SOURCE = `(?:this|${IDENTIFIER_PATTERN.source})(?:(?:\\s*\\.\\s*${IDENTIFIER_PATTERN.source})|(?:\\s*\\[\\s*${STATIC_MEMBER_STRING_PATTERN_SOURCE}\\s*\\]))+`;
const ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE = `(?:"(?:tab|id)"|'(?:tab|id)'|\`(?:tab|id)\`)`;
const URL_CONSTRUCTOR_PATTERN_SOURCE = `(?:URL|(?:window|globalThis)\\s*\\.\\s*URL)`;
const FORMER_DOM_IDS = [
  ['main', 'view'],
  ['toc', 'view'],
  ['search', 'Input'],
  ['tabs', 'Nav'],
  ['tag', 'view']
].map(parts => parts.join(''));
const FORBIDDEN_SOURCE_PATTERNS = [
  { label: 'global theme adapter', re: new RegExp('__press_' + 'themeHooks') },
  { label: 'manifest compatibility object reads', re: new RegExp('manifest\\.' + 'contract\\b') },
  { label: 'theme manifest compatibility object', re: new RegExp('["\\\']' + 'contract' + '["\\\']\\s*:') },
  { label: 'adapter binding function', re: new RegExp('bindLegacy' + 'HookAdapters') },
  { label: 'adapter view conversion', re: new RegExp('viewsFrom' + 'Hooks') },
  { label: 'region alias table', re: new RegExp('REGION_' + 'ALIASES') },
  { label: 'selector-based lightbox root fallback', re: new RegExp('root' + 'Selector') },
  ...FORMER_DOM_IDS.flatMap((id) => [
    { label: `legacy DOM id selector #${id}`, re: new RegExp(`#${escapeRe(id)}\\b`) },
    { label: `legacy DOM id assignment ${id}`, re: new RegExp(`\\bid\\s*=\\s*['"]${escapeRe(id)}['"]`) },
    { label: `legacy DOM id registration ${id}`, re: new RegExp(`register\\(\\s*['"]${escapeRe(id)}['"]`) }
  ])
];
const CORE_RUNTIME_FILES = [
  'assets/main.js',
  'assets/js/dom-utils.js',
  'assets/js/i18n.js',
  'assets/js/lightbox.js',
  'assets/js/search.js',
  'assets/js/tags.js',
  'assets/js/theme.js',
  'assets/js/toc.js'
];
const THEME_ROUTE_GUARD_TEXT_EXTENSIONS = new Set(['.htm', '.html', '.js', '.mjs', '.svg']);

function fail(message) {
  failures.push(message);
}

function rel(file) {
  return path.relative(root, file);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (err) {
    fail(`${rel(file)} is not valid JSON: ${err.message}`);
    return null;
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function uniqueList(items, label, file) {
  if (!Array.isArray(items)) {
    fail(`${file} ${label} must be an array`);
    return [];
  }
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const value = String(item || '').trim();
    if (!value) {
      fail(`${file} ${label} contains an empty value`);
      return;
    }
    if (seen.has(value)) {
      fail(`${file} ${label} repeats "${value}"`);
      return;
    }
    seen.add(value);
    out.push(value);
  });
  return out;
}

function requireObject(value, label, file) {
  const object = asObject(value);
  if (!object) fail(`${file} ${label} must be an object`);
  return object || {};
}

function requireList(owner, key, label, file) {
  if (!Object.prototype.hasOwnProperty.call(owner || {}, key)) {
    fail(`${file} is missing ${label}`);
    return [];
  }
  return uniqueList(owner[key], label, file);
}

function modulePathIsSafe(entry, extension) {
  return entry
    && !entry.startsWith('.')
    && !entry.startsWith('/')
    && !entry.includes('..')
    && !entry.includes('\\')
    && entry.endsWith(extension);
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expressionReferencePattern(expression) {
  const text = String(expression || '').trim();
  const parts = text.split(/\s*\.\s*/).filter(Boolean);
  if (parts.length && parts.every((part, index) => (
    part === 'this' ? index === 0 : new RegExp(`^${IDENTIFIER_PATTERN.source}$`).test(part)
  ))) {
    const [root, ...properties] = parts;
    return `\\b${escapeRe(root)}${properties.map((property) => propertyAccessorPattern(property)).join('')}`;
  }
  return `\\b${escapeRe(text)}`;
}

function expressionReferencePatternForSource(expression, source = '') {
  const text = String(expression || '').trim();
  const parts = text.split(/\s*\.\s*/).filter(Boolean);
  if (parts.length && parts.every((part, index) => (
    part === 'this' ? index === 0 : new RegExp(`^${IDENTIFIER_PATTERN.source}$`).test(part)
  ))) {
    const [root, ...properties] = parts;
    return `\\b${escapeRe(root)}${properties.map((property) => (
      propertyAccessorPattern(property, collectStaticStringAliases(source, property))
    )).join('')}`;
  }
  return expressionReferencePattern(expression);
}

function functionInvocationStartPattern(calleePattern) {
  return `(?:${calleePattern}\\s*(?:\\?\\.\\s*)?\\(|${calleePattern}(?:\\s*(?:\\?\\.\\s*|\\.\\s*)(?:call|apply)|\\s*\\?\\.\\s*\\[\\s*["'\`](?:call|apply)["'\`]\\s*\\]|\\s*\\[\\s*["'\`](?:call|apply)["'\`]\\s*\\])\\s*(?:\\?\\.\\s*)?\\()`;
}

function isExternalUrlPrefix(value) {
  const prefix = String(value || '').trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(prefix) || prefix.startsWith('//');
}

function decodeUrlQueryKey(value) {
  const text = String(value || '').trim();
  try {
    return decodeURIComponent(text);
  } catch (_) {
    return text;
  }
}

function routeQueryKeyIsForbidden(value) {
  return /^(?:tab|id)$/.test(decodeUrlQueryKey(value));
}

function routeCandidatePrefix(content, queryIndex) {
  const before = String(content || '').slice(0, queryIndex);
  const boundaries = ['"', "'", '`', ' ', '\n', '\r', '\t', '(', '[', '{', '=', '>'];
  let boundary = -1;
  boundaries.forEach((candidate) => {
    const index = before.lastIndexOf(candidate);
    if (index > boundary) boundary = index;
  });
  return before.slice(boundary + 1).trim();
}

function stripWrappingParentheses(value) {
  let text = String(value || '').trim();
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
  const text = String(source || '');
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i -= 1;
  if (i < 0) return true;
  const ch = text[i];
  if (/[({\[=,:;!?&|+*%~^<>-]/.test(ch)) return true;
  const word = text.slice(0, i + 1).match(/([A-Za-z_$][\w$]*)$/);
  return Boolean(word && /^(?:return|throw|case|typeof|delete|void|new|yield|await|else|do|in|instanceof)$/.test(word[1]));
}

function routeGuardRegexLiteralEnd(source, start) {
  const text = String(source || '');
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
  const text = String(source || '');
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

function maskNonCodeForRouteGuard(source) {
  const text = String(source || '');
  let out = '';
  let quote = '';
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] || '';
    if (quote) {
      out += ch === '\n' || ch === '\r' ? ch : ' ';
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ' ';
      continue;
    }
    if (ch === '/' && next !== '/' && next !== '*' && routeGuardPreviousTokenAllowsRegex(text, i)) {
      const end = routeGuardRegexLiteralEnd(text, i);
      out += text.slice(i, end).replace(/[^\n\r]/g, ' ');
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
    out += ch;
  }
  return out;
}

function stripHtmlCommentsForRouteGuard(source) {
  return String(source || '').replace(/<!--[\s\S]*?-->/g, (match) => (
    match.replace(/[^\n\r]/g, ' ')
  ));
}

function containsRelativePressRouteLiteral(content) {
  const value = String(content || '');
  ROUTE_QUERY_PATTERN.lastIndex = 0;
  let match = ROUTE_QUERY_PATTERN.exec(value);
  while (match) {
    if (!routeQueryKeyIsForbidden(match[1])) {
      match = ROUTE_QUERY_PATTERN.exec(value);
      continue;
    }
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
  const text = String(source || '');
  const before = text.slice(0, literalMatch.index);
  const constructorPattern = urlConstructorPattern(collectUrlConstructorAliases(text));
  const callMatch = before.match(new RegExp(`\\bnew\\s+(?:${constructorPattern})\\s*\\(\\s*(?:\\(\\s*)*$`));
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
  const text = String(source || '');
  STRING_LITERAL_PATTERN.lastIndex = 0;
  let match = STRING_LITERAL_PATTERN.exec(text);
  while (match) {
    if (containsRelativePressRouteLiteral(decodeJsStringLiteralContent(match[2]))
      && !stringLiteralIsExternalUrlConstructorArg(text, match, externalAliases)
      && !stringLiteralHasExternalRouteContext(text, match, externalAliases)) {
      return true;
    }
    match = STRING_LITERAL_PATTERN.exec(text);
  }
  return false;
}

function containsForbiddenHtmlRouteAttribute(source) {
  const text = String(source || '');
  const re = /\b(?:href|src|srcset|action|poster|formaction|cite|data-[a-z0-9_-]*href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`<>]+))/gi;
  let match = re.exec(text);
  while (match) {
    const value = match[1] || match[2] || match[3] || '';
    if (containsRelativePressRouteLiteral(decodeHtmlAttributeValue(value))) return true;
    match = re.exec(text);
  }
  return false;
}

function decodeHtmlAttributeValue(value) {
  return String(value || '')
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

function decodeJsStringLiteralContent(value) {
  return String(value || '')
    .replace(/\\u\{([0-9a-f]+)\}/gi, (_, raw) => {
      const code = Number.parseInt(raw, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _;
    })
    .replace(/\\u([0-9a-f]{4})/gi, (_, raw) => String.fromCharCode(Number.parseInt(raw, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, raw) => String.fromCharCode(Number.parseInt(raw, 16)))
    .replace(/\\([\\'"`?&=])/g, '$1');
}

function splitTopLevelConcatParts(value) {
  const text = String(value || '');
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
    if (depth === 0 && ch === '+') {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

function staticStringExpressionValue(expression) {
  const text = stripWrappingParentheses(expression);
  const literal = text.match(/^(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1$/);
  if (literal) {
    if (literal[1] === '`' && /\$\{/.test(literal[2])) return null;
    return decodeJsStringLiteralContent(literal[2]);
  }
  const parts = splitTopLevelConcatParts(text);
  if (parts.length < 2) return null;
  let value = '';
  for (const part of parts) {
    const partValue = staticStringExpressionValue(part);
    if (partValue == null) return null;
    value += partValue;
  }
  return value;
}

function normalizeStaticMemberExpression(expression) {
  const value = String(expression || '').trim();
  const root = value.match(new RegExp(`^(?:this|${IDENTIFIER_PATTERN.source})`));
  if (!root) return value;
  const parts = [root[0]];
  const tokenRe = new RegExp(`\\s*(?:\\.\\s*(${IDENTIFIER_PATTERN.source})|\\[\\s*(${STATIC_MEMBER_STRING_PATTERN_SOURCE})\\s*\\])`, 'y');
  let index = root[0].length;
  while (index < value.length) {
    tokenRe.lastIndex = index;
    const token = tokenRe.exec(value);
    if (!token) return value;
    const property = token[1] || staticStringExpressionValue(token[2]);
    if (!new RegExp(`^${IDENTIFIER_PATTERN.source}$`).test(property || '')) return value;
    parts.push(property);
    index = tokenRe.lastIndex;
  }
  return parts.join('.');
}

function normalizeStaticObjectPropertyKey(key) {
  const text = String(key || '').trim();
  let value = '';
  if (new RegExp(`^${IDENTIFIER_PATTERN.source}$`).test(text)) {
    value = text;
  } else if (text.startsWith('[') && text.endsWith(']')) {
    value = staticStringExpressionValue(text.slice(1, -1));
  } else {
    value = staticStringExpressionValue(text);
  }
  return new RegExp(`^${IDENTIFIER_PATTERN.source}$`).test(value || '') ? value : '';
}

function collectDestructuredStaticPropertyAliases(body, property) {
  const text = String(body || '');
  const out = new Set();
  const escaped = escapeRe(property);
  const aliasRe = new RegExp(`(?:^|,)\\s*${escaped}\\s*:\\s*(${IDENTIFIER_PATTERN.source})(?:\\s*=\\s*[^,}]*)?`, 'g');
  let alias = aliasRe.exec(text);
  while (alias) {
    out.add(alias[1]);
    alias = aliasRe.exec(text);
  }
  const computedAliasRe = new RegExp(`(?:^|,)\\s*\\[\\s*(${STATIC_MEMBER_STRING_PATTERN_SOURCE})\\s*\\]\\s*:\\s*(${IDENTIFIER_PATTERN.source})(?:\\s*=\\s*[^,}]*)?`, 'g');
  alias = computedAliasRe.exec(text);
  while (alias) {
    if (staticStringExpressionValue(alias[1]) === property) out.add(alias[2]);
    alias = computedAliasRe.exec(text);
  }
  const shorthandRe = new RegExp(`(?:^|,)\\s*${escaped}\\s*(?:=\\s*[^,}]*)?(?:,|$)`);
  if (shorthandRe.test(text)) out.add(property);
  return out;
}

function collectStaticStringAliases(source, expectedValue) {
  const text = String(source || '');
  const aliases = new Set();
  const re = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*`, 'g');
  let match = re.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, re.lastIndex);
    if (staticStringExpressionValue(expression) === expectedValue
      && (match[1] === 'const' || !bindingIsReassigned(text, match[2], re.lastIndex + expression.length))) {
      aliases.add(match[2]);
    }
    re.lastIndex += expression.length;
    match = re.exec(text);
  }
  return aliases;
}

function shouldScanHtmlRouteAttributes(path, source) {
  const clean = String(path || '').toLowerCase();
  if (/\.(?:html?|svg)$/i.test(clean)) return true;
  if (clean) return false;
  return /<\s*[a-z][\s\S]*?\b(?:href|src|srcset|action|poster|formaction|cite|data-[a-z0-9_-]*href)\s*=/i.test(String(source || ''));
}

function shouldScanExecutableRouteCode(path) {
  const clean = String(path || '').toLowerCase();
  return !clean || /\.(?:js|mjs)$/i.test(clean);
}

function stringLiteralHasExternalRouteContext(source, literalMatch, externalAliases = new Set()) {
  const text = String(source || '');
  const content = String(literalMatch[2] || '');
  if (literalMatch[1] === '`' && templateRouteContentHasExternalPrefix(text, content, externalAliases)) return true;
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = text.slice(0, literalMatch.index);
  const literalPrefix = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\+\s*$/);
  if (literalPrefix && isExternalUrlPrefix(literalPrefix[2])) return true;
  const aliasPrefix = before.match(/\b([A-Za-z_$][\w$]*)\s*\+\s*$/);
  return Boolean(aliasPrefix && externalAliases.has(aliasPrefix[1]));
}

function expressionHasRouteKeyLiteral(expression) {
  STRING_LITERAL_PATTERN.lastIndex = 0;
  const text = String(expression || '');
  let match = STRING_LITERAL_PATTERN.exec(text);
  while (match) {
    if (/^(?:tab|id)$/.test(decodeJsStringLiteralContent(match[2]))) return true;
    match = STRING_LITERAL_PATTERN.exec(text);
  }
  return false;
}

function addRouteKeyObjectAliases(aliases, name, initializer) {
  const text = stripWrappingParentheses(initializer);
  if (!text.startsWith('{')) return;
  const body = text.endsWith('}') ? text.slice(1, -1) : text.slice(1);
  splitTopLevelArgs(body).forEach((part) => {
    const field = String(part || '').trim().match(/^(?:([A-Za-z_$][\w$]*)|(['"`])([^'"`]+)\2)\s*:\s*([\s\S]+)$/);
    if (!field) return;
    const key = field[1] || field[3] || '';
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) return;
    if (expressionHasRouteKeyLiteral(field[4]) || aliases.has(stripWrappingParentheses(field[4]))) {
      aliases.add(`${name}.${key}`);
    }
  });
}

function addExternalUrlObjectAliases(aliases, name, initializer) {
  const text = stripWrappingParentheses(initializer);
  if (!text.startsWith('{')) return;
  const body = text.endsWith('}') ? text.slice(1, -1) : text.slice(1);
  splitTopLevelArgs(body).forEach((part) => {
    const field = String(part || '').trim().match(/^(?:([A-Za-z_$][\w$]*)|(['"`])([^'"`]+)\2)\s*:\s*([\s\S]+)$/);
    if (!field) return;
    const key = field[1] || field[3] || '';
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) return;
    if (expressionIsExternalUrl(field[4], aliases)) aliases.add(`${name}.${key}`);
  });
}

function bindingIsReassigned(source, name, fromIndex = 0) {
  const text = String(source || '');
  const re = new RegExp(`(?:^|[^\\w$.])${escapeRe(name)}\\s*(?:[+\\-*/%&|^]?=)(?!=|>)`, 'g');
  re.lastIndex = Math.max(0, fromIndex);
  return re.test(text);
}

function collectRouteKeyAliases(source) {
  const text = String(source || '');
  const aliases = new Set();
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])(tab|id)\2\s*;?/g;
  let match = re.exec(text);
  while (match) {
    aliases.add(match[1]);
    match = re.exec(text);
  }
  const declarationRe = /\b(?:const|let|var)\s+([^;]+)/g;
  match = declarationRe.exec(text);
  while (match) {
    splitTopLevelArgs(match[1]).forEach((part) => {
      const declarator = String(part || '').trim().match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
      if (!declarator) return;
      const name = declarator[1];
      const initializer = declarator[2];
      if (expressionHasRouteKeyLiteral(initializer)) aliases.add(name);
      addRouteKeyObjectAliases(aliases, name, initializer);
    });
    match = declarationRe.exec(text);
  }
  const defaultRe = /\bexport\s+default\s*(?:\(\s*)*((['"`])(?:\\[\s\S]|(?!\2)[\s\S])*?\2)(?:\s*\))*\s*;?/g;
  match = defaultRe.exec(text);
  while (match) {
    if (expressionHasRouteKeyLiteral(match[1])) aliases.add('default');
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
  const text = String(source || '');
  const aliases = new Set();
  const re = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])((?:\\[\s\S]|(?!\3)[\s\S])*?)\3\s*;?/g;
  let match = re.exec(text);
  while (match) {
    if (isExternalUrlPrefix(match[4]) && (match[1] === 'const' || !bindingIsReassigned(text, match[2], re.lastIndex))) {
      aliases.add(match[2]);
    }
    match = re.exec(text);
  }
  const staticRelativeAliases = collectStaticRelativeUrlAliases(text);
  const declarationRe = /\b(?:const|let|var)\s+([^;]+)/g;
  match = declarationRe.exec(text);
  while (match) {
    splitTopLevelArgs(match[1]).forEach((part) => {
      const declarator = String(part || '').trim().match(/^([A-Za-z_$][\w$]*)\s*=\s*([\s\S]+)$/);
      if (declarator) addExternalUrlObjectAliases(aliases, declarator[1], declarator[2]);
    });
    match = declarationRe.exec(text);
  }
  const constructorPattern = urlConstructorPattern(collectUrlConstructorAliases(text));
  const urlRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
  match = urlRe.exec(text);
  while (match) {
    const parsed = extractCallArgs(text, urlRe.lastIndex);
    if (urlConstructorArgsAreExternal(parsed.args, aliases, staticRelativeAliases)
      && (match[1] === 'const' || !bindingIsReassigned(text, match[2], parsed.end))) {
      aliases.add(match[2]);
    }
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
  const text = String(source || '');
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
  const text = String(source || '');
  const imports = [];
  const namespaceRe = /\bimport\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*(['"])([^'"]+)\2/g;
  let namespaceMatch = namespaceRe.exec(text);
  while (namespaceMatch) {
    imports.push({ importedName: '*', localName: namespaceMatch[1], specifier: namespaceMatch[3] });
    namespaceMatch = namespaceRe.exec(text);
  }
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
  const text = String(source || '');
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
  const text = String(source || '');
  const scan = maskNonCodeForRouteGuard(text);
  const declarationRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  let match = declarationRe.exec(scan);
  while (match) {
    if (!options.topLevelOnly || braceDepthAt(text, match.index) === 0) bindings.add(match[1]);
    match = declarationRe.exec(scan);
  }
  const destructuredRe = /\b(?:const|let|var)\s*\{([\s\S]*?)\}/g;
  match = destructuredRe.exec(scan);
  while (match) {
    if (!options.topLevelOnly || braceDepthAt(text, match.index) === 0) addBindingNamesFromPattern(bindings, match[1]);
    match = destructuredRe.exec(scan);
  }
  const arrayDestructuredRe = /\b(?:const|let|var)\s*\[([\s\S]*?)\]/g;
  match = arrayDestructuredRe.exec(scan);
  while (match) {
    if (!options.topLevelOnly || braceDepthAt(text, match.index) === 0) addBindingNamesFromPattern(bindings, match[1]);
    match = arrayDestructuredRe.exec(scan);
  }
}

function stackStartsWith(stack, prefix) {
  if (prefix.length > stack.length) return false;
  return prefix.every((value, index) => stack[index] === value);
}

function collectNestedFunctionBodyRanges(source) {
  const text = String(source || '');
  const scan = maskNonCodeForRouteGuard(text);
  const ranges = [];
  const addRange = (openBraceIndex) => {
    if (openBraceIndex < 0) return;
    const span = extractBlockSpan(text, openBraceIndex);
    ranges.push({ start: openBraceIndex, end: span.end });
  };
  const functionRe = /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\([^)]*\)\s*\{/g;
  let match = functionRe.exec(scan);
  while (match) {
    addRange(functionRe.lastIndex - 1);
    match = functionRe.exec(scan);
  }
  const arrowBlockRe = /=>\s*\{/g;
  match = arrowBlockRe.exec(scan);
  while (match) {
    addRange(arrowBlockRe.lastIndex - 1);
    match = arrowBlockRe.exec(scan);
  }
  const controlNames = new Set(['catch', 'for', 'if', 'switch', 'while', 'with']);
  const methodRe = new RegExp(`(?:^|[,\\{]\\s*)(?:async\\s+)?(${IDENTIFIER_PATTERN.source})\\s*\\([^)]*\\)\\s*\\{`, 'g');
  match = methodRe.exec(scan);
  while (match) {
    if (!controlNames.has(match[1])) addRange(methodRe.lastIndex - 1);
    match = methodRe.exec(scan);
  }
  return ranges;
}

function indexIsInsideRange(index, ranges) {
  return ranges.some((range) => index > range.start && index < range.end);
}

function addVisibleLocalDeclarationBindings(bindings, source, index) {
  const text = String(source || '');
  const scan = maskNonCodeForRouteGuard(text);
  const visibleStack = blockStackAt(text, index);
  const nestedFunctionRanges = collectNestedFunctionBodyRanges(text);
  const declarationRe = /\b(const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  let match = declarationRe.exec(scan);
  while (match) {
    const declarationStack = blockStackAt(text, match.index);
    if ((match[1] === 'var' && !indexIsInsideRange(match.index, nestedFunctionRanges))
      || stackStartsWith(visibleStack, declarationStack)) {
      bindings.add(match[2]);
    }
    match = declarationRe.exec(scan);
  }
  const destructuredRe = /\b(const|let|var)\s*\{([\s\S]*?)\}/g;
  match = destructuredRe.exec(scan);
  while (match) {
    const declarationStack = blockStackAt(text, match.index);
    if ((match[1] === 'var' && !indexIsInsideRange(match.index, nestedFunctionRanges))
      || stackStartsWith(visibleStack, declarationStack)) {
      addBindingNamesFromPattern(bindings, match[2]);
    }
    match = destructuredRe.exec(scan);
  }
  const arrayDestructuredRe = /\b(const|let|var)\s*\[([\s\S]*?)\]/g;
  match = arrayDestructuredRe.exec(scan);
  while (match) {
    const declarationStack = blockStackAt(text, match.index);
    if ((match[1] === 'var' && !indexIsInsideRange(match.index, nestedFunctionRanges))
      || stackStartsWith(visibleStack, declarationStack)) {
      addBindingNamesFromPattern(bindings, match[2]);
    }
    match = arrayDestructuredRe.exec(scan);
  }
}

function addBindingNamesFromPattern(bindings, pattern) {
  const text = String(pattern || '');
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
  return /\b(?:new\s+URL|URLSearchParams|searchParams|location)\b|[?&][^=&#\s]+\s*=/.test(String(body || ''));
}

function braceDepthAt(source, index) {
  const text = String(source || '').slice(0, Math.max(0, index));
  let depth = 0;
  let quote = '';
  let escaped = false;
  let regex = false;
  let inClass = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
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
    if (ch === '{') depth += 1;
    else if (ch === '}' && depth > 0) depth -= 1;
  }
  return depth;
}

function blockStackAt(source, index) {
  const text = String(source || '');
  const stack = [];
  let quote = '';
  let escaped = false;
  let regex = false;
  let inClass = false;
  for (let i = 0; i < Math.min(text.length, Math.max(0, index)); i += 1) {
    const ch = text[i];
    const next = text[i + 1];
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
    if (ch === '{') stack.push(i);
    else if (ch === '}' && stack.length) stack.pop();
  }
  return stack;
}

function referenceIsShadowedInScope(source, name, scope, scopedIndex) {
  const text = String(source || '');
  const scan = maskNonCodeForRouteGuard(text);
  const normalizedScope = scope || { start: 0, end: text.length };
  const globalIndex = normalizedScope.start + scopedIndex;
  const rootName = String(name || '').split(/\s*\.\s*/).filter(Boolean)[0] || '';
  if (!rootName) return false;
  const before = scan.slice(normalizedScope.start, globalIndex);
  const scopeStack = blockStackAt(text, normalizedScope.start);
  const referenceStack = blockStackAt(text, globalIndex);
  const stackIsReferenceAncestor = (stack) => (
    stack.length > scopeStack.length
    && stack.length <= referenceStack.length
    && stack.every((open, index) => referenceStack[index] === open)
  );
  const shadowRe = new RegExp(`\\b(?:const|let|var|function)\\s+${escapeRe(rootName)}\\b`, 'g');
  let shadow = shadowRe.exec(before);
  while (shadow) {
    if (stackIsReferenceAncestor(blockStackAt(text, normalizedScope.start + shadow.index))) return true;
    shadow = shadowRe.exec(before);
  }
  return false;
}

function extractBlockText(source, openBraceIndex) {
  return extractBlockSpan(source, openBraceIndex).body;
}

function topLevelRouteGuardSource(source) {
  const text = String(source || '');
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
  const text = String(source || '');
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
      path: String((file && file.path) || '').replace(/\\+/g, '/'),
      source: stripCommentsForRouteGuard((file && file.source) || '')
    }));
    return {
      path: String(contextSource.path || fallbackPath || '').replace(/\\+/g, '/'),
      files,
      source: files.map((file) => file.source).join('\n')
    };
  }
  return {
    path: String(fallbackPath || '').replace(/\\+/g, '/'),
    files: [],
    source: String(contextSource || fallbackSource || '')
  };
}

function resolveImportPath(fromPath, specifier) {
  const spec = String(specifier || '').trim();
  if (!spec.startsWith('.')) return '';
  const fromDir = String(fromPath || '').split('/').slice(0, -1).join('/');
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
  const collectFileAliases = () => {
    if (collector === collectRouteUrlFactoryAliases) {
      const fileContext = { ...context, path: file.path };
      const externalAliases = mergeImportedContextAliases(
        collectExternalUrlAliases(file.source),
        collectExternalUrlAliases,
        file.source,
        fileContext,
        { shadow: false }
      );
      const staticRelativeAliases = mergeImportedContextAliases(
        collectStaticRelativeUrlAliases(file.source),
        collectStaticRelativeUrlAliases,
        file.source,
        fileContext,
        { shadow: false }
      );
      return collector(file.source, externalAliases, staticRelativeAliases);
    }
    return collector(file.source);
  };
  const out = new Set(collectFileAliases());
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
    if (importedName === '*') {
      if (!shadowed.has(localName)) {
        contextAliases.forEach((alias) => out.add(`${localName}.${alias}`));
      }
      return;
    }
    if (contextAliases.has(importedName) && !shadowed.has(localName)) out.add(localName);
  });
  return out;
}

function routeKeyAliasParamIsShadowedAt(source, name, index) {
  const text = String(source || '');
  const rootName = String(name || '').split(/\s*\.\s*/).filter(Boolean)[0] || '';
  if (!rootName) return false;
  const paramsShadow = (paramsText) => {
    const bindings = new Set();
    addBindingNamesFromPattern(bindings, paramsText);
    return bindings.has(rootName);
  };
  const bodyContainsIndex = (openBraceIndex) => {
    const span = extractBlockSpan(text, openBraceIndex);
    return index > openBraceIndex && index < span.end;
  };
  const functionRe = /\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)\s*\{/g;
  let match = functionRe.exec(text);
  while (match) {
    if (match.index <= index && bodyContainsIndex(functionRe.lastIndex - 1) && paramsShadow(match[1])) return true;
    match = functionRe.exec(text);
  }
  const methodRe = new RegExp(`(?:^|[,\\{])\\s*(?:async\\s+)?${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE}\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  match = methodRe.exec(text);
  while (match) {
    if (match.index <= index && bodyContainsIndex(methodRe.lastIndex - 1) && paramsShadow(match[1])) return true;
    match = methodRe.exec(text);
  }
  const arrowBlockRe = /(?:^|[^\w$])(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g;
  match = arrowBlockRe.exec(text);
  while (match) {
    if (match.index <= index && bodyContainsIndex(arrowBlockRe.lastIndex - 1) && paramsShadow(match[1])) return true;
    match = arrowBlockRe.exec(text);
  }
  const singleArrowBlockRe = new RegExp(`(?:^|[^\\w$])(?:async\\s+)?(${IDENTIFIER_PATTERN.source})\\s*=>\\s*\\{`, 'g');
  match = singleArrowBlockRe.exec(text);
  while (match) {
    if (match.index <= index && bodyContainsIndex(singleArrowBlockRe.lastIndex - 1) && paramsShadow(match[1])) return true;
    match = singleArrowBlockRe.exec(text);
  }
  return false;
}

function routeKeyAliasIsShadowedAt(value, aliases, source, index) {
  const expression = stripWrappingParentheses(value);
  const importedAliases = aliases && aliases.importedAliases instanceof Set ? aliases.importedAliases : new Set();
  const localAliases = aliases && aliases.localAliases instanceof Set ? aliases.localAliases : new Set();
  if (!importedAliases.has(expression) || localAliases.has(expression)) return false;
  const text = String(source || '');
  return referenceIsShadowedInScope(text, expression, { start: 0, end: text.length }, index)
    || routeKeyAliasParamIsShadowedAt(text, expression, index);
}

function sourceArgIsRouteKey(arg, aliases, source = '', index = 0) {
  const value = String(arg || '').trim();
  const staticValue = staticStringExpressionValue(value);
  if (/^(?:tab|id)$/.test(staticValue || '')) return true;
  const matchesAlias = new RegExp(`^(?:${routeKeyExpressionPattern(aliases)})$`).test(value);
  return matchesAlias && !routeKeyAliasIsShadowedAt(value, aliases, source, index);
}

const STATIC_STRING_CONCAT_PATTERN_CACHE = new Map();

function quotedStaticPropertyPartPattern(value) {
  const escaped = escapeRe(value);
  return `(?:"${escaped}"|'${escaped}'|\`${escaped}\`)`;
}

function staticStringConcatExpressionPattern(value) {
  const text = String(value || '');
  if (!text) return '';
  if (STATIC_STRING_CONCAT_PATTERN_CACHE.has(text)) return STATIC_STRING_CONCAT_PATTERN_CACHE.get(text);
  const expressions = new Set([quotedStaticPropertyPartPattern(text)]);
  for (let first = 1; first < text.length; first += 1) {
    expressions.add([
      text.slice(0, first),
      text.slice(first)
    ].map(quotedStaticPropertyPartPattern).join('\\s*\\+\\s*'));
    for (let second = first + 1; second < text.length; second += 1) {
      expressions.add([
        text.slice(0, first),
        text.slice(first, second),
        text.slice(second)
      ].map(quotedStaticPropertyPartPattern).join('\\s*\\+\\s*'));
    }
  }
  const pattern = `(?:${Array.from(expressions).join('|')})`;
  STATIC_STRING_CONCAT_PATTERN_CACHE.set(text, pattern);
  return pattern;
}

function propertyAccessorPattern(name, aliases = new Set()) {
  const escaped = escapeRe(name);
  const aliasPattern = Array.from(aliases || []).map(escapeRe).join('|');
  const staticExpressionPattern = staticStringConcatExpressionPattern(name);
  const aliasAccess = aliasPattern
    ? `|\\s*(?:\\?\\.\\s*)?\\[\\s*(?:${aliasPattern})\\s*\\]`
    : '';
  return `(?:\\s*\\?\\.\\s*${escaped}|\\s*\\.\\s*${escaped}|\\s*\\?\\.\\s*\\[\\s*(?:${staticExpressionPattern})\\s*\\]|\\s*\\[\\s*(?:${staticExpressionPattern})\\s*\\]${aliasAccess})`;
}

function routeKeyWritePattern(owner, property = '', propertyAliases = new Set(), mutatorAliases = {}) {
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? propertyAccessorPattern(property, propertyAliases) : '';
  const mutator = `(?:${propertyAccessorPattern('set', mutatorAliases.set)}|${propertyAccessorPattern('append', mutatorAliases.append)}|${propertyAccessorPattern('delete', mutatorAliases.delete)})`;
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  return new RegExp(`${ownerPattern}${suffix}${mutator}\\s*(?:\\?\\.\\s*)?\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*(?:,|\\))`, 'g');
}

function routeKeyDispatchPattern(owner, property = '', propertyAliases = new Set(), mutatorAliases = {}) {
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? propertyAccessorPattern(property, propertyAliases) : '';
  const target = `${ownerPattern}${suffix}`;
  const mutator = `(?:${propertyAccessorPattern('set', mutatorAliases.set)}|${propertyAccessorPattern('append', mutatorAliases.append)}|${propertyAccessorPattern('delete', mutatorAliases.delete)})`;
  return new RegExp(`${target}${mutator}(?:\\s*(?:\\?\\.\\s*|\\.\\s*)(call|apply)|\\s*\\?\\.\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\]|\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\])\\s*(?:\\?\\.\\s*)?\\(`, 'g');
}

function collectBoundRouteMutators(source, owner, property = '', propertyAliases = new Set(), mutatorAliases = {}) {
  const text = String(source || '');
  const out = new Set();
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? propertyAccessorPattern(property, propertyAliases) : '';
  const target = `${ownerPattern}${suffix}`;
  const mutator = `(?:${propertyAccessorPattern('set', mutatorAliases.set)}|${propertyAccessorPattern('append', mutatorAliases.append)}|${propertyAccessorPattern('delete', mutatorAliases.delete)})`;
  const re = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*${target}${mutator}\\s*\\.\\s*bind\\s*\\(\\s*${target}\\s*\\)`, 'g');
  let match = re.exec(text);
  while (match) {
    out.add(match[1]);
    match = re.exec(text);
  }
  const unboundRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*${target}${mutator}\\s*;?`, 'g');
  match = unboundRe.exec(text);
  while (match) {
    if (match[1] === 'const' || !bindingIsReassigned(text, match[2], unboundRe.lastIndex)) out.add(match[2]);
    match = unboundRe.exec(text);
  }
  const destructureRe = new RegExp(`\\b(const|let|var)\\s*\\{([\\s\\S]*?)\\}\\s*=\\s*${target}\\b`, 'g');
  match = destructureRe.exec(text);
  while (match) {
    const kind = match[1];
    const body = match[2] || '';
    ['set', 'append', 'delete'].forEach((key) => {
      for (const alias of collectDestructuredStaticPropertyAliases(body, key)) {
        if (kind === 'const' || !bindingIsReassigned(text, alias, destructureRe.lastIndex)) out.add(alias);
      }
    });
    match = destructureRe.exec(text);
  }
  return out;
}

function containsRouteKeyWriteForOwner(source, owner, aliases, property = '') {
  const text = String(source || '');
  const propertyAliases = property ? collectStaticStringAliases(text, property) : new Set();
  const mutatorAliases = {
    set: collectStaticStringAliases(text, 'set'),
    append: collectStaticStringAliases(text, 'append'),
    delete: collectStaticStringAliases(text, 'delete')
  };
  const re = routeKeyWritePattern(owner, property, propertyAliases, mutatorAliases);
  let match = re.exec(text);
  while (match) {
    if (sourceArgIsRouteKey(match[1], aliases, text, match.index)) return true;
    match = re.exec(text);
  }
  const dispatchRe = routeKeyDispatchPattern(owner, property, propertyAliases, mutatorAliases);
  match = dispatchRe.exec(text);
  while (match) {
    const method = match[1] || match[2] || match[3];
    const parsed = extractCallArgs(text, dispatchRe.lastIndex);
    const parts = splitTopLevelArgs(parsed.args);
    const applyArgs = method === 'apply' ? splitTopLevelArgs((parts[1] || '').trim().replace(/^\[\s*|\s*\]$/g, '')) : [];
    const routeKeyArg = method === 'apply' ? applyArgs[0] : parts[1];
    if (sourceArgIsRouteKey(routeKeyArg || '', aliases, text, match.index)) return true;
    if (parsed.end > dispatchRe.lastIndex) dispatchRe.lastIndex = parsed.end;
    match = dispatchRe.exec(text);
  }
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? propertyAccessorPattern(property, propertyAliases) : '';
  const target = `${ownerPattern}${suffix}`;
  for (const mutator of collectBoundRouteMutators(text, owner, property, propertyAliases, mutatorAliases)) {
    const mutatorRe = new RegExp(`(?:^|[^\\w$.])${escapeRe(mutator)}\\s*(?:\\?\\.\\s*)?\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*(?:,|\\))`, 'g');
    match = mutatorRe.exec(text);
    while (match) {
      if (!hasMemberAccessPrefix(text, match.index) && sourceArgIsRouteKey(match[1], aliases, text, match.index)) return true;
      match = mutatorRe.exec(text);
    }
    const mutatorDispatchRe = new RegExp(`(?:^|[^\\w$.])${escapeRe(mutator)}(?:\\s*(?:\\?\\.\\s*|\\.\\s*)(call|apply)|\\s*\\?\\.\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\]|\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\])\\s*(?:\\?\\.\\s*)?\\(`, 'g');
    match = mutatorDispatchRe.exec(text);
    while (match) {
      const method = match[1] || match[2] || match[3];
      const parsed = extractCallArgs(text, mutatorDispatchRe.lastIndex);
      const parts = splitTopLevelArgs(parsed.args);
      const applyArgs = method === 'apply' ? splitTopLevelArgs((parts[1] || '').trim().replace(/^\[\s*|\s*\]$/g, '')) : [];
      const routeKeyArg = method === 'apply' ? applyArgs[0] : parts[1];
      if (!hasMemberAccessPrefix(text, match.index) && sourceArgIsRouteKey(routeKeyArg || '', aliases, text, match.index)) return true;
      if (parsed.end > mutatorDispatchRe.lastIndex) mutatorDispatchRe.lastIndex = parsed.end;
      match = mutatorDispatchRe.exec(text);
    }
  }
  return false;
}

function collectUrlSearchParamsConstructors(source) {
  const text = String(source || '');
  const out = [];
  const seen = new Set();
  const constructorAliases = collectUrlSearchParamsConstructorAliases(text);
  const constructorPattern = urlSearchParamsConstructorPattern(constructorAliases);
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+(?:${constructorPattern})\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+(?:${constructorPattern})\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_PATTERN_SOURCE})\\s*=\\s*(?:\\(\\s*)*new\\s+(?:${constructorPattern})\\s*\\(`, 'g')
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

function collectUrlSearchParamsConstructorAliases(source) {
  const text = String(source || '');
  const aliases = new Set();
  const re = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:(?:window|globalThis)\\s*\\.\\s*)?URLSearchParams\\b`, 'g');
  let match = re.exec(text);
  while (match) {
    aliases.add(match[1]);
    match = re.exec(text);
  }
  const destructureRe = /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*(?:window|globalThis)\b/g;
  let destructure = destructureRe.exec(text);
  while (destructure) {
    const body = destructure[1] || '';
    const aliasRe = /(?:^|,)\s*URLSearchParams\s*:\s*([A-Za-z_$][\w$]*)/g;
    let alias = aliasRe.exec(body);
    while (alias) {
      aliases.add(alias[1]);
      alias = aliasRe.exec(body);
    }
    if (/(?:^|,)\s*URLSearchParams\s*(?:,|$)/.test(body)) aliases.add('URLSearchParams');
    destructure = destructureRe.exec(text);
  }
  return aliases;
}

function urlSearchParamsConstructorPattern(aliases = new Set()) {
  const aliasPattern = aliasExpressionPattern(aliases);
  return aliasPattern
    ? `(?:(?:window|globalThis)\\s*\\.\\s*)?URLSearchParams|${aliasPattern}`
    : `(?:(?:window|globalThis)\\s*\\.\\s*)?URLSearchParams`;
}

function collectUrlConstructorAliases(source) {
  const text = String(source || '');
  const aliases = new Set();
  const re = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:(?:window|globalThis)\\s*\\.\\s*)?URL\\b`, 'g');
  let match = re.exec(text);
  while (match) {
    aliases.add(match[1]);
    match = re.exec(text);
  }
  const destructureRe = /\b(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*(?:window|globalThis)\b/g;
  let destructure = destructureRe.exec(text);
  while (destructure) {
    const body = destructure[1] || '';
    const aliasRe = /(?:^|,)\s*URL\s*:\s*([A-Za-z_$][\w$]*)/g;
    let alias = aliasRe.exec(body);
    while (alias) {
      aliases.add(alias[1]);
      alias = aliasRe.exec(body);
    }
    if (/(?:^|,)\s*URL\s*(?:,|$)/.test(body)) aliases.add('URL');
    destructure = destructureRe.exec(text);
  }
  return aliases;
}

function urlConstructorPattern(aliases = new Set()) {
  const aliasPattern = aliasExpressionPattern(aliases);
  return aliasPattern
    ? `${URL_CONSTRUCTOR_PATTERN_SOURCE}|${aliasPattern}`
    : URL_CONSTRUCTOR_PATTERN_SOURCE;
}

function extractCallArgs(source, argsStart) {
  const text = String(source || '');
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
  const text = String(source || '');
  let start = valueStart;
  while (start < text.length && /\s/.test(text[start])) start += 1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
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
      if (ch === '\n' || ch === '\r') {
        let prev = i - 1;
        while (prev >= start && /\s/.test(text[prev])) prev -= 1;
        let next = i + 1;
        while (next < text.length && /\s/.test(text[next])) next += 1;
        if (/[+\-*/%&|?:.,]$/.test(text[prev] || '') || /^[+\-*/%&|?:.,]/.test(text[next] || '')) continue;
      }
      return text.slice(start, i);
    }
  }
  return text.slice(start);
}

function splitTopLevelArgs(args) {
  const text = String(args || '');
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
  return Array.from(aliases || []).map(escapeRe).join('|');
}

function aliasExpressionPattern(aliases) {
  const aliasPattern = Array.from(aliases || []).map(expressionReferencePattern).join('|');
  return aliasPattern ? `(?:${aliasPattern}|\\(\\s*(?:${aliasPattern})\\s*\\))` : '';
}

function hasMemberAccessPrefix(source, index) {
  const text = String(source || '');
  let cursor = Math.max(0, index) - 1;
  while (cursor >= 0 && /\s/.test(text[cursor])) cursor -= 1;
  return text[cursor] === '.';
}

function objectPropertyNameFromPart(part) {
  const text = String(part || '').trim();
  const computed = text.match(new RegExp(`^\\[\\s*(${STATIC_MEMBER_STRING_PATTERN_SOURCE})\\s*\\]\\s*:`));
  if (computed) {
    const value = staticStringExpressionValue(computed[1]);
    return new RegExp(`^${IDENTIFIER_PATTERN.source}$`).test(value || '') ? value : '';
  }
  const quoted = text.match(new RegExp(`^(${STATIC_MEMBER_STRING_PATTERN_SOURCE})\\s*:`));
  if (quoted) {
    const value = staticStringExpressionValue(quoted[1]);
    return new RegExp(`^${IDENTIFIER_PATTERN.source}$`).test(value || '') ? value : '';
  }
  const named = text.match(new RegExp(`^(${IDENTIFIER_PATTERN.source})\\s*:`));
  if (named) return named[1];
  const shorthand = text.match(new RegExp(`^(${IDENTIFIER_PATTERN.source})$`));
  return shorthand ? shorthand[1] : '';
}

function objectPropertyValueFromPart(part) {
  const text = String(part || '').trim();
  const computed = text.match(new RegExp(`^\\[\\s*${STATIC_MEMBER_STRING_PATTERN_SOURCE}\\s*\\]\\s*:\\s*([\\s\\S]+)$`));
  if (computed) return computed[1].trim();
  const quoted = text.match(new RegExp(`^${STATIC_MEMBER_STRING_PATTERN_SOURCE}\\s*:\\s*([\\s\\S]+)$`));
  if (quoted) return quoted[1].trim();
  const named = text.match(new RegExp(`^${IDENTIFIER_PATTERN.source}\\s*:\\s*([\\s\\S]+)$`));
  if (named) return named[1].trim();
  const shorthand = text.match(new RegExp(`^(${IDENTIFIER_PATTERN.source})$`));
  return shorthand ? shorthand[1] : '';
}

function expressionReferencesRouteFactory(expression, factories) {
  const value = stripWrappingParentheses(expression);
  for (const factory of factories || []) {
    if (new RegExp(`^${expressionReferencePattern(factory)}$`).test(value)) return true;
  }
  return false;
}

function routeFactoryReferenceName(expression, factories, isReferenceShadowed = null, index = 0, source = '') {
  const value = stripWrappingParentheses(expression);
  for (const factory of factories || []) {
    if (new RegExp(`^${expressionReferencePatternForSource(factory, source)}$`).test(value)
      && !(isReferenceShadowed && isReferenceShadowed(factory, index))) {
      return factory;
    }
  }
  return '';
}

function routeFactoryBindReferenceName(expression, factories, isReferenceShadowed = null, index = 0, source = '') {
  const value = stripWrappingParentheses(expression);
  for (const factory of factories || []) {
    if (new RegExp(`^(?:\\(\\s*)*${expressionReferencePatternForSource(factory, source)}\\s*(?:\\))*\\s*(?:\\?\\.\\s*|\\.\\s*)bind\\s*\\(`).test(value)
      && !(isReferenceShadowed && isReferenceShadowed(factory, index))) {
      return factory;
    }
  }
  return '';
}

function expandRouteUrlFactoryAliases(source, factories, options = {}) {
  const text = String(source || '');
  const scan = maskNonCodeForRouteGuard(text);
  const out = new Set(factories || []);
  const isReferenceShadowed = typeof options.isReferenceShadowed === 'function' ? options.isReferenceShadowed : null;
  const rootFactories = new Set(factories || []);
  const referenceIsShadowed = (factory, index) => (
    rootFactories.has(factory) && isReferenceShadowed && isReferenceShadowed(factory, index)
  );
  let changed = true;
  while (changed) {
    changed = false;
    if (!out.size) break;
    const bindingAliasRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*`, 'g');
    let alias = bindingAliasRe.exec(scan);
    while (alias) {
      const expression = extractAssignmentExpression(text, bindingAliasRe.lastIndex);
      const directFactory = routeFactoryReferenceName(expression, out, referenceIsShadowed, alias.index, text);
      const bindFactory = directFactory ? '' : routeFactoryBindReferenceName(expression, out, referenceIsShadowed, alias.index, text);
      if ((directFactory || bindFactory) && !out.has(alias[2]) && (alias[1] === 'const' || !bindingIsReassigned(text, alias[2], bindingAliasRe.lastIndex + expression.length))) {
        out.add(alias[2]);
        changed = true;
      }
      bindingAliasRe.lastIndex += expression.length;
      alias = bindingAliasRe.exec(scan);
    }
    const memberAliasRe = new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_WITH_STATIC_KEYS_PATTERN_SOURCE})\\s*=\\s*(?!=|>)`, 'g');
    alias = memberAliasRe.exec(scan);
    while (alias) {
      const expression = extractAssignmentExpression(text, memberAliasRe.lastIndex);
      const aliasName = normalizeStaticMemberExpression(alias[1]);
      if (routeFactoryReferenceName(expression, out, referenceIsShadowed, alias.index, text) && !out.has(aliasName)) {
        out.add(aliasName);
        changed = true;
      }
      memberAliasRe.lastIndex += expression.length;
      alias = memberAliasRe.exec(scan);
    }
    const objectAliasRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*\\{`, 'g');
    let objectAlias = objectAliasRe.exec(scan);
    while (objectAlias) {
      const kind = objectAlias[1];
      const objectName = objectAlias[2];
      const objectSpan = extractBlockSpan(text, objectAliasRe.lastIndex - 1);
      if (kind === 'const' || !bindingIsReassigned(text, objectName, objectAliasRe.lastIndex)) {
        for (const part of splitTopLevelArgs(objectSpan.body)) {
          const property = objectPropertyNameFromPart(part);
          const value = objectPropertyValueFromPart(part);
          if (property && value && routeFactoryReferenceName(value, out, referenceIsShadowed, objectAlias.index, text)) {
            const aliasName = `${objectName}.${property}`;
            if (!out.has(aliasName)) {
              out.add(aliasName);
              changed = true;
            }
          }
        }
      }
      if (objectSpan.end > objectAliasRe.lastIndex) objectAliasRe.lastIndex = objectSpan.end;
      objectAlias = objectAliasRe.exec(scan);
    }
    for (const factory of Array.from(out)) {
      const parts = String(factory || '').split('.');
      if (parts.length < 2 || !parts.every((part) => new RegExp(`^(?:this|${IDENTIFIER_PATTERN.source})$`).test(part))) continue;
      const owner = parts.slice(0, -1).join('.');
      const property = parts[parts.length - 1];
      const destructureRe = new RegExp(`\\b(const|let|var)\\s*\\{([\\s\\S]*?)\\}\\s*=\\s*${expressionReferencePattern(owner)}\\b`, 'g');
      let destructure = destructureRe.exec(scan);
      while (destructure) {
        const kind = destructure[1];
        for (const aliasName of collectDestructuredStaticPropertyAliases(destructure[2] || '', property)) {
          if (!out.has(aliasName)
            && !referenceIsShadowed(factory, destructure.index)
            && (kind === 'const' || !bindingIsReassigned(text, aliasName, destructureRe.lastIndex))) {
            out.add(aliasName);
            changed = true;
          }
        }
        destructure = destructureRe.exec(scan);
      }
    }
  }
  return out;
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
  const passThroughCall = text.match(/^(?:Object\s*\.\s*(?:entries|fromEntries)|Array\s*\.\s*from)\s*\(/);
  if (passThroughCall) {
    const parsed = extractCallArgs(text, passThroughCall[0].length);
    return urlSearchParamsInitializerHasRouteKey(parsed.args, aliases);
  }
  const mapCall = text.match(/^new\s+Map\s*\(/);
  if (mapCall) {
    const parsed = extractCallArgs(text, mapCall[0].length);
    return urlSearchParamsInitializerHasRouteKey(parsed.args, aliases);
  }
  if (text.startsWith('{')) {
    if (ROUTE_KEY_OBJECT_INIT_PATTERN.test(text) || ROUTE_KEY_OBJECT_SHORTHAND_PATTERN.test(text)) return true;
    const routeKeyExpression = routeKeyExpressionPattern(aliases);
    if (new RegExp(`(?:^|[,\\{]\\s*)\\[\\s*(?:${routeKeyExpression})\\s*\\]\\s*:`).test(text)) return true;
    const body = text.endsWith('}') ? text.slice(1, -1) : text.slice(1);
    return splitTopLevelArgs(body).some((part) => {
      const computed = String(part || '').trim().match(/^\[([\s\S]+?)\]\s*:/);
      return Boolean(computed && sourceArgIsRouteKey(computed[1], aliases));
    });
  }
  if (text.startsWith('[')) {
    if (ROUTE_KEY_ARRAY_INIT_PATTERN.test(text)) return true;
    const routeKeyExpression = routeKeyExpressionPattern(aliases);
    if (new RegExp(`\\[\\s*(?:${routeKeyExpression})\\s*,`).test(text)) return true;
    const body = text.endsWith(']') ? text.slice(1, -1) : text.slice(1);
    return splitTopLevelArgs(body).some((part) => {
      const tuple = stripWrappingParentheses(part);
      if (!tuple.startsWith('[')) return false;
      const inner = tuple.endsWith(']') ? tuple.slice(1, -1) : tuple.slice(1);
      const [key] = splitTopLevelArgs(inner);
      return sourceArgIsRouteKey(key, aliases);
    });
  }
  if (/^(['"`])(?:tab|id)\s*=/.test(text)) return true;
  if (/^(['"`])(?:tab|id)\1\s*\+\s*(['"`])=\2/.test(text)) return true;
  const routeKeyExpression = routeKeyExpressionPattern(aliases);
  return new RegExp(`^(?:${routeKeyExpression})\\s*\\+\\s*(['"\`])=\\1`).test(text)
    || new RegExp(`^\`\\s*\\$\\{\\s*(?:${routeKeyExpression})\\s*\\}\\s*=`).test(text);
}

function urlSearchParamsExpressionArgs(expression, constructorAliases = new Set()) {
  const text = stripWrappingParentheses(expression);
  const match = text.match(new RegExp(`^new\\s+(?:${urlSearchParamsConstructorPattern(constructorAliases)})\\s*\\(`));
  if (!match) return null;
  return extractCallArgs(text, match[0].length).args;
}

function expressionContainsRouteQueryBuilder(expression, aliases = new Set(), constructorAliases = new Set()) {
  const text = String(expression || '');
  const re = new RegExp(`\\bnew\\s+(?:${urlSearchParamsConstructorPattern(constructorAliases)})\\s*\\(`, 'g');
  let match = re.exec(text);
  while (match) {
    const parsed = extractCallArgs(text, re.lastIndex);
    if (urlSearchParamsInitializerHasRouteKey(parsed.args, aliases)) return true;
    if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
    match = re.exec(text);
  }
  return false;
}

function expressionContainsRouteQueryStringBuilder(expression, aliases = new Set()) {
  const text = String(expression || '');
  if (/(?:^|[^\w$])(['"`])(?:tab|id)=/.test(text)) return true;
  const routeKeyExpression = routeKeyExpressionPattern(aliases);
  if (new RegExp(`(?:${routeKeyExpression})\\s*\\+\\s*(['"\`])=\\1`).test(text)
    || new RegExp(`\\$\\{\\s*(?:${routeKeyExpression})\\s*\\}\\s*=`).test(text)) {
    return true;
  }
  const parts = splitTopLevelConcatParts(text);
  if (parts.length >= 2) {
    let staticPrefix = '';
    for (const part of parts) {
      const partValue = staticStringExpressionValue(part);
      if (partValue == null) break;
      staticPrefix += partValue;
      if (/^(?:tab|id)=/.test(staticPrefix)) return true;
    }
    const first = staticStringExpressionValue(parts[0]);
    const second = staticStringExpressionValue(parts[1]);
    if (/^(?:tab|id)=/.test(first || '')) return true;
    if (/^(?:tab|id)$/.test(first || '') && String(second || '').startsWith('=')) return true;
  }
  return false;
}

function expressionBuildsRouteQuery(expression, aliases = new Set(), queryAliases = new Set(), constructorAliases = new Set()) {
  const text = stripWrappingParentheses(expression);
  if (!text) return false;
  if (urlSearchParamsInitializerHasRouteKey(text, aliases)
    || expressionIsQueryAliasReference(text, queryAliases)) return true;
  const paramsArgs = urlSearchParamsExpressionArgs(text, constructorAliases);
  if (paramsArgs != null) return urlSearchParamsInitializerHasRouteKey(paramsArgs, aliases);
  if (expressionContainsRouteQueryBuilder(text, aliases, constructorAliases)) return true;
  if (expressionContainsRouteQueryStringBuilder(text, aliases)) return true;
  const stringCall = text.match(/^String\s*\(/);
  if (stringCall) {
    const parsed = extractCallArgs(text, stringCall[0].length);
    return expressionBuildsRouteQuery(parsed.args, aliases, queryAliases, constructorAliases);
  }
  return false;
}

function collectParamsSerializationAliases(source, name) {
  const text = String(source || '');
  const namePattern = expressionReferencePattern(name);
  const aliases = new Set();
  const sourcePattern = `(?:${namePattern}(?:\\s*\\.\\s*toString\\s*\\(\\s*\\))?|String\\s*\\(\\s*${namePattern}\\s*\\))`;
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
  const text = String(source || '');
  if (seen.has(name)) return false;
  seen.add(name);
  const namePattern = expressionReferencePattern(name);
  const serializedPattern = `(?:${namePattern}(?:\\b|\\s*\\.\\s*toString\\s*\\(\\s*\\))|String\\s*\\(\\s*${namePattern}\\s*\\))`;
  const concatRe = new RegExp(`(['"\`])((?:\\\\[\\s\\S]|(?!\\1)[\\s\\S])*?[?&])\\1\\s*\\+\\s*${serializedPattern}`, 'g');
  let match = concatRe.exec(text);
  while (match) {
    const content = match[2];
    const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
    const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
    if (!isExternalUrlPrefix(prefix) && !inlineParamsConcatHasExternalPrefix(text, match, externalAliases)) return true;
    match = concatRe.exec(text);
  }
  const templateRe = new RegExp(`\`((?:\\\\[\\s\\S]|(?!\`)[\\s\\S])*?[?&])\\$\\{\\s*${serializedPattern}\\s*\\}`, 'g');
  match = templateRe.exec(text);
  while (match) {
    if (!templateRouteContentHasExternalPrefix(text, match[1], externalAliases)) return true;
    match = templateRe.exec(text);
  }
  const locationSearchRe = new RegExp(`${locationSearchWritePattern(collectLocationAliases(text)).source}\\s*${serializedPattern}`, 'g');
  if (locationSearchRe.test(text)) return true;
  for (const alias of collectParamsSerializationAliases(text, name)) {
    if (containsRelativeParamsSerialization(text, alias, seen, externalAliases)) return true;
  }
  return false;
}

function containsForbiddenUrlSearchParamsVariable(source, aliases, externalAliases = null) {
  const text = String(source || '');
  const vars = collectUrlSearchParamsVariables(text);
  for (const name of vars) {
    if (containsRouteKeyWriteForOwner(text, name, aliases) && containsRelativeParamsSerialization(text, name, new Set(), externalAliases)) {
      return true;
    }
  }
  return false;
}

function containsForbiddenUrlSearchParamsInitializer(source, aliases = new Set(), externalAliases = null) {
  const text = String(source || '');
  const initializers = collectUrlSearchParamsInitializers(text);
  for (const { name, args } of initializers) {
    if (urlSearchParamsInitializerHasRouteKey(args, aliases) && containsRelativeParamsSerialization(text, name, new Set(), externalAliases)) {
      return true;
    }
  }
  return false;
}

function collectRouteQueryAliases(source, aliases = new Set(), constructorAliases = collectUrlSearchParamsConstructorAliases(source)) {
  const text = String(source || '');
  const out = new Set();
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=`, 'g'),
    new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_PATTERN_SOURCE})\\s*=`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const expression = extractAssignmentExpression(text, re.lastIndex);
      if (expressionBuildsRouteQuery(expression, aliases, out, constructorAliases)) out.add(match[1]);
      match = re.exec(text);
    }
  });
  return out;
}

function expressionIsQueryAliasReference(expression, queryAliases = new Set()) {
  const patterns = Array.from(queryAliases || []).map((alias) => `(?:\\(\\s*)*${expressionReferencePattern(alias)}(?:\\s*\\))*`);
  if (!patterns.length) return false;
  const reference = `(?:${patterns.join('|')})`;
  return new RegExp(`^(?:${reference}(?:\\s*\\.\\s*toString\\s*\\(\\s*\\))?|String\\s*\\(\\s*${reference}\\s*\\))$`).test(String(expression || '').trim());
}

function containsRelativeQueryAliasSerialization(source, queryAliases = new Set(), externalAliases = null) {
  for (const alias of queryAliases || []) {
    if (containsRelativeParamsSerialization(source, alias, new Set(), externalAliases)) return true;
  }
  return false;
}

function inlineParamsConcatHasExternalPrefix(text, literalMatch, externalAliases = null) {
  const content = String(literalMatch[2] || '');
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = String(text || '').slice(0, literalMatch.index);
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
  const value = String(content || '');
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
  const text = String(source || '');
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
  const text = String(source || '');
  const constructorAliases = collectUrlSearchParamsConstructorAliases(text);
  const re = new RegExp(`\\bnew\\s+(?:${urlSearchParamsConstructorPattern(constructorAliases)})\\s*\\(`, 'g');
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
  const content = String(match[2] || '');
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = String(text || '').slice(0, match.index);
  const literalPrefix = before.match(/(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1\s*\+\s*$/);
  if (literalPrefix && isExternalUrlPrefix(literalPrefix[2])) return true;
  const aliasPrefix = before.match(/\b([A-Za-z_$][\w$]*)\s*\+\s*$/);
  if (aliasPrefix) {
    const aliases = externalAliases || collectExternalUrlAliases(text);
    if (aliases.has(aliasPrefix[1])) return true;
  }
  return false;
}

function containsForbiddenSplitRouteQueryLiteral(source, externalAliases = null, aliases = new Set()) {
  const text = String(source || '');
  SPLIT_ROUTE_QUERY_LITERAL_PATTERN.lastIndex = 0;
  let match = SPLIT_ROUTE_QUERY_LITERAL_PATTERN.exec(text);
  while (match) {
    if (!splitRouteQueryHasExternalPrefix(text, match, externalAliases)) return true;
    match = SPLIT_ROUTE_QUERY_LITERAL_PATTERN.exec(text);
  }
  const splitPrefixRe = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?[?&])\1\s*\+\s*/g;
  match = splitPrefixRe.exec(text);
  while (match) {
    if (!splitRouteQueryHasExternalPrefix(text, match, externalAliases)) {
      const expression = extractAssignmentExpression(text, splitPrefixRe.lastIndex);
      if (expressionBuildsRouteQuery(expression, aliases)) return true;
    }
    match = splitPrefixRe.exec(text);
  }
  return false;
}

function containsForbiddenRouteKeyAliasConstruction(source, aliases = new Set(), externalAliases = null) {
  const routeKeyExpression = routeKeyExpressionPattern(aliases);
  const text = String(source || '');
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

function collectRouteUrlFactoryAliases(source, externalAliases = collectExternalUrlAliases(source), staticRelativeAliases = collectStaticRelativeUrlAliases(source)) {
  const text = String(source || '');
  const scan = maskNonCodeForRouteGuard(text);
  const out = new Set();
  const constructorPattern = urlConstructorPattern(collectUrlConstructorAliases(text));
  const addFactoryAlias = (name, index) => {
    if (braceDepthAt(text, index) === 0) out.add(name);
  };
  const scopedUrlAliases = (body, paramsText = '', offset = null) => {
    const scopedExternalAliases = new Set(externalAliases);
    const scopedStaticRelativeAliases = new Set(staticRelativeAliases);
    const bindings = new Set();
    addBindingNamesFromPattern(bindings, paramsText);
    if (offset == null) addLocalDeclarationBindings(bindings, body, { topLevelOnly: true });
    else addVisibleLocalDeclarationBindings(bindings, body, offset);
    bindings.forEach((name) => {
      scopedExternalAliases.delete(name);
      scopedStaticRelativeAliases.delete(name);
    });
    return { scopedExternalAliases, scopedStaticRelativeAliases };
  };
  const bodyReturnsRouteUrl = (body, paramsText = '') => {
    const nestedFunctionRanges = collectNestedFunctionBodyRanges(body);
    const routeUrlVariables = new Map();
    const variableRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
    let variable = variableRe.exec(body);
    while (variable) {
      if (indexIsInsideRange(variable.index, nestedFunctionRanges)) {
        variable = variableRe.exec(body);
        continue;
      }
      const { scopedExternalAliases, scopedStaticRelativeAliases } = scopedUrlAliases(body, paramsText, variable.index);
      const parsed = extractCallArgs(body, variableRe.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, scopedExternalAliases, scopedStaticRelativeAliases)) {
        routeUrlVariables.set(variable[2], { kind: variable[1], end: parsed.end });
      }
      if (parsed.end > variableRe.lastIndex) variableRe.lastIndex = parsed.end;
      variable = variableRe.exec(body);
    }
    const returnedAliasRe = new RegExp(`\\breturn\\s+(?:\\(\\s*)*(${IDENTIFIER_PATTERN.source})(?:\\s*\\))*\\s*;?`, 'g');
    let returnedAlias = returnedAliasRe.exec(body);
    while (returnedAlias) {
      if (indexIsInsideRange(returnedAlias.index, nestedFunctionRanges)) {
        returnedAlias = returnedAliasRe.exec(body);
        continue;
      }
      const routeUrlVariable = routeUrlVariables.get(returnedAlias[1]);
      if (routeUrlVariable
        && (routeUrlVariable.kind === 'const'
          || !bindingIsReassigned(body.slice(0, returnedAlias.index), returnedAlias[1], routeUrlVariable.end))) {
        return true;
      }
      returnedAlias = returnedAliasRe.exec(body);
    }
    const re = new RegExp(`\\breturn\\s+(?:\\(\\s*)*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
    let match = re.exec(body);
    while (match) {
      if (indexIsInsideRange(match.index, nestedFunctionRanges)) {
        match = re.exec(body);
        continue;
      }
      const { scopedExternalAliases, scopedStaticRelativeAliases } = scopedUrlAliases(body, paramsText, match.index);
      const parsed = extractCallArgs(body, re.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, scopedExternalAliases, scopedStaticRelativeAliases)) return true;
      if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
      match = re.exec(body);
    }
    return false;
  };
  const expressionReturnsRouteUrl = (expression, paramsText = '') => {
    const { scopedExternalAliases, scopedStaticRelativeAliases } = scopedUrlAliases('', paramsText);
    const value = stripWrappingParentheses(expression);
    const match = value.match(new RegExp(`^new\\s+(?:${constructorPattern})\\s*\\(`));
    if (!match) return false;
    const parsed = extractCallArgs(value, match[0].length);
    return !urlConstructorArgsAreExternal(parsed.args, scopedExternalAliases, scopedStaticRelativeAliases);
  };
  const functionRe = new RegExp(`\\b(?:async\\s+)?function\\s+(${IDENTIFIER_PATTERN.source})\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  let match = functionRe.exec(scan);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, functionRe.lastIndex - 1), match[2])) addFactoryAlias(match[1], match.index);
    match = functionRe.exec(scan);
  }
  const functionExpressionRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  match = functionExpressionRe.exec(scan);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, functionExpressionRe.lastIndex - 1), match[2])) addFactoryAlias(match[1], match.index);
    match = functionExpressionRe.exec(scan);
  }
  const arrowBlockRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>\\s*\\{`, 'g');
  match = arrowBlockRe.exec(scan);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, arrowBlockRe.lastIndex - 1), match[2])) addFactoryAlias(match[1], match.index);
    match = arrowBlockRe.exec(scan);
  }
  const arrowExpressionRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>\\s*`, 'g');
  match = arrowExpressionRe.exec(scan);
  while (match) {
    const expression = extractAssignmentExpression(text, arrowExpressionRe.lastIndex);
    if (expressionReturnsRouteUrl(expression, match[2])) addFactoryAlias(match[1], match.index);
    arrowExpressionRe.lastIndex += expression.length;
    match = arrowExpressionRe.exec(scan);
  }
  const singleArrowBlockRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?(${IDENTIFIER_PATTERN.source})\\s*=>\\s*\\{`, 'g');
  match = singleArrowBlockRe.exec(scan);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, singleArrowBlockRe.lastIndex - 1), match[2])) addFactoryAlias(match[1], match.index);
    match = singleArrowBlockRe.exec(scan);
  }
  const singleArrowExpressionRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?(${IDENTIFIER_PATTERN.source})\\s*=>\\s*`, 'g');
  match = singleArrowExpressionRe.exec(scan);
  while (match) {
    const expression = extractAssignmentExpression(text, singleArrowExpressionRe.lastIndex);
    if (expressionReturnsRouteUrl(expression, match[2])) addFactoryAlias(match[1], match.index);
    singleArrowExpressionRe.lastIndex += expression.length;
    match = singleArrowExpressionRe.exec(scan);
  }
  const scanObjectRouteFactoryMembers = (baseName, objectBody, objectBodyStart, objectIndex) => {
    const objectBodyScan = maskNonCodeForRouteGuard(objectBody);
    const memberIsTopLevel = (index) => braceDepthAt(objectBody, index) === 0;
    const memberIsScannable = (index) => (
      (index === 0 || objectBodyScan[index] === ',')
      && memberIsTopLevel(index)
    );
    const methodRe = new RegExp(`(?:^|[,\\{])\\s*(?:async\\s+)?(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
    let method = methodRe.exec(objectBody);
    while (method) {
      if (!memberIsScannable(method.index)) {
        method = methodRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(method[1]);
      const methodOpenBrace = objectBodyStart + methodRe.lastIndex - 1;
      if (property && bodyReturnsRouteUrl(extractBlockText(text, methodOpenBrace), method[2])) {
        addFactoryAlias(`${baseName}.${property}`, objectIndex);
      }
      const methodSpan = extractBlockSpan(text, methodOpenBrace);
      methodRe.lastIndex = Math.max(methodRe.lastIndex, methodSpan.end - objectBodyStart);
      method = methodRe.exec(objectBody);
    }
    const propertyFunctionRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
    let propertyFunction = propertyFunctionRe.exec(objectBody);
    while (propertyFunction) {
      if (!memberIsScannable(propertyFunction.index)) {
        propertyFunction = propertyFunctionRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyFunction[1]);
      const functionOpenBrace = objectBodyStart + propertyFunctionRe.lastIndex - 1;
      if (property && bodyReturnsRouteUrl(extractBlockText(text, functionOpenBrace), propertyFunction[2])) {
        addFactoryAlias(`${baseName}.${property}`, objectIndex);
      }
      const functionSpan = extractBlockSpan(text, functionOpenBrace);
      propertyFunctionRe.lastIndex = Math.max(propertyFunctionRe.lastIndex, functionSpan.end - objectBodyStart);
      propertyFunction = propertyFunctionRe.exec(objectBody);
    }
    const propertyArrowRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENTIFIER_PATTERN.source}))\\s*=>\\s*`, 'g');
    let propertyArrow = propertyArrowRe.exec(objectBody);
    while (propertyArrow) {
      if (!memberIsScannable(propertyArrow.index)) {
        propertyArrow = propertyArrowRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyArrow[1]);
      const params = propertyArrow[2] || propertyArrow[3] || '';
      const valueStart = objectBodyStart + propertyArrowRe.lastIndex;
      if (text[valueStart] === '{') {
        const arrowSpan = extractBlockSpan(text, valueStart);
        if (property && bodyReturnsRouteUrl(arrowSpan.body, params)) addFactoryAlias(`${baseName}.${property}`, objectIndex);
        propertyArrowRe.lastIndex = Math.max(propertyArrowRe.lastIndex, arrowSpan.end - objectBodyStart);
      } else {
        const expression = extractAssignmentExpression(text, valueStart);
        if (property && expressionReturnsRouteUrl(expression, params)) addFactoryAlias(`${baseName}.${property}`, objectIndex);
        propertyArrowRe.lastIndex += expression.length;
      }
      propertyArrow = propertyArrowRe.exec(objectBody);
    }
    const propertyObjectRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*\\{`, 'g');
    let propertyObject = propertyObjectRe.exec(objectBody);
    while (propertyObject) {
      if (!memberIsScannable(propertyObject.index)) {
        propertyObject = propertyObjectRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyObject[1]);
      const nestedOpenBrace = text.indexOf('{', objectBodyStart + propertyObject.index);
      if (!property || nestedOpenBrace < 0) {
        propertyObject = propertyObjectRe.exec(objectBody);
        continue;
      }
      const nestedSpan = extractBlockSpan(text, nestedOpenBrace);
      scanObjectRouteFactoryMembers(`${baseName}.${property}`, nestedSpan.body, nestedOpenBrace + 1, objectIndex);
      propertyObjectRe.lastIndex = Math.max(propertyObjectRe.lastIndex, nestedSpan.end - objectBodyStart);
      propertyObject = propertyObjectRe.exec(objectBody);
    }
  };
  const defaultExportedIdentifierNames = (() => {
    const names = new Set();
    const defaultIdentifierRe = new RegExp(`\\bexport\\s+default\\s*(?:\\(\\s*)*(${IDENTIFIER_PATTERN.source})(?:\\s*\\))*\\s*;?`, 'g');
    let defaultIdentifier = defaultIdentifierRe.exec(scan);
    while (defaultIdentifier) {
      names.add(defaultIdentifier[1]);
      defaultIdentifier = defaultIdentifierRe.exec(scan);
    }
    const localDefaultExportRe = /\bexport\s*\{([\s\S]*?)\}/g;
    let localDefaultExport = localDefaultExportRe.exec(scan);
    while (localDefaultExport) {
      const after = scan.slice(localDefaultExportRe.lastIndex);
      if (/^\s*from\b/.test(after)) {
        localDefaultExport = localDefaultExportRe.exec(scan);
        continue;
      }
      (localDefaultExport[1] || '').split(',').forEach((part) => {
        const spec = part.trim();
        const alias = spec.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (alias && alias[2] === 'default') names.add(alias[1]);
      });
      localDefaultExport = localDefaultExportRe.exec(scan);
    }
    return names;
  })();
  const objectLiteralRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*\\{`, 'g');
  match = objectLiteralRe.exec(scan);
  while (match) {
    const objectName = match[1];
    const objectSpan = extractBlockSpan(text, objectLiteralRe.lastIndex - 1);
    scanObjectRouteFactoryMembers(objectName, objectSpan.body, objectLiteralRe.lastIndex, match.index);
    if (defaultExportedIdentifierNames.has(objectName)) {
      scanObjectRouteFactoryMembers('this', objectSpan.body, objectLiteralRe.lastIndex, match.index);
    }
    if (objectSpan.end > objectLiteralRe.lastIndex) objectLiteralRe.lastIndex = objectSpan.end;
    match = objectLiteralRe.exec(scan);
  }
  const defaultObjectRe = /\bexport\s+default\s*(?:\(\s*)*\{/g;
  match = defaultObjectRe.exec(scan);
  while (match) {
    const objectSpan = extractBlockSpan(text, defaultObjectRe.lastIndex - 1);
    scanObjectRouteFactoryMembers('this', objectSpan.body, defaultObjectRe.lastIndex, match.index);
    if (objectSpan.end > defaultObjectRe.lastIndex) defaultObjectRe.lastIndex = objectSpan.end;
    match = defaultObjectRe.exec(scan);
  }
  const defaultParenthesizedFunctionRe = new RegExp(`\\bexport\\s+default\\s*(?:\\(\\s*)+(?:async\\s+)?function(?:\\s+${IDENTIFIER_PATTERN.source})?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  match = defaultParenthesizedFunctionRe.exec(scan);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, defaultParenthesizedFunctionRe.lastIndex - 1), match[1])) out.add('default');
    match = defaultParenthesizedFunctionRe.exec(scan);
  }
  const defaultFunctionRe = new RegExp(`\\bexport\\s+default\\s+(?:async\\s+)?function(?:\\s+${IDENTIFIER_PATTERN.source})?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  match = defaultFunctionRe.exec(scan);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, defaultFunctionRe.lastIndex - 1), match[1])) out.add('default');
    match = defaultFunctionRe.exec(scan);
  }
  const defaultParenthesizedArrowBlockRe = new RegExp(`\\bexport\\s+default\\s*(?:\\(\\s*)+(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENTIFIER_PATTERN.source}))\\s*=>\\s*\\{`, 'g');
  match = defaultParenthesizedArrowBlockRe.exec(scan);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, defaultParenthesizedArrowBlockRe.lastIndex - 1), match[1] || match[2] || '')) out.add('default');
    match = defaultParenthesizedArrowBlockRe.exec(scan);
  }
  const defaultArrowBlockRe = new RegExp(`\\bexport\\s+default\\s+(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENTIFIER_PATTERN.source}))\\s*=>\\s*\\{`, 'g');
  match = defaultArrowBlockRe.exec(scan);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, defaultArrowBlockRe.lastIndex - 1), match[1] || match[2] || '')) out.add('default');
    match = defaultArrowBlockRe.exec(scan);
  }
  const defaultParenthesizedArrowExpressionRe = new RegExp(`\\bexport\\s+default\\s*(?:\\(\\s*)+(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENTIFIER_PATTERN.source}))\\s*=>\\s*`, 'g');
  match = defaultParenthesizedArrowExpressionRe.exec(scan);
  while (match) {
    if (scan[defaultParenthesizedArrowExpressionRe.lastIndex] !== '{') {
      const expression = extractAssignmentExpression(text, defaultParenthesizedArrowExpressionRe.lastIndex);
      if (expressionReturnsRouteUrl(expression, match[1] || match[2] || '')) out.add('default');
      defaultParenthesizedArrowExpressionRe.lastIndex += expression.length;
    }
    match = defaultParenthesizedArrowExpressionRe.exec(scan);
  }
  const defaultArrowExpressionRe = new RegExp(`\\bexport\\s+default\\s+(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENTIFIER_PATTERN.source}))\\s*=>\\s*`, 'g');
  match = defaultArrowExpressionRe.exec(scan);
  while (match) {
    if (scan[defaultArrowExpressionRe.lastIndex] !== '{') {
      const expression = extractAssignmentExpression(text, defaultArrowExpressionRe.lastIndex);
      if (expressionReturnsRouteUrl(expression, match[1] || match[2] || '')) out.add('default');
      defaultArrowExpressionRe.lastIndex += expression.length;
    }
    match = defaultArrowExpressionRe.exec(scan);
  }
  const defaultIdentifierRe = new RegExp(`\\bexport\\s+default\\s*(?:\\(\\s*)*(${IDENTIFIER_PATTERN.source})(?:\\s*\\))*\\s*;?`, 'g');
  match = defaultIdentifierRe.exec(scan);
  while (match) {
    if (out.has(match[1])) out.add('default');
    match = defaultIdentifierRe.exec(scan);
  }
  const localDefaultExportRe = /\bexport\s*\{([\s\S]*?)\}/g;
  match = localDefaultExportRe.exec(scan);
  while (match) {
    const after = scan.slice(localDefaultExportRe.lastIndex);
    if (/^\s*from\b/.test(after)) {
      match = localDefaultExportRe.exec(scan);
      continue;
    }
    (match[1] || '').split(',').forEach((part) => {
      const spec = part.trim();
      const alias = spec.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (alias && alias[2] === 'default' && out.has(alias[1])) out.add('default');
    });
    match = localDefaultExportRe.exec(scan);
  }
  return out;
}

function containsForbiddenScopedRouteUrlFactoryMutation(source, aliases, externalAliases, staticRelativeAliases) {
  const text = String(source || '');
  const scan = maskNonCodeForRouteGuard(text);
  const constructorPattern = urlConstructorPattern(collectUrlConstructorAliases(text));
  const containingBlockSpan = (index) => {
    const stack = blockStackAt(text, index);
    const open = stack.length ? stack[stack.length - 1] : -1;
    if (open < 0) return { start: 0, end: text.length };
    const span = extractBlockSpan(text, open);
    return { start: open + 1, end: Math.max(open + 1, span.end - 1) };
  };
  const containingFunctionSpan = (index) => {
    const stack = blockStackAt(text, index);
    const controlBlockNames = new Set(['catch', 'for', 'if', 'switch', 'while', 'with']);
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const open = stack[i];
      const before = text.slice(Math.max(0, open - 160), open);
      const methodBlock = before.match(/(?:^|[,{]\s*)(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*$/);
      if (/\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\([^)]*\)\s*$/.test(before)
        || /=>\s*$/.test(before)
        || (methodBlock && !controlBlockNames.has(methodBlock[1]))) {
        const span = extractBlockSpan(text, open);
        return { start: open + 1, end: Math.max(open + 1, span.end - 1) };
      }
    }
    return { start: 0, end: text.length };
  };
  const scopedUrlAliases = (body, paramsText = '', offset = null) => {
    const scopedExternalAliases = new Set(externalAliases);
    const scopedStaticRelativeAliases = new Set(staticRelativeAliases);
    const bindings = new Set();
    addBindingNamesFromPattern(bindings, paramsText);
    if (offset == null) addLocalDeclarationBindings(bindings, body, { topLevelOnly: true });
    else addVisibleLocalDeclarationBindings(bindings, body, offset);
    bindings.forEach((name) => {
      scopedExternalAliases.delete(name);
      scopedStaticRelativeAliases.delete(name);
    });
    return { scopedExternalAliases, scopedStaticRelativeAliases };
  };
  const bodyReturnsRouteUrl = (body, paramsText = '') => {
    const nestedFunctionRanges = collectNestedFunctionBodyRanges(body);
    const routeUrlVariables = new Map();
    const variableRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
    let variable = variableRe.exec(body);
    while (variable) {
      if (indexIsInsideRange(variable.index, nestedFunctionRanges)) {
        variable = variableRe.exec(body);
        continue;
      }
      const { scopedExternalAliases, scopedStaticRelativeAliases } = scopedUrlAliases(body, paramsText, variable.index);
      const parsed = extractCallArgs(body, variableRe.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, scopedExternalAliases, scopedStaticRelativeAliases)) {
        routeUrlVariables.set(variable[2], { kind: variable[1], end: parsed.end });
      }
      if (parsed.end > variableRe.lastIndex) variableRe.lastIndex = parsed.end;
      variable = variableRe.exec(body);
    }
    const returnedAliasRe = new RegExp(`\\breturn\\s+(?:\\(\\s*)*(${IDENTIFIER_PATTERN.source})(?:\\s*\\))*\\s*;?`, 'g');
    let returnedAlias = returnedAliasRe.exec(body);
    while (returnedAlias) {
      if (indexIsInsideRange(returnedAlias.index, nestedFunctionRanges)) {
        returnedAlias = returnedAliasRe.exec(body);
        continue;
      }
      const routeUrlVariable = routeUrlVariables.get(returnedAlias[1]);
      if (routeUrlVariable
        && (routeUrlVariable.kind === 'const'
          || !bindingIsReassigned(body.slice(0, returnedAlias.index), returnedAlias[1], routeUrlVariable.end))) {
        return true;
      }
      returnedAlias = returnedAliasRe.exec(body);
    }
    const re = new RegExp(`\\breturn\\s+(?:\\(\\s*)*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
    let match = re.exec(body);
    while (match) {
      if (indexIsInsideRange(match.index, nestedFunctionRanges)) {
        match = re.exec(body);
        continue;
      }
      const { scopedExternalAliases, scopedStaticRelativeAliases } = scopedUrlAliases(body, paramsText, match.index);
      const parsed = extractCallArgs(body, re.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, scopedExternalAliases, scopedStaticRelativeAliases)) return true;
      if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
      match = re.exec(body);
    }
    return false;
  };
  const expressionReturnsRouteUrl = (expression, paramsText = '') => {
    const { scopedExternalAliases, scopedStaticRelativeAliases } = scopedUrlAliases('', paramsText);
    const value = stripWrappingParentheses(expression);
    const match = value.match(new RegExp(`^new\\s+(?:${constructorPattern})\\s*\\(`));
    if (!match) return false;
    const parsed = extractCallArgs(value, match[0].length);
    return !urlConstructorArgsAreExternal(parsed.args, scopedExternalAliases, scopedStaticRelativeAliases);
  };
  const factories = [];
  const addFactory = (name, index, body, paramsText = '', scopeKind = 'block') => {
    if (braceDepthAt(text, index) === 0) return;
    if (bodyReturnsRouteUrl(body, paramsText)) {
      factories.push({ name, scope: scopeKind === 'function' ? containingFunctionSpan(index) : containingBlockSpan(index) });
    }
  };
  const addExpressionFactory = (name, index, expression, paramsText = '', scopeKind = 'block') => {
    if (braceDepthAt(text, index) === 0) return;
    if (expressionReturnsRouteUrl(expression, paramsText)) {
      factories.push({ name, scope: scopeKind === 'function' ? containingFunctionSpan(index) : containingBlockSpan(index) });
    }
  };
  const functionRe = new RegExp(`\\b(?:async\\s+)?function\\s+(${IDENTIFIER_PATTERN.source})\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  let match = functionRe.exec(scan);
  while (match) {
    addFactory(match[1], match.index, extractBlockText(text, functionRe.lastIndex - 1), match[2]);
    match = functionRe.exec(scan);
  }
  const functionExpressionRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
  match = functionExpressionRe.exec(scan);
  while (match) {
    addFactory(match[2], match.index, extractBlockText(text, functionExpressionRe.lastIndex - 1), match[3], match[1] === 'var' ? 'function' : 'block');
    match = functionExpressionRe.exec(scan);
  }
  const arrowBlockRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>\\s*\\{`, 'g');
  match = arrowBlockRe.exec(scan);
  while (match) {
    addFactory(match[2], match.index, extractBlockText(text, arrowBlockRe.lastIndex - 1), match[3], match[1] === 'var' ? 'function' : 'block');
    match = arrowBlockRe.exec(scan);
  }
  const singleArrowBlockRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?(${IDENTIFIER_PATTERN.source})\\s*=>\\s*\\{`, 'g');
  match = singleArrowBlockRe.exec(scan);
  while (match) {
    addFactory(match[2], match.index, extractBlockText(text, singleArrowBlockRe.lastIndex - 1), match[3], match[1] === 'var' ? 'function' : 'block');
    match = singleArrowBlockRe.exec(scan);
  }
  const arrowExpressionRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\(([^)]*)\\)\\s*=>\\s*`, 'g');
  match = arrowExpressionRe.exec(scan);
  while (match) {
    const expression = extractAssignmentExpression(text, arrowExpressionRe.lastIndex);
    addExpressionFactory(match[2], match.index, expression, match[3], match[1] === 'var' ? 'function' : 'block');
    arrowExpressionRe.lastIndex += expression.length;
    match = arrowExpressionRe.exec(scan);
  }
  const singleArrowExpressionRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?(${IDENTIFIER_PATTERN.source})\\s*=>\\s*`, 'g');
  match = singleArrowExpressionRe.exec(scan);
  while (match) {
    const expression = extractAssignmentExpression(text, singleArrowExpressionRe.lastIndex);
    addExpressionFactory(match[2], match.index, expression, match[3], match[1] === 'var' ? 'function' : 'block');
    singleArrowExpressionRe.lastIndex += expression.length;
    match = singleArrowExpressionRe.exec(scan);
  }
  const scanObjectRouteFactoryMembers = (baseName, objectBody, objectBodyStart, objectIndex) => {
    const objectBodyScan = maskNonCodeForRouteGuard(objectBody);
    const memberIsTopLevel = (index) => braceDepthAt(objectBody, index) === 0;
    const memberIsScannable = (index) => (
      (index === 0 || objectBodyScan[index] === ',')
      && memberIsTopLevel(index)
    );
    const methodRe = new RegExp(`(?:^|[,\\{])\\s*(?:async\\s+)?(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
    let method = methodRe.exec(objectBody);
    while (method) {
      if (!memberIsScannable(method.index)) {
        method = methodRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(method[1]);
      const methodOpenBrace = objectBodyStart + methodRe.lastIndex - 1;
      const methodSpan = extractBlockSpan(text, methodOpenBrace);
      if (property) addFactory(`${baseName}.${property}`, objectIndex, methodSpan.body, method[2]);
      methodRe.lastIndex = Math.max(methodRe.lastIndex, methodSpan.end - objectBodyStart);
      method = methodRe.exec(objectBody);
    }
    const propertyFunctionRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
    let propertyFunction = propertyFunctionRe.exec(objectBody);
    while (propertyFunction) {
      if (!memberIsScannable(propertyFunction.index)) {
        propertyFunction = propertyFunctionRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyFunction[1]);
      const functionOpenBrace = objectBodyStart + propertyFunctionRe.lastIndex - 1;
      const functionSpan = extractBlockSpan(text, functionOpenBrace);
      if (property) addFactory(`${baseName}.${property}`, objectIndex, functionSpan.body, propertyFunction[2]);
      propertyFunctionRe.lastIndex = Math.max(propertyFunctionRe.lastIndex, functionSpan.end - objectBodyStart);
      propertyFunction = propertyFunctionRe.exec(objectBody);
    }
    const propertyArrowRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENTIFIER_PATTERN.source}))\\s*=>\\s*`, 'g');
    let propertyArrow = propertyArrowRe.exec(objectBody);
    while (propertyArrow) {
      if (!memberIsScannable(propertyArrow.index)) {
        propertyArrow = propertyArrowRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyArrow[1]);
      const params = propertyArrow[2] || propertyArrow[3] || '';
      const valueStart = objectBodyStart + propertyArrowRe.lastIndex;
      if (text[valueStart] === '{') {
        const arrowSpan = extractBlockSpan(text, valueStart);
        if (property) addFactory(`${baseName}.${property}`, objectIndex, arrowSpan.body, params);
        propertyArrowRe.lastIndex = Math.max(propertyArrowRe.lastIndex, arrowSpan.end - objectBodyStart);
      } else {
        const expression = extractAssignmentExpression(text, valueStart);
        if (property) addExpressionFactory(`${baseName}.${property}`, objectIndex, expression, params);
        propertyArrowRe.lastIndex += expression.length;
      }
      propertyArrow = propertyArrowRe.exec(objectBody);
    }
    const propertyObjectRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*\\{`, 'g');
    let propertyObject = propertyObjectRe.exec(objectBody);
    while (propertyObject) {
      if (!memberIsScannable(propertyObject.index)) {
        propertyObject = propertyObjectRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyObject[1]);
      const nestedOpenBrace = text.indexOf('{', objectBodyStart + propertyObject.index);
      if (!property || nestedOpenBrace < 0) {
        propertyObject = propertyObjectRe.exec(objectBody);
        continue;
      }
      const nestedSpan = extractBlockSpan(text, nestedOpenBrace);
      scanObjectRouteFactoryMembers(`${baseName}.${property}`, nestedSpan.body, nestedOpenBrace + 1, objectIndex);
      propertyObjectRe.lastIndex = Math.max(propertyObjectRe.lastIndex, nestedSpan.end - objectBodyStart);
      propertyObject = propertyObjectRe.exec(objectBody);
    }
  };
  const objectLiteralRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*\\{`, 'g');
  match = objectLiteralRe.exec(scan);
  while (match) {
    const objectSpan = extractBlockSpan(text, objectLiteralRe.lastIndex - 1);
    scanObjectRouteFactoryMembers(match[1], objectSpan.body, objectLiteralRe.lastIndex, match.index);
    if (objectSpan.end > objectLiteralRe.lastIndex) objectLiteralRe.lastIndex = objectSpan.end;
    match = objectLiteralRe.exec(scan);
  }
  const seenFactoryScopes = new Set(factories.map((factory) => `${factory.scope.start}:${factory.scope.end}:${factory.name}`));
  for (let i = 0; i < factories.length; i += 1) {
    const { name, scope } = factories[i];
    const scopedText = text.slice(scope.start, scope.end);
    const aliasIsShadowed = (factory, scopedIndex) => referenceIsShadowedInScope(text, factory, scope, scopedIndex);
    for (const alias of expandRouteUrlFactoryAliases(scopedText, new Set([name]), { isReferenceShadowed: aliasIsShadowed })) {
      const key = `${scope.start}:${scope.end}:${alias}`;
      if (!seenFactoryScopes.has(key)) {
        seenFactoryScopes.add(key);
        factories.push({ name: alias, scope });
      }
    }
  }
  for (const { name, scope } of factories) {
    const scopedText = text.slice(scope.start, scope.end);
    const callIsShadowed = (scopedCallIndex) => {
      return referenceIsShadowedInScope(text, name, scope, scopedCallIndex);
    };
    const callableNamePattern = `(?:\\(\\s*)*${expressionReferencePatternForSource(name, scopedText)}\\s*(?:\\))*`;
    const callStartPattern = functionInvocationStartPattern(callableNamePattern);
    const parenthesizedCallStartPattern = `(?:\\(\\s*)*${callStartPattern}`;
    const vars = new Set();
    [
      new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:await\\s+)?${parenthesizedCallStartPattern}`, 'g'),
      new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:await\\s+)?${parenthesizedCallStartPattern}`, 'g'),
      new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_WITH_STATIC_KEYS_PATTERN_SOURCE})\\s*=\\s*(?:await\\s+)?${parenthesizedCallStartPattern}`, 'g')
    ].forEach((re) => {
      let assigned = re.exec(scopedText);
      while (assigned) {
        const parsed = extractCallArgs(scopedText, re.lastIndex);
        if (!callIsShadowed(assigned.index)) vars.add(normalizeStaticMemberExpression(assigned[1]));
        if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
        assigned = re.exec(scopedText);
      }
    });
    for (const variable of vars) {
      if (containsRouteKeyWriteForOwner(scopedText, variable, aliases, 'searchParams')) return true;
      if (containsForbiddenSearchAssignment(scopedText, searchWritePatternForOwner(variable, scopedText), aliases)) return true;
      const paramsAliases = collectSearchParamsAliasesForRouteUrl(scopedText, variable);
      for (const paramsAlias of paramsAliases) {
        if (containsRouteKeyWriteForOwner(scopedText, paramsAlias, aliases)) return true;
      }
    }
    const searchParamsAccess = propertyAccessorPattern('searchParams', collectStaticStringAliases(scopedText, 'searchParams'));
    const mutator = `(?:${propertyAccessorPattern('set')}|${propertyAccessorPattern('append')}|${propertyAccessorPattern('delete')})`;
    const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
    const searchAccess = propertyAccessorPattern('search', collectStaticStringAliases(scopedText, 'search'));
    const directSearchConstructorAliases = collectUrlSearchParamsConstructorAliases(scopedText);
    const directSearchQueryAliases = collectRouteQueryAliases(scopedText, aliases, directSearchConstructorAliases);
    const factoryParamsAliases = new Set();
    const collectFactoryParamsAlias = (re) => {
      let alias = re.exec(scopedText);
      while (alias) {
        const parsed = extractCallArgs(scopedText, re.lastIndex);
        const suffix = scopedText.slice(parsed.end).match(new RegExp(`^\\s*(?:\\))*${searchParamsAccess}`));
        if (!callIsShadowed(alias.index) && suffix) factoryParamsAliases.add(alias[1]);
        if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
        alias = re.exec(scopedText);
      }
    };
    collectFactoryParamsAlias(new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:await\\s+)?${parenthesizedCallStartPattern}`, 'g'));
    collectFactoryParamsAlias(new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:await\\s+)?${parenthesizedCallStartPattern}`, 'g'));
    const destructuredParamsRe = new RegExp(`\\b(?:const|let|var)\\s*\\{([\\s\\S]*?)\\}\\s*=\\s*(?:await\\s+)?${parenthesizedCallStartPattern}`, 'g');
    let destructuredParams = destructuredParamsRe.exec(scopedText);
    while (destructuredParams) {
      const parsed = extractCallArgs(scopedText, destructuredParamsRe.lastIndex);
      if (!callIsShadowed(destructuredParams.index)) {
        const body = destructuredParams[1] || '';
        for (const alias of collectDestructuredStaticPropertyAliases(body, 'searchParams')) {
          factoryParamsAliases.add(alias);
        }
      }
      if (parsed.end > destructuredParamsRe.lastIndex) destructuredParamsRe.lastIndex = parsed.end;
      destructuredParams = destructuredParamsRe.exec(scopedText);
    }
    for (const paramsAlias of factoryParamsAliases) {
      if (containsRouteKeyWriteForOwner(scopedText, paramsAlias, aliases)) return true;
    }
    const scanFactoryCallSuffix = (callIndex, callEnd) => {
      if (callIsShadowed(callIndex)) return false;
      const suffixText = scopedText.slice(callEnd);
      const directParams = suffixText.match(new RegExp(`^\\s*(?:\\))*${searchParamsAccess}${mutator}\\s*(?:\\?\\.\\s*)?\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*(?:,|\\))`));
      if (directParams && sourceArgIsRouteKey(directParams[1], aliases)) return true;
      const dispatch = suffixText.match(new RegExp(`^\\s*(?:\\))*${searchParamsAccess}${mutator}(?:\\s*(?:\\?\\.\\s*|\\.\\s*)(call|apply)|\\s*\\?\\.\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\]|\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\])\\s*(?:\\?\\.\\s*)?\\(`));
      if (dispatch) {
        const method = dispatch[1] || dispatch[2] || dispatch[3];
        const parsed = extractCallArgs(suffixText, dispatch[0].length);
        const parts = splitTopLevelArgs(parsed.args);
        const applyArgs = method === 'apply' ? splitTopLevelArgs((parts[1] || '').trim().replace(/^\[\s*|\s*\]$/g, '')) : [];
        const routeKeyArg = method === 'apply' ? applyArgs[0] : parts[1];
        if (sourceArgIsRouteKey(routeKeyArg || '', aliases)) return true;
      }
      const searchAssignment = suffixText.match(new RegExp(`^\\s*(?:\\))*${searchAccess}\\s*(?:\\+=|=(?!=|>))`));
      if (searchAssignment) {
        const expression = extractAssignmentExpression(scopedText, callEnd + searchAssignment[0].length);
        if (expressionBuildsRouteQuery(expression, aliases, directSearchQueryAliases, directSearchConstructorAliases)) return true;
      }
      return false;
    };
    const directCallRe = new RegExp(`(?:^|[^\\w$.])${callStartPattern}`, 'g');
    let directCall = directCallRe.exec(scopedText);
    while (directCall) {
      const parsed = extractCallArgs(scopedText, directCallRe.lastIndex);
      if (!hasMemberAccessPrefix(scopedText, directCall.index) && scanFactoryCallSuffix(directCall.index, parsed.end)) {
        return true;
      }
      if (parsed.end > directCallRe.lastIndex) directCallRe.lastIndex = parsed.end;
      directCall = directCallRe.exec(scopedText);
    }
  }
  return false;
}

function collectRouteUrlVariables(
  source,
  externalAliases = collectExternalUrlAliases(source),
  staticRelativeAliases = collectStaticRelativeUrlAliases(source),
  routeUrlFactoryAliases = null
) {
  const text = String(source || '');
  const out = new Set();
  const fullScope = { start: 0, end: text.length };
  const baseFactories = routeUrlFactoryAliases || collectRouteUrlFactoryAliases(text, externalAliases, staticRelativeAliases);
  const factories = expandRouteUrlFactoryAliases(
    text,
    baseFactories,
    { isReferenceShadowed: (factory, index) => referenceIsShadowedInScope(text, factory, fullScope, index) }
  );
  const baseFactorySet = new Set(baseFactories);
  const constructorPattern = urlConstructorPattern(collectUrlConstructorAliases(text));
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_WITH_STATIC_KEYS_PATTERN_SOURCE})\\s*=\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const parsed = extractCallArgs(text, re.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases)) out.add(normalizeStaticMemberExpression(match[1]));
      if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
      match = re.exec(text);
    }
  });
  if (factories.size) {
    for (const factory of factories) {
      const factoryCallPattern = functionInvocationStartPattern(expressionReferencePatternForSource(factory, text));
      [
        new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:await\\s+)?${factoryCallPattern}`, 'g'),
        new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:await\\s+)?${factoryCallPattern}`, 'g'),
        new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_WITH_STATIC_KEYS_PATTERN_SOURCE})\\s*=\\s*(?:await\\s+)?${factoryCallPattern}`, 'g')
      ].forEach((re) => {
        let match = re.exec(text);
        while (match) {
          const parsed = extractCallArgs(text, re.lastIndex);
          if (!referenceIsShadowedInScope(text, factory, fullScope, match.index)) {
            out.add(normalizeStaticMemberExpression(match[1]));
          }
          if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
          match = re.exec(text);
        }
      });
    }
  }
  return out;
}

function collectLocationAliases(source) {
  const text = String(source || '');
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
  return searchWritePatternForOwnerPattern(ownerPattern);
}

function searchWritePatternForOwnerPattern(ownerPattern, propertyAliases = new Set()) {
  const searchProperty = propertyAccessorPattern('search', propertyAliases);
  return new RegExp(`${ownerPattern}\\s*${searchProperty}\\s*(?:\\+=|=(?!=|>))`, 'g');
}

function searchWritePatternForOwner(owner, source = '') {
  return searchWritePatternForOwnerPattern(
    expressionReferencePattern(owner),
    collectStaticStringAliases(source, 'search')
  );
}

function containsForbiddenRouteUrlMutation(source, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases = null) {
  const text = String(source || '');
  const vars = collectRouteUrlVariables(text, externalAliases, staticRelativeAliases, routeUrlFactoryAliases);
  for (const name of vars) {
    if (containsRouteKeyWriteForOwner(text, name, aliases, 'searchParams')) return true;
    if (containsForbiddenSearchAssignment(text, searchWritePatternForOwner(name, text), aliases)) return true;
    const paramsAliases = collectSearchParamsAliasesForRouteUrl(text, name);
    for (const paramsAlias of paramsAliases) {
      if (containsRouteKeyWriteForOwner(text, paramsAlias, aliases)) return true;
    }
  }
  return false;
}

function containsForbiddenInlineRouteUrlCallbackMutation(source, aliases, externalAliases, staticRelativeAliases) {
  const text = String(source || '');
  const scan = maskNonCodeForRouteGuard(text);
  const constructorPattern = urlConstructorPattern(collectUrlConstructorAliases(text));
  const callbackMutatesRouteUrl = (body, owner) => {
    if (containsRouteKeyWriteForOwner(body, owner, aliases, 'searchParams')) return true;
    if (containsForbiddenSearchAssignment(body, searchWritePatternForOwner(owner, body), aliases)) return true;
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
    let value = String(expression || '').trim();
    while (value.startsWith('(')) {
      const parsed = extractCallArgs(value, 1);
      if (value.slice(parsed.end).trim()) break;
      value = parsed.args.trim();
    }
    const match = value.match(new RegExp(`^new\\s+(?:${constructorPattern})\\s*\\(`));
    if (!match) return false;
    const parsed = extractCallArgs(value, match[0].length);
    return !urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases);
  };
  const callbackOwnerIndexes = (paramsText, body) => {
    const out = [];
    splitTopLevelArgs(paramsText).forEach((param, ownerIndex) => {
      const simple = String(param || '').trim().match(/^([A-Za-z_$][\w$]*)$/);
      if (simple && callbackMutatesRouteUrl(body, simple[1])) out.push(ownerIndex);
    });
    return out;
  };
  const callbackInvocationArgs = (method, argsText) => {
    const parts = splitTopLevelArgs(argsText);
    if (method === 'direct') return parts;
    if (method === 'call') return parts.slice(1);
    const arrayArg = String(parts[1] || '').trim();
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
    const rootName = String(name || '').split(/\s*\.\s*/).filter(Boolean)[0] || '';
    if (!rootName) return false;
    const before = text.slice(scope.start, globalCallIndex);
    const scopeStack = blockStackAt(text, scope.start);
    const callStack = blockStackAt(text, globalCallIndex);
    const stackIsCallAncestor = (stack) => (
      stack.length > scopeStack.length
      && stack.length <= callStack.length
      && stack.every((open, index) => callStack[index] === open)
    );
    const shadowRe = new RegExp(`\\b(?:const|let|var|function)\\s+${escapeRe(rootName)}\\b`, 'g');
    let shadow = shadowRe.exec(before);
    while (shadow) {
      if (stackIsCallAncestor(blockStackAt(text, scope.start + shadow.index))) return true;
      shadow = shadowRe.exec(before);
    }
    return false;
  };
  const callbackCallSuffix = new RegExp(`^\\s*\\)\\s*(?:(?:\\?\\.\\s*)?\\(|(?:\\?\\.\\s*)?\\.\\s*(call|apply)\\s*(?:\\?\\.\\s*)?\\(|\\?\\.\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\]\\s*(?:\\?\\.\\s*)?\\(|\\[\\s*["'\`](call|apply)["'\`]\\s*\\]\\s*(?:\\?\\.\\s*)?\\()`);
  const re = new RegExp(`\\(\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*\\(([\\s\\S]*?)\\)\\s*\\)\\s*\\(\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
  let match = re.exec(text);
  while (match) {
    const parsed = argsAreRelative(re.lastIndex);
    if (parsed.relative && callbackMutatesRouteUrl(match[2] || '', match[1])) {
      return true;
    }
    if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
    match = re.exec(text);
  }
  const callRe = new RegExp(`\\(\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*\\(([\\s\\S]*?)\\)\\s*\\)\\s*\\.\\s*call\\s*\\(\\s*[\\s\\S]*?,\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
  match = callRe.exec(text);
  while (match) {
    const parsed = argsAreRelative(callRe.lastIndex);
    if (parsed.relative && callbackMutatesRouteUrl(match[2] || '', match[1])) return true;
    if (parsed.end > callRe.lastIndex) callRe.lastIndex = parsed.end;
    match = callRe.exec(text);
  }
  const applyRe = new RegExp(`\\(\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*\\(([\\s\\S]*?)\\)\\s*\\)\\s*\\.\\s*apply\\s*\\(\\s*[\\s\\S]*?,\\s*\\[\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
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
  const mutatorKeys = new Set();
  const addMutatorAlias = (name, scope, ownerIndex = 0) => {
    const normalizedScope = scope || { start: 0, end: text.length };
    const key = `${normalizedScope.start}:${normalizedScope.end}:${ownerIndex}:${name}`;
    if (mutatorKeys.has(key)) return;
    mutatorKeys.add(key);
    mutators.push({ name, scope: normalizedScope, ownerIndex });
  };
  const addMutator = (name, owner, body, index, scope = null, ownerIndex = 0) => {
    if (!callbackMutatesRouteUrl(body, owner)) return;
    addMutatorAlias(name, scope || containingBlockSpan(index), ownerIndex);
  };
  const addMutatorsForParams = (name, paramsText, body, index, scope = null) => {
    splitTopLevelArgs(paramsText).forEach((param, ownerIndex) => {
      const simple = String(param || '').trim().match(/^([A-Za-z_$][\w$]*)$/);
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
  const scanObjectMutatorMembers = (baseName, objectBody, objectBodyStart, objectIndex, objectScope) => {
    const objectBodyScan = maskNonCodeForRouteGuard(objectBody);
    const memberIsTopLevel = (index) => braceDepthAt(objectBody, index) === 0;
    const memberIsScannable = (index) => (
      (index === 0 || objectBodyScan[index] === ',')
      && memberIsTopLevel(index)
    );
    const methodRe = new RegExp(`(?:^|[,\\{])\\s*(?:async\\s+)?(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
    let method = methodRe.exec(objectBody);
    while (method) {
      if (!memberIsScannable(method.index)) {
        method = methodRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(method[1]);
      const methodOpenBrace = objectBodyStart + methodRe.lastIndex - 1;
      const methodSpan = extractBlockSpan(text, methodOpenBrace);
      if (property) addMutatorsForParams(`${baseName}.${property}`, method[2], methodSpan.body, objectIndex, objectScope);
      methodRe.lastIndex = Math.max(methodRe.lastIndex, methodSpan.end - objectBodyStart);
      method = methodRe.exec(objectBody);
    }
    const propertyFunctionRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(([^)]*)\\)\\s*\\{`, 'g');
    let propertyFunction = propertyFunctionRe.exec(objectBody);
    while (propertyFunction) {
      if (!memberIsScannable(propertyFunction.index)) {
        propertyFunction = propertyFunctionRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyFunction[1]);
      const functionOpenBrace = objectBodyStart + propertyFunctionRe.lastIndex - 1;
      const functionSpan = extractBlockSpan(text, functionOpenBrace);
      if (property) addMutatorsForParams(`${baseName}.${property}`, propertyFunction[2], functionSpan.body, objectIndex, objectScope);
      propertyFunctionRe.lastIndex = Math.max(propertyFunctionRe.lastIndex, functionSpan.end - objectBodyStart);
      propertyFunction = propertyFunctionRe.exec(objectBody);
    }
    const propertyArrowRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*(?:async\\s*)?(?:\\(([^)]*)\\)|(${IDENTIFIER_PATTERN.source}))\\s*=>\\s*`, 'g');
    let propertyArrow = propertyArrowRe.exec(objectBody);
    while (propertyArrow) {
      if (!memberIsScannable(propertyArrow.index)) {
        propertyArrow = propertyArrowRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyArrow[1]);
      const params = propertyArrow[2] || propertyArrow[3] || '';
      const valueStart = objectBodyStart + propertyArrowRe.lastIndex;
      if (text[valueStart] === '{') {
        const arrowSpan = extractBlockSpan(text, valueStart);
        if (property) addMutatorsForParams(`${baseName}.${property}`, params, arrowSpan.body, objectIndex, objectScope);
        propertyArrowRe.lastIndex = Math.max(propertyArrowRe.lastIndex, arrowSpan.end - objectBodyStart);
      } else {
        const expression = extractAssignmentExpression(text, valueStart);
        if (property) addMutatorsForParams(`${baseName}.${property}`, params, expression, objectIndex, objectScope);
        propertyArrowRe.lastIndex += expression.length;
      }
      propertyArrow = propertyArrowRe.exec(objectBody);
    }
    const propertyObjectRe = new RegExp(`(?:^|[,\\{])\\s*(${STATIC_OBJECT_PROPERTY_KEY_PATTERN_SOURCE})\\s*:\\s*\\{`, 'g');
    let propertyObject = propertyObjectRe.exec(objectBody);
    while (propertyObject) {
      if (!memberIsScannable(propertyObject.index)) {
        propertyObject = propertyObjectRe.exec(objectBody);
        continue;
      }
      const property = normalizeStaticObjectPropertyKey(propertyObject[1]);
      const nestedOpenBrace = text.indexOf('{', objectBodyStart + propertyObject.index);
      if (!property || nestedOpenBrace < 0) {
        propertyObject = propertyObjectRe.exec(objectBody);
        continue;
      }
      const nestedSpan = extractBlockSpan(text, nestedOpenBrace);
      scanObjectMutatorMembers(
        `${baseName}.${property}`,
        nestedSpan.body,
        nestedOpenBrace + 1,
        objectIndex,
        objectScope
      );
      propertyObjectRe.lastIndex = Math.max(propertyObjectRe.lastIndex, nestedSpan.end - objectBodyStart);
      propertyObject = propertyObjectRe.exec(objectBody);
    }
  };
  const objectLiteralRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*\\{`, 'g');
  match = objectLiteralRe.exec(scan);
  while (match) {
    const objectName = match[1];
    const objectScope = containingBlockSpan(match.index);
    const objectSpan = extractBlockSpan(text, objectLiteralRe.lastIndex - 1);
    const objectBodyStart = objectLiteralRe.lastIndex;
    scanObjectMutatorMembers(objectName, objectSpan.body, objectBodyStart, match.index, objectScope);
    if (objectSpan.end > objectLiteralRe.lastIndex) objectLiteralRe.lastIndex = objectSpan.end;
    match = objectLiteralRe.exec(scan);
  }
  for (let i = 0; i < mutators.length; i += 1) {
    const { name, scope, ownerIndex } = mutators[i];
    const scopedText = text.slice(scope.start, scope.end);
    const scopedScan = maskNonCodeForRouteGuard(scopedText);
    const captureStartsInCode = (match, capture) => {
      const offset = match[0].indexOf(capture);
      const index = offset >= 0 ? match.index + offset : match.index;
      return /\S/.test(scopedScan[index] || '');
    };
    const objectAliasRe = new RegExp(`\\b(const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*\\{`, 'g');
    let objectAlias = objectAliasRe.exec(scopedText);
    while (objectAlias) {
      const kind = objectAlias[1];
      const objectName = objectAlias[2];
      if (!captureStartsInCode(objectAlias, kind)) {
        objectAlias = objectAliasRe.exec(scopedText);
        continue;
      }
      const objectSpan = extractBlockSpan(scopedText, objectAliasRe.lastIndex - 1);
      if (kind === 'const' || !bindingIsReassigned(scopedText, objectName, objectAliasRe.lastIndex)) {
        for (const part of splitTopLevelArgs(objectSpan.body)) {
          const property = objectPropertyNameFromPart(part);
          const value = objectPropertyValueFromPart(part);
          if (property
            && value
            && expressionReferencesRouteFactory(value, new Set([name]))
            && !callIsShadowedInNestedScope(name, scope, objectAlias.index)) {
            addMutatorAlias(`${objectName}.${property}`, containingBlockSpan(scope.start + objectAlias.index), ownerIndex);
          }
        }
      }
      if (objectSpan.end > objectAliasRe.lastIndex) objectAliasRe.lastIndex = objectSpan.end;
      objectAlias = objectAliasRe.exec(scopedText);
    }
    const memberAliasRe = new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_WITH_STATIC_KEYS_PATTERN_SOURCE})\\s*=\\s*(?!=|>)(?:\\(\\s*)*${expressionReferencePatternForSource(name, scopedText)}\\s*(?:\\))*`, 'g');
    let memberAlias = memberAliasRe.exec(scopedText);
    while (memberAlias) {
      if (captureStartsInCode(memberAlias, memberAlias[1]) && !callIsShadowedInNestedScope(name, scope, memberAlias.index)) {
        addMutatorAlias(normalizeStaticMemberExpression(memberAlias[1]), scope, ownerIndex);
      }
      memberAlias = memberAliasRe.exec(scopedText);
    }
    const parts = String(name || '').split('.');
    if (parts.length > 1 && parts.every((part) => new RegExp(`^(?:this|${IDENTIFIER_PATTERN.source})$`).test(part))) {
      const owner = parts.slice(0, -1).join('.');
      const property = parts[parts.length - 1];
      const destructureRe = new RegExp(`\\b(const|let|var)\\s*\\{([\\s\\S]*?)\\}\\s*=\\s*${expressionReferencePattern(owner)}\\b`, 'g');
      let destructure = destructureRe.exec(scopedText);
      while (destructure) {
        const kind = destructure[1];
        if (captureStartsInCode(destructure, kind)) {
          for (const aliasName of collectDestructuredStaticPropertyAliases(destructure[2] || '', property)) {
            if (!callIsShadowedInNestedScope(name, scope, destructure.index)
              && (kind === 'const' || !bindingIsReassigned(scopedText, aliasName, destructureRe.lastIndex))) {
              addMutatorAlias(aliasName, scope, ownerIndex);
            }
          }
        }
        destructure = destructureRe.exec(scopedText);
      }
    }
    const bindRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*${expressionReferencePatternForSource(name, scopedText)}${propertyAccessorPattern('bind')}\\s*(?:\\?\\.\\s*)?\\(`, 'g');
    let bind = bindRe.exec(scopedText);
    while (bind) {
      const parsed = extractCallArgs(scopedText, bindRe.lastIndex);
      const boundArgs = splitTopLevelArgs(parsed.args).slice(1);
      if (captureStartsInCode(bind, bind[1])
        && expressionIsRelativeNewUrl(boundArgs[ownerIndex] || '')
        && !callIsShadowedInNestedScope(name, scope, bind.index)) return true;
      const remainingOwnerIndex = ownerIndex - boundArgs.length;
      if (captureStartsInCode(bind, bind[1]) && remainingOwnerIndex >= 0) addMutatorAlias(bind[1], scope, remainingOwnerIndex);
      if (parsed.end > bindRe.lastIndex) bindRe.lastIndex = parsed.end;
      bind = bindRe.exec(scopedText);
    }
  }
  for (const { name, scope, ownerIndex } of mutators) {
    const scopedText = text.slice(scope.start, scope.end);
    const calleePattern = expressionReferencePatternForSource(name, scopedText);
    const directCallRe = new RegExp(`(^|[^\\w$.])${calleePattern}\\s*(?:\\?\\.\\s*)?\\(`, 'g');
    match = directCallRe.exec(scopedText);
    while (match) {
      const parsed = extractCallArgs(scopedText, directCallRe.lastIndex);
      const parts = splitTopLevelArgs(parsed.args);
      if (expressionIsRelativeNewUrl(parts[ownerIndex] || '')
        && !hasMemberAccessPrefix(scopedText, match.index)
        && !callIsShadowedInNestedScope(name, scope, match.index)) return true;
      if (parsed.end > directCallRe.lastIndex) directCallRe.lastIndex = parsed.end;
      match = directCallRe.exec(scopedText);
    }
    const methodCallRe = new RegExp(`${calleePattern}(?:\\s*(?:\\?\\.\\s*|\\.\\s*)(call|apply)|\\s*\\?\\.\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\]|\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\])\\s*(?:\\?\\.\\s*)?\\(`, 'g');
    match = methodCallRe.exec(scopedText);
    while (match) {
      const method = match[1] || match[2] || match[3];
      const parsed = extractCallArgs(scopedText, methodCallRe.lastIndex);
      const parts = splitTopLevelArgs(parsed.args);
      const applyArgs = method === 'apply' ? splitTopLevelArgs((parts[1] || '').trim().replace(/^\[\s*|\s*\]$/g, '')) : [];
      const relative = method === 'apply'
        ? expressionIsRelativeNewUrl(applyArgs[ownerIndex] || '')
        : expressionIsRelativeNewUrl(parts[ownerIndex + 1] || '');
      if (relative
        && !hasMemberAccessPrefix(scopedText, match.index)
        && !callIsShadowedInNestedScope(name, scope, match.index)) return true;
      if (parsed.end > methodCallRe.lastIndex) methodCallRe.lastIndex = parsed.end;
      match = methodCallRe.exec(scopedText);
    }
  }
  return false;
}

function collectSearchParamsAliasesForRouteUrl(source, owner) {
  const text = String(source || '');
  const out = new Set();
  const ownerPattern = expressionReferencePattern(owner);
  const searchParamsAccess = propertyAccessorPattern('searchParams', collectStaticStringAliases(text, 'searchParams'));
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
    for (const alias of collectDestructuredStaticPropertyAliases(body, 'searchParams')) {
      out.add(alias);
    }
    destructure = destructureRe.exec(text);
  }
  return out;
}

function collectInlineUrlSearchParamsAliases(source) {
  const text = String(source || '');
  const out = new Set();
  const searchParamsAccess = propertyAccessorPattern('searchParams', collectStaticStringAliases(text, 'searchParams'));
  const constructorPattern = urlConstructorPattern(collectUrlConstructorAliases(text));
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+(?:${constructorPattern})\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:\\(\\s*)*new\\s+(?:${constructorPattern})\\s*\\(`, 'g')
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
  const destructureRe = new RegExp(`\\b(?:const|let|var)\\s*\\{([\\s\\S]*?)\\}\\s*=\\s*new\\s+(?:${constructorPattern})\\s*\\(`, 'g');
  let destructure = destructureRe.exec(text);
  while (destructure) {
    const parsed = extractCallArgs(text, destructureRe.lastIndex);
    const body = destructure[1] || '';
    for (const alias of collectDestructuredStaticPropertyAliases(body, 'searchParams')) {
      out.add(alias);
    }
    if (parsed.end > destructureRe.lastIndex) destructureRe.lastIndex = parsed.end;
    destructure = destructureRe.exec(text);
  }
  return out;
}

function containsForbiddenInlineRouteUrlSearchParamsMutation(
  source,
  aliases,
  externalAliases,
  staticRelativeAliases,
  routeUrlFactoryAliases = null
) {
  const text = String(source || '');
  const searchParamsAccess = propertyAccessorPattern('searchParams', collectStaticStringAliases(text, 'searchParams'));
  const searchAccess = propertyAccessorPattern('search', collectStaticStringAliases(text, 'search'));
  const mutator = `(?:${propertyAccessorPattern('set')}|${propertyAccessorPattern('append')}|${propertyAccessorPattern('delete')})`;
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  const constructorAliases = collectUrlSearchParamsConstructorAliases(text);
  const queryAliases = collectRouteQueryAliases(text, aliases, constructorAliases);
  const checkRouteUrlCallSuffix = (callEnd) => {
    const suffixRe = new RegExp(`^\\s*(?:\\))*${searchParamsAccess}${mutator}\\s*(?:\\?\\.\\s*)?\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*(?:,|\\))`);
    const suffix = text.slice(callEnd).match(suffixRe);
    if (suffix && sourceArgIsRouteKey(suffix[1], aliases)) return true;
    const dispatchRe = new RegExp(`^\\s*(?:\\))*${searchParamsAccess}${mutator}(?:\\s*(?:\\?\\.\\s*|\\.\\s*)(call|apply)|\\s*\\?\\.\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\]|\\s*\\[\\s*["'\`](call|apply)["'\`]\\s*\\])\\s*(?:\\?\\.\\s*)?\\(`);
    const dispatch = text.slice(callEnd).match(dispatchRe);
    if (dispatch) {
      const method = dispatch[1] || dispatch[2] || dispatch[3];
      const parsed = extractCallArgs(text, callEnd + dispatch[0].length);
      const parts = splitTopLevelArgs(parsed.args);
      const applyArgs = method === 'apply' ? splitTopLevelArgs((parts[1] || '').trim().replace(/^\[\s*|\s*\]$/g, '')) : [];
      const routeKeyArg = method === 'apply' ? applyArgs[0] : parts[1];
      if (sourceArgIsRouteKey(routeKeyArg || '', aliases)) return true;
    }
    const searchAssignmentRe = new RegExp(`^\\s*(?:\\))*${searchAccess}\\s*(?:\\+=|=(?!=|>))`);
    const searchAssignment = text.slice(callEnd).match(searchAssignmentRe);
    if (searchAssignment) {
      const expression = extractAssignmentExpression(text, callEnd + searchAssignment[0].length);
      if (expressionBuildsRouteQuery(expression, aliases, queryAliases, constructorAliases)) return true;
    }
    return false;
  };
  const constructorPattern = urlConstructorPattern(collectUrlConstructorAliases(text));
  const re = new RegExp(`\\bnew\\s+(?:${constructorPattern})\\s*\\(`, 'g');
  let match = re.exec(text);
  while (match) {
    const parsed = extractCallArgs(text, re.lastIndex);
    if (!urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases)) {
      if (checkRouteUrlCallSuffix(parsed.end)) return true;
    }
    if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
    match = re.exec(text);
  }
  const fullScope = { start: 0, end: text.length };
  const baseFactories = routeUrlFactoryAliases || collectRouteUrlFactoryAliases(text, externalAliases, staticRelativeAliases);
  const factories = expandRouteUrlFactoryAliases(
    text,
    baseFactories,
    { isReferenceShadowed: (factory, index) => referenceIsShadowedInScope(text, factory, fullScope, index) }
  );
  const baseFactorySet = new Set(baseFactories);
  if (factories.size) {
    for (const factory of factories) {
      const callableNamePattern = `(?:\\(\\s*)*${expressionReferencePatternForSource(factory, text)}\\s*(?:\\))*`;
      const factoryCallRe = new RegExp(`(?:^|[^\\w$.])${functionInvocationStartPattern(callableNamePattern)}`, 'g');
      match = factoryCallRe.exec(text);
      while (match) {
        const parsed = extractCallArgs(text, factoryCallRe.lastIndex);
        if (!hasMemberAccessPrefix(text, match.index)
          && !(baseFactorySet.has(factory) && referenceIsShadowedInScope(text, factory, fullScope, match.index))
          && checkRouteUrlCallSuffix(parsed.end)) return true;
        if (parsed.end > factoryCallRe.lastIndex) factoryCallRe.lastIndex = parsed.end;
        match = factoryCallRe.exec(text);
      }
    }
  }
  return false;
}

function containsForbiddenSearchAssignment(source, re, aliases = new Set()) {
  const text = String(source || '');
  const constructorAliases = collectUrlSearchParamsConstructorAliases(text);
  const queryAliases = collectRouteQueryAliases(text, aliases, constructorAliases);
  let match = re.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, re.lastIndex);
    if (expressionBuildsRouteQuery(expression, aliases, queryAliases, constructorAliases)) return true;
    match = re.exec(text);
  }
  return false;
}

function containsForbiddenLocationSearchAssignment(source, aliases = new Set()) {
  return containsForbiddenSearchAssignment(
    source,
    locationSearchWritePattern(collectLocationAliases(source)),
    aliases
  );
}

function containsForbiddenExecutableRouteCode(
  text,
  aliases,
  externalAliases,
  staticRelativeAliases,
  routeUrlFactoryAliases = null
) {
  const constructorAliases = collectUrlSearchParamsConstructorAliases(text);
  const inlineSearchParamsAliases = collectInlineUrlSearchParamsAliases(text);
  const queryAliases = collectRouteQueryAliases(text, aliases, constructorAliases);
  return containsForbiddenRouteLiteral(text, externalAliases)
    || containsForbiddenLocationSearchAssignment(text, aliases)
    || containsRelativeQueryAliasSerialization(text, queryAliases, externalAliases)
    || containsForbiddenUrlSearchParamsInitializer(text, aliases, externalAliases)
    || containsForbiddenInlineUrlSearchParamsInitializer(text, aliases, externalAliases)
    || containsForbiddenSplitRouteQueryLiteral(text, externalAliases, aliases)
    || containsForbiddenRouteKeyAliasConstruction(text, aliases, externalAliases)
    || containsForbiddenUrlSearchParamsVariable(text, aliases, externalAliases)
    || containsForbiddenRouteUrlMutation(text, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)
    || containsForbiddenScopedRouteUrlFactoryMutation(text, aliases, externalAliases, staticRelativeAliases)
    || containsForbiddenInlineRouteUrlSearchParamsMutation(text, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)
    || containsForbiddenInlineRouteUrlCallbackMutation(text, aliases, externalAliases, staticRelativeAliases)
    || Array.from(inlineSearchParamsAliases).some((name) => (
      containsRouteKeyWriteForOwner(text, name, aliases) && containsRelativeParamsSerialization(text, name, new Set(), externalAliases)
    ));
}

function routeBodyShadowsExternalAlias(params, body, externalAliases, shadowCandidates) {
  if (!shadowCandidates.size || !routeGuardBodyLooksRelevant(body)) return null;
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

function containsForbiddenShadowedExternalAliasRouteCode(
  source,
  aliases,
  externalAliases,
  shadowCandidates,
  staticRelativeAliases,
  routeUrlFactoryAliases = null
) {
  const text = String(source || '');
  const scanBody = (params, body) => {
    const scopedExternalAliases = routeBodyShadowsExternalAlias(params, body, externalAliases, shadowCandidates);
    const scopedSource = String(params || '').trim()
      ? `function __pressRouteGuard(${params}) {${body}}`
      : body;
    return scopedExternalAliases
      ? containsForbiddenExecutableRouteCode(scopedSource, aliases, scopedExternalAliases, staticRelativeAliases, null)
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

function scriptTypeAllowsRouteScan(attrs) {
  const match = String(attrs || '').match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`<>]+))/i);
  if (!match) return true;
  const type = String(match[1] || match[2] || match[3]).trim().toLowerCase().split(';')[0].trim();
  return !type || [
    'module',
    'text/javascript',
    'application/javascript',
    'text/ecmascript',
    'application/ecmascript',
    'application/x-javascript',
    'text/jscript'
  ].includes(type);
}

function containsForbiddenHtmlInlineRouteCode(source, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases = null) {
  const text = stripHtmlCommentsForRouteGuard(source);
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script(?=[\s>])[^>]*>/gi;
  let match = re.exec(text);
  while (match) {
    if (!scriptTypeAllowsRouteScan(match[1] || '')) {
      match = re.exec(text);
      continue;
    }
    const script = stripCommentsForRouteGuard(match[2] || '');
    if (containsForbiddenExecutableRouteCode(script, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)
      || containsForbiddenShadowedExternalAliasRouteCode(script, aliases, externalAliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)) {
      return true;
    }
    match = re.exec(text);
  }
  return false;
}

function containsForbiddenHtmlEventHandlerRouteCode(source, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases = null) {
  const text = stripHtmlCommentsForRouteGuard(source);
  const re = /\bon[a-z][\w:-]*\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`<>]+))/gi;
  let match = re.exec(text);
  while (match) {
    const handler = stripCommentsForRouteGuard(decodeHtmlAttributeValue(match[1] || match[2] || match[3] || ''));
    if (containsForbiddenExecutableRouteCode(handler, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)
      || containsForbiddenShadowedExternalAliasRouteCode(handler, aliases, externalAliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)) {
      return true;
    }
    match = re.exec(text);
  }
  return false;
}

function containsForbiddenV4RouteConstruction(source, contextSource = source) {
  const rawText = String(source || '');
  const text = stripCommentsForRouteGuard(rawText);
  const context = normalizeRouteGuardContext(contextSource, text);
  const localRouteKeyAliases = collectRouteKeyAliases(text);
  const importedRouteKeyAliases = mergeImportedContextAliases(new Set(), collectRouteKeyAliases, text, context, { shadow: false });
  const aliases = new Set([...localRouteKeyAliases, ...importedRouteKeyAliases]);
  aliases.localAliases = localRouteKeyAliases;
  aliases.importedAliases = importedRouteKeyAliases;
  const localExternalAliases = collectExternalUrlAliases(text);
  const importedExternalAliases = mergeImportedContextAliases(new Set(), collectExternalUrlAliases, text, context, { shadow: false });
  const externalAliases = new Set([...localExternalAliases, ...importedExternalAliases]);
  const staticRelativeAliases = mergeImportedContextAliases(collectStaticRelativeUrlAliases(text), collectStaticRelativeUrlAliases, text, context, { shadow: false });
  const localRouteUrlFactoryAliases = collectRouteUrlFactoryAliases(text, externalAliases, staticRelativeAliases);
  const importedRouteUrlFactoryAliases = mergeImportedContextAliases(new Set(), collectRouteUrlFactoryAliases, text, context, { shadow: false });
  const routeUrlFactoryAliases = new Set([...localRouteUrlFactoryAliases, ...importedRouteUrlFactoryAliases]);
  const hasForbiddenCode = shouldScanExecutableRouteCode(context.path) && (
    containsForbiddenExecutableRouteCode(text, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)
    || containsForbiddenShadowedExternalAliasRouteCode(text, aliases, externalAliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)
  );
  return hasForbiddenCode
    || (shouldScanHtmlRouteAttributes(context.path, rawText)
      && containsForbiddenHtmlRouteAttribute(stripHtmlCommentsForRouteGuard(rawText)))
    || ((/\.(?:html?|svg)$/i.test(String(context.path || '')))
      && (containsForbiddenHtmlInlineRouteCode(rawText, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)
        || containsForbiddenHtmlEventHandlerRouteCode(rawText, aliases, externalAliases, staticRelativeAliases, routeUrlFactoryAliases)));
}

[
  ['assigned URLSearchParams route builder', 'let params; params = new URLSearchParams({ id: post.location }); return "?" + params;', true],
  ['parenthesized URLSearchParams route builder', 'const params = (new URLSearchParams({ id: post.location })); return "?" + params;', true],
  ['URLSearchParams toString alias route builder', 'const params = new URLSearchParams({ id: post.location }); const qs = params.toString(); return "?" + qs;', true],
  ['route query alias public href', 'const qs = "id=" + post.location; return "?" + qs;', true],
  ['parenthesized route query alias public href', 'const qs = ("id=" + post.location); return "?" + qs;', true],
  ['static question mark alias public href', 'const qm = "?"; const href = qm + "id=" + post.location;', true],
  ['static equals alias public href', 'const eq = "="; const href = "?id" + eq + post.location;', true],
  ['conditional string route query alias public sink', 'const qs = enabled ? "id=" + post.location : ""; location.search = qs;', true],
  ['bound URL.searchParams route mutator', 'const url = new URL(location.href); const set = url.searchParams.set.bind(url.searchParams); set("id", post.location); return url.href;', true],
  ['bound URL.searchParams delete route mutator', 'const url = new URL(location.href); const remove = url.searchParams.delete.bind(url.searchParams); remove("id"); return url.href;', true],
  ['multi declarator route key alias', 'const unused = 1, key = "id"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true],
  ['escaped route key alias', 'const key = "\\u0069d"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true],
  ['member route key alias', 'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys.post, post.location); return url.href;', true],
  ['escaped member route key alias', 'const routeKeys = { post: "\\u0069d" }; const url = new URL(location.href); url.searchParams.set(routeKeys.post, post.location); return url.href;', true],
  ['bracket member route key alias', 'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys["post"], post.location); return url.href;', true],
  ['optional bracket member route key alias', 'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys?.["post"], post.location); return url.href;', true],
  ['namespace imported route key alias', 'import * as config from "./config.js"; const url = new URL(location.href); url.searchParams.set(config.key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }],
  ['escaped JS public route literal', 'export const href = "?\\u0069d=post.md";', true],
  ['URL.searchParams alias route mutation', 'const url = new URL(location.href); const params = url.searchParams; params.set("id", post.location); return url.href;', true],
  ['location.search route query alias', 'const routeKey = "id"; const qs = routeKey + "=" + post.location; location.search = qs;', true],
  ['location.search multiline route query assignment', 'location.search =\n  "id=" + post.location;', true],
  ['location.search URLSearchParams route query assignment', 'location.search = new URLSearchParams({ id: post.location });', true],
  ['location object alias route query sink', 'const loc = location; const routeKey = "id"; const qs = routeKey + "=" + post.location; loc.search = qs;', true],
  ['destructured location alias route query sink', 'const { location: loc } = window; const routeKey = "id"; const qs = routeKey + "=" + post.location; loc.search = qs;', true],
  ['location bracket route query sink', 'const routeKey = "id"; window.location["search"] = routeKey + "=" + post.location;', true],
  ['member URLSearchParams route builder', 'state.params = new URLSearchParams({ id: post.location }); return "?" + state.params;', true],
  ['Object.entries URLSearchParams route builder', 'const params = new URLSearchParams(Object.entries({ id: post.location })); return "?" + params;', true],
  ['Map URLSearchParams route builder', 'const params = new URLSearchParams(new Map([["id", post.location]])); return "?" + params;', true],
  ['String-wrapped URLSearchParams route builder', 'const params = new URLSearchParams({ id: post.location }); return "?" + String(params);', true],
  ['inline URL searchParams alias builder', 'const params = new URL(location.href).searchParams; params.set("id", post.location); return "?" + params;', true],
  ['parenthesized URL.searchParams alias mutation', 'const url = new URL(location.href); const params = (url.searchParams); params.set("id", post.location); return url.href;', true],
  ['destructured URL.searchParams alias mutation', 'const url = new URL(location.href); const { searchParams } = url; searchParams.set("id", post.location); return url.href;', true],
  ['computed destructured URL.searchParams alias mutation', 'const url = new URL(location.href); const { ["searchParams"]: params } = url; params.set("id", post.location); return url.href;', true],
  ['inline computed destructured URL.searchParams alias mutation', 'const { ["searchParams"]: params } = new URL(location.href); params.set("id", post.location); return "?" + params;', true],
  ['destructured URL.searchParams mutator alias dispatch', 'const url = new URL(location.href); const { set } = url.searchParams; set.call(url.searchParams, "id", post.location); return url.href;', true],
  ['destructured URL.searchParams mutator alias bracket dispatch', 'const url = new URL(location.href); const { set } = url.searchParams; set["call"](getTarget(a, b), "id", post.location); return url.href;', true],
  ['computed destructured URL.searchParams mutator alias', 'const url = new URL(location.href); const { ["append"]: appendParam } = url.searchParams; appendParam("tab", "posts"); return url.href;', true],
  ['bracket URL.searchParams route key mutation', 'const url = new URL(location.href); url.searchParams["set"]("id", post.location); return url.href;', true],
  ['optional URL.searchParams route key mutation', 'const url = new URL(location.href); url.searchParams?.set("tab", "posts"); return url.href;', true],
  ['optional bracket URL.searchParams route key mutation', 'const url = new URL(location.href); url["searchParams"]?.["append"]("id", post.location); return url.href;', true],
  ['optional call URL.searchParams route key mutation', 'const url = new URL(location.href); url.searchParams.set?.("id", post.location); return url.href;', true],
  ['URL.search route key assignment', 'const key = "id"; const url = new URL(location.href); url.search = key + "=" + post.location; return url.href;', true],
  ['URL.search operator line continuation', 'const key = "id"; const url = new URL(location.href); url.search = key +\n  "=" + post.location; return url.href;', true],
  ['URL.search URLSearchParams route assignment', 'const url = new URL(location.href); url.search = new URLSearchParams({ id: post.location }); return url.href;', true],
  ['split route literal with assembled static key', 'return "?" + ("i" + "d" + "=" + post.location);', true],
  ['route URL member assignment', 'state.url = new URL(location.href); state.url.searchParams.set("id", post.location); return state.url.href;', true],
  ['route URL bracket member assignment', 'state["url"] = new URL(location.href); state["url"].searchParams.set("id", post.location); return state["url"].href;', true],
  ['route URL factory helper result', 'function currentUrl() { return new URL(location.href); } const url = currentUrl(); url.searchParams.set("id", post.location); return url.href;', true],
  ['route URL function expression factory result', 'const currentUrl = function() { return new URL(location.href); }; const url = currentUrl(); url.searchParams.set("id", post.location); return url.href;', true],
  ['direct route URL factory helper mutation', 'function currentUrl() { return new URL(location.href); } currentUrl().searchParams.set("id", post.location);', true],
  ['window URLSearchParams route builder', 'const params = new window.URLSearchParams({ id: post.location }); return "?" + params;', true],
  ['URLSearchParams constructor alias route builder', 'const Params = URLSearchParams; const params = new Params({ id: post.location }); return "?" + params;', true],
  ['globalThis URLSearchParams constructor alias route builder', 'const Params = globalThis.URLSearchParams; const params = new Params({ id: post.location }); return "?" + params;', true],
  ['destructured URLSearchParams constructor alias route builder', 'const { URLSearchParams: Params } = window; const params = new Params({ id: post.location }); return "?" + params;', true],
  ['conditional URLSearchParams route builder', 'const params = enabled ? new URLSearchParams({ id: post.location }) : new URLSearchParams(); return "?" + params;', true],
  ['URL.searchParams delete route key', 'const url = new URL(location.href); url.searchParams.delete("id"); return url.href;', true],
  ['URL.searchParams call route key mutation', 'const url = new URL(location.href); url.searchParams.set.call(url.searchParams, "id", post.location); return url.href;', true],
  ['URL.searchParams call route key mutation with comma receiver', 'const url = new URL(location.href); url.searchParams.set.call(getTarget(a, b), "id", post.location); return url.href;', true],
  ['URL.searchParams bracket call route key mutation', 'const url = new URL(location.href); url.searchParams.set["call"](url.searchParams, "id", post.location); return url.href;', true],
  ['URL.searchParams apply route key mutation', 'const url = new URL(location.href); url.searchParams.set.apply(url.searchParams, ["id", post.location]); return url.href;', true],
  ['bracket optional call URL.searchParams route key mutation', 'const url = new URL(location.href); url.searchParams["append"]?.("tab", "posts"); return url.href;', true],
  ['bracket URL.searchParams alias route key mutation', 'const url = new URL(location.href); const params = url.searchParams; params["append"]("tab", "posts"); return url.href;', true],
  ['bracket URL.searchParams alias collection route key mutation', 'const url = new URL(location.href); const params = url["searchParams"]; params.set("id", post.location); return url.href;', true],
  ['optional URL.searchParams alias collection route key mutation', 'const url = new URL(location.href); const params = url?.searchParams; params.set("id", post.location); return url.href;', true],
  ['inline bracket URL.searchParams alias route key mutation', 'const params = new URL(location.href)["searchParams"]; params.set("id", post.location); return "?" + params;', true],
  ['direct chained URL.searchParams route key mutation', 'new URL(location.href).searchParams.set("id", post.location);', true],
  ['helper mutates route URL route key', 'function mutate(url) { url.searchParams.set("id", post.location); } mutate(new URL(location.href));', true],
  ['helper mutates route URL searchParams alias route key', 'function mutate(url) { const params = url.searchParams; params.set("id", post.location); } mutate(new URL(location.href));', true],
  ['bound helper mutates route URL route key', 'function mutate(url) { url.searchParams.set("id", post.location); } const bound = mutate.bind(null, new URL(location.href)); bound();', true],
  ['Object.assign helper mutates route URL route key', 'const helpers = {}; Object.assign(helpers, { mutate(url) { url.searchParams.set("id", post.location); } }); helpers.mutate(new URL(location.href));', true],
  ['Reflect.set helper mutates route URL route key', 'const helpers = {}; Reflect.set(helpers, "mutate", function(url) { url.searchParams.set("id", post.location); }); helpers.mutate(new URL(location.href));', true],
  ['helper mutates external URL route key stays allowed', 'function mutate(url) { url.searchParams.set("id", sku); } mutate(new URL("https://api.example.test/product"));', false],
  ['bound helper mutates external URL route key stays allowed', 'function mutate(url) { url.searchParams.set("id", sku); } const bound = mutate.bind(null, new URL("https://api.example.test/product")); bound();', false],
  ['window URL route key mutation', 'const url = new window.URL(location.href); url.searchParams.set("id", post.location); return url.href;', true],
  ['external split query string', 'const externalBase = "https://api.example.test/product"; return externalBase + "?id=" + sku;', false],
  ['external split tab string', 'return "https://api.example.test/product" + "?tab=posts";', false],
  ['external URL static relative path alias', 'const externalBase = "https://api.example.test"; const productPath = "/product"; const url = new URL(productPath, externalBase); url.searchParams.set("id", sku); return url.href;', false],
  ['external bracket URL searchParams allowed', 'const url = new URL("https://api.example.test/product"); url.searchParams["set"]("id", sku); return url.href;', false],
  ['external optional call URL searchParams allowed', 'const url = new URL("https://api.example.test/product"); url.searchParams.set?.("id", sku); return url.href;', false],
  ['external URL object alias', 'const externalBase = new URL("https://api.example.test"); const url = new URL("/product", externalBase); url.searchParams.set("id", sku); return url.href;', false],
  ['external URL object member alias', 'const endpoints = { product: "https://api.example.test/product" }; const url = new URL(endpoints.product); url.searchParams.set("id", sku); return url.href;', false],
  ['cross-file imported external URL alias context', 'import { endpoint } from "./config.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file default route key alias', 'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export default "id";' }] }],
  ['cross-file escaped default route key alias', 'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export default "\\u0069d";' }] }],
  ['cross-file const default route key alias', 'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'const routeKey = "id"; export default routeKey;' }] }],
  ['cross-file local default export route key alias', 'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'const routeKey = "id"; export { routeKey as default };' }] }],
  ['cross-file default route URL factory assignment', 'import makeUrl from "./url.js"; const url = makeUrl(); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export default function makeUrl() { return new URL(location.href); }' }] }],
  ['cross-file parenthesized default route URL factory assignment', 'import makeUrl from "./url.js"; const url = makeUrl(); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export default (function makeUrl() { return new URL(location.href); });' }] }],
  ['cross-file parenthesized default arrow route URL factory assignment', 'import makeUrl from "./url.js"; const url = makeUrl(); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export default (() => new URL(location.href));' }] }],
  ['cross-file default route URL factory direct mutation', 'import makeUrl from "./url.js"; makeUrl().searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'const makeUrl = () => new URL(location.href); export { makeUrl as default };' }] }],
  ['cross-file default route URL factory alias direct mutation', 'import makeUrl from "./url.js"; const routeFactory = makeUrl; routeFactory().searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'const makeUrl = () => new URL(location.href); export { makeUrl as default };' }] }],
  ['cross-file route URL factory object property alias direct mutation', 'import { makeUrl } from "./url.js"; const helper = { makeUrl }; helper.makeUrl().searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeUrl() { return new URL(location.href); }' }] }],
  ['cross-file route URL factory quoted object property alias direct mutation', 'import { makeUrl } from "./url.js"; const helper = { "routeFactory": makeUrl }; helper.routeFactory().searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeUrl() { return new URL(location.href); }' }] }],
  ['cross-file route URL factory bracket member assignment', 'import { makeUrl } from "./url.js"; state["url"] = makeUrl(); state["url"].searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeUrl() { return new URL(location.href); }' }] }],
  ['cross-file route URL factory return after fake function string', 'import { makeUrl } from "./url.js"; makeUrl().searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeUrl() { const marker = "function fake() {"; return new URL(location.href); }' }] }],
  ['cross-file imported external URL factory shadowed param', 'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(location.href); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' }, { path: 'modules/url.js', source: 'import { externalRoot } from "./config.js"; export function makeProductUrl(externalRoot) { return new URL("/product", externalRoot); }' }] }],
  ['cross-file imported external URL factory shadowed after string brace', 'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' }, { path: 'modules/url.js', source: 'import { externalRoot } from "./config.js"; export function makeProductUrl() { const marker = "{"; const externalRoot = location.href; return new URL("/product", externalRoot); }' }] }],
  ['cross-file imported external URL factory shadowed in return block', 'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' }, { path: 'modules/url.js', source: 'import { externalRoot } from "./config.js"; export function makeProductUrl() { if (ok) { const externalRoot = location.href; return new URL("/product", externalRoot); } return new URL("/fallback", "https://api.example.test"); }' }] }],
  ['cross-file imported external URL factory shadowed by array destructuring', 'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' }, { path: 'modules/url.js', source: 'import { externalRoot } from "./config.js"; export function makeProductUrl() { const [externalRoot] = [location.href]; return new URL("/product", externalRoot); }' }] }],
  ['cross-file imported external template route context', 'import { endpoint } from "./config.js"; return `${endpoint}?id=sku-123`;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external query alias context', 'import { endpoint } from "./config.js"; const qs = "id=" + sku; return `${endpoint}?${qs}`;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external query alias concat context', 'import { endpoint } from "./config.js"; const qs = "id=" + sku; return endpoint + "?" + qs;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file default external URL template query alias context', 'import endpoint from "./config.js"; const qs = "id=" + sku; return `${endpoint}?${qs}`;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export default "https://api.example.test/product";' }] }],
  ['cross-file default identifier external URL query alias context', 'import endpoint from "./config.js"; const qs = "id=" + sku; return endpoint + "?" + qs;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'const endpoint = "https://api.example.test/product"; export default endpoint;' }] }],
  ['cross-file local default export external URL query alias context', 'import endpoint from "./config.js"; const qs = "id=" + sku; return endpoint + "?" + qs;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'const endpoint = "https://api.example.test/product"; export { endpoint as default };' }] }],
  ['cross-file mixed named external URL alias context', 'import unused, { endpoint as mixedEndpoint } from "./config.js"; const url = new URL(mixedEndpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export default "unused"; export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file commented default route key alias ignored', 'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: '// export default "id";\nexport default "slug";' }] }],
  ['cross-file commented external URL alias ignored', 'import { endpoint } from "./config.js"; const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: '// const endpoint = "https://api.example.test/product";\nexport const endpoint = location.href;' }] }],
  ['commented public route literal is ignored', '// return "?id=post.md";\nreturn router.getPostHref(post);', false],
  ['HTML commented public route literal is ignored', '<!-- <a href="?id=post.md">old</a> -->\n<a href="${href}">New</a>', false],
  ['HTML unquoted public route attribute', '<a href=?id=post.md>Post</a>', true],
  ['HTML escaped equals public route attribute', '<a href="?id&#61;post.md">Post</a>', true],
  ['HTML escaped ampersand public route attribute', '<a href="?foo=1&amp;id=post.md">Post</a>', true],
  ['HTML numeric route key public route attribute', '<a href="?&#105;d=post.md">Post</a>', true],
  ['HTML padded numeric query public route attribute', '<a href="&#00063;id&#00061;post.md">Post</a>', true],
  ['HTML https text before public route attribute', '<p>https://example.test</p><a href="?id=post.md">Post</a>', true, { path: 'assets/link.html', files: [] }],
  ['HTML srcset public route attribute', '<img srcset="?id=post.md 1x, ?tab=posts 2x">', true, { path: 'assets/card.html', files: [] }],
  ['HTML inline script public route builder', '<script>location.search = "id=" + post.location;</script>', true, { path: 'assets/card.html', files: [] }],
  ['HTML inline script public route builder with loose end tag', '<script>location.search = "id=" + post.location;</script\t\n data-x>', true, { path: 'assets/card.html', files: [] }],
  ['HTML event handler public route builder', `<button onclick="location.search = '?id=post.md'">Open</button>`, true, { path: 'assets/card.html', files: [] }],
  ['HTML JSON script route data is ignored', '<script type="application/json">{"href":"?id=post.md"}</script>', false, { path: 'assets/data.html', files: [] }],
  ['JS comment with HTML route attribute is ignored', '// <a href="?id=post.md">old</a>\nreturn router.getPostHref(post);', false, { path: 'modules/layout.js', files: [] }],
  ['JS regex literal does not hide later route literal', 'const re = /^https?:\\/\\//; return "?id=post.md";', true, { path: 'modules/layout.js', files: [] }],
  ['CSS asset query string is not executable route code', 'body { background: url("/sprite.svg?id=foo"); }', false, { path: 'theme.css', files: [] }],
  ['JSON asset query string is not executable route code', '{"href":"?tab=posts"}', false, { path: 'assets/data.json', files: [] }],
  ['parenthesized external URL relative path', 'const externalBase = "https://api.example.test"; const url = new URL(("/product?id=sku-123"), externalBase); url.searchParams.set("id", sku); return url.href;', false],
  ['nested same-name external endpoint helper keeps imported alias available', 'import { endpoint } from "./config.js"; function preview(endpoint) { return new URL(endpoint).href; } const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['block-scoped imported external alias shadowing', 'import { endpoint } from "./config.js"; if (ok) { const endpoint = location.href; const url = new URL(endpoint); url.searchParams.set("id", post.location); }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['local external alias parameter shadowing', 'const endpoint = "https://api.example.test/product"; export function route(endpoint, post) { return endpoint + "?id=" + post.id; }', true, { path: 'modules/layout.js', files: [] }],
  ['catch imported external alias shadowing', 'import { endpoint } from "./config.js"; try { throw location.href; } catch (endpoint) { const url = new URL(endpoint); url.searchParams.set("id", post.location); }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['nested helper external alias does not mask parameter shadowing', 'import { endpoint } from "./config.js"; export function route(endpoint, post) { function helper() { const endpoint = "https://api.example.test/product"; return endpoint; } const url = new URL(endpoint); url.searchParams.set("id", post.location); return helper() || url.href; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['array destructured external alias shadowing', 'import { endpoint } from "./config.js"; export function route([endpoint], post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['body array destructured external alias shadowing', 'import { endpoint } from "./config.js"; export function route(post) { const [endpoint] = [location.href]; const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['renamed default destructured external alias shadowing', 'import { endpoint } from "./config.js"; export function route({ endpoint: endpoint = location.href }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['for-loop external alias shadowing', 'import { endpoint } from "./config.js"; for (const endpoint of [location.href]) { const url = new URL(endpoint); url.searchParams.set("id", post.location); }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['string brace does not truncate shadowed body scan', 'import { endpoint } from "./config.js"; export function route(endpoint, post) { const marker = "}"; return endpoint + "?id=" + post.id; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file barrel external URL alias context', 'import { endpoint } from "./barrel.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }, { path: 'modules/barrel.js', source: 'export { endpoint } from "./config.js";' }] }],
  ['cross-file local-export barrel external URL alias context', 'import { endpoint } from "./barrel.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }, { path: 'modules/barrel.js', source: 'import { endpoint } from "./config.js"; export { endpoint };' }] }],
  ['cross-file star barrel external URL alias context', 'import { endpoint } from "./barrel.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }, { path: 'modules/barrel.js', source: 'export * from "./config.js";' }] }],
  ['cross-file external URL alias shadowing', 'import { endpoint } from "./config.js"; function route(endpoint, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL destructured param shadowing', 'import { endpoint } from "./config.js"; function route({ endpoint }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL arrow destructured param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL default arrow param shadowing', 'import { endpoint } from "./config.js"; export default (endpoint, post) => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL expression arrow param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => endpoint + "?id=" + post.location;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL inline callback param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => (url.searchParams.set("id", post.location), url.href))(new URL(endpoint));', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL inline block callback param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => { url.searchParams.set("id", post.location); return url.href; })(new URL(endpoint));', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL inline function callback param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => (function(url) { url.searchParams.set("id", post.location); return url.href; })(new URL(endpoint));', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL inline async function callback param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => (async function(url) { url.searchParams.set("id", post.location); return url.href; })(new URL(endpoint));', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL helper mutator param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { const mutate = (url) => { url.searchParams.set("id", post.location); return url.href; }; return mutate(new URL(endpoint)); };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL expression helper mutator param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { const mutate = (url) => (url.searchParams.set("id", post.location), url.href); return mutate(new URL(endpoint)); };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL inline callback call param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => (url.searchParams.set("id", post.location), url.href)).call(null, new URL(endpoint));', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL inline callback complex call param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => (url.searchParams.set("id", post.location), url.href)).call(getThis(a, b), new URL(endpoint));', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL inline callback apply param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => ((url) => (url.searchParams.set("id", post.location), url.href)).apply(null, [new URL(endpoint)]);', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL helper mutator call param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } return mutate.call(null, new URL(endpoint)); };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL helper mutator apply param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } return mutate.apply(null, [new URL(endpoint)]); };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL object helper mutator param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { const helper = { mutate(url) { url.searchParams.set("id", post.location); return url.href; } }; return helper.mutate(new URL(endpoint)); };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL bound helper mutator param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } const bound = mutate.bind(null); return bound(new URL(endpoint)); };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL prebound helper mutator param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } const bound = mutate.bind(null, new URL(endpoint)); return bound(); };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL second-arg helper mutator param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => { function mutate(ctx, url) { url.searchParams.set("id", post.location); return url.href; } return mutate(null, new URL(endpoint)); };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['sibling helper shadow does not hide active mutator', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } if (a) { function mutate(url) { return url.href; } } if (b) { return mutate(new URL(location.href)); }', true],
  ['nested mutating helper in one-arg function is rejected', 'export function route(post) { function mutate(url) { url.searchParams.set("id", post.location); return url.href; } return mutate(new URL(location.href)); }', true],
  ['multi-arg object helper mutator is rejected', 'const helper = { mutate(ctx, url) { url.searchParams.set("id", "post.md"); return url.href; } }; return helper.mutate(null, new URL(location.href));', true],
  ['helper URL.search assignment is rejected', 'function mutate(url) { url.search = "id=" + post.location; return url.href; } return mutate(new URL(location.href));', true],
  ['parenthesized direct helper mutator URL is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate((new URL(location.href)));', true],
  ['parenthesized call helper mutator URL is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate.call(null, (new URL(location.href)));', true],
  ['parenthesized apply helper mutator URL is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate.apply(null, [(new URL(location.href))]);', true],
  ['parenthesized inline callback direct URL is rejected', 'return ((url) => (url.searchParams.set("id", "post.md"), url.href))((new URL(location.href)));', true],
  ['optional direct helper mutator URL is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate?.(new URL(location.href));', true],
  ['optional call helper mutator URL is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } mutate?.call(null, new URL(location.href)); mutate?.apply(null, [new URL(location.href)]);', true],
  ['object property helper mutator alias is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate }; return helper.mutate(new URL(location.href));', true],
  ['quoted object property helper mutator alias is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { "routeMutator": mutate }; return helper.routeMutator(new URL(location.href));', true],
  ['quoted object helper mutator key is rejected', 'const helper = { "mutate": (url) => { url.searchParams.set("id", "post.md"); return url.href; } }; return helper.mutate(new URL(location.href));', true],
  ['computed object helper mutator key is rejected', 'const helper = { ["mutate"](url) { url.searchParams.set("id", "post.md"); return url.href; } }; return helper.mutate(new URL(location.href));', true],
  ['static key object helper mutator call is rejected', 'const helper = { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } }; const key = "mutate"; return helper[key](new URL(location.href));', true],
  ['member assignment helper mutator alias is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } helper.routeMutator = mutate; return helper.routeMutator(new URL(location.href));', true],
  ['destructured member helper mutator alias is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate }; const { mutate: routeMutator } = helper; return routeMutator(new URL(location.href));', true],
  ['bracket call helper mutator URL is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } return mutate["call"](null, new URL(location.href));', true],
  ['bracket bind helper mutator URL is rejected', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const bound = mutate["bind"](null); return bound(new URL(location.href));', true],
  ['optional inline callback direct URL is rejected', 'return ((url) => (url.searchParams.set("id", "post.md"), url.href))?.(new URL(location.href));', true],
  ['bracket inline callback call URL is rejected', 'return ((url) => (url.searchParams.set("id", "post.md"), url.href))["call"](null, new URL(location.href));', true],
  ['multi-arg block arrow callback direct URL is rejected', 'return ((ctx, url) => { url.searchParams.set("id", "post.md"); return url.href; })("ctx", new URL(location.href));', true],
  ['multi-arg function callback call URL is rejected', 'return (function(ctx, url) { url.searchParams.set("id", "post.md"); return url.href; }).call(null, "ctx", new URL(location.href));', true],
  ['multi-arg inline callback call is rejected', 'return ((ctx, url) => (url.searchParams.set("id", "post.md"), url.href)).call(null, "ctx", new URL(location.href));', true],
  ['multi-arg inline callback apply is rejected', 'return ((ctx, url) => (url.searchParams.set("id", "post.md"), url.href)).apply(null, ["ctx", new URL(location.href)]);', true],
  ['cross-file external URL multiline expression arrow param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => (\n  endpoint + "?id=" + post.location\n);', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL single expression arrow param shadowing', 'import { endpoint } from "./config.js"; export default endpoint => endpoint + "?tab=posts";', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL async single arrow param shadowing', 'import { endpoint } from "./config.js"; const route = async endpoint => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL defaulted destructured param shadowing', 'import { endpoint } from "./config.js"; function route({ endpoint = location.href }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL object method destructured param shadowing', 'import { endpoint } from "./config.js"; export default { route({ endpoint }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; } };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL nested local does not shadow mount', 'import { endpoint } from "./config.js"; function helper() { const endpoint = "local"; return endpoint; } const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL inline callback context', 'import { endpoint } from "./config.js"; ((url) => (url.searchParams.set("id", sku), url.href))(new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL helper mutator context', 'import { endpoint } from "./config.js"; const mutate = (url) => { url.searchParams.set("id", sku); return url.href; }; mutate(new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL factory context', 'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' }, { path: 'modules/url.js', source: 'import { externalRoot } from "./config.js"; export function makeProductUrl() { return new URL("/product", externalRoot); }' }] }],
  ['cross-file imported external URL factory ignores sibling shadow context', 'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' }, { path: 'modules/url.js', source: 'import { externalRoot } from "./config.js"; export function makeProductUrl() { if (ok) { const externalRoot = location.href; void externalRoot; } return new URL("/product", externalRoot); }' }] }],
  ['cross-file imported external URL factory ignores nested helper var context', 'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' }, { path: 'modules/url.js', source: 'import { externalRoot } from "./config.js"; export function makeProductUrl() { function helper() { var externalRoot = location.href; return externalRoot; } void helper; return new URL("/product", externalRoot); }' }] }],
  ['cross-file imported external URL factory ignores fake declaration string context', 'import { makeProductUrl } from "./url.js"; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const externalRoot = "https://api.example.test";' }, { path: 'modules/url.js', source: 'import { externalRoot } from "./config.js"; export function makeProductUrl() { const marker = "const externalRoot = x"; return new URL("/product", externalRoot); }' }] }],
  ['cross-file imported external URL factory ignores nested imported-name route helper context', 'import { makeProductUrl } from "./url.js"; function setup() { function makeProductUrl() { return new URL(location.href); } void makeProductUrl; } void setup; const url = makeProductUrl(); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeProductUrl() { return new URL("/product", "https://api.example.test"); }' }] }],
  ['cross-file imported external URL factory rejects active nested imported-name route helper', 'import { makeProductUrl } from "./url.js"; function setup(post) { function makeProductUrl() { return new URL(location.href); } makeProductUrl().searchParams.set("id", post.location); } void setup;', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeProductUrl() { return new URL("/product", "https://api.example.test"); }' }] }],
  ['nested route factory does not leak into safe sibling local factory', 'function setup() { function makeUrl() { return new URL(location.href); } void makeUrl; } function route() { const makeUrl = () => new URL("https://api.example.test/product"); const url = makeUrl(); url.searchParams.set("id", sku); return url.href; }', false],
  ['nested route factory member assignment is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } state.url = makeUrl(); state.url.searchParams.set("id", post.location); return state.url.href; }', true],
  ['nested route factory descendant same-name shadow stays safe', 'function route() { function makeUrl() { return new URL(location.href); } function inner() { function makeUrl() { return new URL("https://api.example.test/product"); } const url = makeUrl(); url.searchParams.set("id", sku); return url.href; } return inner; }', false],
  ['nested route factory descendant same-name search assignment stays safe', 'function route() { function makeUrl() { return new URL(location.href); } function inner() { function makeUrl() { return new URL("https://api.example.test/product"); } makeUrl().search = "id=" + sku; } return inner; }', false],
  ['single-param block arrow route factory direct mutation is rejected', 'function route(post) { const makeUrl = base => { return new URL(location.href); }; makeUrl(location.href).searchParams.set("id", post.location); }', true],
  ['var route factory shadows imported factory for whole function', 'import { makeProductUrl } from "./url.js"; export function mount(post) { if (post) { var makeProductUrl = () => new URL(location.href); } makeProductUrl().searchParams.set("id", post.location); }', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeProductUrl() { return new URL("/product", "https://api.example.test"); }' }] }],
  ['nested route factory nested call args direct mutation is rejected', 'function route(post) { function makeUrl(base) { return new URL(location.href); } makeUrl(getBase()).searchParams.set("id", post.location); }', true],
  ['nested route factory direct searchParams alias is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const params = makeUrl().searchParams; params.set("id", post.location); }', true],
  ['nested route factory parenthesized searchParams alias is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const params = (makeUrl()).searchParams; params.set("id", post.location); }', true],
  ['nested route factory parenthesized destructured searchParams alias is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const { searchParams } = (makeUrl()); searchParams.set("id", post.location); }', true],
  ['nested route factory destructured searchParams default is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const url = makeUrl(); const { searchParams = new URLSearchParams() } = url; searchParams.set("id", post.location); }', true],
  ['nested route factory direct destructured searchParams default is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const { searchParams = new URLSearchParams() } = makeUrl(); searchParams.set("id", post.location); }', true],
  ['nested route factory computed destructured searchParams alias is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const { ["searchParams"]: params } = makeUrl(); params.set("id", post.location); }', true],
  ['nested route factory direct searchParams dispatch is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } makeUrl().searchParams.set.call(makeUrl().searchParams, "id", post.location); makeUrl().searchParams.set.apply(makeUrl().searchParams, ["tab", "posts"]); }', true],
  ['nested route factory searchParams dispatch with comma receiver is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } makeUrl().searchParams.set.call(getTarget(a, b), "id", post.location); makeUrl().searchParams.set.apply(getTarget(a, b), ["tab", "posts"]); }', true],
  ['nested route factory optional searchParams dispatch is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } makeUrl().searchParams.set?.call(getTarget(a, b), "id", post.location); makeUrl().searchParams.set?.apply(getTarget(a, b), ["tab", "posts"]); }', true],
  ['nested route factory parenthesized callee mutation is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } (makeUrl)().searchParams.set("id", post.location); ((makeUrl))().search = "tab=posts"; }', true],
  ['nested route factory call direct mutation is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } makeUrl.call(null).searchParams.set("id", post.location); }', true],
  ['nested route factory apply assignment mutation is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const url = makeUrl.apply(null, []); url.searchParams.set("id", post.location); }', true],
  ['nested route factory bracket member assignment is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } state["url"] = makeUrl(); state["url"].searchParams.set("id", post.location); }', true],
  ['nested route factory alias direct mutation is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const routeFactory = makeUrl; routeFactory().searchParams.set("id", post.location); }', true],
  ['nested route factory member assignment alias direct mutation is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } helper.routeFactory = makeUrl; helper.routeFactory().searchParams.set("id", post.location); }', true],
  ['nested route factory object property alias direct mutation is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const helper = { makeUrl }; helper.makeUrl().searchParams.set("id", post.location); }', true],
  ['nested route factory quoted object property alias direct mutation is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const helper = { "routeFactory": makeUrl }; helper.routeFactory().searchParams.set("id", post.location); }', true],
  ['nested route factory destructured member alias direct mutation is rejected', 'function route(post) { function makeUrl() { return new URL(location.href); } const helper = { makeUrl }; const { makeUrl: routeFactory } = helper; routeFactory().searchParams.set("id", post.location); }', true],
  ['object method route factory direct mutation is rejected', 'function route(post) { const helper = { makeUrl() { return new URL(location.href); } }; helper.makeUrl().searchParams.set("id", post.location); }', true],
  ['quoted object method route factory direct mutation is rejected', 'function route(post) { const helper = { "makeUrl"() { return new URL(location.href); } }; helper.makeUrl().searchParams.set("id", post.location); }', true],
  ['computed object method route factory direct mutation is rejected', 'function route(post) { const helper = { ["makeUrl"]() { return new URL(location.href); } }; helper.makeUrl().searchParams.set("id", post.location); }', true],
  ['static key object method route factory direct mutation is rejected', 'function route(post) { const helper = { makeUrl() { return new URL(location.href); } }; const key = "makeUrl"; helper[key]().searchParams.set("id", post.location); }', true],
  ['inline new URL searchParams dispatch with comma receiver is rejected', 'new URL(location.href).searchParams.set.call(getTarget(a, b), "id", post.location);', true],
  ['inline new URL optional searchParams dispatch is rejected', 'new URL(location.href).searchParams.set?.call(getTarget(a, b), "id", post.location);', true],
  ['cross-file imported route factory parenthesized callee mutation is rejected', 'import { makeUrl } from "./url.js"; export function route(post) { (makeUrl)().searchParams.set("id", post.location); }', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeUrl() { return new URL(location.href); }' }] }],
  ['returned route URL variable factory mutation is rejected', 'function makeUrl() { const url = new URL(location.href); return url; } makeUrl().searchParams.set("id", post.location);', true],
  ['cross-file returned route URL variable factory mutation is rejected', 'import { makeUrl } from "./url.js"; export function route(post) { makeUrl().searchParams.set("id", post.location); }', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function makeUrl() { const url = new URL(location.href); return url; }' }] }],
  ['async route URL factory mutation is rejected', 'async function makeUrl() { return new URL(location.href); } makeUrl().searchParams.set("id", post.location);', true],
  ['awaited route URL factory assignment mutation is rejected', 'function makeUrl() { return new URL(location.href); } export async function route(post) { const url = await makeUrl(); url.searchParams.set("id", post.location); }', true],
  ['default export object route factory helper is rejected', 'export default { makeUrl() { return new URL(location.href); }, mount(post) { this.makeUrl().searchParams.set("id", post.location); } };', true],
  ['named default export object route factory helper is rejected', 'const theme = { makeUrl() { return new URL(location.href); }, mount(post) { this.makeUrl().searchParams.set("id", post.location); }, views: {}, components: {}, effects: {} }; export default theme;', true],
  ['local named default export object route factory helper is rejected', 'const theme = { makeUrl() { return new URL(location.href); }, mount(post) { this.makeUrl().searchParams.set("id", post.location); }, views: {}, components: {}, effects: {} }; export { theme as default };', true],
  ['computed searchParams access is rejected', 'const url = new URL(location.href); url["search" + "Params"].set("id", post.location);', true],
  ['computed route factory searchParams access is rejected', 'function makeUrl() { return new URL(location.href); } makeUrl()["search" + "Params"].set("id", post.location);', true],
  ['computed searchParams mutator access is rejected', 'const url = new URL(location.href); url.searchParams["se" + "t"]("id", post.location);', true],
  ['aliased searchParams mutator access is rejected', 'const method = "set"; const url = new URL(location.href); url.searchParams[method]("id", post.location);', true],
  ['computed location search assignment is rejected', 'location["se" + "arch"] = "id=" + post.location;', true],
  ['imported route key alias shadowed by local const stays safe', 'import { key } from "./config.js"; export function route(post) { const key = "sku"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }],
  ['imported route key alias shadowed by function param stays safe', 'import { key } from "./config.js"; export function route(key, post) { const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href; }', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }],
  ['same-name object method route factory stays safe', 'function route() { function makeUrl() { return new URL(location.href); } const helper = { makeUrl() { return new URL("https://api.example.test/product"); } }; helper.makeUrl().searchParams.set("id", sku); }', false],
  ['spaced same-name object method route factory stays safe', 'function route() { function makeUrl() { return new URL(location.href); } const helper = { makeUrl() { return new URL("https://api.example.test/product"); } }; helper . makeUrl().searchParams.set("id", sku); helper ?. makeUrl().searchParams.set("tab", "posts"); }', false],
  ['route factory alias local shadow stays safe', 'function makeUrl() { return new URL(location.href); } function route() { function makeUrl() { return new URL("https://api.example.test/product"); } const routeFactory = makeUrl; routeFactory().searchParams.set("id", sku); }', false],
  ['route factory member alias local shadow stays safe', 'function makeUrl() { return new URL(location.href); } function route() { function makeUrl() { return new URL("https://api.example.test/product"); } const helper = {}; helper.routeFactory = makeUrl; helper.routeFactory().searchParams.set("id", sku); }', false],
  ['route factory member alias string fixture stays safe', 'function makeUrl() { return new URL(location.href); } const helper = {}; const marker = "helper.routeFactory = makeUrl"; helper.routeFactory = () => new URL("https://api.example.test/product"); helper.routeFactory().searchParams.set("id", sku);', false],
  ['cross-file imported external URL object and bound helper mutator context', 'import { endpoint } from "./config.js"; const helper = { mutate(url) { url.searchParams.set("id", sku); return url.href; } }; function mutate(url) { url.searchParams.set("id", sku); return url.href; } const bound = mutate.bind(null); helper.mutate(new URL(endpoint)); bound(new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL second-arg and bound helper mutator context', 'import { endpoint } from "./config.js"; function mutate(ctx, url) { url.searchParams.set("id", sku); return url.href; } const bound = mutate.bind(null, "ctx"); mutate("ctx", new URL(endpoint)); bound(new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL optional helper mutator context', 'import { endpoint } from "./config.js"; function mutate(url) { url.searchParams.set("id", sku); return url.href; } mutate?.(new URL(endpoint)); mutate["call"](null, new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-scope helper mutator name does not leak', 'function setup() { function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } function route() { function mutate(url) { return url.href; } return mutate(new URL(location.href)); }', false],
  ['nested helper mutator shadow does not leak', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } }; if (ok) { function mutate(url) { return url.href; } const helper = { mutate(url) { return url.href; } }; mutate(new URL(location.href)); helper.mutate(new URL(location.href)); }', false],
  ['nested shorthand helper mutator shadow does not leak', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } function route() { function mutate(url) { return url.href; } const helper = { mutate }; return helper.mutate(new URL(location.href)); }', false],
  ['nested member assignment helper mutator shadow does not leak', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } function route() { function mutate(url) { return url.href; } helper.routeMutator = mutate; return helper.routeMutator(new URL(location.href)); }', false],
  ['destructured member helper mutator shadow does not leak', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate }; function route() { const helper = { mutate: (url) => url.href }; const { mutate: routeMutator } = helper; return routeMutator(new URL(location.href)); }', false],
  ['simple helper name does not reject safe object method', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate(url) { return url.href; } }; return helper.mutate(new URL(location.href));', false],
  ['spaced helper name does not reject safe object method', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate(url) { return url.href; } }; return helper . mutate(new URL(location.href)) || helper ?. mutate(new URL(location.href));', false],
  ['nested object mutator does not reject safe root method', 'const helper = { routes: { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } }, mutate(url) { return url.href; } }; return helper.mutate(new URL(location.href));', false],
  ['nested object mutator after regex marker rejects route method', 'const helper = { marker: /{/, routes: { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } }; return helper.routes.mutate(new URL(location.href));', true],
  ['wrapped nested object mutator after regex marker rejects route method', 'export function route() { const helper = { marker: /{/, routes: { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } }; return helper.routes.mutate(new URL(location.href)); }', true, { path: 'modules/interactions.js', files: [{ path: 'modules/interactions.js', source: 'export function route() { const helper = { marker: /{/, routes: { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } }; return helper.routes.mutate(new URL(location.href)); }' }] }],
  ['semicolonless expression arrow does not shadow later external route', 'import { endpoint } from "./config.js"; const helper = endpoint => endpoint\nconst url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL relative concat with base context', 'import { endpoint } from "./config.js"; const url = new URL("?id=" + sku, endpoint); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file unrelated import does not allow alias', 'import { endpoint } from "./internal.js"; const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }, { path: 'modules/internal.js', source: 'export const endpoint = location.href;' }] }],
  ['cross-file imported route key alias', 'import { key } from "./config.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }],
  ['cross-file barrel route key alias', 'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }, { path: 'modules/barrel.js', source: 'export { key } from "./config.js";' }] }],
  ['cross-file local-export barrel route key alias', 'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }, { path: 'modules/barrel.js', source: 'import { key } from "./config.js"; export { key };' }] }],
  ['cross-file star barrel route key alias', 'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }, { path: 'modules/barrel.js', source: 'export * from "./config.js";' }] }],
  ['cross-file imported route key with unrelated shadow', 'import { key } from "./config.js"; function unrelated(key) { return key; } const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }]
].forEach(([label, source, expected, contextSource]) => {
  const actual = containsForbiddenV4RouteConstruction(source, contextSource || source)
    || containsForbiddenV4RouteConstructionAst(source, contextSource || source);
  if (actual !== expected) fail(`v4 route guard self-check failed for ${label}`);
});

[
  ['AST URLSearchParams constructor alias route builder', 'const Params = window.URLSearchParams; const params = new Params({ id: post.location }); return "?" + params;', true],
  ['AST URL constructor alias route mutation', 'const Url = window.URL; const url = new Url(location.href); url.searchParams.set("id", post.location); return url.href;', true],
  ['AST bound searchParams mutator alias', 'const url = new URL(location.href); const set = url.searchParams.set.bind(url.searchParams); set("id", post.location); return url.href;', true],
  ['AST destructured searchParams mutator call alias', 'const url = new URL(location.href); const { set } = url.searchParams; set.call(url.searchParams, "id", post.location); return url.href;', true],
  ['AST bound searchParams mutator apply alias', 'const url = new URL(location.href); const set = url.searchParams.set.bind(url.searchParams); set.apply(null, ["id", post.location]); return url.href;', true],
  ['AST generic search sink route params', 'const params = new URLSearchParams({ id: post.location }); link.search = params;', true],
  ['AST computed property aliases route mutation', 'const prop = "searchParams"; const method = "set"; const url = new URL(location.href); url[prop][method]("id", post.location); return url.href;', true],
  ['AST object member computed property aliases route mutation', 'const keys = { sp: "searchParams", method: "set" }; const url = new URL(location.href); url[keys.sp][keys.method]("id", post.location); return url.href;', true],
  ['AST reassigned computed property aliases route mutation', 'let prop; prop = "searchParams"; let method; method = "set"; const url = new URL(location.href); url[prop][method]("id", post.location); return url.href;', true],
  ['AST Object.assign computed property aliases route mutation', 'const keys = {}; Object.assign(keys, { sp: "searchParams", method: "set" }); const url = new URL(location.href); url[keys.sp][keys.method]("id", post.location); return url.href;', true],
  ['AST Reflect.set computed property alias route mutation', 'const keys = {}; Reflect.set(keys, "method", "set"); const url = new URL(location.href); url.searchParams[keys.method]("id", post.location); return url.href;', true],
  ['AST string alias shadowed by parameter stays safe', 'const method = "set"; export function route(method, post) { const url = new URL(location.href); url.searchParams[method]("id", post.location); return url.href; }', false],
  ['AST string alias reassignment shadow stays safe', 'let method = "set"; method = getMethod(); const url = new URL(location.href); url.searchParams[method]("id", post.location); return url.href;', false],
  ['AST constructor argument public route literal', 'return new Request("?id=post.md");', true],
  ['AST concise arrow public route builder', 'const href = post => "?id=" + post.location; link.setAttribute("href", href(post));', true],
  ['AST template route value public href', 'return `?id=${post.location}`;', true],
  ['AST template tab value public href', 'return `?tab=${slug}&page=2`;', true],
  ['AST template final quasi public href', 'return `${base}?id=post.md`;', true],
  ['AST external literal template route query stays allowed', 'return `https://api.example.test/product?id=${sku}`;', false],
  ['AST external interpolated host template route query stays allowed', 'return `https://${host}/products?id=${sku}`;', false],
  ['AST external interpolated path template route query stays allowed', 'return `https://example.test/${path}?id=${sku}`;', false],
  ['AST current-location URL ignores external base', 'const externalBase = "https://api.example.test/product"; return new URL(location.href + "?id=" + post.location, externalBase).href;', true],
  ['AST external base relative query stays allowed', 'const externalBase = "https://api.example.test/product"; return new URL("?id=" + sku, externalBase).href;', false],
  ['AST aliased URL constructor external search stays allowed', 'const Url = window.URL; const external = new Url("https://api.example.test/product"); external.search = "?id=" + sku; return external.href;', false],
  ['AST aliased URL constructor route factory is rejected', 'const Url = window.URL; function makeUrl() { return new Url(location.href); } makeUrl().searchParams.set("id", post.location);', true],
  ['AST computed route URL storage alias is rejected', 'const prop = "url"; state[prop] = new URL(location.href); state.url.searchParams.set("id", post.location);', true],
  ['AST computed searchParams storage alias is rejected', 'const prop = "params"; const url = new URL(location.href); state[prop] = url.searchParams; state[prop].set("id", post.location);', true],
  ['AST computed route query storage alias is rejected', 'const keys = { p: "params" }; state[keys.p] = new URLSearchParams({ id: post.location }); link.search = state[keys.p];', true],
  ['AST helper mutates route URL route key', 'function mutate(url) { url.searchParams.set("id", post.location); } mutate(new URL(location.href));', true],
  ['AST arrow helper mutates route URL route key', 'const mutate = (url) => { url.searchParams.set("id", post.location); }; mutate(new URL(location.href));', true],
  ['AST helper mutates aliased route URL route key', 'function mutate(url) { url.searchParams.set("id", post.location); } const routeUrl = new URL(location.href); mutate(routeUrl);', true],
  ['AST helper mutates route URL searchParams alias route key', 'function mutate(url) { const params = url.searchParams; params.set("id", post.location); } mutate(new URL(location.href));', true],
  ['AST helper mutates route URL destructured searchParams route key', 'function mutate(url) { const { searchParams: params } = url; params.set("id", post.location); } mutate(new URL(location.href));', true],
  ['AST helper mutates route URL destructured mutator route key', 'function mutate(url) { const { set } = url.searchParams; set.call(url.searchParams, "id", post.location); } mutate(new URL(location.href));', true],
  ['AST helper mutates route URL bound mutator route key', 'function mutate(url) { const set = url.searchParams.set.bind(url.searchParams); set("id", post.location); } mutate(new URL(location.href));', true],
  ['AST bound helper mutates route URL route key', 'function mutate(url) { url.searchParams.set("id", post.location); } const bound = mutate.bind(null, new URL(location.href)); bound();', true],
  ['AST Object.assign helper mutates route URL route key', 'const helpers = {}; Object.assign(helpers, { mutate(url) { url.searchParams.set("id", post.location); } }); helpers.mutate(new URL(location.href));', true],
  ['AST Reflect.set helper mutates route URL route key', 'const helpers = {}; Reflect.set(helpers, "mutate", function(url) { url.searchParams.set("id", post.location); }); helpers.mutate(new URL(location.href));', true],
  ['AST helper mutates external URL route key stays allowed', 'function mutate(url) { url.searchParams.set("id", sku); } mutate(new URL("https://api.example.test/product"));', false],
  ['AST bound helper mutates external URL route key stays allowed', 'function mutate(url) { url.searchParams.set("id", sku); } const bound = mutate.bind(null, new URL("https://api.example.test/product")); bound();', false],
  ['AST helper non-route key stays allowed', 'function mutate(url) { url.searchParams.set("slug", post.location); } mutate(new URL(location.href));', false],
  ['AST external member concat query stays allowed', 'const endpoints = { product: "https://api.example.test/product" }; return endpoints.product + "?foo=1" + "&id=" + sku;', false],
  ['AST route query helper public href', 'function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); } const href = "?" + query(post);', true],
  ['AST route query helper alias public href', 'function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); } const build = query; const href = "?" + build(post);', true],
  ['AST route query helper object alias public href', 'function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); } const helpers = { query }; const href = "?" + helpers.query(post);', true],
  ['AST route query helper local route key alias public href', 'function query(post) { const routeKey = "id"; const params = new URLSearchParams(); params.set(routeKey, post.location); return params.toString(); } const href = "?" + query(post);', true],
  ['AST route query helper local member route key alias public href', 'function query(post) { const keys = { post: "id" }; const params = new URLSearchParams(); params.set(keys.post, post.location); return params.toString(); } const href = "?" + query(post);', true],
  ['AST route query helper local equals alias public href', 'function query(post) { const eq = "="; return "id" + eq + post.location; } const href = "?" + query(post);', true],
  ['AST route query helper non-route key stays allowed', 'function query(post) { const params = new URLSearchParams(); params.set("slug", post.location); return params.toString(); } const href = "?" + query(post);', false],
  ['AST route query helper nested local route key alias does not leak', 'function query(post) { function nested() { const routeKey = "id"; return routeKey; } const params = new URLSearchParams(); params.set("slug", post.location); return params.toString(); } const href = "?" + query(post);', false],
  ['AST imported external base relative query stays allowed', 'import { endpoint } from "./config.js"; return new URL("?id=" + sku, endpoint).href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['AST imported external template route query stays allowed', 'import { endpoint } from "./config.js"; return `${endpoint}?id=${sku}`;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['AST imported aliased URL constructor external query stays allowed', 'import { endpoint } from "./config.js"; return new URL("?id=" + sku, endpoint).href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'const Url = window.URL; export const endpoint = new Url("https://api.example.test/product");' }] }],
  ['AST imported aliased URL constructor route factory is rejected', 'import { makeUrl } from "./url.js"; makeUrl().searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'const Url = window.URL; export function makeUrl() { return new Url(location.href); }' }] }],
  ['AST imported helper mutates route URL route key', 'import { mutate } from "./url.js"; mutate(new URL(location.href));', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function mutate(url) { url.searchParams.set("id", post.location); }' }] }],
  ['AST imported route query helper public href', 'import { query } from "./url.js"; const href = "?" + query(post);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }' }] }],
  ['AST imported wrapped route query helper public href', 'import { query } from "./url.js"; const href = "?" + query(post);', true, { path: 'modules/layout.js', files: [{ path: 'modules/base.js', source: 'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }' }, { path: 'modules/url.js', source: 'import { makeQuery } from "./base.js"; export function query(post) { return makeQuery(post); }' }] }],
  ['AST imported wrapped route query helper local shadow stays allowed', 'import { query } from "./url.js"; const href = "?" + query(post);', false, { path: 'modules/layout.js', files: [{ path: 'modules/base.js', source: 'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }' }, { path: 'modules/url.js', source: 'import { makeQuery } from "./base.js"; export function query(post) { const makeQuery = (post) => "slug=" + post.slug; return makeQuery(post); }' }] }],
  ['AST imported default object route query helper public href', 'import theme from "./theme.js"; const href = "?" + theme.query(post);', true, { path: 'modules/layout.js', files: [{ path: 'modules/base.js', source: 'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }' }, { path: 'modules/theme.js', source: 'import { makeQuery } from "./base.js"; export default { query: makeQuery };' }] }],
  ['AST CommonJS route query helper public href', 'const { query } = require("./url.js"); const href = "?" + query(post);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'exports.query = function(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); };' }] }],
  ['AST imported helper mutates external URL route key stays allowed', 'import { mutate } from "./url.js"; mutate(new URL("https://api.example.test/product"));', false, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function mutate(url) { url.searchParams.set("id", sku); }' }] }],
  ['AST stale imported helper mutator reassignment stays safe', 'import { mutate } from "./url.js"; mutate(new URL(location.href));', false, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export let mutate = function(url) { url.searchParams.set("id", post.location); }; mutate = function(url) { return url.href; };' }] }],
  ['AST destructured CommonJS helper mutates route URL route key', 'const { mutate } = require("./url.js"); mutate(new URL(location.href));', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'exports.mutate = function(url) { url.searchParams.set("id", post.location); };' }] }],
  ['AST stale destructured CommonJS helper reassignment stays safe', 'const { mutate } = require("./url.js"); mutate(new URL(location.href));', false, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'exports.mutate = function(url) { url.searchParams.set("id", post.location); }; exports.mutate = function(url) { return url.href; };' }] }],
  ['AST stale module.exports CommonJS helper reassignment stays safe', 'const { mutate } = require("./url.js"); mutate(new URL(location.href));', false, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'module.exports.mutate = function(url) { url.searchParams.set("id", post.location); }; module.exports.mutate = function(url) { return url.href; };' }] }],
  ['AST stale module.exports require replacement stays safe', 'const { mutate } = require("./url.js"); mutate(new URL(location.href));', false, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'exports.mutate = function(url) { url.searchParams.set("id", post.location); }; module.exports = require("./safe.js");' }, { path: 'modules/safe.js', source: 'exports.mutate = function(url) { return url.href; };' }] }],
  ['AST imported URL constructor alias route mutation is rejected', 'import { Url } from "./ctor.js"; const url = new Url(location.href); url.searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/ctor.js', source: 'export const Url = window.URL;' }] }],
  ['AST imported URLSearchParams constructor alias route query is rejected', 'import { Params } from "./ctor.js"; const params = new Params({ id: post.location }); return "?" + params;', true, { path: 'modules/layout.js', files: [{ path: 'modules/ctor.js', source: 'export const Params = window.URLSearchParams;' }] }],
  ['AST assigned URL constructor alias route mutation is rejected', 'let Url; Url = window.URL; const url = new Url(location.href); url.searchParams.set("id", post.location);', true],
  ['AST object member URL constructor alias route mutation is rejected', 'const Ctors = { Url: window.URL }; const url = new Ctors.Url(location.href); url.searchParams.set("id", post.location);', true],
  ['AST object member URLSearchParams constructor alias route query is rejected', 'const Ctors = { Params: window.URLSearchParams }; const params = new Ctors.Params({ id: post.location }); return "?" + params;', true],
  ['AST root shadowed constructor member stays safe', 'const Ctors = { Url: window.URL }; function route() { const Ctors = { Url: ExternalUrl }; return new Ctors.Url(location.href).href; } route();', false],
  ['AST stale external member reassignment is rejected', 'const endpoints = { product: "https://api.example.test/product" }; endpoints.product = getPath(); return endpoints.product + "?id=" + post.location;', true],
  ['AST route factory constructor parameter shadow stays safe', 'function setup() { const Url = window.URL; } function makeUrl(Url) { return new Url(location.href); } makeUrl(ExternalUrl).searchParams.set("id", post.location);', false],
  ['AST sibling constructor alias shadow stays safe', 'function setup() { const Url = window.URL; void Url; } function makeUrl() { return new Url(location.href); } makeUrl().searchParams.set("id", post.location);', false],
  ['AST exported destructured URL constructor route factory is rejected', 'import { makeUrl } from "./url.js"; makeUrl().searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'const { URL: Url } = window; export function makeUrl() { return new Url(location.href); }' }] }],
  ['AST exported assigned URL constructor route factory is rejected', 'import { makeUrl } from "./url.js"; makeUrl().searchParams.set("id", post.location);', true, { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'let Url; Url = window.URL; export function makeUrl() { return new Url(location.href); }' }] }],
  ['AST exported computed URL constructor external query stays allowed', 'import { endpoint } from "./config.js"; return new URL("?id=" + sku, endpoint).href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'const key = "URL"; const { [key]: Url } = window; export const endpoint = new Url("https://api.example.test/product");' }] }],
  ['AST unknown function search assignment stays safe', 'function route() { function makeUrl() { return new URL(location.href); } function inner() { function makeUrl() { return new URL("https://api.example.test/product"); } makeUrl().search = "id=" + sku; } return inner; }', false]
].forEach(([label, source, expected, contextSource]) => {
  const actual = containsForbiddenV4RouteConstructionAst(source, contextSource || source);
  if (actual !== expected) fail(`v4 AST route guard self-check failed for ${label}`);
  const packagedActual = containsForbiddenV4RouteConstructionExport(source, contextSource || source);
  if (packagedActual !== expected) fail(`v4 packaged route guard self-check failed for ${label}`);
});

function sourceMentionsRegion(source, key) {
  const escaped = escapeRe(key);
  return new RegExp(`\\b${escaped}\\b`).test(source);
}

function declaredViewHandler(viewDecl = {}) {
  const module = typeof viewDecl.module === 'string' ? viewDecl.module.trim() : '';
  const handler = typeof viewDecl.handler === 'string' ? viewDecl.handler.trim() : '';
  return { module, handler };
}

function collectFiles(dir) {
  const out = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (entry.isFile()) out.push(full);
  });
  return out;
}

function collectThemeRouteGuardFiles(themeDir) {
  return collectFiles(themeDir)
    .map((file) => ({
      path: path.relative(themeDir, file).replace(/\\/g, '/'),
      source: read(file)
    }))
    .filter((file) => file.path !== 'theme.json' && THEME_ROUTE_GUARD_TEXT_EXTENSIONS.has(path.extname(file.path).toLowerCase()));
}

const schema = readJson(schemaPath);
if (!schema) fail('assets/schema/theme.json must be readable');

const componentSource = read(path.join(root, 'assets', 'js', 'components.js'));
const themeRegionsSource = read(path.join(root, 'assets', 'js', 'theme-regions.js'));
const themeLayoutSource = read(path.join(root, 'assets', 'js', 'theme-layout.js'));
const themeManagerSource = read(path.join(root, 'assets', 'js', 'theme-manager.js'));
const themePackageCoreSource = read(path.join(root, 'assets', 'js', 'theme-package-core.js'));
const mainSource = read(path.join(root, 'assets', 'main.js'));
const editorPreviewRuntimeSource = read(path.join(root, 'assets', 'js', 'editor-preview-runtime.js'));
const contentModelSource = read(path.join(root, 'assets', 'js', 'content-model.js'));
const themeContractSource = read(path.join(root, 'wwwroot', 'post', 'theme-contract', 'theme-contract_en.md'));

if (PRESS_THEME_CONTRACT.schemaVersion !== 1 || PRESS_THEME_CONTRACT.type !== 'press-theme-contract') {
  fail('assets/js/theme-contract-surface.mjs must declare the press-theme-contract surface');
}
if (PRESS_THEME_CONTRACT.contractVersion !== 4) {
  fail('assets/js/theme-contract-surface.mjs must declare contractVersion 4 as the current theme contract');
}
if (JSON.stringify(PRESS_THEME_CONTRACT.supportedContractVersions) !== JSON.stringify([4])) {
  fail('the v4 cleanup release must support only theme contract version 4');
}
if (PRESS_THEME_CONTRACT.manifestSchemaPath !== 'assets/schema/theme.json') {
  fail('theme contract surface must point at assets/schema/theme.json');
}
if (JSON.stringify(schema.properties && schema.properties.contractVersion && schema.properties.contractVersion.enum) !== JSON.stringify(PRESS_THEME_CONTRACT.supportedContractVersions)) {
  fail('assets/schema/theme.json supported contract versions must match the shared theme contract surface');
}
if (JSON.stringify(schema.required || []) !== JSON.stringify(REQUIRED_MANIFEST_FIELDS)) {
  fail('assets/schema/theme.json required fields must match the shared theme contract surface');
}
if (JSON.stringify(PRESS_THEME_CONTRACT.manifest.defaultStyles || []) !== JSON.stringify(DEFAULT_THEME_STYLES)) {
  fail('theme contract surface default styles helper must match the declared manifest default styles');
}
const schemaRequiredViews = schema.properties && schema.properties.views && schema.properties.views.required;
if (JSON.stringify(schemaRequiredViews || []) !== JSON.stringify(getRequiredThemeViews())) {
  fail('assets/schema/theme.json required views must match the shared theme contract surface');
}
const schemaContentShapes = schema.$defs && schema.$defs.contentShapeList && schema.$defs.contentShapeList.items && schema.$defs.contentShapeList.items.enum;
if (JSON.stringify(schemaContentShapes || []) !== JSON.stringify(REQUIRED_CONTENT_SHAPES)) {
  fail('assets/schema/theme.json content shape enum must match the shared theme contract surface');
}
const schemaThemeConfigProperty = schema.properties
  && schema.properties.configSchema
  && schema.properties.configSchema.properties
  && schema.properties.configSchema.properties.properties
  && schema.properties.configSchema.properties.properties.additionalProperties;
if (!schemaThemeConfigProperty || schemaThemeConfigProperty.type !== 'object' || schemaThemeConfigProperty.additionalProperties !== true) {
  fail('assets/schema/theme.json configSchema properties must allow nested non-Press object schemas');
}
const schemaThemeConfigAdditionalProperties = schema.properties
  && schema.properties.configSchema
  && schema.properties.configSchema.properties
  && schema.properties.configSchema.properties.additionalProperties;
const schemaThemeConfigAdditionalPropertiesAllowsSchemas = schemaThemeConfigAdditionalProperties
  && Array.isArray(schemaThemeConfigAdditionalProperties.oneOf)
  && schemaThemeConfigAdditionalProperties.oneOf.some(entry => entry && entry.type === 'boolean')
  && schemaThemeConfigAdditionalProperties.oneOf.some(entry => entry && entry.type === 'object' && entry.additionalProperties === true);
if (!schemaThemeConfigAdditionalPropertiesAllowsSchemas) {
  fail('assets/schema/theme.json configSchema.additionalProperties must allow boolean values and schema object values');
}
if (!themeLayoutSource.includes('theme-contract-surface.mjs') || !themePackageCoreSource.includes('theme-contract-surface.mjs')) {
  fail('theme runtime and Theme Manager package core must import the shared theme contract surface');
}
if (!themeManagerSource.includes('theme-package-core.js')) {
  fail('Theme Manager must consume theme contract rules through the shared package core');
}
if (!themeLayoutSource.includes('getDefaultThemeStyles') || !themePackageCoreSource.includes('getDefaultThemeStyles')) {
  fail('theme runtime and Theme Manager package core must read default theme styles from the shared theme contract surface');
}

REQUIRED_COMPONENTS.forEach((component) => {
  const localName = component.replace(/^press-/, '');
  const className = `Press${localName.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')}`;
  if (!componentSource.includes(`defineElement('${component}'`) || !componentSource.includes(`class ${className}`)) {
    fail(`assets/js/components.js must define shared component ${component}`);
  }
});

['createThemeRegionRegistry', 'registerMany', 'value(name)'].forEach((needle) => {
  if (!themeRegionsSource.includes(needle)) {
    fail(`assets/js/theme-regions.js must expose region registry support for ${needle}`);
  }
});

['getThemeApiHandler', 'EFFECT_VIEW_NAMES', 'applyManifestStyles'].forEach((needle) => {
  if (!themeLayoutSource.includes(needle)) {
    fail(`assets/js/theme-layout.js must expose theme API support for ${needle}`);
  }
});
['createThemeI18nContext', 'switchLanguage', 'ensureLanguageBundle', 'getAvailableLangs', 'getPublicLangs', 'getPublicLanguageOptions', 'getLanguageLabel'].forEach((needle) => {
  if (!themeLayoutSource.includes(needle)) {
    fail(`assets/js/theme-layout.js must expose theme i18n context support for ${needle}`);
  }
});
if (!/const direct = \([\s\S]*asObject\(mod\.effects\)[\s\S]*\) \? mod : null;/.test(themeLayoutSource)) {
  fail('assets/js/theme-layout.js must merge pure API objects returned from mount(ctx)');
}
if (!/i18n:\s*createThemeI18nContext\(\)/.test(themeLayoutSource)) {
  fail('assets/js/theme-layout.js must inject ctx.i18n into theme mount context');
}
if (!/const runtimeOptions = themeLayoutState\.latestLayoutOptions \|\| options;[\s\S]*router:\s*runtimeOptions\.router \|\| null/.test(themeLayoutSource)) {
  fail('assets/js/theme-layout.js must inject ctx.router into theme mount context');
}

['createContentModel', 'blocks', 'tocTree', 'headings', 'assets', 'links'].forEach((needle) => {
  if (!contentModelSource.includes(needle)) {
    fail(`assets/js/content-model.js must provide content model field ${needle}`);
  }
});

if (!mainSource.includes('getThemeApiHandler')) {
  fail('assets/main.js must route theme calls through getThemeApiHandler');
}
if (!/i18n:\s*createThemeI18nContext\(\)/.test(mainSource)) {
  fail('assets/main.js must pass the standard ctx.i18n shape to theme view handlers');
}
[
  ['getHomeSlug', /function createThemeRouterContext\(\)[\s\S]*getHomeSlug:\s*\(\)\s*=>\s*getHomeSlug\(\)/],
  ['getHomeLabel', /function createThemeRouterContext\(\)[\s\S]*getHomeLabel:\s*\(\)\s*=>\s*getHomeLabel\(\)/],
  ['postsEnabled', /function createThemeRouterContext\(\)[\s\S]*postsEnabled:\s*\(\)\s*=>\s*postsEnabled\(\)/],
  ['searchEnabled', /function createThemeRouterContext\(\)[\s\S]*searchEnabled:\s*\(\)\s*=>\s*searchEnabled\(\)/],
  ['getHomeHref', /function createThemeRouterContext\(\)[\s\S]*getHomeHref/],
  ['getTabHref', /function createThemeRouterContext\(\)[\s\S]*getTabHref/],
  ['getPostHref', /function createThemeRouterContext\(\)[\s\S]*getPostHref/],
  ['getPostsHref', /function createThemeRouterContext\(\)[\s\S]*getPostsHref/],
  ['getSearchHref', /function createThemeRouterContext\(\)[\s\S]*getSearchHref/],
  ['withLangParam', /function createThemeRouterContext\(\)[\s\S]*withLangParam/]
].forEach(([name, re]) => {
  if (!re.test(mainSource)) fail(`assets/main.js must expose ctx.router.${name} for contract v4 themes`);
});
if (!/router:\s*createThemeRouterContext\(\)/.test(mainSource)) {
  fail('assets/main.js createThemeRuntimeContext must use the shared v4 router helper context');
}
if (!/function renderSiteIdentity[\s\S]*\bctx,?[\s\S]*getHomeSlug:\s*\(\)\s*=>\s*getHomeSlug\(\)[\s\S]*postsEnabled:\s*\(\)\s*=>\s*postsEnabled\(\)[\s\S]*searchEnabled:\s*\(\)\s*=>\s*searchEnabled\(\)/.test(mainSource)) {
  fail('assets/main.js renderSiteIdentity must pass v3 home/posts/search helpers to theme effects');
}
[
  ['getHomeSlug', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getHomeSlug:\s*\(\)\s*=>\s*getPreviewHomeSlug\(payload,\s*features\)/],
  ['getHomeLabel', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getHomeLabel:\s*\(\)\s*=>\s*getPreviewHomeLabel\(payload,\s*features\)/],
  ['postsEnabled', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*postsEnabled:\s*\(\)\s*=>\s*previewPostsEnabled\(features\)/],
  ['searchEnabled', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*searchEnabled:\s*\(\)\s*=>\s*previewSearchEnabled\(features\)/],
  ['getHomeHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getHomeHref/],
  ['getTabHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getTabHref/],
  ['getPostHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getPostHref/],
  ['getPostsHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getPostsHref/],
  ['getSearchHref', /function createPreviewRouterContext\(payload,\s*features\)[\s\S]*getSearchHref/]
].forEach(([name, re]) => {
  if (!re.test(editorPreviewRuntimeSource)) fail(`assets/js/editor-preview-runtime.js must expose ctx.router.${name} for contract v4 themes`);
});
if (!/renderPostView[\s\S]*content,[\s\S]*rawMarkdown/.test(mainSource)) {
  fail('assets/main.js must pass the structured content model into post view rendering');
}
if (!/parseFrontMatter/.test(mainSource) || !/frontMatterMetadata[\s\S]*postMetadata\s*=\s*\{[\s\S]*\.\.\.frontMatterMetadata[\s\S]*location:\s*postname/.test(mainSource)) {
  fail('assets/main.js must merge the current post front matter into legacy post metadata before theme rendering');
}
if (!/renderStaticTabView[\s\S]*content,[\s\S]*rawMarkdown/.test(mainSource)) {
  fail('assets/main.js must pass the structured content model into tab view rendering');
}

CORE_RUNTIME_FILES.forEach((file) => {
  const source = read(path.join(root, file));
  FORMER_DOM_IDS.forEach((id) => {
    const directId = new RegExp(`getElementById\\(\\s*['"]${escapeRe(id)}['"]\\s*\\)`);
    const directSelector = new RegExp(`querySelector(?:All)?\\(\\s*['"]#[^'"]*${escapeRe(id)}`);
    if (directId.test(source) || directSelector.test(source)) {
      fail(`${file} directly depends on legacy DOM id "${id}" instead of the region registry`);
    }
  });
});

['contractVersion', 'engines', 'press', 'regions', 'views', 'components', 'scrollContainer', 'configSchema', 'content', 'shapes', 'handler'].forEach((needle) => {
  if (!themeContractSource.includes(needle)) {
    fail(`wwwroot/post/theme-contract/theme-contract_en.md must document manifest field ${needle}`);
  }
});

[
  path.join(root, 'assets', 'js'),
  path.join(root, 'assets', 'themes'),
  path.join(root, 'assets', 'schema'),
  path.join(root, 'wwwroot', 'post', 'theme-contract'),
  path.join(root, 'scripts')
].flatMap((dir) => collectFiles(dir))
  .concat([path.join(root, 'index.html'), path.join(root, 'index_editor.html')])
  .filter((file) => path.basename(file) !== 'test-theme-contracts.js')
  .forEach((file) => {
    const source = read(file);
    FORBIDDEN_SOURCE_PATTERNS.forEach(({ label, re }) => {
      if (re.test(source)) fail(`${rel(file)} contains removed theme compatibility residue: ${label}`);
    });
  });

const themeNames = fs.readdirSync(themesDir)
  .filter((name) => fs.statSync(path.join(themesDir, name)).isDirectory())
  .sort();

themeNames.forEach((themeName) => {
  const themeDir = path.join(themesDir, themeName);
  const manifestPath = path.join(themeDir, 'theme.json');
  const relManifest = rel(manifestPath);
  const manifest = readJson(manifestPath);
  if (!manifest) return;

  if (manifest.$schema !== '../../schema/theme.json') {
    fail(`${relManifest} must declare "$schema": "../../schema/theme.json"`);
  }
  if (!manifest.name) fail(`${relManifest} must declare name`);
  if (!manifest.version) fail(`${relManifest} must declare version`);
  if (!PRESS_THEME_CONTRACT.supportedContractVersions.includes(manifest.contractVersion)) {
    fail(`${relManifest} contractVersion must be supported by the shared theme contract surface`);
  }
  if (!manifest.engines || typeof manifest.engines.press !== 'string' || !manifest.engines.press.trim()) {
    fail(`${relManifest} must declare engines.press`);
  }

  const styles = requireList(manifest, 'styles', 'styles', relManifest);
  let styleSource = '';
  styles.forEach((entry) => {
    if (!modulePathIsSafe(entry, '.css')) {
      fail(`${relManifest} has unsafe style path "${entry}"`);
      return;
    }
    const stylePath = path.join(themeDir, entry);
    if (!fs.existsSync(stylePath)) {
      fail(`${relManifest} references missing style "${entry}"`);
      return;
    }
    styleSource += `\n${read(stylePath)}`;
  });
  if (themeName === 'native') {
    const basePath = path.join(themeDir, 'base.css');
    if (fs.existsSync(basePath)) styleSource += `\n${read(basePath)}`;
  }
  REQUIRED_STYLE_TOKENS.forEach((token) => {
    if (!styleSource.includes(token)) fail(`${relManifest} styles must expose ${token}`);
  });

  const modules = requireList(manifest, 'modules', 'modules', relManifest);
  if (!modules.length) fail(`${relManifest} modules must not be empty`);
  modules.forEach((entry) => {
    if (!modulePathIsSafe(entry, '.js')) {
      fail(`${relManifest} has unsafe module path "${entry}"`);
      return;
    }
    if (!fs.existsSync(path.join(themeDir, entry))) {
      fail(`${relManifest} references missing module "${entry}"`);
    }
  });

  const moduleSource = modules
    .map((entry) => {
      const modulePath = path.join(themeDir, entry);
      return fs.existsSync(modulePath) ? read(modulePath) : '';
    })
    .join('\n');
  if (
    /from\s+['"][^'"]*js\/i18n\.js(?:\?[^'"]*)?['"]/.test(moduleSource)
    || /import\s*\([^)]*js\/i18n\.js/.test(moduleSource)
  ) {
    fail(`${relManifest} theme modules must read i18n from ctx.i18n instead of importing js/i18n.js directly`);
  }
  if (Number(manifest.contractVersion) >= 4) {
    const routeGuardFiles = collectThemeRouteGuardFiles(themeDir);
    routeGuardFiles.forEach((file) => {
      const routeContext = { path: file.path, files: routeGuardFiles };
      if (containsForbiddenV4RouteConstructionExport(file.source, routeContext)) {
        fail(`${relManifest} contract v4 theme source must use ctx.router href helpers instead of public route construction in ${file.path}`);
      }
    });
  }
  FORMER_DOM_IDS.forEach((id) => {
    const directId = new RegExp(`getElementById\\(\\s*['"]${escapeRe(id)}['"]\\s*\\)`);
    const directSelector = new RegExp(`querySelector(?:All)?\\(\\s*['"]#[^'"]*${escapeRe(id)}`);
    if (directId.test(moduleSource) || directSelector.test(moduleSource)) {
      fail(`${relManifest} theme modules must not query removed DOM id "${id}"`);
    }
  });
  if (Object.prototype.hasOwnProperty.call(manifest, 'contract')) {
    fail(`${relManifest} must omit removed compatibility contract`);
  }
  if (!/return\s*\{[\s\S]*(views|effects)[\s\S]*components/.test(moduleSource)) {
    fail(`${relManifest} modules must return an explicit theme API object with views/effects and components`);
  }
  if (!/export\s+default\s+\{[\s\S]*mount[\s\S]*views[\s\S]*components[\s\S]*effects/.test(moduleSource)) {
    fail(`${relManifest} modules must export a default theme API object`);
  }

  const views = requireObject(manifest.views, 'views', relManifest);
  REQUIRED_VIEWS.forEach((view) => {
    if (!asObject(views[view])) fail(`${relManifest} views must include "${view}"`);
  });

  const regions = requireObject(manifest.regions, 'regions', relManifest);
  REQUIRED_REGIONS.forEach((region) => {
    const declaration = asObject(regions[region]);
    if (!declaration) {
      fail(`${relManifest} regions must include "${region}"`);
      return;
    }
    const aliases = Array.isArray(declaration.aliases) ? declaration.aliases.map(String) : [];
    const candidates = [region, ...aliases];
    if (!candidates.some((candidate) => sourceMentionsRegion(moduleSource, candidate))) {
      fail(`${relManifest} declares region "${region}" but no module source mentions it or its aliases`);
    }
  });

  const components = requireList(manifest, 'components', 'components', relManifest);
  REQUIRED_COMPONENTS.forEach((component) => {
    if (!components.includes(component)) {
      fail(`${relManifest} components must include "${component}"`);
    }
  });

  if (!Object.prototype.hasOwnProperty.call(manifest, 'scrollContainer')) {
    fail(`${relManifest} must declare scrollContainer`);
  }
  requireObject(manifest.configSchema, 'configSchema', relManifest);
  try {
    validateThemeConfigSchema(manifest.configSchema);
  } catch (err) {
    fail(`${relManifest} configSchema contains unsupported theme setting metadata: ${err && err.message ? err.message : err}`);
  }
  const content = requireObject(manifest.content, 'content', relManifest);
  const shapes = requireList(content, 'shapes', 'content.shapes', relManifest);
  REQUIRED_CONTENT_SHAPES.forEach((shape) => {
    if (!shapes.includes(shape)) fail(`${relManifest} content.shapes must include "${shape}"`);
  });

  Object.entries(views).forEach(([view, declaration]) => {
    const declared = declaredViewHandler(declaration);
    if (!declared.module || !declared.handler) {
      fail(`${relManifest} views.${view} must declare module and handler`);
    }
    if (Object.prototype.hasOwnProperty.call(declaration, 'hook') || Object.prototype.hasOwnProperty.call(declaration, 'hooks')) {
      fail(`${relManifest} views.${view} must use module/handler, not removed adapter keys`);
    }
  });
});

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Theme contract check passed for ${themeNames.length} theme packs.`);
