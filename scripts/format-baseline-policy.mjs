export function evaluateBaselineTransition({ baseFiles, headFiles, changes }) {
  const baseSet = new Set(baseFiles);
  const headSet = new Set(headFiles);
  const exactRenameSources = new Map(
    changes.filter(({ status }) => status === 'R100').map(({ oldPath, newPath }) => [newPath, oldPath])
  );
  const violations = [];

  for (const file of headSet) {
    if (baseSet.has(file)) continue;
    const renameSource = exactRenameSources.get(file);
    if (!renameSource || !baseSet.has(renameSource)) {
      violations.push({ code: 'baseline-growth', file });
    }
  }

  for (const { status, oldPath, newPath } of changes) {
    if (status === 'R100') continue;
    if (!baseSet.has(oldPath)) continue;
    const retainedPath = newPath || oldPath;
    if (headSet.has(retainedPath)) {
      violations.push({ code: 'touched-baseline-retained', file: retainedPath });
    }
  }

  return violations.sort((left, right) => `${left.code}:${left.file}`.localeCompare(`${right.code}:${right.file}`));
}
