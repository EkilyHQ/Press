import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parse } from '../assets/js/vendor/acorn.mjs';
import { ancestor, simple } from '../assets/js/vendor/acorn-walk.mjs';

export const OWNER_LINE_CAP = 1800;
export const OWNER_SOURCE_CAP = 24;
export const SUPPORT_LINE_CAP = 300;
export const POLICY_PATH = 'scripts/composer-identity-ownership-policy.json';
export const POLICY_CORE_PATH = 'scripts/composer-identity-ownership-policy.mjs';
export const SUPPORT_PATH = 'scripts/composer-identity-test-support.mjs';
export const CHECK_PATH = 'scripts/check-composer-identity-ownership.mjs';
export const OWNERSHIP_TEST_PATH = 'scripts/test-composer-identity-ownership.mjs';
export const LEGACY_PATH = 'scripts/test-composer-identity-grid.js';

const BODY_START = '// composer-identity-body:start';
const BODY_END = '// composer-identity-body:end';
const SOURCE_LOADER_PATTERN = /\breadIdentitySource\b/gu;
const SUPPORT_EXPORTS = new Set(['createMemoryStorage', 'extractFunctionBody', 'readIdentitySource']);
const SUPPORT_AST_SHA256 = 'bd29c5f1fe8d03e3937879c8c9cd8e864717314ec7fe81e5b01d650cf1bf3447';
const PROHIBITED_IO_IDENTIFIERS = new Set([
  'Bun',
  'Deno',
  'Function',
  'XMLHttpRequest',
  'eval',
  'fetch',
  'process',
  'readFileSync',
  'require'
]);
const PROHIBITED_IO_PROPERTIES = new Set([
  'Bun',
  'Deno',
  'createReadStream',
  'createRequire',
  'fetch',
  'getBuiltinModule',
  'mainModule',
  'open',
  'openSync',
  'process',
  'readFile',
  'readFileSync',
  'require'
]);
const LEGACY_BASE_COMMIT = 'ede3cae380cbc0feb80d8212cd2a2f561ba32590';
const LEGACY_SHA256 = '12076ac40831b75ef25262fbb18ad1b893370f3e02303176ae12353baa68931d';
const LEGACY_LINES = 8277;
const LEGACY_ASSERTIONS = 1289;
const LEGACY_SCENARIOS = 1274;
const MIGRATION_ASSERTION_ORDERED_SHA256 = '829aed37ad0724327da4764444def046c0afef7af9dcb25085063124c0180e39';
const MIGRATION_ASSERTION_MULTISET_SHA256 = '646ce440d79f6971ad82711fc304a4fc1a7567cec71e144305686570d72271b5';
const MIGRATION_SCENARIO_ORDERED_SHA256 = 'cbe147d8233181fa39c9bff3250f146c02c7a62f79362beb6605f27bde2e3f7b';
const MIGRATION_SCENARIO_MULTISET_SHA256 = '99873b81a10ee36bba26d23f2ac7c60e6d0e8a29a04348f477f9ab1f43d93c29';
const MIGRATION_SETUP_BINDINGS = 449;
const MIGRATION_SOURCE_BINDINGS = 443;
const MIGRATION_SETUP_BINDINGS_SHA256 = 'c13ca2d8ae3f187f2b69fae0fef3fc4cb384b7fbd6a78a1a5f97a7d142c25d16';
const ALLOWED_NORMALIZATIONS = [
  'two no-regex-spaces literals use explicit {2} quantifiers',
  'five literal readFileSync(resolve(here, path), utf8) calls use readIdentitySource(path)'
];
const LEGACY_OWNER_RANGES = [
  ['scripts/test-composer-identity-blocks-foundations.mjs', 401, 1077],
  ['scripts/test-composer-identity-blocks-runtime.mjs', 1079, 1125],
  ['scripts/test-composer-identity-blocks-session-wiring.mjs', 1127, 1195],
  ['scripts/test-composer-identity-yaml-models.mjs', 1197, 1570],
  ['scripts/test-composer-identity-feature-boundaries.mjs', 1572, 1900],
  ['scripts/test-composer-identity-composer-editor-root.mjs', 1902, 2413],
  ['scripts/test-composer-identity-editor-main-services.mjs', 2415, 2735],
  ['scripts/test-composer-identity-app-runtime.mjs', 2737, 3263],
  ['scripts/test-composer-identity-markdown-storage.mjs', 3265, 3941],
  ['scripts/test-composer-identity-document-blocks.mjs', 3943, 4154],
  ['scripts/test-composer-identity-blocks-inline.mjs', 4156, 4670],
  ['scripts/test-composer-identity-blocks-structured.mjs', 4672, 5186],
  ['scripts/test-composer-identity-blocks-preview.mjs', 5188, 5943],
  ['scripts/test-composer-identity-publish-sync.mjs', 5945, 6244],
  ['scripts/test-composer-identity-yaml-i18n-frontmatter.mjs', 6246, 6481],
  ['scripts/test-composer-identity-metadata-tree.mjs', 6483, 6980],
  ['scripts/test-composer-identity-shell-navigation.mjs', 6982, 7231],
  ['scripts/test-composer-identity-site-settings-interactions.mjs', 7233, 7838],
  ['scripts/test-composer-identity-site-settings-publishing.mjs', 7840, 8145],
  ['scripts/test-composer-identity-article-paths.mjs', 8147, 8277]
];

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function lineCount(source) {
  return source.endsWith('\n') ? source.split(/\r?\n/u).length - 1 : source.split(/\r?\n/u).length;
}

