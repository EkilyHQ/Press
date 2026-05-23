function noop() {}

function appendIf(parent, node) {
  if (parent && node) parent.appendChild(node);
  return node;
}

export function createEditorBlocksHeadSession({
  documentRef = typeof document !== 'undefined' ? document : null,
  text = (_key, fallback) => fallback,
  createBlockTypeIcon = () => null,
  menuSession = null,
  sourceSession = null,
  listSession = null,
  codeSession = null,
  imageSession = null,
  tableSession = null,
  inlineToolbarSession = null,
  createHeadingLevelSelect = () => null,
  createMathEditButton = () => null,
  forwardBlockHeadWheel = noop,
  alignBlockActionMenu = noop,
  setActive = noop,
  moveBlock = noop,
  insertBlankBlock = noop,
  deleteBlockAt = noop
} = {}) {
  if (!documentRef) return null;

  const createTypeBadge = (block) => {
    const type = documentRef.createElement('span');
    type.className = 'blocks-block-type';
    const typeLabel = text(block.type === 'card' ? 'articleCard' : block.type, block.type);
    type.title = typeLabel;
    type.setAttribute('role', 'img');
    type.setAttribute('aria-label', typeLabel);
    appendIf(type, createBlockTypeIcon(block.type));
    return type;
  };

  const appendSourceControls = (head, block, index) => {
    appendIf(head, sourceSession?.createReasonHelp?.(block, index));
    if (sourceSession?.canAutofix?.(block)) {
      appendIf(head, sourceSession.createAutofixButton?.(block, index));
    }
  };

  const appendListControls = (head, block, index) => {
    appendIf(head, listSession?.createTypeSelect?.(block, index));
    appendIf(head, listSession?.createIndentControls?.(block, index));
  };

  const appendTypeControls = (head, block, index) => {
    if (block.type === 'source') appendSourceControls(head, block, index);
    if (block.type === 'heading') appendIf(head, createHeadingLevelSelect(block));
    if (block.type === 'list') appendListControls(head, block, index);
    if (block.type === 'code') appendIf(head, codeSession?.createLanguageInput?.(block));
    if (block.type === 'math') appendIf(head, createMathEditButton(block, index));
    if (block.type === 'image') appendIf(head, imageSession?.createMetadataControls?.(block, index));
    if (block.type === 'table') appendIf(head, tableSession?.createControls?.(block, index));
    if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'list') {
      appendIf(head, inlineToolbarSession?.createControls?.(index));
    }
  };

  const createActionControls = (index, blockCount) => {
    return menuSession?.createActionControls?.({
      index,
      blockCount,
      setActive,
      moveBlock,
      insertBlankBlock,
      deleteBlockAt,
      onReposition: (menu, trigger) => alignBlockActionMenu(menu, trigger)
    }) || null;
  };

  const createBlockHead = ({
    block = null,
    index = 0,
    blockCount = 0
  } = {}) => {
    if (!block) return null;
    const head = documentRef.createElement('div');
    head.className = 'blocks-block-head';
    appendIf(head, createTypeBadge(block));
    head.addEventListener('wheel', forwardBlockHeadWheel, { passive: false });
    appendTypeControls(head, block, index);
    appendIf(head, createActionControls(index, blockCount));
    return head;
  };

  return {
    createBlockHead
  };
}
