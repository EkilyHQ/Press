import assert from 'node:assert/strict';
import {
  applyThemeSettingsCssVariables,
  normalizeThemeSettingsMap,
  resolveThemeSettings,
  setThemeSettingOverride,
  themeSettingValueSignature,
  themeSettingsForOutput,
  validateThemeConfigSchema
} from '../assets/js/theme-settings.js';
import {
  computeSiteDiff,
  prepareSiteState,
  toSiteYaml
} from '../assets/js/composer-site-model.js';

const arcusManifest = {
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      accentColor: {
        type: 'string',
        format: 'color',
        default: '#7b8bff',
        title: 'Accent color',
        'x-press': {
          control: 'color',
          group: 'Brand',
          cssVariable: '--arcus-user-accent'
        }
      },
      radiusScale: {
        type: 'number',
        default: 1,
        minimum: 0,
        maximum: 1.6,
        multipleOf: 0.05,
        title: 'Corner radius',
        'x-press': {
          control: 'range',
          group: 'Shape',
          cssVariable: '--arcus-radius-scale'
        }
      },
      cardDensity: {
        type: 'string',
        default: 'comfortable',
        enum: ['comfortable', 'compact', 'spacious'],
        title: 'Card density',
        'x-press': {
          control: 'select',
          group: 'Layout',
          options: [
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
            { value: 'spacious', label: 'Spacious' }
          ]
        }
      }
    }
  }
};

const siteConfig = {
  themePack: 'arcus',
  themeSettings: {
    arcus: {
      accentColor: '#ff0055',
      radiusScale: 2,
      cardDensity: 'dense',
      unknownSetting: true
    }
  }
};

const resolution = resolveThemeSettings({
  pack: 'arcus',
  manifest: arcusManifest,
  siteConfig
});

assert.deepEqual(resolution.defaults, {
  accentColor: '#7b8bff',
  radiusScale: 1,
  cardDensity: 'comfortable'
});
assert.equal(resolution.settings.accentColor, '#ff0055');
assert.equal(resolution.settings.radiusScale, 1, 'invalid number overrides should fall back to the schema default');
assert.equal(resolution.settings.cardDensity, 'comfortable', 'invalid select overrides should fall back to the schema default');
assert.deepEqual(resolution.overrides, { accentColor: '#ff0055' });
assert.ok(resolution.warnings.some(entry => entry.path === 'themeSettings.arcus.radiusScale'));
assert.ok(resolution.warnings.some(entry => entry.path === 'themeSettings.arcus.cardDensity'));
assert.ok(resolution.warnings.some(entry => entry.path === 'themeSettings.arcus.unknownSetting'));
assert.deepEqual(resolution.cssVariables, [
  { key: 'accentColor', name: '--arcus-user-accent', value: '#ff0055' }
]);

const emptyResolution = resolveThemeSettings({
  pack: 'native',
  manifest: { configSchema: { type: 'object', additionalProperties: true } },
  siteConfig: {
    themeSettings: {
      arcus: {
        accentColor: '#00ff00'
      }
    }
  }
});
assert.deepEqual(emptyResolution.settings, {}, 'settings from another theme slug should not leak into the current theme');
assert.deepEqual(emptyResolution.cssVariables, [], 'empty configSchema should not emit CSS variables');
assert.equal(emptyResolution.warnings.length, 0, 'empty configSchema should not warn when another slug has settings');

const radiusOverride = resolveThemeSettings({
  pack: 'arcus',
  manifest: arcusManifest,
  siteConfig: {
    themeSettings: {
      arcus: {
        radiusScale: 1.25
      }
    }
  }
});
assert.deepEqual(radiusOverride.cssVariables, [
  { key: 'radiusScale', name: '--arcus-radius-scale', value: '1.25' }
]);

const invalidStepOverride = resolveThemeSettings({
  pack: 'arcus',
  manifest: arcusManifest,
  siteConfig: {
    themeSettings: {
      arcus: {
        radiusScale: 1.23
      }
    }
  }
});
assert.equal(invalidStepOverride.settings.radiusScale, 1, 'number overrides should respect multipleOf constraints');
assert.deepEqual(invalidStepOverride.overrides, {});
assert.ok(invalidStepOverride.warnings.some(entry => entry.path === 'themeSettings.arcus.radiusScale'));

const normalizedMap = normalizeThemeSettingsMap({
  Arcus: { accentColor: '#abcdef' },
  'bad slug!': { accentColor: '#fedcba' },
  solstice: null
});
assert.deepEqual(normalizedMap, {
  arcus: { accentColor: '#abcdef' },
  badslug: { accentColor: '#fedcba' }
});
assert.deepEqual(themeSettingsForOutput({ arcus: {}, solstice: { accentColor: '#123456' } }), {
  solstice: { accentColor: '#123456' }
});

