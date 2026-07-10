import { createHash } from 'node:crypto';
import { format as formatWithPrettier } from 'prettier';
import ts from 'typescript';

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

export function formatBaselineJson(baseline) {
  return formatWithPrettier(JSON.stringify(baseline), { parser: 'json' });
}

export function collectTypeScriptSuppressions(sourceFile, repositoryPath = sourceFile.fileName) {
  const suppressions = [];
  for (const directive of sourceFile.commentDirectives || []) {
    let name;
    if (directive.type === ts.CommentDirectiveType.Ignore) name = '@ts-ignore';
    else if (directive.type === ts.CommentDirectiveType.ExpectError) name = '@ts-expect-error';
    else throw new Error(`unsupported TypeScript comment directive type ${directive.type} in ${repositoryPath}`);
    const location = sourceFile.getLineAndCharacterOfPosition(directive.range.pos);
    suppressions.push({
      path: repositoryPath,
      directive: name,
      line: location.line + 1,
      column: location.character + 1,
      position: directive.range.pos
    });
  }

  if (sourceFile.checkJsDirective?.enabled === false) {
    const location = sourceFile.getLineAndCharacterOfPosition(sourceFile.checkJsDirective.pos);
    suppressions.push({
      path: repositoryPath,
      directive: '@ts-nocheck',
      line: location.line + 1,
      column: location.character + 1,
      position: sourceFile.checkJsDirective.pos
    });
  }

  return suppressions.sort((left, right) => left.position - right.position);
}

export function assertNoTypeScriptSuppressions(suppressions) {
  if (suppressions.length === 0) return;
  const details = suppressions
    .slice(0, 20)
    .map(({ path, directive, line, column }) => `${path}:${line}:${column} ${directive}`);
  const remainder = suppressions.length > details.length ? `\n- ... ${suppressions.length - details.length} more` : '';
  throw new Error(
    `TypeScript suppression directives are prohibited; fix the underlying diagnostics:\n- ${details.join('\n- ')}${remainder}`
  );
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
