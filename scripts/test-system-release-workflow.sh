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

if ! grep -F 'group: release-artifacts' "${workflow}" >/dev/null; then
  echo "system release workflow must share the release-artifacts concurrency group with product-state refreshes" >&2
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

if ! grep -F 'node scripts/print-press-system-surface.mjs release-plan-paths' "${workflow}" >/dev/null; then
  echo "system release planning must read the shared Press system surface" >&2
  exit 1
fi

if ! grep -F 'release_plan_paths_file="$(mktemp)"' "${workflow}" >/dev/null || ! grep -F 'Press system release-plan path list is empty' "${workflow}" >/dev/null; then
  echo "system release planning must fail if release-plan path generation fails or returns no paths" >&2
  exit 1
fi

if grep -F 'git diff --name-only "${latest_tag}..HEAD" -- index.html index_editor.html index_editor_preview.html assets/press-system.json assets/main.js assets/js assets/i18n assets/schema assets/themes/native' "${workflow}" >/dev/null; then
  echo "system release planning must not keep a hard-coded Press system surface path list" >&2
  exit 1
fi

if ! grep -F 'assets/press-system.json' "${workflow}" >/dev/null; then
  echo "system release planning must include the Press system version manifest" >&2
  exit 1
fi

if ! grep -F "require('./assets/press-system.json')" "${workflow}" >/dev/null; then
  echo "system release workflow must read the next release version from assets/press-system.json" >&2
  exit 1
fi

if ! grep -F 'node scripts/sync-runtime-cache-keys.mjs --check' "${workflow}" >/dev/null; then
  echo "system release workflow must verify runtime cache keys before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-composer-app-services.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the composer app service lifecycle before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-composer-action-contract.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the composer action contract before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-composer-root-contract.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the composer root import contract before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-composer-root-boundaries.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify composer root boundaries before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-editor-effects-boundary.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the shared editor effects boundary before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-composer-service-registry.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the composer service registry before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-press-system-surface.mjs' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the shared Press system surface before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-editor-app-kernel.mjs' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the editor app lifecycle kernel before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-provider-adapters.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify provider adapter contracts before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-provider-boundary.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the editor provider boundary before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-publish-flow-smoke.js' "${workflow}" >/dev/null; then
  echo "system release workflow must run the publish flow smoke before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-publish-receipt.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify publish receipt contracts before publishing" >&2
  exit 1
fi

if ! grep -F 'node --experimental-default-type=module scripts/test-theme-contracts.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the shared Press theme contract surface before publishing" >&2
  exit 1
fi

if ! grep -F -- '--materialize-root "${payload_dir}"' scripts/package-system-release.sh >/dev/null; then
  echo "system release package builder must materialize runtime cache keys into the payload" >&2
  exit 1
fi

if ! grep -F 'print-press-system-surface.mjs' scripts/package-system-release.sh >/dev/null || ! grep -F 'package-paths' scripts/package-system-release.sh >/dev/null; then
  echo "system release package builder must read the shared Press system surface" >&2
  exit 1
fi

if ! grep -F 'system_paths_file="${tmp_dir}/system-paths.txt"' scripts/package-system-release.sh >/dev/null || ! grep -F 'failed to read Press system package paths' scripts/package-system-release.sh >/dev/null; then
  echo "system release package builder must fail if package path generation fails" >&2
  exit 1
fi

if ! grep -F 'git archive --format=tar HEAD -- scripts/print-press-system-surface.mjs assets/js/press-system-surface.mjs' scripts/package-system-release.sh >/dev/null; then
  echo "system release package builder must read HEAD surface paths in HEAD package mode" >&2
  exit 1
fi

if ! grep -F 'runtimeManifestPath' assets/js/press-system-surface.mjs >/dev/null || ! grep -F 'PRESS_SYSTEM_SURFACE.runtimeManifestPath' scripts/sync-runtime-cache-keys.mjs >/dev/null; then
  echo "system release package builder must generate a runtime asset manifest" >&2
  exit 1
