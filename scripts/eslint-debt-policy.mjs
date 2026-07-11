import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
let Linter;

function createLinter() {
  if (!Linter) ({ Linter } = require('eslint'));
  return new Linter({ configType: 'flat' });
}

export const BASELINE_DECISION = 'exact-semantic-owner-context-baseline-with-zero-growth';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizePath(filePath, repoRoot) {
  const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');
  assert(relativePath && !relativePath.startsWith('../'), `ESLint diagnostic escaped the repository: ${filePath}`);
  return relativePath;
}

function unwrap(node) {
  let current = node;
  while (current?.type === 'ChainExpression') current = current.expression;
  return current;
}

const NON_SEMANTIC_AST_KEYS = new Set(['comments', 'end', 'extra', 'loc', 'parent', 'range', 'raw', 'start', 'tokens']);

function semanticAstValue(value) {
  if (typeof value === 'bigint') return `${value}n`;
  if (Array.isArray(value)) {
    return value.filter((entry) => entry?.type !== 'EmptyStatement').map(semanticAstValue);
  }
  if (!value || typeof value !== 'object') return value;
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

function memberPropertyName(node) {
  const current = unwrap(node);
  if (current?.type !== 'MemberExpression') return '';
  if (!current.computed && current.property?.type === 'Identifier') return current.property.name;
  if (current.property?.type === 'Literal' && typeof current.property.value === 'string') {
    return current.property.value;
  }
  return '';
}

function expressionLabel(node, sourceCode) {
  const current = unwrap(node);
  if (current?.type === 'Identifier') return current.name;
  if (current?.type === 'ThisExpression') return 'this';
  if (current?.type === 'Literal') return `literal:${JSON.stringify(current.value)}`;
  if (current?.type === 'TemplateLiteral' && current.expressions.length === 0) {
    return `literal:${JSON.stringify(current.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(''))}`;
  }
  if (current?.type === 'MemberExpression') {
    if (current.computed) {
      return `${expressionLabel(current.object, sourceCode)}[${semanticNodeLabel(current.property)}]`;
    }
    return `${expressionLabel(current.object, sourceCode)}.${memberPropertyName(current)}`;
  }
  if (current?.type === 'CallExpression') {
    const argumentsLabel = current.arguments.map(semanticCallArgumentLabel).join(', ');
    return `${expressionLabel(current.callee, sourceCode)}(${argumentsLabel})`;
  }
  return semanticNodeLabel(current);
}

function isFunctionLike(node) {
  const current = unwrap(node);
  return ['ArrowFunctionExpression', 'FunctionExpression'].includes(current?.type);
}

function semanticCallArgumentLabel(argument) {
  const current = unwrap(argument);
  if (isFunctionLike(current)) return `<callback:${current.type}>`;
  return semanticNodeLabel(current);
}

function structuralNodeSignature(node, sourceCode) {
  const current = unwrap(node);
  if (!current) return '(missing)';
  if (current.type === 'ImportDeclaration') {
    return `import:${semanticNodeLabel(current.source)}`;
  }
  if (current.type === 'ExportNamedDeclaration' || current.type === 'ExportDefaultDeclaration') {
    if (current.declaration) return `export:${structuralNodeSignature(current.declaration, sourceCode)}`;
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
      return `${current.type}:call:${expressionLabel(expression, sourceCode)}`;
    }
  }
  if (current.type === 'IfStatement' || current.type === 'WhileStatement' || current.type === 'DoWhileStatement') {
    return `${current.type}:${semanticNodeLabel(current.test)}`;
  }
  if (current.type === 'ForStatement') {
    return `${current.type}:${semanticNodeLabel({
      init: current.init,
      test: current.test,
      update: current.update
    })}`;
  }
  if (current.type === 'ForInStatement' || current.type === 'ForOfStatement') {
    return `${current.type}:${semanticNodeLabel(current.left)}:${semanticNodeLabel(current.right)}`;
  }
  if (current.type === 'SwitchCase') {
    return `${current.type}:${current.test ? semanticNodeLabel(current.test) : '<default>'}`;
  }
  if (current.type === 'TryStatement') {
    const tryOperations = current.block.body.map((statement) => structuralNodeSignature(statement, sourceCode));
    return `${current.type}:try:[${tryOperations.join(',')}]:catch:${semanticNodeLabel(
      current.handler?.param
    )}:finally:${current.finalizer ? 'yes' : 'no'}`;
  }
  if (current.type === 'Property' || current.type === 'MethodDefinition') {
    return `${current.type}:${propertyName(current) || '(computed)'}`;
  }
  return current.type;
}

