#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RECEIPT_TYPE = 'press-system-release-candidate';
const LEGACY_RECEIPT_CUTOFF = '3.4.133';
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SHA_PATTERN = /^[0-9a-f]{40}$/u;

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function flattenReleasePages(value) {
  if (!Array.isArray(value)) throw new Error('GitHub Releases response must be an array');
  return value.length > 0 && value.every(Array.isArray) ? value.flat() : value;
}

function normalizeSourceManifest(value) {
  const source = value && typeof value === 'object' ? value : {};
  const version = String(source.version || '').trim();
  const tag = String(source.tag || '').trim();
  if (!/^\d+\.\d+\.\d+$/u.test(version) || tag !== `v${version}`) {
    throw new Error('assets/press-system.json must declare matching version and tag');
  }
  return { source, version, tag };
}

function normalizeDigest(value) {
  return String(value || '').trim().toLowerCase();
}

function compareVersions(left, right) {
  const leftParts = String(left || '').split('.').map(Number);
  const rightParts = String(right || '').split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] === rightParts[index]) continue;
    return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

function releaseTag(release) {
  return String(release && (release.tag_name || release.tagName) || '').trim();
}

function releaseId(release) {
  const id = Number(release && release.id);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function matchingAssets(release, assetName) {
  return (Array.isArray(release && release.assets) ? release.assets : [])
    .filter((asset) => String(asset && asset.name || '').trim() === assetName);
}

function validateReceipt(receipt, context) {
  const failures = [];
  const asset = receipt && receipt.asset && typeof receipt.asset === 'object'
    ? receipt.asset
    : {};
  if (!receipt || typeof receipt !== 'object') return ['candidate receipt must be a JSON object'];
  if (receipt.schemaVersion !== 1 || receipt.type !== RECEIPT_TYPE) {
    failures.push(`candidate receipt must use ${RECEIPT_TYPE} schema version 1`);
  }
  if (receipt.repository !== context.repository
    || receipt.version !== context.version
    || receipt.tag !== context.tag) {
    failures.push('candidate receipt repository, version, and tag must match the worktree candidate');
  }
  if (!SHA_PATTERN.test(String(receipt.sourceCommit || ''))
    || receipt.sourceCommit !== context.expectedSourceCommit) {
    failures.push('candidate receipt sourceCommit must match the release transaction commit');
  }
  if (!Number.isInteger(receipt.releaseId) || receipt.releaseId <= 0) {
    failures.push('candidate receipt releaseId must be a positive integer');
  }
  if (asset.name !== context.assetName
    || asset.path !== context.assetPath
    || Number(asset.size || 0) <= 0
    || !SHA256_PATTERN.test(normalizeDigest(asset.digest))) {
    failures.push('candidate receipt asset identity, size, digest, and path are invalid');
  }
  if (!context.candidateArchive) {
    failures.push('candidate receipt exists without its staged ZIP');
  } else if (Number(asset.size) !== context.candidateArchive.size
    || normalizeDigest(asset.digest) !== context.candidateArchive.digest) {
    failures.push('candidate receipt does not match the staged ZIP bytes');
  }
  return failures;
}

export function validateReleaseAgainstReceipt(release, receipt, options = {}) {
  const failures = [];
  const expectedState = String(options.expectedState || '').trim();
  const id = releaseId(release);
  const tag = releaseTag(release);
  if (!['draft', 'published'].includes(expectedState)) {
    failures.push('expected release state must be draft or published');
  }
  if (!id || id !== Number(receipt && receipt.releaseId)) {
    failures.push('GitHub Release id does not match the candidate receipt');
  }
  if (tag !== String(receipt && receipt.tag || '')) {
    failures.push('GitHub Release tag does not match the candidate receipt');
  }
  if (release && release.prerelease === true) {
    failures.push('candidate GitHub Release must not be a prerelease');
  }
  if (expectedState === 'draft' && release && release.draft !== true) {
    failures.push('candidate GitHub Release is no longer a draft');
  }
  if (expectedState === 'published' && release && release.draft === true) {
    failures.push('candidate GitHub Release is not published');
  }
  if (expectedState === 'published' && release && release.immutable !== true) {
    failures.push('published candidate GitHub Release must be immutable');
  }
  const sourceCommit = String(receipt && receipt.sourceCommit || '');
  const tagCommit = String(options.tagCommit || '').trim();
  if (expectedState === 'draft') {
    const target = String(release && release.target_commitish || '').trim();
    if (tagCommit && tagCommit !== sourceCommit) {
      failures.push('candidate tag commit does not match the candidate receipt sourceCommit');
    } else if (!tagCommit && target !== sourceCommit) {
      failures.push('draft GitHub Release target_commitish does not match the candidate receipt sourceCommit');
    }
  } else if (!tagCommit || tagCommit !== sourceCommit) {
    failures.push('published candidate tag commit does not match the candidate receipt sourceCommit');
  }
  const receiptAsset = receipt && receipt.asset && typeof receipt.asset === 'object'
    ? receipt.asset
    : {};
  const assets = matchingAssets(release, receiptAsset.name);
  if (assets.length !== 1) {
    failures.push(`GitHub Release must contain exactly one ${receiptAsset.name || '(unknown asset)'}`);
  } else {
    const asset = assets[0];
    if (Number(asset.size || 0) !== Number(receiptAsset.size || 0)
      || normalizeDigest(asset.digest) !== normalizeDigest(receiptAsset.digest)) {
      failures.push('GitHub Release asset size or digest does not match the candidate receipt');
    }
  }
  if (expectedState === 'published' && !String(release && release.published_at || '').trim()) {
    failures.push('published GitHub Release must include published_at');
  }
  return failures;
}

export function classifySystemReleaseTransaction(input = {}) {
  const failures = [];
  let normalized;
  try {
    normalized = normalizeSourceManifest(input.sourceManifest);
  } catch (error) {
    return { action: 'blocked', failures: [error.message] };
  }
  const { version, tag } = normalized;
  const repository = String(input.repository || '').trim();
  const sourceCommit = String(input.sourceCommit || '').trim();
  const rootTag = String(input.rootManifest && input.rootManifest.tag || '').trim();
  const assetName = `press-system-${tag}.zip`;
  const assetPath = `${tag}/${assetName}`;
  const releases = flattenReleasePages(input.releases || []);
  const matching = releases.filter((release) => releaseTag(release) === tag);
  const receipt = input.candidateReceipt && typeof input.candidateReceipt === 'object'
    ? input.candidateReceipt
    : null;
  const finalizedManifest = input.immutableManifestExists === true;
  const finalizedIntent = input.immutableIntentExists === true;
  const candidateArchive = input.candidateArchive || null;
  const tagCommit = String(input.tagCommit || '').trim();

  if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    failures.push('repository must be an owner/name pair');
  }
  if (!SHA_PATTERN.test(sourceCommit)) failures.push('sourceCommit must be a 40-character Git object id');
  if (!rootTag) failures.push('release-artifacts root system-release.json is missing or invalid');
  if (matching.length > 1) {
    const ids = matching.map((release) => releaseId(release) || '?').join(', ');
    failures.push(`candidate tag ${tag} has duplicate GitHub Release objects: ${ids}; manual recovery is required`);
  }
  if (finalizedManifest !== finalizedIntent) {
    failures.push(`candidate ${tag} has a partial immutable manifest tuple`);
  }
  if ((finalizedManifest || finalizedIntent) && rootTag !== tag) {
    failures.push(`candidate ${tag} immutable manifests exist before atomic latest promotion`);
  }
  if (receipt && !candidateArchive) failures.push(`candidate ${tag} receipt exists without its staged ZIP`);
  if (rootTag !== tag && !receipt && candidateArchive) {
    failures.push(`candidate ${tag} staged ZIP exists without its receipt`);
  }

  const release = matching.length === 1 ? matching[0] : null;
  const canonicalCommit = receipt && String(receipt.sourceCommit || '').trim();
  if (rootTag === tag) {
    if (!receipt && compareVersions(version, LEGACY_RECEIPT_CUTOFF) > 0) {
      failures.push(`finalized release ${tag} is newer than the receipt migration cutoff and must retain release-candidate.json`);
    }
    if (!finalizedManifest || !finalizedIntent) {
      failures.push(`latest pointers expose ${tag} without a complete finalized transaction`);
    }
    if (!release || release.draft === true || release.prerelease === true) {
      failures.push(`latest pointers expose ${tag} without one published non-prerelease GitHub Release`);
    }
    if (!tagCommit) failures.push(`latest release ${tag} is missing its Git tag`);
    if (receipt) {
      failures.push(...validateReceipt(receipt, {
        repository,
        version,
        tag,
        expectedSourceCommit: canonicalCommit,
        assetName,
        assetPath,
        candidateArchive
      }));
    }
    if (release && receipt) {
      failures.push(...validateReleaseAgainstReceipt(release, receipt, {
        expectedState: 'published',
        tagCommit
      }));
    }
    if (failures.length) return { action: 'blocked', failures, tag, version };
    return {
      action: receipt && canonicalCommit === sourceCommit ? 'dispatch' : 'settled',
      failures: [],
      tag,
      version,
      rootTag,
      releaseId: releaseId(release),
      assetName,
      assetPath,
      assetSize: receipt ? Number(receipt.asset.size) : 0,
      assetDigest: receipt ? normalizeDigest(receipt.asset.digest) : '',
      sourceCommit: canonicalCommit || tagCommit
    };
  }

  if (receipt) {
    failures.push(...validateReceipt(receipt, {
      repository,
      version,
      tag,
      expectedSourceCommit: sourceCommit,
      assetName,
      assetPath,
      candidateArchive
    }));
  }
  if (tagCommit && tagCommit !== sourceCommit) {
    failures.push(`candidate tag ${tag} points at ${tagCommit}, not release transaction commit ${sourceCommit}`);
  }
  if (release && release.prerelease === true) failures.push(`candidate ${tag} is a prerelease`);
  if (release && !releaseId(release)) failures.push(`candidate ${tag} GitHub Release id is invalid`);
  if (release && release.draft === true && !tagCommit
    && String(release.target_commitish || '').trim() !== sourceCommit) {
    failures.push(`candidate ${tag} draft targets a different commit`);
  }
  if (release && release.draft !== true && !receipt) {
    failures.push(`published candidate ${tag} has no staged receipt; manual recovery is required`);
  }
  if (receipt && !release) {
    failures.push(`candidate ${tag} is staged without its GitHub Release; manual recovery is required`);
  }
  if (!release && tagCommit) {
    failures.push(`candidate tag ${tag} has no GitHub Release; manual recovery is required`);
  }
  if (release && receipt) {
    failures.push(...validateReleaseAgainstReceipt(release, receipt, {
      expectedState: release.draft === true ? 'draft' : 'published',
      tagCommit
    }));
  }
  if (failures.length) return { action: 'blocked', failures, tag, version };

  let action = 'new';
  if (release && receipt && release.draft === true) action = 'resume-publish';
  else if (release && receipt) action = 'resume-promote';
  else if (release && release.draft === true) action = 'resume-stage';

  return {
    action,
    failures: [],
    tag,
    version,
    rootTag,
    releaseId: releaseId(release),
    assetName,
    assetPath,
    assetSize: receipt ? Number(receipt.asset.size) : 0,
    assetDigest: receipt ? normalizeDigest(receipt.asset.digest) : '',
    sourceCommit
  };
}

