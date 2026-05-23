import { configureFetchCachePolicy } from './cache-control.js';
import { createMarkdownBlocksEditor } from './editor-blocks.js?v=press-system-v3.4.50';
import { createHiEditor } from './hieditor.js?v=press-system-v3.4.50';
import { normalizeLineEndings } from './frontmatter-document.js?v=press-system-v3.4.50';
import { getContentRoot, resolveImageSrc } from './safe-html.js?v=press-system-v3.4.50';
import { hydrateInternalLinkCards } from './link-cards.js?v=press-system-v3.4.50';
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
import { createEditorMainRuntime } from './editor-main-runtime.js?v=press-system-v3.4.50';

const FORCE_MARKDOWN_WRAP = true;
const editorMainRuntime = createEditorMainRuntime();

let markdownBlocksEditor = null;
let syncMarkdownBlocksFromSource = null;

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

  const changeListeners = new Set();
  const notifyChange = () => {
    const value = getValue();
    changeListeners.forEach((fn) => {
      try { fn(value); } catch (_) {}
    });
  };

  const metadataPanel = createEditorMainMetadataPanel({
    runtime: editorMainRuntime,
    documentRef: document,
    windowRef: window,
    translate: t,
    getCurrentLang,
    normalizeLangKey,
    getContentRoot,
    onChange: () => notifyChange()
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
  const workspaceSession = createEditorMainWorkspaceSession({
    runtime: editorMainRuntime,
    documentRef: document,
    forceMarkdownWrap: FORCE_MARKDOWN_WRAP,
    editor,
    textarea: ta,
    getPreviewSession: () => previewSession,
    getBlocksEditor: () => markdownBlocksEditor,
    syncBlocksFromSource: () => {
      if (typeof syncMarkdownBlocksFromSource === 'function') syncMarkdownBlocksFromSource();
    },
    requestLayout
  });
  workspaceSession.initialize();

  const getEditorBody = () => {
    if (editor) return editor.getValue() || '';
    if (ta) return ta.value || '';
    return '';
  };

  const getValue = () => {
    const body = getEditorBody();
    return metadataPanel.buildEditorValue(body);
  };

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
    getEditorValue: () => getValue(),
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

  const refreshPreview = () => {
    try { previewSession.render(getValue()); } catch (_) {}
  };

  editorMainRuntime.onSiteConfigChange((event) => {
    const detail = event && event.detail && typeof event.detail === 'object' ? event.detail : {};
    if (detail.siteConfig && typeof detail.siteConfig === 'object') {
      editorSiteConfig = detail.siteConfig;
      try { configureFetchCachePolicy(editorSiteConfig, { context: 'editor' }); } catch (_) {}
      previewSession.handleSiteConfigChange();
    }
  });

  const setValue = (value, opts = {}) => {
    const text = value == null ? '' : String(value);
    const { preview = true, notify = true } = opts;
    const bodyText = metadataPanel.setEditorValue(text, { silent: true });
    if (editor) editor.setValue(bodyText);
    else if (ta) ta.value = bodyText;
    requestLayout();
    if (markdownBlocksEditor && blocksWrap && !blocksWrap.hidden && typeof markdownBlocksEditor.setMarkdown === 'function') {
      try { markdownBlocksEditor.setMarkdown(bodyText); } catch (_) {}
    }
    if (preview) refreshPreview();
    if (notify) notifyChange();
  };

  const setBaseDir = (dir) => {
    const fallback = `${getContentRoot()}/`;
    editorMainRuntime.setEditorBaseDir(dir, fallback);
  };

  const blockLabelFallbacks = {
    toolbarAria: 'Block tools',
    listAria: 'Markdown blocks',
    virtualBlockAria: 'New block',
    virtualBlockPlaceholder: 'Type / to chose a block',
    commandMenuAria: 'Block selector',
    paragraph: 'Paragraph',
    heading: 'Heading',
    image: 'Image',
    list: 'List',
    quote: 'Quote',
    code: 'Code',
    math: 'Math',
    source: 'Markdown',
    articleCard: 'Article Card',
    uploadImage: 'Upload Image',
    cardSearch: 'Search articles...',
    cardEmpty: 'No matching articles',
    empty: 'No blocks yet.',
    actions: 'More actions',
    moveUp: 'Move up',
    moveDown: 'Move down',
    addBefore: 'Add before',
    addAfter: 'Add after',
    delete: 'Delete',
    imageAlt: 'Alt text',
    imagePath: 'Image path',
    replaceImage: 'Replace image',
    deleteImageResource: 'Delete resource',
    unordered: 'Bulleted',
    ordered: 'Numbered',
    task: 'Checklist',
    codeLanguage: 'Language',
    cardLabel: 'Card label',
    cardLocation: 'post/path/file.md',
    inlineToolbarAria: 'Inline formatting',
    inlineBold: 'Bold',
    inlineItalic: 'Italic',
    inlineStrike: 'Strikethrough',
    inlineCode: 'Inline code',
    inlineLink: 'Link',
    inlineMath: 'Math',
    inlineMore: 'More formatting',
    linkPrompt: 'Link URL',
    linkText: 'Link text',
    linkHref: 'Link URL',
    linkTitle: 'Link title',
    unlink: 'Unlink',
    mathSource: 'LaTeX source',
    removeMath: 'Remove',
    editMath: 'Edit math',
    listAddItem: 'Add item',
    listRemoveItem: 'Remove item',
    imageTitle: 'Image title',
    'sourceReason.blank': 'This empty Markdown segment is preserved as source.',
    'sourceReason.frontMatter': 'Front matter is preserved as raw Markdown so document metadata stays intact.',
    'sourceReason.unclosedFence': 'This fenced code block is incomplete, so it is kept as Markdown source.',
    'sourceReason.unclosedMath': 'This display math block is incomplete, so it is kept as Markdown source.',
    'sourceReason.callout': 'This block uses callout-style Markdown that the visual block editor does not edit directly.',
    'sourceReason.table': 'This table-like Markdown is kept as source because the visual block editor does not support table editing yet.',
    'sourceReason.indentedList': 'This list starts with indentation, so it is kept as source to avoid changing whether it means a nested list or code-like Markdown.',
    'sourceReason.mixedList': 'This list starts from an unsupported mixed indentation, so it is kept as Markdown source.',
    'sourceReason.image': 'This paragraph contains inline image Markdown, so it is kept as source to avoid changing the mixed content.',
    'sourceReason.rawHtml': 'This paragraph contains raw HTML outside inline code, so it is kept as Markdown source.',
    'sourceReason.unsupported': 'This Markdown is kept as source because the block editor cannot safely convert it to a visual block without changing the original structure.',
    'sourceAutofix.label': 'Autofix',
    'sourceAutofix.indentedList': 'Autofix: remove the shared list indentation and convert this Markdown into a visual list block.',
    'sourceAutofix.unsupported': 'Autofix'
  };
  const blockLabels = new Proxy({}, {
    get: (_target, key) => {
      const name = String(key || '');
      const translationKey = `editor.blocks.${name}`;
      const translated = t(translationKey);
      return translated != null && translated !== translationKey ? translated : (blockLabelFallbacks[name] || name);
    }
  });
  const setEditorBodyFromBlocks = (body) => {
    const text = body == null ? '' : String(body);
    if (editor) editor.setValue(text);
    else if (ta) ta.value = text;
    requestLayout();
    refreshPreview();
    notifyChange();
  };

  const getEditorTextarea = () => {
    if (editor && editor.textarea) return editor.textarea;
    return ta;
  };

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
    getEditorTextarea,
    getEditorBody,
    buildMarkdown: (body) => metadataPanel.buildMarkdown(body),
    setValue,
    getBlocksEditor: () => markdownBlocksEditor,
    emitToast: emitEditorToast
  });

  if (blocksWrap) {
    markdownBlocksEditor = createMarkdownBlocksEditor(blocksWrap, {
      labels: blockLabels,
      onChange: setEditorBodyFromBlocks,
      getBaseDir: () => editorMainRuntime.getEditorBaseDir(`${getContentRoot()}/`),
      resolveImageSrc,
      hydrateImages: (node) => {
        try { previewSession.applyAssetOverrides(node, getCurrentMarkdownPath()); } catch (_) {}
      },
      hydrateCard: (node) => {
        try {
          hydrateInternalLinkCards(node, linkCardContext.createHydrateOptions({
            siteConfig: editorSiteConfig,
            translate: t
          }));
          previewSession.applyAssetOverrides(node, getCurrentMarkdownPath());
        } catch (_) {}
      },
      requestImageUpload: (detail) => imageSession.requestBlocksImageUpload(detail),
      canDeleteImageResource: (src) => imageSession.canDeleteImageResource(src),
      requestImageDelete: (detail) => imageSession.requestBlocksImageDelete(detail)
    });
    syncMarkdownBlocksFromSource = () => {
      if (markdownBlocksEditor && typeof markdownBlocksEditor.setMarkdown === 'function') {
        markdownBlocksEditor.setMarkdown(getEditorBody());
      }
    };
  }

  const toolbarSession = createEditorMainToolbarSession({
    runtime: editorMainRuntime,
    documentRef: document,
    windowRef: window,
    translate: t,
    getEditorTextarea,
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
    if (markdownBlocksEditor && typeof markdownBlocksEditor.requestLayout === 'function') {
      try { markdownBlocksEditor.requestLayout(); } catch (_) {}
    }
    metadataPanel.syncLanguage();
  });

  const handleBlocksCardContextUpdate = (entries) => {
    if (!markdownBlocksEditor || typeof markdownBlocksEditor.setCardEntries !== 'function') return;
    markdownBlocksEditor.setCardEntries(Array.isArray(entries) ? entries : linkCardContext.getCardEntries());
  };
  linkCardContext.onCardEntriesChange((entries) => toolbarSession.setCardEntries(entries));
  linkCardContext.onCardEntriesChange(handleBlocksCardContextUpdate);
  toolbarSession.setCardEntries(linkCardContext.getCardEntries());
  handleBlocksCardContextUpdate(linkCardContext.getCardEntries());

  const bindCurrentFileElement = (el) => {
    currentFileSession.bindElement(el);
  };

  const assignCurrentFileLabel = (input) => {
    const info = currentFileSession.set(input);
    metadataPanel.applyCurrentFileSource(info.source);
    previewSession.setCurrentFileInfo(info);
    previewSession.refreshAssetOverrides();
    refreshPreview();
  };

  currentFileSession.render();

  const handleInput = () => {
    const full = getValue();
    previewSession.render(full);
    notifyChange();
  };

  if (editor && editor.textarea) editor.textarea.addEventListener('input', handleInput);
  else if (ta) ta.addEventListener('input', handleInput);

  // If empty, seed default text; otherwise render current content once.
  const initial = (getValue() || '').trim();
  if (!initial) {
    setValue(seed, { notify: false });
  } else {
    previewSession.render(initial);
  }

  setBaseDir('');
  imageSession.bind();

  const primaryEditorApi = {
    getValue,
    setValue: (value, opts = {}) => setValue(value, opts),
    focus: () => {
      try {
        if (editor && typeof editor.focus === 'function') editor.focus();
        else if (ta && typeof ta.focus === 'function') ta.focus();
      } catch (_) {}
    },
    setView: (mode, opts = {}) => workspaceSession.setView(mode, opts),
    restorePersistedView: (opts = {}) => workspaceSession.restorePersistedView(opts),
    getView: () => workspaceSession.getView(),
    setBaseDir: (dir) => setBaseDir(dir),
    setCurrentFileLabel: (label) => assignCurrentFileLabel(label),
    setFrontMatterVisible: (visible) => metadataPanel.setFrontMatterVisible(visible),
    setTabsMetadata: (value, opts = {}) => metadataPanel.setTabsMetadata(value, opts),
    onChange: (fn) => {
      if (typeof fn !== 'function') return () => {};
      changeListeners.add(fn);
      return () => { changeListeners.delete(fn); };
    },
    onTabsMetadataChange: (fn) => {
      return metadataPanel.onTabsMetadataChange(fn);
    },
    refreshPreview: () => { refreshPreview(); },
    requestLayout: () => { requestLayout(); },
    setWrap: (value, opts = {}) => { workspaceSession.setWrap(value, opts); },
    isWrapEnabled: () => workspaceSession.isWrapEnabled()
  };

  editorMainRuntime.registerPrimaryEditorApi(primaryEditorApi);

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
      if (linkCardContext.isReady()) refreshPreview();
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
      setValue(text);
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
