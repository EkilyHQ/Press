import assert from 'node:assert/strict';

import { createEditorMainToolbarTextActions } from '../assets/js/editor-main-toolbar-text-actions.js';

class FakeTextarea {
  constructor(value = '') {
    this.value = value;
    this.selectionStart = 0;
    this.selectionEnd = 0;
    this.focusCount = 0;
    this.dispatchedEvents = [];
  }

  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  setRangeText(text, start, end, selectionMode = 'preserve') {
    this.value = `${this.value.slice(0, start)}${text}${this.value.slice(end)}`;
    if (selectionMode === 'end') {
      const position = start + String(text).length;
      this.setSelectionRange(position, position);
    }
  }

  dispatchEvent(event) {
    this.dispatchedEvents.push(event);
    return true;
  }

  focus() {
    this.focusCount += 1;
  }
}

function createActions(textarea, createInputEvent = () => ({ type: 'input' })) {
  return createEditorMainToolbarTextActions({
    getEditorTextarea: () => textarea,
    createInputEvent
  });
}

{
  const textarea = new FakeTextarea('hello world');
  textarea.setSelectionRange(5, 0);
  const actions = createActions(textarea);

  actions.recordSelection();
  assert.deepEqual(actions.getLastSelection(), { start: 0, end: 5 });
  assert.equal(actions.applyInlineFormat('**', '**'), true);
  assert.equal(textarea.value, '**hello** world');
  assert.equal(textarea.selectionStart, 0);
  assert.equal(textarea.selectionEnd, 9);
  assert.deepEqual(textarea.dispatchedEvents, [{ type: 'input' }]);
}

{
  const textarea = new FakeTextarea('**hello** world');
  textarea.setSelectionRange(0, 9);
  const actions = createActions(textarea);

  actions.recordSelection();
  assert.equal(actions.applyInlineFormat('**', '**'), true);
  assert.equal(textarea.value, 'hello world');
  assert.deepEqual(actions.getLastSelection(), { start: 0, end: 5 });
}

{
  const textarea = new FakeTextarea('Alpha\nBeta');
  textarea.setSelectionRange(0, textarea.value.length);
  const actions = createActions(textarea);

  actions.recordSelection();
  assert.equal(actions.toggleLinePrefix('> '), true);
  assert.equal(textarea.value, '> Alpha\n> Beta');
  textarea.setSelectionRange(0, textarea.value.length);
  actions.recordSelection();
  assert.equal(actions.toggleLinePrefix('> '), true);
  assert.equal(textarea.value, 'Alpha\nBeta');
}

{
  const textarea = new FakeTextarea('Alpha\n\nOmega');
  textarea.setSelectionRange(6, 6);
  const actions = createActions(textarea);

  actions.recordSelection();
  assert.equal(actions.isCaretOnEmptyLine(textarea, actions.getLastSelection()), true);
  assert.equal(actions.applyCodeBlockFormat(), true);
  assert.equal(textarea.value, 'Alpha\n```\n\n```\nOmega');
  assert.equal(textarea.selectionStart, 10);
  assert.equal(textarea.selectionEnd, 10);
}

{
  const textarea = new FakeTextarea('AlphaOmega');
  textarea.setSelectionRange(5, 5);
  const actions = createActions(textarea);

  actions.recordSelection();
  assert.equal(actions.insertCardLink({ key: 'Post', location: 'post/main.md' }), true);
  assert.equal(textarea.value, 'Alpha\n[Post](?id=post/main.md)\nOmega');
  assert.equal(
    textarea.value.slice(textarea.selectionStart, textarea.selectionEnd),
    '[Post](?id=post/main.md)'
  );
}

{
  const textarea = new FakeTextarea('Read this');
  textarea.setSelectionRange(0, 4);
  const actions = createActions(textarea);

  actions.recordSelection();
  assert.equal(actions.insertCardLink({ key: 'Fallback', location: 'post/main.md' }), true);
  assert.equal(textarea.value, '[Read](?id=post/main.md) this');
}

{
  const textarea = new FakeTextarea('hello');
  textarea.setSelectionRange(0, 5);
  const actions = createActions(textarea, () => null);

  actions.recordSelection();
  assert.equal(actions.applyInlineFormat('*', '*'), true);
  assert.equal(textarea.value, '*hello*');
  assert.deepEqual(textarea.dispatchedEvents, []);
}
