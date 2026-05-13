import { t, getAvailableLangs, getLanguageLabel, getCurrentLang, switchLanguage, ensureLanguageBundle } from './i18n.js?v=press-system-v3.4.8';
import { getThemeRegion } from './theme-regions.js';

const PACK_LINK_ID = 'theme-pack';
const THEME_CONTROLS_BOUND = Symbol('pressThemeControlsBound');
const THEME_CONTROLS_I18N_BOUND = Symbol('pressThemeControlsI18nBound');
const NATIVE_STYLE_CACHE_KEY = 'press-system-v3.4.8';
const THEME_PACK_KEY = 'themePack';
const THEME_PACK_PENDING_KEY = 'themePackPending';
const suppressedThemePacks = new Set();
let componentsReady = null;

function ensurePressComponents() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof customElements === 'undefined') return null;
  try {
    if (customElements.get('press-theme-controls')) return null;
  } catch (_) {
    return null;
  }
  if (!componentsReady) {
    componentsReady = import('./components.js').catch((err) => {
      console.warn('[theme] Failed to load press components', err);
      return null;
    });
  }
  return componentsReady;
}

// Restrict theme pack names to safe slug format and default to 'native'.
function sanitizePack(input) {
  const s = String(input || '').toLowerCase().trim();
  const clean = s.replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function getStoredPack(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? sanitizePack(raw) : '';
  } catch (_) {
    return '';
  }
}

function setStoredPack(key, pack) {
  try { localStorage.setItem(key, sanitizePack(pack)); } catch (_) {}
}

function removeStoredPack(key) {
  try { localStorage.removeItem(key); } catch (_) {}
}

function buildThemePackHref(pack, options = {}) {
  const baseHref = `assets/themes/${encodeURIComponent(pack)}/theme.css`;
  const cacheKey = pack === 'native'
    ? NATIVE_STYLE_CACHE_KEY
    : String(options.cacheKey || '').trim();
  return cacheKey ? `${baseHref}?v=${encodeURIComponent(cacheKey)}` : baseHref;
}

export function setThemePackStylesheet(name, options = {}) {
  const pack = sanitizePack(name);
  if (pack !== 'native' && suppressedThemePacks.has(pack) && options.allowSuppressed !== true) return '';
  const link = document.getElementById(PACK_LINK_ID);
  const href = buildThemePackHref(pack, options);
  if (link) link.setAttribute('href', href);
  try { window.__themePackHref = href; } catch (_) {}
  return href;
}

export function loadThemePack(name) {
  const pack = sanitizePack(name);
  setStoredPack(THEME_PACK_KEY, pack);
  removeStoredPack(THEME_PACK_PENDING_KEY);
  suppressedThemePacks.delete(pack);
  setThemePackStylesheet(pack, { allowSuppressed: true });
}

export function getSavedThemePack() {
  return getStoredPack(THEME_PACK_KEY) || 'native';
}

export function getPendingThemePack() {
  return getStoredPack(THEME_PACK_PENDING_KEY) || '';
}

export function getRequestedThemePack() {
  const pending = getPendingThemePack();
  if (pending) return pending;
  const saved = getSavedThemePack();
  if (saved !== 'native' && suppressedThemePacks.has(saved)) return 'native';
  return saved;
}

function getThemeControlPack() {
  const pending = getPendingThemePack();
  if (pending && !suppressedThemePacks.has(pending)) return pending;
  const saved = getSavedThemePack();
  if (saved !== 'native' && suppressedThemePacks.has(saved)) return 'native';
  return saved;
}

export function requestThemePackSwitch(name) {
  const pack = sanitizePack(name);
  suppressedThemePacks.delete(pack);
  setStoredPack(THEME_PACK_PENDING_KEY, pack);
}

export function commitThemePack(name, options = {}) {
  const pack = sanitizePack(name);
  suppressedThemePacks.delete(pack);
  setStoredPack(THEME_PACK_KEY, pack);
  const pending = getPendingThemePack();
  if (!pending || pending === pack || options.clearPending !== false) removeStoredPack(THEME_PACK_PENDING_KEY);
  if (options.applyStyles !== false) {
    setThemePackStylesheet(pack, { ...options, allowSuppressed: true });
  }
}

