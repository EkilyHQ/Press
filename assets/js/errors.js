// errors.js — lightweight global error overlay and reporter
import { t } from './i18n.js?v=press-system-v3.4.51';

const ERROR_HANDLERS_INSTALLED = Symbol('pressErrorHandlersInstalled');

function createErrorReporterState(options = {}) {
  return {
    reporterConfig: {
      reportUrl: options.reportUrl || null,
      siteTitle: options.siteTitle || 'Press'
    },
    overlayUIEnabled: !!options.enableOverlay,
    extraContext: {},
    overlayQueue: [],
    overlayShowing: false,
    overlayDedup: new Set(),
    handlersInstalled: false
  };
}

function createErrorReporterRuntime(options = {}) {
  const state = createErrorReporterState(options);
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const navigatorRef = options.navigatorRef || null;
  const setTimer = typeof options.setTimer === 'function' ? options.setTimer : null;
  const clearTimer = typeof options.clearTimer === 'function' ? options.clearTimer : null;
  const requestFrame = typeof options.requestFrame === 'function' ? options.requestFrame : null;

  const runtime = {
    state,
    getDocument() {
      return documentRef || (typeof document !== 'undefined' ? document : null);
    },
    getWindow() {
      return windowRef || (typeof window !== 'undefined' ? window : null);
    },
    getNavigator() {
      const win = runtime.getWindow();
      return navigatorRef || (win && win.navigator) || (typeof navigator !== 'undefined' ? navigator : null);
    },
    setTimer(callback, delay) {
      if (setTimer) return setTimer(callback, delay);
      const win = runtime.getWindow();
      if (win && typeof win.setTimeout === 'function') return win.setTimeout(callback, delay);
      if (typeof setTimeout === 'function') return setTimeout(callback, delay);
      return null;
    },
    clearTimer(id) {
      if (clearTimer) return clearTimer(id);
      const win = runtime.getWindow();
      if (win && typeof win.clearTimeout === 'function') return win.clearTimeout(id);
      if (typeof clearTimeout === 'function') return clearTimeout(id);
      return undefined;
    },
    requestFrame(callback) {
      if (requestFrame) return requestFrame(callback);
      const win = runtime.getWindow();
      if (win && typeof win.requestAnimationFrame === 'function') return win.requestAnimationFrame(callback);
      return runtime.setTimer(callback, 0);
    }
  };
  return runtime;
}

function ensureOverlayRoot(runtime) {
  const documentRef = runtime.getDocument();
  if (!documentRef || !documentRef.body) return null;
  let root = documentRef.getElementById && documentRef.getElementById('errorOverlayRoot');
  if (root) return root;
  root = documentRef.createElement('div');
  root.id = 'errorOverlayRoot';
  root.setAttribute('aria-live', 'assertive');
  root.style.position = 'fixed';
  root.style.right = '1rem';
  root.style.bottom = '1rem';
  root.style.zIndex = '2147483647';
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.gap = '0.625rem';
  documentRef.body.appendChild(root);
  return root;
}

function formatReportPayload(error, context, runtime) {
  const state = runtime.state;
  const documentRef = runtime.getDocument();
  const windowRef = runtime.getWindow();
  const navigatorRef = runtime.getNavigator();
  const now = new Date();
  const reason = error && (error.message || String(error));
  let stack = error && error.stack ? String(error.stack) : undefined;
  // Synthesize a minimal stack if the browser didn't provide one.
  if (!stack && context && (context.filename || context.lineno)) {
    const loc = [context.filename, context.lineno, context.colno].filter(v => v || v === 0).join(':');
    stack = loc || undefined;
  }
  const url = windowRef && windowRef.location ? String(windowRef.location.href || '') : '';
  const lang = documentRef && documentRef.documentElement && documentRef.documentElement.getAttribute
    ? documentRef.documentElement.getAttribute('lang')
    : '';
  const query = windowRef && windowRef.location && windowRef.location.search
    ? Object.fromEntries(new URLSearchParams(windowRef.location.search).entries())
    : {};
  const mergedContext = { ...(state.extraContext || {}), ...(context || {}) };
  return {
    app: state.reporterConfig.siteTitle || 'Press',
    time: now.toISOString(),
    name: (error && error.name) || 'Error',
    message: reason || (context && context.message) || 'Unknown error',
    note: mergedContext && mergedContext.note ? String(mergedContext.note) : undefined,
    stack,
    filename: mergedContext && mergedContext.filename || undefined,
    lineno: mergedContext && mergedContext.lineno || undefined,
    colno: mergedContext && mergedContext.colno || undefined,
    url,
    lang,
    query,
    userAgent: navigatorRef && navigatorRef.userAgent ? String(navigatorRef.userAgent) : '',
    context: mergedContext || null
  };
}

