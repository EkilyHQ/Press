import { configureFetchCachePolicy } from './cache-control.js';
import { createHiEditor } from './hieditor.js?v=press-system-v3.4.50';
import { normalizeLineEndings } from './frontmatter-document.js?v=press-system-v3.4.50';
import { getContentRoot, resolveImageSrc } from './safe-html.js?v=press-system-v3.4.50';
import { fetchConfigWithYamlFallback, fetchMergedSiteConfig } from './yaml.js';
import { t, withLangParam, loadContentJsonWithRaw, getCurrentLang, normalizeLangKey } from './i18n.js?v=press-system-v3.4.50';
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
import { createEditorMainRuntime } from './editor-main-runtime.js?v=press-system-v3.4.50';

const FORCE_MARKDOWN_WRAP = true;
const editorMainRuntime = createEditorMainRuntime();

let editorSiteConfig = {};

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

  const inferCurrentFileSource = (path) => metadataPanel.inferCurrentFileSource(path);

  const setBaseDir = (dir) => {
    const fallback = `${getContentRoot()}/`;
    editorMainRuntime.setEditorBaseDir(dir, fallback);
  };

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

  documentSession = createEditorMainDocumentSession({
    runtime: editorMainRuntime,
    editor,
    textarea: ta,
    metadataPanel,
    workspaceSession,
    getPreviewSession: () => previewSession,
    getBlocksSession: () => blocksSession,
    requestLayout,
    setBaseDir,
    setCurrentFileLabel: (label) => assignCurrentFileLabel(label)
  });

  const currentFileSession = createEditorMainCurrentFileSession({
    runtime: editorMainRuntime,
    documentRef: document,
    translate: t,
    getCurrentLang,
    normalizeLangKey,
    inferCurrentFileSource,
    applyEditorEmptyState: workspaceSession.applyEditorEmptyState,
    onRendered: () => {
      if (previewSession) previewSession.updatePathLabel();
    }
  });

  previewSession = createEditorMainPreviewSession({
    runtime: editorMainRuntime,
    documentRef: document,
    windowRef: window,
    getContentRoot,
    getEditorValue: () => documentSession.getValue(),
    getCurrentFileInfo: () => currentFileSession.getInfo(),
    getSiteConfig: () => editorSiteConfig || {},
    getPostsIndex: () => linkCardContext.getPostsIndex(),
    getPostsByLocationTitle: () => linkCardContext.getPostsByLocationTitle(),
    isLinkCardReady: () => linkCardContext.isReady(),
    getAllowedLocations: () => linkCardContext.getAllowedLocations(),
    getLocationAliases: () => linkCardContext.getLocationAliases(),
    fetch
  });
  previewSession.bind();

  editorMainRuntime.onSiteConfigChange((event) => {
    const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : {};
    if (detail.siteConfig && typeof detail.siteConfig === 'object') {
      editorSiteConfig = detail.siteConfig;
      try { configureFetchCachePolicy(editorSiteConfig, { context: 'editor' }); } catch (_) {}
      previewSession.handleSiteConfigChange();
    }
  });

  const getCurrentMarkdownPath = () => {
    return currentFileSession.getPath();
  };

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
    getCurrentMarkdownPath,
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
    getCurrentMarkdownPath,
    getSiteConfig: () => editorSiteConfig || {},
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

  editorMainRuntime.onDocument('press-editor-language-applied', () => {
    toolbarSession.syncLanguage();
    currentFileSession.render();
    blocksSession.requestLayout();
    metadataPanel.syncLanguage();
  });

  linkCardContext.onCardEntriesChange((entries) => toolbarSession.setCardEntries(entries));
  toolbarSession.setCardEntries(linkCardContext.getCardEntries());

  const bindCurrentFileElement = (el) => {
    currentFileSession.bindElement(el);
  };

  const assignCurrentFileLabel = (input) => {
    const info = currentFileSession.set(input);
    metadataPanel.applyCurrentFileSource(info.source);
    previewSession.setCurrentFileInfo(info);
    previewSession.refreshAssetOverrides();
    documentSession.refreshPreview();
  };

  currentFileSession.render();
  documentSession.bindInput();

  // If empty, seed default text; otherwise render current content once.
  documentSession.renderInitial(seed);

  setBaseDir('');
  imageSession.bind();
  documentSession.registerPrimaryEditorApi();

  // Clear draft action removed (no local storage drafts)

  // Draft persistence on unload removed

  // Default to blocks view
  workspaceSession.setView('blocks');

  // Back-to-top button behavior
  (function initBackToTop() {
    const btn = editorMainRuntime.getElementById('backToTop');
    if (!btn) return;
    try { btn.hidden = false; } catch (_) {}
    const threshold = 260;
    const toggle = () => {
      const documentElement = editorMainRuntime.getDocumentElement();
      const y = editorMainRuntime.getPageYOffset() || (documentElement && documentElement.scrollTop) || 0;
      if (y > threshold) btn.classList.add('show');
      else btn.classList.remove('show');
    };
    editorMainRuntime.onWindow('scroll', toggle, { passive: true });
    btn.addEventListener('click', () => {
      editorMainRuntime.scrollToTop({ smooth: true });
    });
    toggle();
  })();

  const sidebarSession = createEditorMainSidebarSession({
    runtime: editorMainRuntime,
    documentRef: document,
    windowRef: window,
    normalizeLangKey,
    bindCurrentFileElement,
    loadSiteConfig: () => fetchMergedSiteConfig(),
    loadIndexData: (contentRoot) => loadContentJsonWithRaw(contentRoot, 'index'),
    loadTabsConfig: (contentRoot) => fetchConfigWithYamlFallback([`${contentRoot}/tabs.yaml`, `${contentRoot}/tabs.yml`]),
    onSiteConfigLoaded: ({ siteConfig, contentRoot }) => {
      editorSiteConfig = siteConfig || {};
      try { configureFetchCachePolicy(editorSiteConfig, { context: 'editor' }); } catch (_) {}
      previewSession.handleSiteConfigChange();
      editorMainRuntime.setContentRoot(contentRoot);
      editorMainRuntime.setEditorBaseDir(`${contentRoot}/`, `${contentRoot}/`);
    },
    onIndexLoaded: ({ posts, rawIndex }) => {
      linkCardContext.rebuild(posts, rawIndex);
      if (linkCardContext.isReady()) documentSession.refreshPreview();
    },
    onOpenMarkdown: async ({ relPath, url, contentRoot }) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      try {
        const lastSlash = relPath.lastIndexOf('/');
        const dir = lastSlash >= 0 ? relPath.slice(0, lastSlash + 1) : '';
        const base = `${contentRoot}/${dir}`.replace(/\\+/g, '/');
        setBaseDir(base);
      } catch (_) {
        setBaseDir(`${contentRoot}/`);
      }
      documentSession.setValue(text);
      assignCurrentFileLabel(`${relPath}`);
      workspaceSession.setView('edit');
      editorMainRuntime.scrollToTop({ smooth: true });
    },
    onWarn: (...args) => {
      try { console.warn(...args); } catch (_) {}
    },
    alert: (message) => {
      try { window.alert(message); } catch (_) {}
    }
  });
  sidebarSession.initialize();
});
