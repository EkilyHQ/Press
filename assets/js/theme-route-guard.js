import { parse } from './vendor/acorn.mjs';
import { fullAncestor } from './vendor/acorn-walk.mjs';

const ROUTE_KEYS = new Set(['tab', 'id']);
const URL_MUTATORS = new Set(['set', 'append', 'delete']);

function safeString(value) {
  return value == null ? '' : String(value);
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
  while (value && (
    value.type === 'ChainExpression'
    || value.type === 'ParenthesizedExpression'
    || value.type === 'TSNonNullExpression'
  )) {
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
  const text = safeString(value).trim();
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

function expressionHasRouteQueryLiteral(node) {
  const value = literalStringValue(node);
  if (value == null) return false;
  const re = /[?&]([^=&#\s]+)\s*=/g;
  let match = re.exec(value);
  while (match) {
    if (isRouteKey(match[1]) && !isExternalUrlPrefix(value.slice(0, match.index))) return true;
    match = re.exec(value);
  }
  return false;
}

function expressionStaticKind(node) {
  const value = literalStringValue(node);
  if (value == null) return '';
  if (isRouteKey(value)) return 'route';
  if (isExternalUrlPrefix(value)) return 'external';
  return '';
}

function addExpressionAliases(out, name, node) {
  if (!name || !node) return;
  const value = unwrap(node);
  const kind = expressionStaticKind(value);
  if (kind === 'route') out.route.add(name);
  if (kind === 'external') out.external.add(name);
  if (newUrlHasStaticExternalArg(value)) out.external.add(name);
  if (value && value.type === 'ObjectExpression') {
    value.properties.forEach((prop) => {
      if (!prop || prop.type !== 'Property') return;
      const key = propertyName(prop.key);
      if (!key) return;
      addExpressionAliases(out, /^[A-Za-z_$][\w$]*$/.test(key) ? `${name}.${key}` : `${name}[${JSON.stringify(key)}]`, prop.value);
    });
  }
}

function addObjectMemberAliases(out, node) {
  const value = unwrap(node);
  if (!value || value.type !== 'ObjectExpression') return;
  value.properties.forEach((prop) => {
    if (!prop || prop.type !== 'Property') return;
    const key = propertyName(prop.key);
    if (!key) return;
    addExpressionAliases(out, key, prop.value);
  });
}

function functionReturnsRelativeUrl(node, localFacts = null) {
  const value = unwrap(node);
  if (!value || !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(value.type)) return false;
  if (value.type === 'ArrowFunctionExpression' && value.body && value.body.type !== 'BlockStatement') {
    return expressionIsRelativeUrl(value.body, { routeUrlAliases: new Set(), routeFactories: new Set(), externalAliases: localFacts ? localFacts.external : new Set(), routeKeyAliases: new Set(), bindings: [] }, []);
  }
  let found = false;
  walk(value.body, (child) => {
    if (found || !child || child.type !== 'ReturnStatement' || !child.argument) return;
    if (expressionIsRelativeUrl(child.argument, { routeUrlAliases: new Set(), routeFactories: new Set(), externalAliases: localFacts ? localFacts.external : new Set(), routeKeyAliases: new Set(), bindings: [] }, [])) {
      found = true;
    }
  });
  return found;
}

function newUrlHasStaticExternalArg(node) {
  const value = unwrap(node);
  if (!value || value.type !== 'NewExpression' || !calleeIsUrlConstructor(value.callee)) return false;
  return isExternalUrlPrefix(literalStringValue(value.arguments[0]))
    || isExternalUrlPrefix(literalStringValue(value.arguments[1]));
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
    factories: new Set()
  };
}

function addMappedAliases(out, sourceFacts, importedName, localName) {
  const imported = safeString(importedName);
  const local = safeString(localName);
  if (!imported || !local) return;
  ['route', 'external', 'factories'].forEach((kind) => {
    sourceFacts[kind].forEach((alias) => {
      if (alias === imported) out[kind].add(local);
      const suffix = memberPathSuffix(alias, imported);
      if (suffix) out[kind].add(joinMemberPath(local, suffix));
    });
  });
}

function mergeFacts(target, source) {
  ['route', 'external', 'factories'].forEach((kind) => {
    source[kind].forEach((alias) => target[kind].add(alias));
  });
}

function collectLocalFacts(ast, baseFacts = null) {
  const facts = createFacts();
  if (baseFacts && baseFacts.external) {
    baseFacts.external.forEach((alias) => facts.external.add(alias));
  }
  walk(ast, (node, ancestors) => {
    if (!node) return;
    if (node.type === 'VariableDeclarator') {
      const names = bindingNames(node.id);
      names.forEach((name) => addExpressionAliases(facts, name, node.init));
      if (isTopLevelFact(ancestors) && names.length === 1 && functionReturnsRelativeUrl(node.init, facts)) facts.factories.add(names[0]);
    }
    if (isTopLevelFact(ancestors) && node.type === 'FunctionDeclaration' && node.id && functionReturnsRelativeUrl(node, facts)) {
      facts.factories.add(node.id.name);
    }
    if (isTopLevelFact(ancestors) && node.type === 'Property' && node.value && functionReturnsRelativeUrl(node.value, facts)) {
      const parent = ancestors[ancestors.length - 2];
      const key = propertyName(node.key);
      if (parent && parent.type === 'ObjectExpression' && key) {
        const declarator = ancestors.slice().reverse().find((candidate) => candidate.type === 'VariableDeclarator');
        if (declarator && declarator.id && declarator.id.type === 'Identifier') {
          facts.factories.add(`${declarator.id.name}.${key}`);
        }
      }
    }
  });
  return facts;
}

function isTopLevelFact(ancestors) {
  const parent = ancestors[ancestors.length - 2];
  const grandparent = ancestors[ancestors.length - 3];
  return Boolean(parent && (
    parent.type === 'Program'
    || parent.type === 'ExportNamedDeclaration'
    || parent.type === 'ExportDefaultDeclaration'
    || (parent.type === 'VariableDeclaration' && grandparent && (
      grandparent.type === 'Program' || grandparent.type === 'ExportNamedDeclaration'
    ))
  ));
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
  const out = createFacts();
  const addLocalExport = (localName, exportedName) => addMappedAliases(out, exportableFacts, localName, exportedName);
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
        addExpressionAliases(out, 'default', node.declaration);
        if (functionReturnsRelativeUrl(node.declaration, localFacts)) out.factories.add('default');
        if (node.declaration && node.declaration.type === 'Identifier') addLocalExport(node.declaration.name, 'default');
      }
      if (node.type === 'ExportAllDeclaration') {
        const targetPath = resolveImportPath(file.path, node.source && node.source.value);
        const target = targetPath ? context.files.find((entry) => entry.path === targetPath) : null;
        if (!target) return;
        const targetFacts = collectExportedFacts(target, context, seen, cache);
        if (node.exported) {
          const exported = propertyName(node.exported);
          ['route', 'external', 'factories'].forEach((kind) => {
            targetFacts[kind].forEach((alias) => out[kind].add(joinMemberPath(exported, alias.startsWith('[') ? alias : `.${alias}`)));
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
        const targetPath = resolveImportPath(file.path, node.right.arguments[0].value);
        const target = targetPath ? context.files.find((entry) => entry.path === targetPath) : null;
        if (target) mergeFacts(out, collectExportedFacts(target, context, seen, cache));
        return;
      }
      if (left === 'module.exports') {
        addExpressionAliases(out, 'default', node.right);
        addObjectMemberAliases(out, node.right);
        if (functionReturnsRelativeUrl(node.right, localFacts)) out.factories.add('default');
        return;
      }
      if (left.startsWith('exports.')) addExpressionAliases(out, left.slice('exports.'.length), node.right);
      if (left.startsWith('module.exports.')) addExpressionAliases(out, left.slice('module.exports.'.length), node.right);
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
        ['route', 'external', 'factories'].forEach((kind) => {
          sourceFacts[kind].forEach((alias) => out[kind].add(joinMemberPath(spec.local.name, alias.startsWith('[') ? alias : `.${alias}`)));
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
      ['route', 'external', 'factories'].forEach((kind) => {
        sourceFacts[kind].forEach((alias) => {
          if (alias === 'default') out[kind].add(node.id.name);
          const defaultSuffix = memberPathSuffix(alias, 'default');
          if (defaultSuffix) out[kind].add(joinMemberPath(node.id.name, defaultSuffix));
          out[kind].add(joinMemberPath(node.id.name, alias.startsWith('[') ? alias : `.${alias}`));
        });
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
  return Boolean(value
    && value.type === 'CallExpression'
    && unwrap(value.callee).type === 'Identifier'
    && unwrap(value.callee).name === 'require'
    && value.arguments.length
    && typeof value.arguments[0].value === 'string');
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

function collectBindings(ast, baseFacts) {
  const bindings = [];
  walk(ast, (node, ancestors) => {
    if (node.type !== 'VariableDeclarator') return;
    const scope = nearestBindingScope(ancestors);
    bindingNames(node.id).forEach((name) => {
      let kind = 'unknown';
      if (node.id.type === 'Identifier') {
        const exprKind = expressionStaticKind(node.init);
        if (exprKind) kind = exprKind;
        else if (newUrlHasStaticExternalArg(node.init)) kind = 'external';
        else if (isRequireCall(node.init)) kind = 'object';
        else if (unwrap(node.init) && unwrap(node.init).type === 'ObjectExpression') kind = 'object';
      }
      const defaultKinds = collectPatternDefaultKinds(node.id);
      const defaultKind = defaultKinds.find((entry) => entry.name === name);
      defaultKinds.forEach((entry) => bindings.push({ ...entry, start: node.start, end: scope.end }));
      bindings.push({ name, kind: defaultKind ? defaultKind.kind : kind, start: node.start, end: scope.end });
    });
  });
  baseFacts.route.forEach((name) => bindings.push({ name, kind: 'route', start: 0, end: Infinity }));
  baseFacts.external.forEach((name) => bindings.push({ name, kind: 'external', start: 0, end: Infinity }));
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
    if (!node || !['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node.type)) continue;
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
  let winner = null;
  state.bindings.forEach((binding) => {
    if (binding.name === name
      && binding.start <= index
      && (binding.end == null || index <= binding.end)
      && (!winner || binding.start >= winner.start)) winner = binding;
  });
  return winner ? winner.kind : '';
}

function expressionKind(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return '';
  const staticKind = expressionStaticKind(value);
  if (staticKind) return staticKind;
  if (value.type === 'Identifier') return bindingKindAt(value.name, state, ancestors, value.start);
  const path = memberPath(value);
  if (path) {
    const root = path.split(/[.\[]/, 1)[0];
    if (bindingKindAt(root, state, ancestors, value.start) === 'unknown') return '';
    if (state.routeKeyAliases.has(path)) return 'route';
    if (state.externalAliases.has(path)) return 'external';
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
  if (value.type === 'BinaryExpression' && value.operator === '+') {
    return expressionBuildsExternalUrl(value.left, state, ancestors)
      || (expressionIsExternalUrl(value.left, state, ancestors) && literalStringValue(value.right) != null);
  }
  if (value.type === 'TemplateLiteral') {
    const firstQuasi = value.quasis[0] && (value.quasis[0].value.cooked ?? value.quasis[0].value.raw ?? '');
    if (isExternalUrlPrefix(firstQuasi)) return true;
    return value.expressions.length > 0 && expressionIsExternalUrl(value.expressions[0], state, ancestors);
  }
  return false;
}

function expressionIsExternalUrl(node, state, ancestors) {
  return expressionKind(node, state, ancestors) === 'external'
    || expressionBuildsExternalUrl(node, state, ancestors);
}

function calleeIsUrlConstructor(node) {
  const path = memberPath(node);
  return path === 'URL' || path === 'window.URL' || path === 'globalThis.URL';
}

function newUrlIsExternal(node, state, ancestors) {
  if (!node || node.type !== 'NewExpression' || !calleeIsUrlConstructor(node.callee)) return false;
  const args = node.arguments || [];
  return expressionIsExternalUrl(args[0], state, ancestors) || expressionIsExternalUrl(args[1], state, ancestors);
}

function expressionIsLocationUrl(node) {
  const path = memberPath(node);
  return path === 'location'
    || path === 'location.href'
    || path === 'window.location'
    || path === 'window.location.href'
    || path === 'globalThis.location'
    || path === 'globalThis.location.href';
}

function newUrlIsRelativeRoute(node, state, ancestors) {
  if (!node || node.type !== 'NewExpression' || !calleeIsUrlConstructor(node.callee)) return false;
  if (newUrlIsExternal(node, state, ancestors)) return false;
  const args = node.arguments || [];
  if (args.length > 1) return expressionIsLocationUrl(args[1]) || expressionIsRelativeUrl(args[1], state, ancestors);
  return !expressionIsExternalUrl(args[0], state, ancestors);
}

function expressionIsRelativeUrl(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  if (value.type === 'AwaitExpression') return expressionIsRelativeUrl(value.argument, state, ancestors);
  if (value.type === 'NewExpression' && calleeIsUrlConstructor(value.callee)) return newUrlIsRelativeRoute(value, state, ancestors);
  const path = memberPath(value);
  if (path && state.routeUrlAliases.has(path)) return true;
  if (value.type === 'CallExpression') {
    const callee = memberPath(value.callee);
    if (callee && state.routeFactories.has(callee)) return true;
  }
  return false;
}

function collectRouteUrlAliases(ast, state) {
  walk(ast, (node, ancestors) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && expressionIsRelativeUrl(node.init, state, ancestors)) {
      state.routeUrlAliases.add(node.id.name);
    }
    if (node.type === 'AssignmentExpression' && expressionIsRelativeUrl(node.right, state, ancestors)) {
      const left = memberPath(node.left);
      if (left) state.routeUrlAliases.add(left);
    }
  });
}

function isSearchParamsAccess(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  const path = memberPath(value);
  if (path && state.searchParamsAliases.has(path)) return true;
  if (value.type === 'MemberExpression' && propertyName(value.property) === 'searchParams') {
    return expressionIsRelativeUrl(value.object, state, ancestors);
  }
  return false;
}

function collectSearchParamsAliases(ast, state) {
  walk(ast, (node, ancestors) => {
    if (node.type === 'VariableDeclarator') {
      if (node.id.type === 'Identifier' && isSearchParamsAccess(node.init, state, ancestors)) {
        state.searchParamsAliases.add(node.id.name);
      }
      if (node.id.type === 'ObjectPattern' && expressionIsRelativeUrl(node.init, state, ancestors)) {
        node.id.properties.forEach((prop) => {
          if (!prop || prop.type !== 'Property' || propertyName(prop.key) !== 'searchParams') return;
          bindingNames(prop.value).forEach((name) => state.searchParamsAliases.add(name));
        });
      }
    }
    if (node.type === 'AssignmentExpression' && isSearchParamsAccess(node.right, state, ancestors)) {
      const left = memberPath(node.left);
      if (left) state.searchParamsAliases.add(left);
    }
  });
}

function mutatorCallInfo(node, state, ancestors) {
  if (!node || node.type !== 'CallExpression') return null;
  const callee = unwrap(node.callee);
  if (!callee || callee.type !== 'MemberExpression') return null;
  const property = propertyName(callee.property);
  if (URL_MUTATORS.has(property) && isSearchParamsAccess(callee.object, state, ancestors)) {
    return { method: property, args: node.arguments || [] };
  }
  if ((property === 'call' || property === 'apply') && callee.object && unwrap(callee.object).type === 'MemberExpression') {
    const mutator = unwrap(callee.object);
    const mutatorName = propertyName(mutator.property);
    if (URL_MUTATORS.has(mutatorName) && isSearchParamsAccess(mutator.object, state, ancestors)) {
      const rawArgs = node.arguments || [];
      return property === 'apply'
        ? { method: mutatorName, args: rawArgs[1] && rawArgs[1].type === 'ArrayExpression' ? rawArgs[1].elements.filter(Boolean) : [] }
        : { method: mutatorName, args: rawArgs.slice(1) };
    }
  }
  return null;
}

function expressionBuildsRouteQuery(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  if (expressionHasRouteQueryLiteral(value)) return true;
  if (value.type === 'TemplateLiteral') {
    return value.expressions.some((expr) => expressionIsRouteKey(expr, state, ancestors));
  }
  if (value.type === 'BinaryExpression' && value.operator === '+') {
    if (expressionBuildsRouteQuery(value.left, state, ancestors) || expressionBuildsRouteQuery(value.right, state, ancestors)) return true;
    const left = literalStringValue(value.left);
    const right = literalStringValue(value.right);
    return (left === '?' && expressionIsRouteKey(value.right, state, ancestors))
      || (right === '=' && expressionIsRouteKey(value.left, state, ancestors));
  }
  if (value.type === 'NewExpression' && memberPath(value.callee).endsWith('URLSearchParams')) {
    const first = value.arguments[0];
    if (!first) return false;
    if (first.type === 'ObjectExpression') {
      return first.properties.some((prop) => prop && prop.type === 'Property' && isRouteKey(propertyName(prop.key)));
    }
    if (first.type === 'ArrayExpression') {
      return first.elements.some((item) => item && item.type === 'ArrayExpression' && item.elements.length && expressionIsRouteKey(item.elements[0], state, ancestors));
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

function expressionSerializesPublicRouteQuery(node, state, ancestors) {
  const value = unwrap(node);
  if (!value) return false;
  if (value.type === 'TemplateLiteral') {
    for (let i = 0; i < value.expressions.length; i += 1) {
      const before = value.quasis[i] && (value.quasis[i].value.cooked ?? value.quasis[i].value.raw ?? '');
      const after = value.quasis[i + 1] && (value.quasis[i + 1].value.cooked ?? value.quasis[i + 1].value.raw ?? '');
      const markerIndex = Math.max(safeString(before).lastIndexOf('?'), safeString(before).lastIndexOf('&'));
      const previousExpressionIsExternal = i > 0 && expressionIsExternalUrl(value.expressions[i - 1], state, ancestors);
      if (markerIndex >= 0
        && !previousExpressionIsExternal
        && !isExternalUrlPrefix(before.slice(0, markerIndex))
        && expressionIsRouteKey(value.expressions[i], state, ancestors)
        && safeString(after).trimStart().startsWith('=')) {
        return true;
      }
    }
    return false;
  }
  const parts = concatParts(value);
  let sawPublicQueryMarker = false;
  let staticPrefix = '';
  let previousWasExternalExpression = false;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const literal = literalStringValue(part);
    if (literal != null) {
      const markerIndex = Math.max(literal.lastIndexOf('?'), literal.lastIndexOf('&'));
      if (markerIndex >= 0) {
        const prefix = `${staticPrefix}${literal.slice(0, markerIndex)}`;
        if (!previousWasExternalExpression && !isExternalUrlPrefix(prefix)) sawPublicQueryMarker = true;
      }
      staticPrefix += literal;
      if (literal.trim()) previousWasExternalExpression = false;
      continue;
    }
    if (expressionIsRouteKey(part, state, ancestors)) {
      const nextLiteral = literalStringValue(parts[index + 1]);
      if (sawPublicQueryMarker && safeString(nextLiteral).trimStart().startsWith('=')) return true;
    }
    previousWasExternalExpression = expressionIsExternalUrl(part, state, ancestors);
    if (!previousWasExternalExpression) staticPrefix = '';
  }
  return false;
}

function collectRouteFactories(ast, state) {
  const localFacts = { external: state.externalAliases };
  walk(ast, (node, ancestors) => {
    if (!isTopLevelFact(ancestors)) return;
    if (node.type === 'FunctionDeclaration' && node.id && functionReturnsRelativeUrl(node, localFacts)) {
      state.routeFactories.add(node.id.name);
    }
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && functionReturnsRelativeUrl(node.init, localFacts)) {
      state.routeFactories.add(node.id.name);
    }
  });
}

function createScanState(ast, path, context) {
  const importedFacts = collectImportedFacts(ast, path, context);
  const localFacts = collectLocalFacts(ast, importedFacts);
  const routeKeyAliases = new Set([...localFacts.route, ...importedFacts.route]);
  const externalAliases = new Set([...localFacts.external, ...importedFacts.external]);
  const routeFactories = new Set([...localFacts.factories, ...importedFacts.factories]);
  const state = {
    routeKeyAliases,
    externalAliases,
    routeFactories,
    routeUrlAliases: new Set(),
    searchParamsAliases: new Set(),
    bindings: collectBindings(ast, { route: routeKeyAliases, external: externalAliases })
  };
  collectRouteFactories(ast, state);
  collectRouteUrlAliases(ast, state);
  collectSearchParamsAliases(ast, state);
  return state;
}

function shouldScanExecutableRouteCode(path) {
  return /\.(?:js|mjs|cjs|html?|svg)$/i.test(safeString(path));
}

export function containsForbiddenV4RouteConstructionAst(source, contextSource = source) {
  const context = normalizeRouteGuardContext(contextSource, source);
  if (!shouldScanExecutableRouteCode(context.path || 'module.js')) return false;
  const ast = parseRouteGuardAst(source);
  if (!ast) return false;
  const state = createScanState(ast, context.path || 'module.js', context);
  let forbidden = false;
  walk(ast, (node, ancestors) => {
    if (forbidden) return;
    if (node.type === 'CallExpression') {
      const info = mutatorCallInfo(node, state, ancestors);
      if (info && expressionIsRouteKey(info.args[0], state, ancestors)) forbidden = true;
      return;
    }
    if (node.type === 'AssignmentExpression') {
      const left = unwrap(node.left);
      if (left && left.type === 'MemberExpression' && propertyName(left.property) === 'search') {
        const ownerIsRouteUrl = expressionIsRelativeUrl(left.object, state, ancestors)
          || memberPath(left.object) === 'location'
          || memberPath(left.object) === 'window.location'
          || memberPath(left.object) === 'globalThis.location';
        if (ownerIsRouteUrl && expressionBuildsRouteQuery(node.right, state, ancestors)) forbidden = true;
      }
      return;
    }
    if (node.type === 'ReturnStatement' && expressionSerializesPublicRouteQuery(node.argument, state, ancestors)) {
      forbidden = true;
    }
  });
  return forbidden;
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
