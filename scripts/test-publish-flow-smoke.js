import assert from 'node:assert/strict';

import { createComposerPublishFlow } from '../assets/js/composer-publish-flow.js';

function okJson(payload) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(payload),
    text: () => Promise.resolve(JSON.stringify(payload))
  };
}

function textResponse(text) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(String(text || '')),
    arrayBuffer: () => Promise.resolve(Buffer.from(String(text || ''), 'utf8').buffer)
  };
}

function notFound() {
  return {
    ok: false,
    status: 404,
    text: () => Promise.resolve('')
  };
}

function createFlowHarness() {
  const calls = [];
  const requests = [];
  const liveFiles = new Map([
    ['post/smoke.md', '# Smoke\n\nUpdated from publish flow.\n'],
    ['wwwroot/post/smoke.md', '# Smoke\n\nUpdated from publish flow.\n']
  ]);
  const files = [
    {
      path: 'wwwroot/post/smoke.md',
      label: 'Smoke post',
      content: '# Smoke\n\nUpdated from publish flow.\n'
    },
    {
      path: 'wwwroot/post/old.md',
      label: 'Removed post',
      deleted: true
    }
  ];

  const fetchImpl = async (url, options = {}) => {
    const target = String(url || '');
    requests.push({ url: target, options });

    if (target === 'https://connect.example/api/press/publish') {
      const body = JSON.parse(String(options.body || '{}'));
      return okJson({ ok: true, id: 'connect-smoke', body });
    }

    if (target === 'https://api.github.com/graphql') {
      const body = JSON.parse(String(options.body || '{}'));
      if (String(body.query || '').includes('createCommitOnBranch')) {
        return okJson({
          data: {
            createCommitOnBranch: {
              commit: { oid: 'publish-smoke-commit' }
            }
          }
        });
      }
      return okJson({
        data: {
          repository: {
            ref: {
              target: { oid: 'publish-smoke-head' }
            }
          }
        }
      });
    }

    const clean = target.split('?')[0].replace(/^\/+/, '');
    if (liveFiles.has(clean)) return textResponse(liveFiles.get(clean));
    return notFound();
  };

  const flow = createComposerPublishFlow({
    windowRef: { location: { origin: 'https://docs.example' } },
    documentRef: {},
    fetchImpl,
    t: (key, values = {}) => values && values.count ? `${key}:${values.count}` : key,
    getActiveSiteRepoConfig: () => ({ owner: 'EkilyHQ', name: 'Press', branch: 'main' }),
    getTrackedPublishContentRoot: () => 'wwwroot',
    gatherCommitPayload: async (options = {}) => {
      calls.push(['gather', options.showSeoStatus === true]);
      return { files: files.map(file => ({ ...file })) };
    },
    applyLocalPostCommitState: committedFiles => calls.push(['postCommit', committedFiles.map(file => file.path)]),
    setTimeoutRef: (handler, delay) => {
      calls.push(['timer', delay]);
      handler();
      return calls.length;
    },
    getCachedConnectPublishGrant: () => ({
      token: 'grant-token',
      baseUrl: 'https://connect.example',
      owner: 'EkilyHQ',
      name: 'Press',
      branch: 'main'
    }),
    setCachedConnectPublishGrant: grant => calls.push(['setGrant', !!grant]),
    clearCachedConnectPublishGrant: () => calls.push(['clearGrant']),
    clearCachedFineGrainedToken: () => calls.push(['clearPat']),
    showSyncOverlay: overlay => calls.push(['overlay:show', overlay.status]),
    hideSyncOverlay: () => calls.push(['overlay:hide']),
    setSyncOverlayStatus: status => calls.push(['status', status]),
    setSyncOverlayMessage: message => calls.push(['message', message]),
    setSyncOverlayCancelHandler: (handler) => calls.push(['cancelHandler', typeof handler === 'function']),
    showToast: (kind, message, options = {}) => calls.push(['toast', kind, message, !!options.action]),
    describeSummaryEntry: entry => entry && entry.label || 'summary',
    switchToPatFallbackAndFocusToken: () => calls.push(['fallback']),
    setGitHubCommitInFlight: value => calls.push(['inFlight', !!value]),
    consoleRef: { error: (...args) => calls.push(['console:error', args.length]) }
  });

  return {
    calls,
    flow,
    requests
  };
}

