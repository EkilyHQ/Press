import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  classifySystemReleaseTransaction,
  createCandidateReceipt,
  validateReleaseAgainstReceipt
} from './system-release-transaction.mjs';

const SOURCE_SHA = '1'.repeat(40);
const NEXT_SHA = '2'.repeat(40);
const ARCHIVE = Buffer.from('candidate archive bytes');
const DIGEST = `sha256:${crypto.createHash('sha256').update(ARCHIVE).digest('hex')}`;
const TAG = 'v3.4.134';
const ASSET_NAME = `press-system-${TAG}.zip`;

function sourceManifest() {
  return { schemaVersion: 1, type: 'press-system', version: '3.4.134', tag: TAG };
}

function release({ draft = true, id = 134, prerelease = false, sourceCommit = SOURCE_SHA } = {}) {
  return {
    id,
    tag_name: TAG,
    target_commitish: sourceCommit,
    draft,
    prerelease,
    immutable: !draft,
    published_at: draft ? null : '2026-07-10T00:00:00Z',
    assets: [{ name: ASSET_NAME, size: ARCHIVE.length, digest: DIGEST }]
  };
}

function receipt({ sourceCommit = SOURCE_SHA, id = 134 } = {}) {
  return {
    schemaVersion: 1,
    type: 'press-system-release-candidate',
    repository: 'EkilyHQ/Press',
    version: '3.4.134',
    tag: TAG,
    sourceCommit,
    releaseId: id,
    stagedAt: '2026-07-10T00:00:00Z',
    asset: {
      name: ASSET_NAME,
      path: `${TAG}/${ASSET_NAME}`,
      size: ARCHIVE.length,
      digest: DIGEST
    }
  };
}

function transaction(overrides = {}) {
  return {
    repository: 'EkilyHQ/Press',
    sourceManifest: sourceManifest(),
    sourceCommit: SOURCE_SHA,
    rootManifest: { version: '3.4.133', tag: 'v3.4.133' },
    candidateReceipt: null,
    candidateArchive: null,
    immutableManifestExists: false,
    immutableIntentExists: false,
    tagCommit: '',
    releases: [],
    ...overrides
  };
}

test('fresh source commit starts a new append-only release transaction', () => {
  const result = classifySystemReleaseTransaction(transaction());
  assert.deepEqual(result.failures, []);
  assert.equal(result.action, 'new');
});

test('an existing same-commit draft is resumed without deleting it', () => {
  const result = classifySystemReleaseTransaction(transaction({ releases: [release()] }));
  assert.deepEqual(result.failures, []);
  assert.equal(result.action, 'resume-stage');
  assert.equal(result.releaseId, 134);
});

test('staged draft resumes publication while root latest remains on the baseline', () => {
  const result = classifySystemReleaseTransaction(transaction({
    candidateReceipt: receipt(),
    candidateArchive: { size: ARCHIVE.length, digest: DIGEST },
    releases: [release()]
  }));
  assert.deepEqual(result.failures, []);
  assert.equal(result.action, 'resume-publish');
  assert.equal(result.rootTag, 'v3.4.133');
});

test('published staged candidate resumes atomic latest promotion', () => {
  const result = classifySystemReleaseTransaction(transaction({
    candidateReceipt: receipt(),
    candidateArchive: { size: ARCHIVE.length, digest: DIGEST },
    tagCommit: SOURCE_SHA,
    releases: [release({ draft: false })]
  }));
  assert.deepEqual(result.failures, []);
  assert.equal(result.action, 'resume-promote');
});

test('promoted same-commit transaction re-dispatches idempotently', () => {
  const result = classifySystemReleaseTransaction(transaction({
    rootManifest: { version: '3.4.134', tag: TAG },
    candidateReceipt: receipt(),
    candidateArchive: { size: ARCHIVE.length, digest: DIGEST },
    immutableManifestExists: true,
    immutableIntentExists: true,
    tagCommit: SOURCE_SHA,
    releases: [release({ draft: false })]
  }));
  assert.deepEqual(result.failures, []);
  assert.equal(result.action, 'dispatch');
});

test('a later main commit sees the promoted release as settled, not as a retry', () => {
  const result = classifySystemReleaseTransaction(transaction({
    sourceCommit: NEXT_SHA,
    rootManifest: { version: '3.4.134', tag: TAG },
    candidateReceipt: receipt(),
    candidateArchive: { size: ARCHIVE.length, digest: DIGEST },
    immutableManifestExists: true,
    immutableIntentExists: true,
    tagCommit: SOURCE_SHA,
    releases: [release({ draft: false })]
  }));
  assert.deepEqual(result.failures, []);
  assert.equal(result.action, 'settled');
});

