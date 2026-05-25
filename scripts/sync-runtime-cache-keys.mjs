#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const PRESS_CACHE_KEY_PATTERN = /^press-system-v\d+\.\d+\.\d+$/;
const VERSIONED_REF_PATTERN = /[?&]v=press-system-v\d+\.\d+\.\d+/;
const MANAGED_EXTENSIONS = new Set(['.css', '.js', '.mjs']);
const REWRITE_EXTENSIONS = new Set(['.css', '.html', '.js']);
const LANGUAGE_MANIFEST = 'assets/i18n/languages.json';
const RUNTIME_MANIFEST_PATH = 'assets/press-runtime-manifest.json';
const NATIVE_CACHE_CONSTANTS = [
  'NATIVE_MODULE_CACHE_KEY',
  'NATIVE_STYLE_CACHE_KEY',
  'KATEX_VENDOR_CACHE_KEY'
];

const argv = process.argv.slice(2);
const options = parseArgs(argv);

if (options.help) {
  usage(0);
}

const mode = options.materializeRoot ? 'materialize' : (options.write ? 'write' : 'check');
const root = mode === 'materialize'
  ? path.resolve(options.materializeRoot)
  : repoRoot;
const tag = resolveTag(root, options.tag);
const version = tag.slice(1);
const cacheKey = `press-system-${tag}`;

if (mode === 'materialize') {
  materializeRuntime(root, tag, version, cacheKey);
} else {
  checkOrCleanSource(root, mode);
}

function usage(exitCode = 2) {
  const out = exitCode ? console.error : console.log;
  out('usage: node scripts/sync-runtime-cache-keys.mjs [--check|--write]');
  out('       node scripts/sync-runtime-cache-keys.mjs --materialize-root <payload-root> [--tag vX.Y.Z]');
  process.exit(exitCode);
}

function parseArgs(args) {
  const parsed = {
    check: false,
    write: false,
    help: false,
    materializeRoot: '',
    tag: ''
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--check') parsed.check = true;
    else if (arg === '--write') parsed.write = true;
    else if (arg === '--materialize-root') {
      i += 1;
      if (!args[i]) usage();
      parsed.materializeRoot = args[i];
    } else if (arg === '--tag') {
      i += 1;
      if (!args[i]) usage();
      parsed.tag = args[i];
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else {
      usage();
    }
  }
  if (parsed.write && parsed.check) usage();
  if (parsed.materializeRoot && parsed.write) usage();
  if (parsed.materializeRoot && parsed.check) usage();
  if (parsed.tag && !/^v\d+\.\d+\.\d+$/.test(parsed.tag)) {
    console.error(`invalid release tag: ${parsed.tag}`);
    process.exit(2);
  }
  return parsed;
}

function readText(rootDir, relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

function writeText(rootDir, relPath, text) {
  fs.writeFileSync(path.join(rootDir, relPath), text);
}

function readJson(rootDir, relPath) {
  return JSON.parse(readText(rootDir, relPath));
}

function resolveTag(rootDir, explicitTag = '') {
  if (explicitTag) return explicitTag;
  const manifest = readJson(rootDir, 'assets/press-system.json');
  const versionValue = String(manifest.version || '').trim();
  const tagValue = String(manifest.tag || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(versionValue) || tagValue !== `v${versionValue}`) {
    console.error('assets/press-system.json must declare matching SemVer version and tag.');
    process.exit(1);
  }
  return tagValue;
}

function collectFiles(rootDir, relPath) {
  const full = path.join(rootDir, relPath);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
      return collectFiles(rootDir, path.posix.join(normalizeSlash(relPath), entry.name));
    });
  }
  return [normalizeSlash(relPath)];
}

function normalizeSlash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function runtimeRoots(includeManifest = false) {
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
  if (includeManifest) roots.push(RUNTIME_MANIFEST_PATH);
  return roots;
}

