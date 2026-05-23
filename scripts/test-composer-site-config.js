import assert from 'node:assert/strict';
import {
  applyInferredRepoConfig,
  createComposerSiteConfigController,
  inferRepoConfigFromGitHubPagesUrl,
  isPlaceholderRepoConfig
} from '../assets/js/composer-site-config.js';

assert.deepEqual(
  inferRepoConfigFromGitHubPagesUrl('https://deemoe404.github.io/test1/index_editor.html'),
  { owner: 'deemoe404', name: 'test1', branch: 'main' },
  'project Pages editor URLs should infer owner and repository'
);

assert.deepEqual(
  inferRepoConfigFromGitHubPagesUrl('https://deemoe404.github.io/index_editor.html'),
  { owner: 'deemoe404', name: 'deemoe404.github.io', branch: 'main' },
  'user Pages root editor URLs should infer the user-site repository'
);

assert.equal(
  inferRepoConfigFromGitHubPagesUrl('http://localhost:8000/index_editor.html'),
  null,
  'non-GitHub Pages URLs should not infer repository config'
);

assert.equal(isPlaceholderRepoConfig({ owner: 'OWNER', name: 'REPOSITORY' }), true);
assert.equal(isPlaceholderRepoConfig({ owner: 'EkilyHQ', name: 'Press' }), false);

{
  const site = { repo: { owner: 'OWNER', name: 'REPOSITORY' }, __extras: { repoAutofillFromPages: true } };
  assert.equal(
    applyInferredRepoConfig(site, { owner: 'deemoe404', name: 'test1', branch: 'main' }),
    true,
    'placeholder repository config should be replaced by Pages inference'
  );
  assert.deepEqual(site.repo, { owner: 'deemoe404', name: 'test1', branch: 'main' });
  assert.deepEqual(site.__extras, {}, 'repo autofill marker should be removed after applying inference');
}

{
  const site = { repo: { owner: 'EkilyHQ', name: 'Press', branch: 'main' } };
  assert.equal(
    applyInferredRepoConfig(site, { owner: 'deemoe404', name: 'test1', branch: 'main' }),
    false,
    'real configured repositories should not be overwritten'
  );
  assert.deepEqual(site.repo, { owner: 'EkilyHQ', name: 'Press', branch: 'main' });
}

{
  const events = [];
  class TestCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  const windowRef = {
    CustomEvent: TestCustomEvent,
    dispatchEvent(event) {
      events.push(event);
    }
  };
  const controller = createComposerSiteConfigController({
    windowRef,
    deepClone(value) {
      return JSON.parse(JSON.stringify(value));
    }
  });
  const effective = controller.applyEffectiveSiteConfig({
    contentRoot: 'content',
    repo: { owner: 'EkilyHQ', name: 'Press', branch: 'docs' }
  });

  assert.deepEqual(effective.repo, { owner: 'EkilyHQ', name: 'Press', branch: 'docs' });
  assert.equal(windowRef.__press_content_root, 'content');
  assert.deepEqual(windowRef.__press_site_repo, { owner: 'EkilyHQ', name: 'Press', branch: 'docs' });
  assert.equal(events.length, 1, 'effective site config should dispatch one change event');
  assert.equal(events[0].type, 'press-editor-site-config-change');
  assert.deepEqual(events[0].detail.siteConfig, effective);

  assert.deepEqual(
    controller.resolveActiveSiteRepoConfig({}, { owner: 'Fallback', name: 'Repo', branch: '' }),
    { owner: 'Fallback', name: 'Repo', branch: 'main' },
    'repo resolver should preserve fallback semantics when site config is empty'
  );
}
