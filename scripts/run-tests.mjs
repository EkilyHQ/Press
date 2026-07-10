#!/usr/bin/env node

import { accessSync, constants, readFileSync, readdirSync } from 'node:fs';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const manifestPath = resolve(here, 'test-manifest.json');
const supportedTiers = new Set(['guard', 'release', 'full']);

function usage() {
  return [
    'Usage:',
    '  node scripts/run-tests.mjs --tier <guard|release|full> [--dry-run]',
    '  node scripts/run-tests.mjs --test <id> [--test <id> ...] [--dry-run]',
    '  node scripts/run-tests.mjs --list [--tier <guard|release|full>]',
    '  node scripts/run-tests.mjs --check-manifest',
    '',
    'Tests run serially in isolated child processes. The manifest records tests',
    'that must remain exclusive if parallel execution is added later.'
  ].join('\n');
}

function parseArgs(args) {
  const options = {
    checkManifest: false,
    dryRun: false,
    help: false,
    list: false,
    tests: [],
    tier: ''
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--check' || arg === '--check-manifest') {
      options.checkManifest = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--list') {
      options.list = true;
    } else if (arg === '--test') {
      const id = args[index + 1];
      if (!id || id.startsWith('-')) throw new Error('--test requires an id');
      options.tests.push(id);
      index += 1;
    } else if (arg === '--tier') {
      const tier = args[index + 1];
      if (!tier || tier.startsWith('-')) throw new Error('--tier requires a value');
      if (options.tier) throw new Error('--tier may only be supplied once');
      options.tier = tier;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  if (options.tier && !supportedTiers.has(options.tier)) {
    throw new Error(`unsupported tier: ${options.tier}`);
  }
  if (options.tier && options.tests.length > 0) {
    throw new Error('--tier and --test are mutually exclusive');
  }
  return options;
}

function commandLabel(command) {
  return command.map((part) => {
    if (/^[A-Za-z0-9_./:@=+-]+$/u.test(part)) return part;
    return JSON.stringify(part);
  }).join(' ');
}

function discoverPhysicalTests() {
  return readdirSync(here, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^test-.*\.(?:js|mjs|sh)$/u.test(entry.name))
    .map((entry) => `scripts/${entry.name}`)
    .sort();
}

function loadManifest() {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read ${manifestPath}: ${error.message}`);
  }
  return manifest;
}

function validateStringArray(value, label, failures, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    failures.push(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array`);
    return [];
  }
  const strings = value.filter((item) => typeof item === 'string' && item.trim());
  if (strings.length !== value.length) failures.push(`${label} must contain only non-empty strings`);
  if (new Set(strings).size !== strings.length) failures.push(`${label} must not contain duplicates`);
  return strings;
}

