function isElement(value) {
  return value && typeof value === 'object' && value.nodeType === 1;
}

function lookupRegion(regions, name) {
  const key = String(name || '').trim();
  if (!key || !regions || typeof regions !== 'object') return null;
  if (isElement(regions[key])) return regions[key];
  return null;
}

function defineRegistryMethods(regions) {
  if (!regions || typeof regions !== 'object') return regions;
  if (typeof regions.get === 'function' && typeof regions.register === 'function') return regions;

  Object.defineProperties(regions, {
    get: {
      value(name) {
        return lookupRegion(this, name);
      },
      enumerable: false
    },
    has: {
      value(name) {
        return !!lookupRegion(this, name);
      },
      enumerable: false
    },
    register: {
      value(name, element) {
        const key = String(name || '').trim();
        if (!key || !isElement(element)) return this;
        this[key] = element;
        return this;
      },
      enumerable: false
    },
    registerMany: {
      value(next = {}) {
        if (!next || typeof next !== 'object') return this;
        Object.entries(next).forEach(([key, element]) => {
          this.register(key, element);
        });
        return this;
      },
      enumerable: false
    },
    list: {
      value() {
        return Object.keys(this).sort();
      },
      enumerable: false
    },
    snapshot: {
      value() {
        return this.list().reduce((out, key) => {
          out[key] = this[key];
          return out;
        }, {});
      },
      enumerable: false
    }
  });
  return regions;
}

export function createThemeRegionRegistry(initial = {}) {
  const regions = {};
  defineRegistryMethods(regions);
  regions.registerMany(initial);
  return regions;
}

export function ensureThemeRegionRegistry(regions = {}) {
  const registry = defineRegistryMethods(regions && typeof regions === 'object' ? regions : {});
  return registry || createThemeRegionRegistry();
}

export function mergeThemeRegions(current = {}, next = {}) {
  const registry = ensureThemeRegionRegistry(current);
  registry.registerMany(next);
  return registry;
}

function normalizeThemeLayoutContext(context) {
  if (context && typeof context === 'object') {
    context.regions = ensureThemeRegionRegistry(context.regions);
    return context;
  }
  return null;
}

function getThemeRegionFromContext(context, names) {
  const list = Array.isArray(names) ? names : [names];
  const regions = context && context.regions && typeof context.regions === 'object'
    ? ensureThemeRegionRegistry(context.regions)
    : createThemeRegionRegistry();
  for (const name of list) {
    const key = String(name || '').trim();
    if (!key) continue;
    const region = typeof regions.get === 'function' ? regions.get(key) : lookupRegion(regions, key);
    if (region) return region;
  }
  return null;
}

export function createThemeRegionController(initialContext = null) {
  let contextRef = normalizeThemeLayoutContext(initialContext);
  return {
    setThemeLayoutContext(context) {
      contextRef = normalizeThemeLayoutContext(context);
      return contextRef;
    },
    getThemeLayoutContext() {
      return contextRef;
    },
    getThemeRegion(names) {
      return getThemeRegionFromContext(contextRef, names);
    }
  };
}

const defaultThemeRegionController = createThemeRegionController();

export function getDefaultThemeRegionController() {
  return defaultThemeRegionController;
}

export function setThemeLayoutContext(context) {
  return defaultThemeRegionController.setThemeLayoutContext(context);
}

export function getThemeLayoutContext() {
  return defaultThemeRegionController.getThemeLayoutContext();
}

export function getThemeRegion(names) {
  return defaultThemeRegionController.getThemeRegion(names);
}
