#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function statusClass(status) {
  const value = String(status || '').trim().toLowerCase();
  return ['ok', 'pending', 'unknown', 'drift', 'warning', 'error'].includes(value) ? value : 'unknown';
}

function statusBadge(status) {
  const value = statusClass(status);
  return `<span class="status ${value}">${escapeHtml(value)}</span>`;
}

function semverLabel(version) {
  const value = String(version || '').trim();
  return value ? `v${value}` : '';
}

function valueOrDash(value) {
  const raw = String(value == null ? '' : value).trim();
  return raw || '-';
}

function renderRows(rows) {
  if (!rows.length) {
    return '<p class="empty">No entries.</p>';
  }
  return [
    '<table>',
    '<thead><tr><th>Name</th><th>Status</th><th>Expected</th><th>Observed</th><th>Owner</th></tr></thead>',
    '<tbody>',
    ...rows.map((row) => [
      '<tr>',
      `<td>${escapeHtml(valueOrDash(row.name))}</td>`,
      `<td>${statusBadge(row.status)}</td>`,
      `<td>${escapeHtml(valueOrDash(row.expected))}</td>`,
      `<td>${escapeHtml(valueOrDash(row.observed))}</td>`,
      `<td>${escapeHtml(valueOrDash(row.owner))}</td>`,
      '</tr>'
    ].join('')),
    '</tbody>',
    '</table>'
  ].join('\n');
}

function renderTargetRows(rows) {
  if (!rows.length) {
    return '<p class="empty">No release targets.</p>';
  }
  return [
    '<table>',
    '<thead><tr><th>Name</th><th>Expected</th><th>Reconciler</th><th>Owner</th></tr></thead>',
    '<tbody>',
    ...rows.map((row) => [
      '<tr>',
      `<td>${escapeHtml(valueOrDash(row.name))}</td>`,
      `<td>${escapeHtml(valueOrDash(row.expected))}</td>`,
      `<td>${escapeHtml(valueOrDash(row.reconciler))}</td>`,
      `<td>${escapeHtml(valueOrDash(row.owner))}</td>`,
      '</tr>'
    ].join('')),
    '</tbody>',
    '</table>'
  ].join('\n');
}

function renderProblems(problems) {
  const items = Array.isArray(problems) ? problems : [];
  if (!items.length) return '<p class="empty">No problems recorded.</p>';
  return [
    '<ul class="problems">',
    ...items.map((problem) => {
      const blocking = problem && problem.blocking === false ? 'non-blocking' : 'blocking';
      return `<li><strong>${escapeHtml(valueOrDash(problem.component))}</strong> ${statusBadge(problem.severity || 'error')} <span>${escapeHtml(problem.message || '')}</span> <em>${escapeHtml(blocking)}</em></li>`;
    }),
    '</ul>'
  ].join('\n');
}

function dashboardRowsFromMap(input) {
  return Object.entries(input && typeof input === 'object' ? input : {}).map(([key, entry]) => ({
    name: entry.label || key,
    status: entry.status,
    expected: semverLabel(entry.expectedVersion),
    observed: semverLabel(entry.observedVersion),
    owner: entry.repository || entry.owner || ''
  }));
}

function desiredRows(state) {
  const desired = state && state.desired && typeof state.desired === 'object' ? state.desired : {};
  const pressSystem = desired.pressSystem && typeof desired.pressSystem === 'object' ? desired.pressSystem : {};
  const rows = [];
  if (pressSystem.version || pressSystem.tag) {
    rows.push({
      name: 'Press system release',
      expected: pressSystem.tag || semverLabel(pressSystem.version),
      reconciler: 'immutable artifact',
      owner: pressSystem.repository || ''
    });
  }
  [
    ...(Object.entries(desired.downstream && typeof desired.downstream === 'object' ? desired.downstream : {})),
    ...(Object.entries(desired.themeDemos && typeof desired.themeDemos === 'object' ? desired.themeDemos : {}))
  ].forEach(([key, entry]) => {
    const reconciler = entry.reconciler && typeof entry.reconciler === 'object' ? entry.reconciler : {};
    rows.push({
      name: entry.label || key,
      expected: entry.expectedTag || semverLabel(entry.expectedVersion),
      reconciler: reconciler.kind || reconciler.eventType || '',
      owner: entry.repository || ''
    });
  });
  const themeEntries = desired.themes && Array.isArray(desired.themes.entries) ? desired.themes.entries : [];
  themeEntries.forEach((entry) => {
    rows.push({
      name: entry.label || entry.slug,
      expected: entry.expectedPressVersion ? `Press ${semverLabel(entry.expectedPressVersion)}` : '',
      reconciler: 'theme-release-compatibility',
      owner: entry.repository || ''
    });
  });
  return rows;
}

