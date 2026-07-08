const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_SOURCES
} = require('./product-state-ledger.js');
const {
  RELEASE_EVENT_TYPE,
  getReleaseDispatchTargets,
  getReleaseProductStateSources,
  getReleaseTargets,
  validateReleaseTargets
} = require('./release-targets.js');

test('release target registry declares the complete downstream control plane', () => {
  const targets = getReleaseTargets();
  assert.deepEqual(targets.map((target) => target.key), [
    'yap',
    'themeStarter',
    'arcus',
    'cartograph',
    'glasswing',
    'solstice'
  ]);
  assert.deepEqual(targets.map((target) => target.repository), [
    'EkilyHQ/YAP',
    'EkilyHQ/Press-Theme-Starter',
    'EkilyHQ/Press-Theme-Arcus',
    'EkilyHQ/Press-Theme-Cartograph',
    'EkilyHQ/Press-Theme-Glasswing',
    'EkilyHQ/Press-Theme-Solstice'
  ]);
  assert.deepEqual(validateReleaseTargets(), []);
  targets.forEach((target) => {
    assert.equal(target.eventType, RELEASE_EVENT_TYPE);
    assert.equal(target.reconciler.idempotent, true);
  });
});

test('dispatch defaults are derived from release targets', () => {
  const dispatchTargets = getReleaseDispatchTargets();
  const targets = getReleaseTargets();
  assert.deepEqual(dispatchTargets, targets.map((target) => ({
    repository: target.repository,
    eventType: target.eventType,
    label: target.label
  })));
});

test('product-state defaults are derived from release targets', () => {
  const releaseSources = getReleaseProductStateSources();
  assert.deepEqual(DEFAULT_SOURCES.downstream, releaseSources.downstream);
  assert.deepEqual(DEFAULT_SOURCES.themeDemos, releaseSources.themeDemos);
  assert.deepEqual(DEFAULT_SOURCES.downstream.map((source) => source.source), [
    'https://raw.githubusercontent.com/EkilyHQ/YAP/main/assets/press-system.json',
    'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Starter/main/press-system-release.json'
  ]);
  assert.deepEqual(DEFAULT_SOURCES.themeDemos.map((source) => source.source), [
    'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Arcus/demo/assets/press-system.json',
    'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Cartograph/demo/assets/press-system.json',
    'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Glasswing/demo/assets/press-system.json',
    'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Solstice/demo/assets/press-system.json'
  ]);
  assert.equal(DEFAULT_SOURCES.downstream[0].reconciler.kind, 'press-runtime-sync');
  assert.equal(DEFAULT_SOURCES.downstream[1].reconciler.kind, 'theme-starter-marker-sync');
  DEFAULT_SOURCES.themeDemos.forEach((source) => {
    assert.equal(source.reconciler.kind, 'theme-demo-runtime-sync');
    assert.equal(source.observedChannels.themeManifest.source, `https://raw.githubusercontent.com/${source.repository}/demo/assets/themes/${source.key}/theme.json`);
    assert.equal(source.observedChannels.themePacks.source, `https://raw.githubusercontent.com/${source.repository}/demo/assets/themes/packs.json`);
    assert.equal(source.observedChannels.demoLock.source, `https://raw.githubusercontent.com/${source.repository}/demo/demo-release-lock.json`);
  });
});

test('release target validation catches duplicate or malformed targets', () => {
  const targets = getReleaseTargets();
  targets.push({
    ...targets[0],
    key: 'duplicateYap'
  });
  assert.match(validateReleaseTargets(targets).join('\n'), /repository duplicates EkilyHQ\/YAP/u);

  const malformed = getReleaseTargets();
  malformed[0].eventType = 'other-event';
  malformed[0].observed.ref = 'feature';
  assert.match(validateReleaseTargets(malformed).join('\n'), /eventType must be press-system-release/u);
  assert.match(validateReleaseTargets(malformed).join('\n'), /observed\.ref must be main or demo/u);
});
