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
  }

  appendChild(child) {
    if (child.parentNode) child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
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
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  getElementById(id) {
    return this.head.findById(id);
  }
}

function createWindow() {
  const store = new Map();
  return {
    location: { origin: 'https://ekilyhq.github.io' },
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: key => { store.delete(key); }
    },
    addEventListener() {},
    open() {}
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
  await Promise.resolve();
  assert.equal(section && section.id, 'press-annotate-comments');
  assert.equal(container.children.includes(section), true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'GET');
}

console.log('ok - annotate runtime');
