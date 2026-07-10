#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

const POLICY_TYPE = 'press-release-graph-policy';
const RELEASE_INTENT_TYPE = 'press-release-intent';
const SYSTEM_RELEASE_TYPE = 'press-system';
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function normalizeSemver(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^v?(\d+)\.(\d+)\.(\d+)$/iu);
  if (!match) return '';
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

function semverToTag(value) {
  const version = normalizeSemver(value);
  return version ? `v${version}` : '';
}

function compareSemver(leftValue, rightValue) {
  const left = normalizeSemver(leftValue);
  const right = normalizeSemver(rightValue);
  if (!left || !right) return null;
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] === rightParts[index]) continue;
    return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

function testComparator(version, token) {
  const raw = String(token || '').trim();
  if (raw === '*') return true;
  const match = raw.match(/^(>=|<=|>|<|=)?\s*(v?\d+\.\d+\.\d+)$/iu);
  if (!match) return false;
  const comparison = compareSemver(version, match[2]);
  if (comparison === null) return false;
  const operator = match[1] || '=';
  if (operator === '>') return comparison > 0;
  if (operator === '>=') return comparison >= 0;
  if (operator === '<') return comparison < 0;
  if (operator === '<=') return comparison <= 0;
  return comparison === 0;
}

function isValidSemverRange(range) {
  const clauses = String(range || '').split('||').map((part) => part.trim()).filter(Boolean);
  if (!clauses.length) return false;
  return clauses.every((clause) => {
    const tokens = clause.split(/\s+/u).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => token === '*'
      || /^(>=|<=|>|<|=)?\s*v?\d+\.\d+\.\d+$/iu.test(token));
  });
}

function satisfiesSemverRange(version, range) {
  const normalizedVersion = normalizeSemver(version);
  if (!normalizedVersion || !isValidSemverRange(range)) return false;
  return String(range).split('||').map((part) => part.trim()).filter(Boolean).some((clause) => {
    const tokens = clause.split(/\s+/u).filter(Boolean);
    return tokens.every((token) => testComparator(normalizedVersion, token));
  });
}

function semverParts(value) {
  const version = normalizeSemver(value);
  return version ? version.split('.').map(Number) : null;
}

function compareParts(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] === right[index]) continue;
    return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

function nextPatch(parts) {
  return [parts[0], parts[1], parts[2] + 1];
}

function rangeIntervals(range) {
  if (!isValidSemverRange(range)) return [];
  return String(range).split('||').map((clause) => {
    let lower = [0, 0, 0];
    let upper = null;
    clause.trim().split(/\s+/u).filter(Boolean).forEach((token) => {
      if (token === '*') return;
      const match = token.match(/^(>=|<=|>|<|=)?\s*(v?\d+\.\d+\.\d+)$/iu);
      const operator = match[1] || '=';
      const version = semverParts(match[2]);
      if (operator === '>=' && compareParts(version, lower) > 0) lower = version;
      else if (operator === '>' && compareParts(nextPatch(version), lower) > 0) lower = nextPatch(version);
      else if (operator === '<' && (!upper || compareParts(version, upper) < 0)) upper = version;
      else if (operator === '<=' && (!upper || compareParts(nextPatch(version), upper) < 0)) upper = nextPatch(version);
      else if (operator === '=') {
        if (compareParts(version, lower) > 0) lower = version;
        if (!upper || compareParts(nextPatch(version), upper) < 0) upper = nextPatch(version);
      }
    });
    return { lower, upper, empty: Boolean(upper && compareParts(lower, upper) >= 0) };
  });
}

function intervalIsCovered(candidateInterval, supportIntervals) {
  if (candidateInterval.empty || !candidateInterval.upper) return false;
  const intervals = supportIntervals.filter((interval) => !interval.empty)
    .sort((left, right) => compareParts(left.lower, right.lower));
  let cursor = candidateInterval.lower;
  for (const interval of intervals) {
    if (interval.upper && compareParts(interval.upper, cursor) <= 0) continue;
    if (compareParts(interval.lower, cursor) > 0) return false;
    if (!interval.upper || compareParts(interval.upper, candidateInterval.upper) >= 0) return true;
    if (compareParts(interval.upper, cursor) > 0) cursor = interval.upper;
  }
  return false;
}

function normalizeUpgradeFrom(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    ranges: Array.isArray(source.ranges) ? source.ranges.map((range) => String(range || '').trim()) : [],
    allowUnknownSource: source.allowUnknownSource === true,
    message: String(source.message || '').trim()
  };
}

function normalizeAsset(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    name: String(source.name || '').trim(),
    url: String(source.url || '').trim(),
    size: Number(source.size || 0),
    digest: String(source.digest || '').trim().toLowerCase()
  };
}

function normalizeRuntime(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    manifestPath: String(source.manifestPath || '').trim(),
    type: String(source.type || '').trim(),
    strategy: String(source.strategy || '').trim(),
    cacheKey: String(source.cacheKey || '').trim(),
    entryCount: Number(source.entryCount || 0),
    edgeCount: Number(source.edgeCount || 0)
  };
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function jsonMatches(left, right) {
  return isDeepStrictEqual(left || {}, right || {});
}

function renderArtifactPath(template, version) {
  return String(template || '').replaceAll('{version}', normalizeSemver(version));
}

function expectedTargetMetadata(policy, versionValue) {
  const version = normalizeSemver(versionValue);
  const layout = policy && policy.artifactLayout && typeof policy.artifactLayout === 'object'
    ? policy.artifactLayout
    : {};
  const rawRoot = String(layout.rawRoot || '').replace(/\/+$/u, '');
  const systemReleasePath = renderArtifactPath(layout.systemRelease, version);
  const releaseIntentPath = renderArtifactPath(layout.releaseIntent, version);
  const assetPath = renderArtifactPath(layout.asset, version);
  return {
    version,
    tag: semverToTag(version),
    systemReleasePath,
    systemReleaseUrl: systemReleasePath ? `${rawRoot}/${systemReleasePath}` : '',
    releaseIntentPath,
    releaseIntentUrl: releaseIntentPath ? `${rawRoot}/${releaseIntentPath}` : '',
    assetPath,
    assetName: path.posix.basename(assetPath),
    assetUrl: assetPath ? `${rawRoot}/${assetPath}` : '',
    latestReleaseIntentUrl: rawRoot ? `${rawRoot}/release-intent.json` : ''
  };
}

