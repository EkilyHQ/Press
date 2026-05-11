#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');

const API_ROOT = process.env.GITHUB_API_URL || 'https://api.github.com';
const API_VERSION = '2022-11-28';
const DEFAULT_TARGETS = [
  { repository: 'EkilyHQ/YAP', eventType: 'press-system-release', label: 'YAP starter runtime' },
  { repository: 'EkilyHQ/Press-Theme-Starter', eventType: 'press-system-release', label: 'theme starter version' },
  { repository: 'EkilyHQ/Press-Theme-Arcus', eventType: 'press-system-release', label: 'Arcus demo site' },
  { repository: 'EkilyHQ/Press-Theme-Cartograph', eventType: 'press-system-release', label: 'Cartograph demo site' },
  { repository: 'EkilyHQ/Press-Theme-Glasswing', eventType: 'press-system-release', label: 'Glasswing demo site' },
  { repository: 'EkilyHQ/Press-Theme-Solstice', eventType: 'press-system-release', label: 'Solstice demo site' }
];

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iat: now - 60,
    exp: now + 540,
    iss: appId
  }));
  const body = `${header}.${payload}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(body)
    .sign(privateKey);
  return `${body}.${base64url(signature)}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${path} failed with ${response.status}: ${text.slice(0, 500)}`);
  }
  if (response.status === 204) return null;
  return await response.json();
}

function normalizeTargets(input) {
  const raw = String(input || '').trim();
  const targets = raw ? JSON.parse(raw) : DEFAULT_TARGETS;
  if (!Array.isArray(targets) || !targets.length) {
    throw new Error('release dispatch targets must be a non-empty JSON array');
  }
  return targets.map((target) => {
    const repository = String(target.repository || '').trim();
    const eventType = String(target.eventType || target.event_type || 'press-system-release').trim();
    const label = String(target.label || repository).trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
      throw new Error(`invalid dispatch repository: ${repository}`);
    }
    if (!eventType || eventType.length > 100) {
      throw new Error(`invalid dispatch event type for ${repository}`);
    }
    return { repository, eventType, label };
  });
}

function readRelease() {
  const releasePath = env('PRESS_RELEASE_JSON', 'dist/release-published.json');
  if (!fs.existsSync(releasePath)) return {};
  return JSON.parse(fs.readFileSync(releasePath, 'utf8'));
}

function buildPayload(release) {
  const tag = env('NEXT_TAG');
  const assetName = env('ASSET_NAME');
  const assetSize = Number(env('ASSET_SIZE', '0'));
  const assetSha256 = env('ASSET_SHA256');
  if (!tag || !assetName || !assetSha256) {
    throw new Error('NEXT_TAG, ASSET_NAME, and ASSET_SHA256 are required for release dispatch');
  }
  return {
    press_repository: env('GITHUB_REPOSITORY', 'EkilyHQ/Press'),
    tag,
    asset_name: assetName,
    asset_size: Number.isFinite(assetSize) ? assetSize : 0,
    asset_sha256: assetSha256,
    release_url: release.html_url || env('RELEASE_URL')
  };
}

async function installationTokenForTargets(jwt, targets) {
  const owners = new Set(targets.map((target) => target.repository.split('/')[0]));
  if (owners.size !== 1) {
    throw new Error('release dispatch targets must belong to one GitHub App installation owner');
  }
  const owner = Array.from(owners)[0];
  const installations = await request('/app/installations', {
    headers: { Authorization: `Bearer ${jwt}` }
  });
  const installation = installations.find((item) => {
    const login = item && item.account && item.account.login;
    return String(login || '').toLowerCase() === owner.toLowerCase();
  });
  if (!installation || !installation.id) {
    throw new Error(`GitHub App is not installed for ${owner}`);
  }
  const repositories = targets.map((target) => target.repository.split('/')[1]);
  const token = await request(`/app/installations/${installation.id}/access_tokens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repositories,
      permissions: {
        contents: 'write',
        metadata: 'read'
      }
    })
  });
  if (!token || !token.token) {
    throw new Error('GitHub App installation token response did not include a token');
  }
  return token.token;
}

async function dispatch(token, target, clientPayload) {
  await request(`/repos/${target.repository}/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: target.eventType,
      client_payload: clientPayload
    })
  });
}

async function main() {
  const appId = env('EKILY_RELEASE_APP_ID');
  const privateKey = env('EKILY_RELEASE_PRIVATE_KEY');
  const targets = normalizeTargets(env('RELEASE_DISPATCH_TARGETS'));
  if (!appId || !privateKey) {
    console.log('::warning title=Release dispatch skipped::EKILY_RELEASE_APP_ID or EKILY_RELEASE_PRIVATE_KEY is not configured.');
    return;
  }

  const release = readRelease();
  const clientPayload = buildPayload(release);
  const jwt = makeJwt(appId, privateKey);
  const token = await installationTokenForTargets(jwt, targets);
  const failures = [];

  for (const target of targets) {
    try {
      await dispatch(token, target, clientPayload);
      console.log(`Dispatched ${target.eventType} for ${clientPayload.tag} to ${target.repository} (${target.label}).`);
    } catch (error) {
      failures.push(`${target.repository}: ${error.message}`);
      console.log(`::warning title=Release dispatch failed::${target.repository}: ${error.message}`);
    }
  }

  if (failures.length) {
    console.log(`::warning title=Release dispatch incomplete::${failures.length} target(s) failed after ${clientPayload.tag} was published.`);
  }
}

main().catch((error) => {
  console.log(`::warning title=Release dispatch skipped::${error.message}`);
});
