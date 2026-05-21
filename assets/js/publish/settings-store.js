export const GITHUB_PAT_STORAGE_KEY = 'press_fg_pat_cache';
export const CONNECT_PUBLISH_GRANT_STORAGE_KEY = 'press_connect_publish_grant_cache';
export const CONNECT_PUBLISH_ENABLED_STORAGE_KEY = 'press_connect_publish_enabled';
export const CONNECT_PUBLISH_BASE_URL_STORAGE_KEY = 'press_connect_publish_base_url';
export const PUBLISH_TRANSPORT_MODE_STORAGE_KEY = 'press_publish_transport_mode';
export const CONNECT_PUBLISH_MESSAGE_TYPE = 'press-connect-publish-authorized';
export const CONNECT_PUBLISH_PRESETS = [
  { value: 'https://connect-8mr.pages.dev', label: 'Ekily Connect' },
  { value: 'http://127.0.0.1:8788', label: 'Local Connect' }
];

export function isLocalhostHost(hostname) {
  const value = String(hostname || '').toLowerCase();
  return value === 'localhost' || value === '127.0.0.1' || value === '::1' || value === '[::1]';
}

export function getDefaultConnectPublishBaseUrl() {
  return CONNECT_PUBLISH_PRESETS[0].value;
}

export function normalizeConnectPublishBaseUrl(value) {
  const rawBaseUrl = String(value || '').trim();
  if (!rawBaseUrl) return null;
  try {
    const url = new URL(rawBaseUrl);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhostHost(url.hostname))) return null;
    return url.origin;
  } catch (_) {
    return null;
  }
}

export function isUsableConnectPublishGrant(grant) {
  if (!grant || typeof grant !== 'object' || !grant.token) return false;
  const expiresAt = Number(grant.expiresAt || 0);
  return Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000) + 30;
}

