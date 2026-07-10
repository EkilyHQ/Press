#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  getPressSystemRuntimeRoots,
  isPressSystemManagedRuntimePath,
  PRESS_SYSTEM_SURFACE
} from '../assets/js/press-system-surface.mjs';
import {
  collectHtmlScriptElements,
  collectHtmlStartTags,
  EDITOR_INLINE_SCRIPT_SHA256_SOURCES,
  isJavascriptUrlAttributeValue,
  MATERIALIZED_CONTENT_SECURITY_POLICIES
} from '../assets/js/content-security-policy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const PRESS_CACHE_KEY_PATTERN = /^press-system-v\d+\.\d+\.\d+$/;
const VERSIONED_REF_PATTERN = /[?&]v=press-system-v\d+\.\d+\.\d+/;
const MANAGED_EXTENSIONS = new Set(['.css', '.js', '.mjs']);
const REWRITE_EXTENSIONS = new Set(['.css', '.html', '.js']);
const LANGUAGE_MANIFEST = 'assets/i18n/languages.json';
const RUNTIME_MANIFEST_PATH = PRESS_SYSTEM_SURFACE.runtimeManifestPath;
const MATERIALIZED_CSP_PATHS = Object.freeze(Object.keys(MATERIALIZED_CONTENT_SECURITY_POLICIES));
const NATIVE_CACHE_CONSTANTS = ['NATIVE_MODULE_CACHE_KEY', 'NATIVE_STYLE_CACHE_KEY', 'KATEX_VENDOR_CACHE_KEY'];

const argv = process.argv.slice(2);
const options = parseArgs(argv);

if (options.help) {
  usage(0);
}

