import { createHiEditor } from './hieditor.js?v=press-system-v3.4.50';
import { normalizeLineEndings } from './frontmatter-document.js?v=press-system-v3.4.50';
import { getContentRoot, resolveImageSrc } from './safe-html.js?v=press-system-v3.4.50';
import { t, withLangParam, getCurrentLang, normalizeLangKey } from './i18n.js?v=press-system-v3.4.50';
import { createEditorMainMetadataPanel } from './editor-main-metadata-panel.js?v=press-system-v3.4.50';
import { createEditorMainPreviewSession } from './editor-main-preview-session.js?v=press-system-v3.4.50';
import { createEditorMainCurrentFileSession } from './editor-main-current-file-session.js?v=press-system-v3.4.50';
import { createEditorMainSidebarSession } from './editor-main-sidebar-session.js?v=press-system-v3.4.50';
import { createEditorMainToolbarSession } from './editor-main-toolbar-session.js?v=press-system-v3.4.50';
import { createEditorMainImageSession } from './editor-main-image-session.js?v=press-system-v3.4.50';
import { createEditorMainLinkCardContext } from './editor-main-link-card-context.js?v=press-system-v3.4.50';
import { createEditorMainWorkspaceSession } from './editor-main-workspace-session.js?v=press-system-v3.4.50';
import { createEditorMainBlocksSession } from './editor-main-blocks-session.js?v=press-system-v3.4.50';
import { createEditorMainDocumentSession } from './editor-main-document-session.js?v=press-system-v3.4.50';
import { createEditorMainContentService } from './editor-main-content-service.js?v=press-system-v3.4.50';
import { createEditorMainFileContextService } from './editor-main-file-context-service.js?v=press-system-v3.4.50';
import { createEditorMainLanguageSession } from './editor-main-language-session.js?v=press-system-v3.4.50';
import { createEditorMainScrollSession } from './editor-main-scroll-session.js?v=press-system-v3.4.50';
import { createEditorMainServiceRegistry } from './editor-main-service-registry.js?v=press-system-v3.4.50';
import { createEditorMainShellService } from './editor-main-shell-service.js?v=press-system-v3.4.50';
import { createEditorMainRuntime } from './editor-main-runtime.js?v=press-system-v3.4.50';

const FORCE_MARKDOWN_WRAP = true;
const editorMainRuntime = createEditorMainRuntime();
const editorMainDocument = editorMainRuntime.documentRef;

// ---- Local draft storage removed (temporary) ----

