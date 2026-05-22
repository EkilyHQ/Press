import assert from 'node:assert/strict';

import { createComposerUnsyncedSummaryController } from '../assets/js/composer-unsynced-summary.js';

function createClassList(owner) {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
      owner.className = Array.from(values).join(' ');
    },
    remove(value) {
      values.delete(value);
      owner.className = Array.from(values).join(' ');
    },
    contains(value) {
      return values.has(value);
    },
    toggle(value, force) {
      const next = typeof force === 'boolean' ? force : !values.has(value);
      if (next) this.add(value);
      else this.remove(value);
      return next;
    }
  };
}

function createElement(tagName = 'div') {
  const attributes = new Map();
  const element = {
    tagName: String(tagName || 'div').toUpperCase(),
    className: '',
    textContent: '',
    hidden: false,
    style: {},
    dataset: {},
    children: [],
    parentElement: null,
    classList: null,
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    querySelector(selector) {
      if (selector === '.mode-tab-badge') {
        return this.children.find(child => String(child.className || '').split(/\s+/).includes('mode-tab-badge')) || null;
      }
      return null;
    },
    setAttribute(name, value) {
      attributes.set(String(name), String(value));
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        this.dataset[key] = String(value);
      }
    },
    getAttribute(name) {
      return attributes.has(String(name)) ? attributes.get(String(name)) : null;
    },
    removeAttribute(name) {
      attributes.delete(String(name));
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        delete this.dataset[key];
      }
    }
  };
  element.classList = createClassList(element);
  return element;
}

function createModeButton(mode, label) {
  const button = createElement('button');
  button.setAttribute('data-mode', mode);
  button.setAttribute('data-tab-label', label);
  button.textContent = label;
  return button;
}

function createDocumentRef() {
  const modeButtons = new Map([
    ['composer', createModeButton('composer', 'Site')],
    ['editor', createModeButton('editor', 'Editor')],
    ['themes', createModeButton('themes', 'Themes')],
    ['updates', createModeButton('updates', 'Updates')]
  ]);
  const byId = new Map([
    ['btnReview', createElement('button')],
    ['btnDiscard', createElement('button')]
  ]);
  return {
    modeButtons,
    byId,
    createElement,
    getElementById(id) {
      return byId.get(id) || null;
    },
    querySelector(selector) {
      const match = String(selector || '').match(/data-mode="([^"]+)"/);
      if (match) return modeButtons.get(match[1]) || null;
      return null;
    }
  };
}

const documentRef = createDocumentRef();
const importedAssets = [];
const importedDeletions = [];
const draftStore = {
  'post/saved/b.md': { content: 'Saved B', assets: ['b.png'], deletedAssets: ['old-b.png'] },
  'post/empty.md': { content: '', assets: ['ignored.png'] }
};
const deletionCounts = new Map([
  ['post/dirty/a.md', 1],
  ['post/saved/b.md', 2]
]);
const assetCounts = new Map([
  ['post/dirty/a.md', 3],
  ['post/saved/b.md', 1]
]);
const dynamicTabs = new Map([
  ['md-1', { path: 'post/dirty/a.md', isDirty: true, draftConflict: false }],
  ['md-2', { path: 'post/clean.md', isDirty: false }]
]);
const diffCache = {
  index: {
    hasChanges: true,
    orderChanged: true,
    keys: { article: { state: 'modified' } },
    addedKeys: [],
    removedKeys: []
  },
  tabs: {
    hasChanges: false,
    orderChanged: false,
    keys: {},
    addedKeys: [],
    removedKeys: []
  },
  site: {
    hasChanges: true
  }
};

let inlineMetaRefreshes = 0;
let syncPanelSchedules = 0;
let editorTreeRefreshes = 0;

