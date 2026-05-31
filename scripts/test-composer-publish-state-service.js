import assert from 'node:assert/strict';

globalThis.document = {
  title: 'Press',
  documentElement: {
    lang: 'en',
    getAttribute(name) {
      return name === 'lang' ? 'en' : '';
    }
  }
};
globalThis.window = {
  location: {
    origin: 'https://example.test',
    search: '',
    protocol: 'https:'
  }
};

const { createComposerPublishStateService } = await import('../assets/js/composer-publish-state-service.js');

const calls = [];
const registeredProviders = [];
const statusMessages = [];
const fetchContent = async () => ({ ok: false, text: async () => '' });
const consoleRef = { error: (...args) => calls.push(['console:error', args.length]) };

const registry = {
  registerStagingProvider(provider) {
    registeredProviders.push(provider);
  },
  async getCommitFiles(context = {}) {
    calls.push(['registry.getCommitFiles', context.showSeoStatus, typeof context.setStatus]);
    return {
      files: [
        { kind: 'index', path: 'index.yaml' },
        { kind: 'seo', path: 'sitemap.xml' }
      ],
      warnings: [
        'asset reference missing',
        {
          providerId: 'themes',
          code: 'theme-cache',
          message: 'theme cache skipped?token=secret-value',
          path: '/assets/themes/arcus/theme.json'
        }
      ]
    };
  },
  getSummaryEntries(context = {}) {
    calls.push(['registry.getSummaryEntries', context.mode || '']);
    return [{ kind: 'themes', label: 'Theme pack update' }];
  },
  clearCommittedFiles(files = []) {
    calls.push(['registry.clearCommittedFiles', files.length]);
  }
};

const received = {};
const service = createComposerPublishStateService({
  createStagingRegistry: () => registry,
  createIndexPublishMetadataEnricher(options = {}) {
    received.indexOptions = options;
    return {
      enrichIndexStateForPublish(state = {}) {
        calls.push(['index.enrich']);
        return { ...state, enriched: true };
      }
    };
  },
  createContentCommitStagingProvider(options = {}) {
    received.contentOptions = options;
    return {
      async getCommitFiles(context = {}) {
        calls.push(['content.getCommitFiles', context.cleanupUnusedAssets]);
        const enriched = options.enrichIndexStateForPublish({ title: 'Draft' });
        return [{ kind: 'index', content: enriched.enriched ? 'ok' : 'missing' }];
      }
    };
  },
  createSeoStagingProvider(options = {}) {
    received.seoOptions = options;
    return {
      async getCommitFiles(context = {}) {
        calls.push(['seo.getCommitFiles', context.showSeoStatus]);
        return [{ kind: 'seo', path: 'sitemap.xml' }];
      }
    };
  },
  createPostCommitStateApplier(options = {}) {
    received.postCommitOptions = options;
    return {
      apply(files = []) {
        calls.push(['postCommit.apply', files.length]);
        return 'applied';
      }
    };
  },
  safeString(value) {
    return String(value == null ? '' : value);
  },
  getStateSlice(kind) {
    if (kind === 'site') return { contentRoot: 'docs\\articles///' };
    return {};
  },
  getContentRootSafe: () => 'wwwroot',
  fetchContent,
  getLocationOrigin: () => 'https://example.test',
  getDocumentLang: () => 'ja',
  consoleRef,
  registerExternalStagingProviders(externalRegistry) {
    assert.equal(externalRegistry, registry);
    externalRegistry.registerStagingProvider({
      id: 'themes',
      getCommitFiles: async () => [{ kind: 'themes' }]
    });
  }
});

assert.deepEqual(
  Object.keys(service),
  [
    'gatherCommitPayload',
    'getTrackedPublishContentRoot',
    'getStagingSummaryEntries',
    'applyLocalPostCommitState'
  ],
  'publish state service should expose a narrow app-service API'
);

assert.deepEqual(
  registeredProviders.map((provider) => provider.id),
  ['content', 'themes', 'seo'],
  'publish state service should own content, external, and SEO staging order'
);
assert.equal(registeredProviders[0].required, true, 'content staging should remain required');
assert.equal(typeof received.contentOptions.enrichIndexStateForPublish, 'function');
assert.equal(received.indexOptions.fetchImpl, fetchContent);
assert.equal(received.contentOptions.fetchImpl, fetchContent);
assert.equal(received.contentOptions.consoleRef, consoleRef);
assert.equal(received.postCommitOptions.stagingRegistry, registry);
assert.equal(received.seoOptions.getContentRootSafe(), 'wwwroot');
assert.equal(typeof received.seoOptions.fetchImpl, 'function');
assert.equal(received.seoOptions.getLocationOrigin(), 'https://example.test');
assert.equal(received.seoOptions.getDocumentLang(), 'ja');

const contentProviderFiles = await registeredProviders[0].getCommitFiles({ cleanupUnusedAssets: false });
assert.equal(contentProviderFiles[0].content, 'ok');

const seoProviderFiles = await registeredProviders[2].getCommitFiles({
  showSeoStatus: true,
  setStatus(message) {
    statusMessages.push(message);
  }
});
assert.deepEqual(seoProviderFiles, [{ kind: 'seo', path: 'sitemap.xml' }]);
assert.deepEqual(statusMessages, ['Generating SEO files...']);

const payload = await service.gatherCommitPayload({
  showSeoStatus: true,
  setStatus(message) {
    statusMessages.push(message);
  }
});
assert.equal(payload.files.length, 2);
assert.deepEqual(payload.seoFiles, [{ kind: 'seo', path: 'sitemap.xml' }]);
assert.deepEqual(payload.warnings, [
  {
    providerId: 'unknown',
    code: 'staging-warning',
    message: 'asset reference missing'
  },
  {
    providerId: 'themes',
    code: 'theme-cache',
    message: 'theme cache skipped?token=[redacted]',
    path: 'assets/themes/arcus/theme.json'
  }
]);
assert.ok(
  calls.some((call) => call[0] === 'registry.getCommitFiles' && call[1] === true && call[2] === 'function'),
  'gatherCommitPayload should delegate to the staging registry with status context'
);

assert.equal(
  service.getTrackedPublishContentRoot(),
  'docs/articles',
  'publish content root should be normalized by the service boundary'
);
assert.deepEqual(
  service.getStagingSummaryEntries({ mode: 'sync' }),
  [{ kind: 'themes', label: 'Theme pack update' }]
);
assert.equal(
  service.applyLocalPostCommitState([{ kind: 'index' }]),
  'applied',
  'post-commit state application should stay behind the service API'
);
assert.ok(
  calls.some((call) => call[0] === 'postCommit.apply' && call[1] === 1),
  'applyLocalPostCommitState should delegate to the post-commit applier'
);