test('pre-transaction finalized releases remain valid settled history', () => {
  const result = classifySystemReleaseTransaction(transaction({
    sourceManifest: { schemaVersion: 1, type: 'press-system', version: '3.4.133', tag: 'v3.4.133' },
    rootManifest: { version: '3.4.133', tag: 'v3.4.133' },
    candidateArchive: { size: ARCHIVE.length, digest: DIGEST },
    immutableManifestExists: true,
    immutableIntentExists: true,
    tagCommit: SOURCE_SHA,
    releases: [{
      ...release({ draft: false }),
      tag_name: 'v3.4.133',
      assets: [{ name: 'press-system-v3.4.133.zip', size: ARCHIVE.length, digest: DIGEST }]
    }]
  }));
  assert.deepEqual(result.failures, []);
  assert.equal(result.action, 'settled');
});

test('post-migration finalized releases cannot lose their durable candidate receipt', () => {
  const result = classifySystemReleaseTransaction(transaction({
    rootManifest: { version: '3.4.134', tag: TAG },
    candidateArchive: { size: ARCHIVE.length, digest: DIGEST },
    immutableManifestExists: true,
    immutableIntentExists: true,
    tagCommit: SOURCE_SHA,
    releases: [release({ draft: false })]
  }));
  assert.equal(result.action, 'blocked');
  assert.match(result.failures.join('\n'), /must retain release-candidate\.json/u);
});

test('all duplicate release combinations fail closed with release ids', () => {
  for (const pair of [
    [release({ id: 1 }), release({ id: 2 })],
    [release({ id: 1 }), release({ id: 2, draft: false })],
    [release({ id: 1, draft: false }), release({ id: 2, draft: false })]
  ]) {
    const result = classifySystemReleaseTransaction(transaction({ releases: pair }));
    assert.equal(result.action, 'blocked');
    assert.match(result.failures.join('\n'), /duplicate GitHub Release objects: 1, 2/u);
  }
});

test('partial staging and premature latest exposure fail closed', () => {
  const partial = classifySystemReleaseTransaction(transaction({
    immutableManifestExists: true
  }));
  assert.match(partial.failures.join('\n'), /partial immutable manifest tuple/u);

  const exposed = classifySystemReleaseTransaction(transaction({
    rootManifest: { version: '3.4.134', tag: TAG },
    candidateReceipt: receipt(),
    candidateArchive: { size: ARCHIVE.length, digest: DIGEST },
    tagCommit: SOURCE_SHA,
    releases: [release()]
  }));
  assert.match(exposed.failures.join('\n'), /without one published non-prerelease GitHub Release/u);
});

test('orphan tags, missing receipts, and wrong commits require manual recovery', () => {
  const orphanTag = classifySystemReleaseTransaction(transaction({ tagCommit: SOURCE_SHA }));
  assert.match(orphanTag.failures.join('\n'), /has no GitHub Release/u);

  const publishedWithoutReceipt = classifySystemReleaseTransaction(transaction({
    tagCommit: SOURCE_SHA,
    releases: [release({ draft: false })]
  }));
  assert.match(publishedWithoutReceipt.failures.join('\n'), /has no staged receipt/u);

  const wrongCommit = classifySystemReleaseTransaction(transaction({
    candidateReceipt: receipt(),
    candidateArchive: { size: ARCHIVE.length, digest: DIGEST },
    tagCommit: NEXT_SHA,
    releases: [release()]
  }));
  assert.match(wrongCommit.failures.join('\n'), /not release transaction commit/u);
});

test('candidate receipt binds the draft release, source commit, and archive digest', () => {
  const created = createCandidateReceipt({
    repository: 'EkilyHQ/Press',
    sourceManifest: sourceManifest(),
    sourceCommit: SOURCE_SHA,
    release: release(),
    archive: ARCHIVE,
    stagedAt: '2026-07-10T00:00:00Z'
  });
  assert.equal(created.asset.digest, DIGEST);
  assert.equal(created.releaseId, 134);

  const existingTagReceipt = createCandidateReceipt({
    repository: 'EkilyHQ/Press',
    sourceManifest: sourceManifest(),
    sourceCommit: SOURCE_SHA,
    tagCommit: SOURCE_SHA,
    release: { ...release(), target_commitish: 'main' },
    archive: ARCHIVE
  });
  assert.equal(existingTagReceipt.sourceCommit, SOURCE_SHA);

  assert.throws(() => createCandidateReceipt({
    repository: 'EkilyHQ/Press',
    sourceManifest: sourceManifest(),
    sourceCommit: SOURCE_SHA,
    release: { ...release(), assets: [{ name: ASSET_NAME, size: ARCHIVE.length, digest: `sha256:${'0'.repeat(64)}` }] },
    archive: ARCHIVE
  }), /does not match the built archive/u);
});

