import assert from 'node:assert/strict';

import {
  createPublishReceipt,
  createPublishReceiptStore,
  PUBLISH_STATES,
  transitionPublishReceipt
} from '../assets/js/publish/publish-receipt.js';

function createMemoryStorage() {
  const data = new Map();
  return {
    data,
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    }
  };
}

function createClock() {
  const values = [
    '2026-05-31T00:00:00.000Z',
    '2026-05-31T00:00:01.000Z',
    '2026-05-31T00:00:02.000Z',
    '2026-05-31T00:00:03.000Z'
  ];
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

{
  const now = createClock();
  const receipt = createPublishReceipt({
    repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
    transport: {
      type: 'connect',
      token: 'pat-token-must-not-leak',
      connect: { baseUrl: 'https://connect.example/path?grant=secret' }
    },
    contentRoot: '/wwwroot/',
    headline: 'chore: sync drafts via Press',
    files: [
      {
        path: '/wwwroot/post/main.md',
        label: 'Main post',
        content: 'private draft body',
        base64: 'cHJpdmF0ZS1kcmFmdA==',
        kind: 'post'
      },
      {
        path: 'wwwroot/media/photo.jpg',
        label: 'Photo',
        binary: true,
        mime: 'image/jpeg',
        base64: 'private-image-bytes'
      },
      { path: 'wwwroot/post/old.md', deleted: true, content: 'removed body' }
    ],
    warnings: [
      {
        providerId: 'themes',
        code: 'optional-theme-cache',
        message: 'Theme cache skipped?access_token=secret-a&client_secret=secret-b#refresh_token=secret-c',
        path: '/assets/themes/arcus/theme.json'
      }
    ],
    now,
    runId: 'receipt-test'
  });

  assert.equal(receipt.runId, 'receipt-test');
  assert.equal(receipt.state, PUBLISH_STATES.PREPARING);
  assert.equal(receipt.contentRoot, 'wwwroot');
  assert.deepEqual(receipt.repository, { owner: 'EkilyHQ', name: 'Press', branch: 'main' });
  assert.deepEqual(receipt.transport, { type: 'connect', connectBaseUrl: 'https://connect.example' });
  assert.equal(receipt.fileCount, 3);
  assert.deepEqual(receipt.warnings, [
    {
      providerId: 'themes',
      code: 'optional-theme-cache',
      message: 'Theme cache skipped?access_token=[redacted]&client_secret=[redacted]#refresh_token=[redacted]',
      path: 'assets/themes/arcus/theme.json'
    }
  ]);
  assert.deepEqual(
    receipt.files.map(file => ({
      path: file.path,
      deleted: file.deleted,
      binary: !!file.binary,
      hasContent: Object.prototype.hasOwnProperty.call(file, 'content'),
      hasBase64: Object.prototype.hasOwnProperty.call(file, 'base64')
    })),
    [
      { path: 'wwwroot/post/main.md', deleted: false, binary: false, hasContent: false, hasBase64: false },
      { path: 'wwwroot/media/photo.jpg', deleted: false, binary: true, hasContent: false, hasBase64: false },
      { path: 'wwwroot/post/old.md', deleted: true, binary: false, hasContent: false, hasBase64: false }
    ]
  );
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes('private draft body'), false);
  assert.equal(serialized.includes('private-image-bytes'), false);
  assert.equal(serialized.includes('pat-token-must-not-leak'), false);
  assert.equal(serialized.includes('grant=secret'), false);
  assert.equal(serialized.includes('secret-a'), false);
  assert.equal(serialized.includes('secret-b'), false);
  assert.equal(serialized.includes('secret-c'), false);

  const committed = transitionPublishReceipt(receipt, PUBLISH_STATES.COMMITTED, {
    publishResult: {
      provider: 'connect',
      transport: 'connect',
      id: 'request-id-not-a-commit',
      commit: { oid: 'abc123', url: 'https://github.example/commit/abc123' },
      job: {
        id: 'pubjob_123',
        requestId: 'connect-request',
        state: 'committed',
        statusUrl: 'https://connect.example/api/press/publish?job=pubjob_123',
        fileCount: 3,
        additionCount: 2,
        deletionCount: 1,
        commit: { oid: 'abc123', url: 'https://github.example/commit/abc123' }
      }
    }
  }, { now });
  assert.equal(committed.commit.oid, 'abc123');
  assert.equal(committed.publish.id, 'request-id-not-a-commit');
  assert.equal(committed.publish.job.id, 'pubjob_123');
  assert.equal(committed.publish.job.state, 'committed');
  assert.equal(committed.publish.job.statusUrl, 'https://connect.example/api/press/publish?job=pubjob_123');
  assert.equal(committed.publish.job.commit.oid, 'abc123');
  assert.equal(committed.finishedAt, null);

  const observed = transitionPublishReceipt(committed, PUBLISH_STATES.OBSERVED, {
    propagation: { canceled: false, timedOut: false }
  }, { now });
  assert.equal(observed.finishedAt, '2026-05-31T00:00:02.000Z');
  assert.deepEqual(observed.propagation, { canceled: false, timedOut: false, observed: true });
  assert.deepEqual(observed.history.map(entry => entry.state), [
    PUBLISH_STATES.PREPARING,
    PUBLISH_STATES.COMMITTED,
    PUBLISH_STATES.OBSERVED
  ]);
}

