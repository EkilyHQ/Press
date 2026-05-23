import { configureFetchCachePolicy } from './cache-control.js';
import { createMarkdownBlocksEditor } from './editor-blocks.js?v=press-system-v3.4.50';
import { createHiEditor } from './hieditor.js?v=press-system-v3.4.50';
import { insertImageMarkdownAtSelection } from './editor-markdown-ops.js';
import { normalizeLineEndings } from './frontmatter-document.js?v=press-system-v3.4.50';
import { getContentRoot, resolveImageSrc } from './safe-html.js?v=press-system-v3.4.50';
import { hydrateInternalLinkCards } from './link-cards.js?v=press-system-v3.4.50';
import { fetchConfigWithYamlFallback, fetchMergedSiteConfig } from './yaml.js';
import { t, withLangParam, loadContentJsonWithRaw, getCurrentLang, normalizeLangKey } from './i18n.js?v=press-system-v3.4.50';
import { resolveLocalMarkdownAssetReference } from './repository-deletions.js?v=press-system-v3.4.50';
import { createEditorMainMetadataPanel } from './editor-main-metadata-panel.js?v=press-system-v3.4.50';
import { createEditorMainPreviewSession } from './editor-main-preview-session.js?v=press-system-v3.4.50';
import { createEditorMainCurrentFileSession } from './editor-main-current-file-session.js?v=press-system-v3.4.50';
import {
  createEditorMainRuntime,
  normalizeMarkdownEditorView
} from './editor-main-runtime.js?v=press-system-v3.4.50';

const FORCE_MARKDOWN_WRAP = true;
const editorMainRuntime = createEditorMainRuntime();

function readPersistedMarkdownEditorView() {
  return editorMainRuntime.readMarkdownEditorView();
}

function persistMarkdownEditorView(mode) {
  editorMainRuntime.persistMarkdownEditorView(mode);
}

let markdownBlocksEditor = null;
let syncMarkdownBlocksFromSource = null;

const fetchMarkdownForLinkCard = (loc) => {
  try {
    const url = `${getContentRoot()}/${loc}`;
    return fetch(url, { cache: 'no-store' }).then(resp => (resp && resp.ok) ? resp.text() : '');
  } catch (_) {
    return Promise.resolve('');
  }
};

let editorSiteConfig = {};
let editorPostsIndexCache = {};
let editorAllowedLocations = null;
let editorLocationAliasMap = new Map();
let editorPostsByLocationTitle = {};
let linkCardReady = false;
let editorPostPickerEntries = [];
const editorLinkCardContextListeners = new Set();

function rebuildLinkCardContext(posts, rawIndex) {
  try {
    const allowed = new Set();
    if (posts && typeof posts === 'object') {
      Object.values(posts).forEach(meta => {
        if (!meta) return;
        if (meta.location) allowed.add(String(meta.location));
        if (Array.isArray(meta.versions)) {
          meta.versions.forEach(ver => { if (ver && ver.location) allowed.add(String(ver.location)); });
        }
      });
    }
    if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
      for (const entry of Object.values(rawIndex)) {
        if (!entry || typeof entry !== 'object') continue;
        for (const [key, val] of Object.entries(entry)) {
          if (['tag','tags','image','date','excerpt','thumb','cover'].includes(key)) continue;
          if (key === 'location' && typeof val === 'string') { allowed.add(String(val)); continue; }
          if (Array.isArray(val)) { val.forEach(item => { if (typeof item === 'string') allowed.add(String(item)); }); continue; }
          if (val && typeof val === 'object' && typeof val.location === 'string') { allowed.add(String(val.location)); continue; }
          if (typeof val === 'string') { allowed.add(String(val)); }
        }
      }
    }

    const byLocation = {};
    for (const [title, meta] of Object.entries(posts || {})) {
      if (!meta) continue;
      if (meta.location) byLocation[String(meta.location)] = title;
      if (Array.isArray(meta.versions)) {
        meta.versions.forEach(ver => { if (ver && ver.location) byLocation[String(ver.location)] = title; });
      }
    }

    const alias = new Map();
    const reserved = new Set(['tag','tags','image','date','excerpt','thumb','cover']);
    const currentLang = normalizeLangKey((getCurrentLang && getCurrentLang()) || 'en');
    const pickerEntries = new Map();
    if (rawIndex && typeof rawIndex === 'object' && !Array.isArray(rawIndex)) {
      for (const [entryKey, entry] of Object.entries(rawIndex)) {
        if (!entry || typeof entry !== 'object') continue;
        const variants = [];
        for (const [key, val] of Object.entries(entry)) {
          if (reserved.has(key)) continue;
          if (key === 'location' && typeof val === 'string') {
            variants.push({ lang: 'default', location: String(val) });
            continue;
          }
          const nk = normalizeLangKey(key);
          if (typeof val === 'string') {
            variants.push({ lang: nk, location: String(val) });
          } else if (Array.isArray(val)) {
            val.forEach(item => { if (typeof item === 'string') variants.push({ lang: nk, location: String(item) }); });
          } else if (val && typeof val === 'object' && typeof val.location === 'string') {
            variants.push({ lang: nk, location: String(val.location) });
          }
        }
        if (!variants.length) continue;
        const findBy = (langs) => variants.find(v => langs.includes(v.lang));
        let canonical = null;
        const preferred = findBy([currentLang]) || findBy(['en']) || findBy(['default']) || variants[0];
        if (preferred) {
          const refTitle = byLocation[preferred.location];
          const refMeta = refTitle ? posts[refTitle] : null;
          if (refMeta && refMeta.location) canonical = String(refMeta.location);
        }
        if (!canonical && preferred) canonical = preferred.location;
        if (!canonical && variants[0]) canonical = variants[0].location;
        if (!canonical) continue;
        variants.forEach(v => {
          if (v.location && v.location !== canonical) alias.set(v.location, canonical);
        });
        const displayTitle = byLocation[canonical] || entry.title || entryKey;
        const aliasLocations = variants
          .map(v => v.location)
          .filter(loc => loc && loc !== canonical);
        pickerEntries.set(canonical, {
          key: entryKey,
          title: displayTitle || entryKey,
          location: canonical,
          aliases: aliasLocations
        });
      }
    }

    editorAllowedLocations = allowed;
    editorPostsByLocationTitle = byLocation;
    editorLocationAliasMap = alias;
    editorPostsIndexCache = posts || {};
    editorPostPickerEntries = Array.from(pickerEntries.values()).map(item => {
      const tokens = new Set();
      if (item.key) tokens.add(String(item.key));
      if (item.title) tokens.add(String(item.title));
      if (item.location) tokens.add(String(item.location));
      (item.aliases || []).forEach(loc => { if (loc) tokens.add(String(loc)); });
      return {
        key: item.key,
        title: item.title,
        location: item.location,
        aliases: item.aliases || [],
        search: Array.from(tokens).map(t => t.toLowerCase()).join(' ')
      };
    }).sort((a, b) => {
      const at = (a.title || '').toLowerCase();
      const bt = (b.title || '').toLowerCase();
      if (at === bt) return (a.key || '').localeCompare(b.key || '');
      return at.localeCompare(bt);
    });
    editorLinkCardContextListeners.forEach(fn => {
      try { fn(editorPostPickerEntries); }
      catch (_) { /* noop */ }
    });
    linkCardReady = true;
  } catch (_) {
    editorAllowedLocations = editorAllowedLocations || new Set();
  }
}

function $(sel) { return document.querySelector(sel); }

