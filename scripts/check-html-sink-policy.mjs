#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../assets/js/vendor/acorn.mjs';
import { ancestor } from '../assets/js/vendor/acorn-walk.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const POLICY_PATH = path.join(SCRIPT_DIR, 'html-sink-policy.json');
const JAVASCRIPT_ROOTS = ['assets/i18n', 'assets/js', 'assets/themes/native'];
const JAVASCRIPT_FILES = ['assets/main.js'];
const ENTRYPOINTS = ['index.html', 'index_editor.html', 'index_editor_preview.html'];
const EXECUTABLE_EXTENSIONS = new Set(['.js', '.mjs']);
const APPROVED_KINDS = new Set([
  'dynamic-import',
  'innerHTML-write',
  'insertAdjacentHTML',
  'serializer-read',
  'timer-callback-control'
]);
const REVIEWED_HTML_CLASSIFICATIONS = new Set([
  'controlled-parser',
  'escaped-ui-template',
  'i18n-bundle-html',
  'static-template',
  'trusted-theme-template'
]);
const POLICY_CLASSIFICATIONS = {
  'controlled-parser': 'A controlled DOM serializer or parser bridge whose producer is separately bounded.',
  'empty-clear': 'A constant empty-string assignment that removes child markup without parsing HTML.',
  'escaped-ui-template': 'A first-party UI template whose variable text and attributes use bounded escaping helpers.',
  'executable-extension-allowlist': 'A reviewed non-literal import restricted to declared executable extensions.',
  'i18n-bundle-html': 'A versioned first-party translation value intentionally rendered as localized markup.',
  'literal-import': 'A source-literal dynamic import whose executable module path is reviewable in place.',
  'reviewed-callback-control': 'A callback supplied through a reviewed higher-order timer boundary.',
  'static-template': 'A source-static or constant-table UI template without user-controlled HTML.',
  'trusted-theme-template': 'A trusted first-party theme or component template rendered through its owned contract.'
};
const POLICY_RATIONALE =
  'A universal sanitizer is not applicable because Press intentionally renders several trusted templates and separately sanitized renderer outputs. Exact AST fingerprints make every existing HTML serializer and dynamic import occurrence reviewable while prohibited executable sinks remain at zero.';