fi

if ! grep -F 'graph: {' scripts/sync-runtime-cache-keys.mjs >/dev/null || ! grep -F 'edgeCount: edges.length' scripts/sync-runtime-cache-keys.mjs >/dev/null; then
  echo "runtime asset manifest must include a materialized asset graph" >&2
  exit 1
fi

if ! grep -F 'bash scripts/test-pages-workflow.sh' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the Pages deployment workflow contract before publishing" >&2
  exit 1
fi

if ! grep -F 'bash scripts/test-pages-artifact.sh' "${workflow}" >/dev/null; then
  echo "system release workflow must verify materialized Pages artifacts before publishing" >&2
  exit 1
fi

if ! grep -F 'bash scripts/test-product-state-workflow.sh' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the product-state refresh workflow contract before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-release-targets.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the release target registry before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-release-intent.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify release intent helpers before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-dispatch-system-release.js' "${workflow}" >/dev/null; then
  echo "system release workflow must verify release dispatch helpers before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-product-state-ledger.js' "${workflow}" >/dev/null; then
  echo "system release workflow must run product-state ledger tests before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/test-product-state-dashboard.js' "${workflow}" >/dev/null; then
  echo "system release workflow must run product-state dashboard tests before publishing" >&2
  exit 1
fi

if grep -F '$((patch + 1))' "${workflow}" >/dev/null || grep -F 'next_tag="v0.0.1"' "${workflow}" >/dev/null; then
  echo "system release workflow must not auto-increment release versions" >&2
  exit 1
fi

if grep -Eq '^[[:space:]]+NODE$' "${workflow}"; then
  echo "system release workflow must not use indented heredoc terminators inside shell blocks" >&2
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

if ! grep -F 'immutable_manifest_path="${tag}/system-release.json"' "${workflow}" >/dev/null; then
  echo "system release workflow must publish an immutable tag-scoped system-release manifest" >&2
  exit 1
fi

if ! grep -F 'release_intent_path="release-intent.json"' "${workflow}" >/dev/null || ! grep -F 'immutable_release_intent_path="${tag}/release-intent.json"' "${workflow}" >/dev/null; then
  echo "system release workflow must publish latest and immutable release intent manifests" >&2
  exit 1
fi

if ! grep -F 'product_state_path="product-state.json"' "${workflow}" >/dev/null; then
  echo "system release workflow must publish the product-state ledger at the release-artifacts root" >&2
  exit 1
fi

if ! grep -F 'product_state_dashboard_path="product-state.html"' "${workflow}" >/dev/null; then
  echo "system release workflow must publish the product-state dashboard at the release-artifacts root" >&2
  exit 1
fi

if ! grep -F 'export FETCHABLE_ASSET_URL="${artifact_url}"' "${workflow}" >/dev/null; then
  echo "system release manifest must receive the fetchable artifact URL" >&2
  exit 1
fi

if ! grep -F 'export RELEASE_INTENT_URL="${release_intent_url}"' "${workflow}" >/dev/null; then
  echo "system release manifest must receive the immutable release intent URL" >&2
  exit 1
fi

if ! grep -F '"url": os.environ["FETCHABLE_ASSET_URL"]' "${workflow}" >/dev/null; then
  echo "system release manifest must point asset.url at the fetchable artifact URL" >&2
  exit 1
fi

if ! grep -F '"version": version' "${workflow}" >/dev/null; then
  echo "system release manifest must publish the explicit Press version" >&2
  exit 1
fi

if ! grep -F '"upgradeFrom": system.get("upgradeFrom") or {}' "${workflow}" >/dev/null; then
  echo "system release manifest must publish upgradeFrom compatibility metadata" >&2
  exit 1
fi

