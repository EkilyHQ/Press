import assert from 'node:assert/strict';

const {
  collectLocalMarkdownAssetReferences,
  collectManagedMarkdownReferences,
  collectRemovedManagedMarkdownReferences,
  listLocalMarkdownAssetReferences,
  normalizeManagedContentMarkdownPath,
  planManagedContentDeletions,
  resolveLocalMarkdownAssetReference
} = await import('../assets/js/repository-deletions.js');

assert.deepEqual(
  normalizeManagedContentMarkdownPath('wwwroot/post/guide/en.md', 'wwwroot'),
  { contentPath: 'post/guide/en.md', commitPath: 'wwwroot/post/guide/en.md' },
  'managed content paths should normalize root-prefixed markdown files'
);

assert.equal(
  normalizeManagedContentMarkdownPath('wwwroot/../site.yaml', 'wwwroot'),
  null,
  'repository deletion paths should reject traversal instead of normalizing it'
);

assert.deepEqual(
  resolveLocalMarkdownAssetReference('post/guide/en.md', 'assets/photo.png', 'wwwroot'),
  {
    contentPath: 'post/guide/assets/photo.png',
    commitPath: 'wwwroot/post/guide/assets/photo.png',
    markdownPath: 'post/guide/en.md',
    relativePath: 'assets/photo.png',
    source: 'assets/photo.png'
  },
  'local markdown asset references should resolve under the current markdown directory'
);

assert.equal(
  resolveLocalMarkdownAssetReference('post/guide/en.md', '../shared/photo.png', 'wwwroot'),
  null,
  'asset deletion should reject cross-document relative paths'
);

assert.equal(
  resolveLocalMarkdownAssetReference('post/guide/en.md', '/assets/photo.png', 'wwwroot'),
  null,
  'asset deletion should reject root-relative site assets'
);

assert.equal(
  resolveLocalMarkdownAssetReference('post/guide/en.md', 'https://example.com/photo.png', 'wwwroot'),
  null,
  'asset deletion should reject remote URLs'
);

assert.deepEqual(
  Array.from(collectLocalMarkdownAssetReferences([
    '![Hero](assets/hero.png)',
    '![Remote](https://example.com/hero.png)',
    '<img src="assets/inline.webp">',
    '![[assets/embed.avif|Embedded image]]',
    '![Shared](../shared/assets/logo.png)'
  ].join('\n'), 'post/guide/en.md', 'wwwroot')).sort(),
  [
    'post/guide/assets/embed.avif',
    'post/guide/assets/hero.png',
    'post/guide/assets/inline.webp'
  ],
  'asset reference collector should keep local markdown, HTML, and Obsidian-style image references'
);

assert.equal(
  listLocalMarkdownAssetReferences([
    '![One](assets/shared.png)',
    '![Two](assets/shared.png)'
  ].join('\n'), 'post/guide/en.md', 'wwwroot').filter(ref => ref.contentPath === 'post/guide/assets/shared.png').length,
  2,
  'asset reference lister should preserve duplicate references for shared-resource protection'
);

const baselineIndex = {
  __order: ['press', 'archive'],
  press: {
    en: ['post/press/v1.0.0/en.md', 'post/press/v1.1.0/en.md'],
    ja: 'post/press/ja.md'
  },
  archive: {
    en: 'post/archive/en.md'
  }
};

const currentIndex = {
  __order: ['press', 'mirror'],
  press: {
    en: ['post/press/v1.0.0/en.md']
  },
  mirror: {
    en: 'post/archive/en.md'
  }
};

const baselineTabs = {
  __order: ['About', 'Archive'],
  About: {
    en: { title: 'About', location: 'tab/about/en.md' },
    ja: { title: 'About', location: 'tab/about/ja.md' }
  },
  Archive: {
    en: { title: 'Archive', location: 'tab/archive/en.md' }
  }
};

const currentTabs = {
  __order: ['About'],
  About: {
    en: { title: 'About us', location: 'tab/about/renamed.md' }
  }
};

const indexDiff = {
  hasChanges: true,
  removedKeys: ['archive'],
  keys: {
    archive: { state: 'removed', langs: {}, removedLangs: [] },
    press: {
      state: 'modified',
      removedLangs: ['ja'],
      langs: {
        en: {
          state: 'modified',
          versions: {
            removed: [{ value: 'post/press/v1.1.0/en.md', index: 1 }],
            entries: [{ value: 'post/press/v1.0.0/en.md', status: 'unchanged' }]
          }
        },
        ja: { state: 'removed' }
      }
    }
  }
};

const tabsDiff = {
  hasChanges: true,
  removedKeys: ['Archive'],
  keys: {
    About: {
      state: 'modified',
      removedLangs: ['ja'],
      langs: {
        en: { state: 'modified', titleChanged: true, locationChanged: true },
        ja: { state: 'removed' }
      }
    },
    Archive: { state: 'removed', langs: {}, removedLangs: [] }
  }
};

