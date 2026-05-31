const EFFECT_KINDS = Object.freeze(['document', 'fetch', 'storage', 'timer', 'window']);

const AMBIENT_EFFECT_PATTERNS = Object.freeze([
  Object.freeze({
    kind: 'window',
    pattern: /\btypeof\s+window\b|(^|[^\w$.-])window\.|resolveAmbientValue\('window'\)/
  }),
  Object.freeze({
    kind: 'document',
    pattern: /\btypeof\s+document\b|(^|[^\w$.-])document\.|resolveAmbientValue\('document'\)/
  }),
  Object.freeze({
    kind: 'storage',
    pattern: /\btypeof\s+(?:localStorage|sessionStorage)\b|(^|[^\w$.-])(?:localStorage|sessionStorage)\.|windowRef\.(?:localStorage|sessionStorage)|scope\.(?:localStorage|sessionStorage)/
  }),
  Object.freeze({
    kind: 'fetch',
    pattern: /\btypeof\s+fetch\b|(^|[^\w$.-])fetch\s*\(|resolveAmbientFunction\('fetch'\)/
  }),
  Object.freeze({
    kind: 'timer',
    pattern: /(^|[^\w$.])(?:setTimeout|clearTimeout|setInterval|clearInterval)\s*\(|\b(?:window|windowRef|scope|globalThis)\.(?:setTimeout|clearTimeout|setInterval|clearInterval)\s*\(|resolveAmbientFunction\('(?:setTimeout|clearTimeout|setInterval|clearInterval)'\)/
  })
]);

export const EDITOR_EFFECT_AMBIENT_ALLOWLIST = Object.freeze([
  Object.freeze({
    module: 'assets/js/editor-app-runtime.js',
    effects: Object.freeze(['document', 'timer', 'window']),
    reason: 'root browser adapter that turns ambient globals into injected runtime refs'
  }),
  Object.freeze({
    module: 'assets/js/editor-main.js',
    effects: Object.freeze(['document', 'window']),
    reason: 'browser auto-start guard for the standalone editor entrypoint'
  }),
  Object.freeze({
    module: 'assets/js/theme-manager.js',
    effects: Object.freeze(['document', 'fetch']),
    reason: 'Theme Manager can still run standalone when composer does not inject refs'
  }),
  Object.freeze({
    module: 'assets/js/system-updates.js',
    effects: Object.freeze(['document', 'fetch']),
    reason: 'System Updates can still run standalone when composer does not inject refs'
  }),
  Object.freeze({
    module: 'assets/js/composer-publish-flow.js',
    effects: Object.freeze(['fetch', 'storage', 'timer']),
    reason: 'legacy browser-local publish fallback; Connect durable publish remains the preferred path'
  }),
  Object.freeze({
    module: 'assets/js/publish/propagation-watcher.js',
    effects: Object.freeze(['fetch', 'timer']),
    reason: 'portable propagation observer may run outside the composer runtime'
  }),
  Object.freeze({
    module: 'assets/js/publish/transports/connect-transport.js',
    effects: Object.freeze(['document', 'fetch', 'timer', 'window']),
    reason: 'popup OAuth transport and async status polling may run with only ambient browser refs'
  }),
  Object.freeze({
    module: 'assets/js/publish/transports/github-pat-transport.js',
    effects: Object.freeze(['fetch']),
    reason: 'PAT transport keeps a browser fallback for non-Connect sites'
  })
]);

function unique(values) {
  return [...new Set(values)];
}

function normalizeModulePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

export function getEditorEffectAmbientAllowlist() {
  return EDITOR_EFFECT_AMBIENT_ALLOWLIST.map(entry => ({
    module: entry.module,
    effects: entry.effects.slice(),
    reason: entry.reason
  }));
}

export function collectAmbientEffectUsages(modulePath, source) {
  const normalizedPath = normalizeModulePath(modulePath);
  return String(source || '')
    .split(/\r?\n/)
    .flatMap((line, index) => AMBIENT_EFFECT_PATTERNS
      .filter(entry => entry.pattern.test(line))
      .map(entry => ({
        module: normalizedPath,
        line: index + 1,
        kind: entry.kind,
        excerpt: line.trim()
      })));
}

export function validateEditorEffectAmbientBoundary(sourceByModule, allowlist = EDITOR_EFFECT_AMBIENT_ALLOWLIST) {
  const failures = [];
  const allowedKinds = new Set(EFFECT_KINDS);
  const allowByModule = new Map();

  (Array.isArray(allowlist) ? allowlist : []).forEach((entry, index) => {
    const modulePath = normalizeModulePath(entry && entry.module);
    const effects = Array.isArray(entry && entry.effects) ? unique(entry.effects.map(String)) : [];
    const reason = String((entry && entry.reason) || '').trim();
    if (!modulePath) failures.push(`effects allowlist[${index}].module is required`);
    if (!effects.length) failures.push(`effects allowlist[${index}].effects is required`);
    if (!reason) failures.push(`effects allowlist[${index}].reason is required`);
    effects.forEach((kind) => {
      if (!allowedKinds.has(kind)) failures.push(`effects allowlist[${index}] has unknown effect "${kind}"`);
    });
    if (modulePath) allowByModule.set(modulePath, new Set(effects));
  });

  const entries = sourceByModule instanceof Map
    ? [...sourceByModule.entries()]
    : Object.entries(sourceByModule || {});
  entries.forEach(([modulePath, source]) => {
    const normalizedPath = normalizeModulePath(modulePath);
    const allowed = allowByModule.get(normalizedPath) || new Set();
    collectAmbientEffectUsages(normalizedPath, source).forEach((usage) => {
      if (!allowed.has(usage.kind)) {
        failures.push(`${usage.module}:${usage.line} uses ambient ${usage.kind}: ${usage.excerpt}`);
      }
    });
  });

  return failures;
}
