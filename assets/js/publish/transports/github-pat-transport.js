function encodeContentToBase64(text) {
  const input = String(text == null ? '' : text);
  if (typeof window !== 'undefined' && typeof window.TextEncoder === 'function') {
    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(input);
      const chunkSize = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const slice = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, slice);
      }
      return btoa(binary);
    } catch (_) {
      /* fall through to fallback */
    }
  }
  try {
    return btoa(unescape(encodeURIComponent(input)));
  } catch (_) {
    let binary = '';
    for (let i = 0; i < input.length; i += 1) {
      const code = input.charCodeAt(i);
      if (code > 0xFF) {
        binary += String.fromCharCode(code >> 8, code & 0xFF);
      } else {
        binary += String.fromCharCode(code);
      }
    }
    return btoa(binary);
  }
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

export async function githubGraphqlRequest(token, query, variables = {}, fetchImpl = fetch) {
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) throw new Error('GitHub token is required.');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${trimmedToken}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const body = JSON.stringify({ query, variables });
  let response;
  try {
    response = await fetchImpl('https://api.github.com/graphql', { method: 'POST', headers, body });
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

export async function createFineGrainedTokenCommit(token, { owner, name, branch, headline, files, onStatus } = {}) {
  const reportStatus = typeof onStatus === 'function' ? onStatus : () => {};
  const branchRef = String(branch || '').startsWith('refs/') ? branch : `refs/heads/${branch}`;
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
  const headData = await githubGraphqlRequest(token, headQuery, { owner, name, ref: branchRef });
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
    branch: { repositoryNameWithOwner: `${owner}/${name}`, branchName: branch },
    message: { headline },
    expectedHeadOid,
    fileChanges
  };

  reportStatus('Creating commit...');
  await githubGraphqlRequest(token, commitMutation, { input: mutationInput });
}
