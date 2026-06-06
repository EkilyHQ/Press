import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const composerSource = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');
const controllerGraphSource = readFileSync(resolve(here, '../assets/js/composer-controller-graph.js'), 'utf8');
const bridgeSource = readFileSync(resolve(here, '../assets/js/composer-system-theme-bridge.js'), 'utf8');

assert.match(
  composerSource,
  /from '\.\/composer-system-theme-bridge\.js'/,
  'composer should import the system/theme bridge through a managed runtime module'
);

assert.doesNotMatch(
  composerSource,
  /from '\.\/system-updates\.js\?v=|from '\.\/theme-manager\.js\?v=/,
  'composer should not import system-updates or theme-manager directly'
);

assert.match(
  composerSource,
  /registerExternalStagingProviders: \(registry\) => composerSystemThemeBridge\.registerStagingProviders\(registry\)/,
  'system/theme staging providers should be registered through the publish state service callback'
);

assert.doesNotMatch(
  composerSource,
  /stagingRegistry|composerSystemThemeBridge\.registerStagingProviders\(stagingRegistry\)/,
  'composer should not own the staging registry after publish state service extraction'
);

assert.match(
  composerSource,
  /composerSystemThemeBridge\.hasSystemUpdateEntries\(\)[\s\S]*composerSystemThemeBridge\.hasThemeEntries\(\)/,
  'editor tree system/theme dirty status should query the bridge'
);

assert.match(
  controllerGraphSource,
  /composerSystemThemeBridge\.createLifecycleFeature\(\)/,
  'system/theme module initialization should join the shared composer lifecycle as an explicit feature'
);

assert.match(
  bridgeSource,
  /import \{ createSystemUpdatesController \} from '\.\/system-updates\.js';/,
  'bridge should own the system updates controller factory import'
);

assert.match(
  bridgeSource,
  /import \{ createThemeManagerController \} from '\.\/theme-manager\.js';/,
  'bridge should own the theme manager controller factory import'
);

assert.doesNotMatch(
  bridgeSource,
  /import \{[^}]*initSystemUpdates|import \{[^}]*getSystemUpdateSummaryEntries|import \{[^}]*clearSystemUpdateState|import \{[^}]*initThemeManager|import \{[^}]*getThemeManagerSummaryEntries|import \{[^}]*clearThemeManagerState/,
  'bridge should not import singleton panel methods directly'
);

assert.match(
  bridgeSource,
  /const localStorageRef = options\.localStorageRef \|\| null;[\s\S]*const themeManager = options\.themeManagerController \|\| createThemeManagerController\(\);[\s\S]*const getStagedThemeCommitFiles = typeof options\.getStagedThemeCommitFiles === 'function'[\s\S]*const systemUpdates = options\.systemUpdatesController \|\| createSystemUpdatesController\(\{[\s\S]*localStorageRef,[\s\S]*getStagedThemeCommitFiles,[\s\S]*getCurrentThemePack[\s\S]*\}\);/,
  'bridge should bind explicit system and theme manager controller instances'
);

assert.match(
  bridgeSource,
  /id: 'system-updates'[\s\S]*getSummaryEntries: getSystemSummaryEntries[\s\S]*getCommitFiles: getSystemCommitFiles[\s\S]*systemUpdates\.clear\(\{ keepStatus: false \}\)/,
  'bridge should register the system update staging provider'
);

assert.match(
  bridgeSource,
  /id: 'themes'[\s\S]*getSummaryEntries: getThemeSummaryEntries[\s\S]*getCommitFiles: getThemeCommitFiles[\s\S]*themeManager\.clear\(\{ keepStatus: false, keepRegistryCache: true, keepSiteThemeFallback: true \}\)/,
  'bridge should register the theme staging provider with the existing clear options'
);

assert.match(
  bridgeSource,
  /systemUpdates\.init\(\{ onStateChange: refreshUnsyncedSummary \}\)[\s\S]*themeManager\.init\(\{[\s\S]*onStateChange: refreshThemeState,[\s\S]*getCurrentThemePack,[\s\S]*setSiteThemePack[\s\S]*\}\)/,
  'bridge should initialize system updates and theme manager with the existing callbacks'
);

