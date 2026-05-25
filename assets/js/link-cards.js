import { renderTags, escapeHtml, formatDisplayDate, cardImageSrc, fallbackCover, getContentRoot } from './utils.js';
import { extractExcerpt, computeReadTime, parseFrontMatter } from './content.js';
import { isEncryptedMarkdown, stripEncryptedBodyForPublicUse } from './encrypted-content.js?v=press-system-v3.4.52';
import { hydrateCardCovers } from './post-render.js';

const DEFAULT_STRINGS = {
  'ui.loading': 'Loading…',
  'ui.minRead': 'min read',
  'ui.draftBadge': 'Draft',
  'ui.protectedBadge': 'Protected',
  'ui.protectedExcerpt': 'Protected article'
};

const defaultTranslate = (key) => DEFAULT_STRINGS[key] || key;
const defaultMakeHref = (loc) => `?id=${encodeURIComponent(loc)}`;

function createLinkCardState() {
  return {
    mdCache: new Map()
  };
}

function createLinkCardRuntime(options = {}) {
  const state = createLinkCardState();
  const documentRef = options.documentRef || null;
  const windowRef = options.windowRef || null;
  const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : null;
  return {
    state,
    getDocument() {
      return documentRef || (typeof document !== 'undefined' ? document : null);
    },
    getWindow() {
      return windowRef || (typeof window !== 'undefined' ? window : null);
    },
    getFetch() {
      if (fetchImpl) return fetchImpl;
      if (typeof fetch === 'function') return fetch;
      return null;
    }
  };
}

const defaultFetchMarkdown = (runtime, loc) => {
  try {
    const url = `${getContentRoot()}/${loc}`;
    const fetchRef = runtime && typeof runtime.getFetch === 'function' ? runtime.getFetch() : null;
    if (!fetchRef) return Promise.resolve('');
    return fetchRef(url, { cache: 'no-store' }).then(resp => (resp && resp.ok) ? resp.text() : '');
  } catch (_) {
    return Promise.resolve('');
  }
};

function resolveMetaForLocation(loc, postsIndexCache, postsByLocationTitle) {
  if (!loc) return {};
  if (postsIndexCache && typeof postsIndexCache === 'object') {
    // Fast path: location is stored directly in entries
    for (const [title, meta] of Object.entries(postsIndexCache)) {
      if (meta && meta.location === loc) return { title, meta };
      if (meta && Array.isArray(meta.versions)) {
        const hit = meta.versions.find(v => v && v.location === loc);
        if (hit) return { title, meta: { ...meta, ...hit } };
      }
    }
  }
  if (postsByLocationTitle && postsByLocationTitle[loc]) {
    const title = postsByLocationTitle[loc];
    const meta = postsIndexCache && postsIndexCache[title];
    if (meta) return { title, meta };
  }
  return { title: loc, meta: {} };
}

function resolveCoverSrc(meta, loc) {
  if (!meta || typeof meta !== 'object') return '';
  const rawCover = meta.thumb || meta.cover || meta.image;
  if (!rawCover || typeof rawCover !== 'string') return '';
  if (/^https?:\/\//i.test(rawCover) || rawCover.startsWith('/') || rawCover.includes('/')) {
    return rawCover;
  }
  const baseLoc = meta.location || loc || '';
  const lastSlash = String(baseLoc).lastIndexOf('/');
  const baseDir = lastSlash >= 0 ? String(baseLoc).slice(0, lastSlash + 1) : '';
  return (baseDir + rawCover).replace(/\/+/g, '/');
}

