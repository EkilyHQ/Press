#!/usr/bin/env bash
set -euo pipefail

version="${1:-}"
output_dir="${2:-dist}"

if [[ ! "${version}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: $0 vMAJOR.MINOR.PATCH [output-dir]" >&2
  exit 2
fi

repo_root="$(git rev-parse --show-toplevel)"
archive_name="press-system-${version}.zip"
prefix="press-system-${version}/"

system_paths=(
  "index.html"
  "index_editor.html"
  "index_editor_preview.html"
  "assets/press-system.json"
  "assets/main.js"
  "assets/js"
  "assets/i18n"
  "assets/schema"
  "assets/themes/native"
)

mkdir -p "${output_dir}"
output_dir="$(cd "${output_dir}" && pwd)"
archive_path="${output_dir}/${archive_name}"
cd "${repo_root}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

payload_dir="${tmp_dir}/${prefix%/}"
mkdir -p "${payload_dir}"

package_source="${PRESS_PACKAGE_SOURCE:-head}"
case "${package_source}" in
  head)
    git archive --format=tar --prefix="${prefix}" HEAD -- "${system_paths[@]}" | tar -xf - -C "${tmp_dir}"
    ;;
  worktree)
    while IFS= read -r -d '' file; do
      mkdir -p "${payload_dir}/$(dirname "${file}")"
      cp "${file}" "${payload_dir}/${file}"
    done < <(git ls-files -z -- "${system_paths[@]}")
    ;;
  *)
    echo "PRESS_PACKAGE_SOURCE must be head or worktree" >&2
    exit 2
    ;;
esac

source_tag="$(PAYLOAD_DIR="${payload_dir}" node -e "const manifest = require(process.env.PAYLOAD_DIR + '/assets/press-system.json'); const version = String(manifest.version || '').trim(); const tag = String(manifest.tag || '').trim(); if (!/^\\d+\\.\\d+\\.\\d+$/.test(version) || tag !== \`v\${version}\`) { throw new Error('assets/press-system.json must declare matching version and tag'); } process.stdout.write(tag);")"
if [[ "${source_tag}" != "${version}" ]]; then
  echo "package version ${version} must match assets/press-system.json tag ${source_tag}" >&2
  exit 1
fi

node scripts/sync-runtime-cache-keys.mjs --materialize-root "${payload_dir}" --tag "${version}" >&2

(
  cd "${tmp_dir}"
  zip -qr "${archive_path}" "${prefix%/}"
)

printf '%s\n' "${archive_path}"
