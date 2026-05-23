import { createMarkdownBlocksEditor } from './editor-blocks.js?v=press-system-v3.4.50';
import { hydrateInternalLinkCards } from './link-cards.js?v=press-system-v3.4.50';

const noop = () => {};
const fallbackTranslate = (key) => key;

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

function createBlockLabels(translateImpl) {
  return new Proxy({}, {
    get: (_target, key) => {
      const name = String(key || '');
      const translationKey = `editor.blocks.${name}`;
      let translated = translationKey;
      try { translated = translateImpl(translationKey); } catch (_) {}
      return translated != null && translated !== translationKey
        ? translated
        : (blockLabelFallbacks[name] || name);
    }
  });
}

export function createEditorMainBlocksSession(options = {}) {
  const runtime = options.runtime || {};
  const root = options.root || null;
  const translate = typeof options.translate === 'function' ? options.translate : fallbackTranslate;
  const getContentRoot = typeof options.getContentRoot === 'function' ? options.getContentRoot : () => 'wwwroot';
  const getEditorBody = typeof options.getEditorBody === 'function' ? options.getEditorBody : () => '';
  const onBodyChange = typeof options.onBodyChange === 'function' ? options.onBodyChange : noop;
  const getCurrentMarkdownPath = typeof options.getCurrentMarkdownPath === 'function' ? options.getCurrentMarkdownPath : () => '';
  const getSiteConfig = typeof options.getSiteConfig === 'function' ? options.getSiteConfig : () => ({});
  const getPreviewSession = typeof options.getPreviewSession === 'function' ? options.getPreviewSession : () => null;
  const getImageSession = typeof options.getImageSession === 'function' ? options.getImageSession : () => null;
  const linkCardContext = options.linkCardContext || null;
  const resolveImageSrc = typeof options.resolveImageSrc === 'function' ? options.resolveImageSrc : (src) => src;
  const createBlocksEditor = typeof options.createBlocksEditor === 'function'
    ? options.createBlocksEditor
    : createMarkdownBlocksEditor;
  const hydrateLinkCards = typeof options.hydrateLinkCards === 'function'
    ? options.hydrateLinkCards
    : hydrateInternalLinkCards;

  let blocksEditor = null;
  let boundCardEntries = false;

  const getBaseDir = () => {
    const fallback = `${getContentRoot()}/`;
    if (runtime && typeof runtime.getEditorBaseDir === 'function') {
      return runtime.getEditorBaseDir(fallback);
    }
    return fallback;
  };

  const applyAssetOverrides = (node) => {
    const previewSession = getPreviewSession();
    try {
      if (previewSession && typeof previewSession.applyAssetOverrides === 'function') {
        previewSession.applyAssetOverrides(node, getCurrentMarkdownPath());
      }
    } catch (_) {}
  };

  const hydrateImages = (node) => {
    applyAssetOverrides(node);
  };

  const hydrateCard = (node) => {
    try {
      if (linkCardContext && typeof linkCardContext.createHydrateOptions === 'function') {
        hydrateLinkCards(node, linkCardContext.createHydrateOptions({
          siteConfig: getSiteConfig() || {},
          translate
        }));
      }
      applyAssetOverrides(node);
    } catch (_) {}
  };

  const getImageActionSession = () => getImageSession() || {};

  const requestImageUpload = (detail) => {
    const imageSession = getImageActionSession();
    if (typeof imageSession.requestBlocksImageUpload === 'function') {
      return imageSession.requestBlocksImageUpload(detail);
    }
    return undefined;
  };

  const canDeleteImageResource = (src) => {
    const imageSession = getImageActionSession();
    return typeof imageSession.canDeleteImageResource === 'function'
      ? imageSession.canDeleteImageResource(src)
      : false;
  };

  const requestImageDelete = (detail) => {
    const imageSession = getImageActionSession();
    if (typeof imageSession.requestBlocksImageDelete === 'function') {
      return imageSession.requestBlocksImageDelete(detail);
    }
    return undefined;
  };

  const setCardEntries = (entries) => {
    if (!blocksEditor || typeof blocksEditor.setCardEntries !== 'function') return;
    const fallback = linkCardContext && typeof linkCardContext.getCardEntries === 'function'
      ? linkCardContext.getCardEntries()
      : [];
    blocksEditor.setCardEntries(Array.isArray(entries) ? entries : fallback);
  };

  const bindCardEntries = () => {
    if (boundCardEntries || !linkCardContext) return;
    boundCardEntries = true;
    if (typeof linkCardContext.onCardEntriesChange === 'function') {
      linkCardContext.onCardEntriesChange((entries) => setCardEntries(entries));
    }
    if (typeof linkCardContext.getCardEntries === 'function') {
      setCardEntries(linkCardContext.getCardEntries());
    }
  };

  const initialize = () => {
    if (blocksEditor || !root) {
      bindCardEntries();
      return blocksEditor;
    }
    blocksEditor = createBlocksEditor(root, {
      labels: createBlockLabels(translate),
      onChange: onBodyChange,
      getBaseDir,
      resolveImageSrc,
      hydrateImages,
      hydrateCard,
      requestImageUpload,
      canDeleteImageResource,
      requestImageDelete
    });
    bindCardEntries();
    return blocksEditor;
  };

  const getEditor = () => blocksEditor;

  const syncFromSource = () => {
    if (!blocksEditor && root) initialize();
    if (blocksEditor && typeof blocksEditor.setMarkdown === 'function') {
      blocksEditor.setMarkdown(getEditorBody());
      return true;
    }
    return false;
  };

  const syncIfVisible = (body) => {
    if (!root || root.hidden) return false;
    if (!blocksEditor) initialize();
    if (blocksEditor && typeof blocksEditor.setMarkdown === 'function') {
      blocksEditor.setMarkdown(body == null ? '' : String(body));
      return true;
    }
    return false;
  };

  const requestLayout = () => {
    if (blocksEditor && typeof blocksEditor.requestLayout === 'function') {
      try {
        blocksEditor.requestLayout();
        return true;
      } catch (_) {}
    }
    return false;
  };

  const focus = () => {
    if (blocksEditor && typeof blocksEditor.focus === 'function') {
      try {
        blocksEditor.focus();
        return true;
      } catch (_) {}
    }
    return false;
  };

  return {
    initialize,
    getEditor,
    syncFromSource,
    syncIfVisible,
    requestLayout,
    focus,
    setCardEntries,
    labels: createBlockLabels(translate)
  };
}
