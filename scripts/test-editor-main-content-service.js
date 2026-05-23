import assert from 'node:assert/strict';

globalThis.document = { title: 'Press' };
const { createEditorMainContentService } = await import('../assets/js/editor-main-content-service.js');

function createFixture() {
  const calls = [];
  const fetches = [];
  let siteConfigChangeHandler = null;
  let linkReady = true;
  const runtime = {
    setContentRoot(value) {
      calls.push(['setContentRoot', value]);
    },
    setEditorBaseDir(dir, fallback) {
      calls.push(['setEditorBaseDir', dir, fallback]);
      return dir || fallback;
    },
    scrollToTop(options) {
      calls.push(['scrollToTop', options]);
    },
    onSiteConfigChange(handler) {
      siteConfigChangeHandler = handler;
      calls.push(['onSiteConfigChange']);
      return () => calls.push(['detachSiteConfigChange']);
    }
  };
  const previewSession = {
    handleSiteConfigChange() {
      calls.push(['preview.handleSiteConfigChange']);
    }
  };
  const documentSession = {
    refreshPreview() {
      calls.push(['document.refreshPreview']);
    },
    setValue(value) {
      calls.push(['document.setValue', value]);
    }
  };
  const workspaceSession = {
    setView(value) {
      calls.push(['workspace.setView', value]);
    }
  };
  const linkCardContext = {
    rebuild(posts, rawIndex) {
      calls.push(['link.rebuild', posts, rawIndex]);
    },
    isReady() {
      return linkReady;
    }
  };
  const service = createEditorMainContentService({
    runtime,
    getContentRoot: () => 'wwwroot',
    fetch: async (url, options) => {
      fetches.push([url, options]);
      return url === '/missing.md'
        ? { ok: false, status: 404, text: async () => '' }
        : { ok: true, status: 200, text: async () => 'markdown body' };
    },
    configureFetchCachePolicy: (config, options) => calls.push(['configureFetchCachePolicy', config, options]),
    fetchMergedSiteConfig: async () => ({ site: 'config' }),
    fetchConfigWithYamlFallback: async (paths) => ({ paths }),
    loadContentJsonWithRaw: async (root, kind) => ({ root, kind }),
    getPreviewSession: () => previewSession,
    getDocumentSession: () => documentSession,
    getWorkspaceSession: () => workspaceSession,
    linkCardContext,
    setCurrentFileLabel: (label) => calls.push(['setCurrentFileLabel', label]),
    warn: (...args) => calls.push(['warn', args]),
    alert: (message) => calls.push(['alert', message])
  });
  return {
    service,
    calls,
    fetches,
    get siteConfigChangeHandler() {
      return siteConfigChangeHandler;
    },
    setLinkReady(value) {
      linkReady = value;
    }
  };
}

{
  const fixture = createFixture();
  assert.deepEqual(fixture.service.getSiteConfig(), {});
  const detach = fixture.service.bind();
  assert.equal(typeof detach, 'function');
  assert.equal(typeof fixture.siteConfigChangeHandler, 'function');
  fixture.siteConfigChangeHandler({ detail: { siteConfig: { title: 'Runtime' } } });
  assert.deepEqual(fixture.service.getSiteConfig(), { title: 'Runtime' });
  assert.deepEqual(fixture.calls.slice(0, 3), [
    ['onSiteConfigChange'],
    ['configureFetchCachePolicy', { title: 'Runtime' }, { context: 'editor' }],
    ['preview.handleSiteConfigChange']
  ]);
  detach();
  assert.deepEqual(fixture.calls.at(-1), ['detachSiteConfigChange']);
}

{
  const fixture = createFixture();
  assert.deepEqual(await fixture.service.loadSiteConfig(), { site: 'config' });
  assert.deepEqual(await fixture.service.loadIndexData('content'), { root: 'content', kind: 'index' });
  assert.deepEqual(await fixture.service.loadTabsConfig('content'), {
    paths: ['content/tabs.yaml', 'content/tabs.yml']
  });
}

{
  const fixture = createFixture();
  fixture.service.handleSiteConfigLoaded({
    siteConfig: { title: 'Loaded' },
    contentRoot: 'content'
  });
  assert.deepEqual(fixture.service.getSiteConfig(), { title: 'Loaded' });
  assert.deepEqual(fixture.calls, [
    ['configureFetchCachePolicy', { title: 'Loaded' }, { context: 'editor' }],
    ['preview.handleSiteConfigChange'],
    ['setContentRoot', 'content'],
    ['setEditorBaseDir', 'content/', 'content/']
  ]);
}

{
  const fixture = createFixture();
  fixture.service.handleIndexLoaded({ posts: ['post'], rawIndex: { raw: true } });
  assert.deepEqual(fixture.calls, [
    ['link.rebuild', ['post'], { raw: true }],
    ['document.refreshPreview']
  ]);
  fixture.calls.length = 0;
  fixture.setLinkReady(false);
  fixture.service.handleIndexLoaded({ posts: [], rawIndex: {} });
  assert.deepEqual(fixture.calls, [
    ['link.rebuild', [], {}]
  ]);
}

{
  const fixture = createFixture();
  const text = await fixture.service.openMarkdown({
    relPath: 'post/main/v1.0.0/main_en.md',
    url: '/main.md',
    contentRoot: 'wwwroot'
  });
  assert.equal(text, 'markdown body');
  assert.deepEqual(fixture.fetches, [['/main.md', { cache: 'no-store' }]]);
  assert.deepEqual(fixture.calls, [
    ['setEditorBaseDir', 'wwwroot/post/main/v1.0.0/', 'wwwroot/'],
    ['document.setValue', 'markdown body'],
    ['setCurrentFileLabel', 'post/main/v1.0.0/main_en.md'],
    ['workspace.setView', 'edit'],
    ['scrollToTop', { smooth: true }]
  ]);
}

{
  const fixture = createFixture();
  await assert.rejects(
    () => fixture.service.openMarkdown({ relPath: 'missing.md', url: '/missing.md', contentRoot: 'wwwroot' }),
    /HTTP 404/
  );
}

{
  const fixture = createFixture();
  assert.equal(fixture.service.setBaseDir(''), 'wwwroot/');
  assert.deepEqual(fixture.calls.at(-1), ['setEditorBaseDir', '', 'wwwroot/']);
  fixture.service.warn('a', 'b');
  fixture.service.alert('message');
  assert.deepEqual(fixture.calls.slice(-2), [
    ['warn', ['a', 'b']],
    ['alert', 'message']
  ]);
}
