import { mdParse } from './markdown.js';
import { renderPressMath } from './math-render.js';
import { setSafeHtml } from './safe-html.js';
import { t } from './i18n.js';
import {
  compareSemver,
  isUpgradeAllowed,
  loadPressSystemManifest,
  normalizePressSystemManifest,
  normalizeSemver,
  normalizeUpgradeFrom,
  semverToTag
} from './press-version.js';
import { isPressSystemUpdatePath } from './press-system-surface.mjs';
import { unzipSync, strFromU8 } from './vendor/fflate.browser.js';

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.yaml', '.yml', '.md', '.txt', '.html', '.css', '.svg', '.xml',
  '.map', '.config', '.ini'
]);
const TEXT_FILENAMES = new Set(['LICENSE', 'README', 'README.md', 'CHANGELOG', 'CHANGELOG.md']);

export const SYSTEM_UPDATE_ASSET_NAME_PATTERN = /^press-system-v\d+\.\d+\.\d+\.zip$/i;

const RELEASE_API_URL = 'https://api.github.com/repos/EkilyHQ/Press/releases/latest';
const RELEASE_MANIFEST_URL = 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json';

function createSystemUpdateElements() {
  return {
    root: null,
    status: null,
    downloadLink: null,
    downloadButton: null,
    selectButton: null,
    fileInput: null,
    fileSection: null,
    fileList: null,
    notes: null,
    notesWrap: null,
    currentVersion: null,
    targetVersion: null,
    metaTitle: null,
    metaPublished: null,
    assetMeta: null
  };
}

function createSystemUpdatesState() {
  return {
    initialized: false,
    releaseCache: null,
    busy: false,
    currentSummary: [],
    currentFiles: [],
    assetSha256: '',
    assetSize: 0,
    assetName: '',
    currentPressSystem: null,
    listeners: new Set(),
    elements: createSystemUpdateElements()
  };
}

function createSystemUpdatesRuntime(options = {}) {
  const state = createSystemUpdatesState();
  const documentRef = options.documentRef || null;
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : null;

  return {
    state,
    getDocument() {
      return documentRef || (typeof document !== 'undefined' ? document : null);
    },
    getFetch() {
      if (fetchImpl) return fetchImpl;
      if (typeof fetch === 'function') return fetch;
      throw new Error('System update fetch is unavailable.');
    }
  };
}

