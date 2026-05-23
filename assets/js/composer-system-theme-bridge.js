import { initSystemUpdates, getSystemUpdateSummaryEntries, getSystemUpdateCommitFiles, clearSystemUpdateState } from './system-updates.js?v=press-system-v3.4.49';
import { initThemeManager, getThemeManagerSummaryEntries, getThemeManagerCommitFiles, clearThemeManagerState } from './theme-manager.js?v=press-system-v3.4.49';

export function createComposerSystemThemeBridge(options = {}) {
  const consoleRef = options.consoleRef || console;
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : (() => ({}));
  const setStateSlice = typeof options.setStateSlice === 'function' ? options.setStateSlice : (() => {});
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : (() => {});
  const updateUnsyncedSummary = typeof options.updateUnsyncedSummary === 'function' ? options.updateUnsyncedSummary : (() => {});
  const refreshEditorContentTree = typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : (() => {});

  function getSystemSummaryEntries() {
    return getSystemUpdateSummaryEntries().map(entry => ({ ...entry, kind: 'system' }));
  }

  function getThemeSummaryEntries() {
    return getThemeManagerSummaryEntries().map(entry => ({ ...entry, kind: 'system', category: 'theme' }));
  }

  function getSystemCommitFiles() {
    return getSystemUpdateCommitFiles().map(entry => ({ ...entry, kind: 'system' }));
  }

  function getThemeCommitFiles() {
    return getThemeManagerCommitFiles().map(entry => ({ ...entry, kind: 'system', category: 'theme' }));
  }

  function registerStagingProviders(stagingRegistry) {
    if (!stagingRegistry || typeof stagingRegistry.registerStagingProvider !== 'function') return;
    stagingRegistry.registerStagingProvider({
      id: 'system-updates',
      getSummaryEntries: getSystemSummaryEntries,
      getCommitFiles: getSystemCommitFiles,
      clear: () => clearSystemUpdateState({ keepStatus: false })
    });
    stagingRegistry.registerStagingProvider({
      id: 'themes',
      getSummaryEntries: getThemeSummaryEntries,
      getCommitFiles: getThemeCommitFiles,
      clear: () => clearThemeManagerState({ keepStatus: false, keepRegistryCache: true, keepSiteThemeFallback: true })
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
    try {
      initSystemUpdates({ onStateChange: refreshUnsyncedSummary });
    } catch (err) {
      consoleRef.error('Failed to initialize system updates module', err);
    }
    try {
      initThemeManager({
        onStateChange: refreshThemeState,
        getCurrentThemePack,
        setSiteThemePack
      });
    } catch (err) {
      consoleRef.error('Failed to initialize theme manager module', err);
    }
  }

  function hasSystemUpdateEntries() {
    return getSystemUpdateSummaryEntries().length > 0;
  }

  function hasThemeEntries() {
    return getThemeManagerSummaryEntries().length > 0;
  }

  return {
    init,
    registerStagingProviders,
    hasSystemUpdateEntries,
    hasThemeEntries,
    getSystemSummaryEntries,
    getThemeSummaryEntries,
    getSystemCommitFiles,
    getThemeCommitFiles
  };
}
