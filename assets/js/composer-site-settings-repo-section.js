const BOOK_ICON_PATH = 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z';
const BRANCH_ICON_PATH = 'M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z';
const noop = () => {};

export function ensureComposerSiteSettingsRepo(site = {}) {
  if (!site.repo || typeof site.repo !== 'object') site.repo = { owner: '', name: '', branch: '' };
  return site.repo;
}

export function createComposerSiteSettingsRepoSection(options = {}) {
  const documentRef = options.documentRef || null;
  const site = options.site || {};
  const createSection = typeof options.createSection === 'function' ? options.createSection : () => null;
  const markDirty = typeof options.markDirty === 'function' ? options.markDirty : noop;
  const renderPublishTransportSettings = typeof options.renderPublishTransportSettings === 'function'
    ? options.renderPublishTransportSettings
    : noop;
  const t = typeof options.t === 'function' ? options.t : (key) => key;
  const siteSettingsSchema = options.siteSettingsSchema || {};
  const repoSectionMeta = siteSettingsSchema.sections && siteSettingsSchema.sections.repo
    ? siteSettingsSchema.sections.repo
    : { title: '', description: '' };

  if (!documentRef || typeof documentRef.createElement !== 'function') return null;

  const repoSection = createSection(repoSectionMeta.title, repoSectionMeta.description);
  if (!repoSection) return null;

  const repo = ensureComposerSiteSettingsRepo(site);
  const repoInputs = documentRef.createElement('div');
  repoInputs.className = 'cs-repo-grid';
  repoInputs.dataset.field = 'repo';

  const createRepoFieldTitle = (text) => {
    const title = documentRef.createElement('span');
    title.className = 'cs-repo-field-title';
    title.textContent = text;
    return title;
  };

  const createRepoFieldGroup = (className, titleText, field) => {
    const group = documentRef.createElement('label');
    group.className = `cs-repo-field-group ${className}`;
    group.append(createRepoFieldTitle(titleText), field);
    return group;
  };

  const createRepoIconAffix = (pathData) => {
    const affix = documentRef.createElement('span');
    affix.className = 'cs-repo-affix cs-repo-icon-affix';
    affix.setAttribute('aria-hidden', 'true');
    affix.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" focusable="false"><path d="${pathData}"></path></svg>`;
    return affix;
  };

  const createRepoInput = (subfield, className, labelKey) => {
    const input = documentRef.createElement('input');
    input.type = 'text';
    input.className = `cs-input cs-repo-input ${className}`;
    input.placeholder = t(labelKey);
    input.setAttribute('aria-label', t(labelKey));
    input.spellcheck = false;
    input.value = repo[subfield] || '';
    input.addEventListener('input', () => {
      repo[subfield] = input.value;
      markDirty();
    });
    return input;
  };

  const ownerInput = createRepoInput('owner', 'cs-repo-input--owner', 'editor.composer.site.repoOwner');
  const nameInput = createRepoInput('name', 'cs-repo-input--name', 'editor.composer.site.repoName');
  const branchInput = createRepoInput('branch', 'cs-repo-input--branch', 'editor.composer.site.repoBranch');

  const ownerWrap = documentRef.createElement('div');
  ownerWrap.className = 'cs-repo-field cs-repo-field--owner';
  ownerWrap.dataset.field = 'repo';
  ownerWrap.dataset.subfield = 'owner';
  const ownerAffix = documentRef.createElement('span');
  ownerAffix.className = 'cs-repo-affix';
  ownerAffix.textContent = t('editor.composer.site.repoOwnerPrefix');
  ownerAffix.setAttribute('aria-hidden', 'true');
  ownerWrap.append(ownerAffix, ownerInput);

  const repoWrap = documentRef.createElement('div');
  repoWrap.className = 'cs-repo-field cs-repo-field--name';
  repoWrap.dataset.field = 'repo';
  repoWrap.dataset.subfield = 'name';
  repoWrap.append(createRepoIconAffix(BOOK_ICON_PATH), nameInput);

  const pathRow = documentRef.createElement('div');
  pathRow.className = 'cs-repo-path';
  const divider = documentRef.createElement('span');
  divider.className = 'cs-repo-divider';
  divider.textContent = '/';
  divider.setAttribute('aria-hidden', 'true');
  pathRow.append(
    createRepoFieldGroup('cs-repo-field-group--owner', t('editor.composer.site.repoOwner'), ownerWrap),
    divider,
    createRepoFieldGroup('cs-repo-field-group--name', t('editor.composer.site.repoName'), repoWrap)
  );

  const branchWrap = documentRef.createElement('div');
  branchWrap.className = 'cs-repo-field cs-repo-field--branch';
  branchWrap.dataset.field = 'repo';
  branchWrap.dataset.subfield = 'branch';
  branchWrap.append(createRepoIconAffix(BRANCH_ICON_PATH), branchInput);

  repoInputs.append(
    pathRow,
    createRepoFieldGroup('cs-repo-field-group--branch', t('editor.composer.site.repoBranch'), branchWrap)
  );
  repoSection.appendChild(repoInputs);
  renderPublishTransportSettings(repoSection);

  return {
    branchInput,
    nameInput,
    ownerInput,
    repo,
    repoInputs,
    repoSection
  };
}