function parseModule(source, label) {
  try {
    return parse(source, {
      allowAwaitOutsideFunction: true,
      ecmaVersion: 'latest',
      sourceType: 'module'
    });
  } catch (error) {
    fail(`${label} must parse as an ES module: ${error.message}`);
  }
}

function stableAst(value) {
  if (Array.isArray(value)) return value.map(stableAst);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => !['end', 'loc', 'range', 'raw', 'start'].includes(key))
      .map((key) => [key, stableAst(value[key])])
  );
}

function migrationAst(value) {
  if (Array.isArray(value)) return value.map(migrationAst);
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (['end', 'loc', 'range', 'raw', 'start'].includes(key)) continue;
    result[key] = migrationAst(child);
  }
  return result;
}

function walkMigration(node, callback) {
  if (!node || typeof node !== 'object') return;
  if (node.type) callback(node);
  for (const [key, child] of Object.entries(node)) {
    if (['end', 'loc', 'range', 'raw', 'start'].includes(key)) continue;
    if (Array.isArray(child)) {
      for (const entry of child) walkMigration(entry, callback);
    } else {
      walkMigration(child, callback);
    }
  }
}

function migrationNodeHash(node) {
  return sha256(JSON.stringify(migrationAst(node)));
}

function migrationStreamHash(hashes) {
  return sha256(hashes.join('\n'));
}

function migrationMultisetHash(hashes) {
  return migrationStreamHash([...hashes].sort());
}

function isMigrationAssertion(node) {
  return (
    node?.type === 'CallExpression' &&
    ((node.callee?.type === 'MemberExpression' &&
      node.callee.computed === false &&
      node.callee.object?.type === 'Identifier' &&
      node.callee.object.name === 'assert') ||
      (node.callee?.type === 'Identifier' && node.callee.name === 'assert'))
  );
}

function migrationAssertionHashes(node) {
  const hashes = [];
  walkMigration(node, (child) => {
    if (isMigrationAssertion(child)) hashes.push(migrationNodeHash(child));
  });
  return hashes;
}

function normalizeLegacySource(source) {
  const replacements = [
    ["indentText: '  '\\.repeat", "indentText: ' {2}'\\.repeat", 1],
    ['\\n  function buildTabsUI', '\\n {2}function buildTabsUI', 1]
  ];
  let normalized = source;
  for (const [before, after, expected] of replacements) {
    const count = normalized.split(before).length - 1;
    if (count !== expected) fail(`legacy identity normalization occurrence changed for ${before}`);
    normalized = normalized.replace(before, after);
  }
  for (const [relativePath, expected] of [
    ['../assets/js/system-updates.js', 2],
    ['../assets/js/editor-boot.js', 1],
    ['../assets/js/theme.js', 1],
    ['../assets/js/seo.js', 1]
  ]) {
    const before = `readFileSync(resolve(here, '${relativePath}'), 'utf8')`;
    const after = `readIdentitySource('${relativePath}')`;
    const count = normalized.split(before).length - 1;
    if (count !== expected) fail(`legacy identity source normalization count changed for ${relativePath}`);
    normalized = normalized.replaceAll(before, after);
  }
  return normalized;
}

function parseMigrationModule(source, label) {
  try {
    return parse(source, {
      ecmaVersion: 'latest',
      locations: true,
      ranges: true,
      sourceType: 'module'
    });
  } catch (error) {
    fail(`${label} must parse for migration proof: ${error.message}`);
  }
}

function markedMigrationStatements(source, label) {
  const lines = source.split('\n');
  const startLine = lines.indexOf(BODY_START) + 1;
  const endLine = lines.indexOf(BODY_END) + 1;
  if (!startLine || !endLine || endLine <= startLine) fail(`${label} has invalid migration body markers`);
  return parseMigrationModule(source, label).body.filter(
    (statement) => statement.loc.start.line > startLine && statement.loc.end.line < endLine
  );
}

