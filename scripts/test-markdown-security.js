import assert from 'node:assert/strict';

class TestNode {
  constructor() {
    this.childNodes = [];
    this.parentNode = null;
    this.ownerDocument = null;
  }

  appendChild(node) {
    if (!node) return node;
    if (node instanceof TestDocumentFragment) {
      while (node.firstChild) this.appendChild(node.firstChild);
      return node;
    }
    if (node.parentNode && Array.isArray(node.parentNode.childNodes)) {
      const index = node.parentNode.childNodes.indexOf(node);
      if (index >= 0) node.parentNode.childNodes.splice(index, 1);
    }
    this.childNodes.push(node);
    node.parentNode = this;
    if (!node.ownerDocument) node.ownerDocument = this.ownerDocument;
    return node;
  }

  insertBefore(node, before) {
    if (!node) return node;
    if (!before) return this.appendChild(node);
    if (node instanceof TestDocumentFragment) {
      while (node.firstChild) this.insertBefore(node.firstChild, before);
      return node;
    }
    if (node.parentNode && Array.isArray(node.parentNode.childNodes)) {
      const oldIndex = node.parentNode.childNodes.indexOf(node);
      if (oldIndex >= 0) node.parentNode.childNodes.splice(oldIndex, 1);
    }
    const index = this.childNodes.indexOf(before);
    if (index < 0) return this.appendChild(node);
    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    if (!node.ownerDocument) node.ownerDocument = this.ownerDocument;
    return node;
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }
}

class TestElement extends TestNode {
  constructor(tagName) {
    super();
    this.tagName = String(tagName || '').toUpperCase();
    this.nodeType = 1;
    this.attributes = new Map();
    this.dataset = {};
    this.style = { setProperty() {} };
    this.eventListeners = new Map();
    this._className = '';
  }

  setAttribute(name, value) {
    const key = String(name);
    const val = String(value);
    this.attributes.set(key, val);
    if (key.toLowerCase() === 'class') this._className = val;
    if (key.toLowerCase().startsWith('data-')) {
      const prop = key
        .slice(5)
        .replace(/-([a-z])/g, (_, char) => String(char || '').toUpperCase());
      this.dataset[prop] = val;
    }
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get className() {
    return this._className || this.getAttribute('class') || '';
  }

  set className(value) {
    this.setAttribute('class', value);
  }

  get classList() {
    const el = this;
    const values = () => new Set(String(el.className || '').split(/\s+/).filter(Boolean));
    const write = (set) => {
      el.className = Array.from(set).join(' ');
    };
    return {
      contains(name) {
        return values().has(String(name));
      },
      add(...names) {
        const set = values();
        names.forEach(name => { if (name) set.add(String(name)); });
        write(set);
      },
      remove(...names) {
        const set = values();
        names.forEach(name => set.delete(String(name)));
        write(set);
      },
      toggle(name) {
        const set = values();
        const key = String(name);
        const next = !set.has(key);
        if (next) set.add(key);
        else set.delete(key);
        write(set);
        return next;
      }
    };
  }

  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }

  replaceChildren(...nodes) {
    this.childNodes = [];
    nodes.forEach(node => this.appendChild(node));
  }

  addEventListener(type, handler) {
    const key = String(type || '');
    const list = this.eventListeners.get(key) || [];
    list.push(handler);
    this.eventListeners.set(key, list);
  }

  removeEventListener(type, handler) {
    const key = String(type || '');
    const list = this.eventListeners.get(key) || [];
    this.eventListeners.set(key, list.filter(item => item !== handler));
  }

  dispatchEvent() {
    return true;
  }

  scrollIntoView() {}

  getBoundingClientRect() {
    return { top: 0, left: 0, width: 100, height: 24, bottom: 24, right: 100 };
  }

  get innerHTML() {
    return '';
  }

  set innerHTML(markup) {
    parseHtmlInto(this, markup, this.ownerDocument || documentRef);
  }

  get textContent() {
    return this.childNodes.map(child => child.textContent || '').join('');
  }

