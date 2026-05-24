import { normalizeMarkdownDraftContent } from '../composer-markdown-save.js';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function arrayBufferToBase64(buffer) {
  if (!buffer) return '';
  try {
    const bytes = new Uint8Array(buffer);
    let output = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const triplet = (a << 16) | (b << 8) | c;
      output += BASE64_CHARS[(triplet >> 18) & 63];
      output += BASE64_CHARS[(triplet >> 12) & 63];
      output += i + 1 < bytes.length ? BASE64_CHARS[(triplet >> 6) & 63] : '=';
      output += i + 2 < bytes.length ? BASE64_CHARS[triplet & 63] : '=';
    }
    return output;
  } catch (_) {
    return '';
  }
}

function normalizeContentRoot(value) {
  const root = String(value || 'wwwroot').replace(/\\+/g, '/').replace(/^\/+|\/+$/g, '');
  return root || 'wwwroot';
}

export async function waitForRemotePropagation(files = [], options = {}) {
  if (!Array.isArray(files) || !files.length) return { canceled: false };
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : null;
  const setStatus = typeof options.setStatus === 'function' ? options.setStatus : () => {};
  const setCancelHandler = typeof options.setCancelHandler === 'function' ? options.setCancelHandler : () => {};
  const sleepMs = typeof options.sleepMs === 'function' ? options.sleepMs : async () => {};
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const normalizedRoot = normalizeContentRoot(options.contentRoot);

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
            const url = `${path}?ts=${now()}`;
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
            const url = `${path}?ts=${now()}`;
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
        await sleepMs(Math.min(countdownStepMs, remaining));
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