{
  const harness = createFlowHarness();
  await harness.flow.performConnectGithubCommit({ baseUrl: 'https://connect.example' }, [
    { kind: 'site', label: 'site.yaml' }
  ]);

  const connectPost = harness.requests.find(request => request.url === 'https://connect.example/api/press/publish');
  assert.ok(connectPost, 'Connect smoke should POST to the Connect publish endpoint');
  assert.equal(connectPost.options.referrerPolicy, 'unsafe-url');
  assert.equal(connectPost.options.headers.Authorization, 'Bearer grant-token');
  const connectBody = JSON.parse(connectPost.options.body);
  assert.deepEqual(connectBody.repository, { owner: 'EkilyHQ', name: 'Press', branch: 'main' });
  assert.equal(connectBody.contentRoot, 'wwwroot');
  assert.equal(connectBody.message.headline, 'chore: sync drafts via Press');
  assert.deepEqual(
    connectBody.files.map(file => ({ path: file.path, deleted: !!file.deleted, hasContent: Object.prototype.hasOwnProperty.call(file, 'content') })),
    [
      { path: 'wwwroot/post/smoke.md', deleted: false, hasContent: true },
      { path: 'wwwroot/post/old.md', deleted: true, hasContent: false }
    ],
    'Connect smoke should serialize additions and deletions in one publish payload'
  );
  assert.deepEqual(harness.calls.filter(call => call[0] === 'gather'), [['gather', true]]);
  assert.ok(harness.calls.some(call => call[0] === 'postCommit' && call[1].includes('wwwroot/post/smoke.md')));
  assert.ok(harness.calls.some(call => call[0] === 'status' && String(call[1]).startsWith('Checking Smoke post')));
  assert.ok(harness.calls.some(call => call[0] === 'status' && String(call[1]).startsWith('Checking Removed post')));
  assert.deepEqual(harness.calls.at(-2), ['toast', 'success', 'editor.toasts.commitSuccess:2', false]);
  assert.deepEqual(harness.calls.at(-1), ['inFlight', false]);
}

{
  const harness = createFlowHarness();
  await harness.flow.performDirectGithubCommit('pat-token', [
    { kind: 'site', label: 'site.yaml' }
  ]);

  const graphqlPosts = harness.requests.filter(request => request.url === 'https://api.github.com/graphql');
  assert.equal(graphqlPosts.length, 2, 'PAT smoke should fetch branch state and create one commit');
  assert.equal(graphqlPosts[0].options.headers.Authorization, 'Bearer pat-token');
  const mutationBody = JSON.parse(graphqlPosts[1].options.body);
  const mutationInput = mutationBody.variables.input;
  assert.deepEqual(mutationInput.branch, {
    repositoryNameWithOwner: 'EkilyHQ/Press',
    branchName: 'main'
  });
  assert.equal(mutationInput.message.headline, 'chore: sync drafts via Press');
  assert.equal(mutationInput.expectedHeadOid, 'publish-smoke-head');
  assert.deepEqual(
    mutationInput.fileChanges.additions.map(file => file.path),
    ['wwwroot/post/smoke.md'],
    'PAT smoke should include text additions'
  );
  assert.deepEqual(
    mutationInput.fileChanges.deletions,
    [{ path: 'wwwroot/post/old.md' }],
    'PAT smoke should include deletions'
  );
  assert.equal(
    Buffer.from(mutationInput.fileChanges.additions[0].contents, 'base64').toString('utf8'),
    '# Smoke\n\nUpdated from publish flow.\n'
  );
  assert.ok(harness.calls.some(call => call[0] === 'status' && call[1] === 'Creating commit...'));
  assert.ok(harness.calls.some(call => call[0] === 'status' && call[1] === 'All files confirmed on site.'));
  assert.deepEqual(harness.calls.at(-2), ['toast', 'success', 'editor.toasts.commitSuccess:2', false]);
  assert.deepEqual(harness.calls.at(-1), ['inFlight', false]);
}

console.log('ok - publish flow smoke');
