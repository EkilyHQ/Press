import assert from 'node:assert/strict';
import { createComposerYamlActions } from '../assets/js/composer-yaml-actions.js';

function createButton() {
  const classes = new Set();
  return {
    disabled: false,
    textContent: '',
    attrs: {},
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      }
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    }
  };
}

function createHarness(overrides = {}) {
  let activeFile = overrides.activeFile || 'index';
  let baselineSignature = overrides.baselineSignature || 'base:old';
  const remoteBaseline = {
    index: { __order: ['old-index'] },
    tabs: { __order: ['old-tabs'] },
    site: { siteTitle: 'Old site' }
  };
  const stateSlices = {};
  const calls = [];
  const statuses = [];
  const timers = [];
  const diffs = { index: null, tabs: null, site: null, ...(overrides.diffs || {}) };
  const draftMeta = { index: null, tabs: null, site: null, ...(overrides.draftMeta || {}) };

  const action = createComposerYamlActions({
    consoleRef: {
      error: (...args) => calls.push(['error', ...args]),
      warn: (...args) => calls.push(['warn', ...args])
    },
    t: (key, params = {}) => {
      if (params.name) return `${key}:${params.name}`;
      if (params.label) return `${key}:${params.label}`;
      return key;
    },
    fetchConfigWithYamlFallback: async (paths) => {
      calls.push(['fetchConfig', paths]);
      if (overrides.fetchConfigError) throw overrides.fetchConfigError;
      return overrides.remote ?? { __order: ['remote-index'], remote: true };
    },
    fetchTrackedSiteConfig: async () => {
      calls.push(['fetchSite']);
      if (overrides.fetchSiteError) throw overrides.fetchSiteError;
      return overrides.remote ?? { siteTitle: 'Remote site' };
    },
    getActiveComposerFile: () => activeFile,
    getContentRootSafe: () => 'content',
    prepareIndexState: (value) => ({ ...value, preparedIndex: true }),
    prepareTabsState: (value) => ({ ...value, preparedTabs: true }),
    prepareSiteState: (value) => ({ ...value, preparedSite: true }),
    cloneSiteState: (value) => ({ ...value, clonedSite: true }),
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    computeBaselineSignature: () => baselineSignature,
    getComposerDiff: (kind) => diffs[kind],
    getRemoteBaseline: (kind) => remoteBaseline[kind],
    setRemoteBaseline: (kind, value) => {
      remoteBaseline[kind] = value;
      calls.push(['setRemoteBaseline', kind, value]);
      if (overrides.nextBaselineSignature) baselineSignature = overrides.nextBaselineSignature;
    },
    setStateSlice: (kind, value) => {
      stateSlices[kind] = value;
      calls.push(['setStateSlice', kind, value]);
    },
    applyEffectiveSiteConfig: (value) => calls.push(['applySite', value]),
    rebuildIndexUI: () => calls.push(['rebuildIndex']),
    rebuildTabsUI: () => calls.push(['rebuildTabs']),
    rebuildSiteUI: () => calls.push(['rebuildSite']),
    notifyComposerChange: (kind, options) => calls.push(['notify', kind, options]),
    showStatus: (message) => statuses.push(message),
    getDraftMeta: (kind) => draftMeta[kind],
    clearAutoDraftTimer: (kind) => calls.push(['clearTimer', kind]),
    clearDraftStorage: (kind) => calls.push(['clearDraft', kind]),
    showDiscardConfirm: async (_button, message) => {
      calls.push(['confirm', message]);
      return overrides.confirmResult !== false;
    },
    confirmRef: () => overrides.confirmResult !== false,
    setTimeoutRef: (handler, delay) => {
      timers.push({ handler, delay });
      return timers.length;
    }
  });

  return {
    action,
    calls,
    statuses,
    timers,
    stateSlices,
    remoteBaseline,
    setActiveFile(value) {
      activeFile = value;
    }
  };
}

{
  const button = createButton();
  const { action, calls, statuses, stateSlices, remoteBaseline, timers } = createHarness();
  await action.handleRefresh(button);
  assert.deepEqual(calls[0], ['fetchConfig', ['content/index.yaml', 'content/index.yml']]);
  assert.equal(remoteBaseline.index.preparedIndex, true);
  assert.equal(stateSlices.index.preparedIndex, true);
  assert.equal(calls.some((call) => call[0] === 'rebuildIndex'), true);
  assert.equal(statuses[0], 'editor.composer.statusMessages.refreshSuccess:index.yaml');
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'editor.composer.refresh');
  assert.equal(timers[0].delay, 2000);
}

{
  const { action, calls, statuses } = createHarness({
    diffs: { tabs: { hasChanges: true } },
    activeFile: 'tabs',
    nextBaselineSignature: 'base:new'
  });
  await action.handleRefresh(createButton());
  assert.equal(calls.some((call) => call[0] === 'setStateSlice'), false);
  assert.equal(calls.some((call) => call[0] === 'notify' && call[1] === 'tabs'), true);
  assert.equal(statuses[0], 'editor.composer.statusMessages.remoteUpdated');
}

{
  const { action, calls, statuses, stateSlices, remoteBaseline } = createHarness({
    activeFile: 'site',
    diffs: { site: { hasChanges: true } },
    remote: { siteTitle: 'Fresh site' }
  });
  await action.handleDiscard(createButton());
  assert.equal(calls.some((call) => call[0] === 'fetchSite'), true);
  assert.equal(stateSlices.site.siteTitle, 'Fresh site');
  assert.equal(stateSlices.site.preparedSite, true);
  assert.equal(stateSlices.site.clonedSite, true);
  assert.equal(remoteBaseline.site.clonedSite, true);
  assert.equal(calls.some((call) => call[0] === 'applySite'), true);
  assert.equal(calls.some((call) => call[0] === 'rebuildSite'), true);
  assert.equal(calls.some((call) => call[0] === 'clearTimer' && call[1] === 'site'), true);
  assert.equal(calls.some((call) => call[0] === 'clearDraft' && call[1] === 'site'), true);
  assert.equal(statuses[0], 'editor.composer.discardConfirm.successFresh:site.yaml');
}

{
  const { action, calls, statuses, stateSlices } = createHarness({
    activeFile: 'index',
    diffs: { index: { hasChanges: true } },
    fetchConfigError: new Error('offline')
  });
  await action.handleDiscard(createButton());
  assert.equal(calls.some((call) => call[0] === 'warn'), true);
  assert.deepEqual(stateSlices.index, { __order: ['old-index'] });
  assert.equal(statuses[0], 'editor.composer.discardConfirm.successCached:index.yaml');
}

{
  const { action, calls } = createHarness({
    diffs: { index: { hasChanges: true } },
    confirmResult: false
  });
  await action.handleDiscard(createButton());
  assert.equal(calls.some((call) => call[0] === 'fetchConfig'), false);
  assert.equal(calls.some((call) => call[0] === 'setStateSlice'), false);
}

{
  const { action, calls } = createHarness();
  await action.handleDiscard(createButton());
  assert.equal(calls.length, 0, 'discard should do nothing when there are no changes or drafts');
}

console.log('composer YAML action tests passed');
