import assert from 'node:assert/strict';

import { injectComposerRuntimeStyles } from '../assets/js/composer-runtime-styles.js';

function createDocumentRef() {
  const byId = new Map();
  const head = {
    children: [],
    appendChild(element) {
      this.children.push(element);
      if (element.id) byId.set(element.id, element);
      return element;
    }
  };
  return {
    head,
    createElement(tagName) {
      return {
        tagName: String(tagName || '').toUpperCase(),
        id: '',
        textContent: ''
      };
    },
    getElementById(id) {
      return byId.get(id) || null;
    }
  };
}

const documentRef = createDocumentRef();
const first = injectComposerRuntimeStyles({ documentRef });
assert.ok(first, 'style injection should return the created element');
assert.equal(first.id, 'composer-runtime-styles');
assert.equal(documentRef.head.children.length, 1, 'style injection should append one style element');
assert.match(first.textContent, /\.ci-item/);
assert.match(first.textContent, /\.cs-publish-transport-settings/);
assert.match(first.textContent, /@keyframes nsModalFadeIn/);

const second = injectComposerRuntimeStyles({ documentRef });
assert.equal(second, first, 'style injection should be idempotent when the runtime style element already exists');
assert.equal(documentRef.head.children.length, 1, 'idempotent injection should not append duplicate style elements');

assert.equal(injectComposerRuntimeStyles({ documentRef: null }), null, 'missing document should be a no-op');
