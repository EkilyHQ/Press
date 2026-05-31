import assert from 'node:assert/strict';

import { createGitHubSiteRepositoryProvider } from '../assets/js/provider-adapters.js';
import { publishCommit } from '../assets/js/publish/commit-service.js';
import {
  createConnectPublishCommit,
  requestConnectPublishGrant
} from '../assets/js/publish/transports/connect-transport.js';
import {
  buildGithubFileChanges,
  createFineGrainedTokenCommit,
  githubGraphqlRequest
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

function installAmbientGlobal(name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
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

{
  const requests = [];
  const restore = installAmbientGlobal('fetch', async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return okJson({ data: { viewer: { login: 'deemoe404' } } });
  });
  try {
    const result = await githubGraphqlRequest('pat-token', 'query Test { viewer { login } }');
    assert.deepEqual(result, { viewer: { login: 'deemoe404' } });
  } finally {
    restore();
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.github.com/graphql');
}

{
  const requests = [];
  const provider = createGitHubSiteRepositoryProvider({
    apiBaseUrl: 'https://api.git.example.test'
  });
  const result = await githubGraphqlRequest(
    'pat-token',
    'query Test { viewer { login } }',
    {},
    async (url, options) => {
      requests.push({ url, headers: options.headers, body: JSON.parse(options.body) });
      return okJson({ data: { viewer: { login: 'example' } } });
    },
    provider
  );
  assert.deepEqual(result, { viewer: { login: 'example' } });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.git.example.test/graphql');
  assert.equal(requests[0].headers.Authorization, 'Bearer pat-token');
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
  const requests = [];
  const restores = [
    installAmbientGlobal('fetch', async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body) });
      return okJson({ ok: true, id: 'ambient-published' });
    }),
    installAmbientTrap('window', []),
    installAmbientTrap('document', [])
  ];
  try {
    const result = await createConnectPublishCommit({
      connect: { baseUrl: 'https://connect.example' },
      repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
      headline: 'Sync draft',
      files: [{ path: 'wwwroot/post/main.md', content: utf8Fixture }],
      contentRoot: 'wwwroot',
      grant: { token: 'grant-token' }
    });
    assert.deepEqual(result, { ok: true, id: 'ambient-published' });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://connect.example/api/press/publish');
}

{
  const listeners = {};
  const popup = { closed: false, location: { href: '' } };
  const links = [];
  const fakeWindow = {
    location: { origin: 'https://site.example' },
    open(url, name, features) {
      assert.equal(url, '');
      assert.equal(name, 'pressConnectPublish');
      assert.equal(features, 'popup,width=520,height=720');
      return popup;
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    removeEventListener(type) {
      delete listeners[type];
    },
    setInterval() {
      return 1;
    },
    clearInterval() {},
    setTimeout() {
      return 2;
    },
    clearTimeout() {}
  };
  const fakeDocument = {
    body: {
      appendChild(link) {
        links.push(link);
      }
    },
    createElement(tagName) {
      assert.equal(tagName, 'a');
      return {
        style: {},
        click() {
          this.clicked = true;
        },
        remove() {
          this.removed = true;
        }
      };
    }
  };
  const restores = [
    installAmbientGlobal('window', fakeWindow),
    installAmbientGlobal('document', fakeDocument)
  ];
  try {
    const grantPromise = requestConnectPublishGrant({
      connect: { baseUrl: 'https://connect.example' },
      repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
      messageType: 'press:test-grant'
    });
    assert.equal(links.length, 1);
    assert.equal(links[0].target, 'pressConnectPublish');
    assert.equal(links[0].referrerPolicy, 'unsafe-url');
    assert.equal(links[0].clicked, true);
    assert.equal(links[0].removed, true);
    assert.equal(new URL(links[0].href).searchParams.get('origin'), 'https://site.example');
    listeners.message({
      origin: 'https://connect.example',
      data: {
        type: 'press:test-grant',
        ok: true,
        grant: { token: 'grant-token' }
      }
    });
    const grant = await grantPromise;
    assert.equal(grant.token, 'grant-token');
    assert.equal(grant.baseUrl, 'https://connect.example');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
}

{
  const ambientCalls = [];
  const restores = ['fetch', 'window', 'document', 'btoa'].map((name) => installAmbientTrap(name, ambientCalls));
  const requests = [];
  try {
    const result = await createFineGrainedTokenCommit('pat-token', {
      owner: 'EkilyHQ',
      name: 'Press',
      branch: 'main',
      headline: 'Sync draft',
      files: [{ path: 'wwwroot/post/main.md', content: utf8Fixture }],
      fetchImpl: createGithubFetchRecorder(requests)
    });
    assert.deepEqual(result, {
      ok: true,
      provider: 'github',
      transport: 'pat',
      branchName: 'main',
      expectedHeadOid: 'abc123',
      commit: { oid: 'def456' }
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
  const requests = [];
  const provider = createGitHubSiteRepositoryProvider({
    apiBaseUrl: 'https://api.git.example.test'
  });
  const result = await createFineGrainedTokenCommit('pat-token', {
    owner: 'EkilyHQ',
    name: 'Press',
    branch: 'refs/heads/feature/provider',
    headline: 'Sync draft',
    files: [{ path: 'wwwroot/post/main.md', content: utf8Fixture }],
    fetchImpl: createGithubFetchRecorder(requests),
    siteRepositoryProvider: provider
  });
  assert.equal(result.branchName, 'feature/provider');
  assert.equal(result.commit.oid, 'def456');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://api.git.example.test/graphql');
  assert.equal(requests[0].body.variables.ref, 'refs/heads/feature/provider');
  assert.equal(requests[1].body.variables.input.branch.branchName, 'feature/provider');
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
  const states = [];
  try {
    const result = await publishCommit({
      transport: { type: 'pat', token: 'pat-token' },
      repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
      headline: 'Sync draft',
      files: [{ path: 'wwwroot/post/main.md', content: utf8Fixture }],
      fetchImpl: createGithubFetchRecorder(patRequests),
      onPublishState: state => states.push(state)
    });
    assert.equal(result.provider, 'github');
    assert.equal(result.transport, 'pat');
    assert.equal(result.commit.oid, 'def456');
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  assert.equal(patRequests.length, 2);
  assert.equal(patRequests[1].body.variables.input.fileChanges.additions[0].contents, expectedBase64);
  assert.deepEqual(states, ['committing']);
  assert.deepEqual(ambientCalls, [], 'publish commit service should pass injected fetch into the PAT transport');
}

{
  const ambientCalls = [];
  const restores = ['fetch', 'window', 'document'].map((name) => installAmbientTrap(name, ambientCalls));
  const requests = [];
  const states = [];
  try {
    const result = await publishCommit({
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
        return Promise.resolve(okJson({ ok: true, id: 'published', commit: { oid: 'connect-commit' } }));
      },
      onPublishState: state => states.push(state)
    });
    assert.deepEqual(result, {
      ok: true,
      provider: 'connect',
      transport: 'connect',
      id: 'published',
      commit: { oid: 'connect-commit' }
    });
  } finally {
    restores.reverse().forEach((restore) => restore());
  }
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://connect.example/api/press/publish');
  assert.deepEqual(states, ['authorizing', 'committing']);
  assert.deepEqual(ambientCalls, [], 'publish commit service should pass injected fetch into the Connect transport');
}
