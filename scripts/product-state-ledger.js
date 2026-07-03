#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const {
  getReleaseProductStateSources
} = require('./release-targets.js');
const {
  normalizeReleaseIntent,
  releaseIntentToProductStateSources,
  validateReleaseIntent
} = require('./release-intent.js');

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
const DEFAULT_RELEASE_SOURCES = getReleaseProductStateSources(DEFAULT_RAW_ROOT);
const SUPPORTED_THEME_CONTRACT_VERSIONS = new Set([3]);
const CURRENT_THEME_CONTRACT_VERSION = 3;
const DEFAULT_SOURCES = {
  systemRelease: `${DEFAULT_RAW_ROOT}/${DEFAULT_PRESS_REPOSITORY}/release-artifacts/system-release.json`,
  downstream: DEFAULT_RELEASE_SOURCES.downstream,
  themeDemos: DEFAULT_RELEASE_SOURCES.themeDemos,
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

function normalizeConnectPublishTelemetry(input) {
  const source = input && typeof input === 'object' ? input : null;
  if (!source) {
    return {
      schemaVersion: 0,
      status: 'drift',
      error: 'Connect health is missing publishTelemetry'
    };
  }
  const hasWindow = source.window && typeof source.window === 'object';
  const telemetry = {
    schemaVersion: Number(source.schemaVersion || 0),
    status: normalizeStatus(source.status),
    migrationRequired: source.migrationRequired === true,
    window: hasWindow ? {
      since: numberOrZero(source.window.since),
      until: numberOrZero(source.window.until),
      seconds: numberOrZero(source.window.seconds)
    } : {},
    totalEvents: numberOrZero(source.totalEvents),
    grantsIssued: numberOrZero(source.grantsIssued),
    publishSuccess: numberOrZero(source.publishSuccess),
    publishFailure: numberOrZero(source.publishFailure),
    lastEventAt: source.lastEventAt == null ? null : numberOrZero(source.lastEventAt),
    upstreamFailures: Array.isArray(source.upstreamFailures)
      ? source.upstreamFailures.map((entry) => ({
        errorCode: String(entry && entry.errorCode || '').trim(),
        upstreamStatus: entry && entry.upstreamStatus != null ? Number(entry.upstreamStatus) : null,
        upstreamCode: String(entry && entry.upstreamCode || '').trim(),
        count: numberOrZero(entry && entry.count),
        lastAt: entry && entry.lastAt != null ? numberOrZero(entry.lastAt) : null
      }))
      : []
  };
  if (telemetry.migrationRequired) {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry migration must be applied before product-state convergence';
  } else if (telemetry.schemaVersion !== 1) {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry must use schemaVersion 1';
  } else if (telemetry.status !== 'ok') {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry status must be ok';
  } else if (!isValidTelemetryWindow(telemetry.window)) {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry window must contain finite seconds with until - since consistency';
  } else if ([telemetry.totalEvents, telemetry.grantsIssued, telemetry.publishSuccess, telemetry.publishFailure].some((value) => !isNonNegativeInteger(value))) {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry counters must be non-negative integers';
  } else if (telemetry.lastEventAt != null && !isNonNegativeInteger(telemetry.lastEventAt)) {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry lastEventAt must be a non-negative integer when present';
  } else if (telemetry.grantsIssued + telemetry.publishSuccess + telemetry.publishFailure > telemetry.totalEvents) {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry event counters cannot exceed totalEvents';
  } else if (telemetry.upstreamFailures.some((entry) => !isValidUpstreamFailure(entry))) {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry upstream failure entries must include valid errorCode, status, count, and timestamp fields';
  } else if (telemetry.upstreamFailures.reduce((total, entry) => total + entry.count, 0) > telemetry.publishFailure) {
    telemetry.status = 'drift';
    telemetry.error = 'Connect publishTelemetry upstream failure counts cannot exceed publishFailure';
  }
  return telemetry;
}

function numberOrZero(value) {
  return value == null || value === '' ? 0 : Number(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidTelemetryWindow(window) {
  return window && isNonNegativeInteger(window.since)
    && isNonNegativeInteger(window.until)
    && isNonNegativeInteger(window.seconds)
    && window.until >= window.since
    && window.seconds === window.until - window.since;
}

function isValidUpstreamFailure(entry) {
  if (!entry.errorCode || !isNonNegativeInteger(entry.count)) return false;
  if (entry.upstreamStatus != null && (!Number.isInteger(entry.upstreamStatus) || entry.upstreamStatus < 100 || entry.upstreamStatus > 599)) return false;
  if (entry.lastAt != null && !isNonNegativeInteger(entry.lastAt)) return false;
  return true;
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
    themeContractUpgrade: source.themeContractUpgrade && typeof source.themeContractUpgrade === 'object'
      ? source.themeContractUpgrade
      : {},
    contentModelUpgrade: source.contentModelUpgrade && typeof source.contentModelUpgrade === 'object'
      ? source.contentModelUpgrade
      : {},
    runtime: {
      manifestPath: String(runtime.manifestPath || '').trim(),
      type: String(runtime.type || '').trim(),
      strategy: String(runtime.strategy || '').trim(),
      cacheKey: String(runtime.cacheKey || '').trim(),
      entryCount: Number(runtime.entryCount || 0),
      edgeCount: Number(runtime.edgeCount || 0)
    },
    htmlUrl: String(source.htmlUrl || source.html_url || source.releaseUrl || '').trim(),
    intent: normalizeSystemReleaseIntent(source.intent),
    asset: {
      name: String(asset.name || '').trim(),
      url: String(asset.url || asset.browser_download_url || '').trim(),
      size: Number(asset.size || 0),
      digest: String(asset.digest || asset.sha256 || '').trim()
    }
  };
}

function normalizeSystemReleaseIntent(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    type: String(source.type || '').trim(),
    path: String(source.path || '').trim(),
    url: String(source.url || source.immutableUrl || '').trim(),
    latestPath: String(source.latestPath || '').trim(),
    latestUrl: String(source.latestUrl || '').trim()
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
  if (!out.version || !SUPPORTED_THEME_CONTRACT_VERSIONS.has(out.contractVersion)) {
    out.status = 'drift';
    out.problems.push('theme release must declare version and supported contractVersion');
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

function releaseTargetVersion(pressVersion) {
  const version = normalizeSemver(pressVersion);
  return {
    version,
    tag: semverToTag(version)
  };
}

function downstreamTarget(source, pressVersion, fallbackReconcilerKind) {
  const target = releaseTargetVersion(pressVersion);
  const sourceReconciler = source.reconciler && typeof source.reconciler === 'object'
    ? source.reconciler
    : {};
  const legacyKind = source.key === 'themeStarter'
    ? 'theme-starter-marker-sync'
    : '';
  return {
    label: String(source.label || source.key || '').trim(),
    repository: String(source.repository || '').trim(),
    source: String(source.source || '').trim(),
    expectedVersion: target.version,
    expectedTag: target.tag,
    reconciler: {
      eventType: String(sourceReconciler.eventType || source.eventType || 'press-system-release').trim(),
      kind: String(sourceReconciler.kind || fallbackReconcilerKind || legacyKind || 'press-runtime-sync').trim(),
      idempotent: sourceReconciler.idempotent !== false
    }
  };
}

function buildDesiredState({ sources, systemRelease, systemSource, releaseIntent, releaseIntentSource }) {
  const target = releaseTargetVersion(systemRelease.version);
  const intent = releaseIntent ? normalizeReleaseIntent(releaseIntent) : null;
  return {
    source: intent ? 'press-release-intent' : 'press-system-release',
    generatedFrom: {
      repository: DEFAULT_PRESS_REPOSITORY,
      source: intent ? releaseIntentSource : systemSource,
      version: target.version,
      tag: target.tag,
      publishedAt: systemRelease.publishedAt
    },
    releaseIntent: intent ? {
      source: releaseIntentSource,
      immutableSource: intent.source,
      latestSource: intent.latestSource,
      version: intent.version,
      tag: intent.tag,
      targetCount: intent.targets.length
    } : null,
    pressSystem: {
      repository: DEFAULT_PRESS_REPOSITORY,
      version: target.version,
      tag: target.tag,
      asset: systemRelease.asset,
      runtime: systemRelease.runtime,
      contentModelUpgrade: systemRelease.contentModelUpgrade
    },
    downstream: Object.fromEntries((sources.downstream || []).map((source) => {
      return [source.key, downstreamTarget(source, target.version)];
    })),
    themeDemos: Object.fromEntries((sources.themeDemos || []).map((source) => {
      return [source.key, downstreamTarget(source, target.version, 'theme-demo-runtime-sync')];
    })),
    themes: {
      catalog: {
        repository: sources.catalog.repository,
        source: sources.catalog.source
      }
    },
    connect: sources.connect && sources.connect.source ? {
      label: sources.connect.label,
      source: sources.connect.source,
      requiresPublishTelemetry: true
    } : null
  };
}

function buildObservedState(state, checkedAt) {
  return {
    checkedAt,
    pressSystem: {
      repository: state.pressSystem.repository,
      source: state.pressSystem.source,
      status: state.pressSystem.status,
      version: state.pressSystem.version,
      tag: state.pressSystem.tag,
      runtime: state.pressSystem.runtime,
      asset: state.pressSystem.asset,
      contentModelUpgrade: state.pressSystem.contentModelUpgrade
    },
    releaseIntent: clone(state.releaseIntent),
    downstream: clone(state.downstream),
    themeDemos: clone(state.themeDemos),
    themes: clone(state.themes),
    connect: clone(state.connect)
  };
}

function buildVerdict(state, statuses) {
  const normalizedStatuses = statuses.map(normalizeStatus);
  const blockingProblems = state.problems.filter((problem) => problem.blocking !== false);
  const nonBlockingProblems = state.problems.filter((problem) => problem.blocking === false);
  const counts = {
    ok: normalizedStatuses.filter((status) => status === 'ok').length,
    pending: normalizedStatuses.filter((status) => status === 'pending').length,
    unknown: normalizedStatuses.filter((status) => status === 'unknown').length,
    drift: normalizedStatuses.filter((status) => status === 'drift').length
  };
  const status = aggregateStatus(normalizedStatuses);
  return {
    status,
    converged: status === 'ok' && blockingProblems.length === 0,
    counts,
    problemCount: state.problems.length,
    blockingProblemCount: blockingProblems.length,
    nonBlockingProblemCount: nonBlockingProblems.length,
    blockingProblems,
    nonBlockingProblems
  };
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
  const configuredReleaseIntentSource = options.releaseIntentSource
    || systemRelease.intent.url
    || systemRelease.intent.latestUrl
    || '';
  const releaseIntentResult = options.releaseIntent
    ? { ok: true, source: configuredReleaseIntentSource || 'inline', value: options.releaseIntent }
    : configuredReleaseIntentSource
      ? await loadJson(configuredReleaseIntentSource)
      : null;
  const normalizedReleaseIntent = releaseIntentResult && releaseIntentResult.ok
    ? normalizeReleaseIntent(releaseIntentResult.value)
    : null;
  const canonicalSystemSource = normalizedReleaseIntent && normalizedReleaseIntent.systemRelease.source
    ? normalizedReleaseIntent.systemRelease.source
    : systemResult.source;
  const canonicalReleaseIntentSource = normalizedReleaseIntent && normalizedReleaseIntent.source
    ? normalizedReleaseIntent.source
    : releaseIntentResult && releaseIntentResult.source
      ? releaseIntentResult.source
      : '';
  const releaseIntentFailures = normalizedReleaseIntent
    ? validateReleaseIntent(normalizedReleaseIntent, { systemRelease })
    : [];
  const effectiveSources = clone(sources);
  if (normalizedReleaseIntent && !releaseIntentFailures.length) {
    const intentSources = releaseIntentToProductStateSources(normalizedReleaseIntent);
    effectiveSources.downstream = intentSources.downstream;
    effectiveSources.themeDemos = intentSources.themeDemos;
  }

  const state = {
    schemaVersion: 1,
    type: 'ekily-product-state',
    generatedAt,
    status: 'unknown',
    desired: buildDesiredState({
      sources: effectiveSources,
      systemRelease,
      systemSource: canonicalSystemSource,
      releaseIntent: normalizedReleaseIntent && !releaseIntentFailures.length ? normalizedReleaseIntent : null,
      releaseIntentSource: canonicalReleaseIntentSource
    }),
    pressSystem: {
      repository: DEFAULT_PRESS_REPOSITORY,
      source: canonicalSystemSource,
      status: 'unknown',
      ...systemRelease
    },
    releaseIntent: {
      source: canonicalReleaseIntentSource,
      status: configuredReleaseIntentSource ? 'unknown' : 'ok',
      required: Boolean(configuredReleaseIntentSource),
      version: normalizedReleaseIntent ? normalizedReleaseIntent.version : '',
      tag: normalizedReleaseIntent ? normalizedReleaseIntent.tag : '',
      targetCount: normalizedReleaseIntent ? normalizedReleaseIntent.targets.length : 0
    },
    downstream: {},
    themeDemos: {},
    themes: {
      catalog: {
        repository: effectiveSources.catalog.repository,
        source: effectiveSources.catalog.source,
        status: 'unknown',
        count: 0
      },
      entries: []
    },
    connect: {
      label: effectiveSources.connect.label,
      source: effectiveSources.connect.source,
      status: 'unknown',
      publishTelemetry: null
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

  if (configuredReleaseIntentSource) {
    if (!releaseIntentResult || !releaseIntentResult.ok) {
      state.releaseIntent.status = 'unknown';
      addProblem(state, {
        component: 'releaseIntent',
        code: 'release_intent_unreachable',
        message: releaseIntentResult && releaseIntentResult.error
          ? releaseIntentResult.error
          : 'release intent could not be loaded',
        owner: DEFAULT_PRESS_REPOSITORY
      });
    } else if (releaseIntentFailures.length) {
      state.releaseIntent.status = 'drift';
      state.releaseIntent.problems = releaseIntentFailures;
      addProblem(state, {
        component: 'releaseIntent',
        code: 'release_intent_invalid',
        message: releaseIntentFailures.join('; '),
        owner: DEFAULT_PRESS_REPOSITORY
      });
    } else {
      state.releaseIntent.status = 'ok';
      state.releaseIntent.immutableSource = normalizedReleaseIntent.source;
      state.releaseIntent.latestSource = normalizedReleaseIntent.latestSource;
    }
  }

  for (const source of effectiveSources.downstream || []) {
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

  for (const source of effectiveSources.themeDemos || []) {
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

  const catalogResult = await loadJson(effectiveSources.catalog.source);
  if (!catalogResult.ok) {
    state.themes.catalog.status = 'unknown';
    state.themes.catalog.error = catalogResult.error;
    addProblem(state, {
      severity: 'warning',
      component: 'themes.catalog',
      code: 'catalog_unreachable',
      message: catalogResult.error,
      owner: effectiveSources.catalog.repository,
      blocking: false
    });
  } else {
    const catalog = catalogResult.value && typeof catalogResult.value === 'object' ? catalogResult.value : {};
    const themes = Array.isArray(catalog.themes) ? catalog.themes : [];
    state.themes.catalog.count = themes.length;
    state.themes.catalog.commit = String(catalog.commit || '').trim();
    state.themes.catalog.status = themes.length ? 'ok' : 'drift';
    state.desired.themes.catalog.expectedCount = themes.length;
    state.desired.themes.entries = themes.map((entry) => ({
      slug: String(entry.value || '').trim(),
      label: String(entry.label || entry.value || '').trim(),
      repository: String(entry.repo || '').trim(),
      manifestUrl: String(entry.manifestUrl || '').trim(),
      expectedContractVersion: CURRENT_THEME_CONTRACT_VERSION,
      expectedPressVersion: pressVersion
    }));
    if (!themes.length) {
      addProblem(state, {
        component: 'themes.catalog',
        code: 'catalog_empty',
        message: 'official theme catalog must contain at least one theme',
        owner: effectiveSources.catalog.repository
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

  if (effectiveSources.connect && effectiveSources.connect.source) {
    const connectResult = await loadJson(effectiveSources.connect.source);
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
      const telemetry = normalizeConnectPublishTelemetry(payload.publishTelemetry);
      state.connect.publishTelemetry = telemetry;
      state.connect.status = payload.ok === true && telemetry.status === 'ok' ? 'ok' : 'drift';
      state.connect.service = String(payload.service || '').trim();
      state.connect.version = String(payload.version || '').trim();
      if (payload.ok !== true) {
        addProblem(state, {
          component: 'connect',
          code: 'connect_unhealthy',
          message: 'Connect health endpoint did not return ok: true',
          owner: 'Connect'
        });
      }
      if (telemetry.status !== 'ok') {
        addProblem(state, {
          component: 'connect.publishTelemetry',
          code: 'publish_telemetry_invalid',
          message: telemetry.error || 'Connect health must expose publish telemetry with schemaVersion 1 and status ok',
          owner: 'Connect'
        });
      }
    }
  }

  const statuses = [
    state.pressSystem.status,
    ...(state.releaseIntent.required ? [state.releaseIntent.status] : []),
    ...Object.values(state.downstream).map((entry) => entry.status),
    ...Object.values(state.themeDemos).map((entry) => entry.status),
    state.themes.catalog.status,
    ...state.themes.entries.map((entry) => entry.status),
    state.connect.status
  ];
  state.status = aggregateStatus(statuses);
  state.observed = buildObservedState(state, generatedAt);
  state.verdict = buildVerdict(state, statuses);
  return state;
}

function shouldFailCheck(state, options = {}) {
  if (options.requireConverged && (!state.verdict || state.verdict.converged !== true)) return true;
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
    else if (arg === '--require-converged') options.requireConverged = true;
    else if (arg === '--allow-pending') options.allowPending = true;
    else if (arg === '--allow-unknown') options.allowUnknown = true;
    else if (arg === '--out') options.out = argv[++i] || '';
    else if (arg === '--state') options.state = argv[++i] || '';
    else if (arg === '--system-release') options.systemReleaseSource = argv[++i] || '';
    else if (arg === '--release-intent') options.releaseIntentSource = argv[++i] || '';
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
    '  --release-intent <path-or-url>  Press release intent source',
    '  --catalog <path-or-url>         Official theme catalog source',
    '  --connect <url>                 Connect health endpoint',
    '  --out <path>                    Write product-state JSON to path',
    '  --state <path>                  Check an existing product-state JSON file',
    '  --quiet                         Suppress JSON stdout when no --out is provided',
    '  --check                         Exit non-zero when state is not acceptable',
    '  --require-converged             Require desired and observed product state to fully agree',
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
      releaseIntentSource: options.releaseIntentSource || '',
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
    const blocking = state.verdict && Array.isArray(state.verdict.blockingProblems)
      ? state.verdict.blockingProblems
      : state.problems.filter((problem) => problem.blocking !== false);
    const summary = blocking.length
      ? blocking.map((problem) => `${problem.component}: ${problem.message}`).join('\n')
      : `product state is ${state.verdict && state.verdict.status ? state.verdict.status : state.status}`;
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
  normalizeReleaseIntent,
  normalizeSemver,
  satisfiesSemverRange,
  shouldFailCheck,
  themeReleaseEntry
};
