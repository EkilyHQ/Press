export const GITHUB_PROVIDER_ID = 'github';

const DEFAULT_OWNER = 'EkilyHQ';
const DEFAULT_PRESS_REPOSITORY = `${DEFAULT_OWNER}/Press`;
const DEFAULT_THEME_CATALOG_REPOSITORY = `${DEFAULT_OWNER}/Press-Theme-Catalog`;
const DEFAULT_RELEASE_ARTIFACTS_REF = 'release-artifacts';
const DEFAULT_CATALOG_REF = 'main';

function safeString(value) {
  return value == null ? '' : String(value);
}

function trimOrigin(value, fallback) {
  const raw = safeString(value || fallback).trim().replace(/\/+$/u, '');
  try {
    return new URL(raw).origin;
  } catch (_) {
    return fallback;
  }
}

function normalizeRepository(value, fallback) {
  const raw = safeString(value || fallback).trim();
  const parts = raw.split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) throw new Error(`Invalid repository: ${raw || '(empty)'}`);
  return `${parts[0]}/${parts[1]}`;
}

function repositoryParts(repository) {
  const [owner, name] = normalizeRepository(repository).split('/');
  return { owner, name };
}

function normalizePath(value) {
  const clean = safeString(value).replace(/\\+/g, '/').replace(/^\/+|\/+$/g, '');
  if (!clean || clean.includes('\0')) return '';
  const parts = clean.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return '';
  return parts.join('/');
}

function encodePath(value) {
  return normalizePath(value).split('/').map(encodeURIComponent).join('/');
}

function escapeRegExp(value) {
  return safeString(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRawUrl({ rawBaseUrl, repository, ref, path }) {
  const { owner, name } = repositoryParts(repository);
  const normalizedRef = normalizePath(ref);
  const normalizedPath = normalizePath(path);
  if (!normalizedRef || !normalizedPath) throw new Error('Raw provider URL requires a ref and path.');
  return `${rawBaseUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${encodePath(normalizedRef)}/${encodePath(normalizedPath)}`;
}

function buildApiUrl({ apiBaseUrl, repository, path }) {
  const { owner, name } = repositoryParts(repository);
  const cleanPath = normalizePath(path);
  if (!cleanPath) throw new Error('API provider URL requires a path.');
  return `${apiBaseUrl}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${encodePath(cleanPath)}`;
}

function buildWebUrl({ webBaseUrl, repository, path }) {
  const { owner, name } = repositoryParts(repository);
  const cleanPath = normalizePath(path);
  return `${webBaseUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}${cleanPath ? `/${encodePath(cleanPath)}` : ''}`;
}

function createCanonicalSystemAssetMatcher({ rawBaseUrl, pressRepository, releaseArtifactsRef }) {
  const { owner, name } = repositoryParts(pressRepository);
  const rawOrigin = new URL(rawBaseUrl).origin;
  const pattern = new RegExp(
    `^/${escapeRegExp(owner)}/${escapeRegExp(name)}/${escapeRegExp(releaseArtifactsRef)}/(v\\d+\\.\\d+\\.\\d+)/press-system-\\1\\.zip$`,
    'i'
  );
  return (value) => {
    try {
      const url = new URL(safeString(value).trim());
      return url.origin === rawOrigin && pattern.test(url.pathname);
    } catch (_) {
      return false;
    }
  };
}

export function createGitHubPressProvider(options = {}) {
  const rawBaseUrl = trimOrigin(options.rawBaseUrl, 'https://raw.githubusercontent.com');
  const apiBaseUrl = trimOrigin(options.apiBaseUrl, 'https://api.github.com');
  const webBaseUrl = trimOrigin(options.webBaseUrl, 'https://github.com');
  const pressRepository = normalizeRepository(options.pressRepository, DEFAULT_PRESS_REPOSITORY);
  const themeCatalogRepository = normalizeRepository(
    options.themeCatalogRepository,
    DEFAULT_THEME_CATALOG_REPOSITORY
  );
  const releaseArtifactsRef = normalizePath(options.releaseArtifactsRef || DEFAULT_RELEASE_ARTIFACTS_REF);
  const themeCatalogRef = normalizePath(options.themeCatalogRef || DEFAULT_CATALOG_REF);
  const buildPressArtifactUrl = (path) => buildRawUrl({
    rawBaseUrl,
    repository: pressRepository,
    ref: releaseArtifactsRef,
    path
  });
  const isCanonicalSystemUpdateAssetUrl = createCanonicalSystemAssetMatcher({
    rawBaseUrl,
    pressRepository,
    releaseArtifactsRef
  });

  return Object.freeze({
    id: GITHUB_PROVIDER_ID,
    label: 'GitHub',
    rawBaseUrl,
    apiBaseUrl,
    webBaseUrl,
    pressRepository,
    themeCatalogRepository,
    releaseArtifactsRef,
    themeCatalogRef,
    systemReleaseUrl: buildPressArtifactUrl('system-release.json'),
    productStateUrl: buildPressArtifactUrl('product-state.json'),
    releaseIntentUrl: buildPressArtifactUrl('release-intent.json'),
    latestReleaseApiUrl: buildApiUrl({
      apiBaseUrl,
      repository: pressRepository,
      path: 'releases/latest'
    }),
    latestReleasePageUrl: buildWebUrl({
      webBaseUrl,
      repository: pressRepository,
      path: 'releases/latest'
    }),
    themeCatalogUrl: buildRawUrl({
      rawBaseUrl,
      repository: themeCatalogRepository,
      ref: themeCatalogRef,
      path: 'catalog.json'
    }),
    buildPressArtifactUrl,
    isCanonicalSystemUpdateAssetUrl
  });
}

export const PRESS_GITHUB_PROVIDER = createGitHubPressProvider();
