import { createSystemUpdatesController } from './system-updates.js';
import { createThemeManagerController } from './theme-manager.js';

export function createComposerSystemThemeBridge(options = {}) {
  const consoleRef = options.consoleRef || null;
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : (() => ({}));
  const setStateSlice = typeof options.setStateSlice === 'function' ? options.setStateSlice : (() => {});
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : (() => {});
  const updateUnsyncedSummary = typeof options.updateUnsyncedSummary === 'function' ? options.updateUnsyncedSummary : (() => {});
  const refreshEditorContentTree = typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : (() => {});
  const systemUpdates = options.systemUpdatesController || createSystemUpdatesController();
  const themeManager = options.themeManagerController || createThemeManagerController();
  let initialized = false;

  function getSystemSummaryEntries() {
    return systemUpdates.getSummaryEntries().map(entry => ({ ...entry, kind: 'system' }));
  }

  function getThemeSummaryEntries() {
    return themeManager.getSummaryEntries().map(entry => ({ ...entry, kind: 'system', category: 'theme' }));
  }

  function getSystemCommitFiles() {
    return systemUpdates.getCommitFiles().map(entry => ({ ...entry, kind: 'system' }));
  }

  function getThemeCommitFiles() {
    return themeManager.getCommitFiles().map(entry => ({ ...entry, kind: 'system', category: 'theme' }));
  }

  function registerStagingProviders(stagingRegistry) {
    if (!stagingRegistry || typeof stagingRegistry.registerStagingProvider !== 'function') return;
    stagingRegistry.registerStagingProvider({
      id: 'system-updates',
      getSummaryEntries: getSystemSummaryEntries,
      getCommitFiles: getSystemCommitFiles,
      clear: () => systemUpdates.clear({ keepStatus: false })
    });
    stagingRegistry.registerStagingProvider({
      id: 'themes',
      getSummaryEntries: getThemeSummaryEntries,
      getCommitFiles: getThemeCommitFiles,
      clear: () => themeManager.clear({ keepStatus: false, keepRegistryCache: true, keepSiteThemeFallback: true })
    });
  }

  function refreshUnsyncedSummary() {
    try { updateUnsyncedSummary(); } catch (_) {}
  }

  function refreshThemeState() {
    refreshUnsyncedSummary();
    try { refreshEditorContentTree({ preserveStructure: true }); } catch (_) {}
  }

  function getCurrentThemePack() {
    const site = getStateSlice('site') || {};
    return site.themePack || 'native';
  }

  function setSiteThemePack(value) {
    const site = getStateSlice('site') || {};
    site.themePack = value || 'native';
    setStateSlice('site', site);
    notifyComposerChange('site');
  }

  function init() {
    if (initialized) return true;
    initialized = true;
    try {
      systemUpdates.init({ onStateChange: refreshUnsyncedSummary });
    } catch (err) {
      if (consoleRef && typeof consoleRef.error === 'function') {
        consoleRef.error('Failed to initialize system updates module', err);
      }
    }
    try {
      themeManager.init({
        onStateChange: refreshThemeState,
        getCurrentThemePack,
        setSiteThemePack
      });
    } catch (err) {
      if (consoleRef && typeof consoleRef.error === 'function') {
        consoleRef.error('Failed to initialize theme manager module', err);
      }
    }
    return true;
  }

  function dispose() {
    initialized = false;
    try {
      if (systemUpdates && typeof systemUpdates.dispose === 'function') systemUpdates.dispose();
    } catch (_) {}
    try {
      if (themeManager && typeof themeManager.dispose === 'function') themeManager.dispose();
    } catch (_) {}
    return true;
  }

  function createLifecycleFeature() {
    return {
      name: 'composer.systemThemeBridge',
      requires: ['composerWorkspace'],
      provides: ['systemThemeBridge'],
      start(context) {
        init();
        context.systemThemeBridge = api;
      },
      dispose
    };
  }

  function hasSystemUpdateEntries() {
    return systemUpdates.getSummaryEntries().length > 0;
  }

  function hasThemeEntries() {
    return themeManager.getSummaryEntries().length > 0;
  }

  const api = {
    init,
    dispose,
    createLifecycleFeature,
    registerStagingProviders,
    hasSystemUpdateEntries,
    hasThemeEntries,
    getSystemSummaryEntries,
    getThemeSummaryEntries,
    getSystemCommitFiles,
    getThemeCommitFiles
  };
  return api;
}