export function validateManifest(manifest) {
  const failures = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('test manifest must be an object');
  }
  if (manifest.schemaVersion !== 1) failures.push('schemaVersion must equal 1');
  if (manifest.timeoutUnit !== 'milliseconds') failures.push('timeoutUnit must equal milliseconds');
  if (!manifest.expected || typeof manifest.expected !== 'object' || Array.isArray(manifest.expected)) {
    failures.push('expected counts must be an object');
  }
  if (!Array.isArray(manifest.tests)) failures.push('tests must be an array');

  const tests = Array.isArray(manifest.tests) ? manifest.tests : [];
  const ids = new Set();
  const coveredFiles = new Map();
  let aliasCount = 0;

  tests.forEach((entry, index) => {
    const label = `tests[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      failures.push(`${label} must be an object`);
      return;
    }
    if (typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/u.test(entry.id)) {
      failures.push(`${label}.id must be a lowercase kebab-case id`);
    } else if (ids.has(entry.id)) {
      failures.push(`duplicate test id: ${entry.id}`);
    } else {
      ids.add(entry.id);
    }
    if (typeof entry.file !== 'string' || !entry.file.startsWith('scripts/test-')) {
      failures.push(`${label}.file must name a scripts/test-* file`);
    }
    const command = validateStringArray(entry.command, `${label}.command`, failures, { allowEmpty: false });
    const tiers = validateStringArray(entry.tier, `${label}.tier`, failures, { allowEmpty: false });
    tiers.forEach((tier) => {
      if (!supportedTiers.has(tier)) failures.push(`${label}.tier contains unsupported tier ${tier}`);
    });
    if (!tiers.includes('full')) failures.push(`${label}.tier must include full`);
    if (!Number.isInteger(entry.timeout) || entry.timeout <= 0) {
      failures.push(`${label}.timeout must be a positive integer in milliseconds`);
    }
    if (typeof entry.exclusive !== 'boolean') failures.push(`${label}.exclusive must be boolean`);
    const requires = validateStringArray(entry.requires, `${label}.requires`, failures, { allowEmpty: false });
    const aliases = validateStringArray(entry.alias, `${label}.alias`, failures);
    aliasCount += aliases.length;
    if (command.length > 0 && requires.length > 0 && !requires.includes(command[0])) {
      failures.push(`${label}.requires must include the command executable ${command[0]}`);
    }
    if (entry.exclusive === true && !requires.includes('git')) {
      failures.push(`${label}.requires must include git for exclusive worktree checks`);
    }
    if (typeof entry.file === 'string' && command.length > 0) {
      const allowedCommands = entry.file.endsWith('.sh')
        ? [['bash', entry.file]]
        : entry.file.endsWith('.mjs')
          ? [['node', entry.file]]
          : [
              ['node', entry.file],
              ['node', '--experimental-default-type=module', entry.file]
            ];
      const isDirectCommand = allowedCommands.some((allowed) => (
        allowed.length === command.length
        && allowed.every((part, commandIndex) => part === command[commandIndex])
      ));
      if (!isDirectCommand) {
        failures.push(`${label}.command must execute its canonical test file directly`);
      }
    }
    [entry.file, ...aliases].forEach((file) => {
      if (typeof file !== 'string') return;
      if (!coveredFiles.has(file)) coveredFiles.set(file, []);
      coveredFiles.get(file).push(entry.id || label);
    });
  });

  coveredFiles.forEach((owners, file) => {
    if (owners.length > 1) failures.push(`${file} is covered by multiple tests: ${owners.join(', ')}`);
  });

  const workflowContractTest = tests.find((entry) => entry.id === 'system-release-workflow');
  if (!workflowContractTest
    || !['guard', 'release'].every((tier) => workflowContractTest.tier.includes(tier))) {
    failures.push('system-release-workflow must remain in both guard and release tiers');
  }

  const physicalTests = discoverPhysicalTests();
  const physicalSet = new Set(physicalTests);
  const coveredSet = new Set(coveredFiles.keys());
  const missing = physicalTests.filter((file) => !coveredSet.has(file));
  const extra = [...coveredSet].filter((file) => !physicalSet.has(file)).sort();
  if (missing.length > 0) failures.push(`manifest is missing physical tests: ${missing.join(', ')}`);
  if (extra.length > 0) failures.push(`manifest names non-test files: ${extra.join(', ')}`);

  const expected = manifest.expected || {};
  if (expected.logical !== tests.length) {
    failures.push(`expected.logical is ${expected.logical}; manifest contains ${tests.length} logical tests`);
  }
  if (expected.physical !== physicalTests.length) {
    failures.push(`expected.physical is ${expected.physical}; scripts contains ${physicalTests.length} physical tests`);
  }
  if (expected.aliases !== aliasCount) {
    failures.push(`expected.aliases is ${expected.aliases}; manifest contains ${aliasCount} aliases`);
  }

  const tierOrder = manifest.tierOrder;
  if (!tierOrder || typeof tierOrder !== 'object' || Array.isArray(tierOrder)) {
    failures.push('tierOrder must be an object');
  } else {
    const unknownTiers = Object.keys(tierOrder).filter((tier) => !['guard', 'release'].includes(tier));
    if (unknownTiers.length > 0) {
      failures.push(`tierOrder has unsupported tiers: ${unknownTiers.join(', ')}`);
    }
    for (const tier of ['guard', 'release']) {
      const order = validateStringArray(tierOrder[tier], `tierOrder.${tier}`, failures, { allowEmpty: false });
      const expectedIds = tests.filter((entry) => Array.isArray(entry.tier) && entry.tier.includes(tier)).map((entry) => entry.id);
      const orderSet = new Set(order);
      const missingIds = expectedIds.filter((id) => !orderSet.has(id));
      const extraIds = order.filter((id) => !expectedIds.includes(id));
      if (missingIds.length > 0) failures.push(`tierOrder.${tier} is missing: ${missingIds.join(', ')}`);
      if (extraIds.length > 0) failures.push(`tierOrder.${tier} has non-${tier} tests: ${extraIds.join(', ')}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`invalid test manifest:\n- ${failures.join('\n- ')}`);
  }
  return {
    aliasCount,
    physicalCount: physicalTests.length,
    tierOrder,
    tests
  };
}

