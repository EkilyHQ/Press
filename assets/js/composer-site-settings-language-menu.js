export function createComposerSiteSettingsLanguageMenu(options = {}) {
  const noop = () => {};
  const documentRef = options.documentRef || null;
  const setTimer = typeof options.setTimer === 'function'
    ? options.setTimer
    : (handler, delay = 0) => {
      if ((Number(delay) || 0) <= 0 && typeof handler === 'function') handler();
      return null;
    };
  const languagePoolChangedEvent = options.languagePoolChangedEvent || 'press-composer-language-pool-changed';
  const preferredLangOrder = Array.isArray(options.preferredLangOrder) ? options.preferredLangOrder : [];
  const langCodePattern = options.langCodePattern || /^[a-z]{2,3}(?:-[a-z0-9]+)*$/i;
  const normalizeLangCode = typeof options.normalizeLangCode === 'function'
    ? options.normalizeLangCode
    : (code) => String(code || '').trim().toLowerCase();
  const getAvailableLangs = typeof options.getAvailableLangs === 'function' ? options.getAvailableLangs : () => [];
  const collectLanguageCodes = typeof options.collectLanguageCodes === 'function' ? options.collectLanguageCodes : () => [];
  const displayLangName = typeof options.displayLangName === 'function' ? options.displayLangName : (code) => String(code || '').toUpperCase();
  const escapeHtml = typeof options.escapeHtml === 'function'
    ? options.escapeHtml
    : (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const t = typeof options.t === 'function' ? options.t : (key) => key;
  const getUsedLangs = typeof options.getUsedLangs === 'function' ? options.getUsedLangs : () => [];
  const onSelectLanguage = typeof options.onSelectLanguage === 'function' ? options.onSelectLanguage : noop;

  const addWrap = documentRef.createElement('div');
  addWrap.className = 'cs-add-lang has-menu';

  const addBtn = documentRef.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-secondary cs-add-lang';
  addBtn.textContent = t('editor.composer.site.addLanguage');
  addBtn.setAttribute('aria-haspopup', 'listbox');
  addBtn.setAttribute('aria-expanded', 'false');
  addWrap.appendChild(addBtn);

  const menu = documentRef.createElement('div');
  menu.className = 'press-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  addWrap.appendChild(menu);

  const isValidLanguageCode = (code) => {
    try { langCodePattern.lastIndex = 0; } catch (_) {}
    try { return langCodePattern.test(code); }
    catch (_) { return false; }
  };

  const sortLanguageCodes = (codes) => {
    const ordered = Array.from(new Set(codes.filter(Boolean)));
    ordered.sort((a, b) => {
      const ia = preferredLangOrder.indexOf(a);
      const ib = preferredLangOrder.indexOf(b);
      if (ia !== -1 || ib !== -1) {
        const pa = ia === -1 ? preferredLangOrder.length + 1 : ia;
        const pb = ib === -1 ? preferredLangOrder.length + 1 : ib;
        return pa - pb;
      }
      return a.localeCompare(b);
    });
    return ordered;
  };

  const collectSupportedLangs = () => {
    const supportedSet = new Set();
    const addSupported = (code) => {
      const normalized = normalizeLangCode(code);
      if (!normalized) return;
      supportedSet.add(normalized);
    };

    try {
      const availableLangs = getAvailableLangs();
      if (Array.isArray(availableLangs)) availableLangs.forEach(addSupported);
    } catch (_) {}

    preferredLangOrder.forEach(addSupported);

    try {
      const collected = collectLanguageCodes();
      if (Array.isArray(collected)) collected.forEach(addSupported);
    } catch (_) {}

    return sortLanguageCodes(Array.from(supportedSet));
  };

  const refreshMenu = () => {
    const used = new Set();
    try {
      const langs = getUsedLangs();
      if (Array.isArray(langs)) langs.forEach((code) => {
        const normalized = normalizeLangCode(code);
        if (normalized) used.add(normalized);
      });
    } catch (_) {}
    used.add('default');

    const available = collectSupportedLangs()
      .filter((code) => !used.has(code) && isValidLanguageCode(code));

    menu.innerHTML = available
      .map((code) =>
        `<button type="button" role="option" class="press-menu-item" data-lang="${escapeHtml(code)}">${escapeHtml(displayLangName(code))}</button>`
      )
      .join('');

    if (!available.length) {
      addBtn.setAttribute('disabled', '');
      addWrap.classList.add('is-disabled');
      addWrap.hidden = true;
      addWrap.setAttribute('aria-hidden', 'true');
      addWrap.style.display = 'none';
      if (!menu.hidden) closeMenu();
      return;
    }

    addBtn.removeAttribute('disabled');
    addWrap.classList.remove('is-disabled');
    addWrap.hidden = false;
    addWrap.removeAttribute('aria-hidden');
    addWrap.style.removeProperty('display');
  };

  function finishClose() {
    menu.hidden = true;
    addBtn.classList.remove('is-open');
    addWrap.classList.remove('is-open');
    addBtn.setAttribute('aria-expanded', 'false');
    if (documentRef && typeof documentRef.removeEventListener === 'function') {
      documentRef.removeEventListener('mousedown', onDocDown, true);
      documentRef.removeEventListener('keydown', onKeyDown, true);
    }
    menu.classList.remove('is-closing');
  }

  function closeMenu(config = {}) {
    if (menu.hidden) return;
    if (config.immediate) {
      finishClose();
      return;
    }
    try {
      menu.classList.add('is-closing');
      const onEnd = () => { menu.removeEventListener('animationend', onEnd); finishClose(); };
      menu.addEventListener('animationend', onEnd, { once: true });
      setTimer(finishClose, 180);
    } catch (_) {
      finishClose();
    }
  }

  function onDocDown(event) {
    if (!addWrap.contains(event.target)) closeMenu();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  }

  function openMenu() {
    refreshMenu();
    if (!menu.innerHTML.trim() || addWrap.hidden) return;
    if (!menu.hidden) return;
    menu.hidden = false;
    try { menu.classList.remove('is-closing'); } catch (_) {}
    addBtn.classList.add('is-open');
    addWrap.classList.add('is-open');
    addBtn.setAttribute('aria-expanded', 'true');
    try { menu.querySelector('.press-menu-item')?.focus(); } catch (_) {}
    if (documentRef && typeof documentRef.addEventListener === 'function') {
      documentRef.addEventListener('mousedown', onDocDown, true);
      documentRef.addEventListener('keydown', onKeyDown, true);
    }
    menu.querySelectorAll('.press-menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        const code = normalizeLangCode(item.getAttribute('data-lang'));
        if (!code) return;
        const result = onSelectLanguage(code, { closeMenu, refreshMenu });
        if (result === false) return;
        closeMenu();
      });
    });
  }

  function onButtonClick() {
    if (addBtn.hasAttribute('disabled')) return;
    if (addBtn.classList.contains('is-open')) closeMenu();
    else openMenu();
  }

  addBtn.addEventListener('click', onButtonClick);
  if (documentRef && typeof documentRef.addEventListener === 'function') {
    documentRef.addEventListener(languagePoolChangedEvent, refreshMenu);
  }

  const cleanup = () => {
    if (documentRef && typeof documentRef.removeEventListener === 'function') {
      documentRef.removeEventListener(languagePoolChangedEvent, refreshMenu);
      documentRef.removeEventListener('mousedown', onDocDown, true);
      documentRef.removeEventListener('keydown', onKeyDown, true);
    }
    try { addBtn.removeEventListener('click', onButtonClick); } catch (_) {}
    closeMenu({ immediate: true });
  };

  return {
    addWrap,
    addBtn,
    menu,
    refreshMenu,
    closeMenu,
    cleanup
  };
}