function validatePolicy(policy) {
  const failures = [];
  if (!policy || typeof policy !== 'object') return ['release graph policy must be a JSON object'];
  if (policy.schemaVersion !== 1) failures.push('release graph policy schemaVersion must be 1');
  if (policy.type !== POLICY_TYPE) failures.push(`release graph policy type must be ${POLICY_TYPE}`);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(String(policy.repository || ''))) {
    failures.push('release graph policy repository must be an owner/name pair');
  }
  const support = policy.support && typeof policy.support === 'object' ? policy.support : {};
  const floor = normalizeSemver(support.floor);
  if (!floor) failures.push('release graph policy support.floor must be an exact semantic version');
  if (support.updateStrategy !== 'latest-only') {
    failures.push('release graph policy support.updateStrategy must be latest-only');
  }
  const sourceRanges = Array.isArray(support.sourceRanges) ? support.sourceRanges : [];
  if (!sourceRanges.length || sourceRanges.some((range) => !isValidSemverRange(range))) {
    failures.push('release graph policy support.sourceRanges must contain valid semantic-version ranges');
  } else if (floor && !sourceRanges.some((range) => satisfiesSemverRange(floor, range))) {
    failures.push(`release graph support floor ${floor} must be included in support.sourceRanges`);
  }

  const gate = policy.candidateGate && typeof policy.candidateGate === 'object' ? policy.candidateGate : {};
  if (!['direct', 'recovery-required'].includes(gate.mode)) {
    failures.push('release graph policy candidateGate.mode must be direct or recovery-required');
  }
  if (!normalizeSemver(gate.baselineVersion)) {
    failures.push('release graph policy candidateGate.baselineVersion must be an exact semantic version');
  }
  if (!String(gate.reason || '').trim() || !String(gate.removalCondition || '').trim()) {
    failures.push('release graph policy candidateGate must declare a reason and removalCondition');
  }

  const layout = policy.artifactLayout && typeof policy.artifactLayout === 'object'
    ? policy.artifactLayout
    : {};
  ['systemRelease', 'releaseIntent', 'asset'].forEach((key) => {
    if (!String(layout[key] || '').includes('{version}')) {
      failures.push(`release graph policy artifactLayout.${key} must include {version}`);
    }
  });
  const expectedRawRoot = policy.repository
    ? `https://raw.githubusercontent.com/${policy.repository}/release-artifacts`
    : '';
  if (String(layout.rawRoot || '').replace(/\/+$/u, '') !== expectedRawRoot) {
    failures.push(`release graph policy artifactLayout.rawRoot must be ${expectedRawRoot}`);
  }

  const exceptions = Array.isArray(policy.legacyExceptions) ? policy.legacyExceptions : [];
  const ids = new Set();
  const targets = new Set();
  exceptions.forEach((exception, index) => {
    const prefix = `release graph legacyExceptions[${index}]`;
    const id = String(exception && exception.id || '').trim();
    const from = normalizeSemver(exception && exception.from);
    const target = normalizeSemver(exception && exception.to);
    const unpublishedRange = String(exception && exception.unpublishedRange || '').trim();
    const targetRanges = exception && Array.isArray(exception.targetRanges)
      ? exception.targetRanges.map((range) => String(range || '').trim())
      : [];
    const missingSources = exception && Array.isArray(exception.missingSources)
      ? exception.missingSources.map(normalizeSemver)
      : [];
    if (!id || ids.has(id)) failures.push(`${prefix}.id must be unique and non-empty`);
    if (!from || !target || compareSemver(from, target) >= 0 || targets.has(target)) {
      failures.push(`${prefix}.from and .to must be ordered unique exact versions`);
    }
    if (!exception || !['recovered', 'recovery-required'].includes(exception.status)) {
      failures.push(`${prefix}.status must be recovered or recovery-required`);
    }
    const recoveredByVersion = normalizeSemver(exception && exception.recoveredByVersion);
    if (exception && exception.status === 'recovered'
      && (!recoveredByVersion || compareSemver(recoveredByVersion, target) <= 0)) {
      failures.push(`${prefix}.recoveredByVersion must be newer than .to when status is recovered`);
    }
    if (exception && exception.status === 'recovery-required' && recoveredByVersion) {
      failures.push(`${prefix}.recoveredByVersion is only valid when status is recovered`);
    }
    if (exception && exception.status === 'recovered' && gate.mode !== 'direct') {
      failures.push(`${prefix}.status recovered requires candidateGate.mode direct`);
    }
    if (!missingSources.length || missingSources.some((source) => !source)) {
      failures.push(`${prefix}.missingSources must contain exact semantic versions`);
    }
    if (!isValidSemverRange(unpublishedRange)
      || !targetRanges.length
      || targetRanges.some((range) => !isValidSemverRange(range))) {
      failures.push(`${prefix} must declare valid unpublishedRange and targetRanges`);
    }
    if (!String(exception && exception.reason || '').trim()
      || !String(exception && exception.removalCondition || '').trim()) {
      failures.push(`${prefix} must declare a reason and removalCondition`);
    }
    ids.add(id);
    targets.add(target);
  });
  return failures;
}