function getBuffer(view) {
  if (view instanceof Uint8Array) {
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  if (view instanceof ArrayBuffer) return view.slice(0);
  if (view && view.buffer instanceof ArrayBuffer) {
    const buf = view.buffer;
    const { byteOffset = 0, byteLength = buf.byteLength } = view;
    return buf.slice(byteOffset, byteOffset + byteLength);
  }
  return new ArrayBuffer(0);
}

async function digestSha256(buffer) {
  if (!(buffer instanceof ArrayBuffer)) buffer = getBuffer(buffer);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const view = new DataView(hash);
  const parts = [];
  for (let i = 0; i < view.byteLength; i += 4) {
    parts.push(('00000000' + view.getUint32(i).toString(16)).slice(-8));
  }
  return parts.join('');
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
}

function isTextPath(path) {
  const clean = String(path || '').trim();
  if (!clean) return false;
  const lower = clean.toLowerCase();
  for (const ext of TEXT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  const basename = clean.split('/').pop();
  if (TEXT_FILENAMES.has(basename)) return true;
  return false;
}

function formatDate(input) {
  try {
    if (!input) return '';
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  } catch (_) {
    return '';
  }
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const value = unit === 0 ? Math.round(size) : size.toFixed(1);
  return `${value} ${units[unit]}`;
}

function setStatus(runtime, text, options = {}) {
  const { elements } = runtime.state;
  if (!elements.status) return;
  const { tone = 'info' } = options;
  elements.status.textContent = text ? String(text) : '';
  elements.status.dataset.tone = tone;
}

function setBusy(runtime, flag) {
  const state = runtime.state;
  const { elements } = state;
  state.busy = !!flag;
  if (elements.downloadButton) {
    elements.downloadButton.disabled = state.busy;
    elements.downloadButton.dataset.state = state.busy ? 'busy' : 'idle';
  }
  if (elements.selectButton) {
    elements.selectButton.disabled = state.busy;
    elements.selectButton.dataset.state = state.busy ? 'busy' : 'idle';
  }
  if (elements.fileInput) {
    elements.fileInput.disabled = state.busy;
  }
}

function clearList(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function renderNotes(runtime, body) {
  const { elements } = runtime.state;
  if (!elements.notes) return;
  const raw = typeof body === 'string' ? body : '';
  const trimmed = raw.trim();
  if (trimmed) {
    const parsed = mdParse(trimmed);
    const html = typeof parsed === 'string'
      ? parsed
      : parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'post')
        ? parsed.post
        : '';
    if (html) {
      setSafeHtml(elements.notes, html, '', { alreadySanitized: true });
      try { renderPressMath(elements.notes); } catch (_) {}
      return;
    }
  }
  elements.notes.textContent = t('editor.systemUpdates.noNotes');
}

function notify(runtime) {
  const state = runtime.state;
  const snapshot = {
    summary: state.currentSummary.slice(),
    files: state.currentFiles.slice()
  };
  state.listeners.forEach((fn) => {
    try { fn(snapshot); } catch (_) { /* noop */ }
  });
}

function applySummary(runtime, entries, files) {
  const state = runtime.state;
  state.currentSummary = Array.isArray(entries) ? entries : [];
  state.currentFiles = Array.isArray(files) ? files : [];
  renderFileList(runtime);
  notify(runtime);
}

function renderFileList(runtime) {
  const { elements, currentSummary } = runtime.state;
  const documentRef = runtime.getDocument();
  const section = elements.fileSection;
  const list = elements.fileList;
  if (!section || !list || !documentRef) return;
  clearList(list);
  if (!currentSummary.length) {
    section.hidden = true;
    section.setAttribute('aria-hidden', 'true');
    return;
  }
  section.hidden = false;
  section.setAttribute('aria-hidden', 'false');
  currentSummary.forEach((entry) => {
    const item = documentRef.createElement('li');
    item.className = 'updates-file-item';
    if (entry && entry.state) item.dataset.state = entry.state;
    const name = documentRef.createElement('span');
    name.className = 'updates-file-name';
    name.textContent = entry.label || entry.path || '';
    const badge = documentRef.createElement('span');
    badge.className = 'updates-file-badge';
    if (entry && entry.state === 'added') badge.textContent = t('editor.systemUpdates.fileStatus.added');
    else if (entry && entry.state === 'modified') badge.textContent = t('editor.systemUpdates.fileStatus.modified');
    else badge.textContent = entry.state || '';
    item.appendChild(name);
    item.appendChild(badge);
    list.appendChild(item);
  });
}

function normalizeArchiveEntryPath(path) {
  const raw = String(path || '').replace(/\\+/g, '/');
  if (!raw || raw.endsWith('/')) return '';
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new Error(`Unsafe system update archive path: ${raw}`);
  }
  const clean = raw.replace(/^\/+/, '');
  const parts = clean.split('/');
  if (parts.some((part) => part === '..' || part === '.')) {
    throw new Error(`Unsafe system update archive path: ${raw}`);
  }
  return clean;
}

function stripCommonArchiveRoot(entries) {
  const paths = entries.map((name) => String(name || '').replace(/\\+/g, '/'));
  if (!paths.length) return [];
  const segments = paths.map((p) => p.split('/'));
  if (!segments.every((parts) => parts.length > 1)) return paths;
  const root = segments[0][0];
  if (!segments.every((parts) => parts[0] === root)) return paths;
  return paths.map((parts) => parts.split('/').slice(1).join('/'));
}

export function isSystemUpdatePath(path) {
  const clean = String(path || '').replace(/\\+/g, '/').replace(/^\/+/, '');
  return isPressSystemUpdatePath(clean);
}

export function collectSystemUpdateArchiveEntries(buffer) {
  const archive = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(archive || {});
  if (!names.length) return [];

  const rawEntries = names
    .map((name) => ({
      raw: name,
      path: normalizeArchiveEntryPath(name),
      data: archive[name]
    }))
    .filter((item) => item.path && item.data && item.data.length);

  const strippedPaths = stripCommonArchiveRoot(rawEntries.map((item) => item.path));
  return rawEntries.map((entry, index) => {
    const path = normalizeArchiveEntryPath(strippedPaths[index]);
    if (!isSystemUpdatePath(path)) {
      throw new Error(`Unsafe system update archive path: ${path}`);
    }
    return {
      path,
      data: entry.data
    };
  });
}

export function selectSystemUpdateAsset(releaseData) {
  const assets = Array.isArray(releaseData && releaseData.assets) ? releaseData.assets : [];
  const asset = assets.find((item) => item && SYSTEM_UPDATE_ASSET_NAME_PATTERN.test(String(item.name || '')));
  if (!asset) return null;
  return {
    name: asset.name || 'press-system.zip',
    url: asset.browser_download_url || asset.url || '',
    size: asset.size || 0,
    digest: asset.digest || ''
  };
}

function compareReleaseTags(a, b) {
  return compareSemver(a, b);
}

function isFetchableSystemUpdateAssetUrl(url) {
  return /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/Press\/release-artifacts\/v\d+\.\d+\.\d+\/press-system-v\d+\.\d+\.\d+\.zip$/i
    .test(String(url || '').trim());
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requireManifestString(manifest, key) {
  const value = manifest && manifest[key];
  if (typeof value !== 'string') {
    throw new Error(`Invalid system release manifest: missing ${key}`);
  }
  return value;
}

function normalizeReleaseCache(data) {
  const asset = selectSystemUpdateAsset(data);
  const version = normalizeSemver(data.version || data.tag_name || '');
  return {
    name: data.name || data.tag_name || 'latest',
    tag: data.tag_name || '',
    version,
    publishedAt: data.published_at || data.created_at || '',
    notes: data.body || '',
    upgradeFrom: normalizeUpgradeFrom(data.upgradeFrom),
    htmlUrl: data.html_url || '',
    asset: asset ? { ...asset, fetchable: false } : asset
  };
}

export function normalizeSystemReleaseManifest(manifest) {
  if (!isObject(manifest) || manifest.schemaVersion !== 1) {
    throw new Error('Invalid system release manifest: unsupported schema');
  }
  const name = requireManifestString(manifest, 'name');
  const tag = requireManifestString(manifest, 'tag');
  const version = normalizeSemver(manifest.version || tag);
  if (!version || semverToTag(version) !== semverToTag(tag)) {
    throw new Error('Invalid system release manifest: invalid version');
  }
  const publishedAt = requireManifestString(manifest, 'publishedAt');
  const notes = requireManifestString(manifest, 'notes');
  const htmlUrl = requireManifestString(manifest, 'htmlUrl');
  if (!isObject(manifest.asset)) {
    throw new Error('Invalid system release manifest: missing asset');
  }
  const asset = selectSystemUpdateAsset({ assets: [manifest.asset] });
  if (!asset || !asset.name || !asset.url) {
    throw new Error('Invalid system release manifest: invalid asset');
  }
  const size = Number(asset.size);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error('Invalid system release manifest: invalid asset size');
  }
  const digest = String(asset.digest || '').trim().toLowerCase();
  if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
    throw new Error('Invalid system release manifest: invalid asset digest');
  }
  return {
    name,
    tag,
    version,
    publishedAt,
    notes,
    upgradeFrom: normalizeUpgradeFrom(manifest.upgradeFrom),
    htmlUrl,
    asset: {
      ...asset,
      size,
      digest,
      fetchable: isFetchableSystemUpdateAssetUrl(asset.url)
    }
  };
}

