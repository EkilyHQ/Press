import assert from 'node:assert/strict';

import { createComposerMarkdownAssetManager } from '../assets/js/composer-markdown-assets.js';

{
  const handlers = new Map();
  const disposed = [];
  const toasts = [];
  const previews = [];
  let unsyncedUpdates = 0;

  const manager = createComposerMarkdownAssetManager({
    t: (key, params) => (params && params.label ? `${key}:${params.label}` : key),
    emitMarkdownAssetPreview: (detail) => previews.push(detail),
    addWindowListener(type, handler) {
      handlers.set(type, handler);
      return () => disposed.push(type);
    },
    showToast: (kind, message) => toasts.push([kind, message]),
    updateUnsyncedSummary: () => { unsyncedUpdates += 1; }
  });

  assert.deepEqual(
    Array.from(handlers.keys()).sort(),
    [
      'press-editor-asset-added',
      'press-editor-asset-delete-canceled',
      'press-editor-asset-delete-requested',
      'press-editor-toast'
    ],
    'asset manager should subscribe to editor asset events through the injected window listener adapter'
  );

  handlers.get('press-editor-toast')({
    detail: { kind: 'warn', message: 'Uploaded image skipped.' }
  });
  assert.deepEqual(toasts.pop(), ['warn', 'Uploaded image skipped.']);

  handlers.get('press-editor-asset-added')({
    detail: {
      markdownPath: 'articles/demo.md',
      commitPath: 'wwwroot/articles/assets/image.png',
      relativePath: 'assets/image.png',
      base64: 'data:image/png;base64,abc',
      mime: 'image/png'
    }
  });

  assert.equal(manager.countMarkdownAssets('articles/demo.md'), 1);
  assert.equal(previews.length, 1);
  assert.equal(previews[0].markdownPath, 'articles/demo.md');
  assert.equal(previews[0].assets[0].path, 'wwwroot/articles/assets/image.png');
  assert.equal(unsyncedUpdates, 1);
  assert.equal(toasts.pop()[0], 'success');

  manager.dispose();
  assert.deepEqual(
    disposed.sort(),
    Array.from(handlers.keys()).sort(),
    'asset manager dispose should release injected window listeners'
  );
}

console.log('composer markdown asset manager tests passed');