function validateMigrationProof(root, policy) {
  let legacySource;
  try {
    legacySource = execFileSync('git', ['show', `${LEGACY_BASE_COMMIT}:${LEGACY_PATH}`], {
      cwd: root,
      encoding: 'utf8'
    });
  } catch (error) {
    fail(`identity migration proof cannot read its fixed legacy blob: ${error.message}`);
  }
  if (sha256(legacySource) !== LEGACY_SHA256 || lineCount(legacySource) !== LEGACY_LINES) {
    fail('identity migration proof legacy blob identity changed');
  }

  const legacyAst = parseMigrationModule(normalizeLegacySource(legacySource), 'legacy identity grid');
  const supportSource = fs.readFileSync(regularFile(root, SUPPORT_PATH, 'identity support'), 'utf8');
  const supportAst = parseMigrationModule(supportSource, 'identity support');
  const supportExtract = supportAst.body.find(
    (statement) => statement.type === 'FunctionDeclaration' && statement.id?.name === 'extractFunctionBody'
  );
  const supportStorage = supportAst.body.find(
    (statement) => statement.type === 'FunctionDeclaration' && statement.id?.name === 'createMemoryStorage'
  );
  if (!supportExtract || !supportStorage) fail('identity migration support helpers are missing');

  const legacyAssertionHashes = migrationAssertionHashes(legacyAst);
  const splitAssertionHashes = [
    ...migrationAssertionHashes(supportExtract),
    ...LEGACY_OWNER_RANGES.flatMap(([filename]) => {
      const source = fs.readFileSync(regularFile(root, filename, 'identity migration owner'), 'utf8');
      return migrationAssertionHashes(parseMigrationModule(source, filename));
    })
  ];

  const legacyScenarios = legacyAst.body.filter((statement) => statement.loc.start.line >= 401);
  const splitScenarios = [];
  for (const [filename, start, end] of LEGACY_OWNER_RANGES) {
    const source = fs.readFileSync(regularFile(root, filename, 'identity migration owner'), 'utf8');
    const statements = markedMigrationStatements(source, filename);
    if (filename.endsWith('test-composer-identity-markdown-storage.mjs')) {
      const legacyRange = legacyAst.body.filter(
        (statement) => statement.loc.start.line >= start && statement.loc.end.line <= end
      );
      const storageIndex = legacyRange.findIndex(
        (statement) => statement.type === 'FunctionDeclaration' && statement.id?.name === 'createMemoryStorage'
      );
      if (storageIndex < 0 || statements.length + 1 !== legacyRange.length) {
        fail('identity migration proof cannot restore createMemoryStorage to its legacy position');
      }
      splitScenarios.push(...statements.slice(0, storageIndex), supportStorage, ...statements.slice(storageIndex));
    } else {
      splitScenarios.push(...statements);
    }
  }

  const legacyScenarioHashes = legacyScenarios.map(migrationNodeHash);
  const splitScenarioHashes = splitScenarios.map(migrationNodeHash);
  const facts = {
    assertions: {
      legacyCount: legacyAssertionHashes.length,
      splitCount: splitAssertionHashes.length,
      legacyOrdered: migrationStreamHash(legacyAssertionHashes),
      splitOrdered: migrationStreamHash(splitAssertionHashes),
      legacyMultiset: migrationMultisetHash(legacyAssertionHashes),
      splitMultiset: migrationMultisetHash(splitAssertionHashes)
    },
    scenarios: {
      legacyCount: legacyScenarioHashes.length,
      splitCount: splitScenarioHashes.length,
      legacyOrdered: migrationStreamHash(legacyScenarioHashes),
      splitOrdered: migrationStreamHash(splitScenarioHashes),
      legacyMultiset: migrationMultisetHash(legacyScenarioHashes),
      splitMultiset: migrationMultisetHash(splitScenarioHashes)
    }
  };
  if (
    facts.assertions.legacyCount !== LEGACY_ASSERTIONS ||
    facts.assertions.splitCount !== LEGACY_ASSERTIONS ||
    facts.assertions.legacyOrdered !== MIGRATION_ASSERTION_ORDERED_SHA256 ||
    facts.assertions.splitOrdered !== MIGRATION_ASSERTION_ORDERED_SHA256 ||
    facts.assertions.legacyMultiset !== MIGRATION_ASSERTION_MULTISET_SHA256 ||
    facts.assertions.splitMultiset !== MIGRATION_ASSERTION_MULTISET_SHA256 ||
    facts.scenarios.legacyCount !== LEGACY_SCENARIOS ||
    facts.scenarios.splitCount !== LEGACY_SCENARIOS ||
    facts.scenarios.legacyOrdered !== MIGRATION_SCENARIO_ORDERED_SHA256 ||
    facts.scenarios.splitOrdered !== MIGRATION_SCENARIO_ORDERED_SHA256 ||
    facts.scenarios.legacyMultiset !== MIGRATION_SCENARIO_MULTISET_SHA256 ||
    facts.scenarios.splitMultiset !== MIGRATION_SCENARIO_MULTISET_SHA256
  ) {
    fail(`identity migration proof changed: ${JSON.stringify(facts)}`);
  }
  if (
    policy.migration.assertionOrderedSha256 !== facts.assertions.legacyOrdered ||
    policy.migration.assertionMultisetSha256 !== facts.assertions.legacyMultiset ||
    policy.migration.scenarioOrderedSha256 !== facts.scenarios.legacyOrdered ||
    policy.migration.scenarioMultisetSha256 !== facts.scenarios.legacyMultiset
  ) {
    fail('identity migration policy hashes do not match the executable proof');
  }
}

function countAssertions(ast) {
  let count = 0;
  simple(ast, {
    CallExpression(node) {
      const callee = node.callee;
      if (
        callee?.type === 'MemberExpression' &&
        callee.computed === false &&
        callee.object?.type === 'Identifier' &&
        callee.object.name === 'assert'
      ) {
        count += 1;
      }
    }
  });
  return count;
}

