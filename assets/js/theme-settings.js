const APPLIED_THEME_SETTINGS_KEY = Symbol('pressAppliedThemeSettingsCssVariables');

export const THEME_SETTINGS_ROOT_KEY = 'themeSettings';
export const THEME_SETTINGS_META_KEY = 'x-press';
export const SUPPORTED_THEME_SETTING_CONTROLS = Object.freeze([
  'boolean',
  'color',
  'number',
  'range',
  'select',
  'text'
]);

const SAFE_SETTING_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_CSS_VARIABLE_PATTERN = /^--[A-Za-z][A-Za-z0-9_-]{0,95}$/;
const SAFE_CSS_VALUE_PATTERN = /^[#A-Za-z0-9_\-.,%()\s]+$/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepClone(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_) {}
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return value; }
}

function stableSerialize(value) {
  if (value == null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stableSerialize(item)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return '';
}

export function themeSettingValueSignature(value) {
  return stableSerialize(value);
}

function warning(message, path = '') {
  return { message, path };
}

function normalizeSettingKey(value) {
  const key = String(value || '').trim();
  return SAFE_SETTING_KEY_PATTERN.test(key) ? key : '';
}

export function sanitizeThemeSlug(value) {
  const s = String(value || '').toLowerCase().trim();
  return s.replace(/[^a-z0-9_-]/g, '') || 'native';
}

export function normalizeThemeSettingsMap(value) {
  const source = isPlainObject(value) ? value : {};
  const out = {};
  Object.keys(source).forEach((rawSlug) => {
    const slug = sanitizeThemeSlug(rawSlug);
    const settings = source[rawSlug];
    if (!slug || !isPlainObject(settings)) return;
    out[slug] = deepClone(settings);
  });
  return out;
}

export function themeSettingsForOutput(value) {
  const source = normalizeThemeSettingsMap(value);
  const out = {};
  Object.keys(source).sort().forEach((slug) => {
    const settings = source[slug];
    if (settings && Object.keys(settings).length) out[slug] = deepClone(settings);
  });
  return Object.keys(out).length ? out : null;
}

export function getThemeSettingsForSlug(siteConfig = {}, slug = '') {
  const cfg = isPlainObject(siteConfig) ? siteConfig : {};
  const map = normalizeThemeSettingsMap(cfg[THEME_SETTINGS_ROOT_KEY]);
  const safeSlug = sanitizeThemeSlug(slug || cfg.themePack || 'native');
  return map[safeSlug] && isPlainObject(map[safeSlug]) ? deepClone(map[safeSlug]) : {};
}

function getMeta(schema = {}) {
  const fromDash = isPlainObject(schema[THEME_SETTINGS_META_KEY]) ? schema[THEME_SETTINGS_META_KEY] : null;
  const fromCamel = isPlainObject(schema.xPress) ? schema.xPress : null;
  const fromUi = isPlainObject(schema.ui) ? schema.ui : null;
  return fromDash || fromCamel || fromUi || {};
}

function hasPressSettingMetadata(schema = {}) {
  return isPlainObject(schema[THEME_SETTINGS_META_KEY])
    || isPlainObject(schema.xPress)
    || isPlainObject(schema.ui)
    || typeof schema.ui === 'string';
}

function scalarOptionValue(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return undefined;
}

function normalizeOptionList(schema = {}, meta = {}) {
  const options = [];
  const seen = new Set();
  const add = (value, label = null) => {
    const normalizedValue = scalarOptionValue(value);
    if (normalizedValue === undefined) return;
    const signature = stableSerialize(normalizedValue);
    if (seen.has(signature)) return;
    seen.add(signature);
    options.push({
      value: normalizedValue,
      label: label == null || String(label).trim() === '' ? String(normalizedValue) : String(label)
    });
  };
  if (Array.isArray(meta.options)) {
    meta.options.forEach((entry) => {
      if (isPlainObject(entry)) add(entry.value, entry.label || entry.title);
      else add(entry);
    });
  }
  if (Array.isArray(schema.enum)) schema.enum.forEach(value => add(value));
  if (Array.isArray(schema.oneOf)) {
    schema.oneOf.forEach((entry) => {
      if (!isPlainObject(entry)) return;
      add(entry.const, entry.title || entry.label);
    });
  }
  return options;
}

function inferControl(schema = {}, meta = {}) {
  const requested = String(meta.control || meta.ui || '').trim().toLowerCase();
  if (SUPPORTED_THEME_SETTING_CONTROLS.includes(requested)) return requested;
  const options = normalizeOptionList(schema, meta);
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (options.length) return 'select';
  if (type === 'boolean') return 'boolean';
  if (type === 'number' || type === 'integer') return requested === 'range' ? 'range' : 'number';
  if (schema.format === 'color' || schema.format === 'hex-color') return 'color';
  if (type === 'string' || !type) return 'text';
  return '';
}

function typeMatchesControl(type, control) {
  const normalizedType = Array.isArray(type) ? type[0] : type;
  if (!normalizedType) return true;
  if (control === 'boolean') return normalizedType === 'boolean';
  if (control === 'number' || control === 'range') return normalizedType === 'number' || normalizedType === 'integer';
  if (control === 'color' || control === 'text') return normalizedType === 'string';
  if (control === 'select') return normalizedType !== 'object' && normalizedType !== 'array';
  return false;
}

function getRequestedControl(meta = {}) {
  const raw = meta.control || (typeof meta.ui === 'string' ? meta.ui : '');
  return String(raw || '').trim().toLowerCase();
}

function normalizeCssVariableList(meta = {}) {
  const raw = meta.cssVariable || meta.cssVariables;
  const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return list.map(item => String(item || '').trim()).filter(Boolean);
}

function normalizeCssValueMap(meta = {}) {
  const source = isPlainObject(meta.cssValues) ? meta.cssValues : {};
  const out = {};
  Object.keys(source).forEach((key) => {
    const value = String(source[key] == null ? '' : source[key]).trim();
    if (value && SAFE_CSS_VALUE_PATTERN.test(value)) out[key] = value;
  });
  return out;
}

function normalizeHexColor(value) {
  const color = String(value == null ? '' : value).trim().toLowerCase();
  const short = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '';
}

function validateCssVariableValue(field, value) {
  const signature = stableSerialize(value);
  if (field.cssValues && Object.prototype.hasOwnProperty.call(field.cssValues, String(value))) {
    return field.cssValues[String(value)];
  }
  if (field.control === 'color') return normalizeHexColor(value);
  if (field.control === 'number' || field.control === 'range') return Number.isFinite(Number(value)) ? String(Number(value)) : '';
  if (field.control === 'boolean') return value === true ? '1' : (value === false ? '0' : '');
  if (field.options && field.options.some(option => stableSerialize(option.value) === signature)) {
    const raw = String(value);
    return SAFE_CSS_VALUE_PATTERN.test(raw) ? raw : '';
  }
  if (field.control === 'text') {
    const raw = String(value == null ? '' : value).trim();
    return raw && SAFE_CSS_VALUE_PATTERN.test(raw) ? raw : '';
  }
  return '';
}

function normalizeNumber(value, field) {
  const num = Number(value);
  if (!Number.isFinite(num)) return { ok: false, value: null };
  if (field.integer && !Number.isInteger(num)) return { ok: false, value: null };
  if (field.minimum != null && num < field.minimum) return { ok: false, value: null };
  if (field.maximum != null && num > field.maximum) return { ok: false, value: null };
  if (field.step != null && Number.isFinite(field.step) && field.step > 0) {
    const scaled = num / field.step;
    if (Math.abs(scaled - Math.round(scaled)) > 1e-8) return { ok: false, value: null };
  }
  return { ok: true, value: field.integer ? Math.trunc(num) : num };
}

export function normalizeThemeSettingValue(field, value) {
  if (!field || !field.key) return { ok: false, value: null };
  if (field.control === 'boolean') {
    if (value === true || value === false) return { ok: true, value };
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return { ok: true, value: true };
      if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return { ok: true, value: false };
    }
    return { ok: false, value: null };
  }
  if (field.control === 'number' || field.control === 'range') return normalizeNumber(value, field);
  if (field.control === 'color') {
    const color = normalizeHexColor(value);
    return color ? { ok: true, value: color } : { ok: false, value: null };
  }
  if (field.control === 'select') {
    const signature = stableSerialize(value);
    const found = (field.options || []).find(option => stableSerialize(option.value) === signature);
    if (found) return { ok: true, value: found.value };
    const byString = (field.options || []).find(option => String(option.value) === String(value));
    return byString ? { ok: true, value: byString.value } : { ok: false, value: null };
  }
  if (field.control === 'text') {
    const text = String(value == null ? '' : value);
    if (field.minLength != null && text.length < field.minLength) return { ok: false, value: null };
    if (field.maxLength != null && text.length > field.maxLength) return { ok: false, value: null };
    if (field.pattern) {
      try {
        if (!(new RegExp(field.pattern)).test(text)) return { ok: false, value: null };
      } catch (_) {
        return { ok: false, value: null };
      }
    }
    return { ok: true, value: text };
  }
  return { ok: false, value: null };
}

