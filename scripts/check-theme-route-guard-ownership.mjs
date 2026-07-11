#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse } from '../assets/js/vendor/acorn.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(here, '..');
const DEFAULT_POLICY_PATH = path.join(here, 'theme-route-guard-ownership-policy.json');
const NODE_SOURCE_PATTERN = /\.(?:cjs|js|mjs)$/iu;
const LOCKED_POLICY_SHA256 = '5da44071e0df448dd43465ffe60572cdd72bc23641fd4b0cb16e619e25ce3f09';
const LOCKED_FACADE_REFERENCES = ['./theme-route-guard-html.js', './vendor/acorn-walk.mjs', './vendor/acorn.mjs'];
const LOCKED_HTML_EXPORTS = ['containsForbiddenV4HtmlRouteConstruction', 'isV4HtmlRouteGuardSource'];
const IMPLICIT_REGEX_METHODS = new Set(['match', 'matchAll', 'search']);
const PUBLIC_ROUTE_NAME_PATTERN =
  /(?:theme[-_.]?route|route[-_.]?theme).*(?:analy[sz]er|construction|guard)|(?:analy[sz]er|guard).*(?:theme[-_.]?route)/iu;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function safeRelativePath(value) {
  return String(value || '')
    .replace(/\\+/gu, '/')
    .replace(/^\.\//u, '');
}

function lines(source) {
  return String(source || '').split(/\r?\n/u).length;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalAst(value) {
  if (Array.isArray(value)) return value.map(canonicalAst);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !['end', 'loc', 'start'].includes(key))
      .sort()
      .map((key) => [key, canonicalAst(value[key])])
  );
}

function astSha256(node) {
  return sha256(JSON.stringify(canonicalAst(node)));
}

function parseModule(source, label, failures) {
  try {
    return parse(String(source || ''), {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
      allowHashBang: true,
      allowReturnOutsideFunction: true,
      locations: true
    });
  } catch (err) {
    failures.push(`${label} is not parseable JavaScript: ${err.message}`);
    return null;
  }
}

function walk(node, callback, parent = null, key = '') {
  if (!node || typeof node !== 'object') return;
  callback(node, parent, key);
  Object.entries(node).forEach(([childKey, child]) => {
    if (childKey === 'start' || childKey === 'end' || childKey === 'loc') return;
    if (Array.isArray(child)) child.forEach((entry) => walk(entry, callback, node, childKey));
    else walk(child, callback, node, childKey);
  });
}

function bindingNames(pattern, out = []) {
  if (!pattern) return out;
  if (pattern.type === 'Identifier') out.push(pattern.name);
  else if (pattern.type === 'RestElement') bindingNames(pattern.argument, out);
  else if (pattern.type === 'AssignmentPattern') bindingNames(pattern.left, out);
  else if (pattern.type === 'ArrayPattern') pattern.elements.forEach((entry) => bindingNames(entry, out));
  else if (pattern.type === 'ObjectPattern') {
    pattern.properties.forEach((property) => {
      if (property.type === 'RestElement') bindingNames(property.argument, out);
      else bindingNames(property.value, out);
    });
  }
  return out;
}

function unwrapTopLevel(node) {
  return node && node.type === 'ExportNamedDeclaration' ? node.declaration : node;
}

function collectTopLevelDeclarations(ast) {
  const declarations = [];
  ((ast && ast.body) || []).forEach((rawNode) => {
    const node = unwrapTopLevel(rawNode);
    if (!node) return;
    if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
      if (node.id) declarations.push({ name: node.id.name, kind: 'function', node });
    } else if (node.type === 'VariableDeclaration') {
      node.declarations.forEach((declaration) => {
        bindingNames(declaration.id).forEach((name) => declarations.push({ name, kind: 'variable', node }));
      });
    }
  });
  return declarations;
}

function collectAllIdentifiers(ast) {
  const identifiers = new Set();
  walk(ast, (node) => {
    if (node.type === 'Identifier') identifiers.add(node.name);
  });
  return identifiers;
}

function staticString(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw ?? '').join('');
  }
  if (node.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left);
    const right = staticString(node.right);
    return left == null || right == null ? null : `${left}${right}`;
  }
  return null;
}