if ! grep -F '"themeContractUpgrade": system.get("themeContractUpgrade") or {}' "${workflow}" >/dev/null; then
  echo "system release manifest must publish theme contract upgrade metadata" >&2
  exit 1
fi

if ! grep -F '"runtime": {' "${workflow}" >/dev/null || ! grep -F '"edgeCount": len(runtime_edges)' "${workflow}" >/dev/null; then
  echo "system release manifest must publish runtime asset graph summary metadata" >&2
  exit 1
fi

if ! grep -F 'Path("dist/system-release.json").write_text' "${workflow}" >/dev/null; then
  echo "system release workflow must write the static release manifest into dist" >&2
  exit 1
fi

if ! grep -F 'node scripts/release-intent.js' "${workflow}" >/dev/null || ! grep -F -- '--out dist/release-intent.json' "${workflow}" >/dev/null; then
  echo "system release workflow must generate a release intent manifest from system-release.json" >&2
  exit 1
fi

if ! grep -F 'system_release_url="https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${artifact_branch}/${immutable_manifest_path}"' "${workflow}" >/dev/null; then
  echo "release intent generation must use the immutable system-release manifest URL" >&2
  exit 1
fi

if ! grep -F -- '--system-release-path "${immutable_manifest_path}"' "${workflow}" >/dev/null || ! grep -F -- '--system-release-source "${system_release_url}"' "${workflow}" >/dev/null; then
  echo "release intent generation must record the browser-readable system release URL" >&2
  exit 1
fi

if ! grep -F 'node scripts/product-state-ledger.js' "${workflow}" >/dev/null; then
  echo "system release workflow must generate the product-state ledger from the release manifest" >&2
  exit 1
fi

if ! grep -F -- '--system-release dist/system-release.json' "${workflow}" >/dev/null; then
  echo "product-state ledger generation must use the freshly generated system-release manifest" >&2
  exit 1
fi

if ! grep -F -- '--release-intent dist/release-intent.json' "${workflow}" >/dev/null; then
  echo "product-state ledger generation must use the freshly generated release intent manifest" >&2
  exit 1
fi

if ! grep -F -- '--out dist/product-state.json' "${workflow}" >/dev/null; then
  echo "product-state ledger generation must write dist/product-state.json" >&2
  exit 1
fi

if ! grep -F 'node scripts/product-state-dashboard.js' "${workflow}" >/dev/null; then
  echo "system release workflow must generate the product-state dashboard from the ledger" >&2
  exit 1
fi

if ! grep -F -- '--state dist/product-state.json' "${workflow}" >/dev/null; then
  echo "product-state dashboard generation must read the freshly generated ledger" >&2
  exit 1
fi

if ! grep -F -- '--out dist/product-state.html' "${workflow}" >/dev/null; then
  echo "product-state dashboard generation must write dist/product-state.html" >&2
  exit 1
fi

if ! grep -F 'cp dist/system-release.json "artifacts-worktree/${manifest_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the manifest into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/system-release.json "artifacts-worktree/${immutable_manifest_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the immutable system release manifest into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/release-intent.json "artifacts-worktree/${immutable_release_intent_path}"' "${workflow}" >/dev/null || ! grep -F 'cp dist/release-intent.json "artifacts-worktree/${release_intent_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must copy immutable and latest release intent manifests into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/product-state.json "artifacts-worktree/${product_state_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the product-state ledger into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/product-state.html "artifacts-worktree/${product_state_dashboard_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the product-state dashboard into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'git -C artifacts-worktree add "${artifact_path}" "${manifest_path}" "${immutable_manifest_path}" "${immutable_release_intent_path}" "${release_intent_path}" "${product_state_path}" "${product_state_dashboard_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must commit the ZIP, manifest, release intent, product-state ledger, and dashboard together on release-artifacts" >&2
  exit 1
fi

