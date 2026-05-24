import assert from 'node:assert/strict';

import { createComposerPathTools } from '../assets/js/composer-path-tools.js';

{
  const tools = createComposerPathTools({
    getContentRoot: () => 'content',
    preferredLangOrder: ['en', 'ja']
  });

  assert.equal(tools.getContentRootSafe(), 'content');
  assert.equal(tools.computeBaseDirForPath('post/entry/v1.0.0/main_en.md'), 'content/post/entry/v1.0.0/');
  assert.equal(tools.buildDefaultEntryPath('index', 'hello', 'ja'), 'post/hello/v1.0.0/main_ja.md');
  assert.equal(tools.buildDefaultEntryPath('tabs', 'about', 'en'), 'tab/about/main_en.md');
}

{
  const tools = createComposerPathTools({
    windowRef: { __press_content_root: 'ambient-content' }
  });

  assert.equal(
    tools.getContentRootSafe(),
    'wwwroot',
    'path tools should not read content-root globals from a window fallback'
  );
  assert.equal(
    tools.computeBaseDirForPath('post/entry/v1.0.0/main_en.md'),
    'wwwroot/post/entry/v1.0.0/'
  );
}
