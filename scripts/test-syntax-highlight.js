import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import hljs from '../assets/js/vendor/highlightjs/highlight.min.js';
import { highlightCode } from '../assets/js/syntax-highlight.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, '..', path), 'utf8');

const syntaxSource = read('assets/js/syntax-highlight.js');
const highlightBundle = read('assets/js/vendor/highlightjs/highlight.min.js');
const nativeCss = read('assets/themes/native/base.css');

function extractQuotedSet(source, declarationName) {
  const match = source.match(new RegExp(`const ${declarationName} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
  assert.ok(match, `missing ${declarationName}`);
  return new Set(Array.from(match[1].matchAll(/'([^']+)'/g), m => m[1]));
}

function classesForScope(scope) {
  const parts = String(scope || '').split('.').filter(Boolean);
  if (!parts.length) return [];
  const [base, ...modifiers] = parts;
  return [`hljs-${base}`, ...modifiers.map((part, index) => `${part}${'_'.repeat(index + 1)}`)];
}

function extractBundleClasses(source) {
  const scopes = new Set();
  for (const pattern of [/className:"([A-Za-z0-9_.-]+)"/g, /scope:"([A-Za-z0-9_.-]+)"/g]) {
    for (const match of source.matchAll(pattern)) scopes.add(match[1]);
  }
  const classes = new Set();
  for (const scope of scopes) {
    for (const cls of classesForScope(scope)) classes.add(cls);
  }
  return classes;
}

function htmlClasses(html) {
  const classes = new Set();
  for (const match of String(html || '').matchAll(/\bclass="([^"]+)"/g)) {
    for (const cls of match[1].split(/\s+/)) {
      if (cls) classes.add(cls);
    }
  }
  return classes;
}

function assertHasClasses(html, expected, label) {
  const classes = htmlClasses(html);
  for (const cls of expected) {
    assert.ok(classes.has(cls), `${label} should preserve ${cls}`);
  }
}

const expectedBundleClasses = extractBundleClasses(highlightBundle);
const allowlist = extractQuotedSet(syntaxSource, 'HIGHLIGHT_CLASS_ALLOWLIST');

for (const cls of expectedBundleClasses) {
  assert.ok(allowlist.has(cls), `highlight allowlist should include current bundle class ${cls}`);
}

assert.deepEqual(
  hljs.listLanguages().sort(),
  [
    'bash', 'c', 'cpp', 'csharp', 'css', 'diff', 'go', 'graphql', 'ini', 'java',
    'javascript', 'json', 'kotlin', 'less', 'lua', 'makefile', 'markdown',
    'objectivec', 'perl', 'php', 'php-template', 'plaintext', 'python',
    'python-repl', 'r', 'ruby', 'rust', 'scss', 'shell', 'sql', 'swift',
    'typescript', 'vbnet', 'wasm', 'xml', 'yaml'
  ],
  'reviewed Highlight.js common bundle language set should stay fixed'
);

const samples = {
  javascript: 'class Foo extends Bar { constructor(x) { this.x = x; } render() { return `${this.x}`; } }\nconst answer = true; console.log(answer);',
  python: 'class Foo(Bar):\n    def render(self, value: int = 1):\n        return f"value={value}"\n',
  css: '.post code[class~="language-js"] { color: var(--code); }\n@media screen { #id:hover { display: block; } }',
  xml: '<section class="hero"><h1>Hello</h1><!-- comment --></section>',
  json: '{"name":"Native","version":"3.4.0","required":true,"items":[1,2,3]}',
  yaml: 'name: Native\nversion: 3.4.0\nrequired: true\nitems:\n  - one\n',
  bash: 'export NODE_ENV=production\necho "hello" | grep h\nif [ -f package.json ]; then npm test; fi',
  diff: '- old line\n+ new line\n@@ -1,2 +1,2 @@\n context',
  markdown: '# Heading\n\n```js\nconst x = 1;\n```\n\n[link](https://example.com)'
};

for (const [language, code] of Object.entries(samples)) {
  const html = highlightCode(code, language);
  const classes = htmlClasses(html);
  assert.ok([...classes].some(cls => cls.startsWith('hljs-')), `${language} should preserve Highlight.js token classes`);
  assert.ok([...classes].some(cls => cls.startsWith('syntax-')), `${language} should preserve Press compatibility token classes`);
}

assertHasClasses(highlightCode(samples.javascript, 'javascript'), [
  'hljs-title',
  'function_',
  'class_',
  'inherited__',
  'hljs-variable',
  'language_',
  'syntax-title',
  'syntax-variables'
], 'javascript highlight output');

assertHasClasses(highlightCode(samples.python, 'python'), [
  'hljs-params',
  'hljs-built_in',
  'hljs-number',
  'syntax-property',
  'syntax-keyword'
], 'python highlight output');

assertHasClasses(highlightCode(samples.css, 'css'), [
  'hljs-selector-class',
  'hljs-selector-tag',
  'hljs-selector-attr',
  'hljs-selector-id',
  'hljs-selector-pseudo',
  'syntax-selector'
], 'css highlight output');

assertHasClasses(highlightCode(samples.xml, 'xml'), [
  'hljs-tag',
  'hljs-name',
  'hljs-attr',
  'hljs-string',
  'hljs-comment',
  'syntax-tag'
], 'xml highlight output');

assertHasClasses(highlightCode(samples.json, 'json'), [
  'hljs-punctuation',
  'hljs-attr',
  'hljs-literal',
  'syntax-punctuation',
  'syntax-property'
], 'json highlight output');

assertHasClasses(highlightCode(samples.yaml, 'yaml'), [
  'hljs-attr',
  'hljs-number',
  'hljs-literal',
  'hljs-bullet',
  'syntax-property'
], 'yaml highlight output');

assertHasClasses(highlightCode(samples.diff, 'diff'), [
  'hljs-deletion',
  'hljs-addition',
  'hljs-meta',
  'syntax-deletion',
  'syntax-addition'
], 'diff highlight output');

const mainHighlightClasses = [...expectedBundleClasses].filter(cls => cls.startsWith('hljs-'));
for (const cls of mainHighlightClasses) {
  const escaped = cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(nativeCss, new RegExp(`\\.${escaped}(?![A-Za-z0-9_-])`), `native CSS should cover ${cls}`);
}

for (const selector of [
  '.hljs-title.function_',
  '.hljs-title.function_.invoke__',
  '.hljs-title.class_',
  '.hljs-title.class_.inherited__',
  '.hljs-function.dispatch_',
  '.hljs-variable.language_',
  '.hljs-variable.constant_',
  '.hljs-meta.prompt_',
  '.hljs-char.escape_'
]) {
  assert.ok(nativeCss.includes(selector), `native CSS should cover ${selector}`);
}

console.log('ok - syntax highlight complete class preservation');
