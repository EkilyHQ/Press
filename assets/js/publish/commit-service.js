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

function safeString(value) {
  return value == null ? '' : String(value);
}

function normalizeConnectPublishJob(value) {
  const source = value && typeof value === 'object' ? value : {};
  const id = safeString(source.id || source.jobId).trim();
  if (!id) return null;
  const out = { id };
  if (source.requestId) out.requestId = safeString(source.requestId);
  if (source.state) out.state = safeString(source.state);
  if (source.statusUrl) out.statusUrl = safeString(source.statusUrl);
  for (const key of ['createdAt', 'updatedAt', 'finishedAt', 'durationMs', 'fileCount', 'additionCount', 'deletionCount']) {
    if (source[key] != null) out[key] = source[key];
  }
  const commit = source.commit && typeof source.commit === 'object' ? source.commit : null;
  const commitOid = safeString(commit && (commit.oid || commit.sha || commit.id) || source.commitOid).trim();
  if (commitOid) {
    out.commit = { oid: commitOid };
    const commitUrl = safeString(commit && commit.url || source.commitUrl).trim();
    if (commitUrl) out.commit.url = commitUrl;
  }
  const error = source.error && typeof source.error === 'object' ? source.error : null;
  const errorCode = safeString(error && error.code || source.errorCode).trim();
  if (errorCode) {
    out.error = {
      code: errorCode,
      message: safeString(error && error.message || source.errorMessage)
    };
    if ((error && error.upstreamStatus != null) || source.upstreamStatus != null) {
      out.error.upstreamStatus = error && error.upstreamStatus != null ? error.upstreamStatus : source.upstreamStatus;
    }
    if ((error && error.upstreamCode) || source.upstreamCode) {
      out.error.upstreamCode = safeString(error && error.upstreamCode || source.upstreamCode);
    }
  }
  return out;
}

function normalizeConnectPublishResult(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const job = normalizeConnectPublishJob(source.job || source.publishJob);
  const out = {
    ok: source.ok !== false,
    provider: 'connect',
    transport: 'connect'
  };
  if (source.id) out.id = String(source.id);
  else if (job) out.id = job.id;
  if (source.requestId) out.requestId = String(source.requestId);
  else if (job && job.requestId) out.requestId = job.requestId;
  if (job) out.job = job;
  const commit = source.commit && typeof source.commit === 'object' ? source.commit : null;
  const oid = (commit && (commit.oid || commit.sha || commit.id)) || source.commitSha || source.commitId || (job && job.commit && job.commit.oid);
  if (oid) out.commit = { oid: String(oid) };
  if ((commit && commit.url) || source.commitUrl || (job && job.commit && job.commit.url)) {
    out.commit = { ...(out.commit || {}), url: String((commit && commit.url) || source.commitUrl || job.commit.url) };
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
