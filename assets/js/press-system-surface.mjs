const SYSTEM_PACKAGE_PATHS = Object.freeze([
  'index.html',
  'index_editor.html',
  'index_editor_preview.html',
  'assets/press-system.json',
  'assets/main.js',
  'assets/js',
  'assets/i18n',
  'assets/schema',
  'assets/themes/native'
]);

const SYSTEM_RELEASE_PLAN_ONLY_PATHS = Object.freeze([
  'packages/press-theme-contract',
  'scripts/build-theme-contract-package.mjs',
  'scripts/compare-theme-contract-package.mjs',
  'scripts/test-theme-contract-package.mjs'
]);

const SYSTEM_UPDATE_ALLOWED_FILES = Object.freeze([
  'index.html',
  'index_editor.html',
  'index_editor_preview.html',
  'assets/press-system.json',
  'assets/press-runtime-manifest.json',
  'assets/main.js'
]);

const SYSTEM_UPDATE_ALLOWED_PREFIXES = Object.freeze([
  'assets/js/',
  'assets/i18n/',
  'assets/schema/',
  'assets/themes/native/'
]);

const SYSTEM_UPDATE_BLOCKED_PATTERN = /^(?:\.git\/|\.github\/|wwwroot\/|site\.ya?ml$|site\.local\.ya?ml$|CNAME$|robots\.txt$|sitemap\.xml$|README(?:\.md)?$|BRANCHING\.md$|scripts\/|assets\/(?:avatar\.png|avatar\.jpe?g|hero\.jpeg)$)/i;

export const PRESS_SYSTEM_SURFACE = Object.freeze({
  schemaVersion: 1,
  type: 'press-system-surface',
  runtimeManifestPath: 'assets/press-runtime-manifest.json',
  packagePaths: SYSTEM_PACKAGE_PATHS,
  systemUpdate: Object.freeze({
    allowedFiles: SYSTEM_UPDATE_ALLOWED_FILES,
    allowedPrefixes: SYSTEM_UPDATE_ALLOWED_PREFIXES
  })
});

export function normalizePressSystemPath(value) {
  const clean = String(value || '').replace(/\\+/g, '/').replace(/^\/+/, '');
  if (!clean || clean.includes('\0')) return '';
  const parts = clean.split('/');
  if (parts.some((part) => part === '..' || part === '.')) return '';
  return clean;
}

export function getPressSystemPackagePaths() {
  return [...SYSTEM_PACKAGE_PATHS];
}

export function getPressSystemRuntimeRoots(options = {}) {
  const roots = [...SYSTEM_PACKAGE_PATHS];
  if (options.includeRuntimeManifest) {
    roots.push(PRESS_SYSTEM_SURFACE.runtimeManifestPath);
  }
  return roots;
}

export function getPressSystemReleasePlanPaths(options = {}) {
  const paths = new Set([...SYSTEM_PACKAGE_PATHS, ...SYSTEM_RELEASE_PLAN_ONLY_PATHS]);
  if (options.includePagesMaterializer) {
    paths.add('scripts/build-pages-artifact.sh');
    paths.add('scripts/sync-runtime-cache-keys.mjs');
  }
  return [...paths];
}

export function isPressSystemManagedRuntimePath(value) {
  const clean = normalizePressSystemPath(value);
  return clean === 'assets/main.js'
    || clean.startsWith('assets/js/')
    || clean.startsWith('assets/i18n/')
    || clean.startsWith('assets/themes/native/');
}

export function isPressSystemUpdatePath(value) {
  const clean = normalizePressSystemPath(value);
  if (!clean || SYSTEM_UPDATE_BLOCKED_PATTERN.test(clean)) return false;
  if (SYSTEM_UPDATE_ALLOWED_FILES.includes(clean)) return true;
  return SYSTEM_UPDATE_ALLOWED_PREFIXES.some((prefix) => clean.startsWith(prefix));
}
