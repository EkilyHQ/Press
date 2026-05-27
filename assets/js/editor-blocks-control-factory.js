function noop() {}

function createButton(label, className = 'blocks-btn', runtime = null) {
  const el = runtime && typeof runtime.createElement === 'function'
    ? runtime.createElement('button')
    : null;
  if (!el) return null;
  el.type = 'button';
  el.className = className;
  el.textContent = label;
  return el;
}

// Icons are inline Lucide SVG paths (https://lucide.dev, ISC License).
const BLOCK_TYPE_ICON_PATHS = {
  paragraph: '<path d="M13 4v16" /><path d="M17 4v16" /><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13" />',
  heading: '<path d="M4 12h8" /><path d="M4 18V6" /><path d="M12 18V6" /><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
  list: '<path d="M3 5h.01" /><path d="M3 12h.01" /><path d="M3 19h.01" /><path d="M8 5h13" /><path d="M8 12h13" /><path d="M8 19h13" />',
  quote: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" /><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />',
  code: '<path d="m18 16 4-4-4-4" /><path d="m6 8-4 4 4 4" /><path d="m14.5 4-5 16" />',
  math: '<path d="M4 19h16" /><path d="M8 5h8" /><path d="M9 5c4 4 4 10 0 14" /><path d="M15 5c-4 4-4 10 0 14" />',
  table: '<path d="M3 5h18" /><path d="M3 12h18" /><path d="M3 19h18" /><path d="M5 5v14" /><path d="M12 5v14" /><path d="M19 5v14" />',
  source: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" /><path d="M14 2v5a1 1 0 0 0 1 1h5" /><path d="M10 12.5 8 15l2 2.5" /><path d="m14 12.5 2 2.5-2 2.5" />',
  card: '<path d="M15 18h-5" /><path d="M18 14h-8" /><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" /><rect width="8" height="4" x="10" y="6" rx="1" />',
  blank: '<path d="M5 6h14" /><path d="M5 18h14" /><path d="M12 10v4" /><path d="M10 12h4" />'
};

export function createEditorBlocksControlFactory({
  runtime = null,
  text = (_key, fallback) => fallback,
  updateFromControl = noop,
  blockElements = () => [],
  setActive = noop,
  openMathEditorForBlock = noop
} = {}) {
  const createBlockTypeIcon = (blockType) => {
    const svg = runtime && typeof runtime.createElementNS === 'function'
      ? runtime.createElementNS('http://www.w3.org/2000/svg', 'svg')
      : null;
    if (!svg) return null;
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = BLOCK_TYPE_ICON_PATHS[blockType] || BLOCK_TYPE_ICON_PATHS.paragraph;
    return svg;
  };

  const createHeadingLevelSelect = (block) => {
    const select = runtime && typeof runtime.createElement === 'function'
      ? runtime.createElement('select')
      : null;
    if (!select) return null;
    select.className = 'blocks-heading-level';
    select.title = text('headingLevel', 'Heading level');
    [1, 2, 3, 4, 5, 6].forEach(level => {
      const option = runtime.createElement('option');
      if (!option) return;
      option.value = String(level);
      option.textContent = `H${level}`;
      select.appendChild(option);
    });
    select.value = String(block?.data?.level || 2);
    select.addEventListener('change', () => updateFromControl(block, { level: Number(select.value) || 2 }, true));
    return select;
  };

  const createMathEditButton = (block, index) => {
    const edit = createButton(text('editMath', 'Edit math'), 'blocks-btn blocks-math-edit', runtime);
    if (!edit) return null;
    edit.title = text('editMath', 'Edit math');
    edit.setAttribute('aria-label', text('editMath', 'Edit math'));
    edit.addEventListener('mousedown', (event) => event.preventDefault());
    edit.addEventListener('click', () => {
      setActive(index);
      const blockEl = blockElements()[index] || null;
      openMathEditorForBlock(block, blockEl);
    });
    return edit;
  };

  const autoSizeTextarea = (area) => {
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${area.scrollHeight}px`;
  };

  return {
    autoSizeTextarea,
    createBlockTypeIcon,
    createHeadingLevelSelect,
    createMathEditButton
  };
}