function themeRows(state) {
  const entries = state && state.themes && Array.isArray(state.themes.entries) ? state.themes.entries : [];
  return entries.map((entry) => ({
    name: entry.label || entry.slug,
    status: entry.status,
    expected: entry.engines && entry.engines.press ? entry.engines.press : '',
    observed: semverLabel(entry.version),
    owner: entry.repository || ''
  }));
}

function themeDemoRows(state) {
  return Object.entries(state && state.themeDemos && typeof state.themeDemos === 'object' ? state.themeDemos : {}).map(([key, entry]) => {
    const installed = entry.installedTheme && typeof entry.installedTheme === 'object' ? entry.installedTheme : {};
    const pressExpected = semverLabel(entry.expectedVersion);
    const pressObserved = semverLabel(entry.observedVersion);
    const themeExpected = semverLabel(installed.expectedVersion);
    const themeObserved = semverLabel(installed.observedVersion);
    return {
      name: entry.label || key,
      status: entry.status,
      expected: [
        pressExpected ? `Press ${pressExpected}` : '',
        themeExpected ? `Theme ${themeExpected}` : ''
      ].filter(Boolean).join(' / '),
      observed: [
        pressObserved ? `Press ${pressObserved}` : '',
        themeObserved ? `Theme ${themeObserved}` : ''
      ].filter(Boolean).join(' / '),
      owner: entry.repository || ''
    };
  });
}

