import assert from 'node:assert/strict';
import { createEditorBlocksLinkSession } from '../assets/js/editor-blocks-link-session.js';

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
    hidden: false,
    style: {},
    attrs,
    children,
    _rect: { left: 10, top: 10, right: 40, bottom: 30, width: 30, height: 20 },
    append(...items) {
      items.flat().forEach(item => {
        if (!item) return;
        item.parentNode = node;
        children.push(item);
      });
    },
    appendChild(item) {
      node.append(item);
      return item;
    },
    contains(target) {
      if (!target) return false;
      if (target === node) return true;
      return children.some(child => child && typeof child.contains === 'function' && child.contains(target));
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
      if (name === 'href') node.href = String(value);
      if (name === 'title') node.title = String(value);
    },
    getAttribute(name) {
      return attrs[name] || '';
    },
    removeAttribute(name) {
      delete attrs[name];
    },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter(item => item !== handler));
    },
    dispatch(type, event = {}) {
      (listeners.get(type) || []).forEach(handler => handler({ preventDefault() {}, target: node, ...event }));
    },
    matches(selector) {
      if (selector === 'a[href]') return node.tagName === 'A' && !!node.getAttribute('href');
      if (selector.startsWith('.')) return String(node.className || '').split(/\s+/).includes(selector.slice(1));
      return false;
    },
    getBoundingClientRect() {
      return node._rect;
    },
    focus() {
      node.focused = true;
    },
    select() {
      node.selected = true;
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

function makeHarness(overrides = {}) {
  const calls = [];
  const documentRef = makeDocumentRef();
  const root = makeElement('div', 'root');
  root._rect = { left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 };
  const editable = makeElement('p', 'blocks-rich-editable');
  root.appendChild(editable);
  const link = makeElement('a');
  link.textContent = 'Existing';
  link.setAttribute('href', 'https://old.example/');
  link.setAttribute('title', 'Old title');
  link._rect = { left: 24, top: 30, right: 90, bottom: 50, width: 66, height: 20 };
  editable.appendChild(link);
  let activeLink = overrides.activeLink || null;
  let linkMode = overrides.linkMode || '';
  let linkSelection = overrides.linkSelection || null;
  let activeElement = null;
  const timers = [];
  const rootListeners = [];
  const documentListeners = [];
  const windowListeners = [];
  const blocksState = {
    getActiveEditable() {
      return editable;
    },
    getLinkEditMode() {
      return linkMode;
    },
    getLinkSelection() {
      return linkSelection;
    },
    updateLinkSelection(patch) {
      linkSelection = { ...(linkSelection || {}), ...(patch || {}) };
      calls.push(['updateLinkSelection', patch]);
    },
    getActiveLink() {
      return activeLink;
    },
    getActiveLinkHoldUntil() {
      return 2000;
    },
    setActiveLink(nextLink, options = {}) {
      activeLink = nextLink;
      calls.push(['setActiveLink', nextLink && nextLink.textContent, options.holdUntil || null]);
    },
    clearActiveLink() {
      activeLink = null;
      calls.push(['clearActiveLink']);
    },
    openDomLinkEditor(nextLink) {
      activeLink = nextLink;
      linkMode = 'dom';
      linkSelection = null;
      calls.push(['openDomLinkEditor', nextLink && nextLink.textContent]);
    },
    openLinkSelectionEditor(mode, selection) {
      activeLink = null;
      linkMode = mode;
      linkSelection = selection;
      calls.push(['openLinkSelectionEditor', mode, selection.start, selection.end, selection.text]);
    },
    clearLinkEditorState() {
      activeLink = null;
      linkMode = '';
      linkSelection = null;
      calls.push(['clearLinkEditorState']);
    },
    linkEditorRefreshSuppressed() {
      return !!overrides.refreshSuppressed;
    },
    pendingInlineMark(mark) {
      return overrides.pendingMarks ? overrides.pendingMarks[mark] : '';
    },
    setPendingInlinePatch(patch) {
      calls.push(['setPendingInlinePatch', patch]);
    }
  };
  const session = createEditorBlocksLinkSession({
    documentRef,
    root,
    runtime: {
      documentRef,
      getActiveElement() {
        return activeElement;
      },
      setTimer(fn, delay) {
        timers.push([fn, delay]);
        fn();
      }
    },
    blocksState,
    selectionSession: { name: 'selection' },
    caretSession: { name: 'caret' },
    inlineDomSession: { name: 'inline-dom' },
    containsNode(container, node) {
      return !!(container && typeof container.contains === 'function' && container.contains(node));
    },
    closestElement(target, selector) {
      if (selector === 'a[href]' && target && target.matches && target.matches('a[href]')) return target;
      return null;
    },
    text(_key, fallback) {
      return fallback;
    },
    sanitizeLinkHref(value) {
      return String(value || '').trim();
    },
    sanitizeLinkTitle(value) {
      return String(value || '').trim();
    },
    selectionLinkInEditable() {
      return overrides.selectionLink || null;
    },
    getEditableSelectionOffsets() {
      return overrides.offsets || {
        collapsed: true,
        start: 3,
        end: 3,
        text: '',
        range: { getBoundingClientRect: () => ({ left: 30, top: 40, right: 30, bottom: 52, width: 0, height: 12 }) }
      };
    },
    caretRectForEditable() {
      return { left: 20, top: 20, right: 22, bottom: 40, width: 2, height: 20 };
    },
    inlineRunsFromDom() {
      calls.push(['inlineRunsFromDom']);
      return [{ text: 'Existing', link: 'https://old.example/' }];
    },
    inlineRangeText(_runs, start, end) {
      calls.push(['inlineRangeText', start, end]);
      return overrides.rangeText || 'Existing';
    },
    applyInlineLinkToRuns(runs, start, end, href, replacementText, title) {
      calls.push(['applyInlineLinkToRuns', start, end, href, replacementText, title]);
      return [{ runs, start, end, href, replacementText, title }];
    },
    renderInlineRunsInto(_editable, runs) {
      calls.push(['renderInlineRunsInto', runs[0].href || '']);
    },
    textRangeForDomNode() {
      calls.push(['textRangeForDomNode']);
      return overrides.linkRange || { start: 0, end: 8 };
    },
    linkForTextRange() {
      calls.push(['linkForTextRange']);
      return link;
    },
    placeCaretAtTextOffset(_editable, offset) {
      calls.push(['placeCaretAtTextOffset', offset]);
    },
    syncActiveEditable() {
      calls.push(['syncActiveEditable']);
    },
    updateInlineToolbarState() {
      calls.push(['updateInlineToolbarState']);
    },
    onDocument(type, handler, options) {
      documentListeners.push([type, handler, options]);
      return () => {};
    },
    onWindow(type, handler, options) {
      windowListeners.push([type, handler, options]);
      return () => {};
    },
    now: () => 1000
  });
  root.addEventListener = (type, handler, options) => {
    rootListeners.push([type, handler, options]);
  };
  root.removeEventListener = () => {};
  return {
    calls,
    documentListeners,
    editable,
    link,
    root,
    rootListeners,
    session,
    timers,
    windowListeners,
    setActiveElement(node) {
      activeElement = node;
    },
    get linkMode() {
      return linkMode;
    }
  };
}

{
  const harness = makeHarness({
    pendingMarks: { link: 'https://pending.example/', linkTitle: 'Pending title' }
  });
  harness.session.openForSelection();
  assert.equal(harness.session.element.hidden, false);
  assert.deepEqual(
    harness.calls.filter(call => call[0] === 'openLinkSelectionEditor'),
    [['openLinkSelectionEditor', 'pending', 3, 3, '']]
  );
  assert.equal(harness.session.fields.href.value, 'https://pending.example/');
  harness.session.fields.href.value = 'https://next.example/';
  harness.session.fields.href.dispatch('input');
  assert.deepEqual(
    harness.calls.filter(call => call[0] === 'setPendingInlinePatch').at(-1),
    ['setPendingInlinePatch', { code: false, link: 'https://next.example/', linkTitle: 'Pending title' }],
    'pending link input should update pending inline marks through the state controller'
  );
}

{
  const harness = makeHarness({ selectionLink: null });
  harness.session.refresh(harness.link);
  assert.equal(harness.session.element.hidden, false);
  assert.deepEqual(
    harness.calls.filter(call => call[0] === 'setActiveLink' || call[0] === 'openDomLinkEditor'),
    [
      ['setActiveLink', 'Existing', 1800],
      ['openDomLinkEditor', 'Existing']
    ],
    'explicit link refresh should keep a clicked link active and open the DOM link editor'
  );
  assert.equal(harness.session.fields.text.value, 'Existing');
  assert.equal(harness.session.fields.href.value, 'https://old.example/');
  assert.equal(harness.session.fields.title.value, 'Old title');
}

{
  const harness = makeHarness({
    selectionLink: null,
    offsets: {
      collapsed: false,
      start: 1,
      end: 9,
      text: 'Existing',
      range: { getBoundingClientRect: () => ({ left: 40, top: 50, right: 120, bottom: 70, width: 80, height: 20 }) }
    }
  });
  harness.session.openForSelection();
  harness.session.fields.text.value = 'Replacement';
  harness.session.fields.href.value = 'https://range.example/';
  harness.session.fields.title.value = 'Range title';
  harness.session.fields.href.dispatch('input');
  assert.deepEqual(
    harness.calls.filter(call => call[0] === 'applyInlineLinkToRuns').at(-1),
    ['applyInlineLinkToRuns', 1, 9, 'https://range.example/', 'Replacement', 'Range title'],
    'range link edits should apply through inline run serialization helpers'
  );
  assert.equal(
    harness.calls.some(call => call[0] === 'renderInlineRunsInto'),
    true
  );
}

{
  const harness = makeHarness({ activeLink: null, selectionLink: null });
  harness.session.refresh(harness.link);
  harness.session.fields.unlink.dispatch('click');
  assert.deepEqual(
    harness.calls.filter(call => ['applyInlineLinkToRuns', 'clearActiveLink', 'placeCaretAtTextOffset', 'clearLinkEditorState'].includes(call[0])),
    [
      ['applyInlineLinkToRuns', 0, 8, '', undefined, undefined],
      ['clearActiveLink'],
      ['placeCaretAtTextOffset', 8],
      ['clearLinkEditorState']
    ],
    'unlink should remove the active link, restore caret position, and close the session'
  );
}

{
  const harness = makeHarness();
  harness.session.bind();
  assert.deepEqual(
    harness.rootListeners.map(([type]) => type),
    ['keyup', 'mouseup', 'focusin'],
    'link session should own root refresh listeners'
  );
  assert.deepEqual(
    harness.documentListeners.map(([type, _handler, options]) => [type, options]),
    [['pointerdown', true], ['mousedown', true], ['selectionchange', undefined]],
    'link session should own capture-phase outside pointer listeners and selection refresh'
  );
  assert.deepEqual(
    harness.windowListeners.map(([type, _handler, options]) => [type, options]),
    [['resize', undefined], ['scroll', true]],
    'link session should own viewport refresh listeners'
  );
}

console.log('editor blocks link session tests passed');