function staticString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked;
  }
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticString(node.left);
    const right = staticString(node.right);
    return left == null || right == null ? null : left + right;
  }
  return null;
}

function validateAssertBinding(ast, label) {
  let uses = 0;
  ancestor(ast, {
    Identifier(node, ancestors) {
      if (node.name !== 'assert') return;
      const parent = ancestors.at(-2);
      const grandparent = ancestors.at(-3);
      if (parent?.type === 'ImportDefaultSpecifier' && parent.local === node) return;
      if (
        parent?.type === 'MemberExpression' &&
        parent.object === node &&
        parent.computed === false &&
        parent.property?.type === 'Identifier' &&
        grandparent?.type === 'CallExpression' &&
        grandparent.callee === parent
      ) {
        uses += 1;
        return;
      }
      fail(`${label} may use the assert binding only as a direct noncomputed assertion call`);
    }
  });
  if (uses !== countAssertions(ast)) fail(`${label} assertion binding inventory is ambiguous`);
  return uses;
}

function validateLoaderBinding(ast, label) {
  ancestor(ast, {
    Identifier(node, ancestors) {
      if (node.name !== 'readIdentitySource') return;
      const parent = ancestors.at(-2);
      const grandparent = ancestors.at(-3);
      if (parent?.type === 'ImportSpecifier' && (parent.imported === node || parent.local === node)) return;
      if (parent?.type === 'CallExpression' && parent.callee === node) return;
      if (grandparent?.type === 'ImportSpecifier') return;
      fail(`${label} may not alias, shadow, or indirectly call readIdentitySource`);
    }
  });
}

function validateNoUnownedIo(ast, label) {
  for (const node of ast.body) {
    if (
      node.type === 'ExportAllDeclaration' ||
      (node.type === 'ExportNamedDeclaration' && node.source) ||
      node.type === 'ExportDefaultDeclaration'
    ) {
      fail(`${label} must not re-export or add executable exports`);
    }
  }
  ancestor(ast, {
    Identifier(node) {
      if (!PROHIBITED_IO_IDENTIFIERS.has(node.name)) return;
      fail(`${label} must not access unowned I/O through ${node.name}`);
    },
    MemberExpression(node) {
      const propertyName = node.computed ? staticString(node.property) : node.property?.name;
      if (propertyName && PROHIBITED_IO_PROPERTIES.has(propertyName)) {
        fail(`${label} must not access unowned I/O property ${propertyName}`);
      }
    }
  });
}

function markerIndex(source, marker, label) {
  const first = source.indexOf(marker);
  if (first < 0 || first !== source.lastIndexOf(marker)) {
    fail(`${label} must contain ${marker} exactly once`);
  }
  return first;
}

function extractBody(source, label) {
  const start = markerIndex(source, BODY_START, label);
  const end = markerIndex(source, BODY_END, label);
  if (end <= start) fail(`${label} body markers must be ordered`);
  return source.slice(start + BODY_START.length, end);
}

function isDirectSourceRead(node) {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' &&
    node.callee.name === 'readIdentitySource' &&
    node.arguments.length === 1 &&
    node.arguments[0]?.type === 'Literal' &&
    typeof node.arguments[0].value === 'string'
  );
}

function isSourceComposite(node) {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.computed === false &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'join' &&
    node.callee.object?.type === 'ArrayExpression' &&
    node.callee.object.elements.every((entry) => entry?.type === 'Identifier') &&
    node.arguments.length === 1 &&
    node.arguments[0]?.type === 'Literal' &&
    node.arguments[0].value === '\n'
  );
}

function isRepoInferenceRecord(node) {
  return (
    node?.type === 'ObjectExpression' &&
    node.properties.every(
      (property) =>
        property.type === 'Property' &&
        property.computed === false &&
        property.kind === 'init' &&
        property.method === false &&
        property.shorthand === true &&
        property.key?.type === 'Identifier' &&
        property.value?.type === 'Identifier' &&
        property.key.name === property.value.name
    )
  );
}

function validateOwnerStructure(ast, source, label) {
  const start = markerIndex(source, BODY_START, label);
  const end = markerIndex(source, BODY_END, label);
  let assertImports = 0;
  let supportImports = 0;

  for (const node of ast.body) {
    if (node.start > start && node.end < end) continue;
    if (node.start >= end) fail(`${label} must not place setup or assertions after its body marker`);
    if (node.end > start) fail(`${label} top-level statements must stay wholly inside or before body markers`);

    if (node.type === 'ImportDeclaration') {
      if (node.source.value === 'node:assert/strict') {
        assertImports += 1;
        if (
          node.specifiers.length !== 1 ||
          node.specifiers[0].type !== 'ImportDefaultSpecifier' ||
          node.specifiers[0].local.name !== 'assert'
        ) {
          fail(`${label} must import node:assert/strict as the exact default assert binding`);
        }
      } else if (node.source.value === './composer-identity-test-support.mjs') {
        supportImports += 1;
        const imported = [];
        for (const specifier of node.specifiers) {
          if (
            specifier.type !== 'ImportSpecifier' ||
            specifier.imported?.type !== 'Identifier' ||
            specifier.local?.name !== specifier.imported.name ||
            !SUPPORT_EXPORTS.has(specifier.imported.name)
          ) {
            fail(`${label} must use exact unaliased named imports from identity support`);
          }
          imported.push(specifier.imported.name);
        }
        if (!imported.includes('readIdentitySource') || new Set(imported).size !== imported.length) {
          fail(`${label} must import readIdentitySource exactly once from identity support`);
        }
      }
      continue;
    }

    if (node.type !== 'VariableDeclaration' || node.kind !== 'const') {
      fail(`${label} preamble may contain only imports and const source bindings`);
    }
    for (const declaration of node.declarations) {
      if (
        declaration.id?.type !== 'Identifier' ||
        (!isDirectSourceRead(declaration.init) &&
          !isSourceComposite(declaration.init) &&
          !isRepoInferenceRecord(declaration.init))
      ) {
        fail(`${label} preamble contains an unowned setup declaration`);
      }
    }
  }
  if (assertImports !== 1 || supportImports !== 1) {
    fail(`${label} must have exactly one assert import and one identity support import`);
  }
}

