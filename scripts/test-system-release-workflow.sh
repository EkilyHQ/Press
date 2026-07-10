#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

workflow=".github/workflows/system-release.yml"
main_workflow=".github/workflows/main-guard.yml"
full_workflow=".github/workflows/full-test-suite.yml"

if [[ ! -f "${workflow}" ]]; then
  echo "expected ${workflow} to exist" >&2
  exit 1
fi

if [[ ! -f "${full_workflow}" ]] \
  || ! grep -F 'pull_request:' "${full_workflow}" >/dev/null \
  || ! grep -F 'workflow_dispatch:' "${full_workflow}" >/dev/null \
  || ! grep -F 'schedule:' "${full_workflow}" >/dev/null \
  || ! grep -F 'persist-credentials: false' "${full_workflow}" >/dev/null \
  || ! grep -F 'actions/setup-node@v6' "${full_workflow}" >/dev/null \
  || ! grep -F 'node-version: 22.18.0' "${full_workflow}" >/dev/null \
  || ! grep -F "npm_config_offline: 'true'" "${full_workflow}" >/dev/null \
  || ! grep -F "npm_config_audit: 'false'" "${full_workflow}" >/dev/null \
  || ! grep -F "npm_config_fund: 'false'" "${full_workflow}" >/dev/null \
  || ! grep -F "npm_config_update_notifier: 'false'" "${full_workflow}" >/dev/null \
  || ! grep -F 'if: always()' "${full_workflow}" >/dev/null \
  || ! grep -F 'node scripts/run-tests.mjs --check-manifest' "${full_workflow}" >/dev/null \
  || ! grep -F 'node scripts/run-tests.mjs --tier full' "${full_workflow}" >/dev/null; then
  echo "full test workflow must cover pull requests plus scheduled/manual manifest-driven runs" >&2
  exit 1
fi

if [[ "$(grep -Fc 'git status --porcelain --untracked-files=all' "${full_workflow}")" -lt 2 ]]; then
  echo "full test workflow must require a clean checkout before and after the suite" >&2
  exit 1
fi

if grep -F 'pull-requests: write' "${workflow}" >/dev/null; then
  echo "system release workflow must not request pull request permissions" >&2
  exit 1
fi

if ! grep -F 'packages: write' "${workflow}" >/dev/null; then
  echo "system release workflow must publish the Press-owned theme contract package" >&2
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

if ! grep -F 'node scripts/run-tests.mjs --tier release' "${workflow}" >/dev/null; then
  echo "system release workflow must run the manifest release tier before publishing" >&2
  exit 1
fi

if ! grep -F 'node scripts/run-tests.mjs --tier guard' "${main_workflow}" >/dev/null; then
  echo "main guard workflow must run the manifest guard tier" >&2
  exit 1
fi

node scripts/run-tests.mjs --check-manifest >/dev/null
node - <<'NODE'
const assert = require('node:assert/strict');
const manifest = require('./scripts/test-manifest.json');

assert.deepEqual(manifest.tierOrder.guard, [
  'release-graph',
  'system-release-transaction',
  'system-release-package',
  'system-release-workflow',
  'composer-action-contract',
  'composer-root-contract',
  'composer-root-boundaries',
  'editor-effects-boundary',
  'composer-app-services',
  'composer-service-registry',
  'press-system-surface',
  'editor-app-kernel',
  'provider-adapters',
  'provider-boundary',
  'publish-receipt',
  'publish-flow-smoke',
  'site-features',
  'official-theme-public-chrome-behavior',
  'theme-contracts',
  'release-targets',
  'release-intent',
  'dispatch-system-release',
  'product-state-ledger',
  'pages-workflow',
  'pages-artifact'
]);

assert.deepEqual(manifest.tierOrder.release, [
  'release-graph',
  'system-release-transaction',
  'composer-action-contract',
  'composer-root-contract',
  'composer-root-boundaries',
  'editor-effects-boundary',
  'composer-app-services',
  'composer-service-registry',
  'press-system-surface',
  'editor-app-kernel',
  'provider-adapters',
  'provider-boundary',
  'publish-receipt',
  'publish-flow-smoke',
  'site-features',
  'official-theme-public-chrome-behavior',
  'theme-contracts',
  'system-release-package',
  'system-release-workflow',
  'pages-workflow',
  'pages-artifact',
  'product-state-workflow',
  'release-targets',
  'release-intent',
  'dispatch-system-release',
  'theme-contract-package',
  'product-state-ledger',
  'product-state-dashboard',
  'system-updates'
]);
NODE

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

