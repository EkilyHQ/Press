import { COMPOSER_SERVICE_PLAN, COMPOSER_SERVICE_SLOTS } from './composer-app-services.js';

export const COMPOSER_SERVICE_CALLS = Object.freeze({
  applyMode: Object.freeze({
    slot: 'modeController',
    method: 'applyMode',
    fallback: false
  }),
  getCurrentMode: Object.freeze({
    slot: 'modeController',
    method: 'getCurrentMode',
    fallback: null
  })
});

function createEmptyServices() {
  return COMPOSER_SERVICE_SLOTS.reduce((result, name) => {
    result[name] = null;
    return result;
  }, {});
}

function createMissingServiceError(label) {
  return new Error(`${label} is not initialized`);
}

function createDiagnostic(entry = {}, labelsBySlot = new Map()) {
  const slot = String(entry.slot || '');
  const method = String(entry.method || '');
  const label = labelsBySlot.get(slot) || slot || 'Composer service';
  const reason = String(entry.reason || 'contract');
  const message = entry.message
    ? String(entry.message)
    : `${label} service contract mismatch: ${method || 'unknown method'}.`;
  return {
    slot,
    method,
    reason,
    message
  };
}

export function createComposerServiceRegistry(options = {}) {
  const services = createEmptyServices();
  const labelsBySlot = new Map(COMPOSER_SERVICE_PLAN.map(entry => [entry.slot, entry.label]));
  const diagnostics = [];
  const onDiagnostic = typeof options.onDiagnostic === 'function' ? options.onDiagnostic : null;

  const emitDiagnostic = (entry) => {
    const diagnostic = createDiagnostic(entry, labelsBySlot);
    diagnostics.push(diagnostic);
    if (diagnostics.length > 50) diagnostics.shift();
    if (onDiagnostic) {
      try { onDiagnostic(diagnostic); } catch (_) {}
    }
    return diagnostic;
  };

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
  const call = (descriptor, ...args) => {
    const service = get(descriptor.slot);
    if (!service) return descriptor.fallback;
    if (typeof service[descriptor.method] !== 'function') {
      emitDiagnostic({
        slot: descriptor.slot,
        method: descriptor.method,
        reason: 'missingMethod'
      });
      return descriptor.fallback;
    }
    const result = service[descriptor.method](...args);
    return result === undefined ? descriptor.fallback : result;
  };

  return {
    applyMode: (...args) => call(COMPOSER_SERVICE_CALLS.applyMode, ...args),
    clearDiagnostics: () => {
      diagnostics.splice(0, diagnostics.length);
    },
    getCurrentMode: () => call(COMPOSER_SERVICE_CALLS.getCurrentMode),
    getDiagnostics: () => diagnostics.slice(),
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
