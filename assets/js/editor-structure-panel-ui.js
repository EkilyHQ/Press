export function createEditorStructurePanelUi(options = {}) {
  const document = options.documentRef || null;
  const window = options.windowRef || null;
  const consoleRef = options.consoleRef || null;
  const preferredLangOrder = Array.isArray(options.preferredLangOrder) ? options.preferredLangOrder.slice() : [];
  const treeText = typeof options.treeText === 'function' ? options.treeText : (key, fallback) => fallback || key;
  const welcomeText = typeof options.welcomeText === 'function' ? options.welcomeText : (key, fallback) => fallback || key;
  const translate = typeof options.translate === 'function' ? options.translate : (key) => key;
  const tComposer = typeof options.tComposer === 'function' ? options.tComposer : (key) => key;
  const displayLangName = typeof options.displayLangName === 'function' ? options.displayLangName : (code) => String(code || '').toUpperCase();
  const sortLangKeys = typeof options.sortLangKeys === 'function' ? options.sortLangKeys : (value) => Object.keys(value || {}).sort();
  const normalizeRelPath = typeof options.normalizeRelPath === 'function' ? options.normalizeRelPath : (value) => String(value || '').trim();
  const normalizeIndexVariantList = typeof options.normalizeIndexVariantList === 'function' ? options.normalizeIndexVariantList : (value) => Array.isArray(value) ? value.slice() : (value ? [value] : []);
  const getIndexVariantLocation = typeof options.getIndexVariantLocation === 'function' ? options.getIndexVariantLocation : (value) => typeof value === 'string' ? value : '';
  const extractVersionFromPath = typeof options.extractVersionFromPath === 'function' ? options.extractVersionFromPath : () => '';
  const basenameFromPath = typeof options.basenameFromPath === 'function' ? options.basenameFromPath : (value) => String(value || '').split('/').pop() || '';
  const getStateSlice = typeof options.getStateSlice === 'function' ? options.getStateSlice : () => ({});
  const getIndexEntry = typeof options.getIndexEntry === 'function' ? options.getIndexEntry : () => ({});
  const getTabsEntry = typeof options.getTabsEntry === 'function' ? options.getTabsEntry : () => ({});
  const notifyComposerChange = typeof options.notifyComposerChange === 'function' ? options.notifyComposerChange : () => {};
  const refreshEditorContentTree = typeof options.refreshEditorContentTree === 'function' ? options.refreshEditorContentTree : () => {};
  const setEditorDetailPanelMode = typeof options.setEditorDetailPanelMode === 'function' ? options.setEditorDetailPanelMode : () => {};
  const animateEditorStructurePanelContent = typeof options.animateEditorStructurePanelContent === 'function' ? options.animateEditorStructurePanelContent : () => {};
  const setActiveEditorTreeNodeId = typeof options.setActiveEditorTreeNodeId === 'function' ? options.setActiveEditorTreeNodeId : () => {};
  const handleEditorTreeSelection = typeof options.handleEditorTreeSelection === 'function' ? options.handleEditorTreeSelection : () => {};
  const openMarkdownInEditor = typeof options.openMarkdownInEditor === 'function' ? options.openMarkdownInEditor : () => {};
  const addComposerEntry = typeof options.addComposerEntry === 'function' ? options.addComposerEntry : async () => '';
  const deleteEditorEntry = typeof options.deleteEditorEntry === 'function' ? options.deleteEditorEntry : () => {};
  const addEditorLanguage = typeof options.addEditorLanguage === 'function' ? options.addEditorLanguage : () => {};
  const removeEditorLanguage = typeof options.removeEditorLanguage === 'function' ? options.removeEditorLanguage : () => {};
  const addEditorVersion = typeof options.addEditorVersion === 'function' ? options.addEditorVersion : async () => false;
  const removeEditorVersion = typeof options.removeEditorVersion === 'function' ? options.removeEditorVersion : () => {};
  const moveEditorVersionTo = typeof options.moveEditorVersionTo === 'function' ? options.moveEditorVersionTo : () => false;
  const restoreDeletedEditorTreeNode = typeof options.restoreDeletedEditorTreeNode === 'function' ? options.restoreDeletedEditorTreeNode : () => false;

  function requestFrame(callback) {
    if (window && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(callback);
      return;
    }
    callback();
  }

  function showMarkdownOpenAlert() {
    const message = tComposer('markdown.openBeforeEditor');
    try {
      if (window && typeof window.alert === 'function') window.alert(message);
    } catch (_) {}
  }

  function makeStructureButton(label, className = 'btn-secondary') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    return btn;
  }

  function renderStructureItem(label, detail, onOpen) {
    const item = document.createElement('div');
    item.className = 'editor-structure-item';
    const main = document.createElement('div');
    main.className = 'editor-structure-item-main';
    const title = document.createElement('span');
    title.className = 'editor-structure-item-title';
    title.textContent = label || '';
    const meta = document.createElement('span');
    meta.className = 'editor-structure-item-meta';
    meta.textContent = detail || '';
    main.appendChild(title);
    main.appendChild(meta);
    item.appendChild(main);
    if (typeof onOpen === 'function') {
      const controls = document.createElement('div');
      controls.className = 'editor-structure-item-actions';
      const open = makeStructureButton(treeText('select', 'Select'));
      open.addEventListener('click', onOpen);
      controls.appendChild(open);
      item.appendChild(controls);
    }
    return item;
  }

  function createEditorStructureDragController(list, onMove) {
    let dragState = null;

    const getAnimatedRows = () => Array.from(list.children)
      .filter((row) => row !== dragState?.placeholder && row.classList?.contains('editor-structure-item--draggable') && row !== dragState?.dragItem);

    const animateRows = (callback) => {
      const previousRects = new Map();
      getAnimatedRows().forEach((row) => {
        previousRects.set(row, row.getBoundingClientRect());
      });

      callback();

      getAnimatedRows().forEach((row) => {
        const previous = previousRects.get(row);
        if (!previous) return;
        const next = row.getBoundingClientRect();
        const deltaY = previous.top - next.top;
        if (!deltaY) return;
        row.style.transition = 'none';
        row.style.transform = `translate3d(0, ${deltaY}px, 0)`;
        requestFrame(() => {
          row.style.transition = 'transform .18s cubic-bezier(.2,.8,.2,1)';
          row.style.transform = '';
        });
      });
    };

    const createPlaceholder = (item) => {
      const itemRect = item.getBoundingClientRect();
      const placeholder = document.createElement('div');
      placeholder.className = 'editor-structure-drop-placeholder';
      placeholder.style.height = `${itemRect.height}px`;
      return placeholder;
    };

    const getDropIndex = () => {
      if (!dragState || !dragState.placeholder) return -1;
      const rows = Array.from(list.children)
        .filter((childNode) => childNode === dragState.placeholder || (childNode !== dragState.dragItem && childNode.classList?.contains('editor-structure-item--draggable')));
      return rows.indexOf(dragState.placeholder);
    };

    const updateDragItemState = () => {
      list.querySelectorAll('.editor-structure-item--draggable').forEach((item) => {
        item.classList.toggle('is-dragging', !!dragState && item === dragState.dragItem);
      });
    };

    const applyDragPreview = (clientY) => {
      if (!dragState) return;
      dragState.dragItem.style.transform = `translate3d(0, ${clientY - dragState.startY}px, 0)`;
      const rows = getAnimatedRows();
      let nextNode = null;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        if (clientY < midpoint) {
          nextNode = row;
          break;
        }
      }
      if (nextNode === dragState.placeholder.nextSibling) return;
      animateRows(() => {
        list.insertBefore(dragState.placeholder, nextNode);
      });
    };

    const handlePointerMove = (event) => {
      if (!dragState) return;
      event.preventDefault();
      applyDragPreview(event.clientY);
    };

    const endDrag = () => {
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', endDrag, true);
      document.removeEventListener('pointercancel', endDrag, true);
      if (dragState) {
        const { fromIndex, dragItem, placeholder } = dragState;
        const toIndex = getDropIndex();
        dragItem.classList.remove('is-dragging');
        dragItem.style.position = '';
        dragItem.style.left = '';
        dragItem.style.top = '';
        dragItem.style.width = '';
        dragItem.style.zIndex = '';
        dragItem.style.transform = '';
        if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
        if (toIndex >= 0) onMove(fromIndex, toIndex);
      }
      dragState = null;
      updateDragItemState();
    };

    return {
      createHandle(index, ariaLabel) {
        const handle = document.createElement('span');
        handle.setAttribute('role', 'button');
        handle.tabIndex = 0;
        handle.className = 'editor-structure-drag-handle';
        handle.setAttribute('aria-label', ariaLabel);
        handle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';
        handle.addEventListener('pointerdown', (event) => {
          if (event.button != null && event.button !== 0) return;
          event.preventDefault();
          const item = handle.closest('.editor-structure-item--draggable');
          if (!item) return;
          const itemRect = item.getBoundingClientRect();
          const placeholder = createPlaceholder(item);
          list.insertBefore(placeholder, item);
          dragState = {
            fromIndex: index,
            dragItem: item,
            placeholder,
            startY: event.clientY
          };
          item.classList.add('is-dragging');
          item.style.position = 'fixed';
          item.style.left = `${itemRect.left}px`;
          item.style.top = `${itemRect.top}px`;
          item.style.width = `${itemRect.width}px`;
          item.style.zIndex = '1000';
          item.style.transform = 'translate3d(0, 0, 0)';
          updateDragItemState();
          document.addEventListener('pointermove', handlePointerMove, true);
          document.addEventListener('pointerup', endDrag, true);
          document.addEventListener('pointercancel', endDrag, true);
        });
        handle.addEventListener('keydown', (event) => {
          if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
          event.preventDefault();
          onMove(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
        });
        return handle;
      }
    };
  }

  function moveStructureRootEntry(source, from, to) {
    const state = getStateSlice(source) || {};
    const order = Array.isArray(state.__order) ? state.__order : [];
    if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return false;
    const [key] = order.splice(from, 1);
    order.splice(to, 0, key);
    setActiveEditorTreeNodeId(source === 'tabs' ? 'pages' : 'articles');
    notifyComposerChange(source);
    refreshEditorContentTree();
    return true;
  }

  function appendEditorLanguageControl(body) {
    if (!body) return;
    const item = document.createElement('div');
    item.className = 'editor-structure-item editor-system-language-item';

    const main = document.createElement('div');
    main.className = 'editor-structure-item-main';
    const title = document.createElement('span');
    title.className = 'editor-structure-item-title';
    title.textContent = treeText('editorLanguage', translate('editor.languageLabel') || 'Language');
    const meta = document.createElement('span');
    meta.className = 'editor-structure-item-meta';
    meta.textContent = treeText('editorLanguageMeta', 'Change the editor interface language.');
    main.appendChild(title);
    main.appendChild(meta);

    const controls = document.createElement('div');
    controls.className = 'editor-structure-item-actions';
    const switcher = document.createElement('div');
    switcher.className = 'editor-lang-switcher editor-lang-switcher-inline';
    switcher.id = 'editorLangSwitcher';
    const label = document.createElement('label');
    label.setAttribute('for', 'editorLangSelect');
    label.setAttribute('data-i18n', 'editor.languageLabel');
    label.textContent = translate('editor.languageLabel') || 'Language';
    const select = document.createElement('select');
    select.id = 'editorLangSelect';
    select.setAttribute('data-i18n-aria-label', 'editor.languageLabel');
    select.setAttribute('aria-label', translate('editor.languageLabel') || 'Language');
    switcher.appendChild(label);
    switcher.appendChild(select);
    controls.appendChild(switcher);

    item.appendChild(main);
    item.appendChild(controls);
    body.appendChild(item);

    try {
      if (window && typeof window.__pressPopulateEditorLanguageSelect === 'function') window.__pressPopulateEditorLanguageSelect();
      document.dispatchEvent(new CustomEvent('press-editor-language-control-mounted'));
    } catch (_) {}
  }

  function availableLanguageCodes(entry) {
    return preferredLangOrder.filter(code => !entry || !entry[code]);
  }

  function appendLanguageSelector(actions, source, key, entry) {
    const available = availableLanguageCodes(entry);
    if (!available.length) return;
    const select = document.createElement('select');
    select.setAttribute('aria-label', treeText('language', 'Language'));
    available.forEach((code) => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = displayLangName(code);
      select.appendChild(opt);
    });
    const add = makeStructureButton(treeText('addLanguage', 'Add language'));
    add.addEventListener('click', () => addEditorLanguage(source, key, select.value));
    actions.appendChild(select);
    actions.appendChild(add);
  }

  function getDeletedEditorTreeKicker(node) {
    if (!node) return treeText('deletedKicker', 'Deleted item');
    if (node.deletedKind === 'entry') return node.source === 'tabs' ? treeText('pageEntry', 'Page') : treeText('articleEntry', 'Article');
    if (node.deletedKind === 'language') return treeText('languageKicker', 'Article language');
    if (node.deletedKind === 'page-language') return treeText('pageFile', 'Page file');
    return node.source === 'tabs' ? treeText('pageFile', 'Page file') : treeText('articleFile', 'Article file');
  }

  function getDeletedEditorTreeTitle(node) {
    if (!node) return treeText('deletedKicker', 'Deleted item');
    if (node.deletedKind === 'language') return `${node.key} / ${displayLangName(node.lang)}`;
    if (node.deletedKind === 'version' || node.deletedKind === 'page-language') return node.path || node.label || node.id;
    return node.key || node.label || node.id;
  }

  function getDeletedEditorTreeMeta(node) {
    if (!node) return treeText('deletedMeta', 'This item was removed from the current draft. Restore it before publishing if you want to keep it.');
    if (node.deletedKind === 'entry') return treeText('deletedEntryMeta', 'This entry was removed from the current draft. Restore it before publishing if you want to keep it.');
    if (node.deletedKind === 'language') return treeText('deletedLanguageMeta', 'This language was removed from the current draft. Restore it before publishing if you want to keep it.');
    if (node.deletedKind === 'page-language') return treeText('deletedPageLanguageMeta', 'This page language file was removed from the current draft. Restore it before publishing if you want to keep it.');
    return treeText('deletedFileMeta', 'This file was removed from the current draft. Restore it before publishing if you want to keep it.');
  }

  function renderEditorDeletedPanel(node, refs) {
    refs.kicker.textContent = getDeletedEditorTreeKicker(node);
    refs.title.textContent = getDeletedEditorTreeTitle(node);
    refs.meta.textContent = getDeletedEditorTreeMeta(node);

    const restore = makeStructureButton(treeText('restoreDeleted', 'Restore'));
    restore.addEventListener('click', () => restoreDeletedEditorTreeNode(node));
    refs.actions.appendChild(restore);

    const list = document.createElement('div');
    list.className = 'editor-structure-list';
    const restoreDetail = node && node.path
      ? node.path
      : treeText('deletedRestoreHint', 'Restore writes back the last loaded baseline value for this deleted item.');
    list.appendChild(renderStructureItem(treeText('status.deleted', 'Deleted'), restoreDetail));
    if (node && Array.isArray(node.children) && node.children.length) {
      node.children.forEach((child) => {
        const detail = child.path || (child.children ? `${child.children.length} ${treeText('versions', 'versions')}` : '');
        list.appendChild(renderStructureItem(child.label, detail, () => handleEditorTreeSelection(child.id)));
      });
    }
    refs.body.appendChild(list);
  }

  function makeWelcomeButton(label, targetNodeId, className = 'btn-secondary editor-welcome-button') {
    const button = makeStructureButton(label || treeText('select', 'Select'), className);
    button.addEventListener('click', () => handleEditorTreeSelection(targetNodeId));
    return button;
  }

  function renderWelcomeHero(refs) {
    refs.body.classList.add('editor-welcome-body');
    refs.kicker.textContent = welcomeText('kicker', 'Getting started');
    refs.title.textContent = welcomeText('title', 'Welcome to Press');
    refs.meta.textContent = welcomeText('meta', 'Where knowledge becomes pages.');
  }

  function renderWelcomeStep(options) {
    const step = document.createElement('article');
    step.className = 'editor-welcome-step';
    if (options.featured) step.classList.add('is-featured');

    const number = document.createElement('span');
    number.className = 'editor-welcome-step-number';
    number.textContent = options.number || '';

    const content = document.createElement('div');
    content.className = 'editor-welcome-step-content';

    const title = document.createElement('h4');
    title.className = 'editor-welcome-step-title';
    title.textContent = options.title || '';

    const detail = document.createElement('p');
    detail.className = 'editor-welcome-step-detail';
    detail.textContent = options.detail || '';

    const actions = document.createElement('div');
    actions.className = 'editor-welcome-step-actions';
    (options.actions || []).forEach((action) => {
      actions.appendChild(makeWelcomeButton(
        action.label,
        action.targetNodeId,
        action.primary ? 'btn-primary editor-welcome-button editor-welcome-button-primary' : 'btn-secondary editor-welcome-button'
      ));
    });

    content.append(title, detail, actions);
    step.append(number, content);
    return step;
  }

  function renderWelcomeSteps() {
    const section = document.createElement('section');
    section.className = 'editor-welcome-section editor-welcome-steps';

    const title = document.createElement('h3');
    title.className = 'editor-welcome-heading';
    title.textContent = welcomeText('stepsTitle', 'Start here');
    section.appendChild(title);

    const list = document.createElement('div');
    list.className = 'editor-welcome-step-list';
    [
      {
        number: welcomeText('step1Number', 'Step 1'),
        title: welcomeText('step1Title', 'Set up the site'),
        detail: welcomeText('step1Detail', 'Confirm the site name, language, theme, and GitHub repository before editing content.'),
        featured: true,
        actions: [
          { label: welcomeText('step1Button', 'Open Site Settings'), targetNodeId: 'system:site-settings', primary: true }
        ]
      },
      {
        number: welcomeText('step2Number', 'Step 2'),
        title: welcomeText('step2Title', 'Add content'),
        detail: welcomeText('step2Detail', 'Use Articles for posts, notes, and tutorials. Use Pages for fixed navigation pages like About or History.'),
        actions: [
          { label: welcomeText('step2ArticlesButton', 'Open Articles'), targetNodeId: 'articles' },
          { label: welcomeText('step2PagesButton', 'Open Pages'), targetNodeId: 'pages' }
        ]
      },
      {
        number: welcomeText('step3Number', 'Step 3'),
        title: welcomeText('step3Title', 'Publish when ready'),
        detail: welcomeText('step3Detail', 'Saving keeps drafts local. Publish sends the changes you choose to GitHub.'),
        actions: [
          { label: welcomeText('step3Button', 'Open Publish'), targetNodeId: 'system:sync', primary: true }
        ]
      }
    ].forEach((step) => list.appendChild(renderWelcomeStep(step)));
    section.appendChild(list);
    return section;
  }

  function renderWelcomeSecondaryActions() {
    const section = document.createElement('section');
    section.className = 'editor-welcome-secondary';

    const text = document.createElement('div');
    text.className = 'editor-welcome-secondary-text';

    const title = document.createElement('h3');
    title.className = 'editor-welcome-secondary-title';
    title.textContent = welcomeText('updatesTitle', 'Press Updates');

    const detail = document.createElement('p');
    detail.className = 'editor-welcome-secondary-detail';
    detail.textContent = welcomeText('updatesBody', 'Check editor and runtime updates without changing your articles, pages, or site settings.');

    text.append(title, detail);
    section.append(
      text,
      makeWelcomeButton(welcomeText('updatesButton', 'Check updates'), 'system:updates')
    );
    return section;
  }

  function renderWelcomeFaqItem(questionText, answerText, open) {
    const item = document.createElement('details');
    item.className = 'editor-welcome-faq-item';
    if (open) item.open = true;

    const summary = document.createElement('summary');
    summary.className = 'editor-welcome-faq-question';
    summary.textContent = questionText || '';

    const answer = document.createElement('p');
    answer.className = 'editor-welcome-faq-answer';
    answer.textContent = answerText || '';

    item.append(summary, answer);
    return item;
  }

  function renderWelcomeFaq() {
    const section = document.createElement('section');
    section.className = 'editor-welcome-section editor-welcome-faq';

    const title = document.createElement('h3');
    title.className = 'editor-welcome-heading';
    title.textContent = welcomeText('faqTitle', 'When a word looks unfamiliar');

    const intro = document.createElement('p');
    intro.className = 'editor-welcome-faq-intro';
    intro.textContent = welcomeText('faqIntro', 'You do not need to read everything now. Open a question only when it helps.');

    const list = document.createElement('div');
    list.className = 'editor-welcome-faq-list';
    [
      ['faqPressQuestion', 'What is Press?', 'faqPressAnswer', 'Where knowledge becomes pages.', true],
      ['faqMarkdownQuestion', 'What is Markdown?', 'faqMarkdownAnswer', 'Markdown is a simple way to write headings, links, lists, images, and paragraphs as plain text.', false],
      ['faqArticlesPagesQuestion', 'What is the difference between Articles and Pages?', 'faqArticlesPagesAnswer', 'Articles are listed posts for blogs, notes, and tutorials. Pages are fixed navigation pages such as About or History.', false],
      ['faqFrontMatterQuestion', 'What is front matter?', 'faqFrontMatterAnswer', 'Front matter is the small settings block for a page or article, such as title, date, tags, excerpt, and cover image.', false],
      ['faqPublishQuestion', 'How do local edits and Publish work?', 'faqPublishAnswer', 'Saving keeps drafts on this computer. Publish sends the changes you choose to GitHub.', false],
      ['faqUpdatesQuestion', 'What do Press Updates change?', 'faqUpdatesAnswer', 'System Updates refresh editor and runtime files. They do not overwrite your articles, pages, or site settings.', false]
    ].forEach(([questionKey, questionFallback, answerKey, answerFallback, open]) => {
      list.appendChild(renderWelcomeFaqItem(
        welcomeText(questionKey, questionFallback),
        welcomeText(answerKey, answerFallback),
        open
      ));
    });

    section.append(title, intro, list);
    return section;
  }

  function renderEditorWelcomePanel(refs) {
    renderWelcomeHero(refs);
    refs.body.append(
      renderWelcomeSteps(),
      renderWelcomeSecondaryActions(),
      renderWelcomeFaq()
    );
  }

  function renderEditorStructurePanel(node) {
    if (!document || typeof document.getElementById !== 'function') return;
    const panel = document.getElementById('editorStructurePanel');
    const title = document.getElementById('editorStructureTitle');
    const kicker = document.getElementById('editorStructureKicker');
    const meta = document.getElementById('editorStructureMeta');
    const actions = document.getElementById('editorStructureActions');
    const body = document.getElementById('editorStructureBody');
    if (!panel || !title || !kicker || !meta || !actions || !body) return;
    const animate = () => animateEditorStructurePanelContent(panel);
    actions.innerHTML = '';
    body.innerHTML = '';
    body.classList.remove('editor-welcome-body');
    setEditorDetailPanelMode('structure');

    if (!node) {
      kicker.textContent = treeText('kicker', 'Content structure');
      title.textContent = treeText('emptyTitle', 'Select a node');
      meta.textContent = treeText('emptyMeta', 'Choose an item in the tree to manage its structure or edit a Markdown file.');
      animate();
      return;
    }

    if (node.isDeleted) {
      renderEditorDeletedPanel(node, { title, kicker, meta, actions, body });
      animate();
      return;
    }

    if (node.kind === 'root') {
      if (node.source === 'welcome') {
        renderEditorWelcomePanel({ title, kicker, meta, actions, body });
        animate();
        return;
      }
      if (node.source === 'system') {
        kicker.textContent = treeText('rootKicker', 'Collection');
        title.textContent = node.label || treeText('system', 'System');
        meta.textContent = treeText('rootMeta', `${node.children.length} items`, { count: node.children.length });
        appendEditorLanguageControl(body);
        const list = document.createElement('div');
        list.className = 'editor-structure-list';
        node.children.forEach((child) => {
          const detail = child.id === 'system:sync'
            ? treeText('syncMeta', 'Publish local changes to GitHub.')
            : (child.id === 'system:updates'
              ? treeText('systemUpdatesMeta', 'Review and apply Press updates.')
              : (child.id === 'system:themes'
                ? treeText('themesMeta', 'Theme packs.')
                : treeText('siteSettingsMeta', 'Edit site.yaml settings.')));
          list.appendChild(renderStructureItem(child.label, detail, () => handleEditorTreeSelection(child.id)));
        });
        body.appendChild(list);
        animate();
        return;
      }
      const isPages = node.source === 'tabs';
      const visibleChildren = node.children.filter(child => !child.isDeleted);
      kicker.textContent = treeText('rootKicker', 'Collection');
      title.textContent = node.label || (isPages ? treeText('pages', 'Pages') : treeText('articles', 'Articles'));
      meta.textContent = treeText('rootMeta', `${visibleChildren.length} items`, { count: visibleChildren.length });
      const add = makeStructureButton(isPages ? treeText('addPage', 'Page') : treeText('addArticle', 'Article'));
      add.addEventListener('click', () => {
        const kind = isPages ? 'tabs' : 'index';
        addComposerEntry(kind, add).then((key) => {
          if (key) handleEditorTreeSelection(`${kind}:${key}`);
        }).catch((err) => {
          if (consoleRef && typeof consoleRef.error === 'function') consoleRef.error('Failed to add entry from structure panel', err);
        });
      });
      actions.appendChild(add);
      const list = document.createElement('div');
      list.className = 'editor-structure-list';
      if (node.source === 'index' || node.source === 'tabs') {
        const dragController = createEditorStructureDragController(list, (fromIndex, toIndex) => moveStructureRootEntry(node.source, fromIndex, toIndex));

        const createStructureDragHandle = (index, source) => {
          const labelKey = source === 'tabs' ? 'reorderPage' : 'reorderArticle';
          return dragController.createHandle(index, treeText(labelKey, source === 'tabs' ? 'Reorder page' : 'Reorder article'));
        };

        const renderStructureDraggableItem = (child, detail, index, source) => {
          const item = document.createElement('div');
          item.className = 'editor-structure-item editor-structure-item--draggable';
          item.dataset.index = String(index);
          const handle = createStructureDragHandle(index, source);
          const main = document.createElement('div');
          main.className = 'editor-structure-item-main';
          const title = document.createElement('span');
          title.className = 'editor-structure-item-title';
          title.textContent = child.label || '';
          const metaText = document.createElement('span');
          metaText.className = 'editor-structure-item-meta';
          metaText.textContent = detail || '';
          main.append(title, metaText);
          const controls = document.createElement('div');
          controls.className = 'editor-structure-item-actions';
          const open = makeStructureButton(treeText('select', 'Select'));
          open.addEventListener('click', () => handleEditorTreeSelection(child.id));
          controls.appendChild(open);
          item.append(handle, main, controls);
          return item;
        };

        visibleChildren.forEach((child, index) => {
          list.appendChild(renderStructureDraggableItem(child, `${child.children.length} ${treeText('languages', 'languages')}`, index, node.source));
        });
      } else {
        visibleChildren.forEach((child) => list.appendChild(renderStructureItem(child.label, `${child.children.length} ${treeText('languages', 'languages')}`, () => handleEditorTreeSelection(child.id))));
      }
      body.appendChild(list);
      animate();
      return;
    }

    if (node.kind === 'entry') {
      renderEditorEntryPanel(node, { title, kicker, meta, actions, body });
      animate();
      return;
    }

    if (node.kind === 'language') {
      renderEditorLanguagePanel(node, { title, kicker, meta, actions, body });
      animate();
      return;
    }

    if (node.kind === 'file') {
      kicker.textContent = node.source === 'tabs' ? treeText('pageFile', 'Page file') : treeText('articleFile', 'Article file');
      title.textContent = node.label || basenameFromPath(node.path);
      meta.textContent = node.path || '';
      animate();
    }
  }

  function renderEditorEntryPanel(node, refs) {
    const isPages = node.source === 'tabs';
    const entry = isPages ? getTabsEntry(node.key) : getIndexEntry(node.key);
    refs.kicker.textContent = isPages ? treeText('pageEntry', 'Page') : treeText('articleEntry', 'Article');
    refs.title.textContent = node.key;
    refs.meta.textContent = isPages
      ? treeText('pageEntryMeta', 'Manage page languages and open files for editing.')
      : treeText('articleEntryMeta', 'Manage article languages and versions.');
    appendLanguageSelector(refs.actions, node.source, node.key, entry);
    const del = makeStructureButton(treeText('delete', 'Delete'));
    del.addEventListener('click', () => deleteEditorEntry(node.source, node.key));
    refs.actions.appendChild(del);

    const list = document.createElement('div');
    list.className = 'editor-structure-list';
    sortLangKeys(entry).forEach((lang) => {
      if (isPages) list.appendChild(renderPageLanguageStructure(node.key, lang, entry[lang]));
      else {
        const arr = normalizeIndexVariantList(entry[lang]);
        list.appendChild(renderStructureItem(displayLangName(lang), `${arr.length} ${treeText('versions', 'versions')}`, () => handleEditorTreeSelection(`index:${node.key}:${lang}`)));
      }
    });
    refs.body.appendChild(list);
  }

  function renderPageLanguageStructure(key, lang, value) {
    const entry = value && typeof value === 'object' ? value : { title: '', location: String(value || '') };
    const item = document.createElement('div');
    item.className = 'editor-structure-item';
    const main = document.createElement('div');
    main.className = 'editor-structure-item-main';
    const label = document.createElement('span');
    label.className = 'editor-structure-item-title';
    label.textContent = displayLangName(lang);
    const meta = document.createElement('span');
    meta.className = 'editor-structure-item-meta';
    meta.textContent = entry.location || '';
    main.appendChild(label);
    main.appendChild(meta);
    const controls = document.createElement('div');
    controls.className = 'editor-structure-item-actions';
    const open = makeStructureButton(treeText('open', 'Open'));
    open.addEventListener('click', () => {
      const rel = normalizeRelPath(entry.location);
      if (!rel) {
        showMarkdownOpenAlert();
        return;
      }
      openMarkdownInEditor(rel, {
        source: 'tabs',
        key,
        lang,
        editorTreeNodeId: `tabs:${key}:${lang}`
      });
    });
    const remove = makeStructureButton(treeText('remove', 'Remove'));
    remove.addEventListener('click', () => removeEditorLanguage('tabs', key, lang));
    controls.appendChild(open);
    controls.appendChild(remove);
    item.appendChild(main);
    item.appendChild(controls);
    return item;
  }

  function renderEditorLanguagePanel(node, refs) {
    const entry = getIndexEntry(node.key);
    const arr = normalizeIndexVariantList(entry[node.lang]);
    entry[node.lang] = arr;
    refs.kicker.textContent = treeText('languageKicker', 'Article language');
    refs.title.textContent = `${node.key} / ${displayLangName(node.lang)}`;
    refs.meta.textContent = treeText('languageMeta', `${arr.length} versions`, { count: arr.length });
    const add = makeStructureButton(treeText('addVersion', 'Add version'));
    add.addEventListener('click', () => { void addEditorVersion(node.key, node.lang, add); });
    const removeLang = makeStructureButton(treeText('removeLanguage', 'Remove language'));
    removeLang.addEventListener('click', () => removeEditorLanguage('index', node.key, node.lang));
    refs.actions.appendChild(add);
    refs.actions.appendChild(removeLang);

    const list = document.createElement('div');
    list.className = 'editor-structure-list';
    const dragController = createEditorStructureDragController(list, (fromIndex, toIndex) => moveEditorVersionTo(node.key, node.lang, fromIndex, toIndex));
    arr.forEach((variant, index) => {
      const path = getIndexVariantLocation(variant);
      const item = document.createElement('div');
      item.className = 'editor-structure-item editor-structure-item--draggable';
      item.dataset.index = String(index);
      const handle = dragController.createHandle(index, treeText('reorderVersion', 'Reorder version'));
      const main = document.createElement('div');
      main.className = 'editor-structure-item-main';
      const label = document.createElement('span');
      label.className = 'editor-structure-item-title';
      label.textContent = extractVersionFromPath(path) || `${treeText('version', 'Version')} ${index + 1}`;
      main.appendChild(label);
      const controls = document.createElement('div');
      controls.className = 'editor-structure-item-actions';
      const open = makeStructureButton(treeText('open', 'Open'));
      open.addEventListener('click', () => {
        const rel = getIndexVariantLocation(arr[index]);
        if (!rel) return;
        openMarkdownInEditor(rel, {
          source: 'index',
          key: node.key,
          lang: node.lang,
          editorTreeNodeId: `index:${node.key}:${node.lang}:${index}`
        });
      });
      const remove = makeStructureButton(treeText('remove', 'Remove'));
      remove.addEventListener('click', () => removeEditorVersion(node.key, node.lang, index));
      controls.appendChild(open);
      controls.appendChild(remove);
      item.append(handle, main, controls);
      list.appendChild(item);
    });
    refs.body.appendChild(list);
  }

  return {
    renderEditorStructurePanel
  };
}
