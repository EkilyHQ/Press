import { createEditorAppKernel } from './editor-app-kernel.js';
import { initializeComposerApp } from './composer-bootstrap.js';
import { injectComposerRuntimeStyles } from './composer-runtime-styles.js';

export function createComposerLifecycle(options = {}) {
  const documentRef = options.documentRef || null;
  const onDocumentReady = typeof options.onDocumentReady === 'function'
    ? options.onDocumentReady
    : (handler) => handler();
  const composerServiceLifecycle = options.composerServiceLifecycle || null;
  const composerActions = options.composerActions || null;
  const bootstrapOptions = options.bootstrapOptions && typeof options.bootstrapOptions === 'object'
    ? options.bootstrapOptions
    : {};
  const injectRuntimeStyles = typeof options.injectRuntimeStyles === 'function'
    ? options.injectRuntimeStyles
    : injectComposerRuntimeStyles;
  const initializeComposerAppRef = typeof options.initializeComposerApp === 'function'
    ? options.initializeComposerApp
    : initializeComposerApp;
  const consoleRef = options.consoleRef || null;

  const kernel = createEditorAppKernel({
    name: 'composer-controller',
    provides: [
      'documentRef',
      'documentReady',
      'composerServices',
      'composerActions',
      'bootstrapOptions',
      'runtimeStyles'
    ],
    context: {
      documentRef,
      onDocumentReady,
      composerServiceLifecycle,
      composerActions,
      bootstrapOptions,
      initializeComposerApp: initializeComposerAppRef,
      injectRuntimeStyles,
      consoleRef,
      bootstrapHandler: null,
      result: null
    }
  });

  kernel.registerFeature({
    name: 'composer.controllerServices',
    requires: ['composerServices', 'composerActions'],
    provides: ['composerControllerReady'],
    init(context) {
      context.composerServiceLifecycle.assertReady();
      context.composerActions.assertReady();
    }
  });

  kernel.registerFeature({
    name: 'composer.domBootstrap',
    requires: ['documentRef', 'documentReady', 'bootstrapOptions', 'composerControllerReady'],
    provides: ['composerDomBootstrap'],
    start(context) {
      context.bootstrapHandler = context.initializeComposerApp({
        ...context.bootstrapOptions,
        documentRef: context.documentRef,
        onDocumentReady: context.onDocumentReady
      });
    },
    dispose(context) {
      const bootstrapHandler = context.bootstrapHandler;
      if (bootstrapHandler && typeof bootstrapHandler.dispose === 'function') {
        return bootstrapHandler.dispose();
      }
      return false;
    }
  });

  kernel.registerFeature({
    name: 'composer.runtimeStyles',
    requires: ['documentRef', 'runtimeStyles', 'composerDomBootstrap'],
    provides: ['composerRuntimeStyles'],
    start(context) {
      context.injectRuntimeStyles({ documentRef: context.documentRef });
    }
  });

  return {
    registerFeature: feature => kernel.registerFeature(feature),
    getLifecyclePlan: () => kernel.getLifecyclePlan(),
    async start(extraContext = {}) {
      try {
        const result = await kernel.run(extraContext);
        return result;
      } catch (err) {
        if (consoleRef && typeof consoleRef.error === 'function') {
          consoleRef.error('Composer lifecycle failed', err);
        }
        throw err;
      }
    }
  };
}
