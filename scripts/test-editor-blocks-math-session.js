import assert from 'node:assert/strict';
import { createEditorBlocksMathSession } from '../assets/js/editor-blocks-math-session.js';

function makeElement(tagName = 'div', className = '') {
  const listeners = new Map();
  const attrs = {};
  const children = [];
  const node = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    className,
    textContent: '',
    value: '',
    hidden: false,
    style: {},
    dataset: {},
    attrs,
    children,
    _rect: { left: 10, top: 10, right: 60, bottom: 30, width: 50, height: 20 },
    append(...items) {
      items.flat().forEach(item => {
        if (!item) return;
        item.parentNode = node;
        item.parentElement = node;
        children.push(item);
      });
    },
    appendChild(item) {
      node.append(item);
      return item;
    },
    contains(target) {
      if (!target) return false;
      if (target === node) return true;
      return children.some(child => child && typeof child.contains === 'function' && child.contains(target));
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
      if (name === 'data-tex') node.dataset.tex = String(value);
      if (name === 'aria-hidden') node.ariaHidden = String(value);
    },
    getAttribute(name) {
      if (name === 'data-tex' && Object.prototype.hasOwnProperty.call(node.dataset, 'tex')) return node.dataset.tex;
      return attrs[name] || '';
    },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter(item => item !== handler));
    },
    dispatch(type, event = {}) {
      (listeners.get(type) || []).forEach(handler => handler({ preventDefault() {}, target: node, ...event }));
    },
    matches(selector) {
      if (selector === '.press-math[data-tex]') {
        return String(node.className || '').split(/\s+/).includes('press-math')
          && Object.prototype.hasOwnProperty.call(node.dataset, 'tex');
      }
      if (/^\.blocks-block\[data-block-id="([^"]*)"\]$/.test(selector)) {
        const id = selector.match(/^\.blocks-block\[data-block-id="([^"]*)"\]$/)[1];
        return String(node.className || '').split(/\s+/).includes('blocks-block') && node.dataset.blockId === id;
      }
      if (selector.startsWith('.')) return String(node.className || '').split(/\s+/).includes(selector.slice(1));
      return false;
    },
    querySelector(selector) {
      const stack = [...children];
      while (stack.length) {
        const item = stack.shift();
        if (item && item.matches && item.matches(selector)) return item;
        if (item && item.children) stack.push(...item.children);
      }
      return null;
    },
    getBoundingClientRect() {
      return node._rect;
    },
    focus() {
      node.focused = true;
    },
    select() {
      node.selected = true;
    }
  };
  return node;
}

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    }
  };
}

function closestElement(target, selector) {
  let current = target;
  while (current) {
    if (current.matches && current.matches(selector)) return current;
    current = current.parentElement || null;
  }
  return null;
}

function makeHarness(overrides = {}) {
  const calls = [];
  const documentListeners = [];
  const documentRef = makeDocumentRef();
  const root = makeElement('div', 'root');
  root._rect = { left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 };
  const list = makeElement('div', 'blocks-list');
  const editable = makeElement('p', 'blocks-rich-editable');
  const mathNode = makeElement('span', 'press-math');
  mathNode.setAttribute('data-tex', 'x+y');
  mathNode.textContent = 'x+y';
  mathNode._rect = { left: 20, top: 24, right: 70, bottom: 44, width: 50, height: 20 };
  editable.appendChild(mathNode);
  const block = { id: 'math-1', type: 'math', data: { tex: 'a+b' } };
  const blockEl = makeElement('div', 'blocks-block blocks-block-math');
  blockEl.dataset.blockId = block.id;
  const preview = makeElement('div', 'press-math press-math-display');
  preview.setAttribute('data-tex', block.data.tex);
  preview.textContent = block.data.tex;
  blockEl.appendChild(preview);
  list.appendChild(blockEl);
  root.append(list, editable);

  let mathMode = '';
  let mathSelection = null;
  let activeMath = null;
  let activeMathBlockId = '';
  let activeElement = null;
  const blocksState = {
    getActiveEditable() {
      return editable;
    },
    clearMathEditorState() {
      mathMode = '';
      mathSelection = null;
      activeMath = null;
      activeMathBlockId = '';
      calls.push(['clearMathEditorState']);
    },
    getMathEditMode() {
      return mathMode;
    },
    getMathSelection() {
      return mathSelection;
    },
    updateMathSelection(patch) {
      mathSelection = { ...(mathSelection || {}), ...(patch || {}) };
      calls.push(['updateMathSelection', patch]);
    },
    getActiveMath() {
      return activeMath;
    },
    clearActiveMath() {
      activeMath = null;
      calls.push(['clearActiveMath']);
    },
    getActiveMathBlockId() {
      return activeMathBlockId;
    },
    openInlineMathEditor(nextMath, selection) {
      activeMath = nextMath || null;
      activeMathBlockId = '';
      mathMode = 'range';
      mathSelection = selection ? { ...selection } : null;
      calls.push(['openInlineMathEditor', nextMath ? nextMath.textContent : null, selection.start, selection.end, selection.text]);
    },
    openBlockMathEditor(blockId) {
      activeMath = null;
      activeMathBlockId = String(blockId || '');
      mathMode = 'block';
      mathSelection = null;
      calls.push(['openBlockMathEditor', activeMathBlockId]);
    }
  };

  const session = createEditorBlocksMathSession({
    documentRef,
    root,
    list,
    runtime: {
      documentRef,
      getActiveElement() {
        return activeElement;
      },
      setTimer(fn, delay) {
        calls.push(['setTimer', delay]);
        fn();
      }
    },
    blocksState,
    selectionSession: { name: 'selection' },
    caretSession: { name: 'caret' },
    inlineDomSession: { name: 'inline-dom' },
    containsNode(container, node) {
      return !!(container && typeof container.contains === 'function' && container.contains(node));
    },
    closestElement,
    text(_key, fallback) {
      return fallback;
    },
    renderMath(node) {
      calls.push(['renderMath', node && node.className]);
    },
    getMathBlockById(id) {
      calls.push(['getMathBlockById', id]);
      return id === block.id ? block : null;
    },
    getEditableSelectionOffsets() {
      return overrides.offsets || {
        collapsed: false,
        start: 1,
        end: 4,
        text: 'abc',
        range: { getBoundingClientRect: () => ({ left: 32, top: 40, right: 72, bottom: 60, width: 40, height: 20 }) }
      };
    },
    caretRectForEditable() {
      calls.push(['caretRectForEditable']);
      return { left: 30, top: 40, right: 32, bottom: 60, width: 2, height: 20 };
    },
    selectionMathInEditable() {
      return overrides.selectionMath || null;
    },
    inlineRunsFromDom() {
      calls.push(['inlineRunsFromDom']);
      return [{ text: 'abcdef' }];
    },
    applyInlineMathToRuns(runs, start, end, tex) {
      calls.push(['applyInlineMathToRuns', start, end, tex]);
      return [{ runs, start, end, text: tex, math: true }];
    },
    renderInlineRunsInto(_editable, runs) {
      calls.push(['renderInlineRunsInto', runs[0].text]);
    },
    textRangeForDomNode() {
      calls.push(['textRangeForDomNode']);
      return overrides.mathRange || { start: 2, end: 5 };
    },
    syncActiveEditable() {
      calls.push(['syncActiveEditable']);
    },
    updateInlineToolbarState() {
      calls.push(['updateInlineToolbarState']);
    },
    updateFromControl(nextBlock, patch) {
      Object.assign(nextBlock.data, patch);
      calls.push(['updateFromControl', nextBlock.id, patch]);
    },
    onDocument(type, handler, options) {
      documentListeners.push({ type, handler, options });
      return () => calls.push(['disposeDocument', type]);
    }
  });
  root.appendChild(session.element);

  return {
    block,
    blockEl,
    calls,
    documentListeners,
    editable,
    mathNode,
    preview,
    root,
    session,
    setActiveElement(node) {
      activeElement = node;
    }
  };
}

