import {
  CONNECT_PUBLISH_BASE_URL_STORAGE_KEY,
  getDefaultConnectPublishBaseUrl,
  normalizeConnectPublishBaseUrl
} from './publish/settings-store.js';
import { createScopedStorageKey, resolveEditorStorageScope } from './editor-storage.js';

export const CONNECT_PRODUCT_STATE_PATH = '/api/product-state';
export const CONNECT_SYSTEM_RELEASE_PATH = '/api/press/system-release';

function getWindowRef(options = {}) {
  if (options.windowRef) return options.windowRef;
  return typeof window !== 'undefined' ? window : null;
}

function getStorage(options = {}) {
  if (options.localStorageRef) return options.localStorageRef;
  const win = getWindowRef(options);
  try {
    if (win && win.localStorage) return win.localStorage;
  } catch (_) {
    return null;
  }
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch (_) {
    return null;
  }
}

function getLocationRef(options = {}) {
  if (options.locationRef) return options.locationRef;
  const win = getWindowRef(options);
  return win && win.location ? win.location : null;
}

function readStorageValue(storage, key) {
  try {
    return storage && typeof storage.getItem === 'function' ? storage.getItem(key) : '';
  } catch (_) {
    return '';
  }
}

function getStoredConnectBaseUrl(options = {}) {
  const storage = getStorage(options);
  if (!storage) return '';
  const keys = [];
  const scope = options.storageScope || resolveEditorStorageScope(getLocationRef(options));
  if (scope) keys.push(createScopedStorageKey(scope, CONNECT_PUBLISH_BASE_URL_STORAGE_KEY));
  keys.push(CONNECT_PUBLISH_BASE_URL_STORAGE_KEY);
  for (const key of keys) {
    const value = readStorageValue(storage, key);
    if (value && String(value).trim()) return value;
  }
  return '';
}

export function resolveConnectStatusBaseUrl(options = {}) {
  const explicit = normalizeConnectPublishBaseUrl(
    options.connectBaseUrl || options.baseUrl || (options.connect && options.connect.baseUrl) || ''
  );
  if (explicit) return explicit;
  const stored = normalizeConnectPublishBaseUrl(getStoredConnectBaseUrl(options));
  if (stored) return stored;
  return options.defaultConnect === false ? null : getDefaultConnectPublishBaseUrl();
}

export function buildConnectStatusUrl(path, options = {}) {
  const baseUrl = resolveConnectStatusBaseUrl(options);
  if (!baseUrl) return '';
  try {
    return new URL(path, baseUrl).href;
  } catch (_) {
    return '';
  }
}
