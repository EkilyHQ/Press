import assert from 'node:assert/strict';

import { createEditorMainMetadataPanel } from '../assets/js/editor-main-metadata-panel.js';

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  setFromString(value) {
    this.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
  }

  sync() {
    this.owner._className = Array.from(this.values).join(' ');
  }

  add(name) {
    this.values.add(name);
    this.sync();
  }

  remove(name) {
    this.values.delete(name);
    this.sync();
  }

  contains(name) {
    return this.values.has(name);
  }
}

function createStyle() {
  const props = new Map();
  return {
    props,
    setProperty(name, value) {
      props.set(name, String(value));
    },
    removeProperty(name) {
      props.delete(name);
    }
  };
}

class FakeElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = createStyle();
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this._className = '';
    this.classList = new FakeClassList(this);
  }

  set className(value) {
    this._className = String(value || '');
    this.classList.setFromString(this._className);
  }

  get className() {
    return this._className;
  }

  get scrollWidth() {
    return Math.ceil(String(this.textContent || '').length * 8);
  }

  appendChild(child) {
    if (!child) return child;
    child.parentElement = this;
    if (!child.ownerDocument) child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  append(...items) {
    items.forEach((item) => this.appendChild(item));
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    const text = String(value ?? '');
    this.attributes.set(name, text);
    if (name === 'id') this.id = text;
    if (name === 'hidden') this.hidden = true;
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = text;
    }
  }

  getAttribute(name) {
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return Object.prototype.hasOwnProperty.call(this.dataset, key) ? this.dataset[key] : null;
    }
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  closest(selector) {
    if (!selector || !selector.startsWith('.')) return null;
    const className = selector.slice(1);
    let node = this;
    while (node) {
      if (node.classList && node.classList.contains(className)) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    if (!selector || !selector.startsWith('.')) return [];
    const className = selector.slice(1);
    const found = [];
    const visit = (node) => {
      if (!node) return;
      if (node.classList && node.classList.contains(className)) found.push(node);
      (node.children || []).forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }

  getBoundingClientRect() {
    return { width: this.scrollWidth, height: 20, left: 0, top: 0 };
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.body = new FakeElement('body', this);
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  setElement(id, element) {
    element.id = id;
    element.ownerDocument = this;
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  querySelector(selector) {
    const idMatch = String(selector || '').match(/^#([A-Za-z0-9_-]+)\s+(\.[A-Za-z0-9_-]+)$/);
    if (idMatch) {
      const root = this.getElementById(idMatch[1]);
      return root ? root.querySelector(idMatch[2]) : null;
    }
    return this.body.querySelector(selector);
  }
}

function createFixture() {
  const documentRef = new FakeDocument();
  const panel = documentRef.setElement('frontMatterPanel', documentRef.createElement('section'));
  const body = documentRef.setElement('frontMatterBody', documentRef.createElement('div'));
  const commonSection = documentRef.setElement('frontMatterCommonSection', documentRef.createElement('section'));
  const commonFields = documentRef.setElement('frontMatterCommonFields', documentRef.createElement('div'));
  const commonDescription = documentRef.createElement('p');
  commonDescription.className = 'frontmatter-section-description';
  commonSection.append(commonDescription, commonFields);
  const extraSection = documentRef.setElement('frontMatterExtraSection', documentRef.createElement('section'));
  const extraFields = documentRef.setElement('frontMatterExtraFields', documentRef.createElement('div'));
  const extraDescription = documentRef.createElement('p');
  extraDescription.className = 'frontmatter-section-description';
  extraSection.append(extraDescription, extraFields);
  const empty = documentRef.setElement('frontMatterEmpty', documentRef.createElement('div'));
  body.append(commonSection, extraSection, empty);
  panel.appendChild(body);
  documentRef.body.appendChild(panel);

  const computedTargets = [];
  const canceledFrames = [];
  class FakeResizeObserver {
    static instances = [];

    constructor(callback) {
      this.callback = callback;
      this.observed = [];
      this.disconnected = false;
      FakeResizeObserver.instances.push(this);
    }

    observe(target) {
      this.observed.push(target);
    }

    disconnect() {
      this.disconnected = true;
    }
  }

  const runtime = {
    getElementById: id => documentRef.getElementById(id),
    requestFrame: (handler) => {
      if (typeof handler === 'function') handler();
      return 'frame:metadata';
    },
    cancelFrame: id => canceledFrames.push(id),
    getComputedStyle: (element) => {
      computedTargets.push(element);
      return {
        fontFamily: 'Inter',
        fontSize: '14px',
        fontStyle: 'normal',
        fontWeight: '600',
        letterSpacing: '0px',
        textTransform: 'none',
        gap: '6px',
        columnGap: '6px'
      };
    },
    getResizeObserver: () => FakeResizeObserver
  };

  return { documentRef, panel, runtime, computedTargets, canceledFrames, FakeResizeObserver };
}

function createTrackingOwnerDocument() {
  const calls = [];
  return {
    calls,
    body: new FakeElement('body'),
    createElement(tagName) {
      calls.push(`createElement:${tagName}`);
      return new FakeElement(tagName, this);
    }
  };
}

{
  const fixture = createFixture();
  const session = createEditorMainMetadataPanel({
    runtime: fixture.runtime,
    documentRef: fixture.documentRef,
    translate: key => key
  });

  assert.equal(session.panel, fixture.panel);
  const labelWidth = fixture.panel.style.props.get('--frontmatter-single-label-width');
  assert.match(labelWidth, /^\d+px$/);
  assert.ok(Number.parseInt(labelWidth, 10) >= 88);
  assert.ok(fixture.computedTargets.length > 0);
  assert.equal(fixture.FakeResizeObserver.instances.length > 0, true);
  assert.equal(fixture.FakeResizeObserver.instances[0].observed.includes(fixture.panel), true);

  fixture.panel.__pressFrontMatterLabelWidthCleanup();
  assert.ok(fixture.canceledFrames.length > 0);
  assert.equal(fixture.canceledFrames.every((id) => id === 'frame:metadata'), true);
  assert.equal(fixture.FakeResizeObserver.instances.at(-1).disconnected, true);
}

{
  const fixture = createFixture();
  const session = createEditorMainMetadataPanel({
    runtime: fixture.runtime,
    documentRef: fixture.documentRef,
    translate: key => key
  });
  const ownerDocument = createTrackingOwnerDocument();
  fixture.panel.querySelectorAll('.frontmatter-field-title').forEach((label) => {
    label.ownerDocument = ownerDocument;
  });

  session.frontMatterManager.syncLabelWidth();

  assert.deepEqual(ownerDocument.calls, []);
  assert.match(fixture.panel.style.props.get('--frontmatter-single-label-width'), /^\d+px$/);
}
