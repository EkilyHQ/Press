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

if ! grep -F 'actions/configure-pages@v5' "${workflow}" >/dev/null; then
  echo "Pages workflow must configure GitHub Pages before artifact upload" >&2
  exit 1
fi

if ! grep -F 'actions/upload-pages-artifact@v3' "${workflow}" >/dev/null; then
  echo "Pages workflow must upload a GitHub Pages artifact" >&2
  exit 1
fi

if ! grep -F 'actions/deploy-pages@v4' "${workflow}" >/dev/null; then
  echo "Pages workflow must deploy through the official Pages action" >&2
  exit 1
fi

if ! grep -F 'git ls-files -z -- .nojekyll index.html index_editor.html index_editor_preview.html site.yaml robots.txt sitemap.xml assets wwwroot' "${workflow}" >/dev/null; then
  echo "Pages workflow must copy the tracked site surface, including docs content and site metadata" >&2
  exit 1
fi

if ! grep -F 'gh release view --json tagName' "${workflow}" >/dev/null; then
  echo "Pages workflow must read the latest release tag before deploying" >&2
  exit 1
fi

if ! grep -F 'Pages deploy cache key' "${workflow}" >/dev/null; then
  echo "Pages workflow must reject deployments that reuse the latest release cache key" >&2
  exit 1
fi

if ! grep -F 'node scripts/sync-runtime-cache-keys.mjs --materialize-root "${site_dir}" --tag "${tag}"' "${workflow}" >/dev/null; then
  echo "Pages workflow must materialize runtime cache keys into the deployed site artifact" >&2
  exit 1
fi

if grep -F 'bash scripts/package-system-release.sh' "${workflow}" >/dev/null; then
  echo "Pages workflow must not deploy the system update package alone because it excludes wwwroot site content" >&2
  exit 1
fi

if ! grep -F 'path: dist/pages' "${workflow}" >/dev/null; then
  echo "Pages workflow must upload the materialized site directory" >&2
  exit 1
fi

if grep -Eq '^[[:space:]]+NODE$' "${workflow}"; then
  echo "Pages workflow must not use indented heredoc terminators inside shell blocks" >&2
  exit 1
fi
