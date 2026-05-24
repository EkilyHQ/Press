export function createComposerDialogController(options = {}) {
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const t = typeof options.t === 'function' ? options.t : (key) => key;

  let discardConfirmElements = null;
  let discardConfirmActiveClose = null;
  let discardConfirmHideTimer = null;

  let addEntryPromptElements = null;
  let addEntryPromptActiveClose = null;
  let addEntryPromptHideTimer = null;

  let markdownProtectionPasswordDialogElements = null;

  function clearTimer(timer) {
    if (!timer || !windowRef || typeof windowRef.clearTimeout !== 'function') return;
    windowRef.clearTimeout(timer);
  }

  function scheduleTimer(callback, delay) {
    if (windowRef && typeof windowRef.setTimeout === 'function') {
      return windowRef.setTimeout(callback, delay);
    }
    callback();
    return null;
  }

  function scheduleFrame(callback) {
    if (windowRef && typeof windowRef.requestAnimationFrame === 'function') {
      windowRef.requestAnimationFrame(callback);
      return;
    }
    callback();
  }

  function focusElement(element, options = {}) {
    if (!element || typeof element.focus !== 'function') return;
    try { element.focus(options); } catch (_) {}
  }

  function selectElement(element) {
    if (!element || typeof element.select !== 'function') return;
    try { element.select(); } catch (_) {}
  }

  function getViewportSize() {
    const docEl = documentRef && documentRef.documentElement;
    return {
      width: docEl && docEl.clientWidth ? docEl.clientWidth : (windowRef && windowRef.innerWidth ? windowRef.innerWidth : 0),
      height: docEl && docEl.clientHeight ? docEl.clientHeight : (windowRef && windowRef.innerHeight ? windowRef.innerHeight : 0)
    };
  }

  function positionPopover(popover, anchor, onInvalidAnchor) {
    if (!anchor || !popover || !popover.isConnected) {
      onInvalidAnchor();
      return;
    }
    if (typeof anchor.getBoundingClientRect !== 'function') {
      onInvalidAnchor();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      onInvalidAnchor();
      return;
    }
    const scrollX = windowRef ? (windowRef.scrollX || windowRef.pageXOffset || 0) : 0;
    const scrollY = windowRef ? (windowRef.scrollY || windowRef.pageYOffset || 0) : 0;
    const viewport = getViewportSize();
    const margin = 12;
    const width = popover.offsetWidth || 0;
    const height = popover.offsetHeight || 0;

    let left = scrollX + rect.right - width;
    const minLeft = scrollX + margin;
    const maxLeft = scrollX + Math.max(margin, viewport.width - margin - width);
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    let placement = 'bottom';
    let top = scrollY + rect.bottom + 12;
    const viewportBottom = scrollY + viewport.height;
    const fitsBelow = top + height <= viewportBottom - margin;
    if (!fitsBelow && rect.top >= height + margin) {
      placement = 'top';
      top = scrollY + rect.top - height - 12;
    } else if (!fitsBelow) {
      top = Math.max(scrollY + margin, viewportBottom - height - margin);
    }
    if (placement === 'bottom') {
      top = Math.max(top, scrollY + rect.bottom + 4);
    } else {
      top = Math.min(top, scrollY + rect.top - 4);
    }

    popover.dataset.placement = placement;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  }

  function ensureAddEntryPromptElements() {
    if (addEntryPromptElements) return addEntryPromptElements;
    if (!documentRef || !documentRef.body || typeof documentRef.createElement !== 'function') return null;

    const popover = documentRef.createElement('div');
    popover.id = 'composerAddEntryPrompt';
    popover.className = 'composer-confirm-popover composer-key-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    popover.hidden = true;

    const fieldWrap = documentRef.createElement('div');
    fieldWrap.className = 'composer-key-form';

    const label = documentRef.createElement('label');
    label.className = 'composer-confirm-message';
    label.id = 'composerAddEntryPromptLabel';
    label.setAttribute('for', 'composerAddEntryKeyInput');
    fieldWrap.appendChild(label);

    popover.setAttribute('aria-labelledby', label.id);

    const input = documentRef.createElement('input');
    input.type = 'text';
    input.id = 'composerAddEntryKeyInput';
    input.className = 'composer-key-input';
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.setAttribute('spellcheck', 'false');
    fieldWrap.appendChild(input);

    const hint = documentRef.createElement('div');
    hint.className = 'composer-key-hint';
    hint.id = 'composerAddEntryPromptHint';
    hint.textContent = t('editor.composer.addEntryPrompt.hint');
    fieldWrap.appendChild(hint);

    const error = documentRef.createElement('div');
    error.className = 'composer-key-error';
    error.id = 'composerAddEntryPromptError';
    error.setAttribute('role', 'alert');
    fieldWrap.appendChild(error);

    input.setAttribute('aria-describedby', `${hint.id} ${error.id}`);
    popover.setAttribute('aria-describedby', `${hint.id} ${error.id}`);

    popover.appendChild(fieldWrap);

    const actions = documentRef.createElement('div');
    actions.className = 'composer-confirm-actions';

    const cancelBtn = documentRef.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary composer-confirm-cancel';
    cancelBtn.textContent = t('editor.composer.dialogs.cancel');

    const confirmBtn = documentRef.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn-secondary composer-confirm-confirm';
    confirmBtn.textContent = t('editor.composer.addEntryPrompt.confirm');

    actions.append(cancelBtn, confirmBtn);
    popover.appendChild(actions);

    documentRef.body.appendChild(popover);
    addEntryPromptElements = { popover, label, input, hint, error, cancelBtn, confirmBtn };
    return addEntryPromptElements;
  }

  function showAddEntryPrompt(anchor, options = {}) {
    const elements = ensureAddEntryPromptElements();
    if (!elements) return Promise.resolve({ confirmed: false, value: '' });

    const { popover, label, input, hint, error, cancelBtn, confirmBtn } = elements;
    const typeLabel = options && options.typeLabel
      ? String(options.typeLabel)
      : t('editor.composer.addEntryPrompt.defaultType');
    const confirmLabel = options && options.confirmLabel
      ? String(options.confirmLabel)
      : t('editor.composer.addEntryPrompt.confirm');
    const cancelLabel = options && options.cancelLabel
      ? String(options.cancelLabel)
      : t('editor.composer.dialogs.cancel');
    const placeholder = options && options.placeholder
      ? String(options.placeholder)
      : t('editor.composer.addEntryPrompt.placeholder');
    const existingKeys = options && options.existingKeys ? new Set(options.existingKeys) : new Set();
    const hintText = options && Object.prototype.hasOwnProperty.call(options, 'hint')
      ? String(options.hint || '')
      : t('editor.composer.addEntryPrompt.hint');
    const customValidator = options && typeof options.validate === 'function'
      ? options.validate
      : null;

    label.textContent = options && options.message
      ? String(options.message)
      : t('editor.composer.addEntryPrompt.message', { label: typeLabel });
    cancelBtn.textContent = cancelLabel;
    confirmBtn.textContent = confirmLabel;
    hint.textContent = hintText;
    input.value = options && options.initialValue ? String(options.initialValue).trim() : '';
    input.placeholder = placeholder;
    input.setAttribute('aria-invalid', 'false');
    error.textContent = '';

    if (anchor && typeof anchor.setAttribute === 'function') {
      anchor.setAttribute('aria-haspopup', 'dialog');
      anchor.setAttribute('aria-controls', popover.id);
    }

    if (typeof addEntryPromptActiveClose === 'function') {
      try { addEntryPromptActiveClose(); } catch (_) {}
    }

    if (addEntryPromptHideTimer) {
      clearTimer(addEntryPromptHideTimer);
      addEntryPromptHideTimer = null;
    }

    popover.hidden = false;
    popover.style.visibility = 'hidden';
    popover.classList.remove('is-visible');
    popover.dataset.placement = 'bottom';

    const setError = (message) => {
      const text = String(message || '');
      error.textContent = text;
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
    };

    const validateValue = () => {
      const raw = input.value || '';
      const value = raw.trim();
      if (customValidator) {
        const result = customValidator(value);
        if (result && typeof result === 'object') {
          if (result.ok === false) {
            setError(result.error || t('editor.composer.addEntryPrompt.errorInvalid'));
            focusElement(input, { preventScroll: true });
            selectElement(input);
            return null;
          }
          const nextValue = Object.prototype.hasOwnProperty.call(result, 'value')
            ? String(result.value || '').trim()
            : value;
          setError('');
          return nextValue;
        }
        if (typeof result === 'string' && result) {
          setError(result);
          focusElement(input, { preventScroll: true });
          selectElement(input);
          return null;
        }
        if (result === false) {
          setError(t('editor.composer.addEntryPrompt.errorInvalid'));
          focusElement(input, { preventScroll: true });
          selectElement(input);
          return null;
        }
        setError('');
        return value;
      }
      if (!value) {
        setError(t('editor.composer.addEntryPrompt.errorEmpty'));
        focusElement(input, { preventScroll: true });
        selectElement(input);
        return null;
      }
      if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        setError(t('editor.composer.addEntryPrompt.errorInvalid'));
        focusElement(input, { preventScroll: true });
        selectElement(input);
        return null;
      }
      if (existingKeys.has(value)) {
        setError(t('editor.composer.addEntryPrompt.errorDuplicate'));
        focusElement(input, { preventScroll: true });
        selectElement(input);
        return null;
      }
      setError('');
      return value;
    };

    let resolve;
    let closed = false;

    const finish = (result, value) => {
      if (closed) return;
      closed = true;
      addEntryPromptActiveClose = null;

      popover.classList.remove('is-visible');
      popover.style.visibility = 'hidden';

      if (addEntryPromptHideTimer) {
        clearTimer(addEntryPromptHideTimer);
        addEntryPromptHideTimer = null;
      }
      addEntryPromptHideTimer = scheduleTimer(() => {
        popover.hidden = true;
        popover.style.visibility = '';
        popover.style.left = '';
        popover.style.top = '';
        addEntryPromptHideTimer = null;
      }, 200);

      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      input.removeEventListener('keydown', onInputKeyDown, true);
      input.removeEventListener('input', onInputChange);
      if (documentRef) {
        documentRef.removeEventListener('keydown', onKeyDown, true);
        documentRef.removeEventListener('mousedown', onOutside, true);
        documentRef.removeEventListener('touchstart', onOutside, true);
      }
      if (windowRef && typeof windowRef.removeEventListener === 'function') {
        windowRef.removeEventListener('resize', reposition);
        windowRef.removeEventListener('scroll', reposition, true);
      }

      if (anchor && typeof anchor.setAttribute === 'function') {
        anchor.setAttribute('aria-expanded', 'false');
      }

      if (!result && anchor && typeof anchor.focus === 'function') {
        scheduleTimer(() => focusElement(anchor, { preventScroll: true }), 120);
      }

      setError('');
      input.value = '';

      if (typeof resolve === 'function') {
        resolve({ confirmed: !!result, value: result ? String(value || '') : '' });
      }
      resolve = null;
    };

    const onCancel = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      finish(false, '');
    };

    const onConfirm = (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      const value = validateValue();
      if (value == null) return;
      finish(true, value);
    };

    const onInputKeyDown = (event) => {
      if (!event) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        const value = validateValue();
        if (value == null) return;
        finish(true, value);
      }
    };

    const onInputChange = () => {
      if (error.textContent) setError('');
    };

    const onOutside = (event) => {
      const target = event && event.target;
      if (!target) return;
      if (popover.contains(target) || target === anchor) return;
      finish(false, '');
    };

    const onKeyDown = (event) => {
      if (!event) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false, '');
        return;
      }
      if (event.key === 'Tab') {
        const focusables = [input, confirmBtn, cancelBtn];
        const active = documentRef ? documentRef.activeElement : null;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey) {
          if (active === first || !focusables.includes(active)) {
            event.preventDefault();
            focusElement(last, { preventScroll: true });
          }
        } else if (active === last) {
          event.preventDefault();
          focusElement(first, { preventScroll: true });
        } else if (!focusables.includes(active)) {
          event.preventDefault();
          focusElement(first, { preventScroll: true });
        }
      }
    };

    const reposition = () => {
      positionPopover(popover, anchor, () => finish(false, ''));
    };

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    input.addEventListener('keydown', onInputKeyDown, true);
    input.addEventListener('input', onInputChange);
    if (documentRef) {
      documentRef.addEventListener('keydown', onKeyDown, true);
      documentRef.addEventListener('mousedown', onOutside, true);
      documentRef.addEventListener('touchstart', onOutside, true);
    }
    if (windowRef && typeof windowRef.addEventListener === 'function') {
      windowRef.addEventListener('resize', reposition);
      windowRef.addEventListener('scroll', reposition, true);
    }

    return new Promise((res) => {
      resolve = res;
      addEntryPromptActiveClose = () => finish(false, '');

      scheduleFrame(() => {
        reposition();
        if (closed) return;
        popover.style.visibility = '';
        popover.classList.add('is-visible');
        if (anchor && typeof anchor.setAttribute === 'function') {
          anchor.setAttribute('aria-expanded', 'true');
        }
        focusElement(input, { preventScroll: true });
        selectElement(input);
      });
    });
  }

  function configureMarkdownPasswordInput(input) {
    if (!input) return;
    input.type = 'password';
    input.autocomplete = 'off';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('data-1p-ignore', 'true');
    input.setAttribute('data-lpignore', 'true');
  }

  function ensureMarkdownProtectionPasswordDialogElements() {
    if (markdownProtectionPasswordDialogElements) return markdownProtectionPasswordDialogElements;
    if (!documentRef || !documentRef.body || typeof documentRef.createElement !== 'function') return null;

    const overlay = documentRef.createElement('div');
    overlay.id = 'composerMarkdownProtectionPasswordDialog';
    overlay.className = 'composer-protection-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.hidden = true;

    const card = documentRef.createElement('div');
    card.className = 'composer-protection-card';

    const title = documentRef.createElement('h3');
    title.className = 'composer-protection-title';
    title.id = 'composerMarkdownProtectionPasswordTitle';
    overlay.setAttribute('aria-labelledby', title.id);
    card.appendChild(title);

    const message = documentRef.createElement('p');
    message.className = 'composer-protection-message';
    message.id = 'composerMarkdownProtectionPasswordMessage';
    overlay.setAttribute('aria-describedby', message.id);
    card.appendChild(message);

    const passwordLabel = documentRef.createElement('label');
    passwordLabel.className = 'composer-protection-field';
    passwordLabel.setAttribute('for', 'composerMarkdownProtectionPasswordInput');
    const passwordText = documentRef.createElement('span');
    passwordText.className = 'composer-protection-label';
    passwordText.textContent = t('editor.composer.markdown.protection.passwordLabel');
    const passwordInput = documentRef.createElement('input');
    passwordInput.id = 'composerMarkdownProtectionPasswordInput';
    passwordInput.className = 'composer-key-input composer-protection-input';
    configureMarkdownPasswordInput(passwordInput);
    passwordLabel.append(passwordText, passwordInput);
    card.appendChild(passwordLabel);

    const confirmLabel = documentRef.createElement('label');
    confirmLabel.className = 'composer-protection-field';
    confirmLabel.setAttribute('for', 'composerMarkdownProtectionPasswordConfirm');
    const confirmText = documentRef.createElement('span');
    confirmText.className = 'composer-protection-label';
    confirmText.textContent = t('editor.composer.markdown.protection.confirmPasswordLabel');
    const confirmInput = documentRef.createElement('input');
    confirmInput.id = 'composerMarkdownProtectionPasswordConfirm';
    confirmInput.className = 'composer-key-input composer-protection-input';
    configureMarkdownPasswordInput(confirmInput);
    confirmLabel.append(confirmText, confirmInput);
    card.appendChild(confirmLabel);

    const error = documentRef.createElement('div');
    error.className = 'composer-key-error composer-protection-error';
    error.id = 'composerMarkdownProtectionPasswordError';
    error.setAttribute('role', 'alert');
    card.appendChild(error);

    const actions = documentRef.createElement('div');
    actions.className = 'composer-confirm-actions composer-protection-actions';

    const cancelBtn = documentRef.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary composer-confirm-cancel';
    cancelBtn.textContent = t('editor.composer.dialogs.cancel');

    const confirmBtn = documentRef.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn-secondary composer-confirm-confirm';
    confirmBtn.textContent = t('editor.composer.dialogs.confirm');

    actions.append(cancelBtn, confirmBtn);
    card.appendChild(actions);
    overlay.appendChild(card);
    documentRef.body.appendChild(overlay);

    markdownProtectionPasswordDialogElements = {
      overlay,
      title,
      message,
      passwordText,
      passwordInput,
      confirmLabel,
      confirmText,
      confirmInput,
      error,
      cancelBtn,
      confirmBtn
    };
    return markdownProtectionPasswordDialogElements;
  }

  function requestMarkdownProtectionPassword(options = {}) {
    const elements = ensureMarkdownProtectionPasswordDialogElements();
    if (!elements) return Promise.resolve('');
    const {
      overlay,
      title,
      message,
      passwordText,
      passwordInput,
      confirmLabel,
      confirmText,
      confirmInput,
      error,
      cancelBtn,
      confirmBtn
    } = elements;
    const opts = options && typeof options === 'object' ? options : {};
    const requireConfirm = opts.confirm === true;

    title.textContent = opts.title ? String(opts.title) : t('editor.composer.markdown.protection.dialogTitle');
    message.textContent = opts.message ? String(opts.message) : t('editor.composer.markdown.protection.dialogMessage');
    passwordText.textContent = t('editor.composer.markdown.protection.passwordLabel');
    confirmText.textContent = t('editor.composer.markdown.protection.confirmPasswordLabel');
    confirmBtn.textContent = opts.confirmLabel ? String(opts.confirmLabel) : t('editor.composer.dialogs.confirm');
    cancelBtn.textContent = opts.cancelLabel ? String(opts.cancelLabel) : t('editor.composer.dialogs.cancel');
    passwordInput.value = '';
    confirmInput.value = '';
    error.textContent = '';
    passwordInput.setAttribute('aria-invalid', 'false');
    confirmInput.setAttribute('aria-invalid', 'false');
    confirmLabel.hidden = !requireConfirm;

    return new Promise((resolve) => {
      let closed = false;

      const setError = (text) => {
        const value = String(text || '');
        error.textContent = value;
        passwordInput.setAttribute('aria-invalid', value ? 'true' : 'false');
        confirmInput.setAttribute('aria-invalid', value && requireConfirm ? 'true' : 'false');
      };

      const finish = (value) => {
        if (closed) return;
        closed = true;
        overlay.classList.remove('is-visible');
        overlay.hidden = true;
        passwordInput.value = '';
        confirmInput.value = '';
        setError('');
        cancelBtn.removeEventListener('click', onCancel);
        confirmBtn.removeEventListener('click', onConfirm);
        passwordInput.removeEventListener('keydown', onKeyDown, true);
        confirmInput.removeEventListener('keydown', onKeyDown, true);
        overlay.removeEventListener('mousedown', onOverlayMouseDown, true);
        if (documentRef) documentRef.removeEventListener('keydown', onDocumentKeyDown, true);
        resolve(value ? String(value) : '');
      };

      const validate = () => {
        const password = String(passwordInput.value || '');
        const confirmation = String(confirmInput.value || '');
        if (!password) {
          setError(t('editor.composer.markdown.protection.passwordRequired'));
          focusElement(passwordInput, { preventScroll: true });
          return '';
        }
        if (requireConfirm && password !== confirmation) {
          setError(t('editor.composer.markdown.protection.passwordMismatch'));
          focusElement(confirmInput, { preventScroll: true });
          return '';
        }
        setError('');
        return password;
      };

      function onCancel(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        finish('');
      }

      function onConfirm(event) {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        const password = validate();
        if (!password) return;
        finish(password);
      }

      function onKeyDown(event) {
        if (!event) return;
        if (event.key === 'Enter') {
          event.preventDefault();
          const password = validate();
          if (!password) return;
          finish(password);
        }
      }

      function onDocumentKeyDown(event) {
        if (!event) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          finish('');
        }
      }

      function onOverlayMouseDown(event) {
        if (event && event.target === overlay) finish('');
      }

      cancelBtn.addEventListener('click', onCancel);
      confirmBtn.addEventListener('click', onConfirm);
      passwordInput.addEventListener('keydown', onKeyDown, true);
      confirmInput.addEventListener('keydown', onKeyDown, true);
      overlay.addEventListener('mousedown', onOverlayMouseDown, true);
      if (documentRef) documentRef.addEventListener('keydown', onDocumentKeyDown, true);

      overlay.hidden = false;
      overlay.classList.add('is-visible');
      focusElement(passwordInput, { preventScroll: true });
    });
  }

  function ensureDiscardConfirmElements() {
    if (discardConfirmElements) return discardConfirmElements;
    if (!documentRef || !documentRef.body || typeof documentRef.createElement !== 'function') return null;
    const popover = documentRef.createElement('div');
    popover.className = 'composer-confirm-popover';
    popover.id = 'composerDiscardConfirm';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    popover.hidden = true;

    const message = documentRef.createElement('div');
    message.className = 'composer-confirm-message';
    message.id = 'composerDiscardConfirmMessage';
    popover.setAttribute('aria-labelledby', message.id);
    popover.appendChild(message);

    const actions = documentRef.createElement('div');
    actions.className = 'composer-confirm-actions';

    const cancelBtn = documentRef.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn-secondary composer-confirm-cancel';
    cancelBtn.textContent = t('editor.composer.dialogs.cancel');

    const confirmBtn = documentRef.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn-secondary composer-confirm-confirm';
    confirmBtn.textContent = t('editor.composer.dialogs.confirm');

    actions.append(cancelBtn, confirmBtn);
    popover.appendChild(actions);

    documentRef.body.appendChild(popover);
    discardConfirmElements = { popover, message, cancelBtn, confirmBtn };
    return discardConfirmElements;
  }

  function showDiscardConfirm(anchor, messageText, options = {}) {
    const elements = ensureDiscardConfirmElements();
    if (!elements) return Promise.resolve(true);
    const { popover, message, cancelBtn, confirmBtn } = elements;
    const confirmLabel = options && options.confirmLabel
      ? String(options.confirmLabel)
      : t('editor.composer.dialogs.confirm');
    const cancelLabel = options && options.cancelLabel
      ? String(options.cancelLabel)
      : t('editor.composer.dialogs.cancel');

    message.textContent = String(messageText || '');
    cancelBtn.textContent = cancelLabel;
    confirmBtn.textContent = confirmLabel;

    if (anchor && typeof anchor.setAttribute === 'function') {
      anchor.setAttribute('aria-haspopup', 'dialog');
      anchor.setAttribute('aria-controls', popover.id);
    }

    if (typeof discardConfirmActiveClose === 'function') {
      try { discardConfirmActiveClose(false); } catch (_) {}
    }

    if (discardConfirmHideTimer) {
      clearTimer(discardConfirmHideTimer);
      discardConfirmHideTimer = null;
    }

    popover.hidden = false;
    popover.style.visibility = 'hidden';
    popover.classList.remove('is-visible');
    popover.dataset.placement = 'bottom';

    return new Promise((resolve) => {
      let closed = false;

      const finish = (result) => {
        if (closed) return;
        closed = true;
        discardConfirmActiveClose = null;

        popover.classList.remove('is-visible');
        popover.style.visibility = 'hidden';
        if (discardConfirmHideTimer) {
          clearTimer(discardConfirmHideTimer);
          discardConfirmHideTimer = null;
        }
        discardConfirmHideTimer = scheduleTimer(() => {
          popover.hidden = true;
          popover.style.visibility = '';
          popover.style.left = '';
          popover.style.top = '';
          discardConfirmHideTimer = null;
        }, 200);

        cancelBtn.removeEventListener('click', onCancel);
        confirmBtn.removeEventListener('click', onConfirm);
        if (documentRef) {
          documentRef.removeEventListener('keydown', onKeyDown, true);
          documentRef.removeEventListener('mousedown', onOutside, true);
          documentRef.removeEventListener('touchstart', onOutside, true);
        }
        if (windowRef && typeof windowRef.removeEventListener === 'function') {
          windowRef.removeEventListener('resize', reposition);
          windowRef.removeEventListener('scroll', reposition, true);
        }

        if (anchor && typeof anchor.setAttribute === 'function') {
          anchor.setAttribute('aria-expanded', 'false');
        }

        if (!result && anchor && typeof anchor.focus === 'function') {
          scheduleTimer(() => focusElement(anchor, { preventScroll: true }), 120);
        }

        resolve(!!result);
      };

      const onCancel = (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        finish(false);
      };
      const onConfirm = (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        finish(true);
      };
      const onOutside = (event) => {
        const target = event && event.target;
        if (!target) return;
        if (popover.contains(target) || target === anchor) return;
        finish(false);
      };
      const onKeyDown = (event) => {
        if (!event) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          finish(false);
          return;
        }
        if (event.key === 'Tab') {
          const focusables = [cancelBtn, confirmBtn];
          const active = documentRef ? documentRef.activeElement : null;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (event.shiftKey) {
            if (active === first || !focusables.includes(active)) {
              event.preventDefault();
              focusElement(last, { preventScroll: true });
            }
          } else if (active === last) {
            event.preventDefault();
            focusElement(first, { preventScroll: true });
          } else if (!focusables.includes(active)) {
            event.preventDefault();
            focusElement(first, { preventScroll: true });
          }
        }
      };

      const reposition = () => {
        if (closed) return;
        positionPopover(popover, anchor, () => finish(false));
      };

      cancelBtn.addEventListener('click', onCancel);
      confirmBtn.addEventListener('click', onConfirm);
      if (documentRef) {
        documentRef.addEventListener('keydown', onKeyDown, true);
        documentRef.addEventListener('mousedown', onOutside, true);
        documentRef.addEventListener('touchstart', onOutside, true);
      }
      if (windowRef && typeof windowRef.addEventListener === 'function') {
        windowRef.addEventListener('resize', reposition);
        windowRef.addEventListener('scroll', reposition, true);
      }

      discardConfirmActiveClose = finish;

      scheduleFrame(() => {
        if (closed) return;
        reposition();
        if (closed) return;
        popover.style.visibility = '';
        popover.classList.add('is-visible');
        if (anchor && typeof anchor.setAttribute === 'function') {
          anchor.setAttribute('aria-expanded', 'true');
        }
        focusElement(confirmBtn, { preventScroll: true });
      });
    });
  }

  return {
    showAddEntryPrompt,
    showDiscardConfirm,
    requestMarkdownProtectionPassword
  };
}