export function createCandidateReceipt(input = {}) {
  const normalized = normalizeSourceManifest(input.sourceManifest);
  const repository = String(input.repository || '').trim();
  const sourceCommit = String(input.sourceCommit || '').trim();
  const archive = Buffer.isBuffer(input.archive) ? input.archive : Buffer.from(input.archive || '');
  const assetName = `press-system-${normalized.tag}.zip`;
  const digest = sha256(archive);
  const release = input.release;
  const tagCommit = String(input.tagCommit || '').trim();
  const assets = matchingAssets(release, assetName);
  const failures = [];
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) failures.push('repository must be an owner/name pair');
  if (!SHA_PATTERN.test(sourceCommit)) failures.push('sourceCommit must be a 40-character Git object id');
  if (releaseTag(release) !== normalized.tag || release && release.draft !== true || release && release.prerelease === true) {
    failures.push('candidate receipt requires the matching draft non-prerelease GitHub Release');
  }
  if (tagCommit && tagCommit !== sourceCommit) {
    failures.push('candidate tag commit must equal sourceCommit');
  } else if (!tagCommit && String(release && release.target_commitish || '').trim() !== sourceCommit) {
    failures.push('draft GitHub Release target_commitish must equal sourceCommit');
  }
  if (assets.length !== 1) {
    failures.push(`GitHub Release must contain exactly one ${assetName}`);
  } else if (Number(assets[0].size || 0) !== archive.length
    || normalizeDigest(assets[0].digest) !== digest) {
    failures.push('GitHub Release asset size or digest does not match the built archive');
  }
  if (!archive.length) failures.push('candidate archive must not be empty');
  if (failures.length) throw new Error(failures.join('\n'));
  return {
    schemaVersion: 1,
    type: RECEIPT_TYPE,
    repository,
    version: normalized.version,
    tag: normalized.tag,
    sourceCommit,
    releaseId: releaseId(release),
    stagedAt: String(input.stagedAt || new Date().toISOString()),
    asset: {
      name: assetName,
      path: `${normalized.tag}/${assetName}`,
      size: archive.length,
      digest
    }
  };
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: options.cwd || process.cwd(),
    encoding: options.encoding === null ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function gitPathExists(ref, path, cwd) {
  const result = spawnSync('git', ['cat-file', '-e', `${ref}:${path}`], { cwd, stdio: 'ignore' });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1 || result.status === 128) return false;
  throw new Error(`git cat-file exited ${result.status}`);
}

