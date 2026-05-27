export const COMPOSER_ACTION_PLAN = Object.freeze([
  Object.freeze({
    type: 'composer.mode.apply',
    label: 'Apply composer mode',
    requires: Object.freeze(['modeController']),
    effects: Object.freeze(['applyMode'])
  }),
  Object.freeze({
    type: 'composer.file.select',
    label: 'Select composer file panel',
    requires: Object.freeze(['filePanelController']),
    effects: Object.freeze(['selectComposerFile'])
  }),
  Object.freeze({
    type: 'composer.yaml.changed',
    label: 'Apply YAML composer state change',
    requires: Object.freeze([
      'stateStore',
      'yamlDraftController',
      'diffUi',
      'siteConfigController',
      'unsyncedSummaryController',
      'orderPreview',
      'editorTree'
    ]),
    effects: Object.freeze([
      'recomputeYamlDiff',
      'applyYamlDiffMarkers',
      'refreshFileDirtyBadges',
      'scheduleYamlAutoDraft',
      'applySiteConfig',
      'refreshUnsyncedSummary',
      'refreshOrderPreview',
      'refreshEditorTree'
    ])
  }),
  Object.freeze({
    type: 'composer.yaml.draft.cleared',
    label: 'Clear YAML draft state',
    requires: Object.freeze(['yamlDraftController', 'unsyncedSummaryController']),
    effects: Object.freeze(['clearYamlDraftStorage', 'refreshUnsyncedSummary'])
  }),
  Object.freeze({
    type: 'composer.summary.refresh',
    label: 'Refresh composer unsynced summary',
    requires: Object.freeze(['unsyncedSummaryController']),
    effects: Object.freeze(['refreshUnsyncedSummary'])
  }),
  Object.freeze({
    type: 'composer.system-theme.changed',
    label: 'Refresh system or theme staging state',
    requires: Object.freeze(['systemThemeBridge', 'unsyncedSummaryController', 'editorTree']),
    effects: Object.freeze(['refreshUnsyncedSummary', 'refreshEditorTree'])
  }),
  Object.freeze({
    type: 'editor.tree.refresh',
    label: 'Refresh editor tree',
    requires: Object.freeze(['editorTree']),
    effects: Object.freeze(['refreshEditorTree'])
  }),
  Object.freeze({
    type: 'markdown.draft.changed',
    label: 'Refresh Markdown draft state',
    requires: Object.freeze(['markdownDraftController', 'unsyncedSummaryController', 'editorTree']),
    effects: Object.freeze(['refreshUnsyncedSummary', 'refreshEditorTree'])
  }),
  Object.freeze({
    type: 'publish.completed',
    label: 'Apply completed publish state',
    requires: Object.freeze(['publishStateService']),
    effects: Object.freeze(['applyLocalPostCommitState'])
  })
]);

export const COMPOSER_ACTION_TYPES = Object.freeze(COMPOSER_ACTION_PLAN.map(action => action.type));

function normalizeList(value) {
  return Array.isArray(value)
    ? value.map(item => String(item || '').trim()).filter(Boolean)
    : [];
}

export function validateComposerActionPlan(plan = COMPOSER_ACTION_PLAN) {
  const failures = [];
  const actions = Array.isArray(plan) ? plan : [];
  const seenTypes = new Set();

  actions.forEach((action, index) => {
    const prefix = `composerActionPlan[${index}]`;
    const type = String(action && action.type || '').trim();
    const effects = normalizeList(action && action.effects);
    const requires = normalizeList(action && action.requires);
    if (!type) failures.push(`${prefix}.type is required`);
    else if (seenTypes.has(type)) failures.push(`${prefix}.type duplicates ${type}`);
    else seenTypes.add(type);
    if (!String(action && action.label || '').trim()) failures.push(`${prefix}.label is required`);
    if (!effects.length) failures.push(`${prefix}.effects must not be empty`);
    if (new Set(effects).size !== effects.length) failures.push(`${prefix}.effects contains duplicate entries`);
    if (new Set(requires).size !== requires.length) failures.push(`${prefix}.requires contains duplicate entries`);
  });

  return failures;
}

export function getComposerActionPlan() {
  return COMPOSER_ACTION_PLAN.map(action => ({
    type: action.type,
    label: action.label,
    requires: [...action.requires],
    effects: [...action.effects]
  }));
}

export function getComposerActionTypes() {
  return [...COMPOSER_ACTION_TYPES];
}
