import assert from 'node:assert/strict';
import {
  COMPOSER_RUNTIME_EVENTS,
  createComposerRuntime
} from '../assets/js/composer-runtime.js';

const events = [];
const timers = [];
const frames = [];
const cancelledFrames = [];
const alerts = [];
const confirms = [];
const fetchCalls = [];
const performanceRef = { now: () => 42 };
const cssRef = { escape: (value) => `escaped:${value}` };
const windowRef = {
  __press_content_root: 'docs',
  location: { href: 'https://example.test/index_editor.html' },
  localStorage: new Map(),
  performance: performanceRef,
  CSS: cssRef,
  setTimeout(handler, delay) {
    timers.push({ handler, delay });
    return timers.length;
  },
  clearTimeout(id) {
    timers[id - 1].cleared = true;
  },
  requestAnimationFrame(handler) {
    frames.push(handler);
    return frames.length;
  },
  cancelAnimationFrame(id) {
    cancelledFrames.push(id);
  },
  fetch(url, options) {
    fetchCalls.push([url, options]);
    return Promise.resolve({ ok: true, url });
  },
  alert(message) {
    alerts.push(message);
  },
  confirm(message) {
    confirms.push(message);
    return message === 'continue';
  },
  dispatchEvent(event) {
    events.push(['window', event.type, event.detail]);
    return true;
  },
  CustomEvent: class TestCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }
};
windowRef.localStorage.getItem = (key) => windowRef.localStorage.get(key) || null;
windowRef.localStorage.setItem = (key, value) => windowRef.localStorage.set(key, String(value));
windowRef.localStorage.removeItem = (key) => windowRef.localStorage.delete(key);

const documentEvents = [];
const documentRef = {
  readyState: 'complete',
  dispatchEvent(event) {
    documentEvents.push(['document', event.type, event.detail]);
    return true;
  }
};

const runtime = createComposerRuntime({ windowRef, documentRef });

assert.equal(runtime.getContentRoot(), 'docs');
assert.equal(runtime.setContentRoot('/wwwroot/'), 'wwwroot');
assert.equal(windowRef.__press_content_root, 'wwwroot');

assert.deepEqual(runtime.ensureSiteRepo(), { owner: '', name: '', branch: 'main' });
assert.deepEqual(windowRef.__press_site_repo, { owner: '', name: '', branch: 'main' });
assert.deepEqual(
  runtime.setSiteRepo({ owner: 'EkilyHQ', name: 'Press', branch: 'docs' }),
  { owner: 'EkilyHQ', name: 'Press', branch: 'docs' }
);
assert.deepEqual(runtime.getSiteRepo(), { owner: 'EkilyHQ', name: 'Press', branch: 'docs' });

runtime.emitSiteConfigChange({ contentRoot: 'wwwroot' });
assert.deepEqual(events.at(-1), [
  'window',
  COMPOSER_RUNTIME_EVENTS.siteConfigChange,
  { siteConfig: { contentRoot: 'wwwroot' } }
]);

runtime.emitLanguagePoolChanged();
assert.deepEqual(documentEvents.at(-1), [
  'document',
  COMPOSER_RUNTIME_EVENTS.languagePoolChanged,
  undefined
]);

let ready = false;
const disposeReady = runtime.onDocumentReady(() => {
  ready = true;
});
assert.equal(timers.length, 1);
timers[0].handler();
assert.equal(ready, true);
disposeReady();
assert.equal(timers[0].cleared, true);

const frameId = runtime.requestFrame(() => {});
assert.equal(frameId, 1);
assert.equal(frames.length, 1);
runtime.cancelFrame(frameId);
assert.deepEqual(cancelledFrames, [1]);

const timerId = runtime.setTimer(() => {}, 50);
assert.equal(timerId, 2);
runtime.clearTimer(timerId);
assert.equal(timers[1].cleared, true);

assert.equal(runtime.showAlert('hello'), true);
assert.deepEqual(alerts, ['hello']);
assert.equal(runtime.confirmAction('continue'), true);
assert.equal(runtime.confirmAction('stop'), false);
assert.deepEqual(confirms, ['continue', 'stop']);
assert.equal(runtime.getPerformance(), performanceRef);
assert.equal(runtime.getCss(), cssRef);

const response = await runtime.fetchContent('/site.yaml', { cache: 'no-store' });
assert.equal(response.ok, true);
assert.deepEqual(fetchCalls, [['/site.yaml', { cache: 'no-store' }]]);
