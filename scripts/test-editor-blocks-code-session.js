import assert from 'node:assert/strict';
import { createEditorBlocksCodeSession } from '../assets/js/editor-blocks-code-session.js';

function classSet(node) {
  return new Set(String(node.className || '').split(/\s+/).filter(Boolean));
}

function syncClassName(node, set) {
  node.className = Array.from(set).join(' ');
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
    value: '',
    disabled: false,
    contentEditable: '',
    spellcheck: false,
    dataset: {},
    attrs,
    children,
    get childElementCount() {
      return children.filter(child => child && child.nodeType === 1).length;
    },
    get options() {
      return children.filter(child => child && child.tagName === 'OPTION');
    },
    classList: {
      add(name) {
        const set = classSet(node);
        set.add(name);
        syncClassName(node, set);
      },
      remove(name) {
        const set = classSet(node);
        set.delete(name);
        syncClassName(node, set);
      },
      contains(name) {
        return classSet(node).has(name);
      }
    },
    append(...items) {
      items.flat().forEach(item => {
        if (!item) return;
        const next = item.nodeType === 11 ? item.children.slice() : [item];
        next.forEach(child => {
          child.parentNode = node;
          child.parentElement = node;
          children.push(child);
        });
      });
    },
    appendChild(item) {
      node.append(item);
      return item;
    },
    replaceChildren(...items) {
      children.splice(0, children.length);
      node.append(...items);
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
      const results = (listeners.get(type) || []).map(handler => handler({
        preventDefault() { defaultPrevented = true; },
        stopPropagation() {},
        target: node,
        ...event
      }));
      return { defaultPrevented, results };
    },
    matches(selector) {
      const tagMatch = selector.match(/^[A-Za-z][A-Za-z0-9-]*/);
      if (tagMatch && node.tagName.toLowerCase() !== tagMatch[0].toLowerCase()) return false;
      const classMatches = Array.from(selector.matchAll(/\.([A-Za-z0-9_-]+)/g)).map(match => match[1]);
      return classMatches.every(cls => classSet(node).has(cls));
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
    }
  };
  return node;
}

function makeDocument() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    },
    createDocumentFragment() {
      return {
        nodeType: 11,
        children: [],
        appendChild(item) {
          if (!item) return item;
          item.parentNode = this;
          this.children.push(item);
          return item;
        }
      };
    }
  };
}

const documentRef = makeDocument();
const registered = [];
const updates = [];
const active = [];
const pointerActivations = [];
const highlightCalls = [];
let clipboardText = '';
let restoreTimer = null;
const block = {
  id: 'code-1',
  type: 'code',
  data: { lang: 'js', text: 'const answer = 42;\nconsole.log(answer);' }
};

const session = createEditorBlocksCodeSession({
  documentRef,
  runtime: {
    translate: (_key, fallback) => fallback,
    writeClipboardText: async (value) => {
      clipboardText = value;
      return true;
    },
    setTimer: (callback) => {
      restoreTimer = callback;
      return 1;
    }
  },
  editableSession: {
    registerEditable(editable, sync) {
      registered.push({ editable, sync });
    }
  },
  text: (_key, fallback) => fallback,
  selectionSession: { id: 'selection-session' },
  codeEditableText: editable => String(editable && editable.textContent != null ? editable.textContent : '').replace(/\n$/, ''),
  insertCodeEditableTextAtSelection: (editable, value) => {
    editable.textContent = `${editable.textContent || ''}${value}`;
    return editable.textContent;
  },
  removeEmptyBlockWithBackspace: () => false,
  handleCrossBlockArrowNavigation: () => false,
  updateFromControl: (targetBlock, patch, commit) => {
    updates.push({ block: targetBlock, patch, commit });
    targetBlock.data = { ...(targetBlock.data || {}), ...patch };
  },
  setActive: (index, editable, sync) => active.push({ index, editable, sync }),
  activateEditableFromPointer: (index, editable, sync) => pointerActivations.push({ index, editable, sync }),
  detectHighlightLanguage: () => 'javascript',
  createHighlightFragment: (raw, language) => {
    highlightCalls.push({ raw, language });
    const frag = documentRef.createDocumentFragment();
    const span = documentRef.createElement('span');
    span.className = 'syntax-keyword';
    span.textContent = `${language}:${raw}`;
    frag.appendChild(span);
    return frag;
  }
});

assert.ok(session, 'code session should be created when a document is available');

const language = session.createLanguageInput(block);
assert.equal(language.className, 'blocks-code-language');
assert.equal(language.value, 'javascript', 'language input should normalize supported aliases');
assert.equal(language.getAttribute('aria-label'), 'Language');
assert.ok(language.options.some(option => option.value === 'python'), 'language selector should expose Highlight.js common languages');
language.value = 'python';
language.dispatch('change');
assert.deepEqual(updates.at(-1).patch, { lang: 'python' });
assert.equal(updates.at(-1).commit, true);

const unsupported = session.createLanguageInput({ type: 'code', data: { lang: 'brainfuck' } });
const unsupportedOption = unsupported.options.find(option => option.value === 'brainfuck');
assert.ok(unsupportedOption, 'language selector should preserve unsupported legacy values');
assert.equal(unsupportedOption.disabled, true);
assert.equal(unsupportedOption.dataset.unsupported, 'true');

