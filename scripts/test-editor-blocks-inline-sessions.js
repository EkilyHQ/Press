import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createEditorBlocksInlineSessions
} from '../assets/js/editor-blocks-inline-sessions.js';

const rootSource = readFileSync(new URL('../assets/js/editor-blocks.js', import.meta.url), 'utf8');
const inlineSessionsSource = readFileSync(new URL('../assets/js/editor-blocks-inline-sessions.js', import.meta.url), 'utf8');

const run = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

run('inline sessions boundary registers inline popovers, toolbar, and rich text wiring', () => {
  const calls = [];
  const root = {
    children: [],
    appendChild(element) {
      this.children.push(element);
      calls.push(`append:${element && element.name}`);
    }
  };
  const state = {
    blocks: [
      { id: 'math-1', type: 'math' },
      { id: 'paragraph-1', type: 'paragraph' }
    ]
  };
  const blockSessions = {
    setLinkSession(session) {
      calls.push('set-link');
      this.linkSession = session;
      return session;
    },
    setMathSession(session) {
      calls.push('set-math');
      this.mathSession = session;
      return session;
    },
    setInlineToolbarSession(session) {
      calls.push('set-toolbar');
      this.inlineToolbarSession = session;
      return session;
    },
    openLinkEditorForSelection() {
      calls.push('open-link');
    },
    openMathEditorForSelection() {
      calls.push('open-math');
    },
    refreshLinkEditor(link) {
      calls.push(`refresh:${link}`);
    },
    openMathEditorForNode(node) {
      calls.push(`open-node:${node}`);
    },
    updateInlineToolbarState() {
      calls.push('toolbar-update');
    }
  };
  const captured = {};
  const inlineCommandApi = {
    applyInlineCommand: kind => calls.push(`apply:${kind}`),
    applyRunsToEditable: () => 'runs-applied',
    hasPendingInlineMarks: () => true,
    inlineCommandMark: kind => ({ mark: kind })
  };
  const factories = {
    createInlineCommandSession(options) {
      captured.inlineCommand = options;
      return inlineCommandApi;
    },
    createLinkSession(options) {
      captured.link = options;
      return {
        element: { name: 'link' },
        bind: () => calls.push('bind-link')
      };
    },
    createMathSession(options) {
      captured.math = options;
      return {
        element: { name: 'math' },
        bind: () => calls.push('bind-math')
      };
    },
    createInlineToolbarSession(options) {
      captured.toolbar = options;
      return { name: 'toolbar' };
    },
    createRichTextSession(options) {
      captured.rich = options;
      return {
        createRichEditable: (...args) => ({ kind: 'rich', args }),
        wireInlineEditable: (...args) => ({ kind: 'wire', args })
      };
    }
  };

  const result = createEditorBlocksInlineSessions({
    documentRef: {},
    root,
    list: {},
    runtime: {},
    state,
    blocksState: { invokeActiveSync: () => calls.push('sync-active') },
    blockSessions,
    text: (_key, fallback) => fallback,
    setActive: () => {},
    factories
  });

  assert.deepEqual(calls.slice(0, 6), ['set-link', 'set-math', 'set-toolbar', 'append:link', 'bind-link', 'append:math']);
  assert.equal(calls[6], 'bind-math');
  assert.equal(root.children.length, 2);
  assert.equal(result.linkSession, blockSessions.linkSession);
  assert.equal(result.mathSession, blockSessions.mathSession);
  assert.equal(result.inlineToolbarSession, blockSessions.inlineToolbarSession);
  assert.deepEqual(result.createRichEditable('x'), { kind: 'rich', args: ['x'] });
  assert.deepEqual(result.wireInlineEditable('y'), { kind: 'wire', args: ['y'] });
  assert.equal(captured.toolbar.applyInlineCommand, inlineCommandApi.applyInlineCommand);
  assert.equal(captured.toolbar.hasPendingInlineMarks(), true);
  assert.deepEqual(captured.toolbar.inlineCommandMark('bold'), { mark: 'bold' });
  assert.equal(captured.rich.applyRunsToEditable(), 'runs-applied');
  assert.equal(captured.math.getMathBlockById('math-1'), state.blocks[0]);
  assert.equal(captured.math.getMathBlockById('paragraph-1'), null);
  captured.inlineCommand.openLinkEditorForSelection();
  captured.inlineCommand.openMathEditorForSelection();
  captured.link.syncActiveEditable();
  captured.math.updateInlineToolbarState();
  captured.rich.refreshLinkEditor('docs');
  captured.rich.openMathEditorForNode('node-1');
  assert.deepEqual(calls.slice(-6), ['open-link', 'open-math', 'sync-active', 'toolbar-update', 'refresh:docs', 'open-node:node-1']);
});

run('editor root delegates inline session construction to the inline sessions boundary', () => {
  assert.match(rootSource, /from '\.\/editor-blocks-inline-sessions\.js'/);
  assert.doesNotMatch(
    rootSource,
    /createEditorBlocksInlineCommandSession\(|createEditorBlocksLinkSession\(|createEditorBlocksMathSession\(|createEditorBlocksInlineToolbarSession\(|createEditorBlocksRichTextSession\(/
  );
  assert.match(
    inlineSessionsSource,
    /export function createEditorBlocksInlineSessions\(options = \{\}\)[\s\S]*createInlineCommandSession\(\{[\s\S]*openLinkEditorForSelection: openLinkForSelection[\s\S]*createLinkSession\(\{[\s\S]*selectionLinkInEditable[\s\S]*createMathSession\(\{[\s\S]*selectionMathInEditable[\s\S]*createInlineToolbarSession\(\{[\s\S]*applyInlineCommand[\s\S]*createRichTextSession\(\{[\s\S]*applyRunsToEditable/
  );
});
