#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

workflow=".github/workflows/system-release.yml"

if [[ ! -f "${workflow}" ]]; then
  echo "expected ${workflow} to exist" >&2
  exit 1
fi

if grep -F 'pull-requests: write' "${workflow}" >/dev/null; then
  echo "system release workflow must not request pull request permissions" >&2
  exit 1
fi

if ! awk '
  /^  release:/ { in_release = 1; next }
  in_release && /^  [A-Za-z0-9_-]+:/ { in_release = 0 }
  in_release && /^    if:/ { print; found = 1; exit }
  END { if (!found) exit 1 }
' "${workflow}" | grep -F "github.ref == 'refs/heads/main'" >/dev/null; then
  echo "system release job must be guarded to run only on refs/heads/main" >&2
  exit 1
fi

if awk '
  /changed_files="\$\(git diff --name-only/ && /\|\| true/ { found = 1 }
  END { exit found ? 0 : 1 }
' "${workflow}" >/dev/null; then
  echo "system release workflow must not ignore git diff failures while planning releases" >&2
  exit 1
fi

if awk '
  /- name: Plan release/ { in_plan = 1 }
  /- name: Build system update package/ { in_plan = 0 }
  in_plan && /assets\/system-release\.json/ { found = 1 }
  END { exit found ? 0 : 1 }
' "${workflow}" >/dev/null; then
  echo "system release manifest must not participate in release planning" >&2
  exit 1
fi

if awk '
  /- name: Plan release/ { in_plan = 1 }
  /- name: Build system update package/ { in_plan = 0 }
  in_plan && /assets\/themes[)" ]/ && !/assets\/themes\/native/ { found = 1 }
  END { exit found ? 0 : 1 }
' "${workflow}" >/dev/null; then
  echo "system release planning must not include arbitrary external theme directories" >&2
  exit 1
fi

if ! grep -F 'assets/themes/native)' "${workflow}" >/dev/null && ! grep -F 'assets/themes/native"' "${workflow}" >/dev/null; then
  echo "system release planning must include the native theme" >&2
  exit 1
fi

if grep -F 'assets/themes/catalog.json' "${workflow}" >/dev/null; then
  echo "system release planning must not include the external official theme catalog" >&2
  exit 1
fi

if grep -F 'assets/themes/packs.json' "${workflow}" >/dev/null; then
  echo "system release planning must not include installed theme registry state" >&2
  exit 1
fi

if grep -F 'releases/tags/${NEXT_TAG}' "${workflow}" >/dev/null; then
  echo "system release workflow must not validate draft releases through the tag endpoint" >&2
  exit 1
fi

if ! grep -F 'steps.create.outputs.release_id' "${workflow}" >/dev/null; then
  echo "system release workflow must validate and publish the draft release by release id" >&2
  exit 1
fi

if grep -F 'gh release create' "${workflow}" >/dev/null; then
  echo "system release workflow must create draft releases through the releases API, not gh release create" >&2
  exit 1
fi

if grep -F 'releases-after-create.json' "${workflow}" >/dev/null; then
  echo "system release workflow must not list releases after create to recover the new release id" >&2
  exit 1
fi

if grep -F 'expected exactly one draft release' "${workflow}" >/dev/null; then
  echo "system release workflow must not depend on immediate list visibility after draft creation" >&2
  exit 1
fi

if ! grep -F 'dist/release-created.json' "${workflow}" >/dev/null; then
  echo "system release workflow must persist the draft release creation response" >&2
  exit 1
fi

if ! grep -F 'repos/${GITHUB_REPOSITORY}/releases" --input dist/create-release.json' "${workflow}" >/dev/null; then
  echo "system release workflow must create draft releases through the REST releases API" >&2
  exit 1
fi

if ! grep -F 'uploads.github.com/repos/${GITHUB_REPOSITORY}/releases/${release_id}/assets' "${workflow}" >/dev/null; then
  echo "system release workflow must upload the release asset by release id" >&2
  exit 1
fi

if ! grep -F 'stale-draft-release-ids.txt' "${workflow}" >/dev/null; then
  echo "system release workflow must clean stale draft releases for retry safety" >&2
  exit 1
fi

if grep -F 'release.get("name") == next_tag' "${workflow}" >/dev/null; then
  echo "system release workflow must identify stale releases by tag_name, not editable release names" >&2
  exit 1
fi

if ! grep -F 'release.get("tag_name") == next_tag' "${workflow}" >/dev/null; then
  echo "system release workflow must match stale draft releases by tag_name" >&2
  exit 1
fi

if ! grep -F 'git push --delete origin "${next_tag}"' "${workflow}" >/dev/null; then
  echo "system release workflow must delete stale release tags before retrying" >&2
  exit 1
fi

if ! grep -F 'git tag -d "${next_tag}"' "${workflow}" >/dev/null; then
  echo "system release workflow must delete stale local release tags before retrying" >&2
  exit 1
fi

if grep -F 'Update static release manifest' "${workflow}" >/dev/null; then
  echo "system release workflow must not update a main-branch static release manifest" >&2
  exit 1
fi

if ! grep -F 'Publish fetchable artifact' "${workflow}" >/dev/null; then
  echo "system release workflow must publish a CORS-readable system package artifact" >&2
  exit 1
fi

if ! grep -F 'artifact_branch="release-artifacts"' "${workflow}" >/dev/null; then
  echo "system release workflow must publish system packages to the release-artifacts branch" >&2
  exit 1
fi

if ! grep -F 'artifact_url="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${artifact_branch}/${artifact_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must expose system packages through raw.githubusercontent.com" >&2
  exit 1
