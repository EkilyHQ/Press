import {
  createConnectPublishCommit,
  ensureConnectPublishGrant as authorizeConnectPublishGrant
} from './transports/connect-transport.js';

export async function ensurePublishGrant({
  connect,
  repo,
  getCachedGrant,
  setCachedGrant,
  windowRef = null,
  documentRef = null,
  translate = (key) => key
} = {}) {
  return authorizeConnectPublishGrant({
    connect,
    repo,
    getCachedGrant,
    setCachedGrant,
    windowRef,
    documentRef,
    translate
  });
}

function emitPublishState(onPublishState, state) {
  if (typeof onPublishState === 'function') onPublishState(state);
}

function normalizeConnectPublishResult(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const out = {
    ok: source.ok !== false,
    provider: 'connect',
    transport: 'connect'
  };
  if (source.id) out.id = String(source.id);
  if (source.requestId) out.requestId = String(source.requestId);
  const commit = source.commit && typeof source.commit === 'object' ? source.commit : null;
  const oid = (commit && (commit.oid || commit.sha || commit.id)) || source.commitSha || source.commitId;
  if (oid) out.commit = { oid: String(oid) };
  if ((commit && commit.url) || source.commitUrl) {
    out.commit = { ...(out.commit || {}), url: String((commit && commit.url) || source.commitUrl) };
  }
  return out;
}

function normalizePatPublishResult(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    ...source,
    ok: source.ok !== false,
    provider: source.provider || 'github',
    transport: source.transport || 'pat'
  };
}

export async function publishCommit({
  transport,
  repo,
  headline,
  files,
  contentRoot,
  getCachedGrant,
  setCachedGrant,
  windowRef = null,
  documentRef = null,
  fetchImpl = null,
  translate = (key) => key,
  onStatus,
  onPublishState
} = {}) {
  const owner = repo && repo.owner ? String(repo.owner) : '';
  const name = repo && repo.name ? String(repo.name) : '';
  const branch = repo && repo.branch ? String(repo.branch) : 'main';
  if (!owner || !name) {
    throw new Error('GitHub repository information is missing in site.yaml.');
  }

  if (transport && transport.type === 'connect') {
    emitPublishState(onPublishState, 'authorizing');
    if (typeof onStatus === 'function') onStatus(translate('editor.composer.github.modal.connectAuthorizing'));
    const grant = await ensurePublishGrant({
      connect: transport.connect,
      repo: { owner, name, branch },
      getCachedGrant,
      setCachedGrant,
      windowRef,
      documentRef,
      translate
    });
    emitPublishState(onPublishState, 'committing');
    if (typeof onStatus === 'function') onStatus(translate('editor.composer.github.modal.connectPublishing'));
    const payload = await createConnectPublishCommit({
      connect: transport.connect,
      repo: { owner, name, branch },
      headline,
      files,
      grant,
      contentRoot,
      fetchImpl,
      translate
    });
    return normalizeConnectPublishResult(payload);
  }

  emitPublishState(onPublishState, 'committing');
  const { createFineGrainedTokenCommit } = await import('./transports/github-pat-transport.js');
  const payload = await createFineGrainedTokenCommit(transport && transport.token, {
    owner,
    name,
    branch,
    headline,
    files,
    fetchImpl,
    onStatus
  });
  return normalizePatPublishResult(payload);
}
