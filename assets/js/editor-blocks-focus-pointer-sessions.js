import { CARET_POINT_MEASURE_LIMIT } from './editor-blocks-caret-session.js';
import { createEditorBlocksFocusSession } from './editor-blocks-focus-session.js';
import { createEditorBlocksPointerSession } from './editor-blocks-pointer-session.js';

function noop() {}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function queueTaskFallback(task) {
  if (typeof task !== 'function') return;
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task);
    return;
  }
  Promise.resolve().then(task).catch(noop);
}

function callSession(session, method, fallback, ...args) {
  if (!session || typeof session[method] !== 'function') return fallback;
  try {
    const result = session[method](...args);
    return result === undefined ? fallback : result;
  } catch (_) {
    return fallback;
  }
}

export function createEditorBlocksFocusPointerSessions(options = {}) {
  const blockSessions = options.blockSessions || null;
  const blocksState = options.blocksState || null;
  const queueTask = typeof options.queueTask === 'function' ? options.queueTask : queueTaskFallback;
  const updateInlineToolbarState = typeof options.updateInlineToolbarState === 'function'
    ? options.updateInlineToolbarState
    : noop;
  const onInlineToolbarUpdate = () => {
    try { updateInlineToolbarState(); } catch (_) {}
  };

  const focusSessionValue = createEditorBlocksFocusSession({
    state: options.state || null,
    blocksState,
    caretSession: options.caretSession,
    editableSession: options.editableSession,
    blockElements: typeof options.blockElements === 'function' ? options.blockElements : () => [],
    editableListItems: typeof options.editableListItems === 'function' ? options.editableListItems : value => safeArray(value),
    setActive: typeof options.setActive === 'function' ? options.setActive : noop,
    activateNonTextBlockFromPointer: options.activateNonTextBlockFromPointer,
    onInlineToolbarUpdate,
    queueTask
  });
  const focusSession = blockSessions && typeof blockSessions.setFocusSession === 'function'
    ? blockSessions.setFocusSession(focusSessionValue)
    : focusSessionValue;

  const pointerSessionValue = createEditorBlocksPointerSession({
    blocksState,
    caretSession: options.caretSession,
    selectionSession: options.selectionSession,
    editableSession: options.editableSession,
    blockElements: typeof options.blockElements === 'function' ? options.blockElements : () => [],
    closestElement: options.closestElement,
    containsNode: options.containsNode,
    setActive: typeof options.setActive === 'function' ? options.setActive : noop,
    activateEditableFromPointer: options.activateEditableFromPointer,
    activateNonTextBlockFromPointer: options.activateNonTextBlockFromPointer,
    onInlineToolbarUpdate,
    autoSizeTextarea: typeof options.autoSizeTextarea === 'function' ? options.autoSizeTextarea : noop,
    measureLimit: Number.isFinite(Number(options.measureLimit)) ? Number(options.measureLimit) : CARET_POINT_MEASURE_LIMIT
  });
  const pointerSession = blockSessions && typeof blockSessions.setPointerSession === 'function'
    ? blockSessions.setPointerSession(pointerSessionValue)
    : pointerSessionValue;

  const shouldSuppressRoutedBlockContainerClick = () => {
    return !!(blocksState
      && typeof blocksState.consumeRoutedBlockContainerClickSuppression === 'function'
      && blocksState.consumeRoutedBlockContainerClickSuppression(Date.now()));
  };

  return {
    focusSession,
    pointerSession,
    blockNavigationTarget: (...args) => callSession(focusSession, 'blockNavigationTarget', null, ...args),
    focusBlockNavigationTarget: (...args) => callSession(focusSession, 'focusBlockNavigationTarget', false, ...args),
    handleCrossBlockArrowNavigation: (...args) => callSession(focusSession, 'handleCrossBlockArrowNavigation', false, ...args),
    isBlocksCaretInteractiveTarget: (...args) => callSession(pointerSession, 'isBlocksCaretInteractiveTarget', false, ...args),
    routeBlocksCaretFromPointer: (...args) => callSession(pointerSession, 'routeBlocksCaretFromPointer', false, ...args),
    routeDirectQuoteCaretFromPointer: (...args) => callSession(pointerSession, 'routeDirectQuoteCaretFromPointer', false, ...args),
    setContentEditableCaretFromPoint: (...args) => callSession(pointerSession, 'setContentEditableCaretFromPoint', false, ...args),
    setTextareaCaretFromPoint: (...args) => callSession(pointerSession, 'setTextareaCaretFromPoint', false, ...args),
    shouldSuppressRoutedBlockContainerClick
  };
}