editorMainRuntime.onDocumentReady(() => {
  const ta = editorMainRuntime.getElementById('mdInput');
  const editor = createHiEditor(ta, 'markdown', false);
  const imageButton = editorMainRuntime.getElementById('btnInsertImage');
  const imageInput = editorMainRuntime.getElementById('editorImageInput');
  const editorToolbarEl = editorMainRuntime.getElementById('editorToolbar');
  const blocksWrap = editorMainRuntime.getElementById('blocks-wrap');
  const cardButton = editorMainRuntime.getElementById('btnInsertCard');
  const cardPopover = editorMainRuntime.getElementById('editorCardPicker');
  const cardSearchInput = editorMainRuntime.getElementById('cardPickerSearch');
  const cardListEl = editorMainRuntime.getElementById('cardPickerList');
  const cardEmptyEl = editorMainRuntime.getElementById('cardPickerEmpty');

  const seed = `# 新文章标题\n\n> 在左侧编辑 Markdown，切换到 Preview 查看渲染效果。\n\n- 支持代码块、表格、待办列表\n- 图片与视频语法\n\n\`\`\`js\nconsole.log('Hello, Press!');\n\`\`\`\n`;

  const appServices = createEditorMainServiceRegistry();

  const metadataPanel = appServices.setMetadataPanel(createEditorMainMetadataPanel({
    runtime: editorMainRuntime,
    documentRef: editorMainDocument,
    translate: t,
    getCurrentLang,
    normalizeLangKey,
    getContentRoot,
    onChange: appServices.notifyDocumentChange
  }));

  const linkCardContext = createEditorMainLinkCardContext({
    getCurrentLang,
    normalizeLangKey,
    getContentRoot,
    fetch: (url, options) => editorMainRuntime.fetchContent(url, options),
    translate: t,
    makeHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`)
  });

  const shellService = createEditorMainShellService({
    runtime: editorMainRuntime,
    editor,
    textarea: ta
  });

  const workspaceSession = appServices.setWorkspaceSession(createEditorMainWorkspaceSession({
    runtime: editorMainRuntime,
    documentRef: editorMainDocument,
    forceMarkdownWrap: FORCE_MARKDOWN_WRAP,
    editor,
    textarea: ta,
    getPreviewSession: appServices.getPreviewSession,
    getBlocksEditor: appServices.getBlocksEditor,
    syncBlocksFromSource: appServices.syncBlocksFromSource,
    requestLayout: shellService.requestLayout
  }));
  workspaceSession.initialize();

  const fileContextService = createEditorMainFileContextService({
    getCurrentFileSession: appServices.getCurrentFileSession,
    getMetadataPanel: appServices.getMetadataPanel,
    getPreviewSession: appServices.getPreviewSession,
    getDocumentSession: appServices.getDocumentSession
  });

  const contentService = appServices.setContentService(createEditorMainContentService({
    runtime: editorMainRuntime,
    getContentRoot,
    fetch: (url, options) => editorMainRuntime.fetchContent(url, options),
    linkCardContext,
    getPreviewSession: appServices.getPreviewSession,
    getDocumentSession: appServices.getDocumentSession,
    getWorkspaceSession: appServices.getWorkspaceSession,
    setCurrentFileLabel: fileContextService.setCurrentFileLabel,
    warn: (...args) => editorMainRuntime.warn(...args),
    alert: (message) => editorMainRuntime.showAlert(message)
  }));

  const documentSession = appServices.setDocumentSession(createEditorMainDocumentSession({
    runtime: editorMainRuntime,
    editor,
    textarea: ta,
    metadataPanel,
    workspaceSession,
    getPreviewSession: appServices.getPreviewSession,
    getBlocksSession: appServices.getBlocksSession,
    requestLayout: shellService.requestLayout,
    setBaseDir: contentService.setBaseDir,
    setCurrentFileLabel: fileContextService.setCurrentFileLabel
  }));

  const currentFileSession = appServices.setCurrentFileSession(createEditorMainCurrentFileSession({
    runtime: editorMainRuntime,
    documentRef: editorMainDocument,
    translate: t,
    getCurrentLang,
    normalizeLangKey,
    inferCurrentFileSource: fileContextService.inferCurrentFileSource,
    applyEditorEmptyState: workspaceSession.applyEditorEmptyState,
    onRendered: fileContextService.handleCurrentFileRendered
  }));

  const previewSession = appServices.setPreviewSession(createEditorMainPreviewSession({
    runtime: editorMainRuntime,
    documentRef: editorMainDocument,
    getContentRoot,
    getEditorValue: appServices.getEditorValue,
    getCurrentFileInfo: fileContextService.getCurrentFileInfo,
    getSiteConfig: appServices.getSiteConfig,
    getPostsIndex: () => linkCardContext.getPostsIndex(),
    getPostsByLocationTitle: () => linkCardContext.getPostsByLocationTitle(),
    isLinkCardReady: () => linkCardContext.isReady(),
    getAllowedLocations: () => linkCardContext.getAllowedLocations(),
    getLocationAliases: () => linkCardContext.getLocationAliases(),
    consoleRef: {
      warn: (...args) => editorMainRuntime.warn(...args)
    },
    fetch: (url, options) => editorMainRuntime.fetchContent(url, options)
  }));
  previewSession.bind();
  contentService.bind();

  const imageSession = appServices.setImageSession(createEditorMainImageSession({
    runtime: editorMainRuntime,
    translate: t,
    imageButton,
    imageInput,
    getCurrentMarkdownPath: fileContextService.getCurrentMarkdownPath,
    getContentRoot,
    getEditorTextarea: documentSession.getEditorTextarea,
    getEditorBody: documentSession.getEditorBody,
    buildMarkdown: documentSession.buildMarkdown,
    setValue: documentSession.setValue,
    getBlocksEditor: appServices.getBlocksEditor,
    consoleRef: {
      error: (...args) => editorMainRuntime.error(...args)
    },
    emitToast: shellService.emitToast
  }));

  const blocksSession = appServices.setBlocksSession(createEditorMainBlocksSession({
    runtime: editorMainRuntime,
    root: blocksWrap,
    translate: t,
    getContentRoot,
    getEditorBody: documentSession.getEditorBody,
    onBodyChange: documentSession.setBodyFromBlocks,
    getCurrentMarkdownPath: fileContextService.getCurrentMarkdownPath,
    getSiteConfig: appServices.getSiteConfig,
    getPreviewSession: appServices.getPreviewSession,
    getImageSession: appServices.getImageSession,
    linkCardContext,
    resolveImageSrc
  }));
  blocksSession.initialize();

  const toolbarSession = appServices.setToolbarSession(createEditorMainToolbarSession({
    runtime: editorMainRuntime,
    documentRef: editorMainDocument,
    translate: t,
    getEditorTextarea: documentSession.getEditorTextarea,
    editorToolbarEl,
    cardButton,
    cardPopover,
    cardSearchInput,
    cardListEl,
    cardEmptyEl,
    getCardEntries: () => linkCardContext.getCardEntries()
  }));
  toolbarSession.bind();

  const languageSession = createEditorMainLanguageSession({
    runtime: editorMainRuntime,
    getToolbarSession: appServices.getToolbarSession,
    getCurrentFileSession: appServices.getCurrentFileSession,
    getBlocksSession: appServices.getBlocksSession,
    getMetadataPanel: appServices.getMetadataPanel
  });
  languageSession.bind();

  linkCardContext.onCardEntriesChange((entries) => toolbarSession.setCardEntries(entries));
  toolbarSession.setCardEntries(linkCardContext.getCardEntries());

  fileContextService.renderCurrentFile();
  documentSession.bindInput();

  // If empty, seed default text; otherwise render current content once.
  documentSession.renderInitial(seed);

  contentService.setBaseDir('');
  imageSession.bind();
  documentSession.registerPrimaryEditorApi();

  // Clear draft action removed (no local storage drafts)

  // Draft persistence on unload removed

  // Default to blocks view
  workspaceSession.setView('blocks');

  const scrollSession = createEditorMainScrollSession({ runtime: editorMainRuntime });
  scrollSession.bind();

  const sidebarSession = createEditorMainSidebarSession({
    runtime: editorMainRuntime,
    documentRef: editorMainDocument,
    normalizeLangKey,
    bindCurrentFileElement: fileContextService.bindCurrentFileElement,
    loadSiteConfig: contentService.loadSiteConfig,
    loadIndexData: contentService.loadIndexData,
    loadTabsConfig: contentService.loadTabsConfig,
    onSiteConfigLoaded: contentService.handleSiteConfigLoaded,
    onIndexLoaded: contentService.handleIndexLoaded,
    onOpenMarkdown: contentService.openMarkdown,
    onWarn: contentService.warn,
    alert: contentService.alert
  });
  sidebarSession.initialize();
});
