import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectTests, validateManifest } from './run-tests.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(resolve(here, 'test-manifest.json'), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

const validation = validateManifest(manifest);
const full = selectTests(validation.tests, validation.tierOrder, {
  tests: [],
  tier: 'full'
});

assert.equal(full.length, manifest.expected.logical);
assert.equal(full.every((entry) => entry.tier.includes('full')), true);
assert.equal(new Set(full.map((entry) => entry.id)).size, full.length);
assert.equal(
  validation.tests.every((entry) => !entry.command.includes('--experimental-default-type=module')),
  true,
  'the Node 22 test contract must not retain the retired experimental module flag'
);
for (const id of [
  'editor-blocks-roundtrip',
  'frontmatter-roundtrip',
  'i18n-content-raw',
  'system-updates',
  'theme-contracts',
  'theme-manager'
]) {
  assert.match(
    validation.tests.find((entry) => entry.id === id)?.file || '',
    /\.mjs$/u,
    `${id} must retain an explicit ES module extension`
  );
}

const injectedFullOrder = clone(manifest);
injectedFullOrder.tierOrder.full = [manifest.tests[0].id];
assert.throws(
  () => validateManifest(injectedFullOrder),
  /tierOrder has unsupported tiers: full/u
);

const duplicateId = clone(manifest);
duplicateId.tests[1].id = duplicateId.tests[0].id;
assert.throws(() => validateManifest(duplicateId), /duplicate test id/u);

const inertCanonicalFile = clone(manifest);
inertCanonicalFile.tests[0].command = [
  'node',
  inertCanonicalFile.tests[1].file,
  inertCanonicalFile.tests[0].file
];
assert.throws(
  () => validateManifest(inertCanonicalFile),
  /command must execute its canonical test file directly/u
);

const missingPhysicalTest = clone(manifest);
missingPhysicalTest.tests.pop();
assert.throws(
  () => validateManifest(missingPhysicalTest),
  /manifest is missing physical tests|expected\.logical/u
);

const removedWorkflowBootstrap = clone(manifest);
const workflowContract = removedWorkflowBootstrap.tests.find((entry) => entry.id === 'system-release-workflow');
workflowContract.tier = ['full'];
removedWorkflowBootstrap.tierOrder.guard = removedWorkflowBootstrap.tierOrder.guard
  .filter((id) => id !== workflowContract.id);
removedWorkflowBootstrap.tierOrder.release = removedWorkflowBootstrap.tierOrder.release
  .filter((id) => id !== workflowContract.id);
assert.throws(
  () => validateManifest(removedWorkflowBootstrap),
  /system-release-workflow must remain in both guard and release tiers/u
);

assert.throws(
  () => selectTests(validation.tests, validation.tierOrder, {
    tests: ['not-a-real-test'],
    tier: ''
  }),
  /unknown test ids/u
);

const frontmatter = validation.tests.find((entry) => entry.id === 'frontmatter-roundtrip');
assert.deepEqual(frontmatter.alias, ['scripts/test-frontmatter-roundtrip.sh']);
assert.equal(frontmatter.command.includes('scripts/test-frontmatter-roundtrip.sh'), false);

console.log('ok - manifest test runner');
