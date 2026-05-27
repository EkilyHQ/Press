import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createEditorBlocksBlockTypeSessions
} from '../assets/js/editor-blocks-block-type-sessions.js';

const rootSource = readFileSync(new URL('../assets/js/editor-blocks.js', import.meta.url), 'utf8');
const blockTypeSessionsSource = readFileSync(new URL('../assets/js/editor-blocks-block-type-sessions.js', import.meta.url), 'utf8');

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('block type session assembly registers picker and list sessions and exposes render delegates', () => {
  const calls = [];
  const root = {
    children: [],
    appendChild(element) {
      this.children.push(element);
      calls.push(`append:${element.name}`);
    }
  };
  const state = { blocks: [{ id: 'table-1', type: 'table' }] };
  const blockSessions = {
    setCardPickerSession(session) {
      calls.push('set-card-picker');
      this.cardPickerSession = session;
      return session;
    },
    setListSession(session) {
      calls.push('set-list');
      this.listSession = session;
      return session;
    },
    insertCommandBlock(type, data, options) {
      calls.push(`insert:${type}:${options.index}:${data.title}`);
      return { type, data, options };
    }
  };
  const captured = {};
  const renderSession = name => ({
    name,
    renderBlock(body, block, index) {
      calls.push(`render:${name}:${block.type}:${index}`);
      body.rendered = name;
    }
  });
  const factories = {
    createCardPickerSession(options) {
      captured.cardPicker = options;
      return { element: { name: 'card-picker' } };
    },
    createImageSession(options) {
      captured.image = options;
      return {
        ...renderSession('image'),
        insertImageBlock: () => 'inserted-image'
      };
    },
    createCodeSession(options) {
      captured.code = options;
      return renderSession('code');
    },
    createTableSession(options) {
      captured.table = options;
      return {
        ...renderSession('table'),
        syncActiveAlignmentFromEditable(block, editable, blocks) {
          calls.push(`sync-table:${block.id}:${editable.name}:${blocks.length}`);
        }
      };
    },
    createSourceSession(options) {
      captured.source = options;
      return renderSession('source');
    },
    createListSession(options) {
      captured.list = options;
      return renderSession('list');
    },
    createHighlightFragment(code, language, options) {
      calls.push(`highlight:${code}:${language}:${options.allowAmbient}:${!!options.documentRef}:${!!options.windowRef}`);
      return { code, language, options };
    }
  };

  const result = createEditorBlocksBlockTypeSessions({
    documentRef: { name: 'doc' },
    windowRef: { name: 'win' },
    runtime: { name: 'runtime' },
    root,
    state,
    blockSessions,
    text: (_key, fallback) => fallback,
    defaultListItems: () => [],
    makeBlock: () => ({}),
    makeBlankBlock: () => ({}),
    makeSplitListBlock: () => ({}),
    factories
  });

  assert.deepEqual(calls.slice(0, 3), ['set-card-picker', 'append:card-picker', 'set-list']);
  assert.equal(result.cardPickerSession, blockSessions.cardPickerSession);
  assert.equal(result.listSession, blockSessions.listSession);
  assert.equal(captured.cardPicker.insertCardBlock({ title: 'Article' }, 2).type, 'card');
  assert.equal(calls.includes('insert:card:2:Article'), true);
  assert.equal(captured.table.editableTableData instanceof Function, true);
  assert.equal(captured.source.textareaTextOffsetDetailsFromPoint instanceof Function, true);
  assert.equal(captured.list.mergeFirstListItemIntoPreviousBlock instanceof Function, true);
  captured.code.createHighlightFragment('const x = 1;', 'javascript');
  assert.equal(calls.includes('highlight:const x = 1;:javascript:false:true:true'), true);
  result.syncActiveTableAlignmentFromEditable(state.blocks[0], { name: 'cell' });
  assert.equal(calls.includes('sync-table:table-1:cell:1'), true);
  const body = {};
  result.renderers.image(body, { type: 'image' }, 4);
  assert.deepEqual([body.rendered, calls.at(-1)], ['image', 'render:image:image:4']);
});

run('editor root delegates block type session construction to the block type sessions boundary', () => {
  assert.match(rootSource, /from '\.\/editor-blocks-block-type-sessions\.js'/);
  assert.doesNotMatch(
    rootSource,
    /createEditorBlocksCardPickerSession\(|createEditorBlocksImageSession\(|createEditorBlocksCodeSession\(|createEditorBlocksTableSession\(|createEditorBlocksSourceSession\(|createEditorBlocksListSession\(/
  );
  assert.match(
    blockTypeSessionsSource,
    /export function createEditorBlocksBlockTypeSessions\(options = \{\}\)[\s\S]*createCardPickerSession\(\{[\s\S]*insertCardBlock[\s\S]*createImageSession\(\{[\s\S]*insertPlainTextIntoEditable[\s\S]*createCodeSession\(\{[\s\S]*createHighlightFragment[\s\S]*createTableSession\(\{[\s\S]*editableTableData[\s\S]*createSourceSession\(\{[\s\S]*textareaTextOffsetDetailsFromPoint[\s\S]*createListSession\(\{[\s\S]*mergeFirstListItemIntoPreviousBlock[\s\S]*renderers: \{/
  );
});
