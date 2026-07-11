import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertRegularFile,
  inspectOwnerSource,
  inspectSupportSource,
  validateComposerIdentityOwnership,
  validateDiscoveredFiles,
  validateFixedGateFiles,
  validateManifestBindings,
  validatePolicyShape
} from './composer-identity-ownership-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'scripts/composer-identity-ownership-policy.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/test-manifest.json'), 'utf8'));
const owner = policy.owners.find((entry) => entry.id === 'app-runtime');
const ownerSource = fs.readFileSync(path.join(root, owner.file), 'utf8');
const supportSource = fs.readFileSync(path.join(root, policy.support.file), 'utf8');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rejects(label, callback, pattern) {
  assert.throws(callback, pattern, label);
}

function insertBeforeBodyEnd(source, statement) {
  return source.replace('// composer-identity-body:end', `${statement}\n// composer-identity-body:end`);
}

const exact = validateComposerIdentityOwnership(root);
assert.equal(exact.ownerCount, 20);
assert.equal(exact.ownerAssertions + exact.policy.support.assertions, 1289);
assert.equal(exact.ownerStatements + exact.policy.migration.relocatedSupportStatements, 1274);

const currentFacts = inspectOwnerSource(ownerSource, owner);
assert.equal(currentFacts.sourcePaths.length, 24);

const oversizedOwner = `${ownerSource}${'\n'.repeat(1801 - ownerSource.split(/\r?\n/u).length + 1)}`;
rejects('owner line cap', () => inspectOwnerSource(oversizedOwner, owner), /exceeds 1800 lines/u);

const extraSource = ownerSource.replace(
  "import { readIdentitySource } from './composer-identity-test-support.mjs';",
  "import { readIdentitySource } from './composer-identity-test-support.mjs';\nconst unownedSource = readIdentitySource('../assets/js/errors.js');"
);
rejects('25th product source', () => inspectOwnerSource(extraSource, owner), /exceeds 24 product sources/u);

const dynamicSource = ownerSource.replace(
  /readIdentitySource\('([^']+)'\)/u,
  "readIdentitySource('../assets/' + 'js/composer.js')"
);
rejects(
  'dynamic source expression',
  () => inspectOwnerSource(dynamicSource, owner),
  /one literal|unowned setup declaration/u
);

const noncanonicalSource = ownerSource.replace(
  '../assets/js/composer-bootstrap.js',
  '../assets/js/../js/composer-bootstrap.js'
);
rejects('dot-segment source alias', () => inspectOwnerSource(noncanonicalSource, owner), /unique shortest/u);

const querySource = ownerSource.replace(
  '../assets/js/composer-bootstrap.js',
  '../assets/js/composer-bootstrap.js?alias'
);
rejects('query source alias', () => inspectOwnerSource(querySource, owner), /canonical literal/u);

const directFs = `import { readFileSync } from 'node:fs';\n${insertBeforeBodyEnd(
  ownerSource,
  "readFileSync('../assets/js/errors.js', 'utf8');"
)}`;
rejects('direct fs bypass', () => inspectOwnerSource(directFs, owner), /unowned import|unowned I\/O|must not bypass/u);

const computedGlobalIo = insertBeforeBodyEnd(
  ownerSource,
  "{ const p = globalThis[`process`]; const f = p[`getBuiltinModule`](`fs`); f[`readFileSync`](new URL('../assets/js/errors.js', import.meta.url), 'utf8'); }"
);
rejects('computed global I/O bypass', () => inspectOwnerSource(computedGlobalIo, owner), /unowned I\/O property/u);

const requireBypass = ownerSource.replace(
  '// composer-identity-body:end',
  "require('../assets/js/errors.js');\n// composer-identity-body:end"
);
rejects('CommonJS bypass', () => inspectOwnerSource(requireBypass, owner), /unowned I\/O|must not use require/u);

const dynamicImport = ownerSource.replace(
  '// composer-identity-body:end',
  "await import('../assets/js/errors.js');\n// composer-identity-body:end"
);
rejects('dynamic import bypass', () => inspectOwnerSource(dynamicImport, owner), /dynamic import/u);

const ownerImport = `import './test-composer-identity-article-paths.mjs';\n${ownerSource}`;
rejects('owner-to-owner import', () => inspectOwnerSource(ownerImport, owner), /unowned import/u);

const sideEffectProductImport = `import '../assets/js/composer.js';\n${ownerSource}`;
rejects(
  'side-effect product import bypass',
  () => inspectOwnerSource(sideEffectProductImport, owner),
  /must bind product imports explicitly/u
);

const namespaceLoader = ownerSource.replace(
  "import { readIdentitySource } from './composer-identity-test-support.mjs';",
  "import { readIdentitySource } from './composer-identity-test-support.mjs';\nimport * as identitySupport from './composer-identity-test-support.mjs';\nconst hiddenLoader = identitySupport['readIdentity' + 'Source'];\nconst hiddenSource = hiddenLoader('../assets/js/errors.js');"
);
rejects(
  'namespace source-loader bypass',
  () => inspectOwnerSource(namespaceLoader, { ...owner, fileAstSha256: owner.fileAstSha256 }),
  /exactly one assert import and one identity support import|unowned setup|unaliased named imports/u
);