const EXPECTED_COUNTS = {
  dynamicImports: 12,
  innerHTMLEmptyWrites: 65,
  innerHTMLWrites: 112,
  insertAdjacentHTML: 2,
  prohibited: 0,
  serializerReads: 4,
  timerCallbackControls: 8
};
const REVIEWED_NON_LITERAL_IMPORTS = new Map([
  [
    'assets/js/i18n.js|moduleHref',
    {
      executableExtensions: ['.js'],
      control: {
        path: 'assets/js/i18n.js',
        function: 'resolveLanguageModuleUrl',
        enforces: ['.js-extension', 'same-origin']
      },
      rationale: 'Language bundles resolve from the versioned languages manifest or the same-origin .js fallback path.'
    }
  ],
  [
    'assets/js/theme-layout.js|path',
    {
      executableExtensions: ['.js'],
      control: {
        path: 'assets/js/theme-layout.js',
        function: 'resolveModuleEntry',
        enforces: ['.js-extension', 'same-origin-theme-root', 'traversal-rejection']
      },
      rationale: 'Theme modules resolve from reviewed theme manifest entries under the selected same-origin theme pack.'
    }
  ]
]);
const REVIEWED_TIMER_CALLBACKS = new Map([
  [
    'assets/js/errors.js|callback',
    'The error runtime forwards a callback parameter through its window-or-global timer adapter.'
  ],
  [
    'assets/js/post-render.js|r',
    'The Promise executor resolve callback is forwarded only to implement the local delay helper.'
  ],
  [
    'assets/js/publish/transports/connect-transport.js|resolve',
    'The Promise executor resolve callback is forwarded only to implement the transport delay helper.'
  ],
  [
    'assets/js/syntax-highlight.js|handler',
    'The syntax-highlight scheduler forwards its reviewed callback parameter to the injected timer adapter.'
  ],
  [
    'assets/themes/native/modules/interactions.js|cb',
    'The native theme animation-frame fallback forwards its callback parameter to a short timer.'
  ],
  [
    'assets/themes/native/modules/interactions.js|fn',
    'The native theme debounce helpers forward their callback parameter to a short timer.'
  ]
]);

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function createBindingResolver(ast) {
  const bindings = new Map();

  function patternIdentifiers(pattern, identifiers = []) {
    if (!pattern) return identifiers;
    if (pattern.type === 'Identifier') identifiers.push(pattern);
    else if (pattern.type === 'AssignmentPattern') patternIdentifiers(pattern.left, identifiers);
    else if (pattern.type === 'RestElement') patternIdentifiers(pattern.argument, identifiers);
    else if (pattern.type === 'ArrayPattern') {
      for (const element of pattern.elements) patternIdentifiers(element, identifiers);
    } else if (pattern.type === 'ObjectPattern') {
      for (const property of pattern.properties) {
        patternIdentifiers(property.type === 'RestElement' ? property.argument : property.value, identifiers);
      }
    }
    return identifiers;
  }

  function isFunctionScope(node) {
    return ['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'].includes(node?.type);
  }

  function lexicalScope(ancestors, { functionScoped = false, includeOwn = false } = {}) {
    const startIndex = includeOwn ? ancestors.length - 1 : ancestors.length - 2;
    for (let index = startIndex; index >= 0; index -= 1) {
      const candidate = ancestors[index];
      if (candidate.type === 'Program' || isFunctionScope(candidate)) return candidate;
      if (
        !functionScoped &&
        [
          'BlockStatement',
          'CatchClause',
          'ClassExpression',
          'ForInStatement',
          'ForOfStatement',
          'ForStatement',
          'SwitchStatement'
        ].includes(candidate.type)
      ) {
        return candidate;
      }
    }
    return ast;
  }

  function record(identifier, binding) {
    if (!identifier?.name) return;
    const candidates = bindings.get(identifier.name) || [];
    candidates.push({ ...binding, declaration: identifier, mutated: false });
    bindings.set(identifier.name, candidates);
  }

  function recordPattern(pattern, binding) {
    for (const identifier of patternIdentifiers(pattern)) record(identifier, binding);
  }

  ancestor(ast, {
    VariableDeclarator(node, ancestors) {
      const declaration = ancestors[ancestors.length - 2];
      if (declaration?.type !== 'VariableDeclaration') return;
      const scope = lexicalScope(ancestors, { functionScoped: declaration.kind === 'var' });
      if (node.id.type === 'Identifier' && node.init) {
        record(node.id, { kind: 'const', node: node.init, scope });
      } else {
        recordPattern(node.id, { kind: 'opaque', node, scope });
      }
    },
    FunctionDeclaration(node, ancestors) {
      if (node.id) record(node.id, { kind: 'function', node, scope: lexicalScope(ancestors) });
      for (const parameter of node.params) {
        recordPattern(parameter, {
          kind: 'opaque',
          node: parameter,
          scope: lexicalScope(ancestors, { includeOwn: true })
        });
      }
    },
    FunctionExpression(node, ancestors) {
      const scope = lexicalScope(ancestors, { includeOwn: true });
      if (node.id) record(node.id, { kind: 'function', node, scope });
      for (const parameter of node.params) recordPattern(parameter, { kind: 'opaque', node: parameter, scope });
    },
    ArrowFunctionExpression(node, ancestors) {
      const scope = lexicalScope(ancestors, { includeOwn: true });
      for (const parameter of node.params) recordPattern(parameter, { kind: 'opaque', node: parameter, scope });
    },
    CatchClause(node, ancestors) {
      if (node.param) {
        recordPattern(node.param, {
          kind: 'opaque',
          node: node.param,
          scope: lexicalScope(ancestors, { includeOwn: true })
        });
      }
    },
    ClassDeclaration(node, ancestors) {
      if (node.id) record(node.id, { kind: 'opaque', node, scope: lexicalScope(ancestors) });
    },
    ClassExpression(node, ancestors) {
      if (node.id) {
        record(node.id, { kind: 'opaque', node, scope: lexicalScope(ancestors, { includeOwn: true }) });
      }
    },
    ImportSpecifier(node) {
      record(node.local, { kind: 'opaque', node, scope: ast });
    },
    ImportDefaultSpecifier(node) {
      record(node.local, { kind: 'opaque', node, scope: ast });
    },
    ImportNamespaceSpecifier(node) {
      record(node.local, { kind: 'opaque', node, scope: ast });
    }
  });

  function resolveBinding(identifier) {
    if (identifier?.type !== 'Identifier') return null;
    const containing = (bindings.get(identifier.name) || []).filter(
      ({ scope }) => scope.start <= identifier.start && scope.end >= identifier.end
    );
    if (containing.length === 0) return null;
    const smallestSpan = Math.min(...containing.map(({ scope }) => scope.end - scope.start));
    const nearest = containing.filter(({ scope }) => scope.end - scope.start === smallestSpan);
    return nearest.length === 1 ? nearest[0] : null;
  }

  function markMutated(pattern) {
    for (const identifier of patternIdentifiers(pattern)) {
      const binding = resolveBinding(identifier);
      if (binding) binding.mutated = true;
    }
  }

  ancestor(ast, {
    AssignmentExpression(node) {
      markMutated(node.left);
    },
    UpdateExpression(node) {
      markMutated(node.argument);
    },
    ForInStatement(node) {
      if (node.left.type !== 'VariableDeclaration') markMutated(node.left);
    },
    ForOfStatement(node) {
      if (node.left.type !== 'VariableDeclaration') markMutated(node.left);
    }
  });

  function resolvePrimitive(node, seen = new Set()) {
    if (!node) return { known: false, value: undefined };
    if (node.type === 'Literal' && ['string', 'number', 'boolean'].includes(typeof node.value)) {
      return { known: true, value: node.value };
    }
    if (node.type === 'Identifier') {
      const binding = resolveBinding(node);
      if (!binding || binding.kind !== 'const' || binding.mutated || seen.has(binding)) {
        return { known: false, value: undefined };
      }
      const nextSeen = new Set(seen);
      nextSeen.add(binding);
      return resolvePrimitive(binding.node, nextSeen);
    }
    if (node.type === 'TemplateLiteral') {
      let value = '';
      for (let index = 0; index < node.quasis.length; index += 1) {
        value += node.quasis[index].value.cooked ?? node.quasis[index].value.raw;
        if (index < node.expressions.length) {
          const expression = resolvePrimitive(node.expressions[index], seen);
          if (!expression.known) return { known: false, value: undefined };
          value += String(expression.value);
        }
      }
      return { known: true, value };
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      const left = resolvePrimitive(node.left, seen);
      const right = resolvePrimitive(node.right, seen);
      if (left.known && right.known) return { known: true, value: left.value + right.value };
    }
    return { known: false, value: undefined };
  }

  function isCallable(node, seen = new Set()) {
    if (!node) return false;
    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') return true;
    if (node.type !== 'Identifier') return false;
    const binding = resolveBinding(node);
    if (!binding || binding.mutated || seen.has(binding)) return false;
    if (binding.kind === 'function') return true;
    const nextSeen = new Set(seen);
    nextSeen.add(binding);
    return isCallable(binding.node, nextSeen);
  }

  return { isCallable, resolvePrimitive };
}

