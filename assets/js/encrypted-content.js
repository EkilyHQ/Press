import {
  buildMarkdownWithFrontMatter,
  cloneFrontMatterData,
  parseMarkdownFrontMatter,
  resolveFrontMatterBindings
} from './frontmatter-document.js?v=press-system-v3.4.4';

export const ENCRYPTED_MARKDOWN_FORMAT = 'press-encrypted-markdown-v1';
export const ENCRYPTED_MARKDOWN_FENCE = 'press-encrypted-markdown-v1';
export const DEFAULT_KDF_ITERATIONS = 210000;
export const MAX_KDF_ITERATIONS = 1000000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getCrypto() {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef || !cryptoRef.subtle || typeof cryptoRef.getRandomValues !== 'function') {
    throw new Error('Web Crypto is required for encrypted articles.');
  }
  return cryptoRef;
}

function normalizePassword(password) {
  const value = String(password == null ? '' : password);
  if (!value) throw new Error('Password is required.');
  return value;
}

function randomBytes(length) {
  const bytes = new Uint8Array(Math.max(1, Number(length) || 1));
  getCrypto().getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64Url(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  let binary = '';
  source.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(value) {
  const raw = String(value || '').trim();
  if (!raw) return new Uint8Array();
  const base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeIterations(value, options = {}) {
  const allowDefault = options.allowDefault !== false;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    if (allowDefault) return DEFAULT_KDF_ITERATIONS;
    throw new Error('Encrypted article KDF iteration count is invalid.');
  }
  if (Number.isFinite(parsed) && parsed > MAX_KDF_ITERATIONS) {
    throw new Error('Encrypted article KDF iteration count is too high.');
  }
  if (Number.isFinite(parsed) && parsed >= 100000) return parsed;
  if (allowDefault) return DEFAULT_KDF_ITERATIONS;
  throw new Error('Encrypted article KDF iteration count is too low.');
}

async function deriveArticleKey(password, metadata) {
  const passphrase = normalizePassword(password);
  const cryptoRef = getCrypto();
  const salt = base64UrlToBytes(metadata && metadata.salt);
  if (!salt.length) throw new Error('Encrypted article metadata is missing a salt.');
  const passKey = await cryptoRef.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return cryptoRef.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: normalizeIterations(metadata && metadata.iterations, { allowDefault: false }),
      hash: 'SHA-256'
    },
    passKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function buildEncryptedFence(ciphertext) {
  return [
    `\`\`\`${ENCRYPTED_MARKDOWN_FENCE}`,
    ciphertext,
    '```',
    ''
  ].join('\n');
}

function extractEncryptedFence(markdownBody) {
  const body = String(markdownBody || '').trim();
  const escaped = ENCRYPTED_MARKDOWN_FENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = body.match(new RegExp(`^\`\`\`${escaped}\\s*\\n([A-Za-z0-9_-]+)\\s*\\n\`\`\`$`));
  return match ? match[1] : '';
}

function cloneMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
}

function createEncryptionMetadata(options = {}) {
  const salt = options.salt instanceof Uint8Array ? options.salt : randomBytes(16);
  const iv = options.iv instanceof Uint8Array ? options.iv : randomBytes(12);
  return {
    format: ENCRYPTED_MARKDOWN_FORMAT,
    algorithm: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations: normalizeIterations(options.iterations),
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv)
  };
}

function validateEncryptionMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { valid: false, error: 'Encrypted article metadata is missing.' };
  }
  if (metadata.format !== ENCRYPTED_MARKDOWN_FORMAT) {
    return { valid: false, error: 'Encrypted article format is unsupported.' };
  }
  if (metadata.algorithm !== 'AES-GCM-256') {
    return { valid: false, error: 'Encrypted article algorithm is unsupported.' };
  }
  if (metadata.kdf !== 'PBKDF2-SHA256') {
    return { valid: false, error: 'Encrypted article KDF is unsupported.' };
  }
  try {
    normalizeIterations(metadata.iterations, { allowDefault: false });
  } catch (error) {
    return { valid: false, error: error && error.message ? error.message : 'Encrypted article KDF metadata is invalid.' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(String(metadata.salt || ''))) {
    return { valid: false, error: 'Encrypted article metadata is missing a salt.' };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(String(metadata.iv || ''))) {
    return { valid: false, error: 'Encrypted article metadata is missing an IV.' };
  }
  try {
    if (base64UrlToBytes(metadata.salt).length < 16) {
      return { valid: false, error: 'Encrypted article salt is too short.' };
    }
    if (base64UrlToBytes(metadata.iv).length !== 12) {
      return { valid: false, error: 'Encrypted article IV must be 12 bytes.' };
    }
  } catch (_) {
    return { valid: false, error: 'Encrypted article metadata encoding is invalid.' };
  }
  return { valid: true, error: '' };
}

