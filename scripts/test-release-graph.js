const assert = require('node:assert/strict');
const test = require('node:test');

const policySource = require('./release-graph-policy.json');
const {
  analyzeReleaseGraph,
  expectedTargetMetadata,
  satisfiesSemverRange,
  sha256
} = require('./release-graph.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function upgradeFrom(range) {
  return {
    ranges: [range],
    allowUnknownSource: false,
    message: 'Use the required recovery path.'
  };
}

function candidateManifest(version, range) {
  return {
    schemaVersion: 1,
    type: 'press-system',
    version,
    tag: `v${version}`,
    upgradeFrom: upgradeFrom(range)
  };
}

function candidateArchive(candidate) {
  const version = candidate.version;
  const root = `press-system-v${version}/`;
  return {
    name: `press-system-v${version}.zip`,
    size: 100,
    digest: `sha256:${'a'.repeat(64)}`,
    entries: [
      root,
      `${root}index.html`,
      `${root}assets/press-system.json`
    ],
    embeddedManifest: clone(candidate)
  };
}

function makePublishedRelease(version, range, policy, artifactPaths) {
  const expected = expectedTargetMetadata(policy, version);
  const assetBuffer = Buffer.from(`press system archive ${version}`);
  const asset = {
    name: expected.assetName,
    url: expected.assetUrl,
    size: assetBuffer.length,
    digest: sha256(assetBuffer)
  };
  const runtime = {
    manifestPath: 'assets/press-runtime-manifest.json',
    type: 'press-runtime-assets',
    strategy: 'query-param',
    cacheKey: `press-system-v${version}`,
    entryCount: 10,
    edgeCount: 12
  };
  const manifest = {
    schemaVersion: 1,
    tag: `v${version}`,
    version,
    upgradeFrom: upgradeFrom(range),
    runtime,
    asset,
    intent: {
      type: 'press-release-intent',
      path: expected.releaseIntentPath,
      url: expected.releaseIntentUrl,
      latestPath: 'release-intent.json',
      latestUrl: expected.latestReleaseIntentUrl
    }
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const intent = {
    schemaVersion: 1,
    type: 'press-release-intent',
    repository: policy.repository,
    version,
    tag: `v${version}`,
    source: expected.releaseIntentUrl,
    latestSource: expected.latestReleaseIntentUrl,
    systemRelease: {
      path: expected.systemReleasePath,
      source: expected.systemReleaseUrl,
      digest: sha256(manifestText)
    },
    pressSystem: {
      asset,
      runtime,
      upgradeFrom: manifest.upgradeFrom
    }
  };
  artifactPaths.add(expected.systemReleasePath);
  artifactPaths.add(expected.releaseIntentPath);
  artifactPaths.add(expected.assetPath);
  return {
    version,
    tagExists: true,
    sourceManifest: candidateManifest(version, range),
    manifest,
    manifestText,
    intent,
    intentText: `${JSON.stringify(intent, null, 2)}\n`,
    actualAssetSize: assetBuffer.length,
    actualAssetDigest: sha256(assetBuffer)
  };
}

function setPublishedUpgrade(release, range) {
  const next = upgradeFrom(range);
  release.sourceManifest.upgradeFrom = clone(next);
  release.manifest.upgradeFrom = clone(next);
  release.intent.pressSystem.upgradeFrom = clone(next);
  release.manifestText = `${JSON.stringify(release.manifest, null, 2)}\n`;
  release.intent.systemRelease.digest = sha256(release.manifestText);
  release.intentText = `${JSON.stringify(release.intent, null, 2)}\n`;
}

function githubReleaseFor(release) {
  return {
    draft: false,
    prerelease: false,
    assets: [{
      name: release.manifest.asset.name,
      size: release.manifest.asset.size,
      digest: release.manifest.asset.digest
    }]
  };
}

function baselineFixture() {
  const policy = clone(policySource);
  const artifactPaths = new Set();
  const publishedReleases = [
    makePublishedRelease('3.4.64', '>=3.4.63 <3.4.64', policy, artifactPaths),
    makePublishedRelease('3.4.108', '>=3.4.107 <3.4.108', policy, artifactPaths),
    makePublishedRelease('3.4.109', '>=3.4.108 <3.4.109', policy, artifactPaths),
    makePublishedRelease('3.4.132', '>=3.4.109 <3.4.132', policy, artifactPaths),
    makePublishedRelease('3.4.133', '>=3.4.132 <3.4.133', policy, artifactPaths)
  ];
  const latestRelease = publishedReleases[publishedReleases.length - 1];
  artifactPaths.add('system-release.json');
  artifactPaths.add('release-intent.json');
  return {
    policy,
    artifactPaths,
    publishedReleases,
    gitTags: new Set(publishedReleases.map((release) => `v${release.version}`)),
    githubReleases: new Map(publishedReleases.map((release) => [
      `v${release.version}`,
      githubReleaseFor(release)
    ])),
    latestReleaseIntentText: latestRelease.intentText,
    latestSystemReleaseText: latestRelease.manifestText,
    validationMode: 'audit',
    candidate: candidateManifest('3.4.133', '>=3.4.132 <3.4.133')
  };
}

function enableDirectRecovery(fixture, version = '3.4.134') {
  fixture.policy.candidateGate.mode = 'direct';
  fixture.policy.legacyExceptions[0].status = 'recovered';
  fixture.policy.legacyExceptions[0].recoveredByVersion = version;
}

test('current v3.4.133 baseline is explicit recovery debt, not a healthy multi-hop graph', () => {
  const result = analyzeReleaseGraph(baselineFixture());

  assert.deepEqual(result.failures, []);
  assert.equal(result.mode, 'recovery-required');
  assert.deepEqual(result.directMissing, ['3.4.64', '3.4.108', '3.4.109']);
});

test('release graph range checks stay aligned with the runtime Press version contract', async () => {
  const runtime = await import('../assets/js/press-version.js');
  const cases = [
    ['3.4.64', '>=3.4.64 <3.4.108'],
    ['3.4.107', '>=3.4.107 <3.4.108'],
    ['3.4.108', '>=3.4.107 <3.4.108'],
    ['3.4.133', '>=3.4.64 <3.4.134'],
    ['3.5.0', '>=3.4.64 <3.5.0 || =4.0.0']
  ];

  cases.forEach(([version, range]) => {
    assert.equal(satisfiesSemverRange(version, range), runtime.satisfiesSemverRange(version, range));
  });
});

test('known v3.4.108 missing predecessor must remain explicitly registered', () => {
  const fixture = baselineFixture();
  fixture.policy.legacyExceptions = [];
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /target v3\.4\.108 has no published source admitted by upgradeFrom/u);
});

