import assert from 'node:assert/strict';

import { createComposerSiteSettingsSingleGrids } from '../assets/js/composer-site-settings-single-grids.js';

{
  const rendered = [];
  const site = {
    avatar: 'assets/avatar.png',
    contentRoot: 'wwwroot',
    resourceURL: 'https://example.test/'
  };
  const section = { id: 'identity' };
  const singleGrids = createComposerSiteSettingsSingleGrids({
    site,
    siteSettingsSchema: {
      fields: {
        identityPaths: [
          { dataKey: 'avatar', label: 'Avatar', placeholder: 'assets/avatar.png' },
          { dataKey: 'contentRoot', label: 'Content root', placeholder: 'wwwroot' }
        ],
        seoResources: [
          { dataKey: 'resourceURL', label: 'Resource URL', placeholder: 'https://example.test/' }
        ]
      }
    },
    renderSingleTextGrid: (target, items) => {
      rendered.push({ target, items });
    }
  });

  singleGrids.renderIdentityPathGrid(section);
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].target, section);
  assert.deepEqual(
    rendered[0].items.map((item) => [item.dataKey, item.label, item.placeholder, item.get()]),
    [
      ['avatar', 'Avatar', 'assets/avatar.png', 'assets/avatar.png'],
      ['contentRoot', 'Content root', 'wwwroot', 'wwwroot']
    ]
  );

  rendered[0].items[0].set('assets/new-avatar.png');
  rendered[0].items[1].set('content');
  assert.equal(site.avatar, 'assets/new-avatar.png');
  assert.equal(site.contentRoot, 'content');

  singleGrids.renderSeoResourceGrid(section);
  assert.equal(rendered.length, 2);
  assert.deepEqual(
    rendered[1].items.map((item) => [item.dataKey, item.label, item.placeholder, item.get()]),
    [['resourceURL', 'Resource URL', 'https://example.test/', 'https://example.test/']]
  );
  rendered[1].items[0].set('https://press.example/');
  assert.equal(site.resourceURL, 'https://press.example/');
}

{
  const rendered = [];
  const singleGrids = createComposerSiteSettingsSingleGrids({
    site: {},
    renderSingleTextGrid: (target, items) => {
      rendered.push({ target, items });
    }
  });

  singleGrids.renderIdentityPathGrid({});
  singleGrids.renderSeoResourceGrid({});
  assert.equal(rendered.length, 2);
  assert.deepEqual(rendered.map((entry) => entry.items), [[], []]);
}
