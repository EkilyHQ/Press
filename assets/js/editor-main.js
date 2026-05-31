import { createHiEditor } from './hieditor.js';
import { resolveImageSrc } from './safe-html.js';
import { t, withLangParam, getCurrentLang, normalizeLangKey } from './i18n.js';
import { createEditorMainMetadataPanel } from './editor-main-metadata-panel.js';
import { createEditorMainPreviewSession } from './editor-main-preview-session.js';
import { createEditorMainCurrentFileSession } from './editor-main-current-file-session.js';
import { createEditorMainSidebarSession } from './editor-main-sidebar-session.js';
import { createEditorMainToolbarSession } from './editor-main-toolbar-session.js';
import { createEditorMainImageSession } from './editor-main-image-session.js';
import { createEditorMainLinkCardContext } from './editor-main-link-card-context.js';
import { createEditorMainWorkspaceSession } from './editor-main-workspace-session.js';
import { createEditorMainBlocksSession } from './editor-main-blocks-session.js';
import { createEditorMainDocumentSession } from './editor-main-document-session.js';
import { createEditorMainContentService } from './editor-main-content-service.js';
import { createEditorMainFileContextService } from './editor-main-file-context-service.js';
import { createEditorMainLanguageSession } from './editor-main-language-session.js';
import { createEditorMainScrollSession } from './editor-main-scroll-session.js';
import { createEditorMainServiceRegistry } from './editor-main-service-registry.js';
import { createEditorMainShellService } from './editor-main-shell-service.js';
import { createEditorMainRuntime } from './editor-main-runtime.js';
import { createEditorAppKernel } from './editor-app-kernel.js';

const FORCE_MARKDOWN_WRAP = true;

