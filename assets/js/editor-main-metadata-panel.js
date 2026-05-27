import { createFrontMatterLabelWidthSync } from './editor-main-frontmatter-label-width.js';
import { createEditorMainFrontMatterManager } from './editor-main-frontmatter-manager.js';
import { createEditorMainTabsMetadataManager } from './editor-main-tabs-metadata-manager.js';

const fallbackTranslate = (key) => key;
const fallbackGetCurrentLang = () => 'en';
const fallbackNormalizeLangKey = (value) => String(value || '').trim().toLowerCase();
const fallbackGetContentRoot = () => 'wwwroot';

function fallbackElementById(documentRef, id) {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

export function createEditorMainMetadataPanel(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const getElementById = (id) => (
    typeof runtime.getElementById === 'function'
      ? runtime.getElementById(id)
      : fallbackElementById(documentRef, id)
  );
  const querySelector = (selector) => (
    documentRef && typeof documentRef.querySelector === 'function'
      ? documentRef.querySelector(selector)
      : null
  );
  const requestFrame = (fn) => (
    typeof runtime.requestFrame === 'function'
      ? runtime.requestFrame(fn)
      : 0
  );
  const cancelFrame = (id) => {
    if (!id) return;
    if (typeof runtime.cancelFrame === 'function') {
      runtime.cancelFrame(id);
      return;
    }
  };
  const translateImpl = typeof options.translate === 'function' ? options.translate : fallbackTranslate;
  const getCurrentLang = typeof options.getCurrentLang === 'function' ? options.getCurrentLang : fallbackGetCurrentLang;
  const normalizeLang = typeof options.normalizeLangKey === 'function' ? options.normalizeLangKey : fallbackNormalizeLangKey;
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : fallbackGetContentRoot;
  const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
  const getComputedStyleRef = typeof options.getComputedStyle === 'function'
    ? options.getComputedStyle
    : (typeof runtime.getComputedStyle === 'function' ? runtime.getComputedStyle : null);
  const ResizeObserverRef = options.ResizeObserver || (
    typeof runtime.getResizeObserver === 'function' ? runtime.getResizeObserver() : null
  );
  const frontMatterLabelWidthSync = createFrontMatterLabelWidthSync({
    documentRef,
    requestFrame,
    cancelFrame,
    getComputedStyle: getComputedStyleRef,
    ResizeObserver: ResizeObserverRef
  });
  const { syncFrontMatterLabelWidth } = frontMatterLabelWidthSync;

  const translate = (key, fallback) => {
    if (!key) return fallback;
    const translated = translateImpl(key);
    if (translated == null || translated === key) return fallback != null ? fallback : key;
    return translated;
  };

  const translateWithLocaleFallback = (key, fallbacks = {}) => {
    const translated = translate(key, null);
    if (translated != null && translated !== key) return translated;
    let lang;
    try {
      lang = normalizeLang(getCurrentLang()) || 'en';
    } catch (_) {
      lang = 'en';
    }
    if (fallbacks[lang]) return fallbacks[lang];
    if (lang === 'cht-hk' && fallbacks['cht-tw']) return fallbacks['cht-tw'];
    if (lang.startsWith('cht') && fallbacks['cht-tw']) return fallbacks['cht-tw'];
    if (lang.startsWith('ch') && fallbacks.chs) return fallbacks.chs;
    if (lang.startsWith('ja') && fallbacks.ja) return fallbacks.ja;
    return fallbacks.en || key;
  };

  const createFrontMatterManager = () => createEditorMainFrontMatterManager({
    documentRef,
    getElementById,
    querySelector,
    translate,
    translateWithLocaleFallback,
    syncLabelWidth: syncFrontMatterLabelWidth
  });

  const createTabsMetadataManager = () => {
    return createEditorMainTabsMetadataManager({
      documentRef,
      getElementById,
      translateWithLocaleFallback,
      syncLabelWidth: syncFrontMatterLabelWidth
    });
  };

  const frontMatterManager = createFrontMatterManager();
  const tabsMetadataManager = createTabsMetadataManager();
  const tabsMetadataChangeListeners = new Set();
  let frontMatterVisible = true;
  let tabsMetadataVisible = false;

  const updateMetadataPanelVisibility = () => {
    const panel = (frontMatterManager && frontMatterManager.panel) || (tabsMetadataManager && tabsMetadataManager.panel);
    if (!panel) return;
    const visible = !!frontMatterVisible || !!tabsMetadataVisible;
    panel.hidden = !visible;
    panel.dataset.state = visible ? 'ready' : 'hidden';
    panel.dataset.frontmatterVisible = frontMatterVisible ? 'true' : 'false';
    panel.dataset.tabsMetadataVisible = tabsMetadataVisible ? 'true' : 'false';
    panel.dataset.tabsVisible = tabsMetadataVisible ? 'true' : 'false';
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    panel.style.display = visible ? '' : 'none';
    if (tabsMetadataManager && typeof tabsMetadataManager.setVisible === 'function') {
      tabsMetadataManager.setVisible(tabsMetadataVisible);
    }
    syncFrontMatterLabelWidth(panel);
  };

  const normalizeCurrentFilePathForMode = (path) => {
    const raw = String(path || '').trim().replace(/\\+/g, '/').replace(/^\/+/, '');
    if (!raw) return '';
    const root = String(getContentRoot() || '')
      .trim()
      .replace(/\\+/g, '/')
      .replace(/^\/+|\/+$/g, '');
    if (root && raw.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
      return raw.slice(root.length + 1);
    }
    return raw;
  };

  const inferCurrentFileSource = (path) => {
    const normalized = normalizeCurrentFilePathForMode(path).toLowerCase();
    if (!normalized) return '';
    return normalized.startsWith('tab/') ? 'tabs' : '';
  };

  const setFrontMatterVisible = (visible) => {
    const nextVisible = !!visible;
    const shouldClear = !nextVisible && frontMatterVisible;
    frontMatterVisible = nextVisible;
    if (shouldClear && frontMatterManager && typeof frontMatterManager.clear === 'function') frontMatterManager.clear();
    const commonSection = getElementById('frontMatterCommonSection');
    const extraSection = getElementById('frontMatterExtraSection');
    if (commonSection) commonSection.hidden = !frontMatterVisible;
    if (extraSection) extraSection.hidden = !frontMatterVisible;
    updateMetadataPanelVisibility();
  };

  const setTabsMetadataVisible = (visible) => {
    tabsMetadataVisible = !!visible;
    updateMetadataPanelVisibility();
  };

  if (frontMatterManager) {
    frontMatterManager.setChangeHandler(() => {
      onChange();
    });
  }
  if (tabsMetadataManager) {
    tabsMetadataManager.setChangeHandler((value) => {
      tabsMetadataChangeListeners.forEach((fn) => {
        try { fn(value); } catch (_) {}
      });
    });
  }
  updateMetadataPanelVisibility();

  return {
    panel: (frontMatterManager && frontMatterManager.panel) || (tabsMetadataManager && tabsMetadataManager.panel) || null,
    frontMatterManager,
    tabsMetadataManager,
    inferCurrentFileSource,
    setFrontMatterVisible,
    setTabsMetadataVisible,
    applyCurrentFileSource: (source) => {
      const actual = String(source || '').trim().toLowerCase();
      setFrontMatterVisible(actual !== 'tabs');
      setTabsMetadataVisible(actual === 'tabs');
    },
    buildMarkdown: (body) => (frontMatterManager ? frontMatterManager.buildMarkdown(body) : body),
    buildEditorValue: (body) => (
      frontMatterVisible && frontMatterManager ? frontMatterManager.buildMarkdown(body) : body
    ),
    setEditorValue: (value, opts = {}) => (
      frontMatterVisible && frontMatterManager
        ? frontMatterManager.setFromMarkdown(value, opts)
        : String(value == null ? '' : value)
    ),
    syncLanguage: () => {
      if (!frontMatterManager) return;
      frontMatterManager.updateSummary();
      frontMatterManager.applySectionDescriptions();
      frontMatterManager.syncLabelWidth();
    },
    setTabsMetadata: (value, opts = {}) => {
      if (tabsMetadataManager && typeof tabsMetadataManager.setValue === 'function') {
        tabsMetadataManager.setValue(value, opts);
      }
    },
    onTabsMetadataChange: (fn) => {
      if (typeof fn !== 'function') return () => {};
      tabsMetadataChangeListeners.add(fn);
      return () => { tabsMetadataChangeListeners.delete(fn); };
    },
    isFrontMatterVisible: () => frontMatterVisible,
    isTabsMetadataVisible: () => tabsMetadataVisible
  };
}
