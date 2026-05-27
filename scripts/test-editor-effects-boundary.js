import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bindEventEffect,
  createDomEffects,
  createEventEffects,
  createStorageEffects,
  resolveStorageEffect
} from '../assets/js/editor-effects.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

function createTarget() {
  const listeners = [];
  return {
    listeners,
    addEventListener(type, handler, options) {
      listeners.push({ type, handler, options });
    },
    removeEventListener(type, handler, options) {
      listeners.push({ type: `remove:${type}`, handler, options });
    }
  };
}

{
  const target = createTarget();
  const handler = () => {};
  const options = { capture: true };
  const unbind = bindEventEffect(target, 'click', handler, options);
  assert.equal(typeof unbind, 'function');
  assert.deepEqual(target.listeners[0], { type: 'click', handler, options });
  unbind();
  assert.deepEqual(target.listeners[1], { type: 'remove:click', handler, options });
  assert.equal(typeof bindEventEffect(null, 'click', handler), 'function');
  assert.equal(typeof bindEventEffect({ addEventListener: () => { throw new Error('blocked'); } }, 'click', handler), 'function');
}

{
  const storage = new Map();
  const effects = createStorageEffects({
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key)
  });
  assert.equal(effects.getItem('missing'), null);
  assert.equal(effects.setItem('token', 42), true);
  assert.equal(effects.getItem('token'), '42');
  assert.equal(effects.removeItem('token'), true);
  assert.equal(effects.getItem('token'), null);

  const throwing = createStorageEffects({
    getItem: () => { throw new Error('unavailable'); },
    setItem: () => { throw new Error('unavailable'); },
    removeItem: () => { throw new Error('unavailable'); }
  });
  assert.equal(throwing.getItem('x'), null);
  assert.equal(throwing.setItem('x', 'y'), false);
  assert.equal(throwing.removeItem('x'), false);
}

{
  const storage = { getItem: () => 'ok' };
  assert.equal(resolveStorageEffect({ localStorage: storage }, 'localStorage'), storage);
  const blockedWindow = {};
  Object.defineProperty(blockedWindow, 'localStorage', {
    get() {
      throw new Error('blocked');
    }
  });
  assert.equal(resolveStorageEffect(blockedWindow, 'localStorage'), null);
}

{
  const elements = new Map([
    ['btn', { id: 'btn' }]
  ]);
  const documentRef = {
    getElementById: id => elements.get(id) || null,
    querySelector: selector => selector === '.known' ? { selector } : null,
    querySelectorAll: selector => selector === '.items' ? [{ id: 'a' }, { id: 'b' }] : []
  };
  const effects = createDomEffects({ documentRef });
  assert.deepEqual(effects.getElementById('btn'), { id: 'btn' });
  assert.deepEqual(effects.querySelector('.known'), { selector: '.known' });
  assert.deepEqual(effects.querySelectorAll('.items'), [{ id: 'a' }, { id: 'b' }]);
}

{
  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
      this.bubbles = !!options.bubbles;
    }
  }
  const events = [];
  const documentRef = {
    dispatchEvent(event) {
      events.push(event);
      return true;
    }
  };
  const effects = createEventEffects({ documentRef, windowRef: { CustomEvent: FakeCustomEvent } });
  assert.equal(effects.emitDocument('press:test', { ok: true }, { bubbles: true }), true);
  assert.equal(events[0].type, 'press:test');
  assert.deepEqual(events[0].detail, { ok: true });
  assert.equal(events[0].bubbles, true);
}

const editorEffects = read('assets/js/editor-effects.js');
const editorRuntime = read('assets/js/editor-app-runtime.js');
const composerBootstrap = read('assets/js/composer-bootstrap.js');
const themeManager = read('assets/js/theme-manager.js');
const publishSettingsStore = read('assets/js/publish/settings-store.js');
const connectTransport = read('assets/js/publish/transports/connect-transport.js');

assert.match(editorEffects, /export function bindEventEffect/, 'effects boundary should own listener binding');
assert.match(editorEffects, /export function createStorageEffects/, 'effects boundary should own safe storage access');
assert.match(editorRuntime, /from '\.\/editor-effects\.js'/, 'editor runtime should compose shared effects');
assert.doesNotMatch(editorRuntime, /function createRuntimeStorage|function createRuntimeEvents|function resolveWindowStorage/);

assert.match(composerBootstrap, /from '\.\/editor-effects\.js'/, 'composer bootstrap should use shared DOM effects');
assert.doesNotMatch(composerBootstrap, /\.addEventListener\(/, 'composer bootstrap should not bind raw DOM listeners directly');

assert.match(themeManager, /from '\.\/editor-effects\.js'/, 'Theme Manager init should use shared DOM effects');
assert.doesNotMatch(themeManager, /\.addEventListener\(/, 'Theme Manager root should not bind raw DOM listeners directly');

assert.match(publishSettingsStore, /from '\.\.\/editor-effects\.js'/, 'publish settings should use shared storage effects');
assert.doesNotMatch(
  publishSettingsStore,
  /windowRef\.(?:localStorage|sessionStorage)/,
  'publish settings should not touch browser storage directly'
);

assert.match(connectTransport, /from '\.\.\/\.\.\/editor-effects\.js'/, 'Connect transport should use shared event effects');
assert.match(connectTransport, /eventEffects\.onWindow\('message', onMessage\)/);
assert.doesNotMatch(
  connectTransport,
  /windowRef\.(?:addEventListener|removeEventListener)\('message'/,
  'Connect popup listener should be routed through shared event effects'
);

console.log('ok - editor effects boundary');
