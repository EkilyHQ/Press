const assert = require('node:assert/strict');
const test = require('node:test');

const {
  escapeHtml,
  renderProductStateDashboard,
  statusClass
} = require('./product-state-dashboard.js');

function sampleState(overrides = {}) {
  return {
    schemaVersion: 1,
    type: 'ekily-product-state',
    generatedAt: '2026-05-25T00:00:00Z',
    status: 'ok',
    desired: {
      pressSystem: {
        repository: 'EkilyHQ/Press',
        version: '3.4.52',
        tag: 'v3.4.52'
      },
      downstream: {
        yap: {
          label: 'YAP starter runtime',
          repository: 'EkilyHQ/YAP',
          expectedVersion: '3.4.52',
          expectedTag: 'v3.4.52',
          reconciler: {
            eventType: 'press-system-release',
            kind: 'press-runtime-sync',
            idempotent: true
          }
        }
      },
      themeDemos: {
        arcus: {
          label: 'Arcus demo runtime',
          repository: 'EkilyHQ/Press-Theme-Arcus',
          expectedVersion: '3.4.52',
          expectedTag: 'v3.4.52',
          observedChannels: {
            themeManifest: {
              path: 'assets/themes/arcus/theme.json',
              type: 'press-theme-manifest'
            },
            themePacks: {
              path: 'assets/themes/packs.json',
              type: 'press-theme-packs'
            },
            demoLock: {
              path: 'demo-release-lock.json',
              type: 'theme-demo-release-lock'
            }
          },
          reconciler: {
            eventType: 'press-system-release',
            kind: 'theme-demo-runtime-sync',
            idempotent: true
          }
        }
      },
      themes: {
        entries: [
          {
            slug: 'arcus',
            label: 'Arcus',
            repository: 'EkilyHQ/Press-Theme-Arcus',
            expectedPressVersion: '3.4.52',
            expectedContractVersion: 1
          }
        ]
      }
    },
    pressSystem: {
      status: 'ok',
      version: '3.4.52',
      tag: 'v3.4.52',
      runtime: {
        manifestPath: 'assets/press-runtime-manifest.json',
        type: 'press-runtime-assets',
        strategy: 'query-param',
        cacheKey: 'press-system-v3.4.52',
        entryCount: 125,
        edgeCount: 300
      }
    },
    downstream: {
      yap: {
        label: 'YAP starter runtime',
        status: 'pending',
        expectedVersion: '3.4.52',
        observedVersion: '3.4.51',
        repository: 'EkilyHQ/YAP'
      }
    },
    themeDemos: {
      arcus: {
        label: 'Arcus demo runtime',
        status: 'ok',
        expectedVersion: '3.4.52',
        observedVersion: '3.4.52',
        repository: 'EkilyHQ/Press-Theme-Arcus',
        installedTheme: {
          status: 'ok',
          expectedVersion: '3.4.2',
          observedVersion: '3.4.2'
        }
      }
    },
    themes: {
      catalog: { status: 'ok', count: 1 },
      entries: [
        {
          slug: 'arcus',
          label: 'Arcus',
          status: 'ok',
          version: '3.4.2',
          engines: { press: '>=3.4.0 <4.0.0' },
          repository: 'EkilyHQ/Press-Theme-Arcus'
        }
      ]
    },
    connect: {
      status: 'ok',
      service: 'ekily-connect',
      publishTelemetry: {
        status: 'ok',
        publishSuccess: 1,
        publishFailure: 0
      }
    },
    verdict: {
      status: 'ok',
      converged: true,
      counts: { ok: 5, pending: 0, unknown: 0, drift: 0 },
      problemCount: 0,
      blockingProblemCount: 0,
      nonBlockingProblemCount: 0,
      blockingProblems: [],
      nonBlockingProblems: []
    },
    problems: [],
    ...overrides
  };
}

test('statusClass keeps product and problem status buckets stable', () => {
  assert.equal(statusClass('ok'), 'ok');
  assert.equal(statusClass('pending'), 'pending');
  assert.equal(statusClass('warning'), 'warning');
  assert.equal(statusClass('error'), 'error');
  assert.equal(statusClass('surprise'), 'unknown');
});

test('escapeHtml prevents dashboard content injection', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
});

test('renderProductStateDashboard renders human-readable product status sections', () => {
  const html = renderProductStateDashboard(sampleState());
  assert.match(html, /Ekily Product State/);
  assert.match(html, /Press System/);
  assert.match(html, /Runtime Graph/);
  assert.match(html, /Desired Release Target/);
  assert.match(html, /Converged/);
  assert.match(html, /125 files \/ 300 edges/);
  assert.match(html, /v3\.4\.52/);
  assert.match(html, /press-runtime-sync/);
  assert.match(html, /theme-release-compatibility/);
  assert.match(html, /YAP starter runtime/);
  assert.match(html, /Theme Demo Channels/);
  assert.match(html, /Arcus demo runtime/);
  assert.match(html, /Press v3\.4\.52 \/ Theme v3\.4\.2/);
  assert.match(html, /Official Themes/);
  assert.match(html, /Arcus/);
  assert.match(html, /ekily-connect/);
  assert.match(html, /Publish Telemetry/);
  assert.match(html, /1 ok \/ 0 failed/);
});

test('renderProductStateDashboard surfaces Connect publish telemetry drift', () => {
  const html = renderProductStateDashboard(sampleState({
    status: 'drift',
    connect: {
      status: 'drift',
      service: 'ekily-connect',
      publishTelemetry: {
        status: 'drift',
        publishSuccess: 0,
        publishFailure: 2
      }
    }
  }));

  assert.match(html, /Publish Telemetry/);
  assert.match(html, /0 ok \/ 2 failed/);
  assert.match(html, /class="status drift">drift/);
});

test('renderProductStateDashboard includes drift problems without trusting markup', () => {
  const html = renderProductStateDashboard(sampleState({
    status: 'drift',
    problems: [
      {
        severity: 'error',
        component: 'themes.arcus',
        message: '<bad>manifest drift</bad>',
        blocking: true
      }
    ]
  }));
  assert.match(html, /themes\.arcus/);
  assert.match(html, /&lt;bad&gt;manifest drift&lt;\/bad&gt;/);
  assert.doesNotMatch(html, /<bad>/);
});