function staticStringValue(node, resolver) {
  const resolved = resolver.resolvePrimitive(node);
  return resolved.known && typeof resolved.value === 'string' ? resolved.value : null;
}

function propertyName(node, resolver) {
  if (!node || node.type !== 'MemberExpression') return '';
  if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
  return node.computed ? staticStringValue(node.property, resolver) || '' : '';
}

function calleeName(node, resolver) {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  return propertyName(node, resolver);
}

function isDocumentObject(node, resolver) {
  if (!node) return false;
  if (node.type === 'Identifier') return node.name === 'document';
  return propertyName(node, resolver) === 'document';
}

function literalImportValue(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join('');
  }
  return null;
}

function containsNode(container, node) {
  return container && node && container.start <= node.start && container.end >= node.end;
}

function mutationOwner(node, ancestors) {
  for (let index = ancestors.length - 2; index >= 0; index -= 1) {
    const candidate = ancestors[index];
    if (candidate.type === 'AssignmentExpression' && containsNode(candidate.left, node)) return candidate;
    if (candidate.type === 'UpdateExpression' && containsNode(candidate.argument, node)) return candidate;
    if (
      candidate.type === 'UnaryExpression' &&
      candidate.operator === 'delete' &&
      containsNode(candidate.argument, node)
    ) {
      return candidate;
    }
  }
  return null;
}

