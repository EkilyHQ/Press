import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const outArg = process.argv.indexOf('--out');
const outRoot = outArg >= 0 && process.argv[outArg + 1]
  ? path.resolve(process.argv[outArg + 1])
  : path.join(root, 'dist', 'theme-contract-package');
const packageRoot = path.join(outRoot, 'package');
const sourceRoot = path.join(root, 'packages', 'press-theme-contract');
const packageManifestPath = path.join(sourceRoot, 'package.json');
const systemManifestPath = path.join(root, 'assets', 'press-system.json');
const packageManifest = JSON.parse(await fs.readFile(packageManifestPath, 'utf8'));
const systemManifest = JSON.parse(await fs.readFile(systemManifestPath, 'utf8'));

if (packageManifest.name !== '@ekilyhq/press-theme-contract') {
  throw new Error('unexpected theme contract package name');
}
if (packageManifest.version !== systemManifest.version) {
  throw new Error('theme contract package version must match assets/press-system.json');
}
if (systemManifest.tag !== `v${systemManifest.version}`) {
  throw new Error('assets/press-system.json tag must match version');
}

const files = [
  ['packages/press-theme-contract/package.json', 'package.json'],
  ['packages/press-theme-contract/index.mjs', 'index.mjs'],
  ['packages/press-theme-contract/scripts/sync-assets.mjs', 'scripts/sync-assets.mjs'],
  ['assets/js/press-version.js', 'assets/js/press-version.js'],
  ['assets/js/theme-contract-surface.mjs', 'assets/js/theme-contract-surface.mjs'],
  ['assets/js/theme-package-core.js', 'assets/js/theme-package-core.js'],
  ['assets/js/theme-route-guard.js', 'assets/js/theme-route-guard.js'],
  ['assets/js/vendor/acorn.mjs', 'assets/js/vendor/acorn.mjs'],
  ['assets/js/vendor/acorn-walk.mjs', 'assets/js/vendor/acorn-walk.mjs'],
  ['assets/js/vendor/fflate.browser.js', 'assets/js/vendor/fflate.browser.js']
];

await fs.rm(packageRoot, { recursive: true, force: true });
for (const [source, target] of files) {
  const sourcePath = path.join(root, source);
  const targetPath = path.join(packageRoot, target);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);
}

console.log(packageRoot);
