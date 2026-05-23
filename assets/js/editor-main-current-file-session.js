const fallbackTranslate = (key) => key;
const fallbackGetCurrentLang = () => 'en';
const fallbackNormalizeLangKey = (value) => String(value || '').trim().toLowerCase();
const fallbackInferSource = (path) => {
  const normalized = String(path || '').replace(/[\\]/g, '/').replace(/^\/+/, '').toLowerCase();
  if (normalized.startsWith('tab/')) return 'tabs';
  return normalized ? 'article' : '';
};
const noop = () => {};

const STATUS_LABEL_KEYS = {
  checking: 'editor.currentFile.status.checking',
  existing: 'editor.currentFile.status.existing',
  missing: 'editor.currentFile.status.missing',
  error: 'editor.currentFile.status.error'
};

const STATUS_STATES = new Set(['checking', 'existing', 'missing', 'error']);

const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getPlainText = (() => {
  const entityMap = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const knownTags = new Set([
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo',
    'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
    'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed',
    'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label',
    'legend', 'li', 'link', 'main', 'map', 'mark', 'meta', 'meter', 'nav', 'noscript', 'object',
    'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby',
    's', 'samp', 'script', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style',
    'sub', 'summary', 'sup', 'svg', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th',
    'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
  ]);
  const spacedTags = new Set([
    'article', 'aside', 'blockquote', 'br', 'div', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'footer',
    'form', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td',
    'tfoot', 'th', 'thead', 'title', 'tr', 'ul', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ]);
  const decodeEntity = (entity) => {
    if (!entity) return '&';
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const num = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(num)) {
        try {
          return String.fromCodePoint(num);
        } catch (_) {
          return `&${entity};`;
        }
      }
      return `&${entity};`;
    }
    const mapped = entityMap[entity.toLowerCase()];
    return mapped != null ? mapped : `&${entity};`;
  };

  return (value) => {
    if (value == null) return '';
    const input = String(value);
    let result = '';
    let entityBuffer = '';
    let capturingEntity = false;
    let pendingSpace = false;

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];

      if (capturingEntity) {
        if (ch === ';') {
          result += decodeEntity(entityBuffer);
          entityBuffer = '';
          capturingEntity = false;
        } else if (/^[0-9a-zA-Z#]$/.test(ch) && entityBuffer.length < 32) {
          entityBuffer += ch;
        } else {
          result += `&${entityBuffer}${ch}`;
          entityBuffer = '';
          capturingEntity = false;
        }
        continue;
      }

      if (ch === '&') {
        capturingEntity = true;
        entityBuffer = '';
        continue;
      }

      if (ch === '<') {
        const close = input.indexOf('>', i + 1);
        if (close === -1) {
          result += '<';
        } else {
          const tagContent = input.slice(i + 1, close).trim();
          const appendGap = () => { if (result && !/\s$/.test(result)) result += ' '; };
          if (tagContent.startsWith('!--') || tagContent.toLowerCase().startsWith('!doctype')) {
            appendGap();
            pendingSpace = true;
            i = close;
            continue;
          }
          const tagMatch = tagContent.match(/^\/?\s*([a-zA-Z][a-zA-Z0-9:-]*)/);
          const tagName = tagMatch ? tagMatch[1].toLowerCase() : null;
          if (tagName && (knownTags.has(tagName) || tagName.includes('-'))) {
            if (spacedTags.has(tagName)) {
              appendGap();
              pendingSpace = true;
            }
            i = close;
            continue;
          }
          result += '<';
        }
        continue;
      }

      if (/\s/.test(ch)) {
        if (!result || !/\s$/.test(result)) result += ' ';
        pendingSpace = false;
        continue;
      }

      if (pendingSpace && result && !/\s$/.test(result)) {
        result += ' ';
      }
      pendingSpace = false;

      result += ch;
    }

    if (capturingEntity) result += `&${entityBuffer}`;

    return result.replace(/\s+/g, ' ').trim();
  };
})();

