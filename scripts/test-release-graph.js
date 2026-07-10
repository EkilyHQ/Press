const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const {
  analyzeReleaseGraph,
  compareSemver,
  expectedTargetMetadata,
  loadPublishedReleaseRegistry,
  satisfiesSemverRange,
  sha256
} = require('./release-graph.js');

const recoveryDebtPolicySource = {
  schemaVersion: 1,
  type: 'press-release-graph-policy',
  repository: 'EkilyHQ/Press',
  support: {
    floor: '3.4.64',
    sourceRanges: ['>=3.4.64'],
    updateStrategy: 'latest-only'
  },
  candidateGate: {
    mode: 'recovery-required',
    baselineVersion: '3.4.133',
    reason: 'Historical fixture: v3.4.133 is not directly reachable from every supported source.',
    removalCondition:
      'The production policy may change after a direct recovery transition; this fixture must remain historical.'
  },
  legacyExceptions: [
    {
      id: 'v3.4.108-missing-predecessor',
      from: '3.4.64',
      to: '3.4.108',
      status: 'recovery-required',
      unpublishedRange: '>3.4.64 <3.4.108',
      targetRanges: ['>=3.4.107 <3.4.108'],
      missingSources: ['3.4.107'],
      reason: 'Historical fixture: v3.4.108 requires unpublished v3.4.107.',
      removalCondition: 'Retain the immutable break while direct recovery behavior is tested separately.'
    }
  ],
  artifactLayout: {
    systemRelease: 'v{version}/system-release.json',
    releaseIntent: 'v{version}/release-intent.json',
    asset: 'v{version}/press-system-v{version}.zip',
    rawRoot: 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts'
  }
};

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
  const manifest = {
    schemaVersion: 1,
    type: 'press-system',
    version,
    tag: `v${version}`,
    upgradeFrom: upgradeFrom(range)
  };
  if (compareSemver(version, '3.4.134') >= 0) manifest.securityUpdate = false;
  return manifest;
}

function candidateArchive(candidate) {
  const version = candidate.version;
  const root = `press-system-v${version}/`;
  return {
    name: `press-system-v${version}.zip`,
    size: 100,
    digest: `sha256:${'a'.repeat(64)}`,
    entries: [root, `${root}index.html`, `${root}assets/press-system.json`],
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
    ...(compareSemver(version, '3.4.134') >= 0 ? { securityUpdate: false } : {}),
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
      ...(compareSemver(version, '3.4.134') >= 0 ? { securityUpdate: false } : {}),
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
    immutable: true,
    assets: [
      {
        name: release.manifest.asset.name,
        size: release.manifest.asset.size,
        digest: release.manifest.asset.digest
      }
    ]
  };
}

function baselineFixture() {
  const policy = clone(recoveryDebtPolicySource);
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
    githubReleases: new Map(publishedReleases.map((release) => [`v${release.version}`, githubReleaseFor(release)])),
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

function publishedRecoveryFixture() {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  const recoveryRelease = makePublishedRelease('3.4.134', '>=3.4.64 <3.4.134', fixture.policy, fixture.artifactPaths);
  fixture.publishedReleases.push(recoveryRelease);
  fixture.gitTags.add('v3.4.134');
  fixture.githubReleases.set('v3.4.134', githubReleaseFor(recoveryRelease));
  fixture.latestReleaseIntentText = recoveryRelease.intentText;
  fixture.latestSystemReleaseText = recoveryRelease.manifestText;
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  return { fixture, recoveryRelease };
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

test('direct mode can extend the support floor with a separately covered published source', () => {
  const { fixture } = publishedRecoveryFixture();
  fixture.policy.support.floor = '3.4.63';
  fixture.policy.support.sourceRanges = ['>=3.4.63'];
  const floorRelease = makePublishedRelease('3.4.63', '>=3.4.62 <3.4.63', fixture.policy, fixture.artifactPaths);
  fixture.publishedReleases.unshift(floorRelease);
  fixture.gitTags.add('v3.4.63');
  fixture.githubReleases.set('v3.4.63', githubReleaseFor(floorRelease));
  fixture.candidate = candidateManifest('3.4.137', '>=3.4.63 <3.4.137');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';

  const result = analyzeReleaseGraph(fixture);

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.directMissing, []);
});

test('support-floor extension rejects a candidate that still excludes the new floor', () => {
  const { fixture } = publishedRecoveryFixture();
  fixture.policy.support.floor = '3.4.63';
  fixture.policy.support.sourceRanges = ['>=3.4.63'];
  const floorRelease = makePublishedRelease('3.4.63', '>=3.4.62 <3.4.63', fixture.policy, fixture.artifactPaths);
  fixture.publishedReleases.unshift(floorRelease);
  fixture.gitTags.add('v3.4.63');
  fixture.githubReleases.set('v3.4.63', githubReleaseFor(floorRelease));
  fixture.candidate = candidateManifest('3.4.137', '>=3.4.64 <3.4.137');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';

  const result = analyzeReleaseGraph(fixture);

  assert.ok(result.directMissing.includes('3.4.63'));
  assert.match(
    result.failures.join('\n'),
    /upgradeFrom must cover the complete declared support domain below the candidate/u
  );
});

test('direct mode requires continuous support-domain coverage, not an enumeration of published tags', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '=3.4.64 || =3.4.108 || =3.4.109 || =3.4.132 || =3.4.133');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.deepEqual(result.directMissing, []);
  assert.match(
    result.failures.join('\n'),
    /upgradeFrom must cover the complete declared support domain below the candidate/u
  );
});

