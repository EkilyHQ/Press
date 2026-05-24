import assert from 'node:assert/strict';

import { applyLangHints } from '../assets/js/typography.js';

function createElement(tagName) {
  return {
    tagName: String(tagName || '').toUpperCase(),
    childNodes: [],
    attributes: new Map(),
    closest() {
      return null;
    },
    appendChild(node) {
      this.childNodes.push(node);
      return node;
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return this.attributes.get(name) || '';
    }
  };
}

function createFakeDocument() {
  const nodeFilter = {
    SHOW_TEXT: 4,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
    FILTER_ACCEPT: 1
  };
  const created = [];
  return {
    nodeFilter,
    created,
    documentElement: {
      lang: 'chs',
      getAttribute(name) {
        return name === 'lang' ? 'chs' : '';
      }
    },
    querySelector(selector) {
      return selector === '#article' ? this.root : null;
    },
    createTreeWalker(root, showText, filter) {
      assert.equal(showText, nodeFilter.SHOW_TEXT, 'lang hints should use the injected NodeFilter constants');
      const nodes = Array.isArray(root && root.textNodes) ? root.textNodes.slice() : [];
      let index = 0;
      return {
        nextNode() {
          while (index < nodes.length) {
            const node = nodes[index];
            index += 1;
            if (!filter || typeof filter.acceptNode !== 'function') return node;
            if (filter.acceptNode(node) === nodeFilter.FILTER_ACCEPT) return node;
          }
          return null;
        }
      };
    },
    createDocumentFragment() {
      const fragment = createElement('#fragment');
      fragment.nodeType = 11;
      created.push(fragment);
      return fragment;
    },
    createElement(tagName) {
      const element = createElement(tagName);
      element.nodeType = 1;
      created.push(element);
      return element;
    },
    createTextNode(text) {
      const node = { nodeType: 3, nodeValue: String(text || ''), textContent: String(text || '') };
      created.push(node);
      return node;
    }
  };
}

const previousDocument = globalThis.document;
const previousNodeFilter = globalThis.NodeFilter;

globalThis.document = new Proxy({}, {
  get() {
    throw new Error('ambient document should not be used');
  }
});
globalThis.NodeFilter = new Proxy({}, {
  get() {
    throw new Error('ambient NodeFilter should not be used');
  }
});

try {
  const documentRef = createFakeDocument();
  const parent = createElement('p');
  const textNode = {
    nodeValue: 'AlphaBeta and 日本語 with Hyperlink',
    parentElement: parent,
    parentNode: {
      replaceChild(fragment, oldNode) {
        oldNode.replacedWith = fragment;
      }
    }
  };
  const root = {
    textNodes: [textNode]
  };
  documentRef.root = root;

  applyLangHints('#article', {
    documentRef,
    nodeFilterRef: documentRef.nodeFilter,
    allowAmbient: false
  });

  assert.ok(textNode.replacedWith, 'lang hints should replace eligible text through the injected document');
  const wrapped = textNode.replacedWith.childNodes.filter(node => node.tagName === 'SPAN');
  assert.ok(wrapped.length >= 2, 'long Latin tokens should be wrapped');
  assert.deepEqual(wrapped.map(node => node.getAttribute('lang')), wrapped.map(() => 'en'));
  assert.ok(root.__langHintsApplied, 'lang hints should mark the root as processed');
} finally {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
  if (previousNodeFilter === undefined) delete globalThis.NodeFilter;
  else globalThis.NodeFilter = previousNodeFilter;
}

console.log('ok - typography runtime');
