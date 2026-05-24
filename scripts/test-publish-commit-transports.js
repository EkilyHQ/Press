import assert from 'node:assert/strict';

import { publishCommit } from '../assets/js/publish/commit-service.js';
import {
  createConnectPublishCommit
} from '../assets/js/publish/transports/connect-transport.js';
import {
  buildGithubFileChanges,
  createFineGrainedTokenCommit
} from '../assets/js/publish/transports/github-pat-transport.js';

function installAmbientTrap(name, calls) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    get() {
      calls.push(name);
      throw new Error(`ambient ${name} should not be read`);
    }
  });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
}

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload)
  };
}

function createGithubFetchRecorder(requests) {
  return async (url, options) => {
    requests.push({
      url,
      body: JSON.parse(options.body)
    });
    if (requests.length === 1) {
      return okJson({
        data: {
          repository: {
            ref: {
              target: {
                oid: 'abc123'
              }
            }
          }
        }
      });
    }
    return okJson({
      data: {
        createCommitOnBranch: {
          commit: {
            oid: 'def456'
          }
        }
      }
    });
  };
}

const utf8Fixture = 'Hello 世界';
const expectedBase64 = Buffer.from(utf8Fixture, 'utf8').toString('base64');

{
  const changes = buildGithubFileChanges([
    { path: 'wwwroot/post/main.md', content: utf8Fixture }
  ]);
  assert.equal(changes.additions[0].contents, expectedBase64);
}

{
  const ambientCalls = [];
  const restores = ['fetch', 'window', 'document', 'btoa'].map((name) => installAmbientTrap(name, ambientCalls));
  const requests = [];
  try {
    await createFineGrainedTokenCommit('pat-token', {
      owner: 'EkilyHQ',
      name: 'Press',
      branch: 'main',
      headline: 'Sync draft',
      files: [{ path: 'wwwroot/post/main.md', content: utf8Fixture }],
      fetchImpl: createGithubFetchRecorder(requests)
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://api.github.com/graphql');
  assert.equal(requests[1].body.variables.input.fileChanges.additions[0].contents, expectedBase64);
  assert.deepEqual(ambientCalls, [], 'PAT commit transport should use injected fetch and local base64 encoding only');
}

{
  const ambientCalls = [];
  const restores = ['fetch', 'window', 'document'].map((name) => installAmbientTrap(name, ambientCalls));
  const requests = [];
  try {
    const result = await createConnectPublishCommit({
      connect: { baseUrl: 'https://connect.example' },
      repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
      headline: 'Sync draft',
      files: [{ path: 'wwwroot/post/main.md', content: utf8Fixture }],
      contentRoot: 'wwwroot',
      grant: { token: 'grant-token' },
      fetchImpl(url, options) {
        requests.push({ url, options, body: JSON.parse(options.body) });
        return Promise.resolve(okJson({ ok: true, id: 'published' }));
      }
    });
    assert.deepEqual(result, { ok: true, id: 'published' });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://connect.example/api/press/publish');
  assert.equal(requests[0].options.referrerPolicy, 'unsafe-url');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer grant-token');
  assert.equal(requests[0].body.contentRoot, 'wwwroot');
  assert.deepEqual(ambientCalls, [], 'Connect publish POST should use injected fetch only');
}

{
  const ambientCalls = [];
  const restores = ['fetch', 'window', 'document', 'btoa'].map((name) => installAmbientTrap(name, ambientCalls));
  const patRequests = [];
  try {
    await publishCommit({
      transport: { type: 'pat', token: 'pat-token' },
      repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
      headline: 'Sync draft',
      files: [{ path: 'wwwroot/post/main.md', content: utf8Fixture }],
      fetchImpl: createGithubFetchRecorder(patRequests)
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  assert.equal(patRequests.length, 2);
  assert.equal(patRequests[1].body.variables.input.fileChanges.additions[0].contents, expectedBase64);
  assert.deepEqual(ambientCalls, [], 'publish commit service should pass injected fetch into the PAT transport');
}

{
  const ambientCalls = [];
  const restores = ['fetch', 'window', 'document'].map((name) => installAmbientTrap(name, ambientCalls));
  const requests = [];
  try {
    await publishCommit({
      transport: { type: 'connect', connect: { baseUrl: 'https://connect.example' } },
      repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
      headline: 'Sync draft',
      files: [{ path: 'wwwroot/post/main.md', content: utf8Fixture }],
      contentRoot: 'wwwroot',
      getCachedGrant: () => ({
        token: 'grant-token',
        baseUrl: 'https://connect.example',
        owner: 'EkilyHQ',
        name: 'Press',
        branch: 'main'
      }),
      fetchImpl(url, options) {
        requests.push({ url, options });
        return Promise.resolve(okJson({ ok: true, id: 'published' }));
      }
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://connect.example/api/press/publish');
  assert.deepEqual(ambientCalls, [], 'publish commit service should pass injected fetch into the Connect transport');
}
