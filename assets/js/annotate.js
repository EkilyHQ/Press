const ANNOTATE_SECTION_ID = 'press-annotate-comments';
const STYLE_ID = 'press-annotate-style';
const GRANT_STORAGE_PREFIX = 'press_annotate_grant_v1:';

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function asTrimmedString(value) {
  return String(value ?? '').trim();
}

function normalizeBoolean(value) {
  if (value === true) return true;
  const normalized = asTrimmedString(value).toLowerCase();
  return ['true', '1', 'yes', 'y', 'on', 'enabled'].includes(normalized);
}

function trimTrailingSlash(value) {
  return asTrimmedString(value).replace(/\/+$/, '');
}

export function normalizeAnnotateConfig(siteConfig = {}) {
  const annotate = asObject(siteConfig.annotate);
  const repo = asObject(siteConfig.repo);
  const connectBaseUrl = trimTrailingSlash(annotate && annotate.connectBaseUrl);
  const owner = asTrimmedString(repo && repo.owner);
  const name = asTrimmedString(repo && repo.name);
  const discussionCategory = asTrimmedString(annotate && annotate.discussionCategory) || 'General';
  return {
    enabled: !!annotate && normalizeBoolean(annotate.enabled),
    connectBaseUrl,
    discussionCategory,
    repository: { owner, name }
  };
}

export function isAnnotateEnabled(siteConfig = {}) {
  const config = normalizeAnnotateConfig(siteConfig);
  return !!(config.enabled && config.connectBaseUrl && config.repository.owner && config.repository.name);
}

function normalizeEntryLocations(value) {
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item : (item && item.location)))
      .map(asTrimmedString)
      .filter(Boolean);
  }
  if (asObject(value) && typeof value.location === 'string') return [value.location.trim()].filter(Boolean);
  return [];
}

function collectArticleLocations(entry) {
  const result = [];
  const obj = asObject(entry);
  if (!obj) return result;
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'default') continue;
    normalizeEntryLocations(value).forEach(location => result.push({ lang: key, location }));
  }
  normalizeEntryLocations(obj.default).forEach(location => result.push({ lang: 'default', location }));
  return result;
}

function pickVersionFromLocation(location) {
  const match = asTrimmedString(location).match(/(?:^|\/)(v?\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9.-]+)?)(?:\/|$)/);
  return match ? match[1] : '';
}

export function resolveAnnotateArticleContext(options = {}) {
  const rawIndex = asObject(options.rawIndex);
  const location = asTrimmedString(options.location || options.postId || (options.postMetadata && options.postMetadata.location));
  const currentLang = asTrimmedString(options.lang || '').toLowerCase();
  const metadata = asObject(options.postMetadata) || {};
  let articleKey = asTrimmedString(options.articleKey || metadata.articleKey || metadata.key || metadata.slug);
  let matchedLang = currentLang;

  if (rawIndex && location) {
    for (const [key, entry] of Object.entries(rawIndex)) {
      const locations = collectArticleLocations(entry);
      const match = locations.find(item => item.location === location);
      if (match) {
        articleKey = articleKey || key;
        matchedLang = asTrimmedString(match.lang).toLowerCase() || currentLang;
        break;
      }
    }
  }

  if (!articleKey) articleKey = location;

  return {
    articleKey,
    lang: matchedLang || currentLang || 'default',
    version: asTrimmedString(metadata.version || metadata.versionLabel) || pickVersionFromLocation(location),
    location
  };
}

export function buildAnnotateCommentPayload({ context, body, replyToId } = {}) {
  const ctx = asObject(context) || {};
  const payload = {
    articleKey: asTrimmedString(ctx.articleKey),
    context: {
      lang: asTrimmedString(ctx.lang),
      version: asTrimmedString(ctx.version),
      location: asTrimmedString(ctx.location)
    },
    body: asTrimmedString(body)
  };
  const reply = asTrimmedString(replyToId);
  if (reply) payload.replyToId = reply;
  return payload;
}

function appendParams(url, params) {
  const target = new URL(url);
  Object.entries(params || {}).forEach(([key, value]) => {
    const str = asTrimmedString(value);
    if (str) target.searchParams.set(key, str);
  });
  return target.toString();
}

export function buildAnnotateCommentsUrl(config, context) {
  const normalized = asObject(config) || {};
  const repo = asObject(normalized.repository) || {};
  return appendParams(`${trimTrailingSlash(normalized.connectBaseUrl)}/api/annotate/comments`, {
    owner: repo.owner,
    repo: repo.name,
    category: normalized.discussionCategory,
    articleKey: context && context.articleKey,
    lang: context && context.lang,
    version: context && context.version,
    location: context && context.location
  });
}

function getGrantStorageKey(config) {
  const repo = (config && config.repository) || {};
  return `${GRANT_STORAGE_PREFIX}${repo.owner || ''}/${repo.name || ''}`;
}

function readStoredGrant(windowRef, config) {
  try {
    const raw = windowRef.localStorage.getItem(getGrantStorageKey(config));
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return normalizeGrantToken(parsed && parsed.grant);
  } catch (_) {
    return '';
  }
}

