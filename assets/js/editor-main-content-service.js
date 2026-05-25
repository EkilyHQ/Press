import { configureFetchCachePolicy as configureFetchCachePolicyDefault } from './cache-control.js';
import { loadContentJsonWithRaw as loadContentJsonWithRawDefault } from './i18n.js';
import {
  fetchConfigWithYamlFallback as fetchConfigWithYamlFallbackDefault,
  fetchMergedSiteConfig as fetchMergedSiteConfigDefault
} from './yaml.js';

const noop = () => {};

function normalizeBaseDir(contentRoot, relPath) {
  const root = String(contentRoot || 'wwwroot').replace(/[\\]+/g, '/').replace(/\/?$/, '');
  const path = String(relPath || '').replace(/[\\]+/g, '/');
  const lastSlash = path.lastIndexOf('/');
  const dir = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '';
  return `${root}/${dir}`.replace(/[\\]+/g, '/');
}

export function createEditorMainContentService(options = {}) {
  const runtime = options.runtime || {};
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : () => 'wwwroot';
  const getPreviewSession = typeof options.getPreviewSession === 'function' ? options.getPreviewSession : () => null;
  const getDocumentSession = typeof options.getDocumentSession === 'function' ? options.getDocumentSession : () => null;
  const getWorkspaceSession = typeof options.getWorkspaceSession === 'function' ? options.getWorkspaceSession : () => null;
  const linkCardContext = options.linkCardContext || null;
  const fetchImpl = typeof options.fetch === 'function' ? options.fetch : null;
  const configureFetchCachePolicy = typeof options.configureFetchCachePolicy === 'function'
    ? options.configureFetchCachePolicy
    : configureFetchCachePolicyDefault;
  const fetchMergedSiteConfig = typeof options.fetchMergedSiteConfig === 'function'
    ? options.fetchMergedSiteConfig
    : fetchMergedSiteConfigDefault;
  const fetchConfigWithYamlFallback = typeof options.fetchConfigWithYamlFallback === 'function'
    ? options.fetchConfigWithYamlFallback
    : fetchConfigWithYamlFallbackDefault;
  const loadContentJsonWithRaw = typeof options.loadContentJsonWithRaw === 'function'
    ? options.loadContentJsonWithRaw
    : loadContentJsonWithRawDefault;
  const setCurrentFileLabel = typeof options.setCurrentFileLabel === 'function'
    ? options.setCurrentFileLabel
    : noop;
  const warn = typeof options.warn === 'function' ? options.warn : noop;
  const alert = typeof options.alert === 'function' ? options.alert : noop;

  let siteConfig = {};
  let detachSiteConfigChange = null;

  const getSiteConfig = () => siteConfig || {};

  const getDocument = () => getDocumentSession() || {};
  const getWorkspace = () => getWorkspaceSession() || {};

  const setBaseDir = (dir) => {
    const fallback = `${getContentRoot()}/`;
    if (runtime && typeof runtime.setEditorBaseDir === 'function') {
      return runtime.setEditorBaseDir(dir, fallback);
    }
    return dir || fallback;
  };

  const applySiteConfig = (nextSiteConfig) => {
    siteConfig = nextSiteConfig && typeof nextSiteConfig === 'object' ? nextSiteConfig : {};
    try { configureFetchCachePolicy(siteConfig, { context: 'editor' }); } catch (_) {}
    const previewSession = getPreviewSession();
    try {
      if (previewSession && typeof previewSession.handleSiteConfigChange === 'function') {
        previewSession.handleSiteConfigChange();
      }
    } catch (_) {}
    return siteConfig;
  };

  const bind = () => {
    if (detachSiteConfigChange || !runtime || typeof runtime.onSiteConfigChange !== 'function') {
      return detachSiteConfigChange || (() => {});
    }
    detachSiteConfigChange = runtime.onSiteConfigChange((event) => {
      const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : {};
      if (detail.siteConfig && typeof detail.siteConfig === 'object') {
        applySiteConfig(detail.siteConfig);
      }
    });
    return detachSiteConfigChange;
  };

  const loadSiteConfig = () => fetchMergedSiteConfig();

  const loadIndexData = (contentRoot) => loadContentJsonWithRaw(contentRoot, 'index');

  const loadTabsConfig = (contentRoot) => fetchConfigWithYamlFallback([
    `${contentRoot}/tabs.yaml`,
    `${contentRoot}/tabs.yml`
  ]);

  const handleSiteConfigLoaded = ({ siteConfig: nextSiteConfig, contentRoot } = {}) => {
    applySiteConfig(nextSiteConfig || {});
    const root = contentRoot || getContentRoot();
    if (runtime && typeof runtime.setContentRoot === 'function') runtime.setContentRoot(root);
    if (runtime && typeof runtime.setEditorBaseDir === 'function') {
      runtime.setEditorBaseDir(`${root}/`, `${root}/`);
    }
    return siteConfig;
  };

  const handleIndexLoaded = ({ posts, rawIndex } = {}) => {
    if (linkCardContext && typeof linkCardContext.rebuild === 'function') {
      linkCardContext.rebuild(posts, rawIndex);
    }
    if (linkCardContext && typeof linkCardContext.isReady === 'function' && linkCardContext.isReady()) {
      const documentSession = getDocument();
      try {
        if (typeof documentSession.refreshPreview === 'function') documentSession.refreshPreview();
      } catch (_) {}
    }
  };

  const openMarkdown = async ({ relPath, url, contentRoot } = {}) => {
    if (!fetchImpl) {
      throw new Error('Fetch unavailable');
    }
    const response = await fetchImpl(url, { cache: 'no-store' });
    if (!response || !response.ok) {
      throw new Error(`HTTP ${response ? response.status : 0}`);
    }
    const text = await response.text();
    try {
      setBaseDir(normalizeBaseDir(contentRoot, relPath));
    } catch (_) {
      setBaseDir(`${contentRoot || getContentRoot()}/`);
    }
    const documentSession = getDocument();
    if (documentSession && typeof documentSession.setValue === 'function') {
      documentSession.setValue(text);
    }
    setCurrentFileLabel(`${relPath || ''}`);
    const workspaceSession = getWorkspace();
    if (workspaceSession && typeof workspaceSession.setView === 'function') {
      workspaceSession.setView('edit');
    }
    if (runtime && typeof runtime.scrollToTop === 'function') {
      runtime.scrollToTop({ smooth: true });
    }
    return text;
  };

  return {
    bind,
    getSiteConfig,
    setBaseDir,
    applySiteConfig,
    loadSiteConfig,
    loadIndexData,
    loadTabsConfig,
    handleSiteConfigLoaded,
    handleIndexLoaded,
    openMarkdown,
    warn,
    alert
  };
}
