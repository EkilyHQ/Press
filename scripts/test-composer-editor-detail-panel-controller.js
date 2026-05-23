import assert from 'node:assert/strict';
import { createComposerEditorDetailPanelController } from '../assets/js/composer-editor-detail-panel-controller.js';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(id) {
    this.id = id;
    this.attrs = {};
    this.classList = new FakeClassList();
    this.rectReads = 0;
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  getBoundingClientRect() {
    this.rectReads += 1;
    return { width: 1, height: 1, top: 0, left: 0 };
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  addElement(element) {
    this.elements.set(element.id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }
}

{
  const documentRef = new FakeDocument();
  const structurePanel = documentRef.addElement(new FakeElement('editorStructurePanel'));
  const markdownPanel = documentRef.addElement(new FakeElement('editorMarkdownPanel'));
  const calls = [];
  const controller = createComposerEditorDetailPanelController({
    documentRef,
    setSystemPanelVisible: visible => calls.push(['systemVisible', !!visible]),
    showSystemPanel: mode => calls.push(['showSystem', mode])
  });

  controller.setEditorDetailPanelMode('structure');
  assert.equal(structurePanel.attrs.hidden, undefined);
  assert.equal(structurePanel.attrs['aria-hidden'], undefined);
  assert.equal(markdownPanel.attrs.hidden, '');
  assert.equal(markdownPanel.attrs['aria-hidden'], 'true');
  assert.deepEqual(calls.at(-1), ['systemVisible', false]);

  controller.setEditorDetailPanelMode('markdown');
  assert.equal(structurePanel.attrs.hidden, '');
  assert.equal(structurePanel.attrs['aria-hidden'], 'true');
  assert.equal(markdownPanel.attrs.hidden, undefined);
  assert.equal(markdownPanel.attrs['aria-hidden'], undefined);
  assert.deepEqual(calls.at(-1), ['systemVisible', false]);

  markdownPanel.classList.add('is-content-entering');
  controller.setEditorDetailPanelMode('themes');
  assert.equal(structurePanel.attrs.hidden, '');
  assert.equal(markdownPanel.attrs.hidden, '');
  assert.equal(markdownPanel.classList.contains('is-content-entering'), false);
  assert.deepEqual(calls.slice(-2), [
    ['systemVisible', true],
    ['showSystem', 'themes']
  ]);
}

{
  const documentRef = new FakeDocument();
  const structurePanel = documentRef.addElement(new FakeElement('editorStructurePanel'));
  const markdownPanel = documentRef.addElement(new FakeElement('editorMarkdownPanel'));
  const timers = [];
  const cleared = [];
  const controller = createComposerEditorDetailPanelController({
    documentRef,
    setTimeoutRef: (handler, delay) => {
      const id = timers.length + 1;
      timers.push({ id, handler, delay });
      return id;
    },
    clearTimeoutRef: id => cleared.push(id)
  });

  controller.animateEditorStructurePanelContent(structurePanel);
  assert.equal(structurePanel.classList.contains('is-content-entering'), true);
  assert.equal(structurePanel.rectReads, 1);
  assert.equal(timers[0].delay, 260);
  assert.equal(structurePanel.__pressStructureAnimationTimer, 1);
  timers[0].handler();
  assert.equal(structurePanel.classList.contains('is-content-entering'), false);
  assert.equal(structurePanel.__pressStructureAnimationTimer, null);

  controller.animateEditorMarkdownPanelContent();
  assert.equal(markdownPanel.classList.contains('is-content-entering'), true);
  assert.equal(markdownPanel.__pressMarkdownAnimationTimer, 2);
  controller.animateEditorMarkdownPanelContent();
  assert.deepEqual(cleared, [2]);
  assert.equal(markdownPanel.__pressMarkdownAnimationTimer, 3);
}
