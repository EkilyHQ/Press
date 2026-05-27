function quoteYamlScalar(value) {
  const str = String(value ?? '');
  return '"' + str
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\"/g, '\\"') + '"';
}

export function createComposerYamlSerialization(options = {}) {
  const preferredLangOrder = Array.isArray(options.preferredLangOrder) ? options.preferredLangOrder : [];
  const normalizeLangCode = typeof options.normalizeLangCode === 'function' ? options.normalizeLangCode : value => String(value || '').trim().toLowerCase();
  const getLanguageLabel = typeof options.getLanguageLabel === 'function' ? options.getLanguageLabel : () => '';
  const isIndexMetadataObject = typeof options.isIndexMetadataObject === 'function' ? options.isIndexMetadataObject : value => !!value && typeof value === 'object' && !Array.isArray(value);
  const writeYamlValue = typeof options.writeYamlValue === 'function' ? options.writeYamlValue : () => {};

  function sortLangKeys(obj) {
    const keys = Object.keys(obj || {});
    return keys.sort((a, b) => {
      const ia = preferredLangOrder.indexOf(normalizeLangCode(a));
      const ib = preferredLangOrder.indexOf(normalizeLangCode(b));
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.localeCompare(b);
    });
  }

  function displayLangName(code) {
    const normalized = normalizeLangCode(code);
    if (!normalized) return '';
    try {
      const label = getLanguageLabel(normalized);
      if (label && String(label).trim()) return String(label).trim();
    } catch (_) {}
    return normalized.toUpperCase();
  }

  function langFlag(code) {
    const c = normalizeLangCode(code);
    if (c === 'en') return '🇺🇸';
    if (c === 'chs') return '🇨🇳';
    if (c === 'cht-tw') return '🇹🇼';
    if (c === 'cht-hk') return '🇭🇰';
    if (c === 'ja') return '🇯🇵';
    return '';
  }

  function toIndexYaml(data) {
    const lines = [
      '# yaml-language-server: $schema=../assets/schema/index.json',
      ''
    ];
    const keys = data.__order && Array.isArray(data.__order) ? data.__order.slice() : Object.keys(data).filter(k => k !== '__order');
    keys.forEach(key => {
      const entry = data[key];
      if (!entry || typeof entry !== 'object') return;
      lines.push(`${key}:`);
      const langs = sortLangKeys(entry);
      langs.forEach(lang => {
        const v = entry[lang];
        if (Array.isArray(v)) {
          const hasMetadata = v.some(item => isIndexMetadataObject(item));
          if (hasMetadata) {
            lines.push(`  ${lang}:`);
            writeYamlValue(lines, 2, v);
          } else if (v.length <= 1) {
            const one = v[0] ?? '';
            lines.push(`  ${lang}: ${one ? one : '""'}`);
          } else {
            lines.push(`  ${lang}:`);
            v.forEach(p => lines.push(`    - ${p}`));
          }
        } else if (typeof v === 'string') {
          lines.push(`  ${lang}: ${v}`);
        } else if (isIndexMetadataObject(v)) {
          lines.push(`  ${lang}:`);
          writeYamlValue(lines, 2, v);
        }
      });
    });
    return lines.join('\n') + '\n';
  }

  function toTabsYaml(data) {
    const lines = [
      '# yaml-language-server: $schema=../assets/schema/tabs.json',
      ''
    ];
    const keys = data.__order && Array.isArray(data.__order) ? data.__order.slice() : Object.keys(data).filter(k => k !== '__order');
    keys.forEach(tab => {
      const entry = data[tab];
      if (!entry || typeof entry !== 'object') return;
      lines.push(`${tab}:`);
      const langs = sortLangKeys(entry);
      langs.forEach(lang => {
        const v = entry[lang];
        if (v && typeof v === 'object') {
          const title = v.title ?? '';
          const loc = v.location ?? '';
          lines.push(`  ${lang}:`);
          lines.push(`    title: ${quoteYamlScalar(title)}`);
          lines.push(`    location: ${loc ? loc : '""'}`);
        }
      });
      lines.push('');
    });
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.join('\n') + '\n';
  }

  return {
    displayLangName,
    langFlag,
    sortLangKeys,
    toIndexYaml,
    toTabsYaml
  };
}
