import assert from 'node:assert/strict';
import {
  buildAnnotateCommentPayload,
  buildAnnotateCommentsUrl,
  isAnnotateEnabled,
  mountAnnotateComments,
  normalizeGrantToken,
  normalizeAnnotateConfig,
  resolveAnnotateArticleContext
} from '../assets/js/annotate.js';

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.eventListeners = {};
    this.textContent = '';
    this.className = '';
    this.id = '';
    this.value = '';
    this.style = {};
  }

  appendChild(child) {
    if (child.parentNode) child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this.children.forEach(child => { child.parentNode = null; });
    this.children = [];
    children.forEach(child => this.appendChild(child));
  }

  insertBefore(child, before) {
    if (child.parentNode) child.remove();
    child.parentNode = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  addEventListener(type, handler) {
    this.eventListeners[type] = handler;
  }

  click() {
    if (this.ownerDocument && Array.isArray(this.ownerDocument.clickedLinks)) {
      this.ownerDocument.clickedLinks.push({
        href: this.href || '',
        target: this.target || '',
        rel: this.rel || '',
        referrerPolicy: this.referrerPolicy || ''
      });
    }
  }

  querySelector(selector) {
    if (!selector || selector[0] !== '#') return null;
    const wanted = selector.slice(1);
    return this.findById(wanted);
  }

  findById(id) {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findById ? child.findById(id) : null;
      if (found) return found;
    }
    return null;
  }
}

class FakeDocument {
  constructor() {
    this.head = new FakeElement('head', this);
    this.body = new FakeElement('body', this);
    this.clickedLinks = [];
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.head.findById(id);
  }
}

const defaultAnnotateHref = 'https://ekilyhq.github.io/demo/?id=post%2Fdoc%2Fv2.1.0%2Fdoc_chs.md';
const defaultGrantStorageKey = `press_annotate_grant_v2:EkilyHQ/Press:${defaultAnnotateHref}`;

async function flushMicrotasks(times = 5) {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

function createWindow(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  const opened = [];
  const listeners = new Map();
  return {
    location: {
      origin: 'https://ekilyhq.github.io',
      href: defaultAnnotateHref,
      pathname: '/demo/',
      search: '?id=post%2Fdoc%2Fv2.1.0%2Fdoc_chs.md'
    },
    opened,
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: key => { store.delete(key); }
    },
    addEventListener(type, handler) {
      const bucket = listeners.get(type) || new Set();
      bucket.add(handler);
      listeners.set(type, bucket);
    },
    removeEventListener(type, handler) {
      const bucket = listeners.get(type);
      if (bucket) bucket.delete(handler);
    },
    dispatchEvent(event) {
      const bucket = listeners.get(event && event.type);
      if (!bucket) return;
      [...bucket].forEach(handler => handler(event));
    },
    listenerCount(type) {
      const bucket = listeners.get(type);
      return bucket ? bucket.size : 0;
    },
    open(url = '', target = '', features = '') {
      const popup = { location: { href: String(url || '') } };
      opened.push({ url, target, features, popup });
      return popup;
    }
  };
}

const siteConfig = {
  repo: { owner: 'EkilyHQ', name: 'Press' },
  annotate: {
    enabled: true,
    connectBaseUrl: 'https://connect.example.com/',
    discussionCategory: 'General'
  }
};

const config = normalizeAnnotateConfig(siteConfig);
assert.equal(config.enabled, true);
assert.equal(config.connectBaseUrl, 'https://connect.example.com');
assert.equal(config.repository.owner, 'EkilyHQ');
assert.equal(isAnnotateEnabled(siteConfig), true);
assert.equal(isAnnotateEnabled({ ...siteConfig, annotate: { enabled: false } }), false);
assert.equal(normalizeGrantToken(' grant-token '), 'grant-token');
assert.equal(normalizeGrantToken({ token: ' object-grant-token ', expiresAt: 123 }), 'object-grant-token');
assert.equal(normalizeGrantToken({ expiresAt: 123 }), '');

const context = resolveAnnotateArticleContext({
  rawIndex: {
    pressDocs: {
      en: ['post/doc/v2.1.0/doc_en.md'],
      chs: ['post/doc/v2.1.0/doc_chs.md']
    }
  },
  postId: 'post/doc/v2.1.0/doc_chs.md',
  postMetadata: { versionLabel: '2.1.0' },
  lang: 'chs'
});
assert.deepEqual(context, {
  articleKey: 'pressDocs',
  lang: 'chs',
  version: '2.1.0',
  location: 'post/doc/v2.1.0/doc_chs.md'
});

