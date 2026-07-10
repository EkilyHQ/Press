#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseYAML } from '../assets/js/yaml.js';

export const PAGES_EDITOR_EXCLUSION_MARKER = '.press-pages-no-editor';
export const PAGES_EDITOR_ENTRY_PATHS = Object.freeze(['index_editor.html', 'index_editor_preview.html']);
export const PAGES_RUNTIME_MANIFEST_PATH = 'assets/press-runtime-manifest.json';

export function inspectSourcePagesEditorExclusion(sourceRoot) {
  const root = path.resolve(sourceRoot);
  const markerPath = path.join(root, PAGES_EDITOR_EXCLUSION_MARKER);
  if (!pathExists(markerPath)) {
    return Object.freeze({ excludeEditor: false, reason: 'marker-absent' });
  }

  assertTrackedRegularFile(root, PAGES_EDITOR_EXCLUSION_MARKER, 'Pages editor exclusion marker');
  assertTrackedRegularFile(root, 'site.yaml', 'site.yaml');
  const editorEntryEnabled = readExplicitEditorEntryEnabled(path.join(root, 'site.yaml'));
  if (editorEntryEnabled !== false) {
    throw new Error(
      `${PAGES_EDITOR_EXCLUSION_MARKER} requires site.yaml to explicitly set features.editorEntry.enabled: false`
    );
  }
  return Object.freeze({ excludeEditor: true, reason: 'tracked-marker-and-disabled-feature' });
}

export function inspectArtifactPagesEditorExclusion(pagesRoot) {
  const root = path.resolve(pagesRoot);
  const markerPath = path.join(root, PAGES_EDITOR_EXCLUSION_MARKER);
  if (!pathExists(markerPath)) {
    return Object.freeze({ excludeEditor: false, reason: 'marker-absent' });
  }

  assertRegularFile(markerPath, 'Pages editor exclusion marker');
  const sitePath = path.join(root, 'site.yaml');
  assertRegularFile(sitePath, 'Pages artifact site.yaml');
  const editorEntryEnabled = readExplicitEditorEntryEnabled(sitePath);
  if (editorEntryEnabled !== false) {
    throw new Error(
      `${PAGES_EDITOR_EXCLUSION_MARKER} requires site.yaml to explicitly set features.editorEntry.enabled: false`
    );
  }
  return Object.freeze({ excludeEditor: true, reason: 'artifact-marker-and-disabled-feature' });
}

export function projectPagesRuntimeManifestWithoutEditor(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('runtime manifest must be an object before editor projection');
  }
  if (!Array.isArray(manifest.entries)) {
    throw new Error('runtime manifest entries must be an array before editor projection');
  }
  const graph = manifest.graph;
  if (!graph || typeof graph !== 'object' || Array.isArray(graph) || !Array.isArray(graph.edges)) {
    throw new Error('runtime manifest graph edges must be an array before editor projection');
  }
  if (graph.edgeCount !== graph.edges.length) {
    throw new Error('runtime manifest graph edgeCount must match its edge inventory before editor projection');
  }

  const omitted = new Set(PAGES_EDITOR_ENTRY_PATHS);
  for (const editorPath of omitted) {
    const entryCount = manifest.entries.filter((entry) => entry && entry.path === editorPath).length;
    if (entryCount !== 1) {
      throw new Error(`runtime manifest must inventory ${editorPath} exactly once before editor projection`);
    }
  }
  const incoming = graph.edges.find((edge) => edge && omitted.has(edge.to) && !omitted.has(edge.from));
  if (incoming) {
    throw new Error(
      `runtime manifest cannot project an incoming editor edge: ${incoming.from || '<unknown>'} -> ${incoming.to}`
    );
  }

  const entries = manifest.entries.filter((entry) => !omitted.has(entry && entry.path));
  const edges = graph.edges.filter((edge) => !omitted.has(edge && edge.from));
  return {
    ...manifest,
    entries,
    graph: {
      ...graph,
      edgeCount: edges.length,
      edges
    }
  };
}

