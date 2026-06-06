import assert from 'node:assert/strict';

import { createPostCommitStateApplier } from '../assets/js/composer-post-commit-state.js';

{
  let cleared = 0;
  let summaryUpdates = 0;
  const applier = createPostCommitStateApplier({
    clearContentModelMigration: () => {
      cleared += 1;
    },
    updateUnsyncedSummary: () => {
      summaryUpdates += 1;
    }
  });

  applier.apply([
    {
      kind: 'content-model-migration',
      path: 'docs/index.en.yaml',
      deleted: true
    }
  ]);

  assert.equal(cleared, 1, 'post-commit state should clear completed content model migration metadata');
  assert.equal(summaryUpdates, 1);
}

console.log('composer post-commit state tests passed');