const inferred = resolveAnnotateArticleContext({
  rawIndex: {},
  postId: 'post/main/v1.0.0/main_en.md',
  postMetadata: {},
  lang: 'en'
});
assert.equal(inferred.articleKey, 'post/main/v1.0.0/main_en.md');
assert.equal(inferred.version, 'v1.0.0');

const payload = buildAnnotateCommentPayload({
  context,
  body: '  hello  ',
  replyToId: '  DC_kwDOExample  '
});
assert.deepEqual(payload, {
  articleKey: 'pressDocs',
  context: {
    lang: 'chs',
    version: '2.1.0',
    location: 'post/doc/v2.1.0/doc_chs.md'
  },
  body: 'hello',
  replyToId: 'DC_kwDOExample'
});
assert.doesNotMatch(JSON.stringify(payload), /press-annotate|metadata|<!--/i, 'client payload should not forge server metadata comments');

const url = buildAnnotateCommentsUrl(config, context);
assert.match(url, /^https:\/\/connect\.example\.com\/api\/annotate\/comments\?/);
assert.match(url, /owner=EkilyHQ/);
assert.match(url, /repo=Press/);
assert.match(url, /articleKey=pressDocs/);

{
  const document = new FakeDocument();
  const window = createWindow();
  const container = document.createElement('main');
  const section = mountAnnotateComments({
    container,
    document,
    window,
    siteConfig: { ...siteConfig, annotate: { enabled: false } },
    context,
    fetchImpl: async () => ({ ok: true, json: async () => ({ comments: [] }) })
  });
  assert.equal(section, null);
  assert.equal(container.children.length, 0);
}

{
  const document = new FakeDocument();
  const window = createWindow();
  const container = document.createElement('main');
  const requests = [];
  const section = mountAnnotateComments({
    container,
    document,
    window,
    siteConfig,
    context,
    fetchImpl: async (requestUrl, init = {}) => {
      requests.push({ url: requestUrl, init });
      return { ok: true, json: async () => ({ comments: [] }) };
    }
  });
  await flushMicrotasks();
  assert.equal(section && section.id, 'press-annotate-comments');
  assert.equal(container.children.includes(section), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.referrerPolicy, 'unsafe-url');
  assert.equal(Object.prototype.hasOwnProperty.call(requests[0].init.headers, 'authorization'), false);
}

{
  const document = new FakeDocument();
  const window = createWindow({
    [defaultGrantStorageKey]: JSON.stringify({ grant: 'stored-grant' })
  });
  const container = document.createElement('main');
  const requests = [];
  const section = mountAnnotateComments({
    container,
    document,
    window,
    siteConfig,
    context,
    fetchImpl: async (requestUrl, init = {}) => {
      requests.push({ url: requestUrl, init });
      return { ok: true, json: async () => ({ comments: [] }) };
    }
  });
  await flushMicrotasks();
  assert.equal(section && section.id, 'press-annotate-comments');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.referrerPolicy, 'unsafe-url');
  assert.equal(requests[0].init.headers.authorization, 'Bearer stored-grant');

  const form = section.children.find(child => child.className === 'press-annotate__form');
  const textarea = form.children[0];
  textarea.value = 'Comment body';
  await form.eventListeners.submit({ preventDefault() {} });
  assert.equal(requests.length, 3);
  assert.equal(requests[1].init.method, 'POST');
  assert.equal(requests[1].init.referrerPolicy, 'unsafe-url');
  assert.equal(requests[1].init.headers.authorization, 'Bearer stored-grant');
}

{
  const document = new FakeDocument();
  const window = createWindow({
    [defaultGrantStorageKey]: JSON.stringify({ grant: 'expired-grant' })
  });
  const container = document.createElement('main');
  const requests = [];
  const section = mountAnnotateComments({
    container,
    document,
    window,
    siteConfig,
    context,
    fetchImpl: async (requestUrl, init = {}) => {
      requests.push({ url: requestUrl, init });
      return requests.length === 1
        ? { ok: false, status: 401, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ comments: [] }) };
    }
  });
  await flushMicrotasks();
  assert.equal(section && section.id, 'press-annotate-comments');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.headers.authorization, 'Bearer expired-grant');
  assert.equal(Object.prototype.hasOwnProperty.call(requests[1].init.headers, 'authorization'), false);
  assert.equal(window.localStorage.getItem(defaultGrantStorageKey), null);
}

