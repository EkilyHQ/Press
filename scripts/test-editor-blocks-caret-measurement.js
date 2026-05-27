import assert from 'node:assert/strict';

import {
  CARET_POINT_MEASURE_LIMIT,
  caretBoundaryDistance,
  measuredTextOffsetDetailsFromPoint,
  textareaTextOffsetDetailsFromPoint,
  visualLineRects
} from '../assets/js/editor-blocks-caret-measurement.js';

function textNode(value, rects = []) {
  return {
    nodeType: 3,
    nodeValue: String(value == null ? '' : value),
    rects
  };
}

function elementNode(children = []) {
  return { nodeType: 1, childNodes: children };
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

function createSelectionTools(root = null) {
  return {
    createTreeWalker(node) {
      const nodes = textNodes(node || root);
      let index = 0;
      return {
        nextNode() {
          const current = nodes[index] || null;
          index += 1;
          return current;
        }
      };
    },
    createRange() {
      let startNode = null;
      let startOffset = 0;
      return {
        setStart(node, offset) {
          startNode = node;
          startOffset = offset;
        },
        setEnd() {},
        getClientRects() {
          if (!startNode || !Array.isArray(startNode.rects)) return [];
          return startNode.rects[startOffset] ? [startNode.rects[startOffset]] : [];
        },
        detach() {}
      };
    },
    getComputedStyle() {
      return {
        boxSizing: 'border-box',
        fontFamily: 'system-ui',
        lineHeight: '18px',
        paddingLeft: '4px',
        wordBreak: 'normal'
      };
    }
  };
}

function createMirrorDocument() {
  const appended = [];
  return {
    appended,
    body: {
      appendChild(node) {
        appended.push(node);
        node.parentElement = this;
        return node;
      }
    },
    createElement() {
      const node = elementNode();
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
          node.childNodes = [textNode(text, Array.from(text, (_, index) => ({
            left: index * 10,
            right: (index + 1) * 10,
            top: 0,
            bottom: 10,
            width: 10,
            height: 10
          })))];
        }
      });
      return node;
    }
  };
}

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run('caret measurement picks the nearest character boundary from text rects', () => {
  const text = textNode('ab', [
    { left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10 },
    { left: 10, right: 20, top: 0, bottom: 10, width: 10, height: 10 }
  ]);
  const root = elementNode([text]);
  const details = measuredTextOffsetDetailsFromPoint(root, 11, 5, {
    selectionTools: createSelectionTools(root),
    limit: CARET_POINT_MEASURE_LIMIT
  });
  assert.equal(details.offset, 1);
  assert.equal(details.insideTextRect, true);
  assert.equal(details.textRectCount, 2);
  assert.equal(caretBoundaryDistance(text.rects[0], 0, 0, 5), 0);
});

run('caret measurement groups wrapped text rects into visual lines', () => {
  const text = textNode('abc', [
    { left: 0, right: 10, top: 0, bottom: 10, width: 10, height: 10 },
    { left: 10, right: 20, top: 0, bottom: 10, width: 10, height: 10 },
    { left: 0, right: 10, top: 20, bottom: 30, width: 10, height: 10 }
  ]);
  const lines = visualLineRects(elementNode([text]), {
    selectionTools: createSelectionTools()
  });
  assert.equal(lines.length, 2);
  assert.deepEqual(
    lines.map(line => ({ top: line.top, left: line.left, right: line.right, count: line.count })),
    [
      { top: 0, left: 0, right: 20, count: 2 },
      { top: 20, left: 0, right: 10, count: 1 }
    ]
  );
});

run('textarea measurement uses a document-scoped mirror and removes it after measuring', () => {
  const documentRef = createMirrorDocument();
  const details = textareaTextOffsetDetailsFromPoint(
    {
      value: 'ab',
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 40, height: 20 };
      }
    },
    11,
    5,
    {
      documentRef,
      selectionTools: createSelectionTools()
    }
  );
  assert.equal(details.offset, 1);
  assert.equal(details.insideTextRect, true);
  assert.equal(documentRef.appended.length, 1);
  assert.equal(documentRef.appended[0].removed, true);
});
