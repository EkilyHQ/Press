function deepClone(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_) {}
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return value; }
}

function safeString(value) {
  return value == null ? '' : String(value);
}

function normalizeLocalizedConfig(value, options = {}) {
  const ensureDefault = options.ensureDefault !== false;
  if (typeof value === 'string') {
    const out = {};
    if (value !== '' || ensureDefault) out.default = safeString(value);
    return out;
  }
  if (!value || typeof value !== 'object') {
    return ensureDefault ? { default: '' } : {};
  }
  const out = {};
  Object.keys(value).forEach((lang) => {
    const v = value[lang];
    if (v == null) {
      if (ensureDefault && lang === 'default' && !Object.prototype.hasOwnProperty.call(out, 'default')) out.default = '';
      return;
    }
    out[lang] = safeString(v);
  });
  if (ensureDefault && !Object.prototype.hasOwnProperty.call(out, 'default')) out.default = '';
  return out;
}

function normalizeLinkEntry(entry) {
  if (!entry || typeof entry !== 'object') return { label: '', href: '' };
  return { label: safeString(entry.label), href: safeString(entry.href) };
}

function normalizeLinkList(value) {
  if (Array.isArray(value)) return value.map(item => normalizeLinkEntry(item));
  if (value && typeof value === 'object') {
    return Object.keys(value).map(label => ({ label: safeString(label), href: safeString(value[label]) }));
  }
  return [];
}

