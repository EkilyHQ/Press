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

function createEmptyServices() {
  return SERVICE_NAMES.reduce((result, name) => {
    result[name] = null;
    return result;
  }, {});
}

export function createEditorBlocksSessionRegistry() {
  const services = createEmptyServices();

  const get = (name) => services[name] || null;
  const set = (name, service) => {
    services[name] = service || null;
    return services[name];
  };

  const call = (name, method, fallback, ...args) => {
    const target = get(name);
    if (!target || typeof target[method] !== 'function') return fallback;
    try {
      const result = target[method](...args);
      return result === undefined ? fallback : result;
    } catch (_) {
      return fallback;
    }
  };

  const handledCall = (name, method, ...args) => {
    const target = get(name);
    if (!target || typeof target[method] !== 'function') return false;
    try {
      target[method](...args);
      return true;
    } catch (_) {
      return false;
    }
  };

  return {
    activateEditableFromPointer: (...args) => call('activeSession', 'activateEditableFromPointer', false, ...args),
    activateNonTextBlockFromPointer: (...args) => call('activeSession', 'activateNonTextBlockFromPointer', false, ...args),
    blockNavigationTarget: (...args) => call('focusSession', 'blockNavigationTarget', null, ...args),
    focusBlockNavigationTarget: (...args) => call('focusSession', 'focusBlockNavigationTarget', false, ...args),
    focusBlockPrimaryEditable: (...args) => call('focusSession', 'focusBlockPrimaryEditable', false, ...args),
    focusFirstCommandItem: (...args) => call('commandSession', 'focusFirstCommandItem', false, ...args),
    focusListItemEditable: (...args) => call('focusSession', 'focusListItemEditable', false, ...args),
    focusPreviousBlockEnd: (...args) => call('focusSession', 'focusPreviousBlockEnd', false, ...args),
    forwardBlockHeadWheel: (...args) => call('layoutSession', 'forwardBlockHeadWheel', false, ...args),
    getActiveSession: () => get('activeSession'),
    getBodySession: () => get('bodySession'),
    getCardPickerSession: () => get('cardPickerSession'),
    getCommandSession: () => get('commandSession'),
    getFocusSession: () => get('focusSession'),
    getInlineToolbarSession: () => get('inlineToolbarSession'),
    getLayoutSession: () => get('layoutSession'),
    getLinkSession: () => get('linkSession'),
    getListSession: () => get('listSession'),
    getMathSession: () => get('mathSession'),
    getPointerSession: () => get('pointerSession'),
    handleCrossBlockArrowNavigation: (...args) => call('focusSession', 'handleCrossBlockArrowNavigation', false, ...args),
    insertCommandBlock: (...args) => call('commandSession', 'insertCommandBlock', null, ...args),
    isBlocksCaretInteractiveTarget: (...args) => call('pointerSession', 'isBlocksCaretInteractiveTarget', false, ...args),
    moveBlock: (...args) => call('layoutSession', 'moveBlock', false, ...args),
    openLinkEditorForSelection: (...args) => call('linkSession', 'openForSelection', false, ...args),
    openMathEditorForBlock: (...args) => call('mathSession', 'openForBlock', false, ...args),
    openMathEditorForNode: (...args) => call('mathSession', 'openForNode', false, ...args),
    openMathEditorForSelection: (...args) => call('mathSession', 'openForSelection', false, ...args),
    refreshLinkEditor: (...args) => call('linkSession', 'refresh', false, ...args),
    renderBlankBlock: (...args) => call('commandSession', 'renderBlankBlock', null, ...args),
    renderCardPicker: (...args) => call('cardPickerSession', 'render', false, ...args),
    replaceAdjacentBlockElements: (...args) => call('bodySession', 'replaceAdjacentBlockElements', false, ...args),
    routeBlocksCaretFromPointer: (...args) => call('pointerSession', 'routeBlocksCaretFromPointer', false, ...args),
    routeDirectQuoteCaretFromPointer: (...args) => call('pointerSession', 'routeDirectQuoteCaretFromPointer', false, ...args),
    setActive: (...args) => call('activeSession', 'setActive', false, ...args),
    setActiveSession: (service) => set('activeSession', service),
    setBodySession: (service) => set('bodySession', service),
    setCardEntries: (...args) => handledCall('cardPickerSession', 'setEntries', ...args),
    setCardPickerSession: (service) => set('cardPickerSession', service),
    setCommandSession: (service) => set('commandSession', service),
    setContentEditableCaretFromPoint: (...args) => call('pointerSession', 'setContentEditableCaretFromPoint', false, ...args),
    setFocusSession: (service) => set('focusSession', service),
    setInlineToolbarSession: (service) => set('inlineToolbarSession', service),
    setLayoutSession: (service) => set('layoutSession', service),
    setLinkSession: (service) => set('linkSession', service),
    setListSession: (service) => set('listSession', service),
    setMathSession: (service) => set('mathSession', service),
    setPointerSession: (service) => set('pointerSession', service),
    setTextareaCaretFromPoint: (...args) => call('pointerSession', 'setTextareaCaretFromPoint', false, ...args),
    syncActiveTypeSelect: (...args) => call('listSession', 'syncActiveTypeSelect', false, ...args),
    updateInlineToolbarState: (...args) => call('inlineToolbarSession', 'update', false, ...args),
    requestStickyBlockHeadUpdate: (...args) => call('layoutSession', 'requestStickyBlockHeadUpdate', false, ...args)
  };
}