function renderProductStateDashboard(state) {
  const source = state && typeof state === 'object' ? state : {};
  const pressSystem = source.pressSystem && typeof source.pressSystem === 'object' ? source.pressSystem : {};
  const themes = source.themes && typeof source.themes === 'object' ? source.themes : {};
  const catalog = themes.catalog && typeof themes.catalog === 'object' ? themes.catalog : {};
  const connect = source.connect && typeof source.connect === 'object' ? source.connect : {};
  const publishTelemetry = connect.publishTelemetry && typeof connect.publishTelemetry === 'object'
    ? connect.publishTelemetry
    : {};
  const verdict = source.verdict && typeof source.verdict === 'object' ? source.verdict : {};
  const runtime = pressSystem.runtime && typeof pressSystem.runtime === 'object' ? pressSystem.runtime : {};
  const generatedAt = valueOrDash(source.generatedAt);
  const pressVersion = semverLabel(pressSystem.version);
  const runtimeSummary = `${Number(runtime.entryCount || 0)} files / ${Number(runtime.edgeCount || 0)} edges`;
  const verdictStatus = verdict.status || source.status;
  const title = `Ekily Product State ${statusClass(verdictStatus)}`;
  const convergenceLabel = verdict.converged === true ? 'yes' : 'no';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #17202a; }
    body { margin: 0; }
    main { width: min(1120px, calc(100vw - 32px)); margin: 0 auto; padding: 32px 0 48px; }
    header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: clamp(1.8rem, 4vw, 3rem); line-height: 1; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 1.05rem; letter-spacing: 0; }
    p { margin: 0; }
    .meta { color: #5e6a78; font-size: .9rem; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }
    .metric { border: 1px solid #d8dee6; border-radius: 8px; background: #fff; padding: 14px; min-height: 82px; }
    .metric span { display: block; color: #5e6a78; font-size: .78rem; font-weight: 700; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 8px; font-size: 1.1rem; }
    section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border: 1px solid #d8dee6; border-radius: 8px; background: #fff; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e7ebf0; text-align: left; vertical-align: top; font-size: .92rem; }
    th { color: #526070; font-size: .76rem; text-transform: uppercase; letter-spacing: 0; }
    tr:last-child td { border-bottom: 0; }
    .status { display: inline-flex; align-items: center; min-width: 72px; justify-content: center; border-radius: 999px; padding: 3px 9px; font-size: .78rem; font-weight: 700; text-transform: uppercase; }
    .status.ok { background: #ddf7e9; color: #11663b; }
    .status.pending { background: #fff0c2; color: #7a4d00; }
    .status.unknown { background: #e9edf3; color: #3f4d5e; }
    .status.warning { background: #fff0c2; color: #7a4d00; }
    .status.drift, .status.error { background: #ffe0df; color: #9c2925; }
    .empty { color: #667484; padding: 12px 0; }
    .problems { margin: 0; padding-left: 20px; }
    .problems li { margin: 8px 0; }
    .problems em { color: #667484; font-style: normal; margin-left: 6px; }
    @media (prefers-color-scheme: dark) {
      :root { background: #11161d; color: #edf2f7; }
      .metric, table { background: #18212b; border-color: #2a3441; }
      th, td { border-bottom-color: #283442; }
      .meta, .metric span, th, .empty, .problems em { color: #9aa7b5; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Ekily Product State</h1>
        <p class="meta">Generated ${escapeHtml(generatedAt)}</p>
      </div>
      ${statusBadge(verdictStatus)}
    </header>

    <div class="summary">
      <div class="metric"><span>Press System</span><strong>${escapeHtml(pressVersion || '-')} ${statusBadge(pressSystem.status)}</strong></div>
      <div class="metric"><span>Runtime Graph</span><strong>${escapeHtml(runtimeSummary)}</strong></div>
      <div class="metric"><span>Converged</span><strong>${escapeHtml(convergenceLabel)} ${statusBadge(verdictStatus)}</strong></div>
      <div class="metric"><span>Catalog</span><strong>${escapeHtml(String(catalog.count || 0))} themes ${statusBadge(catalog.status)}</strong></div>
      <div class="metric"><span>Connect</span><strong>${escapeHtml(valueOrDash(connect.service || connect.label))} ${statusBadge(connect.status)}</strong></div>
      <div class="metric"><span>Publish Telemetry</span><strong>${escapeHtml(String(Number(publishTelemetry.publishSuccess || 0)))} ok / ${escapeHtml(String(Number(publishTelemetry.publishFailure || 0)))} failed ${statusBadge(publishTelemetry.status)}</strong></div>
      <div class="metric"><span>Blocking Problems</span><strong>${escapeHtml(String(Number(verdict.blockingProblemCount || 0)))}</strong></div>
    </div>

    <section>
      <h2>Desired Release Target</h2>
      ${renderTargetRows(desiredRows(source))}
    </section>

    <section>
      <h2>Downstream Runtime</h2>
      ${renderRows(dashboardRowsFromMap(source.downstream))}
    </section>

    <section>
      <h2>Theme Demo Channels</h2>
      ${renderRows(themeDemoRows(source))}
    </section>

    <section>
      <h2>Official Themes</h2>
      ${renderRows(themeRows(source))}
    </section>

    <section>
      <h2>Problems</h2>
      ${renderProblems(source.problems)}
    </section>
  </main>
</body>
</html>
`;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--state') options.state = argv[++i] || '';
    else if (arg === '--out') options.out = argv[++i] || '';
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function printHelp() {
  console.log([
    'usage: node scripts/product-state-dashboard.js --state <path> --out <path>',
    '',
    'Options:',
    '  --state <path>  Product-state JSON file',
    '  --out <path>    HTML dashboard output path'
  ].join('\n'));
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return 0;
  }
  if (!options.state || !options.out) throw new Error('--state and --out are required');
  const state = readJsonFile(options.state);
  const html = renderProductStateDashboard(state);
  fs.mkdirSync(path.dirname(path.resolve(options.out)), { recursive: true });
  fs.writeFileSync(options.out, html);
  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  });
}

module.exports = {
  escapeHtml,
  renderProductStateDashboard,
  statusClass
};
