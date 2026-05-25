const noop = () => {};
const fallbackTranslate = (key) => key;

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

function fallbackElementById(documentRef, id) {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

export function createEditorMainToolbarSession(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const translateImpl = typeof options.translate === 'function' ? options.translate : fallbackTranslate;
  const getEditorTextarea = typeof options.getEditorTextarea === 'function' ? options.getEditorTextarea : () => null;
  const getCardEntries = typeof options.getCardEntries === 'function' ? options.getCardEntries : null;
  const getElementById = (id) => (
    typeof runtime.getElementById === 'function'
      ? runtime.getElementById(id)
      : fallbackElementById(documentRef, id)
  );
  const onDocument = typeof runtime.onDocument === 'function' ? runtime.onDocument.bind(runtime) : () => noop;
  const onWindow = typeof runtime.onWindow === 'function' ? runtime.onWindow.bind(runtime) : () => noop;
  const setTimer = typeof runtime.setTimer === 'function' ? runtime.setTimer.bind(runtime) : (fn) => {
    if (typeof fn === 'function') {
      try { fn(); } catch (_) {}
    }
    return null;
  };
  const clearTimer = typeof runtime.clearTimer === 'function' ? runtime.clearTimer.bind(runtime) : noop;
  const createInputEvent = typeof options.createInputEvent === 'function'
    ? options.createInputEvent
    : () => {
      if (typeof runtime.createEvent === 'function') {
        return runtime.createEvent('input', { bubbles: true, cancelable: true });
      }
      return null;
    };

  const editorToolbarEl = options.editorToolbarEl || getElementById('editorToolbar');
  const cardButton = options.cardButton || getElementById('btnInsertCard');
  const cardPopover = options.cardPopover || getElementById('editorCardPicker');
  const cardSearchInput = options.cardSearchInput || getElementById('cardPickerSearch');
  const cardListEl = options.cardListEl || getElementById('cardPickerList');
  const cardEmptyEl = options.cardEmptyEl || getElementById('cardPickerEmpty');

  let cardEntries = Array.isArray(options.cardEntries) ? options.cardEntries : [];
  let lastSelectionRange = { start: 0, end: 0 };
  let suppressSelectionTracking = false;
  let formattingButtons = [];
  let cardPopoverOpen = false;
  let cardPopoverClosing = false;
  let cardPopoverCloseTimer = null;
  let cardPopoverTransitionHandler = null;
  let detachCardMouseDown = noop;
  let detachCardKeydown = noop;
  let detachCardResize = noop;
  let detachCardScroll = noop;
  let bound = false;

  const tooltipButtons = new Set();

  const translate = (key, params) => {
    try {
      return translateImpl(key, params);
    } catch (_) {
      return key;
    }
  };

  const readCardEntries = () => {
    if (getCardEntries) {
      const entries = getCardEntries();
      return Array.isArray(entries) ? entries : [];
    }
    return Array.isArray(cardEntries) ? cardEntries : [];
  };

  const dispatchInputEvent = (textarea) => {
    if (!textarea || typeof textarea.dispatchEvent !== 'function') return;
    const event = createInputEvent();
    if (event) textarea.dispatchEvent(event);
  };

  function applyButtonTooltipState(button, disabled) {
    if (!button) return;
    const baseTitle = (() => {
      const titleKey = button.dataset.enabledTitleKey || button.getAttribute('data-i18n-title');
      if (titleKey) {
        const translated = translate(titleKey);
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
        const translatedHint = translate(hintKey);
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

  const getNormalizedSelection = () => {
    const textarea = getEditorTextarea();
    if (!textarea) return { start: 0, end: 0 };
    let start = textarea.selectionStart ?? 0;
    let end = textarea.selectionEnd ?? start;
    if (end < start) { const tmp = start; start = end; end = tmp; }
    return { start, end };
  };

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
      const hasEntries = readCardEntries().length > 0;
      const allowCardInsertion = hasEntries && caretOnEmptyLine;
      cardButton.disabled = !allowCardInsertion;
      if (allowCardInsertion) cardButton.removeAttribute('aria-disabled');
      else cardButton.setAttribute('aria-disabled', 'true');
      applyButtonTooltipState(cardButton, !!cardButton.disabled);
    }
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
    dispatchInputEvent(textarea);
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
    dispatchInputEvent(textarea);
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
      dispatchInputEvent(textarea);
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
    dispatchInputEvent(textarea);
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
    dispatchInputEvent(textarea);
    recordSelection();
  };

  const renderCardPickerList = (term = '') => {
    if (!cardListEl || !documentRef) return;
    const query = String(term || '').trim().toLowerCase();
    cardListEl.innerHTML = '';
    const entries = readCardEntries().filter(entry => {
      if (!query) return true;
      return typeof entry.search === 'string' ? entry.search.includes(query) : false;
    });
    if (!entries.length) {
      if (cardEmptyEl) cardEmptyEl.removeAttribute('hidden');
      return;
    }
    if (cardEmptyEl) cardEmptyEl.setAttribute('hidden', '');
    const frag = documentRef.createDocumentFragment();
    entries.forEach(entry => {
      const btn = documentRef.createElement('button');
      btn.type = 'button';
      btn.className = 'card-picker-item';
      btn.setAttribute('role', 'option');
      const titleEl = documentRef.createElement('span');
      titleEl.className = 'card-picker-item-title';
      titleEl.textContent = entry.title || entry.key || entry.location;
      const metaEl = documentRef.createElement('span');
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
    detachCardMouseDown = noop;
    detachCardKeydown = noop;
    detachCardResize = noop;
    detachCardScroll = noop;
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

  const attachCardPopoverWatchers = () => {
    detachCardPopoverWatchers();
    detachCardMouseDown = onDocument('mousedown', handleCardOutsideClick, true);
    detachCardKeydown = onDocument('keydown', handleCardKeydown, true);
    detachCardResize = onWindow('resize', handleCardRelayout, true);
    detachCardScroll = onWindow('scroll', handleCardRelayout, true);
  };

  const clearCardPopoverCloseWatcher = () => {
    if (cardPopoverCloseTimer) {
      clearTimer(cardPopoverCloseTimer);
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

  function closeCardPopover() {
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
    cardPopoverCloseTimer = setTimer(finalizeCardPopoverClose, 360);
    if (cardSearchInput) cardSearchInput.value = '';
  }

  const openCardPopover = () => {
    if (!cardButton || !cardPopover) return;
    const hasEntries = readCardEntries().length > 0;
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
    setTimer(() => {
      if (cardSearchInput) {
        try { cardSearchInput.focus(); }
        catch (_) {}
      }
    }, 0);
    attachCardPopoverWatchers();
  };

  const handleCardContextUpdate = () => {
    updateFormattingToolbarState();
    const hasEntries = readCardEntries().length > 0;
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

  const bindFormattingButtons = () => {
    formattingButtons = formattingActions.map(action => {
      const el = getElementById(action.id);
      if (!el) return null;
      registerButtonTooltip(el, BUTTON_DISABLED_HINT_KEYS[action.id]);
      el.addEventListener('click', (event) => {
        event.preventDefault();
        action.handler();
      });
      const requiresSelection = action.requiresSelection !== undefined ? action.requiresSelection : true;
      return { ...action, el, requiresSelection };
    }).filter(Boolean);
  };

  const bindSelectionTracking = () => {
    const selectionTarget = getEditorTextarea();
    if (selectionTarget) {
      ['select', 'keyup', 'mouseup', 'input'].forEach(evt => {
        selectionTarget.addEventListener(evt, recordSelection);
      });
      selectionTarget.addEventListener('focus', recordSelection);
    }
    recordSelection();
  };

  const bindCardPicker = () => {
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
      registerButtonTooltip(cardButton, BUTTON_DISABLED_HINT_KEYS.btnInsertCard);
      cardButton.addEventListener('click', (event) => {
        event.preventDefault();
        if (cardPopoverOpen) closeCardPopover();
        else openCardPopover();
      });
    }
  };

  const syncLanguage = () => {
    tooltipButtons.forEach(btn => applyButtonTooltipState(btn, !!btn.disabled));
  };

  const setCardEntries = (entries) => {
    cardEntries = Array.isArray(entries) ? entries : [];
    handleCardContextUpdate();
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    bindCardPicker();
    bindFormattingButtons();
    bindSelectionTracking();
    handleCardContextUpdate();
  };

  return {
    bind,
    syncLanguage,
    setCardEntries,
    updateState: handleCardContextUpdate,
    recordSelection,
    restoreSelection
  };
}