const body = documentRef.createElement('div');
session.renderBlock(body, block, 3);
const preview = body.querySelector('.blocks-code-preview');
const scroll = body.querySelector('.blocks-code-scroll');
const gutter = body.querySelector('.blocks-code-gutter');
const surface = body.querySelector('.blocks-code-surface');
const highlight = body.querySelector('.blocks-code-highlight');
const code = body.querySelector('code.blocks-code-editable');
const label = body.querySelector('.blocks-code-language-label');

assert.ok(preview, 'code session should render a pre frame');
assert.ok(scroll, 'code session should render a scroll wrapper');
assert.ok(surface, 'code session should render an overlay surface');
assert.ok(gutter, 'code session should render a line gutter');
assert.ok(highlight, 'code session should render a non-editable highlight mirror');
assert.ok(code, 'code session should render an editable code surface');
assert.ok(label, 'code session should render the copy language badge');
assert.equal(code.contentEditable, 'true');
assert.equal(code.spellcheck, false);
assert.equal(label.getAttribute('role'), 'button');
assert.equal(label.getAttribute('tabindex'), '0');
assert.equal(gutter.children.length, 2);
assert.equal(gutter.children[0].textContent, '1');
assert.equal(gutter.children[1].textContent, '2');
assert.equal(highlight.className, 'blocks-code-highlight language-python');
assert.equal(label.dataset.lang, 'PYTHON');
assert.equal(highlight.children[0].textContent.startsWith('python:'), true);
assert.equal(registered.length, 1);
assert.equal(registered[0].editable, code);

code.textContent = 'one\ntwo\nthree';
code.dispatch('input');
assert.deepEqual(updates.at(-1).patch, { text: 'one\ntwo\nthree' });
assert.equal(gutter.children.length, 3);
assert.deepEqual(highlightCalls.at(-1), { raw: 'one\ntwo\nthree', language: 'python' });

const enter = code.dispatch('keydown', {
  key: 'Enter',
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  isComposing: false
});
assert.equal(enter.defaultPrevented, true, 'Enter should be handled as controlled code text insertion');
assert.deepEqual(updates.at(-1).patch, { text: 'one\ntwo\nthree\n' });

code.dispatch('focus');
assert.equal(active.at(-1).index, 3);
assert.equal(active.at(-1).editable, code);
code.dispatch('pointerdown', { button: 0, isPrimary: true });
assert.equal(pointerActivations.at(-1).index, 3);
assert.equal(pointerActivations.at(-1).editable, code);

label.dispatch('mouseenter');
assert.equal(label.textContent, 'COPY');
label.dispatch('mouseleave');
assert.equal(label.textContent, 'PYTHON');
const click = label.dispatch('click');
await Promise.all(click.results);
assert.equal(clipboardText, 'one\ntwo\nthree');
assert.equal(label.textContent, 'COPIED');
assert.equal(label.classList.contains('is-copied'), true);
assert.equal(typeof restoreTimer, 'function');
restoreTimer();
assert.equal(label.textContent, 'PYTHON');
assert.equal(label.classList.contains('is-copied'), false);

let backspaceCalls = 0;
let arrowCalls = 0;
const guardedSession = createEditorBlocksCodeSession({
  documentRef,
  editableSession: { registerEditable() {} },
  codeEditableText: editable => String(editable.textContent || ''),
  removeEmptyBlockWithBackspace: () => {
    backspaceCalls += 1;
    return true;
  },
  handleCrossBlockArrowNavigation: () => {
    arrowCalls += 1;
    return true;
  },
  createHighlightFragment: (raw) => {
    const frag = documentRef.createDocumentFragment();
    const span = documentRef.createElement('span');
    span.textContent = raw;
    frag.appendChild(span);
    return frag;
  }
});
const guardedBody = documentRef.createElement('div');
guardedSession.renderBlock(guardedBody, { type: 'code', data: { text: '' } }, 0);
const guardedCode = guardedBody.querySelector('code.blocks-code-editable');
guardedCode.dispatch('keydown', { key: 'Backspace' });
assert.equal(backspaceCalls, 1, 'code session should delegate empty-backspace handling before local key handling');
assert.equal(arrowCalls, 0);

const navigationSession = createEditorBlocksCodeSession({
  documentRef,
  editableSession: { registerEditable() {} },
  codeEditableText: editable => String(editable.textContent || ''),
  removeEmptyBlockWithBackspace: () => false,
  handleCrossBlockArrowNavigation: () => {
    arrowCalls += 1;
    return true;
  },
  createHighlightFragment: (raw) => {
    const frag = documentRef.createDocumentFragment();
    const span = documentRef.createElement('span');
    span.textContent = raw;
    frag.appendChild(span);
    return frag;
  }
});
const navigationBody = documentRef.createElement('div');
navigationSession.renderBlock(navigationBody, { type: 'code', data: { text: 'value' } }, 1);
const navigationCode = navigationBody.querySelector('code.blocks-code-editable');
navigationCode.dispatch('keydown', { key: 'ArrowDown' });
assert.equal(arrowCalls, 1, 'code session should delegate cross-block arrow handling before local key handling');
