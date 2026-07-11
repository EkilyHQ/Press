import { parse } from './vendor/acorn.mjs';
import { fullAncestor } from './vendor/acorn-walk.mjs';
import { containsForbiddenV4HtmlRouteConstruction, isV4HtmlRouteGuardSource } from './theme-route-guard-html.js';

const ROUTE_KEYS = new Set(['tab', 'id']);
const URL_MUTATORS = new Set(['set', 'append', 'delete']);
const ROUTE_HREF_ATTRIBUTES = new Set(['href', 'src', 'srcset', 'action', 'formaction']);
const FACT_KINDS = [
  'route',
  'external',
  'factories',
  'routeQueryFactories',
  'urlConstructors',
  'urlSearchParamsConstructors'
];

function safeString(value) {
  return value == null ? '' : String(value);
}

function normalizeBrowserUrlString(value) {
  return safeString(value).replace(/[\t\n\r]/g, '');
}

function normalizeRouteGuardContext(contextSource, fallbackSource = '', fallbackPath = '') {
  if (contextSource && typeof contextSource === 'object' && Array.isArray(contextSource.files)) {
    const files = contextSource.files.map((file) => ({
      path: safeString(file && file.path).replace(/\\+/g, '/'),
      source: safeString(file && file.source)
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

function inlineRouteGuardPath(contextPath) {
  const normalized = safeString(contextPath).replace(/\\+/g, '/');
  const separator = normalized.lastIndexOf('/');
  const directory = separator >= 0 ? normalized.slice(0, separator + 1) : '';
  return `${directory}__press-inline-route-code.js`;
}

function parseRouteGuardAst(source) {
  const text = safeString(source);
  const options = {
    ecmaVersion: 'latest',
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    allowHashBang: true,
    locations: false,
    ranges: false
  };
  try {
    return parse(text, { ...options, sourceType: 'module' });
  } catch (_) {
    try {
      return parse(text, { ...options, sourceType: 'script' });
    } catch (err) {
      try {
        return parse(`function __pressRouteGuardWrapper(){\n${text}\n}`, { ...options, sourceType: 'script' });
      } catch (_) {
        return null;
      }
    }
  }
}

function walk(ast, callback) {
  if (!ast) return;
  fullAncestor(ast, (node, ancestors) => callback(node, ancestors || []));
}

function unwrap(node) {
  let value = node;
  while (
    value &&
    (value.type === 'ChainExpression' ||
      value.type === 'ParenthesizedExpression' ||
      value.type === 'TSNonNullExpression')
  ) {
    value = value.expression;
  }
  return value;
}

function decodeRouteKey(value) {
  const text = safeString(value).trim();
  try {
    return decodeURIComponent(text);
  } catch (_) {
    return text;
  }
}

function isRouteKey(value) {
  return ROUTE_KEYS.has(decodeRouteKey(value));
}

function isExternalUrlPrefix(value) {
  const text = normalizeBrowserUrlString(value).trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith('//');
}

function literalStringValue(node) {
  const value = unwrap(node);
  if (!value) return null;
  if (value.type === 'Literal' && typeof value.value === 'string') return value.value;
  if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
    return value.quasis.map((part) => part.value.cooked ?? part.value.raw ?? '').join('');
  }
  if (value.type === 'BinaryExpression' && value.operator === '+') {
    const left = literalStringValue(value.left);
    const right = literalStringValue(value.right);
    return left != null && right != null ? `${left}${right}` : null;
  }
  return null;
}

function propertyName(node) {
  const value = unwrap(node);
  if (!value) return '';
  if (value.type === 'Identifier') return value.name;
  if (value.type === 'PrivateIdentifier') return value.name;
  const literal = literalStringValue(value);
  return literal == null ? '' : literal;
}

function bindingStringAt(name, state, ancestors, index) {
  if (!name || !state || !state.bindings) return null;
  const root = name.split(/[.\[]/, 1)[0];
  if (root !== name && bindingKindAt(root, state, ancestors, index) === 'unknown') return null;
  if (root === name && paramBindingKind(name, ancestors)) return null;
  const winner = bindingAt(name, state, index);
  return winner && winner.stringValue != null ? winner.stringValue : null;
}

function bindingAt(name, state, index) {
  if (!name || !state || !state.bindings) return null;
  const rank = (binding) => {
    if (!binding) return -1;
    if (binding.kind && binding.kind !== 'unknown') return 2;
    return binding.stringValue != null ? 1 : 0;
  };
  let winner = null;
  state.bindings.forEach((binding) => {
    if (
      binding.name === name &&
      binding.start <= index &&
      (binding.end == null || index <= binding.end) &&
      (!winner || binding.start > winner.start || (binding.start === winner.start && rank(binding) >= rank(winner)))
    )
      winner = binding;
  });
  return winner;
}

function expressionStringValue(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return null;
  const literal = literalStringValue(value);
  if (literal != null) return literal;
  if (value.type === 'Identifier') return bindingStringAt(value.name, state, ancestors, value.start);
  const path = memberPathResolved(value, state, ancestors) || memberPath(value);
  return path ? bindingStringAt(path, state, ancestors, value.start) : null;
}

function memberPropertyName(node, state, ancestors) {
  const value = unwrap(node);
  if (!value || value.type !== 'MemberExpression') return '';
  if (value.computed) return expressionStringValue(value.property, state, ancestors) || propertyName(value.property);
  return propertyName(value.property);
}

function objectPropertyName(prop, state, ancestors) {
  if (!prop || prop.type !== 'Property') return '';
  return prop.computed
    ? expressionStringValue(prop.key, state, ancestors) || propertyName(prop.key)
    : propertyName(prop.key);
}

function memberPath(node) {
  const value = unwrap(node);
  if (!value) return '';
  if (value.type === 'Identifier') return value.name;
  if (value.type === 'ThisExpression') return 'this';
  if (value.type !== 'MemberExpression') return '';
  const root = memberPath(value.object);
  const prop = propertyName(value.property);
  if (!root || !prop) return '';
  return /^[A-Za-z_$][\w$]*$/.test(prop) ? `${root}.${prop}` : `${root}[${JSON.stringify(prop)}]`;
}

function memberPathResolved(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return '';
  if (value.type === 'Identifier') return value.name;
  if (value.type === 'ThisExpression') return 'this';
  if (value.type !== 'MemberExpression') return '';
  const root = memberPathResolved(value.object, state, ancestors);
  const prop = memberPropertyName(value, state, ancestors);
  if (!root || !prop) return '';
  return /^[A-Za-z_$][\w$]*$/.test(prop) ? `${root}.${prop}` : `${root}[${JSON.stringify(prop)}]`;
}

function memberPathSuffix(pathValue, owner) {
  if (!pathValue || !owner) return '';
  if (pathValue === owner) return '';
  const dot = `${owner}.`;
  const bracket = `${owner}[`;
  if (pathValue.startsWith(dot) || pathValue.startsWith(bracket)) return pathValue.slice(owner.length);
  return '';
}

function joinMemberPath(owner, suffix) {
  if (!owner) return '';
  return suffix ? `${owner}${suffix}` : owner;
}

function stringHasRouteQueryLiteral(value) {
  if (value == null) return false;
  const text = normalizeBrowserUrlString(value);
  const re = /[?&]([^=&#\s]+)\s*=/g;
  let match = re.exec(text);
  while (match) {
    if (isRouteKey(match[1]) && !isExternalUrlPrefix(text.slice(0, match.index))) return true;
    match = re.exec(text);
  }
  return false;
}

function stringHasRoutePairLiteral(value) {
  if (value == null) return false;
  const text = normalizeBrowserUrlString(value);
  const match = text.trimStart().match(/^([^=&#\s]+)\s*=/u);
  return Boolean(match && isRouteKey(match[1]) && !isExternalUrlPrefix(text));
}

function expressionHasRouteQueryLiteral(node) {
  return stringHasRouteQueryLiteral(literalStringValue(node));
}

function expressionHasRoutePairLiteral(node) {
  return stringHasRoutePairLiteral(literalStringValue(node));
}

function expressionStaticKind(node) {
  const value = literalStringValue(node);
  if (value == null) return '';
  if (isRouteKey(value)) return 'route';
  if (isExternalUrlPrefix(value)) return 'external';
  return '';
}

function addExpressionAliases(
  out,
  name,
  node,
  constructorAliases = new Set(),
  searchParamsConstructorAliases = new Set()
) {
  if (!name || !node) return;
  const value = unwrap(node);
  const kind = expressionStaticKind(value);
  if (kind === 'route') out.route.add(name);
  if (kind === 'external') out.external.add(name);
  const ctorKind = constructorKind(
    value,
    {
      urlConstructorAliases: constructorAliases,
      urlSearchParamsConstructorAliases: searchParamsConstructorAliases,
      bindings: [],
      allowUnboundAliases: true
    },
    []
  );
  if (ctorKind === 'url') out.urlConstructors.add(name);
  if (ctorKind === 'urlSearchParams') out.urlSearchParamsConstructors.add(name);
  if (newUrlHasStaticExternalArg(value, constructorAliases)) out.external.add(name);
  if (value && value.type === 'ObjectExpression') {
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = propertyName(prop.key);
      if (!key) return;
      addExpressionAliases(
        out,
        /^[A-Za-z_$][\w$]*$/.test(key) ? `${name}.${key}` : `${name}[${JSON.stringify(key)}]`,
        prop.value,
        constructorAliases,
        searchParamsConstructorAliases
      );
    });
  }
}

function addObjectMemberAliases(out, node, constructorAliases = new Set(), searchParamsConstructorAliases = new Set()) {
  const value = unwrap(node);
  if (!value || value.type !== 'ObjectExpression') return;
  value.properties.forEach((prop) => {
    if (!prop || prop.type !== 'Property') return;
    const key = propertyName(prop.key);
    if (!key) return;
    addExpressionAliases(out, key, prop.value, constructorAliases, searchParamsConstructorAliases);
  });
}

function bindingsForFacts(facts = {}) {
  const out = [];
  const add = (aliases, kind) => {
    (aliases || new Set()).forEach((name) => out.push({ name, kind, start: 0, end: Infinity }));
  };
  add(facts.route, 'route');
  add(facts.external, 'external');
  add(facts.factories, 'routeFactory');
  add(facts.routeQueryFactories, 'routeQueryFactory');
  add(facts.urlConstructors, 'urlConstructor');
  add(facts.urlSearchParamsConstructors, 'urlSearchParamsConstructor');
  return out;
}

function functionReturnsRelativeUrl(node, localFacts = null) {
  const value = unwrap(node);
  if (!value || !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(value.type))
    return false;
  const functionStart = value.body && value.body.start != null ? value.body.start : value.start || 0;
  const functionEnd = value.end == null ? Infinity : value.end;
  const minimalState = {
    routeUrlAliases: new Set(),
    routeFactories: new Set(localFacts ? localFacts.factories || localFacts.routeFactories || [] : []),
    routeFactoryArgAliases: new Set(localFacts ? (localFacts.routeFactoryArgs || new Map()).keys() : []),
    routeFactoryArgIndexes: new Map(localFacts ? localFacts.routeFactoryArgs || [] : []),
    externalAliases: new Set(localFacts ? localFacts.external || localFacts.externalAliases || [] : []),
    routeKeyAliases: new Set(),
    urlConstructorAliases: localFacts ? localFacts.urlConstructors || new Set() : new Set(),
    urlSearchParamsConstructorAliases: localFacts ? localFacts.urlSearchParamsConstructors || new Set() : new Set(),
    allowUnboundAliases: Boolean(localFacts && localFacts.allowUnboundAliases),
    bindings: [...((localFacts && localFacts.bindings) || [])]
  };
  (localFacts ? localFacts.routeFactoryArgs || new Map() : new Map()).forEach((_, name) => {
    minimalState.bindings.push({ name, kind: 'routeFactoryByArg', start: 0, end: Infinity });
  });
  (value.params || []).forEach((param) => {
    bindingNames(param).forEach((name) => {
      minimalState.bindings.push({ name, kind: 'unknown', start: functionStart, end: functionEnd });
    });
  });
  const isInsideNestedFunction = (child, ancestors) =>
    ancestors.some((ancestor) => ancestor !== value && ancestor !== child && isFunctionNode(ancestor));
  const addBinding = (name, kind, start, end, stringValue = null) => {
    if (!name) return;
    minimalState.bindings.push({ name, kind: kind || 'unknown', stringValue, start, end });
  };
  const expressionBindingKind = (expression, ancestors) => {
    const stringValue = literalStringValue(expression);
    if (isExternalUrlPrefix(stringValue)) return 'external';
    if (expressionIsRelativeUrl(expression, minimalState, ancestors)) return 'routeUrl';
    if (functionReturnsRelativeUrl(expression, minimalState)) return 'routeFactory';
    return 'unknown';
  };
  const addConcretePatternBindings = (pattern, init, start, end, ancestors) => {
    const patternValue = unwrap(pattern);
    const initValue = unwrap(init);
    if (!patternValue) return;
    if (patternValue.type === 'Identifier') {
      addBinding(
        patternValue.name,
        expressionBindingKind(initValue, ancestors),
        start,
        end,
        literalStringValue(initValue)
      );
      return;
    }
    if (patternValue.type === 'AssignmentPattern') {
      addConcretePatternBindings(patternValue.left, initValue || patternValue.right, start, end, ancestors);
      return;
    }
    if (patternValue.type === 'ArrayPattern') {
      patternValue.elements.forEach((item, index) => {
        const source = initValue && initValue.type === 'ArrayExpression' ? initValue.elements[index] : null;
        addConcretePatternBindings(item, source, start, end, ancestors);
      });
      return;
    }
    if (patternValue.type === 'ObjectPattern') {
      patternValue.properties.forEach((prop) => {
        if (!prop) return;
        if (prop.type === 'RestElement') {
          addConcretePatternBindings(prop.argument, null, start, end, ancestors);
          return;
        }
        let source = null;
        if (initValue && initValue.type === 'ObjectExpression') {
          const key = propertyName(prop.key);
          const sourceProp = initValue.properties.find(
            (candidate) => candidate && candidate.type === 'Property' && propertyName(candidate.key) === key
          );
          source = sourceProp ? sourceProp.value : null;
        }
        addConcretePatternBindings(prop.value, source, start, end, ancestors);
      });
    }
  };
  walk(value, (child, ancestors) => {
    if (!child || isInsideNestedFunction(child, ancestors)) return;
    if (child.type === 'CatchClause' && child.param) {
      const start = child.body && child.body.start != null ? child.body.start : child.start;
      const end = child.body && child.body.end != null ? child.body.end : child.end;
      bindingNames(child.param).forEach((name) => addBinding(name, 'unknown', start, end));
      return;
    }
    if (child !== value && child.type === 'FunctionDeclaration' && child.id && child.id.name) {
      addBinding(
        child.id.name,
        functionReturnsRelativeUrl(child, minimalState) ? 'routeFactory' : 'unknown',
        functionStart,
        functionEnd
      );
      return;
    }
    if (child.type !== 'VariableDeclarator') return;
    const declaration = ancestors
      .slice()
      .reverse()
      .find((candidate) => candidate && candidate.type === 'VariableDeclaration');
    const blockScope = nearestBindingScope(ancestors);
    const scopeStart = declaration && declaration.kind === 'var' ? functionStart : blockScope.start;
    const scopeEnd = declaration && declaration.kind === 'var' ? functionEnd : blockScope.end;
    bindingNames(child.id).forEach((name) => addBinding(name, 'unknown', scopeStart, scopeEnd));
    addConcretePatternBindings(child.id, child.init, child.start, scopeEnd, ancestors);
  });
  if (value.type === 'ArrowFunctionExpression' && value.body && value.body.type !== 'BlockStatement') {
    return expressionIsRelativeUrl(value.body, minimalState, [value]);
  }
  let found = false;
  walk(value.body, (child, ancestors) => {
    if (found || !child || child.type !== 'ReturnStatement' || !child.argument) return;
    if (isInsideNestedFunction(child, ancestors)) return;
    if (expressionIsRelativeUrl(child.argument, minimalState, ancestors)) {
      found = true;
    }
  });
  return found;
}

function functionRelativeUrlParamIndexes(node, localFacts = null) {
  const value = unwrap(node);
  const out = new Set();
  if (!isFunctionNode(value)) return out;
  const params = new Map();
  (value.params || []).forEach((param, index) => {
    const paramValue = unwrap(param);
    if (paramValue && paramValue.type === 'Identifier') params.set(paramValue.name, index);
  });
  if (!params.size) return out;
  const state = {
    urlConstructorAliases: new Set(
      localFacts ? localFacts.urlConstructors || localFacts.urlConstructorAliases || [] : []
    ),
    urlSearchParamsConstructorAliases: new Set(),
    bindings: [...((localFacts && localFacts.bindings) || [])],
    allowUnboundAliases: Boolean(localFacts && localFacts.allowUnboundAliases)
  };
  const isInsideNestedFunction = (child, ancestors) =>
    ancestors.some((ancestor) => ancestor !== value && ancestor !== child && isFunctionNode(ancestor));
  const inspect = (expression, ancestors) => {
    const result = unwrap(expression && expression.type === 'AwaitExpression' ? expression.argument : expression);
    if (!result) return;
    if (result.type === 'Identifier' && params.has(result.name)) {
      out.add(params.get(result.name));
      return;
    }
    if (result.type !== 'NewExpression' || !calleeIsUrlConstructor(result.callee, state, ancestors)) return;
    const args = result.arguments || [];
    args.forEach((arg, index) => {
      const argValue = unwrap(arg);
      if (!argValue || argValue.type !== 'Identifier' || !params.has(argValue.name)) return;
      const other = index === 0 ? args[1] : args[0];
      const staticOther = literalStringValue(other);
      if (args.length === 1 || (staticOther != null && !isExternalUrlPrefix(staticOther)))
        out.add(params.get(argValue.name));
    });
  };
  if (value.type === 'ArrowFunctionExpression' && value.body && value.body.type !== 'BlockStatement')
    inspect(value.body, [value]);
  if (value.body) {
    walk(value.body, (child, ancestors) => {
      if (!child || child.type !== 'ReturnStatement' || !child.argument || isInsideNestedFunction(child, ancestors))
        return;
      inspect(child.argument, ancestors);
    });
  }
  return out;
}

function functionReturnsRouteQuery(node, localFacts = null) {
  const value = unwrap(node);
  if (!value || !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(value.type))
    return false;
  const paramBindings = [];
  (value.params || []).forEach((param) => {
    bindingNames(param).forEach((name) => {
      paramBindings.push({
        name,
        kind: 'unknown',
        start: value.start || 0,
        end: value.end == null ? Infinity : value.end
      });
    });
  });
  const minimalState = {
    routeKeyAliases: new Set(localFacts ? localFacts.route || localFacts.routeKeyAliases || [] : []),
    externalAliases: new Set(localFacts ? localFacts.external || localFacts.externalAliases || [] : []),
    routeFactories: new Set(localFacts ? localFacts.factories || localFacts.routeFactories || [] : []),
    routeQueryFactories: new Set(localFacts ? localFacts.routeQueryFactories || [] : []),
    routeUrlAliases: new Set(),
    searchParamsAliases: new Set(),
    routeQueryAliases: new Set(),
    urlSearchParamsAliases: new Set(),
    urlConstructorAliases: new Set(
      localFacts ? localFacts.urlConstructors || localFacts.urlConstructorAliases || [] : []
    ),
    urlSearchParamsConstructorAliases: new Set(
      localFacts ? localFacts.urlSearchParamsConstructors || localFacts.urlSearchParamsConstructorAliases || [] : []
    ),
    boundSearchParamsMutatorAliases: new Set(),
    routeUrlMutatorAliases: new Set(),
    routeUrlMutatorArgIndexes: new Map(),
    allowUnboundAliases: Boolean(localFacts && localFacts.allowUnboundAliases),
    bindings: [...((localFacts && localFacts.bindings) || []), ...paramBindings]
  };
  const addLocalStringMemberBindings = (root, node, start, end) => {
    const objectValue = unwrap(node);
    if (!root || !objectValue || objectValue.type !== 'ObjectExpression') return;
    objectValue.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = objectPropertyName(prop, minimalState, []);
      if (!key) return;
      const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      const stringValue = literalStringValue(prop.value);
      if (stringValue != null) minimalState.bindings.push({ name: path, kind: 'unknown', stringValue, start, end });
      addLocalStringMemberBindings(path, prop.value, start, end);
    });
  };
  const isInsideNestedFunction = (child, ancestors) =>
    ancestors.some((ancestor) => ancestor !== value && ancestor !== child && isFunctionNode(ancestor));
  const addLocalBinding = (name, kind, node, ancestors, stringValue = null, hoisted = false) => {
    if (!name) return;
    const scope = nearestBindingScope(ancestors);
    const startNode = unwrap(node);
    minimalState.bindings.push({
      name,
      kind: kind || 'unknown',
      stringValue,
      start: hoisted ? scope.start : startNode && startNode.start != null ? startNode.start : 0,
      end: scope.end
    });
  };
  collectStringAliases(value, minimalState);
  walk(value, (child, ancestors) => {
    if (!child || isInsideNestedFunction(child, ancestors)) return;
    if (child !== value && child.type === 'FunctionDeclaration' && child.id && child.id.name) {
      addLocalBinding(
        child.id.name,
        functionReturnsRouteQuery(child, minimalState) ? 'routeQueryFactory' : 'unknown',
        child.id,
        ancestors,
        null,
        true
      );
      return;
    }
    if (child.type !== 'VariableDeclarator') return;
    const scope = nearestBindingScope(ancestors);
    bindingNames(child.id).forEach((name) => {
      const stringValue = literalStringValue(child.init);
      const kind =
        functionReturnsRouteQuery(child.init, minimalState) ||
        expressionIsRouteQueryFactory(child.init, minimalState, ancestors)
          ? 'routeQueryFactory'
          : 'unknown';
      addLocalBinding(name, kind, child, ancestors, stringValue);
    });
    if (child.id.type === 'Identifier') addLocalStringMemberBindings(child.id.name, child.init, child.start, scope.end);
  });
  collectRouteQueryAliases(value, minimalState);
  if (value.type === 'ArrowFunctionExpression' && value.body && value.body.type !== 'BlockStatement') {
    return expressionIsRouteQuery(value.body, minimalState, [value]);
  }
  let found = false;
  walk(value, (child, ancestors) => {
    if (found || !child || child.type !== 'ReturnStatement' || !child.argument) return;
    if (isInsideNestedFunction(child, ancestors)) return;
    if (expressionIsRouteQuery(child.argument, minimalState, ancestors)) found = true;
  });
  return found;
}

function newUrlHasStaticExternalArg(node, constructorAliases = new Set()) {
  const value = unwrap(node);
  const state = {
    urlConstructorAliases: constructorAliases,
    urlSearchParamsConstructorAliases: new Set(),
    bindings: [],
    allowUnboundAliases: true
  };
  if (!value || value.type !== 'NewExpression' || !calleeIsUrlConstructor(value.callee, state, [])) return false;
  return (
    isExternalUrlPrefix(literalStringValue(value.arguments[0])) ||
    isExternalUrlPrefix(literalStringValue(value.arguments[1]))
  );
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

function createFacts() {
  return {
    route: new Set(),
    external: new Set(),
    factories: new Set(),
    routeQueryFactories: new Set(),
    urlConstructors: new Set(),
    urlSearchParamsConstructors: new Set(),
    routeFactoryArgs: new Map(),
    routeUrlMutators: new Map()
  };
}

function addRouteFactoryArgFact(out, name, indexes) {
  if (!out || !name || !indexes || !indexes.size) return;
  const existing = out.routeFactoryArgs.get(name) || new Set();
  indexes.forEach((index) => existing.add(index));
  out.routeFactoryArgs.set(name, existing);
}

function addRouteUrlMutatorFact(out, name, indexes) {
  if (!out || !name || !indexes || !indexes.size) return;
  const existing = out.routeUrlMutators.get(name) || new Set();
  indexes.forEach((index) => existing.add(index));
  out.routeUrlMutators.set(name, existing);
}

function addMappedAliases(out, sourceFacts, importedName, localName) {
  const imported = safeString(importedName);
  const local = safeString(localName);
  if (!imported || !local) return;
  FACT_KINDS.forEach((kind) => {
    sourceFacts[kind].forEach((alias) => {
      if (alias === imported) out[kind].add(local);
      const suffix = memberPathSuffix(alias, imported);
      if (suffix) out[kind].add(joinMemberPath(local, suffix));
    });
  });
  (sourceFacts.routeUrlMutators || new Map()).forEach((indexes, alias) => {
    if (alias === imported) addRouteUrlMutatorFact(out, local, indexes);
    const suffix = memberPathSuffix(alias, imported);
    if (suffix) addRouteUrlMutatorFact(out, joinMemberPath(local, suffix), indexes);
  });
  (sourceFacts.routeFactoryArgs || new Map()).forEach((indexes, alias) => {
    if (alias === imported) addRouteFactoryArgFact(out, local, indexes);
    const suffix = memberPathSuffix(alias, imported);
    if (suffix) addRouteFactoryArgFact(out, joinMemberPath(local, suffix), indexes);
  });
}

function mergeFacts(target, source) {
  FACT_KINDS.forEach((kind) => {
    source[kind].forEach((alias) => target[kind].add(alias));
  });
  (source.routeUrlMutators || new Map()).forEach((indexes, alias) => addRouteUrlMutatorFact(target, alias, indexes));
  (source.routeFactoryArgs || new Map()).forEach((indexes, alias) => addRouteFactoryArgFact(target, alias, indexes));
}

function collectLocalFacts(ast, baseFacts = null) {
  const facts = createFacts();
  facts.allowUnboundAliases = true;
  if (baseFacts && baseFacts.route) {
    baseFacts.route.forEach((alias) => facts.route.add(alias));
  }
  if (baseFacts && baseFacts.external) {
    baseFacts.external.forEach((alias) => facts.external.add(alias));
  }
  if (baseFacts && baseFacts.factories) {
    baseFacts.factories.forEach((alias) => facts.factories.add(alias));
  }
  if (baseFacts && baseFacts.routeQueryFactories) {
    baseFacts.routeQueryFactories.forEach((alias) => facts.routeQueryFactories.add(alias));
  }
  if (baseFacts && baseFacts.urlConstructors) {
    baseFacts.urlConstructors.forEach((alias) => facts.urlConstructors.add(alias));
  }
  if (baseFacts && baseFacts.urlSearchParamsConstructors) {
    baseFacts.urlSearchParamsConstructors.forEach((alias) => facts.urlSearchParamsConstructors.add(alias));
  }
  const factState = {
    routeKeyAliases: facts.route,
    externalAliases: facts.external,
    routeFactories: facts.factories,
    routeFactoryArgAliases: new Set(),
    routeFactoryArgIndexes: facts.routeFactoryArgs,
    routeQueryFactories: facts.routeQueryFactories,
    routeUrlAliases: new Set(),
    searchParamsAliases: new Set(),
    routeQueryAliases: new Set(),
    urlSearchParamsAliases: new Set(),
    urlConstructorAliases: facts.urlConstructors,
    urlSearchParamsConstructorAliases: facts.urlSearchParamsConstructors,
    boundSearchParamsMutatorAliases: new Set(),
    routeUrlMutatorAliases: new Set(),
    routeUrlMutatorArgIndexes: new Map(),
    allowUnboundAliases: true,
    bindings: []
  };
  const addFactBinding = (name, kind, node, ancestors, stringValue = null) => {
    if (!name || !kind) return;
    const scope = nearestBindingScope(ancestors);
    const value = unwrap(node);
    factState.bindings.push({
      name,
      kind,
      stringValue,
      start: value && value.start != null ? value.start : 0,
      end: scope.end
    });
  };
  const addStringFact = (path, node, ancestors) => {
    const stringValue = literalStringValue(node);
    if (!path || stringValue == null) return;
    addFactBinding(path, 'unknown', node, ancestors, stringValue);
  };
  const addObjectFacts = (root, node, ancestors, clear = false) => {
    const value = unwrap(node);
    if (!root || !value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = objectPropertyName(prop, factState, ancestors);
      if (!key) return;
      const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      if (clear) clearFactPath(path);
      addStringFact(path, prop.value, ancestors);
      addTopLevelExpressionFacts(path, prop.value);
      addConstructorFact(path, constructorKind(prop.value, factState, ancestors), prop.value, ancestors);
      addRouteUrlMutatorLocalFact(
        path,
        functionRouteUrlMutationParamIndexes(prop.value, factState),
        prop.value,
        ancestors
      );
      addRouteQueryFactoryLocalFact(path, prop.value, ancestors);
      addRouteQueryFactoryAliasLocalFact(path, prop.value, ancestors);
      addObjectFacts(path, prop.value, ancestors, clear);
    });
  };
  const addConstructorFact = (path, kind, node, ancestors) => {
    if (!path || !kind) return;
    if (kind === 'url') facts.urlConstructors.add(path);
    if (kind === 'urlSearchParams') facts.urlSearchParamsConstructors.add(path);
    addFactBinding(path, kind === 'url' ? 'urlConstructor' : 'urlSearchParamsConstructor', node, ancestors);
  };
  const addRouteUrlMutatorLocalFact = (path, indexes, node, ancestors) => {
    addRouteUrlMutatorFact(facts, path, indexes);
    if (path && indexes && indexes.size) addFactBinding(path, 'routeUrlMutator', node, ancestors);
  };
  const addRouteQueryFactoryLocalFact = (path, node, ancestors) => {
    if (!path || !functionReturnsRouteQuery(node, factState)) return;
    facts.routeQueryFactories.add(path);
    addFactBinding(path, 'routeQueryFactory', node, ancestors);
  };
  const addRouteQueryFactoryAliasLocalFact = (path, node, ancestors) => {
    if (!path || !expressionIsRouteQueryFactory(node, factState, ancestors)) return;
    facts.routeQueryFactories.add(path);
    addFactBinding(path, 'routeQueryFactory', node, ancestors);
  };
  const addObjectRouteUrlMutatorLocalFacts = (root, node, ancestors, clear = false) => {
    const value = unwrap(node);
    if (!root || !value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = objectPropertyName(prop, factState, ancestors);
      if (!key) return;
      const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      if (clear) clearFactPath(path);
      addRouteUrlMutatorLocalFact(
        path,
        functionRouteUrlMutationParamIndexes(prop.value, factState),
        prop.value,
        ancestors
      );
      addObjectRouteUrlMutatorLocalFacts(path, prop.value, ancestors, clear);
    });
  };
  const addTopLevelExpressionFacts = (name, node) => {
    addExpressionAliases(facts, name, node, facts.urlConstructors, facts.urlSearchParamsConstructors);
  };
  const clearFactPath = (path) => {
    if (!path) return;
    FACT_KINDS.forEach((kind) => {
      Array.from(facts[kind]).forEach((alias) => {
        if (alias === path || memberPathSuffix(alias, path)) facts[kind].delete(alias);
      });
    });
    Array.from(facts.routeUrlMutators.keys()).forEach((alias) => {
      if (alias === path || memberPathSuffix(alias, path)) facts.routeUrlMutators.delete(alias);
    });
    Array.from(facts.routeFactoryArgs.keys()).forEach((alias) => {
      if (alias === path || memberPathSuffix(alias, path)) facts.routeFactoryArgs.delete(alias);
    });
  };
  facts.bindings = factState.bindings;
  walk(ast, (node, ancestors) => {
    if (!node) return;
    const topLevel = isTopLevelFact(ancestors);
    if (node.type === 'VariableDeclarator') {
      const names = bindingNames(node.id);
      if (topLevel) {
        names.forEach((name) => {
          addStringFact(name, node.init, ancestors);
          addTopLevelExpressionFacts(name, node.init);
        });
        if (node.id.type === 'Identifier') {
          addObjectFacts(node.id.name, node.init, ancestors);
          addRouteUrlMutatorLocalFact(
            node.id.name,
            functionRouteUrlMutationParamIndexes(node.init, factState),
            node.id,
            ancestors
          );
          addRouteQueryFactoryLocalFact(node.id.name, node.init, ancestors);
          addRouteQueryFactoryAliasLocalFact(node.id.name, node.init, ancestors);
          addRouteFactoryArgFact(facts, node.id.name, functionRelativeUrlParamIndexes(node.init, factState));
        }
        const initPath = memberPathResolved(node.init, factState, ancestors) || memberPath(node.init);
        if (node.id.type === 'ObjectPattern' && ['window', 'globalThis'].includes(initPath)) {
          node.id.properties.forEach((prop) => {
            if (!prop || prop.type !== 'Property') return;
            const kind =
              objectPropertyName(prop, factState, ancestors) === 'URL'
                ? 'url'
                : objectPropertyName(prop, factState, ancestors) === 'URLSearchParams'
                  ? 'urlSearchParams'
                  : '';
            bindingNames(prop.value).forEach((name) => addConstructorFact(name, kind, prop.value, ancestors));
          });
        }
        if (names.length === 1 && functionReturnsRelativeUrl(node.init, facts)) facts.factories.add(names[0]);
      }
    }
    if (topLevel && node.type === 'AssignmentExpression') {
      const left = memberPathResolved(node.left, factState, ancestors) || memberPath(node.left);
      clearFactPath(left);
      addStringFact(left, node.right, ancestors);
      addObjectFacts(left, node.right, ancestors);
      addTopLevelExpressionFacts(left, node.right);
      addConstructorFact(left, constructorKind(node.right, factState, ancestors), node.left, ancestors);
      addRouteUrlMutatorLocalFact(
        left,
        functionRouteUrlMutationParamIndexes(node.right, factState),
        node.left,
        ancestors
      );
      addRouteQueryFactoryLocalFact(left, node.right, ancestors);
      addRouteQueryFactoryAliasLocalFact(left, node.right, ancestors);
    }
    if (topLevel && node.type === 'CallExpression') {
      const callee = memberPathResolved(node.callee, factState, ancestors) || memberPath(node.callee);
      if (callee === 'Object.assign') {
        const target = memberPathResolved(node.arguments[0], factState, ancestors) || memberPath(node.arguments[0]);
        (node.arguments || []).slice(1).forEach((source) => {
          addObjectFacts(target, source, ancestors, true);
          addObjectRouteUrlMutatorLocalFacts(target, source, ancestors, true);
        });
      }
      if (callee === 'Reflect.set') {
        const target = memberPathResolved(node.arguments[0], factState, ancestors) || memberPath(node.arguments[0]);
        const key = expressionStringValue(node.arguments[1], factState, ancestors);
        if (target && key) {
          const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${target}.${key}` : `${target}[${JSON.stringify(key)}]`;
          clearFactPath(path);
          addStringFact(path, node.arguments[2], ancestors);
          addTopLevelExpressionFacts(path, node.arguments[2]);
          addConstructorFact(
            path,
            constructorKind(node.arguments[2], factState, ancestors),
            node.arguments[2],
            ancestors
          );
          addRouteUrlMutatorLocalFact(
            path,
            functionRouteUrlMutationParamIndexes(node.arguments[2], factState),
            node.arguments[2],
            ancestors
          );
          addRouteQueryFactoryLocalFact(path, node.arguments[2], ancestors);
          addRouteQueryFactoryAliasLocalFact(path, node.arguments[2], ancestors);
        }
      }
    }
    if (topLevel && node.type === 'FunctionDeclaration' && node.id && functionReturnsRelativeUrl(node, facts)) {
      facts.factories.add(node.id.name);
    }
    if (topLevel && node.type === 'FunctionDeclaration' && node.id && node.id.name) {
      addRouteUrlMutatorLocalFact(
        node.id.name,
        functionRouteUrlMutationParamIndexes(node, factState),
        node.id,
        ancestors
      );
      addRouteQueryFactoryLocalFact(node.id.name, node, ancestors);
      addRouteFactoryArgFact(facts, node.id.name, functionRelativeUrlParamIndexes(node, factState));
    }
    if (topLevel && node.type === 'Property' && node.value && functionReturnsRelativeUrl(node.value, facts)) {
      const parent = ancestors[ancestors.length - 2];
      const key = propertyName(node.key);
      if (parent && parent.type === 'ObjectExpression' && key) {
        const declarator = ancestors
          .slice()
          .reverse()
          .find((candidate) => candidate.type === 'VariableDeclarator');
        if (declarator && declarator.id && declarator.id.type === 'Identifier') {
          facts.factories.add(`${declarator.id.name}.${key}`);
        }
      }
      if (parent && parent.type === 'ObjectExpression' && key && functionReturnsRouteQuery(node.value, factState)) {
        const declarator = ancestors
          .slice()
          .reverse()
          .find((candidate) => candidate.type === 'VariableDeclarator');
        if (declarator && declarator.id && declarator.id.type === 'Identifier') {
          facts.routeQueryFactories.add(`${declarator.id.name}.${key}`);
        }
      }
    }
  });
  const preexistingFactoryFacts = new Set(facts.factories);
  const localFactoryState = {
    ...factState,
    routeFactories: new Set(facts.factories),
    routeFactoryArgAliases: new Set(facts.routeFactoryArgs.keys()),
    routeFactoryArgIndexes: new Map(facts.routeFactoryArgs),
    bindings: collectBindings(ast, facts)
  };
  collectRouteFactories(ast, localFactoryState);
  const programEnd = ast && ast.end != null ? ast.end : Infinity;
  localFactoryState.routeFactories.forEach((name) => {
    if (
      preexistingFactoryFacts.has(name) ||
      localFactoryState.bindings.some(
        (binding) => binding.name === name && binding.kind === 'routeFactory' && binding.end === programEnd
      )
    ) {
      facts.factories.add(name);
    }
  });
  return facts;
}

function isTopLevelFact(ancestors) {
  const parent = ancestors[ancestors.length - 2];
  const grandparent = ancestors[ancestors.length - 3];
  return Boolean(
    parent &&
    (parent.type === 'Program' ||
      parent.type === 'ExportNamedDeclaration' ||
      parent.type === 'ExportDefaultDeclaration' ||
      (parent.type === 'ExpressionStatement' && grandparent && grandparent.type === 'Program') ||
      (parent.type === 'VariableDeclaration' &&
        grandparent &&
        (grandparent.type === 'Program' || grandparent.type === 'ExportNamedDeclaration')))
  );
}

function collectExportedFacts(file, context, seen = new Set(), cache = new Map()) {
  const key = file.path;
  if (cache.has(key)) return cache.get(key);
  if (seen.has(key)) return createFacts();
  seen.add(key);
  const ast = parseRouteGuardAst(file.source);
  const importedFacts = collectImportedFacts(ast, file.path, context, seen, cache);
  const localFacts = collectLocalFacts(ast, importedFacts);
  const exportableFacts = createFacts();
  mergeFacts(exportableFacts, localFacts);
  mergeFacts(exportableFacts, importedFacts);
  exportableFacts.allowUnboundAliases = true;
  const out = createFacts();
  const addLocalExport = (localName, exportedName) => addMappedAliases(out, exportableFacts, localName, exportedName);
  const clearExportPath = (path) => {
    if (!path) return;
    FACT_KINDS.forEach((kind) => {
      Array.from(out[kind]).forEach((alias) => {
        if (alias === path || memberPathSuffix(alias, path)) out[kind].delete(alias);
      });
    });
    Array.from(out.routeUrlMutators.keys()).forEach((alias) => {
      if (alias === path || memberPathSuffix(alias, path)) out.routeUrlMutators.delete(alias);
    });
    Array.from(out.routeFactoryArgs.keys()).forEach((alias) => {
      if (alias === path || memberPathSuffix(alias, path)) out.routeFactoryArgs.delete(alias);
    });
  };
  const clearAllExportFacts = () => {
    FACT_KINDS.forEach((kind) => out[kind].clear());
    out.routeUrlMutators.clear();
    out.routeFactoryArgs.clear();
  };
  const addObjectMemberRouteUrlMutatorExports = (node, root = '') => {
    const value = unwrap(node);
    if (!value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = propertyName(prop.key);
      if (!key) return;
      const name = root ? `${root}.${key}` : key;
      addRouteUrlMutatorFact(out, name, functionRouteUrlMutationParamIndexes(prop.value, exportableFacts));
      addObjectMemberRouteUrlMutatorExports(prop.value, name);
    });
  };
  const addObjectMemberRouteQueryFactoryExports = (node, root = '') => {
    const value = unwrap(node);
    if (!value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = propertyName(prop.key);
      if (!key) return;
      const name = root ? `${root}.${key}` : key;
      if (
        functionReturnsRouteQuery(prop.value, exportableFacts) ||
        expressionIsRouteQueryFactory(prop.value, exportableFacts, [])
      )
        out.routeQueryFactories.add(name);
      addObjectMemberRouteQueryFactoryExports(prop.value, name);
    });
  };
  const addReExport = (specifier, importedName, exportedName) => {
    const targetPath = resolveImportPath(file.path, specifier);
    const target = targetPath ? context.files.find((entry) => entry.path === targetPath) : null;
    if (!target) return;
    const targetFacts = collectExportedFacts(target, context, seen, cache);
    addMappedAliases(out, targetFacts, importedName, exportedName);
  };
  if (ast) {
    (ast.body || []).forEach((node) => {
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          if (node.declaration.type === 'VariableDeclaration') {
            node.declaration.declarations.forEach((decl) => {
              bindingNames(decl.id).forEach((name) => addLocalExport(name, name));
            });
          } else if (node.declaration.id && node.declaration.id.name) {
            addLocalExport(node.declaration.id.name, node.declaration.id.name);
          }
        }
        (node.specifiers || []).forEach((spec) => {
          const local = spec.local ? propertyName(spec.local) : '';
          const exported = spec.exported ? propertyName(spec.exported) : local;
          if (!local || !exported) return;
          if (node.source) addReExport(node.source.value, local, exported);
          else addLocalExport(local, exported);
        });
      }
      if (node.type === 'ExportDefaultDeclaration') {
        addMappedAliases(out, exportableFacts, 'default', 'default');
        addExpressionAliases(
          out,
          'default',
          node.declaration,
          exportableFacts.urlConstructors,
          exportableFacts.urlSearchParamsConstructors
        );
        if (functionReturnsRelativeUrl(node.declaration, localFacts)) out.factories.add('default');
        if (
          functionReturnsRouteQuery(node.declaration, exportableFacts) ||
          expressionIsRouteQueryFactory(node.declaration, exportableFacts, [])
        )
          out.routeQueryFactories.add('default');
        addRouteUrlMutatorFact(out, 'default', functionRouteUrlMutationParamIndexes(node.declaration, localFacts));
        addRouteFactoryArgFact(out, 'default', functionRelativeUrlParamIndexes(node.declaration, localFacts));
        addObjectMemberRouteUrlMutatorExports(node.declaration, 'default');
        addObjectMemberRouteQueryFactoryExports(node.declaration, 'default');
        if (node.declaration && node.declaration.type === 'Identifier')
          addLocalExport(node.declaration.name, 'default');
      }
      if (node.type === 'ExportAllDeclaration') {
        const targetPath = resolveImportPath(file.path, node.source && node.source.value);
        const target = targetPath ? context.files.find((entry) => entry.path === targetPath) : null;
        if (!target) return;
        const targetFacts = collectExportedFacts(target, context, seen, cache);
        if (node.exported) {
          const exported = propertyName(node.exported);
          FACT_KINDS.forEach((kind) => {
            targetFacts[kind].forEach((alias) =>
              out[kind].add(joinMemberPath(exported, alias.startsWith('[') ? alias : `.${alias}`))
            );
          });
          (targetFacts.routeUrlMutators || new Map()).forEach((indexes, alias) => {
            addRouteUrlMutatorFact(out, joinMemberPath(exported, alias.startsWith('[') ? alias : `.${alias}`), indexes);
          });
          (targetFacts.routeFactoryArgs || new Map()).forEach((indexes, alias) => {
            addRouteFactoryArgFact(out, joinMemberPath(exported, alias.startsWith('[') ? alias : `.${alias}`), indexes);
          });
        } else {
          mergeFacts(out, targetFacts);
        }
      }
    });
    walk(ast, (node) => {
      if (node.type !== 'AssignmentExpression' || node.operator !== '=') return;
      const left = memberPath(node.left);
      if (left === 'module.exports' && isRequireCall(node.right)) {
        clearAllExportFacts();
        const targetPath = resolveImportPath(file.path, node.right.arguments[0].value);
        const target = targetPath ? context.files.find((entry) => entry.path === targetPath) : null;
        if (target) mergeFacts(out, collectExportedFacts(target, context, seen, cache));
        return;
      }
      if (left === 'module.exports') {
        clearAllExportFacts();
        addExpressionAliases(
          out,
          'default',
          node.right,
          exportableFacts.urlConstructors,
          exportableFacts.urlSearchParamsConstructors
        );
        addObjectMemberAliases(
          out,
          node.right,
          exportableFacts.urlConstructors,
          exportableFacts.urlSearchParamsConstructors
        );
        if (functionReturnsRelativeUrl(node.right, localFacts)) out.factories.add('default');
        if (
          functionReturnsRouteQuery(node.right, exportableFacts) ||
          expressionIsRouteQueryFactory(node.right, exportableFacts, [])
        )
          out.routeQueryFactories.add('default');
        addRouteUrlMutatorFact(out, 'default', functionRouteUrlMutationParamIndexes(node.right, localFacts));
        addRouteFactoryArgFact(out, 'default', functionRelativeUrlParamIndexes(node.right, localFacts));
        addObjectMemberRouteUrlMutatorExports(node.right);
        addObjectMemberRouteQueryFactoryExports(node.right);
        return;
      }
      if (left.startsWith('exports.')) {
        clearExportPath(left.slice('exports.'.length));
        addExpressionAliases(
          out,
          left.slice('exports.'.length),
          node.right,
          exportableFacts.urlConstructors,
          exportableFacts.urlSearchParamsConstructors
        );
        addRouteUrlMutatorFact(
          out,
          left.slice('exports.'.length),
          functionRouteUrlMutationParamIndexes(node.right, localFacts)
        );
        addRouteFactoryArgFact(
          out,
          left.slice('exports.'.length),
          functionRelativeUrlParamIndexes(node.right, localFacts)
        );
        if (
          functionReturnsRouteQuery(node.right, exportableFacts) ||
          expressionIsRouteQueryFactory(node.right, exportableFacts, [])
        )
          out.routeQueryFactories.add(left.slice('exports.'.length));
      }
      if (left.startsWith('module.exports.')) {
        clearExportPath(left.slice('module.exports.'.length));
        addExpressionAliases(
          out,
          left.slice('module.exports.'.length),
          node.right,
          exportableFacts.urlConstructors,
          exportableFacts.urlSearchParamsConstructors
        );
        addRouteUrlMutatorFact(
          out,
          left.slice('module.exports.'.length),
          functionRouteUrlMutationParamIndexes(node.right, localFacts)
        );
        addRouteFactoryArgFact(
          out,
          left.slice('module.exports.'.length),
          functionRelativeUrlParamIndexes(node.right, localFacts)
        );
        if (
          functionReturnsRouteQuery(node.right, exportableFacts) ||
          expressionIsRouteQueryFactory(node.right, exportableFacts, [])
        )
          out.routeQueryFactories.add(left.slice('module.exports.'.length));
      }
    });
  }
  seen.delete(key);
  cache.set(key, out);
  return out;
}

function collectImportedFacts(ast, path, context, seen = new Set(), cache = new Map()) {
  const out = createFacts();
  if (!ast || !context.files.length) return out;
  const targetFacts = (specifier) => {
    const targetPath = resolveImportPath(path, specifier);
    const target = targetPath ? context.files.find((file) => file.path === targetPath) : null;
    return target ? collectExportedFacts(target, context, seen, cache) : createFacts();
  };
  (ast.body || []).forEach((node) => {
    if (node.type !== 'ImportDeclaration') return;
    const sourceFacts = targetFacts(node.source && node.source.value);
    (node.specifiers || []).forEach((spec) => {
      if (spec.type === 'ImportNamespaceSpecifier') {
        FACT_KINDS.forEach((kind) => {
          sourceFacts[kind].forEach((alias) =>
            out[kind].add(joinMemberPath(spec.local.name, alias.startsWith('[') ? alias : `.${alias}`))
          );
        });
        (sourceFacts.routeUrlMutators || new Map()).forEach((indexes, alias) => {
          addRouteUrlMutatorFact(
            out,
            joinMemberPath(spec.local.name, alias.startsWith('[') ? alias : `.${alias}`),
            indexes
          );
        });
        (sourceFacts.routeFactoryArgs || new Map()).forEach((indexes, alias) => {
          addRouteFactoryArgFact(
            out,
            joinMemberPath(spec.local.name, alias.startsWith('[') ? alias : `.${alias}`),
            indexes
          );
        });
      } else if (spec.type === 'ImportDefaultSpecifier') {
        addMappedAliases(out, sourceFacts, 'default', spec.local.name);
      } else if (spec.type === 'ImportSpecifier') {
        addMappedAliases(out, sourceFacts, propertyName(spec.imported), spec.local.name);
      }
    });
  });
  walk(ast, (node) => {
    if (node.type !== 'VariableDeclarator' || !isRequireCall(node.init)) return;
    const sourceFacts = targetFacts(node.init.arguments[0].value);
    if (node.id.type === 'Identifier') {
      FACT_KINDS.forEach((kind) => {
        sourceFacts[kind].forEach((alias) => {
          if (alias === 'default') out[kind].add(node.id.name);
          const defaultSuffix = memberPathSuffix(alias, 'default');
          if (defaultSuffix) out[kind].add(joinMemberPath(node.id.name, defaultSuffix));
          out[kind].add(joinMemberPath(node.id.name, alias.startsWith('[') ? alias : `.${alias}`));
        });
      });
      (sourceFacts.routeUrlMutators || new Map()).forEach((indexes, alias) => {
        if (alias === 'default') addRouteUrlMutatorFact(out, node.id.name, indexes);
        const defaultSuffix = memberPathSuffix(alias, 'default');
        if (defaultSuffix) addRouteUrlMutatorFact(out, joinMemberPath(node.id.name, defaultSuffix), indexes);
        addRouteUrlMutatorFact(out, joinMemberPath(node.id.name, alias.startsWith('[') ? alias : `.${alias}`), indexes);
      });
      (sourceFacts.routeFactoryArgs || new Map()).forEach((indexes, alias) => {
        if (alias === 'default') addRouteFactoryArgFact(out, node.id.name, indexes);
        const defaultSuffix = memberPathSuffix(alias, 'default');
        if (defaultSuffix) addRouteFactoryArgFact(out, joinMemberPath(node.id.name, defaultSuffix), indexes);
        addRouteFactoryArgFact(out, joinMemberPath(node.id.name, alias.startsWith('[') ? alias : `.${alias}`), indexes);
      });
    } else if (node.id.type === 'ObjectPattern') {
      node.id.properties.forEach((prop) => {
        if (!prop || prop.type !== 'Property') return;
        const imported = propertyName(prop.key);
        bindingNames(prop.value).forEach((local) => addMappedAliases(out, sourceFacts, imported, local));
      });
    }
  });
  return out;
}

function isRequireCall(node) {
  const value = unwrap(node);
  return Boolean(
    value &&
    value.type === 'CallExpression' &&
    unwrap(value.callee).type === 'Identifier' &&
    unwrap(value.callee).name === 'require' &&
    value.arguments.length &&
    typeof value.arguments[0].value === 'string'
  );
}

function bindingNames(node, out = []) {
  const value = unwrap(node);
  if (!value) return out;
  if (value.type === 'Identifier') out.push(value.name);
  if (value.type === 'RestElement') bindingNames(value.argument, out);
  if (value.type === 'AssignmentPattern') bindingNames(value.left, out);
  if (value.type === 'ArrayPattern') value.elements.forEach((item) => bindingNames(item, out));
  if (value.type === 'ObjectPattern') {
    value.properties.forEach((prop) => {
      if (!prop) return;
      if (prop.type === 'RestElement') bindingNames(prop.argument, out);
      else bindingNames(prop.value, out);
    });
  }
  return out;
}

function isFunctionNode(node) {
  const value = unwrap(node);
  return Boolean(
    value && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(value.type)
  );
}

function collectBindings(ast, baseFacts) {
  const bindings = [];
  const addScopedBaseFactBindings = (root, start, end) => {
    if (!root) return;
    const add = (aliases, kind) => {
      (aliases || new Set()).forEach((alias) => {
        if (alias === root || memberPathSuffix(alias, root)) {
          bindings.push({ name: alias, kind, start, end });
        }
      });
    };
    add(baseFacts.route, 'route');
    add(baseFacts.external, 'external');
    add(baseFacts.factories, 'routeFactory');
    add(baseFacts.routeQueryFactories, 'routeQueryFactory');
    add(baseFacts.urlConstructors, 'urlConstructor');
    add(baseFacts.urlSearchParamsConstructors, 'urlSearchParamsConstructor');
    (baseFacts.routeUrlMutators || new Map()).forEach((_, alias) => {
      if (alias === root || memberPathSuffix(alias, root)) {
        bindings.push({ name: alias, kind: 'routeUrlMutator', start, end });
      }
    });
    (baseFacts.routeFactoryArgs || new Map()).forEach((_, alias) => {
      if (alias === root || memberPathSuffix(alias, root)) {
        bindings.push({ name: alias, kind: 'routeFactoryByArg', start, end });
      }
    });
  };
  const addStringMemberBindings = (root, node, start, end) => {
    const value = unwrap(node);
    if (!root || !value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = propertyName(prop.key);
      if (!key) return;
      const name = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      const stringValue = literalStringValue(prop.value);
      if (stringValue != null) bindings.push({ name, kind: 'unknown', stringValue, start, end });
      addStringMemberBindings(name, prop.value, start, end);
    });
  };
  walk(ast, (node, ancestors) => {
    if (node.type === 'CatchClause' && node.param) {
      const scope = node.body
        ? { start: node.body.start || node.start || 0, end: node.body.end == null ? Infinity : node.body.end }
        : nearestBindingScope(ancestors);
      bindingNames(node.param).forEach((name) =>
        bindings.push({ name, kind: 'unknown', start: scope.start, end: scope.end })
      );
      return;
    }
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
      const scope = nearestBindingScope(ancestors);
      const kind = functionReturnsRelativeUrl(node, baseFacts)
        ? 'routeFactory'
        : functionReturnsRouteQuery(node, baseFacts)
          ? 'routeQueryFactory'
          : 'unknown';
      bindings.push({ name: node.id.name, kind, start: scope.start, end: scope.end });
      return;
    }
    if (node.type !== 'VariableDeclarator') return;
    const declaration = ancestors
      .slice()
      .reverse()
      .find((candidate) => candidate && candidate.type === 'VariableDeclaration');
    const scope =
      declaration && declaration.kind === 'var' ? nearestVarBindingScope(ancestors) : nearestBindingScope(ancestors);
    const bindingStart = declaration && declaration.kind === 'var' ? scope.start : node.start;
    bindingNames(node.id).forEach((name) => {
      let kind = 'unknown';
      let stringValue = null;
      if (isRequireCall(node.init)) {
        if (baseFacts.route && baseFacts.route.has(name)) kind = 'route';
        else if (baseFacts.external && baseFacts.external.has(name)) kind = 'external';
        else if (baseFacts.factories && baseFacts.factories.has(name)) kind = 'routeFactory';
        else if (baseFacts.routeQueryFactories && baseFacts.routeQueryFactories.has(name)) kind = 'routeQueryFactory';
        else if (baseFacts.urlConstructors && baseFacts.urlConstructors.has(name)) kind = 'urlConstructor';
        else if (baseFacts.urlSearchParamsConstructors && baseFacts.urlSearchParamsConstructors.has(name))
          kind = 'urlSearchParamsConstructor';
        else if (baseFacts.routeUrlMutators && baseFacts.routeUrlMutators.has(name)) kind = 'routeUrlMutator';
        else if (baseFacts.routeFactoryArgs && baseFacts.routeFactoryArgs.has(name)) kind = 'routeFactoryByArg';
      }
      if (node.id.type === 'Identifier') {
        stringValue = literalStringValue(node.init);
        const baseState = {
          urlConstructorAliases: baseFacts.urlConstructors || new Set(),
          urlSearchParamsConstructorAliases: baseFacts.urlSearchParamsConstructors || new Set(),
          bindings: []
        };
        const exprKind = expressionStaticKind(node.init);
        const ctorKind = constructorKind(node.init, baseState, ancestors);
        if (exprKind) kind = exprKind;
        else if (ctorKind === 'url') kind = 'urlConstructor';
        else if (ctorKind === 'urlSearchParams') kind = 'urlSearchParamsConstructor';
        else if (newUrlHasStaticExternalArg(node.init, baseFacts.urlConstructors || new Set())) kind = 'external';
        else if (functionReturnsRelativeUrl(node.init, baseFacts)) kind = 'routeFactory';
        else if (functionReturnsRouteQuery(node.init, baseFacts)) kind = 'routeQueryFactory';
        else if (isRequireCall(node.init)) {
          if (baseFacts.route && baseFacts.route.has(name)) kind = 'route';
          else if (baseFacts.external && baseFacts.external.has(name)) kind = 'external';
          else if (baseFacts.factories && baseFacts.factories.has(name)) kind = 'routeFactory';
          else if (baseFacts.routeQueryFactories && baseFacts.routeQueryFactories.has(name)) kind = 'routeQueryFactory';
          else if (baseFacts.routeUrlMutators && baseFacts.routeUrlMutators.has(name)) kind = 'routeUrlMutator';
          else if (baseFacts.routeFactoryArgs && baseFacts.routeFactoryArgs.has(name)) kind = 'routeFactoryByArg';
          else kind = 'object';
          addScopedBaseFactBindings(name, node.start, scope.end);
        } else if (unwrap(node.init) && unwrap(node.init).type === 'ObjectExpression') kind = 'object';
      }
      const defaultKinds = collectPatternDefaultKinds(node.id);
      const defaultKind = defaultKinds.find((entry) => entry.name === name);
      defaultKinds.forEach((entry) => bindings.push({ ...entry, start: bindingStart, end: scope.end }));
      bindings.push({
        name,
        kind: defaultKind ? defaultKind.kind : kind,
        stringValue,
        start: bindingStart,
        end: scope.end
      });
      if (node.id.type === 'Identifier') addStringMemberBindings(name, node.init, bindingStart, scope.end);
    });
  });
  baseFacts.route.forEach((name) => bindings.push({ name, kind: 'route', start: 0, end: Infinity }));
  baseFacts.external.forEach((name) => bindings.push({ name, kind: 'external', start: 0, end: Infinity }));
  (baseFacts.factories || new Set()).forEach((name) =>
    bindings.push({ name, kind: 'routeFactory', start: 0, end: Infinity })
  );
  (baseFacts.routeQueryFactories || new Set()).forEach((name) =>
    bindings.push({ name, kind: 'routeQueryFactory', start: 0, end: Infinity })
  );
  (baseFacts.urlConstructors || new Set()).forEach((name) =>
    bindings.push({ name, kind: 'urlConstructor', start: 0, end: Infinity })
  );
  (baseFacts.urlSearchParamsConstructors || new Set()).forEach((name) =>
    bindings.push({ name, kind: 'urlSearchParamsConstructor', start: 0, end: Infinity })
  );
  (baseFacts.routeUrlMutators || new Map()).forEach((_, name) =>
    bindings.push({ name, kind: 'routeUrlMutator', start: 0, end: Infinity })
  );
  (baseFacts.routeFactoryArgs || new Map()).forEach((_, name) =>
    bindings.push({ name, kind: 'routeFactoryByArg', start: 0, end: Infinity })
  );
  return bindings;
}

function nearestBindingScope(ancestors) {
  for (let i = ancestors.length - 2; i >= 0; i -= 1) {
    const node = ancestors[i];
    if (!node) continue;
    if (node.type === 'BlockStatement' || node.type === 'Program') {
      return { start: node.start || 0, end: node.end == null ? Infinity : node.end };
    }
  }
  return { start: 0, end: Infinity };
}

function nearestVarBindingScope(ancestors) {
  for (let i = ancestors.length - 2; i >= 0; i -= 1) {
    const node = ancestors[i];
    if (!node) continue;
    if (isFunctionNode(node)) {
      const body = unwrap(node).body;
      return {
        start: body && body.start != null ? body.start : node.start || 0,
        end: body && body.end != null ? body.end : node.end == null ? Infinity : node.end
      };
    }
    if (node.type === 'Program') return { start: node.start || 0, end: node.end == null ? Infinity : node.end };
  }
  return { start: 0, end: Infinity };
}

function collectPatternDefaultKinds(pattern, out = []) {
  const value = unwrap(pattern);
  if (!value) return out;
  if (value.type === 'AssignmentPattern') {
    const kind = expressionStaticKind(value.right);
    if (kind) bindingNames(value.left).forEach((name) => out.push({ name, kind }));
    collectPatternDefaultKinds(value.left, out);
  } else if (value.type === 'ArrayPattern') {
    value.elements.forEach((item) => collectPatternDefaultKinds(item, out));
  } else if (value.type === 'ObjectPattern') {
    value.properties.forEach((prop) => {
      if (!prop) return;
      collectPatternDefaultKinds(prop.type === 'RestElement' ? prop.argument : prop.value, out);
    });
  } else if (value.type === 'RestElement') {
    collectPatternDefaultKinds(value.argument, out);
  }
  return out;
}

function paramBindingKind(name, ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const node = ancestors[i];
    if (!node || !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type))
      continue;
    for (const param of node.params || []) {
      if (!bindingNames(param).includes(name)) continue;
      const defaults = collectPatternDefaultKinds(param);
      const match = defaults.find((entry) => entry.name === name);
      return match ? match.kind : 'unknown';
    }
  }
  return '';
}

function bindingKindAt(name, state, ancestors, index) {
  if (!name) return '';
  const paramKind = paramBindingKind(name, ancestors);
  if (paramKind) return paramKind;
  const winner = bindingAt(name, state, index);
  return winner ? winner.kind : '';
}

function aliasPathIsActive(path, aliases, aliasKind, state, ancestors, index) {
  if (!path || !aliases || !aliases.has(path)) return false;
  const root = path.split(/[.\[]/, 1)[0];
  const rootKind = bindingKindAt(root, state, ancestors, index);
  if (rootKind === 'unknown') return false;
  if (path === root) return rootKind ? rootKind === aliasKind : state && state.allowUnboundAliases === true;
  if (path !== root) {
    const pathBinding = bindingAt(path, state, index);
    const rootBinding = bindingAt(root, state, index);
    if (pathBinding && rootBinding && rootBinding.start > pathBinding.start) return false;
    if (pathBinding && pathBinding.kind === 'unknown' && pathBinding.stringValue == null) return false;
    if (pathBinding && pathBinding.kind !== 'unknown' && pathBinding.kind !== aliasKind) return false;
    if (!pathBinding && !rootKind) return state && state.allowUnboundAliases === true;
  }
  return true;
}

function expressionKind(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return '';
  const staticKind = expressionStaticKind(value);
  if (staticKind) return staticKind;
  if (value.type === 'Identifier') {
    const kind = bindingKindAt(value.name, state, ancestors, value.start);
    if (kind && kind !== 'unknown') return kind;
    const boundString = bindingStringAt(value.name, state, ancestors, value.start);
    if (isRouteKey(boundString)) return 'route';
    if (isExternalUrlPrefix(boundString)) return 'external';
    return kind;
  }
  const path = memberPathResolved(value, state, ancestors) || memberPath(value);
  if (path) {
    const boundString = bindingStringAt(path, state, ancestors, value.start);
    if (isRouteKey(boundString)) return 'route';
    if (isExternalUrlPrefix(boundString)) return 'external';
    if (aliasPathIsActive(path, state.routeKeyAliases, 'route', state, ancestors, value.start)) return 'route';
    if (aliasPathIsActive(path, state.externalAliases, 'external', state, ancestors, value.start)) return 'external';
  }
  return '';
}

function expressionIsRouteKey(node, state, ancestors) {
  return expressionKind(node, state, ancestors) === 'route';
}

function expressionBuildsExternalUrl(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  const staticValue = literalStringValue(value);
  if (isExternalUrlPrefix(staticValue)) return true;
  if (value.type === 'NewExpression' && calleeIsUrlConstructor(value.callee, state, ancestors))
    return newUrlIsExternal(value, state, ancestors);
  if (value.type === 'BinaryExpression' && value.operator === '+') {
    return (
      expressionBuildsExternalUrl(value.left, state, ancestors) ||
      (expressionIsExternalUrl(value.left, state, ancestors) && literalStringValue(value.right) != null)
    );
  }
  if (value.type === 'TemplateLiteral') {
    const firstQuasi = value.quasis[0] && (value.quasis[0].value.cooked ?? value.quasis[0].value.raw ?? '');
    if (isExternalUrlPrefix(firstQuasi)) return true;
    return value.expressions.length > 0 && expressionIsExternalUrl(value.expressions[0], state, ancestors);
  }
  return false;
}

function expressionIsExternalUrl(node, state, ancestors) {
  return expressionKind(node, state, ancestors) === 'external' || expressionBuildsExternalUrl(node, state, ancestors);
}

function constructorKind(node, state = null, ancestors = []) {
  const path = state ? memberPathResolved(node, state, ancestors) : memberPath(node);
  const value = unwrap(node);
  const index = value && value.start != null ? value.start : 0;
  if (path === 'URL' || path === 'window.URL' || path === 'globalThis.URL') return 'url';
  if (path === 'URLSearchParams' || path === 'window.URLSearchParams' || path === 'globalThis.URLSearchParams')
    return 'urlSearchParams';
  if (state && aliasPathIsActive(path, state.urlConstructorAliases, 'urlConstructor', state, ancestors, index))
    return 'url';
  if (
    state &&
    aliasPathIsActive(
      path,
      state.urlSearchParamsConstructorAliases,
      'urlSearchParamsConstructor',
      state,
      ancestors,
      index
    )
  )
    return 'urlSearchParams';
  return '';
}

function calleeIsUrlConstructor(node, state = null, ancestors = []) {
  return constructorKind(node, state, ancestors) === 'url';
}

function newUrlIsExternal(node, state, ancestors) {
  if (!node || node.type !== 'NewExpression' || !calleeIsUrlConstructor(node.callee, state, ancestors)) return false;
  const args = node.arguments || [];
  if (expressionIsExternalUrl(args[0], state, ancestors)) return true;
  if (args.length > 1 && expressionIsExternalUrl(args[1], state, ancestors)) {
    return !expressionIsLocationUrl(args[0]) && !expressionIsRelativeUrl(args[0], state, ancestors);
  }
  return false;
}

function expressionIsLocationUrl(node) {
  const path = memberPath(node);
  return (
    path === 'location' ||
    path === 'location.href' ||
    path === 'window.location' ||
    path === 'window.location.href' ||
    path === 'globalThis.location' ||
    path === 'globalThis.location.href'
  );
}

function newUrlIsRelativeRoute(node, state, ancestors) {
  if (!node || node.type !== 'NewExpression' || !calleeIsUrlConstructor(node.callee, state, ancestors)) return false;
  if (newUrlIsExternal(node, state, ancestors)) return false;
  const args = node.arguments || [];
  if (args.length > 1) {
    return (
      expressionIsLocationUrl(args[0]) ||
      expressionIsRelativeUrl(args[0], state, ancestors) ||
      expressionIsLocationUrl(args[1]) ||
      expressionIsRelativeUrl(args[1], state, ancestors)
    );
  }
  return !expressionIsExternalUrl(args[0], state, ancestors);
}

function newUrlConstructsPublicRoute(node, state, ancestors) {
  const value = unwrap(node);
  if (!value || value.type !== 'NewExpression' || !calleeIsUrlConstructor(value.callee, state, ancestors)) return false;
  const args = value.arguments || [];
  if (!expressionSerializesPublicRouteQuery(args[0], state, ancestors)) return false;
  return !(
    args.length > 1 &&
    expressionIsExternalUrl(args[1], state, ancestors) &&
    (expressionIsExternalBaseRelativeArg(args[0], state, ancestors) ||
      expressionHasRelativeStaticPrefix(args[0], state, ancestors))
  );
}

function expressionIsExternalBaseRelativeArg(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  if (expressionIsLocationUrl(value) || expressionIsRelativeUrl(value, state, ancestors)) return false;
  const literal = expressionStringValue(value, state, ancestors);
  return literal != null && !isExternalUrlPrefix(literal);
}

function expressionHasRelativeStaticPrefix(node, state, ancestors) {
  const value = unwrap(node);
  if (!value || expressionIsLocationUrl(value) || expressionIsRelativeUrl(value, state, ancestors)) return false;
  const literal = expressionStringValue(value, state, ancestors);
  if (literal != null) return !isExternalUrlPrefix(literal);
  if (value.type === 'BinaryExpression' && value.operator === '+') {
    return expressionHasRelativeStaticPrefix(value.left, state, ancestors);
  }
  if (value.type === 'TemplateLiteral') {
    const firstQuasi = value.quasis[0] && (value.quasis[0].value.cooked ?? value.quasis[0].value.raw ?? '');
    return firstQuasi ? !isExternalUrlPrefix(firstQuasi) : false;
  }
  return false;
}

function normalizedCallTarget(node, state, ancestors) {
  const value = unwrap(node);
  if (!value || value.type !== 'CallExpression') return null;
  const callee = unwrap(value.callee);
  if (callee && callee.type === 'MemberExpression') {
    const dispatch = memberPropertyName(callee, state, ancestors);
    if (dispatch === 'call' || dispatch === 'apply') {
      const target = unwrap(callee.object);
      const rawArgs = value.arguments || [];
      const applied = dispatch === 'apply' ? unwrap(rawArgs[1]) : null;
      return {
        target,
        path: memberPathResolved(target, state, ancestors) || memberPath(target),
        args:
          dispatch === 'call'
            ? rawArgs.slice(1)
            : applied && applied.type === 'ArrayExpression'
              ? applied.elements.filter(Boolean)
              : []
      };
    }
  }
  return {
    target: callee,
    path: memberPathResolved(callee, state, ancestors) || memberPath(callee),
    args: value.arguments || []
  };
}

function expressionIsRelativeUrl(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  if (expressionIsLocationUrl(value)) return true;
  if (value.type === 'AwaitExpression') return expressionIsRelativeUrl(value.argument, state, ancestors);
  if (value.type === 'NewExpression' && calleeIsUrlConstructor(value.callee, state, ancestors))
    return newUrlIsRelativeRoute(value, state, ancestors);
  const path = memberPathResolved(value, state, ancestors) || memberPath(value);
  if (path && aliasPathIsActive(path, state.routeUrlAliases, 'routeUrl', state, ancestors, value.start)) return true;
  if (path && bindingKindAt(path, state, ancestors, value.start) === 'routeUrl') return true;
  if (value.type === 'CallExpression') {
    const call = normalizedCallTarget(value, state, ancestors);
    const callee = call && call.path;
    const targetStart = call && call.target && call.target.start != null ? call.target.start : value.start;
    if (callee && bindingKindAt(callee, state, ancestors, targetStart) === 'routeFactory') return true;
    if (callee && aliasPathIsActive(callee, state.routeFactories, 'routeFactory', state, ancestors, targetStart))
      return true;
    if (
      callee &&
      aliasPathIsActive(callee, state.routeFactoryArgAliases, 'routeFactoryByArg', state, ancestors, targetStart)
    ) {
      const indexes = state.routeFactoryArgIndexes.get(callee) || new Set();
      if ([...indexes].some((index) => expressionIsRelativeUrl((call.args || [])[index], state, ancestors)))
        return true;
    }
  }
  return false;
}

function addAliasBinding(state, name, kind, node, ancestors) {
  if (!name || !node) return;
  const scope = nearestBindingScope(ancestors);
  state.bindings.push({ name, kind, start: node.start, end: scope.end });
}

function collectRouteUrlAliases(ast, state) {
  walk(ast, (node, ancestors) => {
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      expressionIsRelativeUrl(node.init, state, ancestors)
    ) {
      state.routeUrlAliases.add(node.id.name);
      addAliasBinding(state, node.id.name, 'routeUrl', node, ancestors);
    }
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'ObjectPattern' &&
      ['window', 'globalThis'].includes(memberPath(node.init))
    ) {
      node.id.properties.forEach((prop) => {
        if (!prop || prop.type !== 'Property' || propertyName(prop.key) !== 'location') return;
        bindingNames(prop.value).forEach((name) => {
          state.routeUrlAliases.add(name);
          addAliasBinding(state, name, 'routeUrl', node, ancestors);
        });
      });
    }
    if (node.type === 'AssignmentExpression' && expressionIsRelativeUrl(node.right, state, ancestors)) {
      const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
      if (left) {
        state.routeUrlAliases.add(left);
        addAliasBinding(state, left, 'routeUrl', node.left, ancestors);
      }
    }
  });
}

function isSearchParamsAccess(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  const path = memberPathResolved(value, state, ancestors) || memberPath(value);
  if (path && aliasPathIsActive(path, state.searchParamsAliases, 'searchParams', state, ancestors, value.start))
    return true;
  if (value.type === 'MemberExpression' && memberPropertyName(value, state, ancestors) === 'searchParams') {
    return expressionIsRelativeUrl(value.object, state, ancestors);
  }
  return false;
}

function collectSearchParamsAliases(ast, state) {
  walk(ast, (node, ancestors) => {
    if (node.type === 'VariableDeclarator') {
      if (node.id.type === 'Identifier' && isSearchParamsAccess(node.init, state, ancestors)) {
        state.searchParamsAliases.add(node.id.name);
        addAliasBinding(state, node.id.name, 'searchParams', node, ancestors);
      }
      if (node.id.type === 'ObjectPattern' && expressionIsRelativeUrl(node.init, state, ancestors)) {
        node.id.properties.forEach((prop) => {
          if (!prop || prop.type !== 'Property' || propertyName(prop.key) !== 'searchParams') return;
          bindingNames(prop.value).forEach((name) => {
            state.searchParamsAliases.add(name);
            addAliasBinding(state, name, 'searchParams', node, ancestors);
          });
        });
      }
    }
    if (node.type === 'AssignmentExpression' && isSearchParamsAccess(node.right, state, ancestors)) {
      const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
      if (left) {
        state.searchParamsAliases.add(left);
        addAliasBinding(state, left, 'searchParams', node.left, ancestors);
      }
    }
  });
}

function collectConstructorAliases(ast, state) {
  const addConstructorAlias = (path, kind, node, ancestors) => {
    if (!path || !kind) return;
    if (kind === 'url') {
      state.urlConstructorAliases.add(path);
      addAliasBinding(state, path, 'urlConstructor', node, ancestors);
    } else if (kind === 'urlSearchParams') {
      state.urlSearchParamsConstructorAliases.add(path);
      addAliasBinding(state, path, 'urlSearchParamsConstructor', node, ancestors);
    }
  };
  const addObjectConstructorAliases = (root, node, ancestors) => {
    const value = unwrap(node);
    if (!root || !value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = objectPropertyName(prop, state, ancestors);
      if (!key) return;
      const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      addConstructorAlias(path, constructorKind(prop.value, state, ancestors), prop.value, ancestors);
      addObjectConstructorAliases(path, prop.value, ancestors);
    });
  };
  walk(ast, (node, ancestors) => {
    if (node.type === 'VariableDeclarator') {
      if (node.id.type === 'Identifier') {
        addConstructorAlias(node.id.name, constructorKind(node.init, state, ancestors), node.id, ancestors);
        addObjectConstructorAliases(node.id.name, node.init, ancestors);
      }
      const initPath = memberPathResolved(node.init, state, ancestors) || memberPath(node.init);
      if (node.id.type === 'ObjectPattern' && ['window', 'globalThis'].includes(initPath)) {
        node.id.properties.forEach((prop) => {
          if (!prop || prop.type !== 'Property') return;
          const kind =
            objectPropertyName(prop, state, ancestors) === 'URL'
              ? 'url'
              : objectPropertyName(prop, state, ancestors) === 'URLSearchParams'
                ? 'urlSearchParams'
                : '';
          bindingNames(prop.value).forEach((name) => addConstructorAlias(name, kind, prop.value, ancestors));
        });
      }
    }
    if (node.type === 'AssignmentExpression') {
      const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
      addConstructorAlias(left, constructorKind(node.right, state, ancestors), node.left, ancestors);
      addObjectConstructorAliases(left, node.right, ancestors);
    }
  });
}

function collectStringAliases(ast, state) {
  const addStringAlias = (path, node, ancestors, shadow = true, startNode = node) => {
    const stringValue = literalStringValue(node);
    if (!path || (!shadow && stringValue == null)) return;
    const scope = nearestBindingScope(ancestors);
    const value = unwrap(startNode);
    state.bindings.push({
      name: path,
      kind: 'unknown',
      stringValue,
      start: value && value.start != null ? value.start : 0,
      end: scope.end
    });
  };
  const addObjectStringAliases = (root, node, startNode, ancestors) => {
    const value = unwrap(node);
    if (!root || !value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = objectPropertyName(prop, state, ancestors);
      if (!key) return;
      const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      addStringAlias(path, prop.value, ancestors);
      addObjectStringAliases(path, prop.value, startNode, ancestors);
    });
  };
  walk(ast, (node, ancestors) => {
    if (node.type === 'AssignmentExpression') {
      const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
      addStringAlias(left, node.right, ancestors, true, node.left);
      addObjectStringAliases(left, node.right, node, ancestors);
    }
    if (node.type === 'CallExpression') {
      const callee = memberPathResolved(node.callee, state, ancestors) || memberPath(node.callee);
      if (callee === 'Object.assign') {
        const target = memberPathResolved(node.arguments[0], state, ancestors) || memberPath(node.arguments[0]);
        (node.arguments || []).slice(1).forEach((source) => addObjectStringAliases(target, source, node, ancestors));
      }
      if (callee === 'Reflect.set') {
        const target = memberPathResolved(node.arguments[0], state, ancestors) || memberPath(node.arguments[0]);
        const key = expressionStringValue(node.arguments[1], state, ancestors);
        if (target && key) {
          const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${target}.${key}` : `${target}[${JSON.stringify(key)}]`;
          addStringAlias(path, node.arguments[2], ancestors, true);
        }
      }
    }
  });
}

function collectStateExternalAliases(ast, state) {
  const addExternalAlias = (path, node, ancestors) => {
    if (!path) return;
    state.externalAliases.add(path);
    addAliasBinding(state, path, 'external', node, ancestors);
  };
  walk(ast, (node, ancestors) => {
    if (node.type === 'VariableDeclarator' && expressionIsExternalUrl(node.init, state, ancestors)) {
      bindingNames(node.id).forEach((name) => addExternalAlias(name, node.id, ancestors));
    }
    if (node.type === 'AssignmentExpression' && expressionIsExternalUrl(node.right, state, ancestors)) {
      addExternalAlias(memberPathResolved(node.left, state, ancestors) || memberPath(node.left), node.left, ancestors);
    }
  });
}

function collectBoundSearchParamsMutators(ast, state) {
  const addMutatorAlias = (path, node, ancestors) => {
    if (!path) return;
    state.boundSearchParamsMutatorAliases.add(path);
    addAliasBinding(state, path, 'boundSearchParamsMutator', node, ancestors);
  };
  const expressionIsSearchParamsMutator = (node, ancestors) => {
    const value = unwrap(node);
    if (!value || value.type !== 'MemberExpression') return false;
    return (
      URL_MUTATORS.has(memberPropertyName(value, state, ancestors)) &&
      isSearchParamsAccess(value.object, state, ancestors)
    );
  };
  const expressionBindsSearchParamsMutator = (node, ancestors) => {
    const value = unwrap(node);
    if (!value || value.type !== 'CallExpression') return false;
    const callee = unwrap(value.callee);
    if (!callee || callee.type !== 'MemberExpression' || memberPropertyName(callee, state, ancestors) !== 'bind')
      return false;
    return expressionIsSearchParamsMutator(callee.object, ancestors);
  };
  walk(ast, (node, ancestors) => {
    if (node.type === 'VariableDeclarator') {
      if (
        node.id.type === 'Identifier' &&
        (expressionIsSearchParamsMutator(node.init, ancestors) ||
          expressionBindsSearchParamsMutator(node.init, ancestors))
      ) {
        addMutatorAlias(node.id.name, node.id, ancestors);
      }
      if (node.id.type === 'ObjectPattern' && isSearchParamsAccess(node.init, state, ancestors)) {
        node.id.properties.forEach((prop) => {
          if (!prop || prop.type !== 'Property') return;
          if (!URL_MUTATORS.has(objectPropertyName(prop, state, ancestors))) return;
          bindingNames(prop.value).forEach((name) => addMutatorAlias(name, prop.value, ancestors));
        });
      }
    }
    if (
      node.type === 'AssignmentExpression' &&
      (expressionIsSearchParamsMutator(node.right, ancestors) ||
        expressionBindsSearchParamsMutator(node.right, ancestors))
    ) {
      addMutatorAlias(memberPathResolved(node.left, state, ancestors) || memberPath(node.left), node.left, ancestors);
    }
  });
}

function paramIndexForRouteUrlNode(node, paramIndexes) {
  const value = unwrap(node);
  if (!value || value.type !== 'Identifier') return null;
  return paramIndexes.has(value.name) ? paramIndexes.get(value.name) : null;
}

function paramSearchParamsAliasIndex(node, aliases) {
  const value = unwrap(node);
  if (!value) return null;
  const path = memberPath(value);
  if (!path) return null;
  let winner = null;
  aliases.forEach((alias) => {
    if (alias.name !== path) return;
    if (
      alias.start <= value.start &&
      (alias.end == null || value.start <= alias.end) &&
      (!winner || alias.start > winner.start)
    )
      winner = alias;
  });
  return winner ? winner.paramIndex : null;
}

function paramScopedAliasIndex(node, aliases) {
  const value = unwrap(node);
  if (!value) return null;
  const path = memberPath(value);
  if (!path) return null;
  let winner = null;
  aliases.forEach((alias) => {
    if (alias.name !== path) return;
    if (
      alias.start <= value.start &&
      (alias.end == null || value.start <= alias.end) &&
      (!winner || alias.start > winner.start)
    )
      winner = alias;
  });
  return winner ? winner.paramIndex : null;
}

function paramIndexForSearchParamsAccess(node, paramIndexes, state, ancestors, paramSearchParamsAliases = []) {
  const value = unwrap(node);
  const aliasIndex = paramSearchParamsAliasIndex(value, paramSearchParamsAliases);
  if (aliasIndex != null) return aliasIndex;
  if (!value || value.type !== 'MemberExpression') return null;
  if (memberPropertyName(value, state, ancestors) !== 'searchParams') return null;
  return paramIndexForRouteUrlNode(value.object, paramIndexes);
}

function paramSearchParamsMutatorIndex(node, paramIndexes, state, ancestors, paramSearchParamsAliases = []) {
  const value = unwrap(node);
  if (!value || value.type !== 'MemberExpression') return null;
  if (!URL_MUTATORS.has(memberPropertyName(value, state, ancestors))) return null;
  return paramIndexForSearchParamsAccess(value.object, paramIndexes, state, ancestors, paramSearchParamsAliases);
}

function paramSearchParamsMutatorBindIndex(node, paramIndexes, state, ancestors, paramSearchParamsAliases = []) {
  const value = unwrap(node);
  if (!value || value.type !== 'CallExpression') return null;
  const callee = unwrap(value.callee);
  if (!callee || callee.type !== 'MemberExpression' || memberPropertyName(callee, state, ancestors) !== 'bind')
    return null;
  return paramSearchParamsMutatorIndex(callee.object, paramIndexes, state, ancestors, paramSearchParamsAliases);
}

function paramMutatorCallInfo(
  node,
  paramIndexes,
  state,
  ancestors,
  paramSearchParamsAliases = [],
  paramMutatorAliases = []
) {
  if (!node || node.type !== 'CallExpression') return null;
  const callee = unwrap(node.callee);
  const aliasIndex = paramScopedAliasIndex(callee, paramMutatorAliases);
  if (aliasIndex != null) return { paramIndex: aliasIndex, args: node.arguments || [] };
  if (!callee || callee.type !== 'MemberExpression') return null;
  const property = memberPropertyName(callee, state, ancestors);
  if (URL_MUTATORS.has(property)) {
    const paramIndex = paramIndexForSearchParamsAccess(
      callee.object,
      paramIndexes,
      state,
      ancestors,
      paramSearchParamsAliases
    );
    return paramIndex == null ? null : { paramIndex, args: node.arguments || [] };
  }
  if (
    (property === 'call' || property === 'apply') &&
    callee.object &&
    unwrap(callee.object).type === 'MemberExpression'
  ) {
    const mutator = unwrap(callee.object);
    const mutatorName = memberPropertyName(mutator, state, ancestors);
    const paramIndex = URL_MUTATORS.has(mutatorName)
      ? paramIndexForSearchParamsAccess(mutator.object, paramIndexes, state, ancestors, paramSearchParamsAliases)
      : null;
    if (paramIndex != null) {
      const rawArgs = node.arguments || [];
      return property === 'apply'
        ? {
            paramIndex,
            args: rawArgs[1] && rawArgs[1].type === 'ArrayExpression' ? rawArgs[1].elements.filter(Boolean) : []
          }
        : { paramIndex, args: rawArgs.slice(1) };
    }
  }
  if ((property === 'call' || property === 'apply') && callee.object) {
    const paramIndex = paramScopedAliasIndex(callee.object, paramMutatorAliases);
    if (paramIndex != null) {
      const rawArgs = node.arguments || [];
      return property === 'apply'
        ? {
            paramIndex,
            args: rawArgs[1] && rawArgs[1].type === 'ArrayExpression' ? rawArgs[1].elements.filter(Boolean) : []
          }
        : { paramIndex, args: rawArgs.slice(1) };
    }
  }
  return null;
}

function functionRouteUrlMutationParamIndexes(node, state) {
  const value = unwrap(node);
  const out = new Set();
  if (!isFunctionNode(value)) return out;
  const paramIndexes = new Map();
  const paramSearchParamsAliases = [];
  const paramMutatorAliases = [];
  const addParamSearchParamsAlias = (name, paramIndex, node, ancestors) => {
    if (!name || paramIndex == null) return;
    const scope = nearestBindingScope(ancestors);
    const valueNode = unwrap(node);
    paramSearchParamsAliases.push({
      name,
      paramIndex,
      start: valueNode && valueNode.start != null ? valueNode.start : 0,
      end: scope.end
    });
  };
  const addParamMutatorAlias = (name, paramIndex, node, ancestors) => {
    if (!name || paramIndex == null) return;
    const scope = nearestBindingScope(ancestors);
    const valueNode = unwrap(node);
    paramMutatorAliases.push({
      name,
      paramIndex,
      start: valueNode && valueNode.start != null ? valueNode.start : 0,
      end: scope.end
    });
  };
  (value.params || []).forEach((param, index) => {
    const paramValue = unwrap(param);
    if (paramValue && paramValue.type === 'Identifier') paramIndexes.set(paramValue.name, index);
  });
  if (!paramIndexes.size || !value.body) return out;
  walk(value.body, (child, ancestors) => {
    if (!child) return;
    if (ancestors.some((ancestor) => ancestor !== value.body && isFunctionNode(ancestor))) return;
    if (child.type === 'VariableDeclarator') {
      let paramIndex = paramIndexForSearchParamsAccess(
        child.init,
        paramIndexes,
        state,
        ancestors,
        paramSearchParamsAliases
      );
      if (paramIndex == null && child.id.type === 'ObjectPattern')
        paramIndex = paramIndexForRouteUrlNode(child.init, paramIndexes);
      if (paramIndex != null) {
        if (child.id.type === 'Identifier') addParamSearchParamsAlias(child.id.name, paramIndex, child.id, ancestors);
        if (child.id.type === 'ObjectPattern') {
          child.id.properties.forEach((prop) => {
            if (!prop || prop.type !== 'Property' || propertyName(prop.key) !== 'searchParams') return;
            bindingNames(prop.value).forEach((name) =>
              addParamSearchParamsAlias(name, paramIndex, prop.value, ancestors)
            );
          });
        }
      }
      const mutatorIndex =
        paramSearchParamsMutatorIndex(child.init, paramIndexes, state, ancestors, paramSearchParamsAliases) ??
        paramSearchParamsMutatorBindIndex(child.init, paramIndexes, state, ancestors, paramSearchParamsAliases);
      if (child.id.type === 'Identifier' && mutatorIndex != null)
        addParamMutatorAlias(child.id.name, mutatorIndex, child.id, ancestors);
      const searchParamsIndex = paramIndexForSearchParamsAccess(
        child.init,
        paramIndexes,
        state,
        ancestors,
        paramSearchParamsAliases
      );
      if (child.id.type === 'ObjectPattern' && searchParamsIndex != null) {
        child.id.properties.forEach((prop) => {
          if (!prop || prop.type !== 'Property' || !URL_MUTATORS.has(propertyName(prop.key))) return;
          bindingNames(prop.value).forEach((name) =>
            addParamMutatorAlias(name, searchParamsIndex, prop.value, ancestors)
          );
        });
      }
    }
    if (child.type === 'AssignmentExpression') {
      const paramIndex = paramIndexForSearchParamsAccess(
        child.right,
        paramIndexes,
        state,
        ancestors,
        paramSearchParamsAliases
      );
      const left = memberPath(child.left);
      if (left && paramIndex != null) addParamSearchParamsAlias(left, paramIndex, child.left, ancestors);
      const mutatorIndex =
        paramSearchParamsMutatorIndex(child.right, paramIndexes, state, ancestors, paramSearchParamsAliases) ??
        paramSearchParamsMutatorBindIndex(child.right, paramIndexes, state, ancestors, paramSearchParamsAliases);
      if (left && mutatorIndex != null) addParamMutatorAlias(left, mutatorIndex, child.left, ancestors);
    }
    if (child.type === 'CallExpression') {
      const info = paramMutatorCallInfo(
        child,
        paramIndexes,
        state,
        ancestors,
        paramSearchParamsAliases,
        paramMutatorAliases
      );
      if (info && expressionIsRouteKey(info.args[0], state, ancestors)) out.add(info.paramIndex);
    }
    if (child.type === 'AssignmentExpression') {
      const left = unwrap(child.left);
      if (!left || left.type !== 'MemberExpression' || memberPropertyName(left, state, ancestors) !== 'search') return;
      const paramIndex = paramIndexForRouteUrlNode(left.object, paramIndexes);
      if (paramIndex == null) return;
      if (
        expressionIsRouteQuery(child.right, state, ancestors) ||
        expressionSerializesPublicRouteQuery(child.right, state, ancestors)
      ) {
        out.add(paramIndex);
      }
    }
  });
  return out;
}

function routeUrlMutatorIndexesForExpression(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return null;
  const path = memberPathResolved(value, state, ancestors) || memberPath(value);
  if (!path || !aliasPathIsActive(path, state.routeUrlMutatorAliases, 'routeUrlMutator', state, ancestors, value.start))
    return null;
  return state.routeUrlMutatorArgIndexes.get(path) || new Set();
}

function boundRouteUrlMutatorIndexes(node, state, ancestors) {
  const value = unwrap(node);
  if (!value || value.type !== 'CallExpression') return null;
  const callee = unwrap(value.callee);
  if (!callee || callee.type !== 'MemberExpression' || memberPropertyName(callee, state, ancestors) !== 'bind')
    return null;
  const indexes = routeUrlMutatorIndexesForExpression(callee.object, state, ancestors);
  if (!indexes || !indexes.size) return null;
  const boundCount = Math.max(0, (value.arguments || []).length - 1);
  const out = new Set();
  indexes.forEach((index) => {
    if (index >= boundCount) out.add(index - boundCount);
  });
  return out.size ? out : null;
}

function collectRouteUrlMutators(ast, state) {
  const clearRouteUrlMutator = (path) => {
    if (!path) return;
    Array.from(state.routeUrlMutatorAliases).forEach((alias) => {
      if (alias === path || memberPathSuffix(alias, path)) state.routeUrlMutatorAliases.delete(alias);
    });
    Array.from(state.routeUrlMutatorArgIndexes.keys()).forEach((alias) => {
      if (alias === path || memberPathSuffix(alias, path)) state.routeUrlMutatorArgIndexes.delete(alias);
    });
  };
  const addRouteUrlMutator = (path, indexes, node, ancestors, hoisted = false) => {
    if (!path || !indexes || !indexes.size) return;
    state.routeUrlMutatorAliases.add(path);
    const existing = state.routeUrlMutatorArgIndexes.get(path) || new Set();
    indexes.forEach((index) => existing.add(index));
    state.routeUrlMutatorArgIndexes.set(path, existing);
    if (hoisted) {
      const scope = nearestBindingScope(ancestors);
      state.bindings.push({ name: path, kind: 'routeUrlMutator', start: scope.start, end: scope.end });
    } else {
      addAliasBinding(state, path, 'routeUrlMutator', node, ancestors);
    }
  };
  const propertyOwnerPath = (property, ancestors) => {
    const parent = ancestors[ancestors.length - 2];
    if (!parent || parent.type !== 'ObjectExpression') return '';
    const key = objectPropertyName(property, state, ancestors);
    if (!key) return '';
    const declarator = ancestors
      .slice()
      .reverse()
      .find(
        (candidate) =>
          candidate.type === 'VariableDeclarator' &&
          candidate.id &&
          candidate.id.type === 'Identifier' &&
          unwrap(candidate.init) === parent
      );
    if (declarator) return `${declarator.id.name}.${key}`;
    const assignment = ancestors
      .slice()
      .reverse()
      .find((candidate) => candidate.type === 'AssignmentExpression' && unwrap(candidate.right) === parent);
    const assignmentPath = assignment
      ? memberPathResolved(assignment.left, state, ancestors) || memberPath(assignment.left)
      : '';
    return assignmentPath ? `${assignmentPath}.${key}` : '';
  };
  const addObjectRouteUrlMutators = (root, node, ancestors, clear = false) => {
    const value = unwrap(node);
    if (!root || !value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = objectPropertyName(prop, state, ancestors);
      if (!key) return;
      const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      if (clear) clearRouteUrlMutator(path);
      const directIndexes = functionRouteUrlMutationParamIndexes(prop.value, state);
      const aliasIndexes = routeUrlMutatorIndexesForExpression(prop.value, state, ancestors);
      addRouteUrlMutator(path, directIndexes.size ? directIndexes : aliasIndexes, prop.value, ancestors);
      addObjectRouteUrlMutators(path, prop.value, ancestors, clear);
    });
  };
  walk(ast, (node, ancestors) => {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
      addRouteUrlMutator(node.id.name, functionRouteUrlMutationParamIndexes(node, state), node.id, ancestors, true);
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      addRouteUrlMutator(node.id.name, functionRouteUrlMutationParamIndexes(node.init, state), node.id, ancestors);
      addObjectRouteUrlMutators(node.id.name, node.init, ancestors);
    }
    if (node.type === 'Property' && isFunctionNode(node.value)) {
      addRouteUrlMutator(
        propertyOwnerPath(node, ancestors),
        functionRouteUrlMutationParamIndexes(node.value, state),
        node.key || node.value,
        ancestors
      );
    }
  });
  walk(ast, (node, ancestors) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern') {
      const sourceRoot = memberPathResolved(node.init, state, ancestors) || memberPath(node.init);
      if (!sourceRoot) return;
      node.id.properties.forEach((prop) => {
        if (!prop || prop.type !== 'Property') return;
        const key = objectPropertyName(prop, state, ancestors);
        if (!key) return;
        const sourcePath = /^[A-Za-z_$][\w$]*$/.test(key)
          ? `${sourceRoot}.${key}`
          : `${sourceRoot}[${JSON.stringify(key)}]`;
        if (
          !aliasPathIsActive(sourcePath, state.routeUrlMutatorAliases, 'routeUrlMutator', state, ancestors, node.start)
        )
          return;
        const indexes = state.routeUrlMutatorArgIndexes.get(sourcePath) || new Set();
        bindingNames(prop.value).forEach((name) => addRouteUrlMutator(name, indexes, prop.value, ancestors));
      });
    }
    if (node.type === 'AssignmentExpression') {
      const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
      addObjectRouteUrlMutators(left, node.right, ancestors, true);
    }
  });
  walk(ast, (node, ancestors) => {
    if (node.type === 'CallExpression') {
      const callee = memberPathResolved(node.callee, state, ancestors) || memberPath(node.callee);
      if (callee === 'Object.assign') {
        const target = memberPathResolved(node.arguments[0], state, ancestors) || memberPath(node.arguments[0]);
        (node.arguments || []).slice(1).forEach((source) => addObjectRouteUrlMutators(target, source, ancestors, true));
      }
      if (callee === 'Reflect.set') {
        const target = memberPathResolved(node.arguments[0], state, ancestors) || memberPath(node.arguments[0]);
        const key = expressionStringValue(node.arguments[1], state, ancestors);
        if (target && key) {
          const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${target}.${key}` : `${target}[${JSON.stringify(key)}]`;
          clearRouteUrlMutator(path);
          addRouteUrlMutator(
            path,
            functionRouteUrlMutationParamIndexes(node.arguments[2], state),
            node.arguments[2],
            ancestors
          );
        }
      }
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      addRouteUrlMutator(
        node.id.name,
        routeUrlMutatorIndexesForExpression(node.init, state, ancestors),
        node.id,
        ancestors
      );
      addRouteUrlMutator(node.id.name, boundRouteUrlMutatorIndexes(node.init, state, ancestors), node.id, ancestors);
    }
    if (node.type === 'AssignmentExpression') {
      const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
      addRouteUrlMutator(left, routeUrlMutatorIndexesForExpression(node.right, state, ancestors), node.left, ancestors);
      addRouteUrlMutator(left, boundRouteUrlMutatorIndexes(node.right, state, ancestors), node.left, ancestors);
    }
  });
}

function inlineRouteUrlMutatorCall(node, state, ancestors) {
  const value = unwrap(node);
  if (!value || value.type !== 'CallExpression') return null;
  const callee = unwrap(value.callee);
  if (isFunctionNode(callee)) {
    return { target: callee, args: value.arguments || [] };
  }
  if (!callee || callee.type !== 'MemberExpression') return null;
  const dispatch = memberPropertyName(callee, state, ancestors);
  if (dispatch !== 'call' && dispatch !== 'apply') return null;
  const target = unwrap(callee.object);
  if (!isFunctionNode(target)) return null;
  const rawArgs = value.arguments || [];
  if (dispatch === 'call') return { target, args: rawArgs.slice(1) };
  const applied = unwrap(rawArgs[1]);
  return {
    target,
    args: applied && applied.type === 'ArrayExpression' ? applied.elements.filter(Boolean) : []
  };
}

function callUsesRouteUrlMutator(node, state, ancestors) {
  if (!node || node.type !== 'CallExpression') return false;
  const inlineCall = inlineRouteUrlMutatorCall(node, state, ancestors);
  if (inlineCall) {
    const indexes = functionRouteUrlMutationParamIndexes(inlineCall.target, state);
    if ([...indexes].some((index) => expressionIsRelativeUrl(inlineCall.args[index], state, ancestors))) return true;
  }
  const directIndexes = routeUrlMutatorIndexesForExpression(node.callee, state, ancestors);
  if (
    directIndexes &&
    [...directIndexes].some((index) => expressionIsRelativeUrl((node.arguments || [])[index], state, ancestors))
  )
    return true;
  const callee = unwrap(node.callee);
  if (!callee || callee.type !== 'MemberExpression') return false;
  const property = memberPropertyName(callee, state, ancestors);
  if (property === 'bind') {
    const targetIndexes = routeUrlMutatorIndexesForExpression(callee.object, state, ancestors);
    const boundArgs = (node.arguments || []).slice(1);
    return Boolean(
      targetIndexes && [...targetIndexes].some((index) => expressionIsRelativeUrl(boundArgs[index], state, ancestors))
    );
  }
  if (property !== 'call' && property !== 'apply') return false;
  const targetIndexes = routeUrlMutatorIndexesForExpression(callee.object, state, ancestors);
  if (!targetIndexes || !targetIndexes.size) return false;
  const rawArgs = node.arguments || [];
  const args =
    property === 'apply'
      ? rawArgs[1] && rawArgs[1].type === 'ArrayExpression'
        ? rawArgs[1].elements.filter(Boolean)
        : []
      : rawArgs.slice(1);
  return [...targetIndexes].some((index) => expressionIsRelativeUrl(args[index], state, ancestors));
}

function mutatorCallInfo(node, state, ancestors) {
  if (!node || node.type !== 'CallExpression') return null;
  const callee = unwrap(node.callee);
  const path = memberPathResolved(callee, state, ancestors) || memberPath(callee);
  if (
    path &&
    aliasPathIsActive(
      path,
      state.boundSearchParamsMutatorAliases,
      'boundSearchParamsMutator',
      state,
      ancestors,
      callee.start
    )
  ) {
    return { method: 'bound', args: node.arguments || [] };
  }
  if (!callee || callee.type !== 'MemberExpression') return null;
  const property = memberPropertyName(callee, state, ancestors);
  if (URL_MUTATORS.has(property) && isSearchParamsAccess(callee.object, state, ancestors)) {
    return { method: property, args: node.arguments || [] };
  }
  if (
    (property === 'call' || property === 'apply') &&
    callee.object &&
    unwrap(callee.object).type === 'MemberExpression'
  ) {
    const mutator = unwrap(callee.object);
    const mutatorName = memberPropertyName(mutator, state, ancestors);
    if (
      (URL_MUTATORS.has(mutatorName) && isSearchParamsAccess(mutator.object, state, ancestors)) ||
      aliasPathIsActive(
        memberPathResolved(mutator, state, ancestors) || memberPath(mutator),
        state.boundSearchParamsMutatorAliases,
        'boundSearchParamsMutator',
        state,
        ancestors,
        mutator.start
      )
    ) {
      const rawArgs = node.arguments || [];
      return property === 'apply'
        ? {
            method: mutatorName,
            args: rawArgs[1] && rawArgs[1].type === 'ArrayExpression' ? rawArgs[1].elements.filter(Boolean) : []
          }
        : { method: mutatorName, args: rawArgs.slice(1) };
    }
  }
  if ((property === 'call' || property === 'apply') && callee.object) {
    const mutator = unwrap(callee.object);
    const mutatorPath = memberPathResolved(mutator, state, ancestors) || memberPath(mutator);
    if (
      mutatorPath &&
      aliasPathIsActive(
        mutatorPath,
        state.boundSearchParamsMutatorAliases,
        'boundSearchParamsMutator',
        state,
        ancestors,
        mutator.start
      )
    ) {
      const rawArgs = node.arguments || [];
      return property === 'apply'
        ? {
            method: 'bound',
            args: rawArgs[1] && rawArgs[1].type === 'ArrayExpression' ? rawArgs[1].elements.filter(Boolean) : []
          }
        : { method: 'bound', args: rawArgs.slice(1) };
    }
  }
  return null;
}

function callUsesPublicRouteHref(node, state, ancestors) {
  if (!node || node.type !== 'CallExpression') return false;
  const callee = unwrap(node.callee);
  const path = memberPathResolved(callee, state, ancestors) || memberPath(callee);
  const property =
    callee && callee.type === 'MemberExpression' ? memberPropertyName(callee, state, ancestors) : propertyName(callee);
  if (property === 'setAttribute') {
    const attribute = safeString(literalStringValue(node.arguments[0])).toLowerCase();
    return (
      ROUTE_HREF_ATTRIBUTES.has(attribute) && expressionSerializesPublicRouteQuery(node.arguments[1], state, ancestors)
    );
  }
  if (property === 'navigate') {
    return expressionSerializesPublicRouteQuery(node.arguments[0], state, ancestors);
  }
  if (
    (property === 'assign' || property === 'replace') &&
    (path === 'location.assign' ||
      path === 'location.replace' ||
      path === 'window.location.assign' ||
      path === 'window.location.replace' ||
      path === 'globalThis.location.assign' ||
      path === 'globalThis.location.replace')
  ) {
    return expressionSerializesPublicRouteQuery(node.arguments[0], state, ancestors);
  }
  if (path === 'open' || path === 'window.open' || path === 'globalThis.open') {
    return expressionSerializesPublicRouteQuery(node.arguments[0], state, ancestors);
  }
  if (
    (property === 'pushState' || property === 'replaceState') &&
    (path === 'history.pushState' ||
      path === 'history.replaceState' ||
      path === 'window.history.pushState' ||
      path === 'window.history.replaceState' ||
      path === 'globalThis.history.pushState' ||
      path === 'globalThis.history.replaceState')
  ) {
    return expressionSerializesPublicRouteQuery(node.arguments[2], state, ancestors);
  }
  return false;
}

function expressionIsDirectSearchSinkOwner(node) {
  const value = unwrap(node);
  return Boolean(value && (value.type === 'Identifier' || value.type === 'MemberExpression'));
}

function isUrlSearchParamsConstructor(node, state = null, ancestors = []) {
  return constructorKind(node, state, ancestors) === 'urlSearchParams';
}

function propertyIsRouteKey(prop, state, ancestors) {
  if (!prop || prop.type !== 'Property') return false;
  return prop.computed
    ? expressionIsRouteKey(prop.key, state, ancestors)
    : isRouteKey(objectPropertyName(prop, state, ancestors));
}

function expressionBuildsRouteQuery(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  if (expressionHasRouteQueryLiteral(value)) return true;
  if (expressionHasRoutePairLiteral(value)) return true;
  if (value.type === 'ConditionalExpression') {
    return (
      expressionIsRouteQuery(value.consequent, state, ancestors) ||
      expressionIsRouteQuery(value.alternate, state, ancestors)
    );
  }
  if (value.type === 'LogicalExpression') {
    return (
      expressionIsRouteQuery(value.left, state, ancestors) || expressionIsRouteQuery(value.right, state, ancestors)
    );
  }
  if (value.type === 'SequenceExpression') {
    const expressions = value.expressions || [];
    return expressions.length > 0 && expressionIsRouteQuery(expressions[expressions.length - 1], state, ancestors);
  }
  if (value.type === 'ObjectExpression') {
    return value.properties.some((prop) => {
      if (propertyIsRouteKey(prop, state, ancestors)) return true;
      return prop && prop.type === 'SpreadElement' && expressionIsRouteQuery(prop.argument, state, ancestors);
    });
  }
  if (value.type === 'ArrayExpression') {
    return value.elements.some((item) => {
      const element = unwrap(item);
      if (!element) return false;
      if (element.type === 'SpreadElement') return expressionIsRouteQuery(element.argument, state, ancestors);
      return (
        element.type === 'ArrayExpression' &&
        element.elements.length &&
        expressionIsRouteKey(element.elements[0], state, ancestors)
      );
    });
  }
  if (value.type === 'CallExpression') {
    const callee = memberPath(value.callee);
    if (
      (callee === 'Object.entries' || callee === 'Object.fromEntries') &&
      expressionIsRouteQuery(value.arguments[0], state, ancestors)
    )
      return true;
  }
  if (
    value.type === 'NewExpression' &&
    memberPathResolved(value.callee, state, ancestors) === 'Map' &&
    expressionIsRouteQuery(value.arguments[0], state, ancestors)
  )
    return true;
  if (value.type === 'TemplateLiteral') {
    const firstQuasi = value.quasis[0] && (value.quasis[0].value.cooked ?? value.quasis[0].value.raw ?? '');
    return (
      stringHasRoutePairLiteral(firstQuasi) ||
      value.expressions.some((expr) => expressionIsRouteKey(expr, state, ancestors))
    );
  }
  if (value.type === 'BinaryExpression' && value.operator === '+') {
    if (
      expressionBuildsRouteQuery(value.left, state, ancestors) ||
      expressionBuildsRouteQuery(value.right, state, ancestors)
    )
      return true;
    const left = expressionStringValue(value.left, state, ancestors);
    const right = expressionStringValue(value.right, state, ancestors);
    return (
      (left === '?' && expressionIsRouteKey(value.right, state, ancestors)) ||
      (right === '=' && expressionIsRouteKey(value.left, state, ancestors))
    );
  }
  if (value.type === 'NewExpression' && isUrlSearchParamsConstructor(value.callee, state, ancestors)) {
    const first = value.arguments[0];
    if (!first) return false;
    if (expressionIsRouteQuery(first, state, ancestors)) return true;
    if (first.type === 'ObjectExpression') {
      return first.properties.some((prop) => propertyIsRouteKey(prop, state, ancestors));
    }
    if (first.type === 'ArrayExpression') {
      return first.elements.some(
        (item) =>
          item &&
          item.type === 'ArrayExpression' &&
          item.elements.length &&
          expressionIsRouteKey(item.elements[0], state, ancestors)
      );
    }
  }
  return false;
}

function concatParts(node, out = []) {
  const value = unwrap(node);
  if (!value) return out;
  if (value.type === 'BinaryExpression' && value.operator === '+') {
    concatParts(value.left, out);
    concatParts(value.right, out);
  } else {
    out.push(value);
  }
  return out;
}

function expressionIsRouteQuery(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  const path = memberPathResolved(value, state, ancestors) || memberPath(value);
  if (path && aliasPathIsActive(path, state.routeQueryAliases, 'routeQuery', state, ancestors, value.start))
    return true;
  if (expressionBuildsRouteQuery(value, state, ancestors)) return true;
  if (value.type === 'CallExpression') {
    const callee = memberPathResolved(value.callee, state, ancestors) || memberPath(value.callee);
    const calleeNode = unwrap(value.callee);
    if (
      callee &&
      aliasPathIsActive(
        callee,
        state.routeQueryFactories,
        'routeQueryFactory',
        state,
        ancestors,
        calleeNode ? calleeNode.start : value.start
      )
    )
      return true;
  }
  if (value.type === 'CallExpression' && memberPathResolved(value.callee, state, ancestors) === 'String') {
    return expressionIsRouteQuery(value.arguments[0], state, ancestors);
  }
  if (
    value.type === 'CallExpression' &&
    unwrap(value.callee).type === 'MemberExpression' &&
    memberPropertyName(unwrap(value.callee), state, ancestors) === 'toString'
  ) {
    return expressionIsRouteQuery(unwrap(value.callee).object, state, ancestors);
  }
  return false;
}

function expressionSerializesPublicRouteQuery(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  if (expressionHasRouteQueryLiteral(value)) return true;
  if (value.type === 'ConditionalExpression') {
    return (
      expressionSerializesPublicRouteQuery(value.consequent, state, ancestors) ||
      expressionSerializesPublicRouteQuery(value.alternate, state, ancestors)
    );
  }
  if (value.type === 'LogicalExpression') {
    return (
      expressionSerializesPublicRouteQuery(value.left, state, ancestors) ||
      expressionSerializesPublicRouteQuery(value.right, state, ancestors)
    );
  }
  if (value.type === 'TemplateLiteral') {
    let templateHasExternalPrefix = false;
    let templateStaticPrefix = '';
    for (let i = 0; i < value.expressions.length; i += 1) {
      const before = value.quasis[i] && (value.quasis[i].value.cooked ?? value.quasis[i].value.raw ?? '');
      const after = value.quasis[i + 1] && (value.quasis[i + 1].value.cooked ?? value.quasis[i + 1].value.raw ?? '');
      const markerIndex = Math.max(safeString(before).lastIndexOf('?'), safeString(before).lastIndexOf('&'));
      const markerPrefix = markerIndex >= 0 ? `${templateStaticPrefix}${safeString(before).slice(0, markerIndex)}` : '';
      if (i > 0 && expressionIsExternalUrl(value.expressions[i - 1], state, ancestors))
        templateHasExternalPrefix = true;
      if (
        markerIndex >= 0 &&
        !templateHasExternalPrefix &&
        !isExternalUrlPrefix(markerPrefix) &&
        stringHasRouteQueryLiteral(before)
      ) {
        return true;
      }
      if (
        markerIndex >= 0 &&
        !templateHasExternalPrefix &&
        !isExternalUrlPrefix(markerPrefix) &&
        expressionIsRouteQuery(value.expressions[i], state, ancestors)
      ) {
        return true;
      }
      if (
        markerIndex >= 0 &&
        !templateHasExternalPrefix &&
        !isExternalUrlPrefix(markerPrefix) &&
        expressionIsRouteKey(value.expressions[i], state, ancestors) &&
        safeString(after).trimStart().startsWith('=')
      ) {
        return true;
      }
      templateStaticPrefix += safeString(before);
      if (isExternalUrlPrefix(templateStaticPrefix)) templateHasExternalPrefix = true;
      if (expressionIsExternalUrl(value.expressions[i], state, ancestors)) templateHasExternalPrefix = true;
    }
    const finalQuasi =
      value.quasis[value.quasis.length - 1] &&
      (value.quasis[value.quasis.length - 1].value.cooked ?? value.quasis[value.quasis.length - 1].value.raw ?? '');
    const markerIndex = Math.max(safeString(finalQuasi).lastIndexOf('?'), safeString(finalQuasi).lastIndexOf('&'));
    if (
      markerIndex >= 0 &&
      !templateHasExternalPrefix &&
      !isExternalUrlPrefix(`${templateStaticPrefix}${safeString(finalQuasi).slice(0, markerIndex)}`) &&
      stringHasRouteQueryLiteral(finalQuasi)
    ) {
      return true;
    }
    return false;
  }
  const parts = concatParts(value);
  let sawPublicQueryMarker = false;
  let staticPrefix = '';
  let concatHasExternalPrefix = false;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const literal = expressionStringValue(part, state, ancestors);
    if (literal != null) {
      const markerIndex = Math.max(literal.lastIndexOf('?'), literal.lastIndexOf('&'));
      if (markerIndex >= 0) {
        const prefix = `${staticPrefix}${literal.slice(0, markerIndex)}`;
        if (!concatHasExternalPrefix && !isExternalUrlPrefix(prefix)) sawPublicQueryMarker = true;
      }
      staticPrefix += literal;
      if (!concatHasExternalPrefix && sawPublicQueryMarker && stringHasRouteQueryLiteral(staticPrefix)) return true;
      if (isExternalUrlPrefix(staticPrefix)) concatHasExternalPrefix = true;
      continue;
    }
    if (!concatHasExternalPrefix && sawPublicQueryMarker && expressionIsRouteQuery(part, state, ancestors)) return true;
    if (expressionIsRouteKey(part, state, ancestors)) {
      const nextLiteral = expressionStringValue(parts[index + 1], state, ancestors);
      if (!concatHasExternalPrefix && sawPublicQueryMarker && safeString(nextLiteral).trimStart().startsWith('='))
        return true;
    }
    if (expressionIsExternalUrl(part, state, ancestors)) concatHasExternalPrefix = true;
    if (!concatHasExternalPrefix) staticPrefix = '';
  }
  return false;
}

function collectRouteQueryAliases(ast, state) {
  const addRouteQueryAlias = (path, node, ancestors) => {
    if (!path) return;
    state.routeQueryAliases.add(path);
    addAliasBinding(state, path, 'routeQuery', node, ancestors);
  };
  const addUrlSearchParamsAlias = (path, node, ancestors) => {
    if (!path) return;
    state.urlSearchParamsAliases.add(path);
    addAliasBinding(state, path, 'urlSearchParams', node, ancestors);
  };
  const isTrackedParams = (node, ancestors) => {
    const value = unwrap(node);
    const path = memberPathResolved(value, state, ancestors) || memberPath(value);
    return Boolean(
      path &&
      (aliasPathIsActive(path, state.urlSearchParamsAliases, 'urlSearchParams', state, ancestors, value.start) ||
        aliasPathIsActive(path, state.routeQueryAliases, 'routeQuery', state, ancestors, value.start))
    );
  };
  walk(ast, (node, ancestors) => {
    if (node.type === 'VariableDeclarator') {
      const init = unwrap(node.init);
      if (
        node.id.type === 'Identifier' &&
        init &&
        init.type === 'NewExpression' &&
        isUrlSearchParamsConstructor(init.callee, state, ancestors)
      ) {
        addUrlSearchParamsAlias(node.id.name, node.id, ancestors);
        if (expressionBuildsRouteQuery(init, state, ancestors)) addRouteQueryAlias(node.id.name, node.id, ancestors);
      } else if (node.id.type === 'Identifier' && expressionIsRouteQuery(init, state, ancestors)) {
        addRouteQueryAlias(node.id.name, node.id, ancestors);
      } else if (
        node.id.type === 'Identifier' &&
        init &&
        init.type === 'CallExpression' &&
        unwrap(init.callee).type === 'MemberExpression' &&
        memberPropertyName(unwrap(init.callee), state, ancestors) === 'toString' &&
        expressionIsRouteQuery(unwrap(init.callee).object, state, ancestors)
      ) {
        addRouteQueryAlias(node.id.name, node.id, ancestors);
      }
    }
    if (node.type === 'AssignmentExpression') {
      const right = unwrap(node.right);
      const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
      if (
        left &&
        right &&
        right.type === 'NewExpression' &&
        isUrlSearchParamsConstructor(right.callee, state, ancestors)
      ) {
        addUrlSearchParamsAlias(left, node.left, ancestors);
        if (expressionBuildsRouteQuery(right, state, ancestors)) addRouteQueryAlias(left, node.left, ancestors);
      } else if (left && expressionIsRouteQuery(right, state, ancestors)) {
        addRouteQueryAlias(left, node.left, ancestors);
      } else if (
        left &&
        right &&
        right.type === 'CallExpression' &&
        unwrap(right.callee).type === 'MemberExpression' &&
        memberPropertyName(unwrap(right.callee), state, ancestors) === 'toString' &&
        expressionIsRouteQuery(unwrap(right.callee).object, state, ancestors)
      ) {
        addRouteQueryAlias(left, node.left, ancestors);
      }
    }
    if (node.type === 'CallExpression') {
      const callee = unwrap(node.callee);
      if (!callee || callee.type !== 'MemberExpression') return;
      const method = memberPropertyName(callee, state, ancestors);
      if (!URL_MUTATORS.has(method) || !isTrackedParams(callee.object, ancestors)) return;
      if (expressionIsRouteKey(node.arguments[0], state, ancestors))
        addRouteQueryAlias(
          memberPathResolved(callee.object, state, ancestors) || memberPath(callee.object),
          callee.object,
          ancestors
        );
    }
  });
}

function expressionIsRouteQueryFactory(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  const path = memberPathResolved(value, state, ancestors) || memberPath(value);
  return Boolean(
    path && aliasPathIsActive(path, state.routeQueryFactories, 'routeQueryFactory', state, ancestors, value.start)
  );
}

function collectRouteQueryFactories(ast, state) {
  const clearRouteQueryFactory = (path) => {
    if (!path) return;
    Array.from(state.routeQueryFactories).forEach((alias) => {
      if (alias === path || memberPathSuffix(alias, path)) state.routeQueryFactories.delete(alias);
    });
  };
  const addRouteQueryFactory = (path, node, ancestors, hoisted = false) => {
    if (!path || !functionReturnsRouteQuery(node, state)) return;
    state.routeQueryFactories.add(path);
    if (hoisted) {
      const scope = nearestBindingScope(ancestors);
      state.bindings.push({ name: path, kind: 'routeQueryFactory', start: scope.start, end: scope.end });
    } else {
      addAliasBinding(state, path, 'routeQueryFactory', node, ancestors);
    }
  };
  const addRouteQueryFactoryAlias = (path, node, ancestors) => {
    if (!path || !expressionIsRouteQueryFactory(node, state, ancestors)) return;
    state.routeQueryFactories.add(path);
    addAliasBinding(state, path, 'routeQueryFactory', node, ancestors);
  };
  const propertyOwnerPath = (property, ancestors) => {
    const parent = ancestors[ancestors.length - 2];
    if (!parent || parent.type !== 'ObjectExpression') return '';
    const key = objectPropertyName(property, state, ancestors);
    if (!key) return '';
    const declarator = ancestors
      .slice()
      .reverse()
      .find(
        (candidate) =>
          candidate.type === 'VariableDeclarator' &&
          candidate.id &&
          candidate.id.type === 'Identifier' &&
          unwrap(candidate.init) === parent
      );
    if (declarator) return `${declarator.id.name}.${key}`;
    const assignment = ancestors
      .slice()
      .reverse()
      .find((candidate) => candidate.type === 'AssignmentExpression' && unwrap(candidate.right) === parent);
    const assignmentPath = assignment
      ? memberPathResolved(assignment.left, state, ancestors) || memberPath(assignment.left)
      : '';
    return assignmentPath ? `${assignmentPath}.${key}` : '';
  };
  const addObjectRouteQueryFactories = (root, node, ancestors, clear = false) => {
    const value = unwrap(node);
    if (!root || !value || value.type !== 'ObjectExpression') return;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = objectPropertyName(prop, state, ancestors);
      if (!key) return;
      const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      if (clear) clearRouteQueryFactory(path);
      addRouteQueryFactory(path, prop.value, ancestors);
      addRouteQueryFactoryAlias(path, prop.value, ancestors);
      addObjectRouteQueryFactories(path, prop.value, ancestors, clear);
    });
  };
  walk(ast, (node, ancestors) => {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
      addRouteQueryFactory(node.id.name, node, ancestors, true);
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      addRouteQueryFactory(node.id.name, node.init, ancestors);
      addRouteQueryFactoryAlias(node.id.name, node.init, ancestors);
      addObjectRouteQueryFactories(node.id.name, node.init, ancestors);
    }
    if (node.type === 'Property' && isFunctionNode(node.value)) {
      addRouteQueryFactory(propertyOwnerPath(node, ancestors), node.value, ancestors);
    }
  });
  walk(ast, (node, ancestors) => {
    if (node.type === 'CallExpression') {
      const callee = memberPathResolved(node.callee, state, ancestors) || memberPath(node.callee);
      if (callee === 'Object.assign') {
        const target = memberPathResolved(node.arguments[0], state, ancestors) || memberPath(node.arguments[0]);
        (node.arguments || [])
          .slice(1)
          .forEach((source) => addObjectRouteQueryFactories(target, source, ancestors, true));
      }
      if (callee === 'Reflect.set') {
        const target = memberPathResolved(node.arguments[0], state, ancestors) || memberPath(node.arguments[0]);
        const key = expressionStringValue(node.arguments[1], state, ancestors);
        if (target && key) {
          const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${target}.${key}` : `${target}[${JSON.stringify(key)}]`;
          clearRouteQueryFactory(path);
          addRouteQueryFactory(path, node.arguments[2], ancestors);
          addRouteQueryFactoryAlias(path, node.arguments[2], ancestors);
        }
      }
    }
    if (node.type === 'AssignmentExpression') {
      const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
      clearRouteQueryFactory(left);
      addRouteQueryFactory(left, node.right, ancestors);
      addRouteQueryFactoryAlias(left, node.right, ancestors);
    }
  });
}

function collectRouteFactories(ast, state) {
  const localFacts = {
    external: state.externalAliases,
    factories: state.routeFactories,
    routeFactoryArgs: state.routeFactoryArgIndexes,
    urlConstructors: state.urlConstructorAliases,
    urlSearchParamsConstructors: state.urlSearchParamsConstructorAliases,
    bindings: state.bindings,
    allowUnboundAliases: false
  };
  const isRouteFactoryExpression = (node, ancestors) => {
    const value = unwrap(node);
    if (!value) return false;
    if (isFunctionNode(value)) return functionReturnsRelativeUrl(value, localFacts);
    const path = memberPathResolved(value, state, ancestors) || memberPath(value);
    if (!path) return false;
    if (bindingKindAt(path, state, ancestors, value.start) === 'routeFactory') return true;
    return aliasPathIsActive(path, state.routeFactories, 'routeFactory', state, ancestors, value.start);
  };
  const addRouteFactory = (name, node, ancestors, options = {}) => {
    if (!name || !node) return false;
    const before = state.routeFactories.size;
    state.routeFactories.add(name);
    const scope = options.scope || nearestBindingScope(ancestors);
    const value = unwrap(node);
    state.bindings.push({
      name,
      kind: 'routeFactory',
      start: options.hoisted ? scope.start : value && value.start != null ? value.start : scope.start,
      end: scope.end
    });
    return state.routeFactories.size !== before;
  };
  const addThisRouteFactory = (key, node, objectNode) => {
    if (!key || !node || !objectNode) return false;
    return addRouteFactory(`this.${key}`, node, [], {
      scope: {
        start: objectNode.start || 0,
        end: objectNode.end == null ? Infinity : objectNode.end
      }
    });
  };
  const addObjectRouteFactories = (root, node, ancestors) => {
    const value = unwrap(node);
    if (!root || !value || value.type !== 'ObjectExpression') return false;
    let changed = false;
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = objectPropertyName(prop, state, ancestors);
      if (!key) return;
      const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${root}.${key}` : `${root}[${JSON.stringify(key)}]`;
      if (isRouteFactoryExpression(prop.value, ancestors)) {
        changed = addRouteFactory(path, prop.value, ancestors) || changed;
        changed = addThisRouteFactory(key, prop.value, value) || changed;
      }
      changed = addObjectRouteFactories(path, prop.value, ancestors) || changed;
    });
    return changed;
  };
  const addPatternAliases = (pattern, source, node, ancestors) => {
    const patternValue = unwrap(pattern);
    const sourceValue = unwrap(source);
    if (!patternValue) return false;
    if (patternValue.type === 'Identifier') {
      return isRouteFactoryExpression(sourceValue, ancestors)
        ? addRouteFactory(patternValue.name, node || patternValue, ancestors)
        : false;
    }
    if (patternValue.type === 'AssignmentPattern') {
      return addPatternAliases(patternValue.left, sourceValue || patternValue.right, node, ancestors);
    }
    if (patternValue.type === 'ObjectPattern') {
      const root = memberPathResolved(sourceValue, state, ancestors) || memberPath(sourceValue);
      let changed = false;
      patternValue.properties.forEach((prop) => {
        if (!prop || prop.type !== 'Property') return;
        const key = objectPropertyName(prop, state, ancestors);
        if (!key || !root) return;
        const member = {
          type: 'MemberExpression',
          object: sourceValue,
          property: { type: 'Literal', value: key, start: prop.key.start, end: prop.key.end },
          computed: true,
          optional: false,
          start: sourceValue.start,
          end: prop.end
        };
        changed = addPatternAliases(prop.value, member, prop.value, ancestors) || changed;
      });
      return changed;
    }
    return false;
  };
  let pass = 0;
  let changed = true;
  while (changed && pass < 4) {
    changed = false;
    pass += 1;
    walk(ast, (node, ancestors) => {
      if (node.type === 'FunctionDeclaration' && node.id && functionReturnsRelativeUrl(node, localFacts)) {
        changed = addRouteFactory(node.id.name, node.id, ancestors, { hoisted: true }) || changed;
      }
      if (node.type === 'VariableDeclarator') {
        changed = addPatternAliases(node.id, node.init, node.id, ancestors) || changed;
        if (node.id.type === 'Identifier')
          changed = addObjectRouteFactories(node.id.name, node.init, ancestors) || changed;
      }
      if (node.type === 'AssignmentExpression') {
        const left = memberPathResolved(node.left, state, ancestors) || memberPath(node.left);
        if (left && isRouteFactoryExpression(node.right, ancestors)) {
          changed = addRouteFactory(left, node.left, ancestors) || changed;
        }
        changed = addObjectRouteFactories(left, node.right, ancestors) || changed;
      }
      if (node.type === 'ExportDefaultDeclaration') {
        changed = addObjectRouteFactories('default', node.declaration, ancestors) || changed;
      }
      if (node.type === 'CallExpression') {
        const callee = memberPathResolved(node.callee, state, ancestors) || memberPath(node.callee);
        if (callee === 'Object.assign') {
          const target = memberPathResolved(node.arguments[0], state, ancestors) || memberPath(node.arguments[0]);
          (node.arguments || []).slice(1).forEach((source) => {
            changed = addObjectRouteFactories(target, source, ancestors) || changed;
          });
        }
        if (callee === 'Reflect.set') {
          const target = memberPathResolved(node.arguments[0], state, ancestors) || memberPath(node.arguments[0]);
          const key = expressionStringValue(node.arguments[1], state, ancestors);
          const right = node.arguments[2];
          if (target && key && isRouteFactoryExpression(right, ancestors)) {
            const path = /^[A-Za-z_$][\w$]*$/.test(key) ? `${target}.${key}` : `${target}[${JSON.stringify(key)}]`;
            changed = addRouteFactory(path, right, ancestors) || changed;
          }
        }
      }
    });
  }
}

function createScanState(ast, path, context) {
  const importedFacts = collectImportedFacts(ast, path, context);
  const localFacts = collectLocalFacts(ast, importedFacts);
  const routeKeyAliases = new Set([...localFacts.route, ...importedFacts.route]);
  const externalAliases = new Set([...localFacts.external, ...importedFacts.external]);
  const routeFactories = new Set([...localFacts.factories, ...importedFacts.factories]);
  const routeQueryFactories = new Set([...localFacts.routeQueryFactories, ...importedFacts.routeQueryFactories]);
  const urlConstructorAliases = new Set([...localFacts.urlConstructors, ...importedFacts.urlConstructors]);
  const urlSearchParamsConstructorAliases = new Set([
    ...localFacts.urlSearchParamsConstructors,
    ...importedFacts.urlSearchParamsConstructors
  ]);
  const routeFactoryArgIndexes = new Map();
  const addRouteFactoryArgIndexes = (facts) => {
    (facts.routeFactoryArgs || new Map()).forEach((indexes, alias) => {
      const existing = routeFactoryArgIndexes.get(alias) || new Set();
      indexes.forEach((index) => existing.add(index));
      routeFactoryArgIndexes.set(alias, existing);
    });
  };
  addRouteFactoryArgIndexes(localFacts);
  addRouteFactoryArgIndexes(importedFacts);
  const routeUrlMutatorArgIndexes = new Map();
  const addRouteUrlMutatorIndexes = (facts) => {
    (facts.routeUrlMutators || new Map()).forEach((indexes, alias) => {
      const existing = routeUrlMutatorArgIndexes.get(alias) || new Set();
      indexes.forEach((index) => existing.add(index));
      routeUrlMutatorArgIndexes.set(alias, existing);
    });
  };
  addRouteUrlMutatorIndexes(localFacts);
  addRouteUrlMutatorIndexes(importedFacts);
  const routeUrlMutatorAliases = new Set(routeUrlMutatorArgIndexes.keys());
  const state = {
    routeKeyAliases,
    externalAliases,
    routeFactories,
    routeFactoryArgAliases: new Set(routeFactoryArgIndexes.keys()),
    routeFactoryArgIndexes,
    routeQueryFactories,
    routeUrlAliases: new Set(),
    searchParamsAliases: new Set(),
    routeQueryAliases: new Set(),
    urlSearchParamsAliases: new Set(),
    urlConstructorAliases,
    urlSearchParamsConstructorAliases,
    boundSearchParamsMutatorAliases: new Set(),
    routeUrlMutatorAliases,
    routeUrlMutatorArgIndexes,
    bindings: collectBindings(ast, {
      route: routeKeyAliases,
      external: externalAliases,
      factories: routeFactories,
      routeQueryFactories,
      routeFactoryArgs: routeFactoryArgIndexes,
      urlConstructors: urlConstructorAliases,
      urlSearchParamsConstructors: urlSearchParamsConstructorAliases,
      routeUrlMutators: routeUrlMutatorArgIndexes
    })
  };
  collectConstructorAliases(ast, state);
  collectStringAliases(ast, state);
  collectStateExternalAliases(ast, state);
  collectRouteFactories(ast, state);
  collectRouteUrlAliases(ast, state);
  collectSearchParamsAliases(ast, state);
  collectRouteQueryFactories(ast, state);
  collectRouteQueryAliases(ast, state);
  collectBoundSearchParamsMutators(ast, state);
  collectRouteUrlMutators(ast, state);
  return state;
}

function shouldScanExecutableRouteCode(path) {
  return /\.(?:js|mjs|cjs|html?|svg)$/i.test(safeString(path));
}

export function containsForbiddenV4RouteConstructionAst(source, contextSource = source) {
  const context = normalizeRouteGuardContext(contextSource, source);
  if (!shouldScanExecutableRouteCode(context.path || 'module.js')) return false;
  const ast = parseRouteGuardAst(source);
  if (!ast) return true;
  const state = createScanState(ast, context.path || 'module.js', context);
  let forbidden = false;
  walk(ast, (node, ancestors) => {
    if (forbidden) return;
    if (node.type === 'CallExpression') {
      const info = mutatorCallInfo(node, state, ancestors);
      if (info && expressionIsRouteKey(info.args[0], state, ancestors)) forbidden = true;
      if (!forbidden && callUsesRouteUrlMutator(node, state, ancestors)) forbidden = true;
      if (!forbidden && callUsesPublicRouteHref(node, state, ancestors)) forbidden = true;
      if (
        !forbidden &&
        (node.arguments || []).some((arg) => expressionSerializesPublicRouteQuery(arg, state, ancestors))
      )
        forbidden = true;
      return;
    }
    if (node.type === 'NewExpression') {
      if (newUrlConstructsPublicRoute(node, state, ancestors)) {
        forbidden = true;
        return;
      }
      if (
        !calleeIsUrlConstructor(node.callee, state, ancestors) &&
        (node.arguments || []).some((arg) => expressionSerializesPublicRouteQuery(arg, state, ancestors))
      ) {
        forbidden = true;
      }
      return;
    }
    if (node.type === 'AssignmentExpression') {
      const left = unwrap(node.left);
      if (left && left.type === 'MemberExpression' && memberPropertyName(left, state, ancestors) === 'search') {
        const ownerIsRouteUrl =
          expressionIsRelativeUrl(left.object, state, ancestors) ||
          memberPath(left.object) === 'location' ||
          memberPath(left.object) === 'window.location' ||
          memberPath(left.object) === 'globalThis.location';
        const ownerIsExternalUrl = expressionIsExternalUrl(left.object, state, ancestors);
        if (
          ownerIsRouteUrl &&
          (expressionIsRouteQuery(node.right, state, ancestors) ||
            expressionSerializesPublicRouteQuery(node.right, state, ancestors))
        )
          forbidden = true;
        if (
          !forbidden &&
          !ownerIsExternalUrl &&
          expressionIsDirectSearchSinkOwner(left.object) &&
          (expressionIsRouteQuery(node.right, state, ancestors) ||
            expressionSerializesPublicRouteQuery(node.right, state, ancestors))
        )
          forbidden = true;
        if (ownerIsRouteUrl || ownerIsExternalUrl) return;
      }
      if (!forbidden && expressionSerializesPublicRouteQuery(node.right, state, ancestors)) forbidden = true;
      return;
    }
    if (node.type === 'VariableDeclarator' && expressionSerializesPublicRouteQuery(node.init, state, ancestors)) {
      forbidden = true;
      return;
    }
    if (node.type === 'AssignmentExpression' && expressionSerializesPublicRouteQuery(node.right, state, ancestors)) {
      forbidden = true;
      return;
    }
    if (node.type === 'ReturnStatement' && expressionSerializesPublicRouteQuery(node.argument, state, ancestors)) {
      forbidden = true;
      return;
    }
    if (
      node.type === 'ArrowFunctionExpression' &&
      node.body &&
      node.body.type !== 'BlockStatement' &&
      expressionSerializesPublicRouteQuery(node.body, state, ancestors)
    ) {
      forbidden = true;
      return;
    }
    if (node.type === 'Property' && expressionSerializesPublicRouteQuery(node.value, state, ancestors)) {
      forbidden = true;
      return;
    }
    if (
      node.type === 'ArrayExpression' &&
      (node.elements || []).some((element) => expressionSerializesPublicRouteQuery(element, state, ancestors))
    ) {
      forbidden = true;
    }
  });
  return forbidden;
}

export function containsForbiddenV4RouteConstruction(source, contextSource = source) {
  const context = normalizeRouteGuardContext(contextSource, source);
  const explicitHtmlPath = /\.(?:html?|svg)$/iu.test(context.path);
  const parsedJavaScript = explicitHtmlPath ? null : parseRouteGuardAst(source);
  if (explicitHtmlPath || (!parsedJavaScript && isV4HtmlRouteGuardSource(context.path, source))) {
    return containsForbiddenV4HtmlRouteConstruction(source, {
      scanJavaScript: (scriptSource) =>
        containsForbiddenV4RouteConstructionAst(scriptSource, {
          path: inlineRouteGuardPath(context.path),
          files: context.files
        })
    });
  }
  return containsForbiddenV4RouteConstructionAst(source, context);
}

export function canParseV4RouteGuardSource(source) {
  return Boolean(parseRouteGuardAst(source));
}

export function collectV4RouteGuardFacts(source, contextSource = source) {
  const context = normalizeRouteGuardContext(contextSource, source);
  const ast = parseRouteGuardAst(source);
  if (!ast) {
    return {
      routeKeyAliases: new Set(),
      externalAliases: new Set(),
      routeUrlFactoryAliases: new Set()
    };
  }
  const state = createScanState(ast, context.path || 'module.js', context);
  return {
    routeKeyAliases: new Set(state.routeKeyAliases),
    externalAliases: new Set(state.externalAliases),
    routeUrlFactoryAliases: new Set(state.routeFactories)
  };
}