const aliasedLoader = ownerSource.replace('{ readIdentitySource }', '{ readIdentitySource as loadIdentitySource }');
rejects('aliased source loader', () => inspectOwnerSource(aliasedLoader, owner), /unaliased named imports/u);

const removedSource = ownerSource.replace(/^const [^\n]+ = readIdentitySource\('[^']+'\);\n+/mu, '');
rejects(
  'source removal',
  () => inspectOwnerSource(removedSource, owner),
  /source count changed|source inventory changed/u
);

const swappedSource = ownerSource.replace('../assets/js/composer-bootstrap.js', '../assets/js/errors.js');
rejects('equal-count source swap', () => inspectOwnerSource(swappedSource, owner), /source inventory changed/u);

const swappedSourceBindings = ownerSource
  .replace('../assets/js/composer-content-staging.js', '../assets/js/__identity-swap__.js')
  .replace('../assets/js/composer-index-publish-metadata.js', '../assets/js/composer-content-staging.js')
  .replace('../assets/js/__identity-swap__.js', '../assets/js/composer-index-publish-metadata.js');
rejects(
  'same-set source binding swap',
  () => inspectOwnerSource(swappedSourceBindings, owner),
  /source binding inventory changed|setup binding inventory changed/u
);

const changedScenario = ownerSource.replace('editor scroll session should own', 'editor scroll session may own');
rejects('scenario mutation', () => inspectOwnerSource(changedScenario, owner), /scenario AST changed/u);

const hiddenSetup = ownerSource.replace(
  '// composer-identity-body:start',
  'globalThis.hiddenIdentitySetup = true;\n// composer-identity-body:start'
);
rejects(
  'setup outside body markers',
  () => inspectOwnerSource(hiddenSetup, owner),
  /preamble may contain only imports and const source bindings|full owner AST changed/u
);

const hiddenAssertion = ownerSource.replace(
  '// composer-identity-body:start',
  'assert.equal(1, 1);\n// composer-identity-body:start'
);
rejects(
  'assertion outside body markers',
  () => inspectOwnerSource(hiddenAssertion, owner),
  /preamble may contain only imports and const source bindings|every assertion inside/u
);

const aliasedAssertion = insertBeforeBodyEnd(ownerSource, 'const check = assert; check.equal(1, 1);');
rejects(
  'aliased assertion binding',
  () => inspectOwnerSource(aliasedAssertion, owner),
  /assert binding only as a direct noncomputed assertion/u
);

const computedAssertion = insertBeforeBodyEnd(ownerSource, "assert['equal'](1, 1);");
rejects(
  'computed assertion binding',
  () => inspectOwnerSource(computedAssertion, owner),
  /assert binding only as a direct noncomputed assertion/u
);

const bodyReexport = ownerSource.replace(
  '// composer-identity-body:start',
  "// composer-identity-body:start\nexport * from '../assets/js/errors.js';"
);
rejects('body re-export bypass', () => inspectOwnerSource(bodyReexport, owner), /must not re-export/u);

const loosePolicy = clone(policy);
loosePolicy.caps.ownerLines = 1801;
rejects('policy cap loosening', () => validatePolicyShape(loosePolicy), /caps must remain exactly/u);

const missingOwnerPolicy = clone(policy);
missingOwnerPolicy.owners.pop();
rejects('missing owner policy', () => validatePolicyShape(missingOwnerPolicy), /exactly 20/u);

const fabricatedLegacy = clone(policy);
fabricatedLegacy.legacy.sha256 = '0'.repeat(64);
rejects('fabricated legacy metadata', () => validatePolicyShape(fabricatedLegacy), /exact legacy blob/u);

const fabricatedMigration = clone(policy);
fabricatedMigration.migration.scenarioOrderedSha256 = '0'.repeat(64);
rejects('fabricated migration hash', () => validatePolicyShape(fabricatedMigration), /executable migration proof/u);

const fabricatedNormalization = clone(policy);
fabricatedNormalization.migration.allowedNormalizations[0] = 'arbitrary normalization';
rejects(
  'fabricated migration normalization',
  () => validatePolicyShape(fabricatedNormalization),
  /executable migration proof/u
);

const loosenedSupportPolicy = clone(policy);
loosenedSupportPolicy.support.allowedExports.push('hiddenSupport');
rejects('support policy growth', () => validatePolicyShape(loosenedSupportPolicy), /identity support path/u);

const loosenedSetupProof = clone(policy);
loosenedSetupProof.migration.ownerSetupBindingsSha256 = '0'.repeat(64);
rejects('setup binding proof loosening', () => validatePolicyShape(loosenedSetupProof), /executable migration proof/u);

const missingManifest = clone(manifest);
missingManifest.tests = missingManifest.tests.filter((entry) => entry.file !== owner.file);
rejects(
  'missing manifest binding',
  () => validateManifestBindings(policy, missingManifest),
  /bind every identity owner/u
);

const duplicateManifest = clone(manifest);
duplicateManifest.tests.push(clone(duplicateManifest.tests.find((entry) => entry.file === owner.file)));
rejects(
  'duplicate manifest binding',
  () => validateManifestBindings(policy, duplicateManifest),
  /bind every identity owner/u
);

const duplicateForMissingManifest = clone(manifest);
const missingOwner = policy.owners.find((entry) => entry.file !== owner.file);
duplicateForMissingManifest.tests = duplicateForMissingManifest.tests.filter(
  (entry) => entry.file !== missingOwner.file
);
duplicateForMissingManifest.tests.push(
  clone(duplicateForMissingManifest.tests.find((entry) => entry.file === owner.file))
);
rejects(
  'equal-count duplicate and missing manifest binding',
  () => validateManifestBindings(policy, duplicateForMissingManifest),
  /bind every identity owner/u
);

const indirectManifest = clone(manifest);
const indirectEntry = indirectManifest.tests.find((entry) => entry.file === owner.file);
indirectEntry.command = ['node', 'scripts/run-tests.mjs'];
rejects('indirect manifest binding', () => validateManifestBindings(policy, indirectManifest), /not direct\/full/u);

const hiddenIdentityManifest = clone(manifest);
hiddenIdentityManifest.tests.push({
  id: 'composer-identity-hidden',
  file: 'scripts/test-hidden.sh',
  command: ['bash', 'scripts/test-hidden.sh'],
  tier: ['full']
});
rejects(
  'manifest identity namespace bypass',
  () => validateManifestBindings(policy, hiddenIdentityManifest),
  /unowned Composer identity entry/u
);

const mismatchedManifest = clone(manifest);
const stolenIdentity = mismatchedManifest.tests.find((entry) => entry.file === owner.file);
stolenIdentity.file = 'scripts/test-hidden.sh';
stolenIdentity.command = ['bash', 'scripts/test-hidden.sh'];
rejects(
  'manifest file and id pairing bypass',
  () => validateManifestBindings(policy, mismatchedManifest),
  /mismatched Composer identity pair/u
);

const discovered = [
  ...policy.owners.map((entry) => entry.file),
  'scripts/check-composer-identity-ownership.mjs',
  'scripts/composer-identity-ownership-policy.json',
  'scripts/composer-identity-ownership-policy.mjs',
  'scripts/composer-identity-test-support.mjs',
  'scripts/test-composer-identity-ownership.mjs'
].sort();
validateDiscoveredFiles(policy, discovered);
for (const extraPath of [
  'scripts/test-composer-identity-hidden.mjs',
  'scripts/test-composer-identity-hidden.sh',
  'scripts/check-composer-identity-hidden.sh',
  'scripts/composer-identity-hidden.json',
  'scripts/composer-identity-hidden.sh',
  'scripts/composer-identity-hidden.cjs',
  'scripts/nested/test-composer-identity-hidden.js'
]) {
  rejects(
    `extra identity file ${extraPath}`,
    () => validateDiscoveredFiles(policy, [...discovered, extraPath].sort()),
    /ownership changed/u
  );
}
rejects('missing owner file', () => validateDiscoveredFiles(policy, discovered.slice(1)), /ownership changed/u);
rejects(
  'legacy catch-all regrowth',
  () => validateDiscoveredFiles(policy, [...discovered, policy.legacy.file].sort()),
  /ownership changed/u
);

const oversizedSupport = `${supportSource}${'\n'.repeat(301 - supportSource.split(/\r?\n/u).length + 1)}`;
rejects('support line cap', () => inspectSupportSource(oversizedSupport, policy.support), /exceeds 300 lines/u);

const extraSupportExport = `${supportSource}\nexport const hiddenSupport = true;\n`;
rejects(
  'support export growth',
  () => inspectSupportSource(extraSupportExport, policy.support),
  /export inventory changed/u
);

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'press-identity-symlink-'));
try {
  fs.mkdirSync(path.join(temp, 'scripts'));
  const fixedGateFiles = [
    'check-composer-identity-ownership.mjs',
    'composer-identity-ownership-policy.mjs',
    'test-composer-identity-ownership.mjs'
  ];
  for (const filename of fixedGateFiles) {
    for (const candidate of fixedGateFiles) {
      fs.rmSync(path.join(temp, 'scripts', candidate), { force: true });
      fs.writeFileSync(path.join(temp, 'scripts', candidate), 'export {};\n');
    }
    fs.rmSync(path.join(temp, 'scripts', filename));
    fs.symlinkSync(
      fixedGateFiles.find((candidate) => candidate !== filename),
      path.join(temp, 'scripts', filename)
    );
    rejects(`symlink fixed gate ${filename}`, () => validateFixedGateFiles(temp), /regular non-symlink/u);
  }
  fs.writeFileSync(path.join(temp, 'owner.mjs'), 'export {};\n');
  fs.symlinkSync('owner.mjs', path.join(temp, 'owner-alias.mjs'));
  rejects('symlink owner', () => assertRegularFile(temp, 'owner-alias.mjs'), /regular non-symlink/u);
} finally {
  fs.rmSync(temp, { force: true, recursive: true });
}

console.log('Composer identity ownership policy mutations passed.');
