#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  getPressSystemPackagePaths,
  getPressSystemReleasePlanPaths,
  getPressSystemRuntimeRoots,
  isPressSystemManagedRuntimePath,
  isPressSystemUpdatePath,
  PRESS_SYSTEM_SURFACE
} from '../assets/js/press-system-surface.mjs';

const packagePaths = getPressSystemPackagePaths();

assert.equal(PRESS_SYSTEM_SURFACE.schemaVersion, 1);
assert.equal(PRESS_SYSTEM_SURFACE.type, 'press-system-surface');
assert.equal(PRESS_SYSTEM_SURFACE.runtimeManifestPath, 'assets/press-runtime-manifest.json');
assert(packagePaths.includes('index.html'));
assert(packagePaths.includes('index_editor.html'));
assert(packagePaths.includes('index_editor_preview.html'));
assert(packagePaths.includes('assets/press-system.json'));
assert(packagePaths.includes('assets/main.js'));
assert(packagePaths.includes('assets/js'));
assert(packagePaths.includes('assets/i18n'));
assert(packagePaths.includes('assets/schema'));
assert(packagePaths.includes('assets/themes/native'));
assert(!packagePaths.includes('assets/themes/packs.json'));
assert(!packagePaths.includes('assets/themes/catalog.json'));
assert(!packagePaths.includes('wwwroot'));
assert(!packagePaths.includes('scripts'));

assert.deepEqual(
  execFileSync(process.execPath, ['scripts/print-press-system-surface.mjs', 'package-paths'], { encoding: 'utf8' }).trim().split('\n'),
  packagePaths
);
assert.deepEqual(
  execFileSync(process.execPath, ['scripts/print-press-system-surface.mjs', 'release-plan-paths'], { encoding: 'utf8' }).trim().split('\n'),
  getPressSystemReleasePlanPaths()
);
assert.deepEqual(
  execFileSync(process.execPath, ['scripts/print-press-system-surface.mjs', 'pages-release-plan-paths'], { encoding: 'utf8' }).trim().split('\n'),
  getPressSystemReleasePlanPaths({ includePagesMaterializer: true })
);
assert(!getPressSystemReleasePlanPaths().includes('scripts/build-pages-artifact.sh'));
assert(getPressSystemReleasePlanPaths({ includePagesMaterializer: true }).includes('scripts/build-pages-artifact.sh'));

assert(getPressSystemRuntimeRoots({ includeRuntimeManifest: true }).includes('assets/press-runtime-manifest.json'));
assert(isPressSystemManagedRuntimePath('assets/main.js'));
assert(isPressSystemManagedRuntimePath('assets/js/system-updates.js'));
assert(isPressSystemManagedRuntimePath('assets/i18n/en.js'));
assert(isPressSystemManagedRuntimePath('assets/themes/native/theme.css'));
assert(!isPressSystemManagedRuntimePath('assets/schema/site.json'));
assert(!isPressSystemManagedRuntimePath('wwwroot/post/example.md'));

assert(isPressSystemUpdatePath('index.html'));
assert(isPressSystemUpdatePath('assets/press-system.json'));
assert(isPressSystemUpdatePath('assets/press-runtime-manifest.json'));
assert(isPressSystemUpdatePath('assets/js/system-updates.js'));
assert(isPressSystemUpdatePath('assets/js/press-system-surface.mjs'));
assert(isPressSystemUpdatePath('assets/i18n/en.js'));
assert(isPressSystemUpdatePath('assets/schema/site.json'));
assert(isPressSystemUpdatePath('assets/themes/native/theme.css'));
assert(!isPressSystemUpdatePath('assets/themes/packs.json'));
assert(!isPressSystemUpdatePath('assets/themes/catalog.json'));
assert(!isPressSystemUpdatePath('assets/themes/arcus/theme.json'));
assert(!isPressSystemUpdatePath('wwwroot/post/example.md'));
assert(!isPressSystemUpdatePath('site.yaml'));
assert(!isPressSystemUpdatePath('scripts/package-system-release.sh'));
assert(!isPressSystemUpdatePath('../assets/main.js'));

console.log('ok - press system surface');
