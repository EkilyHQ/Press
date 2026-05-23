function fallbackText(_key, fallback) {
  return fallback;
}

function createElement(documentRef, tagName) {
  if (documentRef && typeof documentRef.createElement === 'function') {
    return documentRef.createElement(tagName);
  }
  return document.createElement(tagName);
}

function appendIf(parent, child) {
  if (parent && child) parent.appendChild(child);
  return child;
}

function callRenderer(renderers, type, body, block, index) {
  const render = renderers && typeof renderers[type] === 'function' ? renderers[type] : null;
  if (render) render(body, block, index);
}

export function createEditorBlocksBodySession({
  documentRef = null,
  state = { blocks: [], activeIndex: 0 },
  list = null,
  text = fallbackText,
  headSession = null,
  blockElements = () => [],
  renderers = {},
  closestElement = null,
  createRichEditable = null,
  renderMath = null,
  hydrateCard = null,
  setActive = () => {},
  activateNonTextBlockFromPointer = () => {},
  openMathEditorForBlock = () => {},
  shouldSuppressRoutedBlockContainerClick = () => false,
  removeEmptyBlockWithBackspace = () => false,
  handleCrossBlockArrowNavigation = () => false
} = {}) {
  const doc = documentRef;
  const closest = (node, selector) => {
    if (typeof closestElement === 'function') return closestElement(node, selector);
    return node && typeof node.closest === 'function' ? node.closest(selector) : null;
  };

  const renderHeadingBlock = (body, block, index) => {
    const level = Math.max(1, Math.min(6, Number(block && block.data && block.data.level) || 2));
    appendIf(body, createRichEditable?.(`h${level}`, block, 'text', `blocks-rich-editable blocks-heading-text blocks-heading-h${level}`, index));
  };

  const renderMathBlock = (body, block, index) => {
    const preview = createElement(doc, 'div');
    preview.className = 'blocks-math-preview';
    const math = createElement(doc, 'div');
    math.className = 'press-math press-math-display blocks-display-math';
    const tex = block && block.data ? block.data.tex || '' : '';
    math.dataset.tex = tex;
    math.setAttribute('data-tex', tex);
    math.textContent = tex || text('math', 'Math');
    preview.appendChild(math);
    preview.addEventListener('pointerdown', (event) => {
      if (!event || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      event.stopPropagation();
      activateNonTextBlockFromPointer(index, closest(preview, '.blocks-block-math'));
    });
    preview.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActive(index);
      openMathEditorForBlock(block, closest(preview, '.blocks-block-math'));
    });
    body.appendChild(preview);
    try {
      if (typeof renderMath === 'function') renderMath(preview);
    } catch (_) {}
  };

  const renderCardBlock = (body, block, index) => {
    const preview = createElement(doc, 'div');
    preview.className = 'blocks-card-preview';
    const span = createElement(doc, 'span');
    span.className = 'blocks-card-source';
    const link = createElement(doc, 'a');
    const data = block && block.data ? block.data : {};
    const href = `?id=${encodeURIComponent(String(data.location || '').trim())}`;
    const label = String(data.label || data.location || text('articleCard', 'Article Card')).trim() || text('articleCard', 'Article Card');
    link.setAttribute('href', href);
    link.setAttribute('title', 'card');
    link.textContent = label;
    span.appendChild(link);
    preview.appendChild(span);
    preview.addEventListener('pointerdown', (event) => {
      if (!event || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      event.stopPropagation();
      activateNonTextBlockFromPointer(index, closest(preview, '.blocks-block-card'));
    });
    preview.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActive(index);
    });
    body.appendChild(preview);
    try {
      if (typeof hydrateCard === 'function') hydrateCard(preview);
    } catch (_) {}
    if (preview && typeof preview.querySelectorAll === 'function') {
      preview.querySelectorAll('a[href]').forEach((item) => {
        item.tabIndex = -1;
        item.setAttribute('aria-disabled', 'true');
      });
    }
  };

  const renderBlockBody = (block, index) => {
    const body = createElement(doc, 'div');
    body.className = 'blocks-block-body blocks-visual-body';
    const type = block && block.type ? block.type : 'source';
    if (type === 'blank') {
      callRenderer(renderers, 'blank', body, block, index);
    } else if (type === 'heading') {
      renderHeadingBlock(body, block, index);
    } else if (type === 'paragraph') {
      appendIf(body, createRichEditable?.('p', block, 'text', 'blocks-rich-editable blocks-paragraph-text', index));
    } else if (type === 'quote') {
      const quote = createElement(doc, 'blockquote');
      quote.className = 'blocks-quote-preview';
      appendIf(quote, createRichEditable?.('p', block, 'text', 'blocks-rich-editable blocks-quote-text', index));
      body.appendChild(quote);
    } else if (type === 'image') {
      callRenderer(renderers, 'image', body, block, index);
    } else if (type === 'table') {
      callRenderer(renderers, 'table', body, block, index);
    } else if (type === 'list') {
      callRenderer(renderers, 'list', body, block, index);
    } else if (type === 'code') {
      callRenderer(renderers, 'code', body, block, index);
    } else if (type === 'math') {
      renderMathBlock(body, block, index);
    } else if (type === 'card') {
      renderCardBlock(body, block, index);
    } else {
      callRenderer(renderers, 'source', body, block, index);
    }
    body.addEventListener('click', (event) => {
      if (shouldSuppressRoutedBlockContainerClick()) {
        event.stopPropagation();
        return;
      }
      setActive(index);
    });
    return body;
  };

  const renderBlockElement = (block, index) => {
    const item = createElement(doc, 'section');
    const type = block && block.type ? block.type : 'source';
    item.className = `blocks-block blocks-block-${type}`;
    if (index === state.activeIndex) item.classList.add('is-active');
    item.dataset.type = type;
    item.dataset.blockId = block && block.id ? block.id : '';
    item.tabIndex = -1;
    const head = headSession && typeof headSession.createBlockHead === 'function'
      ? headSession.createBlockHead({
          block,
          index,
          blockCount: Array.isArray(state.blocks) ? state.blocks.length : 0
        })
      : createElement(doc, 'div');
    item.append(head, renderBlockBody(block, index));
    item.addEventListener('click', (event) => {
      if (shouldSuppressRoutedBlockContainerClick()) return;
      if (closest(event.target, '.blocks-block-head')) return;
      setActive(index);
    });
    item.addEventListener('focusin', () => setActive(index));
    item.addEventListener('keydown', (event) => {
      if (event.target !== item) return;
      if (removeEmptyBlockWithBackspace(event, block, index)) return;
      handleCrossBlockArrowNavigation(event, index);
    });
    return item;
  };

  const replaceAdjacentBlockElements = (index, targetIndex) => {
    const firstIndex = Math.min(index, targetIndex);
    const secondIndex = Math.max(index, targetIndex);
    const nodes = Array.from(blockElements() || []);
    const firstOld = nodes[firstIndex];
    const secondOld = nodes[secondIndex];
    if (!list || !firstOld || !secondOld || !firstOld.parentNode || !secondOld.parentNode) return false;
    const firstNew = renderBlockElement(state.blocks[firstIndex], firstIndex);
    const secondNew = renderBlockElement(state.blocks[secondIndex], secondIndex);
    list.insertBefore(firstNew, firstOld);
    firstOld.remove();
    list.insertBefore(secondNew, secondOld);
    secondOld.remove();
    setActive(state.activeIndex);
    return true;
  };

  return {
    renderBlockBody,
    renderBlockElement,
    replaceAdjacentBlockElements
  };
}
