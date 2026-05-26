import assert from 'node:assert/strict';

import {
  createEditorMainPreviewThemePicker,
  sanitizePreviewThemePack
} from '../assets/js/editor-main-preview-theme-picker.js';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.children = [];
    this.listeners = new Map();
    this._innerHTML = '';
    this.value = '';
    this.textContent = '';
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    if (!child) return child;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatch(type, overrides = {}) {
    const event = { type, target: this, ...overrides };
    (this.listeners.get(type) || []).forEach((handler) => handler(event));
    return event;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  setElement(id, element) {
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

const optionValues = (select) => select.children.map(option => option.value);
const optionLabels = (select) => select.children.map(option => option.textContent);

assert.equal(sanitizePreviewThemePack(' Arcus!! '), 'arcus');
assert.equal(sanitizePreviewThemePack('../Native'), 'native');
assert.equal(sanitizePreviewThemePack(''), 'native');

{
  const documentRef = new FakeDocument();
  const select = documentRef.setElement('previewThemeSelect', new FakeElement('select'));
  const picker = createEditorMainPreviewThemePicker({
    documentRef,
    getElementById: id => documentRef.getElementById(id),
    getSiteThemePack: () => 'Glasswing'
  });

  picker.updateSelect();

  assert.deepEqual(optionValues(select), ['native', 'glasswing']);
  assert.deepEqual(optionLabels(select), ['Native', 'glasswing']);
  assert.equal(select.value, 'glasswing');
  assert.equal(picker.getActiveThemePack(), 'glasswing');
  assert.equal(picker.hasOverride(), false);
}

{
  const documentRef = new FakeDocument();
  const select = documentRef.setElement('previewThemeSelect', new FakeElement('select'));
  const fetchCalls = [];
  const fetchImpl = async (path, options) => {
    fetchCalls.push([path, options]);
    if (path.endsWith('packs.local.json')) {
      return {
        ok: true,
        json: async () => [
          { value: 'glasswing', label: 'Glasswing' },
          { value: 'Arcus', label: 'Duplicate Arcus' }
        ]
      };
    }
    return {
      ok: true,
      json: async () => [
        { value: 'Native', label: 'Native Theme' },
        { value: 'Arcus!!', label: 'Arcus Theme' }
      ]
    };
  };
  const picker = createEditorMainPreviewThemePicker({
    documentRef,
    getElementById: id => documentRef.getElementById(id),
    getSiteThemePack: () => 'arcus',
    fetch: fetchImpl
  });

  const loaded = await picker.loadOptions();

  assert.deepEqual(fetchCalls, [
    ['assets/themes/packs.json', { cache: 'no-store' }],
    ['assets/themes/packs.local.json', { cache: 'no-store' }]
  ]);
  assert.deepEqual(loaded, [
    { value: 'native', label: 'Native Theme' },
    { value: 'arcus', label: 'Arcus Theme' },
    { value: 'glasswing', label: 'Glasswing' }
  ]);
  assert.deepEqual(optionValues(select), ['native', 'arcus', 'glasswing']);
  assert.equal(select.value, 'arcus');
}

{
  const documentRef = new FakeDocument();
  const select = documentRef.setElement('previewThemeSelect', new FakeElement('select'));
  const picker = createEditorMainPreviewThemePicker({
    documentRef,
    getElementById: id => documentRef.getElementById(id),
    getSiteThemePack: () => 'native',
    fetch: async (path) => {
      if (path.endsWith('packs.local.json')) throw new Error('missing local overlay');
      return {
        ok: true,
        json: async () => [{ value: 'solstice', label: 'Solstice' }]
      };
    }
  });

  await picker.loadOptions();

  assert.deepEqual(optionValues(select), ['solstice', 'native']);
  assert.equal(select.value, 'native');
}

{
  const documentRef = new FakeDocument();
  const select = documentRef.setElement('previewThemeSelect', new FakeElement('select'));
  const picker = createEditorMainPreviewThemePicker({
    documentRef,
    getElementById: id => documentRef.getElementById(id),
    getSiteThemePack: () => 'native',
    fetch: async () => ({ ok: false, json: async () => [] })
  });

  const loaded = await picker.loadOptions();

  assert.deepEqual(loaded, [{ value: 'native', label: 'Native' }]);
  assert.deepEqual(optionValues(select), ['native']);
  assert.equal(select.value, 'native');
}

{
  const documentRef = new FakeDocument();
  const select = documentRef.setElement('previewThemeSelect', new FakeElement('select'));
  let changeCount = 0;
  const picker = createEditorMainPreviewThemePicker({
    documentRef,
    getElementById: id => documentRef.getElementById(id),
    getSiteThemePack: () => 'native',
    onChange: () => { changeCount += 1; }
  });

  picker.bind();
  select.value = 'Cartograph!';
  select.dispatch('change');

  assert.equal(changeCount, 1);
  assert.equal(picker.hasOverride(), true);
  assert.equal(picker.getActiveThemePack(), 'cartograph');
  assert.deepEqual(optionValues(select), ['native', 'cartograph']);
  assert.equal(select.value, 'cartograph');
}
