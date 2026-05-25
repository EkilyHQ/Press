import { COMPOSER_SERVICE_PLAN, COMPOSER_SERVICE_SLOTS } from './composer-app-services.js';

function createEmptyServices() {
  return COMPOSER_SERVICE_SLOTS.reduce((result, name) => {
    result[name] = null;
    return result;
  }, {});
}

function createMissingServiceError(label) {
  return new Error(`${label} is not initialized`);
}

export function createComposerServiceRegistry() {
  const services = createEmptyServices();
  const labelsBySlot = new Map(COMPOSER_SERVICE_PLAN.map(entry => [entry.slot, entry.label]));

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
    getMarkdownActionsUi: () => requireService('markdownActionsUi', labelsBySlot.get('markdownActionsUi')),
    getMarkdownDraftController: () => requireService('markdownDraftController', labelsBySlot.get('markdownDraftController')),
    getMarkdownLoader: () => requireService('markdownLoader', labelsBySlot.get('markdownLoader')),
    getMarkdownSessionController: () => requireService('markdownSessionController', labelsBySlot.get('markdownSessionController')),
    getMarkdownWorkspaceController: () => requireService('markdownWorkspaceController', labelsBySlot.get('markdownWorkspaceController')),
    getUnsyncedSummaryController: () => requireService('unsyncedSummaryController', labelsBySlot.get('unsyncedSummaryController')),
    setMarkdownActionsUi: (service) => set('markdownActionsUi', service),
    setMarkdownDraftController: (service) => set('markdownDraftController', service),
    setMarkdownLoader: (service) => set('markdownLoader', service),
    setMarkdownSessionController: (service) => set('markdownSessionController', service),
    setMarkdownWorkspaceController: (service) => set('markdownWorkspaceController', service),
    setModeController: (service) => set('modeController', service),
    setUnsyncedSummaryController: (service) => set('unsyncedSummaryController', service)
  };
}