  set textContent(value) {
    this.childNodes = [new TestTextNode(String(value || ''))];
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const raw = String(selector || '').trim();
    if (!raw) return [];
    const direct = raw.startsWith(':scope > ');
    const selectors = (direct ? raw.slice(9) : raw).split(',').map(part => part.trim()).filter(Boolean);
    const nodes = direct ? this.childNodes : getDescendants(this);
    return nodes.filter(node => node && node.nodeType === 1 && selectors.some(part => matchesSelector(node, part)));
  }
}

class TestTextNode extends TestNode {
  constructor(text) {
    super();
    this.nodeType = 3;
    this.textContent = String(text || '');
  }
}

class TestDocumentFragment extends TestNode {
  constructor() {
    super();
    this.nodeType = 11;
  }
}

class TestHTMLElement extends TestElement {
  constructor() {
    super('element');
  }
}

const documentRef = {
  baseURI: 'http://127.0.0.1:8000/index.html',
  title: 'Press',
  documentElement: new TestElement('html'),
  body: new TestElement('body'),
  createDocumentFragment() {
    const fragment = new TestDocumentFragment();
    fragment.ownerDocument = this;
    return fragment;
  },
  createElement(tagName) {
    const element = new TestElement(tagName);
    element.ownerDocument = this;
    return element;
  },
  createTextNode(text) {
    const node = new TestTextNode(text);
    node.ownerDocument = this;
    return node;
  },
  querySelector(selector) {
    return this.body.querySelector(selector);
  },
  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  },
  getElementById(id) {
    return this.body.querySelector(`#${String(id || '')}`);
  }
};
documentRef.documentElement.ownerDocument = documentRef;
documentRef.body.ownerDocument = documentRef;

globalThis.window = {
  __press_content_root: 'wwwroot',
  location: { protocol: 'http:', href: 'http://127.0.0.1:8000/index.html', hash: '' },
  scrollY: 0,
  addEventListener() {},
  removeEventListener() {},
  scrollTo() {},
  setTimeout,
  clearTimeout
};
globalThis.document = documentRef;
globalThis.HTMLElement = TestHTMLElement;
globalThis.customElements = { get() { return null; }, define() {} };
globalThis.location = { origin: 'http://127.0.0.1:8000', hash: '' };
globalThis.history = { replaceState() {} };
globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);

const { mdParse } = await import('../assets/js/markdown.js?markdown-security');
const { sanitizeImageUrl, setSafeHtml } = await import('../assets/js/safe-html.js?markdown-security');
const { PressToc } = await import('../assets/js/components.js?markdown-security');
const nativeInteractions = await import('../assets/themes/native/modules/interactions.js?markdown-security');

const baseDir = 'wwwroot/post/security';

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0' };
  return String(value || '').replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][\w:-]*);/g, (match, entity) => {
    if (!entity) return match;
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      try { return String.fromCodePoint(parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)); } catch (_) { return match; }
    }
    const decoded = named[entity.toLowerCase()];
    return typeof decoded === 'string' ? decoded : match;
  });
}

function parseHtmlInto(target, markup, ownerDocument = documentRef) {
  target.childNodes = [];
  const stack = [target];
  const append = (node) => stack[stack.length - 1].appendChild(node);
  const tagRe = /<\/?([a-zA-Z][\w:-]*)\b([^>]*)>/g;
  const voidTags = new Set(['br', 'hr', 'img', 'input', 'source']);
  let last = 0;
  let tagMatch;
  while ((tagMatch = tagRe.exec(String(markup || '')))) {
    const text = String(markup || '').slice(last, tagMatch.index);
    if (text) append(ownerDocument.createTextNode(decodeEntities(text)));
    last = tagRe.lastIndex;
    const raw = tagMatch[0] || '';
    const tag = (tagMatch[1] || '').toLowerCase();
    const attrs = tagMatch[2] || '';
    if (raw.startsWith('</')) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tagName && stack[i].tagName.toLowerCase() === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    const el = ownerDocument.createElement(tag);
    const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(attrs))) {
      el.setAttribute(attrMatch[1], decodeEntities(attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? ''));
    }
    append(el);
    if (!voidTags.has(tag)) stack.push(el);
  }
  const tail = String(markup || '').slice(last);
  if (tail) append(ownerDocument.createTextNode(decodeEntities(tail)));
}

function getDescendants(root, out = []) {
  (root.childNodes || []).forEach(child => {
    if (child && child.nodeType === 1) out.push(child);
    getDescendants(child, out);
  });
  return out;
}

