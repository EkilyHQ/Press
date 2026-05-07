import assert from 'node:assert/strict';

globalThis.window = {};
globalThis.document = { title: 'Press' };
globalThis.customElements = {
  get() { return null; },
  define() {}
};
globalThis.HTMLElement = class {
  constructor() {
    this._attributes = new Map();
    this.style = {};
    this.shadowRoot = null;
    this.innerHTML = '';
  }

  setAttribute(name, value) {
    this._attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }

  attachShadow() {
    this.shadowRoot = { innerHTML: '' };
    return this.shadowRoot;
  }

  addEventListener() {}
  removeEventListener() {}
  contains() { return false; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
};

const { PressPostCard } = await import('../assets/js/components.js');

function makeCard({ shadow = false, templateHtml = null, nodes = [] } = {}) {
  const card = new PressPostCard();
  card.setAttribute('title', 'Slot safety');
  card.querySelector = (selector) => {
    if (templateHtml == null || !selector.includes('cover')) return null;
    return { innerHTML: templateHtml };
  };
  card.querySelectorAll = (selector) => selector.includes('cover') ? nodes : [];
  if (shadow) card.setAttribute('use-shadow', '');
  return card;
}

const textOnlySlot = Object.freeze({
  tagName: 'SPAN',
  outerHTML: '',
  textContent: '<img src=x onerror=alert(1)>'
});
const lightCard = makeCard({ nodes: [textOnlySlot] });
lightCard.render();
assert.match(lightCard.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/, 'light DOM text-only slot fallback should be escaped');
assert.doesNotMatch(lightCard.innerHTML, /<img src=x onerror=alert\(1\)>/, 'light DOM text-only slot fallback should not become markup');

const shadowCard = makeCard({ shadow: true, nodes: [textOnlySlot] });
shadowCard.render();
assert.match(shadowCard.shadowRoot.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/, 'shadow DOM text-only slot fallback should be escaped');
assert.doesNotMatch(shadowCard.shadowRoot.innerHTML, /<img src=x onerror=alert\(1\)>/, 'shadow DOM text-only slot fallback should not become markup');

const elementSlot = Object.freeze({
  tagName: 'SPAN',
  outerHTML: '<span class="badge"><strong>Draft</strong></span>',
  textContent: '<strong>ignored</strong>'
});
const elementCard = makeCard({ nodes: [elementSlot] });
elementCard.render();
assert.match(elementCard.innerHTML, /<span class="badge"><strong>Draft<\/strong><\/span>/, 'slotted element HTML should keep existing markup semantics');

const templateCard = makeCard({ templateHtml: '<picture><img src="cover.jpg" alt=""></picture>' });
templateCard.render();
assert.match(templateCard.innerHTML, /<picture><img src="cover\.jpg" alt=""><\/picture>/, 'template slot HTML should remain explicit theme markup');

console.log('ok - post card slot safety');
