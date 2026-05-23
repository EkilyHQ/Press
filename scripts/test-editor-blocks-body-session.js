import assert from 'node:assert/strict';

import { createEditorBlocksBodySession } from '../assets/js/editor-blocks-body-session.js';

function classSet(node) {
  return new Set(String(node.className || '').split(/\s+/).filter(Boolean));
}

function makeClassList(node) {
  return {
    add(...names) {
      const classes = classSet(node);
      names.forEach(name => classes.add(name));
      node.className = Array.from(classes).join(' ');
    },
    remove(...names) {
      const classes = classSet(node);
      names.forEach(name => classes.delete(name));
      node.className = Array.from(classes).join(' ');
    },
    contains(name) {
      return classSet(node).has(name);
    }
  };
}

function matchesSimple(node, selector) {
  let source = String(selector || '').trim();
  if (!source) return false;
  const attr = source.match(/\[([^=\]]+)(?:="([^"]*)")?\]/);
  if (attr) {
    const name = attr[1];
    const actual = node.getAttribute ? node.getAttribute(name) : '';
    if (attr[2] != null && String(actual || '') !== attr[2]) return false;
    if (attr[2] == null && !actual) return false;
    source = source.replace(attr[0], '');
  }
  const tag = source.match(/^[A-Za-z][A-Za-z0-9-]*/);
  if (tag && node.tagName.toLowerCase() !== tag[0].toLowerCase()) return false;
  const classes = Array.from(source.matchAll(/\.([A-Za-z0-9_-]+)/g)).map(match => match[1]);
  return classes.every(name => classSet(node).has(name));
}

function matchesSelectorChain(node, parts) {
  if (!node || !matchesSimple(node, parts[parts.length - 1])) return false;
  let current = node.parentElement || node.parentNode || null;
  for (let partIndex = parts.length - 2; partIndex >= 0; partIndex -= 1) {
    while (current && !matchesSimple(current, parts[partIndex])) {
      current = current.parentElement || current.parentNode || null;
    }
    if (!current) return false;
    current = current.parentElement || current.parentNode || null;
  }
  return true;
}

function querySelectorAllFrom(root, selector) {
  const parts = String(selector || '').trim().split(/\s+/).filter(Boolean);
  const out = [];
  const stack = [...(root.children || [])];
  while (stack.length) {
    const child = stack.shift();
    if (matchesSelectorChain(child, parts)) out.push(child);
    if (child.children) stack.push(...child.children);
  }
  return out;
}

function makeElement(tagName = 'div') {
  const listeners = new Map();
  const attrs = {};
  const children = [];
  const node = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    className: '',
    textContent: '',
    dataset: {},
    children,
    parentNode: null,
    parentElement: null,
    tabIndex: 0,
    classList: null,
    append(...items) {
      items.flat().forEach((item) => {
        if (!item) return;
        item.parentNode = node;
        item.parentElement = node;
        children.push(item);
      });
    },
    appendChild(item) {
      node.append(item);
      return item;
    },
    insertBefore(item, reference) {
      item.parentNode = node;
      item.parentElement = node;
      const index = children.indexOf(reference);
      if (index >= 0) children.splice(index, 0, item);
      else children.push(item);
      return item;
    },
    remove() {
      const parent = node.parentNode;
      if (!parent || !Array.isArray(parent.children)) return;
      const index = parent.children.indexOf(node);
      if (index >= 0) parent.children.splice(index, 1);
      node.parentNode = null;
      node.parentElement = null;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
        node.dataset[key] = String(value);
      }
    },
    getAttribute(name) {
      return attrs[name] || '';
    },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatch(type, event = {}) {
      let defaultPrevented = false;
      let stopped = false;
      const dispatched = {
        ...event,
        target: event.target || node,
        preventDefault() { defaultPrevented = true; },
        stopPropagation() { stopped = true; }
      };
      (listeners.get(type) || []).slice().forEach(handler => handler(dispatched));
      return { defaultPrevented, stopped };
    },
    matches(selector) {
      return matchesSimple(node, selector);
    },
    closest(selector) {
      let current = node;
      while (current) {
        if (current.matches && current.matches(selector)) return current;
        current = current.parentElement || current.parentNode || null;
      }
      return null;
    },
    querySelector(selector) {
      return querySelectorAllFrom(node, selector)[0] || null;
    },
    querySelectorAll(selector) {
      return querySelectorAllFrom(node, selector);
    }
  };
  node.classList = makeClassList(node);
  return node;
}

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    }
  };
}

