import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  applyInlineLinkToRuns,
  inlineMarksAtOffset,
  inlineRenderedTextLength,
  parseInlineRuns,
  serializeInlineRuns,
  toggleInlineMarkOnRuns
} from '../assets/js/editor-blocks-inline-model.js';
import {
  applyInlineLinkToRuns as modelApplyInlineLinkToRuns,
  parseInlineRuns as modelParseInlineRuns,
  serializeInlineRuns as modelSerializeInlineRuns
} from '../assets/js/editor-blocks-model.js';

const inlineModelSource = readFileSync(new URL('../assets/js/editor-blocks-inline-model.js', import.meta.url), 'utf8');
const blockModelSource = readFileSync(new URL('../assets/js/editor-blocks-model.js', import.meta.url), 'utf8');

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('inline model owns inline parsing, serialization, and link mutation', () => {
  const linked = applyInlineLinkToRuns(parseInlineRuns('Read docs'), 0, 9, 'https://example.com/a b', null, 'Docs');
  assert.equal(serializeInlineRuns(linked), '[Read docs](https://example.com/a%20b "Docs")');
  assert.equal(inlineRenderedTextLength('_Italic_ `a*b` \\*literal\\*'), 'Italic a*b *literal*'.length);
});

run('inline model keeps mixed selected marks and collapsed-boundary marks stable', () => {
  const next = toggleInlineMarkOnRuns(parseInlineRuns('aa **bb** cc'), 1, 7, 'bold');
  assert.equal(serializeInlineRuns(next), 'aa bb cc');
  assert.equal(inlineMarksAtOffset(parseInlineRuns('a **b**'), 2).bold, true);
});

run('block model re-exports inline API without owning inline internals', () => {
  const linked = modelApplyInlineLinkToRuns(modelParseInlineRuns('Read docs'), 0, 9, 'https://example.com/a b', null, 'Docs');
  assert.equal(modelSerializeInlineRuns(linked), '[Read docs](https://example.com/a%20b "Docs")');
  assert.doesNotMatch(blockModelSource, /function parseInlineRunsInternal|function inlineMarkedRangeAtOffset|function serializeInlineRun/);
});

run('inline model stays DOM-free', () => {
  assert.doesNotMatch(inlineModelSource, /\b(?:document|window|localStorage|CustomEvent)\b/);
  assert.doesNotMatch(inlineModelSource, /\b(?:addEventListener|classList|querySelector|createElement|ownerDocument)\b/);
});
