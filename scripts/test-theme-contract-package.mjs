import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const system = JSON.parse(await fs.readFile(path.join(root, 'assets', 'press-system.json'), 'utf8'));
const sourceManifest = JSON.parse(await fs.readFile(path.join(root, 'packages', 'press-theme-contract', 'package.json'), 'utf8'));

assert.equal(sourceManifest.name, '@ekilyhq/press-theme-contract');
assert.equal(sourceManifest.version, system.version);
assert.equal(system.version, '3.4.133');
assert.equal(system.tag, `v${system.version}`);
assert.equal(sourceManifest.publishConfig && sourceManifest.publishConfig.registry, 'https://npm.pkg.github.com');

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'press-theme-contract-package-'));
try {
  const sourceImport = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {
      PRESS_THEME_CONTRACT,
      containsForbiddenV4RouteConstruction,
      validateThemeConfigSchema,
      validateThemeRouteHelperContract
    } from './packages/press-theme-contract/index.mjs';

    assert.equal(PRESS_THEME_CONTRACT.contractVersion, 4);
    assert.equal(typeof containsForbiddenV4RouteConstruction, 'function');
    assert.equal(typeof validateThemeConfigSchema, 'function');
    assert.equal(typeof validateThemeRouteHelperContract, 'function');
  `], {
    cwd: root,
    encoding: 'utf8'
  });
  if (sourceImport.status !== 0) {
    throw new Error(`source package import failed:\n${sourceImport.stdout}\n${sourceImport.stderr}`);
  }

  const sourcePackDir = path.join(tempDir, 'source-pack');
  await fs.mkdir(sourcePackDir);
  const sourcePack = spawnSync('npm', ['pack', './packages/press-theme-contract', '--json', '--pack-destination', sourcePackDir], {
    cwd: root,
    encoding: 'utf8'
  });
  if (sourcePack.status !== 0) {
    throw new Error(`source npm pack failed:\n${sourcePack.stdout}\n${sourcePack.stderr}`);
  }
  const sourcePacked = JSON.parse(sourcePack.stdout);
  const sourceFiles = new Set((sourcePacked[0].files || []).map((file) => file.path));
  [
    'index.mjs',
    'scripts/sync-assets.mjs',
    'assets/js/theme-package-core.js',
    'assets/js/theme-settings.js',
    'assets/js/theme-route-guard.js',
    'assets/js/vendor/acorn.mjs',
    'assets/js/vendor/acorn-walk.mjs'
  ].forEach((file) => {
    assert.ok(sourceFiles.has(file), `source package pack must include ${file}`);
  });

  const build = spawnSync(process.execPath, ['scripts/build-theme-contract-package.mjs', '--out', path.join(tempDir, 'build')], {
    cwd: root,
    encoding: 'utf8'
  });
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
  const files = new Set((packed[0].files || []).map((file) => file.path));
  [
    'package.json',
    'index.mjs',
    'scripts/sync-assets.mjs',
    'assets/js/theme-contract-surface.mjs',
    'assets/js/theme-package-core.js',
    'assets/js/theme-route-guard.js',
    'assets/js/vendor/acorn.mjs',
    'assets/js/vendor/acorn-walk.mjs',
    'assets/js/vendor/fflate.browser.js'
  ].forEach((file) => {
    assert.ok(files.has(file), `package must include ${file}`);
  });

  const installDir = path.join(tempDir, 'consumer');
  await fs.mkdir(installDir);
  await fs.writeFile(path.join(installDir, 'package.json'), '{"type":"module"}\n');
  const install = spawnSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: installDir,
    encoding: 'utf8'
  });
  if (install.status !== 0) {
    throw new Error(`npm install failed:\n${install.stdout}\n${install.stderr}`);
  }

  await fs.writeFile(path.join(installDir, 'check.mjs'), `
    import assert from 'node:assert/strict';
    import {
      PRESS_THEME_CONTRACT,
      containsForbiddenV4RouteConstruction,
      validateThemeRouteHelperContract
    } from '@ekilyhq/press-theme-contract';

    assert.equal(PRESS_THEME_CONTRACT.contractVersion, 4);
    assert.deepEqual(PRESS_THEME_CONTRACT.supportedContractVersions, [4]);
    assert.equal(typeof containsForbiddenV4RouteConstruction, 'function');
    assert.equal(typeof validateThemeRouteHelperContract, 'function');
    assert.deepEqual(PRESS_THEME_CONTRACT.archive.textExtensions, ['.css', '.htm', '.html', '.js', '.json', '.mjs', '.svg', '.txt']);
    assert.equal(containsForbiddenV4RouteConstruction('export const href = "?id=post.md";', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('export const href = "https://example.test/products?id=sku";', { path: 'modules/layout.js', files: [] }), false);
    assert.equal(containsForbiddenV4RouteConstruction('<a href="?tab=posts">Posts</a>', { path: 'assets/link.html', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const route = new URL(location.href); const prop = "searchParams"; const method = "set"; route[prop][method]("id", post.location);', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const url = new URL(location.href); const set = url.searchParams.set; set.apply(url.searchParams, ["id", post.location]);', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const Url = window.URL; const url = new Url(location.href); url.searchParams.set("id", post.location);', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('let Url; Url = globalThis.URL; const url = new Url(location.href); url.searchParams.set("id", post.location);', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const entries = [["id", post.location]]; const params = new URLSearchParams(Object.fromEntries(entries)); const href = "?" + params;', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const qm = "?"; const href = qm + "id=" + post.location;', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const eq = "="; const href = "?id" + eq + post.location;', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); } const href = "?" + query(post);', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); } const helpers = { query }; const href = "?" + helpers.query(post);', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function query(post) { const routeKey = "id"; const params = new URLSearchParams(); params.set(routeKey, post.location); return params.toString(); } const href = "?" + query(post);', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function query(post) { const eq = "="; return "id" + eq + post.location; } const href = "?" + query(post);', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('import { query } from "./url.js"; const href = "?" + query(post);', { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function query(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }' }] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('import { query } from "./url.js"; const href = "?" + query(post);', { path: 'modules/layout.js', files: [{ path: 'modules/base.js', source: 'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }' }, { path: 'modules/url.js', source: 'import { makeQuery } from "./base.js"; export function query(post) { return makeQuery(post); }' }] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('import { query } from "./url.js"; const href = "?" + query(post);', { path: 'modules/layout.js', files: [{ path: 'modules/base.js', source: 'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }' }, { path: 'modules/url.js', source: 'import { makeQuery } from "./base.js"; export function query(post) { const makeQuery = (post) => "slug=" + post.slug; return makeQuery(post); }' }] }), false);
    assert.equal(containsForbiddenV4RouteConstruction('import theme from "./theme.js"; const href = "?" + theme.query(post);', { path: 'modules/layout.js', files: [{ path: 'modules/base.js', source: 'export function makeQuery(post) { const params = new URLSearchParams(); params.set("id", post.location); return params.toString(); }' }, { path: 'modules/theme.js', source: 'import { makeQuery } from "./base.js"; export default { query: makeQuery };' }] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function mutate(url) { url.searchParams.set("id", post.location); } mutate(new URL(location.href));', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function mutate(url) { const params = url.searchParams; params.set("id", post.location); } mutate(new URL(location.href));', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function mutate(url) { const { set } = url.searchParams; set.call(url.searchParams, "id", post.location); } mutate(new URL(location.href));', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function mutate(url) { const set = url.searchParams.set.bind(url.searchParams); set("id", post.location); } mutate(new URL(location.href));', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function mutate(url) { url.searchParams.set("id", post.location); } const bound = mutate.bind(null, new URL(location.href)); bound();', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const helpers = {}; Object.assign(helpers, { mutate(url) { url.searchParams.set("id", post.location); } }); helpers.mutate(new URL(location.href));', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('function mutate(url) { url.searchParams.set("id", sku); } mutate(new URL("https://api.example.test/product"));', { path: 'modules/layout.js', files: [] }), false);
    assert.equal(containsForbiddenV4RouteConstruction('import { mutate } from "./url.js"; mutate(new URL(location.href));', { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'export function mutate(url) { url.searchParams.set("id", post.location); }' }] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const { mutate } = require("./url.js"); mutate(new URL(location.href));', { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'exports.mutate = function(url) { url.searchParams.set("id", post.location); };' }] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('const { mutate } = require("./url.js"); mutate(new URL(location.href));', { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'exports.mutate = function(url) { url.searchParams.set("id", post.location); }; exports.mutate = function(url) { return url.href; };' }] }), false);
    assert.equal(containsForbiddenV4RouteConstruction('const { mutate } = require("./url.js"); mutate(new URL(location.href));', { path: 'modules/layout.js', files: [{ path: 'modules/url.js', source: 'exports.mutate = function(url) { url.searchParams.set("id", post.location); }; module.exports = require("./safe.js");' }, { path: 'modules/safe.js', source: 'exports.mutate = function(url) { return url.href; };' }] }), false);
    assert.equal(containsForbiddenV4RouteConstruction('export const href = \`?id=\${post.location}\`;', { path: 'modules/layout.js', files: [] }), true);
    assert.equal(containsForbiddenV4RouteConstruction('export const href = \`https://example.test/products?id=\${sku}\`;', { path: 'modules/layout.js', files: [] }), false);
    assert.equal(containsForbiddenV4RouteConstruction('export const href = \`https://\${host}/products?id=\${sku}\`;', { path: 'modules/layout.js', files: [] }), false);
    assert.equal(containsForbiddenV4RouteConstruction('export const href = \`https://example.test/\${path}?id=\${sku}\`;', { path: 'modules/layout.js', files: [] }), false);
    assert.equal(containsForbiddenV4RouteConstruction('const endpoints = { product: "https://example.test/products" }; const href = endpoints.product + "?foo=1" + "&id=" + sku;', { path: 'modules/layout.js', files: [] }), false);

    const v3 = validateThemeRouteHelperContract([{ path: 'modules/layout.js', source: 'export const href = "?tab=posts";' }], { contractVersion: 3 });
    assert.equal(v3.ok, true);
    assert.deepEqual(v3.failures, []);

    const v4 = validateThemeRouteHelperContract([{ path: 'modules/layout.js', source: 'export const href = "?tab=posts";' }], { contractVersion: 4, label: 'arcus' });
    assert.equal(v4.ok, false);
    assert.match(v4.failures.join('\\n'), /arcus: contract v4 source must use router href helpers/);
  `);
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