if ! grep -F "git fetch --no-tags origin '+refs/heads/release-artifacts:refs/remotes/origin/release-artifacts'" "${workflow}" >/dev/null; then
  echo "system release workflow must fetch the versioned release artifact registry before graph verification" >&2
  exit 1
fi

if ! grep -F -- '--github-releases "${RUNNER_TEMP}/press-github-releases.json"' "${workflow}" >/dev/null; then
  echo "system release workflow must verify published GitHub Release objects" >&2
  exit 1
fi

if ! grep -F -- '--mode audit' "${workflow}" >/dev/null \
  || ! grep -F 'node scripts/release-graph.js "${graph_args[@]}"' "${workflow}" >/dev/null; then
  echo "system release workflow must audit the published release graph before planning a release" >&2
  exit 1
fi

if ! grep -F 'candidate_archive="$(PRESS_PACKAGE_SOURCE=worktree bash scripts/package-system-release.sh "${candidate_tag}" "${RUNNER_TEMP}/release-graph-candidate")"' "${main_workflow}" >/dev/null \
  || ! grep -F 'node scripts/release-graph.js --mode "${validation_mode}" --artifact-ref origin/release-artifacts --github-releases "${RUNNER_TEMP}/press-github-releases.json" --candidate-archive "${candidate_archive}" --check' "${main_workflow}" >/dev/null \
  || ! grep -F 'node scripts/run-tests.mjs --tier guard' "${main_workflow}" >/dev/null; then
  echo "main guard must package the worktree, validate audit-or-candidate state, and run the manifest guard tier" >&2
  exit 1
fi
if ! grep -F 'validation_mode="candidate"' "${main_workflow}" >/dev/null \
  || ! grep -F 'latest_published_tag="$(gh release view --json tagName' "${main_workflow}" >/dev/null \
  || ! grep -F '${latest_published_tag}..HEAD' "${main_workflow}" >/dev/null \
  || ! grep -F 'release_plan_paths[@]' "${main_workflow}" >/dev/null \
  || ! grep -F 'pages-release-plan-paths' "${main_workflow}" >/dev/null \
  || ! grep -F 'pages_release_plan_paths[@]' "${main_workflow}" >/dev/null; then
  echo "main guard must force candidate validation whenever the final system or Pages surface differs from published latest" >&2
  exit 1
fi
if grep -F '${{ steps.plan.outputs.changed_files }}' "${workflow}" >/dev/null \
  || ! grep -F 'dist/release-changed-files.txt' "${workflow}" >/dev/null; then
  echo "release notes must pass changed paths through a file instead of shell expression interpolation" >&2
  exit 1
fi

if grep -F 'node scripts/test-system-release-transaction.mjs' "${main_workflow}" >/dev/null \
  || grep -F 'bash scripts/test-system-release-package.sh' "${main_workflow}" >/dev/null; then
  echo "main guard local release tests must flow through the versioned manifest" >&2
  exit 1
fi
if grep -F 'git push' "${main_workflow}" >/dev/null; then
  echo "main guard transient tag handling must remain read-only on the remote" >&2
  exit 1
fi

if ! grep -F -- '--mode candidate' "${workflow}" >/dev/null \
  || ! grep -F -- '--candidate-archive "${CANDIDATE_ARCHIVE}"' "${workflow}" >/dev/null \
  || ! grep -F 'steps.package.outputs.archive_path || steps.staged_package.outputs.archive_path' "${workflow}" >/dev/null; then
  echo "system release workflow must verify the built candidate archive against the release graph" >&2
  exit 1
fi

build_line="$(grep -nF -- '- name: Build system update package' "${workflow}" | cut -d: -f1)"
candidate_line="$(grep -nF -- '- name: Verify release graph candidate' "${workflow}" | cut -d: -f1)"
draft_line="$(grep -nF -- '- name: Ensure draft release and asset' "${workflow}" | cut -d: -f1)"
if [[ -z "${build_line}" || -z "${candidate_line}" || -z "${draft_line}"
  || "${candidate_line}" -le "${build_line}" || "${candidate_line}" -ge "${draft_line}" ]]; then
  echo "release graph candidate verification must run after package build and before draft release creation" >&2
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

if ! grep -F 'repos/${GITHUB_REPOSITORY}/releases/${release_id}' "${workflow}" >/dev/null; then
  echo "system release workflow must validate and publish the draft release by immutable release id" >&2
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