function serializerOwner(node, ancestors) {
  for (let index = ancestors.length - 2; index >= 0; index -= 1) {
    const candidate = ancestors[index];
    if (candidate.type === 'VariableDeclarator') return candidate;
    if (candidate.type.endsWith('Statement') || candidate.type.endsWith('Declaration')) return candidate;
  }
  return node;
}

function compactEvidence(source) {
  const compact = source.replaceAll(/\s+/gu, ' ').trim();
  return compact.length <= 180 ? compact : `${compact.slice(0, 177)}...`;
}

function occurrenceFingerprint({ path: filePath, kind, source }) {
  return createHash('sha256')
    .update(JSON.stringify([filePath, kind, source]))
    .digest('hex');
}

function createOccurrence(filePath, kind, node, source, details = {}) {
  const exactSource = source.slice(node.start, node.end);
  return {
    path: filePath,
    kind,
    line: node.loc.start.line,
    column: node.loc.start.column + 1,
    fingerprint: occurrenceFingerprint({ path: filePath, kind, source: exactSource }),
    evidence: compactEvidence(exactSource),
    ...details
  };
}

function parseSource(source, filePath, sourceType = 'module') {
  try {
    return parse(source, {
      ecmaVersion: 'latest',
      locations: true,
      sourceType,
      allowAwaitOutsideFunction: sourceType === 'module',
      allowHashBang: true
    });
  } catch (error) {
    fail(`cannot parse ${filePath}: ${error.message}`);
  }
}

function nonLiteralImportApproval(filePath, node, source) {
  const argumentSource = source.slice(node.source.start, node.source.end);
  const approval = REVIEWED_NON_LITERAL_IMPORTS.get(`${filePath}|${argumentSource}`);
  if (!approval) return null;
  return {
    argument: argumentSource,
    executableExtensions: approval.executableExtensions,
    control: approval.control,
    rationale: approval.rationale
  };
}

function reviewedTimerCallbackApproval(filePath, node, source) {
  const argument = node.arguments[0];
  const argumentSource = argument ? source.slice(argument.start, argument.end) : '';
  const approval = REVIEWED_TIMER_CALLBACKS.get(`${filePath}|${argumentSource}`);
  if (!approval) return null;
  return { argument: argumentSource, rationale: approval };
}

export function scanJavaScriptSource({ filePath, source, sourceType = 'module' }) {
  const ast = parseSource(source, filePath, sourceType);
  const resolver = createBindingResolver(ast);
  const approved = [];
  const prohibited = [];
  const handledSerializerOwners = new Set();

  ancestor(ast, {
    MemberExpression(node, ancestors) {
      const name = propertyName(node, resolver);
      if (!['innerHTML', 'outerHTML', 'srcdoc'].includes(name)) return;
      const mutation = mutationOwner(node, ancestors);
      if (mutation) {
        const suffix = mutation.type === 'UnaryExpression' ? 'delete' : 'write';
        if (name === 'innerHTML' && suffix === 'write') {
          approved.push(
            createOccurrence(filePath, 'innerHTML-write', mutation, source, {
              empty:
                mutation.type === 'AssignmentExpression' &&
                mutation.left === node &&
                staticStringValue(mutation.right, resolver) === ''
            })
          );
        } else {
          prohibited.push(createOccurrence(filePath, `${name}-${suffix}`, mutation, source));
        }
        return;
      }
      if (name === 'srcdoc') return;
      const owner = serializerOwner(node, ancestors);
      const ownerKey = `${owner.start}:${owner.end}:${name}`;
      if (handledSerializerOwners.has(ownerKey)) return;
      handledSerializerOwners.add(ownerKey);
      approved.push(createOccurrence(filePath, 'serializer-read', owner, source, { property: name }));
    },

    CallExpression(node) {
      const name = calleeName(node.callee, resolver);
      if (name === 'insertAdjacentHTML') {
        approved.push(createOccurrence(filePath, 'insertAdjacentHTML', node, source));
      }
      if (
        (name === 'write' || name === 'writeln') &&
        node.callee.type === 'MemberExpression' &&
        isDocumentObject(node.callee.object, resolver)
      ) {
        prohibited.push(createOccurrence(filePath, `document.${name}`, node, source));
      }
      if (name === 'parseFromString') {
        const mime = staticStringValue(node.arguments[1], resolver);
        if (mime === null) {
          prohibited.push(createOccurrence(filePath, 'DOMParser-unproven-mime', node, source));
        } else if (/^text\/html(?:\s*;|$)/iu.test(mime.trim())) {
          prohibited.push(createOccurrence(filePath, 'DOMParser-text-html', node, source));
        }
      }
      if (name === 'createContextualFragment') {
        prohibited.push(createOccurrence(filePath, 'createContextualFragment', node, source));
      }
      if (name === 'eval') {
        prohibited.push(createOccurrence(filePath, 'eval', node, source));
      }
      if (name === 'Function') {
        prohibited.push(createOccurrence(filePath, 'Function-constructor-call', node, source));
      }
      if (name === 'setTimeout' || name === 'setInterval') {
        const timerString = staticStringValue(node.arguments[0], resolver);
        if (timerString !== null) {
          prohibited.push(createOccurrence(filePath, `${name}-string`, node, source));
        } else if (!resolver.isCallable(node.arguments[0])) {
          const approval = reviewedTimerCallbackApproval(filePath, node, source);
          if (approval) {
            approved.push(createOccurrence(filePath, 'timer-callback-control', node, source, approval));
          } else {
            prohibited.push(createOccurrence(filePath, `${name}-unproven-callback`, node, source));
          }
        }
      }
      if (name === 'setAttribute' && staticStringValue(node.arguments[0], resolver)?.toLowerCase() === 'srcdoc') {
        prohibited.push(createOccurrence(filePath, 'srcdoc-setAttribute', node, source));
      }
    },

    NewExpression(node) {
      if (calleeName(node.callee, resolver) === 'Function') {
        prohibited.push(createOccurrence(filePath, 'new-Function', node, source));
      }
    },

    ImportExpression(node) {
      const literal = literalImportValue(node.source);
      if (literal !== null) {
        approved.push(
          createOccurrence(filePath, 'dynamic-import', node, source, {
            literal
          })
        );
        return;
      }
      const approval = nonLiteralImportApproval(filePath, node, source);
      if (!approval) {
        prohibited.push(createOccurrence(filePath, 'non-literal-dynamic-import', node, source));
        return;
      }
      approved.push(createOccurrence(filePath, 'dynamic-import', node, source, approval));
    }
  });

  return { approved, prohibited };
}

