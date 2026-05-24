import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEditorBootRuntime } from '../assets/js/editor-boot-runtime.js';

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
    return true;
  }
}

class FakeCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

{
  const languageSelect = {
    id: 'editorLangSelect',
    children: [],
    appendChild(node) {
      this.children.push(node);
    }
  };
  const translated = [{ id: 'title' }, { id: 'button' }];
  const documentRef = new FakeEventTarget();
  documentRef.title = '';
  documentRef.readyState = 'loading';
  documentRef.querySelectorAll = selector => (selector === '*' ? translated : []);
  documentRef.getElementById = id => (id === 'editorLangSelect' ? languageSelect : null);
  documentRef.createElement = tagName => ({ tagName: String(tagName || '').toUpperCase() });

  const windowRef = new FakeEventTarget();
  windowRef.CustomEvent = FakeCustomEvent;

  const runtime = createEditorBootRuntime({ windowRef, documentRef });
  assert.deepEqual(runtime.getTranslationElements().map(node => node.id), ['title', 'button']);
  assert.deepEqual(
    runtime.getTranslationElements({ querySelectorAll: () => [{ id: 'scoped' }] }).map(node => node.id),
    ['scoped']
  );
  assert.equal(runtime.setDocumentTitle('Editor'), true);
  assert.equal(documentRef.title, 'Editor');
  assert.equal(runtime.getLanguageSelect(), languageSelect);
  const option = runtime.createOption();
  option.value = 'en';
  languageSelect.appendChild(option);
  assert.deepEqual(languageSelect.children, [{ tagName: 'OPTION', value: 'en' }]);

  let mountedCalls = 0;
  const detachMounted = runtime.onLanguageControlMounted(() => { mountedCalls += 1; });
  documentRef.dispatchEvent({ type: 'press-editor-language-control-mounted' });
  assert.equal(mountedCalls, 1);
  detachMounted();
  documentRef.dispatchEvent({ type: 'press-editor-language-control-mounted' });
  assert.equal(mountedCalls, 1);

  let bundleLang = '';
  runtime.onI18nBundleLoaded(event => { bundleLang = event.detail.lang; });
  windowRef.dispatchEvent({ type: 'ns:i18n-bundle-loaded', detail: { lang: 'ja' } });
  assert.equal(bundleLang, 'ja');

  let readyCalls = 0;
  runtime.onDocumentReady(() => { readyCalls += 1; });
  documentRef.dispatchEvent({ type: 'DOMContentLoaded' });
  assert.equal(readyCalls, 1);

  assert.equal(runtime.emitLanguageApplied(), true);
  assert.equal(documentRef.dispatched.at(-1).type, 'press-editor-language-applied');

  function populate() {}
  async function softReset() {}
  assert.equal(runtime.setPopulateLanguageSelect(populate), true);
  assert.equal(runtime.setSoftResetLanguage(softReset), true);
  assert.equal(windowRef.__pressPopulateEditorLanguageSelect, populate);
  assert.equal(windowRef.__press_softResetLang, softReset);
}

{
  const ambientCalls = [];
  const originals = new Map();
  const hadOriginal = new Map();
  ['document', 'window'].forEach((name) => {
    hadOriginal.set(name, Object.prototype.hasOwnProperty.call(globalThis, name));
    originals.set(name, globalThis[name]);
  });
  try {
    globalThis.document = {
      querySelectorAll() {
        ambientCalls.push('document.querySelectorAll');
        return [{ id: 'ambient' }];
      },
      getElementById() {
        ambientCalls.push('document.getElementById');
        return { id: 'ambient-select' };
      }
    };
    globalThis.window = {
      addEventListener() {
        ambientCalls.push('window.addEventListener');
      }
    };

    const runtime = createEditorBootRuntime({ windowRef: {}, documentRef: null, storage: null });
    assert.deepEqual(runtime.getTranslationElements(), []);
    assert.equal(runtime.setDocumentTitle('Ignored'), false);
    assert.equal(runtime.getLanguageSelect(), null);
    assert.equal(runtime.createOption(), null);
    assert.equal(runtime.emitLanguageApplied(), false);
    assert.deepEqual(ambientCalls, []);
  } finally {
    ['document', 'window'].forEach((name) => {
      if (hadOriginal.get(name)) globalThis[name] = originals.get(name);
      else delete globalThis[name];
    });
  }
}

{
  const here = dirname(fileURLToPath(import.meta.url));
  const bootSource = readFileSync(resolve(here, '../assets/js/editor-boot.js'), 'utf8');
  const bootRuntimeSource = readFileSync(resolve(here, '../assets/js/editor-boot-runtime.js'), 'utf8');

  assert.match(
    bootSource,
    /from '\.\/editor-boot-runtime\.js\?v=[\w.-]+'/,
    'editor boot should import the explicit boot runtime boundary'
  );
  assert.doesNotMatch(
    bootSource,
    /\b(?:window|document|CustomEvent)\b|DOMContentLoaded|(?:window|document)\.addEventListener\(/,
    'editor boot should not directly reach browser globals or DOM ready listeners'
  );
  assert.match(
    bootRuntimeSource,
    /createBrowserEditorAppRuntime\(options\)[\s\S]*onDocumentReady[\s\S]*onLanguageControlMounted[\s\S]*onI18nBundleLoaded[\s\S]*emitLanguageApplied/,
    'editor boot runtime should wrap the shared app runtime for boot events and globals'
  );
}

console.log('editor boot runtime tests passed');
