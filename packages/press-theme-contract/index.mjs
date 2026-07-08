async function importPackagedOrSourceModule(packagePath, sourcePath) {
  try {
    return await import(packagePath);
  } catch (err) {
    if (!err || err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    return import(sourcePath);
  }
}

const contractSurface = await importPackagedOrSourceModule(
  './assets/js/theme-contract-surface.mjs',
  '../../assets/js/theme-contract-surface.mjs'
);
const themePackageCore = await importPackagedOrSourceModule(
  './assets/js/theme-package-core.js',
  '../../assets/js/theme-package-core.js'
);

const { PRESS_THEME_CONTRACT } = contractSurface;
const { containsForbiddenV4RouteConstruction } = themePackageCore;

export { PRESS_THEME_CONTRACT, containsForbiddenV4RouteConstruction };

const ROUTE_HELPER_CONTRACT_VERSION = 4;
const THEME_TEXT_EXTENSIONS = new Set(PRESS_THEME_CONTRACT.archive && PRESS_THEME_CONTRACT.archive.textExtensions);

function safeString(value) {
  return value == null ? '' : String(value);
}

function extname(path) {
  const clean = safeString(path).toLowerCase();
  const last = clean.split('/').pop() || '';
  const idx = last.lastIndexOf('.');
  return idx >= 0 ? last.slice(idx) : '';
}

function isThemeTextPath(path) {
  return THEME_TEXT_EXTENSIONS.has(extname(path));
}

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .map((file) => ({
      path: safeString(file && file.path).replace(/\\+/g, '/'),
      source: safeString(file && file.source)
    }))
    .filter((file) => file.path && file.path !== 'theme.json' && isThemeTextPath(file.path));
}

export function validateThemeRouteHelperContract(files, options = {}) {
  const contractVersion = Number(options.contractVersion);
  const label = safeString(options.label || 'theme');
  const routeGuardFiles = normalizeFiles(files);
  const failures = [];
  if (!Number.isFinite(contractVersion) || contractVersion < ROUTE_HELPER_CONTRACT_VERSION) {
    return { ok: true, failures, files: [] };
  }
  routeGuardFiles.forEach((file) => {
    if (containsForbiddenV4RouteConstruction(file.source, { path: file.path, files: routeGuardFiles })) {
      failures.push(`${label}: contract v4 source must use router href helpers instead of public route construction in ${file.path}`);
    }
  });
  return {
    ok: failures.length === 0,
    failures,
    files: failures.length ? routeGuardFiles.map((file) => file.path) : []
  };
}
