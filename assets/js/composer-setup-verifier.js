export function createComposerSetupVerifier(options = {}) {
  const documentRef = options.documentRef || (typeof document !== 'undefined' ? document : null);
  const windowRef = options.windowRef || (typeof window !== 'undefined' ? window : null);
  const consoleRef = options.consoleRef || console;
  const t = typeof options.t === 'function' ? options.t : (key) => key;
  const getState = typeof options.getState === 'function' ? options.getState : () => ({ index: {}, tabs: {} });
  const getActiveComposerFile = typeof options.getActiveComposerFile === 'function' ? options.getActiveComposerFile : () => 'index';
  const getActiveSiteRepoConfig = typeof options.getActiveSiteRepoConfig === 'function' ? options.getActiveSiteRepoConfig : () => ({});
  const sortLangKeys = typeof options.sortLangKeys === 'function' ? options.sortLangKeys : (obj) => Object.keys(obj || {}).sort();
  const normalizeComposerVersionPaths = typeof options.normalizeComposerVersionPaths === 'function'
    ? options.normalizeComposerVersionPaths
    : (value) => (Array.isArray(value) ? value.slice() : (value ? [value] : []));
  const extractVersionFromPath = typeof options.extractVersionFromPath === 'function' ? options.extractVersionFromPath : () => '';
  const makeDefaultMdTemplate = typeof options.makeDefaultMdTemplate === 'function' ? options.makeDefaultMdTemplate : () => '';
  const toTabsYaml = typeof options.toTabsYaml === 'function' ? options.toTabsYaml : () => '';
  const toIndexYaml = typeof options.toIndexYaml === 'function' ? options.toIndexYaml : () => '';
  const nsCopyToClipboard = typeof options.nsCopyToClipboard === 'function' ? options.nsCopyToClipboard : () => {};
  const preparePopupWindow = typeof options.preparePopupWindow === 'function' ? options.preparePopupWindow : () => null;
  const closePopupWindow = typeof options.closePopupWindow === 'function' ? options.closePopupWindow : () => {};
  const finalizePopupWindow = typeof options.finalizePopupWindow === 'function' ? options.finalizePopupWindow : () => null;
  const handlePopupBlocked = typeof options.handlePopupBlocked === 'function' ? options.handlePopupBlocked : () => {};
  const showToast = typeof options.showToast === 'function' ? options.showToast : () => {};
  const fetchComposerRemoteSnapshot = typeof options.fetchComposerRemoteSnapshot === 'function' ? options.fetchComposerRemoteSnapshot : async () => null;
  const applyComposerRemoteSnapshot = typeof options.applyComposerRemoteSnapshot === 'function' ? options.applyComposerRemoteSnapshot : () => {};
  const clearDraftStorage = typeof options.clearDraftStorage === 'function' ? options.clearDraftStorage : () => {};
  const updateUnsyncedSummary = typeof options.updateUnsyncedSummary === 'function' ? options.updateUnsyncedSummary : () => {};
  const startComposerSyncWatcher = typeof options.startComposerSyncWatcher === 'function' ? options.startComposerSyncWatcher : () => {};
  const getMarkdownPushLabel = typeof options.getMarkdownPushLabel === 'function'
    ? options.getMarkdownPushLabel
    : () => t('editor.composer.verify');
  const fetchRef = typeof options.fetchRef === 'function'
    ? options.fetchRef
    : (windowRef && typeof windowRef.fetch === 'function' ? windowRef.fetch.bind(windowRef) : async () => ({ ok: false, text: async () => '' }));

  function getContentRoot() {
    const fromOption = typeof options.getContentRoot === 'function' ? options.getContentRoot() : '';
    const value = fromOption || (windowRef && windowRef.__press_content_root) || 'wwwroot';
    return String(value || 'wwwroot').replace(/[\\]+/g, '/').replace(/\/?$/, '');
  }

  function dirname(path) {
    try {
      const value = String(path || '');
      const index = value.lastIndexOf('/');
      return index >= 0 ? value.slice(0, index) : '';
    } catch (_) {
      return '';
    }
  }

  function basename(path) {
    try {
      const value = String(path || '');
      const index = value.lastIndexOf('/');
      return index >= 0 ? value.slice(index + 1) : value;
    } catch (_) {
      return String(path || '');
    }
  }

  function buildGhNewLink(owner, repo, branch, folderPath, filename) {
    const enc = (value) => encodeURIComponent(String(value || ''));
    const clean = String(folderPath || '').replace(/^\/+/, '');
    const base = `https://github.com/${enc(owner)}/${enc(repo)}/new/${enc(branch)}/${clean}`;
    if (filename) return `${base}?filename=${enc(filename)}`;
    return base;
  }

  function buildGhEditFileLink(owner, repo, branch, filePath) {
    const enc = (value) => encodeURIComponent(String(value || ''));
    const clean = String(filePath || '').replace(/^\/+/, '');
    return `https://github.com/${enc(owner)}/${enc(repo)}/edit/${enc(branch)}/${clean}`;
  }

  function normalizeTarget(value) {
    return value === 'tabs' ? 'tabs' : value === 'index' ? 'index' : null;
  }

  function resolveTargetKind(button) {
    const datasetValue = button && button.dataset ? button.dataset.kind : null;
    const normalizedDataset = normalizeTarget(datasetValue);
    if (normalizedDataset) return normalizedDataset;
    const attrValue = button && typeof button.getAttribute === 'function'
      ? normalizeTarget(button.getAttribute('data-kind'))
      : null;
    const fallback = getActiveComposerFile();
    return attrValue || (fallback === 'tabs' ? 'tabs' : 'index');
  }

  async function computeMissingFiles(preferredKind) {
    const contentRoot = getContentRoot();
    const state = getState() || {};
    const out = [];
    const normalizedPreferred = normalizeTarget(preferredKind);
    const fallback = getActiveComposerFile();
    const target = normalizedPreferred || (fallback === 'tabs' ? 'tabs' : 'index');
    const tasks = [];

    if (target === 'tabs') {
      const tabs = state.tabs || {};
      const keys = Object.keys(tabs).filter(key => key !== '__order');
      for (const key of keys) {
        const langsObj = tabs[key] || {};
        const langs = sortLangKeys(langsObj);
        for (const lang of langs) {
          const obj = langsObj[lang];
          const rel = obj && typeof obj === 'object' ? obj.location : '';
          if (!rel) continue;
          const url = `${contentRoot}/${String(rel || '')}`;
          tasks.push((async () => {
            try {
              const response = await fetchRef(url, { cache: 'no-store' });
              if (!response || !response.ok) {
                out.push({ key, lang, path: rel, version: extractVersionFromPath(rel), folder: dirname(rel), filename: basename(rel) });
              }
            } catch (_) {
              out.push({ key, lang, path: rel, version: extractVersionFromPath(rel), folder: dirname(rel), filename: basename(rel) });
            }
          })());
        }
      }
    } else {
      const index = state.index || {};
      const keys = Object.keys(index).filter(key => key !== '__order');
      for (const key of keys) {
        const langsObj = index[key] || {};
        const langs = sortLangKeys(langsObj);
        for (const lang of langs) {
          const val = langsObj[lang];
          const paths = normalizeComposerVersionPaths(val);
          for (const rel of paths) {
            const url = `${contentRoot}/${String(rel || '')}`;
            tasks.push((async () => {
              try {
                const response = await fetchRef(url, { cache: 'no-store' });
                if (!response || !response.ok) {
                  out.push({ key, lang, path: rel, version: extractVersionFromPath(rel), folder: dirname(rel), filename: basename(rel) });
                }
              } catch (_) {
                out.push({ key, lang, path: rel, version: extractVersionFromPath(rel), folder: dirname(rel), filename: basename(rel) });
              }
            })());
          }
        }
      }
    }

    await Promise.all(tasks);
    return out;
  }

  function renderGithubIconLink(anchor) {
    anchor.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" fill="currentColor"/></svg><span class="btn-label">Create File</span>';
  }

  function appendMissingFileRow(langBox, item) {
    const row = documentRef.createElement('div');
    row.className = 'ci-ver-item';
    const badge = documentRef.createElement('span');
    badge.className = 'badge badge-ver';
    badge.textContent = item.version ? item.version : '-';
    row.appendChild(badge);
    const pathEl = documentRef.createElement('code');
    pathEl.textContent = item.path;
    pathEl.style.flex = '1 1 auto';
    row.appendChild(pathEl);

    const actions = documentRef.createElement('div');
    actions.className = 'ci-ver-actions';
    actions.style.display = 'inline-flex';
    actions.style.gap = '.35rem';
    const { owner, name, branch } = getActiveSiteRepoConfig();
    const root = getContentRoot();
    const link = documentRef.createElement('a');
    const canGh = !!(owner && name);
    link.className = canGh ? 'btn-secondary btn-github' : 'btn-secondary';
    link.target = '_blank';
    link.rel = 'noopener';
    if (canGh) renderGithubIconLink(link);
    else link.textContent = 'Create File';

    if (canGh) {
      const branchName = branch || 'main';
      let href = buildGhNewLink(owner, name, branchName, `${root}/${item.folder}`, item.filename);
      try {
        if (String(item.folder || '').replace(/^\/+/, '').startsWith('post/')) {
          const version = item && item.version ? String(item.version) : '';
          href += `&value=${encodeURIComponent(makeDefaultMdTemplate(version ? { version } : undefined))}`;
        }
      } catch (_) {}
      link.href = href;
    } else {
      link.href = '#';
    }
    link.title = 'Open GitHub new file page with prefilled filename';
    actions.appendChild(link);
    row.appendChild(actions);
    langBox.appendChild(row);
  }

  function renderMissingList(listWrap, items) {
    listWrap.innerHTML = '';
    if (!items || !items.length) {
      const p = documentRef.createElement('p');
      p.textContent = 'All files are present.';
      listWrap.appendChild(p);
      return;
    }

    const byKey = new Map();
    for (const item of items) {
      if (!byKey.has(item.key)) byKey.set(item.key, new Map());
      const group = byKey.get(item.key);
      if (!group.has(item.lang)) group.set(item.lang, []);
      group.get(item.lang).push(item);
    }

    for (const [key, group] of byKey.entries()) {
      const section = documentRef.createElement('section');
      section.style.border = '1px solid var(--border)';
      section.style.borderRadius = '8px';
      section.style.padding = '.5rem';
      section.style.margin = '.5rem 0';
      section.style.background = 'var(--card)';
      section.style.borderColor = '#fecaca';

      const heading = documentRef.createElement('div');
      heading.style.display = 'flex';
      heading.style.alignItems = 'center';
      heading.style.gap = '.5rem';
      const title = documentRef.createElement('strong');
      title.textContent = key;
      heading.appendChild(title);
      const meta = documentRef.createElement('span');
      meta.className = 'summary-badges';
      const langs = Array.from(group.keys());
      if (langs.length) {
        const badge = documentRef.createElement('span');
        badge.className = 'badge badge-lang';
        badge.textContent = langs.map(lang => String(lang).toUpperCase()).join(' ');
        meta.appendChild(badge);
      }
      heading.appendChild(meta);
      section.appendChild(heading);

      for (const [lang, entries] of group.entries()) {
        const langBox = documentRef.createElement('div');
        langBox.className = 'ci-lang';
        const langHead = documentRef.createElement('div');
        langHead.className = 'ci-lang-head';
        const langLabel = documentRef.createElement('span');
        langLabel.textContent = `Language: ${String(lang).toUpperCase()}`;
        langHead.appendChild(langLabel);
        langBox.appendChild(langHead);

        entries.sort((a, b) => {
          const av = a.version || '';
          const bv = b.version || '';
          if (av && bv && av !== bv) {
            const parseVersion = (version) => String(version || '').replace(/^v/i, '').split('.').map(part => parseInt(part, 10) || 0);
            const left = parseVersion(av);
            const right = parseVersion(bv);
            const length = Math.max(left.length, right.length);
            for (let index = 0; index < length; index += 1) {
              const x = left[index] || 0;
              const y = right[index] || 0;
              if (x !== y) return y - x;
            }
          }
          return String(a.path).localeCompare(String(b.path));
        });
        for (const item of entries) appendMissingFileRow(langBox, item);
        section.appendChild(langBox);
      }

      const groupCount = Array.from(group.values()).reduce((acc, entries) => acc + (Array.isArray(entries) ? entries.length : 0), 0);
      const warning = documentRef.createElement('div');
      warning.className = 'comp-warn';
      const warningText = documentRef.createElement('div');
      warningText.className = 'comp-warn-text';
      warningText.textContent = `${groupCount} missing item(s) remain for this key. Create the files above on GitHub, then Verify again.`;
      warning.appendChild(warningText);
      section.appendChild(warning);
      listWrap.appendChild(section);
    }
  }

  function prefersReducedMotion() {
    try { return !!(windowRef && windowRef.matchMedia && windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (_) { return false; }
  }

  function openVerifyModal(missing, targetKind) {
    if (!documentRef || !documentRef.body || typeof documentRef.createElement !== 'function') return;
    const modal = documentRef.createElement('div');
    modal.className = 'press-modal';
    modal.setAttribute('aria-hidden', 'true');
    const dialog = documentRef.createElement('div');
    dialog.className = 'press-modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const head = documentRef.createElement('div');
    head.className = 'comp-guide-head';
    const left = documentRef.createElement('div');
    left.className = 'comp-head-left';
    const title = documentRef.createElement('strong');
    title.textContent = 'Verify Setup - Missing Files';
    title.id = 'verifyTitle';
    const sub = documentRef.createElement('span');
    sub.className = 'muted';
    sub.textContent = 'Create missing files on GitHub, then Verify again';
    left.append(title, sub);
    const btnClose = documentRef.createElement('button');
    btnClose.className = 'press-modal-close btn-secondary';
    btnClose.type = 'button';
    btnClose.textContent = 'Cancel';
    btnClose.setAttribute('aria-label', 'Cancel');
    head.append(left, btnClose);
    dialog.appendChild(head);

    const body = documentRef.createElement('div');
    body.className = 'comp-guide';
    const listWrap = documentRef.createElement('div');
    listWrap.style.margin = '.4rem 0';
    renderMissingList(listWrap, missing);
    body.appendChild(listWrap);
    dialog.appendChild(body);

    const foot = documentRef.createElement('div');
    foot.style.display = 'flex';
    foot.style.justifyContent = 'flex-end';
    foot.style.gap = '.5rem';
    foot.style.marginTop = '.5rem';
    const btnVerify = documentRef.createElement('button');
    btnVerify.className = 'btn-primary';
    btnVerify.textContent = 'Verify';
    foot.appendChild(btnVerify);
    dialog.appendChild(foot);
    modal.appendChild(dialog);
    documentRef.body.appendChild(modal);

    function open() {
      try { modal.classList.remove('press-anim-out'); } catch (_) {}
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      documentRef.body.classList.add('press-modal-open');
      if (!prefersReducedMotion()) {
        try {
          modal.classList.add('press-anim-in');
          const onEnd = () => {
            try { modal.classList.remove('press-anim-in'); } catch (_) {}
            dialog.removeEventListener('animationend', onEnd);
          };
          dialog.addEventListener('animationend', onEnd, { once: true });
        } catch (_) {}
      }
    }

    function close() {
      const done = () => {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        documentRef.body.classList.remove('press-modal-open');
        try { modal.remove(); } catch (_) {}
      };
      if (prefersReducedMotion()) {
        done();
        return;
      }
      try { modal.classList.remove('press-anim-in'); } catch (_) {}
      try { modal.classList.add('press-anim-out'); } catch (_) {}
      const onEnd = () => {
        dialog.removeEventListener('animationend', onEnd);
        try { modal.classList.remove('press-anim-out'); } catch (_) {}
        done();
      };
      try {
        dialog.addEventListener('animationend', onEnd, { once: true });
        if (windowRef && typeof windowRef.setTimeout === 'function') windowRef.setTimeout(onEnd, 200);
      } catch (_) {
        onEnd();
      }
    }

    btnClose.addEventListener('click', close);
    modal.addEventListener('mousedown', (event) => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', (event) => { if ((event.key || '').toLowerCase() === 'escape') close(); });
    btnVerify.addEventListener('click', async () => {
      btnVerify.disabled = true;
      btnVerify.textContent = t('editor.composer.verifying');
      try {
        const normalizedTarget = normalizeTarget(targetKind) || (getActiveComposerFile() === 'tabs' ? 'tabs' : 'index');
        const state = getState() || {};
        try {
          const text = normalizedTarget === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
          nsCopyToClipboard(text);
        } catch (_) {}
        const now = await computeMissingFiles(normalizedTarget);
        if (!now.length) {
          close();
          await afterAllGood(normalizedTarget);
        } else {
          renderMissingList(listWrap, now);
        }
      } finally {
        try {
          btnVerify.disabled = false;
          btnVerify.textContent = t('editor.composer.verify');
        } catch (_) {}
      }
    });

    open();
  }

  async function afterAllGood(targetKind) {
    const contentRoot = getContentRoot();
    const state = getState() || {};
    const fallback = getActiveComposerFile();
    const target = normalizeTarget(targetKind) || (fallback === 'tabs' ? 'tabs' : 'index');
    const desired = target === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
    async function fetchText(url) {
      try {
        const response = await fetchRef(url, { cache: 'no-store' });
        if (response && response.ok) return await response.text();
      } catch (_) {}
      return '';
    }
    const baseName = target === 'tabs' ? 'tabs' : 'index';
    const url1 = `${contentRoot}/${baseName}.yaml`;
    const url2 = `${contentRoot}/${baseName}.yml`;
    const current = (await fetchText(url1)) || (await fetchText(url2));
    const normalize = (value) => String(value || '').replace(/\r\n/g, '\n').trim();
    const popup = preparePopupWindow();
    if (normalize(current) === normalize(desired)) {
      closePopupWindow(popup);
      showToast('success', t('editor.toasts.yamlUpToDate', { name: `${baseName}.yaml` }));
      try {
        const snapshot = await fetchComposerRemoteSnapshot(target);
        if (snapshot && snapshot.state === 'existing') {
          applyComposerRemoteSnapshot(target, snapshot);
          clearDraftStorage(target);
          updateUnsyncedSummary();
        }
      } catch (err) {
        if (consoleRef && typeof consoleRef.warn === 'function') consoleRef.warn('Composer: failed to refresh baseline after verify', err);
      }
      return;
    }

    try { nsCopyToClipboard(desired); } catch (_) {}
    const { owner, name, branch } = getActiveSiteRepoConfig();
    if (owner && name) {
      let href = '';
      if (current) href = buildGhEditFileLink(owner, name, branch, `${contentRoot}/${baseName}.yaml`);
      else href = buildGhNewLink(owner, name, branch, `${contentRoot}`, `${baseName}.yaml`);
      if (!href) {
        closePopupWindow(popup);
        showToast('error', t('editor.toasts.unableResolveYamlSync'));
        return;
      }
      const successMessage = current
        ? t('editor.composer.yaml.toastCopiedUpdate', { name: `${baseName}.yaml` })
        : t('editor.composer.yaml.toastCopiedCreate', { name: `${baseName}.yaml` });
      const blockedMessage = t('editor.composer.yaml.blocked', { name: `${baseName}.yaml` });

      const startWatcher = () => {
        startComposerSyncWatcher(target, {
          expectedText: desired,
          message: t('editor.composer.remoteWatcher.waitingForLabel', { label: `${baseName}.yaml` })
        });
      };

      const opened = finalizePopupWindow(popup, href);
      if (opened) {
        showToast('info', successMessage);
        startWatcher();
      } else {
        closePopupWindow(popup);
        handlePopupBlocked(href, {
          message: blockedMessage,
          actionLabel: t('editor.toasts.openGithubAction'),
          onRetry: () => {
            showToast('info', successMessage);
            startWatcher();
          }
        });
      }
    } else {
      closePopupWindow(popup);
      showToast('info', t('editor.toasts.yamlCopiedNoRepo'));
    }
  }

  function attach(btn) {
    if (!btn || btn.__composerVerifyBound) return false;
    btn.__composerVerifyBound = true;
    const btnLabel = btn.querySelector ? btn.querySelector('.btn-label') : null;
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        if (btnLabel) btnLabel.textContent = t('editor.composer.verifying');
        else btn.textContent = t('editor.composer.verifying');
      } catch (_) {}
      try {
        const targetKind = resolveTargetKind(btn);
        const target = targetKind === 'tabs' ? 'tabs' : 'index';
        const state = getState() || {};
        try {
          const text = target === 'tabs' ? toTabsYaml(state.tabs || {}) : toIndexYaml(state.index || {});
          nsCopyToClipboard(text);
        } catch (_) {}
        const missing = await computeMissingFiles(target);
        if (missing.length) openVerifyModal(missing, target);
        else await afterAllGood(target);
      } finally {
        try {
          btn.disabled = false;
          const restoreLabel = getMarkdownPushLabel('default');
          if (btnLabel) btnLabel.textContent = restoreLabel;
          else btn.textContent = restoreLabel;
        } catch (_) {}
      }
    });
    return true;
  }

  function bindVerifySetup() {
    const initialVerifyButton = documentRef ? documentRef.getElementById('btnVerify') : null;
    return attach(initialVerifyButton);
  }

  return {
    afterAllGood,
    attach,
    bindVerifySetup,
    buildGhEditFileLink,
    buildGhNewLink,
    computeMissingFiles,
    normalizeTarget,
    openVerifyModal,
    resolveTargetKind
  };
}
