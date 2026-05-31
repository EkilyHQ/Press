import { EDITOR_SHELL_IDS, EDITOR_SHELL_SELECTORS } from './editor-shell-contract.js';

function fallbackEscapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeComposerKind(kind) {
  if (kind === 'tabs') return 'tabs';
  if (kind === 'site') return 'site';
  return 'index';
}

export function createComposerDiffUi(options = {}) {
  const documentRef = options.documentRef || null;
  const translate = typeof options.t === 'function' ? options.t : (key) => key;
  const tComposer = typeof options.tComposer === 'function'
    ? options.tComposer
    : (suffix, params) => translate(`editor.composer.${suffix}`, params);
  const tComposerDiff = typeof options.tComposerDiff === 'function'
    ? options.tComposerDiff
    : (suffix, params) => translate(`editor.composer.diff.${suffix}`, params);
  const tComposerLang = typeof options.tComposerLang === 'function'
    ? options.tComposerLang
    : (suffix, params) => translate(`editor.composer.languages.${suffix}`, params);
  const escapeHtml = typeof options.escapeHtml === 'function' ? options.escapeHtml : fallbackEscapeHtml;
  const siteFieldLabelMap = options.siteFieldLabelMap && typeof options.siteFieldLabelMap === 'object'
    ? options.siteFieldLabelMap
    : {};
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => null;
  const getRemoteBaseline = typeof options.getRemoteBaseline === 'function' ? options.getRemoteBaseline : () => ({});
  const getComposerDiff = typeof options.getComposerDiff === 'function' ? options.getComposerDiff : () => null;
  const recomputeDiff = typeof options.recomputeDiff === 'function' ? options.recomputeDiff : () => null;
  const getActiveComposerFile = typeof options.getActiveComposerFile === 'function' ? options.getActiveComposerFile : () => 'index';
  const animateInlineVisibility = typeof options.animateInlineVisibility === 'function'
    ? options.animateInlineVisibility
    : () => {};

  function makeDiffBadge(label, type, scope) {
    const cls = scope ? `${scope}-diff-badge` : 'diff-badge';
    return `<span class="${cls} ${cls}-${type}">${escapeHtml(label)}</span>`;
  }

  function buildIndexDiffBadges(info) {
    if (!info) return '';
    const badges = [];
    if (info.state === 'added') badges.push(makeDiffBadge('New', 'added', 'ci'));
    if (info.state === 'removed') badges.push(makeDiffBadge('Removed', 'removed', 'ci'));
    const handledLang = new Set();
    Object.keys(info.langs || {}).forEach(lang => {
      const detail = info.langs[lang];
      const label = lang.toUpperCase();
      handledLang.add(lang);
      if (!detail) return;
      if (detail.state === 'added') badges.push(makeDiffBadge(`+${label}`, 'added', 'ci'));
      else if (detail.state === 'removed') badges.push(makeDiffBadge(`-${label}`, 'removed', 'ci'));
      else if (detail.state === 'modified') badges.push(makeDiffBadge(`~${label}`, 'changed', 'ci'));
    });
    (info.addedLangs || []).forEach(lang => {
      if (handledLang.has(lang)) return;
      badges.push(makeDiffBadge(`+${lang.toUpperCase()}`, 'added', 'ci'));
    });
    (info.removedLangs || []).forEach(lang => {
      if (handledLang.has(lang)) return;
      badges.push(makeDiffBadge(`-${lang.toUpperCase()}`, 'removed', 'ci'));
    });
    if (!badges.length && info.state === 'modified') badges.push(makeDiffBadge('Changed', 'changed', 'ci'));
    return badges.join(' ');
  }

  function buildTabsDiffBadges(info) {
    if (!info) return '';
    const badges = [];
    if (info.state === 'added') badges.push(makeDiffBadge('New', 'added', 'ct'));
    if (info.state === 'removed') badges.push(makeDiffBadge('Removed', 'removed', 'ct'));
    Object.keys(info.langs || {}).forEach(lang => {
      const detail = info.langs[lang];
      if (!detail) return;
      const label = lang.toUpperCase();
      if (detail.state === 'added') badges.push(makeDiffBadge(`+${label}`, 'added', 'ct'));
      else if (detail.state === 'removed') badges.push(makeDiffBadge(`-${label}`, 'removed', 'ct'));
      else if (detail.state === 'modified') {
        const parts = [];
        if (detail.titleChanged) parts.push('title');
        if (detail.locationChanged) parts.push('location');
        const text = parts.length ? `${label} (${parts.join('&')})` : `${label}`;
        badges.push(makeDiffBadge(text, 'changed', 'ct'));
      }
    });
    if (!badges.length && info.state === 'modified') badges.push(makeDiffBadge('Changed', 'changed', 'ct'));
    return badges.join(' ');
  }

  function buildEntryDiffBadges(kind, info) {
    return kind === 'tabs' ? buildTabsDiffBadges(info) : buildIndexDiffBadges(info);
  }

  function applySiteDiffMarkers(diff) {
    if (!documentRef) return;
    const root = documentRef.getElementById(EDITOR_SHELL_IDS.composerSite);
    if (!root) return;
    const fields = diff && diff.fields ? diff.fields : {};
    const matchesFieldDiff = (el, key) => {
      const info = fields[key];
      if (!info) return false;
      const lang = el.getAttribute('data-lang');
      const subfield = el.getAttribute('data-subfield');
      const index = el.getAttribute('data-index');
      if (info.type === 'localized' && Array.isArray(info.languages)) {
        return lang ? info.languages.includes(lang) : true;
      }
      if (info.type === 'list' && info.entries) {
        if (index != null && subfield) return !!(info.entries[index] && info.entries[index][subfield]);
        return true;
      }
      if (info.type === 'object' && info.fields) {
        return subfield ? !!info.fields[subfield] : false;
      }
      return true;
    };
    const isChangedTarget = (el) => {
      const key = el.getAttribute('data-field');
      const keys = String(key || '').split('|').map(item => item.trim()).filter(Boolean);
      return keys.length ? keys.some(fieldKey => matchesFieldDiff(el, fieldKey)) : false;
    };
    const hasChangedDescendant = (el) => {
      return Array.from(el.querySelectorAll('[data-field]')).some(child => child !== el && isChangedTarget(child));
    };
    root.querySelectorAll('[data-field]').forEach((el) => {
      const key = el.getAttribute('data-field');
      const keys = String(key || '').split('|').map(item => item.trim()).filter(Boolean);
      if (hasChangedDescendant(el)) {
        el.removeAttribute('data-diff');
        return;
      }
      const changed = keys.length ? keys.some(fieldKey => matchesFieldDiff(el, fieldKey)) : false;
      if (key && changed) el.setAttribute('data-diff', 'changed');
      else el.removeAttribute('data-diff');
    });
    try {
      if (typeof root.__pressSiteNavRefresh === 'function') root.__pressSiteNavRefresh();
    } catch (_) {}
  }

  function applyIndexDiffMarkers(diff) {
    if (!documentRef) return;
    const list = documentRef.getElementById(EDITOR_SHELL_IDS.ciList);
    if (!list) return;
    const keyDiff = (diff && diff.keys) || {};
    list.querySelectorAll('.ci-item').forEach(row => {
      const key = row.getAttribute('data-key');
      const info = keyDiff[key];
      if (info) {
        row.classList.add('is-dirty');
        row.setAttribute('data-diff', info.state || 'modified');
      } else {
        row.classList.remove('is-dirty');
        row.removeAttribute('data-diff');
      }
      const diffHost = row.querySelector('.ci-diff');
      if (diffHost) diffHost.innerHTML = buildIndexDiffBadges(info);
      const body = row.querySelector('.ci-body-inner');
      if (!body) return;
      body.querySelectorAll('.ci-lang').forEach(block => {
        const lang = block.dataset.lang;
        const langInfo = info && info.langs ? info.langs[lang] : null;
        if (langInfo) {
          block.setAttribute('data-diff', langInfo.state || 'modified');
        } else {
          block.removeAttribute('data-diff');
        }
        const removedBox = block.querySelector('[data-role="removed"]');
        if (removedBox) {
          const removed = langInfo && langInfo.versions && Array.isArray(langInfo.versions.removed)
            ? langInfo.versions.removed.map(item => item.value).filter(Boolean)
            : [];
          if (removed.length) {
            removedBox.hidden = false;
            removedBox.textContent = tComposerLang('removedVersions', { versions: removed.join(', ') });
          } else {
            removedBox.hidden = true;
            removedBox.textContent = '';
          }
        }
        const entries = langInfo && langInfo.versions && Array.isArray(langInfo.versions.entries)
          ? langInfo.versions.entries
          : null;
        block.querySelectorAll('.ci-ver-item').forEach(item => {
          if (!entries) {
            item.removeAttribute('data-diff');
            return;
          }
          const idx = Number(item.dataset.index);
          const entryInfo = entries[idx];
          if (entryInfo && entryInfo.status && entryInfo.status !== 'unchanged') {
            item.setAttribute('data-diff', entryInfo.status);
          } else {
            item.removeAttribute('data-diff');
          }
        });
      });
    });
  }

  function applyTabsDiffMarkers(diff) {
    if (!documentRef) return;
    const list = documentRef.getElementById(EDITOR_SHELL_IDS.ctList);
    if (!list) return;
    const keyDiff = (diff && diff.keys) || {};
    list.querySelectorAll('.ct-item').forEach(row => {
      const key = row.getAttribute('data-key');
      const info = keyDiff[key];
      if (info) {
        row.classList.add('is-dirty');
        row.setAttribute('data-diff', info.state || 'modified');
      } else {
        row.classList.remove('is-dirty');
        row.removeAttribute('data-diff');
      }
      const diffHost = row.querySelector('.ct-diff');
      if (diffHost) diffHost.innerHTML = buildTabsDiffBadges(info);
      const body = row.querySelector('.ct-body-inner');
      if (!body) return;
      body.querySelectorAll('.ct-lang').forEach(block => {
        const lang = block.dataset.lang;
        const langInfo = info && info.langs ? info.langs[lang] : null;
        if (langInfo) block.setAttribute('data-diff', langInfo.state || 'modified');
        else block.removeAttribute('data-diff');
        const titleInput = block.querySelector('.ct-title');
        const locInput = block.querySelector('.ct-loc');
        if (titleInput) {
          if (langInfo && langInfo.titleChanged) titleInput.setAttribute('data-diff', 'changed');
          else titleInput.removeAttribute('data-diff');
        }
        if (locInput) {
          if (langInfo && langInfo.locationChanged) locInput.setAttribute('data-diff', 'changed');
          else locInput.removeAttribute('data-diff');
        }
      });
    });
  }

  function getComposerDiffChangeCount(diff) {
    if (!diff || !diff.hasChanges) return 0;
    if (diff.fields && typeof diff.fields === 'object') {
      return Object.keys(diff.fields).filter(Boolean).length;
    }
    let count = 0;
    if (diff.keys && typeof diff.keys === 'object') {
      count += Object.keys(diff.keys).filter(Boolean).length;
    }
    if (diff.orderChanged) count += 1;
    return Math.max(1, count);
  }

  function ensureFileDirtyBadgeElement(el) {
    if (!documentRef || !el) return null;
    let badge = el.querySelector('.vt-dirty-badge');
    if (!badge) {
      badge = documentRef.createElement('span');
      badge.className = 'vt-dirty-badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.hidden = true;
      el.appendChild(badge);
    }
    return badge;
  }

  function getFileToggleBaseLabel(el) {
    if (!el) return '';
    return Array.from(el.childNodes || [])
      .filter(node => !(node.nodeType === 1 && node.classList && node.classList.contains('vt-dirty-badge')))
      .map(node => node.textContent || '')
      .join('')
      .trim();
  }

  function updateFileDirtyBadge(kind) {
    if (!documentRef) return;
    const name = normalizeComposerKind(kind);
    const el = documentRef.querySelector(`${EDITOR_SHELL_SELECTORS.composerFileTabs}[data-cfile="${name}"]`);
    if (!el) return;
    const diff = getComposerDiff(name);
    const changeCount = getComposerDiffChangeCount(diff);
    const hasChanges = !!(diff && diff.hasChanges);
    const badge = ensureFileDirtyBadgeElement(el);
    const baseLabel = getFileToggleBaseLabel(el);
    el.classList.toggle('has-draft', hasChanges);
    if (hasChanges) {
      const displayValue = changeCount > 99 ? '99+' : String(changeCount);
      if (badge) {
        badge.textContent = displayValue;
        badge.hidden = false;
      }
      el.setAttribute('data-dirty', '1');
      if (el.dataset) el.dataset.dirtyCount = String(changeCount);
      if (baseLabel) {
        const accessibleCount = changeCount > 99 ? 'more than 99' : String(changeCount);
        const changeLabel = changeCount === 1 ? 'pending change' : 'pending changes';
        el.setAttribute('aria-label', `${baseLabel} (${accessibleCount} ${changeLabel})`);
      }
    } else {
      if (badge) {
        badge.hidden = true;
        badge.textContent = '';
      }
      el.removeAttribute('data-dirty');
      if (el.dataset) delete el.dataset.dirtyCount;
      if (baseLabel) el.setAttribute('aria-label', baseLabel);
      else el.removeAttribute('aria-label');
    }
  }

  function refreshFileDirtyBadges() {
    updateFileDirtyBadge('index');
    updateFileDirtyBadge('tabs');
    updateFileDirtyBadge('site');
  }

  function computeOrderDiffDetails(kind) {
    const baseline = getRemoteBaseline() || {};
    const baselineSlice = kind === 'tabs' ? baseline.tabs : baseline.index;
    const current = getStateSlice(kind) || { __order: [] };
    const baseOrder = Array.isArray(baselineSlice && baselineSlice.__order)
      ? baselineSlice.__order.filter(key => typeof key === 'string')
      : [];
    const curOrder = Array.isArray(current && current.__order)
      ? current.__order.filter(key => typeof key === 'string')
      : [];
    const beforeMap = new Map();
    const afterMap = new Map();
    baseOrder.forEach((key, idx) => { if (!beforeMap.has(key)) beforeMap.set(key, idx); });
    curOrder.forEach((key, idx) => { if (!afterMap.has(key)) afterMap.set(key, idx); });

    const beforeEntries = baseOrder.map((key, index) => {
      if (!afterMap.has(key)) return { key, index, status: 'removed' };
      const toIndex = afterMap.get(key);
      return {
        key,
        index,
        status: toIndex === index ? 'same' : 'moved',
        toIndex
      };
    });

    const afterEntries = curOrder.map((key, index) => {
      if (!beforeMap.has(key)) return { key, index, status: 'added' };
      const fromIndex = beforeMap.get(key);
      return {
        key,
        index,
        status: fromIndex === index ? 'same' : 'moved',
        fromIndex
      };
    });

    const connectors = beforeEntries
      .filter(entry => entry.status !== 'removed')
      .map(entry => ({
        key: entry.key,
        status: entry.status === 'moved' ? 'moved' : 'same',
        fromIndex: entry.index,
        toIndex: entry.toIndex
      }));

    const stats = {
      moved: connectors.filter(c => c.status === 'moved').length,
      added: afterEntries.filter(entry => entry.status === 'added').length,
      removed: beforeEntries.filter(entry => entry.status === 'removed').length
    };

    return { beforeEntries, afterEntries, connectors, stats };
  }

  function renderOrderStatsChips(target, stats, renderOptions = {}) {
    if (!documentRef || !target) return;
    const safeStats = stats || { moved: 0, added: 0, removed: 0 };
    const emptyLabel = renderOptions.emptyLabel || tComposerDiff('orderStats.empty');
    const pieces = [];
    if (safeStats.moved) pieces.push({ label: tComposerDiff('orderStats.moved', { count: safeStats.moved }), status: 'moved' });
    if (safeStats.added) pieces.push({ label: tComposerDiff('orderStats.added', { count: safeStats.added }), status: 'added' });
    if (safeStats.removed) pieces.push({ label: tComposerDiff('orderStats.removed', { count: safeStats.removed }), status: 'removed' });
    target.innerHTML = '';
    if (!pieces.length) {
      pieces.push({ label: emptyLabel, status: 'neutral' });
    }
    pieces.forEach(info => {
      const chip = documentRef.createElement('span');
      chip.className = 'composer-order-chip';
      chip.dataset.status = info.status;
      chip.textContent = info.label;
      target.appendChild(chip);
    });
  }

  function renderComposerInlineSummary(target, diff, renderOptions = {}) {
    if (!documentRef || !target) return;
    target.innerHTML = '';

    const summary = (diff && typeof diff === 'object') ? diff : null;
    if (!summary || !summary.hasChanges) {
      const empty = documentRef.createElement('span');
      empty.className = 'composer-inline-summary-empty';
      empty.textContent = translate('editor.composer.noLocalChangesYet');
      target.appendChild(empty);
      return;
    }

    const diffKeys = summary.keys || {};
    const modifiedKeys = Object.keys(diffKeys).filter(key => {
      const info = diffKeys[key];
      if (!info) return false;
      return info.state === 'modified'
        || (Array.isArray(info.addedLangs) && info.addedLangs.length)
        || (Array.isArray(info.removedLangs) && info.removedLangs.length);
    });

    const addedCount = Array.isArray(summary.addedKeys) ? summary.addedKeys.length : 0;
    const removedCount = Array.isArray(summary.removedKeys) ? summary.removedKeys.length : 0;
    const modifiedCount = modifiedKeys.length;
    const orderStats = renderOptions.orderStats || { moved: 0, added: 0, removed: 0 };
    const orderChanged = !!summary.orderChanged;
    const orderHasStats = !!(orderStats && (orderStats.moved || orderStats.added || orderStats.removed));

    const formatKeyList = (keys) => {
      if (!Array.isArray(keys) || !keys.length) return '';
      const clean = keys.filter(key => key != null && key !== '');
      if (!clean.length) return '';
      const max = Math.max(1, renderOptions.maxKeys || 3);
      const shown = clean.slice(0, max);
      let text = shown.join(', ');
      if (clean.length > shown.length) {
        const moreCount = clean.length - shown.length;
        text += ` ${tComposerDiff('lists.more', { count: moreCount })}`;
      }
      return text;
    };

    const chips = [];
    if (addedCount) chips.push({ variant: 'added', label: tComposerDiff('inlineChips.added', { count: addedCount }) });
    if (removedCount) chips.push({ variant: 'removed', label: tComposerDiff('inlineChips.removed', { count: removedCount }) });
    if (modifiedCount) chips.push({ variant: 'modified', label: tComposerDiff('inlineChips.modified', { count: modifiedCount }) });
    if (orderChanged) {
      let orderLabel = tComposerDiff('inlineChips.orderChanged');
      if (orderHasStats) {
        const parts = [];
        if (orderStats.moved) parts.push(tComposerDiff('inlineChips.orderParts.moved', { count: orderStats.moved }));
        if (orderStats.added) parts.push(tComposerDiff('inlineChips.orderParts.added', { count: orderStats.added }));
        if (orderStats.removed) parts.push(tComposerDiff('inlineChips.orderParts.removed', { count: orderStats.removed }));
        if (parts.length) {
          orderLabel = tComposerDiff('inlineChips.orderSummary', { parts: parts.join(', ') });
        }
      }
      chips.push({ variant: 'order', label: orderLabel });
    }

    const chipRow = documentRef.createElement('div');
    chipRow.className = 'composer-inline-chip-row';

    const addChip = (chipInfo) => {
      const chip = documentRef.createElement('span');
      chip.className = 'composer-inline-chip';
      if (chipInfo.variant) chip.dataset.variant = chipInfo.variant;
      chip.textContent = chipInfo.label;
      chipRow.appendChild(chip);
    };

    chips.forEach(addChip);
    const langSet = new Set();
    Object.values(diffKeys).forEach(info => {
      if (!info) return;
      Object.keys(info.langs || {}).forEach(lang => langSet.add(String(lang || '').toUpperCase()));
      (info.addedLangs || []).forEach(lang => langSet.add(String(lang || '').toUpperCase()));
      (info.removedLangs || []).forEach(lang => langSet.add(String(lang || '').toUpperCase()));
    });
    if (langSet.size) {
      const langs = Array.from(langSet).filter(Boolean).sort();
      const summary = formatKeyList(langs);
      if (summary) addChip({ variant: 'langs', label: tComposerDiff('inlineChips.langs', { summary }) });
    }

    if (chipRow.children.length) target.appendChild(chipRow);

    if (!chipRow.children.length) {
      const empty = documentRef.createElement('span');
      empty.className = 'composer-inline-summary-empty';
      empty.textContent = tComposerDiff('inlineChips.none');
      target.appendChild(empty);
    }
  }

  function getSiteFieldLabel(fieldKey) {
    if (!fieldKey) return '';
    const entry = siteFieldLabelMap[fieldKey];
    if (!entry) return fieldKey;
    const key = entry.i18nKey || entry.key || entry;
    if (typeof key === 'string' && key) {
      try {
        const label = translate(key);
        if (label && typeof label === 'string' && label.trim()) return label;
      } catch (_) {
        /* ignore */
      }
    }
    if (entry && typeof entry === 'object' && entry.fallback) return entry.fallback;
    if (typeof key === 'string' && key.trim()) return key;
    return fieldKey;
  }

  function renderComposerSiteInlineSummary(target, diff) {
    if (!documentRef || !target) return false;
    target.innerHTML = '';

    const summary = diff && typeof diff === 'object' ? diff : null;
    if (!summary || !summary.hasChanges) {
      const empty = documentRef.createElement('span');
      empty.className = 'composer-inline-summary-empty';
      empty.textContent = tComposer('noLocalChangesYet');
      target.appendChild(empty);
      return false;
    }

    const fields = summary.fields && typeof summary.fields === 'object'
      ? Object.keys(summary.fields).filter(Boolean)
      : [];

    const row = documentRef.createElement('div');
    row.className = 'composer-inline-chip-row';

    const countChip = documentRef.createElement('span');
    countChip.className = 'composer-inline-chip';
    countChip.dataset.variant = 'modified';
    countChip.textContent = tComposerDiff('inlineChips.modified', { count: fields.length || 0 });
    row.appendChild(countChip);

    const labels = fields.map(getSiteFieldLabel).filter(Boolean);
    const maxFields = 3;
    labels.slice(0, maxFields).forEach(label => {
      const chip = documentRef.createElement('span');
      chip.className = 'composer-inline-chip';
      chip.dataset.variant = 'langs';
      chip.textContent = label;
      row.appendChild(chip);
    });

    if (labels.length > maxFields) {
      const chip = documentRef.createElement('span');
      chip.className = 'composer-inline-chip';
      chip.dataset.variant = 'langs';
      chip.textContent = tComposerDiff('lists.more', { count: labels.length - maxFields });
      row.appendChild(chip);
    }

    target.appendChild(row);
    return true;
  }

  function updateComposerSiteInlineMeta(meta, updateOptions = {}) {
    if (!meta) return;

    meta.__pressSiteMetaActive = true;
    try { meta.setAttribute('data-site-active', 'true'); } catch (_) {}
    if (meta.dataset) meta.dataset.kind = 'site';

    const title = meta.querySelector('.composer-order-inline-title');
    if (title) title.textContent = tComposerDiff('inline.title');
    const kindLabel = meta.querySelector('.composer-order-inline-kind');
    if (kindLabel) kindLabel.textContent = 'site.yaml';

    const openBtn = meta.querySelector('.composer-order-inline-open');
    if (openBtn) {
      if (!meta.__pressSiteMetaButtonState) {
        meta.__pressSiteMetaButtonState = {
          hidden: openBtn.hidden,
          ariaHidden: openBtn.getAttribute('aria-hidden'),
          display: openBtn.style.display,
          disabled: !!openBtn.disabled
        };
      }
      try { openBtn.dataset.kind = 'site'; } catch (_) {}
      openBtn.hidden = true;
      openBtn.disabled = true;
      openBtn.style.display = 'none';
      openBtn.setAttribute('aria-hidden', 'true');
    }

    const statsWrap = meta.querySelector('.composer-order-inline-stats');
    const diff = getComposerDiff('site') || recomputeDiff('site');
    const hasChanges = !!(diff && diff.hasChanges);

    if (statsWrap) renderComposerSiteInlineSummary(statsWrap, diff);

    if (meta.dataset) meta.dataset.state = hasChanges ? 'changed' : 'clean';
    animateInlineVisibility(meta, hasChanges, { immediate: !!updateOptions.immediate });
  }

  function refreshComposerInlineMeta(refreshOptions = {}) {
    if (!documentRef) return;
    const meta = documentRef.getElementById(EDITOR_SHELL_IDS.composerOrderInlineMeta);
    if (!meta) return;
    const activeKind = getActiveComposerFile();
    if (activeKind === 'site') {
      updateComposerSiteInlineMeta(meta, refreshOptions);
      return;
    }

    if (meta.__pressSiteMetaActive) {
      const stored = meta.__pressSiteMetaButtonState || null;
      const openBtn = meta.querySelector('.composer-order-inline-open');
      if (openBtn) {
        openBtn.disabled = stored ? !!stored.disabled : false;
        openBtn.hidden = stored ? !!stored.hidden : false;
        if (stored && stored.display != null) openBtn.style.display = stored.display;
        else openBtn.style.display = '';
        if (stored && stored.ariaHidden != null) openBtn.setAttribute('aria-hidden', stored.ariaHidden);
        else openBtn.removeAttribute('aria-hidden');
      }
      delete meta.__pressSiteMetaButtonState;
      delete meta.__pressSiteMetaActive;
      try { meta.removeAttribute('data-site-active'); } catch (_) {}
    }
  }

  return {
    applySiteDiffMarkers,
    applyIndexDiffMarkers,
    applyTabsDiffMarkers,
    computeOrderDiffDetails,
    buildEntryDiffBadges,
    getComposerDiffChangeCount,
    refreshFileDirtyBadges,
    refreshComposerInlineMeta,
    renderComposerInlineSummary,
    renderOrderStatsChips
  };
}
