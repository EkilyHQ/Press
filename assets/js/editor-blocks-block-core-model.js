// DOM-free block type and block object helpers for the blocks editor.

export const BLOCK_TYPES = new Set(['paragraph', 'heading', 'image', 'list', 'quote', 'code', 'math', 'card', 'table', 'source', 'blank']);

export function normalizeText(value) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function makeBlock(type, raw, data = {}) {
  const safeType = BLOCK_TYPES.has(type) ? type : 'source';
  const id = data.id || `block-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    type: safeType,
    raw: String(raw == null ? '' : raw),
    dirty: !!data.dirty,
    data: { ...data, id: undefined }
  };
}

export function splitBlankLineUnits(value) {
  const text = String(value || '');
  if (!text) return [];
  const units = text.match(/[^\n]*\n/g) || [];
  return units.join('') === text ? units : [];
}

export function makeBlankBlock(after = '\n', data = {}) {
  const block = makeBlock('blank', '', { ...data, after: after || '\n' });
  block.dirty = !!data.dirty;
  return block;
}

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[ch]);
}
