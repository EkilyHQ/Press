import assert from 'node:assert/strict';
import { createComposerYamlDraftController } from '../assets/js/composer-yaml-drafts.js';

function createHarness() {
  let nowValue = 1800000000000;
  const storeState = {};
  const stateSlices = {
    index: { __order: ['a'], a: { title: 'A' } },
    tabs: { __order: ['home'], home: { en: { location: 'index.md' } } },
    site: { siteTitle: 'Example' }
  };
  const diffs = {
    index: null,
    tabs: null,
    site: null
  };
  const timers = [];
  const summaryUpdates = [];
  const setStateCalls = [];

  const controller = createComposerYamlDraftController({
    draftStore: {
      read: () => JSON.parse(JSON.stringify(storeState)),
      write: (next) => {
        Object.keys(storeState).forEach((key) => { delete storeState[key]; });
        Object.assign(storeState, JSON.parse(JSON.stringify(next || {})));
      },
      removeEntry: (key) => {
        delete storeState[key];
      }
    },
    getStateSlice: (kind) => stateSlices[kind] || null,
    setStateSlice: (kind, value) => {
      stateSlices[kind] = value;
      setStateCalls.push({ kind, value });
    },
    getComposerDiff: (kind) => diffs[kind] || null,
    computeBaselineSignature: (kind) => `baseline:${kind}`,
    prepareIndexState: (value) => ({ ...value, preparedIndex: true }),
    prepareTabsState: (value) => ({ ...value, preparedTabs: true }),
    cloneSiteState: (value) => ({ ...value, clonedSite: true }),
    updateUnsyncedSummary: () => summaryUpdates.push(true),
    setTimeoutRef: (handler, delay) => {
      const timer = { handler, delay, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeoutRef: (timer) => {
      if (timer) timer.cleared = true;
    },
    now: () => {
      nowValue += 1;
      return nowValue;
    }
  });

  return {
    controller,
    storeState,
    stateSlices,
    diffs,
    timers,
    summaryUpdates,
    setStateCalls
  };
}

{
  const { controller, storeState, summaryUpdates } = createHarness();
  const meta = controller.saveDraftToStorage('index', { manual: true });
  assert.equal(meta.baseSignature, 'baseline:index');
  assert.equal(meta.lastManual, true);
  assert.equal(storeState.index.baseSignature, 'baseline:index');
  assert.equal(storeState.index.data.preparedIndex, true);
  assert.equal(controller.getDraftMeta('index').savedAt, meta.savedAt);
  assert.equal(summaryUpdates.length, 1);
}

{
  const { controller, storeState, diffs, timers, summaryUpdates } = createHarness();
  storeState.tabs = { savedAt: 1, data: { stale: true }, baseSignature: 'old' };
  diffs.tabs = { hasChanges: false };
  controller.scheduleAutoDraft('tabs');
  assert.equal(storeState.tabs, undefined);
  assert.equal(controller.hasDraftMeta('tabs'), false);
  assert.equal(timers.length, 0);
  assert.equal(summaryUpdates.length, 1);
}

{
  const { controller, storeState, diffs, timers } = createHarness();
  diffs.site = { hasChanges: true };
  controller.scheduleAutoDraft('site');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 800);
  timers[0].handler();
  assert.equal(storeState.site.baseSignature, 'baseline:site');
  assert.equal(storeState.site.data.clonedSite, true);
  assert.equal(controller.hasAnyDraftMeta(), true);
}

{
  const { controller, timers, diffs } = createHarness();
  diffs.index = { hasChanges: true };
  controller.scheduleAutoDraft('index');
  controller.scheduleAutoDraft('index');
  assert.equal(timers.length, 2);
  assert.equal(timers[0].cleared, true);
  assert.equal(timers[1].cleared, false);
  controller.clearAutoDraftTimer('index');
  assert.equal(timers[1].cleared, true);
}

{
  const { controller, storeState, stateSlices, setStateCalls } = createHarness();
  storeState.index = { savedAt: 10, baseSignature: 'base:index', data: { __order: ['draft'] } };
  storeState.tabs = { savedAt: 20, baseSignature: 'base:tabs', data: { __order: ['draft-tabs'] } };
  storeState.site = { savedAt: 30, baseSignature: 'base:site', data: { siteTitle: 'Draft site' } };
  const targetState = {};
  const restored = controller.loadDraftSnapshotsIntoState(targetState);
  assert.deepEqual(restored, ['index', 'tabs', 'site']);
  assert.equal(targetState.index.preparedIndex, true);
  assert.equal(targetState.tabs.preparedTabs, true);
  assert.equal(targetState.site.clonedSite, true);
  assert.equal(stateSlices.site.siteTitle, 'Draft site');
  assert.deepEqual(setStateCalls.map((call) => call.kind), ['index', 'tabs', 'site']);
  assert.equal(controller.getDraftMeta('site').baseSignature, 'base:site');
}

console.log('composer YAML draft tests passed');
