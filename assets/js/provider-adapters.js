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

function trimBaseUrl(value, fallback) {
  const raw = safeString(value || fallback).trim().replace(/\/+$/u, '');
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`;
  } catch (_) {
    return fallback;
  }
}

function defaultGraphqlApiUrl(apiBaseUrl) {
  try {
    const url = new URL(apiBaseUrl);
    const cleanPath = url.pathname.replace(/\/+$/u, '');
    if (cleanPath.endsWith('/api/v3')) {
      return `${url.origin}${cleanPath.slice(0, -'/api/v3'.length)}/api/graphql`;
    }
  } catch (_) {}
  return `${apiBaseUrl}/graphql`;
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

function normalizeRepositoryPath(value) {
  const raw = safeString(value).trim();
  if (!raw || raw.includes('\0')) return '';
  const parts = raw
    .replace(/\\+/g, '/')
    .replace(/^\/+/, '')
    .split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function encodeRepositoryPath(value) {
  const clean = normalizeRepositoryPath(value);
  return clean ? clean.split('/').map(encodeURIComponent).join('/') : '';
}

function normalizeBranchName(value, fallback = 'main') {
  const branch = safeString(value || fallback).trim() || fallback;
  return branch.replace(/^refs\/heads\//, '') || fallback;
}

function normalizeSiteRepositoryConfig(repo, fallback = {}) {
  const source = repo && typeof repo === 'object' ? repo : {};
  const backup = fallback && typeof fallback === 'object' ? fallback : {};
  return {
    owner: safeString(source.owner || backup.owner).trim(),
    name: safeString(source.name || backup.name).trim(),
    branch: normalizeBranchName(source.branch || backup.branch || 'main')
  };
}

function inferGitHubPagesRepository(locationLike) {
  let protocol = '';
  let hostname = '';
  let pathname = '';

  try {
    if (typeof locationLike === 'string') {
      const url = new URL(locationLike);
      protocol = url.protocol;
      hostname = url.hostname;
      pathname = url.pathname;
    } else if (locationLike && typeof locationLike === 'object') {
      if (locationLike.href) {
        const url = new URL(String(locationLike.href));
        protocol = url.protocol;
        hostname = url.hostname;
        pathname = url.pathname;
      } else {
        protocol = String(locationLike.protocol || '');
        hostname = String(locationLike.hostname || '');
        pathname = String(locationLike.pathname || '');
      }
    }
  } catch (_) {
    return null;
  }

  if (protocol !== 'https:') return null;
  const host = String(hostname || '').trim().toLowerCase();
  const suffix = '.github.io';
  if (!host.endsWith(suffix)) return null;
  const owner = host.slice(0, -suffix.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(owner)) return null;

  const path = String(pathname || '');
  const rawSegments = path.split('/').filter(Boolean);
  const firstSegment = rawSegments[0] || '';
  const isRootIndexFile = rawSegments.length === 1
    && (firstSegment === 'index.html' || firstSegment === 'index_editor.html')
    && !path.endsWith('/');
  let name = '';
  if (!firstSegment || isRootIndexFile) {
    name = `${owner}.github.io`;
  } else {
    try {
      name = decodeURIComponent(firstSegment);
    } catch (_) {
      return null;
    }
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return null;

  return { owner, name, branch: 'main' };
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
  const apiBaseUrl = trimBaseUrl(options.apiBaseUrl, 'https://api.github.com');
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

export function createGitHubSiteRepositoryProvider(options = {}) {
  const apiBaseUrl = trimBaseUrl(options.apiBaseUrl, 'https://api.github.com');
  const webBaseUrl = trimOrigin(options.webBaseUrl, 'https://github.com');
  const graphqlApiUrl = trimBaseUrl(options.graphqlApiUrl, defaultGraphqlApiUrl(apiBaseUrl));

  function buildNewFileUrl({ repo, branch, folderPath, folder, filename } = {}) {
    const repository = normalizeSiteRepositoryConfig(repo, { branch });
    if (!repository.owner || !repository.name) return '';
    const branchName = normalizeBranchName(branch || repository.branch);
    const cleanFolder = encodeRepositoryPath(folderPath || folder || '');
    const name = safeString(filename).trim();
    const base = `${webBaseUrl}/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/new/${encodeURIComponent(branchName)}`;
    const href = cleanFolder ? `${base}/${cleanFolder}` : base;
    return name ? `${href}?filename=${encodeURIComponent(name)}` : href;
  }

  function buildEditFileUrl({ repo, branch, filePath, path } = {}) {
    const repository = normalizeSiteRepositoryConfig(repo, { branch });
    if (!repository.owner || !repository.name) return '';
    const branchName = normalizeBranchName(branch || repository.branch);
    const cleanPath = encodeRepositoryPath(filePath || path || '');
    const base = `${webBaseUrl}/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/edit/${encodeURIComponent(branchName)}`;
    return cleanPath ? `${base}/${cleanPath}` : base;
  }

  return Object.freeze({
    id: GITHUB_PROVIDER_ID,
    label: 'GitHub',
    apiBaseUrl,
    webBaseUrl,
    graphqlApiUrl,
    inferRepositoryFromPublishedUrl: inferGitHubPagesRepository,
    normalizeRepositoryConfig: normalizeSiteRepositoryConfig,
    normalizeBranchName,
    normalizeRepositoryPath,
    encodeRepositoryPath,
    buildNewFileUrl,
    buildEditFileUrl,
    buildGraphqlHeaders(token) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${safeString(token).trim()}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };
    }
  });
}

export const PRESS_GITHUB_SITE_PROVIDER = createGitHubSiteRepositoryProvider();