function executableAvailable(command) {
  if (command.includes('/')) {
    try {
      accessSync(resolve(repoRoot, command), constants.X_OK);
      return true;
    } catch (_) {
      return false;
    }
  }
  const pathEntries = String(process.env.PATH || '').split(delimiter).filter(Boolean);
  return pathEntries.some((entry) => {
    try {
      accessSync(resolve(entry, command), constants.X_OK);
      return true;
    } catch (_) {
      return false;
    }
  });
}

function validateRequirements(tests) {
  const required = [...new Set(tests.flatMap((entry) => entry.requires))].sort();
  const missing = required.filter((command) => !executableAvailable(command));
  if (missing.length > 0) throw new Error(`missing required executables: ${missing.join(', ')}`);
}

function readWorktreeStatus() {
  return execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
}

export function selectTests(tests, tierOrder, options) {
  if (options.tests.length > 0) {
    const requested = new Set(options.tests);
    const selected = tests.filter((entry) => requested.has(entry.id));
    const found = new Set(selected.map((entry) => entry.id));
    const missing = [...requested].filter((id) => !found.has(id));
    if (missing.length > 0) throw new Error(`unknown test ids: ${missing.join(', ')}`);
    return selected;
  }
  if (options.tier && options.tier !== 'full' && Array.isArray(tierOrder[options.tier])) {
    const testsById = new Map(tests.map((entry) => [entry.id, entry]));
    return tierOrder[options.tier].map((id) => testsById.get(id));
  }
  if (options.tier) return tests.filter((entry) => entry.tier.includes(options.tier));
  return tests;
}

function listTests(tests) {
  tests.forEach((entry) => {
    const flags = entry.exclusive ? ' exclusive' : '';
    console.log(`${entry.id}\t${entry.tier.join(',')}\t${entry.timeout}ms${flags}\t${commandLabel(entry.command)}`);
  });
}

const supportsProcessGroups = process.platform !== 'win32';
let abortedSignal = '';
let activeChild = null;

function signalProcessTree(child, signal) {
  if (!child || !child.pid) return;
  try {
    if (supportsProcessGroups) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (abortedSignal) return;
    abortedSignal = signal;
    if (activeChild) {
      signalProcessTree(activeChild, signal);
      const interruptedChild = activeChild;
      setTimeout(() => signalProcessTree(interruptedChild, 'SIGKILL'), 5000);
    }
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
  });
}

