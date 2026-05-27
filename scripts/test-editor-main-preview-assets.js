import assert from 'node:assert/strict';

import { createEditorMainPreviewAssets } from '../assets/js/editor-main-preview-assets.js';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.children = [];
    this.attributes = new Map();
  }

  appendChild(child) {
    if (!child) return child;
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value ?? ''));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  querySelectorAll(selector) {
    const wantedTag = String(selector || '').toLowerCase();
    const found = [];
    const visit = (node) => {
      if (!node) return;
      if (wantedTag && node.tagName === wantedTag) found.push(node);
      (node.children || []).forEach(visit);
    };
    this.children.forEach(visit);
    return found;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
  }

  setElement(id, element) {
    this.elements.set(id, element);
    return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  querySelector(selector) {
    if (String(selector || '').startsWith('#')) {
      return this.getElementById(String(selector).slice(1));
    }
    return null;
  }
}

{
  const assets = createEditorMainPreviewAssets({
    getContentRoot: () => 'wwwroot'
  });

  assert.equal(assets.normalizePath('wwwroot/docs/../posts/demo.md'), 'posts/demo.md');
  assert.equal(assets.normalizePath('./wwwroot/posts/./demo.md'), 'posts/demo.md');
  assets.setCurrentFileInfo({ path: 'wwwroot/posts/demo.md' });
  assert.equal(assets.getCurrentPath(), 'posts/demo.md');
}

{
  const documentRef = new FakeDocument();
  const blocksWrap = documentRef.setElement('blocks-wrap', new FakeElement('div'));
  const picture = new FakeElement('picture');
  const source = new FakeElement('source');
  source.setAttribute('srcset', 'wwwroot/posts/assets/hero.png 640w, untouched.png 1280w');
  picture.appendChild(source);
  const img = new FakeElement('img');
  img.setAttribute('src', 'https://press.test/wwwroot/posts/assets/hero.png');
  img.setAttribute('srcset', 'posts/assets/hero.png 1x, /wwwroot/posts/assets/hero.png 2x');
  img.setAttribute('data-src', './wwwroot/posts/assets/hero.png');
  picture.appendChild(img);
  blocksWrap.appendChild(picture);
  const video = new FakeElement('video');
  video.setAttribute('poster', 'posts/assets/hero.png');
  blocksWrap.appendChild(video);
  let currentPreviewCount = 0;
  const assets = createEditorMainPreviewAssets({
    documentRef,
    getContentRoot: () => 'wwwroot',
    getLocationHref: () => 'https://press.test/index_editor.html',
    onCurrentAssetPreview: () => { currentPreviewCount += 1; }
  });

  assets.setCurrentFileInfo({ path: 'posts/demo.md' });
  assets.handleAssetPreviewEvent({
    detail: {
      markdownPath: 'posts/demo.md',
      assets: [
        {
          path: 'posts/assets/hero.png',
          base64: 'QUJD',
          mime: 'image/jpeg'
        }
      ]
    }
  });

  const expectedUrl = 'data:image/jpeg;base64,QUJD';
  assert.equal(currentPreviewCount, 1);
  assert.equal(img.getAttribute('src'), expectedUrl);
  assert.equal(img.getAttribute('data-src'), expectedUrl);
  assert.equal(img.getAttribute('srcset'), `${expectedUrl} 1x, ${expectedUrl} 2x`);
  assert.equal(source.getAttribute('srcset'), `${expectedUrl} 640w, untouched.png 1280w`);
  assert.equal(video.getAttribute('poster'), expectedUrl);
  assert.deepEqual(
    assets.collectAssetOverrides('posts/demo.md').sort((a, b) => a.key.localeCompare(b.key)),
    [
      { key: 'posts/assets/hero.png', url: expectedUrl, mime: 'image/jpeg' },
      { key: 'wwwroot/posts/assets/hero.png', url: expectedUrl, mime: 'image/jpeg' }
    ]
  );
}

{
  const documentRef = new FakeDocument();
  const blocksWrap = documentRef.setElement('blocks-wrap', new FakeElement('div'));
  const img = new FakeElement('img');
  img.setAttribute('src', 'posts/assets/hero.png');
  blocksWrap.appendChild(img);
  let currentPreviewCount = 0;
  const assets = createEditorMainPreviewAssets({
    documentRef,
    getContentRoot: () => 'wwwroot',
    onCurrentAssetPreview: () => { currentPreviewCount += 1; }
  });

  assets.setCurrentFileInfo({ path: 'posts/current.md' });
  assets.handleAssetPreviewEvent({
    detail: {
      markdownPath: 'posts/other.md',
      assets: [{ path: 'posts/assets/hero.png', base64: 'QUJD', mime: 'image/png' }]
    }
  });

  assert.equal(currentPreviewCount, 0);
  assert.equal(img.getAttribute('src'), 'posts/assets/hero.png');
}

{
  const assets = createEditorMainPreviewAssets({
    getContentRoot: () => 'wwwroot'
  });

  assets.updateBucket('posts/demo.md', [
    { path: 'posts/assets/unsafe.svg', base64: 'PHN2Zz4=', mime: 'text/html' }
  ]);

  assert.deepEqual(
    assets.collectAssetOverrides('posts/demo.md').filter((item) => item.key === 'posts/assets/unsafe.svg'),
    [{ key: 'posts/assets/unsafe.svg', url: 'data:image/png;base64,PHN2Zz4=', mime: 'image/png' }]
  );
}
