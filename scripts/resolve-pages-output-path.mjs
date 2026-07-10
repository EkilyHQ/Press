#!/usr/bin/env node

import { existsSync, realpathSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

function realpath(value) {
  return typeof realpathSync.native === 'function'
    ? realpathSync.native(value)
    : realpathSync(value);
}

export function canonicalizePath(value, { cwd = process.cwd() } = {}) {
  let current = resolve(cwd, String(value || ''));
  const missing = [];

  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Cannot resolve an existing ancestor for ${value}`);
    }
    missing.unshift(current.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
    current = parent;
  }

  return join(realpath(current), ...missing);
}

function isChildPath(parent, candidate) {
  const value = relative(parent, candidate);
  return Boolean(value)
    && value !== '..'
    && !value.startsWith(`..${sep}`)
    && !isAbsolute(value);
}

export function resolvePagesOutputPath(value, {
  repoRoot,
  homeRoot = homedir(),
  temporaryRoot = tmpdir()
} = {}) {
  const outputPath = canonicalizePath(value);
  const repositoryPath = canonicalizePath(repoRoot);
  const lexicalDistPath = join(repositoryPath, 'dist');
  const distPath = canonicalizePath(lexicalDistPath);
  const temporaryPath = canonicalizePath(temporaryRoot);
  const homePath = homeRoot ? canonicalizePath(homeRoot) : '';

  if (distPath !== lexicalDistPath) {
    throw new Error('Pages artifact dist directory must not resolve through a symlink or path alias');
  }

  if (outputPath === '/'
    || outputPath === repositoryPath
    || outputPath === distPath
    || (homePath && outputPath === homePath)
    || outputPath === temporaryPath) {
    throw new Error('Pages artifact output directory is too broad to remove safely');
  }
  if (isChildPath(repositoryPath, outputPath) && !isChildPath(distPath, outputPath)) {
    throw new Error('Pages artifact output directory inside the repository must be under dist/');
  }
  if (!isChildPath(repositoryPath, outputPath) && !isChildPath(temporaryPath, outputPath)) {
    throw new Error('Pages artifact output directory outside the repository must be under the system temporary directory');
  }

  return outputPath;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    process.stdout.write(resolvePagesOutputPath(process.argv[2], {
      repoRoot: process.argv[3]
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