async function listJavaScriptFiles(relativeDirectory) {
  const absoluteDirectory = path.join(REPO_ROOT, relativeDirectory);
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(REPO_ROOT, relativePath);
    const stats = await lstat(absolutePath);
    assert(!stats.isSymbolicLink(), `sink-policy scope must not contain symbolic links: ${relativePath}`);
    if (entry.isDirectory()) {
      if (relativePath === 'assets/js/vendor') continue;
      files.push(...(await listJavaScriptFiles(relativePath)));
      continue;
    }
    if (entry.isFile() && /\.(?:js|mjs)$/u.test(entry.name)) files.push(relativePath);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function extractInlineScripts(html, filePath) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu;
  for (const match of html.matchAll(pattern)) {
    const attributes = match[1] || '';
    if (/\bsrc\s*=/iu.test(attributes)) continue;
    const source = match[2] || '';
    if (!source.trim()) continue;
    const typeMatch = attributes.match(/\btype\s*=\s*["']([^"']+)["']/iu);
    const sourceType = typeMatch?.[1]?.toLowerCase() === 'module' ? 'module' : 'script';
    scripts.push({
      filePath: `${filePath}#inline-script-${scripts.length + 1}`,
      source,
      sourceType
    });
  }
  return scripts;
}

function sortOccurrences(occurrences) {
  return [...occurrences].sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.column - right.column ||
      left.kind.localeCompare(right.kind)
  );
}

async function controlFingerprint(control) {
  const source = await readFile(path.join(REPO_ROOT, control.path), 'utf8');
  const ast = parseSource(source, control.path);
  const matches = [];
  ancestor(ast, {
    FunctionDeclaration(node) {
      if (node.id?.name === control.function) matches.push(node);
    }
  });
  assert(matches.length === 1, `${control.path} must define exactly one ${control.function} control`);
  const exactSource = source.slice(matches[0].start, matches[0].end);
  return createHash('sha256')
    .update(JSON.stringify([control.path, control.function, exactSource]))
    .digest('hex');
}

