function fallbackNormalizeLangKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getElement(documentRef, runtime, id) {
  if (runtime && typeof runtime.getElementById === 'function') {
    return runtime.getElementById(id);
  }
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

export function createEditorMainSidebarSession(options = {}) {
  const runtime = options.runtime || {};
  const documentRef = options.documentRef || null;
  const normalizeLangKey = typeof options.normalizeLangKey === 'function'
    ? options.normalizeLangKey
    : fallbackNormalizeLangKey;
  const loadSiteConfig = typeof options.loadSiteConfig === 'function'
    ? options.loadSiteConfig
    : async () => ({});
  const loadIndexData = typeof options.loadIndexData === 'function'
    ? options.loadIndexData
    : async () => ({ raw: {}, entries: {} });
  const loadTabsConfig = typeof options.loadTabsConfig === 'function'
    ? options.loadTabsConfig
    : async () => ({});
  const bindCurrentFileElement = typeof options.bindCurrentFileElement === 'function'
    ? options.bindCurrentFileElement
    : () => {};
  const onSiteConfigLoaded = typeof options.onSiteConfigLoaded === 'function'
    ? options.onSiteConfigLoaded
    : () => {};
  const onIndexLoaded = typeof options.onIndexLoaded === 'function'
    ? options.onIndexLoaded
    : () => {};
  const onOpenMarkdown = typeof options.onOpenMarkdown === 'function'
    ? options.onOpenMarkdown
    : async () => {};
  const onWarn = typeof options.onWarn === 'function'
    ? options.onWarn
    : () => {};
  const showAlert = typeof options.alert === 'function'
    ? options.alert
    : () => {};

  let listIndex = null;
  let listTabs = null;
  let statusEl = null;
  let searchInput = null;
  let sideTabs = [];
  let groupIndex = null;
  let groupTabs = null;
  let currentActive = null;
  let contentRoot = 'wwwroot';
  let activeGroup = 'index';
  let bound = false;

  const setStatus = (message) => {
    if (statusEl) statusEl.textContent = message || '';
  };

  const basename = (path) => {
    try {
      const value = String(path || '');
      const index = value.lastIndexOf('/');
      return index >= 0 ? value.slice(index + 1) : value;
    } catch (_) {
      return String(path || '');
    }
  };

  const toUrl = (path) => {
    const value = String(path || '').trim();
    if (!value) return '';
    if (/^(https?:)?\//i.test(value)) return value;
    return `${contentRoot}/${value}`.replace(/\\+/g, '/');
  };

  const extractVersion = (path) => {
    try {
      const match = String(path || '').match(/(?:^|\/)v\d+(?:\.\d+)*(?=\/|$)/i);
      return match ? match[0].split('/').pop() : '';
    } catch (_) {
      return '';
    }
  };

  const versionParts = (version) => {
    try {
      const value = String(version || '').replace(/^v/i, '');
      return value.split('.').map(part => {
        const parsed = Number.parseInt(part, 10);
        return Number.isFinite(parsed) ? parsed : 0;
      });
    } catch (_) {
      return [0];
    }
  };

  const compareVersionDesc = (left, right) => {
    const a = versionParts(left);
    const b = versionParts(right);
    const length = Math.max(a.length, b.length);
    for (let index = 0; index < length; index += 1) {
      const x = a[index] || 0;
      const y = b[index] || 0;
      if (x !== y) return y - x;
    }
    return 0;
  };

  const makeLi = (label, relPath) => {
    const li = documentRef.createElement('li');
    li.className = 'file-item';
    li.dataset.rel = relPath;
    li.dataset.label = String(label || '').toLowerCase();
    li.dataset.file = String(relPath || '').toLowerCase();
    li.innerHTML = `
        <div class="file-main">
          <span class="file-label">${label}</span>
          <span class="file-path">${relPath}</span>
        </div>`;
    li.addEventListener('click', async () => {
      const url = toUrl(relPath);
      if (!url) return;
      try {
        setStatus('Loading...');
        await onOpenMarkdown({ relPath, url, contentRoot });
        if (currentActive) currentActive.classList.remove('is-active');
        currentActive = li;
        currentActive.classList.add('is-active');
        setStatus('');
      } catch (error) {
        onWarn('Failed to load markdown:', error);
        setStatus(`Failed to load: ${relPath}`);
        showAlert(`Failed to load file\n${relPath}\n${error}`);
      }
    });
    return li;
  };

  const animateExpand = (panel) => {
    if (!panel) return;
    try {
      panel.style.overflow = 'hidden';
      panel.style.height = '0px';
      panel.style.opacity = '0';
      void panel.getBoundingClientRect();
      panel.style.transition = 'height 480ms cubic-bezier(0.45, 0, 0.25, 1), opacity 480ms cubic-bezier(0.45, 0, 0.25, 1)';
      const target = panel.scrollHeight;
      if (runtime && typeof runtime.requestFrame === 'function') {
        runtime.requestFrame(() => {
          panel.style.height = `${target}px`;
          panel.style.opacity = '1';
        });
      } else {
        panel.style.height = `${target}px`;
        panel.style.opacity = '1';
      }
      const cleanup = (event) => {
        if (event && event.propertyName && event.propertyName !== 'height') return;
        panel.style.transition = '';
        panel.style.height = '';
        panel.style.overflow = '';
        panel.style.opacity = '';
        panel.removeEventListener('transitionend', cleanup);
      };
      panel.addEventListener('transitionend', cleanup);
    } catch (_) {}
  };

  const animateCollapse = (panel, after) => {
    if (!panel) {
      if (after) after();
      return;
    }
    try {
      const start = panel.scrollHeight;
      panel.style.overflow = 'hidden';
      panel.style.height = `${start}px`;
      panel.style.opacity = '1';
      panel.style.transition = 'height 480ms cubic-bezier(0.45, 0, 0.25, 1), opacity 480ms cubic-bezier(0.45, 0, 0.25, 1)';
      const finish = () => {
        panel.style.height = '0px';
        panel.style.opacity = '0';
      };
      if (runtime && typeof runtime.requestFrame === 'function') runtime.requestFrame(finish);
      else finish();
      const done = (event) => {
        if (event && event.propertyName && event.propertyName !== 'height') return;
        panel.style.transition = '';
        panel.style.height = '';
        panel.style.overflow = '';
        panel.style.opacity = '';
        panel.removeEventListener('transitionend', done);
        if (after) after();
      };
      panel.addEventListener('transitionend', done);
    } catch (_) {
      if (after) after();
    }
  };

  const makeGroupHeader = (title, open = false, meta = null) => {
    const details = documentRef.createElement('details');
    details.className = 'file-group';
    if (open) details.setAttribute('open', '');

    const summary = documentRef.createElement('summary');
    summary.className = 'file-group-header';
    const titleEl = documentRef.createElement('span');
    titleEl.className = 'file-group-title';
    titleEl.textContent = title;
    summary.appendChild(titleEl);

    if (meta) {
      const wrap = documentRef.createElement('span');
      wrap.className = 'summary-badges';
      if (typeof meta.versionsCount === 'number' && meta.versionsCount > 0) {
        const badge = documentRef.createElement('span');
        badge.className = 'badge badge-ver';
        badge.textContent = `v${meta.versionsCount}`;
        wrap.appendChild(badge);
      }
      if (Array.isArray(meta.langs) && meta.langs.length) {
        const badge = documentRef.createElement('span');
        badge.className = 'badge badge-lang';
        badge.textContent = meta.langs.map(lang => String(lang).toUpperCase()).join(' ');
        wrap.appendChild(badge);
      }
      summary.appendChild(wrap);
    }

    const sublist = documentRef.createElement('ul');
    sublist.className = 'file-sublist';
    details.appendChild(summary);
    details.appendChild(sublist);

    const li = documentRef.createElement('li');
    li.appendChild(details);

    summary.addEventListener('click', (event) => {
      try {
        if (!details.open) return;
        event.preventDefault();
        animateCollapse(sublist, () => {
          try { details.removeAttribute('open'); } catch (_) {}
        });
      } catch (_) {}
    });

    details.addEventListener('toggle', (event) => {
      try {
        if (!details.open) return;
        animateExpand(sublist);
        if (event && event.isTrusted === false) return;
        const list = details.closest('.file-list');
        if (!list) return;
        const openGroups = list.querySelectorAll('details.file-group[open]');
        openGroups.forEach((group) => {
          if (group === details) return;
          const panel = group.querySelector('.file-sublist');
          animateCollapse(panel, () => {
            try { group.removeAttribute('open'); } catch (_) {}
          });
        });
      } catch (_) {}
    });

    return { container: li, sublist, details };
  };

  const makeSubHeader = (title) => {
    const li = documentRef.createElement('li');
    li.className = 'file-subgroup';
    const div = documentRef.createElement('div');
    div.className = 'file-subheader';
    div.textContent = title;
    const sublist = documentRef.createElement('ul');
    sublist.className = 'file-sublist';
    li.appendChild(div);
    li.appendChild(sublist);
    return { container: li, sublist };
  };

  const renderGroupedIndex = (root, data) => {
    if (!root || !documentRef) return;
    root.innerHTML = '';
    const fragment = documentRef.createDocumentFragment();
    try {
      const groups = Object.entries(data || {});
      for (const [postKey, value] of groups) {
        const langsSet = new Set();
        const versionSet = new Set();
        if (typeof value === 'string') {
          const version = extractVersion(value);
          if (version) versionSet.add(version);
        } else if (Array.isArray(value)) {
          value.forEach(path => {
            const version = extractVersion(path);
            if (version) versionSet.add(version);
          });
        } else if (value && typeof value === 'object') {
          for (const [lang, paths] of Object.entries(value)) {
            langsSet.add(lang);
            if (typeof paths === 'string') {
              const version = extractVersion(paths);
              if (version) versionSet.add(version);
            } else if (Array.isArray(paths)) {
              paths.forEach(path => {
                const version = extractVersion(path);
                if (version) versionSet.add(version);
              });
            }
          }
        }

        const { container, sublist } = makeGroupHeader(postKey, false, {
          langs: Array.from(langsSet),
          versionsCount: versionSet.size
        });
        if (typeof value === 'string') {
          sublist.appendChild(makeLi(`${postKey} - ${basename(value)}`, value));
        } else if (Array.isArray(value)) {
          value.forEach(path => {
            if (typeof path === 'string') sublist.appendChild(makeLi(basename(path), path));
          });
        } else if (value && typeof value === 'object') {
          const langs = Object.entries(value);
          const langOrder = { en: 1, chs: 2, 'cht-tw': 3, 'cht-hk': 4, ja: 5 };
          const langOrderIndex = (code) => langOrder[normalizeLangKey(code)] || 9;
          langs.sort(([a], [b]) => langOrderIndex(a) - langOrderIndex(b) || a.localeCompare(b));
          for (const [lang, paths] of langs) {
            const { container: sub, sublist: versions } = makeSubHeader(String(lang).toUpperCase());
            const items = [];
            if (typeof paths === 'string') {
              items.push({ version: extractVersion(paths) || '', path: paths, name: basename(paths) });
            } else if (Array.isArray(paths)) {
              for (const path of paths) {
                if (typeof path === 'string') {
                  items.push({ version: extractVersion(path) || '', path, name: basename(path) });
                }
              }
            }
            items.sort((a, b) => {
              const compared = compareVersionDesc(a.version, b.version);
              return compared !== 0 ? compared : a.name.localeCompare(b.name);
            });
            for (const item of items) {
              const label = item.version ? `${item.version} - ${item.name}` : item.name;
              versions.appendChild(makeLi(label, item.path));
            }
            sublist.appendChild(sub);
          }
        }
        fragment.appendChild(container);
      }
    } catch (_) {}
    root.appendChild(fragment);
  };

  const renderGroupedTabs = (root, data) => {
    if (!root || !documentRef) return;
    root.innerHTML = '';
    const fragment = documentRef.createDocumentFragment();
    try {
      const groups = Object.entries(data || {});
      for (const [tabKey, variants] of groups) {
        const langsSet = new Set();
        const versionSet = new Set();
        if (typeof variants === 'string') {
          const version = extractVersion(variants);
          if (version) versionSet.add(version);
        } else if (variants && typeof variants === 'object') {
          for (const [lang, detail] of Object.entries(variants)) {
            langsSet.add(lang);
            const location = typeof detail === 'string'
              ? detail
              : (detail && typeof detail === 'object' ? detail.location || '' : '');
            const version = extractVersion(location);
            if (version) versionSet.add(version);
          }
        }

        const { container, sublist } = makeGroupHeader(tabKey, false, {
          langs: Array.from(langsSet),
          versionsCount: versionSet.size
        });
        if (typeof variants === 'string') {
          sublist.appendChild(makeLi(`${tabKey} - ${basename(variants)}`, variants));
        } else if (variants && typeof variants === 'object') {
          const langs = Object.entries(variants);
          const langOrder = { en: 1, chs: 2, 'cht-tw': 3, 'cht-hk': 4, ja: 5 };
          const langOrderIndex = (code) => langOrder[normalizeLangKey(code)] || 9;
          langs.sort(([a], [b]) => langOrderIndex(a) - langOrderIndex(b) || a.localeCompare(b));
          for (const [lang, detail] of langs) {
            if (typeof detail === 'string') {
              sublist.appendChild(makeLi(`${String(lang).toUpperCase()} - ${basename(detail)}`, detail));
            } else if (detail && typeof detail === 'object') {
              const title = detail.title || tabKey;
              const location = detail.location || '';
              if (location) sublist.appendChild(makeLi(`${String(lang).toUpperCase()} - ${title}`, location));
            }
          }
        }
        fragment.appendChild(container);
      }
    } catch (_) {}
    root.appendChild(fragment);
  };

  const applyFilter = (term) => {
    const query = String(term || '').trim().toLowerCase();
    const root = activeGroup === 'tabs' ? groupTabs : groupIndex;
    if (!root) return;
    const items = root.querySelectorAll('.file-item');
    items.forEach((item) => {
      if (!query) {
        item.style.display = '';
        return;
      }
      const label = item.dataset.label || '';
      const file = item.dataset.file || '';
      item.style.display = (label.includes(query) || file.includes(query)) ? '' : 'none';
    });

    const subgroups = root.querySelectorAll('.file-subgroup');
    subgroups.forEach((subgroup) => {
      const anyVisible = !!subgroup.querySelector('.file-item:not([style*="display: none"])');
      subgroup.style.display = anyVisible || !query ? '' : 'none';
    });

    const groups = root.querySelectorAll('details.file-group');
    groups.forEach((group) => {
      const anyVisible = !!group.querySelector('.file-item:not([style*="display: none"])');
      if (group.parentElement) group.parentElement.style.display = anyVisible || !query ? '' : 'none';
      if (query && anyVisible) {
        try { group.setAttribute('open', ''); } catch (_) {}
      }
    });
  };

  const switchGroup = (name) => {
    activeGroup = name === 'tabs' ? 'tabs' : 'index';
    if (groupIndex) groupIndex.hidden = activeGroup !== 'index';
    if (groupTabs) groupTabs.hidden = activeGroup !== 'tabs';
    sideTabs.forEach((button) => {
      const target = button.getAttribute('data-target');
      const active = target === activeGroup;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    applyFilter(searchInput ? searchInput.value : '');
  };

  const bind = () => {
    if (bound || !documentRef) return;
    listIndex = getElement(documentRef, runtime, 'listIndex');
    listTabs = getElement(documentRef, runtime, 'listTabs');
    statusEl = getElement(documentRef, runtime, 'sidebarStatus');
    searchInput = getElement(documentRef, runtime, 'fileSearch');
    groupIndex = getElement(documentRef, runtime, 'groupIndex');
    groupTabs = getElement(documentRef, runtime, 'groupTabs');
    const currentFileEl = getElement(documentRef, runtime, 'currentFile');
    sideTabs = Array.from(documentRef.querySelectorAll('.sidebar-tab'));
    bindCurrentFileElement(currentFileEl);
    if (runtime && typeof runtime.ensureEditorBaseDir === 'function') {
      runtime.ensureEditorBaseDir(`${contentRoot}/`);
    }
    if (searchInput) {
      searchInput.addEventListener('input', () => applyFilter(searchInput.value));
    }
    sideTabs.forEach((button) => {
      button.addEventListener('click', () => switchGroup(button.dataset.target));
    });
    switchGroup('index');
    bound = true;
  };

  const load = async () => {
    let site = {};
    try {
      setStatus('Loading site config...');
      site = await loadSiteConfig();
      contentRoot = site && site.contentRoot ? String(site.contentRoot) : 'wwwroot';
    } catch (_) {
      site = {};
      contentRoot = 'wwwroot';
    }
    onSiteConfigLoaded({ siteConfig: site || {}, contentRoot });

    try {
      setStatus('Loading index...');
      const indexResult = await loadIndexData(contentRoot);
      const rawIndex = (indexResult && indexResult.raw) || {};
      const posts = (indexResult && indexResult.entries) || {};
      renderGroupedIndex(listIndex, rawIndex);
      onIndexLoaded({ posts, rawIndex, contentRoot });
    } catch (error) {
      onWarn('Failed to load index data', error);
    }

    try {
      setStatus('Loading tabs...');
      const tabs = await loadTabsConfig(contentRoot);
      renderGroupedTabs(listTabs, tabs);
    } catch (error) {
      onWarn('Failed to load tabs.yaml', error);
    }

    setStatus('');
  };

  const initialize = () => {
    bind();
    return load();
  };

  return {
    applyFilter,
    bind,
    getContentRoot: () => contentRoot,
    initialize,
    load,
    renderIndex: (data) => renderGroupedIndex(listIndex, data),
    renderTabs: (data) => renderGroupedTabs(listTabs, data),
    switchGroup
  };
}