export async function verifySystemUpdateAsset(buffer, asset = {}) {
  if (!(buffer instanceof ArrayBuffer)) buffer = getBuffer(buffer);
  const actualSize = buffer ? buffer.byteLength : 0;
  const actualSha256 = await digestSha256(buffer);
  const expectedSize = Number(asset && asset.size);
  if (Number.isFinite(expectedSize) && expectedSize > 0 && Math.abs(expectedSize - actualSize) > 0) {
    throw new Error(t('editor.systemUpdates.errors.sizeMismatch', {
      expected: formatSize(expectedSize),
      actual: formatSize(actualSize)
    }));
  }
  const expectedDigestRaw = String((asset && asset.digest) || '').trim().toLowerCase();
  const expectedDigest = expectedDigestRaw.replace(/^sha256:/, '');
  if (expectedDigest && expectedDigest !== actualSha256.toLowerCase()) {
    throw new Error(t('editor.systemUpdates.errors.digestMismatch'));
  }
  return {
    size: actualSize,
    sha256: actualSha256
  };
}

function getResponseHeader(response, name) {
  try {
    return response && response.headers && typeof response.headers.get === 'function'
      ? String(response.headers.get(name) || '')
      : '';
  } catch (_) {
    return '';
  }
}

function isRateLimitedResponse(response) {
  const status = Number(response && response.status);
  const remaining = getResponseHeader(response, 'x-ratelimit-remaining');
  return status === 429 || (status === 403 && remaining === '0');
}

