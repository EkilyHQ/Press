import assert from 'node:assert/strict';
import { createEditorBlocksInlineCommandSession } from '../assets/js/editor-blocks-inline-command-session.js';

function makeEditable() {
  return {
    name: 'editable',
    focused: false,
    focus() {
      this.focused = true;
    }
  };
}

function makeHarness(options = {}) {
  const calls = [];
  const editable = options.editable || makeEditable();
  let runs = options.runs || [{ text: 'Alpha', marks: {} }];
  const blocksState = {
    getActiveEditable() {
      calls.push(['getActiveEditable']);
      return options.activeEditable === undefined ? editable : options.activeEditable;
    },
    hasPendingInlineMarks() {
      calls.push(['hasPendingInlineMarks']);
      return !!options.pending;
    },
    togglePendingInlineMark(mark) {
      calls.push(['togglePendingInlineMark', mark]);
    },
    clearPendingInline() {
      calls.push(['clearPendingInline']);
    },
    clearInlineState() {
      calls.push(['clearInlineState']);
    },
    rememberedInlineRangeFor(node, mark) {
      calls.push(['rememberedInlineRangeFor', node && node.name, mark]);
      return options.rememberedRange || null;
    }
  };
  const session = createEditorBlocksInlineCommandSession({
    root: { name: 'root' },
    blocksState,
    selectionSession: { name: 'selection' },
    caretSession: { name: 'caret' },
    inlineDomSession: { name: 'inline-dom' },
    containsNode(root, node) {
      calls.push(['containsNode', root && root.name, node && node.name]);
      return options.contains !== false;
    },
    renderInlineRunsInto(node, nextRuns, inlineDomSession) {
      calls.push(['renderInlineRunsInto', node && node.name, nextRuns, inlineDomSession && inlineDomSession.name]);
      runs = nextRuns;
    },
    inlineRunsFromDom(node) {
      calls.push(['inlineRunsFromDom', node && node.name]);
      return runs;
    },
    getEditableSelectionOffsets(node, caretSession) {
      calls.push(['getEditableSelectionOffsets', node && node.name, caretSession && caretSession.name]);
      return options.offsets === undefined ? { start: 0, end: 5, collapsed: false } : options.offsets;
    },
    inlineMarkedDomRangeFromSelection(node, mark, selectionSession, inlineDomSession) {
      calls.push([
        'inlineMarkedDomRangeFromSelection',
        node && node.name,
        mark,
        selectionSession && selectionSession.name,
        inlineDomSession && inlineDomSession.name
      ]);
      return options.selectedMarkedRange || null;
    },
    removeInlineMarkAroundOffset(nextRuns, offset, mark) {
      calls.push(['removeInlineMarkAroundOffset', offset, mark]);
      return [{ removedAround: mark, offset }];
    },
    removeInlineMarkInRange(nextRuns, start, end, mark) {
      calls.push(['removeInlineMarkInRange', start, end, mark]);
      return [{ removed: mark, start, end }];
    },
    inlineMarksAtOffset(nextRuns, offset) {
      calls.push(['inlineMarksAtOffset', offset]);
      return options.marksAtOffset || {};
    },
    toggleInlineMarkOnRuns(nextRuns, start, end, mark) {
      calls.push(['toggleInlineMarkOnRuns', start, end, mark]);
      return [{ toggled: mark, start, end }];
    },
    placeCaretAtTextOffset(node, offset, caretSession) {
      calls.push(['placeCaretAtTextOffset', node && node.name, offset, caretSession && caretSession.name]);
    },
    syncActiveEditable() {
      calls.push(['syncActiveEditable']);
    },
    updateInlineToolbarState() {
      calls.push(['updateInlineToolbarState']);
    },
    openLinkEditorForSelection() {
      calls.push(['openLinkEditorForSelection']);
    },
    openMathEditorForSelection() {
      calls.push(['openMathEditorForSelection']);
    }
  });
  return { calls, editable, session };
}

{
  const { calls, editable, session } = makeHarness({
    offsets: { start: 1, end: 4, collapsed: false }
  });
  session.applyInlineCommand('strikeThrough');
  assert.equal(editable.focused, true);
  assert.deepEqual(calls.filter(call => call[0] === 'toggleInlineMarkOnRuns'), [
    ['toggleInlineMarkOnRuns', 1, 4, 'strike']
  ]);
  assert.deepEqual(calls.filter(call => call[0] === 'clearPendingInline'), [
    ['clearPendingInline']
  ]);
  assert.deepEqual(calls.slice(-3), [
    ['placeCaretAtTextOffset', 'editable', 4, 'caret'],
    ['syncActiveEditable'],
    ['updateInlineToolbarState']
  ]);
}

{
  const { calls, session } = makeHarness({
    offsets: { start: 5, end: 5, collapsed: true }
  });
  session.applyInlineCommand('bold');
  assert.deepEqual(calls.filter(call => call[0] === 'togglePendingInlineMark'), [
    ['togglePendingInlineMark', 'bold']
  ]);
  assert.equal(calls.some(call => call[0] === 'renderInlineRunsInto'), false);
}

{
  const { calls, session } = makeHarness({
    offsets: { start: 5, end: 5, collapsed: true }
  });
  session.applyInlineCommand('code');
  assert.equal(calls.some(call => call[0] === 'togglePendingInlineMark'), false);
  assert.equal(calls.some(call => call[0] === 'renderInlineRunsInto'), false);
}

{
  const { calls, session } = makeHarness({
    offsets: { start: 5, end: 5, collapsed: true },
    selectedMarkedRange: { start: 2, end: 8 }
  });
  session.applyInlineCommand('code');
  assert.deepEqual(calls.filter(call => call[0] === 'clearInlineState'), [
    ['clearInlineState']
  ]);
  assert.deepEqual(calls.filter(call => call[0] === 'removeInlineMarkInRange'), [
    ['removeInlineMarkInRange', 2, 8, 'code']
  ]);
  assert.deepEqual(calls.filter(call => call[0] === 'renderInlineRunsInto'), [
    ['renderInlineRunsInto', 'editable', [{ removed: 'code', start: 2, end: 8 }], 'inline-dom']
  ]);
}

{
  const { calls, session } = makeHarness();
  session.applyInlineCommand('link');
  session.applyInlineCommand('math');
  assert.deepEqual(calls.filter(call => call[0].startsWith('open')), [
    ['openLinkEditorForSelection'],
    ['openMathEditorForSelection']
  ]);
  assert.equal(calls.some(call => call[0] === 'toggleInlineMarkOnRuns'), false);
}

{
  const { session } = makeHarness({ pending: true });
  assert.equal(session.hasPendingInlineMarks(), true);
  assert.equal(session.inlineCommandMark('strikeThrough'), 'strike');
}

console.log('editor blocks inline command session tests passed');
