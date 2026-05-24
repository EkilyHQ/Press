import assert from 'node:assert/strict';

import { createEditorPreviewAppRuntime } from '../assets/js/editor-preview-app-runtime.js';

function createWindowRef() {
  const listeners = new Map();
  return {
    listeners,
    parent: {
      messages: [],
      postMessage(payload, origin) {
        this.messages.push({ payload, origin });
      }
    },
    location: { origin: 'https://preview.test' },
    matchMedia(query) {
      return { matches: query === '(prefers-color-scheme: dark)' };
    },
    console: {
      warnings: [],
      warn(...args) {
        this.warnings.push(args);
      }
    },
    localStorage: {
      values: new Map(),
      getItem(key) {
        return this.values.has(key) ? this.values.get(key) : null;
      },
      setItem(key, value) {
        this.values.set(key, String(value));
      }
    },
    addEventListener(type, handler, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ handler, options });
    },
    removeEventListener(type, handler, options) {
      const current = listeners.get(type) || [];
      listeners.set(type, current.filter(item => item.handler !== handler || item.options !== options));
    },
    fetch(url, options) {
      return Promise.resolve({
        ok: url === 'wwwroot/post.md',
        options,
        text: () => Promise.resolve(url === 'wwwroot/post.md' ? '# Post' : 'ignored')
      });
    }
  };
}

function createDocumentRef() {
  const attrs = new Map();
  const themePackLink = {
    attrs: new Map([['href', 'assets/themes/native/theme.css?v=old']]),
    getAttribute(name) {
      return this.attrs.has(name) ? this.attrs.get(name) : null;
    },
    setAttribute(name, value) {
      this.attrs.set(name, String(value));
    }
  };
  const statusElement = { hidden: false, textContent: '' };
  const body = { dataset: { themeLayout: 'glasswing' }, hidden: false, textContent: '' };
  const elementsById = new Map([
    ['theme-pack', themePackLink],
    ['editorPreviewStatus', statusElement]
  ]);
  const selectorNodes = new Map([
    ['[data-theme-region="main"], .native-mainview', { region: 'main' }],
    ['.content', { region: 'content' }]
  ]);
  const removedExtraLinks = [];
  const appendedHeadNodes = [];
  return {
    themePackLink,
    statusElement,
    body,
    elementsById,
    selectorNodes,
    removedExtraLinks,
    appendedHeadNodes,
    documentElement: {
      attrs,
      setAttribute(name, value) {
        attrs.set(name, String(value));
      },
      removeAttribute(name) {
        attrs.delete(name);
      },
      getAttribute(name) {
        return attrs.has(name) ? attrs.get(name) : null;
      }
    },
    getElementById(id) {
      return elementsById.get(id) || null;
    },
    querySelector(selector) {
      return selectorNodes.get(selector) || null;
    },
    querySelectorAll(selector) {
      if (selector !== 'link[data-theme-pack-extra-style]') return [];
      return [
        { remove: () => removedExtraLinks.push('old-extra-1') },
        { remove: () => removedExtraLinks.push('old-extra-2') }
      ];
    },
    createElement(tagName) {
      return {
        tagName: String(tagName || '').toUpperCase(),
        attrs: new Map(),
        rel: '',
        href: '',
        setAttribute(name, value) {
          this.attrs.set(name, String(value));
        },
        getAttribute(name) {
          return this.attrs.has(name) ? this.attrs.get(name) : null;
        }
      };
    },
    head: {
      appendChild(node) {
        appendedHeadNodes.push(node);
      }
    }
  };
}

