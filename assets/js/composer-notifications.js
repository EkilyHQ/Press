export function createComposerNotificationController(options = {}) {
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const translate = typeof options.t === 'function' ? options.t : ((key) => String(key || ''));
  const safeString = typeof options.safeString === 'function'
    ? options.safeString
    : ((value) => String(value == null ? '' : value));
  const alertRef = typeof options.alertRef === 'function' ? options.alertRef : (message) => {
    if (windowRef && typeof windowRef.alert === 'function') windowRef.alert(message);
  };
  const consoleRef = options.consoleRef || null;

  function ensureToastRoot() {
    if (!documentRef) return null;
    let root = documentRef.getElementById('toast-root');
    if (!root) {
      root = documentRef.createElement('div');
      root.id = 'toast-root';
      root.setAttribute('role', 'status');
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-atomic', 'true');
      root.style.position = 'fixed';
      root.style.right = '28px';
      root.style.bottom = '28px';
      root.style.left = 'auto';
      root.style.transform = 'none';
      root.style.display = 'flex';
      root.style.flexDirection = 'column';
      root.style.alignItems = 'flex-end';
      root.style.gap = '.55rem';
      root.style.zIndex = '10000';
      root.style.pointerEvents = 'none';
      documentRef.body.appendChild(root);
    }
    return root;
  }

  function prepareToastStackAnimation(container, excluded) {
    if (!container || !windowRef) return null;
    const items = Array.from(container.children || [])
      .filter((child) => child !== excluded && child.dataset && child.dataset.dismissed !== 'true');
    if (!items.length) return null;

    const initialRects = new Map();
    for (const item of items) {
      try {
        initialRects.set(item, item.getBoundingClientRect());
      } catch (_) {
        /* ignore */
      }
    }

    return () => {
      if (!items.length) return;
      windowRef.requestAnimationFrame(() => {
        for (const item of items) {
          const first = initialRects.get(item);
          if (!first) continue;
          let last;
          try {
            last = item.getBoundingClientRect();
          } catch (_) {
            continue;
          }
          const deltaY = first.top - last.top;
          if (Math.abs(deltaY) < 0.5) continue;
          try {
            item.style.willChange = 'transform';
            const distance = Math.abs(deltaY);
            const baseDuration = distance > 1 ? Math.min(640, 320 + distance * 4) : 360;
            if (typeof item.animate === 'function') {
              const animation = item.animate(
                [
                  { transform: `translateY(${deltaY}px)` },
                  { transform: 'translateY(0)' }
                ],
                {
                  duration: baseDuration,
                  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                  fill: 'none'
                }
              );
              const cleanup = () => {
                item.style.transform = '';
                item.style.willChange = '';
              };
              animation.addEventListener('finish', cleanup, { once: true });
              animation.addEventListener('cancel', cleanup, { once: true });
            } else {
              const previousTransition = item.style.transition;
              item.style.transition = 'none';
              item.style.transform = `translateY(${deltaY}px)`;
              windowRef.requestAnimationFrame(() => {
                item.style.transition = `transform ${baseDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`;
                item.style.transform = 'translateY(0)';
                windowRef.setTimeout(() => {
                  item.style.transition = previousTransition;
                  item.style.transform = '';
                  item.style.willChange = '';
                }, baseDuration + 80);
              });
            }
          } catch (_) {
            /* ignore */
          }
        }
      });
    };
  }

  function showToast(kind, text, toastOptions = {}) {
    try {
      const message = safeString(text);
      if (!message) return;
      const root = ensureToastRoot();
      if (!root || !documentRef || !windowRef) return;
      const el = documentRef.createElement('div');
      el.className = `toast ${kind || ''}`;
      el.style.pointerEvents = 'auto';
      el.style.background = 'color-mix(in srgb, var(--card) 94%, #000 6%)';
      el.style.color = 'var(--text)';
      el.style.borderRadius = '999px';
      el.style.padding = '.55rem 1.1rem';
      el.style.boxShadow = '0 10px 30px rgba(15,23,42,0.18)';
      el.style.border = '1px solid color-mix(in srgb, var(--border) 65%, #000 25%)';
      el.style.fontSize = '.94rem';
      el.style.display = 'inline-flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.minWidth = 'min(320px, 90vw)';
      el.style.maxWidth = '90vw';
      el.style.textAlign = 'center';
      el.style.transition = 'opacity .28s ease, transform .28s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px)';
      el.style.gap = '.7rem';

      const textSpan = documentRef.createElement('span');
      textSpan.textContent = message;
      textSpan.style.flex = '1 1 auto';
      textSpan.style.textAlign = 'center';
      textSpan.style.minWidth = '0';
      el.appendChild(textSpan);

      const action = toastOptions && toastOptions.action;
      const hasAction = !!(action && (action.href || typeof action.onClick === 'function'));
      const shouldAutoDismiss = toastOptions.sticky !== true && !hasAction;

      const dismiss = () => {
        if (el.dataset.dismissed === 'true') return;
        el.dataset.dismissed = 'true';
        let toastRect = null;
        let rootRect = null;
        try {
          toastRect = el.getBoundingClientRect();
          rootRect = root.getBoundingClientRect();
        } catch (_) {
          /* ignore */
        }
        const animateStack = prepareToastStackAnimation(root, el);
        el.style.pointerEvents = 'none';
        if (toastRect && rootRect) {
          const offsetBottom = rootRect.bottom - toastRect.bottom;
          const offsetRight = rootRect.right - toastRect.right;
          el.style.position = 'absolute';
          el.style.bottom = `${offsetBottom}px`;
          el.style.right = `${offsetRight}px`;
          el.style.left = 'auto';
          el.style.top = 'auto';
          el.style.margin = '0';
          el.style.width = `${toastRect.width}px`;
          el.style.height = `${toastRect.height}px`;
          el.style.zIndex = '1';
        }
        if (typeof animateStack === 'function') {
          try { animateStack(); } catch (_) {}
        }
        el.style.opacity = '0';
        el.style.transform = 'translateY(12px)';
        windowRef.setTimeout(() => {
          try { el.remove(); } catch (_) {}
        }, 320);
      };

      if (hasAction) {
        el.style.justifyContent = 'space-between';
        textSpan.style.textAlign = 'left';
        const actionEl = documentRef.createElement(action.href ? 'a' : 'button');
        actionEl.className = 'toast-action';
        const defaultLabel = translate('editor.toast.openAction');
        actionEl.textContent = safeString(action.label) || defaultLabel;
        if (action.href) {
          actionEl.href = action.href;
          actionEl.target = action.target || '_blank';
          actionEl.rel = action.rel || 'noopener';
        } else {
          actionEl.type = 'button';
        }
        actionEl.style.flex = '0 0 auto';
        actionEl.style.marginLeft = '.35rem';
        actionEl.style.padding = '.35rem .85rem';
        actionEl.style.borderRadius = '999px';
        actionEl.style.border = '1px solid color-mix(in srgb, var(--primary) 28%, var(--border))';
        actionEl.style.background = 'color-mix(in srgb, var(--card) 88%, var(--primary) 10%)';
        actionEl.style.color = 'color-mix(in srgb, var(--primary) 85%, var(--text) 40%)';
        actionEl.style.fontWeight = '600';
        actionEl.style.fontSize = '.88rem';
        actionEl.style.pointerEvents = 'auto';
        actionEl.style.textDecoration = 'none';
        actionEl.style.display = 'inline-flex';
        actionEl.style.alignItems = 'center';
        actionEl.style.justifyContent = 'center';
        actionEl.style.gap = '.35rem';
        actionEl.style.cursor = 'pointer';
        if (typeof action.onClick === 'function') {
          actionEl.addEventListener('click', (event) => {
            try { action.onClick(event); } catch (_) {}
          });
        }
        el.appendChild(actionEl);
      }

      if (!shouldAutoDismiss) {
        el.style.justifyContent = 'space-between';
        textSpan.style.textAlign = 'left';
        const closeButton = documentRef.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'toast-close';
        closeButton.setAttribute('aria-label', translate('editor.toast.closeAria'));
        closeButton.textContent = '\u00D7';
        closeButton.style.flex = '0 0 auto';
        closeButton.style.marginLeft = '.5rem';
        closeButton.style.width = '2rem';
        closeButton.style.height = '2rem';
        closeButton.style.borderRadius = '50%';
        closeButton.style.border = '1px solid color-mix(in srgb, var(--border) 70%, transparent)';
        closeButton.style.background = 'transparent';
        closeButton.style.color = 'inherit';
        closeButton.style.fontSize = '1.1rem';
        closeButton.style.lineHeight = '1';
        closeButton.style.display = 'inline-flex';
        closeButton.style.alignItems = 'center';
        closeButton.style.justifyContent = 'center';
        closeButton.style.cursor = 'pointer';
        closeButton.style.pointerEvents = 'auto';
        closeButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          dismiss();
        });
        el.appendChild(closeButton);
      }

      if (kind === 'error') {
        el.style.borderColor = 'color-mix(in srgb, #dc2626 45%, transparent)';
      } else if (kind === 'success') {
        el.style.borderColor = 'color-mix(in srgb, #16a34a 45%, transparent)';
      } else if (kind === 'warn' || kind === 'warning') {
        el.style.borderColor = 'color-mix(in srgb, #f59e0b 45%, transparent)';
      }
      root.appendChild(el);
      windowRef.requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });
      if (shouldAutoDismiss) {
        const ttl = typeof toastOptions.duration === 'number' ? Math.max(1200, toastOptions.duration) : 2300;
        windowRef.setTimeout(dismiss, ttl);
      }
    } catch (_) {
      try { alertRef(text); } catch (__) {}
    }
  }

  function preparePopupWindow() {
    try {
      const win = windowRef && typeof windowRef.open === 'function' ? windowRef.open('', '_blank') : null;
      if (win) {
        try { win.opener = null; } catch (_) {}
      }
      return win;
    } catch (_) {
      return null;
    }
  }

  function closePopupWindow(win) {
    if (!win) return;
    try {
      if (!win.closed) win.close();
    } catch (_) {}
  }

  function finalizePopupWindow(win, href) {
    if (!href) {
      closePopupWindow(win);
      return null;
    }
    if (win && !win.closed) {
      try {
        win.location.replace(href);
        win.opener = null;
        return win;
      } catch (_) {
        closePopupWindow(win);
      }
    }
    let opened = null;
    try {
      opened = windowRef && typeof windowRef.open === 'function'
        ? windowRef.open(href, '_blank')
        : null;
    } catch (_) {
      opened = null;
    }
    if (opened) {
      try { opened.opener = null; } catch (_) {}
      return opened;
    }
    return null;
  }

  function handlePopupBlocked(href, popupOptions = {}) {
    try {
      if (consoleRef && typeof consoleRef.warn === 'function') {
        consoleRef.warn('Popup blocked while opening GitHub window', href);
      }
    } catch (_) {}
    const message = safeString(popupOptions.message) || translate('editor.toasts.popupBlocked');
    const kind = safeString(popupOptions.kind) || 'warn';
    const duration = typeof popupOptions.duration === 'number' ? Math.max(1600, popupOptions.duration) : 9000;
    const actionHref = safeString(popupOptions.actionHref || href);
    const actionLabel = safeString(popupOptions.actionLabel) || translate('editor.toasts.openGithubAction');
    const onRetry = typeof popupOptions.onRetry === 'function' ? popupOptions.onRetry : null;

    showToast(kind, message, {
      duration,
      action: actionHref
        ? {
            label: actionLabel,
            href: actionHref,
            target: safeString(popupOptions.actionTarget) || '_blank',
            rel: safeString(popupOptions.actionRel) || 'noopener',
            onClick: (event) => {
              if (onRetry) {
                windowRef.setTimeout(() => {
                  try { onRetry(event); } catch (_) {}
                }, 60);
              }
            }
          }
        : null
    });
  }

  return {
    showToast,
    preparePopupWindow,
    closePopupWindow,
    finalizePopupWindow,
    handlePopupBlocked
  };
}
