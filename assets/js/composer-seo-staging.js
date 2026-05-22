import { generateSitemapData, resolveSiteBaseUrl } from './seo.js?v=press-system-v3.4.44';

function escapeSeoXml(str) {
  return String(str || '').replace(/[<>&'\"]/g, (char) => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return char;
    }
  });
}

function escapeSeoHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

function formatSeoXml(xml) {
  try {
    const formatted = [];
    let pad = 0;
    xml
      .replace(/>(\s*)</g, '>$1\n<')
      .split('\n')
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (/^<\//.test(trimmed)) pad = Math.max(pad - 1, 0);
        formatted.push(`${'  '.repeat(pad)}${trimmed}`);
        if (/^<[^!?][^>]*[^/]>/i.test(trimmed) && !/<.*<\/.*>/.test(trimmed)) pad += 1;
      });
    return formatted.join('\n');
  } catch (_) {
    return xml;
  }
}

function generateSeoSitemapXml(urls) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
  urls.forEach((url) => {
    if (!url || !url.loc) return;
    xml += '  <url>\n';
    xml += `    <loc>${escapeSeoXml(url.loc)}</loc>\n`;
    if (Array.isArray(url.alternates)) {
      url.alternates.forEach((alt) => {
        if (!alt || !alt.href || !alt.hreflang) return;
        xml += `    <xhtml:link rel="alternate" hreflang="${escapeSeoXml(alt.hreflang)}" href="${escapeSeoXml(alt.href)}"/>\n`;
      });
      if (url.xdefault) {
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeSeoXml(url.xdefault)}"/>\n`;
      }
    }
    if (url.lastmod) xml += `    <lastmod>${escapeSeoXml(url.lastmod)}</lastmod>\n`;
    if (url.changefreq) xml += `    <changefreq>${escapeSeoXml(url.changefreq)}</changefreq>\n`;
    if (url.priority) xml += `    <priority>${escapeSeoXml(url.priority)}</priority>\n`;
    xml += '  </url>\n';
  });
  xml += '</urlset>';
  return formatSeoXml(xml);
}

function computeSeoContentRoot(siteConfig) {
  const raw = siteConfig && siteConfig.contentRoot ? String(siteConfig.contentRoot) : 'wwwroot';
  const trimmed = raw.trim().replace(/^\/+|\/+$/g, '');
  return trimmed || 'wwwroot';
}

function generateSeoRobotsTxt(siteConfig) {
  const baseUrl = resolveSiteBaseUrl(siteConfig);
  const contentRoot = computeSeoContentRoot(siteConfig);
  const deriveBasePath = () => {
    if (!baseUrl) return '/';
    const ensureLeadingAndTrailingSlash = (value) => {
      if (!value) return '/';
      let normalized = value;
      if (!normalized.startsWith('/')) normalized = `/${normalized}`;
      normalized = normalized.replace(/\/+/g, '/');
      if (normalized !== '/' && !normalized.endsWith('/')) normalized = `${normalized}/`;
      return normalized === '//' ? '/' : normalized;
    };
    const resolvePathname = (raw) => {
      if (!raw) return '/';
      try {
        const parsed = new URL(raw);
        return parsed.pathname || '/';
      } catch (_) {
        try {
          if (typeof window !== 'undefined' && window.location && window.location.origin) {
            const parsed = new URL(raw, window.location.origin);
            return parsed.pathname || '/';
          }
        } catch (_) {
          /* noop */
        }
      }
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('/')) return trimmed;
      }
      return '/';
    };
    const pathname = resolvePathname(baseUrl);
    if (!pathname || pathname === '/') return '/';
    return ensureLeadingAndTrailingSlash(pathname);
  };
  const basePath = deriveBasePath();
  const withBasePath = (path) => {
    const input = String(path == null ? '' : path).trim();
    if (!input || input === '/') return basePath;
    const hasTrailingSlash = input.endsWith('/');
    const stripped = input.replace(/^\/+/, '');
    const prefix = basePath === '/' ? '/' : basePath;
    let combined = prefix === '/' ? `/${stripped}` : `${prefix}${stripped}`;
    if (hasTrailingSlash && !combined.endsWith('/')) combined += '/';
    if (!combined.startsWith('/')) combined = `/${combined}`;
    return combined === '//' ? '/' : combined;
  };
  let robots = 'User-agent: *\n';
  robots += `Allow: ${withBasePath('/')}\n\n`;
  robots += '# Sitemap\n';
  robots += `Sitemap: ${baseUrl}sitemap.xml\n\n`;
  robots += '# Allow crawling of main content\n';
  robots += `Allow: ${withBasePath(`${contentRoot}/`)}\n`;
  robots += `Allow: ${withBasePath('assets/')}\n\n`;
  robots += '# Disallow admin or internal directories\n';
  robots += `Disallow: ${withBasePath('admin/')}\n`;
  robots += `Disallow: ${withBasePath('.git/')}\n`;
  robots += `Disallow: ${withBasePath('node_modules/')}\n`;
  robots += `Disallow: ${withBasePath('.env')}\n`;
  robots += `Disallow: ${withBasePath('package.json')}\n`;
  robots += `Disallow: ${withBasePath('package-lock.json')}\n\n`;
  robots += '# SEO tools (allow but not priority)\n';
  robots += `Allow: ${withBasePath('sitemap-generator.html')}\n\n`;
  robots += '# Crawl delay (be nice to servers)\n';
  robots += 'Crawl-delay: 1\n\n';
  robots += '# Generated by Press\n';
  robots += `# ${new Date().toISOString()}\n`;
  return robots;
}

