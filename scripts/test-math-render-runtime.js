import assert from 'node:assert/strict';
import { createPressMathRenderer, renderPressMath } from '../assets/js/math-render.js';

function createElement(tagName = 'div') {
  return {
    tagName: String(tagName || 'div').toUpperCase(),
    dataset: {},
    className: '',
    textContent: '',
    attrs: {},
    classList: {
      contains(name) {
        return String(this.owner && this.owner.className || '').split(/\s+/).includes(name);
      }
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
      if (name === 'data-tex') this.dataset.tex = String(value);
    },
    getAttribute(name) {
      if (name === 'data-tex') return this.dataset.tex || '';
      return this.attrs[name] || '';
    }
  };
}

function createMathNode(tex = 'x+y') {
  const node = createElement('span');
  node.className = 'press-math';
  node.classList.owner = node;
  node.setAttribute('data-tex', tex);
  node.textContent = tex;
  return node;
}

function createRoot(nodes) {
  return {
    get ownerDocument() {
      throw new Error('root.ownerDocument should not be read when math runtime refs are explicit');
    },
    querySelectorAll(selector) {
      assert.equal(selector, '.press-math[data-tex]');
      return nodes;
    }
  };
}

function createDocumentRef() {
  const appended = [];
  return {
    appended,
    get defaultView() {
      throw new Error('documentRef.defaultView should not be read when math runtime windowRef is explicit');
    },
    head: {
      appendChild(node) {
        appended.push(node);
        return node;
      }
    },
    querySelector() {
      return null;
    },
    createElement(tagName) {
      return createElement(tagName);
    }
  };
}

{
  const mathNode = createMathNode('a+b');
  const root = createRoot([mathNode]);
  const documentRef = createDocumentRef();
  const calls = [];
  const renderer = createPressMathRenderer({
    documentRef,
    windowRef: {
      katex: {
        render(tex, node, options) {
          calls.push({ tex, node, options });
        }
      }
    }
  });

  const result = await renderer(root);

  assert.deepEqual(result, { rendered: 1, failed: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tex, 'a+b');
  assert.equal(calls[0].node, mathNode);
  assert.equal(calls[0].options.displayMode, false);
  assert.equal(mathNode.dataset.pressMathRendered, 'true');
  assert.equal(documentRef.appended.length, 1);
  assert.equal(documentRef.appended[0].dataset.pressKatex, 'style');
}

{
  const mathNode = createMathNode('c+d');
  const root = createRoot([mathNode]);
  const documentRef = createDocumentRef();
  const calls = [];

  const result = await renderPressMath(root, {
    documentRef,
    windowRef: {
      katex: {
        render(tex) {
          calls.push(tex);
        }
      }
    }
  });

  assert.deepEqual(result, { rendered: 1, failed: 0 });
  assert.deepEqual(calls, ['c+d']);
}
