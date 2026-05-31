const SERVICE_NAMES = [
  'activeSession',
  'bodySession',
  'cardPickerSession',
  'commandSession',
  'focusSession',
  'inlineToolbarSession',
  'layoutSession',
  'linkSession',
  'listSession',
  'mathSession',
  'pointerSession'
];

export const EDITOR_BLOCKS_SESSION_CALLS = Object.freeze({
  activateEditableFromPointer: Object.freeze({ slot: 'activeSession', method: 'activateEditableFromPointer', fallback: false }),
  activateNonTextBlockFromPointer: Object.freeze({ slot: 'activeSession', method: 'activateNonTextBlockFromPointer', fallback: false }),
  blockNavigationTarget: Object.freeze({ slot: 'focusSession', method: 'blockNavigationTarget', fallback: null }),
  focusBlockNavigationTarget: Object.freeze({ slot: 'focusSession', method: 'focusBlockNavigationTarget', fallback: false }),
  focusBlockPrimaryEditable: Object.freeze({ slot: 'focusSession', method: 'focusBlockPrimaryEditable', fallback: false }),
  focusFirstCommandItem: Object.freeze({ slot: 'commandSession', method: 'focusFirstCommandItem', fallback: false }),
  focusListItemEditable: Object.freeze({ slot: 'focusSession', method: 'focusListItemEditable', fallback: false }),
  focusPreviousBlockEnd: Object.freeze({ slot: 'focusSession', method: 'focusPreviousBlockEnd', fallback: false }),
  forwardBlockHeadWheel: Object.freeze({ slot: 'layoutSession', method: 'forwardBlockHeadWheel', fallback: false }),
  handleCrossBlockArrowNavigation: Object.freeze({ slot: 'focusSession', method: 'handleCrossBlockArrowNavigation', fallback: false }),
  insertCommandBlock: Object.freeze({ slot: 'commandSession', method: 'insertCommandBlock', fallback: null }),
  isBlocksCaretInteractiveTarget: Object.freeze({ slot: 'pointerSession', method: 'isBlocksCaretInteractiveTarget', fallback: false }),
  moveBlock: Object.freeze({ slot: 'layoutSession', method: 'moveBlock', fallback: false }),
  openLinkEditorForSelection: Object.freeze({ slot: 'linkSession', method: 'openForSelection', fallback: false }),
  openMathEditorForBlock: Object.freeze({ slot: 'mathSession', method: 'openForBlock', fallback: false }),
  openMathEditorForNode: Object.freeze({ slot: 'mathSession', method: 'openForNode', fallback: false }),
  openMathEditorForSelection: Object.freeze({ slot: 'mathSession', method: 'openForSelection', fallback: false }),
  refreshLinkEditor: Object.freeze({ slot: 'linkSession', method: 'refresh', fallback: false }),
  renderBlankBlock: Object.freeze({ slot: 'commandSession', method: 'renderBlankBlock', fallback: null }),
  renderCardPicker: Object.freeze({ slot: 'cardPickerSession', method: 'render', fallback: false }),
  replaceAdjacentBlockElements: Object.freeze({ slot: 'bodySession', method: 'replaceAdjacentBlockElements', fallback: false }),
  routeBlocksCaretFromPointer: Object.freeze({ slot: 'pointerSession', method: 'routeBlocksCaretFromPointer', fallback: false }),
  routeDirectQuoteCaretFromPointer: Object.freeze({ slot: 'pointerSession', method: 'routeDirectQuoteCaretFromPointer', fallback: false }),
  setActive: Object.freeze({ slot: 'activeSession', method: 'setActive', fallback: false }),
  setCardEntries: Object.freeze({ slot: 'cardPickerSession', method: 'setEntries', fallback: false, handled: true }),
  setContentEditableCaretFromPoint: Object.freeze({ slot: 'pointerSession', method: 'setContentEditableCaretFromPoint', fallback: false }),
  setTextareaCaretFromPoint: Object.freeze({ slot: 'pointerSession', method: 'setTextareaCaretFromPoint', fallback: false }),
  syncActiveTypeSelect: Object.freeze({ slot: 'listSession', method: 'syncActiveTypeSelect', fallback: false }),
  updateInlineToolbarState: Object.freeze({ slot: 'inlineToolbarSession', method: 'update', fallback: false }),
  requestStickyBlockHeadUpdate: Object.freeze({ slot: 'layoutSession', method: 'requestStickyBlockHeadUpdate', fallback: false })
});

function createEmptyServices() {
  return SERVICE_NAMES.reduce((result, name) => {
    result[name] = null;
    return result;
  }, {});
}

function createDiagnostic(entry = {}) {
  const slot = String(entry.slot || '');
  const method = String(entry.method || '');
  const reason = String(entry.reason || 'contract');
  const message = entry.message
    ? String(entry.message)
    : `Editor blocks session contract mismatch: ${slot}.${method}.`;
  const diagnostic = {
    slot,
    method,
    reason,
    message
  };
  if (entry.error && entry.error.message) diagnostic.error = String(entry.error.message);
  return diagnostic;
}

