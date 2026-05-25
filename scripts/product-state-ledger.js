#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PRESS_REPOSITORY = 'EkilyHQ/Press';
const DEFAULT_RAW_ROOT = 'https://raw.githubusercontent.com';
const RAW_GITHUB_CONTENTS_REFS = new Set(['main', 'demo', 'release-artifacts']);
const SIGNED_URL_QUERY_KEYS = [
  'awsaccesskeyid',
  'expires',
  'sig',
  'signature',
  'x-amz-algorithm',
  'x-amz-credential',
  'x-amz-signature',
  'x-goog-algorithm',
  'x-goog-credential',
  'x-goog-signature'
];
const DEFAULT_SOURCES = {
  systemRelease: `${DEFAULT_RAW_ROOT}/${DEFAULT_PRESS_REPOSITORY}/release-artifacts/system-release.json`,
  downstream: [
    {
      key: 'yap',
      label: 'YAP starter runtime',
      repository: 'EkilyHQ/YAP',
      source: `${DEFAULT_RAW_ROOT}/EkilyHQ/YAP/main/assets/press-system.json`,
      type: 'press-system-manifest'
    },
    {
      key: 'themeStarter',
      label: 'Theme starter marker',
      repository: 'EkilyHQ/Press-Theme-Starter',
      source: `${DEFAULT_RAW_ROOT}/EkilyHQ/Press-Theme-Starter/main/press-system-release.json`,
      type: 'press-release-marker'
    }
  ],
  themeDemos: [
    {
      key: 'arcus',
      label: 'Arcus demo runtime',
      repository: 'EkilyHQ/Press-Theme-Arcus',
      source: `${DEFAULT_RAW_ROOT}/EkilyHQ/Press-Theme-Arcus/demo/assets/press-system.json`
    },
    {
      key: 'cartograph',
      label: 'Cartograph demo runtime',
      repository: 'EkilyHQ/Press-Theme-Cartograph',
      source: `${DEFAULT_RAW_ROOT}/EkilyHQ/Press-Theme-Cartograph/demo/assets/press-system.json`
    },
    {
      key: 'glasswing',
      label: 'Glasswing demo runtime',
      repository: 'EkilyHQ/Press-Theme-Glasswing',
      source: `${DEFAULT_RAW_ROOT}/EkilyHQ/Press-Theme-Glasswing/demo/assets/press-system.json`
    },
    {
      key: 'solstice',
      label: 'Solstice demo runtime',
      repository: 'EkilyHQ/Press-Theme-Solstice',
      source: `${DEFAULT_RAW_ROOT}/EkilyHQ/Press-Theme-Solstice/demo/assets/press-system.json`
    }
  ],
  catalog: {
    repository: 'EkilyHQ/Press-Theme-Catalog',
    source: `${DEFAULT_RAW_ROOT}/EkilyHQ/Press-Theme-Catalog/main/catalog.json`
  },
  connect: {
    label: 'Ekily Connect',
    source: 'https://connect-8mr.pages.dev/api/health'
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hasSignedUrlQuery(url) {
  const keys = new Set(Array.from(url.searchParams.keys()).map((key) => key.toLowerCase()));
  return SIGNED_URL_QUERY_KEYS.some((key) => keys.has(key));
}

function cacheBustJsonUrl(value, options = {}) {
  if (options.cacheBust === false) return value;
  const url = new URL(value);
  if (hasSignedUrlQuery(url)) return value;
  const token = options.cacheBustToken || `${Date.now()}`;
  url.searchParams.set('press_state_cache', token);
  return url.toString();
}

function decodeUrlPathParts(pathname) {
  try {
    return pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part));
  } catch {
    return null;
  }
}

function shouldUseGithubContentsApi(ref) {
  return RAW_GITHUB_CONTENTS_REFS.has(ref) || /^v\d+\.\d+\.\d+$/i.test(ref);
}

