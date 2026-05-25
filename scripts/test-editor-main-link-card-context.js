import assert from 'node:assert/strict';

import { createEditorMainLinkCardContext } from '../assets/js/editor-main-link-card-context.js';

const fetchCalls = [];
const context = createEditorMainLinkCardContext({
  getCurrentLang: () => 'chs',
  normalizeLangKey: (value) => String(value || '').toLowerCase(),
  getContentRoot: () => 'wwwroot',
  fetch: async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: true,
      text: async () => `markdown:${url}`
    };
  },
  makeHref: (loc) => `/reader?id=${encodeURIComponent(loc)}`,
  translate: (key) => `t:${key}`
});

assert.equal(context.isReady(), false);
assert.deepEqual(context.getCardEntries(), []);
assert.equal(context.createHydrateOptions().allowedLocations, null);
assert.deepEqual(context.createHydrateOptions().postsByLocationTitle, {});

let notifiedEntries = null;
const detach = context.onCardEntriesChange((entries) => {
  notifiedEntries = entries;
});

context.rebuild({
  'Press Guide': {
    location: 'post/guide/main_en.md',
    versions: [
      { location: 'post/guide/main_chs.md' }
    ],
    tag: ['docs']
  },
  About: {
    location: 'tab/about/en.md'
  }
}, {
  guide: {
    en: [
      { location: 'post/guide/main_en.md', title: 'Press Guide' }
    ],
    chs: [
      { location: 'post/guide/main_chs.md', title: 'Press 指南' }
    ],
    tags: ['ignored metadata key']
  },
  about: {
    location: 'tab/about/en.md'
  }
});

assert.equal(context.isReady(), true);
assert.equal(context.getAllowedLocations().has('post/guide/main_en.md'), true);
assert.equal(context.getAllowedLocations().has('post/guide/main_chs.md'), true);
assert.equal(context.getLocationAliases().get('post/guide/main_chs.md'), 'post/guide/main_en.md');
assert.equal(context.getPostsByLocationTitle()['post/guide/main_chs.md'], 'Press Guide');
assert.equal(context.getPostsIndex()['Press Guide'].location, 'post/guide/main_en.md');

const entries = context.getCardEntries();
assert.equal(entries.length, 2);
assert.deepEqual(entries.map((entry) => entry.key), ['about', 'guide']);
assert.equal(entries[1].title, 'Press Guide');
assert.deepEqual(entries[1].aliases, ['post/guide/main_chs.md']);
assert.match(entries[1].search, /post\/guide\/main_chs\.md/);
assert.deepEqual(notifiedEntries, entries);

entries[1].aliases.push('mutated');
assert.deepEqual(context.getCardEntries()[1].aliases, ['post/guide/main_chs.md']);

const hydrateOptions = context.createHydrateOptions({ siteConfig: { title: 'Site' } });
assert.equal(hydrateOptions.allowedLocations, context.getAllowedLocations());
assert.equal(hydrateOptions.locationAliasMap, context.getLocationAliases());
assert.equal(hydrateOptions.postsByLocationTitle['tab/about/en.md'], 'About');
assert.equal(hydrateOptions.postsIndexCache.About.location, 'tab/about/en.md');
assert.deepEqual(hydrateOptions.siteConfig, { title: 'Site' });
assert.equal(hydrateOptions.translate('ui.loading'), 't:ui.loading');
assert.equal(hydrateOptions.makeHref('tab/about/en.md'), '/reader?id=tab%2Fabout%2Fen.md');
assert.equal(await hydrateOptions.fetchMarkdown('tab/about/en.md'), 'markdown:wwwroot/tab/about/en.md');
assert.deepEqual(fetchCalls.at(-1), {
  url: 'wwwroot/tab/about/en.md',
  options: { cache: 'no-store' }
});

detach();
context.rebuild({}, {});
assert.notDeepEqual(notifiedEntries, context.getCardEntries());