function propertyName(property) {
  if (!property || (property.type !== 'Property' && property.type !== 'MethodDefinition')) return '';
  if (!property.computed && property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'Literal' && typeof property.key.value === 'string') return property.key.value;
  return semanticNodeLabel(property.key);
}

function diagnosticOwner(sourceCode, node) {
  const ancestors = sourceCode.getAncestors(node);
  const labels = [];
  for (let index = 0; index < ancestors.length; index += 1) {
    const candidate = ancestors[index];
    if (candidate.type === 'ClassDeclaration') {
      labels.push(`class:${candidate.id?.name || '<anonymous>'}`);
      continue;
    }
    if (!['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression'].includes(candidate.type)) {
      continue;
    }
    const parent = ancestors[index - 1];
    if (candidate.type === 'FunctionDeclaration') {
      labels.push(`function:${candidate.id?.name || '<anonymous>'}`);
    } else if (parent?.type === 'VariableDeclarator') {
      labels.push(`variable:${semanticNodeLabel(parent.id)}`);
    } else if (parent?.type === 'AssignmentExpression') {
      labels.push(`assignment:${semanticNodeLabel(parent.left)}`);
    } else if (parent?.type === 'Property') {
      labels.push(`property:${propertyName(parent) || '(computed)'}`);
    } else if (parent?.type === 'MethodDefinition') {
      labels.push(`method:${propertyName(parent) || '(computed)'}`);
    } else if (candidate.type === 'FunctionExpression' && candidate.id?.name) {
      labels.push(`function:${candidate.id.name}`);
    } else {
      labels.push(`anonymous:${candidate.type}`);
    }
    if (parent?.type === 'CallExpression') {
      const argumentIndex = parent.arguments.indexOf(candidate);
      if (argumentIndex >= 0) {
        const callArguments = parent.arguments
          .map((argument, index) => (index === argumentIndex ? '<callback>' : semanticCallArgumentLabel(argument)))
          .join(', ');
        labels.push(`callback:${expressionLabel(parent.callee, sourceCode)}(${callArguments})#${argumentIndex + 1}`);
      }
    }
  }
  return labels.join('/') || '<module>';
}

function diagnosticStructuralContext(sourceCode, node) {
  const chain = [...sourceCode.getAncestors(node), node];
  const segments = [];
  for (let index = 0; index < chain.length - 1; index += 1) {
    const parent = chain[index];
    const child = chain[index + 1];
    const visitorKeys = sourceCode.visitorKeys[parent.type] || [];
    let segment = child.type;
    for (const key of visitorKeys) {
      const value = parent[key];
      if (value === child) {
        segment = key;
        break;
      }
      if (Array.isArray(value)) {
        const childIndex = value.indexOf(child);
        if (childIndex >= 0) {
          const signature = structuralNodeSignature(child, sourceCode);
          const semanticOrdinal =
            value
              .slice(0, childIndex + 1)
              .filter((sibling) => structuralNodeSignature(sibling, sourceCode) === signature).length || 1;
          segment = `${key}:${signature}#${semanticOrdinal}`;
          break;
        }
      }
    }
    segments.push(segment);
  }
  return segments.join('/');
}

function diagnosticSemanticAnchor(sourceCode, node, message) {
  if (message.ruleId !== 'no-useless-assignment') return node;
  const ancestors = sourceCode.getAncestors(node);
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const candidate = ancestors[index];
    if (
      candidate.type === 'AssignmentExpression' ||
      candidate.type === 'VariableDeclarator' ||
      candidate.type === 'PropertyDefinition'
    ) {
      return candidate;
    }
  }
  return node;
}