test('fresh pre- and post-publication snapshots must match the immutable receipt', () => {
  assert.deepEqual(validateReleaseAgainstReceipt(release(), receipt(), {
    expectedState: 'draft'
  }), []);
  assert.deepEqual(validateReleaseAgainstReceipt(release({ draft: false }), receipt(), {
    expectedState: 'published',
    tagCommit: SOURCE_SHA
  }), []);
  assert.match(validateReleaseAgainstReceipt(release(), receipt(), {
    expectedState: 'published',
    tagCommit: SOURCE_SHA
  }).join('\n'), /is not published/u);
  assert.match(validateReleaseAgainstReceipt({
    ...release({ draft: false }),
    immutable: false
  }, receipt(), {
    expectedState: 'published',
    tagCommit: SOURCE_SHA
  }).join('\n'), /must be immutable/u);
});

test('release automation contains no destructive Release or tag cleanup path', () => {
  const workflow = fs.readFileSync(new URL('../.github/workflows/system-release.yml', import.meta.url), 'utf8');
  const helper = fs.readFileSync(new URL('./system-release-transaction.mjs', import.meta.url), 'utf8');
  for (const source of [workflow, helper]) {
    assert.doesNotMatch(source, /--method\s+DELETE\b/u);
    assert.doesNotMatch(source, /gh\s+release\s+delete\b/u);
    assert.doesNotMatch(source, /git\s+push\s+--delete\b/u);
    assert.doesNotMatch(source, /(?:\s|["']):refs\/tags\//u);
  }
});

test('atomic artifact promotion refuses a moved tag without updating latest pointers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'press-release-promotion-'));
  const remote = path.join(root, 'remote.git');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  const git = (cwd, args) => execFileSync('git', args, { cwd, stdio: 'ignore' });
  git(root, ['init', '-q', '--bare', remote]);
  git(root, ['clone', '-q', remote, first]);
  git(first, ['config', 'user.name', 'Release Transaction Test']);
  git(first, ['config', 'user.email', 'release-transaction@example.test']);
  fs.writeFileSync(path.join(first, 'artifact'), 'baseline');
  git(first, ['add', 'artifact']);
  git(first, ['commit', '-qm', 'baseline']);
  git(first, ['tag', TAG]);
  git(first, ['push', '-q', 'origin', 'HEAD:release-artifacts', `refs/tags/${TAG}:refs/tags/${TAG}`]);
  const expectedTag = execFileSync('git', ['rev-parse', `refs/tags/${TAG}`], { cwd: first, encoding: 'utf8' }).trim();

  fs.writeFileSync(path.join(first, 'artifact'), 'candidate');
  git(first, ['commit', '-qam', 'candidate']);
  git(root, ['clone', '-q', remote, second]);
  git(second, ['config', 'user.name', 'Concurrent Publisher']);
  git(second, ['config', 'user.email', 'concurrent@example.test']);
  git(second, ['fetch', '-q', 'origin', 'release-artifacts']);
  git(second, ['checkout', '-q', '-B', 'race', 'FETCH_HEAD']);
  fs.writeFileSync(path.join(second, 'race'), 'moved tag');
  git(second, ['add', 'race']);
  git(second, ['commit', '-qm', 'move tag']);
  git(second, ['tag', '-f', TAG]);
  git(second, ['push', '-q', '--force', 'origin', `refs/tags/${TAG}:refs/tags/${TAG}`]);

  const branchBefore = execFileSync('git', [`--git-dir=${remote}`, 'rev-parse', 'release-artifacts'], { encoding: 'utf8' }).trim();
  const result = spawnSync('git', [
    'push',
    '--atomic',
    `--force-with-lease=refs/tags/${TAG}:${expectedTag}`,
    'origin',
    'HEAD:release-artifacts',
    `refs/tags/${TAG}:refs/tags/${TAG}`
  ], { cwd: first, stdio: 'ignore' });
  assert.notEqual(result.status, 0);
  const branchAfter = execFileSync('git', [`--git-dir=${remote}`, 'rev-parse', 'release-artifacts'], { encoding: 'utf8' }).trim();
  assert.equal(branchAfter, branchBefore);
  fs.rmSync(root, { recursive: true, force: true });
});
