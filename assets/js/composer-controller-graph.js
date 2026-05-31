import { createComposerServiceRegistry } from './composer-service-registry.js';
import { createComposerServiceLifecycle } from './composer-app-services.js';
import { createComposerMarkdownWorkspaceFacade } from './composer-markdown-workspace-facade.js';
import { createComposerLifecycle } from './composer-lifecycle.js';
import { bindComposerWorkspaceUi } from './composer-bootstrap.js';

const noop = () => {};
const NOOP_LOGGER = Object.freeze({
  warn: noop,
  error: noop
});

function getFunction(source, name, fallback = noop) {
  return source && typeof source[name] === 'function' ? source[name] : fallback;
}

export function createComposerControllerGraph(options = {}) {
  const createServiceRegistry = typeof options.createServiceRegistry === 'function'
    ? options.createServiceRegistry
    : createComposerServiceRegistry;
  const createServiceLifecycle = typeof options.createServiceLifecycle === 'function'
    ? options.createServiceLifecycle
    : createComposerServiceLifecycle;
  const createMarkdownWorkspaceFacade = typeof options.createMarkdownWorkspaceFacade === 'function'
    ? options.createMarkdownWorkspaceFacade
    : createComposerMarkdownWorkspaceFacade;
  const createStartup = typeof options.createStartup === 'function'
    ? options.createStartup
    : createComposerControllerStartup;

  const composerServices = createServiceRegistry(options.serviceRegistry || {});
  const composerServiceLifecycle = createServiceLifecycle(composerServices, options.serviceLifecycle || {});
  const markdownWorkspace = createMarkdownWorkspaceFacade({
    ...(options.markdownWorkspace || {}),
    services: composerServices
  });

  return {
    composerServices,
    composerServiceLifecycle,
    markdownWorkspace,
    createStartup(startupOptions = {}) {
      return createStartup({
        ...startupOptions,
        composerServices: startupOptions.composerServices || composerServices,
        composerServiceLifecycle: startupOptions.composerServiceLifecycle || composerServiceLifecycle,
        markdownWorkspace: startupOptions.markdownWorkspace || markdownWorkspace
      });
    }
  };
}

export function createComposerControllerBootstrapOptions(options = {}) {
  const editorRuntime = options.editorRuntime || {};
  const documentRef = options.documentRef || editorRuntime.documentRef || null;
  const windowRef = options.windowRef || editorRuntime.windowRef || null;
  const consoleRef = options.consoleRef || NOOP_LOGGER;
  const composerStateStore = options.composerStateStore || {};
  const composerSystemThemeBridge = options.composerSystemThemeBridge || null;
  const bindWorkspaceUi = typeof options.bindComposerWorkspaceUi === 'function'
    ? options.bindComposerWorkspaceUi
    : bindComposerWorkspaceUi;
  const markdownToolbar = options.markdownToolbar || {};
  const initialState = options.initialState || {};
  const workspace = options.workspace || {};
  const workspaceUi = options.workspaceUi || {};
  const extraFeatures = [];

  if (composerSystemThemeBridge && typeof composerSystemThemeBridge.createLifecycleFeature === 'function') {
    extraFeatures.push(composerSystemThemeBridge.createLifecycleFeature());
  }
  if (Array.isArray(options.extraFeatures)) extraFeatures.push(...options.extraFeatures);

  return {
    setActiveComposerState: (state) => getFunction(composerStateStore, 'setActiveState')(state),
    markdownToolbar: {
      ...markdownToolbar
    },
    initialState: {
      ensureSiteRepo: () => getFunction(editorRuntime, 'ensureSiteRepo')(),
      windowRef,
      consoleRef,
      ...initialState,
      setRemoteBaseline: (kind, value) => getFunction(composerStateStore, 'setRemoteBaseline')(kind, value)
    },
    workspace: {
      documentRef,
      windowRef,
      getLocation: () => getFunction(editorRuntime, 'getLocation')(),
      bindWorkspaceUi: () => bindWorkspaceUi({
        documentRef,
        consoleRef,
        ...workspaceUi
      }),
      setAllowEditorStatePersist: (value) => getFunction(editorRuntime, 'setAllowEditorStatePersist')(value),
      setTimeoutRef: (handler, delay) => getFunction(editorRuntime, 'setTimer')(handler, delay),
      ...workspace
    },
    extraFeatures
  };
}

export function createComposerControllerStartup(options = {}) {
  const createLifecycle = typeof options.createLifecycle === 'function'
    ? options.createLifecycle
    : createComposerLifecycle;

  function createLifecycleOptions() {
    const editorRuntime = options.editorRuntime || {};
    return {
      documentRef: options.documentRef || editorRuntime.documentRef || null,
      onDocumentReady: options.onDocumentReady || editorRuntime.onDocumentReady,
      composerServiceLifecycle: options.composerServiceLifecycle,
      composerActions: options.composerActions,
      consoleRef: options.consoleRef || NOOP_LOGGER,
      bootstrapOptions: createComposerControllerBootstrapOptions(options)
    };
  }

  return {
    createLifecycleOptions,
    start() {
      const lifecycle = createLifecycle(createLifecycleOptions());
      return lifecycle && typeof lifecycle.start === 'function' ? lifecycle.start() : lifecycle;
    }
  };
}