{
  const h = makeHarness();
  h.session.openForSelection();
  assert.equal(h.session.element.hidden, false);
  assert.equal(h.session.fields.source.value, 'abc');
  assert.deepEqual(h.calls.find(call => call[0] === 'openInlineMathEditor'), ['openInlineMathEditor', null, 1, 4, 'abc']);
  h.session.fields.source.value = 'xy';
  h.session.fields.source.dispatch('input');
  assert.deepEqual(h.calls.find(call => call[0] === 'applyInlineMathToRuns'), ['applyInlineMathToRuns', 1, 4, 'xy']);
  assert.deepEqual(h.calls.find(call => call[0] === 'updateMathSelection'), ['updateMathSelection', { end: 3, text: 'xy' }]);
  assert.ok(h.calls.some(call => call[0] === 'syncActiveEditable'));
  assert.ok(h.calls.some(call => call[0] === 'updateInlineToolbarState'));
}

{
  const h = makeHarness();
  h.session.openForNode(h.mathNode);
  assert.equal(h.session.fields.source.value, 'x+y');
  assert.deepEqual(h.calls.find(call => call[0] === 'textRangeForDomNode'), ['textRangeForDomNode']);
  assert.deepEqual(h.calls.find(call => call[0] === 'openInlineMathEditor'), ['openInlineMathEditor', 'x+y', 2, 5, 'x+y']);
  assert.equal(h.session.fields.source.focused, true);
  assert.equal(h.session.fields.source.selected, true);
}

{
  const h = makeHarness();
  h.session.openForSelection();
  h.session.fields.remove.dispatch('click');
  assert.deepEqual(h.calls.find(call => call[0] === 'applyInlineMathToRuns'), ['applyInlineMathToRuns', 1, 4, '']);
  assert.ok(h.calls.some(call => call[0] === 'clearMathEditorState'));
  assert.equal(h.session.element.hidden, true);
}

{
  const h = makeHarness();
  h.session.openForBlock(h.block, h.blockEl);
  assert.equal(h.session.fields.source.value, 'a+b');
  assert.deepEqual(h.calls.find(call => call[0] === 'openBlockMathEditor'), ['openBlockMathEditor', 'math-1']);
  h.session.fields.source.value = 'c+d';
  h.session.fields.source.dispatch('input');
  assert.equal(h.block.data.tex, 'c+d');
  assert.equal(h.preview.getAttribute('data-tex'), 'c+d');
  assert.equal(h.preview.textContent, 'c+d');
  assert.ok(h.calls.some(call => call[0] === 'renderMath' && call[1].includes('blocks-block')));
}

{
  const h = makeHarness();
  const dispose = h.session.bind();
  h.session.openForNode(h.mathNode);
  h.session.handleOutsidePointer({ target: h.mathNode });
  assert.equal(h.session.element.hidden, false, 'clicking a math node should not close the editor');
  const outside = makeElement('button', 'outside');
  h.documentListeners.find(listener => listener.type === 'pointerdown').handler({ target: outside });
  assert.equal(h.session.element.hidden, true, 'outside pointerdown should close the editor');
  dispose();
  assert.ok(h.calls.some(call => call[0] === 'disposeDocument' && call[1] === 'pointerdown'));
  assert.ok(h.calls.some(call => call[0] === 'disposeDocument' && call[1] === 'mousedown'));
}
