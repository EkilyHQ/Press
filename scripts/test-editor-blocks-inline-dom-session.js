import assert from 'node:assert/strict';

import {
  createEditorBlocksInlineDomSession
} from '../assets/js/editor-blocks-inline-dom-session.js';

function textNode(value) {
  return {
    nodeType: 3,
    nodeValue: String(value == null ? '' : value),
    parentElement: null,
    ownerDocument: null
  };
}

function elementNode(tagName, ownerDocument) {
  const node = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    className: '',
    childNodes: [],
    dataset: {},
    attributes: {},
    parentElement: null,
    ownerDocument,
    appendChild(child) {
      child.parentElement = node;
      child.ownerDocument = ownerDocument;
      node.childNodes.push(child);
      return child;
    },
    setAttribute(name, value) {
      node.attributes[name] = String(value);
      if (name === 'href') node.href = String(value);
    },
    getAttribute(name) {
      if (name === 'class') return node.className;
      return node.attributes[name] || '';
    },
    matches(selector) {
      if (selector === 'a') return node.tagName === 'A';
      if (selector === 'a[href]') return node.tagName === 'A' && !!node.attributes.href;
      if (selector === 'code') return node.tagName === 'CODE';
      if (selector === '.press-math[data-tex]') {
        return String(node.className || '').split(/\s+/).includes('press-math') && !!node.attributes['data-tex'];
      }
      return false;
    },
    contains(child) {
      let current = child;
      while (current) {
        if (current === node) return true;
        current = current.parentElement;
      }
      return false;
    },
    querySelectorAll(selector) {
      const out = [];
      const visit = (current) => {
        if (!current || current.nodeType !== 1) return;
        if (current.matches(selector)) out.push(current);
        current.childNodes.forEach(visit);
      };
      node.childNodes.forEach(visit);
      return out;
    }
  };
  Object.defineProperty(node, 'innerHTML', {
    set() {
      node.childNodes = [];
    }
  });
  Object.defineProperty(node, 'textContent', {
    get() {
      return node.childNodes.map(nodeText).join('');
    },
    set(value) {
      node.childNodes = [textNode(value)];
      node.childNodes[0].parentElement = node;
      node.childNodes[0].ownerDocument = ownerDocument;
    }
  });
  return node;
}

function nodeText(node) {
  if (!node) return '';
  if (node.nodeType === 3) return String(node.nodeValue || '');
  if (node.nodeType !== 1) return '';
  const tag = String(node.tagName || '').toLowerCase();
  if (tag === 'br') return '\n';
  if (node.matches && node.matches('.press-math[data-tex]')) {
    return String(node.getAttribute('data-tex') || node.dataset.tex || '');
  }
  return (node.childNodes || []).map(nodeText).join('');
}

function textBefore(root, target) {
  let out = '';
  let found = false;
  const visit = (node) => {
    if (!node || found) return;
    if (node === target) {
      found = true;
      return;
    }
    if (node.nodeType === 3) {
      out += nodeText(node);
      return;
    }
    if (node.nodeType !== 1) return;
    if (node.matches && node.matches('.press-math[data-tex]')) {
      out += nodeText(node);
      return;
    }
    if (String(node.tagName || '').toLowerCase() === 'br') {
      out += '\n';
      return;
    }
    (node.childNodes || []).forEach(visit);
  };
  (root.childNodes || []).forEach(visit);
  return out;
}

function createDocumentRef() {
  const documentRef = {
    createElement(tagName) {
      return elementNode(tagName, documentRef);
    },
    createTextNode(value) {
      const node = textNode(value);
      node.ownerDocument = documentRef;
      return node;
    },
    createRange() {
      return {
        root: null,
        target: null,
        selectNodeContents(node) {
          this.root = node;
        },
        setEndBefore(node) {
          this.target = node;
        },
        toString() {
          return this.target ? textBefore(this.root, this.target) : nodeText(this.root);
        }
      };
    }
  };
  return documentRef;
}

{
  const documentRef = createDocumentRef();
  let renderedMathRoot = null;
  const session = createEditorBlocksInlineDomSession({
    documentRef,
    mergeInlineRuns: runs => runs,
    sanitizeLinkHref: href => `safe:${href}`,
    linkTitleForRun: run => `title:${run.text}`,
    renderMath(root) {
      renderedMathRoot = root;
    }
  });
  const root = documentRef.createElement('p');

  session.renderInlineRunsInto(root, [
    { text: 'Hello', bold: true },
    { text: '\nworld' },
    { text: 'x+1', math: true },
    { text: 'Press', link: 'https://example.com' }
  ]);

  assert.equal(root.childNodes[0].tagName, 'STRONG');
  assert.equal(root.childNodes[1].tagName, 'BR');
  assert.equal(root.childNodes[3].className, 'press-math press-math-inline blocks-inline-math');
  assert.equal(root.childNodes[4].tagName, 'A');
  assert.equal(root.childNodes[4].getAttribute('href'), 'safe:https://example.com');
  assert.equal(root.childNodes[4].getAttribute('title'), 'title:Press');
  assert.equal(renderedMathRoot, root);
}

{
  const documentRef = createDocumentRef();
  const session = createEditorBlocksInlineDomSession({ documentRef });
  const root = documentRef.createElement('p');
  root.appendChild(documentRef.createTextNode('Hi '));
  const link = documentRef.createElement('a');
  link.setAttribute('href', 'https://example.com');
  link.appendChild(documentRef.createTextNode('there'));
  root.appendChild(link);
  root.appendChild(documentRef.createTextNode('!'));

  assert.deepEqual(session.textRangeForDomNode(root, link), { start: 3, end: 8 });
  assert.equal(session.linkForTextRange(root, 3, 8), link);
  assert.equal(session.linkForTextRange(root, 0, 2), null);
}

{
  const documentRef = createDocumentRef();
  const session = createEditorBlocksInlineDomSession({ documentRef });
  const root = documentRef.createElement('p');
  root.appendChild(documentRef.createTextNode('a'));
  const math = documentRef.createElement('span');
  math.className = 'press-math';
  math.dataset.tex = 'x+1';
  math.setAttribute('data-tex', 'x+1');
  root.appendChild(math);

  assert.deepEqual(session.textRangeForDomNode(root, math), { start: 1, end: 4 });
  assert.deepEqual(session.markedRangeForNode(root, math, 'math'), { start: 1, end: 4 });
}

{
  const documentRef = createDocumentRef();
  const session = createEditorBlocksInlineDomSession({ documentRef });
  const root = documentRef.createElement('p');
  root.appendChild(documentRef.createTextNode('a'));
  const code = documentRef.createElement('code');
  const codeText = documentRef.createTextNode('bc');
  code.appendChild(codeText);
  root.appendChild(code);

  assert.deepEqual(session.markedRangeForNode(root, codeText, 'code'), { start: 1, end: 3 });
}

{
  const documentRef = createDocumentRef();
  const session = createEditorBlocksInlineDomSession();
  const root = documentRef.createElement('p');
  session.renderInlineRunsInto(root, [{ text: 'owner doc' }]);
  assert.equal(root.textContent, 'owner doc');
}

{
  const session = createEditorBlocksInlineDomSession({ documentRef: null });
  assert.equal(session.textRangeForDomNode(null, null), null);
  assert.equal(session.linkForTextRange(null, 0, 1), null);
  assert.equal(session.markedRangeForNode(null, null, 'code'), null);
}

console.log('ok - editor blocks inline DOM session');