function normalizeBoolean(value, fallback = null) {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function normalizeNumber(value, fallback = null) {
  const num = Number(value);
  if (Number.isFinite(num)) return num;
  return fallback;
}

export function prepareSiteState(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const site = {};

  site.siteTitle = normalizeLocalizedConfig(src.siteTitle);
  site.siteSubtitle = normalizeLocalizedConfig(src.siteSubtitle);
  site.siteDescription = normalizeLocalizedConfig(src.siteDescription, { ensureDefault: false });
  site.siteKeywords = normalizeLocalizedConfig(src.siteKeywords, { ensureDefault: false });
  site.avatar = safeString(src.avatar || '');
  site.resourceURL = safeString(src.resourceURL || '');
  site.contentRoot = safeString(src.contentRoot || 'wwwroot');
  site.profileLinks = normalizeLinkList(src.profileLinks);
  site.contentOutdatedDays = normalizeNumber(src.contentOutdatedDays);
  site.cardCoverFallback = normalizeBoolean(src.cardCoverFallback);
  site.errorOverlay = normalizeBoolean(src.errorOverlay);
  const pageSize = src.pageSize != null ? src.pageSize : src.postsPerPage;
  site.pageSize = normalizeNumber(pageSize);
  site.defaultLanguage = safeString(src.defaultLanguage || '');
  site.themeMode = safeString(src.themeMode || '');
  site.themePack = safeString(src.themePack || '');
  site.themeOverride = normalizeBoolean(src.themeOverride);
  const enableAllPosts = normalizeBoolean(src.enableAllPosts);
  const disableAllPosts = normalizeBoolean(src.disableAllPosts);
  if (normalizeBoolean(src.showAllPosts) != null) site.showAllPosts = normalizeBoolean(src.showAllPosts);
  else if (enableAllPosts === true) site.showAllPosts = true;
  else if (disableAllPosts === true) site.showAllPosts = false;
  else site.showAllPosts = null;
  site.landingTab = safeString(src.landingTab || '');
  const repo = (src.repo && typeof src.repo === 'object') ? src.repo : {};
  site.repo = {
    owner: safeString(repo.owner || ''),
    name: safeString(repo.name || ''),
    branch: safeString(repo.branch || '')
  };
  const annotate = (src.annotate && typeof src.annotate === 'object') ? src.annotate : {};
  site.annotate = {
    enabled: normalizeBoolean(annotate.enabled),
    connectBaseUrl: safeString(annotate.connectBaseUrl || ''),
    discussionCategory: safeString(annotate.discussionCategory || '')
  };
  const assetWarnings = (src.assetWarnings && typeof src.assetWarnings === 'object') ? src.assetWarnings : {};
  const largeImage = (assetWarnings.largeImage && typeof assetWarnings.largeImage === 'object') ? assetWarnings.largeImage : {};
  site.assetWarnings = {
    largeImage: {
      enabled: normalizeBoolean(largeImage.enabled),
      thresholdKB: normalizeNumber(largeImage.thresholdKB)
    }
  };

  const recognized = new Set([
    'siteTitle', 'siteSubtitle', 'siteDescription', 'siteKeywords', 'avatar', 'resourceURL', 'contentRoot',
    'profileLinks', 'contentOutdatedDays', 'cardCoverFallback', 'errorOverlay', 'pageSize', 'postsPerPage',
    'defaultLanguage', 'themeMode', 'themePack', 'themeOverride', 'repo', 'annotate', 'assetWarnings', 'landingTab', 'showAllPosts',
    'enableAllPosts', 'disableAllPosts', 'connect'
  ]);
  const deprecated = new Set(['links']);

  const extras = {};
  Object.keys(src).forEach((key) => {
    if (recognized.has(key)) return;
    if (deprecated.has(key)) return;
    extras[key] = deepClone(src[key]);
  });
  site.__extras = extras;

  return site;
}

export function cloneSiteState(state) {
  if (!state || typeof state !== 'object') return { __extras: {} };
  return {
    siteTitle: deepClone(state.siteTitle || {}),
    siteSubtitle: deepClone(state.siteSubtitle || {}),
    siteDescription: deepClone(state.siteDescription || {}),
    siteKeywords: deepClone(state.siteKeywords || {}),
    avatar: safeString(state.avatar || ''),
    resourceURL: safeString(state.resourceURL || ''),
    contentRoot: safeString(state.contentRoot || ''),
    profileLinks: Array.isArray(state.profileLinks) ? deepClone(state.profileLinks) : [],
    contentOutdatedDays: state.contentOutdatedDays != null ? Number(state.contentOutdatedDays) : null,
    cardCoverFallback: normalizeBoolean(state.cardCoverFallback),
    errorOverlay: normalizeBoolean(state.errorOverlay),
    pageSize: state.pageSize != null ? Number(state.pageSize) : null,
    defaultLanguage: safeString(state.defaultLanguage || ''),
    themeMode: safeString(state.themeMode || ''),
    themePack: safeString(state.themePack || ''),
    themeOverride: normalizeBoolean(state.themeOverride),
    showAllPosts: normalizeBoolean(state.showAllPosts),
    landingTab: safeString(state.landingTab || ''),
    repo: deepClone(state.repo || { owner: '', name: '', branch: '' }),
    annotate: deepClone(state.annotate || { enabled: null, connectBaseUrl: '', discussionCategory: '' }),
    assetWarnings: deepClone(state.assetWarnings || { largeImage: { enabled: null, thresholdKB: null } }),
    __extras: deepClone(state.__extras || {})
  };
}

function localizedEntriesForOutput(localized, options = {}) {
  const source = localized && typeof localized === 'object' ? localized : {};
  const entries = Object.keys(source).map(key => ({ key, value: safeString(source[key]) }));
  const filtered = entries.filter(entry => entry.value != null && entry.value !== '');
  if (!filtered.length) {
    if (options.forceDefault && Object.prototype.hasOwnProperty.call(source, 'default')) {
      return { default: safeString(source.default) };
    }
    return null;
  }
  if (filtered.length === 1 && filtered[0].key === 'default') return filtered[0].value;
  filtered.sort((a, b) => {
    if (a.key === 'default') return -1;
    if (b.key === 'default') return 1;
    return a.key.localeCompare(b.key);
  });
  const out = {};
  filtered.forEach(entry => { out[entry.key] = entry.value; });
  return out;
}

function linkListForOutput(list) {
  if (!Array.isArray(list)) return null;
  const filtered = list.filter(item => item && (item.label || item.href));
  if (!filtered.length) return null;
  return filtered.map(item => ({ label: safeString(item.label || ''), href: safeString(item.href || '') }));
}

function assetWarningsForOutput(warnings) {
  if (!warnings || typeof warnings !== 'object') return null;
  const largeImage = warnings.largeImage && typeof warnings.largeImage === 'object' ? warnings.largeImage : {};
  const enabled = normalizeBoolean(largeImage.enabled);
  let threshold = null;
  if (Object.prototype.hasOwnProperty.call(largeImage, 'thresholdKB')) {
    const rawThreshold = largeImage.thresholdKB;
    const trimmed = typeof rawThreshold === 'string' ? rawThreshold.trim() : rawThreshold;
    if (trimmed !== '' && trimmed != null) {
      const normalized = normalizeNumber(trimmed);
      if (normalized != null && !Number.isNaN(normalized)) {
        threshold = normalized;
      }
    }
  }
  if (enabled == null && threshold == null) return null;
  const out = {};
  out.largeImage = {};
  if (enabled != null) out.largeImage.enabled = enabled;
  if (threshold != null) out.largeImage.thresholdKB = threshold;
  if (!Object.keys(out.largeImage).length) return null;
  return out;
}

function repoForOutput(repo) {
  if (!repo || typeof repo !== 'object') return null;
  const owner = safeString(repo.owner || '');
  const name = safeString(repo.name || '');
  const branch = safeString(repo.branch || '');
  if (!owner && !name && !branch) return null;
  const out = {};
  if (owner) out.owner = owner;
  if (name) out.name = name;
  if (branch) out.branch = branch;
  return Object.keys(out).length ? out : null;
}

function annotateForOutput(annotate) {
  if (!annotate || typeof annotate !== 'object') return null;
  const enabled = normalizeBoolean(annotate.enabled);
  const connectBaseUrl = safeString(annotate.connectBaseUrl || '').trim();
  const discussionCategory = safeString(annotate.discussionCategory || '').trim();
  if (enabled == null && !connectBaseUrl && !discussionCategory) return null;
  const out = {};
  if (enabled != null) out.enabled = enabled;
  if (connectBaseUrl) out.connectBaseUrl = connectBaseUrl;
  if (discussionCategory) out.discussionCategory = discussionCategory;
  return Object.keys(out).length ? out : null;
}

function buildSiteSnapshot(state) {
  const site = cloneSiteState(state);
  const snapshot = {};

  const identityTitle = localizedEntriesForOutput(site.siteTitle, { forceDefault: true });
  if (identityTitle != null) snapshot.siteTitle = identityTitle;
  const identitySubtitle = localizedEntriesForOutput(site.siteSubtitle, { forceDefault: true });
  if (identitySubtitle != null) snapshot.siteSubtitle = identitySubtitle;
  const identityDescription = localizedEntriesForOutput(site.siteDescription);
  if (identityDescription != null) snapshot.siteDescription = identityDescription;
  const identityKeywords = localizedEntriesForOutput(site.siteKeywords);
  if (identityKeywords != null) snapshot.siteKeywords = identityKeywords;
  if (site.avatar) snapshot.avatar = site.avatar;
  if (site.profileLinks && site.profileLinks.length) {
    const links = linkListForOutput(site.profileLinks);
    if (links) snapshot.profileLinks = links;
  }
  if (site.resourceURL) snapshot.resourceURL = site.resourceURL;
  if (site.contentRoot) snapshot.contentRoot = site.contentRoot;
  if (site.contentOutdatedDays != null && !Number.isNaN(site.contentOutdatedDays)) snapshot.contentOutdatedDays = Number(site.contentOutdatedDays);
  if (site.cardCoverFallback != null) snapshot.cardCoverFallback = !!site.cardCoverFallback;
  if (site.errorOverlay != null) snapshot.errorOverlay = !!site.errorOverlay;
  if (site.pageSize != null && !Number.isNaN(site.pageSize)) snapshot.pageSize = Number(site.pageSize);
  if (site.defaultLanguage) snapshot.defaultLanguage = site.defaultLanguage;
  if (site.themeMode) snapshot.themeMode = site.themeMode;
  if (site.themePack) snapshot.themePack = site.themePack;
  if (site.themeOverride != null) snapshot.themeOverride = !!site.themeOverride;
  if (site.showAllPosts != null) snapshot.showAllPosts = !!site.showAllPosts;
  if (site.landingTab) snapshot.landingTab = site.landingTab;
  const repo = repoForOutput(site.repo);
  if (repo) snapshot.repo = repo;
  const annotate = annotateForOutput(site.annotate);
  if (annotate) snapshot.annotate = annotate;
  const warnings = assetWarningsForOutput(site.assetWarnings);
  if (warnings) snapshot.assetWarnings = warnings;

  const extras = site.__extras && typeof site.__extras === 'object' ? site.__extras : {};
  Object.keys(extras).forEach((key) => {
    if (snapshot[key] !== undefined) return;
    snapshot[key] = deepClone(extras[key]);
  });

  return snapshot;
}

function stableSerialize(value) {
  if (value == null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(item => stableSerialize(item)).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map(key => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',') + '}';
  }
  return '';
}

export function computeSiteSignature(state) {
  const snapshot = buildSiteSnapshot(state);
  return stableSerialize(snapshot);
}

function compareLocalizedMaps(cur = {}, base = {}) {
  const langSet = new Set([...Object.keys(cur), ...Object.keys(base)]);
  const changedLangs = [];
  langSet.forEach((lang) => {
    if (safeString(cur[lang] || '') !== safeString(base[lang] || '')) changedLangs.push(lang);
  });
  return changedLangs;
}

function compareLinkListChanges(cur = [], base = []) {
  const max = Math.max(cur.length, base.length);
  const entries = {};
  for (let i = 0; i < max; i += 1) {
    const a = cur[i] || { label: '', href: '' };
    const b = base[i] || { label: '', href: '' };
    const changed = {};
    if (safeString(a.label) !== safeString(b.label)) changed.label = true;
    if (safeString(a.href) !== safeString(b.href)) changed.href = true;
    if (Object.keys(changed).length) entries[i] = changed;
  }
  return entries;
}

export function computeSiteDiff(current, baseline) {
  const cur = cloneSiteState(current);
  const base = cloneSiteState(baseline);
  const diff = { hasChanges: false, fields: {} };

  const localizedFields = ['siteTitle', 'siteSubtitle', 'siteDescription', 'siteKeywords'];
  localizedFields.forEach((key) => {
    const changed = compareLocalizedMaps(cur[key] || {}, base[key] || {});
    if (changed.length) {
      diff.fields[key] = { type: 'localized', languages: changed };
      diff.hasChanges = true;
    }
  });

  const stringFields = ['avatar', 'resourceURL', 'contentRoot', 'defaultLanguage', 'themeMode', 'themePack', 'landingTab'];
  stringFields.forEach((key) => {
    if (safeString(cur[key] || '') !== safeString(base[key] || '')) {
      diff.fields[key] = { type: 'text' };
      diff.hasChanges = true;
    }
  });

  const booleanFields = ['cardCoverFallback', 'errorOverlay', 'themeOverride', 'showAllPosts'];
  booleanFields.forEach((key) => {
    if (normalizeBoolean(cur[key]) !== normalizeBoolean(base[key])) {
      diff.fields[key] = { type: 'boolean' };
      diff.hasChanges = true;
    }
  });

  const numericFields = ['contentOutdatedDays', 'pageSize'];
  numericFields.forEach((key) => {
    const a = cur[key] != null ? Number(cur[key]) : null;
    const b = base[key] != null ? Number(base[key]) : null;
    if ((Number.isNaN(a) ? null : a) !== (Number.isNaN(b) ? null : b)) {
      diff.fields[key] = { type: 'number' };
      diff.hasChanges = true;
    }
  });

  const profileLinkChanges = compareLinkListChanges(cur.profileLinks || [], base.profileLinks || []);
  if (Object.keys(profileLinkChanges).length) {
    diff.fields.profileLinks = { type: 'list', entries: profileLinkChanges };
    diff.hasChanges = true;
  }

  const repoCur = cur.repo || {};
  const repoBase = base.repo || {};
  const repoFields = {};
  if (safeString(repoCur.owner) !== safeString(repoBase.owner)) repoFields.owner = true;
  if (safeString(repoCur.name) !== safeString(repoBase.name)) repoFields.name = true;
  if (safeString(repoCur.branch) !== safeString(repoBase.branch)) repoFields.branch = true;
  if (Object.keys(repoFields).length) {
    diff.fields.repo = { type: 'object', fields: repoFields };
    diff.hasChanges = true;
  }

  const annotateCur = cur.annotate || {};
  const annotateBase = base.annotate || {};
  const annotateFields = {};
  if (normalizeBoolean(annotateCur.enabled) !== normalizeBoolean(annotateBase.enabled)) annotateFields.enabled = true;
  if (safeString(annotateCur.connectBaseUrl) !== safeString(annotateBase.connectBaseUrl)) annotateFields.connectBaseUrl = true;
  if (safeString(annotateCur.discussionCategory) !== safeString(annotateBase.discussionCategory)) annotateFields.discussionCategory = true;
  if (Object.keys(annotateFields).length) {
    diff.fields.annotate = { type: 'object', fields: annotateFields };
    diff.hasChanges = true;
  }

  const curWarn = (cur.assetWarnings && cur.assetWarnings.largeImage) || {};
  const baseWarn = (base.assetWarnings && base.assetWarnings.largeImage) || {};
  const warningFields = {};
  if (normalizeBoolean(curWarn.enabled) !== normalizeBoolean(baseWarn.enabled)) warningFields.enabled = true;
  if (normalizeNumber(curWarn.thresholdKB) !== normalizeNumber(baseWarn.thresholdKB)) warningFields.thresholdKB = true;
  if (Object.keys(warningFields).length) {
    diff.fields.assetWarnings = { type: 'object', fields: warningFields };
    diff.hasChanges = true;
  }

  const extrasCur = cur.__extras || {};
  const extrasBase = base.__extras || {};
  if (stableSerialize(extrasCur) !== stableSerialize(extrasBase)) {
    diff.fields.__extras = { type: 'object' };
    diff.hasChanges = true;
  }

  return diff;
}

function quoteYamlScalar(value) {
  const str = String(value ?? '');
  return '"' + str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\"/g, '\\"') + '"';
}

function yamlScalar(value) {
  if (value == null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'string') {
    if (!value) return '""';
    if (/^[A-Za-z0-9_\-\/\.]+$/.test(value)) return value;
    return quoteYamlScalar(value);
  }
  return 'null';
}

export function writeYamlValue(lines, indent, value) {
  const pad = '  '.repeat(indent);
  if (value == null) {
    lines.push(`${pad}null`);
    return;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    lines.push(`${pad}${yamlScalar(value)}`);
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      lines.push(`${pad}[]`);
      return;
    }
    value.forEach((item) => {
      if (item == null || typeof item !== 'object' || Array.isArray(item)) {
        lines.push(`${pad}- ${yamlScalar(item)}`);
      } else {
        writeYamlArrayObject(lines, indent, item);
      }
    });
    return;
  }
  if (typeof value === 'object') {
    writeYamlObject(lines, indent, value);
    return;
  }
  lines.push(`${pad}${yamlScalar(String(value))}`);
}