function diagnosticFingerprint({ anchor, filePath, message, owner, ownerPath }) {
  const context = `${anchor.type}:${semanticNodeLabel(anchor)}`;
  const payload = [
    filePath,
    message.ruleId,
    message.messageId || '(none)',
    message.message,
    owner,
    ownerPath,
    context
  ].join('\0');
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

function diagnosticCoreKey(entry) {
  return JSON.stringify([
    entry.rule,
    entry.path,
    entry.messageId,
    entry.message,
    entry.owner,
    entry.ownerPath,
    entry.fingerprint
  ]);
}

export function diagnosticKey(entry) {
  return JSON.stringify([diagnosticCoreKey(entry), entry.occurrence]);
}

function compareDiagnostics(left, right) {
  return diagnosticKey(left).localeCompare(diagnosticKey(right));
}

export function normalizeDiagnostics(rows, reviewedRules, repoRoot) {
  const rules = new Set(reviewedRules);
  const rawDiagnostics = [];
  for (const row of rows) {
    const relativePath = normalizePath(row.filePath, repoRoot);
    if (!row.messages?.length) continue;
    const linter = createLinter();
    linter.verify(row.source, [{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } }], {
      filename: relativePath
    });
    const sourceCode = linter.getSourceCode();
    assert(sourceCode, `cannot parse ESLint debt source: ${relativePath}`);
    for (const message of row.messages) {
      assert(rules.has(message.ruleId), `excluded-rule probe produced unexpected rule ${message.ruleId || '(none)'}`);
      assert(message.severity === 2, `excluded-rule probe produced non-error severity for ${message.ruleId}`);
      const start = sourceCode.getIndexFromLoc({ line: message.line, column: message.column - 1 });
      const node =
        sourceCode.getNodeByRangeIndex(Math.min(start, Math.max(0, row.source.length - 1))) || sourceCode.ast;
      const owner = diagnosticOwner(sourceCode, node);
      const ownerPath = diagnosticStructuralContext(sourceCode, node);
      const anchor = diagnosticSemanticAnchor(sourceCode, node, message);
      rawDiagnostics.push({
        rule: message.ruleId,
        path: relativePath,
        messageId: message.messageId || '(none)',
        message: message.message,
        owner,
        ownerPath,
        fingerprint: diagnosticFingerprint({
          anchor,
          filePath: relativePath,
          message,
          owner,
          ownerPath
        }),
        start,
        line: message.line,
        column: message.column
      });
    }
  }
  rawDiagnostics.sort((left, right) => left.start - right.start || compareDiagnostics(left, right));
  const occurrences = new Map();
  return rawDiagnostics.map((rawDiagnostic) => {
    const diagnostic = { ...rawDiagnostic };
    delete diagnostic.start;
    const identity = diagnosticCoreKey(diagnostic);
    const occurrence = (occurrences.get(identity) || 0) + 1;
    occurrences.set(identity, occurrence);
    return { ...diagnostic, occurrence };
  });
}

export function baselineDiagnostics(diagnostics) {
  return diagnostics
    .map((diagnostic) => {
      const baselineDiagnostic = { ...diagnostic };
      delete baselineDiagnostic.line;
      delete baselineDiagnostic.column;
      return baselineDiagnostic;
    })
    .sort(compareDiagnostics);
}

export function createBaseline(diagnostics, reviewedRules) {
  return {
    schemaVersion: 1,
    decision: BASELINE_DECISION,
    rules: [...reviewedRules],
    diagnostics: baselineDiagnostics(diagnostics)
  };
}

