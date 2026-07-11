#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  checkThemeRouteGuardOwnership,
  loadLegacyThemeRouteGuardInventory,
  loadThemeRouteGuardOwnershipPolicy
} from './check-theme-route-guard-ownership.mjs';

const root = process.cwd();
const policy = loadThemeRouteGuardOwnershipPolicy();
const legacyIdentifiers = loadLegacyThemeRouteGuardInventory(root, policy);
const facadePath = policy.paths.facade;
const htmlOwnerPath = policy.paths.htmlOwner;

const CORE_REGEX_BASELINE = String.raw`
void /^[a-z0-9][a-z0-9_-]{0,63}$/;
void /^press-theme-[a-z0-9_-]+-v\d+\.\d+\.\d+\.zip$/i;
void /^[a-f0-9]{64}$/;
void /\s+/g;
void /[^a-z0-9_-]/g;
void /\\+/g;
void /\\+/g;
void /\\+/g;
void /^[a-z]:\//i;
void /^[a-z]:\//i;
void /^[a-z][a-z0-9+.-]*:\/\//i;
void /^[a-z][a-z0-9+.-]*:\/\//i;
void /^\/+/;
void /^press-theme-([a-z0-9_-]+)-v/i;
`;

function baseFixture() {
  return new Map([
    [
      facadePath,
      String.raw`
import { parse } from './vendor/acorn.mjs';
import { fullAncestor } from './vendor/acorn-walk.mjs';
import { containsForbiddenV4HtmlRouteConstruction, isV4HtmlRouteGuardSource } from './theme-route-guard-html.js';

export function containsForbiddenV4RouteConstruction(source, contextSource = source) {
  const pathValue = String(contextSource && contextSource.path || '');
  void parse;
  void fullAncestor;
  return isV4HtmlRouteGuardSource(pathValue, source)
    ? containsForbiddenV4HtmlRouteConstruction(source, contextSource)
    : false;
}
`
    ],
    [
      htmlOwnerPath,
      String.raw`
export function isV4HtmlRouteGuardSource() {
  return false;
}

export function containsForbiddenV4HtmlRouteConstruction() {
  return false;
}
`
    ],
    [
      policy.paths.core,
      String.raw`
import { containsForbiddenV4RouteConstruction } from './theme-route-guard.js';

export { containsForbiddenV4RouteConstruction };
${CORE_REGEX_BASELINE}
function validateThemeRouteHelperContract(entries) {
  entries.forEach((entry) => {
    if (containsForbiddenV4RouteConstruction(entry.source, entry)) throw new Error('forbidden');
  });
}

void validateThemeRouteHelperContract;
`
    ],
    [
      policy.paths.corpus,
      String.raw`
export const THEME_ROUTE_GUARD_CASES = Object.freeze([]);
`
    ],
    [
      policy.paths.contractTest,
      String.raw`
import { containsForbiddenV4RouteConstruction } from '../assets/js/theme-package-core.js';

void containsForbiddenV4RouteConstruction;
`
    ],
    [
      policy.paths.packageTest,
      String.raw`
const expectedPackageFiles = [
  'assets/js/theme-route-guard.js',
  'assets/js/theme-route-guard-html.js'
];

void expectedPackageFiles;
`
    ],
    [
      policy.paths.packageIndex,
      String.raw`
const themePackageCore = await import('./assets/js/theme-package-core.js');
const { containsForbiddenV4RouteConstruction } = themePackageCore;

export { containsForbiddenV4RouteConstruction };

export function validateThemeRouteHelperContract(files) {
  const routeGuardFiles = files;
  routeGuardFiles.forEach((file) => {
    containsForbiddenV4RouteConstruction(file.source, file);
  });
}
`
    ],
    [
      'packages/press-theme-contract/package.json',
      `${JSON.stringify(
        {
          name: '@ekilyhq/press-theme-contract',
          files: [facadePath, htmlOwnerPath]
        },
        null,
        2
      )}\n`
    ],
    [
      'packages/press-theme-contract/scripts/sync-assets.mjs',
      String.raw`
const files = [
  ['assets/js/theme-route-guard.js', 'assets/js/theme-route-guard.js'],
  ['assets/js/theme-route-guard-html.js', 'assets/js/theme-route-guard-html.js']
];

void files;
`
    ],
    [
      'scripts/build-theme-contract-package.mjs',
      String.raw`
const files = [
  ['assets/js/theme-route-guard.js', 'assets/js/theme-route-guard.js'],
  ['assets/js/theme-route-guard-html.js', 'assets/js/theme-route-guard-html.js']
];

void files;
`
    ]
  ]);
}