function writeYamlArrayObject(lines, indent, obj) {
  const pad = '  '.repeat(indent);
  const keys = Object.keys(obj);
  if (!keys.length) {
    lines.push(`${pad}- {}`);
    return;
  }
  const [firstKey, ...restKeys] = keys;
  const firstValue = obj[firstKey];
  if (firstValue == null || typeof firstValue === 'string' || typeof firstValue === 'number' || typeof firstValue === 'boolean') {
    lines.push(`${pad}- ${firstKey}: ${yamlScalar(firstValue)}`);
  } else {
    lines.push(`${pad}- ${firstKey}:`);
    writeYamlValue(lines, indent + 2, firstValue);
  }
  restKeys.forEach((key) => {
    const value = obj[key];
    const childPad = '  '.repeat(indent + 1);
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${childPad}${key}: ${yamlScalar(value)}`);
    } else {
      lines.push(`${childPad}${key}:`);
      writeYamlValue(lines, indent + 2, value);
    }
  });
}

function writeYamlObject(lines, indent, obj) {
  const pad = '  '.repeat(indent);
  const keys = Object.keys(obj);
  if (!keys.length) {
    lines.push(`${pad}{}`);
    return;
  }
  keys.forEach((key) => {
    const value = obj[key];
    if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${pad}${key}: ${yamlScalar(value)}`);
    } else {
      lines.push(`${pad}${key}:`);
      writeYamlValue(lines, indent + 1, value);
    }
  });
}

