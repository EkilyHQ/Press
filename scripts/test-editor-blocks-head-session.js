import assert from 'node:assert/strict';

import {
  createEditorBlocksHeadSession
} from '../assets/js/editor-blocks-head-session.js';

function makeElement(tagName = 'div') {
  const attributes = new Map();
  const listeners = new Map();
  return {
    tagName,
    type: '',
    className: '',
    textContent: '',
    title: '',
    dataset: {},
    children: [],
    parentNode: null,
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatch(type, event = {}) {
      (listeners.get(type) || []).forEach(handler => handler(event));
    },
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    }
  };
}

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    }
  };
}

function marker(className, textContent = className) {
  const el = makeElement('span');
  el.className = className;
  el.textContent = textContent;
  return el;
}

function childClasses(el) {
  return el.children.map(child => child.className);
}

{
  const calls = [];
  const commandRefs = {};
  const session = createEditorBlocksHeadSession({
    documentRef: makeDocumentRef(),
    text(key, fallback) {
      return key === 'articleCard' ? 'Article Card' : fallback;
    },
    createBlockTypeIcon(type) {
      calls.push(['icon', type]);
      return marker(`icon-${type}`);
    },
    menuSession: {
      createActionControls(options) {
        commandRefs.options = options;
        return marker('actions');
      }
    },
    inlineToolbarSession: {
      createControls(index) {
        calls.push(['inline', index]);
        return marker('inline');
      }
    },
    forwardBlockHeadWheel(event) {
      calls.push(['wheel', event.deltaY]);
    },
    alignBlockActionMenu(menu, trigger) {
      calls.push(['align', menu.className, trigger.className]);
    },
    setActive(index) {
      calls.push(['setActive', index]);
    },
    moveBlock(index, direction) {
      calls.push(['moveBlock', index, direction]);
    },
    insertBlankBlock(index) {
      calls.push(['insertBlankBlock', index]);
    },
    deleteBlockAt(index) {
      calls.push(['deleteBlockAt', index]);
    }
  });
  const head = session.createBlockHead({
    block: { type: 'paragraph' },
    index: 2,
    blockCount: 5
  });
  assert.equal(head.className, 'blocks-block-head');
  assert.deepEqual(childClasses(head), ['blocks-block-type', 'inline', 'actions']);
  assert.equal(head.children[0].title, 'paragraph');
  assert.equal(head.children[0].getAttribute('role'), 'img');
  assert.equal(head.children[0].getAttribute('aria-label'), 'paragraph');
  assert.deepEqual(calls.slice(0, 2), [['icon', 'paragraph'], ['inline', 2]]);
  head.dispatch('wheel', { deltaY: 12 });
  assert.deepEqual(calls.at(-1), ['wheel', 12]);
  assert.equal(commandRefs.options.index, 2);
  assert.equal(commandRefs.options.blockCount, 5);
  commandRefs.options.setActive(2);
  commandRefs.options.moveBlock(2, -1);
  commandRefs.options.insertBlankBlock(3);
  commandRefs.options.deleteBlockAt(2);
  commandRefs.options.onReposition(marker('menu'), marker('trigger'));
  assert.deepEqual(calls.slice(-5), [
    ['setActive', 2],
    ['moveBlock', 2, -1],
    ['insertBlankBlock', 3],
    ['deleteBlockAt', 2],
    ['align', 'menu', 'trigger']
  ]);
}

{
  const session = createEditorBlocksHeadSession({
    documentRef: makeDocumentRef(),
    createBlockTypeIcon(type) {
      return marker(`icon-${type}`);
    },
    sourceSession: {
      createReasonHelp() {
        return marker('source-help');
      },
      canAutofix() {
        return true;
      },
      createAutofixButton() {
        return marker('source-autofix');
      }
    },
    listSession: {
      createTypeSelect() {
        return marker('list-type');
      },
      createIndentControls() {
        return marker('list-indent');
      }
    },
    codeSession: {
      createLanguageInput() {
        return marker('code-lang');
      }
    },
    imageSession: {
      createMetadataControls() {
        return marker('image-meta');
      }
    },
    tableSession: {
      createControls() {
        return marker('table-controls');
      }
    },
    inlineToolbarSession: {
      createControls() {
        return marker('inline');
      }
    },
    createHeadingLevelSelect() {
      return marker('heading-level');
    },
    createMathEditButton() {
      return marker('math-edit');
    },
    menuSession: {
      createActionControls() {
        return marker('actions');
      }
    }
  });
  assert.deepEqual(childClasses(session.createBlockHead({ block: { type: 'source' }, index: 0, blockCount: 1 })), [
    'blocks-block-type',
    'source-help',
    'source-autofix',
    'actions'
  ]);
  assert.deepEqual(childClasses(session.createBlockHead({ block: { type: 'heading' }, index: 0, blockCount: 1 })), [
    'blocks-block-type',
    'heading-level',
    'actions'
  ]);
  assert.deepEqual(childClasses(session.createBlockHead({ block: { type: 'list' }, index: 0, blockCount: 1 })), [
    'blocks-block-type',
    'list-type',
    'list-indent',
    'inline',
    'actions'
  ]);
  assert.deepEqual(childClasses(session.createBlockHead({ block: { type: 'code' }, index: 0, blockCount: 1 })), [
    'blocks-block-type',
    'code-lang',
    'actions'
  ]);
  assert.deepEqual(childClasses(session.createBlockHead({ block: { type: 'math' }, index: 0, blockCount: 1 })), [
    'blocks-block-type',
    'math-edit',
    'actions'
  ]);
  assert.deepEqual(childClasses(session.createBlockHead({ block: { type: 'image' }, index: 0, blockCount: 1 })), [
    'blocks-block-type',
    'image-meta',
    'actions'
  ]);
  assert.deepEqual(childClasses(session.createBlockHead({ block: { type: 'table' }, index: 0, blockCount: 1 })), [
    'blocks-block-type',
    'table-controls',
    'actions'
  ]);
  assert.deepEqual(childClasses(session.createBlockHead({ block: { type: 'quote' }, index: 0, blockCount: 1 })), [
    'blocks-block-type',
    'inline',
    'actions'
  ]);
}

assert.equal(createEditorBlocksHeadSession({ documentRef: null }), null);

console.log('ok - editor blocks head session');