export function parseEncryptedMarkdownEnvelope(markdown) {
  const parsed = parseMarkdownFrontMatter(markdown, { trimContent: false });
  const frontMatter = cloneFrontMatterData(parsed.frontMatter || {});
  const metadata = cloneMetadata(frontMatter.encryption);
  const ciphertext = extractEncryptedFence(parsed.content);
  const hasFormat = metadata.format === ENCRYPTED_MARKDOWN_FORMAT;
  const protectedFlag = frontMatter.protected === true || String(frontMatter.protected || '').toLowerCase() === 'true';
  const encrypted = protectedFlag || hasFormat || !!ciphertext;
  const metadataValidation = validateEncryptionMetadata(metadata);
  return {
    encrypted,
    valid: encrypted && metadataValidation.valid && !!ciphertext,
    error: metadataValidation.error,
    ciphertext,
    frontMatter,
    metadata,
    parsed,
    content: parsed.content || ''
  };
}

export function isEncryptedMarkdown(markdown) {
  return parseEncryptedMarkdownEnvelope(markdown).encrypted;
}

export function isValidEncryptedMarkdown(markdown) {
  return parseEncryptedMarkdownEnvelope(markdown).valid;
}

export async function encryptMarkdownDocument(markdown, password, options = {}) {
  normalizePassword(password);
  const parsed = parseMarkdownFrontMatter(markdown, { trimContent: false });
  const data = cloneFrontMatterData(parsed.frontMatter || {});
  const metadata = createEncryptionMetadata(options);
  const cryptoRef = getCrypto();
  const key = await deriveArticleKey(password, metadata);
  const iv = base64UrlToBytes(metadata.iv);
  const ciphertext = await cryptoRef.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(parsed.content || '')
  );
  data.protected = true;
  data.encryption = metadata;
  const bindings = resolveFrontMatterBindings(data, parsed.document);
  const encryptedMarkdown = buildMarkdownWithFrontMatter(
    parsed.document,
    buildEncryptedFence(bytesToBase64Url(new Uint8Array(ciphertext))),
    data,
    {
      bindings,
      order: parsed.document && Array.isArray(parsed.document.knownOrder) ? parsed.document.knownOrder.slice() : [],
      eol: parsed.eol,
      trailingNewline: true
    }
  );
  return {
    markdown: encryptedMarkdown,
    metadata,
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext))
  };
}

export async function decryptMarkdownDocument(markdown, password) {
  const envelope = parseEncryptedMarkdownEnvelope(markdown);
  if (!envelope.valid) throw new Error(envelope.error || 'Encrypted article envelope is invalid.');
  const metadata = envelope.metadata;
  const key = await deriveArticleKey(password, metadata);
  const iv = base64UrlToBytes(metadata.iv);
  const plaintext = await getCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64UrlToBytes(envelope.ciphertext)
  );
  const body = textDecoder.decode(plaintext);
  const data = cloneFrontMatterData(envelope.frontMatter || {});
  delete data.protected;
  delete data.encryption;
  const bindings = resolveFrontMatterBindings(data, envelope.parsed.document);
  return buildMarkdownWithFrontMatter(
    envelope.parsed.document,
    body,
    data,
    {
      bindings,
      order: envelope.parsed.document && Array.isArray(envelope.parsed.document.knownOrder)
        ? envelope.parsed.document.knownOrder.slice()
        : [],
      eol: envelope.parsed.eol,
      trailingNewline: body.endsWith('\n')
    }
  );
}

export function stripEncryptedBodyForPublicUse(markdown) {
  const envelope = parseEncryptedMarkdownEnvelope(markdown);
  if (!envelope.encrypted) return markdown;
  const data = cloneFrontMatterData(envelope.frontMatter || {});
  const bindings = resolveFrontMatterBindings(data, envelope.parsed.document);
  return buildMarkdownWithFrontMatter(
    envelope.parsed.document,
    '',
    data,
    {
      bindings,
      order: envelope.parsed.document && Array.isArray(envelope.parsed.document.knownOrder)
        ? envelope.parsed.document.knownOrder.slice()
        : [],
      eol: envelope.parsed.eol,
      trailingNewline: false
    }
  );
}
