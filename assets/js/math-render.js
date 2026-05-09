const KATEX_VENDOR_BASE = './vendor/katex/';
let katexLoadPromise = null;

function resolveVendorUrl(path) {
  try {
    return new URL(`${KATEX_VENDOR_BASE}${path}`, import.meta.url).href;
  } catch (_) {
    return `${KATEX_VENDOR_BASE}${path}`;
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

function loadKatexScript(documentRef) {
  const win = documentRef && documentRef.defaultView ? documentRef.defaultView : (typeof window !== 'undefined' ? window : null);
  if (win && win.katex && typeof win.katex.render === 'function') return Promise.resolve(win.katex);
  if (katexLoadPromise) return katexLoadPromise;
  if (!documentRef || !documentRef.head) return Promise.resolve(null);

  katexLoadPromise = new Promise((resolve) => {
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
  return katexLoadPromise;
}

export async function renderPressMath(root) {
  if (!root || !root.querySelectorAll) return { rendered: 0, failed: 0 };
  const nodes = Array.from(root.querySelectorAll('.press-math[data-tex]'))
    .filter(node => node && node.dataset && node.dataset.pressMathRendered !== 'true');
  if (!nodes.length) return { rendered: 0, failed: 0 };

  const documentRef = root.ownerDocument || (typeof document !== 'undefined' ? document : null);
  ensureKatexStyle(documentRef);
  const katex = await loadKatexScript(documentRef);
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