fi

if ! grep -F 'manifest_path="system-release.json"' "${workflow}" >/dev/null; then
  echo "system release workflow must publish the static manifest at the release-artifacts root" >&2
  exit 1
fi

if ! grep -F 'export FETCHABLE_ASSET_URL="${artifact_url}"' "${workflow}" >/dev/null; then
  echo "system release manifest must receive the fetchable artifact URL" >&2
  exit 1
fi

if ! grep -F '"url": os.environ["FETCHABLE_ASSET_URL"]' "${workflow}" >/dev/null; then
  echo "system release manifest must point asset.url at the fetchable artifact URL" >&2
  exit 1
fi

if ! grep -F 'Path("dist/system-release.json").write_text' "${workflow}" >/dev/null; then
  echo "system release workflow must write the static release manifest into dist" >&2
  exit 1
fi

if ! grep -F 'cp dist/system-release.json "artifacts-worktree/${manifest_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the manifest into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'git -C artifacts-worktree add "${artifact_path}" "${manifest_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must commit the ZIP and manifest together on release-artifacts" >&2
  exit 1
fi

publish_line="$(grep -nF -- '- name: Publish release' "${workflow}" | head -n 1 | cut -d: -f1)"
artifact_line="$(grep -nF -- '- name: Publish fetchable artifact' "${workflow}" | head -n 1 | cut -d: -f1)"
notify_line="$(grep -nF -- '- name: Notify YAP template' "${workflow}" | head -n 1 | cut -d: -f1)"
if [[ -z "${publish_line}" || -z "${artifact_line}" || -z "${notify_line}" || "${publish_line}" -ge "${artifact_line}" || "${artifact_line}" -ge "${notify_line}" ]]; then
  echo "system release workflow must publish the release-artifacts manifest after release publication and before YAP notification" >&2
  exit 1
fi

if ! grep -F 'Notify YAP template' "${workflow}" >/dev/null; then
  echo "system release workflow must notify the YAP template after publishing" >&2
  exit 1
fi

if ! grep -F 'STARTER_SYNC_TOKEN' "${workflow}" >/dev/null; then
  echo "system release workflow must use STARTER_SYNC_TOKEN for cross-repository YAP dispatch" >&2
  exit 1
fi

if ! grep -F "STARTER_REPOSITORY: \${{ vars.STARTER_REPOSITORY || 'EkilyHQ/YAP' }}" "${workflow}" >/dev/null; then
  echo "system release workflow must default dispatches to EkilyHQ/YAP" >&2
  exit 1
fi

if ! grep -F "event_type: 'press-system-release'" "${workflow}" >/dev/null; then
  echo "system release workflow must dispatch the press-system-release event" >&2
  exit 1
fi

if ! grep -F '"repos/${STARTER_REPOSITORY}/dispatches"' "${workflow}" >/dev/null; then
  echo "system release workflow must call the YAP repository dispatch endpoint" >&2
  exit 1
fi

if ! grep -F 'asset_sha256: process.env.ASSET_SHA256' "${workflow}" >/dev/null; then
  echo "system release workflow must pass the system package digest to YAP" >&2
  exit 1
fi

if ! grep -F 'dist/release-published.json' "${workflow}" >/dev/null; then
  echo "system release workflow must read the published release before writing the manifest" >&2
  exit 1
fi

if grep -F 'git add assets/system-release.json' "${workflow}" >/dev/null; then
  echo "system release workflow must not commit assets/system-release.json to main" >&2
  exit 1
fi

if grep -F 'git commit -m "Update system release manifest"' "${workflow}" >/dev/null; then
  echo "system release workflow must not create main manifest commits" >&2
  exit 1
fi

if grep -F 'manifest_branch=' "${workflow}" >/dev/null; then
  echo "system release workflow must not create manifest PR branches" >&2
  exit 1
fi

if grep -F 'git push --force-with-lease origin "HEAD:${manifest_branch}"' "${workflow}" >/dev/null; then
  echo "system release workflow must not push manifest PR branches" >&2
  exit 1
fi

if grep -F 'gh pr create' "${workflow}" >/dev/null; then
  echo "system release workflow must not open pull requests for manifest updates" >&2
  exit 1
fi

if grep -F 'gh pr edit' "${workflow}" >/dev/null; then
  echo "system release workflow must not edit pull requests for manifest updates" >&2
  exit 1
fi

if grep -F 'pulls?state=open&head=' "${workflow}" >/dev/null; then
  echo "system release workflow must not look up manifest pull requests" >&2
  exit 1
fi

if grep -F 'gh pr list' "${workflow}" >/dev/null; then
  echo "system release workflow must not look up manifest pull requests by ambiguous branch name only" >&2
  exit 1
fi

if grep -F 'git push origin "HEAD:${GITHUB_REF_NAME}"' "${workflow}" >/dev/null; then
  echo "system release workflow must not push manifest commits directly to the protected main branch" >&2
  exit 1
fi

stale_cleanup_line="$(grep -nF 'stale-draft-release-ids.txt' "${workflow}" | head -n 1 | cut -d: -f1)"
tag_refusal_line="$(grep -nF 'Refusing to overwrite existing tag' "${workflow}" | head -n 1 | cut -d: -f1)"
if [[ -n "${tag_refusal_line}" && -n "${stale_cleanup_line}" && "${tag_refusal_line}" -lt "${stale_cleanup_line}" ]]; then
  echo "system release workflow must clean stale drafts and tags before refusing an existing tag" >&2
  exit 1
fi