{
  const document = new FakeDocument();
  const window = createWindow({
    [defaultGrantStorageKey]: JSON.stringify({ grant: 'wrong-source-grant' })
  });
  const container = document.createElement('main');
  const requests = [];
  const section = mountAnnotateComments({
    container,
    document,
    window,
    siteConfig,
    context,
    fetchImpl: async (requestUrl, init = {}) => {
      requests.push({ url: requestUrl, init });
      return requests.length === 1
        ? { ok: false, status: 403, json: async () => ({ error: { code: 'source_mismatch' } }) }
        : { ok: true, status: 200, json: async () => ({ comments: [] }) };
    }
  });
  await flushMicrotasks();
  assert.equal(section && section.id, 'press-annotate-comments');
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init.headers.authorization, 'Bearer wrong-source-grant');
  assert.equal(Object.prototype.hasOwnProperty.call(requests[1].init.headers, 'authorization'), false);
  assert.equal(window.localStorage.getItem(defaultGrantStorageKey), null);
}

{
  const document = new FakeDocument();
  const window = createWindow({
    [defaultGrantStorageKey]: JSON.stringify({ grant: 'wrong-source-grant' })
  });
  const container = document.createElement('main');
  const requests = [];
  const section = mountAnnotateComments({
    container,
    document,
    window,
    siteConfig,
    context,
    fetchImpl: async (requestUrl, init = {}) => {
      requests.push({ url: requestUrl, init });
      return requests.length === 1
        ? { ok: true, status: 200, json: async () => ({ comments: [] }) }
        : { ok: false, status: 403, json: async () => ({ error: { code: 'source_mismatch' } }) };
    }
  });
  await flushMicrotasks();
  const form = section.children.find(child => child.className === 'press-annotate__form');
  const textarea = form.children[0];
  textarea.value = 'Comment body';
  await form.eventListeners.submit({ preventDefault() {} });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].init.method, 'POST');
  assert.equal(window.localStorage.getItem(defaultGrantStorageKey), null);
}

{
  const document = new FakeDocument();
  const window = createWindow();
  const container = document.createElement('main');
  const section = mountAnnotateComments({
    container,
    document,
    window,
    siteConfig,
    context,
    fetchImpl: async () => ({ ok: true, json: async () => ({ comments: [] }) })
  });
  await flushMicrotasks();
  const loginButton = section.children[0].children[1].children[0];
  loginButton.eventListeners.click();
  assert.equal(window.opened.length, 1);
  assert.equal(window.opened[0].url, '');
  assert.equal(window.opened[0].target, 'press-annotate-login');
  assert.equal(document.clickedLinks.length, 1);
  assert.match(document.clickedLinks[0].href, /^https:\/\/connect\.example\.com\/github\/annotate\/start\?/);
  assert.equal(document.clickedLinks[0].target, 'press-annotate-login');
  assert.equal(document.clickedLinks[0].referrerPolicy, 'unsafe-url');
}

{
  const document = new FakeDocument();
  const window = createWindow();
  const container = document.createElement('main');
  mountAnnotateComments({
    container,
    document,
    window,
    siteConfig,
    context,
    fetchImpl: async () => ({ ok: true, json: async () => ({ comments: [] }) })
  });
  await flushMicrotasks();
  assert.equal(window.listenerCount('message'), 1);

  const firstSourceKey = defaultGrantStorageKey;
  const secondHref = 'https://ekilyhq.github.io/demo/?id=post%2Fsecurity%2Fscope.md';
  const secondSourceKey = `press_annotate_grant_v2:EkilyHQ/Press:${secondHref}`;
  container.replaceChildren();
  window.location.href = secondHref;
  window.location.search = '?id=post%2Fsecurity%2Fscope.md';
  mountAnnotateComments({
    container,
    document,
    window,
    siteConfig,
    context: { ...context, articleKey: 'securityScope', location: 'post/security/scope.md' },
    fetchImpl: async () => ({ ok: true, json: async () => ({ comments: [] }) })
  });
  await flushMicrotasks();
  assert.equal(window.listenerCount('message'), 1);
  window.dispatchEvent({
    type: 'message',
    origin: 'https://connect.example.com',
    data: {
      source: 'ekily-connect',
      type: 'press-annotate-grant',
      ok: true,
      grant: 'grant-for-current-page'
    }
  });
  assert.equal(window.localStorage.getItem(firstSourceKey), null);
  assert.match(window.localStorage.getItem(secondSourceKey), /grant-for-current-page/);
}

console.log('ok - annotate runtime');
