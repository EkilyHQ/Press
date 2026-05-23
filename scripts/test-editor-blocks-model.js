import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  applyInlineLinkToRuns,
  BLOCK_TYPES,
  makeBlock,
  parseInlineRuns,
  parseMarkdownBlocks,
  serializeInlineRuns,
  serializeMarkdownBlocks
} from '../assets/js/editor-blocks-model.js';

const source = readFileSync(new URL('../assets/js/editor-blocks-model.js', import.meta.url), 'utf8');

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('model owns block type registration and markdown round-trip rules', () => {
  assert.equal(BLOCK_TYPES.has('paragraph'), true);
  assert.equal(BLOCK_TYPES.has('table'), true);
  assert.equal(BLOCK_TYPES.has('blank'), true);
  const markdown = [
    '# Title',
    '',
    'Paragraph with **bold** and [docs](?id=post/doc.md "Docs").',
    '',
    '| A | B |',
    '| :--- | ---: |',
    '| 1 | 2 |',
    ''
  ].join('\n');
  assert.equal(serializeMarkdownBlocks(parseMarkdownBlocks(markdown)), markdown);
});

run('model owns inline run parsing and serialization', () => {
  const linked = applyInlineLinkToRuns(parseInlineRuns('Read docs'), 0, 9, 'https://example.com/a b', null, 'Docs');
  assert.equal(serializeInlineRuns(linked), '[Read docs](https://example.com/a%20b "Docs")');
});

run('model normalizes unknown block types without touching DOM state', () => {
  const block = makeBlock('unknown', 'raw', { dirty: true });
  assert.equal(block.type, 'source');
  assert.equal(block.raw, 'raw');
  assert.equal(block.dirty, true);
});

run('model stays DOM-free', () => {
  assert.doesNotMatch(source, /\b(?:document|window|localStorage|CustomEvent)\b/);
  assert.doesNotMatch(source, /\b(?:addEventListener|classList|querySelector|createElement|ownerDocument)\b/);
});
