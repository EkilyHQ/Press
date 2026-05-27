import assert from 'node:assert/strict';

import {
  createComposerSiteSettingsRepoSection,
  ensureComposerSiteSettingsRepo
} from '../assets/js/composer-site-settings-repo-section.js';

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName || 'div').toLowerCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.className = '';
    this.innerHTML = '';
    this.placeholder = '';
    this.spellcheck = true;
    this.textContent = '';
    this.type = '';
    this.value = '';
  }

  appendChild(child) {
    if (!child) return child;
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach(child => this.appendChild(child));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value ?? ''));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatch(type, overrides = {}) {
    const event = { type, target: this, ...overrides };
    (this.listeners.get(type) || []).forEach((handler) => handler(event));
    return event;
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

function collect(node, predicate, found = []) {
  if (!node) return found;
  if (predicate(node)) found.push(node);
  (node.children || []).forEach(child => collect(child, predicate, found));
  return found;
}

function classIncludes(node, className) {
  return String(node.className || '').split(/\s+/).includes(className);
}

{
  const site = {};
  const repo = ensureComposerSiteSettingsRepo(site);
  assert.equal(repo, site.repo);
  assert.deepEqual(repo, { owner: '', name: '', branch: '' });
}

{
  const existing = { owner: 'EkilyHQ', name: 'Press', branch: 'main' };
  const site = { repo: existing };
  assert.equal(ensureComposerSiteSettingsRepo(site), existing);
}

{
  const documentRef = new FakeDocument();
  const createdSections = [];
  let dirtyCount = 0;
  let publishHost = null;
  const result = createComposerSiteSettingsRepoSection({
    documentRef,
    site: {
      repo: {
        owner: 'EkilyHQ',
        name: 'Press',
        branch: 'main'
      }
    },
    siteSettingsSchema: {
      sections: {
        repo: {
          title: 'Repository',
          description: 'Repository metadata'
        }
      }
    },
    createSection: (title, description) => {
      const section = documentRef.createElement('section');
      section.titleText = title;
      section.descriptionText = description;
      createdSections.push(section);
      return section;
    },
    markDirty: () => { dirtyCount += 1; },
    renderPublishTransportSettings: (host) => {
      publishHost = host;
      const marker = documentRef.createElement('div');
      marker.className = 'publish-settings-marker';
      host.appendChild(marker);
    },
    t: key => `t:${key}`
  });

  assert.equal(createdSections.length, 1);
  assert.equal(createdSections[0].titleText, 'Repository');
  assert.equal(createdSections[0].descriptionText, 'Repository metadata');
  assert.equal(result.repoInputs.dataset.field, 'repo');
  assert.equal(publishHost, result.repoSection);
  assert.equal(collect(result.repoSection, node => classIncludes(node, 'publish-settings-marker')).length, 1);

  const inputs = collect(result.repoSection, node => node.tagName === 'input');
  assert.equal(inputs.length, 3);
  assert.deepEqual(inputs.map(input => input.getAttribute('aria-label')), [
    't:editor.composer.site.repoOwner',
    't:editor.composer.site.repoName',
    't:editor.composer.site.repoBranch'
  ]);
  assert.deepEqual(inputs.map(input => input.value), ['EkilyHQ', 'Press', 'main']);

  const fields = collect(result.repoSection, node => classIncludes(node, 'cs-repo-field'));
  assert.deepEqual(fields.map(field => field.dataset.subfield), ['owner', 'name', 'branch']);

  result.ownerInput.value = 'Ekily';
  result.ownerInput.dispatch('input');
  result.nameInput.value = 'YAP';
  result.nameInput.dispatch('input');
  result.branchInput.value = 'demo';
  result.branchInput.dispatch('input');

  assert.deepEqual(result.repo, { owner: 'Ekily', name: 'YAP', branch: 'demo' });
  assert.equal(dirtyCount, 3);
}
