import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertThemeRouteGuardCorpusIntegrity } from './theme-route-guard-corpus.mjs';

const root = process.cwd();
const system = JSON.parse(await fs.readFile(path.join(root, 'assets', 'press-system.json'), 'utf8'));
const sourceManifest = JSON.parse(
  await fs.readFile(path.join(root, 'packages', 'press-theme-contract', 'package.json'), 'utf8')
);
const EXPECTED_PACKAGE_FILES = [
  'assets/js/press-version.js',
  'assets/js/theme-contract-surface.mjs',
  'assets/js/theme-package-core.js',
  'assets/js/theme-route-guard-html.js',
  'assets/js/theme-route-guard.js',
  'assets/js/theme-settings.js',
  'assets/js/vendor/acorn-walk.mjs',
  'assets/js/vendor/acorn.mjs',
  'assets/js/vendor/fflate.browser.js',
  'index.mjs',
  'package.json',
  'scripts/sync-assets.mjs'
].sort();

assert.equal(sourceManifest.name, '@ekilyhq/press-theme-contract');
assert.equal(sourceManifest.version, system.version);
assert.equal(system.version, '3.4.139');
assert.equal(system.tag, `v${system.version}`);
assert.equal(sourceManifest.publishConfig && sourceManifest.publishConfig.registry, 'https://npm.pkg.github.com');
assertThemeRouteGuardCorpusIntegrity();

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'press-theme-contract-package-'));
try {
  const sourceImport = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import assert from 'node:assert/strict';
    import {
      PRESS_THEME_CONTRACT,
      containsForbiddenV4RouteConstruction,
      validateThemeConfigSchema,
      validateThemeRouteHelperContract
    } from './packages/press-theme-contract/index.mjs';
    import {
      THEME_ROUTE_GUARD_CASES,
      assertThemeRouteGuardBrowserDifferentials,
      assertThemeRouteGuardImplementation,
      assertThemeRouteGuardNestedHtmlResolution,
      assertThemeRouteGuardValidator
    } from './scripts/theme-route-guard-corpus.mjs';

    assert.equal(PRESS_THEME_CONTRACT.contractVersion, 4);
    assert.equal(typeof containsForbiddenV4RouteConstruction, 'function');
    assert.equal(typeof validateThemeConfigSchema, 'function');
    assert.equal(typeof validateThemeRouteHelperContract, 'function');
    assertThemeRouteGuardImplementation(
      'source @ekilyhq/press-theme-contract route guard',
      containsForbiddenV4RouteConstruction,
      THEME_ROUTE_GUARD_CASES
    );
    assertThemeRouteGuardNestedHtmlResolution(
      'source @ekilyhq/press-theme-contract route guard',
      containsForbiddenV4RouteConstruction
    );
    assertThemeRouteGuardBrowserDifferentials(
      'source @ekilyhq/press-theme-contract route guard',
      containsForbiddenV4RouteConstruction
    );
    assertThemeRouteGuardValidator(
      'source @ekilyhq/press-theme-contract validator',
      validateThemeRouteHelperContract,
      THEME_ROUTE_GUARD_CASES
    );
    assert.equal(
      containsForbiddenV4RouteConstruction('export const = ;', { path: 'modules/broken.js', files: [] }),
      true,
      'source package route guard must fail closed for unparseable executable JavaScript'
    );
  `
    ],
    {
      cwd: root,
      encoding: 'utf8'
    }
  );
  if (sourceImport.status !== 0) {
    throw new Error(`source package import failed:\n${sourceImport.stdout}\n${sourceImport.stderr}`);
  }

  const sourcePackDir = path.join(tempDir, 'source-pack');
  await fs.mkdir(sourcePackDir);
  const sourcePack = spawnSync(
    'npm',
    ['pack', './packages/press-theme-contract', '--json', '--pack-destination', sourcePackDir],
    {
      cwd: root,
      encoding: 'utf8'
    }
  );
  if (sourcePack.status !== 0) {
    throw new Error(`source npm pack failed:\n${sourcePack.stdout}\n${sourcePack.stderr}`);
  }
  const sourcePacked = JSON.parse(sourcePack.stdout);
  const sourceFiles = (sourcePacked[0].files || []).map((file) => file.path).sort();
  assert.deepEqual(sourceFiles, EXPECTED_PACKAGE_FILES, 'source package inventory must match the locked allowlist');

  const build = spawnSync(
    process.execPath,
    ['scripts/build-theme-contract-package.mjs', '--out', path.join(tempDir, 'build')],
    {
      cwd: root,
      encoding: 'utf8'
    }
  );
  if (build.status !== 0) {
    throw new Error(`package build failed:\n${build.stdout}\n${build.stderr}`);
  }
  const packageRoot = build.stdout.trim().split(/\r?\n/).pop();
  const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.name, '@ekilyhq/press-theme-contract');
  assert.equal(manifest.version, system.version);

  const pack = spawnSync('npm', ['pack', '--json', '--pack-destination', tempDir], {
    cwd: packageRoot,
    encoding: 'utf8'
  });
  if (pack.status !== 0) {
    throw new Error(`npm pack failed:\n${pack.stdout}\n${pack.stderr}`);
  }
  const packed = JSON.parse(pack.stdout);
  const tarball = path.join(tempDir, packed[0].filename);
  const compare = spawnSync(process.execPath, ['scripts/compare-theme-contract-package.mjs', tarball, tarball], {
    cwd: root,
    encoding: 'utf8'
  });
  if (compare.status !== 0) {
    throw new Error(`package compare self-check failed:\n${compare.stdout}\n${compare.stderr}`);
  }
  const files = (packed[0].files || []).map((file) => file.path).sort();
  assert.deepEqual(files, EXPECTED_PACKAGE_FILES, 'built package inventory must match the locked allowlist');

  const installDir = path.join(tempDir, 'consumer');
  await fs.mkdir(installDir);
  await fs.writeFile(path.join(installDir, 'package.json'), '{"type":"module"}\n');
  const install = spawnSync('npm', ['install', '--ignore-scripts', tarball], {
    cwd: installDir,
    encoding: 'utf8'
  });
  if (install.status !== 0) {
    throw new Error(`npm install failed:\n${install.stdout}\n${install.stderr}`);
  }

  await fs.copyFile(
    path.join(root, 'scripts', 'theme-route-guard-corpus.mjs'),
    path.join(installDir, 'theme-route-guard-corpus.mjs')
  );
  await fs.writeFile(
    path.join(installDir, 'check.mjs'),
    `
    import assert from 'node:assert/strict';
    import {
      PRESS_THEME_CONTRACT,
      containsForbiddenV4RouteConstruction,
      validateThemeRouteHelperContract
    } from '@ekilyhq/press-theme-contract';
    import {
      THEME_ROUTE_GUARD_CASES,
      assertThemeRouteGuardBrowserDifferentials,
      assertThemeRouteGuardImplementation,
      assertThemeRouteGuardNestedHtmlResolution,
      assertThemeRouteGuardValidator
    } from './theme-route-guard-corpus.mjs';

    assert.equal(PRESS_THEME_CONTRACT.contractVersion, 4);
    assert.deepEqual(PRESS_THEME_CONTRACT.supportedContractVersions, [4]);
    assert.equal(typeof containsForbiddenV4RouteConstruction, 'function');
    assert.equal(typeof validateThemeRouteHelperContract, 'function');
    assert.deepEqual(PRESS_THEME_CONTRACT.archive.textExtensions, ['.css', '.htm', '.html', '.js', '.json', '.mjs', '.svg', '.txt']);
    assertThemeRouteGuardImplementation(
      'installed @ekilyhq/press-theme-contract route guard',
      containsForbiddenV4RouteConstruction,
      THEME_ROUTE_GUARD_CASES
    );
    assertThemeRouteGuardNestedHtmlResolution(
      'installed @ekilyhq/press-theme-contract route guard',
      containsForbiddenV4RouteConstruction
    );
    assertThemeRouteGuardBrowserDifferentials(
      'installed @ekilyhq/press-theme-contract route guard',
      containsForbiddenV4RouteConstruction
    );
    assertThemeRouteGuardValidator(
      'installed @ekilyhq/press-theme-contract validator',
      validateThemeRouteHelperContract,
      THEME_ROUTE_GUARD_CASES
    );
    assert.equal(
      containsForbiddenV4RouteConstruction('export const = ;', { path: 'modules/broken.js', files: [] }),
      true,
      'installed package route guard must fail closed for unparseable executable JavaScript'
    );

    const v3 = validateThemeRouteHelperContract([{ path: 'modules/layout.js', source: 'export const href = "?tab=posts";' }], { contractVersion: 3 });
    assert.equal(v3.ok, true);
    assert.deepEqual(v3.failures, []);

    const v4 = validateThemeRouteHelperContract([{ path: 'modules/layout.js', source: 'export const href = "?tab=posts";' }], { contractVersion: 4, label: 'arcus' });
    assert.equal(v4.ok, false);
    assert.match(v4.failures.join('\\n'), /arcus: contract v4 source must use router href helpers/);
  `
  );
  const check = spawnSync(process.execPath, ['check.mjs'], {
    cwd: installDir,
    encoding: 'utf8'
  });
  if (check.status !== 0) {
    throw new Error(`package consumer import failed:\n${check.stdout}\n${check.stderr}`);
  }
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
