import { createHash } from 'node:crypto';

export const TYPESCRIPT_DEBT_SCHEMA_VERSION = 1;

export const TYPESCRIPT_COMPILER_OPTION_RECORD = Object.freeze({
  allowJs: true,
  checkJs: true,
  noEmit: true,
  skipLibCheck: true,
  target: 'ES2023',
  module: 'Preserve',
  moduleResolution: 'Bundler',
  lib: ['ES2023', 'DOM', 'DOM.Iterable']
});

function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function compareDiagnosticEntries(left, right) {
  return compareStrings(left.path, right.path) || left.code - right.code || compareStrings(left.message, right.message);
}

export function diagnosticIdentity({ path, code, message }) {
  return JSON.stringify([path, code, message]);
}

export function fingerprintRootFiles(rootFiles) {
  return createHash('sha256')
    .update(`${rootFiles.join('\n')}\n`)
    .digest('hex');
}

export function evaluateDiagnosticTransition({ baseEntries, headEntries }) {
  const base = new Map(baseEntries.map((entry) => [diagnosticIdentity(entry), entry]));
  const violations = [];

  for (const entry of headEntries) {
    const previous = base.get(diagnosticIdentity(entry));
    if (!previous) {
      violations.push({ code: 'new-diagnostic-key', entry });
    } else if (entry.count > previous.count) {
      violations.push({
        code: 'diagnostic-count-growth',
        entry,
        previousCount: previous.count
      });
    }
  }

  return violations;
}

export function validateDiagnosticEntries(entries) {
  if (!Array.isArray(entries)) throw new Error('diagnosticMultiset must be an array');

  const seen = new Set();
  let previous = null;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('diagnosticMultiset entries must be objects');
    }
    if (typeof entry.path !== 'string' || entry.path.length === 0 || entry.path.includes('\\')) {
      throw new Error('diagnostic paths must be non-empty normalized repository paths');
    }
    if (!Number.isInteger(entry.code) || entry.code <= 0) {
      throw new Error(`diagnostic code must be a positive integer: ${entry.path}`);
    }
    if (typeof entry.message !== 'string' || entry.message.length === 0 || /[\r\n]/.test(entry.message)) {
      throw new Error(`diagnostic messages must be non-empty and flattened: ${entry.path} TS${entry.code}`);
    }
    if (!Number.isInteger(entry.count) || entry.count <= 0) {
      throw new Error(`diagnostic count must be a positive integer: ${entry.path} TS${entry.code}`);
    }

    const identity = diagnosticIdentity(entry);
    if (seen.has(identity)) throw new Error(`duplicate diagnostic key: ${identity}`);
    seen.add(identity);
    if (previous && compareDiagnosticEntries(previous, entry) >= 0) {
      throw new Error('diagnosticMultiset must be strictly sorted by path, code, and message');
    }
    previous = entry;
  }
}