publish_line="$(grep -nF -- '- name: Publish release' "${workflow}" | head -n 1 | cut -d: -f1)"
artifact_line="$(grep -nF -- '- name: Publish fetchable artifact' "${workflow}" | head -n 1 | cut -d: -f1)"
dispatch_line="$(grep -nF -- '- name: Dispatch release targets' "${workflow}" | head -n 1 | cut -d: -f1)"
if [[ -z "${publish_line}" || -z "${artifact_line}" || -z "${dispatch_line}" || "${publish_line}" -ge "${artifact_line}" || "${artifact_line}" -ge "${dispatch_line}" ]]; then
  echo "system release workflow must publish the release-artifacts manifest after release publication and before release dispatches" >&2
  exit 1
fi

if ! grep -F 'Dispatch release targets' "${workflow}" >/dev/null; then
  echo "system release workflow must dispatch release targets after publishing" >&2
  exit 1
fi

if grep -F 'STARTER_SYNC_TOKEN' "${workflow}" >/dev/null; then
  echo "system release workflow must not use the legacy STARTER_SYNC_TOKEN for cross-repository dispatch" >&2
  exit 1
fi

if grep -F 'STARTER_REPOSITORY' "${workflow}" >/dev/null; then
  echo "system release workflow must not use the legacy single STARTER_REPOSITORY target" >&2
  exit 1
fi

if ! grep -F 'EKILY_RELEASE_APP_ID' "${workflow}" >/dev/null; then
  echo "system release workflow must read the Ekily Release GitHub App ID" >&2
  exit 1
fi

if ! grep -F 'EKILY_RELEASE_PRIVATE_KEY' "${workflow}" >/dev/null; then
  echo "system release workflow must read the Ekily Release GitHub App private key" >&2
  exit 1
fi

if ! grep -F 'scripts/dispatch-system-release.js' "${workflow}" >/dev/null; then
  echo "system release workflow must run the release dispatch orchestrator" >&2
  exit 1
fi

if grep -F 'Release dispatch skipped' scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must fail instead of skipping dispatch" >&2
  exit 1
fi

if ! grep -F 'EKILY_RELEASE_APP_ID and EKILY_RELEASE_PRIVATE_KEY are required for release dispatch' scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must fail when GitHub App credentials are missing" >&2
  exit 1
fi

if ! grep -F 'Release dispatch incomplete:' scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must fail when downstream dispatch is incomplete" >&2
  exit 1
fi

if ! grep -F 'process.exitCode = 1' scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must return a non-zero exit code on dispatch failure" >&2
  exit 1
fi

if ! grep -F "RELEASE_EVENT_TYPE = 'press-system-release'" scripts/release-targets.js >/dev/null; then
  echo "release target registry must declare the press-system-release event" >&2
  exit 1
fi

for target in \
  'EkilyHQ/YAP' \
  'EkilyHQ/Press-Theme-Starter' \
  'EkilyHQ/Press-Theme-Arcus' \
  'EkilyHQ/Press-Theme-Cartograph' \
  'EkilyHQ/Press-Theme-Glasswing' \
  'EkilyHQ/Press-Theme-Solstice'
do
  if ! grep -F "${target}" scripts/release-targets.js >/dev/null; then
    echo "release target registry must include ${target}" >&2
    exit 1
  fi
done

if ! grep -F "require('./release-targets.js')" scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must read the shared release target registry" >&2
  exit 1
fi

if ! grep -F "require('./release-targets.js')" scripts/product-state-ledger.js >/dev/null; then
  echo "product-state ledger must read the shared release target registry" >&2
  exit 1
fi

if ! grep -F '/repos/${target.repository}/dispatches' scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must call repository dispatch endpoints" >&2
  exit 1
fi

if ! grep -F 'asset_sha256: assetSha256' scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must pass the system package digest to targets" >&2
  exit 1
fi

if ! grep -F 'upgrade_from: system.upgradeFrom || {}' scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must pass upgrade compatibility metadata to targets" >&2
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
