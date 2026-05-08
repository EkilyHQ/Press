import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  ENCRYPTED_MARKDOWN_FORMAT,
  decryptMarkdownDocument,
  encryptMarkdownDocument,
  isEncryptedMarkdown,
  isValidEncryptedMarkdown,
  parseEncryptedMarkdownEnvelope,
  stripEncryptedBodyForPublicUse
} = await import('../assets/js/encrypted-content.js?test');
const { parseFrontMatter } = await import('../assets/js/content.js?encrypted-test');
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const source = [
  '---',
  'title: Private Notes',
  'date: 2026-05-08',
  'tags:',
  '  - press',
  '  - private',
  'excerpt: Public summary only',
  '---',
  '',
  '# Secret heading',
  '',
  'The launch code is swordfish.',
  ''
].join('\n');

const run = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
};

await run('encrypts markdown body without exposing plaintext', async () => {
  const encrypted = await encryptMarkdownDocument(source, 'correct horse battery staple', {
    salt: new Uint8Array(16).fill(7),
    iv: new Uint8Array(12).fill(9),
    iterations: 120000
  });
  assert.ok(encrypted.markdown.includes('protected: true'));
  assert.ok(encrypted.markdown.includes('encryption: {'));
  assert.ok(encrypted.markdown.includes('```press-encrypted-markdown-v1'));
  assert.ok(!encrypted.markdown.includes('The launch code is swordfish.'));
  assert.equal(encrypted.metadata.format, ENCRYPTED_MARKDOWN_FORMAT);
  assert.equal(encrypted.metadata.algorithm, 'AES-GCM-256');
  assert.equal(encrypted.metadata.kdf, 'PBKDF2-SHA256');
  assert.equal(encrypted.metadata.iterations, 120000);
  assert.equal(isEncryptedMarkdown(encrypted.markdown), true);
  assert.equal(isValidEncryptedMarkdown(encrypted.markdown), true);
});

await run('decrypts encrypted markdown with the original public front matter', async () => {
  const encrypted = await encryptMarkdownDocument(source, 'secret', {
    salt: new Uint8Array(16).fill(1),
    iv: new Uint8Array(12).fill(2)
  });
  const decrypted = await decryptMarkdownDocument(encrypted.markdown, 'secret');
  const parsed = parseFrontMatter(decrypted);
  assert.equal(parsed.frontMatter.title, 'Private Notes');
  assert.equal(parsed.frontMatter.protected, undefined);
  assert.equal(parsed.frontMatter.encryption, undefined);
  assert.equal(isEncryptedMarkdown(decrypted), false);
  assert.ok(parsed.content.includes('# Secret heading'));
  assert.ok(parsed.content.includes('The launch code is swordfish.'));
});

await run('rejects incorrect passwords through authenticated decryption failure', async () => {
  const encrypted = await encryptMarkdownDocument(source, 'right-password', {
    salt: new Uint8Array(16).fill(3),
    iv: new Uint8Array(12).fill(4)
  });
  await assert.rejects(
    () => decryptMarkdownDocument(encrypted.markdown, 'wrong-password'),
    /operation failed|decrypt|authentication|valid/i
  );
});

await run('keeps public metadata while removing encrypted body for public extraction', async () => {
  const encrypted = await encryptMarkdownDocument(source, 'secret', {
    salt: new Uint8Array(16).fill(5),
    iv: new Uint8Array(12).fill(6)
  });
  const publicOnly = stripEncryptedBodyForPublicUse(encrypted.markdown);
  const parsed = parseFrontMatter(publicOnly);
  assert.equal(parsed.frontMatter.title, 'Private Notes');
  assert.equal(parsed.frontMatter.excerpt, 'Public summary only');
  assert.equal(parsed.frontMatter.protected, true);
  assert.equal(parsed.content, '');
  assert.ok(!publicOnly.includes(encrypted.ciphertext));
});

await run('requires a non-empty password', async () => {
  await assert.rejects(() => encryptMarkdownDocument(source, ''), /Password is required/);
  await assert.rejects(() => encryptMarkdownDocument(source, null), /Password is required/);
});

await run('reports invalid protected envelopes without decrypting', async () => {
  const invalid = [
    '---',
    'title: Broken',
    'protected: true',
    '---',
    '',
    'not ciphertext',
    ''
  ].join('\n');
  const envelope = parseEncryptedMarkdownEnvelope(invalid);
  assert.equal(envelope.encrypted, true);
  assert.equal(envelope.valid, false);
  await assert.rejects(() => decryptMarkdownDocument(invalid, 'secret'), /metadata is missing|unsupported/);
});

await run('accepts YAML mapping encryption metadata', async () => {
  const encrypted = await encryptMarkdownDocument(source, 'secret', {
    salt: new Uint8Array(16).fill(8),
    iv: new Uint8Array(12).fill(10),
    iterations: 130000
  });
  const mapped = encrypted.markdown.replace(
    /^encryption: .+$/m,
    [
      'encryption:',
      '  format: press-encrypted-markdown-v1',
      '  algorithm: AES-GCM-256',
      '  kdf: PBKDF2-SHA256',
      '  iterations: 130000',
      `  salt: ${encrypted.metadata.salt}`,
      `  iv: ${encrypted.metadata.iv}`
    ].join('\n')
  );
  assert.equal(isValidEncryptedMarkdown(mapped), true);
  const decrypted = await decryptMarkdownDocument(mapped, 'secret');
  assert.ok(decrypted.includes('The launch code is swordfish.'));
});

