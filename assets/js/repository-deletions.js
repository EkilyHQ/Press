const MANAGED_MARKDOWN_PATH_RE = /^(?:post|tab)\/.+\.md$/i;
const LOCAL_MARKDOWN_ASSET_RE = /^assets\/.+/i;

export function normalizeRepositoryPath(path) {
  const raw = String(path || '').trim();
  if (!raw || raw.includes('\0')) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return '';
  const normalized = raw
    .replace(/[\\]/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
  const parts = [];
  for (const part of normalized.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') return '';
    parts.push(part);
  }
  return parts.join('/');
}

export function normalizeContentRoot(root = 'wwwroot') {
  const normalized = normalizeRepositoryPath(root || 'wwwroot');
  return normalized || 'wwwroot';
}

export function normalizeManagedContentMarkdownPath(path, contentRoot = 'wwwroot') {
  const normalized = normalizeRepositoryPath(path);
  if (!normalized) return null;
  const root = normalizeContentRoot(contentRoot);
  let contentPath = normalized;
  if (root && normalized.startsWith(`${root}/`)) {
    contentPath = normalized.slice(root.length + 1);
  }
  if (!MANAGED_MARKDOWN_PATH_RE.test(contentPath)) return null;
  return {
    contentPath,
    commitPath: root ? `${root}/${contentPath}` : contentPath
  };
}

export function resolveLocalMarkdownAssetReference(markdownPath, src, contentRoot = 'wwwroot') {
  const rawSrc = String(src || '').trim();
  if (!rawSrc || rawSrc.includes('\0')) return null;
  if (rawSrc.startsWith('/') || rawSrc.startsWith('#')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(rawSrc) || rawSrc.startsWith('//')) return null;
  const pathOnly = rawSrc.split(/[?#]/)[0].trim();
  if (!pathOnly) return null;
  const normalizedSrc = normalizeRepositoryPath(pathOnly);
  if (!normalizedSrc || !LOCAL_MARKDOWN_ASSET_RE.test(normalizedSrc)) return null;
  const markdown = normalizeManagedContentMarkdownPath(markdownPath, contentRoot);
  if (!markdown) return null;
  const idx = markdown.contentPath.lastIndexOf('/');
  const markdownDir = idx >= 0 ? markdown.contentPath.slice(0, idx) : '';
  const contentPath = normalizeRepositoryPath(markdownDir ? `${markdownDir}/${normalizedSrc}` : normalizedSrc);
  if (!contentPath || !contentPath.startsWith(`${markdownDir ? `${markdownDir}/` : ''}assets/`)) return null;
  const root = normalizeContentRoot(contentRoot);
  return {
    contentPath,
    commitPath: root ? `${root}/${contentPath}` : contentPath,
    markdownPath: markdown.contentPath,
    relativePath: normalizedSrc,
    source: rawSrc
  };
}

function markdownImageSources(markdown) {
  const text = String(markdown || '');
  const sources = [];
  const markdownImageRe = /!\[[^\]]*]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+["'][^)]*["'])?\s*\)/g;
  let match;
  while ((match = markdownImageRe.exec(text))) {
    const raw = String(match[1] || '').trim();
    sources.push(raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1).trim() : raw);
  }
  const obsidianEmbedRe = /!\[\[(.+?)\]\]/g;
  while ((match = obsidianEmbedRe.exec(text))) {
    const raw = String(match[1] || '').trim();
    if (!raw) continue;
    const pipeIdx = raw.indexOf('|');
    sources.push((pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw).trim());
  }
  const htmlImageRe = /<img\b[^>]*\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  while ((match = htmlImageRe.exec(text))) {
    sources.push(String(match[1] || match[2] || match[3] || '').trim());
  }
  return sources;
}

export function listLocalMarkdownAssetReferences(markdown, markdownPath, contentRoot = 'wwwroot') {
  const refs = [];
  markdownImageSources(markdown).forEach((src) => {
    const resolved = resolveLocalMarkdownAssetReference(markdownPath, src, contentRoot);
    if (resolved) refs.push(resolved);
  });
  return refs;
}

export function collectLocalMarkdownAssetReferences(markdown, markdownPath, contentRoot = 'wwwroot') {
  const refs = new Set();
  listLocalMarkdownAssetReferences(markdown, markdownPath, contentRoot).forEach((resolved) => {
    refs.add(resolved.contentPath);
  });
  return refs;
}

function normalizeIndexValue(value) {
  if (Array.isArray(value)) {
    return value.map(item => normalizeRepositoryPath(item)).filter(Boolean);
  }
  const normalized = normalizeRepositoryPath(value);
  return normalized ? [normalized] : [];
}

function normalizeTabValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return normalizeRepositoryPath(value.location);
  }
  return normalizeRepositoryPath(value);
}

function addManagedPath(target, rawPath, contentRoot) {
  const managed = normalizeManagedContentMarkdownPath(rawPath, contentRoot);
  if (!managed) return false;
  target.add(managed.contentPath);
  return true;
}

export function collectManagedMarkdownReferences({ index = {}, tabs = {}, contentRoot = 'wwwroot' } = {}) {
  const refs = new Set();
  const indexState = index && typeof index === 'object' ? index : {};
  Object.keys(indexState).forEach((key) => {
    if (key === '__order') return;
    const entry = indexState[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    Object.keys(entry).forEach((lang) => {
      normalizeIndexValue(entry[lang]).forEach(path => addManagedPath(refs, path, contentRoot));
    });
  });

  const tabsState = tabs && typeof tabs === 'object' ? tabs : {};
  Object.keys(tabsState).forEach((key) => {
    if (key === '__order') return;
    const entry = tabsState[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    Object.keys(entry).forEach((lang) => {
      addManagedPath(refs, normalizeTabValue(entry[lang]), contentRoot);
    });
  });
  return refs;
}

function addBaselineIndexEntry(target, entry, contentRoot) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
  Object.keys(entry).forEach((lang) => {
    normalizeIndexValue(entry[lang]).forEach(path => addManagedPath(target, path, contentRoot));
  });
}

function addBaselineTabEntry(target, entry, contentRoot) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
  Object.keys(entry).forEach((lang) => {
    addManagedPath(target, normalizeTabValue(entry[lang]), contentRoot);
  });
}