function collectModuleReferenceRecords(ast) {
  const records = [];
  walk(ast, (node) => {
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') {
      const specifier = staticString(node.source);
      records.push({ kind: node.type, specifier });
    } else if (node.type === 'ExportNamedDeclaration' && node.source) {
      const specifier = staticString(node.source);
      records.push({ kind: node.type, specifier });
    } else if (node.type === 'ImportExpression') {
      const specifier = staticString(node.source);
      records.push({ kind: node.type, specifier });
    } else if (
      node.type === 'CallExpression' &&
      node.callee &&
      ((node.callee.type === 'Identifier' && node.callee.name === 'require') ||
        (node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'module' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'require'))
    ) {
      const specifier = staticString(node.arguments[0]);
      records.push({ kind: 'require', specifier });
    }
  });
  return records;
}

function collectModuleReferences(ast) {
  return collectModuleReferenceRecords(ast)
    .map((record) => record.specifier)
    .filter((specifier) => specifier != null);
}

function collectStringLiterals(ast) {
  const values = [];
  walk(ast, (node) => {
    const value = staticString(node);
    if ((node.type === 'Literal' || node.type === 'TemplateLiteral') && value != null) values.push(value);
  });
  return values;
}

function collectRegexLiterals(ast) {
  const regexes = [];
  walk(ast, (node) => {
    if (node.type === 'Literal' && node.regex) {
      regexes.push({ pattern: node.regex.pattern, flags: node.regex.flags || '' });
    }
  });
  return regexes;
}

function collectDynamicRegexes(ast) {
  const references = [];
  walk(ast, (node) => {
    if (node.type === 'Identifier' && node.name === 'RegExp') {
      references.push(node);
    } else if (node.type === 'MemberExpression') {
      const property = node.computed ? staticString(node.property) : node.property && node.property.name;
      if (property === 'RegExp') references.push(node);
    }
  });
  return references;
}

function collectImplicitRegexCalls(ast) {
  const calls = [];
  walk(ast, (node) => {
    if (node.type !== 'CallExpression' || !node.callee || node.callee.type !== 'MemberExpression') return;
    const method = node.callee.computed ? staticString(node.callee.property) : node.callee.property?.name;
    const argument = node.arguments[0];
    if (!IMPLICIT_REGEX_METHODS.has(method) || (argument?.type === 'Literal' && argument.regex)) return;
    calls.push({ method, pattern: staticString(argument) });
  });
  return calls;
}

function collectRouteScannerStrings(ast) {
  const values = new Set();
  walk(ast, (node) => {
    if (!['BinaryExpression', 'Literal', 'TemplateLiteral'].includes(node.type)) return;
    const value = staticString(node);
    if (value != null && routeRegexSignature(value)) values.add(value);
  });
  return [...values].sort();
}

function exportedFrozenObject(ast, name) {
  for (const node of ast?.body || []) {
    if (node.type !== 'ExportNamedDeclaration' || node.declaration?.type !== 'VariableDeclaration') continue;
    for (const declaration of node.declaration.declarations) {
      if (declaration.id?.type !== 'Identifier' || declaration.id.name !== name) continue;
      let value = declaration.init;
      if (
        value?.type === 'CallExpression' &&
        value.callee?.type === 'MemberExpression' &&
        !value.callee.computed &&
        value.callee.object?.type === 'Identifier' &&
        value.callee.object.name === 'Object' &&
        value.callee.property?.type === 'Identifier' &&
        value.callee.property.name === 'freeze' &&
        value.arguments.length === 1
      ) {
        [value] = value.arguments;
      }
      if (value?.type !== 'ObjectExpression') return null;
      const object = {};
      for (const property of value.properties) {
        if (property.type !== 'Property' || property.computed || property.kind !== 'init') return null;
        const key = property.key.type === 'Identifier' ? property.key.name : staticString(property.key);
        if (typeof key !== 'string' || property.value.type !== 'Literal') return null;
        object[key] = property.value.value;
      }
      return object;
    }
  }
  return null;
}

