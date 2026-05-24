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

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = !!init.bubbles;
    this.cancelable = !!init.cancelable;
  }
}

class FakeMouseEvent extends FakeEvent {}

class FakeFileReader {}

class FakeResizeObserver {}

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
  documentRef.readyState = 'complete';
  const windowRef = new FakeEventTarget();
  windowRef.CustomEvent = FakeCustomEvent;
  windowRef.Event = FakeEvent;
  windowRef.MouseEvent = FakeMouseEvent;
  windowRef.FileReader = FakeFileReader;
  windowRef.ResizeObserver = FakeResizeObserver;
  windowRef.performance = { now: () => 42 };
  windowRef.CSS = { escape: value => `escaped:${value}` };
  const clipboardWrites = [];
  windowRef.navigator = { clipboard: { writeText(value) { clipboardWrites.push(value); } } };
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
  windowRef.__press_call_target = function callTarget(...args) {
    this.__press_call_args = args;
  };
  const timers = [];
  const fetchCalls = [];
  const alerts = [];
  const warnings = [];
  const errors = [];
  const confirms = [];
  const messages = [];
  const scrolls = [];
  const openedWindows = [];
  const appendedNodes = [];
  const removedNodes = [];
  const legacyCopyCommands = [];
  windowRef.location = {
    origin: 'https://example.test',
    href: 'https://example.test/editor.html?mode=sync#panel',
    protocol: 'https:',
    host: 'example.test',
    hostname: 'example.test',
    pathname: '/editor.html',
    search: '?mode=sync',
    hash: '#panel'
  };
  windowRef.isSecureContext = true;
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
  windowRef.getComputedStyle = element => ({ element, display: 'grid' });
  windowRef.fetch = (url, options) => {
    fetchCalls.push([url, options]);
    return Promise.resolve({ ok: true, url });
  };
  windowRef.console = {
    warn: (...args) => warnings.push(args),
    error: (...args) => errors.push(args)
  };
  windowRef.alert = message => alerts.push(message);
  windowRef.confirm = message => {
    confirms.push(message);
    return message === 'continue';
  };
  windowRef.pageYOffset = 321;
  windowRef.scrollX = 12;
  windowRef.scrollY = 345;
  windowRef.scrollTo = (...args) => scrolls.push(args);
  windowRef.open = (...args) => {
    openedWindows.push(args);
    return { args };
  };
  documentRef.getElementById = id => ({ id });
  documentRef.querySelector = selector => ({ selector });
  documentRef.querySelectorAll = selector => [{ selector }];
  documentRef.documentElement = { scrollTop: 11, clientWidth: 960, clientHeight: 720 };
  documentRef.body = {
    appendChild(node) {
      appendedNodes.push(node);
    },
    removeChild(node) {
      removedNodes.push(node);
    }
  };
  documentRef.createElement = tagName => ({
    tagName: String(tagName || '').toUpperCase(),
    style: {},
    value: '',
    focused: false,
    selected: false,
    focus() { this.focused = true; },
    select() { this.selected = true; }
  });
  documentRef.execCommand = command => {
    legacyCopyCommands.push(command);
    return command === 'copy';
  };

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
  assert.equal(runtime.globals.call('__press_call_target', 'a', 'b'), true);
  assert.deepEqual(windowRef.__press_call_args, ['a', 'b']);
  assert.equal(runtime.globals.call('__press_missing_call_target'), false);

  assert.equal(runtime.browser.getElementById('previewFrame').id, 'previewFrame');
  assert.equal(runtime.browser.querySelector('.view-toggle').selector, '.view-toggle');
  assert.deepEqual(runtime.browser.querySelectorAll('[data-preview-resize]').map(item => item.selector), ['[data-preview-resize]']);
  let readyCalls = 0;
  const detachReady = runtime.browser.onDocumentReady(() => { readyCalls += 1; });
  assert.equal(readyCalls, 1);
  detachReady();
  assert.equal(timers.includes('clear:23'), true);
  assert.equal(runtime.browser.requestFrame(() => {}), 17);
  runtime.browser.cancelFrame(17);
  assert.equal(timers.includes('cancel:17'), true);
  assert.equal(runtime.browser.setTimer(() => {}, 1200), 23);
  runtime.browser.clearTimer(23);
  assert.equal(timers.includes('clear:23'), true);
  runtime.browser.clearTimer(0);
  assert.equal(timers.includes('clear:0'), true);
  const inputEvent = runtime.browser.createEvent('input', { bubbles: true, cancelable: true });
  assert.ok(inputEvent instanceof FakeEvent);
  assert.equal(inputEvent.type, 'input');
  assert.equal(inputEvent.bubbles, true);
  assert.equal(inputEvent.cancelable, true);
  const mouseEvent = runtime.browser.createMouseEvent('click', { bubbles: true });
  assert.ok(mouseEvent instanceof FakeMouseEvent);
  assert.equal(mouseEvent.type, 'click');
  assert.equal(mouseEvent.bubbles, true);
  assert.equal(runtime.browser.getFileReader(), FakeFileReader);
  assert.equal(runtime.browser.getNavigator(), windowRef.navigator);
  assert.equal(runtime.browser.isSecureContext(), true);
  assert.deepEqual(runtime.browser.getLocation(), {
    href: 'https://example.test/editor.html?mode=sync#panel',
    origin: 'https://example.test',
    protocol: 'https:',
    host: 'example.test',
    hostname: 'example.test',
    pathname: '/editor.html',
    search: '?mode=sync',
    hash: '#panel'
  });
  assert.notEqual(runtime.browser.getLocation(), windowRef.location);
  assert.equal(runtime.browser.getLocationOrigin(), 'https://example.test');
  assert.equal(runtime.browser.getLocationHref(), 'https://example.test/editor.html?mode=sync#panel');
  assert.equal(runtime.browser.matchesMedia('(prefers-reduced-motion: reduce)'), true);
  assert.equal(runtime.browser.getPageYOffset(), 321);
  assert.deepEqual(runtime.browser.getWindowScroll(), { x: 12, y: 345 });
  assert.deepEqual(runtime.browser.getViewportSize(), { width: 1200, height: 900 });
  assert.equal(runtime.browser.getViewportWidth(), 1200);
  assert.deepEqual(runtime.browser.getComputedStyle({ nodeType: 1 }).display, 'grid');
  assert.equal(runtime.browser.getResizeObserver(), FakeResizeObserver);
  assert.equal(runtime.browser.getPerformance(), windowRef.performance);
  assert.equal(runtime.browser.getCss(), windowRef.CSS);
  assert.equal(runtime.browser.showAlert('Heads up'), true);
  assert.deepEqual(alerts, ['Heads up']);
  assert.equal(runtime.browser.warn('Careful', { id: 1 }), true);
  assert.deepEqual(warnings, [['Careful', { id: 1 }]]);
  assert.equal(runtime.browser.error('Broken', { id: 2 }), true);
  assert.deepEqual(errors, [['Broken', { id: 2 }]]);
  assert.equal(runtime.browser.confirmAction('continue'), true);
  assert.equal(runtime.browser.confirmAction('stop'), false);
  assert.deepEqual(confirms, ['continue', 'stop']);
  const response = await runtime.browser.fetchContent('/site.yaml', { cache: 'no-store' });
  assert.equal(response.ok, true);
  assert.deepEqual(fetchCalls, [['/site.yaml', { cache: 'no-store' }]]);
  assert.equal(runtime.browser.scrollToTop({ smooth: true }), true);
  assert.deepEqual(scrolls.at(-1), [{ top: 0, behavior: 'smooth' }]);
  assert.equal(runtime.browser.postMessage({ postMessage: (payload, origin) => messages.push({ payload, origin }) }, { ok: true }), true);
  assert.deepEqual(messages.at(-1), { payload: { ok: true }, origin: 'https://example.test' });
  assert.deepEqual(
    runtime.browser.openWindow('https://example.test/popup', '_blank'),
    { args: ['https://example.test/popup', '_blank'] }
  );
  assert.deepEqual(openedWindows.at(-1), ['https://example.test/popup', '_blank']);
  assert.equal(await runtime.browser.writeClipboardText('copy me'), true);
  assert.deepEqual(clipboardWrites, ['copy me']);
  assert.deepEqual(legacyCopyCommands, []);
  windowRef.isSecureContext = false;
  assert.equal(await runtime.browser.writeClipboardText('legacy copy'), true);
  assert.equal(appendedNodes.length, 1);
  assert.equal(removedNodes.length, 1);
  assert.equal(appendedNodes[0], removedNodes[0]);
  assert.equal(appendedNodes[0].value, 'legacy copy');
  assert.equal(appendedNodes[0].focused, true);
  assert.equal(appendedNodes[0].selected, true);
  assert.deepEqual(legacyCopyCommands, ['copy']);
}