function mergeMetaWithFrontMatter(baseMeta, frontMatter, loc) {
  const meta = (baseMeta && typeof baseMeta === 'object') ? { ...baseMeta } : {};
  const fm = (frontMatter && typeof frontMatter === 'object') ? frontMatter : {};

  if (!meta.location) meta.location = loc;

  if (fm.title && (!meta.title || meta.title === loc)) {
    meta.title = fm.title;
  }
  if (fm.excerpt && !meta.excerpt) {
    meta.excerpt = fm.excerpt;
  }
  if (fm.date && !meta.date) {
    meta.date = fm.date;
  }

  const fmTags = (() => {
    if (Array.isArray(fm.tags)) return fm.tags;
    if (Array.isArray(fm.tag)) return fm.tag;
    if (typeof fm.tags === 'string') return fm.tags.split(',');
    if (typeof fm.tag === 'string') return fm.tag.split(',');
    return null;
  })();
  if ((!meta.tag || (Array.isArray(meta.tag) && meta.tag.length === 0)) && fmTags) {
    meta.tag = fmTags;
  }

  const fmCover = fm.cover || fm.image || fm.thumb || fm.thumbnail || fm.coverImage || fm.cover_image || fm.hero || fm.banner;
  if (fmCover && !meta.cover && !meta.image && !meta.thumb) {
    meta.cover = fmCover;
  }

  if (fm.draft != null && meta.draft == null) {
    if (typeof fm.draft === 'boolean') meta.draft = fm.draft;
    else if (typeof fm.draft === 'number') meta.draft = fm.draft !== 0;
    else if (typeof fm.draft === 'string') {
      const norm = fm.draft.trim().toLowerCase();
      if (['true', 'yes', '1', 'draft'].includes(norm)) meta.draft = true;
      else if (['false', 'no', '0', 'published'].includes(norm)) meta.draft = false;
    }
  }

  if (fm.protected != null && meta.protected == null) {
    if (typeof fm.protected === 'boolean') meta.protected = fm.protected;
    else if (typeof fm.protected === 'number') meta.protected = fm.protected !== 0;
    else if (typeof fm.protected === 'string') {
      const norm = fm.protected.trim().toLowerCase();
      if (['true', 'yes', '1', 'protected'].includes(norm)) meta.protected = true;
      else if (['false', 'no', '0', 'public'].includes(norm)) meta.protected = false;
    }
  }

  return meta;
}

function buildCoverHtml(meta, loc, title, siteConfig) {
  const src = resolveCoverSrc(meta, loc);
  if (src) {
    return `<div class="card-cover-wrap"><div class="ph-skeleton" aria-hidden="true"></div><img class="card-cover" alt="${escapeHtml(title)}" src="${escapeHtml(cardImageSrc(src))}" loading="lazy" decoding="async" fetchpriority="low" width="1600" height="1000"></div>`;
  }
  const useFallbackCover = !(siteConfig && siteConfig.cardCoverFallback === false);
  return useFallbackCover ? fallbackCover(title) : '';
}

function ensureMarkdown(runtime, loc, fetchMarkdown) {
  const state = runtime.state;
  if (!loc) return Promise.resolve('');
  if (!state.mdCache.has(loc)) {
    state.mdCache.set(loc, Promise.resolve(fetchMarkdown(loc)).catch(() => ''));
  }
  return state.mdCache.get(loc);
}

