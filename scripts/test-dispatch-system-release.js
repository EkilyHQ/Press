const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildPayload,
  dispatch,
  installationTokenForTargets,
  normalizeTargets
} = require('./dispatch-system-release.js');
const {
  RELEASE_EVENT_TYPE,
  getReleaseDispatchTargets
} = require('./release-targets.js');

function withEnv(values, callback) {
  const previous = {};
  Object.keys(values).forEach((key) => {
    previous[key] = process.env[key];
    process.env[key] = values[key];
  });
  try {
    return callback();
  } finally {
    Object.keys(values).forEach((key) => {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
}

test('normalizeTargets uses release target registry defaults', () => {
  assert.deepEqual(normalizeTargets(''), getReleaseDispatchTargets());
});

test('normalizeTargets accepts overrides but rejects invalid repositories', () => {
  const targets = normalizeTargets(JSON.stringify([
    { repository: 'EkilyHQ/Custom', event_type: RELEASE_EVENT_TYPE, label: 'Custom' }
  ]));
  assert.deepEqual(targets, [
    { repository: 'EkilyHQ/Custom', eventType: RELEASE_EVENT_TYPE, label: 'Custom' }
  ]);
  assert.throws(
    () => normalizeTargets(JSON.stringify([{ repository: 'not-a-repository' }])),
    /invalid dispatch repository/u
  );
  assert.deepEqual(normalizeTargets(JSON.stringify([
    { repository: 'EkilyHQ/YAP', eventType: RELEASE_EVENT_TYPE },
    { repository: 'EkilyHQ/YAP', eventType: 'other-event' }
  ])), [
    { repository: 'EkilyHQ/YAP', eventType: RELEASE_EVENT_TYPE, label: 'EkilyHQ/YAP' },
    { repository: 'EkilyHQ/YAP', eventType: 'other-event', label: 'EkilyHQ/YAP' }
  ]);
  assert.throws(
    () => normalizeTargets(JSON.stringify([
      { repository: 'EkilyHQ/YAP' },
      { repository: 'EkilyHQ/YAP' }
    ])),
    /duplicate dispatch target/u
  );
});

test('buildPayload includes release artifact and compatibility metadata', () => {
  const system = require('../assets/press-system.json');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'press-dispatch-test-'));
  const intentPath = path.join(tmpDir, 'release-intent.json');
  fs.writeFileSync(intentPath, JSON.stringify({
    schemaVersion: 1,
    type: 'press-release-intent',
    version: system.version,
    tag: system.tag,
    source: `https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/${system.tag}/release-intent.json`,
    latestSource: 'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/release-intent.json',
    targets: [{ key: 'yap' }]
  }));
  const payload = withEnv({
    NEXT_TAG: system.tag,
    ASSET_NAME: `press-system-${system.tag}.zip`,
    ASSET_SIZE: '1234',
    ASSET_SHA256: 'abc123',
    GITHUB_REPOSITORY: 'EkilyHQ/Press',
    PRESS_RELEASE_INTENT_JSON: intentPath
  }, () => buildPayload({
    html_url: `https://github.com/EkilyHQ/Press/releases/tag/${system.tag}`
  }));

  assert.equal(payload.press_repository, 'EkilyHQ/Press');
  assert.equal(payload.tag, system.tag);
  assert.equal(payload.version, system.version);
  assert.equal(payload.asset_name, `press-system-${system.tag}.zip`);
  assert.equal(payload.asset_size, 1234);
  assert.equal(payload.asset_sha256, 'abc123');
  assert.deepEqual(payload.upgrade_from, system.upgradeFrom);
  assert.deepEqual(payload.content_model_upgrade, system.contentModelUpgrade || {});
  assert.equal(payload.release_intent.type, 'press-release-intent');
  assert.equal(payload.release_intent.source, `https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/${system.tag}/release-intent.json`);
  assert.equal(payload.release_intent.target_count, 1);
});

test('installationTokenForTargets rejects mixed installation owners before network calls', async () => {
  await assert.rejects(
    () => installationTokenForTargets('jwt', [
      { repository: 'EkilyHQ/YAP' },
      { repository: 'OtherOrg/Press-Theme-Arcus' }
    ]),
    /one GitHub App installation owner/u
  );
});

test('installationTokenForTargets requests each repository once for multi-event overrides', async () => {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (String(url).endsWith('/app/installations')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return [{ id: 123, account: { login: 'EkilyHQ' } }];
        },
        async text() {
          return '';
        }
      };
    }
    return {
      ok: true,
      status: 201,
      async json() {
        return { token: 'installation-token' };
      },
      async text() {
        return '';
      }
    };
  };
  try {
    const token = await installationTokenForTargets('jwt', [
      { repository: 'EkilyHQ/YAP' },
      { repository: 'EkilyHQ/YAP' },
      { repository: 'EkilyHQ/Press-Theme-Arcus' }
    ]);
    assert.equal(token, 'installation-token');
  } finally {
    global.fetch = previousFetch;
  }

  const tokenRequest = calls.find((call) => String(call.url).includes('/access_tokens'));
  assert.deepEqual(JSON.parse(tokenRequest.options.body).repositories, [
    'YAP',
    'Press-Theme-Arcus'
  ]);
});

test('dispatch posts repository_dispatch payloads', async () => {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 204,
      async json() {
        return {};
      },
      async text() {
        return '';
      }
    };
  };
  try {
    await dispatch('token-123', {
      repository: 'EkilyHQ/YAP',
      eventType: RELEASE_EVENT_TYPE
    }, {
      tag: 'v3.4.59'
    });
  } finally {
    global.fetch = previousFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.github.com/repos/EkilyHQ/YAP/dispatches');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-123');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    event_type: RELEASE_EVENT_TYPE,
    client_payload: {
      tag: 'v3.4.59'
    }
  });
});