function createReleaseFetchError(response) {
  const error = new Error(isRateLimitedResponse(response)
    ? t('editor.systemUpdates.errors.releaseRateLimited')
    : t('editor.systemUpdates.errors.releaseFetch'));
  error.rateLimited = isRateLimitedResponse(response);
  error.status = Number(response && response.status) || 0;
  return error;
}

export function getDisplayReleaseNotes(release) {
  if (!release || !release.asset) return '';
  return typeof release.notes === 'string' ? release.notes : '';
}

function versionLabel(version) {
  const normalized = normalizeSemver(version);
  return normalized ? `v${normalized}` : t('editor.systemUpdates.unknownVersion');
}

function renderCurrentPressVersion(runtime) {
  const { elements, currentPressSystem } = runtime.state;
  if (!elements.currentVersion) return;
  elements.currentVersion.textContent = t('editor.systemUpdates.currentVersionLabel', {
    version: versionLabel(currentPressSystem && currentPressSystem.version)
  });
}

async function refreshCurrentPressSystem(runtime, options = {}) {
  const state = runtime.state;
  try {
    state.currentPressSystem = await loadPressSystemManifest(options);
  } catch (_) {
    state.currentPressSystem = null;
  }
  renderCurrentPressVersion(runtime);
  return state.currentPressSystem;
}

function readArchivePressSystemManifest(entries) {
  const entry = entries.find((item) => item && item.path === 'assets/press-system.json');
  if (!entry) return null;
  try {
    return normalizePressSystemManifest(JSON.parse(strFromU8(entry.data)));
  } catch (err) {
    const error = new Error('System update press-system.json is invalid.');
    error.cause = err;
    throw error;
  }
}

function assertSystemUpdateCompatibility(runtime, release, archiveSystem) {
  const { currentPressSystem } = runtime.state;
  const targetVersion = normalizeSemver(
    (archiveSystem && archiveSystem.version) || (release && (release.version || release.tag)) || ''
  );
  const upgradeFrom = normalizeUpgradeFrom(
    (archiveSystem && archiveSystem.upgradeFrom) || (release && release.upgradeFrom)
  );
  const currentVersion = currentPressSystem && currentPressSystem.version ? currentPressSystem.version : '';
  if (isUpgradeAllowed(currentVersion, upgradeFrom)) return;
  const message = upgradeFrom.message || t('editor.systemUpdates.errors.upgradeBlocked', {
    current: versionLabel(currentVersion),
    target: versionLabel(targetVersion),
    ranges: upgradeFrom.ranges.join(', ') || t('editor.systemUpdates.unknownVersion')
  });
  const error = new Error(message);
  error.pressUpgradeBlocked = true;
  throw error;
}

