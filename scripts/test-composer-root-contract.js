import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMPOSER_ROOT_IMPORT_GROUPS,
  getComposerRootImportContract,
  getComposerRootImportsByGroup,
  validateComposerRootImportContract
} from '../assets/js/composer-root-contract.js';

const here = dirname(fileURLToPath(import.meta.url));
const composerSource = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');
const contractSource = readFileSync(resolve(here, '../assets/js/composer-root-contract.js'), 'utf8');

function parseStaticImportSpecifiers(source) {
  const specs = [];
  const pattern = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;
  let match = pattern.exec(source);
  while (match) {
    specs.push(match[1] || match[2]);
    match = pattern.exec(source);
  }
  return specs;
}

const composerImports = parseStaticImportSpecifiers(composerSource);
const contract = getComposerRootImportContract();
const grouped = getComposerRootImportsByGroup();

assert.deepEqual(
  validateComposerRootImportContract(composerImports),
  [],
  'every composer root import should be classified by the root contract'
);

assert.equal(
  new Set(contract.map(entry => entry.specifier)).size,
  contract.length,
  'composer root import contract should not duplicate specifiers'
);

assert.deepEqual(
  Object.keys(grouped),
  COMPOSER_ROOT_IMPORT_GROUPS,
  'composer root import groups should be stable and explicit'
);

assert.equal(grouped.runtime.includes('./composer-runtime.js'), true);
assert.equal(grouped.bootstrap.includes('./composer-bootstrap.js'), true);
assert.equal(grouped.action.includes('./composer-action-effects.js'), true);
assert.equal(grouped.publish.includes('./composer-publish-service.js'), true);
assert.equal(grouped.state.includes('./editor-drafts.js'), true);
assert.equal(grouped.ui.includes('./editor-file-tree-ui.js'), true);

assert.doesNotMatch(
  composerSource,
  /from '\.\/composer-action-dispatcher\.js'/,
  'composer root should depend on the action effects facade, not the raw dispatcher'
);

assert.doesNotMatch(
  composerSource,
  /from '\.\/publish\/transports\//,
  'composer root should route publishing through composer-publish-service and publish/commit-service'
);

assert.match(
  contractSource,
  /reason: 'publish transport settings and Connect presets'/,
  'contract entries should record why cross-domain imports are still allowed'
);

assert.deepEqual(
  validateComposerRootImportContract(['./known.js'], [
    { specifier: './other.js', group: 'runtime', reason: 'test' }
  ]),
  [
    'composer root import ./known.js is not classified',
    'composer root contract entry ./other.js is stale'
  ],
  'contract validation should catch unclassified imports and stale entries'
);

console.log('ok - composer root contract');
