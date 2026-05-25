import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let moduleSeq = 0;
const cacheControlSource = readFileSync(new URL('../assets/js/cache-control.js', import.meta.url), 'utf8');

assert.doesNotMatch(
  cacheControlSource,
  /^let\s+fetchPatched\b/m,
  'cache control should not keep fetch patch state as a module-level mutable flag'
);
assert.match(
  cacheControlSource,
  /const FETCH_CACHE_POLICY_PATCHED = Symbol\('pressFetchCachePolicyPatched'\)[\s\S]*windowRef\[FETCH_CACHE_POLICY_PATCHED\] = true;[\s\S]*function ensureFetchCachePolicyPatched\(windowRef = getDefaultWindowRef\(\)\)/,
  'cache control should scope fetch patch state to the supplied window ref'
);

async function loadCacheControl({ pathname = '/' } = {}) {
  const calls = [];
  globalThis.window = {
    location: { href: `https://example.test${pathname}`, pathname },
    fetch: async (input, init) => {
      calls.push({ input, init: init ? { ...init } : init });
      return { ok: true, text: async () => '', json: async () => ({}) };
    }
  };
  globalThis.Request = class Request {
    constructor(url) {
      this.url = url;
    }
  };

  const mod = await import(`../assets/js/cache-control.js?cache-test=${moduleSeq++}`);
  return { mod, calls };
}

async function run(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  } finally {
    delete globalThis.window;
    delete globalThis.Request;
  }
}

await run('main site downgrades explicit no-store content fetches to browser default', async () => {
  const { calls } = await loadCacheControl({ pathname: '/' });

  await window.fetch('/wwwroot/index.yaml', { cache: 'no-store' });

  assert.equal(calls[0].init.cache, 'default');
});

await run('editor pages keep content fetches on no-store by default', async () => {
  const { calls } = await loadCacheControl({ pathname: '/index_editor.html' });

  await window.fetch('/wwwroot/post/demo.md', { cache: 'default' });

  assert.equal(calls[0].init.cache, 'no-store');
});

await run('site cachePolicy.content can force no-cache on main site content', async () => {
  const { mod, calls } = await loadCacheControl({ pathname: '/' });

  mod.configureFetchCachePolicy({ cachePolicy: { content: 'no-cache' } });
  await window.fetch('/wwwroot/tabs.yml', { cache: 'no-store' });

  assert.equal(calls[0].init.cache, 'no-cache');
});

await run('invalid site cache policy values fall back to defaults', async () => {
  const { mod, calls } = await loadCacheControl({ pathname: '/' });

  mod.configureFetchCachePolicy({ cachePolicy: { content: 'reload', editorContent: 'force-cache' } });
  await window.fetch('/wwwroot/post/demo.md', { cache: 'no-store' });

  assert.equal(calls[0].init.cache, 'default');
});

await run('non-content resources keep their existing cache behavior', async () => {
  const { calls } = await loadCacheControl({ pathname: '/' });

  await window.fetch('/assets/main.js', { cache: 'no-cache' });
  await window.fetch('/assets/i18n/languages.json', { cache: 'no-store' });
  await window.fetch('/assets/hero.jpeg', { cache: 'no-store' });

  assert.equal(calls[0].init.cache, 'default');
  assert.equal(calls[1].init.cache, 'no-store');
  assert.equal(calls[2].init.cache, 'no-store');
});

await run('fetch patch marker is scoped to each window ref', async () => {
  const { mod } = await loadCacheControl({ pathname: '/' });
  const secondCalls = [];
  const secondWindow = {
    location: { href: 'https://example.test/preview.html', pathname: '/preview.html' },
    fetch: async (input, init) => {
      secondCalls.push({ input, init: init ? { ...init } : init });
      return { ok: true, text: async () => '', json: async () => ({}) };
    }
  };

  mod.ensureFetchCachePolicyPatched(secondWindow);
  const patchedFetch = secondWindow.fetch;
  mod.ensureFetchCachePolicyPatched(secondWindow);

  assert.equal(secondWindow.fetch, patchedFetch);
  await secondWindow.fetch('/wwwroot/post/demo.md', { cache: 'no-store' });
  assert.equal(secondCalls.length, 1);
  assert.equal(secondCalls[0].init.cache, 'default');
});
