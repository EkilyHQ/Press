import assert from 'node:assert/strict';
import {
  GITHUB_PROVIDER_ID,
  PRESS_GITHUB_PROVIDER,
  PRESS_GITHUB_SITE_PROVIDER,
  createGitHubPressProvider,
  createGitHubSiteRepositoryProvider
} from '../assets/js/provider-adapters.js';

assert.equal(PRESS_GITHUB_PROVIDER.id, GITHUB_PROVIDER_ID);
assert.equal(
  PRESS_GITHUB_PROVIDER.systemReleaseUrl,
  'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/system-release.json'
);
assert.equal(
  PRESS_GITHUB_PROVIDER.productStateUrl,
  'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/product-state.json'
);
assert.equal(
  PRESS_GITHUB_PROVIDER.releaseIntentUrl,
  'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/release-intent.json'
);
assert.equal(
  PRESS_GITHUB_PROVIDER.latestReleaseApiUrl,
  'https://api.github.com/repos/EkilyHQ/Press/releases/latest'
);
assert.equal(
  PRESS_GITHUB_PROVIDER.latestReleasePageUrl,
  'https://github.com/EkilyHQ/Press/releases/latest'
);
assert.equal(
  PRESS_GITHUB_PROVIDER.themeCatalogUrl,
  'https://raw.githubusercontent.com/EkilyHQ/Press-Theme-Catalog/main/catalog.json'
);
assert.equal(
  PRESS_GITHUB_PROVIDER.buildPressArtifactUrl('v3.4.64/press-system-v3.4.64.zip'),
  'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.4.64/press-system-v3.4.64.zip'
);
assert.equal(
  PRESS_GITHUB_PROVIDER.isCanonicalSystemUpdateAssetUrl(
    'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.4.64/press-system-v3.4.64.zip'
  ),
  true
);
assert.equal(
  PRESS_GITHUB_PROVIDER.isCanonicalSystemUpdateAssetUrl(
    'https://raw.githubusercontent.com/EkilyHQ/Press/release-artifacts/v3.4.64/press-system-v3.4.63.zip'
  ),
  false
);
assert.equal(
  PRESS_GITHUB_PROVIDER.isCanonicalSystemUpdateAssetUrl(
    'https://github.com/EkilyHQ/Press/releases/download/v3.4.64/press-system-v3.4.64.zip'
  ),
  false
);
assert.equal(
  PRESS_GITHUB_PROVIDER.isCanonicalSystemUpdateAssetUrl(
    'https://raw.githubusercontent.com/Other/Press/release-artifacts/v3.4.64/press-system-v3.4.64.zip'
  ),
  false
);

const custom = createGitHubPressProvider({
  pressRepository: 'Example/Press',
  themeCatalogRepository: 'Example/Theme-Catalog',
  releaseArtifactsRef: 'published',
  themeCatalogRef: 'stable',
  rawBaseUrl: 'https://raw.example.test/',
  apiBaseUrl: 'https://api.example.test/',
  webBaseUrl: 'https://git.example.test/'
});
assert.equal(custom.systemReleaseUrl, 'https://raw.example.test/Example/Press/published/system-release.json');
assert.equal(custom.latestReleaseApiUrl, 'https://api.example.test/repos/Example/Press/releases/latest');
assert.equal(custom.latestReleasePageUrl, 'https://git.example.test/Example/Press/releases/latest');
assert.equal(custom.themeCatalogUrl, 'https://raw.example.test/Example/Theme-Catalog/stable/catalog.json');
assert.equal(
  custom.isCanonicalSystemUpdateAssetUrl(
    'https://raw.example.test/Example/Press/published/v1.2.3/press-system-v1.2.3.zip'
  ),
  true
);
assert.equal(Object.isFrozen(custom), true);

const pathfulApiProvider = createGitHubPressProvider({
  apiBaseUrl: 'https://ghe.example.test/api/v3',
  rawBaseUrl: 'https://raw.example.test',
  webBaseUrl: 'https://ghe.example.test',
  pressRepository: 'Example/Press',
  themeCatalogRepository: 'Example/Theme-Catalog'
});
assert.equal(
  pathfulApiProvider.latestReleaseApiUrl,
  'https://ghe.example.test/api/v3/repos/Example/Press/releases/latest'
);