await run('rejects unbounded KDF iteration metadata', async () => {
  const encrypted = await encryptMarkdownDocument(source, 'secret', {
    salt: new Uint8Array(16).fill(11),
    iv: new Uint8Array(12).fill(12)
  });
  const hostile = encrypted.markdown.replace(/"iterations":210000/, '"iterations":999999999');
  await assert.rejects(
    () => decryptMarkdownDocument(hostile, 'secret'),
    /iteration count is too high/
  );
});

await run('requires complete encryption metadata before an envelope is valid', async () => {
  const incomplete = [
    '---',
    'title: Incomplete',
    'protected: true',
    `encryption: {"format":"${ENCRYPTED_MARKDOWN_FORMAT}"}`,
    '---',
    '',
    '```press-encrypted-markdown-v1',
    'abc123',
    '```',
    ''
  ].join('\n');
  const envelope = parseEncryptedMarkdownEnvelope(incomplete);
  assert.equal(envelope.encrypted, true);
  assert.equal(envelope.valid, false);
  assert.equal(isValidEncryptedMarkdown(incomplete), false);
  await assert.rejects(() => decryptMarkdownDocument(incomplete, 'secret'), /algorithm is unsupported|metadata/i);
});

await run('requires explicit valid KDF iterations in envelope metadata', async () => {
  const encrypted = await encryptMarkdownDocument(source, 'secret', {
    salt: new Uint8Array(16).fill(13),
    iv: new Uint8Array(12).fill(14),
    iterations: 210000
  });
  const missing = encrypted.markdown.replace(/,"iterations":210000/, '');
  assert.equal(isValidEncryptedMarkdown(missing), false);
  await assert.rejects(() => decryptMarkdownDocument(missing, 'secret'), /iteration count is invalid/);

  const low = encrypted.markdown.replace(/"iterations":210000/, '"iterations":99999');
  assert.equal(isValidEncryptedMarkdown(low), false);
  await assert.rejects(() => decryptMarkdownDocument(low, 'secret'), /iteration count is too low/);

  const malformed = encrypted.markdown.replace(/"iterations":210000/, '"iterations":"nope"');
  assert.equal(isValidEncryptedMarkdown(malformed), false);
  await assert.rejects(() => decryptMarkdownDocument(malformed, 'secret'), /iteration count is invalid/);
});

await run('ships encrypted multi-language demo content without the old testpost entry', async () => {
  const index = readFileSync(resolve(repoRoot, 'wwwroot/index.yaml'), 'utf8');
  const sitemap = readFileSync(resolve(repoRoot, 'sitemap.xml'), 'utf8');
  assert.match(index, /encryptedArticles:/);
  assert.doesNotMatch(index, /testpost:/);
  assert.match(sitemap, /post%2Fencrypted-articles%2Fencrypted-articles_en\.md/);
  assert.doesNotMatch(sitemap, /post%2Ftestpost%2Fmain_en\.md/);
  assert.equal(existsSync(resolve(repoRoot, 'wwwroot/post/testpost/main_en.md')), false);

  const demoFiles = {
    en: {
      path: 'wwwroot/post/encrypted-articles/encrypted-articles_en.md',
      bodyPhrase: 'The Markdown body you are reading now was encrypted'
    },
    chs: {
      path: 'wwwroot/post/encrypted-articles/encrypted-articles_chs.md',
      bodyPhrase: '你正在阅读的 Markdown 正文已经在发布前加密'
    },
    'cht-tw': {
      path: 'wwwroot/post/encrypted-articles/encrypted-articles_cht-tw.md',
      bodyPhrase: '你正在閱讀的 Markdown 正文已經在發佈前加密'
    },
    'cht-hk': {
      path: 'wwwroot/post/encrypted-articles/encrypted-articles_cht-hk.md',
      bodyPhrase: '你正在閱讀的 Markdown 正文已經在發布前加密'
    },
    ja: {
      path: 'wwwroot/post/encrypted-articles/encrypted-articles_ja.md',
      bodyPhrase: '今読んでいる Markdown 本文は公開前に暗号化されています'
    }
  };

  for (const [lang, fixture] of Object.entries(demoFiles)) {
    const raw = readFileSync(resolve(repoRoot, fixture.path), 'utf8');
    assert.equal(isValidEncryptedMarkdown(raw), true, `${lang} demo should be a valid encrypted envelope`);
    assert.ok(raw.includes('press-demo'), `${lang} demo should publish the demo password in public metadata`);
    assert.ok(!raw.includes(fixture.bodyPhrase), `${lang} encrypted file should not expose plaintext body copy`);
    const parsed = parseFrontMatter(stripEncryptedBodyForPublicUse(raw));
    assert.equal(parsed.frontMatter.protected, true);
    assert.equal(parsed.frontMatter.encryption.format, ENCRYPTED_MARKDOWN_FORMAT);
    assert.ok(String(parsed.frontMatter.excerpt || '').includes('press-demo'));
    const decrypted = await decryptMarkdownDocument(raw, 'press-demo');
    assert.ok(decrypted.includes(fixture.bodyPhrase), `${lang} demo should decrypt with the public demo password`);
  }
});
