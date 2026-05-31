import { CONNECT_PUBLISH_MESSAGE_TYPE } from '../settings-store.js';
import { createEventEffects } from '../../editor-effects.js';

function resolveAmbientValue(name) {
  try {
    const scope = typeof globalThis === 'object' ? globalThis : null;
    return scope ? scope[name] : null;
  } catch (_) {
    return null;
  }
}

function resolveAmbientFunction(name) {
  const value = resolveAmbientValue(name);
  const scope = typeof globalThis === 'object' ? globalThis : null;
  return typeof value === 'function' && scope ? value.bind(scope) : null;
}

function resolveFetch(fetchImpl) {
  return typeof fetchImpl === 'function' ? fetchImpl : resolveAmbientFunction('fetch');
}

function resolveSleep(sleepImpl) {
  if (typeof sleepImpl === 'function') return sleepImpl;
  return ms => new Promise(resolve => setTimeout(resolve, ms));
}

function resolveWindow(windowRef) {
  if (windowRef) return windowRef;
  const ambientWindow = resolveAmbientValue('window');
  return ambientWindow && typeof ambientWindow === 'object' ? ambientWindow : null;
}

function resolveDocument(documentRef, windowRef) {
  if (documentRef) return documentRef;
  if (windowRef && windowRef.document) return windowRef.document;
  const ambientDocument = resolveAmbientValue('document');
  return ambientDocument && typeof ambientDocument === 'object' ? ambientDocument : null;
}

export function serializeConnectPublishFile(file) {
  const out = {
    path: String(file && file.path || '').replace(/^\/+/, '')
  };
  if (file && file.kind) out.kind = file.kind;
  if (file && file.deleted) {
    out.deleted = true;
    return out;
  }
  if (file && file.base64) {
    out.base64 = String(file.base64 || '');
    if (file.mime) out.mime = file.mime;
    out.binary = true;
  } else {
    out.content = String(file && file.content || '');
  }
  return out;
}

function resolveConnectPublishJob(payload) {
  return payload && typeof payload === 'object'
    ? payload.job || payload.publishJob || null
    : null;
}

function createConnectPublishJobPendingError({ job, translate, code, name, cause = null }) {
  const error = new Error(translate('editor.composer.github.modal.connectPublishTimedOut'));
  error.name = name || 'ConnectPublishJobPendingError';
  error.status = 202;
  error.response = { ok: true, error: { code }, job };
  error.pendingPublishResult = {
    ok: true,
    provider: 'connect',
    transport: 'connect',
    job
  };
  if (cause) error.cause = cause;
  return error;
}

function resolveConnectPublishStatusTarget(job, endpoint) {
  const jobId = String(job && (job.id || job.jobId) || '').trim();
  const statusUrl = String(job && job.statusUrl || '').trim();
  if (statusUrl) {
    try {
      const target = new URL(statusUrl, endpoint.href);
      if (target.origin === endpoint.origin) return target;
    } catch (_) {}
  }
  const target = new URL(endpoint.href);
  if (jobId) target.searchParams.set('job', jobId);
  return target;
}

