import assert from 'node:assert/strict';

class TestNode {
  constructor() {
    this.childNodes = [];
    this.parentNode = null;
  }

  appendChild(node) {
    if (!node) return node;
    this.childNodes.push(node);
    node.parentNode = this;
    return node;
  }
}

class TestElement extends TestNode {
  constructor(tagName) {
    super();
    this.tagName = String(tagName || '').toUpperCase();
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  replaceChildren(...nodes) {
    this.childNodes = [];
    nodes.forEach(node => this.appendChild(node));
  }
}

class TestTextNode extends TestNode {
  constructor(text) {
    super();
    this.textContent = String(text || '');
  }
}

class TestDocumentFragment extends TestNode {}

const documentRef = {
  baseURI: 'http://127.0.0.1:8000/index.html',
  createDocumentFragment() {
    return new TestDocumentFragment();
  },
  createElement(tagName) {
    return new TestElement(tagName);
  },
  createTextNode(text) {
    return new TestTextNode(text);
  }
};

globalThis.window = {
  __press_content_root: 'wwwroot',
  location: { protocol: 'http:' }
};
globalThis.document = documentRef;
globalThis.location = { origin: 'http://127.0.0.1:8000' };

const { mdParse } = await import('../assets/js/markdown.js?markdown-security');
const { setSafeHtml } = await import('../assets/js/utils.js?markdown-security');

const baseDir = 'wwwroot/post/security';

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

{
  const { html, target } = renderMarkdown([
    '<script>alert(1)</script>',
    '<!-- hidden -->',
    '<img src=x onerror=alert(1)>'
  ].join('\n'));

  assert.equal(collectElements(target, 'script').length, 0);
  assert.equal(collectElements(target, 'img').length, 0);
  assert.equal(collectRawTags(html, 'script').length, 0);
  assert.equal(collectRawTags(html, 'img').length, 0);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;!-- hidden --&gt;/);
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
  const target = documentRef.createElement('div');
  setSafeHtml(
    target,
    '<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(2)" alt="x">',
    baseDir,
    { alreadySanitized: true }
  );

  const images = collectElements(target, 'img');
  assert.equal(collectElements(target, 'script').length, 0);
  assert.equal(images.length, 1);
  assert.equal(images[0].getAttribute('src'), '#');
  assert.equal(images[0].getAttribute('onerror'), null);
  assertNoEventHandlerAttributes(target);
}

console.log('ok - markdown security regression coverage');
