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
  Object.freeze({ specifier: './composer-markdown-save.js', group: 'service', reason: 'manual Markdown save state for toolbar and dirty-state coordination' }),
  Object.freeze({ specifier: './yaml.js', group: 'shared', reason: 'tracked YAML loading and parsing primitives' }),
  Object.freeze({ specifier: './utils.js', group: 'shared', reason: 'shared text escaping helper' }),
  Object.freeze({ specifier: './i18n.js', group: 'runtime', reason: 'editor translation and language labels' }),
  Object.freeze({ specifier: './editor-content-tree.js', group: 'model', reason: 'content tree lookup helpers used by the root tree controller' }),
  Object.freeze({ specifier: './encrypted-content.js', group: 'service', reason: 'protected Markdown document encode/decode path' }),
  Object.freeze({ specifier: './composer-publish-state-service.js', group: 'publish', reason: 'post-publish baseline and local-state reconciliation' }),
  Object.freeze({ specifier: './composer-index-tabs-model.js', group: 'model', reason: 'index and tabs state normalization, diffing, and signatures' }),
  Object.freeze({ specifier: './composer-site-model.js', group: 'model', reason: 'site.yaml normalization, diffing, and serialization helpers' }),
  Object.freeze({ specifier: './editor-storage.js', group: 'state', reason: 'scoped browser storage keys' }),
  Object.freeze({ specifier: './editor-drafts.js', group: 'state', reason: 'scoped draft persistence store' }),
  Object.freeze({ specifier: './editor-session-state.js', group: 'state', reason: 'editor session restore and persistence store' }),
  Object.freeze({ specifier: './composer-runtime.js', group: 'runtime', reason: 'composer browser runtime facade and runtime events' }),
  Object.freeze({ specifier: './composer-service-registry.js', group: 'service', reason: 'late-bound composer service registry' }),
  Object.freeze({ specifier: './composer-app-services.js', group: 'service', reason: 'composer service lifecycle plan and initialization guard' }),
  Object.freeze({ specifier: './composer-action-effects.js', group: 'action', reason: 'named composer action effects boundary' }),
  Object.freeze({ specifier: './composer-markdown-workspace-facade.js', group: 'service', reason: 'narrow facade over late-bound Markdown workspace services' }),
  Object.freeze({ specifier: './composer-yaml-serialization.js', group: 'model', reason: 'YAML serialization and language ordering boundary' }),
  Object.freeze({ specifier: './composer-editor-tree-state.js', group: 'model', reason: 'editor tree projection and status aggregation boundary' }),
  Object.freeze({ specifier: './composer-file-panel-controller.js', group: 'controller', reason: 'composer file panel selection and persistence' }),
  Object.freeze({ specifier: './composer-publish-service.js', group: 'publish', reason: 'publish settings, summary, overlay, and commit-flow composition' }),
  Object.freeze({ specifier: './composer-notifications.js', group: 'ui', reason: 'toast and user notification controller' }),
  Object.freeze({ specifier: './composer-dialogs.js', group: 'ui', reason: 'modal dialogs for composer operations' }),
  Object.freeze({ specifier: './composer-remote-sync.js', group: 'publish', reason: 'remote baseline and propagation watcher coordination' }),
  Object.freeze({ specifier: './composer-diff-ui.js', group: 'ui', reason: 'YAML diff marker and review UI boundary' }),
  Object.freeze({ specifier: './composer-order-diff-ui.js', group: 'ui', reason: 'order diff modal UI boundary' }),
  Object.freeze({ specifier: './composer-index-tabs-ui.js', group: 'ui', reason: 'index/tabs YAML panel rendering and bindings' }),
  Object.freeze({ specifier: './composer-site-settings-ui.js', group: 'ui', reason: 'site settings section composition' }),
  Object.freeze({ specifier: './composer-yaml-panels-controller.js', group: 'controller', reason: 'YAML panel rebuild and section controller' }),
  Object.freeze({ specifier: './composer-markdown-assets.js', group: 'service', reason: 'Markdown asset staging and reference reconciliation' }),
  Object.freeze({ specifier: './composer-editor-shell.js', group: 'ui', reason: 'editor shell, overlay, rail, and layout controls' }),
  Object.freeze({ specifier: './composer-editor-detail-panel-controller.js', group: 'controller', reason: 'editor detail panel routing and rendering' }),
  Object.freeze({ specifier: './composer-path-tools.js', group: 'shared', reason: 'content path, language, and default Markdown helpers' }),
  Object.freeze({ specifier: './composer-content-mutations.js', group: 'controller', reason: 'index/tabs/content mutation workflows' }),
  Object.freeze({ specifier: './composer-setup-verifier.js', group: 'service', reason: 'repository setup verification workflow' }),
  Object.freeze({ specifier: './composer-mode-controller.js', group: 'controller', reason: 'editor mode switching and system-mode detection' }),
  Object.freeze({ specifier: './composer-unsynced-summary.js', group: 'controller', reason: 'unsynced summary aggregation and panel state' }),
  Object.freeze({ specifier: './composer-runtime-styles.js', group: 'runtime', reason: 'runtime style injection for composer UI' }),
  Object.freeze({ specifier: './composer-system-theme-bridge.js', group: 'controller', reason: 'system update and Theme Manager staging bridge' }),
  Object.freeze({ specifier: './composer-bootstrap.js', group: 'bootstrap', reason: 'DOM-ready toolbar, initial state, and workspace assembly lifecycle' }),
  Object.freeze({ specifier: './composer-ui-motion.js', group: 'ui', reason: 'shared composer motion and measurement helpers' }),
  Object.freeze({ specifier: './composer-site-config.js', group: 'service', reason: 'site config fetch, inference, and effective config application' }),
  Object.freeze({ specifier: './composer-yaml-actions.js', group: 'controller', reason: 'discard and refresh workflows for YAML-backed state' }),
  Object.freeze({ specifier: './editor-content-tree-controller.js', group: 'controller', reason: 'content tree controller and selection routing' }),
  Object.freeze({ specifier: './composer-markdown-loader.js', group: 'service', reason: 'Markdown tab content loading' }),
  Object.freeze({ specifier: './composer-markdown-actions-ui.js', group: 'ui', reason: 'Markdown tab action button state and labels' }),
  Object.freeze({ specifier: './composer-markdown-actions.js', group: 'controller', reason: 'Markdown tab action workflows' }),
  Object.freeze({ specifier: './composer-markdown-drafts.js', group: 'state', reason: 'Markdown draft persistence controller' }),
  Object.freeze({ specifier: './composer-markdown-session.js', group: 'controller', reason: 'Markdown tab session state and protection controls' }),
  Object.freeze({ specifier: './composer-markdown-workspace.js', group: 'controller', reason: 'dynamic Markdown workspace controller' }),
  Object.freeze({ specifier: './composer-yaml-drafts.js', group: 'state', reason: 'YAML draft persistence and timers' }),
  Object.freeze({ specifier: './composer-markdown-state.js', group: 'model', reason: 'Markdown state signatures, protection, and draft normalization' }),
  Object.freeze({ specifier: './editor-file-tree-ui.js', group: 'ui', reason: 'left rail file tree rendering and interactions' }),
  Object.freeze({ specifier: './editor-structure-panel-ui.js', group: 'ui', reason: 'right-side structure/detail panel rendering' }),
  Object.freeze({ specifier: './publish/settings-store.js', group: 'publish', reason: 'publish transport settings and Connect presets' })
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