function hydrateInternalLinkCardsWithRuntime(runtime, container, options = {}) {
  const {
    allowedLocations = null,
    locationAliasMap = new Map(),
    postsByLocationTitle = {},
    postsIndexCache = {},
    siteConfig = {},
    fetchMarkdown = (loc) => defaultFetchMarkdown(runtime, loc),
    translate = defaultTranslate,
    makeHref = defaultMakeHref
  } = options || {};

  try {
    const documentRef = runtime.getDocument();
    const windowRef = runtime.getWindow();
    if (!documentRef || !windowRef || !windowRef.location) return;
    const NodeCtor = (windowRef && windowRef.Node) || (typeof Node !== 'undefined' ? Node : null);
    const textNodeType = NodeCtor ? NodeCtor.TEXT_NODE : 3;
    const root = typeof container === 'string' ? documentRef.querySelector(container) : (container || documentRef);
    if (!root) return;
    const anchors = Array.from(root.querySelectorAll('a[href]'));
    if (!anchors.length) return;

    const isWhitespaceOnlySiblings = (el) => {
      const p = el && el.parentNode;
      if (!p) return false;
      const nodes = Array.from(p.childNodes || []);
      return nodes.every(n => (n === el) || (n.nodeType === textNodeType && !String(n.textContent || '').trim()));
    };

    const parseInternalLink = (href) => {
      if (!href) return null;
      const trimmed = String(href).trim();
      if (!trimmed || trimmed.startsWith('#')) return null;
      if (/^(mailto:|javascript:)/i.test(trimmed)) return null;

      const startsWithQuery = trimmed.startsWith('?');
      let url;
      try {
        url = new URL(trimmed, windowRef.location.href);
      } catch (_) {
        return null;
      }

      if (!startsWithQuery && url.origin !== windowRef.location.origin) return null;

      const id = url.searchParams.get('id');
      if (!id) return null;

      return { id, url, startsWithQuery, originalHref: trimmed };
    };

    const buildCardHref = (loc, parsed) => {
      let baseHref = '';
      try {
        baseHref = makeHref ? makeHref(loc, parsed) : defaultMakeHref(loc);
      } catch (_) {
        baseHref = defaultMakeHref(loc);
      }
      if (baseHref == null || baseHref === false) baseHref = '';
      baseHref = String(baseHref);

      if (!parsed || !parsed.url) {
        return baseHref || defaultMakeHref(loc);
      }

      let extras = '';
      try {
        const params = new URLSearchParams(parsed.url.search || '');
        params.delete('id');
        extras = params.toString();
      } catch (_) {
        extras = '';
      }

      const originalHash = (parsed.url && parsed.url.hash) || '';
      let base = baseHref;
      let baseHash = '';
      const hashIdx = base.indexOf('#');
      if (hashIdx >= 0) {
        baseHash = base.slice(hashIdx);
        base = base.slice(0, hashIdx);
      }

      if (!base) {
        try {
          const clone = new URL(parsed.url.href);
          clone.searchParams.set('id', loc);
          if (!extras) {
            // extras already included via clone search params
          }
          if (parsed.startsWithQuery) {
            return `${clone.search || ''}${clone.hash || ''}` || defaultMakeHref(loc);
          }
          if (clone.origin === windowRef.location.origin) {
            return `${clone.pathname}${clone.search}${clone.hash || ''}` || defaultMakeHref(loc);
          }
          return clone.href || defaultMakeHref(loc);
        } catch (_) {
          return parsed.originalHref || defaultMakeHref(loc);
        }
      }

      if (extras) {
        if (base.includes('?')) {
          base += (base.endsWith('?') || base.endsWith('&')) ? extras : `&${extras}`;
        } else {
          base += `?${extras}`;
        }
      }

      const hashToUse = baseHash || (originalHash && !baseHash ? originalHash : '');
      return `${base}${hashToUse}`;
    };

    anchors.forEach(a => {
      const parsed = parseInternalLink(a.getAttribute('href') || '');
      if (!parsed) return;
      const rawLoc = parsed.id;
      const aliased = locationAliasMap.has(rawLoc) ? locationAliasMap.get(rawLoc) : rawLoc;
      const allowSet = allowedLocations instanceof Set ? allowedLocations : null;
      if (allowSet && allowSet.size > 0) {
        if (!allowSet.has(rawLoc) && !allowSet.has(aliased)) return;
      }
      const loc = aliased;

      const parent = a.parentElement;
      const isStandalone = parent && ['P', 'LI', 'DIV'].includes(parent.tagName) && isWhitespaceOnlySiblings(a);
      const titleAttr = (a.getAttribute('title') || '').trim();
      const forceCard = /\b(card|preview)\b/i.test(titleAttr) || a.hasAttribute('data-card') || a.classList.contains('card');
      if (!isStandalone && !forceCard) return;

      const { title: resolvedTitle = loc, meta = {} } = resolveMetaForLocation(loc, postsIndexCache, postsByLocationTitle) || {};
      const href = buildCardHref(loc, parsed);
      const tagsHtml = renderTags(meta.tag);
      const dateHtml = meta && meta.date ? `<span class="card-date">${escapeHtml(formatDisplayDate(meta.date))}</span>` : '';
      const protectedHtml = meta && meta.protected ? `<span class="card-draft">${escapeHtml(translate('ui.protectedBadge'))}</span>` : '';
      const draftHtml = meta && meta.draft ? `<span class="card-draft">${escapeHtml(translate('ui.draftBadge'))}</span>` : '';
      const cover = buildCoverHtml(meta, loc, resolvedTitle, siteConfig);
      const initialExcerpt = meta && meta.excerpt
        ? String(meta.excerpt)
        : (meta && meta.protected ? translate('ui.protectedExcerpt') : translate('ui.loading'));

      const wrapper = documentRef.createElement('div');
      wrapper.className = 'link-card-wrap';
      const initialMeta = [dateHtml, protectedHtml, draftHtml].filter(Boolean).join('<span class="card-sep">•</span>');
      wrapper.innerHTML = `<a class="link-card" href="${href}">${cover}<div class="card-title">${escapeHtml(resolvedTitle)}</div><div class="card-excerpt">${escapeHtml(initialExcerpt)}</div><div class="card-meta">${initialMeta}</div>${tagsHtml}</a>`;

      try {
        const exNode = wrapper.querySelector('.card-excerpt');
        if (exNode && meta && meta.excerpt) {
          exNode.textContent = String(meta.excerpt);
        }
      } catch (_) {}

      if (parent.tagName === 'LI' && isStandalone) {
        a.replaceWith(wrapper);
      } else if (isStandalone && (parent.tagName === 'P' || parent.tagName === 'DIV')) {
        const target = parent;
        target.parentNode.insertBefore(wrapper, target);
        target.remove();
      } else {
        const after = parent.nextSibling;
        parent.parentNode.insertBefore(wrapper, after);
        a.remove();
        if (!parent.textContent || !parent.textContent.trim()) {
          parent.remove();
        }
      }

      hydrateCardCovers(wrapper);

      if (meta && meta.protected) return;

      ensureMarkdown(runtime, loc, fetchMarkdown).then(md => {
        if (!wrapper.isConnected) return;
        const rawMarkdown = String(md || '');
        const encrypted = isEncryptedMarkdown(rawMarkdown);
        const publicMarkdown = encrypted ? stripEncryptedBodyForPublicUse(rawMarkdown) : rawMarkdown;
        const ex = encrypted ? translate('ui.protectedExcerpt') : extractExcerpt(publicMarkdown, 50);
        const minutes = encrypted ? 0 : computeReadTime(publicMarkdown, 200);
        const card = wrapper.querySelector('a.link-card');
        if (!card) return;
        const { frontMatter } = parseFrontMatter(publicMarkdown);
        const mergedMeta = mergeMetaWithFrontMatter(meta, frontMatter, loc);
        if (encrypted) mergedMeta.protected = true;
        const finalTitle = mergedMeta.title || resolvedTitle || loc;

        const existingCover = card.querySelector('.card-cover-wrap');
        const nextCoverHtml = buildCoverHtml(mergedMeta, loc, finalTitle, siteConfig);
        if (existingCover || nextCoverHtml) {
          if (existingCover) existingCover.remove();
          if (nextCoverHtml) {
            const temp = documentRef.createElement('div');
            temp.innerHTML = nextCoverHtml;
            const nextCover = temp.firstElementChild;
            if (nextCover) {
              card.insertBefore(nextCover, card.firstChild);
            }
          }
        }

        const titleEl = card.querySelector('.card-title');
        if (titleEl && finalTitle) {
          titleEl.textContent = finalTitle;
        }

        const exEl = card.querySelector('.card-excerpt');
        if (exEl) {
          const preferredExcerpt = mergedMeta && mergedMeta.excerpt ? String(mergedMeta.excerpt) : ex;
          exEl.textContent = preferredExcerpt;
        }

        const metaEl = card.querySelector('.card-meta');
        if (metaEl) {
          const fragments = [];
          if (mergedMeta && mergedMeta.date) {
            const date = documentRef.createElement('span');
            date.className = 'card-date';
            try {
              date.textContent = formatDisplayDate(mergedMeta.date);
            } catch (_) {
              date.textContent = String(mergedMeta.date);
            }
            fragments.push(date);
          }
          if (mergedMeta && mergedMeta.protected) {
            const p = documentRef.createElement('span');
            p.className = 'card-draft';
            p.textContent = translate('ui.protectedBadge');
            fragments.push(p);
          }
          if (!encrypted) {
            const read = documentRef.createElement('span');
            read.className = 'card-read';
            read.textContent = `${minutes} ${translate('ui.minRead')}`;
            fragments.push(read);
          }
          if (mergedMeta && mergedMeta.draft) {
            const d = documentRef.createElement('span');
            d.className = 'card-draft';
            d.textContent = translate('ui.draftBadge');
            fragments.push(d);
          }
          metaEl.textContent = '';
          fragments.forEach((node, idx) => {
            if (idx > 0) {
              const sep = documentRef.createElement('span');
              sep.className = 'card-sep';
              sep.textContent = '•';
              metaEl.appendChild(sep);
            }
            metaEl.appendChild(node);
          });
        }

        const nextTagsHtml = renderTags(mergedMeta && mergedMeta.tag);
        const existingTags = card.querySelector('.tags');
        if (nextTagsHtml) {
          const temp = documentRef.createElement('div');
          temp.innerHTML = nextTagsHtml;
          const nextTags = temp.firstElementChild;
          if (nextTags) {
            if (existingTags) existingTags.replaceWith(nextTags);
            else card.appendChild(nextTags);
          }
        } else if (existingTags) {
          existingTags.remove();
        }

        hydrateCardCovers(wrapper);
      }).catch(() => {});
    });
  } catch (_) {}
}

export function createLinkCardHydrator(options = {}) {
  const runtime = createLinkCardRuntime(options);
  return {
    hydrate(container, hydrateOptions = {}) {
      return hydrateInternalLinkCardsWithRuntime(runtime, container, hydrateOptions);
    },
    clearMarkdownCache() {
      runtime.state.mdCache.clear();
    },
    getMarkdownCacheSize() {
      return runtime.state.mdCache.size;
    }
  };
}

const defaultLinkCardHydrator = createLinkCardHydrator();

export function hydrateInternalLinkCards(container, options = {}) {
  return defaultLinkCardHydrator.hydrate(container, options);
}