function renderRelease(runtime) {
  renderReleaseMeta(runtime);
  renderNotes(runtime, getDisplayReleaseNotes(runtime.state.releaseCache));
  updateDownloadLink(runtime);
}

async function fetchLatestReleaseFromApi(runtime) {
  const fetchImpl = runtime.getFetch();
  const response = await fetchImpl(RELEASE_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!response.ok) throw createReleaseFetchError(response);
  const data = await response.json();
  return normalizeReleaseCache(data);
}

function getManifestUrls() {
  return [RELEASE_MANIFEST_URL];
}

async function fetchLatestReleaseFromManifest(runtime) {
  const fetchImpl = runtime.getFetch();
  let lastError = null;
  const urls = getManifestUrls();
  for (const url of urls) {
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) {
        lastError = new Error(`System release manifest fetch failed (${response.status || 'unknown'})`);
        continue;
      }
      const data = await response.json();
      return normalizeSystemReleaseManifest(data);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('System release manifest fetch failed');
}

async function fetchLatestRelease(runtime) {
  const state = runtime.state;
  if (state.releaseCache) return state.releaseCache;
  let apiRelease = null;
  let apiError = null;
  let manifestRelease = null;
  let manifestError = null;
  try {
    apiRelease = await fetchLatestReleaseFromApi(runtime);
  } catch (err) {
    apiError = err;
  }
  try {
    manifestRelease = await fetchLatestReleaseFromManifest(runtime);
  } catch (err) {
    manifestError = err;
  }

  const manifestComparison = apiRelease && manifestRelease
    ? compareReleaseTags(manifestRelease.tag, apiRelease.tag)
    : null;
  if (apiRelease && manifestRelease && manifestComparison !== null && manifestComparison >= 0) {
    state.releaseCache = manifestRelease;
  } else if (apiRelease) {
    state.releaseCache = apiRelease;
  } else if (manifestRelease) {
    state.releaseCache = manifestRelease;
  } else {
    const message = apiError && apiError.rateLimited
      ? t('editor.systemUpdates.errors.releaseRateLimited')
      : t('editor.systemUpdates.errors.releaseFetch');
    const error = new Error(message);
    error.apiError = apiError;
    error.manifestError = manifestError;
    throw error;
  }

  renderRelease(runtime);
  return state.releaseCache;
}

async function fetchSystemUpdateAsset(runtime, url) {
  const fetchImpl = runtime.getFetch();
  let response = null;
  try {
    response = await fetchImpl(url, { cache: 'no-store' });
  } catch (err) {
    const error = new Error(t('editor.systemUpdates.errors.downloadFailed'));
    error.cause = err;
    throw error;
  }
  if (!response || !response.ok) {
    throw new Error(t('editor.systemUpdates.errors.downloadFailed'));
  }
  return response.arrayBuffer();
}

function renderReleaseMeta(runtime) {
  const { elements, releaseCache } = runtime.state;
  if (!releaseCache) return;
  renderCurrentPressVersion(runtime);
  if (elements.targetVersion) {
    elements.targetVersion.textContent = t('editor.systemUpdates.targetVersionLabel', {
      version: versionLabel(releaseCache.version || releaseCache.tag)
    });
  }
  if (elements.metaTitle) {
    const { name, tag } = releaseCache;
    elements.metaTitle.textContent = tag ? t('editor.systemUpdates.latestLabel', { name, tag }) : name;
  }
  if (elements.metaPublished) {
    const date = formatDate(releaseCache.publishedAt);
    elements.metaPublished.textContent = date ? t('editor.systemUpdates.publishedLabel', { date }) : '';
  }
  if (elements.assetMeta) {
    if (releaseCache.asset) {
      const { name, size } = releaseCache.asset;
      elements.assetMeta.textContent = t('editor.systemUpdates.assetLabel', { name, size: formatSize(size) });
    } else {
      elements.assetMeta.textContent = t('editor.systemUpdates.noAsset');
    }
  }
}