const draftSite = { themePack: 'arcus' };
const accentField = resolution.fields.find(field => field.key === 'accentColor');
assert.equal(setThemeSettingOverride(draftSite, 'arcus', 'accentColor', '#112233', accentField), true);
assert.deepEqual(draftSite.themeSettings, { arcus: { accentColor: '#112233' } });
assert.equal(setThemeSettingOverride(draftSite, 'arcus', 'accentColor', '#7b8bff', accentField), true);
assert.equal(draftSite.themeSettings, undefined, 'setting a schema default should remove the persisted override');

const optionalNumberSite = { themePack: 'arcus', themeSettings: { arcus: { maxWidth: 72 } } };
const optionalNumberField = {
  key: 'maxWidth',
  control: 'number',
  type: 'number',
  defaultValue: undefined
};
assert.equal(setThemeSettingOverride(optionalNumberSite, 'arcus', 'maxWidth', undefined, optionalNumberField), true);
assert.equal(optionalNumberSite.themeSettings, undefined, 'clearing an optional numeric setting should remove the persisted override');
assert.notEqual(themeSettingValueSignature(1), themeSettingValueSignature('1'), 'select option signatures should preserve scalar types');

const shortColorResolution = resolveThemeSettings({
  pack: 'arcus',
  manifest: {
    configSchema: {
      type: 'object',
      properties: {
        accentColor: {
          type: 'string',
          format: 'color',
          default: '#abc',
          'x-press': {
            control: 'color',
            cssVariable: '--arcus-short-accent'
          }
        }
      }
    }
  },
  siteConfig: {
    themeSettings: {
      arcus: {
        accentColor: '#aabbcc'
      }
    }
  }
});
assert.equal(shortColorResolution.defaults.accentColor, '#aabbcc', 'short color defaults should normalize to the browser color input form');
assert.deepEqual(shortColorResolution.overrides, {}, 'expanded short color defaults should not persist as overrides');
assert.deepEqual(shortColorResolution.cssVariables, [], 'expanded short color defaults should not emit CSS override variables');

const cssValues = new Map();
const fakeDocument = {
  documentElement: {
    style: {
      setProperty(name, value) {
        cssValues.set(name, value);
      },
      removeProperty(name) {
        cssValues.delete(name);
      }
    }
  }
};
assert.equal(applyThemeSettingsCssVariables(fakeDocument, resolution), true);
assert.equal(cssValues.get('--arcus-user-accent'), '#ff0055');
assert.equal(cssValues.has('--arcus-radius-scale'), false, 'schema defaults should not be injected as CSS overrides');
assert.equal(applyThemeSettingsCssVariables(fakeDocument, { cssVariables: [] }), true);
assert.equal(cssValues.has('--arcus-user-accent'), false, 'stale theme CSS variables should be removed');

const prepared = prepareSiteState({
  siteTitle: 'Theme Site',
  themePack: 'arcus',
  themeSettings: {
    arcus: {
      accentColor: '#ff0055',
      radiusScale: 1.25,
      cardDensity: 'compact'
    },
    solstice: {
      accentColor: '#445566'
    }
  }
});
const yaml = toSiteYaml(prepared);
assert.match(yaml, /^themeSettings:\n/m);
assert.match(yaml, /arcus:\n\s+accentColor: "#ff0055"\n\s+radiusScale: 1\.25\n\s+cardDensity: compact/);
assert.match(yaml, /solstice:\n\s+accentColor: "#445566"/);

const diff = computeSiteDiff(
  prepareSiteState({ themePack: 'arcus', themeSettings: { arcus: { accentColor: '#ff0055' } } }),
  prepareSiteState({ themePack: 'arcus' })
);
assert.equal(diff.hasChanges, true);
assert.deepEqual(diff.fields.themeSettings, { type: 'object' });

assert.throws(
  () => validateThemeConfigSchema({
    type: 'object',
    properties: {
      accentColor: {
        type: 'string',
        format: 'color',
        default: '#ffffff',
        'x-press': {
          control: 'color',
          cssVariable: 'arcus-accent'
        }
      }
    }
  }),
  /unsafe CSS variable/,
  'theme package validation should reject unsafe CSS variable mappings'
);

assert.throws(
  () => validateThemeConfigSchema({
    type: 'object',
    properties: {
      labelStyle: {
        type: 'string',
        default: 'plain',
        'x-press': {
          control: 'slider'
        }
      }
    }
  }),
  /unsupported control "slider"/,
  'theme package validation should reject unsupported explicit controls'
);

assert.throws(
  () => validateThemeConfigSchema({
    type: 'object',
    properties: {
      radiusScale: {
        type: 'string',
        'x-press': {
          control: 'range'
        }
      }
    }
  }),
  /incompatible type "string"/,
  'theme package validation should reject controls incompatible with schema types'
);

assert.equal(
  validateThemeConfigSchema({
    type: 'object',
    properties: {
      nestedLegacyConfig: {
        type: 'object',
        properties: {
          tone: { type: 'string' }
        }
      },
      typelessNestedConfig: {
        properties: {
          density: { type: 'string' }
        }
      }
    }
  }),
  true,
  'theme package validation should ignore non-Press nested config schemas'
);

console.log('ok - theme settings contract');
