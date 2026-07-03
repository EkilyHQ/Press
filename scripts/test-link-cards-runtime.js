import assert from 'node:assert/strict';
import { createLinkCardHydrator } from '../assets/js/link-cards.js';

class TestElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.attributes = new Map();
    this.className = '';
    this.textContent = '';
    this._innerHTML = '';
    this.classList = {
      contains: (name) => String(this.className || '').split(/\s+/).includes(String(name || ''))
    };
  }

  get childNodes() {
    return this.children;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value || '');
  }

  appendChild(child) {
    child.parentElement = this;
    child.parentNode = this;
    child.ownerDocument = child.ownerDocument || this.ownerDocument;
    this.children.push(child);
    return child;
  }

  insertBefore(child, ref) {
    child.parentElement = this;
    child.parentNode = this;
    child.ownerDocument = child.ownerDocument || this.ownerDocument;
    const index = this.children.indexOf(ref);
    if (index < 0) {
      this.children.push(child);
    } else {
      this.children.splice(index, 0, child);
    }
    return child;
  }

  replaceChild(child, oldChild) {
    const index = this.children.indexOf(oldChild);
    assert.notEqual(index, -1, 'test fixture should replace an existing child');
    child.parentElement = this;
    child.parentNode = this;
    child.ownerDocument = child.ownerDocument || this.ownerDocument;
    oldChild.parentElement = null;
    oldChild.parentNode = null;
    this.children[index] = child;
    return oldChild;
  }

  remove() {
    if (!this.parentNode) return;
    const siblings = this.parentNode.children || [];
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
    this.parentNode = null;
  }

  setAttribute(name, value = '') {
    const key = String(name);
    const text = String(value);
    this.attributes.set(key, text);
    if (key === 'class') this.className = text;
  }

  getAttribute(name) {
    const key = String(name);
    if (this.attributes.has(key)) return this.attributes.get(key);
    if (key === 'class' && this.className) return this.className;
    return null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  querySelector() {
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    const target = String(selector || '').trim().toLowerCase();
    const visit = (node) => {
      (node.children || []).forEach((child) => {
        if (target === 'a[href]' && child.tagName === 'A' && child.hasAttribute('href')) {
          results.push(child);
        }
        visit(child);
      });
    };
    visit(this);
    return results;
  }
}

class TestDocument {
  createElement(tagName) {
    return new TestElement(tagName, this);
  }
}

function makeLinkTree(documentRef) {
  const root = documentRef.createElement('div');
  const paragraph = documentRef.createElement('p');
  const anchor = documentRef.createElement('a');
  anchor.setAttribute('href', '?id=product.md');
  anchor.textContent = 'Product';
  paragraph.appendChild(anchor);
  root.appendChild(paragraph);
  return { root, paragraph, anchor };
}

const documentRef = new TestDocument();
const windowRef = {
  Node: { TEXT_NODE: 3 },
  location: {
    href: 'https://example.test/?tab=home',
    origin: 'https://example.test',
    pathname: '/'
  }
};
const hydrator = createLinkCardHydrator({ documentRef, windowRef });

{
  const { root, paragraph, anchor } = makeLinkTree(documentRef);
  hydrator.hydrate(root, {
    allowedLocations: new Set(['product.md']),
    makeHref: () => null
  });
  assert.equal(paragraph.children[0], anchor, 'nullable route helper should leave the original link in place');
  assert.equal(root.children[0], paragraph, 'nullable route helper should leave the original paragraph in place');
}

{
  const { root, paragraph, anchor } = makeLinkTree(documentRef);
  hydrator.hydrate(root, {
    allowedLocations: new Set(['product.md']),
    makeHref: (loc) => `/read/${encodeURIComponent(loc)}`
  });
  assert.notEqual(root.children[0], paragraph, 'real route helper href should hydrate the standalone internal link card');
  assert.equal(paragraph.parentNode, null, 'hydrated standalone paragraph should detach from the root');
  assert.match(root.children[0].innerHTML, /href="\/read\/product\.md"/);
}

console.log('ok - link card route helper behavior');
