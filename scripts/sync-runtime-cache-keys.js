#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const check = args.has('--check') || !write;

if (args.has('--help') || args.has('-h')) {
  console.log('usage: node scripts/sync-runtime-cache-keys.js [--check|--write]');
  process.exit(0);
}

const unknown = [...args].filter((arg) => !['--check', '--write'].includes(arg));
if (unknown.length || (write && args.has('--check'))) {
  console.error('usage: node scripts/sync-runtime-cache-keys.js [--check|--write]');
  process.exit(2);
}

function readText(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function writeText(relPath, text) {
  fs.writeFileSync(path.join(root, relPath), text);
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function collectFiles(relPath) {
  const full = path.join(root, relPath);
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
      return collectFiles(path.join(relPath, entry.name));
    });
  }
  return [relPath];
}

function normalizeSlash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function resolveAssetPath(fromFile, rawRef) {
  const ref = String(rawRef || '').trim();
  if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//') || ref.startsWith('#')) return '';
  const withoutHash = ref.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  if (!withoutQuery) return '';
  if (withoutQuery.startsWith('/')) return withoutQuery.replace(/^\/+/, '');
  const baseDir = path.posix.dirname(normalizeSlash(fromFile));
  return path.posix.normalize(path.posix.join(baseDir, withoutQuery)).replace(/^\.\//, '');
}

function isManagedAsset(fromFile, rawRef) {
  const resolved = resolveAssetPath(fromFile, rawRef);
  if (!resolved) return false;
  return (
    resolved === 'index.html'
    || resolved === 'index_editor.html'
    || resolved === 'index_editor_preview.html'
    || resolved === 'assets/main.js'
    || resolved.startsWith('assets/js/')
    || resolved.startsWith('assets/i18n/')
    || resolved.startsWith('assets/schema/')
    || resolved.startsWith('assets/themes/native/')
  );
}

function replaceUrlCacheKeys(relPath, source, cacheKey) {
  return source.replace(/(\?v=)([^'"`\s<>)\\]+)/g, (match, prefix, _oldKey, offset) => {
    const before = source.slice(Math.max(0, offset - 260), offset);
    const refMatch = before.match(/(?:src|href|import|from)\s*=\s*["']([^"']+)$|(?:from|import)\s*["']([^"']+)$|@import\s+["']([^"']+)$|["'](?:module|src|href)["']\s*:\s*["']([^"']+)$/);
    const rawRef = refMatch && (refMatch[1] || refMatch[2] || refMatch[3] || refMatch[4]);
    if (!rawRef || !isManagedAsset(relPath, rawRef)) return match;
    return `${prefix}${cacheKey}`;
  });
}

function replaceSpecialRuntimeKeys(relPath, source, cacheKey) {
  if (relPath !== 'assets/js/theme-boot.js') return source;
  return source.replace(/(theme\.css\?v=)[^'"`\s<>)\\]+/g, `$1${cacheKey}`);
}

function replaceRuntimeCacheConstants(source, cacheKey) {
  return source
    .replace(/(const NATIVE_MODULE_CACHE_KEY = ')[^']*(';)/, `$1${cacheKey}$2`)
    .replace(/(const NATIVE_STYLE_CACHE_KEY = ')[^']*(';)/g, `$1${cacheKey}$2`);
}

function collectStaticCacheKeys(relPath, source) {
  const keys = [];
  source.replace(/(\?v=)([^'"`\s<>)\\]+)/g, (match, prefix, key, offset) => {
    const before = source.slice(Math.max(0, offset - 260), offset);
    const refMatch = before.match(/(?:src|href|import|from)\s*=\s*["']([^"']+)$|(?:from|import)\s*["']([^"']+)$|@import\s+["']([^"']+)$|["'](?:module|src|href)["']\s*:\s*["']([^"']+)$/);
    const rawRef = refMatch && (refMatch[1] || refMatch[2] || refMatch[3] || refMatch[4]);
    if ((rawRef && isManagedAsset(relPath, rawRef)) || (relPath === 'assets/js/theme-boot.js' && before.endsWith('theme.css'))) {
      keys.push({ key, match });
    }
    return match;
  });
  source.replace(/NATIVE_(?:MODULE|STYLE)_CACHE_KEY = '([^']*)'/g, (match, key) => {
    keys.push({ key, match });
    return match;
  });
  return keys;
}

const manifest = readJson('assets/press-system.json');
const version = String(manifest.version || '').trim();
const tag = String(manifest.tag || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(version) || tag !== `v${version}`) {
  console.error('assets/press-system.json must declare matching SemVer version and tag.');
  process.exit(1);
}

const cacheKey = `press-system-v${version}`;
const roots = [
  'index.html',
  'index_editor.html',
  'index_editor_preview.html',
  'assets/main.js',
  'assets/js',
  'assets/i18n',
  'assets/schema',
  'assets/themes/native'
];
const targetFiles = roots
  .flatMap(collectFiles)
  .concat(['scripts/test-system-updates.js'])
  .filter((file) => /\.(?:html|js|css|json)$/.test(file))
  .filter((file) => !file.includes('/vendor/'));

const changed = [];
for (const file of targetFiles) {
  const before = readText(file);
  let after = replaceUrlCacheKeys(file, before, cacheKey);
  after = replaceSpecialRuntimeKeys(file, after, cacheKey);
  after = replaceRuntimeCacheConstants(after, cacheKey);
  if (after !== before) {
    changed.push(file);
    if (write) writeText(file, after);
  }
}

const staleKeys = [];
for (const file of targetFiles) {
  const source = readText(file);
  for (const { key, match } of collectStaticCacheKeys(file, source)) {
    if (key !== cacheKey) staleKeys.push(`${file}: ${match}`);
  }
}

if (check && changed.length) {
  console.error(`Runtime cache keys are not synchronized to ${cacheKey}.`);
  changed.forEach((file) => console.error(`  ${file}`));
  console.error('Run: node scripts/sync-runtime-cache-keys.js --write');
  process.exit(1);
}

if (staleKeys.length) {
  console.error(`Runtime cache keys must use ${cacheKey}:`);
  staleKeys.forEach((entry) => console.error(`  ${entry}`));
  process.exit(1);
}

console.log(`${write ? 'synced' : 'checked'} runtime cache keys: ${cacheKey}`);
