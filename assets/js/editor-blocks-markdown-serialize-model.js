// DOM-free Markdown block serialization helpers for the blocks editor.

import {
  serializeList
} from './editor-blocks-list-model.js';
import {
  serializeTable
} from './editor-blocks-table-model.js';

function serializeImage(data = {}) {
  const alt = String(data.alt || '');
  const src = String(data.src || '').trim();
  const title = String(data.title || '').trim();
  return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
}

function serializeCard(data = {}) {
  const label = String(data.label || data.location || 'Article').trim() || 'Article';
  const location = encodeURIComponent(String(data.location || '').trim()).replace(/%2F/g, '/');
  const title = data.forceCard || data.title ? ` "${String(data.title || 'card').trim() || 'card'}"` : '';
  return `[${label}](?id=${location || 'post/example.md'}${title})`;
}

function codeFenceForText(text) {
  const runs = String(text || '').match(/`+/g) || [];
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0);
  return '`'.repeat(Math.max(3, longest + 1));
}

function serializeBlock(block) {
  if (!block || typeof block !== 'object') return '';
  if (!block.dirty && typeof block.raw === 'string') return block.raw;
  const data = block.data || {};
  switch (block.type) {
    case 'blank':
      return '';
    case 'heading': {
      const level = Math.max(1, Math.min(6, Number(data.level) || 2));
      return `${'#'.repeat(level)} ${String(data.text || '').trim()}`;
    }
    case 'image':
      return serializeImage(data);
    case 'list':
      return serializeList(data);
    case 'quote':
      return String(data.text || '').split('\n').map(line => `> ${line}`).join('\n');
    case 'code': {
      const lang = String(data.lang || '').trim();
      const text = String(data.text || '');
      const fence = codeFenceForText(text);
      return `${fence}${lang}\n${text}\n${fence}`;
    }
    case 'math':
      return `$$\n${String(data.tex || '')}\n$$`;
    case 'card':
      return serializeCard(data);
    case 'table':
      return serializeTable(data);
    case 'source':
      return String(data.text != null ? data.text : block.raw || '');
    case 'paragraph':
    default:
      return String(data.text || '');
  }
}

export function serializeMarkdownBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map(block => {
    const before = block && block.data && block.data.before ? String(block.data.before) : '';
    const defaultAfter = block && block.type === 'blank' ? '\n' : '\n\n';
    const after = block && block.data && block.data.after != null ? String(block.data.after) : defaultAfter;
    return `${before}${serializeBlock(block)}${after}`;
  }).join('');
}