export function applyPagesEditorExclusion({ sourceRoot, pagesRoot }) {
  const source = path.resolve(sourceRoot);
  const pages = path.resolve(pagesRoot);
  const policy = inspectSourcePagesEditorExclusion(source);
  if (!policy.excludeEditor) return policy;

  const artifactPolicy = inspectArtifactPagesEditorExclusion(pages);
  if (!artifactPolicy.excludeEditor) {
    throw new Error('Pages artifact did not retain the tracked editor exclusion marker');
  }
  for (const editorPath of PAGES_EDITOR_ENTRY_PATHS) {
    assertRegularFile(path.join(pages, editorPath), `Pages artifact ${editorPath}`);
  }

  const manifestPath = path.join(pages, PAGES_RUNTIME_MANIFEST_PATH);
  assertRegularFile(manifestPath, 'Pages runtime manifest');
  const manifest = readJson(manifestPath, 'Pages runtime manifest');
  const projected = projectPagesRuntimeManifestWithoutEditor(manifest);

  for (const editorPath of PAGES_EDITOR_ENTRY_PATHS) {
    fs.rmSync(path.join(pages, editorPath));
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(projected, null, 2)}\n`);
  return policy;
}

export function readExplicitEditorEntryEnabled(sitePath) {
  const source = fs.readFileSync(sitePath, 'utf8');
  if (source.includes('\0')) throw new Error('site.yaml must not contain NUL bytes');
  const lines = normalizeYamlLines(source);
  const features = findDirectMapping(lines, -1, 'features', 'site.yaml');
  if (!features) return undefined;

  let lexicalValue;
  if (features.rest) {
    throw new Error('site.yaml features must use a block mapping for Pages editor exclusion');
  } else {
    const editorEntry = findDirectMapping(lines, features.index, 'editorEntry', 'site.yaml features');
    if (!editorEntry) return undefined;
    if (editorEntry.rest) {
      throw new Error('site.yaml features.editorEntry must use a block mapping for Pages editor exclusion');
    } else {
      const enabled = findDirectMapping(lines, editorEntry.index, 'enabled', 'site.yaml features.editorEntry');
      if (!enabled || !enabled.rest) return undefined;
      lexicalValue = parseStrictBoolean(enabled.rest, 'site.yaml features.editorEntry.enabled');
    }
  }

  if (typeof lexicalValue !== 'boolean') {
    throw new Error('site.yaml features.editorEntry.enabled must be a boolean');
  }
  const runtimeValue = parseYAML(source)?.features?.editorEntry?.enabled;
  if (runtimeValue !== lexicalValue) {
    throw new Error('site.yaml Pages editor exclusion policy must agree with the Press runtime YAML parser');
  }
  return lexicalValue;
}

function normalizeYamlLines(source) {
  return String(source || '')
    .replace(/^\uFEFF/u, '')
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((raw, index) => {
      const leading = raw.match(/^[ \t]*/u)[0];
      if (leading.includes('\t')) {
        throw new Error(`site.yaml line ${index + 1} must not use tabs for indentation`);
      }
      const text = stripYamlComment(raw).trimEnd();
      return {
        index,
        indent: text.match(/^ */u)[0].length,
        content: text.trim()
      };
    });
}

function stripYamlComment(raw) {
  let single = false;
  let double = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (double && char === '\\') {
      escaped = true;
      continue;
    }
    if (!double && char === "'") single = !single;
    else if (!single && char === '"') double = !double;
    else if (!single && !double && char === '#') return raw.slice(0, index);
  }
  return raw;
}

function parseMappingLine(line, label) {
  const match = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/u.exec(line.content);
  if (!match) throw new Error(`${label} contains malformed mapping syntax on line ${line.index + 1}`);
  return { key: match[1], rest: match[2].trim() };
}

function findDirectMapping(lines, parentIndex, key, label) {
  const parentIndent = parentIndex < 0 ? -1 : lines[parentIndex].indent;
  const blockStart = parentIndex + 1;
  let blockEnd = lines.length;
  if (parentIndex >= 0) {
    for (let index = blockStart; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.content) continue;
      if (line.indent <= parentIndent) {
        blockEnd = index;
        break;
      }
    }
  }

  const candidates = lines.slice(blockStart, blockEnd).filter((line) => line.content);
  if (!candidates.length) return undefined;
  const directIndent = parentIndex < 0 ? 0 : candidates[0].indent;
  const inconsistent = candidates.find((line) => line.indent > parentIndent && line.indent < directIndent);
  if (inconsistent) {
    throw new Error(`${label} contains inconsistent indentation on line ${inconsistent.index + 1}`);
  }
  const direct = candidates.filter((line) => line.indent === directIndent);
  const matches = [];
  for (const line of direct) {
    const mapping = parseMappingLine(line, label);
    if (mapping.key === key) matches.push({ ...mapping, index: line.index, indent: line.indent });
  }
  if (matches.length > 1) throw new Error(`${label} must not define ${key} more than once`);
  return matches[0];
}

function parseStrictBoolean(value, label) {
  if (/^false$/iu.test(value)) return false;
  if (/^true$/iu.test(value)) return true;
  throw new Error(`${label} must be the boolean true or false`);
}

function assertTrackedRegularFile(root, relPath, label) {
  const fullPath = path.join(root, relPath);
  assertRegularFile(fullPath, label);
  const output = execFileSync('git', ['-C', root, 'ls-files', '--stage', '--', relPath], {
    encoding: 'utf8'
  }).trim();
  const records = output.split('\n').filter(Boolean);
  if (records.length !== 1 || !/^100(?:644|755)\s+[0-9a-f]+\s+0\t/u.test(records[0])) {
    throw new Error(`${label} must be a tracked regular file: ${relPath}`);
  }
}

function assertRegularFile(file, label) {
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (error) {
    if (error && error.code === 'ENOENT') throw new Error(`${label} is missing`, { cause: error });
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular file`);
  }
}

function pathExists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, { cause: error });
  }
}

function parseArgs(args) {
  const options = { sourceRoot: '', pagesRoot: '' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--source-root') options.sourceRoot = args[++index] || '';
    else if (arg === '--pages-root') options.pagesRoot = args[++index] || '';
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.sourceRoot || !options.pagesRoot) {
    throw new Error('usage: node scripts/pages-editor-exclusion.mjs --source-root <repo> --pages-root <artifact>');
  }
  return options;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const policy = applyPagesEditorExclusion(options);
    console.log(`Pages editor artifact policy: ${policy.excludeEditor ? 'excluded' : 'included'} (${policy.reason})`);
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }
}