function generateSeoMetaTags(siteConfig) {
  const baseUrl = resolveSiteBaseUrl(siteConfig);
  const getLocalizedValue = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    if (val.default) return val.default;
    const langs = Object.keys(val);
    if (langs.length) return val[langs[0]];
    return fallback;
  };
  const siteTitle = getLocalizedValue(siteConfig.siteTitle, 'Press');
  const siteDescription = getLocalizedValue(siteConfig.siteDescription, 'Where knowledge becomes pages.');
  const siteKeywords = getLocalizedValue(siteConfig.siteKeywords, 'blog, static site, markdown');
  const avatar = siteConfig.avatar || 'assets/avatar.png';
  const fullAvatarUrl = avatar.startsWith('http') ? avatar : baseUrl + avatar.replace(/^\/+/, '');
  let html = '';
  html += `  <!-- Primary SEO Meta Tags -->\n`;
  html += `  <title>${escapeSeoHtml(siteTitle)}</title>\n`;
  html += `  <meta name="title" content="${escapeSeoHtml(siteTitle)}">\n`;
  html += `  <meta name="description" content="${escapeSeoHtml(siteDescription)}">\n`;
  html += `  <meta name="keywords" content="${escapeSeoHtml(siteKeywords)}">\n`;
  html += `  <meta name="author" content="${escapeSeoHtml(siteTitle)}">\n`;
  html += '  <meta name="robots" content="index, follow">\n';
  html += `  <link rel="canonical" href="${baseUrl}">\n`;
  html += '  \n';
  html += '  <!-- Open Graph / Facebook -->\n';
  html += '  <meta property="og:type" content="website">\n';
  html += `  <meta property="og:url" content="${baseUrl}">\n`;
  html += `  <meta property="og:title" content="${escapeSeoHtml(siteTitle)}">\n`;
  html += `  <meta property="og:description" content="${escapeSeoHtml(siteDescription)}">\n`;
  html += `  <meta property="og:image" content="${escapeSeoHtml(fullAvatarUrl)}">\n`;
  html += `  <meta property="og:logo" content="${escapeSeoHtml(fullAvatarUrl)}">\n`;
  html += '  \n';
  html += '  <!-- Twitter -->\n';
  html += '  <meta property="twitter:card" content="summary_large_image">\n';
  html += `  <meta property="twitter:url" content="${baseUrl}">\n`;
  html += `  <meta property="twitter:title" content="${escapeSeoHtml(siteTitle)}">\n`;
  html += `  <meta property="twitter:description" content="${escapeSeoHtml(siteDescription)}">\n`;
  html += `  <meta property="twitter:image" content="${escapeSeoHtml(fullAvatarUrl)}">\n`;
  html += '  \n';
  html += '  <!-- Initial meta tags - will be updated by dynamic SEO system -->\n';
  html += '  <meta name="theme-color" content="#1a1a1a">\n';
  html += '  <meta name="msapplication-TileColor" content="#1a1a1a">\n';
  html += `  <link rel="icon" type="image/png" href="${escapeSeoHtml(avatar)}">`;
  return html;
}