assert.deepEqual(
  Array.from(collectManagedMarkdownReferences({ index: currentIndex, tabs: currentTabs })).sort(),
  [
    'post/archive/en.md',
    'post/press/v1.0.0/en.md',
    'tab/about/renamed.md'
  ],
  'current reference graph should include only current article/page markdown paths'
);

assert.deepEqual(
  Array.from(collectManagedMarkdownReferences({
    index: {
      rich: {
        en: [
          { location: 'post/rich/v1.0.0/en.md', title: 'Rich', readTime: 2 },
          { location: 'post/rich/v2.0.0/en.md', title: 'Rich', readTime: 3 }
        ],
        ja: { location: 'post/rich/ja.md', title: 'Rich JA', protected: true }
      }
    },
    tabs: {}
  })).sort(),
  [
    'post/rich/ja.md',
    'post/rich/v1.0.0/en.md',
    'post/rich/v2.0.0/en.md'
  ],
  'current reference graph should read markdown paths from rich index metadata objects'
);

assert.deepEqual(
  Array.from(collectRemovedManagedMarkdownReferences({
    indexBaseline: baselineIndex,
    tabsBaseline: baselineTabs,
    indexDiff,
    tabsDiff
  })).sort(),
  [
    'post/archive/en.md',
    'post/press/ja.md',
    'post/press/v1.1.0/en.md',
    'tab/about/ja.md',
    'tab/archive/en.md'
  ],
  'removed references should expand deleted entries, deleted languages, and removed versions'
);

const plan = planManagedContentDeletions({
  index: currentIndex,
  tabs: currentTabs,
  indexBaseline: baselineIndex,
  tabsBaseline: baselineTabs,
  indexDiff,
  tabsDiff,
  contentRoot: 'wwwroot'
});

assert.deepEqual(
  plan.files.map(file => [file.path, file.deleted, file.markdownPath]),
  [
    ['wwwroot/post/press/ja.md', true, 'post/press/ja.md'],
    ['wwwroot/post/press/v1.1.0/en.md', true, 'post/press/v1.1.0/en.md'],
    ['wwwroot/tab/about/ja.md', true, 'tab/about/ja.md'],
    ['wwwroot/tab/archive/en.md', true, 'tab/archive/en.md']
  ],
  'deletion planner should stage safe repository deletions'
);

assert.deepEqual(
  plan.skipped,
  [{ path: 'post/archive/en.md', reason: 'still-referenced' }],
  'deletion planner should skip markdown files still referenced by current content'
);

assert.deepEqual(
  planManagedContentDeletions({
    index: currentIndex,
    tabs: currentTabs,
    indexBaseline: baselineIndex,
    tabsBaseline: baselineTabs,
    indexDiff,
    tabsDiff,
    currentContentRoot: 'content',
    baselineContentRoot: 'wwwroot',
    dirtyMarkdownPaths: ['wwwroot/tab/archive/en.md']
  }).blocked,
  [{ path: 'tab/archive/en.md', reason: 'dirty-draft' }],
  'deletion planner should detect dirty drafts under the baseline root when contentRoot changes'
);

assert.deepEqual(
  planManagedContentDeletions({
    index: currentIndex,
    tabs: currentTabs,
    indexBaseline: baselineIndex,
    tabsBaseline: baselineTabs,
    indexDiff,
    tabsDiff,
    currentContentRoot: 'content',
    baselineContentRoot: 'wwwroot'
  }).files.map(file => file.path),
  [
    'wwwroot/post/press/ja.md',
    'wwwroot/post/press/v1.1.0/en.md',
    'wwwroot/tab/about/ja.md',
    'wwwroot/tab/archive/en.md'
  ],
  'deletion planner should delete baseline-root files instead of retargeting deletions to a new contentRoot'
);

const blocked = planManagedContentDeletions({
  index: currentIndex,
  tabs: currentTabs,
  indexBaseline: baselineIndex,
  tabsBaseline: baselineTabs,
  indexDiff,
  tabsDiff,
  dirtyMarkdownPaths: ['post/press/v1.1.0/en.md']
});

assert.deepEqual(
  blocked.blocked,
  [{ path: 'post/press/v1.1.0/en.md', reason: 'dirty-draft' }],
  'deletion planner should block publish when a deleted markdown file has a local draft'
);

assert.deepEqual(
  planManagedContentDeletions({
    index: currentIndex,
    tabs: currentTabs,
    indexBaseline: baselineIndex,
    tabsBaseline: baselineTabs,
    indexDiff: {
      hasChanges: true,
      removedKeys: [],
      keys: {
        press: {
          state: 'modified',
          removedLangs: [],
          langs: {
            en: {
              state: 'modified',
              versions: {
                removed: [],
                entries: [{ value: 'post/press/v2.0.0/en.md', status: 'changed', prevIndex: 0 }]
              }
            }
          }
        }
      }
    },
    tabsDiff: {
      hasChanges: true,
      removedKeys: [],
      keys: {
        About: {
          state: 'modified',
          removedLangs: [],
          langs: { en: { state: 'modified', locationChanged: true } }
        }
      }
    }
  }).files,
  [],
  'location/path changes without removed tombstones should not become repository deletions'
);

console.log('ok - repository deletions');
