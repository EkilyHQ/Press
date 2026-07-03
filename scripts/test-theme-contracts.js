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
    return `\\b${parts.map(escapeRe).join('\\s*\\.\\s*')}`;
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

function stringLiteralHasExternalRouteContext(source, literalMatch, externalAliases = new Set()) {
  const text = String(source || '');
  const content = String((literalMatch && literalMatch[2]) || '');
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

function collectRouteKeyAliases(source) {
  const text = String(source || '');
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
  return aliases;
}

function collectNamedImports(source) {
  const text = String(source || '');
  const imports = [];
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
    const clean = part.trim();
    const simple = clean.match(/^([A-Za-z_$][\w$]*)$/);
    if (simple) {
      bindings.add(simple[1]);
      return;
    }
    const alias = clean.match(/^[A-Za-z_$][\w$]*\s*:\s*([A-Za-z_$][\w$]*)$/);
    if (alias) bindings.add(alias[1]);
  });
  const shorthandRe = /(?:^|[,{]\s*)([A-Za-z_$][\w$]*)(?:\s*=\s*[^,}]+)?\s*(?=[,}])/g;
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

function extractBlockText(source, openBraceIndex) {
  return extractBlockSpan(source, openBraceIndex).body;
}

function extractBlockSpan(source, openBraceIndex) {
  const text = String(source || '');
  let depth = 0;
  for (let i = openBraceIndex; i < text.length; i += 1) {
    if (text[i] === '{') {
      depth += 1;
    } else if (text[i] === '}') {
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
      source: String((file && file.source) || '')
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

function routeKeyWritePattern(owner, property = '') {
  const ownerPattern = expressionReferencePattern(owner);
  const suffix = property ? `\\s*\\.\\s*${escapeRe(property)}` : '';
  const parenthesizedRouteKey = `(?:\\(\\s*)*(?:${IDENTIFIER_PATTERN.source}|${ROUTE_KEY_LITERAL_EXPRESSION_PATTERN_SOURCE})(?:\\s*\\))*`;
  return new RegExp(`${ownerPattern}${suffix}\\s*\\.\\s*(?:set|append)\\(\\s*(${parenthesizedRouteKey}|[^,\\)]+)\\s*,`, 'g');
}

function containsRouteKeyWriteForOwner(source, owner, aliases, property = '') {
  const text = String(source || '');
  const re = routeKeyWritePattern(owner, property);
  let match = re.exec(text);
  while (match) {
    if (sourceArgIsRouteKey(match[1], aliases)) return true;
    match = re.exec(text);
  }
  return false;
}

function collectUrlSearchParamsConstructors(source) {
  const text = String(source || '');
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
  const text = String(args || '').trim();
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
  const text = String(source || '');
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
  const text = String(source || '');
  const vars = collectUrlSearchParamsVariables(text);
  for (const name of vars) {
    if (containsRouteKeyWriteForOwner(text, name, aliases) && containsRelativeParamsSerialization(text, name)) {
      return true;
    }
  }
  return false;
}

function containsForbiddenUrlSearchParamsInitializer(source, aliases = new Set()) {
  const text = String(source || '');
  const initializers = collectUrlSearchParamsInitializers(text);
  for (const { name, args } of initializers) {
    if (urlSearchParamsInitializerHasRouteKey(args, aliases) && containsRelativeParamsSerialization(text, name)) {
      return true;
    }
  }
  return false;
}

function collectRouteQueryAliases(source, aliases = new Set()) {
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
      if (urlSearchParamsInitializerHasRouteKey(expression, aliases)) out.add(match[1]);
      match = re.exec(text);
    }
  });
  return out;
}

function expressionIsQueryAliasReference(expression, queryAliases = new Set()) {
  const patterns = Array.from(queryAliases || []).map((alias) => `(?:\\(\\s*)*${expressionReferencePattern(alias)}(?:\\s*\\))*`);
  if (!patterns.length) return false;
  return new RegExp(`^(?:${patterns.join('|')})(?:\\s*\\.\\s*toString\\s*\\(\\s*\\))?$`).test(String(expression || '').trim());
}

