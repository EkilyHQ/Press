import { buildConnectStatusUrl, CONNECT_PRODUCT_STATE_PATH } from './connect-status.js';

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

function normalizeDesired(input) {
  const source = input && typeof input === 'object' ? input : {};
  const pressSystem = source.pressSystem && typeof source.pressSystem === 'object' ? source.pressSystem : {};
  return {
    ...source,
    pressSystem: {
      ...pressSystem,
      version: safeString(pressSystem.version).trim(),
      tag: safeString(pressSystem.tag).trim(),
      runtime: normalizeRuntime(pressSystem.runtime),
      asset: normalizeArtifact(pressSystem.asset)
    }
  };
}

function normalizeObserved(input) {
  const source = input && typeof input === 'object' ? input : {};
  const themes = source.themes && typeof source.themes === 'object' ? source.themes : {};
  const catalog = themes.catalog && typeof themes.catalog === 'object' ? themes.catalog : {};
  const pressSystem = source.pressSystem && typeof source.pressSystem === 'object' ? source.pressSystem : {};
  const connect = source.connect && typeof source.connect === 'object' ? source.connect : {};
  return {
    ...source,
    checkedAt: safeString(source.checkedAt).trim(),
    pressSystem: {
      ...pressSystem,
      status: normalizeStatus(pressSystem.status),
      version: safeString(pressSystem.version).trim(),
      tag: safeString(pressSystem.tag).trim(),
      runtime: normalizeRuntime(pressSystem.runtime),
      asset: normalizeArtifact(pressSystem.asset)
    },
    downstream: normalizeComponentMap(source.downstream),
    themeDemos: normalizeComponentMap(source.themeDemos),
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
    }
  };
}

function normalizeVerdict(input) {
  const source = input && typeof input === 'object' ? input : {};
  const counts = source.counts && typeof source.counts === 'object' ? source.counts : {};
  return {
    ...source,
    status: normalizeStatus(source.status),
    converged: source.converged === true,
    counts: {
      ok: Number(counts.ok || 0),
      pending: Number(counts.pending || 0),
      unknown: Number(counts.unknown || 0),
      drift: Number(counts.drift || 0)
    },
    problemCount: Number(source.problemCount || 0),
    blockingProblemCount: Number(source.blockingProblemCount || 0),
    nonBlockingProblemCount: Number(source.nonBlockingProblemCount || 0),
    blockingProblems: Array.isArray(source.blockingProblems) ? source.blockingProblems.map(normalizeProblem) : [],
    nonBlockingProblems: Array.isArray(source.nonBlockingProblems) ? source.nonBlockingProblems.map(normalizeProblem) : []
  };
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
    desired: normalizeDesired(input.desired),
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
    observed: normalizeObserved(input.observed),
    verdict: normalizeVerdict(input.verdict),
    problems: Array.isArray(input.problems) ? input.problems.map(normalizeProblem) : []
  };
}

export function getProductStateThemeEntry(productState, slug) {
  const value = safeString(slug).trim();
  if (!value || !productState || !productState.themes || !Array.isArray(productState.themes.entries)) return null;
  return productState.themes.entries.find((entry) => entry.slug === value) || null;
}

function productStateUrls(options = {}) {
  if (options.url) return [String(options.url)];
  const urls = [];
  const connectUrl = buildConnectStatusUrl(CONNECT_PRODUCT_STATE_PATH, options);
  if (connectUrl) urls.push(connectUrl);
  urls.push(PRODUCT_STATE_URL);
  return Array.from(new Set(urls.filter(Boolean)));
}

function unwrapProductStatePayload(input) {
  if (input && typeof input === 'object' && input.ok === true && input.productState) {
    return input.productState;
  }
  return input;
}

export async function loadProductState(options = {}) {
  const fetchImpl = typeof options.fetchImpl === 'function'
    ? options.fetchImpl
    : (typeof fetch === 'function' ? fetch : null);
  if (typeof fetchImpl !== 'function') throw new Error('Product state fetch is unavailable.');
  const urls = productStateUrls(options);
  let lastError = null;
  for (const url of urls) {
    try {
      const response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response || !response.ok) throw new Error('Unable to load product state.');
      return normalizeProductState(unwrapProductStatePayload(await response.json()));
    } catch (err) {
      lastError = err;
      if (options.url) break;
    }
  }
  throw lastError || new Error('Unable to load product state.');
}
