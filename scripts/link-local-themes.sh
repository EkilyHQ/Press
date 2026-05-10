#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/.." && pwd)"
workspace_root="$(cd "${repo_root}/.." && pwd)"
themes_dir="${repo_root}/assets/themes"

themes=(
  "arcus:Press-Theme-Arcus"
  "cartograph:Press-Theme-Cartograph"
  "solstice:Press-Theme-Solstice"
)

mkdir -p "${themes_dir}"

for entry in "${themes[@]}"; do
  slug="${entry%%:*}"
  repo="${entry#*:}"
  source_dir="${workspace_root}/${repo}/theme"
  target="${themes_dir}/${slug}"

  if [[ ! -d "${source_dir}" ]]; then
    echo "Missing theme source: ${source_dir}" >&2
    exit 1
  fi

  rm -rf "${target}"
  ln -s "${source_dir}" "${target}"
done

node --input-type=module - "${repo_root}" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.argv[2];
const themes = ['arcus', 'cartograph', 'solstice'];

const entries = themes.map((slug) => {
  const manifestPath = join(repoRoot, 'assets/themes', slug, 'theme.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const files = [];
  for (const style of manifest.styles || []) files.push(String(style));
  for (const modulePath of manifest.modules || []) files.push(String(modulePath));
  if (!files.includes('theme.json')) files.push('theme.json');
  return {
    value: slug,
    label: manifest.name || slug,
    version: manifest.version || 'local',
    contractVersion: manifest.contractVersion || 1,
    source: {
      type: 'local-dev',
      symlink: `../../Press-Theme-${manifest.name || slug}/theme`
    },
    files
  };
});

writeFileSync(
  join(repoRoot, 'assets/themes/packs.local.json'),
  `${JSON.stringify(entries, null, 2)}\n`
);
NODE

echo "Linked local themes into ${themes_dir}"
echo "Wrote ${themes_dir}/packs.local.json"