export function toSiteYaml(data) {
  const snapshot = buildSiteSnapshot(data || {});
  const keysInOrder = [
    'siteTitle', 'siteSubtitle', 'siteDescription', 'siteKeywords', 'avatar', 'profileLinks', 'resourceURL',
    'contentRoot', 'contentOutdatedDays', 'cardCoverFallback', 'errorOverlay', 'pageSize', 'defaultLanguage',
    'themeMode', 'themePack', 'themeOverride', 'showAllPosts', 'landingTab', 'repo', 'annotate', 'connect', 'assetWarnings'
  ];
  const ordered = {};
  keysInOrder.forEach((key) => {
    if (snapshot[key] !== undefined) ordered[key] = snapshot[key];
  });
  Object.keys(snapshot).forEach((key) => {
    if (ordered[key] !== undefined) return;
    ordered[key] = snapshot[key];
  });

  const lines = ['# yaml-language-server: $schema=./assets/schema/site.json', ''];
  Object.keys(ordered).forEach((key) => {
    const value = ordered[key];
    if (value == null) return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(`${key}: ${yamlScalar(value)}`);
    } else {
      lines.push(`${key}:`);
      writeYamlValue(lines, 1, value);
    }
    lines.push('');
  });
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  lines.push('');
  return lines.join('\n');
}
