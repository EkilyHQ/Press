#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd -P)"
tmp_dir="$(mktemp -d)"
untracked_paths=()

cleanup() {
  for untracked_path in "${untracked_paths[@]:-}"; do
    [[ -n "${untracked_path}" ]] || continue
    rm -f "${repo_root}/${untracked_path}"
  done
  rm -rf "${tmp_dir}"
}
trap cleanup EXIT

cd "${repo_root}"

version="$(node -e "const manifest = require('./assets/press-system.json'); const version = String(manifest.version || '').trim(); const tag = String(manifest.tag || '').trim(); if (!/^\\d+\\.\\d+\\.\\d+$/.test(version) || tag !== \`v\${version}\`) { throw new Error('assets/press-system.json must declare matching version and tag'); } process.stdout.write(tag);")"

probe_paths=(
  "assets/js/__untracked-pages-artifact-probe.js"
  "wwwroot/__untracked-pages-artifact-probe.md"
)
for untracked_path in "${probe_paths[@]}"; do
  if [[ -e "${repo_root}/${untracked_path}" || -L "${repo_root}/${untracked_path}" ]]; then
    echo "refusing to overwrite existing untracked probe path: ${untracked_path}" >&2
    exit 1
  fi
done
untracked_paths=("${probe_paths[@]}")
mkdir -p wwwroot
printf 'export const probe = true;\n' > assets/js/__untracked-pages-artifact-probe.js
printf 'local\n' > wwwroot/__untracked-pages-artifact-probe.md

if bash scripts/build-pages-artifact.sh "${repo_root}" "${version}" >/dev/null 2>&1; then
  echo "Pages artifact builder must reject the repository root as an output directory" >&2
  exit 1
fi

alias_root="${tmp_dir}/repository-parent-alias"
ln -s "$(dirname "${repo_root}")" "${alias_root}"
alias_repo="${alias_root}/$(basename "${repo_root}")"
if node scripts/resolve-pages-output-path.mjs "${alias_repo}" "${repo_root}" >/dev/null 2>&1; then
  echo "Pages artifact output validation must reject a repository-root path through a symlinked parent" >&2
  exit 1
fi
if [[ ! -d "${repo_root}/.git" || ! -f "${repo_root}/assets/press-system.json" ]]; then
  echo "Pages artifact output validation must not remove the repository through a path alias" >&2
  exit 1
fi

fake_repo="${tmp_dir}/symlinked-dist-repo"
mkdir -p "${fake_repo}/assets/js"
printf 'keep\n' > "${fake_repo}/assets/js/sentinel.txt"
ln -s assets "${fake_repo}/dist"
if node scripts/resolve-pages-output-path.mjs "${fake_repo}/dist/js" "${fake_repo}" >/dev/null 2>&1; then
  echo "Pages artifact output validation must reject dist symlinks into repository assets" >&2
  exit 1
fi
if [[ ! -f "${fake_repo}/assets/js/sentinel.txt" ]]; then
  echo "Pages artifact output validation must not remove tracked paths through a dist symlink" >&2
  exit 1
fi
rm "${fake_repo}/dist"
ln -s . "${fake_repo}/dist"
if node scripts/resolve-pages-output-path.mjs "${fake_repo}/dist/pages" "${fake_repo}" >/dev/null 2>&1; then
  echo "Pages artifact output validation must reject dist symlinks to the repository root" >&2
  exit 1
fi
rm "${fake_repo}/dist"
mkdir -p "${fake_repo}/dist"
ln -s ../assets/js "${fake_repo}/dist/pages"
if node scripts/resolve-pages-output-path.mjs "${fake_repo}/dist/pages" "${fake_repo}" >/dev/null 2>&1; then
  echo "Pages artifact output validation must reject a symlinked dist/pages output" >&2
  exit 1
fi
if [[ ! -f "${fake_repo}/assets/js/sentinel.txt" ]]; then
  echo "Pages artifact output validation must preserve tracked files behind a dist/pages symlink" >&2
  exit 1
fi
rm "${fake_repo}/dist/pages"
mkdir -p "${tmp_dir}/redirected-pages-target"
printf 'keep\n' > "${tmp_dir}/redirected-pages-target/sentinel.txt"
ln -s "${tmp_dir}/redirected-pages-target" "${fake_repo}/dist/pages"
if node scripts/resolve-pages-output-path.mjs "${fake_repo}/dist/pages" "${fake_repo}" >/dev/null 2>&1; then
  echo "Pages artifact output validation must reject repo-local aliases even when they target the system temporary directory" >&2
  exit 1
fi
if [[ ! -f "${tmp_dir}/redirected-pages-target/sentinel.txt" ]]; then
  echo "Pages artifact output validation must preserve temporary files behind a repo-local output alias" >&2
  exit 1
fi

if [[ -n "${HOME:-}" ]] && bash scripts/build-pages-artifact.sh "${HOME}" "${version}" >/dev/null 2>&1; then
  echo "Pages artifact builder must reject the home directory as an output directory" >&2
  exit 1
fi

pages_dir="${tmp_dir}/pages"
bash scripts/build-pages-artifact.sh "${pages_dir}" "${version}" >/dev/null

system_dir="${tmp_dir}/system"
PRESS_PACKAGE_SOURCE=worktree bash scripts/package-system-release.sh "${version}" "${system_dir}" >/dev/null
system_archive="${system_dir}/press-system-${version}.zip"

node scripts/verify-pages-artifact.mjs \
  --pages-root "${pages_dir}" \
  --system-archive "${system_archive}" \
  --tag "${version}"

if [[ ! -f "${pages_dir}/.nojekyll" || ! -f "${pages_dir}/site.yaml" || ! -f "${pages_dir}/wwwroot/index.yaml" ]]; then
  echo "Pages artifact must include site metadata and content" >&2
  exit 1
fi

if [[ ! -f "${pages_dir}/assets/themes/packs.json" ]]; then
  echo "Pages artifact must include installed-site theme state" >&2
  exit 1
fi

for local_path in "${untracked_paths[@]}"; do
  if [[ -e "${pages_dir}/${local_path}" ]]; then
    echo "Pages artifact must not include untracked or local path: ${local_path}" >&2
    exit 1
  fi
done

for local_path in site.local.yaml site.local.yml assets/themes/packs.local.json wwwroot.local; do
  if [[ -e "${pages_dir}/${local_path}" ]]; then
    echo "Pages artifact must not include local-only path: ${local_path}" >&2
    exit 1
  fi
done

if unzip -Z1 "${system_archive}" | grep -Eq "^press-system-${version}/(site\.yaml$|wwwroot/|assets/themes/packs\.json$)"; then
  echo "system archive must not include Pages-owned site state" >&2
  exit 1
fi

unzipped_manifest="${tmp_dir}/system-runtime-manifest.json"
unzip -p "${system_archive}" "press-system-${version}/assets/press-runtime-manifest.json" > "${unzipped_manifest}"
if ! cmp -s "${pages_dir}/assets/press-runtime-manifest.json" "${unzipped_manifest}"; then
  echo "Pages artifact and system archive runtime manifests must match" >&2
  exit 1
fi

if ! grep -F "src=\"assets/main.js?v=press-system-${version}\"" "${pages_dir}/index.html" >/dev/null; then
  echo "Pages artifact must materialize the public runtime cache key" >&2
  exit 1
fi

corrupt_pages_dir="${tmp_dir}/corrupt-pages"
cp -R "${pages_dir}" "${corrupt_pages_dir}"
printf '\n/* stale after manifest */\n' >> "${corrupt_pages_dir}/assets/main.js"
if node scripts/verify-pages-artifact.mjs --pages-root "${corrupt_pages_dir}" --system-archive "${system_archive}" --tag "${version}" >/dev/null 2>&1; then
  echo "Pages artifact verifier must reject stale runtime manifest digests" >&2
  exit 1
fi
