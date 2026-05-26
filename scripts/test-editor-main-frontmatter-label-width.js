import assert from 'node:assert/strict';

import { createFrontMatterLabelWidthSync } from '../assets/js/editor-main-frontmatter-label-width.js';

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

function createElement(className = '', textContent = '') {
  const element = {
    className,
    textContent,
    children: [],
    parentElement: null,
    style: createStyle(),
    removed: false,
    get scrollWidth() {
      return Math.ceil(String(this.textContent || '').length * 9);
    },
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    remove() {
      this.removed = true;
      if (this.parentElement) {
        this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
        this.parentElement = null;
      }
    },
    getBoundingClientRect() {
      return { width: this.scrollWidth, height: 18, left: 0, top: 0 };
    },
    closest(selector) {
      if (selector !== '.frontmatter-field-label-wrap') return null;
      let node = this;
      while (node) {
        if (node.className === 'frontmatter-field-label-wrap') return node;
        node = node.parentElement;
      }
      return null;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const matches = [];
      const expected = selector.startsWith('.') ? selector.slice(1) : selector;
      const visit = (node) => {
        if (node.className === expected) matches.push(node);
        node.children.forEach(visit);
      };
      this.children.forEach(visit);
      return matches;
    }
  };
  return element;
}

function createRoot() {
  const root = createElement('frontmatter-panel');
  root.querySelectorAll = function querySelectorAll(selector) {
    if (selector !== '.frontmatter-field-title') return [];
    const labels = [];
    const visit = (node) => {
      if (node.className === 'frontmatter-field-title') labels.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return labels;
  };
  return root;
}

function createLabelField(labelText, tooltipText = '') {
  const wrap = createElement('frontmatter-field-label-wrap');
  const label = createElement('frontmatter-field-title', labelText);
  wrap.appendChild(label);
  if (tooltipText) {
    wrap.appendChild(createElement('frontmatter-help-tooltip', tooltipText));
  }
  return { wrap, label };
}

function createDocument(fontsReady = null) {
  const body = createElement('body');
  return {
    body,
    fonts: fontsReady ? { ready: fontsReady } : null,
    createElement(tagName) {
      const element = createElement(String(tagName || '').toLowerCase());
      element.style = {};
      return element;
    }
  };
}

{
  const root = createRoot();
  root.style.setProperty('--frontmatter-single-label-width', '120px');

  const { syncFrontMatterLabelWidth } = createFrontMatterLabelWidthSync({
    documentRef: createDocument()
  });
  syncFrontMatterLabelWidth(root);

  assert.equal(root.style.props.has('--frontmatter-single-label-width'), false);
}

{
  const root = createRoot();
  const { wrap, label } = createLabelField('Translated Title', '?');
  root.appendChild(wrap);
  const canceledFrames = [];
  const computedTargets = [];

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

  const { syncFrontMatterLabelWidth } = createFrontMatterLabelWidthSync({
    documentRef: createDocument(Promise.resolve()),
    requestFrame: (handler) => {
      handler();
      return 'frame:label-width';
    },
    cancelFrame: id => canceledFrames.push(id),
    getComputedStyle: (target) => {
      computedTargets.push(target);
      return {
        fontFamily: 'Inter',
        fontSize: '14px',
        fontStyle: 'normal',
        fontWeight: '600',
        letterSpacing: '0px',
        textTransform: 'none',
        gap: '5px',
        columnGap: '5px'
      };
    },
    ResizeObserver: FakeResizeObserver
  });

  syncFrontMatterLabelWidth(root);

  const width = root.style.props.get('--frontmatter-single-label-width');
  assert.match(width, /^\d+px$/);
  assert.ok(Number.parseInt(width, 10) > 88);
  assert.equal(computedTargets.includes(label), true);
  assert.equal(computedTargets.includes(wrap), true);
  assert.equal(FakeResizeObserver.instances.length, 1);
  assert.equal(FakeResizeObserver.instances[0].observed.includes(root), true);
  assert.equal(FakeResizeObserver.instances[0].observed.includes(wrap), true);

  root.__pressFrontMatterLabelWidthCleanup();
  assert.deepEqual(canceledFrames, ['frame:label-width']);
  assert.equal(FakeResizeObserver.instances[0].disconnected, true);
}

{
  const root = createRoot();
  const { wrap } = createLabelField('Title');
  root.appendChild(wrap);
  const disconnected = [];

  class FakeResizeObserver {
    constructor() {
      this.disconnected = false;
    }

    observe() {}

    disconnect() {
      this.disconnected = true;
      disconnected.push(this);
    }
  }

  const { syncFrontMatterLabelWidth } = createFrontMatterLabelWidthSync({
    documentRef: createDocument(),
    requestFrame: (handler) => {
      handler();
      return 'frame:previous';
    },
    ResizeObserver: FakeResizeObserver
  });

  syncFrontMatterLabelWidth(root);
  syncFrontMatterLabelWidth(root);

  assert.equal(disconnected.length, 1);
  assert.equal(disconnected[0].disconnected, true);
}
