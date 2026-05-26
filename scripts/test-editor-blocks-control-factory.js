import assert from 'node:assert/strict';
import { createEditorBlocksControlFactory } from '../assets/js/editor-blocks-control-factory.js';

function makeClassList() {
  const classes = new Set();
  return {
    classes,
    add(name) {
      classes.add(name);
    },
    remove(name) {
      classes.delete(name);
    },
    contains(name) {
      return classes.has(name);
    }
  };
}

function makeElement(tagName = 'div') {
  const attrs = {};
  const listeners = new Map();
  const children = [];
  const element = {
    tagName: String(tagName).toUpperCase(),
    type: '',
    className: '',
    textContent: '',
    innerHTML: '',
    title: '',
    value: '',
    scrollHeight: 0,
    style: {},
    attrs,
    children,
    classList: makeClassList(),
    appendChild(child) {
      children.push(child);
      child.parentNode = element;
      return child;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
    },
    getAttribute(name) {
      return attrs[name] || null;
    },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatch(type, event = {}) {
      const dispatched = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...event
      };
      (listeners.get(type) || []).forEach(handler => handler(dispatched));
      return dispatched;
    }
  };
  return element;
}

function makeRuntime() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    },
    createElementNS(namespace, tagName) {
      const element = makeElement(tagName);
      element.namespace = namespace;
      return element;
    }
  };
}

const calls = [];
const blocks = [{ name: 'first-block' }, { name: 'math-block-el' }];
const factory = createEditorBlocksControlFactory({
  runtime: makeRuntime(),
  text: (key, fallback) => (key === 'editMath' ? 'Edit TeX' : fallback),
  updateFromControl(block, patch, renderAfter) {
    calls.push(['updateFromControl', block && block.name, patch, renderAfter]);
  },
  blockElements: () => blocks,
  setActive(index) {
    calls.push(['setActive', index]);
  },
  openMathEditorForBlock(block, blockEl) {
    calls.push(['openMathEditorForBlock', block && block.name, blockEl && blockEl.name]);
  }
});

{
  const icon = factory.createBlockTypeIcon('math');
  assert.equal(icon.tagName, 'SVG');
  assert.equal(icon.namespace, 'http://www.w3.org/2000/svg');
  assert.equal(icon.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(icon.getAttribute('aria-hidden'), 'true');
  assert.match(icon.innerHTML, /M4 19h16/);
}

{
  const icon = factory.createBlockTypeIcon('unknown-type');
  assert.match(icon.innerHTML, /M13 4v16/);
}

{
  const block = { name: 'heading-block', data: { level: 4 } };
  const select = factory.createHeadingLevelSelect(block);
  assert.equal(select.tagName, 'SELECT');
  assert.equal(select.className, 'blocks-heading-level');
  assert.equal(select.title, 'Heading level');
  assert.equal(select.value, '4');
  assert.equal(select.children.length, 6);
  assert.equal(select.children[0].value, '1');
  assert.equal(select.children[5].textContent, 'H6');
  select.value = '5';
  select.dispatch('change');
  assert.deepEqual(calls.at(-1), ['updateFromControl', 'heading-block', { level: 5 }, true]);
}

{
  const block = { name: 'math-block' };
  const button = factory.createMathEditButton(block, 1);
  assert.equal(button.tagName, 'BUTTON');
  assert.equal(button.type, 'button');
  assert.equal(button.className, 'blocks-btn blocks-math-edit');
  assert.equal(button.textContent, 'Edit TeX');
  assert.equal(button.getAttribute('aria-label'), 'Edit TeX');
  const event = button.dispatch('mousedown');
  assert.equal(event.defaultPrevented, true);
  button.dispatch('click');
  assert.deepEqual(calls.slice(-2), [
    ['setActive', 1],
    ['openMathEditorForBlock', 'math-block', 'math-block-el']
  ]);
}

{
  const area = makeElement('textarea');
  area.scrollHeight = 128;
  factory.autoSizeTextarea(area);
  assert.equal(area.style.height, '128px');
}

console.log('editor blocks control factory tests passed');
