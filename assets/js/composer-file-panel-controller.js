function noop() {}

function normalizeComposerFileKind(name) {
  if (name === 'tabs') return 'tabs';
  if (name === 'site') return 'site';
  return 'index';
}

function getElement(documentRef, id) {
  try {
    return documentRef && typeof documentRef.getElementById === 'function'
      ? documentRef.getElementById(id)
      : null;
  } catch (_) {
    return null;
  }
}

function queryAll(documentRef, selector) {
  try {
    return documentRef && typeof documentRef.querySelectorAll === 'function'
      ? Array.from(documentRef.querySelectorAll(selector))
      : [];
  } catch (_) {
    return [];
  }
}

function setDisplay(element, visible, visibleDisplay = '') {
  if (!element || !element.style) return;
  element.style.display = visible ? visibleDisplay : 'none';
}

export function createComposerFilePanelController(options = {}) {
  const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const storage = options.storage || (windowRef && windowRef.localStorage) || null;
  const storageKey = String(options.storageKey || 'press_composer_file');
  const t = typeof options.t === 'function' ? options.t : (key) => key;
  const prefersReducedMotion = typeof options.prefersReducedMotion === 'function'
    ? options.prefersReducedMotion
    : () => false;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function'
    ? options.requestAnimationFrameRef
    : (callback) => {
      if (windowRef && typeof windowRef.requestAnimationFrame === 'function') {
        return windowRef.requestAnimationFrame(callback);
      }
      return (windowRef && typeof windowRef.setTimeout === 'function'
        ? windowRef.setTimeout(callback, 0)
        : setTimeout(callback, 0));
    };
  const setTimeoutRef = typeof options.setTimeoutRef === 'function'
    ? options.setTimeoutRef
    : (handler, delay) => (windowRef && typeof windowRef.setTimeout === 'function'
      ? windowRef.setTimeout(handler, delay)
      : setTimeout(handler, delay));
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function'
    ? options.clearTimeoutRef
    : (id) => {
      if (windowRef && typeof windowRef.clearTimeout === 'function') windowRef.clearTimeout(id);
      else clearTimeout(id);
    };
  const onPanelStateApplied = typeof options.onPanelStateApplied === 'function'
    ? options.onPanelStateApplied
    : noop;
  const defaultInitialFile = normalizeComposerFileKind(options.defaultInitialFile || 'site');
  const restoreStoredInitialFile = options.restoreStoredInitialFile === true;

  let activeComposerFile = normalizeComposerFileKind(options.initialFile || 'index');
  let composerViewTransition = null;

  function readStoredComposerFile() {
    try {
      if (!storage || typeof storage.getItem !== 'function') return '';
      const raw = String(storage.getItem(storageKey) || '').toLowerCase();
      return raw === 'index' || raw === 'tabs' || raw === 'site' ? raw : '';
    } catch (_) {
      return '';
    }
  }

  function getInitialComposerFile() {
    const stored = readStoredComposerFile();
    if (restoreStoredInitialFile && stored) return stored;
    if (stored === 'site') return 'site';
    return defaultInitialFile;
  }

  function getActiveComposerFile() {
    return normalizeComposerFileKind(activeComposerFile);
  }

  function getComposerViewTransition() {
    return composerViewTransition;
  }

  function cancelComposerViewTransition() {
    if (!composerViewTransition) return;
    const { panels, cleanup } = composerViewTransition;
    if (typeof cleanup === 'function') {
      try { cleanup(); } catch (_) {}
    }
    if (panels && panels.classList) {
      panels.classList.remove('is-hidden');
      panels.classList.remove('is-transitioning');
    }
    composerViewTransition = null;
  }

  function updateToggleUi() {
    const normalized = getActiveComposerFile();
    queryAll(documentRef, 'a.vt-btn[data-cfile]').forEach((link) => {
      try {
        if (link && link.classList) {
          link.classList.toggle('active', link.dataset && link.dataset.cfile === normalized);
        }
      } catch (_) {}
    });

    const addButton = getElement(documentRef, 'btnAddItem');
    if (!addButton) return;

    if (normalized === 'index' || normalized === 'tabs') {
      const key = normalized === 'index' ? 'editor.composer.addPost' : 'editor.composer.addTab';
      addButton.hidden = false;
      if (addButton.style) addButton.style.display = '';
      addButton.setAttribute('data-i18n', key);
      addButton.textContent = t(key);
      return;
    }

    addButton.hidden = true;
    if (addButton.style) addButton.style.display = 'none';
  }

  function applyPanelState() {
    const normalized = getActiveComposerFile();
    const showIndex = normalized === 'index';
    const showTabs = normalized === 'tabs';
    const showSite = normalized === 'site';

    setDisplay(getElement(documentRef, 'composerIndexHost'), showIndex);
    setDisplay(getElement(documentRef, 'composerTabsHost'), showTabs);
    setDisplay(getElement(documentRef, 'composerSiteHost'), showSite);
    setDisplay(getElement(documentRef, 'composerIndex'), showIndex, 'block');
    setDisplay(getElement(documentRef, 'composerTabs'), showTabs, 'block');
    setDisplay(getElement(documentRef, 'composerSite'), showSite, 'block');

    try {
      const root = documentRef && documentRef.documentElement;
      if (root) {
        if (normalized === 'tabs' || normalized === 'site') root.setAttribute('data-init-cfile', normalized);
        else root.removeAttribute('data-init-cfile');
      }
    } catch (_) {}

    try {
      onPanelStateApplied(normalized);
    } catch (_) {}
  }

  function applyComposerFile(name, applyOptions = {}) {
    const target = normalizeComposerFileKind(name);
    const force = !!applyOptions.force;
    const immediate = !!applyOptions.immediate;
    if (!force && activeComposerFile === target) {
      if (immediate) cancelComposerViewTransition();
      return target;
    }

    const panels = getElement(documentRef, 'composerPanels');
    const reduceMotion = immediate || prefersReducedMotion();

    activeComposerFile = target;
    updateToggleUi();

    if (!panels || reduceMotion) {
      cancelComposerViewTransition();
      applyPanelState();
      if (panels && panels.classList) {
        panels.classList.remove('is-hidden');
        panels.classList.remove('is-transitioning');
      }
      return target;
    }

    cancelComposerViewTransition();

    const duration = 200;
    const state = { panels };
    composerViewTransition = state;
    let switched = false;
    let finished = false;
    let timerOut = null;
    let timerIn = null;

    const clearTimerOut = () => {
      if (timerOut != null) {
        clearTimeoutRef(timerOut);
        timerOut = null;
      }
    };

    const clearTimerIn = () => {
      if (timerIn != null) {
        clearTimeoutRef(timerIn);
        timerIn = null;
      }
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimerIn();
      panels.classList.remove('is-transitioning');
      panels.classList.remove('is-hidden');
      panels.removeEventListener('transitionend', handleFadeOut);
      panels.removeEventListener('transitionend', handleFadeIn);
      composerViewTransition = null;
    };

    const handleFadeIn = (event) => {
      if (event && (event.target !== panels || event.propertyName !== 'opacity')) return;
      clearTimerIn();
      finish();
    };

    const startFadeIn = () => {
      if (switched) return;
      switched = true;
      panels.removeEventListener('transitionend', handleFadeOut);
      clearTimerOut();
      applyPanelState();
      requestAnimationFrameRef(() => {
        if (finished) return;
        panels.addEventListener('transitionend', handleFadeIn);
        panels.classList.remove('is-hidden');
        timerIn = setTimeoutRef(() => handleFadeIn({ target: panels, propertyName: 'opacity' }), duration + 80);
      });
    };

    const handleFadeOut = (event) => {
      if (event && (event.target !== panels || event.propertyName !== 'opacity')) return;
      startFadeIn();
    };

    state.cleanup = () => {
      clearTimerOut();
      clearTimerIn();
      panels.removeEventListener('transitionend', handleFadeOut);
      panels.removeEventListener('transitionend', handleFadeIn);
    };

    panels.addEventListener('transitionend', handleFadeOut);
    panels.classList.add('is-transitioning');

    requestAnimationFrameRef(() => {
      if (finished) return;
      panels.classList.add('is-hidden');
      timerOut = setTimeoutRef(() => startFadeIn(), duration + 80);
    });

    return target;
  }

  function persistComposerFile(name) {
    const normalized = normalizeComposerFileKind(name);
    try {
      if (storage && typeof storage.setItem === 'function') storage.setItem(storageKey, normalized);
    } catch (_) {}
    return normalized;
  }

  function setComposerFile(name, applyOptions = {}) {
    const normalized = applyComposerFile(name, applyOptions);
    persistComposerFile(normalized);
    return normalized;
  }

  return {
    applyComposerFile,
    cancelComposerViewTransition,
    getActiveComposerFile,
    getComposerViewTransition,
    getInitialComposerFile,
    setComposerFile
  };
}