export function createEditorMainFeatures() {
  return [
    {
      name: 'editorMain.editor',
      requires: ['runtime', 'documentRef', 'dom'],
      provides: ['editor'],
      init(context) {
        const { runtime, documentRef, dom } = context;
        context.editor = createHiEditor(dom.textarea, 'markdown', false, {
          documentRef,
          windowRef: runtime.windowRef,
          setTimeoutRef: (handler, delay) => runtime.setTimer(handler, delay),
          getComputedStyle: (node) => runtime.getComputedStyle(node),
          getResizeObserver: () => runtime.getResizeObserver(),
          addDocumentListener: (type, handler, options) => runtime.onDocument(type, handler, options),
          addWindowListener: (type, handler, options) => runtime.onWindow(type, handler, options),
          writeClipboardText: (text) => runtime.writeClipboardText(text),
          editorRegistry: runtime.getHiEditorRegistry(),
          allowAmbient: false
        });
      }
    },
    {
      name: 'editorMain.metadataPanel',
      requires: ['runtime', 'documentRef', 'getContentRoot', 'appServices'],
      provides: ['metadataPanel'],
      init(context) {
        context.metadataPanel = context.appServices.setMetadataPanel(createEditorMainMetadataPanel({
          runtime: context.runtime,
          documentRef: context.documentRef,
          translate: t,
          getCurrentLang,
          normalizeLangKey,
          getContentRoot: context.getContentRoot,
          onChange: context.appServices.notifyDocumentChange
        }));
      }
    },
    {
      name: 'editorMain.linkCardContext',
      requires: ['runtime', 'getContentRoot'],
      provides: ['linkCardContext'],
      init(context) {
        context.linkCardContext = createEditorMainLinkCardContext({
          getCurrentLang,
          normalizeLangKey,
          getContentRoot: context.getContentRoot,
          fetch: (url, options) => context.runtime.fetchContent(url, options),
          translate: t,
          makeHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`)
        });
      }
    },
    {
      name: 'editorMain.shellService',
      requires: ['runtime', 'editor', 'dom'],
      provides: ['shellService'],
      init(context) {
        context.shellService = createEditorMainShellService({
          runtime: context.runtime,
          editor: context.editor,
          textarea: context.dom.textarea
        });
      }
    },
    {
      name: 'editorMain.workspaceSession',
      requires: ['runtime', 'documentRef', 'editor', 'dom', 'shellService', 'appServices'],
      provides: ['workspaceSession'],
      init(context) {
        context.workspaceSession = context.appServices.setWorkspaceSession(createEditorMainWorkspaceSession({
          runtime: context.runtime,
          documentRef: context.documentRef,
          forceMarkdownWrap: FORCE_MARKDOWN_WRAP,
          editor: context.editor,
          textarea: context.dom.textarea,
          getPreviewSession: context.appServices.getPreviewSession,
          getBlocksEditor: context.appServices.getBlocksEditor,
          syncBlocksFromSource: context.appServices.syncBlocksFromSource,
          requestLayout: context.shellService.requestLayout
        }));
      }
    },
    {
      name: 'editorMain.fileContextService',
      requires: ['workspaceSession', 'appServices'],
      provides: ['fileContextService'],
      init(context) {
        context.fileContextService = createEditorMainFileContextService({
          getCurrentFileSession: context.appServices.getCurrentFileSession,
          getMetadataPanel: context.appServices.getMetadataPanel,
          getPreviewSession: context.appServices.getPreviewSession,
          getDocumentSession: context.appServices.getDocumentSession
        });
      }
    },
    {
      name: 'editorMain.contentService',
      requires: ['runtime', 'getContentRoot', 'linkCardContext', 'fileContextService', 'appServices'],
      provides: ['contentService'],
      init(context) {
        context.contentService = context.appServices.setContentService(createEditorMainContentService({
          runtime: context.runtime,
          getContentRoot: context.getContentRoot,
          fetch: (url, options) => context.runtime.fetchContent(url, options),
          linkCardContext: context.linkCardContext,
          getPreviewSession: context.appServices.getPreviewSession,
          getDocumentSession: context.appServices.getDocumentSession,
          getWorkspaceSession: context.appServices.getWorkspaceSession,
          setCurrentFileLabel: context.fileContextService.setCurrentFileLabel,
          warn: (...args) => context.runtime.warn(...args),
          alert: (message) => context.runtime.showAlert(message)
        }));
      }
    },
    {
      name: 'editorMain.documentSession',
      requires: ['runtime', 'editor', 'dom', 'metadataPanel', 'workspaceSession', 'contentService', 'fileContextService', 'shellService', 'appServices'],
      provides: ['documentSession'],
      init(context) {
        context.documentSession = context.appServices.setDocumentSession(createEditorMainDocumentSession({
          runtime: context.runtime,
          editor: context.editor,
          textarea: context.dom.textarea,
          metadataPanel: context.metadataPanel,
          workspaceSession: context.workspaceSession,
          getPreviewSession: context.appServices.getPreviewSession,
          getBlocksSession: context.appServices.getBlocksSession,
          requestLayout: context.shellService.requestLayout,
          setBaseDir: context.contentService.setBaseDir,
          setCurrentFileLabel: context.fileContextService.setCurrentFileLabel
        }));
      }
    },
    {
      name: 'editorMain.currentFileSession',
      requires: ['runtime', 'documentRef', 'fileContextService', 'workspaceSession', 'documentSession', 'appServices'],
      provides: ['currentFileSession'],
      init(context) {
        context.currentFileSession = context.appServices.setCurrentFileSession(createEditorMainCurrentFileSession({
          runtime: context.runtime,
          documentRef: context.documentRef,
          translate: t,
          getCurrentLang,
          normalizeLangKey,
          inferCurrentFileSource: context.fileContextService.inferCurrentFileSource,
          applyEditorEmptyState: context.workspaceSession.applyEditorEmptyState,
          onRendered: context.fileContextService.handleCurrentFileRendered
        }));
      }
    },
    {
      name: 'editorMain.previewSession',
      requires: ['runtime', 'documentRef', 'getContentRoot', 'linkCardContext', 'fileContextService', 'appServices'],
      provides: ['previewSession'],
      init(context) {
        context.previewSession = context.appServices.setPreviewSession(createEditorMainPreviewSession({
          runtime: context.runtime,
          documentRef: context.documentRef,
          getContentRoot: context.getContentRoot,
          getEditorValue: context.appServices.getEditorValue,
          getCurrentFileInfo: context.fileContextService.getCurrentFileInfo,
          getSiteConfig: context.appServices.getSiteConfig,
          getPostsIndex: () => context.linkCardContext.getPostsIndex(),
          getPostsByLocationTitle: () => context.linkCardContext.getPostsByLocationTitle(),
          isLinkCardReady: () => context.linkCardContext.isReady(),
          getAllowedLocations: () => context.linkCardContext.getAllowedLocations(),
          getLocationAliases: () => context.linkCardContext.getLocationAliases(),
          consoleRef: {
            warn: (...args) => context.runtime.warn(...args)
          },
          fetch: (url, options) => context.runtime.fetchContent(url, options)
        }));
      }
    },
    {
      name: 'editorMain.imageSession',
      requires: ['runtime', 'dom', 'getContentRoot', 'documentSession', 'fileContextService', 'shellService', 'appServices'],
      provides: ['imageSession'],
      init(context) {
        context.imageSession = context.appServices.setImageSession(createEditorMainImageSession({
          runtime: context.runtime,
          translate: t,
          imageButton: context.dom.imageButton,
          imageInput: context.dom.imageInput,
          getCurrentMarkdownPath: context.fileContextService.getCurrentMarkdownPath,
          getContentRoot: context.getContentRoot,
          getEditorTextarea: context.documentSession.getEditorTextarea,
          getEditorBody: context.documentSession.getEditorBody,
          buildMarkdown: context.documentSession.buildMarkdown,
          setValue: context.documentSession.setValue,
          getBlocksEditor: context.appServices.getBlocksEditor,
          consoleRef: {
            error: (...args) => context.runtime.error(...args)
          },
          emitToast: context.shellService.emitToast
        }));
      }
    },
    {
      name: 'editorMain.blocksSession',
      requires: ['runtime', 'dom', 'getContentRoot', 'resolveEditorImageSrc', 'documentSession', 'fileContextService', 'previewSession', 'imageSession', 'linkCardContext', 'appServices'],
      provides: ['blocksSession'],
      init(context) {
        context.blocksSession = context.appServices.setBlocksSession(createEditorMainBlocksSession({
          runtime: context.runtime,
          root: context.dom.blocksWrap,
          translate: t,
          getContentRoot: context.getContentRoot,
          getEditorBody: context.documentSession.getEditorBody,
          onBodyChange: context.documentSession.setBodyFromBlocks,
          getCurrentMarkdownPath: context.fileContextService.getCurrentMarkdownPath,
          getSiteConfig: context.appServices.getSiteConfig,
          getPreviewSession: context.appServices.getPreviewSession,
          getImageSession: context.appServices.getImageSession,
          linkCardContext: context.linkCardContext,
          resolveImageSrc: context.resolveEditorImageSrc
        }));
      },
      dispose(context) {
        if (context.blocksSession && typeof context.blocksSession.dispose === 'function') {
          context.blocksSession.dispose();
        }
      }
    },
    {
      name: 'editorMain.toolbarSession',
      requires: ['runtime', 'documentRef', 'dom', 'documentSession', 'linkCardContext', 'appServices'],
      provides: ['toolbarSession'],
      init(context) {
        context.toolbarSession = context.appServices.setToolbarSession(createEditorMainToolbarSession({
          runtime: context.runtime,
          documentRef: context.documentRef,
          translate: t,
          getEditorTextarea: context.documentSession.getEditorTextarea,
          editorToolbarEl: context.dom.editorToolbarEl,
          cardButton: context.dom.cardButton,
          cardPopover: context.dom.cardPopover,
          cardSearchInput: context.dom.cardSearchInput,
          cardListEl: context.dom.cardListEl,
          cardEmptyEl: context.dom.cardEmptyEl,
          getCardEntries: () => context.linkCardContext.getCardEntries()
        }));
      }
    },
    {
      name: 'editorMain.languageSession',
      requires: ['runtime', 'toolbarSession', 'currentFileSession', 'blocksSession', 'metadataPanel', 'appServices'],
      provides: ['languageSession'],
      init(context) {
        context.languageSession = createEditorMainLanguageSession({
          runtime: context.runtime,
          getToolbarSession: context.appServices.getToolbarSession,
          getCurrentFileSession: context.appServices.getCurrentFileSession,
          getBlocksSession: context.appServices.getBlocksSession,
          getMetadataPanel: context.appServices.getMetadataPanel
        });
      }
    },
    {
      name: 'editorMain.workspaceBinding',
      requires: ['workspaceSession'],
      provides: ['workspaceBinding'],
      bind(context) {
        context.workspaceSession.initialize();
      }
    },
    {
      name: 'editorMain.previewBinding',
      requires: ['previewSession', 'workspaceBinding'],
      provides: ['previewBinding'],
      bind(context) {
        context.previewSession.bind();
      }
    },
    {
      name: 'editorMain.contentBinding',
      requires: ['contentService', 'previewBinding'],
      provides: ['contentBinding'],
      bind(context) {
        context.contentService.bind();
      }
    },
    {
      name: 'editorMain.blocksBinding',
      requires: ['blocksSession', 'contentBinding'],
      provides: ['blocksBinding'],
      bind(context) {
        context.blocksSession.initialize();
      }
    },
    {
      name: 'editorMain.toolbarBinding',
      requires: ['toolbarSession', 'blocksBinding'],
      provides: ['toolbarBinding'],
      bind(context) {
        context.toolbarSession.bind();
      }
    },
    {
      name: 'editorMain.languageBinding',
      requires: ['languageSession', 'toolbarBinding'],
      provides: ['languageBinding'],
      bind(context) {
        context.languageSession.bind();
      }
    },
    {
      name: 'editorMain.linkCardToolbarSync',
      requires: ['linkCardContext', 'toolbarSession', 'languageBinding'],
      provides: ['linkCardToolbarSync'],
      bind(context) {
        context.linkCardContext.onCardEntriesChange((entries) => context.toolbarSession.setCardEntries(entries));
        context.toolbarSession.setCardEntries(context.linkCardContext.getCardEntries());
      }
    },
    {
      name: 'editorMain.currentFileRender',
      requires: ['currentFileSession', 'previewBinding', 'linkCardToolbarSync'],
      provides: ['currentFileRender'],
      bind(context) {
        context.fileContextService.renderCurrentFile();
      }
    },
    {
      name: 'editorMain.documentInputBinding',
      requires: ['documentSession', 'currentFileRender'],
      provides: ['documentInputBinding'],
      bind(context) {
        context.documentSession.bindInput();
      }
    },
    {
      name: 'editorMain.initialDocumentState',
      requires: ['seed', 'documentInputBinding', 'contentService'],
      provides: ['initialDocumentState'],
      start(context) {
        context.documentSession.renderInitial(context.seed);
        context.contentService.setBaseDir('');
      }
    },
    {
      name: 'editorMain.imageBinding',
      requires: ['imageSession', 'initialDocumentState'],
      provides: ['imageBinding'],
      start(context) {
        context.imageSession.bind();
      }
    },
    {
      name: 'editorMain.primaryEditorApi',
      requires: ['documentSession', 'imageBinding'],
      provides: ['primaryEditorApi'],
      start(context) {
        context.documentSession.registerPrimaryEditorApi();
      }
    },
    {
      name: 'editorMain.defaultWorkspaceView',
      requires: ['workspaceSession', 'primaryEditorApi'],
      provides: ['defaultWorkspaceView'],
      start(context) {
        context.workspaceSession.setView('blocks');
      }
    },
    {
      name: 'editorMain.scrollSession',
      requires: ['runtime'],
      provides: ['scrollSession'],
      init(context) {
        context.scrollSession = createEditorMainScrollSession({ runtime: context.runtime });
      }
    },
    {
      name: 'editorMain.scrollBinding',
      requires: ['scrollSession', 'defaultWorkspaceView'],
      provides: ['scrollBinding'],
      start(context) {
        context.scrollSession.bind();
      }
    },
    {
      name: 'editorMain.sidebarSession',
      requires: ['runtime', 'documentRef', 'fileContextService', 'contentService'],
      provides: ['sidebarSession'],
      init(context) {
        context.sidebarSession = createEditorMainSidebarSession({
          runtime: context.runtime,
          documentRef: context.documentRef,
          normalizeLangKey,
          bindCurrentFileElement: context.fileContextService.bindCurrentFileElement,
          loadSiteConfig: context.contentService.loadSiteConfig,
          loadIndexData: context.contentService.loadIndexData,
          loadTabsConfig: context.contentService.loadTabsConfig,
          onSiteConfigLoaded: context.contentService.handleSiteConfigLoaded,
          onIndexLoaded: context.contentService.handleIndexLoaded,
          onOpenMarkdown: context.contentService.openMarkdown,
          onWarn: context.contentService.warn,
          alert: context.contentService.alert
        });
      }
    },
    {
      name: 'editorMain.sidebarStartup',
      requires: ['sidebarSession', 'scrollBinding'],
      provides: ['sidebarStartup'],
      start(context) {
        context.sidebarSession.initialize();
      }
    }
  ];
}

export function createEditorMainController(editorMainRuntime = createEditorMainRuntime()) {
  const editorMainDocument = editorMainRuntime.documentRef;
  const getContentRoot = () => editorMainRuntime.getContentRoot();
  const resolveEditorImageSrc = (src, baseDir) => resolveImageSrc(src, baseDir, {
    contentRoot: editorMainRuntime.getContentRoot(),
    origin: editorMainRuntime.getLocationOrigin()
  });

  // ---- Local draft storage removed (temporary) ----

  function start() {
    editorMainRuntime.onDocumentReady(() => {
      const kernel = createEditorAppKernel({
        name: 'editor-main',
        provides: ['runtime', 'documentRef', 'dom', 'appServices', 'getContentRoot', 'resolveEditorImageSrc', 'seed'],
        context: {
          runtime: editorMainRuntime,
          documentRef: editorMainDocument,
          getContentRoot,
          resolveEditorImageSrc,
          appServices: createEditorMainServiceRegistry(),
          dom: {
            textarea: editorMainRuntime.getElementById('mdInput'),
            imageButton: editorMainRuntime.getElementById('btnInsertImage'),
            imageInput: editorMainRuntime.getElementById('editorImageInput'),
            editorToolbarEl: editorMainRuntime.getElementById('editorToolbar'),
            blocksWrap: editorMainRuntime.getElementById('blocks-wrap'),
            cardButton: editorMainRuntime.getElementById('btnInsertCard'),
            cardPopover: editorMainRuntime.getElementById('editorCardPicker'),
            cardSearchInput: editorMainRuntime.getElementById('cardPickerSearch'),
            cardListEl: editorMainRuntime.getElementById('cardPickerList'),
            cardEmptyEl: editorMainRuntime.getElementById('cardPickerEmpty')
          },
          seed: `# 新文章标题\n\n> 在左侧编辑 Markdown，切换到 Preview 查看渲染效果。\n\n- 支持代码块、表格、待办列表\n- 图片与视频语法\n\n\`\`\`js\nconsole.log('Hello, Press!');\n\`\`\`\n`
        }
      });

      createEditorMainFeatures().forEach(feature => kernel.registerFeature(feature));
      kernel.run().catch((err) => {
        editorMainRuntime.error('Editor main lifecycle failed', err);
      });
    });
  }

  return { start };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  createEditorMainController().start();
}
