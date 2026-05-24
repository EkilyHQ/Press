import assert from 'node:assert/strict';

import {
  createEditorAppRuntime,
  createEditorStateStore
} from '../assets/js/editor-app-runtime.js';

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
    this.dispatched = [];
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(type, handlers.filter(item => item !== handler));
  }

  dispatchEvent(event) {
    this.dispatched.push(event);
    const handlers = this.listeners.get(event.type) || [];
    handlers.forEach(handler => handler(event));
    return !event.defaultPrevented;
  }
}

class FakeCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
    this.cancelable = !!init.cancelable;
    this.defaultPrevented = false;
  }

  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
}

{
  const store = createEditorStateStore({
    kinds: ['index', 'tabs', 'site'],
    defaultKind: 'index',
    initialState: {
      index: { __order: ['post'] },
      tabs: { __order: ['about'] },
      site: { siteTitle: 'Press' }
    }
  });

  assert.deepEqual(store.getStateSlice('tabs'), { __order: ['about'] });
  assert.deepEqual(store.getStateSlice('unknown'), { __order: ['post'] });

  store.setStateSlice('site', { siteTitle: 'Next' });
  assert.deepEqual(store.getStateSlice('site'), { siteTitle: 'Next' });

  store.setRemoteBaseline('tabs', { __order: [] });
  assert.deepEqual(store.getRemoteBaseline('tabs'), { __order: [] });
  assert.equal(store.getRemoteBaseline(), store.getRemoteBaselines());

  store.setDiff('site', { hasChanges: true });
  assert.equal(store.getDiff('site').hasChanges, true);
  assert.equal(store.hasDiff('site'), true);
  assert.equal(store.hasDiff('tabs'), false);
}

{
  const documentRef = new FakeEventTarget();
  const windowRef = new FakeEventTarget();
  windowRef.CustomEvent = FakeCustomEvent;
  const writes = new Map();
  windowRef.localStorage = {
    getItem(key) {
      return writes.has(key) ? writes.get(key) : null;
    },
    setItem(key, value) {
      writes.set(key, String(value));
    },
    removeItem(key) {
      writes.delete(key);
    }
  };
  windowRef.__press_site_repo = { owner: 'EkilyHQ', name: 'Press' };
  windowRef.__press_primary_editor = { setView() {} };
  const timers = [];
  const messages = [];
  const scrolls = [];
  windowRef.location = { origin: 'https://example.test' };
  windowRef.innerHeight = 900;
  windowRef.innerWidth = 1200;
  windowRef.requestAnimationFrame = (fn) => {
    fn();
    return 17;
  };
  windowRef.cancelAnimationFrame = id => timers.push(`cancel:${id}`);
  windowRef.setTimeout = (fn, delay) => {
    timers.push(delay);
    fn();
    return 23;
  };
  windowRef.clearTimeout = id => timers.push(`clear:${id}`);
  windowRef.matchMedia = query => ({ media: query, matches: query.includes('reduced-motion') });
  windowRef.pageYOffset = 321;
  windowRef.scrollTo = (...args) => scrolls.push(args);
  documentRef.getElementById = id => ({ id });
  documentRef.querySelector = selector => ({ selector });
  documentRef.querySelectorAll = selector => [{ selector }];
  documentRef.documentElement = { scrollTop: 11 };

  const runtime = createEditorAppRuntime({ windowRef, documentRef });
  assert.equal(runtime.storage.setItem('mode', 'sync'), true);
  assert.equal(runtime.storage.getItem('mode'), 'sync');
  assert.equal(runtime.storage.removeItem('mode'), true);
  assert.equal(runtime.storage.getItem('mode'), null);

  const received = [];
  const detach = runtime.events.onDocument('press:test', event => received.push(event.detail.value));
  assert.equal(runtime.events.emitDocument('press:test', { value: 42 }), true);
  detach();
  runtime.events.emitDocument('press:test', { value: 7 });
  assert.deepEqual(received, [42]);
  assert.equal(documentRef.dispatched[0].type, 'press:test');

  runtime.events.onWindow('press:cancelable', event => event.preventDefault());
  assert.equal(runtime.events.emitWindow('press:cancelable', { ok: true }, { cancelable: true }), false);
  assert.equal(windowRef.dispatched[0].cancelable, true);

  assert.deepEqual(runtime.globals.getPressSiteRepo(), { owner: 'EkilyHQ', name: 'Press' });
  assert.equal(runtime.globals.getPrimaryEditorApi(), windowRef.__press_primary_editor);
  assert.equal(runtime.globals.setString('__press_editor_base_dir', 'wwwroot/'), true);
  assert.equal(runtime.globals.getString('__press_editor_base_dir'), 'wwwroot/');

  assert.equal(runtime.browser.getElementById('previewFrame').id, 'previewFrame');
  assert.equal(runtime.browser.querySelector('.view-toggle').selector, '.view-toggle');
  assert.deepEqual(runtime.browser.querySelectorAll('[data-preview-resize]').map(item => item.selector), ['[data-preview-resize]']);
  assert.equal(runtime.browser.requestFrame(() => {}), 17);
  runtime.browser.cancelFrame(17);
  assert.equal(timers.includes('cancel:17'), true);
  assert.equal(runtime.browser.setTimer(() => {}, 1200), 23);
  runtime.browser.clearTimer(23);
  assert.equal(timers.includes('clear:23'), true);
  runtime.browser.clearTimer(0);
  assert.equal(timers.includes('clear:0'), true);
  assert.equal(runtime.browser.getLocationOrigin(), 'https://example.test');
  assert.equal(runtime.browser.matchesMedia('(prefers-reduced-motion: reduce)'), true);
  assert.equal(runtime.browser.getPageYOffset(), 321);
  assert.equal(runtime.browser.getViewportWidth(), 1200);
  assert.equal(runtime.browser.scrollToTop({ smooth: true }), true);
  assert.deepEqual(scrolls.at(-1), [{ top: 0, behavior: 'smooth' }]);
  assert.equal(runtime.browser.postMessage({ postMessage: (payload, origin) => messages.push({ payload, origin }) }, { ok: true }), true);
  assert.deepEqual(messages.at(-1), { payload: { ok: true }, origin: 'https://example.test' });
}

{
  const runtime = createEditorAppRuntime({
    storage: {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      }
    }
  });

  assert.equal(runtime.storage.getItem('x'), null);
  assert.equal(runtime.storage.setItem('x', '1'), false);
  assert.equal(runtime.storage.removeItem('x'), false);
  assert.equal(runtime.events.emitDocument('missing', {}), false);
}

{
  const runtime = createEditorAppRuntime({
    windowRef: {
      get localStorage() {
        throw new Error('unavailable');
      }
    }
  });

  assert.equal(runtime.storage.getItem('x'), null);
  assert.equal(runtime.storage.setItem('x', '1'), false);
}
