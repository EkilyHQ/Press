export function createPublishSummaryRenderer({
  documentRef = document,
  windowRef = window,
  t = (key) => key
} = {}) {
  function describeSummaryEntry(entry) {
    if (!entry) return '';
    const base = entry.label || entry.path || entry.kind || '';
    if (entry.kind === 'markdown') {
      const status = entry.state ? ` (${entry.state})` : '';
      const assetLabel = entry.assetCount
        ? ` – ${entry.assetCount} image${entry.assetCount === 1 ? '' : 's'}`
        : '';
      const assetDeletionLabel = entry.assetDeletionCount
        ? ` – ${entry.assetDeletionCount} image deletion${entry.assetDeletionCount === 1 ? '' : 's'}`
        : '';
      return `${base}${status}${assetLabel}${assetDeletionLabel}`;
    }
    if (entry.kind === 'index' || entry.kind === 'tabs') {
      const bits = [];
      if (entry.hasContentChange) bits.push('content');
      if (entry.hasOrderChange) bits.push('order');
      if (!bits.length) return base;
      return `${base} – ${bits.join(' & ')} changes`;
    }
    if (entry.kind === 'seo') {
      const type = entry.seoType === 'sitemap'
        ? 'Sitemap'
        : entry.seoType === 'robots'
          ? 'Robots.txt'
          : entry.seoType === 'index'
            ? 'Index HTML'
            : 'Meta tags';
      return `${base} – auto-generated SEO (${type})`;
    }
    if (entry.kind === 'asset' && (entry.deleted || entry.state === 'deleted')) {
      return `${base} (deleted)`;
    }
    if (entry.kind === 'system') {
      let label = '';
      try {
        const key = entry.state === 'added' ? 'added' : (entry.state === 'deleted' || entry.deleted ? 'deleted' : 'modified');
        const scope = entry.category === 'theme' ? 'theme file' : 'system file';
        label = t(`editor.systemUpdates.summary.${key}`);
        if (!label || label === `editor.systemUpdates.summary.${key}`) label = `${key} ${scope}`;
      } catch (_) { label = ''; }
      if (label) return `${base} – ${label}`;
      return `${base} – system file update`;
    }
    return base;
  }

  function openGithubCommitFilePreview(file, triggerEl) {
    if (!file) return;

    const previewModal = documentRef.createElement('div');
    previewModal.className = 'press-modal github-preview-modal';
    previewModal.setAttribute('aria-hidden', 'true');

    const previewDialog = documentRef.createElement('div');
    previewDialog.className = 'press-modal-dialog github-preview-dialog';
    previewDialog.setAttribute('role', 'dialog');
    previewDialog.setAttribute('aria-modal', 'true');

    const head = documentRef.createElement('div');
    head.className = 'comp-guide-head';
    const headLeft = documentRef.createElement('div');
    headLeft.className = 'comp-head-left';
    const previewTitleId = `nsGithubPreviewTitle-${Math.random().toString(36).slice(2, 8)}`;
    const title = documentRef.createElement('strong');
    title.id = previewTitleId;
    title.textContent = file.label || file.path || t('editor.composer.github.preview.untitled');
    headLeft.appendChild(title);
    const subtitle = documentRef.createElement('span');
    subtitle.className = 'muted';
    subtitle.textContent = t('editor.composer.github.preview.subtitle');
    headLeft.appendChild(subtitle);
    const closeBtn = documentRef.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'press-modal-close btn-secondary';
    const closeLabel = t('editor.composer.dialogs.close');
    closeBtn.textContent = closeLabel;
    closeBtn.setAttribute('aria-label', closeLabel);
    head.appendChild(headLeft);
    head.appendChild(closeBtn);
    previewDialog.appendChild(head);
    previewDialog.setAttribute('aria-labelledby', previewTitleId);

    if (file.deleted) {
      const notice = documentRef.createElement('p');
      notice.className = 'github-preview-empty';
      notice.textContent = `This publish will delete ${file.path || file.label || 'this file'}.`;
      previewDialog.appendChild(notice);
    } else if (file.kind === 'asset') {
      if (file.base64) {
        const mime = file.mime || 'application/octet-stream';
        const img = documentRef.createElement('img');
        img.className = 'github-preview-image';
        img.alt = file.label || file.path || '';
        img.src = `data:${mime};base64,${file.base64}`;
        previewDialog.appendChild(img);
        if (Number.isFinite(file.size)) {
          const meta = documentRef.createElement('p');
          meta.className = 'github-preview-meta';
          const sizeKb = file.size > 0 ? (file.size / 1024).toFixed(1) : '0';
          meta.textContent = `${mime} · ${sizeKb} KB`;
          previewDialog.appendChild(meta);
        }
      } else {
        const notice = documentRef.createElement('p');
        notice.className = 'github-preview-empty';
        notice.textContent = t('editor.composer.github.preview.unavailable');
        previewDialog.appendChild(notice);
      }
    } else if (typeof file.content === 'string') {
      const pre = documentRef.createElement('pre');
      pre.className = 'github-preview-code';
      pre.textContent = file.content;
      previewDialog.appendChild(pre);
    } else {
      const notice = documentRef.createElement('p');
      notice.className = 'github-preview-empty';
      notice.textContent = t('editor.composer.github.preview.unavailable');
      previewDialog.appendChild(notice);
    }

    previewModal.appendChild(previewDialog);
    documentRef.body.appendChild(previewModal);

    let closing = false;
    const reduceMotion = (() => {
      try { return !!(windowRef.matchMedia && windowRef.matchMedia('(prefers-reduced-motion: reduce)').matches); }
      catch (_) { return false; }
    })();
    const hadModalOpen = documentRef.body.classList.contains('press-modal-open');
    const restoreFocus = () => {
      if (!triggerEl || typeof triggerEl.focus !== 'function') return;
      try { triggerEl.focus({ preventScroll: true }); }
      catch (_) { triggerEl.focus(); }
    };
    const closePreview = () => {
      if (closing) return;
      closing = true;
      const finish = () => {
        try { previewModal.remove(); } catch (_) {}
        if (!hadModalOpen) documentRef.body.classList.remove('press-modal-open');
        restoreFocus();
      };
      if (reduceMotion) { finish(); return; }
      try {
        previewModal.classList.remove('press-anim-in');
        previewModal.classList.add('press-anim-out');
      } catch (_) {}
      const onEnd = () => {
        previewDialog.removeEventListener('animationend', onEnd);
        try { previewModal.classList.remove('press-anim-out'); } catch (_) {}
        finish();
      };
      try {
        previewDialog.addEventListener('animationend', onEnd, { once: true });
        windowRef.setTimeout(onEnd, 200);
      } catch (_) { onEnd(); }
    };

    documentRef.body.classList.add('press-modal-open');
    previewModal.classList.add('is-open');
    previewModal.setAttribute('aria-hidden', 'false');
    if (!reduceMotion) {
      try {
        previewModal.classList.add('press-anim-in');
        const onEnd = () => {
          previewDialog.removeEventListener('animationend', onEnd);
          try { previewModal.classList.remove('press-anim-in'); } catch (_) {}
        };
        previewDialog.addEventListener('animationend', onEnd, { once: true });
      } catch (_) {}
    }
    try { closeBtn.focus({ preventScroll: true }); }
    catch (_) { closeBtn.focus(); }
    closeBtn.addEventListener('click', () => closePreview());
    previewModal.addEventListener('mousedown', (event) => {
      if (event.target === previewModal) closePreview();
    });
    previewModal.addEventListener('keydown', (event) => {
      if ((event.key || '').toLowerCase() === 'escape') {
        event.preventDefault();
        closePreview();
      }
    });
  }

  function appendGithubCommitSummary(summaryBlock, commitFiles = [], seoFiles = [], summaryEntries = []) {
    summaryBlock.innerHTML = '';
    const files = Array.isArray(commitFiles) ? commitFiles : [];
    if (files.length) {
      const systemFilesGroup = files.filter((file) => file && file.kind === 'system');
      const textFiles = files.filter((file) => file && file.kind !== 'asset' && file.kind !== 'seo' && file.kind !== 'system');
      const seoFilesGroup = files.filter((file) => file && file.kind === 'seo');
      const assetFiles = files.filter((file) => file && file.kind === 'asset');

      const renderGroup = (titleText, groupFiles) => {
        if (!groupFiles || !groupFiles.length) return;
        const group = documentRef.createElement('div');
        group.className = 'gh-sync-file-group';
        const groupTitle = documentRef.createElement('div');
        groupTitle.className = 'gh-sync-file-group-title';
        groupTitle.textContent = titleText;
        group.appendChild(groupTitle);

        const list = documentRef.createElement('div');
        list.className = 'gh-sync-file-list';
        groupFiles.forEach((file) => {
          if (!file) return;
          const item = documentRef.createElement('button');
          item.type = 'button';
          item.className = 'gh-sync-file-entry';
          item.textContent = describeSummaryEntry(file) || file.label || file.path || '';
          item.addEventListener('click', () => openGithubCommitFilePreview(file, item));
          list.appendChild(item);
        });
        group.appendChild(list);
        summaryBlock.appendChild(group);
      };

      renderGroup(t('editor.composer.github.modal.summaryTextFilesTitle'), textFiles);
      renderGroup(t('editor.composer.github.modal.summarySystemFilesTitle'), systemFilesGroup);
      renderGroup(t('editor.composer.github.modal.summarySeoFilesTitle'), seoFilesGroup);
      renderGroup(t('editor.composer.github.modal.summaryAssetFilesTitle'), assetFiles);
    } else if (Array.isArray(summaryEntries) && summaryEntries.length) {
      const list = documentRef.createElement('ul');
      list.style.margin = '.4rem 0 0';
      list.style.paddingLeft = '1.25rem';
      summaryEntries.forEach((entry) => {
        const item = documentRef.createElement('li');
        item.textContent = describeSummaryEntry(entry);
        list.appendChild(item);
      });
      summaryBlock.appendChild(list);
    } else {
      const info = documentRef.createElement('p');
      info.className = 'muted';
      info.textContent = t('editor.composer.github.modal.summaryEmpty');
      summaryBlock.appendChild(info);
    }

    if (Array.isArray(seoFiles) && seoFiles.length) {
      const note = documentRef.createElement('p');
      note.className = 'muted';
      note.textContent = 'SEO files were generated automatically and will be included in this upload.';
      summaryBlock.appendChild(note);
    }
  }

  return {
    describeSummaryEntry,
    appendGithubCommitSummary
  };
}