function validateUpgradeFrom(upgradeFrom, targetVersion, label) {
  const failures = [];
  const normalized = normalizeUpgradeFrom(upgradeFrom);
  if (!normalized.ranges.length) failures.push(`${label} upgradeFrom.ranges must not be empty`);
  normalized.ranges.forEach((range) => {
    if (!isValidSemverRange(range)) failures.push(`${label} has invalid upgradeFrom range: ${range || '(empty)'}`);
    if (satisfiesSemverRange(targetVersion, range)) {
      failures.push(`${label} upgradeFrom range must not accept its own target version: ${range}`);
    }
    const targetParts = semverParts(targetVersion);
    rangeIntervals(range).forEach((interval) => {
      if (interval.empty) failures.push(`${label} has an unsatisfiable upgradeFrom clause: ${range}`);
      else if (!interval.upper || compareParts(interval.upper, targetParts) > 0) {
        failures.push(`${label} upgradeFrom range must not accept target or future versions: ${range}`);
      }
    });
  });
  if (!upgradeFrom || typeof upgradeFrom.allowUnknownSource !== 'boolean') {
    failures.push(`${label} upgradeFrom.allowUnknownSource must be a boolean`);
  }
  return failures;
}

function validateDirectCandidateDomain(candidate, policy) {
  const failures = [];
  const candidateRanges = normalizeUpgradeFrom(candidate && candidate.upgradeFrom).ranges;
  const supportIntervals = policy.support.sourceRanges.flatMap(rangeIntervals);
  candidateRanges.flatMap(rangeIntervals).forEach((interval) => {
    if (!intervalIsCovered(interval, supportIntervals)) {
      failures.push(`candidate v${normalizeSemver(candidate && candidate.version)} upgradeFrom admits versions outside policy support.sourceRanges`);
    }
  });
  return failures;
}

function validatePublishedRelease(release, policy, artifactPaths, githubReleases) {
  const failures = [];
  const manifest = release && release.manifest && typeof release.manifest === 'object'
    ? release.manifest
    : null;
  const intent = release && release.intent && typeof release.intent === 'object'
    ? release.intent
    : null;
  const sourceManifest = release && release.sourceManifest && typeof release.sourceManifest === 'object'
    ? release.sourceManifest
    : null;
  const version = normalizeSemver(manifest && manifest.version || release && release.version);
  const label = version ? `published release v${version}` : 'published release with unknown version';
  if (!manifest) return [`${label} is missing a readable system-release.json`];
  if (!intent) failures.push(`${label} is missing a readable release-intent.json`);
  if (release.tagExists !== true) failures.push(`${label} is missing Git tag v${version}`);
  if (!sourceManifest) failures.push(`${label} is missing assets/press-system.json at Git tag v${version}`);
  if (!version) return [...failures, `${label} has an invalid version`];

  const expected = expectedTargetMetadata(policy, version);
  if (manifest.schemaVersion !== 1) failures.push(`${label} system-release schemaVersion must be 1`);
  if (manifest.version !== version || manifest.tag !== expected.tag) {
    failures.push(`${label} system-release version and tag must match ${expected.tag}`);
  }
  failures.push(...validateUpgradeFrom(manifest.upgradeFrom, version, label));
  if (sourceManifest) {
    if (sourceManifest.schemaVersion !== 1
      || sourceManifest.type !== SYSTEM_RELEASE_TYPE
      || sourceManifest.version !== version
      || sourceManifest.tag !== expected.tag) {
      failures.push(`${label} tagged Press system manifest identity is inconsistent`);
    }
    if (!jsonMatches(normalizeUpgradeFrom(sourceManifest.upgradeFrom), normalizeUpgradeFrom(manifest.upgradeFrom))
      || !jsonMatches(sourceManifest.themeContractUpgrade, manifest.themeContractUpgrade)
      || !jsonMatches(sourceManifest.contentModelUpgrade, manifest.contentModelUpgrade)) {
      failures.push(`${label} tagged Press system compatibility metadata does not match system-release.json`);
    }
  }

  const runtime = normalizeRuntime(manifest.runtime);
  if (runtime.manifestPath !== 'assets/press-runtime-manifest.json'
    || runtime.type !== 'press-runtime-assets'
    || runtime.cacheKey !== `press-system-${expected.tag}`
    || runtime.entryCount <= 0
    || runtime.edgeCount <= 0) {
    failures.push(`${label} runtime manifest metadata is incomplete or inconsistent`);
  }

  const asset = normalizeAsset(manifest.asset);
  if (asset.name !== expected.assetName || asset.url !== expected.assetUrl) {
    failures.push(`${label} asset name and URL must target ${expected.assetPath}`);
  }
  if (asset.size <= 0 || !SHA256_PATTERN.test(asset.digest)) {
    failures.push(`${label} asset size and sha256 digest must be present`);
  }
  if (!artifactPaths.has(expected.assetPath)) failures.push(`${label} is missing artifact ${expected.assetPath}`);
  if (!artifactPaths.has(expected.systemReleasePath)) {
    failures.push(`${label} is missing manifest ${expected.systemReleasePath}`);
  }
  if (!artifactPaths.has(expected.releaseIntentPath)) {
    failures.push(`${label} is missing manifest ${expected.releaseIntentPath}`);
  }
  if (Number.isFinite(release.actualAssetSize) && asset.size !== release.actualAssetSize) {
    failures.push(`${label} asset size does not match the published ZIP`);
  }
  if (release.actualAssetDigest && asset.digest !== release.actualAssetDigest) {
    failures.push(`${label} asset digest does not match the published ZIP`);
  }
  const githubRelease = githubReleases.get(expected.tag);
  if (!githubRelease) {
    failures.push(`${label} is missing a matching GitHub Release object`);
  } else {
    if (githubRelease.draft === true || githubRelease.prerelease === true) {
      failures.push(`${label} GitHub Release must be published and non-prerelease`);
    }
    const releaseAssets = Array.isArray(githubRelease.assets) ? githubRelease.assets : [];
    const matchingAssets = releaseAssets.filter((entry) => String(entry && entry.name || '') === expected.assetName);
    if (matchingAssets.length !== 1) {
      failures.push(`${label} GitHub Release must contain exactly one ${expected.assetName} asset`);
    } else {
      const releaseAsset = matchingAssets[0];
      const releaseDigest = String(releaseAsset.digest || '').trim().toLowerCase();
      if (Number(releaseAsset.size || 0) !== asset.size || releaseDigest !== asset.digest) {
        failures.push(`${label} GitHub Release asset size or digest does not match system-release.json`);
      }
    }
  }

  const intentPointer = manifest.intent && typeof manifest.intent === 'object' ? manifest.intent : {};
  if (intentPointer.type !== RELEASE_INTENT_TYPE
    || intentPointer.path !== expected.releaseIntentPath
    || intentPointer.url !== expected.releaseIntentUrl
    || intentPointer.latestPath !== 'release-intent.json'
    || intentPointer.latestUrl !== expected.latestReleaseIntentUrl) {
    failures.push(`${label} system-release intent pointer is inconsistent with the artifact layout`);
  }

  if (intent) {
    if (intent.schemaVersion !== 1
      || intent.type !== RELEASE_INTENT_TYPE
      || intent.repository !== policy.repository
      || intent.version !== version
      || intent.tag !== expected.tag
      || intent.source !== expected.releaseIntentUrl
      || intent.latestSource !== expected.latestReleaseIntentUrl) {
      failures.push(`${label} release intent identity or source metadata is inconsistent`);
    }
    const systemRelease = intent.systemRelease && typeof intent.systemRelease === 'object'
      ? intent.systemRelease
      : {};
    if (systemRelease.path !== expected.systemReleasePath
      || systemRelease.source !== expected.systemReleaseUrl
      || !SHA256_PATTERN.test(String(systemRelease.digest || '').toLowerCase())) {
      failures.push(`${label} release intent system-release target metadata is inconsistent`);
    }
    if (release.manifestText && String(systemRelease.digest || '').toLowerCase() !== sha256(release.manifestText)) {
      failures.push(`${label} release intent system-release digest does not match its manifest`);
    }
    const pressSystem = intent.pressSystem && typeof intent.pressSystem === 'object' ? intent.pressSystem : {};
    if (!jsonMatches(normalizeAsset(pressSystem.asset), asset)) {
      failures.push(`${label} release intent asset metadata does not match system-release.json`);
    }
    if (!jsonMatches(normalizeRuntime(pressSystem.runtime), runtime)) {
      failures.push(`${label} release intent runtime metadata does not match system-release.json`);
    }
    if (!jsonMatches(normalizeUpgradeFrom(pressSystem.upgradeFrom), normalizeUpgradeFrom(manifest.upgradeFrom))) {
      failures.push(`${label} release intent upgradeFrom does not match system-release.json`);
    }
    if (!jsonMatches(pressSystem.themeContractUpgrade, manifest.themeContractUpgrade)
      || !jsonMatches(pressSystem.contentModelUpgrade, manifest.contentModelUpgrade)) {
      failures.push(`${label} release intent migration compatibility metadata does not match system-release.json`);
    }
  }
  return failures;
}

