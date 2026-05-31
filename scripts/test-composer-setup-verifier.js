import assert from 'node:assert/strict';
import { createComposerSetupVerifier } from '../assets/js/composer-setup-verifier.js';

function createHarness(overrides = {}) {
  const state = overrides.state || {
    index: {
      __order: ['alpha'],
      alpha: {
        en: ['post/alpha/v1.0.0/en.md', 'post/alpha/v2.0.0/en.md'],
        ja: [{ location: 'post/alpha/v1.0.0/ja.md' }]
      }
    },
    tabs: {
      __order: ['home'],
      home: {
        en: { title: 'Home', location: 'tab/home/en.md' }
      }
    }
  };
  const calls = [];
  const okPaths = new Set(overrides.okPaths || ['wwwroot/post/alpha/v1.0.0/en.md', 'wwwroot/post/alpha/v1.0.0/ja.md']);
  const remoteText = overrides.remoteText == null ? '' : String(overrides.remoteText);

  const controller = createComposerSetupVerifier({
    documentRef: null,
    consoleRef: { warn: (...args) => calls.push(['warn', args]) },
    getContentRoot: () => 'wwwroot',
    matchesMedia: () => true,
    setTimeoutRef: (handler) => {
      calls.push(['timer', handler]);
      return handler;
    },
    t: (key, params = {}) => {
      if (key === 'editor.toasts.yamlUpToDate') return `${params.name} up to date`;
      if (key === 'editor.composer.remoteWatcher.waitingForLabel') return `waiting ${params.label}`;
      if (key === 'editor.composer.yaml.toastCopiedUpdate') return `update ${params.name}`;
      if (key === 'editor.composer.yaml.toastCopiedCreate') return `create ${params.name}`;
      return key;
    },
    getState: () => state,
    getActiveComposerFile: () => overrides.activeKind || 'index',
    getActiveSiteRepoConfig: () => overrides.repo || { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
    sortLangKeys: (obj) => Object.keys(obj || {}).sort(),
    normalizeComposerVersionPaths: (value) => {
      const list = Array.isArray(value) ? value : (value ? [value] : []);
      return list.map(item => (item && typeof item === 'object' ? item.location : item)).filter(Boolean);
    },
    extractVersionFromPath: (value) => String(value || '').split('/').at(-2) || '',
    makeDefaultMdTemplate: (meta = {}) => `---\nversion: ${meta.version || 'v1.0.0'}\n---\n`,
    toTabsYaml: (tabs) => `tabs:${Object.keys(tabs || {}).filter(key => key !== '__order').join(',')}`,
    toIndexYaml: (index) => `index:${Object.keys(index || {}).filter(key => key !== '__order').join(',')}`,
    nsCopyToClipboard: (text) => calls.push(['copy', text]),
    preparePopupWindow: () => ({ popup: true }),
    closePopupWindow: (popup) => calls.push(['closePopup', popup]),
    finalizePopupWindow: (popup, href) => {
      calls.push(['finalizePopup', popup, href]);
      return overrides.opened !== false;
    },
    handlePopupBlocked: (href, opts) => calls.push(['blocked', href, opts.message, opts.actionLabel]),
    showToast: (kind, message) => calls.push(['toast', kind, message]),
    fetchComposerRemoteSnapshot: async (kind) => {
      calls.push(['remoteSnapshot', kind]);
      return { state: 'existing', data: { kind } };
    },
    applyComposerRemoteSnapshot: (kind, snapshot) => calls.push(['applySnapshot', kind, snapshot]),
    clearDraftStorage: (kind) => calls.push(['clearDraft', kind]),
    updateUnsyncedSummary: () => calls.push(['summary']),
    startComposerSyncWatcher: (kind, opts) => calls.push(['watcher', kind, opts.expectedText, opts.message]),
    getMarkdownPushLabel: () => 'Push Markdown',
    fetchRef: async (url) => {
      calls.push(['fetch', url]);
      if (url.endsWith('/index.yaml') || url.endsWith('/index.yml') || url.endsWith('/tabs.yaml') || url.endsWith('/tabs.yml')) {
        return remoteText ? { ok: true, text: async () => remoteText } : { ok: false, text: async () => '' };
      }
      return { ok: okPaths.has(url), text: async () => '' };
    },
    ...overrides.options
  });

  return { calls, controller, state };
}

{
  const { calls, controller } = createHarness();
  const missing = await controller.computeMissingFiles('index');
  assert.deepEqual(
    missing.map(item => `${item.key}:${item.lang}:${item.path}`).sort(),
    ['alpha:en:post/alpha/v2.0.0/en.md']
  );
  assert.ok(calls.some(([type, url]) => type === 'fetch' && url === 'wwwroot/post/alpha/v2.0.0/en.md'));
}

{
  const { controller } = createHarness();
  const missing = await controller.computeMissingFiles('tabs');
  assert.deepEqual(missing.map(item => item.path), ['tab/home/en.md']);
  assert.equal(missing[0].folder, 'tab/home');
  assert.equal(missing[0].filename, 'en.md');
}

{
  const { controller } = createHarness();
  assert.equal(
    controller.buildRepositoryNewFileLink('EkilyHQ', 'Press', 'main', 'wwwroot/post/alpha/v1.0.0', 'en.md'),
    'https://github.com/EkilyHQ/Press/new/main/wwwroot/post/alpha/v1.0.0?filename=en.md'
  );
  assert.equal(
    controller.buildRepositoryEditFileLink('EkilyHQ', 'Press', 'main', 'wwwroot/index.yaml'),
    'https://github.com/EkilyHQ/Press/edit/main/wwwroot/index.yaml'
  );
}

{
  const { controller } = createHarness({
    options: {
      siteRepositoryProvider: {
        buildNewFileUrl({ repo, folderPath, filename }) {
          return `https://git.example.test/${repo.owner}/${repo.name}/new/${repo.branch}/${folderPath}?filename=${filename}`;
        },
        buildEditFileUrl({ repo, filePath }) {
          return `https://git.example.test/${repo.owner}/${repo.name}/edit/${repo.branch}/${filePath}`;
        }
      }
    }
  });
  assert.equal(
    controller.buildRepositoryNewFileLink('EkilyHQ', 'Press', 'main', 'wwwroot/post/alpha/v1.0.0', 'en.md'),
    'https://git.example.test/EkilyHQ/Press/new/main/wwwroot/post/alpha/v1.0.0?filename=en.md'
  );
  assert.equal(
    controller.buildRepositoryEditFileLink('EkilyHQ', 'Press', 'main', 'wwwroot/index.yaml'),
    'https://git.example.test/EkilyHQ/Press/edit/main/wwwroot/index.yaml'
  );
}

{
  const { calls, controller } = createHarness({ remoteText: 'index:alpha' });
  await controller.afterAllGood('index');
  assert.ok(calls.some(([type, kind, message]) => type === 'toast' && kind === 'success' && message === 'index.yaml up to date'));
  assert.ok(calls.some(([type, kind]) => type === 'remoteSnapshot' && kind === 'index'));
  assert.ok(calls.some(([type, kind]) => type === 'clearDraft' && kind === 'index'));
  assert.ok(calls.some(([type]) => type === 'summary'));
}

{
  const { calls, controller } = createHarness({ remoteText: 'index:old' });
  await controller.afterAllGood('index');
  const popup = calls.find(([type]) => type === 'finalizePopup');
  assert.ok(popup, 'expected GitHub edit popup attempt');
  assert.equal(popup[2], 'https://github.com/EkilyHQ/Press/edit/main/wwwroot/index.yaml');
  assert.ok(calls.some(([type, kind, text, message]) => type === 'watcher' && kind === 'index' && text === 'index:alpha' && message === 'waiting index.yaml'));
}

console.log('composer setup verifier tests passed');
