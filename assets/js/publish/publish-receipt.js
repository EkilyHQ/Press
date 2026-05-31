export const PUBLISH_RECEIPT_TYPE = 'press-publish-receipt';
export const PUBLISH_RECEIPT_SCHEMA_VERSION = 1;
export const PUBLISH_RECEIPT_LATEST_STORAGE_KEY = 'press.publish.latestReceipt.v1';
export const PUBLISH_RECEIPT_LIST_STORAGE_KEY = 'press.publish.receipts.v1';

export const PUBLISH_STATES = Object.freeze({
  PREPARING: 'preparing',
  AUTHORIZING: 'authorizing',
  COMMITTING: 'committing',
  COMMITTED: 'committed',
  APPLYING_LOCAL_STATE: 'applyingLocalState',
  OBSERVING_PROPAGATION: 'observingPropagation',
  OBSERVED: 'observed',
  TIMED_OUT: 'timedOut',
  CANCELED: 'canceled',
  FAILED: 'failed'
});

const TERMINAL_STATES = new Set([
  PUBLISH_STATES.OBSERVED,
  PUBLISH_STATES.TIMED_OUT,
  PUBLISH_STATES.CANCELED,
  PUBLISH_STATES.FAILED
]);

function safeString(value) {
  return value == null ? '' : String(value);
}

function isoNow(now) {
  try {
    const value = typeof now === 'function' ? now() : now;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
    const text = safeString(value).trim();
    if (text) {
      const date = new Date(text);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  } catch (_) {}
  return new Date().toISOString();
}

function createDefaultRunId(at) {
  const stamp = safeString(at).replace(/[^0-9A-Za-z]/g, '').slice(0, 17) || 'publish';
  let suffix = '';
  try {
    const cryptoRef = typeof globalThis === 'object' ? globalThis.crypto : null;
    if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
      suffix = cryptoRef.randomUUID().replace(/-/g, '').slice(0, 10);
    }
  } catch (_) {}
  if (!suffix) {
    suffix = Math.random().toString(36).slice(2, 12);
  }
  return `pub-${stamp}-${suffix}`;
}

function normalizeRepository(repo = {}) {
  const source = repo && typeof repo === 'object' ? repo : {};
  return {
    owner: safeString(source.owner).trim(),
    name: safeString(source.name).trim(),
    branch: safeString(source.branch || 'main').trim() || 'main'
  };
}

