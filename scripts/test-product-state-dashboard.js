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
    themeDemos: {},
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
    connect: { status: 'ok', service: 'ekily-connect' },
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
  assert.match(html, /125 files \/ 300 edges/);
  assert.match(html, /v3\.4\.52/);
  assert.match(html, /YAP starter runtime/);
  assert.match(html, /Official Themes/);
  assert.match(html, /Arcus/);
  assert.match(html, /ekily-connect/);
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
