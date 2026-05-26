import assert from 'node:assert/strict';
import {
  GITHUB_PROVIDER_ID,
  PRESS_GITHUB_PROVIDER,
  createGitHubPressProvider
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

console.log('ok - provider adapters');
