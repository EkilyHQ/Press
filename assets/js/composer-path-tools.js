export function createComposerPathTools(options = {}) {
  const preferredLangOrder = Array.isArray(options.preferredLangOrder)
    ? options.preferredLangOrder
    : [];
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const getIndexVariantLocation = typeof options.getIndexVariantLocation === 'function'
    ? options.getIndexVariantLocation
    : ((value) => (typeof value === 'string' ? value : ''));
  const isIndexMetadataObject = typeof options.isIndexMetadataObject === 'function'
    ? options.isIndexMetadataObject
    : ((value) => !!(value && typeof value === 'object' && !Array.isArray(value)));
  const getIndexEntry = typeof options.getIndexEntry === 'function'
    ? options.getIndexEntry
    : (() => ({}));

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

  function basenameFromPath(relPath) {
    const norm = normalizeRelPath(relPath);
    if (!norm) return '';
    const idx = norm.lastIndexOf('/');
    return idx >= 0 ? norm.slice(idx + 1) : norm;
  }

  function dirnameFromPath(relPath) {
    const norm = normalizeRelPath(relPath);
    if (!norm) return '';
    const idx = norm.lastIndexOf('/');
    if (idx <= 0) return '';
    return norm.slice(0, idx);
  }

  function isComposerVersionTag(version) {
    return /^v\d+(?:\.\d+)*$/i.test(String(version || '').trim());
  }

  function isComposerVersionSegment(segment) {
    return /^v\d+(?:\.\d+)*$/i.test(String(segment || '').trim());
  }

  function findExplicitArticleVersionSegmentIndex(segments) {
    const parts = Array.isArray(segments) ? segments : [];
    if (parts.length < 3) return -1;
    if (String(parts[0] || '').trim().toLowerCase() !== 'post') return -1;
    const candidateIndex = parts.length - 1;
    if (candidateIndex < 2) return -1;
    if (!isComposerVersionSegment(parts[candidateIndex])) return -1;
    return candidateIndex;
  }

  function extractVersionFromPath(relPath) {
    try {
      const normalized = normalizeRelPath(relPath);
      if (!normalized) return '';
      const segments = normalized.split('/');
      if (segments.length <= 1) return '';
      segments.pop();
      const versionIndex = findExplicitArticleVersionSegmentIndex(segments);
      return versionIndex >= 0 ? String(segments[versionIndex] || '') : '';
    } catch (_) {
      return '';
    }
  }

  function getContentRootSafe() {
    try {
      const root = windowRef && windowRef.__press_content_root;
      if (root && typeof root === 'string' && root.trim()) {
        return root.trim().replace(/[\\]/g, '/').replace(/\/?$/, '');
      }
    } catch (_) {}
    return 'wwwroot';
  }

  function computeBaseDirForPath(relPath) {
    const root = getContentRootSafe();
    const rel = normalizeRelPath(relPath);
    const idx = rel.lastIndexOf('/');
    const dir = idx >= 0 ? rel.slice(0, idx + 1) : '';
    const base = `${root}/${dir}`.replace(/[\\]/g, '/');
    return base.endsWith('/') ? base : `${base}/`;
  }

  function encodeGitHubPath(path) {
    const clean = String(path || '')
      .replace(/[\\]/g, '/')
      .replace(/^\/+/g, '')
      .replace(/\/+/g, '/')
      .replace(/\/?$/, '');
    if (!clean) return '';
    return clean.split('/').map(part => encodeURIComponent(part)).join('/');
  }

  function getDefaultComposerLanguage() {
    if (preferredLangOrder.length > 0) return preferredLangOrder[0];
    return 'en';
  }

  function buildDefaultEntryPath(kind, key, lang) {
    const normalizedKind = kind === 'tabs' ? 'tabs' : 'index';
    const baseFolder = normalizedKind === 'tabs' ? 'tab' : 'post';
    const safeKey = String(key || '').trim();
    const fallbackLang = String(lang || '').trim() || getDefaultComposerLanguage() || 'en';
    const normalizedLang = fallbackLang.toLowerCase();
    const filename = normalizedLang ? `main_${normalizedLang}.md` : 'main.md';
    const folder = normalizedKind === 'tabs'
      ? (safeKey ? `${baseFolder}/${safeKey}` : baseFolder)
      : (safeKey ? `${baseFolder}/${safeKey}/v1.0.0` : `${baseFolder}/v1.0.0`);
    return `${folder}/${filename}`;
  }

  function normalizeComposerLangCode(lang) {
    return String(lang || '').trim().toLowerCase();
  }

  function normalizeComposerVersionTag(version) {
    const raw = String(version || '').trim();
    if (!raw) return '';
    return `v${raw.replace(/^v/i, '')}`;
  }

  function normalizeComposerVersionPaths(value) {
    if (Array.isArray(value)) return value.map(item => getIndexVariantLocation(item)).filter(Boolean);
    const normalized = getIndexVariantLocation(value);
    return normalized ? [normalized] : [];
  }

  function stripComposerLangSuffix(name, codes) {
    let result = String(name || '');
    if (!result) return result;
    const seen = new Set();
    (codes || []).forEach((code) => {
      const normalized = normalizeComposerLangCode(code);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      const suffix = `_${normalized}`;
      if (result.toLowerCase().endsWith(suffix)) {
        result = result.slice(0, result.length - suffix.length);
      }
    });
    return result;
  }

  function pickComposerReferencePath(kind, entry, excludeLang) {
    const normalizedKind = kind === 'tabs' ? 'tabs' : 'index';
    const list = preferredLangOrder.slice();
    try {
      Object.keys(entry || {}).forEach((code) => {
        if (!list.includes(code)) list.push(code);
      });
    } catch (_) {}
    for (let i = 0; i < list.length; i += 1) {
      const code = list[i];
      if (!code || code === excludeLang) continue;
      const value = entry ? entry[code] : null;
      if (!value) continue;
      let path = '';
      if (normalizedKind === 'tabs') {
        if (value && typeof value === 'object' && typeof value.location === 'string') {
          path = value.location;
        }
      } else if (Array.isArray(value)) {
        path = value.map(item => getIndexVariantLocation(item)).find(Boolean) || '';
      } else if (typeof value === 'string') {
        path = value;
      } else if (isIndexMetadataObject(value)) {
        path = getIndexVariantLocation(value);
      }
      if (path) return { lang: code, path };
    }
    return null;
  }

  function buildDefaultLanguagePathFromEntry(kind, key, lang, entry) {
    const normalizedKind = kind === 'tabs' ? 'tabs' : 'index';
    const fallback = buildDefaultEntryPath(normalizedKind, key, lang);
    const reference = pickComposerReferencePath(normalizedKind, entry, lang);
    if (!reference || !reference.path) return fallback;

    const normalizedLang = normalizeComposerLangCode(lang);
    const segments = String(reference.path || '').split('/');
    if (segments.length === 0) return fallback;
    let filename = segments.pop() || '';
    if (!filename) return fallback;

    const dotIndex = filename.lastIndexOf('.');
    let namePart = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename;
    const extPart = dotIndex >= 0 ? filename.slice(dotIndex) : '';

    const codesToStrip = [];
    codesToStrip.push(reference.lang);
    codesToStrip.push(...preferredLangOrder);
    try { Object.keys(entry || {}).forEach((code) => { codesToStrip.push(code); }); } catch (_) {}
    codesToStrip.push(lang);
    namePart = stripComposerLangSuffix(namePart, codesToStrip);

    const finalName = normalizedLang ? `${namePart}_${normalizedLang}` : namePart;
    filename = `${finalName}${extPart}`;
    if (normalizedKind === 'index') {
      const versionIndex = findExplicitArticleVersionSegmentIndex(segments);
      if (versionIndex >= 0) segments[versionIndex] = 'v1.0.0';
      else segments.push('v1.0.0');
    }
    segments.push(filename);
    return segments.join('/');
  }

  function buildArticleVersionPath(key, lang, version, entry) {
    const normalizedVersion = normalizeComposerVersionTag(version);
    const normalizedLang = normalizeComposerLangCode(lang);
    const sourceEntry = entry && typeof entry === 'object' ? entry : getIndexEntry(key);
    const current = normalizeComposerVersionPaths(sourceEntry[lang]);
    const reference = current[current.length - 1] || buildDefaultLanguagePathFromEntry('index', key, normalizedLang, sourceEntry);
    const fallback = buildDefaultEntryPath('index', key, normalizedLang).replace('/v1.0.0/', `/${normalizedVersion}/`);
    const normalizedPath = normalizeRelPath(reference || fallback);
    if (!normalizedPath) return fallback;
    const segments = normalizedPath.split('/');
    let filename = segments.pop() || '';
    if (!filename) filename = normalizedLang ? `main_${normalizedLang}.md` : 'main.md';
    const versionIndex = findExplicitArticleVersionSegmentIndex(segments);
    if (versionIndex >= 0) segments[versionIndex] = normalizedVersion;
    else segments.push(normalizedVersion);
    segments.push(filename);
    return segments.join('/');
  }

  function collectComposerArticleVersions(paths) {
    const versions = new Set();
    const arr = normalizeComposerVersionPaths(paths);
    arr.forEach((path) => {
      const explicitVersion = normalizeComposerVersionTag(extractVersionFromPath(path));
      if (explicitVersion) versions.add(explicitVersion.toLowerCase());
      else if (normalizeRelPath(path)) versions.add('v1.0.0');
    });
    return versions;
  }

  function makeDefaultMdTemplate(opts) {
    const templateOptions = opts && typeof opts === 'object' ? opts : {};
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const lines = [
      '---',
      'title: ',
      `date: ${dateStr}`,
    ];
    if (templateOptions.version) lines.push(`version: ${String(templateOptions.version)}`);
    lines.push(
      'tags: ',
      'excerpt: ',
      'author: ',
      'ai: false',
      'draft: true',
      '---',
      ''
    );
    return lines.join('\n');
  }

  function getDefaultMarkdownForPath(relPath) {
    try {
      const normalized = normalizeRelPath(relPath);
      if (!normalized) return '';
      const clean = normalized.replace(/^\/+/, '');
      if (!clean.toLowerCase().startsWith('post/')) return '';
      const version = extractVersionFromPath(clean);
      return makeDefaultMdTemplate(version ? { version } : undefined);
    } catch (_) {
      return '';
    }
  }

  return {
    normalizeRelPath,
    basenameFromPath,
    dirnameFromPath,
    findExplicitArticleVersionSegmentIndex,
    extractVersionFromPath,
    getContentRootSafe,
    computeBaseDirForPath,
    encodeGitHubPath,
    getDefaultComposerLanguage,
    buildDefaultEntryPath,
    normalizeComposerLangCode,
    normalizeComposerVersionTag,
    normalizeComposerVersionPaths,
    isComposerVersionTag,
    isComposerVersionSegment,
    stripComposerLangSuffix,
    pickComposerReferencePath,
    buildDefaultLanguagePathFromEntry,
    buildArticleVersionPath,
    collectComposerArticleVersions,
    makeDefaultMdTemplate,
    getDefaultMarkdownForPath
  };
}
