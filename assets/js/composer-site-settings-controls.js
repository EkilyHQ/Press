const noop = () => {};

const resolveDocument = (documentRef) => {
  if (!documentRef || typeof documentRef.createElement !== 'function') {
    throw new Error('composer Site Settings controls require a documentRef');
  }
  return documentRef;
};

export function syncSiteSettingsSwitchState(checkbox, toggle, value, allowMixed = false) {
  if (!checkbox || !toggle) return;
  if (allowMixed && (value === null || value === undefined)) {
    checkbox.indeterminate = true;
    checkbox.checked = false;
    checkbox.setAttribute('aria-checked', 'mixed');
    toggle.dataset.state = 'mixed';
    return;
  }
  checkbox.indeterminate = false;
  const isOn = allowMixed ? value === true : !!value;
  checkbox.checked = isOn;
  checkbox.setAttribute('aria-checked', isOn ? 'true' : 'false');
  toggle.dataset.state = isOn ? 'on' : 'off';
}

export function createComposerSiteSettingsControls(options = {}) {
  const documentRef = resolveDocument(options.documentRef || null);
  const viewport = options.viewport || null;
  const sectionsMeta = Array.isArray(options.sectionsMeta) ? options.sectionsMeta : [];
  const getActiveSectionId = typeof options.getActiveSectionId === 'function'
    ? options.getActiveSectionId
    : () => '';
  const getPreservedActiveLabel = typeof options.getPreservedActiveLabel === 'function'
    ? options.getPreservedActiveLabel
    : () => '';
  const setActiveSection = typeof options.setActiveSection === 'function' ? options.setActiveSection : noop;
  const onDirty = typeof options.onDirty === 'function' ? options.onDirty : noop;
  const requestFrame = typeof options.requestFrame === 'function'
    ? options.requestFrame
    : (handler) => {
      if (typeof handler === 'function') handler();
      return null;
    };

  const createSection = (title, description) => {
    const section = documentRef.createElement('section');
    section.className = 'cs-section';
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-hidden', 'false');
    const sectionId = `cs-section-${sectionsMeta.length + 1}`;
    section.id = sectionId;
    if (title || description) {
      const head = documentRef.createElement('div');
      head.className = 'cs-section-head';
      if (title) {
        const heading = documentRef.createElement('h3');
        heading.className = 'cs-section-title';
        heading.textContent = title;
        head.appendChild(heading);
      }
      if (description) {
        const desc = documentRef.createElement('p');
        desc.className = 'cs-section-description';
        desc.textContent = description;
        head.appendChild(desc);
      }
      section.appendChild(head);
    }
    if (viewport && typeof viewport.appendChild === 'function') viewport.appendChild(section);

    const labelText = (() => {
      if (title && String(title).trim()) return String(title).trim();
      const fromHeading = section.querySelector('.cs-section-title');
      return fromHeading && fromHeading.textContent ? fromHeading.textContent.trim() : `Section ${sectionsMeta.length + 1}`;
    })();

    const meta = { id: sectionId, section, label: labelText };
    sectionsMeta.push(meta);

    const preservedActiveLabel = getPreservedActiveLabel();
    const shouldRestore = preservedActiveLabel && labelText === preservedActiveLabel;
    if (!getActiveSectionId() || shouldRestore) {
      setActiveSection(sectionId, { scrollViewport: false });
    }

    return section;
  };

  const createField = (section, config = {}) => {
    const field = documentRef.createElement('div');
    field.className = 'cs-field';
    if (config.dataKey) field.dataset.field = config.dataKey;
    const head = documentRef.createElement('div');
    head.className = 'cs-field-head';
    const labelWrap = documentRef.createElement('div');
    labelWrap.className = 'cs-field-label-wrap';
    head.appendChild(labelWrap);
    const labelEl = documentRef.createElement('label');
    labelEl.className = 'cs-field-label';
    labelEl.textContent = config.label || '';
    labelWrap.appendChild(labelEl);
    if (config.action) {
      config.action.classList.add('cs-field-action');
      head.appendChild(config.action);
    }
    field.appendChild(head);
    field.__csHead = head;
    field.__csLabel = labelEl;
    field.__csLabelWrap = labelWrap;
    const inlineDescription = config.inlineDescription !== false;
    if (config.description) {
      const desc = documentRef.createElement('p');
      desc.className = 'cs-field-help';
      desc.textContent = config.description;
      field.__csHelp = desc;
      if (inlineDescription && labelWrap) {
        field.classList.add('cs-field-inline-help');
        labelWrap.appendChild(desc);
      } else {
        field.appendChild(desc);
      }
    }
    section.appendChild(field);
    return field;
  };

  const createSubheadingField = (section, config = {}) => {
    const field = documentRef.createElement('div');
    field.className = 'cs-field cs-subheading-field';
    if (config.dataKey) field.dataset.field = config.dataKey;
    if (config.label || config.description) {
      const head = documentRef.createElement('div');
      head.className = 'cs-config-subsection-head';
      if (config.label) {
        const title = documentRef.createElement('div');
        title.className = 'cs-config-subsection-title';
        title.textContent = config.label;
        head.appendChild(title);
      }
      if (config.description) {
        const description = documentRef.createElement('p');
        description.className = 'cs-config-subsection-description';
        description.textContent = config.description;
        head.appendChild(description);
      }
      field.appendChild(head);
    }
    section.appendChild(field);
    return field;
  };

  const createConfigSubsection = (section, title, description) => {
    const block = documentRef.createElement('div');
    block.className = 'cs-config-subsection';
    if (title || description) {
      const head = documentRef.createElement('div');
      head.className = 'cs-config-subsection-head';
      if (title) {
        const heading = documentRef.createElement('div');
        heading.className = 'cs-config-subsection-title';
        heading.textContent = title;
        head.appendChild(heading);
      }
      if (description) {
        const desc = documentRef.createElement('p');
        desc.className = 'cs-config-subsection-description';
        desc.textContent = description;
        head.appendChild(desc);
      }
      block.appendChild(head);
    }
    section.appendChild(block);
    return block;
  };

  const createSwitchControl = (field, labelText, methodOptions = {}) => {
    const controls = documentRef.createElement('div');
    controls.className = 'cs-field-controls cs-field-controls-inline';
    if (Array.isArray(methodOptions.classes)) controls.classList.add(...methodOptions.classes);
    const target = methodOptions.target || field;
    const toggle = documentRef.createElement('label');
    toggle.className = 'cs-switch';
    toggle.dataset.state = 'off';
    const checkbox = documentRef.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cs-switch-input';
    checkbox.setAttribute('role', 'switch');
    checkbox.setAttribute('aria-checked', 'false');
    const track = documentRef.createElement('span');
    track.className = 'cs-switch-track';
    const thumb = documentRef.createElement('span');
    thumb.className = 'cs-switch-thumb';
    track.appendChild(thumb);
    toggle.appendChild(checkbox);
    toggle.appendChild(track);
    const accessibleLabel = labelText || (field && field.__csLabel ? field.__csLabel.textContent : '');
    if (accessibleLabel) checkbox.setAttribute('aria-label', accessibleLabel);
    controls.appendChild(toggle);
    target.appendChild(controls);
    return { controls, toggle, checkbox };
  };

  const createSingleGridFieldset = (section) => {
    const field = documentRef.createElement('div');
    field.className = 'cs-field cs-single-grid-fieldset';
    const grid = documentRef.createElement('div');
    grid.className = 'cs-single-grid';
    field.appendChild(grid);
    section.appendChild(field);

    const addRow = (item, index = grid.children.length) => {
      const row = documentRef.createElement('div');
      row.className = 'cs-single-grid-row';
      row.dataset.field = item.dataKey;

      const controlId = `cs-single-grid-${item.dataKey}-${index}`;
      const tooltipId = `cs-single-grid-help-${item.dataKey}-${index}`;

      const labelCell = documentRef.createElement('div');
      labelCell.className = 'cs-single-grid-label';

      const tooltipWrap = documentRef.createElement('span');
      tooltipWrap.className = 'cs-help-tooltip-wrap';
      const tooltip = documentRef.createElement('button');
      tooltip.type = 'button';
      tooltip.className = 'cs-help-tooltip';
      tooltip.textContent = '?';
      tooltip.setAttribute('aria-label', `${item.label}: ${item.description}`);
      tooltip.setAttribute('aria-describedby', tooltipId);
      const tooltipBubble = documentRef.createElement('span');
      tooltipBubble.id = tooltipId;
      tooltipBubble.className = 'cs-help-tooltip-bubble';
      tooltipBubble.setAttribute('role', 'tooltip');
      tooltipBubble.textContent = item.description;
      const label = documentRef.createElement('label');
      label.className = 'cs-single-grid-title';
      label.htmlFor = controlId;
      label.textContent = item.label;
      labelCell.appendChild(label);
      tooltipWrap.appendChild(tooltip);
      tooltipWrap.appendChild(tooltipBubble);
      labelCell.appendChild(tooltipWrap);
      row.appendChild(labelCell);

      const controlCell = documentRef.createElement('div');
      controlCell.className = 'cs-single-grid-control';
      row.appendChild(controlCell);
      grid.appendChild(row);

      return { row, controlCell, controlId, label };
    };

    return { field, grid, addRow };
  };

  const renderSingleTextGrid = (section, items) => {
    const { addRow } = createSingleGridFieldset(section);
    (items || []).forEach((item, index) => {
      const { controlCell, controlId } = addRow(item, index);
      const input = documentRef.createElement('input');
      input.id = controlId;
      input.type = item.type || 'text';
      input.className = 'cs-input';
      input.dataset.field = item.dataKey;
      input.value = item.get() || '';
      input.placeholder = item.placeholder || '';
      input.addEventListener('input', () => {
        item.set(input.value);
        onDirty();
      });
      controlCell.appendChild(input);
    });
  };

  return {
    createConfigSubsection,
    createField,
    createSection,
    createSingleGridFieldset,
    createSubheadingField,
    createSwitchControl,
    renderSingleTextGrid,
    requestFrame,
    syncSwitchState: syncSiteSettingsSwitchState
  };
}
