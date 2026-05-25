import assert from 'node:assert/strict';
import { createEditorBlocksCommandSession } from '../assets/js/editor-blocks-command-session.js';

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

function makeElement(tagName = 'div', className = '') {
  const listeners = new Map();
  const attrs = {};
  const children = [];
  const node = {
    nodeType: 1,
    tagName: String(tagName || 'div').toUpperCase(),
    className,
    textContent: '',
    contentEditable: '',
    spellcheck: true,
    hidden: false,
    type: '',
    value: '',
    dataset: {},
    attrs,
    children,
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
      const dispatched = {
        preventDefault() { defaultPrevented = true; },
        stopPropagation() {},
        target: node,
        ...event
      };
      const results = (listeners.get(type) || []).map(handler => handler(dispatched));
      return { defaultPrevented, results };
    },
    focus() {
      node.focused = true;
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

function matchesSimple(node, selector) {
  let source = String(selector || '').trim();
  if (!source) return false;
  const attr = source.match(/\[([^=\]]+)="([^"]*)"\]/);
  if (attr) {
    const name = attr[1];
    const value = name.startsWith('data-')
      ? node.dataset[name.slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase())]
      : node[name];
    if (String(value || node.getAttribute?.(name) || '') !== attr[2]) return false;
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

function makeHarness(options = {}) {
  const documentRef = makeDocumentRef();
  const list = documentRef.createElement('div');
  const blockEl = documentRef.createElement('section');
  blockEl.className = 'blocks-block';
  blockEl.setAttribute('data-block-id', 'blank-1');
  list.appendChild(blockEl);
  const calls = [];
  const state = {
    blocks: [{ id: 'blank-1', type: 'blank', data: {} }],
    commandMenuOpen: !!options.open,
    commandMenuInsertIndex: options.open ? 0 : null
  };
  const blocksState = {
    openCommandMenu(index) {
      calls.push(['openCommandMenu', index]);
      state.commandMenuOpen = true;
      state.commandMenuInsertIndex = index;
      return index;
    },
    closeCommandMenu() {
      calls.push(['closeCommandMenu']);
      const restore = state.commandMenuInsertIndex;
      state.commandMenuOpen = false;
      state.commandMenuInsertIndex = null;
      return restore;
    },
    beginCommandBlockInsert(insertOptions = {}) {
      calls.push(['beginCommandBlockInsert', insertOptions]);
      const index = Number.isInteger(insertOptions.index) ? insertOptions.index : state.commandMenuInsertIndex;
      state.commandMenuOpen = false;
      state.commandMenuInsertIndex = null;
      return index;
    }
  };
  const session = createEditorBlocksCommandSession({
    documentRef,
    state,
    blocksState,
    list,
    editableSession: {
      registerEditable(editable, sync) {
        calls.push(['registerEditable', editable, sync]);
      }
    },
    text(_key, fallback) {
      return fallback;
    },
    createBlockTypeIcon(type) {
      const icon = documentRef.createElement('span');
      icon.className = `icon-${type}`;
      return icon;
    },
    defaultListItems() {
      return [{ text: 'List item', checked: false, listType: 'ul' }];
    },
    normalizeEditableMarkdownText(value) {
      return String(value || '').trim();
    },
    editableText(editable) {
      return editable.textContent || editable.value || '';
    },
    closeBlockActionMenu(restore) {
      calls.push(['closeBlockActionMenu', restore]);
    },
    closeInlineMoreMenu(restore) {
      calls.push(['closeInlineMoreMenu', restore]);
    },
    placeCommandBlock(type, data, index) {
      const block = { id: `${type}-1`, type, data };
      calls.push(['placeCommandBlock', type, data, index]);
      return block;
    },
    render() {
      calls.push(['render']);
    },
    emit() {
      calls.push(['emit']);
    },
    focusBlockPrimaryEditable(block, offset) {
      calls.push(['focusBlockPrimaryEditable', block && block.id, offset]);
    },
    insertBlankBlock(index, insertOptions) {
      calls.push(['insertBlankBlock', index, insertOptions]);
    },
    removeEmptyBlockWithBackspace(event, block, index, editable, sync) {
      calls.push(['removeEmptyBlockWithBackspace', event.key, block && block.id, index, !!editable, sync]);
      return !!options.removeEmpty;
    },
    handleCrossBlockArrowNavigation(event, index, editable) {
      calls.push(['handleCrossBlockArrowNavigation', event.key, index, !!editable]);
      return !!options.crossBlock;
    },
    setActive(index, editable, sync) {
      calls.push(['setActive', index, !!editable, sync]);
    },
    updateInlineToolbarState() {
      calls.push(['updateInlineToolbarState']);
    },
    getCardPickerSession() {
      return options.cardPicker || null;
    },
    queueTask(task) {
      calls.push(['queueTask']);
      task();
    }
  });
  return { documentRef, list, blockEl, calls, state, session };
}

{
  const h = makeHarness();
  const body = h.documentRef.createElement('div');
  h.blockEl.appendChild(body);
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  assert.ok(body.classList.contains('blocks-virtual-body'));
  const editable = body.querySelector('.blocks-blank-editable');
  assert.equal(editable.contentEditable, 'true');
  assert.equal(editable.getAttribute('aria-label'), 'New block');
  assert.ok(h.calls.some(call => call[0] === 'registerEditable' && call[2] === null));
  const menu = body.querySelector('.blocks-command-menu');
  assert.equal(menu.hidden, true);
  assert.equal(menu.getAttribute('aria-hidden'), 'true');
  assert.equal(menu.querySelectorAll('.blocks-command-menu-item').length, 10);
}

{
  const h = makeHarness();
  const body = h.documentRef.createElement('div');
  h.blockEl.appendChild(body);
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  const editable = body.querySelector('.blocks-blank-editable');
  const slash = editable.dispatch('beforeinput', { inputType: 'insertText', data: '/' });
  assert.equal(slash.defaultPrevented, true);
  const openIndex = h.calls.findIndex(call => call[0] === 'closeBlockActionMenu');
  assert.deepEqual(h.calls.slice(openIndex, openIndex + 5), [
    ['closeBlockActionMenu', false],
    ['closeInlineMoreMenu', false],
    ['openCommandMenu', 0],
    ['render'],
    ['queueTask']
  ]);
  assert.ok(h.session.focusFirstCommandItem('blank-1'));
  assert.equal(body.querySelector('.blocks-command-menu-item').focused, true);
}

{
  const h = makeHarness();
  const body = h.documentRef.createElement('div');
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  const editable = body.querySelector('.blocks-blank-editable');
  const typed = editable.dispatch('beforeinput', { inputType: 'insertText', data: ' A ' });
  assert.equal(typed.defaultPrevented, true);
  assert.deepEqual(h.calls.find(call => call[0] === 'placeCommandBlock'), [
    'placeCommandBlock',
    'paragraph',
    { text: 'A' },
    0
  ]);
  assert.deepEqual(h.calls.find(call => call[0] === 'focusBlockPrimaryEditable'), [
    'focusBlockPrimaryEditable',
    'paragraph-1',
    1
  ]);
}

{
  const h = makeHarness({ open: true });
  const body = h.documentRef.createElement('div');
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  const menu = body.querySelector('.blocks-command-menu');
  assert.equal(menu.hidden, false);
  assert.equal(menu.getAttribute('aria-hidden'), 'false');
  const heading = menu.querySelectorAll('.blocks-command-menu-item')
    .find(item => item.dataset.blockCommand === 'heading');
  heading.dispatch('click');
  assert.deepEqual(h.calls.find(call => call[0] === 'placeCommandBlock'), [
    'placeCommandBlock',
    'heading',
    { level: 2, text: 'Heading' },
    0
  ]);
  assert.ok(h.calls.some(call => call[0] === 'focusBlockPrimaryEditable' && call[1] === 'heading-1'));
}

{
  const opened = [];
  const h = makeHarness({
    open: true,
    cardPicker: {
      open(index) {
        opened.push(index);
      }
    }
  });
  const body = h.documentRef.createElement('div');
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  const card = body.querySelectorAll('.blocks-command-menu-item')
    .find(item => item.dataset.blockCommand === 'card');
  card.dispatch('click');
  assert.deepEqual(opened, [0]);
}

{
  const h = makeHarness({ open: true });
  const body = h.documentRef.createElement('div');
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  const card = body.querySelectorAll('.blocks-command-menu-item')
    .find(item => item.dataset.blockCommand === 'card');
  card.dispatch('click');
  assert.deepEqual(h.calls.find(call => call[0] === 'placeCommandBlock'), [
    'placeCommandBlock',
    'card',
    { label: 'Article', location: '', title: 'card', forceCard: true },
    0
  ]);
}

{
  const h = makeHarness({ open: true });
  const body = h.documentRef.createElement('div');
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  const menu = body.querySelector('.blocks-command-menu');
  const closed = menu.dispatch('keydown', { key: 'Escape' });
  assert.equal(closed.defaultPrevented, true);
  assert.ok(h.calls.some(call => call[0] === 'closeCommandMenu'));
  assert.ok(h.calls.some(call => call[0] === 'focusBlockPrimaryEditable' && call[1] === 'blank-1'));
}

{
  const h = makeHarness();
  const body = h.documentRef.createElement('div');
  h.session.renderBlankBlock(body, h.state.blocks[0], 2);
  const editable = body.querySelector('.blocks-blank-editable');
  const enter = editable.dispatch('keydown', { key: 'Enter' });
  assert.equal(enter.defaultPrevented, true);
  assert.deepEqual(h.calls.find(call => call[0] === 'insertBlankBlock'), [
    'insertBlankBlock',
    3,
    { focus: true }
  ]);
  editable.dispatch('focus');
  assert.ok(h.calls.some(call => call[0] === 'setActive' && call[1] === 2));
  assert.ok(h.calls.some(call => call[0] === 'updateInlineToolbarState'));
}

{
  const h = makeHarness();
  const body = h.documentRef.createElement('div');
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  const editable = body.querySelector('.blocks-blank-editable');
  editable.textContent = '/';
  editable.dispatch('input');
  assert.equal(editable.textContent, '');
  assert.ok(h.calls.some(call => call[0] === 'openCommandMenu'));
}

{
  const h = makeHarness();
  const body = h.documentRef.createElement('div');
  h.session.renderBlankBlock(body, h.state.blocks[0], 0);
  const editable = body.querySelector('.blocks-blank-editable');
  const pasted = editable.dispatch('paste', {
    clipboardData: {
      getData(type) {
        return type === 'text/plain' ? 'Pasted text' : '';
      }
    }
  });
  assert.equal(pasted.defaultPrevented, true);
  assert.ok(h.calls.some(call => call[0] === 'placeCommandBlock' && call[1] === 'paragraph'));
}

assert.equal(createEditorBlocksCommandSession({ documentRef: null }), null);

console.log('ok - editor blocks command session');
