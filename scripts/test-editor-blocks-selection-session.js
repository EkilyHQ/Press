import assert from 'node:assert/strict';

import {
  createEditorBlocksSelectionSession
} from '../assets/js/editor-blocks-selection-session.js';

function makeRange() {
  return {
    collapsed: false,
    startContainer: null,
    startOffset: 0,
    setStart(node, offset) {
      this.startContainer = node;
      this.startOffset = offset;
    },
    collapse(value) {
      this.collapsed = !!value;
    }
  };
}

{
  const selectedRanges = [];
  let removed = 0;
  const activeRange = makeRange();
  const windowRef = {
    getSelection() {
      return {
        rangeCount: 1,
        getRangeAt(index) {
          assert.equal(index, 0);
          return activeRange;
        },
        removeAllRanges() {
          removed += 1;
        },
        addRange(range) {
          selectedRanges.push(range);
        }
      };
    },
    getComputedStyle(el) {
      return { el, lineHeight: '18px' };
    }
  };
  const documentRef = {
    defaultView: windowRef,
    createRange: makeRange,
    createTextNode(value) {
      return { nodeType: 3, nodeValue: value };
    },
    createTreeWalker(root, whatToShow) {
      return { root, whatToShow };
    }
  };
  const session = createEditorBlocksSelectionSession({ documentRef, windowRef });
  const root = { ownerDocument: documentRef };

  assert.equal(session.getSelectionRange(root), activeRange);
  assert.deepEqual(session.createTextNode(root, 'hello'), { nodeType: 3, nodeValue: 'hello' });
  assert.equal(session.createTreeWalker(root, 4).whatToShow, 4);
  assert.equal(session.getComputedStyle(root).lineHeight, '18px');
  assert.equal(session.selectRange(activeRange, root), true);
  assert.deepEqual(selectedRanges, [activeRange]);
  assert.equal(session.clearSelection(root), true);
  assert.equal(removed, 2);
}

{
  const textNode = { nodeType: 3 };
  const elementNode = { nodeType: 1 };
  const root = {
    contains(node) {
      return node === textNode;
    }
  };
  const documentRef = {
    createRange: makeRange,
    caretPositionFromPoint() {
      return { offsetNode: textNode, offset: 2 };
    }
  };
  root.ownerDocument = documentRef;
  const session = createEditorBlocksSelectionSession({ documentRef, windowRef: {} });
  const range = session.rangeFromPoint(root, 10, 20, { textOnly: true });
  assert.equal(range.startContainer, textNode);
  assert.equal(range.startOffset, 2);
  assert.equal(session.nodeFromPoint({ clientX: 10, clientY: 20 }, root, elementNode), textNode);
}

{
  const textNode = { nodeType: 3 };
  const outsideNode = { nodeType: 3 };
  const root = {
    contains(node) {
      return node === textNode;
    }
  };
  const documentRef = {
    createRange: makeRange,
    caretPositionFromPoint() {
      return { offsetNode: outsideNode, offset: 1 };
    },
    caretRangeFromPoint() {
      const range = makeRange();
      range.startContainer = textNode;
      range.startOffset = 3;
      return range;
    }
  };
  root.ownerDocument = documentRef;
  const session = createEditorBlocksSelectionSession({ documentRef, windowRef: {} });
  const range = session.rangeFromPoint(root, 1, 2, { textOnly: true });
  assert.equal(range.startContainer, textNode);
  assert.equal(range.startOffset, 3);
  assert.equal(session.rangeFromPoint(root, 1, 2, {
    containsNode() {
      return false;
    }
  }), null);
}

{
  const session = createEditorBlocksSelectionSession({ documentRef: null, windowRef: null });
  assert.equal(session.getSelection(), null);
  assert.equal(session.getSelectionRange(), null);
  assert.equal(session.createRange(), null);
  assert.equal(session.createTextNode(null, 'x'), null);
  assert.equal(session.createTreeWalker(null, 4), null);
  assert.equal(session.selectRange(null), false);
  assert.equal(session.clearSelection(), false);
  assert.equal(session.rangeFromPoint(null, 0, 0), null);
  assert.equal(session.nodeFromPoint(null, null, 'fallback'), 'fallback');
}

{
  const leakedWindow = {
    getSelection() {
      return { leaked: true };
    },
    getComputedStyle() {
      return { leaked: true };
    }
  };
  const documentRef = {
    defaultView: leakedWindow
  };
  const root = { ownerDocument: documentRef };
  const session = createEditorBlocksSelectionSession({ documentRef, windowRef: null });
  assert.equal(session.getSelection(root), null);
  assert.equal(session.getComputedStyle(root), null);
}

console.log('ok - editor blocks selection session');
