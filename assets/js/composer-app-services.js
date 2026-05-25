export const COMPOSER_SERVICE_PLAN = Object.freeze([
  Object.freeze({
    slot: 'markdownDraftController',
    setter: 'setMarkdownDraftController',
    getter: 'getMarkdownDraftController',
    label: 'Markdown draft controller',
    requires: []
  }),
  Object.freeze({
    slot: 'markdownLoader',
    setter: 'setMarkdownLoader',
    getter: 'getMarkdownLoader',
    label: 'Markdown loader',
    requires: ['markdownDraftController']
  }),
  Object.freeze({
    slot: 'markdownActionsUi',
    setter: 'setMarkdownActionsUi',
    getter: 'getMarkdownActionsUi',
    label: 'Markdown actions UI',
    requires: ['markdownDraftController', 'markdownLoader']
  }),
  Object.freeze({
    slot: 'markdownSessionController',
    setter: 'setMarkdownSessionController',
    getter: 'getMarkdownSessionController',
    label: 'Markdown session controller',
    requires: ['markdownDraftController', 'markdownLoader', 'markdownActionsUi']
  }),
  Object.freeze({
    slot: 'markdownWorkspaceController',
    setter: 'setMarkdownWorkspaceController',
    getter: 'getMarkdownWorkspaceController',
    label: 'Markdown workspace controller',
    requires: ['markdownSessionController', 'markdownActionsUi', 'markdownLoader']
  }),
  Object.freeze({
    slot: 'modeController',
    setter: 'setModeController',
    getter: 'getCurrentMode',
    label: 'Mode controller',
    requires: ['markdownWorkspaceController', 'markdownSessionController']
  }),
  Object.freeze({
    slot: 'unsyncedSummaryController',
    setter: 'setUnsyncedSummaryController',
    getter: 'getUnsyncedSummaryController',
    label: 'Unsynced summary controller',
    requires: ['modeController', 'markdownWorkspaceController', 'markdownDraftController']
  })
]);

export const COMPOSER_SERVICE_SLOTS = Object.freeze(COMPOSER_SERVICE_PLAN.map(item => item.slot));
const PLAN_BY_SETTER = new Map(COMPOSER_SERVICE_PLAN.map(item => [item.setter, item]));

function normalizePlan(plan = COMPOSER_SERVICE_PLAN) {
  const entries = Array.isArray(plan) ? plan : [];
  const slots = new Set();
  const setters = new Set();
  const normalized = entries.map((entry) => ({
    ...entry,
    slot: String(entry && entry.slot || '').trim(),
    setter: String(entry && entry.setter || '').trim(),
    label: String(entry && entry.label || '').trim(),
    requires: Array.isArray(entry && entry.requires)
      ? entry.requires.map(value => String(value || '').trim()).filter(Boolean)
      : []
  }));

  normalized.forEach((entry) => {
    if (!entry.slot || !entry.setter || !entry.label) {
      throw new Error('Composer service plan entries require slot, setter, and label');
    }
    if (slots.has(entry.slot)) throw new Error(`Duplicate composer service slot: ${entry.slot}`);
    if (setters.has(entry.setter)) throw new Error(`Duplicate composer service setter: ${entry.setter}`);
    slots.add(entry.slot);
    setters.add(entry.setter);
  });

  normalized.forEach((entry) => {
    entry.requires.forEach((slot) => {
      if (!slots.has(slot)) {
        throw new Error(`Composer service "${entry.slot}" requires unknown slot "${slot}"`);
      }
      if (slot === entry.slot) {
        throw new Error(`Composer service "${entry.slot}" cannot require itself`);
      }
    });
  });

  return normalized;
}

export function getComposerServiceLifecyclePlan() {
  return normalizePlan().map(entry => ({
    slot: entry.slot,
    setter: entry.setter,
    getter: entry.getter || '',
    label: entry.label,
    requires: [...entry.requires]
  }));
}

export function createComposerServiceLifecycle(registry, options = {}) {
  if (!registry || typeof registry !== 'object') {
    throw new Error('Composer service lifecycle requires a registry');
  }
  const appName = String(options.name || 'composer-services').trim() || 'composer-services';
  const plan = normalizePlan();
  const initialized = new Set();

  function register(setterName, service) {
    const entry = PLAN_BY_SETTER.get(setterName);
    if (!entry) throw new Error(`${appName}: unknown composer service setter "${setterName}"`);
    if (initialized.has(entry.slot)) {
      throw new Error(`${appName}: composer service "${entry.slot}" is already initialized`);
    }
    if (service === null || service === undefined) {
      throw new Error(`${appName}: composer service "${entry.slot}" cannot be null or undefined`);
    }
    entry.requires.forEach((slot) => {
      if (!initialized.has(slot)) {
        throw new Error(`${appName}: composer service "${entry.slot}" requires "${slot}" first`);
      }
    });
    const setter = registry[setterName];
    if (typeof setter !== 'function') {
      throw new Error(`${appName}: registry is missing setter "${setterName}"`);
    }
    const value = setter(service);
    if (value === null || value === undefined) {
      throw new Error(`${appName}: registry rejected composer service "${entry.slot}"`);
    }
    initialized.add(entry.slot);
    return value;
  }

  function assertReady() {
    const missing = plan
      .map(entry => entry.slot)
      .filter(slot => !initialized.has(slot));
    if (missing.length) {
      throw new Error(`${appName}: missing composer services: ${missing.join(', ')}`);
    }
    return true;
  }

  const lifecycle = {
    assertReady,
    getInitializedSlots: () => [...initialized],
    getPlan: getComposerServiceLifecyclePlan
  };

  plan.forEach((entry) => {
    lifecycle[entry.setter] = (service) => register(entry.setter, service);
  });

  return lifecycle;
}
