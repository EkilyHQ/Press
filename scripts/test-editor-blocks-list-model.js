import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  dedentIndentedListSource,
  itemIndentLevel,
  listVisualMarkerLabels,
  mergeListItemIntoPreviousItem,
  parseListBlock,
  patchListItemType,
  serializeList
} from '../assets/js/editor-blocks-list-model.js';
import {
  mergeListItemIntoPreviousItem as modelMergeListItemIntoPreviousItem,
  parseListBlock as modelParseListBlock,
  serializeList as modelSerializeList
} from '../assets/js/editor-blocks-model.js';

const source = readFileSync(new URL('../assets/js/editor-blocks-list-model.js', import.meta.url), 'utf8');

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('list model parses and serializes mixed visual list blocks', () => {
  const markdown = [
    '- Alpha',
    '  1) Nested',
    '- [x] Done',
    '3. Third'
  ].join('\n');
  const block = parseListBlock(markdown);
  assert.equal(block.listType, 'mixed');
  assert.equal(block.items.length, 4);
  assert.equal(block.items[1].listType, 'ol');
  assert.equal(itemIndentLevel(block.items[1]), 1);
  assert.equal(block.items[2].listType, 'task');
  assert.equal(block.items[2].checked, true);
  assert.equal(serializeList(block), markdown);
});

run('list model patches same-level standard list groups without touching children', () => {
  const block = parseListBlock(['- One', '- Two', '  - Child', '- Three'].join('\n'));
  const patched = patchListItemType(block.items, 1, 'ol', block.listType);
  assert.equal(patched.listType, 'mixed');
  assert.deepEqual(listVisualMarkerLabels(patched.items, patched.listType), ['1.', '2.', '•', '3.']);
  assert.equal(serializeList(patched), ['1. One', '2. Two', '  - Child', '3. Three'].join('\n'));
});

run('list model merges structurally safe same-level items with rendered caret offsets', () => {
  const merged = mergeListItemIntoPreviousItem([
    { text: 'Click **Save.**', indent: 0, listType: 'ul' },
    { text: 'Follow', indent: 0, listType: 'ul' }
  ], 1);
  assert.deepEqual(merged.items, [{ text: 'Click **Save.** Follow', indent: 0, listType: 'ul' }]);
  assert.equal(merged.focusItemIndex, 0);
  assert.equal(merged.caretOffset, 'Click Save. '.length);
  assert.equal(mergeListItemIntoPreviousItem([
    { text: 'Parent', indent: 0 },
    { text: 'Child parent', indent: 0 },
    { text: 'Child', indent: 1 }
  ], 1), null);
});

run('list model dedents indented list source blocks for source autofix', () => {
  assert.equal(dedentIndentedListSource(['  - One', '    - Two'].join('\n')), ['- One', '  - Two'].join('\n'));
  assert.equal(dedentIndentedListSource('plain paragraph'), '');
});

run('blocks model keeps backward-compatible list exports', () => {
  assert.equal(modelParseListBlock, parseListBlock);
  assert.equal(modelSerializeList, serializeList);
  assert.equal(modelMergeListItemIntoPreviousItem, mergeListItemIntoPreviousItem);
});

run('list model stays DOM-free', () => {
  assert.doesNotMatch(source, /\b(?:document|window|localStorage|CustomEvent)\b/);
  assert.doesNotMatch(source, /\b(?:addEventListener|classList|querySelector|createElement|ownerDocument)\b/);
});