{
  const windowRef = createWindowRef();
  const documentRef = createDocumentRef();
  const runtime = createEditorPreviewAppRuntime({ windowRef, documentRef });

  assert.equal(runtime.postToParent({ type: 'ready' }), true);
  assert.deepEqual(windowRef.parent.messages, [
    { payload: { type: 'ready' }, origin: 'https://preview.test' }
  ]);

  const events = [];
  const detach = runtime.onRenderMessage(event => events.push(event.data));
  assert.equal(windowRef.listeners.get('message').length, 1);
  windowRef.listeners.get('message')[0].handler({ origin: 'https://preview.test', data: { type: 'render' } });
  assert.deepEqual(events, [{ type: 'render' }]);
  assert.equal(runtime.isTrustedMessageEvent({ origin: 'https://preview.test' }), true);
  assert.equal(runtime.isTrustedMessageEvent({ origin: 'https://elsewhere.test' }), false);
  detach();
  assert.equal(windowRef.listeners.get('message').length, 0);

  assert.equal(runtime.beginRender('7'), 7);
  assert.equal(runtime.isCurrentRender(7), true);
  assert.equal(runtime.isCurrentRender(6), false);
  assert.equal(runtime.beginRender('not-a-number'), 0);
  assert.equal(runtime.isCurrentRender(0), true);
  assert.equal(runtime.getActiveThemePack(), '');
  assert.equal(runtime.shouldResetThemePack('native'), true);
  assert.equal(runtime.setActiveThemePack('native'), 'native');
  assert.equal(runtime.getActiveThemePack(), 'native');
  assert.equal(runtime.shouldResetThemePack('native'), false);
  assert.equal(runtime.shouldResetThemePack('arcus'), true);

  runtime.applyColorMode({ themeMode: 'dark' });
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), 'dark');
  runtime.applyColorMode({ themeMode: 'light' });
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), null);
  runtime.applyColorMode({ themeMode: 'auto' });
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), 'dark');
  windowRef.localStorage.setItem('theme', 'light');
  runtime.applyColorMode({});
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), null);
  windowRef.localStorage.setItem('theme', 'dark');
  runtime.applyColorMode({});
  assert.equal(documentRef.documentElement.getAttribute('data-theme'), 'dark');

  assert.equal(
    runtime.querySelector('[data-theme-region="main"], .native-mainview'),
    documentRef.selectorNodes.get('[data-theme-region="main"], .native-mainview')
  );
  assert.equal(runtime.querySelector('[data-theme-region="missing"]'), null);
  assert.equal(runtime.getBody(), documentRef.body);
  assert.equal(runtime.getThemeLayoutPackFallback(), 'glasswing');
  assert.equal(runtime.getPreviewStatusElement(), documentRef.statusElement);
  assert.equal(runtime.getPreviewStatusElement({ fallbackToBody: true }), documentRef.statusElement);
  documentRef.elementsById.delete('editorPreviewStatus');
  assert.equal(runtime.getPreviewStatusElement(), null);
  assert.equal(runtime.getPreviewStatusElement({ fallbackToBody: true }), documentRef.body);

  runtime.warn('theme failed');
  assert.deepEqual(windowRef.console.warnings, [['theme failed']]);

  assert.equal(await runtime.fetchText('wwwroot/post.md'), '# Post');
  assert.equal(await runtime.fetchText('wwwroot/missing.md'), '');

  assert.equal(runtime.applyThemeStyleLinks({
    primary: 'assets/themes/native/theme.css?v=press-system-v3.4.50',
    extraHrefs: [
      'assets/themes/native/extra.css?v=press-system-v3.4.50',
      'assets/themes/native/print.css?v=press-system-v3.4.50'
    ],
    pack: 'native'
  }), true);
  assert.equal(
    documentRef.themePackLink.getAttribute('href'),
    'assets/themes/native/theme.css?v=press-system-v3.4.50'
  );
  assert.equal(windowRef.__themePackHref, 'assets/themes/native/theme.css?v=press-system-v3.4.50');
  assert.deepEqual(documentRef.removedExtraLinks, ['old-extra-1', 'old-extra-2']);
  assert.equal(documentRef.appendedHeadNodes.length, 2);
  assert.equal(documentRef.appendedHeadNodes[0].tagName, 'LINK');
  assert.equal(documentRef.appendedHeadNodes[0].rel, 'stylesheet');
  assert.equal(documentRef.appendedHeadNodes[0].href, 'assets/themes/native/extra.css?v=press-system-v3.4.50');
  assert.equal(documentRef.appendedHeadNodes[0].getAttribute('data-theme-pack-extra-style'), 'native:1');
  assert.equal(documentRef.appendedHeadNodes[1].getAttribute('data-theme-pack-extra-style'), 'native:2');
  assert.equal(runtime.applyThemeStyleLinks(), false);
}

{
  const ambientCalls = [];
  const originals = new Map();
  const hadOriginal = new Map();
  ['window', 'document', 'localStorage', 'fetch'].forEach((name) => {
    hadOriginal.set(name, Object.prototype.hasOwnProperty.call(globalThis, name));
    originals.set(name, globalThis[name]);
  });

  try {
    globalThis.window = {
      parent: {
        postMessage() {
          ambientCalls.push('window.parent.postMessage');
        }
      },
      location: { origin: 'https://ambient.test' },
      addEventListener() {
        ambientCalls.push('window.addEventListener');
      }
    };
    globalThis.document = {
      documentElement: {
        setAttribute() {
          ambientCalls.push('document.documentElement.setAttribute');
        }
      },
      body: {
        dataset: { themeLayout: 'ambient' }
      },
      getElementById() {
        ambientCalls.push('document.getElementById');
      },
      querySelector() {
        ambientCalls.push('document.querySelector');
      }
    };
    globalThis.localStorage = {
      getItem() {
        ambientCalls.push('localStorage.getItem');
        return 'dark';
      }
    };
    globalThis.fetch = () => {
      ambientCalls.push('fetch');
      return Promise.resolve({ ok: true, text: () => Promise.resolve('ambient') });
    };

    const runtime = createEditorPreviewAppRuntime({ windowRef: {}, documentRef: {}, storage: null });
    assert.equal(runtime.postToParent({ type: 'ambient' }), false);
    assert.equal(runtime.applyColorMode({}), false);
    assert.equal(runtime.applyThemeStyleLinks({ primary: 'ambient.css', extraHrefs: ['ambient-extra.css'] }), true);
    assert.equal(runtime.querySelector('.ambient'), null);
    assert.equal(runtime.getBody(), null);
    assert.equal(runtime.getThemeLayoutPackFallback(), '');
    assert.equal(runtime.getPreviewStatusElement({ fallbackToBody: true }), null);
    assert.equal(await runtime.fetchText('ambient.md'), '');
    assert.deepEqual(ambientCalls, []);
  } finally {
    ['window', 'document', 'localStorage', 'fetch'].forEach((name) => {
      if (hadOriginal.get(name)) globalThis[name] = originals.get(name);
      else delete globalThis[name];
    });
  }
}
