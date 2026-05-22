import {
  createConnectPublishCommit,
  ensureConnectPublishGrant as authorizeConnectPublishGrant
} from './transports/connect-transport.js?v=press-system-v3.4.38';

export async function ensurePublishGrant({
  connect,
  repo,
  getCachedGrant,
  setCachedGrant,
  windowRef = window,
  documentRef = document,
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

export async function publishCommit({
  transport,
  repo,
  headline,
  files,
  contentRoot,
  getCachedGrant,
  setCachedGrant,
  windowRef = window,
  documentRef = document,
  translate = (key) => key,
  onStatus
} = {}) {
  const owner = repo && repo.owner ? String(repo.owner) : '';
  const name = repo && repo.name ? String(repo.name) : '';
  const branch = repo && repo.branch ? String(repo.branch) : 'main';
  if (!owner || !name) {
    throw new Error('GitHub repository information is missing in site.yaml.');
  }

  if (transport && transport.type === 'connect') {
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
    if (typeof onStatus === 'function') onStatus(translate('editor.composer.github.modal.connectPublishing'));
    return createConnectPublishCommit({
      connect: transport.connect,
      repo: { owner, name, branch },
      headline,
      files,
      grant,
      contentRoot,
      translate
    });
  }

  const { createFineGrainedTokenCommit } = await import('./transports/github-pat-transport.js?v=press-system-v3.4.38');
  return createFineGrainedTokenCommit(transport && transport.token, {
    owner,
    name,
    branch,
    headline,
    files,
    onStatus
  });
}
