import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CARET_POINT_MEASURE_LIMIT,
  createEditorBlocksCaretSession
} from '../assets/js/editor-blocks-caret-session.js';

function textNode(value) {
  return { nodeType: 3, nodeValue: String(value == null ? '' : value), parentElement: null };
}

function elementNode(tagName, children = [], options = {}) {
  const el = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    childNodes: children,
    className: options.className || '',
    dataset: options.dataset || {},
    attributes: options.attributes || {},
    textContent: options.textContent,
    parentElement: null,
    matches(selector) {
      if (selector === '.press-math[data-tex]') {
        return String(this.className || '').split(/\s+/).includes('press-math')
          && (this.attributes['data-tex'] != null || this.dataset.tex != null);
      }
      return false;
    },
    getAttribute(name) {
      return this.attributes[name] == null ? null : this.attributes[name];
    },
    contains(node) {
      if (!node) return false;
      if (node === this) return true;
      return this.childNodes.some(child => child === node || (child.contains && child.contains(node)));
    }
  };
  children.forEach(child => { child.parentElement = el; });
  return el;
}

function textNodes(root) {
  const nodes = [];
  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === 3) {
      nodes.push(node);
      return;
    }
    Array.from(node.childNodes || []).forEach(walk);
  };
  walk(root);
  return nodes;
}

function createWalker(nodes) {
  let index = 0;
  return {
    nextNode() {
      const node = nodes[index] || null;
      index += 1;
      return node;
    }
  };
}

function createRangeForRects() {
  let startNode = null;
  let startOffset = 0;
  return {
    startContainer: null,
    startOffset: 0,
    setStart(node, offset) {
      startNode = node;
      startOffset = offset;
      this.startContainer = node;
      this.startOffset = offset;
    },
    setEnd() {},
    collapse() {},
    selectNodeContents() {},
    setEndBefore() {},
    toString() {
      return startNode ? String(startNode.nodeValue || '').slice(0, startOffset) : '';
    },
    getClientRects() {
      if (!startNode || !Array.isArray(startNode.rects)) return [];
      return startNode.rects[startOffset] ? [startNode.rects[startOffset]] : [];
    },
    detach() {}
  };
}

function createSelectionSession(root, rangeRef = { value: null }) {
  const selected = { range: null, node: null };
  return {
    selected,
    getSelectionRange() {
      return rangeRef.value;
    },
    createTreeWalker(node) {
      return createWalker(textNodes(node || root));
    },
    createRange() {
      const range = createRangeForRects();
      range.selectNodeContents = (node) => {
        range.root = node;
      };
      range.setEnd = (node, offset) => {
        range.endNode = node;
        range.endOffset = offset;
      };
      range.toString = () => {
        if (!range.root || !range.endNode) return '';
        const session = createEditorBlocksCaretSession({ selectionSession: this });
        const offset = session.textOffsetForDomPosition(range.root, range.endNode, range.endOffset);
        return textNodes(range.root).map(item => item.nodeValue).join('').slice(0, Math.max(0, offset || 0));
      };
      return range;
    },
    getComputedStyle() {
      return { lineHeight: '18px' };
    },
    rangeFromPoint() {
      return null;
    },
    selectRange(range, node) {
      selected.range = range;
      selected.node = node;
      return true;
    }
  };
}

function createMirrorDocument() {
  const appended = [];
  const doc = {
    appended,
    body: {
      appendChild(node) {
        appended.push(node);
        node.parentElement = this;
        return node;
      }
    },
    createElement(tagName) {
      const node = elementNode(tagName);
      node.style = {};
      node.attributes = {};
      node.setAttribute = (name, value) => {
        node.attributes[name] = String(value);
      };
      node.remove = () => {
        node.removed = true;
      };
      Object.defineProperty(node, 'textContent', {
        get() {
          return node._textContent || '';
        },
        set(value) {
          const text = String(value == null ? '' : value);
          node._textContent = text;
          const child = textNode(text);
          child.rects = Array.from(text, (_, index) => ({
            left: index * 10,
            right: (index + 1) * 10,
            top: 0,
            bottom: 10,
            width: 10,
            height: 10
          }));
          child.parentElement = node;
          node.childNodes = [child];
        }
      });
      return node;
    }
  };
  return doc;
}

const first = textNode('Hi');
const second = textNode('there');
const math = elementNode('span', [], {
  className: 'press-math',
  attributes: { 'data-tex': 'x+1' },
  dataset: { tex: 'x+1' }
});
const root = elementNode('div', [
  first,
  elementNode('br'),
  elementNode('span', [second]),
  math
]);
root.textContent = 'Hi\ntherex+1';

const rangeRef = {
  value: {
    collapsed: false,
    startContainer: second,
    startOffset: 2,
    endContainer: second,
    endOffset: 5,
    toString: () => 'ere'
  }
};
const selectionSession = createSelectionSession(root, rangeRef);
const caretSession = createEditorBlocksCaretSession({ selectionSession });