function updateDownloadLink(runtime) {
  const { elements, releaseCache } = runtime.state;
  const link = elements.downloadLink;
  if (!link) return;
  let href = 'https://github.com/EkilyHQ/Press/releases/latest';
  let label = t('editor.systemUpdates.openReleasePage');
  link.removeAttribute('download');
  if (releaseCache) {
    if (releaseCache.asset && releaseCache.asset.url) {
      const name = releaseCache.asset.name || releaseCache.name || '';
      href = releaseCache.asset.url;
      label = name ? t('editor.systemUpdates.downloadAssetLink', { name }) : t('editor.systemUpdates.openDownload');
      if (releaseCache.asset.name) link.setAttribute('download', releaseCache.asset.name);
    } else if (releaseCache.htmlUrl) {
      href = releaseCache.htmlUrl;
    }
  }
  link.textContent = label;
  link.href = href;
  link.removeAttribute('aria-disabled');
}

function buildSummaryFromFiles(files) {
  return files.map((file) => ({
    kind: 'system',
    label: file.label || file.path,
    path: file.path,
    state: file.state || 'modified'
  }));
}

async function compareArchive(runtime, entries) {
  const fetchImpl = runtime.getFetch();
  const files = [];
  for (const entry of entries) {
    const { path, data } = entry;
    if (!path || !data || !data.length) continue;
    const buffer = getBuffer(data);
    const newSha = await digestSha256(buffer);
    let existingBuffer = null;
    let existingSha = '';
    try {
      const response = await fetchImpl(path, { cache: 'no-store' });
      if (response.ok) {
        existingBuffer = await response.arrayBuffer();
        existingSha = await digestSha256(existingBuffer);
      }
    } catch (_) {
      existingBuffer = null;
    }
    if (existingBuffer && existingSha === newSha) continue;
    const textPreferred = isTextPath(path);
    let content = null;
    let base64 = null;
    if (textPreferred) {
      try {
        content = strFromU8(new Uint8Array(buffer));
      } catch (_) {
        base64 = bufferToBase64(buffer);
      }
    } else {
      base64 = bufferToBase64(buffer);
    }
    if (!content && !base64) {
      content = strFromU8(new Uint8Array(buffer));
    }
    files.push({
      kind: 'system',
      label: path,
      path,
      content: content || null,
      base64: base64 || null,
      binary: !content,
      state: existingBuffer ? 'modified' : 'added',
      sha256: newSha,
      size: data.length
    });
  }
  return files;
}

async function processArchiveEntries(runtime, entries) {
  return compareArchive(runtime, entries);
}

async function analyzeArchiveWithRuntime(runtime, buffer, filename) {
  const state = runtime.state;
  if (!(buffer instanceof ArrayBuffer)) buffer = getBuffer(buffer);
  if (!buffer || !buffer.byteLength) {
    throw new Error(t('editor.systemUpdates.errors.emptyFile'));
  }

  const release = await fetchLatestRelease(runtime).catch(() => state.releaseCache);
  const nameFromRelease = release && release.asset ? (release.asset.name || release.name) : '';
  state.assetName = filename || nameFromRelease || 'release.zip';
  const verification = release && release.asset
    ? await verifySystemUpdateAsset(buffer, release.asset)
    : { sha256: await digestSha256(buffer), size: buffer.byteLength };
  state.assetSha256 = verification.sha256;
  state.assetSize = verification.size;

  if (release) {
    if (release.asset) {
      release.asset.size = state.assetSize;
      if (!release.asset.name) release.asset.name = state.assetName;
    } else {
      release.asset = { name: state.assetName, url: '', size: state.assetSize, digest: '' };
    }
    renderReleaseMeta(runtime);
    updateDownloadLink(runtime);
  }

  const { elements } = state;
  if (elements.assetMeta) {
    elements.assetMeta.textContent = t('editor.systemUpdates.assetWithHash', {
      name: state.assetName,
      size: formatSize(state.assetSize),
      hash: state.assetSha256
    });
  }

  setStatus(runtime, t('editor.systemUpdates.status.verifying'));

  let entries = [];
  let archiveSystem = null;
  let files = [];
  try {
    entries = collectSystemUpdateArchiveEntries(buffer);
    archiveSystem = readArchivePressSystemManifest(entries);
    await refreshCurrentPressSystem(runtime);
    assertSystemUpdateCompatibility(runtime, release, archiveSystem);
    files = await processArchiveEntries(runtime, entries);
  } catch (err) {
    console.error('Failed to unpack system update archive', err);
    if (err && err.pressUpgradeBlocked) throw err;
    if (err && err.message && /upgrade|version|Press/i.test(err.message)) throw err;
    throw new Error(t('editor.systemUpdates.errors.invalidArchive'));
  }

  if (!files.length) {
    setStatus(runtime, t('editor.systemUpdates.status.noChanges'), { tone: 'success' });
    applySummary(runtime, [], []);
    return;
  }

  setStatus(runtime, t('editor.systemUpdates.status.comparing'));
  applySummary(runtime, buildSummaryFromFiles(files), files);
  const count = files.length;
  setStatus(runtime, t('editor.systemUpdates.status.changes', { count }), { tone: 'warn' });
}