export async function createConnectPublishCommit({
  connect,
  repo,
  headline,
  files,
  contentRoot,
  grant,
  fetchImpl = null,
  translate = (key) => key,
  onStatus = null,
  pollIntervalMs = 1500,
  pollTimeoutMs = 120000,
  sleepImpl = null
} = {}) {
  const message = (key, fallback) => {
    const value = typeof translate === 'function' ? translate(key) : '';
    return value && value !== key ? value : fallback;
  };
  const fetchRef = resolveFetch(fetchImpl);
  const sleep = resolveSleep(sleepImpl);
  if (!connect || !connect.baseUrl) {
    throw new Error(message('editor.composer.github.modal.connectMissing', 'Connect publish settings are missing.'));
  }
  if (!grant || !grant.token) {
    throw new Error(message('editor.composer.github.modal.connectAuthorizationFailed', 'Connect publish authorization is missing.'));
  }
  const owner = repo && repo.owner ? String(repo.owner) : '';
  const name = repo && repo.name ? String(repo.name) : '';
  const branch = repo && repo.branch ? String(repo.branch) : 'main';
  const endpoint = new URL('/api/press/publish', connect.baseUrl);
  const body = {
    repository: { owner, name, branch },
    contentRoot: contentRoot || 'wwwroot',
    message: { headline },
    files: (Array.isArray(files) ? files : []).map(serializeConnectPublishFile)
  };
  let response = null;
  let payload = null;
  try {
    response = await fetchRef(endpoint.href, {
      method: 'POST',
      referrerPolicy: 'unsafe-url',
      headers: {
        'Authorization': `Bearer ${grant.token}`,
        'Content-Type': 'application/json',
        'Prefer': 'respond-async'
      },
      body: JSON.stringify(body)
    });
    payload = await response.json().catch(() => null);
  } catch (err) {
    const error = new Error(message('editor.composer.github.modal.connectNetworkError', 'Network error while reaching Connect.'));
    error.cause = err;
    throw error;
  }
  if (!response.ok || !payload || payload.ok === false) {
    const error = new Error(payload && payload.error && payload.error.message
      ? payload.error.message
      : message('editor.composer.github.modal.connectPublishFailed', 'Connect could not publish this commit.'));
    error.status = response.status;
    error.response = payload;
    throw error;
  }
  const job = resolveConnectPublishJob(payload);
  if (response.status === 202 && job) {
    if (typeof onStatus === 'function') {
      onStatus(message('editor.composer.github.modal.connectPublishing', 'Creating commit through Connect...'));
    }
    return pollConnectPublishJob({
      payload,
      job,
      endpoint,
      grant,
      fetchRef,
      translate,
      pollIntervalMs,
      pollTimeoutMs,
      sleep
    });
  }
  return payload;
}

async function pollConnectPublishJob({
  payload,
  job,
  endpoint,
  grant,
  fetchRef,
  translate = (key) => key,
  pollIntervalMs = 1500,
  pollTimeoutMs = 120000,
  sleep = resolveSleep(null)
}) {
  const startedAt = Date.now();
  let latest = payload;
  while (job && typeof job === 'object') {
    const state = String(job.state || '').trim();
    if (state === 'committed') {
      return {
        ok: true,
        provider: 'connect',
        transport: 'connect',
        owner: job.repository && job.repository.owner,
        name: job.repository && job.repository.name,
        branch: job.repository && job.repository.branch,
        commit: job.commit || latest.commit,
        job
      };
    }
    if (state === 'failed') {
      const error = new Error(job.error && job.error.message
        ? job.error.message
        : translate('editor.composer.github.modal.connectPublishFailed'));
      error.status = job.error && job.error.upstreamStatus ? job.error.upstreamStatus : 502;
      error.response = { ok: false, error: job.error, job };
      throw error;
    }
    if (Date.now() - startedAt >= pollTimeoutMs) {
      throw createConnectPublishJobPendingError({
        job,
        translate,
        code: 'publish_job_timeout',
        name: 'ConnectPublishJobTimeoutError'
      });
    }
    await sleep(Math.max(0, Number(pollIntervalMs) || 0));
    const target = resolveConnectPublishStatusTarget(job, endpoint);
    let response = null;
    try {
      response = await fetchRef(target.href, {
        method: 'GET',
        referrerPolicy: 'unsafe-url',
        headers: {
          'Authorization': `Bearer ${grant.token}`
        }
      });
    } catch (err) {
      throw createConnectPublishJobPendingError({
        job,
        translate,
        code: 'publish_job_poll_failed',
        name: 'ConnectPublishJobPollError',
        cause: err
      });
    }
    latest = await response.json().catch(() => null);
    if (!response.ok || !latest || latest.ok === false) {
      const error = new Error(latest && latest.error && latest.error.message
        ? latest.error.message
        : translate('editor.composer.github.modal.connectPublishFailed'));
      error.status = response.status;
      error.response = latest;
      throw error;
    }
    const nextJob = resolveConnectPublishJob(latest);
    if (!nextJob && latest && typeof latest === 'object' && latest.commit) {
      return {
        ...latest,
        ok: true,
        provider: 'connect',
        transport: 'connect',
        job: {
          ...job,
          state: 'committed',
          commit: latest.commit
        }
      };
    }
    job = nextJob;
  }
  const error = new Error(translate('editor.composer.github.modal.connectPublishFailed'));
  error.status = 502;
  error.response = latest;
  throw error;
}

