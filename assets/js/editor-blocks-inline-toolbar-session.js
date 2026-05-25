function noop() {}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function defaultContainsNode(root, node) {
  return !!(root && node && (root === node || (root.contains && root.contains(node))));
}

function defaultInlineCommandMark(command) {
  return command === 'strikeThrough' ? 'strike' : command;
}

function createButton(documentRef, label, className = 'blocks-inline-btn') {
  const btn = documentRef.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  return btn;
}

function clearButtonState(btn) {
  btn.classList.remove('is-active');
  btn.classList.remove('is-disabled');
  btn.setAttribute('aria-pressed', 'false');
  btn.disabled = false;
  btn.removeAttribute('aria-disabled');
  btn.tabIndex = 0;
}

function applyButtonState(btn, active, disabled) {
  btn.classList.toggle('is-active', active);
  btn.classList.toggle('is-disabled', disabled);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.disabled = false;
  btn.tabIndex = disabled ? -1 : 0;
  if (disabled) {
    btn.setAttribute('aria-disabled', 'true');
  } else {
    btn.removeAttribute('aria-disabled');
  }
}

export function createEditorBlocksInlineToolbarSession({
  documentRef = null,
  state = null,
  blocksState = null,
  editableSession = null,
  root = null,
  list = null,
  menuSession = null,
  selectionSession = null,
  caretSession = null,
  text = (_key, fallback) => fallback,
  setActive = noop,
  applyInlineCommand = noop,
  containsNode = defaultContainsNode,
  closestElement = () => null,
  selectionEditableInRoot = () => null,
  getEditableSelectionOffsets = () => null,
  inlineRunsFromDom = () => [],
  hasPendingInlineMarks = () => false,
  selectionLinkInEditable = () => null,
  selectionMathInEditable = () => null,
  inlineRangeFullyMarked = () => false,
  inlineRangeAnyMarked = () => false,
  inlineMarksAtOffset = () => ({}),
  rangeHasInlineText = () => false,
  inlineCommandMark = defaultInlineCommandMark,
  now = () => Date.now()
} = {}) {
  const currentState = () => state || (blocksState && blocksState.state) || { activeIndex: -1 };
  const toolbarButtons = () => {
    return root && typeof root.querySelectorAll === 'function'
      ? safeArray(root.querySelectorAll('[data-inline-command]'))
      : [];
  };
  const blockNodes = () => {
    return list && typeof list.querySelectorAll === 'function'
      ? safeArray(list.querySelectorAll('.blocks-block'))
      : [];
  };
  const hasBlocksState = method => !!(blocksState && typeof blocksState[method] === 'function');

  const directControls = [
    ['B', 'bold', 'inlineBold', 'Bold'],
    ['I', 'italic', 'inlineItalic', 'Italic'],
    ['Link', 'link', 'inlineLink', 'Link'],
    ['\u2211', 'math', 'inlineMath', 'Math']
  ];
  const moreControls = [
    ['S', 'strikeThrough', 'inlineStrike', 'Strikethrough'],
    ['`', 'code', 'inlineCode', 'Inline code']
  ];

  const closeMoreMenu = (restoreFocus = false) => {
    if (menuSession && typeof menuSession.closeInlineMenu === 'function') {
      menuSession.closeInlineMenu(restoreFocus);
    }
  };

  const createCommandButton = (label, command, key, fallback, index, className = 'blocks-inline-btn') => {
    if (!documentRef) return null;
    const btn = createButton(documentRef, label, className);
    btn.dataset.inlineCommand = command;
    btn.title = text(key, fallback);
    btn.setAttribute('aria-label', text(key, fallback));
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('mousedown', (event) => event.preventDefault());
    btn.addEventListener('click', () => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      setActive(index);
      applyInlineCommand(command);
    });
    return btn;
  };

  const createMoreMenu = (index) => {
    if (!documentRef) return null;
    const wrap = documentRef.createElement('div');
    wrap.className = 'blocks-inline-more';
    const trigger = createButton(documentRef, 'Aa', 'blocks-inline-btn blocks-inline-more-trigger');
    const moreLabel = text('inlineMore', 'More formatting');
    trigger.title = moreLabel;
    trigger.setAttribute('aria-label', moreLabel);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = documentRef.createElement('div');
    menu.className = 'blocks-inline-more-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    moreControls.forEach(([_label, command, key, fallback]) => {
      const item = createCommandButton(text(key, fallback), command, key, fallback, index, 'blocks-inline-menu-item');
      if (!item) return;
      item.setAttribute('role', 'menuitem');
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', () => closeMoreMenu(false));
      menu.appendChild(item);
    });

    const openMenu = () => {
      if (menuSession && typeof menuSession.openInlineMenu === 'function') {
        menuSession.openInlineMenu({ wrap, trigger, menu });
      }
    };

    trigger.addEventListener('mousedown', (event) => event.preventDefault());
    trigger.addEventListener('click', () => {
      setActive(index);
      if (menuSession && typeof menuSession.isInlineMenuOpen === 'function' && menuSession.isInlineMenuOpen(menu)) {
        closeMoreMenu(false);
      } else {
        openMenu();
      }
    });

    wrap.append(trigger, menu);
    return wrap;
  };

  const createControls = (index) => {
    if (!documentRef) return null;
    const controls = documentRef.createElement('div');
    controls.className = 'blocks-inline-controls';
    controls.setAttribute('role', 'toolbar');
    controls.setAttribute('aria-label', text('inlineToolbarAria', 'Inline formatting'));
    directControls.forEach(([label, command, key, fallback]) => {
      const btn = createCommandButton(label, command, key, fallback, index);
      if (btn) controls.appendChild(btn);
    });
    const moreMenu = createMoreMenu(index);
    if (moreMenu) controls.appendChild(moreMenu);
    return controls;
  };

  function recoverActiveFromSelection(nodes) {
    const selectionEditable = selectionEditableInRoot(root, selectionSession);
    const canRecoverSelectionActive = !(
      hasBlocksState('selectionActiveRecoverySuppressed')
      && blocksState.selectionActiveRecoverySuppressed(now())
    );
    if (!selectionEditable || !canRecoverSelectionActive) return;
    const selectionBlock = closestElement(selectionEditable, '.blocks-block');
    const selectionIndex = nodes.indexOf(selectionBlock);
    if (selectionIndex < 0) return;
    if (hasBlocksState('setActiveIndex')) blocksState.setActiveIndex(selectionIndex);
    if (editableSession && typeof editableSession.bindActiveEditing === 'function') {
      editableSession.bindActiveEditing(
        blocksState,
        selectionEditable,
        hasBlocksState('getActiveSync') ? blocksState.getActiveSync() : null
      );
    }
    nodes.forEach((el, idx) => {
      if (el && el.classList && typeof el.classList.toggle === 'function') {
        el.classList.toggle('is-active', idx === currentState().activeIndex);
      }
    });
  }

  function pendingInlineMark(mark) {
    return hasBlocksState('pendingInlineMark') ? blocksState.pendingInlineMark(mark) : null;
  }

  function update() {
    const buttons = toolbarButtons();
    if (!buttons.length) return;
    const nodes = blockNodes();
    recoverActiveFromSelection(nodes);
    const editable = hasBlocksState('getActiveEditable') ? blocksState.getActiveEditable() : null;
    const activeBlock = nodes[currentState().activeIndex] || null;
    const editableInRoot = editable && containsNode(root, editable);
    const offsets = editableInRoot ? getEditableSelectionOffsets(editable, caretSession) : null;
    const runs = editableInRoot ? inlineRunsFromDom(editable) : [];
    const pending = hasPendingInlineMarks();
    const fallbackMarks = hasBlocksState('rememberedInlineMarksFor')
      ? blocksState.rememberedInlineMarksFor(editable)
      : null;
    const rememberedCodeRange = hasBlocksState('rememberedInlineRangeFor')
      ? blocksState.rememberedInlineRangeFor(editable, 'code')
      : null;
    buttons.forEach(btn => {
      if (!activeBlock || !activeBlock.contains(btn)) {
        clearButtonState(btn);
        return;
      }
      const command = btn.dataset.inlineCommand || '';
      const mark = inlineCommandMark(command);
      let active = false;
      let disabled = false;
      if (offsets && command === 'link') {
        active = !!pendingInlineMark('link')
          || !!selectionLinkInEditable(editable, selectionSession)
          || (!offsets.collapsed && inlineRangeFullyMarked(runs, offsets.start, offsets.end, 'link'));
      } else if (offsets && command === 'math') {
        active = !!selectionMathInEditable(editable, selectionSession)
          || (!offsets.collapsed && inlineRangeFullyMarked(runs, offsets.start, offsets.end, 'math'));
      } else if (mark === 'code') {
        if (offsets && offsets.collapsed) {
          const marks = inlineMarksAtOffset(runs, offsets.start);
          active = !!(marks.code || (fallbackMarks && fallbackMarks.code));
          disabled = !active;
        } else if (offsets) {
          active = inlineRangeFullyMarked(runs, offsets.start, offsets.end, mark);
          disabled = !rangeHasInlineText(runs, offsets.start, offsets.end);
        } else {
          active = !!(fallbackMarks && fallbackMarks.code);
          disabled = !rememberedCodeRange;
        }
      } else if (offsets && offsets.collapsed) {
        const marks = inlineMarksAtOffset(runs, offsets.start);
        active = pending ? !!pendingInlineMark(mark) : !!(marks[mark] || (fallbackMarks && fallbackMarks[mark]));
      } else if (offsets) {
        active = ['bold', 'italic', 'strike'].includes(mark)
          ? inlineRangeAnyMarked(runs, offsets.start, offsets.end, mark)
          : inlineRangeFullyMarked(runs, offsets.start, offsets.end, mark);
      } else if (fallbackMarks && ['bold', 'italic', 'strike', 'code'].includes(mark)) {
        active = !!fallbackMarks[mark];
      }
      applyButtonState(btn, active, disabled);
    });
  }

  return {
    closeMoreMenu,
    createControls,
    update
  };
}