function writeFixture(directory, fixture) {
  fixture.forEach((source, relativePath) => {
    const target = path.join(directory, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  });
}

function withFixture(mutator, callback, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'press-theme-route-ownership-'));
  try {
    const fixture = baseFixture();
    if (mutator) mutator(fixture, directory);
    writeFixture(directory, fixture);
    if (options.afterWrite) options.afterWrite(fixture, directory);
    const repositoryFiles = options.repositoryFiles ? options.repositoryFiles(fixture) : Array.from(fixture.keys());
    const failures = checkThemeRouteGuardOwnership({
      root: directory,
      policy: options.policy || policy,
      legacyIdentifiers,
      repositoryFiles,
      repositoryModes: options.repositoryModes || new Map()
    });
    callback(failures);
  } finally {
    fs.rmSync(directory, { force: true, recursive: true });
  }
}

function expectPolicyRejected(label, mutate) {
  test(label, () => {
    const mutatedPolicy = structuredClone(policy);
    mutate(mutatedPolicy);
    withFixture(
      null,
      (failures) => {
        assert.match(failures.join('\n'), /policy differs from the locked review baseline/u);
      },
      { policy: mutatedPolicy }
    );
  });
}

function expectRejected(label, mutator, expected, options = {}) {
  test(label, () => {
    withFixture(
      mutator,
      (failures) => {
        assert.notDeepEqual(failures, []);
        assert.match(failures.join('\n'), expected);
      },
      options
    );
  });
}

test('minimal direct-delegation fixture passes the ownership checker', () => {
  withFixture(null, (failures) => assert.deepEqual(failures, []));
});

expectPolicyRejected('legacy proof base cannot be retargeted', (candidate) => {
  candidate.legacy.baseCommit = '0000000000000000000000000000000000000000';
});

expectPolicyRejected('legacy inventory digest cannot be blessed', (candidate) => {
  candidate.legacy.orderedIdentifierSha256 = '0'.repeat(64);
});

expectPolicyRejected('owner role and cap cannot be weakened', (candidate) => {
  candidate.owners[0].role = 'generic';
  candidate.owners[0].maxLines += 1000;
});

expectPolicyRejected('supporting file caps cannot be removed', (candidate) => {
  delete candidate.caps[policy.paths.corpus];
});

expectPolicyRejected('package inventory bindings cannot be removed', (candidate) => {
  candidate.packageLists = [];
});

expectPolicyRejected('core regex inventory cannot bless a new scanner', (candidate) => {
  candidate.coreRegexLiteralBaseline.push({ pattern: '[?&]tab=', flags: '', count: 1 });
});

expectPolicyRejected('non-owner declaration allowlist cannot be widened', (candidate) => {
  candidate.legacy.nonOwnerDeclarationAllowlist['assets/js/generic-helper.js'] = ['collectRouteKeyAliases'];
});

expectRejected('equal-count missing-plus-duplicate owner paths fail closed', null, /owner path multiset mismatch/u, {
  repositoryFiles(fixture) {
    return Array.from(fixture.keys()).map((file) => (file === htmlOwnerPath ? facadePath : file));
  }
});

expectRejected(
  'an exact legacy identifier cannot regrow in core',
  (fixture) =>
    fixture.set(policy.paths.core, `${fixture.get(policy.paths.core)}\nfunction collectRouteKeyAliases() {}\n`),
  /forbidden legacy route-guard identifiers/u
);