function collectOwnedCalls(ast, ownerName, calleeName) {
  const owners = ((ast && ast.body) || [])
    .map(unwrapTopLevel)
    .filter((node) => node && node.type === 'FunctionDeclaration' && node.id && node.id.name === ownerName);
  if (owners.length !== 1) return { calls: [], owners, shadows: [] };
  const owner = owners[0];
  const calls = [];
  const shadows = [];
  const addShadow = (pattern, node) => {
    if (bindingNames(pattern).includes(calleeName)) shadows.push(node);
  };
  owner.params.forEach((param) => addShadow(param, owner));
  const visit = (node, ancestors = []) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee &&
      node.callee.type === 'Identifier' &&
      node.callee.name === calleeName
    ) {
      calls.push({ node, ancestors });
    }
    if (node.type === 'VariableDeclarator') addShadow(node.id, node);
    if (node.type === 'CatchClause') addShadow(node.param, node);
    if (
      (node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression') &&
      node !== owner
    ) {
      if (node.id) addShadow(node.id, node);
      node.params.forEach((param) => addShadow(param, node));
    }
    if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      if (node.id) addShadow(node.id, node);
    }
    Object.entries(node).forEach(([childKey, child]) => {
      if (childKey === 'start' || childKey === 'end' || childKey === 'loc') return;
      if (Array.isArray(child)) child.forEach((entry) => visit(entry, [...ancestors, node]));
      else visit(child, [...ancestors, node]);
    });
  };
  visit(owner.body);
  return { calls, owners, shadows };
}

function isDirectOwnerCall(call) {
  return !call.ancestors.some((node) =>
    ['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'].includes(node.type)
  );
}

function isForEachDelegation(call, collectionName) {
  const functions = call.ancestors.filter((node) =>
    ['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'].includes(node.type)
  );
  if (functions.length !== 1) return false;
  const callback = functions[0];
  return call.ancestors.some(
    (node) =>
      node.type === 'CallExpression' &&
      node.callee &&
      node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.object.type === 'Identifier' &&
      node.callee.object.name === collectionName &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'forEach' &&
      node.arguments.includes(callback)
  );
}

function exportedNames(ast) {
  const names = [];
  ((ast && ast.body) || []).forEach((node) => {
    if (node.type === 'ExportDefaultDeclaration') names.push('default');
    if (node.type !== 'ExportNamedDeclaration') return;
    const declaration = node.declaration;
    if (declaration && (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration')) {
      if (declaration.id) names.push(declaration.id.name);
    } else if (declaration && declaration.type === 'VariableDeclaration') {
      declaration.declarations.forEach((entry) => names.push(...bindingNames(entry.id)));
    }
    node.specifiers.forEach((specifier) => {
      names.push(specifier.exported.name || specifier.exported.value);
    });
  });
  return names;
}

function exactMultiset(values) {
  const counts = new Map();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return Array.from(counts.entries()).sort(([left], [right]) => left.localeCompare(right));
}

function expectedRegexMultiset(policy) {
  const values = [];
  policy.coreRegexLiteralBaseline.forEach((entry) => {
    for (let index = 0; index < entry.count; index += 1) values.push(`${entry.pattern}\0${entry.flags}`);
  });
  return exactMultiset(values);
}

function actualRegexMultiset(ast) {
  return exactMultiset(collectRegexLiterals(ast).map((entry) => `${entry.pattern}\0${entry.flags}`));
}

function routeRegexSignature(value) {
  const text = String(value || '');
  return (
    (text.includes('[?&]') && text.includes('=')) ||
    ['?tab=', '?id=', '&tab=', '&id='].some((literal) => text.includes(literal)) ||
    text.includes('(?:tab|id)') ||
    text.includes('tab|id') ||
    text.includes('<script') ||
    text.includes('on[a-z]') ||
    text.includes('URLSearchParams') ||
    text.includes('searchParams') ||
    text.includes('location.search')
  );
}

function resolvedLocalImport(importer, specifier) {
  if (!specifier || !specifier.startsWith('.')) return '';
  return path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
}

function inspectLocalImport(importer, specifier) {
  const raw = String(specifier || '');
  const slash = raw.replace(/\\+/gu, '/');
  let decoded;
  try {
    decoded = decodeURIComponent(slash);
  } catch {
    return { canonical: '', target: '', unsafe: true };
  }
  const pathOnly = decoded.split(/[?#]/u, 1)[0];
  if (!pathOnly.startsWith('.')) return { canonical: '', target: '', unsafe: false };
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(importer), pathOnly));
  let relative = path.posix.relative(path.posix.dirname(importer), target);
  if (!relative.startsWith('.')) relative = `./${relative}`;
  return { canonical: relative, target, unsafe: raw !== relative };
}

function candidateVariants(value) {
  const raw = String(value || '');
  const slash = raw.replace(/\\+/gu, '/');
  let decoded;
  try {
    decoded = decodeURIComponent(slash);
  } catch {
    // The undecoded spelling is still checked and rejected when it looks owner-like.
  }
  return Array.from(new Set([raw, slash, decoded].map((entry) => entry.toLowerCase())));
}

function isOwnerCandidate(value, expectedOwners) {
  if (expectedOwners.has(value)) return true;
  return candidateVariants(value).some((candidate) => {
    if (!candidate.startsWith('assets/js/')) return false;
    const relative = candidate.slice('assets/js/'.length);
    return /^theme-route-guard(?:$|[./_-])/u.test(relative) || PUBLIC_ROUTE_NAME_PATTERN.test(relative);
  });
}

function unsafeCandidateSpelling(value) {
  const raw = String(value || '');
  const slash = raw.replace(/\\+/gu, '/');
  let decoded;
  try {
    decoded = decodeURIComponent(slash);
  } catch {
    return true;
  }
  return (
    raw !== slash ||
    decoded !== slash ||
    raw.includes('\0') ||
    path.posix.isAbsolute(slash) ||
    path.posix.normalize(slash) !== slash ||
    slash.split('/').some((part) => part === '.' || part === '..')
  );
}

function repositoryFiles(root) {
  const stdout = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8'
  });
  return stdout.split('\0').filter(Boolean);
}