function inlineParamsConcatHasExternalPrefix(text, literalMatch) {
  const content = String(literalMatch[2] || '');
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = String(text || '').slice(0, literalMatch.index);
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
  const value = String(content || '');
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
  const text = String(source || '');
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
  return new RegExp(`${locationSearchWritePattern(collectLocationAliases(text)).source}\\s*$`).test(before);
}

function containsForbiddenInlineUrlSearchParamsInitializer(source, aliases = new Set()) {
  const text = String(source || '');
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
  const content = String(match[2] || '');
  const queryIndex = Math.max(content.lastIndexOf('?'), content.lastIndexOf('&'));
  const prefix = queryIndex >= 0 ? routeCandidatePrefix(content, queryIndex) : '';
  if (isExternalUrlPrefix(prefix)) return true;
  const before = String(text || '').slice(0, match.index);
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
  const text = String(source || '');
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
  const text = String(source || '');
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
  const text = String(value || '').trim();
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
  const text = String(value || '').trim();
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
  const text = String(source || '');
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
  const searchProperty = `(?:\\.\\s*search|\\[\\s*(['"\`])search\\1\\s*\\])`;
  return new RegExp(`${ownerPattern}\\s*${searchProperty}\\s*(?:\\+=|=(?!=|>))`, 'g');
}