function rawGithubUrlToContentsApi(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return '';
  }
  if (url.hostname !== 'raw.githubusercontent.com') return '';
  const parts = decodeUrlPathParts(url.pathname);
  if (!parts || parts.length < 4) return '';
  const [owner, repo, ref, ...fileParts] = parts;
  if (!shouldUseGithubContentsApi(ref)) return '';
  const encodedPath = fileParts.map(encodeURIComponent).join('/');
  const apiUrl = new URL(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`
  );
  apiUrl.searchParams.set('ref', ref);
  return apiUrl.toString();
}

function buildJsonFetchInit({ accept, githubContentsUrl, options }) {
  const headers = {
    Accept: accept,
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  };
  const githubToken = options.githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (githubContentsUrl && githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
    headers['X-GitHub-Api-Version'] = '2022-11-28';
  }
  return {
    cache: 'no-store',
    headers
  };
}

function shouldFallbackToRawGithub(response) {
  if (!response) return true;
  return response.status === 401
    || response.status === 403
    || response.status === 429
    || response.status >= 500;
}

async function loadJsonSource(source, options = {}) {
  const value = String(source || '').trim();
  if (!value) throw new Error('missing JSON source');
  if (isUrl(value)) {
    const fetchImpl = options.fetchImpl || fetch;
    const githubContentsUrl = options.githubRawContentsApi === false
      ? ''
      : rawGithubUrlToContentsApi(value);
    const requestUrl = githubContentsUrl || cacheBustJsonUrl(value, options);
    let response;
    try {
      response = await fetchImpl(requestUrl, buildJsonFetchInit({
        accept: githubContentsUrl ? 'application/vnd.github.raw+json' : 'application/json',
        githubContentsUrl,
        options
      }));
    } catch (error) {
      if (!githubContentsUrl) throw error;
      response = null;
    }
    if (githubContentsUrl && (!response || !response.ok) && shouldFallbackToRawGithub(response)) {
      response = await fetchImpl(cacheBustJsonUrl(value, options), buildJsonFetchInit({
        accept: 'application/json',
        githubContentsUrl: '',
        options
      }));
    }
    if (!response || !response.ok) {
      const status = response && response.status ? response.status : 'network';
      throw new Error(`unable to fetch ${value}: ${status}`);
    }
    return await response.json();
  }
  const baseDir = options.baseDir || process.cwd();
  const file = path.isAbsolute(value) ? value : path.resolve(baseDir, value);
  return readJsonFile(file);
}

async function tryLoadJson(source, options = {}) {
  try {
    return { ok: true, source, value: await loadJsonSource(source, options) };
  } catch (error) {
    return {
      ok: false,
      source,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function normalizeSemver(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
  if (!match) return '';
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function semverToTag(value) {
  const version = normalizeSemver(value);
  return version ? `v${version}` : '';
}

function compareSemver(a, b) {
  const left = normalizeSemver(a);
  const right = normalizeSemver(b);
  if (!left || !right) return null;
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
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

function satisfiesSemverRange(version, range) {
  const normalizedVersion = normalizeSemver(version);
  if (!normalizedVersion) return false;
  const clauses = String(range || '').split('||').map((part) => part.trim()).filter(Boolean);
  if (!clauses.length) return false;
  return clauses.some((clause) => {
    const tokens = clause.split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => testComparator(normalizedVersion, token));
  });
}

function normalizeStatus(status) {
  const value = String(status || '').trim().toLowerCase();
  return ['ok', 'pending', 'unknown', 'drift'].includes(value) ? value : 'unknown';
}

function aggregateStatus(statuses) {
  const values = statuses.map(normalizeStatus);
  if (values.includes('drift')) return 'drift';
  if (values.includes('unknown')) return 'unknown';
  if (values.includes('pending')) return 'pending';
  return 'ok';
}

function addProblem(state, problem) {
  state.problems.push({
    severity: problem.severity || 'error',
    component: problem.component || '',
    code: problem.code || 'invalid_state',
    message: problem.message || '',
    owner: problem.owner || '',
    blocking: problem.blocking !== false
  });
}

function normalizeSystemRelease(input) {
  const source = input && typeof input === 'object' ? input : {};
  const version = normalizeSemver(source.version);
  const tag = semverToTag(source.tag || version);
  const asset = source.asset && typeof source.asset === 'object' ? source.asset : {};
  const runtime = source.runtime && typeof source.runtime === 'object' ? source.runtime : {};
  return {
    schemaVersion: Number(source.schemaVersion) || 0,
    name: String(source.name || tag || '').trim(),
    tag,
    version,
    publishedAt: String(source.publishedAt || source.published_at || '').trim(),
    upgradeFrom: source.upgradeFrom && typeof source.upgradeFrom === 'object' ? source.upgradeFrom : {},
    runtime: {
      manifestPath: String(runtime.manifestPath || '').trim(),
      type: String(runtime.type || '').trim(),
      strategy: String(runtime.strategy || '').trim(),
      cacheKey: String(runtime.cacheKey || '').trim(),
      entryCount: Number(runtime.entryCount || 0),
      edgeCount: Number(runtime.edgeCount || 0)
    },
    htmlUrl: String(source.htmlUrl || source.html_url || source.releaseUrl || '').trim(),
    asset: {
      name: String(asset.name || '').trim(),
      url: String(asset.url || asset.browser_download_url || '').trim(),
      size: Number(asset.size || 0),
      digest: String(asset.digest || asset.sha256 || '').trim()
    }
  };
}

function pressSystemEntry(result, expectedVersion) {
  const expected = normalizeSemver(expectedVersion);
  if (!result.ok) {
    return {
      status: 'unknown',
      source: result.source,
      error: result.error,
      expectedVersion: expected,
      observedVersion: ''
    };
  }
  const observedVersion = normalizeSemver(result.value && result.value.version);
  const observedTag = semverToTag(result.value && result.value.tag);
  if (!expected) {
    return {
      status: 'unknown',
      source: result.source,
      error: 'Expected Press system version is unavailable.',
      expectedVersion: '',
      observedVersion,
      observedTag
    };
  }
  const status = observedVersion === expected && observedTag === semverToTag(expected)
    ? 'ok'
    : 'pending';
  return {
    status,
    source: result.source,
    expectedVersion: expected,
    observedVersion,
    observedTag
  };
}

function themeReleaseEntry(catalogEntry, result, pressVersion) {
  const slug = String(catalogEntry.value || '').trim();
  const repo = String(catalogEntry.repo || '').trim();
  const out = {
    slug,
    label: String(catalogEntry.label || slug).trim(),
    repository: repo,
    manifestUrl: String(catalogEntry.manifestUrl || '').trim(),
    status: 'unknown',
    version: '',
    contractVersion: null,
    engines: {},
    artifact: {},
    problems: []
  };
  if (!result.ok) {
    out.error = result.error;
    return out;
  }

  const manifest = result.value && typeof result.value === 'object' ? result.value : {};
  out.version = String(manifest.version || '').trim();
  out.contractVersion = Number(manifest.contractVersion);
  out.engines = manifest.engines && typeof manifest.engines === 'object' ? manifest.engines : {};
  const asset = manifest.asset && typeof manifest.asset === 'object' ? manifest.asset : {};
  out.artifact = {
    name: String(asset.name || '').trim(),
    url: String(asset.url || '').trim(),
    size: Number(asset.size || 0),
    digest: String(asset.digest || '').trim()
  };

  if (manifest.schemaVersion !== 1 || manifest.type !== 'press-theme') {
    out.status = 'drift';
    out.problems.push('theme release manifest must be schemaVersion 1 and type "press-theme"');
  }
  if (String(manifest.value || '').trim() !== slug) {
    out.status = 'drift';
    out.problems.push(`theme release slug does not match catalog entry "${slug}"`);
  }
  if (!out.version || out.contractVersion !== 1) {
    out.status = 'drift';
    out.problems.push('theme release must declare version and contractVersion 1');
  }
  if (!out.engines.press || !satisfiesSemverRange(pressVersion, out.engines.press)) {
    out.status = 'drift';
    out.problems.push(`theme engines.press does not accept Press ${pressVersion}`);
  }
  if (!out.artifact.url || !out.artifact.digest || !(out.artifact.size > 0)) {
    out.status = 'drift';
    out.problems.push('theme release asset must declare url, size, and digest');
  }
  if (out.status !== 'drift') out.status = 'ok';
  return out;
}

async function buildProductState(options = {}) {
  const sources = clone(options.sources || DEFAULT_SOURCES);
  const loadJson = options.loadJson || ((source) => tryLoadJson(source, {
    baseDir: options.baseDir || process.cwd(),
    fetchImpl: options.fetchImpl
  }));
  const generatedAt = options.generatedAt || new Date().toISOString();
  const systemSource = options.systemReleaseSource || sources.systemRelease;
  const systemResult = options.systemRelease
    ? { ok: true, source: systemSource || 'inline', value: options.systemRelease }
    : await loadJson(systemSource);
  const systemRelease = normalizeSystemRelease(systemResult.value || {});

  const state = {
    schemaVersion: 1,
    type: 'ekily-product-state',
    generatedAt,
    status: 'unknown',
    pressSystem: {
      repository: DEFAULT_PRESS_REPOSITORY,
      source: systemResult.source,
      status: 'unknown',
      ...systemRelease
    },
    downstream: {},
    themeDemos: {},
    themes: {
      catalog: {
        repository: sources.catalog.repository,
        source: sources.catalog.source,
        status: 'unknown',
        count: 0
      },
      entries: []
    },
    connect: {
      label: sources.connect.label,
      source: sources.connect.source,
      status: 'unknown'
    },
    problems: []
  };

  const pressVersion = systemRelease.version;
  if (!systemResult.ok) {
    state.pressSystem.status = 'unknown';
    addProblem(state, {
      severity: 'error',
      component: 'pressSystem',
      code: 'system_release_unreachable',
      message: systemResult.error,
      owner: DEFAULT_PRESS_REPOSITORY
    });
  } else if (!pressVersion || !systemRelease.tag || systemRelease.tag !== semverToTag(pressVersion)) {
    state.pressSystem.status = 'drift';
    addProblem(state, {
      component: 'pressSystem',
      code: 'system_release_invalid_version',
      message: 'system-release.json must declare matching version and tag',
      owner: DEFAULT_PRESS_REPOSITORY
    });
  } else if (!systemRelease.asset.url || !systemRelease.asset.digest || !(systemRelease.asset.size > 0)) {
    state.pressSystem.status = 'drift';
    addProblem(state, {
      component: 'pressSystem',
      code: 'system_release_invalid_asset',
      message: 'system-release.json must include fetchable asset url, size, and digest',
      owner: DEFAULT_PRESS_REPOSITORY
    });
  } else if (
    systemRelease.runtime.type !== 'press-runtime-assets'
    || systemRelease.runtime.manifestPath !== 'assets/press-runtime-manifest.json'
    || systemRelease.runtime.cacheKey !== `press-system-${systemRelease.tag}`
    || systemRelease.runtime.strategy !== 'query-param'
    || !(systemRelease.runtime.entryCount > 0)
    || !(systemRelease.runtime.edgeCount > 0)
  ) {
    state.pressSystem.status = 'drift';
    addProblem(state, {
      component: 'pressSystem.runtime',
      code: 'system_release_invalid_runtime_graph',
      message: 'system-release.json must include runtime manifest path, cache key, inventory count, and asset graph edge count',
      owner: DEFAULT_PRESS_REPOSITORY
    });
  } else {
    state.pressSystem.status = 'ok';
  }

  for (const source of sources.downstream || []) {
    const result = await loadJson(source.source);
    const entry = pressSystemEntry(result, pressVersion);
    entry.label = source.label;
    entry.repository = source.repository;
    entry.type = source.type;
    state.downstream[source.key] = entry;
    if (entry.status === 'unknown') {
      addProblem(state, {
        severity: 'warning',
        component: `downstream.${source.key}`,
        code: 'downstream_unreachable',
        message: entry.error,
        owner: source.repository,
        blocking: false
      });
    } else if (entry.status !== 'ok') {
      addProblem(state, {
        severity: 'warning',
        component: `downstream.${source.key}`,
        code: 'downstream_pending',
        message: `${source.label} is ${entry.observedVersion || 'unknown'}, expected ${pressVersion}`,
        owner: source.repository,
        blocking: false
      });
    }
  }

  for (const source of sources.themeDemos || []) {
    const result = await loadJson(source.source);
    const entry = pressSystemEntry(result, pressVersion);
    entry.label = source.label;
    entry.repository = source.repository;
    state.themeDemos[source.key] = entry;
    if (entry.status === 'unknown') {
      addProblem(state, {
        severity: 'warning',
        component: `themeDemos.${source.key}`,
        code: 'theme_demo_unreachable',
        message: entry.error,
        owner: source.repository,
        blocking: false
      });
    } else if (entry.status !== 'ok') {
      addProblem(state, {
        severity: 'warning',
        component: `themeDemos.${source.key}`,
        code: 'theme_demo_pending',
        message: `${source.label} is ${entry.observedVersion || 'unknown'}, expected ${pressVersion}`,
        owner: source.repository,
        blocking: false
      });
    }
  }

  const catalogResult = await loadJson(sources.catalog.source);
  if (!catalogResult.ok) {
    state.themes.catalog.status = 'unknown';
    state.themes.catalog.error = catalogResult.error;
    addProblem(state, {
      severity: 'warning',
      component: 'themes.catalog',
      code: 'catalog_unreachable',
      message: catalogResult.error,
      owner: sources.catalog.repository,
      blocking: false
    });
  } else {
    const catalog = catalogResult.value && typeof catalogResult.value === 'object' ? catalogResult.value : {};
    const themes = Array.isArray(catalog.themes) ? catalog.themes : [];
    state.themes.catalog.count = themes.length;
    state.themes.catalog.commit = String(catalog.commit || '').trim();
    state.themes.catalog.status = themes.length ? 'ok' : 'drift';
    if (!themes.length) {
      addProblem(state, {
        component: 'themes.catalog',
        code: 'catalog_empty',
        message: 'official theme catalog must contain at least one theme',
        owner: sources.catalog.repository
      });
    }
    for (const entry of themes) {
      const manifestUrl = String(entry.manifestUrl || '').trim();
      const result = manifestUrl
        ? await loadJson(manifestUrl)
        : { ok: false, source: manifestUrl, error: 'catalog entry is missing manifestUrl' };
      const theme = themeReleaseEntry(entry, result, pressVersion);
      state.themes.entries.push(theme);
      if (theme.status === 'unknown') {
        addProblem(state, {
          severity: 'warning',
          component: `themes.${theme.slug || 'unknown'}`,
          code: 'theme_release_unreachable',
          message: theme.error,
          owner: theme.repository,
          blocking: false
        });
      } else if (theme.status !== 'ok') {
        addProblem(state, {
          component: `themes.${theme.slug || 'unknown'}`,
          code: 'theme_release_drift',
          message: theme.problems.join('; '),
          owner: theme.repository
        });
      }
    }
  }

  if (sources.connect && sources.connect.source) {
    const connectResult = await loadJson(sources.connect.source);
    if (!connectResult.ok) {
      state.connect.status = 'unknown';
      state.connect.error = connectResult.error;
      addProblem(state, {
        severity: 'warning',
        component: 'connect',
        code: 'connect_unreachable',
        message: connectResult.error,
        owner: 'Connect',
        blocking: false
      });
    } else {
      const payload = connectResult.value && typeof connectResult.value === 'object' ? connectResult.value : {};
      state.connect.status = payload.ok === true ? 'ok' : 'drift';
      state.connect.service = String(payload.service || '').trim();
      state.connect.version = String(payload.version || '').trim();
      if (state.connect.status !== 'ok') {
        addProblem(state, {
          component: 'connect',
          code: 'connect_unhealthy',
          message: 'Connect health endpoint did not return ok: true',
          owner: 'Connect'
        });
      }
    }
  }

  const statuses = [
    state.pressSystem.status,
    ...Object.values(state.downstream).map((entry) => entry.status),
    ...Object.values(state.themeDemos).map((entry) => entry.status),
    state.themes.catalog.status,
    ...state.themes.entries.map((entry) => entry.status),
    state.connect.status
  ];
  state.status = aggregateStatus(statuses);
  return state;
}

function shouldFailCheck(state, options = {}) {
  const statuses = collectStateStatuses(state);
  if (statuses.includes('drift')) return true;
  if (statuses.includes('unknown') && options.allowUnknown !== true) return true;
  if (statuses.includes('pending') && options.allowPending !== true) return true;
  return false;
}

function collectStateStatuses(value, out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Object.prototype.hasOwnProperty.call(value, 'status')) {
    out.push(normalizeStatus(value.status));
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStateStatuses(entry, out));
  } else {
    Object.entries(value).forEach(([key, entry]) => {
      if (key !== 'status') collectStateStatuses(entry, out);
    });
  }
  return out;
}

function parseArgs(argv) {
  const options = {
    allowPending: false,
    allowUnknown: false,
    check: false,
    out: ''
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--allow-pending') options.allowPending = true;
    else if (arg === '--allow-unknown') options.allowUnknown = true;
    else if (arg === '--out') options.out = argv[++i] || '';
    else if (arg === '--state') options.state = argv[++i] || '';
    else if (arg === '--system-release') options.systemReleaseSource = argv[++i] || '';
    else if (arg === '--catalog') {
      options.sources = options.sources || clone(DEFAULT_SOURCES);
      options.sources.catalog.source = argv[++i] || '';
    } else if (arg === '--connect') {
      options.sources = options.sources || clone(DEFAULT_SOURCES);
      options.sources.connect.source = argv[++i] || '';
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

function printHelp() {
  console.log([
    'usage: node scripts/product-state-ledger.js [options]',
    '',
    'Options:',
    '  --system-release <path-or-url>  System release manifest source',
    '  --catalog <path-or-url>         Official theme catalog source',
    '  --connect <url>                 Connect health endpoint',
    '  --out <path>                    Write product-state JSON to path',
    '  --state <path>                  Check an existing product-state JSON file',
    '  --quiet                         Suppress JSON stdout when no --out is provided',
    '  --check                         Exit non-zero when state is not acceptable',
    '  --allow-pending                 Allow pending downstream/demo state in --check',
    '  --allow-unknown                 Allow unknown external state in --check'
  ].join('\n'));
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }
  const state = options.state
    ? readJsonFile(options.state)
    : await buildProductState({
      sources: options.sources || DEFAULT_SOURCES,
      systemReleaseSource: options.systemReleaseSource || DEFAULT_SOURCES.systemRelease,
      baseDir: process.cwd()
    });
  const json = `${JSON.stringify(state, null, 2)}\n`;
  if (options.out) {
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    fs.writeFileSync(options.out, json);
  } else if (!options.quiet) {
    process.stdout.write(json);
  }
  if (options.check && shouldFailCheck(state, options)) {
    const blocking = state.problems.filter((problem) => problem.blocking !== false);
    const summary = blocking.length
      ? blocking.map((problem) => `${problem.component}: ${problem.message}`).join('\n')
      : `product state is ${state.status}`;
    console.error(summary);
    return 1;
  }
  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_SOURCES,
  aggregateStatus,
  buildProductState,
  cacheBustJsonUrl,
  loadJsonSource,
  normalizeSemver,
  satisfiesSemverRange,
  shouldFailCheck,
  themeReleaseEntry
};