function canonicalSourceSpecifier(specifier, label) {
  if (
    typeof specifier !== 'string' ||
    !specifier.startsWith('../') ||
    specifier.includes('\\') ||
    /[%?#]/u.test(specifier)
  ) {
    fail(`${label} must use a canonical literal repository-relative source path: ${String(specifier)}`);
  }
  const target = path.posix.normalize(path.posix.join('scripts', specifier));
  const canonical = path.posix.relative('scripts', target);
  if (specifier !== canonical || (!target.startsWith('assets/') && target !== 'index_editor.html')) {
    fail(`${label} must use the unique shortest source path: ${specifier}`);
  }
  return target;
}

function collectOwnerFacts(source, label) {
  const ast = parseModule(source, label);
  validateOwnerStructure(ast, source, label);
  validateLoaderBinding(ast, label);
  validateNoUnownedIo(ast, label);
  const bodyStart = markerIndex(source, BODY_START, label);
  const bodySource = extractBody(source, label);
  const bodyAst = parseModule(bodySource, `${label} migrated body`);
  const sourcePaths = new Set();
  const sourceBindings = [];
  const setupBindings = [];
  let literalLoaderCalls = 0;
  let directRead = false;
  let requireCall = false;
  let dynamicImport = false;

  for (const node of ast.body) {
    if (node.end >= bodyStart) continue;
    if (node.type === 'ImportDeclaration') {
      if (node.source.value === 'node:assert/strict' || node.source.value === './composer-identity-test-support.mjs') {
        continue;
      }
      setupBindings.push({ declaration: stableAst(node), kind: 'import' });
      continue;
    }
    for (const declaration of node.declarations) {
      setupBindings.push({ declaration: stableAst(declaration), kind: 'const' });
    }
  }

  for (const node of ast.body) {
    if (node.type !== 'ImportDeclaration') continue;
    const specifier = node.source?.value;
    if (specifier === 'node:assert/strict' || specifier === './composer-identity-test-support.mjs') continue;
    if (typeof specifier === 'string' && specifier.startsWith('../assets/')) {
      canonicalSourceSpecifier(specifier, `${label} import`);
      if (node.specifiers.length === 0) fail(`${label} must bind product imports explicitly`);
      sourcePaths.add(specifier);
      for (const binding of node.specifiers) {
        sourceBindings.push({
          imported:
            binding.type === 'ImportDefaultSpecifier'
              ? 'default'
              : binding.type === 'ImportNamespaceSpecifier'
                ? '*'
                : binding.imported?.name || binding.imported?.value,
          kind: binding.type,
          local: binding.local?.name,
          path: specifier
        });
      }
      continue;
    }
    fail(`${label} has an unowned import: ${String(specifier)}`);
  }

  for (const node of ast.body) {
    if (node.type !== 'VariableDeclaration') continue;
    for (const declaration of node.declarations) {
      if (!isDirectSourceRead(declaration.init)) continue;
      sourceBindings.push({
        imported: 'readIdentitySource',
        kind: 'source',
        local: declaration.id.name,
        path: declaration.init.arguments[0].value
      });
    }
  }

  simple(ast, {
    CallExpression(node) {
      if (node.callee?.type === 'Identifier' && node.callee.name === 'readIdentitySource') {
        if (
          node.arguments.length !== 1 ||
          node.arguments[0]?.type !== 'Literal' ||
          typeof node.arguments[0].value !== 'string'
        ) {
          fail(`${label} source reads must use one literal readIdentitySource argument`);
        }
        canonicalSourceSpecifier(node.arguments[0].value, `${label} source read`);
        sourcePaths.add(node.arguments[0].value);
        literalLoaderCalls += 1;
      }
      if (node.callee?.type === 'Identifier' && node.callee.name === 'readFileSync') directRead = true;
      if (node.callee?.type === 'Identifier' && node.callee.name === 'require') requireCall = true;
    },
    ImportExpression() {
      dynamicImport = true;
    }
  });

  const loaderReferences = [...source.matchAll(SOURCE_LOADER_PATTERN)].length;
  if (loaderReferences !== literalLoaderCalls + 1) {
    fail(`${label} may use readIdentitySource only as its named support import and direct literal calls`);
  }
  if (directRead || /(?:node:fs|['"]fs['"])/u.test(source)) {
    fail(`${label} must not bypass the shared source loader with fs/readFileSync`);
  }
  if (requireCall) fail(`${label} must not use require()`);
  if (dynamicImport) fail(`${label} must not use dynamic import()`);
  const fullAssertions = validateAssertBinding(ast, label);
  const bodyAssertions = countAssertions(bodyAst);
  if (fullAssertions !== bodyAssertions) {
    fail(`${label} must keep every assertion inside its owned body markers`);
  }

  const orderedSourceBindings = sourceBindings.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
  return {
    assertions: bodyAssertions,
    bodyAst,
    bodyAstSha256: sha256(JSON.stringify(stableAst(bodyAst.body))),
    bodyStatements: bodyAst.body.length,
    fileAstSha256: sha256(JSON.stringify(stableAst(ast))),
    lineCount: lineCount(source),
    setupBindings,
    setupBindingsSha256: sha256(JSON.stringify(setupBindings)),
    sourceBindings: orderedSourceBindings,
    sourceBindingsSha256: sha256(JSON.stringify(orderedSourceBindings)),
    sourcePaths: [...sourcePaths].sort(),
    sourcePathsSha256: sha256(JSON.stringify([...sourcePaths].sort()))
  };
}

export function validatePolicyShape(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) fail('identity policy must be an object');
  if (policy.schemaVersion !== 1) fail('identity policy schemaVersion must equal 1');
  if (policy.decision !== 'domain-owned-exact-scenario-baseline-with-zero-growth') {
    fail('identity policy decision must retain the exact no-growth contract');
  }
  if (
    policy.caps?.ownerLines !== OWNER_LINE_CAP ||
    policy.caps?.ownerSources !== OWNER_SOURCE_CAP ||
    policy.caps?.supportLines !== SUPPORT_LINE_CAP
  ) {
    fail('identity ownership caps must remain exactly 1800/24/300');
  }
  if (
    policy.legacy?.baseCommit !== LEGACY_BASE_COMMIT ||
    policy.legacy?.file !== LEGACY_PATH ||
    policy.legacy?.sha256 !== LEGACY_SHA256 ||
    policy.legacy?.lines !== LEGACY_LINES ||
    policy.legacy?.assertions !== LEGACY_ASSERTIONS ||
    policy.legacy?.scenarioStatements !== LEGACY_SCENARIOS
  ) {
    fail('identity policy must retain the exact legacy blob and migration inventory');
  }
  if (!Array.isArray(policy.owners) || policy.owners.length !== 20) {
    fail('identity policy must list exactly 20 domain owners');
  }
  const ids = policy.owners.map((owner) => owner.id);
  const files = policy.owners.map((owner) => owner.file);
  if (new Set(ids).size !== ids.length || new Set(files).size !== files.length) {
    fail('identity owner ids and files must be unique');
  }
  if (
    policy.support?.file !== SUPPORT_PATH ||
    policy.support?.assertions !== 3 ||
    policy.support?.astSha256 !== SUPPORT_AST_SHA256 ||
    JSON.stringify([...(policy.support?.allowedExports || [])].sort()) !== JSON.stringify([...SUPPORT_EXPORTS].sort())
  ) {
    fail('identity support path, exports, assertions, and AST must remain fixed');
  }
  if (
    policy.migration?.ownerStatements !== 1273 ||
    policy.migration?.relocatedSupportStatements !== 1 ||
    policy.migration?.totalScenarioStatements !== LEGACY_SCENARIOS ||
    policy.migration?.totalAssertions !== LEGACY_ASSERTIONS ||
    policy.migration?.ownerScenarioAstSha256 !== '56bb14afe96e01501ea2e10625caced2072ac1eb04093d745c86df47c3e8e6a8' ||
    policy.migration?.assertionOrderedSha256 !== MIGRATION_ASSERTION_ORDERED_SHA256 ||
    policy.migration?.assertionMultisetSha256 !== MIGRATION_ASSERTION_MULTISET_SHA256 ||
    policy.migration?.scenarioOrderedSha256 !== MIGRATION_SCENARIO_ORDERED_SHA256 ||
    policy.migration?.scenarioMultisetSha256 !== MIGRATION_SCENARIO_MULTISET_SHA256 ||
    policy.migration?.totalSetupBindings !== MIGRATION_SETUP_BINDINGS ||
    policy.migration?.totalSourceBindings !== MIGRATION_SOURCE_BINDINGS ||
    policy.migration?.ownerSetupBindingsSha256 !== MIGRATION_SETUP_BINDINGS_SHA256 ||
    JSON.stringify(policy.migration?.allowedNormalizations) !== JSON.stringify(ALLOWED_NORMALIZATIONS)
  ) {
    fail('identity policy must retain the exact executable migration proof');
  }
  return policy;
}

export function inspectOwnerSource(source, owner) {
  const label = owner.file;
  if (lineCount(source) > OWNER_LINE_CAP) fail(`${label} exceeds ${OWNER_LINE_CAP} lines`);
  const facts = collectOwnerFacts(source, label);
  if (facts.sourcePaths.length > OWNER_SOURCE_CAP) fail(`${label} exceeds ${OWNER_SOURCE_CAP} product sources`);
  if (facts.assertions !== owner.assertions) fail(`${label} assertion inventory changed`);
  if (facts.sourcePaths.length !== owner.sourceCount) fail(`${label} source count changed`);
  if (facts.sourcePathsSha256 !== owner.sourcePathsSha256) fail(`${label} source inventory changed`);
  if (facts.sourceBindings.length !== owner.sourceBindingCount) fail(`${label} source binding count changed`);
  if (facts.sourceBindingsSha256 !== owner.sourceBindingsSha256) fail(`${label} source binding inventory changed`);
  if (facts.setupBindings.length !== owner.setupBindingCount) fail(`${label} setup binding count changed`);
  if (facts.setupBindingsSha256 !== owner.setupBindingsSha256) fail(`${label} setup binding inventory changed`);
  if (facts.bodyAstSha256 !== owner.bodyAstSha256) fail(`${label} scenario AST changed`);
  if (facts.fileAstSha256 !== owner.fileAstSha256) fail(`${label} full owner AST changed`);
  return facts;
}

export function inspectOwnerSourceBindings(source, label = 'identity owner') {
  const facts = collectOwnerFacts(source, label);
  return {
    setupBindingCount: facts.setupBindings.length,
    setupBindingsSha256: facts.setupBindingsSha256,
    sourceBindingCount: facts.sourceBindings.length,
    sourceBindingsSha256: facts.sourceBindingsSha256
  };
}

function regularFile(root, relativePath, label) {
  const absolutePath = path.join(root, relativePath);
  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch (error) {
    fail(`${label} is missing: ${relativePath} (${error.code || error.message})`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) fail(`${label} must be a regular non-symlink file: ${relativePath}`);
  return absolutePath;
}

export function assertRegularFile(root, relativePath, label = 'identity path') {
  return regularFile(root, relativePath, label);
}

export function validateFixedGateFiles(root) {
  for (const [relativePath, label] of [
    [CHECK_PATH, 'identity checker'],
    [POLICY_CORE_PATH, 'identity policy core'],
    [OWNERSHIP_TEST_PATH, 'identity ownership test']
  ]) {
    regularFile(root, relativePath, label);
  }
}

function discoverIdentityFiles(root) {
  const found = [];
  const visit = (relativeDirectory) => {
    const absoluteDirectory = path.join(root, relativeDirectory);
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relativePath = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) visit(relativePath);
      else if (/composer-identity-/u.test(relativePath)) {
        found.push(relativePath);
      }
    }
  };
  visit('scripts');
  return found.sort();
}

export function validateDiscoveredFiles(policy, discovered) {
  const expected = [
    ...policy.owners.map((owner) => owner.file),
    CHECK_PATH,
    OWNERSHIP_TEST_PATH,
    POLICY_PATH,
    POLICY_CORE_PATH,
    SUPPORT_PATH
  ].sort();
  if (JSON.stringify(discovered) !== JSON.stringify(expected)) {
    fail(`identity file ownership changed; expected ${expected.join(', ')}, received ${discovered.join(', ')}`);
  }
}

export function validateManifestBindings(policy, manifest) {
  const tests = Array.isArray(manifest?.tests) ? manifest.tests : [];
  const expectedPairs = new Map([
    ...policy.owners.map((owner) => [owner.file, `composer-identity-${owner.id}`]),
    [OWNERSHIP_TEST_PATH, 'composer-identity-ownership']
  ]);
  const expectedFiles = new Set(expectedPairs.keys());
  const expectedFilesById = new Map([...expectedPairs].map(([file, id]) => [id, file]));
  for (const entry of tests) {
    const identityId = typeof entry?.id === 'string' && entry.id.startsWith('composer-identity-');
    const identityFile = typeof entry?.file === 'string' && /(?:^|\/)test-composer-identity-/u.test(entry.file);
    if ((identityId && !expectedFilesById.has(entry.id)) || (identityFile && !expectedFiles.has(entry.file))) {
      fail(`test manifest has an unowned Composer identity entry: ${entry?.id || entry?.file}`);
    }
    if (identityId || identityFile || expectedFiles.has(entry?.file) || expectedFilesById.has(entry?.id)) {
      if (expectedPairs.get(entry?.file) !== entry?.id || expectedFilesById.get(entry?.id) !== entry?.file) {
        fail(`test manifest has a mismatched Composer identity pair: ${entry?.id || entry?.file}`);
      }
    }
  }
  const actual = tests.filter((entry) => expectedFiles.has(entry.file));
  if (actual.length !== expectedFiles.size)
    fail('test manifest must bind every identity owner and ownership test exactly once');
  for (const entry of actual) {
    if (
      !Array.isArray(entry.command) ||
      entry.command.length !== 2 ||
      entry.command[0] !== 'node' ||
      entry.command[1] !== entry.file ||
      !Array.isArray(entry.tier) ||
      !entry.tier.includes('full')
    ) {
      fail(`test manifest binding is not direct/full for ${entry.file}`);
    }
  }
  const legacyEntry = tests.find((entry) => entry.file === LEGACY_PATH || entry.id === 'composer-identity-grid');
  if (legacyEntry) fail('test manifest must not retain the identity catch-all');
  const ownership = tests.find((entry) => entry.file === OWNERSHIP_TEST_PATH);
  if (!ownership || !['guard', 'release', 'full'].every((tier) => ownership.tier.includes(tier))) {
    fail('identity ownership test must run in guard, release, and full tiers');
  }
}

export function inspectSupportSource(source, supportPolicy) {
  if (lineCount(source) > SUPPORT_LINE_CAP) fail(`identity support exceeds ${SUPPORT_LINE_CAP} lines`);
  const ast = parseModule(source, supportPolicy.file);
  const exports = [];
  for (const node of ast.body) {
    if (node.type !== 'ExportNamedDeclaration') continue;
    for (const specifier of node.specifiers || []) exports.push(specifier.exported?.name || specifier.exported?.value);
    if (node.declaration?.id?.name) exports.push(node.declaration.id.name);
    if (node.declaration?.type === 'VariableDeclaration') {
      for (const declaration of node.declaration.declarations) {
        if (declaration.id?.type === 'Identifier') exports.push(declaration.id.name);
      }
    }
  }
  if (JSON.stringify(exports.sort()) !== JSON.stringify([...supportPolicy.allowedExports].sort())) {
    fail('identity support export inventory changed');
  }
  if (countAssertions(ast) !== supportPolicy.assertions) fail('identity support assertion inventory changed');
  if (sha256(JSON.stringify(stableAst(ast))) !== supportPolicy.astSha256) {
    fail('identity support helper AST changed');
  }
}

function validateSupport(root, policy) {
  const absolutePath = regularFile(root, policy.support.file, 'identity support');
  inspectSupportSource(fs.readFileSync(absolutePath, 'utf8'), policy.support);
}

export function validateComposerIdentityOwnership(root) {
  const policyPath = regularFile(root, POLICY_PATH, 'identity policy');
  const policy = validatePolicyShape(JSON.parse(fs.readFileSync(policyPath, 'utf8')));
  if (fs.existsSync(path.join(root, LEGACY_PATH))) fail('the legacy identity catch-all must stay deleted');
  validateFixedGateFiles(root);
  validateDiscoveredFiles(policy, discoverIdentityFiles(root));
  validateSupport(root, policy);

  let ownerAssertions = 0;
  let ownerStatements = 0;
  let sourceBindingCount = 0;
  let setupBindingCount = 0;
  const ownerSetupBindings = [];
  const scenarioAst = [];
  for (const owner of policy.owners) {
    const absolutePath = regularFile(root, owner.file, `identity owner ${owner.id}`);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const facts = inspectOwnerSource(source, owner);
    ownerAssertions += facts.assertions;
    ownerStatements += facts.bodyStatements;
    sourceBindingCount += facts.sourceBindings.length;
    setupBindingCount += facts.setupBindings.length;
    ownerSetupBindings.push({
      file: owner.file,
      setupBindingCount: facts.setupBindings.length,
      setupBindingsSha256: facts.setupBindingsSha256
    });
    scenarioAst.push(...facts.bodyAst.body);
    for (const specifier of facts.sourcePaths) {
      const repositoryPath = canonicalSourceSpecifier(specifier, `${owner.file} source`);
      regularFile(root, repositoryPath, `${owner.file} source`);
    }
  }
  if (ownerAssertions + policy.support.assertions !== policy.migration.totalAssertions) {
    fail('identity migration total assertion count changed');
  }
  if (ownerStatements !== policy.migration.ownerStatements) fail('identity owner scenario statement count changed');
  if (ownerStatements + policy.migration.relocatedSupportStatements !== policy.migration.totalScenarioStatements) {
    fail('identity migration total scenario count changed');
  }
  const scenarioSha = sha256(JSON.stringify(stableAst(scenarioAst)));
  if (scenarioSha !== policy.migration.ownerScenarioAstSha256) fail('identity ordered scenario AST changed');
  const ownerSetupBindingsSha256 = sha256(
    JSON.stringify(ownerSetupBindings.sort((left, right) => left.file.localeCompare(right.file)))
  );
  if (
    sourceBindingCount !== MIGRATION_SOURCE_BINDINGS ||
    sourceBindingCount !== policy.migration.totalSourceBindings ||
    setupBindingCount !== MIGRATION_SETUP_BINDINGS ||
    setupBindingCount !== policy.migration.totalSetupBindings ||
    ownerSetupBindingsSha256 !== MIGRATION_SETUP_BINDINGS_SHA256 ||
    ownerSetupBindingsSha256 !== policy.migration.ownerSetupBindingsSha256
  ) {
    fail('identity executable setup-binding migration proof changed');
  }

  const manifestPath = regularFile(root, 'scripts/test-manifest.json', 'test manifest');
  validateManifestBindings(policy, JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  validateMigrationProof(root, policy);
  return { ownerAssertions, ownerStatements, ownerCount: policy.owners.length, policy };
}
