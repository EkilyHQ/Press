export const COMPOSER_ROOT_IMPORT_GROUPS = Object.freeze([
  'runtime',
  'shared',
  'state',
  'model',
  'service',
  'action',
  'controller',
  'ui',
  'bootstrap',
  'publish'
]);

export const COMPOSER_ROOT_IMPORT_CONTRACT = Object.freeze([
  Object.freeze({ specifier: './yaml.js', group: 'shared', reason: 'tracked YAML loading and parsing primitives' }),
  Object.freeze({ specifier: './utils.js', group: 'shared', reason: 'shared text escaping helper' }),
  Object.freeze({ specifier: './i18n.js', group: 'runtime', reason: 'editor translation and language labels' }),
  Object.freeze({ specifier: './composer-index-tabs-model.js', group: 'model', reason: 'index and tabs state normalization, diffing, and signatures' }),
  Object.freeze({ specifier: './composer-site-model.js', group: 'model', reason: 'site.yaml normalization, diffing, and serialization helpers' }),
  Object.freeze({ specifier: './editor-storage.js', group: 'state', reason: 'scoped browser storage keys' }),
  Object.freeze({ specifier: './editor-drafts.js', group: 'state', reason: 'scoped draft persistence store' }),
  Object.freeze({ specifier: './editor-session-state.js', group: 'state', reason: 'editor session restore and persistence store' }),
  Object.freeze({ specifier: './composer-runtime.js', group: 'runtime', reason: 'composer browser runtime facade and runtime events' }),
  Object.freeze({ specifier: './composer-action-effects.js', group: 'action', reason: 'named composer action effects boundary' }),
  Object.freeze({ specifier: './composer-controller-graph.js', group: 'bootstrap', reason: 'controller service graph and startup lifecycle composition boundary' }),
  Object.freeze({ specifier: './composer-file-panel-controller.js', group: 'controller', reason: 'composer file panel selection and persistence' }),
  Object.freeze({ specifier: './composer-notifications.js', group: 'ui', reason: 'toast and user notification controller' }),
  Object.freeze({ specifier: './composer-dialogs.js', group: 'ui', reason: 'modal dialogs for composer operations' }),
  Object.freeze({ specifier: './composer-publish-sync-feature.js', group: 'publish', reason: 'publish state, transport settings, remote sync, and propagation composition boundary' }),
  Object.freeze({ specifier: './composer-markdown-feature.js', group: 'controller', reason: 'Markdown feature composition boundary for assets, drafts, loading, actions, and protected-content helpers' }),
  Object.freeze({ specifier: './composer-editor-workspace-feature.js', group: 'controller', reason: 'editor workspace composition boundary for tree state, shell, file tree, and detail panels' }),
  Object.freeze({ specifier: './composer-yaml-site-feature.js', group: 'controller', reason: 'YAML, site settings, index/tabs, diff, draft, and actions feature boundary' }),
  Object.freeze({ specifier: './composer-path-tools.js', group: 'shared', reason: 'content path, language, and default Markdown helpers' }),
  Object.freeze({ specifier: './composer-content-mutations.js', group: 'controller', reason: 'index/tabs/content mutation workflows' }),
  Object.freeze({ specifier: './composer-setup-verifier.js', group: 'service', reason: 'repository setup verification workflow' }),
  Object.freeze({ specifier: './composer-mode-controller.js', group: 'controller', reason: 'editor mode switching and system-mode detection' }),
  Object.freeze({ specifier: './composer-unsynced-summary.js', group: 'controller', reason: 'unsynced summary aggregation and panel state' }),
  Object.freeze({ specifier: './composer-system-theme-bridge.js', group: 'controller', reason: 'system update and Theme Manager staging bridge' }),
  Object.freeze({ specifier: './composer-ui-motion.js', group: 'ui', reason: 'shared composer motion and measurement helpers' }),
  Object.freeze({ specifier: './composer-site-config.js', group: 'service', reason: 'site config fetch, inference, and effective config application' }),
  Object.freeze({ specifier: './composer-markdown-session.js', group: 'controller', reason: 'Markdown tab session state and protection controls' }),
  Object.freeze({ specifier: './composer-markdown-workspace.js', group: 'controller', reason: 'dynamic Markdown workspace controller' }),
]);

function normalizeSpecifier(value) {
  return String(value || '').trim();
}

export function getComposerRootImportContract() {
  return COMPOSER_ROOT_IMPORT_CONTRACT.map((entry) => ({
    specifier: entry.specifier,
    group: entry.group,
    reason: entry.reason
  }));
}

export function getComposerRootImportsByGroup() {
  return COMPOSER_ROOT_IMPORT_GROUPS.reduce((groups, group) => {
    groups[group] = COMPOSER_ROOT_IMPORT_CONTRACT
      .filter(entry => entry.group === group)
      .map(entry => entry.specifier);
    return groups;
  }, {});
}

export function validateComposerRootImportContract(actualImports, contract = COMPOSER_ROOT_IMPORT_CONTRACT) {
  const failures = [];
  const allowedGroups = new Set(COMPOSER_ROOT_IMPORT_GROUPS);
  const actual = Array.isArray(actualImports)
    ? actualImports.map(normalizeSpecifier).filter(Boolean)
    : [];
  const actualSet = new Set(actual);
  const contractEntries = Array.isArray(contract) ? contract : [];
  const contractSpecifiers = new Set();

  if (actualSet.size !== actual.length) {
    failures.push('composer root imports contain duplicate specifiers');
  }

  contractEntries.forEach((entry, index) => {
    const prefix = `composerRootImportContract[${index}]`;
    const specifier = normalizeSpecifier(entry && entry.specifier);
    const group = normalizeSpecifier(entry && entry.group);
    const reason = normalizeSpecifier(entry && entry.reason);
    if (!specifier) {
      failures.push(`${prefix}.specifier is required`);
      return;
    }
    if (contractSpecifiers.has(specifier)) failures.push(`${prefix}.specifier duplicates ${specifier}`);
    contractSpecifiers.add(specifier);
    if (!allowedGroups.has(group)) failures.push(`${prefix}.group must be one of ${COMPOSER_ROOT_IMPORT_GROUPS.join(', ')}`);
    if (!reason) failures.push(`${prefix}.reason is required`);
  });

  actual.forEach((specifier) => {
    if (!contractSpecifiers.has(specifier)) failures.push(`composer root import ${specifier} is not classified`);
  });
  contractSpecifiers.forEach((specifier) => {
    if (!actualSet.has(specifier)) failures.push(`composer root contract entry ${specifier} is stale`);
  });

  return failures;
}
