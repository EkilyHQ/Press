import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createErrorReporter } from '../assets/js/errors.js';

const source = readFileSync(new URL('../assets/js/errors.js', import.meta.url), 'utf8');

for (const name of ['reporterConfig', 'overlayUIEnabled', 'extraContext', 'overlayQueue', 'overlayShowing']) {
  assert.doesNotMatch(
    source,
    new RegExp(`^let\\s+${name}\\b`, 'm'),
    `errors should not keep ${name} as module-level mutable state`
  );
}

assert.doesNotMatch(
  source,
  /^const\s+overlayDedup\s*=\s*new\s+Set\(/m,
  'errors should not keep overlay dedupe state at module scope'
);
assert.match(
  source,
  /export function createErrorReporter\(options = \{\}\) \{[\s\S]*const defaultErrorReporter = createErrorReporter\(\)[\s\S]*export function initErrorReporter\(options = \{\}\)/,
  'errors should expose explicit reporter instances while preserving compatibility exports'
);

function createDocumentRef(lang) {
  return {
    documentElement: {
      getAttribute(name) {
        return name === 'lang' ? lang : '';
      }
    }
  };
}

function createWindowRef(href) {
  const parsed = new URL(href);
  const listeners = [];
  const opened = [];
  return {
    location: {
      href: parsed.href,
      search: parsed.search
    },
    navigator: {
      userAgent: `ua:${parsed.hostname}`
    },
    addEventListener(type, handler, options) {
      listeners.push({ type, handler, options });
    },
    open(url, target, features) {
      opened.push({ url, target, features });
      return {};
    },
    listeners,
    opened
  };
}

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

try {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    get() {
      throw new Error('explicit reporter refs should not read global document');
    }
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    get() {
      throw new Error('explicit reporter refs should not read global window');
    }
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    get() {
      throw new Error('explicit reporter refs should not read global navigator');
    }
  });

  const firstWindow = createWindowRef('https://first.example.test/editor?tab=posts&lang=en');
  const secondWindow = createWindowRef('https://second.example.test/?preview=1');
  const firstTimers = [];
  const secondTimers = [];
  const firstReporter = createErrorReporter({
    documentRef: createDocumentRef('en'),
    windowRef: firstWindow,
    setTimer(callback, delay) {
      firstTimers.push({ callback, delay });
      return firstTimers.length;
    },
    clearTimer() {}
  });
  const secondReporter = createErrorReporter({
    documentRef: createDocumentRef('ja'),
    windowRef: secondWindow,
    navigatorRef: { userAgent: 'custom-second-agent' },
    setTimer(callback, delay) {
      secondTimers.push({ callback, delay });
      return secondTimers.length;
    },
    clearTimer() {}
  });

  firstReporter.init({
    reportUrl: 'https://bugs.example.test/new',
    siteTitle: 'First Press',
    enableOverlay: false
  });
  firstReporter.init({
    reportUrl: 'https://bugs.example.test/new',
    siteTitle: 'First Press',
    enableOverlay: false
  });
  secondReporter.init({ siteTitle: 'Second Press', enableOverlay: false });

  assert.equal(firstWindow.listeners.length, 3);
  assert.equal(firstWindow.listeners.filter((entry) => entry.type === 'error').length, 2);
  assert.equal(firstWindow.listeners.filter((entry) => entry.type === 'unhandledrejection').length, 1);
  assert.equal(firstWindow.__nano_error_handlers_installed, true);
  assert.equal(secondWindow.listeners.length, 3);

  firstReporter.setReporterContext({ route: '/first', shared: 'first' });
  secondReporter.setReporterContext({ route: '/second', shared: 'second' });

  const firstPayload = firstReporter.formatReportPayload(new Error('first boom'), {
    filename: 'first.js',
    lineno: 12,
    colno: 3,
    shared: 'local-first'
  });
  const secondPayload = secondReporter.formatReportPayload(new Error('second boom'), {
    filename: 'second.js',
    note: 'second note'
  });

  assert.equal(firstPayload.app, 'First Press');
  assert.equal(firstPayload.url, 'https://first.example.test/editor?tab=posts&lang=en');
  assert.equal(firstPayload.lang, 'en');
  assert.equal(firstPayload.userAgent, 'ua:first.example.test');
  assert.deepEqual(firstPayload.query, { tab: 'posts', lang: 'en' });
  assert.equal(firstPayload.context.route, '/first');
  assert.equal(firstPayload.context.shared, 'local-first');
  assert.equal(firstPayload.filename, 'first.js');
  assert.equal(firstPayload.lineno, 12);
  assert.equal(firstPayload.colno, 3);

  assert.equal(secondPayload.app, 'Second Press');
  assert.equal(secondPayload.url, 'https://second.example.test/?preview=1');
  assert.equal(secondPayload.lang, 'ja');
  assert.equal(secondPayload.userAgent, 'custom-second-agent');
  assert.deepEqual(secondPayload.query, { preview: '1' });
  assert.equal(secondPayload.context.route, '/second');
  assert.equal(secondPayload.context.shared, 'second');
  assert.equal(secondPayload.note, 'second note');
  assert.equal(secondPayload.filename, 'second.js');
  assert.equal(firstTimers.length, 0);
  assert.equal(secondTimers.length, 0);
} finally {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else delete globalThis.document;
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else delete globalThis.window;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete globalThis.navigator;
}

console.log('ok - error reporter state is scoped to explicit reporter instances');
