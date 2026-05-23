import assert from 'node:assert/strict';
import {
  COMPOSER_RUNTIME_EVENTS,
  createComposerRuntime
} from '../assets/js/composer-runtime.js';

const events = [];
const timers = [];
const windowRef = {
  __press_content_root: 'docs',
  location: { href: 'https://example.test/index_editor.html' },
  localStorage: new Map(),
  setTimeout(handler, delay) {
    timers.push({ handler, delay });
    return timers.length;
  },
  clearTimeout(id) {
    timers[id - 1].cleared = true;
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