function makeHarness(options = {}) {
  const documentRef = makeDocumentRef();
  const list = documentRef.createElement('div');
  const calls = [];
  let suppressClick = false;
  const state = {
    activeIndex: 0,
    blocks: [
      { id: 'heading-1', type: 'heading', data: { level: 3, text: 'Title' } },
      { id: 'math-1', type: 'math', data: { tex: 'x+1' } },
      { id: 'card-1', type: 'card', data: { location: 'docs/intro.md', label: 'Intro' } },
      { id: 'source-1', type: 'source', data: { text: '<raw>' } }
    ]
  };
  const session = createEditorBlocksBodySession({
    documentRef,
    state,
    list,
    text(_key, fallback) {
      return fallback;
    },
    blockElements: () => list.children.filter(child => child.classList.contains('blocks-block')),
    headSession: {
      createBlockHead({ index, blockCount }) {
        calls.push(['head', index, blockCount]);
        const head = documentRef.createElement('div');
        head.className = 'blocks-block-head';
        head.textContent = `head ${index}`;
        return head;
      }
    },
    closestElement(node, selector) {
      return node && typeof node.closest === 'function' ? node.closest(selector) : null;
    },
    createRichEditable(tagName, block, key, className, index) {
      calls.push(['rich', tagName, key, index]);
      const editable = documentRef.createElement(tagName);
      editable.className = className;
      editable.textContent = block.data[key] || '';
      return editable;
    },
    renderMath(node) {
      calls.push(['renderMath', node.className]);
    },
    hydrateCard(node) {
      calls.push(['hydrateCard', node.className]);
    },
    setActive(index) {
      calls.push(['setActive', index]);
    },
    activateNonTextBlockFromPointer(index, blockEl) {
      calls.push(['activateNonText', index, blockEl && blockEl.dataset.blockId]);
    },
    openMathEditorForBlock(block, blockEl) {
      calls.push(['openMath', block && block.id, blockEl && blockEl.dataset.blockId]);
    },
    shouldSuppressRoutedBlockContainerClick() {
      return suppressClick;
    },
    removeEmptyBlockWithBackspace(event, block, index) {
      calls.push(['removeEmpty', event.key, block && block.id, index]);
      return !!options.removeBackspace;
    },
    handleCrossBlockArrowNavigation(event, index) {
      calls.push(['arrow', event.key, index]);
      return true;
    },
    renderers: {
      source(body, block, index) {
        calls.push(['source', block && block.id, index]);
        const area = documentRef.createElement('textarea');
        area.className = 'blocks-source-textarea';
        body.appendChild(area);
      }
    }
  });
  return {
    calls,
    documentRef,
    list,
    session,
    state,
    setSuppressClick(value) {
      suppressClick = !!value;
    }
  };
}

{
  const h = makeHarness();
  const blockEl = h.session.renderBlockElement(h.state.blocks[0], 0);
  h.list.appendChild(blockEl);
  assert.equal(blockEl.tagName, 'SECTION');
  assert.equal(blockEl.classList.contains('blocks-block-heading'), true);
  assert.equal(blockEl.classList.contains('is-active'), true);
  assert.equal(blockEl.dataset.type, 'heading');
  assert.equal(blockEl.dataset.blockId, 'heading-1');
  assert.equal(blockEl.querySelector('.blocks-block-head').textContent, 'head 0');
  assert.equal(blockEl.querySelector('.blocks-heading-h3').textContent, 'Title');
  assert.deepEqual(h.calls.slice(0, 2), [['head', 0, 4], ['rich', 'h3', 'text', 0]]);
}

