import { mdParse } from './markdown.js';
import { renderPressMath } from './math-render.js';
import { setSafeHtml } from './safe-html.js';
import { t } from './i18n.js';
import { bindEventEffect } from './editor-effects.js';
import { EDITOR_SHELL_IDS } from './editor-shell-contract.js';
import { buildConnectStatusUrl, CONNECT_SYSTEM_RELEASE_PATH } from './connect-status.js';
import { PRESS_GITHUB_PROVIDER } from './provider-adapters.js';
import { parseYAML } from './yaml.js';
import {
  compareSemver,
  isUpgradeAllowed,
  loadPressSystemManifest,
  normalizeContentModelUpgrade,
  normalizeThemeContractUpgrade,
  normalizePressSystemManifest,
  normalizeSemver,
  normalizeUpgradeFrom,
  SECURITY_UPDATE_REQUIRED_VERSION,
  semverToTag
} from './press-version.js';
import { isPressSystemUpdatePath } from './press-system-surface.mjs';
import {
  getLegacyContentModelMigrationFiles,
  loadLegacyContentModelMigration
} from './content-model-migration.js';
import { normalizeThemeRegistry, sanitizeThemeSlug } from './theme-package-core.js';
import { unzipSync, strFromU8 } from './vendor/fflate.browser.js';

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.json', '.yaml', '.yml', '.md', '.txt', '.html', '.css', '.svg', '.xml',
  '.map', '.config', '.ini'
]);
const TEXT_FILENAMES = new Set(['LICENSE', 'README', 'README.md', 'CHANGELOG', 'CHANGELOG.md']);

export const SYSTEM_UPDATE_ASSET_NAME_PATTERN = /^press-system-v\d+\.\d+\.\d+\.zip$/i;

const RELEASE_API_URL = PRESS_GITHUB_PROVIDER.latestReleaseApiUrl;
const RELEASE_MANIFEST_URL = PRESS_GITHUB_PROVIDER.systemReleaseUrl;
const THEME_PACK_STORAGE_KEYS = ['themePackPending', 'themePack'];
const SITE_CONFIG_THEME_PACK_PATHS = ['site.yaml', 'site.yml'];
const LEGACY_CONTENT_SIDECAR_PATTERN = /(^|\/)(?:index|tabs)\.[a-z0-9][a-z0-9-]*\.ya?ml$/i;

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
    disposers: [],
    elements: createSystemUpdateElements()
  };
}