test('published audit rejects an unregistered source that cannot reach latest', () => {
  const fixture = baselineFixture();
  setPublishedUpgrade(fixture.publishedReleases[3], '=3.4.108');
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /published source v3\.4\.109 cannot reach published latest v3\.4\.133/u);
});

test('legacy exception becomes stale when its source can reach published latest', () => {
  const fixture = baselineFixture();
  setPublishedUpgrade(fixture.publishedReleases[1], '>=3.4.64 <3.4.108');
  fixture.policy.legacyExceptions[0].targetRanges = ['>=3.4.64 <3.4.108'];
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /legacy exception v3\.4\.108-missing-predecessor is stale/u);
});

test('legacy exception must name a missing source that the target actually admits', () => {
  const fixture = baselineFixture();
  fixture.policy.legacyExceptions[0].missingSources = ['3.4.106'];
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /missing source v3\.4\.106 is not admitted by v3\.4\.108/u);
});

test('recovery-required mode blocks every candidate newer than the exact baseline', () => {
  const fixture = baselineFixture();
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.133 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(
    result.failures.join('\n'),
    /candidate v3\.4\.134 is blocked while candidateGate\.mode is recovery-required/u
  );
});

test('policy cannot switch to direct mode without a newer recovery candidate', () => {
  const fixture = baselineFixture();
  fixture.policy.candidateGate.mode = 'direct';
  const result = analyzeReleaseGraph(fixture);

  assert.match(
    result.failures.join('\n'),
    /candidateGate\.mode cannot switch to direct without a newer recovery candidate/u
  );
});

test('candidate cannot point only at a predecessor that was never published', () => {
  const fixture = baselineFixture();
  fixture.candidate = candidateManifest('3.4.135', '>=3.4.134 <3.4.135');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);
  const failures = result.failures.join('\n');

  assert.match(failures, /target v3\.4\.135 has no published source admitted by upgradeFrom/u);
  assert.match(failures, /candidate v3\.4\.135 is blocked while candidateGate\.mode is recovery-required/u);
});

test('direct mode rejects multi-hop-only compatibility for the latest-only updater', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.133 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /lacks latest-only direct upgrade edges from: v3\.4\.64/u);
  assert.ok(result.directMissing.includes('3.4.108'));
  assert.ok(result.directMissing.includes('3.4.132'));
});

test('direct mode accepts a recovery candidate that admits every supported published source', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.directMissing, []);
});

test('auto mode audits the baseline and validates a newer worktree as a candidate', () => {
  const baseline = baselineFixture();
  baseline.validationMode = 'auto';
  baseline.candidateArchive = candidateArchive(baseline.candidate);
  const auditResult = analyzeReleaseGraph(baseline);

  assert.deepEqual(auditResult.failures, []);
  assert.equal(auditResult.validationMode, 'audit');

  const recovery = baselineFixture();
  enableDirectRecovery(recovery);
  recovery.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  recovery.candidateArchive = candidateArchive(recovery.candidate);
  recovery.validationMode = 'auto';
  const candidateResult = analyzeReleaseGraph(recovery);

  assert.deepEqual(candidateResult.failures, []);
  assert.equal(candidateResult.validationMode, 'candidate');
});