async function stageLatestSystemUpdateWithRuntime(runtime) {
  const release = await fetchLatestRelease(runtime);
  if (!release || !release.asset || !release.asset.url) {
    throw new Error(t('editor.systemUpdates.noAsset'));
  }
  if (release.asset.fetchable !== true) {
    throw new Error(t('editor.systemUpdates.errors.downloadFailed'));
  }
  const fileName = release.asset.name || release.name || 'press-system.zip';
  setStatus(runtime, t('editor.systemUpdates.status.downloading'));
  applySummary(runtime, [], []);
  const buffer = await fetchSystemUpdateAsset(runtime, release.asset.url);
  await analyzeArchiveWithRuntime(runtime, buffer, fileName);
}

function handleSelectClick(runtime) {
  const { busy, elements } = runtime.state;
  if (busy || !elements.fileInput) return;
  elements.fileInput.click();
}

async function handleDownloadClick(runtime) {
  if (runtime.state.busy) return;
  setBusy(runtime, true);
  try {
    await stageLatestSystemUpdateWithRuntime(runtime);
  } catch (err) {
    console.error('System update download failed', err);
    const message = err && err.message ? err.message : t('editor.systemUpdates.errors.downloadFailed');
    setStatus(runtime, message, { tone: 'error' });
    applySummary(runtime, [], []);
  } finally {
    setBusy(runtime, false);
  }
}

async function handleFileInputChange(runtime, event) {
  const { elements } = runtime.state;
  if (runtime.state.busy) return;
  const input = event && event.target ? event.target : elements.fileInput;
  if (!input || !input.files || !input.files.length) return;
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  setBusy(runtime, true);
  try {
    setStatus(runtime, t('editor.systemUpdates.status.reading'));
    applySummary(runtime, [], []);
    const buffer = await file.arrayBuffer();
    await analyzeArchiveWithRuntime(runtime, buffer, file.name);
  } catch (err) {
    console.error('System update processing failed', err);
    const message = err && err.message ? err.message : t('editor.systemUpdates.errors.generic');
    setStatus(runtime, message, { tone: 'error' });
    applySummary(runtime, [], []);
  } finally {
    setBusy(runtime, false);
  }
}

