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
const populateCalls = [];
const fetchCalls = [];
const scrolls = [];
const clipboardWrites = [];
const appendedNodes = [];
const removedNodes = [];
const legacyCopyCommands = [];
const performanceRef = { now: () => 42 };
const cssRef = { escape: (value) => `escaped:${value}` };
class TestResizeObserver {}
const windowRef = {
  __press_content_root: 'docs',
  location: { href: 'https://example.test/index_editor.html' },
  localStorage: new Map(),
  innerHeight: 740,
  innerWidth: 1180,
  scrollX: 7,
  scrollY: 19,
  performance: performanceRef,
  CSS: cssRef,
  isSecureContext: true,
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
  scrollTo(...args) {
    scrolls.push(args);
  },
  matchMedia(query) {
    return { matches: query === '(prefers-reduced-motion: reduce)' };
  },
  getComputedStyle(element) {
    return element ? { marginTop: '4px', marginBottom: '8px' } : null;
  },
  ResizeObserver: TestResizeObserver,
  __pressPopulateEditorLanguageSelect() {
    populateCalls.push('populate');
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

const navigatorRef = {
  clipboard: {
    writeText(value) {
      clipboardWrites.push(value);
      return Promise.resolve();
    }
  }
};
const documentEvents = [];
const documentRef = {
  readyState: 'complete',
  body: {
    appendChild(node) {
      appendedNodes.push(node);
    },
    removeChild(node) {
      removedNodes.push(node);
    }
  },
  createElement(tagName) {
    return {
      tagName: String(tagName || '').toUpperCase(),
      style: {},
      value: '',
      focused: false,
      selected: false,
      focus() { this.focused = true; },
      select() { this.selected = true; }
    };
  },
  execCommand(command) {
    legacyCopyCommands.push(command);
    return command === 'copy';
  },
  dispatchEvent(event) {
    documentEvents.push(['document', event.type, event.detail]);
    return true;
  }
};

const runtime = createComposerRuntime({ windowRef, documentRef, navigatorRef });

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
assert.equal(runtime.populateEditorLanguageSelect(), true);
assert.deepEqual(populateCalls, ['populate']);
assert.equal(runtime.emitEditorLanguageControlMounted(), true);
assert.deepEqual(documentEvents.at(-1), [
  'document',
  COMPOSER_RUNTIME_EVENTS.editorLanguageControlMounted,
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
assert.equal(runtime.matchesMedia('(prefers-reduced-motion: reduce)'), true);
assert.equal(runtime.matchesMedia('(min-width: 1px)'), false);
assert.deepEqual(runtime.getViewportSize(), { width: 1180, height: 740 });
assert.equal(runtime.getViewportWidth(), 1180);
assert.deepEqual(runtime.getWindowScroll(), { x: 7, y: 19 });
assert.equal(runtime.scrollWindowToTop('smooth'), true);
assert.deepEqual(scrolls.at(-1), [{ top: 0, behavior: 'smooth' }]);
assert.equal(runtime.scrollWindowToTop('auto'), true);
assert.deepEqual(scrolls.at(-1), [0, 0]);
assert.deepEqual(runtime.getComputedStyle({ nodeType: 1 }), { marginTop: '4px', marginBottom: '8px' });
assert.equal(runtime.getResizeObserver(), TestResizeObserver);
assert.equal(await runtime.writeClipboardText('copy me'), true);
assert.deepEqual(clipboardWrites, ['copy me']);
assert.deepEqual(legacyCopyCommands, []);

const fallbackRuntime = createComposerRuntime({
  windowRef: { ...windowRef, isSecureContext: false },
  documentRef,
  navigatorRef
});
assert.equal(await fallbackRuntime.writeClipboardText('legacy copy'), true);
assert.equal(appendedNodes.length, 1);
assert.equal(removedNodes.length, 1);
assert.equal(appendedNodes[0], removedNodes[0]);
assert.equal(appendedNodes[0].value, 'legacy copy');
assert.equal(appendedNodes[0].focused, true);
assert.equal(appendedNodes[0].selected, true);
assert.deepEqual(legacyCopyCommands, ['copy']);

const noBrowserEffectsRuntime = createComposerRuntime({
  windowRef: {
    ...windowRef,
    fetch: undefined,
    alert: undefined,
    confirm: undefined,
    performance: undefined,
    CSS: undefined,
    ResizeObserver: undefined
  },
  documentRef,
  navigatorRef
});
assert.equal(
  noBrowserEffectsRuntime.showAlert('missing alert'),
  false,
  'composer runtime should not fall back to ambient alert outside the app runtime browser facade'
);
assert.equal(
  noBrowserEffectsRuntime.confirmAction('missing confirm'),
  false,
  'composer runtime should not fall back to ambient confirm outside the app runtime browser facade'
);
assert.equal(
  noBrowserEffectsRuntime.getPerformance(),
  null,
  'composer runtime should not fall back to ambient performance outside the app runtime browser facade'
);
assert.equal(
  noBrowserEffectsRuntime.getCss(),
  null,
  'composer runtime should not fall back to ambient CSS outside the app runtime browser facade'
);
assert.equal(
  noBrowserEffectsRuntime.getResizeObserver(),
  null,
  'composer runtime should not fall back to ambient ResizeObserver outside the app runtime browser facade'
);
await assert.rejects(
  noBrowserEffectsRuntime.fetchContent('/missing.yaml'),
  /Fetch is not available/,
  'composer runtime fetch should fail through the browser facade when no runtime fetch adapter exists'
);

const originalGlobalGetComputedStyle = globalThis.getComputedStyle;
const ambientStyleCalls = [];
globalThis.getComputedStyle = (element) => {
  ambientStyleCalls.push(element);
  return element ? { display: 'grid' } : null;
};
try {
  const fallbackStyleRuntime = createComposerRuntime({
    windowRef: { ...windowRef, getComputedStyle: undefined },
    documentRef
  });
  assert.equal(fallbackStyleRuntime.getComputedStyle({ nodeType: 1 }), null);
  assert.deepEqual(
    ambientStyleCalls,
    [],
    'composer runtime computed-style lookup should not fall back to ambient globalThis'
  );
} finally {
  if (typeof originalGlobalGetComputedStyle === 'function') {
    globalThis.getComputedStyle = originalGlobalGetComputedStyle;
  } else {
    delete globalThis.getComputedStyle;
  }
}

const response = await runtime.fetchContent('/site.yaml', { cache: 'no-store' });
assert.equal(response.ok, true);
assert.deepEqual(fetchCalls, [['/site.yaml', { cache: 'no-store' }]]);