function readJsonAtRef(ref, path, cwd) {
  if (!gitPathExists(ref, path, cwd)) return null;
  return JSON.parse(git(['show', `${ref}:${path}`], { cwd }));
}

function readTagCommit(tag, cwd) {
  const result = spawnSync('git', ['rev-parse', '--verify', `${tag}^{commit}`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  if (result.error) throw result.error;
  return result.status === 0 ? result.stdout.trim() : '';
}

function readTransactionInput(options) {
  const cwd = options.cwd || process.cwd();
  const sourceManifest = JSON.parse(fs.readFileSync(options.sourceManifestPath, 'utf8'));
  const normalized = normalizeSourceManifest(sourceManifest);
  const assetPath = `${normalized.tag}/press-system-${normalized.tag}.zip`;
  const archive = gitPathExists(options.artifactRef, assetPath, cwd)
    ? git(['show', `${options.artifactRef}:${assetPath}`], { cwd, encoding: null })
    : null;
  return {
    repository: options.repository,
    sourceManifest,
    sourceCommit: options.sourceCommit,
    rootManifest: readJsonAtRef(options.artifactRef, 'system-release.json', cwd),
    candidateReceipt: readJsonAtRef(options.artifactRef, `${normalized.tag}/release-candidate.json`, cwd),
    candidateArchive: archive ? { size: archive.length, digest: sha256(archive) } : null,
    immutableManifestExists: gitPathExists(options.artifactRef, `${normalized.tag}/system-release.json`, cwd),
    immutableIntentExists: gitPathExists(options.artifactRef, `${normalized.tag}/release-intent.json`, cwd),
    tagCommit: readTagCommit(normalized.tag, cwd),
    releases: JSON.parse(fs.readFileSync(options.releasesPath, 'utf8'))
  };
}

function parseArgs(argv) {
  const command = argv[0] || '';
  const options = {
    command,
    artifactRef: 'origin/release-artifacts',
    sourceManifestPath: 'assets/press-system.json',
    sourceCommit: process.env.GITHUB_SHA || '',
    repository: process.env.GITHUB_REPOSITORY || '',
    cwd: process.cwd()
  };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => argv[++index] || '';
    if (arg === '--artifact-ref') options.artifactRef = value();
    else if (arg === '--releases') options.releasesPath = value();
    else if (arg === '--source-manifest') options.sourceManifestPath = value();
    else if (arg === '--source-commit') options.sourceCommit = value();
    else if (arg === '--repository') options.repository = value();
    else if (arg === '--github-output') options.githubOutput = value();
    else if (arg === '--release') options.releasePath = value();
    else if (arg === '--receipt') options.receiptPath = value();
    else if (arg === '--archive') options.archivePath = value();
    else if (arg === '--out') options.outPath = value();
    else if (arg === '--expected-state') options.expectedState = value();
    else if (arg === '--tag-commit') options.tagCommit = value();
    else if (arg === '--staged-at') options.stagedAt = value();
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function writeGitHubOutput(path, result) {
  const lines = [
    `action=${result.action}`,
    `tag=${result.tag || ''}`,
    `version=${result.version || ''}`,
    `root_tag=${result.rootTag || ''}`,
    `release_id=${result.releaseId || ''}`,
    `asset_name=${result.assetName || ''}`,
    `asset_path=${result.assetPath || ''}`,
    `asset_size=${result.assetSize || ''}`,
    `asset_digest=${result.assetDigest || ''}`,
    `source_commit=${result.sourceCommit || ''}`
  ];
  fs.appendFileSync(path, `${lines.join('\n')}\n`, 'utf8');
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.command === 'inspect') {
    if (!options.releasesPath) throw new Error('--releases is required');
    const result = classifySystemReleaseTransaction(readTransactionInput(options));
    if (result.failures.length) throw new Error(result.failures.join('\n'));
    if (options.githubOutput) writeGitHubOutput(options.githubOutput, result);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (options.command === 'create-receipt') {
    if (!options.releasePath || !options.archivePath || !options.outPath) {
      throw new Error('create-receipt requires --release, --archive, and --out');
    }
    const receipt = createCandidateReceipt({
      repository: options.repository,
      sourceManifest: JSON.parse(fs.readFileSync(options.sourceManifestPath, 'utf8')),
      sourceCommit: options.sourceCommit,
      release: JSON.parse(fs.readFileSync(options.releasePath, 'utf8')),
      archive: fs.readFileSync(options.archivePath),
      tagCommit: options.tagCommit,
      stagedAt: options.stagedAt
    });
    fs.writeFileSync(options.outPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    return;
  }
  if (options.command === 'verify-release') {
    if (!options.releasePath || !options.receiptPath || !options.expectedState) {
      throw new Error('verify-release requires --release, --receipt, and --expected-state');
    }
    const failures = validateReleaseAgainstReceipt(
      JSON.parse(fs.readFileSync(options.releasePath, 'utf8')),
      JSON.parse(fs.readFileSync(options.receiptPath, 'utf8')),
      { expectedState: options.expectedState, tagCommit: options.tagCommit }
    );
    if (failures.length) throw new Error(failures.join('\n'));
    return;
  }
  throw new Error('usage: system-release-transaction.mjs inspect|create-receipt|verify-release [options]');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
