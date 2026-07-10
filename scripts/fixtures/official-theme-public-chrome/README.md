# Official theme public-chrome fixtures

These Press-owned, test-only fixtures keep the official-theme public-chrome
behavior test deterministic in a standalone Press checkout. The test still
prefers a sibling official-theme worktree when one is available, so workspace
development exercises the current theme source.

`provenance.json` pins each fallback to its official repository, source path,
source commit, and SHA-256 digest. The test validates that metadata and digest
before choosing either the workspace source or the fallback fixture. Missing or
modified fallback fixtures are test failures; the test must never pass by
silently skipping unavailable theme source.

When refreshing a fixture, copy the named source file from a clean checkout at
the recorded commit, then update both `sourceCommit` and `sha256` in
`provenance.json`. Keep this directory test-only; it is not an installable theme
or part of the Press system package.