{
  const h = makeHarness();
  const blockEl = h.session.renderBlockElement(h.state.blocks[0], 0);
  const body = blockEl.querySelector('.blocks-block-body');
  h.calls.length = 0;
  body.dispatch('click');
  assert.deepEqual(h.calls, [['setActive', 0]]);
  h.calls.length = 0;
  h.setSuppressClick(true);
  const result = body.dispatch('click');
  assert.equal(result.stopped, true);
  assert.deepEqual(h.calls, []);
  h.setSuppressClick(false);
  blockEl.dispatch('click', { target: blockEl.querySelector('.blocks-block-head') });
  assert.deepEqual(h.calls, []);
}

{
  const h = makeHarness();
  const blockEl = h.session.renderBlockElement(h.state.blocks[0], 0);
  h.calls.length = 0;
  blockEl.dispatch('focusin');
  blockEl.dispatch('keydown', { key: 'ArrowDown', target: blockEl });
  assert.deepEqual(h.calls, [
    ['setActive', 0],
    ['removeEmpty', 'ArrowDown', 'heading-1', 0],
    ['arrow', 'ArrowDown', 0]
  ]);
}

{
  const h = makeHarness({ removeBackspace: true });
  const blockEl = h.session.renderBlockElement(h.state.blocks[0], 0);
  h.calls.length = 0;
  blockEl.dispatch('keydown', { key: 'Backspace', target: blockEl });
  assert.deepEqual(h.calls, [['removeEmpty', 'Backspace', 'heading-1', 0]]);
}

{
  const h = makeHarness();
  h.state.activeIndex = 1;
  const blockEl = h.session.renderBlockElement(h.state.blocks[1], 1);
  h.list.appendChild(blockEl);
  const preview = blockEl.querySelector('.blocks-math-preview');
  assert.equal(blockEl.querySelector('.blocks-display-math').dataset.tex, 'x+1');
  assert.deepEqual(h.calls.slice(-1), [['renderMath', 'blocks-math-preview']]);
  h.calls.length = 0;
  const pointer = preview.dispatch('pointerdown', { button: 0, isPrimary: true });
  const click = preview.dispatch('click');
  assert.equal(pointer.defaultPrevented, true);
  assert.equal(pointer.stopped, true);
  assert.equal(click.defaultPrevented, true);
  assert.deepEqual(h.calls, [
    ['activateNonText', 1, 'math-1'],
    ['setActive', 1],
    ['openMath', 'math-1', 'math-1']
  ]);
}

{
  const h = makeHarness();
  const blockEl = h.session.renderBlockElement(h.state.blocks[2], 2);
  const link = blockEl.querySelector('a[href]');
  assert.equal(link.getAttribute('href'), '?id=docs%2Fintro.md');
  assert.equal(link.textContent, 'Intro');
  assert.equal(link.tabIndex, -1);
  assert.equal(link.getAttribute('aria-disabled'), 'true');
  assert.deepEqual(h.calls.slice(-1), [['hydrateCard', 'blocks-card-preview']]);
}

{
  const h = makeHarness();
  h.state.blocks.forEach((block, index) => h.list.appendChild(h.session.renderBlockElement(block, index)));
  h.state.blocks = [h.state.blocks[1], h.state.blocks[0], h.state.blocks[2], h.state.blocks[3]];
  h.state.activeIndex = 1;
  h.calls.length = 0;
  assert.equal(h.session.replaceAdjacentBlockElements(0, 1), true);
  assert.equal(h.list.children[0].dataset.blockId, 'math-1');
  assert.equal(h.list.children[1].dataset.blockId, 'heading-1');
  assert.deepEqual(h.calls.slice(-1), [['setActive', 1]]);
}

console.log('ok - editor blocks body session boundary');
