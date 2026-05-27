export function createFrontMatterLabelWidthSync(options = {}) {
  const documentRef = options.documentRef || null;
  const requestFrame = typeof options.requestFrame === 'function'
    ? options.requestFrame
    : () => 0;
  const cancelFrame = typeof options.cancelFrame === 'function'
    ? options.cancelFrame
    : () => {};
  const getComputedStyleRef = typeof options.getComputedStyle === 'function'
    ? options.getComputedStyle
    : null;
  const ResizeObserverRef = typeof options.ResizeObserver === 'function'
    ? options.ResizeObserver
    : null;

  const measureLabelText = (label) => {
    let width = label && label.scrollWidth ? label.scrollWidth : 0;
    try {
      const doc = documentRef;
      if (!doc || !doc.body || typeof doc.createElement !== 'function') return width;
      const probe = doc.createElement('span');
      probe.textContent = label.textContent || '';
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.whiteSpace = 'nowrap';
      probe.style.left = '-9999px';
      probe.style.top = '0';
      const sourceStyle = getComputedStyleRef ? getComputedStyleRef(label) : null;
      if (sourceStyle) {
        probe.style.fontFamily = sourceStyle.fontFamily;
        probe.style.fontSize = sourceStyle.fontSize;
        probe.style.fontStyle = sourceStyle.fontStyle;
        probe.style.fontWeight = sourceStyle.fontWeight;
        probe.style.letterSpacing = sourceStyle.letterSpacing;
        probe.style.textTransform = sourceStyle.textTransform;
      }
      doc.body.appendChild(probe);
      width = Math.max(width, probe.scrollWidth || Math.ceil(probe.getBoundingClientRect().width) || 0);
      probe.remove();
    } catch (_) {}
    return width;
  };

  const syncFrontMatterLabelWidth = (root) => {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    try {
      if (typeof root.__pressFrontMatterLabelWidthCleanup === 'function') root.__pressFrontMatterLabelWidthCleanup();
    } catch (_) {}
    try { root.__pressFrontMatterLabelWidthCleanup = null; } catch (_) {}

    const labels = Array.from(root.querySelectorAll('.frontmatter-field-title'));
    if (!labels.length) {
      try { root.style.removeProperty('--frontmatter-single-label-width'); } catch (_) {}
      return;
    }

    let frame = 0;
    let observer = null;
    const measure = () => {
      frame = 0;
      let width = 88;
      labels.forEach((label) => {
        const target = label.closest ? label.closest('.frontmatter-field-label-wrap') : label;
        let measured = 0;
        try {
          const tooltip = target && target.querySelector ? target.querySelector('.frontmatter-help-tooltip') : null;
          const tooltipWidth = tooltip ? tooltip.scrollWidth || 0 : 0;
          const labelWidth = measureLabelText(label);
          const targetStyle = getComputedStyleRef ? getComputedStyleRef(target || label) : null;
          const gap = targetStyle ? parseFloat(targetStyle.gap || targetStyle.columnGap || '0') || 0 : 0;
          measured = labelWidth + tooltipWidth + gap;
        } catch (_) {
          try {
            const tooltip = target && target.querySelector ? target.querySelector('.frontmatter-help-tooltip') : null;
            measured = measureLabelText(label) + (tooltip ? tooltip.scrollWidth || 0 : 0);
          } catch (_) {}
        }
        width = Math.max(width, measured);
      });
      try { root.style.setProperty('--frontmatter-single-label-width', `${Math.ceil(width)}px`); } catch (_) {}
    };
    const schedule = () => {
      if (frame) return;
      frame = requestFrame(measure);
    };

    if (typeof ResizeObserverRef === 'function') {
      try {
        observer = new ResizeObserverRef(schedule);
        observer.observe(root);
        labels.forEach((label) => {
          const cell = label.closest ? label.closest('.frontmatter-field-label-wrap') : label;
          observer.observe(cell || label);
        });
      } catch (_) {
        observer = null;
      }
    }

    try {
      const fonts = documentRef && documentRef.fonts;
      if (fonts && typeof fonts.ready?.then === 'function') fonts.ready.then(schedule).catch(() => {});
    } catch (_) {}
    schedule();

    root.__pressFrontMatterLabelWidthCleanup = () => {
      cancelFrame(frame);
      frame = 0;
      try { if (observer) observer.disconnect(); } catch (_) {}
      observer = null;
    };
  };

  return { syncFrontMatterLabelWidth };
}