const mode = options.materializeRoot ? 'materialize' : options.write ? 'write' : 'check';
const root = mode === 'materialize' ? path.resolve(options.materializeRoot) : repoRoot;
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
  return getPressSystemRuntimeRoots({ includeRuntimeManifest: includeManifest });
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
    withoutQuery.startsWith('assets/') ||
    withoutQuery === 'index.html' ||
    withoutQuery === 'index_editor.html' ||
    withoutQuery === 'index_editor_preview.html'
  ) {
    return normalizeSlash(withoutQuery).replace(/^\.\//, '');
  }
  const baseDir = path.posix.dirname(normalizeSlash(fromFile));
  return path.posix.normalize(path.posix.join(baseDir, withoutQuery)).replace(/^\.\//, '');
}

function isManagedRuntimeAsset(rootDir, fromFile, rawRef) {
  const resolved = resolveAssetPath(fromFile, rawRef);
  return isManagedRuntimeAssetPath(rootDir, resolved);
}

function isManagedRuntimeAssetPath(rootDir, resolved) {
  if (!resolved) return false;
  const ext = path.posix.extname(resolved).toLowerCase();
  if (!MANAGED_EXTENSIONS.has(ext)) return false;
  if (isPressSystemManagedRuntimePath(resolved)) {
    return fs.existsSync(path.join(rootDir, resolved));
  }
  return false;
}

function extractPressCacheKey(rawRef) {
  const { pathAndQuery } = splitHash(rawRef);
  const { query } = splitQuery(pathAndQuery);
  if (!query) return '';
  const match = query.split('&').find((part) => /^v=press-system-v\d+\.\d+\.\d+$/.test(part));
  return match ? match.slice(2) : '';
}

function importReferenceKind(prefix) {
  const raw = String(prefix || '');
  if (/^@import\b/.test(raw.trim())) return 'css-import';
  if (/\bimport\s*\(\s*$/.test(raw)) return 'dynamic-import';
  return 'module-import';
}

function pushRuntimeReference(refs, rootDir, relPath, rawRef, kind, match) {
  const target = resolveAssetPath(relPath, rawRef);
  if (!isManagedRuntimeAssetPath(rootDir, target)) return;
  refs.push({
    from: relPath,
    to: target,
    kind,
    specifier: String(rawRef || ''),
    cacheKey: extractPressCacheKey(rawRef),
    match
  });
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
  return mode === 'materialize' ? ensurePressCacheParam(rawRef, cacheKeyValue) : stripPressCacheParam(rawRef);
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
  return source.replace(/(\b(?:src|href)\s*=\s*)(["'])([^"']+)(\2)/g, (match, prefix, quote, rawRef, closeQuote) => {
    const nextRef = transformRuntimeRef(rootDir, relPath, rawRef, mode, cacheKeyValue);
    return nextRef === rawRef ? match : `${prefix}${quote}${nextRef}${closeQuote}`;
  });
}

function transformLanguageManifestRefs(rootDir, relPath, source, mode, cacheKeyValue) {
  if (relPath !== LANGUAGE_MANIFEST) return source;
  return source.replace(/("module"\s*:\s*")([^"]+)(")/g, (match, prefix, rawRef, suffix) => {
    const nextRef = transformRuntimeRef(rootDir, relPath, rawRef, mode, cacheKeyValue);
    return nextRef === rawRef ? match : `${prefix}${nextRef}${suffix}`;
  });
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
    next = next.replace(new RegExp(`(const\\s+${name}\\s*=\\s*')[^']*(';)`, 'g'), `$1${replacement}$2`);
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

function collectInlineScripts(source, relPath) {
  return collectHtmlScriptElements(source, relPath)
    .filter(({ attributeMap }) => !attributeMap.has('src'))
    .map(({ source: inlineSource }) => inlineSource);
}

function sha256Source(source) {
  return `sha256-${crypto
    .createHash('sha256')
    .update(String(source || ''), 'utf8')
    .digest('base64')}`;
}

function assertExpectedInlineScripts(source, relPath) {
  const expected = relPath === 'index_editor.html' ? EDITOR_INLINE_SCRIPT_SHA256_SOURCES : [];
  const actual = collectInlineScripts(source, relPath).map(sha256Source);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${relPath} inline scripts must match the reviewed SHA-256 allowlist; expected ${expected.length}, found ${actual.length}`
    );
  }
}

function assertNoScriptAttributesOrJavascriptUrls(source, relPath) {
  const urlAttributes = new Set(['action', 'formaction', 'href', 'src', 'xlink:href']);
  for (const { attributeMap } of collectHtmlStartTags(source, '', relPath)) {
    for (const [name, value] of attributeMap) {
      if (/^on[a-z][a-z0-9:-]*$/u.test(name)) {
        throw new Error(`${relPath} contains an inline script event attribute`);
      }
      if (urlAttributes.has(name) && isJavascriptUrlAttributeValue(value)) {
        throw new Error(`${relPath} contains a javascript URL`);
      }
    }
  }
}

function findContentSecurityPolicyMeta(source, relPath = 'HTML') {
  return collectHtmlStartTags(source, 'meta', relPath).filter(({ attributeMap }) => {
    return (
      String(attributeMap.get('http-equiv') || '')
        .trim()
        .toLowerCase() === 'content-security-policy'
    );
  });
}

function viewportMeta(source, relPath) {
  const matches = collectHtmlStartTags(source, 'meta', relPath).filter(({ attributeMap }) => {
    return String(attributeMap.get('name') || '').toLowerCase() === 'viewport';
  });
  if (matches.length !== 1) throw new Error(`${relPath} must contain exactly one viewport meta tag`);
  return matches[0];
}

function expectedCspMetaTag(relPath) {
  const policy = MATERIALIZED_CONTENT_SECURITY_POLICIES[relPath];
  if (!policy) throw new Error(`unsupported materialized CSP path: ${relPath}`);
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
}

function assertMaterializedContentSecurityPolicy(source, relPath) {
  const candidates = findContentSecurityPolicyMeta(source, relPath);
  if (candidates.length !== 1) {
    throw new Error(`${relPath} must contain exactly one materialized Content-Security-Policy meta tag`);
  }
  const expectedTag = expectedCspMetaTag(relPath);
  if (candidates[0].tag !== expectedTag) {
    throw new Error(`${relPath} contains a malformed or stale Content-Security-Policy meta tag`);
  }
  const viewport = viewportMeta(source, relPath);
  const indentStart = source.lastIndexOf('\n', viewport.index) + 1;
  const indent = source.slice(indentStart, viewport.index).match(/^[ \t]*/u)?.[0] || '';
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const afterViewport = viewport.index + viewport.tag.length;
  if (!source.slice(afterViewport).startsWith(`${eol}${indent}${expectedTag}`)) {
    throw new Error(`${relPath} Content-Security-Policy must immediately follow the viewport meta tag`);
  }
}

function assertHtmlSecurityBoundary(source, relPath, { materialized }) {
  assertExpectedInlineScripts(source, relPath);
  assertNoScriptAttributesOrJavascriptUrls(source, relPath);
  const candidates = findContentSecurityPolicyMeta(source, relPath);
  if (materialized) {
    assertMaterializedContentSecurityPolicy(source, relPath);
  } else if (candidates.length !== 0) {
    throw new Error(`${relPath} source must not contain a materialized Content-Security-Policy meta tag`);
  }
}

function materializeContentSecurityPolicy(source, relPath) {
  assertExpectedInlineScripts(source, relPath);
  assertNoScriptAttributesOrJavascriptUrls(source, relPath);
  const candidates = findContentSecurityPolicyMeta(source, relPath);
  if (candidates.length > 0) {
    assertMaterializedContentSecurityPolicy(source, relPath);
    return source;
  }
  const viewport = viewportMeta(source, relPath);
  const indentStart = source.lastIndexOf('\n', viewport.index) + 1;
  const indent = source.slice(indentStart, viewport.index).match(/^[ \t]*/u)?.[0] || '';
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  const insertAt = viewport.index + viewport.tag.length;
  const materialized = `${source.slice(0, insertAt)}${eol}${indent}${expectedCspMetaTag(relPath)}${source.slice(insertAt)}`;
  assertMaterializedContentSecurityPolicy(materialized, relPath);
  return materialized;
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
  MATERIALIZED_CSP_PATHS.forEach((relPath) => {
    assertHtmlSecurityBoundary(readText(rootDir, relPath), relPath, { materialized: false });
  });
  console.log(
    `${mode === 'write' ? 'cleaned' : 'checked'} runtime source cache keys${changed.length ? `: ${changed.length} files updated` : ''}`
  );
}

function materializeRuntime(rootDir, tagValue, versionValue, cacheKeyValue) {
  const updates = rewriteTargetFiles(rootDir).map((file) => {
    const before = readText(rootDir, file);
    let after = transformSource(rootDir, file, before, 'materialize', cacheKeyValue);
    if (MATERIALIZED_CSP_PATHS.includes(file)) after = materializeContentSecurityPolicy(after, file);
    return { file, before, after };
  });
  const materializedSources = new Map(updates.map(({ file, after }) => [file, after]));
  MATERIALIZED_CSP_PATHS.forEach((relPath) => {
    if (!materializedSources.has(relPath)) {
      throw new Error(`materialized runtime is missing required CSP path: ${relPath}`);
    }
    assertHtmlSecurityBoundary(materializedSources.get(relPath), relPath, { materialized: true });
  });
  const missing = findMaterializedGaps(rootDir, cacheKeyValue, materializedSources);
  if (missing.length) {
    console.error(`Materialized runtime files must reference managed JS/CSS with ${cacheKeyValue}.`);
    missing.forEach((entry) => console.error(`  ${entry}`));
    process.exit(1);
  }
  updates.forEach(({ file, before, after }) => {
    if (after !== before) writeText(rootDir, file, after);
  });
  const changed = updates.filter(({ before, after }) => after !== before).map(({ file }) => file);
  writeRuntimeManifest(rootDir, tagValue, versionValue, cacheKeyValue);
  console.log(
    `materialized runtime cache keys: ${cacheKeyValue}${changed.length ? ` (${changed.length} files updated)` : ''}`
  );
}

function collectRefsForVerification(rootDir, relPath, source) {
  const refs = [];
  source.replace(
    /(\bfrom\s*|\bimport\s*(?:\(\s*)?|@import\s+)(['"`])([^'"`]+)(\2)/g,
    (match, prefix, _quote, rawRef) => {
      pushRuntimeReference(refs, rootDir, relPath, rawRef, importReferenceKind(prefix), match);
      return match;
    }
  );
  source.replace(/(\b(?:src|href)\s*=\s*)(["'])([^"']+)(\2)/g, (match, prefix, _quote, rawRef) => {
    const attrMatch = prefix.match(/\b(src|href)\s*=/i);
    const attr = attrMatch ? attrMatch[1].toLowerCase() : 'attr';
    pushRuntimeReference(refs, rootDir, relPath, rawRef, `html-${attr}`, match);
    return match;
  });
  if (relPath === LANGUAGE_MANIFEST) {
    source.replace(/("module"\s*:\s*")([^"]+)(")/g, (match, _prefix, rawRef) => {
      pushRuntimeReference(refs, rootDir, relPath, rawRef, 'language-module', match);
      return match;
    });
  }
  return refs;
}

function findMaterializedGaps(rootDir, cacheKeyValue, materializedSources = new Map()) {
  const gaps = [];
  rewriteTargetFiles(rootDir).forEach((file) => {
    const source = materializedSources.has(file) ? materializedSources.get(file) : readText(rootDir, file);
    collectRefsForVerification(rootDir, file, source).forEach(({ specifier, match }) => {
      const { pathAndQuery } = splitHash(specifier);
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

function collectNativeThemeManifestEdges(rootDir, cacheKeyValue) {
  const relPath = 'assets/themes/native/theme.json';
  const full = path.join(rootDir, relPath);
  if (!fs.existsSync(full)) return [];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (_) {
    return [];
  }
  const edges = [];
  const addEntries = (kind, entries) => {
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      const safeEntry = String(entry || '')
        .replace(/^[./]+/, '')
        .trim();
      if (!safeEntry || safeEntry.includes('..') || safeEntry.includes('\\')) return;
      const target = `assets/themes/native/${safeEntry}`;
      if (!isManagedRuntimeAssetPath(rootDir, target)) return;
      edges.push({
        from: relPath,
        to: target,
        kind,
        specifier: cacheKeyValue ? `${safeEntry}?v=${cacheKeyValue}` : safeEntry,
        cacheKey: cacheKeyValue
      });
    });
  };
  addEntries('theme-style', manifest.styles && manifest.styles.length ? manifest.styles : ['theme.css']);
  addEntries('theme-module', manifest.modules);
  return edges;
}

function collectRuntimeGraphEdges(rootDir, cacheKeyValue) {
  const edges = [];
  rewriteTargetFiles(rootDir).forEach((file) => {
    const source = readText(rootDir, file);
    collectRefsForVerification(rootDir, file, source).forEach((ref) => {
      edges.push({
        from: ref.from,
        to: ref.to,
        kind: ref.kind,
        specifier: ref.specifier,
        cacheKey: ref.cacheKey
      });
    });
  });
  edges.push(...collectNativeThemeManifestEdges(rootDir, cacheKeyValue));
  return Array.from(
    new Map(edges.map((edge) => [`${edge.from}\0${edge.kind}\0${edge.to}\0${edge.specifier}`, edge])).values()
  ).sort((a, b) => {
    return `${a.from}\0${a.kind}\0${a.to}\0${a.specifier}`.localeCompare(
      `${b.from}\0${b.kind}\0${b.to}\0${b.specifier}`
    );
  });
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
  const edges = collectRuntimeGraphEdges(rootDir, cacheKeyValue);
  const manifest = {
    schemaVersion: 1,
    type: 'press-runtime-assets',
    version: versionValue,
    tag: tagValue,
    cacheKey: cacheKeyValue,
    strategy: 'query-param',
    entries,
    graph: {
      edgeCount: edges.length,
      edges
    }
  };
  writeText(rootDir, RUNTIME_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}
