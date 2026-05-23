import assert from 'node:assert/strict';

import { createEditorBlocksLayoutSession } from '../assets/js/editor-blocks-layout-session.js';

function createClassList(initial = '') {
  const set = new Set(String(initial || '').split(/\s+/).filter(Boolean));
  return {
    add(...names) {
      names.forEach(name => set.add(name));
    },
    remove(...names) {
      names.forEach(name => set.delete(name));
    },
    contains(name) {
      return set.has(name);
    }
  };
}

function createStyle() {
  return {
    removeProperty(name) {
      delete this[name];
    }
  };
}

function createHead() {
  const listeners = new Map();
  const head = {
    classList: createClassList('blocks-block-head'),
    style: createStyle(),
    offsetHeight: 40,
    offsetWidth: 160,
    offsetTop: 0,
    offsetLeft: 12,
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
      (listeners.get(type) || []).slice().forEach(handler => handler({ target: head, ...event }));
    }
  };
  return head;
}

function createBlock(id, rect) {
  const head = createHead();
  const listeners = new Map();
  const block = {
    dataset: { blockId: id },
    classList: createClassList('blocks-block'),
    style: createStyle(),
    head,
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
      (listeners.get(type) || []).slice().forEach(handler => handler({ target: block, ...event }));
    },
    getBoundingClientRect() {
      return rect;
    },
    querySelector(selector) {
      return selector === '.blocks-block-head' ? head : null;
    }
  };
  return block;
}

function createList(blocks = []) {
  return {
    blocks,
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 };
    },
    querySelectorAll(selector) {
      if (selector === '.blocks-block') return this.blocks;
      if (selector === '.blocks-block-head.is-stuck, .blocks-block-head.is-bottom-docked') {
        return this.blocks
          .map(block => block.head)
          .filter(head => head.classList.contains('is-stuck') || head.classList.contains('is-bottom-docked'));
      }
      return [];
    }
  };
}

function createRuntime(options = {}) {
  const listeners = [];
  const pane = options.pane || {
    getBoundingClientRect() {
      return { bottom: 700, height: 600 };
    }
  };
  const panel = options.panel || {
    querySelector(selector) {
      return selector === ':scope > .toolbar'
        ? { getBoundingClientRect: () => ({ bottom: 50, height: 50 }) }
        : null;
    }
  };
  return {
    listeners,
    getElementById(id) {
      if (id === 'editorContentPane') return pane;
      if (id === 'editorMarkdownPanel') return panel;
      return null;
    },
    getBody: () => options.body || null,
    getDocumentElement: () => options.documentElement || { clientWidth: 1000 },
    getScrollingElement: () => options.scrollingElement || null,
    getViewportHeight: () => 720,
    getViewportWidth: () => 1000,
    getComputedStyle: el => options.computedStyle ? options.computedStyle(el) : { overflowY: '' },
    prefersReducedMotion: () => !!options.reducedMotion,
    requestFrame(fn) {
      if (options.deferFrame) {
        options.frames.push(fn);
        return options.frames.length;
      }
      fn();
      return 1;
    },
    setTimer(fn, delay) {
      if (options.deferTimer) {
        options.timers.push({ fn, delay });
        return options.timers.length;
      }
      fn();
      return delay;
    },
    clearTimer(id) {
      options.clearedTimers?.push(id);
    },
    onWindow(type, handler, listenerOptions) {
      const item = { type, handler, listenerOptions, disposed: false };
      listeners.push(item);
      return () => {
        item.disposed = true;
      };
    }
  };
}

{
  const block = createBlock('a', { left: 100, top: 120, right: 600, bottom: 420, width: 500, height: 300 });
  const list = createList([block]);
  const runtime = createRuntime();
  const root = {
    hidden: false,
    closest(selector) {
      return selector === '#editorMarkdownPanel'
        ? { querySelector: () => ({ getBoundingClientRect: () => ({ bottom: 50, height: 50 }) }) }
        : null;
    }
  };
  const session = createEditorBlocksLayoutSession({
    runtime,
    state: { blocks: [{ id: 'a' }], activeIndex: 0, reorderAnimating: false },
    root,
    list,
    containsNode: () => true,
    blockElements: () => list.blocks
  });
  session.requestStickyBlockHeadUpdate();
  assert.equal(block.head.classList.contains('is-stuck'), true);
  assert.equal(block.head.classList.contains('is-bottom-docked'), false);
  assert.equal(block.head.style.left, '112px');
  assert.ok(Math.abs(parseFloat(block.head.style.top) - 75.2) < 0.000001);
}

{
  const block = createBlock('a', { left: 100, top: 20, right: 600, bottom: 180, width: 500, height: 160 });
  const list = createList([block]);
  const session = createEditorBlocksLayoutSession({
    runtime: createRuntime(),
    state: { blocks: [{ id: 'a' }], activeIndex: 0, reorderAnimating: false },
    root: { hidden: false, closest: () => null },
    list,
    containsNode: () => true,
    blockElements: () => list.blocks
  });
  session.requestStickyBlockHeadUpdate();
  assert.equal(block.head.classList.contains('is-bottom-docked'), true);
  assert.equal(block.head.classList.contains('is-stuck'), false);
  assert.equal(block.head.style.top, '168px');
}

