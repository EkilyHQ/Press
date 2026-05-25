const KATEX_VENDOR_BASE = './vendor/katex/';
const KATEX_VENDOR_CACHE_KEY = '';

function appendVendorCacheKey(url) {
  const cacheKey = String(KATEX_VENDOR_CACHE_KEY || '').trim();
  if (!cacheKey) return url;
  const raw = String(url || '');
  const hashIndex = raw.indexOf('#');
  const pathAndQuery = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
  const joiner = pathAndQuery.includes('?') ? '&' : '?';
  return `${pathAndQuery}${joiner}v=${encodeURIComponent(cacheKey)}${hash}`;
}

function resolveVendorUrl(path) {
  try {
    return appendVendorCacheKey(new URL(`${KATEX_VENDOR_BASE}${path}`, import.meta.url).href);
  } catch (_) {
    return appendVendorCacheKey(`${KATEX_VENDOR_BASE}${path}`);
  }
}

function ensureKatexStyle(documentRef) {
  if (!documentRef || !documentRef.head) return;
  if (documentRef.querySelector && documentRef.querySelector('link[data-press-katex="style"]')) return;
  const link = documentRef.createElement('link');
  link.rel = 'stylesheet';
  link.href = resolveVendorUrl('katex.min.css');
  link.dataset.pressKatex = 'style';
  documentRef.head.appendChild(link);
}

function createKatexLoaderState() {
  return { loadPromise: null };
}

function loadKatexScript(documentRef, windowRef = null, loaderState = null) {
  const win = windowRef || null;
  if (win && win.katex && typeof win.katex.render === 'function') return Promise.resolve(win.katex);
  const state = loaderState && typeof loaderState === 'object' ? loaderState : null;
  if (state && state.loadPromise) return state.loadPromise;
  if (!documentRef || !documentRef.head) return Promise.resolve(null);

  const promise = new Promise((resolve) => {
    const existing = documentRef.querySelector && documentRef.querySelector('script[data-press-katex="script"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(win && win.katex ? win.katex : null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      return;
    }
    const script = documentRef.createElement('script');
    script.src = resolveVendorUrl('katex.min.js');
    script.async = true;
    script.dataset.pressKatex = 'script';
    script.addEventListener('load', () => resolve(win && win.katex ? win.katex : null), { once: true });
    script.addEventListener('error', () => resolve(null), { once: true });
    documentRef.head.appendChild(script);
  });
  if (!state) return promise;
  state.loadPromise = promise.then((katex) => {
    if (!katex) state.loadPromise = null;
    return katex;
  }, (err) => {
    state.loadPromise = null;
    throw err;
  });
  return state.loadPromise;
}

function fallbackDocumentRef(root) {
  return root && root.ownerDocument
    ? root.ownerDocument
    : (typeof document !== 'undefined' ? document : null);
}

function fallbackWindowRef(documentRef) {
  return documentRef && documentRef.defaultView
    ? documentRef.defaultView
    : (typeof window !== 'undefined' ? window : null);
}

function resolveMathRuntimeRefs(root, options = {}) {
  const hasDocumentRef = Object.prototype.hasOwnProperty.call(options || {}, 'documentRef');
  const hasWindowRef = Object.prototype.hasOwnProperty.call(options || {}, 'windowRef');
  const documentRef = hasDocumentRef ? (options.documentRef || null) : fallbackDocumentRef(root);
  const windowRef = hasWindowRef ? (options.windowRef || null) : fallbackWindowRef(documentRef);
  return { documentRef, windowRef };
}

export function createPressMathRenderer(options = {}) {
  const documentRef = Object.prototype.hasOwnProperty.call(options || {}, 'documentRef')
    ? options.documentRef || null
    : null;
  const windowRef = Object.prototype.hasOwnProperty.call(options || {}, 'windowRef')
    ? options.windowRef || null
    : null;
  const loaderState = createKatexLoaderState();
  return root => renderPressMath(root, { documentRef, windowRef, loaderState });
}

export async function renderPressMath(root, options = {}) {
  if (!root || !root.querySelectorAll) return { rendered: 0, failed: 0 };
  const nodes = Array.from(root.querySelectorAll('.press-math[data-tex]'))
    .filter(node => node && node.dataset && node.dataset.pressMathRendered !== 'true');
  if (!nodes.length) return { rendered: 0, failed: 0 };

  const { documentRef, windowRef } = resolveMathRuntimeRefs(root, options);
  ensureKatexStyle(documentRef);
  const katex = await loadKatexScript(documentRef, windowRef, options.loaderState || null);
  if (!katex || typeof katex.render !== 'function') return { rendered: 0, failed: nodes.length };

  let rendered = 0;
  let failed = 0;
  nodes.forEach((node) => {
    const tex = String(node.getAttribute('data-tex') || '');
    const displayMode = node.classList && node.classList.contains('press-math-display');
    try {
      katex.render(tex, node, {
        displayMode: !!displayMode,
        throwOnError: false,
        strict: 'warn',
        trust: false
      });
      node.dataset.pressMathRendered = 'true';
      rendered += 1;
    } catch (_) {
      node.textContent = tex;
      node.dataset.pressMathRendered = 'true';
      node.classList.add('press-math-error');
      failed += 1;
    }
  });
  return { rendered, failed };
}