function createSystemUpdatesRuntime(options = {}) {
  const state = createSystemUpdatesState();
  const documentRef = options.documentRef || null;
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : null;
  const connectStatusOptions = {
    connectBaseUrl: options.connectBaseUrl || '',
    defaultConnect: options.defaultConnect,
    localStorageRef: options.localStorageRef || null,
    locationRef: options.locationRef || null,
    storageScope: options.storageScope || '',
    windowRef: options.windowRef || null
  };
  const getStagedThemeCommitFiles = typeof options.getStagedThemeCommitFiles === 'function'
    ? options.getStagedThemeCommitFiles
    : null;
  const getStagedContentCommitFiles = typeof options.getStagedContentCommitFiles === 'function'
    ? options.getStagedContentCommitFiles
    : null;
  const getCurrentThemePack = typeof options.getCurrentThemePack === 'function'
    ? options.getCurrentThemePack
    : null;

  return {
    state,
    getDocument() {
      return documentRef || (typeof document !== 'undefined' ? document : null);
    },
    getFetch() {
      if (fetchImpl) return fetchImpl;
      if (typeof fetch === 'function') return fetch;
      throw new Error('System update fetch is unavailable.');
    },
    getConnectStatusOptions() {
      return connectStatusOptions;
    },
    getStagedThemeCommitFiles() {
      return getStagedThemeCommitFiles ? getStagedThemeCommitFiles() : [];
    },
    getStagedContentCommitFiles() {
      return getStagedContentCommitFiles ? getStagedContentCommitFiles() : [];
    },
    getCurrentThemePack() {
      return getCurrentThemePack ? getCurrentThemePack() : null;
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

function isFetchableSystemUpdateAssetUrl(url) {
  return PRESS_GITHUB_PROVIDER.isCanonicalSystemUpdateAssetUrl(url);
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

export function isSecurityUpdateReleaseName(value) {
  return /^(?:press\s+)?security update\b/i.test(String(value || '').trim());
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
    securityUpdate: data.securityUpdate === true || isSecurityUpdateReleaseName(data.name),
    upgradeFrom: normalizeUpgradeFrom(data.upgradeFrom),
    themeContractUpgrade: normalizeThemeContractUpgrade(data.themeContractUpgrade),
    contentModelUpgrade: normalizeContentModelUpgrade(data.contentModelUpgrade),
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
  if ((compareSemver(version, SECURITY_UPDATE_REQUIRED_VERSION) >= 0
      && typeof manifest.securityUpdate !== 'boolean')
    || (Object.prototype.hasOwnProperty.call(manifest, 'securityUpdate')
      && typeof manifest.securityUpdate !== 'boolean')) {
    throw new Error('Invalid system release manifest: securityUpdate must be boolean');
  }
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
    securityUpdate: manifest.securityUpdate === true,
    upgradeFrom: normalizeUpgradeFrom(manifest.upgradeFrom),
    themeContractUpgrade: normalizeThemeContractUpgrade(manifest.themeContractUpgrade),
    contentModelUpgrade: normalizeContentModelUpgrade(manifest.contentModelUpgrade),
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

function getRawRegistryEntry(rawRegistry, slug) {
  return (Array.isArray(rawRegistry) ? rawRegistry : []).find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return String(entry.value || entry.slug || '').trim().toLowerCase() === slug;
  }) || null;
}

function readContractVersion(value) {
  const version = Number(value);
  return Number.isFinite(version) && version > 0 ? Math.floor(version) : 0;
}

function normalizeExternalThemePackSlug(value) {
  try {
    const slug = sanitizeThemeSlug(value);
    return slug && slug !== 'native' ? slug : '';
  } catch (_) {
    return '';
  }
}

function themePackLabelFromSlug(slug) {
  const value = String(slug || '').trim();
  if (!value) return '';
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : '')
    .join(' ') || value;
}

function addThemeContractCandidate(candidates, entry = {}, rawEntry = null) {
  const value = normalizeExternalThemePackSlug(entry.value || entry.slug);
  if (!value || candidates.has(value)) return;
  candidates.set(value, {
    value,
    label: entry.label || themePackLabelFromSlug(value) || value,
    rawEntry,
    source: entry.sourceKind || ''
  });
}

function getSystemUpdateLocalStorage(runtime) {
  const options = runtime && typeof runtime.getConnectStatusOptions === 'function'
    ? runtime.getConnectStatusOptions()
    : {};
  return options && options.localStorageRef ? options.localStorageRef : null;
}

function collectStoredThemePackCandidates(runtime, candidates) {
  const storageRef = getSystemUpdateLocalStorage(runtime);
  if (!storageRef || typeof storageRef.getItem !== 'function') return;
  for (const key of THEME_PACK_STORAGE_KEYS) {
    let raw = '';
    try {
      raw = storageRef.getItem(key) || '';
    } catch (_) {
      raw = '';
    }
    const value = normalizeExternalThemePackSlug(raw);
    if (value) addThemeContractCandidate(candidates, { value });
  }
}

function getStagedThemeCommitFilesForUpgrade(runtime) {
  if (!runtime || typeof runtime.getStagedThemeCommitFiles !== 'function') return [];
  try {
    const files = runtime.getStagedThemeCommitFiles();
    return Array.isArray(files) ? files.filter((file) => {
      const path = String(file && file.path || '');
      return path === 'assets/themes/packs.json' || /^assets\/themes\/[^/]+\/theme\.json$/.test(path);
    }) : [];
  } catch (_) {
    return [];
  }
}

function isDeletedCommitFile(file) {
  return !!(file && (file.deleted || file.state === 'deleted' || file.state === 'removed'));
}

function readStagedCommitFileText(file) {
  if (!file || isDeletedCommitFile(file) || file.content == null) return '';
  if (typeof file.content === 'string') return file.content;
  if (file.content instanceof Uint8Array) return strFromU8(file.content);
  try {
    return String(file.content);
  } catch (_) {
    return '';
  }
}

function stagedThemeSlugFromPath(path) {
  const match = String(path || '').match(/^assets\/themes\/([^/]+)\/theme\.json$/);
  return match ? normalizeExternalThemePackSlug(match[1]) : '';
}

function parseStagedThemeRegistryForUpgrade(stagedThemeFiles, targetVersion, requirement) {
  const file = (Array.isArray(stagedThemeFiles) ? stagedThemeFiles : [])
    .find((item) => String(item && item.path || '') === 'assets/themes/packs.json');
  if (!file) return null;
  if (isDeletedCommitFile(file)) {
    createThemeContractUpgradeError(targetVersion, requirement, [], 'registry');
  }
  try {
    const rawRegistry = JSON.parse(readStagedCommitFileText(file));
    if (!Array.isArray(rawRegistry)) {
      createThemeContractUpgradeError(targetVersion, requirement, [], 'registry');
    }
    return rawRegistry;
  } catch (_) {
    createThemeContractUpgradeError(targetVersion, requirement, [], 'registry');
  }
}

function collectStagedThemeManifestOverrides(stagedThemeFiles) {
  const overrides = new Map();
  for (const file of Array.isArray(stagedThemeFiles) ? stagedThemeFiles : []) {
    const slug = stagedThemeSlugFromPath(file && file.path);
    if (!slug) continue;
    const fallbackLabel = themePackLabelFromSlug(slug) || slug;
    if (isDeletedCommitFile(file)) {
      overrides.set(slug, {
        value: slug,
        label: fallbackLabel,
        contractVersion: 0,
        deleted: true,
        rawEntry: { value: slug, label: fallbackLabel, contractVersion: 0 }
      });
      continue;
    }
    let manifest = null;
    try {
      manifest = JSON.parse(readStagedCommitFileText(file));
    } catch (_) {
      manifest = null;
    }
    const label = String((manifest && (manifest.name || manifest.label)) || fallbackLabel).trim() || fallbackLabel;
    const contractVersion = readContractVersion(manifest && manifest.contractVersion);
    overrides.set(slug, {
      value: slug,
      label,
      contractVersion,
      deleted: false,
      rawEntry: {
        ...(manifest && typeof manifest === 'object' ? manifest : {}),
        value: slug,
        label,
        contractVersion
      }
    });
  }
  return overrides;
}

function collectRemovedStagedThemeSlugs(stagedThemeManifests, rawRegistry) {
  const removed = new Set();
  for (const entry of stagedThemeManifests.values()) {
    if (!entry.deleted) continue;
    if (!getRawRegistryEntry(rawRegistry, entry.value)) removed.add(entry.value);
  }
  return removed;
}

function getStagedContentCommitFilesForUpgrade(runtime) {
  if (!runtime || typeof runtime.getStagedContentCommitFiles !== 'function') return [];
  try {
    const files = runtime.getStagedContentCommitFiles();
    return Array.isArray(files) ? files.filter((file) => {
      const path = String(file && file.path || '').replace(/[\\]/g, '/').replace(/^\/+/, '');
      if (!path) return false;
      if (file && file.kind === 'content-model-migration') return true;
      return LEGACY_CONTENT_SIDECAR_PATTERN.test(path);
    }) : [];
  } catch (_) {
    return [];
  }
}

function normalizeContentRootForUpgrade(value) {
  const root = String(value || 'wwwroot')
    .replace(/[\\]/g, '/')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/+/g, '/');
  return root || 'wwwroot';
}

async function resolveContentRootForUpgrade(runtime) {
  const fetchImpl = runtime.getFetch();
  for (const path of SITE_CONFIG_THEME_PACK_PATHS) {
    let response = null;
    try {
      response = await fetchImpl(path, { cache: 'no-store' });
    } catch (_) {
      response = null;
    }
    if (!response || !response.ok) continue;
    try {
      const config = parseYAML(await response.text());
      if (!config || typeof config !== 'object' || Array.isArray(config)) continue;
      return normalizeContentRootForUpgrade(config.contentRoot || 'wwwroot');
    } catch (_) {
      continue;
    }
  }
  return 'wwwroot';
}

function createContentModelUpgradeError(targetVersion, requirement, files = [], reason = '') {
  const paths = (Array.isArray(files) ? files : [])
    .map(file => String(file && file.path || '').replace(/[\\]/g, '/').replace(/^\/+/, ''))
    .filter(Boolean)
    .slice(0, 6);
  const pathText = paths.length ? paths.join(', ') : 'legacy content YAML';
  let message = requirement.message || t('editor.systemUpdates.errors.contentModelUpgradeBlocked', {
    target: versionLabel(targetVersion),
    paths: pathText
  });
  if (!requirement.message && message === 'editor.systemUpdates.errors.contentModelUpgradeBlocked') {
    message = `Publish the content model migration before updating to ${versionLabel(targetVersion)}. Legacy YAML: ${pathText}.`;
  }
  if (reason === 'staged') {
    const detail = `Staged content model migration is not published yet: ${pathText}.`;
    message = requirement.message ? `${message} ${detail}` : `Publish the staged content model migration before updating to ${versionLabel(targetVersion)}. ${detail}`;
  } else if (requirement.message && paths.length) {
    message = `${message} Legacy YAML: ${pathText}.`;
  }
  const error = new Error(message);
  error.pressContentModelUpgradeBlocked = true;
  throw error;
}

async function assertContentModelCompatibility(runtime, release, archiveSystem) {
  const targetVersion = normalizeSemver(
    (archiveSystem && archiveSystem.version) || (release && (release.version || release.tag)) || ''
  );
  const archiveRequirement = normalizeContentModelUpgrade(archiveSystem && archiveSystem.contentModelUpgrade);
  const releaseRequirement = normalizeContentModelUpgrade(release && release.contentModelUpgrade);
  const requirement = archiveRequirement.requiresUnifiedIndexTabs ? archiveRequirement : releaseRequirement;
  if (!requirement.requiresUnifiedIndexTabs) return;

  const stagedContentFiles = getStagedContentCommitFilesForUpgrade(runtime);
  if (stagedContentFiles.length) {
    createContentModelUpgradeError(targetVersion, requirement, stagedContentFiles, 'staged');
  }

  const contentRoot = await resolveContentRootForUpgrade(runtime);
  const migration = await loadLegacyContentModelMigration({
    contentRoot,
    fetchImpl: runtime.getFetch()
  });
  // Historical cleanup-gated releases must still refuse to proceed while any
  // legacy sidecar exists. Recovery preserves those source files intentionally,
  // so this compatibility check must inspect discovery state rather than the
  // narrower list of files selected for deletion/staging.
  const discoveredLegacyFiles = Array.isArray(migration && migration.legacyFiles)
    ? migration.legacyFiles
      .filter(file => file && file.path)
      .map(file => ({
        ...file,
        path: String(file.path).replace(/[\\]/g, '/').replace(/^\/+/, '')
      }))
    : [];
  const legacyFiles = discoveredLegacyFiles.length
    ? discoveredLegacyFiles
    : getLegacyContentModelMigrationFiles(migration);
  if (legacyFiles.length) {
    createContentModelUpgradeError(targetVersion, requirement, legacyFiles, 'legacy');
  }
}

async function collectConfiguredThemePackCandidates(runtime, candidates) {
  if (runtime && typeof runtime.getCurrentThemePack === 'function') {
    const currentThemePack = runtime.getCurrentThemePack();
    if (currentThemePack !== null && currentThemePack !== undefined) {
      const value = normalizeExternalThemePackSlug(currentThemePack);
      if (value) addThemeContractCandidate(candidates, { value, sourceKind: 'current-site' });
      return;
    }
  }
  const fetchImpl = runtime.getFetch();
  for (const path of SITE_CONFIG_THEME_PACK_PATHS) {
    let response = null;
    try {
      response = await fetchImpl(path, { cache: 'no-store' });
    } catch (_) {
      response = null;
    }
    if (!response || !response.ok) continue;
    try {
      const config = parseYAML(await response.text());
      if (!config || typeof config !== 'object' || Array.isArray(config)) continue;
      const value = normalizeExternalThemePackSlug(config.themePack);
      if (value) addThemeContractCandidate(candidates, { value });
    } catch (_) {
      continue;
    }
    break;
  }
}

async function loadInstalledThemeRegistryForUpgrade(runtime, targetVersion, requirement) {
  const fetchImpl = runtime.getFetch();
  let response = null;
  try {
    response = await fetchImpl('assets/themes/packs.json', { cache: 'no-store' });
  } catch (err) {
    response = null;
  }
  if (!response || !response.ok) {
    createThemeContractUpgradeError(targetVersion, requirement, [], 'registry');
  }
  try {
    const rawRegistry = await response.json();
    if (!Array.isArray(rawRegistry)) {
      createThemeContractUpgradeError(targetVersion, requirement, [], 'registry');
    }
    return {
      rawRegistry,
      registry: normalizeThemeRegistry(rawRegistry)
    };
  } catch (err) {
    createThemeContractUpgradeError(targetVersion, requirement, [], 'registry');
  }
}

async function resolveInstalledThemeContractVersion(runtime, entry, rawEntry) {
  const explicit = readContractVersion(rawEntry && rawEntry.contractVersion);
  if (explicit) return { installed: true, contractVersion: explicit };
  const slug = String(entry && entry.value || '').trim().toLowerCase();
  if (!slug) return { installed: false, contractVersion: 0 };
  const hasRegistryEntry = !!rawEntry;
  try {
    const response = await runtime.getFetch()(`assets/themes/${encodeURIComponent(slug)}/theme.json`, { cache: 'no-store' });
    if (!response || !response.ok) return { installed: hasRegistryEntry, contractVersion: 0 };
    const manifest = await response.json();
    return { installed: true, contractVersion: readContractVersion(manifest && manifest.contractVersion) };
  } catch (_) {
    return { installed: hasRegistryEntry, contractVersion: 0 };
  }
}

function formatThemeContract(value) {
  const version = readContractVersion(value);
  return version ? `contract v${version}` : t('editor.systemUpdates.unknownVersion');
}

function createThemeContractUpgradeError(targetVersion, requirement, incompatible, reason = '') {
  const required = `contract v${requirement.requiresInstalledThemeContractVersion}`;
  let message = '';
  if (reason === 'registry') {
    message = t('editor.systemUpdates.errors.themeRegistryUnavailable', {
      target: versionLabel(targetVersion),
      required
    });
  } else {
    const themes = incompatible.map((entry) => `${entry.label || entry.value} (${formatThemeContract(entry.contractVersion)})`).join(', ');
    message = requirement.message || t('editor.systemUpdates.errors.themeContractUpgradeBlocked', {
      target: versionLabel(targetVersion),
      required,
      themes
    });
    if (requirement.message && themes) {
      message = `${message} ${t('editor.systemUpdates.errors.themeContractUpgradeThemes', { themes })}`;
    }
  }
  const error = new Error(message);
  error.pressThemeContractUpgradeBlocked = true;
  throw error;
}

async function assertInstalledThemeContractCompatibility(runtime, release, archiveSystem) {
  const targetVersion = normalizeSemver(
    (archiveSystem && archiveSystem.version) || (release && (release.version || release.tag)) || ''
  );
  const archiveRequirement = normalizeThemeContractUpgrade(archiveSystem && archiveSystem.themeContractUpgrade);
  const releaseRequirement = normalizeThemeContractUpgrade(release && release.themeContractUpgrade);
  const requirement = archiveRequirement.requiresInstalledThemeContractVersion ? archiveRequirement : releaseRequirement;
  const requiredVersion = requirement.requiresInstalledThemeContractVersion;
  if (!requiredVersion) return;

  const stagedThemeFiles = getStagedThemeCommitFilesForUpgrade(runtime);
  let { rawRegistry, registry } = await loadInstalledThemeRegistryForUpgrade(runtime, targetVersion, requirement);
  const stagedRawRegistry = parseStagedThemeRegistryForUpgrade(stagedThemeFiles, targetVersion, requirement);
  if (stagedRawRegistry) {
    rawRegistry = stagedRawRegistry;
    registry = normalizeThemeRegistry(stagedRawRegistry);
  }
  const stagedThemeManifests = collectStagedThemeManifestOverrides(stagedThemeFiles);
  const removedStagedThemeSlugs = collectRemovedStagedThemeSlugs(stagedThemeManifests, rawRegistry);
  const candidates = new Map();
  for (const entry of registry) {
    if (!entry || entry.builtIn || entry.value === 'native') continue;
    addThemeContractCandidate(candidates, entry, getRawRegistryEntry(rawRegistry, entry.value));
  }
  for (const entry of stagedThemeManifests.values()) {
    if (removedStagedThemeSlugs.has(entry.value)) continue;
    candidates.set(entry.value, {
      value: entry.value,
      label: entry.label,
      rawEntry: entry.rawEntry,
      source: 'staged'
    });
  }
  collectStoredThemePackCandidates(runtime, candidates);
  await collectConfiguredThemePackCandidates(runtime, candidates);
  for (const slug of removedStagedThemeSlugs) candidates.delete(slug);

  const incompatible = [];
  for (const entry of candidates.values()) {
    const stagedEntry = stagedThemeManifests.get(entry.value);
    const rawEntry = stagedEntry && !stagedEntry.deleted
      ? stagedEntry.rawEntry
      : entry.rawEntry || getRawRegistryEntry(rawRegistry, entry.value);
    const resolution = stagedEntry
      ? { installed: true, contractVersion: stagedEntry.deleted ? 0 : stagedEntry.contractVersion }
      : await resolveInstalledThemeContractVersion(runtime, entry, rawEntry);
    if (!resolution.installed && !rawEntry) continue;
    const contractVersion = resolution.contractVersion;
    if (!contractVersion || contractVersion < requiredVersion) {
      incompatible.push({
        value: entry.value,
        label: entry.label || entry.value,
        contractVersion
      });
    }
  }
  if (incompatible.length) createThemeContractUpgradeError(targetVersion, requirement, incompatible);
}

function renderRelease(runtime) {
  const { root } = runtime.state.elements;
  if (root) root.dataset.securityUpdate = runtime.state.releaseCache && runtime.state.releaseCache.securityUpdate ? 'true' : 'false';
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

function getManifestUrls(runtime) {
  const connectUrl = buildConnectStatusUrl(CONNECT_SYSTEM_RELEASE_PATH, runtime.getConnectStatusOptions());
  return Array.from(new Set([connectUrl, RELEASE_MANIFEST_URL].filter(Boolean)));
}

async function fetchLatestReleaseFromManifest(runtime) {
  const fetchImpl = runtime.getFetch();
  let lastError = null;
  const urls = getManifestUrls(runtime);
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
  let apiError = null;
  let manifestRelease = null;
  let manifestError = null;
  try {
    manifestRelease = await fetchLatestReleaseFromManifest(runtime);
  } catch (err) {
    manifestError = err;
  }
  if (manifestRelease) {
    state.releaseCache = manifestRelease;
  } else {
    try {
      state.releaseCache = await fetchLatestReleaseFromApi(runtime);
    } catch (err) {
      apiError = err;
      const message = apiError && apiError.rateLimited
        ? t('editor.systemUpdates.errors.releaseRateLimited')
        : t('editor.systemUpdates.errors.releaseFetch');
      const error = new Error(message);
      error.apiError = apiError;
      error.manifestError = manifestError;
      throw error;
    }
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
  let href = PRESS_GITHUB_PROVIDER.latestReleasePageUrl;
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
    await assertInstalledThemeContractCompatibility(runtime, release, archiveSystem);
    await assertContentModelCompatibility(runtime, release, archiveSystem);
    files = await processArchiveEntries(runtime, entries);
  } catch (err) {
    console.error('Failed to unpack system update archive', err);
    if (err && err.pressUpgradeBlocked) throw err;
    if (err && err.pressThemeContractUpgradeBlocked) throw err;
    if (err && err.pressContentModelUpgradeBlocked) throw err;
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
    elements.root = documentRef.getElementById(EDITOR_SHELL_IDS.modeUpdates);
    elements.status = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateStatus);
    elements.downloadLink = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateDownloadLink);
    elements.downloadButton = documentRef.getElementById(EDITOR_SHELL_IDS.btnSystemDownload);
    elements.selectButton = documentRef.getElementById(EDITOR_SHELL_IDS.btnSystemSelect);
    elements.fileInput = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateFileInput);
    elements.fileSection = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateFileSection);
    elements.fileList = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateFileList);
    elements.notes = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateReleaseNotes);
    elements.currentVersion = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateCurrentVersion);
    elements.targetVersion = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateTargetVersion);
    elements.metaTitle = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateReleaseMeta);
    elements.metaPublished = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateReleasePublished);
    elements.assetMeta = documentRef.getElementById(EDITOR_SHELL_IDS.systemUpdateAssetMeta);
  }

  if (options && typeof options.onStateChange === 'function') state.listeners.add(options.onStateChange);
  const trackDisposer = (dispose) => {
    if (typeof dispose === 'function') state.disposers.push(dispose);
  };

  if (elements.downloadButton) {
    elements.downloadButton.dataset.state = 'idle';
    trackDisposer(bindEventEffect(elements.downloadButton, 'click', () => handleDownloadClick(runtime)));
  }
  if (elements.selectButton) {
    elements.selectButton.dataset.state = 'idle';
    trackDisposer(bindEventEffect(elements.selectButton, 'click', () => handleSelectClick(runtime)));
  }
  if (elements.fileInput) {
    trackDisposer(bindEventEffect(elements.fileInput, 'change', (event) => handleFileInputChange(runtime, event)));
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

function disposeSystemUpdatesWithRuntime(runtime) {
  const state = runtime.state;
  state.disposers.splice(0, state.disposers.length).reverse().forEach((dispose) => {
    try { dispose(); } catch (_) {}
  });
  state.listeners.clear();
  state.initialized = false;
  return true;
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
    dispose() {
      return disposeSystemUpdatesWithRuntime(runtime);
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