export function normalizeThemeConfigSchema(configSchema = {}, options = {}) {
  const strict = options.strict === true;
  const warnings = [];
  const errors = [];
  const addIssue = (message, path) => {
    const issue = warning(message, path);
    if (strict) errors.push(issue);
    else warnings.push(issue);
  };

  if (!isPlainObject(configSchema)) {
    addIssue('Theme configSchema must be an object.', 'configSchema');
    return { fields: [], warnings, errors };
  }

  const properties = isPlainObject(configSchema.properties) ? configSchema.properties : {};
  const fields = [];
  Object.keys(properties).forEach((rawKey) => {
    const path = `configSchema.properties.${rawKey}`;
    const schema = properties[rawKey];
    if (!isPlainObject(schema)) {
      addIssue(`Theme setting "${rawKey}" must be an object schema.`, path);
      return;
    }
    const meta = getMeta(schema);
    const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
    const options = normalizeOptionList(schema, meta);
    const hasMetadata = hasPressSettingMetadata(schema);
    const looksNested = isPlainObject(schema.properties) || schema.items != null;
    const scalarCandidate = (!type && !looksNested)
      || ['boolean', 'number', 'integer', 'string'].includes(type)
      || schema.format === 'color'
      || schema.format === 'hex-color'
      || options.length > 0;
    if (!hasMetadata && !scalarCandidate) return;
    const key = normalizeSettingKey(rawKey);
    if (!key) {
      addIssue(`Unsupported theme setting key "${rawKey}".`, path);
      return;
    }
    const requestedControl = getRequestedControl(meta);
    if (requestedControl && !SUPPORTED_THEME_SETTING_CONTROLS.includes(requestedControl)) {
      addIssue(`Theme setting "${key}" uses unsupported control "${requestedControl}".`, `${path}.${THEME_SETTINGS_META_KEY}.control`);
      return;
    }
    const control = inferControl(schema, meta);
    if (!control) {
      addIssue(`Theme setting "${key}" uses an unsupported type or control.`, path);
      return;
    }
    if (type === 'object' || type === 'array') {
      addIssue(`Theme setting "${key}" must be a scalar setting.`, path);
      return;
    }
    if (!typeMatchesControl(type, control)) {
      addIssue(`Theme setting "${key}" uses control "${control}" with incompatible type "${type}".`, `${path}.${THEME_SETTINGS_META_KEY}.control`);
      return;
    }
    if (control === 'select' && !options.length) {
      addIssue(`Theme setting "${key}" select controls require enum/options.`, path);
      return;
    }
    const cssVariables = normalizeCssVariableList(meta);
    cssVariables.forEach((name) => {
      if (!SAFE_CSS_VARIABLE_PATTERN.test(name)) addIssue(`Theme setting "${key}" has an unsafe CSS variable "${name}".`, `${path}.${THEME_SETTINGS_META_KEY}.cssVariable`);
    });
    const rawStep = schema.multipleOf != null ? Number(schema.multipleOf) : (schema.step != null ? Number(schema.step) : null);
    if (rawStep != null && (!Number.isFinite(rawStep) || rawStep <= 0)) {
      addIssue(`Theme setting "${key}" step must be a positive finite number.`, `${path}.${schema.multipleOf != null ? 'multipleOf' : 'step'}`);
    }
    const field = {
      key,
      label: String(meta.label || schema.title || key),
      description: String(meta.description || schema.description || ''),
      group: String(meta.group || ''),
      control,
      type: type || (control === 'boolean' ? 'boolean' : (control === 'number' || control === 'range' ? 'number' : 'string')),
      defaultValue: schema.default,
      options,
      cssVariables: cssVariables.filter(name => SAFE_CSS_VARIABLE_PATTERN.test(name)),
      cssValues: normalizeCssValueMap(meta),
      minimum: schema.minimum != null ? Number(schema.minimum) : null,
      maximum: schema.maximum != null ? Number(schema.maximum) : null,
      step: rawStep != null && Number.isFinite(rawStep) && rawStep > 0 ? rawStep : null,
      integer: type === 'integer',
      minLength: schema.minLength != null ? Number(schema.minLength) : null,
      maxLength: schema.maxLength != null ? Number(schema.maxLength) : null,
      pattern: schema.pattern || ''
    };
    fields.push(field);
  });

  fields.sort((a, b) => {
    const ag = a.group || '';
    const bg = b.group || '';
    if (ag !== bg) return ag.localeCompare(bg);
    return a.key.localeCompare(b.key);
  });
  return { fields, warnings, errors };
}