function openReportUrl(payload, runtime) {
  const base = runtime.state.reporterConfig.reportUrl;
  const windowRef = runtime.getWindow();
  if (!base || !windowRef || typeof windowRef.open !== 'function') return false;
  const title = encodeURIComponent(`[Bug] ${payload.message.substring(0, 60)}`);
  const body = encodeURIComponent('```json\n' + JSON.stringify(payload, null, 2) + '\n```');
  const join = base.includes('?') ? '&' : '?';
  const url = `${base}${join}title=${title}&body=${body}`;
  try { windowRef.open(url, '_blank', 'noopener'); return true; } catch (_) { return false; }
}

function copyToClipboard(text, runtime) {
  const navigatorRef = runtime.getNavigator();
  try {
    if (!navigatorRef || !navigatorRef.clipboard || typeof navigatorRef.clipboard.writeText !== 'function') {
      return Promise.resolve(false);
    }
    return navigatorRef.clipboard.writeText(text).then(() => true).catch(() => false);
  } catch (_) {
    return Promise.resolve(false);
  }
}

function showErrorOverlayWithRuntime(runtime, err, context = {}) {
  const state = runtime.state;
  if (!state.overlayUIEnabled) return; // overlay UI disabled by config
  try {
    // Basic dedupe: avoid enqueuing identical name+message+url within a short window.
    const key = `${(err && err.name) || 'Error'}|${(err && err.message) || (context && context.message) || ''}|${(context && context.assetUrl) || ''}`;
    if (!state.overlayDedup.has(key)) {
      state.overlayDedup.add(key);
      runtime.setTimer(() => state.overlayDedup.delete(key), 5000);
      state.overlayQueue.push({ err, context });
    }
    processOverlayQueue(runtime);
  } catch (_) {
    // Fallback to immediate render if queueing somehow fails.
    try { renderOverlayCard(formatReportPayload(err, context, runtime), null, runtime); } catch (_) {}
  }
}

function processOverlayQueue(runtime) {
  const state = runtime.state;
  if (state.overlayShowing) return;
  const next = state.overlayQueue.shift();
  if (!next) return;
  state.overlayShowing = true;
  const payload = formatReportPayload(next.err, next.context, runtime);
  renderOverlayCard(payload, () => {
    state.overlayShowing = false;
    // Next tick to avoid tight recursion.
    runtime.setTimer(() => processOverlayQueue(runtime), 0);
  }, runtime);
}

