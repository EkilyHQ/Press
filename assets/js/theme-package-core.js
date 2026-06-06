import { loadPressSystemManifest, satisfiesSemverRange } from './press-version.js';
import {
  PRESS_THEME_CONTRACT,
  getDefaultThemeStyles,
  getRequiredThemeComponents,
  getRequiredThemeContentShapes,
  getRequiredThemeRegions,
  getRequiredThemeViews,
  getOptionalThemeViews,
  getThemeArchiveAllowedExtensions,
  getThemeTextExtensions,
  isPressThemeContractVersionSupported
} from './theme-contract-surface.mjs';
import { unzipSync, strFromU8 } from './vendor/fflate.browser.js';

export const REQUIRED_THEME_CONTRACT_VERSION = PRESS_THEME_CONTRACT.contractVersion;

const THEME_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const THEME_RELEASE_ASSET_PATTERN = /^press-theme-[a-z0-9_-]+-v\d+\.\d+\.\d+\.zip$/i;
const THEME_ARCHIVE_ALLOWED_EXTENSIONS = new Set(getThemeArchiveAllowedExtensions());
const THEME_TEXT_EXTENSIONS = new Set(getThemeTextExtensions());
const DEFAULT_THEME_STYLES = getDefaultThemeStyles();
const REQUIRED_THEME_VIEWS = getRequiredThemeViews();
const OPTIONAL_THEME_VIEWS = getOptionalThemeViews();
const REQUIRED_THEME_REGIONS = getRequiredThemeRegions();
const REQUIRED_THEME_COMPONENTS = getRequiredThemeComponents();
const REQUIRED_THEME_CONTENT_SHAPES = getRequiredThemeContentShapes();