function repositoryModes(root) {
  const stdout = execFileSync('git', ['ls-files', '--stage', '-z'], {
    cwd: root,
    encoding: 'utf8'
  });
  const modes = new Map();
  stdout
    .split('\0')
    .filter(Boolean)
    .forEach((record) => {
      const match = record.match(/^(\d+)\s+[0-9a-f]+\s+\d+\t([\s\S]+)$/u);
      if (match) modes.set(match[2], match[1]);
    });
  return modes;
}

export function loadThemeRouteGuardOwnershipPolicy(file = DEFAULT_POLICY_PATH) {
  return readJson(file);
}

export function loadLegacyThemeRouteGuardInventory(root, policy) {
  const legacy = policy.legacy || {};
  const source = execFileSync('git', ['show', `${legacy.baseCommit}:${legacy.corePath}`], {
    cwd: root,
    encoding: 'utf8'
  });
  const failures = [];
  const ast = parseModule(source, `${legacy.baseCommit}:${legacy.corePath}`, failures);
  if (!ast || failures.length) throw new Error(failures.join('\n'));
  const identifiers = collectTopLevelDeclarations(ast)
    .filter((entry) =>
      legacy.declarationRanges.some(
        (range) =>
          entry.node.loc.start.line >= range.startLine &&
          entry.node.loc.end.line <= range.endLine &&
          range.kinds.includes(entry.kind)
      )
    )
    .map((entry) => entry.name);
  const digest = sha256(`${identifiers.join('\n')}\n`);
  if (identifiers.length !== legacy.expectedIdentifierCount || digest !== legacy.orderedIdentifierSha256) {
    throw new Error(
      `legacy route-guard inventory mismatch: expected ${legacy.expectedIdentifierCount}/${legacy.orderedIdentifierSha256}, found ${identifiers.length}/${digest}`
    );
  }
  return identifiers;
}

function validatePolicy(policy, failures) {
  if (!policy || policy.schemaVersion !== 1 || policy.type !== 'press-theme-route-guard-ownership-policy') {
    failures.push('theme route-guard ownership policy identity is invalid');
    return;
  }
  if (sha256(JSON.stringify(policy)) !== LOCKED_POLICY_SHA256) {
    failures.push('theme route-guard ownership policy differs from the locked review baseline');
  }
  const ownerPaths = (policy.owners || []).map((owner) => owner.path);
  if (ownerPaths.length !== 2 || new Set(ownerPaths).size !== ownerPaths.length) {
    failures.push('theme route-guard ownership policy must declare exactly two unique production owners');
  }
  if (ownerPaths[0] !== policy.paths.facade || ownerPaths[1] !== policy.paths.htmlOwner) {
    failures.push('theme route-guard owner order must be facade followed by HTML owner');
  }
}

