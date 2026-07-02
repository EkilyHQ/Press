export const SITE_FEATURE_KEYS = Object.freeze([
  'search',
  'editorEntry',
  'visitorThemeControls',
  'languageSwitcher',
  'allPosts',
  'footerNav',
  'profileLinks',
  'tags',
  'toc',
  'postMeta',
  'comments'
]);

const SITE_FEATURE_KEY_SET = new Set(SITE_FEATURE_KEYS);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeFeatureBoolean(value, fallback = null) {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on', 'enabled'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off', 'disabled'].includes(normalized)) return false;
  }
  return fallback;
}

function readFeatureEnabled(features, key) {
  if (!isPlainObject(features) || !SITE_FEATURE_KEY_SET.has(key)) return null;
  if (!Object.prototype.hasOwnProperty.call(features, key)) return null;
  const raw = features[key];
  if (isPlainObject(raw) && Object.prototype.hasOwnProperty.call(raw, 'enabled')) {
    return normalizeFeatureBoolean(raw.enabled);
  }
  return normalizeFeatureBoolean(raw);
}

function resolveLegacyAllPosts(siteConfig = {}) {
  const showAllPosts = normalizeFeatureBoolean(siteConfig.showAllPosts);
  if (showAllPosts != null) return showAllPosts;
  const enableAllPosts = normalizeFeatureBoolean(siteConfig.enableAllPosts);
  if (enableAllPosts != null) return enableAllPosts;
  const disableAllPosts = normalizeFeatureBoolean(siteConfig.disableAllPosts);
  if (disableAllPosts != null) return !disableAllPosts;
  return true;
}

export function resolveSiteFeatures(siteConfig = {}) {
  const cfg = isPlainObject(siteConfig) ? siteConfig : {};
  const features = isPlainObject(cfg.features) ? cfg.features : {};
  const resolved = {};
  SITE_FEATURE_KEYS.forEach((key) => {
    const explicit = readFeatureEnabled(features, key);
    if (explicit != null) {
      resolved[key] = explicit;
    } else if (key === 'allPosts') {
      resolved[key] = resolveLegacyAllPosts(cfg);
    } else {
      resolved[key] = true;
    }
  });
  return resolved;
}

export function isSiteFeatureEnabled(siteConfig = {}, key) {
  const normalizedKey = String(key || '').trim();
  if (!SITE_FEATURE_KEY_SET.has(normalizedKey)) return true;
  return resolveSiteFeatures(siteConfig)[normalizedKey] !== false;
}

export function normalizeSiteFeatureSettings(value) {
  const source = isPlainObject(value) ? value : {};
  const out = {};
  SITE_FEATURE_KEYS.forEach((key) => {
    const enabled = readFeatureEnabled(source, key);
    out[key] = enabled == null ? null : enabled;
  });
  return out;
}

export function siteFeatureSettingsForOutput(settings = {}) {
  const source = isPlainObject(settings) ? settings : {};
  const out = {};
  SITE_FEATURE_KEYS.forEach((key) => {
    const enabled = normalizeFeatureBoolean(source[key]);
    if (enabled != null) out[key] = { enabled };
  });
  return Object.keys(out).length ? out : null;
}

export function createSiteFeatureContext(siteConfig = {}) {
  const flags = resolveSiteFeatures(siteConfig);
  return {
    flags,
    isEnabled(key) {
      const normalizedKey = String(key || '').trim();
      if (!SITE_FEATURE_KEY_SET.has(normalizedKey)) return true;
      return flags[normalizedKey] !== false;
    }
  };
}

export function siteFeatureContextEnabled(features, key) {
  const normalizedKey = String(key || '').trim();
  if (!SITE_FEATURE_KEY_SET.has(normalizedKey)) return true;
  if (features && typeof features.isEnabled === 'function') {
    try { return features.isEnabled(normalizedKey) !== false; } catch (_) {}
  }
  const flags = features && isPlainObject(features.flags) ? features.flags : features;
  if (isPlainObject(flags) && Object.prototype.hasOwnProperty.call(flags, normalizedKey)) {
    return flags[normalizedKey] !== false;
  }
  return true;
}