if ! grep -F 'node scripts/system-release-transaction.mjs inspect' "${workflow}" >/dev/null \
  || ! grep -F 'node scripts/run-tests.mjs --tier release' "${workflow}" >/dev/null; then
  echo "release workflows must run the tested append-only transaction state machine" >&2
  exit 1
fi

transaction_step_line="$(grep -nF -- '- name: Inspect release transaction' "${workflow}" | head -n 1 | cut -d: -f1)"
graph_audit_step_line="$(grep -nF -- '- name: Verify release package boundary' "${workflow}" | head -n 1 | cut -d: -f1)"
if [[ -z "${transaction_step_line}" || -z "${graph_audit_step_line}" \
  || "${transaction_step_line}" -ge "${graph_audit_step_line}" ]]; then
  echo "system release workflow must classify retries before graph audit" >&2
  exit 1
fi

if ! grep -F -- '--transient-candidate-version "${CANDIDATE_VERSION}"' "${workflow}" >/dev/null; then
  echo "interrupted transactions must audit the canonical baseline without promoting the candidate" >&2
  exit 1
fi

if grep -F -- '--method DELETE' "${workflow}" >/dev/null \
  || grep -F 'git push --delete' "${workflow}" >/dev/null; then
  echo "system release retries must never delete Release or tag state" >&2
  exit 1
fi

if grep -F 'Update static release manifest' "${workflow}" >/dev/null; then
  echo "system release workflow must not update a main-branch static release manifest" >&2
  exit 1
fi

if ! grep -F 'Stage candidate artifact' "${workflow}" >/dev/null \
  || ! grep -F 'Promote latest release artifacts' "${workflow}" >/dev/null; then
  echo "system release workflow must stage candidate bytes separately from latest promotion" >&2
  exit 1
fi

stage_step="$(awk '
  /- name: Stage candidate artifact/ { in_step = 1 }
  /- name: Publish release/ { in_step = 0 }
  in_step { print }
' "${workflow}")"
if grep -F 'system-release.json' <<< "${stage_step}" >/dev/null \
  || grep -F 'release-intent.json' <<< "${stage_step}" >/dev/null \
  || grep -F 'product-state' <<< "${stage_step}" >/dev/null; then
  echo "candidate staging must not expose final manifests or root latest pointers" >&2
  exit 1
fi
if ! grep -F 'release-candidate.json' <<< "${stage_step}" >/dev/null \
  || ! grep -F 'git -C artifacts-worktree add "${artifact_path}" "${receipt_path}"' <<< "${stage_step}" >/dev/null; then
  echo "candidate staging must commit only the ZIP and its transaction receipt" >&2
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

if ! grep -F 'immutable_manifest_path="${tag}/system-release.json"' "${workflow}" >/dev/null; then
  echo "system release workflow must publish an immutable tag-scoped system-release manifest" >&2
  exit 1
fi

if ! grep -F 'immutable_release_intent_path="${tag}/release-intent.json"' "${workflow}" >/dev/null; then
  echo "system release workflow must publish latest and immutable release intent manifests" >&2
  exit 1
fi

if ! grep -F 'cp dist/product-state.json artifacts-worktree/product-state.json' "${workflow}" >/dev/null; then
  echo "system release workflow must publish the product-state ledger at the release-artifacts root" >&2
  exit 1
fi

if ! grep -F 'cp dist/product-state.html artifacts-worktree/product-state.html' "${workflow}" >/dev/null; then
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

if ! grep -F '"publishedAt": published_at' "${workflow}" >/dev/null \
  || grep -F 'release.get("published_at") or release.get("created_at")' "${workflow}" >/dev/null; then
  echo "final immutable manifests must record the actual GitHub publication time" >&2
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

if ! grep -F '"contentModelUpgrade": system.get("contentModelUpgrade") or {}' "${workflow}" >/dev/null; then
  echo "system release manifest must publish content model upgrade metadata" >&2
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