function rewriteTargetFiles(rootDir) {
  return runtimeRoots(false)
    .flatMap((entry) => collectFiles(rootDir, entry))
    .filter((file) => {
      if (file.includes('/vendor/')) return false;
      if (file === LANGUAGE_MANIFEST) return true;
      return REWRITE_EXTENSIONS.has(path.posix.extname(file).toLowerCase());
    });
}

function manifestTargetFiles(rootDir) {
  return runtimeRoots(false)
    .flatMap((entry) => collectFiles(rootDir, entry))
    .filter((file) => file !== RUNTIME_MANIFEST_PATH)
    .filter((file) => fs.statSync(path.join(rootDir, file)).isFile())
    .sort();
}

function resolveAssetPath(fromFile, rawRef) {
  const ref = String(rawRef || '').trim();
  if (!ref || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//') || ref.startsWith('#')) return '';
  const withoutHash = ref.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  if (!withoutQuery) return '';
  if (withoutQuery.startsWith('/')) return withoutQuery.replace(/^\/+/, '');
  if (
    withoutQuery.startsWith('assets/')
    || withoutQuery === 'index.html'
    || withoutQuery === 'index_editor.html'
    || withoutQuery === 'index_editor_preview.html'
  ) {
    return normalizeSlash(withoutQuery).replace(/^\.\//, '');
  }
  const baseDir = path.posix.dirname(normalizeSlash(fromFile));
  return path.posix.normalize(path.posix.join(baseDir, withoutQuery)).replace(/^\.\//, '');
}

function isManagedRuntimeAsset(rootDir, fromFile, rawRef) {
  const resolved = resolveAssetPath(fromFile, rawRef);
  if (!resolved) return false;
  const ext = path.posix.extname(resolved).toLowerCase();
  if (!MANAGED_EXTENSIONS.has(ext)) return false;
  if (
    resolved === 'assets/main.js'
    || resolved.startsWith('assets/js/')
    || resolved.startsWith('assets/i18n/')
    || resolved.startsWith('assets/themes/native/')
  ) {
    return fs.existsSync(path.join(rootDir, resolved));
  }
  return false;
}

function splitHash(value) {
  const raw = String(value || '');
  const hashIndex = raw.indexOf('#');
  return {
    pathAndQuery: hashIndex >= 0 ? raw.slice(0, hashIndex) : raw,
    hash: hashIndex >= 0 ? raw.slice(hashIndex) : ''
  };
}

function splitQuery(value) {
  const queryIndex = value.indexOf('?');
  return {
    pathname: queryIndex >= 0 ? value.slice(0, queryIndex) : value,
    query: queryIndex >= 0 ? value.slice(queryIndex + 1) : ''
  };
}

function stripPressCacheParam(rawRef) {
  const { pathAndQuery, hash } = splitHash(rawRef);
  const { pathname, query } = splitQuery(pathAndQuery);
  if (!query) return rawRef;
  const parts = query.split('&').filter((part) => !/^v=press-system-v\d+\.\d+\.\d+$/.test(part));
  return `${pathname}${parts.length ? `?${parts.join('&')}` : ''}${hash}`;
}

function ensurePressCacheParam(rawRef, cacheKey) {
  const clean = stripPressCacheParam(rawRef);
  const { pathAndQuery, hash } = splitHash(clean);
  const joiner = pathAndQuery.includes('?') ? '&' : '?';
  return `${pathAndQuery}${joiner}v=${encodeURIComponent(cacheKey)}${hash}`;
}

function transformRuntimeRef(rootDir, relPath, rawRef, mode, cacheKeyValue) {
  if (!isManagedRuntimeAsset(rootDir, relPath, rawRef)) return rawRef;
  return mode === 'materialize'
    ? ensurePressCacheParam(rawRef, cacheKeyValue)
    : stripPressCacheParam(rawRef);
}

function transformImportRefs(rootDir, relPath, source, mode, cacheKeyValue) {
  return source.replace(
    /(\bfrom\s*|\bimport\s*(?:\(\s*)?|@import\s+)(['"`])([^'"`]+)(\2)/g,
    (match, prefix, quote, rawRef, closeQuote) => {
      const nextRef = transformRuntimeRef(rootDir, relPath, rawRef, mode, cacheKeyValue);
      return nextRef === rawRef ? match : `${prefix}${quote}${nextRef}${closeQuote}`;
    }
  );
}

function transformHtmlAttributeRefs(rootDir, relPath, source, mode, cacheKeyValue) {
  return source.replace(
    /(\b(?:src|href)\s*=\s*)(["'])([^"']+)(\2)/g,
    (match, prefix, quote, rawRef, closeQuote) => {
      const nextRef = transformRuntimeRef(rootDir, relPath, rawRef, mode, cacheKeyValue);
      return nextRef === rawRef ? match : `${prefix}${quote}${nextRef}${closeQuote}`;
    }
  );
}

function transformLanguageManifestRefs(rootDir, relPath, source, mode, cacheKeyValue) {
  if (relPath !== LANGUAGE_MANIFEST) return source;
  return source.replace(
    /("module"\s*:\s*")([^"]+)(")/g,
    (match, prefix, rawRef, suffix) => {
      const nextRef = transformRuntimeRef(rootDir, relPath, rawRef, mode, cacheKeyValue);
      return nextRef === rawRef ? match : `${prefix}${nextRef}${suffix}`;
    }
  );
}

function transformNativeThemeBoot(source, mode, cacheKeyValue) {
  return source.replace(/(\/theme\.css)(?:\?v=press-system-v\d+\.\d+\.\d+)?/g, (_match, pathPart) => {
    return mode === 'materialize' ? `${pathPart}?v=${cacheKeyValue}` : pathPart;
  });
}

function transformNativeCacheConstants(source, mode, cacheKeyValue) {
  let next = source;
  NATIVE_CACHE_CONSTANTS.forEach((name) => {
    const replacement = mode === 'materialize' ? cacheKeyValue : '';
    next = next.replace(
      new RegExp(`(const\\s+${name}\\s*=\\s*')[^']*(';)`, 'g'),
      `$1${replacement}$2`
    );
  });
  return next;
}

function transformSource(rootDir, relPath, source, mode, cacheKeyValue = '') {
  let next = source;
  next = transformImportRefs(rootDir, relPath, next, mode, cacheKeyValue);
  next = transformHtmlAttributeRefs(rootDir, relPath, next, mode, cacheKeyValue);
  next = transformLanguageManifestRefs(rootDir, relPath, next, mode, cacheKeyValue);
  if (relPath === 'assets/js/theme-boot.js') next = transformNativeThemeBoot(next, mode, cacheKeyValue);
  next = transformNativeCacheConstants(next, mode, cacheKeyValue);
  return next;
}

function findSourceCacheKeys(rootDir) {
  const findings = [];
  rewriteTargetFiles(rootDir).forEach((file) => {
    const source = readText(rootDir, file);
    if (VERSIONED_REF_PATTERN.test(source)) {
      findings.push(`${file}: contains a materialized press-system cache key`);
    }
    NATIVE_CACHE_CONSTANTS.forEach((name) => {
      const re = new RegExp(`const\\s+${name}\\s*=\\s*'([^']*)'`, 'g');
      source.replace(re, (_match, value) => {
        if (value) {
          const reason = PRESS_CACHE_KEY_PATTERN.test(value) ? 'is materialized in source' : 'is non-empty in source';
          findings.push(`${file}: ${name} ${reason}`);
        }
        return _match;
      });
    });
  });
  return findings;
}

function checkOrCleanSource(rootDir, mode) {
  const changed = [];
  if (mode === 'write') {
    rewriteTargetFiles(rootDir).forEach((file) => {
      const before = readText(rootDir, file);
      const after = transformSource(rootDir, file, before, 'source');
      if (after !== before) {
        writeText(rootDir, file, after);
        changed.push(file);
      }
    });
  }

  const findings = findSourceCacheKeys(rootDir);
  if (findings.length) {
    console.error('Runtime source files must not contain materialized press-system cache keys.');
    findings.forEach((entry) => console.error(`  ${entry}`));
    console.error('Run: node scripts/sync-runtime-cache-keys.mjs --write');
    process.exit(1);
  }
  console.log(`${mode === 'write' ? 'cleaned' : 'checked'} runtime source cache keys${changed.length ? `: ${changed.length} files updated` : ''}`);
}

function materializeRuntime(rootDir, tagValue, versionValue, cacheKeyValue) {
  const changed = [];
  rewriteTargetFiles(rootDir).forEach((file) => {
    const before = readText(rootDir, file);
    const after = transformSource(rootDir, file, before, 'materialize', cacheKeyValue);
    if (after !== before) {
      writeText(rootDir, file, after);
      changed.push(file);
    }
  });
  const missing = findMaterializedGaps(rootDir, cacheKeyValue);
  if (missing.length) {
    console.error(`Materialized runtime files must reference managed JS/CSS with ${cacheKeyValue}.`);
    missing.forEach((entry) => console.error(`  ${entry}`));
    process.exit(1);
  }
  writeRuntimeManifest(rootDir, tagValue, versionValue, cacheKeyValue);
  console.log(`materialized runtime cache keys: ${cacheKeyValue}${changed.length ? ` (${changed.length} files updated)` : ''}`);
}

function collectRefsForVerification(rootDir, relPath, source) {
  const refs = [];
  source.replace(
    /(\bfrom\s*|\bimport\s*(?:\(\s*)?|@import\s+)(['"`])([^'"`]+)(\2)/g,
    (match, _prefix, _quote, rawRef) => {
      if (isManagedRuntimeAsset(rootDir, relPath, rawRef)) refs.push({ rawRef, match });
      return match;
    }
  );
  source.replace(
    /(\b(?:src|href)\s*=\s*)(["'])([^"']+)(\2)/g,
    (match, _prefix, _quote, rawRef) => {
      if (isManagedRuntimeAsset(rootDir, relPath, rawRef)) refs.push({ rawRef, match });
      return match;
    }
  );
  if (relPath === LANGUAGE_MANIFEST) {
    source.replace(/("module"\s*:\s*")([^"]+)(")/g, (match, _prefix, rawRef) => {
      if (isManagedRuntimeAsset(rootDir, relPath, rawRef)) refs.push({ rawRef, match });
      return match;
    });
  }
  return refs;
}

function findMaterializedGaps(rootDir, cacheKeyValue) {
  const gaps = [];
  rewriteTargetFiles(rootDir).forEach((file) => {
    const source = readText(rootDir, file);
    collectRefsForVerification(rootDir, file, source).forEach(({ rawRef, match }) => {
      const { pathAndQuery } = splitHash(rawRef);
      const { query } = splitQuery(pathAndQuery);
      const params = query.split('&').filter(Boolean);
      if (!params.includes(`v=${cacheKeyValue}`)) {
        gaps.push(`${file}: ${match}`);
      }
    });
    NATIVE_CACHE_CONSTANTS.forEach((name) => {
      const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*'([^']*)'`));
      if (match && match[1] !== cacheKeyValue) {
        gaps.push(`${file}: ${name} is ${match[1] ? 'stale' : 'empty'}`);
      }
    });
  });
  return gaps;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeRuntimeManifest(rootDir, tagValue, versionValue, cacheKeyValue) {
  const files = manifestTargetFiles(rootDir);
  const entries = files.map((file) => {
    const absolute = path.join(rootDir, file);
    const stat = fs.statSync(absolute);
    return {
      path: file,
      size: stat.size,
      sha256: sha256File(absolute)
    };
  });
  const manifest = {
    schemaVersion: 1,
    type: 'press-runtime-assets',
    version: versionValue,
    tag: tagValue,
    cacheKey: cacheKeyValue,
    strategy: 'query-param',
    entries
  };
  writeText(rootDir, RUNTIME_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}