function matchesSelector(element, selector) {
  const part = String(selector || '').trim();
  if (!part) return false;
  if (part === '*') return true;
  if (part === 'a[href^="#"]:not(.toc-anchor)') {
    return element.tagName === 'A'
      && String(element.getAttribute('href') || '').startsWith('#')
      && !element.classList.contains('toc-anchor');
  }
  const tagAttrMatch = part.match(/^([a-z0-9]+)\[([^\]=]+)(?:="([^"]*)")?\]$/i);
  if (tagAttrMatch) {
    const [, tag, attr, value] = tagAttrMatch;
    if (element.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    if (!element.hasAttribute(attr)) return false;
    return value == null || element.getAttribute(attr) === value;
  }
  const attrMatch = part.match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
  if (attrMatch) {
    const [, attr, value] = attrMatch;
    if (!element.hasAttribute(attr)) return false;
    return value == null || element.getAttribute(attr) === value;
  }
  const tagClassMatch = part.match(/^([a-z0-9]+)\.([a-z0-9_-]+)$/i);
  if (tagClassMatch) {
    return element.tagName.toLowerCase() === tagClassMatch[1].toLowerCase()
      && element.classList.contains(tagClassMatch[2]);
  }
  if (part.startsWith('.')) return element.classList.contains(part.slice(1));
  if (part.startsWith('#')) return element.id === part.slice(1);
  return element.tagName.toLowerCase() === part.toLowerCase();
}

function collectElements(node, tagName, out = []) {
  if (!node) return out;
  if (node.tagName && node.tagName.toLowerCase() === tagName) out.push(node);
  (node.childNodes || []).forEach(child => collectElements(child, tagName, out));
  return out;
}

function collectAllElements(node, out = []) {
  if (!node) return out;
  if (node.tagName) out.push(node);
  (node.childNodes || []).forEach(child => collectAllElements(child, out));
  return out;
}

function assertNoEventHandlerAttributes(root) {
  for (const el of collectAllElements(root)) {
    for (const name of el.attributes.keys()) {
      assert.equal(/^on/i.test(name), false, `${el.tagName} should not keep ${name}`);
    }
  }
}

function unescapeHtml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      try { return String.fromCodePoint(parseInt(code, 16)); } catch (_) { return _; }
    })
    .replace(/&#([0-9]+);/g, (_, code) => {
      try { return String.fromCodePoint(parseInt(code, 10)); } catch (_) { return _; }
    });
}

function collectRawTags(html, tagName = null) {
  const tags = [];
  const tagRe = /<([a-zA-Z][\w:-]*)\b([^>]*)>/g;
  let tagMatch;
  while ((tagMatch = tagRe.exec(String(html || '')))) {
    const tag = (tagMatch[1] || '').toLowerCase();
    if (tagName && tag !== String(tagName).toLowerCase()) continue;
    const attrs = new Map();
    const attrRe = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'<>`]+)))?/g;
    let attrMatch;
    while ((attrMatch = attrRe.exec(tagMatch[2] || ''))) {
      attrs.set(
        String(attrMatch[1] || '').toLowerCase(),
        unescapeHtml(attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? '')
      );
    }
    tags.push({ tag, attrs });
  }
  return tags;
}

function assertRawMarkdownHtmlIsSafe(html) {
  for (const { tag, attrs } of collectRawTags(html)) {
    for (const [name, value] of attrs.entries()) {
      assert.equal(/^on/i.test(name), false, `${tag} should not render raw ${name}`);
      if (name === 'href' || name === 'src' || name === 'poster') {
        const normalized = String(value || '').replace(/[\u0000-\u0020\u007f]+/g, '');
        assert.equal(
          /^(?:javascript|data|vbscript|file):/i.test(normalized),
          false,
          `${tag}[${name}] should not render unsafe URL ${value}`
        );
      }
    }
  }
}

function renderMarkdown(markdown) {
  const parsed = mdParse(markdown, baseDir);
  const html = parsed.post;
  const toc = parsed.toc || '';
  const target = documentRef.createElement('div');
  const tocTarget = documentRef.createElement('div');
  setSafeHtml(target, html, baseDir, { alreadySanitized: true });
  setSafeHtml(tocTarget, toc, baseDir, { alreadySanitized: true });
  return { html, toc, target, tocTarget };
}

