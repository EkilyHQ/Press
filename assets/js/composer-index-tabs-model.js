function normalizeRelPath(path) {
  const raw = String(path || '').trim();
  if (!raw) return '';
  const cleaned = raw
    .replace(/[\\]/g, '/')
    .replace(/^\//, '')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/');
  const parts = cleaned.split('/');
  const stack = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

export function deepClone(value) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch (_) {}
  try { return JSON.parse(JSON.stringify(value)); }
  catch (_) { return value; }
}

export function safeString(value) {
  return value == null ? '' : String(value);
}

export function isIndexMetadataObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function cloneIndexMetadataValue(value) {
  if (value == null) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => cloneIndexMetadataValue(item));
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((key) => {
      const cloned = cloneIndexMetadataValue(value[key]);
      if (cloned !== undefined) out[key] = cloned;
    });
    return out;
  }
  return safeString(value);
}

function normalizeIndexVariantForState(value) {
  if (!isIndexMetadataObject(value)) return safeString(value);
  const out = {};
  const rawLocation = value.location != null ? value.location : value.path;
  const normalizedLocation = normalizeRelPath(rawLocation);
  if (normalizedLocation) out.location = normalizedLocation;
  Object.keys(value).forEach((key) => {
    if (key === 'location' || key === 'path') return;
    const cloned = cloneIndexMetadataValue(value[key]);
    if (cloned !== undefined && cloned !== null && cloned !== '') out[key] = cloned;
  });
  return out.location ? out : '';
}

export function getIndexVariantLocation(value) {
  if (isIndexMetadataObject(value)) return normalizeRelPath(value.location != null ? value.location : value.path);
  return normalizeRelPath(value);
}

function stableIndexValue(value) {
  if (Array.isArray(value)) return value.map(item => stableIndexValue(item));
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach((key) => {
      out[key] = stableIndexValue(value[key]);
    });
    return out;
  }
  return value;
}

function getIndexVariantSignature(value) {
  const normalized = normalizeIndexVariantForState(value);
  if (isIndexMetadataObject(normalized)) return JSON.stringify(stableIndexValue(normalized));
  return safeString(normalized);
}

export function normalizeIndexVariantList(value) {
  const items = Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]);
  return items
    .map(item => normalizeIndexVariantForState(item))
    .filter(item => {
      if (isIndexMetadataObject(item)) return !!getIndexVariantLocation(item);
      return !!normalizeRelPath(item);
    });
}

