#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

workflow=".github/workflows/pages.yml"

if [[ ! -f "${workflow}" ]]; then
  echo "expected ${workflow} to exist" >&2
  exit 1
fi

if ! grep -F "github.ref == 'refs/heads/main'" "${workflow}" >/dev/null; then
  echo "Pages deploy job must be guarded to run only on refs/heads/main" >&2
  exit 1
fi

if ! grep -F 'pages: write' "${workflow}" >/dev/null || ! grep -F 'id-token: write' "${workflow}" >/dev/null; then
  echo "Pages workflow must request only the permissions required for artifact deployment" >&2
  exit 1
fi

if ! grep -F 'actions/checkout@v6' "${workflow}" >/dev/null; then
  echo "Pages workflow must use a Node 24-compatible checkout action" >&2
  exit 1
fi

if ! grep -F 'actions/configure-pages@v6' "${workflow}" >/dev/null; then
  echo "Pages workflow must configure GitHub Pages before artifact upload" >&2
  exit 1
fi

if ! grep -F 'actions/upload-pages-artifact@v5' "${workflow}" >/dev/null; then
  echo "Pages workflow must upload a GitHub Pages artifact" >&2
  exit 1
fi

if ! grep -F 'actions/deploy-pages@v5' "${workflow}" >/dev/null; then
  echo "Pages workflow must deploy through the official Pages action" >&2
  exit 1
fi

if grep -E 'actions/(checkout@v4|configure-pages@v5|deploy-pages@v4|upload-artifact@v4|upload-pages-artifact@v3)' .github/workflows/*.yml >/dev/null; then
  echo "Press workflows must not pin known Node 20-backed GitHub actions" >&2
  exit 1
fi

if ! grep -F 'bash scripts/build-pages-artifact.sh "${site_dir}" "${tag}"' "${workflow}" >/dev/null; then
  echo "Pages workflow must build the materialized site through the shared Pages artifact builder" >&2
  exit 1
fi

if ! grep -F 'archive_path="$(bash scripts/package-system-release.sh "${tag}" "${package_dir}")"' "${workflow}" >/dev/null; then
  echo "Pages workflow must build a system package for deployment artifact verification" >&2
  exit 1
fi

if ! grep -F 'node scripts/verify-pages-artifact.mjs' "${workflow}" >/dev/null || ! grep -F -- '--pages-root "${site_dir}"' "${workflow}" >/dev/null || ! grep -F -- '--system-archive "${archive_path}"' "${workflow}" >/dev/null; then
  echo "Pages workflow must verify the materialized Pages artifact before upload" >&2
  exit 1
fi

if grep -F 'git ls-files -z -- .nojekyll index.html index_editor.html index_editor_preview.html site.yaml robots.txt sitemap.xml assets wwwroot' "${workflow}" >/dev/null; then
  echo "Pages workflow must not duplicate tracked-site copy logic inline" >&2
  exit 1
fi

if ! grep -F 'git ls-files -z -- .nojekyll .press-pages-no-editor index.html index_editor.html index_editor_preview.html site.yaml robots.txt sitemap.xml assets wwwroot' scripts/build-pages-artifact.sh >/dev/null; then
  echo "Pages artifact builder must copy the tracked site surface and optional editor exclusion marker" >&2
  exit 1
fi

if ! grep -F 'gh release view --json tagName' "${workflow}" >/dev/null; then
  echo "Pages workflow must read the latest release tag before deploying" >&2
  exit 1
fi

if ! grep -F 'git fetch --no-tags --force --depth=1 origin "refs/tags/${latest_tag}:refs/tags/${latest_tag}"' "${workflow}" >/dev/null; then
  echo "Pages workflow must fetch the latest release tag before diffing against it" >&2
  exit 1
fi

if ! grep -F 'node scripts/print-press-system-surface.mjs pages-release-plan-paths' "${workflow}" >/dev/null; then
  echo "Pages workflow must read the shared Press system surface before enforcing cache-key advancement" >&2
  exit 1
fi

if ! grep -F 'pages_release_plan_paths_file="$(mktemp)"' "${workflow}" >/dev/null || ! grep -F 'Press system Pages release-plan path list is empty' "${workflow}" >/dev/null; then
  echo "Pages workflow must fail if release-plan path generation fails or returns no paths" >&2
  exit 1
fi

if grep -F 'changed_system_files="$(git diff --name-only "${latest_tag}..HEAD" -- index.html index_editor.html index_editor_preview.html assets/press-system.json assets/main.js assets/js assets/i18n assets/schema assets/themes/native scripts/sync-runtime-cache-keys.mjs)"' "${workflow}" >/dev/null; then
  echo "Pages workflow must not keep a hard-coded Press system surface path list" >&2
  exit 1
fi

if ! grep -F 'No unreleased Press system surface changes; Pages can reuse ${latest_tag}.' "${workflow}" >/dev/null; then
  echo "Pages workflow must allow workflow-only or non-system deploys to reuse the current release cache key" >&2
  exit 1
fi

if ! grep -F 'Pages deploy cache key' "${workflow}" >/dev/null; then
  echo "Pages workflow must reject deployments that reuse the latest release cache key" >&2
  exit 1
fi

if ! grep -F 'node scripts/sync-runtime-cache-keys.mjs --materialize-root "${output_dir}" --tag "${tag}"' scripts/build-pages-artifact.sh >/dev/null; then
  echo "Pages artifact builder must materialize runtime cache keys into the deployed site artifact" >&2
  exit 1
fi

if ! grep -F 'node scripts/pages-editor-exclusion.mjs --source-root "${repo_root}" --pages-root "${output_dir}"' scripts/build-pages-artifact.sh >/dev/null; then
  echo "Pages artifact builder must enforce the editor exclusion contract after materialization" >&2
  exit 1
fi

if ! grep -F 'node scripts/resolve-pages-output-path.mjs "${output_dir}" "${repo_root}"' scripts/build-pages-artifact.sh >/dev/null; then
  echo "Pages artifact builder must canonicalize and validate its output path before removal" >&2
  exit 1
fi

if grep -F 'path: dist/system' "${workflow}" >/dev/null || grep -F 'path: dist/press-system' "${workflow}" >/dev/null; then
  echo "Pages workflow must not deploy a system update package directory because it excludes wwwroot site content" >&2
  exit 1
fi

if ! grep -F 'scripts/build-pages-artifact.sh' assets/js/press-system-surface.mjs >/dev/null; then
  echo "Pages release-plan paths must include the shared Pages artifact builder" >&2
  exit 1
fi

if ! grep -F 'scripts/resolve-pages-output-path.mjs' assets/js/press-system-surface.mjs >/dev/null; then
  echo "Pages release-plan paths must include the output-path validator used by the artifact builder" >&2
  exit 1
fi

if ! grep -F 'scripts/pages-editor-exclusion.mjs' assets/js/press-system-surface.mjs >/dev/null; then
  echo "Pages release-plan paths must include the editor exclusion policy used by the artifact builder" >&2
  exit 1
fi

if ! grep -F 'path: dist/pages' "${workflow}" >/dev/null; then
  echo "Pages workflow must upload the materialized site directory" >&2
  exit 1
fi

if ! grep -F 'include-hidden-files: true' "${workflow}" >/dev/null; then
  echo "Pages workflow must include dotfiles such as .nojekyll in the Pages artifact" >&2
  exit 1
fi

if grep -Eq '^[[:space:]]+NODE$' "${workflow}"; then
  echo "Pages workflow must not use indented heredoc terminators inside shell blocks" >&2
  exit 1
fi