{
  const receipt = createPublishReceipt({
    repo: { owner: 'EkilyHQ', name: 'Press' },
    transport: { type: 'connect', connect: { baseUrl: 'https://connect.example' } },
    files: [{ path: 'wwwroot/post/main.md', content: 'body' }],
    now: '2026-05-31T00:00:00.000Z',
    runId: 'request-only'
  });
  const committed = transitionPublishReceipt(receipt, PUBLISH_STATES.COMMITTED, {
    publishResult: { provider: 'connect', transport: 'connect', id: 'request-123' }
  }, {
    now: '2026-05-31T00:00:01.000Z'
  });
  assert.equal(committed.commit, null, 'Connect request ids should not be treated as Git commit ids');
  assert.equal(committed.publish.id, 'request-123');
}

{
  const receipt = createPublishReceipt({
    repo: { owner: 'EkilyHQ', name: 'Press' },
    transport: { type: 'connect', connect: { baseUrl: 'connect.local/path?grant=secret#hash' } },
    files: [{ path: 'wwwroot/post/main.md', content: 'body' }],
    now: '2026-05-31T00:00:00.000Z',
    runId: 'bad-connect-url'
  });
  assert.equal(receipt.transport.connectBaseUrl, 'connect.local/path');
  assert.equal(JSON.stringify(receipt).includes('grant=secret'), false);
}

{
  const storage = createMemoryStorage();
  const store = createPublishReceiptStore({ storage, limit: 1 });
  const first = createPublishReceipt({
    repo: { owner: 'EkilyHQ', name: 'Press' },
    transport: { type: 'pat', token: 'pat-token' },
    files: [{ path: 'wwwroot/a.md', content: 'a' }],
    runId: 'first',
    now: '2026-05-31T00:00:00.000Z'
  });
  const second = createPublishReceipt({
    repo: { owner: 'EkilyHQ', name: 'Press' },
    transport: { type: 'pat', token: 'pat-token' },
    files: [{ path: 'wwwroot/b.md', content: 'b' }],
    runId: 'second',
    now: '2026-05-31T00:00:01.000Z'
  });
  assert.equal(store.save(first), true);
  assert.equal(store.save(second), true);
  assert.equal(store.loadLatest().runId, 'second');
  assert.deepEqual(store.list().map(item => item.runId), ['second']);
  assert.equal(JSON.stringify(store.list()).includes('pat-token'), false);
}

console.log('ok - publish receipt');
