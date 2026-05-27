import {
  assertThemePressCompatibility,
  bufferToBase64,
  collectThemeArchiveEntries,
  digestSha256,
  normalizeFileList,
  normalizeRegistryRelease,
  normalizeThemeReleaseManifest,
  safeString,
  sanitizeThemeSlug,
  themeFilesFromManifest,
  verifyThemeAsset
} from './theme-package-core.js';

const THEME_ROOT = 'assets/themes';

export function themeCommitPath(slug, relPath) {
  return `${THEME_ROOT}/${slug}/${relPath}`.replace(/\/+/g, '/');
}

function normalizeFetchProvider(value) {
  if (typeof value === 'function') return value;
  return () => {
    throw new Error('Theme install service fetch is unavailable.');
  };
}

function createSummary(files, theme) {
  return files.map((file) => ({
    kind: 'system',
    category: 'theme',
    theme,
    label: file.label || file.path,
    path: file.path,
    state: file.state || 'modified',
    deleted: !!file.deleted
  }));
}

function makeRegistryEntry({ archive, previous, releaseManifest, source, assetMeta }) {
  const builtIn = archive.slug === 'native';
  if (builtIn && !(previous && previous.builtIn)) {
    throw new Error('The native theme can only be managed by Press system updates.');
  }
  return {
    value: archive.slug,
    label: releaseManifest ? releaseManifest.label : archive.label,
    version: releaseManifest ? releaseManifest.version : archive.version,
    contractVersion: archive.contractVersion,
    engines: archive.engines,
    builtIn: !!(previous && previous.builtIn),
    removable: previous && previous.builtIn ? false : true,
    source: previous && previous.builtIn ? { type: 'builtin' } : source,
    release: previous && previous.builtIn ? normalizeRegistryRelease(previous.release) : {
      tag: releaseManifest && releaseManifest.release ? releaseManifest.release.tag : '',
      name: releaseManifest && releaseManifest.release ? releaseManifest.release.name : '',
      htmlUrl: releaseManifest && releaseManifest.release ? releaseManifest.release.htmlUrl : '',
      publishedAt: releaseManifest && releaseManifest.release ? releaseManifest.release.publishedAt : '',
      assetName: assetMeta.assetName || '',
      size: assetMeta.size || 0,
      digest: assetMeta.digest || '',
      installedAt: new Date().toISOString()
    },
    files: archive.files.map((file) => file.path).sort((a, b) => a.localeCompare(b))
  };
}

function buildRegistryChange(registry, nextEntry) {
  const next = [];
  let replaced = false;
  registry.forEach((entry) => {
    if (entry.value === nextEntry.value) {
      next.push(nextEntry);
      replaced = true;
    } else {
      next.push(entry);
    }
  });
  if (!replaced) next.push(nextEntry);
  next.sort((a, b) => {
    if (a.value === 'native') return -1;
    if (b.value === 'native') return 1;
    return a.value.localeCompare(b.value);
  });
  return next;
}

function registryCommitFile(registry) {
  return {
    kind: 'system',
    category: 'theme',
    theme: 'registry',
    label: 'assets/themes/packs.json',
    path: 'assets/themes/packs.json',
    state: 'modified',
    content: `${JSON.stringify(registry, null, 2)}\n`
  };
}

