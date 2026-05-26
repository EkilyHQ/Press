const noop = () => {};

export function createComposerSiteSettingsLinkList(options = {}) {
  const documentRef = options.documentRef || null;
  const createField = typeof options.createField === 'function' ? options.createField : null;
  const createSubheadingField = typeof options.createSubheadingField === 'function' ? options.createSubheadingField : null;
  const ensureLinkList = typeof options.ensureLinkList === 'function' ? options.ensureLinkList : () => [];
  const markDirty = typeof options.markDirty === 'function' ? options.markDirty : noop;
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : noop;
  const requestFrame = typeof options.requestFrame === 'function'
    ? options.requestFrame
    : (handler) => {
      if (typeof handler === 'function') handler();
      return null;
    };
  const t = typeof options.t === 'function' ? options.t : (key) => key;

  const createLinkListField = (section, key, config = {}) => {
    if (!documentRef || !createField || !createSubheadingField) return null;
    const list = ensureLinkList(key);
    const field = config.subheading
      ? createSubheadingField(section, {
        dataKey: key,
        label: config.label,
        description: config.description
      })
      : createField(section, {
        dataKey: key,
        label: config.label,
        description: config.description
      });
    const listWrap = documentRef.createElement('div');
    listWrap.className = 'cs-link-list';
    field.appendChild(listWrap);
    const controls = documentRef.createElement('div');
    controls.className = 'cs-field-controls';
    field.appendChild(controls);
    const addBtn = documentRef.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-secondary cs-add-link';
    addBtn.textContent = t('editor.composer.site.addLink');
    controls.appendChild(addBtn);

    const renderRowsAndRefreshDiff = () => {
      renderRows();
      try { notifyComposerChange('site', { skipAutoSave: true }); } catch (_) {}
    };

    const moveEntry = (from, to, options = {}) => {
      if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      markDirty();
      if (options.refreshDiff) renderRowsAndRefreshDiff();
      else renderRows();
      return true;
    };

    let linkDragState = null;

    const getAnimatedLinkRows = () => Array.from(listWrap.querySelectorAll('.cs-link-row:not(.is-dragging)'));

    const animateLinkRows = (callback) => {
      const previousRects = new Map();
      getAnimatedLinkRows().forEach((row) => {
        previousRects.set(row, row.getBoundingClientRect());
      });

      callback();

      getAnimatedLinkRows().forEach((row) => {
        const previous = previousRects.get(row);
        if (!previous) return;
        const next = row.getBoundingClientRect();
        const deltaY = previous.top - next.top;
        if (!deltaY) return;
        row.style.transition = 'none';
        row.style.transform = `translate3d(0, ${previous.top - next.top}px, 0)`;
        requestFrame(() => {
          row.style.transition = 'transform .18s cubic-bezier(.2,.8,.2,1)';
          row.style.transform = '';
        });
      });
    };

    const createDragPlaceholder = (row) => {
      const rowRect = row.getBoundingClientRect();
      const placeholder = documentRef.createElement('div');
      placeholder.className = 'cs-link-drop-placeholder';
      placeholder.style.height = `${rowRect.height}px`;
      return placeholder;
    };

    const getDropIndex = () => {
      if (!linkDragState || !linkDragState.placeholder) return -1;
      const rows = Array.from(listWrap.children)
        .filter((node) => node === linkDragState.placeholder || (node !== linkDragState.dragRow && node.classList?.contains('cs-link-row')));
      return rows.indexOf(linkDragState.placeholder);
    };

    const moveListEntry = (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return false;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      markDirty();
      return true;
    };

    const applyDragPreview = (clientY) => {
      if (!linkDragState) return;
      linkDragState.dragRow.style.transform = `translate3d(0, ${clientY - linkDragState.startY}px, 0)`;
      const rows = getAnimatedLinkRows();
      let nextNode = null;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (clientY < midpoint) {
          nextNode = row;
          break;
        }
      }
      if (nextNode === linkDragState.placeholder.nextSibling) return;
      animateLinkRows(() => {
        listWrap.insertBefore(linkDragState.placeholder, nextNode);
      });
    };

    const updateDragRowState = () => {
      listWrap.querySelectorAll('.cs-link-row').forEach((row) => {
        row.classList.toggle('is-dragging', !!linkDragState && row === linkDragState.dragRow);
      });
    };

    const handleDragPointerMove = (event) => {
      if (!linkDragState) return;
      event.preventDefault();
      applyDragPreview(event.clientY);
    };

    const endDrag = () => {
      documentRef.removeEventListener('pointermove', handleDragPointerMove, true);
      documentRef.removeEventListener('pointerup', endDrag, true);
      documentRef.removeEventListener('pointercancel', endDrag, true);
      if (linkDragState) {
        const { fromIndex, dragRow, placeholder } = linkDragState;
        const toIndex = getDropIndex();
        dragRow.classList.remove('is-dragging');
        dragRow.style.position = '';
        dragRow.style.left = '';
        dragRow.style.top = '';
        dragRow.style.width = '';
        dragRow.style.zIndex = '';
        dragRow.style.transform = '';
        if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        moveListEntry(fromIndex, toIndex);
        renderRowsAndRefreshDiff();
      }
      linkDragState = null;
      updateDragRowState();
    };

    const createDragHandle = (index) => {
      const handle = documentRef.createElement('span');
      handle.setAttribute('role', 'button');
      handle.tabIndex = 0;
      handle.className = 'cs-link-drag-handle';
      handle.setAttribute('aria-label', t('editor.composer.site.reorderLink'));
      handle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
      handle.addEventListener('pointerdown', (event) => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        const row = handle.closest('.cs-link-row');
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const placeholder = createDragPlaceholder(row);
        listWrap.insertBefore(placeholder, row);
        linkDragState = {
          fromIndex: index,
          dragRow: row,
          placeholder,
          startY: event.clientY
        };
        row.classList.add('is-dragging');
        row.style.position = 'fixed';
        row.style.left = `${rowRect.left}px`;
        row.style.top = `${rowRect.top}px`;
        row.style.width = `${rowRect.width}px`;
        row.style.zIndex = '1000';
        row.style.transform = 'translate3d(0, 0, 0)';
        updateDragRowState();
        documentRef.addEventListener('pointermove', handleDragPointerMove, true);
        documentRef.addEventListener('pointerup', endDrag, true);
        documentRef.addEventListener('pointercancel', endDrag, true);
      });
      handle.addEventListener('keydown', (event) => {
        if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        moveEntry(index, event.key === 'ArrowUp' ? index - 1 : index + 1, { refreshDiff: true });
      });
      return handle;
    };

    function renderRows() {
      listWrap.innerHTML = '';
      if (!list.length) {
        const empty = documentRef.createElement('div');
        empty.className = 'cs-empty';
        empty.textContent = t('editor.composer.site.noLinks');
        listWrap.appendChild(empty);
        return;
      }
      const labelTitleId = `${key}-label-title`;
      const hrefTitleId = `${key}-href-title`;
      const appendLinkHeader = () => {
        const head = documentRef.createElement('div');
        head.className = 'cs-link-head';
        const handleSpacer = documentRef.createElement('span');
        handleSpacer.className = 'cs-link-head-spacer';
        handleSpacer.setAttribute('aria-hidden', 'true');
        const labelTitle = documentRef.createElement('span');
        labelTitle.id = labelTitleId;
        labelTitle.className = 'cs-link-field-title cs-link-field-title--label';
        labelTitle.textContent = t('editor.composer.site.linkLabelTitle');
        const hrefTitle = documentRef.createElement('span');
        hrefTitle.id = hrefTitleId;
        hrefTitle.className = 'cs-link-field-title cs-link-field-title--href';
        hrefTitle.textContent = t('editor.composer.site.linkHrefTitle');
        const actionSpacer = documentRef.createElement('span');
        actionSpacer.className = 'cs-link-head-actions';
        actionSpacer.setAttribute('aria-hidden', 'true');
        head.append(handleSpacer, labelTitle, hrefTitle, actionSpacer);
        listWrap.appendChild(head);
      };
      appendLinkHeader();
      list.forEach((item, index) => {
        const row = documentRef.createElement('div');
        row.className = 'cs-link-row';
        row.dataset.index = String(index);

        const dragHandle = createDragHandle(index);

        const labelField = documentRef.createElement('div');
        labelField.className = 'cs-link-field cs-link-field--label';
        if (index > 0) {
          labelField.classList.add('cs-link-field--compact');
        }
        const labelInputId = `${key}-label-${index}`;
        const labelInput = documentRef.createElement('input');
        labelInput.type = 'text';
        labelInput.id = labelInputId;
        labelInput.className = 'cs-input';
        labelInput.dataset.field = key;
        labelInput.dataset.index = String(index);
        labelInput.dataset.subfield = 'label';
        labelInput.placeholder = t('editor.composer.site.linkLabelPlaceholder');
        labelInput.setAttribute('aria-labelledby', labelTitleId);
        labelInput.value = item && item.label ? item.label : '';
        labelInput.addEventListener('input', () => {
          list[index].label = labelInput.value;
          markDirty();
        });
        labelField.append(labelInput);

        const hrefField = documentRef.createElement('div');
        hrefField.className = 'cs-link-field cs-link-field--href';
        if (index > 0) {
          hrefField.classList.add('cs-link-field--compact');
        }
        const hrefInputId = `${key}-href-${index}`;
        const hrefInput = documentRef.createElement('input');
        hrefInput.type = 'text';
        hrefInput.id = hrefInputId;
        hrefInput.className = 'cs-input';
        hrefInput.dataset.field = key;
        hrefInput.dataset.index = String(index);
        hrefInput.dataset.subfield = 'href';
        hrefInput.placeholder = t('editor.composer.site.linkHrefPlaceholder');
        hrefInput.setAttribute('aria-labelledby', hrefTitleId);
        hrefInput.value = item && item.href ? item.href : '';
        hrefInput.addEventListener('input', () => {
          list[index].href = hrefInput.value;
          markDirty();
        });
        hrefField.append(hrefInput);
        const actions = documentRef.createElement('div');
        actions.className = 'cs-link-actions';
        const removeBtn = documentRef.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-tertiary cs-remove-link';
        removeBtn.textContent = t('editor.composer.site.removeLink');
        removeBtn.addEventListener('click', () => {
          list.splice(index, 1);
          markDirty();
          renderRowsAndRefreshDiff();
        });
        actions.append(removeBtn);
        row.append(dragHandle, labelField, hrefField, actions);
        listWrap.appendChild(row);
      });
    }

    addBtn.addEventListener('click', () => {
      list.push({ label: '', href: '' });
      markDirty();
      renderRowsAndRefreshDiff();
    });

    renderRows();
    return field;
  };

  return { createLinkListField };
}