assert.equal(PRESS_GITHUB_SITE_PROVIDER.id, GITHUB_PROVIDER_ID);
assert.equal(PRESS_GITHUB_SITE_PROVIDER.apiBaseUrl, 'https://api.github.com');
assert.equal(PRESS_GITHUB_SITE_PROVIDER.webBaseUrl, 'https://github.com');
assert.equal(PRESS_GITHUB_SITE_PROVIDER.graphqlApiUrl, 'https://api.github.com/graphql');
assert.deepEqual(
  PRESS_GITHUB_SITE_PROVIDER.inferRepositoryFromPublishedUrl('https://deemoe404.github.io/test1/index_editor.html'),
  { owner: 'deemoe404', name: 'test1', branch: 'main' }
);
assert.deepEqual(
  PRESS_GITHUB_SITE_PROVIDER.inferRepositoryFromPublishedUrl('https://deemoe404.github.io/index.html'),
  { owner: 'deemoe404', name: 'deemoe404.github.io', branch: 'main' }
);
assert.equal(
  PRESS_GITHUB_SITE_PROVIDER.inferRepositoryFromPublishedUrl('http://deemoe404.github.io/test1/index_editor.html'),
  null
);
assert.deepEqual(
  PRESS_GITHUB_SITE_PROVIDER.normalizeRepositoryConfig({ owner: ' EkilyHQ ', name: ' Press ', branch: 'refs/heads/main' }),
  { owner: 'EkilyHQ', name: 'Press', branch: 'main' }
);
assert.equal(
  PRESS_GITHUB_SITE_PROVIDER.normalizeRepositoryPath('/wwwroot/post/alpha/../beta/en.md'),
  'wwwroot/post/beta/en.md'
);
assert.equal(
  PRESS_GITHUB_SITE_PROVIDER.encodeRepositoryPath('wwwroot/post/hello world/en.md'),
  'wwwroot/post/hello%20world/en.md'
);
assert.equal(
  PRESS_GITHUB_SITE_PROVIDER.buildNewFileUrl({
    repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
    folderPath: 'wwwroot/post/hello world',
    filename: 'en draft.md'
  }),
  'https://github.com/EkilyHQ/Press/new/main/wwwroot/post/hello%20world?filename=en%20draft.md'
);
assert.equal(
  PRESS_GITHUB_SITE_PROVIDER.buildEditFileUrl({
    repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' },
    filePath: 'wwwroot/post/hello world/en.md'
  }),
  'https://github.com/EkilyHQ/Press/edit/main/wwwroot/post/hello%20world/en.md'
);
assert.deepEqual(
  PRESS_GITHUB_SITE_PROVIDER.buildGraphqlHeaders(' pat-token '),
  {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer pat-token',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
);

const customSite = createGitHubSiteRepositoryProvider({
  apiBaseUrl: 'https://api.git.example.test/',
  webBaseUrl: 'https://git.example.test/'
});
assert.equal(customSite.graphqlApiUrl, 'https://api.git.example.test/graphql');
assert.equal(
  customSite.buildEditFileUrl({
    repo: { owner: 'Example', name: 'Site', branch: 'docs/main' },
    filePath: '/wwwroot/index.yaml'
  }),
  'https://git.example.test/Example/Site/edit/docs%2Fmain/wwwroot/index.yaml'
);
assert.equal(Object.isFrozen(customSite), true);

const pathfulApiSite = createGitHubSiteRepositoryProvider({
  apiBaseUrl: 'https://ghe.example.test/api'
});
assert.equal(pathfulApiSite.apiBaseUrl, 'https://ghe.example.test/api');
assert.equal(pathfulApiSite.graphqlApiUrl, 'https://ghe.example.test/api/graphql');

const explicitGraphqlSite = createGitHubSiteRepositoryProvider({
  apiBaseUrl: 'https://ghe.example.test/api/v3',
  graphqlApiUrl: 'https://ghe.example.test/api/graphql/'
});
assert.equal(explicitGraphqlSite.apiBaseUrl, 'https://ghe.example.test/api/v3');
assert.equal(explicitGraphqlSite.graphqlApiUrl, 'https://ghe.example.test/api/graphql');

const ghesRestSite = createGitHubSiteRepositoryProvider({
  apiBaseUrl: 'https://ghe.example.test/api/v3'
});
assert.equal(ghesRestSite.apiBaseUrl, 'https://ghe.example.test/api/v3');
assert.equal(ghesRestSite.graphqlApiUrl, 'https://ghe.example.test/api/graphql');

const nestedGhesRestSite = createGitHubSiteRepositoryProvider({
  apiBaseUrl: 'https://ghe.example.test/custom/api/v3'
});
assert.equal(nestedGhesRestSite.graphqlApiUrl, 'https://ghe.example.test/custom/api/graphql');

console.log('ok - provider adapters');