function switchView(mode) {
  const editorWrap = $('#editor-wrap');
  const blocksWrap = $('#blocks-wrap');
  const editorShell = $('#markdownEditorShell');
  const editorToolbar = $('#editorToolbar');
  const viewToggle = document.querySelector('.view-toggle');
  const viewButtons = Array.from(document.querySelectorAll('.vt-btn[data-view]'));
  if (!editorWrap) return;
  if (editorShell) editorShell.classList.toggle('is-blocks-mode', mode === 'blocks');
  if (mode === 'blocks') {
    if (typeof syncMarkdownBlocksFromSource === 'function') {
      try { syncMarkdownBlocksFromSource(); } catch (_) {}
    }
    if (editorShell) editorShell.style.display = '';
    editorWrap.style.display = 'none';
    if (blocksWrap) {
      blocksWrap.hidden = false;
      blocksWrap.removeAttribute('aria-hidden');
    }
    if (editorToolbar) {
      editorToolbar.hidden = true;
      editorToolbar.setAttribute('aria-hidden', 'true');
    }
    viewToggle && (viewToggle.dataset.view = 'blocks');
    try { if (markdownBlocksEditor && typeof markdownBlocksEditor.focus === 'function') markdownBlocksEditor.focus(); } catch (_) {}
  } else {
    if (editorShell) editorShell.style.display = '';
    editorWrap.style.display = '';
    if (blocksWrap) {
      blocksWrap.hidden = true;
      blocksWrap.setAttribute('aria-hidden', 'true');
    }
    if (editorToolbar) {
      editorToolbar.hidden = false;
      editorToolbar.removeAttribute('aria-hidden');
    }
    viewToggle && (viewToggle.dataset.view = 'edit');
  }
  viewButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === (mode === 'blocks' ? 'blocks' : 'edit')));
}

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
  const wrapToggle = editorMainRuntime.getElementById('wrapToggle');
  const wrapToggleButtons = wrapToggle ? Array.from(wrapToggle.querySelectorAll('[data-wrap]')) : [];
  const editorLayoutEl = editorMainRuntime.getElementById('mode-editor');
  const editorMainEl = editorLayoutEl ? editorLayoutEl.querySelector('.editor-main') : null;
  const editorEmptyStateEl = editorMainRuntime.getElementById('editorEmptyState');
  const editorMarkdownPanelEl = editorMainRuntime.getElementById('editorMarkdownPanel');
  let wrapEnabled = false;

  const applyEditorEmptyState = (isEmpty) => {
    const empty = !!isEmpty;
    if (editorLayoutEl) {
      editorLayoutEl.classList.remove('is-empty');
      editorLayoutEl.toggleAttribute('data-current-file', !empty);
    }
    if (editorMainEl) {
      editorMainEl.removeAttribute('hidden');
    }
    if (editorMarkdownPanelEl) {
      if (empty) {
        editorMarkdownPanelEl.setAttribute('hidden', '');
        editorMarkdownPanelEl.setAttribute('aria-hidden', 'true');
      } else {
        editorMarkdownPanelEl.removeAttribute('hidden');
        editorMarkdownPanelEl.removeAttribute('aria-hidden');
      }
    }
    if (editorEmptyStateEl) {
      editorEmptyStateEl.setAttribute('hidden', '');
      editorEmptyStateEl.setAttribute('aria-hidden', 'true');
    }
  };
  applyEditorEmptyState(true);

  const readWrapState = () => {
    return editorMainRuntime.readWrapEnabled({ force: FORCE_MARKDOWN_WRAP });
  };

  const persistWrapState = (on) => {
    editorMainRuntime.persistWrapEnabled(on);
  };

  const syncWrapToggle = (on) => {
    const enabled = !!on;
    if (wrapToggle) {
      wrapToggle.setAttribute('data-state', enabled ? 'on' : 'off');
    }
    wrapToggleButtons.forEach((btn) => {
      const isOn = (btn.dataset.wrap || '').toLowerCase() === 'on';
      const active = isOn === enabled;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  const applyWrapState = (value, opts = {}) => {
    const on = FORCE_MARKDOWN_WRAP ? true : !!value;
    wrapEnabled = on;
    if (editor && typeof editor.setWrap === 'function') {
      editor.setWrap(on);
    } else if (ta) {
      try {
        ta.setAttribute('wrap', on ? 'soft' : 'off');
        ta.style.whiteSpace = on ? 'pre-wrap' : 'pre';
      } catch (_) {}
    }
    syncWrapToggle(on);
    if (opts.persist !== false) persistWrapState(on);
  };

  const handleWrapSelection = (state) => {
    const next = String(state || '').toLowerCase() === 'on';
    applyWrapState(next);
  };

  wrapToggleButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      handleWrapSelection(btn.dataset.wrap);
    });
    btn.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        handleWrapSelection(btn.dataset.wrap);
      }
    });
  });

  applyWrapState(readWrapState(), { persist: false });

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

  const getEditorBody = () => {
    if (editor) return editor.getValue() || '';
    if (ta) return ta.value || '';
    return '';
  };

  const getValue = () => {
    const body = getEditorBody();
    return metadataPanel.buildEditorValue(body);
  };

  let previewSession = null;
  const currentFileSession = createEditorMainCurrentFileSession({
    runtime: editorMainRuntime,
    documentRef: document,
    translate: t,
    getCurrentLang,
    normalizeLangKey,
    inferCurrentFileSource,
    applyEditorEmptyState,
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
    getPostsIndex: () => editorPostsIndexCache || {},
    getPostsByLocationTitle: () => editorPostsByLocationTitle || {},
    isLinkCardReady: () => linkCardReady,
    getAllowedLocations: () => editorAllowedLocations,
    getLocationAliases: () => editorLocationAliasMap,
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
  let pendingBlocksImageInsert = null;
  let pendingImagePickerToken = 0;
  const armImagePickerCancelReset = (token) => {
    const clearIfPickerStillPending = () => {
      editorMainRuntime.setTimer(() => {
        if (token !== pendingImagePickerToken) return;
        const hasFiles = imageInput && imageInput.files && imageInput.files.length;
        if (!hasFiles) pendingBlocksImageInsert = null;
      }, 250);
    };
    editorMainRuntime.onWindow('focus', clearIfPickerStillPending, { once: true });
    if (imageInput) {
      imageInput.addEventListener('cancel', clearIfPickerStillPending, { once: true });
      imageInput.addEventListener('blur', clearIfPickerStillPending, { once: true });
    }
  };
  const openImageInputPicker = () => {
    if (!imageInput) {
      pendingBlocksImageInsert = null;
      return;
    }
    pendingImagePickerToken += 1;
    const pickerToken = pendingImagePickerToken;
    try { imageInput.value = ''; } catch (_) {}
    armImagePickerCancelReset(pickerToken);
    try { imageInput.click(); }
    catch (_) {
      try { imageInput.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      catch (__) {}
    }
  };
  const setEditorBodyFromBlocks = (body) => {
    const text = body == null ? '' : String(body);
    if (editor) editor.setValue(text);
    else if (ta) ta.value = text;
    requestLayout();
    refreshPreview();
    notifyChange();
  };

  const editorText = (key, fallback, params) => {
    try {
      const translated = t(key, params);
      if (translated && translated !== key) return translated;
    } catch (_) {}
    return fallback;
  };

  const resolveCurrentImageResource = (src) => {
    const markdownPath = getCurrentMarkdownPath();
    if (!markdownPath) return null;
    return resolveLocalMarkdownAssetReference(markdownPath, src, getContentRoot());
  };

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
          hydrateInternalLinkCards(node, {
            allowedLocations: linkCardReady ? editorAllowedLocations : null,
            locationAliasMap: linkCardReady ? editorLocationAliasMap : new Map(),
            postsByLocationTitle: linkCardReady ? editorPostsByLocationTitle : {},
            postsIndexCache: linkCardReady ? editorPostsIndexCache : {},
            siteConfig: editorSiteConfig,
            translate: t,
            makeHref: (loc) => withLangParam(`?id=${encodeURIComponent(loc)}`),
              fetchMarkdown: fetchMarkdownForLinkCard
            });
          previewSession.applyAssetOverrides(node, getCurrentMarkdownPath());
        } catch (_) {}
      },
      requestImageUpload: ({ index, replaceIndex, replaceBlockId } = {}) => {
        pendingBlocksImageInsert = {
          index: Number.isFinite(index) ? index : null,
          replaceIndex: Number.isFinite(replaceIndex) ? replaceIndex : null,
          replaceBlockId: typeof replaceBlockId === 'string' && replaceBlockId ? replaceBlockId : null
        };
        if (!getCurrentMarkdownPath()) {
          emitEditorToast('warn', t('editor.toasts.markdownOpenBeforeInsert'));
          pendingBlocksImageInsert = null;
          return;
        }
        openImageInputPicker();
      },
      canDeleteImageResource: (src) => !!resolveCurrentImageResource(src),
      requestImageDelete: ({ index, blockId, src } = {}) => {
        if (!markdownBlocksEditor || typeof markdownBlocksEditor.deleteImageBlock !== 'function') return;
        const target = {
          index: Number.isFinite(index) ? index : null,
          blockId: typeof blockId === 'string' && blockId ? blockId : null
        };
        const source = typeof markdownBlocksEditor.getImageBlockSource === 'function'
          ? markdownBlocksEditor.getImageBlockSource(target)
          : src;
        const markdownPath = getCurrentMarkdownPath();
        if (!markdownPath) {
          emitEditorToast('warn', t('editor.toasts.markdownOpenBeforeInsert'));
          return;
        }
        const resolved = resolveLocalMarkdownAssetReference(markdownPath, source || src, getContentRoot());
        if (!resolved) {
          emitEditorToast('warn', editorText('editor.toasts.assetDeleteUnsupported', 'Only local assets next to the current Markdown file can be deleted.'));
          return;
        }
        const detail = {
          markdownPath,
          src: source || src || '',
          assetPath: resolved.contentPath,
          commitPath: resolved.commitPath,
          relativePath: resolved.relativePath
        };
        const accepted = editorMainRuntime.requestAssetDelete(detail);
        if (!accepted || detail.rejected) {
          emitEditorToast('warn', detail.message || editorText('editor.toasts.assetDeleteRejected', 'This image resource cannot be deleted yet.'));
          return;
        }
        const result = markdownBlocksEditor.deleteImageBlock(target);
        if (!result) {
          editorMainRuntime.emitAssetDeleteCanceled(detail);
          emitEditorToast('warn', editorText('editor.toasts.imageDeleteTargetMissing', 'The image block no longer exists. Select an image block and try again.'));
        }
      }
    });
    syncMarkdownBlocksFromSource = () => {
      if (markdownBlocksEditor && typeof markdownBlocksEditor.setMarkdown === 'function') {
        markdownBlocksEditor.setMarkdown(getEditorBody());
      }
    };
  }

  const getEditorTextarea = () => {
    if (editor && editor.textarea) return editor.textarea;
    return ta;
  };

  let lastSelectionRange = { start: 0, end: 0 };
  let suppressSelectionTracking = false;
  let formattingButtons = [];
  let cardPopoverOpen = false;
  let cardPopoverClosing = false;
  let cardPopoverCloseTimer = null;
  let cardPopoverTransitionHandler = null;
  let detachCardMouseDown = () => {};
  let detachCardKeydown = () => {};
  let detachCardResize = () => {};
  let detachCardScroll = () => {};

  const tooltipButtons = new Set();

  function applyButtonTooltipState(button, disabled) {
    if (!button) return;
    const baseTitle = (() => {
      const titleKey = button.dataset.enabledTitleKey || button.getAttribute('data-i18n-title');
      if (titleKey) {
        const translated = t(titleKey);
        if (translated != null) {
          button.dataset.enabledTitle = translated;
          return translated;
        }
      }
      if (!button.dataset.enabledTitle) {
        const current = button.getAttribute('title') || button.textContent || '';
        if (current) button.dataset.enabledTitle = current;
        else button.dataset.enabledTitle = '';
      }
      return button.dataset.enabledTitle || '';
    })();
    const hintKey = button.dataset.disabledHintKey;
    const disabledHint = (() => {
      if (hintKey) {
        const translatedHint = t(hintKey);
        if (translatedHint != null) {
          button.dataset.disabledHint = translatedHint;
          return translatedHint;
        }
        button.dataset.disabledHint = '';
        return '';
      }
      return button.dataset.disabledHint || '';
    })();
    if (disabled) {
      if (disabledHint) button.setAttribute('title', disabledHint);
      else if (baseTitle) button.setAttribute('title', baseTitle);
      button.setAttribute('data-disabled', 'true');
    } else {
      if (baseTitle) button.setAttribute('title', baseTitle);
      else button.removeAttribute('title');
      button.removeAttribute('data-disabled');
    }
  }

  function registerButtonTooltip(button, disabledHintKey) {
    if (!button) return;
    if (disabledHintKey) button.dataset.disabledHintKey = disabledHintKey;
    const titleKey = button.getAttribute('data-i18n-title');
    if (titleKey) button.dataset.enabledTitleKey = titleKey;
    tooltipButtons.add(button);
    applyButtonTooltipState(button, !!button.disabled);
  }

  const updateFormattingToolbarState = () => {
    const textarea = getEditorTextarea();
    const selection = lastSelectionRange || { start: 0, end: 0 };
    const caretOnEmptyLine = isCaretOnEmptyLine(textarea, selection);
    const hasSelection = selection.end > selection.start;
    formattingButtons.forEach(btn => {
      if (!btn || !btn.el) return;
      let enabled = false;
      if (typeof btn.isEnabled === 'function') {
        enabled = !!btn.isEnabled(selection, textarea);
      } else {
        const requiresSelection = btn.requiresSelection !== false;
        enabled = requiresSelection ? hasSelection : true;
      }
      btn.el.disabled = !enabled;
      applyButtonTooltipState(btn.el, !!btn.el.disabled);
    });
    if (cardButton) {
      const hasEntries = Array.isArray(editorPostPickerEntries) && editorPostPickerEntries.length > 0;
      const allowCardInsertion = hasEntries && caretOnEmptyLine;
      cardButton.disabled = !allowCardInsertion;
      if (allowCardInsertion) cardButton.removeAttribute('aria-disabled');
      else cardButton.setAttribute('aria-disabled', 'true');
      applyButtonTooltipState(cardButton, !!cardButton.disabled);
    }
  };

  const getNormalizedSelection = () => {
    const textarea = getEditorTextarea();
    if (!textarea) return { start: 0, end: 0 };
    let start = textarea.selectionStart ?? 0;
    let end = textarea.selectionEnd ?? start;
    if (end < start) { const tmp = start; start = end; end = tmp; }
    return { start, end };
  };

  const isCaretOnEmptyLine = (textarea, selection) => {
    if (!textarea || !selection) return false;
    const { start, end } = selection;
    if (end !== start) return false;
    const value = textarea.value || '';
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', start);
    if (lineEnd === -1) lineEnd = value.length;
    const line = value.slice(lineStart, lineEnd);
    return line.trim().length === 0;
  };

  const recordSelection = () => {
    if (suppressSelectionTracking) return;
    const textarea = getEditorTextarea();
    if (!textarea) return;
    lastSelectionRange = getNormalizedSelection();
    updateFormattingToolbarState();
  };

  const restoreSelection = () => {
    const textarea = getEditorTextarea();
    if (!textarea) return null;
    suppressSelectionTracking = true;
    try {
      try { textarea.focus(); }
      catch (_) {}
      if (lastSelectionRange) {
        const { start, end } = lastSelectionRange;
        if (typeof start === 'number' && typeof end === 'number') {
          try { textarea.setSelectionRange(start, end); }
          catch (_) {}
        }
      }
    } finally {
      suppressSelectionTracking = false;
    }
    return textarea;
  };

  const applyInlineFormat = (prefix, suffix) => {
    const textarea = restoreSelection();
    if (!textarea) return;
    const { start, end } = getNormalizedSelection();
    if (end <= start) return;
    const value = textarea.value || '';
    const selected = value.slice(start, end);
    const startTag = String(prefix ?? '');
    const endTag = String(suffix ?? '');
    let replacement;
    if (
      selected.startsWith(startTag)
      && selected.endsWith(endTag)
      && selected.length >= startTag.length + endTag.length
    ) {
      replacement = selected.slice(startTag.length, selected.length - endTag.length);
    } else {
      replacement = `${startTag}${selected}${endTag}`;
    }
    textarea.setRangeText(replacement, start, end, 'end');
    const newEnd = start + replacement.length;
    textarea.setSelectionRange(start, newEnd);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    recordSelection();
  };

  const toggleLinePrefix = (prefix) => {
    const textarea = restoreSelection();
    if (!textarea) return;
    const normalizedPrefix = String(prefix ?? '');
    const selection = getNormalizedSelection();
    let { start, end } = selection;
    const wasCollapsed = end <= start;
    const wasCaretOnEmptyLine = wasCollapsed && isCaretOnEmptyLine(textarea, selection);
    const value = textarea.value || '';
    if (end <= start) {
      if (!wasCaretOnEmptyLine) return;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = value.length;
      start = lineStart;
      end = lineEnd;
    }
    if (end < start) return;
    const blockStart = value.lastIndexOf('\n', start - 1) + 1;
    let blockEnd = value.indexOf('\n', end);
    if (blockEnd === -1) blockEnd = value.length;
    const block = value.slice(blockStart, blockEnd);
    const lines = block.split('\n');
    const shouldRemove = lines.every(line => {
      const indentMatch = line.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      return line.slice(indent.length).startsWith(normalizedPrefix);
    });
    const updated = lines.map(line => {
      const indentMatch = line.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';
      const content = line.slice(indent.length);
      if (shouldRemove) {
        if (content.startsWith(normalizedPrefix)) {
          return indent + content.slice(normalizedPrefix.length);
        }
        return line;
      }
      if (content.startsWith(normalizedPrefix)) return line;
      if (!content) return indent + normalizedPrefix;
      return indent + normalizedPrefix + content;
    });
    const replacement = updated.join('\n');
    textarea.setSelectionRange(blockStart, blockEnd);
    textarea.setRangeText(replacement, blockStart, blockEnd, 'end');
    const newEnd = blockStart + replacement.length;
    if (wasCaretOnEmptyLine && wasCollapsed && !shouldRemove) {
      const firstLine = replacement.split('\n', 1)[0] || '';
      const indentMatch = firstLine.match(/^\s*/);
      const indentLength = indentMatch ? indentMatch[0].length : 0;
      const caretOffset = indentLength + normalizedPrefix.length;
      const caretPos = blockStart + caretOffset;
      textarea.setSelectionRange(caretPos, caretPos);
    } else {
      textarea.setSelectionRange(blockStart, newEnd);
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    recordSelection();
  };

  const applyCodeBlockFormat = () => {
    const textarea = restoreSelection();
    if (!textarea) return;
    const selection = getNormalizedSelection();
    let { start, end } = selection;
    const value = textarea.value || '';
    if (end <= start) {
      if (!isCaretOnEmptyLine(textarea, selection)) return;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = value.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = value.length;
      const beforeChar = lineStart > 0 ? value.charAt(lineStart - 1) : '';
      const afterChar = lineEnd < value.length ? value.charAt(lineEnd) : '';
      const prefix = beforeChar && beforeChar !== '\n' ? '\n' : '';
      const suffix = afterChar && afterChar !== '\n' ? '\n' : '';
      const block = '```\n\n```';
      textarea.setSelectionRange(lineStart, lineEnd);
      textarea.setRangeText(`${prefix}${block}${suffix}`, lineStart, lineEnd, 'end');
      const caretPos = lineStart + prefix.length + 4;
      textarea.setSelectionRange(caretPos, caretPos);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      recordSelection();
      return;
    }
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    let block = `\`\`\`\n${selected}\n\`\`\``;
    let prefixAdded = false;
    let suffixAdded = false;
    if (start > 0 && !before.endsWith('\n')) {
      block = `\n${block}`;
      prefixAdded = true;
    }
    if (after && !after.startsWith('\n')) {
      block = `${block}\n`;
      suffixAdded = true;
    }
    textarea.setRangeText(block, start, end, 'end');
    const selectionStart = start + (prefixAdded ? 1 : 0);
    const selectionEnd = start + block.length - (suffixAdded ? 1 : 0);
    textarea.setSelectionRange(selectionStart, Math.max(selectionStart, selectionEnd));
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    recordSelection();
  };

  const insertCardLink = (entry) => {
    if (!entry || !entry.location) return;
    const location = String(entry.location).trim();
    if (!location) return;
    const textarea = restoreSelection();
    if (!textarea) return;
    const value = textarea.value || '';
    const { start, end } = getNormalizedSelection();
    const safeStart = Math.max(0, Math.min(start, value.length));
    const safeEnd = Math.max(0, Math.min(end, value.length));
    const hasSelection = safeEnd > safeStart;
    const fallbackLabel = entry.key || entry.title || location;
    let linkLabel = fallbackLabel;
    if (hasSelection) {
      const selected = value.slice(safeStart, safeEnd);
      if (selected.trim()) linkLabel = selected;
    }
    const linkMarkdown = `[${linkLabel}](?id=${location})`;
    let insertText = linkMarkdown;
    let selectionStart = safeStart;
    let selectionEnd = safeStart + linkMarkdown.length;
    if (!hasSelection) {
      const before = value.slice(0, safeStart);
      const after = value.slice(safeStart);
      const needsLeading = safeStart > 0 && !before.endsWith('\n');
      const needsTrailing = after && !after.startsWith('\n');
      const leading = needsLeading ? '\n' : '';
      const trailing = needsTrailing ? '\n' : '';
      insertText = `${leading}${linkMarkdown}${trailing}`;
      selectionStart = safeStart + leading.length;
      selectionEnd = selectionStart + linkMarkdown.length;
    }
    textarea.setSelectionRange(safeStart, safeEnd);
    textarea.setRangeText(insertText, safeStart, safeEnd, 'end');
    textarea.setSelectionRange(selectionStart, selectionEnd);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    recordSelection();
  };

  const renderCardPickerList = (term = '') => {
    if (!cardListEl) return;
    const query = String(term || '').trim().toLowerCase();
    cardListEl.innerHTML = '';
    const entries = (Array.isArray(editorPostPickerEntries) ? editorPostPickerEntries : [])
      .filter(entry => {
        if (!query) return true;
        return typeof entry.search === 'string' ? entry.search.includes(query) : false;
      });
    if (!entries.length) {
      if (cardEmptyEl) cardEmptyEl.removeAttribute('hidden');
      return;
    }
    if (cardEmptyEl) cardEmptyEl.setAttribute('hidden', '');
    const frag = document.createDocumentFragment();
    entries.forEach(entry => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card-picker-item';
      btn.setAttribute('role', 'option');
      const titleEl = document.createElement('span');
      titleEl.className = 'card-picker-item-title';
      titleEl.textContent = entry.title || entry.key || entry.location;
      const metaEl = document.createElement('span');
      metaEl.className = 'card-picker-item-meta';
      if (entry.key && entry.key !== titleEl.textContent) {
        metaEl.textContent = `${entry.key} · ${entry.location}`;
      } else {
        metaEl.textContent = entry.location;
      }
      btn.append(titleEl, metaEl);
      btn.addEventListener('click', () => {
        insertCardLink(entry);
        closeCardPopover();
      });
      frag.appendChild(btn);
    });
    cardListEl.appendChild(frag);
    cardListEl.scrollTop = 0;
  };

  const positionCardPopover = (anchor) => {
    if (!cardPopover || !editorToolbarEl || !anchor) return;
    const toolbarRect = editorToolbarEl.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const top = Math.max(0, anchorRect.bottom - toolbarRect.top + 6);
    let left = anchorRect.left - toolbarRect.left;
    cardPopover.style.top = `${top}px`;
    cardPopover.style.right = 'auto';
    cardPopover.style.left = `${Math.max(0, left)}px`;
    const popWidth = cardPopover.offsetWidth || 0;
    const maxLeft = Math.max(0, toolbarRect.width - popWidth);
    if (left > maxLeft) {
      cardPopover.style.left = `${maxLeft}px`;
    }
  };

  const handleCardRelayout = () => {
    if (cardPopoverOpen) positionCardPopover(cardButton);
  };

  const detachCardPopoverWatchers = () => {
    detachCardMouseDown();
    detachCardKeydown();
    detachCardResize();
    detachCardScroll();
    detachCardMouseDown = () => {};
    detachCardKeydown = () => {};
    detachCardResize = () => {};
    detachCardScroll = () => {};
  };

  const attachCardPopoverWatchers = () => {
    detachCardPopoverWatchers();
    detachCardMouseDown = editorMainRuntime.onDocument('mousedown', handleCardOutsideClick, true);
    detachCardKeydown = editorMainRuntime.onDocument('keydown', handleCardKeydown, true);
    detachCardResize = editorMainRuntime.onWindow('resize', handleCardRelayout, true);
    detachCardScroll = editorMainRuntime.onWindow('scroll', handleCardRelayout, true);
  };

  const clearCardPopoverCloseWatcher = () => {
    if (cardPopoverCloseTimer) {
      editorMainRuntime.clearTimer(cardPopoverCloseTimer);
      cardPopoverCloseTimer = null;
    }
    if (cardPopover && cardPopoverTransitionHandler) {
      cardPopover.removeEventListener('transitionend', cardPopoverTransitionHandler);
    }
    cardPopoverTransitionHandler = null;
  };

  const finalizeCardPopoverClose = () => {
    clearCardPopoverCloseWatcher();
    cardPopoverClosing = false;
    if (cardPopover) {
      cardPopover.classList.remove('is-visible');
      cardPopover.classList.remove('is-closing');
      cardPopover.setAttribute('aria-hidden', 'true');
      cardPopover.setAttribute('hidden', '');
      cardPopover.style.left = '';
      cardPopover.style.right = '';
      cardPopover.style.top = '';
    }
  };

  const closeCardPopover = () => {
    if (!cardPopoverOpen && !cardPopoverClosing) return;
    cardPopoverOpen = false;
    cardPopoverClosing = true;
    if (cardButton) cardButton.setAttribute('aria-expanded', 'false');
    detachCardPopoverWatchers();
    if (!cardPopover) {
      finalizeCardPopoverClose();
      if (cardSearchInput) cardSearchInput.value = '';
      return;
    }
    clearCardPopoverCloseWatcher();
    cardPopover.setAttribute('aria-hidden', 'true');
    cardPopover.classList.remove('is-visible');
    cardPopover.classList.add('is-closing');
    const handleTransitionEnd = (event) => {
      if (event.target !== cardPopover) return;
      if (event.propertyName && event.propertyName !== 'opacity') return;
      finalizeCardPopoverClose();
    };
    cardPopoverTransitionHandler = handleTransitionEnd;
    cardPopover.addEventListener('transitionend', handleTransitionEnd);
    cardPopoverCloseTimer = editorMainRuntime.setTimer(finalizeCardPopoverClose, 360);
    if (cardSearchInput) cardSearchInput.value = '';
  };

  const openCardPopover = () => {
    if (!cardButton || !cardPopover) return;
    const hasEntries = Array.isArray(editorPostPickerEntries) && editorPostPickerEntries.length > 0;
    if (!hasEntries) return;
    renderCardPickerList('');
    if (cardSearchInput) cardSearchInput.value = '';
    clearCardPopoverCloseWatcher();
    cardPopoverClosing = false;
    cardPopover.classList.remove('is-visible');
    cardPopover.classList.remove('is-closing');
    cardPopover.removeAttribute('hidden');
    cardPopover.setAttribute('aria-hidden', 'false');
    positionCardPopover(cardButton);
    void cardPopover.offsetWidth;
    cardPopover.classList.add('is-visible');
    cardButton.setAttribute('aria-expanded', 'true');
    cardPopoverOpen = true;
    editorMainRuntime.setTimer(() => {
      if (cardSearchInput) {
        try { cardSearchInput.focus(); }
        catch (_) {}
      }
    }, 0);
    attachCardPopoverWatchers();
  };

  function handleCardOutsideClick(event) {
    if (!cardPopoverOpen) return;
    const target = event.target;
    if (!cardPopover) return;
    if (cardPopover.contains(target)) return;
    if (cardButton && cardButton.contains(target)) return;
    closeCardPopover();
  }

  function handleCardKeydown(event) {
    if (!cardPopoverOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCardPopover();
      restoreSelection();
    }
  }

  const handleCardContextUpdate = () => {
    updateFormattingToolbarState();
    const hasEntries = Array.isArray(editorPostPickerEntries) && editorPostPickerEntries.length > 0;
    const textarea = getEditorTextarea();
    const selection = lastSelectionRange || { start: 0, end: 0 };
    const allowCardInsertion = hasEntries && isCaretOnEmptyLine(textarea, selection);
    if ((!hasEntries || !allowCardInsertion) && cardPopoverOpen) {
      closeCardPopover();
      return;
    }
    if (cardPopoverOpen) {
      renderCardPickerList(cardSearchInput ? cardSearchInput.value : '');
      positionCardPopover(cardButton);
    }
  };

  const BUTTON_DISABLED_HINT_KEYS = {
    btnFmtBold: 'editor.editorTools.hints.bold',
    btnFmtItalic: 'editor.editorTools.hints.italic',
    btnFmtStrike: 'editor.editorTools.hints.strike',
    btnFmtHeading: 'editor.editorTools.hints.heading',
    btnFmtQuote: 'editor.editorTools.hints.quote',
    btnFmtCode: 'editor.editorTools.hints.code',
    btnFmtCodeBlock: 'editor.editorTools.hints.codeBlock',
    btnInsertCard: 'editor.editorTools.hints.insertCard'
  };

  if (cardButton) registerButtonTooltip(cardButton, BUTTON_DISABLED_HINT_KEYS.btnInsertCard);

  const selectionOrEmptyLineEnabled = (selection, textarea) => {
    if (!selection) return false;
    if (selection.end > selection.start) return true;
    return isCaretOnEmptyLine(textarea, selection);
  };

  const formattingActions = [
    { id: 'btnFmtBold', handler: () => applyInlineFormat('**', '**') },
    { id: 'btnFmtItalic', handler: () => applyInlineFormat('*', '*') },
    { id: 'btnFmtStrike', handler: () => applyInlineFormat('~~', '~~') },
    { id: 'btnFmtHeading', handler: () => toggleLinePrefix('# '), isEnabled: selectionOrEmptyLineEnabled },
    { id: 'btnFmtQuote', handler: () => toggleLinePrefix('> '), isEnabled: selectionOrEmptyLineEnabled },
    { id: 'btnFmtCode', handler: () => applyInlineFormat('`', '`') },
    { id: 'btnFmtCodeBlock', handler: () => applyCodeBlockFormat(), isEnabled: selectionOrEmptyLineEnabled }
  ];

  formattingButtons = formattingActions.map(action => {
    const el = document.getElementById(action.id);
    if (!el) return null;
    registerButtonTooltip(el, BUTTON_DISABLED_HINT_KEYS[action.id]);
    el.addEventListener('click', (event) => {
      event.preventDefault();
      action.handler();
    });
    const requiresSelection = action.requiresSelection !== undefined ? action.requiresSelection : true;
    return { ...action, el, requiresSelection };
  }).filter(Boolean);

  const selectionTarget = getEditorTextarea();
  if (selectionTarget) {
    ['select', 'keyup', 'mouseup', 'input'].forEach(evt => {
      selectionTarget.addEventListener(evt, recordSelection);
    });
    selectionTarget.addEventListener('focus', recordSelection);
  }
  recordSelection();

  editorMainRuntime.onDocument('press-editor-language-applied', () => {
    tooltipButtons.forEach(btn => applyButtonTooltipState(btn, !!btn.disabled));
    currentFileSession.render();
    if (markdownBlocksEditor && typeof markdownBlocksEditor.requestLayout === 'function') {
      try { markdownBlocksEditor.requestLayout(); } catch (_) {}
    }
    metadataPanel.syncLanguage();
  });

  if (cardSearchInput) {
    cardSearchInput.addEventListener('input', () => {
      renderCardPickerList(cardSearchInput.value);
    });
    cardSearchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const first = cardListEl ? cardListEl.querySelector('.card-picker-item') : null;
        if (first) first.click();
      }
    });
  }

  if (cardButton) {
    cardButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (cardPopoverOpen) closeCardPopover();
      else openCardPopover();
    });
  }

  const handleBlocksCardContextUpdate = (entries) => {
    if (!markdownBlocksEditor || typeof markdownBlocksEditor.setCardEntries !== 'function') return;
    markdownBlocksEditor.setCardEntries(Array.isArray(entries) ? entries : editorPostPickerEntries);
  };
  editorLinkCardContextListeners.add(handleCardContextUpdate);
  editorLinkCardContextListeners.add(handleBlocksCardContextUpdate);
  handleCardContextUpdate();
  handleBlocksCardContextUpdate(editorPostPickerEntries);

  const getCurrentMarkdownPath = () => {
    return currentFileSession.getPath();
  };

  const emitEditorToast = (kind, message) => {
    const text = message == null ? '' : String(message);
    if (!text) return;
    editorMainRuntime.emitToast(kind, text);
  };

  const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Unexpected file data.'));
          return;
        }
        const comma = result.indexOf(',');
        const base64 = comma >= 0 ? result.slice(comma + 1) : result;
        if (!base64) {
          reject(new Error('Image data is empty.'));
          return;
        }
        resolve(base64);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read image.'));
    };
    try {
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });

  const slugifyAssetBase = (value) => {
    const input = String(value == null ? '' : value).toLowerCase();
    const cleaned = input.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return cleaned ? cleaned.slice(0, 48) : 'image';
  };

  const inferAssetExtension = (file) => {
    if (!file) return '.png';
    const name = typeof file.name === 'string' ? file.name : '';
    const extMatch = name.match(/\.([a-zA-Z0-9]+)$/);
    let ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
    const normalize = (value) => (value && value.startsWith('.') ? value : `.${value || ''}`);
    const type = (file.type || '').toLowerCase();
    const typeMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/avif': '.avif',
      'image/bmp': '.bmp',
      'image/heic': '.heic',
      'image/heif': '.heif'
    };
    if (!ext && typeMap[type]) ext = typeMap[type];
    if (!ext && type.includes('jpeg')) ext = '.jpg';
    if (!ext && type.includes('png')) ext = '.png';
    if (!ext) ext = '.png';
    ext = normalize(ext.toLowerCase());
    return ext.replace(/[^.a-z0-9]/g, '') || '.png';
  };

  const buildAssetFileMeta = (file) => {
    const original = file && typeof file.name === 'string' ? file.name : '';
    const dot = original.lastIndexOf('.');
    const baseRaw = dot > 0 ? original.slice(0, dot) : original;
    const slug = slugifyAssetBase(baseRaw);
    const ext = inferAssetExtension(file);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    const fileName = `${slug}-${timestamp}${random ? `-${random}` : ''}${ext}`;
    const altText = baseRaw && baseRaw.trim() ? baseRaw.trim() : slug.replace(/-/g, ' ').trim();
    return { fileName, altText: altText || slug };
  };

  const computeAssetPaths = (markdownPath, fileName) => {
    const normalized = String(markdownPath || '').replace(/[\\]/g, '/').replace(/^\/+/, '');
    const idx = normalized.lastIndexOf('/');
    const dir = idx >= 0 ? normalized.slice(0, idx) : '';
    const assetDir = dir ? `${dir}/assets` : 'assets';
    const commitPath = `${assetDir}/${fileName}`.replace(/\/+/g, '/');
    const relativePath = `assets/${fileName}`;
    return { commitPath, relativePath };
  };

  const insertImageMarkdown = (relativePath, altText) => {
    const target = getEditorTextarea();
    const content = target ? (target.value || '') : getEditorBody();
    const start = target && Number.isFinite(target.selectionStart) ? target.selectionStart : content.length;
    const end = target && Number.isFinite(target.selectionEnd) ? target.selectionEnd : start;
    const insertion = insertImageMarkdownAtSelection(content, start, end, relativePath, altText);
    const next = metadataPanel.buildMarkdown(insertion.value);
    setValue(next, { notify: true });
    return {
      altStart: insertion.altStart,
      altEnd: insertion.altEnd,
      afterIndex: insertion.afterIndex
    };
  };

  const isImageFile = (file) => {
    if (!file) return false;
    if (file.type) return file.type.startsWith('image/');
    const name = typeof file.name === 'string' ? file.name : '';
    return /\.(?:png|jpe?g|gif|bmp|webp|svg|avif|heic|heif)$/i.test(name);
  };

  const containsImageFile = (dataTransfer) => {
    if (!dataTransfer) return false;
    const files = dataTransfer.files;
    if (files && files.length) {
      for (let i = 0; i < files.length; i += 1) {
        if (isImageFile(files[i])) return true;
      }
    }
    if (dataTransfer.items && dataTransfer.items.length) {
      for (let i = 0; i < dataTransfer.items.length; i += 1) {
        const item = dataTransfer.items[i];
        if (item && item.kind === 'file') {
          try {
            const file = item.getAsFile();
            if (isImageFile(file)) return true;
          } catch (_) { /* ignore */ }
        }
      }
    }
    return false;
  };

  const handleImageFiles = async (fileList, options = {}) => {
    const markdownPath = getCurrentMarkdownPath();
    if (!markdownPath) {
      emitEditorToast('warn', 'Open a markdown file before inserting images.');
      return;
    }
    const files = Array.from(fileList || []).filter(isImageFile);
    if (!files.length) {
      if (fileList && fileList.length) emitEditorToast('warn', 'Only image files can be inserted.');
      return;
    }
    if (options.singleImage && files.length > 1) files.splice(1);

    const textarea = getEditorTextarea();
    const customInsertMarkdown = typeof options.insertMarkdown === 'function' ? options.insertMarkdown : null;
    let lastSelection = null;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (lastSelection && textarea) {
        try { textarea.setSelectionRange(lastSelection.afterIndex, lastSelection.afterIndex); }
        catch (_) {}
      }
      let base64;
      try {
        base64 = await readFileAsBase64(file);
      } catch (err) {
        console.error('Failed to read image for insertion', err);
        emitEditorToast('error', err && err.message ? err.message : 'Failed to read image file.');
        continue;
      }

      const meta = buildAssetFileMeta(file);
      const paths = computeAssetPaths(markdownPath, meta.fileName);
      let selection;
      if (customInsertMarkdown) {
        selection = customInsertMarkdown(paths.relativePath, meta.altText);
        if (selection === false) {
          if (options.insertAbortToast) emitEditorToast('warn', options.insertAbortToast);
          continue;
        }
        selection = selection || {};
      } else {
        selection = insertImageMarkdown(paths.relativePath, meta.altText);
      }
      lastSelection = selection;

      if (!customInsertMarkdown && textarea) {
        try {
          textarea.focus();
          textarea.setSelectionRange(selection.altStart, selection.altEnd);
        } catch (_) {}
      }

      try {
        editorMainRuntime.emitAssetAdded({
          markdownPath,
          fileName: meta.fileName,
          commitPath: paths.commitPath,
          relativePath: paths.relativePath,
          base64,
          mime: file.type || '',
          size: file.size || 0,
          originalName: file.name || '',
          altText: meta.altText,
          source: options.source || 'picker',
          silent: true
        });
      } catch (err) {
        console.error('Failed to dispatch asset-added event', err);
      }

      emitEditorToast('success', t('editor.toasts.assetAttached', { label: paths.relativePath }));
    }
  };

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

  if (imageButton) {
    imageButton.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      pendingBlocksImageInsert = null;
      if (!getCurrentMarkdownPath()) {
        emitEditorToast('warn', 'Open a markdown file before inserting images.');
        return;
      }
      openImageInputPicker();
    });
  }

  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const files = imageInput.files;
      const blockInsert = pendingBlocksImageInsert;
      pendingBlocksImageInsert = null;
      pendingImagePickerToken += 1;
      if (files && files.length) {
        const replaceIndex = blockInsert && Number.isFinite(blockInsert.replaceIndex)
          ? blockInsert.replaceIndex
          : null;
        const replaceBlockId = blockInsert && typeof blockInsert.replaceBlockId === 'string'
          ? blockInsert.replaceBlockId
          : null;
        let insertIndex = blockInsert && Number.isFinite(blockInsert.index)
          ? blockInsert.index
          : null;
        const replaceMarkdown = (replaceIndex != null || replaceBlockId)
          && markdownBlocksEditor
          && typeof markdownBlocksEditor.replaceImageBlock === 'function'
          ? (relativePath) => {
            const result = markdownBlocksEditor.replaceImageBlock(relativePath, { index: replaceIndex, blockId: replaceBlockId });
            if (!result) return false;
            return {};
          }
          : null;
        const insertMarkdown = !replaceMarkdown && blockInsert && markdownBlocksEditor && typeof markdownBlocksEditor.insertImageBlock === 'function'
          ? (relativePath, altText) => {
            const result = markdownBlocksEditor.insertImageBlock(relativePath, altText, insertIndex);
            if (result && Number.isFinite(result.index)) insertIndex = result.index + 1;
            return {};
          }
          : null;
        const markdownHandler = replaceMarkdown || insertMarkdown;
        const imageFileOptions = markdownHandler
          ? { source: 'picker', insertMarkdown: markdownHandler, singleImage: !!replaceMarkdown }
          : { source: 'picker' };
        if (replaceMarkdown) imageFileOptions.insertAbortToast = t('editor.toasts.imageReplaceTargetMissing');
        handleImageFiles(files, imageFileOptions).catch((err) => {
          console.error('Image insertion failed', err);
        });
      }
      imageInput.value = '';
    });
  }

  const markdownTextarea = getEditorTextarea();
  if (markdownTextarea) {
    markdownTextarea.addEventListener('dragover', (event) => {
      if (!event || !event.dataTransfer) return;
      if (!containsImageFile(event.dataTransfer)) return;
      event.preventDefault();
      try { event.dataTransfer.dropEffect = 'copy'; }
      catch (_) {}
    });
    markdownTextarea.addEventListener('drop', (event) => {
      if (!event || !event.dataTransfer) return;
      if (!containsImageFile(event.dataTransfer)) return;
      event.preventDefault();
      const files = event.dataTransfer.files;
      if (files && files.length) {
        handleImageFiles(files, { source: 'drop' }).catch((err) => {
          console.error('Image drop failed', err);
        });
      }
    });
  }

  const applyMarkdownEditorView = (mode, opts = {}) => {
    if (mode === 'preview') {
      previewSession.open();
      return;
    }
    const nextView = normalizeMarkdownEditorView(mode);
    switchView(nextView);
    if (nextView === 'blocks' && markdownBlocksEditor && typeof markdownBlocksEditor.requestLayout === 'function') {
      try { markdownBlocksEditor.requestLayout(); } catch (_) {}
    } else {
      requestLayout();
    }
    if (opts.persist) persistMarkdownEditorView(nextView);
  };

  // View toggle
  document.querySelectorAll('.vt-btn[data-view]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      applyMarkdownEditorView(a.dataset.view, { persist: true });
    });
  });
  const previewOpenButton = editorMainRuntime.getElementById('btnOpenPreview');
  if (previewOpenButton) {
    previewOpenButton.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      previewSession.open();
    });
  }

  const primaryEditorApi = {
    getValue,
    setValue: (value, opts = {}) => setValue(value, opts),
    focus: () => {
      try {
        if (editor && typeof editor.focus === 'function') editor.focus();
        else if (ta && typeof ta.focus === 'function') ta.focus();
      } catch (_) {}
    },
    setView: (mode, opts = {}) => applyMarkdownEditorView(mode, opts),
    restorePersistedView: (opts = {}) => applyMarkdownEditorView(readPersistedMarkdownEditorView(), opts),
    getView: () => {
      const viewToggle = document.querySelector('.view-toggle');
      return normalizeMarkdownEditorView(viewToggle && viewToggle.dataset ? viewToggle.dataset.view : 'blocks');
    },
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
    setWrap: (value, opts = {}) => { applyWrapState(value, opts); },
    isWrapEnabled: () => wrapEnabled
  };

  editorMainRuntime.registerPrimaryEditorApi(primaryEditorApi);

  // Clear draft action removed (no local storage drafts)

  // Draft persistence on unload removed

  // Default to blocks view
  switchView('blocks');

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

  // ----- Article browser (sidebar) -----
  (function initArticleBrowser() {
    const listIndex = document.getElementById('listIndex');
    const listTabs = document.getElementById('listTabs');
    const statusEl = document.getElementById('sidebarStatus');
    const currentFileEl = document.getElementById('currentFile');
    const searchInput = document.getElementById('fileSearch');
    let currentActive = null;
    let contentRoot = 'wwwroot';
    // Track current markdown base directory for resolving relative assets
    editorMainRuntime.ensureEditorBaseDir(`${contentRoot}/`);
    let activeGroup = 'index';

    const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg || ''; };
    bindCurrentFileElement(currentFileEl);

    const basename = (p) => {
      try { const s = String(p || ''); const i = s.lastIndexOf('/'); return i >= 0 ? s.slice(i + 1) : s; } catch (_) { return String(p || ''); }
    };
    const toUrl = (p) => {
      const s = String(p || '').trim();
      if (!s) return '';
      if (/^(https?:)?\//i.test(s)) return s; // absolute or protocol-relative
      return `${contentRoot}/${s}`.replace(/\\+/g, '/');
    };

    const makeLi = (label, relPath) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.dataset.rel = relPath;
      li.dataset.label = label.toLowerCase();
      li.dataset.file = relPath.toLowerCase();
      li.innerHTML = `
        <div class="file-main">
          <span class="file-label">${label}</span>
          <span class="file-path">${relPath}</span>
        </div>`;
      li.addEventListener('click', async () => {
        const url = toUrl(relPath);
        if (!url) return;
        try {
          setStatus('Loading…');
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const text = await r.text();
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
          if (currentActive) currentActive.classList.remove('is-active');
          currentActive = li; currentActive.classList.add('is-active');
          switchView('edit');
          editorMainRuntime.scrollToTop({ smooth: true });
          setStatus('');
        } catch (err) {
          console.error('Failed to load markdown:', err);
          setStatus(`Failed to load: ${relPath}`);
          alert(`Failed to load file\n${relPath}\n${err}`);
        }
      });
      return li;
    };

    // ---- Grouped rendering helpers ----
    const extractVersion = (p) => {
      try {
        const m = String(p || '').match(/(?:^|\/)v\d+(?:\.\d+)*(?=\/|$)/i);
        return m ? m[0].split('/').pop() : '';
      } catch (_) { return ''; }
    };
    const versionParts = (v) => {
      try {
        const s = String(v || '').replace(/^v/i, '');
        return s.split('.').map(x => parseInt(x, 10)).map(n => (Number.isFinite(n) ? n : 0));
      } catch (_) { return [0]; }
    };
    const compareVersionDesc = (a, b) => {
      const aa = versionParts(a); const bb = versionParts(b);
      const len = Math.max(aa.length, bb.length);
      for (let i = 0; i < len; i++) {
        const x = aa[i] || 0; const y = bb[i] || 0;
        if (x !== y) return y - x; // desc
      }
      return 0;
    };

    const makeGroupHeader = (title, open = false, meta = null) => {
      const details = document.createElement('details');
      details.className = 'file-group';
      if (open) details.setAttribute('open', '');
      const summary = document.createElement('summary');
      summary.className = 'file-group-header';
      // Title section
      const sTitle = document.createElement('span');
      sTitle.className = 'file-group-title';
      sTitle.textContent = title;
      summary.appendChild(sTitle);
      // Badges/meta
      if (meta) {
        const wrap = document.createElement('span');
        wrap.className = 'summary-badges';
        if (typeof meta.versionsCount === 'number' && meta.versionsCount > 0) {
          const b = document.createElement('span');
          b.className = 'badge badge-ver';
          b.textContent = `v${meta.versionsCount}`;
          wrap.appendChild(b);
        }
        if (Array.isArray(meta.langs) && meta.langs.length) {
          const b = document.createElement('span');
          b.className = 'badge badge-lang';
          b.textContent = meta.langs.map(x => String(x).toUpperCase()).join(' ');
          wrap.appendChild(b);
        }
        summary.appendChild(wrap);
      }
      const ul = document.createElement('ul');
      ul.className = 'file-sublist';
      details.appendChild(summary);
      details.appendChild(ul);
      const li = document.createElement('li');
      li.appendChild(details);

      // ----- Smooth expand/collapse helpers -----
      const ANIM_MS = 480; // slower, consistent open/close duration (ms)
      const ease = 'cubic-bezier(0.45, 0, 0.25, 1)'; // gentle ease-in-out
      const animateExpand = (panel) => {
        if (!panel) return;
        try {
          panel.style.overflow = 'hidden';
          panel.style.height = '0px';
          panel.style.opacity = '0';
          // Force style flush to ensure transition kicks in cleanly
          void panel.getBoundingClientRect();
          panel.style.transition = `height ${ANIM_MS}ms ${ease}, opacity ${ANIM_MS}ms ${ease}`;
          const target = panel.scrollHeight;
          // next frame
          editorMainRuntime.requestFrame(() => {
            panel.style.height = `${target}px`;
            panel.style.opacity = '1';
          });
          const cleanup = (ev) => {
            if (ev && ev.propertyName && ev.propertyName !== 'height') return; // wait for height
            panel.style.transition = '';
            panel.style.height = '';
            panel.style.overflow = '';
            panel.style.opacity = '';
            panel.removeEventListener('transitionend', cleanup);
          };
          panel.addEventListener('transitionend', cleanup);
        } catch (_) {}
      };
      const animateCollapse = (panel, after) => {
        if (!panel) { if (after) after(); return; }
        try {
          const start = panel.scrollHeight;
          panel.style.overflow = 'hidden';
          panel.style.height = `${start}px`;
          panel.style.opacity = '1';
          panel.style.transition = `height ${ANIM_MS}ms ${ease}, opacity ${ANIM_MS}ms ${ease}`;
          // next frame
          editorMainRuntime.requestFrame(() => {
            panel.style.height = '0px';
            panel.style.opacity = '0';
          });
          const done = (ev) => {
            if (ev && ev.propertyName && ev.propertyName !== 'height') return; // wait for height
            panel.style.transition = '';
            panel.style.height = '';
            panel.style.overflow = '';
            panel.style.opacity = '';
            panel.removeEventListener('transitionend', done);
            if (after) after();
          };
          panel.addEventListener('transitionend', done);
        } catch (_) { if (after) after(); }
      };

      // Intercept close to animate before collapsing the <details>
      summary.addEventListener('click', (evt) => {
        try {
          if (!details.open) return; // it will open; let default handle
          // It is currently open and will close: prevent default and animate
          evt.preventDefault();
          animateCollapse(ul, () => { try { details.removeAttribute('open'); } catch (_) {} });
        } catch (_) {}
      });

      // Accordion + animate on open
      details.addEventListener('toggle', (e) => {
        try {
          if (details.open) {
            // Animate this group's expansion
            animateExpand(ul);
            // Only enforce accordion for user-initiated toggles
            if (!e || e.isTrusted !== false) {
              const list = details.closest('.file-list');
              if (list) {
                const openGroups = list.querySelectorAll('details.file-group[open]');
                openGroups.forEach(d => {
                  if (d !== details) {
                    const p = d.querySelector('.file-sublist');
                    animateCollapse(p, () => { try { d.removeAttribute('open'); } catch (_) {} });
                  }
                });
              }
            }
          }
        } catch (_) { /* noop */ }
      });
      return { container: li, sublist: ul, details };
    };

    const makeSubHeader = (title) => {
      const li = document.createElement('li');
      li.className = 'file-subgroup';
      const div = document.createElement('div');
      div.className = 'file-subheader';
      div.textContent = title;
      const ul = document.createElement('ul');
      ul.className = 'file-sublist';
      li.appendChild(div);
      li.appendChild(ul);
      return { container: li, sublist: ul };
    };

    const renderGroupedIndex = (ul, data) => {
      if (!ul) return;
      ul.innerHTML = '';
      const frag = document.createDocumentFragment();
      try {
        const groups = Object.entries(data || {});
        for (const [postKey, val] of groups) {
          // Compute meta: languages + version count
          const langsSet = new Set();
          const verSet = new Set();
          if (typeof val === 'string') {
            const v = extractVersion(val); if (v) verSet.add(v);
          } else if (Array.isArray(val)) {
            val.forEach(p => { const v = extractVersion(p); if (v) verSet.add(v); });
          } else if (val && typeof val === 'object') {
            for (const [lang, paths] of Object.entries(val)) {
              langsSet.add(lang);
              if (typeof paths === 'string') {
                const v = extractVersion(paths); if (v) verSet.add(v);
              } else if (Array.isArray(paths)) {
                paths.forEach(p => { const v = extractVersion(p); if (v) verSet.add(v); });
              }
            }
          }
          const meta = { langs: Array.from(langsSet), versionsCount: verSet.size };
          const { container, sublist } = makeGroupHeader(postKey, false, meta);
          if (typeof val === 'string') {
            sublist.appendChild(makeLi(`${postKey} - ${basename(val)}`, val));
          } else if (Array.isArray(val)) {
            // No language info; list as is
            val.forEach(p => { if (typeof p === 'string') sublist.appendChild(makeLi(`${basename(p)}`, p)); });
          } else if (val && typeof val === 'object') {
            const langs = Object.entries(val);
            // Deterministic language order: en, chs, cht-tw, ja, then others
            const langOrder = { en: 1, chs: 2, 'cht-tw': 3, 'cht-hk': 4, ja: 5 };
            const langOrderIndex = (code) => langOrder[normalizeLangKey(code)] || 9;
            langs.sort(([a], [b]) => langOrderIndex(a) - langOrderIndex(b) || a.localeCompare(b));
            for (const [lang, paths] of langs) {
              const { container: sub, sublist: vs } = makeSubHeader(String(lang).toUpperCase());
              const items = [];
              if (typeof paths === 'string') {
                items.push({ v: extractVersion(paths) || '', path: paths, name: basename(paths) });
              } else if (Array.isArray(paths)) {
                for (const p of paths) {
                  if (typeof p === 'string') items.push({ v: extractVersion(p) || '', path: p, name: basename(p) });
                }
              }
              // Sort by version desc, then by name
              items.sort((a, b) => {
                const c = compareVersionDesc(a.v, b.v);
                if (c !== 0) return c;
                return a.name.localeCompare(b.name);
              });
              for (const it of items) {
                const label = it.v ? `${it.v} - ${it.name}` : it.name;
                vs.appendChild(makeLi(label, it.path));
              }
              sublist.appendChild(sub);
            }
          }
          frag.appendChild(container);
        }
      } catch (_) { /* noop */ }
      ul.appendChild(frag);
    };

    const renderGroupedTabs = (ul, data) => {
      if (!ul) return;
      ul.innerHTML = '';
      const frag = document.createDocumentFragment();
      try {
        const groups = Object.entries(data || {});
        for (const [tabKey, variants] of groups) {
          // Compute meta for tabs: languages + versions (if any detected)
          const langsSet = new Set();
          const verSet = new Set();
          if (typeof variants === 'string') {
            const v = extractVersion(variants); if (v) verSet.add(v);
          } else if (variants && typeof variants === 'object') {
            for (const [lang, detail] of Object.entries(variants)) {
              langsSet.add(lang);
              if (typeof detail === 'string') {
                const v = extractVersion(detail); if (v) verSet.add(v);
              } else if (detail && typeof detail === 'object') {
                const loc = detail.location || '';
                const v = extractVersion(loc); if (v) verSet.add(v);
              }
            }
          }
          const meta = { langs: Array.from(langsSet), versionsCount: verSet.size };
          const { container, sublist } = makeGroupHeader(tabKey, false, meta);
          if (typeof variants === 'string') {
            sublist.appendChild(makeLi(`${tabKey} - ${basename(variants)}`, variants));
          } else if (variants && typeof variants === 'object') {
            const langs = Object.entries(variants);
            const langOrder = { en: 1, chs: 2, 'cht-tw': 3, 'cht-hk': 4, ja: 5 };
            const langOrderIndex = (code) => langOrder[normalizeLangKey(code)] || 9;
            langs.sort(([a], [b]) => langOrderIndex(a) - langOrderIndex(b) || a.localeCompare(b));
            for (const [lang, detail] of langs) {
              if (typeof detail === 'string') {
                sublist.appendChild(makeLi(`${String(lang).toUpperCase()} - ${basename(detail)}`, detail));
              } else if (detail && typeof detail === 'object') {
                const title = detail.title || tabKey;
                const loc = detail.location || '';
                if (loc) sublist.appendChild(makeLi(`${String(lang).toUpperCase()} - ${title}`, loc));
              }
            }
          }
          frag.appendChild(container);
        }
      } catch (_) { /* noop */ }
      ul.appendChild(frag);
    };

    const applyFilter = (term) => {
      const q = String(term || '').trim().toLowerCase();
      const groupRoot = activeGroup === 'tabs' ? document.getElementById('groupTabs') : document.getElementById('groupIndex');
      if (!groupRoot) return;
      const items = groupRoot.querySelectorAll('.file-item');
      items.forEach(li => {
        if (!q) { li.style.display = ''; return; }
        const a = li.dataset.label || '';
        const b = li.dataset.file || '';
        li.style.display = (a.includes(q) || b.includes(q)) ? '' : 'none';
      });
      // Hide language subgroups with no visible items
      const subgroups = groupRoot.querySelectorAll('.file-subgroup');
      subgroups.forEach(sg => {
        const anyVisible = !!sg.querySelector('.file-item:not([style*="display: none"])');
        sg.style.display = anyVisible || !q ? '' : 'none';
      });
      // Hide whole groups with no visible items
      const groups = groupRoot.querySelectorAll('details.file-group');
      groups.forEach(g => {
        const anyVisible = !!g.querySelector('.file-item:not([style*="display: none"])');
        g.parentElement.style.display = anyVisible || !q ? '' : 'none';
        // Auto-expand matched groups when searching
        if (q && anyVisible) {
          try { g.setAttribute('open', ''); } catch (_) {}
        }
      });
    };
    if (searchInput) {
      searchInput.addEventListener('input', () => applyFilter(searchInput.value));
    }

    // Tabs switching (Posts <-> Tabs)
    const sideTabs = document.querySelectorAll('.sidebar-tab');
    const groupIndex = document.getElementById('groupIndex');
    const groupTabs = document.getElementById('groupTabs');
    const switchGroup = (name) => {
      activeGroup = name === 'tabs' ? 'tabs' : 'index';
      if (groupIndex) groupIndex.hidden = activeGroup !== 'index';
      if (groupTabs) groupTabs.hidden = activeGroup !== 'tabs';
      sideTabs.forEach(btn => {
        const tgt = btn.getAttribute('data-target');
        const on = tgt === activeGroup;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      // Re-apply current filter for visible list only
      applyFilter(searchInput ? searchInput.value : '');
    };
    sideTabs.forEach(btn => btn.addEventListener('click', () => switchGroup(btn.dataset.target)));
    switchGroup('index');

    (async () => {
      try {
        setStatus('Loading site config…');
        const site = await fetchMergedSiteConfig();
        editorSiteConfig = site || {};
        try { configureFetchCachePolicy(editorSiteConfig, { context: 'editor' }); } catch (_) {}
        previewSession.handleSiteConfigChange();
        contentRoot = (site && site.contentRoot) ? String(site.contentRoot) : 'wwwroot';
      } catch (_) {
        editorSiteConfig = {};
        contentRoot = 'wwwroot';
      }
      // Keep runtime hints for content root and default editor base dir.
      editorMainRuntime.setContentRoot(contentRoot);
      editorMainRuntime.setEditorBaseDir(`${contentRoot}/`, `${contentRoot}/`);

      try {
        setStatus('Loading index…');
        const indexResult = await loadContentJsonWithRaw(contentRoot, 'index');
        const rawIndex = (indexResult && indexResult.raw) || {};
        const posts = (indexResult && indexResult.entries) || {};
        renderGroupedIndex(listIndex, rawIndex);
        rebuildLinkCardContext(posts, rawIndex);
        if (linkCardReady) refreshPreview();
      } catch (err) {
        console.warn('Failed to load index data', err);
      }

      try {
        setStatus('Loading tabs…');
        const tjson = await fetchConfigWithYamlFallback([`${contentRoot}/tabs.yaml`, `${contentRoot}/tabs.yml`]);
        renderGroupedTabs(listTabs, tjson);
      } catch (e) { console.warn('Failed to load tabs.yaml', e); }

      setStatus('');
    })();
  })();
});