function createNativeRuntime() {
  const main = documentRef.createElement('main');
  main.className = 'native-mainview';
  main.setAttribute('data-theme-region', 'main');

  const toc = new PressToc();
  toc.tagName = 'PRESS-TOC';
  toc.ownerDocument = documentRef;
  toc.className = 'native-toc';
  toc.setAttribute('data-theme-region', 'toc');

  documentRef.body.replaceChildren(main, toc);

  const regions = {
    main,
    toc,
    get(name) {
      if (name === 'main') return main;
      if (name === 'toc' || name === 'tocBox') return toc;
      return null;
    }
  };
  const mounted = nativeInteractions.mount({
    document: documentRef,
    window: globalThis.window,
    regions,
    i18n: { t: (key) => ({ 'ui.top': 'Top', 'ui.backToTop': 'Back to top' }[key] || key) }
  });
  return { main, toc, effects: mounted.effects };
}

const noopUtilities = {
  renderPostNav: () => {},
  hydratePostImages: () => {},
  hydratePostVideos: () => {},
  hydrateInternalLinkCards: () => {},
  applyLazyLoadingIn: () => {},
  applyLangHints: () => {},
  setupAnchors: () => {},
  setupTOC: () => {},
  ensureAutoHeight: () => {}
};

const maliciousRenderedHtml = [
  '<h2 id="heading"><a href="java&#115;cript:alert&#40;1&#41;" onclick="alert(1)">Heading</a> <a href="http&#115;://example.com/safe">Safe</a></h2>',
  '<p><img src="javascript:alert(2)" onerror="alert(2)" alt="x"></p>',
  '<video poster="java&#115;cript:alert&#40;4&#41;"><source src="http&#115;://example.com/video.mp4"></video>',
  '<script>alert(3)</script>'
].join('');
const maliciousTocHtml = '<ul><li><a href="#heading">Heading</a><ul><li><a href="java&#10;script:alert&#40;1&#41;" onclick="alert(1)">Bad</a><img src="javascript:alert(2)" onerror="alert(2)" alt="x"></li></ul></li></ul>';

{
  assert.equal(sanitizeImageUrl('java&#10;script:alert(1)'), '');
  assert.equal(sanitizeImageUrl('data:image/svg+xml,%3Csvg%20onload=alert(1)%3E'), '');
  assert.equal(sanitizeImageUrl('data:image/png;base64,AAAA'), 'data:image/png;base64,AAAA');
  assert.equal(sanitizeImageUrl('http&#115;://example.com/pic.png'), 'https://example.com/pic.png');
}

{
  const limited = mdParse('> [x](javascript:alert(1)) **bold**', baseDir, { maxDepth: 0 }).post;
  assert.equal(collectRawTags(limited, 'a').length, 0);
  assert.equal(collectRawTags(limited, 'strong').length, 0);
  assert.match(limited, /\[x\]\(javascript:alert\(1\)\) \*\*bold\*\*/);
}

{
  const limited = mdParse(['## A', '## B', '## C'].join('\n'), baseDir, { maxLines: 2 });
  assert.match(limited.post, /A/);
  assert.match(limited.post, /B/);
  assert.doesNotMatch(limited.post, /C/);
  assert.deepEqual(collectRawTags(limited.toc, 'a').map(link => link.attrs.get('href')), ['#0', '#1']);
  assert.doesNotMatch(limited.toc, /C/);
}

{
  const limited = mdParse('abcdef', baseDir, { maxInputLength: 3 }).post;
  assert.match(limited, /abc/);
  assert.doesNotMatch(limited, /def/);
}

{
  const { html, target } = renderMarkdown([
    '<script>alert(1)</script>',
    '<!-- hidden -->',
    '<img src=x onerror=alert(1)>',
    '<span class="press-math" data-tex="x"></span>'
  ].join('\n'));

  assert.equal(collectElements(target, 'script').length, 0);
  assert.equal(collectElements(target, 'img').length, 0);
  assert.equal(collectRawTags(html, 'script').length, 0);
  assert.equal(collectRawTags(html, 'img').length, 0);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;!-- hidden --&gt;/);
  assert.equal(collectElements(target, 'span').some(span => span.classList.contains('press-math')), false);
  assertRawMarkdownHtmlIsSafe(html);
  assertNoEventHandlerAttributes(target);
}

