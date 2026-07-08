#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const [expectedTarball, actualTarball] = process.argv.slice(2);

if (!expectedTarball || !actualTarball) {
  console.error('usage: node scripts/compare-theme-contract-package.mjs <expected.tgz> <actual.tgz>');
  process.exit(2);
}

async function extractTarball(tarball, parent) {
  await fs.mkdir(parent, { recursive: true });
  const result = spawnSync('tar', ['-xzf', tarball, '-C', parent], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`failed to extract ${tarball}:\n${result.stdout}\n${result.stderr}`);
  }
  return path.join(parent, 'package');
}

async function collectFiles(root, prefix = '') {
  const entries = await fs.readdir(path.join(root, prefix), { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...await collectFiles(root, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    } else {
      throw new Error(`unsupported package entry type: ${rel}`);
    }
  }
  return out.sort();
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'press-theme-contract-compare-'));
try {
  const expectedRoot = await extractTarball(expectedTarball, path.join(tempDir, 'expected'));
  const actualRoot = await extractTarball(actualTarball, path.join(tempDir, 'actual'));
  const expectedFiles = await collectFiles(expectedRoot);
  const actualFiles = await collectFiles(actualRoot);
  assert.deepEqual(actualFiles, expectedFiles, 'theme contract package file list differs from the current build');
  for (const file of expectedFiles) {
    const expected = await fs.readFile(path.join(expectedRoot, file));
    const actual = await fs.readFile(path.join(actualRoot, file));
    assert(
      expected.equals(actual),
      `theme contract package file differs from the current build: ${file}`
    );
  }
} finally {
  await fs.rm(tempDir, { recursive: true, force: true });
}
