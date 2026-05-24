export function createSyncOverlayController({
  documentRef = null,
  windowRef = null,
  translate = (key) => key
} = {}) {
  let syncOverlayElements = null;
  let syncOverlayCancelHandler = null;
  let activeSyncWatcher = null;

  const t = (key) => {
    const value = typeof translate === 'function' ? translate(key) : '';
    return value || key;
  };
  const requestFrame = (handler) => {
    if (windowRef && typeof windowRef.requestAnimationFrame === 'function') {
      return windowRef.requestAnimationFrame(handler);
    }
    if (typeof handler === 'function') handler();
    return 0;
  };
  const setTimer = (handler, delay) => (
    windowRef && typeof windowRef.setTimeout === 'function'
      ? windowRef.setTimeout(handler, delay)
      : null
  );
  const clearTimer = (timerId) => {
    if (!timerId) return;
    if (windowRef && typeof windowRef.clearTimeout === 'function') {
      windowRef.clearTimeout(timerId);
    }
  };

  function ensureElements() {
    if (syncOverlayElements) return syncOverlayElements;
    if (!documentRef) return null;

    const overlay = documentRef.createElement('div');
    overlay.id = 'nsSyncOverlay';
    overlay.className = 'sync-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');

    const panel = documentRef.createElement('div');
    panel.className = 'sync-overlay-panel';
    panel.setAttribute('role', 'document');

    const spinner = documentRef.createElement('div');
    spinner.className = 'sync-overlay-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const title = documentRef.createElement('h2');
    title.className = 'sync-overlay-title';
    title.id = 'nsSyncOverlayTitle';
    title.textContent = 'Waiting for GitHub…';
    title.tabIndex = -1;

    const message = documentRef.createElement('p');
    message.className = 'sync-overlay-message';
    message.id = 'nsSyncOverlayMessage';

    const status = documentRef.createElement('p');
    status.className = 'sync-overlay-status';
    status.id = 'nsSyncOverlayStatus';

    const cancelBtn = documentRef.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary sync-overlay-cancel';
    cancelBtn.textContent = 'Stop waiting';

    panel.append(spinner, title, message, status, cancelBtn);
    overlay.appendChild(panel);
    documentRef.body.appendChild(overlay);

    cancelBtn.addEventListener('click', () => {
      if (syncOverlayCancelHandler) syncOverlayCancelHandler('button');
    });

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay && syncOverlayCancelHandler) {
        syncOverlayCancelHandler('backdrop');
      }
    });

    overlay.addEventListener('keydown', (event) => {
      if ((event.key || '').toLowerCase() === 'escape' && syncOverlayCancelHandler) {
        event.preventDefault();
        syncOverlayCancelHandler('escape');
      }
    });

    syncOverlayElements = { overlay, panel, spinner, title, message, status, cancelBtn };
    return syncOverlayElements;
  }

  function setTitle(text) {
    const els = syncOverlayElements || ensureElements();
    if (!els || !els.title) return;
    els.title.textContent = text || 'Waiting for GitHub…';
  }

  function setMessage(text) {
    const els = syncOverlayElements || ensureElements();
    if (!els || !els.message) return;
    els.message.textContent = text ? String(text) : '';
  }

  function setStatus(text) {
    const els = syncOverlayElements || ensureElements();
    if (!els || !els.status) return;
    els.status.textContent = text ? String(text) : '';
  }

  function setCancelHandler(handler, cancelable = true) {
    const els = syncOverlayElements || ensureElements();
    if (!els || !els.cancelBtn) return;
    if (cancelable && typeof handler === 'function') {
      syncOverlayCancelHandler = handler;
      els.cancelBtn.hidden = false;
      els.cancelBtn.disabled = false;
    } else {
      syncOverlayCancelHandler = null;
      els.cancelBtn.hidden = true;
      els.cancelBtn.disabled = true;
    }
  }

  function show(options = {}) {
    const els = ensureElements();
    if (!els || !els.overlay) return;

    const title = options.title || 'Waiting for GitHub…';
    const message = options.message || '';
    const status = options.status || '';
    const cancelLabel = options.cancelLabel || 'Stop waiting';
    const cancelable = options.cancelable !== false;

    setTitle(title);
    setMessage(message);
    setStatus(status);

    try {
      els.overlay.hidden = false;
      els.overlay.classList.add('is-visible');
      els.overlay.setAttribute('aria-hidden', 'false');
    } catch (_) {}

    if (els.cancelBtn) {
      els.cancelBtn.textContent = cancelLabel;
    }
    setCancelHandler(null, cancelable);

    try { documentRef.body.classList.add('press-sync-overlay-open'); }
    catch (_) {}

    const focusOverlay = () => {
      try {
        if (cancelable && els.cancelBtn && !els.cancelBtn.hidden) {
          els.cancelBtn.focus();
        } else if (els.title) {
          els.title.focus({ preventScroll: true });
        }
      } catch (_) {}
    };
    requestFrame(focusOverlay);
  }

  function hide() {
    const els = syncOverlayElements || ensureElements();
    if (!els || !els.overlay) return;
    try {
      els.overlay.classList.remove('is-visible');
      els.overlay.setAttribute('aria-hidden', 'true');
      els.overlay.hidden = true;
    } catch (_) {}
    setCancelHandler(null, true);
    try { documentRef.body.classList.remove('press-sync-overlay-open'); }
    catch (_) {}
  }

  function startRemoteWatcher(config = {}) {
    if (!config || typeof config.fetch !== 'function') return null;
    if (activeSyncWatcher && typeof activeSyncWatcher.cancel === 'function') {
      try { activeSyncWatcher.cancel('replaced'); } catch (_) {}
    }

    const overlayTitle = config.title || t('editor.composer.remoteWatcher.waitingForGitHub');
    const overlayMessage = config.message || '';
    const overlayStatus = config.initialStatus || t('editor.composer.remoteWatcher.preparing');
    const cancelLabel = config.cancelLabel || t('editor.composer.remoteWatcher.stopWaiting');
    const cancelable = config.cancelable !== false;

    show({ title: overlayTitle, message: overlayMessage, status: overlayStatus, cancelLabel, cancelable });
    setStatus(overlayStatus);

    let aborted = false;
    let attempts = 0;
    let timer = null;

    const cancel = (reason) => {
      if (aborted) return;
      aborted = true;
      if (timer) {
        clearTimer(timer);
        timer = null;
      }
      hide();
      activeSyncWatcher = null;
      if (typeof config.onCancel === 'function') {
        try { config.onCancel(reason); } catch (_) {}
      }
    };

    setCancelHandler(cancelable ? cancel : null, cancelable);

    const scheduleNext = (delay) => {
      if (aborted) return;
      const ms = Math.max(1200, Number(delay) || 0);
      if (timer) clearTimer(timer);
      timer = setTimer(runFetch, ms);
    };

    const runFetch = async () => {
      if (aborted) return;
      attempts += 1;
      let result;
      try {
        result = await config.fetch({ attempts, updateStatus: setStatus });
      } catch (err) {
        if (aborted) return;
        const msg = (typeof config.onErrorStatus === 'function')
          ? config.onErrorStatus(err, attempts)
          : t('editor.composer.remoteWatcher.remoteCheckFailedRetry');
        setStatus(msg);
        scheduleNext(config.errorDelay || 6000);
        return;
      }

      if (aborted) return;
      if (result && result.statusMessage) setStatus(result.statusMessage);
      if (result && result.message) setMessage(result.message);

      if (result && result.done) {
        aborted = true;
        hide();
        activeSyncWatcher = null;
        if (typeof config.onSuccess === 'function') {
          try { config.onSuccess(result); } catch (_) {}
        }
        return;
      }

      const nextDelay = result && typeof result.retryDelay === 'number'
        ? result.retryDelay
        : config.interval || 5000;
      scheduleNext(nextDelay);
    };

    activeSyncWatcher = { cancel, attempts: () => attempts };

    const initialDelay = config.initialDelay != null ? config.initialDelay : 2400;
    scheduleNext(initialDelay);
    return activeSyncWatcher;
  }

  return {
    show,
    hide,
    setTitle,
    setMessage,
    setStatus,
    setCancelHandler,
    startRemoteWatcher
  };
}