assert.equal(caretSession.textOffsetForDomPosition(root, second, 2), 5);
assert.deepEqual(caretSession.selectionOffsets(root), {
  start: 5,
  end: 8,
  collapsed: false,
  text: 'ere',
  range: rangeRef.value
});

caretSession.placeAtTextOffset(root, 4);
assert.equal(selectionSession.selected.range.startContainer, second);
assert.equal(selectionSession.selected.range.startOffset, 2);

rangeRef.value = {
  collapsed: true,
  startContainer: second,
  startOffset: 5,
  endContainer: second,
  endOffset: 5,
  toString: () => ''
};
assert.equal(caretSession.shouldInsertBlankBlockOnEnter(root), false);

const blankText = textNode('a\n\nb');
const blankRoot = elementNode('div', [blankText]);
blankRoot.textContent = 'a\n\nb';
const blankRangeRef = {
  value: {
    collapsed: true,
    startContainer: blankText,
    startOffset: 2,
    endContainer: blankText,
    endOffset: 2,
    toString: () => ''
  }
};
const blankSession = createEditorBlocksCaretSession({
  selectionSession: createSelectionSession(blankRoot, blankRangeRef)
});
assert.equal(blankSession.isSelectionOnBlankLine(blankRoot), true);

const measuredText = textNode('ab');
measuredText.rects = [
  { left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10 },
  { left: 10, right: 20, top: 0, bottom: 10, width: 10, height: 10 }
];
const measuredRoot = elementNode('div', [measuredText]);
const measuredSession = createEditorBlocksCaretSession({
  selectionSession: createSelectionSession(measuredRoot, { value: null })
});
const details = measuredSession.measuredTextOffsetDetailsFromPoint(measuredRoot, 11, 5, CARET_POINT_MEASURE_LIMIT);
assert.equal(details.offset, 1);
assert.equal(details.insideTextRect, true);
assert.equal(details.textRectCount, 2);

const mirrorDocument = createMirrorDocument();
const textareaMeasureSession = createEditorBlocksCaretSession({
  documentRef: mirrorDocument,
  selectionSession: createSelectionSession(null, { value: null })
});
const textareaMeasureArea = {
  value: 'ab',
  ownerDocument: {
    body: {},
    createElement() {
      throw new Error('ownerDocument.createElement should not be used');
    }
  },
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 40, height: 20 };
  }
};
const textareaDetails = textareaMeasureSession.textareaTextOffsetDetailsFromPoint(
  textareaMeasureArea,
  11,
  5,
  CARET_POINT_MEASURE_LIMIT
);
assert.equal(textareaDetails.offset, 1);
assert.equal(textareaDetails.insideTextRect, true);
assert.equal(mirrorDocument.appended.length, 1);
assert.equal(mirrorDocument.appended[0].removed, true);

const textarea = {
  value: 'top\nbottom',
  selectionStart: 10,
  selectionEnd: 10
};
assert.equal(caretSession.isTextareaOnEdgeLine(textarea, 'down'), true);
assert.equal(caretSession.isTextareaOnEdgeLine(textarea, 'up'), false);

{
  const here = dirname(fileURLToPath(import.meta.url));
  const caretSessionSource = readFileSync(resolve(here, '../assets/js/editor-blocks-caret-session.js'), 'utf8');
  const caretMeasurementSource = readFileSync(resolve(here, '../assets/js/editor-blocks-caret-measurement.js'), 'utf8');
  assert.match(
    caretSessionSource,
    /function createFallbackSelectionSession\(\) \{[\s\S]*return createEditorBlocksSelectionSession\(\);[\s\S]*function normalizeSelectionSession\(selectionSession\) \{[\s\S]*: createFallbackSelectionSession\(\);/,
    'caret session should create fallback selection tools at instance construction time'
  );
  assert.doesNotMatch(
    caretSessionSource,
    /const\s+fallbackSelectionSession\s*=/,
    'caret session should not keep a module-level fallback selection singleton'
  );
  assert.match(
    caretSessionSource,
    /from '\.\/editor-blocks-caret-measurement\.js'/,
    'caret session should delegate point and visual-line measurement to the caret measurement boundary'
  );
  assert.match(
    caretMeasurementSource,
    /export function measuredTextOffsetDetailsFromPoint[\s\S]*export function textareaTextOffsetDetailsFromPoint[\s\S]*export function visualLineRects/,
    'caret measurement boundary should own point-to-text, textarea mirror, and visual-line geometry'
  );
  assert.doesNotMatch(
    caretSessionSource,
    /function caretBoundaryDistance|TEXTAREA_MIRROR_STYLE_PROPS/,
    'caret session should not retain low-level measurement geometry internals'
  );
}

console.log('ok - editor blocks caret session');
