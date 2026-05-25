import assert from 'node:assert/strict';
import { createEditorBlocksCardPickerSession } from '../assets/js/editor-blocks-card-picker-session.js';

function classSet(node) {
  return new Set(String(node.className || '').split(/\s+/).filter(Boolean));
}

function makeElement(tagName = 'div', className = '') {
  const listeners = new Map();
  const attrs = {};
  const children = [];
  const node = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    className,
    type: '',
    textContent: '',
    value: '',
    hidden: false,
    dataset: {},
    attrs,
    children,
    set innerHTML(_value) {
      children.splice(0, children.length);
    },
    get innerHTML() {
      return children.map(child => child && child.textContent ? child.textContent : '').join('');
    },
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
    setAttribute(name, value) {
      attrs[name] = String(value);
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
      (listeners.get(type) || []).forEach(handler => handler({
        preventDefault() {},
        stopPropagation() {},
        target: node,
        ...event
      }));
    },
    matches(selector) {
      if (selector.startsWith('.')) return classSet(node).has(selector.slice(1));
      return node.tagName.toLowerCase() === selector.toLowerCase();
    },
    querySelector(selector) {
      const stack = [...children];
      while (stack.length) {
        const item = stack.shift();
        if (item && item.matches && item.matches(selector)) return item;
        if (item && item.children) stack.push(...item.children);
      }
      return null;
    },
    querySelectorAll(selector) {
      const out = [];
      const stack = [...children];
      while (stack.length) {
        const item = stack.shift();
        if (item && item.matches && item.matches(selector)) out.push(item);
        if (item && item.children) stack.push(...item.children);
      }
      return out;
    },
    focus() {
      node.focused = true;
    }
  };
  return node;
}

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    }
  };
}

function makeHarness(initialEntries = []) {
  const calls = [];
  const state = {
    blocks: [{ id: 'a' }, { id: 'b' }],
    cardEntries: initialEntries.slice(),
    cardPickerOpen: false,
    cardPickerInsertIndex: null
  };
  const blocksState = {
    state,
    openCardPicker(insertIndex) {
      state.cardPickerOpen = true;
      state.cardPickerInsertIndex = insertIndex;
      calls.push(['openCardPicker', insertIndex]);
    },
    closeCardPicker() {
      state.cardPickerOpen = false;
      state.cardPickerInsertIndex = null;
      calls.push(['closeCardPicker']);
    },
    setCardEntries(entries) {
      state.cardEntries = Array.isArray(entries) ? entries.slice() : [];
      calls.push(['setCardEntries', state.cardEntries.length]);
      return state.cardEntries.slice();
    },
    getCardPickerState() {
      return {
        open: state.cardPickerOpen,
        insertIndex: state.cardPickerInsertIndex,
        entries: state.cardEntries.slice(),
        blockCount: state.blocks.length
      };
    }
  };
  let session = null;
  session = createEditorBlocksCardPickerSession({
    documentRef: makeDocumentRef(),
    runtime: {
      setTimer(fn, delay) {
        calls.push(['setTimer', delay]);
        fn();
      }
    },
    blocksState,
    text(_key, fallback) {
      return fallback;
    },
    insertCardBlock(data, index) {
      calls.push(['insertCardBlock', data, index]);
    },
    requestRender() {
      calls.push(['requestRender']);
      session.render();
    }
  });
  return { calls, state, session };
}

{
  const h = makeHarness();
  h.session.render();
  assert.equal(h.session.element.hidden, true);
  assert.equal(h.session.element.getAttribute('aria-hidden'), 'true');
}

{
  const h = makeHarness([
    { title: 'Alpha', key: 'a', location: 'post/a.md', search: 'alpha post' },
    { title: 'Beta', key: 'b', location: 'post/b.md', search: 'beta post' }
  ]);
  assert.equal(h.session.open(1), true);
  assert.equal(h.session.element.hidden, false);
  const search = h.session.element.querySelector('.blocks-card-search');
  assert.ok(search.focused, 'card picker should focus search through the runtime timer');
  assert.equal(h.session.element.querySelectorAll('.blocks-card-result').length, 2);

  search.value = 'beta';
  search.dispatch('input');
  const filtered = h.session.element.querySelectorAll('.blocks-card-result');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].textContent, 'Beta');

  filtered[0].dispatch('click');
  assert.equal(h.state.cardPickerOpen, false);
  assert.deepEqual(h.calls.find(call => call[0] === 'insertCardBlock'), [
    'insertCardBlock',
    { label: 'Beta', location: 'post/b.md', title: 'card', forceCard: true },
    1
  ]);
}

{
  const h = makeHarness();
  assert.equal(h.session.open(3), false);
  assert.deepEqual(h.calls.find(call => call[0] === 'insertCardBlock'), [
    'insertCardBlock',
    { label: 'Article', location: '', title: 'card', forceCard: true },
    3
  ]);
}

{
  const h = makeHarness([{ title: 'Alpha', location: 'post/a.md' }]);
  h.session.open(0);
  h.session.setEntries([{ title: 'Gamma', location: 'post/g.md' }]);
  const result = h.session.element.querySelector('.blocks-card-result');
  assert.equal(result.textContent, 'Gamma');
  assert.ok(h.calls.some(call => call[0] === 'setCardEntries' && call[1] === 1));
}

{
  const h = makeHarness([{ title: 'Alpha', location: 'post/a.md' }]);
  h.session.open(0);
  const search = h.session.element.querySelector('.blocks-card-search');
  search.value = 'missing';
  search.dispatch('input');
  const empty = h.session.element.querySelector('.blocks-empty');
  assert.equal(empty.textContent, 'No matching articles');
}