function validateCandidate(candidate, publishedByVersion) {
  const failures = [];
  const version = normalizeSemver(candidate && candidate.version);
  const label = version ? `candidate v${version}` : 'release candidate';
  if (!candidate || typeof candidate !== 'object') return ['release candidate manifest must be a JSON object'];
  if (candidate.schemaVersion !== 1 || candidate.type !== SYSTEM_RELEASE_TYPE) {
    failures.push(`${label} must use the press-system schemaVersion 1 manifest`);
  }
  if (!version || candidate.version !== version || candidate.tag !== semverToTag(version)) {
    failures.push(`${label} version and tag must be matching exact semantic versions`);
  }
  if (version) failures.push(...validateUpgradeFrom(candidate.upgradeFrom, version, label));
  if (normalizeUpgradeFrom(candidate.upgradeFrom).allowUnknownSource) {
    failures.push(`${label} must not allow an unknown source version`);
  }
  const published = publishedByVersion.get(version);
  if (published && published.manifest) {
    if (!jsonMatches(normalizeUpgradeFrom(candidate.upgradeFrom), normalizeUpgradeFrom(published.manifest.upgradeFrom))
      || !jsonMatches(candidate.themeContractUpgrade, published.manifest.themeContractUpgrade)
      || !jsonMatches(candidate.contentModelUpgrade, published.manifest.contentModelUpgrade)) {
      failures.push(`${label} does not match the published release compatibility metadata`);
    }
  }
  return failures;
}

function normalizePressSystemCompatibility(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    schemaVersion: Number(source.schemaVersion || 0),
    type: String(source.type || '').trim(),
    version: normalizeSemver(source.version),
    tag: semverToTag(source.tag || source.version),
    upgradeFrom: normalizeUpgradeFrom(source.upgradeFrom),
    themeContractUpgrade: source.themeContractUpgrade && typeof source.themeContractUpgrade === 'object'
      ? source.themeContractUpgrade
      : {},
    contentModelUpgrade: source.contentModelUpgrade && typeof source.contentModelUpgrade === 'object'
      ? source.contentModelUpgrade
      : {}
  };
}

function validateCandidateArchive(candidate, candidateArchive) {
  const failures = [];
  const version = normalizeSemver(candidate && candidate.version);
  const label = version ? `candidate v${version}` : 'release candidate';
  if (!candidateArchive || typeof candidateArchive !== 'object') {
    return [`${label} must be verified against a built system ZIP before release creation`];
  }
  const expectedName = `press-system-v${version}.zip`;
  const expectedRoot = `press-system-v${version}/`;
  const entries = Array.isArray(candidateArchive.entries)
    ? candidateArchive.entries.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  if (String(candidateArchive.name || '') !== expectedName) {
    failures.push(`${label} archive name must be ${expectedName}`);
  }
  if (Number(candidateArchive.size || 0) <= 0
    || !SHA256_PATTERN.test(String(candidateArchive.digest || '').toLowerCase())) {
    failures.push(`${label} archive must have a positive size and sha256 digest`);
  }
  if (!entries.length || entries.some((entry) => !entry.startsWith(expectedRoot))) {
    failures.push(`${label} archive must contain exactly the ${expectedRoot} root`);
  }
  const embeddedPath = `${expectedRoot}assets/press-system.json`;
  if (!entries.includes(embeddedPath)) failures.push(`${label} archive is missing ${embeddedPath}`);
  if (!candidateArchive.embeddedManifest
    || !jsonMatches(
      normalizePressSystemCompatibility(candidateArchive.embeddedManifest),
      normalizePressSystemCompatibility(candidate)
    )) {
    failures.push(`${label} archive Press system manifest does not match the worktree candidate`);
  }
  return failures;
}