function fallbackElementById(documentRef, id) {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

export function createEditorMainCurrentFileSession(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
  const translateImpl = typeof options.translate === 'function' ? options.translate : fallbackTranslate;
  const getCurrentLang = typeof options.getCurrentLang === 'function' ? options.getCurrentLang : fallbackGetCurrentLang;
  const normalizeLangKey = typeof options.normalizeLangKey === 'function' ? options.normalizeLangKey : fallbackNormalizeLangKey;
  const inferSource = typeof options.inferCurrentFileSource === 'function' ? options.inferCurrentFileSource : fallbackInferSource;
  const applyEmptyState = typeof options.applyEditorEmptyState === 'function' ? options.applyEditorEmptyState : noop;
  const onRendered = typeof options.onRendered === 'function' ? options.onRendered : noop;
  const getElementById = (id) => (
    typeof runtime.getElementById === 'function'
      ? runtime.getElementById(id)
      : fallbackElementById(documentRef, id)
  );
  const emitBreadcrumbSelect = (detail) => {
    if (typeof runtime.emitCurrentFileBreadcrumbSelect === 'function') {
      runtime.emitCurrentFileBreadcrumbSelect(detail);
    }
  };

  let currentFileInfo = { path: '', source: '', breadcrumb: [], status: null, dirty: false, draft: null, draftState: '', loaded: false };
  let currentFileElRef = null;

  const translate = (key, params) => {
    try {
      return translateImpl(key, params);
    } catch (_) {
      return key;
    }
  };

  const ensureCurrentFileElement = () => {
    try {
      if (currentFileElRef && documentRef && documentRef.body && documentRef.body.contains(currentFileElRef)) {
        return currentFileElRef;
      }
    } catch (_) {}
    currentFileElRef = getElementById('currentFile');
    return currentFileElRef;
  };

  const formatStatusTimestamp = (ms) => {
    if (!Number.isFinite(ms)) return '';
    try {
      const fmt = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      return fmt.format(new Date(ms));
    } catch (_) {
      try { return new Date(ms).toLocaleString(); }
      catch (__) { return ''; }
    }
  };

  const resolveRelativeTimeLocales = () => {
    const lang = normalizeLangKey(getCurrentLang());
    if (!lang) return null;
    const chineseLocale = String.fromCharCode(122, 104);
    if (lang === 'chs') return [`${chineseLocale}-CN`, chineseLocale, 'en'];
    if (lang === 'cht-tw') return [`${chineseLocale}-TW`, `${chineseLocale}-Hant`, chineseLocale, 'en'];
    if (lang === 'cht-hk') return [`${chineseLocale}-HK`, `${chineseLocale}-Hant`, chineseLocale, 'en'];
    if (lang === 'ja') return ['ja-JP', 'ja', 'en'];
    if (lang === 'en') return ['en'];
    if (/^[a-z]{2}(?:-[a-z0-9-]+)?$/i.test(lang)) return [lang, 'en'];
    return null;
  };

  const formatRelativeTime = (ms) => {
    if (!Number.isFinite(ms)) return '';
    const diff = Date.now() - ms;
    const abs = Math.abs(diff);
    const sec = Math.round(abs / 1000);
    const minute = 60;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;
    const locales = resolveRelativeTimeLocales();
    const rtf = (() => {
      try {
        if (locales && locales.length) return new Intl.RelativeTimeFormat(locales, { numeric: 'auto' });
        return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      } catch (_) {
        try { return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }); }
        catch (__) { return null; }
      }
    })();
    const format = (value, unit) => {
      if (rtf) {
        return rtf.format(value, unit);
      }
      const units = { second: 'second', minute: 'minute', hour: 'hour', day: 'day', week: 'week', month: 'month', year: 'year' };
      const label = units[unit] || unit;
      const plural = Math.abs(value) === 1 ? '' : 's';
      return value < 0 ? `${Math.abs(value)} ${label}${plural} from now` : `${Math.abs(value)} ${label}${plural} ago`;
    };
    if (sec < 45) return translate('editor.currentFile.draft.justNow');
    if (sec < 90) return format(diff < 0 ? 1 : -1, 'minute');
    if (sec < 45 * minute) return format(Math.round(diff / (1000 * minute) * -1), 'minute');
    if (sec < 90 * minute) return format(diff < 0 ? 1 : -1, 'hour');
    if (sec < 22 * hour) return format(Math.round(diff / (1000 * hour) * -1), 'hour');
    if (sec < 36 * hour) return format(diff < 0 ? 1 : -1, 'day');
    if (sec < 10 * day) return format(Math.round(diff / (1000 * day) * -1), 'day');
    if (sec < 14 * day) return format(diff < 0 ? 1 : -1, 'week');
    if (sec < 8 * week) return format(Math.round(diff / (1000 * week) * -1), 'week');
    if (sec < 18 * month) return format(Math.round(diff / (1000 * month) * -1), 'month');
    return format(Math.round(diff / (1000 * year) * -1), 'year');
  };

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

  const normalizeCurrentFileBreadcrumb = (value, fallbackPath = '') => {
    const source = Array.isArray(value) ? value : [];
    const items = source
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const label = String(item.label || '').trim();
        if (!label) return null;
        return {
          label,
          nodeId: item.nodeId != null ? String(item.nodeId || '').trim() : '',
          path: item.path != null ? String(item.path || '').trim() : ''
        };
      })
      .filter(Boolean);
    if (items.length) return items;
    const path = String(fallbackPath || '').trim();
    return path ? [{ label: path, nodeId: '', path }] : [];
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

  const describeStatusLabel = (status) => {
    if (!status || !status.state) return '';
    const key = STATUS_LABEL_KEYS[status.state];
    const base = key ? translate(key) : status.state;
    if (status.state === 'error') {
      const detail = [];
      if (status.message) detail.push(String(status.message));
      if (Number.isFinite(status.code)) detail.push(`HTTP ${status.code}`);
      return detail.length ? `${base} (${detail.join(' · ')})` : base;
    }
    return base;
  };

  const formatStatusMeta = (status) => {
    if (!status || !status.state) return '';
    if (status.state === 'checking') {
      if (Number.isFinite(status.checkedAt)) {
        const ts = formatStatusTimestamp(status.checkedAt);
        return ts
          ? translate('editor.currentFile.meta.checkingStarted', { time: ts })
          : translate('editor.currentFile.meta.checking');
      }
      return translate('editor.currentFile.meta.checking');
    }
    if (Number.isFinite(status.checkedAt)) {
      const ts = formatStatusTimestamp(status.checkedAt);
      return ts ? translate('editor.currentFile.meta.lastChecked', { time: ts }) : '';
    }
    return '';
  };

  const renderCurrentFileBreadcrumb = (items, fullPath) => {
    const crumbs = Array.isArray(items) && items.length
      ? items
      : normalizeCurrentFileBreadcrumb(null, fullPath);
    if (!crumbs.length) return '';
    const html = [];
    crumbs.forEach((item, index) => {
      if (index > 0) html.push('<span class="cf-breadcrumb-separator" aria-hidden="true">/</span>');
      const label = escapeHtml(item.label || '');
      const currentClass = index === crumbs.length - 1 ? ' cf-breadcrumb-item-current' : '';
      const ariaCurrent = index === crumbs.length - 1 ? ' aria-current="page"' : '';
      html.push(`<span class="cf-breadcrumb-item cf-breadcrumb-item-static${currentClass}"${ariaCurrent}>${label}</span>`);
    });
    return `<span class="cf-breadcrumb" aria-label="Current file location">${html.join('')}</span>`;
  };

  const bindCurrentFileBreadcrumbEvents = (el) => {
    if (!el || el.dataset.breadcrumbBound === '1') return;
    el.dataset.breadcrumbBound = '1';
    el.addEventListener('click', (event) => {
      const target = event.target && event.target.closest
        ? event.target.closest('[data-current-file-node-id]')
        : null;
      if (!target || !el.contains(target)) return;
      const nodeId = String(target.dataset.currentFileNodeId || '').trim();
      if (!nodeId) return;
      event.preventDefault();
      emitBreadcrumbSelect({
        nodeId,
        path: target.dataset.currentFilePath || ''
      });
    });
  };

  const notifyRendered = () => {
    try { onRendered(currentFileInfo); } catch (_) {}
  };

  const render = () => {
    const path = currentFileInfo.path ? String(currentFileInfo.path) : '';
    applyEmptyState(!path);
    const el = ensureCurrentFileElement();
    if (!el) {
      notifyRendered();
      return;
    }
    if (!path) {
      el.textContent = '';
      el.removeAttribute('data-file-state');
      el.removeAttribute('data-last-checked');
      el.removeAttribute('title');
      el.removeAttribute('data-dirty');
      el.removeAttribute('data-draft-state');
      notifyRendered();
      return;
    }

    const status = currentFileInfo.status || null;
    const dirty = !!currentFileInfo.dirty;
    const draft = currentFileInfo.draft;
    const draftState = currentFileInfo.draftState || '';
    const statusLabel = describeStatusLabel(status);
    const meta = formatStatusMeta(status);
    const mainPieces = [];
    const breadcrumbLabel = (currentFileInfo.breadcrumb || [])
      .map(item => item && item.label ? String(item.label) : '')
      .filter(Boolean)
      .join('/');
    mainPieces.push(renderCurrentFileBreadcrumb(currentFileInfo.breadcrumb, path));
    let draftLabel = '';
    if (draft && draft.hasContent) {
      if (Number.isFinite(draft.savedAt)) {
        const rel = formatRelativeTime(draft.savedAt);
        draftLabel = draft.conflict
          ? (rel
            ? translate('editor.currentFile.draft.savedConflictHtml', { time: escapeHtml(rel) })
            : translate('editor.currentFile.draft.conflict'))
          : (rel
            ? translate('editor.currentFile.draft.savedHtml', { time: escapeHtml(rel) })
            : translate('editor.currentFile.draft.saved'));
      } else {
        draftLabel = draft.conflict
          ? translate('editor.currentFile.draft.conflict')
          : translate('editor.currentFile.draft.available');
      }
      if (!draftLabel) draftLabel = '';
      mainPieces.push('<span class="cf-inline-separator" aria-hidden="true">·</span>');
      mainPieces.push(`<span class="cf-draft">${draftLabel}</span>`);
    }
    const mainHtml = `<span class="cf-line-main">${mainPieces.join('')}</span>`;

    el.innerHTML = mainHtml;
    bindCurrentFileBreadcrumbEvents(el);

    const tooltipParts = [breadcrumbLabel, path && path !== breadcrumbLabel ? path : '', statusLabel, meta, draftLabel]
      .map(part => getPlainText(part))
      .filter(Boolean);
    el.setAttribute('title', tooltipParts.join(' — '));
    if (status && status.state) el.setAttribute('data-file-state', status.state);
    else el.removeAttribute('data-file-state');
    if (status && Number.isFinite(status.checkedAt)) el.setAttribute('data-last-checked', String(status.checkedAt));
    else el.removeAttribute('data-last-checked');
    if (dirty) el.setAttribute('data-dirty', '1');
    else el.removeAttribute('data-dirty');
    if (draftState) el.setAttribute('data-draft-state', draftState);
    else el.removeAttribute('data-draft-state');
    notifyRendered();
  };

  const bindElement = (el) => {
    currentFileElRef = el || null;
    render();
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