assert.match(
  bridgeSource,
  /function createLifecycleFeature\(\) \{[\s\S]*name: 'composer\.systemThemeBridge'[\s\S]*requires: \['composerWorkspace'\][\s\S]*provides: \['systemThemeBridge'\][\s\S]*start\(context\) \{[\s\S]*init\(\);[\s\S]*context\.systemThemeBridge = api;/,
  'bridge should expose a lifecycle feature instead of relying on workspace UI binding side effects'
);

assert.doesNotMatch(
  bridgeSource,
  /\|\|\s*console\b/,
  'system/theme bridge should receive logging through explicit composer wiring'
);

globalThis.document = {
  title: 'Press',
  baseURI: 'https://example.test/',
  documentElement: { setAttribute() {} },
  getElementById: () => null,
  querySelectorAll: () => []
};
globalThis.window = {
  location: { href: 'https://example.test/', protocol: 'https:' },
  dispatchEvent() {}
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};

const { createComposerSystemThemeBridge } = await import('../assets/js/composer-system-theme-bridge.js?bridge-test');

let systemInitOptions = null;
let themeInitOptions = null;
const calls = [];
const state = { site: { themePack: 'arcus' } };
const bridge = createComposerSystemThemeBridge({
  systemUpdatesController: {
    init(options) {
      systemInitOptions = options;
      calls.push(['system-init']);
    },
    getSummaryEntries: () => [{ label: 'System runtime', path: 'assets/main.js' }],
    getCommitFiles: () => [{ path: 'assets/main.js', content: 'export {};' }],
    clear: (options) => calls.push(['system-clear', options]),
    dispose: () => calls.push(['system-dispose'])
  },
  themeManagerController: {
    init(options) {
      themeInitOptions = options;
      calls.push(['theme-init']);
    },
    getSummaryEntries: () => [{ label: 'Theme CSS', path: 'assets/themes/arcus/theme.css' }],
    getCommitFiles: () => [{ path: 'assets/themes/arcus/theme.css', content: ':root{}' }],
    clear: (options) => calls.push(['theme-clear', options]),
    dispose: () => calls.push(['theme-dispose'])
  },
  getStateSlice: (key) => state[key],
  setStateSlice: (key, value) => { state[key] = value; },
  notifyComposerChange: (key) => calls.push(['notify', key]),
  updateUnsyncedSummary: () => calls.push(['unsynced']),
  refreshEditorContentTree: (options) => calls.push(['tree', options])
});

assert.deepEqual(bridge.getSystemSummaryEntries(), [
  { label: 'System runtime', path: 'assets/main.js', kind: 'system' }
]);
assert.deepEqual(bridge.getThemeSummaryEntries(), [
  { label: 'Theme CSS', path: 'assets/themes/arcus/theme.css', kind: 'system', category: 'theme' }
]);
assert.deepEqual(bridge.getSystemCommitFiles(), [
  { path: 'assets/main.js', content: 'export {};', kind: 'system' }
]);
assert.deepEqual(bridge.getThemeCommitFiles(), [
  { path: 'assets/themes/arcus/theme.css', content: ':root{}', kind: 'system', category: 'theme' }
]);

const registeredProviders = [];
bridge.registerStagingProviders({
  registerStagingProvider(provider) {
    registeredProviders.push(provider);
  }
});
assert.equal(registeredProviders.length, 2);
registeredProviders[0].clear();
registeredProviders[1].clear();
assert.deepEqual(calls.slice(0, 2), [
  ['system-clear', { keepStatus: false }],
  ['theme-clear', { keepStatus: false, keepRegistryCache: true, keepSiteThemeFallback: true }]
]);

bridge.init();
bridge.init();
assert.equal(typeof systemInitOptions.onStateChange, 'function');
assert.equal(typeof themeInitOptions.onStateChange, 'function');
assert.equal(themeInitOptions.getCurrentThemePack(), 'arcus');
themeInitOptions.setSiteThemePack('solstice');
assert.equal(state.site.themePack, 'solstice');
systemInitOptions.onStateChange();
themeInitOptions.onStateChange();
assert.deepEqual(calls.slice(2), [
  ['system-init'],
  ['theme-init'],
  ['notify', 'site'],
  ['unsynced'],
  ['unsynced'],
  ['tree', { preserveStructure: true }]
]);

const featureContext = {};
const feature = bridge.createLifecycleFeature();
assert.equal(feature.name, 'composer.systemThemeBridge');
feature.start(featureContext);
assert.equal(featureContext.systemThemeBridge, bridge);
assert.equal(calls.filter(call => call[0] === 'system-init').length, 1, 'bridge lifecycle feature should not double-init an initialized bridge');
feature.dispose();
assert.deepEqual(calls.slice(-2), [
  ['system-dispose'],
  ['theme-dispose']
]);
