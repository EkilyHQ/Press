import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPressSystemManifestLoader,
  loadPressSystemManifest,
  normalizePressSystemManifest,
  setPressSystemManifestForTests
} from '../assets/js/press-version.js';

const source = readFileSync(new URL('../assets/js/press-version.js', import.meta.url), 'utf8');

assert.doesNotMatch(
  source,
  /^let\s+pressSystemCache\b/m,
  'press-version should not keep the Press manifest cache as module-level mutable state'
);
assert.match(
  source,
  /export function createPressSystemManifestLoader\(options = \{\}\) \{[\s\S]*let manifestCache[\s\S]*async load\(loadOptions = \{\}\)[\s\S]*setForTests\(manifest\)/,
  'press-version should expose explicit loader instances for Press manifest cache state'
);

function manifest(version) {
  return {
    schemaVersion: 1,
    type: 'press-system',
    version,
    tag: `v${version}`,
    upgradeFrom: { ranges: [], allowUnknownSource: true, message: '' }
  };
}

function createFetch(manifestValue, calls) {
  return async (path, init) => {
    calls.push({ path, init });
    return { ok: true, json: async () => manifestValue };
  };
}

const firstCalls = [];
const secondCalls = [];
const firstLoader = createPressSystemManifestLoader({ fetchImpl: createFetch(manifest('3.4.1'), firstCalls) });
const secondLoader = createPressSystemManifestLoader({ fetchImpl: createFetch(manifest('3.4.2'), secondCalls) });

assert.equal((await firstLoader.load()).version, '3.4.1');
assert.equal((await firstLoader.load()).version, '3.4.1');
assert.equal(firstCalls.length, 1);

assert.equal((await secondLoader.load()).version, '3.4.2');
assert.equal(secondCalls.length, 1);

secondLoader.setForTests(manifest('3.4.3'));
assert.equal((await secondLoader.load()).version, '3.4.3');
assert.equal(secondCalls.length, 1);

setPressSystemManifestForTests(manifest('3.4.4'), { manifestLoader: firstLoader });
assert.equal((await loadPressSystemManifest({ manifestLoader: firstLoader })).version, '3.4.4');
assert.equal((await loadPressSystemManifest({ manifestLoader: secondLoader })).version, '3.4.3');

const guardedManifest = normalizePressSystemManifest({
  ...manifest('3.4.123'),
  themeContractUpgrade: {
    requiresInstalledThemeContractVersion: 4,
    message: 'Update installed themes to contract v4 first.'
  },
  contentModelUpgrade: {
    requiresUnifiedIndexTabs: true,
    message: 'Publish content model migration first.'
  }
});
assert.equal(guardedManifest.themeContractUpgrade.requiresInstalledThemeContractVersion, 4);
assert.equal(guardedManifest.themeContractUpgrade.message, 'Update installed themes to contract v4 first.');
assert.equal(guardedManifest.contentModelUpgrade.requiresUnifiedIndexTabs, true);
assert.equal(guardedManifest.contentModelUpgrade.message, 'Publish content model migration first.');

const unguardedManifest = normalizePressSystemManifest(manifest('3.4.122'));
assert.equal(unguardedManifest.themeContractUpgrade.requiresInstalledThemeContractVersion, 0);
assert.equal(unguardedManifest.contentModelUpgrade.requiresUnifiedIndexTabs, false);

console.log('ok - press system manifest loader state is explicit per instance');
