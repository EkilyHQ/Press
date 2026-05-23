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
import { createEditorMainSidebarSession } from './editor-main-sidebar-session.js?v=press-system-v3.4.50';
import { createEditorMainToolbarSession } from './editor-main-toolbar-session.js?v=press-system-v3.4.50';
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
    getCardEntries: () => editorPostPickerEntries
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
    markdownBlocksEditor.setCardEntries(Array.isArray(entries) ? entries : editorPostPickerEntries);
  };
  editorLinkCardContextListeners.add((entries) => toolbarSession.setCardEntries(entries));
  editorLinkCardContextListeners.add(handleBlocksCardContextUpdate);
  toolbarSession.setCardEntries(editorPostPickerEntries);
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
      rebuildLinkCardContext(posts, rawIndex);
      if (linkCardReady) refreshPreview();
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
      switchView('edit');
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
