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
const ROUTE_QUERY_PATTERN = /[?&](?:tab|id)\s*=/g;
const ROUTE_KEY_OBJECT_INIT_PATTERN = /(?:^|[,{]\s*)(?:(['"`])(?:tab|id)\1|(?:tab|id))\s*:/;
const ROUTE_KEY_OBJECT_SHORTHAND_PATTERN = /(?:^|[,{]\s*)(?:tab|id)\s*(?=[,}])/;
const ROUTE_KEY_ARRAY_INIT_PATTERN = /\[\s*(['"`])(?:tab|id)\1\s*,/;
const SPLIT_ROUTE_QUERY_LITERAL_PATTERN = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?[?&])\1\s*\+\s*(?:(['"`])(?:tab|id)\s*=\3|(['"`])(?:tab|id)\4\s*\+\s*(['"`])=\5)/g;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/;
const MEMBER_EXPRESSION_PATTERN_SOURCE = `(?:this|${IDENTIFIER_PATTERN.source})(?:\\s*\\.\\s*${IDENTIFIER_PATTERN.source})+`;
const ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE = `(?:"(?:tab|id)"|'(?:tab|id)'|\`(?:tab|id)\`)`;
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

function isExternalUrlPrefix(value) {
  const prefix = String(value || '').trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(prefix) || prefix.startsWith('//');
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
  const text = String(source || '');
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
  return /(?:"(?:tab|id)"|'(?:tab|id)'|`(?:tab|id)`)/.test(String(expression || ''));
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
  const text = String(source || '');
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
  return /\b(?:new\s+URL|URLSearchParams|searchParams|location)\b|[?&](?:tab|id)=/.test(String(body || ''));
}

function braceDepthAt(source, index) {
  const text = String(source || '').slice(0, Math.max(0, index));
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}' && depth > 0) depth -= 1;
  }
  return depth;
}

function blockStackAt(source, index) {
  const text = String(source || '');
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
  const value = String(arg || '').trim();
  return new RegExp(`^(?:${routeKeyExpressionPattern(aliases)})$`).test(value);
}

function propertyAccessorPattern(name) {
  const escaped = escapeRe(name);
  return `(?:\\s*\\?\\.\\s*${escaped}|\\s*\\.\\s*${escaped}|\\s*\\?\\.\\s*\\[\\s*["'\`]${escaped}["'\`]\\s*\\]|\\s*\\[\\s*["'\`]${escaped}["'\`]\\s*\\])`;
}

function routeKeyWritePattern(owner, property = '') {
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? propertyAccessorPattern(property) : '';
  const mutator = `(?:${propertyAccessorPattern('set')}|${propertyAccessorPattern('append')}|${propertyAccessorPattern('delete')})`;
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  return new RegExp(`${ownerPattern}${suffix}${mutator}\\s*(?:\\?\\.\\s*)?\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*(?:,|\\))`, 'g');
}

function collectBoundRouteMutators(source, owner, property = '') {
  const text = String(source || '');
  const out = new Set();
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? propertyAccessorPattern(property) : '';
  const target = `${ownerPattern}${suffix}`;
  const mutator = `(?:${propertyAccessorPattern('set')}|${propertyAccessorPattern('append')}|${propertyAccessorPattern('delete')})`;
  const re = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*${target}${mutator}\\s*\\.\\s*bind\\s*\\(\\s*${target}\\s*\\)`, 'g');
  let match = re.exec(text);
  while (match) {
    out.add(match[1]);
    match = re.exec(text);
  }
  return out;
}

function containsRouteKeyWriteForOwner(source, owner, aliases, property = '') {
  const text = String(source || '');
  const re = routeKeyWritePattern(owner, property);
  let match = re.exec(text);
  while (match) {
    if (sourceArgIsRouteKey(match[1], aliases)) return true;
    match = re.exec(text);
  }
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  for (const mutator of collectBoundRouteMutators(text, owner, property)) {
    const mutatorRe = new RegExp(`(?:^|[^\\w$.])${escapeRe(mutator)}\\s*(?:\\?\\.\\s*)?\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*(?:,|\\))`, 'g');
    match = mutatorRe.exec(text);
    while (match) {
      if (sourceArgIsRouteKey(match[1], aliases)) return true;
      match = mutatorRe.exec(text);
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

function routeKeyExpressionPattern(aliases = new Set()) {
  const aliasExpression = aliasExpressionPattern(aliases);
  const core = aliasExpression
    ? `(?:${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE}|${aliasExpression})`
    : ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE;
  return `(?:\\(\\s*)*${core}(?:\\s*\\))*`;
}

function urlSearchParamsInitializerHasRouteKey(args, aliases = new Set()) {
  const text = stripWrappingParentheses(args);
  const passThroughCall = text.match(/^(?:Object\s*\.\s*entries|Array\s*\.\s*from)\s*\(/);
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
  return new RegExp(`(?:${routeKeyExpression})\\s*\\+\\s*(['"\`])=\\1`).test(text)
    || new RegExp(`\\$\\{\\s*(?:${routeKeyExpression})\\s*\\}\\s*=`).test(text);
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

function containsForbiddenSplitRouteQueryLiteral(source, externalAliases = null) {
  const text = String(source || '');
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
  const out = new Set();
  const bodyReturnsRouteUrl = (body) => {
    const re = /\breturn\s+(?:\(\s*)*new\s+URL\s*\(/g;
    let match = re.exec(body);
    while (match) {
      const parsed = extractCallArgs(body, re.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases)) return true;
      if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
      match = re.exec(body);
    }
    return false;
  };
  const expressionReturnsRouteUrl = (expression) => {
    const value = stripWrappingParentheses(expression);
    const match = value.match(/^new\s+URL\s*\(/);
    if (!match) return false;
    const parsed = extractCallArgs(value, match[0].length);
    return !urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases);
  };
  const functionRe = new RegExp(`\\bfunction\\s+(${IDENTIFIER_PATTERN.source})\\s*\\([^)]*\\)\\s*\\{`, 'g');
  let match = functionRe.exec(text);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, functionRe.lastIndex - 1))) out.add(match[1]);
    match = functionRe.exec(text);
  }
  const functionExpressionRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\([^)]*\\)\\s*\\{`, 'g');
  match = functionExpressionRe.exec(text);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, functionExpressionRe.lastIndex - 1))) out.add(match[1]);
    match = functionExpressionRe.exec(text);
  }
  const arrowBlockRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{`, 'g');
  match = arrowBlockRe.exec(text);
  while (match) {
    if (bodyReturnsRouteUrl(extractBlockText(text, arrowBlockRe.lastIndex - 1))) out.add(match[1]);
    match = arrowBlockRe.exec(text);
  }
  const arrowExpressionRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>\\s*`, 'g');
  match = arrowExpressionRe.exec(text);
  while (match) {
    const expression = extractAssignmentExpression(text, arrowExpressionRe.lastIndex);
    if (expressionReturnsRouteUrl(expression)) out.add(match[1]);
    arrowExpressionRe.lastIndex += expression.length;
    match = arrowExpressionRe.exec(text);
  }
  return out;
}

function collectRouteUrlVariables(source, externalAliases = collectExternalUrlAliases(source), staticRelativeAliases = collectStaticRelativeUrlAliases(source)) {
  const text = String(source || '');
  const out = new Set();
  const factories = collectRouteUrlFactoryAliases(text, externalAliases, staticRelativeAliases);
  [
    new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URL\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*new\\s+URL\\s*\\(`, 'g'),
    new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_PATTERN_SOURCE})\\s*=\\s*new\\s+URL\\s*\\(`, 'g')
  ].forEach((re) => {
    let match = re.exec(text);
    while (match) {
      const parsed = extractCallArgs(text, re.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases)) out.add(match[1]);
      if (parsed.end > re.lastIndex) re.lastIndex = parsed.end;
      match = re.exec(text);
    }
  });
  if (factories.size) {
    const factoryPattern = aliasExpressionPattern(factories);
    [
      new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:${factoryPattern})\\s*(?:\\?\\.\\s*)?\\(`, 'g'),
      new RegExp(`(?:^|[^\\w$.])(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:${factoryPattern})\\s*(?:\\?\\.\\s*)?\\(`, 'g'),
      new RegExp(`(?:^|[^\\w$])(${MEMBER_EXPRESSION_PATTERN_SOURCE})\\s*=\\s*(?:${factoryPattern})\\s*(?:\\?\\.\\s*)?\\(`, 'g')
    ].forEach((re) => {
      let match = re.exec(text);
      while (match) {
        out.add(match[1]);
        match = re.exec(text);
      }
    });
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

function searchWritePatternForOwnerPattern(ownerPattern) {
  const searchProperty = `(?:\\.\\s*search|\\[\\s*(['"\`])search\\1\\s*\\])`;
  return new RegExp(`${ownerPattern}\\s*${searchProperty}\\s*(?:\\+=|=(?!=|>))`, 'g');
}

function searchWritePatternForOwner(owner) {
  return searchWritePatternForOwnerPattern(expressionReferencePattern(owner));
}

function containsForbiddenRouteUrlMutation(source, aliases, externalAliases, staticRelativeAliases) {
  const text = String(source || '');
  const vars = collectRouteUrlVariables(text, externalAliases, staticRelativeAliases);
  for (const name of vars) {
    if (containsRouteKeyWriteForOwner(text, name, aliases, 'searchParams')) return true;
    if (containsForbiddenSearchAssignment(text, searchWritePatternForOwner(name), aliases)) return true;
    const paramsAliases = collectSearchParamsAliasesForRouteUrl(text, name);
    for (const paramsAlias of paramsAliases) {
      if (containsRouteKeyWriteForOwner(text, paramsAlias, aliases)) return true;
    }
  }
  return false;
}

function containsForbiddenInlineRouteUrlCallbackMutation(source, aliases, externalAliases, staticRelativeAliases) {
  const text = String(source || '');
  const callbackMutatesRouteUrl = (body, owner) => {
    if (containsRouteKeyWriteForOwner(body, owner, aliases, 'searchParams')) return true;
    if (containsForbiddenSearchAssignment(body, searchWritePatternForOwner(owner), aliases)) return true;
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
    const match = value.match(/^new\s+URL\s*\(/);
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
  const text = String(source || '');
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
  const text = String(source || '');
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

function containsForbiddenExecutableRouteCode(text, aliases, externalAliases, staticRelativeAliases) {
  const constructorAliases = collectUrlSearchParamsConstructorAliases(text);
  const inlineSearchParamsAliases = collectInlineUrlSearchParamsAliases(text);
  const queryAliases = collectRouteQueryAliases(text, aliases, constructorAliases);
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

function containsForbiddenShadowedExternalAliasRouteCode(source, aliases, externalAliases, shadowCandidates, staticRelativeAliases) {
  const text = String(source || '');
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

function containsForbiddenHtmlInlineRouteCode(source, aliases, externalAliases, staticRelativeAliases) {
  const text = stripHtmlCommentsForRouteGuard(source);
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script(?=[\s>])[^>]*>/gi;
  let match = re.exec(text);
  while (match) {
    if (!scriptTypeAllowsRouteScan(match[1] || '')) {
      match = re.exec(text);
      continue;
    }
    const script = stripCommentsForRouteGuard(match[2] || '');
    if (containsForbiddenExecutableRouteCode(script, aliases, externalAliases, staticRelativeAliases)
      || containsForbiddenShadowedExternalAliasRouteCode(script, aliases, externalAliases, externalAliases, staticRelativeAliases)) {
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
      && containsForbiddenHtmlRouteAttribute(stripHtmlCommentsForRouteGuard(rawText)))
    || ((/\.(?:html?|svg)$/i.test(String(context.path || '')))
      && containsForbiddenHtmlInlineRouteCode(rawText, aliases, externalAliases, staticRelativeAliases));
}

[
  ['assigned URLSearchParams route builder', 'let params; params = new URLSearchParams({ id: post.location }); return "?" + params;', true],
  ['parenthesized URLSearchParams route builder', 'const params = (new URLSearchParams({ id: post.location })); return "?" + params;', true],
  ['URLSearchParams toString alias route builder', 'const params = new URLSearchParams({ id: post.location }); const qs = params.toString(); return "?" + qs;', true],
  ['route query alias public href', 'const qs = "id=" + post.location; return "?" + qs;', true],
  ['parenthesized route query alias public href', 'const qs = ("id=" + post.location); return "?" + qs;', true],
  ['conditional string route query alias public sink', 'const qs = enabled ? "id=" + post.location : ""; location.search = qs;', true],
  ['bound URL.searchParams route mutator', 'const url = new URL(location.href); const set = url.searchParams.set.bind(url.searchParams); set("id", post.location); return url.href;', true],
  ['bound URL.searchParams delete route mutator', 'const url = new URL(location.href); const remove = url.searchParams.delete.bind(url.searchParams); remove("id"); return url.href;', true],
  ['multi declarator route key alias', 'const unused = 1, key = "id"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true],
  ['member route key alias', 'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys.post, post.location); return url.href;', true],
  ['bracket member route key alias', 'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys["post"], post.location); return url.href;', true],
  ['optional bracket member route key alias', 'const routeKeys = { post: "id" }; const url = new URL(location.href); url.searchParams.set(routeKeys?.["post"], post.location); return url.href;', true],
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
  ['bracket URL.searchParams route key mutation', 'const url = new URL(location.href); url.searchParams["set"]("id", post.location); return url.href;', true],
  ['optional URL.searchParams route key mutation', 'const url = new URL(location.href); url.searchParams?.set("tab", "posts"); return url.href;', true],
  ['optional bracket URL.searchParams route key mutation', 'const url = new URL(location.href); url["searchParams"]?.["append"]("id", post.location); return url.href;', true],
  ['optional call URL.searchParams route key mutation', 'const url = new URL(location.href); url.searchParams.set?.("id", post.location); return url.href;', true],
  ['URL.search route key assignment', 'const key = "id"; const url = new URL(location.href); url.search = key + "=" + post.location; return url.href;', true],
  ['URL.search operator line continuation', 'const key = "id"; const url = new URL(location.href); url.search = key +\n  "=" + post.location; return url.href;', true],
  ['URL.search URLSearchParams route assignment', 'const url = new URL(location.href); url.search = new URLSearchParams({ id: post.location }); return url.href;', true],
  ['route URL member assignment', 'state.url = new URL(location.href); state.url.searchParams.set("id", post.location); return state.url.href;', true],
  ['route URL factory helper result', 'function currentUrl() { return new URL(location.href); } const url = currentUrl(); url.searchParams.set("id", post.location); return url.href;', true],
  ['route URL function expression factory result', 'const currentUrl = function() { return new URL(location.href); }; const url = currentUrl(); url.searchParams.set("id", post.location); return url.href;', true],
  ['window URLSearchParams route builder', 'const params = new window.URLSearchParams({ id: post.location }); return "?" + params;', true],
  ['URLSearchParams constructor alias route builder', 'const Params = URLSearchParams; const params = new Params({ id: post.location }); return "?" + params;', true],
  ['globalThis URLSearchParams constructor alias route builder', 'const Params = globalThis.URLSearchParams; const params = new Params({ id: post.location }); return "?" + params;', true],
  ['destructured URLSearchParams constructor alias route builder', 'const { URLSearchParams: Params } = window; const params = new Params({ id: post.location }); return "?" + params;', true],
  ['conditional URLSearchParams route builder', 'const params = enabled ? new URLSearchParams({ id: post.location }) : new URLSearchParams(); return "?" + params;', true],
  ['URL.searchParams delete route key', 'const url = new URL(location.href); url.searchParams.delete("id"); return url.href;', true],
  ['bracket optional call URL.searchParams route key mutation', 'const url = new URL(location.href); url.searchParams["append"]?.("tab", "posts"); return url.href;', true],
  ['bracket URL.searchParams alias route key mutation', 'const url = new URL(location.href); const params = url.searchParams; params["append"]("tab", "posts"); return url.href;', true],
  ['bracket URL.searchParams alias collection route key mutation', 'const url = new URL(location.href); const params = url["searchParams"]; params.set("id", post.location); return url.href;', true],
  ['optional URL.searchParams alias collection route key mutation', 'const url = new URL(location.href); const params = url?.searchParams; params.set("id", post.location); return url.href;', true],
  ['inline bracket URL.searchParams alias route key mutation', 'const params = new URL(location.href)["searchParams"]; params.set("id", post.location); return "?" + params;', true],
  ['external split query string', 'const externalBase = "https://api.example.test/product"; return externalBase + "?id=" + sku;', false],
  ['external split tab string', 'return "https://api.example.test/product" + "?tab=posts";', false],
  ['external URL static relative path alias', 'const externalBase = "https://api.example.test"; const productPath = "/product"; const url = new URL(productPath, externalBase); url.searchParams.set("id", sku); return url.href;', false],
  ['external bracket URL searchParams allowed', 'const url = new URL("https://api.example.test/product"); url.searchParams["set"]("id", sku); return url.href;', false],
  ['external optional call URL searchParams allowed', 'const url = new URL("https://api.example.test/product"); url.searchParams.set?.("id", sku); return url.href;', false],
  ['external URL object alias', 'const externalBase = new URL("https://api.example.test"); const url = new URL("/product", externalBase); url.searchParams.set("id", sku); return url.href;', false],
  ['cross-file imported external URL alias context', 'import { endpoint } from "./config.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file default route key alias', 'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export default "id";' }] }],
  ['cross-file const default route key alias', 'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'const routeKey = "id"; export default routeKey;' }] }],
  ['cross-file local default export route key alias', 'import routeKey from "./config.js"; const url = new URL(location.href); url.searchParams.set(routeKey, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'const routeKey = "id"; export { routeKey as default };' }] }],
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
  ['cross-file imported external URL object and bound helper mutator context', 'import { endpoint } from "./config.js"; const helper = { mutate(url) { url.searchParams.set("id", sku); return url.href; } }; function mutate(url) { url.searchParams.set("id", sku); return url.href; } const bound = mutate.bind(null); helper.mutate(new URL(endpoint)); bound(new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL second-arg and bound helper mutator context', 'import { endpoint } from "./config.js"; function mutate(ctx, url) { url.searchParams.set("id", sku); return url.href; } const bound = mutate.bind(null, "ctx"); mutate("ctx", new URL(endpoint)); bound(new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL optional helper mutator context', 'import { endpoint } from "./config.js"; function mutate(url) { url.searchParams.set("id", sku); return url.href; } mutate?.(new URL(endpoint)); mutate["call"](null, new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-scope helper mutator name does not leak', 'function setup() { function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } function route() { function mutate(url) { return url.href; } return mutate(new URL(location.href)); }', false],
  ['nested helper mutator shadow does not leak', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } }; if (ok) { function mutate(url) { return url.href; } const helper = { mutate(url) { return url.href; } }; mutate(new URL(location.href)); helper.mutate(new URL(location.href)); }', false],
  ['simple helper name does not reject safe object method', 'function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } const helper = { mutate(url) { return url.href; } }; return helper.mutate(new URL(location.href));', false],
  ['semicolonless expression arrow does not shadow later external route', 'import { endpoint } from "./config.js"; const helper = endpoint => endpoint\nconst url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL relative concat with base context', 'import { endpoint } from "./config.js"; const url = new URL("?id=" + sku, endpoint); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file unrelated import does not allow alias', 'import { endpoint } from "./internal.js"; const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }, { path: 'modules/internal.js', source: 'export const endpoint = location.href;' }] }],
  ['cross-file imported route key alias', 'import { key } from "./config.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }],
  ['cross-file barrel route key alias', 'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }, { path: 'modules/barrel.js', source: 'export { key } from "./config.js";' }] }],
  ['cross-file local-export barrel route key alias', 'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }, { path: 'modules/barrel.js', source: 'import { key } from "./config.js"; export { key };' }] }],
  ['cross-file star barrel route key alias', 'import { key } from "./barrel.js"; const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }, { path: 'modules/barrel.js', source: 'export * from "./config.js";' }] }],
  ['cross-file imported route key with unrelated shadow', 'import { key } from "./config.js"; function unrelated(key) { return key; } const url = new URL(location.href); url.searchParams.set(key, post.location); return url.href;', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const key = "id";' }] }]
].forEach(([label, source, expected, contextSource]) => {
  const actual = containsForbiddenV4RouteConstruction(source, contextSource || source);
  if (actual !== expected) fail(`v4 route guard self-check failed for ${label}`);
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
if (JSON.stringify(PRESS_THEME_CONTRACT.supportedContractVersions) !== JSON.stringify([3, 4])) {
  fail('the v4 transition release must support theme contract versions 3 and 4');
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
['createThemeI18nContext', 'switchLanguage', 'ensureLanguageBundle', 'getAvailableLangs', 'getLanguageLabel'].forEach((needle) => {
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
if (!/router:\s*options\.router \|\| null/.test(themeLayoutSource)) {
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
      if (containsForbiddenV4RouteConstruction(file.source, { path: file.path, files: routeGuardFiles })) {
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