function normalizeTransport(transport = {}) {
  const source = transport && typeof transport === 'object' ? transport : {};
  const type = source.type === 'connect' ? 'connect' : 'pat';
  const out = { type };
  if (type === 'connect' && source.connect && source.connect.baseUrl) {
    try {
      out.connectBaseUrl = new URL(String(source.connect.baseUrl)).origin;
    } catch (_) {
      out.connectBaseUrl = safeString(source.connect.baseUrl).trim().split(/[?#]/)[0].replace(/\/+$/, '');
    }
  }
  return out;
}

function normalizeContentRoot(value) {
  const clean = safeString(value || 'wwwroot').replace(/\\+/g, '/').replace(/^\/+|\/+$/g, '');
  return clean || 'wwwroot';
}

function summarizeFile(file = {}) {
  const source = file && typeof file === 'object' ? file : {};
  const out = {
    path: safeString(source.path).replace(/\\+/g, '/').replace(/^\/+/, ''),
    deleted: !!source.deleted
  };
  if (source.kind) out.kind = safeString(source.kind);
  if (source.label) out.label = safeString(source.label);
  if (source.binary) out.binary = true;
  if (source.mime) out.mime = safeString(source.mime);
  if (source.assetRelativePath) out.assetRelativePath = safeString(source.assetRelativePath).replace(/\\+/g, '/').replace(/^\/+/, '');
  if (source.markdownPath) out.markdownPath = safeString(source.markdownPath).replace(/\\+/g, '/').replace(/^\/+/, '');
  return out;
}

function normalizeCommitInfo(value) {
  const source = value && typeof value === 'object' ? value : {};
  const commit = source.commit && typeof source.commit === 'object' ? source.commit : null;
  const oid = safeString(
    commit && (commit.oid || commit.sha || commit.id)
      || source.oid
      || source.sha
      || source.commitSha
      || source.commitId
  ).trim();
  if (!oid) return null;
  const out = { oid };
  if ((commit && commit.url) || source.commitUrl) out.url = safeString((commit && commit.url) || source.commitUrl).trim();
  return out;
}

function normalizePublishResult(value) {
  const source = value && typeof value === 'object' ? value : {};
  const out = {};
  if (source.provider) out.provider = safeString(source.provider);
  if (source.transport) out.transport = safeString(source.transport);
  if (source.id || source.requestId) out.id = safeString(source.id || source.requestId);
  if (source.branchName) out.branchName = safeString(source.branchName);
  if (source.expectedHeadOid) out.expectedHeadOid = safeString(source.expectedHeadOid);
  return Object.keys(out).length ? out : null;
}

function normalizePropagation(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    canceled: !!source.canceled,
    timedOut: !!source.timedOut,
    observed: !source.canceled && !source.timedOut
  };
}

export function classifyPublishError(err) {
  const status = err && Number.isFinite(Number(err.status)) ? Number(err.status) : null;
  let kind = 'unknown';
  if (status === 401) kind = 'authentication';
  else if (status === 403) kind = 'permission';
  else if (status && status >= 500) kind = 'upstream';
  else if (err && err.cause) kind = 'network';
  else if (err && err.name === 'AbortError') kind = 'canceled';
  return {
    kind,
    status,
    message: err && err.message ? String(err.message) : 'Publish failed.'
  };
}

export function createPublishReceipt({
  repo,
  transport,
  contentRoot,
  headline,
  files,
  now,
  runId
} = {}) {
  const startedAt = isoNow(now);
  const fileSummaries = (Array.isArray(files) ? files : []).map(summarizeFile).filter(file => file.path);
  const id = safeString(runId).trim() || createDefaultRunId(startedAt);
  return {
    schemaVersion: PUBLISH_RECEIPT_SCHEMA_VERSION,
    type: PUBLISH_RECEIPT_TYPE,
    runId: id,
    state: PUBLISH_STATES.PREPARING,
    startedAt,
    updatedAt: startedAt,
    finishedAt: null,
    repository: normalizeRepository(repo),
    transport: normalizeTransport(transport),
    contentRoot: normalizeContentRoot(contentRoot),
    headline: safeString(headline).trim(),
    fileCount: fileSummaries.length,
    files: fileSummaries,
    commit: null,
    publish: null,
    propagation: null,
    error: null,
    history: [
      { state: PUBLISH_STATES.PREPARING, at: startedAt }
    ]
  };
}

export function transitionPublishReceipt(receipt, state, patch = {}, options = {}) {
  if (!receipt || typeof receipt !== 'object') return null;
  const nextState = safeString(state).trim() || receipt.state || PUBLISH_STATES.PREPARING;
  const at = isoNow(options.now);
  const next = {
    ...receipt,
    state: nextState,
    updatedAt: at,
    history: Array.isArray(receipt.history) ? receipt.history.slice() : []
  };
  next.history.push({ state: nextState, at });
  if (TERMINAL_STATES.has(nextState)) next.finishedAt = at;

  if (patch.publishResult) {
    const commit = normalizeCommitInfo(patch.publishResult);
    const publish = normalizePublishResult(patch.publishResult);
    if (commit) next.commit = commit;
    if (publish) next.publish = publish;
  }
  if (patch.commit) {
    const commit = normalizeCommitInfo(patch.commit);
    if (commit) next.commit = commit;
  }
  if (patch.propagation) next.propagation = normalizePropagation(patch.propagation);
  if (patch.error) next.error = classifyPublishError(patch.error);
  return next;
}

function parseReceiptList(text) {
  try {
    const value = JSON.parse(String(text || '[]'));
    return Array.isArray(value) ? value : [];
  } catch (_) {
    return [];
  }
}

export function createPublishReceiptStore({
  storage = null,
  latestKey = PUBLISH_RECEIPT_LATEST_STORAGE_KEY,
  listKey = PUBLISH_RECEIPT_LIST_STORAGE_KEY,
  limit = 10
} = {}) {
  function getItem(key) {
    try {
      return storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null;
    } catch (_) {
      return null;
    }
  }

  function setItem(key, value) {
    try {
      if (!storage || typeof storage.setItem !== 'function') return false;
      storage.setItem(key, String(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function save(receipt) {
    if (!receipt || typeof receipt !== 'object') return false;
    const serialized = JSON.stringify(receipt);
    const latestSaved = setItem(latestKey, serialized);
    const existing = parseReceiptList(getItem(listKey)).filter(item => item && item.runId !== receipt.runId);
    existing.unshift(receipt);
    const bounded = existing.slice(0, Math.max(1, Number(limit) || 10));
    const listSaved = setItem(listKey, JSON.stringify(bounded));
    return latestSaved || listSaved;
  }

  function loadLatest() {
    try {
      const value = JSON.parse(String(getItem(latestKey) || 'null'));
      return value && value.type === PUBLISH_RECEIPT_TYPE ? value : null;
    } catch (_) {
      return null;
    }
  }

  function list() {
    return parseReceiptList(getItem(listKey)).filter(item => item && item.type === PUBLISH_RECEIPT_TYPE);
  }

  return { save, loadLatest, list };
}
