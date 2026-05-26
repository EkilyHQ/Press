import { createEditorMainToolbarCardPicker } from './editor-main-toolbar-card-picker.js';
import { createEditorMainToolbarTextActions } from './editor-main-toolbar-text-actions.js';

const noop = () => {};
const fallbackTranslate = (key) => key;

const BUTTON_DISABLED_HINT_KEYS = {
  btnFmtBold: 'editor.editorTools.hints.bold',
  btnFmtItalic: 'editor.editorTools.hints.italic',
  btnFmtStrike: 'editor.editorTools.hints.strike',
  btnFmtHeading: 'editor.editorTools.hints.heading',
  btnFmtQuote: 'editor.editorTools.hints.quote',
  btnFmtCode: 'editor.editorTools.hints.code',
  btnFmtCodeBlock: 'editor.editorTools.hints.codeBlock',
  btnInsertCard: 'editor.editorTools.hints.insertCard'
};

function fallbackElementById(documentRef, id) {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

export function createEditorMainToolbarSession(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const translateImpl = typeof options.translate === 'function' ? options.translate : fallbackTranslate;
  const getEditorTextarea = typeof options.getEditorTextarea === 'function' ? options.getEditorTextarea : () => null;
  const getCardEntries = typeof options.getCardEntries === 'function' ? options.getCardEntries : null;
  const getElementById = (id) => (
    typeof runtime.getElementById === 'function'
      ? runtime.getElementById(id)
      : fallbackElementById(documentRef, id)
  );
  const createInputEvent = typeof options.createInputEvent === 'function'
    ? options.createInputEvent
    : () => {
      if (typeof runtime.createEvent === 'function') {
        return runtime.createEvent('input', { bubbles: true, cancelable: true });
      }
      return null;
    };
  const textActions = createEditorMainToolbarTextActions({
    getEditorTextarea,
    createInputEvent
  });

  const editorToolbarEl = options.editorToolbarEl || getElementById('editorToolbar');
  const cardButton = options.cardButton || getElementById('btnInsertCard');
  const cardPopover = options.cardPopover || getElementById('editorCardPicker');
  const cardSearchInput = options.cardSearchInput || getElementById('cardPickerSearch');
  const cardListEl = options.cardListEl || getElementById('cardPickerList');
  const cardEmptyEl = options.cardEmptyEl || getElementById('cardPickerEmpty');

  let cardEntries = Array.isArray(options.cardEntries) ? options.cardEntries : [];
  let formattingButtons = [];
  let cardInsertionAllowed = false;
  let bound = false;

  const tooltipButtons = new Set();

  const translate = (key, params) => {
    try {
      return translateImpl(key, params);
    } catch (_) {
      return key;
    }
  };

  const readCardEntries = () => {
    if (getCardEntries) {
      const entries = getCardEntries();
      return Array.isArray(entries) ? entries : [];
    }
    return Array.isArray(cardEntries) ? cardEntries : [];
  };

  const cardPicker = createEditorMainToolbarCardPicker({
    runtime,
    documentRef,
    editorToolbarEl,
    cardButton,
    cardPopover,
    cardSearchInput,
    cardListEl,
    cardEmptyEl,
    getEntries: readCardEntries,
    canOpen: () => cardInsertionAllowed,
    onSelectEntry: (entry) => runTextAction(() => textActions.insertCardLink(entry)),
    onEscapeClose: () => textActions.restoreSelection()
  });

  function applyButtonTooltipState(button, disabled) {
    if (!button) return;
    const baseTitle = (() => {
      const titleKey = button.dataset.enabledTitleKey || button.getAttribute('data-i18n-title');
      if (titleKey) {
        const translated = translate(titleKey);
        if (translated != null) {
          button.dataset.enabledTitle = translated;
          return translated;
        }
      }
      if (!button.dataset.enabledTitle) {
        const current = button.getAttribute('title') || button.textContent || '';
        if (current) button.dataset.enabledTitle = current;
        else button.dataset.enabledTitle = '';
      }
      return button.dataset.enabledTitle || '';
    })();
    const hintKey = button.dataset.disabledHintKey;
    const disabledHint = (() => {
      if (hintKey) {
        const translatedHint = translate(hintKey);
        if (translatedHint != null) {
          button.dataset.disabledHint = translatedHint;
          return translatedHint;
        }
        button.dataset.disabledHint = '';
        return '';
      }
      return button.dataset.disabledHint || '';
    })();
    if (disabled) {
      if (disabledHint) button.setAttribute('title', disabledHint);
      else if (baseTitle) button.setAttribute('title', baseTitle);
      button.setAttribute('data-disabled', 'true');
    } else {
      if (baseTitle) button.setAttribute('title', baseTitle);
      else button.removeAttribute('title');
      button.removeAttribute('data-disabled');
    }
  }

  function registerButtonTooltip(button, disabledHintKey) {
    if (!button) return;
    if (disabledHintKey) button.dataset.disabledHintKey = disabledHintKey;
    const titleKey = button.getAttribute('data-i18n-title');
    if (titleKey) button.dataset.enabledTitleKey = titleKey;
    tooltipButtons.add(button);
    applyButtonTooltipState(button, !!button.disabled);
  }

  const updateFormattingToolbarState = () => {
    const textarea = getEditorTextarea();
    const selection = textActions.getLastSelection();
    const caretOnEmptyLine = textActions.isCaretOnEmptyLine(textarea, selection);
    const hasSelection = selection.end > selection.start;
    formattingButtons.forEach(btn => {
      if (!btn || !btn.el) return;
      let enabled = false;
      if (typeof btn.isEnabled === 'function') {
        enabled = !!btn.isEnabled(selection, textarea);
      } else {
        const requiresSelection = btn.requiresSelection !== false;
        enabled = requiresSelection ? hasSelection : true;
      }
      btn.el.disabled = !enabled;
      applyButtonTooltipState(btn.el, !!btn.el.disabled);
    });
    if (cardButton) {
      const hasEntries = cardPicker.hasEntries();
      const allowCardInsertion = hasEntries && caretOnEmptyLine;
      cardInsertionAllowed = allowCardInsertion;
      cardButton.disabled = !allowCardInsertion;
      if (allowCardInsertion) cardButton.removeAttribute('aria-disabled');
      else cardButton.setAttribute('aria-disabled', 'true');
      applyButtonTooltipState(cardButton, !!cardButton.disabled);
    }
  };

  const recordSelection = () => {
    if (!textActions.recordSelection()) return false;
    updateFormattingToolbarState();
    return true;
  };

  const runTextAction = (action) => {
    const changed = typeof action === 'function' ? action() : false;
    if (changed) updateFormattingToolbarState();
    return changed;
  };

  const handleCardContextUpdate = () => {
    updateFormattingToolbarState();
    cardPicker.update();
  };

  const selectionOrEmptyLineEnabled = (selection, textarea) => {
    if (!selection) return false;
    if (selection.end > selection.start) return true;
    return textActions.isCaretOnEmptyLine(textarea, selection);
  };

  const formattingActions = [
    { id: 'btnFmtBold', handler: () => textActions.applyInlineFormat('**', '**') },
    { id: 'btnFmtItalic', handler: () => textActions.applyInlineFormat('*', '*') },
    { id: 'btnFmtStrike', handler: () => textActions.applyInlineFormat('~~', '~~') },
    { id: 'btnFmtHeading', handler: () => textActions.toggleLinePrefix('# '), isEnabled: selectionOrEmptyLineEnabled },
    { id: 'btnFmtQuote', handler: () => textActions.toggleLinePrefix('> '), isEnabled: selectionOrEmptyLineEnabled },
    { id: 'btnFmtCode', handler: () => textActions.applyInlineFormat('`', '`') },
    { id: 'btnFmtCodeBlock', handler: () => textActions.applyCodeBlockFormat(), isEnabled: selectionOrEmptyLineEnabled }
  ];

  const bindFormattingButtons = () => {
    formattingButtons = formattingActions.map(action => {
      const el = getElementById(action.id);
      if (!el) return null;
      registerButtonTooltip(el, BUTTON_DISABLED_HINT_KEYS[action.id]);
      el.addEventListener('click', (event) => {
        event.preventDefault();
        runTextAction(action.handler);
      });
      const requiresSelection = action.requiresSelection !== undefined ? action.requiresSelection : true;
      return { ...action, el, requiresSelection };
    }).filter(Boolean);
  };

  const bindSelectionTracking = () => {
    const selectionTarget = getEditorTextarea();
    if (selectionTarget) {
      ['select', 'keyup', 'mouseup', 'input'].forEach(evt => {
        selectionTarget.addEventListener(evt, recordSelection);
      });
      selectionTarget.addEventListener('focus', recordSelection);
    }
    recordSelection();
  };

  const bindCardPicker = () => {
    if (cardButton) {
      registerButtonTooltip(cardButton, BUTTON_DISABLED_HINT_KEYS.btnInsertCard);
    }
    cardPicker.bind();
  };

  const syncLanguage = () => {
    tooltipButtons.forEach(btn => applyButtonTooltipState(btn, !!btn.disabled));
  };

  const setCardEntries = (entries) => {
    cardEntries = Array.isArray(entries) ? entries : [];
    cardPicker.setEntries(cardEntries);
    handleCardContextUpdate();
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    bindCardPicker();
    bindFormattingButtons();
    bindSelectionTracking();
    handleCardContextUpdate();
  };

  return {
    bind,
    syncLanguage,
    setCardEntries,
    updateState: handleCardContextUpdate,
    recordSelection,
    restoreSelection: textActions.restoreSelection
  };
}
