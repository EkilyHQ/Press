import assert from 'node:assert/strict';
import { createEditorBlocksImageSession } from '../assets/js/editor-blocks-image-session.js';

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
    type: '',
    title: '',
    placeholder: '',
    alt: '',
    src: '',
    complete: false,
    naturalWidth: 1,
    disabled: false,
    contentEditable: '',
    spellcheck: false,
    dataset: {},
    attrs,
    children,
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
      },
      toggle(name, force) {
        const set = classSet(node);
        const enabled = force == null ? !set.has(name) : !!force;
        if (enabled) set.add(name);
        else set.delete(name);
        syncClassName(node, set);
        return enabled;
      }
    },
    append(...items) {
      items.flat().forEach(item => {
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
      if (name === 'src') return node.src || attrs[name] || '';
      return attrs[name] || '';
    },
    removeAttribute(name) {
      delete attrs[name];
      if (name === 'src') node.src = '';
    },
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatch(type, event = {}) {
      let defaultPrevented = false;
      (listeners.get(type) || []).forEach(handler => handler({
        preventDefault() { defaultPrevented = true; },
        stopPropagation() {},
        target: node,
        ...event
      }));
      return { defaultPrevented };
    },
    matches(selector) {
      const classMatch = selector.match(/^\.([A-Za-z0-9_-]+)/);
      if (classMatch && !classSet(node).has(classMatch[1])) return false;
      if (!classMatch && selector.startsWith('.')) return false;
      return !/^[A-Za-z]/.test(selector) || node.tagName.toLowerCase() === selector.toLowerCase();
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

function makeDocumentRef() {
  return {
    createElement(tagName) {
      return makeElement(tagName);
    }
  };
}

function makeHarness({ canDelete = true } = {}) {
  const calls = [];
  const documentRef = makeDocumentRef();
  const block = {
    id: 'image-1',
    type: 'image',
    data: { src: 'media/hero.png', alt: 'Hero', title: 'Original title' }
  };
  const blocks = [block];
  const blockEl = makeElement('section', 'blocks-block blocks-block-image');
  blockEl.dataset.blockId = block.id;
  const blocksState = {
    state: { blocks },
    resolveBlockTarget(target, predicate) {
      let index = Number.isInteger(target) ? target : 0;
      const expectedBlockId = target && typeof target === 'object' && typeof target.blockId === 'string'
        ? target.blockId
        : '';
      if (target && typeof target === 'object' && Number.isInteger(target.index)) index = target.index;
      if (!Number.isInteger(index) || index < 0 || index >= blocks.length) {
        if (!expectedBlockId) return null;
        index = blocks.findIndex(item => item && item.id === expectedBlockId);
      }
      const candidate = blocks[index];
      if (expectedBlockId && (!candidate || candidate.id !== expectedBlockId)) return null;
      if (!candidate || !predicate(candidate)) return null;
      return { block: candidate, index };
    }
  };
  const session = createEditorBlocksImageSession({
    documentRef,
    blocksState,
    editableSession: {
      registerEditable(editable, sync) {
        editable._sync = sync;
        calls.push(['registerEditable', editable.className]);
      }
    },
    blockElements() {
      return [blockEl];
    },
    text(_key, fallback) {
      return fallback;
    },
    selectionSession: { name: 'selection' },
    insertPlainTextIntoEditable(editable, value) {
      editable.textContent = value;
      calls.push(['insertPlainText', value]);
      return true;
    },
    removeEmptyBlockWithBackspace(event) {
      calls.push(['backspace', event.key || '']);
      return false;
    },
    handleCrossBlockArrowNavigation(event) {
      calls.push(['arrow', event.key || '']);
      return false;
    },
    updateInlineToolbarState() {
      calls.push(['toolbar']);
    },
    updateFromControl(targetBlock, patch, renderAfter = false) {
      targetBlock.data = { ...targetBlock.data, ...patch };
      calls.push(['update', patch, renderAfter]);
    },
    insertBlock(type, data, index) {
      const next = { id: `image-${blocks.length + 1}`, type, data };
      blocks.splice(index, 0, next);
      calls.push(['insertBlock', type, data, index]);
      return next;
    },
    deleteBlockAt(index) {
      blocks.splice(index, 1);
      calls.push(['deleteBlockAt', index]);
    },
    setActive(index, editable) {
      calls.push(['setActive', index, editable && editable.className]);
    },
    resolveAssetSrc(src) {
      calls.push(['resolveAssetSrc', src]);
      return src ? `/resolved/${src}` : '';
    },
    hydrateImages(node) {
      calls.push(['hydrateImages', node.className]);
    },
    requestImageUpload(detail) {
      calls.push(['requestImageUpload', detail]);
    },
    canDeleteImageResource(src, detail) {
      calls.push(['canDeleteImageResource', src, detail]);
      return canDelete;
    },
    requestImageDelete(detail) {
      calls.push(['requestImageDelete', detail]);
    }
  });
  return { block, blockEl, blocks, calls, documentRef, session };
}

const harness = makeHarness();
const { block, blockEl, blocks, calls, session } = harness;
const body = makeElement('div', 'blocks-block-body');
session.renderBlock(body, block, 0);
blockEl.appendChild(body);

const figure = body.querySelector('.blocks-image-figure');
const img = body.querySelector('.blocks-image-preview');
const placeholder = body.querySelector('.blocks-image-placeholder');
const caption = body.querySelector('.blocks-image-caption');

assert.ok(figure, 'image session should render a figure');
assert.ok(img, 'image session should render an img preview');
assert.ok(placeholder, 'image session should render an editor placeholder');
assert.ok(caption, 'image session should render an editable caption');
assert.equal(img.alt, 'Hero');
assert.equal(img.src, '/resolved/media/hero.png');
assert.equal(caption.contentEditable, 'true');
assert.equal(caption.dataset.placeholder, 'Alt text');
assert.ok(!figure.classList.contains('is-image-placeholder'));
assert.deepEqual(calls[0], ['resolveAssetSrc', 'media/hero.png']);
assert.ok(calls.some(call => call[0] === 'registerEditable' && call[1] === 'blocks-image-caption'));
assert.ok(calls.some(call => call[0] === 'hydrateImages' && call[1] === 'blocks-image-figure'));

caption.textContent = 'Updated hero';
caption.dispatch('input');
assert.equal(block.data.alt, 'Updated hero');
assert.equal(img.alt, 'Updated hero');

caption.textContent = '';
caption.dispatch('input');
assert.ok(caption.classList.contains('is-empty'), 'empty caption should expose placeholder styling');

const paste = caption.dispatch('paste', {
  clipboardData: { getData: () => 'Line 1\nLine 2' }
});
assert.ok(paste.defaultPrevented);
assert.equal(block.data.alt, 'Line 1 Line 2');
assert.equal(img.alt, 'Line 1 Line 2');
assert.ok(calls.some(call => call[0] === 'insertPlainText' && call[1] === 'Line 1 Line 2'));

const enter = caption.dispatch('keydown', { key: 'Enter', isComposing: false });
assert.ok(enter.defaultPrevented, 'caption Enter should stay within the image block');
caption.dispatch('keydown', { key: 'ArrowDown' });
assert.ok(calls.some(call => call[0] === 'arrow' && call[1] === 'ArrowDown'));

caption.dispatch('focus');
assert.ok(calls.some(call => call[0] === 'setActive' && call[1] === 0 && call[2] === 'blocks-image-caption'));
assert.ok(calls.some(call => call[0] === 'toolbar'));

const controls = session.createMetadataControls(block, 0);
const title = controls.querySelector('.blocks-image-title');
const replace = controls.querySelector('.blocks-image-replace');
const deleteResource = controls.querySelector('.blocks-image-delete-resource');
assert.ok(title);
assert.ok(replace);
assert.ok(deleteResource);
assert.equal(title.value, 'Original title');
assert.equal(deleteResource.disabled, false);
title.value = 'Edited title';
title.dispatch('input');
assert.equal(block.data.title, 'Edited title');
replace.dispatch('click');
assert.ok(calls.some(call => call[0] === 'requestImageUpload' && call[1].replaceIndex === 0 && call[1].replaceBlockId === 'image-1'));
deleteResource.dispatch('click');
assert.ok(calls.some(call => call[0] === 'requestImageDelete' && call[1].src === 'media/hero.png'));

const disabledControls = makeHarness({ canDelete: false }).session.createMetadataControls(block, 0);
assert.equal(disabledControls.querySelector('.blocks-image-delete-resource').disabled, true);

const inserted = session.insertImageBlock('media/new.png', 'New image', 1);
assert.equal(inserted.index, 1);
assert.equal(blocks[1].type, 'image');
assert.deepEqual(blocks[1].data, { src: 'media/new.png', alt: 'New image', title: '' });

const replaced = session.replaceImageBlock('media/replaced.png', { index: 0, blockId: 'image-1' });
assert.deepEqual(replaced, { index: 0 });
assert.equal(block.data.src, 'media/replaced.png');
assert.equal(session.getImageBlockSource({ index: 0, blockId: 'image-1' }), 'media/replaced.png');
assert.equal(session.replaceImageBlock('media/wrong.png', { index: 1, blockId: 'image-1' }), null);

const deleted = session.deleteImageBlock({ index: 0, blockId: 'image-1' });
assert.deepEqual(deleted, { index: 0, src: 'media/replaced.png' });
assert.equal(blocks.some(item => item.id === 'image-1'), false);

const emptyHarness = makeHarness();
emptyHarness.block.data.src = '';
const emptyBody = makeElement('div');
emptyHarness.session.renderBlock(emptyBody, emptyHarness.block, 0);
assert.ok(emptyBody.querySelector('.blocks-image-figure').classList.contains('is-image-placeholder'));
assert.equal(emptyBody.querySelector('.blocks-image-preview').src, '');

console.log('ok - editor blocks image session owns image block DOM, controls, and API target handling');
