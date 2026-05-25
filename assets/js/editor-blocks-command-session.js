function noop() {}

function safeText(value) {
  return String(value == null ? '' : value);
}

function cloneCommandData(value) {
  if (Array.isArray(value)) return value.map(item => cloneCommandData(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneCommandData(item)]));
  }
  return value;
}

function createButton(documentRef, label, className) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = className || 'blocks-btn';
  button.textContent = label || '';
  return button;
}

function isPlainEnter(event) {
  return !!event
    && event.key === 'Enter'
    && !event.shiftKey
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
    && !event.isComposing;
}

function prevent(event) {
  try { event?.preventDefault?.(); } catch (_) {}
}

function focusSafely(element) {
  try { element?.focus?.(); } catch (_) {}
}

function blockIdSelector(blockId) {
  return String(blockId || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function createEditorBlocksCommandSession({
  documentRef = null,
  state = { blocks: [] },
  blocksState = null,
  list = null,
  editableSession = null,
  text = (_key, fallback) => fallback,
  createBlockTypeIcon = () => null,
  defaultListItems = () => [{ text: 'List item', checked: false, listType: 'ul' }],
  normalizeEditableMarkdownText = safeText,
  editableText = node => safeText(node?.textContent),
  closeBlockActionMenu = noop,
  closeInlineMoreMenu = noop,
  placeCommandBlock = () => null,
  render = noop,
  emit = noop,
  focusBlockPrimaryEditable = noop,
  insertBlankBlock = noop,
  removeEmptyBlockWithBackspace = () => false,
  handleCrossBlockArrowNavigation = () => false,
  setActive = noop,
  updateInlineToolbarState = noop,
  getCardPickerSession = () => null,
  queueTask = task => queueMicrotask(task)
} = {}) {
  if (!documentRef) return null;

  const commandBlocks = () => [
    ['paragraph', 'paragraph', 'Paragraph', { text: 'New paragraph' }],
    ['heading', 'heading', 'Heading', { level: 2, text: 'Heading' }],
    ['image', 'image', 'Image', { alt: '', src: '' }],
    ['table', 'table', 'Table', { headers: ['Column 1', 'Column 2'], alignments: ['', ''], rows: [['', '']] }],
    ['list', 'list', 'List', { listType: 'ul', items: defaultListItems() }],
    ['quote', 'quote', 'Quote', { text: 'Quote' }],
    ['code', 'code', 'Code', { lang: '', text: '' }],
    ['math', 'math', 'Math', { tex: '' }],
    ['source', 'source', 'Markdown', { text: '' }]
  ];

  const commandInsertIndex = () => (
    Number.isInteger(state.commandMenuInsertIndex)
      ? state.commandMenuInsertIndex
      : (Array.isArray(state.blocks) ? state.blocks.length : 0)
  );

  const focusFirstCommandItem = (blockId = '') => {
    if (!list || typeof list.querySelector !== 'function') return false;
    const scoped = blockId
      ? list.querySelector(`.blocks-block[data-block-id="${blockIdSelector(blockId)}"] .blocks-command-menu-item`)
      : null;
    const first = scoped || list.querySelector('.blocks-command-menu-item');
    focusSafely(first);
    return !!first;
  };

  const closeMenu = (restoreFocus = false) => {
    if (!state.commandMenuOpen || !blocksState?.closeCommandMenu) return false;
    const restoreIndex = blocksState.closeCommandMenu();
    render();
    if (restoreFocus) {
      if (Number.isInteger(restoreIndex) && state.blocks?.[restoreIndex]) {
        focusBlockPrimaryEditable(state.blocks[restoreIndex], 0);
      } else {
        const trailingBlank = Array.isArray(state.blocks)
          ? state.blocks.slice().reverse().find(block => block && block.type === 'blank')
          : null;
        if (trailingBlank) focusBlockPrimaryEditable(trailingBlank, 0);
      }
    }
    return true;
  };

  const openMenu = (insertIndex = state.blocks?.length || 0) => {
    if (!blocksState?.openCommandMenu) return null;
    closeBlockActionMenu(false);
    closeInlineMoreMenu(false);
    const safeIndex = blocksState.openCommandMenu(insertIndex);
    render();
    queueTask(() => {
      const block = state.blocks?.[state.commandMenuInsertIndex] || null;
      focusFirstCommandItem(block?.id || '');
    });
    return safeIndex;
  };

  const insertCommandBlock = (type, data = {}, options = {}) => {
    const insertIndex = blocksState?.beginCommandBlockInsert
      ? blocksState.beginCommandBlockInsert(options)
      : commandInsertIndex();
    const block = placeCommandBlock(type, cloneCommandData(data), insertIndex);
    if (options.focus) focusBlockPrimaryEditable(block, options.caretOffset);
    return block;
  };

  const createParagraphFromBlankInput = (value, insertIndex = state.blocks?.length || 0) => {
    const textValue = normalizeEditableMarkdownText(value);
    if (!textValue) return null;
    return insertCommandBlock('paragraph', { text: textValue }, {
      focus: true,
      caretOffset: textValue.length,
      index: insertIndex
    });
  };

  const openArticleCardCommand = () => {
    const insertIndex = commandInsertIndex();
    const cardPickerSession = getCardPickerSession();
    if (cardPickerSession?.open) {
      cardPickerSession.open(insertIndex);
      return;
    }
    insertCommandBlock('card', { label: 'Article', location: '', title: 'card', forceCard: true }, { index: insertIndex });
  };

  const runBlockCommand = (type, data = {}) => {
    const focusTypes = new Set(['paragraph', 'heading', 'table', 'list', 'quote', 'code', 'source']);
    insertCommandBlock(type, data, { focus: focusTypes.has(type) });
  };

  const createCommandMenuElement = (isCommandOpen) => {
    const menu = documentRef.createElement('div');
    menu.className = 'blocks-command-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', text('commandMenuAria', 'Block selector'));
    menu.hidden = !isCommandOpen;
    menu.setAttribute('aria-hidden', isCommandOpen ? 'false' : 'true');
    commandBlocks().forEach(([key, type, fallback, data]) => {
      const itemBtn = createButton(documentRef, '', 'blocks-command-menu-item');
      itemBtn.dataset.blockCommand = type;
      itemBtn.setAttribute('role', 'menuitem');
      itemBtn.appendChild(createBlockTypeIcon(type));
      const label = documentRef.createElement('span');
      label.textContent = text(key, fallback);
      itemBtn.appendChild(label);
      itemBtn.addEventListener('click', () => runBlockCommand(type, data));
      menu.appendChild(itemBtn);
    });
    const cardBtn = createButton(documentRef, '', 'blocks-command-menu-item');
    cardBtn.dataset.blockCommand = 'card';
    cardBtn.setAttribute('role', 'menuitem');
    cardBtn.appendChild(createBlockTypeIcon('card'));
    const cardLabel = documentRef.createElement('span');
    cardLabel.textContent = text('articleCard', 'Article Card');
    cardBtn.appendChild(cardLabel);
    cardBtn.addEventListener('click', openArticleCardCommand);
    menu.appendChild(cardBtn);
    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        prevent(event);
        closeMenu(true);
      }
    });
    return menu;
  };

  const renderBlankBlock = (body, block, index) => {
    const isCommandOpen = state.commandMenuOpen && state.commandMenuInsertIndex === index;
    body.classList.add('blocks-virtual-body');
    const editable = documentRef.createElement('p');
    editable.className = 'blocks-rich-editable blocks-paragraph-text blocks-virtual-editable blocks-blank-editable';
    editable.contentEditable = 'true';
    editable.spellcheck = true;
    editable.setAttribute('aria-label', text('virtualBlockAria', 'New block'));
    editable.dataset.placeholder = text('virtualBlockPlaceholder', 'Type / to chose a block');
    editableSession?.registerEditable?.(editable, null);
    editable.addEventListener('beforeinput', (event) => {
      if (event.isComposing) return;
      if (event.inputType !== 'insertText' || event.data == null) return;
      prevent(event);
      if (event.data === '/') {
        openMenu(index);
        return;
      }
      createParagraphFromBlankInput(event.data, index);
    });
    editable.addEventListener('input', () => {
      const value = editableText(editable);
      if (!value) return;
      if (value === '/') {
        editable.textContent = '';
        openMenu(index);
        return;
      }
      createParagraphFromBlankInput(value, index);
    });
    editable.addEventListener('paste', (event) => {
      const pasted = event.clipboardData && event.clipboardData.getData('text/plain');
      if (!pasted) return;
      prevent(event);
      createParagraphFromBlankInput(pasted, index);
    });
    editable.addEventListener('keydown', (event) => {
      if (isPlainEnter(event)) {
        prevent(event);
        insertBlankBlock(index + 1, { focus: true });
        return;
      }
      if (removeEmptyBlockWithBackspace(event, block, index, editable, null)) return;
      if (handleCrossBlockArrowNavigation(event, index, editable)) return;
      if (event.key === 'Escape' && isCommandOpen) {
        prevent(event);
        closeMenu(true);
      }
    });
    editable.addEventListener('focus', () => {
      setActive(index, editable, null);
      updateInlineToolbarState();
    });
    body.append(editable, createCommandMenuElement(isCommandOpen));
  };

  return {
    closeMenu,
    openMenu,
    focusFirstCommandItem,
    insertCommandBlock,
    createCommandMenuElement,
    renderBlankBlock
  };
}
