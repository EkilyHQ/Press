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

version="v9.9.9"
zip_path="${tmp_dir}/press-system-${version}.zip"

bash "${repo_root}/scripts/package-system-release.sh" "${version}" "${tmp_dir}" >/dev/null

if [[ ! -f "${zip_path}" ]]; then
  echo "expected package at ${zip_path}" >&2
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

if ! grep -qx "press-system-${version}/assets/js/system-updates.js" "${entries_file}"; then
  echo "expected package to include system updater code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/theme-manager.js" "${entries_file}"; then
  echo "expected package to include theme manager code" >&2
  exit 1
fi

if ! grep -qx "press-system-${version}/assets/js/encrypted-content.js" "${entries_file}"; then
  echo "expected package to include encrypted article runtime code" >&2
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

allowed="^press-system-${version}/(index\\.html|index_editor\\.html|assets/(main\\.js|js/.*|i18n/.*|schema/.*|themes/native/.*))$"
while IFS= read -r entry; do
  if [[ ! "${entry}" =~ ${allowed} ]]; then
    echo "unexpected file in system release package: ${entry}" >&2
    exit 1
  fi
done < "${entries_file}"
