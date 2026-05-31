import assert from 'node:assert/strict';
import { createComposerControllerGraph, createComposerControllerStartup } from '../assets/js/composer-controller-graph.js';

{
  const calls = [];
  const registry = { id: 'services' };
  const lifecycle = { id: 'lifecycle' };
  const facade = { id: 'workspace' };
  const graph = createComposerControllerGraph({
    createServiceRegistry(options) {
      calls.push(['registry', options]);
      return registry;
    },
    createServiceLifecycle(services, options) {
      calls.push(['lifecycle', services, options]);
      return lifecycle;
    },
    createMarkdownWorkspaceFacade(options) {
      calls.push(['facade', options.services]);
      return facade;
    },
    createStartup(options) {
      calls.push(['startup', options.composerServices, options.composerServiceLifecycle, options.markdownWorkspace]);
      return { start: () => 'started' };
    },
    serviceRegistry: { diagnostics: true },
    serviceLifecycle: { strict: true }
  });

  assert.equal(graph.composerServices, registry);
  assert.equal(graph.composerServiceLifecycle, lifecycle);
  assert.equal(graph.markdownWorkspace, facade);
  assert.equal(graph.createStartup().start(), 'started');
  assert.deepEqual(calls, [
    ['registry', { diagnostics: true }],
    ['lifecycle', registry, { strict: true }],
    ['facade', registry],
    ['startup', registry, lifecycle, facade]
  ]);
}

{
  const calls = [];
  const lifecycle = createComposerControllerStartup({
    documentRef: { nodeType: 9 },
    windowRef: { location: 'window' },
    consoleRef: { warn: () => {}, error: () => {} },
    editorRuntime: {
      onDocumentReady: handler => calls.push(['ready', typeof handler]),
      ensureSiteRepo: () => 'site-repo',
      getLocation: () => ({ href: 'https://example.test/' }),
      setAllowEditorStatePersist: value => calls.push(['allowPersist', value]),
      setTimer: (handler, delay) => calls.push(['timer', typeof handler, delay])
    },
    composerStateStore: {
      setActiveState: state => calls.push(['activeState', state]),
      setRemoteBaseline: (kind, value) => calls.push(['baseline', kind, value])
    },
    composerServiceLifecycle: { id: 'serviceLifecycle' },
    composerActions: { id: 'actions' },
    composerSystemThemeBridge: {
      createLifecycleFeature: () => ({ name: 'composer.systemThemeBridge' })
    },
    markdownToolbar: {
      updateMarkdownPushButton: () => calls.push(['updatePush'])
    },
    initialState: {
      t: key => key
    },
    workspace: {
      t: key => key
    },
    workspaceUi: {
      applyMode: mode => calls.push(['mode', mode])
    },
    bindComposerWorkspaceUi(options) {
      calls.push(['bindWorkspaceUi', !!options.documentRef, !!options.consoleRef]);
      options.applyMode('site');
      return 'bound';
    },
    createLifecycle(options) {
      calls.push(['lifecycle', options.composerServiceLifecycle.id, options.composerActions.id]);
      const bootstrap = options.bootstrapOptions;
      bootstrap.setActiveComposerState({ ok: true });
      bootstrap.initialState.setRemoteBaseline('site', { title: 'Site' });
      bootstrap.workspace.setAllowEditorStatePersist(false);
      bootstrap.workspace.setTimeoutRef(() => {}, 30);
      assert.equal(bootstrap.initialState.ensureSiteRepo(), 'site-repo');
      assert.deepEqual(bootstrap.workspace.getLocation(), { href: 'https://example.test/' });
      assert.equal(bootstrap.workspace.bindWorkspaceUi(), 'bound');
      assert.deepEqual(bootstrap.extraFeatures.map(feature => feature.name), ['composer.systemThemeBridge']);
      return { start: () => 'started' };
    }
  });

  assert.equal(lifecycle.start(), 'started');
  assert.deepEqual(calls, [
    ['lifecycle', 'serviceLifecycle', 'actions'],
    ['activeState', { ok: true }],
    ['baseline', 'site', { title: 'Site' }],
    ['allowPersist', false],
    ['timer', 'function', 30],
    ['bindWorkspaceUi', true, true],
    ['mode', 'site']
  ]);
}

console.log('ok - composer controller graph');
