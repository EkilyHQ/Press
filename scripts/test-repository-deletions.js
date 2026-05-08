import assert from 'node:assert/strict';

const {
  collectManagedMarkdownReferences,
  collectRemovedManagedMarkdownReferences,
  normalizeManagedContentMarkdownPath,
  planManagedContentDeletions
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