test('v3.4.134 and newer candidates require an explicit securityUpdate boolean', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  delete fixture.candidate.securityUpdate;
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);
  const failures = result.failures.join('\n');

  assert.match(failures, /candidate v3\.4\.134 securityUpdate must be an explicit boolean/u);
  assert.match(failures, /archive Press system manifest securityUpdate must be an explicit boolean/u);
});

test('securityUpdate marks presentation only and cannot bypass direct recovery coverage', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.133 <3.4.134');
  fixture.candidate.securityUpdate = true;
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /lacks latest-only direct upgrade edges from: v3\.4\.64/u);
  assert.ok(result.directMissing.includes('3.4.132'));
});

test('candidate ZIP securityUpdate must match the worktree source manifest', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.candidateArchive.embeddedManifest.securityUpdate = true;
  fixture.validationMode = 'candidate';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /archive Press system manifest does not match the worktree candidate/u);
});

test('historical releases normalize a missing securityUpdate marker to false', () => {
  const fixture = baselineFixture();
  const result = analyzeReleaseGraph(fixture);

  assert.equal(
    fixture.publishedReleases.every((release) => !('securityUpdate' in release.manifest)),
    true
  );
  assert.equal(
    result.failures.some((failure) => failure.includes('securityUpdate')),
    false
  );
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

test('forced candidate mode rejects a release-surface change without a version bump', () => {
  const fixture = baselineFixture();
  fixture.validationMode = 'candidate';
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /release candidate must be newer than published latest v3\.4\.133/u);
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
  const { fixture } = publishedRecoveryFixture();
  const result = analyzeReleaseGraph(fixture);

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.directMissing, []);
});

test('published source and system-release securityUpdate markers must match', () => {
  const { fixture, recoveryRelease } = publishedRecoveryFixture();
  recoveryRelease.sourceManifest.securityUpdate = true;
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /tagged Press system securityUpdate does not match system-release\.json/u);
});

test('published system-release and release-intent securityUpdate markers must match', () => {
  const { fixture, recoveryRelease } = publishedRecoveryFixture();
  recoveryRelease.intent.pressSystem.securityUpdate = true;
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /release intent securityUpdate does not match system-release\.json/u);
});

test('published v3.4.134 manifests require explicit securityUpdate markers', () => {
  const { fixture, recoveryRelease } = publishedRecoveryFixture();
  delete recoveryRelease.manifest.securityUpdate;
  delete recoveryRelease.intent.pressSystem.securityUpdate;
  const result = analyzeReleaseGraph(fixture);
  const failures = result.failures.join('\n');

  assert.match(failures, /system-release securityUpdate must be an explicit boolean/u);
  assert.match(failures, /release intent pressSystem securityUpdate must be an explicit boolean/u);
});