export function clearPendingThemePack(name) {
  const pending = getPendingThemePack();
  if (!pending) return;
  if (!name || pending === sanitizePack(name)) removeStoredPack(THEME_PACK_PENDING_KEY);
}

export function suppressThemePack(name) {
  const pack = sanitizePack(name);
  if (pack !== 'native') suppressedThemePacks.add(pack);
}

export function isThemePackSuppressed(name) {
  const pack = sanitizePack(name);
  return pack !== 'native' && suppressedThemePacks.has(pack);
}

function storeConfiguredThemePack(pack) {
  if (!pack || isThemePackSuppressed(pack)) return;
  setStoredPack(THEME_PACK_KEY, pack);
  removeStoredPack(THEME_PACK_PENDING_KEY);
  if (pack === 'native') setThemePackStylesheet(pack);
}

export function applySavedTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (saved === 'light') document.documentElement.removeAttribute('data-theme');
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (_) { /* ignore */ }
  const pack = getRequestedThemePack();
  if (pack === 'native') setThemePackStylesheet(pack);
}

// Apply theme according to site config. When override = true, it forces the
// site-defined values and updates localStorage to keep UI in sync.
export function applyThemeConfig(siteConfig) {
  const cfg = siteConfig || {};
  const override = cfg.themeOverride !== false; // default true
  const mode = (cfg.themeMode || '').toLowerCase(); // 'dark' | 'light' | 'auto' | 'user'
  const pack = sanitizePack(cfg.themePack);

  const setMode = (m) => {
    if (m === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('theme', 'dark'); } catch (_) {}
    } else if (m === 'light') {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem('theme', 'light'); } catch (_) {}
    } else { // auto
      // Remove explicit choice to allow system preference to drive
      try { localStorage.removeItem('theme'); } catch (_) {}
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  };

  if (override) {
    if (mode === 'dark' || mode === 'light' || mode === 'auto') setMode(mode);
    else if (mode === 'user') {
      // Respect user choice entirely; if none, fall back to system preference
      applySavedTheme();
    }
    if (pack) {
      storeConfiguredThemePack(pack);
    }
  } else {
    // Respect user choice; but if site provides a default and no user choice exists,
    // apply it once without persisting as an override
    const hasUserTheme = (() => { try { return !!localStorage.getItem('theme'); } catch (_) { return false; } })();
    const hasUserPack = (() => {
      try { return !!localStorage.getItem(THEME_PACK_KEY) || !!getPendingThemePack(); }
      catch (_) { return false; }
    })();
    if (!hasUserTheme) {
      if (mode === 'dark' || mode === 'light' || mode === 'auto') setMode(mode);
      // When mode is 'user' and there's no saved user theme, do nothing here;
      // the boot code/applySavedTheme already applied system preference as a soft default.
    }
    if (!hasUserPack && pack) storeConfiguredThemePack(pack);
  }
}

export function bindThemeToggle() {
  if (document.querySelector('press-theme-controls')) return;
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const setDark = (on) => {
    if (on) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('theme', on ? 'dark' : 'light'); } catch (_) {}
  };
  btn.addEventListener('click', () => setDark(!isDark()));
}

export function bindPostEditor() {
  if (document.querySelector('press-theme-controls')) return;
  const btn = document.getElementById('postEditor');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const editorUrl = 'index_editor.html';
    let popup = null;
    try {
      popup = window.open(editorUrl, '_blank');
    } catch (_) {
      popup = null;
    }
    if (!popup) {
      window.location.href = editorUrl;
      return;
    }
    try { popup.opener = null; } catch (_) {}
    try { popup.focus(); } catch (_) {}
  });
}

