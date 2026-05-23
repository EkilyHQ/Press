const noop = () => {};

function getScrollY(runtime) {
  let pageY = 0;
  try {
    if (runtime && typeof runtime.getPageYOffset === 'function') {
      pageY = Number(runtime.getPageYOffset()) || 0;
    }
  } catch (_) {}
  if (pageY) return pageY;

  try {
    const documentElement = runtime && typeof runtime.getDocumentElement === 'function'
      ? runtime.getDocumentElement()
      : null;
    return Number(documentElement && documentElement.scrollTop) || 0;
  } catch (_) {
    return 0;
  }
}

export function createEditorMainScrollSession(options = {}) {
  const runtime = options.runtime || {};
  const buttonId = options.buttonId || 'backToTop';
  const threshold = Number.isFinite(options.threshold) ? Math.max(0, options.threshold) : 260;

  let button = null;
  let detachScroll = noop;
  let clickHandler = null;

  const syncVisibility = () => {
    if (!button || !button.classList) return false;
    const shouldShow = getScrollY(runtime) > threshold;
    if (shouldShow) button.classList.add('show');
    else button.classList.remove('show');
    return shouldShow;
  };

  const dispose = () => {
    try { detachScroll(); } catch (_) {}
    detachScroll = noop;
    if (button && clickHandler && typeof button.removeEventListener === 'function') {
      try { button.removeEventListener('click', clickHandler); } catch (_) {}
    }
    clickHandler = null;
    button = null;
  };

  const bind = () => {
    dispose();
    button = runtime && typeof runtime.getElementById === 'function'
      ? runtime.getElementById(buttonId)
      : null;
    if (!button) return noop;

    try { button.hidden = false; } catch (_) {}

    if (typeof runtime.onWindow === 'function') {
      detachScroll = runtime.onWindow('scroll', syncVisibility, { passive: true }) || noop;
    }

    clickHandler = () => {
      if (runtime && typeof runtime.scrollToTop === 'function') {
        runtime.scrollToTop({ smooth: true });
      }
    };
    if (typeof button.addEventListener === 'function') {
      button.addEventListener('click', clickHandler);
    }

    syncVisibility();
    return dispose;
  };

  return {
    bind,
    dispose,
    syncVisibility
  };
}
