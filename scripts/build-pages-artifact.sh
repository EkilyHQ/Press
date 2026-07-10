#!/usr/bin/env bash
set -euo pipefail

output_dir="${1:-dist/pages}"
explicit_tag="${2:-}"

repo_root="$(cd "$(git rev-parse --show-toplevel)" && pwd -P)"
cd "${repo_root}"
output_dir="$(node scripts/resolve-pages-output-path.mjs "${output_dir}" "${repo_root}")"

source_tag="$(node -e "const manifest = require('./assets/press-system.json'); const version = String(manifest.version || '').trim(); const tag = String(manifest.tag || '').trim(); if (!/^\\d+\\.\\d+\\.\\d+$/.test(version) || tag !== \`v\${version}\`) { throw new Error('assets/press-system.json must declare matching version and tag'); } process.stdout.write(tag);")"
tag="${explicit_tag:-${source_tag}}"

if [[ ! "${tag}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: $0 [output-dir] [vMAJOR.MINOR.PATCH]" >&2
  exit 2
fi

if [[ "${tag}" != "${source_tag}" ]]; then
  echo "Pages artifact tag ${tag} must match assets/press-system.json tag ${source_tag}" >&2
  exit 1
fi

rm -rf "${output_dir}"
mkdir -p "${output_dir}"

while IFS= read -r -d '' file; do
  mkdir -p "${output_dir}/$(dirname "${file}")"
  cp "${file}" "${output_dir}/${file}"
done < <(git ls-files -z -- .nojekyll index.html index_editor.html index_editor_preview.html site.yaml robots.txt sitemap.xml assets wwwroot)

node scripts/sync-runtime-cache-keys.mjs --materialize-root "${output_dir}" --tag "${tag}"
