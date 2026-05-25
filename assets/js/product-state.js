export const PRODUCT_STATE_URL = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/product-state.json';

const PRODUCT_STATE_TYPE = 'ekily-product-state';
const STATUS_VALUES = new Set(['ok', 'pending', 'unknown', 'drift']);

function safeString(value) {
  return value == null ? '' : String(value);
}

function normalizeStatus(value) {
  const status = safeString(value).trim().toLowerCase();
  return STATUS_VALUES.has(status) ? status : 'unknown';
}

function normalizeProblem(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    severity: safeString(source.severity || 'error').trim(),
    component: safeString(source.component).trim(),
    code: safeString(source.code || 'invalid_state').trim(),
    message: safeString(source.message).trim(),
    owner: safeString(source.owner).trim(),
    blocking: source.blocking !== false
  };
}

function normalizeArtifact(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    name: safeString(source.name).trim(),
    url: safeString(source.url).trim(),
    size: Number(source.size || 0),
    digest: safeString(source.digest).trim()
  };
}

function normalizeRuntime(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    manifestPath: safeString(source.manifestPath).trim(),
    type: safeString(source.type).trim(),
    strategy: safeString(source.strategy).trim(),
    cacheKey: safeString(source.cacheKey).trim(),
    entryCount: Number(source.entryCount || 0),
    edgeCount: Number(source.edgeCount || 0)
  };
}

function normalizeThemeEntry(input) {
  const source = input && typeof input === 'object' ? input : {};
  const slug = safeString(source.slug || source.value).trim();
  return {
    slug,
    label: safeString(source.label || slug).trim(),
    repository: safeString(source.repository).trim(),
    manifestUrl: safeString(source.manifestUrl).trim(),
    status: normalizeStatus(source.status),
    version: safeString(source.version).trim(),
    contractVersion: Number.isFinite(Number(source.contractVersion)) ? Number(source.contractVersion) : null,
    engines: source.engines && typeof source.engines === 'object' ? { ...source.engines } : {},
    artifact: normalizeArtifact(source.artifact),
    problems: Array.isArray(source.problems) ? source.problems.map((problem) => safeString(problem).trim()).filter(Boolean) : [],
    error: safeString(source.error).trim()
  };
}

function normalizeComponentMap(input) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(Object.entries(source).map(([key, value]) => {
    const entry = value && typeof value === 'object' ? value : {};
    return [key, {
      ...entry,
      status: normalizeStatus(entry.status),
      expectedVersion: safeString(entry.expectedVersion).trim(),
      observedVersion: safeString(entry.observedVersion).trim()
    }];
  }));
}

export function normalizeProductState(input) {
  if (!input || typeof input !== 'object') throw new Error('Product state is missing.');
  if (Number(input.schemaVersion) !== 1 || input.type !== PRODUCT_STATE_TYPE) {
    throw new Error('Product state must be schemaVersion 1 and type "ekily-product-state".');
  }
  const themes = input.themes && typeof input.themes === 'object' ? input.themes : {};
  const catalog = themes.catalog && typeof themes.catalog === 'object' ? themes.catalog : {};
  const pressSystem = input.pressSystem && typeof input.pressSystem === 'object' ? input.pressSystem : {};
  const connect = input.connect && typeof input.connect === 'object' ? input.connect : {};
  return {
    schemaVersion: 1,
    type: PRODUCT_STATE_TYPE,
    generatedAt: safeString(input.generatedAt).trim(),
    status: normalizeStatus(input.status),
    pressSystem: {
      ...pressSystem,
      status: normalizeStatus(pressSystem.status),
      version: safeString(pressSystem.version).trim(),
      tag: safeString(pressSystem.tag).trim(),
      runtime: normalizeRuntime(pressSystem.runtime)
    },
    downstream: normalizeComponentMap(input.downstream),
    themeDemos: normalizeComponentMap(input.themeDemos),
    themes: {
      catalog: {
        ...catalog,
        status: normalizeStatus(catalog.status),
        count: Number(catalog.count || 0)
      },
      entries: Array.isArray(themes.entries) ? themes.entries.map(normalizeThemeEntry).filter((entry) => entry.slug) : []
    },
    connect: {
      ...connect,
      status: normalizeStatus(connect.status),
      service: safeString(connect.service).trim(),
      version: safeString(connect.version).trim()
    },
    problems: Array.isArray(input.problems) ? input.problems.map(normalizeProblem) : []
  };
}

export function getProductStateThemeEntry(productState, slug) {
  const value = safeString(slug).trim();
  if (!value || !productState || !productState.themes || !Array.isArray(productState.themes.entries)) return null;
  return productState.themes.entries.find((entry) => entry.slug === value) || null;
}

export async function loadProductState(options = {}) {
  const fetchImpl = typeof options.fetchImpl === 'function'
    ? options.fetchImpl
    : (typeof fetch === 'function' ? fetch : null);
  if (typeof fetchImpl !== 'function') throw new Error('Product state fetch is unavailable.');
  const url = options.url || PRODUCT_STATE_URL;
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response || !response.ok) throw new Error('Unable to load product state.');
  return normalizeProductState(await response.json());
}
