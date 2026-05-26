const fallbackGetContentRoot = () => 'wwwroot';
const noop = () => {};

function fallbackElementById(documentRef, id) {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

export function createEditorMainPreviewAssets(options = {}) {
  const documentRef = options.documentRef || null;
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : fallbackGetContentRoot;
  const getLocationHref = typeof options.getLocationHref === 'function' ? options.getLocationHref : () => '';
  const onCurrentAssetPreview = typeof options.onCurrentAssetPreview === 'function'
    ? options.onCurrentAssetPreview
    : noop;
  const getElementById = (id) => (
    typeof options.getElementById === 'function'
      ? options.getElementById(id)
      : fallbackElementById(documentRef, id)
  );

  const previewAssetBuckets = new Map();
  let previewAssetCurrentPath = '';

  const getContentRootPrefix = () => {
    try {
      const raw = String(getContentRoot() || '').trim();
      if (!raw) return '';
      return raw
        .replace(/[\\]/g, '/')
        .replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  };

  const safePreviewMime = (mime) => {
    try {
      const raw = String(mime || '').trim().toLowerCase();
      if (!raw) return 'image/png';
      return raw.startsWith('image/') ? raw : 'image/png';
    } catch (_) {
      return 'image/png';
    }
  };

  const makePreviewDataUrl = (base64, mime) => {
    try {
      const data = String(base64 || '').trim();
      if (!data) return '';
      const type = safePreviewMime(mime);
      return `data:${type};base64,${data}`;
    } catch (_) {
      return '';
    }
  };

  const normalizeKey = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(data:|blob:)/i.test(raw)) return raw;
    let input = raw;
    try {
      if (/^[a-z][a-z0-9+.-]*:/i.test(input)) {
        const href = getLocationHref() || 'http://localhost/';
        const url = new URL(input, href);
        input = url.pathname || '';
      }
    } catch (_) {}
    return input
      .replace(/^[?#]+/, '')
      .replace(/[\\]/g, '/')
      .replace(/\/+/, '/')
      .replace(/^\.\/+/, '')
      .replace(/^\/+/, '');
  };

  const normalizePath = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const cleaned = raw.replace(/[\\]/g, '/');
    const parts = cleaned.split('/');
    const stack = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (stack.length) stack.pop();
        continue;
      }
      stack.push(part);
    }
    let normalized = stack.join('/');
    const prefix = getContentRootPrefix();
    if (prefix) {
      if (normalized === prefix) return '';
      if (normalized.startsWith(`${prefix}/`)) {
        normalized = normalized.slice(prefix.length + 1);
      }
    }
    return normalized;
  };

  const buildKeysForAsset = (asset) => {
    const keys = new Set();
    const commit = normalizeKey(asset && (asset.path || asset.commitPath));
    const rel = normalizeKey(asset && asset.relativePath);
    const prefix = getContentRootPrefix();
    const join = (base, suffix) => {
      if (!base) return suffix;
      return `${base}/${suffix}`.replace(/\/+/, '/');
    };
    if (commit) {
      keys.add(commit);
      if (prefix) keys.add(join(prefix, commit));
    }
    if (rel) {
      keys.add(rel);
      if (prefix) keys.add(join(prefix, rel));
    }
    return Array.from(keys).filter(Boolean);
  };

  const updateBucket = (path, assets) => {
    const norm = normalizePath(path);
    if (!norm) {
      if (path) previewAssetBuckets.delete(norm);
      return;
    }
    let bucket = previewAssetBuckets.get(norm);
    if (!bucket) {
      bucket = new Map();
      previewAssetBuckets.set(norm, bucket);
    }
    const list = Array.isArray(assets) ? assets : [];
    if (!list.length) {
      bucket.clear();
      previewAssetBuckets.delete(norm);
      return;
    }
    const keep = new Set();
    list.forEach((asset) => {
      if (!asset) return;
      const base64 = typeof asset.base64 === 'string' ? asset.base64.trim() : '';
      if (!base64) return;
      const url = makePreviewDataUrl(base64, asset.mime);
      if (!url) return;
      const keys = buildKeysForAsset(asset);
      if (!keys.length) return;
      keys.forEach((key) => {
        if (!key) return;
        bucket.set(key, { url, mime: safePreviewMime(asset.mime) });
        keep.add(key);
      });
    });
    Array.from(bucket.keys()).forEach((key) => {
      if (!keep.has(key)) bucket.delete(key);
    });
    if (!bucket.size) previewAssetBuckets.delete(norm);
  };

  const lookupAsset = (bucket, key) => {
    if (!bucket || !key) return null;
    const direct = bucket.get(key);
    if (direct) return direct;
    const prefix = getContentRootPrefix();
    if (prefix && key.startsWith(`${prefix}/`)) {
      const trimmed = key.slice(prefix.length + 1);
      return bucket.get(trimmed) || null;
    }
    return null;
  };

  const applyAssetOverrides = (container, markdownPath) => {
    const normPath = normalizePath(markdownPath || previewAssetCurrentPath);
    if (!normPath) return;
    const bucket = previewAssetBuckets.get(normPath);
    if (!bucket || !bucket.size) return;
    const root = typeof container === 'string'
      ? (documentRef && typeof documentRef.querySelector === 'function' ? documentRef.querySelector(container) : null)
      : container;
    if (!root) return;

    const rewriteAttr = (node, attr) => {
      if (!node) return;
      const raw = node.getAttribute(attr);
      if (!raw) return;
      const key = normalizeKey(raw);
      if (!key) return;
      const asset = lookupAsset(bucket, key);
      if (!asset || !asset.url) return;
      if (node.getAttribute(attr) === asset.url) return;
      node.setAttribute(attr, asset.url);
    };

    const rewriteSrcset = (node, attr) => {
      if (!node) return;
      const raw = node.getAttribute(attr);
      if (!raw) return;
      const parts = raw.split(',');
      let changed = false;
      const next = parts.map((part) => {
        const seg = part.trim();
        if (!seg) return '';
        const bits = seg.split(/\s+/);
        const url = bits.shift();
        const asset = lookupAsset(bucket, normalizeKey(url));
        if (asset && asset.url) {
          changed = true;
          return [asset.url, ...bits].join(' ');
        }
        return seg;
      });
      if (changed) node.setAttribute(attr, next.filter(Boolean).join(', '));
    };

    root.querySelectorAll('img').forEach((img) => {
      rewriteAttr(img, 'src');
      rewriteAttr(img, 'data-src');
      rewriteAttr(img, 'data-original');
      rewriteSrcset(img, 'srcset');
    });
    root.querySelectorAll('source').forEach((source) => {
      rewriteAttr(source, 'src');
      rewriteSrcset(source, 'srcset');
    });
    root.querySelectorAll('video').forEach((video) => {
      rewriteAttr(video, 'poster');
      rewriteAttr(video, 'src');
      rewriteSrcset(video, 'srcset');
    });
  };

  const refreshAssetOverrides = () => {
    ['blocks-wrap'].forEach((id) => {
      const target = getElementById(id);
      if (!target) return;
      applyAssetOverrides(target, previewAssetCurrentPath);
    });
  };

  const collectAssetOverrides = (markdownPath) => {
    const normPath = normalizePath(markdownPath || previewAssetCurrentPath);
    if (!normPath) return [];
    const bucket = previewAssetBuckets.get(normPath);
    if (!bucket || !bucket.size) return [];
    return Array.from(bucket.entries())
      .map(([key, value]) => ({
        key,
        url: value && value.url ? String(value.url) : '',
        mime: value && value.mime ? String(value.mime) : ''
      }))
      .filter((item) => item.key && item.url);
  };

  const handleAssetPreviewEvent = (event) => {
    if (!event || !event.detail) return;
    const detail = event.detail;
    const markdownPath = normalizePath(detail.markdownPath || detail.path || '');
    updateBucket(markdownPath, detail.assets || []);
    if (!markdownPath) {
      refreshAssetOverrides();
      onCurrentAssetPreview();
      return;
    }
    if (markdownPath === normalizePath(previewAssetCurrentPath)) {
      refreshAssetOverrides();
      onCurrentAssetPreview();
    }
  };

  const setCurrentFileInfo = (info) => {
    previewAssetCurrentPath = normalizePath(info && info.path ? info.path : '');
  };

  return {
    applyAssetOverrides,
    collectAssetOverrides,
    getCurrentPath: () => previewAssetCurrentPath,
    handleAssetPreviewEvent,
    normalizeKey,
    normalizePath,
    refreshAssetOverrides,
    setCurrentFileInfo,
    updateBucket
  };
}
