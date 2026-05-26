export function createComposerSiteSettingsSingleGrids(options = {}) {
  const site = options.site || {};
  const siteSettingsSchema = options.siteSettingsSchema || { fields: {} };
  const schemaFields = siteSettingsSchema.fields || {};
  const renderSingleTextGrid = typeof options.renderSingleTextGrid === 'function'
    ? options.renderSingleTextGrid
    : () => {};

  const renderSchemaTextGrid = (section, fieldGroup = []) => {
    const items = (Array.isArray(fieldGroup) ? fieldGroup : []).map((item) => ({
      ...item,
      get: () => site[item.dataKey],
      set: (value) => { site[item.dataKey] = value; }
    }));

    renderSingleTextGrid(section, items);
  };

  return {
    renderIdentityPathGrid: (section) => renderSchemaTextGrid(section, schemaFields.identityPaths),
    renderSeoResourceGrid: (section) => renderSchemaTextGrid(section, schemaFields.seoResources)
  };
}
