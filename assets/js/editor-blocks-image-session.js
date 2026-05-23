function noop() {}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function createButton(documentRef, label, className) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = className || 'blocks-btn';
  button.textContent = label || '';
  return button;
}

function inputValue(input) {
  return input ? String(input.value || '') : '';
}

function plainEditableValue(editable) {
  return String(editable && editable.textContent != null ? editable.textContent : '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\r\n]+/g, ' ');
}

export function createEditorBlocksImageSession({
  documentRef = typeof document !== 'undefined' ? document : null,
  blocksState = null,
  editableSession = null,
  blockElements = () => [],
  text = (_key, fallback) => fallback,
  selectionSession = null,
  insertPlainTextIntoEditable = () => false,
  removeEmptyBlockWithBackspace = () => false,
  handleCrossBlockArrowNavigation = () => false,
  updateInlineToolbarState = noop,
  updateFromControl = noop,
  insertBlock = () => null,
  deleteBlockAt = noop,
  setActive = noop,
  resolveAssetSrc = value => value,
  hydrateImages = noop,
  requestImageUpload = null,
  canDeleteImageResource = null,
  requestImageDelete = null
} = {}) {
  if (!documentRef) return null;

  const stateBlocks = () => safeArray(blocksState && blocksState.state && blocksState.state.blocks);

  const blockElementFor = (block) => {
    const id = block && block.id;
    return safeArray(blockElements()).find(el => el && el.dataset && el.dataset.blockId === id) || null;
  };

  const setPlaceholderVisible = (figure, visible) => {
    if (!figure || !figure.classList) return;
    figure.classList.toggle('is-image-placeholder', !!visible);
  };

  const configurePreview = (figure, img, src) => {
    if (!img) return;
    const nextSrc = String(src || '').trim();
    img.dataset.blocksResolvedSrc = nextSrc;
    img.onload = () => {
      if (img.dataset.blocksResolvedSrc !== nextSrc || !nextSrc) return;
      setPlaceholderVisible(figure, false);
    };
    img.onerror = () => {
      if (img.dataset.blocksResolvedSrc !== nextSrc) return;
      setPlaceholderVisible(figure, true);
    };
    if (!nextSrc) {
      img.removeAttribute('src');
      setPlaceholderVisible(figure, true);
      return;
    }
    setPlaceholderVisible(figure, false);
    if (img.getAttribute('src') !== nextSrc) img.src = nextSrc;
    if (img.complete && img.naturalWidth === 0) setPlaceholderVisible(figure, true);
  };

  const updateCaptionAlt = (block, caption) => {
    const blockEl = blockElementFor(block);
    const img = blockEl && blockEl.querySelector ? blockEl.querySelector('.blocks-image-preview') : null;
    const alt = plainEditableValue(caption);
    if (img) img.alt = alt;
    if (caption && caption.classList) caption.classList.toggle('is-empty', !alt);
    updateFromControl(block, { alt });
  };

  const createMetadataControls = (block, index) => {
    const controls = documentRef.createElement('div');
    controls.className = 'blocks-image-meta-controls';

    const replace = createButton(documentRef, text('replaceImage', 'Replace image'), 'blocks-btn blocks-image-replace');
    replace.title = text('replaceImage', 'Replace image');
    replace.setAttribute('aria-label', text('replaceImage', 'Replace image'));

    const deleteResource = createButton(documentRef, text('deleteImageResource', 'Delete resource'), 'blocks-btn blocks-image-delete-resource');
    deleteResource.title = text('deleteImageResource', 'Delete resource');
    deleteResource.setAttribute('aria-label', text('deleteImageResource', 'Delete resource'));

    const title = documentRef.createElement('input');
    title.type = 'text';
    title.className = 'blocks-image-title';
    title.value = block && block.data ? block.data.title || '' : '';
    title.placeholder = text('imageTitle', 'Image title');
    title.setAttribute('aria-label', text('imageTitle', 'Image title'));
    title.addEventListener('input', () => {
      updateFromControl(block, { title: inputValue(title) });
    });

    replace.addEventListener('mousedown', (event) => event.preventDefault());
    replace.addEventListener('click', () => {
      setActive(index);
      if (typeof requestImageUpload === 'function') {
        requestImageUpload({ replaceIndex: index, replaceBlockId: block && block.id });
      }
    });

    deleteResource.disabled = !(typeof canDeleteImageResource === 'function' && canDeleteImageResource(block && block.data ? block.data.src || '' : '', {
      index,
      blockId: block && block.id
    }));
    deleteResource.addEventListener('mousedown', (event) => event.preventDefault());
    deleteResource.addEventListener('click', () => {
      if (deleteResource.disabled) return;
      setActive(index);
      if (typeof requestImageDelete === 'function') {
        requestImageDelete({ index, blockId: block && block.id, src: block && block.data ? block.data.src || '' : '' });
      }
    });

    controls.append(title, replace, deleteResource);
    return controls;
  };

  const renderBlock = (body, block, index) => {
    if (!body || !block) return;

    const figure = documentRef.createElement('figure');
    figure.className = 'blocks-image-figure';

    const img = documentRef.createElement('img');
    img.className = 'blocks-image-preview';
    img.alt = block.data && block.data.alt ? block.data.alt : '';
    img.loading = 'lazy';
    img.decoding = 'async';

    const placeholder = documentRef.createElement('div');
    placeholder.className = 'blocks-image-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');

    const placeholderLabel = documentRef.createElement('span');
    placeholderLabel.className = 'blocks-image-placeholder-label';
    placeholderLabel.textContent = text('image', 'Image');
    placeholder.appendChild(placeholderLabel);

    configurePreview(figure, img, resolveAssetSrc(block.data && block.data.src ? block.data.src : ''));

    const caption = documentRef.createElement('figcaption');
    caption.className = 'blocks-image-caption';
    caption.contentEditable = 'true';
    caption.spellcheck = true;
    caption.dataset.placeholder = text('imageAlt', 'Alt text');
    caption.setAttribute('aria-label', text('imageAlt', 'Alt text'));
    caption.textContent = block.data && block.data.alt ? block.data.alt : '';
    caption.classList.toggle('is-empty', !(block.data && block.data.alt));

    const syncCaption = () => updateCaptionAlt(block, caption);
    if (editableSession && typeof editableSession.registerEditable === 'function') {
      editableSession.registerEditable(caption, syncCaption);
    }
    caption.addEventListener('input', syncCaption);
    caption.addEventListener('paste', (event) => {
      const pasted = event.clipboardData && event.clipboardData.getData('text/plain');
      if (pasted == null) return;
      event.preventDefault();
      if (insertPlainTextIntoEditable(caption, pasted.replace(/[\r\n]+/g, ' '), selectionSession)) syncCaption();
    });
    caption.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        return;
      }
      if (removeEmptyBlockWithBackspace(event, block, index, caption, syncCaption)) return;
      handleCrossBlockArrowNavigation(event, index, caption);
    });
    caption.addEventListener('focus', () => {
      setActive(index, caption, syncCaption);
      updateInlineToolbarState();
    });

    figure.append(img, placeholder, caption);
    body.append(figure);
    hydrateImages(figure);
  };

  const resolveImageBlockTarget = (target) => {
    if (blocksState && typeof blocksState.resolveBlockTarget === 'function') {
      return blocksState.resolveBlockTarget(target, block => block && block.type === 'image');
    }
    return null;
  };

  const insertImageBlock = (src, alt, index) => {
    const block = insertBlock('image', { src, alt: alt || '', title: '' }, index);
    return { index: stateBlocks().indexOf(block) };
  };

  const replaceImageBlock = (src, target) => {
    const resolved = resolveImageBlockTarget(target);
    if (!resolved) return null;
    const { block, index: safeIndex } = resolved;
    updateFromControl(block, { src }, true);
    setActive(safeIndex);
    return { index: safeIndex };
  };

  const getImageBlockSource = (target) => {
    const resolved = resolveImageBlockTarget(target);
    return resolved ? String((resolved.block.data && resolved.block.data.src) || '') : '';
  };

  const deleteImageBlock = (target) => {
    const resolved = resolveImageBlockTarget(target);
    if (!resolved) return null;
    const src = String((resolved.block.data && resolved.block.data.src) || '');
    deleteBlockAt(resolved.index);
    return { index: resolved.index, src };
  };

  return {
    createMetadataControls,
    deleteImageBlock,
    getImageBlockSource,
    insertImageBlock,
    renderBlock,
    replaceImageBlock
  };
}
