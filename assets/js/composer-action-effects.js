import { createComposerActionDispatcher } from './composer-action-dispatcher.js';

export const COMPOSER_ACTION_EFFECT_SERVICES = Object.freeze([
  'modeController',
  'filePanelController',
  'stateStore',
  'yamlDraftController',
  'diffUi',
  'siteConfigController',
  'unsyncedSummaryController',
  'orderPreview',
  'editorTree',
  'systemThemeBridge',
  'markdownDraftController',
  'publishStateService'
]);

export function createComposerActionEffects(options = {}) {
  const dispatch = createComposerActionDispatcher({
    handlers: {
      applyMode: ({ mode, options: actionOptions = {} }) => options.applyMode(mode, actionOptions),
      selectComposerFile: ({ name, options: actionOptions = {} }) => options.selectComposerFile(name, actionOptions),
      recomputeYamlDiff: ({ kind }) => options.recomputeYamlDiff(kind),
      applyYamlDiffMarkers: ({ kind }) => options.applyYamlDiffMarkers(kind),
      refreshFileDirtyBadges: () => options.refreshFileDirtyBadges(),
      scheduleYamlAutoDraft: ({ kind, options: actionOptions = {} }) => {
        if (!actionOptions.skipAutoSave) options.scheduleYamlAutoDraft(kind);
      },
      applySiteConfig: ({ kind }) => options.applySiteConfigForYamlChange(kind),
      refreshUnsyncedSummary: ({ options: actionOptions = {} }) => options.refreshUnsyncedSummary(actionOptions),
      refreshOrderPreview: ({ kind }) => options.refreshOrderPreviewForYamlChange(kind),
      refreshEditorTree: (payload, context) => {
        if (context && context.action && context.action.type === 'composer.yaml.changed') {
          options.refreshEditorTree({
            preserveStructure: options.shouldPreserveEditorStructureForMode(options.getCurrentMode())
          });
          return;
        }
        options.refreshEditorTree(payload && payload.options ? payload.options : {});
      },
      clearYamlDraftStorage: ({ kind }) => options.clearYamlDraftStorage(kind),
      applyLocalPostCommitState: ({ files = [] }) => options.applyLocalPostCommitState(files)
    },
    availableServices: COMPOSER_ACTION_EFFECT_SERVICES
  });

  return {
    dispatch,
    assertReady: () => dispatch.assertReady(),
    applyComposerFile: (name, actionOptions = {}) => dispatch.dispatch('composer.file.select', {
      name,
      options: { ...actionOptions, persist: false }
    }),
    applyLocalPostCommitState: (files = []) => dispatch.dispatch('publish.completed', { files }),
    applyMode: (mode, actionOptions = {}) => dispatch.dispatch('composer.mode.apply', { mode, options: actionOptions }),
    clearDraftStorage: (kind) => dispatch.dispatch('composer.yaml.draft.cleared', { kind }),
    notifyComposerChange: (kind, actionOptions = {}) => dispatch.dispatch('composer.yaml.changed', { kind, options: actionOptions }),
    refreshEditorContentTree: (actionOptions = {}) => dispatch.dispatch('editor.tree.refresh', { options: actionOptions }),
    refreshMarkdownDraftState: (actionOptions = {}) => dispatch.dispatch('markdown.draft.changed', { options: actionOptions }),
    refreshSystemThemeState: (actionOptions = {}) => dispatch.dispatch('composer.system-theme.changed', { options: actionOptions }),
    selectComposerFile: (name, actionOptions = {}) => dispatch.dispatch('composer.file.select', { name, options: actionOptions }),
    updateUnsyncedSummary: (actionOptions = {}) => dispatch.dispatch('composer.summary.refresh', { options: actionOptions })
  };
}