function runTest(entry, index, total) {
  return new Promise((resolveRun) => {
    const startedAt = Date.now();
    const suffix = entry.exclusive ? ' [exclusive]' : '';
    console.log(`\n[${index + 1}/${total}] ${entry.id}${suffix}`);
    console.log(`$ ${commandLabel(entry.command)}`);

    let timedOut = false;
    let settled = false;
    const child = spawn(entry.command[0], entry.command.slice(1), {
      cwd: repoRoot,
      detached: supportsProcessGroups,
      env: process.env,
      stdio: 'inherit'
    });
    activeChild = child;

    const timeout = setTimeout(() => {
      timedOut = true;
      signalProcessTree(child, 'SIGTERM');
    }, entry.timeout);
    const forceKill = setTimeout(() => {
      if (timedOut) signalProcessTree(child, 'SIGKILL');
    }, entry.timeout + 5000);

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!timedOut) clearTimeout(forceKill);
      activeChild = null;
      resolveRun({ duration: Date.now() - startedAt, error, ok: false, timedOut });
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!timedOut) clearTimeout(forceKill);
      activeChild = null;
      resolveRun({
        code,
        duration: Date.now() - startedAt,
        ok: !timedOut && code === 0,
        signal,
        timedOut
      });
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const validation = validateManifest(loadManifest());
  console.log(`manifest ok: ${validation.tests.length} logical tests, ${validation.physicalCount} physical files, ${validation.aliasCount} alias`);

  if (options.checkManifest && !options.list && !options.dryRun && !options.tier && options.tests.length === 0) return;
  if (!options.list && !options.dryRun && !options.tier && options.tests.length === 0) {
    throw new Error(`choose --tier or --test\n\n${usage()}`);
  }

  const selected = selectTests(validation.tests, validation.tierOrder, options);
  if (selected.length === 0) throw new Error('no tests selected');
  if (options.list || options.dryRun) {
    listTests(selected);
    if (options.dryRun) console.log(`dry run: ${selected.length} tests would run serially`);
    return;
  }

  validateRequirements(selected);
  const suiteStartedAt = Date.now();
  for (let index = 0; index < selected.length; index += 1) {
    if (abortedSignal) {
      console.error(`suite aborted by ${abortedSignal} after ${index}/${selected.length} tests`);
      return;
    }
    const entry = selected[index];
    const worktreeBefore = entry.exclusive ? readWorktreeStatus() : '';
    const result = await runTest(entry, index, selected.length);
    if (entry.exclusive) {
      const worktreeAfter = readWorktreeStatus();
      if (worktreeAfter !== worktreeBefore) {
        result.ok = false;
        result.worktreeChanged = true;
        result.worktreeBefore = worktreeBefore;
        result.worktreeAfter = worktreeAfter;
      }
    }
    if (abortedSignal) {
      if (result.worktreeChanged) {
        console.error(`FAIL ${entry.id}: exclusive test changed the worktree before abort`);
      }
      console.error(`suite aborted by ${abortedSignal} after ${index}/${selected.length} tests`);
      return;
    }
    if (!result.ok) {
      if (result.timedOut) {
        console.error(`FAIL ${entry.id}: timed out after ${entry.timeout}ms`);
      } else if (result.error) {
        console.error(`FAIL ${entry.id}: ${result.error.message}`);
      } else if (!result.worktreeChanged) {
        console.error(`FAIL ${entry.id}: exited ${result.code ?? 'without a code'}${result.signal ? ` (${result.signal})` : ''}`);
      }
      if (result.worktreeChanged) {
        console.error(`FAIL ${entry.id}: exclusive test changed the worktree`);
        console.error(`before:\n${result.worktreeBefore || '(clean)'}after:\n${result.worktreeAfter || '(clean)'}`);
      }
      console.error(`suite stopped after ${index + 1}/${selected.length} tests`);
      process.exitCode = 1;
      return;
    }
    console.log(`PASS ${entry.id} (${result.duration}ms)`);
  }
  console.log(`\nPASS ${selected.length} tests (${Date.now() - suiteStartedAt}ms)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
