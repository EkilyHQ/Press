const DEFAULT_PREVIEW_THEME_OPTION = { value: 'native', label: 'Native' };
const DEFAULT_PREVIEW_THEME_OPTIONS = [DEFAULT_PREVIEW_THEME_OPTION];
const noop = () => {};

export function sanitizePreviewThemePack(value) {
  const clean = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || 'native';
}

function normalizePreviewThemeOptions(lists) {
  const normalized = [];
  const seen = new Set();
  lists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((item) => {
      const value = sanitizePreviewThemePack(item && item.value);
      if (!value || seen.has(value)) return;
      seen.add(value);
      normalized.push({ value, label: String((item && item.label) || value) });
    });
  });
  return normalized;
}

export function createEditorMainPreviewThemePicker(options = {}) {
  const documentRef = options.documentRef || null;
  const getElementById = typeof options.getElementById === 'function' ? options.getElementById : () => null;
  const getSiteThemePack = typeof options.getSiteThemePack === 'function' ? options.getSiteThemePack : () => 'native';
  const fetchImpl = typeof options.fetch === 'function' ? options.fetch : null;
  const onChange = typeof options.onChange === 'function' ? options.onChange : noop;

  let themeOverride = '';
  let themeOptions = DEFAULT_PREVIEW_THEME_OPTIONS;

  const getActiveThemePack = () => {
    return sanitizePreviewThemePack(themeOverride || getSiteThemePack());
  };

  const getThemeOptions = () => (
    Array.isArray(themeOptions) && themeOptions.length ? themeOptions : DEFAULT_PREVIEW_THEME_OPTIONS
  );

  const appendOption = (select, value, label) => {
    if (!documentRef || typeof documentRef.createElement !== 'function') return;
    const option = documentRef.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  };

  const updateSelect = () => {
    try {
      const select = getElementById('previewThemeSelect');
      if (!select) return;
      const active = getActiveThemePack();
      const seen = new Set();
      select.innerHTML = '';
      getThemeOptions().forEach((item) => {
        const value = sanitizePreviewThemePack(item && item.value);
        if (!value || seen.has(value)) return;
        seen.add(value);
        appendOption(select, value, String((item && item.label) || value));
      });
      if (!seen.has(active)) {
        appendOption(select, active, active);
      }
      select.value = active;
    } catch (_) {}
  };

  const fetchThemeList = (path, optional = false) => fetchImpl(path, { cache: 'no-store' })
    .then((response) => {
      if (response && response.ok) return response.json();
      if (optional) return [];
      return Promise.reject(new Error(`Unable to load ${path}`));
    })
    .catch((err) => {
      if (optional) return [];
      throw err;
    });

  const loadOptions = () => {
    if (!fetchImpl) {
      updateSelect();
      return Promise.resolve([]);
    }
    return Promise.all([
      fetchThemeList('assets/themes/packs.json'),
      fetchThemeList('assets/themes/packs.local.json', true)
    ])
      .then((lists) => {
        const normalized = normalizePreviewThemeOptions(lists);
        if (normalized.length) themeOptions = normalized;
        updateSelect();
        return normalized;
      })
      .catch(() => {
        updateSelect();
        return getThemeOptions();
      });
  };

  const handleSiteConfigChange = () => {
    if (!themeOverride) updateSelect();
  };

  const bind = () => {
    const select = getElementById('previewThemeSelect');
    if (select && typeof select.addEventListener === 'function') {
      select.addEventListener('change', () => {
        themeOverride = sanitizePreviewThemePack(select.value || 'native');
        updateSelect();
        onChange();
      });
    }
    loadOptions();
  };

  return {
    bind,
    getActiveThemePack,
    handleSiteConfigChange,
    hasOverride: () => !!themeOverride,
    loadOptions,
    updateSelect
  };
}