export function createEditorBlocksSessionRegistry(options = {}) {
  const services = createEmptyServices();
  const diagnostics = [];
  const onDiagnostic = typeof options.onDiagnostic === 'function' ? options.onDiagnostic : null;

  const emitDiagnostic = (entry) => {
    const diagnostic = createDiagnostic(entry);
    diagnostics.push(diagnostic);
    if (diagnostics.length > 50) diagnostics.shift();
    if (onDiagnostic) {
      try { onDiagnostic(diagnostic); } catch (_) {}
    }
    return diagnostic;
  };

  const get = (name) => services[name] || null;
  const set = (name, service) => {
    services[name] = service || null;
    return services[name];
  };

  const call = (descriptor, ...args) => {
    const target = get(descriptor.slot);
    if (!target) return descriptor.fallback;
    if (typeof target[descriptor.method] !== 'function') {
      emitDiagnostic({
        slot: descriptor.slot,
        method: descriptor.method,
        reason: 'missingMethod'
      });
      return descriptor.fallback;
    }
    try {
      const result = target[descriptor.method](...args);
      return result === undefined ? descriptor.fallback : result;
    } catch (err) {
      emitDiagnostic({
        slot: descriptor.slot,
        method: descriptor.method,
        reason: 'thrown',
        error: err
      });
      return descriptor.fallback;
    }
  };

  const handledCall = (descriptor, ...args) => {
    const target = get(descriptor.slot);
    if (!target) return false;
    if (typeof target[descriptor.method] !== 'function') {
      emitDiagnostic({
        slot: descriptor.slot,
        method: descriptor.method,
        reason: 'missingMethod'
      });
      return false;
    }
    try {
      target[descriptor.method](...args);
      return true;
    } catch (err) {
      emitDiagnostic({
        slot: descriptor.slot,
        method: descriptor.method,
        reason: 'thrown',
        error: err
      });
      return false;
    }
  };

  return {
    activateEditableFromPointer: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.activateEditableFromPointer, ...args),
    activateNonTextBlockFromPointer: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.activateNonTextBlockFromPointer, ...args),
    blockNavigationTarget: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.blockNavigationTarget, ...args),
    clearDiagnostics: () => {
      diagnostics.splice(0, diagnostics.length);
    },
    focusBlockNavigationTarget: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.focusBlockNavigationTarget, ...args),
    focusBlockPrimaryEditable: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.focusBlockPrimaryEditable, ...args),
    focusFirstCommandItem: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.focusFirstCommandItem, ...args),
    focusListItemEditable: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.focusListItemEditable, ...args),
    focusPreviousBlockEnd: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.focusPreviousBlockEnd, ...args),
    forwardBlockHeadWheel: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.forwardBlockHeadWheel, ...args),
    getActiveSession: () => get('activeSession'),
    getBodySession: () => get('bodySession'),
    getCardPickerSession: () => get('cardPickerSession'),
    getCommandSession: () => get('commandSession'),
    getDiagnostics: () => diagnostics.slice(),
    getFocusSession: () => get('focusSession'),
    getInlineToolbarSession: () => get('inlineToolbarSession'),
    getLayoutSession: () => get('layoutSession'),
    getLinkSession: () => get('linkSession'),
    getListSession: () => get('listSession'),
    getMathSession: () => get('mathSession'),
    getPointerSession: () => get('pointerSession'),
    handleCrossBlockArrowNavigation: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.handleCrossBlockArrowNavigation, ...args),
    insertCommandBlock: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.insertCommandBlock, ...args),
    isBlocksCaretInteractiveTarget: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.isBlocksCaretInteractiveTarget, ...args),
    moveBlock: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.moveBlock, ...args),
    openLinkEditorForSelection: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.openLinkEditorForSelection, ...args),
    openMathEditorForBlock: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.openMathEditorForBlock, ...args),
    openMathEditorForNode: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.openMathEditorForNode, ...args),
    openMathEditorForSelection: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.openMathEditorForSelection, ...args),
    refreshLinkEditor: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.refreshLinkEditor, ...args),
    renderBlankBlock: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.renderBlankBlock, ...args),
    renderCardPicker: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.renderCardPicker, ...args),
    replaceAdjacentBlockElements: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.replaceAdjacentBlockElements, ...args),
    routeBlocksCaretFromPointer: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.routeBlocksCaretFromPointer, ...args),
    routeDirectQuoteCaretFromPointer: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.routeDirectQuoteCaretFromPointer, ...args),
    setActive: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.setActive, ...args),
    setActiveSession: (service) => set('activeSession', service),
    setBodySession: (service) => set('bodySession', service),
    setCardEntries: (...args) => handledCall(EDITOR_BLOCKS_SESSION_CALLS.setCardEntries, ...args),
    setCardPickerSession: (service) => set('cardPickerSession', service),
    setCommandSession: (service) => set('commandSession', service),
    setContentEditableCaretFromPoint: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.setContentEditableCaretFromPoint, ...args),
    setFocusSession: (service) => set('focusSession', service),
    setInlineToolbarSession: (service) => set('inlineToolbarSession', service),
    setLayoutSession: (service) => set('layoutSession', service),
    setLinkSession: (service) => set('linkSession', service),
    setListSession: (service) => set('listSession', service),
    setMathSession: (service) => set('mathSession', service),
    setPointerSession: (service) => set('pointerSession', service),
    setTextareaCaretFromPoint: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.setTextareaCaretFromPoint, ...args),
    syncActiveTypeSelect: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.syncActiveTypeSelect, ...args),
    updateInlineToolbarState: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.updateInlineToolbarState, ...args),
    requestStickyBlockHeadUpdate: (...args) => call(EDITOR_BLOCKS_SESSION_CALLS.requestStickyBlockHeadUpdate, ...args)
  };
}