expectRejected(
  'a renamed legacy route-regex signature cannot regrow in core',
  (fixture) =>
    fixture.set(
      policy.paths.core,
      `${fixture.get(policy.paths.core)}\nconst NEW_QUERY_SCANNER = /[?&]([^=&#\\s]+)\\s*=/g;\nvoid NEW_QUERY_SCANNER;\n`
    ),
  /regular-expression inventory|renamed legacy route-scanner regex/u
);

expectRejected(
  'dynamic RegExp construction cannot regrow in core',
  (fixture) => fixture.set(policy.paths.core, `${fixture.get(policy.paths.core)}\nvoid new RegExp("route");\n`),
  /must not construct dynamic regular expressions/u
);

expectRejected(
  'core cannot wrap the facade with a fallback engine',
  (fixture) =>
    fixture.set(
      policy.paths.core,
      String.raw`
import { containsForbiddenV4RouteConstruction as ownerGuard } from './theme-route-guard.js';

function legacyFallback() { return false; }
export function containsForbiddenV4RouteConstruction(source) {
  return ownerGuard(source, source) || legacyFallback(source);
}
${CORE_REGEX_BASELINE}
`
    ),
  /import only the public route-guard facade binding|directly re-export/u
);

expectRejected(
  'core cannot import an internal AST API',
  (fixture) =>
    fixture.set(
      policy.paths.core,
      fixture
        .get(policy.paths.core)
        .replace(
          'import { containsForbiddenV4RouteConstruction }',
          'import { containsForbiddenV4RouteConstruction, containsForbiddenV4RouteConstructionAst }'
        )
    ),
  /forbidden legacy route-guard identifiers|import only the public route-guard facade binding/u
);

expectRejected(
  'core validation cannot shadow the imported public facade',
  (fixture) =>
    fixture.set(
      policy.paths.core,
      fixture
        .get(policy.paths.core)
        .replace(
          'function validateThemeRouteHelperContract(entries) {',
          'function validateThemeRouteHelperContract(entries) {\n  const containsForbiddenV4RouteConstruction = () => false;'
        )
    ),
  /must call the unshadowed imported public facade exactly once/u
);

expectRejected(
  'core validation cannot hide its only facade call in an unused nested function',
  (fixture) =>
    fixture.set(
      policy.paths.core,
      fixture
        .get(policy.paths.core)
        .replace(
          'entries.forEach((entry) => {\n    if (containsForbiddenV4RouteConstruction(entry.source, entry))',
          'entries.forEach((entry) => {\n    function unused() { return containsForbiddenV4RouteConstruction(entry.source, entry); }\n    void unused;\n    if (false)'
        )
    ),
  /must call the unshadowed imported public facade exactly once/u
);

expectRejected(
  'facade cannot delegate route ownership to a generic helper',
  (fixture) => {
    fixture.set('assets/js/url-helper.js', 'export function scanRoute() { return false; }\n');
    fixture.set(
      facadePath,
      `${fixture.get(facadePath)}\nimport { scanRoute } from './url-helper.js';\nvoid scanRoute;\n`
    );
  },
  /module references must match the locked owner dependency set/u
);

expectRejected('facade cannot delegate through a symlinked generic helper', null, /module references must match/u, {
  afterWrite(fixture, directory) {
    const helperPath = path.join(directory, 'assets/js/url-helper.js');
    fs.symlinkSync('./theme-route-guard.js', helperPath);
    fixture.set('assets/js/url-helper.js', '');
    fs.appendFileSync(path.join(directory, facadePath), "\nimport './url-helper.js';\n");
  },
  repositoryFiles(fixture) {
    return [...fixture.keys(), 'assets/js/url-helper.js'];
  }
});

expectRejected(
  'HTML owner cannot import another module',
  (fixture) => fixture.set(htmlOwnerPath, `${fixture.get(htmlOwnerPath)}\nimport './url-helper.js';\n`),
  /must not reference another module/u
);

