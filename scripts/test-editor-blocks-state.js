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

  const deleted = controller.deleteBlock(1);
  assert.equal(deleted.index, 1);
  assert.equal(controller.state.activeIndex, 1);
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
