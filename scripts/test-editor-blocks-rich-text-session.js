import assert from 'node:assert/strict';
import { createEditorBlocksRichTextSession } from '../assets/js/editor-blocks-rich-text-session.js';

function classSet(node) {
  return new Set(String(node.className || '').split(/\s+/).filter(Boolean));
}

function makeElement(tagName = 'div') {
  const listeners = new Map();
  const attrs = {};
  const children = [];
  const node = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    className: '',
    textContent: '',
    contentEditable: '',
    spellcheck: true,
    dataset: {},
    attrs,
    children,
    append(...items) {
      items.flat().forEach((item) => {
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
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    getAttribute(name) {
      return attrs[name] || '';
    },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatch(type, event = {}) {
      let defaultPrevented = false;
      const dispatched = {
        preventDefault() { defaultPrevented = true; },
        stopPropagation() {},
        target: node,
        ...event
      };
      const results = (listeners.get(type) || []).map(handler => handler(dispatched));
      return { defaultPrevented, results };
    },
    matches(selector) {
      if (selector.startsWith('.')) return classSet(node).has(selector.slice(1));
      return node.tagName.toLowerCase() === selector.toLowerCase();
    },
    closest(selector) {
      let current = node;
      while (current) {
        if (current.matches && current.matches(selector)) return current;
        current = current.parentElement || current.parentNode || null;
      }
      return null;
    },
    focus() {
      node.focused = true;
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

function makeHarness(options = {}) {
  const documentRef = makeDocumentRef();
  const calls = [];
  const block = {
    id: 'text-1',
    type: options.type || 'paragraph',
    data: { text: 'Initial' }
  };
  const blocksState = {
    hasPendingInlineMarks() {
      return !!options.pending;
    },
    pendingInlineForRun() {
      calls.push(['pendingInlineForRun']);
      return { bold: true };
    },
    rememberInlineMarks(editable, marks, range) {
      calls.push(['rememberInlineMarks', editable.className, marks, range]);
    }
  };
  const session = createEditorBlocksRichTextSession({
    documentRef,
    blocksState,
    editableSession: {
      registerEditable(editable, sync) {
        calls.push(['registerEditable', editable.className, sync]);
      }
    },
    selectionSession: { name: 'selection' },
    inlineDomSession: { name: 'inline-dom' },
    caretSession: { name: 'caret' },
    setPlainContentEditableValue(editable, value) {
      calls.push(['setPlainContentEditableValue', value]);
      editable.textContent = String(value || '');
    },
    editableText(editable) {
      calls.push(['editableText']);
      return editable.textContent;
    },
    inlineRunsFromDom(editable) {
      calls.push(['inlineRunsFromDom', editable.textContent]);
      return [{ text: editable.textContent }];
    },
    inlineRun(text, marks) {
      calls.push(['inlineRun', text, marks]);
      return { text, marks };
    },
    insertInlineRunsAtRange(runs, start, end, insertRuns) {
      calls.push(['insertInlineRunsAtRange', runs, start, end, insertRuns]);
      return [{ text: 'next' }];
    },
    getEditableSelectionOffsets(editable, caretSession) {
      calls.push(['getEditableSelectionOffsets', editable.className, caretSession && caretSession.name]);
      return options.offsets === null ? null : { start: 1, end: 1, collapsed: true };
    },
    applyRunsToEditable(editable, runs, caretOffset) {
      calls.push(['applyRunsToEditable', editable.className, runs, caretOffset]);
    },
    updateFromControl(blockArg, patch) {
      calls.push(['updateFromControl', blockArg && blockArg.id, patch]);
    },
    removeEmptyBlockWithBackspace(event, blockArg, index, editable, sync) {
      calls.push(['removeEmptyBlockWithBackspace', event.key, blockArg && blockArg.id, index, !!editable, typeof sync]);
      return !!options.removeEmpty;
    },
    mergeTextBlockWithPreviousOnBackspace(event, blockArg, index, editable) {
      calls.push(['mergeTextBlockWithPreviousOnBackspace', event.key, blockArg && blockArg.id, index, !!editable]);
      return !!options.mergeText;
    },
    handleCrossBlockArrowNavigation(event, index, editable) {
      calls.push(['handleCrossBlockArrowNavigation', event.key, index, !!editable]);
      return !!options.crossBlock;
    },
    splitTextBlockAfterCaret(event, blockArg, index, editable) {
      calls.push(['splitTextBlockAfterCaret', event.key, blockArg && blockArg.id, index, !!editable]);
      return !!options.splitText;
    },
    shouldInsertBlankBlockOnEnter(editable, caretSession) {
      calls.push(['shouldInsertBlankBlockOnEnter', editable.className, caretSession && caretSession.name]);
      return options.insertBlank !== false;
    },
    insertBlankBlockAfter(index, editable, sync) {
      calls.push(['insertBlankBlockAfter', index, editable.className, typeof sync]);
    },
    setActive(index, editable, sync) {
      calls.push(['setActive', index, editable && editable.className, typeof sync]);
    },
    activateEditableFromPointer(index, editable, sync) {
      calls.push(['activateEditableFromPointer', index, editable.className, typeof sync]);
    },
    routeDirectQuoteCaretFromPointer(editable, index, sync, event) {
      calls.push(['routeDirectQuoteCaretFromPointer', editable.className, index, typeof sync, event && event.button]);
    },
    inlineMarksFromPointerEvent(event, editable, selectionSession) {
      calls.push(['inlineMarksFromPointerEvent', editable.className, selectionSession && selectionSession.name]);
      return options.pointerMarks || { code: true };
    },
    inlineMarkedDomRangeFromPointerEvent(event, editable, mark, selectionSession, inlineDomSession) {
      calls.push(['inlineMarkedDomRangeFromPointerEvent', mark, selectionSession && selectionSession.name, inlineDomSession && inlineDomSession.name]);
      return { start: 2, end: 5 };
    },
    updateInlineToolbarState() {
      calls.push(['updateInlineToolbarState']);
    },
    refreshLinkEditor(link) {
      calls.push(['refreshLinkEditor', link && link.href]);
    },
    openMathEditorForNode(node) {
      calls.push(['openMathEditorForNode', node && node.dataset && node.dataset.tex]);
    }
  });
  return { calls, block, session };
}

{
  const h = makeHarness();
  const editable = h.session.createRichEditable('p', h.block, 'text', 'blocks-rich-editable blocks-paragraph-text', 0);
  assert.equal(editable.tagName, 'P');
  assert.equal(editable.contentEditable, 'true');
  assert.equal(editable.textContent, 'Initial');
  assert.ok(h.calls.some(call => call[0] === 'registerEditable' && call[2]));

  editable.textContent = 'Changed';
  editable.dispatch('input');
  assert.deepEqual(h.calls.find(call => call[0] === 'updateFromControl'), [
    'updateFromControl',
    'text-1',
    { text: 'Changed' }
  ]);
  assert.ok(h.calls.some(call => call[0] === 'updateInlineToolbarState'));
}

{
  const h = makeHarness({ pending: true });
  const editable = h.session.createRichEditable('p', h.block, 'text', 'blocks-rich-editable blocks-paragraph-text', 1);
  const result = editable.dispatch('beforeinput', {
    inputType: 'insertText',
    data: 'x',
    isComposing: false
  });
  assert.equal(result.defaultPrevented, true);
  assert.ok(h.calls.some(call => call[0] === 'setActive' && call[1] === 1));
  assert.ok(h.calls.some(call => call[0] === 'insertInlineRunsAtRange'));
  assert.deepEqual(h.calls.find(call => call[0] === 'applyRunsToEditable'), [
    'applyRunsToEditable',
    'blocks-rich-editable blocks-paragraph-text',
    [{ text: 'next' }],
    2
  ]);
}

{
  const h = makeHarness({ pending: true });
  const editable = h.session.createRichEditable('p', h.block, 'text', 'blocks-rich-editable blocks-paragraph-text', 2);
  const result = editable.dispatch('paste', {
    clipboardData: {
      getData(type) {
        return type === 'text/plain' ? 'paste' : '';
      }
    }
  });
  assert.equal(result.defaultPrevented, true);
  assert.ok(h.calls.some(call => call[0] === 'inlineRun' && call[1] === 'paste'));
}

{
  const h = makeHarness({ insertBlank: true });
  const editable = h.session.createRichEditable('p', h.block, 'text', 'blocks-rich-editable blocks-paragraph-text', 3);
  const result = editable.dispatch('keydown', { key: 'Enter' });
  assert.equal(result.defaultPrevented, true);
  assert.deepEqual(h.calls.filter(call => [
    'removeEmptyBlockWithBackspace',
    'mergeTextBlockWithPreviousOnBackspace',
    'handleCrossBlockArrowNavigation',
    'splitTextBlockAfterCaret',
    'insertBlankBlockAfter'
  ].includes(call[0])).map(call => call[0]), [
    'removeEmptyBlockWithBackspace',
    'mergeTextBlockWithPreviousOnBackspace',
    'handleCrossBlockArrowNavigation',
    'splitTextBlockAfterCaret',
    'insertBlankBlockAfter'
  ]);
}

{
  const h = makeHarness();
  const editable = h.session.createRichEditable('blockquote', h.block, 'text', 'blocks-rich-editable blocks-quote-text', 4);
  editable.dispatch('focus');
  editable.dispatch('pointerdown', { button: 0, isPrimary: true });
  assert.ok(h.calls.some(call => call[0] === 'setActive' && call[1] === 4));
  assert.ok(h.calls.some(call => call[0] === 'activateEditableFromPointer' && call[1] === 4));
  assert.ok(h.calls.some(call => call[0] === 'routeDirectQuoteCaretFromPointer'));
}

{
  const h = makeHarness();
  const editable = h.session.createRichEditable('p', h.block, 'text', 'blocks-rich-editable blocks-paragraph-text', 5);
  const link = { href: 'https://example.com', closest: selector => (selector === 'a[href]' ? link : null) };
  const math = { dataset: { tex: 'x+1' }, closest: selector => (selector === '.press-math[data-tex]' ? math : null) };
  const linkClick = editable.dispatch('click', { target: link });
  assert.equal(linkClick.defaultPrevented, true);
  assert.ok(h.calls.some(call => call[0] === 'rememberInlineMarks' && call[3].mark === 'code'));
  assert.ok(h.calls.some(call => call[0] === 'refreshLinkEditor' && call[1] === 'https://example.com'));
  const mathClick = editable.dispatch('click', { target: math });
  assert.equal(mathClick.defaultPrevented, true);
  assert.ok(h.calls.some(call => call[0] === 'openMathEditorForNode' && call[1] === 'x+1'));
}

assert.equal(createEditorBlocksRichTextSession({ documentRef: null }), null);

console.log('ok - editor blocks rich text session');
