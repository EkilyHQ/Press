export const PRESS_SYSTEM_MANIFEST_PATH = 'assets/press-system.json';

export function normalizeSemver(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
  if (!match) return '';
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

export function semverToTag(value) {
  const version = normalizeSemver(value);
  return version ? `v${version}` : '';
}

export function compareSemver(a, b) {
  const left = normalizeSemver(a);
  const right = normalizeSemver(b);
  if (!left || !right) return left === right ? 0 : null;
  const leftParts = left.split('.').map((part) => Number(part));
  const rightParts = right.split('.').map((part) => Number(part));
  for (let i = 0; i < 3; i += 1) {
    if (leftParts[i] !== rightParts[i]) return leftParts[i] > rightParts[i] ? 1 : -1;
  }
  return 0;
}

function testComparator(version, token) {
  const raw = String(token || '').trim();
  if (!raw || raw === '*') return true;
  const match = raw.match(/^(>=|<=|>|<|=)?\s*(v?\d+\.\d+\.\d+)$/i);
  if (!match) return false;
  const op = match[1] || '=';
  const comparison = compareSemver(version, match[2]);
  if (comparison === null) return false;
  if (op === '>') return comparison > 0;
  if (op === '>=') return comparison >= 0;
  if (op === '<') return comparison < 0;
  if (op === '<=') return comparison <= 0;
  return comparison === 0;
}

export function satisfiesSemverRange(version, range) {
  const normalizedVersion = normalizeSemver(version);
  if (!normalizedVersion) return false;
  const clauses = String(range || '').split('||').map((part) => part.trim()).filter(Boolean);
  if (!clauses.length) return false;
  return clauses.some((clause) => {
    const tokens = clause.split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => testComparator(normalizedVersion, token));
  });
}

export function satisfiesAnySemverRange(version, ranges) {
  const list = Array.isArray(ranges) ? ranges : [ranges];
  return list.some((range) => satisfiesSemverRange(version, range));
}

export function normalizeUpgradeFrom(input) {
  const source = input && typeof input === 'object' ? input : {};
  const ranges = Array.isArray(source.ranges)
    ? source.ranges.map((range) => String(range || '').trim()).filter(Boolean)
    : [];
  return {
    ranges,
    allowUnknownSource: source.allowUnknownSource === true,
    message: String(source.message || '')
  };
}

export function normalizePressSystemManifest(input) {
  if (!input || typeof input !== 'object') throw new Error('Press system manifest is missing.');
  if (Number(input.schemaVersion) !== 1 || input.type !== 'press-system') {
    throw new Error('Press system manifest must be schemaVersion 1 and type "press-system".');
  }
  const version = normalizeSemver(input.version);
  const tag = semverToTag(input.tag || version);
  if (!version || tag !== semverToTag(version)) {
    throw new Error('Press system manifest version and tag must be matching SemVer values.');
  }
  return {
    schemaVersion: 1,
    type: 'press-system',
    version,
    tag,
    upgradeFrom: normalizeUpgradeFrom(input.upgradeFrom)
  };
}

function getDefaultFetch() {
  return typeof fetch === 'function' ? fetch : null;
}

export function createPressSystemManifestLoader(options = {}) {
  let manifestCache = options.manifest ? normalizePressSystemManifest(options.manifest) : null;
  const configuredFetch = typeof options.fetchImpl === 'function' ? options.fetchImpl : null;

  return {
    async load(loadOptions = {}) {
      if (manifestCache && loadOptions.force !== true) return manifestCache;
      const path = loadOptions.path || options.path || PRESS_SYSTEM_MANIFEST_PATH;
      const fetchImpl = typeof loadOptions.fetchImpl === 'function'
        ? loadOptions.fetchImpl
        : (configuredFetch || getDefaultFetch());
      if (typeof fetchImpl !== 'function') throw new Error('Unable to load Press system version.');
      const response = await fetchImpl(path, { cache: 'no-store' });
      if (!response || !response.ok) throw new Error('Unable to load Press system version.');
      manifestCache = normalizePressSystemManifest(await response.json());
      return manifestCache;
    },
    setForTests(manifest) {
      manifestCache = manifest ? normalizePressSystemManifest(manifest) : null;
    }
  };
}

const defaultPressSystemManifestLoader = createPressSystemManifestLoader();

function getPressSystemManifestLoader(options = {}) {
  return options && options.manifestLoader && typeof options.manifestLoader.load === 'function'
    ? options.manifestLoader
    : defaultPressSystemManifestLoader;
}

export async function loadPressSystemManifest(options = {}) {
  return getPressSystemManifestLoader(options).load(options);
}

export function setPressSystemManifestForTests(manifest, options = {}) {
  getPressSystemManifestLoader(options).setForTests(manifest);
}

export function isUpgradeAllowed(currentVersion, upgradeFrom) {
  const sourceVersion = normalizeSemver(currentVersion);
  const rule = normalizeUpgradeFrom(upgradeFrom);
  if (!sourceVersion) return rule.allowUnknownSource === true;
  if (!rule.ranges.length) return true;
  return satisfiesAnySemverRange(sourceVersion, rule.ranges);
}
