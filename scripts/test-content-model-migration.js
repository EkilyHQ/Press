import assert from 'node:assert/strict';

const {
  getLegacyContentModelMigrationFiles,
  loadLegacyContentModelMigration
} = await import('../assets/js/content-model-migration.js');

function textResponse(text, options = {}) {
  return {
    ok: options.ok !== false,
    status: options.status || (options.ok === false ? 404 : 200),
    text: async () => String(text || '')
  };
}

{
  const responses = new Map([
    ['docs/index.en.yaml', 'Guide: posts/guide.md\nLegacy Only:\n  location: posts/legacy.md\n  summary: Kept\n'],
    ['docs/index.chs.yaml', 'Guide: posts/guide-zh.md\n'],
    ['docs/tabs.en.yaml', 'Docs: docs/index.md\n'],
    ['docs/tabs.chs.yaml', 'Docs:\n  title: Docs Zh\n  location: docs/index-zh.md\n']
  ]);
  const requests = [];

  const migration = await loadLegacyContentModelMigration({
    contentRoot: 'docs',
    currentLang: 'chs',
    languages: ['en', 'chs'],
    fetchImpl: async (input) => {
      const url = String(input || '').split('?')[0];
      requests.push(url);
      return responses.has(url) ? textResponse(responses.get(url)) : textResponse('', { ok: false, status: 404 });
    }
  });

  assert.equal(migration.hasLegacyContentModel, true);
  assert.deepEqual(migration.indexRaw.__order, ['Guide', 'Legacy Only']);
  assert.deepEqual(migration.indexRaw.Guide, {
    en: 'posts/guide.md',
    chs: 'posts/guide-zh.md'
  });
  assert.deepEqual(migration.indexRaw['Legacy Only'], {
    en: {
      location: 'posts/legacy.md',
      summary: 'Kept'
    }
  });
  assert.deepEqual(migration.tabsRaw.Docs, {
    en: {
      title: 'Docs',
      location: 'docs/index.md'
    },
    chs: {
      title: 'Docs Zh',
      location: 'docs/index-zh.md'
    }
  });
  assert.deepEqual(
    getLegacyContentModelMigrationFiles(migration).map(file => [file.path, file.deleted]),
    [
      ['docs/index.en.yaml', true],
      ['docs/index.chs.yaml', true],
      ['docs/tabs.en.yaml', true],
      ['docs/tabs.chs.yaml', true]
    ]
  );
  assert.equal(requests.includes('docs/index.ja.yaml'), true, 'registered/default sidecar languages should still be probed');
}

{
  const migration = await loadLegacyContentModelMigration({
    contentRoot: 'docs',
    currentLang: 'en',
    languages: ['en', 'chs'],
    indexRaw: {
      __order: ['Guide'],
      Guide: {
        en: 'posts/unified.md'
      }
    },
    fetchImpl: async (input) => {
      const url = String(input || '').split('?')[0];
      if (url === 'docs/index.en.yaml') return textResponse('Guide: posts/legacy-en.md\n');
      if (url === 'docs/index.chs.yaml') return textResponse('Guide: posts/legacy-zh.md\n');
      return textResponse('', { ok: false, status: 404 });
    }
  });

  assert.deepEqual(
    migration.indexRaw.Guide,
    {
      en: 'posts/unified.md',
      chs: 'posts/legacy-zh.md'
    },
    'existing unified language values should win while legacy files fill missing variants'
  );
}

{
  const migration = await loadLegacyContentModelMigration({
    contentRoot: 'docs',
    currentLang: 'en',
    languages: ['en'],
    fetchImpl: async (input) => {
      const url = String(input || '').split('?')[0];
      if (url === 'docs/index.chs.yaml') return textResponse('指南: posts/guide-zh.md\n');
      if (url === 'docs/tabs.ja.yaml') return textResponse('案内: docs/guide-ja.md\n');
      return textResponse('', { ok: false, status: 404 });
    }
  });

  assert.deepEqual(migration.indexRaw['指南'].chs, 'posts/guide-zh.md');
  assert.deepEqual(migration.tabsRaw['案内'].ja, {
    title: '案内',
    location: 'docs/guide-ja.md'
  });
}

{
  const migration = await loadLegacyContentModelMigration({
    contentRoot: 'docs',
    currentLang: 'en',
    languages: ['en'],
    fetchImpl: async (input) => {
      const url = String(input || '').split('?')[0];
      if (url === 'assets/i18n/languages.json') {
        return {
          ok: true,
          status: 200,
          json: async () => [{ value: 'en' }, { value: 'fr' }]
        };
      }
      if (url === 'docs/index.fr.yaml') return textResponse('Guide FR: posts/guide-fr.md\n');
      return textResponse('', { ok: false, status: 404 });
    }
  });

  assert.deepEqual(migration.indexRaw['Guide FR'].fr, 'posts/guide-fr.md');
  assert.equal(
    getLegacyContentModelMigrationFiles(migration).some(file => file.path === 'docs/index.fr.yaml'),
    true,
    'registered custom language sidecars should be migrated'
  );
}

{
  const migration = await loadLegacyContentModelMigration({
    contentRoot: 'docs',
    currentLang: 'chs',
    defaultLang: 'en',
    indexRaw: {
      __order: ['Guide'],
      Guide: 'posts/guide.md'
    },
    tabsRaw: {
      __order: ['Docs'],
      Docs: 'docs/index.md'
    },
    fetchImpl: async (input) => {
      const url = String(input || '').split('?')[0];
      if (url === 'docs/index.chs.yaml') return textResponse('指南: posts/guide-zh.md\n');
      if (url === 'docs/tabs.chs.yaml') return textResponse('文档: docs/index-zh.md\n');
      return textResponse('', { ok: false, status: 404 });
    }
  });

  assert.deepEqual(migration.indexRaw.__order, ['Guide']);
  assert.deepEqual(migration.indexRaw.Guide, {
    en: 'posts/guide.md',
    chs: {
      title: '指南',
      location: 'posts/guide-zh.md'
    }
  });
  assert.deepEqual(migration.tabsRaw.__order, ['Docs']);
  assert.deepEqual(migration.tabsRaw.Docs, {
    en: {
      title: 'Docs',
      location: 'docs/index.md'
    },
    chs: {
      title: '文档',
      location: 'docs/index-zh.md'
    }
  });
}

{
  const migration = await loadLegacyContentModelMigration({
    contentRoot: 'docs',
    currentLang: 'chs',
    defaultLang: 'en',
    fetchImpl: async (input) => {
      const url = String(input || '').split('?')[0];
      if (url === 'docs/index.en.yaml') return textResponse('Guide: posts/guide.md\n');
      if (url === 'docs/index.chs.yaml') return textResponse('指南: posts/guide.md\n');
      if (url === 'docs/tabs.en.yaml') return textResponse('Docs: docs/index.md\n');
      if (url === 'docs/tabs.chs.yaml') return textResponse('文档: docs/index.md\n');
      return textResponse('', { ok: false, status: 404 });
    }
  });

  assert.deepEqual(migration.indexRaw.__order, ['Guide']);
  assert.deepEqual(migration.indexRaw.Guide, {
    en: 'posts/guide.md',
    chs: {
      title: '指南',
      location: 'posts/guide.md'
    }
  });
  assert.deepEqual(migration.tabsRaw.__order, ['Docs']);
  assert.deepEqual(migration.tabsRaw.Docs, {
    en: {
      title: 'Docs',
      location: 'docs/index.md'
    },
    chs: {
      title: '文档',
      location: 'docs/index.md'
    }
  });
}

console.log('content model migration tests passed');