test('one explicit transient candidate tag can resume candidate validation without becoming latest', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  fixture.gitTags.add('v3.4.134');
  fixture.githubReleases.set('v3.4.134', { draft: true, prerelease: false, immutable: false, assets: [] });

  const blocked = analyzeReleaseGraph(fixture);
  assert.match(blocked.failures.join('\n'), /release candidate tag v3\.4\.134 already exists/u);

  fixture.transientCandidateVersion = '3.4.134';
  const resumed = analyzeReleaseGraph(fixture);
  assert.deepEqual(resumed.failures, []);
  assert.equal(resumed.latestPublishedVersion, '3.4.133');
});

test('transient candidate exception must identify an exact worktree version', () => {
  const fixture = baselineFixture();
  fixture.transientCandidateVersion = 'not-a-version';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /transientCandidateVersion must be an exact semantic version/u);
});

test('transient candidate exception cannot hide a tag without a GitHub Release owner', () => {
  const fixture = baselineFixture();
  enableDirectRecovery(fixture);
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134');
  fixture.candidateArchive = candidateArchive(fixture.candidate);
  fixture.validationMode = 'candidate';
  fixture.gitTags.add('v3.4.134');
  fixture.transientCandidateVersion = '3.4.134';
  const result = analyzeReleaseGraph(fixture);

  assert.match(result.failures.join('\n'), /must have one non-prerelease GitHub Release object/u);
});

test('registry loader keeps staged candidate bytes out of the published graph and rejects partial finalization', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'press-release-graph-'));
  const run = (args) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  const writeJson = (relativePath, value) => {
    const absolutePath = path.join(cwd, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`);
  };
  run(['init', '-q']);
  run(['config', 'user.name', 'Release Graph Test']);
  run(['config', 'user.email', 'release-graph@example.test']);
  writeJson('assets/press-system.json', candidateManifest('3.4.133', '>=3.4.132 <3.4.133'));
  writeJson('v3.4.133/system-release.json', { version: '3.4.133', tag: 'v3.4.133' });
  writeJson('v3.4.133/release-intent.json', { version: '3.4.133', tag: 'v3.4.133' });
  writeJson('system-release.json', { version: '3.4.133', tag: 'v3.4.133' });
  writeJson('release-intent.json', { version: '3.4.133', tag: 'v3.4.133' });
  fs.writeFileSync(path.join(cwd, 'v3.4.133/press-system-v3.4.133.zip'), 'published');
  run(['add', '.']);
  run(['commit', '-qm', 'published baseline']);
  run(['tag', 'v3.4.133']);

  writeJson('assets/press-system.json', candidateManifest('3.4.134', '>=3.4.64 <3.4.134'));
  writeJson('v3.4.134/release-candidate.json', { tag: 'v3.4.134' });
  fs.mkdirSync(path.join(cwd, 'v3.4.134'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'v3.4.134/press-system-v3.4.134.zip'), 'staged');
  run(['add', '.']);
  run(['commit', '-qm', 'staged candidate']);
  run(['tag', 'v3.4.134']);

  const policy = {
    support: { floor: '3.4.133' },
    artifactLayout: recoveryDebtPolicySource.artifactLayout
  };
  const registry = loadPublishedReleaseRegistry({
    policy,
    artifactRef: 'HEAD',
    transientCandidateVersion: '3.4.134',
    cwd
  });
  assert.deepEqual(
    registry.publishedReleases.map((release) => release.version),
    ['3.4.133']
  );
  assert.equal(registry.gitTags.has('v3.4.134'), false);
  assert.equal(
    registry.latestSystemReleaseText,
    `${JSON.stringify({ version: '3.4.133', tag: 'v3.4.133' }, null, 2)}\n`
  );

  writeJson('v3.4.134/system-release.json', { version: '3.4.134', tag: 'v3.4.134' });
  run(['add', '.']);
  run(['commit', '-qm', 'partial finalization']);
  assert.throws(
    () =>
      loadPublishedReleaseRegistry({
        policy,
        artifactRef: 'HEAD',
        transientCandidateVersion: '3.4.134',
        cwd
      }),
    /partial immutable manifest tuple/u
  );
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
  fixture.candidate = candidateManifest('3.4.134', '>=3.4.64 <3.4.134 || >3.4.134');
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
  assert.match(failures, /v3\.4\.132 GitHub Release must be published, non-prerelease, and immutable/u);
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

  assert.match(
    result.failures.join('\n'),
    /candidate v3\.4\.133 does not match the published release compatibility metadata/u
  );
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
