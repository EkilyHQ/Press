#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_RAW_ROOT,
  getReleaseProductStateSources,
  getReleaseTargets
} = require('./release-targets.js');

const DEFAULT_PRESS_REPOSITORY = 'EkilyHQ/Press';
const RELEASE_INTENT_TYPE = 'press-release-intent';

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

function normalizeThemeContractUpgrade(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const required = Number(source.requiresInstalledThemeContractVersion || 0);
  return {
    requiresInstalledThemeContractVersion: Number.isFinite(required) && required > 0 ? Math.floor(required) : 0,
    message: String(source.message || '').trim()
  };
}

function themeContractUpgradesMatch(left, right) {
  const a = normalizeThemeContractUpgrade(left);
  const b = normalizeThemeContractUpgrade(right);
  return a.requiresInstalledThemeContractVersion === b.requiresInstalledThemeContractVersion
    && a.message === b.message;
}

function normalizeContentModelUpgrade(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    requiresUnifiedIndexTabs: source.requiresUnifiedIndexTabs === true,
    message: String(source.message || '').trim()
  };
}

function contentModelUpgradesMatch(left, right) {
  const a = normalizeContentModelUpgrade(left);
  const b = normalizeContentModelUpgrade(right);
  return a.requiresUnifiedIndexTabs === b.requiresUnifiedIndexTabs
    && a.message === b.message;
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256File(file) {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function sourceMapFromReleaseTargets(rawRoot = DEFAULT_RAW_ROOT) {
  const sources = getReleaseProductStateSources(rawRoot);
  const map = new Map();
  [...sources.downstream, ...sources.themeDemos].forEach((source) => {
    map.set(source.key, source);
  });
  return map;
}

function normalizeObservedChannels(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return Object.fromEntries(Object.entries(source).map(([key, channel]) => {
    const value = channel && typeof channel === 'object' ? channel : {};
    return [key, {
      ref: String(value.ref || '').trim(),
      path: String(value.path || '').trim(),
      type: String(value.type || '').trim(),
      source: String(value.source || '').trim()
    }];
  }));
}

function normalizeSystemRelease(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const version = normalizeSemver(source.version);
  const tag = semverToTag(source.tag || version);
  const asset = source.asset && typeof source.asset === 'object' ? source.asset : {};
  const runtime = source.runtime && typeof source.runtime === 'object' ? source.runtime : {};
  const intent = source.intent && typeof source.intent === 'object' ? source.intent : {};
  return {
    schemaVersion: Number(source.schemaVersion || 0),
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
    asset: {
      name: String(asset.name || '').trim(),
      url: String(asset.url || asset.browser_download_url || '').trim(),
      size: Number(asset.size || 0),
      digest: String(asset.digest || asset.sha256 || '').trim()
    },
    intent: {
      type: String(intent.type || '').trim(),
      path: String(intent.path || '').trim(),
      url: String(intent.url || intent.immutableUrl || '').trim(),
      latestPath: String(intent.latestPath || '').trim(),
      latestUrl: String(intent.latestUrl || '').trim()
    }
  };
}

function buildReleaseIntent(options = {}) {
  const systemRelease = normalizeSystemRelease(options.systemRelease || {});
  const version = systemRelease.version;
  const tag = systemRelease.tag || semverToTag(version);
  const rawRoot = options.rawRoot || DEFAULT_RAW_ROOT;
  const repository = String(options.repository || DEFAULT_PRESS_REPOSITORY).trim() || DEFAULT_PRESS_REPOSITORY;
  const sourceMap = sourceMapFromReleaseTargets(rawRoot);
  const targets = getReleaseTargets().map((target) => {
    const source = sourceMap.get(target.key) || {};
    return {
      key: target.key,
      category: target.category,
      label: target.label,
      repository: target.repository,
      eventType: target.eventType,
      expected: {
        version,
        tag
      },
      observed: {
        ref: target.observed.ref,
        path: target.observed.path,
        type: target.observed.type,
        source: source.source || ''
      },
      observedChannels: normalizeObservedChannels(source.observedChannels),
      reconciler: {
        kind: target.reconciler.kind,
        idempotent: target.reconciler.idempotent !== false
      }
    };
  });

  return {
    schemaVersion: 1,
    type: RELEASE_INTENT_TYPE,
    repository,
    version,
    tag,
    createdAt: String(options.createdAt || systemRelease.publishedAt || new Date().toISOString()),
    source: String(options.source || systemRelease.intent.url || '').trim(),
    latestSource: String(options.latestSource || systemRelease.intent.latestUrl || '').trim(),
    systemRelease: {
      path: String(options.systemReleasePath || systemRelease.intent.systemReleasePath || 'system-release.json').trim(),
      source: String(options.systemReleaseSource || '').trim(),
      digest: String(options.systemReleaseDigest || '').trim(),
      publishedAt: systemRelease.publishedAt,
      htmlUrl: systemRelease.htmlUrl
    },
    pressSystem: {
      asset: systemRelease.asset,
      runtime: systemRelease.runtime,
      upgradeFrom: systemRelease.upgradeFrom,
      themeContractUpgrade: systemRelease.themeContractUpgrade,
      contentModelUpgrade: systemRelease.contentModelUpgrade
    },
    targets
  };
}

function normalizeReleaseIntent(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const version = normalizeSemver(source.version);
  const tag = semverToTag(source.tag || version);
  const pressSystem = source.pressSystem && typeof source.pressSystem === 'object' ? source.pressSystem : {};
  const asset = pressSystem.asset && typeof pressSystem.asset === 'object' ? pressSystem.asset : {};
  const runtime = pressSystem.runtime && typeof pressSystem.runtime === 'object' ? pressSystem.runtime : {};
  const systemRelease = source.systemRelease && typeof source.systemRelease === 'object' ? source.systemRelease : {};
  const targets = Array.isArray(source.targets) ? source.targets : [];
  return {
    schemaVersion: Number(source.schemaVersion || 0),
    type: String(source.type || '').trim(),
    repository: String(source.repository || DEFAULT_PRESS_REPOSITORY).trim(),
    version,
    tag,
    createdAt: String(source.createdAt || '').trim(),
    source: String(source.source || '').trim(),
    latestSource: String(source.latestSource || '').trim(),
    systemRelease: {
      path: String(systemRelease.path || '').trim(),
      source: String(systemRelease.source || '').trim(),
      digest: String(systemRelease.digest || '').trim(),
      publishedAt: String(systemRelease.publishedAt || '').trim(),
      htmlUrl: String(systemRelease.htmlUrl || '').trim()
    },
    pressSystem: {
      asset: {
        name: String(asset.name || '').trim(),
        url: String(asset.url || '').trim(),
        size: Number(asset.size || 0),
        digest: String(asset.digest || '').trim()
      },
      runtime: {
        manifestPath: String(runtime.manifestPath || '').trim(),
        type: String(runtime.type || '').trim(),
        strategy: String(runtime.strategy || '').trim(),
        cacheKey: String(runtime.cacheKey || '').trim(),
        entryCount: Number(runtime.entryCount || 0),
        edgeCount: Number(runtime.edgeCount || 0)
      },
      upgradeFrom: pressSystem.upgradeFrom && typeof pressSystem.upgradeFrom === 'object'
        ? pressSystem.upgradeFrom
        : {},
      themeContractUpgrade: pressSystem.themeContractUpgrade && typeof pressSystem.themeContractUpgrade === 'object'
        ? pressSystem.themeContractUpgrade
        : {},
      contentModelUpgrade: pressSystem.contentModelUpgrade && typeof pressSystem.contentModelUpgrade === 'object'
        ? pressSystem.contentModelUpgrade
        : {}
    },
    targets: targets.map((target) => {
      const expected = target && target.expected && typeof target.expected === 'object' ? target.expected : {};
      const observed = target && target.observed && typeof target.observed === 'object' ? target.observed : {};
      const reconciler = target && target.reconciler && typeof target.reconciler === 'object' ? target.reconciler : {};
      const observedChannels = target && target.observedChannels && typeof target.observedChannels === 'object'
        ? target.observedChannels
        : {};
      return {
        key: String(target && target.key || '').trim(),
        category: String(target && target.category || '').trim(),
        label: String(target && target.label || '').trim(),
        repository: String(target && target.repository || '').trim(),
        eventType: String(target && target.eventType || '').trim(),
        expected: {
          version: normalizeSemver(expected.version),
          tag: semverToTag(expected.tag || expected.version)
        },
        observed: {
          ref: String(observed.ref || '').trim(),
          path: String(observed.path || '').trim(),
          type: String(observed.type || '').trim(),
          source: String(observed.source || '').trim()
        },
        observedChannels: normalizeObservedChannels(observedChannels),
        reconciler: {
          kind: String(reconciler.kind || '').trim(),
          idempotent: reconciler.idempotent !== false
        }
      };
    })
  };
}

function validateReleaseIntent(intentInput, options = {}) {
  const intent = normalizeReleaseIntent(intentInput);
  const failures = [];
  if (intent.schemaVersion !== 1) failures.push('release intent schemaVersion must be 1');
  if (intent.type !== RELEASE_INTENT_TYPE) failures.push(`release intent type must be ${RELEASE_INTENT_TYPE}`);
  if (!intent.version || intent.tag !== semverToTag(intent.version)) failures.push('release intent must declare matching version and tag');
  if (!intent.createdAt) failures.push('release intent must declare createdAt');
  if (!intent.repository) failures.push('release intent must declare repository');
  if (!intent.pressSystem.asset.name || !intent.pressSystem.asset.url || !intent.pressSystem.asset.digest || !(intent.pressSystem.asset.size > 0)) {
    failures.push('release intent pressSystem.asset must declare name, url, size, and digest');
  }
  if (
    intent.pressSystem.runtime.type !== 'press-runtime-assets'
    || intent.pressSystem.runtime.manifestPath !== 'assets/press-runtime-manifest.json'
    || intent.pressSystem.runtime.strategy !== 'query-param'
    || intent.pressSystem.runtime.cacheKey !== `press-system-${intent.tag}`
    || !(intent.pressSystem.runtime.entryCount > 0)
    || !(intent.pressSystem.runtime.edgeCount > 0)
  ) {
    failures.push('release intent pressSystem.runtime must describe the materialized runtime asset graph');
  }
  if (!intent.targets.length) failures.push('release intent must declare at least one target');

  const seenKeys = new Set();
  const seenRepositories = new Set();
  intent.targets.forEach((target, index) => {
    const prefix = `targets[${index}]`;
    if (!target.key) failures.push(`${prefix}.key is required`);
    else if (seenKeys.has(target.key)) failures.push(`${prefix}.key duplicates ${target.key}`);
    else seenKeys.add(target.key);
    if (!['downstream', 'themeDemo'].includes(target.category)) failures.push(`${prefix}.category must be downstream or themeDemo`);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(target.repository)) failures.push(`${prefix}.repository is invalid`);
    else if (seenRepositories.has(target.repository)) failures.push(`${prefix}.repository duplicates ${target.repository}`);
    else seenRepositories.add(target.repository);
    if (!target.eventType) failures.push(`${prefix}.eventType is required`);
    if (target.expected.version !== intent.version || target.expected.tag !== intent.tag) {
      failures.push(`${prefix}.expected must match release intent version and tag`);
    }
    if (!target.observed.ref || !target.observed.path || !target.observed.type || !target.observed.source) {
      failures.push(`${prefix}.observed must declare ref, path, type, and source`);
    }
    Object.entries(target.observedChannels || {}).forEach(([channelKey, channel]) => {
      const channelPrefix = `${prefix}.observedChannels.${channelKey}`;
      if (!['themeManifest', 'themePacks', 'demoLock'].includes(channelKey)) {
        failures.push(`${channelPrefix} is not a supported observed channel`);
      }
      if (!channel.ref || !channel.path || !channel.type || !channel.source) {
        failures.push(`${channelPrefix} must declare ref, path, type, and source`);
      }
      if (!['press-theme-manifest', 'press-theme-packs', 'theme-demo-release-lock'].includes(channel.type)) {
        failures.push(`${channelPrefix}.type is invalid`);
      }
    });
    if (!target.reconciler.kind || target.reconciler.idempotent !== true) {
      failures.push(`${prefix}.reconciler must be idempotent and declare kind`);
    }
  });

  if (options.systemRelease) {
    const systemRelease = normalizeSystemRelease(options.systemRelease);
    if (systemRelease.version !== intent.version || systemRelease.tag !== intent.tag) {
      failures.push('release intent version and tag must match system-release.json');
    }
    if (systemRelease.asset.name !== intent.pressSystem.asset.name
      || systemRelease.asset.url !== intent.pressSystem.asset.url
      || systemRelease.asset.size !== intent.pressSystem.asset.size
      || systemRelease.asset.digest !== intent.pressSystem.asset.digest) {
      failures.push('release intent asset must match system-release.json');
    }
    if (systemRelease.runtime.cacheKey !== intent.pressSystem.runtime.cacheKey
      || systemRelease.runtime.entryCount !== intent.pressSystem.runtime.entryCount
      || systemRelease.runtime.edgeCount !== intent.pressSystem.runtime.edgeCount) {
      failures.push('release intent runtime metadata must match system-release.json');
    }
    if (!themeContractUpgradesMatch(systemRelease.themeContractUpgrade, intent.pressSystem.themeContractUpgrade)) {
      failures.push('release intent themeContractUpgrade must match system-release.json');
    }
    if (!contentModelUpgradesMatch(systemRelease.contentModelUpgrade, intent.pressSystem.contentModelUpgrade)) {
      failures.push('release intent contentModelUpgrade must match system-release.json');
    }
  }
  return failures;
}

function releaseIntentToProductStateSources(intentInput) {
  const intent = normalizeReleaseIntent(intentInput);
  const defaultSources = getReleaseProductStateSources(DEFAULT_RAW_ROOT);
  const defaultSourceMap = new Map([...defaultSources.downstream, ...defaultSources.themeDemos].map((source) => [source.key, source]));
  const sources = {
    downstream: [],
    themeDemos: []
  };
  intent.targets.forEach((target) => {
    const fallback = defaultSourceMap.get(target.key) || {};
    const source = {
      key: target.key,
      label: target.label,
      repository: target.repository,
      source: target.observed.source,
      type: target.observed.type,
      observedChannels: Object.keys(target.observedChannels || {}).length
        ? target.observedChannels
        : clone(fallback.observedChannels || {}),
      eventType: target.eventType,
      reconciler: {
        eventType: target.eventType,
        kind: target.reconciler.kind,
        idempotent: target.reconciler.idempotent !== false
      }
    };
    if (target.category === 'downstream') sources.downstream.push(source);
    if (target.category === 'themeDemo') sources.themeDemos.push(source);
  });
  return sources;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--system-release') options.systemRelease = argv[++i] || '';
    else if (arg === '--system-release-path') options.systemReleasePath = argv[++i] || '';
    else if (arg === '--system-release-source') options.systemReleaseSource = argv[++i] || '';
    else if (arg === '--out') options.out = argv[++i] || '';
    else if (arg === '--source') options.source = argv[++i] || '';
    else if (arg === '--latest-source') options.latestSource = argv[++i] || '';
    else if (arg === '--repository') options.repository = argv[++i] || '';
    else if (arg === '--check') options.check = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log([
    'usage: node scripts/release-intent.js --system-release <path> [options]',
    '',
    'Options:',
    '  --system-release <path>  Generated system-release.json to describe',
    '  --system-release-path <path> Browser-readable immutable system-release path',
    '  --system-release-source <url> Browser-readable system-release.json URL',
    '  --out <path>             Write release intent JSON to path',
    '  --source <url>           Immutable browser-readable release intent URL',
    '  --latest-source <url>    Latest release intent URL',
    '  --repository <owner/repo> Press repository identity',
    '  --check                  Validate the generated release intent'
  ].join('\n'));
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }
  if (!options.systemRelease) throw new Error('--system-release is required');
  const systemRelease = readJsonFile(options.systemRelease);
  const intent = buildReleaseIntent({
    systemRelease,
    source: options.source,
    latestSource: options.latestSource,
    repository: options.repository || DEFAULT_PRESS_REPOSITORY,
    systemReleasePath: options.systemReleasePath,
    systemReleaseSource: options.systemReleaseSource || options.systemRelease,
    systemReleaseDigest: sha256File(options.systemRelease)
  });
  const failures = validateReleaseIntent(intent, { systemRelease });
  if (failures.length) throw new Error(failures.join('\n'));
  const json = `${JSON.stringify(intent, null, 2)}\n`;
  if (options.out) {
    fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
    fs.writeFileSync(options.out, json);
  } else {
    process.stdout.write(json);
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  RELEASE_INTENT_TYPE,
  buildReleaseIntent,
  normalizeReleaseIntent,
  releaseIntentToProductStateSources,
  validateReleaseIntent
};
