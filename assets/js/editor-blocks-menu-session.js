function noop() {}

function safeCall(fn, fallback = null) {
  try { return typeof fn === 'function' ? fn() : fallback; }
  catch (_) { return fallback; }
}

function safeSetExpanded(trigger, expanded) {
  safeCall(() => trigger && trigger.setAttribute && trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false'));
}

function safeToggleOpen(wrap, open) {
  safeCall(() => {
    if (open) wrap && wrap.classList && wrap.classList.add('is-open');
    else wrap && wrap.classList && wrap.classList.remove('is-open');
  });
}

function safeHide(menu, hidden) {
  safeCall(() => {
    if (menu) menu.hidden = !!hidden;
  });
}

function safeFocus(el) {
  safeCall(() => {
    if (el && typeof el.focus === 'function') el.focus();
  });
}

function firstFocusable(menu, selector) {
  return safeCall(() => (
    menu && selector && typeof menu.querySelector === 'function'
      ? menu.querySelector(selector)
      : null
  ), null);
}

function createButton(documentRef, label, className = 'blocks-btn') {
  const btn = documentRef.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  return btn;
}

function callDisposables(disposables = []) {
  disposables.forEach((dispose) => {
    safeCall(dispose);
  });
}

export function createEditorBlocksMenuSession({
  documentRef = typeof document !== 'undefined' ? document : null,
  text = (_key, fallback) => fallback,
  onDocument = () => noop,
  onWindow = () => noop,
  containsNode = (root, target) => !!(root && (root === target || (root.contains && root.contains(target))))
} = {}) {
  let actionMenu = null;
  let inlineMenu = null;

  function closeMenu(current, restoreFocus = false, options = {}) {
    if (!current) return false;
    safeHide(current.menu, true);
    safeSetExpanded(current.trigger, false);
    safeToggleOpen(current.wrap, false);
    if (options.clearRightAlignment) {
      safeCall(() => current.menu && current.menu.classList && current.menu.classList.remove('is-open-right'));
    }
    callDisposables(current.disposables);
    if (restoreFocus) safeFocus(current.trigger);
    return true;
  }

  function closeActionMenu(restoreFocus = false) {
    const current = actionMenu;
    actionMenu = null;
    return closeMenu(current, restoreFocus, { clearRightAlignment: true });
  }

  function closeInlineMenu(restoreFocus = false) {
    const current = inlineMenu;
    inlineMenu = null;
    return closeMenu(current, restoreFocus);
  }

  function isActionMenuOpen(menu) {
    return !!actionMenu && actionMenu.menu === menu;
  }

  function isInlineMenuOpen(menu) {
    return !!inlineMenu && inlineMenu.menu === menu;
  }

  function openActionMenu({
    wrap,
    trigger,
    menu,
    onReposition = noop,
    focusSelector = '.blocks-action-menu-item:not(:disabled)'
  } = {}) {
    if (!wrap || !trigger || !menu) return false;
    if (isActionMenuOpen(menu)) return false;
    closeActionMenu(false);
    const closeFromPointer = (event) => {
      if (containsNode(wrap, event && event.target)) return;
      closeActionMenu(false);
    };
    const closeFromKey = (event) => {
      if (!event || event.key !== 'Escape') return;
      safeCall(() => event.preventDefault && event.preventDefault());
      closeActionMenu(true);
    };
    const reposition = () => safeCall(onReposition);
    const disposables = [
      onDocument('mousedown', closeFromPointer, true),
      onDocument('keydown', closeFromKey, true),
      onWindow('resize', reposition),
      onWindow('scroll', reposition, true)
    ];
    actionMenu = { wrap, trigger, menu, disposables };
    safeHide(menu, false);
    safeSetExpanded(trigger, true);
    safeToggleOpen(wrap, true);
    reposition();
    safeFocus(firstFocusable(menu, focusSelector));
    return true;
  }

  function createActionControls({
    index = 0,
    blockCount = 0,
    setActive = noop,
    moveBlock = noop,
    insertBlankBlock = noop,
    deleteBlockAt = noop,
    onReposition = noop
  } = {}) {
    if (!documentRef) return null;
    const wrap = documentRef.createElement('div');
    wrap.className = 'blocks-block-actions';
    const trigger = createButton(documentRef, '\u22ef', 'blocks-icon-btn blocks-action-trigger');
    const actionsLabel = text('actions', 'More actions');
    trigger.title = actionsLabel;
    trigger.setAttribute('aria-label', actionsLabel);
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');

    const menu = documentRef.createElement('div');
    menu.className = 'blocks-action-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const makeItem = (label, className, disabled, handler) => {
      const item = createButton(documentRef, label, `blocks-action-menu-item${className ? ` ${className}` : ''}`);
      item.setAttribute('role', 'menuitem');
      item.disabled = !!disabled;
      item.addEventListener('click', () => {
        if (item.disabled) return;
        closeActionMenu(false);
        handler();
      });
      menu.appendChild(item);
      return item;
    };

    makeItem(text('moveUp', 'Move up'), '', index === 0, () => moveBlock(index, -1));
    makeItem(text('moveDown', 'Move down'), '', index >= blockCount - 1, () => moveBlock(index, 1));
    makeItem(text('addBefore', 'Add before'), '', false, () => insertBlankBlock(index));
    makeItem(text('addAfter', 'Add after'), '', false, () => insertBlankBlock(index + 1));
    makeItem(text('delete', 'Delete'), 'blocks-action-menu-delete', false, () => deleteBlockAt(index));

    const openMenu = () => {
      openActionMenu({
        wrap,
        trigger,
        menu,
        onReposition: () => onReposition(menu, trigger)
      });
    };

    trigger.addEventListener('mousedown', (event) => event.preventDefault());
    trigger.addEventListener('click', () => {
      setActive(index);
      if (isActionMenuOpen(menu)) {
        closeActionMenu(false);
      } else {
        openMenu();
      }
    });

    wrap.append(trigger, menu);
    return wrap;
  }

  function openInlineMenu({
    wrap,
    trigger,
    menu,
    focusSelector = '.blocks-inline-menu-item:not(:disabled)'
  } = {}) {
    if (!wrap || !trigger || !menu) return false;
    if (isInlineMenuOpen(menu)) return false;
    closeInlineMenu(false);
    const closeFromPointer = (event) => {
      if (containsNode(wrap, event && event.target)) return;
      closeInlineMenu(false);
    };
    const closeFromKey = (event) => {
      if (!event || event.key !== 'Escape') return;
      safeCall(() => event.preventDefault && event.preventDefault());
      closeInlineMenu(true);
    };
    const disposables = [
      onDocument('mousedown', closeFromPointer, true),
      onDocument('keydown', closeFromKey, true)
    ];
    inlineMenu = { wrap, trigger, menu, disposables };
    safeHide(menu, false);
    safeSetExpanded(trigger, true);
    safeToggleOpen(wrap, true);
    safeFocus(firstFocusable(menu, focusSelector));
    return true;
  }

  function closeAll() {
    const closedAction = closeActionMenu(false);
    const closedInline = closeInlineMenu(false);
    return closedAction || closedInline;
  }

  return {
    closeActionMenu,
    closeInlineMenu,
    closeAll,
    createActionControls,
    isActionMenuOpen,
    isInlineMenuOpen,
    openActionMenu,
    openInlineMenu
  };
}
