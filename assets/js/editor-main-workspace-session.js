import { normalizeMarkdownEditorView } from './editor-main-runtime.js?v=press-system-v3.4.52';

const noop = () => {};

function fallbackElementById(documentRef, id) {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

function fallbackQuerySelector(documentRef, selector) {
  return documentRef && typeof documentRef.querySelector === 'function'
    ? documentRef.querySelector(selector)
    : null;
}

function fallbackQuerySelectorAll(documentRef, selector) {
  if (!documentRef || typeof documentRef.querySelectorAll !== 'function') return [];
  try { return Array.from(documentRef.querySelectorAll(selector)); }
  catch (_) { return []; }
}

function preventDefault(event) {
  try {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
  } catch (_) {}
}

export function createEditorMainWorkspaceSession(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const forceMarkdownWrap = !!options.forceMarkdownWrap;
  const editor = options.editor || null;
  const textarea = options.textarea || null;
  const getPreviewSession = typeof options.getPreviewSession === 'function'
    ? options.getPreviewSession
    : () => null;
  const getBlocksEditor = typeof options.getBlocksEditor === 'function'
    ? options.getBlocksEditor
    : () => null;
  const syncBlocksFromSource = typeof options.syncBlocksFromSource === 'function'
    ? options.syncBlocksFromSource
    : noop;
  const requestLayout = typeof options.requestLayout === 'function' ? options.requestLayout : noop;
  const getElementById = (id) => (
    typeof runtime.getElementById === 'function'
      ? runtime.getElementById(id)
      : fallbackElementById(documentRef, id)
  );
  const querySelector = (selector) => (
    typeof runtime.querySelector === 'function'
      ? runtime.querySelector(selector)
      : fallbackQuerySelector(documentRef, selector)
  );
  const querySelectorAll = (selector) => (
    typeof runtime.querySelectorAll === 'function'
      ? runtime.querySelectorAll(selector)
      : fallbackQuerySelectorAll(documentRef, selector)
  );

  let wrapEnabled = false;
  let bound = false;

  const readWrapState = () => {
    if (typeof runtime.readWrapEnabled === 'function') {
      return runtime.readWrapEnabled({ force: forceMarkdownWrap });
    }
    return forceMarkdownWrap;
  };

  const persistWrapState = (on) => {
    if (typeof runtime.persistWrapEnabled === 'function') {
      runtime.persistWrapEnabled(on);
    }
  };

  const readPersistedView = () => {
    if (typeof runtime.readMarkdownEditorView === 'function') {
      return runtime.readMarkdownEditorView();
    }
    return 'blocks';
  };

  const persistView = (mode) => {
    if (typeof runtime.persistMarkdownEditorView === 'function') {
      runtime.persistMarkdownEditorView(mode);
    }
  };

  const getWorkspaceElements = () => ({
    editorWrap: getElementById('editor-wrap'),
    blocksWrap: getElementById('blocks-wrap'),
    editorShell: getElementById('markdownEditorShell'),
    editorToolbar: getElementById('editorToolbar'),
    viewToggle: querySelector('.view-toggle'),
    viewButtons: querySelectorAll('.vt-btn[data-view]')
  });

  const getWrapElements = () => {
    const wrapToggle = getElementById('wrapToggle');
    return {
      wrapToggle,
      wrapToggleButtons: wrapToggle && typeof wrapToggle.querySelectorAll === 'function'
        ? Array.from(wrapToggle.querySelectorAll('[data-wrap]'))
        : []
    };
  };

  const syncWrapToggle = (on) => {
    const enabled = !!on;
    const { wrapToggle, wrapToggleButtons } = getWrapElements();
    if (wrapToggle) {
      wrapToggle.setAttribute('data-state', enabled ? 'on' : 'off');
    }
    wrapToggleButtons.forEach((btn) => {
      const isOn = (btn.dataset.wrap || '').toLowerCase() === 'on';
      const active = isOn === enabled;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  const applyEditorEmptyState = (isEmpty) => {
    const empty = !!isEmpty;
    const editorLayoutEl = getElementById('mode-editor');
    const editorMainEl = editorLayoutEl && typeof editorLayoutEl.querySelector === 'function'
      ? editorLayoutEl.querySelector('.editor-main')
      : null;
    const editorEmptyStateEl = getElementById('editorEmptyState');
    const editorMarkdownPanelEl = getElementById('editorMarkdownPanel');

    if (editorLayoutEl) {
      editorLayoutEl.classList.remove('is-empty');
      editorLayoutEl.toggleAttribute('data-current-file', !empty);
    }
    if (editorMainEl) {
      editorMainEl.removeAttribute('hidden');
    }
    if (editorMarkdownPanelEl) {
      if (empty) {
        editorMarkdownPanelEl.setAttribute('hidden', '');
        editorMarkdownPanelEl.setAttribute('aria-hidden', 'true');
      } else {
        editorMarkdownPanelEl.removeAttribute('hidden');
        editorMarkdownPanelEl.removeAttribute('aria-hidden');
      }
    }
    if (editorEmptyStateEl) {
      editorEmptyStateEl.setAttribute('hidden', '');
      editorEmptyStateEl.setAttribute('aria-hidden', 'true');
    }
  };

  const applyWrapState = (value, opts = {}) => {
    const on = forceMarkdownWrap ? true : !!value;
    wrapEnabled = on;
    let applied = false;
    try {
      if (editor && typeof editor.setWrap === 'function') {
        editor.setWrap(on);
        applied = true;
      }
    } catch (_) {}
    if (!applied && textarea) {
      try {
        textarea.setAttribute('wrap', on ? 'soft' : 'off');
        textarea.style.whiteSpace = on ? 'pre-wrap' : 'pre';
      } catch (_) {}
    }
    syncWrapToggle(on);
    if (opts.persist !== false) persistWrapState(on);
    return on;
  };

  const handleWrapSelection = (state) => {
    const next = String(state || '').toLowerCase() === 'on';
    applyWrapState(next);
  };

  const focusBlocksEditor = () => {
    const blocksEditor = getBlocksEditor();
    try {
      if (blocksEditor && typeof blocksEditor.focus === 'function') blocksEditor.focus();
    } catch (_) {}
  };

  const requestBlocksLayout = () => {
    const blocksEditor = getBlocksEditor();
    if (blocksEditor && typeof blocksEditor.requestLayout === 'function') {
      try {
        blocksEditor.requestLayout();
        return;
      } catch (_) {}
    }
    requestLayout();
  };

  const switchView = (mode) => {
    const nextView = normalizeMarkdownEditorView(mode);
    const { editorWrap, blocksWrap, editorShell, editorToolbar, viewToggle, viewButtons } = getWorkspaceElements();
    if (!editorWrap) return nextView;
    if (editorShell) editorShell.classList.toggle('is-blocks-mode', nextView === 'blocks');
    if (nextView === 'blocks') {
      try { syncBlocksFromSource(); } catch (_) {}
      if (editorShell) editorShell.style.display = '';
      editorWrap.style.display = 'none';
      if (blocksWrap) {
        blocksWrap.hidden = false;
        blocksWrap.removeAttribute('aria-hidden');
      }
      if (editorToolbar) {
        editorToolbar.hidden = true;
        editorToolbar.setAttribute('aria-hidden', 'true');
      }
      if (viewToggle) viewToggle.dataset.view = 'blocks';
      focusBlocksEditor();
    } else {
      if (editorShell) editorShell.style.display = '';
      editorWrap.style.display = '';
      if (blocksWrap) {
        blocksWrap.hidden = true;
        blocksWrap.setAttribute('aria-hidden', 'true');
      }
      if (editorToolbar) {
        editorToolbar.hidden = false;
        editorToolbar.removeAttribute('aria-hidden');
      }
      if (viewToggle) viewToggle.dataset.view = 'edit';
    }
    viewButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === (nextView === 'blocks' ? 'blocks' : 'edit'));
    });
    return nextView;
  };

  const openPreview = () => {
    const previewSession = getPreviewSession();
    try {
      if (previewSession && typeof previewSession.open === 'function') previewSession.open();
    } catch (_) {}
  };

  const setView = (mode, opts = {}) => {
    if (mode === 'preview') {
      openPreview();
      return 'preview';
    }
    const nextView = switchView(mode);
    if (nextView === 'blocks') requestBlocksLayout();
    else requestLayout();
    if (opts.persist) persistView(nextView);
    return nextView;
  };

  const restorePersistedView = (opts = {}) => setView(readPersistedView(), opts);

  const getView = () => {
    const viewToggle = querySelector('.view-toggle');
    return normalizeMarkdownEditorView(viewToggle && viewToggle.dataset ? viewToggle.dataset.view : 'blocks');
  };

  const bindWrapToggle = () => {
    const { wrapToggleButtons } = getWrapElements();
    wrapToggleButtons.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        preventDefault(event);
        handleWrapSelection(btn.dataset.wrap);
      });
      btn.addEventListener('keydown', (event) => {
        if (event.key === ' ') {
          preventDefault(event);
          handleWrapSelection(btn.dataset.wrap);
        }
      });
    });
  };

  const bindViewToggle = () => {
    querySelectorAll('.vt-btn[data-view]').forEach((button) => {
      button.addEventListener('click', (event) => {
        preventDefault(event);
        setView(button.dataset.view, { persist: true });
      });
    });
  };

  const bindPreviewButton = () => {
    const previewOpenButton = getElementById('btnOpenPreview');
    if (!previewOpenButton) return;
    previewOpenButton.addEventListener('click', (event) => {
      preventDefault(event);
      openPreview();
    });
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    bindWrapToggle();
    bindViewToggle();
    bindPreviewButton();
  };

  const initialize = () => {
    bind();
    applyEditorEmptyState(true);
    applyWrapState(readWrapState(), { persist: false });
  };

  return {
    bind,
    initialize,
    applyEditorEmptyState,
    setView,
    restorePersistedView,
    getView,
    openPreview,
    switchView,
    setWrap: applyWrapState,
    applyWrapState,
    isWrapEnabled: () => wrapEnabled
  };
}
