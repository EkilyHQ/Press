#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

workflow=".github/workflows/product-state.yml"

if [[ ! -f "${workflow}" ]]; then
  echo "expected ${workflow} to exist" >&2
  exit 1
fi

if ! grep -F 'workflow_dispatch:' "${workflow}" >/dev/null; then
  echo "product-state workflow must support manual refresh" >&2
  exit 1
fi

if ! grep -F 'require_converged:' "${workflow}" >/dev/null || ! grep -F -- '--require-converged' "${workflow}" >/dev/null; then
  echo "product-state workflow must support a manual converged-state gate" >&2
  exit 1
fi

if ! grep -F 'github.event.inputs.require_converged' "${workflow}" >/dev/null || grep -F '${{ inputs.require_converged }}' "${workflow}" >/dev/null; then
  echo "product-state workflow must not reference the workflow_dispatch-only inputs context on scheduled runs" >&2
  exit 1
fi

if ! grep -F 'schedule:' "${workflow}" >/dev/null; then
  echo "product-state workflow must support scheduled refresh" >&2
  exit 1
fi

if ! grep -F 'workflow_run:' "${workflow}" >/dev/null || ! grep -F -- '- System Release' "${workflow}" >/dev/null; then
  echo "product-state workflow must refresh after successful System Release runs" >&2
  exit 1
fi

if ! grep -F 'contents: write' "${workflow}" >/dev/null; then
  echo "product-state workflow must be able to publish to release-artifacts" >&2
  exit 1
fi

if ! grep -F 'group: release-artifacts' "${workflow}" >/dev/null; then
  echo "product-state workflow must share the release-artifacts concurrency group with system release" >&2
  exit 1
fi

if ! grep -F 'node scripts/product-state-ledger.js' "${workflow}" >/dev/null; then
  echo "product-state workflow must use the product-state ledger script" >&2
  exit 1
fi

if ! grep -F 'node scripts/product-state-dashboard.js' "${workflow}" >/dev/null; then
  echo "product-state workflow must generate a human-readable dashboard from the ledger" >&2
  exit 1
fi

if ! grep -F -- '--out dist/product-state.json' "${workflow}" >/dev/null; then
  echo "product-state workflow must generate dist/product-state.json" >&2
  exit 1
fi

if ! grep -F -- '--out dist/product-state.html' "${workflow}" >/dev/null; then
  echo "product-state workflow must generate dist/product-state.html" >&2
  exit 1
fi

if ! grep -F 'artifact_branch="release-artifacts"' "${workflow}" >/dev/null; then
  echo "product-state workflow must publish to the release-artifacts branch" >&2
  exit 1
fi

if ! grep -F 'product_state_path="product-state.json"' "${workflow}" >/dev/null; then
  echo "product-state workflow must publish product-state.json at the release-artifacts root" >&2
  exit 1
fi

if ! grep -F 'product_state_dashboard_path="product-state.html"' "${workflow}" >/dev/null; then
  echo "product-state workflow must publish product-state.html at the release-artifacts root" >&2
  exit 1
fi

if ! grep -F 'cp dist/product-state.json "artifacts-worktree/${product_state_path}"' "${workflow}" >/dev/null; then
  echo "product-state workflow must copy the generated ledger into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'cp dist/product-state.html "artifacts-worktree/${product_state_dashboard_path}"' "${workflow}" >/dev/null; then
  echo "product-state workflow must copy the generated dashboard into release-artifacts" >&2
  exit 1
fi

if ! grep -F 'git -C artifacts-worktree add "${product_state_path}" "${product_state_dashboard_path}"' "${workflow}" >/dev/null; then
  echo "product-state workflow must commit the JSON ledger and HTML dashboard together" >&2
  exit 1
fi

if ! grep -F -- '--state dist/product-state.json' "${workflow}" >/dev/null; then
  echo "product-state workflow must evaluate the exact ledger it published" >&2
  exit 1
fi

if ! grep -F -- '--quiet' "${workflow}" >/dev/null; then
  echo "product-state workflow should keep check logs concise with --quiet" >&2
  exit 1
fi

if grep -F 'press-system-v' "${workflow}" >/dev/null || grep -F 'package-system-release.sh' "${workflow}" >/dev/null; then
  echo "product-state workflow must not build or publish system release packages" >&2
  exit 1
fi

echo "ok - product-state workflow"