{
  const documentRef = new FakeEventTarget();
  documentRef.readyState = 'loading';
  const runtime = createEditorAppRuntime({ windowRef: {}, documentRef });
  let readyCalls = 0;
  const detachReady = runtime.browser.onDocumentReady(() => { readyCalls += 1; });
  assert.equal((documentRef.listeners.get('DOMContentLoaded') || []).length, 1);
  documentRef.dispatchEvent({ type: 'DOMContentLoaded' });
  assert.equal(readyCalls, 1);
  detachReady();
  assert.equal((documentRef.listeners.get('DOMContentLoaded') || []).length, 0);
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
  const documentRef = new FakeEventTarget();
  const ambientCalls = [];
  const ambientNames = [
    'CustomEvent',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'setTimeout',
    'clearTimeout',
    'getComputedStyle',
    'open',
    'location',
    'console'
  ];
  const originals = new Map();
  const hadOriginal = new Map();
  ambientNames.forEach((name) => {
    hadOriginal.set(name, Object.prototype.hasOwnProperty.call(globalThis, name));
    originals.set(name, globalThis[name]);
  });
  try {
    globalThis.CustomEvent = class AmbientCustomEvent {
      constructor(type) {
        ambientCalls.push(['CustomEvent', type]);
        this.type = type;
      }
    };
    globalThis.requestAnimationFrame = () => {
      ambientCalls.push(['requestAnimationFrame']);
      return 1001;
    };
    globalThis.cancelAnimationFrame = id => ambientCalls.push(['cancelAnimationFrame', id]);
    globalThis.setTimeout = () => {
      ambientCalls.push(['setTimeout']);
      return 1002;
    };
    globalThis.clearTimeout = id => ambientCalls.push(['clearTimeout', id]);
    globalThis.getComputedStyle = element => {
      ambientCalls.push(['getComputedStyle', element]);
      return { display: 'ambient' };
    };
    globalThis.open = (...args) => {
      ambientCalls.push(['open', args]);
      return { ambient: true };
    };
    globalThis.location = {
      href: 'https://ambient.test/editor.html',
      origin: 'https://ambient.test'
    };
    globalThis.console = {
      warn: (...args) => ambientCalls.push(['console.warn', args]),
      error: (...args) => ambientCalls.push(['console.error', args])
    };

    const runtime = createEditorAppRuntime({ windowRef: {}, documentRef });
    assert.equal(runtime.events.emitDocument('press:no-ambient', { ok: true }), true);
    assert.equal(documentRef.dispatched.at(-1).type, 'press:no-ambient');
    assert.equal(documentRef.dispatched.at(-1).detail.ok, true);
    assert.equal(runtime.browser.requestFrame(() => {}), null);
    runtime.browser.cancelFrame(1001);
    assert.equal(runtime.browser.setTimer(() => {}, 10), null);
    runtime.browser.clearTimer(1002);
    assert.equal(runtime.browser.getComputedStyle({ nodeType: 1 }), null);
    assert.equal(runtime.browser.openWindow('/ambient', '_blank'), null);
    assert.equal(runtime.browser.isSecureContext(), false);
    assert.equal(runtime.browser.getLocation(), null);
    assert.equal(runtime.browser.getLocationOrigin(), '');
    assert.equal(runtime.browser.getLocationHref(), '');
    assert.equal(await runtime.browser.writeClipboardText('ambient copy'), false);
    assert.equal(runtime.browser.warn('ambient'), false);
    assert.equal(runtime.browser.error('ambient'), false);
    assert.deepEqual(
      ambientCalls,
      [],
      'editor app runtime facade should not fall back to ambient browser globals after refs are captured'
    );
  } finally {
    ambientNames.forEach((name) => {
      if (hadOriginal.get(name)) globalThis[name] = originals.get(name);
      else delete globalThis[name];
    });
  }
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
