import { createComposerOrderVisual } from './composer-order-visual.js';

function noop() {}

function normalizeOrderKind(kind) {
  return kind === 'tabs' ? 'tabs' : 'index';
}

export function createComposerOrderDiffUi(options = {}) {
  const documentRef = options.documentRef || null;
  const tComposer = typeof options.tComposer === 'function' ? options.tComposer : (suffix) => suffix;
  const tComposerDiff = typeof options.tComposerDiff === 'function' ? options.tComposerDiff : (suffix) => suffix;
  const truncateText = typeof options.truncateText === 'function' ? options.truncateText : (value) => String(value || '');
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => null;
  const getRemoteBaseline = typeof options.getRemoteBaseline === 'function' ? options.getRemoteBaseline : () => ({ index: null, tabs: null });
  const getComposerDiff = typeof options.getComposerDiff === 'function' ? options.getComposerDiff : () => null;
  const recomputeDiff = typeof options.recomputeDiff === 'function' ? options.recomputeDiff : () => null;
  const computeOrderDiffDetails = typeof options.computeOrderDiffDetails === 'function' ? options.computeOrderDiffDetails : () => ({ beforeEntries: [], afterEntries: [], connectors: [], stats: { moved: 0, added: 0, removed: 0 } });
  const buildEntryDiffBadges = typeof options.buildEntryDiffBadges === 'function' ? options.buildEntryDiffBadges : () => '';
  const renderOrderStatsChips = typeof options.renderOrderStatsChips === 'function' ? options.renderOrderStatsChips : () => {};
  const renderComposerInlineSummary = typeof options.renderComposerInlineSummary === 'function' ? options.renderComposerInlineSummary : () => {};
  const captureElementRect = typeof options.captureElementRect === 'function' ? options.captureElementRect : () => null;
  const animateComposerListTransition = typeof options.animateListTransition === 'function' ? options.animateListTransition : () => {};
  const cancelComposerOrderMainTransition = typeof options.cancelOrderMainTransition === 'function' ? options.cancelOrderMainTransition : () => {};
  const animateComposerOrderMainReset = typeof options.animateOrderMainReset === 'function' ? options.animateOrderMainReset : () => {};
  const animateComposerInlineVisibility = typeof options.animateInlineVisibility === 'function' ? options.animateInlineVisibility : () => {};
  const cssEscape = typeof options.cssEscape === 'function'
    ? options.cssEscape
    : (value) => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const getComposerViewTransition = typeof options.getComposerViewTransition === 'function' ? options.getComposerViewTransition : () => null;
  const getSlideDurations = typeof options.getSlideDurations === 'function' ? options.getSlideDurations : () => ({ open: 420, close: 360 });
  const setTimeoutRef = typeof options.setTimeoutRef === 'function'
    ? options.setTimeoutRef
    : () => null;
  const clearTimeoutRef = typeof options.clearTimeoutRef === 'function'
    ? options.clearTimeoutRef
    : noop;
  const requestAnimationFrameRef = typeof options.requestAnimationFrameRef === 'function'
    ? options.requestAnimationFrameRef
    : () => null;
  const cancelAnimationFrameRef = typeof options.cancelAnimationFrameRef === 'function'
    ? options.cancelAnimationFrameRef
    : noop;
  const addWindowListener = typeof options.addWindowListener === 'function'
    ? options.addWindowListener
    : () => noop;
  const addDocumentListener = typeof options.addDocumentListener === 'function'
    ? options.addDocumentListener
    : () => noop;
  const matchesMedia = typeof options.matchesMedia === 'function'
    ? options.matchesMedia
    : () => false;
  const getComputedStyleRef = typeof options.getComputedStyleRef === 'function'
    ? options.getComputedStyleRef
    : () => null;
  const ResizeObserverRef = typeof options.ResizeObserverRef === 'function'
    ? options.ResizeObserverRef
    : null;
  const consoleRef = options.consoleRef || null;

  function warn(...args) {
    try {
      if (consoleRef && typeof consoleRef.warn === 'function') consoleRef.warn(...args);
    } catch (_) {}
  }

  let composerDiffModal = null;
  let composerOrderState = null;
  let composerDiffResizeHandler = null;
  let composerDiffResizeDispose = null;
  let composerOrderPreviewElements = { index: null, tabs: null };
  let composerOrderPreviewState = { index: null, tabs: null };
  let composerOrderPreviewActiveKind = 'index';
  let composerOrderPreviewResizeHandler = null;
  let composerOrderPreviewResizeDispose = null;
  const composerOrderPreviewRelayoutTimers = { index: null, tabs: null };

  function openComposerDiffModal(kind, initialTab = 'overview') {
    try {
      const modal = ensureComposerDiffModal();
      modal.open(kind, initialTab);
    } catch (err) {
      warn('Composer: failed to open composer diff modal', err);
    }
  }

  function openOrderDiffModal(kind) {
    openComposerDiffModal(kind, 'order');
  }

  const {
    applyComposerOrderHover,
    bindComposerOrderHover,
    buildOrderDiffItem,
    drawOrderDiffLines: drawOrderDiffLinesForState
  } = createComposerOrderVisual({
    documentRef,
    tComposerDiff,
    getComputedStyleRef
  });


  function ensureComposerDiffModal() {
    if (composerDiffModal) return composerDiffModal;

    const modal = documentRef.createElement('div');
    modal.id = 'composerOrderModal';
    modal.className = 'press-modal composer-order-modal composer-diff-modal';

    const dialog = documentRef.createElement('div');
    dialog.className = 'press-modal-dialog composer-order-dialog composer-diff-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    const head = documentRef.createElement('div');
    head.className = 'composer-order-head';
    const title = documentRef.createElement('h2');
    title.id = 'composerOrderTitle';
    title.textContent = tComposerDiff('heading');
    const subtitle = documentRef.createElement('p');
    subtitle.className = 'composer-order-subtitle';
    subtitle.textContent = tComposerDiff('subtitle.default');
    const closeBtn = documentRef.createElement('button');
    closeBtn.className = 'press-modal-close btn-secondary composer-order-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', tComposerDiff('close'));
    closeBtn.textContent = tComposerDiff('close');
    head.appendChild(title);
    head.appendChild(subtitle);
    head.appendChild(closeBtn);

    const tabsWrap = documentRef.createElement('div');
    tabsWrap.className = 'composer-diff-tabs';
    tabsWrap.setAttribute('role', 'tablist');

    const tabDefs = [
      { id: 'overview', labelKey: 'tabs.overview' },
      { id: 'entries', labelKey: 'tabs.entries' },
      { id: 'order', labelKey: 'tabs.order' }
    ];
    const tabDefsById = new Map();
    tabDefs.forEach(def => { tabDefsById.set(def.id, def); });
    const tabButtons = new Map();
    const tabPanels = new Map();

    function handleTabKeydown(ev, currentId) {
      if (!tabDefs.length) return;
      let nextIndex = -1;
      const currentIndex = tabDefs.findIndex(def => def.id === currentId);
      if (ev.key === 'ArrowLeft') {
        nextIndex = (currentIndex <= 0 ? tabDefs.length - 1 : currentIndex - 1);
      } else if (ev.key === 'ArrowRight') {
        nextIndex = (currentIndex + 1) % tabDefs.length;
      } else if (ev.key === 'Home') {
        nextIndex = 0;
      } else if (ev.key === 'End') {
        nextIndex = tabDefs.length - 1;
      } else {
        return;
      }
      ev.preventDefault();
      const nextId = tabDefs[nextIndex] && tabDefs[nextIndex].id;
      if (!nextId) return;
      setActiveTab(nextId);
      const btn = tabButtons.get(nextId);
      if (btn) btn.focus();
    }

    tabDefs.forEach((tab, index) => {
      const btn = documentRef.createElement('button');
      btn.type = 'button';
      btn.className = 'composer-diff-tab';
      btn.textContent = tComposerDiff(tab.labelKey);
      btn.dataset.i18nKey = tab.labelKey;
      btn.dataset.tab = tab.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      btn.setAttribute('tabindex', index === 0 ? '0' : '-1');
      btn.addEventListener('click', () => setActiveTab(tab.id));
      btn.addEventListener('keydown', (ev) => handleTabKeydown(ev, tab.id));
      tabButtons.set(tab.id, btn);
      tabsWrap.appendChild(btn);
    });

    const viewsWrap = documentRef.createElement('div');
    viewsWrap.className = 'composer-diff-views';

    function createView(id, extraClass) {
      const view = documentRef.createElement('section');
      view.className = `composer-diff-view ${extraClass}`;
      view.dataset.view = id;
      view.setAttribute('role', 'tabpanel');
      view.setAttribute('tabindex', '0');
      if (id !== 'overview') {
        view.hidden = true;
        view.style.display = 'none';
        view.setAttribute('aria-hidden', 'true');
      } else {
        view.style.display = '';
        view.setAttribute('aria-hidden', 'false');
      }
      tabPanels.set(id, view);
      viewsWrap.appendChild(view);
      return view;
    }

    const viewOverview = createView('overview', 'composer-diff-view-overview');
    const viewEntries = createView('entries', 'composer-diff-view-entries');
    const viewOrder = createView('order', 'composer-diff-view-order');

    const statsWrap = documentRef.createElement('div');
    statsWrap.className = 'composer-order-stats';

    const body = documentRef.createElement('div');
    body.className = 'composer-order-body';

    const viz = documentRef.createElement('div');
    viz.className = 'composer-order-visual';

    const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('composer-order-lines');
    svg.setAttribute('aria-hidden', 'true');

    const columns = documentRef.createElement('div');
    columns.className = 'composer-order-columns';

    const beforeCol = documentRef.createElement('div');
    beforeCol.className = 'composer-order-column composer-order-before';
    const beforeTitle = documentRef.createElement('div');
    beforeTitle.className = 'composer-order-column-title';
    beforeTitle.textContent = tComposerDiff('order.remoteTitle');
    const beforeList = documentRef.createElement('div');
    beforeList.className = 'composer-order-list';
    beforeCol.appendChild(beforeTitle);
    beforeCol.appendChild(beforeList);

    const afterCol = documentRef.createElement('div');
    afterCol.className = 'composer-order-column composer-order-after';
    const afterTitle = documentRef.createElement('div');
    afterTitle.className = 'composer-order-column-title';
    afterTitle.textContent = tComposerDiff('order.currentTitle');
    const afterList = documentRef.createElement('div');
    afterList.className = 'composer-order-list';
    afterCol.appendChild(afterTitle);
    afterCol.appendChild(afterList);

    const emptyNotice = documentRef.createElement('div');
    emptyNotice.className = 'composer-order-empty';
    emptyNotice.textContent = tComposerDiff('order.empty');

    columns.appendChild(beforeCol);
    columns.appendChild(afterCol);
    viz.appendChild(svg);
    viz.appendChild(columns);
    viz.appendChild(emptyNotice);
    body.appendChild(viz);
    viewOrder.appendChild(statsWrap);
    viewOrder.appendChild(body);

    dialog.setAttribute('aria-labelledby', title.id);
    dialog.appendChild(head);
    dialog.appendChild(tabsWrap);
    dialog.appendChild(viewsWrap);

    modal.appendChild(dialog);
    documentRef.body.appendChild(modal);

    const focusableSelector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lastActive = null;
    let activeTab = 'overview';
    let activeKind = 'index';
    let activeDiff = null;

    const subtitleKeys = {
      overview: 'subtitle.overview',
      entries: 'subtitle.entries',
      order: 'subtitle.order'
    };

    function prefersReducedMotion() {
      return matchesMedia('(prefers-reduced-motion: reduce)');
    }

    function closeModal() {
      if (composerDiffResizeHandler) {
        try { composerDiffResizeDispose && composerDiffResizeDispose(); } catch (_) {}
        composerDiffResizeHandler = null;
        composerDiffResizeDispose = null;
      }
      composerOrderState = null;
      activeDiff = null;
      const reduce = prefersReducedMotion();
      if (reduce) {
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        documentRef.body.classList.remove('press-modal-open');
        try { lastActive && lastActive.focus(); } catch (_) {}
        return;
      }
      try { modal.classList.remove('press-anim-in'); } catch (_) {}
      try { modal.classList.add('press-anim-out'); } catch (_) {}
      const finish = () => {
        try { modal.classList.remove('press-anim-out'); } catch (_) {}
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        documentRef.body.classList.remove('press-modal-open');
        try { lastActive && lastActive.focus(); } catch (_) {}
      };
      try {
        const onEnd = () => { dialog.removeEventListener('animationend', onEnd); finish(); };
        dialog.addEventListener('animationend', onEnd, { once: true });
        setTimeoutRef(finish, 220);
      } catch (_) {
        finish();
      }
    }

    function updateSubtitle(tabId) {
      const key = subtitleKeys[tabId] || subtitleKeys.overview;
      subtitle.textContent = tComposerDiff(key);
    }

    function setActiveTab(tabId) {
      if (!tabButtons.has(tabId)) tabId = 'overview';
      activeTab = tabId;
      tabButtons.forEach((btn, id) => {
        const selected = id === tabId;
        btn.classList.toggle('is-active', selected);
        btn.setAttribute('aria-selected', selected ? 'true' : 'false');
        btn.setAttribute('tabindex', selected ? '0' : '-1');
      });
      tabPanels.forEach((panel, id) => {
        const visible = id === tabId;
        panel.hidden = !visible;
        panel.style.display = visible ? '' : 'none';
        panel.classList.toggle('is-active', visible);
        panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
      updateSubtitle(tabId);
      if (tabId === 'order') {
        renderOrder(activeKind);
        if (!composerDiffResizeHandler) {
          composerDiffResizeHandler = () => drawOrderDiffLines();
          composerDiffResizeDispose = addWindowListener('resize', composerDiffResizeHandler);
        }
        requestAnimationFrameRef(() => drawOrderDiffLines());
        setTimeoutRef(drawOrderDiffLines, 140);
      } else if (composerDiffResizeHandler) {
        try { composerDiffResizeDispose && composerDiffResizeDispose(); } catch (_) {}
        composerDiffResizeHandler = null;
        composerDiffResizeDispose = null;
        composerOrderState = null;
      }
    }

    function renderOverview(kind, diff) {
      viewOverview.innerHTML = '';
      if (!diff) {
        const empty = documentRef.createElement('p');
        empty.className = 'composer-diff-empty';
        empty.textContent = tComposerDiff('overview.empty');
        viewOverview.appendChild(empty);
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
      viewOverview.appendChild(statWrap);

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
      if (blocks.children.length) viewOverview.appendChild(blocks);

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
        viewOverview.appendChild(p);
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

    function renderEntries(kind, diff) {
      viewEntries.innerHTML = '';
      if (!diff) {
        const empty = documentRef.createElement('p');
        empty.className = 'composer-diff-empty';
        empty.textContent = tComposerDiff('entries.empty');
        viewEntries.appendChild(empty);
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
        viewEntries.appendChild(empty);
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
        viewEntries.appendChild(block);
      });
    }

    function renderOrder(kind) {
      const label = kind === 'tabs' ? 'tabs.yaml' : 'index.yaml';
      title.textContent = tComposerDiff('title', { label });
      const details = computeOrderDiffDetails(kind);
      const { beforeEntries, afterEntries, connectors, stats } = details;

      beforeList.innerHTML = '';
      afterList.innerHTML = '';
      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const leftMap = new Map();
      beforeEntries.forEach(entry => {
        const item = buildOrderDiffItem(entry, 'before');
        leftMap.set(entry.key, item);
        beforeList.appendChild(item);
      });

      const rightMap = new Map();
      afterEntries.forEach(entry => {
        const item = buildOrderDiffItem(entry, 'after');
        rightMap.set(entry.key, item);
        afterList.appendChild(item);
      });

      const hoverState = viz.__pressOrderHoverState || {};
      if (hoverState.activeLeft && !hoverState.activeLeft.isConnected) {
        try { hoverState.activeLeft.classList.remove('is-hovered'); } catch (_) {}
        hoverState.activeLeft = null;
      }
      hoverState.leftMap = leftMap;
      hoverState.rightMap = rightMap;
      hoverState.svg = svg;
      hoverState.pathMap = null;
      viz.__pressOrderHoverState = hoverState;

      const hasItems = beforeEntries.length || afterEntries.length;
      if (hasItems) {
        emptyNotice.hidden = true;
        emptyNotice.style.display = 'none';
        emptyNotice.setAttribute('aria-hidden', 'true');
      } else {
        emptyNotice.hidden = false;
        emptyNotice.style.display = 'flex';
        emptyNotice.setAttribute('aria-hidden', 'false');
      }
      viz.classList.toggle('is-empty', !hasItems);

      renderOrderStatsChips(statsWrap, stats, { emptyLabel: tComposerDiff('orderStats.empty') });

      composerOrderState = hasItems
        ? { container: viz, svg, connectors, leftMap, rightMap }
        : null;
      if (!hasItems) {
        applyComposerOrderHover(viz, '');
      }
      if (activeTab === 'order') {
        drawOrderDiffLines();
        requestAnimationFrameRef(drawOrderDiffLines);
        setTimeoutRef(drawOrderDiffLines, 120);
      }
    }

    function openModal(kind, initialTab = 'overview') {
      lastActive = documentRef.activeElement;
      const reduce = prefersReducedMotion();
      try { modal.classList.remove('press-anim-out'); } catch (_) {}
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      documentRef.body.classList.add('press-modal-open');
      if (!reduce) {
        try {
          modal.classList.add('press-anim-in');
          const onEnd = () => { dialog.removeEventListener('animationend', onEnd); try { modal.classList.remove('press-anim-in'); } catch (_) {}; };
          dialog.addEventListener('animationend', onEnd, { once: true });
        } catch (_) {}
      }
      const safeKind = kind === 'tabs' ? 'tabs' : 'index';
      activeKind = safeKind;
      const label = safeKind === 'tabs' ? 'tabs.yaml' : 'index.yaml';
      title.textContent = tComposerDiff('title', { label });
      activeDiff = getComposerDiff(safeKind) || recomputeDiff(safeKind);
      renderOverview(safeKind, activeDiff);
      renderEntries(safeKind, activeDiff);
      renderOrder(safeKind);
      const targetTab = tabButtons.has(initialTab) ? initialTab : 'overview';
      setActiveTab(targetTab);
      setTimeoutRef(() => {
        try { closeBtn.focus(); } catch (_) {}
      }, 0);
    }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('mousedown', (ev) => { if (ev.target === modal) closeModal(); });
    modal.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); closeModal(); return; }
      if (ev.key === 'Tab') {
        const focusables = Array.from(dialog.querySelectorAll(focusableSelector))
          .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (ev.shiftKey && documentRef.activeElement === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && documentRef.activeElement === last) { ev.preventDefault(); first.focus(); }
      }
    });

    composerDiffModal = {
      open: openModal,
      close: closeModal,
      activate: setActiveTab,
      getActiveKind: () => activeKind,
      isOpen: () => modal.classList.contains('is-open') && modal.getAttribute('aria-hidden') !== 'true',
      modal,
      dialog,
      title,
      subtitle,
      views: { overview: viewOverview, entries: viewEntries, order: viewOrder },
      statsWrap,
      beforeList,
      afterList,
      svg,
      emptyNotice,
      tabsWrap
    };

    const refreshLocale = () => {
      title.textContent = tComposerDiff('heading');
      subtitle.textContent = tComposerDiff(subtitleKeys[activeTab] || subtitleKeys.overview);
      closeBtn.textContent = tComposerDiff('close');
      closeBtn.setAttribute('aria-label', tComposerDiff('close'));
      if (beforeTitle) beforeTitle.textContent = tComposerDiff('order.remoteTitle');
      if (afterTitle) afterTitle.textContent = tComposerDiff('order.currentTitle');
      if (emptyNotice) emptyNotice.textContent = tComposerDiff('order.empty');
      tabButtons.forEach((btn, id) => {
        const def = tabDefsById.get(id);
        if (!btn || !def) return;
        btn.textContent = tComposerDiff(def.labelKey);
      });
    };
    if (!modal.__pressLangBound) {
      modal.__pressLangBound = true;
      modal.__pressLangDispose = addDocumentListener('press-editor-language-applied', refreshLocale);
    }

    return composerDiffModal;
  }

  function drawOrderDiffLines(state) {
    const ctx = state && typeof state === 'object' && state.container ? state : composerOrderState;
    drawOrderDiffLinesForState(ctx);
  }

  function scheduleComposerOrderPreviewRelayout(kind) {
    const normalized = kind === 'tabs' ? 'tabs' : 'index';
    const timers = composerOrderPreviewRelayoutTimers[normalized];
    if (timers) {
      if (timers.raf != null) {
        cancelAnimationFrameRef(timers.raf);
      }
      if (timers.timeout != null) {
        clearTimeoutRef(timers.timeout);
      }
    }

    const pending = { raf: null, timeout: null };
    const run = () => {
      const active = composerOrderPreviewState && composerOrderPreviewState[normalized];
      if (active) drawOrderDiffLines(active);
    };
    const finalize = () => { composerOrderPreviewRelayoutTimers[normalized] = null; };

    const durations = getSlideDurations();
    const delayBase = Math.max(durations.open, durations.close, 260) + 80;

    const scheduleTrailing = () => {
      pending.timeout = setTimeoutRef(() => {
        pending.timeout = null;
        run();
        finalize();
      }, delayBase);
    };

    const state = composerOrderPreviewState && composerOrderPreviewState[normalized];
    if (!state) {
      finalize();
      return;
    }

    pending.raf = requestAnimationFrameRef(() => {
      pending.raf = null;
      run();
      scheduleTrailing();
    });

    composerOrderPreviewRelayoutTimers[normalized] = pending;
  }

  function ensureComposerOrderPreview(kind) {
    const normalized = kind === 'tabs' ? 'tabs' : 'index';
    if (!composerOrderPreviewElements) composerOrderPreviewElements = { index: null, tabs: null };
    if (composerOrderPreviewElements[normalized]) return composerOrderPreviewElements[normalized];

    const host = documentRef.querySelector(`.composer-order-host[data-kind="${normalized}"]`);
    if (!host) return null;
    const root = host.querySelector('.composer-order-inline');
    if (!root) return null;

    let svg = host.querySelector('svg.composer-order-inline-lines');
    if (!svg) {
      svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('composer-order-lines', 'composer-order-inline-lines');
      svg.setAttribute('aria-hidden', 'true');
      host.appendChild(svg);
    }

    const meta = documentRef.getElementById('composerOrderInlineMeta');
    const statsWrap = meta ? meta.querySelector('.composer-order-inline-stats') : null;
    const list = root.querySelector('.composer-order-inline-list');
    const emptyNotice = root.querySelector('.composer-order-inline-empty');
    const kindLabel = meta ? meta.querySelector('.composer-order-inline-kind') : null;
    const title = meta ? meta.querySelector('.composer-order-inline-title') : null;
    const openBtn = meta ? meta.querySelector('.composer-order-inline-open') : null;

    if (openBtn && !openBtn.__pressBound) {
      openBtn.__pressBound = true;
      openBtn.addEventListener('click', () => {
        const target = openBtn.dataset && openBtn.dataset.kind ? openBtn.dataset.kind : normalized;
        openComposerDiffModal(target, 'overview');
      });
    }

    if (ResizeObserverRef && !host.__pressOrderResizeObserver) {
      try {
        const ro = new ResizeObserverRef(() => {
          const state = composerOrderPreviewState && composerOrderPreviewState[normalized];
          if (state) drawOrderDiffLines(state);
        });
        ro.observe(host);
        host.__pressOrderResizeObserver = ro;
      } catch (_) {}
    }

    if (!composerOrderPreviewResizeHandler) {
      composerOrderPreviewResizeHandler = () => {
        if (!composerOrderPreviewState) return;
        ['index', 'tabs'].forEach(key => {
          const state = composerOrderPreviewState[key];
          if (state) drawOrderDiffLines(state);
        });
      };
      composerOrderPreviewResizeDispose = addWindowListener('resize', composerOrderPreviewResizeHandler);
    }

    const preview = { host, root, list, statsWrap, emptyNotice, svg, kindLabel, openBtn, title, meta };
    composerOrderPreviewElements[normalized] = preview;
    return preview;
  }

  function updateComposerOrderPreview(kind, options = {}) {
    const normalized = kind === 'tabs' ? 'tabs' : 'index';
    const preview = ensureComposerOrderPreview(normalized);
    if (!preview) return;
    composerOrderPreviewActiveKind = normalized;

    const { host, root, list, statsWrap, emptyNotice, svg, kindLabel, openBtn, title, meta } = preview;
    const label = normalized === 'tabs' ? 'tabs.yaml' : 'index.yaml';
    const allowReveal = options.reveal !== false;
    const primaryList = normalized === 'tabs' ? documentRef.getElementById('ctList') : documentRef.getElementById('ciList');
    const primaryListRectBefore = captureElementRect(primaryList);
    let listAnimationScheduled = false;
    const collapseImmediately = !!options.collapseImmediately
      || !!(getComposerViewTransition()
        && getComposerViewTransition().panels
        && getComposerViewTransition().panels.classList.contains('is-hidden'));
    const runListAnimation = (opts = {}) => {
      if (listAnimationScheduled) return;
      listAnimationScheduled = true;
      if (!primaryList || !primaryListRectBefore) return;
      const originalOnMeasured = typeof opts.onMeasured === 'function' ? opts.onMeasured : null;
      const config = { ...opts };
      config.onMeasured = (rect) => {
        if (originalOnMeasured) {
          try {
            const result = originalOnMeasured(rect);
            if (result && typeof result === 'object') return result;
          }
          catch (_) {}
        }
        return rect;
      };
      animateComposerListTransition(primaryList, primaryListRectBefore, config);
    };
    const applyInlineActive = (value) => {
      if (!host) return;
      host.dataset.inlineActive = value ? 'true' : 'false';
    };

    if (title) title.textContent = tComposerDiff('inline.title');
    if (kindLabel) kindLabel.textContent = label;
    if (meta) meta.dataset.kind = normalized;
    if (root) {
      root.dataset.kind = normalized;
      root.setAttribute('aria-label', tComposerDiff('inline.ariaOrder', { label }));
    }
    if (host) host.dataset.kind = normalized;
    if (openBtn) {
      openBtn.dataset.kind = normalized;
      openBtn.setAttribute('aria-label', tComposerDiff('inline.openAria', { label }));
    }

    const diff = getComposerDiff(normalized) || recomputeDiff(normalized);

    const details = computeOrderDiffDetails(normalized) || {};
    const beforeEntries = Array.isArray(details.beforeEntries) ? details.beforeEntries : [];
    const afterEntries = Array.isArray(details.afterEntries) ? details.afterEntries : [];
    const connectors = Array.isArray(details.connectors) ? details.connectors : [];
    const stats = details.stats || { moved: 0, added: 0, removed: 0 };

    if (statsWrap) {
      renderComposerInlineSummary(statsWrap, diff, { orderStats: stats });
    }

    if (list) {
      list.innerHTML = '';
    }

    const leftMap = new Map();
    beforeEntries.forEach(entry => {
      const item = buildOrderDiffItem(entry, 'before');
      item.classList.add('composer-order-inline-item');
      leftMap.set(entry.key, item);
      if (list) list.appendChild(item);
    });

    const main = host ? host.querySelector('.composer-order-main') : null;
    if (main) cancelComposerOrderMainTransition(main);
    const mainRectBefore = main ? captureElementRect(main) : null;
    const rightMap = new Map();
    if (main) {
      const selector = normalized === 'tabs' ? '.ct-item' : '.ci-item';
      afterEntries.forEach(entry => {
        if (!entry || !entry.key) return;
        const row = main.querySelector(`${selector}[data-key="${cssEscape(entry.key)}"]`);
        if (!row) return;
        rightMap.set(entry.key, row);
        bindComposerOrderHover(row, entry.key);
        observeComposerOrderRow(row, normalized);
      });
    }

    if (svg) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
    }

    const hasBaseline = leftMap.size > 0;
    const hasOrderChanges = (stats.moved || stats.added || stats.removed) > 0;
    const hasDiffChanges = !!(diff && diff.hasChanges);

    if (host) {
      const hoverState = host.__pressOrderHoverState || {};
      if (hoverState.activeLeft && !hoverState.activeLeft.isConnected) {
        try { hoverState.activeLeft.classList.remove('is-hovered'); } catch (_) {}
        hoverState.activeLeft = null;
      }
      hoverState.leftMap = leftMap;
      hoverState.rightMap = rightMap;
      hoverState.svg = svg;
      if (!hasOrderChanges) hoverState.pathMap = null;
      host.__pressOrderHoverState = hoverState;
    }

    if (emptyNotice) {
      if (!hasBaseline) {
        emptyNotice.hidden = !hasOrderChanges;
        emptyNotice.setAttribute('aria-hidden', hasOrderChanges ? 'false' : 'true');
        if (hasOrderChanges && stats.added && !hasBaseline) {
          emptyNotice.textContent = tComposerDiff('order.inlineAllNew');
        } else {
          emptyNotice.textContent = tComposer('inlineEmpty');
        }
      } else {
        emptyNotice.hidden = true;
        emptyNotice.setAttribute('aria-hidden', 'true');
      }
    }

    if (!hasDiffChanges) {
      if (meta) {
        animateComposerInlineVisibility(meta, false, collapseImmediately ? { immediate: true } : undefined);
      }
      if (host) host.dataset.state = 'clean';

      let collapseApplied = false;
      const finalizeCollapse = () => {
        if (collapseApplied) return;
        collapseApplied = true;
        applyInlineActive(false);
        animateComposerOrderMainReset(host, mainRectBefore, { immediate: collapseImmediately });
        runListAnimation({ immediate: true });
      };

      if (root) {
        root.dataset.state = 'clean';
        const collapseOptions = collapseImmediately
          ? { onFinish: finalizeCollapse, immediate: true }
          : { onFinish: finalizeCollapse };
        animateComposerInlineVisibility(root, false, collapseOptions);
      } else {
        finalizeCollapse();
      }

      if (svg) svg.style.display = 'none';
      if (host) {
        const hoverState = host.__pressOrderHoverState || {};
        hoverState.pathMap = null;
        hoverState.currentKey = '';
        host.__pressOrderHoverState = hoverState;
        applyComposerOrderHover(host, '');
      }
      composerOrderPreviewState[normalized] = null;
      return;
    }

    if (meta) {
      if (allowReveal) animateComposerInlineVisibility(meta, true);
      else meta.setAttribute('aria-hidden', meta.hidden ? 'true' : 'false');
    }

    if (host) host.dataset.state = 'changed';

    const inlineShouldShow = hasOrderChanges && allowReveal;
    if (inlineShouldShow) {
      applyInlineActive(true);
      if (root) {
        root.dataset.state = 'changed';
        animateComposerInlineVisibility(root, true);
      }
      runListAnimation();
    } else {
      let collapseApplied = false;
      const finalizeCollapse = () => {
        if (collapseApplied) return;
        collapseApplied = true;
        applyInlineActive(false);
        animateComposerOrderMainReset(host, mainRectBefore, { immediate: collapseImmediately });
        runListAnimation({ immediate: true });
      };
      if (root) {
        root.dataset.state = hasOrderChanges ? 'changed' : 'clean';
        const collapseOptions = collapseImmediately
          ? { onFinish: finalizeCollapse, immediate: true }
          : { onFinish: finalizeCollapse };
        animateComposerInlineVisibility(root, false, collapseOptions);
      } else {
        finalizeCollapse();
      }
    }

    const state = hasOrderChanges && svg && (leftMap.size || connectors.length)
      ? { container: host, svg, connectors, leftMap, rightMap }
      : null;
    composerOrderPreviewState[normalized] = state;
    if (svg) svg.style.display = state ? '' : 'none';
    if (!state && host) {
      const hoverState = host.__pressOrderHoverState || {};
      hoverState.pathMap = null;
      hoverState.currentKey = '';
      host.__pressOrderHoverState = hoverState;
      applyComposerOrderHover(host, '');
    }
    if (state) {
      if (host && host.__pressOrderHoverState && typeof host.__pressOrderHoverState.currentKey === 'string') {
        applyComposerOrderHover(host, host.__pressOrderHoverState.currentKey);
      }
      drawOrderDiffLines(state);
      requestAnimationFrameRef(() => drawOrderDiffLines(state));
      setTimeoutRef(() => drawOrderDiffLines(state), 120);
    }
  }

  function observeComposerOrderRow(row, kind) {
    if (!row || !ResizeObserverRef) return;
    const normalized = kind === 'tabs' ? 'tabs' : 'index';
    const existing = row.__pressOrderResize;
    if (existing && existing.kind === normalized) return;
    try {
      if (existing && existing.observer) {
        existing.observer.disconnect();
      }
    } catch (_) {}
    try {
      const observer = new ResizeObserverRef(() => {
        scheduleComposerOrderPreviewRelayout(normalized);
      });
      observer.observe(row);
      row.__pressOrderResize = { observer, kind: normalized };
    } catch (_) {}
  }

  function setComposerOrderPreviewActiveKind(kind) {
    const normalized = kind === 'tabs' ? 'tabs' : 'index';
    if (composerOrderPreviewActiveKind === normalized) {
      updateComposerOrderPreview(normalized);
      return;
    }
    composerOrderPreviewActiveKind = normalized;
    updateComposerOrderPreview(normalized);
  }

  function getComposerOrderPreviewActiveKind() {
    return composerOrderPreviewActiveKind;
  }

  function closeComposerDiffModalForKind(kind) {
    const modal = composerDiffModal;
    const safeKind = normalizeOrderKind(kind);
    const matchesKind = modal && typeof modal.getActiveKind === 'function'
      ? modal.getActiveKind() === safeKind
      : true;
    const isOpen = modal && modal.modal && modal.modal.classList
      ? (modal.modal.classList.contains('is-open') && modal.modal.getAttribute('aria-hidden') !== 'true')
      : false;
    if (modal && typeof modal.close === 'function' && matchesKind && isOpen) {
      try { modal.close(); } catch (_) {}
    }
  }

  return {
    openComposerDiffModal,
    openOrderDiffModal,
    scheduleComposerOrderPreviewRelayout,
    updateComposerOrderPreview,
    setComposerOrderPreviewActiveKind,
    getComposerOrderPreviewActiveKind,
    closeComposerDiffModalForKind
  };
}
