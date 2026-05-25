import assert from 'node:assert/strict';

import { createEditorMainScrollSession } from '../assets/js/editor-main-scroll-session.js';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(name) {
    this.values.add(name);
  }

  remove(name) {
    this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeButton {
  constructor() {
    this.hidden = true;
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    if (!this.listeners.has(type)) return;
    const next = this.listeners.get(type).filter((item) => item !== handler);
    this.listeners.set(type, next);
  }

  dispatch(type) {
    (this.listeners.get(type) || []).forEach((handler) => handler({ type }));
  }
}

function createFixture({ pageYOffset = 0, documentScrollTop = 0 } = {}) {
  const calls = [];
  let scrollHandler = null;
  const button = new FakeButton();
  const runtime = {
    getElementById(id) {
      calls.push(['getElementById', id]);
      return id === 'backToTop' ? button : null;
    },
    getPageYOffset() {
      return pageYOffset;
    },
    getDocumentElement() {
      return { scrollTop: documentScrollTop };
    },
    onWindow(type, handler, options) {
      calls.push(['onWindow', type, options]);
      scrollHandler = handler;
      return () => calls.push(['detachWindow', type]);
    },
    scrollToTop(options) {
      calls.push(['scrollToTop', options]);
    }
  };
  const session = createEditorMainScrollSession({ runtime, threshold: 260 });
  return {
    session,
    button,
    calls,
    get scrollHandler() {
      return scrollHandler;
    },
    setPageYOffset(value) {
      pageYOffset = value;
    },
    setDocumentScrollTop(value) {
      documentScrollTop = value;
    }
  };
}

{
  const fixture = createFixture({ pageYOffset: 0 });
  const detach = fixture.session.bind();
  assert.equal(typeof detach, 'function');
  assert.equal(fixture.button.hidden, false);
  assert.equal(fixture.button.classList.contains('show'), false);
  assert.deepEqual(fixture.calls.slice(0, 2), [
    ['getElementById', 'backToTop'],
    ['onWindow', 'scroll', { passive: true }]
  ]);
  fixture.setPageYOffset(320);
  assert.equal(fixture.scrollHandler(), true);
  assert.equal(fixture.button.classList.contains('show'), true);
  fixture.button.dispatch('click');
  assert.deepEqual(fixture.calls.at(-1), ['scrollToTop', { smooth: true }]);
  detach();
  assert.deepEqual(fixture.calls.at(-1), ['detachWindow', 'scroll']);
  fixture.calls.length = 0;
  fixture.button.dispatch('click');
  assert.deepEqual(fixture.calls, []);
}

{
  const fixture = createFixture({ pageYOffset: 0, documentScrollTop: 261 });
  fixture.session.bind();
  assert.equal(fixture.button.classList.contains('show'), true);
  fixture.setDocumentScrollTop(12);
  assert.equal(fixture.session.syncVisibility(), false);
  assert.equal(fixture.button.classList.contains('show'), false);
}

{
  const session = createEditorMainScrollSession({
    runtime: {
      getElementById: () => null
    }
  });
  assert.equal(typeof session.bind(), 'function');
  assert.equal(session.syncVisibility(), false);
}