function renderOverlayCard(payload, onDone, runtime) {
  const root = ensureOverlayRoot(runtime);
  const documentRef = runtime.getDocument();
  if (!root || !documentRef) {
    if (typeof onDone === 'function') onDone();
    return;
  }
  const card = documentRef.createElement('div');
  card.className = 'error-card';
  card.setAttribute('role', 'alert');
  const localizeName = (name) => {
    const s = String(name || '').trim();
    const lower = s.toLowerCase();
    if (!s) return t('ui.error') || 'Error';
    if (lower === 'warning') return t('ui.warning') || 'Warning';
    if (lower === 'error') return t('ui.error') || 'Error';
    return s;
  };
  card.innerHTML = `
    <div class="error-head">⚠️ ${escapeHtmlShort(localizeName(payload.name))}: ${escapeHtmlShort(payload.message)}</div>
    <div class="error-meta">${new Date(payload.time).toLocaleString()} · ${escapeHtmlShort(payload.app)}</div>
    <details class="error-details">
      <summary>${escapeHtmlShort(t('ui.details') || 'Details')}</summary>
      <pre class="error-pre">${escapeHtmlLong(JSON.stringify(payload, null, 2))}</pre>
    </details>
    <div class="error-actions">
      <button class="btn-copy">${escapeHtmlShort(t('ui.copyDetails') || t('code.copy') || 'Copy')}</button>
      ${runtime.state.reporterConfig.reportUrl ? `<button class="btn-report">${escapeHtmlShort(t('ui.reportIssue') || 'Report issue')}</button>` : ''}
      <button class="btn-dismiss">${escapeHtmlShort(t('ui.close') || 'Close')}</button>
    </div>
  `;

  // Enter animation (opacity + slight translate/scale)
  card.style.willChange = 'transform, opacity';
  card.style.opacity = '0';
  card.style.transform = 'translateY(10px) scale(0.98)';
  card.style.transition = 'transform 180ms ease, opacity 160ms ease-out';

  let dismissed = false;
  let removed = false;
  let autoTimer = null;
  const finalizeRemove = () => {
    if (removed) return; removed = true;
    try { runtime.clearTimer(autoTimer); } catch (_) {}
    if (card && card.parentNode) card.parentNode.removeChild(card);
    if (typeof onDone === 'function') {
      try { onDone(); } catch (_) {}
    }
  };
  const animateOut = () => {
    if (dismissed) return; dismissed = true;
    // Exit animation
    card.style.transition = 'transform 180ms ease, opacity 140ms ease-in';
    card.style.transform = 'translateY(10px) scale(0.98)';
    card.style.opacity = '0';
    const onEnd = () => { card.removeEventListener('transitionend', onEnd); finalizeRemove(); };
    card.addEventListener('transitionend', onEnd);
    // Safety: ensure removal even if transitionend doesn't fire.
    runtime.setTimer(onEnd, 300);
  };

  // Wire actions
  card.querySelector('.btn-dismiss')?.addEventListener('click', animateOut);
  card.querySelector('.btn-copy')?.addEventListener('click', async () => {
    const ok = await copyToClipboard(JSON.stringify(payload, null, 2), runtime);
    const btn = card.querySelector('.btn-copy');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = ok ? (t('code.copied') || 'Copied') : (t('code.failed') || 'Failed');
      runtime.setTimer(() => { btn.textContent = old; }, 1500);
    }
  });
  const reportBtn = card.querySelector('.btn-report');
  if (reportBtn) reportBtn.addEventListener('click', () => openReportUrl(payload, runtime));

  // Insert and play enter animation on next frame
  root.appendChild(card);
  runtime.requestFrame(() => { runtime.requestFrame(() => {
    card.style.opacity = '1';
    card.style.transform = 'translateY(0) scale(1)';
  }); });

  // Auto-dismiss after 2 minutes unless details expanded.
  autoTimer = runtime.setTimer(() => {
    try {
      if (!card.querySelector('.error-details')?.open) animateOut();
    } catch (_) { animateOut(); }
  }, 120000);

  // If user expands details, keep it longer; if they collapse again, leave timer as-is.
  try {
    const det = card.querySelector('.error-details');
    if (det) det.addEventListener('toggle', () => { /* no-op for now */ });
  } catch (_) {}
}