test('direct recovery must close the active debt state in the same candidate policy', () => {
  const fixture = baselineFixture();
  fixture.policy.candidateGate.mode = 'direct';
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /must be marked recovered with recoveredByVersion v3\.4\.134/u);
});

test('recovered historical break remains auditable after the recovery release is published', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  const recoveryRelease = makePublishedRelease(
    '3.4.134',
    '>=3.4.64 <3.4.134',
    fixture.policy,
    fixture.artifactPaths
  );
  fixture.publishedReleases.push(recoveryRelease);
  fixture.gitTags.add('v3.4.134');
  fixture.githubReleases.set('v3.4.134', githubReleaseFor(recoveryRelease));
  fixture.latestReleaseIntentText = recoveryRelease.intentText;
  fixture.latestSystemReleaseText = recoveryRelease.manifestText;
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  const result = analyzeReleaseGraph(fixture);

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.directMissing, []);
});

test('v3.4.64 recovery candidate cannot retain cleanup-only migration prerequisites', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidate.themeContractUpgrade = {
    requiresInstalledThemeContractVersion: 4,
    message: 'Update themes first.'
  };
  fixture.candidate.contentModelUpgrade = {
    requiresUnifiedIndexTabs: true,
    message: 'Publish the content migration first.'
  };
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);
  const failures = result.failures.join('\n');

  assert.match(failures, /cannot claim direct recovery while requiring installed theme contract v4/u);
  assert.match(failures, /cannot claim direct recovery while requiring a pre-migrated unified content model/u);
});

test('candidate release tag must not already exist', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.gitTags.add('v3.4.134');
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /release candidate tag v3\.4\.134 already exists/u);
});

test('candidate cannot treat an unknown installed Press version as compatible', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidate.upgradeFrom.allowUnknownSource = true;
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /candidate v3\.4\.134 must not allow an unknown source version/u);
});

test('candidate upgrade ranges cannot authorize future versions to install an older ZIP', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest(
    '3.4.134',
    '>=3.4.64 <3.4.134 || >3.4.134'
  );
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /upgradeFrom range must not accept target or future versions/u);
});

test('candidate upgrade ranges cannot silently admit versions below the support floor', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=0.0.0 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /upgradeFrom admits versions outside policy support\.sourceRanges/u);
});

test('published artifact size, digest, and target manifest metadata are verified', () => {
  const fixture = baselineFixture();
  fixture.publishedReleases[2].actualAssetSize += 1;
  fixture.publishedReleases[3].intent.systemRelease.path = 'v3.4.132/wrong.json';
  fixture.artifactPaths.delete('v3.4.133/release-intent.json');
  const result = analyzeReleaseGraph(fixture);
  const failures = result.failures.join('\n');

  assert.match(failures, /v3\.4\.109 asset size does not match the published ZIP/u);
  assert.match(failures, /v3\.4\.132 release intent system-release target metadata is inconsistent/u);
  assert.match(failures, /v3\.4\.133 is missing manifest v3\.4\.133\/release-intent\.json/u);
});

test('published release requires a non-draft GitHub Release and matching asset', () => {
  const fixture = baselineFixture();
  fixture.githubReleases.delete('v3.4.109');
  fixture.githubReleases.get('v3.4.132').draft = true;
  fixture.githubReleases.get('v3.4.133').assets[0].digest = `sha256:${'0'.repeat(64)}`;
  const result = analyzeReleaseGraph(fixture);
  const failures = result.failures.join('\n');

  assert.match(failures, /v3\.4\.109 is missing a matching GitHub Release object/u);
  assert.match(failures, /v3\.4\.132 GitHub Release must be published and non-prerelease/u);
  assert.match(failures, /v3\.4\.133 GitHub Release asset size or digest does not match/u);
});

test('latest convenience manifests must match the highest immutable release', () => {
  const fixture = baselineFixture();
  fixture.latestSystemReleaseText = fixture.publishedReleases[3].manifestText;
  fixture.artifactPaths.delete('release-intent.json');
  const result = analyzeReleaseGraph(fixture);
  const failures = result.failures.join('\n');

  assert.match(failures, /latest system-release\.json does not match immutable v3\.4\.133/u);
  assert.match(failures, /missing latest release-intent\.json/u);
});

test('published baseline compatibility metadata must match assets/press-system.json', () => {
  const fixture = baselineFixture();
  fixture.candidate.upgradeFrom = upgradeFrom('>=3.4.64 <3.4.133');
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /candidate v3\.4\.133 does not match the published release compatibility metadata/u);
});

test('candidate mode verifies the built ZIP root and embedded Press manifest', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.candidateArchive.entries.push('outside-root.txt');
  fixture.candidateArchive.embeddedManifest.upgradeFrom = upgradeFrom('>=3.4.133 <3.4.134');
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);
  const failures = result.failures.join('\n');

  assert.match(failures, /archive must contain exactly the press-system-v3\.4\.134\/ root/u);
  assert.match(failures, /archive Press system manifest does not match the worktree candidate/u);
});