{
  const { html, target } = renderMarkdown([
    'Inline math \\( E = mc^2 \\) and \\( \\frac{a}{b} < 1 \\).',
    'Markdown-looking TeX \\( a * b * c \\) stays intact.',
    '',
    '$$',
    '\\int_0^1 x^2 dx',
    '$$',
    '',
    '```',
    '\\( not math \\)',
    '$$',
    'not display math',
    '$$',
    '```',
    '',
    '$$',
    'unclosed'
  ].join('\n'));
  const spans = collectElements(target, 'span').filter(span => span.classList.contains('press-math-inline'));
  const divs = collectElements(target, 'div').filter(div => div.classList.contains('press-math-display'));
  const codes = collectElements(target, 'code');

  assert.equal(spans.length, 3);
  assert.equal(spans[0].getAttribute('data-tex'), 'E = mc^2');
  assert.equal(spans[1].getAttribute('data-tex'), '\\frac{a}{b} < 1');
  assert.equal(spans[2].getAttribute('data-tex'), 'a * b * c');
  assert.doesNotMatch(spans[2].getAttribute('data-tex'), /<em>/);
  assert.equal(divs.length, 1);
  assert.equal(divs[0].getAttribute('data-tex'), '\\int_0^1 x^2 dx');
  assert.equal(codes.length, 1);
  assert.match(codes[0].textContent, /\\\( not math \\\)/);
  assert.match(codes[0].textContent, /\$\$/);
  assert.match(html, /\$\$/);
  assertRawMarkdownHtmlIsSafe(html);
  assertNoEventHandlerAttributes(target);
}

{
  const unsafeLinks = [
    '[click](javascript:alert(1))',
    '[click](java&#115;cript:alert&#40;1&#41;)',
    '[click](java&#10;script:alert&#40;1&#41;)',
    '[click](data:text/html,<svg/onload=alert(1)>)',
    '[click](vbscript:msgbox(1))',
    '[click](file:///etc/passwd)'
  ];

  for (const markdown of unsafeLinks) {
    const { html, target } = renderMarkdown(markdown);
    const rawLinks = collectRawTags(html, 'a');
    const links = collectElements(target, 'a');
    assert.equal(rawLinks.length, 1);
    assert.equal(rawLinks[0].attrs.get('href'), '#', `${markdown} should be safe before DOM insertion`);
    assert.equal(links.length, 1);
    assert.equal(links[0].getAttribute('href'), '#', `${markdown} should be rewritten`);
    assertRawMarkdownHtmlIsSafe(html);
    assertNoEventHandlerAttributes(target);
  }
}