export function bindThemePackPicker() {
  if (document.querySelector('press-theme-controls')) return;
  const sel = document.getElementById('themePack');
  if (!sel) return;
  // Initialize selection
  const saved = getThemeControlPack();
  sel.value = saved;
  sel.addEventListener('change', () => {
    const val = sanitizePack(sel.value) || 'native';
    const current = getThemeControlPack();
    if (val === current && !isThemePackSuppressed(val)) return;
    requestThemePackSwitch(val);
    try { window.location.reload(); } catch (_) {}
  });
}

function getThemeControlsElement(root = document) {
  return root && root.querySelector ? root.querySelector('press-theme-controls') : null;
}

function getThemeControlLabels() {
  return {
    sectionTitle: t('tools.sectionTitle'),
    toggleTheme: t('tools.toggleTheme'),
    postEditor: t('tools.postEditor'),
    themePack: t('tools.themePack'),
    language: t('tools.language'),
    resetLanguage: t('tools.resetLanguage')
  };
}

function normalizePackList(list) {
  const out = [];
  const seen = new Set();
  const lists = Array.isArray(list) && Array.isArray(list[0]) ? list : [list];
  lists.forEach((items) => {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item) return;
      const value = sanitizePack(item.value || item.slug || item.name);
      if (!value || seen.has(value)) return;
      out.push({ value, label: String(item.label || item.name || value) });
      seen.add(value);
    });
  });
  if (!out.length) out.push({ value: 'native', label: 'Native' });
  return out;
}

function fetchThemePackList(path, optional = false) {
  return fetch(path, { cache: 'no-store' })
    .then(r => {
      if (r && r.ok) return r.json();
      if (optional) return [];
      return Promise.reject(new Error(`Unable to load ${path}`));
    })
    .catch((err) => {
      if (optional) return [];
      throw err;
    });
}

function getLanguageOptions() {
  try { ensureLanguageBundle(getCurrentLang()).catch(() => {}); } catch (_) {}
  return getAvailableLangs().map(code => ({
    value: code,
    label: getLanguageLabel(code)
  }));
}

function refreshThemeControlsLanguages(component) {
  if (!component || typeof component.setLanguages !== 'function') return;
  try { component.setLabels(getThemeControlLabels()); } catch (_) {}
  try { component.setLanguages(getLanguageOptions(), getCurrentLang()); } catch (_) {}
}

function openPostEditor() {
  const editorUrl = 'index_editor.html';
  let popup = null;
  try {
    popup = window.open(editorUrl, '_blank');
  } catch (_) {
    popup = null;
  }
  if (!popup) {
    window.location.href = editorUrl;
    return;
  }
  try { popup.opener = null; } catch (_) {}
  try { popup.focus(); } catch (_) {}
}

function bindThemeControlsComponent(component) {
  if (!component || component[THEME_CONTROLS_BOUND]) return;
  component[THEME_CONTROLS_BOUND] = true;
  if (!component[THEME_CONTROLS_I18N_BOUND] && typeof window !== 'undefined') {
    component[THEME_CONTROLS_I18N_BOUND] = true;
    window.addEventListener('ns:i18n-bundle-loaded', () => {
      try {
        if (!component.isConnected) return;
        refreshThemeControlsLanguages(component);
      } catch (_) {}
    });
  }
  component.addEventListener('press:theme-toggle', () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (dark) document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('theme', dark ? 'light' : 'dark'); } catch (_) {}
  });
  component.addEventListener('press:open-editor', () => openPostEditor());
  component.addEventListener('press:theme-pack-change', (event) => {
    const detail = event && event.detail ? event.detail : {};
    const val = sanitizePack(detail.value) || 'native';
    const current = getThemeControlPack();
    if (val === current && !isThemePackSuppressed(val)) return;
    requestThemePackSwitch(val);
    try { window.location.reload(); } catch (_) {}
  });
  component.addEventListener('press:language-change', async (event) => {
    const detail = event && event.detail ? event.detail : {};
    const val = detail.value || 'en';
    try { await ensureLanguageBundle(val); } catch (_) {}
    switchLanguage(val);
  });
  component.addEventListener('press:language-reset', () => {
    try { localStorage.removeItem('lang'); } catch (_) {}
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('lang');
      history.replaceState(history.state, document.title, url.toString());
    } catch (_) {}
    try {
      if (window.__press_softResetLang) {
        window.__press_softResetLang();
        return;
      }
    } catch (_) {}
    try { window.location.reload(); } catch (_) {}
  });
}

