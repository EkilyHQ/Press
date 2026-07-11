#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../assets/js/vendor/acorn.mjs';
import { ancestor } from '../assets/js/vendor/acorn-walk.mjs';
import { collectHtmlScriptElements } from '../assets/js/content-security-policy.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const POLICY_PATH = path.join(SCRIPT_DIR, 'html-sink-policy.json');
const JAVASCRIPT_ROOTS = ['assets/i18n', 'assets/js', 'assets/themes/native'];
const JAVASCRIPT_FILES = ['assets/main.js'];
const ENTRYPOINTS = ['index.html', 'index_editor.html', 'index_editor_preview.html'];
const EXECUTABLE_EXTENSIONS = new Set(['.js', '.mjs']);
const HTML_ASSIGNMENT_PROPERTIES = new Set(['innerHTML', 'outerHTML', 'srcdoc']);
const HTML_CALLABLE_PROPERTIES = new Set([
  '__lookupSetter__',
  'createContextualFragment',
  'insertAdjacentHTML',
  'parseFromString',
  'parseHTMLUnsafe',
  'setHTMLUnsafe'
]);
const DOCUMENT_REFERENCE_PROPERTIES = new Set(['contentDocument', 'document', 'ownerDocument']);
const DYNAMIC_CODE_CALLABLES = new Set(['eval', 'Function']);
const TIMER_CALLABLES = new Set(['setInterval', 'setTimeout']);
const REVIEWED_GLOBAL_CALLABLES = new Set([...DYNAMIC_CODE_CALLABLES, ...TIMER_CALLABLES]);
const DANGEROUS_DESCRIPTOR_VALUE_PROPERTIES = new Set([
  ...HTML_CALLABLE_PROPERTIES,
  ...REVIEWED_GLOBAL_CALLABLES,
  'constructor',
  'write',
  'writeln'
]);
const REFLECT_HELPERS = new Set(['get', 'getOwnPropertyDescriptor', 'set']);
const OBJECT_HELPERS = new Set([
  'assign',
  'defineProperties',
  'defineProperty',
  'getOwnPropertyDescriptor',
  'getOwnPropertyDescriptors'
]);
const APPROVED_KINDS = new Set([
  'computed-property-control',
  'dynamic-import',
  'innerHTML-write',
  'insertAdjacentHTML',
  'reflection-control',
  'serializer-read',
  'timer-callback-alias-control',
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
  'reviewed-non-dom-reflection':
    'A reviewed reflective update whose target is a plain data/state object rather than a DOM node.',
  'reviewed-callback-control': 'A callback supplied through a reviewed higher-order timer boundary.',
  'reviewed-computed-property-control':
    'An existing dynamic property write or call whose exact owner-bound identity is retained as explicit uncertainty debt and may only shrink.',
  'static-template': 'A source-static or constant-table UI template without user-controlled HTML.',
  'trusted-theme-template': 'A trusted first-party theme or component template rendered through its owned contract.'
};
const POLICY_RATIONALE =
  'A universal sanitizer is not applicable because Press intentionally renders several trusted templates and separately sanitized renderer outputs. Owner-bound semantic identities make every existing HTML serializer, executable import, and dynamic computed-property operation reviewable without freezing whitespace-only formatting. Computed-property uncertainty is an exact merge-base-proven inventory that may only shrink, while concrete direct, aliased, descriptor, reflective, and parser sinks remain at zero.';
const EXPECTED_COUNTS = {
  computedPropertyControls: 366,
  dynamicImports: 12,
  innerHTMLEmptyWrites: 65,
  innerHTMLWrites: 112,
  insertAdjacentHTML: 2,
  prohibited: 0,
  reflectionControls: 6,
  serializerReads: 4,
  timerCallbackControls: 11
};
const REVIEWED_REFLECTION_CONTROLS = new Map([
  [
    'assets/js/composer-bootstrap.js|function:loadInitialComposerState|Object.defineProperty-unproven-property',
    {
      targetContract: 'composer-state',
      rationale:
        'The imported migration-state key is applied only to the plain Composer state object as non-enumerable metadata.'
    }
  ],
  [
    'assets/js/editor-blocks-state.js|function:createEditorBlocksStateController/function:updateBlockData|Object.assign-unproven-payload',
    {
      targetContract: 'block-data-model',
      rationale: 'The patch is merged only into the plain block data model and never into a DOM element.'
    }
  ],
  [
    'assets/js/publish/publish-receipt.js|function:normalizePropagation|Object.assign-unproven-payload',
    {
      targetContract: 'publish-receipt-record',
      rationale: 'Normalized propagation fields are merged only into a plain serializable publish receipt record.'
    }
  ],
  [
    'assets/js/yaml.js|function:parseArray|Object.assign-unproven-payload',
    {
      targetContract: 'yaml-data-model',
      rationale: 'Parsed nested YAML values are merged only into the parser data model, not a browser DOM object.'
    }
  ],
  [
    'assets/main.js|function:smoothShow|Object.assign-unproven-payload',
    {
      targetContract: 'theme-effect-options',
      rationale: 'Caller options are merged into a plain theme-effect payload before the bounded theme effect call.'
    }
  ],
  [
    'assets/main.js|function:smoothHide|Object.assign-unproven-payload',
    {
      targetContract: 'theme-effect-options',
      rationale: 'Caller options are merged into a plain theme-effect payload before the bounded theme effect call.'
    }
  ]
]);
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
    'assets/js/editor-app-runtime.js|fn',
    'The editor app runtime forwards a callback through its window-scoped timer adapter after callable checks at the owning boundary.'
  ],
  [
    'assets/js/errors.js|callback',
    'The error runtime forwards a callback parameter through its window-or-global timer adapter.'
  ],
  [
    'assets/js/hieditor.js|handler',
    'The editor DOM adapter forwards a callback through its injected setTimeout implementation without converting it to source text.'
  ],
  [
    'assets/js/lightbox.js|fn',
    'The lightbox request-frame fallback forwards a function through its selected browser timer adapter.'
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

function unwrap(node) {
  let current = node;
  while (current?.type === 'ChainExpression') current = current.expression;
  return current;
}

function createBindingResolver(ast) {
  const bindings = new Map();
  const invocationSites = [];
  const memberAssignments = [];
  const objectExtensions = [];
  const producerSourceContexts = new WeakMap();
  const throwSourcesByTry = new Map();
  const thisOwners = new WeakMap();
  const producerParameterCallableCache = new Map();
  const parameterExpressionRecordsCache = new Map();

  function rememberProducerContext(node, ancestors, sourceContext = '') {
    const current = unwrap(node);
    if (current) {
      producerSourceContexts.set(current, {
        controlPath: producerControlPath(current, ancestors),
        sourceContext
      });
    }
  }

  function producerSourceRecord(expression, fallbackExpression = expression) {
    const context = producerSourceContexts.get(unwrap(fallbackExpression)) || {};
    return {
      controlPath: context.controlPath || '',
      expression,
      sourceContext: context.sourceContext || ''
    };
  }

  function resolveThisOwner(ancestors) {
    for (let index = ancestors.length - 2; index >= 0; index -= 1) {
      const candidate = ancestors[index];
      if (candidate.type === 'ArrowFunctionExpression') continue;
      if (candidate.type !== 'FunctionExpression') {
        if (candidate.type === 'FunctionDeclaration') return null;
        continue;
      }
      const property = ancestors[index - 1];
      if (property?.type === 'MethodDefinition') {
        const container = [...ancestors.slice(0, index - 1)]
          .reverse()
          .find((entry) => entry.type === 'ClassDeclaration' || entry.type === 'ClassExpression');
        return container ? { container, functionNode: candidate } : null;
      }
      if (property?.type === 'Property' && property.method) {
        const container = [...ancestors.slice(0, index - 1)]
          .reverse()
          .find((entry) => entry.type === 'ObjectExpression');
        return container ? { container, functionNode: candidate } : null;
      }
      return null;
    }
    return null;
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
    const mergeKinds = new Set(['function', 'parameter', 'var']);
    const existing = candidates.find(
      (candidate) =>
        candidate.scope === binding.scope &&
        mergeKinds.has(candidate.declarationKind) &&
        mergeKinds.has(binding.declarationKind)
    );
    if (existing) {
      if (binding.node && binding.node !== identifier && binding.kind !== 'opaque') {
        existing.assignedNodes.push(binding.node);
      }
      if (binding.kind === 'function') {
        existing.kind = 'function';
        existing.node = binding.node;
      }
      if (binding.functionNode && !existing.functionNode) existing.functionNode = binding.functionNode;
      if (Number.isInteger(binding.parameterIndex) && !Number.isInteger(existing.parameterIndex)) {
        existing.parameterIndex = binding.parameterIndex;
      }
      if (binding.sourceExpression) existing.assignedNodes.push(binding.sourceExpression);
      return;
    }
    candidates.push({
      ...binding,
      assignedNodes: [],
      assignedProperties: new Set(),
      declaration: identifier,
      mutated: false
    });
    bindings.set(identifier.name, candidates);
  }

  function staticPatternPropertyName(property) {
    if (property?.type !== 'Property') return '';
    if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
    return property.key?.type === 'Literal' && typeof property.key.value === 'string' ? property.key.value : '';
  }

  function recordPattern(pattern, binding, destructuredProperty = '', patternPath = []) {
    if (!pattern) return;
    if (pattern.type === 'Identifier') {
      record(pattern, { ...binding, destructuredProperty, patternPath });
      return;
    }
    if (pattern?.type === 'AssignmentPattern') {
      if (pattern.left?.type === 'Identifier') {
        record(pattern.left, {
          ...binding,
          destructuredProperty,
          kind: 'const',
          node: pattern.right,
          patternPath
        });
      } else {
        recordPattern(pattern.left, binding, destructuredProperty, patternPath);
      }
      return;
    }
    if (pattern.type === 'RestElement') {
      recordPattern(pattern.argument, binding, destructuredProperty, patternPath);
      return;
    }
    if (pattern.type === 'ArrayPattern') {
      for (const [index, element] of pattern.elements.entries()) {
        recordPattern(element, binding, '', [...patternPath, { index, type: 'array' }]);
      }
      return;
    }
    if (pattern.type !== 'ObjectPattern') return;
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        recordPattern(property.argument, binding, '', patternPath);
      } else {
        const name = staticPatternPropertyName(property);
        recordPattern(property.value, binding, name, [...patternPath, { name, type: 'object' }]);
      }
    }
  }

  function projectPatternExpression(node, patternPath = []) {
    let current = unwrap(node);
    for (const segment of patternPath) {
      if (segment.type === 'array') {
        if (current?.type !== 'ArrayExpression') return null;
        const element = current.elements[segment.index];
        if (!element || element.type === 'SpreadElement') return null;
        current = unwrap(element);
        continue;
      }
      if (current?.type !== 'ObjectExpression' || !segment.name) return null;
      const property = current.properties.find(
        (candidate) => candidate.type === 'Property' && staticPatternPropertyName(candidate) === segment.name
      );
      if (!property) return null;
      current = unwrap(property.value);
    }
    return current;
  }

  ancestor(ast, {
    VariableDeclarator(node, ancestors) {
      const declaration = ancestors[ancestors.length - 2];
      if (declaration?.type !== 'VariableDeclaration') return;
      const scope = lexicalScope(ancestors, { functionScoped: declaration.kind === 'var' });
      const loop = ancestors[ancestors.length - 3];
      const loopSource =
        !node.init && (loop?.type === 'ForInStatement' || loop?.type === 'ForOfStatement') && loop.left === declaration
          ? loop.right
          : null;
      if (node.init) {
        rememberProducerContext(node.init, ancestors, `declaration:${declaration.kind}:${semanticNodeLabel(node.id)}`);
      } else if (loopSource) {
        rememberProducerContext(
          loopSource,
          ancestors,
          `${loop.type}:${loop.await ? 'await:' : ''}${semanticNodeLabel(node.id)}`
        );
      }
      if (node.id.type === 'Identifier' && node.init) {
        record(node.id, { declarationKind: declaration.kind, kind: 'const', node: node.init, scope });
      } else {
        recordPattern(node.id, {
          declarationKind: declaration.kind,
          kind: 'opaque',
          node,
          scope,
          sourceExpression: node.init || loopSource || null
        });
      }
    },
    FunctionDeclaration(node, ancestors) {
      if (node.id) {
        record(node.id, {
          declarationKind: 'function',
          kind: 'function',
          node,
          scope: lexicalScope(ancestors)
        });
      }
      for (const [parameterIndex, parameter] of node.params.entries()) {
        recordPattern(parameter, {
          functionNode: node,
          declarationKind: 'parameter',
          kind: 'opaque',
          node: parameter,
          parameterIndex,
          scope: lexicalScope(ancestors, { includeOwn: true })
        });
      }
    },
    FunctionExpression(node, ancestors) {
      const scope = lexicalScope(ancestors, { includeOwn: true });
      if (node.id) record(node.id, { declarationKind: 'function', kind: 'function', node, scope });
      for (const [parameterIndex, parameter] of node.params.entries()) {
        recordPattern(parameter, {
          functionNode: node,
          declarationKind: 'parameter',
          kind: 'opaque',
          node: parameter,
          parameterIndex,
          scope
        });
      }
    },
    ArrowFunctionExpression(node, ancestors) {
      const scope = lexicalScope(ancestors, { includeOwn: true });
      for (const [parameterIndex, parameter] of node.params.entries()) {
        recordPattern(parameter, {
          functionNode: node,
          declarationKind: 'parameter',
          kind: 'opaque',
          node: parameter,
          parameterIndex,
          scope
        });
      }
    },
    CallExpression(node, ancestors) {
      rememberProducerContext(node, ancestors, `call:${semanticNodeLabel(node.callee)}`);
      invocationSites.push(node);
      const callee = unwrap(node.callee);
      if (
        callee?.type === 'MemberExpression' &&
        !callee.computed &&
        callee.object?.type === 'Identifier' &&
        callee.object.name === 'Object' &&
        callee.property?.type === 'Identifier' &&
        callee.property.name === 'assign'
      ) {
        objectExtensions.push({ sources: node.arguments.slice(1), target: node.arguments[0] });
      }
    },
    NewExpression(node) {
      invocationSites.push(node);
    },
    AssignmentExpression(node, ancestors) {
      rememberProducerContext(node.right, ancestors, `assignment:${node.operator}:${semanticNodeLabel(node.left)}`);
      if (unwrap(node.left)?.type === 'MemberExpression') {
        memberAssignments.push({ member: unwrap(node.left), value: node.right });
      }
    },
    Property(node, ancestors) {
      if (node.value) {
        rememberProducerContext(
          node.value,
          ancestors,
          `property:${node.kind || 'init'}:${semanticNodeLabel(node.key)}`
        );
      }
    },
    ForInStatement(node, ancestors) {
      rememberProducerContext(node.right, ancestors, `${node.type}:${semanticNodeLabel(node.left)}`);
    },
    ForOfStatement(node, ancestors) {
      rememberProducerContext(
        node.right,
        ancestors,
        `${node.type}:${node.await ? 'await:' : ''}${semanticNodeLabel(node.left)}`
      );
    },
    ThrowStatement(node, ancestors) {
      if (!node.argument) return;
      rememberProducerContext(node.argument, ancestors, 'throw');
      const owningTry = [...ancestors]
        .reverse()
        .find(
          (candidate) =>
            candidate.type === 'TryStatement' && candidate.block.start <= node.start && candidate.block.end >= node.end
        );
      if (!owningTry) return;
      const sources = throwSourcesByTry.get(owningTry) || [];
      sources.push(node.argument);
      throwSourcesByTry.set(owningTry, sources);
    },
    ThisExpression(node, ancestors) {
      const owner = resolveThisOwner(ancestors);
      if (owner) thisOwners.set(node, owner);
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

  function markMutated(pattern, sourceExpression = null, assignedProperty = '') {
    if (!pattern) return;
    if (pattern.type === 'Identifier') {
      const binding = resolveBinding(pattern);
      if (binding) {
        binding.mutated = true;
        if (sourceExpression) binding.assignedNodes.push(sourceExpression);
        if (assignedProperty) binding.assignedProperties.add(assignedProperty);
      }
      return;
    }
    if (pattern.type === 'AssignmentPattern') {
      markMutated(pattern.left, sourceExpression, assignedProperty);
      return;
    }
    if (pattern.type === 'RestElement') {
      markMutated(pattern.argument, sourceExpression, assignedProperty);
      return;
    }
    if (pattern.type === 'ArrayPattern') {
      const source = unwrap(sourceExpression);
      for (const [index, element] of pattern.elements.entries()) {
        const sourceElement = source?.type === 'ArrayExpression' ? source.elements[index] : null;
        markMutated(element, sourceElement?.type === 'SpreadElement' ? sourceElement.argument : sourceElement || null);
      }
      return;
    }
    if (pattern.type !== 'ObjectPattern') return;
    const source = unwrap(sourceExpression);
    for (const property of pattern.properties) {
      if (property.type === 'RestElement') {
        markMutated(property.argument, sourceExpression);
      } else {
        const name = staticPatternPropertyName(property);
        const sourceProperty =
          source?.type === 'ObjectExpression'
            ? source.properties.find(
                (candidate) => candidate.type === 'Property' && staticPatternPropertyName(candidate) === name
              )
            : null;
        markMutated(property.value, sourceProperty?.value || null, name);
      }
    }
  }

  ancestor(ast, {
    AssignmentExpression(node) {
      markMutated(node.left, node.right);
    },
    UpdateExpression(node) {
      markMutated(node.argument);
    },
    ForInStatement(node) {
      if (node.left.type !== 'VariableDeclaration') markMutated(node.left, node.right);
    },
    ForOfStatement(node) {
      if (node.left.type !== 'VariableDeclaration') markMutated(node.left, node.right);
    },
    CatchClause(node, ancestors) {
      const owningTry = ancestors[ancestors.length - 2];
      if (owningTry?.type !== 'TryStatement' || !node.param) return;
      for (const source of throwSourcesByTry.get(owningTry) || []) markMutated(node.param, source);
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

  function resolveExpression(node, seen = new Set()) {
    const current = unwrap(node);
    if (current?.type !== 'Identifier') return current;
    const binding = resolveBinding(current);
    if (!binding || binding.kind !== 'const' || binding.mutated || seen.has(binding)) return current;
    const nextSeen = new Set(seen);
    nextSeen.add(binding);
    return resolveExpression(binding.node, nextSeen);
  }

  function possibleStoredExpressionRecords(identifier) {
    const binding = resolveBinding(identifier);
    if (!binding) return [];
    const records = [];
    if (binding.kind === 'const' && binding.node) {
      records.push(producerSourceRecord(binding.node));
    }
    if (binding.sourceExpression) {
      const projected = projectPatternExpression(binding.sourceExpression, binding.patternPath);
      if (projected) {
        records.push(producerSourceRecord(projected, binding.sourceExpression));
      }
    }
    for (const assignedNode of binding.assignedNodes) {
      const projected = projectPatternExpression(assignedNode, binding.patternPath);
      if (projected) {
        records.push(producerSourceRecord(projected, assignedNode));
      }
    }
    return records;
  }

  function possibleStoredExpressions(identifier) {
    return possibleStoredExpressionRecords(identifier).map(({ expression }) => expression);
  }

  function possibleExpressions(identifier) {
    return [...possibleStoredExpressions(identifier), ...possibleParameterExpressions(identifier)];
  }

  function possibleParameterExpressionRecords(identifier) {
    const binding = resolveBinding(identifier);
    if (!binding) return [];
    if (parameterExpressionRecordsCache.has(binding)) return parameterExpressionRecordsCache.get(binding);
    const records = [];
    if (binding.functionNode && Number.isInteger(binding.parameterIndex)) {
      for (const invocationSite of invocationSites) {
        for (const invocation of producerInvocationRecords(invocationSite)) {
          if (invocation.functionNode !== binding.functionNode) continue;
          const argument = invocation.arguments[binding.parameterIndex];
          if (argument && argument.type !== 'SpreadElement') {
            const projected = projectPatternExpression(argument, binding.patternPath);
            if (projected) records.push(producerSourceRecord(projected, invocationSite));
          }
        }
      }
    }
    parameterExpressionRecordsCache.set(binding, records);
    return records;
  }

  function producerParameterCallableRecords(binding) {
    if (!binding?.functionNode || !Number.isInteger(binding.parameterIndex)) return [];
    if (producerParameterCallableCache.has(binding)) return producerParameterCallableCache.get(binding);
    const records = [];
    for (const invocationSite of invocationSites) {
      for (const invocation of localInvocationRecords(invocationSite)) {
        if (invocation.functionNode !== binding.functionNode) continue;
        const argument = invocation.arguments[binding.parameterIndex];
        if (!argument || argument.type === 'SpreadElement') continue;
        const projected = projectPatternExpression(argument, binding.patternPath);
        if (projected) records.push(...localCallableRecords(projected));
      }
    }
    const unique = uniqueLocalCallableRecords(records);
    producerParameterCallableCache.set(binding, unique);
    return unique;
  }

  function producerInvocationRecords(node) {
    const direct = localInvocationRecords(node);
    const current = unwrap(node);
    if (current?.type !== 'CallExpression') return direct;
    const callee = unwrap(current.callee);
    if (callee?.type !== 'Identifier') return direct;
    const binding = resolveBinding(callee);
    const callbackRecords = producerParameterCallableRecords(binding);
    if (callbackRecords.length === 0) return direct;
    const argumentsList = expandLocalArguments(current.arguments) || [];
    const records = [
      ...direct,
      ...callbackRecords.map(({ boundArguments, functionNode }) => ({
        arguments: [...boundArguments, ...argumentsList],
        functionNode
      }))
    ];
    const seen = new Set();
    return records.filter(({ arguments: invocationArguments, functionNode }) => {
      const key = `${functionNode.start}:${functionNode.end}:${invocationArguments
        .map((argument) => `${argument?.start ?? '?'}:${argument?.end ?? '?'}`)
        .join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function possibleParameterExpressions(identifier) {
    return possibleParameterExpressionRecords(identifier).map(({ expression }) => expression);
  }

  function localFunctionNodes(node, seen = new Set()) {
    const current = unwrap(node);
    if (!current || seen.has(current)) return new Set();
    const nextSeen = new Set(seen);
    nextSeen.add(current);
    if (current.type === 'FunctionExpression' || current.type === 'ArrowFunctionExpression') {
      return new Set([current]);
    }
    if (current.type === 'MemberExpression') {
      const nodes = new Set();
      for (const expression of possibleMemberExpressions(current, nextSeen)) {
        for (const functionNode of localFunctionNodes(expression, nextSeen)) nodes.add(functionNode);
      }
      return nodes;
    }
    if (current.type !== 'Identifier') return new Set();
    const binding = resolveBinding(current);
    if (!binding || seen.has(binding)) return new Set();
    if (binding.kind === 'function' && binding.node) return new Set([binding.node]);
    nextSeen.add(binding);
    const nodes = new Set();
    for (const expression of [
      ...(binding.kind === 'const' && binding.node ? [binding.node] : []),
      ...binding.assignedNodes
    ]) {
      for (const functionNode of localFunctionNodes(expression, nextSeen)) nodes.add(functionNode);
    }
    return nodes;
  }

  function localPropertyName(property) {
    if (!property?.computed && property?.key?.type === 'Identifier') return property.key.name;
    return property?.key?.type === 'Literal' && typeof property.key.value === 'string' ? property.key.value : '';
  }

  function localMemberName(member) {
    if (!member?.computed && member?.property?.type === 'Identifier') return member.property.name;
    return member?.property?.type === 'Literal' && typeof member.property.value === 'string'
      ? member.property.value
      : '';
  }

  function localContainerNodes(node, seen = new Set()) {
    const current = unwrap(node);
    if (!current || seen.has(current)) return new Set();
    const nextSeen = new Set(seen);
    nextSeen.add(current);
    if (
      ['ClassDeclaration', 'ClassExpression', 'FunctionDeclaration', 'FunctionExpression', 'ObjectExpression'].includes(
        current.type
      )
    ) {
      return new Set([current]);
    }
    if (current.type === 'MemberExpression' && localMemberName(current) === 'prototype') {
      return localContainerNodes(current.object, nextSeen);
    }
    if (current.type === 'NewExpression') return localContainerNodes(current.callee, nextSeen);
    if (current.type === 'SequenceExpression') {
      return localContainerNodes(current.expressions.at(-1), nextSeen);
    }
    if (current.type === 'ConditionalExpression' || current.type === 'LogicalExpression') {
      const containers = new Set();
      const branches =
        current.type === 'ConditionalExpression'
          ? [current.consequent, current.alternate]
          : [current.left, current.right];
      for (const branch of branches) {
        for (const container of localContainerNodes(branch, nextSeen)) containers.add(container);
      }
      return containers;
    }
    if (current.type === 'AssignmentExpression') return localContainerNodes(current.right, nextSeen);
    if (current.type === 'AwaitExpression' || current.type === 'YieldExpression') {
      return localContainerNodes(current.argument, nextSeen);
    }
    if (current.type === 'CallExpression') {
      const containers = new Set();
      for (const { functionNode } of localCallableRecords(current.callee, nextSeen)) {
        for (const expression of localReturnExpressions(functionNode)) {
          for (const container of localContainerNodes(expression, nextSeen)) containers.add(container);
        }
      }
      return containers;
    }
    if (current.type !== 'Identifier') return new Set();
    const binding = resolveBinding(current);
    if (!binding || seen.has(binding)) return new Set();
    nextSeen.add(binding);
    const containers = new Set();
    if (
      ['ClassDeclaration', 'ClassExpression', 'FunctionDeclaration', 'FunctionExpression', 'ObjectExpression'].includes(
        binding.node?.type
      )
    ) {
      containers.add(binding.node);
    }
    for (const expression of possibleStoredExpressions(current)) {
      for (const container of localContainerNodes(expression, nextSeen)) containers.add(container);
    }
    return containers;
  }

  function localReturnExpressionRecords(functionNode) {
    if (functionNode?.type === 'ArrowFunctionExpression' && functionNode.body.type !== 'BlockStatement') {
      return [{ controlPath: '', expression: functionNode.body }];
    }
    const records = [];
    ancestor(functionNode, {
      ReturnStatement(node, ancestors) {
        const owner = [...ancestors].reverse().find((candidate) => isFunctionScope(candidate));
        if (owner === functionNode && node.argument) {
          records.push({
            controlPath: producerControlPath(node.argument, ancestors),
            expression: node.argument
          });
        }
      }
    });
    return records;
  }

  function localReturnExpressions(functionNode) {
    return localReturnExpressionRecords(functionNode).map(({ expression }) => expression);
  }

  function uniqueLocalCallableRecords(records) {
    const seen = new Set();
    return records.filter(({ boundArguments, functionNode }) => {
      const key = `${functionNode.start}:${functionNode.end}:${boundArguments
        .map((argument) => `${argument?.start ?? '?'}:${argument?.end ?? '?'}`)
        .join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function localCallableRecords(node, seen = new Set()) {
    const current = unwrap(node);
    if (!current || seen.has(current)) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(current);
    if (current.type === 'FunctionExpression' || current.type === 'ArrowFunctionExpression') {
      return [{ boundArguments: [], functionNode: current }];
    }
    if (current.type === 'Identifier') {
      const binding = resolveBinding(current);
      if (!binding || seen.has(binding)) return [];
      if (binding.kind === 'function' && binding.node) {
        return [{ boundArguments: [], functionNode: binding.node }];
      }
      if (binding.node?.type === 'ClassDeclaration' || binding.node?.type === 'ClassExpression') {
        const constructor = binding.node.body.body.find(
          (property) => property.type === 'MethodDefinition' && property.kind === 'constructor'
        );
        return constructor?.value ? [{ boundArguments: [], functionNode: constructor.value }] : [];
      }
      nextSeen.add(binding);
      return uniqueLocalCallableRecords(
        possibleStoredExpressions(current).flatMap((expression) => localCallableRecords(expression, nextSeen))
      );
    }
    if (current.type === 'MemberExpression') {
      return [...localFunctionNodes(current, seen)].map((functionNode) => ({
        boundArguments: [],
        functionNode
      }));
    }
    if (current.type === 'SequenceExpression') {
      return localCallableRecords(current.expressions.at(-1), nextSeen);
    }
    if (current.type === 'ConditionalExpression' || current.type === 'LogicalExpression') {
      const branches =
        current.type === 'ConditionalExpression'
          ? [current.consequent, current.alternate]
          : [current.left, current.right];
      return uniqueLocalCallableRecords(branches.flatMap((branch) => localCallableRecords(branch, nextSeen)));
    }
    if (current.type === 'AssignmentExpression') return localCallableRecords(current.right, nextSeen);
    if (current.type === 'AwaitExpression' || current.type === 'YieldExpression') {
      return localCallableRecords(current.argument, nextSeen);
    }
    if (current.type !== 'CallExpression') return [];
    const callee = unwrap(current.callee);
    if (callee?.type !== 'MemberExpression' || localMemberName(callee) !== 'bind') return [];
    return uniqueLocalCallableRecords(
      localCallableRecords(callee.object, nextSeen).map(({ boundArguments, functionNode }) => ({
        boundArguments: [...boundArguments, ...current.arguments.slice(1)],
        functionNode
      }))
    );
  }

  function localArrayArguments(node) {
    const current = resolveExpression(unwrap(node));
    if (current?.type !== 'ArrayExpression' || current.elements.some((element) => !element)) return null;
    const elements = [];
    for (const element of current.elements) {
      if (element.type !== 'SpreadElement') {
        elements.push(element);
        continue;
      }
      const spread = localArrayArguments(element.argument);
      // Arguments before an opaque spread retain their positions. Stop at the
      // first unknown width instead of discarding that trustworthy prefix.
      if (spread === null) break;
      elements.push(...spread);
    }
    return elements;
  }

  function expandLocalArguments(argumentsList) {
    const argumentsExpanded = [];
    for (const argument of argumentsList) {
      if (argument.type !== 'SpreadElement') {
        argumentsExpanded.push(argument);
        continue;
      }
      const spread = localArrayArguments(argument.argument);
      if (spread === null) break;
      argumentsExpanded.push(...spread);
    }
    return argumentsExpanded;
  }

  function localFunctionPrototypeMethod(node, seen = new Set()) {
    const current = unwrap(node);
    if (!current || seen.has(current)) return '';
    if (current.type === 'Identifier') {
      const nextSeen = new Set(seen);
      nextSeen.add(current);
      const methods = new Set(
        possibleStoredExpressions(current)
          .map((expression) => localFunctionPrototypeMethod(expression, nextSeen))
          .filter(Boolean)
      );
      return methods.size === 1 ? [...methods][0] : '';
    }
    if (current?.type !== 'MemberExpression') return '';
    const method = localMemberName(current);
    if (!['apply', 'bind', 'call'].includes(method)) return '';
    const prototype = unwrap(current.object);
    return prototype?.type === 'MemberExpression' &&
      localMemberName(prototype) === 'prototype' &&
      unwrap(prototype.object)?.type === 'Identifier' &&
      unwrap(prototype.object).name === 'Function'
      ? method
      : '';
  }

  function localReflectMethod(node, seen = new Set()) {
    const current = unwrap(node);
    if (!current || seen.has(current)) return '';
    if (current.type === 'Identifier') {
      const nextSeen = new Set(seen);
      nextSeen.add(current);
      const methods = new Set(
        possibleStoredExpressions(current)
          .map((expression) => localReflectMethod(expression, nextSeen))
          .filter(Boolean)
      );
      return methods.size === 1 ? [...methods][0] : '';
    }
    if (current.type !== 'MemberExpression') return '';
    const method = localMemberName(current);
    return ['apply', 'construct'].includes(method) &&
      unwrap(current.object)?.type === 'Identifier' &&
      unwrap(current.object).name === 'Reflect' &&
      !resolveBinding(unwrap(current.object))
      ? method
      : '';
  }

  function localInvocationRecords(node, seen = new Set()) {
    const current = unwrap(node);
    if (!current || seen.has(current) || (current.type !== 'CallExpression' && current.type !== 'NewExpression')) {
      return [];
    }
    const nextSeen = new Set(seen);
    nextSeen.add(current);
    if (current.type === 'NewExpression') {
      return localCallableRecords(current.callee, nextSeen).map(({ boundArguments, functionNode }) => ({
        arguments: [...boundArguments, ...(expandLocalArguments(current.arguments) || [])],
        functionNode
      }));
    }
    const callee = unwrap(current.callee);
    let callableRecords;
    let callArguments = expandLocalArguments(current.arguments) || [];
    const reflectMethod = localReflectMethod(callee);
    if (reflectMethod) {
      if (reflectMethod === 'construct') {
        callableRecords = localCallableRecords(current.arguments[0], nextSeen);
        callArguments = localArrayArguments(current.arguments[1]) || [];
      } else {
        const innerMethod = localFunctionPrototypeMethod(current.arguments[0]);
        if (innerMethod) {
          callableRecords = localCallableRecords(current.arguments[1], nextSeen);
          const forwarded = localArrayArguments(current.arguments[2]);
          callArguments =
            forwarded === null
              ? []
              : innerMethod === 'call'
                ? forwarded.slice(1)
                : localArrayArguments(forwarded[1]) || [];
        } else {
          callableRecords = localCallableRecords(current.arguments[0], nextSeen);
          callArguments = localArrayArguments(current.arguments[2]) || [];
        }
      }
    } else if (callee?.type === 'MemberExpression') {
      const form = localMemberName(callee);
      const innerMethod = localFunctionPrototypeMethod(callee.object);
      if (innerMethod && (form === 'call' || form === 'apply')) {
        callableRecords = localCallableRecords(current.arguments[0], nextSeen);
        const outerArguments =
          form === 'apply'
            ? localArrayArguments(current.arguments[1]) || []
            : expandLocalArguments(current.arguments.slice(1)) || [];
        callArguments = innerMethod === 'call' ? outerArguments.slice(1) : localArrayArguments(outerArguments[1]) || [];
      } else if (form === 'call' || form === 'apply') {
        callableRecords = localCallableRecords(callee.object, nextSeen);
        callArguments =
          form === 'apply'
            ? localArrayArguments(current.arguments[1]) || []
            : expandLocalArguments(current.arguments.slice(1)) || [];
      } else if (form === 'bind') {
        return [];
      } else {
        callableRecords = localCallableRecords(callee, nextSeen);
      }
    } else {
      callableRecords = localCallableRecords(callee, nextSeen);
    }
    return uniqueLocalCallableRecords(callableRecords).map(({ boundArguments, functionNode }) => ({
      arguments: [...boundArguments, ...callArguments],
      functionNode
    }));
  }

  function localContainerPropertyExpressions(container, name, seen = new Set()) {
    if (!container || seen.has(container)) return [];
    const nextSeen = new Set(seen);
    nextSeen.add(container);
    const expressions = [];
    const properties = container.type === 'ObjectExpression' ? container.properties : container.body?.body || [];
    for (const property of properties) {
      if (property.type === 'SpreadElement') {
        for (const nested of localContainerNodes(property.argument, nextSeen)) {
          expressions.push(...localContainerPropertyExpressions(nested, name, nextSeen));
        }
        continue;
      }
      if (!['MethodDefinition', 'Property', 'PropertyDefinition'].includes(property.type)) continue;
      if (localPropertyName(property) !== name || !property.value) continue;
      if (property.kind === 'get') expressions.push(...localReturnExpressions(property.value));
      else expressions.push(property.value);
    }
    return expressions;
  }

  function parameterMemberPath(node) {
    const path = [];
    let current = unwrap(node);
    while (current?.type === 'MemberExpression') {
      const name = localMemberName(current);
      if (!name) return null;
      path.unshift(name);
      current = unwrap(current.object);
    }
    return current?.type === 'Identifier' ? { identifier: current, path } : null;
  }

  function projectMemberSource(source, memberPath) {
    let current = unwrap(resolveExpression(source));
    for (const name of memberPath) {
      current = unwrap(resolveExpression(current));
      if (current?.type === 'ObjectExpression') {
        const candidates = localContainerPropertyExpressions(current, name);
        if (candidates.length !== 1) return null;
        current = unwrap(candidates[0]);
        continue;
      }
      if (current?.type === 'ArrayExpression' && /^\d+$/u.test(name)) {
        const element = current.elements[Number(name)];
        if (!element || element.type === 'SpreadElement') return null;
        current = unwrap(element);
        continue;
      }
      return null;
    }
    return current;
  }

  function invocationParameterMemberExpression(member, functionNode, invocationArguments) {
    const memberPath = parameterMemberPath(member);
    if (!memberPath) return null;
    const argument = invocationParameterExpression(memberPath.identifier, functionNode, invocationArguments);
    return argument ? projectMemberSource(argument, memberPath.path) : null;
  }

  function possibleParameterMemberExpressionRecords(member) {
    const memberPath = parameterMemberPath(member);
    if (!memberPath) return [];
    const binding = resolveBinding(memberPath.identifier);
    if (!binding?.functionNode || !Number.isInteger(binding.parameterIndex)) return [];
    const records = [];
    for (const invocationSite of invocationSites) {
      for (const invocation of producerInvocationRecords(invocationSite)) {
        if (invocation.functionNode !== binding.functionNode) continue;
        const projected = invocationParameterMemberExpression(member, binding.functionNode, invocation.arguments);
        if (projected) records.push(producerSourceRecord(projected, invocationSite));
      }
    }
    return records;
  }

  function possibleThisMemberExpressionRecords(member) {
    const current = unwrap(member);
    const receiver = unwrap(current?.object);
    const owner = receiver?.type === 'ThisExpression' ? thisOwners.get(receiver) : null;
    const name = current?.type === 'MemberExpression' ? localMemberName(current) : '';
    if (!owner || !name) return [];
    const records = localContainerPropertyExpressions(owner.container, name).map((expression) =>
      producerSourceRecord(expression)
    );
    for (const assignment of memberAssignments) {
      const assignmentReceiver = unwrap(assignment.member.object);
      if (
        assignmentReceiver?.type === 'ThisExpression' &&
        thisOwners.get(assignmentReceiver)?.container === owner.container &&
        localMemberName(assignment.member) === name
      ) {
        records.push(producerSourceRecord(assignment.value));
      }
    }
    return records;
  }

  function possibleMemberExpressions(node, seen = new Set()) {
    const current = unwrap(node);
    if (current?.type !== 'MemberExpression') return [];
    const name = localMemberName(current);
    if (!name) return [];
    const expressions = [];
    for (const container of localContainerNodes(current.object, seen)) {
      expressions.push(...localContainerPropertyExpressions(container, name, seen));
    }
    for (const assignment of memberAssignments) {
      if (
        localMemberName(assignment.member) === name &&
        sameLocalReceiver(current.object, assignment.member.object, seen)
      ) {
        expressions.push(assignment.value);
      }
    }
    for (const extension of objectExtensions) {
      if (!sameLocalReceiver(current.object, extension.target, seen)) continue;
      for (const source of extension.sources) {
        for (const container of localContainerNodes(source, seen)) {
          expressions.push(...localContainerPropertyExpressions(container, name, seen));
        }
      }
    }
    return expressions;
  }

  function possibleStoredMemberExpressionRecords(node, seen = new Set()) {
    return [
      ...possibleMemberExpressions(node, seen).map((expression) => producerSourceRecord(expression)),
      ...possibleThisMemberExpressionRecords(node)
    ];
  }

  function possibleMemberExpressionRecords(node, seen = new Set()) {
    return [...possibleStoredMemberExpressionRecords(node, seen), ...possibleParameterMemberExpressionRecords(node)];
  }

  function sameLocalReceiver(left, right, seen = new Set()) {
    const leftContainers = localContainerNodes(left, seen);
    const rightContainers = localContainerNodes(right, seen);
    return [...leftContainers].some((container) => rightContainers.has(container));
  }

  function invocationParameterExpression(identifier, functionNode, invocationArguments) {
    const binding = resolveBinding(identifier);
    if (
      binding?.functionNode !== functionNode ||
      !Number.isInteger(binding.parameterIndex) ||
      !invocationArguments[binding.parameterIndex]
    ) {
      return null;
    }
    return projectPatternExpression(invocationArguments[binding.parameterIndex], binding.patternPath);
  }

  function possibleCallReturnExpressionRecords(node) {
    const records = [];
    for (const invocation of localInvocationRecords(node)) {
      for (const returned of localReturnExpressionRecords(invocation.functionNode)) {
        records.push({
          ...returned,
          arguments: invocation.arguments,
          functionNode: invocation.functionNode
        });
      }
    }
    return records;
  }

  function possibleCallReturnExpressions(node) {
    return possibleCallReturnExpressionRecords(node).map(
      ({ arguments: invocationArguments, expression, functionNode }) => {
        const current = unwrap(expression);
        return current?.type === 'Identifier'
          ? invocationParameterExpression(current, functionNode, invocationArguments) || expression
          : expression;
      }
    );
  }

  return {
    isCallable,
    invocationParameterExpression,
    invocationParameterMemberExpression,
    possibleExpressions,
    possibleMemberExpressions,
    possibleMemberExpressionRecords,
    possibleStoredMemberExpressionRecords,
    possibleParameterExpressions,
    possibleParameterExpressionRecords,
    possibleParameterMemberExpressionRecords,
    possibleCallReturnExpressions,
    possibleCallReturnExpressionRecords,
    possibleStoredExpressions,
    possibleStoredExpressionRecords,
    resolveBinding,
    resolveExpression,
    resolvePrimitive
  };
}

function staticStringValue(node, resolver) {
  const resolved = resolver.resolvePrimitive(node);
  return resolved.known && typeof resolved.value === 'string' ? resolved.value : null;
}

function propertyName(node, resolver) {
  const current = unwrap(node);
  if (!current || current.type !== 'MemberExpression') return '';
  if (!current.computed && current.property?.type === 'Identifier') return current.property.name;
  return current.computed ? staticStringValue(current.property, resolver) || '' : '';
}

function calleeName(node, resolver) {
  const current = unwrap(node);
  if (!current) return '';
  if (current.type === 'Identifier') return current.name;
  return propertyName(current, resolver);
}

function isOpaqueComputedCallable(node, resolver, seen = new Set(), includeParameterArguments = false) {
  const original = unwrap(node);
  if (original?.type === 'Identifier' && !seen.has(original)) {
    const nextSeen = new Set(seen);
    nextSeen.add(original);
    if (
      resolver[includeParameterArguments ? 'possibleExpressions' : 'possibleStoredExpressions'](original).some(
        (expression) => isOpaqueComputedCallable(expression, resolver, nextSeen, includeParameterArguments)
      )
    ) {
      return true;
    }
  }
  const current = resolver.resolveExpression(original, seen);
  if (!current || seen.has(current)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(current);
  if (current.type === 'MemberExpression') {
    const name = propertyName(current, resolver);
    if (current.computed && !name) return true;
    if (
      includeParameterArguments &&
      resolver
        .possibleMemberExpressions(current)
        .some((expression) => isOpaqueComputedCallable(expression, resolver, nextSeen, includeParameterArguments))
    ) {
      return true;
    }
    return ['apply', 'bind', 'call'].includes(name)
      ? isOpaqueComputedCallable(current.object, resolver, nextSeen, includeParameterArguments)
      : false;
  }
  if (current.type === 'SequenceExpression') {
    return isOpaqueComputedCallable(current.expressions.at(-1), resolver, nextSeen, includeParameterArguments);
  }
  if (current.type === 'ConditionalExpression') {
    return (
      isOpaqueComputedCallable(current.consequent, resolver, nextSeen, includeParameterArguments) ||
      isOpaqueComputedCallable(current.alternate, resolver, nextSeen, includeParameterArguments)
    );
  }
  if (current.type === 'LogicalExpression') {
    return (
      isOpaqueComputedCallable(current.left, resolver, nextSeen, includeParameterArguments) ||
      isOpaqueComputedCallable(current.right, resolver, nextSeen, includeParameterArguments)
    );
  }
  if (current.type === 'AssignmentExpression') {
    return isOpaqueComputedCallable(current.right, resolver, nextSeen, includeParameterArguments);
  }
  if (current.type === 'AwaitExpression' || current.type === 'YieldExpression') {
    return isOpaqueComputedCallable(current.argument, resolver, nextSeen, includeParameterArguments);
  }
  if (current.type === 'CallExpression' && includeParameterArguments) {
    return resolver
      .possibleCallReturnExpressions(current)
      .some((expression) => isOpaqueComputedCallable(expression, resolver, nextSeen, includeParameterArguments));
  }
  return false;
}

function isOpaqueComputedInvocation(node, resolver) {
  return isOpaqueComputedCallable(node, resolver, new Set(), true);
}

function uniqueCallableValues(values) {
  const seen = new Set();
  return values.filter(({ target, boundArguments }) => {
    const key = `${target}:${boundArguments.map((argument) => `${argument?.start ?? '?'}:${argument?.end ?? '?'}`).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function callablePropertyTarget(node, resolver) {
  const current = unwrap(node);
  if (
    current?.type === 'Identifier' &&
    REVIEWED_GLOBAL_CALLABLES.has(current.name) &&
    !resolver.resolveBinding(current)
  ) {
    return current.name;
  }
  const name = propertyName(current, resolver);
  if (name === 'constructor') return 'Function';
  return REVIEWED_GLOBAL_CALLABLES.has(name) ? name : '';
}

function isKnownFunctionValue(node, resolver, seen = new Set()) {
  const current = unwrap(node);
  if (!current || seen.has(current)) return false;
  if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') return true;
  if (current.type !== 'Identifier') return false;
  const binding = resolver.resolveBinding(current);
  if (!binding || seen.has(binding)) return false;
  if (binding.kind === 'function') return true;
  const nextSeen = new Set(seen);
  nextSeen.add(binding);
  return resolver
    .possibleExpressions(current)
    .some((expression) => isKnownFunctionValue(expression, resolver, nextSeen));
}

function isKnownFunctionConstructorReference(node, resolver) {
  const current = unwrap(node);
  if (current?.type !== 'MemberExpression' || propertyName(current, resolver) !== 'constructor') return false;
  const object = resolver.resolveExpression(unwrap(current.object));
  if (isKnownFunctionValue(object, resolver)) return true;
  return (
    object?.type === 'MemberExpression' &&
    propertyName(object, resolver) === 'prototype' &&
    callablePropertyTarget(object.object, resolver) === 'Function'
  );
}

function resolveCallableValues(node, resolver, seen = new Set()) {
  const current = unwrap(node);
  if (!current || seen.has(current)) return [];
  const directTarget = callablePropertyTarget(current, resolver);
  if (directTarget) return [{ boundArguments: [], target: directTarget }];
  if (isKnownFunctionConstructorReference(current, resolver)) {
    return [{ boundArguments: [], target: 'Function' }];
  }
  const nextSeen = new Set(seen);
  nextSeen.add(current);
  if (current.type === 'MemberExpression') {
    const memberValues = resolver
      .possibleMemberExpressions(current)
      .flatMap((expression) => resolveCallableValues(expression, resolver, nextSeen));
    if (memberValues.length > 0) return uniqueCallableValues(memberValues);
  }
  if (current.type === 'Identifier') {
    const binding = resolver.resolveBinding(current);
    if (!binding || seen.has(binding)) return [];
    const bindingSeen = new Set(nextSeen);
    bindingSeen.add(binding);
    const values = [];
    for (const property of [binding.destructuredProperty, ...binding.assignedProperties]) {
      if (property === 'constructor') values.push({ boundArguments: [], target: 'Function' });
      else if (REVIEWED_GLOBAL_CALLABLES.has(property)) values.push({ boundArguments: [], target: property });
    }
    for (const expression of resolver.possibleExpressions(current)) {
      values.push(...resolveCallableValues(expression, resolver, bindingSeen));
    }
    return uniqueCallableValues(values);
  }
  if (current.type === 'SequenceExpression') {
    return resolveCallableValues(current.expressions.at(-1), resolver, nextSeen);
  }
  if (current.type === 'ConditionalExpression') {
    return uniqueCallableValues([
      ...resolveCallableValues(current.consequent, resolver, nextSeen),
      ...resolveCallableValues(current.alternate, resolver, nextSeen)
    ]);
  }
  if (current.type === 'LogicalExpression') {
    return uniqueCallableValues([
      ...resolveCallableValues(current.left, resolver, nextSeen),
      ...resolveCallableValues(current.right, resolver, nextSeen)
    ]);
  }
  if (current.type === 'AssignmentExpression') {
    return resolveCallableValues(current.right, resolver, nextSeen);
  }
  if (current.type === 'AwaitExpression' || current.type === 'YieldExpression') {
    return resolveCallableValues(current.argument, resolver, nextSeen);
  }
  if (current.type !== 'CallExpression') return [];
  const returnedValues = resolver
    .possibleCallReturnExpressions(current)
    .flatMap((expression) => resolveCallableValues(expression, resolver, nextSeen));
  if (returnedValues.length > 0) return uniqueCallableValues(returnedValues);
  if (isGlobalMethod(current.callee, 'Reflect', 'get', resolver)) {
    const reflectedTarget = staticStringValue(current.arguments[1], resolver);
    if (reflectedTarget === 'constructor') return [{ boundArguments: [], target: 'Function' }];
    return REVIEWED_GLOBAL_CALLABLES.has(reflectedTarget) ? [{ boundArguments: [], target: reflectedTarget }] : [];
  }
  const callee = unwrap(current.callee);
  if (callee?.type !== 'MemberExpression' || propertyName(callee, resolver) !== 'bind') return [];
  return uniqueCallableValues(
    resolveCallableValues(callee.object, resolver, nextSeen).map(({ target, boundArguments }) => ({
      boundArguments: [...boundArguments, ...current.arguments.slice(1)],
      target
    }))
  );
}

function resolveApplyArguments(node, resolver) {
  const current = resolver.resolveExpression(unwrap(node));
  if (current?.type !== 'ArrayExpression' || current.elements.some((element) => !element)) return null;
  const elements = [];
  for (const element of current.elements) {
    if (element.type !== 'SpreadElement') {
      elements.push(element);
      continue;
    }
    const spread = resolveApplyArguments(element.argument, resolver);
    // Preserve only the position-stable prefix when a spread has unknown
    // width. Values after it cannot be projected to formal parameters safely.
    if (spread === null) break;
    elements.push(...spread);
  }
  return elements;
}

function functionPrototypeCallableMethod(node, resolver, seen = new Set()) {
  const original = unwrap(node);
  if (!original || seen.has(original)) return '';
  const nextSeen = new Set(seen);
  nextSeen.add(original);
  if (original.type === 'Identifier') {
    const methods = new Set(
      resolver
        .possibleExpressions(original)
        .map((expression) => functionPrototypeCallableMethod(expression, resolver, nextSeen))
        .filter(Boolean)
    );
    return methods.size === 1 ? [...methods][0] : '';
  }
  const current = resolver.resolveExpression(original);
  if (current?.type !== 'MemberExpression') return '';
  const method = propertyName(current, resolver);
  if (!['apply', 'bind', 'call'].includes(method)) return '';
  const prototype = resolver.resolveExpression(unwrap(current.object));
  const isFunctionPrototype =
    prototype?.type === 'MemberExpression' &&
    propertyName(prototype, resolver) === 'prototype' &&
    callablePropertyTarget(prototype.object, resolver) === 'Function';
  return isFunctionPrototype || resolveCallableValues(current.object, resolver).length > 0 ? method : '';
}

function normalizeFunctionPrototypeForwarding(node, resolver) {
  const callee = unwrap(node.callee);
  let innerMethod;
  let outerArguments;
  let outerForm;
  let targetExpression;
  if (isGlobalMethod(callee, 'Reflect', 'apply', resolver)) {
    innerMethod = functionPrototypeCallableMethod(node.arguments[0], resolver);
    if (!innerMethod) return null;
    targetExpression = node.arguments[1];
    outerArguments = resolveApplyArguments(node.arguments[2], resolver);
    outerForm = 'reflect-apply';
  } else if (
    callee?.type === 'MemberExpression' &&
    ['apply', 'bind', 'call'].includes(propertyName(callee, resolver))
  ) {
    innerMethod = functionPrototypeCallableMethod(callee.object, resolver);
    if (!innerMethod) return null;
    targetExpression = node.arguments[0];
    outerForm = propertyName(callee, resolver);
    outerArguments =
      outerForm === 'apply' ? resolveApplyArguments(node.arguments[1], resolver) : node.arguments.slice(1);
  } else {
    return null;
  }
  let targetArguments = null;
  if (outerArguments !== null) {
    targetArguments =
      innerMethod === 'apply' ? resolveApplyArguments(outerArguments[1], resolver) : outerArguments.slice(1);
  }
  return {
    arguments: targetArguments,
    form: `prototype-${innerMethod}-${outerForm}`,
    targetExpression,
    values: resolveCallableValues(targetExpression, resolver)
  };
}

function normalizeCallableInvocations(node, resolver) {
  const callee = unwrap(node.callee);
  const forwarded = normalizeFunctionPrototypeForwarding(node, resolver);
  if (forwarded) {
    return uniqueCallableValues(forwarded.values).map(({ target, boundArguments }) => ({
      arguments: forwarded.arguments === null ? null : [...boundArguments, ...forwarded.arguments],
      form: forwarded.form,
      target
    }));
  }
  let form = 'direct';
  let values;
  let callArguments = node.arguments;
  if (isGlobalMethod(callee, 'Reflect', 'apply', resolver)) {
    form = 'reflect-apply';
    values = resolveCallableValues(node.arguments[0], resolver);
    callArguments = resolveApplyArguments(node.arguments[2], resolver);
  } else if (isGlobalMethod(callee, 'Reflect', 'construct', resolver)) {
    form = 'reflect-construct';
    values = resolveCallableValues(node.arguments[0], resolver);
    callArguments = resolveApplyArguments(node.arguments[1], resolver);
  } else if (
    callee?.type === 'MemberExpression' &&
    ['apply', 'bind', 'call'].includes(propertyName(callee, resolver))
  ) {
    form = propertyName(callee, resolver);
    values = resolveCallableValues(callee.object, resolver);
    if (form === 'apply') callArguments = resolveApplyArguments(node.arguments[1], resolver);
    else callArguments = node.arguments.slice(1);
  } else {
    values = resolveCallableValues(callee, resolver);
  }
  return uniqueCallableValues(values).map(({ target, boundArguments }) => ({
    arguments: callArguments === null ? null : [...boundArguments, ...callArguments],
    form,
    target
  }));
}

function isDocumentObject(node, resolver, seen = new Set()) {
  const original = unwrap(node);
  if (!original || seen.has(original)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(original);
  if (original.type === 'Identifier') {
    if (original.name === 'document') return true;
    const binding = resolver.resolveBinding(original);
    if (binding && DOCUMENT_REFERENCE_PROPERTIES.has(binding.destructuredProperty)) return true;
    if ([...(binding?.assignedProperties || [])].some((name) => DOCUMENT_REFERENCE_PROPERTIES.has(name))) return true;
    return resolver
      .possibleExpressions(original)
      .some((expression) => isDocumentObject(expression, resolver, nextSeen));
  }
  const current = resolver.resolveExpression(original);
  if (!current || seen.has(current)) return false;
  if (current.type === 'MemberExpression') {
    if (DOCUMENT_REFERENCE_PROPERTIES.has(propertyName(current, resolver))) return true;
    return resolver
      .possibleMemberExpressions(current)
      .some((expression) => isDocumentObject(expression, resolver, nextSeen));
  }
  if (current.type === 'LogicalExpression') {
    return isDocumentObject(current.left, resolver, nextSeen) || isDocumentObject(current.right, resolver, nextSeen);
  }
  if (current.type === 'ConditionalExpression') {
    return (
      isDocumentObject(current.consequent, resolver, nextSeen) ||
      isDocumentObject(current.alternate, resolver, nextSeen)
    );
  }
  if (current.type === 'SequenceExpression') {
    return isDocumentObject(current.expressions.at(-1), resolver, nextSeen);
  }
  if (current.type === 'AssignmentExpression') return isDocumentObject(current.right, resolver, nextSeen);
  if (current.type === 'AwaitExpression') return isDocumentObject(current.argument, resolver, nextSeen);
  return false;
}

function isGlobalObject(node, name, resolver, seen = new Set()) {
  const original = unwrap(node);
  if (!original || seen.has(original)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(original);
  const current = resolver.resolveExpression(original);
  if (current?.type === 'Identifier') {
    if (current.name === name) return true;
    const binding = resolver.resolveBinding(current);
    if (binding?.destructuredProperty === name || binding?.assignedProperties?.has(name)) return true;
    return resolver
      .possibleExpressions(current)
      .some((expression) => isGlobalObject(expression, name, resolver, nextSeen));
  }
  return current?.type === 'MemberExpression' && propertyName(current, resolver) === name;
}

function isGlobalMethod(node, objectName, methodName, resolver, seen = new Set()) {
  const original = unwrap(node);
  if (!original || seen.has(original)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(original);
  if (original.type === 'Identifier') {
    const binding = resolver.resolveBinding(original);
    if (
      binding?.destructuredProperty === methodName &&
      isGlobalObject(binding.sourceExpression, objectName, resolver)
    ) {
      return true;
    }
    return resolver
      .possibleExpressions(original)
      .some((expression) => isGlobalMethod(expression, objectName, methodName, resolver, nextSeen));
  }
  const current = resolver.resolveExpression(original);
  return (
    current?.type === 'MemberExpression' &&
    propertyName(current, resolver) === methodName &&
    isGlobalObject(current.object, objectName, resolver)
  );
}

function objectPropertyName(property, resolver) {
  if (!property || property.type !== 'Property') return '';
  if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
  return staticStringValue(property.key, resolver) || '';
}

function documentPatternProperties(pattern, resolver, names = []) {
  const current = unwrap(pattern);
  if (!current) return names;
  if (current.type === 'AssignmentPattern') return documentPatternProperties(current.left, resolver, names);
  if (current.type === 'RestElement') return documentPatternProperties(current.argument, resolver, names);
  if (current.type === 'ArrayPattern') {
    for (const element of current.elements) documentPatternProperties(element, resolver, names);
    return names;
  }
  if (current.type !== 'ObjectPattern') return names;
  for (const property of current.properties) {
    if (property.type === 'RestElement') {
      documentPatternProperties(property.argument, resolver, names);
      continue;
    }
    const name = objectPropertyName(property, resolver);
    if (DOCUMENT_REFERENCE_PROPERTIES.has(name)) names.push(name);
    documentPatternProperties(property.value, resolver, names);
  }
  return names;
}

function documentPatternValueAliases(pattern, sourceExpression, resolver, aliases = [], seen = new Set()) {
  const current = unwrap(pattern);
  if (!current || seen.has(current)) return aliases;
  const nextSeen = new Set(seen);
  nextSeen.add(current);
  if (current.type === 'AssignmentPattern') {
    documentPatternValueAliases(current.left, sourceExpression, resolver, aliases, nextSeen);
    documentPatternValueAliases(current.left, current.right, resolver, aliases, nextSeen);
    return aliases;
  }
  if (current.type === 'RestElement') {
    return documentPatternValueAliases(current.argument, sourceExpression, resolver, aliases, nextSeen);
  }
  if (current.type === 'Identifier') {
    if (sourceExpression && isDocumentObject(sourceExpression, resolver)) aliases.push('value');
    return aliases;
  }
  const source = sourceExpression ? resolver.resolveExpression(unwrap(sourceExpression)) : null;
  if (current.type === 'ArrayPattern') {
    for (let index = 0; index < current.elements.length; index += 1) {
      const sourceElement = source?.type === 'ArrayExpression' ? source.elements[index] : null;
      documentPatternValueAliases(current.elements[index], sourceElement, resolver, aliases, nextSeen);
    }
    return aliases;
  }
  if (current.type !== 'ObjectPattern') return aliases;
  for (const property of current.properties) {
    if (property.type === 'RestElement') {
      documentPatternValueAliases(property.argument, null, resolver, aliases, nextSeen);
      continue;
    }
    const name = objectPropertyName(property, resolver);
    const sourceProperty =
      source?.type === 'ObjectExpression'
        ? source.properties.find(
            (candidate) => candidate.type === 'Property' && objectPropertyName(candidate, resolver) === name
          )
        : null;
    documentPatternValueAliases(property.value, sourceProperty?.value || null, resolver, aliases, nextSeen);
  }
  return aliases;
}

function analyzeReflectedObject(node, resolver, seen = new Set()) {
  const current = resolver.resolveExpression(unwrap(node));
  if (!current || seen.has(current)) return { opaque: current ? [current] : [], properties: [] };
  if (current.type !== 'ObjectExpression') return { opaque: [current], properties: [] };
  const nextSeen = new Set(seen);
  nextSeen.add(current);
  const opaque = [];
  const properties = [];
  for (const property of current.properties) {
    if (property.type === 'SpreadElement') {
      const nested = analyzeReflectedObject(property.argument, resolver, nextSeen);
      opaque.push(...nested.opaque);
      properties.push(...nested.properties);
    } else {
      properties.push(property);
    }
  }
  return { opaque, properties };
}

function reflectedHelperName(objectName, methodName) {
  if (objectName === 'Reflect' && REFLECT_HELPERS.has(methodName)) return `${objectName}.${methodName}`;
  if (objectName === 'Object' && OBJECT_HELPERS.has(methodName)) return `${objectName}.${methodName}`;
  return '';
}

function resolveReflectionCallable(node, resolver, seen = new Set()) {
  const current = unwrap(node);
  if (!current) return null;
  if (current.type === 'Identifier') {
    const binding = resolver.resolveBinding(current);
    if (!binding || seen.has(binding)) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(binding);
    const targets = resolver
      .possibleExpressions(current)
      .map((expression) => resolveReflectionCallable(expression, resolver, nextSeen))
      .filter(Boolean);
    const identities = new Set(targets.map(({ helperName }) => helperName));
    return identities.size === 1 ? targets[0] : null;
  }
  if (current.type === 'MemberExpression') {
    const methodName = propertyName(current, resolver);
    for (const objectName of ['Reflect', 'Object']) {
      const helperName = reflectedHelperName(objectName, methodName);
      if (helperName && isGlobalObject(current.object, objectName, resolver)) {
        return { boundArguments: [], helperName };
      }
    }
    return null;
  }
  if (current.type !== 'CallExpression') return null;
  if (isGlobalMethod(current.callee, 'Reflect', 'get', resolver)) {
    const methodName = staticStringValue(current.arguments[1], resolver);
    for (const objectName of ['Reflect', 'Object']) {
      const helperName = reflectedHelperName(objectName, methodName);
      if (helperName && isGlobalObject(current.arguments[0], objectName, resolver)) {
        return { boundArguments: [], helperName };
      }
    }
  }
  const callee = unwrap(current.callee);
  if (callee?.type !== 'MemberExpression' || propertyName(callee, resolver) !== 'bind') return null;
  const target = resolveReflectionCallable(callee.object, resolver, seen);
  if (!target) return null;
  return {
    boundArguments: [...target.boundArguments, ...current.arguments.slice(1)],
    helperName: target.helperName
  };
}

function normalizeReflectionCall(node, resolver) {
  const callee = unwrap(node.callee);
  if (callee?.type === 'MemberExpression') {
    const form = propertyName(callee, resolver);
    if (form === 'bind' || form === 'call' || form === 'apply') {
      const target = resolveReflectionCallable(callee.object, resolver);
      if (target) {
        if (form === 'apply') {
          const argumentArray = resolver.resolveExpression(node.arguments[1]);
          if (argumentArray?.type !== 'ArrayExpression' || argumentArray.elements.some((element) => !element)) {
            return { arguments: [], form: 'opaque-apply', helperName: target.helperName };
          }
          return {
            arguments: [...target.boundArguments, ...argumentArray.elements],
            form,
            helperName: target.helperName
          };
        }
        return {
          arguments: [...target.boundArguments, ...node.arguments.slice(1)],
          form,
          helperName: target.helperName
        };
      }
    }
  }
  const target = resolveReflectionCallable(callee, resolver);
  if (!target) return null;
  return {
    arguments: [...target.boundArguments, ...node.arguments],
    form: 'direct',
    helperName: target.helperName
  };
}

function resolveUnownedReflectionCallable(node, resolver, seen = new Set()) {
  const current = unwrap(node);
  if (!current || seen.has(current)) return null;
  const nextSeen = new Set(seen);
  nextSeen.add(current);
  if (current.type === 'Identifier') {
    const targets = resolver
      .possibleExpressions(current)
      .map((expression) => resolveUnownedReflectionCallable(expression, resolver, nextSeen))
      .filter(Boolean);
    const methods = new Set(targets.map(({ method }) => method));
    return methods.size === 1 ? targets[0] : null;
  }
  if (current.type === 'MemberExpression') {
    const method = propertyName(current, resolver);
    return REFLECT_HELPERS.has(method) || OBJECT_HELPERS.has(method) ? { boundArguments: [], method } : null;
  }
  if (current.type !== 'CallExpression') return null;
  const callee = unwrap(current.callee);
  if (callee?.type !== 'MemberExpression' || propertyName(callee, resolver) !== 'bind') return null;
  const target = resolveUnownedReflectionCallable(callee.object, resolver, nextSeen);
  return target
    ? { boundArguments: [...target.boundArguments, ...current.arguments.slice(1)], method: target.method }
    : null;
}

function normalizeUnownedReflectionCall(node, resolver) {
  const callee = unwrap(node.callee);
  if (isGlobalMethod(callee, 'Reflect', 'apply', resolver)) {
    const target = resolveUnownedReflectionCallable(node.arguments[0], resolver);
    if (!target) return null;
    const argumentsList = resolveApplyArguments(node.arguments[2], resolver);
    return {
      arguments: argumentsList === null ? [] : [...target.boundArguments, ...argumentsList],
      method: target.method
    };
  }
  if (callee?.type === 'MemberExpression') {
    const form = propertyName(callee, resolver);
    if (form === 'call' || form === 'apply') {
      const target = resolveUnownedReflectionCallable(callee.object, resolver);
      if (!target) return null;
      const argumentsList =
        form === 'apply' ? resolveApplyArguments(node.arguments[1], resolver) : node.arguments.slice(1);
      return {
        arguments: argumentsList === null ? [] : [...target.boundArguments, ...argumentsList],
        method: target.method
      };
    }
  }
  const target = resolveUnownedReflectionCallable(callee, resolver);
  return target ? { arguments: [...target.boundArguments, ...node.arguments], method: target.method } : null;
}

function isDirectCall(node, ancestors) {
  let candidate = node;
  let index = ancestors.length - 2;
  while (index >= 0 && ancestors[index]?.type === 'ChainExpression' && ancestors[index].expression === candidate) {
    candidate = ancestors[index];
    index -= 1;
  }
  const parent = ancestors[index];
  return parent?.type === 'CallExpression' && unwrap(parent.callee) === node;
}

function isTypeofFeatureCheck(node, ancestors) {
  const parent = ancestors[ancestors.length - 2];
  return parent?.type === 'UnaryExpression' && parent.operator === 'typeof' && parent.argument === node;
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
    if (
      (candidate.type === 'ForInStatement' || candidate.type === 'ForOfStatement') &&
      containsNode(candidate.left, node)
    ) {
      return candidate.left;
    }
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

function isImmediateCallableValue(node, ancestors) {
  let current = node;
  let index = ancestors.lastIndexOf(node) - 1;
  while (index >= 0) {
    const parent = ancestors[index];
    if (parent?.type === 'ChainExpression' && parent.expression === current) {
      current = parent;
      index -= 1;
      continue;
    }
    if (
      (parent?.type === 'SequenceExpression' && parent.expressions.at(-1) === current) ||
      (parent?.type === 'ConditionalExpression' && (parent.consequent === current || parent.alternate === current)) ||
      (parent?.type === 'LogicalExpression' && (parent.left === current || parent.right === current)) ||
      ((parent?.type === 'AwaitExpression' || parent?.type === 'YieldExpression') && parent.argument === current)
    ) {
      current = parent;
      index -= 1;
      continue;
    }
    return (
      (parent?.type === 'CallExpression' && unwrap(parent.callee) === current) ||
      (parent?.type === 'TaggedTemplateExpression' && unwrap(parent.tag) === current) ||
      (parent?.type === 'NewExpression' && unwrap(parent.callee) === current)
    );
  }
  return false;
}

function immediateMemberAccess(node, ancestors) {
  let current = node;
  let index = ancestors.lastIndexOf(node) - 1;
  while (index >= 0 && ancestors[index]?.type === 'ChainExpression' && ancestors[index].expression === current) {
    current = ancestors[index];
    index -= 1;
  }
  const parent = ancestors[index];
  return parent?.type === 'MemberExpression' && unwrap(parent.object) === current ? parent : null;
}

function descriptorMapPropertyAccess(node, resolver) {
  const current = unwrap(node);
  const object = resolver.resolveExpression(unwrap(current?.object));
  if (current?.type !== 'MemberExpression' || object?.type !== 'CallExpression') return null;
  const reflectionCall = normalizeReflectionCall(object, resolver);
  return reflectionCall?.helperName === 'Object.getOwnPropertyDescriptors' && reflectionCall.form !== 'bind'
    ? reflectionCall
    : null;
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
  const escaped = JSON.stringify(source).slice(1, -1);
  return escaped.length <= 180 ? escaped : `${escaped.slice(0, 177)}...`;
}

function occurrenceFingerprint({ path: filePath, kind, source }) {
  return createHash('sha256')
    .update(JSON.stringify([filePath, kind, source]))
    .digest('hex');
}

const NON_SEMANTIC_AST_KEYS = new Set(['end', 'loc', 'range', 'raw', 'start']);

function semanticAstValue(value) {
  if (typeof value === 'bigint') return `${value}n`;
  if (Array.isArray(value)) {
    return value.filter((entry) => entry?.type !== 'EmptyStatement').map(semanticAstValue);
  }
  if (!value || typeof value !== 'object') return value;
  if (value.type === 'TemplateElement') {
    const cooked = value.value?.cooked ?? value.value?.raw ?? '';
    return {
      type: 'TemplateElement',
      tail: !!value.tail,
      value: String(cooked)
    };
  }
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !NON_SEMANTIC_AST_KEYS.has(key))
      .sort()
      .map((key) => [key, semanticAstValue(value[key])])
  );
}

function semanticNodeLabel(node) {
  return JSON.stringify(semanticAstValue(unwrap(node)));
}

function producerControlPath(node, ancestors) {
  const targetIndex = ancestors.lastIndexOf(node);
  const chain = targetIndex >= 0 ? ancestors.slice(0, targetIndex + 1) : [...ancestors, node];
  const segments = [];
  for (let index = 0; index < chain.length - 1; index += 1) {
    const parent = chain[index];
    const child = chain[index + 1];
    if (parent.type === 'IfStatement') {
      const role = child === parent.test ? 'test' : child === parent.consequent ? 'consequent' : 'alternate';
      segments.push(`if:${role}:${semanticNodeLabel(parent.test)}`);
    } else if (parent.type === 'ConditionalExpression') {
      const role = child === parent.test ? 'test' : child === parent.consequent ? 'consequent' : 'alternate';
      segments.push(`conditional:${role}:${semanticNodeLabel(parent.test)}`);
    } else if (parent.type === 'LogicalExpression') {
      const role = child === parent.left ? 'left' : 'right';
      segments.push(`logical:${role}:${parent.operator}:${semanticNodeLabel(parent.left)}`);
    } else if (['WhileStatement', 'DoWhileStatement'].includes(parent.type)) {
      const role = child === parent.test ? 'test' : 'body';
      segments.push(`${parent.type}:${role}:${semanticNodeLabel(parent.test)}`);
    } else if (parent.type === 'ForStatement') {
      const role = child === parent.body ? 'body' : child === parent.test ? 'test' : 'control';
      segments.push(
        `${parent.type}:${role}:${semanticNodeLabel({ init: parent.init, test: parent.test, update: parent.update })}`
      );
    } else if (parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') {
      const role = child === parent.body ? 'body' : 'control';
      segments.push(
        `${parent.type}:${role}:${semanticNodeLabel({ await: parent.await, left: parent.left, right: parent.right })}`
      );
    } else if (parent.type === 'SwitchStatement') {
      segments.push(`switch:${semanticNodeLabel(parent.discriminant)}`);
    } else if (parent.type === 'SwitchCase') {
      const role = child === parent.test ? 'test' : 'consequent';
      segments.push(`case:${role}:${parent.test ? semanticNodeLabel(parent.test) : '<default>'}`);
    } else if (parent.type === 'TryStatement') {
      const role = child === parent.block ? 'block' : child === parent.handler ? 'handler' : 'finalizer';
      const handler = parent.handler
        ? `catch:${parent.handler.param ? semanticNodeLabel(parent.handler.param) : '<bindingless>'}`
        : '<no-catch>';
      segments.push(`try:${role}:${handler}:${parent.finalizer ? 'finally' : '<no-finally>'}`);
    } else if (parent.type === 'CatchClause') {
      segments.push(`catch:${child === parent.param ? 'param' : 'body'}:${semanticNodeLabel(parent.param)}`);
    } else if (parent.type === 'LabeledStatement') {
      segments.push(`label:${parent.label?.name || semanticNodeLabel(parent.label)}`);
    } else if (parent.type === 'WithStatement') {
      segments.push(`with:${semanticNodeLabel(parent.object)}`);
    }
  }
  return segments.join('>');
}

function occurrenceSemanticFingerprint({ path: filePath, kind, node }) {
  return createHash('sha256')
    .update(JSON.stringify([filePath, kind, semanticAstValue(node)]))
    .digest('hex');
}

function producerAstChildren(node) {
  const children = [];
  for (const key of Object.keys(node || {}).sort()) {
    if (NON_SEMANTIC_AST_KEYS.has(key) || key === 'type') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const [index, entry] of value.entries()) {
        if (entry && typeof entry.type === 'string') children.push([`${key}[${index}]`, entry]);
      }
    } else if (value && typeof value.type === 'string') {
      children.push([key, value]);
    }
  }
  return children;
}

const GLOBAL_PRODUCER_CONTEXT = Symbol('global-producer-context');

function producerSemanticValue(
  node,
  resolver,
  seen = new Set(),
  parameterSources = new Map(),
  state = { expandedBindingContexts: new WeakMap() }
) {
  const original = unwrap(node);
  if (!original) return null;
  const resolved = unwrap(resolver.resolveExpression(original));
  if (seen.has(original)) return semanticAstValue(resolved);
  const nextSeen = new Set(seen);
  nextSeen.add(original);
  let sourceRecords = [];
  if (original.type === 'Identifier') {
    const binding = resolver.resolveBinding(original);
    const invocationArguments = binding?.functionNode ? parameterSources.get(binding.functionNode) : null;
    const parameterSource = invocationArguments
      ? resolver.invocationParameterExpression(original, binding.functionNode, invocationArguments)
      : null;
    const bindingContext =
      (binding?.functionNode && parameterSources.get(binding.functionNode)) ||
      (binding?.scope && parameterSources.get(binding.scope)) ||
      GLOBAL_PRODUCER_CONTEXT;
    const expandedContexts = binding ? state.expandedBindingContexts.get(binding) || new Set() : null;
    if (!expandedContexts?.has(bindingContext)) {
      if (binding) {
        expandedContexts.add(bindingContext);
        state.expandedBindingContexts.set(binding, expandedContexts);
      }
      sourceRecords = [
        ...resolver.possibleStoredExpressionRecords(original),
        ...(parameterSource
          ? [{ controlPath: '', expression: parameterSource, sourceContext: 'invocation-parameter' }]
          : resolver.possibleParameterExpressionRecords(original))
      ];
    }
  } else if (resolved?.type === 'MemberExpression') {
    let specificParameterSource = null;
    for (const [functionNode, invocationArguments] of [...parameterSources].reverse()) {
      specificParameterSource = resolver.invocationParameterMemberExpression(
        resolved,
        functionNode,
        invocationArguments
      );
      if (specificParameterSource) break;
    }
    sourceRecords = [
      ...resolver.possibleStoredMemberExpressionRecords(resolved),
      ...(specificParameterSource
        ? [{ controlPath: '', expression: specificParameterSource, sourceContext: 'invocation-parameter-member' }]
        : resolver.possibleParameterMemberExpressionRecords(resolved))
    ];
  } else if (resolved?.type === 'CallExpression') {
    sourceRecords = resolver.possibleCallReturnExpressionRecords(resolved);
  }
  const children = producerAstChildren(original).filter(
    ([role]) => !(resolved?.type === 'MemberExpression' && sourceRecords.length > 0 && role === 'object')
  );
  const value = {
    expression: semanticAstValue(resolved),
    children: children.map(([role, child]) => [
      role,
      producerSemanticValue(child, resolver, nextSeen, parameterSources, state)
    ])
  };
  if (sourceRecords.length > 0) {
    value.producerSources = sourceRecords.map((record) => {
      const nestedParameterSources = new Map(parameterSources);
      if (record.functionNode) nestedParameterSources.set(record.functionNode, record.arguments);
      return {
        controlPath: record.controlPath || '',
        sourceContext: record.sourceContext || '',
        value: producerSemanticValue(record.expression, resolver, nextSeen, nestedParameterSources, state)
      };
    });
  }
  return value;
}

function producerSemanticFingerprint(node, resolver) {
  return createHash('sha256')
    .update(JSON.stringify(producerSemanticValue(node, resolver)))
    .digest('hex');
}

function isFunctionLike(node) {
  const current = unwrap(node);
  return ['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'].includes(current?.type);
}

function semanticCallArgumentLabel(argument) {
  const current = unwrap(argument);
  return isFunctionLike(current) ? `<callback:${current.type}>` : semanticNodeLabel(current);
}

function semanticPropertyLabel(property) {
  if (!property || !['MethodDefinition', 'Property', 'PropertyDefinition'].includes(property.type)) {
    return '';
  }
  if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'Literal' && typeof property.key.value === 'string') return property.key.value;
  return semanticNodeLabel(property.key);
}

function semanticPropertyOwnerLabel(property) {
  const staticPrefix = property?.static ? 'static:' : '';
  const kind = property?.kind || (property?.type === 'PropertyDefinition' ? 'field' : 'init');
  const methodPrefix = property?.type === 'Property' ? `${property.method ? 'method' : 'value'}:` : '';
  const shorthandPrefix = property?.type === 'Property' && property.shorthand ? 'shorthand:' : '';
  return `${staticPrefix}${kind}:${methodPrefix}${shorthandPrefix}${semanticPropertyLabel(property) || '(computed)'}`;
}

function semanticFunctionSignature(node) {
  const asyncPrefix = node?.async ? 'async:' : '';
  const generatorPrefix = node?.generator ? 'generator:' : '';
  const parameters = (node?.params || []).map((parameter) => semanticNodeLabel(parameter)).join(',');
  return `${asyncPrefix}${generatorPrefix}params:[${parameters}]`;
}

function semanticExpressionLabel(node) {
  const current = unwrap(node);
  if (!current) return '<missing>';
  if (current.type === 'Identifier') return current.name;
  if (current.type === 'ThisExpression') return 'this';
  if (current.type === 'Literal') return `literal:${JSON.stringify(current.value)}`;
  if (current.type === 'TemplateLiteral' && current.expressions.length === 0) {
    return `literal:${JSON.stringify(current.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(''))}`;
  }
  if (current.type === 'MemberExpression') {
    const object = semanticExpressionLabel(current.object);
    if (current.computed) {
      return `${object}${current.optional ? '?.' : ''}[${semanticNodeLabel(current.property)}]`;
    }
    return `${object}${current.optional ? '?.' : '.'}${current.property?.name || semanticNodeLabel(current.property)}`;
  }
  if (current.type === 'CallExpression' || current.type === 'NewExpression') {
    const argumentsLabel = current.arguments.map(semanticCallArgumentLabel).join(', ');
    const prefix = current.type === 'NewExpression' ? 'new ' : '';
    const optional = current.optional ? '?.' : '';
    return `${prefix}${semanticExpressionLabel(current.callee)}${optional}(${argumentsLabel})`;
  }
  return semanticNodeLabel(current);
}

function structuralNodeSignature(node) {
  const current = unwrap(node);
  if (!current) return '(missing)';
  if (current.type === 'ImportDeclaration') return `import:${semanticNodeLabel(current.source)}`;
  if (current.type === 'ExportNamedDeclaration' || current.type === 'ExportDefaultDeclaration') {
    if (current.declaration) return `export:${structuralNodeSignature(current.declaration)}`;
    const exported = current.specifiers
      .map((specifier) => semanticNodeLabel(specifier.exported || specifier.local))
      .join(',');
    return `export:${semanticNodeLabel(current.source)}:${exported}`;
  }
  if (current.type === 'FunctionDeclaration' || current.type === 'ClassDeclaration') {
    return `${current.type}:${current.id?.name || '<anonymous>'}`;
  }
  if (current.type === 'VariableDeclaration') {
    return `${current.type}:${current.kind}:${current.declarations
      .map((declaration) => semanticNodeLabel(declaration.id))
      .join(',')}`;
  }
  if (current.type === 'ExpressionStatement') {
    const expression = unwrap(current.expression);
    if (expression?.type === 'AssignmentExpression') {
      return `${current.type}:assignment:${expression.operator}:${semanticNodeLabel(expression.left)}`;
    }
    if (expression?.type === 'UpdateExpression') {
      return `${current.type}:update:${semanticNodeLabel(expression.argument)}`;
    }
    if (expression?.type === 'CallExpression') {
      return `${current.type}:call:${semanticExpressionLabel(expression)}`;
    }
    if (expression?.type === 'TaggedTemplateExpression') {
      return `${current.type}:tag:${semanticExpressionLabel(expression.tag)}:${semanticNodeLabel(expression.quasi)}`;
    }
  }
  if (current.type === 'IfStatement' || current.type === 'WhileStatement' || current.type === 'DoWhileStatement') {
    return `${current.type}:${semanticNodeLabel(current.test)}`;
  }
  if (current.type === 'ForStatement') {
    return `${current.type}:${semanticNodeLabel({ init: current.init, test: current.test, update: current.update })}`;
  }
  if (current.type === 'ForInStatement' || current.type === 'ForOfStatement') {
    return `${current.type}:${semanticNodeLabel(current.left)}:${semanticNodeLabel(current.right)}`;
  }
  if (current.type === 'SwitchCase') {
    return `${current.type}:${current.test ? semanticNodeLabel(current.test) : '<default>'}`;
  }
  if (current.type === 'LabeledStatement') {
    return `${current.type}:${current.label?.name || semanticNodeLabel(current.label)}`;
  }
  if (current.type === 'TryStatement') {
    const handler = current.handler
      ? `catch:${current.handler.param ? semanticNodeLabel(current.handler.param) : '<bindingless>'}`
      : '<no-catch>';
    const finalizer = current.finalizer ? 'finally' : '<no-finally>';
    return `${current.type}:${handler}:${finalizer}`;
  }
  if (['MethodDefinition', 'Property', 'PropertyDefinition'].includes(current.type)) {
    return `${current.type}:${semanticPropertyOwnerLabel(current)}`;
  }
  return current.type;
}

function controlContextSignature(parent, child) {
  if (parent.type === 'IfStatement' || parent.type === 'WhileStatement' || parent.type === 'DoWhileStatement') {
    return `|test:${semanticNodeLabel(parent.test)}`;
  }
  if (parent.type === 'ForStatement') {
    return `|loop:${semanticNodeLabel({ init: parent.init, test: parent.test, update: parent.update })}`;
  }
  if (parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') {
    return `|loop:${semanticNodeLabel({ await: parent.await, left: parent.left, right: parent.right })}`;
  }
  if (parent.type === 'SwitchStatement') return `|switch:${semanticNodeLabel(parent.discriminant)}`;
  if (parent.type === 'SwitchCase') {
    return `|case:${parent.test ? semanticNodeLabel(parent.test) : '<default>'}`;
  }
  if (parent.type === 'ConditionalExpression') return `|test:${semanticNodeLabel(parent.test)}`;
  if (parent.type === 'LogicalExpression') {
    return `|logical:${parent.operator}:${semanticNodeLabel(parent.left)}`;
  }
  if (parent.type === 'TaggedTemplateExpression') {
    return `|tag:${semanticExpressionLabel(parent.tag)}`;
  }
  if (parent.type === 'CatchClause') return `|catch:${semanticNodeLabel(parent.param)}`;
  if (parent.type === 'WithStatement') return `|with:${semanticNodeLabel(parent.object)}`;
  if ((parent.type === 'CallExpression' || parent.type === 'NewExpression') && parent.arguments.includes(child)) {
    const argumentIndex = parent.arguments.indexOf(child);
    const callArguments = parent.arguments
      .map((argument, index) => (index === argumentIndex ? '<current>' : semanticCallArgumentLabel(argument)))
      .join(', ');
    return `|call:${semanticExpressionLabel(parent.callee)}(${callArguments})#${argumentIndex + 1}`;
  }
  return '';
}

function occurrenceChildRole(parent, child) {
  for (const [key, value] of Object.entries(parent)) {
    if (value === child) return `${parent.type}.${key}`;
    if (Array.isArray(value) && value.includes(child)) {
      const childIndex = value.indexOf(child);
      const signature = structuralNodeSignature(child);
      const semanticOrdinal =
        value.slice(0, childIndex + 1).filter((sibling) => structuralNodeSignature(sibling) === signature).length || 1;
      return `${parent.type}.${key}:${signature}#${semanticOrdinal}`;
    }
  }
  return `${parent.type}.<unknown>`;
}

function occurrenceOwner(node, ancestors) {
  const targetIndex = ancestors.lastIndexOf(node);
  const chain = targetIndex >= 0 ? ancestors.slice(0, targetIndex + 1) : [...ancestors, node];
  const ownerLabels = [];
  for (let index = 0; index < chain.length; index += 1) {
    const candidate = chain[index];
    const parent = chain[index - 1];
    if (candidate.type === 'ClassDeclaration' || candidate.type === 'ClassExpression') {
      ownerLabels.push(`class:${candidate.id?.name || '<anonymous>'}`);
      continue;
    }
    if (!isFunctionLike(candidate)) continue;
    if (candidate.type === 'FunctionDeclaration') {
      ownerLabels.push(`function:${candidate.id?.name || '<anonymous>'}:${semanticFunctionSignature(candidate)}`);
    } else if (parent?.type === 'VariableDeclarator') {
      ownerLabels.push(`variable:${semanticNodeLabel(parent.id)}:${semanticFunctionSignature(candidate)}`);
    } else if (parent?.type === 'AssignmentExpression') {
      ownerLabels.push(
        `assignment:${parent.operator}:${semanticNodeLabel(parent.left)}:${semanticFunctionSignature(candidate)}`
      );
    } else if (parent?.type === 'Property') {
      ownerLabels.push(`property:${semanticPropertyOwnerLabel(parent)}:${semanticFunctionSignature(candidate)}`);
    } else if (parent?.type === 'MethodDefinition') {
      ownerLabels.push(`method:${semanticPropertyOwnerLabel(parent)}:${semanticFunctionSignature(candidate)}`);
    } else if (parent?.type === 'PropertyDefinition') {
      ownerLabels.push(`field:${semanticPropertyOwnerLabel(parent)}:${semanticFunctionSignature(candidate)}`);
    } else if (candidate.type === 'FunctionExpression' && candidate.id?.name) {
      ownerLabels.push(`function:${candidate.id.name}:${semanticFunctionSignature(candidate)}`);
    } else {
      ownerLabels.push(`anonymous:${candidate.type}:${semanticFunctionSignature(candidate)}`);
    }
    if (
      (parent?.type === 'CallExpression' || parent?.type === 'NewExpression') &&
      parent.arguments.includes(candidate)
    ) {
      const argumentIndex = parent.arguments.indexOf(candidate);
      const callArguments = parent.arguments
        .map((argument, argumentOffset) =>
          argumentOffset === argumentIndex ? '<callback>' : semanticCallArgumentLabel(argument)
        )
        .join(', ');
      ownerLabels.push(`callback:${semanticExpressionLabel(parent.callee)}(${callArguments})#${argumentIndex + 1}`);
    }
  }
  const roles = [];
  for (let index = 0; index < chain.length - 1; index += 1) {
    const parent = chain[index];
    const child = chain[index + 1];
    roles.push(`${occurrenceChildRole(parent, child)}${controlContextSignature(parent, child)}`);
  }
  return {
    owner: ownerLabels.join('/') || 'program',
    context: roles.join('>') || 'program'
  };
}

function occurrenceApprovalOwner(node, ancestors) {
  const targetIndex = ancestors.lastIndexOf(node);
  const chain = targetIndex >= 0 ? ancestors.slice(0, targetIndex + 1) : [...ancestors, node];
  const labels = [];
  for (let index = 0; index < chain.length; index += 1) {
    const candidate = chain[index];
    const parent = chain[index - 1];
    if (!isFunctionLike(candidate)) continue;
    if (candidate.type === 'FunctionDeclaration') labels.push(`function:${candidate.id?.name || '<anonymous>'}`);
    else if (parent?.type === 'VariableDeclarator') labels.push(`variable:${semanticNodeLabel(parent.id)}`);
    else if (parent?.type === 'AssignmentExpression') labels.push(`assignment:${semanticNodeLabel(parent.left)}`);
    else if (parent?.type === 'Property') labels.push(`property:${semanticPropertyLabel(parent) || '(computed)'}`);
    else if (parent?.type === 'MethodDefinition')
      labels.push(`method:${semanticPropertyLabel(parent) || '(computed)'}`);
    else if (parent?.type === 'PropertyDefinition')
      labels.push(`field:${semanticPropertyLabel(parent) || '(computed)'}`);
    else if (candidate.type === 'FunctionExpression' && candidate.id?.name)
      labels.push(`function:${candidate.id.name}`);
    else labels.push(`anonymous:${candidate.type}`);
  }
  return labels.join('/') || 'program';
}

function createOccurrence(filePath, kind, node, source, ancestors, details = {}) {
  const exactSource = source.slice(node.start, node.end);
  const owner = occurrenceOwner(node, ancestors);
  return {
    path: filePath,
    ...owner,
    kind,
    line: node.loc.start.line,
    column: node.loc.start.column + 1,
    fingerprint: occurrenceFingerprint({ path: filePath, kind, source: exactSource }),
    semanticFingerprint: occurrenceSemanticFingerprint({ path: filePath, kind, node }),
    evidence: compactEvidence(exactSource),
    ...details
  };
}

function reviewedReflectionOccurrence(filePath, operation, node, source, ancestors) {
  const approvalOwner = occurrenceApprovalOwner(node, ancestors);
  const approval = REVIEWED_REFLECTION_CONTROLS.get(`${filePath}|${approvalOwner}|${operation}`);
  if (!approval) return null;
  return createOccurrence(filePath, 'reflection-control', node, source, ancestors, {
    approvalOwner,
    operation,
    targetContract: approval.targetContract
  });
}

function reflectionControlApproval(occurrence) {
  return (
    REVIEWED_REFLECTION_CONTROLS.get(
      `${occurrence.path}|${occurrence.approvalOwner || occurrence.owner}|${occurrence.operation}`
    ) || null
  );
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

function reviewedTimerCallbackApproval(filePath, node, source, argument = node.arguments[0]) {
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
  const handledComputedPropertyControls = new Set();
  const handledCallableStorage = new Set();
  const handledPatternReferences = new Set();
  const recordUnprovenReflection = (operation, node, ancestors) => {
    const reviewed = reviewedReflectionOccurrence(filePath, operation, node, source, ancestors);
    if (reviewed) approved.push(reviewed);
    else prohibited.push(createOccurrence(filePath, operation, node, source, ancestors));
  };
  const recordDocumentPatternAliases = (pattern, node, ancestors, sourceExpression = null) => {
    const aliases = [
      ...documentPatternProperties(pattern, resolver),
      ...documentPatternValueAliases(pattern, sourceExpression, resolver)
    ];
    for (const name of aliases) {
      prohibited.push(
        createOccurrence(filePath, `document-object-indirect-reference:${name}`, node, source, ancestors)
      );
    }
  };
  const recordPatternReference = (kind, node, ancestors) => {
    const key = `${kind}:${node.start}:${node.end}`;
    if (handledPatternReferences.has(key)) return;
    handledPatternReferences.add(key);
    prohibited.push(createOccurrence(filePath, kind, node, source, ancestors));
  };
  const recordIndirectPatternReferences = (pattern, sourceExpression, node, ancestors) => {
    const current = unwrap(pattern);
    if (!current) return;
    if (current.type === 'AssignmentPattern') {
      if (isOpaqueComputedCallable(current.right, resolver)) {
        recordComputedPropertyControl('html-call-unproven-property', node, ancestors);
      }
      recordIndirectPatternReferences(current.left, current.right, node, ancestors);
      return;
    }
    if (current.type === 'RestElement') {
      recordIndirectPatternReferences(current.argument, null, node, ancestors);
      return;
    }
    if (current.type === 'ArrayPattern') {
      for (const element of current.elements) {
        recordIndirectPatternReferences(element, null, node, ancestors);
      }
      return;
    }
    if (current.type !== 'ObjectPattern') return;
    for (const property of current.properties) {
      if (property.type === 'RestElement') {
        recordIndirectPatternReferences(property, sourceExpression, node, ancestors);
        continue;
      }
      const name = objectPropertyName(property, resolver);
      if (property.computed && !name) {
        recordComputedPropertyControl('html-call-unproven-property', node, ancestors);
      }
      if (HTML_CALLABLE_PROPERTIES.has(name)) {
        recordPatternReference(`${name}-indirect-reference`, node, ancestors);
      }
      if ((name === 'write' || name === 'writeln') && isDocumentObject(sourceExpression, resolver)) {
        recordPatternReference(`document.${name}-indirect-reference`, node, ancestors);
      }
      for (const [objectName, helpers] of [
        ['Reflect', REFLECT_HELPERS],
        ['Object', OBJECT_HELPERS]
      ]) {
        if (helpers.has(name) && isGlobalObject(sourceExpression, objectName, resolver)) {
          recordPatternReference(`${objectName}.${name}-indirect-reference`, node, ancestors);
        }
      }
      recordIndirectPatternReferences(property.value, null, node, ancestors);
    }
  };
  const recordComputedPropertyControl = (operation, node, ancestors) => {
    const key = `${operation}:${node.start}:${node.end}`;
    if (handledComputedPropertyControls.has(key)) return;
    handledComputedPropertyControls.add(key);
    approved.push(createOccurrence(filePath, 'computed-property-control', node, source, ancestors, { operation }));
  };
  const recordCallableStorage = (value, node, ancestors) => {
    for (const { target } of resolveCallableValues(value, resolver)) {
      const key = `${target}:${node.start}:${node.end}`;
      if (handledCallableStorage.has(key)) continue;
      handledCallableStorage.add(key);
      prohibited.push(createOccurrence(filePath, `${target}-indirect-storage`, node, source, ancestors));
    }
  };
  const recordUnownedReflectionCall = (method, node, ancestors, reflectionArguments = node.arguments) => {
    if (method === 'set' && reflectionArguments.length >= 3) {
      const reflectedProperty = staticStringValue(reflectionArguments[1], resolver);
      if (reflectedProperty === null) {
        prohibited.push(
          createOccurrence(filePath, 'Reflect.set-unproven-property-unproven-owner', node, source, ancestors)
        );
      } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
        prohibited.push(
          createOccurrence(filePath, `Reflect.set-${reflectedProperty}-unproven-owner`, node, source, ancestors)
        );
      }
      return;
    }
    if (method === 'get' && reflectionArguments.length >= 2) {
      const reflectedProperty = staticStringValue(reflectionArguments[1], resolver);
      if (reflectedProperty === null) {
        prohibited.push(
          createOccurrence(filePath, 'Reflect.get-unproven-property-unproven-owner', node, source, ancestors)
        );
      } else if (
        HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty) ||
        DANGEROUS_DESCRIPTOR_VALUE_PROPERTIES.has(reflectedProperty)
      ) {
        prohibited.push(
          createOccurrence(filePath, `Reflect.get-${reflectedProperty}-unproven-owner`, node, source, ancestors)
        );
      }
      return;
    }
    if (method === 'assign') {
      for (const argument of reflectionArguments.slice(1)) {
        const analysis = analyzeReflectedObject(argument, resolver);
        if (analysis.opaque.length > 0) {
          prohibited.push(
            createOccurrence(filePath, 'Object.assign-unproven-payload-unproven-owner', node, source, ancestors)
          );
        }
        for (const property of analysis.properties) {
          const reflectedProperty = objectPropertyName(property, resolver);
          if (!reflectedProperty) {
            prohibited.push(
              createOccurrence(filePath, 'Object.assign-unproven-property-unproven-owner', node, source, ancestors)
            );
          } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
            prohibited.push(
              createOccurrence(filePath, `Object.assign-${reflectedProperty}-unproven-owner`, node, source, ancestors)
            );
          }
        }
      }
      return;
    }
    if (method === 'defineProperty' && reflectionArguments.length >= 2) {
      const reflectedProperty = staticStringValue(reflectionArguments[1], resolver);
      if (reflectedProperty === null) {
        prohibited.push(
          createOccurrence(filePath, 'Object.defineProperty-unproven-property-unproven-owner', node, source, ancestors)
        );
      } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
        prohibited.push(
          createOccurrence(
            filePath,
            `Object.defineProperty-${reflectedProperty}-unproven-owner`,
            node,
            source,
            ancestors
          )
        );
      }
      return;
    }
    if (method === 'defineProperties' && reflectionArguments.length >= 2) {
      const analysis = analyzeReflectedObject(reflectionArguments[1], resolver);
      if (analysis.opaque.length > 0) {
        prohibited.push(
          createOccurrence(
            filePath,
            'Object.defineProperties-unproven-descriptors-unproven-owner',
            node,
            source,
            ancestors
          )
        );
      }
      for (const property of analysis.properties) {
        const reflectedProperty = objectPropertyName(property, resolver);
        if (!reflectedProperty) {
          prohibited.push(
            createOccurrence(
              filePath,
              'Object.defineProperties-unproven-property-unproven-owner',
              node,
              source,
              ancestors
            )
          );
        } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
          prohibited.push(
            createOccurrence(
              filePath,
              `Object.defineProperties-${reflectedProperty}-unproven-owner`,
              node,
              source,
              ancestors
            )
          );
        }
      }
      return;
    }
    if (method === 'getOwnPropertyDescriptor' && reflectionArguments.length >= 2) {
      const reflectedProperty = staticStringValue(reflectionArguments[1], resolver);
      if (reflectedProperty === null) {
        prohibited.push(
          createOccurrence(
            filePath,
            'Object.getOwnPropertyDescriptor-unproven-property-unproven-owner',
            node,
            source,
            ancestors
          )
        );
      } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty) || HTML_CALLABLE_PROPERTIES.has(reflectedProperty)) {
        const kind = HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)
          ? `Object.getOwnPropertyDescriptor-${reflectedProperty}-unproven-owner`
          : `Object.getOwnPropertyDescriptor-${reflectedProperty}-value-unproven-owner`;
        prohibited.push(createOccurrence(filePath, kind, node, source, ancestors));
      }
      return;
    }
    if (method === 'getOwnPropertyDescriptors') {
      const access = immediateMemberAccess(node, ancestors);
      const reflectedProperty = access ? propertyName(access, resolver) : '';
      if (
        HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty) ||
        DANGEROUS_DESCRIPTOR_VALUE_PROPERTIES.has(reflectedProperty)
      ) {
        const kind = HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)
          ? `Object.getOwnPropertyDescriptors-${reflectedProperty}-unproven-owner`
          : `Object.getOwnPropertyDescriptors-${reflectedProperty}-value-unproven-owner`;
        prohibited.push(createOccurrence(filePath, kind, node, source, ancestors));
      }
    }
  };

  ancestor(ast, {
    Property(node, ancestors) {
      const parent = ancestors[ancestors.length - 2];
      if (parent?.type === 'ObjectExpression' && node.kind === 'init') {
        recordCallableStorage(node.value, node, ancestors);
      }
    },

    PropertyDefinition(node, ancestors) {
      if (node.value) recordCallableStorage(node.value, node, ancestors);
    },

    MemberExpression(node, ancestors) {
      const name = propertyName(node, resolver);
      const descriptorMapAccess = descriptorMapPropertyAccess(node, resolver);
      if (descriptorMapAccess) {
        if (!name) {
          recordUnprovenReflection('Object.getOwnPropertyDescriptors-unproven-property', node, ancestors);
        } else if (HTML_ASSIGNMENT_PROPERTIES.has(name)) {
          prohibited.push(
            createOccurrence(
              filePath,
              `Object.getOwnPropertyDescriptors-${name}-setter-reference`,
              node,
              source,
              ancestors
            )
          );
        } else if (DANGEROUS_DESCRIPTOR_VALUE_PROPERTIES.has(name)) {
          prohibited.push(
            createOccurrence(
              filePath,
              `Object.getOwnPropertyDescriptors-${name}-value-reference`,
              node,
              source,
              ancestors
            )
          );
        }
        return;
      }
      if (node.computed && !name) {
        const mutation = mutationOwner(node, ancestors);
        if (mutation) {
          recordComputedPropertyControl('html-assignment-unproven-property', mutation, ancestors);
        }
      }
      if (!isDirectCall(node, ancestors) && !isTypeofFeatureCheck(node, ancestors)) {
        for (const [objectName, helperNames] of [
          ['Reflect', REFLECT_HELPERS],
          ['Object', OBJECT_HELPERS]
        ]) {
          if (helperNames.has(name) && isGlobalMethod(node, objectName, name, resolver)) {
            prohibited.push(
              createOccurrence(filePath, `${objectName}.${name}-indirect-reference`, node, source, ancestors)
            );
          }
        }
      }
      if (
        (name === 'write' || name === 'writeln') &&
        isDocumentObject(node.object, resolver) &&
        !isDirectCall(node, ancestors) &&
        !isTypeofFeatureCheck(node, ancestors)
      ) {
        prohibited.push(createOccurrence(filePath, `document.${name}-indirect-reference`, node, source, ancestors));
      }
      if (
        HTML_CALLABLE_PROPERTIES.has(name) &&
        !isDirectCall(node, ancestors) &&
        !isTypeofFeatureCheck(node, ancestors)
      ) {
        prohibited.push(createOccurrence(filePath, `${name}-indirect-reference`, node, source, ancestors));
      }
      if (!['innerHTML', 'outerHTML', 'srcdoc'].includes(name)) return;
      const mutation = mutationOwner(node, ancestors);
      if (mutation) {
        const suffix = mutation.type === 'UnaryExpression' ? 'delete' : 'write';
        if (name === 'innerHTML' && suffix === 'write') {
          const producerFingerprint = producerSemanticFingerprint(
            mutation.type === 'AssignmentExpression' ? mutation.right : mutation,
            resolver
          );
          approved.push(
            createOccurrence(filePath, 'innerHTML-write', mutation, source, ancestors, {
              empty:
                mutation.type === 'AssignmentExpression' &&
                mutation.left === node &&
                staticStringValue(mutation.right, resolver) === '',
              producerSemanticFingerprint: producerFingerprint
            })
          );
        } else {
          prohibited.push(createOccurrence(filePath, `${name}-${suffix}`, mutation, source, ancestors));
        }
        return;
      }
      if (name === 'srcdoc') return;
      const owner = serializerOwner(node, ancestors);
      const ownerKey = `${owner.start}:${owner.end}:${name}`;
      if (handledSerializerOwners.has(ownerKey)) return;
      handledSerializerOwners.add(ownerKey);
      approved.push(createOccurrence(filePath, 'serializer-read', owner, source, ancestors, { property: name }));
    },

    VariableDeclarator(node, ancestors) {
      if (!node.init) return;
      if (node.id?.type === 'ObjectPattern' || node.id?.type === 'ArrayPattern') {
        recordDocumentPatternAliases(node.id, node, ancestors, node.init);
        recordIndirectPatternReferences(node.id, node.init, node, ancestors);
      }
    },

    AssignmentExpression(node, ancestors) {
      if (unwrap(node.left)?.type === 'MemberExpression') {
        recordCallableStorage(node.right, node, ancestors);
      }
      if (
        node.left?.type === 'Identifier' &&
        !isImmediateCallableValue(node, ancestors) &&
        isOpaqueComputedCallable(node.right, resolver)
      ) {
        recordComputedPropertyControl('html-call-unproven-property', node, ancestors);
      }
      const leftDocumentProperty = propertyName(node.left, resolver);
      if (
        node.left?.type !== 'ObjectPattern' &&
        !DOCUMENT_REFERENCE_PROPERTIES.has(leftDocumentProperty) &&
        isDocumentObject(node.right, resolver)
      ) {
        prohibited.push(createOccurrence(filePath, 'document-object-assignment', node, source, ancestors));
      }
      if (node.left?.type !== 'ObjectPattern' && node.left?.type !== 'ArrayPattern') return;
      recordDocumentPatternAliases(node.left, node, ancestors, node.right);
      recordIndirectPatternReferences(node.left, node.right, node, ancestors);
    },

    FunctionDeclaration(node, ancestors) {
      for (const parameter of node.params) {
        const target = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;
        if (target.type === 'ObjectPattern' || target.type === 'ArrayPattern') {
          recordDocumentPatternAliases(parameter, node, ancestors);
        }
        recordIndirectPatternReferences(parameter, null, node, ancestors);
      }
    },

    FunctionExpression(node, ancestors) {
      for (const parameter of node.params) {
        const target = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;
        if (target.type === 'ObjectPattern' || target.type === 'ArrayPattern') {
          recordDocumentPatternAliases(parameter, node, ancestors);
        }
        recordIndirectPatternReferences(parameter, null, node, ancestors);
      }
    },

    ArrowFunctionExpression(node, ancestors) {
      for (const parameter of node.params) {
        const target = parameter.type === 'AssignmentPattern' ? parameter.left : parameter;
        if (target.type === 'ObjectPattern' || target.type === 'ArrayPattern') {
          recordDocumentPatternAliases(parameter, node, ancestors);
        }
        recordIndirectPatternReferences(parameter, null, node, ancestors);
      }
    },

    CallExpression(node, ancestors) {
      const directCallee = unwrap(node.callee);
      const resolvedCallee = resolver.resolveExpression(directCallee);
      const aliasedCallee = resolvedCallee !== directCallee;
      const name = calleeName(resolvedCallee, resolver);
      const opaqueReflectTarget =
        (isGlobalMethod(directCallee, 'Reflect', 'apply', resolver) ||
          isGlobalMethod(directCallee, 'Reflect', 'construct', resolver)) &&
        isOpaqueComputedInvocation(node.arguments[0], resolver);
      const forwardedCallable = normalizeFunctionPrototypeForwarding(node, resolver);
      const opaqueForwardedTarget =
        forwardedCallable && isOpaqueComputedInvocation(forwardedCallable.targetExpression, resolver);
      if (isOpaqueComputedInvocation(directCallee, resolver) || opaqueReflectTarget || opaqueForwardedTarget) {
        recordComputedPropertyControl('html-call-unproven-property', node, ancestors);
      }
      if (name === 'insertAdjacentHTML') {
        if (aliasedCallee) {
          prohibited.push(createOccurrence(filePath, 'insertAdjacentHTML-indirect-call', node, source, ancestors));
        } else {
          approved.push(createOccurrence(filePath, 'insertAdjacentHTML', node, source, ancestors));
        }
      }
      if (
        (name === 'write' || name === 'writeln') &&
        resolvedCallee?.type === 'MemberExpression' &&
        isDocumentObject(resolvedCallee.object, resolver)
      ) {
        prohibited.push(
          createOccurrence(
            filePath,
            aliasedCallee ? `document.${name}-indirect-call` : `document.${name}`,
            node,
            source,
            ancestors
          )
        );
      }
      if (name === 'parseFromString') {
        const mime = staticStringValue(node.arguments[1], resolver);
        if (aliasedCallee) {
          prohibited.push(createOccurrence(filePath, 'DOMParser-indirect-call', node, source, ancestors));
        } else if (mime === null) {
          prohibited.push(createOccurrence(filePath, 'DOMParser-unproven-mime', node, source, ancestors));
        } else if (/^text\/html(?:\s*;|$)/iu.test(mime.trim())) {
          prohibited.push(createOccurrence(filePath, 'DOMParser-text-html', node, source, ancestors));
        }
      }
      if (name === 'createContextualFragment') {
        prohibited.push(createOccurrence(filePath, 'createContextualFragment', node, source, ancestors));
      }
      if (name === 'setHTMLUnsafe' || name === 'parseHTMLUnsafe') {
        prohibited.push(
          createOccurrence(filePath, aliasedCallee ? `${name}-indirect-call` : name, node, source, ancestors)
        );
      }
      if (name === '__lookupSetter__') {
        const reflectedProperty = staticStringValue(node.arguments[0], resolver);
        if (reflectedProperty === null) {
          recordUnprovenReflection('__lookupSetter__-unproven-property', node, ancestors);
        } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
          prohibited.push(
            createOccurrence(
              filePath,
              `__lookupSetter__-${reflectedProperty}-setter-reference`,
              node,
              source,
              ancestors
            )
          );
        }
      }
      for (const invocation of normalizeCallableInvocations(node, resolver)) {
        if (invocation.form === 'bind') continue;
        const isDirectTarget = callablePropertyTarget(directCallee, resolver) === invocation.target;
        if (invocation.target === 'eval') {
          prohibited.push(
            createOccurrence(
              filePath,
              isDirectTarget ? 'eval' : `eval-${invocation.form}-call`,
              node,
              source,
              ancestors
            )
          );
          continue;
        }
        if (invocation.target === 'Function') {
          prohibited.push(
            createOccurrence(
              filePath,
              isDirectTarget ? 'Function-constructor-call' : `Function-constructor-${invocation.form}-call`,
              node,
              source,
              ancestors
            )
          );
          continue;
        }
        const timerArgument = invocation.arguments?.[0];
        const timerString = timerArgument ? staticStringValue(timerArgument, resolver) : null;
        if (timerString !== null) {
          prohibited.push(createOccurrence(filePath, `${invocation.target}-string`, node, source, ancestors));
        } else if (!timerArgument || !resolver.isCallable(timerArgument)) {
          const approval = timerArgument ? reviewedTimerCallbackApproval(filePath, node, source, timerArgument) : null;
          if (approval) {
            approved.push(
              createOccurrence(
                filePath,
                isDirectTarget ? 'timer-callback-control' : 'timer-callback-alias-control',
                node,
                source,
                ancestors,
                approval
              )
            );
          } else {
            prohibited.push(
              createOccurrence(filePath, `${invocation.target}-unproven-callback`, node, source, ancestors)
            );
          }
        }
      }
      if (name === 'setAttribute' && staticStringValue(node.arguments[0], resolver)?.toLowerCase() === 'srcdoc') {
        prohibited.push(createOccurrence(filePath, 'srcdoc-setAttribute', node, source, ancestors));
      }
      if (name === 'setAttributeNS' && staticStringValue(node.arguments[1], resolver)?.toLowerCase() === 'srcdoc') {
        prohibited.push(createOccurrence(filePath, 'srcdoc-setAttributeNS', node, source, ancestors));
      }
      if (
        name === 'execCommand' &&
        staticStringValue(node.arguments[0], resolver)?.trim().toLowerCase() === 'inserthtml'
      ) {
        prohibited.push(createOccurrence(filePath, 'execCommand-insertHTML', node, source, ancestors));
      }
      const reflectionCall = normalizeReflectionCall(node, resolver);
      if (reflectionCall) {
        if (reflectionCall.form !== 'direct') {
          prohibited.push(
            createOccurrence(filePath, `${reflectionCall.helperName}-${reflectionCall.form}`, node, source, ancestors)
          );
        }
        if (reflectionCall.form === 'bind') return;
        const [reflectionObject, reflectionMethod] = reflectionCall.helperName.split('.');
        const reflectionArguments = reflectionCall.arguments;
        if (reflectionCall.form !== 'opaque-apply' && reflectionObject === 'Reflect' && reflectionMethod === 'set') {
          const reflectedProperty = staticStringValue(reflectionArguments[1], resolver);
          if (reflectedProperty === null) {
            recordUnprovenReflection('Reflect.set-unproven-property', node, ancestors);
          } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
            prohibited.push(createOccurrence(filePath, `Reflect.set-${reflectedProperty}`, node, source, ancestors));
          }
        }
        if (reflectionCall.form !== 'opaque-apply' && reflectionObject === 'Reflect' && reflectionMethod === 'get') {
          const reflectedProperty = staticStringValue(reflectionArguments[1], resolver);
          if (reflectedProperty === null) {
            recordUnprovenReflection('Reflect.get-unproven-property', node, ancestors);
          } else {
            if (HTML_CALLABLE_PROPERTIES.has(reflectedProperty)) {
              prohibited.push(
                createOccurrence(filePath, `${reflectedProperty}-indirect-reference`, node, source, ancestors)
              );
            }
            if (
              (reflectedProperty === 'write' || reflectedProperty === 'writeln') &&
              isDocumentObject(reflectionArguments[0], resolver)
            ) {
              prohibited.push(
                createOccurrence(filePath, `document.${reflectedProperty}-indirect-reference`, node, source, ancestors)
              );
            }
            for (const objectName of ['Object', 'Reflect']) {
              if (
                isGlobalObject(reflectionArguments[0], objectName, resolver) &&
                reflectedHelperName(objectName, reflectedProperty)
              ) {
                prohibited.push(
                  createOccurrence(
                    filePath,
                    `${objectName}.${reflectedProperty}-indirect-reference`,
                    node,
                    source,
                    ancestors
                  )
                );
              }
            }
          }
        }
        if (
          reflectionCall.form !== 'opaque-apply' &&
          (reflectionObject === 'Object' || reflectionObject === 'Reflect') &&
          reflectionMethod === 'getOwnPropertyDescriptor' &&
          reflectionArguments.length >= 2
        ) {
          const reflectedProperty = staticStringValue(reflectionArguments[1], resolver);
          if (reflectedProperty === null) {
            recordUnprovenReflection(`${reflectionObject}.getOwnPropertyDescriptor-unproven-property`, node, ancestors);
          } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
            prohibited.push(
              createOccurrence(
                filePath,
                `${reflectionObject}.getOwnPropertyDescriptor-${reflectedProperty}-setter-reference`,
                node,
                source,
                ancestors
              )
            );
          } else if (DANGEROUS_DESCRIPTOR_VALUE_PROPERTIES.has(reflectedProperty)) {
            prohibited.push(
              createOccurrence(
                filePath,
                `${reflectionObject}.getOwnPropertyDescriptor-${reflectedProperty}-value-reference`,
                node,
                source,
                ancestors
              )
            );
          }
        }
        if (
          reflectionCall.form !== 'opaque-apply' &&
          reflectionCall.form !== 'bind' &&
          reflectionObject === 'Object' &&
          reflectionMethod === 'getOwnPropertyDescriptors'
        ) {
          const access = immediateMemberAccess(node, ancestors);
          if (!access) {
            recordUnprovenReflection('Object.getOwnPropertyDescriptors-unproven-property', node, ancestors);
          }
        }
        if (reflectionCall.form !== 'opaque-apply' && reflectionObject === 'Object' && reflectionMethod === 'assign') {
          for (const argument of reflectionArguments.slice(1)) {
            const analysis = analyzeReflectedObject(argument, resolver);
            if (analysis.opaque.length > 0) {
              recordUnprovenReflection('Object.assign-unproven-payload', node, ancestors);
            }
            for (const property of analysis.properties) {
              const reflectedProperty = objectPropertyName(property, resolver);
              if (!reflectedProperty) {
                recordUnprovenReflection('Object.assign-unproven-property', node, ancestors);
              } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
                prohibited.push(
                  createOccurrence(filePath, `Object.assign-${reflectedProperty}`, node, source, ancestors)
                );
              }
            }
          }
        }
        if (
          reflectionCall.form !== 'opaque-apply' &&
          reflectionObject === 'Object' &&
          reflectionMethod === 'defineProperty' &&
          reflectionArguments.length >= 2
        ) {
          const reflectedProperty = staticStringValue(reflectionArguments[1], resolver);
          if (reflectedProperty === null) {
            recordUnprovenReflection('Object.defineProperty-unproven-property', node, ancestors);
          } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
            prohibited.push(
              createOccurrence(filePath, `Object.defineProperty-${reflectedProperty}`, node, source, ancestors)
            );
          }
        }
        if (
          reflectionCall.form !== 'opaque-apply' &&
          reflectionObject === 'Object' &&
          reflectionMethod === 'defineProperties' &&
          reflectionArguments.length >= 2
        ) {
          const analysis = analyzeReflectedObject(reflectionArguments[1], resolver);
          if (analysis.opaque.length > 0) {
            recordUnprovenReflection('Object.defineProperties-unproven-descriptors', node, ancestors);
          }
          for (const property of analysis.properties) {
            const reflectedProperty = objectPropertyName(property, resolver);
            if (!reflectedProperty) {
              recordUnprovenReflection('Object.defineProperties-unproven-property', node, ancestors);
            } else if (HTML_ASSIGNMENT_PROPERTIES.has(reflectedProperty)) {
              prohibited.push(
                createOccurrence(filePath, `Object.defineProperties-${reflectedProperty}`, node, source, ancestors)
              );
            }
          }
        }
      } else {
        const unownedReflectionCall = normalizeUnownedReflectionCall(node, resolver);
        if (unownedReflectionCall) {
          recordUnownedReflectionCall(unownedReflectionCall.method, node, ancestors, unownedReflectionCall.arguments);
        }
      }
    },

    TaggedTemplateExpression(node, ancestors) {
      if (isOpaqueComputedInvocation(node.tag, resolver)) {
        recordComputedPropertyControl('html-call-unproven-property', node, ancestors);
      }
      for (const { target } of resolveCallableValues(node.tag, resolver)) {
        const kind = target === 'Function' ? 'Function-constructor-tag' : `${target}-tagged-call`;
        prohibited.push(createOccurrence(filePath, kind, node, source, ancestors));
      }
    },

    NewExpression(node, ancestors) {
      if (isOpaqueComputedInvocation(node.callee, resolver)) {
        recordComputedPropertyControl('html-call-unproven-property', node, ancestors);
      }
      for (const { target, boundArguments } of resolveCallableValues(node.callee, resolver)) {
        if (target === 'Function') {
          prohibited.push(createOccurrence(filePath, 'new-Function', node, source, ancestors));
        } else if (target === 'eval') {
          prohibited.push(createOccurrence(filePath, 'new-eval', node, source, ancestors));
        } else {
          const timerArgument = [...boundArguments, ...node.arguments][0];
          const timerString = timerArgument ? staticStringValue(timerArgument, resolver) : null;
          if (timerString !== null) {
            prohibited.push(createOccurrence(filePath, `${target}-string`, node, source, ancestors));
          } else if (!timerArgument || !resolver.isCallable(timerArgument)) {
            prohibited.push(createOccurrence(filePath, `${target}-unproven-callback`, node, source, ancestors));
          }
        }
      }
    },

    ImportExpression(node, ancestors) {
      const literal = literalImportValue(node.source);
      if (literal !== null) {
        approved.push(
          createOccurrence(filePath, 'dynamic-import', node, source, ancestors, {
            literal
          })
        );
        return;
      }
      const approval = nonLiteralImportApproval(filePath, node, source);
      if (!approval) {
        prohibited.push(createOccurrence(filePath, 'non-literal-dynamic-import', node, source, ancestors));
        return;
      }
      approved.push(createOccurrence(filePath, 'dynamic-import', node, source, ancestors, approval));
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
  for (const element of collectHtmlScriptElements(html, filePath)) {
    if (element.attributeMap.has('src')) continue;
    const source = element.source || '';
    if (!source.trim()) continue;
    const sourceType = element.attributeMap.get('type')?.toLowerCase() === 'module' ? 'module' : 'script';
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
  for (const key of [
    'approvalOwner',
    'empty',
    'property',
    'literal',
    'argument',
    'executableExtensions',
    'control',
    'operation',
    'producerSemanticFingerprint',
    'targetContract'
  ]) {
    if (Object.hasOwn(occurrence, key)) metadata[key] = occurrence[key];
  }
  return JSON.stringify([
    occurrence.path,
    occurrence.owner,
    occurrence.context,
    occurrence.kind,
    occurrence.semanticFingerprint,
    metadata
  ]);
}

function legacyOccurrenceKey(occurrence) {
  const metadata = {};
  for (const key of [
    'empty',
    'property',
    'literal',
    'argument',
    'executableExtensions',
    'control',
    'operation',
    'targetContract'
  ]) {
    if (Object.hasOwn(occurrence, key)) metadata[key] = occurrence[key];
  }
  return JSON.stringify([occurrence.path, occurrence.kind, occurrence.fingerprint, metadata]);
}

function inventoryKey(occurrence) {
  return JSON.stringify([occurrenceKey(occurrence), occurrence.fingerprint, occurrence.evidence]);
}

function dispositionTransitionKey(occurrence) {
  return JSON.stringify([occurrenceKey(occurrence), occurrence.classification, occurrence.rationale]);
}

function countKeysBy(entries, keyFor) {
  const counts = new Map();
  for (const entry of entries) {
    const key = keyFor(entry);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function subsetErrors(headEntries, baseEntries, keyFor, label) {
  const head = countKeysBy(headEntries, keyFor);
  const base = countKeysBy(baseEntries, keyFor);
  const errors = [];
  for (const [key, count] of head) {
    const baseCount = base.get(key) || 0;
    if (count > baseCount) errors.push(`${label} grew by ${count - baseCount}: ${key}`);
  }
  return errors.sort();
}

export function verifyPolicyTransition(basePolicy, headPolicy, baseBootstrapInventory = []) {
  if (!basePolicy) return ['merge-base HTML sink policy is missing'];
  const base = Array.isArray(basePolicy.approved) ? basePolicy.approved : [];
  const head = Array.isArray(headPolicy.approved) ? headPolicy.approved : [];
  const bootstrapKinds = ['computed-property-control', 'reflection-control', 'timer-callback-alias-control'];
  const bootstrappedControls = [];
  let transitionHead = head;
  for (const kind of bootstrapKinds) {
    if (base.some((entry) => entry.kind === kind)) continue;
    bootstrappedControls.push(...head.filter((entry) => entry.kind === kind));
    transitionHead = transitionHead.filter((entry) => entry.kind !== kind);
  }
  const baseUsesLegacyIdentity =
    base.length > 0 && base.every((entry) => !entry.owner || !entry.context || !entry.semanticFingerprint);
  const headUsesOwnerIdentity = head.every((entry) => entry.owner && entry.context && entry.semanticFingerprint);
  if (baseUsesLegacyIdentity && headUsesOwnerIdentity) {
    const keyFor = (entry) => JSON.stringify([legacyOccurrenceKey(entry), entry.classification, entry.rationale]);
    const errors = [
      ...subsetErrors(transitionHead, base, keyFor, 'owner-identity migration'),
      ...subsetErrors(base, transitionHead, keyFor, 'owner-identity migration removed reviewed occurrence'),
      ...subsetErrors(
        bootstrappedControls,
        baseBootstrapInventory,
        occurrenceKey,
        'reviewed control bootstrap was not present at merge base'
      )
    ];
    return errors.sort();
  }
  return [
    ...subsetErrors(transitionHead, base, dispositionTransitionKey, 'HTML sink baseline'),
    ...subsetErrors(
      bootstrappedControls,
      baseBootstrapInventory,
      occurrenceKey,
      'reviewed control bootstrap was not present at merge base'
    )
  ].sort();
}

function gitText(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  }).trim();
}

function reflectionControlsAtRef(ref) {
  const filePaths = [
    ...new Set([...REVIEWED_REFLECTION_CONTROLS.keys()].map((key) => key.slice(0, key.indexOf('|'))))
  ].sort();
  const controls = [];
  for (const filePath of filePaths) {
    const source = execFileSync('git', ['show', `${ref}:${filePath}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
    const inventory = scanJavaScriptSource({ filePath, source });
    controls.push(...inventory.approved.filter(({ kind }) => kind === 'reflection-control'));
  }
  return controls;
}

function approvedControlsAtRef(ref, kind) {
  const listed = gitText([
    'ls-tree',
    '-r',
    '--name-only',
    ref,
    '--',
    ...JAVASCRIPT_ROOTS,
    ...JAVASCRIPT_FILES,
    ...ENTRYPOINTS
  ]);
  const files = listed ? listed.split('\n') : [];
  const controls = [];
  for (const filePath of files.sort((left, right) => left.localeCompare(right))) {
    if (filePath.startsWith('assets/js/vendor/')) continue;
    const source = execFileSync('git', ['show', `${ref}:${filePath}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
    if (ENTRYPOINTS.includes(filePath)) {
      for (const inlineScript of extractInlineScripts(source, filePath)) {
        const inventory = scanJavaScriptSource({
          filePath: inlineScript.filePath,
          source: inlineScript.source,
          sourceType: inlineScript.sourceType
        });
        controls.push(...inventory.approved.filter((occurrence) => occurrence.kind === kind));
      }
      continue;
    }
    if (!/\.(?:js|mjs)$/u.test(filePath)) continue;
    const inventory = scanJavaScriptSource({ filePath, source });
    controls.push(...inventory.approved.filter((occurrence) => occurrence.kind === kind));
  }
  return sortOccurrences(controls);
}

function bootstrapControlsAtRef(ref) {
  return [
    ...reflectionControlsAtRef(ref),
    ...approvedControlsAtRef(ref, 'computed-property-control'),
    ...approvedControlsAtRef(ref, 'timer-callback-alias-control')
  ];
}

function resolveCommit(ref, label) {
  const commit = gitText(['rev-parse', '--verify', `${ref}^{commit}`]);
  assert(/^[0-9a-f]{40}$/u.test(commit), `${label} must resolve to an exact commit`);
  return commit;
}

function comparisonBase() {
  const baseRef = String(process.env.CODE_QUALITY_BASE_REF || '').trim();
  const declaredHead = String(process.env.CODE_QUALITY_HEAD_SHA || '').trim();
  assert(!declaredHead || baseRef, 'CODE_QUALITY_HEAD_SHA requires CODE_QUALITY_BASE_REF');
  if (!baseRef) return null;
  const checkout = resolveCommit('HEAD', 'checkout HEAD');
  const head = declaredHead ? resolveCommit(declaredHead, 'CODE_QUALITY_HEAD_SHA') : checkout;
  assert(checkout === head, `checked out HEAD ${checkout} does not match declared quality head ${head}`);
  const baseTip = resolveCommit(baseRef, 'CODE_QUALITY_BASE_REF');
  return resolveCommit(gitText(['merge-base', baseTip, head]), 'HTML sink merge base');
}

function policyAtRef(ref) {
  const result = spawnSync('git', ['show', `${ref}:scripts/html-sink-policy.json`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status === 0) return JSON.parse(result.stdout);
  const message = String(result.stderr || result.stdout || '').trim();
  if (/does not exist in|exists on disk, but not in|path .* does not exist/u.test(message)) return null;
  fail(`cannot read merge-base HTML sink policy: ${message || `git exited ${result.status}`}`);
}

export function dispositionHash(entry) {
  return createHash('sha256')
    .update(
      JSON.stringify([occurrenceKey(entry), entry.fingerprint, entry.evidence, entry.classification, entry.rationale])
    )
    .digest('hex');
}

function countByKey(occurrences) {
  const counts = new Map();
  for (const occurrence of occurrences) {
    const key = inventoryKey(occurrence);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function inventoryCounts(inventory) {
  return {
    computedPropertyControls: inventory.approved.filter(({ kind }) => kind === 'computed-property-control').length,
    dynamicImports: inventory.approved.filter(({ kind }) => kind === 'dynamic-import').length,
    innerHTMLEmptyWrites: inventory.approved.filter(({ kind, empty }) => kind === 'innerHTML-write' && empty).length,
    innerHTMLWrites: inventory.approved.filter(({ kind }) => kind === 'innerHTML-write').length,
    insertAdjacentHTML: inventory.approved.filter(({ kind }) => kind === 'insertAdjacentHTML').length,
    prohibited: inventory.prohibited.length,
    reflectionControls: inventory.approved.filter(({ kind }) => kind === 'reflection-control').length,
    serializerReads: inventory.approved.filter(({ kind }) => kind === 'serializer-read').length,
    timerCallbackControls: inventory.approved.filter(
      ({ kind }) => kind === 'timer-callback-control' || kind === 'timer-callback-alias-control'
    ).length
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
    assert(typeof entry.owner === 'string' && entry.owner, `approved[${index}] must record an owner`);
    assert(typeof entry.context === 'string' && entry.context, `approved[${index}] must record owner context`);
    assert(/^[a-f0-9]{64}$/u.test(entry.fingerprint), `approved[${index}] must record a SHA-256 fingerprint`);
    assert(
      /^[a-f0-9]{64}$/u.test(entry.semanticFingerprint),
      `approved[${index}] must record a semantic SHA-256 fingerprint`
    );
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
    } else if (entry.kind === 'reflection-control') {
      const approval = reflectionControlApproval(entry);
      assert(
        approval &&
          entry.classification === 'reviewed-non-dom-reflection' &&
          entry.targetContract === approval.targetContract &&
          entry.rationale === approval.rationale,
        `approved[${index}] reflection control must match its reviewed non-DOM target contract`
      );
    } else if (entry.kind === 'computed-property-control') {
      assert(
        entry.classification === 'reviewed-computed-property-control' &&
          ['html-assignment-unproven-property', 'html-call-unproven-property'].includes(entry.operation),
        `approved[${index}] computed property control must retain its explicit uncertainty operation`
      );
    } else if (entry.kind === 'timer-callback-control' || entry.kind === 'timer-callback-alias-control') {
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
    const legacyKey = legacyOccurrenceKey(entry);
    const legacyQueue = queues.get(legacyKey) || [];
    legacyQueue.push({
      classification: entry.classification,
      rationale: entry.rationale
    });
    queues.set(legacyKey, legacyQueue);
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
  if (occurrence.kind === 'reflection-control') {
    const approval = reflectionControlApproval(occurrence);
    assert(approval, `unreviewed reflection control cannot enter the baseline: ${formatOccurrence(occurrence)}`);
    return {
      ...occurrence,
      classification: 'reviewed-non-dom-reflection',
      rationale: approval.rationale
    };
  }
  if (occurrence.kind === 'computed-property-control') {
    return {
      ...occurrence,
      classification: 'reviewed-computed-property-control',
      rationale:
        'This existing dynamic property operation is retained as exact uncertainty debt; any new identity is blocked and the inventory may only shrink.'
    };
  }
  if (occurrence.kind === 'timer-callback-control' || occurrence.kind === 'timer-callback-alias-control') {
    return {
      ...occurrence,
      classification: 'reviewed-callback-control'
    };
  }
  const queue = queues.get(occurrenceKey(occurrence)) || queues.get(legacyOccurrenceKey(occurrence)) || [];
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
  const base = comparisonBase();
  if (base) errors.push(...verifyPolicyTransition(policyAtRef(base), policy, bootstrapControlsAtRef(base)));
  if (errors.length > 0) fail(`HTML sink policy failed:\n- ${errors.join('\n- ')}`);
  const counts = inventoryCounts(inventory);
  console.log(
    `HTML sink policy passed: ${counts.computedPropertyControls} computed-property controls, ` +
      `${counts.innerHTMLWrites} innerHTML writes (${counts.innerHTMLEmptyWrites} empty), ` +
      `${counts.insertAdjacentHTML} insertAdjacentHTML, ${counts.serializerReads} serializer reads, ` +
      `${counts.dynamicImports} dynamic imports, ${counts.timerCallbackControls} reviewed timer callbacks, ` +
      `${counts.reflectionControls} reviewed non-DOM reflection controls, ` +
      `${counts.prohibited} prohibited sinks.`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
