import { normalizeMarkdownDraftContent } from '../composer-markdown-save.js';

function sleep(ms) {
  const timeout = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => { setTimeout(resolve, timeout); });
}

function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  try {
    const bytes = new Uint8Array(buffer);
    const chunk = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode.apply(null, slice);
    }
    return btoa(binary);
  } catch (_) {
    try {
      return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
    } catch (err) {
      console.error('Failed to encode array buffer to base64', err);
      return '';
    }
  }
}

export async function waitForRemotePropagation(files = [], options = {}) {
  if (!Array.isArray(files) || !files.length) return { canceled: false };
  const windowRef = options.windowRef || window;
  const fetchImpl = options.fetchImpl || fetch;
  const setStatus = typeof options.setStatus === 'function' ? options.setStatus : () => {};
  const setCancelHandler = typeof options.setCancelHandler === 'function' ? options.setCancelHandler : () => {};

  const normalizedRoot = (() => {
    try {
      const root = (windowRef.__press_content_root || 'wwwroot').replace(/\\+/g, '/').replace(/^\/+|\/+$/g, '');
      return root;
    } catch (_) {
      return 'wwwroot';
    }
  })();

  const toLivePath = (path) => {
    const clean = String(path || '').replace(/\\+/g, '/').replace(/^\/+/, '');
    if (!clean) return '';
    if (normalizedRoot && clean.startsWith(`${normalizedRoot}/`)) {
      return clean.slice(normalizedRoot.length + 1);
    }
    if (normalizedRoot && clean === normalizedRoot) return '';
    return clean;
  };

  const buildCheckPaths = (file) => {
    const paths = [];
    const commitPath = String(file.path || '').replace(/\\+/g, '/').replace(/^\/+/, '');
    const livePath = toLivePath(commitPath);
    if (file.assetRelativePath && file.markdownPath) {
      const base = String(file.markdownPath || '').replace(/\\+/g, '/').replace(/^\/+/, '');
      const idx = base.lastIndexOf('/');
      const baseDir = idx >= 0 ? base.slice(0, idx + 1) : '';
      const rel = String(file.assetRelativePath || '').replace(/\\+/g, '/').replace(/^\/+/, '');
      const combined = `${baseDir}${rel}`.replace(/\/+/g, '/').replace(/^\/+/, '');
      if (combined && !paths.includes(combined)) paths.push(combined);
    }
    if (livePath && !paths.includes(livePath)) paths.push(livePath);
    if (commitPath && !paths.includes(commitPath)) paths.push(commitPath);
    return paths;
  };

  const unique = [];
  const seen = new Set();
  files.forEach((file) => {
    if (!file || !file.path) return;
    const normalized = String(file.path).replace(/\\+/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized === 'site.yaml' || seen.has(normalized)) return;
    seen.add(normalized);
    unique.push({ ...file, path: normalized });
  });

  const checkIntervalMs = 30000;
  const countdownStepMs = 1000;
  const maxAttempts = 10;
  let canceled = false;
  let timedOut = false;

  const cancelHandler = () => {
    if (canceled) return;
    canceled = true;
    setStatus('Stopping remote checks...');
  };
  setCancelHandler(cancelHandler, true);

  for (const file of unique) {
    if (canceled || timedOut) break;
    const displayLabel = String(file.label || file.path || '').trim() || file.path;
    const expectedText = normalizeMarkdownDraftContent(file.content || '');
    const expectedBase64 = typeof file.base64 === 'string'
      ? file.base64.replace(/\s+/g, '')
      : '';
    const candidates = buildCheckPaths(file);
    let attempt = 0;
    let confirmed = false;
    while (!canceled && attempt < maxAttempts) {
      attempt += 1;
      setStatus(`Checking ${displayLabel} (attempt ${attempt})...`);
      let ok = false;
      if (file.deleted) {
        let checked = false;
        let stillExists = false;
        let indeterminate = false;
        for (const path of candidates) {
          if (!path) continue;
          try {
            const url = `${path}?ts=${Date.now()}`;
            const resp = await fetchImpl(url, { cache: 'no-store' });
            checked = true;
            if (resp.ok) {
              stillExists = true;
              break;
            }
            if (resp.status !== 404 && resp.status !== 410) {
              indeterminate = true;
            }
          } catch (_) {
            indeterminate = true;
          }
        }
        ok = checked && !stillExists && !indeterminate;
      } else {
        for (const path of candidates) {
          if (!path) continue;
          try {
            const url = `${path}?ts=${Date.now()}`;
            const resp = await fetchImpl(url, { cache: 'no-store' });
            if (!resp.ok) {
              ok = false;
              continue;
            }
            if (file.binary) {
              const buffer = await resp.arrayBuffer();
              const remoteBase64 = arrayBufferToBase64(buffer);
              if (remoteBase64 && expectedBase64 && remoteBase64 === expectedBase64) {
                ok = true;
                break;
              }
            } else {
              const text = normalizeMarkdownDraftContent(await resp.text());
              if (text === expectedText) {
                ok = true;
                break;
              }
            }
          } catch (_) {
            ok = false;
          }
        }
      }
      if (canceled) break;
      if (ok) {
        confirmed = true;
        break;
      }
      for (let remaining = checkIntervalMs; remaining > 0; remaining -= countdownStepMs) {
        const seconds = Math.ceil(remaining / 1000);
        setStatus(`Attempt ${attempt} did not match for ${displayLabel}. Next check in ${seconds}s...`);
        await sleep(Math.min(countdownStepMs, remaining));
        if (canceled) break;
      }
    }
    if (!canceled && !confirmed) {
      timedOut = true;
      setStatus(`Could not confirm ${displayLabel} after ${maxAttempts} attempts.`);
    }
  }
  setCancelHandler(null, true);
  if (canceled) {
    return { canceled: true };
  }
  if (timedOut) {
    return { canceled: false, timedOut: true };
  }
  setStatus('All files confirmed on site.');
  return { canceled: false, timedOut: false };
}
