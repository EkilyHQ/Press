import assert from 'node:assert/strict';

import {
  createEditorBlocksState,
  createEditorBlocksStateController
} from '../assets/js/editor-blocks-state.js';

let idSeed = 0;
function makeBlock(type, raw = '', data = {}) {
  idSeed += 1;
  return {
    id: data.id || `test-${idSeed}`,
    type,
    raw: String(raw == null ? '' : raw),
    dirty: !!data.dirty,
    data: { ...data, id: undefined }
  };
}

function makeBlankBlock(after = '\n', data = {}) {
  const block = makeBlock('blank', '', { ...data, after: after || '\n' });
  block.dirty = !!data.dirty;
  return block;
}

function splitBlankLineUnits(value) {
  const text = String(value || '');
  if (!text) return [];
  const units = text.match(/[^\n]*\n/g) || [];
  return units.join('') === text ? units : [];
}

assert.equal(createEditorBlocksState().activeIndex, -1);

{
  const controller = createEditorBlocksStateController();
  const editable = { name: 'editable' };
  const otherEditable = { name: 'other' };

  assert.equal(controller.hasPendingInlineMarks(), false);
  controller.togglePendingInlineMark('bold');
  assert.equal(controller.hasPendingInlineMarks(), true);
  assert.equal(controller.pendingInlineMark('bold'), true);
  assert.deepEqual(controller.pendingInlineForRun(), { code: false, bold: true });

  const pendingCopy = controller.pendingInlineForRun();
  pendingCopy.bold = false;
  assert.equal(controller.pendingInlineMark('bold'), true);

  controller.togglePendingInlineMark('bold');
  assert.equal(controller.hasPendingInlineMarks(), false);
  assert.equal(controller.pendingInlineMark('bold'), false);

  controller.setPendingInlinePatch({ link: 'https://example.com', linkTitle: 'Example' });
  assert.equal(controller.hasPendingInlineMarks(), true);
  assert.equal(controller.pendingInlineMark('linkTitle'), 'Example');
  controller.clearPendingInline();
  assert.deepEqual(controller.pendingInlineForRun(), {});

  const remembered = controller.rememberInlineMarks(editable, { bold: true, code: true }, { mark: 'code', start: 2, end: 6 });
  assert.deepEqual(remembered.marks.marks, { bold: true, code: true });
  assert.deepEqual(controller.rememberedInlineMarksFor(editable), { bold: true, code: true });
  assert.equal(controller.rememberedInlineMarksFor(otherEditable), null);
  assert.deepEqual(controller.rememberedInlineRangeFor(editable, 'code'), { editable, mark: 'code', start: 2, end: 6 });
  assert.equal(controller.rememberedInlineRangeFor(editable, 'bold'), null);

  controller.clearRememberedInlineMarks();
  assert.equal(controller.rememberedInlineMarksFor(editable), null);
  assert.equal(controller.rememberedInlineRangeFor(editable, 'code'), null);
}

{
  const controller = createEditorBlocksStateController();
  const editable = { name: 'editable' };
  const linkNode = { name: 'link' };
  const mathNode = { name: 'math' };

  assert.equal(controller.getLinkEditMode(), '');
  controller.openLinkSelectionEditor('range', { editable, start: 1, end: 4, text: 'abc' });
  assert.equal(controller.getLinkEditMode(), 'range');
  assert.deepEqual(controller.getLinkSelection(), { editable, start: 1, end: 4, text: 'abc' });
  controller.updateLinkSelection({ end: 7, text: 'abcdef' });
  assert.deepEqual(controller.getLinkSelection(), { editable, start: 1, end: 7, text: 'abcdef' });

  controller.openDomLinkEditor(linkNode, { holdUntil: 200 });
  assert.equal(controller.getActiveLink(), linkNode);
  assert.equal(controller.getActiveLinkHoldUntil(), 200);
  assert.equal(controller.getLinkEditMode(), 'dom');
  assert.equal(controller.getLinkSelection(), null);

  controller.clearLinkEditorState({ clearActiveLink: false, clearHold: false });
  assert.equal(controller.getActiveLink(), linkNode);
  assert.equal(controller.getActiveLinkHoldUntil(), 200);
  assert.equal(controller.getLinkEditMode(), '');
  controller.clearLinkEditorState();
  assert.equal(controller.getActiveLink(), null);
  assert.equal(controller.getActiveLinkHoldUntil(), 0);

  controller.setLinkEditorRefreshSuppression(500);
  assert.equal(controller.linkEditorRefreshSuppressed(400), true);
  assert.equal(controller.linkEditorRefreshSuppressed(600), false);
  assert.equal(controller.state.suppressLinkEditorRefreshUntil, 0);

  controller.openInlineMathEditor(mathNode, { editable, start: 2, end: 3, text: 'x' });
  assert.equal(controller.getMathEditMode(), 'range');
  assert.equal(controller.getActiveMath(), mathNode);
  assert.deepEqual(controller.getMathSelection(), { editable, start: 2, end: 3, text: 'x' });
  controller.updateMathSelection({ end: 5, text: 'xyz' });
  assert.deepEqual(controller.getMathSelection(), { editable, start: 2, end: 5, text: 'xyz' });

  controller.openBlockMathEditor('math-block');
  assert.equal(controller.getMathEditMode(), 'block');
  assert.equal(controller.getActiveMathBlockId(), 'math-block');
  assert.equal(controller.getActiveMath(), null);
  assert.equal(controller.getMathSelection(), null);
  controller.clearMathEditorState();
  assert.equal(controller.getMathEditMode(), '');
  assert.equal(controller.getActiveMathBlockId(), '');
}