function buildCssVariables(fields, settings) {
  const variables = [];
  fields.forEach((field) => {
    if (!field.cssVariables || !field.cssVariables.length) return;
    if (!Object.prototype.hasOwnProperty.call(settings, field.key)) return;
    const value = validateCssVariableValue(field, settings[field.key]);
    if (!value) return;
    field.cssVariables.forEach((name) => variables.push({ key: field.key, name, value }));
  });
  return variables;
}

export function resolveThemeSettings({ pack = 'native', manifest = {}, siteConfig = {} } = {}) {
  const slug = sanitizeThemeSlug(pack || (siteConfig && siteConfig.themePack) || 'native');
  const schema = isPlainObject(manifest && manifest.configSchema) ? manifest.configSchema : {};
  const normalized = normalizeThemeConfigSchema(schema);
  const warnings = [...normalized.warnings];
  const fields = normalized.fields;
  const rawOverrides = getThemeSettingsForSlug(siteConfig, slug);
  const defaults = {};
  const overrides = {};
  const settings = {};

  fields.forEach((field) => {
    if (field.defaultValue !== undefined) {
      const normalizedDefault = normalizeThemeSettingValue(field, field.defaultValue);
      if (normalizedDefault.ok) {
        defaults[field.key] = normalizedDefault.value;
        settings[field.key] = normalizedDefault.value;
      } else {
        warnings.push(warning(`Default value for theme setting "${field.key}" is invalid.`, `configSchema.properties.${field.key}.default`));
      }
    }
  });

  Object.keys(rawOverrides).forEach((key) => {
    const field = fields.find(candidate => candidate.key === key);
    if (!field) {
      warnings.push(warning(`Unknown theme setting "${key}" was ignored.`, `${THEME_SETTINGS_ROOT_KEY}.${slug}.${key}`));
      return;
    }
    const normalizedValue = normalizeThemeSettingValue(field, rawOverrides[key]);
    if (!normalizedValue.ok) {
      warnings.push(warning(`Invalid value for theme setting "${key}" was ignored.`, `${THEME_SETTINGS_ROOT_KEY}.${slug}.${key}`));
      return;
    }
    if (
      Object.prototype.hasOwnProperty.call(defaults, key)
      && stableSerialize(defaults[key]) === stableSerialize(normalizedValue.value)
    ) {
      settings[key] = normalizedValue.value;
      return;
    }
    overrides[key] = normalizedValue.value;
    settings[key] = normalizedValue.value;
  });

  return {
    pack: slug,
    schema,
    fields,
    defaults,
    overrides,
    settings,
    cssVariables: buildCssVariables(fields, overrides),
    warnings,
    errors: normalized.errors
  };
}