if ! grep -F 'cp dist/system-release.json artifacts-worktree/system-release.json' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the manifest into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/system-release.json "artifacts-worktree/${immutable_manifest_path}"' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the immutable system release manifest into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/release-intent.json "artifacts-worktree/${immutable_release_intent_path}"' "${workflow}" >/dev/null || ! grep -F 'cp dist/release-intent.json artifacts-worktree/release-intent.json' "${workflow}" >/dev/null; then
  echo "system release workflow must copy immutable and latest release intent manifests into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/product-state.json artifacts-worktree/product-state.json' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the product-state ledger into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/product-state.html artifacts-worktree/product-state.html' "${workflow}" >/dev/null; then
  echo "system release workflow must copy the product-state dashboard into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'git -C artifacts-worktree add "${artifact_path}" "${receipt_path}"' "${workflow}" >/dev/null \
  || ! grep -F 'git -C artifacts-worktree add \' "${workflow}" >/dev/null; then
  echo "system release workflow must use separate candidate-stage and latest-promotion commits" >&2
  exit 1
fi

publish_line="$(grep -nF -- '- name: Publish release' "${workflow}" | head -n 1 | cut -d: -f1)"
artifact_line="$(grep -nF -- '- name: Stage candidate artifact' "${workflow}" | head -n 1 | cut -d: -f1)"
promote_line="$(grep -nF -- '- name: Promote latest release artifacts' "${workflow}" | head -n 1 | cut -d: -f1)"
dispatch_line="$(grep -nF -- '- name: Dispatch release targets' "${workflow}" | head -n 1 | cut -d: -f1)"
theme_contract_package_line="$(grep -nF -- '- name: Publish theme contract package' "${workflow}" | head -n 1 | cut -d: -f1)"
if [[ -z "${publish_line}" || -z "${artifact_line}" || -z "${promote_line}" || -z "${dispatch_line}" \
  || "${artifact_line}" -ge "${publish_line}" || "${publish_line}" -ge "${promote_line}" \
  || "${promote_line}" -ge "${dispatch_line}" ]]; then
  echo "system release workflow must stage, publish, promote, then dispatch in order" >&2
  exit 1
fi
if [[ -z "${theme_contract_package_line}" || "${theme_contract_package_line}" -ge "${artifact_line}" ]]; then
  echo "system release workflow must publish the theme contract package before staging release artifacts" >&2
  exit 1
fi

if ! grep -F '{"draft":false,"make_latest":"true"}' "${workflow}" >/dev/null \
  || grep -F -- '- name: Mark GitHub Release latest' "${workflow}" >/dev/null \
  || grep -F -- '- name: Reconcile finalized GitHub latest' "${workflow}" >/dev/null; then
  echo "immutable GitHub Releases must choose latest status in the publication request" >&2
  exit 1
fi
if ! grep -F 'published candidate GitHub Release must be immutable' scripts/system-release-transaction.mjs >/dev/null; then
  echo "root promotion must require the repository immutable-release policy" >&2
  exit 1
fi
if ! grep -F -- '--artifact-ref "${promotion_commit}"' "${workflow}" >/dev/null \
  || ! grep -F 'releases-before-artifact-push.json' "${workflow}" >/dev/null \
  || ! grep -F -- '--atomic' "${workflow}" >/dev/null \
  || ! grep -F -- '--force-with-lease="refs/tags/${tag}:${tag_ref_oid}"' "${workflow}" >/dev/null; then
  echo "local promotion must pass a fresh full audit and atomically assert the release tag before push" >&2
  exit 1
fi

if ! grep -F 'node scripts/build-theme-contract-package.mjs --out dist/theme-contract-package' "${workflow}" >/dev/null || ! grep -F 'npm pack "${package_root}" --json --pack-destination "${package_pack_dir}"' "${workflow}" >/dev/null || ! grep -F 'npm publish "${built_tarball}" --registry=https://npm.pkg.github.com' "${workflow}" >/dev/null || ! grep -F '@ekilyhq/press-theme-contract@${package_version}' "${workflow}" >/dev/null; then
  echo "system release workflow must publish the Press-owned theme contract package to GitHub Packages" >&2
  exit 1
fi

if ! grep -F 'node scripts/compare-theme-contract-package.mjs "${built_tarball}" "${published_tarball}"' "${workflow}" >/dev/null; then
  echo "system release workflow must verify an existing theme contract package matches the current build before skipping publish" >&2
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

if ! grep -F 'content_model_upgrade: system.contentModelUpgrade || {}' scripts/dispatch-system-release.js >/dev/null; then
  echo "release dispatch orchestrator must pass content model upgrade metadata to targets" >&2
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

if ! grep -F 'candidate receipt' scripts/system-release-transaction.mjs >/dev/null \
  || ! grep -F 'manual recovery is required' scripts/system-release-transaction.mjs >/dev/null; then
  echo "unsafe or ambiguous retry states must fail closed with a manual recovery signal" >&2
  exit 1
fi
