function noop() {}

function defaultAutoSizeTextarea(area) {
  if (!area) return;
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight}px`;
}

function blockData(block) {
  return block && block.data && typeof block.data === 'object' ? block.data : {};
}

function createButton(documentRef, label, className = 'blocks-btn') {
  const el = documentRef.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = label || '';
  return el;
}

export function createEditorBlocksSourceSession({
  documentRef = null,
  editableSession = null,
  text = (_key, fallback) => fallback,
  caretSession = null,
  measureLimit = 1000,
  textareaTextOffsetDetailsFromPoint = () => null,
  autoSizeTextarea = defaultAutoSizeTextarea,
  removeEmptyBlockWithBackspace = () => false,
  handleCrossBlockArrowNavigation = () => false,
  updateFromControl = noop,
  setActive = noop,
  activateEditableFromPointer = noop,
  applyAutofix = noop,
  queueTask = task => { if (typeof task === 'function') task(); }
} = {}) {
  if (!documentRef) return null;

  const sourceReasonText = (block) => {
    const reason = block && block.data && block.data.sourceReason ? String(block.data.sourceReason) : 'unsupported';
    return text(`sourceReason.${reason}`, text('sourceReason.unsupported', 'This Markdown is kept as source because the block editor cannot safely convert it to a visual block without changing the original structure.'));
  };

  const createReasonHelp = (block, index) => {
    const wrap = documentRef.createElement('span');
    wrap.className = 'blocks-source-help-wrap';
    const help = createButton(documentRef, '?', 'blocks-source-help');
    const tooltipId = `blocks-source-help-${block && block.id ? block.id : index}`;
    const message = sourceReasonText(block);
    help.setAttribute('aria-label', message);
    help.setAttribute('aria-describedby', tooltipId);
    const bubble = documentRef.createElement('span');
    bubble.id = tooltipId;
    bubble.className = 'blocks-source-help-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = message;
    wrap.append(help, bubble);
    return wrap;
  };

  const sourceAutofixLabel = (block) => {
    const reason = block && block.data && block.data.sourceReason ? String(block.data.sourceReason) : '';
    return text(`sourceAutofix.${reason}`, text('sourceAutofix.unsupported', 'Autofix'));
  };

  const canAutofix = (block) => !!(block && block.type === 'source' && block.data && block.data.sourceReason === 'indentedList');

  const createAutofixButton = (block, index) => {
    const label = sourceAutofixLabel(block);
    const autofix = createButton(documentRef, '', 'blocks-source-autofix');
    const icon = documentRef.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '\u2605';
    const labelSpan = documentRef.createElement('span');
    labelSpan.className = 'blocks-source-autofix-label';
    labelSpan.textContent = text('sourceAutofix.label', 'Autofix');
    autofix.append(icon, labelSpan);
    autofix.title = label;
    autofix.setAttribute('aria-label', label);
    autofix.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActive(index);
      applyAutofix(index);
    });
    return autofix;
  };

  const renderBlock = (body, block, index) => {
    if (!body || !block) return;
    const data = blockData(block);
    const area = documentRef.createElement('textarea');
    area.className = 'blocks-textarea blocks-source-textarea';
    area.spellcheck = false;
    area.rows = 1;
    area.value = data.text != null ? data.text : block.raw || '';
    const sync = () => updateFromControl(block, { text: area.value });
    let sourcePointer = null;
    if (editableSession && typeof editableSession.registerEditable === 'function') {
      editableSession.registerEditable(area, sync);
    }
    area.addEventListener('input', () => {
      sync();
      autoSizeTextarea(area);
    });
    area.addEventListener('keydown', (event) => {
      if (removeEmptyBlockWithBackspace(event, block, index, area, sync)) return;
      handleCrossBlockArrowNavigation(event, index, area);
    });
    area.addEventListener('pointerdown', (event) => {
      if (!event || event.button !== 0 || event.isPrimary === false) return;
      activateEditableFromPointer(index, area, sync);
      const details = textareaTextOffsetDetailsFromPoint(area, event.clientX, event.clientY, measureLimit, caretSession);
      if (details && !details.insideTextRect) {
        event.preventDefault();
        sourcePointer = { x: event.clientX, y: event.clientY, moved: false, corrected: true };
        try { area.focus({ preventScroll: true }); }
        catch (_) {
          try { area.focus(); } catch (__) {}
        }
        try {
          area.setSelectionRange(details.offset, details.offset);
          autoSizeTextarea(area);
          setActive(index, area, sync);
        } catch (_) {}
        return;
      }
      sourcePointer = { x: event.clientX, y: event.clientY, moved: false, corrected: false };
    });
    area.addEventListener('pointermove', (event) => {
      if (!sourcePointer) return;
      const dx = event.clientX - sourcePointer.x;
      const dy = event.clientY - sourcePointer.y;
      if ((dx * dx) + (dy * dy) > 16) sourcePointer.moved = true;
    });
    area.addEventListener('click', (event) => {
      const pointer = sourcePointer;
      sourcePointer = null;
      if (!pointer || pointer.moved || pointer.corrected) return;
      const details = textareaTextOffsetDetailsFromPoint(area, event.clientX, event.clientY, measureLimit, caretSession);
      if (!details || details.insideTextRect) return;
      try {
        area.setSelectionRange(details.offset, details.offset);
        autoSizeTextarea(area);
        setActive(index, area, sync);
      } catch (_) {}
    });
    area.addEventListener('blur', () => { sourcePointer = null; });
    area.addEventListener('focus', () => {
      autoSizeTextarea(area);
      setActive(index, area, sync);
    });
    queueTask(() => autoSizeTextarea(area));
    body.appendChild(area);
  };

  return {
    canAutofix,
    createAutofixButton,
    createReasonHelp,
    renderBlock
  };
}
