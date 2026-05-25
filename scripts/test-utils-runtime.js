import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createDocumentTitleController,
  setBaseSiteTitle,
  setDocTitle
} from '../assets/js/utils.js';

const source = readFileSync(new URL('../assets/js/utils.js', import.meta.url), 'utf8');

assert.doesNotMatch(
  source,
  /^let\s+baseSiteTitle\b/m,
  'utils should not keep document title base state as a module-level mutable variable'
);
assert.match(
  source,
  /const BASE_SITE_TITLE = Symbol\('pressBaseSiteTitle'\)[\s\S]*export function createDocumentTitleController\(options = \{\}\)[\s\S]*setBaseSiteTitle\(title, options = \{\}\)[\s\S]*setDocTitle\(title, options = \{\}\)/,
  'utils should expose document-ref-scoped title control'
);

const firstDocument = { title: 'First Site' };
const secondDocument = { title: 'Second Site' };

assert.equal(setDocTitle('Post', { documentRef: firstDocument }), true);
assert.equal(firstDocument.title, 'Post · First Site');
assert.equal(secondDocument.title, 'Second Site');

assert.equal(setBaseSiteTitle('Renamed Site', { documentRef: firstDocument }), true);
assert.equal(setDocTitle('', { documentRef: firstDocument }), true);
assert.equal(firstDocument.title, 'Renamed Site');
assert.equal(secondDocument.title, 'Second Site');

const secondController = createDocumentTitleController({ documentRef: secondDocument });
assert.equal(secondController.setDocTitle('Entry'), true);
assert.equal(secondDocument.title, 'Entry · Second Site');
assert.equal(secondController.setBaseSiteTitle('Second Runtime'), true);
assert.equal(secondController.setDocTitle(''), true);
assert.equal(secondDocument.title, 'Second Runtime');

assert.equal(setDocTitle('No document', { documentRef: null }), false);

console.log('ok - document title state is scoped to document refs');