function containsForbiddenRouteUrlMutation(source, aliases, externalAliases, staticRelativeAliases) {
  const text = String(source || '');
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
  const text = String(source || '');
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
    const value = String(expression || '').trim();
    const match = value.match(/^new\s+URL\s*\(/);
    if (!match) return false;
    const parsed = extractCallArgs(value, match[0].length);
    return !urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases);
  };
  const applyArrayFirstArgIsRelativeNewUrl = (expression) => {
    const value = String(expression || '').trim();
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
  const callbackCallSuffix = /^\s*(?:\)\s*\(\s*new\s+URL\s*\(|\)\s*\.\s*call\s*\(\s*[\s\S]*?,\s*new\s+URL\s*\(|\)\s*\.\s*apply\s*\(\s*[\s\S]*?,\s*\[\s*new\s+URL\s*\()/;
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
  const blockArrowRe = new RegExp(`\\(\\s*(?:async\\s*)?\\(?\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)?\\s*=>\\s*\\{`, 'g');
  match = blockArrowRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, blockArrowRe.lastIndex - 1);
    const suffix = text.slice(span.end).match(callbackCallSuffix);
    if (suffix) {
      const parsed = argsAreRelative(span.end + suffix[0].length);
      if (parsed.relative && callbackMutatesRouteUrl(span.body, match[1])) return true;
      if (parsed.end > blockArrowRe.lastIndex) blockArrowRe.lastIndex = parsed.end;
    }
    match = blockArrowRe.exec(text);
  }
  const functionRe = new RegExp(`\\(\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)\\s*\\{`, 'g');
  match = functionRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, functionRe.lastIndex - 1);
    const suffix = text.slice(span.end).match(callbackCallSuffix);
    if (suffix) {
      const parsed = argsAreRelative(span.end + suffix[0].length);
      if (parsed.relative && callbackMutatesRouteUrl(span.body, match[1])) return true;
      if (parsed.end > functionRe.lastIndex) functionRe.lastIndex = parsed.end;
    }
    match = functionRe.exec(text);
  }
  const mutators = [];
  const addMutator = (name, owner, body, index) => {
    if (!callbackMutatesRouteUrl(body, owner)) return;
    mutators.push({ name, scope: containingBlockSpan(index) });
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
    if (span.end > mutatorArrowRe.lastIndex) mutatorArrowRe.lastIndex = span.end;
    match = mutatorArrowRe.exec(text);
  }
  const mutatorFunctionExpressionRe = new RegExp(`\\b(?:const|let|var)\\s+(${IDENTIFIER_PATTERN.source})\\s*=\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)\\s*\\{`, 'g');
  match = mutatorFunctionExpressionRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, mutatorFunctionExpressionRe.lastIndex - 1);
    addMutator(match[1], match[2], span.body, match.index);
    if (span.end > mutatorFunctionExpressionRe.lastIndex) mutatorFunctionExpressionRe.lastIndex = span.end;
    match = mutatorFunctionExpressionRe.exec(text);
  }
  const mutatorFunctionRe = new RegExp(`\\bfunction\\s+(${IDENTIFIER_PATTERN.source})\\s*\\(\\s*(${IDENTIFIER_PATTERN.source})\\s*\\)\\s*\\{`, 'g');
  match = mutatorFunctionRe.exec(text);
  while (match) {
    const span = extractBlockSpan(text, mutatorFunctionRe.lastIndex - 1);
    addMutator(match[1], match[2], span.body, match.index);
    if (span.end > mutatorFunctionRe.lastIndex) mutatorFunctionRe.lastIndex = span.end;
    match = mutatorFunctionRe.exec(text);
  }
  for (const { name, scope } of mutators) {
    const scopedText = text.slice(scope.start, scope.end);
    const directCallRe = new RegExp(`\\b${escapeRe(name)}\\s*\\(\\s*new\\s+URL\\s*\\(`, 'g');
    match = directCallRe.exec(scopedText);
    while (match) {
      const parsed = extractCallArgs(scopedText, directCallRe.lastIndex);
      if (!urlConstructorArgsAreExternal(parsed.args, externalAliases, staticRelativeAliases)) return true;
      if (parsed.end > directCallRe.lastIndex) directCallRe.lastIndex = parsed.end;
      match = directCallRe.exec(scopedText);
    }
    const methodCallRe = new RegExp(`\\b${escapeRe(name)}\\s*\\.\\s*(call|apply)\\s*\\(`, 'g');
    match = methodCallRe.exec(scopedText);
    while (match) {
      const method = match[1];
      const parsed = extractCallArgs(scopedText, methodCallRe.lastIndex);
      const parts = splitTopLevelArgs(parsed.args);
      const relative = method === 'apply'
        ? applyArrayFirstArgIsRelativeNewUrl(parts[1] || '')
        : expressionIsRelativeNewUrl(parts[1] || '');
      if (relative) return true;
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
  const text = String(source || '');
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
  const text = String(source || '');
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

function containsForbiddenV4RouteConstruction(source, contextSource = source) {
  const text = String(source || '');
  const context = normalizeRouteGuardContext(contextSource, text);
  const aliases = mergeImportedContextAliases(collectRouteKeyAliases(text), collectRouteKeyAliases, text, context, { shadow: false });
  const externalAliases = mergeImportedContextAliases(collectExternalUrlAliases(text), collectExternalUrlAliases, text, context);
  const staticRelativeAliases = mergeImportedContextAliases(collectStaticRelativeUrlAliases(text), collectStaticRelativeUrlAliases, text, context);
  const inlineSearchParamsAliases = collectInlineUrlSearchParamsAliases(text);
  return containsForbiddenRouteLiteral(text, externalAliases)
    || containsForbiddenLocationSearchAssignment(text, aliases)
    || containsForbiddenUrlSearchParamsInitializer(text, aliases)
    || containsForbiddenInlineUrlSearchParamsInitializer(text, aliases)
    || containsForbiddenSplitRouteQueryLiteral(text)
    || containsForbiddenRouteKeyAliasConstruction(text, aliases)
    || containsForbiddenUrlSearchParamsVariable(text, aliases)
    || containsForbiddenRouteUrlMutation(text, aliases, externalAliases, staticRelativeAliases)
    || containsForbiddenInlineRouteUrlCallbackMutation(text, aliases, externalAliases, staticRelativeAliases)
    || Array.from(inlineSearchParamsAliases).some((name) => (
      containsRouteKeyWriteForOwner(text, name, aliases) && containsRelativeParamsSerialization(text, name)
    ));
}

[
  ['assigned URLSearchParams route builder', 'let params; params = new URLSearchParams({ id: post.location }); return "?" + params;', true],
  ['URL.searchParams alias route mutation', 'const url = new URL(location.href); const params = url.searchParams; params.set("id", post.location); return url.href;', true],
  ['location.search route query alias', 'const routeKey = "id"; const qs = routeKey + "=" + post.location; location.search = qs;', true],
  ['location object alias route query sink', 'const loc = location; const routeKey = "id"; const qs = routeKey + "=" + post.location; loc.search = qs;', true],
  ['destructured location alias route query sink', 'const { location: loc } = window; const routeKey = "id"; const qs = routeKey + "=" + post.location; loc.search = qs;', true],
  ['location bracket route query sink', 'const routeKey = "id"; window.location["search"] = routeKey + "=" + post.location;', true],
  ['member URLSearchParams route builder', 'state.params = new URLSearchParams({ id: post.location }); return "?" + state.params;', true],
  ['inline URL searchParams alias builder', 'const params = new URL(location.href).searchParams; params.set("id", post.location); return "?" + params;', true],
  ['parenthesized URL.searchParams alias mutation', 'const url = new URL(location.href); const params = (url.searchParams); params.set("id", post.location); return url.href;', true],
  ['destructured URL.searchParams alias mutation', 'const url = new URL(location.href); const { searchParams } = url; searchParams.set("id", post.location); return url.href;', true],
  ['external split query string', 'const externalBase = "https://api.example.test/product"; return externalBase + "?id=" + sku;', false],
  ['external split tab string', 'return "https://api.example.test/product" + "?tab=posts";', false],
  ['external URL static relative path alias', 'const externalBase = "https://api.example.test"; const productPath = "/product"; const url = new URL(productPath, externalBase); url.searchParams.set("id", sku); return url.href;', false],
  ['external URL object alias', 'const externalBase = new URL("https://api.example.test"); const url = new URL("/product", externalBase); url.searchParams.set("id", sku); return url.href;', false],
  ['cross-file imported external URL alias context', 'import { endpoint } from "./config.js"; const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
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
  ['cross-file external URL multiline expression arrow param shadowing', 'import { endpoint } from "./config.js"; const route = ({ endpoint }, post) => (\n  endpoint + "?id=" + post.location\n);', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL single expression arrow param shadowing', 'import { endpoint } from "./config.js"; export default endpoint => endpoint + "?tab=posts";', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL async single arrow param shadowing', 'import { endpoint } from "./config.js"; const route = async endpoint => { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL defaulted destructured param shadowing', 'import { endpoint } from "./config.js"; function route({ endpoint = location.href }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; }', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL object method destructured param shadowing', 'import { endpoint } from "./config.js"; export default { route({ endpoint }, post) { const url = new URL(endpoint); url.searchParams.set("id", post.location); return url.href; } };', true, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file external URL nested local does not shadow mount', 'import { endpoint } from "./config.js"; function helper() { const endpoint = "local"; return endpoint; } const url = new URL(endpoint); url.searchParams.set("id", sku); return url.href;', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL inline callback context', 'import { endpoint } from "./config.js"; ((url) => (url.searchParams.set("id", sku), url.href))(new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-file imported external URL helper mutator context', 'import { endpoint } from "./config.js"; const mutate = (url) => { url.searchParams.set("id", sku); return url.href; }; mutate(new URL(endpoint));', false, { path: 'modules/layout.js', files: [{ path: 'modules/config.js', source: 'export const endpoint = "https://api.example.test/product";' }] }],
  ['cross-scope helper mutator name does not leak', 'function setup() { function mutate(url) { url.searchParams.set("id", "post.md"); return url.href; } } function route() { function mutate(url) { return url.href; } return mutate(new URL(location.href)); }', false],
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
  if (Number(manifest.contractVersion) >= 4 && containsForbiddenV4RouteConstruction(moduleSource)) {
    fail(`${relManifest} contract v4 theme modules must use ctx.router href helpers instead of public route construction`);
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
