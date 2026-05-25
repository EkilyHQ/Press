#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const RUNTIME_MANIFEST_PATH = 'assets/press-runtime-manifest.json';
const REQUIRED_PAGES_FILES = Object.freeze([
  '.nojekyll',
  'site.yaml',
  'assets/press-system.json',
  'assets/themes/packs.json',
  'wwwroot/index.yaml'
]);
const FORBIDDEN_PAGES_PATHS = Object.freeze([
  'site.local.yaml',
  'site.local.yml',
  'assets/themes/packs.local.json',
  'wwwroot.local'
]);
const FORBIDDEN_SYSTEM_PATHS = Object.freeze([
  'site.yaml',
  'assets/themes/packs.json',
  'wwwroot'
]);

const options = parseArgs(process.argv.slice(2));
if (options.help) usage(0);
if (!options.pagesRoot || !options.systemArchive) usage();

const pagesRoot = path.resolve(options.pagesRoot);
const systemArchive = path.resolve(options.systemArchive);

verifyPagesArtifact({ pagesRoot, systemArchive, explicitTag: options.tag });

function usage(exitCode = 2) {
  const out = exitCode ? console.error : console.log;
  out('usage: node scripts/verify-pages-artifact.mjs --pages-root <dir> --system-archive <zip> [--tag vX.Y.Z]');
  process.exit(exitCode);
}

function parseArgs(args) {
  const parsed = {
    help: false,
    pagesRoot: '',
    systemArchive: '',
    tag: ''
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--pages-root') {
      i += 1;
      parsed.pagesRoot = args[i] || '';
    } else if (arg === '--system-archive') {
      i += 1;
      parsed.systemArchive = args[i] || '';
    } else if (arg === '--tag') {
      i += 1;
      parsed.tag = args[i] || '';
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else {
      usage();
    }
  }
  if (parsed.tag && !/^v\d+\.\d+\.\d+$/.test(parsed.tag)) {
    console.error(`invalid release tag: ${parsed.tag}`);
    process.exit(2);
  }
  return parsed;
}

function verifyPagesArtifact({ pagesRoot, systemArchive, explicitTag = '' }) {
  assertDirectory(pagesRoot, 'Pages artifact root');
  assertFile(systemArchive, 'system archive');

  const system = readJson(path.join(pagesRoot, 'assets/press-system.json'));
  const version = String(system.version || '').trim();
  const tag = String(system.tag || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version) || tag !== `v${version}`) {
    throw new Error('Pages artifact assets/press-system.json must declare matching version and tag');
  }
  if (explicitTag && explicitTag !== tag) {
    throw new Error(`Pages artifact tag ${tag} must match expected tag ${explicitTag}`);
  }

  REQUIRED_PAGES_FILES.forEach((relPath) => assertExists(path.join(pagesRoot, relPath), `Pages artifact must include ${relPath}`));
  FORBIDDEN_PAGES_PATHS.forEach((relPath) => assertNotExists(path.join(pagesRoot, relPath), `Pages artifact must not include ${relPath}`));

  const packageRoot = `press-system-${tag}`;
  const archiveEntries = listZipEntries(systemArchive);
  FORBIDDEN_SYSTEM_PATHS.forEach((relPath) => {
    const prefix = `${packageRoot}/${relPath}`;
    if (archiveEntries.some((entry) => entry === prefix || entry.startsWith(`${prefix}/`))) {
      throw new Error(`system archive must not include Pages-owned path ${relPath}`);
    }
  });

  const pagesRuntimeManifest = readJson(path.join(pagesRoot, RUNTIME_MANIFEST_PATH));
  const systemRuntimeManifest = JSON.parse(readZipText(systemArchive, `${packageRoot}/${RUNTIME_MANIFEST_PATH}`));
  assert.deepEqual(pagesRuntimeManifest, systemRuntimeManifest, 'Pages and system archive runtime manifests must match');

  verifyRuntimeManifest(pagesRoot, pagesRuntimeManifest, tag);
  console.log('ok - pages artifact');
}

function verifyRuntimeManifest(rootDir, manifest, tag) {
  const expectedCacheKey = `press-system-${tag}`;
  if (manifest.schemaVersion !== 1 || manifest.type !== 'press-runtime-assets') {
    throw new Error('runtime manifest must use the press-runtime-assets schema');
  }
  if (manifest.tag !== tag || manifest.version !== tag.slice(1) || manifest.cacheKey !== expectedCacheKey) {
    throw new Error('runtime manifest version, tag, and cacheKey must match the Pages artifact tag');
  }
  if (manifest.strategy !== 'query-param') {
    throw new Error('runtime manifest must use query-param cache strategy');
  }

  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const graph = manifest.graph && typeof manifest.graph === 'object' ? manifest.graph : {};
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  if (!entries.length || !edges.length || graph.edgeCount !== edges.length) {
    throw new Error('runtime manifest must include file inventory and materialized asset graph edges');
  }

  const entryPaths = new Set();
  entries.forEach((entry) => {
    const relPath = normalizeRelPath(entry.path);
    if (!relPath) throw new Error('runtime manifest entry path is required');
    if (entryPaths.has(relPath)) throw new Error(`runtime manifest duplicate entry: ${relPath}`);
    entryPaths.add(relPath);
    const file = path.join(rootDir, relPath);
    assertFile(file, `runtime manifest entry ${relPath}`);
    const stat = fs.statSync(file);
    if (Number(entry.size) !== stat.size) {
      throw new Error(`runtime manifest size mismatch for ${relPath}`);
    }
    const digest = sha256File(file);
    if (String(entry.sha256 || '').toLowerCase() !== digest) {
      throw new Error(`runtime manifest sha256 mismatch for ${relPath}`);
    }
  });

  edges.forEach((edge) => {
    const from = normalizeRelPath(edge.from);
    const to = normalizeRelPath(edge.to);
    if (!entryPaths.has(from)) throw new Error(`runtime graph edge source is not inventoried: ${from}`);
    if (!entryPaths.has(to)) throw new Error(`runtime graph edge target is not inventoried: ${to}`);
    if (edge.cacheKey !== expectedCacheKey) {
      throw new Error(`runtime graph edge has stale cache key: ${from} -> ${to}`);
    }
    if (!String(edge.specifier || '').includes(`v=${expectedCacheKey}`)) {
      throw new Error(`runtime graph edge is missing materialized cache key: ${from} -> ${to}`);
    }
  });
}

function normalizeRelPath(value) {
  const clean = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!clean || clean.includes('\0')) return '';
  const parts = clean.split('/');
  if (parts.some((part) => part === '.' || part === '..')) return '';
  return clean;
}

function assertDirectory(file, label) {
  if (!fs.existsSync(file) || !fs.statSync(file).isDirectory()) {
    throw new Error(`${label} must exist and be a directory`);
  }
}

function assertFile(file, label) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`${label} must exist and be a file`);
  }
}

function assertExists(file, message) {
  if (!fs.existsSync(file)) throw new Error(message);
}

function assertNotExists(file, message) {
  if (fs.existsSync(file)) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listZipEntries(file) {
  return execFileSync('unzip', ['-Z1', file], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
}

function readZipText(file, entry) {
  return execFileSync('unzip', ['-p', file, entry], { encoding: 'utf8' });
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
