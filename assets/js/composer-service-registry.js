const SERVICE_NAMES = [
  'markdownActionsUi',
  'markdownDraftController',
  'markdownLoader',
  'markdownSessionController',
  'markdownWorkspaceController',
  'modeController',
  'unsyncedSummaryController'
];

function createEmptyServices() {
  return SERVICE_NAMES.reduce((result, name) => {
    result[name] = null;
    return result;
  }, {});
}

function createMissingServiceError(label) {
  return new Error(`${label} is not initialized`);
}

export function createComposerServiceRegistry() {
  const services = createEmptyServices();

  const get = (name) => services[name] || null;
  const set = (name, service) => {
    services[name] = service || null;
    return services[name];
  };
  const requireService = (name, label) => {
    const service = get(name);
    if (!service) throw createMissingServiceError(label);
    return service;
  };
  const call = (name, method, fallback, ...args) => {
    const service = get(name);
    if (!service || typeof service[method] !== 'function') return fallback;
    const result = service[method](...args);
    return result === undefined ? fallback : result;
  };

  return {
    applyMode: (...args) => call('modeController', 'applyMode', false, ...args),
    getCurrentMode: () => call('modeController', 'getCurrentMode', null),
    getMarkdownActionsUi: () => requireService('markdownActionsUi', 'Markdown actions UI'),
    getMarkdownDraftController: () => requireService('markdownDraftController', 'Markdown draft controller'),
    getMarkdownLoader: () => requireService('markdownLoader', 'Markdown loader'),
    getMarkdownSessionController: () => requireService('markdownSessionController', 'Markdown session controller'),
    getMarkdownWorkspaceController: () => requireService('markdownWorkspaceController', 'Markdown workspace controller'),
    getUnsyncedSummaryController: () => requireService('unsyncedSummaryController', 'Unsynced summary controller'),
    setMarkdownActionsUi: (service) => set('markdownActionsUi', service),
    setMarkdownDraftController: (service) => set('markdownDraftController', service),
    setMarkdownLoader: (service) => set('markdownLoader', service),
    setMarkdownSessionController: (service) => set('markdownSessionController', service),
    setMarkdownWorkspaceController: (service) => set('markdownWorkspaceController', service),
    setModeController: (service) => set('modeController', service),
    setUnsyncedSummaryController: (service) => set('unsyncedSummaryController', service)
  };
}
