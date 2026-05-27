export function createComposerIndexTabsLanguageMenu(options = {}) {
  const documentRef = options.documentRef || null;
  const setTimeoutRef = typeof options.setTimeoutRef === 'function' ? options.setTimeoutRef : null;
  const addDocumentListener = typeof options.addDocumentListener === 'function' ? options.addDocumentListener : () => () => {};
  const query = typeof options.query === 'function'
    ? options.query
    : (selector, root = documentRef) => root && typeof root.querySelector === 'function' ? root.querySelector(selector) : null;
  const escapeHtml = typeof options.escapeHtml === 'function' ? options.escapeHtml : value => String(value ?? '');
  const displayLangName = typeof options.displayLangName === 'function'
    ? options.displayLangName
    : code => String(code || '').toUpperCase();

  function scheduleTimer(callback, delay) {
    if (typeof callback !== 'function') return null;
    if (setTimeoutRef) {
      try { return setTimeoutRef(callback, delay); } catch (_) {}
    }
    if ((Number(delay) || 0) <= 0) callback();
    return null;
  }

  function createLanguageMenu({
    tagName = 'div',
    wrapperClass = '',
    buttonClass = '',
    menuClass = '',
    label = '',
    available = [],
    onSelect
  } = {}) {
    if (!documentRef || typeof documentRef.createElement !== 'function') return null;
    const wrap = documentRef.createElement(tagName || 'div');
    wrap.className = `${wrapperClass} has-menu`.trim();
    wrap.innerHTML = `
      <button type="button" class="btn-secondary ${escapeHtml(buttonClass)}" aria-haspopup="listbox" aria-expanded="false">${escapeHtml(label)}</button>
      <div class="${escapeHtml(menuClass)} press-menu" role="listbox" hidden>
        ${available.map(code => `<button type="button" role="option" class="press-menu-item" data-lang="${escapeHtml(code)}">${escapeHtml(displayLangName(code))}</button>`).join('')}
      </div>
    `;

    const btn = query(`.${buttonClass}`, wrap);
    const menu = query(`.${menuClass}`, wrap);
    let disposeDocDown = null;
    let disposeKeyDown = null;

    if (!btn || !menu) return wrap;
    btn.setAttribute('title', label);
    btn.setAttribute('aria-label', label);

    function disposeListeners() {
      if (typeof disposeDocDown === 'function') disposeDocDown();
      if (typeof disposeKeyDown === 'function') disposeKeyDown();
      disposeDocDown = null;
      disposeKeyDown = null;
    }

    function finishClose() {
      menu.hidden = true;
      btn.classList.remove('is-open');
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      disposeListeners();
      menu.classList.remove('is-closing');
    }

    function closeMenu() {
      if (menu.hidden) return;
      try {
        menu.classList.add('is-closing');
        const onEnd = () => {
          menu.removeEventListener('animationend', onEnd);
          finishClose();
        };
        menu.addEventListener('animationend', onEnd, { once: true });
        scheduleTimer(finishClose, 180);
      } catch (_) {
        finishClose();
      }
    }

    function onDocDown(event) {
      if (!wrap.contains(event.target)) closeMenu();
    }

    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMenu();
    }

    function openMenu() {
      if (!menu.hidden) return;
      menu.hidden = false;
      try { menu.classList.remove('is-closing'); } catch (_) {}
      btn.classList.add('is-open');
      wrap.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      try { menu.querySelector('.press-menu-item')?.focus(); } catch (_) {}
      disposeListeners();
      disposeDocDown = addDocumentListener('mousedown', onDocDown, true);
      disposeKeyDown = addDocumentListener('keydown', onKeyDown, true);
    }

    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    menu.querySelectorAll('.press-menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        const code = String(item.getAttribute('data-lang') || '').trim();
        if (!code || typeof onSelect !== 'function') return;
        onSelect(code, { closeMenu, item, wrap, button: btn, menu });
      });
    });

    return wrap;
  }

  return { createLanguageMenu };
}