{
  const scrollParent = {
    parentElement: null,
    scrollHeight: 1000,
    clientHeight: 400,
    scrollTop: 10
  };
  const root = { parentElement: scrollParent };
  const runtime = createRuntime({
    computedStyle: el => (el === scrollParent ? { overflowY: 'auto' } : { overflowY: '' })
  });
  const session = createEditorBlocksLayoutSession({
    runtime,
    root,
    list: createList(),
    state: { blocks: [], activeIndex: 0, reorderAnimating: false }
  });
  let prevented = false;
  session.forwardBlockHeadWheel({
    deltaX: 0,
    deltaY: 3,
    deltaMode: 1,
    preventDefault() {
      prevented = true;
    }
  });
  assert.equal(scrollParent.scrollTop, 58);
  assert.equal(prevented, true);
}

{
  const frames = [];
  const timers = [];
  const clearedTimers = [];
  const beforeA = createBlock('a', { left: 0, top: 0, right: 400, bottom: 100, width: 400, height: 100 });
  const beforeB = createBlock('b', { left: 0, top: 120, right: 400, bottom: 220, width: 400, height: 100 });
  const afterB = createBlock('b', { left: 0, top: 0, right: 400, bottom: 100, width: 400, height: 100 });
  const afterA = createBlock('a', { left: 0, top: 120, right: 400, bottom: 220, width: 400, height: 100 });
  const list = createList([beforeA, beforeB]);
  const state = { blocks: [{ id: 'a' }, { id: 'b' }], activeIndex: 0, reorderAnimating: false };
  const calls = [];
  const session = createEditorBlocksLayoutSession({
    runtime: createRuntime({ deferFrame: true, deferTimer: true, frames, timers, clearedTimers }),
    state,
    root: { hidden: false },
    list,
    containsNode: () => true,
    blockElements: () => list.blocks,
    moveBlockInState(index, direction) {
      calls.push(['moveBlockInState', index, direction]);
      state.blocks = [state.blocks[1], state.blocks[0]];
      return true;
    },
    replaceAdjacentBlockElements(index, targetIndex) {
      calls.push(['replaceAdjacentBlockElements', index, targetIndex]);
      list.blocks = [afterB, afterA];
      return true;
    },
    render() {
      calls.push(['render']);
    },
    emit() {
      calls.push(['emit']);
    }
  });
  session.moveBlock(0, 1);
  assert.equal(state.reorderAnimating, true);
  assert.deepEqual(calls, [
    ['moveBlockInState', 0, 1],
    ['replaceAdjacentBlockElements', 0, 1],
    ['emit']
  ]);
  assert.equal(afterB.classList.contains('is-reordering'), true);
  assert.equal(afterA.classList.contains('is-reordering'), true);
  assert.equal(afterB.style.transform, 'translate3d(0px, 120px, 0)');
  assert.equal(afterA.style.transform, 'translate3d(0px, -120px, 0)');
  assert.equal(timers[0].delay, 360);

  frames[0]();
  assert.equal(afterB.style.transform, 'translate3d(0, 0, 0)');
  assert.equal(afterA.style.transform, 'translate3d(0, 0, 0)');

  afterB.dispatch('transitionend');
  assert.equal(state.reorderAnimating, true);
  afterA.dispatch('transitionend');
  assert.equal(state.reorderAnimating, false);
  assert.equal(afterB.classList.contains('is-reordering'), false);
  assert.equal(afterA.classList.contains('is-reordering'), false);
  assert.deepEqual(clearedTimers, [1]);
}

{
  const calls = [];
  const state = { blocks: [{ id: 'a' }, { id: 'b' }], activeIndex: 0, reorderAnimating: false };
  const session = createEditorBlocksLayoutSession({
    runtime: createRuntime({ reducedMotion: true }),
    state,
    list: createList(),
    blockElements: () => [],
    moveBlockInState(index, direction) {
      calls.push(['moveBlockInState', index, direction]);
      return true;
    },
    render() {
      calls.push(['render']);
    },
    emit() {
      calls.push(['emit']);
    }
  });
  session.moveBlock(0, 1);
  assert.deepEqual(calls, [
    ['moveBlockInState', 0, 1],
    ['render'],
    ['emit']
  ]);
  assert.equal(state.reorderAnimating, false);
}

{
  const runtime = createRuntime();
  const session = createEditorBlocksLayoutSession({
    runtime,
    state: { blocks: [], activeIndex: 0, reorderAnimating: false },
    list: createList()
  });
  const dispose = session.bind();
  assert.deepEqual(runtime.listeners.map(item => [item.type, item.listenerOptions]), [
    ['scroll', true],
    ['resize', undefined]
  ]);
  dispose();
  assert.equal(runtime.listeners.every(item => item.disposed), true);
}

console.log('ok - editor blocks layout session');