function normalizeSeoLangCode(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return '';
  const sanitized = raw.replace(/[^0-9A-Za-z-]/g, '');
  return sanitized || '';
}

function computeSeoHtmlLang(siteConfig) {
  const fromConfig = siteConfig && siteConfig.defaultLanguage;
  const normalized = normalizeSeoLangCode(fromConfig);
  if (normalized) return normalized;
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const docLang = normalizeSeoLangCode(document.documentElement.lang);
      if (docLang) return docLang;
    }
  } catch (_) { /* ignore */ }
  return 'en';
}

function applySeoHtmlLang(html, lang) {
  const normalized = normalizeSeoLangCode(lang);
  if (!normalized) return html;
  const langAttrRegex = /(<html\b[^>]*\blang\s*=\s*)(["'])([^"']*)(\2)/i;
  if (langAttrRegex.test(html)) {
    return html.replace(langAttrRegex, `$1$2${normalized}$4`);
  }
  return html.replace(/<html\b([^>]*)>/i, `<html$1 lang="${normalized}">`);
}

function injectSeoMetaIntoIndexHtml(baseHtml, metaBlock) {
  if (!baseHtml) return '';
  const META_START = '  <!-- Primary SEO Meta Tags -->';
  const META_NOTE = '  <!-- Note: Structured data is dynamically generated by the SEO system -->';
  const startIndex = baseHtml.indexOf(META_START);
  const noteIndex = baseHtml.indexOf(META_NOTE);
  if (startIndex === -1 || noteIndex === -1 || noteIndex < startIndex) return '';
  const before = baseHtml.slice(0, startIndex);
  const after = baseHtml.slice(noteIndex + META_NOTE.length);
  const trimmedMeta = metaBlock.trimEnd();
  const replacement = `${trimmedMeta}\n\n${META_NOTE}`;
  return `${before}${replacement}${after}`;
}

function buildDefaultIndexHtml(metaBlock, lang) {
  const langAttr = normalizeSeoLangCode(lang) || 'en';
  const trimmedMeta = metaBlock.trimEnd();
  const metaSection = trimmedMeta ? `${trimmedMeta}\n\n` : '';
  let html = '<!DOCTYPE html>\n';
  html += `<html lang="${escapeSeoHtml(langAttr)}">\n\n`;
  html += '<head>\n';
  html += '  <meta charset="UTF-8">\n';
  html += '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n\n';
  html += metaSection;
  html += '  <!-- Note: Structured data is dynamically generated by the SEO system -->\n\n';
  html += '  <script src="assets/js/theme-boot.js?v=press-system-v3.4.44"></script>\n';
  html += '  <link rel="stylesheet" id="theme-pack">\n';
  html += '</head>\n\n';
  html += '<body>\n';
  html += '  <script type="module" src="assets/main.js?v=press-system-v3.4.44"></script>\n';
  html += '</body>\n\n';
  html += '</html>\n';
  return html;
}

function generateSeoIndexHtml(siteConfig, baseHtml) {
  const metaBlock = ensureTrailingNewline(generateSeoMetaTags(siteConfig)).trimEnd();
  const lang = computeSeoHtmlLang(siteConfig);
  let html = '';
  if (baseHtml) {
    html = injectSeoMetaIntoIndexHtml(baseHtml, metaBlock);
  }
  if (!html) {
    html = buildDefaultIndexHtml(metaBlock, lang);
  }
  html = applySeoHtmlLang(html, lang);
  return ensureTrailingNewline(html);
}

function ensureTrailingNewline(text) {
  const str = String(text == null ? '' : text);
  return str.endsWith('\n') ? str : `${str}\n`;
}

function normalizeSeoContent(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n?/g, '\n')
    .trim();
}

export function createSeoStagingProvider({
  getStateSlice = () => ({}),
  getContentRootSafe = () => 'wwwroot',
  getRemoteBaselineSite = () => ({}),
  cloneSiteState = (state) => ({ ...(state || {}) }),
  isIndexMetadataObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value),
  getIndexVariantLocation = (value) => typeof value === 'string' ? value : String(value && (value.location || value.path) || ''),
  fetchImpl = fetch
} = {}) {
  function exportIndexDataForSeo(state) {
    const output = {};
    if (!state || typeof state !== 'object') return output;
    const keys = Array.isArray(state.__order)
      ? state.__order.filter((key) => key && key !== '__order')
      : Object.keys(state);
    keys.forEach((key) => {
      if (key === '__order') return;
      const entry = state[key];
      if (!entry || typeof entry !== 'object') return;
      const langs = {};
      Object.keys(entry).forEach((lang) => {
        if (lang === '__order') return;
        const value = entry[lang];
        if (Array.isArray(value)) {
          const normalized = value
            .map((item) => getIndexVariantLocation(item))
            .filter((item) => item);
          if (!normalized.length) return;
          if (normalized.length === 1) langs[lang] = normalized[0];
          else langs[lang] = normalized;
        } else if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) langs[lang] = trimmed;
        } else if (isIndexMetadataObject(value)) {
          const location = getIndexVariantLocation(value);
          if (location) langs[lang] = location;
        }
      });
      if (Object.keys(langs).length) output[key] = langs;
    });
    return output;
  }

  function exportTabsDataForSeo(state) {
    const output = {};
    if (!state || typeof state !== 'object') return output;
    const keys = Array.isArray(state.__order)
      ? state.__order.filter((key) => key && key !== '__order')
      : Object.keys(state);
    keys.forEach((key) => {
      if (key === '__order') return;
      const entry = state[key];
      if (!entry || typeof entry !== 'object') return;
      const langs = {};
      Object.keys(entry).forEach((lang) => {
        if (lang === '__order') return;
        const value = entry[lang];
        if (!value || typeof value !== 'object') return;
        const title = value.title != null ? String(value.title) : '';
        const location = value.location != null ? String(value.location) : '';
        if (!title && !location) return;
        langs[lang] = { title, location };
      });
      if (Object.keys(langs).length) output[key] = langs;
    });
    return output;
  }

  function exportSiteConfigForSeo(state) {
    const base = cloneSiteState(state || {});
    if (!base.contentRoot) base.contentRoot = getContentRootSafe() || 'wwwroot';
    if (!base.defaultLanguage) {
      try {
        const baseline = getRemoteBaselineSite();
        if (baseline && baseline.defaultLanguage) base.defaultLanguage = baseline.defaultLanguage;
      } catch (_) { /* ignore */ }
    }
    return base;
  }

  async function fetchExistingSeoFile(path) {
    try {
      const response = await fetchImpl(path, { cache: 'no-store' });
      if (!response.ok) return '';
      return await response.text();
    } catch (_) {
      return '';
    }
  }

  async function getCommitFiles() {
    try {
      const siteState = exportSiteConfigForSeo(getStateSlice('site'));
      const indexState = exportIndexDataForSeo(getStateSlice('index'));
      const tabsState = exportTabsDataForSeo(getStateSlice('tabs'));
      const urls = generateSitemapData(indexState, tabsState, siteState) || [];
      const sitemapXml = ensureTrailingNewline(generateSeoSitemapXml(urls));
      const robotsTxt = ensureTrailingNewline(generateSeoRobotsTxt(siteState));
      const remoteIndexHtml = await fetchExistingSeoFile('index.html');
      const indexHtml = generateSeoIndexHtml(siteState, remoteIndexHtml);

      const candidates = [
        { seoType: 'sitemap', path: 'sitemap.xml', label: 'sitemap.xml', content: sitemapXml },
        { seoType: 'robots', path: 'robots.txt', label: 'robots.txt', content: robotsTxt },
        { seoType: 'index', path: 'index.html', label: 'index.html', content: indexHtml, remote: remoteIndexHtml }
      ];

      const files = [];
      for (const candidate of candidates) {
        const remote = Object.prototype.hasOwnProperty.call(candidate, 'remote')
          ? candidate.remote
          : await fetchExistingSeoFile(candidate.path);
        if (normalizeSeoContent(remote) === normalizeSeoContent(candidate.content)) continue;
        files.push({
          kind: 'seo',
          seoType: candidate.seoType,
          label: candidate.label,
          path: candidate.path,
          content: candidate.content,
          isSeo: true
        });
      }
      return files;
    } catch (err) {
      console.error('Failed to prepare SEO files for commit', err);
      return [];
    }
  }

  return {
    getCommitFiles
  };
}
