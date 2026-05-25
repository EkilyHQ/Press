function noop() {}

function defaultContainsNode(root, node) {
  return !!(root && node && (root === node || (root.contains && root.contains(node))));
}

function inputValue(input) {
  return input ? String(input.value || '') : '';
}

function setHidden(node, hidden) {
  if (!node) return;
  node.hidden = !!hidden;
  node.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

function createButton(documentRef, label, className) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = className || '';
  button.textContent = label || '';
  return button;
}

export function createEditorBlocksLinkSession({
  documentRef = null,
  root = null,
  runtime = null,
  blocksState = null,
  selectionSession = null,
  caretSession = null,
  inlineDomSession = null,
  containsNode = defaultContainsNode,
  closestElement = () => null,
  text = (_key, fallback) => fallback,
  sanitizeLinkHref = value => String(value || ''),
  sanitizeLinkTitle = value => String(value || ''),
  selectionLinkInEditable = () => null,
  getEditableSelectionOffsets = () => null,
  caretRectForEditable = () => null,
  inlineRunsFromDom = () => [],
  inlineRangeText = () => '',
  applyInlineLinkToRuns = runs => runs,
  renderInlineRunsInto = noop,
  textRangeForDomNode = () => null,
  linkForTextRange = () => null,
  placeCaretAtTextOffset = noop,
  syncActiveEditable = noop,
  updateInlineToolbarState = noop,
  onDocument = () => noop,
  onWindow = () => noop,
  now = () => Date.now()
} = {}) {
  if (!documentRef || !root) return null;

  const linkEditor = documentRef.createElement('div');
  linkEditor.className = 'blocks-link-editor';
  setHidden(linkEditor, true);

  const linkText = documentRef.createElement('input');
  linkText.type = 'text';
  linkText.className = 'blocks-link-text';
  linkText.placeholder = text('linkText', 'Link text');
  linkText.setAttribute('aria-label', text('linkText', 'Link text'));

  const linkHref = documentRef.createElement('input');
  linkHref.type = 'text';
  linkHref.className = 'blocks-link-href';
  linkHref.placeholder = text('linkHref', 'Link URL');
  linkHref.setAttribute('aria-label', text('linkHref', 'Link URL'));

  const linkTitle = documentRef.createElement('input');
  linkTitle.type = 'text';
  linkTitle.className = 'blocks-link-title';
  linkTitle.placeholder = text('linkTitle', 'Link title');
  linkTitle.setAttribute('aria-label', text('linkTitle', 'Link title'));

  const unlink = createButton(documentRef, text('unlink', 'Unlink'), 'blocks-inline-btn blocks-unlink-btn');
  unlink.title = text('unlink', 'Unlink');
  unlink.setAttribute('aria-label', text('unlink', 'Unlink'));

  linkEditor.append(linkText, linkHref, linkTitle, unlink);

  const activeEditable = () => blocksState && typeof blocksState.getActiveEditable === 'function'
    ? blocksState.getActiveEditable()
    : null;

  const activeLink = () => blocksState && typeof blocksState.getActiveLink === 'function'
    ? blocksState.getActiveLink()
    : null;

  const isFocused = () => {
    try {
      const activeElement = runtime && typeof runtime.getActiveElement === 'function'
        ? runtime.getActiveElement()
        : null;
      return linkEditor.contains(activeElement);
    } catch (_) {
      return false;
    }
  };

  const focusHref = () => {
    if (!runtime || typeof runtime.setTimer !== 'function') return;
    runtime.setTimer(() => {
      try {
        linkHref.focus();
        linkHref.select();
      } catch (_) {}
    }, 0);
  };

  const positionAtRect = (rect) => {
    try {
      if (!rect) return;
      const rootRect = root.getBoundingClientRect();
      const editorRect = linkEditor.getBoundingClientRect();
      const gap = 6;
      const minLeft = 0;
      const maxLeft = Math.max(minLeft, rootRect.width - editorRect.width);
      const nextLeft = Math.min(maxLeft, Math.max(minLeft, rect.left - rootRect.left));
      linkEditor.style.left = `${nextLeft}px`;
      linkEditor.style.top = `${rect.bottom - rootRect.top + gap}px`;
    } catch (_) {}
  };

  const positionLink = (link) => {
    try {
      if (!link || !containsNode(root, link)) return;
      positionAtRect(link.getBoundingClientRect());
    } catch (_) {}
  };

  const selectionAnchorRect = (editable, offsets) => {
    try {
      const rect = offsets && offsets.range && offsets.range.getBoundingClientRect && offsets.range.getBoundingClientRect();
      if (rect && (rect.width || rect.height)) return rect;
      return caretRectForEditable(editable, caretSession);
    } catch (_) {
      return caretRectForEditable(editable, caretSession);
    }
  };

  const hide = () => {
    if (blocksState && typeof blocksState.clearLinkEditorState === 'function') {
      blocksState.clearLinkEditorState();
    }
    setHidden(linkEditor, true);
  };

  const isInternalTarget = (target) => {
    if (containsNode(linkEditor, target)) return true;
    const clickedLink = closestElement(target, 'a[href]');
    const editable = activeEditable();
    return !!(clickedLink && editable && containsNode(editable, clickedLink));
  };

  const handleOutsidePointer = (event) => {
    if (linkEditor.hidden) return;
    const target = event && event.target;
    if (!target || isInternalTarget(target)) return;
    hide();
    updateInlineToolbarState();
  };

  const apply = () => {
    const href = sanitizeLinkHref(inputValue(linkHref));
    const title = sanitizeLinkTitle(inputValue(linkTitle));
    const mode = blocksState && typeof blocksState.getLinkEditMode === 'function'
      ? blocksState.getLinkEditMode()
      : '';
    if (mode === 'pending') {
      blocksState.setPendingInlinePatch({ code: false, link: href, linkTitle: title });
      updateInlineToolbarState();
      return;
    }
    if (mode === 'range') {
      const selection = blocksState.getLinkSelection();
      if (!selection || !selection.editable || !containsNode(root, selection.editable)) return;
      const runs = inlineRunsFromDom(selection.editable);
      const currentText = inlineRangeText(runs, selection.start, selection.end);
      const nextText = inputValue(linkText);
      const replacementText = nextText !== currentText ? nextText : null;
      const nextRuns = applyInlineLinkToRuns(runs, selection.start, selection.end, href, replacementText, title);
      const nextEnd = selection.start + (replacementText != null ? nextText.length : currentText.length);
      renderInlineRunsInto(selection.editable, nextRuns, inlineDomSession);
      blocksState.updateLinkSelection({ end: nextEnd, text: nextText });
      syncActiveEditable();
      updateInlineToolbarState();
      return;
    }
    const link = activeLink();
    const editable = activeEditable();
    if (!link || !editable || !containsNode(editable, link)) return;
    const linkRange = textRangeForDomNode(editable, link, inlineDomSession);
    if (!linkRange) return;
    const runs = inlineRunsFromDom(editable);
    const currentText = inlineRangeText(runs, linkRange.start, linkRange.end);
    const nextText = inputValue(linkText);
    const replacementText = nextText !== currentText ? nextText : null;
    const nextRuns = applyInlineLinkToRuns(runs, linkRange.start, linkRange.end, href, replacementText, title);
    const nextEnd = linkRange.start + (replacementText != null ? nextText.length : currentText.length);
    renderInlineRunsInto(editable, nextRuns, inlineDomSession);
    blocksState.setActiveLink(linkForTextRange(editable, linkRange.start, nextEnd, inlineDomSession));
    syncActiveEditable();
    updateInlineToolbarState();
  };

  linkText.addEventListener('input', apply);
  linkHref.addEventListener('input', apply);
  linkTitle.addEventListener('input', apply);
  unlink.addEventListener('mousedown', (event) => event.preventDefault());
  unlink.addEventListener('click', () => {
    const mode = blocksState && typeof blocksState.getLinkEditMode === 'function'
      ? blocksState.getLinkEditMode()
      : '';
    if (mode === 'pending') {
      blocksState.setPendingInlinePatch({ link: '', linkTitle: '' });
      hide();
      updateInlineToolbarState();
      return;
    }
    if (mode === 'range') {
      linkHref.value = '';
      apply();
      hide();
      updateInlineToolbarState();
      return;
    }
    const link = activeLink();
    const editable = activeEditable();
    if (!link || !editable || !containsNode(editable, link)) return;
    const linkRange = textRangeForDomNode(editable, link, inlineDomSession);
    if (!linkRange) return;
    const nextRuns = applyInlineLinkToRuns(inlineRunsFromDom(editable), linkRange.start, linkRange.end, '');
    renderInlineRunsInto(editable, nextRuns, inlineDomSession);
    blocksState.clearActiveLink();
    try {
      editable.focus();
      placeCaretAtTextOffset(editable, linkRange.end, caretSession);
    } catch (_) {}
    syncActiveEditable();
    hide();
    updateInlineToolbarState();
  });

  const openForSelection = () => {
    const editable = activeEditable();
    if (!editable || !containsNode(root, editable)) return;
    const existingLink = selectionLinkInEditable(editable, selectionSession);
    if (existingLink) {
      blocksState.openDomLinkEditor(existingLink);
      refresh(existingLink);
      focusHref();
      return;
    }
    const offsets = getEditableSelectionOffsets(editable, caretSession);
    if (!offsets) return;
    const anchorRect = selectionAnchorRect(editable, offsets);
    blocksState.openLinkSelectionEditor(offsets.collapsed ? 'pending' : 'range', {
      editable,
      start: offsets.start,
      end: offsets.end,
      text: offsets.text,
      anchorRect
    });
    linkText.value = offsets.collapsed ? '' : offsets.text;
    linkHref.value = offsets.collapsed ? (blocksState.pendingInlineMark('link') || '') : '';
    linkTitle.value = offsets.collapsed ? (blocksState.pendingInlineMark('linkTitle') || '') : '';
    setHidden(linkEditor, false);
    positionAtRect(anchorRect);
    focusHref();
    updateInlineToolbarState();
  };

  const refresh = (explicitLink = null) => {
    const explicitLinkNode = explicitLink
      && explicitLink.nodeType === 1
      && explicitLink.matches
      && explicitLink.matches('a[href]')
      ? explicitLink
      : null;
    if (!explicitLinkNode
      && blocksState
      && typeof blocksState.linkEditorRefreshSuppressed === 'function'
      && blocksState.linkEditorRefreshSuppressed(now())) {
      if (!isFocused()) hide();
      updateInlineToolbarState();
      return;
    }
    const mode = blocksState && typeof blocksState.getLinkEditMode === 'function'
      ? blocksState.getLinkEditMode()
      : '';
    if (mode === 'range' || mode === 'pending') {
      const selection = blocksState.getLinkSelection();
      if (!linkEditor.hidden && selection && selection.anchorRect) {
        positionAtRect(selection.anchorRect);
      }
      updateInlineToolbarState();
      return;
    }
    const editable = activeEditable();
    const link = explicitLinkNode && editable && containsNode(editable, explicitLinkNode)
      ? explicitLinkNode
      : selectionLinkInEditable(editable, selectionSession);
    if (link) {
      blocksState.setActiveLink(link, explicitLinkNode ? { holdUntil: now() + 800 } : {});
    } else if (!isFocused()) {
      const currentLink = activeLink();
      const keepClickedLink = currentLink
        && editable
        && containsNode(editable, currentLink)
        && now() < blocksState.getActiveLinkHoldUntil();
      if (!keepClickedLink) blocksState.clearActiveLink();
    }
    const currentActiveLink = activeLink() && activeEditable() && containsNode(activeEditable(), activeLink())
      ? activeLink()
      : null;
    if (!currentActiveLink) {
      if (!isFocused()) hide();
      updateInlineToolbarState();
      return;
    }
    blocksState.openDomLinkEditor(currentActiveLink);
    setHidden(linkEditor, false);
    if (!isFocused()) {
      linkText.value = currentActiveLink.textContent || '';
      linkHref.value = currentActiveLink.getAttribute('href') || '';
      linkTitle.value = currentActiveLink.getAttribute('title') || '';
    }
    positionLink(currentActiveLink);
    updateInlineToolbarState();
  };

  const bind = () => {
    const disposers = [];
    const addRootListener = (type, handler, options) => {
      try {
        root.addEventListener(type, handler, options);
        disposers.push(() => {
          try { root.removeEventListener(type, handler, options); } catch (_) {}
        });
      } catch (_) {}
    };
    addRootListener('keyup', refresh);
    addRootListener('mouseup', refresh);
    addRootListener('focusin', refresh);
    disposers.push(onDocument('pointerdown', handleOutsidePointer, true));
    disposers.push(onDocument('mousedown', handleOutsidePointer, true));
    disposers.push(onWindow('resize', refresh));
    disposers.push(onWindow('scroll', refresh, true));
    disposers.push(onDocument('selectionchange', () => {
      const editable = activeEditable();
      if (!editable || !containsNode(root, editable)) return;
      refresh();
    }));
    return () => {
      disposers.splice(0).forEach(dispose => {
        try { if (typeof dispose === 'function') dispose(); } catch (_) {}
      });
    };
  };

  return {
    element: linkEditor,
    fields: { text: linkText, href: linkHref, title: linkTitle, unlink },
    apply,
    bind,
    hide,
    isFocused,
    openForSelection,
    refresh,
    handleOutsidePointer,
    positionAtRect
  };
}
