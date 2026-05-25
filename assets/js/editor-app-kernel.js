const DEFAULT_PHASES = Object.freeze(['init', 'bind', 'start']);

function safeName(value) {
  return String(value || '').trim();
}

function normalizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(safeName).filter(Boolean);
}

function makeKernelError(appName, message) {
  return new Error(`${appName}: ${message}`);
}

function normalizeFeature(feature, appName) {
  if (!feature || typeof feature !== 'object') {
    throw makeKernelError(appName, 'feature must be an object');
  }
  const name = safeName(feature.name);
  if (!name) throw makeKernelError(appName, 'feature name is required');
  return {
    ...feature,
    name,
    requires: normalizeList(feature.requires),
    provides: normalizeList(feature.provides)
  };
}

function sortFeatures(features, initialProvides, appName) {
  const providerByToken = new Map();
  const initialTokens = new Set(normalizeList(initialProvides));
  const featureNames = new Set();

  features.forEach((feature) => {
    if (featureNames.has(feature.name)) {
      throw makeKernelError(appName, `duplicate feature "${feature.name}"`);
    }
    featureNames.add(feature.name);
    [feature.name, ...feature.provides].forEach((token) => {
      if (initialTokens.has(token)) {
        throw makeKernelError(appName, `feature "${feature.name}" provides initial token "${token}"`);
      }
      const previous = providerByToken.get(token);
      if (previous) {
        throw makeKernelError(appName, `token "${token}" is provided by both "${previous.name}" and "${feature.name}"`);
      }
      providerByToken.set(token, feature);
    });
  });

  features.forEach((feature) => {
    feature.requires.forEach((token) => {
      if (!initialTokens.has(token) && !providerByToken.has(token)) {
        throw makeKernelError(appName, `feature "${feature.name}" requires missing token "${token}"`);
      }
      if (feature.provides.includes(token) || feature.name === token) {
        throw makeKernelError(appName, `feature "${feature.name}" requires token "${token}" that it provides itself`);
      }
    });
  });

  const edges = new Map(features.map(feature => [feature.name, new Set()]));
  features.forEach((feature) => {
    feature.requires.forEach((token) => {
      if (initialTokens.has(token)) return;
      const provider = providerByToken.get(token);
      if (provider && provider.name !== feature.name) edges.get(feature.name).add(provider.name);
    });
  });

  const sorted = [];
  const temporary = new Set();
  const permanent = new Set();
  const byName = new Map(features.map(feature => [feature.name, feature]));

  function visit(name, path = []) {
    if (permanent.has(name)) return;
    if (temporary.has(name)) {
      throw makeKernelError(appName, `feature dependency cycle: ${[...path, name].join(' -> ')}`);
    }
    temporary.add(name);
    [...(edges.get(name) || [])].forEach(dep => visit(dep, [...path, name]));
    temporary.delete(name);
    permanent.add(name);
    sorted.push(byName.get(name));
  }

  features.forEach(feature => visit(feature.name));
  return sorted;
}

export function createEditorAppKernel(options = {}) {
  const appName = safeName(options.name) || 'editor-app';
  const phases = normalizeList(options.phases).length ? normalizeList(options.phases) : [...DEFAULT_PHASES];
  const initialProvides = normalizeList(options.provides || options.initialProvides);
  const baseContext = options.context && typeof options.context === 'object' ? options.context : {};
  const features = [];

  function registerFeature(feature) {
    const normalized = normalizeFeature(feature, appName);
    features.push(normalized);
    return normalized;
  }

  async function run(extraContext = {}) {
    const orderedFeatures = sortFeatures(features, initialProvides, appName);
    const context = {
      ...baseContext,
      ...extraContext,
      appName,
      lifecycle: Object.freeze({
        phases: [...phases],
        features: orderedFeatures.map(feature => ({
          name: feature.name,
          requires: [...feature.requires],
          provides: [...feature.provides]
        }))
      })
    };

    for (const phase of phases) {
      for (const feature of orderedFeatures) {
        const handler = feature[phase];
        if (typeof handler === 'function') await handler(context);
      }
    }

    return {
      context,
      features: orderedFeatures
    };
  }

  return {
    registerFeature,
    run,
    getLifecyclePlan: () => sortFeatures(features, initialProvides, appName).map(feature => ({
      name: feature.name,
      requires: [...feature.requires],
      provides: [...feature.provides]
    })),
    getFeatures: () => features.map(feature => ({
      name: feature.name,
      requires: [...feature.requires],
      provides: [...feature.provides]
    }))
  };
}

export function runEditorFeatureLifecycle(features, options = {}) {
  const kernel = createEditorAppKernel(options);
  (Array.isArray(features) ? features : []).forEach(feature => kernel.registerFeature(feature));
  return kernel.run();
}
