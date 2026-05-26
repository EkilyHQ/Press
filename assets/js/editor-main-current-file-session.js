import { createEditorMainCurrentFileView, normalizeCurrentFileBreadcrumb } from './editor-main-current-file-view.js';

const fallbackInferSource = (path) => {
  const normalized = String(path || '').replace(/[\\]/g, '/').replace(/^\/+/, '').toLowerCase();
  if (normalized.startsWith('tab/')) return 'tabs';
  return normalized ? 'article' : '';
};

const STATUS_STATES = new Set(['checking', 'existing', 'missing', 'error']);

export function createEditorMainCurrentFileSession(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const inferSource = typeof options.inferCurrentFileSource === 'function' ? options.inferCurrentFileSource : fallbackInferSource;

  let currentFileInfo = { path: '', source: '', breadcrumb: [], status: null, dirty: false, draft: null, draftState: '', loaded: false };

  const currentFileView = createEditorMainCurrentFileView({
    runtime,
    documentRef,
    translate: options.translate,
    getCurrentLang: options.getCurrentLang,
    normalizeLangKey: options.normalizeLangKey,
    applyEditorEmptyState: options.applyEditorEmptyState,
    onRendered: options.onRendered
  });

  const normalizeStatusPayload = (value) => {
    if (!value || typeof value !== 'object') return null;
    const rawState = String(value.state || '').trim().toLowerCase();
    const state = STATUS_STATES.has(rawState) ? rawState : '';
    const normalized = {};
    if (state) normalized.state = state;

    let checkedAt = value.checkedAt;
    if (checkedAt instanceof Date) checkedAt = checkedAt.getTime();
    else if (typeof checkedAt === 'string') {
      const trimmed = checkedAt.trim();
      if (trimmed) {
        const asNumber = Number(trimmed);
        if (Number.isFinite(asNumber)) checkedAt = asNumber;
        else {
          const parsed = Date.parse(trimmed);
          checkedAt = Number.isFinite(parsed) ? parsed : null;
        }
      } else {
        checkedAt = null;
      }
    }
    if (Number.isFinite(checkedAt)) normalized.checkedAt = Math.floor(checkedAt);

    if (value.message) normalized.message = String(value.message);
    if (value.code != null && value.code !== '') {
      const codeNum = Number(value.code);
      if (Number.isFinite(codeNum)) normalized.code = codeNum;
    }

    return Object.keys(normalized).length ? normalized : (state ? { state } : null);
  };

  const normalizeCurrentFilePayload = (input) => {
    if (typeof input === 'string') {
      const path = String(input || '').trim();
      return { path, source: inferSource(path), breadcrumb: normalizeCurrentFileBreadcrumb(null, path), status: null, dirty: false, draft: null, draftState: '', loaded: false };
    }
    if (input && typeof input === 'object') {
      const path = input.path != null ? String(input.path || '').trim() : '';
      const source = input.source != null && String(input.source || '').trim()
        ? String(input.source || '').trim().toLowerCase()
        : inferSource(path);
      const breadcrumb = normalizeCurrentFileBreadcrumb(input.breadcrumb, path);
      const status = normalizeStatusPayload(input.status);
      const dirty = !!input.dirty;
      const loaded = !!input.loaded;
      let draft = null;
      let draftState = '';
      if (input.draft && typeof input.draft === 'object') {
        const savedAtRaw = Number(input.draft.savedAt);
        const savedAt = Number.isFinite(savedAtRaw) ? savedAtRaw : null;
        const conflict = !!input.draft.conflict;
        const hasContent = !!input.draft.hasContent;
        if (hasContent) {
          draft = { savedAt, conflict, hasContent };
          draftState = conflict ? 'conflict' : 'saved';
        }
      }
      return { path, source, breadcrumb, status, dirty, draft, draftState, loaded };
    }
    return { path: '', source: '', breadcrumb: [], status: null, dirty: false, draft: null, draftState: '', loaded: false };
  };

  const render = () => {
    currentFileView.render(currentFileInfo);
  };

  const bindElement = (el) => {
    currentFileView.bindElement(el);
  };

  const setCurrentFile = (input) => {
    currentFileInfo = normalizeCurrentFilePayload(input);
    render();
    return currentFileInfo;
  };

  return {
    bindElement,
    getInfo: () => currentFileInfo,
    getPath: () => (currentFileInfo && currentFileInfo.path ? String(currentFileInfo.path) : ''),
    normalize: normalizeCurrentFilePayload,
    render,
    set: setCurrentFile
  };
}