expectRejected(
  'facade cannot use an opaque dynamic module reference',
  (fixture) => fixture.set(facadePath, `${fixture.get(facadePath)}\nvoid import(globalThis.helperPath);\n`),
  /module references must match the locked owner dependency set/u
);

expectRejected(
  'nested route-guard analyzer paths fail closed',
  (fixture) => fixture.set('assets/js/theme-route-guard/legacy.js', 'export const legacy = true;\n'),
  /owner path multiset mismatch/u
);

expectRejected(
  'route analyzer alias paths fail closed',
  (fixture) => fixture.set('assets/js/theme-route-analyzer.js', 'export const analyzer = true;\n'),
  /owner path multiset mismatch/u
);

expectRejected('symlinked owners fail closed', null, /must not be a symlink/u, {
  afterWrite(_fixture, directory) {
    const htmlOwner = path.join(directory, htmlOwnerPath);
    fs.rmSync(htmlOwner);
    fs.symlinkSync('./theme-route-guard.js', htmlOwner);
  }
});

for (const packageList of policy.packageLists) {
  expectRejected(
    `${packageList.path} cannot omit the HTML owner`,
    (fixture) => {
      if (packageList.kind === 'package-files') {
        const manifest = JSON.parse(fixture.get(packageList.path));
        manifest.files = manifest.files.filter((file) => file !== htmlOwnerPath);
        fixture.set(packageList.path, `${JSON.stringify(manifest, null, 2)}\n`);
      } else {
        fixture.set(
          packageList.path,
          fixture.get(packageList.path).split(htmlOwnerPath).join('assets/js/not-the-html-owner.js')
        );
      }
    },
    /must (?:list|contain) assets\/js\/theme-route-guard-html\.js/u
  );
}

expectRejected(
  'package index cannot bypass themePackageCore',
  (fixture) =>
    fixture.set(
      policy.paths.packageIndex,
      String.raw`
import { containsForbiddenV4RouteConstruction as ownerGuard } from './assets/js/theme-route-guard.js';

export function containsForbiddenV4RouteConstruction(source) {
  return ownerGuard(source, source);
}

export function validateThemeRouteHelperContract(source) {
  return containsForbiddenV4RouteConstruction(source, source);
}
`
    ),
  /bypasses theme-package-core ownership|directly delegate its public export/u
);

for (const alias of [
  './theme-route-guard.js?cache=1',
  './theme-route-guard.js#owner',
  './theme-route-%67uard.js',
  '.\\theme-route-guard.js',
  './nested/../theme-route-guard.js'
]) {
  expectRejected(
    `core cannot import the facade through noncanonical alias ${alias}`,
    (fixture) =>
      fixture.set(
        policy.paths.core,
        fixture.get(policy.paths.core).replace("'./theme-route-guard.js'", JSON.stringify(alias))
      ),
    /noncanonical alias|import only the public route-guard facade binding/u
  );
}

expectRejected(
  'package validation cannot shadow the delegated public facade',
  (fixture) =>
    fixture.set(
      policy.paths.packageIndex,
      fixture
        .get(policy.paths.packageIndex)
        .replace(
          'export function validateThemeRouteHelperContract(files) {',
          'export function validateThemeRouteHelperContract(files) {\n  const containsForbiddenV4RouteConstruction = () => false;'
        )
    ),
  /must call the unshadowed delegated public export exactly once/u
);

expectRejected(
  'package validation cannot hide its only facade call in an unused nested function',
  (fixture) =>
    fixture.set(
      policy.paths.packageIndex,
      fixture
        .get(policy.paths.packageIndex)
        .replace(
          'routeGuardFiles.forEach((file) => {\n    containsForbiddenV4RouteConstruction(file.source, file);',
          'routeGuardFiles.forEach((file) => {\n    function unused() { return containsForbiddenV4RouteConstruction(file.source, file); }\n    void unused;'
        )
    ),
  /must call the unshadowed delegated public export exactly once/u
);
