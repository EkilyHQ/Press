const noop = () => {};

export function createEditorMainToolbarCardPicker(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const editorToolbarEl = options.editorToolbarEl || null;
  const cardButton = options.cardButton || null;
  const cardPopover = options.cardPopover || null;
  const cardSearchInput = options.cardSearchInput || null;
  const cardListEl = options.cardListEl || null;
  const cardEmptyEl = options.cardEmptyEl || null;
  const getEntries = typeof options.getEntries === 'function' ? options.getEntries : null;
  const canOpen = typeof options.canOpen === 'function' ? options.canOpen : () => true;
  const onSelectEntry = typeof options.onSelectEntry === 'function' ? options.onSelectEntry : noop;
  const onEscapeClose = typeof options.onEscapeClose === 'function' ? options.onEscapeClose : noop;
  const onDocument = typeof runtime.onDocument === 'function' ? runtime.onDocument.bind(runtime) : () => noop;
  const onWindow = typeof runtime.onWindow === 'function' ? runtime.onWindow.bind(runtime) : () => noop;
  const setTimer = typeof runtime.setTimer === 'function' ? runtime.setTimer.bind(runtime) : (fn) => {
    if (typeof fn === 'function') {
      try { fn(); } catch (_) {}
    }
    return null;
  };
  const clearTimer = typeof runtime.clearTimer === 'function' ? runtime.clearTimer.bind(runtime) : noop;

  let entries = Array.isArray(options.entries) ? options.entries : [];
  let cardPopoverOpen = false;
  let cardPopoverClosing = false;
  let cardPopoverCloseTimer = null;
  let cardPopoverTransitionHandler = null;
  let detachCardMouseDown = noop;
  let detachCardKeydown = noop;
  let detachCardResize = noop;
  let detachCardScroll = noop;

  const readEntries = () => {
    if (getEntries) {
      const next = getEntries();
      return Array.isArray(next) ? next : [];
    }
    return Array.isArray(entries) ? entries : [];
  };

  const hasEntries = () => readEntries().length > 0;

  const renderCardPickerList = (term = '') => {
    if (!cardListEl || !documentRef) return;
    const query = String(term || '').trim().toLowerCase();
    cardListEl.innerHTML = '';
    const visibleEntries = readEntries().filter(entry => {
      if (!query) return true;
      return typeof entry.search === 'string' ? entry.search.includes(query) : false;
    });
    if (!visibleEntries.length) {
      if (cardEmptyEl) cardEmptyEl.removeAttribute('hidden');
      return;
    }
    if (cardEmptyEl) cardEmptyEl.setAttribute('hidden', '');
    const frag = documentRef.createDocumentFragment();
    visibleEntries.forEach(entry => {
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
        onSelectEntry(entry);
        close();
      });
      frag.appendChild(btn);
    });
    cardListEl.appendChild(frag);
    cardListEl.scrollTop = 0;
  };

  const position = (anchor = cardButton) => {
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

  const handleRelayout = () => {
    if (cardPopoverOpen) position(cardButton);
  };

  const detachWatchers = () => {
    detachCardMouseDown();
    detachCardKeydown();
    detachCardResize();
    detachCardScroll();
    detachCardMouseDown = noop;
    detachCardKeydown = noop;
    detachCardResize = noop;
    detachCardScroll = noop;
  };

  function handleOutsideClick(event) {
    if (!cardPopoverOpen) return;
    const target = event.target;
    if (!cardPopover) return;
    if (cardPopover.contains(target)) return;
    if (cardButton && cardButton.contains(target)) return;
    close();
  }

  function handleKeydown(event) {
    if (!cardPopoverOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      onEscapeClose();
    }
  }

  const attachWatchers = () => {
    detachWatchers();
    detachCardMouseDown = onDocument('mousedown', handleOutsideClick, true);
    detachCardKeydown = onDocument('keydown', handleKeydown, true);
    detachCardResize = onWindow('resize', handleRelayout, true);
    detachCardScroll = onWindow('scroll', handleRelayout, true);
  };

  const clearCloseWatcher = () => {
    if (cardPopoverCloseTimer) {
      clearTimer(cardPopoverCloseTimer);
      cardPopoverCloseTimer = null;
    }
    if (cardPopover && cardPopoverTransitionHandler) {
      cardPopover.removeEventListener('transitionend', cardPopoverTransitionHandler);
    }
    cardPopoverTransitionHandler = null;
  };

  const finalizeClose = () => {
    clearCloseWatcher();
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

  function close() {
    if (!cardPopoverOpen && !cardPopoverClosing) return;
    cardPopoverOpen = false;
    cardPopoverClosing = true;
    if (cardButton) cardButton.setAttribute('aria-expanded', 'false');
    detachWatchers();
    if (!cardPopover) {
      finalizeClose();
      if (cardSearchInput) cardSearchInput.value = '';
      return;
    }
    clearCloseWatcher();
    cardPopover.setAttribute('aria-hidden', 'true');
    cardPopover.classList.remove('is-visible');
    cardPopover.classList.add('is-closing');
    const handleTransitionEnd = (event) => {
      if (event.target !== cardPopover) return;
      if (event.propertyName && event.propertyName !== 'opacity') return;
      finalizeClose();
    };
    cardPopoverTransitionHandler = handleTransitionEnd;
    cardPopover.addEventListener('transitionend', handleTransitionEnd);
    cardPopoverCloseTimer = setTimer(finalizeClose, 360);
    if (cardSearchInput) cardSearchInput.value = '';
  }

  const open = () => {
    if (!cardButton || !cardPopover) return;
    if (!hasEntries() || !canOpen()) return;
    renderCardPickerList('');
    if (cardSearchInput) cardSearchInput.value = '';
    clearCloseWatcher();
    cardPopoverClosing = false;
    cardPopover.classList.remove('is-visible');
    cardPopover.classList.remove('is-closing');
    cardPopover.removeAttribute('hidden');
    cardPopover.setAttribute('aria-hidden', 'false');
    position(cardButton);
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
    attachWatchers();
  };

  const update = () => {
    if ((!hasEntries() || !canOpen()) && cardPopoverOpen) {
      close();
      return;
    }
    if (cardPopoverOpen) {
      renderCardPickerList(cardSearchInput ? cardSearchInput.value : '');
      position(cardButton);
    }
  };

  const setEntries = (nextEntries) => {
    entries = Array.isArray(nextEntries) ? nextEntries : [];
    update();
  };

  const bind = () => {
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
        if (cardPopoverOpen) close();
        else open();
      });
    }
  };

  return {
    bind,
    close,
    hasEntries,
    isOpen: () => cardPopoverOpen,
    open,
    render: renderCardPickerList,
    setEntries,
    update
  };
}
