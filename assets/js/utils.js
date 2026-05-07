import { getContentRoot } from './safe-html.js';

export {
  getContentRoot,
  sanitizeUrl,
  sanitizeImageUrl,
  resolveImageSrc,
  setSafeHtml
} from './safe-html.js';

// General utilities.
export function escapeHtml(text) {
  return typeof text === 'string'
    ? text
        .replace(/&(?!#[0-9]+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    : null;
}

export function escapeMarkdown(text) {
  const parts = String(text || '').replace(/\\`/g, '&#096;').split('`');
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const seg = parts[i]
        .replace(/\\\\/g, '&#092;')
        .replace(/\\\*/g, '&#042;')
        .replace(/\\_/g, '&#095;')
        .replace(/\\{/g, '&#123;').replace(/\\}/g, '&#125;')
        .replace(/\\\[/g, '&#091;').replace(/\\\]/g, '&#093;')
        .replace(/\\\(/g, '&#040;').replace(/\\\)/g, '&#041;')
        .replace(/\\#/g, '&#035;')
        .replace(/\\\+/g, '&#043;')
        .replace(/\\-/g, '&#045;')
        .replace(/\\\./g, '&#046;')
        .replace(/\\!/g, '&#033;')
        .replace(/\\\|/g, '&#124;');
      result += seg;
    } else {
      result += parts[i];
    }
    if (i < parts.length - 1) result += '`';
  }
  return result;
}
export function getQueryVariable(variable) {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(variable);
  return value !== null ? decodeURIComponent(value) : null;
}

let baseSiteTitle = (() => {
  const t = document.title || 'Press';
  return (t && String(t).trim()) || 'Press';
})();

export function setBaseSiteTitle(title) {
  const next = (title && String(title).trim()) || null;
  baseSiteTitle = next || baseSiteTitle || 'Press';
}

export function setDocTitle(title) {
  if (title && String(title).trim()) document.title = `${String(title).trim()} · ${baseSiteTitle}`;
  else document.title = baseSiteTitle;
}

export function cardImageSrc(p) {
  const s = String(p || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return getContentRoot() + '/' + s.replace(/^\/+/, '');
}

export function fallbackCover(title) {
  const t = String(title || '').trim();
  const initial = t ? escapeHtml(t[0].toUpperCase()) : '?';
  const palette = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#f87171', '#10b981', '#fb7185'];
  let sum = 0;
  for (let i = 0; i < t.length; i++) sum = (sum + t.charCodeAt(i)) % 9973;
  const color = palette[sum % palette.length];
  return `<div class=\"card-cover-wrap card-fallback\" style=\"--cover-bg:${color}\"><span class=\"cover-initial\">${initial}</span></div>`;
}

export function renderTags(tagVal) {
  if (!tagVal && tagVal !== 0) return '';
  let tags = [];
  if (Array.isArray(tagVal)) tags = tagVal;
  else if (typeof tagVal === 'string') tags = tagVal.split(',');
  else tags = [String(tagVal)];
  tags = tags.map(t => String(t).trim()).filter(Boolean);
  if (!tags.length) return '';
  return `<div class=\"tags\">${tags.map(t => `<span class=\"tag\">${escapeHtml(t)}</span>`).join('')}</div>`;
}

// Generate a slug for tab titles. Works for non-Latin scripts by
// hashing when ASCII slug would be empty.
export const slugifyTab = (s) => {
  const src = String(s || '').trim();
  const ascii = src.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii;
  // Fallback: stable hash-based slug for non-ASCII titles
  let hash = 0;
  for (let i = 0; i < src.length; i++) { hash = ((hash << 5) - hash) + src.charCodeAt(i); hash |= 0; }
  return 't-' + Math.abs(hash).toString(36);
};

// Format a date string for display; accepts ISO/"YYYY-MM-DD"/Date
export function formatDisplayDate(input) {
  if (!input && input !== 0) return '';
  try {
    const d = (input instanceof Date) ? input : new Date(String(input));
    if (isNaN(d.getTime())) return escapeHtml(String(input));
    const lang = (document.documentElement && document.documentElement.getAttribute('lang')) || undefined;
    return d.toLocaleDateString(lang || undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return escapeHtml(String(input));
  }
}

// Human-readable byte size formatting (pure)
export function formatBytes(n) {
  if (!n && n !== 0) return '';
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

// Lightweight article skeleton markup (pure)
export function renderSkeletonArticle() {
  return `
    <div class="skeleton-article" aria-busy="true" aria-live="polite">
      <div class="skeleton-block skeleton-title w-70"></div>
      <div class="skeleton-block skeleton-line w-95"></div>
      <div class="skeleton-block skeleton-line w-90"></div>
      <div class="skeleton-block skeleton-line w-85"></div>
      <div class="skeleton-block skeleton-line w-40"></div>
      <div class="skeleton-block skeleton-image w-100"></div>
      <div class="skeleton-block skeleton-line w-90"></div>
      <div class="skeleton-block skeleton-line w-95"></div>
      <div class="skeleton-block skeleton-line w-80"></div>
      <div class="skeleton-block skeleton-line w-60"></div>
      <div style="margin: 1.25rem 0;">
        <div class="skeleton-block skeleton-line w-30" style="height: 1.25rem; margin-bottom: 0.75rem;"></div>
        <div class="skeleton-block skeleton-line w-85"></div>
        <div class="skeleton-block skeleton-line w-75"></div>
        <div class="skeleton-block skeleton-line w-90"></div>
      </div>
      <div class="skeleton-block skeleton-line w-95"></div>
      <div class="skeleton-block skeleton-line w-80"></div>
      <div class="skeleton-block skeleton-line w-45"></div>
    </div>`;
}

// Check if a click is modified (meta/ctrl/shift/alt or non-left button) (pure)
export function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}
