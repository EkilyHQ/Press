import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const composerSource = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');
const bridgeSource = readFileSync(resolve(here, '../assets/js/composer-system-theme-bridge.js'), 'utf8');

assert.match(
  composerSource,
  /from '\.\/composer-system-theme-bridge\.js\?v=[\w.-]+'/,
  'composer should import the system/theme bridge through a cache-busted module'
);

assert.doesNotMatch(
  composerSource,
  /from '\.\/system-updates\.js\?v=|from '\.\/theme-manager\.js\?v=/,
  'composer should not import system-updates or theme-manager directly'
);

assert.match(
  composerSource,
  /composerSystemThemeBridge\.registerStagingProviders\(stagingRegistry\);/,
  'system/theme staging providers should be registered through the bridge'
);

assert.match(
  composerSource,
  /composerSystemThemeBridge\.hasSystemUpdateEntries\(\)[\s\S]*composerSystemThemeBridge\.hasThemeEntries\(\)/,
  'editor tree system/theme dirty status should query the bridge'
);

assert.match(
  composerSource,
  /composerSystemThemeBridge\.init\(\);/,
  'system/theme module initialization should be delegated to the bridge'
);

assert.match(
  bridgeSource,
  /import \{ initSystemUpdates, getSystemUpdateSummaryEntries, getSystemUpdateCommitFiles, clearSystemUpdateState \} from '\.\/system-updates\.js\?v=[\w.-]+';/,
  'bridge should own system updates imports'
);

assert.match(
  bridgeSource,
  /import \{ initThemeManager, getThemeManagerSummaryEntries, getThemeManagerCommitFiles, clearThemeManagerState \} from '\.\/theme-manager\.js\?v=[\w.-]+';/,
  'bridge should own theme manager imports'
);

assert.match(
  bridgeSource,
  /id: 'system-updates'[\s\S]*getSummaryEntries: getSystemSummaryEntries[\s\S]*getCommitFiles: getSystemCommitFiles[\s\S]*clearSystemUpdateState\(\{ keepStatus: false \}\)/,
  'bridge should register the system update staging provider'
);

assert.match(
  bridgeSource,
  /id: 'themes'[\s\S]*getSummaryEntries: getThemeSummaryEntries[\s\S]*getCommitFiles: getThemeCommitFiles[\s\S]*clearThemeManagerState\(\{ keepStatus: false, keepRegistryCache: true, keepSiteThemeFallback: true \}\)/,
  'bridge should register the theme staging provider with the existing clear options'
);

assert.match(
  bridgeSource,
  /initSystemUpdates\(\{ onStateChange: refreshUnsyncedSummary \}\)[\s\S]*initThemeManager\(\{[\s\S]*onStateChange: refreshThemeState,[\s\S]*getCurrentThemePack,[\s\S]*setSiteThemePack[\s\S]*\}\)/,
  'bridge should initialize system updates and theme manager with the existing callbacks'
);
