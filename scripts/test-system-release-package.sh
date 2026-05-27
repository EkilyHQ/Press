#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
tmp_dir="$(mktemp -d)"
untracked_probe=""
tracked_probe=""
tracked_backup=""

cleanup() {
  if [[ -n "${tracked_probe}" && -n "${tracked_backup}" && -f "${tracked_backup}" ]]; then
    cp "${tracked_backup}" "${tracked_probe}"
  fi
  if [[ -n "${untracked_probe}" ]]; then
    rm -f "${untracked_probe}"
  fi
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

version="$(PRESS_REPO_ROOT="${repo_root}" node -e "const manifest = require(process.env.PRESS_REPO_ROOT + '/assets/press-system.json'); const version = String(manifest.version || '').trim(); const tag = String(manifest.tag || '').trim(); if (!/^\\d+\\.\\d+\\.\\d+$/.test(version) || tag !== \`v\${version}\`) { throw new Error('assets/press-system.json must declare matching version and tag'); } process.stdout.write(tag);")"
zip_path="${tmp_dir}/press-system-${version}.zip"
package_root="press-system-${version}"

bash "${repo_root}/scripts/package-system-release.sh" "${version}" "${tmp_dir}" >/dev/null

if [[ ! -f "${zip_path}" ]]; then
  echo "expected package at ${zip_path}" >&2
  exit 1
fi

subdir_zip_dir="${tmp_dir}/subdir"
mkdir -p "${subdir_zip_dir}"
(
  cd "${repo_root}/assets/js"
  bash "${repo_root}/scripts/package-system-release.sh" "${version}" "${subdir_zip_dir}" >/dev/null
)
if [[ ! -f "${subdir_zip_dir}/press-system-${version}.zip" ]]; then
  echo "expected package script to work from a repository subdirectory" >&2
  exit 1
fi

entries_file="${tmp_dir}/entries.txt"
unzip -Z1 "${zip_path}" | sed '/\/$/d' > "${entries_file}"

if ! grep -qx "press-system-${version}/index.html" "${entries_file}"; then
  echo "expected package to include index.html" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/index_editor.html" "${entries_file}"; then
  echo "expected package to include index_editor.html" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/index_editor_preview.html" "${entries_file}"; then
  echo "expected package to include index_editor_preview.html" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/press-system.json" "${entries_file}"; then
  echo "expected package to include the Press system version manifest" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/press-runtime-manifest.json" "${entries_file}"; then
  echo "expected package to include the generated runtime asset manifest" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/system-updates.js" "${entries_file}"; then
  echo "expected package to include system updater code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/provider-adapters.js" "${entries_file}"; then
  echo "expected package to include provider adapter code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/press-system-surface.mjs" "${entries_file}"; then
  echo "expected package to include the shared Press system surface contract" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/theme-contract-surface.mjs" "${entries_file}"; then
  echo "expected package to include the shared Press theme contract surface" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/theme-manager.js" "${entries_file}"; then
  echo "expected package to include theme manager code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/theme-manager-data.js" "${entries_file}"; then
  echo "expected package to include theme manager data code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/theme-manager-staging.js" "${entries_file}"; then
  echo "expected package to include theme manager staging code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/theme-manager-view.js" "${entries_file}"; then
  echo "expected package to include theme manager view code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/theme-package-core.js" "${entries_file}"; then
  echo "expected package to include theme package core code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/theme-install-service.js" "${entries_file}"; then
  echo "expected package to include theme install service code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/encrypted-content.js" "${entries_file}"; then
  echo "expected package to include encrypted article runtime code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-index-tabs-model.js" "${entries_file}"; then
  echo "expected package to include composer index/tabs model code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-model.js" "${entries_file}"; then
  echo "expected package to include composer site model code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-diff-ui.js" "${entries_file}"; then
  echo "expected package to include composer diff UI code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-diff-review-views.js" "${entries_file}"; then
  echo "expected package to include composer diff review views code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-order-diff-ui.js" "${entries_file}"; then
  echo "expected package to include composer order diff UI code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-order-preview.js" "${entries_file}"; then
  echo "expected package to include composer order preview code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-order-review-view.js" "${entries_file}"; then
  echo "expected package to include composer order review view code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-order-visual.js" "${entries_file}"; then
  echo "expected package to include composer order visual code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-index-tabs-ui.js" "${entries_file}"; then
  echo "expected package to include composer index/tabs UI code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-drag-list.js" "${entries_file}"; then
  echo "expected package to include composer drag list code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-index-version-list.js" "${entries_file}"; then
  echo "expected package to include composer index version list code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-index-tabs-language-menu.js" "${entries_file}"; then
  echo "expected package to include composer index/tabs language menu code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-ui.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings UI code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-repo-section.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings repository section code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-single-grids.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings single-grid code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-config-grids.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings config grids code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-controls.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings controls code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-language-menu.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings language-menu code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-link-list.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings link-list code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-localized-fields.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings localized-fields code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-schema.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings schema code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-settings-section-nav.js" "${entries_file}"; then
  echo "expected package to include composer Site Settings section-nav code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-assets.js" "${entries_file}"; then
  echo "expected package to include composer Markdown asset manager code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-action-effects.js" "${entries_file}"; then
  echo "expected package to include composer action effects boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-root-contract.js" "${entries_file}"; then
  echo "expected package to include composer root contract code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-workspace-facade.js" "${entries_file}"; then
  echo "expected package to include composer Markdown workspace facade code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-yaml-serialization.js" "${entries_file}"; then
  echo "expected package to include composer YAML serialization boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-editor-tree-state.js" "${entries_file}"; then
  echo "expected package to include composer editor tree state boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-editor-shell.js" "${entries_file}"; then
  echo "expected package to include composer editor shell code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-path-tools.js" "${entries_file}"; then
  echo "expected package to include composer path tools code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-content-mutations.js" "${entries_file}"; then
  echo "expected package to include composer content mutation controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-setup-verifier.js" "${entries_file}"; then
  echo "expected package to include composer setup verifier code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-mode-controller.js" "${entries_file}"; then
  echo "expected package to include composer mode controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-unsynced-summary.js" "${entries_file}"; then
  echo "expected package to include composer unsynced summary controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-runtime-styles.js" "${entries_file}"; then
  echo "expected package to include composer runtime style code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-runtime.js" "${entries_file}"; then
  echo "expected package to include composer runtime boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-app-runtime.js" "${entries_file}"; then
  echo "expected package to include explicit editor app runtime code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-effects.js" "${entries_file}"; then
  echo "expected package to include shared editor effects boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-boot-runtime.js" "${entries_file}"; then
  echo "expected package to include editor boot runtime boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-preview-app-runtime.js" "${entries_file}"; then
  echo "expected package to include editor preview app runtime boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-runtime.js" "${entries_file}"; then
  echo "expected package to include editor main runtime boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-metadata-panel.js" "${entries_file}"; then
  echo "expected package to include editor main metadata panel boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-frontmatter-label-width.js" "${entries_file}"; then
  echo "expected package to include editor main front matter label-width sync code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-frontmatter-manager.js" "${entries_file}"; then
  echo "expected package to include editor main article front matter manager code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-tabs-metadata-manager.js" "${entries_file}"; then
  echo "expected package to include editor main tabs metadata manager code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-preview-session.js" "${entries_file}"; then
  echo "expected package to include editor main preview session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-preview-assets.js" "${entries_file}"; then
  echo "expected package to include editor main preview asset override code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-preview-theme-picker.js" "${entries_file}"; then
  echo "expected package to include editor main preview theme picker code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-preview-viewport.js" "${entries_file}"; then
  echo "expected package to include editor main preview viewport code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-current-file-session.js" "${entries_file}"; then
  echo "expected package to include editor main current-file session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-current-file-view.js" "${entries_file}"; then
  echo "expected package to include editor main current-file view code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-sidebar-session.js" "${entries_file}"; then
  echo "expected package to include editor main sidebar session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-sidebar-file-tree.js" "${entries_file}"; then
  echo "expected package to include editor main sidebar file tree code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-toolbar-session.js" "${entries_file}"; then
  echo "expected package to include editor main toolbar session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-toolbar-card-picker.js" "${entries_file}"; then
  echo "expected package to include editor main toolbar card picker code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-toolbar-text-actions.js" "${entries_file}"; then
  echo "expected package to include editor main toolbar text action code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-image-session.js" "${entries_file}"; then
  echo "expected package to include editor main image session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-link-card-context.js" "${entries_file}"; then
  echo "expected package to include editor main link-card context boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-workspace-session.js" "${entries_file}"; then
  echo "expected package to include editor main workspace session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-blocks-session.js" "${entries_file}"; then
  echo "expected package to include editor main blocks session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-document-session.js" "${entries_file}"; then
  echo "expected package to include editor main document session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-content-service.js" "${entries_file}"; then
  echo "expected package to include editor main content service boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-file-context-service.js" "${entries_file}"; then
  echo "expected package to include editor main file context service boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-language-session.js" "${entries_file}"; then
  echo "expected package to include editor main language session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-scroll-session.js" "${entries_file}"; then
  echo "expected package to include editor main scroll session boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-shell-service.js" "${entries_file}"; then
  echo "expected package to include editor main shell service boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-main-service-registry.js" "${entries_file}"; then
  echo "expected package to include editor main service registry boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-model.js" "${entries_file}"; then
  echo "expected package to include editor blocks model boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-block-core-model.js" "${entries_file}"; then
  echo "expected package to include editor blocks core model boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-markdown-parse-model.js" "${entries_file}"; then
  echo "expected package to include editor blocks Markdown parse model boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-markdown-serialize-model.js" "${entries_file}"; then
  echo "expected package to include editor blocks Markdown serialize model boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-block-flow-model.js" "${entries_file}"; then
  echo "expected package to include editor blocks block-flow model boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-inline-model.js" "${entries_file}"; then
  echo "expected package to include editor blocks inline model boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-list-model.js" "${entries_file}"; then
  echo "expected package to include editor blocks list model boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-runtime.js" "${entries_file}"; then
  echo "expected package to include editor blocks runtime boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-session-registry.js" "${entries_file}"; then
  echo "expected package to include editor blocks session registry boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-block-actions.js" "${entries_file}"; then
  echo "expected package to include editor blocks action coordinator code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-control-factory.js" "${entries_file}"; then
  echo "expected package to include editor blocks control factory code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-layout-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks layout session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-body-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks body session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-state.js" "${entries_file}"; then
  echo "expected package to include editor blocks state controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-menu-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks menu session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-head-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks head session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-command-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks command session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-rich-text-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks rich text session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-editable-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks editable session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-selection-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks selection session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-inline-dom-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks inline DOM session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-inline-editing-bridge.js" "${entries_file}"; then
  echo "expected package to include editor blocks inline editing bridge code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-caret-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks caret session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-caret-measurement.js" "${entries_file}"; then
  echo "expected package to include editor blocks caret measurement code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-focus-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks focus session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-pointer-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks pointer session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-focus-pointer-sessions.js" "${entries_file}"; then
  echo "expected package to include editor blocks focus/pointer wiring code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-active-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks active session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-inline-sessions.js" "${entries_file}"; then
  echo "expected package to include editor blocks inline session assembly code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-block-type-sessions.js" "${entries_file}"; then
  echo "expected package to include editor blocks block type session assembly code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-inline-toolbar-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks inline toolbar session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-inline-command-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks inline command session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-link-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks link session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-math-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks math session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-table-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks table session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-table-model.js" "${entries_file}"; then
  echo "expected package to include editor blocks table model boundary code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-card-picker-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks card picker session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-image-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks image session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-code-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks code session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-source-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks source session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-blocks-list-session.js" "${entries_file}"; then
  echo "expected package to include editor blocks list session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-system-theme-bridge.js" "${entries_file}"; then
  echo "expected package to include composer system/theme bridge code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-sync-commit-controller.js" "${entries_file}"; then
  echo "expected package to include composer Sync commit controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-publish-service.js" "${entries_file}"; then
  echo "expected package to include composer publish app-service code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-publish-state-service.js" "${entries_file}"; then
  echo "expected package to include composer publish state service code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-service-registry.js" "${entries_file}"; then
  echo "expected package to include composer service registry code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-app-services.js" "${entries_file}"; then
  echo "expected package to include composer app service lifecycle code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-action-contract.js" "${entries_file}"; then
  echo "expected package to include composer action contract code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-action-dispatcher.js" "${entries_file}"; then
  echo "expected package to include composer action dispatcher code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-file-panel-controller.js" "${entries_file}"; then
  echo "expected package to include composer file panel controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-editor-detail-panel-controller.js" "${entries_file}"; then
  echo "expected package to include composer editor detail panel controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-yaml-panels-controller.js" "${entries_file}"; then
  echo "expected package to include composer YAML panels controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-bootstrap.js" "${entries_file}"; then
  echo "expected package to include composer bootstrap and workspace assembly code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-app-kernel.js" "${entries_file}"; then
  echo "expected package to include editor app lifecycle kernel code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-ui-motion.js" "${entries_file}"; then
  echo "expected package to include composer UI motion helper code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-site-config.js" "${entries_file}"; then
  echo "expected package to include composer site config helper code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-content-tree-controller.js" "${entries_file}"; then
  echo "expected package to include editor content tree controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-loader.js" "${entries_file}"; then
  echo "expected package to include composer Markdown loader code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-actions-ui.js" "${entries_file}"; then
  echo "expected package to include composer Markdown actions UI code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-actions.js" "${entries_file}"; then
  echo "expected package to include composer Markdown actions controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-state.js" "${entries_file}"; then
  echo "expected package to include composer Markdown state code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-drafts.js" "${entries_file}"; then
  echo "expected package to include composer Markdown drafts code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-session.js" "${entries_file}"; then
  echo "expected package to include composer Markdown session code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-markdown-workspace.js" "${entries_file}"; then
  echo "expected package to include composer Markdown workspace controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-notifications.js" "${entries_file}"; then
  echo "expected package to include composer notification and popup code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-dialogs.js" "${entries_file}"; then
  echo "expected package to include composer dialog overlay code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-remote-sync.js" "${entries_file}"; then
  echo "expected package to include composer remote sync code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-yaml-drafts.js" "${entries_file}"; then
  echo "expected package to include composer YAML draft controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/composer-yaml-actions.js" "${entries_file}"; then
  echo "expected package to include composer YAML action controller code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-file-tree-ui.js" "${entries_file}"; then
  echo "expected package to include editor file tree UI code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/editor-structure-panel-ui.js" "${entries_file}"; then
  echo "expected package to include editor structure panel UI code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/vendor/highlightjs/highlight.min.js" "${entries_file}"; then
  echo "expected package to include vendored Highlight.js common bundle" >&2
  exit 1
fi

if git -C "${repo_root}" cat-file -e HEAD:assets/js/vendor/katex/katex.min.js 2>/dev/null; then
  if ! grep -qx "press-system-${version}/assets/js/vendor/katex/katex.min.js" "${entries_file}"; then
    echo "expected package to include vendored KaTeX runtime code" >&2
    exit 1
  fi

  if ! grep -qx "press-system-${version}/assets/js/vendor/katex/katex.min.css" "${entries_file}"; then
    echo "expected package to include vendored KaTeX stylesheet" >&2
    exit 1
  fi

  if ! grep -q "^press-system-${version}/assets/js/vendor/katex/fonts/" "${entries_file}"; then
    echo "expected package to include vendored KaTeX fonts" >&2
    exit 1
  fi

  if grep -q "press-system-${version}/assets/js/vendor/katex/.*auto-render" "${entries_file}"; then
    echo "system release package must not include KaTeX auto-render" >&2
    exit 1
  fi
fi

if ! grep -qx "press-system-${version}/assets/themes/native/theme.json" "${entries_file}"; then
  echo "expected package to include the native fallback theme" >&2
  exit 1
fi

if grep -qx "press-system-${version}/assets/themes/packs.json" "${entries_file}"; then
  echo "system release package must not overwrite installed theme registry state" >&2
  exit 1
fi

if grep -qx "press-system-${version}/assets/themes/catalog.json" "${entries_file}"; then
  echo "system release package must not ship the external official theme catalog" >&2
  exit 1
fi

untracked_probe="${repo_root}/assets/js/__untracked-system-release-probe.js"
rm -f "${untracked_probe}"
printf 'export const probe = true;\n' > "${untracked_probe}"
probe_zip_dir="${tmp_dir}/probe"
mkdir -p "${probe_zip_dir}"
bash "${repo_root}/scripts/package-system-release.sh" "${version}" "${probe_zip_dir}" >/dev/null
if unzip -Z1 "${probe_zip_dir}/press-system-${version}.zip" | grep -qx "press-system-${version}/assets/js/__untracked-system-release-probe.js"; then
  echo "system release package must not include untracked files" >&2
  exit 1
fi
rm -f "${untracked_probe}"
untracked_probe=""

tracked_probe="${repo_root}/assets/js/system-updates.js"
tracked_backup="${tmp_dir}/system-updates.js.backup"
cp "${tracked_probe}" "${tracked_backup}"
printf '\n/* __dirty_system_release_probe__ */\n' >> "${tracked_probe}"
dirty_zip_dir="${tmp_dir}/dirty"
mkdir -p "${dirty_zip_dir}"
bash "${repo_root}/scripts/package-system-release.sh" "${version}" "${dirty_zip_dir}" >/dev/null
if unzip -p "${dirty_zip_dir}/press-system-${version}.zip" "press-system-${version}/assets/js/system-updates.js" | grep -F "__dirty_system_release_probe__" >/dev/null; then
  echo "system release package must read tracked files from HEAD, not the worktree" >&2
  exit 1
fi
cp "${tracked_backup}" "${tracked_probe}"
tracked_probe=""
tracked_backup=""

tracked_probe="${repo_root}/assets/js/press-system-surface.mjs"
tracked_backup="${tmp_dir}/press-system-surface.mjs.backup"
cp "${tracked_probe}" "${tracked_backup}"
SURFACE_PROBE="${tracked_probe}" node <<'NODE'
const fs = require('fs');
const file = process.env.SURFACE_PROBE;
const source = fs.readFileSync(file, 'utf8');
const next = source.replace(
  "  'assets/themes/native'\n]);",
  "  'assets/themes/native',\n  'wwwroot'\n]);"
);
if (next === source) {
  throw new Error('failed to dirty Press system surface package paths');
}
fs.writeFileSync(file, next);
NODE
surface_dirty_zip_dir="${tmp_dir}/dirty-surface"
mkdir -p "${surface_dirty_zip_dir}"
bash "${repo_root}/scripts/package-system-release.sh" "${version}" "${surface_dirty_zip_dir}" >/dev/null
if unzip -Z1 "${surface_dirty_zip_dir}/press-system-${version}.zip" | grep -q "press-system-${version}/wwwroot/"; then
  echo "system release package must read the package path surface from HEAD, not the worktree" >&2
  exit 1
fi
cp "${tracked_backup}" "${tracked_probe}"
tracked_probe=""
tracked_backup=""

if grep -Eq "press-system-${version}/assets/themes/(arcus|solstice|cartograph)/" "${entries_file}"; then
  echo "system release package must not include external theme directories" >&2
  grep -E "press-system-${version}/assets/themes/(arcus|solstice|cartograph)/" "${entries_file}" >&2
  exit 1
fi

blocked='(^|/)(wwwroot/|site\.yaml$|site\.local\.ya?ml$|CNAME$|README\.md$|BRANCHING\.md$|robots\.txt$|sitemap\.xml$|scripts/|\.github/|assets/avatar\.(png|jpe?g)$|assets/hero\.jpeg$)'
if grep -Eq "${blocked}" "${entries_file}"; then
  echo "release package contains files outside the system update boundary:" >&2
  grep -E "${blocked}" "${entries_file}" >&2
  exit 1
fi

allowed="^press-system-${version}/(index\\.html|index_editor\\.html|index_editor_preview\\.html|assets/(press-system\\.json|press-runtime-manifest\\.json|main\\.js|js/.*|i18n/.*|schema/.*|themes/native/.*))$"
while IFS= read -r entry; do
  if [[ ! "${entry}" =~ ${allowed} ]]; then
    echo "unexpected file in system release package: ${entry}" >&2
    exit 1
  fi
done < "${entries_file}"

runtime_manifest_file="${tmp_dir}/press-runtime-manifest.json"
unzip -p "${zip_path}" "press-system-${version}/assets/press-runtime-manifest.json" > "${runtime_manifest_file}"
RUNTIME_MANIFEST_FILE="${runtime_manifest_file}" EXPECTED_VERSION="${version#v}" EXPECTED_TAG="${version}" node <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync(process.env.RUNTIME_MANIFEST_FILE, 'utf8') || '{}');
if (manifest.schemaVersion !== 1 || manifest.type !== 'press-runtime-assets') {
  throw new Error('runtime manifest must use the press-runtime-assets schema');
}
if (manifest.version !== process.env.EXPECTED_VERSION || manifest.tag !== process.env.EXPECTED_TAG) {
  throw new Error('runtime manifest version must match the package tag');
}
if (manifest.cacheKey !== `press-system-${process.env.EXPECTED_TAG}`) {
  throw new Error('runtime manifest cacheKey must match the package tag');
}
if (!Array.isArray(manifest.entries) || !manifest.entries.some((entry) => entry.path === 'assets/main.js')) {
  throw new Error('runtime manifest must inventory runtime files');
}
const paths = new Set(manifest.entries.map((entry) => entry && entry.path).filter(Boolean));
const graph = manifest.graph && typeof manifest.graph === 'object' ? manifest.graph : {};
if (!Array.isArray(graph.edges) || !graph.edges.length || graph.edgeCount !== graph.edges.length) {
  throw new Error('runtime manifest must include a materialized asset graph');
}
function requireEdge(from, to, kind) {
  if (!graph.edges.some((edge) => edge.from === from && edge.to === to && edge.kind === kind)) {
    throw new Error(`runtime manifest graph missing ${kind} edge ${from} -> ${to}`);
  }
}
for (const edge of graph.edges) {
  if (!paths.has(edge.from)) throw new Error(`runtime graph edge source is not inventoried: ${edge.from}`);
  if (!paths.has(edge.to)) throw new Error(`runtime graph edge target is not inventoried: ${edge.to}`);
  if (edge.cacheKey !== `press-system-${process.env.EXPECTED_TAG}`) {
    throw new Error(`runtime graph edge has stale cache key: ${edge.from} -> ${edge.to}`);
  }
}
requireEdge('index.html', 'assets/main.js', 'html-src');
requireEdge('assets/main.js', 'assets/js/markdown.js', 'dynamic-import');
requireEdge('assets/main.js', 'assets/js/theme-layout.js', 'module-import');
requireEdge('assets/themes/native/theme.css', 'assets/themes/native/base.css', 'css-import');
requireEdge('assets/themes/native/theme.json', 'assets/themes/native/modules/interactions.js', 'theme-module');
NODE

assert_zip_contains() {
  local path="$1"
  local needle="$2"
  local description="$3"
  if ! unzip -p "${zip_path}" "${package_root}/${path}" | grep -F "${needle}" >/dev/null; then
    echo "expected materialized package ${path} to contain ${description}" >&2
    exit 1
  fi
}

assert_zip_contains "index.html" "src=\"assets/js/theme-boot.js?v=press-system-${version}\"" "the versioned theme boot URL"
assert_zip_contains "index.html" "src=\"assets/main.js?v=press-system-${version}\"" "the versioned public runtime URL"
assert_zip_contains "index_editor.html" "href=\"assets/themes/native/theme.css?v=press-system-${version}\"" "the versioned native editor stylesheet URL"
assert_zip_contains "index_editor.html" "src=\"assets/js/editor-main.js?v=press-system-${version}\"" "the versioned editor runtime URL"
assert_zip_contains "index_editor.html" "src=\"assets/js/composer.js?v=press-system-${version}\"" "the versioned composer runtime URL"
assert_zip_contains "assets/main.js" "from './js/theme-layout.js?v=press-system-${version}';" "a versioned static runtime import"
assert_zip_contains "assets/main.js" "import('./js/markdown.js?v=press-system-${version}')" "a versioned dynamic runtime import"
assert_zip_contains "assets/i18n/languages.json" "./en.js?v=press-system-${version}" "versioned language bundle entries"
assert_zip_contains "assets/js/math-render.js" "KATEX_VENDOR_CACHE_KEY = 'press-system-${version}'" "the materialized KaTeX vendor cache key"
assert_zip_contains "assets/js/theme-layout.js" "NATIVE_MODULE_CACHE_KEY = 'press-system-${version}'" "the materialized native module cache key"
assert_zip_contains "assets/js/theme-layout.js" "NATIVE_STYLE_CACHE_KEY = 'press-system-${version}'" "the materialized native style cache key"
assert_zip_contains "assets/js/theme.js" "NATIVE_STYLE_CACHE_KEY = 'press-system-${version}'" "the materialized theme stylesheet cache key"
assert_zip_contains "assets/themes/native/theme.css" "@import \"./base.css?v=press-system-${version}\";" "the versioned native base stylesheet import"
