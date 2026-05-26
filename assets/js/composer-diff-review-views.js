export function createComposerDiffReviewViews(options = {}) {
  const documentRef = options.documentRef || null;
  const tComposerDiff = typeof options.tComposerDiff === 'function'
    ? options.tComposerDiff
    : (suffix) => suffix;
  const truncateText = typeof options.truncateText === 'function'
    ? options.truncateText
    : (value) => String(value || '');
  const getStateSlice = typeof options.getStateSlice === 'function'
    ? options.getStateSlice
    : () => null;
  const getRemoteBaseline = typeof options.getRemoteBaseline === 'function'
    ? options.getRemoteBaseline
    : () => ({ index: null, tabs: null });
  const buildEntryDiffBadges = typeof options.buildEntryDiffBadges === 'function'
    ? options.buildEntryDiffBadges
    : () => '';

  function renderOverview(target, diff) {
    if (!target || !documentRef) return;
    target.innerHTML = '';
    if (!diff) {
      const empty = documentRef.createElement('p');
      empty.className = 'composer-diff-empty';
      empty.textContent = tComposerDiff('overview.empty');
      target.appendChild(empty);
      return;
    }
    const statWrap = documentRef.createElement('div');
    statWrap.className = 'composer-diff-overview-stats';
    const diffKeys = diff.keys || {};
    const modifiedKeys = Object.keys(diffKeys).filter(key => {
      const info = diffKeys[key];
      if (!info) return false;
      return info.state === 'modified' || (info.addedLangs && info.addedLangs.length) || (info.removedLangs && info.removedLangs.length);
    });
    const statDefs = [
      { id: 'added', label: tComposerDiff('overview.stats.added'), value: diff.addedKeys.length },
      { id: 'removed', label: tComposerDiff('overview.stats.removed'), value: diff.removedKeys.length },
      { id: 'modified', label: tComposerDiff('overview.stats.modified'), value: modifiedKeys.length },
      { id: 'order', label: tComposerDiff('overview.stats.order'), value: diff.orderChanged ? tComposerDiff('overview.stats.changed') : tComposerDiff('overview.stats.unchanged'), state: diff.orderChanged ? 'changed' : 'clean' }
    ];
    statDefs.forEach(def => {
      const card = documentRef.createElement('div');
      card.className = 'composer-diff-stat';
      card.dataset.id = def.id;
      if (typeof def.value === 'number') card.dataset.value = String(def.value);
      if (def.state) card.dataset.state = def.state;
      const valueEl = documentRef.createElement('div');
      valueEl.className = 'composer-diff-stat-value';
      valueEl.textContent = typeof def.value === 'number' ? String(def.value) : def.value;
      const labelEl = documentRef.createElement('div');
      labelEl.className = 'composer-diff-stat-label';
      labelEl.textContent = def.label;
      card.appendChild(valueEl);
      card.appendChild(labelEl);
      statWrap.appendChild(card);
    });
    target.appendChild(statWrap);

    const blocks = documentRef.createElement('div');
    blocks.className = 'composer-diff-overview-blocks';
    function appendKeyBlock(title, keys) {
      if (!keys || !keys.length) return;
      const block = documentRef.createElement('section');
      block.className = 'composer-diff-overview-block';
      const h3 = documentRef.createElement('h3');
      h3.textContent = title;
      const list = documentRef.createElement('ul');
      list.className = 'composer-diff-key-list';
      const max = 10;
      keys.slice(0, max).forEach(key => {
        const li = documentRef.createElement('li');
        const code = documentRef.createElement('code');
        code.textContent = key;
        li.appendChild(code);
        list.appendChild(li);
      });
      if (keys.length > max) {
        const more = documentRef.createElement('li');
        more.className = 'composer-diff-key-more';
        more.textContent = tComposerDiff('lists.more', { count: keys.length - max });
        list.appendChild(more);
      }
      block.appendChild(h3);
      block.appendChild(list);
      blocks.appendChild(block);
    }
    appendKeyBlock(tComposerDiff('overview.blocks.added'), diff.addedKeys);
    appendKeyBlock(tComposerDiff('overview.blocks.removed'), diff.removedKeys);
    appendKeyBlock(tComposerDiff('overview.blocks.modified'), modifiedKeys);
    if (blocks.children.length) target.appendChild(blocks);

    const langSet = new Set();
    Object.values(diffKeys).forEach(info => {
      if (!info) return;
      Object.keys(info.langs || {}).forEach(lang => langSet.add(lang.toUpperCase()));
      (info.addedLangs || []).forEach(lang => langSet.add(lang.toUpperCase()));
      (info.removedLangs || []).forEach(lang => langSet.add(lang.toUpperCase()));
    });
    if (langSet.size) {
      const p = documentRef.createElement('p');
      p.className = 'composer-diff-overview-langs';
      p.textContent = tComposerDiff('overview.languagesImpacted', { languages: Array.from(langSet).sort().join(', ') });
      target.appendChild(p);
    }
  }

  function describeEntrySnapshot(kind, key, source) {
    const state = source === 'baseline'
      ? (kind === 'tabs' ? (getRemoteBaseline().tabs) : (getRemoteBaseline().index))
      : getStateSlice(kind);
    if (!state) return null;
    return state[key] || null;
  }

  function buildEntryDetails(kind, key, info, sectionType) {
    const list = documentRef.createElement('ul');
    list.className = 'composer-diff-field-list';
    let hasContent = false;
    const push = (text) => {
      if (!text) return;
      const li = documentRef.createElement('li');
      li.textContent = text;
      list.appendChild(li);
      hasContent = true;
    };
    if (sectionType === 'added' || sectionType === 'removed') {
      const snapshot = describeEntrySnapshot(kind, key, sectionType === 'added' ? 'current' : 'baseline');
      const langs = snapshot ? Object.keys(snapshot || {}).filter(lang => lang !== '__order') : [];
      if (!langs.length) {
        push(tComposerDiff('entries.noLanguageContent'));
      } else {
        langs.forEach(lang => {
          const label = lang.toUpperCase();
          if (kind === 'index') {
            const value = snapshot[lang];
            let count = 0;
            if (Array.isArray(value)) count = value.length;
            else if (value != null && value !== '') count = 1;
            const summary = count
              ? tComposerDiff('entries.snapshot.indexValue', { count })
              : tComposerDiff('entries.snapshot.emptyEntry');
            push(tComposerDiff('entries.summary', { lang: label, summary }));
          } else {
            const value = snapshot[lang] || { title: '', location: '' };
            const parts = [];
            if (value.title) parts.push(tComposerDiff('entries.snapshot.tabTitle', { title: truncateText(value.title, 32) }));
            if (value.location) parts.push(tComposerDiff('entries.snapshot.tabLocation', { location: truncateText(value.location, 40) }));
            if (!parts.length) parts.push(tComposerDiff('entries.snapshot.emptyEntry'));
            const joined = parts.join(tComposerDiff('entries.join.comma'));
            push(tComposerDiff('entries.summary', { lang: label, summary: joined }));
          }
        });
      }
    } else {
      const langSet = new Set([
        ...Object.keys(info.langs || {}),
        ...((info.addedLangs || [])),
        ...((info.removedLangs || []))
      ]);
      if (!langSet.size) return null;
      const addedLangs = new Set(info.addedLangs || []);
      const removedLangs = new Set(info.removedLangs || []);
      langSet.forEach(lang => {
        const detail = (info.langs || {})[lang];
        const label = lang.toUpperCase();
        if (!detail) {
          if (addedLangs.has(lang)) push(tComposerDiff('entries.state.added', { lang: label }));
          else if (removedLangs.has(lang)) push(tComposerDiff('entries.state.removed', { lang: label }));
          return;
        }
        if (detail.state === 'added') {
          push(tComposerDiff('entries.state.added', { lang: label }));
          return;
        }
        if (detail.state === 'removed') {
          push(tComposerDiff('entries.state.removed', { lang: label }));
          return;
        }
        if (detail.state === 'modified') {
          if (kind === 'index') {
            const versions = detail.versions || { entries: [], removed: [] };
            let addedCount = 0;
            let movedCount = 0;
            let changedCount = 0;
            (versions.entries || []).forEach(entry => {
              if (entry.status === 'added') addedCount += 1;
              else if (entry.status === 'moved') movedCount += 1;
              else if (entry.status === 'changed') changedCount += 1;
            });
            const removedCount = (versions.removed || []).length;
            const parts = [];
            if (versions.kindChanged) parts.push(tComposerDiff('entries.parts.typeChanged'));
            if (addedCount) parts.push(tComposerDiff('entries.parts.addedCount', { count: addedCount }));
            if (removedCount) parts.push(tComposerDiff('entries.parts.removedCount', { count: removedCount }));
            if (changedCount) parts.push(tComposerDiff('entries.parts.updatedCount', { count: changedCount }));
            if (versions.orderChanged || movedCount) parts.push(tComposerDiff('entries.parts.reordered'));
            if (!parts.length) parts.push(tComposerDiff('entries.parts.contentUpdated'));
            const joined = parts.join(tComposerDiff('entries.join.comma'));
            push(tComposerDiff('entries.summary', { lang: label, summary: joined }));
          } else {
            const changeFields = [];
            if (detail.titleChanged) changeFields.push(tComposerDiff('entries.fields.title'));
            if (detail.locationChanged) changeFields.push(tComposerDiff('entries.fields.location'));
            const fieldSummary = changeFields.length
              ? changeFields.join(tComposerDiff('entries.join.and'))
              : tComposerDiff('entries.fields.content');
            push(tComposerDiff('entries.state.updatedFields', { lang: label, fields: fieldSummary }));
          }
        }
      });
    }
    return hasContent ? list : null;
  }

  function renderEntries(target, kind, diff) {
    if (!target || !documentRef) return;
    target.innerHTML = '';
    if (!diff) {
      const empty = documentRef.createElement('p');
      empty.className = 'composer-diff-empty';
      empty.textContent = tComposerDiff('entries.empty');
      target.appendChild(empty);
      return;
    }
    const diffKeys = diff.keys || {};
    const sections = [
      { type: 'added', title: tComposerDiff('entries.sections.added'), keys: diff.addedKeys || [] },
      { type: 'removed', title: tComposerDiff('entries.sections.removed'), keys: diff.removedKeys || [] },
      { type: 'modified', title: tComposerDiff('entries.sections.modified'), keys: Object.keys(diffKeys).filter(key => {
        const info = diffKeys[key];
        if (!info) return false;
        return info.state === 'modified' || (info.addedLangs && info.addedLangs.length) || (info.removedLangs && info.removedLangs.length);
      }) }
    ];
    const hasData = sections.some(section => section.keys && section.keys.length);
    if (!hasData) {
      const empty = documentRef.createElement('p');
      empty.className = 'composer-diff-empty';
      empty.textContent = tComposerDiff('entries.orderOnly');
      target.appendChild(empty);
      return;
    }
    sections.forEach(section => {
      if (!section.keys || !section.keys.length) return;
      const block = documentRef.createElement('section');
      block.className = 'composer-diff-section';
      block.dataset.section = section.type;
      const heading = documentRef.createElement('h3');
      heading.textContent = section.title;
      block.appendChild(heading);
      const list = documentRef.createElement('ul');
      list.className = 'composer-diff-entry-list';
      section.keys.forEach(key => {
        const info = diffKeys[key] || { state: section.type };
        const item = documentRef.createElement('li');
        item.className = 'composer-diff-entry';
        const name = documentRef.createElement('span');
        name.className = 'composer-diff-entry-key';
        name.textContent = key;
        item.appendChild(name);
        const badgeWrap = documentRef.createElement('span');
        badgeWrap.className = 'composer-diff-entry-badges';
        const badgesHtml = buildEntryDiffBadges(kind, info);
        if (badgesHtml) {
          badgeWrap.innerHTML = badgesHtml;
          item.appendChild(badgeWrap);
        }
        const details = buildEntryDetails(kind, key, info, section.type);
        if (details) item.appendChild(details);
        list.appendChild(item);
      });
      block.appendChild(list);
      target.appendChild(block);
    });
  }

  return {
    renderOverview,
    renderEntries
  };
}