const controller = createComposerUnsyncedSummaryController({
  documentRef,
  getDynamicEditorTabs: () => dynamicTabs,
  normalizeRelPath: (value) => String(value || '').replace(/\\/g, '/').replace(/^\/+/, ''),
  normalizeMarkdownContent: (value) => String(value || ''),
  hasMarkdownDraftContent: (tab) => !!tab.localDraft,
  readMarkdownDraftStore: () => draftStore,
  importMarkdownAssetsForPath: (path, assets) => importedAssets.push([path, assets]),
  importMarkdownAssetDeletionsForPath: (path, deletions) => importedDeletions.push([path, deletions]),
  countMarkdownAssets: (path) => assetCounts.get(path) || 0,
  countMarkdownAssetDeletions: (path) => deletionCounts.get(path) || 0,
  listMarkdownAssetDeletions: () => [{ kind: 'asset-delete', label: 'old asset' }],
  getComposerDiffCache: () => diffCache,
  getStagingSummaryEntries: () => [
    { kind: 'system', label: 'Press update' },
    { kind: 'system', category: 'theme', label: 'Theme update' }
  ],
  getActiveComposerFile: () => 'index',
  getComposerDraftMeta: (kind) => (kind === 'index' ? { savedAt: 1 } : null),
  refreshEditorContentTree: () => {
    editorTreeRefreshes += 1;
  },
  shouldPreserveEditorStructure: () => true,
  refreshComposerInlineMeta: () => {
    inlineMetaRefreshes += 1;
  },
  scheduleSyncCommitPanelRefresh: () => {
    syncPanelSchedules += 1;
  }
});

const markdownEntries = controller.collectUnsyncedMarkdownEntries();
assert.deepEqual(
  markdownEntries.map(entry => [entry.path, entry.state, entry.assetCount || 0, entry.assetDeletionCount || 0]),
  [
    ['post/dirty/a.md', 'dirty', 3, 1],
    ['post/saved/b.md', 'saved', 1, 2]
  ],
  'markdown summary should include dirty dynamic tabs and saved draft-store entries with asset counts'
);
assert.deepEqual(importedAssets, [['post/saved/b.md', ['b.png']], ['post/empty.md', ['ignored.png']]]);
assert.deepEqual(importedDeletions, [['post/saved/b.md', ['old-b.png']], ['post/empty.md', []]]);

const summary = controller.computeUnsyncedSummary();
assert.deepEqual(
  summary.map(entry => entry.kind),
  ['index', 'site', 'system', 'system', 'markdown', 'markdown', 'asset-delete'],
  'summary should aggregate YAML diffs, staged system/theme entries, markdown drafts, and asset deletions'
);

const updateSummary = controller.updateUnsyncedSummary({ reason: 'test' });
assert.equal(updateSummary.length, summary.length, 'updateUnsyncedSummary should return the current summary entries');
assert.equal(inlineMetaRefreshes, 1, 'summary update should refresh inline diff metadata');
assert.equal(syncPanelSchedules, 1, 'summary update should schedule the sync commit panel refresh');
assert.equal(editorTreeRefreshes, 1, 'summary update should refresh editor tree badge state');

const composerButton = documentRef.modeButtons.get('composer');
const editorButton = documentRef.modeButtons.get('editor');
const themesButton = documentRef.modeButtons.get('themes');
const updatesButton = documentRef.modeButtons.get('updates');
assert.equal(composerButton.dataset.badgeCount, '2', 'composer badge should count index/tabs/site entries');
assert.equal(editorButton.dataset.badgeCount, '2', 'editor badge should count markdown entries');
assert.equal(themesButton.dataset.badgeCount, '1', 'themes badge should count theme system entries');
assert.equal(updatesButton.dataset.badgeCount, '1', 'updates badge should count non-theme system entries');
assert.equal(editorButton.querySelector('.mode-tab-badge').textContent, '2');
assert.equal(editorButton.getAttribute('aria-label'), 'Editor (2 pending changes)');

const reviewButton = documentRef.getElementById('btnReview');
assert.equal(reviewButton.hidden, false, 'review button should show for the active changed YAML file');
assert.equal(reviewButton.dataset.kind, 'index');
assert.equal(reviewButton.getAttribute('aria-label'), 'Review changes for index.yaml');

const discardButton = documentRef.getElementById('btnDiscard');
assert.equal(discardButton.hidden, false, 'discard button should show when active YAML file has changes or draft metadata');
assert.equal(discardButton.getAttribute('aria-hidden'), 'false');

const siteDocumentRef = createDocumentRef();
const siteController = createComposerUnsyncedSummaryController({
  documentRef: siteDocumentRef,
  getComposerDiffCache: () => ({ site: { hasChanges: true } }),
  getActiveComposerFile: () => 'site'
});
siteController.updateUnsyncedSummary();
assert.equal(siteDocumentRef.getElementById('btnReview').hidden, true, 'site.yaml changes should not expose the index/tabs review modal');