function validateDirectCandidatePrerequisites(candidate) {
  const failures = [];
  const version = normalizeSemver(candidate && candidate.version);
  const themeUpgrade = candidate && candidate.themeContractUpgrade
    && typeof candidate.themeContractUpgrade === 'object'
    ? candidate.themeContractUpgrade
    : {};
  const requiredThemeContract = Number(themeUpgrade.requiresInstalledThemeContractVersion || 0);
  if (Number.isFinite(requiredThemeContract) && requiredThemeContract > 0) {
    failures.push(`candidate v${version} cannot claim direct recovery while requiring installed theme contract v${Math.floor(requiredThemeContract)}`);
  }
  const contentUpgrade = candidate && candidate.contentModelUpgrade
    && typeof candidate.contentModelUpgrade === 'object'
    ? candidate.contentModelUpgrade
    : {};
  if (contentUpgrade.requiresUnifiedIndexTabs === true) {
    failures.push(`candidate v${version} cannot claim direct recovery while requiring a pre-migrated unified content model`);
  }
  return failures;
}

function upgradeAllowsSource(targetManifest, sourceVersion) {
  const upgradeFrom = normalizeUpgradeFrom(targetManifest && targetManifest.upgradeFrom);
  return upgradeFrom.ranges.some((range) => satisfiesSemverRange(sourceVersion, range));
}

