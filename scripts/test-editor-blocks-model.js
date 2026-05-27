import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  applyInlineLinkToRuns,
  autofixMarkdownSourceBlock,
  BLOCK_TYPES,
  makeBlock,
  parseInlineRuns,
  parseMarkdownBlocks,
  serializeInlineRuns,
  serializeMarkdownBlocks
} from '../assets/js/editor-blocks-model.js';
import {
  BLOCK_TYPES as coreBlockTypes,
  makeBlock as coreMakeBlock
} from '../assets/js/editor-blocks-block-core-model.js';
import {
  autofixMarkdownSourceBlock as parserAutofixMarkdownSourceBlock,
  parseMarkdownBlocks as parserParseMarkdownBlocks
} from '../assets/js/editor-blocks-markdown-parse-model.js';
import {
  serializeMarkdownBlocks as serializerSerializeMarkdownBlocks
} from '../assets/js/editor-blocks-markdown-serialize-model.js';

const source = readFileSync(new URL('../assets/js/editor-blocks-model.js', import.meta.url), 'utf8');
const coreSource = readFileSync(new URL('../assets/js/editor-blocks-block-core-model.js', import.meta.url), 'utf8');
const parserSource = readFileSync(new URL('../assets/js/editor-blocks-markdown-parse-model.js', import.meta.url), 'utf8');
const serializerSource = readFileSync(new URL('../assets/js/editor-blocks-markdown-serialize-model.js', import.meta.url), 'utf8');

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('model facade keeps block core and markdown round-trip compatibility', () => {
  assert.equal(BLOCK_TYPES, coreBlockTypes);
  assert.equal(makeBlock, coreMakeBlock);
  assert.equal(parseMarkdownBlocks, parserParseMarkdownBlocks);
  assert.equal(serializeMarkdownBlocks, serializerSerializeMarkdownBlocks);
  assert.equal(autofixMarkdownSourceBlock, parserAutofixMarkdownSourceBlock);
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

run('block core normalizes unknown block types without touching DOM state', () => {
  const block = makeBlock('unknown', 'raw', { dirty: true });
  assert.equal(block.type, 'source');
  assert.equal(block.raw, 'raw');
  assert.equal(block.dirty, true);
});

run('model facade and extracted markdown models stay DOM-free', () => {
  for (const modelSource of [source, coreSource, parserSource, serializerSource]) {
    assert.doesNotMatch(modelSource, /\b(?:document|window|localStorage|CustomEvent)\b/);
    assert.doesNotMatch(modelSource, /\b(?:addEventListener|classList|querySelector|createElement|ownerDocument)\b/);
  }
});