{
  const parsed = [
    makeBlock('paragraph', 'A', { text: 'A', after: '\n' }),
    makeBlock('paragraph', 'B', { text: 'B', after: '\n\n' })
  ];
  const controller = createEditorBlocksStateController({
    parseMarkdownBlocksRef: () => parsed.slice(),
    serializeMarkdownBlocksRef: blocks => blocks.map(block => block.type).join(','),
    makeBlockRef: makeBlock,
    makeBlankBlockRef: makeBlankBlock,
    splitBlankLineUnitsRef: splitBlankLineUnits
  });

  controller.setMarkdown('ignored');
  assert.deepEqual(controller.state.blocks.map(block => block.type), ['paragraph', 'paragraph']);
  assert.equal(controller.state.activeIndex, -1);
  assert.equal(controller.serialize(), 'paragraph,paragraph');

  controller.updateBlockData(controller.state.blocks[0], { text: 'Changed' });
  assert.equal(controller.state.blocks[0].dirty, true);
  assert.equal(controller.state.blocks[0].data.after, '\n');
  const noAfter = makeBlock('paragraph', '', { text: 'No after' });
  controller.updateBlockData(noAfter, { text: 'Next' });
  assert.equal(noAfter.data.after, '\n\n');

  const insertedBlank = controller.insertBlankBlock(1, { command: true });
  assert.equal(insertedBlank.index, 1);
  assert.equal(insertedBlank.block.type, 'blank');
  assert.equal(controller.state.blocks[0].data.after, '\n\n');
  assert.equal(controller.state.commandMenuOpen, true);
  assert.equal(controller.state.commandMenuInsertIndex, 1);
  assert.equal(controller.state.cardPickerOpen, false);

  assert.equal(controller.openCommandMenu(99), controller.state.blocks.length);
  assert.equal(controller.closeCommandMenu(), controller.state.blocks.length);

  const paragraph = controller.insertBlock('paragraph', { text: 'Inserted' }, 99);
  assert.equal(paragraph.index, controller.state.blocks.length - 1);
  assert.equal(paragraph.block.dirty, true);

  const replacement = makeBlock('quote', '', { text: 'Replacement' });
  const replacedBlocks = controller.replaceBlocks(0, 1, [replacement], {
    pendingListFocus: { blockId: replacement.id, itemIndex: 0, atEnd: true },
    activeIndex: 0
  });
  assert.equal(replacedBlocks.index, 0);
  assert.equal(controller.state.blocks[0].type, 'quote');
  assert.deepEqual(controller.state.pendingListFocus, { blockId: replacement.id, itemIndex: 0, atEnd: true });
  assert.deepEqual(controller.takePendingListFocus(replacement.id, 0), { blockId: replacement.id, itemIndex: 0, atEnd: true });
  assert.equal(controller.state.pendingListFocus, null);

  const replaced = controller.placeCommandBlock('heading', { text: 'Title' }, 1);
  assert.equal(replaced.replacedBlank, true);
  assert.equal(controller.state.blocks[1].type, 'heading');

  controller.openCommandMenu(2);
  assert.equal(controller.beginCommandBlockInsert({}), 2);
  assert.equal(controller.state.commandMenuOpen, false);

  controller.openCardPicker(1);
  assert.equal(controller.state.cardPickerOpen, true);
  assert.equal(controller.state.cardPickerInsertIndex, 1);
  controller.closeCardPicker();
  assert.equal(controller.state.cardPickerOpen, false);
  assert.equal(controller.state.cardPickerInsertIndex, null);

  const beforeMove = controller.state.blocks.map(block => block.id);
  const move = controller.moveBlock(0, 1);
  assert.equal(move.targetIndex, 1);
  assert.equal(controller.state.blocks[1].id, beforeMove[0]);
  assert.equal(controller.moveBlock(-1, 1), null);

  const target = controller.resolveBlockTarget({ blockId: controller.state.blocks[1].id }, block => block.type === controller.state.blocks[1].type);
  assert.equal(target.index, 1);
  assert.equal(controller.resolveBlockTarget({ blockId: 'missing' }), null);

  const removed = controller.removeBlock(1);
  assert.equal(removed.index, 1);
  assert.equal(controller.state.activeIndex, 1);

  const deleted = controller.deleteBlock(1);
  assert.equal(deleted.index, 1);
}

{
  const controller = createEditorBlocksStateController({
    parseMarkdownBlocksRef: () => [],
    makeBlockRef: makeBlock,
    makeBlankBlockRef: makeBlankBlock
  });
  controller.setMarkdown('');
  assert.equal(controller.state.blocks.length, 1);
  assert.equal(controller.state.blocks[0].type, 'blank');
}
