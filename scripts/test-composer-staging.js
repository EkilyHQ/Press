import assert from 'node:assert/strict';

import {
  createStagingRegistry,
  normalizeStagingWarning
} from '../assets/js/composer-staging.js';

assert.deepEqual(
  normalizeStagingWarning('asset reference missing'),
  {
    providerId: 'unknown',
    code: 'staging-warning',
    message: 'asset reference missing'
  },
  'string staging warnings should be normalized into safe structured diagnostics'
);

assert.deepEqual(
  normalizeStagingWarning(new Error('Theme cache skipped?access_token=secret-a&client_secret=secret-b#refresh_token=secret-c'), { id: 'themes' }),
  {
    providerId: 'themes',
    code: 'Error',
    message: 'Theme cache skipped?access_token=[redacted]&client_secret=[redacted]#refresh_token=[redacted]'
  },
  'staging warning normalization should redact common URL credential parameters'
);

{
  const registry = createStagingRegistry();
  registry.registerStagingProvider({
    id: 'content',
    required: true,
    getCommitFiles: async () => [{ path: 'wwwroot/post/a.md', content: 'A' }]
  });
  registry.registerStagingProvider({
    id: 'themes',
    getCommitFiles: async () => ({
      files: [{ path: 'assets/themes/packs.json', content: '{}' }],
      warnings: [{ code: 'theme-cache', message: 'Theme catalog unavailable' }]
    })
  });
  registry.registerStagingProvider({
    id: 'system-updates',
    getCommitFiles: async () => {
      throw new Error('System update staging skipped?grant=secret-value');
    }
  });

  const payload = await registry.getCommitFiles();
  assert.deepEqual(
    payload.files.map(file => ({ path: file.path, providerId: file.providerId })),
    [
      { path: 'wwwroot/post/a.md', providerId: 'content' },
      { path: 'assets/themes/packs.json', providerId: 'themes' }
    ],
    'staging registry should continue collecting files from successful providers'
  );
  assert.deepEqual(payload.warnings, [
    {
      providerId: 'themes',
      code: 'theme-cache',
      message: 'Theme catalog unavailable'
    },
    {
      providerId: 'system-updates',
      code: 'Error',
      message: 'System update staging skipped?grant=[redacted]'
    }
  ]);
}

{
  const registry = createStagingRegistry();
  registry.registerStagingProvider({
    id: 'content',
    required: true,
    getCommitFiles: async () => {
      throw new Error('content failed');
    }
  });
  await assert.rejects(
    () => registry.getCommitFiles(),
    /content failed/,
    'required staging provider failures should still block publish'
  );
}

console.log('ok - composer staging');
