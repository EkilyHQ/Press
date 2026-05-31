import {
  fetchSiteLocalOverride,
  fetchTrackedSiteConfig,
  mergeYamlConfig,
  resolveSiteRepoConfig
} from './yaml.js';
import { PRESS_GITHUB_SITE_PROVIDER } from './provider-adapters.js';

export function inferRepoConfigFromGitHubPagesUrl(locationLike) {
  return PRESS_GITHUB_SITE_PROVIDER.inferRepositoryFromPublishedUrl(locationLike);
}

export function isPlaceholderRepoConfig(repo) {
  const source = repo && typeof repo === 'object' ? repo : {};
  const owner = String(source.owner || '').trim();
  const name = String(source.name || '').trim();
  const ownerIsPlaceholder = owner === '' || owner === 'OWNER';
  const nameIsPlaceholder = name === '' || name === 'REPOSITORY';
  return ownerIsPlaceholder && nameIsPlaceholder;
}

export function isSameRepoConfig(repo, inferred) {
  const source = repo && typeof repo === 'object' ? repo : {};
  const inferredSource = inferred && typeof inferred === 'object' ? inferred : {};
  const owner = String(source.owner || '').trim().toLowerCase();
  const name = String(source.name || '').trim().toLowerCase();
  const inferredOwner = String(inferredSource.owner || '').trim().toLowerCase();
  const inferredName = String(inferredSource.name || '').trim().toLowerCase();
  return !!owner && !!name && owner === inferredOwner && name === inferredName;
}

export function shouldAutofillRepoFromPages(site) {
  const extras = site && site.__extras && typeof site.__extras === 'object' ? site.__extras : {};
  const value = extras.repoAutofillFromPages;
  return value === true || String(value || '').trim().toLowerCase() === 'true';
}

export function clearRepoAutofillFromPagesMarker(site) {
  if (!site.__extras || typeof site.__extras !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(site.__extras, 'repoAutofillFromPages')) {
    delete site.__extras.repoAutofillFromPages;
  }
}

export function applyInferredRepoConfig(site, inferred) {
  if (!site || typeof site !== 'object') return false;
  if (!inferred || typeof inferred !== 'object') return false;
  const owner = String(inferred.owner || '').trim();
  const name = String(inferred.name || '').trim();
  const branch = String(inferred.branch || 'main').trim() || 'main';
  if (!owner || !name) return false;

  const repo = site.repo && typeof site.repo === 'object' ? site.repo : {};
  const canAutofill = isPlaceholderRepoConfig(repo)
    || (shouldAutofillRepoFromPages(site) && !isSameRepoConfig(repo, inferred));
  if (!canAutofill) return false;

  const previousOwner = String(repo.owner || '').trim();
  const previousName = String(repo.name || '').trim();
  const previousBranch = String(repo.branch || '').trim();
  site.repo = repo;
  repo.owner = owner;
  repo.name = name;
  if (!previousBranch) repo.branch = branch;
  clearRepoAutofillFromPagesMarker(site);

  return previousOwner !== String(repo.owner || '').trim()
    || previousName !== String(repo.name || '').trim()
    || previousBranch !== String(repo.branch || '').trim();
}

export function createComposerSiteConfigController(options = {}) {
  const runtime = options.runtime || null;
  const setContentRoot = typeof options.setContentRoot === 'function'
    ? options.setContentRoot
    : (runtime && typeof runtime.setContentRoot === 'function' ? runtime.setContentRoot : (root) => root);
  const setSiteRepo = typeof options.setSiteRepo === 'function'
    ? options.setSiteRepo
    : (runtime && typeof runtime.setSiteRepo === 'function' ? runtime.setSiteRepo : (repo) => repo);
  const emitSiteConfigChange = typeof options.emitSiteConfigChange === 'function'
    ? options.emitSiteConfigChange
    : (runtime && typeof runtime.emitSiteConfigChange === 'function' ? runtime.emitSiteConfigChange : () => false);
  const cloneValue = typeof options.deepClone === 'function'
    ? options.deepClone
    : (value) => JSON.parse(JSON.stringify(value));
  let siteLocalOverride = {};

  function applyEffectiveSiteConfig(siteConfig) {
    const tracked = siteConfig && typeof siteConfig === 'object' ? siteConfig : {};
    const effective = mergeYamlConfig(tracked, siteLocalOverride);
    const root = (effective && effective.contentRoot) ? String(effective.contentRoot) : 'wwwroot';
    setContentRoot(root);
    try {
      const repo = (effective && effective.repo) || {};
      setSiteRepo({
        owner: String(repo.owner || ''),
        name: String(repo.name || ''),
        branch: String(repo.branch || 'main')
      });
    } catch (_) {
      try {
        setSiteRepo({ owner: '', name: '', branch: 'main' });
      } catch (_) {}
    }
    emitSiteConfigChange(cloneValue(effective));
    return effective;
  }

  async function fetchTrackedComposerSiteConfig() {
    const tracked = await fetchTrackedSiteConfig();
    siteLocalOverride = await fetchSiteLocalOverride();
    applyEffectiveSiteConfig(tracked || {});
    return tracked || {};
  }

  function resolveActiveSiteRepoConfig(site, fallback) {
    return resolveSiteRepoConfig(site, siteLocalOverride, fallback);
  }

  return {
    applyEffectiveSiteConfig,
    fetchTrackedSiteConfig: fetchTrackedComposerSiteConfig,
    getSiteLocalOverride: () => siteLocalOverride,
    resolveActiveSiteRepoConfig
  };
}