function populateThemeControls(component) {
  if (!component) return;
  refreshThemeControlsLanguages(component);
  try {
    ensureLanguageBundle(getCurrentLang())
      .then(() => { refreshThemeControlsLanguages(component); })
      .catch(() => {});
  } catch (_) {}
  try {
    Promise.all([
      fetchThemePackList('assets/themes/packs.json'),
      fetchThemePackList('assets/themes/packs.local.json', true)
    ])
      .then(lists => {
        component.setThemePacks(normalizePackList(lists), getThemeControlPack());
      })
      .catch(() => {
        component.setThemePacks(normalizePackList([
          { value: 'native', label: 'Native' }
        ]), getThemeControlPack());
      });
  } catch (_) {
    component.setThemePacks(normalizePackList([
      { value: 'native', label: 'Native' }
    ]), getThemeControlPack());
  }
}

// Render theme tools UI through <press-theme-controls>. Options are sourced from
// assets/themes/packs.json; legacy button/select binders remain below for older
// custom themes that have not migrated yet.
export function mountThemeControls(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const variant = String(opts.variant || document.body.dataset.themeLayout || 'native').toLowerCase();
  const componentImport = ensurePressComponents();
  let component = null;
  const host = opts.host || null;

  if (host && host.matches && host.matches('press-theme-controls')) {
    component = host;
  } else if (host && host.querySelector) {
    component = host.querySelector('press-theme-controls');
    if (!component) {
      host.textContent = '';
      component = document.createElement('press-theme-controls');
      host.appendChild(component);
    }
  } else {
    component = getThemeControlsElement(document);
    if (!component) {
      const legacyTools = document.getElementById('tools');
      if (legacyTools && legacyTools.parentElement) {
        component = document.createElement('press-theme-controls');
        legacyTools.parentElement.replaceChild(component, legacyTools);
      }
    }
    if (!component) {
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return null;
      component = document.createElement('press-theme-controls');
      const toc = getThemeRegion('toc');
      if (toc && toc.parentElement === sidebar) sidebar.insertBefore(component, toc);
      else sidebar.appendChild(component);
    }
  }

  const finish = () => {
    component.setAttribute('variant', variant);
    const upgraded = typeof component.render === 'function' && typeof component.setLabels === 'function';
    if (!upgraded && componentImport) return;
    try { if (typeof component.render === 'function') component.render(); } catch (_) {}
    bindThemeControlsComponent(component);
    if (upgraded) populateThemeControls(component);
  };
  finish();
  if (componentImport && typeof componentImport.then === 'function') {
    componentImport.then(() => {
      try { finish(); } catch (_) {}
    });
  }
  return component;
}

// Rebuild language selector options based on supported UI languages
export function refreshLanguageSelector() {
  const component = getThemeControlsElement(document);
  if (component && typeof component.setLanguages === 'function') {
    try {
      refreshThemeControlsLanguages(component);
      component.setCurrentPack(getSavedThemePack());
      return;
    } catch (_) {}
  }
  const sel = document.getElementById('langSelect');
  if (!sel) return;
  const current = getCurrentLang();
  const langs = getAvailableLangs();
  sel.innerHTML = '';
  langs.forEach(code => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = getLanguageLabel(code);
    sel.appendChild(opt);
  });
  sel.value = current;
}

try {
  window.addEventListener('ns:i18n-bundle-loaded', (event) => {
    const sel = document.getElementById('langSelect');
    if (!sel) return;
    const detail = event && event.detail ? event.detail : {};
    const lang = (detail.lang || '').toLowerCase();
    if (!lang) return;
    const current = (getCurrentLang && getCurrentLang()) || '';
    if ((sel.value && sel.value.toLowerCase() === lang) || (current && current.toLowerCase() === lang)) {
      try { refreshLanguageSelector(); } catch (_) {}
    }
  });
} catch (_) {}