async function bindImportControls(occurrences) {
  const cache = new Map();
  for (const occurrence of occurrences) {
    if (occurrence.kind !== 'dynamic-import' || !occurrence.control) continue;
    const key = `${occurrence.control.path}|${occurrence.control.function}`;
    if (!cache.has(key)) cache.set(key, await controlFingerprint(occurrence.control));
    occurrence.control = { ...occurrence.control, fingerprint: cache.get(key) };
  }
}

export async function scanRepository() {
  const approved = [];
  const prohibited = [];
  const scannedFiles = [...JAVASCRIPT_FILES];
  for (const root of JAVASCRIPT_ROOTS) scannedFiles.push(...(await listJavaScriptFiles(root)));
  for (const filePath of [...new Set(scannedFiles)].sort((left, right) => left.localeCompare(right))) {
    const stats = await lstat(path.join(REPO_ROOT, filePath));
    assert(stats.isFile() && !stats.isSymbolicLink(), `sink-policy file must be regular: ${filePath}`);
    const source = await readFile(path.join(REPO_ROOT, filePath), 'utf8');
    const result = scanJavaScriptSource({ filePath, source });
    approved.push(...result.approved);
    prohibited.push(...result.prohibited);
  }
  for (const filePath of ENTRYPOINTS) {
    const stats = await lstat(path.join(REPO_ROOT, filePath));
    assert(stats.isFile() && !stats.isSymbolicLink(), `sink-policy entrypoint must be regular: ${filePath}`);
    const html = await readFile(path.join(REPO_ROOT, filePath), 'utf8');
    for (const inlineScript of extractInlineScripts(html, filePath)) {
      const result = scanJavaScriptSource({
        filePath: inlineScript.filePath,
        source: inlineScript.source,
        sourceType: inlineScript.sourceType
      });
      approved.push(...result.approved);
      prohibited.push(...result.prohibited);
    }
  }
  await bindImportControls(approved);
  return {
    approved: sortOccurrences(approved),
    prohibited: sortOccurrences(prohibited)
  };
}

function occurrenceKey(occurrence) {
  const metadata = {};
  for (const key of ['empty', 'property', 'literal', 'argument', 'executableExtensions', 'control']) {
    if (Object.hasOwn(occurrence, key)) metadata[key] = occurrence[key];
  }
  return JSON.stringify([occurrence.path, occurrence.kind, occurrence.fingerprint, occurrence.evidence, metadata]);
}

function dispositionHash(entry) {
  return createHash('sha256')
    .update(JSON.stringify([occurrenceKey(entry), entry.classification, entry.rationale]))
    .digest('hex');
}

