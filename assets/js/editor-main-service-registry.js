const SERVICE_NAMES = [
  'blocksSession',
  'contentService',
  'currentFileSession',
  'documentSession',
  'imageSession',
  'metadataPanel',
  'previewSession',
  'toolbarSession',
  'workspaceSession'
];

function createEmptyServices() {
  return SERVICE_NAMES.reduce((result, name) => {
    result[name] = null;
    return result;
  }, {});
}

export function createEditorMainServiceRegistry() {
  const services = createEmptyServices();

  const get = (name) => services[name] || null;
  const set = (name, service) => {
    services[name] = service || null;
    return services[name];
  };

  const call = (name, method, fallback, ...args) => {
    const target = get(name);
    if (!target || typeof target[method] !== 'function') return fallback;
    try {
      const result = target[method](...args);
      return result === undefined ? fallback : result;
    } catch (_) {
      return fallback;
    }
  };

  const getBlocksEditor = () => call('blocksSession', 'getEditor', null);
  const getEditorValue = () => call('documentSession', 'getValue', '');
  const getSiteConfig = () => call('contentService', 'getSiteConfig', {});
  const notifyDocumentChange = () => call('documentSession', 'notifyChange', false);
  const syncBlocksFromSource = () => call('blocksSession', 'syncFromSource', false);

  return {
    getBlocksEditor,
    getBlocksSession: () => get('blocksSession'),
    getContentService: () => get('contentService'),
    getCurrentFileSession: () => get('currentFileSession'),
    getDocumentSession: () => get('documentSession'),
    getEditorValue,
    getImageSession: () => get('imageSession'),
    getMetadataPanel: () => get('metadataPanel'),
    getPreviewSession: () => get('previewSession'),
    getSiteConfig,
    getToolbarSession: () => get('toolbarSession'),
    getWorkspaceSession: () => get('workspaceSession'),
    notifyDocumentChange,
    setBlocksSession: (service) => set('blocksSession', service),
    setContentService: (service) => set('contentService', service),
    setCurrentFileSession: (service) => set('currentFileSession', service),
    setDocumentSession: (service) => set('documentSession', service),
    setImageSession: (service) => set('imageSession', service),
    setMetadataPanel: (service) => set('metadataPanel', service),
    setPreviewSession: (service) => set('previewSession', service),
    setToolbarSession: (service) => set('toolbarSession', service),
    setWorkspaceSession: (service) => set('workspaceSession', service),
    syncBlocksFromSource
  };
}
