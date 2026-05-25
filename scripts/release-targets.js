const DEFAULT_RAW_ROOT = 'https://raw.githubusercontent.com';
const RELEASE_EVENT_TYPE = 'press-system-release';

const RELEASE_TARGETS = Object.freeze([
  {
    key: 'yap',
    category: 'downstream',
    label: 'YAP starter runtime',
    repository: 'EkilyHQ/YAP',
    eventType: RELEASE_EVENT_TYPE,
    observed: {
      ref: 'main',
      path: 'assets/press-system.json',
      type: 'press-system-manifest'
    },
    reconciler: {
      kind: 'press-runtime-sync',
      idempotent: true
    }
  },
  {
    key: 'themeStarter',
    category: 'downstream',
    label: 'Theme starter marker',
    repository: 'EkilyHQ/Press-Theme-Starter',
    eventType: RELEASE_EVENT_TYPE,
    observed: {
      ref: 'main',
      path: 'press-system-release.json',
      type: 'press-release-marker'
    },
    reconciler: {
      kind: 'theme-starter-marker-sync',
      idempotent: true
    }
  },
  {
    key: 'arcus',
    category: 'themeDemo',
    label: 'Arcus demo runtime',
    repository: 'EkilyHQ/Press-Theme-Arcus',
    eventType: RELEASE_EVENT_TYPE,
    observed: {
      ref: 'demo',
      path: 'assets/press-system.json',
      type: 'press-system-manifest'
    },
    reconciler: {
      kind: 'theme-demo-runtime-sync',
      idempotent: true
    }
  },
  {
    key: 'cartograph',
    category: 'themeDemo',
    label: 'Cartograph demo runtime',
    repository: 'EkilyHQ/Press-Theme-Cartograph',
    eventType: RELEASE_EVENT_TYPE,
    observed: {
      ref: 'demo',
      path: 'assets/press-system.json',
      type: 'press-system-manifest'
    },
    reconciler: {
      kind: 'theme-demo-runtime-sync',
      idempotent: true
    }
  },
  {
    key: 'glasswing',
    category: 'themeDemo',
    label: 'Glasswing demo runtime',
    repository: 'EkilyHQ/Press-Theme-Glasswing',
    eventType: RELEASE_EVENT_TYPE,
    observed: {
      ref: 'demo',
      path: 'assets/press-system.json',
      type: 'press-system-manifest'
    },
    reconciler: {
      kind: 'theme-demo-runtime-sync',
      idempotent: true
    }
  },
  {
    key: 'solstice',
    category: 'themeDemo',
    label: 'Solstice demo runtime',
    repository: 'EkilyHQ/Press-Theme-Solstice',
    eventType: RELEASE_EVENT_TYPE,
    observed: {
      ref: 'demo',
      path: 'assets/press-system.json',
      type: 'press-system-manifest'
    },
    reconciler: {
      kind: 'theme-demo-runtime-sync',
      idempotent: true
    }
  }
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rawRoot(value = DEFAULT_RAW_ROOT) {
  return String(value || DEFAULT_RAW_ROOT).replace(/\/+$/u, '');
}

function observedSource(target, root = DEFAULT_RAW_ROOT) {
  return `${rawRoot(root)}/${target.repository}/${target.observed.ref}/${target.observed.path}`;
}

function getReleaseTargets() {
  return clone(RELEASE_TARGETS);
}

function getReleaseDispatchTargets() {
  return getReleaseTargets().map((target) => ({
    repository: target.repository,
    eventType: target.eventType,
    label: target.label
  }));
}

function productStateSourceFromTarget(target, root = DEFAULT_RAW_ROOT) {
  return {
    key: target.key,
    label: target.label,
    repository: target.repository,
    source: observedSource(target, root),
    type: target.observed.type,
    eventType: target.eventType,
    reconciler: {
      eventType: target.eventType,
      kind: target.reconciler.kind,
      idempotent: target.reconciler.idempotent !== false
    }
  };
}

function getReleaseProductStateSources(root = DEFAULT_RAW_ROOT) {
  const sources = {
    downstream: [],
    themeDemos: []
  };
  getReleaseTargets().forEach((target) => {
    const source = productStateSourceFromTarget(target, root);
    if (target.category === 'downstream') sources.downstream.push(source);
    if (target.category === 'themeDemo') sources.themeDemos.push(source);
  });
  return sources;
}

function validateReleaseTargets(targets = RELEASE_TARGETS) {
  const failures = [];
  const seenKeys = new Set();
  const seenRepositories = new Set();
  targets.forEach((target, index) => {
    const prefix = `releaseTargets[${index}]`;
    const key = String(target && target.key || '').trim();
    const category = String(target && target.category || '').trim();
    const repository = String(target && target.repository || '').trim();
    const eventType = String(target && target.eventType || '').trim();
    const observed = target && target.observed && typeof target.observed === 'object' ? target.observed : {};
    const reconciler = target && target.reconciler && typeof target.reconciler === 'object' ? target.reconciler : {};
    if (!key) failures.push(`${prefix}.key is required`);
    else if (seenKeys.has(key)) failures.push(`${prefix}.key duplicates ${key}`);
    else seenKeys.add(key);
    if (!['downstream', 'themeDemo'].includes(category)) failures.push(`${prefix}.category must be downstream or themeDemo`);
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) failures.push(`${prefix}.repository is invalid`);
    else if (seenRepositories.has(repository)) failures.push(`${prefix}.repository duplicates ${repository}`);
    else seenRepositories.add(repository);
    if (eventType !== RELEASE_EVENT_TYPE) failures.push(`${prefix}.eventType must be ${RELEASE_EVENT_TYPE}`);
    if (!String(target && target.label || '').trim()) failures.push(`${prefix}.label is required`);
    if (!['main', 'demo'].includes(String(observed.ref || '').trim())) failures.push(`${prefix}.observed.ref must be main or demo`);
    if (!String(observed.path || '').trim()) failures.push(`${prefix}.observed.path is required`);
    if (!['press-system-manifest', 'press-release-marker'].includes(String(observed.type || '').trim())) {
      failures.push(`${prefix}.observed.type is invalid`);
    }
    if (!String(reconciler.kind || '').trim()) failures.push(`${prefix}.reconciler.kind is required`);
    if (reconciler.idempotent !== true) failures.push(`${prefix}.reconciler.idempotent must be true`);
  });
  return failures;
}

module.exports = {
  DEFAULT_RAW_ROOT,
  RELEASE_EVENT_TYPE,
  RELEASE_TARGETS,
  getReleaseDispatchTargets,
  getReleaseProductStateSources,
  getReleaseTargets,
  validateReleaseTargets
};
