import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scopedEditorModules = [
  'assets/js/composer-site-config.js',
  'assets/js/composer-markdown-actions.js',
  'assets/js/composer-setup-verifier.js',
  'assets/js/composer-path-tools.js',
  'assets/js/publish/transports/github-pat-transport.js'
];

const providerSpecificPatterns = [
  /https:\/\/github\.com/u,
  /https:\/\/api\.github\.com/u,
  /api\.github\.com\/graphql/u,
  /\.github\.io/u
];

for (const file of scopedEditorModules) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of providerSpecificPatterns) {
    assert.equal(
      pattern.test(source),
      false,
      `${file} must depend on provider-adapters.js instead of hard-coding ${pattern}`
    );
  }
}

const providerSource = readFileSync('assets/js/provider-adapters.js', 'utf8');
for (const expected of [
  'https://github.com',
  'https://api.github.com',
  '.github.io'
]) {
  assert.ok(
    providerSource.includes(expected),
    `provider-adapters.js should keep the GitHub provider literal ${expected}`
  );
}

console.log('provider boundary tests passed');
