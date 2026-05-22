import { computeReadTime, extractExcerpt, parseFrontMatter } from './content.js?v=press-system-v3.4.43';
import { parseEncryptedMarkdownEnvelope } from './encrypted-content.js?v=press-system-v3.4.43';

const INDEX_PUBLISH_METADATA_KEYS = new Set([
  'location',
  'path',
  'title',
  'date',
  'tag',
  'tags',
  'image',
  'thumb',
  'cover',
  'excerpt',
  'readTime',
  'readMinutes',
  'minutes',
  'protected',
  'encryption',
  'version',
  'versionLabel',
  'ai',
  'aiGenerated',
  'llm',
  'draft',
  'wip',
  'unfinished',
  'inprogress'
]);

function interpretIndexTruthyFlag(value) {
  if (value === true) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y' || normalized === 'on' || normalized === 'enabled';
}

function getIndexField(source, keys, isIndexMetadataObject) {
  const input = isIndexMetadataObject(source) ? source : {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return { found: true, key, value: input[key] };
    }
  }
  return { found: false, key: '', value: undefined };
}

export function createIndexPublishMetadataEnricher({
  safeString = (value) => String(value == null ? '' : value),
  normalizeRelPath = (value) => String(value || '').replace(/\\+/g, '/').replace(/^\/+/, ''),
  normalizeMarkdownContent = (value) => String(value == null ? '' : value).replace(/\r\n?/g, '\n'),
  isIndexMetadataObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value),
  cloneIndexMetadataValue = (value) => value,
  getIndexVariantLocation = (value) => typeof value === 'string' ? value : safeString(value && (value.location || value.path)),
  normalizeIndexVariantList = (value) => Array.isArray(value) ? value : [value],
  prepareIndexState = (state) => state || { __order: [] },
  deepClone = (value) => JSON.parse(JSON.stringify(value)),
  sortLangKeys = (entry) => Object.keys(entry || {}).filter(key => key !== '__order').sort(),
  extractVersionFromPath = () => '',
  findDynamicTabByPath = () => null,
  getLockedEncryptedMarkdownDraft = () => '',
  getMarkdownProtectionState = () => ({}),
  getContentRootSafe = () => 'wwwroot',
  fetchImpl = fetch
} = {}) {
  function isIndexVariantPublishComplete(value) {
    if (!isIndexMetadataObject(value)) return false;
    if (!getIndexVariantLocation(value)) return false;
    if (!safeString(value.title).trim()) return false;
    if (value.protected == null && value.encryption == null) return false;
    const protectedPost = interpretIndexTruthyFlag(value.protected) || !!value.encryption;
    if (protectedPost) return !!safeString(value.excerpt).trim() || value.readTime != null;
    return value.readTime != null && safeString(value.excerpt).trim();
  }

  function normalizeIndexPublishTags(value) {
    if (Array.isArray(value)) {
      const tags = value.map(item => safeString(item).trim()).filter(Boolean);
      return tags.length ? tags : undefined;
    }
    const tag = safeString(value).trim();
    return tag || undefined;
  }

  function resolveIndexPublishImage(image, location) {
    const raw = safeString(image).trim();
    if (!raw) return undefined;
    if (/^(https?:|data:)/i.test(raw) || raw.startsWith('/')) return raw;
    const lastSlash = safeString(location).lastIndexOf('/');
    const baseDir = lastSlash >= 0 ? safeString(location).slice(0, lastSlash + 1) : '';
    return normalizeRelPath(`${baseDir}${raw}`) || raw;
  }

  function getIndexGeneratedMetadata(existing = {}) {
    const out = {};
    if (!isIndexMetadataObject(existing)) return out;
    Object.keys(existing).forEach((key) => {
      if (INDEX_PUBLISH_METADATA_KEYS.has(key)) return;
      const cloned = cloneIndexMetadataValue(existing[key]);
      if (cloned !== undefined && cloned !== null && cloned !== '') out[key] = cloned;
    });
    return out;
  }

  function copyExistingIndexFields(out, existing, keys) {
    if (!out || !isIndexMetadataObject(existing)) return false;
    let copied = false;
    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(existing, key)) return;
      const cloned = cloneIndexMetadataValue(existing[key]);
      if (cloned === undefined || cloned === null || cloned === '') return;
      out[key] = cloned;
      copied = true;
    });
    return copied;
  }

  function buildIndexMetadataFromMarkdown(markdown, location, fallbackTitle, existing = {}, options = {}) {
    const source = normalizeMarkdownContent(markdown || '');
    const plaintext = normalizeMarkdownContent(options.plaintextContent || '');
    const envelope = parseEncryptedMarkdownEnvelope(source);
    const { frontMatter } = parseFrontMatter(source);
    const fm = frontMatter || {};
    const protectedField = getIndexField(fm, ['protected', 'encryption'], isIndexMetadataObject);
    const explicitUnprotected = options.protectionExplicit === true && options.protected === false;
    const existingProtected = interpretIndexTruthyFlag(existing.protected) || !!existing.encryption;
    const protectedPost = !!options.protected
      || envelope.encrypted
      || (protectedField.found ? interpretIndexTruthyFlag(protectedField.value) : (!explicitUnprotected && existingProtected));
    const out = {
      ...getIndexGeneratedMetadata(existing),
      location
    };
    const title = safeString(fm.title || existing.title || fallbackTitle).trim();
    if (title) out.title = title;
    const dateField = getIndexField(fm, ['date'], isIndexMetadataObject);
    if (dateField.found) {
      if (safeString(dateField.value).trim()) out.date = dateField.value;
    } else {
      copyExistingIndexFields(out, existing, ['date']);
    }
    const tagsField = getIndexField(fm, ['tags', 'tag'], isIndexMetadataObject);
    if (tagsField.found) {
      const tags = normalizeIndexPublishTags(tagsField.value);
      if (tags !== undefined) out.tags = tags;
    } else {
      copyExistingIndexFields(out, existing, ['tags', 'tag']);
    }
    const imageField = getIndexField(fm, ['image', 'cover', 'thumb'], isIndexMetadataObject);
    if (imageField.found) {
      const image = resolveIndexPublishImage(imageField.value, location);
      if (image) out.image = image;
    } else {
      copyExistingIndexFields(out, existing, ['image', 'cover', 'thumb']);
    }
    const excerptField = getIndexField(fm, ['excerpt'], isIndexMetadataObject);
    const excerpt = protectedPost
      ? safeString(excerptField.found ? excerptField.value : existing.excerpt).trim()
      : safeString(excerptField.found ? excerptField.value : extractExcerpt(source, 50)).trim();
    if (excerpt) out.excerpt = excerpt;
    const readSource = plaintext || (!protectedPost ? source : '');
    if (readSource) out.readTime = computeReadTime(readSource, 200);
    else {
      const readTimeField = getIndexField(existing, ['readTime', 'readMinutes', 'minutes'], isIndexMetadataObject);
      if (readTimeField.found && readTimeField.value !== '') out.readTime = cloneIndexMetadataValue(readTimeField.value);
    }
    out.protected = !!protectedPost;
    const versionField = getIndexField(fm, ['version', 'versionLabel'], isIndexMetadataObject);
    if (versionField.found) {
      const versionLabel = safeString(versionField.value).trim();
      if (versionLabel) out.versionLabel = versionLabel;
    } else if (!copyExistingIndexFields(out, existing, ['versionLabel', 'version'])) {
      const versionLabel = safeString(extractVersionFromPath(location)).trim();
      if (versionLabel) out.versionLabel = versionLabel;
    }
    const aiField = getIndexField(fm, ['ai', 'aiGenerated', 'llm'], isIndexMetadataObject);
    if (aiField.found) {
      if (interpretIndexTruthyFlag(aiField.value)) out.ai = true;
    } else {
      copyExistingIndexFields(out, existing, ['ai', 'aiGenerated', 'llm']);
    }
    const draftField = getIndexField(fm, ['draft', 'wip', 'unfinished', 'inprogress'], isIndexMetadataObject);
    if (draftField.found) {
      if (interpretIndexTruthyFlag(draftField.value)) out.draft = true;
    } else {
      copyExistingIndexFields(out, existing, ['draft', 'wip', 'unfinished', 'inprogress']);
    }
    return out;
  }

  async function readMarkdownForIndexMetadata(location, pendingMarkdownByPath, contentRoot) {
    const normalized = normalizeRelPath(location);
    if (!normalized) return null;
    if (pendingMarkdownByPath && pendingMarkdownByPath.has(normalized)) {
      const pending = pendingMarkdownByPath.get(normalized);
      return pending && typeof pending === 'object'
        ? { ...pending, protectionExplicit: true }
        : { content: normalizeMarkdownContent(pending || ''), plaintextContent: '', protected: false, protectionExplicit: true };
    }
    const tab = findDynamicTabByPath(normalized);
    if (tab) {
      const locked = getLockedEncryptedMarkdownDraft(tab);
      if (locked) return { content: locked, plaintextContent: '', protected: true, protectionExplicit: true };
      if (tab.content != null) {
        const protection = getMarkdownProtectionState(tab);
        return {
          content: normalizeMarkdownContent(tab.content),
          plaintextContent: normalizeMarkdownContent(tab.content),
          protected: !!(protection && protection.enabled),
          protectionExplicit: true
        };
      }
      if (tab.remoteContent != null) {
        const protection = getMarkdownProtectionState(tab);
        return {
          content: normalizeMarkdownContent(tab.remoteContent),
          plaintextContent: normalizeMarkdownContent(tab.remoteContent),
          protected: !!(protection && protection.enabled),
          protectionExplicit: true
        };
      }
    }
    const root = safeString(contentRoot || getContentRootSafe() || 'wwwroot').replace(/\\+/g, '/').replace(/\/?$/, '');
    const url = `${root || 'wwwroot'}/${normalized}`;
    try {
      const response = await fetchImpl(url, { cache: 'no-store' });
      if (!response || !response.ok) return null;
      return { content: normalizeMarkdownContent(await response.text()), plaintextContent: '', protected: false };
    } catch (_) {
      return null;
    }
  }

  async function enrichIndexStateForPublish(state, options = {}) {
    const source = prepareIndexState(state || { __order: [] });
    const next = deepClone(source);
    const pendingMarkdownByPath = options.pendingMarkdownByPath instanceof Map ? options.pendingMarkdownByPath : new Map();
    const contentRoot = options.contentRoot || 'wwwroot';
    const keys = Array.isArray(next.__order) ? next.__order.slice() : Object.keys(next).filter(key => key !== '__order');
    for (const key of keys) {
      const entry = next[key];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      for (const lang of sortLangKeys(entry)) {
        const originalValue = entry[lang];
        const originalWasArray = Array.isArray(originalValue);
        const variants = normalizeIndexVariantList(originalValue);
        const enriched = [];
        for (const variant of variants) {
          const location = getIndexVariantLocation(variant);
          if (!location) continue;
          if (isIndexVariantPublishComplete(variant) && !pendingMarkdownByPath.has(location)) {
            enriched.push(variant);
            continue;
          }
          const markdownEntry = await readMarkdownForIndexMetadata(location, pendingMarkdownByPath, contentRoot);
          if (!markdownEntry || !markdownEntry.content) {
            enriched.push(variant);
            continue;
          }
          enriched.push(buildIndexMetadataFromMarkdown(
            markdownEntry.content,
            location,
            key,
            isIndexMetadataObject(variant) ? variant : {},
            {
              plaintextContent: markdownEntry.plaintextContent,
              protected: markdownEntry.protected,
              protectionExplicit: markdownEntry.protectionExplicit
            }
          ));
        }
        if (!enriched.length) {
          delete entry[lang];
        } else if (originalWasArray || enriched.length > 1) {
          entry[lang] = enriched;
        } else {
          entry[lang] = enriched[0];
        }
      }
    }
    return next;
  }

  return {
    buildIndexMetadataFromMarkdown,
    enrichIndexStateForPublish
  };
}