export async function ensureConnectPublishGrant({
  connect,
  repo,
  getCachedGrant,
  setCachedGrant,
  windowRef = null,
  documentRef = null,
  translate = (key) => key,
  messageType = CONNECT_PUBLISH_MESSAGE_TYPE
} = {}) {
  const cached = typeof getCachedGrant === 'function' ? getCachedGrant() : null;
  if (cached
    && cached.baseUrl === connect.baseUrl
    && cached.owner === repo.owner
    && cached.name === repo.name
    && cached.branch === repo.branch) {
    return cached;
  }
  return requestConnectPublishGrant({
    connect,
    repo,
    setCachedGrant,
    windowRef,
    documentRef,
    translate,
    messageType
  });
}

export function requestConnectPublishGrant({
  connect,
  repo,
  setCachedGrant,
  windowRef = null,
  documentRef = null,
  translate = (key) => key,
  messageType = CONNECT_PUBLISH_MESSAGE_TYPE
} = {}) {
  windowRef = resolveWindow(windowRef);
  documentRef = resolveDocument(documentRef, windowRef);
  const eventEffects = createEventEffects({ documentRef, windowRef });
  const startUrl = new URL('/github/press/start', connect.baseUrl);
  startUrl.searchParams.set('origin', windowRef && windowRef.location ? windowRef.location.origin || '' : '');
  startUrl.searchParams.set('owner', repo.owner);
  startUrl.searchParams.set('repo', repo.name);
  startUrl.searchParams.set('branch', repo.branch || 'main');

  const popupName = 'pressConnectPublish';
  const popup = windowRef && typeof windowRef.open === 'function'
    ? windowRef.open('', popupName, 'popup,width=520,height=720')
    : null;
  if (!popup) {
    return Promise.reject(new Error(translate('editor.toasts.popupBlocked')));
  }
  if (documentRef && typeof documentRef.createElement === 'function' && documentRef.body) {
    const link = documentRef.createElement('a');
    link.href = startUrl.href;
    link.target = popupName;
    link.referrerPolicy = 'unsafe-url';
    link.rel = 'opener';
    link.style.display = 'none';
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
  } else {
    try {
      popup.location.href = startUrl.href;
    } catch (_) {}
  }

  const connectOrigin = new URL(connect.baseUrl).origin;
  return new Promise((resolve, reject) => {
    let timer = 0;
    let closeTimer = 0;
    let unbindMessage = null;
    const cleanup = () => {
      if (typeof unbindMessage === 'function') unbindMessage();
      if (timer && windowRef && typeof windowRef.clearTimeout === 'function') windowRef.clearTimeout(timer);
      if (closeTimer && windowRef && typeof windowRef.clearInterval === 'function') windowRef.clearInterval(closeTimer);
    };
    const onMessage = (event) => {
      if (!event || event.origin !== connectOrigin) return;
      const data = event.data && typeof event.data === 'object' ? event.data : null;
      if (!data || data.type !== messageType) return;
      cleanup();
      if (!data.ok || !data.grant || !data.grant.token) {
        reject(new Error(data.error && data.error.message ? data.error.message : translate('editor.composer.github.modal.connectAuthorizationFailed')));
        return;
      }
      const grant = {
        ...data.grant,
        baseUrl: connect.baseUrl,
        owner: repo.owner,
        name: repo.name,
        branch: repo.branch || 'main'
      };
      if (typeof setCachedGrant === 'function') setCachedGrant(grant);
      resolve(grant);
    };
    if (!windowRef || typeof windowRef.addEventListener !== 'function') {
      cleanup();
      reject(new Error(translate('editor.composer.github.modal.connectAuthorizationFailed')));
      return;
    }
    unbindMessage = eventEffects.onWindow('message', onMessage);
    if (typeof windowRef.setInterval === 'function') {
      closeTimer = windowRef.setInterval(() => {
        try {
          if (!popup.closed) return;
        } catch (_) {
          return;
        }
        cleanup();
        reject(new Error(translate('editor.composer.github.modal.connectAuthorizationCanceled')));
      }, 500);
    }
    if (typeof windowRef.setTimeout === 'function') {
      timer = windowRef.setTimeout(() => {
        cleanup();
        reject(new Error(translate('editor.composer.github.modal.connectAuthorizationTimedOut')));
      }, 5 * 60 * 1000);
    }
  });
}
