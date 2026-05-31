import { PRESS_GITHUB_SITE_PROVIDER } from '../../provider-adapters.js';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes) {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    output += BASE64_CHARS[(triplet >> 18) & 63];
    output += BASE64_CHARS[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_CHARS[(triplet >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? BASE64_CHARS[triplet & 63] : '=';
  }
  return output;
}

function encodeUtf8Bytes(text) {
  const input = String(text == null ? '' : text);
  const bytes = [];
  for (let i = 0; i < input.length; i += 1) {
    let codePoint = input.charCodeAt(i);
    if (codePoint >= 0xD800 && codePoint <= 0xDBFF && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      if (low >= 0xDC00 && low <= 0xDFFF) {
        codePoint = 0x10000 + ((codePoint - 0xD800) << 10) + (low - 0xDC00);
        i += 1;
      }
    }
    if (codePoint <= 0x7F) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7FF) {
      bytes.push(0xC0 | (codePoint >> 6));
      bytes.push(0x80 | (codePoint & 0x3F));
    } else if (codePoint <= 0xFFFF) {
      bytes.push(0xE0 | (codePoint >> 12));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
      bytes.push(0x80 | (codePoint & 0x3F));
    } else {
      bytes.push(0xF0 | (codePoint >> 18));
      bytes.push(0x80 | ((codePoint >> 12) & 0x3F));
      bytes.push(0x80 | ((codePoint >> 6) & 0x3F));
      bytes.push(0x80 | (codePoint & 0x3F));
    }
  }
  return bytes;
}

function encodeContentToBase64(text) {
  return bytesToBase64(encodeUtf8Bytes(text));
}

function resolveAmbientFunction(name) {
  try {
    const scope = typeof globalThis === 'object' ? globalThis : null;
    const value = scope ? scope[name] : null;
    return typeof value === 'function' ? value.bind(scope) : null;
  } catch (_) {
    return null;
  }
}

function resolveFetch(fetchImpl) {
  return typeof fetchImpl === 'function' ? fetchImpl : resolveAmbientFunction('fetch');
}

export function buildGithubFileChanges(files) {
  const additions = (Array.isArray(files) ? files : []).filter((file) => !file.deleted).map((file) => {
    const path = String(file.path || '').replace(/^\/+/, '');
    if (file.base64) {
      return { path, contents: String(file.base64) };
    }
    return { path, contents: encodeContentToBase64(file.content || '') };
  });
  const deletions = (Array.isArray(files) ? files : []).filter((file) => file && file.deleted).map((file) => ({
    path: String(file.path || '').replace(/^\/+/, '')
  })).filter((file) => file.path);
  const fileChanges = {};
  if (additions.length) fileChanges.additions = additions;
  if (deletions.length) fileChanges.deletions = deletions;
  if (!additions.length && !deletions.length) throw new Error('No file changes to commit.');
  return fileChanges;
}

function resolveSiteRepositoryProvider(provider) {
  return provider && typeof provider === 'object' ? provider : PRESS_GITHUB_SITE_PROVIDER;
}

export async function githubGraphqlRequest(token, query, variables = {}, fetchImpl = null, siteRepositoryProvider = null) {
  const fetchRef = resolveFetch(fetchImpl);
  const provider = resolveSiteRepositoryProvider(siteRepositoryProvider);
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) throw new Error('GitHub token is required.');
  const headers = typeof provider.buildGraphqlHeaders === 'function'
    ? provider.buildGraphqlHeaders(trimmedToken)
    : PRESS_GITHUB_SITE_PROVIDER.buildGraphqlHeaders(trimmedToken);
  const endpoint = provider.graphqlApiUrl || PRESS_GITHUB_SITE_PROVIDER.graphqlApiUrl;
  const body = JSON.stringify({ query, variables });
  let response;
  try {
    response = await fetchRef(endpoint, { method: 'POST', headers, body });
  } catch (err) {
    const error = new Error('Network error while reaching GitHub.');
    error.cause = err;
    throw error;
  }
  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {
    payload = null;
  }
  if (!response.ok) {
    const error = new Error((payload && payload.message) || `GitHub API error (${response.status})`);
    error.status = response.status;
    error.response = payload;
    throw error;
  }
  if (payload && Array.isArray(payload.errors) && payload.errors.length) {
    const first = payload.errors[0];
    const error = new Error((first && first.message) || 'GitHub GraphQL error.');
    error.status = response.status;
    error.response = payload;
    throw error;
  }
  return payload ? payload.data : null;
}

export async function createFineGrainedTokenCommit(token, { owner, name, branch, headline, files, fetchImpl = null, onStatus, siteRepositoryProvider = null } = {}) {
  const reportStatus = typeof onStatus === 'function' ? onStatus : () => {};
  const provider = resolveSiteRepositoryProvider(siteRepositoryProvider);
  const branchName = typeof provider.normalizeBranchName === 'function'
    ? provider.normalizeBranchName(branch || 'main')
    : PRESS_GITHUB_SITE_PROVIDER.normalizeBranchName(branch || 'main');
  const branchRef = String(branch || '').startsWith('refs/') ? branch : `refs/heads/${branchName}`;
  reportStatus('Fetching repository state...');
  const headQuery = `
    query($owner:String!, $name:String!, $ref:String!) {
      repository(owner:$owner, name:$name) {
        ref(qualifiedName:$ref) {
          target {
            ... on Commit { oid }
          }
        }
      }
    }
  `;
  const headData = await githubGraphqlRequest(token, headQuery, { owner, name, ref: branchRef }, fetchImpl, provider);
  const refInfo = headData && headData.repository && headData.repository.ref;
  const expectedHeadOid = refInfo && refInfo.target && refInfo.target.oid;
  if (!expectedHeadOid) throw new Error('Unable to resolve the branch head on GitHub.');

  reportStatus('Encoding files...');
  const fileChanges = buildGithubFileChanges(files);
  const commitMutation = `
    mutation($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit { oid }
      }
    }
  `;
  const mutationInput = {
    branch: { repositoryNameWithOwner: `${owner}/${name}`, branchName },
    message: { headline },
    expectedHeadOid,
    fileChanges
  };

  reportStatus('Creating commit...');
  const commitData = await githubGraphqlRequest(token, commitMutation, { input: mutationInput }, fetchImpl, provider);
  const createdCommit = commitData && commitData.createCommitOnBranch && commitData.createCommitOnBranch.commit;
  return {
    ok: true,
    provider: 'github',
    transport: 'pat',
    branchName,
    expectedHeadOid,
    commit: createdCommit && createdCommit.oid ? { oid: createdCommit.oid } : null
  };
}