function initSystemUpdatesWithRuntime(runtime, options = {}) {
  const state = runtime.state;
  const { elements } = state;
  const documentRef = runtime.getDocument();
  if (state.initialized) {
    if (options && typeof options.onStateChange === 'function') state.listeners.add(options.onStateChange);
    return;
  }
  state.initialized = true;
  if (documentRef && typeof documentRef.getElementById === 'function') {
    elements.root = documentRef.getElementById('mode-updates');
    elements.status = documentRef.getElementById('systemUpdateStatus');
    elements.downloadLink = documentRef.getElementById('systemUpdateDownloadLink');
    elements.downloadButton = documentRef.getElementById('btnSystemDownload');
    elements.selectButton = documentRef.getElementById('btnSystemSelect');
    elements.fileInput = documentRef.getElementById('systemUpdateFileInput');
    elements.fileSection = documentRef.getElementById('systemUpdateFileSection');
    elements.fileList = documentRef.getElementById('systemUpdateFileList');
    elements.notes = documentRef.getElementById('systemUpdateReleaseNotes');
    elements.currentVersion = documentRef.getElementById('systemUpdateCurrentVersion');
    elements.targetVersion = documentRef.getElementById('systemUpdateTargetVersion');
    elements.metaTitle = documentRef.getElementById('systemUpdateReleaseMeta');
    elements.metaPublished = documentRef.getElementById('systemUpdateReleasePublished');
    elements.assetMeta = documentRef.getElementById('systemUpdateAssetMeta');
  }

  if (options && typeof options.onStateChange === 'function') state.listeners.add(options.onStateChange);

  if (elements.downloadButton) {
    elements.downloadButton.dataset.state = 'idle';
    elements.downloadButton.addEventListener('click', () => handleDownloadClick(runtime));
  }
  if (elements.selectButton) {
    elements.selectButton.dataset.state = 'idle';
    elements.selectButton.addEventListener('click', () => handleSelectClick(runtime));
  }
  if (elements.fileInput) {
    elements.fileInput.addEventListener('change', (event) => handleFileInputChange(runtime, event));
  }

  updateDownloadLink(runtime);
  setStatus(runtime, t('editor.systemUpdates.status.idle'));
  refreshCurrentPressSystem(runtime).catch(() => {});
  fetchLatestRelease(runtime).catch((err) => {
    console.error('Failed to load system update metadata', err);
    setStatus(runtime, err && err.message ? err.message : t('editor.systemUpdates.errors.releaseFetch'), { tone: 'error' });
  });
}

function getSystemUpdateSummaryEntriesWithRuntime(runtime) {
  return runtime.state.currentSummary.slice();
}

function getSystemUpdateCommitFilesWithRuntime(runtime) {
  return runtime.state.currentFiles.slice();
}

function clearSystemUpdateStateWithRuntime(runtime, options = {}) {
  const state = runtime.state;
  applySummary(runtime, [], []);
  state.currentSummary = [];
  state.currentFiles = [];
  state.assetSha256 = '';
  state.assetSize = 0;
  state.assetName = '';
  if (options && options.clearReleaseCache === true) {
    state.releaseCache = null;
  }
  if (options && options.keepStatus !== true) {
    setStatus(runtime, t('editor.systemUpdates.status.idle'));
  }
  renderReleaseMeta(runtime);
}

export function createSystemUpdatesController(options = {}) {
  const runtime = createSystemUpdatesRuntime(options);
  return {
    init(initOptions = {}) {
      return initSystemUpdatesWithRuntime(runtime, initOptions);
    },
    getSummaryEntries() {
      return getSystemUpdateSummaryEntriesWithRuntime(runtime);
    },
    getCommitFiles() {
      return getSystemUpdateCommitFilesWithRuntime(runtime);
    },
    clear(clearOptions = {}) {
      return clearSystemUpdateStateWithRuntime(runtime, clearOptions);
    },
    analyzeArchive(buffer, filename) {
      return analyzeArchiveWithRuntime(runtime, buffer, filename);
    },
    stageLatest() {
      return stageLatestSystemUpdateWithRuntime(runtime);
    }
  };
}

const defaultSystemUpdatesController = createSystemUpdatesController();

export function initSystemUpdates(options = {}) {
  return defaultSystemUpdatesController.init(options);
}

export function getSystemUpdateSummaryEntries() {
  return defaultSystemUpdatesController.getSummaryEntries();
}

export function getSystemUpdateCommitFiles() {
  return defaultSystemUpdatesController.getCommitFiles();
}

export function clearSystemUpdateState(options = {}) {
  return defaultSystemUpdatesController.clear(options);
}

export function analyzeArchive(buffer, filename) {
  return defaultSystemUpdatesController.analyzeArchive(buffer, filename);
}

export function stageLatestSystemUpdate() {
  return defaultSystemUpdatesController.stageLatest();
}