export function createThemeInstallService(options = {}) {
  const getFetch = normalizeFetchProvider(options.getFetch);
  const loadOfficialThemeCatalog = typeof options.loadOfficialThemeCatalog === 'function'
    ? options.loadOfficialThemeCatalog
    : async () => [];

  async function fetchText(path) {
    const fetchImpl = getFetch();
    try {
      const response = await fetchImpl(`${path}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response || !response.ok) return { exists: false, content: '' };
      return { exists: true, content: await response.text() };
    } catch (_) {
      return { exists: false, content: '' };
    }
  }

  async function fetchExists(path) {
    const fetchImpl = getFetch();
    try {
      const response = await fetchImpl(`${path}?ts=${Date.now()}`, { cache: 'no-store' });
      return !!(response && response.ok);
    } catch (_) {
      return false;
    }
  }

  async function fetchBase64(path) {
    const fetchImpl = getFetch();
    try {
      const response = await fetchImpl(`${path}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!response || !response.ok) return { exists: false, base64: '' };
      return { exists: true, base64: bufferToBase64(await response.arrayBuffer()) };
    } catch (_) {
      return { exists: false, base64: '' };
    }
  }

  async function fetchJson(url) {
    const response = await getFetch()(url, { cache: 'no-store' });
    if (!response || !response.ok) throw new Error(`Unable to fetch ${url}.`);
    return response.json();
  }

  async function fetchArrayBuffer(url) {
    const response = await getFetch()(url, { cache: 'no-store' });
    if (!response || !response.ok) throw new Error(`Unable to download ${url}.`);
    return response.arrayBuffer();
  }

  async function filterExistingThemeFiles(slug, files, options = {}) {
    const normalized = normalizeFileList(files);
    const existing = [];
    const assumeThemeJsonExists = options.assumeThemeJsonExists === true;
    for (const relPath of normalized) {
      if (relPath === 'theme.json' && assumeThemeJsonExists) {
        existing.push(relPath);
        continue;
      }
      if (await fetchExists(themeCommitPath(slug, relPath))) existing.push(relPath);
    }
    return existing;
  }

  async function inferLocalThemeFiles(slug) {
    try {
      const manifestPath = themeCommitPath(slug, 'theme.json');
      const existing = await fetchText(manifestPath);
      if (!existing.exists || !existing.content) return [];
      return await filterExistingThemeFiles(slug, themeFilesFromManifest(JSON.parse(existing.content)), { assumeThemeJsonExists: true });
    } catch (_) {
      return [];
    }
  }

  async function inferCatalogThemeFiles(slug) {
    try {
      const catalog = await loadOfficialThemeCatalog();
      const entry = catalog.find((item) => item.value === slug);
      if (!entry || !entry.manifestUrl) return [];
      const manifest = normalizeThemeReleaseManifest(await fetchJson(entry.manifestUrl));
      return await filterExistingThemeFiles(slug, manifest.files);
    } catch (_) {
      return [];
    }
  }

  async function resolveThemeFileInventory(entry) {
    if (!entry || !entry.value) return [];
    const value = sanitizeThemeSlug(entry.value);
    const explicit = normalizeFileList(entry.files);
    if (explicit.length) return await filterExistingThemeFiles(value, explicit);
    const local = await inferLocalThemeFiles(value);
    if (local.length) return local;
    const catalog = await inferCatalogThemeFiles(value);
    if (catalog.length) return catalog;
    return [];
  }

  async function buildThemeFileChanges(archive, previousEntry) {
    const changes = [];
    const oldFiles = new Set(await resolveThemeFileInventory(previousEntry));
    const newFiles = new Set(archive.files.map((file) => file.path));
    for (const file of archive.files) {
      const path = themeCommitPath(archive.slug, file.path);
      const base = {
        kind: 'system',
        category: 'theme',
        theme: archive.slug,
        label: path,
        path,
        state: 'added'
      };
      if (file.binary) {
        const existing = await fetchBase64(path);
        if (existing.exists && existing.base64 === file.base64) continue;
        changes.push({
          ...base,
          state: existing.exists ? 'modified' : 'added',
          binary: true,
          base64: file.base64,
          size: file.size,
          mime: 'application/octet-stream'
        });
      } else {
        const existing = await fetchText(path);
        if (existing.exists && existing.content === file.content) continue;
        changes.push({
          ...base,
          state: existing.exists ? 'modified' : 'added',
          content: file.content
        });
      }
    }
    oldFiles.forEach((relPath) => {
      if (newFiles.has(relPath)) return;
      const path = themeCommitPath(archive.slug, relPath);
      changes.push({
        kind: 'system',
        category: 'theme',
        theme: archive.slug,
        label: path,
        path,
        state: 'deleted',
        deleted: true
      });
    });
    changes.sort((a, b) => a.path.localeCompare(b.path));
    return changes;
  }

  async function stageThemeArchive({
    buffer,
    fileName = '',
    registry = [],
    releaseManifest = null,
    source = null,
    allowBuiltInUpdate = false
  } = {}) {
    if (releaseManifest) {
      await verifyThemeAsset(buffer, releaseManifest.asset, releaseManifest.asset.name);
    }
    const digest = await digestSha256(buffer);
    const archive = collectThemeArchiveEntries(buffer, { expectedSlug: releaseManifest && releaseManifest.value });
    if (releaseManifest && archive.version && archive.version !== releaseManifest.version) {
      throw new Error('Theme ZIP theme.json version does not match the release manifest.');
    }
    if (releaseManifest && archive.engines.press !== releaseManifest.engines.press) {
      throw new Error('Theme ZIP engines.press does not match the release manifest.');
    }
    await assertThemePressCompatibility(releaseManifest ? releaseManifest.label : archive.label, archive.engines);
    const previous = registry.find((entry) => entry.value === archive.slug) || null;
    if (previous && previous.builtIn && !allowBuiltInUpdate) {
      throw new Error('Built-in themes are updated only by Press system updates.');
    }
    const nextSource = source || {
      type: 'manual',
      url: safeString(fileName || '').trim()
    };
    const assetMeta = {
      assetName: releaseManifest ? releaseManifest.asset.name : safeString(fileName || `press-theme-${archive.slug}.zip`),
      digest: `sha256:${digest}`,
      size: buffer.byteLength
    };
    const nextEntry = makeRegistryEntry({ archive, previous, releaseManifest, source: nextSource, assetMeta });
    const nextRegistry = buildRegistryChange(registry, nextEntry);
    const files = await buildThemeFileChanges(archive, previous);
    files.push(registryCommitFile(nextRegistry));
    return {
      archive,
      previous,
      nextEntry,
      registry: nextRegistry,
      files,
      summary: createSummary(files, archive.slug),
      meta: { digest: `sha256:${digest}`, size: buffer.byteLength, assetName: assetMeta.assetName }
    };
  }

  async function stageCatalogTheme({ catalogEntry, registry = [], allowBuiltInUpdate = false } = {}) {
    const releaseManifest = normalizeThemeReleaseManifest(await fetchJson(catalogEntry.manifestUrl));
    if (releaseManifest.value !== catalogEntry.value) {
      throw new Error('Official catalog entry does not match release manifest slug.');
    }
    const buffer = await fetchArrayBuffer(releaseManifest.asset.url);
    return stageThemeArchive({
      buffer,
      fileName: releaseManifest.asset.name,
      registry,
      releaseManifest,
      allowBuiltInUpdate,
      source: {
        type: 'official',
        repo: catalogEntry.repo,
        manifestUrl: catalogEntry.manifestUrl
      }
    });
  }

  async function stageUninstall({ slug, registry = [], currentThemePack = '' } = {}) {
    const value = sanitizeThemeSlug(slug);
    const entry = registry.find((item) => item.value === value);
    if (!entry) throw new Error(`Theme ${value} is not installed.`);
    if (entry.builtIn || entry.removable === false) throw new Error('Built-in themes cannot be uninstalled.');
    const inventory = await resolveThemeFileInventory(entry);
    if (!inventory.length) {
      throw new Error(`Theme ${entry.label || value} has no file inventory. Reinstall or update it before uninstalling.`);
    }
    const files = inventory.map((relPath) => {
      const path = themeCommitPath(value, relPath);
      return {
        kind: 'system',
        category: 'theme',
        theme: value,
        label: path,
        path,
        state: 'deleted',
        deleted: true
      };
    });
    const nextRegistry = registry.filter((item) => item.value !== value);
    files.push(registryCommitFile(nextRegistry));
    return {
      entry,
      registry: nextRegistry,
      files,
      summary: createSummary(files, value),
      siteThemeFallback: currentThemePack === value ? { from: value, to: 'native' } : null
    };
  }

  return {
    resolveThemeFileInventory,
    stageCatalogTheme,
    stageThemeArchive,
    stageUninstall
  };
}
