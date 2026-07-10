import assert from 'node:assert/strict';
import { PUBLIC_CONTENT_SECURITY_POLICY } from '../assets/js/content-security-policy.mjs';

globalThis.document = {
  title: 'Press',
  documentElement: { lang: 'en' }
};
globalThis.window = {
  location: {
    href: 'https://example.test/editor/',
    origin: 'https://example.test',
    pathname: '/editor/',
    search: '',
    protocol: 'https:'
  }
};

const { createSeoStagingProvider } = await import('../assets/js/composer-seo-staging.js');

const fetchCalls = [];
const logCalls = [];

const provider = createSeoStagingProvider({
  getStateSlice(kind) {
    if (kind === 'site') {
      return {
        siteURL: 'https://example.test/docs',
        siteTitle: 'Example',
        siteDescription: 'Docs',
        contentRoot: 'wwwroot'
      };
    }
    if (kind === 'index') {
      return {
        __order: ['post'],
        post: { en: 'posts/post.md' }
      };
    }
    if (kind === 'tabs') {
      return {
        __order: ['home'],
        home: { en: { title: 'Home', location: 'index.md' } }
      };
    }
    return {};
  },
  getContentRootSafe: () => 'wwwroot',
  cloneSiteState: (state) => ({ ...(state || {}) }),
  fetchImpl: async (path) => {
    fetchCalls.push(path);
    return { ok: false, text: async () => '' };
  },
  getLocationOrigin: () => 'https://example.test',
  getDocumentLang: () => 'ja',
  consoleRef: { error: (...args) => logCalls.push(args) }
});

const files = await provider.getCommitFiles();
const indexFile = files.find((file) => file.path === 'index.html');
const robotsFile = files.find((file) => file.path === 'robots.txt');

assert.ok(indexFile, 'SEO staging should include generated index.html when remote is missing');
assert.match(indexFile.content, /<html lang="ja">/, 'SEO staging should use the injected document language fallback');
assert.ok(
  indexFile.content.includes(`<meta http-equiv="Content-Security-Policy" content="${PUBLIC_CONTENT_SECURITY_POLICY}">`),
  'SEO staging fallback should preserve the materialized public CSP contract'
);
assert.ok(
  indexFile.content.includes(
    `<meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <meta http-equiv="Content-Security-Policy" content="${PUBLIC_CONTENT_SECURITY_POLICY}">`
  ),
  'SEO staging fallback should keep the materialized CSP immediately after viewport'
);
assert.ok(robotsFile, 'SEO staging should include generated robots.txt when remote is missing');
assert.match(
  robotsFile.content,
  /Sitemap: https:\/\/example\.test\/docs\/sitemap\.xml/,
  'robots.txt should use the configured site URL'
);
assert.deepEqual(fetchCalls.sort(), ['index.html', 'robots.txt', 'sitemap.xml']);
assert.deepEqual(logCalls, []);

console.log('composer SEO staging tests passed');