function analyzeReleaseGraph(input = {}) {
  const policy = input.policy;
  const publishedReleases = Array.isArray(input.publishedReleases) ? input.publishedReleases : [];
  const artifactPaths = input.artifactPaths instanceof Set
    ? input.artifactPaths
    : new Set(input.artifactPaths || []);
  const gitTags = input.gitTags instanceof Set ? input.gitTags : new Set(input.gitTags || []);
  const githubReleases = input.githubReleases instanceof Map ? input.githubReleases : new Map();
  const candidate = input.candidate;
  const failures = validatePolicy(policy);
  if (failures.length) return { failures, publishedVersions: [], supportedSources: [], directMissing: [] };

  const requestedMode = String(input.validationMode || 'audit').trim();
  if (!['audit', 'auto', 'candidate'].includes(requestedMode)) {
    failures.push('release graph validationMode must be audit, auto, or candidate');
  }

  const floor = normalizeSemver(policy.support.floor);
  const publishedByVersion = new Map();
  publishedReleases.forEach((release) => {
    const version = normalizeSemver(release && release.manifest && release.manifest.version || release && release.version);
    if (!version) {
      failures.push('published release registry contains an invalid version');
      return;
    }
    if (compareSemver(version, floor) < 0) return;
    if (publishedByVersion.has(version)) {
      failures.push(`published release registry contains duplicate v${version}`);
      return;
    }
    publishedByVersion.set(version, release);
    failures.push(...validatePublishedRelease(release, policy, artifactPaths, githubReleases));
  });

  const publishedVersions = [...publishedByVersion.keys()].sort(compareSemver);
  if (!publishedByVersion.has(floor)) failures.push(`support floor v${floor} is missing from the published release registry`);
  if (!publishedVersions.length) {
    failures.push('published release registry has no releases at or above the support floor');
    return { failures, publishedVersions, supportedSources: [], directMissing: [] };
  }

  const sourceRanges = policy.support.sourceRanges;
  publishedVersions.forEach((version) => {
    if (!sourceRanges.some((range) => satisfiesSemverRange(version, range))) {
      failures.push(`published release v${version} at or above the support floor is not declared by support.sourceRanges`);
    }
  });
  const latestPublishedVersion = publishedVersions[publishedVersions.length - 1];
  const latestPublishedRelease = publishedByVersion.get(latestPublishedVersion);
  if (!artifactPaths.has('system-release.json') || !String(input.latestSystemReleaseText || '')) {
    failures.push('release artifact registry is missing latest system-release.json');
  } else if (input.latestSystemReleaseText !== latestPublishedRelease.manifestText) {
    failures.push(`latest system-release.json does not match immutable v${latestPublishedVersion}/system-release.json`);
  }
  if (!artifactPaths.has('release-intent.json') || !String(input.latestReleaseIntentText || '')) {
    failures.push('release artifact registry is missing latest release-intent.json');
  } else if (input.latestReleaseIntentText !== latestPublishedRelease.intentText) {
    failures.push(`latest release-intent.json does not match immutable v${latestPublishedVersion}/release-intent.json`);
  }
  const targetManifests = new Map(publishedVersions.map((version) => [version, publishedByVersion.get(version).manifest]));
  const exceptionByTarget = new Map(policy.legacyExceptions.map((exception) => [
    normalizeSemver(exception.to),
    exception
  ]));
  publishedVersions.forEach((targetVersion) => {
    if (targetVersion === floor) return;
    const targetManifest = targetManifests.get(targetVersion);
    const incoming = publishedVersions.filter((sourceVersion) => compareSemver(sourceVersion, targetVersion) < 0
      && upgradeAllowsSource(targetManifest, sourceVersion));
    const exception = exceptionByTarget.get(targetVersion);
    if (incoming.length && exception) {
      failures.push(`legacy exception ${exception.id} is stale because v${targetVersion} admits published source v${incoming[0]}`);
      return;
    }
    if (incoming.length) return;
    if (!exception) {
      failures.push(`target v${targetVersion} has no published source admitted by upgradeFrom`);
      return;
    }
    const missingSources = exception.missingSources.map(normalizeSemver);
    missingSources.forEach((sourceVersion) => {
      if (publishedByVersion.has(sourceVersion)) {
        failures.push(`legacy exception ${exception.id} names published source v${sourceVersion} as missing`);
      }
      if (!satisfiesSemverRange(sourceVersion, exception.unpublishedRange)) {
        failures.push(`legacy exception ${exception.id} missing source v${sourceVersion} is outside unpublishedRange`);
      }
      if (compareSemver(sourceVersion, targetVersion) >= 0 || !upgradeAllowsSource(targetManifest, sourceVersion)) {
        failures.push(`legacy exception ${exception.id} missing source v${sourceVersion} is not admitted by v${targetVersion}`);
      }
    });
  });

  policy.legacyExceptions.forEach((exception) => {
    const from = normalizeSemver(exception.from);
    const target = normalizeSemver(exception.to);
    const fromIndex = publishedVersions.indexOf(from);
    const targetIndex = publishedVersions.indexOf(target);
    if (fromIndex < 0 || targetIndex < 0) {
      failures.push(`legacy exception ${exception.id} endpoints must both be published`);
      return;
    }
    if (targetIndex !== fromIndex + 1) {
      failures.push(`legacy exception ${exception.id} endpoints must be adjacent published releases`);
    }
    const targetManifest = targetManifests.get(target);
    if (!jsonMatches(normalizeUpgradeFrom(targetManifest.upgradeFrom).ranges, exception.targetRanges)) {
      failures.push(`legacy exception ${exception.id} targetRanges do not match v${target} upgradeFrom`);
    }
    const unexpectedPublished = publishedVersions.filter((version) => satisfiesSemverRange(version, exception.unpublishedRange));
    const unexpectedTags = [...gitTags].map(normalizeSemver).filter((version) => version
      && satisfiesSemverRange(version, exception.unpublishedRange));
    if (unexpectedPublished.length || unexpectedTags.length) {
      failures.push(`legacy exception ${exception.id} unpublishedRange contains a published tag or artifact`);
    }
  });

  const outgoing = new Map(publishedVersions.map((version) => [version, []]));
  publishedVersions.forEach((sourceVersion) => {
    publishedVersions.forEach((targetVersion) => {
      if (compareSemver(sourceVersion, targetVersion) < 0
        && upgradeAllowsSource(targetManifests.get(targetVersion), sourceVersion)) {
        outgoing.get(sourceVersion).push(targetVersion);
      }
    });
  });
  function canReachPublishedLatest(sourceVersion) {
    if (sourceVersion === latestPublishedVersion) return true;
    const pending = [sourceVersion];
    const visited = new Set();
    while (pending.length) {
      const current = pending.shift();
      if (current === latestPublishedVersion) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      (outgoing.get(current) || []).forEach((target) => pending.push(target));
    }
    return false;
  }
  const exceptionSources = new Set(policy.legacyExceptions.map((exception) => normalizeSemver(exception.from)));
  publishedVersions.filter((version) => version !== latestPublishedVersion
    && sourceRanges.some((range) => satisfiesSemverRange(version, range)))
    .forEach((sourceVersion) => {
      if (!canReachPublishedLatest(sourceVersion) && !exceptionSources.has(sourceVersion)) {
        failures.push(`published source v${sourceVersion} cannot reach published latest v${latestPublishedVersion}`);
      }
    });
  const worktreeCandidateVersion = normalizeSemver(candidate && candidate.version);
  policy.legacyExceptions.forEach((exception) => {
    const from = normalizeSemver(exception.from);
    const reachesLatest = canReachPublishedLatest(from);
    if (exception.status === 'recovery-required') {
      if (reachesLatest) {
        failures.push(`legacy exception ${exception.id} recovery state is stale because v${from} can reach published latest v${latestPublishedVersion}`);
      }
      return;
    }
    const recoveredByVersion = normalizeSemver(exception.recoveredByVersion);
    const recoveredRelease = targetManifests.get(recoveredByVersion);
    const recoveredCandidate = worktreeCandidateVersion === recoveredByVersion ? candidate : null;
    const recoveryTarget = recoveredRelease || recoveredCandidate;
    if (!recoveryTarget) {
      failures.push(`legacy exception ${exception.id} recoveredByVersion v${recoveredByVersion} is neither published nor the worktree candidate`);
    } else if (!upgradeAllowsSource(recoveryTarget, from)) {
      failures.push(`legacy exception ${exception.id} recoveredByVersion v${recoveredByVersion} does not directly admit v${from}`);
    }
    if (recoveredRelease && !reachesLatest) {
      failures.push(`legacy exception ${exception.id} is marked recovered but v${from} cannot reach published latest v${latestPublishedVersion}`);
    }
  });

  const inferredMode = worktreeCandidateVersion
    && compareSemver(worktreeCandidateVersion, latestPublishedVersion) > 0
    ? 'candidate'
    : 'audit';
  const validationMode = requestedMode === 'auto' ? inferredMode : requestedMode;
  let candidateVersion = latestPublishedVersion;
  let targetCandidate = targetManifests.get(latestPublishedVersion);
  if (validationMode === 'audit') {
    if (worktreeCandidateVersion && compareSemver(worktreeCandidateVersion, latestPublishedVersion) < 0) {
      failures.push(`worktree Press system v${worktreeCandidateVersion} is older than published latest v${latestPublishedVersion}`);
    } else if (worktreeCandidateVersion === latestPublishedVersion) {
      failures.push(...validateCandidate(candidate, publishedByVersion));
    }
  } else {
    failures.push(...validateCandidate(candidate, publishedByVersion));
    candidateVersion = worktreeCandidateVersion;
    targetCandidate = candidate;
    if (!candidateVersion || compareSemver(candidateVersion, latestPublishedVersion) <= 0) {
      failures.push(`release candidate must be newer than published latest v${latestPublishedVersion}`);
    }
    if (candidateVersion && gitTags.has(semverToTag(candidateVersion))) {
      failures.push(`release candidate tag ${semverToTag(candidateVersion)} already exists`);
    }
    failures.push(...validateCandidateArchive(candidate, input.candidateArchive));
    const candidateIncoming = candidateVersion
      ? publishedVersions.filter((version) => compareSemver(version, candidateVersion) < 0
        && upgradeAllowsSource(candidate, version))
      : [];
    if (!candidateIncoming.length) {
      failures.push(`target v${candidateVersion || 'unknown'} has no published source admitted by upgradeFrom`);
    }
    if (exceptionByTarget.has(candidateVersion)) {
      failures.push(`release candidate v${candidateVersion} cannot borrow a legacy graph exception`);
    }
  }

  const supportedSources = candidateVersion && targetCandidate
    ? publishedVersions.filter((version) => compareSemver(version, candidateVersion) < 0
      && sourceRanges.some((range) => satisfiesSemverRange(version, range)))
    : [];
  const directMissing = targetCandidate
    ? supportedSources.filter((version) => !upgradeAllowsSource(targetCandidate, version))
    : [];
  const gate = policy.candidateGate;
  const baselineVersion = normalizeSemver(gate.baselineVersion);
  if (validationMode === 'audit' && gate.mode === 'recovery-required'
    && latestPublishedVersion !== baselineVersion) {
    failures.push(`published latest v${latestPublishedVersion} does not match recovery baseline v${baselineVersion}`);
  } else if (validationMode === 'audit' && gate.mode === 'direct'
    && (!worktreeCandidateVersion || compareSemver(worktreeCandidateVersion, latestPublishedVersion) <= 0)
    && directMissing.length) {
    failures.push(`candidateGate.mode cannot switch to direct without a newer recovery candidate; published latest v${latestPublishedVersion} lacks direct edges from: ${directMissing.map((version) => `v${version}`).join(', ')}`);
  } else if (validationMode === 'candidate' && gate.mode === 'recovery-required') {
    failures.push(`candidate v${candidateVersion || 'unknown'} is blocked while candidateGate.mode is recovery-required; only published baseline v${baselineVersion} may pass`);
  } else if (validationMode === 'candidate' && gate.mode === 'direct') {
    failures.push(...validateDirectCandidatePrerequisites(candidate));
    failures.push(...validateDirectCandidateDomain(candidate, policy));
    policy.legacyExceptions.filter((exception) => exception.status === 'recovery-required')
      .forEach((exception) => {
        failures.push(`legacy exception ${exception.id} must be marked recovered with recoveredByVersion v${candidateVersion}`);
      });
    if (!supportedSources.length) failures.push('direct candidate gate has no declared supported published sources to verify');
    if (directMissing.length) {
      failures.push(`candidate v${candidateVersion} lacks latest-only direct upgrade edges from: ${directMissing.map((version) => `v${version}`).join(', ')}`);
    }
  }

  return {
    failures,
    publishedVersions,
    supportedSources,
    directMissing,
    candidateVersion,
    latestPublishedVersion,
    mode: gate.mode,
    validationMode
  };
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function gitOutput(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd || process.cwd(),
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function parseJsonBlob(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function loadPublishedReleaseRegistry(options = {}) {
  const policy = options.policy;
  const artifactRef = String(options.artifactRef || '').trim();
  const cwd = options.cwd || process.cwd();
  if (!artifactRef) throw new Error('release artifact ref is required');
  try {
    gitOutput(['rev-parse', '--verify', artifactRef], { cwd });
  } catch (error) {
    throw new Error(`release artifact ref ${artifactRef} is unavailable; fetch release-artifacts before verification`);
  }
  const tree = gitOutput(['ls-tree', '-r', '--name-only', artifactRef], { cwd });
  const artifactPaths = new Set(tree.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean));
  const latestSystemReleaseText = artifactPaths.has('system-release.json')
    ? gitOutput(['show', `${artifactRef}:system-release.json`], { cwd })
    : '';
  const latestReleaseIntentText = artifactPaths.has('release-intent.json')
    ? gitOutput(['show', `${artifactRef}:release-intent.json`], { cwd })
    : '';
  const gitTags = new Set(gitOutput(['tag', '-l', 'v[0-9]*.[0-9]*.[0-9]*'], { cwd })
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => /^v\d+\.\d+\.\d+$/u.test(value)));
  const floor = normalizeSemver(policy.support.floor);
  const versions = new Set();
  artifactPaths.forEach((artifactPath) => {
    const match = artifactPath.match(/^v(\d+\.\d+\.\d+)\//u);
    const version = normalizeSemver(match && match[1]);
    if (version && compareSemver(version, floor) >= 0) versions.add(version);
  });
  gitTags.forEach((tag) => {
    const version = normalizeSemver(tag);
    if (version && compareSemver(version, floor) >= 0) versions.add(version);
  });

  const publishedReleases = [...versions].sort(compareSemver).map((version) => {
    const expected = expectedTargetMetadata(policy, version);
    const tag = semverToTag(version);
    const manifestText = artifactPaths.has(expected.systemReleasePath)
      ? gitOutput(['show', `${artifactRef}:${expected.systemReleasePath}`], { cwd })
      : '';
    const intentText = artifactPaths.has(expected.releaseIntentPath)
      ? gitOutput(['show', `${artifactRef}:${expected.releaseIntentPath}`], { cwd })
      : '';
    const assetBuffer = artifactPaths.has(expected.assetPath)
      ? gitOutput(['show', `${artifactRef}:${expected.assetPath}`], { cwd, encoding: null })
      : null;
    const sourceManifestText = gitTags.has(tag)
      ? gitOutput(['show', `${tag}:assets/press-system.json`], { cwd })
      : '';
    return {
      version,
      tagExists: gitTags.has(tag),
      sourceManifest: sourceManifestText
        ? parseJsonBlob(sourceManifestText, `${tag}:assets/press-system.json`)
        : null,
      sourceManifestText,
      manifest: manifestText ? parseJsonBlob(manifestText, expected.systemReleasePath) : null,
      manifestText,
      intent: intentText ? parseJsonBlob(intentText, expected.releaseIntentPath) : null,
      intentText,
      actualAssetSize: assetBuffer ? assetBuffer.length : 0,
      actualAssetDigest: assetBuffer ? sha256(assetBuffer) : ''
    };
  });
  return {
    artifactRef,
    artifactPaths,
    gitTags,
    latestReleaseIntentText,
    latestSystemReleaseText,
    publishedReleases
  };
}

function loadGitHubReleaseRegistry(file) {
  const input = readJsonFile(file);
  const entries = Array.isArray(input) && input.every(Array.isArray) ? input.flat() : input;
  if (!Array.isArray(entries)) throw new Error('GitHub Releases registry must be a JSON array or paginated array');
  const releases = new Map();
  entries.forEach((entry) => {
    const tag = String(entry && (entry.tag_name || entry.tagName) || '').trim();
    if (!/^v\d+\.\d+\.\d+$/u.test(tag)) return;
    if (releases.has(tag)) throw new Error(`GitHub Releases registry contains duplicate ${tag}`);
    releases.set(tag, {
      draft: entry.draft === true,
      prerelease: entry.prerelease === true,
      assets: Array.isArray(entry.assets) ? entry.assets : []
    });
  });
  return releases;
}

function loadCandidateArchive(archivePath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const absolutePath = path.resolve(cwd, archivePath);
  const archiveBuffer = fs.readFileSync(absolutePath);
  execFileSync('unzip', ['-tqq', absolutePath], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const entries = execFileSync('unzip', ['-Z1', absolutePath], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  }).split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean);
  const manifestEntries = entries.filter((entry) => entry.endsWith('/assets/press-system.json'));
  const embeddedManifestText = manifestEntries.length === 1
    ? execFileSync('unzip', ['-p', absolutePath, manifestEntries[0]], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    : '';
  return {
    path: absolutePath,
    name: path.basename(absolutePath),
    size: archiveBuffer.length,
    digest: sha256(archiveBuffer),
    entries,
    embeddedManifest: embeddedManifestText
      ? parseJsonBlob(embeddedManifestText, `${archivePath}:assets/press-system.json`)
      : null
  };
}

function parseArgs(argv) {
  const options = {
    policyPath: 'scripts/release-graph-policy.json',
    candidatePath: 'assets/press-system.json',
    artifactRef: 'origin/release-artifacts',
    githubReleasesPath: '',
    candidateArchivePath: '',
    validationMode: 'audit',
    quiet: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--policy') options.policyPath = argv[++index] || '';
    else if (arg === '--candidate') options.candidatePath = argv[++index] || '';
    else if (arg === '--artifact-ref') options.artifactRef = argv[++index] || '';
    else if (arg === '--github-releases') options.githubReleasesPath = argv[++index] || '';
    else if (arg === '--candidate-archive') options.candidateArchivePath = argv[++index] || '';
    else if (arg === '--mode') options.validationMode = argv[++index] || '';
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--check') continue;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log([
    'usage: node scripts/release-graph.js [options]',
    '',
    'Options:',
    '  --policy <path>       Release graph policy JSON',
    '  --candidate <path>    Candidate assets/press-system.json',
    '  --artifact-ref <ref>  Git ref containing published release artifacts',
    '  --github-releases <path>  Paginated GitHub Releases API JSON (required)',
    '  --candidate-archive <path>  Built candidate ZIP required in candidate mode',
    '  --mode <mode>          audit, auto, or candidate (default: audit)',
    '  --check               Validate and exit non-zero on failure',
    '  --quiet               Suppress the success summary'
  ].join('\n'));
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }
  const policy = readJsonFile(options.policyPath);
  const candidate = readJsonFile(options.candidatePath);
  if (!options.githubReleasesPath) throw new Error('--github-releases is required');
  const githubReleases = loadGitHubReleaseRegistry(options.githubReleasesPath);
  const candidateArchive = options.candidateArchivePath
    ? loadCandidateArchive(options.candidateArchivePath, { cwd: process.cwd() })
    : null;
  const registry = loadPublishedReleaseRegistry({
    policy,
    artifactRef: options.artifactRef,
    cwd: process.cwd()
  });
  const result = analyzeReleaseGraph({
    policy,
    candidate,
    candidateArchive,
    validationMode: options.validationMode,
    publishedReleases: registry.publishedReleases,
    artifactPaths: registry.artifactPaths,
    gitTags: registry.gitTags,
    githubReleases,
    latestReleaseIntentText: registry.latestReleaseIntentText,
    latestSystemReleaseText: registry.latestSystemReleaseText
  });
  if (result.failures.length) {
    result.failures.forEach((failure) => console.error(`release graph: ${failure}`));
    return 1;
  }
  if (!options.quiet) {
    const baselineNote = result.mode === 'recovery-required'
      ? `; KNOWN LEGACY BREAK: ${result.directMissing.length} supported sources remain recovery-blocked`
      : '';
    const subject = result.validationMode === 'candidate' ? 'candidate' : 'published baseline';
    console.log(`ok - verified ${result.publishedVersions.length} published releases and ${subject} v${result.candidateVersion}${baselineNote}`);
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
  analyzeReleaseGraph,
  compareSemver,
  expectedTargetMetadata,
  isValidSemverRange,
  loadCandidateArchive,
  loadGitHubReleaseRegistry,
  loadPublishedReleaseRegistry,
  normalizeSemver,
  normalizeUpgradeFrom,
  satisfiesSemverRange,
  sha256,
  upgradeAllowsSource,
  validateCandidateArchive,
  validatePolicy
};