{
  const { html, target } = renderMarkdown('[safe](https://example.com/&#34;onclick=alert&#40;1&#41;)');
  const rawLinks = collectRawTags(html, 'a');
  const links = collectElements(target, 'a');

  assert.equal(rawLinks.length, 1);
  assert.equal(rawLinks[0].attrs.has('onclick'), false);
  assert.match(rawLinks[0].attrs.get('href'), /^https:\/\/example\.com\//);
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute('onclick'), null);
  assert.match(links[0].getAttribute('href'), /^https:\/\/example\.com\//);
  assertRawMarkdownHtmlIsSafe(html);
  assertNoEventHandlerAttributes(target);
}

{
  const { html, target } = renderMarkdown('![x" onerror="alert(1)](pic.png "caption" onclick="alert(1)")');
  const rawImages = collectRawTags(html, 'img');
  const images = collectElements(target, 'img');
  assert.equal(rawImages.length, 1);
  assert.equal(rawImages[0].attrs.get('src'), 'wwwroot/post/security/pic.png');
  assert.equal(rawImages[0].attrs.has('onerror'), false);
  assert.equal(rawImages[0].attrs.has('onclick'), false);
  assert.equal(images.length, 1);
  assert.equal(images[0].getAttribute('src'), 'wwwroot/post/security/pic.png');
  assert.match(images[0].getAttribute('alt'), /onerror/);
  assert.equal(images[0].getAttribute('onerror'), null);
  assert.equal(images[0].getAttribute('onclick'), null);
  assertRawMarkdownHtmlIsSafe(html);
}

{
  const { html, target } = renderMarkdown('![x](java&#10;script:payload)');
  const rawImages = collectRawTags(html, 'img');
  const images = collectElements(target, 'img');

  assert.equal(rawImages.length, 1);
  assert.equal(rawImages[0].attrs.get('src'), '#');
  assert.equal(images.length, 1);
  assert.equal(images[0].getAttribute('src'), '#');
  assertRawMarkdownHtmlIsSafe(html);
  assertNoEventHandlerAttributes(target);
}

{
  const { html, target } = renderMarkdown('![x](http&#115;://example.com/pic.png)');
  const rawImages = collectRawTags(html, 'img');
  const images = collectElements(target, 'img');

  assert.equal(rawImages.length, 1);
  assert.equal(rawImages[0].attrs.get('src'), 'https://example.com/pic.png');
  assert.equal(images.length, 1);
  assert.equal(images[0].getAttribute('src'), 'https://example.com/pic.png');
  assertRawMarkdownHtmlIsSafe(html);
  assertNoEventHandlerAttributes(target);
}

{
  const { html, target } = renderMarkdown('![[pic.png|x" onerror="alert(1)]]');
  const rawImages = collectRawTags(html, 'img');
  const images = collectElements(target, 'img');
  assert.equal(rawImages.length, 1);
  assert.equal(rawImages[0].attrs.get('src'), 'wwwroot/post/security/pic.png');
  assert.equal(rawImages[0].attrs.has('onerror'), false);
  assert.equal(images.length, 1);
  assert.equal(images[0].getAttribute('src'), 'wwwroot/post/security/pic.png');
  assert.match(images[0].getAttribute('alt'), /onerror/);
  assert.equal(images[0].getAttribute('onerror'), null);
  assertRawMarkdownHtmlIsSafe(html);
}

{
  const { html, target } = renderMarkdown('![demo](video.mp4 "poster=javascript:alert(1) | sources=javascript:alert(2),clip.webm | formats=ogg")');
  const rawVideos = collectRawTags(html, 'video');
  const rawSources = collectRawTags(html, 'source');
  const videos = collectElements(target, 'video');
  const sources = collectElements(target, 'source');

  assert.equal(rawVideos.length, 1);
  assert.equal(rawVideos[0].attrs.get('poster'), '#');
  assert.equal(rawSources.length, 4);
  assert.deepEqual(
    rawSources.map(source => source.attrs.get('src')),
    [
      'wwwroot/post/security/video.mp4',
      '#',
      'wwwroot/post/security/clip.webm',
      'wwwroot/post/security/video.ogg'
    ]
  );
  assert.equal(videos.length, 1);
  assert.equal(videos[0].getAttribute('poster'), '#');
  assert.equal(videos[0].getAttribute('onerror'), null);
  assert.equal(sources.length, 4);
  assert.deepEqual(
    sources.map(source => source.getAttribute('src')),
    [
      'wwwroot/post/security/video.mp4',
      '#',
      'wwwroot/post/security/clip.webm',
      'wwwroot/post/security/video.ogg'
    ]
  );
  assertRawMarkdownHtmlIsSafe(html);
  assertNoEventHandlerAttributes(target);
}

{
  const { html, target } = renderMarkdown([
    '> [!note] <img src=x onerror=alert(1)>',
    '> Body <script>alert(1)</script>',
    '',
    '| A | B |',
    '| --- | --- |',
    '| <img src=x onerror=alert(1)> | [x](javascript:alert(1)) |'
  ].join('\n'));

  assert.equal(collectElements(target, 'script').length, 0);
  assert.equal(collectElements(target, 'img').length, 0);
  assert.equal(collectRawTags(html, 'script').length, 0);
  assert.equal(collectRawTags(html, 'img').length, 0);
  assert.equal(collectRawTags(html, 'a')[0].attrs.get('href'), '#');
  assert.equal(collectElements(target, 'a')[0].getAttribute('href'), '#');
  assertRawMarkdownHtmlIsSafe(html);
  assertNoEventHandlerAttributes(target);
}

{
  const { html, toc, tocTarget } = renderMarkdown([
    '## [click](java&#10;script:alert&#40;1&#41;) <img src=x onerror=alert(1)>',
    '### ![x" onerror="alert(2)](javascript:alert(3))'
  ].join('\n'));
  const rawTocLinks = collectRawTags(toc, 'a');
  const rawTocImages = collectRawTags(toc, 'img');
  const tocLinks = collectElements(tocTarget, 'a');
  const tocImages = collectElements(tocTarget, 'img');

  assertRawMarkdownHtmlIsSafe(html);
  assertRawMarkdownHtmlIsSafe(toc);
  assert.equal(collectRawTags(toc, 'script').length, 0);
  assert.deepEqual(rawTocLinks.map(link => link.attrs.get('href')), ['#0', '#', '#1']);
  assert.equal(rawTocImages.length, 1);
  assert.equal(rawTocImages[0].attrs.get('src'), '#');
  assert.equal(rawTocImages[0].attrs.has('onerror'), false);
  assert.deepEqual(tocLinks.map(link => link.getAttribute('href')), ['#0', '#', '#1']);
  assert.equal(tocImages.length, 1);
  assert.equal(tocImages[0].getAttribute('src'), '#');
  assert.equal(tocImages[0].getAttribute('onerror'), null);
  assertNoEventHandlerAttributes(tocTarget);
}

{
  const { html, target } = renderMarkdown([
    '```js"onmouseover="alert(1)',
    'code',
    '```'
  ].join('\n'));
  assert.doesNotMatch(html, /onmouseover/u);
  assert.doesNotMatch(html, /language-js"/u);
  assertRawMarkdownHtmlIsSafe(html);
  assert.equal(collectElements(target, 'code').length, 1);
  assertNoEventHandlerAttributes(target);
}

{
  const { main, toc, effects } = createNativeRuntime();
  const result = effects.renderPostView({
    containers: { mainElement: main, tocElement: toc },
    markdownHtml: maliciousRenderedHtml,
    tocHtml: maliciousTocHtml,
    baseDir,
    content: { baseDir },
    postMetadata: { title: 'Unsafe' },
    fallbackTitle: 'Unsafe',
    siteConfig: {},
    postsIndex: {},
    utilities: noopUtilities
  });
  const bodyLinks = collectElements(main, 'a');
  const bodyImages = collectElements(main, 'img');
  const bodyVideos = collectElements(main, 'video');
  const bodySources = collectElements(main, 'source');
  const tocLinks = collectElements(toc, 'a');
  const tocImages = collectElements(toc, 'img');

  assert.equal(result.handled, true);
  assert.equal(collectElements(main, 'script').length, 0);
  assert.equal(bodyLinks[0].getAttribute('href'), '#');
  assert.equal(bodyLinks[0].getAttribute('onclick'), null);
  assert.equal(bodyLinks[1].getAttribute('href'), 'https://example.com/safe');
  assert.equal(bodyImages[0].getAttribute('src'), '#');
  assert.equal(bodyImages[0].getAttribute('onerror'), null);
  assert.equal(bodyVideos[0].getAttribute('poster'), '#');
  assert.equal(bodySources[0].getAttribute('src'), 'https://example.com/video.mp4');
  assert.equal(tocLinks.some(link => link.getAttribute('href') === '#heading'), true);
  assert.equal(tocLinks.some(link => link.getAttribute('href') === '#'), true);
  assert.equal(tocLinks.some(link => link.getAttribute('onclick') != null), false);
  assert.equal(tocImages[0].getAttribute('src'), '#');
  assert.equal(tocImages[0].getAttribute('onerror'), null);
  assertNoEventHandlerAttributes(main);
  assertNoEventHandlerAttributes(toc);
}

{
  const { main, effects } = createNativeRuntime();
  const result = effects.renderStaticTabView({
    containers: { mainElement: main },
    markdownHtml: maliciousRenderedHtml,
    baseDir,
    content: { baseDir },
    tab: { title: 'Tab' },
    siteConfig: {},
    utilities: noopUtilities
  });
  const links = collectElements(main, 'a');
  const images = collectElements(main, 'img');
  const videos = collectElements(main, 'video');
  const sources = collectElements(main, 'source');

  assert.equal(result.handled, true);
  assert.equal(collectElements(main, 'script').length, 0);
  assert.equal(links[0].getAttribute('href'), '#');
  assert.equal(links[0].getAttribute('onclick'), null);
  assert.equal(links[1].getAttribute('href'), 'https://example.com/safe');
  assert.equal(images[0].getAttribute('src'), '#');
  assert.equal(images[0].getAttribute('onerror'), null);
  assert.equal(videos[0].getAttribute('poster'), '#');
  assert.equal(sources[0].getAttribute('src'), 'https://example.com/video.mp4');
  assertNoEventHandlerAttributes(main);
}

{
  const target = documentRef.createElement('div');
  setSafeHtml(
    target,
    '<img src="data:image/svg+xml,%3Csvg%20onload=alert(1)%3E" alt="svg"><img src="data:image/png;base64,AAAA" alt="png">',
    baseDir,
    { alreadySanitized: true }
  );
  const images = collectElements(target, 'img');

  assert.equal(images.length, 2);
  assert.equal(images[0].getAttribute('src'), '#');
  assert.equal(images[1].getAttribute('src'), 'data:image/png;base64,AAAA');
  assertNoEventHandlerAttributes(target);
}

{
  const target = documentRef.createElement('div');
  setSafeHtml(
    target,
    '<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(2)" alt="x"><video poster="java&#115;cript:alert(3)"><source src="http&#115;://example.com/video.mp4"></video>',
    baseDir,
    { alreadySanitized: true }
  );

  const images = collectElements(target, 'img');
  const videos = collectElements(target, 'video');
  const sources = collectElements(target, 'source');
  assert.equal(collectElements(target, 'script').length, 0);
  assert.equal(images.length, 1);
  assert.equal(images[0].getAttribute('src'), '#');
  assert.equal(images[0].getAttribute('onerror'), null);
  assert.equal(videos[0].getAttribute('poster'), '#');
  assert.equal(sources[0].getAttribute('src'), 'https://example.com/video.mp4');
  assertNoEventHandlerAttributes(target);
}

console.log('ok - markdown security regression coverage');

const runTableAlignmentTest = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

runTableAlignmentTest('pipe table alignment markers render controlled text-align styles', () => {
  const aligned = mdParse([
    '| Left | Center | Right | Default |',
    '| :--- | :---: | ---: | --- |',
    '| a | b | c | d |',
    ''
  ].join('\n'), 'post/demo').post;

  assert.match(aligned, /<th style="text-align: left">/);
  assert.match(aligned, /<th style="text-align: center">/);
  assert.match(aligned, /<th style="text-align: right">/);
  assert.match(aligned, /<td style="text-align: left">/);
  assert.match(aligned, /<td style="text-align: center">/);
  assert.match(aligned, /<td style="text-align: right">/);
  assert.match(aligned, /<th><p>Default<\/p><\/th>/);
  assert.match(aligned, /<td><p>d<\/p><\/td>/);

  const unaligned = mdParse([
    '| One | Two |',
    '| --- | --- |',
    '| a | b |',
    ''
  ].join('\n'), 'post/demo').post;
  assert.doesNotMatch(unaligned, /text-align:/);
});

runTableAlignmentTest('safe html preserves only controlled table text alignment styles', () => {
  const target = document.createElement('div');
  setSafeHtml(target, [
    '<table><thead><tr>',
    '<th style="text-align: CENTER;">Center</th>',
    '<th style="color: red; text-align: right">Unsafe</th>',
    '</tr></thead><tbody><tr>',
    '<td style="text-align: left;">Left</td>',
    '<td style="position:absolute; text-align:right">Unsafe</td>',
    '</tr></tbody></table>',
    '<p style="text-align: right">Paragraph</p>'
  ].join(''), 'post/demo', { alreadySanitized: true });

  const ths = target.querySelectorAll('th');
  const tds = target.querySelectorAll('td');
  const ps = target.querySelectorAll('p');
  assert.equal(ths[0].getAttribute('style'), 'text-align: center');
  assert.equal(ths[1].getAttribute('style'), null);
  assert.equal(tds[0].getAttribute('style'), 'text-align: left');
  assert.equal(tds[1].getAttribute('style'), null);
  assert.equal(ps[0].getAttribute('style'), null);
});
