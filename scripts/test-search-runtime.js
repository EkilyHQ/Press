import assert from 'node:assert/strict';

let moduleSeq = 0;

function createEventRoot() {
  const listeners = [];
  return {
    addEventListener(type, handler) {
      listeners.push({ type, handler });
    },
    listenerCount(type) {
      return listeners.filter((entry) => entry.type === type).length;
    },
    dispatchPressSearch(query) {
      listeners
        .filter((entry) => entry.type === 'press:search')
        .forEach((entry) => entry.handler({ detail: { query } }));
    }
  };
}

async function loadSearchModule() {
  const pushes = [];
  const dispatched = [];
  globalThis.window = {
    location: { href: 'https://example.test/?tab=posts' },
    dispatchEvent(event) {
      dispatched.push(event);
    }
  };
  globalThis.history = {
    pushState(_state, _title, url) {
      pushes.push(String(url));
      window.location.href = String(url);
    }
  };
  globalThis.PopStateEvent = class PopStateEvent {
    constructor(type) {
      this.type = type;
    }
  };
  const mod = await import(`../assets/js/search.js?search-runtime-test=${moduleSeq++}`);
  return { mod, pushes, dispatched };
}

try {
  const { mod, pushes, dispatched } = await loadSearchModule();
  const firstRoot = createEventRoot();
  const secondRoot = createEventRoot();

  mod.bindSearchEvents(firstRoot);
  mod.bindSearchEvents(firstRoot);
  mod.bindSearchEvents(secondRoot);

  assert.equal(firstRoot.listenerCount('press:search'), 1);
  assert.equal(secondRoot.listenerCount('press:search'), 1);

  firstRoot.dispatchPressSearch('alpha');
  secondRoot.dispatchPressSearch('beta');

  assert.match(pushes[0], /[?&]tab=search\b/);
  assert.match(pushes[0], /[?&]q=alpha\b/);
  assert.match(pushes[1], /[?&]q=beta\b/);
  assert.equal(dispatched.length, 2);
  assert.equal(dispatched[0].type, 'popstate');
  console.log('ok - search event binding is scoped per root');
} finally {
  delete globalThis.window;
  delete globalThis.history;
  delete globalThis.PopStateEvent;
}