export function createPublishSettingsStore(options = {}) {
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const scopeKey = typeof options.scopeKey === 'function' ? options.scopeKey : (key) => key;
  let cachedFineGrainedTokenMemory = '';
  let cachedConnectPublishGrantMemory = null;
  let cachedConnectPublishSettingsMemory = null;

  const session = () => windowRef && windowRef.sessionStorage ? windowRef.sessionStorage : null;
  const local = () => windowRef && windowRef.localStorage ? windowRef.localStorage : null;
  const scopedKey = (key) => scopeKey(key);

  function getCachedFineGrainedToken() {
    try {
      const storage = session();
      const value = storage ? storage.getItem(scopedKey(GITHUB_PAT_STORAGE_KEY)) : '';
      if (typeof value === 'string' && value) {
        cachedFineGrainedTokenMemory = value;
        return value;
      }
    } catch (_) {
      /* ignore unavailable storage */
    }
    return cachedFineGrainedTokenMemory || '';
  }

  function setCachedFineGrainedToken(token) {
    const trimmed = String(token || '').trim();
    cachedFineGrainedTokenMemory = trimmed;
    try {
      const storage = session();
      if (!storage) return;
      if (trimmed) storage.setItem(scopedKey(GITHUB_PAT_STORAGE_KEY), trimmed);
      else storage.removeItem(scopedKey(GITHUB_PAT_STORAGE_KEY));
    } catch (_) {
      /* ignore storage errors */
    }
  }

  function clearCachedFineGrainedToken() {
    cachedFineGrainedTokenMemory = '';
    try {
      const storage = session();
      if (storage) storage.removeItem(scopedKey(GITHUB_PAT_STORAGE_KEY));
    } catch (_) {
      /* ignore */
    }
  }

  function getStoredConnectPublishSettings() {
    if (cachedConnectPublishSettingsMemory && typeof cachedConnectPublishSettingsMemory === 'object') {
      return { ...cachedConnectPublishSettingsMemory };
    }
    const settings = {
      mode: 'connect',
      enabled: true,
      baseUrl: getDefaultConnectPublishBaseUrl()
    };
    try {
      const storage = local();
      if (storage) {
        const modeRaw = storage.getItem(scopedKey(PUBLISH_TRANSPORT_MODE_STORAGE_KEY));
        if (modeRaw === 'connect' || modeRaw === 'pat') {
          settings.mode = modeRaw;
          settings.enabled = modeRaw === 'connect';
        } else {
          const enabledRaw = storage.getItem(scopedKey(CONNECT_PUBLISH_ENABLED_STORAGE_KEY));
          if (enabledRaw === '0') {
            settings.mode = 'pat';
            settings.enabled = false;
          } else if (enabledRaw === '1') {
            settings.mode = 'connect';
            settings.enabled = true;
          }
        }
        const baseUrlRaw = storage.getItem(scopedKey(CONNECT_PUBLISH_BASE_URL_STORAGE_KEY));
        if (typeof baseUrlRaw === 'string' && baseUrlRaw.trim()) settings.baseUrl = baseUrlRaw.trim();
      }
    } catch (_) {
      /* ignore unavailable storage */
    }
    cachedConnectPublishSettingsMemory = { ...settings };
    return settings;
  }

  function setStoredConnectPublishSettings(next = {}) {
    const previous = getStoredConnectPublishSettings();
    const mode = next.mode === 'connect' || next.mode === 'pat'
      ? next.mode
      : (typeof next.enabled === 'boolean'
          ? (next.enabled ? 'connect' : 'pat')
          : (previous.mode === 'pat' ? 'pat' : 'connect'));
    const settings = {
      mode,
      enabled: mode === 'connect',
      baseUrl: String(next.baseUrl != null ? next.baseUrl : previous.baseUrl || '').trim() || getDefaultConnectPublishBaseUrl()
    };
    const previousBase = normalizeConnectPublishBaseUrl(previous.baseUrl);
    const nextBase = normalizeConnectPublishBaseUrl(settings.baseUrl);
    cachedConnectPublishSettingsMemory = { ...settings };
    try {
      const storage = local();
      if (storage) {
        storage.setItem(scopedKey(PUBLISH_TRANSPORT_MODE_STORAGE_KEY), settings.mode);
        storage.setItem(scopedKey(CONNECT_PUBLISH_ENABLED_STORAGE_KEY), settings.enabled ? '1' : '0');
        storage.setItem(scopedKey(CONNECT_PUBLISH_BASE_URL_STORAGE_KEY), settings.baseUrl);
      }
    } catch (_) {
      /* ignore storage errors */
    }
    if (previousBase !== nextBase) clearCachedConnectPublishGrant();
    return settings;
  }

  function getCachedConnectPublishGrant() {
    if (cachedConnectPublishGrantMemory && isUsableConnectPublishGrant(cachedConnectPublishGrantMemory)) {
      return cachedConnectPublishGrantMemory;
    }
    try {
      const storage = session();
      const raw = storage ? storage.getItem(scopedKey(CONNECT_PUBLISH_GRANT_STORAGE_KEY)) : '';
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (isUsableConnectPublishGrant(parsed)) {
        cachedConnectPublishGrantMemory = parsed;
        return parsed;
      }
    } catch (_) {
      /* ignore unavailable storage */
    }
    return null;
  }

  function setCachedConnectPublishGrant(grant) {
    cachedConnectPublishGrantMemory = grant && typeof grant === 'object' ? { ...grant } : null;
    try {
      const storage = session();
      if (!storage) return;
      if (cachedConnectPublishGrantMemory) {
        storage.setItem(scopedKey(CONNECT_PUBLISH_GRANT_STORAGE_KEY), JSON.stringify(cachedConnectPublishGrantMemory));
      } else {
        storage.removeItem(scopedKey(CONNECT_PUBLISH_GRANT_STORAGE_KEY));
      }
    } catch (_) {
      /* ignore storage errors */
    }
  }

  function clearCachedConnectPublishGrant() {
    cachedConnectPublishGrantMemory = null;
    try {
      const storage = session();
      if (storage) storage.removeItem(scopedKey(CONNECT_PUBLISH_GRANT_STORAGE_KEY));
    } catch (_) {
      /* ignore */
    }
  }

  function resolvePublishTransport(settings = getStoredConnectPublishSettings()) {
    if (settings.enabled !== false && settings.mode !== 'pat') {
      const baseUrl = normalizeConnectPublishBaseUrl(settings.baseUrl);
      if (!baseUrl) {
        return {
          type: 'connect',
          invalid: true,
          rawBaseUrl: settings.baseUrl
        };
      }
      return {
        type: 'connect',
        connect: { baseUrl }
      };
    }
    return {
      type: 'pat'
    };
  }

  return {
    getCachedFineGrainedToken,
    setCachedFineGrainedToken,
    clearCachedFineGrainedToken,
    getStoredConnectPublishSettings,
    setStoredConnectPublishSettings,
    getCachedConnectPublishGrant,
    setCachedConnectPublishGrant,
    clearCachedConnectPublishGrant,
    resolvePublishTransport
  };
}
