import assert from 'node:assert/strict';

import { createPublishTransportSettingsUi } from '../assets/js/composer-publish-settings-ui.js';

function createStore() {
  let token = '';
  let connect = { enabled: true, mode: 'connect', baseUrl: 'https://connect.example' };
  let grant = null;
  return {
    getCachedFineGrainedToken() {
      return token;
    },
    setCachedFineGrainedToken(next) {
      token = next || '';
    },
    clearCachedFineGrainedToken() {
      token = '';
    },
    getStoredConnectPublishSettings() {
      return { ...connect };
    },
    setStoredConnectPublishSettings(next) {
      connect = { ...connect, ...next };
      return { ...connect };
    },
    getCachedConnectPublishGrant() {
      return grant;
    },
    setCachedConnectPublishGrant(next) {
      grant = next || null;
    },
    clearCachedConnectPublishGrant() {
      grant = null;
    },
    resolvePublishTransport(settings) {
      return settings && settings.enabled
        ? { type: 'connect', connect: settings }
        : { type: 'pat', token };
    }
  };
}

function createTokenDocument(input) {
  return {
    getElementById() {
      return null;
    },
    querySelectorAll(selector) {
      return selector === '#syncGithubTokenInput' ? [input] : [];
    }
  };
}

{
  const calls = [];
  const frameHandlers = [];
  const timerHandlers = [];
  const tokenInput = {
    offsetParent: {},
    focus() {
      calls.push(['focus']);
    }
  };
  const ui = createPublishTransportSettingsUi({
    documentRef: createTokenDocument(tokenInput),
    publishSettingsStore: createStore(),
    applyMode: (mode) => calls.push(['mode', mode]),
    refreshSyncCommitPanel: async (options) => {
      calls.push(['refresh', !!(options && options.focusToken)]);
    },
    requestAnimationFrameRef: (handler) => {
      frameHandlers.push(handler);
      calls.push(['frame']);
      return frameHandlers.length;
    },
    setTimeoutRef: (handler, delay) => {
      timerHandlers.push({ handler, delay });
      calls.push(['timer', delay]);
      return timerHandlers.length;
    }
  });

  ui.switchToPatFallbackAndFocusToken();
  assert.deepEqual(calls.slice(0, 4), [
    ['mode', 'sync'],
    ['refresh', true],
    ['frame'],
    ['timer', 120]
  ]);
  assert.equal(frameHandlers.length, 1, 'PAT fallback should use the injected frame scheduler');
  assert.equal(timerHandlers.length, 1, 'PAT fallback should use the injected trailing timer');
  assert.equal(calls.some(call => call[0] === 'focus'), false, 'focus should wait for the injected schedulers when available');

  frameHandlers.shift()();
  assert.equal(frameHandlers.length, 1, 'PAT fallback should retain the nested frame scheduling behavior');
  frameHandlers.shift()();
  assert.equal(calls.filter(call => call[0] === 'focus').length, 1);
  timerHandlers.shift().handler();
  assert.equal(calls.filter(call => call[0] === 'focus').length, 2);
}

{
  const calls = [];
  const tokenInput = {
    offsetParent: {},
    focus() {
      calls.push(['focus']);
    }
  };
  const ui = createPublishTransportSettingsUi({
    documentRef: createTokenDocument(tokenInput),
    publishSettingsStore: createStore(),
    applyMode: (mode) => calls.push(['mode', mode]),
    refreshSyncCommitPanel: () => ({
      then() {
        return { catch() {} };
      }
    })
  });

  ui.switchToPatFallbackAndFocusToken();
  assert.deepEqual(calls, [
    ['mode', 'sync'],
    ['focus']
  ], 'PAT fallback should stay usable without browser scheduler adapters');
}

console.log('composer publish settings UI tests passed');
