import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assembleComposerWorkspace,
  bindComposerMarkdownToolbar,
  bindComposerWorkspaceUi,
  createComposerBootstrapFeatures,
  initializeComposerApp,
  initializeComposerOnDomReady,
  loadInitialComposerState
} from '../assets/js/composer-bootstrap.js';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(id, dataset = {}) {
    this.id = id;
    this.dataset = { ...dataset };
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.attrs = {};
    this.disabled = false;
    this.textContent = '';
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  async click(extra = {}) {
    const handlers = this.listeners.get('click') || [];
    for (const handler of handlers) {
      await handler({
        currentTarget: this,
        preventDefault() {
          extra.prevented = true;
        },
        ...extra
      });
    }
    return extra;
  }

  setAttribute(name, value) {
    this.attrs[name] = value;
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.selectors = new Map();
    this.listeners = new Map();
  }

  addElement(element) {
    this.elements.set(element.id, element);
    return element;
  }

  setSelector(selector, elements) {
    this.selectors.set(selector, elements);
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  querySelectorAll(selector) {
    return this.selectors.get(selector) || [];
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
}

{
  const documentRef = new FakeDocument();
  const push = documentRef.addElement(new FakeElement('btnPushMarkdown'));
  const save = documentRef.addElement(new FakeElement('btnSaveMarkdown'));
  const protect = documentRef.addElement(new FakeElement('btnProtectMarkdown'));
  const discard = documentRef.addElement(new FakeElement('btnDiscardMarkdown'));
  const calls = [];
  let activeTab = null;
  bindComposerMarkdownToolbar({
    documentRef,
    t: (key) => key,
    setMarkdownPushButton: button => calls.push(['setPush', button.id]),
    setMarkdownSaveButton: button => calls.push(['setSave', button.id]),
    setMarkdownProtectionButton: button => calls.push(['setProtect', button.id]),
    setMarkdownDiscardButton: button => calls.push(['setDiscard', button.id]),
    getMarkdownPushButton: () => push,
    getActiveDynamicTab: () => activeTab,
    getButtonLabel: () => 'Push',
    getMarkdownPushLabel: () => 'Push',
    setButtonLabel: (button, label) => {
      button.textContent = label;
      calls.push(['label', label]);
    },
    showToast: (kind, message) => calls.push(['toast', kind, message]),
    openMarkdownPushOnGitHub: async tab => calls.push(['pushGithub', tab.path]),
    updateMarkdownPushButton: tab => calls.push(['updatePush', tab && tab.path || null]),
    updateMarkdownProtectionButton: tab => calls.push(['updateProtect', tab && tab.path || null]),
    manualSaveActiveMarkdown: button => calls.push(['save', button.id]),
    handleMarkdownProtectionButton: button => calls.push(['protect', button.id]),
    discardMarkdownLocalChanges: (_tab, button) => calls.push(['discard', button.id]),
    updateMarkdownSaveButton: tab => calls.push(['updateSave', tab && tab.path || null]),
    updateMarkdownDiscardButton: tab => calls.push(['updateDiscard', tab && tab.path || null])
  });

  await push.click();
  assert.deepEqual(calls.find(call => call[0] === 'toast'), ['toast', 'info', 'editor.toasts.markdownOpenBeforePush']);

  activeTab = { path: 'post/doc.md' };
  await push.click();
  assert.equal(push.disabled, false, 'push button should leave busy state after push');
  assert.equal(push.attrs['aria-disabled'], 'false');
  assert.equal(push.classList.contains('is-busy'), false);
  assert.equal(calls.some(call => call[0] === 'pushGithub' && call[1] === 'post/doc.md'), true);

  await save.click();
  await protect.click();
  await discard.click();
  assert.equal(calls.some(call => call[0] === 'save' && call[1] === 'btnSaveMarkdown'), true);
  assert.equal(calls.some(call => call[0] === 'protect' && call[1] === 'btnProtectMarkdown'), true);
  assert.equal(calls.some(call => call[0] === 'discard' && call[1] === 'btnDiscardMarkdown'), true);
}

{
  const documentRef = new FakeDocument();
  const syncMode = new FakeElement('modeSync', { mode: 'sync' });
  const editorMode = new FakeElement('modeEditor', { mode: 'editor' });
  const fileLink = new FakeElement('fileTabs', { cfile: 'tabs' });
  documentRef.setSelector('.mode-tab', [syncMode, editorMode]);
  documentRef.setSelector('a.vt-btn[data-cfile]', [fileLink]);
  const review = documentRef.addElement(new FakeElement('btnReview', { kind: 'tabs' }));
  const add = documentRef.addElement(new FakeElement('btnAddItem'));
  documentRef.addElement(new FakeElement('btnDiscard'));
  documentRef.addElement(new FakeElement('btnRefresh'));
  const calls = [];

  bindComposerWorkspaceUi({
    documentRef,
    mountEditorSystemPanels: () => calls.push(['mount']),
    initEditorOverlay: () => calls.push(['overlay']),
    initEditorRailResize: () => calls.push(['resize']),
    initMobileEditorRail: () => calls.push(['mobile']),
    bindEditorStatePersistenceListeners: () => calls.push(['persistListeners']),
    openEditorOverlay: mode => calls.push(['openOverlay', mode]),
    applyMode: mode => calls.push(['applyMode', mode]),
    setComposerFile: (name, options = {}) => calls.push(['setFile', name, !!options.immediate]),
    getInitialComposerFile: () => 'index',
    getActiveComposerFile: () => 'tabs',
    addComposerEntry: kind => calls.push(['add', kind]),
    handleComposerDiscard: () => calls.push(['discard']),
    handleComposerRefresh: () => calls.push(['refresh']),
    computeUnsyncedSummary: () => [{ kind: 'tabs' }],
    openComposerDiffModal: kind => calls.push(['diff', kind]),
    bindVerifySetup: () => calls.push(['verify'])
  });

  assert.deepEqual(calls.slice(0, 6).map(call => call[0]), ['mount', 'overlay', 'resize', 'mobile', 'persistListeners', 'setFile']);
  assert.equal(calls.some(call => call[0] === 'setFile' && call[1] === 'index' && call[2] === true), true);
  await syncMode.click();
  await editorMode.click();
  await fileLink.click();
  await add.click();
  await review.click();
  assert.equal(calls.some(call => call[0] === 'openOverlay' && call[1] === 'sync'), true);
  assert.equal(calls.some(call => call[0] === 'applyMode' && call[1] === 'editor'), true);
  assert.equal(calls.some(call => call[0] === 'setFile' && call[1] === 'tabs'), true);
  assert.equal(calls.some(call => call[0] === 'add' && call[1] === 'tabs'), true);
  assert.equal(calls.some(call => call[0] === 'diff' && call[1] === 'tabs'), true);
  assert.equal(calls.some(call => call[0] === 'verify'), true);
}

{
  const remoteBaseline = {};
  const calls = [];
  const state = await loadInitialComposerState({
    t: key => key,
    fetchTrackedSiteConfig: async () => ({ contentRoot: 'docs', siteTitle: 'Legacy' }),
    applyEffectiveSiteConfig: site => ({ ...site, contentRoot: site.contentRoot || 'wwwroot' }),
    fetchConfigWithYamlFallback: async (paths) => {
      calls.push(['fetchConfig', paths]);
      return {};
    },
    loadContentModelMigration: async ({ contentRoot, indexRaw, tabsRaw }) => {
      calls.push(['contentMigration', contentRoot, indexRaw, tabsRaw]);
      return {
        hasLegacyContentModel: true,
        indexRaw: {
          Guide: {
            en: 'posts/guide.md'
          }
        },
        tabsRaw: {
          Docs: {
            en: {
              title: 'Docs',
              location: 'docs/index.md'
            }
          }
        },
        legacyFiles: [
          {
            kind: 'content-model-migration',
            path: 'docs/index.en.yaml',
            deleted: true
          }
        ]
      };
    },
    prepareSiteState: value => ({ ...value, preparedSite: true }),
    prepareIndexState: value => ({ ...value, preparedIndex: true }),
    prepareTabsState: value => ({ ...value, preparedTabs: true }),
    cloneSiteState: value => ({ ...value, clonedSite: true }),
    deepClone: value => JSON.parse(JSON.stringify(value || {})),
    setRemoteBaseline: (kind, value) => {
      remoteBaseline[kind] = value;
    },
    updateMarkdownPushButton: () => {}
  });

  assert.deepEqual(
    calls.find(call => call[0] === 'contentMigration'),
    ['contentMigration', 'docs', {}, {}],
    'composer bootstrap should offer the remote unified YAML as migration input'
  );
  assert.deepEqual(remoteBaseline.index, { preparedIndex: true });
  assert.deepEqual(state.index, {
    Guide: {
      en: 'posts/guide.md'
    },
    preparedIndex: true
  });
  assert.deepEqual(state.tabs, {
    Docs: {
      en: {
        title: 'Docs',
        location: 'docs/index.md'
      }
    },
    preparedTabs: true
  });
  assert.equal(
    Object.keys(state).includes('__contentModelMigration'),
    false,
    'content migration metadata should not be enumerable editor state'
  );
  assert.deepEqual(state.__contentModelMigration.legacyFiles, [
    {
      category: 'legacy-content-model',
      state: 'deleted',
      kind: 'content-model-migration',
      path: 'docs/index.en.yaml',
      deleted: true
    }
  ]);
}

{
  const documentRef = new FakeDocument();
  documentRef.addElement(new FakeElement('composerIndex'));
  documentRef.addElement(new FakeElement('composerTabs'));
  documentRef.addElement(new FakeElement('composerSite'));
  const calls = [];
  const remoteBaseline = {};
  let activeState = null;
  let allowPersist = false;
  const result = await initializeComposerOnDomReady({
    documentRef,
    setActiveComposerState: (state) => {
      activeState = state;
    },
    initialState: {
      windowRef: { location: 'https://deemoe404.github.io/site/index_editor.html' },
      consoleRef: { warn: (...args) => calls.push(['warn', ...args]) },
      t: key => key,
      fetchTrackedSiteConfig: async () => ({ contentRoot: 'content', siteTitle: 'Remote' }),
      applyEffectiveSiteConfig: site => ({ ...site, contentRoot: site.contentRoot || 'wwwroot' }),
      fetchConfigWithYamlFallback: async paths => ({ __order: [paths[0]] }),
      prepareSiteState: value => ({ ...value, preparedSite: true }),
      prepareIndexState: value => ({ ...value, preparedIndex: true }),
      prepareTabsState: value => ({ ...value, preparedTabs: true }),
      cloneSiteState: value => ({ ...value, clonedSite: true }),
      deepClone: value => JSON.parse(JSON.stringify(value)),
      setRemoteBaseline: (kind, value) => {
        remoteBaseline[kind] = value;
      },
      updateMarkdownPushButton: () => calls.push(['updatePush']),
      showStatus: message => calls.push(['status', message])
    },
    workspace: {
      documentRef,
      windowRef: { location: 'https://deemoe404.github.io/site/index_editor.html' },
      t: (key, params = {}) => params.label ? `${key}:${params.label}` : key,
      loadDraftSnapshotsIntoState: () => ['site'],
      applyInferredRepoConfig: (site) => {
        site.repo = { owner: 'deemoe404', name: 'site', branch: 'main' };
        return true;
      },
      inferRepoConfigFromGitHubPagesUrl: () => ({ owner: 'deemoe404', name: 'site', branch: 'main' }),
      applyEffectiveSiteConfig: site => calls.push(['applySite', site.repo.name]),
      updateMarkdownPushButton: () => calls.push(['workspaceUpdatePush']),
      showStatus: message => calls.push(['workspaceStatus', message]),
      bindWorkspaceUi: () => calls.push(['bindWorkspace']),
      buildIndexUI: (root, state) => calls.push(['buildIndex', root.id, state.index.preparedIndex]),
      buildTabsUI: (root, state) => calls.push(['buildTabs', root.id, state.tabs.preparedTabs]),
      buildSiteUI: (root, state) => calls.push(['buildSite', root.id, state.site.preparedSite]),
      notifyComposerChange: (kind, options) => calls.push(['notify', kind, options]),
      refreshEditorContentTree: () => calls.push(['refreshTree']),
      restoreDynamicEditorState: () => false,
      applyMode: mode => calls.push(['applyMode', mode]),
      setAllowEditorStatePersist: value => {
        allowPersist = value;
      },
      persistDynamicEditorState: () => calls.push(['persist']),
      setTimeoutRef: handler => {
        calls.push(['timer']);
        handler();
      }
    }
  });

  assert.equal(activeState, result.state);
  assert.equal(remoteBaseline.index.preparedIndex, true);
  assert.equal(remoteBaseline.tabs.preparedTabs, true);
  assert.equal(remoteBaseline.site.clonedSite, true);
  assert.equal(activeState.site.repo.name, 'site');
  assert.equal(calls.some(call => call[0] === 'bindWorkspace'), true);
  assert.equal(calls.some(call => call[0] === 'buildIndex' && call[1] === 'composerIndex'), true);
  assert.deepEqual(calls.find(call => call[0] === 'notify' && call[1] === 'site'), ['notify', 'site', {}]);
  assert.equal(calls.some(call => call[0] === 'applyMode' && call[1] === 'editor'), true);
  assert.equal(allowPersist, true);
  assert.equal(calls.some(call => call[0] === 'persist'), true);
  assert.equal(typeof result.dispose, 'function');
  assert.equal(await result.dispose(), true);
}

{
  const documentRef = new FakeDocument();
  documentRef.addElement(new FakeElement('composerIndex'));
  documentRef.addElement(new FakeElement('composerTabs'));
  documentRef.addElement(new FakeElement('composerSite'));
  const calls = [];
  assembleComposerWorkspace({
    documentRef,
    state: { index: {}, tabs: {}, site: {} },
    t: (key, params = {}) => params.label ? `${key}:${params.label}` : key,
    loadDraftSnapshotsIntoState: () => ['index'],
    applyInferredRepoConfig: () => false,
    inferRepoConfigFromGitHubPagesUrl: () => null,
    getLocation: () => null,
    applyEffectiveSiteConfig: () => calls.push(['applySite']),
    updateMarkdownPushButton: () => calls.push(['updatePush']),
    showStatus: message => calls.push(['status', message]),
    bindWorkspaceUi: () => calls.push(['bindWorkspace']),
    buildIndexUI: () => calls.push(['buildIndex']),
    buildTabsUI: () => calls.push(['buildTabs']),
    buildSiteUI: () => calls.push(['buildSite']),
    notifyComposerChange: kind => calls.push(['notify', kind]),
    refreshEditorContentTree: () => calls.push(['refreshTree']),
    restoreDynamicEditorState: () => false,
    applyMode: mode => calls.push(['applyMode', mode]),
    setAllowEditorStatePersist: value => calls.push(['allowPersist', value]),
    persistDynamicEditorState: () => calls.push(['persist'])
  });
  assert.deepEqual(
    calls.filter(call => call[0] === 'status'),
    [['status', 'editor.composer.statusMessages.restoredDraft:index.yaml']],
    'composer bootstrap should not run delayed status clearing without an injected timer'
  );
  assert.equal(calls.some(call => call[0] === 'persist'), true);
}

{
  const documentRef = new FakeDocument();
  const readyHandlers = [];
  const handler = initializeComposerApp({
    documentRef,
    onDocumentReady: (readyHandler) => {
      readyHandlers.push(readyHandler);
    }
  });
  assert.equal(typeof handler, 'function');
  assert.deepEqual(readyHandlers, [handler]);
  assert.equal(documentRef.listeners.has('DOMContentLoaded'), false);
}

{
  const documentRef = new FakeDocument();
  documentRef.addElement(new FakeElement('composerIndex'));
  documentRef.addElement(new FakeElement('composerTabs'));
  documentRef.addElement(new FakeElement('composerSite'));
  const calls = [];
  const result = await initializeComposerOnDomReady({
    documentRef,
    initialState: {
      ensureSiteRepo: () => {},
      fetchTrackedSiteConfig: async () => ({}),
      fetchConfigWithYamlFallback: async () => ({}),
      applyEffectiveSiteConfig: site => site || {},
      prepareSiteState: value => value || {},
      prepareIndexState: value => value || {},
      prepareTabsState: value => value || {},
      cloneSiteState: value => ({ ...(value || {}) }),
      deepClone: value => JSON.parse(JSON.stringify(value || {})),
      setRemoteBaseline: () => {},
      updateMarkdownPushButton: () => {},
      t: key => key
    },
    workspace: {
      loadDraftSnapshotsIntoState: () => [],
      bindWorkspaceUi: () => {},
      applyEffectiveSiteConfig: () => {},
      updateMarkdownPushButton: () => {},
      buildIndexUI: () => {},
      buildTabsUI: () => {},
      buildSiteUI: () => {},
      notifyComposerChange: () => {},
      refreshEditorContentTree: () => {},
      restoreDynamicEditorState: () => false,
      applyMode: () => {},
      setAllowEditorStatePersist: () => {},
      persistDynamicEditorState: () => {}
    },
    extraFeatures: [
      {
        name: 'test.bootstrapExtra',
        requires: ['composerWorkspace'],
        start() {
          calls.push(['extra-start']);
        },
        dispose() {
          calls.push(['extra-dispose']);
        }
      }
    ]
  });

  assert.deepEqual(calls, [['extra-start']]);
  assert.equal(typeof result.dispose, 'function');
  assert.equal(await result.dispose(), true);
  assert.deepEqual(calls, [['extra-start'], ['extra-dispose']]);
}

{
  const features = createComposerBootstrapFeatures({});
  assert.deepEqual(
    features.map(feature => feature.name),
    ['composer.markdownToolbar', 'composer.initialState', 'composer.workspace'],
    'composer bootstrap should expose an explicit feature lifecycle'
  );
  assert.deepEqual(features[1].requires, ['markdownToolbar']);
  assert.deepEqual(features[2].requires, ['initialComposerState']);
}

{
  const features = createComposerBootstrapFeatures({
    extraFeatures: [
      {
        name: 'composer.systemThemeBridge',
        requires: ['composerWorkspace'],
        provides: ['systemThemeBridge']
      }
    ]
  });
  assert.deepEqual(
    features.map(feature => feature.name),
    ['composer.markdownToolbar', 'composer.initialState', 'composer.workspace', 'composer.systemThemeBridge'],
    'composer bootstrap should append bridge/features that participate in the shared lifecycle'
  );
}

{
  const here = dirname(fileURLToPath(import.meta.url));
  const composerSource = readFileSync(resolve(here, '../assets/js/composer.js'), 'utf8');
  const controllerGraphSource = readFileSync(resolve(here, '../assets/js/composer-controller-graph.js'), 'utf8');
  const bootstrapSource = readFileSync(resolve(here, '../assets/js/composer-bootstrap.js'), 'utf8');
  assert.doesNotMatch(composerSource, /document\.addEventListener\('DOMContentLoaded'/);
  assert.doesNotMatch(composerSource, /function bindComposerUI\(/);
  assert.match(composerSource, /from '\.\/composer-controller-graph\.js'/);
  assert.doesNotMatch(composerSource, /from '\.\/composer-bootstrap\.js'|from '\.\/composer-lifecycle\.js'/);
  assert.match(controllerGraphSource, /from '\.\/composer-bootstrap\.js'/);
  assert.match(controllerGraphSource, /from '\.\/composer-lifecycle\.js'/);
  assert.match(bootstrapSource, /from '\.\/editor-app-kernel\.js'/);
  assert.match(bootstrapSource, /createComposerBootstrapFeatures/);
  assert.match(bootstrapSource, /documentRef: context\.documentRef/);
  assert.match(bootstrapSource, /context\.initialComposerState = state/);
  assert.doesNotMatch(bootstrapSource, /initSystemThemeBridge/, 'system/theme bridge init should be an explicit lifecycle feature, not workspace binding side effect');
  assert.match(bootstrapSource, /const onDocumentReady = typeof options\.onDocumentReady === 'function'/);
  assert.doesNotMatch(bootstrapSource, /documentRef\.addEventListener\('DOMContentLoaded'|\bwindowRef\b|(^|[^.])\bsetTimeout\s*\(/m);
  assert.doesNotMatch(
    bootstrapSource,
    /consoleRef\s*=\s*console|setTimeoutRef\s*=\s*\([^)]*handler/,
    'composer bootstrap should receive logging and timers explicitly from the runtime wiring'
  );
}

console.log('composer bootstrap tests passed');
