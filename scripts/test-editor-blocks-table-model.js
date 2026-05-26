import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  editableTableData,
  normalizeTableAlignment,
  normalizeTableCellValue,
  parseTableBlock,
  serializeTable,
  tableColumnCount
} from '../assets/js/editor-blocks-table-model.js';
import {
  editableTableData as modelEditableTableData,
  parseTableBlock as modelParseTableBlock,
  serializeTable as modelSerializeTable
} from '../assets/js/editor-blocks-model.js';

const source = readFileSync(new URL('../assets/js/editor-blocks-table-model.js', import.meta.url), 'utf8');

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('table model parses and serializes pipe tables with alignment metadata', () => {
  const markdown = [
    '| A | B | C |',
    '| :--- | :---: | ---: |',
    '| 1 | 2 | 3 |',
    '| 4 | 5 | |'
  ].join('\n');
  const table = parseTableBlock(markdown);
  assert.deepEqual(table.headers, ['A', 'B', 'C']);
  assert.deepEqual(table.alignments, ['left', 'center', 'right']);
  assert.deepEqual(table.rows, [['1', '2', '3'], ['4', '5', '']]);
  assert.equal(serializeTable(table), [
    '| A | B | C |',
    '| :--- | :---: | ---: |',
    '| 1 | 2 | 3 |',
    '| 4 | 5 |  |'
  ].join('\n'));
});

run('table model normalizes dirty editable data into a safe rectangular table', () => {
  const table = editableTableData({
    headers: [' Name ', 'Notes|Unsafe'],
    alignments: ['LEFT', 'bogus', 'right'],
    rows: [[' a\nb ', 'c|d'], ['only one']]
  });
  assert.deepEqual(table.headers, ['Name', 'Notes Unsafe', '']);
  assert.deepEqual(table.alignments, ['left', '', 'right']);
  assert.deepEqual(table.rows, [['a b', 'c d', ''], ['only one', '', '']]);
  assert.equal(tableColumnCount(table), 3);
  assert.equal(serializeTable(table), [
    '| Name | Notes Unsafe |  |',
    '| :--- | --- | ---: |',
    '| a b | c d |  |',
    '| only one |  |  |'
  ].join('\n'));
});

run('table model rejects malformed pipe tables without promoting risky text', () => {
  assert.equal(parseTableBlock('| A | B |\n| --- |\n| 1 | 2 |'), null);
  assert.equal(parseTableBlock('| A | B |\n| --- | --- |\n| 1 | 2 | 3 |'), null);
  assert.equal(parseTableBlock('| A | B |\n| --- | --- |\n\n| 1 | 2 |'), null);
  assert.equal(parseTableBlock('| A \\| B |\n| --- |\n| 1 |'), null);
});

run('table model exposes small normalization helpers', () => {
  assert.equal(normalizeTableAlignment(' CENTER '), 'center');
  assert.equal(normalizeTableAlignment('middle'), '');
  assert.equal(normalizeTableCellValue(' A|B\r\nC '), 'A B C');
});

run('blocks model keeps backward-compatible table exports', () => {
  assert.equal(modelParseTableBlock, parseTableBlock);
  assert.equal(modelSerializeTable, serializeTable);
  assert.equal(modelEditableTableData, editableTableData);
});

run('table model stays DOM-free', () => {
  assert.doesNotMatch(source, /\b(?:document|window|localStorage|CustomEvent)\b/);
  assert.doesNotMatch(source, /\b(?:addEventListener|classList|querySelector|createElement|ownerDocument)\b/);
});