export function collectRemovedManagedMarkdownReferences({
  indexBaseline = {},
  tabsBaseline = {},
  indexDiff = null,
  tabsDiff = null,
  contentRoot = 'wwwroot'
} = {}) {
  const removed = new Set();
  const safeIndexBaseline = indexBaseline && typeof indexBaseline === 'object' ? indexBaseline : {};
  const safeTabsBaseline = tabsBaseline && typeof tabsBaseline === 'object' ? tabsBaseline : {};

  const indexRemovedKeys = Array.isArray(indexDiff && indexDiff.removedKeys) ? indexDiff.removedKeys : [];
  indexRemovedKeys.forEach((key) => addBaselineIndexEntry(removed, safeIndexBaseline[key], contentRoot));

  const indexKeys = indexDiff && indexDiff.keys && typeof indexDiff.keys === 'object' ? indexDiff.keys : {};
  Object.keys(indexKeys).forEach((key) => {
    if (indexRemovedKeys.includes(key)) return;
    const info = indexKeys[key] || {};
    const baselineEntry = safeIndexBaseline[key] && typeof safeIndexBaseline[key] === 'object' ? safeIndexBaseline[key] : {};
    const removedLangs = Array.isArray(info.removedLangs) ? info.removedLangs : [];
    removedLangs.forEach((lang) => {
      normalizeIndexValue(baselineEntry[lang]).forEach(path => addManagedPath(removed, path, contentRoot));
    });
    const langs = info.langs && typeof info.langs === 'object' ? info.langs : {};
    Object.keys(langs).forEach((lang) => {
      if (removedLangs.includes(lang)) return;
      const versionDiff = langs[lang] && langs[lang].versions;
      const removedVersions = versionDiff && Array.isArray(versionDiff.removed) ? versionDiff.removed : [];
      removedVersions.forEach((item) => {
        addManagedPath(removed, item && item.value, contentRoot);
      });
    });
  });

  const tabsRemovedKeys = Array.isArray(tabsDiff && tabsDiff.removedKeys) ? tabsDiff.removedKeys : [];
  tabsRemovedKeys.forEach((key) => addBaselineTabEntry(removed, safeTabsBaseline[key], contentRoot));

  const tabKeys = tabsDiff && tabsDiff.keys && typeof tabsDiff.keys === 'object' ? tabsDiff.keys : {};
  Object.keys(tabKeys).forEach((key) => {
    if (tabsRemovedKeys.includes(key)) return;
    const info = tabKeys[key] || {};
    const baselineEntry = safeTabsBaseline[key] && typeof safeTabsBaseline[key] === 'object' ? safeTabsBaseline[key] : {};
    const removedLangs = Array.isArray(info.removedLangs) ? info.removedLangs : [];
    removedLangs.forEach((lang) => {
      addManagedPath(removed, normalizeTabValue(baselineEntry[lang]), contentRoot);
    });
  });

  return removed;
}

export function planManagedContentDeletions({
  index = {},
  tabs = {},
  indexBaseline = {},
  tabsBaseline = {},
  indexDiff = null,
  tabsDiff = null,
  contentRoot = 'wwwroot',
  currentContentRoot = null,
  baselineContentRoot = null,
  dirtyMarkdownPaths = []
} = {}) {
  const currentRoot = currentContentRoot || contentRoot;
  const baselineRoot = baselineContentRoot || contentRoot;
  const removed = collectRemovedManagedMarkdownReferences({
    indexBaseline,
    tabsBaseline,
    indexDiff,
    tabsDiff,
    contentRoot: baselineRoot
  });
  const currentRefs = collectManagedMarkdownReferences({ index, tabs, contentRoot: currentRoot });
  const dirtyRefs = new Set();
  const dirtyRoots = Array.from(new Set([currentRoot, baselineRoot, contentRoot].filter(Boolean)));
  (Array.isArray(dirtyMarkdownPaths) ? dirtyMarkdownPaths : []).forEach((path) => {
    dirtyRoots.forEach((root) => {
      const managed = normalizeManagedContentMarkdownPath(path, root);
      if (managed) dirtyRefs.add(managed.contentPath);
    });
  });

  const files = [];
  const skipped = [];
  const blocked = [];
  const seenCommitPaths = new Set();
  Array.from(removed).sort((a, b) => a.localeCompare(b)).forEach((contentPath) => {
    const managed = normalizeManagedContentMarkdownPath(contentPath, baselineRoot);
    if (!managed) {
      skipped.push({ path: contentPath, reason: 'invalid' });
      return;
    }
    if (currentRefs.has(managed.contentPath)) {
      skipped.push({ path: managed.contentPath, reason: 'still-referenced' });
      return;
    }
    if (dirtyRefs.has(managed.contentPath)) {
      blocked.push({ path: managed.contentPath, reason: 'dirty-draft' });
      return;
    }
    if (seenCommitPaths.has(managed.commitPath)) return;
    seenCommitPaths.add(managed.commitPath);
    files.push({
      kind: 'markdown',
      category: 'content',
      label: managed.contentPath,
      path: managed.commitPath,
      markdownPath: managed.contentPath,
      state: 'deleted',
      deleted: true
    });
  });

  return { files, skipped, blocked };
}
