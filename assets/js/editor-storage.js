function normalizeStorageScopePart(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw.replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'root';
}

export function resolveEditorStorageScope(locationLike) {
  let protocol = '';
  let host = '';
  let pathname = '';
  try {
    if (typeof locationLike === 'string') {
      const url = new URL(locationLike);
      protocol = url.protocol;
      host = url.host;
      pathname = url.pathname;
    } else if (locationLike && typeof locationLike === 'object') {
      if (locationLike.href) {
        const url = new URL(String(locationLike.href));
        protocol = url.protocol;
        host = url.host;
        pathname = url.pathname;
      } else {
        protocol = String(locationLike.protocol || '');
        host = String(locationLike.host || locationLike.hostname || '');
        pathname = String(locationLike.pathname || '');
      }
    }
  } catch (_) {
    return 'unknown';
  }
  const path = String(pathname || '');
  const segments = path.split('/').filter(Boolean);
  const firstSegment = segments[0] || '';
  const isRootIndexFile = segments.length === 1
    && (firstSegment === 'index.html' || firstSegment === 'index_editor.html')
    && !path.endsWith('/');
  const sitePath = firstSegment && !isRootIndexFile ? firstSegment : 'root';
  const protocolPart = protocol ? protocol.replace(/:$/, '') : 'site';
  return [
    'v2',
    normalizeStorageScopePart(protocolPart),
    normalizeStorageScopePart(host || 'local'),
    normalizeStorageScopePart(sitePath)
  ].join(':');
}

export function createScopedStorageKey(scope, key) {
  return `${key}:${scope || 'unknown'}`;
}

export function readJsonStore(storage, key, fallback = {}) {
  try {
    const raw = storage && storage.getItem ? storage.getItem(key) : '';
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

export function writeJsonStore(storage, key, store) {
  try {
    if (!storage) return;
    if (!store || !Object.keys(store).length) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, JSON.stringify(store));
  } catch (_) {
    /* ignore unavailable storage */
  }
}
