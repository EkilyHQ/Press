import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function readIdentitySource(relativePath) {
  return readFileSync(resolve(here, relativePath), 'utf8');
}

function extractFunctionBody(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const open = text.indexOf('{', start);
  assert.notEqual(open, -1, `${name} should have a body`);
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, index);
    }
  }
  assert.fail(`${name} body should be balanced`);
}

function createMemoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value));
    },
    removeItem: (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data.entries())
  };
}

export { createMemoryStorage, extractFunctionBody, readIdentitySource };
