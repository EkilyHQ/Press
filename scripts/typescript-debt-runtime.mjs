import { format as formatWithPrettier } from 'prettier';
import ts from 'typescript';

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
