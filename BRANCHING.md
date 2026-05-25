# Branching Strategy

Press now uses a simple `main + short-lived branches` model.

## Branch Roles

- `main`: stable source for the Press runtime, editor, built-in `native` theme, Theme Manager infrastructure, official documentation site, and Markdown regression corpus.
- `feat/*`: short-lived feature branches for human-authored work.
- `codex/*`: short-lived implementation branches for Codex-authored work.

The old long-lived `doc` branch is retired. Do not use it for development, documentation hosting, or release work.

## Workflow

1. Start new work from `main`.
2. Create a short-lived branch such as `feat/editor-toolbar` or `codex/main-docs-repo`.
3. Keep runtime changes and documentation updates in the same branch when they describe the same behavior.
4. Run the focused checks before merging:

```bash
bash scripts/test-main-guard.sh
bash scripts/test-frontmatter-roundtrip.sh
bash scripts/test-system-release-package.sh
bash scripts/test-system-release-workflow.sh
node scripts/test-release-targets.js
node scripts/test-dispatch-system-release.js
node scripts/test-product-state-ledger.js
node --experimental-default-type=module scripts/test-system-updates.js
node --experimental-default-type=module scripts/test-theme-manager.js
```

5. Merge back to `main` after review and verification.
6. Delete the short-lived branch after it has landed.

## Documentation Content

`wwwroot/` is the official documentation site, not a starter template. It is expected to contain realistic documentation, media, release history, SEO examples, and Markdown edge cases.

When a runtime feature changes user-facing behavior, update the relevant documentation in `wwwroot/` in the same branch. This keeps the official site and the code versioned together.

The minimal user starter lives in the separate `YAP` repository. Do not strip this repository's `wwwroot/` back to a minimal template.

## Theme Repository Boundary

`native` belongs to Press core and is the permanent fallback. Other official themes are developed in one repository per theme, for example `Press-Theme-Arcus`. Those repositories own theme source, contract checks, release ZIPs, checksums, and root `theme-release.json` manifests.

Press sites load themes only from local `assets/themes/<slug>` directories. Theme Manager loads the official theme catalog from `EkilyHQ/Press-Theme-Catalog` and installs official themes or manually imported ZIPs by staging file additions/deletions plus `assets/themes/packs.json` changes for Publish. Press system updates must not overwrite arbitrary external theme directories.

## System Release Packages

`main` deploys GitHub Pages from a materialized GitHub Actions artifact, while system updates use a separate release ZIP. After a push to `main`, the release workflow checks whether runtime files changed since the latest release tag. If only documentation or content changed under `wwwroot/`, no system release is created.

When runtime files changed, `assets/press-system.json` must already declare the next release version and tag. The workflow creates a GitHub Release for that tag and uploads exactly one package named `press-system-vX.Y.Z.zip`. That package is an allowlisted runtime bundle only: `index.html`, `index_editor.html`, `assets/main.js`, `assets/js/`, `assets/i18n/`, `assets/schema/`, and `assets/themes/native/**`.

The package must not include user-controlled content or site configuration such as `wwwroot/`, `site.yaml`, `CNAME`, `robots.txt`, `sitemap.xml`, repository policy files, scripts, workflow files, repo-specific root media, `assets/themes/packs.json`, or arbitrary `assets/themes/<slug>` directories outside `native`. Users who customize files under `assets/js/` are modifying the system namespace, and those files may be overwritten by system updates. Non-native themes should be managed through Theme Manager so their file inventory remains explicit in site-owned `packs.json`.

After the release is published, the workflow sends `press-system-release` repository dispatch events through the Ekily Release GitHub App to the targets declared in `scripts/release-targets.js`: `YAP`, `Press-Theme-Starter`, and the four official theme demo repositories. YAP syncs runtime files directly to `main`, Press-Theme-Starter refreshes its marker, and official theme demo repositories refresh their `demo` branches. Scheduled downstream workflows remain catch-up paths if a dispatch is missed.

## Local Testing Data Isolation

Use local-only config and content for experiments:

1. Copy `site.local.example.yaml` to `site.local.yaml`.
2. Set `contentRoot: wwwroot.local`.
3. Put local test content under `wwwroot.local/`.

`site.local.yaml`, `site.local.yml`, and `wwwroot.local/` are ignored by git.

## Main Guard

PRs targeting `main` must pass the `Main Guard` workflow. The guard only enforces repository hygiene:

- Reject local-only files:
  - `site.local.yaml`
  - `site.local.yml`
  - `wwwroot.local/**`
- Ensure tracked `site.yaml` keeps `contentRoot: wwwroot`.

The guard does not require `main` to stay minimal. `main` is intentionally the complete development and documentation source.
