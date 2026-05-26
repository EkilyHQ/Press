import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  isBlockEmptyForBackspace,
  joinMergedEditableText,
  mergeFirstListItemIntoPreviousBlock,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
  splitTextBlockIntoParagraph
} from '../assets/js/editor-blocks-block-flow-model.js';
import {
  isBlockEmptyForBackspace as modelIsBlockEmptyForBackspace,
  mergeTextBlockIntoPrevious as modelMergeTextBlockIntoPrevious,
  splitTextBlockIntoParagraph as modelSplitTextBlockIntoParagraph
} from '../assets/js/editor-blocks-model.js';
import {
  mergeFirstListItemIntoPreviousBlock as editorMergeFirstListItemIntoPreviousBlock
} from '../assets/js/editor-blocks.js';

const source = readFileSync(new URL('../assets/js/editor-blocks-block-flow-model.js', import.meta.url), 'utf8');

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('block-flow model detects only user-empty blocks as removable', () => {
  assert.equal(isBlockEmptyForBackspace({ type: 'blank', data: {} }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'paragraph', data: { text: '  ' } }), true);
  assert.equal(isBlockEmptyForBackspace({ type: 'source', raw: 'raw', data: {} }), false);
  assert.equal(isBlockEmptyForBackspace({ type: 'image', data: { src: '', alt: 'diagram', title: '' } }), false);
  assert.equal(isBlockEmptyForBackspace({ type: 'list', data: { items: [{ text: '', checked: true }] } }), false);
  assert.equal(isBlockEmptyForBackspace({ type: 'table', data: { headers: [''], rows: [['']] } }), true);
});

run('block-flow model splits text blocks without owning markdown parsing', () => {
  const block = { id: 'heading-1', type: 'heading', raw: '### abcdef', data: { level: 3, text: 'abcdef', after: '\n\n' } };
  const split = splitTextBlockIntoParagraph(block, 'abc', 'def');
  assert.equal(split[0].type, 'heading');
  assert.equal(split[0].id, 'heading-1');
  assert.equal(split[0].dirty, true);
  assert.deepEqual(split[0].data, { level: 3, text: 'abc', after: '\n\n' });
  assert.equal(split[1].type, 'paragraph');
  assert.equal(split[1].dirty, true);
  assert.equal(split[1].data.text, 'def');
  assert.equal(splitTextBlockIntoParagraph({ type: 'list' }, 'a', 'b'), null);
});

run('block-flow model joins editable text with one safe separator', () => {
  assert.deepEqual(joinMergedEditableText('abc', 'def'), { text: 'abc def', separator: ' ' });
  assert.deepEqual(joinMergedEditableText('abc ', 'def'), { text: 'abc def', separator: '' });
  assert.deepEqual(joinMergedEditableText('abc', ' def'), { text: 'abc def', separator: '' });
  assert.deepEqual(joinMergedEditableText('', 'def'), { text: 'def', separator: '' });
});

run('block-flow model merges text blocks with rendered caret offsets', () => {
  const previous = { type: 'paragraph', data: { text: 'Click **Save.**' } };
  const current = { type: 'quote', data: { text: 'Follow' } };
  const merged = mergeTextBlockIntoPrevious(previous, current);
  assert.equal(merged.data.text, 'Click **Save.** Follow');
  assert.equal(merged.focusCaretOffset, 'Click Save. '.length);
  assert.equal(mergeTextBlockIntoPrevious({ type: 'image', data: {} }, current), null);
});

run('block-flow model merges text into list tail items without dropping list metadata', () => {
  const previous = {
    type: 'list',
    data: {
      listType: 'task',
      items: [
        { text: 'done', checked: true, listType: 'task', indent: 0 },
        { text: 'tail', checked: false, listType: 'task', indent: 1 }
      ]
    }
  };
  const merged = mergeTextBlockIntoPreviousList(previous, { type: 'heading', data: { text: 'head' } });
  assert.equal(merged.data.items[1].text, 'tail head');
  assert.equal(merged.data.items[1].checked, false);
  assert.equal(merged.data.items[1].indent, 1);
  assert.equal(merged.focusItemIndex, 1);
});

run('block-flow model merges first list items into safe previous blocks only', () => {
  const previousText = { type: 'paragraph', data: { text: 'abc' } };
  const currentList = { type: 'list', data: { items: [{ text: 'def', indent: 0 }, { text: 'next', indent: 0 }] } };
  const textMerge = mergeFirstListItemIntoPreviousBlock(previousText, currentList, 0);
  assert.equal(textMerge.previousBlock.data.text, 'abc def');
  assert.deepEqual(textMerge.currentBlock.data.items, [{ text: 'next', indent: 0 }]);
  assert.deepEqual(textMerge.focus, { type: 'text', caretOffset: 4 });

  const previousList = { type: 'list', data: { items: [{ text: 'tail', indent: 1, marker: '*' }] } };
  const listMerge = mergeFirstListItemIntoPreviousBlock(previousList, { type: 'list', data: { items: [{ text: 'def', indent: 0 }] } }, 0);
  assert.equal(listMerge.previousBlock.data.items[0].text, 'tail def');
  assert.deepEqual(listMerge.focus, { type: 'list', itemIndex: 0, caretOffset: 5 });
  assert.equal(mergeFirstListItemIntoPreviousBlock(previousText, { type: 'list', data: { items: [{ text: 'parent', indent: 0 }, { text: 'child', indent: 1 }] } }, 0), null);
});

run('block model and editor root keep backward-compatible block-flow exports', () => {
  assert.equal(modelIsBlockEmptyForBackspace, isBlockEmptyForBackspace);
  assert.equal(modelSplitTextBlockIntoParagraph, splitTextBlockIntoParagraph);
  assert.equal(modelMergeTextBlockIntoPrevious, mergeTextBlockIntoPrevious);
  assert.equal(editorMergeFirstListItemIntoPreviousBlock, mergeFirstListItemIntoPreviousBlock);
});

run('block-flow model stays DOM-free', () => {
  assert.doesNotMatch(source, /\b(?:document|window|localStorage|CustomEvent)\b/);
  assert.doesNotMatch(source, /\b(?:addEventListener|classList|querySelector|createElement|ownerDocument)\b/);
});