function writeStoredGrant(windowRef, config, grant) {
  try {
    const token = normalizeGrantToken(grant);
    if (!token) return;
    windowRef.localStorage.setItem(getGrantStorageKey(config), JSON.stringify({ grant: token, savedAt: Date.now() }));
  } catch (_) {}
}

function clearStoredGrant(windowRef, config) {
  try { windowRef.localStorage.removeItem(getGrantStorageKey(config)); } catch (_) {}
}

export function normalizeGrantToken(grant) {
  if (typeof grant === 'string') return grant.trim();
  if (asObject(grant)) return asTrimmedString(grant.token);
  return '';
}

function injectAnnotateStyle(documentRef) {
  try {
    if (!documentRef || documentRef.getElementById(STYLE_ID)) return;
    const style = documentRef.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.press-annotate{margin:3rem 0 0;padding:1.25rem 0;border-top:1px solid color-mix(in srgb,currentColor 14%,transparent);font:inherit;color:inherit}
.press-annotate__bar{display:flex;gap:.5rem;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 1rem}
.press-annotate__title{margin:0;font-size:1.1rem;line-height:1.3}
.press-annotate__actions{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.press-annotate button{font:inherit;border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:transparent;color:inherit;border-radius:6px;padding:.45rem .7rem;cursor:pointer}
.press-annotate button:disabled{opacity:.55;cursor:not-allowed}
.press-annotate textarea{box-sizing:border-box;width:100%;min-height:5.5rem;margin:.5rem 0;padding:.65rem;border:1px solid color-mix(in srgb,currentColor 22%,transparent);border-radius:6px;background:transparent;color:inherit;font:inherit;resize:vertical}
.press-annotate__status{margin:.4rem 0;color:color-mix(in srgb,currentColor 70%,transparent);font-size:.9rem}
.press-annotate__list{display:grid;gap:1rem;margin:1rem 0}
.press-annotate__comment{border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:8px;padding:.85rem}
.press-annotate__meta{display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap;margin:0 0 .35rem;font-size:.9rem;color:color-mix(in srgb,currentColor 72%,transparent)}
.press-annotate__author{font-weight:700;color:inherit}
.press-annotate__body{white-space:pre-wrap;line-height:1.6}
.press-annotate__replies{display:grid;gap:.65rem;margin:.8rem 0 0;padding-left:1rem;border-left:2px solid color-mix(in srgb,currentColor 12%,transparent)}
.press-annotate__reply-form{margin-top:.7rem}
`;
    documentRef.head.appendChild(style);
  } catch (_) {}
}

function removeExistingSection(container) {
  try {
    const existing = container.querySelector(`#${ANNOTATE_SECTION_ID}`);
    if (existing) existing.remove();
  } catch (_) {}
}

function createText(documentRef, tagName, className, text) {
  const el = documentRef.createElement(tagName);
  if (className) el.className = className;
  if (text != null) el.textContent = String(text);
  return el;
}

function renderCommentBody(documentRef, comment) {
  return createText(documentRef, 'div', 'press-annotate__body', comment && comment.bodyText ? comment.bodyText : comment && comment.body ? comment.body : '');
}

function renderCommentMeta(documentRef, comment) {
  const meta = createText(documentRef, 'div', 'press-annotate__meta', '');
  const author = createText(documentRef, 'span', 'press-annotate__author', (comment && comment.author && comment.author.login) || 'GitHub user');
  meta.appendChild(author);
  if (comment && comment.url) {
    const link = createText(documentRef, 'a', '', 'GitHub');
    link.href = comment.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    meta.appendChild(link);
  }
  return meta;
}

function renderComments(documentRef, list, comments, state, renderForm) {
  list.textContent = '';
  const items = Array.isArray(comments) ? comments : [];
  if (!items.length) {
    list.appendChild(createText(documentRef, 'p', 'press-annotate__status', 'No comments yet.'));
    return;
  }
  items.forEach((comment) => {
    const item = documentRef.createElement('article');
    item.className = 'press-annotate__comment';
    item.appendChild(renderCommentMeta(documentRef, comment));
    item.appendChild(renderCommentBody(documentRef, comment));
    const replies = Array.isArray(comment && comment.replies) ? comment.replies : [];
    if (replies.length) {
      const replyList = documentRef.createElement('div');
      replyList.className = 'press-annotate__replies';
      replies.forEach((reply) => {
        const replyItem = documentRef.createElement('article');
        replyItem.className = 'press-annotate__reply';
        replyItem.appendChild(renderCommentMeta(documentRef, reply));
        replyItem.appendChild(renderCommentBody(documentRef, reply));
        replyList.appendChild(replyItem);
      });
      item.appendChild(replyList);
    }
    item.appendChild(renderForm(comment && comment.id));
    list.appendChild(item);
  });
}

export function mountAnnotateComments(options = {}) {
  const documentRef = options.document || (typeof document !== 'undefined' ? document : null);
  const windowRef = options.window || (typeof window !== 'undefined' ? window : null);
  const container = options.container;
  if (!documentRef || !windowRef || !container) return null;
  removeExistingSection(container);
  if (!isAnnotateEnabled(options.siteConfig)) return null;

  const config = normalizeAnnotateConfig(options.siteConfig);
  const context = asObject(options.context) || {};
  if (!context.articleKey || !context.location) return null;
  const fetchImpl = options.fetchImpl || windowRef.fetch;
  if (typeof fetchImpl !== 'function') return null;

  injectAnnotateStyle(documentRef);
  const section = documentRef.createElement('section');
  section.id = ANNOTATE_SECTION_ID;
  section.className = 'press-annotate';
  section.setAttribute('aria-label', 'Comments');

  const title = createText(documentRef, 'h2', 'press-annotate__title', 'Comments');
  const status = createText(documentRef, 'p', 'press-annotate__status', '');
  const actions = documentRef.createElement('div');
  actions.className = 'press-annotate__actions';
  const loginButton = createText(documentRef, 'button', '', 'Sign in with GitHub');
  const refreshButton = createText(documentRef, 'button', '', 'Refresh');
  actions.appendChild(loginButton);
  actions.appendChild(refreshButton);

  const bar = documentRef.createElement('div');
  bar.className = 'press-annotate__bar';
  bar.appendChild(title);
  bar.appendChild(actions);
  section.appendChild(bar);

  const list = documentRef.createElement('div');
  list.className = 'press-annotate__list';
  section.appendChild(list);

  const state = {
    grant: readStoredGrant(windowRef, config),
    comments: []
  };

  function setStatus(message) {
    status.textContent = message || '';
    if (message && !status.parentNode) section.insertBefore(status, list);
    if (!message && status.parentNode) status.remove();
  }

  async function postComment(body, replyToId) {
    if (!state.grant) {
      setStatus('Sign in with GitHub before commenting.');
      return false;
    }
    const payload = {
      repository: config.repository,
      category: config.discussionCategory,
      ...buildAnnotateCommentPayload({ context, body, replyToId })
    };
    const response = await fetchImpl(`${config.connectBaseUrl}/api/annotate/comments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${state.grant}`
      },
      body: JSON.stringify(payload)
    });
    if (response.status === 401) {
      clearStoredGrant(windowRef, config);
      state.grant = '';
      setStatus('Session expired. Sign in again.');
      return false;
    }
    if (!response.ok) {
      setStatus('Comment failed to post.');
      return false;
    }
    setStatus('');
    await loadComments();
    return true;
  }

  function renderForm(replyToId) {
    const form = documentRef.createElement('form');
    form.className = replyToId ? 'press-annotate__reply-form' : 'press-annotate__form';
    const textarea = documentRef.createElement('textarea');
    textarea.placeholder = replyToId ? 'Write a reply...' : 'Write a comment...';
    const submit = createText(documentRef, 'button', '', replyToId ? 'Reply' : 'Comment');
    submit.type = 'submit';
    form.appendChild(textarea);
    form.appendChild(submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body) return;
      submit.disabled = true;
      try {
        const ok = await postComment(body, replyToId);
        if (ok) textarea.value = '';
      } finally {
        submit.disabled = false;
      }
    });
    return form;
  }

  async function loadComments() {
    setStatus('Loading comments...');
    try {
      const response = await fetchImpl(buildAnnotateCommentsUrl(config, context), { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.comments = Array.isArray(data && data.comments) ? data.comments : [];
      renderComments(documentRef, list, state.comments, state, renderForm);
      setStatus('');
    } catch (_) {
      list.textContent = '';
      setStatus('Unable to load comments.');
    }
  }

  loginButton.addEventListener('click', () => {
    const origin = windowRef.location && windowRef.location.origin ? windowRef.location.origin : '';
    const url = appendParams(`${config.connectBaseUrl}/github/annotate/start`, {
      origin,
      owner: config.repository.owner,
      repo: config.repository.name,
      category: config.discussionCategory,
      articleKey: context.articleKey
    });
    const popup = windowRef.open(url, 'press-annotate-login', 'popup,width=520,height=720');
    if (!popup) setStatus('Allow popups to sign in with GitHub.');
  });

  refreshButton.addEventListener('click', () => { loadComments(); });

  windowRef.addEventListener('message', (event) => {
    const expected = config.connectBaseUrl;
    if (event.origin !== expected) return;
    const data = event.data || {};
    if (data.source !== 'ekily-connect' || data.type !== 'press-annotate-grant') return;
    const grantToken = normalizeGrantToken(data.grant);
    if (!data.ok || !grantToken) {
      setStatus('GitHub sign in failed.');
      return;
    }
    state.grant = grantToken;
    writeStoredGrant(windowRef, config, state.grant);
    setStatus('Signed in with GitHub.');
  });

  section.appendChild(renderForm(''));
  container.appendChild(section);
  loadComments();
  return section;
}