function countKeys(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const key = diagnosticKey(entry);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function compareExact(actual, expected) {
  const actualCounts = countKeys(actual);
  const expectedCounts = countKeys(expected);
  const errors = [];
  for (const [key, count] of actualCounts) {
    const expectedCount = expectedCounts.get(key) || 0;
    if (count > expectedCount) errors.push(`unreviewed diagnostic (${count - expectedCount} extra): ${key}`);
  }
  for (const [key, count] of expectedCounts) {
    const actualCount = actualCounts.get(key) || 0;
    if (actualCount < count) errors.push(`baseline diagnostic missing (${count - actualCount} missing): ${key}`);
  }
  return errors.sort();
}

export function compareNoGrowth(head, base) {
  const headCounts = countKeys(head);
  const baseCounts = countKeys(base);
  const errors = [];
  for (const [key, count] of headCounts) {
    const baseCount = baseCounts.get(key) || 0;
    if (count > baseCount) errors.push(`new excluded-rule debt (${count - baseCount} extra): ${key}`);
  }
  return errors.sort();
}

export function validateRuleTransition(baseRules, headRules) {
  const base = new Set(baseRules);
  return headRules
    .filter((rule) => !base.has(rule))
    .sort()
    .map((rule) => `new excluded ESLint rule requires merge-base rescan and explicit review: ${rule}`);
}

export function validateBaseline(baseline, reviewedRules) {
  assert(
    baseline && typeof baseline === 'object' && !Array.isArray(baseline),
    'ESLint debt baseline must be an object'
  );
  assert(baseline.schemaVersion === 1, 'ESLint debt baseline schemaVersion must equal 1');
  assert(baseline.decision === BASELINE_DECISION, `ESLint debt baseline decision must equal ${BASELINE_DECISION}`);
  assert(Array.isArray(baseline.rules), 'ESLint debt baseline rules must be an array');
  assert(
    JSON.stringify([...baseline.rules].sort()) === JSON.stringify([...reviewedRules].sort()),
    'ESLint debt baseline rule set drift'
  );
  assert(Array.isArray(baseline.diagnostics), 'ESLint debt baseline diagnostics must be an array');
  assert(
    JSON.stringify(baseline.diagnostics) === JSON.stringify([...baseline.diagnostics].sort(compareDiagnostics)),
    'ESLint debt baseline diagnostics must stay deterministically sorted'
  );
  const keys = baseline.diagnostics.map(diagnosticKey);
  assert(new Set(keys).size === keys.length, 'ESLint debt baseline diagnostics must be unique');
  const occurrenceGroups = new Map();
  for (const [index, entry] of baseline.diagnostics.entries()) {
    assert(reviewedRules.includes(entry.rule), `ESLint debt baseline diagnostics[${index}] has an unreviewed rule`);
    assert(typeof entry.path === 'string' && entry.path, `ESLint debt baseline diagnostics[${index}] needs a path`);
    assert(
      typeof entry.messageId === 'string' && entry.messageId,
      `ESLint debt baseline diagnostics[${index}] needs a messageId`
    );
    assert(
      typeof entry.message === 'string' && entry.message,
      `ESLint debt baseline diagnostics[${index}] needs a message`
    );
    assert(typeof entry.owner === 'string' && entry.owner, `ESLint debt baseline diagnostics[${index}] needs an owner`);
    assert(
      typeof entry.ownerPath === 'string' && entry.ownerPath,
      `ESLint debt baseline diagnostics[${index}] needs an ownerPath`
    );
    assert(
      /^sha256:[a-f0-9]{64}$/u.test(entry.fingerprint),
      `ESLint debt baseline diagnostics[${index}] needs a fingerprint`
    );
    assert(
      Number.isInteger(entry.occurrence) && entry.occurrence > 0,
      `ESLint debt baseline diagnostics[${index}] occurrence invalid`
    );
    assert(
      !Object.hasOwn(entry, 'line') && !Object.hasOwn(entry, 'column'),
      `ESLint debt baseline diagnostics[${index}] must not store unstable line evidence`
    );
    const expectedKeys = ['fingerprint', 'message', 'messageId', 'occurrence', 'owner', 'ownerPath', 'path', 'rule'];
    assert(
      JSON.stringify(Object.keys(entry).sort()) === JSON.stringify(expectedKeys),
      `ESLint debt baseline diagnostics[${index}] has unsupported or missing evidence fields`
    );
    const core = diagnosticCoreKey(entry);
    const occurrences = occurrenceGroups.get(core) || [];
    occurrences.push(entry.occurrence);
    occurrenceGroups.set(core, occurrences);
  }
  for (const occurrences of occurrenceGroups.values()) {
    occurrences.sort((left, right) => left - right);
    assert(
      occurrences.every((occurrence, index) => occurrence === index + 1),
      'ESLint debt baseline duplicate occurrences must be contiguous from 1'
    );
  }
}
