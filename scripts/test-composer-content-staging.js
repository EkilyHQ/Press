import assert from 'node:assert/strict';

import { createContentCommitStagingProvider } from '../assets/js/composer-content-staging.js';

{
  const provider = createContentCommitStagingProvider({
    getStateSlice(kind) {
      if (kind === 'site') return { contentRoot: 'docs' };
      if (kind === 'index') {
        return {
          __order: ['Guide'],
          Guide: {
            en: 'posts/guide.md'
          }
        };
      }
      if (kind === 'tabs') {
        return {
          __order: ['Docs'],
          Docs: {
            en: {
              title: 'Docs',
              location: 'docs/index.md'
            }
          }
        };
      }
      return {};
    },
    getRemoteBaseline: () => ({
      site: { contentRoot: 'docs' },
      index: { __order: [] },
      tabs: { __order: [] }
    }),
    getComposerDiffCache: () => ({
      index: { hasChanges: true },
      tabs: { hasChanges: true }
    }),
    collectCurrentRepositoryMarkdownAssetReferences: async () => ({ refs: new Set(), failures: [] }),
    getContentModelMigrationFiles: () => [
      {
        kind: 'content-model-migration',
        label: 'index.en.yaml',
        path: 'docs/index.en.yaml',
        deleted: true,
        state: 'deleted'
      },
      {
        kind: 'content-model-migration',
        label: 'tabs.en.yaml',
        path: 'docs/tabs.en.yaml',
        deleted: true,
        state: 'deleted'
      }
    ],
    toIndexYaml: () => 'Guide:\n  en: posts/guide.md\n',
    toTabsYaml: () => 'Docs:\n  en:\n    title: Docs\n    location: docs/index.md\n',
    enrichIndexStateForPublish: async state => state
  });

  const files = await provider.getCommitFiles({ cleanupUnusedAssets: false });
  const byPath = new Map(files.map(file => [file.path, file]));
  assert.deepEqual(
    Array.from(byPath.keys()).sort(),
    [
      'docs/index.en.yaml',
      'docs/index.yaml',
      'docs/tabs.en.yaml',
      'docs/tabs.yaml'
    ],
    'content staging should publish unified YAML and delete legacy sidecars in the same commit'
  );
  assert.equal(byPath.get('docs/index.en.yaml').deleted, true);
  assert.equal(byPath.get('docs/tabs.en.yaml').deleted, true);
}

console.log('composer content staging tests passed');