function countByKey(occurrences) {
  const counts = new Map();
  for (const occurrence of occurrences) {
    const key = occurrenceKey(occurrence);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function inventoryCounts(inventory) {
  return {
    dynamicImports: inventory.approved.filter(({ kind }) => kind === 'dynamic-import').length,
    innerHTMLEmptyWrites: inventory.approved.filter(({ kind, empty }) => kind === 'innerHTML-write' && empty).length,
    innerHTMLWrites: inventory.approved.filter(({ kind }) => kind === 'innerHTML-write').length,
    insertAdjacentHTML: inventory.approved.filter(({ kind }) => kind === 'insertAdjacentHTML').length,
    prohibited: inventory.prohibited.length,
    serializerReads: inventory.approved.filter(({ kind }) => kind === 'serializer-read').length,
    timerCallbackControls: inventory.approved.filter(({ kind }) => kind === 'timer-callback-control').length
  };
}

function formatOccurrence(occurrence) {
  return `${occurrence.path}:${occurrence.line}:${occurrence.column} ${occurrence.kind} ${occurrence.evidence}`;
}

function validatePolicyShape(policy) {
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'sink policy must be an object');
  assert(policy.schemaVersion === 1, 'sink policy schemaVersion must equal 1');
  assert(policy.decision === 'accepted-baseline-with-zero-growth', 'sink policy decision must remain explicit');
  assert(policy.rationale === POLICY_RATIONALE, 'sink policy rationale drift');
  assert(
    JSON.stringify(policy.classifications) === JSON.stringify(POLICY_CLASSIFICATIONS),
    'sink policy classification definitions drift'
  );
  assert(
    JSON.stringify(policy.scope?.javascriptRoots) === JSON.stringify(JAVASCRIPT_ROOTS),
    'sink policy JS root drift'
  );
  assert(
    JSON.stringify(policy.scope?.javascriptFiles) === JSON.stringify(JAVASCRIPT_FILES),
    'sink policy JS file drift'
  );
  assert(
    JSON.stringify(policy.scope?.excluded) === JSON.stringify(['assets/js/vendor/**']),
    'sink policy exclusion drift'
  );
  assert(JSON.stringify(policy.scope?.entrypoints) === JSON.stringify(ENTRYPOINTS), 'sink policy entrypoint drift');
  assert(Array.isArray(policy.approved), 'sink policy approved inventory must be an array');
  assert(JSON.stringify(policy.expected) === JSON.stringify(EXPECTED_COUNTS), 'sink policy expected counts drift');
  for (const [index, entry] of policy.approved.entries()) {
    assert(APPROVED_KINDS.has(entry.kind), `approved[${index}] has unsupported kind ${entry.kind}`);
    assert(typeof entry.path === 'string' && entry.path, `approved[${index}] must record a path`);
    assert(/^[a-f0-9]{64}$/u.test(entry.fingerprint), `approved[${index}] must record a SHA-256 fingerprint`);
    assert(typeof entry.evidence === 'string' && entry.evidence, `approved[${index}] must retain evidence`);
    assert(
      typeof entry.rationale === 'string' && entry.rationale.length >= 24,
      `approved[${index}] must retain a review rationale`
    );
    assert(
      /^[a-f0-9]{64}$/u.test(entry.dispositionHash) && entry.dispositionHash === dispositionHash(entry),
      `approved[${index}] disposition hash must bind occurrence evidence, metadata, classification, and rationale`
    );
    if (entry.kind === 'innerHTML-write' && entry.empty === true) {
      assert(entry.classification === 'empty-clear', `approved[${index}] empty clear classification drift`);
    } else if (entry.kind === 'dynamic-import' && Object.hasOwn(entry, 'literal')) {
      assert(entry.classification === 'literal-import', `approved[${index}] literal import classification drift`);
    } else if (entry.kind === 'dynamic-import') {
      assert(
        entry.classification === 'executable-extension-allowlist',
        `approved[${index}] non-literal import classification drift`
      );
      assert(
        Array.isArray(entry.executableExtensions) && entry.executableExtensions.length > 0,
        `approved[${index}] non-literal import must declare executableExtensions`
      );
      for (const extension of entry.executableExtensions) {
        assert(EXECUTABLE_EXTENSIONS.has(extension), `approved[${index}] has unsafe executable extension ${extension}`);
      }
      assert(
        entry.control &&
          typeof entry.control.path === 'string' &&
          typeof entry.control.function === 'string' &&
          Array.isArray(entry.control.enforces) &&
          /^[a-f0-9]{64}$/u.test(entry.control.fingerprint),
        `approved[${index}] non-literal import must bind its executable path control`
      );
    } else if (entry.kind === 'timer-callback-control') {
      assert(
        entry.classification === 'reviewed-callback-control' && typeof entry.argument === 'string' && entry.argument,
        `approved[${index}] timer callback control classification drift`
      );
    } else {
      assert(
        REVIEWED_HTML_CLASSIFICATIONS.has(entry.classification),
        `approved[${index}] non-empty HTML occurrence needs one reviewed classification`
      );
    }
  }
}

export function verifyInventory(inventory, policy) {
  validatePolicyShape(policy);
  const errors = [];
  if (inventory.prohibited.length > 0) {
    errors.push(...inventory.prohibited.map((occurrence) => `prohibited sink: ${formatOccurrence(occurrence)}`));
  }

  const expected = countByKey(policy.approved);
  const actual = countByKey(inventory.approved);
  for (const [key, count] of actual) {
    const approvedCount = expected.get(key) || 0;
    if (count > approvedCount) errors.push(`unapproved sink fingerprint (${count - approvedCount} extra): ${key}`);
  }
  for (const [key, count] of expected) {
    const observedCount = actual.get(key) || 0;
    if (observedCount < count)
      errors.push(`approved sink changed or disappeared (${count - observedCount} missing): ${key}`);
  }

  const actualCounts = inventoryCounts(inventory);
  if (JSON.stringify(actualCounts) !== JSON.stringify(policy.expected)) {
    errors.push(
      `sink inventory counts changed: expected ${JSON.stringify(policy.expected)}, observed ${JSON.stringify(actualCounts)}`
    );
  }
  return errors;
}

function dispositionQueues(previousPolicy) {
  const queues = new Map();
  for (const entry of previousPolicy?.approved || []) {
    const key = occurrenceKey(entry);
    const queue = queues.get(key) || [];
    queue.push({
      classification: entry.classification,
      rationale: entry.rationale
    });
    queues.set(key, queue);
  }
  return queues;
}

function applyDisposition(occurrence, queues) {
  if (occurrence.kind === 'innerHTML-write' && occurrence.empty === true) {
    return {
      ...occurrence,
      classification: 'empty-clear',
      rationale: 'The constant empty string clears existing children and cannot introduce parsed markup.'
    };
  }
  if (occurrence.kind === 'dynamic-import' && Object.hasOwn(occurrence, 'literal')) {
    return {
      ...occurrence,
      classification: 'literal-import',
      rationale: 'The complete executable module specifier is a source literal reviewed at this call site.'
    };
  }
  if (occurrence.kind === 'dynamic-import') {
    return {
      ...occurrence,
      classification: 'executable-extension-allowlist'
    };
  }
  if (occurrence.kind === 'timer-callback-control') {
    return {
      ...occurrence,
      classification: 'reviewed-callback-control'
    };
  }
  const queue = queues.get(occurrenceKey(occurrence)) || [];
  const disposition = queue.shift();
  assert(
    REVIEWED_HTML_CLASSIFICATIONS.has(disposition?.classification) &&
      typeof disposition?.rationale === 'string' &&
      disposition.rationale.length >= 24,
    `new or changed non-empty HTML occurrence requires classification before policy update: ${formatOccurrence(occurrence)}`
  );
  return { ...occurrence, ...disposition };
}

function createPolicy(inventory, previousPolicy) {
  if (inventory.prohibited.length > 0) {
    fail(`refusing to write policy with prohibited sinks:\n${inventory.prohibited.map(formatOccurrence).join('\n')}`);
  }
  const counts = inventoryCounts(inventory);
  assert(
    JSON.stringify(counts) === JSON.stringify(EXPECTED_COUNTS),
    `reviewed baseline counts changed: expected ${JSON.stringify(EXPECTED_COUNTS)}, observed ${JSON.stringify(counts)}`
  );
  const queues = dispositionQueues(previousPolicy);
  const approved = inventory.approved
    .map((occurrence) => applyDisposition(occurrence, queues))
    .map((entry) => ({ ...entry, dispositionHash: dispositionHash(entry) }));
  return {
    schemaVersion: 1,
    decision: 'accepted-baseline-with-zero-growth',
    rationale: POLICY_RATIONALE,
    classifications: POLICY_CLASSIFICATIONS,
    scope: {
      javascriptRoots: JAVASCRIPT_ROOTS,
      javascriptFiles: JAVASCRIPT_FILES,
      excluded: ['assets/js/vendor/**'],
      entrypoints: ENTRYPOINTS
    },
    expected: EXPECTED_COUNTS,
    approved
  };
}

async function readPolicy() {
  try {
    return JSON.parse(await readFile(POLICY_PATH, 'utf8'));
  } catch (error) {
    fail(`cannot read ${path.relative(REPO_ROOT, POLICY_PATH)}: ${error.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  assert(
    args.length <= 1 && (args.length === 0 || args[0] === '--write'),
    'usage: check-html-sink-policy.mjs [--write]'
  );
  const inventory = await scanRepository();
  if (args[0] === '--write') {
    const previousPolicy = await readPolicy();
    const policy = createPolicy(inventory, previousPolicy);
    await writeFile(POLICY_PATH, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${path.relative(REPO_ROOT, POLICY_PATH)} with ${policy.approved.length} approved fingerprints.`);
    return;
  }
  const policy = await readPolicy();
  const errors = verifyInventory(inventory, policy);
  if (errors.length > 0) fail(`HTML sink policy failed:\n- ${errors.join('\n- ')}`);
  const counts = inventoryCounts(inventory);
  console.log(
    `HTML sink policy passed: ${counts.innerHTMLWrites} innerHTML writes (${counts.innerHTMLEmptyWrites} empty), ` +
      `${counts.insertAdjacentHTML} insertAdjacentHTML, ${counts.serializerReads} serializer reads, ` +
      `${counts.dynamicImports} dynamic imports, ${counts.timerCallbackControls} reviewed timer callbacks, ` +
      `${counts.prohibited} prohibited sinks.`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
