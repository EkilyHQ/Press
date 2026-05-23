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
import { createEditorMainRuntime } from './editor-main-runtime.js?v=press-system-v3.4.50';

const FORCE_MARKDOWN_WRAP = true;
const editorMainRuntime = createEditorMainRuntime();

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

  let documentSession = null;
  const notifyDocumentChange = () => {
    if (documentSession) documentSession.notifyChange();
  };

  const metadataPanel = createEditorMainMetadataPanel({
    runtime: editorMainRuntime,
    documentRef: document,
    windowRef: window,
    translate: t,
    getCurrentLang,
    normalizeLangKey,
    getContentRoot,
    onChange: notifyDocumentChange
  });

  const linkCardContext = createEditorMainLinkCardContext({
    getCurrentLang,
    normalizeLangKey,
    getContentRoot,
    fetch,
    translate: t,
    makeHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`)
  });

  const requestLayout = () => {
    try {
      if (editor && typeof editor.refreshLayout === 'function') {
        editor.refreshLayout();
        return;
      }
      if (!ta) return;
      ta.style.height = '0px';
      // eslint-disable-next-line no-unused-expressions
      ta.offsetHeight;
      ta.style.height = `${ta.scrollHeight}px`;
    } catch (_) {}
  };

  let previewSession = null;
  let blocksSession = null;
  let currentFileSession = null;
  const workspaceSession = createEditorMainWorkspaceSession({
    runtime: editorMainRuntime,
    documentRef: document,
    forceMarkdownWrap: FORCE_MARKDOWN_WRAP,
    editor,
    textarea: ta,
    getPreviewSession: () => previewSession,
    getBlocksEditor: () => blocksSession && blocksSession.getEditor(),
    syncBlocksFromSource: () => { if (blocksSession) blocksSession.syncFromSource(); },
    requestLayout
  });
  workspaceSession.initialize();

  const fileContextService = createEditorMainFileContextService({
    getCurrentFileSession: () => currentFileSession,
    getMetadataPanel: () => metadataPanel,
    getPreviewSession: () => previewSession,
    getDocumentSession: () => documentSession
  });

  const contentService = createEditorMainContentService({
    runtime: editorMainRuntime,
    getContentRoot,
    fetch,
    linkCardContext,
    getPreviewSession: () => previewSession,
    getDocumentSession: () => documentSession,
    getWorkspaceSession: () => workspaceSession,
    setCurrentFileLabel: fileContextService.setCurrentFileLabel,
    warn: (...args) => {
      try { console.warn(...args); } catch (_) {}
    },
    alert: (message) => {
      try { window.alert(message); } catch (_) {}
    }
  });

  documentSession = createEditorMainDocumentSession({
    runtime: editorMainRuntime,
    editor,
    textarea: ta,
    metadataPanel,
    workspaceSession,
    getPreviewSession: () => previewSession,
    getBlocksSession: () => blocksSession,
    requestLayout,
    setBaseDir: contentService.setBaseDir,
    setCurrentFileLabel: fileContextService.setCurrentFileLabel
  });

  currentFileSession = createEditorMainCurrentFileSession({
    runtime: editorMainRuntime,
    documentRef: document,
    translate: t,
    getCurrentLang,
    normalizeLangKey,
    inferCurrentFileSource: fileContextService.inferCurrentFileSource,
    applyEditorEmptyState: workspaceSession.applyEditorEmptyState,
    onRendered: fileContextService.handleCurrentFileRendered
  });

  previewSession = createEditorMainPreviewSession({
    runtime: editorMainRuntime,
    documentRef: document,
    windowRef: window,
    getContentRoot,
    getEditorValue: () => documentSession.getValue(),
    getCurrentFileInfo: fileContextService.getCurrentFileInfo,
    getSiteConfig: () => contentService.getSiteConfig(),
    getPostsIndex: () => linkCardContext.getPostsIndex(),
    getPostsByLocationTitle: () => linkCardContext.getPostsByLocationTitle(),
    isLinkCardReady: () => linkCardContext.isReady(),
    getAllowedLocations: () => linkCardContext.getAllowedLocations(),
    getLocationAliases: () => linkCardContext.getLocationAliases(),
    fetch
  });
  previewSession.bind();
  contentService.bind();

  const emitEditorToast = (kind, message) => {
    const text = message == null ? '' : String(message);
    if (!text) return;
    editorMainRuntime.emitToast(kind, text);
  };

  const imageSession = createEditorMainImageSession({
    runtime: editorMainRuntime,
    windowRef: window,
    translate: t,
    imageButton,
    imageInput,
    getCurrentMarkdownPath: fileContextService.getCurrentMarkdownPath,
    getContentRoot,
    getEditorTextarea: documentSession.getEditorTextarea,
    getEditorBody: documentSession.getEditorBody,
    buildMarkdown: documentSession.buildMarkdown,
    setValue: documentSession.setValue,
    getBlocksEditor: () => blocksSession && blocksSession.getEditor(),
    emitToast: emitEditorToast
  });

  blocksSession = createEditorMainBlocksSession({
    runtime: editorMainRuntime,
    root: blocksWrap,
    translate: t,
    getContentRoot,
    getEditorBody: documentSession.getEditorBody,
    onBodyChange: documentSession.setBodyFromBlocks,
    getCurrentMarkdownPath: fileContextService.getCurrentMarkdownPath,
    getSiteConfig: () => contentService.getSiteConfig(),
    getPreviewSession: () => previewSession,
    getImageSession: () => imageSession,
    linkCardContext,
    resolveImageSrc
  });
  blocksSession.initialize();

  const toolbarSession = createEditorMainToolbarSession({
    runtime: editorMainRuntime,
    documentRef: document,
    windowRef: window,
    translate: t,
    getEditorTextarea: documentSession.getEditorTextarea,
    editorToolbarEl,
    cardButton,
    cardPopover,
    cardSearchInput,
    cardListEl,
    cardEmptyEl,
    getCardEntries: () => linkCardContext.getCardEntries()
  });
  toolbarSession.bind();

  const languageSession = createEditorMainLanguageSession({
    runtime: editorMainRuntime,
    getToolbarSession: () => toolbarSession,
    getCurrentFileSession: () => currentFileSession,
    getBlocksSession: () => blocksSession,
    getMetadataPanel: () => metadataPanel
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
    documentRef: document,
    windowRef: window,
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