export function setThemeSettingOverride(siteConfig, slug, key, value, field) {
  if (!isPlainObject(siteConfig)) return false;
  const safeSlug = sanitizeThemeSlug(slug || siteConfig.themePack || 'native');
  const safeKey = normalizeSettingKey(key);
  if (!safeSlug || !safeKey) return false;
  if (!isPlainObject(siteConfig[THEME_SETTINGS_ROOT_KEY])) siteConfig[THEME_SETTINGS_ROOT_KEY] = {};
  if (!isPlainObject(siteConfig[THEME_SETTINGS_ROOT_KEY][safeSlug])) siteConfig[THEME_SETTINGS_ROOT_KEY][safeSlug] = {};
  const target = siteConfig[THEME_SETTINGS_ROOT_KEY][safeSlug];
  if (value === undefined && (!field || field.defaultValue === undefined)) {
    const hadValue = Object.prototype.hasOwnProperty.call(target, safeKey);
    delete target[safeKey];
    if (!Object.keys(target).length) delete siteConfig[THEME_SETTINGS_ROOT_KEY][safeSlug];
    if (!Object.keys(siteConfig[THEME_SETTINGS_ROOT_KEY]).length) delete siteConfig[THEME_SETTINGS_ROOT_KEY];
    return hadValue;
  }
  const normalizedValue = normalizeThemeSettingValue(field, value);
  if (!normalizedValue.ok) return false;
  const defaultValue = field && field.defaultValue !== undefined
    ? normalizeThemeSettingValue(field, field.defaultValue)
    : { ok: false };
  if (defaultValue.ok && stableSerialize(defaultValue.value) === stableSerialize(normalizedValue.value)) {
    delete target[safeKey];
  } else {
    target[safeKey] = normalizedValue.value;
  }
  if (!Object.keys(target).length) delete siteConfig[THEME_SETTINGS_ROOT_KEY][safeSlug];
  if (!Object.keys(siteConfig[THEME_SETTINGS_ROOT_KEY]).length) delete siteConfig[THEME_SETTINGS_ROOT_KEY];
  return true;
}

