function noop() {}

function safeArray(value) {
  try { return Array.from(value || []); }
  catch (_) { return []; }
}

function createButton(documentRef, label, className) {
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = className || '';
  button.textContent = label || '';
  return button;
}

function entryLabel(entry, fallback) {
  return String((entry && (entry.title || entry.key || entry.location)) || fallback || 'Article');
}

function entrySearchText(entry) {
  if (!entry) return '';
  return String(entry.search || `${entry.title || ''} ${entry.key || ''} ${entry.location || ''}`).toLowerCase();
}

function cardDataForEntry(entry, fallback) {
  return {
    label: entryLabel(entry, fallback),
    location: String((entry && entry.location) || ''),
    title: 'card',
    forceCard: true
  };
}

export function createEditorBlocksCardPickerSession({
  documentRef = null,
  runtime = null,
  blocksState = null,
  text = (_key, fallback) => fallback,
  insertCardBlock = noop,
  requestRender = noop
} = {}) {
  if (!documentRef || !blocksState) return null;

  const element = documentRef.createElement('div');
  element.className = 'blocks-card-picker';
  element.hidden = true;
  element.setAttribute('aria-hidden', 'true');

  const pickerState = () => {
    if (typeof blocksState.getCardPickerState === 'function') return blocksState.getCardPickerState();
    const state = blocksState.state || {};
    return {
      open: !!state.cardPickerOpen,
      insertIndex: state.cardPickerInsertIndex,
      entries: safeArray(state.cardEntries),
      blockCount: safeArray(state.blocks).length
    };
  };

  const hide = () => {
    element.innerHTML = '';
    element.hidden = true;
    element.setAttribute('aria-hidden', 'true');
  };

  const focusSearch = (search) => {
    const task = () => {
      try { search.focus(); } catch (_) {}
    };
    if (runtime && typeof runtime.setTimer === 'function') runtime.setTimer(task, 0);
    else {
      try { queueMicrotask(task); }
      catch (_) { Promise.resolve().then(task); }
    }
  };

  const chooseEntry = (entry) => {
    const state = pickerState();
    const insertIndex = Number.isInteger(state.insertIndex) ? state.insertIndex : state.blockCount;
    if (typeof blocksState.closeCardPicker === 'function') blocksState.closeCardPicker();
    insertCardBlock(cardDataForEntry(entry, text('articleCard', 'Article Card')), insertIndex);
  };

  const render = () => {
    element.innerHTML = '';
    const state = pickerState();
    if (!state.open) {
      hide();
      return;
    }

    element.hidden = false;
    element.setAttribute('aria-hidden', 'false');

    const search = documentRef.createElement('input');
    search.type = 'search';
    search.className = 'blocks-card-search';
    search.placeholder = text('cardSearch', 'Search articles...');

    const results = documentRef.createElement('div');
    results.className = 'blocks-card-results';

    const draw = () => {
      const query = String(search.value || '').trim().toLowerCase();
      results.innerHTML = '';
      const entries = safeArray(pickerState().entries).filter(entry => {
        if (!query) return true;
        return entrySearchText(entry).includes(query);
      });
      if (!entries.length) {
        const empty = documentRef.createElement('div');
        empty.className = 'blocks-empty';
        empty.textContent = text('cardEmpty', 'No matching articles');
        results.appendChild(empty);
        return;
      }
      entries.slice(0, 30).forEach((entry) => {
        const item = createButton(
          documentRef,
          entryLabel(entry, text('articleCard', 'Article Card')),
          'blocks-card-result'
        );
        item.addEventListener('click', () => chooseEntry(entry));
        const meta = documentRef.createElement('span');
        meta.textContent = String((entry && entry.location) || '');
        item.appendChild(meta);
        results.appendChild(item);
      });
    };

    search.addEventListener('input', draw);
    element.append(search, results);
    draw();
    focusSearch(search);
  };

  const open = (insertIndex) => {
    const state = pickerState();
    const safeIndex = Number.isInteger(Number(insertIndex)) ? Number(insertIndex) : state.blockCount;
    if (!safeArray(state.entries).length) {
      insertCardBlock({
        label: 'Article',
        location: '',
        title: 'card',
        forceCard: true
      }, safeIndex);
      return false;
    }
    if (typeof blocksState.openCardPicker === 'function') blocksState.openCardPicker(safeIndex);
    requestRender();
    return true;
  };

  const setEntries = (entries) => {
    if (typeof blocksState.setCardEntries === 'function') blocksState.setCardEntries(entries);
    else if (blocksState.state) blocksState.state.cardEntries = safeArray(entries);
    if (pickerState().open) render();
  };

  return {
    element,
    open,
    render,
    setEntries
  };
}
