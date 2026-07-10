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
package_source="${PRESS_PACKAGE_SOURCE:-head}"

mkdir -p "${output_dir}"
output_dir="$(cd "${output_dir}" && pwd)"
archive_path="${output_dir}/${archive_name}"
cd "${repo_root}"
rm -f "${archive_path}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

payload_dir="${tmp_dir}/${prefix%/}"
mkdir -p "${payload_dir}"

case "${package_source}" in
  head|worktree)
    ;;
  *)
    echo "PRESS_PACKAGE_SOURCE must be head or worktree" >&2
    exit 2
    ;;
esac

surface_cli="${repo_root}/scripts/print-press-system-surface.mjs"
if [[ "${package_source}" == "head" ]]; then
  surface_source_dir="${tmp_dir}/surface-source"
  mkdir -p "${surface_source_dir}"
  git archive --format=tar HEAD -- scripts/print-press-system-surface.mjs assets/js/press-system-surface.mjs | tar -xf - -C "${surface_source_dir}"
  surface_cli="${surface_source_dir}/scripts/print-press-system-surface.mjs"
fi

system_paths_file="${tmp_dir}/system-paths.txt"
if ! node "${surface_cli}" package-paths > "${system_paths_file}"; then
  echo "failed to read Press system package paths" >&2
  exit 1
fi

system_paths=()
while IFS= read -r system_path; do
  system_paths+=("${system_path}")
done < "${system_paths_file}"

if [[ "${#system_paths[@]}" -eq 0 ]]; then
  echo "Press system surface produced no package paths" >&2
  exit 1
fi

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
esac

source_tag="$(PAYLOAD_DIR="${payload_dir}" node -e "const manifest = require(process.env.PAYLOAD_DIR + '/assets/press-system.json'); const version = String(manifest.version || '').trim(); const tag = String(manifest.tag || '').trim(); if (!/^\\d+\\.\\d+\\.\\d+$/.test(version) || tag !== \`v\${version}\`) { throw new Error('assets/press-system.json must declare matching version and tag'); } process.stdout.write(tag);")"
if [[ "${source_tag}" != "${version}" ]]; then
  echo "package version ${version} must match assets/press-system.json tag ${source_tag}" >&2
  exit 1
fi

node scripts/sync-runtime-cache-keys.mjs --materialize-root "${payload_dir}" --tag "${version}" >&2

if [[ -n "$(find "${payload_dir}" -type l -print -quit)" ]]; then
  echo "Press system package must not contain symbolic links" >&2
  exit 1
fi
while IFS= read -r -d '' payload_path; do
  touch -t 198001010000 "${payload_path}"
done < <(find "${payload_dir}" -print0)

(
  cd "${tmp_dir}"
  LC_ALL=C find "${prefix%/}" -type f -print | LC_ALL=C sort > "${tmp_dir}/zip-files.txt"
  TZ=UTC zip -q -X "${archive_path}" -@ < "${tmp_dir}/zip-files.txt"
)

printf '%s\n' "${archive_path}"