export function checkThemeRouteGuardOwnership(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const policy = options.policy || loadThemeRouteGuardOwnershipPolicy(options.policyPath || DEFAULT_POLICY_PATH);
  const failures = [];
  validatePolicy(policy, failures);

  let legacyIdentifiers = options.legacyIdentifiers;
  if (!legacyIdentifiers) {
    try {
      legacyIdentifiers = loadLegacyThemeRouteGuardInventory(root, policy);
    } catch (err) {
      failures.push(err.message);
      legacyIdentifiers = [];
    }
  }
  const forbiddenIdentifiers = new Set([
    ...legacyIdentifiers,
    ...((policy.legacy && policy.legacy.forbiddenInternalApis) || [])
  ]);

  let files = options.repositoryFiles;
  let modes = options.repositoryModes;
  if (!files) {
    try {
      files = repositoryFiles(root);
      modes = repositoryModes(root);
    } catch (err) {
      failures.push(`cannot enumerate repository paths: ${err.message}`);
      files = [];
      modes = new Map();
    }
  }
  modes ||= new Map();

  const expectedOwners = (policy.owners || []).map((owner) => owner.path);
  const expectedOwnerSet = new Set(expectedOwners);
  const actualCandidates = files.filter((file) => isOwnerCandidate(file, expectedOwnerSet));
  if (JSON.stringify([...actualCandidates].sort()) !== JSON.stringify([...expectedOwners].sort())) {
    failures.push(
      `route-guard owner path multiset mismatch: expected ${JSON.stringify(expectedOwners)}, found ${JSON.stringify(actualCandidates)}`
    );
  }
  actualCandidates.forEach((file) => {
    if (unsafeCandidateSpelling(file))
      failures.push(`route-guard owner candidate uses an unsafe alias spelling: ${file}`);
  });

  const sources = new Map();
  const readSource = (relativePath) => {
    if (sources.has(relativePath)) return sources.get(relativePath);
    const absolute = path.join(root, relativePath);
    try {
      const source = fs.readFileSync(absolute, 'utf8');
      sources.set(relativePath, source);
      return source;
    } catch (err) {
      failures.push(`${relativePath} is missing or unreadable: ${err.message}`);
      sources.set(relativePath, '');
      return '';
    }
  };

  Array.from(new Set([...expectedOwners, ...actualCandidates])).forEach((file) => {
    const absolute = path.join(root, safeRelativePath(file));
    try {
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink()) failures.push(`route-guard owner path must not be a symlink: ${file}`);
      if (!stat.isFile()) failures.push(`route-guard owner path must be a regular file: ${file}`);
    } catch (err) {
      failures.push(`route-guard owner path cannot be inspected: ${file}: ${err.message}`);
    }
    if (modes.get(file) === '120000')
      failures.push(`tracked route-guard owner path must not use Git symlink mode: ${file}`);
  });

  [
    ...(policy.owners || []),
    ...Object.entries(policy.caps || {}).map(([file, maxLines]) => ({ path: file, maxLines }))
  ].forEach(({ path: file, maxLines }) => {
    const count = lines(readSource(file));
    if (count > maxLines) failures.push(`${file} exceeds its ${maxLines}-line ownership cap: ${count}`);
  });

  const astCache = new Map();
  const readAst = (file) => {
    if (astCache.has(file)) return astCache.get(file);
    const ast = parseModule(readSource(file), file, failures);
    astCache.set(file, ast);
    return ast;
  };

  const corpusSource = readSource(policy.paths.corpus);
  const corpusSourceDigest = sha256(corpusSource);
  if (corpusSourceDigest !== policy.corpusLock?.sourceSha256) {
    failures.push(
      `${policy.paths.corpus} source digest mismatch: expected ${policy.corpusLock?.sourceSha256}, found ${corpusSourceDigest}`
    );
  }
  const corpusAst = readAst(policy.paths.corpus);
  if (corpusAst) {
    const actualCorpusLock = exportedFrozenObject(corpusAst, 'THEME_ROUTE_GUARD_CORPUS_LOCK');
    const expectedCorpusLock = policy.corpusLock
      ? {
          cases: policy.corpusLock.cases,
          reject: policy.corpusLock.reject,
          allow: policy.corpusLock.allow,
          labelContentSha256: policy.corpusLock.labelContentSha256
        }
      : null;
    if (JSON.stringify(actualCorpusLock) !== JSON.stringify(expectedCorpusLock)) {
      failures.push(`${policy.paths.corpus} embedded lock must match the external ownership policy corpus lock`);
    }
  }

  const legacyScanFiles = [
    policy.paths.core,
    policy.paths.contractTest,
    policy.paths.packageTest,
    policy.paths.packageIndex
  ];
  legacyScanFiles.forEach((file) => {
    const ast = readAst(file);
    if (!ast) return;
    const hits = [...collectAllIdentifiers(ast)].filter((name) => forbiddenIdentifiers.has(name)).sort();
    if (hits.length) failures.push(`${file} retains forbidden legacy route-guard identifiers: ${hits.join(', ')}`);
  });

  const coreSource = readSource(policy.paths.core);
  const coreSourceDigest = sha256(coreSource);
  if (coreSourceDigest !== policy.coreDelegation?.sourceSha256) {
    failures.push(
      `${policy.paths.core} source digest mismatch: expected ${policy.coreDelegation?.sourceSha256}, found ${coreSourceDigest}`
    );
  }
  const coreAst = readAst(policy.paths.core);
  if (coreAst) {
    const ownerImports = coreAst.body.filter(
      (node) => node.type === 'ImportDeclaration' && staticString(node.source) === './theme-route-guard.js'
    );
    const importBindings = ownerImports.flatMap((node) =>
      node.specifiers.map((specifier) => ({
        imported: specifier.imported && (specifier.imported.name || specifier.imported.value),
        local: specifier.local && specifier.local.name,
        type: specifier.type
      }))
    );
    const expectedBinding = [{ imported: policy.publicExport, local: policy.publicExport, type: 'ImportSpecifier' }];
    if (ownerImports.length !== 1 || JSON.stringify(importBindings) !== JSON.stringify(expectedBinding)) {
      failures.push(`${policy.paths.core} must import only the public route-guard facade binding`);
    }
    const directExports = coreAst.body.flatMap((node) =>
      node.type === 'ExportNamedDeclaration'
        ? node.specifiers.filter(
            (specifier) =>
              (specifier.local.name || specifier.local.value) === policy.publicExport &&
              (specifier.exported.name || specifier.exported.value) === policy.publicExport
          )
        : []
    );
    const declarationExports = coreAst.body.filter(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        collectTopLevelDeclarations({ body: [node] }).some((entry) => entry.name === policy.publicExport)
    );
    if (directExports.length !== 1 || declarationExports.length !== 0) {
      failures.push(`${policy.paths.core} must directly re-export the imported public facade without a wrapper`);
    }
    const localPublicDeclarations = collectTopLevelDeclarations(coreAst).filter(
      (entry) => entry.name === policy.publicExport
    );
    if (localPublicDeclarations.length)
      failures.push(`${policy.paths.core} must not redeclare the public route-guard facade`);
    const coreFunctionName = policy.coreDelegation?.function;
    const coreDelegation = collectOwnedCalls(coreAst, coreFunctionName, policy.publicExport);
    if (
      coreDelegation.owners.length !== 1 ||
      coreDelegation.calls.length !== 1 ||
      coreDelegation.shadows.length !== 0 ||
      !isForEachDelegation(coreDelegation.calls[0], 'entries')
    ) {
      failures.push(
        `${policy.paths.core} ${coreFunctionName || 'delegation owner'} must call the unshadowed imported public facade exactly once`
      );
    }
    const coreDelegationOwner = coreDelegation.owners[0];
    if (!coreDelegationOwner || astSha256(coreDelegationOwner) !== policy.coreDelegation?.astSha256) {
      failures.push(`${policy.paths.core} route-guard delegation AST differs from the locked owner structure`);
    }
    if (collectDynamicRegexes(coreAst).length)
      failures.push(`${policy.paths.core} must not construct dynamic regular expressions`);
    const implicitRegexes = collectImplicitRegexCalls(coreAst);
    if (implicitRegexes.length) {
      failures.push(
        `${policy.paths.core} contains implicit regular-expression APIs outside the reviewed literal baseline: ${implicitRegexes
          .map(({ method, pattern }) => `.${method}(${pattern == null ? '<dynamic>' : JSON.stringify(pattern)})`)
          .join(', ')}`
      );
    }
    const routeScannerStrings = collectRouteScannerStrings(coreAst);
    if (routeScannerStrings.length) {
      failures.push(
        `${policy.paths.core} contains route-scanner string literals outside the owner facade: ${JSON.stringify(
          routeScannerStrings
        )}`
      );
    }
    if (JSON.stringify(actualRegexMultiset(coreAst)) !== JSON.stringify(expectedRegexMultiset(policy))) {
      failures.push(`${policy.paths.core} regular-expression inventory differs from the non-route baseline`);
    }
  }

  const facadeAst = readAst(policy.paths.facade);
  if (facadeAst) {
    const publicExports = exportedNames(facadeAst).filter((name) => name === policy.publicExport);
    if (publicExports.length !== 1)
      failures.push(`${policy.paths.facade} must own exactly one public route-guard export`);
    const facadeReferences = collectModuleReferenceRecords(facadeAst);
    const actualFacadeReferences = facadeReferences
      .filter((record) => record.kind === 'ImportDeclaration' && record.specifier != null)
      .map((record) => record.specifier)
      .sort();
    if (
      facadeReferences.length !== LOCKED_FACADE_REFERENCES.length ||
      JSON.stringify(actualFacadeReferences) !== JSON.stringify(LOCKED_FACADE_REFERENCES)
    ) {
      failures.push(`${policy.paths.facade} module references must match the locked owner dependency set`);
    }
    const htmlImports = facadeAst.body.filter(
      (node) => node.type === 'ImportDeclaration' && staticString(node.source) === './theme-route-guard-html.js'
    );
    const htmlBindings = htmlImports.flatMap((node) =>
      node.specifiers
        .filter((specifier) => specifier.type === 'ImportSpecifier')
        .map((specifier) => ({
          imported: specifier.imported.name || specifier.imported.value,
          local: specifier.local.name
        }))
    );
    const expectedHtmlBindings = LOCKED_HTML_EXPORTS.map((name) => ({ imported: name, local: name }));
    if (htmlImports.length !== 1 || JSON.stringify(htmlBindings) !== JSON.stringify(expectedHtmlBindings)) {
      failures.push(`${policy.paths.facade} must import the HTML owner through named bindings exactly once`);
    }
    htmlBindings.forEach((binding) => {
      const delegation = collectOwnedCalls(facadeAst, policy.publicExport, binding.local);
      if (
        delegation.owners.length !== 1 ||
        delegation.calls.length !== 1 ||
        delegation.shadows.length !== 0 ||
        !isDirectOwnerCall(delegation.calls[0])
      ) {
        failures.push(`${policy.paths.facade} does not directly delegate to HTML owner binding ${binding.local}`);
      }
    });
  }

  const htmlAst = readAst(policy.paths.htmlOwner);
  if (htmlAst) {
    if (JSON.stringify(exportedNames(htmlAst).sort()) !== JSON.stringify([...LOCKED_HTML_EXPORTS].sort())) {
      failures.push(`${policy.paths.htmlOwner} exports must match the locked HTML owner surface`);
    }
    if (collectModuleReferenceRecords(htmlAst).length !== 0) {
      failures.push(`${policy.paths.htmlOwner} must not reference another module`);
    }
  }

  const productionFiles = Array.from(
    new Set(
      files.filter(
        (file) =>
          NODE_SOURCE_PATTERN.test(file) &&
          (file.startsWith('assets/js/') || file.startsWith('packages/press-theme-contract/')) &&
          !file.startsWith('assets/js/vendor/')
      )
    )
  );
  productionFiles.forEach((file) => {
    const ast = readAst(file);
    if (!ast) return;
    const isOwner = expectedOwnerSet.has(file);
    const declarationAllowlist = new Set(
      (policy.legacy &&
        policy.legacy.nonOwnerDeclarationAllowlist &&
        policy.legacy.nonOwnerDeclarationAllowlist[file]) ||
        []
    );
    const declaredLegacy = collectTopLevelDeclarations(ast)
      .map((entry) => entry.name)
      .filter((name) => forbiddenIdentifiers.has(name) && !declarationAllowlist.has(name));
    if (!isOwner && declaredLegacy.length) {
      failures.push(
        `${file} declares legacy route-guard ownership outside the owner set: ${declaredLegacy.join(', ')}`
      );
    }
    collectModuleReferences(ast).forEach((specifier) => {
      const inspected = inspectLocalImport(file, specifier);
      const target = inspected.target || resolvedLocalImport(file, specifier);
      if (!isOwner && /(?:^|\/)acorn(?:-walk)?\.m?js$/iu.test(specifier)) {
        failures.push(`${file} imports Acorn outside the route-guard owner set: ${specifier}`);
      }
      if (target === policy.paths.htmlOwner && file !== policy.paths.facade) {
        failures.push(`${file} bypasses the public facade and imports the HTML owner directly`);
      }
      if (target === policy.paths.facade && file !== policy.paths.core) {
        failures.push(`${file} bypasses theme-package-core ownership of the public facade`);
      }
      if (expectedOwnerSet.has(target) && inspected.unsafe) {
        failures.push(`${file} imports a route-guard owner through a noncanonical alias: ${specifier}`);
      }
    });
    if (!isOwner && [policy.paths.core, policy.paths.packageIndex].includes(file)) {
      collectRegexLiterals(ast).forEach((regex) => {
        if (routeRegexSignature(regex.pattern))
          failures.push(`${file} contains a renamed legacy route-scanner regex: /${regex.pattern}/${regex.flags}`);
      });
    }
  });

  (policy.packageLists || []).forEach((entry) => {
    if (entry.kind === 'package-files') {
      try {
        const manifest = JSON.parse(readSource(entry.path));
        expectedOwners.forEach((owner) => {
          const count = (Array.isArray(manifest.files) ? manifest.files : []).filter((file) => file === owner).length;
          if (count !== entry.ownerLiteralOccurrences) {
            failures.push(
              `${entry.path} must list ${owner} exactly ${entry.ownerLiteralOccurrences} time(s); found ${count}`
            );
          }
        });
      } catch (err) {
        failures.push(`${entry.path} package manifest is invalid: ${err.message}`);
      }
      return;
    }
    const ast = readAst(entry.path);
    if (!ast) return;
    const literals = collectStringLiterals(ast);
    expectedOwners.forEach((owner) => {
      const count = literals.filter((literal) => literal === owner).length;
      if (count !== entry.ownerLiteralOccurrences) {
        failures.push(
          `${entry.path} must contain ${owner} exactly ${entry.ownerLiteralOccurrences} time(s); found ${count}`
        );
      }
    });
  });

  const packageAst = readAst(policy.paths.packageIndex);
  if (packageAst) {
    const destructured = packageAst.body.some(
      (node) =>
        node.type === 'VariableDeclaration' &&
        node.declarations.some(
          (declaration) =>
            declaration.id.type === 'ObjectPattern' &&
            declaration.init &&
            declaration.init.type === 'Identifier' &&
            declaration.init.name === 'themePackageCore' &&
            declaration.id.properties.some(
              (property) =>
                property.type === 'Property' &&
                property.value &&
                property.value.type === 'Identifier' &&
                property.value.name === policy.publicExport
            )
        )
    );
    const directExport = packageAst.body.some(
      (node) =>
        node.type === 'ExportNamedDeclaration' &&
        node.specifiers.some(
          (specifier) =>
            (specifier.local.name || specifier.local.value) === policy.publicExport &&
            (specifier.exported.name || specifier.exported.value) === policy.publicExport
        )
    );
    const wrapperDeclaration = packageAst.body.some((node) => {
      const declaration = unwrapTopLevel(node);
      if (!declaration) return false;
      if (
        (declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') &&
        declaration.id &&
        declaration.id.name === policy.publicExport
      )
        return true;
      if (declaration.type !== 'VariableDeclaration') return false;
      return declaration.declarations.some((entry) => {
        if (!bindingNames(entry.id).includes(policy.publicExport)) return false;
        return !(
          entry.id.type === 'ObjectPattern' &&
          entry.init &&
          entry.init.type === 'Identifier' &&
          entry.init.name === 'themePackageCore'
        );
      });
    });
    if (!destructured || !directExport || wrapperDeclaration) {
      failures.push(`${policy.paths.packageIndex} must directly delegate its public export to themePackageCore`);
    }
    const packageDelegation = collectOwnedCalls(packageAst, 'validateThemeRouteHelperContract', policy.publicExport);
    if (
      packageDelegation.owners.length !== 1 ||
      packageDelegation.calls.length !== 1 ||
      packageDelegation.shadows.length !== 0 ||
      !isForEachDelegation(packageDelegation.calls[0], 'routeGuardFiles')
    ) {
      failures.push(
        `${policy.paths.packageIndex} validateThemeRouteHelperContract must call the unshadowed delegated public export exactly once`
      );
    }
  }

  return failures;
}

function isMain() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMain()) {
  const failures = checkThemeRouteGuardOwnership();
  if (failures.length) {
    console.error('Theme route-guard ownership check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log('Theme route-guard ownership check passed.');
}