export function applyThemeSettingsCssVariables(documentRef, resolution = {}) {
  const root = documentRef && documentRef.documentElement;
  if (!root || !root.style || typeof root.style.setProperty !== 'function') return false;
  const previous = root[APPLIED_THEME_SETTINGS_KEY] instanceof Set ? root[APPLIED_THEME_SETTINGS_KEY] : new Set();
  const next = new Map();
  (Array.isArray(resolution.cssVariables) ? resolution.cssVariables : []).forEach((entry) => {
    if (!entry || !SAFE_CSS_VARIABLE_PATTERN.test(String(entry.name || ''))) return;
    const value = String(entry.value == null ? '' : entry.value).trim();
    if (!value) return;
    next.set(String(entry.name), value);
  });
  previous.forEach((name) => {
    if (!next.has(name) && typeof root.style.removeProperty === 'function') {
      root.style.removeProperty(name);
    }
  });
  next.forEach((value, name) => {
    root.style.setProperty(name, value);
  });
  root[APPLIED_THEME_SETTINGS_KEY] = new Set(next.keys());
  return true;
}

export function validateThemeConfigSchema(configSchema = {}) {
  const normalized = normalizeThemeConfigSchema(configSchema, { strict: true });
  if (normalized.errors.length) {
    const first = normalized.errors[0];
    throw new Error(first && first.message ? first.message : 'Theme configSchema contains unsupported settings metadata.');
  }
  return true;
}
