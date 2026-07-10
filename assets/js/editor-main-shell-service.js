const noop = () => {};

export function createEditorMainShellService(options = {}) {
  const runtime = options.runtime || {};
  const editor = options.editor || null;
  const textarea = options.textarea || null;
  const emitToastImpl = typeof runtime.emitToast === 'function'
    ? runtime.emitToast.bind(runtime)
    : noop;

  const requestLayout = () => {
    try {
      if (editor && typeof editor.refreshLayout === 'function') {
        editor.refreshLayout();
        return true;
      }
      if (!textarea) return false;
      textarea.style.height = '0px';
      textarea.offsetHeight;
      textarea.style.height = `${textarea.scrollHeight}px`;
      return true;
    } catch (_) {
      return false;
    }
  };

  const emitToast = (kind, message) => {
    const text = message == null ? '' : String(message);
    if (!text) return false;
    try {
      emitToastImpl(kind, text);
      return true;
    } catch (_) {
      return false;
    }
  };

  return {
    emitToast,
    requestLayout
  };
}