export function getBuffer(view) {
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

export async function digestSha256(buffer) {
  if (!(buffer instanceof ArrayBuffer)) buffer = getBuffer(buffer);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  const view = new DataView(hash);
  const parts = [];
  for (let i = 0; i < view.byteLength; i += 4) {
    parts.push(('00000000' + view.getUint32(i).toString(16)).slice(-8));
  }
  return parts.join('');
}

export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function safeString(value) {
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

export function normalizeDigest(value, options = {}) {
  const raw = safeString(value).trim().toLowerCase();
  if (!raw) {
    if (options.required) throw new Error('Theme release manifest asset digest is required.');
    return '';
  }
  const hex = raw.startsWith('sha256:') ? raw.slice(7) : raw;
  if (!/^[a-f0-9]{64}$/.test(hex)) {
    throw new Error('Theme release manifest asset digest must be a SHA-256 hash.');
  }
  return `sha256:${hex}`;
}

export function normalizeThemeEngines(input, options = {}) {
  const engines = input && typeof input === 'object' ? input : {};
  const press = safeString(engines.press || '').trim();
  if (!press && options.required) throw new Error('Theme manifest engines.press is required.');
  return press ? { press } : {};
}

export async function assertThemePressCompatibility(label, engines) {
  const normalized = normalizeThemeEngines(engines, { required: true });
  const current = await loadPressSystemManifest();
  if (!satisfiesSemverRange(current.version, normalized.press)) {
    throw new Error(`${label || 'Theme'} supports Press ${normalized.press}, but this site is running ${current.tag}.`);
  }
}

export function sanitizeThemeSlug(value) {
  const slug = safeString(value).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
  if (!THEME_SLUG_PATTERN.test(slug)) {
    throw new Error(`Invalid theme slug: ${safeString(value) || '(empty)'}`);
  }
  return slug;
}

export function normalizeThemeFilePath(path) {
  const raw = safeString(path).replace(/\\+/g, '/');
  if (!raw || raw.endsWith('/')) return '';
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  const clean = raw.replace(/^\/+/, '');
  const parts = clean.split('/');
  if (parts.some((part) => !part || part === '..' || part === '.')) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  if (clean !== 'theme.json' && clean.endsWith('/theme.json')) {
    throw new Error('Theme ZIP must contain exactly one theme.json at the theme root.');
  }
  if (clean !== 'theme.json' && !THEME_ARCHIVE_ALLOWED_EXTENSIONS.has(extname(clean))) {
    throw new Error(`Unsupported theme archive file type: ${clean}`);
  }
  return clean;
}

function validateRawThemeArchivePath(path) {
  const raw = safeString(path).replace(/\\+/g, '/');
  if (!raw || raw.endsWith('/')) return '';
  if (raw.startsWith('/') || /^[a-z]:\//i.test(raw) || /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  const parts = raw.split('/');
  if (parts.some((part) => !part || part === '..' || part === '.')) {
    throw new Error(`Unsafe theme archive path: ${raw}`);
  }
  return raw;
}

function stripCommonArchiveRoot(entries) {
  const paths = entries.map((name) => safeString(name).replace(/\\+/g, '/'));
  if (!paths.length) return [];
  const segments = paths.map((p) => p.split('/'));
  if (!segments.every((parts) => parts.length > 1)) return paths;
  const root = segments[0][0];
  if (!segments.every((parts) => parts[0] === root)) return paths;
  return segments.map((parts) => parts.slice(1).join('/'));
}

export function normalizeFileList(files) {
  const normalized = [];
  const seen = new Set();
  (Array.isArray(files) ? files : []).forEach((file) => {
    const path = normalizeThemeFilePath(file);
    if (!path || seen.has(path)) return;
    seen.add(path);
    normalized.push(path);
  });
  normalized.sort((a, b) => a.localeCompare(b));
  return normalized;
}

function requireThemeObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Theme manifest ${label} must be an object.`);
  }
  return value;
}

function requireThemeString(value, label) {
  const text = safeString(value).trim();
  if (!text) throw new Error(`Theme manifest ${label} is required.`);
  return text;
}

function requireThemeStringList(owner, key, label) {
  if (!Array.isArray(owner && owner[key])) {
    throw new Error(`Theme manifest ${label} must be an array.`);
  }
  const seen = new Set();
  return owner[key].map((item) => {
    const value = requireThemeString(item, label);
    if (seen.has(value)) throw new Error(`Theme manifest ${label} contains duplicate value: ${value}`);
    seen.add(value);
    return value;
  });
}

function validateThemeManifestFiles(themeManifest, availablePaths) {
  let styles = [];
  if (themeManifest.styles != null) {
    styles = requireThemeStringList(themeManifest, 'styles', 'styles');
  }
  if (!styles.length) styles = DEFAULT_THEME_STYLES;
  const modules = requireThemeStringList(themeManifest, 'modules', 'modules');
  if (!modules.length) throw new Error('Theme manifest modules must not be empty.');

  const normalizedModules = new Set();
  styles.forEach((entry) => {
    const path = normalizeThemeFilePath(entry);
    if (extname(path) !== '.css') throw new Error(`Theme manifest styles entry must be a CSS file: ${entry}`);
    if (!availablePaths.has(path)) throw new Error(`Theme manifest styles references missing file: ${path}`);
  });
  modules.forEach((entry) => {
    const path = normalizeThemeFilePath(entry);
    if (extname(path) !== '.js') throw new Error(`Theme manifest modules entry must be a JS file: ${entry}`);
    if (!availablePaths.has(path)) throw new Error(`Theme manifest modules references missing file: ${path}`);
    normalizedModules.add(path);
  });
  return normalizedModules;
}

function validateThemeViewDeclaration(views, view, modules) {
  const declaration = requireThemeObject(views[view], `views.${view}`);
  const modulePath = normalizeThemeFilePath(requireThemeString(declaration.module, `views.${view}.module`));
  requireThemeString(declaration.handler, `views.${view}.handler`);
  if (!modules.has(modulePath)) {
    throw new Error(`Theme manifest views.${view}.module must be listed in modules: ${modulePath}`);
  }
}

function validateThemeManifestContract(themeManifest, availablePaths) {
  requireThemeObject(themeManifest, 'theme.json');
  requireThemeString(themeManifest.name, 'name');
  requireThemeString(themeManifest.version, 'version');
  normalizeThemeEngines(themeManifest.engines, { required: true });
  const contractVersion = Number(themeManifest.contractVersion);
  if (!isPressThemeContractVersionSupported(contractVersion)) {
    throw new Error(`Theme contractVersion ${contractVersion || '(missing)'} is not supported.`);
  }

  const modules = validateThemeManifestFiles(themeManifest, availablePaths);
  const views = requireThemeObject(themeManifest.views, 'views');
  REQUIRED_THEME_VIEWS.forEach((view) => {
    validateThemeViewDeclaration(views, view, modules);
  });
  OPTIONAL_THEME_VIEWS.forEach((view) => {
    if (views[view] != null) validateThemeViewDeclaration(views, view, modules);
  });

  const regions = requireThemeObject(themeManifest.regions, 'regions');
  REQUIRED_THEME_REGIONS.forEach((region) => {
    requireThemeObject(regions[region], `regions.${region}`);
  });

  const components = new Set(requireThemeStringList(themeManifest, 'components', 'components'));
  REQUIRED_THEME_COMPONENTS.forEach((component) => {
    if (!components.has(component)) throw new Error(`Theme manifest components must include ${component}.`);
  });

  if (!Object.prototype.hasOwnProperty.call(themeManifest, 'scrollContainer')) {
    throw new Error('Theme manifest scrollContainer is required.');
  }
  requireThemeObject(themeManifest.configSchema, 'configSchema');
  const content = requireThemeObject(themeManifest.content, 'content');
  const shapes = new Set(requireThemeStringList(content, 'shapes', 'content.shapes'));
  REQUIRED_THEME_CONTENT_SHAPES.forEach((shape) => {
    if (!shapes.has(shape)) throw new Error(`Theme manifest content.shapes must include ${shape}.`);
  });

  return contractVersion;
}

function normalizeRegistrySource(input, fallbackType) {
  const source = input && typeof input === 'object' ? input : {};
  const type = safeString(source.type || fallbackType || 'manual').trim().toLowerCase() || 'manual';
  const normalized = { type };
  if (source.repo) normalized.repo = safeString(source.repo).trim();
  if (source.manifestUrl) normalized.manifestUrl = safeString(source.manifestUrl).trim();
  if (source.url) normalized.url = safeString(source.url).trim();
  return normalized;
}

export function normalizeRegistryRelease(input) {
  const release = input && typeof input === 'object' ? input : {};
  const normalized = {};
  if (release.tag) normalized.tag = safeString(release.tag).trim();
  if (release.name) normalized.name = safeString(release.name).trim();
  if (release.htmlUrl) normalized.htmlUrl = safeString(release.htmlUrl).trim();
  if (release.publishedAt) normalized.publishedAt = safeString(release.publishedAt).trim();
  if (release.assetName) normalized.assetName = safeString(release.assetName).trim();
  if (release.size != null && Number.isFinite(Number(release.size))) normalized.size = Number(release.size);
  if (release.digest) normalized.digest = normalizeDigest(release.digest);
  if (release.installedAt) normalized.installedAt = safeString(release.installedAt).trim();
  return normalized;
}

export function normalizeThemeRegistry(input) {
  const normalized = [];
  const seen = new Set();
  (Array.isArray(input) ? input : []).forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const value = sanitizeThemeSlug(entry.value);
    if (seen.has(value)) return;
    seen.add(value);
    const builtIn = value === 'native' || entry.builtIn === true;
    const contractVersion = Number(entry.contractVersion);
    const item = {
      value,
      label: safeString(entry.label || entry.name || value) || value,
      version: safeString(entry.version || ''),
      contractVersion: Number.isFinite(contractVersion) && contractVersion > 0 ? Math.floor(contractVersion) : 0,
      engines: normalizeThemeEngines(entry.engines),
      builtIn,
      removable: builtIn ? false : entry.removable !== false,
      source: normalizeRegistrySource(entry.source, builtIn ? 'builtin' : 'manual'),
      release: normalizeRegistryRelease(entry.release),
      files: normalizeFileList(entry.files)
    };
    if (builtIn) {
      item.contractVersion = REQUIRED_THEME_CONTRACT_VERSION;
      item.source = { type: 'builtin' };
      item.removable = false;
    }
    normalized.push(item);
  });
  if (!seen.has('native')) {
    normalized.unshift({
      value: 'native',
      label: 'Native',
      version: '',
      contractVersion: REQUIRED_THEME_CONTRACT_VERSION,
      engines: {},
      builtIn: true,
      removable: false,
      source: { type: 'builtin' },
      release: {},
      files: []
    });
  }
  return normalized;
}

export function normalizeThemeCatalog(input) {
  const themes = Array.isArray(input) ? input : (input && Array.isArray(input.themes) ? input.themes : []);
  const normalized = [];
  const seen = new Set();
  themes.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const value = sanitizeThemeSlug(entry.value || entry.slug);
    if (seen.has(value)) return;
    const manifestUrl = safeString(entry.manifestUrl || entry.releaseManifestUrl).trim();
    if (!manifestUrl) throw new Error(`Official theme catalog entry ${value} is missing manifestUrl.`);
    seen.add(value);
    normalized.push({
      value,
      label: safeString(entry.label || entry.name || value) || value,
      repo: safeString(entry.repo || '').trim(),
      manifestUrl,
      description: safeString(entry.description || '').trim()
    });
  });
  return normalized;
}

export function normalizeThemeReleaseManifest(input) {
  if (!input || typeof input !== 'object') throw new Error('Theme release manifest is missing.');
  if (Number(input.schemaVersion) !== 1 || input.type !== 'press-theme') {
    throw new Error('Theme release manifest must be schemaVersion 1 and type "press-theme".');
  }
  const value = sanitizeThemeSlug(input.value || input.slug);
  const version = safeString(input.version || '').trim();
  if (!version) throw new Error('Theme release manifest version is required.');
  const contractVersion = Number(input.contractVersion);
  if (!isPressThemeContractVersionSupported(contractVersion)) {
    throw new Error(`Theme contractVersion ${contractVersion || '(missing)'} is not supported.`);
  }
  const engines = normalizeThemeEngines(input.engines, { required: true });
  const asset = input.asset && typeof input.asset === 'object' ? input.asset : null;
  if (!asset) throw new Error('Theme release manifest asset is required.');
  const assetName = safeString(asset.name || '').trim();
  if (!THEME_RELEASE_ASSET_PATTERN.test(assetName)) {
    throw new Error('Theme release manifest asset must be a press-theme-<slug>-vX.Y.Z.zip file.');
  }
  const assetSlugMatch = assetName.match(/^press-theme-([a-z0-9_-]+)-v/i);
  if (assetSlugMatch && assetSlugMatch[1].toLowerCase() !== value) {
    throw new Error('Theme release manifest asset name does not match the theme slug.');
  }
  const url = safeString(asset.url || asset.browser_download_url || '').trim();
  if (!url) throw new Error('Theme release manifest asset url is required.');
  const size = Number(asset.size);
  if (!Number.isFinite(size) || size <= 0) throw new Error('Theme release manifest asset size is required.');
  const release = input.release && typeof input.release === 'object' ? input.release : {};
  return {
    schemaVersion: 1,
    type: 'press-theme',
    value,
    label: safeString(input.label || input.name || value) || value,
    version,
    contractVersion,
    engines,
    release: {
      tag: safeString(release.tag || input.tag || '').trim(),
      name: safeString(release.name || input.name || '').trim(),
      htmlUrl: safeString(release.htmlUrl || input.htmlUrl || '').trim(),
      publishedAt: safeString(release.publishedAt || input.publishedAt || '').trim(),
      notes: safeString(release.notes || input.notes || '').trim()
    },
    asset: {
      name: assetName,
      url,
      size,
      digest: normalizeDigest(asset.digest, { required: true })
    },
    files: normalizeFileList(input.files)
  };
}

export function themeFilesFromManifest(manifest) {
  const files = [];
  const add = (value) => {
    if (typeof value !== 'string') return;
    try {
      const normalized = normalizeThemeFilePath(value);
      if (normalized) files.push(normalized);
    } catch (_) {}
  };
  const addList = (list) => {
    (Array.isArray(list) ? list : []).forEach(add);
  };

  add('theme.json');
  const styles = manifest && Array.isArray(manifest.styles)
    ? manifest.styles.map((entry) => safeString(entry).trim()).filter(Boolean)
    : [];
  if (styles.length) addList(styles);
  else addList(DEFAULT_THEME_STYLES);
  addList(manifest && manifest.modules);
  addList(manifest && manifest.files);

  const views = manifest && manifest.views && typeof manifest.views === 'object' ? manifest.views : {};
  Object.values(views).forEach((view) => {
    if (view && typeof view === 'object') add(view.module);
  });

  return normalizeFileList(files);
}

export function collectThemeArchiveEntries(buffer, options = {}) {
  const archive = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(archive || {});
  if (!names.length) throw new Error('Theme ZIP is empty.');

  const rawEntries = names
    .map((name) => ({
      raw: name,
      path: validateRawThemeArchivePath(name),
      data: archive[name]
    }))
    .filter((item) => item.path && !item.path.endsWith('/') && item.data);
  const strippedPaths = stripCommonArchiveRoot(rawEntries.map((entry) => entry.path));
  const entries = rawEntries.map((entry, index) => {
    const path = normalizeThemeFilePath(strippedPaths[index]);
    return { path, data: entry.data };
  }).filter((entry) => entry.path);
  const availablePaths = new Set(entries.map((entry) => entry.path));

  if (!entries.some((entry) => entry.path === 'theme.json')) {
    throw new Error('Theme ZIP must contain theme.json at the theme root.');
  }

  const manifestEntry = entries.find((entry) => entry.path === 'theme.json');
  let themeManifest = null;
  try {
    themeManifest = JSON.parse(strFromU8(manifestEntry.data));
  } catch (err) {
    const error = new Error('Theme ZIP theme.json is not valid JSON.');
    error.cause = err;
    throw error;
  }
  const slugSource = options.expectedSlug || themeManifest.value || themeManifest.slug || themeManifest.name;
  const slug = sanitizeThemeSlug(slugSource);
  if (options.expectedSlug && slug !== sanitizeThemeSlug(options.expectedSlug)) {
    throw new Error('Theme ZIP slug does not match the selected release manifest.');
  }
  const contractVersion = validateThemeManifestContract(themeManifest, availablePaths);

  const seen = new Set();
  const normalizedEntries = entries.map((entry) => {
    if (seen.has(entry.path)) throw new Error(`Theme ZIP contains duplicate path: ${entry.path}`);
    seen.add(entry.path);
    const bufferValue = getBuffer(entry.data);
    const binary = !isThemeTextPath(entry.path);
    const file = {
      path: entry.path,
      data: entry.data,
      binary,
      size: entry.data.length
    };
    if (binary) file.base64 = bufferToBase64(bufferValue);
    else file.content = strFromU8(entry.data);
    return file;
  });

  return {
    slug,
    label: safeString(themeManifest.name || themeManifest.label || slug) || slug,
    version: safeString(themeManifest.version || ''),
    contractVersion,
    engines: normalizeThemeEngines(themeManifest.engines, { required: true }),
    manifest: themeManifest,
    files: normalizedEntries
  };
}

export async function verifyThemeAsset(buffer, asset, expectedName = '') {
  const normalized = asset && typeof asset === 'object' ? asset : {};
  const expectedSize = Number(normalized.size);
  if (Number.isFinite(expectedSize) && expectedSize > 0 && buffer.byteLength !== expectedSize) {
    throw new Error(`Theme ZIP size mismatch: expected ${expectedSize}, got ${buffer.byteLength}.`);
  }
  const digest = normalizeDigest(normalized.digest, { required: true });
  const actual = await digestSha256(buffer);
  if (digest !== `sha256:${actual}`) {
    throw new Error('Theme ZIP SHA-256 digest mismatch.');
  }
  const name = safeString(normalized.name || '').trim();
  if (expectedName && name && name !== expectedName) {
    throw new Error('Theme ZIP asset name mismatch.');
  }
  return { digest: `sha256:${actual}`, size: buffer.byteLength };
}