export function prepareIndexState(raw) {
  const output = { __order: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return output;
  const seen = new Set();
  const order = Array.isArray(raw.__order) ? raw.__order.filter(k => typeof k === 'string' && k) : [];
  order.forEach(key => {
    if (seen.has(key)) return;
    seen.add(key);
    output.__order.push(key);
    output[key] = normalizeIndexEntry(raw[key]);
  });
  Object.keys(raw).forEach(key => {
    if (key === '__order') return;
    if (seen.has(key)) {
      if (!Object.prototype.hasOwnProperty.call(output, key)) output[key] = normalizeIndexEntry(raw[key]);
      return;
    }
    seen.add(key);
    output.__order.push(key);
    output[key] = normalizeIndexEntry(raw[key]);
  });
  return output;
}

function normalizeIndexEntry(entry) {
  const out = {};
  if (!entry || typeof entry !== 'object') return out;
  Object.keys(entry).forEach(lang => {
    if (lang === '__order') return;
    const value = entry[lang];
    if (Array.isArray(value)) {
      out[lang] = normalizeIndexVariantList(value);
    } else if (value != null && typeof value === 'object') {
      out[lang] = normalizeIndexVariantForState(value);
    } else {
      out[lang] = safeString(value);
    }
  });
  return out;
}

export function prepareTabsState(raw) {
  const output = { __order: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return output;
  const seen = new Set();
  const order = Array.isArray(raw.__order) ? raw.__order.filter(k => typeof k === 'string' && k) : [];
  order.forEach(key => {
    if (seen.has(key)) return;
    seen.add(key);
    output.__order.push(key);
    output[key] = normalizeTabsEntry(raw[key]);
  });
  Object.keys(raw).forEach(key => {
    if (key === '__order') return;
    if (seen.has(key)) {
      if (!Object.prototype.hasOwnProperty.call(output, key)) output[key] = normalizeTabsEntry(raw[key]);
      return;
    }
    seen.add(key);
    output.__order.push(key);
    output[key] = normalizeTabsEntry(raw[key]);
  });
  return output;
}

function normalizeTabsEntry(entry) {
  const out = {};
  if (!entry || typeof entry !== 'object') return out;
  Object.keys(entry).forEach(lang => {
    if (lang === '__order') return;
    const value = entry[lang];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[lang] = {
        title: safeString(value.title),
        location: safeString(value.location)
      };
    } else {
      out[lang] = { title: '', location: safeString(value) };
    }
  });
  return out;
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function computeIndexSignature(state) {
  if (!state) return '';
  const parts = [];
  const order = Array.isArray(state.__order) ? state.__order.slice() : [];
  parts.push(JSON.stringify(['order', order]));
  const keys = Object.keys(state).filter(k => k !== '__order').sort();
  keys.forEach(key => {
    const entry = state[key] || {};
    const langs = Object.keys(entry).sort();
    const langParts = langs.map(lang => {
      const value = entry[lang];
      if (Array.isArray(value)) return [lang, 'list', value.map(item => getIndexVariantSignature(item))];
      return [lang, 'single', getIndexVariantSignature(value)];
    });
    parts.push(JSON.stringify([key, langParts]));
  });
  return parts.join('|');
}

export function computeTabsSignature(state) {
  if (!state) return '';
  const parts = [];
  const order = Array.isArray(state.__order) ? state.__order.slice() : [];
  parts.push(JSON.stringify(['order', order]));
  const keys = Object.keys(state).filter(k => k !== '__order').sort();
  keys.forEach(key => {
    const entry = state[key] || {};
    const langs = Object.keys(entry).sort();
    const langParts = langs.map(lang => {
      const value = entry[lang] || { title: '', location: '' };
      return [lang, safeString(value.title), safeString(value.location)];
    });
    parts.push(JSON.stringify([key, langParts]));
  });
  return parts.join('|');
}

function diffVersionLists(currentValue, baselineValue) {
  const normalize = (value) => {
    if (Array.isArray(value)) {
      const items = value.map(item => ({
        path: getIndexVariantLocation(item),
        signature: getIndexVariantSignature(item),
        restoreValue: cloneIndexMetadataValue(item)
      }));
      if (items.length === 0) {
        return { kind: 'list', items: [] };
      }
      if (items.length === 1) {
        return { kind: 'single', items: [items[0]] };
      }
      return { kind: 'list', items };
    }
    return {
      kind: 'single',
      items: [{
        path: getIndexVariantLocation(value),
        signature: getIndexVariantSignature(value),
        restoreValue: cloneIndexMetadataValue(value)
      }]
    };
  };
  const cur = normalize(currentValue);
  const base = normalize(baselineValue);
  const curItems = cur.items;
  const baseItems = base.items;
  const baseMatched = new Array(baseItems.length).fill(false);
  const entries = [];
  for (let i = 0; i < curItems.length; i += 1) {
    const value = curItems[i];
    let status = 'added';
    let prevIndex = -1;
    if (i < baseItems.length && baseItems[i].signature === value.signature && !baseMatched[i]) {
      status = 'unchanged';
      prevIndex = i;
      baseMatched[i] = true;
    } else {
      let foundIndex = -1;
      for (let j = 0; j < baseItems.length; j += 1) {
        if (!baseMatched[j] && baseItems[j].signature === value.signature) {
          foundIndex = j;
          break;
        }
      }
      if (foundIndex !== -1) {
        status = 'moved';
        prevIndex = foundIndex;
        baseMatched[foundIndex] = true;
      } else if (i < baseItems.length) {
        status = 'changed';
        prevIndex = i;
        baseMatched[i] = true;
      }
    }
    entries.push({ value: value.path || '', status, prevIndex });
  }
  const removed = [];
  for (let i = 0; i < baseItems.length; i += 1) {
    if (!baseMatched[i]) {
      removed.push({
        value: baseItems[i].path || '',
        restoreValue: baseItems[i].restoreValue,
        index: i
      });
    }
  }
  const changed = cur.kind !== base.kind
    || curItems.length !== baseItems.length
    || entries.some(item => item.status !== 'unchanged')
    || removed.length > 0;
  const orderChanged = entries.some(item => item.status === 'moved')
    || (curItems.length === baseItems.length && !arraysEqual(curItems.map(item => item.path), baseItems.map(item => item.path)));
  return {
    entries,
    removed,
    changed,
    orderChanged,
    kindChanged: cur.kind !== base.kind,
    kind: cur.kind
  };
}

export function computeIndexDiff(current, baseline) {
  const cur = current || { __order: [] };
  const base = baseline || { __order: [] };
  const diff = {
    hasChanges: false,
    keys: {},
    orderChanged: false,
    addedKeys: [],
    removedKeys: []
  };
  const curOrder = Array.isArray(cur.__order) ? cur.__order : [];
  const baseOrder = Array.isArray(base.__order) ? base.__order : [];
  diff.orderChanged = !arraysEqual(curOrder, baseOrder);

  const keySet = new Set();
  Object.keys(cur).forEach(key => { if (key !== '__order') keySet.add(key); });
  Object.keys(base).forEach(key => { if (key !== '__order') keySet.add(key); });

  keySet.forEach(key => {
    const curEntry = cur[key];
    const baseEntry = base[key];
    const info = { state: '', langs: {}, addedLangs: [], removedLangs: [] };
    if (!baseEntry && curEntry) {
      info.state = 'added';
      diff.addedKeys.push(key);
      diff.hasChanges = true;
    } else if (baseEntry && !curEntry) {
      info.state = 'removed';
      diff.removedKeys.push(key);
      diff.hasChanges = true;
    } else if (curEntry && baseEntry) {
      const langSet = new Set();
      Object.keys(curEntry).forEach(lang => langSet.add(lang));
      Object.keys(baseEntry).forEach(lang => langSet.add(lang));
      langSet.forEach(lang => {
        const curVal = curEntry[lang];
        const baseVal = baseEntry[lang];
        if (curVal == null && baseVal == null) return;
        if (curVal == null && baseVal != null) {
          info.langs[lang] = { state: 'removed' };
          info.removedLangs.push(lang);
          diff.hasChanges = true;
          return;
        }
        if (curVal != null && baseVal == null) {
          info.langs[lang] = { state: 'added' };
          info.addedLangs.push(lang);
          diff.hasChanges = true;
          return;
        }
        const versionDiff = diffVersionLists(curVal, baseVal);
        if (versionDiff.changed) {
          info.langs[lang] = { state: 'modified', versions: versionDiff };
          diff.hasChanges = true;
        }
      });
      if (!info.state) {
        if (Object.keys(info.langs).length || info.addedLangs.length || info.removedLangs.length) {
          info.state = 'modified';
        }
      }
    }
    if (info.state || Object.keys(info.langs).length || info.addedLangs.length || info.removedLangs.length) {
      diff.keys[key] = info;
    }
  });
  diff.hasChanges = diff.hasChanges || diff.orderChanged || diff.addedKeys.length > 0 || diff.removedKeys.length > 0;
  return diff;
}

export function computeTabsDiff(current, baseline) {
  const cur = current || { __order: [] };
  const base = baseline || { __order: [] };
  const diff = {
    hasChanges: false,
    keys: {},
    orderChanged: false,
    addedKeys: [],
    removedKeys: []
  };
  const curOrder = Array.isArray(cur.__order) ? cur.__order : [];
  const baseOrder = Array.isArray(base.__order) ? base.__order : [];
  diff.orderChanged = !arraysEqual(curOrder, baseOrder);

  const keySet = new Set();
  Object.keys(cur).forEach(key => { if (key !== '__order') keySet.add(key); });
  Object.keys(base).forEach(key => { if (key !== '__order') keySet.add(key); });

  keySet.forEach(key => {
    const curEntry = cur[key];
    const baseEntry = base[key];
    const info = { state: '', langs: {}, addedLangs: [], removedLangs: [] };
    if (!baseEntry && curEntry) {
      info.state = 'added';
      diff.addedKeys.push(key);
      diff.hasChanges = true;
    } else if (baseEntry && !curEntry) {
      info.state = 'removed';
      diff.removedKeys.push(key);
      diff.hasChanges = true;
    } else if (curEntry && baseEntry) {
      const langSet = new Set();
      Object.keys(curEntry).forEach(lang => langSet.add(lang));
      Object.keys(baseEntry).forEach(lang => langSet.add(lang));
      langSet.forEach(lang => {
        const curVal = curEntry[lang];
        const baseVal = baseEntry[lang];
        if (!curVal && !baseVal) return;
        if (!curVal && baseVal) {
          info.langs[lang] = { state: 'removed' };
          info.removedLangs.push(lang);
          diff.hasChanges = true;
          return;
        }
        if (curVal && !baseVal) {
          info.langs[lang] = { state: 'added' };
          info.addedLangs.push(lang);
          diff.hasChanges = true;
          return;
        }
        const curTitle = safeString(curVal.title);
        const curLoc = safeString(curVal.location);
        const baseTitle = safeString(baseVal.title);
        const baseLoc = safeString(baseVal.location);
        const titleChanged = curTitle !== baseTitle;
        const locationChanged = curLoc !== baseLoc;
        if (titleChanged || locationChanged) {
          info.langs[lang] = { state: 'modified', titleChanged, locationChanged };
          diff.hasChanges = true;
        }
      });
      if (!info.state) {
        if (Object.keys(info.langs).length || info.addedLangs.length || info.removedLangs.length) info.state = 'modified';
      }
    }
    if (info.state || Object.keys(info.langs).length || info.addedLangs.length || info.removedLangs.length) {
      diff.keys[key] = info;
    }
  });
  diff.hasChanges = diff.hasChanges || diff.orderChanged || diff.addedKeys.length > 0 || diff.removedKeys.length > 0;
  return diff;
}