function installErrorHandlers(runtime) {
  const state = runtime.state;
  const windowRef = runtime.getWindow();
  if (!windowRef || typeof windowRef.addEventListener !== 'function') return;
  if (state.handlersInstalled || windowRef[ERROR_HANDLERS_INSTALLED] || windowRef.__nano_error_handlers_installed) return;
  // 1) Runtime script errors (bubble phase)
  windowRef.addEventListener('error', (e) => {
    try {
      showErrorOverlayWithRuntime(
        runtime,
        e.error || new Error(e.message || 'Script error'),
        {
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          origin: 'window.error'
        }
      );
    } catch (_) {}
  });
  // 2) Resource load errors (capture phase) — catch 404s for <img>, <link>, <script>, media
  windowRef.addEventListener('error', (e) => {
    try {
      const target = e && e.target;
      if (!target || target === windowRef) return;
      const tag = (target.tagName || '').toLowerCase();
      if (!tag) return;
      let url = '';
      if (tag === 'img' || tag === 'script') {
        url = target.currentSrc || target.src || '';
      } else if (tag === 'link') {
        url = target.href || '';
      } else if (tag === 'video' || tag === 'audio') {
        try { url = target.currentSrc || (target.querySelector('source') && target.querySelector('source').src) || ''; } catch(_) { url = ''; }
      } else {
        return; // ignore other elements
      }
      const msg = (t('errors.resourceLoadFailed') || 'Resource failed to load') + `: <${tag}> ${url || ''}`.trim();
      const err = new Error(msg);
      try { err.name = 'Warning'; } catch(_) {}
      showErrorOverlayWithRuntime(runtime, err, {
        message: msg,
        origin: 'resource.error',
        tagName: tag,
        assetUrl: url,
        filename: url
      });
    } catch (_) { /* swallow */ }
  }, true);
  // 3) Unhandled promise rejections
  windowRef.addEventListener('unhandledrejection', (e) => {
    try {
      showErrorOverlayWithRuntime(
        runtime,
        e.reason || new Error('Unhandled promise rejection'),
        { message: (e.reason && e.reason.message) || 'Unhandled promise rejection', origin: 'unhandledrejection' }
      );
    } catch (_) {}
  });
  state.handlersInstalled = true;
  try { windowRef[ERROR_HANDLERS_INSTALLED] = true; } catch (_) {}
  try { windowRef.__nano_error_handlers_installed = true; } catch (_) {}
}

export function createErrorReporter(options = {}) {
  const runtime = createErrorReporterRuntime(options);
  return {
    init(initOptions = {}) {
      const state = runtime.state;
      state.reporterConfig = {
        reportUrl: initOptions.reportUrl || state.reporterConfig.reportUrl || null,
        siteTitle: initOptions.siteTitle || state.reporterConfig.siteTitle || 'Press'
      };
      // Allow toggling the overlay UI (default off).
      try { state.overlayUIEnabled = !!initOptions.enableOverlay; } catch (_) { state.overlayUIEnabled = false; }
      installErrorHandlers(runtime);
    },
    showErrorOverlay(err, context = {}) {
      showErrorOverlayWithRuntime(runtime, err, context);
    },
    setReporterContext(obj) {
      try {
        const o = (obj && typeof obj === 'object') ? obj : {};
        runtime.state.extraContext = { ...(runtime.state.extraContext || {}), ...o };
      } catch (_) { /* ignore */ }
    },
    formatReportPayload(error, context = {}) {
      return formatReportPayload(error, context, runtime);
    }
  };
}

const defaultErrorReporter = createErrorReporter();

export function showErrorOverlay(err, context = {}) {
  return defaultErrorReporter.showErrorOverlay(err, context);
}

export function initErrorReporter(options = {}) {
  return defaultErrorReporter.init(options);
}

// Allow app code to attach additional structured context (e.g., route info)
export function setReporterContext(obj) {
  return defaultErrorReporter.setReporterContext(obj);
}

// Minimal HTML escapers to avoid importing utils
function escapeHtmlShort(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#039;' }[c]));
}
function escapeHtmlLong(s) { return escapeHtmlShort(s); }
