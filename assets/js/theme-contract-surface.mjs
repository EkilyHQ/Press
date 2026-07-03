const REQUIRED_THEME_VIEWS = Object.freeze(['post', 'posts', 'search', 'tab']);
const OPTIONAL_THEME_VIEWS = Object.freeze(['error', 'loading']);
const REQUIRED_THEME_REGIONS = Object.freeze(['main', 'toc', 'search', 'nav', 'tags', 'footer']);
const REQUIRED_THEME_COMPONENTS = Object.freeze(['press-search', 'press-toc', 'press-post-card']);
const REQUIRED_THEME_CONTENT_SHAPES = Object.freeze([
  'rawMarkdown',
  'html',
  'blocks',
  'tocTree',
  'headings',
  'metadata',
  'assets',
  'links'
]);
const REQUIRED_THEME_MANIFEST_FIELDS = Object.freeze(['contractVersion', 'engines', 'content', 'modules']);
const DEFAULT_THEME_STYLES = Object.freeze(['theme.css']);
const SUPPORTED_THEME_CONTRACT_VERSIONS = Object.freeze([3]);
const THEME_ARCHIVE_ALLOWED_EXTENSIONS = Object.freeze([
  '.avif', '.css', '.gif', '.ico', '.jpeg', '.jpg', '.js', '.json', '.mjs', '.otf',
  '.png', '.svg', '.ttf', '.txt', '.webp', '.woff', '.woff2'
]);
const THEME_TEXT_EXTENSIONS = Object.freeze(['.css', '.js', '.json', '.mjs', '.svg', '.txt']);

export const PRESS_THEME_CONTRACT = Object.freeze({
  schemaVersion: 1,
  type: 'press-theme-contract',
  contractVersion: 3,
  supportedContractVersions: SUPPORTED_THEME_CONTRACT_VERSIONS,
  manifestSchemaPath: 'assets/schema/theme.json',
  manifest: Object.freeze({
    requiredFields: REQUIRED_THEME_MANIFEST_FIELDS,
    defaultStyles: DEFAULT_THEME_STYLES,
    requiredViews: REQUIRED_THEME_VIEWS,
    optionalViews: OPTIONAL_THEME_VIEWS,
    requiredRegions: REQUIRED_THEME_REGIONS,
    requiredComponents: REQUIRED_THEME_COMPONENTS,
    requiredContentShapes: REQUIRED_THEME_CONTENT_SHAPES
  }),
  archive: Object.freeze({
    allowedExtensions: THEME_ARCHIVE_ALLOWED_EXTENSIONS,
    textExtensions: THEME_TEXT_EXTENSIONS
  })
});

export function getRequiredThemeManifestFields() {
  return [...REQUIRED_THEME_MANIFEST_FIELDS];
}

export function getDefaultThemeStyles() {
  return [...DEFAULT_THEME_STYLES];
}

export function getSupportedThemeContractVersions() {
  return [...SUPPORTED_THEME_CONTRACT_VERSIONS];
}

export function getRequiredThemeViews() {
  return [...REQUIRED_THEME_VIEWS];
}

export function getOptionalThemeViews() {
  return [...OPTIONAL_THEME_VIEWS];
}

export function getThemeViewNames() {
  return [...REQUIRED_THEME_VIEWS, ...OPTIONAL_THEME_VIEWS];
}

export function getRequiredThemeRegions() {
  return [...REQUIRED_THEME_REGIONS];
}

export function getRequiredThemeComponents() {
  return [...REQUIRED_THEME_COMPONENTS];
}

export function getRequiredThemeContentShapes() {
  return [...REQUIRED_THEME_CONTENT_SHAPES];
}

export function getThemeArchiveAllowedExtensions() {
  return [...THEME_ARCHIVE_ALLOWED_EXTENSIONS];
}

export function getThemeTextExtensions() {
  return [...THEME_TEXT_EXTENSIONS];
}

export function isPressThemeContractVersionSupported(value) {
  return SUPPORTED_THEME_CONTRACT_VERSIONS.includes(Number(value));
}
